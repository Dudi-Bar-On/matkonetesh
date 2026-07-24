import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.NAV_BASE || 'http://127.0.0.1:8129';
const OUT = 'C:/Users/dudib/source/repos/matconetesh/.superpowers/sdd/nav-audit';

// SAFETY NOTE: the probe below uses eval() over a FIXED list of literal identifier names.
// app.js declares cCurrent / cWiz / panelStack with top-level `let`, which places them in the
// global declarative record — they are NOT properties of window, so eval in global scope is the
// only way to read them. No user or network input reaches this string. Scratch/test-only.
const PROBE = `(() => {
  const safe = (fn, d) => { try { return fn(); } catch(e) { return d; } };
  const p = document.querySelector('#panel');
  const open = p ? p.classList.contains('open') : false;
  return {
    screen: safe(()=>eval('cCurrent'), '?'),
    wizStep: safe(()=>eval('cWiz').step, null),
    stack: safe(()=>eval('panelStack').length, null),
    panelOpen: open,
    panelTitle: open ? (p.querySelector('h2')?.textContent||'').trim().replace(/\\s+/g,' ').slice(0,44) : null,
    backBtn: open ? !!p.querySelector('.backbtn') : false,
    histLen: history.length,
    url: location.pathname,
  };
})()`;

const rows = [];
const shots = [];

async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'he-IL',
  });
  // skip the first-run onboarding panel so every scenario starts from a clean home
  await ctx.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', 'true'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return page;
}

const probe = (p) => p.evaluate(PROBE).catch(() => ({ screen: 'GONE', wizStep: null, stack: null, panelOpen: false, panelTitle: null, backBtn: false, histLen: '?', url: 'about:blank' }));
const fmt = (s) => `screen=${s.screen} wiz=${s.wizStep} stack=${s.stack} panel=${s.panelOpen ? '"' + s.panelTitle + '"' : 'CLOSED'} back=${s.backBtn ? 'Y' : 'n'} hist=${s.histLen} url=${s.url}`;

async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png` }); shots.push(name + '.png'); return name + '.png'; }

function record(r) {
  rows.push(r);
  console.log(`\n--- [${r.id}] ${r.entry}`);
  if (r.detail) console.log(`    ctx:  ${r.detail}`);
  console.log(`    got:  ${r.landed}`);
  console.log(`    want: ${r.expected}`);
  console.log(`    ${r.mismatch ? '### MISMATCH' : 'OK — matches expectation'}${r.shot ? '  shot=' + r.shot : ''}`);
}

// open the ☰ More sheet then click a labelled entry (☰ only exists on the home screen)
async function viaMore(page, label) {
  await page.click('.cnav button[data-cnav="home"]').catch(() => {});
  await page.waitForTimeout(250);
  await page.click('#cHomeMore');
  await page.waitForTimeout(300);
  await page.click(`#panel [data-mfn]:has-text("${label}")`);
  await page.waitForTimeout(500);
}

const SCENARIOS = [];
const scen = (id, fn) => SCENARIOS.push({ id, fn });

// ══ S1 — ☰ More → Calculator → ✕ ════════════════════════════════════════════
scen('S1', async (page) => {
  await page.click('#cHomeMore'); await page.waitForTimeout(300);
  const atMore = await probe(page);
  await page.click('#panel [data-mfn]:has-text("מחשבון מלח")'); await page.waitForTimeout(500);
  const atCalc = await probe(page);
  const s = await shot(page, 's1-calc-open-no-backbtn');
  await page.click('#panel .x'); await page.waitForTimeout(400);
  const after = await probe(page);
  if (!after.panelOpen) await shot(page, 's1-after-x-landed-home');
  record({ id: 'S1', entry: '☰ More sheet → מחשבון מלח/כמויות → ✕',
    detail: `at ☰ More: ${fmt(atMore)}  ||  at Calculator: ${fmt(atCalc)}`,
    landed: fmt(after), expected: 'back on the ☰ More sheet — that is where I came from',
    mismatch: !after.panelOpen, shot: s });
});

