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

function Invoke-BoundedProcess {
    # Fix round 1 (Task 17 review): every Detect/Verify/Recover that shells out to a child process
    # (node, py) must be bounded -- an unbounded child that hangs (a stuck query after a successful
    # Postgres connect, e.g.) would hang the whole watchman run and NEVER return a boolean, which is
    # worse than a wrong answer because a wrong answer at least reports. The Postgres *connect* is
    # already bounded elsewhere (5s in the gate, 10s in the builder) -- this is the layer above that,
    # bounding the process as a whole regardless of where inside it a hang happens.
    # Compatible with both Windows PowerShell 5.1 and PowerShell 7 (this file runs under both):
    # ProcessStartInfo.ArgumentList and Process.WaitForExit(ms) are available on both; Process.Kill()
    # (no entireProcessTree overload, which is Core-only) is used so behaviour doesn't diverge --
    # a killed `node`/`py` process here has no long-running children of its own to orphan.
    # On timeout this THROWS rather than returning a sentinel, so it flows through the existing
    # Invoke-BoolProbe try/catch into Detail as "<RoleName> threw: ... timed out ...", not a silent
    # true and not a hang.
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(Mandatory)] [string[]]$ArgumentList,
        [int]$TimeoutSeconds = 30
    )
    # .ArgumentList (the collection property) is unreliable across the two PowerShell/.NET runtimes
    # this file must support -- observed $null on a fresh ProcessStartInfo under Windows PowerShell
    # 5.1 / .NET Framework 4.8 in this environment. Build a single quoted argument string instead,
    # which both runtimes have supported unchanged since .NET Framework 2.0.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($ArgumentList | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
    $psi.WorkingDirectory = $RepoRoot
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $proc = [System.Diagnostics.Process]::Start($psi)
    try {
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()
        $exited = $proc.WaitForExit($TimeoutSeconds * 1000)
        if (-not $exited) {
            try { $proc.Kill() } catch { }
            throw "$FilePath $($ArgumentList -join ' ') timed out after ${TimeoutSeconds}s and was killed"
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        return @{ ExitCode = $proc.ExitCode; Output = "$stdout`n$stderr" }
    } finally {
        $proc.Dispose()
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
            # Recovered/FinalOk are honest -- Verify really did say OK. But a Recover that threw and
            # merely happened not to prevent recovery this time is still a real bug in the recovery
            # path, and it must not vanish from the record just because this run got lucky: fold it
            # into Detail on the happy path too, or nobody ever learns Recover itself is broken.
            $detail = "recovered after $([math]::Round($sw.Elapsed.TotalSeconds, 1))s"
            if ($recoverError) { $detail = "$detail ($recoverError)" }
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

    # Fix round 3: a Recover that throws but doesn't stop Verify from succeeding must still leave a
    # trace — Recovered/FinalOk stay honest (Verify really did say OK), but Detail must carry the
    # Recover error on this happy path too, or a broken recovery script reports as an unremarkable
    # clean success and nobody learns it's broken until the day recovery is all that's left.
    $r5 = Invoke-ComponentCheck -Name 'recover-throws-but-verifies-ok' -Severity 'warn' `
        -Detect { $false } -Recover { throw 'boom in recover' } -Verify { $true }

    return @($r1, $r2, $r3, $r4, $r5)
}

$results = @(if ($SelfTest) { Get-SelfTestResults } else {
    # === REAL COMPONENTS === (Tasks 16-21 append @() entries here, in severity-appropriate order)
    # Fix round 2: bounded to 5s (not the 60s default). Recover here is a single `git config` write
    # -- it either lands in well under a second or it never will, and if content is the reason
    # Verify keeps failing (Recover cannot rewrite a gutted hook file), waiting the full 60s buys
    # nothing but a slow test/run on a fresh checkout with hooks unwired. 5s still gives ~10 poll
    # cycles at the engine's 500ms interval, which is generous for a config write.
    $hooksResult = Invoke-ComponentCheck -Name 'hooks' -Severity 'block' -MaxRecoverWaitSeconds 5 `
        -Detect {
            # Not just "is core.hooksPath wired and the files present" (a proxy the pre-commit file
            # could satisfy while gutted) -- also that pre-commit still contains a live (non-comment)
            # call to the meta gate. Keep this specific and simple: it proves the call line is still
            # there, not that the gate runs correctly or produces the right verdict.
            # Fix round 2: matched anywhere on the line, NOT anchored to line-start -- a line-start
            # anchor false-alarmed on a benign reformat (`cd "$ROOT" && node scripts/check-meta.mjs`)
            # for a block-severity component, a false DOWN is worse than a false OK: it is how a
            # legitimate refactor trips a spurious BLOCK, someone calls the check noisy, and removes
            # it. The comment-exclusion still does real work: a line that is ONLY a comment restating
            # the call does not count as live. Also excludes lines starting with `echo` -- found
            # empirically: THIS FILE has `echo "[pre-commit] running node scripts/check-meta.mjs
            # ..."` right above the real call, and an unqualified anywhere-on-line match would treat
            # that message text as a live invocation even when the real call below it is commented
            # out. Known remaining gap: text mentioning the call inside some other non-echo string
            # (e.g. a heredoc, a different message-printing command) would still false-positive; this
            # stays a targeted, disclosed heuristic, not a shell parser.
            $preCommitPath = Join-Path $RepoRoot '.githooks\pre-commit'
            $current = (git -C $RepoRoot config --get core.hooksPath 2>$null)
            $current -eq '.githooks' -and
                (Test-Path $preCommitPath) -and
                (Test-Path (Join-Path $RepoRoot '.githooks\commit-msg')) -and
                (@(Get-Content $preCommitPath | Where-Object {
                    $t = $_.TrimStart()
                    -not $t.StartsWith('#') -and -not $t.StartsWith('echo') -and
                        $_ -match 'node\s+scripts/check-meta\.mjs\b'
                }).Count -gt 0)
        } `
        -Recover { git -C $RepoRoot config core.hooksPath .githooks } `
        -Verify {
            # Recover only fixes core.hooksPath (git config) -- it cannot rewrite a gutted hook
            # file's content, and it must not claim to. Mirror Detect's full check here: if the
            # meta-gate call line is still missing after Recover ran, Verify must keep saying NOT
            # OK so the component honestly reports "recovery attempted, still down" and BLOCKs,
            # rather than a false "recovered" that only checked the one thing Recover *could* fix.
            $preCommitPath = Join-Path $RepoRoot '.githooks\pre-commit'
            (git -C $RepoRoot config --get core.hooksPath 2>$null) -eq '.githooks' -and
                (Test-Path $preCommitPath) -and
                (Test-Path (Join-Path $RepoRoot '.githooks\commit-msg')) -and
                (@(Get-Content $preCommitPath | Where-Object {
                    $t = $_.TrimStart()
                    -not $t.StartsWith('#') -and -not $t.StartsWith('echo') -and
                        $_ -match 'node\s+scripts/check-meta\.mjs\b'
                }).Count -gt 0)
        }

    # rules-mirror (block): rules.sqlite is what the enforcement hooks read at commit time. A
    # drifted/missing/corrupt mirror means the project is enforcing something other than what
    # mk_rules (the source of truth) actually says -- no equivalent alternative exists, hence block.
    # Detect/Verify both delegate to check-rules-mirror.mjs (Task 13), which owns the ONE checksum
    # comparison (mirror.checksum_of_rows, shared by both sides) -- this component does not
    # reimplement that comparison, only interprets its result as the boolean this engine requires.
    # check-rules-mirror.mjs is itself self-healing (it rebuilds-and-rechecks inline on a
    # mismatch/missing/corrupt file), so a first Detect call against a broken mirror may already fix
    # it -- but Detect requires the machine-readable RESULT=already-ok line specifically (see below),
    # so a run that needed repair still correctly reports NOT OK, and the explicit -Recover below
    # runs too. This is intentional, not a bug: it means there is exactly one recovery ACTION
    # (--rebuild-mirror-only) shared by the gate and the watchman, so the two can never disagree about
    # how a broken mirror gets fixed -- see this task's report for the "should Recover rewrite the
    # tracked file" decision.
    #
    # Fix round 1 (Task 17 review): the original Detect/Verify matched on the gate's human-facing
    # prose ('OK - rules.sqlite matches' / 'OK'). That coupling breaks the WRONG way if the healthy
    # message is ever reworded: Detect's exact-string match fails while Verify's loose 'OK' match
    # still passes, so a perfectly healthy mirror reports "recovered" on every single watchman run --
    # meaning --rebuild-mirror-only actually fires and rewrites the tracked, non-byte-deterministic
    # rules.sqlite on every invocation, silently churning the working tree. check-rules-mirror.mjs
    # now prints one machine-readable `RESULT=<already-ok|repaired|skipped|fail>` line (additive --
    # its exit codes and existing human-readable output are unchanged, confirmed by running it in the
    # healthy case and a broken case before this change and after). Detect and Verify match on THAT
    # line, never on prose, so the human-facing message stays free to change. Verify is intentionally
    # a superset of Detect (also accepts 'repaired'), never a subset -- Task 16 shipped a Verify
    # weaker than its Detect once already and it produced a false Recovered:true.
    #
    # Also fix round 1: both calls go through Invoke-BoundedProcess (30s) instead of a bare `node`
    # invocation with no timeout -- an unbounded child process that hangs (e.g. a stuck query after a
    # successful Postgres connect; the CONNECT itself is bounded elsewhere but query execution and the
    # child process as a whole were not) would hang this entire watchman run and never return a
    # boolean. A timeout now throws, which Invoke-BoolProbe turns into an honest "Detect/Verify threw:
    # ... timed out ..." NOT-OK result, never a hang and never a silent true.
    $rulesMirrorResult = Invoke-ComponentCheck -Name 'rules-mirror' -Severity 'block' `
        -Detect {
            $p = Invoke-BoundedProcess -FilePath 'node' -ArgumentList @((Join-Path $RepoRoot 'scripts\check-rules-mirror.mjs')) -TimeoutSeconds 30
            $resultValue = $null
            foreach ($line in ($p.Output -split "`r?`n")) { if ($line -match '^RESULT=(\S+)') { $resultValue = $Matches[1] } }
            $p.ExitCode -eq 0 -and $resultValue -eq 'already-ok'
        } `
        -Recover {
            Invoke-BoundedProcess -FilePath 'py' -ArgumentList @('-3', (Join-Path $RepoRoot 'scripts\build_rules_store.py'), '--rebuild-mirror-only') -TimeoutSeconds 60 | Out-Null
        } `
        -Verify {
            $p = Invoke-BoundedProcess -FilePath 'node' -ArgumentList @((Join-Path $RepoRoot 'scripts\check-rules-mirror.mjs')) -TimeoutSeconds 30
            $resultValue = $null
            foreach ($line in ($p.Output -split "`r?`n")) { if ($line -match '^RESULT=(\S+)') { $resultValue = $Matches[1] } }
            $p.ExitCode -eq 0 -and ($resultValue -eq 'already-ok' -or $resultValue -eq 'repaired')
        }

    @($hooksResult, $rulesMirrorResult)
})

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
