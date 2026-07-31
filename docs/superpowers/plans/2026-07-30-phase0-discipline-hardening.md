# Phase 0 — Discipline Hardening · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** להפוך את שערי ה-META של המשמעת מ"נשתדל לזכור" לאכיפה מכנית — חמשת תיקוני האודיט (L23–L27, רענון גרף, פסיקת H7, אשרור חילוצים, שלמות-תוכנית) + כתיבת H7..H12 אל תוך `docs/process/development-discipline.md` + תיקון H-9 — בלי לגעת בשורת קוד אפליקציה אחת.

**Architecture:** שלוש שכבות: (1) **סקריפטים** — ארבעה סקריפטי Node ללא תלויות (`check-plan-complete` · `check-graph-fresh` · `gate-lessons` · העוטף `check-meta` עם בדיקת no-unlanded-items של H8), מחווטים ל-`package.json` ("meta") ול-`sync-docs.sh`; (2) **מסמך המשמעת** — עריכות כירורגיות (old→new מדויקים) שמטמיעות את פסיקות H7..H12 ואת לקחים L23–L27 כך שכל subagent יורש אותם דרך `CLAUDE.md`→discipline; (3) **קבצי-לוואי** — צ'קליסטים (session-start / arc-close), חוזה סלקטורים (הכלל; החוזה המלא ב-Phase 3), תבנית brief, ותיקון H-9 ב-`docs/ai-strategy.md`. הסגירה: רענון גרף `--mode deep` (53 מסמכים) עד ש-`check-meta` ירוק, סוויטה ×1, עדכון STATUS-BOARD ו-push.

**Tech Stack:** Node.js ‏ESM (`.mjs`, אפס תלויות — כמו `serve.js`) · bash (‏`sync-docs.sh`) · Markdown · graphify (‏`/graphify docs --update --mode deep`) · Playwright (סוויטת האימות בסגירה בלבד).

**Spec inputs (מקורות המפרט — כל משימה מצטטת מהם):**
- `docs/process/METHODOLOGY-2026-07-30.md` — §3.1–§3.6 (המנגנונים), §4 (טבלת התוצרים), §5 (13 עריכות ה-discipline), §2.2–§2.3 (חוזה ה-brief + תקרת המקבילות).
- `docs/process/COMPLIANCE-AUDIT-2026-07-30.md` — "The five fixes" + סעיפים 1, 3, 7, 9, 10, 12.
- `docs/ROADMAP-2026-07-30.md` — שורת Phase 0 (§1) + פרוטוקול הניהול (§0) + המרשם (§5).
- `docs/research/v5-engine/DECISION-REGISTER.md` — נוסחי H7..H12 המדויקים (בלוק H).

---

## Global Constraints — חלים על כל משימה, במשתמע

1. **אין שינוי קוד אפליקציה.** ‏`app.js`, ‏`build.py`, ‏`worker/`, ‏`equipment.js`, ‏`serve.js` — לא נוגעים. Phase 0 = docs + scripts בלבד (ROADMAP §1: "אין שינוי קוד אפליקציה (releasable טריוויאלית, נשארים v277)"). אין bump גרסה — הרישום בסגירה: **"v277 · docs-only"**.
2. **כל סקריפט = Node ללא תלויות.** ‏ESM ‏(`.mjs`), ‏`node:`-builtins בלבד, רץ עם `node scripts/<name>.mjs` על Node שכבר בשימוש בפרויקט. שום `npm install`.
3. **מוסכמת שמות (הוראת בעלים, ROADMAP כותרת):** מזהים ומספור באנגלית — Task 1, Phase 0, H7, DoD-12; גוף טקסט עברית במסמכים העבריים; `development-discipline.md` ו-`§11` נכתבים באנגלית (שפת המסמך הקיים).
4. **DoD מלא חל (discipline §3), בהתאמות ל-docs/scripts:** ‏RED לסקריפטים = ריצה שנצפית **נכשלת** על fixture/מצב-רפו אמיתי לפני שהתיקון קיים (פלט מודבק בדוח); עריכות-מסמך מאומתות ב-**grep-back** (המחרוזת החדשה נמצאת, הישנה איננה); DoD-8/9 (צילומים) לא רלוונטיים — אין UI; DoD-10 (Safety invariance) מתקיים טריוויאלית — אין נגיעה בקוד, וכל משימה מצהירה זאת.
5. **H9 — חוזה דוח לכל implementer (חובה, פסיקת בעלים 30.7):** כל דוח משימה (`.superpowers/sdd/phase0-task-N-report.md`) מסתיים בטבלה בת 5 שורות — **מה היה · מה נעשה (+ראיות: קומיט/פלט/קבצים) · מה נשאר · איפה אנחנו (Phase 0, משימה N/6 + מרשם 17/156→) · הבא בתור**. דוח בלי הטבלה = דוח פסול, המשימה לא נסגרת. ה-Main מאמת ב-diff עצמאי.
6. **תקרת מקבילות (METHODOLOGY §2.3):** ברירת מחדל סדרתית; ≤3 סוכנים קלים; תקרה קשיחה 5; **סוכן כבד אחד לכל היותר** בזמן ריצת סוויטה או רענון גרף. משימות תוכנית זו רצות **סדרתית** (יש ביניהן תלות: 1→2, 1→5, 1..5→6).
7. **סוויטה פעם אחת בלבד, בסגירת ה-Phase (H7):** אין קוד אפליקציה שהשתנה — ריצת `npx playwright test` יחידה ב-Task 6 מְאַשְׁרֶרֶת שהרפו נשאר ירוק. לא מריצים סוויטה באף משימה אחרת, ולא במקביל לרענון הגרף (§11a).
8. **סודות:** אף מפתח לא נכנס לרפו, לדוחות או לפלטי סקריפטים.
9. **Co-Authored-By:** מחרוזת המודל שה-session מצהיר, כלשונה (בסביבה הזו: `Claude Fable 5 <noreply@anthropic.com>`) — לא מנוחשת ולא מועשרת.

**סדר המשימות — סטייה מוצהרת מהפריסה שהוצעה:** הסקריפטים (Task 1) קודמים ל-backfill הלקחים (Task 2), כדי ש-RED של `gate-lessons` ייצפה על **מצב הרפו האמיתי** (L22 מ-24.7 מול חמישה-עשר `release(v` מ-27.7) ולא על fixture מלאכותי. GREEN של `check-graph-fresh` נדחה בכוונה ל-Task 5 (הרענון עצמו) — RED שלו נצפה ב-Task 1 ונשאר אדום עד אז, בידיעה.

---

## File Structure

| קובץ | פעולה | אחריות |
|---|---|---|
| `scripts/check-plan-complete.mjs` | Create (Task 1) | שער שלמות-תוכנית: בלוקי-קוד פר-`## Task` > 0, גלאי קטיעה בתוך fence |
| `scripts/check-graph-fresh.mjs` | Create (Task 1) | ‏mtime של `docs/**/*.md` מול חותמת `graphify-out/graph.json` |
| `scripts/gate-lessons.mjs` | Create (Task 1) | ‏L אחרון ב-§11 מול קומיטי `release(v` מאז; חוסם release ללא לקח/הצהרה |
| `scripts/check-meta.mjs` | Create (Task 1) | עוטף את השלושה + בדיקת no-unlanded-items ‏(H8) על מרשם ה-ROADMAP |
| `package.json` | Modify (Task 1) | סקריפט `"meta"` |
| `scripts/sync-docs.sh` | Modify (Task 1) | מריץ `check-graph-fresh` לפני push של docs |
| `docs/process/development-discipline.md` | Modify (Tasks 2–3) | ‏L23–L27 ל-§11; ‏11 עריכות H7..H12 + §10.5a + §7 + §10.10 + Operating Model |
| `docs/process/checklists/session-start.md` | Create (Task 4) | ‏5 שורות METHODOLOGY §3.3 |
| `docs/process/checklists/arc-close.md` | Create (Task 4) | צ'קליסט סגירת קשת/Phase |
| `tests/selector-contract.md` | Create (Task 4) | הכלל + זרע; החוזה המלא = Phase 3 (Dec-H4) |
| `docs/process/templates/task-brief.md` | Create (Task 4) | תבנית brief מחייבת (שדות א–ה + טבלת H9) |
| `CLAUDE.md` | Modify (Task 4) | בלוק session-start קומפקטי + שורת arc-close |
| `docs/ai-strategy.md` | Modify (Task 4) | תיקון H-9 (שורה ~77, "Nobody owns") |
| `graphify-out/graph.json` (+מניפסט) | Regenerate (Task 5) | רענון `--mode deep`, ‏53 מסמכים + קשת v5-engine |
| `docs/STATUS-BOARD.md` | Modify (Task 6) | ‏Phase 0 → ✅ ‏"v277 · docs-only · תאריך+שעה" ‏(H10c), מרשם 19/156 |

---

## Task 1 — ארבעת סקריפטי האכיפה + החיווט (audit fix #5 + #2 + #1 + H8)

**Spec lines (DoD-1):** METHODOLOGY §3.1 שורות 1–2, 5: *"`scripts/gate-lessons.mjs`: מדפיס את ה-L האחרון + תאריכו, סופר קומיטי `release(v` מאז; חוסם"* · *"`scripts/check-graph-fresh.mjs`: משווה mtime של `docs/**/*.md` מול חותמת בניית `graphify-out/graph.json` ... נכשל אם יש; מחווט ל-`sync-docs.sh`"* · *"`scripts/check-plan-complete.mjs <plan.md>`: מפרק לפי כותרות `## Task`, סופר בלוקי-קוד מגודרים פר-משימה, נכשל על 0 או על קובץ שמסתיים בתוך fence"* · §3.3: *"`scripts/check-meta.mjs` — עוטף ... + בדיקת no-unlanded-items (H8, סעיף 3.4)"* · §3.4: *"כל מזהה פער במרשם חייב למפות לפאזה נקובה או לדחייה מעוגנת-טריגר; כל מצב אחר — exit nonzero."*

**Files:**
- Create: `scripts/check-plan-complete.mjs`, `scripts/check-graph-fresh.mjs`, `scripts/gate-lessons.mjs`, `scripts/check-meta.mjs`
- Modify: `package.json` (בלוק `scripts`), `scripts/sync-docs.sh` (לפני שלב ה-push)

