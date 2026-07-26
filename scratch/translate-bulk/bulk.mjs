#!/usr/bin/env node
// bulk.mjs — bulk he->{fr,de,es} translation runner. Built per the BULK-TRANSLATION mission brief
// (owner ruling 2026-07-25): start with FRENCH, model=translategemma:27b (local ollama), output is
// STAGING ONLY (scratch/translate-bulk/<lang>.staged.json + <lang>.failed.json) — the controller
// merges into lang/ after review. This script commits nothing and never writes lang/ directly.
//
// Reuses the proven harness conventions from scratch/translate-eval/ (translate.mjs / gates.mjs):
//   - Ollama NATIVE /api/chat (never /v1/chat/completions — that endpoint silently ignores
//     options/max_completion_tokens, per this repo's own Ollama research).
//   - The mtTranslate-derived system prompt, variant A, verbatim (only the language name substituted).
//   - Gates from scratch/translate-eval/gates.mjs — the SAME module score.mjs uses ("ONE source",
//     Stage 1 of this mission): mtSafe (fraction-folded), Hebrew-leak, unit-literal (G-T2),
//     safety-lexicon (G-T3).
//
// SOURCE SET (mission Stage 2; extended v268 T8 setup — see "names" below): the Hebrew keys of
// lang/en.json + lang/en.data.json — this app's full translatable set. Six sub-sections, because
// lang/<lang>.json has internal structure:
//   chrome        — en.json's regular (non "__"-prefixed) top-level keys
//   chrome_units  — en.json.__units__ (short UI unit tokens: "min", "kg", "selected", ...)
//   chrome_pre    — en.json.__pre__ (short UI prefix tokens: "Step", "Edition")
//   chrome_html   — en.json.__html__ (contains inline HTML, e.g. "<b>cooking</b>" — the translation
//                   prompt gets an extra clause telling the model to preserve tags verbatim)
//   names         — en.json.__names__ (recipe/category/cut/make display names, he->eng; consumed at
//                   runtime by itemName() reading getDict().__names__[m.heb] directly — spec I-D)
//   data          — en.data.json (the ~3677-entry recipe/content corpus)
// __meta__ is DELIBERATELY EXCLUDED — it is not a Hebrew-keyed translatable dict, it is the target
// language's own descriptor ({name, dir}), already correctly present in every lang/<lang>.json file
// (verified: lang/fr.json.__meta__ = {name:"Français", dir:"ltr"}). There is nothing to translate
// there via the "Hebrew source key -> target value" model this script uses everywhere else.
//
// SKIP RULE: a (section, heKey) pair is skipped if lang/<lang>.json (or .data.json)'s corresponding
// section already has a non-empty value for that key — the 83 existing fr.json seeds are never
// touched or overwritten, per the mission brief.
//
// Usage:
//   node bulk.mjs --lang fr [--model translategemma:27b] [--chunk-size 150] [--chunks N]
//                 [--limit N] [--host http://localhost:11434] [--dry-run] [--no-resume]
//
// --chunks N   stop cleanly after N chunks THIS invocation (for foreground-timeout-bounded runs —
//              re-invoke with the same args, --resume is implicit/default, to continue).
// --limit N    hard cap on total entries considered this invocation (mainly for smoke-testing).
// --dry-run    build the work list, print counts, write nothing, call no model.
// --no-resume  ignore existing staged/failed files and (re)process everything from scratch. Default
//              is to resume: skip any (section, heKey) already recorded in EITHER staged or failed
//              (a deliberate, documented extension of the brief's literal "skip keys already staged" —
//              re-attempting known-failures on every resume would burn GPU time with no stated benefit
//              and would need failed.json dedup logic the brief doesn't specify; --retry-failed exists
//              for the one case where retrying makes sense).
// --retry-failed  also re-attempt (section, heKey) pairs currently in failed.json (implies keeping
//              --resume's skip-staged behavior, just not skip-failed).

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadShippedGuard, mtSafeFolded, hebrewLeak, unitLiteralCheck, safetyLexiconCheck } from '../translate-eval/gates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..'); // scratch/translate-bulk -> repo root
const LANG_DIR = join(REPO_ROOT, 'lang');

