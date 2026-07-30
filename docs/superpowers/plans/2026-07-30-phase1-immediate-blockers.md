# Phase 1 · חוסמים מיידיים (Immediate Blockers) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 13 Phase-1 ledger items — A1 dictionary split (bundle 7.79MB → ~2.1MB) + N-2 LANGNAME fix, A2 P0-worker hardening (B19–B22, E14, H-3 — fail-closed, debit-first, rate-limit, CORS), N-4 SYNCABLE manifest + N-1 backup-leak fix, Dec-D6 safe export/import, N-5 Dec-A3 preservation duties, and the three cheap security fixes B24/B25/E15 — plus the H13-gated recovered items R-2/R-3 (spoken-"verified"-marker redesign), ending in a live, verified release.

**Architecture:** The single-file PWA (`build.py` inlines `app.js`+`app.css`+data into `dist/index.html`) deliberately breaks the single-file principle for language dictionaries only (Dec-A1/Dec-A3): per-language `lang-<code>.json` files are emitted beside `index.html` and fetched on demand; a tiny embedded `I18N_META` keeps the picker/offline-Hebrew intact. The Cloudflare Worker (`worker/index.js`) becomes fail-closed end-to-end, tested in the real-workerd vitest harness (`worker/test/index.spec.js`, PRE-3). `SYNCABLE` — an explicit allowlist manifest in `app.js` — becomes the single definition of "user data" for backup AND the seed of the future sync schema (Dec-D2).

**Tech Stack:** Python `build.py` (no new deps) · vanilla JS `app.js` · Cloudflare Worker + KV, vitest `@cloudflare/vitest-pool-workers` (already installed under `worker/`) · Playwright suite (warm-page fixtures, `tests/_fixtures.ts`).

## Global Constraints

Every task's requirements implicitly include this section.

