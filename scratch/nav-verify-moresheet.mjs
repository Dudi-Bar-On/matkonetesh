import { chromium } from '@playwright/test';
const OUT = 'C:/Users/dudib/source/repos/matconetesh/.superpowers/sdd/nav-audit';
// SAFETY: eval() over fixed literal identifier names (top-level `let` in app.js, not on window). Test-only.
const PROBE = `(()=>{const p=document.querySelector('#panel');const o=p?p.classList.contains('open'):false;
 return{screen:(()=>{try{return eval('cCurrent')}catch(e){return'?'}})(),
 stack:(()=>{try{return eval('panelStack').length}catch(e){return null}})(),
 open:o,title:o?(p.querySelector('h2')?.textContent||'').trim().replace(/\\s+/g,' ').slice(0,32):null,
 back:o?!!p.querySelector('.backbtn'):false};})()`;

const b = await chromium.launch({ headless: true });
const mk = async () => {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'he-IL' });
  await c.addInitScript(() => { try { localStorage.setItem('mk-uilevel-asked', 'true'); } catch (e) {} });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8129', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  return p;
};

// 1) how many entries does the ☰ sheet actually offer?
let p = await mk();
await p.click('#cHomeMore'); await p.waitForTimeout(400);
const entries = await p.evaluate(`[...document.querySelectorAll('#panel [data-mfn]')].map(e=>e.dataset.mfn)`);
const uniq = [...new Set(entries)];
console.log(`☰ More sheet entries: ${entries.length} elements, ${uniq.length} unique targets`);
console.log(uniq.join(', '));
await p.context().close();

// 2) open EVERY unique entry and record: did a panel open? did it have a back button? did the screen move?
const results = [];
for (const fn of uniq) {
  p = await mk();
  try {
    await p.click('#cHomeMore'); await p.waitForTimeout(350);
    const before = await p.evaluate(PROBE);
    const el = p.locator(`#panel [data-mfn="${fn}"]`).first();
    await el.scrollIntoViewIfNeeded();
    await el.click(); await p.waitForTimeout(900);
    const after = await p.evaluate(PROBE);
    results.push({ fn, screenBefore: before.screen, ...after });
  } catch (e) {
    results.push({ fn, error: String(e.message || e).slice(0, 70) });
  }
  await p.context().close();
}

console.log('\n%-22s %-9s %-6s %-6s %s'.replace(/%-?(\d+)s/g, (m, n) => ' '.repeat(0)) );
console.log('target                | screen   | panel | back | stack | title');
console.log('----------------------+----------+-------+------+-------+---------------------------');
let noPanel = 0, noBack = 0, moved = 0, ok = 0;
for (const r of results) {
  if (r.error) { console.log(`${r.fn.padEnd(21)} | ERROR ${r.error}`); continue; }
  if (!r.open) noPanel++;
  if (r.open && !r.back) noBack++;
  if (r.screen !== 'home') moved++;
  if (r.open && r.back) ok++;
  console.log(`${r.fn.padEnd(21)} | ${String(r.screen).padEnd(8)} | ${String(r.open).padEnd(5)} | ${String(r.back).padEnd(4)} | ${String(r.stack).padEnd(5)} | ${r.title || '—'}`);
}
console.log(`\nTOTALS: opened_a_panel_with_back_button=${ok}  panel_but_NO_back_button=${noBack}  no_panel_at_all=${noPanel}  screen_moved_off_home=${moved}`);
await b.close();