**Interfaces (Produces):** ארבע נקודות-כניסה CLI, קוד יציאה 0/1 (2 = שגיאת שימוש):
`node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]` · `node scripts/check-graph-fresh.mjs` · `node scripts/gate-lessons.mjs` · `node scripts/check-meta.mjs` (עוטף; מכבד `ROADMAP=<path>` לבדיקה על fixture) · `npm run meta`. ‏Task 2 צורך את `gate-lessons`; ‏Task 5 צורך את `check-graph-fresh`; ‏Task 6 צורך את `check-meta`.

**Fixtures קיימים ומאומתים (נבדקו בזמן כתיבת התוכנית):** `scratch/cp2/draft-v1-REJECTED.md` — ‏10 משימות, **6 מהן עם 0 בלוקי-קוד** (הקטיעה האמיתית; ה-fences שלו מוזחים — הסקריפט חייב לקבל `^[ \t]*```‎`) → חייב FAIL. ‏`docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md` — ‏11 משימות, מינימום 16 בלוקים למשימה, ‏300 fences זוגי → חייב PASS.

- [ ] **Step 1: כתיבת `scripts/check-plan-complete.mjs`** — התוכן המלא:

```js
#!/usr/bin/env node
// scripts/check-plan-complete.mjs — mechanical plan-completeness gate (Phase 0, audit fix #5; lesson L27).
// A generated plan is never submitted to review before this exits 0 (discipline §2).
// Detects the CP2 failure shape: tasks with zero fenced code blocks, and a file truncated inside a fence.
// Usage: node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/check-plan-complete.mjs <plan.md> [--min-blocks N]'); process.exit(2); }
const mi = args.indexOf('--min-blocks');
const MIN = mi >= 0 ? Number(args[mi + 1]) || 1 : 1;

let text;
try { text = readFileSync(file, 'utf8'); }
catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(2); }

const lines = text.split(/\r?\n/);
const FENCE = /^[ \t]*```/;            // fences may be indented (the rejected CP2 draft indents them)
const TASK = /^#{2,3}\s+Task\s+\d+/;   // "## Task N" or "### Task N"

const tasks = [];
let cur = null, fenceOpen = false, totalFences = 0;
for (let i = 0; i < lines.length; i++) {
  if (FENCE.test(lines[i])) {
    totalFences++; fenceOpen = !fenceOpen;
    if (fenceOpen && cur) cur.blocks++;
    continue;
  }
  if (!fenceOpen && TASK.test(lines[i])) {
    cur = { title: lines[i].trim(), line: i + 1, blocks: 0 };
    tasks.push(cur);
  }
}

const fail = [];
if (tasks.length === 0) fail.push('no "## Task N" headings found — not a plan, or headings malformed');
if (fenceOpen || totalFences % 2 === 1) fail.push('file ENDS INSIDE a code fence — truncation signature');
for (const t of tasks) if (t.blocks < MIN)
  fail.push(`line ${t.line}: "${t.title.slice(0, 70)}" — ${t.blocks} code block(s) < ${MIN} (prose-only task = the CP2 truncation shape)`);

console.log(`plan: ${file}`);
console.log(`tasks: ${tasks.length} · fenced blocks: ${tasks.reduce((s, t) => s + t.blocks, 0)} · fence lines: ${totalFences}`);
for (const t of tasks) console.log(`  ${String(t.blocks).padStart(3)} block(s) · line ${t.line} · ${t.title.slice(0, 80)}`);
if (fail.length) { console.error('\nFAIL:'); for (const f of fail) console.error('  x ' + f); process.exit(1); }
console.log('OK - every task carries code, no truncation signature.');
```

- [ ] **Step 2: הרצת RED/GREEN של `check-plan-complete` על שני ה-fixtures** (זהו ה-RED-witness של הסקריפט — כישלון על הטיוטה הקטועה האמיתית):

```bash
node scripts/check-plan-complete.mjs scratch/cp2/draft-v1-REJECTED.md; echo "exit=$?"
# Expected: FAIL, exit=1 — לפחות 6 שורות "0 code block(s)" (Tasks 4,6,7,8,9,10)
node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md; echo "exit=$?"
# Expected: OK, exit=0 — 11 tasks, כל אחת ≥16 בלוקים
node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-07-30-phase0-discipline-hardening.md; echo "exit=$?"
# Expected: OK, exit=0 — התוכנית הזו עוברת את השער של עצמה
```

שלושת הפלטים + קודי היציאה מודבקים בדוח.

- [ ] **Step 3: כתיבת `scripts/check-graph-fresh.mjs`** — התוכן המלא:

```js
#!/usr/bin/env node
// scripts/check-graph-fresh.mjs — §10.12 enforcement (Phase 0, audit fix #2).
// Compares the mtime of every docs/**/*.md against the build stamp of graphify-out/graph.json.
// Prints the stale list and exits 1 if any doc is newer than the graph (or the graph is missing).
// HONEST LIMIT: mtime is a same-machine, same-session heuristic. A fresh clone / branch checkout
// refreshes mtimes and can FALSE-POSITIVE; it can never silently pass a doc edited after the build.
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
// GRAPH_REPORT.md is COPIED from graphify-out AFTER every build (sync-docs.sh step 2),
// so its mtime is legitimately newer than graph.json — excluded by design.
const EXCLUDE = new Set(['docs/analysis/graph/GRAPH_REPORT.md']);

function* mdFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* mdFiles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

if (!existsSync(GRAPH)) {
  console.error('FAIL: graphify-out/graph.json is missing - no local graph at all.');
  console.error('  run the skill flow:  /graphify docs --update --mode deep   (always deep, §10.12)');
  process.exit(1);
}
const stamp = statSync(GRAPH).mtimeMs;
let scanned = 0;
const stale = [];
for (const f of mdFiles(join(ROOT, 'docs'))) {
  const rel = relative(ROOT, f).replaceAll('\\', '/');
  if (EXCLUDE.has(rel)) continue;
  scanned++;
  const m = statSync(f).mtimeMs;
  if (m > stamp) stale.push({ rel, m });
}
console.log(`graph stamp: ${new Date(stamp).toISOString()} · docs scanned: ${scanned}`);
if (stale.length) {
  stale.sort((a, b) => b.m - a.m);
  console.error(`FAIL: ${stale.length} document(s) newer than the graph:`);
  for (const s of stale) console.error(`  x ${new Date(s.m).toISOString().slice(0, 16)}  ${s.rel}`);
  console.error('  run:  /graphify docs --update --mode deep   (chunk by ~12k words, §10.12)');
  process.exit(1);
}
console.log('OK - graph is fresh (no doc newer than the build stamp).');
```

- [ ] **Step 4: הרצת RED של `check-graph-fresh` על הרפו האמיתי** — הגרף מ-25.7, ‏~53 מסמכים חדשים ממנו:

```bash
node scripts/check-graph-fresh.mjs; echo "exit=$?"
# Expected: FAIL, exit=1 — רשימת מסמכים סוטים (ובהם ROADMAP-2026-07-30.md,
# METHODOLOGY-2026-07-30.md, docs/research/v5-engine/*, STATUS-BOARD.md). פלט מודבק בדוח.
# GREEN של הסקריפט הזה מגיע רק ב-Task 5 (הרענון) — במכוון.
```

- [ ] **Step 5: כתיבת `scripts/gate-lessons.mjs`** — התוכן המלא:

