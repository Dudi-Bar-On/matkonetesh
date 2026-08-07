#!/usr/bin/env node
// scripts/session-rules.mjs — re-reads the rules into context; session-brief.mjs (companion script)
// answers "where are we"; this one answers "what are the rules, verbatim, right now".
//
// WHY THIS EXISTS, AND WHY IT IS A SEPARATE SCRIPT FROM session-brief.mjs.
// A compliance gate (check-meta.mjs) reports whether the rules were followed. session-brief.mjs
// reports the project's position. Neither RESTORES the rules into the agent's working context after
// compaction deletes them — and the project's own doctrine is explicit that this is the actual
// failure mode: "Memory is not a substitute for re-reading. 'I remember this skill' is a red flag —
// skills and rules are re-read at invocation, never recalled." (CLAUDE.md, banner line). A gate
// printing green after compaction restores nothing; work continues without the rules in context,
// which is the exact drift COMPLIANCE-AUDIT-2026-08-01.md documented for a full day.
// Kept as its own file (not folded into session-brief.mjs) because the two have different profiles:
// session-brief is small and computed (git log, table parsing); this one is large and purely
// re-emits existing text verbatim. Mixing them would make the position digest slow/noisy on every
// run for the sake of content that does not change shape run-to-run, and would make it harder to
// reason about the token budget of each independently.
//
// BUDGET DECISION (stated explicitly, per the owner's request to justify the tension between
// completeness and cost): full verbatim text for exactly four things — the always-loaded project
// instructions (CLAUDE.md), the memory index (MEMORY.md — itself already a one-line-per-topic
// index; the ~27 individual memory docs it points to are NOT dumped, the index's own descriptions
// serve as the named-with-path-and-reason pointer to each), and from the discipline document: the
// DoD gate (§3), the Waiver Gate (§4), the owner's standing instructions (§10, all subsections —
// this is the section the audit found was silently unread the day of the failure), and the full
// lessons log (§11 — every L-numbered entry). Everything else in the discipline document (pipeline,
// debugging protocol, reviewer discipline, thinking models, testing infra, operating model, H8–H15
// ruling summaries, etc.) is named with its path/heading and a one-line reason instead of quoted —
// those sections are either stable reference material not implicated in the audit's failure list,
// or already summarized correctly elsewhere (H8–H15 are one-paragraph rulings, not multi-step
// procedures whose paraphrase caused a documented failure). The measured total below is the actual
// number, not an estimate — see the run output pasted in the task's report.
//
// Extraction is anchor-based (regex on heading text), never hardcoded line numbers — the document
// has already reordered sections once (§10's subsections are split across two physically distant
// regions of the file, 10.1-10.10 then 10.11-10.21+10.12 embedded after the lessons log) and a
// line-number-pinned extractor would silently go stale the next time it is edited, which is exactly
// the class of "quietly stopped covering what it claims to cover" failure this project's own audit
// document (H8 §10 finding) is about.
//
// Read-only. Must never fail the session: every read is guarded; a missing file prints
// "not established" for that section and the script still exits 0.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NA = 'not established';
const rule = (ch = '=') => ch.repeat(78);

// ---------------------------------------------------------------------------------------------
// RULES STORE CATALOG — reads rules.sqlite (the mirror), never PostgreSQL directly (no DB
// credentials belong to an agent). This is what section 5 (below, in main()) adds on top of the
// verbatim document text already emitted above: a COUNT of rules currently in force and a DIFF
// against the last time this script ran — the two things a document re-read alone cannot answer.
//
// R-103 TRAP: the mirror is a PROJECTION, not the source of truth. It has previously held a value
// Postgres never stored. So every run of this script declares, out loud, which source the catalog
// actually came from — mirror, or a fallback direct read of the document — and if the mirror
// disagrees with the document it says so rather than silently trusting either side.
const MIRROR_PATH = join(ROOT, 'rules.sqlite');
const DOC_SOURCE_PATH = 'docs/process/development-discipline.md'; // literal string — matches
// the source_path value stored in rules.sqlite/mk_rules (a POSIX-style string key, not an OS path).
const SNAPSHOT_DIR = join(ROOT, '.superpowers', 'state');
const SNAPSHOT_PATH = join(SNAPSHOT_DIR, 'rules-injector-snapshot.json');
const PY_CANDIDATES = [['py', ['-3']], ['python3', []]]; // L59 — `python` bare may be the MS Store alias.

