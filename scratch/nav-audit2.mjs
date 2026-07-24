import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8129';
const OUT = 'C:/Users/dudib/source/repos/matconetesh/.superpowers/sdd/nav-audit';

// SAFETY: eval() over a FIXED list of literal identifier names only. app.js declares
// cCurrent / cWiz / panelStack with top-level `let` (global declarative record, not on
// window), so global-scope eval is the only way to read them. No external input. Test-only.
const PROBE = `(() => {
  const safe=(f,d)=>{try{return f()}catch(e){return d}};
  const p=document.querySelector('#panel'); const open=p?p.classList.contains('open'):false;
  return { screen: safe(()=>eval('cCurrent'),'?'), wizStep: safe(()=>eval('cWiz').step,null),
    stack: safe(()=>eval('panelStack').length,null), panelOpen: open,
    panelTitle: open?(p.querySelector('h2')?.textContent||'').trim().replace(/\\s+/g,' ').slice(0,44):null,
    backBtn: open?!!p.querySelector('.backbtn'):false,
    catView: safe(()=>eval('activeGroup'),'?'),
    histLen: history.length, url: location.pathname };
})()`;

const rows = [], shots = [];
const probe = p => p.evaluate(PROBE).catch(() => ({ screen: 'GONE', wizStep: null, stack: null, panelOpen: false, panelTitle: null, backBtn: false, catView: '?', histLen: '?', url: 'about:blank' }));
const fmt = s => `screen=${s.screen} catGroup=${JSON.stringify(s.catView)} stack=${s.stack} panel=${s.panelOpen ? '"' + s.panelTitle + '"' : 'CLOSED'} back=${s.backBtn ? 'Y' : 'n'} hist=${s.histLen} url=${s.url}`;
async function shot(p, n) { await p.screenshot({ path: `${OUT}/${n}.png` }); shots.push(n + '.png'); return n + '.png'; }
function record(r) {
  rows.push(r);
  console.log(`\n--- [${r.id}] ${r.entry}`);
  if (r.detail) console.log(`    ctx:  ${r.detail}`);
  console.log(`    got:  ${r.landed}`);
  console.log(`    want: ${r.expected}`);
  console.log(`    ${r.mismatch ? '### MISMATCH' : 'OK — matches expectation'}${r.shot ? '  shot=' + r.shot : ''}`);
}
async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'he-IL' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', 'true'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  return p;
}
// catalog → open the "בשר אדום" category → click the first item card
async function intoRedMeat(page) {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(600);
  await page.click('#scr-catalog .cattile:has-text("בשר אדום")'); await page.waitForTimeout(700);
}

const S = []; const scen = (id, fn) => S.push({ id, fn });

// ══ S18 — POSITIVE CONTROL (valid): catalog item panel → ✕ ═════════════════
scen('S18', async (page) => {
  await intoRedMeat(page);
  const inCat = await probe(page);
  const card = page.locator('#scr-catalog main button, #scr-catalog main .card, #scr-catalog main [role="button"]').first();
  const n = await card.count();
  if (!n) throw new Error('no item card found inside the category view');
  await card.click(); await page.waitForTimeout(800);
  const inPanel = await probe(page);
  const s = await shot(page, 's18-item-panel-over-catalog');
  if (!inPanel.panelOpen) throw new Error('clicking the first card did not open a panel');
  await page.click('#panel .x'); await page.waitForTimeout(500);
  const after = await probe(page);
  record({
    id: 'S18', entry: 'POSITIVE CONTROL — catalog → בשר אדום → item panel → ✕',
    detail: `in category: ${fmt(inCat)}  ||  in item panel: ${fmt(inPanel)}`,
    landed: fmt(after),
    expected: 'panel closes and I am back on the catalog category view I came from',
    mismatch: !(after.screen === 'catalog' && !after.panelOpen), shot: s,
  });
});

// ══ S19 — catalog category view → the in-header "→" back button ════════════
scen('S19', async (page) => {
  await intoRedMeat(page);
  const inCat = await probe(page);
  await page.click('#scr-catalog .cshead button.back'); await page.waitForTimeout(600);
  const after = await probe(page);
  record({
    id: 'S19', entry: 'catalog → בשר אדום category → in-header "→" back button',
    detail: `in category: ${fmt(inCat)}`, landed: fmt(after),
    expected: 'return to the catalog tile landing (one level up)',
    mismatch: !(after.screen === 'catalog' && !after.catView), shot: null,
  });
});

