# i18n Foundation (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the two-language ceiling in the app's i18n so French/German/Spanish become localizable app-wide, fix the AI output-language bug, fix the ~22 hardcoded-Hebrew toasts that are Hebrew even in English, and add a build-time coverage check — without changing shipped Hebrew or English behavior.

**Architecture:** Four independent changes to `app.js` + `build.py`, each with its own test. The keystone is making `L(he,en)` consult the per-language dictionary (`getDict()`) for non-English languages while English keeps using its inline argument (zero regression). The app is a single-file offline PWA: `build.py` inlines `app.js`/`app.css`/data + `lang/*.json` dictionaries into `dist/index.html`. Tests are Playwright against the built `index.html`.

**Tech Stack:** Vanilla browser JS (`app.js`), Python build (`build.py`), Playwright (`tests/*.spec.ts`), Node static server (`serve.js`) for the test webServer.

## Global Constraints
- **No backward-compat burden** (pre-customer), but **Hebrew and English behavior must stay byte-for-byte identical** except that the ~22 hardcoded toasts now render English in English mode.
- **Always verify Hebrew AND English.** English = the generic non-Hebrew locale, not special.
- **Never convert Celsius to °F.** Preserve every number verbatim.
- **`L('…','…')` string gotchas** (from memory `i18n-english`): never put an apostrophe `'` inside a single-quoted `L('…')` — it terminates the JS string and breaks the whole file (use "is not"/"could not"). Never put a literal `״` (gershayim, U+05F4) in an `Edit` old_string.
- **`toast()` is already dict-aware** (`tr(msg)`, app.js:1936): `L()` composes cleanly — in Hebrew `L()` returns Hebrew and `tr()` passes it through; in English `L()` returns English and `tr()` passes it through.
- Ship as **v229** (commit + tag `v229` + push). Deploy = push to `main`. Suite green **twice**; `node --check app.js` clean.

---

### Task 1: Make `L()` dictionary-aware (the keystone)

**Files:**
- Modify: `app.js:5086` (the `L` function)
- Test: `tests/i18n-foundation.spec.ts` (create)

**Interfaces:**
- Consumes: `getLang()` (app.js:5074), `getDict()` (app.js:5079 — returns `null` for Hebrew, else `I18N_DICTS[lang]||{}`).
- Produces: `L(he, en)` — Hebrew→`he`; English→`en` (inline, unchanged); fr/de/es→`getDict()[he]` if present else `en` else `he`.

- [ ] **Step 1: Write the failing test**

Create `tests/i18n-foundation.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof L==='function' && typeof aiJSON==='function' && typeof setLang==='function' && typeof I18N_DICTS==='object'`);
};

test('Change 1: L() — English uses inline arg, fr uses dict, he returns source', async ({ page }) => {
  await boot(page);
  // seed test keys; give en a DIFFERENT value to prove English ignores the dict
  await page.evaluate(`I18N_DICTS.en=I18N_DICTS.en||{}; I18N_DICTS.en['__t_key']='DICT-EN';
                       I18N_DICTS.fr=I18N_DICTS.fr||{}; I18N_DICTS.fr['__t_key']='DICT-FR';`);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`L('__t_key','INLINE-EN')`)).toBe('INLINE-EN');   // English: inline wins (untouched)
  await page.evaluate(`setLang('fr')`);
  expect(await page.evaluate(`L('__t_key','INLINE-EN')`)).toBe('DICT-FR');      // fr: dict wins
  expect(await page.evaluate(`L('__no_key','FALLBACK-EN')`)).toBe('FALLBACK-EN'); // fr: unmapped → inline English
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`L('שלום','hi')`)).toBe('שלום');                    // Hebrew: source verbatim
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 1" --project=chromium`
Expected: FAIL — the `fr` assertion gets `'INLINE-EN'` (current `L()` returns `en` for any non-Hebrew language) but expects `'DICT-FR'`.

- [ ] **Step 3: Write minimal implementation**

