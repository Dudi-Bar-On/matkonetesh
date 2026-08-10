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

// TASK 5B REPAIR (task-5b-repair-report.md), defect 2: the extension alternation used to list
// `js` before `json`. JS regex alternation is FIRST-MATCH, not longest-match — for `_extracted.json`
// the engine matched `js` against the first two characters of `json` and stopped there, capturing
// a nonexistent `_extracted.js`. Every alternative that is a strict prefix of another now sorts
// AFTER the longer one it prefixes (`json` before `js`; `mjs` is unaffected — it does not share a
// prefix with any sibling at position 0).
// The final path segment must now START with a word character OR a dot (dotfiles: `.mcp.json`),
// never a bare hyphen — a filename does not legitimately begin with `-`. Found while writing this
// repair's own tests — the unbounded class let VERB match "landed" as a substring of THIS RULE'S
// OWN filename (`landed-claim-git.mjs`), leaving a hyphen-led remainder ("-claim-git.mjs") for
// PATHISH to (mis)capture as a second, nonexistent path immediately after. Verified against the
// corpus: an earlier word-char-only version of this same guard broke `.mcp.json` (the leading dot
// isn't `\w`, so the captured group silently dropped it, turning a real root-level dotfile into a
// nonexistent `mcp.json`) — `[\w.]` fixes both without reopening the hyphen hole. This only ever
// narrows a match relative to the pre-repair pattern, never widens one.
const PATHISH = '((?:[\\w\\-.]+[/\\\\])*[\\w.][\\w\\-.]*\\.(?:md|py|mjs|json|js|ts|css|html|txt|sql))';
// English verbs must stand alone — not `-`/word-glued into a larger token — on EITHER side.
// Two found-while-testing cases this catches for free, same underlying tightening: (a) THIS
// RULE'S OWN filename (`landed-claim-git.mjs`) false-fired on itself, "landed" glued by a
// hyphen to "-claim-git.mjs"; (b) the hyphenated adjective "repo-committed" (as in "a
// repo-committed documentation file") is not a landing claim at all — "committed" there is
// glued to "repo-" and modifies the noun, not asserting an event. Plain `\b` does not catch
// either: a hyphen already counts as a word-boundary in JS regex, so `\bcommitted\b` still
// matches inside "repo-committed". This only ever narrows a match (declines to match), never
// widens one.
const VERB = '(?:(?<![\\w-])landed(?![\\w-])|(?<![\\w-])committed(?![\\w-])|נחת(?:ה|ו)?|הופקד(?:ה|ו)?)';
// TASK 5B REPAIR, defect 3: a negation within the same proximity window voids the match — "NOT
// yet committed", "never committed", "לא-מופקד" all describe the ABSENCE of a landing, not a
// claim. Bounded to the window itself (same discipline as task-close-summary-shape.mjs's
// NEGATION_GUARD_RE) — this only ever REMOVES a fire, it never adds one.
const NEGATION_GUARD_RE = /\b(?:not|never|isn't|is not|wasn't)\b|(?:^|\s)לא[\s-]|אינ(?:ו|ה)\s/i;
const NEGATION_LOOKBEHIND = 20; // chars checked BEFORE the match start, e.g. "never " + verb
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

// TASK 5B REPAIR, defect 1 (the dominant cause, ~15/27 false alarms): ordinary prose overwhelmingly
// names a file by its BASENAME ("`gates.mjs`"), never its full repo-relative path. `git cat-file -e
// HEAD:<basename>` can only ever resolve a file that sits at the repo ROOT, so every nested file —
// nearly all of them — false-fired even when the claim was completely true. Fix: when a bare
// basename (no `/`) is not found at the repo root, search the TRACKED tree for a unique file ending
// in `/<basename>`. Ambiguous (2+ matches) or zero matches deliberately fall through to the
// original "not in HEAD" verdict — resolving a genuinely ambiguous basename by guessing would trade
// one false-alarm shape for a false-ALLOW shape, which is the one direction this repair must never
// move (a missed real violation is worse than a warn-noise one, same bias task-close-summary-shape's
// guards already commit to). Cached per rule invocation, not per path, since evaluate() calls this
// at most 8 times.
let trackedFilesCache; // undefined = not yet fetched, null = git ls-files failed, else string[]
function trackedFiles() {
  if (trackedFilesCache !== undefined) return trackedFilesCache;
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, timeout: 4000, encoding: 'utf8' });
    trackedFilesCache = out.split('\0').filter(Boolean);
  } catch {
    trackedFilesCache = null;
  }
  return trackedFilesCache;
}

function resolveBasename(basename) {
  const files = trackedFiles();
  if (files === null) return undefined; // git unavailable — caller must degrade
  const matches = files.filter((f) => f.endsWith(`/${basename}`));
  return matches.length === 1 ? matches[0] : null; // null = zero or ambiguous — do not guess
}

// { confirmed:true } | { confirmed:false, why } | null (git itself unavailable — degrade).
function gitConfirms(relPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${relPath}`],
      { cwd: ROOT, timeout: 4000, stdio: 'pipe' });
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.killed)) return null; // no git / timeout — degrade
    if (!relPath.includes('/')) {
      const resolved = resolveBasename(relPath);
      if (resolved === undefined) return null; // git ls-files unavailable — degrade
      if (resolved) return gitConfirms(resolved); // resolved to the one tracked nested path
    }
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
    // TASK 5B REPAIR, defect 3: negation anywhere in the matched span, OR immediately BEFORE it,
    // means the sentence denies landing, not claims it. The lookbehind matters: "never
    // committed" negates the verb from the LEFT, and the VERB-first match form starts its span
    // AT the verb itself — "never" sits outside m[0] entirely unless we also look behind it.
    // Found via corpus replay: "the bundle is rebuilt at deploy, never committed" false-fired
    // without this. This only ever REMOVES a fire.
    const negationWindow = masked.slice(Math.max(0, m.index - NEGATION_LOOKBEHIND), m.index + m[0].length);
    if (NEGATION_GUARD_RE.test(negationWindow)) continue;
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
