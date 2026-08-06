# Tooling Review — 2026-07-31

> ⚠️ **2026-08-05 — `graphify` was removed from this project.** Any instruction below that names it, `graphify-out/`, `/graphify` or `check-graph-fresh` is a **record of what was done at the time**, not something to run. The live equivalents are:
> `from src.knowledge import retrieval` → `search_current_docs(q, filters=…)` / `semantic_search(q, filters=…)` (query) · `python scripts/ingest.py --scope` (ingest, delta by content hash) · `node scripts/check-geniza-fresh.mjs` (the gate, and it BLOCKS). See discipline §10.11–§10.13. **`agent-memory.db`, `scripts/memsync.py` and `scripts/memenrich.py` were themselves deleted 2026-08-05** — this banner used to point at them, which made its own redirect dead two levels deep.


סקירת עומק של כל הכלים, שרתי ה-MCP, ה-plugins וה-skills המותקנים בסביבה: מה מסוגל לשפר את תהליך הפיתוח באופן מדיד, ומה רעש. כל המלצה נבדקה **מול נקודות הכאב המתועדות שלנו** (discipline §5/§10/§11, L1–L28, TEST-AUTHORING-CONTRACT, לוג ה-Phase 1 ב-`.superpowers/sdd/progress.md`), לא באופן גנרי.

**שיטת אימות:** כל כלי שמסומן "verified" הופעל או נבדק מקומית בתאריך הסקירה (probe ל-endpoint, `--help`, `--version`, קריאת מניפסט). כלי שנשען על תיעוד-web מצוין עם URL ותאריך. כלי שלא הצלחתי לאמת — נאמר במפורש.

---

## 1 · Verdict table (עמוד אחד)

| כלי / Tool | Status (verified 31.7) | Verdict | למה, במשפט אחד |
|---|---|---|---|
| **serena MCP** (HTTP :9121) | ✅ חי — probe החזיר 406 (=מאזין), v1.6.1, project פעיל | 🟢 להעמיק ניצול | הכלי המרכזי ל-Phase 3 (module extraction) — ואנחנו משתמשים ב-~40% ממנו |
| **graphify CLI** 0.9.25 | ✅ רץ; global graph 9 corpora | 🟢 להשלים התקנה | `hook install` לא הותקן — עדכון הגרף ידני הוא בדיוק כאב (d) |
| **Playwright CLI** 1.61.1 | ✅ מקומי (devDependency) | 🟢 לאמץ את לולאת הדיבוג | `--last-failed` + `--trace on` + show-trace קיימים ולא בשימוש — כאבים (a)+(b) |
| **Plugins — 53 enabled** | ✅ נספרו ב-settings.json | 🔴 לגזום ~35 | antigravity-awesome-skills לבדו מזריק ~1,000 שורות skills לכל prompt — דלק ל-L28 |
| **pr-review-toolkit** (agents) | ✅ agents זמינים | 🟢 לשלב בביקורת | silent-failure-hunter ו-pr-test-analyzer פוגעים בדיוק ב-L2/L3/L8 |
| **superpowers** (skills) | ✅ בשימוש חובה (§1) | 🟢 קיים — להשאיר | כבר עמוד השדרה של התהליך |
| **repo skills** (no-inert-shipment, verify-against-the-runtime-path) | ✅ קיימים | 🟢 להשאיר | נולדו מ-L8 ו-L23 — הם התהליך |
| **gh CLI** 2.96.0 | ✅ | 🟢 קיים — מספיק | מכסה את כל צרכי GitHub של ריפו-יחיד |
| **GitHub MCP** (plugin) | ✅ מחובר | 🟡 כפילות | חופף ל-gh; אין שינוי תהליך, לא להסתמך עליו |
| **wrangler** | ⚠️ לא מותקן — npx הוריד 4.116.0 בזמן הבדיקה | 🟡 ניסוי release-poll | `wrangler pages deployment list` יכול להחליף polling עיוור של §10.10 |
| **claude-mem MCP** | ❌ מנותק (נפל mid-session; אין tools) | 🟡 רק אם יתייצב | פוגע בכאב (g) על הנייר — אבל כלי שלא נמצא באופן אמין אינו תהליך |
| **context7 MCP** | ❌ מנותק mid-session | 🔴 לוותר | ה-graphify global (vendor-docs, 2,444 nodes) כבר פותר docs-lookup, ובאמינות מקומית |
| **playwright-MCP** | ❌ מנותק mid-session | 🔴 לוותר | הסוויטה + scripts מכסים; אוטומציית דפדפן דרך MCP רעוע = flake נוסף |
| **chrome-devtools MCP** | ❌ מנותק mid-session | 🔴 לוותר | לא הוכח יציב; ל-PWA שלנו ה-trace viewer של Playwright עדיף |
| **desktop-commander / firebase MCP** | ❌ מנותקים | 🔴 לוותר | אין להם שום נגיעה ל-stack (Cloudflare Pages, single-file PWA) |
| **typescript/pyright/rust-analyzer LSP plugins** | לא נבחנו לעומק | 🔴 לכבות | serena כבר נותן LSP ל-app.js ול-Python; rust אין בכלל |
| **vercel / supabase / storybook / kubernetes / huggingface plugins** | מותקנים | 🔴 לכבות | אין Vercel, אין DB, אין React, אין K8s, אין ML בפרויקט |
| **compound-engineering / taskmaster / task-orchestrator** | מותקנים | 🔴 לכבות | תהליך מקביל שלם לצד superpowers = שני תהליכים מתחרים |
| **greptile plugin** | לא אומת (שירות חיצוני) | 🔴 לדלג | לא אומת שרץ כאן; serena+graphify מכסים code-search |
| **Claude Code hooks** | `hooks: {}` — ריק | 🟡 ניסוי guard אחד | hook שחוסם `--retries/--workers` על הסוויטה היה תופס את L10 מכנית |

