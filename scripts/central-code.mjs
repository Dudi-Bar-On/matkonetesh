#!/usr/bin/env node
/* Manage per-user access codes for the managed-AI Worker (writes to the CODES KV).
 *
 * Prereqs: authenticate wrangler once — set CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID)
 * in your env, OR run `npx wrangler login` (from worker/). Run this from the repo root.
 *
 * Usage:
 *   node scripts/central-code.mjs add <label> [capTokens]   mint a code (default cap 2,000,000 tokens)
 *   node scripts/central-code.mjs list                       list stored code keys
 *   node scripts/central-code.mjs show <code>               print one code's record (label / cap / used)
 *   node scripts/central-code.mjs revoke <code>             delete a code (instant lockout)
 *   node scripts/central-code.mjs audit                     report records the hardened Worker would REFUSE
 *
 * CAP IS MANDATORY (owner ruling, 2026-07-30 · Phase 1 Task 7). The Worker refuses any record whose
 * `cap` is not a positive number with 403 {error:'code_uncapped'} — there is no "cap by omission" and
 * `cap: 0` no longer means "uncapped", it means REFUSED. To grant effectively-unlimited use, mint an
 * explicit high cap instead (e.g. 1000000000). Run `audit` before deploying a hardened Worker.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'worker'); // wrangler.toml lives here
const WRANGLER_JS = join(WORKER_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

// Run wrangler's JS entry directly with node + an ARGUMENT ARRAY (no shell): safe from injection,
// and avoids the Windows quirk where .cmd shims can't be spawned by execFile.
function wr(args) {
  if (!existsSync(WRANGLER_JS)) throw new Error('wrangler not installed — run:  cd worker && npm install');
  return execFileSync(process.execPath, [WRANGLER_JS, ...args], { cwd: WORKER_DIR, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

const [cmd, a, b] = process.argv.slice(2);

try {
  if (cmd === 'add') {
    const label = a || 'user';
    const cap = b == null ? 2_000_000 : parseInt(b, 10);
    // Mint-time guard: the Worker refuses a non-positive cap (403 code_uncapped), so refuse to create
    // a record that is dead on arrival. "Unlimited" is expressed as an explicit high number, not 0.
    if (!Number.isFinite(cap) || cap <= 0) {
      console.error(`\n✗ cap must be a POSITIVE number of tokens (got: ${b}).`);
      console.error(`  'cap: 0' used to mean "uncapped"; since 2026-07-30 the Worker REFUSES such a record.`);
      console.error(`  For effectively-unlimited use, pass an explicit high cap, e.g.:  add ${label} 1000000000\n`);
      process.exit(1);
    }
    const code = randomBytes(9).toString('base64url'); // 12-char URL-safe code
    const rec = JSON.stringify({ u: label, cap, used: 0, active: true, since: new Date().toISOString().slice(0, 10) });
    // pass the JSON value via a temp file (--path) so it's never an argument that needs escaping
    const tmp = join(tmpdir(), `mk-code-${code}.json`);
    writeFileSync(tmp, rec);
    try {
      wr(['kv', 'key', 'put', '--binding', 'CODES', `code:${code}`, '--path', tmp, '--remote']);
    } finally { try { unlinkSync(tmp); } catch {} }
    console.log(`\n✓ minted code for "${label}"`);
    console.log(`  CODE: ${code}`);
    console.log(`  cap : ${cap.toLocaleString()} tokens`);
    console.log(`\nHand this code to the user; they paste it into the app › Manage AI › Central access.\n`);
  } else if (cmd === 'list') {
    console.log(wr(['kv', 'key', 'list', '--binding', 'CODES', '--remote']));
  } else if (cmd === 'show') {
    if (!a) throw new Error('need a code');
    console.log(wr(['kv', 'key', 'get', '--binding', 'CODES', `code:${a}`, '--remote']));
  } else if (cmd === 'revoke') {
    if (!a) throw new Error('need a code');
    wr(['kv', 'key', 'delete', '--binding', 'CODES', `code:${a}`, '--remote']);
    console.log(`✓ revoked ${a} — that user can no longer use central access.`);
  } else if (cmd === 'audit') {
    // Pre-deploy migration check (owner ruling 2026-07-30): find records the hardened Worker refuses —
    // missing/zero/negative/non-numeric cap, or a corrupt (unparseable) record. Prints NO code values
    // in full and never prints a key/secret: codes are masked, only the verdict and cap matter here.
    const keys = JSON.parse(wr(['kv', 'key', 'list', '--binding', 'CODES', '--remote']));
    const bad = [];
    for (const { name } of keys) {
      if (!name.startsWith('code:')) continue;
      const raw = wr(['kv', 'key', 'get', '--binding', 'CODES', name, '--remote']);
      let rec = null; try { rec = JSON.parse(raw); } catch {}
      const cap = rec && rec.cap;
      if (!rec || typeof rec !== 'object') bad.push({ name, why: 'record does not parse → 403 code_record_corrupt' });
      else if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0)
        bad.push({ name, why: `cap=${JSON.stringify(cap)} → 403 code_uncapped`, label: rec.u });
    }
    const mask = (n) => n.slice(0, 5) + '***' + n.slice(-2);   // never echo a full code
    if (!bad.length) {
      console.log(`\n✓ audit clean — all ${keys.length} record(s) carry a positive numeric cap; the hardened Worker accepts them.\n`);
    } else {
      console.log(`\n⚠ ${bad.length} record(s) would be REFUSED after deploying the hardened Worker:\n`);
      for (const b2 of bad) console.log(`  ${mask(b2.name)}${b2.label ? ` (${b2.label})` : ''} — ${b2.why}`);
      console.log(`\nFix each by re-putting the record with an explicit positive cap (e.g. 1000000000 for`);
      console.log(`effectively-unlimited), or revoke it. Do this BEFORE deploying, or those users lose access.\n`);
      process.exitCode = 1;
    }
  } else {
    console.log('usage: node scripts/central-code.mjs add <label> <capTokens> | list | show <code> | revoke <code> | audit');
  }
} catch (e) {
  console.error('\n✗ failed:', e.message || e);
  console.error('  (is wrangler authenticated — CLOUDFLARE_API_TOKEN set or `npx wrangler login` done?)');
  process.exit(1);
}
