#!/usr/bin/env node
// scripts/tests/replay-stop-corpus.mjs — replays every REAL assistant final message from a
// --dump file through ONE stop-rule module's evaluate(), in one process. The prose sibling of
// replay-bash-corpus.mjs (Phase 3): the spec's §3.1 false-alarm bar, mechanized against the
// 9,093 messages this project actually sent, never invented fixtures.
//   node scripts/tests/replay-stop-corpus.mjs <rule.mjs> <messages.jsonl> [--state <sqlite>] [--session <id>]
// Each message is written as a one-entry transcript (timestamp=now, so evidence windows treat it
// as the current turn) and evaluate() is called with the REAL input shape a Stop event carries.
// Default state store is a fresh EMPTY temp sqlite — state-shaped rules exercise their
// no-evidence/degraded path, which is exactly the path a historical corpus can honestly test;
// --state points at a seeded store for targeted state tests.
// Output: one JSON blob; excerpts truncated to 300 chars, reasons to 200. Never redirect to a
// tracked path.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const [rulePath, dumpPath] = args;
if (!rulePath || !dumpPath) {
  console.error('usage: replay-stop-corpus.mjs <rule.mjs> <messages.jsonl> [--state <sqlite>] [--session <id>]');
  process.exit(2);
}
const stateIdx = args.indexOf('--state');
process.env.ENFORCEMENT_STATE_PATH = stateIdx !== -1
  ? args[stateIdx + 1]
  : join(mkdtempSync(join(tmpdir(), 'stop-replay-state-')), 'empty-state.sqlite');
const sessIdx = args.indexOf('--session');
const sessionId = sessIdx !== -1 ? args[sessIdx + 1] : 's-corpus-replay';

const mod = await import(pathToFileURL(rulePath).href);
if (typeof mod.evaluate !== 'function') {
  console.error(`${rulePath} exports no evaluate()`);
  process.exit(2);
}
const transcriptPath = join(mkdtempSync(join(tmpdir(), 'stop-replay-t-')), 'transcript.jsonl');
let total = 0;
let fireCount = 0;
const fires = [];
for (const line of readFileSync(dumpPath, 'utf8').split('\n').filter(Boolean)) {
  let text;
  try { text = JSON.parse(line).text; } catch { continue; }
  if (typeof text !== 'string' || !text) continue;
  total += 1;
  writeFileSync(transcriptPath, JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  }) + '\n');
  const out = await mod.evaluate({
    session_id: sessionId,
    hook_event_name: 'Stop',
    transcript_path: transcriptPath,
    cwd: process.cwd(),
  });
  if (out && typeof out.decision === 'string' && out.decision !== 'allow') {
    fireCount += 1;
    if (fires.length < 200) {
      fires.push({
        excerpt: text.slice(0, 300),
        decision: out.decision,
        reason: String(out.reason ?? '').slice(0, 200),
      });
    }
  }
}
process.stdout.write(JSON.stringify({ total, fireCount, fires }));
