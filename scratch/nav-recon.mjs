import { chromium } from '@playwright/test';

const BASE = process.env.NAV_BASE || 'http://127.0.0.1:8129';
const OUT = 'C:/Users/dudib/source/repos/matconetesh/.superpowers/sdd/nav-audit';

// Reads the app's own navigation state — far more precise than eyeballing a screenshot.
// SAFETY: eval() here is a read-only diagnostic over a FIXED set of literal identifier
// names ('cCurrent' etc). app.js declares these with top-level `let`, so they live in the
// global declarative record and are NOT properties of `window` — eval in global scope is
// the only way to read them. No user/network input ever reaches this string. Test-only
// scratch script; never shipped.
const PROBE = `(() => {
  const g = (n) => { try { return eval(n); } catch(e) { return '<unreachable:'+n+'>'; } };
  const p = document.querySelector('#panel');
  return {
    cCurrent: g('cCurrent'),
    wizStep: (()=>{ try { return cWiz.step; } catch(e){ return null; } })(),
    panelStackLen: (()=>{ try { return panelStack.length; } catch(e){ return null; } })(),
    panelOpen: p ? p.classList.contains('open') : null,
    panelTitle: p ? (p.querySelector('h2')?.textContent || '').trim().slice(0,60) : null,
    hasBackBtn: p ? !!p.querySelector('.backbtn') : null,
    screenOn: [...document.querySelectorAll('.screen')].filter(s=>s.classList.contains('on')).map(s=>s.id),
    historyLength: history.length,
    url: location.href,
  };
})()`;

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    locale: 'he-IL',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  console.log('=== BOOT STATE ===');
  console.log(JSON.stringify(await page.evaluate(PROBE), null, 2));

  await page.screenshot({ path: `${OUT}/00-home.png` });

  // --- what nav affordances exist on home? ---
  console.log('\n=== BOTTOM NAV (.cnav button[data-cnav]) ===');
  console.log(JSON.stringify(await page.evaluate(`[...document.querySelectorAll('.cnav button[data-cnav]')].map(b=>({nav:b.dataset.cnav,txt:b.textContent.trim().replace(/\\s+/g,' ').slice(0,30)}))`), null, 2));

  console.log('\n=== SCREENS IN DOM ===');
  console.log(JSON.stringify(await page.evaluate(`[...document.querySelectorAll('.screen')].map(s=>s.id)`)));

  console.log('\n=== HOME clickable tiles/buttons (first 40) ===');
  console.log(JSON.stringify(await page.evaluate(`
    [...document.querySelectorAll('#scr-home button, #scr-home [data-act], #scr-home .ctile, #scr-home a')]
      .slice(0,40).map(b=>({tag:b.tagName, id:b.id||null, cls:(b.className||'').toString().slice(0,40), txt:(b.textContent||'').trim().replace(/\\s+/g,' ').slice(0,40)}))
  `), null, 2));

  console.log('\n=== ERRORS ===');
  console.log(errs.length ? errs.join('\n') : '(none)');

  await browser.close();
};
run().catch(e => { console.error('FATAL', e); process.exit(1); });
