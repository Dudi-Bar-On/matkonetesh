#!/usr/bin/env node
/* Manage per-user access codes for the managed-AI Worker (writes to the CODES KV).
 *
 * Prereqs: authenticate wrangler once — set CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID)
 * in your env, OR run `npx wrangler login` (from worker/). Run this from the repo root.
 *
 * Usage:
 *   node scripts/central-code.mjs add <label> [capTokens]   mint a code (default cap 2,000,000 tokens; 0 = uncapped)
 *   node scripts/central-code.mjs list                       list stored code keys
 *   node scripts/central-code.mjs show <code>               print one code's record (label / cap / used)
 *   node scripts/central-code.mjs revoke <code>             delete a code (instant lockout)
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
    console.log(`  cap : ${cap ? cap.toLocaleString() + ' tokens' : 'uncapped'}`);
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
  } else {
    console.log('usage: node scripts/central-code.mjs add <label> [capTokens] | list | show <code> | revoke <code>');
  }
} catch (e) {
  console.error('\n✗ failed:', e.message || e);
  console.error('  (is wrangler authenticated — CLOUDFLARE_API_TOKEN set or `npx wrangler login` done?)');
  process.exit(1);
}
