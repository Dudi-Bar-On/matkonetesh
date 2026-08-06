# scripts/watchman.ps1 (this task's slice — Tasks 16-21 append the six real components below the
# marker `# === REAL COMPONENTS ===`)
<#
.SYNOPSIS
  Layer 0 — the watchman (spec §8). Detects and automatically recovers infrastructure components,
  with VERIFIED (not assumed) success reporting: "the command ran" is not "it recovered" (§8.2).

.DESCRIPTION
  Runs each registered component through Invoke-ComponentCheck: Detect -> (if down) Recover ->
  Verify. Severity (warn/block) follows the spec's severity test (§2, §8.1): a component whose
  failure only costs efficiency (grep instead of Serena) is a warning; a component whose failure
  removes a capability with no equivalent alternative (rules.sqlite, the pre-commit hooks) blocks.

  -SelfTest mode registers three FAKE components with no real side effects, so the recovery ENGINE
  itself can be proven correct without touching Postgres, ollama, or serena — see
  scripts/tests/test-watchman-engine.mjs. Every real component (Tasks 16-21) is layered on the same
  engine, so a bug in the engine is caught once, not six times.

.PARAMETER SelfTest
  Run the three fake components instead of the real ones. Exit code and JSON-lines output are
  otherwise identical in shape to a real run.
#>
[CmdletBinding()]
param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $RepoRoot '.superpowers\watchman-log.jsonl'

function Invoke-ComponentCheck {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [ValidateSet('warn', 'block')] [string]$Severity,
        [Parameter(Mandatory)] [scriptblock]$Detect,
        [Parameter(Mandatory)] [scriptblock]$Recover,
        [Parameter(Mandatory)] [scriptblock]$Verify,
        [int]$MaxRecoverWaitSeconds = 60
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $initialOk = & $Detect
    $recovered = $false
    $finalOk = $initialOk
    $detail = if ($initialOk) { 'already ok' } else { 'down at detect' }

    if (-not $initialOk) {
        & $Recover
        $deadline = (Get-Date).AddSeconds($MaxRecoverWaitSeconds)
        while ((Get-Date) -lt $deadline) {
            if (& $Verify) { $finalOk = $true; $recovered = $true; break }
            Start-Sleep -Milliseconds 500
        }
        $detail = if ($recovered) { "recovered after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" } else { "recovery attempted, still down after ${MaxRecoverWaitSeconds}s" }
    }
    $sw.Stop()

    $result = [pscustomobject]@{
        Name           = $Name
        Severity       = $Severity
        InitialOk      = $initialOk
        Recovered      = $recovered
        FinalOk        = $finalOk
        ElapsedSeconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        Detail         = $detail
        TimestampUtc   = (Get-Date).ToUniversalTime().ToString('o')
    }
    return $result
}

function Write-WatchmanLog($results) {
    $dir = Split-Path -Parent $LogFile
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    foreach ($r in $results) {
        ($r | ConvertTo-Json -Compress) | Add-Content -Path $LogFile
    }
}

function Get-SelfTestResults {
    $script:downThenRecoversFixed = $false

    $r1 = Invoke-ComponentCheck -Name 'always-ok' -Severity 'warn' `
        -Detect { $true } -Recover { } -Verify { $true }

    $r2 = Invoke-ComponentCheck -Name 'down-then-recovers' -Severity 'warn' `
        -Detect { $false } `
        -Recover { $script:downThenRecoversFixed = $true } `
        -Verify { $script:downThenRecoversFixed }

    $r3 = Invoke-ComponentCheck -Name 'down-forever' -Severity 'block' -MaxRecoverWaitSeconds 1 `
        -Detect { $false } -Recover { } -Verify { $false }

    return @($r1, $r2, $r3)
}

$results = if ($SelfTest) { Get-SelfTestResults } else {
    # === REAL COMPONENTS === (Tasks 16-21 append @() entries here, in severity-appropriate order)
    @()
}

foreach ($r in $results) {
    if ($r.Recovered) {
        Write-Output "recovered: $($r.Name) after $($r.ElapsedSeconds)s"
    } elseif (-not $r.FinalOk) {
        Write-Output "$($r.Severity) : $($r.Name) did not recover - $($r.Detail)"
    }
    ($r | ConvertTo-Json -Compress) | Write-Output
}
Write-WatchmanLog $results

$blocked = $results | Where-Object { $_.Severity -eq 'block' -and -not $_.FinalOk }
if ($blocked) {
    Write-Output "`nWATCHMAN BLOCK: $($blocked.Name -join ', ') did not recover."
    exit 1
}
Write-Output "`nWATCHMAN OK (warn-severity failures, if any, are reported above but do not block)."
exit 0
