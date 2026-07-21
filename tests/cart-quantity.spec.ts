import { test, expect } from '@playwright/test';

// C1 (refactoring report): the shopping cart showed a cut's WHOLE-CUT catalog weight (brisket 5.5 kg)
// instead of the per-guest quantity, while the print menu correctly showed ~3.7 kg for the same event.
// The cart is the screen you actually shop from, so it sent you to buy 1.5× too much meat.
// Root cause: three copies of the quantity formula; the cart's fallback was `c.kg`. Fixed by one shared
// rawGramsFor() used by the menu screen, the print menu, and the cart — they can no longer disagree.
//
// 8 guests · regular appetite (280 g/guest cooked) · 1 dish · brisket yield 0.6
//   → raw = 8*280/1/0.6 = 3733 g ≈ 3.7 kg   (NOT the 5.5 kg whole cut)

const boot = async (page: any, menu: any) => {
  await page.addInitScript(([m]: [any]) => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('he'));
    localStorage.setItem('mk-menu', JSON.stringify(m));
  } catch {} }, [menu]);
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openCart==='function' && typeof shopData==='function'`);
};

const MENU = { guests: 8, appetite: 'reg', kosher: false, keys: ['cut-1'], sides: [], drinks: [], desserts: [], gpm: 0 };

// the kg figure the cart shows on the brisket meat line (page-side, straight from shopData so it is
// exactly what the panel renders)
const cartBrisketKg = `(function(){
  var d=shopData();
  var line=(d.meat||[]).find(function(s){return s.indexOf('בריסקט')>=0;}) || '';
  var m=line.match(/~?([0-9]+(?:\\.[0-9]+)?)\\s*ק/);
  return m ? parseFloat(m[1]) : null;
})()`;

test('Q1: the cart shows the per-guest quantity, not the whole-cut weight (opened directly)', async ({ page }) => {
  await boot(page, MENU);
  // open the cart WITHOUT visiting the menu screen first — the exact path that showed 5.5 kg
  const kg = await page.evaluate(cartBrisketKg) as number;
  expect(kg).not.toBeNull();
  expect(kg).toBeLessThan(4.5);       // must be the per-guest ~3.7, never the 5.5 whole cut
  expect(kg).toBeGreaterThan(3.0);
});

test('Q2: the cart and the print menu agree on the quantity (both rendered)', async ({ page }) => {
  await boot(page, MENU);
  // read the ACTUAL rendered lines from both screens, not a recomputation
  const cart = await page.evaluate(cartBrisketKg) as number;
  const print = await page.evaluate(`(async function(){
    openMenuPrint();
    await new Promise(function(r){setTimeout(r,200);});
    var li=[].slice.call(document.querySelectorAll('#panel .menuprint li')).find(function(e){return e.innerText.indexOf('בריסקט')>=0;});
    var m=(li?li.innerText:'').match(/~?([0-9]+(?:\\.[0-9]+)?)\\s*ק/);
    return m?parseFloat(m[1]):null;
  })()`) as number;
  expect(cart).toBe(print);    // one source of truth — the two rendered numbers are identical
});

test('Q3: adding a side reduces the meat (sides factor), consistently', async ({ page }) => {
  await boot(page, MENU);
  const noSide = await page.evaluate(cartBrisketKg) as number;
  const withSide = await page.evaluate(`(function(){
    var s=menuState(); s.sides=['ירקות בגריל']; saveMenu(s);
    var d=shopData();
    var line=(d.meat||[]).find(function(x){return x.indexOf('בריסקט')>=0;})||'';
    var m=line.match(/~?([0-9]+(?:\\.[0-9]+)?)\\s*ק/);
    return m?parseFloat(m[1]):null;
  })()`) as number;
  expect(withSide).toBeLessThan(noSide);   // sides fill plates → less meat needed
});

test('Q4: doubling the guests roughly doubles the cart quantity', async ({ page }) => {
  await boot(page, MENU);
  const eight = await page.evaluate(cartBrisketKg) as number;
  const sixteen = await page.evaluate(`(function(){
    var s=menuState(); s.guests=16; saveMenu(s);
    var d=shopData();
    var line=(d.meat||[]).find(function(x){return x.indexOf('בריסקט')>=0;})||'';
    var m=line.match(/~?([0-9]+(?:\\.[0-9]+)?)\\s*ק/);
    return m?parseFloat(m[1]):null;
  })()`) as number;
  expect(sixteen).toBeGreaterThan(eight * 1.8);
  expect(sixteen).toBeLessThan(eight * 2.2);
});

// Task-review follow-ups: the cart's spec/make branches (not just cuts) must show a per-guest quantity,
// and the cross-event combined cart must not fall back to the whole-cut catalog weight either.
test('Q5: the cart shows a per-guest quantity for a make (charcuterie), not a blank', async ({ page }) => {
  await boot(page, { guests: 8, appetite: 'reg', kosher: false, keys: [], sides: [], drinks: [], desserts: [], gpm: 0 });
  const r = await page.evaluate(`(function(){
    var mk=Object.keys(DATA.makes)[0];
    var s=menuState(); s.keys=['make-'+mk]; saveMenu(s);
    var d=shopData();
    var line=(d.meat||[])[0]||'';
    var m=line.match(/~?([0-9]+(?:\\.[0-9]+)?)\\s*ק/);
    return { line: line, kg: m?parseFloat(m[1]):null };
  })()`) as any;
  expect(r.kg).not.toBeNull();          // a make now carries a quantity, not a blank
  expect(r.kg).toBeGreaterThan(0);
});

test('Q6: the combined cross-event cart uses per-guest quantities, never the whole-cut weight', async ({ page }) => {
  await boot(page, { guests: 8, appetite: 'reg', kosher: false, keys: [], sides: [], drinks: [], desserts: [], gpm: 0 });
  const r = await page.evaluate(`(function(){
    // two saved events, each an 8-guest single-brisket cook, NO menu-screen cache populated
    var mkEv=function(id){ return {id:id, name:id, date:'2026-08-01', serve:'19:00',
      menu:{guests:8, appetite:'reg', kosher:false, keys:['cut-1'], sides:[], drinks:[], desserts:[], gpm:0}}; };
    store.set('mk-events', [mkEv('evA'), mkEv('evB')]);
    var d=crossEventShopData();
    var brisket=d.items.find(function(i){return i.key==='cut-1';});
    return brisket ? { perEventKg: brisket.events[0].kg, totalKg: brisket.totalKg } : null;
  })()`) as any;
  expect(r).not.toBeNull();
  expect(r.perEventKg).toBeLessThan(4.5);   // per-guest ~3.7, never the 5.5 whole cut
  expect(r.perEventKg).toBeGreaterThan(3.0);
  expect(r.totalKg).toBeCloseTo(r.perEventKg * 2, 1);   // two events summed
});