- **DoD-12 per task (discipline §3):** spec trace · RED witnessed (a test that passes on first run is void) · GREEN with output pasted · behavioural assertions · consumer named · fixture minimality + negative case · regression red-green for bugfixes · 390×844 screenshot for any UI change · Hebrew check (no English leak; `dir="ltr"` islands for numeric readouts, L13) · **safety invariance (DoD-10): no `bcheck` stage, `temp`, `safe` value, or cook duration altered anywhere in this phase — every task's diff is confined to the files it names, none of which is `data.py`/`sources.py`** · no arbitrary waits (`waitForFunction`/web-first assertions only, never `waitForTimeout`) · full suite green.
- **Suite gate (H7):** per task = ONE clean `npx playwright test` — plain, no `--retries`, no `--workers`, exit code shown. Release (Task 14) = TWO clean runs. Worker tasks additionally run `npm test` inside `worker/`.
- **§11a:** stop any manual server on port 8123 before a suite run; never run two suite runs concurrently; never run the suite while heavy subagents compete for CPU; after `python build.py`, restart any manual `serve.js` before a UI check; let runs COMPLETE.
- **SECRETS NEVER ENTER THE REPO:** `GEMINI_KEY` exists only as a Worker secret (`wrangler secret put`). No step in this plan prints, hardcodes, or commits a key or a live access code. Worker tests use mocked fetch + fake codes only.
- **Serena first (§10.17):** every task that touches existing code names its symbols; locate them with `mcp__serena__find_symbol` (e.g. `name_path: "exportData"`, `relative_path: "app.js"`) and edit with symbol-aware tools; grep is declared fallback.
- **H13 (discipline §16):** Task 13 (R-2/R-3) is ⚠️R-gated — its first step is the Recovery Relevance Gate ending in a **mandatory STOP for a joint owner decision**. No implementation before the verdict.
- **H14 (discipline §17):** the release task ships `docs/releases/v278-ux-report.md` as a deliverable (adjust NNN if the version number moved).
- **Waiver Gate (§4):** no requirement below may be waived/deferred/reinterpreted in this plan's execution without raising it to the owner in conversation.
- **Commits:** every commit message ends with the standard trailer:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01FkEz5H2BEqg4KCagBicAXr`.

**Spec sources (trace targets):** `docs/ROADMAP-2026-07-30.md` Phase 1 + §5a rows R-2/R-3 · `docs/ROADMAP-task-cards.md` cards 1.1–1.7 · `docs/research/v5-engine/DECISION-REGISTER.md` A1/A2/A3/D6 · gap details: `docs/analysis/gap-status-parts/part-AB.md` (B19–B25), `part-CDE.md` (E14/E15), `part-FGH.md` (H-3) · `docs/analysis/program/new-gaps-2026-07-24-p0-app.md` G-A1/G-A2 (+addendum) · `docs/analysis/program/PRE-3-worker-harness-design.md`.

**Task ordering / parallelism:** Tasks 1→2→3 sequential (A1). Task 4, 5 after Task 1. Tasks 6→7 sequential (worker; independent of A1). Tasks 8→9 sequential. Tasks 10, 11, 12 independent. Task 13 can start any time but STOPS at the owner gate. Task 14 last. Under the §10.5a concurrency ceiling — and NEVER two Playwright suite runs at once — effective execution is serial per task anyway.

---

### Task 1: A1a — build.py dictionary split (emit `lang-<code>.json`, embed only `I18N_META`)

**Spec trace:** ROADMAP Phase 1 "A1 פיצול מילונים"; Dec-A1 ("לפצל את מילוני השפות מהחבילה — מיד"; 5.68MB of 7.79MB are dictionaries); task card 1.1 ("bundle ~2.1MB"); Dec-A3 (the split is the sanctioned break of the single-file principle).

**Files:**
- Modify: `build.py` (lines ~646–647 — `I18N_DICTS_JSON` + the `html = HTML.replace(...)` chain; and the dist-writing block ~656–700)
- Modify: `app.js:8669` — the `const I18N_DICTS = __I18N_DICTS__;` placeholder line ONLY (the runtime loading logic is Task 2; this task makes the placeholder swap compile)
- Modify: `serve.js` — the `TYPES` map (add `.json`)
- Test: `tests/i18n-split.spec.ts` (new)

**Interfaces:**
- Produces: `dist/lang-<code>.json` — one merged dictionary per active language (exact bytes of build-time `_i18n[code]`, minified JSON); embedded `__I18N_META__` → `{code:{name,dir}}`; app.js globals `I18N_META` (object) and `I18N_DICTS` (initially `{}`, the runtime cache Task 2 fills).
- Consumes: existing `_i18n` merged dicts and Guards A/B/C/D in `build.py` — **all four guards keep running unchanged over `_i18n` BEFORE emission** (guard compatibility is by construction: they never depended on inlining).

- [ ] **Step 1: Write the failing test**

```ts
// tests/i18n-split.spec.ts — Dec-A1: dictionaries live OUTSIDE the bundle.
import { test, expect } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('A1 dictionary split (build artifact)', () => {
  test('dist/index.html is lean and carries META, not dictionaries', async () => {
    const html = readFileSync(resolve(process.cwd(), 'dist/index.html'), 'utf8');
    // ~2.1MB expected; 2.6MB is the guard ceiling (was 7,791,592 bytes on v277)
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(2_600_000);
    expect(html).toContain('I18N_META');
    // a real French dictionary value must NOT be inlined anymore
    const fr = JSON.parse(readFileSync(resolve(process.cwd(), 'dist/lang-fr.json'), 'utf8'));
    expect(fr['קטלוג']).toBe('Catalogue');           // the split file carries the dict…
    expect(html).not.toContain('"קטלוג":"Catalogue"'); // …and the bundle does not
  });

  test('every active language ships as lang-<code>.json and is served', async ({ warm }) => {
    for (const code of ['en', 'fr', 'de', 'es', 'it']) {
      const r = await warm.request.get(`/lang-${code}.json`);
      expect(r.status(), `lang-${code}.json`).toBe(200);
      const d = await r.json();
      expect(Object.keys(d).length).toBeGreaterThan(100);
      expect(d.__meta__ && d.__meta__.name).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/i18n-split.spec.ts`
Expected: FAIL — `dist/index.html` is ~7.79MB (`toBeLessThan(2_600_000)` fails) and `/lang-en.json` returns 404. Paste the output.

- [ ] **Step 3: build.py — replace the dict inlining with META + per-language emission**

Replace lines 646–647 (`I18N_DICTS_JSON = json.dumps(...)` and the `html = HTML.replace(...)` chain) with:

```python
# ── Dec-A1 (Phase 1): dictionaries are NOT inlined. Only a tiny META map ships in the bundle;
# each language's merged dict is written to dist/lang-<code>.json and fetched on demand by app.js.
# Guards A/B/C/D above still ran over the FULL merged _i18n — the split changes packaging, not gating.
_i18n_meta = {}
for _code in sorted(_active_langs):
    _mm = (_i18n[_code].get("__meta__") or {})
    _i18n_meta[_code] = {"name": _mm.get("name") or _code, "dir": _mm.get("dir") or "ltr"}
I18N_META_JSON = json.dumps(_i18n_meta, ensure_ascii=False)
html = HTML.replace("__CSS__", _css).replace("__JS__", _eqm + "\n;\n" + _js).replace("__DATA__", "JSON.parse(" + _js_str(DATA_JSON) + ")").replace("__I18N_META__", "JSON.parse(" + _js_str(I18N_META_JSON) + ")").replace("__WHATS_NEW__", WHATS_NEW)
# A1 bundle guard — the split may never silently regress (Dec-A1: 73% of 7.79MB was dictionaries).
_html_bytes = len(html.encode("utf-8"))
assert _html_bytes < 2_600_000, "A1: dist/index.html is %d bytes — dictionaries must stay OUT of the bundle (Dec-A1)" % _html_bytes
```

And AFTER the `dist` directory exists (right after the `with open(_os.path.join(_dist, "index.html")...` block, ~line 659), add:

```python
# Dec-A1: one merged dictionary file per active language, beside index.html.
for _code in sorted(_active_langs):
    with open(_os.path.join(_dist, "lang-%s.json" % _code), "w", encoding="utf-8") as f:
        json.dump(_i18n[_code], f, ensure_ascii=False, separators=(",", ":"))
```

- [ ] **Step 4: app.js — swap the placeholder line**

Locate with serena: `mcp__serena__find_symbol` `name_path: "I18N_DICTS"` in `app.js` (line 8669). Replace:

```js
const I18N_DICTS = __I18N_DICTS__;
```

with:

```js
const I18N_META = __I18N_META__;   // {code:{name,dir}} — Dec-A1: only META ships in the bundle
const I18N_DICTS = {};             // runtime cache: code -> dict, filled by loadLangDict (Task 2)
```

And on the next line change `I18N_LANGS` to derive from META (same shape, still `{he:'עברית', ...}`):

```js
const I18N_LANGS = (function(){ const o={he:'עברית'}; try{ Object.keys(I18N_META).forEach(function(k){ o[k]=(I18N_META[k]||{}).name||k; }); }catch(e){} return o; })();
```

- [ ] **Step 5: serve.js — add the JSON MIME type**

In the `TYPES` map add:

```js
'.json': 'application/json',
```

- [ ] **Step 6: Update `_headers` for the new files**

In `build.py`'s `_headers` write (~line 697), add one rule (Task 12 rewrites this block wholesale and preserves the line):

```python
"/lang-*.json\n  Cache-Control: no-cache\n"
```

- [ ] **Step 7: Build and run the new spec**

Run: `python build.py && npx playwright test tests/i18n-split.spec.ts`
Expected: build prints Guard A/B/C/D OK lines exactly as before, then PASS. Paste output + exit code.
NOTE: language *switching* is broken between Task 1 and Task 2 (cache is empty and nothing fills it) — that is why Tasks 1+2 are committed and suite-gated together in Task 2 Step 7. Do NOT run the full suite at the end of Task 1.

- [ ] **Step 8: Commit (with Task 2 — see Task 2 Step 8)**

---

### Task 2: A1b — on-demand dictionary loading in app.js

**Spec trace:** task card 1.1 "החלפת שפה עובדת בכל 7 השפות החיות"; Dec-A1; §10.19 per-language verification is at the rendered DOM.

**Files:**
- Modify: `app.js` — symbols `setLang` (8680), `getLang` (8676), boot area near `applyLang` first call; new symbol `loadLangDict`
- Test: `tests/i18n-split.spec.ts` (extend)

**Interfaces:**
- Produces: `loadLangDict(code) -> Promise<dict|null>` (resolves `null` for `'he'`; caches into `I18N_DICTS[code]`); `window.__mkLangReady` — a Promise that resolves once the boot-time language (from `mk-lang`) has been fetched and applied (or immediately for `he`); `setLang(l)` becomes async-safe but keeps its synchronous signature.
- Consumes: `I18N_META`/`I18N_DICTS` from Task 1; existing `getDict` (8681), `applyLang` (8748), `toast`, `L` — all unchanged.

- [ ] **Step 1: Write the failing tests (extend tests/i18n-split.spec.ts)**

```ts
test.describe('A1 on-demand language loading (runtime)', () => {
  test('switching to French fetches the dict and renders French chrome', async ({ warm }) => {
    // real click path: home → the language row flags (data-setlang buttons)
    await warm.evaluate(() => (window as any).__mkLangReady);
    const fr = warm.locator('[data-setlang="fr"]').first();
    await fr.click();
    // rendered-DOM assertion (§10.19): the bottom-nav catalog label becomes French
    await expect(warm.locator('[data-cnav="catalog"]')).toContainText('Catalogue');
    await expect(warm.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('boot with a stored non-he language applies it after the dict loads', async ({ warm }) => {
    await warm.evaluate(() => { localStorage.clear(); localStorage.setItem('mk-lang', JSON.stringify('en')); });
    await warm.reload({ waitUntil: 'domcontentloaded' });
    await warm.evaluate(() => (window as any).__mkLangReady);
    await expect(warm.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a failed dict download keeps the previous language and says so (negative case)', async ({ warm }) => {
    await warm.evaluate(() => { localStorage.clear(); });
    await warm.reload({ waitUntil: 'domcontentloaded' });
    await warm.route('**/lang-de.json', r => r.abort());
    await warm.locator('[data-setlang="de"]').first().click();
    await expect(warm.locator('.toast, [class*="toast"]').first()).toBeVisible();
    await expect(warm.locator('html')).toHaveAttribute('lang', 'he');   // stayed on Hebrew
    await warm.unroute('**/lang-de.json');
  });
});
```

(If the language row is not visible on the warm page's initial screen, open it via the real UI path first — `serena find_referencing_symbols langRowHtml` shows the hosting panel; adjust the click path, never `page.evaluate(setLang)`.)

- [ ] **Step 2: Run to verify RED**

Run: `npx playwright test tests/i18n-split.spec.ts`
Expected: the three new tests FAIL (`__mkLangReady` undefined / switch does nothing — cache never filled). Paste output.

- [ ] **Step 3: Implement `loadLangDict` + async `setLang` + boot hydration**

Insert directly under the `I18N_LANGS` line (serena: `insert_after_symbol` on `I18N_LANGS`):

```js
// Dec-A1: fetch a language's dictionary on demand; cache per session. he needs no dict.
function loadLangDict(code){
  if(code==='he') return Promise.resolve(null);
  if(I18N_DICTS[code]) return Promise.resolve(I18N_DICTS[code]);
  if(!I18N_META[code]) return Promise.reject(new Error('unknown-lang:'+code));
  return fetch('lang-'+code+'.json').then(function(r){
    if(!r.ok) throw new Error('lang-http-'+r.status);
    return r.json();
  }).then(function(d){ I18N_DICTS[code]=d||{}; return I18N_DICTS[code]; });
}
```

Replace `setLang` (app.js:8680) with:

```js
function setLang(l){ if(l!=='he' && !I18N_LANGS[l]) return;
  if(l==='he' || I18N_DICTS[l]){ store.set('mk-lang',l); applyLang(); return; }
  loadLangDict(l).then(function(){ store.set('mk-lang',l); applyLang(); })
    .catch(function(){ if(typeof toast==='function') toast('⚠ '+L('טעינת השפה נכשלה — בדוק את החיבור ונסה שוב','Language download failed — check your connection and try again')); });
}
```

Boot hydration — place immediately after the block above (top-level, runs once at parse time, before the deferred first `applyLang`):

```js
// Boot: if the stored language is non-Hebrew, fetch its dict then repaint. Hebrew paints instantly.
// Tests await window.__mkLangReady instead of sleeping (DoD-11).
window.__mkLangReady = (function(){
  var l = getLang();
  if(l==='he') return Promise.resolve();
  return loadLangDict(l).then(function(){ try{ applyLang(); }catch(e){} })
    .catch(function(e){ try{ console.warn('[i18n] boot dict load failed', e); }catch(_){} });
})();
```

`getDict()` and `applyLang()` need NO change — they already read `I18N_DICTS[getLang()]||{}`.

- [ ] **Step 4: Run the spec to GREEN**

Run: `python build.py && npx playwright test tests/i18n-split.spec.ts`
Expected: PASS, all tests. Paste output.

- [ ] **Step 5: Hebrew + visual check (DoD-8/9)**

The failure toast is user-facing: screenshot at 390×844 with the toast visible in Hebrew (drive the negative-case flow manually via Playwright screenshot in the test or a one-off script); attach and look at it. Verify no English leak in he-mode.

- [ ] **Step 6: Sweep the existing i18n suite onto the async boundary**

Run: `npx playwright test tests/i18n-foundation.spec.ts tests/wave5-lang-switcher.spec.ts tests/i18n-names.spec.ts tests/i18n-entables.spec.ts tests/wave5-recipe-i18n.spec.ts tests/i18n-completeness.spec.ts`
Any test that seeded `mk-lang` and asserted translated DOM immediately after reload now needs ONE added line before its first assertion (a condition wait, not a timeout):

```ts
await page.evaluate(() => (window as any).__mkLangReady);
```

Apply exactly that pattern wherever such a failure appears; re-run until this subset is green. List every file touched in the task report.

- [ ] **Step 7: Full suite ×1 (gates Tasks 1+2 together)**

Run: `npx playwright test`
Expected: exit 0, no failures (an intermittent failure is a bug — systematic-debugging, never a re-run). Paste tail + exit code.

- [ ] **Step 8: Commit Tasks 1+2**

```bash
git add build.py app.js serve.js tests/i18n-split.spec.ts tests/i18n-*.spec.ts tests/wave5-*.spec.ts
git commit -m "feat(i18n): Dec-A1 dictionary split — lang-<code>.json on demand, bundle 7.8MB->~2.1MB (A1, Phase 1)"
```

---

### Task 3: A1c — offline behavior: the split must not break the SW offline shell

**Spec trace:** Dec-A3 preservation duty #1 ("SW אופליין-shell"); task card 1.5; ROADMAP §0.8 (Dec-A3 continuing policy). The product is ONLINE-FIRST, but the offline shell (phone by the smoker) is a named preservation duty.

**Files:**
- Test: `tests/service-worker.spec.ts` (extend — this spec runs in the `service-worker` Playwright project where SWs are enabled)

**Interfaces:**
- Consumes: the generated `dist/sw.js` fetch handler (build.py ~673–692) — its existing runtime cache-first branch for non-navigate same-origin GETs already caches `lang-<code>.json` after first fetch. **No SW code change is expected** — this task PROVES the property with a test; if the test exposes a hole, fix the SW template in `build.py` (the fetch branch) and note the deviation.

- [ ] **Step 1: Write the failing-or-proving test**

```ts
// service-worker project: lang files survive offline once fetched (Dec-A3 duty #1).
test('a fetched language dict is served from the SW cache when offline', async ({ page, context }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // fetch the dict once online (the SW runtime-caches same-origin GETs)
  const first = await page.evaluate(() => fetch('lang-en.json').then(r => r.status));
  expect(first).toBe(200);
  await context.setOffline(true);
  const offline = await page.evaluate(() => fetch('lang-en.json').then(r => r.status).catch(() => 0));
  expect(offline).toBe(200);      // cache-first branch must serve it
  await context.setOffline(false);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/service-worker.spec.ts`
Expected: this exact test may PASS on first run because the SW's existing cache-first branch already covers it — **that is acceptable ONLY with the RED variant witnessed**: temporarily change the fetched path to a name the SW never saw (`lang-zz.json` → expect 0/failed) and paste that run as the "fails for the intended reason" evidence, then restore. Both outputs pasted.

- [ ] **Step 3: Full suite ×1, commit**

Run: `npx playwright test` → exit 0.

```bash
git add tests/service-worker.spec.ts
git commit -m "test(sw): prove lang-<code>.json offline survival — Dec-A3 preservation duty 1 (A1c)"
```

---

### Task 4: N-2 — LANGNAME tells the truth (drop dictionary-less languages, guard both directions)

**Spec trace:** ROADMAP Phase 1 "תיקון `LANGNAME`/ar (N-2)"; GAP-DELTA N-2 ("`LANGNAME` lists ar with no dictionary — M-1 breaks on the next language merge"); task card 1.1 ("ar אינה מוצעת עד שיש לה מילון"); Language Thread ("ar דורש את תיקון LANGNAME מ-Phase 1").

**Files:**
- Modify: `app.js:8672` — symbol `LANGNAME`
- Modify: `build.py` — the M-1 guard block (~lines 419–439)
- Test: the build itself is the test (M-1 is an existing build gate; we add its inverse)

**Interfaces:**
- Produces: `LANGNAME` containing exactly `en` + the active dictionary languages; build guard "M-1-inverse": every non-`he` LANGNAME key must be an active language.
- Consumes: `aiJSON` (`LANGNAME[outLang]||'English'`) and `mtTranslate` (`LANGNAME[lang]||lang`) — both have safe `||` fallbacks, so shrinking the map cannot crash them (verify with `mcp__serena__find_referencing_symbols` `name_path: "LANGNAME"`).

- [ ] **Step 1: Add the inverse guard to build.py (RED first)**

Immediately after the existing `_missing_from_langname` block (~line 439), add:

```python
# N-2 (Phase 1): the inverse of M-1 — LANGNAME may not CLAIM a language that has no dictionary.
# ar shipped in LANGNAME with no lang/ar.json; the next queued merge (ar is #22) would then skip the
# conscious "add LANGNAME + RTL check" step. Both directions now fail the build.
_extra_in_langname = sorted(_langname_keys - _active_langs - {"en"})
if _extra_in_langname:
    print("[i18n:N-2] LANGNAME lists language(s) with no dictionary under lang/: %s" % _extra_in_langname)
    print("[i18n:N-2] remove them from `const LANGNAME={...}` (app.js) — a language is offered only when its dict ships.")
    _sys.exit(1)
```

- [ ] **Step 2: Run the build to witness RED**

Run: `python build.py`
Expected: FAIL with `[i18n:N-2] ... ['ar', 'ru']`. Paste output (this is the RED — the guard catches the live defect).

- [ ] **Step 3: Fix LANGNAME in app.js**

Replace the `LANGNAME` literal (app.js:8672) with:

```js
const LANGNAME={en:'English',es:'Spanish',fr:'French',de:'German',it:'Italian'};   // code→language-name (aiJSON outLang + mtTranslate). N-2 (Phase 1): entries exist ONLY for shipped dictionaries — build guard M-1 (active⊆LANGNAME) + N-2 (LANGNAME⊆active∪{en}) enforce both directions; ar/ru return when their dicts merge (Language Thread order fixed by owner).
```

(`LANG_FLAG` on 8671 keeps its ar/ru emoji entries — it is a cosmetic map with a `'🌐'` fallback, not a capability claim.)

- [ ] **Step 4: GREEN + suite ×1 + commit**

Run: `python build.py` → prints the i18n guard OK lines, exits 0. Then `npx playwright test` → exit 0. Paste both.

```bash
git add app.js build.py
git commit -m "fix(i18n): N-2 — LANGNAME may only list shipped dictionaries; two-way build guard (Phase 1)"
```

---

### Task 5: N-5 — Dec-A3 preservation duties declared as standing policy

**Spec trace:** ROADMAP Phase 1 "N-5 הצהרת חובות השימור של Dec-A3"; Dec-A3 ("מחייב לשמור במפורש: SW אופליין · מסלול TWA · רתמת הבדיקות"); task card 1.5.

**Files:**
- Create: `docs/process/single-file-preservation.md`
- Modify: `docs/process/checklists/arc-close.md` — add one checklist line referencing the three duties (phase-gate hook)

**Interfaces:**
- Produces: the named policy document that every later Phase gate checks (task card: "שלוש החובות נקובות ונבדקות בשערי ה-Phase הבאים").

- [ ] **Step 1: Write the policy document**

```markdown
# חובות השימור של החלטת החד-קובץ (Dec-A3 · N-5 · Phase 1)

> Dec-A3 (רגיסטר ההחלטות, 30.7): "PWA חד-קובץ = ברירת מחדל, לא עיקרון". פיצול המילונים (Dec-A1)
> שובר את החד-קבציות במכוון. ההחלטה מחייבת שלוש חובות שימור מפורשות — כל שינוי אריזה עתידי
> (bundler, פיצול נוסף, מיניפיקציה F-10) נבדק מולן בשער ה-Phase שלו.

## שלוש החובות

1. **SW אופליין-shell.** `dist/sw.js` ממשיך לתת boot מלא אופליין בעברית, ושפה שנטענה פעם אחת
   ממשיכה לעבוד אופליין (הוכחה חיה: `tests/service-worker.spec.ts` — בדיקת lang-offline של Phase 1).
2. **תאימות TWA.** האפליקציה נשארת ניתנת לאריזת TWA ל-Play (F-24/F-25, Phase 12): כל הנכסים
   same-origin, `manifest.webmanifest` בתוקף, אין תלות בפרוטוקול שאינו https.
3. **רתמת הבדיקות.** ארכיטקטורת ה-warm-page (`tests/_fixtures.ts`) ממשיכה לעבוד: המסמך הראשי
   נטען מ-buffer; כל תת-משאב חדש (כמו `lang-<code>.json`) חייב להיות מוגש על-ידי `serve.js`
   מתוך `dist/` — קובץ שנוסף ל-build נבדק שהוא אכן מוגש (Playwright request probe).

## אכיפה

- שער כל Phase שנוגע באריזה/build: שלוש שורות ✔ מול שלוש החובות, עם שם הבדיקה המוכיחה.
- `docs/process/checklists/arc-close.md` מפנה לכאן.
```

- [ ] **Step 2: Add the arc-close checklist line**

Append to `docs/process/checklists/arc-close.md`:

```markdown
- [ ] חובות השימור של Dec-A3 (docs/process/single-file-preservation.md) — נבדקו אם הקשת נגעה ב-build/אריזה.
```

- [ ] **Step 3: Commit (docs-only; no suite run needed — no code changed; state that explicitly in the task report)**

```bash
git add docs/process/single-file-preservation.md docs/process/checklists/arc-close.md
git commit -m "docs(policy): N-5 — Dec-A3 single-file preservation duties declared + arc-close hook (Phase 1)"
```

---

### Task 6: A2a — Worker fail-closed core: corrupt-KV, stream route, upstream timeout, health leak

**Spec trace:** ROADMAP Phase 1 "A2 P0-worker — 9 פערי B19–B22/E14/H-3"; gap rows: B20 ("fails OPEN on a corrupted KV record", `worker/index.js:56`), B19 ("token cap bypassed by `:streamGenerateContent`", `:43`), B22 ("no timeout/AbortController", `:66-70`), E14 ("health leaks `hasKey`", `:39`); H-3 ("fail-open" blocker). Dec-A2. The app NEVER calls `streamGenerateContent` (verified: 0 hits in `app.js`), so dropping the route is fail-closed and regression-free.

**Files:**
- Modify: `worker/index.js`
- Test: `worker/test/index.spec.js` (the PRE-3 real-workerd harness — flip the deliberate `it.fails` and extend)

**Interfaces:**
- Produces: error contract additions — `403 {error:'code_record_corrupt'}`, `404` for `:streamGenerateContent`, `504 {error:'upstream_timeout'}`; health body `{ok:true, service:'matkonet-ai'}` (no `hasKey`). Task 7 builds on this file state.
- Consumes: harness helpers `post()`, `geminiOkResponse()`, `env.CODES`, `vi.spyOn(globalThis,'fetch')`.

- [ ] **Step 1: Flip the D1 characterisation test to its fixed form and add the three new REDs**

In `worker/test/index.spec.js`: delete `.fails` from the D1 test and assert the fixed contract; add stream/timeout/health tests:

```js
describe('D1 — fail-CLOSED on a malformed KV record (P0-worker fix)', () => {
  it('a non-JSON KV record is rejected with 403, never served', async () => {
    await env.CODES.put('code:corrupt', 'not-valid-json{]');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(999));
    const response = await post(GENERATE_URL, 'corrupt');
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('code_record_corrupt');
    expect(fetchSpy).not.toHaveBeenCalled();          // never reaches Gemini
  });
});

describe('B19 — streaming route is closed (app never calls it)', () => {
  it('POST :streamGenerateContent returns 404 and no upstream call', async () => {
    await env.CODES.put('code:streamer', JSON.stringify({ active: true, cap: 1000, used: 10 }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await post(STREAM_URL, 'streamer');
    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('B22 — upstream timeout', () => {
  it('an aborted upstream fetch maps to 504 upstream_timeout', async () => {
    await env.CODES.put('code:slow', JSON.stringify({ active: true, cap: 1000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')));
    const response = await post(GENERATE_URL, 'slow');
    expect(response.status).toBe(504);
    expect((await response.json()).error).toBe('upstream_timeout');
  });
});

describe('E14 — health endpoint does not leak configuration', () => {
  it('GET / carries no hasKey field', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/`, { method: 'GET' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect('hasKey' in body).toBe(false);
  });
});
```

Also update the existing "D2 (bonus) — streamGenerateContent bypasses metering" describe: it characterised the old bypass; replace its assertion with the new 404 contract (or delete it in favor of the B19 test above — do the latter and say so in the report).

- [ ] **Step 2: Run the worker suite to witness RED**

Run (from `worker/`): `npm test`
Expected: the 4 new/changed tests FAIL against the current worker (corrupt → 200, stream → 200, no timeout path, hasKey present). Paste output.

- [ ] **Step 3: Implement in worker/index.js**

Apply these edits (the full Task-6-state of the changed regions):

```js
// health check — E14: never reveal configuration state to an unauthenticated caller
if (request.method === 'GET' && url.pathname === '/') {
  return json({ ok: true, service: 'matkonet-ai' }, 200);
}

// only proxy generateContent. B19 (Phase 1): the streaming route is CLOSED — the app has zero
// callers of :streamGenerateContent, and the metering below cannot parse a streamed body, so
// admitting it was an unmetered bypass. Re-opening requires stream-aware metering first.
if (request.method !== 'POST' || !/^\/v1beta\/models\/[^/]+:generateContent$/.test(url.pathname)) {
  return json({ error: 'not_found' }, 404);
}
```

```js
let rec;
try { rec = JSON.parse(raw); } catch { rec = null; }
// B20/H-3 (Phase 1): FAIL CLOSED. A corrupt/unparseable/non-object KV record means the admin
// contract is broken — refuse, never synthesize `{active:true}` (the old fail-open).
if (!rec || typeof rec !== 'object') return json({ error: 'code_record_corrupt' }, 403);
```

```js
const UPSTREAM_TIMEOUT_MS = 60_000;   // B22: a hung Gemini call may not pin the request forever
// ...
let gResp;
try {
  gResp = await fetch(GEMINI_BASE + url.pathname + url.search, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
    body,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
} catch (e) {
  if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
    return json({ error: 'upstream_timeout' }, 504);
  }
  return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
}
```

- [ ] **Step 4: GREEN**

Run (from `worker/`): `npm test`
Expected: all tests pass (including the untouched metering/CORS characterisation tests). Paste output + exit code.

- [ ] **Step 5: App suite ×1 (worker change cannot affect it, but DoD-12 line 12 is unconditional)**

Run: `npx playwright test` → exit 0. Paste tail.

- [ ] **Step 6: Commit**

```bash
git add worker/index.js worker/test/index.spec.js
git commit -m "fix(worker): fail-closed core — corrupt-KV 403, stream route closed, upstream timeout, health leak (B19/B20/B22/E14 part, H-3, Phase 1)"
```

---

### Task 7: A2b — Worker metering integrity + rate-limit + CORS + cap-required

**Spec trace:** B21 ("usage counter is a read-modify-write race", TOCTOU), H-3 ("cap-by-omission, TOCTOU, zero rate limiting … no `429`/`Retry-After`/debit-first"), E14 ("CORS `*`, no rate limit, shareable bearer code, `cap:0` unmetered"); PRE-3 design D3 acceptance ("assert the final `used` reflects all N increments"). Live app origin: `https://matkonetesh.pages.dev` (discipline §10.10); test origin `http://localhost:8123` (§11a).

**Files:**
- Modify: `worker/index.js`
- Modify: `worker/README.md` — ops note: every code record now REQUIRES a positive numeric `cap` (cap-by-omission is refused)
- Test: `worker/test/index.spec.js`

**Interfaces:**
- Produces: `withCodeLock(code, fn)` per-isolate serializer; debit-first metering (reserve `RESERVE_TOKENS=2000`, reconcile to actual); `429 {error:'rate_limited'}` + `Retry-After`; `403 {error:'code_uncapped'}` for records without positive numeric `cap`; CORS reflected only for allowlisted origins (`env.ALLOWED_ORIGINS` comma-list var, defaulting to the app origin + localhost:8123).
- Consumes: Task 6 file state. **Honest scope note (goes verbatim into the worker comment):** the lock serializes within one isolate — cross-isolate concurrency still rides KV's eventual consistency; debit-first bounds that exposure to one reserve per isolate. The atomic cross-isolate fix is a Durable Object and lands with the Sync Thread (S1) — trigger-anchored, not silent (H8).

**🧑 אישור בעלים (2026-07-30):** שתי ברירות-המחדל התפעוליות של המשימה **אושרו במפורש** — (1) רשומת
קוד-גישה ללא `cap` חיובי **נדחית ב-403** (`code_uncapped`; אין "cap-by-omission"), (2) **rate-limit
ברירת-מחדל: 20 בקשות/דקה פר קוד**. לשון הבעלים: "משימה 7 אין התנגדות מקובל". אין להחליף/לרכך אותן
ללא פנייה חוזרת (§4).

- [ ] **Step 1: Rewrite the D3 race test as the fixed contract + add the three new REDs**

Replace the "D3 (bonus)" describe's final assertions (`expect(rec.used).toBe(TOKENS_PER_REQUEST)` etc.) with the PRE-3 acceptance:

```js
const rec = JSON.parse(await env.CODES.get('code:racer'));
const correctTotal = N * TOKENS_PER_REQUEST; // 50 — every debit landed (PRE-3 design D3 acceptance)
expect(rec.used).toBe(correctTotal);
```

Add:

```js
describe('E14 — CORS is an allowlist, not *', () => {
  it('an allowlisted origin is reflected; a foreign origin gets no ACAO', async () => {
    const ok = await exports.default.fetch(`${ORIGIN}/`, {
      method: 'OPTIONS', headers: { Origin: 'https://matkonetesh.pages.dev' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://matkonetesh.pages.dev');
    const bad = await exports.default.fetch(`${ORIGIN}/`, {
      method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('H-3 — rate limiting', () => {
  it('requests beyond the per-code window get 429 with Retry-After', async () => {
    await env.CODES.put('code:spammy', JSON.stringify({ active: true, cap: 10_000_000, used: 0 }));
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => geminiOkResponse(1));
    let limited = null;
    for (let i = 0; i < 25; i++) {
      const r = await post(GENERATE_URL, 'spammy');
      if (r.status === 429) { limited = r; break; }
    }
    expect(limited).not.toBeNull();
    expect((await limited.json()).error).toBe('rate_limited');
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});

describe('E14 — cap is mandatory (cap-by-omission fails closed)', () => {
  it('a record without a positive numeric cap is refused with 403 code_uncapped', async () => {
    await env.CODES.put('code:capless', JSON.stringify({ active: true }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await post(GENERATE_URL, 'capless');
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('code_uncapped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

Also update the existing CORS characterisation test ("characterises today's ... as `*`") to the new allowlist contract (its comment says exactly this must happen when P0-worker lands).

- [ ] **Step 2: RED**

Run (from `worker/`): `npm test`
Expected: D3-fixed, CORS-allowlist, 429 and cap-required tests all FAIL against Task 6's worker. Paste output.

- [ ] **Step 3: Implement — full new top-of-file + access/metering flow**

`worker/index.js` — replace the `CORS` const and `json` helper, and the access/metering section, with:

```js
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const UPSTREAM_TIMEOUT_MS = 60_000;      // B22
const RESERVE_TOKENS = 2000;             // debit-first provisional charge, reconciled to actual usage
const RATE_WINDOW_MS = 60_000;           // H-3: per-code fixed window (per isolate)
const RATE_MAX_PER_WINDOW = 20;

// E14: CORS is an allowlist. ALLOWED_ORIGINS is a plain wrangler var (comma-separated), NOT a secret.
const DEFAULT_ALLOWED_ORIGINS = ['https://matkonetesh.pages.dev', 'http://localhost:8123'];
function allowedOrigins(env) {
  return env.ALLOWED_ORIGINS
    ? String(env.ALLOWED_ORIGINS).split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-access-code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowedOrigins(env).includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;   // no ACAO header at all for a foreign origin — the browser blocks the read
}

// H-3: per-code serialization within this isolate. Fixes the B21 check-then-act race for all
// concurrency a single isolate sees (which is what the PRE-3 harness measures). Cross-isolate
// concurrency still rides KV eventual consistency; debit-first bounds that exposure to ~one
// RESERVE per isolate. The atomic cross-isolate fix is a Durable Object — Sync Thread / S1
// (trigger-anchored per H8; do not silently attempt it here).
const LOCKS = new Map();   // code -> tail promise
function withCodeLock(code, fn) {
  const tail = (LOCKS.get(code) || Promise.resolve()).then(fn, fn);
  LOCKS.set(code, tail.then(() => {}, () => {}));
  return tail;
}

const RATE = new Map();    // code -> { reset:number, n:number }
function retryAfterSeconds(code) {
  const now = Date.now();
  const e = RATE.get(code);
  if (!e || now >= e.reset) { RATE.set(code, { reset: now + RATE_WINDOW_MS, n: 1 }); return 0; }
  e.n += 1;
  if (e.n > RATE_MAX_PER_WINDOW) return Math.max(1, Math.ceil((e.reset - now) / 1000));
  return 0;
}
```

Fetch-handler flow (replacing the access-control + forward + metering sections; the Task 6 route/health/fail-closed edits stay):

```js
    const cors = corsHeaders(request, env);
    const json = (obj, status, extra) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', ...(extra || {}) } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // ... (health, route, GEMINI_KEY checks — Task 6 state, now using this `json`) ...

    const code = (request.headers.get('x-access-code') || '').trim();
    if (!code) return json({ error: 'missing_code' }, 401);

    const ra = retryAfterSeconds(code);
    if (ra > 0) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(ra) });

    const key = 'code:' + code;

    // ── debit-first admission, serialized per code (B21/H-3) ──
    const admit = await withCodeLock(code, async () => {
      const raw = await env.CODES.get(key);
      if (!raw) return { err: json({ error: 'invalid_code' }, 403) };
      let rec;
      try { rec = JSON.parse(raw); } catch { rec = null; }
      if (!rec || typeof rec !== 'object') return { err: json({ error: 'code_record_corrupt' }, 403) };   // B20
      if (rec.active === false) return { err: json({ error: 'code_disabled' }, 403) };
      if (typeof rec.cap !== 'number' || rec.cap <= 0) return { err: json({ error: 'code_uncapped' }, 403) };  // E14: cap-by-omission fails closed
      if ((rec.used || 0) >= rec.cap) {
        return { err: json({ error: 'quota_reached', reason: 'cap', used: rec.used, cap: rec.cap }, 402) };
      }
      rec.used = (rec.used || 0) + RESERVE_TOKENS;   // debit FIRST — a crash mid-flight leaves an over-debit, never a free ride
      await env.CODES.put(key, JSON.stringify(rec));
      return { ok: true };
    });
    if (admit.err) return admit.err;

    // ── forward to Gemini (Task 6: timeout) ──
    const body = await request.text();
    let gResp, text;
    try {
      gResp = await fetch(GEMINI_BASE + url.pathname + url.search, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      text = await gResp.text();
    } catch (e) {
      await reconcile(env, code, key, 0);   // refund the reserve — the upstream call died
      if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return json({ error: 'upstream_timeout' }, 504);
      return json({ error: 'upstream_unreachable', detail: String(e) }, 502);
    }

    // ── reconcile the reserve to actual usage ──
    let actual = 0;
    if (gResp.ok) {
      try { actual = (JSON.parse(text).usageMetadata || {}).totalTokenCount || 0; } catch { actual = RESERVE_TOKENS; }
      // non-parseable 200 body: keep the full reserve as the debit — fail closed, never free
    }
    await reconcile(env, code, key, actual);

    return new Response(text, { status: gResp.status, headers: { ...cors, 'Content-Type': 'application/json' } });
```

And the `reconcile` helper (module scope):

```js
async function reconcile(env, code, key, actualTokens) {
  await withCodeLock(code, async () => {
    const raw = await env.CODES.get(key);
    if (!raw) return;
    let rec; try { rec = JSON.parse(raw); } catch { return; }
    if (!rec || typeof rec !== 'object') return;
    rec.used = Math.max(0, (rec.used || 0) - RESERVE_TOKENS + actualTokens);
    rec.lastUsed = new Date().toISOString();
    await env.CODES.put(key, JSON.stringify(rec));
  });
}
```

- [ ] **Step 4: Fix the older harness tests that the new contract legitimately changes**

The "under-cap is proxied and debit applied" test still expects `used == 5 + 42` — with debit-first+reconcile the FINAL value is identical (5 + 2000 − 2000 + 42); run and confirm, adjust only if an intermediate-state assertion exists. The "at-cap refused with 402" test is unchanged. Document each touched assertion in the report.

- [ ] **Step 5: GREEN**

Run (from `worker/`): `npm test`
Expected: full worker suite green — including the D3 race test now asserting `used === 50`. Paste output + exit code.

- [ ] **Step 6: Ops note (no secrets)**

Append to `worker/README.md`:

```markdown
## Phase 1 hardening contract (P0-worker)
- Every code record REQUIRES `{"active":true,"cap":<positive tokens>,"used":<n>}` — a record without
  a positive numeric cap is refused (`403 code_uncapped`). Set caps when issuing codes.
- CORS allowlist: `https://matkonetesh.pages.dev` + `http://localhost:8123` by default; override with
  the plain var `ALLOWED_ORIGINS` (comma-separated) in wrangler.toml `[vars]` — never a secret there.
- `:streamGenerateContent` is closed (404). Rate limit: 20 req/min per code per isolate → 429+Retry-After.
- Keys: `GEMINI_KEY` remains ONLY a Worker secret (`wrangler secret put GEMINI_KEY`). Never in the repo.
```

- [ ] **Step 7: App suite ×1 + commit**

Run: `npx playwright test` → exit 0.

```bash
git add worker/index.js worker/test/index.spec.js worker/README.md
git commit -m "fix(worker): debit-first metering + per-code lock, rate-limit 429, CORS allowlist, cap required (B21, E14, H-3, Phase 1)"
```

---

### Task 8: N-4 + N-1 🔴 — the `SYNCABLE` manifest, and exportData stops leaking `mk-central-*`

**Spec trace:** ROADMAP Phase 1 "N-4 חיבור מניפסט SYNCABLE · N-1 🔴 סתימת דליפת `mk-central-*` ב-exportData"; Dec-A2 ("`exportData` חוסם מפתח אחד וכבר מדליף `mk-central-url`/`mk-central-code`"); task card 1.3 ("המניפסט הוא גם סכמת-הסנכרון העתידית"); DECISION-REGISTER §I ("אישורי AI מנוהל עוברים בכל גיבוי" — the admitted live leak).

**Files:**
- Modify: `app.js` — symbol `exportData` (7521); new symbols `SYNCABLE`, `syncableKey` directly above it
- Test: `tests/backup-syncable.spec.ts` (new)

**Interfaces:**
- Produces: `const SYNCABLE = { exact: [...], prefixes: [...] }` — **THE allowlist of user-data keys; this object is the seed of the S1 sync schema (Dec-D2 plan/execution split will annotate it later — do not pre-build that here, YAGNI)**; `syncableKey(k) -> boolean`. Backup payload `ver` stays 1 in this task (Task 9 bumps to 2 with import filtering).
- Consumes: the real key inventory below was extracted from `app.js`+`equipment.js` (`grep -o "'mk-[a-z0-9-]*'"`, 2026-07-30). **Deliberately excluded:** `mk-gemkey`, `mk-central-url`, `mk-central-code` (credentials — N-1), `mk-mtcache` (device-local MT cache, huge and regenerable), `mk-sw-fail` (device diagnostic, added by Task 11).

- [ ] **Step 1: Write the failing test (real-click export via download interception)**

```ts
// tests/backup-syncable.spec.ts — N-1: a backup may NEVER carry managed-AI credentials.
import { test, expect } from './_fixtures';

async function exportViaUi(page) {
  await page.evaluate(() => (window as any).openBackup());   // panel opener (app.js:8475); the click below is the real user action
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#bkExp').click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('backup contains user data but no mk-central-* / mk-gemkey (N-1 red-green)', async ({ warm }) => {
  await warm.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mk-central-url', JSON.stringify('https://worker.example'));
    localStorage.setItem('mk-central-code', JSON.stringify('fake-test-code'));
    localStorage.setItem('mk-gemkey', JSON.stringify('fake-test-key'));
    localStorage.setItem('mk-fav', JSON.stringify(['x']));
    localStorage.setItem('mk-menuqty-abc', JSON.stringify(2));   // prefix-key coverage
  });
  await warm.reload({ waitUntil: 'domcontentloaded' });
  const payload = await exportViaUi(warm);
  expect(payload.app).toBe('matkonet');
  expect(payload.data['mk-fav']).toBeTruthy();                  // user data survives
  expect(payload.data['mk-menuqty-abc']).toBeTruthy();          // prefix allowlist works
  expect(payload.data['mk-central-url']).toBeUndefined();       // 🔴 the live leak
  expect(payload.data['mk-central-code']).toBeUndefined();
  expect(payload.data['mk-gemkey']).toBeUndefined();
  expect(JSON.stringify(payload)).not.toContain('fake-test');   // belt-and-braces: no credential VALUE anywhere
});
```

- [ ] **Step 2: RED**

Run: `npx playwright test tests/backup-syncable.spec.ts`
Expected: FAIL — `payload.data['mk-central-url']` is present (the live N-1 leak, witnessed). Paste output.

- [ ] **Step 3: Implement SYNCABLE + allowlist exportData**

Insert above `exportData` (serena `insert_before_symbol` on `exportData`, `app.js`):

```js
/* ---- SYNCABLE manifest (N-4, Dec-A2) ----------------------------------------------------------
   THE single allowlist of user-data localStorage keys. Backup/export reads it (N-1: allowlist
   replaces the old one-key blocklist that leaked mk-central-url/mk-central-code into every backup);
   import filters through it (Dec-D6, Task 9); the future Sync Thread S1 schema GROWS FROM this
   object. A new persistent key is NOT backed up until it is added here — that is the point.
   NEVER list: mk-gemkey, mk-central-url, mk-central-code (credentials), mk-mtcache (device cache),
   mk-sw-fail (device diagnostic). */
const SYNCABLE = {
  exact: [
    // core user data
    'mk-events','mk-fav','mk-menu','mk-inventory','mk-inv-ver','mk-pantry','mk-journal',
    'mk-equipment','mk-eqm-ledger','mk-gear','mk-gear-set','mk-equip-set','mk-umakes',
    'mk-reminders','mk-timers','mk-timer','mk-alarm','mk-active','mk-cook','mk-stage',
    'mk-context','mk-cresume','mk-lastproj','mk-seas-migrated',
    // preferences & UI state
    'mk-lang','mk-theme','mk-fontpair','mk-fontscale','mk-uilevel','mk-uilevel-asked',
    'mk-homecustom','mk-dock-tools','mk-recent-tools','mk-burger','mk-plan-strict',
    'mk-tlalerts','mk-tlplandetail','mk-tlserve','mk-tlshape','mk-tlstate','mk-tlview',
    'mk-vcanslang','mk-vclang','mk-vcvoice','mk-gemvoice','mk-askai','mk-probe-nudge-dismissed',
    'mk-pref-airank','mk-pref-autonomy','mk-pref-hold','mk-pref-holdmax','mk-pref-sharetol',
    'mk-pref-slots','mk-pref-units','mk-pref-woodswap',
  ],
  prefixes: [
    'mk-cook-live-','mk-item-cooker-','mk-menuqty-','mk-plan-started-','mk-tlservedate-','mk-tlstate-',
  ],
};
function syncableKey(k){
  if(SYNCABLE.exact.indexOf(k)>=0) return true;
  for(let i=0;i<SYNCABLE.prefixes.length;i++){ if(k.indexOf(SYNCABLE.prefixes[i])===0) return true; }
  return false;
}
```

Replace the first line of `exportData` (7522):

```js
function exportData(){
  const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(!syncableKey(k)) continue; o[k]=localStorage.getItem(k);}   // N-1/N-4: SYNCABLE allowlist — credentials can never leak by omission again
  const payload={app:'matkonet',ver:1,exported:new Date().toISOString(),data:o};
  // ... rest unchanged ...
```

- [ ] **Step 4: GREEN + DoD-7 regression red-green**

Run: `npx playwright test tests/backup-syncable.spec.ts` → PASS. Then revert the `exportData` line only (restore the old blocklist form), run the spec, observe FAIL (leak returns), restore the fix, run again, observe PASS. **Paste all four outputs** (this is the DoD-7 evidence for a 🔴 bugfix).

- [ ] **Step 5: Consumer + coverage sanity (DoD-5)**

The consumer of `syncableKey` is `exportData` itself, fired by the real `#bkExp` click in the test. Also verify by hand against the live key inventory: run

```bash
grep -o "'mk-[a-z0-9-]*'" app.js equipment.js | sed "s/.*'\(mk-[a-z0-9-]*\)'/\1/" | sort -u
```

and confirm in the task report that every key in the output is either in SYNCABLE or in the named-exclusions list — no third bucket (a silently-dropped user-data key would be data loss in every future backup).

- [ ] **Step 6: Suite ×1 + commit**

Run: `npx playwright test` → exit 0.

```bash
git add app.js tests/backup-syncable.spec.ts
git commit -m "fix(backup): N-1 credential leak closed via SYNCABLE allowlist manifest (N-4) — Phase 1"
```

---

### Task 9: Dec-D6 — safe import: filter through SYNCABLE, version the payload, prove the round-trip

**Spec trace:** Dec-D6 ("ייצוא/ייבוא ידני — כן, מיד כרשת ביטחון … תלוי ב-A2 (המניפסט) כדי לא להדליף אישורים"); task card 1.4 ("מחזור ייצוא→ייבוא מלא עובד ואינו נושא סודות"; NOT D6-gap — the probe-budget item split to the Sync Thread, ROADMAP §3c).

**Files:**
- Modify: `app.js` — symbols `importData` (7529), `exportData` (7521 — `ver` bump), `openBackup` (8475 — the note text)
- Test: `tests/backup-syncable.spec.ts` (extend)

**Interfaces:**
- Produces: backup payload `ver:2`; `importData` writes ONLY `syncableKey` keys (a crafted/legacy backup can no longer implant credentials or arbitrary keys) and reports the skipped count.
- Consumes: `SYNCABLE`/`syncableKey` (Task 8), `toast`, `L`.

- [ ] **Step 1: Write the failing tests**

```ts
test('import filters non-SYNCABLE keys — a crafted backup cannot implant credentials', async ({ warm }) => {
  await warm.evaluate(() => localStorage.clear());
  await warm.reload({ waitUntil: 'domcontentloaded' });
  await warm.evaluate(() => (window as any).openBackup());
  const crafted = {
    app: 'matkonet', ver: 1, exported: new Date().toISOString(),
    data: {
      'mk-fav': JSON.stringify(['x']),
      'mk-central-code': JSON.stringify('implanted-code'),
      'evil-key': 'evil',
    },
  };
  await warm.locator('#bkImp').setInputFiles({
    name: 'crafted.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(crafted)),
  });
  await expect(warm.locator('.toast, [class*="toast"]').first()).toBeVisible();
  const state = await warm.evaluate(() => ({
    fav: localStorage.getItem('mk-fav'),
    central: localStorage.getItem('mk-central-code'),
    evil: localStorage.getItem('evil-key'),
  }));
  expect(state.fav).toBeTruthy();       // allowed data landed
  expect(state.central).toBeNull();     // credential implant blocked
  expect(state.evil).toBeNull();        // arbitrary key blocked
});

test('full export→wipe→import round-trip restores user data (Dec-D6)', async ({ warm }) => {
  await warm.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mk-fav', JSON.stringify(['brisket']));
    localStorage.setItem('mk-menuqty-abc', JSON.stringify(3));
  });
  await warm.reload({ waitUntil: 'domcontentloaded' });
  const payload = await exportViaUi(warm);
  expect(payload.ver).toBe(2);
  await warm.evaluate(() => localStorage.clear());
  await warm.reload({ waitUntil: 'domcontentloaded' });
  await warm.evaluate(() => (window as any).openBackup());
  await warm.locator('#bkImp').setInputFiles({
    name: 'roundtrip.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(warm.locator('.toast, [class*="toast"]').first()).toBeVisible();
  const fav = await warm.evaluate(() => JSON.parse(localStorage.getItem('mk-fav') || 'null'));
  expect(fav).toEqual(['brisket']);
  const qty = await warm.evaluate(() => JSON.parse(localStorage.getItem('mk-menuqty-abc') || 'null'));
  expect(qty).toBe(3);
});
```

- [ ] **Step 2: RED**

Run: `npx playwright test tests/backup-syncable.spec.ts`
Expected: implant test FAILS (`mk-central-code` lands, `evil-key` lands); round-trip fails on `ver` (still 1). Paste output.

- [ ] **Step 3: Implement**

`exportData`: change `ver:1` → `ver:2`.

`importData` — replace the key-writing loop (7536–7537) with:

```js
    const keys=Object.keys(d); let ok=0, fail=0, skipped=0;
    keys.forEach(k=>{
      if(!syncableKey(k)){ skipped++; return; }   // Dec-D6: import only SYNCABLE keys — a backup (any ver) can never implant credentials or foreign keys
      try{ localStorage.setItem(k, typeof d[k]==='string'?d[k]:JSON.stringify(d[k])); ok++; }catch(e){ fail++; }
    });
```

And extend the success toast to report filtering (keep the existing fail branch intact):

```js
      else toast('✓ '+L('הנתונים שוחזרו','Data restored')+' ('+ok+' '+L('פריטים','items')+(skipped?(' · '+skipped+' '+L('פריטים לא-מוכרים דולגו','unrecognized items skipped')):'')+')');
```

`openBackup` note (8484): extend the existing sentence so it also covers central access (Hebrew first, both languages via the existing `L(...)` call):

```js
${L('שים לב: ייבוא ממזג את הנתונים מהקובץ — מפתחות קיימים יידרסו, ומה שאין בקובץ יישאר. מפתח ה-AI ופרטי הגישה המרכזית אינם נכללים בגיבוי (אבטחה) — חבר אותם מחדש לאחר שחזור.','Note: import merges the data from the file — existing keys are overwritten, and anything not in the file stays. The AI key and central-access credentials aren’t included in the backup (security) — reconnect them after restoring.')}
```

- [ ] **Step 4: GREEN + Hebrew check**

Run: `npx playwright test tests/backup-syncable.spec.ts` → PASS. Screenshot the backup panel at 390×844 in Hebrew (note text + toast) — attach, look at it (DoD-8/9).

- [ ] **Step 5: Suite ×1 + commit**

Run: `npx playwright test` → exit 0.

```bash
git add app.js tests/backup-syncable.spec.ts
git commit -m "feat(backup): Dec-D6 safe import — SYNCABLE-filtered restore, ver:2, round-trip proven (Phase 1)"
```

---

### Task 10: B24 — build.py escapes/guards `</script` in every injected payload

**Spec trace:** ROADMAP Phase 1 "B24 escape של `</script` בהזרקת ה-build"; gap row B24 ("`_js_str` does not escape `</script`; app.js `__JS__` is substituted raw … no `</script` build guard"); §3b ("בטיחות/אבטחה זולה").

**Files:**
- Modify: `build.py` — `_js_str` (line 353) + new asserts beside the payload reads (~357–360)

**Interfaces:**
- Produces: `_js_str` output can never terminate the inline `<script>` block (`</` → `<\/`, a no-op escape inside a JS string literal); build fails loudly if `app.js`/`equipment.js`/`app.css` ever contain a raw `</script`/`</style`.
- Consumes: nothing new. (Verified 2026-07-30: `grep -c "</script" app.js equipment.js` → 0, so the asserts pass on today's sources.)

- [ ] **Step 1: Add the self-test assert FIRST (RED)**

Directly under the `_js_str` definition add:

```python
# B24 self-test: a data value containing '</script>' must ship escaped, or the browser's HTML parser
# terminates the inline <script> block mid-string (markup injection via CONTENT). '<\/' === '</' in JS.
assert "<\\/" in _js_str("</script>"), "B24: _js_str must escape '</' (got: %r)" % _js_str("</script>")
```

- [ ] **Step 2: Run the build to witness RED**

Run: `python build.py`
Expected: `AssertionError: B24: _js_str must escape '</' ...`. Paste output.

- [ ] **Step 3: Implement the escape + the raw-payload guards**

`_js_str` (line 353) — add one replace to the chain (order: after the backslash escape, before quotes is fine; keep exactly this chain):

```python
def _js_str(s):
    return "'" + s.replace("\\", "\\\\").replace("</", "<\\/").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r").replace(" ", "\\u2028").replace(" ", "\\u2029") + "'"
```

(The two invisible replaces at the end are the existing U+2028/U+2029 escapes — do not drop them.)

Beside the source reads (~line 357–360), add:

```python
# B24 guard: the JS/CSS payloads are substituted RAW into the HTML template (not via _js_str) —
# a literal '</script'/'</style' inside them would truncate the document. None exists today; if one
# ever appears, fail the build instead of shipping a broken page.
assert "</script" not in (_eqm + _js).lower(), "B24: raw '</script' found in app.js/equipment.js — rewrite it (e.g. '<\\/script' in strings)"
assert "</style" not in _css.lower(), "B24: raw '</style' found in app.css"
```

- [ ] **Step 4: GREEN + suite ×1 + commit**

Run: `python build.py` → completes, prints guards OK. Run: `npx playwright test` → exit 0 (byte-level: `_js_str` output for DATA changes `</`→`<\/` only if DATA contains `</`; the parsed JSON is identical). Paste outputs.

```bash
git add build.py
git commit -m "fix(build): B24 — escape '</' in _js_str + raw-payload </script guards (Phase 1)"
```

---

### Task 11: B25 — the Service-Worker registration catch stops swallowing failure

**Spec trace:** ROADMAP Phase 1 "B25 הסרת ה-catch הריק ב-SW (כשל נרשם ומדווח)"; gap row B25 ("Service-worker registration catch is empty" — `app.js:11562` `.catch(function(){})`).

**Files:**
- Modify: `app.js:11562` — the `.catch` of `navigator.serviceWorker.register('sw.js')` (inside the `window.addEventListener('load', ...)` block at 11546–11563)
- Test: `tests/service-worker.spec.ts` (extend — `service-worker` project)

**Interfaces:**
- Produces: on registration failure — `console.error('[mk-sw] ...')` + `store.set('mk-sw-fail', <message>)` + a one-time toast (the observable consumer, DoD-5). `mk-sw-fail` is deliberately NOT in SYNCABLE (device diagnostic).
- Consumes: `store`, `toast`, `L`.

- [ ] **Step 1: Write the failing test**

```ts
// service-worker project: a failed SW registration is recorded and reported, never swallowed (B25).
test('a failed sw.js registration surfaces a toast and records mk-sw-fail', async ({ page }) => {
  await page.route('**/sw.js', r => r.abort());
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html');
  await expect(page.locator('.toast, [class*="toast"]').first()).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mk-sw-fail'))).not.toBeNull();
  expect(errors.some(e => e.includes('[mk-sw]'))).toBe(true);
  await page.unroute('**/sw.js');
});
```

- [ ] **Step 2: RED**

Run: `npx playwright test tests/service-worker.spec.ts`
Expected: new test FAILS (no toast, no key, no console line — the empty catch). Paste output.

- [ ] **Step 3: Implement**

Replace `.catch(function(){});` (app.js:11562) with:

```js
    }).catch(function(err){   // B25: a swallowed registration failure hid a dead update channel (v255-class incidents)
      try{ console.error('[mk-sw] service-worker registration failed', err); }catch(e){}
      try{ store.set('mk-sw-fail', String((err&&err.message)||err)); }catch(e){}
      try{ if(typeof toast==='function') toast('⚠ '+L('רישום העדכונים ברקע נכשל — האפליקציה פועלת, אך עדכוני גרסה אוטומטיים לא יגיעו','Background update registration failed — the app still works, but automatic version updates will not arrive')); }catch(e){}
    });
```

- [ ] **Step 4: GREEN + Hebrew screenshot + suite ×1 + commit**

Run: `npx playwright test tests/service-worker.spec.ts` → PASS. Screenshot of the Hebrew toast at 390×844 attached and looked at. Run `npx playwright test` → exit 0.

```bash
git add app.js tests/service-worker.spec.ts
git commit -m "fix(sw): B25 — registration failure is logged, stored (mk-sw-fail) and toasted (Phase 1)"
```

---

### Task 12: E15 — CSP + security headers on the deployed site

**Spec trace:** ROADMAP Phase 1 "E15 כותרות CSP/אבטחה (אבטחה זולה)"; gap row E15 ("No CSP / security headers while Gemini key lives in `localStorage`" — `build.py:636` `_headers` writes only `Cache-Control`).

**Files:**
- Modify: `build.py` — the `_headers` write (~line 696)
- Test: `tests/security-headers.spec.ts` (new)

**Interfaces:**
- Produces: `dist/_headers` (Cloudflare Pages header rules) with CSP + `nosniff` + `X-Frame-Options` + `Referrer-Policy` + `Permissions-Policy`. **CSP design constraints (do not "tighten" past these without an owner conversation):** `script-src/style-src` need `'unsafe-inline'` (the entire app is one inline script/style — Dec-A3); `connect-src 'self' https:` because the managed-AI worker URL (`mk-central-url`) is user-configured and BYOK talks to `generativelanguage.googleapis.com`; `media-src`/`img-src` include `blob: data:` (TTS audio, photo flows); microphone stays ALLOWED (voice-cook uses `getUserMedia({audio:true})`, app.js:6723) so `Permissions-Policy` restricts only `geolocation`/`payment`.
- Consumes: Task 1's `/lang-*.json` no-cache rule (preserved here).

- [ ] **Step 1: Write the failing test**

```ts
// tests/security-headers.spec.ts — E15: headers exist AND the app actually boots under its own CSP.
import { test, expect } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function headersFile(): string {
  return readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8');
}

test('dist/_headers carries the security header set', async () => {
  const h = headersFile();
  expect(h).toContain('Content-Security-Policy:');
  expect(h).toContain("default-src 'self'");
  expect(h).toContain('X-Content-Type-Options: nosniff');
  expect(h).toContain('X-Frame-Options: DENY');
  expect(h).toContain('Referrer-Policy: no-referrer');
  expect(h).toContain('Permissions-Policy: geolocation=(), payment=()');
  expect(h).toContain('/lang-*.json');   // Task 1's cache rule survived the rewrite
});

test('the app boots cleanly with its own CSP enforced', async ({ isolatedPage }) => {
  const csp = headersFile().split('\n').find(l => l.includes('Content-Security-Policy:'))!
    .replace(/^\s*Content-Security-Policy:\s*/, '').trim();
  const body = readFileSync(resolve(process.cwd(), 'dist/index.html'));
  await isolatedPage.route(/\/index\.html($|\?)/, r => r.fulfill({
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp },
    body,
  }));
  const violations: string[] = [];
  await isolatedPage.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e: any) =>
      (window as any).__cspViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  await isolatedPage.goto('/index.html');
  await expect(isolatedPage.locator('[data-cnav="home"]')).toBeVisible();   // app painted
  const v = await isolatedPage.evaluate(() => (window as any).__cspViolations);
  expect(v).toEqual([]);   // zero violations on boot
});
```

- [ ] **Step 2: RED**

Run: `npx playwright test tests/security-headers.spec.ts`
Expected: first test FAILS (`_headers` has only Cache-Control lines). Paste output.

- [ ] **Step 3: Implement — replace the `_headers` write in build.py**

```python
# _headers (PWA #5 / perf #8 / E15 Phase 1): security headers + cache policy for Cloudflare Pages.
# CSP notes (Dec-A3 constraints — raise with the owner before tightening):
#   'unsafe-inline' is REQUIRED: the whole app is one inline <script>/<style> (single-file PWA).
#   connect-src 'self' https:  — the managed-AI worker URL (mk-central-url) is user-configured and
#   BYOK talks to generativelanguage.googleapis.com; https: (never http:) covers both.
#   media/img allow blob:/data: (TTS audio, photo analyze). Microphone stays allowed (voice-cook
#   uses getUserMedia audio) — Permissions-Policy restricts only geolocation/payment.
_csp = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])
with open(_os.path.join(_dist, "_headers"), "w", encoding="utf-8") as f:
    f.write(
        "/*\n"
        "  X-Content-Type-Options: nosniff\n"
        "  X-Frame-Options: DENY\n"
        "  Referrer-Policy: no-referrer\n"
        "  Permissions-Policy: geolocation=(), payment=()\n"
        "  Content-Security-Policy: " + _csp + "\n"
        "/index.html\n  Cache-Control: no-cache\n"
        "/manifest.webmanifest\n  Cache-Control: no-cache\n"
        "/sw.js\n  Cache-Control: no-cache\n"
        "/lang-*.json\n  Cache-Control: no-cache\n"
        "/*.png\n  Cache-Control: public, max-age=31536000, immutable\n"
    )
```

- [ ] **Step 4: GREEN — including the boot-under-CSP test**

Run: `python build.py && npx playwright test tests/security-headers.spec.ts`
Expected: PASS both. If the boot test reports violations, treat each as a real finding: either the CSP is missing a directive the app legitimately needs (add it, re-run) or dead code is reaching for a foreign origin (flag it in the report). Never delete the assertion.

- [ ] **Step 5: Suite ×1 + commit**

Run: `npx playwright test` → exit 0.

```bash
git add build.py tests/security-headers.spec.ts
git commit -m "feat(security): E15 — CSP + security headers in dist/_headers, boot-under-CSP proven (Phase 1)"
```

---

### Task 13: ⚠️R (H13-GATED) — R-2 + R-3: the spoken-"verified"-marker redesign

> **H13 — Recovery Relevance Gate (discipline §16). This task's Step 1 is MANDATORY and ends in a FULL STOP for a joint owner decision. No Step ≥ 4 may run before the owner's verdict is recorded. A recovered item is a lead, not a commitment.**

**Spec trace:** ROADMAP §5a rows R-2 ("מיסוג ה-marker 'לפי המדריך המאומת' למספר עצמו … הוחלט 24.7 (spec-change §3.1), לא מומש") and R-3 ("מספר 'מאומת' מהשדה הלא-נכון — 63° של אמבט sv מוצג כ-safe … 'מתקפל לתוך D2'"); task card 1.7; sources: `docs/analysis/program/new-gaps-2026-07-24-p0-app.md` §G-A1 + §G-A2 + the G-A1 addendum (Unicode boundaries: `º` U+00BA, `℃` U+2103, `℉` U+2109, `˚` U+02DA, full-width digits/`Ｆ`, RLM; Hebrew "מעלות פרנהייט" read as Celsius) + `DECISIONS-2026-07-24.md` D2/D3.

**Files (investigation reads; implementation files only after a בצע verdict):**
- Read: `app.js` symbols `vcGuardSpoken` (6599), `vcVerifiedNums` (6561), `vcMapSafetyNums` (6571), `vcLtrNums` (6592), `aiSafetyNums` / `safetyNumRe` / `safetyTokenRe` / `SAFETY_NUM` (locate via serena), `tests/p0-spoken-safety.spec.ts`
- Possibly modify (conditional): `app.js` (the symbols above), `tests/p0-spoken-safety.spec.ts`

- [ ] **Step 1: Recovery Relevance Gate — investigate, recommend, STOP**

Run the gate in order (H13 a→c), producing a short evidence memo in the task report:

```text
(a) RECONSTRUCT — read, in full:
    docs/analysis/program/new-gaps-2026-07-24-p0-app.md   §G-A1, §G-A2, "G-A1 addendum"
    docs/analysis/program/DECISIONS-2026-07-24.md         rulings D2, D3
(b) CHECK THE PRESENT — serena, against live code (the audit evidence is history, not proof):
    mcp__serena__find_symbol        name_path: "vcGuardSpoken"   relative_path: "app.js"   include_body: true
    mcp__serena__find_symbol        name_path: "vcVerifiedNums"  relative_path: "app.js"   include_body: true
    mcp__serena__find_symbol        name_path: "safetyNumRe"     relative_path: "app.js"
    mcp__serena__find_referencing_symbols  name_path: "vcGuardSpoken"  relative_path: "app.js"
    Verify each claimed hole against TODAY's body:
      1. unit-less number ("pull it at 165 internal") → aiSafetyNums=[] → early return, voiced raw?
      2. number-as-word ("seventy-four degrees") passes digitRuns=1 and the whole sentence gets the marker?
      3. Unicode unit boundaries (º ℃ ℉ ˚ full-width) unrecognized?
      4. Hebrew "מעלות פרנהייט" converted as Celsius and marked verified?
      5. R-3: vcVerifiedNums still pools safe/tgt/svt/smt/sot flat — wrong-field match marked verified?
    Also run: npx playwright test tests/p0-spoken-safety.spec.ts   (current guard contract, green baseline)
(c) RECOMMEND (בצע / בטל) with evidence, then STOP.
    Present to the owner IN CONVERSATION: the five findings, the recommendation, and the design
    direction below. Record the joint verdict in ROADMAP §5a rows R-2/R-3 (H13 d).
    A cancel verdict → mark `R-cancelled` + one-line reason in the ledger row; task ends there.
```

**Design direction to present (the G-A1 "structural alternative", pre-agreed 24.7 but never implemented — the recommendation baseline, NOT a decision):** stop appending a sentence-level marker; attach the verification claim to the substituted number itself and demote everything else. Concretely: the marker text becomes part of the number substitution (e.g. "74°C — לפי המדריך" inline), the sentence-suffix marker is dropped, and any answer containing an unverified/uninspected number keeps only the redaction notice. R-3 folds in by narrowing `vcVerifiedNums` matching to the field the tier context actually asserts where derivable, else treating the match as unverified (fail-closed), exactly because claim-classification is the "materially harder problem" G-A2 names.

- [ ] **Step 2: OWNER CHECKPOINT — do not proceed without a recorded verdict**

Evidence of the joint decision (owner's words) pasted into the task report and the ledger rows updated. **בטל → skip to Task 14** (Phase 1 closes without R-2/R-3; burn-down unchanged — an R row counts only after a בצע, ROADMAP §5).

- [ ] **Step 3 (בצע only): Write the failing tests — the five holes as assertions**

Extend `tests/p0-spoken-safety.spec.ts` (match its existing harness style — it drives `vcGuardSpoken` through the real voice-answer path / `window.__vcAskMock`):

```ts
// R-2/R-3 (Phase 1, post-H13-verdict): the marker may claim ONLY the checked number.
test('unit-less safety number is never voiced unguarded (G-A1 hole 1)', async ({ warm }) => {
  const out = await warm.evaluate(() =>
    (window as any).vcGuardSpoken('pull it at 165 internal', { t1: { obj: { safe: 74 } } }, 'en'));
  expect(out).not.toContain('165');            // uninspected number must not survive
});

test('number-as-word cannot ride a verified sentence (G-A1 hole 2)', async ({ warm }) => {
  const out = await warm.evaluate(() =>
    (window as any).vcGuardSpoken('63°C, or in some references seventy-four degrees',
      { t1: { obj: { safe: 63 } } }, 'en'));
  expect(out).not.toMatch(/verified guide/);   // sentence-level marker is gone
});

test('Unicode unit variants are inspected (G-A1 addendum)', async ({ warm }) => {
  for (const s of ['74ºC is fine', '74℃ is fine', '74℉ is fine']) {
    const out = await warm.evaluate(v => (window as any).vcGuardSpoken(v, { t1: { obj: { safe: 74 } } }, 'en'), s);
    expect(out, s).not.toMatch(/74[ºº℃℉]/);   // raw pass-through closed (exact assertion per approved design)
  }
});

test('Hebrew Fahrenheit is not read as Celsius (G-A1 addendum)', async ({ warm }) => {
  const out = await warm.evaluate(() =>
    (window as any).vcGuardSpoken('משוך ב-74 מעלות פרנהייט', { t1: { obj: { safe: 74 } } }, 'he'));
  expect(out).not.toContain('74°C פרנהייט');
});

test('a wrong-field match is not spoken as verified (G-A2 / R-3)', async ({ warm }) => {
  // 63 is the sv-bath figure, NOT safe — asserting it as safe must not earn the verified form
  const out = await warm.evaluate(() =>
    (window as any).vcGuardSpoken('63°C is the safe internal temperature',
      { t1: { obj: { safe: 74, svt: 63 } } }, 'en'));
  expect(out).not.toMatch(/63°C — |63°C is the safe.*verified/);
});
```

(Adjust the exact expected strings to the owner-approved design at Step 2 — the assertions above encode the recommendation baseline; if the approved design differs, rewrite them to it BEFORE running. The RED run must fail for the intended reason.)

- [ ] **Step 4 (בצע only): RED**

Run: `npx playwright test tests/p0-spoken-safety.spec.ts` → the new tests FAIL against the shipped guard. Paste output.

- [ ] **Step 5 (בצע only): Implement per the approved design**

Edit `vcGuardSpoken`/`vcVerifiedNums` (serena `replace_symbol_body`) to the approved design. **DoD-10 assertion for this task:** the guard consumes `safe`/`tgt`/`svt`/`smt`/`sot` READ-ONLY — no data value, threshold, or plan duration changes; the existing p0-spoken-safety tests that assert the app's own figures keep passing unmodified (name them in the report).

- [ ] **Step 6 (בצע only): GREEN + suite ×1 + Hebrew voice-panel screenshot (390×844) + commit**

Run: `npx playwright test tests/p0-spoken-safety.spec.ts` then `npx playwright test` → both exit 0.

```bash
git add app.js tests/p0-spoken-safety.spec.ts
git commit -m "fix(voice-guard): R-2/R-3 — marker binds to the checked number; wrong-field and unicode/wordy numbers fail closed (H13-approved, Phase 1)"
```

---

### Task 14: Release — v278, suite ×2, live verification, H14 UX report, board update

**🧑 שער בעלים לפני פריסת ה-Worker (החלטה 30.7):** משימה 7 הפכה `cap` לחובה — רשומה בלי `cap`
חיובי נדחית ב-`403 code_uncapped`, והמוסכמה הישנה `cap: 0 = "ללא הגבלה"` בוטלה. לכן **לפני**
פריסת ה-Worker חובה להריץ:

```bash
node scripts/central-code.mjs audit; ec=$?; echo "TRUE exit=$ec"
```

יוצא 0 → אפשר לפרוס. יוצא 1 → יש קודים חיים שיישברו: כל אחד מהם מונפק מחדש עם תקרה חיובית
מפורשת (למשל 1000000000 עבור "בלתי-מוגבל" בפועל) או מבוטל — **ואז** מריצים audit שוב עד 0.
הפלט ממסך קודים ואינו מדפיס מפתחות. הבעלים ביקש שהבדיקה תתבצע על-ידינו לפני הפריסה
("לא בטוח — תבדוק אתה לפני הפריסה"). הפריסה ללא audit ירוק = הפרת שער.

**Spec trace:** ROADMAP Phase 1 exit ("יציאה: vNNN — bundle ~2.1MB, worker fail-closed, גיבוי לא מדליף"); H7 (release = suite ×2); §10.10 (a push is not a release); discipline §17 H14 (release UX report); H10 (STATUS-BOARD updated).

**Files:**
- Modify: `build.py` — the foot-stamp line in the HTML template (`מהדורה 277 · 27.7.26` → `מהדורה 278 · <today D.M.YY>`; if other releases shipped meanwhile, use the next free NNN everywhere below)
- Create: `scratch/add-whatsnew-278.py` (follow the pattern of `scratch/add-whatsnew-277.py`)
- Create: `docs/releases/v278-ux-report.md` (H14)
- Modify: `docs/STATUS-BOARD.md` (H10) · `docs/ROADMAP-2026-07-30.md` §5 ledger line for Phase 1

- [ ] **Step 1: Version stamp + what's-new**

In `build.py`'s HTML template update the foot-stamp:

```html
<b class="foot-stamp" style="color:var(--ember2)">מהדורה 278 · 30.7.26</b>
```

What's-new entry (user-facing Hebrew, via the existing WHATS_NEW mechanism — mirror `scratch/add-whatsnew-277.py`):

```text
מהדורה 278 — האפליקציה נטענת מהר פי ~4 (פיצול מילוני השפות; שפה נטענת לפי בחירה),
גיבוי/שחזור בטוחים (פרטי גישה לעולם לא בקובץ), הקשחת שרת ה-AI, וכותרות אבטחה.
```

- [ ] **Step 2: Full suite ×2 (H7 release gate)**

Run twice, serialized, machine otherwise idle:
`npx playwright test` → exit 0 (paste tail) · `npx playwright test` → exit 0 (paste tail). Any failure — including an intermittent one — is a bug: systematic-debugging, never a re-run-until-green.
Also: `cd worker && npm test` → exit 0.

- [ ] **Step 3: Deploy**

```bash
python build.py
npx wrangler pages deploy
```

Worker deploy (only if Tasks 6–7 landed): from `worker/`: `npx wrangler deploy`. (Secrets untouched — `GEMINI_KEY` already lives in Cloudflare; nothing key-shaped appears in any output pasted to the report.)

- [ ] **Step 4: Live verification (§10.10 — poll, do not assume)**

Playwright against the LIVE URL: `.foot-stamp` equals `מהדורה 278` AND a Phase-1 probe passes — `GET https://matkonetesh.pages.dev/lang-en.json` → 200 with `__meta__`, and the served `index.html` byte size < 2.6MB. Cloudflare Pages takes minutes — poll on a condition, never a sleep-and-hope. Paste the passing probe output.

- [ ] **Step 5: H14 UX report — `docs/releases/v278-ux-report.md`**

```markdown
# דו"ח UX — מהדורה 278 (Phase 1 · חוסמים מיידיים)

1. **מה השתנה:** האפליקציה יורדת ~2.1MB במקום ~7.8MB — טעינה ראשונה מהירה משמעותית; החלפת שפה
   מורידה את המילון ברקע (רגע קצר של טקסט באנגלית בפעם הראשונה — צפוי); גיבוי אינו מכיל עוד את
   פרטי הגישה המרכזית; ייבוא גיבוי מסנן מפתחות לא-מוכרים ומדווח כמה דולגו; כשל ברישום עדכוני-רקע
   מוצג בהודעה במקום להיבלע; הקשחות שרת-AI וכותרות אבטחה — ללא ביטוי חזותי.
2. **איפה רואים את זה:** מסך הבית ← שורת הדגלים (החלפת שפה) · תפריט ☰ ← גיבוי ושחזור.
3. **איך בודקים ביד (390×844, עברית תחילה):**
   - רענן את האפליקציה החיה ← בדוק ב-DevTools/Network שההורדה ~2.1MB ← החלף לצרפתית ← ודא
     שהממשק כולו בצרפתית (קטלוג=Catalogue) וש-`lang-fr.json` נטען ברשת.
   - גיבוי ושחזור ← "ייצא קובץ גיבוי" ← פתח את הקובץ ← ודא שאין בו `mk-central` ואין מפתח AI.
   - "ייבא מקובץ" עם הגיבוי שיצרת ← ודא הודעת "הנתונים שוחזרו".
4. **ללא ביטוי חזותי:** הקשחת ה-worker — מאומתת ב-`worker/test/index.spec.js`; כותרות E15 —
   מאומתות ב-`tests/security-headers.spec.ts`; שומר ה-build B24 — assert ב-`build.py`.
```

(אם פסק ה-H13 של Task 13 היה בצע — הוסף סעיף על הגארד הקולי: מה השתנה בניסוח "לפי המדריך המאומת" ואיך בודקים בפאנל הקולי.)

- [ ] **Step 6: Board + ledger + H9**

Update `docs/STATUS-BOARD.md` (Phase 1 → ✅ עם v278 · תאריך+שעה; פערים שנסגרו: B19, B20, B21, B22, B24, B25, E14, E15, H-3, N-1, N-2, N-4, N-5 — 13; R-2/R-3 לפי פסק H13) and the ROADMAP §5 burn-down line (32/156 מצטבר). Produce the H9 5-row table in the task report.

- [ ] **Step 7: Commit + (with owner's go) push**

```bash
git add build.py scratch/add-whatsnew-278.py docs/releases/v278-ux-report.md docs/STATUS-BOARD.md docs/ROADMAP-2026-07-30.md
git commit -m "release(v278): Phase 1 immediate blockers — dict split, worker fail-closed, safe backup, security headers"
```

---

## Self-Review (performed against the spec, 2026-07-30)

1. **Spec coverage:** ROADMAP Phase 1 closes B19✓(T6) B20✓(T6) B21✓(T7) B22✓(T6) B24✓(T10) B25✓(T11) E14✓(T6+T7) E15✓(T12) H-3✓(T6+T7) N-1✓(T8) N-2✓(T4) N-4✓(T8) N-5✓(T5); Dec-D6✓(T9); A1✓(T1–T3); R-2/R-3✓(T13, H13-gated); release+H14✓(T14). E9 opens partially via the split (its >3000-entry cap remainder stays Phase 12 — per ROADMAP, not a waiver). D6-gap (probe budgeting) is explicitly OUT (Sync Thread, §3c).
2. **Placeholder scan:** no TBD/TODO/"add validation"; every code step shows the code; Task 13's conditional steps are conditional by H13 design, with the recommendation-baseline assertions written out.
3. **Type consistency:** `loadLangDict`/`I18N_META`/`I18N_DICTS` names match across T1/T2/T3; `syncableKey`/`SYNCABLE` match across T8/T9; worker error codes (`code_record_corrupt`, `code_uncapped`, `rate_limited`, `upstream_timeout`) match between tests and implementation; `reconcile(env, code, key, actual)` signature consistent.
4. **Known judgment calls surfaced (routine, §10.8 — noted, not blocking):** cap-required refusal changes ops for existing capless codes (T7 README note); CSP `connect-src https:` is as tight as a user-configured worker URL allows; `ru` removed from LANGNAME alongside `ar` (same defect class); worker cross-isolate atomicity explicitly deferred to S1/Durable Objects with a named trigger (H8-compliant).