const LANGNAME = {
  en: 'English', fr: 'French', de: 'German', es: 'Spanish',
  // 22-lang queue (2026-07-26, ENGLISH-PIVOT mission) + Turkish (owner add, position 19 in the queue):
  it: 'Italian', pt: 'Portuguese', el: 'Greek', ja: 'Japanese', ko: 'Korean', th: 'Thai',
  nl: 'Dutch', hu: 'Hungarian', pl: 'Polish', ro: 'Romanian', vi: 'Vietnamese', hi: 'Hindi',
  id: 'Indonesian', ru: 'Russian', uk: 'Ukrainian', da: 'Danish', fi: 'Finnish',
  nb: 'Norwegian Bokmål', tr: 'Turkish', sv: 'Swedish', cs: 'Czech', ar: 'Arabic',
  zh: 'Chinese (Simplified)',
};

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    lang: 'fr', model: 'translategemma:27b', chunkSize: 150, chunks: Infinity, limit: Infinity,
    host: 'http://localhost:11434', dryRun: false, resume: true, retryFailed: false,
    // ENGLISH-PIVOT (owner instruction, §10.19 rule 1, 2026-07-26): default ON — translate FROM the
    // verified English value, not Hebrew. Escape hatches: --no-pivot or --source he. The staged output
    // stays keyed on the Hebrew (he) string regardless — this flag only changes the model's INPUT text
    // and the system prompt's stated source language; gateCheck always validates against Hebrew (unchanged).
    pivot: true,
    stageSuffix: '', // --stage-suffix <s> -> writes <lang>.<s>.staged.json / <lang>.<s>.failed.json (A/B sampling, never touches the real staging files)
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') out.lang = argv[++i];
    else if (a === '--model') out.model = argv[++i];
    else if (a === '--chunk-size') out.chunkSize = parseInt(argv[++i], 10);
    else if (a === '--chunks') out.chunks = parseInt(argv[++i], 10);
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-resume') out.resume = false;
    else if (a === '--retry-failed') out.retryFailed = true;
    else if (a === '--pivot') out.pivot = true;
    else if (a === '--no-pivot') out.pivot = false;
    else if (a === '--source') out.pivot = (argv[++i] !== 'he'); // --source he == --no-pivot; --source en == --pivot (default)
    else if (a === '--stage-suffix') out.stageSuffix = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usage() {
  console.log('Usage: node bulk.mjs --lang fr [--model translategemma:27b] [--chunk-size 150] [--chunks N] [--limit N] [--host url] [--dry-run] [--no-resume] [--retry-failed] [--pivot|--no-pivot|--source he|en] [--stage-suffix s]');
}

// ── GPU CARE (mission brief): refuse to start if a Playwright suite (headless_shell.exe) is running ──
function headlessShellRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq headless_shell.exe'], { encoding: 'utf8' });
    return /headless_shell\.exe/i.test(out);
  } catch {
    return false; // tasklist itself failing is not grounds to block a run
  }
}

// ── JSON helpers ───────────────────────────────────────────────────────────────────────────────────
function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) {
    throw new Error(`Failed to parse ${path}: ${e.message}`);
  }
}

function nonEmpty(v) { return typeof v === 'string' && v.length > 0; }

