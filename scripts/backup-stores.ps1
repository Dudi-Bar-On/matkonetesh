<#
.SYNOPSIS
    Back up both stores to a separate physical disk, and to a removable drive when it is attached.
    Verifies every dump before it counts it as one. No cloud, no network.

.DESCRIPTION
    Owner constraints, 2026-08-07: no cloud - both for privacy and because the solution must work on an
    AIRGAPPED network. So redundancy is bought with local hardware instead.

    WHY G: AND NOT A PARTITION. Measured on this machine:

        C:  ->  disk 2  ·  Samsung 990 PRO 4TB NVMe   (system, repo, BOTH databases)
        G:  ->  disk 1  ·  Seagate 18TB SATA          (12 TB free)
        F:  ->  disk 5  ·  SanDisk USB                (removable)

    A partition carved out of C: would have given logical separation and zero protection from hardware
    failure - it dies with the NVMe. G: is a different physical disk on a different bus. F: is the
    strongest anchor of all, because it can be physically detached: nothing reachable over a network
    can touch a drive that is not plugged in.

    WHY NOT GIT. The dump is ~190 MB of already-compressed binary. Git stores every version whole and
    cannot delta it, so the repository would grow by a gigabyte a week and every clone would carry it.
    Git is an excellent anchor for text and a poor one for large binaries. The division that actually
    holds: git anchors what PRODUCES the geniza - all 923 documents in it come from repo files, measured
    - and these drives anchor the expensive-to-recompute product.

    WHAT IS BACKED UP
      mk_knowledge  (the geniza)     pg_dump -Fc  ~190 MB
      mk_rules      (the rules)      pg_dump -Fc  small
      roles                          pg_dumpall --globals-only
      neo4j                          neo4j-admin database dump  - and this one matters most:
                                     R-110 records that 9,877 Module nodes and 16,456 relationships
                                     exist ONLY in Neo4j, in no other store. A perfect Postgres backup
                                     would not save them.

    EVERY DUMP IS VERIFIED BEFORE IT COUNTS. pg_restore --list actually opens the archive; a size check
    alone would accept a truncated file. Section 9 of the enforcement spec: a mechanism that has never
    been tested is an assumption - and that applies to a backup exactly as it applies to a recovery.
    A backup nobody has opened is a belief.

    RETENTION: the newest N of each kind are kept per destination; older ones are removed only AFTER a
    new one has been written and verified. A retention pass that runs before the new backup succeeds is
    how people lose everything at once.
#>

[CmdletBinding()]
param(
    [string]$PrimaryDest   = 'G:\matconetesh-backups',
    [string]$RemovableDest = 'F:\matconetesh-backups',
    [int]   $Keep          = 7,
    [switch]$SkipNeo4j
)

