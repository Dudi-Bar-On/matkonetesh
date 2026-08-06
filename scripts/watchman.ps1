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

.NOTES
  CONTRACT for every component's -Detect and -Verify scriptblocks (enforced by Invoke-BoolProbe,
  below — read this before Tasks 16-21 add a real component):
    - The scriptblock's LAST pipeline value is what counts. Any earlier `Write-Output`/uncaptured
      stdout from a subcommand is discarded (`Select-Object -Last 1`) — a leaked line can never
      pollute the answer.
    - That last value MUST be an actual [bool] ($true/$false). If it is anything else — a string
      (including the literal text "false", which PowerShell treats as truthy and which this engine
      will NOT special-case or reinterpret), $null, a number, an object — the component is treated
      as NOT OK, full stop. It is never coerced, guessed at, or given the benefit of the doubt.
      `Detail` names the offending type and value and which scriptblock produced it, e.g.
      `Detect returned [String] 'false', expected a boolean`.
    - A thrown exception is likewise NOT OK, with `Detail` naming which scriptblock threw and why.
  Rationale: a component whose Detect/Verify returns a non-boolean is an authoring bug, and
  reporting that as "up" would be the exact silent-green failure this engine exists to prevent —
  worse than a visibly wrong array, because nothing about it looks wrong. An unparseable answer is
  a failure, never a pass.
#>
[CmdletBinding()]
param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$LogFile = Join-Path $RepoRoot '.superpowers\watchman-log.jsonl'

function Invoke-BoolProbe {
    # Runs a Detect/Verify scriptblock and enforces the boolean-return contract documented in the
    # .NOTES header above. Returns @{ Ok = [bool]; Error = $null-or-[string] }. Ok is $false for
    # anything that is not a genuine [bool] last-pipeline-value, or that throws — never coerced.
    param(
        [Parameter(Mandatory)] [scriptblock]$Block,
        [Parameter(Mandatory)] [string]$RoleName
    )
    try {
        $raw = & $Block | Select-Object -Last 1
        if ($raw -is [bool]) {
            return @{ Ok = $raw; Error = $null }
        }
        $typeName = if ($null -eq $raw) { 'Null' } else { $raw.GetType().Name }
        $valueText = if ($null -eq $raw) { '$null' } else { "'$raw'" }
        return @{ Ok = $false; Error = "$RoleName returned [$typeName] $valueText, expected a boolean" }
    } catch {
        return @{ Ok = $false; Error = "$RoleName threw: $($_.Exception.Message)" }
    }
}

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

    $detectProbe = Invoke-BoolProbe -Block $Detect -RoleName 'Detect'
    $initialOk = $detectProbe.Ok
    $detectError = $detectProbe.Error

    $recovered = $false
    $finalOk = $initialOk
    $detail = if ($initialOk) { 'already ok' } elseif ($detectError) { $detectError } else { 'down at detect' }

    if (-not $initialOk) {
        $recoverError = $null
        try { & $Recover | Out-Null } catch { $recoverError = "Recover threw: $($_.Exception.Message)" }

        $verifyError = $null
        $deadline = (Get-Date).AddSeconds($MaxRecoverWaitSeconds)
        while ((Get-Date) -lt $deadline) {
            $verifyProbe = Invoke-BoolProbe -Block $Verify -RoleName 'Verify'
            if ($verifyProbe.Error) { $verifyError = $verifyProbe.Error }
            if ($verifyProbe.Ok) { $finalOk = $true; $recovered = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if ($recovered) {
            $detail = "recovered after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
        } else {
            $reasons = @()
            if ($detectError) { $reasons += $detectError }
            if ($recoverError) { $reasons += $recoverError }
            if ($verifyError) { $reasons += $verifyError }
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

    # Proves the boolean-return contract (.NOTES above) is enforced, not coerced: a Detect that
    # returns the string "false" — truthy under a naive [bool] cast — must be rejected as NOT OK,
    # and a Verify that also returns a non-boolean during recovery must keep failing it too.
    $r4 = Invoke-ComponentCheck -Name 'bad-return-type' -Severity 'warn' -MaxRecoverWaitSeconds 1 `
        -Detect { "false" } -Recover { } -Verify { "still not a bool" }

    return @($r1, $r2, $r3, $r4)
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