// ── Build the work list (mission Stage 2 SOURCE SET + SKIP RULE) ─────────────────────────────────────
function buildWorkList(lang) {
  const en = readJson(join(LANG_DIR, 'en.json'), {});
  const target = readJson(join(LANG_DIR, `${lang}.json`), { __meta__: {}, __units__: {}, __pre__: {}, __html__: {} });
  const enData = readJson(join(LANG_DIR, 'en.data.json'), {});
  const targetData = readJson(join(LANG_DIR, `${lang}.data.json`), {});

  const sections = [
    { id: 'chrome', enObj: Object.fromEntries(Object.entries(en).filter(([k]) => !k.startsWith('__'))), targetObj: Object.fromEntries(Object.entries(target).filter(([k]) => !k.startsWith('__'))), html: false },
    { id: 'chrome_units', enObj: en.__units__ || {}, targetObj: target.__units__ || {}, html: false },
    { id: 'chrome_pre', enObj: en.__pre__ || {}, targetObj: target.__pre__ || {}, html: false },
    { id: 'chrome_html', enObj: en.__html__ || {}, targetObj: target.__html__ || {}, html: true },
    // names — v268 T8 setup (spec §12/I-D): recipe/category/cut/make display names, harvested by the
    // extractor into lang/_extracted.json's __names__ sub-map and copied into en.json.__names__ (he->eng,
    // 24 entries today). itemName() (app.js ~8564) reads getDict().__names__[m.heb] directly for fr/de/
    // es/it — NOT a flat he␟ctx L/t key — so it needs its own section here rather than folding into
    // 'chrome'. merge.mjs writes this section's staged entries into target.__names__[he], mirroring the
    // chrome_units/chrome_pre/chrome_html pattern.
    { id: 'names', enObj: en.__names__ || {}, targetObj: target.__names__ || {}, html: false },
    { id: 'data', enObj: enData, targetObj: targetData, html: false },
  ];

  const work = [];
  for (const s of sections) {
    for (const [heKey, enVal] of Object.entries(s.enObj)) {
      if (nonEmpty(s.targetObj[heKey])) continue; // already translated — the seed-preservation rule
      work.push({ section: s.id, he: heKey, en: enVal, html: s.html });
    }
  }
  return work;
}

// ── Staging/failure file I/O (checkpointing) ──────────────────────────────────────────────────────
// suffix (--stage-suffix) writes <lang>.<suffix>.staged.json / <lang>.<suffix>.failed.json instead of
// the real <lang>.staged.json / <lang>.failed.json — for A/B sampling runs that must never touch the
// real staging files. Empty/falsy suffix (the default, unchanged for every existing invocation) keeps
// the original filenames exactly.
function stagedPath(lang, suffix) { return join(HERE, suffix ? `${lang}.${suffix}.staged.json` : `${lang}.staged.json`); }
function failedPath(lang, suffix) { return join(HERE, suffix ? `${lang}.${suffix}.failed.json` : `${lang}.failed.json`); }
function progressPath(lang) { return join(HERE, 'PROGRESS.log'); }

function loadStagedFailed(lang, suffix) {
  const staged = readJson(stagedPath(lang, suffix), { generatedAt: null, count: 0, entries: [] });
  const failed = readJson(failedPath(lang, suffix), { generatedAt: null, count: 0, entries: [] });
  return { staged, failed };
}

function keyOf(e) { return `${e.section}::${e.he}`; }

function saveStagedFailed(lang, staged, failed, suffix) {
  staged.count = staged.entries.length;
  staged.generatedAt = new Date().toISOString();
  failed.count = failed.entries.length;
  failed.generatedAt = new Date().toISOString();
  writeFileSync(stagedPath(lang, suffix), JSON.stringify(staged, null, 2), 'utf8');
  writeFileSync(failedPath(lang, suffix), JSON.stringify(failed, null, 2), 'utf8');
}

function appendProgress(line) {
  appendFileSync(progressPath(), line + '\n', 'utf8');
}

