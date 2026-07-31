import { test, expect, seedApp } from './_fixtures';

// P0-app item 4 (spec §4.1) — ULTIMATE E7/E8.
//   Defect 1 (access): gemSpeak gated on a PERSONAL key, and vcSpeak mirrored that gate, so a
//     managed-only user never even attempted Gemini TTS — they got the weaker system voice.
//   Defect 2 (billing): gemSpeak never passed opts.key, so gemFetch's own routing (mode = opts.key ?
//     'byok' : gemMode()) sent the call through the managed Worker whenever a central config existed —
//     even for a user whose personal key was the only reason the gate let them through.
// The fix makes TTS follow the exact chain every other AI call uses: managed -> BYOK -> off.
// Voice Wave 0 Task 6 (R-32): the browser-voice fallback is DELETED — window.sysSpeak no longer
// exists, so the old stub that counted __sys calls is gone. The "no AI configured" case is now a
// silent no-op (R-35: no keyless user exists; see tests/voice-wave0.spec.ts's R-35 defensive test).
const bootTTS = async (page: any, kv: Record<string, string>) => {
  await seedApp(page, { 'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'), ...kv });
  await page.waitForFunction(`typeof vcSpeak==='function' && typeof gemSpeak==='function'`);
  // capture the transport decision without a network call or an AudioContext
  await page.evaluate(`window.__tts=[];
    window.gemFetch=async(model,body,opts)=>{ window.__tts.push({model, key:!!(opts&&opts.key)}); throw new Error('stop-here'); };`);
};

test('E7: a MANAGED-only user (no personal key) actually attempts Gemini TTS', async ({ page }) => {
  await bootTTS(page, { 'mk-central-url': JSON.stringify('https://w.example'), 'mk-central-code': JSON.stringify('abc123') });
  expect(await page.evaluate(`gemKey()`)).toBeFalsy();       // fixture sanity: genuinely no personal key
  expect(await page.evaluate(`aiAvail()`)).toBe(true);        // but AI IS available, via managed
  await page.evaluate(`vcSpeak('שלום','he')`);
  await page.waitForFunction(`window.__tts.length>0`);
  expect(await page.evaluate(`window.__tts.length`)).toBe(1);
  expect(await page.evaluate(`window.__tts[0].model`)).toBe('tts');
});

test('R-35 defensive: with no AI configured (a state no real user is in), vcSpeak is a silent no-op — zero network, zero speech, no crash', async ({ page }) => {
  await bootTTS(page, {});
  expect(await page.evaluate(`aiAvail()`)).toBe(false);
  await page.evaluate(`vcSpeak('שלום','he')`);
  expect(await page.evaluate(`window.__tts.length`)).toBe(0);   // no cloud call
  // no waitForFunction on speech — there is nothing to wait for; absence of a crash IS the assertion
});

test('E7 regression — a BYOK user with no central config keeps the existing BYOK path', async ({ page }) => {
  await bootTTS(page, { 'mk-gemkey': JSON.stringify('personal-key-1234567890') });
  await page.evaluate(`vcSpeak('שלום','he')`);
  await page.waitForFunction(`window.__tts.length>0`);
  expect(await page.evaluate(`window.__tts.length`)).toBe(1);
});
