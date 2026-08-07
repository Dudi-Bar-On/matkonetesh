<#
.SYNOPSIS
    Task 3 of the Docker-exit arc: load the container's graph into the native Neo4j service, and
    PROVE the load reproduced it exactly.

.DESCRIPTION
    The dump already exists — it was taken from the container's volume by a one-off `neo4j-admin`
    container, so the Neo4j server itself never started and nothing in the container was modified:
        backups\neo4j-migration\neo4j.dump   (10.8 MB, from 278.8 MiB / 89 files)

    This script does the half that needs elevation (stopping a Windows service) and then verifies
    its own work. Verification is not optional and not manual: it runs scripts\graph-baseline.mjs
    against the freshly loaded native service and DIFFS it against the baseline recorded while the
    container still held the data. Any difference at all fails the migration.

    MUST be run from an ELEVATED PowerShell prompt.

    WHY THE BASELINE IS THE ORACLE. 9,877 of the graph's nodes exist in no other store — PostgreSQL
    holds no extracted fact (register row R-110), so a load that silently drops them cannot be
    noticed by looking at anything else. The only honest question is "are the counts identical",
    and the only honest answer is a mechanical comparison.

    THE BASELINE MUST HAVE BEEN TAKEN ON A QUIESCENT GRAPH, and this one was: nothing was writing,
    and two runs five seconds apart were byte-identical. An earlier baseline taken while an
    extraction was running came back higher on every count — that is why this check compares against
    a recorded file rather than re-measuring the container now.

    ROLLBACK. The container is stopped, not deleted, and this script never touches it. If anything
    here fails, the original graph is still sitting in the mk-neo4jdata volume, and the dump file is
    still on disk. Nothing is removed until Task 12, after the whole suite is green.
#>

[CmdletBinding()]
param(
    # NOT defaulted from $PSScriptRoot: it is EMPTY during parameter binding in Windows PowerShell
    # 5.1, so `Split-Path -Parent $PSScriptRoot` here throws before the script's own preflight can
    # refuse anything. Resolved in the body instead, where $PSScriptRoot is populated.
    [string]$RepoRoot   = "",
    [string]$Database   = "neo4j",
    [int]   $BoltPort   = 7687,
    [int]   $HttpPort   = 7474,
    [int]   $StopWaitSeconds  = 60,
    [int]   $StartWaitSeconds = 120
)

$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $RepoRoot = Split-Path -Parent $here
}

function Write-Step   { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Refuse { param($m) Write-Host "`nREFUSING: $m" -ForegroundColor Yellow; exit 1 }
function Write-Fail   { param($m) Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }

$DumpDir      = Join-Path $RepoRoot "backups\neo4j-migration"
$DumpFile     = Join-Path $DumpDir "$Database.dump"
$BaselineFile = Join-Path $RepoRoot "docs\infra\graph-baseline-2026-08-07.txt"
$BaselineJs   = Join-Path $RepoRoot "scripts\graph-baseline.mjs"

# --- 1. refuse rather than half-do -------------------------------------------------------------
Write-Step "Preflight"
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Refuse "this script must be run from an ELEVATED PowerShell prompt (stopping a Windows service requires it)."
}
foreach ($f in @($DumpFile, $BaselineFile, $BaselineJs)) {
    if (-not (Test-Path $f)) { Write-Refuse "required file missing: $f" }
}
$svc = Get-Service -Name "neo4j" -ErrorAction SilentlyContinue
if (-not $svc) { Write-Refuse "no 'neo4j' Windows service found - run scripts\install-neo4j-native.ps1 first." }

# Java: the service has it, this shell may not. Same fix as the installer and the verifier — resolve
# it from the machine environment rather than trusting whatever PATH this window inherited.
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine") }
if (-not $env:NEO4J_HOME) { $env:NEO4J_HOME = [System.Environment]::GetEnvironmentVariable("NEO4J_HOME", "Machine") }
if (-not $env:NEO4J_HOME) { Write-Refuse "NEO4J_HOME is not set machine-wide - re-run the installer." }
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$admin = Join-Path $env:NEO4J_HOME "bin\neo4j-admin.bat"
if (-not (Test-Path $admin)) { Write-Refuse "neo4j-admin not found at $admin" }

$dumpMb = [math]::Round((Get-Item $DumpFile).Length / 1MB, 1)
Write-Host "  dump      : $DumpFile ($dumpMb MB)"
Write-Host "  baseline  : $BaselineFile"
Write-Host "  service   : neo4j (Status=$($svc.Status))"

Write-Host "`n  The baseline this migration must reproduce:"
Get-Content $BaselineFile | ForEach-Object { Write-Host "    $_" }