// ── STAGE 1 RETRY (2026-07-26): per-failure-class prompt tightening ──────────────────────────────────
// Minimal, documented addition. --retry-failed already existed (it re-attempts (section,heKey) pairs
// currently in failed.json). What was missing for a real "retry the 76" pass:
//   1. Per-failure-class prompt emphasis, keyed off the failedGates recorded on the PRIOR attempt
//      (looked up from the failed.json snapshot taken before this run mutates it — see main()).
//   2. A fix for a real bug --retry-failed would otherwise hit: on retry, an entry that fails AGAIN
//      would be double-pushed into failed.entries (the stale record from the prior run was never
//      removed), and one that now PASSES would still show a stale failed.json record too. main() now
//      strips failed.entries for every key about to be retried, before the loop appends fresh outcomes.
//   3. safetyLexicon is a hard exclusion from auto-retry (mission instruction) — those keys are
//      filtered out of `remaining` entirely in main(), so they are never re-sent to the model and their
//      failed.json record is left untouched.
// Gating is untouched — gateCheck()/gates.mjs are byte-identical to the original run.
const RETRY_CLAUSES = {
  mtSafe: 'Render number words exactly as the source writes them: if the Hebrew spells out a number as a word (e.g. "an hour", "a week"), translate it as a word, never as a digit; if the Hebrew already uses a digit, keep the digit. Never convert a word-number to a digit or a digit to a word-number — translate literally, one-for-one.',
  unitLiteral: 'Every unit in the source (hours, minutes, seconds, grams, percent, degrees C/F, etc.) must appear in the translation attached to the exact same number, with no unit added, dropped, or converted to a different unit or measurement system (metric/imperial, °C/°F). Do not add a unit word next to a number that has none in the source.',
  hebrewLeak: 'If the text contains a "→" arrow construct (X → Y), preserve the arrow exactly and translate BOTH sides of it fully into the target language — never leave the Hebrew term before or after the arrow untranslated. Translate every Hebrew word in the input; never echo any Hebrew text back untranslated.',
};

function retryClausesFor(failedGates) {
  const seen = new Set();
  const out = [];
  for (const g of failedGates || []) {
    const c = RETRY_CLAUSES[g];
    if (c && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

// ── Translation call (mirrors scratch/translate-eval/translate.mjs's variant A, adapted) ────────────
// ENGLISH-PIVOT (§10.19 rule 1): when pivot=true, sourceText is the VERIFIED ENGLISH value and the
// system prompt says "from English"; when pivot=false (--no-pivot / --source he), sourceText is the
// Hebrew value and the prompt is the original "from Hebrew" variant-A form, byte-identical to before
// this change. Only the source-language word and the text sent to the model differ between the two —
// everything else (HTML clause, retry clauses, temperature, num_predict) is untouched.
async function translateOne(host, model, langName, sourceText, isHtml, extraClauses = [], pivot = false) {
  let systemPrompt = pivot
    ? `Translate the following English cooking text to ${langName}. Keep ALL numbers, temperatures, times and units EXACTLY as written — never change, add, or drop a number. Reply with ONLY the translation, no notes.`
    : `Translate the following Hebrew cooking text to ${langName}. Keep ALL numbers, temperatures, times and units EXACTLY as written — never change, add, or drop a number. Reply with ONLY the translation, no notes.`;
  if (isHtml) systemPrompt += ' Preserve any HTML tags exactly as written (e.g. <b>...</b>), translating only the text between them.';
  for (const clause of extraClauses) systemPrompt += ' ' + clause;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourceText },
    ],
    stream: false,
    options: { temperature: 0.2, num_predict: 600 },
  };

  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const raw = await res.json();
  return (raw.message && raw.message.content || '').trim();
}

