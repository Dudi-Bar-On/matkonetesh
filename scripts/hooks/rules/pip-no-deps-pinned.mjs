// scripts/hooks/rules/pip-no-deps-pinned.mjs — L55a. `pip install --no-deps` bypasses the
// resolver; a bypass that is not written down is a decision pip silently undoes on the next
// ordinary install. Blocked unless every pin in the command appears in
// requirements-overrides.txt — the file whose entire subject is pins that contradict upstream,
// with the reason written beside each one.
//
// SEVERITY: block, argued (spec §3.2): substance — an undocumented override IS the incident
// (the pin evaporates later with no trace of why it existed). Reachable alternative (§10.24),
// named in the reason: add the pin + its reason to requirements-overrides.txt (and its holding
// test, per that file's own header), or drop --no-deps.
//
// The file is read FRESH on every call (no caching) — same discipline as fix-cycle-limit.mjs
// reading the discipline doc. A missing/unreadable overrides file means NO pin is documented,
// which correctly blocks (this is a case where fail-open would defeat the rule's whole point:
// the block's alternative — write the file — is always reachable).
export const TOOLS = ['Bash'];
export const RULE_IDS = ['L55a'];

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statements, tokenize, stripDataRegions } from '../lib/bash-segments.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PIN = /^[A-Za-z0-9][A-Za-z0-9._[\]-]*==\S+$/;

function isPipInstall(tokens) {
  const head = tokens[0];
  const viaModule = (head === 'python' || head === 'python3' || head === 'py')
    && tokens.includes('-m') && tokens.includes('pip');
  return (head === 'pip' || head === 'pip3' || viaModule) && tokens.includes('install');
}

export async function evaluate(input) {
  if (!input || input.tool_name !== 'Bash') {
    return { decision: 'allow', reason: 'not a Bash tool call' };
  }
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || command.trim() === '') {
    return { decision: 'allow', reason: 'no command text to inspect' };
  }
  for (const st of statements(stripDataRegions(command))) {
    const tokens = tokenize(st);
    if (!isPipInstall(tokens) || !tokens.includes('--no-deps')) continue;
    const rIdx = tokens.indexOf('-r');
    if (rIdx !== -1 && /requirements-overrides\.txt$/.test(tokens[rIdx + 1] || '')) continue;
    let overrides = '';
    try {
      overrides = readFileSync(join(ROOT, 'requirements-overrides.txt'), 'utf8').toLowerCase();
    } catch { /* unreadable = nothing documented — see header */ }
    const pins = tokens.filter((t) => PIN.test(t));
    const undocumented = pins.filter((p) => !overrides.includes(p.toLowerCase()));
    if (pins.length === 0 || undocumented.length > 0) {
      const what = undocumented.length > 0 ? undocumented.join(', ') : 'an unpinned package';
      return {
        decision: 'block',
        reason: `L55a: \`--no-deps\` bypasses the resolver, and ${what} is not documented in `
          + 'requirements-overrides.txt. Add the exact pin there with the reason beside it '
          + "(and its holding test, per that file's own header) — or drop --no-deps and let "
          + 'the resolver do its job.',
      };
    }
  }
  return { decision: 'allow', reason: 'no undocumented --no-deps pin' };
}