**עיקרון מנחה:** שרת שנפל באמצע session (שישה כאלה נצפו) אינו מועמד לתהליך — נקודה. תהליך נבנה רק על מה שנמצא שם בכל פעם.

---

## 2 · Already installed but wasted — הניצחונות הזולים ביותר

### 2.1 serena — ~60% מהיכולות אינן בשימוש (verified: `get_current_config` + `initial_instructions`, 31.7)

בשימוש היום: find_symbol, references, overview, replace_symbol_body, search_for_pattern. **לא בשימוש:**

| יכולת | מה היא נותנת | הכאב שהיא פותרת |
|---|---|---|
| `rename_symbol`, `safe_delete_symbol` | refactoring מודע-references — מעדכן/בודק את כל השימושים אטומית | **(c) module extraction** — Phase 3 ORCH על app.js בן ~9.5k שורות; זה הכלי, לא Edit ידני |
| `get_diagnostics_for_file` / `for_symbol` | אבחוני LSP מיידיים | gate זול לפני build+suite — תופס שגיאות סינטקס/סימבול בשניות במקום בריצת סוויטה (כאב b) |
| `replace_in_files` עם `dry_run` | אותו edit על פני קבצים רבים, עם preview-diff לפי occurrence | עבודות i18n רוחביות (כאב f) בלי סריקה ידנית |
| `write_memory` / `read_memory` | זיכרונות פרויקט שכל subagent רואה | **(g) אובדן הקשר** — עובדות onboarding שחוזרות בכל brief ידני היום |
| `query_project` (matkonet) | שאילתת פרויקט אחר בלי activation | השוואות מול matkonet |

**First command:** בתחילת Phase 3, כל חילוץ מודול נפתח ב-`find_referencing_symbols` על הסימבול המועמד ומסתיים ב-`rename_symbol`/`safe_delete_symbol` — לעגן זאת ב-brief של ה-subagent. **Risk:** rename על JS דינמי (מחרוזות, `window[...]`) לא ייתפס ע"י LSP — נשאר grep-verify אחרי rename. **מחליף:** עריכות Edit ידניות + סבבי grep.