Replace `app.js:5086`:
```js
function L(he, en){ return getLang()==='he' ? he : (en!=null?en:he); }
```
with:
```js
function L(he, en){
  const l=getLang();
  if(l==='he') return he;
  if(l==='en') return en!=null?en:he;               // shipped English: inline arg wins → zero regression
  const d=getDict();                                 // fr/de/es: prefer the per-lang dict, keyed by the Hebrew source
  return (d && d[he]!=null) ? d[he] : (en!=null?en:he);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 1" --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.js tests/i18n-foundation.spec.ts
git commit -m "i18n: make L() dictionary-aware for fr/de/es (English unchanged)"
```

---

### Task 2: Fix `aiJSON` `outLang` to name the real language

**Files:**
- Modify: `app.js` — add a module-level `LANGNAME` const after `LANG_FLAG` (app.js:5070); update `aiJSON`'s `langLine` (app.js:3250); update `mtTranslate` to use the shared map (app.js:5156-5157)
- Test: `tests/i18n-foundation.spec.ts`

**Interfaces:**
- Produces: module-level `const LANGNAME = {en,ar,ru,es,fr,de}` (code→language-name). `aiJSON({outLang})` writes the instruction "in <LANGUAGE>" for non-Hebrew `outLang`.

- [ ] **Step 1: Write the failing test**

