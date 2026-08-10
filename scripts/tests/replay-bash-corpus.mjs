#!/usr/bin/env node
// scripts/tests/replay-bash-corpus.mjs — replays every REAL Bash command from a --dump file
// through ONE rule module's evaluate(), in one process. This is the mechanized form of the
// spec's §3.1 false-alarm bar: a Phase-3 rule is measured against the 6,338 commands this
// project actually ran, not against invented fixtures.
//   node scripts/tests/replay-bash-corpus.mjs <rule-file.mjs> <commands.jsonl>
// stdout: {"total": N, "fireCount": N, "fires": [{command, decision, reason} ... up to 200]}
//
// SECRETS (L39's whole subject): this script never prints a full command on its own — the only
// output is this one JSON blob on stdout, and command text inside it is truncated to 300 chars
// (reason to 200). It does not read env vars, does not echo values, and writes nothing to any
// file. Callers must not redirect stdout to a tracked path.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [rulePath, dumpPath] = process.argv.slice(2);
if (!rulePath || !dumpPath) {
  console.error('usage: replay-bash-corpus.mjs <rule-file.mjs> <commands.jsonl>');
  process.exit(2);
}
const mod = await import(pathToFileURL(rulePath).href);
if (typeof mod.evaluate !== 'function') {
  console.error(`${rulePath} exports no evaluate()`);
  process.exit(2);
}
const lines = readFileSync(dumpPath, 'utf8').split('\n').filter(Boolean);
let total = 0;
let fireCount = 0;
const fires = [];
for (const line of lines) {
  let cmd;
  try { cmd = JSON.parse(line).command; } catch { continue; }
  if (typeof cmd !== 'string') continue;
  total += 1;
  const out = await mod.evaluate({
    session_id: 's-corpus-replay',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    cwd: process.cwd(),
    tool_input: { command: cmd },
  });
  if (out && typeof out.decision === 'string' && out.decision !== 'allow') {
    fireCount += 1;
    if (fires.length < 200) {
      fires.push({
        command: cmd.slice(0, 300),
        decision: out.decision,
        reason: String(out.reason ?? '').slice(0, 200),
      });
    }
  }
}
process.stdout.write(JSON.stringify({ total, fireCount, fires }));
