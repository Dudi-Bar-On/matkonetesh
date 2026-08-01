#!/usr/bin/env node
// scripts/tests/run-all.mjs — runs every gate-checker self-test and aggregates exit codes.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(DIR)
  .filter(f => f.startsWith('test-') && f.endsWith('.mjs') && f !== 'test-helpers.mjs')
  .sort();
let failed = 0;
for (const f of files) {
  console.log(`\n----- ${f} -----`);
  const r = spawnSync(process.execPath, [join(DIR, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exit(failed ? 1 : 0);
