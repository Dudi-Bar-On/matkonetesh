import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8129';
const OUT = 'C:/Users/dudib/source/repos/matconetesh/.superpowers/sdd/nav-audit';

// SAFETY: eval() over a FIXED list of literal identifier names only (app.js top-level `let`
// bindings live in the global declarative record, not on window). No external input. Test-only.
const PROBE = `(() => {
  const safe=(f,d)=>{try{return f()}catch(e){return d}};
  const p=document.querySelector('#panel'); const open=p?p.classList.contains('open'):false;
  return { screen: safe(()=>eval('cCurrent'),'?'), stack: safe(()=>eval('panelStack').length,null),
    panelOpen: open, panelTitle: open?(p.querySelector('h2')?.textContent||'').trim().replace(/\\s+/g,' ').slice(0,44):null,
    backBtn: open?!!p.querySelector('.backbtn'):false, catGroup: safe(()=>eval('activeGroup'),'?'),
    histLen: history.length, url: location.pathname };
})()`;

const rows = [], shots = [];
const probe = p => p.evaluate(PROBE).catch(() => ({ screen: 'GONE', stack: null, panelOpen: false, panelTitle: null, backBtn: false, catGroup: '?', histLen: '?', url: 'about:blank' }));
const fmt = s => `screen=${s.screen} catGroup=${JSON.stringify(s.catGroup)} stack=${s.stack} panel=${s.panelOpen ? '"' + s.panelTitle + '"' : 'CLOSED'} back=${s.backBtn ? 'Y' : 'n'} hist=${s.histLen} url=${s.url}`;
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
const CARD = '#scr-catalog article.card[data-n]';
async function openFirstItem(page) {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(600);
  await page.click('#scr-catalog .cattile:has-text("בשר אדום")'); await page.waitForTimeout(800);
  const c = page.locator(CARD).first();
  await c.scrollIntoViewIfNeeded();
  await c.click({ position: { x: 60, y: 90 } });   // avoid the ☆ / ＋ overlay buttons
  await page.waitForTimeout(900);
}

const S = []; const scen = (id, fn) => S.push({ id, fn });

// ══ S18 — POSITIVE CONTROL: catalog item panel → ✕ ═════════════════════════
scen('S18', async (page) => {
  await page.click('.cnav button[data-cnav="catalog"]'); await page.waitForTimeout(600);
  await page.click('#scr-catalog .cattile:has-text("בשר אדום")'); await page.waitForTimeout(800);
  const inCat = await probe(page);
  await openFirstItemInner(page);
  const inPanel = await probe(page);
  if (!inPanel.panelOpen) throw new Error('item card click did not open a panel');
  const s = await shot(page, 's18-item-panel-over-catalog');
  await page.click('#panel .x'); await page.waitForTimeout(500);
  const after = await probe(page);
  record({ id: 'S18', entry: 'POSITIVE CONTROL — catalog → בשר אדום → item recipe panel → ✕',
    detail: `in category: ${fmt(inCat)}  ||  in item panel: ${fmt(inPanel)}`, landed: fmt(after),
    expected: 'panel closes, back on the catalog category view I came from',
    mismatch: !(after.screen === 'catalog' && !after.panelOpen), shot: s });
});
async function openFirstItemInner(page) {
  const c = page.locator(CARD).first();
  await c.scrollIntoViewIfNeeded();
  await c.click({ position: { x: 60, y: 90 } });
  await page.waitForTimeout(900);
}

// ══ S21 — item panel open over catalog → BROWSER BACK ══════════════════════
scen('S21', async (page) => {
  await openFirstItem(page);
  const inPanel = await probe(page);
  if (!inPanel.panelOpen) throw new Error('item card click did not open a panel');
  try { await page.goBack({ waitUntil: 'load', timeout: 6000 }); } catch (e) {}
  await page.waitForTimeout(500);
  const after = await probe(page);
  const s = await shot(page, 's21-item-panel-after-browser-back');
  record({ id: 'S21', entry: 'recipe/item panel open over catalog → BROWSER / ANDROID BACK',
    detail: `in item panel: ${fmt(inPanel)}`,
    landed: fmt(after) + (after.url === 'about:blank' ? '   << LEFT THE APP ENTIRELY' : ''),
    expected: 'the panel closes and I stay on the catalog', mismatch: !after.panelOpen, shot: s });
});

// ══ S23 — item panel → nested seasonings sub-panel → ✕ ════════════════════
scen('S23', async (page) => {
  await openFirstItem(page);
  const inPanel = await probe(page);
  if (!inPanel.panelOpen) throw new Error('item card click did not open a panel');
  const seas = page.locator('#panel [data-seas]').first();
  if (!(await seas.count())) throw new Error('no [data-seas] link in this item panel');
  await seas.scrollIntoViewIfNeeded();
  await seas.click(); await page.waitForTimeout(900);
  const nested = await probe(page);
  const s = await shot(page, 's23-nested-seasonings-from-item');
  await page.click('#panel .x'); await page.waitForTimeout(500);
  const after = await probe(page);
  record({ id: 'S23', entry: 'catalog item panel → seasonings sub-panel (nested, openFrom) → ✕',
    detail: `item panel: ${fmt(inPanel)}  ||  nested: ${fmt(nested)}`, landed: fmt(after),
    expected: 'pop ONE level → back on the item/recipe panel I came from',
    mismatch: !after.panelOpen, shot: s });
});

// ══ S24 — same nested pair, exited with the in-panel back button ═══════════
scen('S24', async (page) => {
  await openFirstItem(page);
  const seas = page.locator('#panel [data-seas]').first();
  if (!(await seas.count())) throw new Error('no [data-seas] link in this item panel');
  await seas.scrollIntoViewIfNeeded(); await seas.click(); await page.waitForTimeout(900);
  const nested = await probe(page);
  const bb = page.locator('#panel .backbtn');
  const has = await bb.count();
  if (has) { await bb.click(); await page.waitForTimeout(600); }
  const after = await probe(page);
  record({ id: 'S24', entry: 'catalog item → seasonings (nested) → in-panel "→ חזרה לחלון הקודם"',
    detail: `nested: ${fmt(nested)}  backbtn_present=${has}`, landed: fmt(after),
    expected: 'back on the item/recipe panel', mismatch: !(after.panelOpen && after.stack === 0), shot: null });
});

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  for (const { id, fn } of S) {
    let page;
    try { page = await newPage(browser); await fn(page); }
    catch (e) { record({ id, entry: `(scenario ${id} could not complete)`, detail: String(e.message || e).split('\n')[0].slice(0, 180), landed: 'COULD NOT COMPLETE — not counted', expected: '—', mismatch: false, error: true, shot: null }); }
    finally { if (page) await page.context().close().catch(() => {}); }
  }
  await browser.close();
  const bad = rows.filter(r => r.mismatch), err = rows.filter(r => r.error);
  console.log('\n\n════════ SUMMARY 3 ════════');
  console.log(`run: ${rows.length}  mismatches: ${bad.length}  could-not-complete: ${err.length}`);
  bad.forEach(r => console.log(`  MISMATCH ${r.id}: ${r.entry}`));
  err.forEach(r => console.log(`  INCOMPLETE ${r.id}: ${r.detail}`));
  fs.writeFileSync(`${OUT}/observations3.json`, JSON.stringify(rows, null, 2));
  console.log(`\nwrote ${OUT}/observations3.json`);
  console.log('screenshots: ' + shots.join(', '));
};
run().catch(e => { console.error('FATAL', e); process.exit(1); });
