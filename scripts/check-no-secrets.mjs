#!/usr/bin/env node
// check-no-secrets — no real credential may enter a tracked file.
//
// Added 2026-08-05 after a first attempt at this check CRIED WOLF: it matched
// `POSTGRES_SUPERUSER_PASSWORD=CHANGE_ME_generate_a_random_value` because the PLACEHOLDER is 33
// characters drawn from the same alphabet a real secret uses. It reported "LEAK — STOP" on the
// example file whose whole job is to carry placeholders.
//
// A security check that fires on its own example is worse than no check, because people learn to
// wave it through — which is the review panel's finding wearing a different hat. So this one
// tests the property it is NAMED for: a credential-shaped assignment whose value is both
// high-entropy AND not a known placeholder form.
//
// It cannot catch everything, and says so rather than implying it can: a secret pasted into
// prose, or one that happens to look like a word, will pass. It catches the shape that actually
// leaks — an assignment.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

const PLACEHOLDER = /^(change[-_]?me|replace[-_]?me|x{3,}|your[-_]|<.+>|\$\{.+\}|todo|example|placeholder|dummy|sample|redacted|\*+)/i;

// A value that is CODE is not a value at all — it is a reference to one. Both false positives on
// the first clean run were this shape, and neither was separable by entropy: `process.env.API_KEY`
// scored 3.93 and `++__setLangReqToken` scored 3.68, against a real generated secret at 4.60.
// Raising the threshold would have hidden the difference rather than understood it.
const IS_CODE_REFERENCE = [
  /^process\.env\./,          // process.env.API_KEY
  /^os\.environ/,             // os.environ["..."] / os.environ.get(...)
  /^env\./,                   // env.SECRET
  /^\+\+|^--/,                // ++__setLangReqToken — an increment, not an assignment of a value
  /^(await|new|require|import|function|async|return|this\.|self\.)\b/,
  /^[A-Za-z_$][\w$]*\s*\(/,   // someCall(...)
  /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+;?$/,  // a.b.c — a dotted reference, never a secret
  // PowerShell's own form of the same thing, added 2026-08-08 after this gate blocked a commit over
  // a PowerShell line setting the PGPASSWORD environment variable from another variable holding the
  // superuser password (entropy 3.63) — an assignment whose right-hand side is a
  // VARIABLE, with no value in the file at all. The three PowerShell scripts that reach a privileged
  // role all use this exact line, and it is the correct pattern: read from infra\.env at runtime,
  // set for one call, removed in a finally. A blocking gate that fails on the safe idiom teaches
  // people to work around the gate, which costs more than the false positive itself.
  // Deliberately anchored and bare: `$env:NAME` or `$NAME` and nothing else. A literal cannot hide
  // in it, because anything appended — a concatenation, a quote, a subexpression — fails the anchor
  // and is still inspected.
  /^\$(env:)?[A-Za-z_][\w]*$/,
];

// key = value, where the key names a credential and the value is long enough to be one.
const ASSIGN = /\b([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|APIKEY|API_KEY|PRIVATE_KEY|CREDENTIAL))\s*[=:]\s*['"]?([^\s'"#,;)}\]]{12,})/gi;

// Shannon entropy per character. A generated secret sits near 4.5-5.5; prose, paths and
// placeholders sit well below.
function entropy(s) {
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let h = 0;
  for (const n of Object.values(freq)) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const SKIP_EXT = /\.(png|jpe?g|gif|ico|webmanifest|gz|zip|pdf|db|woff2?|ttf)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

// execFileSync, not execSync: no shell is spawned, so nothing can be interpolated into one.
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const findings = [];
let scanned = 0;
let skipped = 0;

for (const f of files) {
  if (!existsSync(f) || SKIP_EXT.test(f)) { skipped++; continue; }
  try {
    if (statSync(f).size > MAX_BYTES) { skipped++; continue; }
  } catch { skipped++; continue; }

  let text;
  try { text = readFileSync(f, 'utf8'); } catch { skipped++; continue; }
  scanned++;

  for (const m of text.matchAll(ASSIGN)) {
    const key = m[1];
    const value = m[2];
    if (PLACEHOLDER.test(value)) continue;
    if (IS_CODE_REFERENCE.some((re) => re.test(value))) continue;
    const e = entropy(value);
    if (e < 3.6) continue;
    const line = text.slice(0, m.index).split('\n').length;
    findings.push({ f, line, key, e: e.toFixed(2) });
  }
}

console.log(`tracked files scanned: ${scanned} (skipped ${skipped}: binary, oversized or unreadable)`);
console.log('  detects: a credential-named assignment whose value is high-entropy and not a placeholder');
console.log('  does NOT detect: a secret in prose, or one shaped like an ordinary word');

if (findings.length) {
  console.log(`FAIL: ${findings.length} credential-shaped value(s) in tracked files:`);
  for (const x of findings) console.log(`  x ${x.f}:${x.line}  ${x.key}  (entropy ${x.e})`);
  console.log('  Move the value into an ignored .env and leave a placeholder in its place.');
  process.exit(1);
}
console.log('OK - no credential-shaped high-entropy value in any tracked file.');
