// queue-ctl.mjs — pause / resume / status for the 23-language translation queue (owner 2026-07-27).
//
// WHY: a full-corpus language is a ~2h GPU run, and per development-discipline §11a a Playwright suite
// must not compete with it for the machine. This lets the controller PAUSE the translation at a safe
// chunk boundary, free the GPU to run the suite / verification / a build, then RESUME with zero lost work.
//
// HOW: a single sentinel file `scratch/translate-bulk/PAUSE`.
//   - bulk.mjs checks it after staging EACH chunk → finishes+stages the chunk, then exits 0 cleanly.
//   - run-queue.mjs checks it between languages AND detects a mid-language pause (bulk exited with the
//     sentinel present) → stops the queue cleanly instead of retrying.
//   Resume is loss-free by construction: bulk.mjs already checkpoints per chunk into <lang>.staged.json
//   and skips already-staged entries on re-run, so continuing picks up at the exact next chunk.
//
// USAGE:
//   node queue-ctl.mjs pause     # create the sentinel — a running queue/bulk stops at its next chunk boundary
//   node queue-ctl.mjs resume    # remove the sentinel + relaunch `node run-queue.mjs` detached (continues the queue)
//   node queue-ctl.mjs resume --no-spawn   # just remove the sentinel (caller relaunches run-queue.mjs itself, e.g. to capture output)
//   node queue-ctl.mjs status    # sentinel state + per-language staged/failed counts + which languages are done
import { existsSync, writeFileSync, unlinkSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAUSE_FILE = join(HERE, 'PAUSE');
const PROGRESS = join(HERE, 'PROGRESS.log');
// the fixed 23-language order (kept in sync with run-queue.mjs QUEUE — order IS the rollout priority)
const QUEUE = ['it','pt','el','ja','ko','th','nl','hu','pl','ro','vi','hi','id','ru','uk','da','fi','nb','tr','sv','cs','ar','zh'];

const cmd = process.argv[2];

function stagedCount(lang, kind) {
  const p = join(HERE, `${lang}.${kind}.json`);
  if (!existsSync(p)) return 0;
  try { return (JSON.parse(readFileSync(p, 'utf8')).entries || []).length; } catch { return 0; }
}
function doneLangs() {
  if (!existsSync(PROGRESS)) return new Set();
  const done = new Set();
  for (const line of readFileSync(PROGRESS, 'utf8').split('\n')) {
    const m = line.match(/^\[queue\] done (\S+) /);
    if (m) done.add(m[1]);
  }
  return done;
}

if (cmd === 'pause') {
  writeFileSync(PAUSE_FILE, new Date().toISOString() + '\n', 'utf8');
  console.log(`⏸ PAUSE requested — sentinel written: ${PAUSE_FILE}`);
  console.log('   A running bulk/queue stops at its next chunk boundary (staging intact). `status` to watch it wind down.');
} else if (cmd === 'resume') {
  if (existsSync(PAUSE_FILE)) { unlinkSync(PAUSE_FILE); console.log('▶ sentinel removed.'); }
  else console.log('▶ no sentinel present (was not paused).');
  if (process.argv.includes('--no-spawn')) {
    console.log('   --no-spawn: not relaunching. Run `node run-queue.mjs` to continue the queue.');
  } else {
    const child = spawn(process.execPath, ['run-queue.mjs'], { cwd: HERE, detached: true, stdio: 'ignore' });
    child.unref();
    console.log(`▶ resumed — run-queue.mjs relaunched detached (pid ${child.pid}). It skips completed languages and resumes the current one at its next chunk.`);
  }
} else if (cmd === 'status') {
  const done = doneLangs();
  console.log(`sentinel: ${existsSync(PAUSE_FILE) ? '⏸ PRESENT (paused / pausing)' : '▶ absent (running or idle)'}`);
  console.log(`done (PROGRESS.log): ${[...done].join(', ') || '(none)'}`);
  console.log('per-language staged / failed:');
  for (const lang of QUEUE) {
    const s = stagedCount(lang, 'staged'), f = stagedCount(lang, 'failed');
    if (s || f || done.has(lang)) console.log(`  ${lang.padEnd(3)} staged ${String(s).padStart(5)} · failed ${String(f).padStart(4)}${done.has(lang) ? ' · DONE' : ''}`);
  }
} else {
  console.log('usage: node queue-ctl.mjs <pause|resume|status> [--no-spawn]');
  process.exit(2);
}
