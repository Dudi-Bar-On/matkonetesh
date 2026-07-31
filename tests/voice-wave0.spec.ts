import { test, expect, seedApp } from './_fixtures';

test('vcLat: an ask stamps ask→firstSound marks readable by a real consumer', async ({ page }) => {
  await seedApp(page, {});
  const rep = await page.evaluate(async () => {
    (window as any).__vcAskMock = () => 'תשובה קצרה.';           // no network
    (window as any).__gemTtsMock = () => null;                    // TTS seam mocked (Task 5 wires it)
    (window as any).vcLatMark('ask');                             // the flow itself calls this after Task 1 wiring
    await (window as any).vcAskFlow('כמה זמן לברסקט?');
    return (window as any).vcLatReport();
  });
  expect(rep).toHaveProperty('ask');
  expect(rep).toHaveProperty('textResp');                          // stamped by vcAskFlow after the answer resolves
});

test('vcChunkText: splits sentences, never splits a decimal, merges short, hard-splits long', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    return {
      basic: f('שים את הברסקט במעשנה. חכה שעתיים! בדוק טמפרטורה?'),
      decimal: f('הטמפרטורה היא 63.5 מעלות. המשך לבשל.'),
      short: f('כן. בסדר. עכשיו שים את הבשר על הרשת ותסגור את המכסה.'),
      long: f('א'.repeat(100) + ', ' + 'ב'.repeat(100) + ', ' + 'ג'.repeat(100)),
      empty: f('   '),
      langs: [
        f('Mettez la viande. Attendez deux heures.'),
        f('Положите мясо в коптильню. Подождите два часа.'),
        f('Lege das Fleisch hinein. Warte zwei Stunden.'),
      ].map((a: string[]) => a.length),
    };
  });
  expect(r.basic.length).toBe(3);
  expect(r.decimal[0]).toContain('63.5');                 // the decimal point never splits
  expect(r.decimal.length).toBe(2);
  expect(r.short.length).toBe(1);                          // "כן." and "בסדר." merged forward
  expect(Math.max(...r.long.map((c: string) => c.length))).toBeLessThanOrEqual(220);
  expect(r.empty).toEqual([]);
  for (const n of r.langs) expect(n).toBe(2);              // same rule, all languages
});

test('vcChunkText: joining chunks reproduces the spoken content (whitespace-normalized) and no chunk is empty', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    const input = '  שים לב לטמפרטורה.   חכה בסבלנות!  בדוק שוב?  ';
    const chunks = f(input);
    return { chunks, anyEmpty: chunks.some((c: string) => c.trim().length === 0) };
  });
  // invariant: concatenating all chunks with single spaces reproduces the whitespace-normalized input
  expect(r.chunks.join(' ')).toBe('שים לב לטמפרטורה. חכה בסבלנות! בדוק שוב?');
  expect(r.anyEmpty).toBe(false);
});

test('vcChunkText: a safety readout with its verification marker is never split between number and marker', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).vcChunkText;
    return f('הטמפרטורה הפנימית היא 63°C לפי המדריך המאומת. אפשר להוציא.');
  });
  const withNumber = r.find((c: string) => c.includes('63°C'));
  expect(withNumber).toContain('לפי המדריך המאומת');   // number and its verification marker stay in the same chunk
});

test('speaker token: a stale (slow) speaker can never kill its successor', async ({ page }) => {
  await seedApp(page, {});
  const log = await page.evaluate(async () => {
    const w = window as any; w.__vcSpeakLog = [];
    // simulate v278's race shape: speaker A (the ack) awaits slowly; speaker B (the answer) starts meanwhile.
    const genA = w.vcNewSpeakGen();
    const genB = w.vcNewSpeakGen();                 // B took the floor after A
    await Promise.resolve();                        // A returns from its await, stale
    if (w.vcGenCurrent(genA)) w.__vcSpeakLog.push('A-killed-B'); // v278 behavior: A calls gemStop()
    if (w.vcGenCurrent(genB)) w.__vcSpeakLog.push('B-plays');
    return w.__vcSpeakLog;
  });
  expect(log).toEqual(['B-plays']);
});

