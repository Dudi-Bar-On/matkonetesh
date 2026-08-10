// scripts/hooks/stop-rules/landed-claim-git.mjs — Arc 2 Phase 4, L64a (2026-08-06, split
// 9.8.26): a claim that a NAMED document landed/was committed is checked against git itself —
// `git cat-file -e HEAD:<path>` (the mechanized `git show HEAD:<path>`) plus a clean
// `git status --porcelain -- <path>`. Presence in the geniza, a search hit, or a quote in a
// commit message is never landing evidence: the geniza ingests from DISK.
//
// SEVERITY: WARN, by OWNER RULING (2026-08-10). The lesson's own text says a "landed" claim git
// does not confirm "is blocked", and the 2026-08-06 incident was substantive — a landed claim
// the owner had no reason to doubt, over a document git had never seen. The owner chose warn
// FIRST anyway: a wrong stop-block silences the assistant's answer entirely. Promotion path
// registered (plan §"Warn-first and the promotion trigger"). Reachable path (§10.24): commit
// the file, or verify against git and restate what git actually confirms.
//
// MASKING PROFILE: keepInlineCode:true — a landed path is usually cited as `docs/x.md`, and the
// default mask would hide the rule's own signal. Fences/blockquotes/quotation spans still
// masked: a landed-claim inside pasted output or quoted lesson text is not this assistant's
// claim (R-133 class — the 4th test above is the acceptance case).
//
// COST: git runs ONLY after LANDED_RE matches — 27 of 9,093 corpus messages (0.3%). Two
// execFileSync calls with 4s timeouts, bounded to 8 distinct paths per message.
//
// FAIL-OPEN: git unavailable/not a repo/timeout → allow (a rule that cannot read its own
// evidence must never fire, warn included). A path OUTSIDE the repo → allow (git cannot judge it).
export const RULE_IDS = ['L64a'];

import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lastAssistantText, maskQuotedProse } from '../lib/claim-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const PATHISH = '((?:[\\w\\-.]+[/\\\\])*[\\w\\-.]+\\.(?:md|py|mjs|js|json|ts|css|html|txt|sql))';
const VERB = '(?:landed|committed|נחת(?:ה|ו)?|הופקד(?:ה|ו)?)';
// Verb and path within 60 chars of each other on ONE LINE, either order. The bounded class
// [^\n]{0,60} crosses everything except the newline it must not cross.
export const LANDED_RE = new RegExp(
  `${VERB}[^\\n]{0,60}?${PATHISH}|${PATHISH}[^\\n]{0,60}?${VERB}`, 'gi');

function toRepoRelative(p) {
  let norm = p.replace(/\\/g, '/').replace(/^\.\//, '');
  if (isAbsolute(norm) || /^[A-Za-z]:\//.test(norm)) {
    const rel = relative(ROOT, norm).replace(/\\/g, '/');
    if (rel.startsWith('..')) return null; // outside the repo — git cannot judge it
    norm = rel;
  }
  return norm;
}

// { confirmed:true } | { confirmed:false, why } | null (git itself unavailable — degrade).
function gitConfirms(relPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${relPath}`],
      { cwd: ROOT, timeout: 4000, stdio: 'pipe' });
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.killed)) return null; // no git / timeout — degrade
    return { confirmed: false, why: `git does not have ${relPath} in HEAD` };
  }
  try {
    const st = execFileSync('git', ['status', '--porcelain', '--', relPath],
      { cwd: ROOT, timeout: 4000, encoding: 'utf8' });
    if (st.trim() !== '') return { confirmed: false, why: `${relPath} has uncommitted changes on disk` };
  } catch {
    return null; // status unreadable — degrade rather than accuse
  }
  return { confirmed: true };
}

export function evaluate(input) {
  if (!input || typeof input !== 'object') {
    return { decision: 'allow', reason: 'L64a degraded: no input — allowing.' };
  }
  const { determined, text } = lastAssistantText(input.transcript_path);
  if (!determined) {
    return { decision: 'allow', reason: 'L64a degraded: no readable assistant reply text — allowing.' };
  }

  const masked = maskQuotedProse(text, { keepInlineCode: true });
  const paths = new Set();
  let m;
  LANDED_RE.lastIndex = 0;
  while ((m = LANDED_RE.exec(masked)) !== null && paths.size < 8) {
    const raw = m[1] || m[2];
    if (raw) {
      const rel = toRepoRelative(raw);
      if (rel) paths.add(rel);
    }
  }
  if (paths.size === 0) {
    return { decision: 'allow', reason: 'no landed/committed claim over a named document — L64a does not apply.' };
  }

  for (const rel of paths) {
    const verdict = gitConfirms(rel);
    if (verdict === null) {
      return { decision: 'allow', reason: 'L64a degraded: git could not be consulted — allowing rather than warning on unreadable evidence.' };
    }
    if (!verdict.confirmed) {
      return {
        decision: 'warn',
        reason: `L64a: הטענה ש-\`${rel}\` נחת אינה מאושרת על-ידי git (${verdict.why}). `
          + 'git הוא עד הנחיתה היחיד: הפקד את הקובץ (commit), או אמת עם '
          + '`git show HEAD:<path>` + `git status --porcelain -- <path>` ונסח מה ש-git באמת מאשר. '
          + 'הימצאות בגניזה או ב-search hit אינה ראיית נחיתה — הגניזה נבלעת מהדיסק.',
      };
    }
  }
  return { decision: 'allow', reason: 'every landed-claimed path is in HEAD with a clean status — L64a satisfied.' };
}
