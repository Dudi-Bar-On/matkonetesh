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

// M4 (silent-failure-hunter audit): the previous version of this test called vcGenCurrent() directly and
// asserted counter arithmetic it wrote itself — deleting every `if(!vcGenCurrent(gen)) return` from
// app.js's real gemSpeak/gemPlayBuf pipeline would leave it green, because it never touched that pipeline.
// Rewritten to drive the REAL gemSpeak() with two overlapping generations and a genuinely multi-chunk
// text for the stale speaker, so the assertion is on the pipeline's own behavior: a slow speaker (A) that
// gets superseded mid-playback must never start its SECOND chunk once a newer speaker (B) has taken the
// floor — the exact guard this test exists to protect.
test('speaker token: a stale (slow) speaker can never kill its successor (drives the real gemSpeak pipeline)', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  const log = await page.evaluate(async () => {
    const w = window as any;
    const playLog: string[] = [];
    let releaseAChunk1: () => void = () => {};
    w.__gemTtsMock = (t: string) => ({ mock: true, t });                          // instant "synthesis"
    w.__gemPlayMock = (buf: any) => {
      const tag = String(buf && buf.t || '');
      if (tag.startsWith('A1')) {
        // A's FIRST chunk blocks here — simulating a slow/still-playing speaker — until the test
        // explicitly releases it, by which point B has already taken the floor.
        return new Promise<void>((res) => { releaseAChunk1 = () => { playLog.push('A1-played'); res(); }; });
      }
      playLog.push(tag + '-played');
      return Promise.resolve();
    };
    const genA = w.vcNewSpeakGen();
    // two real sentences -> vcChunkText really produces 2 chunks -> gemSpeak's real loop really iterates twice
    const pA = w.gemSpeak('A1 first sentence here now. A2 second sentence follows after.', 'en', genA);
    await Promise.resolve(); await Promise.resolve();   // let A reach its blocked first-chunk playback
    const genB = w.vcNewSpeakGen();                       // B takes the floor — A is now stale
    await w.gemSpeak('B1 only sentence.', 'en', genB);    // B completes fully first
    releaseAChunk1();                                     // now let A's stale first-chunk playback resolve
    await pA;                                              // A's own gemSpeak loop must bail out here
    return playLog;
  });
  // B played (never blocked by the stale A). A's first (already-in-flight) chunk resolved once released,
  // but the REAL vcGenCurrent(genA) check inside gemSpeak's loop (app.js) must have stopped it BEFORE
  // synthesizing/playing its second chunk — "A2" never appears. Deleting that guard would add it back.
  expect(log).toContain('B1 only sentence.-played');
  expect(log).toContain('A1-played');
  expect(log.some((l) => l.startsWith('A2'))).toBe(false);
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
  // M4 (silent-failure-hunter audit): asserting length>0 alone would still pass if the toast text
  // regressed to something generic/wrong (e.g. the H3 "no network" mislabel) — assert the actual content,
  // the specific timeout message this failure shape must produce.
  expect(r.toasts[0]).toContain('איטית מדי');
  expect(r.sysSpoke).toBe(0);                       // and no browser voice fired
  expect(r.dead).toBe('undefined');                 // sysSpeak is GONE, not bypassed
});

// H1 (silent-failure-hunter audit) — vcAskFlow's catch used to discard the error entirely and collapse
// EVERY failure (a TypeError inside the safety guard, a quota wall, a genuine outage) into the same
// "AI unavailable" message forever, with nothing logged. Now: every failure is logged, and a quota
// failure reads differently from a generic one.
test('H1: vcAskFlow logs every caught error and gives a quota failure a distinct message from a generic one', async ({ page }) => {
  await seedApp(page, { 'mk-lang': JSON.stringify('en') });
  const r = await page.evaluate(async () => {
    const w = window as any;
    const warnLog: any[] = [];
    const origWarn = console.warn;
    console.warn = (...a: any[]) => { warnLog.push(a); };
    try {
      vcTasks = []; vcIdx = 0;
      w.__vcAskMock = () => { throw new Error('api-429 quota'); };
      await vcAskFlow('question: whatever');
      const quotaMsg = vcLastQA.a;
      w.__vcAskMock = () => { throw new TypeError('boom, something inside the guard broke'); };
      await vcAskFlow('question: whatever again');
      const genericMsg = vcLastQA.a;
      return { quotaMsg, genericMsg, warnCount: warnLog.length };
    } finally { console.warn = origWarn; }
  });
  expect(r.warnCount).toBeGreaterThanOrEqual(2);          // both failures logged — nothing silently discarded
  expect(r.quotaMsg).not.toBe(r.genericMsg);              // a quota wall reads differently from a real bug
  expect(r.quotaMsg).toMatch(/quota/i);
  expect(r.genericMsg).toMatch(/not available/i);
});

