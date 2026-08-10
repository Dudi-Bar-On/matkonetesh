#!/usr/bin/env node
// scripts/check-meta.mjs — the single META entry point (METHODOLOGY §3.3 + §3.4 / H8).
// A thin orchestrator: every gate lives in its own file so it is independently self-testable
// (see scripts/tests/) and every gate prints how many items it scanned - a gate that reports green
// without saying what it covered is exactly how the §5a blind spot (audit fix #10) went unnoticed
// for a full working day (COMPLIANCE-AUDIT-2026-08-01.md).
//
// Wraps: check-geniza-fresh (§10.12) · check-pytest (the Python suite) · check-no-secrets · gate-lessons (§10.16) · check-board-fresh (H10) ·
// check-shipped-closed (H10) · check-brief (§13) · check-h9 (H9) · check-h8-ledger (H8, §5 + §5a) ·
// check-backup-fresh (R-111, task 7) · check-release in AUDIT mode
// (H7 x2 / DoD-12 / L29 / H14 - reported, not blocking; see check-release.mjs's own header for why).
//
// LAYERING (four legs — see .githooks/pre-commit, .claude/settings.json and .github/workflows/*.yml
// for the full comment): this script is invoked by .githooks/pre-commit (fast local feedback,
// bypassable by design) AND by the `discipline` job in CI (the actual authority, not bypassable)
// AND by .claude/settings.json's SessionStart hook (fires on startup/resume/compact - surfaces red
// state, blocks nothing) AND by sync-docs.sh before a docs push. check-release's commit-message-
// specific checks additionally run at commit-msg time via .githooks/commit-msg, because a commit's
// own message text isn't available yet at pre-commit time.
// Session-start AND post-compact both run this, and that is deliberate, not redundant: compaction
// is exactly the moment the working memory discipline depends on gets erased mid-session. A rule
// re-anchored right after the event that erases it is worth more than the same rule stated once at
// the start - a long session that compacts three times must not lose its grip on the rules three
// times and carry on as if nothing happened.
// Runs at: session start · every commit (hook) · every push/PR (CI) · Phase gate / arc close (H8 duty).
// Env: ROADMAP=<path> targets a fixture copy for self-tests (passed through to check-h8-ledger.mjs).
//
// GATE SCOPING (gate-scoping-report.md, 2026-08-01 follow-up). Live rediscovery: a commit that PAID
// DOWN compliance debt got blocked by this orchestrator's OWN pre-existing red state (a stale graph,
// 22 historical briefs) — neither introduced nor worsened by that commit. A gate that blocks the
// commit meant to fix it teaches the escape hatch to become routine, which is exactly as protective as
// no gate. Per-checker ruling (argued in each script's own header, not just asserted here):
//   - check-geniza-fresh: BLOCKING. Its predecessor, check-graph-fresh, was advisory
//     under exactly the reasoning this paragraph sets out — doc drift is a property of elapsed time
//     and no single commit could fix it without "a separate heavy rebuild action". That reasoning
//     was sound about graphify and wrong about the requirement: the heavy action was the thing to
//     remove, not the gate to weaken. Re-ingesting a changed document into the geniza is seconds,
//     so drift IS fixable from the commit that causes it, and blocking is the correct incentive.
//     The nightly graph-freshness.yml is gone with it (8 runs, 0 successes). The SQLite store this
//     gate originally guarded was deleted on 2026-08-05; the question it asked did not change,
//     only which store answers it.
//   - check-brief / check-h9: block only on a file NOT already grandfathered in
//     docs/process/gate-baselines.json - see each script's own header for the mechanism.
//   - check-h8-ledger: blocks only on a finding NOT already present at the git HEAD baseline (i.e. a
//     finding this commit itself introduces or worsens) - see the script's own header.
//   - check-board-fresh / check-release / gate-lessons / check-shipped-closed: UNCHANGED, still contribute to `failed` on
//     every run. Their invariant is always fixable by a single, cheap, immediate edit reachable from
//     the very commit that trips them (update the board header line; write the release commit message
//     correctly; add the lesson) - unlike the three above, there is no "separate heavy action" excuse,
//     so blocking is the correct incentive here, not accumulated debt.
//
// ESCAPE HATCH (narrower + noisier, same follow-up). META_SKIP_HOOK=1 used to skip EVERY gate,
// silently, with no record beyond that one commit's own terminal scrollback. Replaced by
// META_SKIP_GATE=<id>[,<id>...] (ids match the first argument to run() below) — or the literal value
// "ALL" for a full bypass, which still has to be typed out, never a default. `.githooks/pre-commit`
// and `.githooks/commit-msg` append every use to .superpowers/gate-skip-log.jsonl BEFORE invoking this
// script; THIS script prints that log's recent entries at the top of every run (including SessionStart
// and post-compact), so a skip cannot quietly age out of view — it resurfaces every time discipline is
// checked, not just at the moment it was used.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

