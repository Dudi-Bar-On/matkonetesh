#!/usr/bin/env bash
# sync-docs.sh — the documentation loop, as one command.
#
# Discipline §10.12: a document that is written but not ingested leaves the agent memory stale, and a
# stale map is worse than no map because it is trusted and wrong. This script makes that one step
# instead of three remembered ones.
#
# 2026-08-04: step 1 used to be a NON-STEP. It detected that documents had changed and then printed
# an instruction to go run `/graphify docs --update --mode deep` by hand, because a shell script
# cannot invoke a Claude skill. So the one command that existed to keep the map current could not
# actually update it — which is the mechanical reason the freshness gate stood at 115 stale
# documents and was marked advisory. It now performs the ingest itself, in milliseconds.
#
# Usage:  scripts/sync-docs.sh "commit message"
#         scripts/sync-docs.sh "commit message" --no-push
set -uo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-docs: update}"
PUSH=1
[ "${2:-}" = "--no-push" ] && PUSH=0

export PATH="$HOME/.local/bin:$PATH"

echo "── 1/3 · agent-memory sync (delta by content hash) ──────────"
if ! python scripts/ingest.py --scope; then
  echo "   ! ingest FAILED — not committing on a stale geniza."
  exit 1
fi
if ! node scripts/check-geniza-fresh.mjs; then
  echo "   ! the store is still not current after a sync. Investigate before committing."
  exit 1
fi

echo "── 2/3 · stage documents ────────────────────────────────────"
# CLAUDE.md lives at the REPO ROOT, not under docs/. It was omitted from this list until
# 2026-07-22, so three consecutive runs committed discipline updates while silently leaving
# CLAUDE.md — the only file every subagent inherits — uncommitted. Root-level agreement files
# are staged explicitly for that reason.
git add docs/ .claude/skills/ scripts/ src/ CLAUDE.md 2>/dev/null
# agent-memory.db is a build artifact rebuilt from the .md files in seconds, so it stays out of
# git (see .gitignore). The old flow copied graphify's GRAPH_REPORT.md into docs/ to keep a
# human-readable trace in the repo; `python scripts/ingest.py --scope --status` prints the equivalent on
# demand and cannot go stale, so nothing is committed here in its place.

if git diff --cached --quiet; then
  echo "   · nothing staged — no commit needed"
  exit 0
fi
git diff --cached --name-only | sed 's/^/   + /'

echo "── 3/3 · commit${PUSH:+ and push} ───────────────────────────"
# Phase 0 gate (§10.12 enforcement): a docs push may not ship a stale memory store.
# The escape hatch is kept but should now be effectively dead: step 1 already synced and verified,
# so reaching here stale means something is genuinely wrong rather than merely un-run.
if [ "$PUSH" = "1" ] && [ "${SYNC_ALLOW_STALE:-0}" != "1" ]; then
  if ! node scripts/check-geniza-fresh.mjs; then
    echo "   ! MEMORY IS STALE after a sync — refusing to push docs. Investigate; do not override blindly."
    echo "   ! (escape hatch, stated out loud: SYNC_ALLOW_STALE=1 scripts/sync-docs.sh ...)"
    exit 1
  fi
elif [ "${SYNC_ALLOW_STALE:-0}" = "1" ]; then
  echo "   ! SYNC_ALLOW_STALE=1 — pushing over a possibly-stale memory store (deliberate override)"
fi
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