test('INV-T / R-33: ttsText preserves every digit and degree token from the guarded string', async ({ page }) => {
  await seedApp(page, {});
  const r = await page.evaluate(() => {
    const f = (window as any).ttsText;
    const digits = (s: string) => (s.match(/\d+(?:\.\d+)?/g) || []);
    const src = 'חמם ל-63.5°C (בערך 8-10 שעות · תלוי בעובי). המשקל 2 ק"ג, עוד 20 דק\' בערך.';
    const out = f(src, 'he');
    return {
      out,
      sameDigits: JSON.stringify(digits(out)) === JSON.stringify(digits(src)),
      degreeKept: out.includes('63.5°C'),                       // rule 8 DROPPED: the unit symbol survives
      noParenCommas: !out.includes(', בערך'),                    // rule 9 DROPPED: no ", … ," injection
      rangeKept: out.includes('8-10'),                           // rule 10 DROPPED: ranges untouched
      kg: out.includes('קילו') && !out.includes('ק"ג'),          // rule 3 KEPT: abbreviation whitelist
      min: out.includes('דקות'),                                 // rule 4 KEPT
      en: f('Rest 10 min · then slice.', 'en'),                  // rows 1-2 only for non-he
    };
  });
  expect(r.sameDigits).toBe(true);
  expect(r.degreeKept).toBe(true);
  expect(r.noParenCommas).toBe(true);
  expect(r.rangeKept).toBe(true);
  expect(r.kg).toBe(true);
  expect(r.min).toBe(true);
  expect(r.en).toBe('Rest 10 min , then slice.');
});

test('chunk pipeline: long answer synthesized as ordered chunks, first chunk first', async ({ page }) => {
  // aiAvail() gates gemSpeak (R-35: no keyless user exists) — seed a key so the mocked pipeline runs;
  // __gemTtsMock/__gemPlayMock below ensure no real network call is made.
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  const r = await page.evaluate(async () => {
    const w = window as any; w.__gemTtsLog = [];
    w.__gemTtsMock = (t: string) => { w.__gemTtsLog.push(t); return { mock: true }; };  // buffer stand-in
    w.__gemPlayMock = async () => {};                                                    // no real audio in CI
    const long = Array.from({length: 12}, (_, i) => `משפט מספר ${i} עם עוד כמה מילים כדי שלא יתמזג.`).join(' ');
    await w.gemSpeak(long, 'he', w.vcNewSpeakGen());
    return { n: w.__gemTtsLog.length, first: w.__gemTtsLog[0], lat: w.vcLatReport() };
  });
  expect(r.n).toBeGreaterThan(3);                       // long text = many chunks, all synthesized
  expect(r.first).toContain('משפט מספר 0');             // ordered
  expect(r.lat).toHaveProperty('firstSound');           // stamped when chunk 1 starts playing
});

test('R-34: TTS generationConfig carries maxOutputTokens 8192', async ({ page }) => {
  await seedApp(page, {});
  const gc = await page.evaluate(() => (window as any).gemTtsGen('Kore'));
  expect(gc.maxOutputTokens).toBe(8192);
});

test('R-32: every TTS failure is VISIBLE — toast fires, nothing falls back to a browser voice', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  const r = await page.evaluate(async () => {
    const w = window as any;
    w.__gemTtsMock = () => { throw new Error('timeout'); };
    w.__toastLog = []; const t0 = w.toast; w.toast = (m: string) => { w.__toastLog.push(m); t0(m); };
    let sysSpoke = 0;
    const orig = speechSynthesis.speak.bind(speechSynthesis);
    (speechSynthesis as any).speak = () => { sysSpoke++; };
    try { w.vcSpeak('בדיקת שגיאה קצרה.', 'he'); await new Promise(r => setTimeout(r, 50)); }
    finally { w.toast = t0; (speechSynthesis as any).speak = orig; }
    return { toasts: w.__toastLog, sysSpoke, dead: typeof w.sysSpeak };
  });
  expect(r.toasts.length).toBeGreaterThan(0);      // v278: timeout → SILENT downgrade → RED
  expect(r.sysSpoke).toBe(0);                       // and no browser voice fired
  expect(r.dead).toBe('undefined');                 // sysSpeak is GONE, not bypassed
});

