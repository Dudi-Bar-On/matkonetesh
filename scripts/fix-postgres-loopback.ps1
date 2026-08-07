<#
.SYNOPSIS
    Bind PostgreSQL to loopback only, and prove it - remediation for what A6 found.

.DESCRIPTION
    A6 ("nothing listens beyond loopback") was Docker-shaped: it asked the Docker daemon. Rewritten
    on 2026-08-07 to ask the operating system instead, it immediately found this:

        port 5432  ->  0.0.0.0, ::          postgresql-x64-18   (the geniza AND mk_rules)
        port 7687  ->  127.0.0.1            neo4j               (correct)
        postgresql.conf: listen_addresses = '*'

    This contradicts the owner's standing constraint that databases are not exposed to the network by
    default. It predates the Docker-exit work - it is how the native PostgreSQL was installed on
    2026-08-06 - and A6 could not see it, because A6 was still asking a daemon that no longer held
    PostgreSQL. That is the whole argument for this arc's Task 7 in one observation.

    HOW BAD IT IS, STATED HONESTLY. pg_hba.conf grants only 127.0.0.1/32 and ::1/128, so a connection
    arriving from elsewhere is refused at authentication, and no inbound firewall rule opens 5432.
    The socket is open; the door behind it is not. That is a real mitigation and it is the SECOND
    layer - this script restores the first, which is the one A6 checks, because A6 reads the socket
    rather than the intent.

    WHAT IT DOES
      1. Refuses unless elevated.
      2. Backs up postgresql.conf next to itself with a timestamp, before touching it.
      3. Records the row counts of `documents` and `document_chunks` BEFORE the restart.
      4. Sets listen_addresses = 'localhost' - commenting the old line rather than deleting it, so
         the change is visible in the file itself and not only in git.
      5. Restarts postgresql-x64-18 and waits for it to answer.
      6. VERIFIES: the socket is loopback-only, and the row counts are unchanged. A restart that
         comes back on an empty data directory would otherwise look like success.

    ROLLBACK: the backup is written before any change, and its path is printed. Restore it and
    restart the service.

    NOT DESTRUCTIVE, but it does restart the owner's live evidence store. Nothing else on the machine
    should be mid-write when it runs - no extraction, no ingest.
#>

[CmdletBinding()]
param(
    [string]$ServiceName = "postgresql-x64-18",
    [string]$DataDir     = "C:\Program Files\PostgreSQL\18\data",
    [int]   $Port        = 5432,
    [int]   $WaitSeconds = 120
)

