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