Append to `tests/i18n-foundation.spec.ts`:
```ts
test('Change 2: aiJSON outLang names the target language, not always English', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock=null; window.__cap=null;
    window.gemFetch=async(m,b)=>{ window.__cap=b; return {ok:true, json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})}; };`);
  await page.evaluate(`aiJSON({task:'t', outLang:'fr'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('FRENCH');
  await page.evaluate(`aiJSON({task:'t', outLang:'de'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('GERMAN');
  await page.evaluate(`aiJSON({task:'t', outLang:'en'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('ENGLISH');  // English unchanged
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 2" --project=chromium`
Expected: FAIL — with `outLang:'fr'` the current `langLine` hardcodes "ENGLISH", so the captured body contains "ENGLISH", not "FRENCH".

- [ ] **Step 3: Write minimal implementation**

(a) Add the shared map. After `app.js:5070` (`const LANG_FLAG = {...};`) insert:
```js
const LANGNAME={en:'English',ar:'Arabic',ru:'Russian',es:'Spanish',fr:'French',de:'German'};
```

(b) Replace `aiJSON`'s `langLine` at `app.js:3250`:
```js
  const langLine=(outLang==='he')?'':'\n\nIMPORTANT: write every human-readable string VALUE (reason/note/summary/rationale/tip/warning/text/title/desc) in ENGLISH. Keep every key and id EXACTLY as provided.';
```
with:
```js
  const langLine=(outLang==='he')?'':('\n\nIMPORTANT: write every human-readable string VALUE (reason/note/summary/rationale/tip/warning/text/title/desc) in '+(LANGNAME[outLang]||'English').toUpperCase()+'. Keep every key and id EXACTLY as provided.');
```

(c) De-duplicate the map inside `mtTranslate`. Replace `app.js:5156`:
```js
      const LANGNAME={en:'English',ar:'Arabic',ru:'Russian',es:'Spanish',fr:'French',de:'German'}[lang]||lang;
```
with:
```js
      const LN=LANGNAME[lang]||lang;
```
and on `app.js:5157` change `'Translate the following Hebrew cooking text to '+LANGNAME+'.'` to `'Translate the following Hebrew cooking text to '+LN+'.'`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 2" --project=chromium`
Expected: PASS. Then `node --check app.js` → no output (clean).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "i18n: aiJSON outLang names the target language (shared LANGNAME map)"
```

---

### Task 3: Route the hardcoded Hebrew toasts through `L()`

**Files:**
- Modify: `app.js` (the toast call-sites listed below)
- Test: `tests/i18n-foundation.spec.ts` + a grep verification

**Interfaces:** none new — each edit wraps a literal Hebrew toast string in `L('<he>','<en>')`, preserving Hebrew output and any `undoFn`/interpolation.

- [ ] **Step 1: Write the failing test**

Append to `tests/i18n-foundation.spec.ts`:
```ts
test('Change 3: hardcoded toasts render English in English mode', async ({ page }) => {
  await boot(page);
  await page.evaluate(`setLang('en'); copyText('hello');`);
  const txt = await page.evaluate(`(document.querySelector('#toast span')||{}).textContent||''`);
  expect(txt).toMatch(/copied/i);
  expect(txt).not.toMatch(/[֐-׿]/);   // no Hebrew characters
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 3" --project=chromium`
Expected: FAIL — `copyText` currently toasts `'הרשימה הועתקה ✓'`; in English the toast still shows Hebrew (the string is not in the dict).

- [ ] **Step 3: Apply the wrapping to every site**

Wrap each toast literal below in `L('<hebrew>','<english>')`. Two worked examples, then the full table — apply the same pattern to each. (Avoid apostrophes in the English; keep Hebrew byte-identical.)

Example A — simple (app.js:1368):
`toast('התיבול עודכן — השלבים חושבו מחדש')`
→ `toast(L('התיבול עודכן — השלבים חושבו מחדש','Seasoning updated — steps recalculated'))`

Example B — interpolated (app.js:2359-2360):
```js
const ctxName=(typeof menuCtx==='function'&&menuCtx()==='event')?'האירוע':'הבישול';
if(typeof toast==='function') toast(`${p.name} נוסף ל${ctxName} · ${stg==='done'?'מוכן להגשה':'רק סיום'}`);
```
→
```js
const ctxName=(typeof menuCtx==='function'&&menuCtx()==='event')?L('האירוע','the event'):L('הבישול','the cook');
if(typeof toast==='function') toast(`${p.name} ${L('נוסף ל','added to ')}${ctxName} · ${stg==='done'?L('מוכן להגשה','ready to serve'):L('רק סיום','finish only')}`);
```

Full table (each is one `toast(...)` literal → wrap in `L()`):

| app.js | Hebrew (keep verbatim) | English |
|---|---|---|
| 668 | `⚠ האחסון מלא — ייתכן שנתונים חדשים לא נשמרים. ייצא גיבוי ופנה מקום (הגדרות › גיבוי ושחזור).` | `⚠ Storage is full — new data may not be saved. Export a backup and free up space (Settings › Backup & restore).` |
| 2381 | `נוסף שלב סיום — הפריט עבר למעקב פעיל 🧫` | `Finishing step added — the item is now actively tracked 🧫` |
| 2450 | `הפרויקט נמחק` (keep the `, ()=>{…}` undo arg) | `Project deleted` |
| 2479 | `התזכורת נמחקה` (keep undo arg) | `Reminder deleted` |
| 2501 | `⚠ אין מקום אחסון לתמונה — נשמר בלי תמונה` | `⚠ No storage room for the photo — saved without it` |
| 2554 | `הרישום נמחק` (keep undo arg) | `Entry deleted` |
| 3591 | `הרשימה הועתקה ✓` | `List copied ✓` |
| 3591 | `הועתק` | `Copied` |
| 4158 | `זיהוי דיבור אינו נתמך בדפדפן זה (נתמך בכרום-אנדרואיד) — השתמש בכפתורים` | `Speech recognition is not supported in this browser (works in Chrome-Android) — use the buttons` |
| 4159 | `האזנה כבויה` | `Listening off` |
| 4182 | `נדרשת הרשאת מיקרופון — אשר בדפדפן ונסה שוב` | `Microphone permission needed — allow it in the browser and try again` |
| 4183 | `זיהוי דיבור דורש חיבור רשת` | `Speech recognition needs a network connection` |
| 4194 | `הרשאת מיקרופון חסומה. פתח: סמל המנעול 🔒 בשורת הכתובת ← הרשאות ← מיקרופון ← אפשר, ואז נסה שוב.` | `Microphone permission is blocked. Open the lock icon 🔒 in the address bar → Permissions → Microphone → Allow, then try again.` |
| 4824 | `❌ הקובץ אינו JSON תקין` | `❌ The file is not valid JSON` |
| 4826 | `❌ הקובץ אינו גיבוי תקין של מתכונת` | `❌ The file is not a valid Matkonet backup` |
| 4827 | `❌ הגיבוי שייך לאפליקציה אחרת` | `❌ This backup belongs to a different app` |
| 4837 | `❌ שגיאה בקריאת הקובץ` | `❌ Error reading the file` |

Interpolated sites — replace the whole expression:

- app.js:2360 → see Example B above.
- app.js:3587-3588:
```js
toast(items.length? (added?`${added} כרטיסיות מסומנות (✓) נוספו לתפריט`:'כל המסומנות כבר בתפריט')
                  : 'אין כרטיסיות מסומנות — סמן נתחים עם ＋ בכרטיסים');
```
→
```js
toast(items.length? (added?`${added} ${L('כרטיסיות מסומנות (✓) נוספו לתפריט','checked cards (✓) added to the menu')}`:L('כל המסומנות כבר בתפריט','All checked cards are already in the menu'))
                  : L('אין כרטיסיות מסומנות — סמן נתחים עם ＋ בכרטיסים','No checked cards — mark cuts with ＋ on the cards'));
```
- app.js:4188 `toast('לא ניתן להפעיל מיקרופון: '+e.message)` → `toast(L('לא ניתן להפעיל מיקרופון: ','Could not start the microphone: ')+e.message)`
- app.js:4833:
```js
toast(`⚠ שוחזרו ${ok} מתוך ${keys.length} פריטים — ${fail} נכשלו (ייתכן שהאחסון מלא). ייצא-מחדש אחרי פינוי מקום.`);
```
→
```js
toast('⚠ '+L('שוחזרו','Restored')+' '+ok+' '+L('מתוך','of')+' '+keys.length+' '+L('פריטים','items')+' — '+fail+' '+L('נכשלו (ייתכן שהאחסון מלא). ייצא-מחדש אחרי פינוי מקום.','failed (storage may be full). Re-export after freeing space.'));
```
- app.js:4834 `toast(`✓ הנתונים שוחזרו (${ok} פריטים)`)` → `toast('✓ '+L('הנתונים שוחזרו','Data restored')+' ('+ok+' '+L('פריטים','items')+')')`

Leave the voice toasts that already branch on `vcLang()`/have an English arm (app.js:4176 `'❓ '+alts[0]`, 4178, 4187) unchanged — those are handled and full voice localization is a documented follow-on (see Task 5 note).

- [ ] **Step 4: Verify — test passes + no unwrapped Hebrew toast remains**

Run: `npx playwright test tests/i18n-foundation.spec.ts -g "Change 3" --project=chromium` → PASS.
Then use the Grep tool on `app.js` with pattern `toast\(\s*['\x60"][^'\x60"]*[֐-׿]` (a `toast(` immediately followed by a quote and Hebrew). Expected: **only** the intentionally-left voice lines (4176/4178/4187) or zero — every other hit means a toast was missed; wrap it. Then `node --check app.js` → clean.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "i18n: route hardcoded Hebrew toasts through L() (fixes English)"
```

---

### Task 4: Build-time i18n coverage check

**Files:**
- Modify: `build.py` — insert after the `.data.json` merge loop (after app.js... `build.py:355`, before `I18N_DICTS_JSON = json.dumps(...)` at `build.py:356`)

**Interfaces:** prints one `[i18n] <code>: <n>/<total> keys vs en (<pct>%)[ · <k> orphaned]` line per non-English language at build time. Non-fatal.

- [ ] **Step 1: Add the check**

Insert at `build.py`, immediately before line 356 (`I18N_DICTS_JSON = json.dumps(_i18n, ensure_ascii=False)`):
```python
# i18n coverage report (non-fatal): how far each language covers the English reference + orphaned keys
_en_keys = set(_i18n.get("en", {}).keys())
if _en_keys:
    for _code in sorted(_i18n):
        if _code == "en":
            continue
        _k = set(_i18n[_code].keys())
        _cov = len(_k & _en_keys); _orph = _k - _en_keys
        _pct = round(100 * _cov / len(_en_keys))
        print("[i18n] %s: %d/%d keys vs en (%d%%)%s" % (_code, _cov, len(_en_keys), _pct, (" · %d orphaned" % len(_orph)) if _orph else ""))
```

- [ ] **Step 2: Run the build and verify the report prints**

Run: `python build.py`
Expected: stdout includes at least one line like `[i18n] fr: 79/3982 keys vs en (2%)` (numbers will vary), plus `de` and `es`. Build still writes `index.html` + `dist/index.html` with no error.

- [ ] **Step 3: Commit**

```bash
git add build.py
git commit -m "build: non-fatal i18n coverage report per language"
```

---

### Task 5: Regression, version bump, and ship v229

**Files:**
- Modify: `build.py:323` (version stamp)

**Interfaces:** none — this task validates the whole Phase 0 and ships it.

- [ ] **Step 1: Bump the version stamp**

Edit `build.py:323`: change `מהדורה 228 · 14.7.26` to `מהדורה 229 · 15.7.26`.

- [ ] **Step 2: Rebuild + parse check**

Run: `python build.py && node --check app.js`
Expected: build prints the `[i18n]` lines and writes `index.html`; `node --check` prints nothing (clean).

- [ ] **Step 3: Full suite — twice green (Hebrew AND English)**

Run: `npx playwright test`
Expected: all tests PASS (existing suite unchanged behavior + the 3 new `i18n-foundation` tests). Run it a **second** time to confirm no flakiness:
Run: `npx playwright test`
Expected: PASS again.

- [ ] **Step 4: Real-click spot check (both languages)**

Manually (or via a quick Playwright evaluate) confirm in English mode: delete a journal entry → toast reads "Entry deleted"; copy a shopping list → "List copied ✓". Switch to Hebrew → the same actions read Hebrew. No regressions in either language.

- [ ] **Step 5: Commit, tag, push**

```bash
git add app.js build.py tests/i18n-foundation.spec.ts
git commit -m "v229 · i18n Foundation (Phase 0) — dict-aware L() + outLang + toasts + coverage"
git tag v229
git fetch origin && git rebase origin/main
git push origin main && git push origin v229
```

**Follow-on (out of scope, note in the ship commit or a memory):** full voice-assistant localization — `vcBuildAskPrompt` (app.js:4104-4120) and `vcAnsLang`/`vcLang` are still he/en-only; generalizing them to fr/de/es is a separate small piece. The binary helpers (`itemName`/`kindLabel`/…) and the dead `data-i18n=` markup (build.py) are also deferred cleanups from the audit.

---

## Self-Review

**Spec coverage** (against `2026-07-15-i18n-foundation-phase0-design.md`):
- §4.1 L() dict-aware → Task 1. ✓
- §4.2 aiJSON outLang → Task 2 (incl. shared LANGNAME + mtTranslate dedupe). ✓
- §4.3 route ~20 toasts → Task 3 (22 sites tabled). ✓
- §4.4 build coverage check → Task 4. ✓
- §6 testing (HE+EN sweep incl. forced toasts + FR smoke + outLang) → Tasks 1-3 tests + Task 5 full-suite-×2 + real-click. ✓
- §7 DoD (node --check, green ×2, vNNN) → Task 5. ✓
- Non-goals (helpers, dead markup, dictionary authoring, vcBuildAskPrompt) → explicitly deferred in Task 5 follow-on. ✓

**Placeholder scan:** none — every step has exact code/commands.

**Type/name consistency:** `LANGNAME` (module const) defined in Task 2 Step 3a, consumed in aiJSON (3250) and mtTranslate (5156-5157) in the same step. `L(he,en)`, `getDict()`, `getLang()`, `setLang()`, `copyText()`, `toast()` all match app.js. Test file `tests/i18n-foundation.spec.ts` created in Task 1, appended in Tasks 2-3.
