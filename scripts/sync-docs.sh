#!/usr/bin/env bash
# sync-docs.sh — the documentation loop, as one command.
#
# Discipline §10.12: a document that is written but not graphed leaves the knowledge graph stale, and a
# stale map is worse than no map because it is trusted and wrong. graphify's own post-commit hook
# re-extracts CODE only ("doc/image changes are ignored by the hook"), so documentation must be updated
# explicitly. This script makes that one step instead of three remembered ones.
#
# Usage:  scripts/sync-docs.sh "commit message"
#         scripts/sync-docs.sh "commit message" --no-push
set -uo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-docs: update}"
PUSH=1
[ "${2:-}" = "--no-push" ] && PUSH=0

export PATH="$HOME/.local/bin:$PATH"

echo "── 1/3 · graphify update (docs) ─────────────────────────────"
if command -v graphify >/dev/null 2>&1; then
  if [ -f graphify-out/graph.json ]; then
    graphify update docs || echo "   ! graphify update failed — continuing, but the graph is now STALE"
  else
    echo "   · no graph yet (graphify-out/graph.json missing) — run the full build first: /graphify docs"
  fi
else
  echo "   ! graphify not on PATH — graph NOT updated"
fi

echo "── 2/3 · stage documents ────────────────────────────────────"
git add docs/ .claude/skills/ scripts/ 2>/dev/null
# graphify-out/ is generated and stays out of git, except the human-readable report
if [ -f graphify-out/GRAPH_REPORT.md ]; then
  mkdir -p docs/analysis/graph
  cp graphify-out/GRAPH_REPORT.md docs/analysis/graph/GRAPH_REPORT.md
  git add docs/analysis/graph/GRAPH_REPORT.md
  echo "   · GRAPH_REPORT.md copied into docs/analysis/graph/ and staged"
fi

if git diff --cached --quiet; then
  echo "   · nothing staged — no commit needed"
  exit 0
fi
git diff --cached --name-only | sed 's/^/   + /'

echo "── 3/3 · commit${PUSH:+ and push} ───────────────────────────"
git commit -q -m "$MSG" || { echo "   ! commit failed"; exit 1; }
echo "   · committed $(git rev-parse --short HEAD)"
if [ "$PUSH" = "1" ]; then
  # Report the REAL push outcome. An earlier version piped to `tail -1` and printed a stale
  # "Everything up-to-date" line while the branch was still ahead — a silent failure to publish.
  if git push origin main; then
    AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "?")
    if [ "$AHEAD" = "0" ]; then echo "   · pushed — origin is up to date"
    else echo "   ! PUSH DID NOT PUBLISH — still $AHEAD commit(s) ahead of origin"; exit 1; fi
  else
    echo "   ! PUSH FAILED"; exit 1
  fi
fi
echo "done."
