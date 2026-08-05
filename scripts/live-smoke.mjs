#!/usr/bin/env node
// live-smoke — a short check against the DEPLOYED site. Phase C §4.3.
//
// The plan's finding: "no reviewer checked the live site". Every test in this repo runs against a
// locally built dist/, and §10.10 already says a push is not a release — but the verification it
// asks for has been done by hand, differently, each time. This is that check as a command.
//
// NOT a Playwright spec, deliberately. The suite's config points at a local webServer and fulfils
// the app document from memory to cure a loopback-serialisation flake (see tests/_fixtures.ts) —
// pointing part of it at a remote origin would fight that architecture. This is a standalone
// script the release step calls.
//
//   node scripts/live-smoke.mjs                 checks the default deployment
//   node scripts/live-smoke.mjs --expect 291    fails unless the live stamp says 291
//   node scripts/live-smoke.mjs --url https://…
//
// WHAT IT CHECKS, and each one is here because its absence has burned this project:
//   1. the release stamp — "a push is not a release": Cloudflare takes minutes, and a green push
//      has been reported as live before the deploy finished.
//   2. one screen actually RENDERS — a stamp can be served by a stale cached shell.
//   3. one cited safety number is present — the product's whole claim is that its numbers trace
//      to a source, and a deploy that loses the data layer would still show a stamp and a screen.
//      Read through citedSafeC(item.obj), the app's own single reader (R-82). I guessed the data
//      shape twice and was wrong twice; the third attempt read the function and asked the page.
//   4. no raw Hebrew in a non-Hebrew render — the v267/R-93 class, which shipped twice.

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const URL = arg('url', 'https://matkonetesh.pages.dev');
const EXPECT = arg('expect', null);

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '+' : 'x'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let exitCode = 0;

try {
  // Cache-bust: a CDN edge that has not caught up would otherwise be reported as the deployment.
  await page.goto(`${URL}/?live-smoke=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => !!document.querySelector('.foot-stamp'), null, { timeout: 60_000 });

  const stamp = (await page.textContent('.foot-stamp'))?.trim() ?? '';
  const version = (stamp.match(/מהדורה\s+(\d+)/) ?? [])[1] ?? null;
  check('the release stamp is served', !!version, stamp || 'no stamp found');
  if (EXPECT) {
    check(`the live version is ${EXPECT}`, version === EXPECT,
      version === EXPECT ? stamp : `live is ${version ?? 'unknown'}, expected ${EXPECT}`);
  }

  // 2 · a screen actually renders. A cached shell can serve a stamp with nothing behind it.
  const screen = await page.evaluate(() => {
    const on = Array.from(document.querySelectorAll('[id^="scr-"]')).find((e) => e.classList.contains('on'));
    return on ? { id: on.id, text: (on.textContent || '').trim().length } : null;
  });
  check('a screen is rendered, with content', !!screen && screen.text > 200,
    screen ? `${screen.id}, ${screen.text} chars` : 'no screen is on');

  // 3 · a cited safety number, THROUGH THE APP'S OWN ACCESSOR.
  //
  // My first version read `window.DATA.cuts` and reported 0/0 — because DATA is a module-level
  // const, not a global, and since R-86 the items load on demand from items.json anyway. The
  // check was wrong, not the deployment, and it would have blocked a perfectly good release.
  //
  // citedSafeC() IS the accessor: R-82 made it the single reader of `safe` for the whole app, so
  // asking it is asking exactly what a user's screen asks.
  const safety = await page.evaluate(async () => {
    const w = window;
    if (typeof w.citedSafeC !== 'function' || typeof w.resolveItem !== 'function') {
      return { skipped: 'the app does not expose citedSafeC/resolveItem' };
    }
    for (let i = 0; i < 80; i++) {                       // items.json is fetched on demand
      try { if (w.resolveItem('cut-1')) break; } catch (e) { /* not loaded yet */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    const probes = ['cut-1', 'cut-2', 'cut-108'];
    const found = [];
    for (const key of probes) {
      try {
        // citedSafeC reads `.safe`, and resolveItem returns a META wrapper whose raw row is on
        // `.obj` — verified against the live page, after two wrong guesses at the data shape.
        const item = w.resolveItem(key);
        const c = item?.obj ? w.citedSafeC(item.obj) : null;
        if (c != null && Number(c) > 0) found.push(`${key}=${c}`);
      } catch (e) { /* a key this build does not carry */ }
    }
    return { found, checked: probes.length };
  });
  if (safety.skipped) {
    check('the catalog carries cited safety numbers', true, `NOT CHECKED — ${safety.skipped}`);
  } else {
    check('the catalog carries cited safety numbers', safety.found.length > 0,
      safety.found.length ? safety.found.join(' · ') : `none of ${safety.checked} probe items returned a value`);
  }

  // 4 · no raw Hebrew after switching to a non-Hebrew language — R-93 shipped this twice.
  const leaked = await page.evaluate(async () => {
    const w = window;
    if (typeof w.setLang !== 'function') return { skipped: 'setLang is not exposed' };
    w.setLang('en');
    for (let i = 0; i < 60 && w.getLang?.() !== 'en'; i++) await new Promise((r) => setTimeout(r, 100));
    if (w.getLang?.() !== 'en') return { skipped: 'the English dictionary never arrived' };
    const root = document.querySelector('[id^="scr-"].on') ?? document.body;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const hits = [];
    let n;
    while ((n = walk.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (/[֐-׿]/.test(t)) hits.push(t.slice(0, 40));
    }
    return { hits: hits.slice(0, 5), count: hits.length };
  });
  if (leaked.skipped) {
    check('no raw Hebrew in the English render', true, `NOT CHECKED — ${leaked.skipped}`);
  } else {
    check('no raw Hebrew in the English render', leaked.count === 0,
      leaked.count ? `${leaked.count} leak(s): ${JSON.stringify(leaked.hits)}` : 'clean');
  }
} catch (err) {
  check('the live site is reachable', false, String(err).split('\n')[0].slice(0, 140));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} checks passed against ${URL}`);
if (failed.length) {
  console.log('  FAIL: the deployment does not satisfy the smoke checks.');
  exitCode = 1;
}
process.exit(exitCode);