// ---- surface any recorded gate skips loudly, every run - never let one age silently out of view ----
const SKIP_LOG = join(ROOT, '.superpowers', 'gate-skip-log.jsonl');
if (existsSync(SKIP_LOG)) {
  const lines = readFileSync(SKIP_LOG, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) {
    console.log(`=== gate-skip-log: ${lines.length} recorded override(s) - .superpowers/gate-skip-log.jsonl ===`);
    for (const l of lines.slice(-10)) {
      try {
        const e = JSON.parse(l);
        console.log(`  ! ${e.ts}  hook=${e.hook}  gates=${e.gates}  branch=${e.branch ?? '?'}`);
      } catch { console.log(`  ! (unparsed entry) ${l}`); }
    }
    if (lines.length > 10) console.log(`  ... and ${lines.length - 10} older entry(ies) above these.`);
  }
}

const SKIP_IDS = (process.env.META_SKIP_GATE || '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP_ALL = SKIP_IDS.includes('ALL');
// 2026-08-04: this set is now EMPTY, and that is the point.
//
// It held exactly one member, check-graph-fresh, which was advisory because it could not pass:
// rebuilding graphify's 22 MB graph took an out-of-process LLM run, so the gate sat at 115 stale
// documents and its owning workflow failed 8 of 8 runs. Reviewers 9 and 10 both named it — a
// permanently amber signal is an off signal, and worse, it teaches that gates are noise.
//
// check-geniza-fresh replaces it and BLOCKS, because its remedy is `python scripts/ingest.py`,
// which skips unchanged documents by content hash. A gate is only allowed to block when the fix
// is cheap; the honest response to an expensive fix is to make it cheap, not to mark the gate
// advisory and look away.
const ADVISORY = new Set([]);

function run(id, displayName, file) {
  console.log(`\n=== ${displayName} ===`);
  if (SKIP_ALL || SKIP_IDS.includes(id)) {
    console.log(`SKIPPED — META_SKIP_GATE names "${id}" (recorded in .superpowers/gate-skip-log.jsonl by the calling hook).`);
    return;
  }
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    if (ADVISORY.has(id)) {
      console.log('  (ADVISORY — reported, does not block. ADVISORY is currently empty by design; see the set above.)');
      return;
    }
    failed.push(displayName);
  }
}