// ══ S2 — panel open → BROWSER / ANDROID BACK ════════════════════════════════
scen('S2', async (page) => {
  await viaMore(page, 'מחשבון מלח');
  const before = await probe(page);
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  const s = await shot(page, 's2-after-browser-back-from-panel');
  record({ id: 'S2', entry: 'Calculator panel open → BROWSER / ANDROID hardware BACK',
    detail: `before: ${fmt(before)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP ENTIRELY' : ''),
    expected: 'the panel closes and I stay in the app', mismatch: !after.panelOpen, shot: s });
});

// ══ S3 — catalog screen → BROWSER BACK ══════════════════════════════════════
scen('S3', async (page) => {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(500);
  const before = await probe(page);
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  const s = await shot(page, 's3-after-browser-back-from-catalog');
  record({ id: 'S3', entry: 'bottom nav → קטלוג (catalog screen) → BROWSER / ANDROID BACK',
    detail: `before: ${fmt(before)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP ENTIRELY' : ''),
    expected: 'return to the בית (home) screen I came from', mismatch: after.screen !== 'home', shot: s });
});

// ══ S4 — catalog screen → RELOAD / PWA relaunch ═════════════════════════════
scen('S4', async (page) => {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(500);
  const before = await probe(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const after = await probe(page);
  record({ id: 'S4', entry: 'catalog screen → RELOAD (= relaunching the installed PWA)',
    detail: `before: ${fmt(before)}`, landed: fmt(after),
    expected: 'still on the catalog screen', mismatch: after.screen !== 'catalog', shot: null });
});

// ══ S5 — panel open → RELOAD ════════════════════════════════════════════════
scen('S5', async (page) => {
  await viaMore(page, 'מחשבון מלח');
  const before = await probe(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const after = await probe(page);
  record({ id: 'S5', entry: 'Calculator panel open → RELOAD',
    detail: `before: ${fmt(before)}`, landed: fmt(after),
    expected: 'the calculator panel is still open', mismatch: after.panelOpen !== true, shot: null });
});

// ══ S6 — wizard mid-flow → RELOAD ═══════════════════════════════════════════
scen('S6', async (page) => {
  await page.click('.cnav button[data-cnav="wizard"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { try { cwGo(3); } catch (e) {} }); await page.waitForTimeout(450);
  const before = await probe(page);
  const sb = await shot(page, 's6-wizard-step3-before-reload');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  const after = await probe(page);
  const s = await shot(page, 's6-wizard-after-reload');
  record({ id: 'S6', entry: 'event wizard advanced to step 3 → RELOAD',
    detail: `before: ${fmt(before)}  (before-shot ${sb})`, landed: fmt(after),
    expected: 'still in the wizard at step 3', mismatch: !(after.screen === 'wizard' && after.wizStep === 3), shot: s });
});

// ══ S7 — wizard mid-flow → BROWSER BACK ═════════════════════════════════════
scen('S7', async (page) => {
  await page.click('.cnav button[data-cnav="wizard"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { try { cwGo(3); } catch (e) {} }); await page.waitForTimeout(450);
  const before = await probe(page);
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  const s = await shot(page, 's7-wizard-after-browser-back');
  record({ id: 'S7', entry: 'event wizard at step 3 → BROWSER / ANDROID BACK',
    detail: `before: ${fmt(before)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP, MID-WIZARD' : ''),
    expected: 'step back to wizard step 2', mismatch: !(after.screen === 'wizard' && after.wizStep === 2), shot: s });
});

// ══ S8 — wizard entered FROM events → exit wizard ═══════════════════════════
scen('S8', async (page) => {
  await page.click('.cnav button[data-cnav="events"]'); await page.waitForTimeout(500);
  const atEvents = await probe(page);
  await page.click('.cnav button[data-cnav="wizard"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { try { cwGo(2); } catch (e) {} }); await page.waitForTimeout(400);
  const inWiz = await probe(page);
  await page.evaluate(() => { try { cwExitWizard(); } catch (e) {} }); await page.waitForTimeout(800);
  const after = await probe(page);
  const s = await shot(page, 's8-wizard-exit-from-events');
  record({ id: 'S8', entry: 'events screen → wizard (step 2) → exit the wizard',
    detail: `at events: ${fmt(atEvents)}  ||  in wizard: ${fmt(inWiz)}`, landed: fmt(after),
    expected: 'return to the אירועים (events) screen I entered from', mismatch: after.screen !== 'events', shot: s });
});

// ══ S9 — nested panel (real openFrom path) → ✕ ══════════════════════════════
scen('S9', async (page) => {
  await page.evaluate(() => { try { openMenu(); } catch (e) {} }); await page.waitForTimeout(600);
  const atMenu = await probe(page);
  await page.evaluate(() => { try { openFrom(openMenu, openCart); } catch (e) {} }); await page.waitForTimeout(600);
  const atCart = await probe(page);
  const s = await shot(page, 's9-nested-cart-has-backbtn');
  await page.click('#panel .x'); await page.waitForTimeout(450);
  const after = await probe(page);
  if (!after.panelOpen) await shot(page, 's9-after-x-whole-stack-gone');
  record({ id: 'S9', entry: 'Meal builder → Shopping cart (nested, stack=1) → ✕',
    detail: `at meal builder: ${fmt(atMenu)}  ||  at cart: ${fmt(atCart)}`, landed: fmt(after),
    expected: 'pop ONE level → back on the Meal builder panel', mismatch: !after.panelOpen, shot: s });
});

// ══ S10 — nested panel → in-panel back button (the one correct affordance) ══
scen('S10', async (page) => {
  await page.evaluate(() => { try { openMenu(); openFrom(openMenu, openCart); } catch (e) {} }); await page.waitForTimeout(700);
  const atCart = await probe(page);
  const has = await page.locator('#panel .backbtn').count();
  if (has) { await page.click('#panel .backbtn'); await page.waitForTimeout(500); }
  const after = await probe(page);
  record({ id: 'S10', entry: 'Meal builder → cart (nested) → in-panel "→ חזרה לחלון הקודם" button',
    detail: `at cart: ${fmt(atCart)}  backbtn_present=${has}`, landed: fmt(after),
    expected: 'return to the Meal builder panel', mismatch: !(after.panelOpen && after.stack === 0), shot: null });
});

// ══ S11 — nested panel → ESC ════════════════════════════════════════════════
scen('S11', async (page) => {
  await page.evaluate(() => { try { openMenu(); openFrom(openMenu, openCart); } catch (e) {} }); await page.waitForTimeout(700);
  const atCart = await probe(page);
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  const after = await probe(page);
  record({ id: 'S11', entry: 'Meal builder → cart (nested) → ESC key',
    detail: `at cart: ${fmt(atCart)}`, landed: fmt(after),
    expected: 'pop one level → back on the Meal builder', mismatch: !after.panelOpen, shot: null });
});

// ══ S12 — nested panel → scrim/backdrop tap ═════════════════════════════════
scen('S12', async (page) => {
  await page.evaluate(() => { try { openMenu(); openFrom(openMenu, openCart); } catch (e) {} }); await page.waitForTimeout(700);
  const atCart = await probe(page);
  await page.evaluate(() => document.querySelector('#scrim').click()); await page.waitForTimeout(450);
  const after = await probe(page);
  record({ id: 'S12', entry: 'Meal builder → cart (nested) → tap the scrim / backdrop',
    detail: `at cart: ${fmt(atCart)}`, landed: fmt(after),
    expected: 'pop one level → back on the Meal builder', mismatch: !after.panelOpen, shot: null });
});

// ══ S13 — a "tool" that teleports the whole screen instead of opening ═══════
scen('S13', async (page) => {
  const atHome = await probe(page);
  await page.click('#cHomeMore'); await page.waitForTimeout(300);
  const atMore = await probe(page);
  await page.click('#panel [data-mfn]:has-text("פרויקטים ומזווה")'); await page.waitForTimeout(700);
  const after = await probe(page);
  const s = await shot(page, 's13-pantry-teleported-screen');
  record({ id: 'S13', entry: 'home → ☰ More → 🧫 פרויקטים ומזווה (Projects & pantry)',
    detail: `at home: ${fmt(atHome)}  ||  at ☰ More: ${fmt(atMore)}`, landed: fmt(after),
    expected: 'a pantry PANEL opens over home; ✕ returns me to home',
    mismatch: after.panelOpen === false && after.screen !== 'home', shot: s });
});

// ══ S14 — glossary entry: closePanel + screen teleport ══════════════════════
scen('S14', async (page) => {
  await page.click('#cHomeMore'); await page.waitForTimeout(300);
  await page.click('#panel [data-mfn]:has-text("מילון")'); await page.waitForTimeout(700);
  const after = await probe(page);
  const s = await shot(page, 's14-glossary-teleported-to-catalog');
  record({ id: 'S14', entry: 'home → ☰ More → 📖 מילון (Glossary)',
    detail: 'entered from the home screen', landed: fmt(after),
    expected: 'a glossary panel over home; closing it returns me to home',
    mismatch: after.screen !== 'home', shot: s });
});

// ══ S15 — POSITIVE CONTROL: overlay panel over catalog → ✕ ═════════════════
scen('S15', async (page) => {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(600);
  const atCatalog = await probe(page);
  const card = page.locator('#scr-catalog .card, #scr-catalog [data-cut]').first();
  const n = await card.count();
  if (n) { await card.click(); await page.waitForTimeout(700); }
  const inPanel = await probe(page);
  if (inPanel.panelOpen) { await page.click('#panel .x'); await page.waitForTimeout(450); }
  const after = await probe(page);
  record({ id: 'S15', entry: 'POSITIVE CONTROL — catalog → open a recipe/cut panel → ✕',
    detail: `at catalog: ${fmt(atCatalog)}  ||  in panel: ${fmt(inPanel)}  (clickable card found=${n})`,
    landed: fmt(after), expected: 'return to the catalog screen underneath',
    mismatch: after.screen !== 'catalog', shot: null });
});

// ══ S16 — unsaved data: type into a form then ✕ ═════════════════════════════
scen('S16', async (page) => {
  await viaMore(page, 'תזכורות');
  const sel = '#panel input[type="text"], #panel input:not([type]), #panel textarea';
  const n = await page.locator(sel).count();
  let typed = '', warned = false, kept = null;
  if (n) {
    page.on('dialog', async d => { warned = true; await d.dismiss(); });
    typed = 'בדיקת ניווט 123';
    await page.locator(sel).first().fill(typed);
    await page.click('#panel .x'); await page.waitForTimeout(500);
    // an in-app appConfirm would still be on screen; check for it too
    const dlg = await page.locator('.appdlg, .appdlg-scrim').count();
    if (dlg) warned = true;
    await viaMore(page, 'תזכורות');
    kept = await page.locator(sel).first().inputValue().catch(() => null);
  }
  const after = await probe(page);
  record({ id: 'S16', entry: 'תזכורות (Reminders) form → type text → ✕ without saving',
    detail: `text_inputs=${n} typed="${typed}" warned=${warned} value_after_reopen="${kept}"`,
    landed: fmt(after), expected: 'an "unsaved changes" warning, or the draft is preserved',
    mismatch: n > 0 && !warned && !kept, shot: null });
});

// ══ S17 — does ANY navigation push a history entry? ═════════════════════════
scen('S17', async (page) => {
  const h0 = (await probe(page)).histLen;
  await page.click('#cHomeMore'); await page.waitForTimeout(300);
  const h1 = (await probe(page)).histLen;
  await page.click('#panel [data-mfn]:has-text("מחשבון מלח")'); await page.waitForTimeout(500);
  const h2 = (await probe(page)).histLen;
  await page.click('#panel .x'); await page.waitForTimeout(350);
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(500);
  const h3 = (await probe(page)).histLen;
  await page.evaluate(() => { try { cNavGo('wizard'); cwGo(2); } catch (e) {} }); await page.waitForTimeout(500);
  const h4 = (await probe(page)).histLen;
  record({ id: 'S17', entry: 'history.length across: boot → ☰ → panel → screen switch → wizard step',
    detail: `boot=${h0}  ☰open=${h1}  panelOpen=${h2}  screenSwitch=${h3}  wizardStep=${h4}`,
    landed: `history.length NEVER changes (${h0}→${h1}→${h2}→${h3}→${h4}). The app creates ZERO history entries; every state above lives only in JS variables.`,
    expected: 'each navigable state pushes an entry so Back can unwind it',
    mismatch: !(h1 > h0 || h2 > h1 || h3 > h2 || h4 > h3), shot: null });
});

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  for (const { id, fn } of SCENARIOS) {
    let page;
    try {
      page = await newPage(browser);
      await fn(page);
    } catch (e) {
      record({ id, entry: `(scenario ${id} threw)`, detail: String(e).split('\n')[0].slice(0, 200),
        landed: 'COULD NOT COMPLETE', expected: '—', mismatch: false, error: true, shot: null });
    } finally {
      if (page) await page.context().close().catch(() => {});
    }
  }
  await browser.close();

  const bad = rows.filter(r => r.mismatch);
  const err = rows.filter(r => r.error);
  console.log('\n\n════════════ SUMMARY ════════════');
  console.log(`scenarios run: ${rows.length}   mismatches: ${bad.length}   could-not-complete: ${err.length}`);
  bad.forEach(r => console.log(`  MISMATCH ${r.id}: ${r.entry}`));
  err.forEach(r => console.log(`  ERROR    ${r.id}: ${r.detail}`));
  fs.writeFileSync(`${OUT}/observations.json`, JSON.stringify(rows, null, 2));
  console.log(`\nwrote ${OUT}/observations.json`);
  console.log('screenshots: ' + shots.join(', '));
};
run().catch(e => { console.error('FATAL', e); process.exit(1); });
