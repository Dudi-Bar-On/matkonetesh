import { test, expect, seedApp } from './_fixtures';

const mkClaims = (page, pairs: [string, any][]) =>
  page.evaluate(p => new Map(p as any), pairs);   // built page-side; the Map crosses no boundary

test.describe('R-62 Task 2 · the token decision table', () => {
  test('D1 · a MIXED category yields NO number, even at confidence 0.99', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['63°C', { text:'63°C', kind:'internal_safe_temp', value:63, unit:'C',
        subject:{ item:null, category:'בקר', form:'unknown' }, confidence:0.99 }]]);
      return w.vcGuardSpoken('הטמפרטורה הבטוחה לבקר היא 63°C.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('63');           // בקר = 63 שלם / 71 טחון → catUniformSafe null
    expect(said).toContain('[…]');
  });

  test('D2 · an item NOT in the catalog yields NO number', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([['70°C', { text:'70°C', kind:'internal_safe_temp', value:70, unit:'C',
        subject:{ item:'תנין', category:null, form:'whole' }, confidence:0.99 }]]);
      return w.vcGuardSpoken('טמפ׳ בטוחה לתנין: 70°C.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).not.toContain('70');
    expect(said).toContain('[…]');
  });

  test('D3 · the smoking answer — chamber + duration spoken, internal checked against the table', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const said = await page.evaluate(() => {
      const w = window as any;
      const claims = new Map([
        ['110°C',  { text:'110°C',  kind:'chamber_temp',      value:110, unit:'C', subject:{item:null,category:null,form:'unknown'}, confidence:0.96 }],
        ['6 שעות', { text:'6 שעות', kind:'duration',          value:6,   unit:'h', subject:{item:null,category:null,form:'unknown'}, confidence:0.97 }],
        ['71°C',   { text:'71°C',   kind:'internal_safe_temp',value:71,  unit:'C', subject:{item:null,category:'עוף',form:'whole'},  confidence:0.95 }],
      ]);
      return w.vcGuardSpoken('עשן ב-110°C במשך 6 שעות עד 71°C פנימי.', {t1:null,t2:null,cat:null}, 'he', claims);
    });
    expect(said).toContain('110°C');            // released — the failure R-62 exists to fix
    expect(said).toContain('6 שעות');
    expect(said).not.toContain('71°C');         // עוף is uniformly 74 → 71 does not match → redacted
  });

  test('D4 · other / missing kind / low confidence are all redacted', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const outs = await page.evaluate(() => {
      const w = window as any;
      const g = (c: any) => w.vcGuardSpoken('החזק ב-110°C.', {t1:null,t2:null,cat:null}, 'he', c);
      const base = { text:'110°C', value:110, unit:'C', subject:{item:null,category:null,form:'unknown'} };
      return [
        g(new Map([['110°C', Object.assign({}, base, { kind:'other',        confidence:0.99 })]])),
        g(new Map([['110°C', Object.assign({}, base, { kind:undefined,      confidence:0.99 })]])),
        g(new Map([['110°C', Object.assign({}, base, { kind:'chamber_temp', confidence:0.70 })]])),
      ];
    });
    outs.forEach(o => { expect(o).toContain('[…]'); expect(o).not.toContain('110'); });
  });

  test('D5 · a claim whose text is not a tokenizer token affects nothing', async ({ page }) => {
    await seedApp(page, { 'mk-uilevel-asked': 'true' });
    const [withGhost, withNone] = await page.evaluate(() => {
      const w = window as any;
      const q = 'החזק ב-110°C.';
      const ghost = new Map([['110 degrees', { text:'110 degrees', kind:'chamber_temp', value:110, unit:'C',
        subject:{item:null,category:null,form:'unknown'}, confidence:0.99 }]]);
      return [w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', ghost),
              w.vcGuardSpoken(q, {t1:null,t2:null,cat:null}, 'he', null)];
    });
    expect(withGhost).toBe(withNone);           // identical — the ghost claim is inert
  });
});
