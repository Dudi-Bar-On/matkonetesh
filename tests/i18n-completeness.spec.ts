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
    // v268.1 — the data-driven SCREENS the v268 test never drove (catalog grid + category, event
    // wizard all steps, projects/pantry). These render recipe/category/wood/origin DATA values +
    // static-shell chrome; driving them arms __i18nTrace + the per-screen raw-Hebrew scan below.
    `(function(){ if(typeof closePanel==='function') closePanel(); if(typeof cNavGo==='function') cNavGo('catalog'); if(typeof catView==='function') catView('landing'); })()`,
    `(function(){ if(typeof setCatNav==='function') setCatNav('בשר אדום'); if(typeof buildChips==='function') buildChips(); if(typeof catView==='function') catView('cat'); })()`,
    `(function(){ if(typeof setMenuCtx==='function') setMenuCtx('event'); if(typeof cNavGo==='function') cNavGo('wizard'); for(var i=0;i<6;i++){ try{ if(typeof cwGo==='function') cwGo(i); }catch(e){} } })()`,
    `(function(){ if(typeof cNavGo==='function') cNavGo('projects'); })()`,
    `(function(){ if(typeof cNavGo==='function') cNavGo('events'); })()`,
    `typeof toast==='function'&&toast(L('נשמר','Saved'))`,                                       // fire a TOAST (localized — a raw literal here would be a test artifact, not an app leak)
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
      // NOTE (v268.1): do NOT skip dir=ltr. That skip existed for numeric islands (≥/≤), but those are
      // Latin/symbols and never match HE.test — so the only thing dir=ltr ever hid was Hebrew WORDS inside
      // an ltr container (e.g. the catalog count row "N נתחים · N מלאכה"), which is always a real leak.
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n: Node | null;
      while ((n = w.nextNode())) {
        const t = (n.textContent || '').trim(); if (!t || !HE.test(t)) continue;
        const el = n.parentElement as HTMLElement; if (!el || !el.getClientRects().length) continue;
        if ((el.className || '').toString().includes('lf-name')) continue;   // language-picker native names (intentional, audit Finding 4)
        const k = t.slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(k);
      }
      return out;
    });
    if (leaks.length) console.log(`[${lang}] raw-Hebrew leaks (${leaks.length}):`, JSON.stringify(leaks.slice(0, 15)));
    expect(leaks.length, `${lang}: raw Hebrew rendered in a non-Hebrew language — see log`).toBe(0);
  });

  // v268.1 — PER-SCREEN scan. Screens (catalog/wizard/projects/events) are mutually exclusive (.on
  // toggling), so a single end-of-run scan only sees the last one. Navigate each screen (and each
  // wizard step) and scan it WHILE VISIBLE, including placeholder/aria-label/title attributes (the
  // owner-#3 leak). Skips [data-mt] async-prose (v269, Hebrew-until-hydrated) + the version stamp.
  test(`i18n completeness — no raw-Hebrew per SCREEN in ${lang} (catalog grid/wizard/projects)`, async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify(lang) });
    await page.evaluate(`(function(){
      equipSave([{id:'sm1',cat:'smoker',type:'קטל (ככלי עישון)',name:'My Smoker',cap:{racks:1,areaCm2:2400}}]); equipSetConfigured();
      saveMenu({guests:4,appetite:'reg',kosher:false,keys:['cut-1','cut-74'],sides:[],drinks:[],desserts:[],gpm:0});
      if(typeof setMenuCtx==='function') setMenuCtx('event');
      if(typeof setLang==='function') setLang(${JSON.stringify(lang)});
    })()`);
    const SCREENS: [string, string][] = [
      ['catalog-landing', `if(typeof closePanel==='function')closePanel(); cNavGo('catalog'); catView('landing');`],
      ['catalog-category', `setCatNav('בשר אדום'); if(typeof buildChips==='function')buildChips(); catView('cat');`],
      ['projects', `cNavGo('projects');`],
      ['events', `cNavGo('events');`],
    ];
    for (let i = 0; i < 6; i++) SCREENS.push([`wizard-step-${i}`, `cNavGo('wizard'); try{cwGo(${i});}catch(e){} if(typeof cwSyncFromMenu==='function'){try{cwSyncFromMenu();}catch(e){}}`]);
    const scan = `(function(){
      const HE=/[֐-׿]/; const out=[]; const seen=new Set();
      const skip=el=>{ while(el){ if(el.getAttribute){ if(el.hasAttribute('data-mt'))return true; const c=(el.className||'').toString(); if(c.includes('lf-name')||c.includes('foot-stamp'))return true; } el=el.parentElement; } return false; };
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n;
      while((n=w.nextNode())){ const t=(n.textContent||'').trim(); if(!t||!HE.test(t))continue; const el=n.parentElement; if(!el||!el.getClientRects().length)continue; if(skip(el))continue; const k=t.slice(0,60); if(!seen.has(k)){seen.add(k);out.push(k);} }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function(el){ if(!el.getClientRects().length||skip(el))return; ['placeholder','aria-label','title'].forEach(function(a){ const v=el.getAttribute(a); if(v&&HE.test(v)){ const k='@'+a+':'+v.slice(0,50); if(!seen.has(k)){seen.add(k);out.push(k);} } }); });
      return out;
    })()`;
    const all: Record<string, string[]> = {};
    for (const [name, drive] of SCREENS) {
      try { await page.evaluate(drive); } catch {}
      await page.waitForTimeout(80);
      const leaks: string[] = await page.evaluate(scan);
      if (leaks.length) all[name] = leaks;
    }
    if (Object.keys(all).length) console.log(`[${lang}] per-screen raw-Hebrew:`, JSON.stringify(all).slice(0, 1600));
    expect(Object.keys(all).length, `${lang}: raw Hebrew on ${Object.keys(all).join(', ')} — see log`).toBe(0);
  });
}

test('i18n extractor staleness — a fresh extraction reproduces the committed lang/_extracted.json (spec §8.3)', async () => {
  execFileSync('node', ['scripts/i18n-extract.mjs', 'app.js'], { stdio: 'pipe' });
  const fresh = JSON.parse(readFileSync('lang/_extracted.json', 'utf8'));
  // compare the fresh extraction to the committed copy (the extractor rewrote it in place)
  const committed = JSON.parse(execFileSync('git', ['show', 'HEAD:lang/_extracted.json'], { encoding: 'utf8' }));
  expect(Object.keys(fresh).sort(), 'extractor output drifted from committed _extracted.json — regenerate it').toEqual(Object.keys(committed).sort());
});