run('check-geniza-fresh', 'check-geniza-fresh', 'check-geniza-fresh.mjs');
// Phase 6 Task 1 wiring (2026-08-07). Three gates over mk_rules, the process-rules store — built,
// unit-tested, and NOT wired until now. Same "is the fix cheap and immediate from this commit?" test
// this file's own header applies everywhere else, argued per gate rather than inherited as one answer:
//   - check-rules-fresh: BLOCKING. Same shape as check-geniza-fresh directly above — self-heals
//     (re-runs build_rules_store.py --doc against the one document it's stale for) and re-prints the
//     result, so the fix IS the gate running itself. No reason to treat it differently from its sibling.
//   - check-rules-complete: BLOCKING, but for a different reason than the other two — it was
//     deliberately rewritten read-only (see its own header) after its first version repaired the very
//     condition it checked, making its FAIL branch unreachable. It does NOT self-heal. But the fix it
//     names on FAIL is one command (`py -3 scripts/build_rules_store.py --doc
//     docs/process/development-discipline.md`), reachable from the exact commit that added a rule-shaped
//     section without syncing it — cheap and immediate even though this script won't run it for you.
//     Not self-healing is not the same question as "is blocking correct"; here it still is.
//   - check-rules-mirror: BLOCKING. Rebuilds rules.sqlite from mk_rules and RE-VERIFIES the checksum
//     after rebuilding rather than trusting the rebuild's exit code (see its own header, fix round 2) —
//     the fix is one in-process command and the gate proves it worked before returning OK.
// All three SKIP (exit 0) rather than FAIL when mk_rules is unreachable — classified on the exception
// MESSAGE, not its class, because psycopg2's OperationalError is the same class for "nothing is
// listening" and "wrong password"; only the former may be silent. A fresh clone or CI box with no
// native PostgreSQL service is not a developer with a stale rules store, and blocking them here would
// only teach the skip hatch — same reasoning check-geniza-fresh's header gives for its own dependency.
run('check-rules-fresh', 'check-rules-fresh (docs/process/development-discipline.md matches mk_rules)', 'check-rules-fresh.mjs');
run('check-rules-complete', 'check-rules-complete (every on-disk rule has a current row in mk_rules — does not self-heal)', 'check-rules-complete.mjs');
run('check-rules-mirror', 'check-rules-mirror (rules.sqlite checksum matches mk_rules)', 'check-rules-mirror.mjs');
// Owner decision, 2026-08-09. BLOCKING, and the severity is argued here as this file's GATE SCOPING
// paragraph requires. Unlike the coverage gap above, an unclassified rule is NOT a programme-sized
// backlog: the fix is one classification, and the corpus is at zero undecided as this lands. It blocks
// because L75..L79 sat ungrouped for a day — four written the same night we classified 95 rules — and
// nothing noticed. A rule with no group is enforced by nothing and counted by nothing, so it reads as
// "not applicable" when it means "nobody decided".
// It does not block a rule the two blind classifiers disagreed on: that rule is named in the escalation
// document and reported by name, because the verdict is the owner's and §10.24 forbids a block whose
// only way through is a decision the author may not make.
run('check-rules-classified', 'check-rules-classified (no rule sits in the corpus without a group)', 'check-rules-classified.mjs');
run('check-rule-provenance', 'check-rule-provenance (the rule corpus has exactly one source — never the content plane)', 'check-rule-provenance.mjs');
// Arc 2 Phase 1 (2026-08-09): the eleven ci-gate rules (DoD-11, L15, L24, L30, L43a, L53, L58, L59,
// L61, L66, L74) built in Tasks 1-5, unit-tested in isolation but never invoked from the real entry
// point until now — the exact INERT shape this arc exists to end (a `stop` rule that once loaded only
// under a test-only env var, 333 tests green on a feature that never ran). Each is BLOCKING except
// check-test-file-size, argued individually below, per this file's own GATE SCOPING paragraph:
//   - check-control-bytes / check-test-waits / check-yaml-duplicate-keys / check-python-invocation /
//     check-python-utf8 / check-powershell-output / check-ai-token-caps / check-secret-alphabet: same
//     shape as check-no-arbitrary-waits and check-no-docker above — a fully local, always-decidable
//     scan of a fixed file set, and the fix each names (strip the byte, rewrite the wait predicate,
//     dedupe the YAML key, swap `python`→`py -3`, declare the stream encoding, add a verdict line,
//     raise the cap to 8192, pin the alphabet) is a single cheap edit reachable from the very commit
//     that trips it. Every gate SKIPS (not FAILs) on "scanned 0 files" per its own header, so an empty
//     or unreachable target is never mistaken for a pass — same discipline check-rules-fresh already
//     applies to its own dependency.
//   - check-test-file-size: WARNING only, always exits 0 regardless of what it finds. A spec file
//     legitimately grows as scenarios accrue — the harm this rule names is to *worker-count run
//     stability* (L30: a file large enough to dominate a worker's share of the suite), not to
//     substance, and a growing spec is not a defect the way a duplicate YAML key or a bare `python`
//     call is. Blocking every commit that adds a test to an already-large spec file is exactly the L70
//     failure mode this whole arc exists to avoid ("a gate that blocks every commit ... is switched off
//     within a day") — so this one reports and never fails the commit.
run('check-control-bytes', 'check-control-bytes (L43a — no invisible control byte)', 'check-control-bytes.mjs');
run('check-test-waits', 'check-test-waits (DoD-11, L15, L58 — a wait must be able to fail)', 'check-test-waits.mjs');
run('check-yaml-duplicate-keys', 'check-yaml-duplicate-keys (L61)', 'check-yaml-duplicate-keys.mjs');
run('check-python-invocation', 'check-python-invocation (L59 — the Store alias)', 'check-python-invocation.mjs');
run('check-python-utf8', 'check-python-utf8 (L74 — non-ASCII on a pipe)', 'check-python-utf8.mjs');
run('check-powershell-output', 'check-powershell-output (L66 — the pipeline is the return value)', 'check-powershell-output.mjs');
run('check-ai-token-caps', 'check-ai-token-caps (L24 — 8192 everywhere)', 'check-ai-token-caps.mjs');
run('check-secret-alphabet', 'check-secret-alphabet (L53 — a secret is command-line syntax)', 'check-secret-alphabet.mjs');
// check-test-file-size: WARNING only — routed through the ordinary run() seam (so META_SKIP_GATE and
// the gate-skip-log still cover it like every other gate), but never a candidate for `failed` because
// the script itself always exits 0 (see its own header) — even when it reports files over the worker
// ceiling, that is a printed warning, not a nonzero exit, so run()'s `if (r.status !== 0)` branch is
// simply never taken for this gate.
run('check-test-file-size', 'check-test-file-size (L30 — WARNING only, reports the worker-ceiling risk, never blocks)', 'check-test-file-size.mjs');
// Rule-coverage arc, Task 12 (2026-08-08): does every hook file DECLARE which corpus rules it
// enforces (`export const RULE_IDS = [...]`), read from the mirror this file's own three gates just
// verified above. BLOCKING, but NOT on the shape this file's GATE SCOPING paragraph forbids — the
// gate's own header (scripts/check-rule-coverage.mjs) argues this in code, repeated here per that
// header's own instruction to justify severity in BOTH places: the standing ~45-rule gap (A/B rules
// with no hook yet) is reported, never blocking — closing it is a programme, not a commit's cheap
// fix, exactly the L70 failure mode ("a gate that blocks every commit until all 58 are implemented
// is switched off within a day"). What DOES block is always undoable by the tripping commit alone: a
// rule file that lost its RULE_IDS export, a declared id that names no rule in the corpus, a mirror
// mechanism value outside the 12-value vocabulary, or a REGRESSION against the committed baseline
// (docs/process/rule-coverage-baseline.json) — a rule that WAS covered and no longer is. The baseline
// updates only by an explicit `--update-baseline` run, never by this gate itself, so a regression can
// never be silently approved by the act of checking for one.
run('check-rule-coverage', 'check-rule-coverage (RULE_IDS declarations vs the mirror — reports always, blocks only on regression)', 'check-rule-coverage.mjs');
run('check-pytest', 'check-pytest', 'check-pytest.mjs');
run('check-no-secrets', 'check-no-secrets', 'check-no-secrets.mjs');
run('check-requirements', 'check-requirements', 'check-requirements.mjs');
// BEFORE check-ci, on purpose. check-ci reads what CI DID; this reads whether CI can run at all.
// When a workflow file does not compile, GitHub produces a run with zero jobs and no logs, so
// check-ci reports a red it cannot explain — which is precisely what happened for six consecutive
// pushes over eleven hours (a duplicate `retention-days` key introduced in 1a9f844). Ordering the
// cheap, local, decidable check first means the answer arrives before the symptom.
run('check-workflows', 'check-workflows (a workflow GitHub cannot compile produces zero jobs and no logs)', 'check-workflows.mjs');
// Same shape of bug as check-workflows, one document layer up: a mandatory-read doc (CLAUDE.md,
// the discipline doc, both checklists, the task-brief template, enforce.md, Serena's own memories)
// telling an agent to run a scripts/ command that no longer exists. The 2026-08-05 memory-store
// deletion left exactly three such dead references in the files agents are required to read first.
run('check-commands-exist', 'check-commands-exist (a mandatory-read doc naming a scripts/ command that no longer exists)', 'check-commands-exist.mjs');
// DoD-11 / TEST-AUTHORING-CONTRACT.md:55 — sits right after check-commands-exist because both are the
// same shape of gate: a cheap, fully local, always-decidable scan of a fixed file set (there, docs
// naming dead scripts; here, tests naming a wait that cannot fail). Two real waitForTimeout violations
// (tests/i18n-completeness.spec.ts:48,:121) shipped before this gate existed to catch them.
run('check-no-arbitrary-waits', 'check-no-arbitrary-waits (a page.waitForTimeout in tests/ — DoD-11, cannot fail for the right reason)', 'check-no-arbitrary-waits.mjs');
// Docker-exit Task 9. Same family as check-no-arbitrary-waits immediately above: a fully local,
// always-decidable scan of a fixed file set, and the fix (rewrite the call to its native equivalent)
// is a single cheap edit reachable from the very commit that trips it — so it BLOCKS, per this file's
// own §GATE SCOPING rule above. It is a live-invocation detector, not a string grep — see the gate's
// own header (scripts/check-no-docker.mjs) for the invocation-vs-mention rule that keeps it from
// lighting up on the repo's own Docker-exit documentation and comments.
run('check-no-docker', 'check-no-docker (a live `docker <subcommand>` call in executable code — Docker-exit Task 9)', 'check-no-docker.mjs');
// R-94. Without this, check-meta could report OK while the UI suite had been red in CI for 25
// consecutive runs — which is what happened. It READS CI rather than running the suite, because
// §11a forbids a second concurrent Playwright run and a hook that launched one would cause the
// very failures it was meant to catch.
run('check-ci', 'check-ci', 'check-ci.mjs');
run('gate-lessons', 'gate-lessons', 'gate-lessons.mjs');
run('check-board-fresh', 'check-board-fresh', 'check-board-fresh.mjs');
// Task 1 item 7 (session-state arc, 2026-08-07, owner: "הקפדה לחומרה מקסימלית, קרובה לאכיפה ככל
// שניתן"). Same family as check-board-fresh directly above — a self-report (there: the board; here:
// the active SDD ledger) must stay current with git — but a narrower and more severe instance: the
// board updates once at arc close, while the ledger is meant to be current MID-ARC, which is exactly
// what session-state.mjs now reads to recover position after a compact. BLOCKS because the fix is
// one line in the ledger, cheap and immediate from the commit that trips it — see the gate's own
// header for the full "GATE SCOPING" argument and the live incident (R-109) that motivated it.
run('check-state-fresh', 'check-state-fresh (the active SDD ledger must record commits landed since it was last edited)', 'check-state-fresh.mjs');
// R-111 / task 7 (2026-08-08): "a backup nobody checks the freshness of is an assumption." The
// geniza's newest backup was found two days and 71 documents behind, discovered only because someone
// happened to look. Filesystem-only (no DB credentials, no live connection — must answer correctly
// even when both stores are down, exactly the scenario a backup exists to survive).
// BLOCKING once the destination drive is mounted, per this file's own GATE SCOPING test: the remedy
// is one reachable command (`powershell scripts\backup-stores.ps1`, or for archive lag,
// `powershell scripts\enable-wal-archiving.ps1` — elevated, the owner's to run once) — same shape as
// check-geniza-fresh's own justification for blocking. SKIPS, not fails, when the destination drive
// itself is absent (CI has no G:\ or F:\ at all) or when WAL archiving has never been enabled on this
// machine — an unmet precondition is not a compliance finding, same reasoning check-rules-fresh and
// check-state-fresh already apply to their own infra dependencies. Env overrides for self-test
// fixtures only: PRIMARY_DEST, ARCHIVE_DEST, MAX_BACKUP_AGE_HOURS, MAX_ARCHIVE_LAG_MINUTES — see the
// gate's own header. NOTE for whoever wires this in fresh on a machine with neither base backup nor
// WAL archiving yet: this WILL fail until `backup-stores.ps1` has been run at least once and stays
// red on archive lag until `enable-wal-archiving.ps1` (elevated) has been run — that is the intended,
// deliberate signal this task exists to create, not a bug in the gate.
run('check-backup-fresh', 'check-backup-fresh (R-111 — base backup + WAL archive freshness)', 'check-backup-fresh.mjs');
run('check-brief', 'check-brief', 'check-brief.mjs');
run('check-h9', 'check-h9', 'check-h9.mjs');
run('check-release', 'check-release (audit mode, reported not blocking - see file header)', 'check-release.mjs');
run('check-h8-ledger', 'check-h8-ledger (no-unlanded-items, §5 + §5a, worsening-only)', 'check-h8-ledger.mjs');
run('check-shipped-closed', 'check-shipped-closed (a row whose work shipped may not stay open, H10)', 'check-shipped-closed.mjs');
// LAST, deliberately. build-audit is a RECORDER, not a gate: it regenerates docs/audit/2026-08-06-
// enforcement-arc-audit.md from the live session transcript (see the script's own header for why a
// derived projection replaced "remember to append to a file"). It always exits 0, even when the
// transcript cannot be found (session-not-local, CI, a moved home directory) — a recorder that can
// block a commit would be removed within a day, so it is placed after every real gate and never
// contributes to `failed`.
run('build-audit', 'build-audit (regenerates the session audit trail — never blocks, see file header)', 'build-audit.mjs');

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