```js
#!/usr/bin/env node
// scripts/gate-lessons.mjs — §10.16 enforcement (Phase 0, audit fix #1).
// Prints the last dated §11 lesson; counts release(v commits since; FAILS when releases shipped
// after the newest lesson/declaration date - the "closed arc without an L-entry" drift (audit §9).
// Explicit no-lesson escape (visible, in the doc itself, inheritable by subagents):
//   a §11 line of the form  **No-lesson declaration (YYYY-MM-DD):** <arc> — reason
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = process.env.DISCIPLINE || join(ROOT, 'docs', 'process', 'development-discipline.md');
const text = readFileSync(DOC, 'utf8');

// Dated prose lessons: "**L14 · <title> ... (2026-07-21).**" — the format used from L14 on.
// NOTE: titles WRAP across lines (L21/L22 carry their date on the wrapped second line), and some
// carry a prefix inside the parens ("(v255, 2026-07-21)") — so: find each "**LNN ·" opener, take
// the text up to the closing "**", and extract the first ISO date anywhere inside that title.
const dated = [];
{
  const re = /\*\*L(\d+)\s*·/g;
  let m;
  while ((m = re.exec(text))) {
    const close = text.indexOf('**', re.lastIndex);
    const title = text.slice(re.lastIndex, close === -1 ? re.lastIndex + 400 : close);
    const d = title.match(/(\d{4}-\d{2}-\d{2})/);
    if (d) dated.push({ n: +m[1], date: d[1] });
  }
}
const decls = [...text.matchAll(/\*\*No-lesson declaration \((\d{4}-\d{2}-\d{2})\)/g)].map(m => m[1]);
if (!dated.length) { console.error('FAIL: no dated L-entries found in §11.'); process.exit(1); }

const last = dated.reduce((a, b) => (b.n > a.n ? b : a));
const cover = [last.date, ...decls].sort().at(-1);
console.log(`last lesson: L${last.n} (${last.date}) · declarations: ${decls.length} · coverage date: ${cover}`);

const log = execSync('git log -n 500 --pretty=%cs%x09%s', { cwd: ROOT, encoding: 'utf8' });
const uncovered = log.split('\n').filter(Boolean)
  .map(l => { const i = l.indexOf('\t'); return { d: l.slice(0, i), s: l.slice(i + 1) }; })
  .filter(c => /release\(v\d+/.test(c.s) && c.d > cover);
console.log(`release(v commits dated after ${cover}: ${uncovered.length}`);
for (const c of uncovered.slice(0, 15)) console.log(`  ${c.d}  ${c.s.slice(0, 90)}`);

if (uncovered.length) {
  console.error(`\nFAIL: ${uncovered.length} release(s) shipped after the last lesson/declaration.`);
  console.error('  Write the arc\'s L-entries into discipline §11, or add an explicit line:');
  console.error('  **No-lesson declaration (YYYY-MM-DD):** <arc name> — no new lesson, reviewed.');
  process.exit(1);
}
console.log('OK - no release without lesson coverage.');
```

- [ ] **Step 6: הרצת RED של `gate-lessons` על הרפו האמיתי** — ‏L22 מ-2026-07-24, ‏חמישה-עשר `release(v` מ-2026-07-27:

```bash
node scripts/gate-lessons.mjs; echo "exit=$?"
# Expected: FAIL, exit=1 — "last lesson: L22 (2026-07-24)" + רשימת קומיטי release(v263..v277)
# מ-27.7. זהו ה-RED האמיתי של Task 2 (ה-backfill יהפוך אותו ל-GREEN). פלט מודבק בדוח.
```

- [ ] **Step 7: כתיבת `scripts/check-meta.mjs`** — התוכן המלא (העוטף + H8):

```js
#!/usr/bin/env node
// scripts/check-meta.mjs — the single META entry point (METHODOLOGY §3.3 + §3.4 / H8).
// Wraps: check-graph-fresh · gate-lessons · no-unlanded-items (H8, over the ROADMAP §5 ledger).
// Runs at: session start · from sync-docs.sh before a docs push · before any release(v commit ·
//          EVERY Phase gate and EVERY arc close (H8 duty).
// Env: ROADMAP=<path> targets a fixture copy for self-tests.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failed = [];

function run(name, file) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', file)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(name);
}
run('check-graph-fresh', 'check-graph-fresh.mjs');
run('gate-lessons', 'gate-lessons.mjs');

console.log('\n=== no-unlanded-items (H8) ===');
const roadPath = process.env.ROADMAP || join(ROOT, 'docs', 'ROADMAP-2026-07-30.md');
const road = readFileSync(roadPath, 'utf8');
const errs = [];

// 1) Ledger table (§5): every data row must name its landing in column 1.
const sec5 = road.split(/^## 5 · /m)[1]?.split(/^## /m)[0] ?? '';
if (!sec5) errs.push('ledger section "## 5 · " not found in the roadmap');
const rows = sec5.split('\n').filter(l =>
  l.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(l) && !/^\|\s*Phase\s*\|/.test(l));
for (const r of rows) {
  const phase = (r.split('|')[1] ?? '').trim();
  if (!/^(Phase\s*\S|Language Thread|Sync Thread|בסיס)/.test(phase))
    errs.push(`ledger row without a named phase: "${r.slice(0, 70)}"`);
}
if (!errs.length && rows.length < 10) errs.push(`suspiciously few ledger rows (${rows.length}) - table malformed?`);

// 2) The trigger-anchored remainder: every remainder bullet must state its trigger (H8-ב).
const rest = sec5.split('הנותרים')[1] ?? '';
const bullets = rest.split('\n').filter(l => /^- /.test(l));
if (!bullets.length) errs.push('no remainder bullets found after "הנותרים" in §5');
for (const b of bullets) if (!b.includes('טריגר')) errs.push(`remainder item without a trigger: "${b.slice(0, 70)}"`);

// 3) Forbidden states anywhere in the ledger section.
for (const bad of ['נדחה בלי מועד', 'לא מטופל', 'TBD']) if (sec5.includes(bad)) errs.push(`forbidden marker in ledger: "${bad}"`);

// 4) The roadmap's own H8 assertion must still hold.
if (!road.includes('0 פריטים ללא נחיתה')) errs.push('the roadmap no longer asserts "0 פריטים ללא נחיתה"');

if (errs.length) { for (const e of errs) console.error('  x ' + e); failed.push('no-unlanded-items'); }
else console.log(`OK - ${rows.length} ledger rows land in named phases; ${bullets.length} remainder item(s) trigger-anchored.`);

if (failed.length) { console.error(`\nMETA GATE FAIL: ${failed.join(', ')}`); process.exit(1); }
console.log('\nMETA GATE OK');
```

- [ ] **Step 8: self-test של בדיקת ה-H8 — PASS על ה-ROADMAP האמיתי, FAIL על fixture מושחת:**

```bash
# 8a. build a corrupted fixture (a row landing nowhere + a trigger-less remainder bullet)
SCRATCH="${TMPDIR:-/tmp}/h8-fixture.md"
sed -e 's/^| Phase 11 |/| ??? |/' \
    -e 's/^- \*\*D6\*\* (committed-later, Dec-D7) — \*\*טריגר: השלמת S1 ב-Sync Thread.\*\*$/- **D6** (committed-later) — יטופל בהמשך./' \
    docs/ROADMAP-2026-07-30.md > "$SCRATCH"
ROADMAP="$SCRATCH" node scripts/check-meta.mjs; echo "exit=$?"
# Expected: no-unlanded-items מדווח לפחות שתי שגיאות (row without phase + item without trigger), exit=1
# 8b. the real roadmap must pass the H8 section (the wrapper still exits 1 on graph/lessons - expected until Tasks 2+5)
node scripts/check-meta.mjs; echo "exit=$?"
# Expected NOW: "OK - ... ledger rows land in named phases" בסעיף ה-H8; exit=1 כולל (graph+lessons עדיין אדומים - מוצהר)
rm -f "$SCRATCH"
```

שני הפלטים מודבקים בדוח, עם ההצהרה המפורשת שה-exit הכולל אדום בגלל graph+lessons בלבד.

- [ ] **Step 9: חיווט `package.json`** — עריכה מדויקת. old:

```json
  "scripts": {
    "test": "playwright test",
    "eval": "playwright test --config evals/playwright.config.ts"
  },
```

new:

```json
  "scripts": {
    "test": "playwright test",
    "eval": "playwright test --config evals/playwright.config.ts",
    "meta": "node scripts/check-meta.mjs"
  },
```

אימות: `npm run meta; echo "exit=$?"` — רץ ומחזיר את אותו פלט כמו Step 8b.

- [ ] **Step 10: חיווט `scripts/sync-docs.sh`** — הוספת שער לפני ה-push. old (השורות הקיימות בשלב 3):

```bash
echo "── 3/3 · commit${PUSH:+ and push} ───────────────────────────"
git commit -q -m "$MSG" || { echo "   ! commit failed"; exit 1; }
```

new:

```bash
echo "── 3/3 · commit${PUSH:+ and push} ───────────────────────────"
# Phase 0 gate (§10.12 enforcement): a docs push may not ship a stale graph.
# SYNC_ALLOW_STALE=1 is a LOUD, deliberate mid-arc override — never the default.
if [ "$PUSH" = "1" ] && [ "${SYNC_ALLOW_STALE:-0}" != "1" ]; then
  if ! node scripts/check-graph-fresh.mjs; then
    echo "   ! GRAPH IS STALE — refusing to push docs. Run: /graphify docs --update --mode deep"
    echo "   ! (mid-arc escape hatch, stated out loud: SYNC_ALLOW_STALE=1 scripts/sync-docs.sh ...)"
    exit 1
  fi
elif [ "${SYNC_ALLOW_STALE:-0}" = "1" ]; then
  echo "   ! SYNC_ALLOW_STALE=1 — pushing over a possibly-stale graph (deliberate override)"
fi
git commit -q -m "$MSG" || { echo "   ! commit failed"; exit 1; }
```

הערת החלטה שגרתית (§10.8, מצוין ולא נשאל): מנתיב ה-escape ‏`SYNC_ALLOW_STALE=1` — override גלוי וצועק עדיף על עקיפת הסקריפט כולו ב-git ידני שקט. אימות: `bash scripts/sync-docs.sh "test" --no-push` עדיין עובד (הבדיקה רצה רק לפני push), ו-`bash -n scripts/sync-docs.sh` נקי.

- [ ] **Step 11: DoD + Commit.** ‏DoD-1 מצוטט למעלה; ‏RED-witnesses ב-Steps 2/4/6/8; ‏DoD-10 מוצהר (אין נגיעה בקוד אפליקציה); דוח `.superpowers/sdd/phase0-task-1-report.md` עם טבלת H9.

```bash
git add scripts/check-plan-complete.mjs scripts/check-graph-fresh.mjs scripts/gate-lessons.mjs scripts/check-meta.mjs package.json scripts/sync-docs.sh
git commit -m "feat(process): Phase 0 Task 1 — four dependency-free META gates (plan-complete, graph-fresh, gate-lessons, check-meta/H8) wired to npm run meta + sync-docs"
```

---

## Task 2 — Backfill L23–L27 אל discipline §11 (audit fix #1)

**Spec lines (DoD-1):** METHODOLOGY §5.9: *"§11 — Backfill L23–L27: v267 proxy-metric · token-cap truncation · fan-out wedge · over-bundling · CP2 plan truncation"* · AUDIT fix #1: *"write L23–L27 ... into the discipline doc so subagents inherit them. One session, high leverage."*

**Files:**
- Modify: `docs/process/development-discipline.md` — ‏§11, מיד אחרי בלוק L22 ולפני פסקת "Adopted wins (2026-07-23)".

**Interfaces (Consumes):** ‏`scripts/gate-lessons.mjs` מ-Task 1 — ה-RED וה-GREEN של המשימה.

- [ ] **Step 1: RED witness** — הרצה לפני העריכה:

```bash
node scripts/gate-lessons.mjs; echo "exit=$?"
# Expected: FAIL, exit=1 — last lesson L22 (2026-07-24), release commits after it listed.
grep -c "L2[3-7] ·" docs/process/development-discipline.md
# Expected: 0 (הלקחים אינם)
```

- [ ] **Step 2: הוספת חמשת הלקחים.** נקודת העיגון — old (סוף בלוק L22, השורות הקיימות):

```markdown
systematic-debugging session with a purpose-built repro harness (the reload-storm arms) found root cause in
hours. Measurement campaigns certify a stable system; they do not diagnose an unstable one.
```

new (אותן שתי שורות + חמשת הבלוקים החדשים אחריהן, לפני "**Adopted wins**"):

```markdown
systematic-debugging session with a purpose-built repro harness (the reload-storm arms) found root cause in
hours. Measurement campaigns certify a stable system; they do not diagnose an unstable one.

**L23 · A proxy metric is not the screen: "99% translated" shipped half-English screens (v267, 2026-07-26).**
The v267 localization claim ("~99% translated", "ready to test") was measured on key coverage and bundle-string
grep — while the real fr/de/es/it screens rendered roughly half English. The owner caught it on screen, and the
sequel (v269/v270) exposed two more layers the proxy could not see: untranslated data-values behind translated
keys, and shell-level leaks past the dictionary. This is the exact failure the project's own skill
`verify-against-the-runtime-path` was written to prevent — violated a second time after the skill existed.
Cost: three repair releases (v268–v270) plus an owner QA round, plus owner trust burned on a "done" that wasn't.
Root cause: measuring at an intermediate (keys, bundle strings) instead of at the consumer's input (the rendered
DOM, per language). Gate: any coverage/translation/localization claim is stated ONLY from a rendered-DOM
measurement per language (§10.19); key-coverage and grep counts may be reported only as explicitly-labeled
proxies, never as the claim.

**L24 · Never cap AI output tokens low — a low cap plus think:'high' silently truncates the JSON (v269–v271, 2026-07-27).**
The smoker device-lookup returned "not found": the model's thinking consumed the budget and the JSON payload was
cut mid-stream — no error, just a confident wrong answer. Owner policy (shipped v271): every AI call uses
maxTokens/maxOutputTokens 8192; the only exception is tiny health-probes. Billing is on actual tokens used, so a
high cap is free headroom — a low cap buys nothing and risks truncation. Root cause: a "reasonable-looking"
per-call cap treated as an optimization, interacting invisibly with thinking budgets. Gate: 8192 everywhere
(probe exceptions named); any truncated/malformed AI response is checked against the token cap FIRST, before
theorizing about prompts or models.

**L25 · The agent fan-out wedge: ~50 agents / 25 concurrent wedged the machine and returned plausible partials (2026-07, relearned from §11a).**
A mass dispatch (~50 agents, ~25 concurrent) wedged the workstation; the partial results that did come back
looked complete and were unreliable — the same lesson §11a already teaches for suite workers ("the local worker
count assumes an idle machine"), relearned at full price for agents. Prior API-529-killed audit runs are the
same class. Gate (§10.5a): sequential by default; independent LIGHT work ≤3 concurrent; hard cap 5; at most ONE
heavy agent while a suite run, build, or the translation GPU queue is active; on API 529, drop to
one-at-a-time and send a small probe agent first. And ALWAYS reconcile the dispatch journal — agents started vs
results received — before trusting any fan-out workflow's output.

**L26 · Over-bundling: three independent bug fixes rode one long subagent, and the owner had to ask "why so long?" (2026-07).**
Three unrelated fixes were bundled into a single long-running subagent (the bug1/bug2/bug3 wave reports). Each
fix was fine; the bundling meant no fix could land before the slowest one, progress was invisible, and the
owner's first signal was wall-clock pain. Root cause: §10.5 ("maximize subagent usage") read without
`dispatching-parallel-agents` — independence is the dispatch boundary. Gate: independent fixes ship as
independent dispatches (within the §10.5a ceiling) unless the owner explicitly chooses bundling; a brief that
bundles unrelated deliverables is sent back at review.

**L27 · Generated-plan truncation: an LLM asked for 10 full tasks emitted code for 1–5 and prose for 6–10; an LLM asked to concatenate ~237k chars silently truncated (CP2, 2026-07-27).**
The first CP2 plan draft was produced by asking a model to emit a complete 10-task plan and then to concatenate
~237k characters of task material: the draft carried real code in Tasks 1–5 and prose-only Tasks 6–10 (zero
fenced blocks — the writing-plans "EXACT code in each step" requirement silently violated), and the
concatenation lost content with no error. Caught one step before dispatching implementers against empty tasks;
cost hours (the archived evidence: `scratch/cp2/draft-v1-REJECTED.md` vs the rebuilt, code-complete
`docs/superpowers/plans/2026-07-27-cooking-paths-cp2.md`). Root cause: output-length limits fail silently, and
"looks like a plan" was trusted without a mechanical check. Gate: `scripts/check-plan-complete.mjs` runs on
every generated plan BEFORE review (per-task fenced-block count > 0, truncation-in-fence detector — discipline
§2); and large documents are NEVER assembled by LLM concatenation — assemble mechanically (`cat`, file ops),
then run the completeness gate on the result.
```

- [ ] **Step 3: GREEN witness:**

```bash
node scripts/gate-lessons.mjs; echo "exit=$?"
# Expected: OK, exit=0 — last lesson L27 (2026-07-27... החדש ביותר מבין התאריכים בבלוקים ≥ 27.7,
# מאוחר מ/שווה לתאריך release(v277 האחרון) — אין release לא-מכוסה.
grep -c "\*\*L2[3-7] ·" docs/process/development-discipline.md
# Expected: 5
```

הערה מחייבת: תאריכי הלקחים נכתבו כך שהמאוחר בהם (L24/L27 · 2026-07-27) שווה לתאריך ה-release האחרון — `gate-lessons` משווה `>` ולכן v273–v277 מכוסים. אין לתארך אף לקח לפני 2026-07-27 בלבד אם זה משנה את התוצאה — מריצים את השער ומדביקים.

- [ ] **Step 4: בדיקת עקביות פורמט מול L14–L22** — כל בלוק חדש פותח ב-`**LNN · <essence> (date).**`, מכיל root cause מפורש ו-Gate מפורש, בגוף שלישי עובדתי, באנגלית (שפת §11). מאומת בקריאה + `grep -n "^\*\*L2" docs/process/development-discipline.md` מודבק בדוח.

- [ ] **Step 5: Commit:**

```bash
git add docs/process/development-discipline.md
git commit -m "docs(discipline): Phase 0 Task 2 — backfill L23-L27 (proxy-metric, token-cap, fan-out wedge, over-bundling, plan truncation) so subagents inherit them; gate-lessons now green"
```

---

## Task 3 — עריכות מסמך המשמעת: H7..H12, ‏§10.5a, ‏§7, ‏§10.10, ‏§2, ‏Operating Model

**Spec lines (DoD-1):** METHODOLOGY §5 סעיפים 1–8, 10–13 (סעיף 9 = Task 2): *"§3 DoD-12 — נוסח H7 ... §9 — מחיקת 'FULL suite ×2 per task' ... §7 — כלל שני-המעברים ... §10.5a חדש ... §10.6 — שורת המרשם + הרחבת H9 ... §10.10 — פרוטוקול ה-fallback ... §10.12/§10.16 — הפניות אכיפה ... §2 — שורת check-plan-complete ... נספח Operating Model ... H8 ... H9 + H10"* + נוסחי H7..H12 המדויקים מ-`DECISION-REGISTER.md` בלוק H.

**Files:**
- Modify: `docs/process/development-discipline.md` — ‏10 עריכות כירורגיות (Edit A–J), old→new מדויקים להלן. **אין שכתוב של המסמך** (METHODOLOGY §5: "Phase 0 מחיל; לא כותבים מחדש").

**Interfaces (Consumes):** שמות הסקריפטים מ-Task 1 (ההפניות במסמך חייבות להתאים לקבצים בפועל).

- [ ] **Step 1: RED witness (grep-absence).** זהירות: לקחי Task 2 כבר מזכירים `§10.5a` ו-`check-plan-complete.mjs` בטקסט חופשי — לכן ה-RED נבדק על סמנים שרק Task 3 מכניס:

```bash
grep -c "^### 10.5a\|Operating Model\|Full-Landing Rule\|Owner ruling H7\|Fallback protocol when browser" docs/process/development-discipline.md
# Expected: 0 (אף אחת מהעריכות של Task 3 אינה במסמך עדיין). פלט מודבק.
```

- [ ] **Step 2: Edit A — §3 DoD-12 (פסיקת H7).** old:

```markdown
- [ ] **12 · Full suite green (once).** Run `npx playwright test` (config pins the reliable worker count + retries 0 — currently 6 workers, ~145s; see §11a). Output pasted. **Run once; if 100% green, the gate is met** (owner decision 2026-07-21, superseding ×2 — the clustered server made the suite fast and deterministic, so a second run adds cost without information). Any failure — including an intermittent one — is treated as a **bug**, debugged via `systematic-debugging`, **never** re-run to make it pass. Never pass `--retries` or `--workers=1`: retries mask flakes, `--workers=1` is the old 13-min serial path.
```

new:

```markdown
- [ ] **12 · Full suite green (H7).** Run `npx playwright test` plain — the config is authoritative (pinned workers, `retries: 0`; see §11a). Output pasted, exit code shown. **Owner ruling H7 (2026-07-30): task gate = ONE clean run (×1); release/ship gate = TWO clean runs (×2)** — the second run happens at the release commit, not per task. Rationale (owner): the run infrastructure was hardened deliberately (warm-page fixtures, measured worker pin, `retries:0`) and is trusted; routine repetition adds cost without information, while a ship deserves the double check. This supersedes both the 2026-07-21 "×1" note and §9's old "×2 per task" row — H7 is now the single source. Any failure — including an intermittent one — is treated as a **bug**, debugged via `systematic-debugging`, **never** re-run to make it pass. Never pass `--retries` or `--workers=1`: retries mask flakes, `--workers=1` is the old serial path.
```

- [ ] **Step 3: Edit B — §9 (מחיקת הסתירה + שלוש שורות חדשות).** old:

```markdown
| Question | Decision |
|---|---|
| Suite scope per task | **FULL suite ×2 per task.** Runtime cost accepted. No targeted-spec shortcut |
| Isolation | **Work on `main`.** No worktrees |
| Phase 0 ordering | **As proposed** — safety (cure guard) and correctness (cart math) first |
| Brainstorming depth | **Only when required** — when something is unclear, not understood, or not well defined. Depth as required by the subject |
```

new:

```markdown
| Question | Decision |
|---|---|
| Suite scope | **H7 (owner, 2026-07-30): task gate = clean full-suite run ×1; release (ship) gate = ×2.** Supersedes this table's former "×2 per task" row, DoD-12's former "×1 always" note, and the memory-only "twice before shipping" instruction — one ruling, one place |
| Isolation | **Work on `main`.** No worktrees |
| Phase 0 ordering | **As proposed** — safety (cure guard) and correctness (cart math) first |
| Brainstorming depth | **Only when required** — when something is unclear, not understood, or not well defined. Depth as required by the subject |
| Selector contract (Dec-H4) | Tests select ONLY via the stable selectors listed in `tests/selector-contract.md` (data-testid / stable ids and classes). Every NEW storage key lives under the `mk-` prefix. The full contract file lands with the Phase 3 codemod (Dec-H3); the rule binds from Phase 0 |
| Co-Authored-By trailer | **The model string the session itself declares, verbatim** — never guessed, never embellished (245 commits carry an invented "Opus 4.8 (1M context)"; the trailer is a factual claim in the permanent record). Optional hardening: a `commit-msg` hook with an exact-string allowlist |
```

- [ ] **Step 4: Edit C — §7 (כלל שני-המעברים).** old:

```markdown
- Final whole-branch review runs on the most capable model, with the accumulated Minor list.
```

new:

```markdown
- Final whole-branch review runs on the most capable model, with the accumulated Minor list.
- **External proposals get TWO passes by DIFFERENT agents (2026-07-30):** a CONCEPTS pass ("what real gaps
  of ours does this expose?") and a NUMBERS pass (auditing its arithmetic/claims). One verdict = an
  incomplete review. Born from the v5.0 first panel, which audited the messenger's illustrative numbers and
  missed its central mechanism — the owner forced a re-run (`a2c8535`, "owner was right, we have real gaps").
```

- [ ] **Step 5: Edit D — §10.5a חדש (תקרת המקבילות, METHODOLOGY §2.3 כלשונו).** old:

```markdown
### 10.5 Maximize subagent usage
Delegate aggressively: implementers, reviewers, debuggers, analysts, verifiers. Parallelise wherever the work is independent. The controller coordinates and verifies; it does not do work a subagent could do.
```

new:

```markdown
### 10.5 Maximize subagent usage
Delegate aggressively: implementers, reviewers, debuggers, analysts, verifiers. Parallelise wherever the work is independent. The controller coordinates and verifies; it does not do work a subagent could do.

### 10.5a Agent-concurrency ceiling (Phase 0, 2026-07-30 — the fan-out-wedge lesson, L25)
§10.5 is bounded by machine reality, exactly as suite workers are pinned in `playwright.config.ts`:
- **Default: sequential.**
- Independent LIGHT work (read/scan): up to **3 concurrent**; hard cap **5**.
- While a suite run, a build, or the translation GPU queue is active: **at most ONE heavy agent**
  (extends §11a's serialization rule from workers to agents).
- Three independent bug fixes = three separate dispatches, never one super-agent (the over-bundling
  lesson, L26).
- On API 529 overload: drop to one-at-a-time and send a small probe agent first.
- ALWAYS reconcile agents-started vs results-received before trusting a fan-out workflow's output.
Every `dispatching-parallel-agents` brief quotes this ceiling (see the brief template,
`docs/process/templates/task-brief.md`).
```

- [ ] **Step 6: Edit E — §10.6 (שורת המרשם + הרחבת H9 המוּבנית).** old (שתי הפסקאות הקיימות):

```markdown
3. **LEFT UNTIL THE GRAND FINAL** — the distance still to run on the *whole* programme, not just this
   phase. Where a burn-down number exists (gaps closed of 141, tasks done of N, phases done of M), state
   it. Where one does not, say so rather than implying progress that has not been measured.
```

new:

```markdown
3. **LEFT UNTIL THE GRAND FINAL** — the distance still to run on the *whole* programme, not just this
   phase. **This part IS the ledger line from `docs/ROADMAP-2026-07-30.md` §5** (a number — "N closed /
   156, M to target", read via `docs/STATUS-BOARD.md`), not prose. A Phase-gate agent checks the ledger
   was updated; an un-updated ledger fails the gate. Where a number genuinely does not exist yet, say so
   rather than implying progress that has not been measured.
```

וכן, מיד אחרי הפסקה המסתיימת ב-"State work-in-progress as in-progress." — old:

```markdown
**The honesty rule applies hardest here.** A burn-down that counts a gap as closed before its review is
clean, or that omits gaps added along the way, is worse than no burn-down — it manufactures confidence.
State work-in-progress as in-progress.
```

new:

```markdown
**The honesty rule applies hardest here.** A burn-down that counts a gap as closed before its review is
clean, or that omits gaps added along the way, is worse than no burn-down — it manufactures confidence.
State work-in-progress as in-progress.

**H9 — the mandatory task-summary table (owner ruling, 2026-07-30; the structured form of the three
parts).** EVERY development task — in Main or in a subagent — ends with a fixed 5-row table:
| # | Row | Content |
|---|---|---|
| 1 | **מה היה** (Before) | the state/problem before the task |
| 2 | **מה נעשה** (Done) | what was actually done + evidence (commit, tests, files, per H10c: vNNN · date+time) |
| 3 | **מה נשאר** (Remaining) | what stays open from the task/phase |
| 4 | **איפה אנחנו** (Position) | "Phase X, task Y of Z" + ledger "N closed / M to target" — **read from `docs/STATUS-BOARD.md`** (H10) |
| 5 | **הבא בתור** (Next) | the next tasks in line |
For subagents this is part of the report contract (a brief without the table requirement is an invalid
brief — see `docs/process/templates/task-brief.md`); Main verifies and relays. Every task close also
UPDATES `docs/STATUS-BOARD.md` (H10) — enforced by the arc-close checklist and by Phase gates (a stale
board fails the gate). **H10a (owner):** the table and board are MAINTAINED every task but SHOWN to the
owner only at milestones (Phase gate · release · arc close) or on request — tight tracking without noise.
```

- [ ] **Step 7: Edit F — §10.10 (פרוטוקול ה-fallback).** old (הפסקה האחרונה של §10.10):

```markdown
Also verify the delivery path itself, once, when it changes: `/` and `/index.html` should serve the new HTML with a revalidating `Cache-Control`, and `/sw.js` must be `no-cache` with a fresh content-hash `CACHE` name.
```

new:

```markdown
Also verify the delivery path itself, once, when it changes: `/` and `/index.html` should serve the new HTML with a revalidating `Cache-Control`, and `/sw.js` must be `no-cache` with a fresh content-hash `CACHE` name.

**Fallback protocol when browser tooling is broken (Phase 0, 2026-07-30 — one release shipped with no
live check at all when Playwright/MCP tooling failed):** if the Playwright live check cannot run, the
MINIMUM bar for saying "live" is a curl probe of the live URL asserting BOTH (a) `.foot-stamp` contains
the shipped `מהדורה NNN` and (b) a feature string from that release is present in the payload — output
pasted into the report. The full browser verification is then COMPLETED THE SAME DAY, and its result
reported. **Without one of the two, "live" is not said at all.**
```

- [ ] **Step 8: Edit G — §10.12 + §10.16 (הפניות אכיפה).** ‏old (§10.12, פסקת "Use the one command"):

```markdown
**Use the one command.** `scripts/sync-docs.sh "commit message"` does all three steps in order —
graphify update, stage documents (plus a copy of `GRAPH_REPORT.md` into `docs/analysis/graph/`), commit and
push. Use it instead of remembering three separate steps. It warns loudly when the graph could not be
updated, because a silent stale graph is the failure this rule exists to prevent.
```

new:

```markdown
**Use the one command.** `scripts/sync-docs.sh "commit message"` does all three steps in order —
graphify update, stage documents (plus a copy of `GRAPH_REPORT.md` into `docs/analysis/graph/`), commit and
push. Use it instead of remembering three separate steps. It warns loudly when the graph could not be
updated, because a silent stale graph is the failure this rule exists to prevent.

**Mechanical enforcement (Phase 0, 2026-07-30):** `scripts/check-graph-fresh.mjs` compares every
`docs/**/*.md` mtime against the `graphify-out/graph.json` build stamp and fails on any stale doc.
`sync-docs.sh` runs it before any docs push and refuses to ship a stale graph (loud override:
`SYNC_ALLOW_STALE=1`); it also runs inside `node scripts/check-meta.mjs` (session start · release ·
every Phase gate and arc close). This rule previously relied on remembering — it drifted 53 documents
behind within five days (audit §10).
```

‏old (§10.16, הפסקה השנייה):

```markdown
The mechanics already exist — this rule makes them a *closing checklist*, not a when-remembered habit:
```

new:

```markdown
**Mechanical enforcement (Phase 0, 2026-07-30):** `scripts/gate-lessons.mjs` (inside `check-meta.mjs`)
blocks a `release(v` commit when releases exist after the newest §11 lesson/declaration date, and the
arc-close checklist (`docs/process/checklists/arc-close.md`) makes the lessons+deposit pass a gated step.
The §11 log froze at L22 while five paid-for lessons lived only in private memory (audit §9) — never again.

The mechanics already exist — this rule makes them a *closing checklist*, not a when-remembered habit:
```

- [ ] **Step 9: Edit H — §2 (שורת check-plan-complete).** old:

```markdown
**Debugging is not a phase — it is an interrupt.** Any failure at any point suspends the pipeline into `systematic-debugging`'s four phases before anything else happens.
```

new:

```markdown
**Debugging is not a phase — it is an interrupt.** Any failure at any point suspends the pipeline into `systematic-debugging`'s four phases before anything else happens.

**A generated plan is never submitted to review before `node scripts/check-plan-complete.mjs <plan.md>` exits 0** (per-task fenced-code count > 0, truncation detector — Phase 0 gate; lesson L27, the silent CP2 truncation). Large plans are assembled mechanically (file concatenation), never by LLM concatenation.
```

- [ ] **Step 10: Edit I — שלושה סעיפים חדשים בסוף המסמך (Operating Model + H8 + H9–H12).** מוסף בסוף הקובץ (אחרי סוף §10.12 הנוכחי), התוכן המלא:

```markdown
---

## 13. Operating Model — Main thread vs subagents (H6, adopted 2026-07-30)

Authoritative form of METHODOLOGY-2026-07-30 §2, written here so every subagent inherits it.

| What | Runs where | Why |
|---|---|---|
| Decisions, gates, owner communication, §4 rulings | **Main only — never delegated** | decision provenance lives in one conversation; the owner talks to one entity |
| Accepting/rejecting a Phase-gate verdict; declaring "done" | **Main only** | "Being wrong is worse than being silent" — accountability is not inherited |
| Ledger upkeep (ROADMAP §5) + §10.6/H9 summaries | **Main** | the one thing compaction must never squeeze out |
| Spec/plan drafting | Subagent; approval in Main | heavy writing = heavy context; approval and owner-facing stay in Main |
| Task implementation (SDD, fresh agent per task) | **Subagent** | the proven `.superpowers/sdd/` pattern |
| Code-review + spec-audit (two verdicts, §7) | **Subagent** (fresh, no access to progress.md) | reviewer independence — the strongest artifact in the repo |
| Heavy reading: research, synthesis, evidence sweeps | **Subagent** | Main receives conclusions + file paths, not dumps |
| Graph refresh, suite runs, 390×844 screenshot sweeps | **Subagent** (serialized, §10.5a) | long mechanical work; Main verifies the artifact |

**The brief/report contract (file-based handoffs):** a brief is a FILE (template:
`docs/process/templates/task-brief.md`) carrying (a) the exact spec lines the task satisfies (DoD-1),
(b) the exact code from the plan, (c) the relevant DoD checklist, (d) the report contract — report file
name and what must be pasted in it (RED output, GREEN output, exit code, screenshot paths) **including
the H9 5-row summary table**, and (e) a "primary tool" field: serena for symbol work, graphify for
docs/relationship questions, grep only as a declared fallback. A missing field = an invalid brief.
A report is a FILE under `.superpowers/sdd/`; the agent returns only a summary + path; Main verifies
via diff, never on the report alone. **Main's context budget:** no full source files, no full suite
logs, no long documents — anything projected over ~2k cumulative lines goes to a subagent that returns
an extract; Main stays below the compaction zone so the ledger, decisions and the owner conversation
are never squeezed out.

## 14. H8 — The Full-Landing Rule ("nothing in the air"; owner ruling, 2026-07-30)

The owner's ruling, verbatim (DECISION-REGISTER H8):

> **כלל הנחיתה המלאה ("שום דבר באוויר"):** מעכשיו והלאה אף פריט אינו "לא מטופל" / "לא מעוגן" /
> "נדחה בלי מועד". לכל פער, החלטה או רעיון יש בדיוק אחת מ: (א) פאזה נקובה ב-Roadmap; (ב) דחייה
> מנומקת **עם טריגר מוגדר** לפתיחה מחדש; (ג) אם הנושא דורש דיון/סיעור מוחות — **המשימה הרשומה היא
> הדיון עצמו**, בפאזה נקובה, והחלטותיו משולבות בתוכנית אחריו.

Born from the 2026-07-30 coverage audit: 43 gaps had no landing, 9 of them dropped from the plan
entirely. **Mechanical enforcement:** the no-unlanded-items check inside `scripts/check-meta.mjs`
parses the ROADMAP §5 ledger — every ledger row must land in a named phase, every remainder item must
carry a defined trigger; anything else exits nonzero. It runs at EVERY Phase gate and EVERY arc close,
plus check-meta's routine runs (session start, before docs push, before any `release(v` commit).

## 15. H9–H12 — task summaries, the live status board, capabilities, /status (owner rulings, 2026-07-30)

- **H9 — mandatory task-summary table.** Defined in §10.6 (the structured form of the three parts):
  every task, Main or subagent, ends with the fixed 5-row table; for subagents it is part of the report
  contract; Main verifies and relays. Per **H10c**, evidence rows carry "vNNN · date+time".
- **H10 — the live status board, `docs/STATUS-BOARD.md`.** THE source of truth for position against
  the plan: one row per Phase (tasks done/total · status · gaps closed) + a project-total row; per
  **H10b** it also carries the full project history since the PRD as ✅ rows. **Updated at every task
  close**; checked (together with no-unlanded-items) at every Phase gate — a stale board fails the
  gate. H9's "איפה אנחנו" row is READ from it. Per **H10a**, it is maintained every task but shown to
  the owner only at milestones or on request.
- **H11 — the capabilities table, `docs/CAPABILITIES.md`.** The living inventory of every product
  capability, large and small; every shipped feature adds its row (with "since vNNN · D.M.YY" per
  H10c) as part of the task-close routine, alongside the board. Future base for help/marketing docs.
- **H12 — the `/status` command** (`.claude/commands/status.md`): `/status` = the board ·
  `/status caps` = capabilities · `/status full` = both + the last task's H9 table.
```

- [ ] **Step 11: GREEN witness — grep-back על כל עריכה:**

```bash
grep -n "H7 (2026-07-30)\|Owner ruling H7" docs/process/development-discipline.md   # Edit A: ≥1
grep -c "FULL suite ×2 per task" docs/process/development-discipline.md             # Edit B: 0 (נמחק)
grep -n "Selector contract (Dec-H4)\|Co-Authored-By trailer" docs/process/development-discipline.md  # Edit B: 2
grep -n "TWO passes by DIFFERENT agents" docs/process/development-discipline.md     # Edit C: 1
grep -n "### 10.5a Agent-concurrency ceiling" docs/process/development-discipline.md # Edit D: 1
grep -n "IS the ledger line\|H9 — the mandatory task-summary table" docs/process/development-discipline.md # Edit E: 2
grep -n "Fallback protocol when browser tooling is broken" docs/process/development-discipline.md # Edit F: 1
grep -n "check-graph-fresh.mjs\|gate-lessons.mjs" docs/process/development-discipline.md # Edit G: ≥2
grep -n "check-plan-complete.mjs" docs/process/development-discipline.md             # Edit H+G: ≥1
grep -n "^## 13. Operating Model\|^## 14. H8\|^## 15. H9" docs/process/development-discipline.md # Edit I: 3
```

כל פלט מודבק בדוח. וידוא נוסף: `node scripts/gate-lessons.mjs` עדיין ירוק (העריכות לא שברו את פרסור §11).

- [ ] **Step 12: אשרור תזמון החילוצים (ROADMAP Phase 0 סעיף 4) — צעד דיווח, לא עריכה.** מפת הדרכים כבר קובעת ORCH=Phase 3, NAV=Phase 5, AI=Phase 9, I18N/Voice=Phase 12; שער הבעלים של Phase 0 (ROADMAP §6 שורה 1) מסומן "ניתן 30.7" יחד עם H7. הדוח מציין: **התזמון מאושרר, אין פעולה** — נכלל בסיכום ה-Main לבעלים בסגירת ה-Phase.

- [ ] **Step 13: Commit:**

```bash
git add docs/process/development-discipline.md
git commit -m "docs(discipline): Phase 0 Task 3 — H7 x1/x2 ruling into DoD-12+§9, §10.5a concurrency ceiling, two-pass review rule, §10.10 curl fallback, §2 plan gate, enforcement pointers, Operating Model + H8 + H9-H12 sections"
```

---

## Task 4 — קבצי-לוואי: צ'קליסטים, חוזה סלקטורים, תבנית brief, בלוק CLAUDE.md, ותיקון H-9

**Spec lines (DoD-1):** METHODOLOGY §4: *"`tests/selector-contract.md` ... `docs/process/checklists/session-start.md` + בלוק ב-CLAUDE.md ... `docs/process/checklists/arc-close.md` ... תבנית brief (H9)"* · §3.3: *"צ'קליסט פתיחת-session — בלוק בן 5 שורות שנוסף ל-CLAUDE.md"* · ROADMAP Phase 0: *"H-9 — תיקון טענת 'Nobody owns' המופרזת (תיקון-מסמך של שורה)"*.

**Files:**
- Create: `docs/process/checklists/session-start.md`, `docs/process/checklists/arc-close.md`, `tests/selector-contract.md`, `docs/process/templates/task-brief.md`
- Modify: `CLAUDE.md` (בלוק קומפקטי — הקובץ חייב להישאר רזה), `docs/ai-strategy.md` (שורה ~77)

- [ ] **Step 1: RED witness:**

```bash
ls docs/process/checklists tests/selector-contract.md docs/process/templates 2>&1; grep -c "check-meta" CLAUDE.md; grep -n "Nobody owns" docs/ai-strategy.md
# Expected: הנתיבים אינם (No such file...), CLAUDE.md ללא check-meta (0), ai-strategy מכיל "Nobody owns" (שורה ~77)
```

- [ ] **Step 2: `docs/process/checklists/session-start.md`** — התוכן המלא:

```markdown
# Session-start checklist (Phase 0 · METHODOLOGY §3.3)

חמשת הצעדים, בסדר, בכל פתיחת session:

1. קרא `docs/process/development-discipline.md` — §10 ואז §3 (הכלל הקיים, נשאר ראשון).
2. קרא את ה-Phase הפעיל ב-`docs/ROADMAP-2026-07-30.md` + מצב המרשם (§5) + `docs/STATUS-BOARD.md`.
3. הרץ `node scripts/check-meta.mjs` — טפל בכל אדום לפני עבודה.
4. עבודה סימבולית → serena; שאלות מסמכים/יחסים → graphify; grep = fallback מוצהר.
5. תקרת מקבילות (§10.5a): סדרתי כברירת מחדל; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/build/GPU.
```

- [ ] **Step 3: `docs/process/checklists/arc-close.md`** — התוכן המלא:

```markdown
# Arc-close checklist (Phase 0 · METHODOLOGY §4; enforced at every arc/Phase close)

קשת אינה סגורה עד שכל השורות ירוקות, עם ראיות:

- [ ] **לקחים → §11** (discipline): כל כשל = L-entry; הצלחות = "adopted wins"; אם באמת אין —
      שורת `**No-lesson declaration (YYYY-MM-DD):**` מפורשת. אימות: `node scripts/gate-lessons.mjs` ירוק.
- [ ] **הפקדות graphify global** (§10.11/§10.16): שער-התועלת הופעל על כל מקור חיצוני שהקשת מצאה;
      המפקידים הופקדו (`graphify global list` מודבק) או "אין מועמדים" נאמר במפורש.
- [ ] **רענון הגרף המקומי** (§10.12): `/graphify docs --update --mode deep`; אימות:
      `node scripts/check-graph-fresh.mjs` ירוק.
- [ ] **מרשם + לוח:** שורת ה-Phase ב-`docs/ROADMAP-2026-07-30.md` §5 נכונה; `docs/STATUS-BOARD.md`
      עודכן עם "vNNN · תאריך+שעה" (H10c); `docs/CAPABILITIES.md` קיבל את פיצ'רי הקשת (H11).
- [ ] **no-unlanded-items (H8) ירוק:** `node scripts/check-meta.mjs` — כל הסעיפים OK.
- [ ] **סיכום §10.6 + טבלת H9** נמסרו לבעלים (זו אבן-דרך — H10a מציג).
```

- [ ] **Step 4: `tests/selector-contract.md`** — הכלל + זרע (החוזה המלא = משימת Phase 3, ‏Dec-H3/H4):

```markdown
# Selector contract — the rule (Phase 0) · the full inventory lands with the Phase 3 codemod (Dec-H3/H4)

**הכלל (discipline §9, מחייב מ-Phase 0):**
1. בדיקה נשענת אך ורק על סלקטורים הרשומים כאן (data-testid / id / class יציבים). סלקטור שלא ברשימה —
   מוסיפים אותו לכאן באותו commit שמשתמש בו.
2. כל מפתח אחסון (localStorage) חדש נכתב תחת קידומת `mk-`.
3. בהסבת קוד (חילוצי המודולים, Phase 3/5/9/12) כל `id`/`class`/`data-*` שבדיקה נשענת עליו נשמר (Dec-H4)
   — מאות בדיקות DOM עוברות בחינם.

**זרע (סלקטורים שכבר משמשים חוזים דה-פקטו):**
| Selector | Meaning | Used by |
|---|---|---|
| `.foot-stamp` | version stamp `מהדורה NNN` | §10.10 live verification + release probes |

*(הטבלה מתמלאת אינקרמנטלית; האינוונטר המלא — משימה נקובה בתוכנית Phase 3.)*
```

- [ ] **Step 5: `docs/process/templates/task-brief.md`** — התוכן המלא (METHODOLOGY §2.2 + H9):

```markdown
# Task-brief template (METHODOLOGY §2.2 · H9) — brief חסר-שדה = brief פסול

## Brief: <Phase X · Task N — name>

**(א) Spec lines (DoD-1):** <ציטוט מדויק של שורות המפרט שהמשימה מספקת>
**(ב) Exact code from the plan:** <הקוד המדויק מהתוכנית — לא "ראה תוכנית">
**(ג) DoD checklist:** <שורות ה-DoD הרלוונטיות מ-discipline §3, מועתקות>
**(ד) Report contract:** report file `.superpowers/sdd/<arc>-task-<N>-report.md`; must paste: RED output,
GREEN output + exit code, screenshot paths (UI); **ends with the H9 5-row table** (מה היה · מה נעשה+ראיות
[vNNN · date+time] · מה נשאר · איפה אנחנו [from docs/STATUS-BOARD.md] · הבא בתור).
**(ה) Primary tool:** <serena | graphify | אחר> ; grep = fallback מוצהר בלבד.
**Concurrency ceiling (§10.5a, quoted):** סדרתי כברירת מחדל; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/build/GPU;
על 529 — אחד-אחד עם probe קטן תחילה.
**Constraints:** <Global Constraints של התוכנית + גבולות המשימה>
```

- [ ] **Step 6: בלוק CLAUDE.md קומפקטי.** ‏old (הכותרת הקיימת):

```markdown
## Where to find what — `docs/process/development-discipline.md`
```

new (הבלוק החדש נכנס לפניה):

```markdown
## Session start & arc close (Phase 0 — mechanical gates)

**בכל פתיחת session** (המלא: `docs/process/checklists/session-start.md`): ‏(1) discipline §10→§3 ·
(2) ה-Phase הפעיל ב-`docs/ROADMAP-2026-07-30.md` + ‏`docs/STATUS-BOARD.md` · (3) `node scripts/check-meta.mjs`
— אדום מטופל לפני עבודה · (4) serena לסימבולי, graphify למסמכים/יחסים, grep=fallback מוצהר ·
(5) §10.5a: סדרתי; ≤3 קלים; ≤5 קשיח; 1 בזמן סוויטה/GPU.
**בכל סגירת קשת/Phase:** ‏`docs/process/checklists/arc-close.md` — לקחים→§11, הפקדות, גרף, לוח+מרשם,
check-meta ירוק. **כל משימה מסתיימת בטבלת H9 ומעדכנת את `docs/STATUS-BOARD.md`** (H10; מוצג באבני-דרך — H10a).

## Where to find what — `docs/process/development-discipline.md`
```

וכן עדכון שורת המפתחות בטבלת "Where to find what" — old:

```markdown
| **3** | **The 12-point DoD gate** — inlined below |
```

new:

```markdown
| **3** | **The 12-point DoD gate** — inlined below (DoD-12 per H7: task ×1, release ×2) |
| 13–15 | Operating Model (Main/subagent + brief contract) · **H8 full-landing** · H9–H12 (summary table, STATUS-BOARD, CAPABILITIES, /status) |
```

- [ ] **Step 7: תיקון H-9 — `docs/ai-strategy.md` שורה ~77.** old:

```markdown
The market splits into hardware-tethered apps (MEATER, Traeger) and content subscriptions (AmazingRibs $34.95/yr) and single-trick cure calculators. **Nobody owns the software-first AI copilot** spanning BBQ + smoking + sous-vide + grilling + charcuterie, grounded in cited data, offline, helping *during* the cook. That gap is exactly where this app sits.
```

new:

```markdown
The market splits into hardware-tethered apps (MEATER, Traeger) and content subscriptions (AmazingRibs $34.95/yr) and single-trick cure calculators. **In our 2026-07 scan, no surveyed product owned the software-first AI copilot** spanning BBQ + smoking + sous-vide + grilling + charcuterie, grounded in cited data and helping *during* the cook — a market-scan observation, not a verified absence claim (corrected 2026-07-30, gap H-9). That gap is exactly where this app sits.
```

הערה מוצהרת (§10.8, routine): המילה "offline" הוסרה מהמשפט אגב התיקון — היא סותרת את פסיקת ONLINE-FIRST ‏(22.7); ‏CLAUDE.md מחייב לסמן טענות אופליין עבשות, לא לשמר אותן. מדווח בסיכום.

- [ ] **Step 8: GREEN witness:**

```bash
node scripts/check-plan-complete.mjs docs/superpowers/plans/2026-07-30-phase0-discipline-hardening.md  # עדיין עובר
ls docs/process/checklists/session-start.md docs/process/checklists/arc-close.md tests/selector-contract.md docs/process/templates/task-brief.md
grep -n "Session start & arc close" CLAUDE.md          # 1
grep -c "Nobody owns" docs/ai-strategy.md              # 0
grep -n "no surveyed product owned" docs/ai-strategy.md # 1 (שורה ~77)
```

- [ ] **Step 9: Commit:**

```bash
git add docs/process/checklists/ docs/process/templates/ tests/selector-contract.md CLAUDE.md docs/ai-strategy.md
git commit -m "docs(process): Phase 0 Task 4 — session-start/arc-close checklists, selector-contract rule + mk- namespace, H9 brief template, compact CLAUDE.md gates block; fix H-9 overstated market claim (ai-strategy.md)"
```

---

## Task 5 — רענון גרף הידע `--mode deep` + מעבר ההפקדות (audit fix #2)

**Spec lines (DoD-1):** ROADMAP Phase 0: *"(2) רענון גרף `--mode deep` (53 מסמכים) + הפקדות §10.16 לקשת v5"* · AUDIT fix #2: *"Refresh the local graph (--mode deep, word-budget chunking) — 53 docs behind — and run the §10.16 deposit pass for the v5-engine research arc."* · discipline §10.12: *"Chunk by WORD BUDGET, not file count — roughly 12k words per chunk under deep mode."*

**Files:**
- Regenerate: `graphify-out/graph.json` + המניפסט (generated, מחוץ ל-git) ; ‏`docs/analysis/graph/GRAPH_REPORT.md` (מועתק ומועלה ב-Task 6 דרך `sync-docs.sh`).

**Interfaces (Consumes):** ‏`scripts/check-graph-fresh.mjs` מ-Task 1 — ה-RED (כבר נצפה ב-Task 1 Step 4) וה-GREEN כאן.

**אילוצי ריצה (מחייבים):** המשימה **ארוכה** (חילוץ LLM על ‏53+ מסמכים כולל כל `docs/research/v5-engine/`). (א) רצה כצעד ידידותי-לרקע עם בדיקת-השלמה — לא חוסמים עליה את ה-session; (ב) **לא רצה במקביל לסוויטה** או לכל עומס כבד (§11a + ‏§10.5a: סוכן כבד אחד); (ג) **הרענון הוא זרימת ה-skill** (`/graphify docs --update --mode deep`) המופעלת על-ידי ה-controller — סקריפט מעטפת אינו יכול להפעיל skill (§10.12: "הבר-CLI הוא נתיב הקוד"); (ד) שני מלכודי-השחתה מ-§10.12 חלים — backend מ-cwd נייטרלי עם נתיבים מוחלטים, ואחרי הריצה משווים `git log --since=<run start> --name-only -- docs/` מול המניפסט ומכריחים re-extract לכל מסמך שנערך תוך-כדי; (ה) **הקפאת docs בזמן הריצה:** ‏Tasks 2–4 (שכולם עורכים docs) חייבים להיות committed לפני תחילת הרענון — לכן המשימה הזו חמישית.

- [ ] **Step 1: RED (אישוש; נצפה כבר ב-Task 1):**

```bash
node scripts/check-graph-fresh.mjs; echo "exit=$?"
# Expected: FAIL — הרשימה כוללת כעת גם את קבצי Tasks 2-4. פלט מודבק.
```

- [ ] **Step 2: תיעוד שעת ההתחלה + הרצת הרענון (זרימת ה-skill, controller):**

```bash
date -u +"run-start: %Y-%m-%dT%H:%M:%SZ"   # נשמר לדוח — נדרש לבדיקת החפיפה בשלב 4
```

ואז ה-controller מפעיל: **`/graphify docs --update --mode deep`** — עם chunking לפי תקציב מילים ~12k (לא לפי מספר קבצים), backend מ-cwd נייטרלי. אין לגעת באף קובץ תחת `docs/` עד שהריצה מסתיימת.

- [ ] **Step 3: בדיקת השלמה (הצעד הידידותי-לרקע):**

```bash
node scripts/check-graph-fresh.mjs; echo "exit=$?"
# Expected: OK, exit=0 — GREEN הראשון של הסקריפט. פלט מודבק בדוח.
node -e "const g=require('./graphify-out/graph.json'); console.log('nodes:', (g.nodes||g.entities||[]).length)"
# sanity: מספר צמתים > 0 ולא קטן דרמטית מהריצה הקודמת (השוואה מוצהרת בדוח)
```

- [ ] **Step 4: בדיקת חפיפת-עריכה (מלכוד §10.12 מס' 2):**

```bash
git log --since="<run-start מהשלב 2>" --name-only --pretty=format: -- docs/ | sort -u
# Expected: ריק (docs הוקפאו). אם לא ריק — force re-extract לכל קובץ שמופיע, ואז חוזרים על Step 3.
```

- [ ] **Step 5: מעבר ההפקדות (§10.16, קשת v5-engine + קשת התכנון):** מפעילים את שער-התועלת של §10.11 על מקורות חיצוניים שהקשת צרכה. כלל מחייב: **מסמכי הפרויקט הפרטיים — לעולם לא ל-global** (ה-v5-engine arc עצמו נכנס לגרף ה-**מקומי** ב-Step 2; זה עיקר החוב). לכל מקור חיצוני שעומד בשער: `graphify add <url>` → ‏`graphify global add <graph.json> --as <name>-docs` → אימות `graphify global list`. אם אין מועמדים חיצוניים — **אומרים זאת במפורש בדוח** ("אין מועמדים להפקדה — הקשת עבדה על מסמכים פנימיים"), לפי §10.16.

- [ ] **Step 6: דוח + טבלת H9.** ‏`.superpowers/sdd/phase0-task-5-report.md`: פלטי RED/GREEN, שעת run-start, תוצאת בדיקת החפיפה, שורת ההפקדות. אין commit בצעד הזה — ‏`graphify-out/` מחוץ ל-git; ‏`GRAPH_REPORT.md` מועתק ונדחף ב-Task 6 דרך `sync-docs.sh`.

---

## Task 6 — Phase close: סוויטה ×1, ‏STATUS-BOARD, שער-Phase, ‏push

**Spec lines (DoD-1):** ROADMAP Phase 0: *"יציאה: מסמכים+גרף עדכניים; אין שינוי קוד אפליקציה (releasable טריוויאלית, נשארים v277)"* + *"סוגר: H-9, N-15"* · ROADMAP §0.6/§6: *"בדיקת no-unlanded-items (H8) + עדכון STATUS-BOARD (H10) בכל שער-Phase"* · discipline §3 per-phase gate: *"Independent conformance re-audit by a fresh agent against the spec, not against the ledger."* · H7: משימה=×1; אין release commit (docs-only) — ולכן ריצה יחידה אחת, מאשררת.

**Files:**
- Modify: `docs/STATUS-BOARD.md` (שורת Phase 0 + סך-הפרויקט + חותמת "עודכן לאחרונה")
- Report: `.superpowers/sdd/phase0-gate-verdict.md` (סוכן השער) + `.superpowers/sdd/phase0-task-6-report.md`

- [ ] **Step 1: מכונה שקטה, ואז הסוויטה פעם אחת** (§11a: אף סוכן כבד לא רץ במקביל; ה-GPU של התרגום מושהה; אין `serve.js` ידני על 8123):

```bash
npx playwright test
# Expected: 816 passed (או המספר העדכני), 0 failed, ללא overrides. פלט + exit code מודבקים.
# כל כישלון — כולל intermittent — הוא באג: עוצרים, systematic-debugging, לא מריצים שוב "עד שעובר".
```

הצדקה מוצהרת: אף קובץ קוד לא השתנה ב-Phase — הריצה מאשררת שאין רגרסיה עקיפה (config/package.json) ומשמשת ראיית-הבסיס של השער.

- [ ] **Step 2: check-meta ירוק מלא — שער ה-META של ה-Phase:**

```bash
node scripts/check-meta.mjs; echo "exit=$?"
# Expected: META GATE OK, exit=0 — graph fresh (Task 5) + lessons covered (Task 2) + H8 clean. מודבק.
```

- [ ] **Step 3: עדכון `docs/STATUS-BOARD.md`.** ‏old (שורת הלוח הקיימת):

```markdown
| Phase 0 | הקשחת משמעת | 0/~4 | ⏳ | 0/2 (H-9, N-15) | H7/H8/H9/H10 נכתבים ל-discipline |
```

new (עם תאריך+שעה אמיתיים של רגע הסגירה, פורמט H10c):

```markdown
| Phase 0 | הקשחת משמעת | 6/6 | ✅ v277 · docs-only · 30.7.26 HH:MM | 2/2 (H-9, N-15) | 4 שערי META חיים (check-meta) · H7..H12 ב-discipline · L23–L27 · גרף עדכני |
```

וכן בטבלת "סך הפרויקט" — old:

```markdown
| משימות | **8 / ~183-208** (8 תכנון ✅ + ~175-200 פיתוח) |
| פערים | **17 / 156 סגורים (~11%)** · יעד סיום-תוכנית: **146/156 (~94%)** |
```

new:

```markdown
| משימות | **14 / ~183-208** (8 תכנון ✅ + 6 Phase 0 ✅ + ~170-195 פיתוח) |
| פערים | **19 / 156 סגורים (~12%)** · יעד סיום-תוכנית: **146/156 (~94%)** |
```

ועדכון שורת "עודכן לאחרונה" בתחתית עם תאריך+שעה+גרסה (H10c). ‏(H11: אין פיצ'ר-מוצר חדש — ‏`docs/CAPABILITIES.md` ללא שינוי, מוצהר.)

- [ ] **Step 4: שער-Phase עצמאי — סוכן טרי, מול המפרט ולא מול המרשם.** ‏dispatch של סוכן שער (brief לפי התבנית החדשה `docs/process/templates/task-brief.md`, בלי גישה ל-progress/דוחות המשימות): מקבל את ארבעת מסמכי המפרט (METHODOLOGY ‏§3–§5, ‏AUDIT ‏fixes 1–5, ‏ROADMAP ‏Phase 0, ‏DECISION-REGISTER ‏H) ומאמת כל שורת-מפרט מול הרפו עצמו (קבצים, גרפים, פלטי סקריפטים שהוא מריץ בעצמו). התוצר: `.superpowers/sdd/phase0-gate-verdict.md` עם כל שורה MET/UNMET + ראיות. **שורת UNMET אחת = ה-Phase לא נסגר** — חוזרים ללולאה (§10.1), לא מדווחים "כמעט".

- [ ] **Step 5: סיכום תלת-חלקי + טבלת H9 לבעלים (אבן-דרך — H10a מציג):** ‏DONE (המנגנונים + הראיות) · NEXT ‏(Phase 1 — חוסמים מיידיים; ‏Phase 2 מותר במקביל) · LEFT — שורת המרשם: **19/156 סגורים, יעד 146/156**. כולל דיווח אשרור-החילוצים (Task 3 Step 12) והערות ה-routine שנרשמו (SYNC_ALLOW_STALE, הסרת "offline" מ-ai-strategy).

- [ ] **Step 6: Commit + push דרך הצינור החדש (השער אוכף את עצמו):**

```bash
git add docs/STATUS-BOARD.md .superpowers/sdd/
git commit -m "docs(status): Phase 0 CLOSED — 6/6 tasks, gaps H-9+N-15 closed (19/156), v277 docs-only; independent gate verdict attached"
bash scripts/sync-docs.sh "chore(phase0): graph refreshed --mode deep (53-doc backlog + v5-engine arc) + GRAPH_REPORT sync"
# sync-docs מריץ כעת check-graph-fresh לפני ה-push — ירוק מ-Task 5; פלט מודבק.
git log --oneline -3   # אימות שהכול נדחף; origin עדכני
```

---

## Self-Review (בוצע בכתיבת התוכנית)

1. **כיסוי מפרט:** ‏METHODOLOGY §3.1 חמשת התיקונים — ‏#1→Tasks 1+2, ‏#2→Tasks 1+5, ‏#3→Task 3 Edit A/B, ‏#4→Task 3 Step 12 (אשרור, ניתן 30.7), ‏#5→Task 1 · §3.2 כל שורות הטבלה → Task 3 (Edits B–F) + Task 4 · §3.3→Tasks 1+4 · §3.4/H8→Task 1 Step 7 + Task 3 Edit I · §3.5/H9→Task 3 Edit E + Task 4 Step 5 · §3.6/H10 (+H10a/b/c, H11, H12 — קיימים כקבצים, הכללים נכתבים)→Task 3 Edit I + Task 6 · §5 סעיפים 1–13 → Tasks 2–4 · ROADMAP Phase 0 (H-9, N-15)→Tasks 4+6. אין שורת מפרט ללא משימה.
2. **סריקת placeholders:** אין "TBD"/"ראה תוכנית"/"בהמשך" — כל סקריפט בקוד מלא, כל עריכה ב-old→new מלא. בדיקה מכנית: התוכנית עוברת את `check-plan-complete.mjs` של עצמה (מאומת ב-Task 1 Step 2).
3. **עקביות טיפוסים/שמות:** ‏`check-meta.mjs` קורא ל-`check-graph-fresh.mjs`/`gate-lessons.mjs` בשמות הקבצים שנוצרים ב-Steps 3/5; ‏`ROADMAP`/`DISCIPLINE` env-hooks עקביים; פורמט ההצהרה `**No-lesson declaration (YYYY-MM-DD):**` זהה בין `gate-lessons.mjs`, ‏arc-close.md והעריכה ב-§10.16; ‏fixtures אומתו בפועל מול הרפו (draft: ‏6 משימות×0 בלוקים; ‏cp2: ‏11×≥16, ‏300 fences זוגי; גרף: ‏25.7; ‏releases: ‏27.7).
