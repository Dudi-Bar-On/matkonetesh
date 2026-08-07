# run-extraction.ps1 — start the geniza's relationship extraction so it SURVIVES.
#
# WHY THIS EXISTS, in one night's evidence. The extraction was launched twice as a child of an
# interactive session and died twice:
#   * ~01:41 — the client exited with an empty stderr and no traceback, one document in.
#   * 02:27  — winlogon initiated a machine restart (System event 1074) and took everything with it.
# A 17-hour job cannot depend on a session, and it cannot depend on someone being awake to notice.
#
# It also cannot depend on its dependencies being up. UPDATED 2026-08-07 (docker-exit Tasks 4/6):
# both PostgreSQL (`postgresql-x64-18`) and Neo4j (`neo4j`) are now native Windows services —
# `mk-postgres` was retired (R-108) and the Neo4j container is stopped, kept only as a rollback
# until Task 12. There is no daemon to start and no `docker compose up -d` to issue any more; a
# Windows service starts at boot on its own, and `Start-Service` below is a defensive no-op belt
# for the case it was ever stopped by hand. Readiness is proved the same way the rest of this repo
# now proves it (`scripts/check-geniza-reader.py`, `watchman.ps1`'s mk_rules-postgres component):
# a real read through `src.knowledge.config.connect_reader()`, not a container exec.
#
# So this script brings up what it needs, waits for it to actually answer, and only then runs.
# Scheduled via Task Scheduler with an at-startup trigger, it recovers from a reboot on its own.
#
#   powershell -ExecutionPolicy Bypass -File scripts\run-extraction.ps1

# 'Continue', not 'Stop': Start-Service on an already-running service, or one this account cannot
# administer, should not abort the script — the readiness loop below is the honest test either way.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$log = Join-Path $repo 'extraction-run.out'
function Say($m) { $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m; Add-Content -Path $log -Value $line }

Say "=== run-extraction.ps1 starting ==="

# 1 · the native services. Both start automatically at boot; this is a defensive nudge in case
#     either was stopped by hand. -ErrorAction SilentlyContinue: lacking privilege to (re)start a
#     service that is already running is not a failure worth aborting for — the readiness check
#     below is what actually gates the run.
Start-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
Start-Service -Name 'neo4j' -ErrorAction SilentlyContinue
Say "native services: start requested (postgresql-x64-18, neo4j)"

# 2 · WAIT for PostgreSQL to actually answer, through the real reader path, not a service-status
#     flag — a service reported 'Running' is not a database accepting connections, and starting
#     the extractor a second too early costs the whole run.
$py = 'C:\Users\dudib\AppData\Local\Programs\Python\Python314\python.exe'
if (-not (Test-Path $py)) { $py = 'py' }
$ready = $false
foreach ($i in 1..60) {
  & $py scripts/check-geniza-reader.py *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; Say "postgres answered after $($i*5)s"; break }
  Start-Sleep -Seconds 5
}
if (-not $ready) { Say "FAIL: postgres never answered in 300s — not starting the extractor"; exit 1 }

# 3 · ollama. The desktop app starts it at login; if this runs at boot before that, start it here.
try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 8 | Out-Null; Say "ollama already answering" }
catch {
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
  foreach ($i in 1..24) {
    try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/ps' -TimeoutSec 5 | Out-Null; Say "ollama answered after $($i*5)s"; break }
    catch { Start-Sleep -Seconds 5 }
  }
}

# 4 · the run itself. `--pending` is the resume: extraction state is a COLUMN (migration 0008), so a
#     document already extracted is skipped and an interrupted run costs only its current document.
#     `-u` keeps stdout unbuffered, so the log is a live progress record rather than a post-mortem.
# 6.8.26 — the 06:17 run processed all 840 documents and then DIED on its own closing summary:
#   UnicodeEncodeError: 'charmap' codec can't encode characters in position 54-55
# Python's stdout is not a console here (it is piped into Add-Content), so it defaults to the system
# ANSI code page — cp1252 on this machine — and the final rejected-reasons report prints entity names
# lifted verbatim out of the corpus, which is Hebrew-first and full of typographic dashes. The work
# was not lost, but the run ended in a traceback and exit 1 instead of a summary, which reads like a
# failed extraction and cost an evening of doubt. Force UTF-8 so the closing report survives its own
# contents.
$env:PYTHONIOENCODING = 'utf-8'
Say "launching: extract_graph.py --namespace repo --pending (PYTHONIOENCODING=utf-8)"
& $py -u scripts/extract_graph.py --namespace repo --pending 2>&1 | ForEach-Object { Add-Content -Path $log -Value $_ }
Say "=== extractor exited with code $LASTEXITCODE ==="
