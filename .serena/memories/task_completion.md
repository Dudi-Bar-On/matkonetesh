# matconetesh — task completion

The AUTHORITATIVE gate is **CLAUDE.md §3** (the 12-point DoD checklist) plus
`docs/process/development-discipline.md` — read those directly; this memory only points at them so
the gate is not silently skipped or reinvented from partial memory (the project's own L16 lesson:
"a summary written from recollection is not the source").

Non-negotiable highlights worth remembering without a re-read every time:
- TDD: a RED test witnessed failing for the right reason, BEFORE the fix/feature (test-driven-development).
- `npx playwright test` run fresh, plain, output pasted, green once (§11a: workers:8 locally / 2 in
  CI, retries:0 — an intermittent failure is a bug, not a re-run candidate).
- Any UI change: screenshot at **390×844**, actually looked at.
- Any user-facing string: Hebrew-rendered screenshot, checked for leaks/plurals/dir="ltr" islands.
- Any task touching cooking values: the safety-invariance assertion is named explicitly.
- A completion claim is void without fresh command output pasted in the SAME message
  (verification-before-completion skill) — never trust a prior/remembered run.