# --- 2. stop the service (Community edition loads OFFLINE only) --------------------------------
Write-Step "Stopping the neo4j service (load requires the database to be offline)"
if ($svc.Status -ne "Stopped") {
    Stop-Service -Name "neo4j" -Force
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ((Get-Service neo4j).Status -ne "Stopped" -and $sw.Elapsed.TotalSeconds -lt $StopWaitSeconds) {
        Start-Sleep -Milliseconds 500
    }
    if ((Get-Service neo4j).Status -ne "Stopped") {
        Write-Fail "service did not stop within ${StopWaitSeconds}s (Status=$((Get-Service neo4j).Status))."
    }
}
Write-Host "  stopped."

# --- 3. load ------------------------------------------------------------------------------------
Write-Step "Loading $Database from the dump (--overwrite-destination)"
Write-Host "  THIS OVERWRITES the native service's '$Database' database. It is empty by design; the"
Write-Host "  container's copy is untouched and remains the rollback."
& $admin database load $Database --from-path="$DumpDir" --overwrite-destination=true
if ($LASTEXITCODE -ne 0) {
    Write-Fail "neo4j-admin database load failed (exit $LASTEXITCODE). The service is STOPPED and the container still holds the original graph - nothing is lost. Do not guess: report this output."
}
Write-Host "  load reported success."

# --- 4. start -----------------------------------------------------------------------------------
Write-Step "Starting the neo4j service"
Start-Service -Name "neo4j"
$sw = [Diagnostics.Stopwatch]::StartNew()
$up = $false
# Wait for the endpoint the VERIFIER will use, not merely for bolt.
#
# 2026-08-07, first real run: this waited only for bolt (7687), reported "up after 2.7s", and then
# graph-baseline.mjs — which speaks HTTP on 7474 — failed with `fetch failed`. Bolt was genuinely
# listening; HTTP simply had not opened yet. The migration had in fact succeeded, and the script
# declared FAILED. Waiting on a proxy for readiness instead of on the thing that is about to be used
# is the same mistake this arc keeps finding, and here it produced a false failure on a good load.
while ($sw.Elapsed.TotalSeconds -lt $StartWaitSeconds) {
    $boltUp = [bool](Get-NetTCPConnection -LocalPort $BoltPort -State Listen -ErrorAction SilentlyContinue)
    $httpUp = [bool](Get-NetTCPConnection -LocalPort $HttpPort -State Listen -ErrorAction SilentlyContinue)
    if ($boltUp -and $httpUp) { $up = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $up) { Write-Fail "service did not start listening on BOTH bolt $BoltPort and http $HttpPort within ${StartWaitSeconds}s. Check $env:NEO4J_HOME\logs\neo4j.log." }
Write-Host "  up, listening on bolt $BoltPort and http $HttpPort after $([math]::Round($sw.Elapsed.TotalSeconds,1))s."

# --- 5. THE VERIFICATION — a mechanical diff, not a look --------------------------------------
Write-Step "Comparing the loaded graph against the recorded baseline"
$after = Join-Path $env:TEMP "graph-baseline-after-load.txt"
Push-Location $RepoRoot
try   { & node $BaselineJs > $after 2>&1; $baselineExit = $LASTEXITCODE }
finally { Pop-Location }
if ($baselineExit -ne 0) {
    Write-Fail "graph-baseline.mjs failed against the native service (exit $baselineExit):`n$(Get-Content $after -Raw)"
}

$expected = (Get-Content $BaselineFile) -join "`n"
$actual   = (Get-Content $after)        -join "`n"
Write-Host "`n  loaded graph reports:"
Get-Content $after | ForEach-Object { Write-Host "    $_" }

if ($expected.Trim() -eq $actual.Trim()) {
    Write-Host "`n================ MIGRATION VERIFIED ================" -ForegroundColor Green
    Write-Host "Every node label and relationship type count is identical to the baseline taken"
    Write-Host "while the container still held the data. The native service now holds the graph."
    Write-Host "The container is still stopped-not-deleted; it stays that way until Task 12."
    Write-Host "===================================================="
    exit 0
} else {
    Write-Host "`n  DIFFERENCES (expected vs loaded):" -ForegroundColor Red
    Compare-Object -ReferenceObject (Get-Content $BaselineFile) -DifferenceObject (Get-Content $after) |
        ForEach-Object { Write-Host ("    {0} {1}" -f $_.SideIndicator, $_.InputObject) -ForegroundColor Red }
    Write-Fail "the loaded graph does NOT match the baseline. The container still holds the original - do not delete anything, and do not adjust the baseline to match. Report this output."
}
