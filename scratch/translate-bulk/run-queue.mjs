#!/usr/bin/env node
// run-queue.mjs — sequential ENGLISH-PIVOT bulk-translation queue runner, 23 languages
// (owner ruling 2026-07-26, §10.19 rule 1 "Pivot through English" + owner Turkish addendum). Iterates
// the fixed language order below, calling `node bulk.mjs --lang <X> --pivot` once per language, to
// completion, before moving to the next. STAGING ONLY — this script never calls merge.mjs and never
// touches lang/*.json; the controller reviews + merges each language separately per §10.19 rules 2-3
// (physical Playwright verification + semantic QA) before anything reaches the shipped dictionaries.
//
// This script does NOT self-launch a run — the controller invokes it (as a harness-tracked background
// process, per the owner's instruction, to avoid a detached orphan).
//
//   node run-queue.mjs                    # the real run
//   node run-queue.mjs --dry-run          # print the planned per-language invocations, spawn nothing
//   node run-queue.mjs --model <tag>      # forwarded to every bulk.mjs invocation (default translategemma:27b)
//
// RESUMABLE / IDEMPOTENT (two independent layers):
//   1. This script: a language is recorded as "[queue] done <lang> ..." in PROGRESS.log only once its
//      dry-run-confirmed remaining count is 0 (see below) — a restarted run skips every language
//      already marked done there.
//   2. bulk.mjs itself: --resume (its own default) skips every (section, heKey) pair already present in
//      <lang>.staged.json or <lang>.failed.json — so re-invoking bulk.mjs for a language that was only
//      PARTWAY through when this script stopped is itself a safe no-op/continue, never a redo-from-zero.
// Together: restarting `node run-queue.mjs` from scratch, at any point, is always safe.
//
// COMPLETION IS VERIFIED, NOT ASSUMED. bulk.mjs can exit 0 without having finished a language — its own
// mid-run GPU-CARE check (see below) breaks its internal chunk loop cleanly (exit 0) if a Playwright
// suite appears partway through, leaving real work still remaining. So after every bulk.mjs invocation
// this script runs a fast `--dry-run` pass and only marks a language "done" when that pass reports
// "remaining this run: 0". Trusting the child's exit code alone would have falsely marked an
// interrupted language complete.
//
// GPU CARE back-off (mission brief: a Playwright suite outranks this run). bulk.mjs refuses to start,
// or stops early mid-run, printing "GPU CARE" to stderr in both cases (verified against bulk.mjs's own
// source: "REFUSING TO START: ... per GPU CARE" at start, "STOPPING at chunk boundary: ... (GPU CARE)"
// mid-run). Either shape is NOT a queue failure — this script backs off BACKOFF_MS and retries the SAME
// language, indefinitely. Any OTHER non-zero exit, or an exit-0-but-still-incomplete language with no
// GPU CARE message, is treated as FATAL for the whole queue (stop, don't silently skip a language —
// a silent gap in 23-language coverage is worse than a loud stop the controller can see and resume).
//
// SIGINT: sets a stop flag and forwards the signal to the in-flight bulk.mjs child so it exits promptly;
// no new language is started; this script exits 0 once the child has exited. No teardown of on-disk
// state is needed here — bulk.mjs's own per-chunk checkpointing (writes staged/failed after every
// chunk, never mid-chunk) is what makes an abrupt stop safe; at worst, the current in-flight chunk's
// entries are redone on the next resume (harmless, no corruption, no duplicate output — keyOf() dedup).

import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAUSE_FILE = join(HERE, 'PAUSE');   // owner 2026-07-27: pause/resume sentinel (see queue-ctl.mjs) — stops between languages AND is honored mid-language by bulk.mjs at its chunk boundary
const PROGRESS = join(HERE, 'PROGRESS.log');
const BACKOFF_MS = 30_000;

// The exact 23-language order (owner ruling 2026-07-26 + Turkish addendum at position 19). DO NOT
// reorder without an explicit owner instruction — order here IS the rollout priority.
const QUEUE = [
  'it', 'pt', 'el', 'ja', 'ko', 'th', 'nl', 'hu', 'pl', 'ro', 'vi', 'hi', 'id', 'ru', 'uk',
  'da', 'fi', 'nb', 'tr', 'sv', 'cs', 'ar', 'zh',
];

function parseArgs(argv) {
  const out = { dryRun: false, model: 'translategemma:27b' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--model') out.model = argv[++i];
  }
  return out;
}

function appendProgress(line) {
  appendFileSync(PROGRESS, line + '\n', 'utf8');
}

// Scans PROGRESS.log for prior "[queue] done <lang> ..." lines from earlier runs of THIS script.
function alreadyDoneLangs() {
  if (!existsSync(PROGRESS)) return new Set();
  const text = readFileSync(PROGRESS, 'utf8');
  const done = new Set();
  const re = /^\[queue\] done (\S+) /;
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) done.add(m[1]);
  }
  return done;
}

// Fast, no-model-call check: how many (section, heKey) pairs are still neither staged nor failed for
// this language. Used to VERIFY completion after a bulk.mjs run, never to assume it.
function remainingForLang(lang, model) {
  try {
    const out = execFileSync(process.execPath, ['bulk.mjs', '--lang', lang, '--pivot', '--model', model, '--dry-run'], { cwd: HERE, encoding: 'utf8' });
    const m = out.match(/remaining this run: (\d+)/);
    return m ? parseInt(m[1], 10) : null; // null = unparsable output, caller treats conservatively (fatal)
  } catch (e) {
    return null;
  }
}