function readMirrorCatalog() {
  let db;
  try {
    db = new DatabaseSync(MIRROR_PATH, { readOnly: true });
    const rows = db.prepare(
      'SELECT rule_id, section, title_he, bucket, source_path, source_hash, revision_status FROM rule_revisions ORDER BY rule_id'
    ).all();
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e.message.split('\n')[0] };
  } finally {
    try { db?.close(); } catch { /* already closed or never opened */ }
  }
}

// Fallback / freshness-check path: extract rule-shaped records straight out of the document via
// the SAME extractor the builder uses (src/rules_store/extractor.py), so a "stale mirror" verdict
// is computed against the real parser, not a hand-rolled approximation of it. Never touches
// Postgres — this is a pure text-in, JSON-out subprocess.
function getDocCatalog(discAbsPath) {
  const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(ROOT)})
from pathlib import Path
from src.rules_store.extractor import extract_rules
text = Path(${JSON.stringify(discAbsPath)}).read_text(encoding="utf-8")
recs = extract_rules(text, ${JSON.stringify(DOC_SOURCE_PATH)})
print(json.dumps([{"rule_id": r.rule_id, "section": r.section, "title_he": r.title_he, "bucket": r.bucket, "hash": r.content_hash} for r in recs]))
`;
  for (const [cmd, pre] of PY_CANDIDATES) {
    const r = spawnSync(cmd, [...pre, '-c', py], { cwd: ROOT, encoding: 'utf8' });
    if (r.error || r.status === null) continue;
    if (r.status !== 0) return { ok: false, error: (r.stderr ?? '').trim().split('\n').pop().slice(0, 200) || `exit ${r.status}` };
    try {
      const rules = JSON.parse(r.stdout.trim().split('\n').pop());
      return { ok: true, rules };
    } catch (e) {
      return { ok: false, error: `could not parse extractor output (${e.message})` };
    }
  }
  return { ok: false, error: 'no Python interpreter could be run (tried py -3, python3)' };
}

function buildRulesCatalog(discAbsPath) {
  const mirror = readMirrorCatalog();
  const result = {
    ok: false, source: 'none', sourceNote: '', rules: new Map(),
    stale: [], mirrorOnly: [], docOnly: [], freshnessChecked: false,
  };

  if (mirror.ok) {
    for (const row of mirror.rows) {
      result.rules.set(row.rule_id, { hash: row.source_hash, section: row.section, title: row.title_he, bucket: row.bucket, sourcePath: row.source_path });
    }
    result.ok = true;
    result.source = 'mirror';

    const docCatalog = getDocCatalog(discAbsPath);
    if (docCatalog.ok) {
      result.freshnessChecked = true;
      const docMap = new Map(docCatalog.rules.map(r => [r.rule_id, r]));
      const mirrorDocRows = mirror.rows.filter(r => r.source_path === DOC_SOURCE_PATH);
      const mirrorDocIds = new Set(mirrorDocRows.map(r => r.rule_id));
      const docIds = new Set(docMap.keys());
      for (const row of mirrorDocRows) {
        const d = docMap.get(row.rule_id);
        if (d && d.hash !== row.source_hash) {
          result.stale.push({ rule_id: row.rule_id, mirrorHash: row.source_hash, docHash: d.hash });
        }
      }
      for (const id of mirrorDocIds) if (!docIds.has(id)) result.mirrorOnly.push(id);
      for (const id of docIds) if (!mirrorDocIds.has(id)) result.docOnly.push(id);
    }

    const disagreements = result.stale.length + result.mirrorOnly.length + result.docOnly.length;
    if (disagreements > 0) {
      result.sourceNote =
        `rules.sqlite (mirror) — ${result.rules.size} current rule(s) — ⚠ STALE: disagrees with ` +
        `${DOC_SOURCE_PATH} on ${disagreements} rule(s) (${result.stale.length} changed, ` +
        `${result.mirrorOnly.length} in mirror only, ${result.docOnly.length} in document only). ` +
        `Neither side is silently preferred — see the disagreement list below.`;
    } else if (result.freshnessChecked) {
      result.sourceNote = `rules.sqlite (mirror) — verified fresh against ${DOC_SOURCE_PATH} — ${result.rules.size} current rule(s) in force.`;
    } else {
      result.sourceNote = `rules.sqlite (mirror) — ${result.rules.size} current rule(s) in force. Freshness vs. the document NOT independently verified this run (${docCatalog.error}).`;
    }
  } else {
    const docCatalog = getDocCatalog(discAbsPath);
    if (docCatalog.ok) {
      for (const r of docCatalog.rules) {
        result.rules.set(r.rule_id, { hash: r.hash, section: r.section, title: r.title_he, bucket: r.bucket, sourcePath: DOC_SOURCE_PATH });
      }
      result.ok = true;
      result.source = 'fallback-doc';
      result.sourceNote =
        `FALLBACK TO THE DOCUMENT — rules.sqlite could not be read (${mirror.error}). Reading rule-shaped ` +
        `items directly out of ${DOC_SOURCE_PATH} instead — ${result.rules.size} rule(s) found this way. ` +
        `This run's catalog did NOT come from the mirror.`;
    } else {
      result.sourceNote =
        `NEITHER SOURCE AVAILABLE — rules.sqlite: ${mirror.error}; direct document extraction also failed: ` +
        `${docCatalog.error}. Rule count and drift-since-last-session are NOT established this run.`;
    }
  }
  return result;
}

function loadPriorSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch {
    return null; // corrupt/unreadable snapshot is treated as "no prior snapshot", not a crash.
  }
}

function diffAgainstPrior(prior, catalog) {
  if (!prior || !prior.rules) return null;
  const prevIds = new Set(Object.keys(prior.rules));
  const currIds = new Set(catalog.rules.keys());
  const added = [], changed = [], retired = [];
  for (const id of currIds) {
    if (!prevIds.has(id)) added.push(id);
    else if (prior.rules[id].hash !== catalog.rules.get(id).hash) changed.push(id);
  }
  for (const id of prevIds) if (!currIds.has(id)) retired.push(id);
  added.sort(); changed.sort(); retired.sort();
  return { added, changed, retired, priorGeneratedAt: prior.generatedAt, priorSource: prior.source, priorCount: prevIds.size };
}

function persistSnapshot(catalog) {
  const rulesObj = {};
  for (const [id, v] of catalog.rules) rulesObj[id] = { hash: v.hash, section: v.section, title: v.title, bucket: v.bucket };
  try {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(SNAPSHOT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), source: catalog.source, rules: rulesObj }, null, 2));
    return true;
  } catch {
    return false;
  }
}

function readOrNA(path, label) {
  if (!existsSync(path)) return { ok: false, text: `${NA} — ${label} not found at ${path}` };
  try {
    return { ok: true, text: readFileSync(path, 'utf8') };
  } catch (e) {
    return { ok: false, text: `${NA} — could not read ${label} (${e.message.split('\n')[0]})` };
  }
}

// Slice discipline.md between an opening heading regex and the next heading that matches `stop`.
// NOTE: deliberately does NOT rely on regex.lastIndex — stopRe is typically a non-global regex
// (bug caught while verifying: lastIndex is silently ignored on a non-'g' regex, so .exec always
// restarts from index 0 of the *whole* string, which previously matched the FIRST "### 10.N"
// heading in the document — one that appears BEFORE "## 11. Lessons log" even starts — producing
// an empty slice. Fixed by searching only the substring after the start match.).
function sliceSection(text, startRe, stopRe) {
  const startMatch = startRe.exec(text);
  if (!startMatch) return null;
  const from = startMatch.index;
  const afterStart = from + startMatch[0].length;
  const rest = text.slice(afterStart);
  const stopMatch = stopRe.exec(rest);
  const to = stopMatch ? afterStart + stopMatch.index : text.length;
  return text.slice(from, to).trimEnd();
}

