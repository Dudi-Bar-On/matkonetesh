// tests/backup-syncable.spec.ts — N-1: a backup may NEVER carry managed-AI credentials.
// N-4: the SYNCABLE allowlist manifest is the single source of truth for what exportData() ships.
// Contract: tests/TEST-AUTHORING-CONTRACT.md — test/expect/seedApp from ./_fixtures only, `page` is
// the shared warm page, condition waits only.
import { test, expect, seedApp } from './_fixtures';

async function exportViaUi(page: import('./_fixtures').Page) {
  await page.evaluate(() => (window as unknown as { openBackup: () => void }).openBackup());   // panel opener (app.js:8475); the click below is the real user action
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#bkExp').click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('backup contains user data but no mk-central-* / mk-gemkey (N-1 red-green)', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',   // suppress the first-run experience-level dialog, which shares #panel with openBackup() and would otherwise overwrite it mid-click
    'mk-central-url': JSON.stringify('https://worker.example'),
    'mk-central-code': JSON.stringify('fake-test-code'),
    'mk-gemkey': JSON.stringify('fake-test-key'),
    'mk-fav': JSON.stringify(['x']),
    'mk-menuqty-abc': JSON.stringify(2),          // mk- prefix allowlist coverage
    'note:cut-brisket': JSON.stringify('שומן כלפי מעלה'),   // non-mk namespace coverage (Task 8 audit finding)
  });
  const payload = await exportViaUi(page);
  expect(payload.app).toBe('matkonet');
  expect(payload.data['mk-fav']).toBeTruthy();                    // user data survives
  expect(payload.data['mk-menuqty-abc']).toBeTruthy();            // mk- prefix allowlist works
  expect(payload.data['note:cut-brisket']).toBeTruthy();          // non-mk prefix allowlist works
  expect(payload.data['mk-central-url']).toBeUndefined();         // the live N-1 leak
  expect(payload.data['mk-central-code']).toBeUndefined();
  expect(payload.data['mk-gemkey']).toBeUndefined();
  expect(JSON.stringify(payload)).not.toContain('fake-test');     // belt-and-braces: no credential VALUE anywhere
});

// Task 9 (Dec-D6) — import is the OTHER half of the same allowlist: exportData filters what leaves,
// importData must filter what lands, using the SAME syncableKey() — a second, divergent import-side
// list would reopen exactly the hole N-1 closed on the export side, just from a crafted/tampered file
// instead of a live leak.
test('import filters non-SYNCABLE keys — a crafted backup cannot implant credentials (Dec-D6)', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true' });   // suppress onboarding dialog (shares #panel with openBackup)
  await page.evaluate(() => (window as unknown as { openBackup: () => void }).openBackup());
  const crafted = {
    app: 'matkonet', ver: 1, exported: new Date().toISOString(),
    data: {
      'mk-fav': JSON.stringify(['x']),
      'mk-central-code': JSON.stringify('implanted-fake-code'),   // fake literal — never a real credential
      'evil-key': 'evil',
    },
  };
  await page.locator('#bkImp').setInputFiles({
    name: 'crafted.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(crafted)),
  });
  await expect(page.locator('.toast, [class*="toast"]').first()).toBeVisible();
  const state = await page.evaluate(() => ({
    fav: localStorage.getItem('mk-fav'),
    central: localStorage.getItem('mk-central-code'),
    evil: localStorage.getItem('evil-key'),
  }));
  expect(state.fav).toBeTruthy();       // allowed data landed
  expect(state.central).toBeNull();     // credential implant blocked
  expect(state.evil).toBeNull();        // arbitrary key blocked
});

test('full export→wipe→import round-trip restores user data (Dec-D6)', async ({ page }) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',
    'mk-fav': JSON.stringify(['brisket']),
    'mk-menuqty-abc': JSON.stringify(3),
  });
  const payload = await exportViaUi(page);
  expect(payload.ver).toBe(2);   // Dec-D6: the payload now carries an explicit version
  await seedApp(page, { 'mk-uilevel-asked': 'true' });   // wipe local state, keep onboarding suppressed
  await page.evaluate(() => (window as unknown as { openBackup: () => void }).openBackup());
  await page.locator('#bkImp').setInputFiles({
    name: 'roundtrip.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect(page.locator('.toast, [class*="toast"]').first()).toBeVisible();
  const fav = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-fav') || 'null'));
  expect(fav).toEqual(['brisket']);
  const qty = await page.evaluate(() => JSON.parse(localStorage.getItem('mk-menuqty-abc') || 'null'));
  expect(qty).toBe(3);
});

// Controller-anchored addition (Task 9 brief, mandatory) — Task 8's key-space sweep found wipeAllData
// hand-maintains its OWN namespace list (mk-/note:/rating:/shop:/done:), which had already drifted from
// SYNCABLE by six namespaces (xshop:/shopmiss:/wpck:/method:/seas:/burgers:) discovered in that same
// sweep. A user asking to "erase everything" silently kept those six categories of their own data. This
// seeds one key per SYNCABLE namespace (plus the vestigial done: prefix, kept as defensive cleanup) and
// proves the fixed wipe — now deriving its non-mk namespace list from SYNCABLE instead of a second,
// hand-typed copy — leaves nothing behind.
test('full reset ("wipe all data") clears every SYNCABLE namespace, not only mk-/note:/rating:/shop: (Dec-D6)', async ({ page }) => {
  const seedKeys = {
    'mk-uilevel-asked': 'true',
    'mk-fav': JSON.stringify(['x']),        // mk- exact (SYNCABLE.exact)
    'mk-menuqty-abc': JSON.stringify(2),    // mk- prefix (SYNCABLE.prefixes)
    'note:cut-brisket': 'x',                // non-mk prefix — already covered before this fix
    'rating:brisket': '5',
    'shop:abc': '1',
    'xshop:abc': '1',                       // Task 8 audit finding — NOT wiped before this fix
    'shopmiss:abc': '1',                    // Task 8 audit finding — NOT wiped before this fix
    'wpck:abc': '1',                        // Task 8 audit finding — NOT wiped before this fix
    'method:abc': '1',                      // Task 8 audit finding — NOT wiped before this fix
    'seas:abc': '1',                        // Task 8 audit finding — NOT wiped before this fix
    'burgers:abc': '1',                     // Task 8 audit finding — NOT wiped before this fix
    'done:abc': '1',                        // vestigial, kept as defensive cleanup (not in SYNCABLE)
  };
  await seedApp(page, seedKeys);
  await page.evaluate(() => (window as unknown as { openBackup: () => void }).openBackup());
  const wipeBtn = page.locator('#bkWipe');
  await wipeBtn.click();   // 1st click arms the danger button
  await expect(wipeBtn).toContainText('לחץ שוב לאישור');
  await wipeBtn.click();   // 2nd click confirms and executes the wipe
  await expect(page.locator('.toast, [class*="toast"]').first()).toBeVisible();
  const survivors = await page.evaluate(
    (keys) => keys.filter((k) => localStorage.getItem(k) !== null),
    Object.keys(seedKeys).filter((k) => k !== 'mk-uilevel-asked'),
  );
  expect(survivors).toEqual([]);
});