הערה: §10.17a כבר מומש — שרת יחיד על 9121 (`scripts/serena-server.ps1`), `.mcp.json` מצביע עליו. זה תוקן; לא נדרש דבר.

### 2.2 graphify — hooks לא הותקנו, ו-skill ישן (verified: `graphify hook status`, 31.7)

- `graphify hook status` → **post-commit: not installed, post-checkout: not installed, merge driver: not registered.** כלומר עדכון הגרף הוא צעד ידני שנשכח — בדיוק כאב **(d)** ש-`check-graph-fresh.mjs` נאלץ לתפוס בדיעבד.
- אזהרת גרסה בכל הרצה: skill 0.9.22 מול package 0.9.25 → `graphify install`.
- יכולות שלא נוצלו מעולם (מ---help, verified):
  - **`affected "X"`** — reverse traversal: מה מושפע מ-X. כלי impact-analysis לפני עריכה — משלים את serena לכאב (c).
  - **`god-nodes`** — הצמתים המחוברים ביותר = מפת ה-hubs שממנה מתחילים module extraction.
  - **`benchmark`** — מדידת חיסכון טוקנים מול קריאת corpus מלא; מספק ראיה מדידה לערך הגרף.
  - **`export callflow-html`** — Mermaid architecture/call-flow; שימושי כ-artifact ל-owner לפני Phase 3.
  - **`query --budget N`** — כבר יש cap 2000; אפשר להדק ל-subagents קלים.
  - `watch` — פחות מתאים (ריצת רקע קבועה מתחרה על CPU — מפר את משמעת העומס); ה-hooks עדיפים.

**First commands:** `graphify install` ואז `graphify hook install`, ואימות `graphify hook status` ירוק. **Risk:** post-commit hook מוסיף שניות לכל commit (נתיב ה-`update` הוא AST-only, בלי LLM — זול); merge-driver נוגע ב-git config — לוודא שאינו מתנגש עם `scripts/sync-docs.sh`. **מחליף:** את הריצה הידנית של `graphify update` ואת רוב ההפעלות של `check-graph-fresh.mjs` כ-gate כושל (הוא נשאר כרשת ביטחון).

### 2.3 Playwright — כלי הדיבוג המובנים אינם בשימוש (verified: `npx playwright test --help`, v1.61.1, 31.7)

הכאבים (a) "סוויטה ירוקה שלא משתחזרת" ו-(b) "שעה על ריצות רקע" נובעים חלקית מכך שכל דיבוג רץ כ-full-suite:

