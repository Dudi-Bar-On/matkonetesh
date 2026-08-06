# docs/audit/ — generated session audit trail

Files in this directory (other than this README) are produced by `scripts/build-audit.mjs`,
wired into `scripts/check-meta.mjs` as its last, non-blocking step. Each one is a chronological
projection of a live Claude Code session transcript — every real user-typed message and every
assistant text block, plus reduced one-line records of tool calls and background-agent
notifications. See that script's own header comment for exactly what is and is not captured.

**These generated files are gitignored, not committed** (`docs/audit/*.md`, this README
excepted). The decision, and why: the repository is public
(`github.com/Dudi-Bar-On/matkonetesh`), and an audit file is a **near-verbatim transcript** of
the working session — including everything the owner personally typed on screen, not only
curated report prose. The project's existing convention of committing internal process
artifacts (`.superpowers/sdd/*`, `docs/STATUS-BOARD.md`, gate-skip logs) covers *authored*
records — text someone deliberately wrote for the repo. This is different in kind: a derived
dump of raw conversational input, regenerated from a transcript that itself lives only on the
owner's machine (`~/.claude/projects/...`). Publishing it permanently into public git history,
forever, by default, is a materially bigger exposure than anything else this project commits —
and it buys nothing, because the file is reproducible on demand from the transcript that is
still local. (No secrets are ever at risk here — CLAUDE.md's standing rule keeps those out of
chat entirely — but "no secrets" is not the same bar as "fine to publish verbatim.")

The **location and filename stay fixed and known** (e.g.
`docs/audit/2026-08-06-enforcement-arc-audit.md`) — that satisfies the owner's requirement of
"a file whose name and location they know" without requiring it to be public. It regenerates
automatically at session start, every commit, and in CI (where the transcript will not be
present, and the script says so loudly and exits 0 rather than failing the run — see its
header).
