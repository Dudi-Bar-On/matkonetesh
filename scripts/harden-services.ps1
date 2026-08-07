<#
.SYNOPSIS
    Make the two databases restart themselves after a crash. Run ONCE, elevated.

.DESCRIPTION
    Measured 2026-08-07, and this is the gap it closes:

        sc qfailure postgresql-x64-18  ->  RESET_PERIOD 0, no failure actions
        sc qfailure neo4j             ->  RESET_PERIOD 0, no failure actions

    Neither service has ANY recovery action configured. If either crashes it simply stays down until a
    human notices - and this project already paid for exactly that shape: on 2026-08-06 the machine
    rebooted itself at 02:27, took Docker with it, WSL did not bring Docker back, and seventeen hours
    of extraction were lost. Moving to Windows services fixed the reboot case, because a service with
    Automatic start comes up at boot. It did NOT fix the crash case, because a crashed service with no
    failure actions stays crashed.

    The owner's framing: he wants the tools we depend on to be close enough to unfailing that they can
    be treated as an iron anchor. On a single machine, 99.999% availability is not purchasable - power,
    disk, OS and reboot are all single points of failure. What IS purchasable is this: nothing stays
    down without a fight, and nothing is lost. This script buys the first half. The backup script buys
    the second.

    WHAT IT SETS, for postgresql-x64-18 and neo4j:
      first failure   -> restart after 60s
      second failure  -> restart after 60s
      third and later -> restart after 120s
      failure counter -> resets after 24h of health

    The delays are deliberate. An immediate restart loop on a service that fails at startup (a corrupt
    config, a full disk) burns CPU and buries the real error in a wall of identical event-log entries.
    Sixty seconds is long enough that a genuine problem stays visible and short enough that a transient
    one heals before anybody notices.

    The watchman (scripts/watchman.ps1) already restarts these services when it runs - at session
    start and every 30 minutes. This is the layer beneath it: Windows itself reacts in a minute rather
    than in up to half an hour, and it keeps working when no session is open at all.

    IDEMPOTENT. Setting the same recovery actions twice changes nothing. Safe to re-run.
#>

[CmdletBinding()]
param(
    [string[]]$ServiceNames = @('postgresql-x64-18', 'neo4j')
)

$ErrorActionPreference = 'Stop'
function Write-Step   { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Refuse { param($m) Write-Host "`nREFUSING: $m" -ForegroundColor Yellow; exit 1 }

Write-Step 'Preflight'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Refuse 'this script must be run from an ELEVATED PowerShell prompt (sc.exe failure needs it - it returns "OpenService FAILED 5" otherwise).'
}
foreach ($s in $ServiceNames) {
    if (-not (Get-Service -Name $s -ErrorAction SilentlyContinue)) { Write-Refuse "service '$s' not found." }
}
Write-Host '  both services present, prompt is elevated.'

Write-Step 'Before'
foreach ($s in $ServiceNames) {
    Write-Host "  --- $s ---"
    (sc.exe qfailure $s) | Where-Object { $_ -match 'RESET_PERIOD|RESTART|FAILURE_ACTIONS|COMMAND_LINE' } |
        ForEach-Object { Write-Host "    $($_.Trim())" }
}

Write-Step 'Setting recovery actions'
foreach ($s in $ServiceNames) {
    # reset= 86400 : forget the failure count after a day of health, so an old blip does not push a
    #                fresh failure straight to the slowest tier.
    & sc.exe failure $s reset= 86400 actions= restart/60000/restart/60000/restart/120000 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Refuse "sc.exe failure failed for '$s' (exit $LASTEXITCODE)." }
    # Windows only applies failure actions to a crash by default. A service that exits with a non-zero
    # code - which is how a database usually dies - is NOT a crash unless this flag is set.
    & sc.exe failureflag $s 1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Refuse "sc.exe failureflag failed for '$s' (exit $LASTEXITCODE)." }
    Write-Host "  $s : restart 60s / 60s / 120s, counter resets after 24h, applies to non-crash exits too."
}

Write-Step 'After - read back from the service control manager, not assumed'
$bad = @()
foreach ($s in $ServiceNames) {
    Write-Host "  --- $s ---"
    $out = (sc.exe qfailure $s) -join "`n"
    ($out -split "`n") | Where-Object { $_ -match 'RESET_PERIOD|RESTART' } |
        ForEach-Object { Write-Host "    $($_.Trim())" }
    if ($out -notmatch 'RESTART') { $bad += $s }
}
if ($bad.Count) {
    Write-Host "`nFAILED: no RESTART action is present for: $($bad -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "`n================ SERVICES HARDENED ================" -ForegroundColor Green
Write-Host 'Both databases now restart themselves after a failure, within a minute, without a session open.'
Write-Host 'This is the availability half. Run scripts\backup-stores.ps1 for the durability half.'
Write-Host 'Verify any time, unprivileged:  sc.exe qfailure postgresql-x64-18'
Write-Host '==================================================='