- **`--last-failed`** — קיים ב-1.61 (verified), ו-`test-results/.last-run.json` כבר נכתב אצלנו. לולאת התיקון הופכת ל: fix → `npx playwright test --last-failed` (שניות-דקות) → ורק לסגירת DoD ריצה מלאה נקייה. **זה אינו סותר את §3.12** — ה-gate נשאר `npx playwright test` מלא; ה---last-failed הוא לולאת-הביניים בלבד.
- **`--trace on` + `npx playwright show-trace`** — פורנזיקה של flake (סגנון L15/L22) מתוך trace עם network/console/DOM snapshots במקום ניחושים. לפי §5: instrumentation לפני היפותזה — ה-trace הוא ה-instrumentation החינמי. (docs: https://playwright.dev/docs/trace-viewer, נצפה 31.7.)
- **`--only-changed [ref]`** — ריצת קבצי טסט שהשתנו בלבד; שימושי ל-smoke מהיר של subagent לפני שהוא מדווח "עשיתי", לפני הריצה המלאה של הבקר.
- **UI mode (`--ui`)** — לחקירה ידנית של ה-owner; לא לתהליך האוטומטי.

**First config change:** להוסיף ל-§11a שורה: "לולאת דיבוג = `--last-failed`; ראיית DoD = ריצה מלאה; flake → `--trace on` + show-trace לפני כל היפותזה". **Risk:** subagent שיצרף פלט `--last-failed` כראיית DoD — הניסוח ב-brief חייב לחסום זאת (אותה משמעת שכבר תפסה את L10). **מחליף:** ריצות full-suite מיותרות באמצע לולאת תיקון — החיסכון המרכזי בכאב (b).

---

## 3 · MCP servers — מצב מאומת

| Server | Config | Reachable (31.7) | הערכה |
|---|---|---|---|
| serena | `.mcp.json` → `http://127.0.0.1:9121/mcp` | ✅ (HTTP 406 ללא כותרות MCP = מאזין; tools עובדים) | ראו §2.1 |
| github (plugin) | plugin-managed | ✅ tools נטענים | כפילות מול gh; להשאיר, לא לבנות עליו תהליך |
| chrome-devtools | plugin | ❌ נותק mid-session; אין tools כעת | 🔴 |
| claude-mem | plugin (thedotmack) | ❌ נותק mid-session | 🟡 ראו §5 |
| context7 | plugin | ❌ נותק mid-session | 🔴 ראו §5 |
| desktop-commander | plugin | ❌ נותק mid-session | 🔴 אין צורך — יש Bash/PowerShell מובנים |
| firebase | plugin | ❌ נותק mid-session | 🔴 אין Firebase בפרויקט |
| playwright-MCP | plugin | ❌ נותק mid-session (נותרה שארית `.playwright-mcp/` בריפו) | 🔴 |

המסקנה המבנית: **שישה מתוך שמונה שרתי ה-MCP נפלו באמצע ה-session.** רק serena (שרת מקומי בבעלותנו, §10.17a) ו-github שרדו. לקח: MCP בבעלותנו ובשליטתנו = אמין; MCP צד-שלישי דרך plugin = לא תשתית תהליך.

---

## 4 · Plugins — 53 enabled, רובם רעש

נספרו **53 plugins enabled** ב-`~/.claude/settings.json` (verified 31.7). העלות אינה רק אסתטית: רשימת ה-skills המוזרקת לכל system prompt כוללת **מאות שורות מ-antigravity-awesome-skills לבדו** (azure-*, odoo-*, seo-*, threejs-*, leiloeiro-*...). זה context שכל agent — כולל כל subagent — משלם עליו בכל turn, והוא בדיוק סוג הרעש ש-L28 (שחיקת כללי-כלים בהקשר ארוך) מזהיר מפניו, וכאב (g).

### לכבות (🔴) — אין שום נגיעה ל-stack (single-file vanilla-JS PWA, Cloudflare Pages, Python build)
`antigravity-awesome-skills` (הגדול מכולם), `vercel`, `supabase`, `firebase`, `storybook-assistant`, `kubernetes-operations`, `huggingface-skills`, `rust-analyzer-lsp`, `typescript-lsp`, `pyright-lsp` (serena מכסה LSP), `frontend-excellence` (React/Next), `agent-sdk-dev`, `desktop-commander`, `greptile` (לא אומת), `firecrawl`, `taskmaster`, `task-orchestrator`, `compound-engineering` (תהליך מתחרה ל-superpowers), `10x-fullstack-engineer`, `ui-ux-pro-max`, `ui-designer` (×2), `visual-documentation-skills`, `document-skills`, `example-skills`, `context7` + `context7-docs-fetcher`, `chrome-devtools-mcp` (×2), `webapp-testing`, כפילויות `code-review`/`feature-dev`/`frontend-design` בין marketplaces.

### להשאיר (🟢)
`superpowers` (עמוד השדרה, §1) · `pr-review-toolkit` (ראו §6) · `code-review` (עותק אחד) · `feature-dev` (עותק אחד — code-explorer/code-architect שימושיים ל-Phase 3) · `github` · `commit-commands` · `serena` · `playwright` (ה-plugin המקומי, לא ה-MCP) · `claude-md-management`, `claude-code-setup`, `skill-creator`, `code-simplifier`, `security-guidance` — קטנים ולא מזיקים.

**First command:** ב-`/plugin` (או עריכת `enabledPlugins` ב-settings.json) לכבות את רשימת ה-🔴; להתחיל מ-antigravity-awesome-skills ומהכפילויות. **Risk:** כמעט אפס — הכל הפיך בדגל אחד. **מחליף/מוציא לגמלאות:** את עצמו — זה סעיף ה"retire" של הסקירה.

---

## 5 · Evaluate (🟡) — ניסויים מוגדרים

### 5.1 claude-mem — זיכרון persistant בין sessions
מה זה: PostToolUse hooks שדוחסים כל פעולה ל-observations (~500 טוקנים) ב-SQLite+FTS5, ומוזרקים ל-sessions הבאים (docs: https://docs.claude-mem.ai/introduction ו-https://github.com/thedotmack/claude-mem — נקראו 31.7; **לא אומת מקומית — השרת מנותק**). על הנייר פוגע בכאב (g). בפועל: נפל mid-session, ויש לנו כבר שלוש שכבות זיכרון (auto-memory, serena memories, graphify graph) — שכבה רביעית לא-אמינה עלולה להזיק.
**הניסוי:** התקנה מחדש/עדכון, שבוע עבודה אחד, ומדד הצלחה אחד: אפס ניתוקים + לפחות מקרה אחד בשבוע שבו observation חסך re-discovery מתועד. נכשל → לכבות סופית.

### 5.2 wrangler כ-release-verifier
`wrangler` אינו מותקן (npx מוריד אותו על כל הפעלה — verified 31.7). §10.10 היום = polling עיוור של ה-URL החי. `wrangler pages deployment list` נותן את סטטוס ה-deployment עצמו.
**הניסוי:** `npm i -D wrangler`, ואז ב-release הבא לשלב `wrangler pages deployment list --project-name=<name>` לפני ה-probe של Playwright. הצלחה: זמן-עד-אימות קצר יותר ואפס false-"live". דורש Cloudflare auth כ-secret קיים — **לא להכניס מפתח לריפו.**

### 5.3 Claude Code hook כ-guard מכני על הסוויטה
`hooks: {}` ריק היום. PreToolUse hook שמזהה `playwright test` עם `--retries` או `--workers` ודוחה — היה הופך את L10 מ"משמעת" ל"מכניקה".
**הניסוי:** hook אחד ויחיד, שבועיים, הצלחה = אפס חסימות-שווא. להיעזר ב-skill `update-config`. לא להרחיב מעבר לכך בלי ראיה — hooks הם קוד תהליך שגם אותו צריך לתחזק.

---

## 6 · pr-review-toolkit — ה-plugin האחד ששווה אימוץ פעיל (🟢)

ה-agents שלו (verified: מופיעים ברשימת ה-agent types) ממופים אחד-לאחד לכשלים ששילמנו עליהם:

| Agent | הכשל ההיסטורי שהיה נתפס |
|---|---|
| `silent-failure-hunter` | I-2 של Phase 1 (route בלי unroute ב-try/finally), fallbacks שבולעים שגיאות |
| `pr-test-analyzer` | L2/L3/L4 — טסטים שמאשרים שדה ולא effect; חורי כיסוי לפני "done" |
| `code-reviewer` | שכבת ה-§7 (שני reviewers) בלי לכתוב brief מאפס |
| `comment-analyzer`, `type-design-analyzer` | שוליים אצלנו (JS ללא types) — לא להשתמש |

**First use:** בביקורת ה-task הבאה, אחד משני ה-reviewers של §7 = `silent-failure-hunter` על ה-diff, השני = `pr-test-analyzer`. **Risk:** reviewers גנריים לא מכירים את חוקי ה-warm-page — ה-brief חייב להצביע על `tests/TEST-AUTHORING-CONTRACT.md`. **מחליף:** ניסוח ידני של briefs לביקורת מאפס בכל פעם.

---

## 7 · Skills — שורה תחתונה

- **superpowers** — בשימוש חובה, מוכח בלוג Phase 1 (T2 escalation, T3 systematic-debugging). להשאיר. ✅
- **repo skills** (`docs/process/skills/no-inert-shipment`, `verify-against-the-runtime-path`) — נולדו מ-L8/L23, קצרים, נאכפים. להשאיר. ✅
- **graphify skill** — לעדכן (`graphify install`, §2.2). 🟢
- **compound-engineering (24 skills), task-orchestrator, claude-mem skills, וכל קטלוג antigravity** — נעלמים עם כיבוי ה-plugins ב-§4. 🔴
- **dataviz / document-skills / example-skills** — לא רלוונטיים לפיתוח; אין נזק מלבד רעש הרשימה — נופלים עם §4.

---

## 8 · שלושת השינויים עם יחס ערך/מאמץ הטוב ביותר

1. **גיזום 53→~15 plugins** (כיבוי antigravity-awesome-skills + כל ה-🔴 ב-§4). מאמץ: **~15 דקות**, הפיך לחלוטין. ערך: הקטנת context קבועה לכל agent בכל turn — תקיפה ישירה של L28 וכאב (g), והאצת כל session.
2. **`graphify install` + `graphify hook install`**. מאמץ: **~5 דקות + אימות commit אחד**. ערך: כאב (d) — עדכון גרף אוטומטי ב-post-commit במקום צעד ידני שנשכח ונתפס רק ע"י gate.
3. **שדרוג לולאת הדיבוג של Playwright** — `--last-failed` ללולאה, `--trace on`+show-trace ל-flake, ריצה מלאה נשארת ה-gate היחיד של DoD. מאמץ: **~שעה** (עדכון §11a + שורת brief ל-subagents). ערך: כאבים (a)+(b) — פחות ריצות מלאות באמצע לולאה, ופורנזיקה של flake מראיות במקום ניחוש.

רביעי צמוד (נפתח עם Phase 3): ערכת ה-refactoring של serena (`rename_symbol`/`safe_delete_symbol`) + `graphify god-nodes`/`affected` כמפת הדרך של module extraction — כאב (c), עדיפות ה-roadmap העליונה.

---

## 9 · מה נשבר / לא אומת — בשקיפות מלאה

- **שישה שרתי MCP נותקו במהלך ה-session** (chrome-devtools, claude-mem, context7, desktop-commander, firebase, playwright-MCP) — אף אחד מהם אינו מומלץ לתהליך במצבו הנוכחי.
- **greptile** — לא אומת שפועל (שירות חיצוני, לא נבדק חיבור). לא מומלץ.
- **wrangler** — רץ רק דרך npx (לא מותקן); ההמלצה ב-§5.2 מותנית בהתקנה.
- **claude-mem** — ההבנה שלו נשענת על תיעוד web בלבד (URLs ב-§5.1); לא הופעל מקומית.
- אזהרת גרסה קבועה בכל הרצת graphify (skill 0.9.22 ≠ package 0.9.25) עד שירוץ `graphify install`.

---

## H9 · טבלת סיכום משימה

| שורה | תוכן |
|---|---|
| **לפני** | 53 plugins, 8 שרתי MCP (6 מהם נפלו), ו-CLI-ים עשירים — ללא תמונת-מצב אחת של מה מהם משרת את התהליך ומה רעש |
| **בוצע** | אינוונטריזציה מלאה ומאומתת (probes, --help, config), שיפוט כל פריט מול הכאבים המתועדים (a)–(g) ו-L1–L28, דו"ח החלטה ב-`docs/process/TOOLING-REVIEW-2026-07-31.md` עם 🟢/🟡/🔴 ופקודת-פתיחה לכל אימוץ; commit (ללא push) |
| **נותר** | ביצוע בפועל טעון אישור owner: גיזום ה-plugins, התקנת graphify hooks, עדכון §11a ללולאת ה---last-failed, ושלושת הניסויים המוגדרים ב-§5 |
| **מיקום מול ה-Roadmap** | משימת-תשתית לצד Phase 1 (3/14); אינה נוגעת בקוד המוצר; ממקסמת את הכלים לקראת Phase 3 (ORCH extraction) |
| **הבא** | החלטת owner על שלושת השינויים ב-§8 (המאמץ הכולל: פחות מחצי יום עבודה) |