$ErrorActionPreference = "Stop"
function Write-Step   { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Refuse { param($m) Write-Host "`nREFUSING: $m" -ForegroundColor Yellow; exit 1 }
function Write-Fail   { param($m) Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }

$RepoRoot = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$Conf     = Join-Path $DataDir "postgresql.conf"

Write-Step "Preflight"
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Refuse "this script must be run from an ELEVATED PowerShell prompt (editing the data directory and restarting a service require it)."
}
if (-not (Test-Path $Conf)) { Write-Refuse "postgresql.conf not found at $Conf" }
if (-not (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) { Write-Refuse "service '$ServiceName' not found." }

# Nothing should be writing while the store restarts.
$writers = Get-Process python, py -ErrorAction SilentlyContinue | Where-Object { $_.CPU -gt 5 }
if ($writers) {
    Write-Host "  NOTE: python processes with real CPU time are running:" -ForegroundColor Yellow
    $writers | ForEach-Object { Write-Host "        PID $($_.Id) $($_.ProcessName) CPU=$([math]::Round($_.CPU,1))s" }
    Write-Host "        If an extraction or ingest is in flight, stop it first and re-run." -ForegroundColor Yellow
}

Write-Step "Current state, before any change"
$before = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
Write-Host "  port $Port listening on: $((($before.LocalAddress | Sort-Object -Unique) -join ', '))"
Select-String -Path $Conf -Pattern '^\s*listen_addresses' | ForEach-Object { Write-Host "  conf: $($_.Line.Trim())" }

# Row counts BEFORE. A service that restarts onto an empty data directory would otherwise pass every
# other check in this script.
Write-Step "Recording row counts (so 'it came back' cannot be mistaken for 'the data came back')"
Push-Location $RepoRoot
try {
    $countsBefore = & py -3 -c @"
import sys; sys.path.insert(0,'.')
from src.knowledge import config
c=config.connect_reader(); cur=c.cursor()
cur.execute('select (select count(*) from documents), (select count(*) from document_chunks)')
print('%d %d' % cur.fetchone()); c.close()
"@
} finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { Write-Fail "could not read row counts before the change: $countsBefore" }
Write-Host "  documents/chunks before: $countsBefore"

Write-Step "Backing up postgresql.conf"
$backup = "$Conf.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -Path $Conf -Destination $backup
Write-Host "  backup: $backup"
Write-Host "  ROLLBACK = copy that file back over $Conf and restart the service."

Write-Step "Setting listen_addresses = 'localhost'"
$lines = @(Get-Content $Conf)
$out = New-Object System.Collections.Generic.List[string]
$replaced = 0
foreach ($l in $lines) {
    if ($l -match "^\s*listen_addresses\s*=") {
        # Comment rather than delete: the change should be legible in the file, not only in a diff.
        $out.Add("# (superseded by scripts/fix-postgres-loopback.ps1, A6 remediation) $l")
        $replaced++
    } else {
        $out.Add($l)
    }
}
$out.Add("")
$out.Add("# Set by scripts/fix-postgres-loopback.ps1 - A6 requires that nothing listens beyond loopback.")
$out.Add("listen_addresses = 'localhost'")
Set-Content -Path $Conf -Value $out -Encoding ASCII
Write-Host "  commented $replaced previous declaration(s); appended the loopback setting."

Write-Step "Restarting $ServiceName"
Restart-Service -Name $ServiceName -Force
$sw = [Diagnostics.Stopwatch]::StartNew()
$up = $false
while ($sw.Elapsed.TotalSeconds -lt $WaitSeconds) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $up = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $up) {
    Write-Fail "service did not listen on $Port within ${WaitSeconds}s. Restore $backup over $Conf and restart. Check the PostgreSQL log in $DataDir\log."
}
Write-Host "  up after $([math]::Round($sw.Elapsed.TotalSeconds,1))s."

Write-Step "Verifying - the socket, and then the data"
$after = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$addrs = ($after.LocalAddress | Sort-Object -Unique)
Write-Host "  port $Port now listening on: $($addrs -join ', ')"
$bad = $addrs | Where-Object { $_ -notin @("127.0.0.1", "::1") }
if ($bad) { Write-Fail "still listening beyond loopback on: $($bad -join ', '). Restore $backup and investigate." }

Push-Location $RepoRoot
try {
    $countsAfter = & py -3 -c @"
import sys; sys.path.insert(0,'.')
from src.knowledge import config
c=config.connect_reader(); cur=c.cursor()
cur.execute('select (select count(*) from documents), (select count(*) from document_chunks)')
print('%d %d' % cur.fetchone()); c.close()
"@
} finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { Write-Fail "the service is listening but a read failed after the restart: $countsAfter" }
Write-Host "  documents/chunks after : $countsAfter"

if ($countsBefore.Trim() -ne $countsAfter.Trim()) {
    Write-Fail "row counts changed across the restart ('$countsBefore' -> '$countsAfter'). Do not proceed; investigate."
}

Write-Host "`n================ LOOPBACK RESTORED ================" -ForegroundColor Green
Write-Host "listen_addresses = 'localhost'; socket is $($addrs -join ', ') only."
Write-Host "Row counts identical across the restart: $countsAfter"
Write-Host "Backup kept at: $backup"
Write-Host "Next: run  python -m pytest tests/test_acceptance_infra.py -q  - A6 should now pass."
Write-Host "===================================================="