// ── Gate one (he, mt) pair — combines all Stage-1 gates, ONE source (gates.mjs) ──────────────────────
function gateCheck(guard, he, mt, lang) {
  const safe = mtSafeFolded(guard, he, mt);
  const leak = hebrewLeak(mt);
  const unit = unitLiteralCheck(he, mt);
  const lex = safetyLexiconCheck(he, mt, lang);
  const failedGates = [];
  if (!safe) failedGates.push('mtSafe');
  if (leak) failedGates.push('hebrewLeak');
  if (!unit.pass) failedGates.push('unitLiteral');
  if (!lex.pass) failedGates.push('safetyLexicon');
  return {
    pass: failedGates.length === 0,
    failedGates,
    detail: { safe, leak, unit: { pass: unit.pass, mismatches: unit.mismatches }, lex: { pass: lex.pass, failures: lex.failures } },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); process.exit(0); }
  const langName = LANGNAME[args.lang];
  if (!langName) { console.error(`Unknown --lang "${args.lang}". Known: ${Object.keys(LANGNAME).join(', ')}`); process.exit(1); }

  if (headlessShellRunning()) {
    console.error('[bulk] REFUSING TO START: headless_shell.exe is running (a Playwright suite outranks this run, per GPU CARE). Wait for it to finish, then retry.');
    process.exit(1);
  }

  mkdirSync(HERE, { recursive: true });

  const allWork = buildWorkList(args.lang);
  console.log(`[bulk] source set: ${allWork.length} entries need translation (lang=${args.lang}) — source=${args.pivot ? 'en (PIVOT)' : 'he'}${args.stageSuffix ? ` stage-suffix=${args.stageSuffix}` : ''}`);

  const { staged, failed } = args.resume ? loadStagedFailed(args.lang, args.stageSuffix) : { staged: { entries: [] }, failed: { entries: [] } };
  const stagedKeys = new Set(staged.entries.map(keyOf));
  const failedKeys = new Set(failed.entries.map(keyOf));
  // Snapshot of the PRIOR failed.json, taken before this run mutates `failed.entries` — used to (a)
  // look up per-entry failedGates for retry prompt-tightening, (b) find the safetyLexicon hard-exclusion.
  const priorFailedMap = new Map(failed.entries.map((e) => [keyOf(e), e]));
  const priorSafetyLexiconKeys = new Set(
    failed.entries.filter((e) => (e.failedGates || []).includes('safetyLexicon')).map(keyOf)
  );

  let remaining = allWork.filter((e) => {
    const k = keyOf(e);
    if (stagedKeys.has(k)) return false;
    if (failedKeys.has(k) && !args.retryFailed) return false;
    if (args.retryFailed && priorSafetyLexiconKeys.has(k)) return false; // hard exclusion, never auto-retried
    return true;
  });
  if (args.limit < remaining.length) remaining = remaining.slice(0, args.limit);

  if (args.retryFailed) {
    // Remove the stale prior-attempt record for every key about to be retried, so a re-fail doesn't
    // duplicate it and a re-pass doesn't leave a stale failed.json entry behind (see header note above).
    const retryKeySet = new Set(remaining.map(keyOf));
    const before = failed.entries.length;
    failed.entries = failed.entries.filter((e) => !retryKeySet.has(keyOf(e)));
    failedKeys.clear();
    for (const e of failed.entries) failedKeys.add(keyOf(e));
    console.log(`[bulk] --retry-failed: cleared ${before - failed.entries.length} stale failed.json record(s) for keys being retried; ${priorSafetyLexiconKeys.size} safetyLexicon key(s) excluded from retry.`);
  }

  console.log(`[bulk] already staged: ${staged.entries.length}, already failed: ${failed.entries.length}, remaining this run: ${remaining.length}`);

  if (args.dryRun) {
    const bySection = {};
    for (const e of remaining) bySection[e.section] = (bySection[e.section] || 0) + 1;
    console.log('[bulk] dry-run — by section:', JSON.stringify(bySection, null, 2));
    return;
  }

  if (remaining.length === 0) {
    console.log('[bulk] nothing left to do — all source-set entries are staged or failed.');
    return;
  }

  const guard = loadShippedGuard(REPO_ROOT);

  const totalToProcess = allWork.length; // for ETA/denominator in PROGRESS.log ("N/M")
  let chunkIdx = 0;
  let overallStart = Date.now();
  let processedThisRun = 0;

  for (let off = 0; off < remaining.length; off += args.chunkSize) {
    if (chunkIdx >= args.chunks) {
      console.log(`[bulk] reached --chunks limit (${args.chunks}) — stopping cleanly at chunk boundary.`);
      break;
    }
    if (chunkIdx > 0 && headlessShellRunning()) {
      console.error('[bulk] STOPPING at chunk boundary: headless_shell.exe appeared mid-run (GPU CARE). Re-invoke with --resume (default) once clear.');
      break;
    }

    const chunk = remaining.slice(off, off + args.chunkSize);
    const chunkStart = Date.now();
    let chunkPass = 0, chunkFail = 0;

    for (const entry of chunk) {
      const tStart = Date.now();
      let mt = '', error = null;
      const extraClauses = args.retryFailed ? retryClausesFor(priorFailedMap.get(keyOf(entry))?.failedGates) : [];
      // ENGLISH-PIVOT: sourceText is entry.en (verified English) when pivot, else entry.he (unchanged
      // behavior). entry.en is guaranteed non-empty by buildWorkList's own iteration (it IS the value
      // being enumerated from en.json/en.data.json) — the nonEmpty() guard is defensive belt-and-braces,
      // not a known gap. gateCheck below is UNCHANGED — it always validates against entry.he (§10.19:
      // "still gate the target's numbers + safety terms against the Hebrew ground truth").
      const sourceText = (args.pivot && nonEmpty(entry.en)) ? entry.en : entry.he;
      try {
        mt = await translateOne(args.host, args.model, langName, sourceText, entry.html, extraClauses, args.pivot);
      } catch (e) {
        error = String(e && e.message || e);
      }
      const ms = Date.now() - tStart;

      if (error || !mt) {
        failed.entries.push({ section: entry.section, he: entry.he, en: entry.en, mt, failedGates: ['translation_error'], error, ms, pivot: args.pivot });
        failedKeys.add(keyOf(entry));
        chunkFail++;
        continue;
      }

      const gate = gateCheck(guard, entry.he, mt, args.lang);
      if (gate.pass) {
        staged.entries.push({ section: entry.section, he: entry.he, en: entry.en, [args.lang]: mt, ms, pivot: args.pivot });
        stagedKeys.add(keyOf(entry));
        chunkPass++;
      } else {
        failed.entries.push({ section: entry.section, he: entry.he, en: entry.en, mt, failedGates: gate.failedGates, detail: gate.detail, ms, pivot: args.pivot });
        failedKeys.add(keyOf(entry));
        chunkFail++;
      }
      processedThisRun++;
    }

    saveStagedFailed(args.lang, staged, failed, args.stageSuffix);

    const chunkMs = Date.now() - chunkStart;
    const rateSPerStr = chunkMs / 1000 / chunk.length;
    const doneTotal = staged.entries.length + failed.entries.length;
    const remainingAfterThis = totalToProcess - doneTotal;
    const etaSec = Math.round(remainingAfterThis * rateSPerStr);
    const line = `${args.lang}: ${doneTotal}/${totalToProcess} done, ${staged.entries.length} passed, ${failed.entries.length} failed, ${rateSPerStr.toFixed(2)}s/str, ETA ${Math.floor(etaSec / 60)}m${etaSec % 60}s`;
    console.log(`[bulk] chunk ${chunkIdx + 1}: +${chunkPass} pass / +${chunkFail} fail (${(chunkMs / 1000).toFixed(1)}s) — ${line}`);
    appendProgress(line);

    chunkIdx++;
  }

  const overallMs = Date.now() - overallStart;
  console.log(`[bulk] run finished: processed ${processedThisRun} entries in ${(overallMs / 1000).toFixed(1)}s (${chunkIdx} chunk(s)). staged=${staged.entries.length} failed=${failed.entries.length} remaining=${allWork.length - staged.entries.length - failed.entries.length}`);
}

main().catch((e) => { console.error('[bulk] FATAL:', e); process.exit(1); });
