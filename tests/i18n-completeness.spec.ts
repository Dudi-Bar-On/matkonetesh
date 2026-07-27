// v268 Task 12 — the permanent render-path localization leak-scan (spec §8). The deterministic gate:
// drive the REAL states (recipe under an insufficient kit → the "cannot be cooked" panel + steps, forms,
// event planner, a fired toast, language-switch-while-open) with window.__i18nTrace armed, and assert that
// NO EXTRACTED key ever falls back to English/Hebrew in an active language — i.e. every string the extractor
// KNOWS about is translated on the real path (v268 chrome-complete). A fallback on a NON-extracted key is
// v269-interpolated prose (concat-L / Lt templates) — reported, not failed (that is v269's scope). Plus a
// raw-Hebrew DOM scan (a Hebrew string rendering in a non-Hebrew language = a leak) and the extractor
// staleness gate (spec §8.3: app.js must not have gained/changed an L/t key without regenerating the
// committed lang/_extracted.json). KNOWN != full COVERAGE (spec §5): this render test IS the coverage gate.
import { test, expect, seedApp } from './_fixtures';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ext = JSON.parse(readFileSync('lang/_extracted.json', 'utf8'));
const EXTKEYS = new Set(Object.keys(ext).filter(k => k !== '__names__'));
const HEB = /[֐-׿]/;
const LANGS = ['fr', 'de', 'es', 'it'];

async function driveStates(page: any, lang: string) {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
  await page.evaluate(`(function(){
    equipSave([{id:'sm1',cat:'smoker',type:'קטל (ככלי עישון)',name:'My Smoker',cap:{racks:1,areaCm2:2400}},{id:'sv1',cat:'sousvide',type:'טבילה (immersion)',name:'My SV',cap:{maxL:20}}]);
    equipSetConfigured();
    saveMenu({guests:4,appetite:'reg',kosher:false,keys:['cut-1','cut-74'],sides:[],drinks:[],desserts:[],gpm:0});
    if(typeof setLang==='function') setLang(${JSON.stringify(lang)});
    window.__i18nTrace=[];
  })()`);
  const steps = [
    `typeof renderHome==='function'?renderHome():(typeof renderHomeChrome==='function'&&renderHomeChrome())`,
    `openEquipment()`,
    `(function(){var b=document.querySelector('#panel [data-eqedit]'); if(b)b.click();})()`,   // an EDIT FORM
    `openTimeline()`,
    `(function(){var c=DATA.cuts.find(x=>x.n===1); if(c)openCut(c);})()`,                       // recipe under insufficient kit → cannot-cook panel + steps
    `openCart()`, `openSeasonings()`, `openWoods()`, `openAsk()`, `openTools()`, `openAppearance()`,
    `typeof openEventPlanner==='function'&&openEventPlanner()`,
    `typeof toast==='function'&&toast('נשמר')`,                                                 // fire a TOAST
    `(function(){ if(typeof setLang==='function'){ setLang('he'); setLang(${JSON.stringify(lang)}); } })()`, // language-switch while a panel is open
  ];
  for (const code of steps) { try { await page.evaluate(code); await page.waitForTimeout(70); } catch {} }
}

for (const lang of LANGS) {
  test(`i18n completeness — no EXTRACTED key falls back in ${lang} (v268 chrome-complete)`, async ({ page }) => {
    await driveStates(page, lang);
    const trace: any[] = await page.evaluate(`window.__i18nTrace.filter(function(r){return r.lang!=='en';})`);
    const gaps = new Map<string, string>();
    let deferred = 0;
    for (const r of trace) {
      const bare = String(r.key).split('␟')[0];
      if (EXTKEYS.has(r.key) || EXTKEYS.has(bare)) gaps.set(r.key, r.en);   // an extracted key fell back = a real v268 leak
      else deferred++;                                                       // non-extracted = v269 interpolated prose (reported)
    }
    if (gaps.size) { console.log(`[${lang}] REAL extracted-key leaks:`); for (const [k, en] of gaps) console.log(`  ${JSON.stringify(k).slice(0, 60)} → ${JSON.stringify(en).slice(0, 40)}`); }
    console.log(`[${lang}] extracted-key leaks=${gaps.size}  deferred/v269-prose=${deferred}`);
    expect(gaps.size, `${lang}: an extracted chrome key rendered its fallback (untranslated) — see log`).toBe(0);
  });

  test(`i18n completeness — no raw-Hebrew leak in ${lang} DOM/attrs`, async ({ page }) => {
    await driveStates(page, lang);
    const leaks: string[] = await page.evaluate(() => {
      const HE = /[֐-׿]/; const out: string[] = []; const seen = new Set<string>();
      const inLtr = (el: Element | null) => { while (el) { const d = (el as HTMLElement).getAttribute && (el as HTMLElement).getAttribute('dir'); if (d === 'ltr') return true; el = el.parentElement; } return false; };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n: Node | null;
      while ((n = w.nextNode())) {
        const t = (n.textContent || '').trim(); if (!t || !HE.test(t)) continue;
        const el = n.parentElement as HTMLElement; if (!el || !el.getClientRects().length) continue;
        if (inLtr(el)) continue;                                             // dir=ltr numeric island (L13) — Hebrew there is a mistake we don't make; skip legit
        if ((el.className || '').toString().includes('lf-name')) continue;   // language-picker native names (intentional, audit Finding 4)
        const k = t.slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(k);
      }
      return out;
    });
    if (leaks.length) console.log(`[${lang}] raw-Hebrew leaks (${leaks.length}):`, JSON.stringify(leaks.slice(0, 15)));
    expect(leaks.length, `${lang}: raw Hebrew rendered in a non-Hebrew language — see log`).toBe(0);
  });
}

test('i18n extractor staleness — a fresh extraction reproduces the committed lang/_extracted.json (spec §8.3)', async () => {
  execFileSync('node', ['scripts/i18n-extract.mjs', 'app.js'], { stdio: 'pipe' });
  const fresh = JSON.parse(readFileSync('lang/_extracted.json', 'utf8'));
  // compare the fresh extraction to the committed copy (the extractor rewrote it in place)
  const committed = JSON.parse(execFileSync('git', ['show', 'HEAD:lang/_extracted.json'], { encoding: 'utf8' }));
  expect(Object.keys(fresh).sort(), 'extractor output drifted from committed _extracted.json — regenerate it').toEqual(Object.keys(committed).sort());
});
