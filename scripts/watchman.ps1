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

    $detectError = $null
    try {
        # Select-Object -Last 1: a Detect block that leaks stdout (e.g. an un-suppressed
        # subcommand) must not turn its leaked lines into part of the answer — only the last
        # pipeline value counts, and [bool] coerces it so a stray non-boolean type can never be
        # stored as-is in InitialOk.
        $initialOk = [bool](& $Detect | Select-Object -Last 1)
    } catch {
        $initialOk = $false
        $detectError = $_.Exception.Message
    }

    $recovered = $false
    $finalOk = $initialOk
    $detail = if ($initialOk) { 'already ok' } elseif ($detectError) { "detect threw: $detectError" } else { 'down at detect' }

    if (-not $initialOk) {
        $recoverError = $null
        try { & $Recover | Out-Null } catch { $recoverError = $_.Exception.Message }

        $verifyError = $null
        $deadline = (Get-Date).AddSeconds($MaxRecoverWaitSeconds)
        while ((Get-Date) -lt $deadline) {
            $verifyOk = $false
            try { $verifyOk = [bool](& $Verify | Select-Object -Last 1) } catch { $verifyError = $_.Exception.Message; $verifyOk = $false }
            if ($verifyOk) { $finalOk = $true; $recovered = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if ($recovered) {
            $detail = "recovered after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
        } else {
            $reasons = @()
            if ($detectError) { $reasons += "detect threw: $detectError" }
            if ($recoverError) { $reasons += "recover threw: $recoverError" }
            if ($verifyError) { $reasons += "verify threw: $verifyError" }
            $base = "recovery attempted, still down after ${MaxRecoverWaitSeconds}s"
            $detail = if ($reasons.Count) { "$base ($($reasons -join '; '))" } else { $base }
        }
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

$checkedCount = $results.Count
if ($checkedCount -eq 0) {
    # A component-free run must never read like a healthy one — this is the exact shape the
    # pre-flight audit caught elsewhere in this arc (a bare-assignment bug that silently checked
    # zero components and printed a reassuring OK). Distinct wording, and a non-zero exit: "ran
    # clean" and "ran nothing" must never look the same on a screen someone skims.
    Write-Output "`nWATCHMAN: 0 COMPONENTS CHECKED - THIS IS NOT A HEALTH CONFIRMATION. No infrastructure was verified in this run."
    exit 1
}

$blocked = $results | Where-Object { $_.Severity -eq 'block' -and -not $_.FinalOk }
if ($blocked) {
    Write-Output "`nWATCHMAN BLOCK: $($blocked.Name -join ', ') did not recover ($checkedCount component(s) checked)."
    exit 1
}
Write-Output "`nWATCHMAN OK - $checkedCount component(s) checked, all healthy or recovered (warn-severity failures, if any, are reported above but do not block)."
exit 0