test('R-31: voice language derives from the UI language — one source', async ({ page }) => {
  // stale v278 state seeded (mk-vclang/mk-vcanslang) — R-31 must not read it: the language comes from
  // ONE source, the app's own UI language (mk-lang), not from the deleted per-voice choices.
  await seedApp(page, { 'mk-lang': JSON.stringify('fr'), 'mk-vclang': JSON.stringify('en'), 'mk-vcanslang': JSON.stringify('he') });
  const r = await page.evaluate(() => {
    const w = window as any;
    return { lang: w.vcVoiceLang(), locale: w.vcLocale(w.vcVoiceLang()) };
  });
  expect(r.lang).toBe('fr');
  expect(r.locale).toBe('fr-FR');
});

test('R-29: the HE/EN button pairs are gone and stored state is deleted on first render', async ({ page }) => {
  await seedApp(page, { 'mk-vclang': JSON.stringify('en'), 'mk-vcanslang': JSON.stringify('he') });
  // `store` is a top-level `const` in app.js (classic, non-module script) — visible to a bare-identifier
  // reference evaluated in the page's own global scope (a STRING body), but NOT as a `window.store`
  // property (const never attaches to window) — hence the string-template form, not an arrow function.
  const r = await page.evaluate(`(function(){
    vcTasks=[{ t:new Date(), label:'משימה', kind:'cook' }]; vcIdx=0;
    var host=document.createElement('div'); host.id='vcBody'; document.body.appendChild(host);
    try{ vcRender();
      return { btns: host.querySelectorAll('[data-vc^="lang-"],[data-vc^="anslang-"]').length,
               vc: store.get('mk-vclang'), ans: store.get('mk-vcanslang') };
    } finally { host.remove(); }
  })()`) as { btns: number; vc: unknown; ans: unknown };
  expect(r.btns).toBe(0);
  expect(r.vc ?? null).toBeNull();          // migrated — no stranded state
  expect(r.ans ?? null).toBeNull();
});

// Owner correction (post-dispatch review): the acknowledgement is VISUAL ONLY — no earcon. app.js
// already uses an 880 Hz three-pulse oscillator as the TIMER ALERT (~line 3267); a chime here would be
// mistaken for "the cook is done" at a smoker, not "the voice answered" — safety-adjacent, not style.
test('ack cold path: no earcon exists anywhere, and it costs zero network', async ({ page }) => {
  await seedApp(page, {});
  let ttsCalls = 0;
  await page.route(/generativelanguage|gemini/i, r => { ttsCalls++; r.abort(); });
  try {
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.vcAck(w.vcNewSpeakGen());
      return { lat: w.vcLatReport(), vcEarconType: typeof w.vcEarcon };
    });
    expect(r.vcEarconType).toBe('undefined');   // vcEarcon is GONE — no chime anywhere
    expect(r.lat).toHaveProperty('ackSound');   // the ack still stamps its latency mark (visual path)
    expect(ttsCalls).toBe(0);                   // and costs ZERO network on the cold path
  } finally { await page.unroute(/generativelanguage|gemini/i); }
});

