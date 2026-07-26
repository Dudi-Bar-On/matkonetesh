#!/usr/bin/env node
// merge.mjs — merges scratch/translate-bulk/<lang>.staged.json into lang/<lang>.json + lang/<lang>.data.json.
// Mission Stage 2 (2026-07-26). Read-only on the staged file; NEVER overwrites an existing non-empty
// target value (the seed-preservation rule) — enforced defensively even though buildWorkList's own
// skip rule should already guarantee no staged entry targets an already-seeded key.
//
// Usage: node merge.mjs --lang fr [--dry-run]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const LANG_DIR = join(REPO_ROOT, 'lang');

function parseArgs(argv) {
  const out = { lang: 'fr', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') out.lang = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function nonEmpty(v) { return typeof v === 'string' && v.length > 0; }

const args = parseArgs(process.argv.slice(2));
const stagedPath = join(HERE, `${args.lang}.staged.json`);
const staged = readJson(stagedPath, null);
if (!staged) { console.error(`No staged file at ${stagedPath}`); process.exit(1); }

const chromePath = join(LANG_DIR, `${args.lang}.json`);
const dataPath = join(LANG_DIR, `${args.lang}.data.json`);
const chrome = readJson(chromePath, { __meta__: {}, __units__: {}, __pre__: {}, __html__: {}, __names__: {} });
chrome.__units__ = chrome.__units__ || {};
chrome.__pre__ = chrome.__pre__ || {};
chrome.__html__ = chrome.__html__ || {};
chrome.__names__ = chrome.__names__ || {}; // v268 T8 setup — recipe/category/cut/make names (spec I-D)
const data = readJson(dataPath, {});

const SECTION_TARGET = {
  chrome: (k, v) => { if (!nonEmpty(chrome[k])) chrome[k] = v; },
  chrome_units: (k, v) => { if (!nonEmpty(chrome.__units__[k])) chrome.__units__[k] = v; },
  chrome_pre: (k, v) => { if (!nonEmpty(chrome.__pre__[k])) chrome.__pre__[k] = v; },
  chrome_html: (k, v) => { if (!nonEmpty(chrome.__html__[k])) chrome.__html__[k] = v; },
  names: (k, v) => { if (!nonEmpty(chrome.__names__[k])) chrome.__names__[k] = v; },
  data: (k, v) => { if (!nonEmpty(data[k])) data[k] = v; },
};

let written = 0, skippedAlreadySeeded = 0, unknownSection = 0;
const bySection = {};
for (const e of staged.entries) {
  const setter = SECTION_TARGET[e.section];
  if (!setter) { unknownSection++; continue; }
  const before = e.section === 'chrome' ? chrome[e.he]
    : e.section === 'chrome_units' ? chrome.__units__[e.he]
    : e.section === 'chrome_pre' ? chrome.__pre__[e.he]
    : e.section === 'chrome_html' ? chrome.__html__[e.he]
    : e.section === 'names' ? chrome.__names__[e.he]
    : data[e.he];
  const val = e[args.lang];
  setter(e.he, val);
  bySection[e.section] = (bySection[e.section] || 0) + 1;
  if (nonEmpty(before)) skippedAlreadySeeded++; else written++;
}

console.log(`[merge] lang=${args.lang} staged entries: ${staged.entries.length}`);
console.log(`[merge] by section: ${JSON.stringify(bySection)}`);
console.log(`[merge] written: ${written}, already-seeded (skipped, not overwritten): ${skippedAlreadySeeded}, unknown-section: ${unknownSection}`);

if (args.dryRun) {
  console.log('[merge] --dry-run: not writing files.');
  process.exit(0);
}

// House style for lang/*.json is 1-space indent (see en.json/de.json/es.json/en.data.json) — match it,
// not JSON.stringify's default 2-space, so the diff shows only the actual new entries.
writeFileSync(chromePath, JSON.stringify(chrome, null, 1) + '\n', 'utf8');
writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n', 'utf8');
console.log(`[merge] wrote ${chromePath} and ${dataPath}`);