// Every "### 10.N ..." block anywhere in the file, in file order, each running to the next
// heading (## or ###). Robust to §10's subsections being split across two regions of the file.
function collectStandingInstructions(text) {
  const headingRe = /^### 10\.\d+[a-z]?\b[^\n]*$/gm;
  const anyHeadingRe = /^#{2,3} /gm;
  const heads = [...text.matchAll(headingRe)];
  if (!heads.length) return null;
  const intro = sliceSection(text, /^## 10\. .*$/m, /^### /m);
  const blocks = heads.map((h, i) => {
    anyHeadingRe.lastIndex = h.index + h[0].length;
    const next = anyHeadingRe.exec(text);
    const end = next ? next.index : text.length;
    return text.slice(h.index, end).trimEnd();
  });
  return [intro, ...blocks].filter(Boolean).join('\n\n');
}

function main() {
  const parts = [];
  parts.push(rule());
  parts.push('SESSION-RULES — a RE-READ, not a recollection.');
  parts.push(
    'This is the verbatim text of the rules, emitted fresh into context because a SessionStart hook\'s\n' +
    'stdout is injected here — it is not a paraphrase and must not be treated as one. If anything below\n' +
    'is unclear or this digest looks truncated/stale, open the full source file directly before starting\n' +
    'the next task: CLAUDE.md, docs/process/development-discipline.md, and the memory files it indexes.\n' +
    '"I remember this rule" is, per this project\'s own doctrine, a red flag — not a reason to skip reading.'
  );
  parts.push(rule());

  // 1) Always-loaded project instructions — full.
  parts.push('\n' + rule('-'));
  parts.push('CLAUDE.md (project root) — FULL TEXT');
  parts.push(rule('-'));
  const claudeMd = readOrNA(join(ROOT, 'CLAUDE.md'), 'CLAUDE.md');
  parts.push(claudeMd.text);

  // 2) Memory index — full. (The ~27 individual memory docs it points to are intentionally NOT
  // dumped here; the index's own one-line descriptions ARE the named-with-path-and-reason pointer
  // to each — opening any one of them is a deliberate follow-up action, not part of this budget.)
  parts.push('\n' + rule('-'));
  const cwdEncoded = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  const memoryIndexPath = join(homedir(), '.claude', 'projects', cwdEncoded, 'memory', 'MEMORY.md');
  parts.push(`MEMORY INDEX (${memoryIndexPath}) — FULL TEXT`);
  parts.push(rule('-'));
  const memIdx = readOrNA(memoryIndexPath, 'memory index');
  parts.push(memIdx.text);

  // 3) Discipline document excerpts — full, verbatim, anchor-extracted.
  const discPath = join(ROOT, 'docs', 'process', 'development-discipline.md');
  const disc = readOrNA(discPath, 'development-discipline.md');
  if (disc.ok) {
    const dodGate = sliceSection(disc.text, /^## 3\. .*$/m, /^## \d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §3 — THE DoD GATE — FULL TEXT');
    parts.push(rule('-'));
    parts.push(dodGate ?? `${NA} — §3 heading not found (document structure may have changed).`);

    const waiverGate = sliceSection(disc.text, /^## 4\. .*$/m, /^## \d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §4 — THE WAIVER GATE — FULL TEXT');
    parts.push(rule('-'));
    parts.push(waiverGate ?? `${NA} — §4 heading not found (document structure may have changed).`);

    const standing = collectStandingInstructions(disc.text);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §10 — OWNER\'S STANDING INSTRUCTIONS (all 10.x subsections) — FULL TEXT');
    parts.push(rule('-'));
    parts.push(standing ?? `${NA} — no "### 10.N" headings found (document structure may have changed).`);

    // Lessons log: from "## 11. Lessons log" up to the first embedded "### 10.N" heading (the point
    // where the file's §10 subsections physically resume inside what is nominally §11's range —
    // see the header comment above). That boundary is content-based, not a hardcoded line number.
    const lessons = sliceSection(disc.text, /^## 11\. Lessons log.*$/m, /^### 10\.\d/m);
    parts.push('\n' + rule('-'));
    parts.push('development-discipline.md §11 — FULL LESSONS LOG — FULL TEXT');
    parts.push(rule('-'));
    parts.push(lessons ?? `${NA} — §11 heading (or its 10.x boundary) not found (document structure may have changed).`);
  } else {
    parts.push('\n' + rule('-'));
    parts.push(`development-discipline.md — ${disc.text}`);
  }

  // 4b) RULES STORE CATALOG — count in force + drift since last session, from rules.sqlite (the
  // mirror), never PostgreSQL. This is the part a document re-read alone cannot answer (task
  // brief: "how many rules are in force, and what changed since last time"). Guarded like
  // everything else here — a failure anywhere in this block prints its own NA-shaped line and
  // never aborts the rest of the digest.
  parts.push('\n' + rule('-'));
  parts.push('RULES STORE CATALOG (rules.sqlite mirror) — count in force + drift since last session');
  parts.push(rule('-'));
  try {
    const discAbsPath = join(ROOT, 'docs', 'process', 'development-discipline.md');
    const catalog = buildRulesCatalog(discAbsPath);
    parts.push(`SOURCE: ${catalog.sourceNote}`);

    if (catalog.stale.length) {
      parts.push(`  disagreements (mirror hash vs. document hash, first 12 hex chars):`);
      for (const s of catalog.stale.slice(0, 20)) {
        parts.push(`    ~ ${s.rule_id}: mirror=${s.mirrorHash.slice(0, 12)}... doc=${s.docHash.slice(0, 12)}...`);
      }
      if (catalog.stale.length > 20) parts.push(`    ... and ${catalog.stale.length - 20} more`);
    }
    if (catalog.mirrorOnly.length) parts.push(`  in mirror but not in the document: ${catalog.mirrorOnly.slice(0, 20).join(', ')}${catalog.mirrorOnly.length > 20 ? ` (+${catalog.mirrorOnly.length - 20} more)` : ''}`);
    if (catalog.docOnly.length) parts.push(`  in the document but not yet in the mirror: ${catalog.docOnly.slice(0, 20).join(', ')}${catalog.docOnly.length > 20 ? ` (+${catalog.docOnly.length - 20} more)` : ''}`);

    if (catalog.ok) {
      const prior = loadPriorSnapshot();
      const diff = diffAgainstPrior(prior, catalog);
      if (!diff) {
        parts.push('CHANGED SINCE LAST SESSION: no prior snapshot found — this run establishes the baseline.');
      } else if (!diff.added.length && !diff.changed.length && !diff.retired.length) {
        parts.push(`CHANGED SINCE LAST SESSION: none — identical to the snapshot from ${diff.priorGeneratedAt} (${diff.priorCount} rule(s), source: ${diff.priorSource}).`);
      } else {
        parts.push(`CHANGED SINCE LAST SESSION (vs. snapshot from ${diff.priorGeneratedAt}, source: ${diff.priorSource}):`);
        if (diff.added.length) parts.push(`  + added (${diff.added.length}): ${diff.added.join(', ')}`);
        if (diff.changed.length) parts.push(`  ~ changed (${diff.changed.length}): ${diff.changed.join(', ')}`);
        if (diff.retired.length) parts.push(`  - retired (${diff.retired.length}): ${diff.retired.join(', ')} — these rule_ids are gone; do not keep enforcing them from memory.`);
      }
      const persisted = persistSnapshot(catalog);
      if (!persisted) parts.push(`  (note: could not write the snapshot for the NEXT run's diff — ${SNAPSHOT_PATH})`);
    } else {
      parts.push('CHANGED SINCE LAST SESSION: not established — no catalog could be read this run (see SOURCE line above).');
    }
  } catch (e) {
    parts.push(`${NA} — the rules-store catalog step failed (${e.message.split('\n')[0]}). The verbatim sections above are unaffected.`);
  }

  // 4) Everything else in the discipline document — named, not quoted, one line each with why.
  parts.push('\n' + rule('-'));
  parts.push('development-discipline.md — NOT quoted here (named + one-line reason; open the file for these):');
  parts.push(rule('-'));
  const named = [
    ['§0–§2', 'why the doc exists, the skills list, the pipeline', 'stable reference, not implicated in the audit\'s findings'],
    ['§5–§9', 'debugging protocol, failure-mode map, reviewer discipline, retro, settled decisions', 'procedural detail, consulted on-demand (debugging/review), not needed to START a task'],
    ['§12', 'thinking models', 'consulted when a task calls for one, not on every session start'],
    ['§11a', 'testing infrastructure (worker ceiling, port collisions, server restart)', 'only relevant when actually running the suite'],
    ['§13', 'Operating Model — Main vs subagents', 'one-time onboarding content, not a per-task rule'],
    ['§14–§18', 'H8 (full-landing), H9–H12 (summaries/board/status), H13 (recovery gate), H14 (UX report), H15 (model selection)', 'each is a short, already-quotable ruling — CLAUDE.md\'s own loader table already carries a one-line pointer to each'],
  ];
  for (const [id, title, reason] of named) parts.push(`  ${id} — ${title} — ${reason}`);

  parts.push('\n' + rule());
  const bodyText = parts.join('\n');
  const lineCount = bodyText.split('\n').length + 2; // +2 for the footer line and closing rule pushed next
  const byteCount = Buffer.byteLength(bodyText, 'utf8');
  parts.push(`END SESSION-RULES — ${lineCount} lines, ${byteCount}+ bytes total (excl. footer). This is a re-read, not a summary.`);
  parts.push(rule());
  console.log(parts.join('\n'));
}

try {
  main();
} catch (e) {
  console.log(`session-rules: WARN — could not emit the rules digest (${e.message.split('\n')[0]}). Open CLAUDE.md and docs/process/development-discipline.md directly. The compliance gate (check-meta.mjs) is unaffected.`);
}
process.exit(0);
