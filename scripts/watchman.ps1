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
    #
    # Fix round 4 (post-Task-18 review, deferred hardening 1a): the comment used to claim "a killed
    # node/py process here has no long-running children of its own to orphan." That was false --
    # check-rules-mirror.mjs (invoked by the rules-mirror component's Detect/Verify, above) itself
    # calls spawnSync('py'/'python3', ...) with NO timeout of its own. In exactly the scenario this
    # bound exists for -- a query that hangs AFTER a successful Postgres connect -- killing node.exe
    # on Windows left the py.exe grandchild running, still holding a live Postgres connection (see
    # R-100/R-107 in the roadmap register for what that then costs). Process.Kill() with no argument
    # only ever killed the immediate child; it never walked the tree.
    # Fixed with process-TREE termination via `taskkill /T /F /PID <pid>`, which works identically
    # under both Windows PowerShell 5.1 and pwsh 7 (it shells out to the same OS binary either way,
    # unlike Process.Kill(entireProcessTree), which is a .NET-Core-only overload and would silently
    # not exist under 5.1). taskkill is tried first; Process.Kill() on the parent is kept as a
    # best-effort fallback in case taskkill itself is unavailable or the parent already exited.
    # Compatible with both Windows PowerShell 5.1 and PowerShell 7 (this file runs under both):
    # ProcessStartInfo.ArgumentList and Process.WaitForExit(ms) are available on both.
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
    # 5.1 / .NET Framework 4.8 in this environment. Build a single argument string instead, which
    # both runtimes have supported unchanged since .NET Framework 2.0.
    # Fix round 4 (Task 19, RED found live): only quote a token when it actually needs it (contains
    # whitespace or a double quote). Blanket-quoting EVERY token -- including bare single-word flags
    # like `-e` -- broke `wsl.exe` specifically: wsl does its own raw-command-line sniffing for `-e`
    # (so it can forward the remainder byte-for-byte to Linux) rather than reading parsed argv, and
    # it only recognizes `-e` as its own flag when that token appears unquoted. Quoted, wsl silently
    # fell through to running the whole quoted line via the default shell instead, and bash then
    # tried to execute the literal token `-e` as a command ("/bin/bash: -e: command not found") --
    # a real, observed failure (see this task's report), not a hypothetical. Confirmed node/py calls
    # are unaffected: their arguments either contain no whitespace (flags, script paths without
    # spaces) or already need quoting and still get it under the new rule.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($ArgumentList | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
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
            $procId = $proc.Id
            # Reviewer minor (coordinator review, this task, not fixed -- comment only): if
            # taskkill.exe is unavailable, this silently degrades to $proc.Kill() below, which kills
            # only the immediate process, not its tree -- the exact orphan-grandchild gap fix round 4
            # (this file's earlier comment, ~line 84) already documented and fixed FOR the normal case
            # by switching to taskkill in the first place. taskkill.exe ships with Windows and is not
            # expected to be missing here; noted as a latent gap, not treated as reachable today.
            try { & taskkill.exe /T /F /PID $procId *> $null } catch { }
            try { if (-not $proc.HasExited) { $proc.Kill() } } catch { }
            throw "$FilePath $($ArgumentList -join ' ') timed out after ${TimeoutSeconds}s and was killed (process tree, PID $procId)"
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

    # mk_rules-postgres (warn): the native Windows PostgreSQL service that hosts the mk_rules
    # database (source of truth for rules-mirror above). Severity is warn, not block: its own failure
    # mode already has a block-severity guard one layer up (rules-mirror, which needs mk_rules to be
    # reachable to rebuild from) -- this component's job is to notice and recover the service itself,
    # not to be the thing that stops a commit. See this task's report for the "unreachable vs broken"
    # reasoning: an unreachable-but-otherwise-fine service and a genuinely broken one currently look
    # identical to this component (both burn MaxRecoverWaitSeconds and report "did not recover").
    #
    # pg_isready is NOT on PATH on this machine (measured: Get-Command pg_isready returns nothing) --
    # the binary lives only under C:\Program Files\PostgreSQL\<major>\bin. A bare call would throw
    # CommandNotFoundException, which would CRASH Invoke-ComponentCheck instead of degrading to "not
    # ok" -- resolved defensively below by searching the install tree, never assumed to be on PATH.
    function Get-RulesDbEnv {
        $envFile = Join-Path $RepoRoot 'infra\rules-db\.env'
        if (-not (Test-Path $envFile)) { return $null }
        $vars = @{}
        Get-Content $envFile | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
            $k, $v = $_ -split '=', 2
            $vars[$k] = $v
        }
        return $vars
    }

    function Resolve-PgIsReady {
        $cmd = Get-Command pg_isready -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
        $found = Get-ChildItem -Path 'C:\Program Files\PostgreSQL' -Filter 'pg_isready.exe' -Recurse `
                               -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
        return $null
    }

    function Test-RulesPgUp {
        # Fix round 4 (deferred hardening 1b, Task 18 implementer's own flag): pg_isready was the
        # only child-process invocation in this file not routed through Invoke-BoundedProcess.
        # pg_isready's own internal timeout is short, so the risk was low -- but "the one call we
        # left unbounded" is exactly how the next hang gets found the hard way. Bounded to 10s here
        # (generous vs. pg_isready's own sub-second internal timeout; this bound exists for the
        # pathological case where the process itself hangs before even reaching its own timeout
        # logic, e.g. a stuck DNS/name resolution on `-h`).
        param($env_, $exe)
        if (-not $exe) { return $false }
        try {
            $p = Invoke-BoundedProcess -FilePath $exe `
                -ArgumentList @('-h', '127.0.0.1', '-p', $env_.RULES_POSTGRES_PORT, '-d', $env_.RULES_POSTGRES_DB) `
                -TimeoutSeconds 10
            return ($p.ExitCode -eq 0)
        } catch { return $false }
    }

    $rulesDbEnv = Get-RulesDbEnv
    $PgIsReady = Resolve-PgIsReady

    $rulesPgResult = if ($rulesDbEnv -and $rulesDbEnv.RULES_SERVICE_NAME -and $PgIsReady) {
        Invoke-ComponentCheck -Name 'mk_rules-postgres' -Severity 'warn' `
            -Detect { Test-RulesPgUp $rulesDbEnv $PgIsReady } `
            -Recover {
                # Start-Service -ErrorAction SilentlyContinue: if the caller lacks privilege, or the
                # service is Disabled, or the data directory is corrupt, this call fails silently and
                # Verify (below) will correctly keep reporting NOT OK -- this component never
                # distinguishes WHY recovery failed, only THAT it did. See task report: an honest "did
                # not recover" is preferred over guessing at a cause this component cannot observe.
                Start-Service -Name $rulesDbEnv.RULES_SERVICE_NAME -ErrorAction SilentlyContinue
            } `
            -Verify { Test-RulesPgUp $rulesDbEnv $PgIsReady }
    } else {
        [pscustomobject]@{ Name = 'mk_rules-postgres'; Severity = 'warn'; InitialOk = $false; Recovered = $false; FinalOk = $false; ElapsedSeconds = 0; Detail = 'infra/rules-db/.env missing, RULES_SERVICE_NAME not set, or pg_isready.exe not found'; TimestampUtc = (Get-Date).ToUniversalTime().ToString('o') }
    }

    # geniza-postgres (warn): REVISED after a live coordinator review found the first version was
    # testing a superseded target. The geniza's PostgreSQL moved OFF the WSL Docker container onto
    # the native Windows service `postgresql-x64-18` on 2026-08-06 (CLAUDE.md; confirmed by reading
    # infra/.env, whose POSTGRES_PORT now points at 5432 -- the native service's port, the SAME port
    # Task 18's mk_rules-postgres already monitors). The original Detect/Verify here ran `docker exec
    # mk-postgres pg_isready`, which answers about a leftover, still-running-but-superseded container
    # -- not the live store. That component would have reported a false OK forever regardless of the
    # native service's real health, and its Recover ran `docker compose up -d`, which is not a
    # recovery action for the real store at all (worse: see the compose.yaml finding below).
    #
    # This version tests the REAL thing: a genuine read-only SELECT against the geniza's own
    # document_revisions table, executed through src.knowledge.config.connect_reader() -- the exact
    # accessor every retrieval tool in this repository depends on (scripts/check-geniza-reader.py).
    # That is deliberate: this component verifies what consumers actually read, not a TCP/exec probe
    # of a process that could be up while the schema, credentials, or content are wrong.
    # Every child process goes through Invoke-BoundedProcess (this file's contract); no inner
    # try/catch -- on timeout it throws, which flows through Invoke-BoolProbe's own catch into an
    # honest "... threw: ... timed out ..." Detail, matching rules-mirror's pattern above.
    #
    # RECOVERY: deliberately a NO-OP. This component and Task 18's mk_rules-postgres now watch the
    # SAME native Windows service (postgresql-x64-18) -- confirmed by both pointing at port 5432 in
    # their respective .env files. mk_rules-postgres already runs earlier in this array and already
    # calls Start-Service on that exact service if it is down; by the time THIS component's Detect
    # runs, that recovery attempt has already happened (or the service was never the problem). A
    # second Start-Service here would be pure duplication -- exactly the "two components both
    # restarting one service" case this task was asked to judge, and the answer is: only one of them
    # should act. If the read still fails after mk_rules-postgres's own recovery ran, the failure is
    # something Start-Service cannot fix anyway (bad credentials, missing schema/table, an empty
    # database) -- so Recover here does nothing and says so, rather than pretending a second identical
    # action might succeed where the first one already tried and failed.
    # -MaxRecoverWaitSeconds 5 (not 300): with no recovery action to wait out, polling the same
    # unchanging Verify for minutes buys nothing but a slow run -- same reasoning as `hooks` above,
    # which uses 5s for the same "Recover cannot fix this specific failure" shape.
    function Test-GenizaReaderAnswers {
        $p = Invoke-BoundedProcess -FilePath 'py' `
            -ArgumentList @('-3', (Join-Path $RepoRoot 'scripts\check-geniza-reader.py')) `
            -TimeoutSeconds 15
        $resultValue = $null
        foreach ($line in ($p.Output -split "`r?`n")) { if ($line -match '^RESULT=(\S+)') { $resultValue = $Matches[1] } }
        $p.ExitCode -eq 0 -and $resultValue -eq 'ok'
    }

    $genizaResult = Invoke-ComponentCheck -Name 'geniza-postgres' -Severity 'warn' -MaxRecoverWaitSeconds 5 `
        -Detect { Test-GenizaReaderAnswers } `
        -Recover {
            # Deliberately empty -- see the block comment above. mk_rules-postgres (earlier in this
            # array) owns Start-Service for the shared native service; duplicating it here is the
            # exact double-recovery this task was asked to judge, and the judgment is: don't.
        } `
        -Verify { Test-GenizaReaderAnswers }

    # Read EMBED_MODEL / OLLAMA_URL / EMBED_DIM straight out of src/knowledge/config.py rather than
    # hardcoding them here -- config.py is the one place that is allowed to know these values (this
    # task's brief: "read them from there, never hardcode"). A plain-text regex read (not a python
    # subprocess) keeps this component's own cost near zero; the file's constants are simple
    # `NAME = "value"` / `NAME = 123` assignments, not expressions, so a regex is a faithful read, not
    # a reimplementation of a Python parser.
    function Get-OllamaConfig {
        $cfgPath = Join-Path $RepoRoot 'src\knowledge\config.py'
        $text = Get-Content $cfgPath -Raw
        $model = if ($text -match '(?m)^EMBED_MODEL\s*=\s*"([^"]+)"') { $Matches[1] } else { $null }
        $url = if ($text -match '(?m)^OLLAMA_URL\s*=\s*"([^"]+)"') { $Matches[1] } else { $null }
        $dim = if ($text -match '(?m)^EMBED_DIM\s*=\s*(\d+)') { [int]$Matches[1] } else { $null }
        return @{ Model = $model; Url = $url; Dim = $dim }
    }
    $ollamaCfg = Get-OllamaConfig

    # ollama (warn): serves the local embedding model (EMBED_MODEL/OLLAMA_URL, read from
    # src/knowledge/config.py, never hardcoded here) that every geniza ingest/query depends on. Its
    # own failure mode has an equivalent alternative one layer up -- ingestion/retrieval simply cannot
    # run until it is back, but nothing else in this repo is blocked by it (no commit, no build, no
    # release gate reads it directly) -- hence warn, matching the spec's severity table, not block.
    #
    # WHY A REAL EMBED, NOT A PORT PROBE: this project has been bitten repeatedly by checks that test a
    # proxy for the property instead of the property itself (the hooks component above learned this the
    # hard way with prose-matching; rules-mirror with a checksum-shaped but wrong comparison). A TCP
    # connect or `/api/ps` only proves ollama's HTTP listener is up -- it says nothing about whether the
    # bge-m3 model is actually loaded and answering, which is the one thing every consumer of this
    # component (scripts/ingest.py, src/knowledge/retrieval.semantic_search) actually needs. So Detect
    # and Verify are the SAME real POST to /api/embeddings, and the check is not just "did it respond"
    # but "did it respond with a 1024-dim vector" -- the exact dimensionality the corpus was built with
    # (src/knowledge/config.py EMBED_MODEL='bge-m3'; the geniza's pgvector columns are dimensioned to
    # match). A response with the wrong model loaded, or a truncated/malformed vector, fails this check
    # even though the port was open the whole time.
    #
    # MEASURED COST (this task, this machine, ollama already warm with bge-m3 loaded): 254ms cold-ish
    # first call, 185ms on a second immediate call. That is cheap enough to run on every watchman
    # invocation as currently scoped (a developer running this by hand, not yet a schedule). If this
    # component is ever put on a tight schedule (e.g. every few seconds) the model-load state could
    # regress that cost significantly on a machine where bge-m3 has been evicted from memory -- worth
    # re-measuring cold if/when a schedule is added, but not a reason to downgrade to a port check now.
    #
    # RECOVERY DECISION: unlike geniza-postgres (deliberately a no-op because mk_rules-postgres already
    # owns Start-Service for the one shared native Postgres service both watch), nothing else in this
    # file recovers ollama -- there is no other component with an overlapping recovery action to
    # duplicate. ollama is not installed as a Windows service on this machine (confirmed: `Get-Service`
    # has no ollama entry); it runs as `ollama.exe` plus a tray helper `ollama app.exe`. So Recover here
    # does the only thing that can actually fix a down/wedged ollama: kill any `ollama*` processes
    # (a hung server that is up-but-not-answering needs to be replaced, not left running alongside a
    # new one) and relaunch `ollama serve`. This mirrors the brief's own worked recovery and was
    # exercised live in this task's RED witness (see this task's report): killing ollama and re-running
    # this script relaunched it and Verify passed within seconds.
    #
    # Fix round 1 (coordinator review, this task): the shape check above (right model, right
    # dimensionality) does not rule out a degenerate all-zero or near-zero vector -- 1024 zeros passes
    # the count check and would report `already ok` while every downstream semantic_search silently
    # returns garbage. Guard with a magnitude floor. Measured a real bge-m3 embedding on this machine
    # (this task, same prompt used below): L2 magnitude ~26.5. The floor is set at 1.0 -- roughly 26x
    # below the measured real value, comfortably clear of normal per-prompt variance, while still far
    # enough above zero to catch an all-zero or near-zero response outright. This is a floor, not a
    # tuned quality threshold: it exists to catch "the model returned nothing meaningful", not to
    # judge embedding quality.
    $script:OllamaMinMagnitude = 1.0

    # WHAT THIS COMPONENT CANNOT DETECT: a model that answers with a plausible-looking, non-degenerate
    # 1024-dim vector that is nonetheless semantically wrong (e.g. the wrong model swapped in under the
    # same name, or corrupted weights that still produce syntactically valid, non-zero output) -- this
    # checks shape and magnitude, not embedding content/quality. It also does not detect ollama serving
    # a DIFFERENT embedding model correctly while bge-m3 itself is missing/unpulled (that would surface
    # as the API call itself erroring, which IS caught -- Test-OllamaEmbeds returns $false on any
    # exception, including "model not found").
    function Test-OllamaEmbeds {
        if (-not ($ollamaCfg.Model -and $ollamaCfg.Url -and $ollamaCfg.Dim)) { return $false }
        try {
            $body = @{ model = $ollamaCfg.Model; prompt = 'watchman health probe' } | ConvertTo-Json -Compress
            $r = Invoke-RestMethod -Uri "$($ollamaCfg.Url)/api/embeddings" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 15
            if (-not ($r.embedding -and $r.embedding.Count -eq $ollamaCfg.Dim)) { return $false }
            $sumSquares = 0.0
            foreach ($v in $r.embedding) { $sumSquares += [double]$v * [double]$v }
            $magnitude = [math]::Sqrt($sumSquares)
            return [bool]($magnitude -ge $script:OllamaMinMagnitude)
        } catch { return $false }
    }

    # RECOVER RISK JUDGEMENT (coordinator review, this task; deliberately NOT changed, per instruction
    # -- written down instead): this Recover force-kills every `ollama*` process with no coordination
    # check first. That can interrupt a model call another process has in flight -- an in-progress
    # ingest embed batch (scripts/ingest.py) or a live retrieval.semantic_search call from a concurrent
    # session. Judged acceptable TODAY for two reasons, both narrow: (1) the watchman is manual-only
    # right now (no schedule wired -- Phase 6 is where scheduling lands), so an operator runs it
    # deliberately and can see what else is running; (2) the geniza's extraction/ingest writes are
    # documented idempotent (R-102/R-107) -- a killed-and-restarted embed batch can be safely re-run
    # from where it left off, it does not corrupt or duplicate state. NEITHER reason survives a
    # schedule: an unattended timer has no operator to notice a collision, and "idempotent on retry"
    # is not the same as "safe to interrupt with no signal to the caller who was mid-request" -- a
    # caller blocked on the killed HTTP call gets a bare connection failure, not a clean retry signal.
    # BEFORE this runs on a timer (Phase 6), this Recover needs either: a check for ollama activity
    # (e.g. `/api/ps` reporting a model with recent request activity) before killing, or a
    # coordination lock shared with scripts/ingest.py so a scheduled watchman run defers instead of
    # killing mid-batch. Not built here -- flagged for whoever wires Phase 6 scheduling to read this
    # comment before reusing this Recover unattended.
    $ollamaResult = Invoke-ComponentCheck -Name 'ollama' -Severity 'warn' -MaxRecoverWaitSeconds 60 `
        -Detect { Test-OllamaEmbeds } `
        -Recover {
            Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            try { Invoke-RestMethod -Uri "$($ollamaCfg.Url)/api/ps" -TimeoutSec 5 | Out-Null }
            catch { Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden }
        } `
        -Verify { Test-OllamaEmbeds }

    # serena (warn): the ONE shared Serena MCP server (§10.17a) that symbol-shaped code-editing
    # subagents are pointed at. Its own failure mode has an equivalent alternative (grep/manual read,
    # slower but correct), hence warn not block, matching the spec's severity table.
    #
    # Detect/Verify both delegate to serena-server.ps1's own `-Action status`, which already does the
    # real work this component needs (§10.17a): counts processes matching the shared-server command
    # line (start-mcp-server + streamable-http + --port), counts listeners on the port, AND performs a
    # real MCP `initialize` handshake over HTTP -- not just "a socket is open". `Show-Status` sets
    # $script:StatusOk from all three and the switch's `status` branch exits 1 when not ok (0
    # otherwise, since PowerShell exits a script with the last-set exit code, or 0 if none was ever
    # set) -- so this component reads that exit code rather than re-deriving the check inline, keeping
    # exactly one place that knows what "serena is healthy" means.
    #
    # Routed through Invoke-BoundedProcess (this file's own contract, restated in its .NOTES header):
    # a hung serena-server.ps1 invocation must not hang this entire watchman run. -Action status calls
    # out to Invoke-WebRequest with its own 20s bound, so 30s here is generous headroom, not the
    # primary defense. -Action restart internally stops (bounded, a few seconds) then starts, and
    # start itself polls for up to 90s (serena-server.ps1's own -TimeoutSec default) for the port to
    # come up -- possibly the first boot of a language server. Bounded at 110s here (90 + headroom for
    # the stop half and process spin-up), matching -MaxRecoverWaitSeconds 90 below so the engine's own
    # post-recover Verify-polling window is not shorter than the action it is waiting on.
    #
    # `pwsh`, NOT `powershell`, invokes serena-server.ps1: found live, not assumed. serena-server.ps1
    # is UTF-8-without-BOM and its strings contain literal em-dash characters (e.g. "no parent shell,
    # survives this session"). Windows PowerShell 5.1 has no BOM to tell it the file is UTF-8, so it
    # reads it under the system code page instead -- the multi-byte em-dash then splits into bytes
    # that are not valid inside a double-quoted string, and 5.1 fails with "Array index expression is
    # missing or not valid." / "Missing closing '}'" (the multi-byte sequence corrupts the parser's
    # view of the quotes downstream of it), before Show-Status ever runs. Confirmed both ways in this
    # task: `powershell -File scripts\serena-server.ps1 -Action status` throws that parse error;
    # `pwsh -File scripts\serena-server.ps1 -Action status` (pwsh defaults to UTF-8) runs clean and
    # returns the real exit code. This is a pre-existing encoding bug in serena-server.ps1 itself
    # (out of scope for this task, not touched here — Chesterton's Fence plus §12 Circle of Control);
    # what IS in scope is that THIS component must not silently inherit it, so the child is invoked
    # with the interpreter that actually parses that file correctly.
    #
    # WHAT THIS COMPONENT CANNOT DETECT: "up, and exactly one instance of it" only insofar as
    # serena-server.ps1's own process-count line reports it -- if a rogue STDIO Serena instance were
    # somehow also running (the exact failure §10.17a exists to prevent), this component's Detect
    # would still report OK on the shared server alone; it does not independently enumerate ALL serena
    # processes on the machine, only the ones matching the shared-server command-line fence
    # (Get-SharedServerProcesses's own three-way match). It also cannot detect a shared server that is
    # up and answering MCP but pointed at the WRONG project path (ProjectPath is not compared here).
    function Test-SerenaUp {
        $p = Invoke-BoundedProcess -FilePath 'pwsh' `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $RepoRoot 'scripts\serena-server.ps1'), '-Action', 'status') `
            -TimeoutSeconds 30
        $p.ExitCode -eq 0
    }

    $serenaResult = Invoke-ComponentCheck -Name 'serena' -Severity 'warn' -MaxRecoverWaitSeconds 90 `
        -Detect { Test-SerenaUp } `
        -Recover {
            Invoke-BoundedProcess -FilePath 'pwsh' `
                -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $RepoRoot 'scripts\serena-server.ps1'), '-Action', 'restart') `
                -TimeoutSeconds 110 | Out-Null
        } `
        -Verify { Test-SerenaUp }

    @($hooksResult, $rulesMirrorResult, $rulesPgResult, $genizaResult, $ollamaResult, $serenaResult)
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
