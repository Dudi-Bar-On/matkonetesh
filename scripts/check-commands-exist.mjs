#!/usr/bin/env node
// check-commands-exist — a command an agent is TOLD to run must still exist to run.
//
// WHY THIS EXISTS. The project's mandatory-read documents (CLAUDE.md, development-discipline.md,
// the two checklists, the task-brief template, .claude/commands/enforce.md, and the
// .serena/memories/* files Serena loads every session) are where an agent learns which commands to
// run. On 2026-08-05 `agent-memory.db`, `scripts/memsync.py`, `scripts/memenrich.py` and
// `scripts/check-memory-fresh.mjs` were deleted and replaced by the geniza. The RULES that used those
// commands stayed correct in spirit — query the store before grepping, keep it fresh — but the
// COMMANDS the docs told an agent to type did not update with them. For a day, the exact documents an
// agent is required to read FIRST handed out three commands that fail with "file not found", and
// nothing in the repo compared the instructions against the filesystem to notice. A rule that names a
// dead script is not a stale detail, it is a broken tool wearing a confident label — and it is the
// first thing a fresh agent (who has no memory of the deletion) will type, in good faith, because the
// document said to.
//
// WHAT IT CHECKS. Scans a fixed list of mandatory-read documents for any reference shaped like
// `python scripts/x.py`, `py -3 scripts/x.py`, `python3 scripts/x.py`, `node scripts/x.mjs`, or
// `bash scripts/x.sh` (backticks around the path are stripped before comparing) and confirms the
// named script exists on disk. A referenced path that does not exist is a FAILURE — this is the exact
// shape of the 2026-08-05 defect.
//
// THE HISTORICAL EXEMPTION. A document is allowed, and expected, to say "this script was deleted" —
// CLAUDE.md line ~199 does exactly that for scripts/memsync.py, and punishing it for naming a script
// it correctly describes as gone would make the gate fight the very sentence that keeps the record
// honest. A reference is exempt when its own line, or any of the 4 lines before it, contains one of:
// נמחק, deleted, Historical, היסטורי, "record of what was done" (case-insensitive for the Latin
// terms). Four lines of lookback covers a marker stated once above a short list of examples, without
// stretching so far back that an unrelated, still-live command underneath a much earlier "Historical"
// heading gets waved through by accident.
//
// LIMITS, stated rather than implied. This only recognises the five runner prefixes above, and only a
// path starting `scripts/` immediately after them — it does not follow a variable, a Makefile target,
// or a script invoked through npm/uv/a shell alias. It does not detect a command that exists but no
// longer does what the surrounding prose claims (that needs a human, or a much deeper check). It does
// not check shell builtins or external CLIs (`gh`, `git`, `npx`, ...) — those are not repo-owned files
// this gate can verify by existsSync, and treating "gh" as a missing script would be a false positive
// on every run.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const rootArg = (() => { const i = argv.indexOf('--root'); return i === -1 ? null : argv[i + 1]; })();
const ROOT = rootArg ?? join(dirname(fileURLToPath(import.meta.url)), '..');
// fail-open on an unreadable override (§10.24):
if (rootArg && !existsSync(ROOT)) {
  console.log(`check-commands-exist: could not read root ${ROOT}. Not blocking.`);
  process.exit(0);
}

const FILES = [
  'CLAUDE.md',
  'docs/process/development-discipline.md',
  'docs/process/checklists/session-start.md',
  'docs/process/checklists/arc-close.md',
  'docs/process/templates/task-brief.md',
  '.claude/commands/enforce.md',
  '.serena/memories/suggested_commands.md',
  '.serena/memories/tech_stack.md',
  '.serena/memories/tooling/serena_usage.md',
];

// `py -3` contains a literal space, so it has to be its own alternative rather than a suffix pattern.
const REF_RE = /\b(?:python3|python|py -3|node|bash)[ \t]+`?(scripts\/[^\s`]+)`?/g;

const HISTORICAL_RE = /נמחק|deleted|historical|היסטורי|record of what was done/i;

function stripTrailingPunctuation(path) {
  return path.replace(/[),.:;'"!?\]]+$/, '');
}

function isExempt(lines, idx) {
  const start = Math.max(0, idx - 4);
  for (let i = start; i <= idx; i++) {
    if (HISTORICAL_RE.test(lines[i])) return true;
  }
  return false;
}

let filesScanned = 0;
let filesSkipped = 0;
const referencedScripts = new Set();
let exemptCount = 0;
const missing = [];

for (const rel of FILES) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.log(`SKIPPED — ${rel} does not exist on disk (not scanned).`);
    filesSkipped++;
    continue;
  }
  filesScanned++;
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(line)) !== null) {
      const scriptPath = stripTrailingPunctuation(m[1]);
      if (isExempt(lines, i)) { exemptCount++; continue; }
      referencedScripts.add(scriptPath);
      if (!existsSync(join(ROOT, scriptPath))) {
        missing.push({ file: rel, line: i + 1, scriptPath, text: line.trim() });
      }
    }
  }
}

console.log(
  `files scanned: ${filesScanned}${filesSkipped ? ` (${filesSkipped} not present, skipped)` : ''} · ` +
    `distinct scripts referenced: ${referencedScripts.size}` +
    (exemptCount ? ` · ${exemptCount} reference(s) exempted as historical mentions` : '')
);
console.log('  detects: a mandatory-read doc telling an agent to run a `python`/`py -3`/`python3`/`node`/`bash scripts/...` command whose target file does not exist');
console.log('  does NOT detect: a command that exists but no longer does what the prose claims, or a shell builtin/external CLI like `gh` or `git`');

if (missing.length) {
  console.log(`\nFAIL: ${missing.length} referenced script(s) do not exist:`);
  for (const m of missing) {
    console.log(`  x ${m.file}:${m.line}  ${m.scriptPath}`);
    console.log(`      ${m.text}`);
  }
  console.log('\n  A mandatory-read document naming a command that fails with "file not found" is a broken');
  console.log('  tool wearing a confident label — fix the doc, or restore the script, before this passes.');
  process.exit(1);
}
console.log('OK - every scripts/ command referenced in a mandatory-read document exists.');
