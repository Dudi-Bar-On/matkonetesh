import { test, expect, seedApp } from './_fixtures';

// E3 probe nudge — proactive one-time "register your probe" advisory (owner Decision 5, 2026-07-26; a
// follow-on to E3 Task 3 / Amendment O-7, commit 378cfde). PURE ADVISORY — must never block viewing,
// adding, or cooking anything; it only ever gates whether a dismissible banner renders.
//
// AMENDMENT O-7a (owner ruling 2026-07-26, superseding O-7's device-integral branch — spec's AMENDMENT
// O-7a block) — probe satisfaction is now STANDALONE-ONLY. This also fixes the E3 review's "over-widening"
// finding: the OLD kit-wide device-integral scan let an owned device from an UNRELATED category (e.g. an
// oven) suppress the nudge for a completely unrelated stage's probe gap (e.g. a smoker's). O-7a removes
// the device-integral branch entirely, so that bug class is now structurally impossible — see test 5b
// (inverted) and the new multi-category regression test 5c below.
//
// REUSED MACHINERY (never reinvented — see tests/e3-probe.spec.ts for the underlying satisfaction logic):
//   - eqmProbeSatisfiedBy(dev,list) / eqmProbeAvailable(row)  (equipment.js, standalone-only under O-7a)
//   - eqmValidity(meta) / eqmValidityWithKit(meta,kitOverride) (app.js, E3 Task 3+4 — the injectable-kit
//     what-if is reused here, unmodified, to answer "would a hypothetical probe alone unlock this item").
//   - openEquipment() → #eqAddNew → [data-eqpick="probe"]      (the REAL Equipment Manager add flow).
//
// FIXTURES:
//   SMOKER_NO_PROBE — byte-identical to tests/e3-probe.spec.ts's own fixture: a smoker with plenty of temp
//     headroom (spec-4's cited smt=90 <= its maxC 150) but no hasProbe and no standalone probe. Real data's
//     spec-4 (בייקון חזיר / Pork Bacon) carries exactly ONE cited method ('smoke' — deriveRequires yields
//     ONE row), and that row fails ONLY on probe (e3-probe.spec.ts test (a): partial=['smoker'], not
//     missing) — so under this kit spec-4 is eqmValidity level 'uncookable' today, and eqmValidityWithKit
//     with a hypothetical probe added flips it to 'ok'. The cleanest real item for isolating "a probe alone
//     would unlock this" (trigger condition 3) from "uncookable for some other reason" (never counted).
//   SMOKER_INTEGRAL_PROBE — the SAME smoker with a legacy/stray `cap.hasProbe:true` (pre-O-7a data, or the
//     removed EQUIP_CATS prop's old shape) — under O-7a this is now a POSITIVE trigger fixture: it still
//     has NO real (standalone) probe capability, so the nudge must still SHOW (test 5b, inverted).
//   SMOKER_AND_OVEN_STALE_FLAGS — multi-category regression fixture (test 5c): a smoker AND an oven, BOTH
//     carrying stale `cap.hasProbe:true`, no standalone anywhere — proves the nudge shows regardless of how
//     many device categories or stray integral flags are present (the over-widening finding, above).