// M3 — the "…thinking" placeholder and the "AI unavailable" fallback now cover all 7 live languages
// (previously he/en-only; a ru-UI user saw Hebrew for both).
test('M3: the thinking placeholder and AI-unavailable message are localized for all 7 languages', async ({ page }) => {
  await seedApp(page, {});
  // VC_THINKING/VC_AI_UNAVAILABLE/VC_AI_QUOTA are top-level `const` in app.js (classic, non-module
  // script) — visible to a bare-identifier reference evaluated in the page's own global scope (a STRING
  // body), but NOT as `window.*` properties (const never attaches to window) — same reason the R-29 test
  // above uses the string-template form rather than an arrow function.
  const r = await page.evaluate(`(function(){
    var langs=['he','en','fr','de','es','it','ru'];
    return langs.map(function(l){ return { l:l, thinking: VC_THINKING[l], unavail: VC_AI_UNAVAILABLE[l], quota: VC_AI_QUOTA[l] }; });
  })()`) as { l: string; thinking: string; unavail: string; quota: string }[];
  for (const row of r) {
    expect(row.thinking, row.l).toBeTruthy();
    expect(row.unavail, row.l).toBeTruthy();
    expect(row.quota, row.l).toBeTruthy();
    if (row.l !== 'he') { expect(row.thinking).not.toBe(r[0].thinking); expect(row.unavail).not.toBe(r[0].unavail); }
  }
});

// M5 — aiAvail() going false mid-session (key revoked, disconnected) used to make every "הקרא" press a
// silent no-op forever. Now it toasts a reconnect hint instead of bare-returning.
test('M5: vcSpeak toasts a reconnect hint instead of a silent no-op when no AI key is connected', async ({ page }) => {
  await seedApp(page, {});   // no mk-gemkey seeded -> aiAvail() is false
  const r = await page.evaluate(() => {
    const w = window as any;
    w.__toastLog = []; const t0 = w.toast; w.toast = (m: string) => { w.__toastLog.push(m); };
    try { w.vcSpeak('טקסט כלשהו', 'he'); } finally { w.toast = t0; }
    return w.__toastLog;
  });
  expect(r.length).toBe(1);
  expect(r[0]).toMatch(/מפתח|key/i);
});

// M2 — err.chunkIdx (set by gemSpeak) is now actually read: a failure AFTER some chunks already played
// reads differently from one that never started. Two independent tests (fresh page each) to avoid any
// cross-scenario state leakage in the synth cache / speaker generation.
test('M2: a mid-answer TTS failure (chunkIdx>0) reads as "stopped partway"', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  await page.evaluate(() => {
    const w = window as any;
    let call = 0;
    w.__gemTtsMock = () => { call++; if (call === 2) throw new Error('boom'); return { mock: true }; };
    w.__gemPlayMock = async () => {};
    w.__toastLog = []; w.toast = (m: string) => { w.__toastLog.push(m); };
    w.vcSpeak('First sentence here now. Second sentence follows next.', 'en');
  });
  await page.waitForFunction(`window.__toastLog && window.__toastLog.length>0`);
  const toast = await page.evaluate(`window.__toastLog[window.__toastLog.length-1]`) as string;
  expect(toast).toMatch(/partway|באמצע/);
});
test('M2 negative case: a first-chunk TTS failure (chunkIdx===0) does NOT carry the "stopped partway" prefix', async ({ page }) => {
  await seedApp(page, { 'mk-gemkey': JSON.stringify('test-key') });
  await page.evaluate(() => {
    const w = window as any;
    w.__gemTtsMock = () => { throw new Error('boom'); };
    w.__toastLog = []; w.toast = (m: string) => { w.__toastLog.push(m); };
    w.vcSpeak('Only sentence here.', 'en');
  });
  await page.waitForFunction(`window.__toastLog && window.__toastLog.length>0`);
  const toast = await page.evaluate(`window.__toastLog[window.__toastLog.length-1]`) as string;
  expect(toast).not.toMatch(/partway|באמצע/);
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
      // Single atomic read (element existence + both attributes) inside one waitForFunction, rather than a
      // waitForSelector followed by a separate evaluate — a re-render between those two round-trips
      // (vcRender() replaces host.innerHTML) can otherwise null out the element mid-read on a loaded
      // machine, an environment-timing flake unrelated to the assertion itself.
      const r = await page.waitForFunction(`(function(){
        var i=document.querySelector('#vcAskInput'), b=document.querySelector('.vc-askbtn');
        if(!i||!b) return null;
        return { placeholder: i.getAttribute('placeholder'), btn: b.textContent };
      })()`).then(h => h.jsonValue()) as { placeholder: string; btn: string };
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