let stopping = false;
let currentChild = null;

process.on('SIGINT', () => {
  console.log('\n[queue] SIGINT received — stopping after the current bulk.mjs invocation exits (no new language will be started).');
  stopping = true;
  if (currentChild) currentChild.kill('SIGINT');
});

// Spawns `node bulk.mjs --lang <lang> --pivot --model <model>` to completion for one language.
// stdout is inherited (live progress visible); stderr is BOTH inherited (live visibility) AND captured
// (to detect the "GPU CARE" marker bulk.mjs prints on both its refusal and mid-run-stop paths).
function runBulkForLang(lang, model) {
  return new Promise((resolve) => {
    const args = ['bulk.mjs', '--lang', lang, '--pivot', '--model', model];
    console.log(`[queue] spawning: node ${args.join(' ')}`);
    const child = spawn(process.execPath, args, { cwd: HERE, stdio: ['inherit', 'inherit', 'pipe'] });
    currentChild = child;
    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('exit', (code, signal) => {
      currentChild = null;
      resolve({ code, signal, stderr: stderrBuf });
    });
  });
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const done = alreadyDoneLangs();

  if (args.dryRun) {
    console.log('[queue] --dry-run: planned invocations, in order (nothing spawned):');
    for (const lang of QUEUE) {
      const skip = done.has(lang) ? '  (already marked done in PROGRESS.log — would SKIP)' : '';
      console.log(`  node bulk.mjs --lang ${lang} --pivot --model ${args.model}${skip}`);
    }
    return;
  }

  for (const lang of QUEUE) {
    if (stopping) break;
    if (existsSync(PAUSE_FILE)) { console.log('[queue] ⏸ PAUSED — sentinel present; stopping cleanly between languages. `node queue-ctl.mjs resume` to continue.'); break; }
    if (done.has(lang)) {
      console.log(`[queue] ${lang}: already marked done in PROGRESS.log — skipping.`);
      continue;
    }

    appendProgress(`[queue] start ${lang} ${new Date().toISOString()}`);
    console.log(`[queue] === ${lang} — start ===`);

    let attempt = 0;
    for (;;) {
      if (stopping) break;
      attempt++;
      const t0 = Date.now();
      const { code, signal, stderr } = await runBulkForLang(lang, args.model);
      const elapsedMs = Date.now() - t0;

      // bulk.mjs paused itself at a chunk boundary (sentinel present) → exit 0 but the language is NOT
      // complete. Stop the queue cleanly rather than treating remaining>0 as a reason to retry.
      if (existsSync(PAUSE_FILE)) {
        appendProgress(`[queue] paused ${lang} ${new Date().toISOString()} (chunk boundary, ${elapsedMs}ms)`);
        console.log(`[queue] ⏸ PAUSED mid-${lang} (bulk stopped at a chunk boundary); staging intact. \`node queue-ctl.mjs resume\` to continue.`);
        stopping = true;
        break;
      }

      if (signal === 'SIGINT' || stopping) {
        appendProgress(`[queue] interrupted ${lang} ${new Date().toISOString()} (attempt ${attempt}, ${elapsedMs}ms)`);
        console.log(`[queue] ${lang}: interrupted — will resume this language on the next run.`);
        stopping = true;
        break;
      }

      const gpuCare = /GPU CARE/.test(stderr);
      if (gpuCare) {
        appendProgress(`[queue] backoff ${lang} ${new Date().toISOString()} exit=${code} — retrying in ${BACKOFF_MS / 1000}s (GPU CARE)`);
        console.log(`[queue] ${lang}: GPU CARE — a Playwright suite outranks this run. Waiting ${BACKOFF_MS / 1000}s and retrying...`);
        await delay(BACKOFF_MS);
        continue;
      }

      if (code !== 0) {
        appendProgress(`[queue] FATAL ${lang} ${new Date().toISOString()} exit=${code}`);
        console.error(`[queue] ${lang}: bulk.mjs exited ${code} (no GPU CARE message) — STOPPING the whole queue, not skipping this language. Investigate, then re-run this script — it resumes from ${lang}.`);
        process.exit(1);
      }

      // code === 0, no GPU CARE seen — verify this language is ACTUALLY complete before trusting it.
      const remaining = remainingForLang(lang, args.model);
      if (remaining === 0) {
        appendProgress(`[queue] done ${lang} ${new Date().toISOString()} (attempt ${attempt}, ${elapsedMs}ms)`);
        console.log(`[queue] === ${lang} — done (${(elapsedMs / 1000).toFixed(0)}s) ===`);
        break;
      }

      appendProgress(`[queue] FATAL ${lang} ${new Date().toISOString()} exit=0 but remaining=${remaining ?? 'unparsable'}`);
      console.error(`[queue] ${lang}: bulk.mjs exited 0 but ${remaining ?? '(unparsable dry-run output)'} entries still remain and no GPU CARE message was seen — unexpected. STOPPING for investigation. Re-run this script to resume from ${lang} once resolved.`);
      process.exit(1);
    }
  }

  if (stopping) {
    console.log('[queue] stopped cleanly on SIGINT.');
    process.exit(0);
  }
  console.log('[queue] all 23 languages complete (or already were). Nothing left to run. STAGING ONLY — nothing was merged into lang/*.json; the controller reviews + merges each language per §10.19.');
}

main();