const boot = async (page: any, kit: any[] | null) => {
  const kv: Record<string, string> = { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he') };
  if (kit) { kv['mk-equipment'] = JSON.stringify(kit); kv['mk-equip-set'] = 'true'; }
  await seedApp(page, kv);
  // only pre-existing (E3 Task 3/4) globals — deliberately NOT the new nudge functions, so a missing
  // feature fails inside the test body (the RIGHT reason), never inside this shared boot helper.
  await page.waitForFunction(`typeof EQM==='object' && typeof eqmProbeAvailable==='function' && typeof eqmValidityWithKit==='function'`);
};

const SMOKER_NO_PROBE = [{ id: 'd1', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150 } }];
const SMOKER_INTEGRAL_PROBE = [{ id: 'd2', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון-פרו', cap: { racks: 4, areaCm2: 6000, maxC: 150, hasProbe: true } }];
// O-7a multi-category regression (test 5c) — a smoker AND an oven, BOTH carrying a stale/legacy
// cap.hasProbe:true, no standalone probe anywhere. Under the OLD (pre-O-7a) kit-wide device-integral scan
// this would have wrongly suppressed the nudge (E3 review's over-widening finding); under O-7a neither
// device's flag counts at all, so the nudge must still show.
const SMOKER_AND_OVEN_STALE_FLAGS = [
  { id: 'd3', cat: 'smoker', type: 'ארון / קבינט', name: 'ארון', cap: { racks: 4, areaCm2: 6000, maxC: 150, hasProbe: true } },
  { id: 'd4', cat: 'oven', type: 'ביתי', name: 'תנור', cap: { areaCm2: 4400, maxC: 275, hasProbe: true } },
];

const goCatalog = async (page: any) => {
  await page.click('button[data-cnav="catalog"]');
  await page.waitForFunction(`document.getElementById('scr-catalog').classList.contains('on')`);
};

test.describe('E3 probe nudge — trigger + render (real UI)', () => {
  test('1. shows — configured kit, no probe, a probe-only-blocked item present → Hebrew banner at the catalog view', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge .probe-nudge', { timeout: 8000 });
    const titleTxt = await page.locator('#cProbeNudge .pn-t').innerText();
    expect(titleTxt).toBe('יש לך מדחום פנימי?');
    await page.screenshot({ path: 'mockups/e3-probe-nudge-shown.png' });
  });

  test('1b. sourced from the i18n dictionary, not a hardcoded literal — a live language switch re-renders it in English', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge .probe-nudge', { timeout: 8000 });
    const heTxt = await page.locator('#cProbeNudge .pn-t').innerText();
    expect(heTxt).toBe(await page.evaluate(`L('יש לך מדחום פנימי?','Have a probe thermometer?')`));
    await page.evaluate(`setLang('en')`);
    await page.click('button[data-cnav="catalog"]');   // real click — re-runs catView(), which re-syncs the banner
    await page.waitForFunction(
      `(document.querySelector('#cProbeNudge .pn-t')||{}).textContent==='Have a probe thermometer?'`,
      { timeout: 8000 },
    );
  });

  test('2. register action — tapping רשום מדחום opens the real Equipment Manager probe-add flow', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge #pnGo', { timeout: 8000 });
    await page.click('#cProbeNudge #pnGo');
    await page.waitForSelector('#panel #eqCat', { timeout: 8000 });
    expect(await page.locator('#panel #eqCat').inputValue()).toBe('probe');
    expect(await page.locator('#panel #eqSave').count()).toBe(1);
  });

  test('3. after registering a probe (real Add flow), the banner is gone — trigger condition 2 goes false', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge #pnGo', { timeout: 8000 });
    await page.click('#cProbeNudge #pnGo');
    await page.waitForSelector('#panel #eqSave', { timeout: 8000 });
    await page.selectOption('#panel #eqType', 'מיידי (instant-read)');
    await page.fill('#panel #eqName', 'Test Thermapen');
    await page.click('#panel #eqSave');
    await page.waitForFunction(`equipByCat('probe').length===1`);
    await page.click('#panel .x');
    await page.waitForFunction(`!document.querySelector('#panel').classList.contains('open')`);
    // the panel's own slide-out is a CSS transition (.26s, app.css .panel{transition:transform .26s...})
    // — wait for its bounding box to actually be fully off-screen (a condition, not a timeout) so the
    // screenshot below isn't a mid-animation frame of the closing sheet. Measured empirically (RTL doc):
    // the closed rect lands past the right edge of the viewport, not the left.
    await page.waitForFunction(`document.querySelector('#panel').getBoundingClientRect().left>=window.innerWidth`);
    await goCatalog(page);
    await expect(page.locator('#cProbeNudge .probe-nudge')).toHaveCount(0);
    await page.screenshot({ path: 'mockups/e3-probe-nudge-after-register.png' });
  });

  test('4. dismiss — tapping ✕ hides it immediately AND it stays hidden after a warm reload', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge #pnX', { timeout: 8000 });
    await page.click('#cProbeNudge #pnX');
    await page.waitForFunction(`document.querySelectorAll('#cProbeNudge .probe-nudge').length===0`);
    expect(await page.evaluate(`store.get('mk-probe-nudge-dismissed')`)).toBe(true);
    await page.screenshot({ path: 'mockups/e3-probe-nudge-after-dismiss.png' });
    // warm reload — localStorage (the dismiss flag) survives; a plain page.reload, NOT seedApp (which clears it)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(`typeof EQM==='object'`);
    await goCatalog(page);
    await expect(page.locator('#cProbeNudge .probe-nudge')).toHaveCount(0);
  });

  test('5a. negative (R5) — equipment not configured → banner never appears even with a matching item', async ({ page }) => {
    await boot(page, null);
    await goCatalog(page);   // catView()→syncProbeNudge() already ran synchronously inside this real click
    await expect(page.locator('#cProbeNudge .probe-nudge')).toHaveCount(0);
  });

  test('5b. O-7a INVERTED — a kit with device-integral hasProbe (no standalone) still SHOWS the nudge — device-integral never satisfies', async ({ page }) => {
    await boot(page, SMOKER_INTEGRAL_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge .probe-nudge', { timeout: 8000 });
    await expect(page.locator('#cProbeNudge .probe-nudge')).toHaveCount(1);
  });

  test('5c. O-7a multi-category regression (subsumes the E3 review over-widening finding) — a smoker AND an oven, no standalone probe → the nudge SHOWS regardless (built-ins never count)', async ({ page }) => {
    await boot(page, SMOKER_AND_OVEN_STALE_FLAGS);
    // fixture minimality: confirm no standalone probe device is present, and both integral flags are stray data only
    expect(await page.evaluate(`equipByCat('probe').length`)).toBe(0);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge .probe-nudge', { timeout: 8000 });
    const titleTxt = await page.locator('#cProbeNudge .pn-t').innerText();
    expect(titleTxt).toBe('יש לך מדחום פנימי?');
    await page.screenshot({ path: 'mockups/e3-probe-nudge-multi-category.png' });
  });

  test('6. Hebrew check — banner renders in Hebrew with no English leak', async ({ page }) => {
    await boot(page, SMOKER_NO_PROBE);
    await goCatalog(page);
    await page.waitForSelector('#cProbeNudge .probe-nudge', { timeout: 8000 });
    const full = await page.locator('#cProbeNudge .probe-nudge').innerText();
    expect(full).not.toMatch(/[A-Za-z]{3,}/);
    expect(full).toContain('יש לך מדחום פנימי?');
    expect(full).toContain('רשום מדחום');
    await page.screenshot({ path: 'mockups/e3-probe-nudge-hebrew.png' });
  });
});