// ══ S20 — catalog category view → BROWSER / ANDROID BACK ═══════════════════
scen('S20', async (page) => {
  await intoRedMeat(page);
  const inCat = await probe(page);
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  const s = await shot(page, 's20-category-after-browser-back');
  record({
    id: 'S20', entry: 'catalog → בשר אדום category (drilled in) → BROWSER / ANDROID BACK',
    detail: `in category: ${fmt(inCat)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP ENTIRELY' : ''),
    expected: 'the "→" button behaviour: back up to the catalog tile landing',
    mismatch: after.screen !== 'catalog', shot: s,
  });
});

// ══ S21 — item panel open over catalog → BROWSER BACK ══════════════════════
scen('S21', async (page) => {
  await intoRedMeat(page);
  const card = page.locator('#scr-catalog main button, #scr-catalog main .card').first();
  if (await card.count()) { await card.click(); await page.waitForTimeout(800); }
  const inPanel = await probe(page);
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  record({
    id: 'S21', entry: 'recipe/item panel open over catalog → BROWSER / ANDROID BACK',
    detail: `in item panel: ${fmt(inPanel)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP ENTIRELY' : ''),
    expected: 'the panel closes, I stay on the catalog', mismatch: !after.panelOpen, shot: null,
  });
});

// ══ S22 — catalog drilled into a category → RELOAD ═════════════════════════
scen('S22', async (page) => {
  await intoRedMeat(page);
  const inCat = await probe(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  const after = await probe(page);
  record({
    id: 'S22', entry: 'catalog drilled into בשר אדום → RELOAD (PWA relaunch)',
    detail: `in category: ${fmt(inCat)}`, landed: fmt(after),
    expected: 'still in the בשר אדום category', mismatch: after.screen !== 'catalog', shot: null,
  });
});

// ══ S23 — item panel → nested seasonings sub-panel → ✕ (real openFrom) ═════
scen('S23', async (page) => {
  await intoRedMeat(page);
  const card = page.locator('#scr-catalog main button, #scr-catalog main .card').first();
  if (await card.count()) { await card.click(); await page.waitForTimeout(800); }
  const inPanel = await probe(page);
  const seas = page.locator('#panel [data-seas]').first();
  const n = await seas.count();
  if (!n) throw new Error('no [data-seas] sub-panel link in this item panel');
  await seas.click(); await page.waitForTimeout(800);
  const nested = await probe(page);
  const s = await shot(page, 's23-nested-seasonings-from-item');
  await page.click('#panel .x'); await page.waitForTimeout(500);
  const after = await probe(page);
  record({
    id: 'S23', entry: 'catalog item panel → tap seasonings (nested, openFrom) → ✕',
    detail: `item panel: ${fmt(inPanel)}  ||  nested seasonings: ${fmt(nested)}`,
    landed: fmt(after),
    expected: 'pop ONE level → back on the item/recipe panel I came from',
    mismatch: !after.panelOpen, shot: s,
  });
});

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  for (const { id, fn } of S) {
    let page;
    try { page = await newPage(browser); await fn(page); }
    catch (e) {
      record({ id, entry: `(scenario ${id} could not complete)`, detail: String(e.message || e).split('\n')[0].slice(0, 180), landed: 'COULD NOT COMPLETE — not counted', expected: '—', mismatch: false, error: true, shot: null });
    } finally { if (page) await page.context().close().catch(() => {}); }
  }
  await browser.close();
  const bad = rows.filter(r => r.mismatch), err = rows.filter(r => r.error);
  console.log('\n\n════════ SUPPLEMENTARY SUMMARY ════════');
  console.log(`run: ${rows.length}  mismatches: ${bad.length}  could-not-complete: ${err.length}`);
  bad.forEach(r => console.log(`  MISMATCH ${r.id}: ${r.entry}`));
  err.forEach(r => console.log(`  INCOMPLETE ${r.id}: ${r.detail}`));
  fs.writeFileSync(`${OUT}/observations2.json`, JSON.stringify(rows, null, 2));
  console.log(`\nwrote ${OUT}/observations2.json`);
  console.log('screenshots: ' + shots.join(', '));
};
run().catch(e => { console.error('FATAL', e); process.exit(1); });