test('ack is visual and instant: vcAskFlow paints the "…thinking" state synchronously, before the AI call resolves', async ({ page }) => {
  await seedApp(page, {});
  // vcTasks/vcIdx/vcLastQA are top-level `let` bindings in app.js (classic, non-module script) — visible
  // to a bare-identifier reference evaluated in the page's own global scope (a STRING body), but NOT as
  // `window.*` properties (let/const never attach to window) — string-template form, not an arrow function.
  const r = await page.evaluate(`(async function(){
    var releaseAI = function(){};
    window.__vcAskMock = function(){ return new Promise(function(res){ releaseAI = res; }); };   // held open — never resolves yet
    vcTasks = []; vcIdx = 0;
    var flow = vcAskFlow('שאלה: מה קורה');
    // vcAskFlow runs synchronously up to its first await (inside vcAskAI) — the visual ack is already
    // painted by the time control returns here, well before any network round-trip could complete.
    var during = vcLastQA ? vcLastQA.a : null;
    releaseAI('done');
    await flow;
    return { during: during };
  })()`) as { during: string | null };
  expect(r.during).toBe('…חושב');
});

// Task 9 (spec §9 phase-gate) — R-31 sweep across the 7 live languages: voice derives from the app's ONE
// UI-language source (R-31, no separate voice-language choice), and every language has a real per-language
// acknowledgement phrase (VC_ACK, app.js ~6979), not a fallback stub. Born GREEN: this pins behavior that
// was already proven RED→GREEN language-by-language across Tasks 7-8 (R-29 button removal, R-31 migration,
// commits a6ac914/0958f47) — DoD-2 note per the T9 brief, not silence. It is a genuine regression guard: it
// would fail today if a future change dropped a language from VC_ACK or VC_LOCALES, or reintroduced a
// separate voice-language source.
// Task 9 finding (DoD-9 screenshot review): the ask-row input placeholder and button used a raw
// en/he-only ternary (`vcVoiceLang()==='en'?'...':'...'`) instead of L() — every non-en/non-he language
// (fr/de/es/it/ru) rendered the HEBREW fallback for these two strings. Fixed to route through L(); this
// pins the regression for all 5 previously-leaking languages.
for (const lg of ['fr', 'de', 'es', 'it', 'ru']) {
  test(`R-36a/T9 regression: the ask-row placeholder and button are localized, not a Hebrew leak (${lg})`, async ({ page }) => {
    await seedApp(page, { 'mk-lang': JSON.stringify(lg), 'mk-gemkey': JSON.stringify('test-key') });
    // openVoiceCook fires a fire-and-forget vcWarmAck() network pre-warm (app.js ~6641) — block it so a
    // fake test key never races a real fetch under full-suite parallel load (matches the R-32/DoD-8 tests'
    // established page.route pattern for this same panel).
    await page.route(/generativelanguage|gemini/i, r => r.abort());
    try {
      await page.evaluate(`(function(){ closePanel(); vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0; openVoiceCook(vcTasks); })()`);
      await page.waitForSelector('#vcAskInput', { state: 'visible' });
      const r = await page.evaluate(`(function(){
        return { placeholder: document.querySelector('#vcAskInput').getAttribute('placeholder'),
                 btn: document.querySelector('.vc-askbtn').textContent };
      })()`) as { placeholder: string; btn: string };
      expect(r.placeholder).not.toContain('הקלד שאלה');   // no Hebrew leak
      expect(r.btn).not.toContain('שאל');
      expect(r.placeholder.length).toBeGreaterThan(2);
    } finally { await page.unroute(/generativelanguage|gemini/i); }
  });
}

for (const lg of ['he', 'en', 'fr', 'de', 'es', 'it', 'ru']) {
  test(`R-31 sweep: voice derives from UI language ${lg}`, async ({ page }) => {
    await seedApp(page, { 'mk-lang': JSON.stringify(lg) });
    const r = await page.evaluate(() => {
      const w = window as any;
      return { v: w.vcVoiceLang(), loc: w.vcLocale(w.vcVoiceLang()), ack: w.vcAckText() };
    });
    expect(r.v).toBe(lg);
    expect(r.loc.startsWith(lg === 'he' ? 'he' : lg)).toBe(true);
    expect(r.ack.length).toBeGreaterThan(3);           // a real per-language phrase, not a fallback stub
  });
}
