# One-off runner: extract ONLY the Neo4j vendor corpus, ahead of everything else.
#
# Owner instruction 2026-08-07: ingest Neo4j's documentation and extract it with priority. The
# built-in tiering is project -> tests -> sources -> vendor, which would have put this corpus LAST,
# behind 283 other vendor documents. `--paths` scopes the run instead of reordering it.
#
# Why this is a scheduled task and not a background process: three earlier launches
# (nohup &, a managed background job, and a detached Start-Process) were each killed when the shell
# or job that spawned them was cleaned up — the whole process tree goes with it. Every one of them
# reported "finished" rather than "killed", because a watcher polling for the process cannot tell
# the difference between a run that ended and a run that was ended. Task Scheduler owns the process
# instead, so nothing in this session's lifecycle can reach it.
#
# Resumable by design: --pending reads extraction state from a COLUMN (migration 0008), so a killed
# run costs only the document in flight. The three interrupted runs cost nothing but wall clock —
# 61 -> 48 -> 31 documents remaining, never re-work.
#
# PYTHONIOENCODING is load-bearing: stdout is redirected to a file, so Python falls back to the
# system ANSI code page (cp1252 here) and the closing report — which prints entity names lifted
# verbatim from a Hebrew-first corpus — dies with UnicodeEncodeError. That killed the 840-document
# run on 2026-08-06 AFTER it had finished all its work.
$ErrorActionPreference = 'Continue'
$env:PYTHONIOENCODING = 'utf-8'
$root = 'C:\Users\dudib\source\repos\matconetesh'
Set-Location $root
& py -3 -u scripts/extract_graph.py --namespace repo --pending --paths docs/vendor/neo4j *>&1 |
    Tee-Object -FilePath (Join-Path $root 'neo4j-extraction.out') -Append
