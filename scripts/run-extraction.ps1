# run-extraction.ps1 — start the geniza's relationship extraction so it SURVIVES.
#
# WHY THIS EXISTS, in one night's evidence. The extraction was launched twice as a child of an
# interactive session and died twice:
#   * ~01:41 — the client exited with an empty stderr and no traceback, one document in.
#   * 02:27  — winlogon initiated a machine restart (System event 1074) and took everything with it.
# A 17-hour job cannot depend on a session, and it cannot depend on someone being awake to notice.
#
# It also cannot depend on its dependencies being up: after a reboot the Docker daemon inside WSL is
# NOT running (it has no init that starts it), so PostgreSQL is absent and the extractor would fail
# instantly on connect. `sudo service docker start` prompts for a password and hangs forever with no
# stdin — which is exactly how the first attempt to recover wedged. `wsl -u root` needs no password.
#
# So this script brings up what it needs, waits for it to actually answer, and only then runs.
# Scheduled via Task Scheduler with an at-startup trigger, it recovers from a reboot on its own.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-extraction.ps1

# NOT 'Stop'. `wsl.exe` writes "your 131072x1 screen size is bogus" to stderr on EVERY invocation,
# and under ErrorActionPreference='Stop' a native command's stderr becomes a terminating error — so
# the script died one line in, having "started docker" and nothing else, with exit code 1. Errors
# here are handled by checking results (does postgres answer?), which is the honest test anyway.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$log = Join-Path $repo 'extraction-run.out'
function Say($m) { $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m; Add-Content -Path $log -Value $line }

Say "=== run-extraction.ps1 starting ==="

# 1 · the Docker daemon. `wsl -u root` avoids the sudo password prompt that hangs a headless run.
wsl -u root -e bash -lc "service docker start" *> $null
Say "docker daemon: start requested"

# 2 · the containers. `up -d` is idempotent — already-running containers are left alone.
wsl -e bash -lc "cd /mnt/c/Users/dudib/source/repos/matconetesh/infra && docker compose up -d" *> $null
Say "compose up -d issued"

# 3 · WAIT for PostgreSQL to actually answer. A container reported 'Running' is not a database
#     accepting connections, and starting the extractor a second too early costs the whole run.
$ready = $false
foreach ($i in 1..60) {
  $r = wsl -e bash -lc "docker exec mk-postgres pg_isready -h 127.0.0.1 -q && echo READY" 2>$null
  if ($r -match 'READY') { $ready = $true; Say "postgres answered after $($i*5)s"; break }
  Start-Sleep -Seconds 5
}
if (-not $ready) { Say "FAIL: postgres never answered in 300s — not starting the extractor"; exit 1 }

# 4 · ollama. The desktop app starts it at login; if this runs at boot before that, start it here.
try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 8 | Out-Null; Say "ollama already answering" }
catch {
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
  foreach ($i in 1..24) {
    try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 5 | Out-Null; Say "ollama answered after $($i*5)s"; break }
    catch { Start-Sleep -Seconds 5 }
  }
}

# 5 · the run itself. `--pending` is the resume: extraction state is a COLUMN (migration 0008), so a
#     document already extracted is skipped and an interrupted run costs only its current document.
#     `-u` keeps stdout unbuffered, so the log is a live progress record rather than a post-mortem.
$py = 'C:\Users\dudib\AppData\Local\Programs\Python\Python314\python.exe'
if (-not (Test-Path $py)) { $py = 'py' }
Say "launching: extract_graph.py --namespace repo --pending"
& $py -u scripts/extract_graph.py --namespace repo --pending 2>&1 | ForEach-Object { Add-Content -Path $log -Value $_ }
Say "=== extractor exited with code $LASTEXITCODE ==="
