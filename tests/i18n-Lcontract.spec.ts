// Task 1 (v268 localization plan) — L(he,en,ctx?) contract + __i18nTrace hook.
// Spec: docs/superpowers/specs/2026-07-26-full-localization-design-v2.md §3.1.
// This is an ADDITIVE extension of the existing 2-arg L(he,en) — he/en behaviour must be byte-identical.
import { test, expect, seedApp } from './_fixtures';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const boot = async (page: any) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('en') });
  await page.waitForFunction(`typeof L==='function' && typeof getLang==='function' && typeof setLang==='function' && typeof I18N_DICTS==='object'`);
};

test('L(he,en) en-mode returns the inline en arg unchanged (zero-regression, no ctx)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`L('שלום','Hello')`)).toBe('Hello');
});

test('L(he,en,ctx) keys the compound dict entry he+␟+ctx in a non-he/en language', async ({ page }) => {
  await boot(page);
  // seed a bare key AND a ctx-compound key with DIFFERENT values, to prove ctx picks the compound one
  await page.evaluate(`
    I18N_DICTS.fr = I18N_DICTS.fr || {};
    I18N_DICTS.fr['שלום'] = 'Bonjour-bare';
    I18N_DICTS.fr['שלום\u241Fgreet'] = 'Bonjour-greet';
  `);
  await page.evaluate(`setLang('fr')`);
  expect(await page.evaluate(`L('שלום','Hello')`)).toBe('Bonjour-bare');          // no ctx → bare key
  expect(await page.evaluate(`L('שלום','Hello','greet')`)).toBe('Bonjour-greet'); // ctx → compound key, NOT the bare one
});

test('L(he,en,ctx) with a dict-miss on the compound key falls back to en, not the bare-key value', async ({ page }) => {
  await boot(page);
  await page.evaluate(`
    I18N_DICTS.fr = I18N_DICTS.fr || {};
    I18N_DICTS.fr['שלום'] = 'Bonjour-bare';   // bare key IS present — must NOT be used when ctx is given
  `);
  await page.evaluate(`setLang('fr')`);
  expect(await page.evaluate(`L('שלום','Hello','some-other-ctx')`)).toBe('Hello');
});

test('L he-mode returns the he arg verbatim, with or without ctx (byte-identical to today)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`L('שלום','Hello')`)).toBe('שלום');
  expect(await page.evaluate(`L('שלום','Hello','greet')`)).toBe('שלום');
});

test('__i18nTrace: a real fr dict-miss (non-en English-fallback branch) pushes exactly one record', async ({ page }) => {
  await boot(page);
  await page.evaluate(`setLang('fr'); window.__i18nTrace = [];`);
  const result = await page.evaluate(`L('__no_such_key_xyz','FallbackEN')`);
  expect(result).toBe('FallbackEN');
  const trace = await page.evaluate(`window.__i18nTrace`);
  expect(trace.length).toBe(1);
  expect(trace[0].key).toBe('__no_such_key_xyz');
  expect(trace[0].en).toBe('FallbackEN');
  expect(trace[0].lang).toBe('fr');
});

test('__i18nTrace: en-mode ALSO pushes a diagnostic lang:"en" record carrying a hit flag', async ({ page }) => {
  await boot(page);
  await page.evaluate(`I18N_DICTS.en = I18N_DICTS.en || {}; I18N_DICTS.en['__en_hit_key'] = 'EN-DICT-VAL';`);
  await page.evaluate(`setLang('en'); window.__i18nTrace = [];`);
  await page.evaluate(`L('__en_hit_key','InlineEN')`);     // key present in en dict → hit:true
  await page.evaluate(`L('__en_miss_key','InlineEN2')`);   // key absent from en dict → hit:false
  const trace = await page.evaluate(`window.__i18nTrace`);
  // Assert THIS test's two records, not the total trace length: under full-suite parallel load the shared
  // in-memory server slows the page's async render, which can push an unrelated app L() record between the
  // reset and this read. The contract under test is "en-mode L pushes a record with the right hit flag for
  // a given key" — filter to our keys so concurrent app activity can't make it flaky.
  const mine = trace.filter((r: any) => r.key === '__en_hit_key' || r.key === '__en_miss_key');
  expect(mine.length).toBe(2);
  expect(mine.find((r: any) => r.key === '__en_hit_key')).toMatchObject({ key: '__en_hit_key', en: 'InlineEN', lang: 'en', hit: true });
  expect(mine.find((r: any) => r.key === '__en_miss_key')).toMatchObject({ key: '__en_miss_key', en: 'InlineEN2', lang: 'en', hit: false });
});

// DoD line 9 / plan Step 5 — he-byte-identical guard: a sample of 20 REAL existing L('he','en') call
// sites from app.js, rendered in he-mode, must equal the bare `he` arg unchanged — proving the additive
// ctx parameter did not alter existing 2-arg call behaviour anywhere in the real codebase, not just for
// a hand-picked test string.
test('he-byte-identical: 20 real existing L(he,en) call sites render unchanged in he-mode', async ({ page }) => {
  const src = readFileSync(resolve(process.cwd(), 'app.js'), 'utf8');
  const re = /L\('([^'\\]*)','([^'\\]*)'\)/g;
  const sites: { he: string; en: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && sites.length < 20) {
    sites.push({ he: m[1], en: m[2] });
  }
  expect(sites.length).toBe(20); // fixture-minimality negative case: fail loudly if app.js stops having ≥20 such sites

  await boot(page);
  await page.evaluate(`setLang('he')`);
  const results: string[] = await page.evaluate(
    (list) => list.map((s: { he: string; en: string }) => (window as any).L(s.he, s.en)),
    sites
  );
  results.forEach((r, i) => expect(r).toBe(sites[i].he));
});

// Task 5 (v268 localization plan) — homograph disambiguation (spec §6). The 36 real homographs
// resolved in app.js all added a 3rd `ctx` arg to their non-primary sense's call site(s). This is
// the ctx-site parallel of the test above: L's he-mode contract ("return he unchanged, ctx or not",
// §3.1) must hold for the REAL 3-arg L(he,en,ctx) call sites app.js now has, not just the hand-picked
// fixture in the earlier __i18nTrace tests — proving the ctx argument never leaks into he-mode output
// anywhere in the real corpus.
test('he-byte-identical: real ctx\'d L(he,en,ctx) call sites (Task 5 homograph disambiguation) render unchanged in he-mode', async ({ page }) => {
  const src = readFileSync(resolve(process.cwd(), 'app.js'), 'utf8');
  // 3-arg L(strLit,strLit,strLit) — deliberately excludes the 4-arg primary-marker shape (none exist
  // in the real corpus yet; the marker mechanism is exercised by the extractor's own unit tests).
  const re = /L\('([^'\\]*)','([^'\\]*)','([^'\\]*)'\)/g;
  const sites: { he: string; en: string; ctx: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) sites.push({ he: m[1], en: m[2], ctx: m[3] });
  expect(sites.length).toBeGreaterThanOrEqual(20); // fixture-minimality negative case — Task 5 added ~50+ real ctx'd sites

  await boot(page);
  await page.evaluate(`setLang('he')`);
  const results: string[] = await page.evaluate(
    (list) => list.map((s: { he: string; en: string; ctx: string }) => (window as any).L(s.he, s.en, s.ctx)),
    sites
  );
  results.forEach((r, i) => expect(r).toBe(sites[i].he));
});
