#!/usr/bin/env node
/* Manage per-user access codes for the managed-AI Worker (writes to the CODES KV).
 *
 * Prereqs: `wrangler` installed + logged in (`wrangler login`), run from the repo root.
 *
 * Usage:
 *   node scripts/central-code.mjs add <label> [capTokens]   mint a code (default cap 2,000,000 tokens)
 *   node scripts/central-code.mjs add <label> 0             mint an UNCAPPED code
 *   node scripts/central-code.mjs list                       list stored code keys
 *   node scripts/central-code.mjs show <code>               print one code's record (label / cap / used)
 *   node scripts/central-code.mjs revoke <code>             delete a code (instant lockout)
 *
 * Note: uses wrangler v3+ syntax (`wrangler kv key ...`). Older wrangler uses `kv:key`.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BINDING = 'CODES';
const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'worker'); // wrangler.toml lives here
const isWin = process.platform === 'win32';

function wr(args) {
  return execFileSync(isWin ? 'wrangler.cmd' : 'wrangler', args, { cwd: WORKER_DIR, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

const [cmd, a, b] = process.argv.slice(2);

try {
  if (cmd === 'add') {
    const label = a || 'user';
    const cap = b == null ? 2_000_000 : parseInt(b, 10);
    const code = randomBytes(9).toString('base64url'); // 12-char URL-safe code
    const rec = JSON.stringify({ u: label, cap, used: 0, active: true, since: new Date().toISOString().slice(0, 10) });
    wr(['kv', 'key', 'put', '--binding', BINDING, 'code:' + code, rec, '--remote']);
    console.log(`\n✓ minted code for "${label}"`);
    console.log(`  CODE: ${code}`);
    console.log(`  cap : ${cap ? cap.toLocaleString() + ' tokens' : 'uncapped'}`);
    console.log(`\nHand this code to the user; they paste it into the app › Manage AI › Central access.\n`);
  } else if (cmd === 'list') {
    console.log(wr(['kv', 'key', 'list', '--binding', BINDING, '--remote']));
  } else if (cmd === 'show') {
    if (!a) throw new Error('need a code');
    console.log(wr(['kv', 'key', 'get', '--binding', BINDING, 'code:' + a, '--remote']));
  } else if (cmd === 'revoke') {
    if (!a) throw new Error('need a code');
    wr(['kv', 'key', 'delete', '--binding', BINDING, 'code:' + a, '--remote']);
    console.log(`✓ revoked ${a} — that user can no longer use central access.`);
  } else {
    console.log('usage: node scripts/central-code.mjs add <label> [capTokens] | list | show <code> | revoke <code>');
  }
} catch (e) {
  console.error('\n✗ failed:', e.message || e);
  console.error('  (is wrangler installed + logged in, and the CODES KV id set in worker/wrangler.toml?)');
  process.exit(1);
}
