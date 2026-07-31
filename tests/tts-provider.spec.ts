import { test, expect, seedApp } from './_fixtures';

// R-45 · two-provider TTS layer. Design: docs/superpowers/specs/2026-08-01-tts-provider-layer-design.md
const MANAGED = { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') };
const BYOK = { 'mk-gemkey': JSON.stringify('personal-key-1234567890') };

test('R-45 §4.2: the routing table is data, and resolution filters it by availability', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const managed = await page.evaluate(`({
    table: JSON.parse(JSON.stringify(TTS_ROUTE)),
    answer: ttsProviderFor('answer'),
    step:   ttsProviderFor('step'),
    alert:  ttsProviderFor('alert'),
    unknown: ttsProviderFor('a-use-case-nobody-added-a-row-for'),
    missing: ttsProviderFor(undefined),
    avail: ttsCloudAvail()
  })`);
  // the table itself matches the design's §4.2 rows exactly
  expect(managed.table).toEqual({ answer: 'gemini', step: 'gemini', alert: 'cloud' });
  expect(managed.avail).toBe(true);
  expect(managed.answer).toBe('gemini');
  expect(managed.step).toBe('gemini');
  expect(managed.alert).toBe('cloud');
  // an unlisted use case falls to the PRIMARY, never to silence
  expect(managed.unknown).toBe('gemini');
  expect(managed.missing).toBe('gemini');
});

test('R-45 §2/DoD-4: a BYOK user has no secondary — every use case resolves to Gemini', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...BYOK });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  const r = await page.evaluate(`({ avail: ttsCloudAvail(), alert: ttsProviderFor('alert'), answer: ttsProviderFor('answer') })`);
  expect(r.avail).toBe(false);                 // no legitimate way to authenticate — design §2
  expect(r.alert).toBe('gemini');              // the cloud row degrades, it does not go silent
  expect(r.answer).toBe('gemini');
});

test('R-45: the session latch takes the secondary out of routing without an error', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof ttsProviderFor==='function'`);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('cloud');
  await page.evaluate(`ttsCloudOff = true`);
  expect(await page.evaluate(`ttsCloudAvail()`)).toBe(false);
  expect(await page.evaluate(`ttsProviderFor('alert')`)).toBe('gemini');
});

test('R-45: the voice mapping produces a real Chirp3-HD name for each supported app language', async ({ page }) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...MANAGED });
  await page.waitForFunction(`typeof cloudVoiceFor==='function'`);
  const r = await page.evaluate(`({
    he: cloudVoiceFor('he'), en: cloudVoiceFor('en'), ru: cloudVoiceFor('ru'), junk: cloudVoiceFor('zz')
  })`);
  expect(r.he).toEqual({ languageCode: 'he-IL', voice: 'he-IL-Chirp3-HD-Kore' });
  expect(r.en.languageCode).toBe('en-US');
  expect(r.en.voice).toContain('Chirp3-HD');
  expect(r.ru.languageCode).toBe('ru-RU');
  expect(r.junk.languageCode).toBe('he-IL');   // unknown language falls to the app's own default
});