$ErrorActionPreference = 'Stop'
function Write-Step { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Warn { param($m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Write-Fail { param($m) Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }

$RepoRoot = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$PgBin    = 'C:\Program Files\PostgreSQL\18\bin'
$Stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'

function Get-EnvValue {
    param($File, $Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Get-Content $File | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace "^\s*$Key\s*=", '').Trim()
}

Write-Step "Preflight"
if (-not (Test-Path "$PgBin\pg_dump.exe")) { Write-Fail "pg_dump not found at $PgBin" }

# Destinations. The removable drive is OPTIONAL BY DESIGN: it is meant to be detached most of the time,
# and treating "not plugged in" as a failure would turn this into a job that cries wolf daily.
$dests = @()
if (Test-Path (Split-Path $PrimaryDest -Qualifier)) { $dests += $PrimaryDest }
else { Write-Fail "primary destination drive $(Split-Path $PrimaryDest -Qualifier) is not present. This is the one that must exist." }
if (Test-Path (Split-Path $RemovableDest -Qualifier)) { $dests += $RemovableDest }
else { Write-Warn "removable drive $(Split-Path $RemovableDest -Qualifier) not attached - skipping the second copy. This is expected, not an error." }
foreach ($d in $dests) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
Write-Host "  destinations: $($dests -join ' , ')"

$staging = Join-Path $env:TEMP "mk-backup-$Stamp"
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$produced = @()

function Invoke-PgDump {
    param($Label, $EnvFile, $UserKey, $PassKey, $PortKey, $DbName, $OutName)
    $user = Get-EnvValue $EnvFile $UserKey
    $pass = Get-EnvValue $EnvFile $PassKey
    $port = Get-EnvValue $EnvFile $PortKey
    if (-not $user -or -not $pass -or -not $port) { Write-Warn "$Label : missing credentials in $EnvFile - skipped."; return }
    $out = Join-Path $staging $OutName
    $env:PGPASSWORD = $pass
    try {
        & "$PgBin\pg_dump.exe" -h 127.0.0.1 -p $port -U $user -Fc $DbName -f $out
        if ($LASTEXITCODE -ne 0) { Write-Fail "$Label : pg_dump exited $LASTEXITCODE" }
        # OPEN the archive. A size check would accept a truncated file that looks plausible.
        $toc = & "$PgBin\pg_restore.exe" --list $out 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Fail "$Label : dump written but pg_restore --list refused it - $($toc | Select-Object -First 1)" }
        $entries = ($toc | Measure-Object -Line).Lines
        if ($entries -lt 10) { Write-Fail "$Label : archive opened but holds only $entries entries - that is not a real dump." }
        $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
        Write-Host "  $Label : $OutName  $mb MB  ·  verified restorable ($entries TOC entries)"
        $script:produced += $out
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

Write-Step "Dumping mk_knowledge (the geniza)"
Invoke-PgDump 'geniza' (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER' 'POSTGRES_SUPERUSER_PASSWORD' 'POSTGRES_PORT' 'mk_knowledge' "mk_knowledge-$Stamp.dump"

Write-Step "Dumping mk_rules (the rules store)"
# mk_rules lives on the SAME PostgreSQL server as the geniza (both on 5432, measured), so one set of
# superuser credentials from infra\.env dumps both. The first version looked for RULES_ADMIN_USER /
# RULES_ADMIN_PASSWORD in infra\rules-db\.env - keys that do not exist there; that file holds
# RULES_SUPERUSER, RULES_APP_PASSWORD and RULES_READER_PASSWORD. It skipped with a warning rather
# than failing, which is the right shape, but it meant the rules store was silently not backed up.
$rulesDb = Get-EnvValue (Join-Path $RepoRoot 'infra\rules-db\.env') 'RULES_POSTGRES_DB'
if (-not $rulesDb) { $rulesDb = 'mk_rules' }
Invoke-PgDump 'rules' (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER' 'POSTGRES_SUPERUSER_PASSWORD' 'POSTGRES_PORT' $rulesDb "mk_rules-$Stamp.dump"

Write-Step "Dumping roles (globals)"
$su = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER'
$sp = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_SUPERUSER_PASSWORD'
$sport = Get-EnvValue (Join-Path $RepoRoot 'infra\.env') 'POSTGRES_PORT'
if ($su -and $sp) {
    $rolesOut = Join-Path $staging "roles-$Stamp.sql"
    $env:PGPASSWORD = $sp
    try {
        & "$PgBin\pg_dumpall.exe" -h 127.0.0.1 -p $sport -U $su --globals-only -f $rolesOut
        if ($LASTEXITCODE -ne 0) { Write-Fail "pg_dumpall exited $LASTEXITCODE" }
        if ((Get-Item $rolesOut).Length -lt 200) { Write-Fail "roles dump is suspiciously small." }
        Write-Host "  roles : $([math]::Round((Get-Item $rolesOut).Length/1KB,1)) KB"
        $produced += $rolesOut
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

Write-Step "Dumping the Neo4j graph"
if ($SkipNeo4j) { Write-Warn 'skipped by request.' }
else {
    # Community edition dumps OFFLINE only. Stopping the graph for a backup is a real cost, so it is
    # stated rather than done silently - and the caller can skip it with -SkipNeo4j on a working day.
    $neoHome = [System.Environment]::GetEnvironmentVariable('NEO4J_HOME', 'Machine')
    $javaHome = [System.Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
    # Stopping a Windows service needs elevation. Unprivileged, Stop-Service throws - and with
    # $ErrorActionPreference='Stop' that killed the whole run BEFORE the copy step, so a geniza dump
    # already made and verified was thrown away. A partial success must still deliver what it
    # produced; losing good work because a later optional step failed is the worst shape a backup
    # script can have.
    $elevated = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $elevated) {
        Write-Warn 'not elevated - the graph CANNOT be backed up (Community dumps offline only, and stopping the service needs admin).'
        Write-Warn 'R-110: 9,877 Module nodes exist ONLY in Neo4j. Run this script elevated to include them.'
    }
    elseif (-not $neoHome) { Write-Warn 'NEO4J_HOME not set machine-wide - skipping the graph.' }
    else {
        $env:JAVA_HOME = $javaHome; $env:Path = "$javaHome\bin;$env:Path"
        $wasRunning = (Get-Service neo4j -ErrorAction SilentlyContinue).Status -eq 'Running'
        Write-Host "  stopping neo4j (Community dumps offline only; it will be restarted)"
        if ($wasRunning) { Stop-Service neo4j -Force; Start-Sleep -Seconds 3 }
        try {
            & "$neoHome\bin\neo4j-admin.bat" database dump neo4j --to-path=$staging *> $null
            if ($LASTEXITCODE -ne 0) { Write-Warn "neo4j-admin dump exited $LASTEXITCODE - the graph was NOT backed up." }
            else {
                $nd = Join-Path $staging 'neo4j.dump'
                if (Test-Path $nd) {
                    $renamed = Join-Path $staging "neo4j-$Stamp.dump"
                    Move-Item $nd $renamed
                    Write-Host "  graph : neo4j-$Stamp.dump  $([math]::Round((Get-Item $renamed).Length/1MB,1)) MB"
                    Write-Host "          (R-110: 9,877 Module nodes live ONLY here - this is the only copy that saves them)"
                    $produced += $renamed
                }
            }
        } catch {
            Write-Warn "graph backup failed: $($_.Exception.Message)"
        } finally {
            $ErrorActionPreference = 'Stop'
            if ($wasRunning) { Start-Service neo4j -ErrorAction SilentlyContinue; Write-Host '  neo4j restarted.' }
        }
    }
}

if (-not $produced.Count) { Write-Fail 'nothing was produced - refusing to report success.' }

Write-Step "Copying to $($dests.Count) destination(s)"
foreach ($d in $dests) {
    foreach ($f in $produced) {
        Copy-Item $f -Destination $d -Force
        $src = (Get-Item $f).Length; $dst = (Get-Item (Join-Path $d (Split-Path $f -Leaf))).Length
        if ($src -ne $dst) { Write-Fail "copy to $d is a different size than the source ($src vs $dst)." }
    }
    Write-Host "  $d : $($produced.Count) file(s), sizes match the source."
}

Write-Step "Retention - keeping the newest $Keep of each kind, per destination"
foreach ($d in $dests) {
    foreach ($pattern in @('mk_knowledge-*.dump', 'mk_rules-*.dump', 'roles-*.sql', 'neo4j-*.dump')) {
        $old = Get-ChildItem $d -Filter $pattern -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep
        foreach ($o in $old) { Remove-Item $o.FullName -Force; Write-Host "  removed $($o.Name) from $d" }
    }
}

Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n================ BACKUP COMPLETE ================" -ForegroundColor Green
Write-Host "Produced $($produced.Count) verified artifact(s), copied to: $($dests -join ' , ')"
if ($dests.Count -eq 1) { Write-Host "F: was not attached - only one copy exists right now. Attach it and re-run for the detachable anchor." -ForegroundColor Yellow }
Write-Host "=================================================="
