import { test, expect, seedApp } from './_fixtures';

// ── Owner report on v287 (2026-08-02), two follow-ups on the read-aloud of a SAFETY answer ────────
//  (1) "אחרי המילה מאומת יש שקט יחסית ארוך עד המשך ההקראה" — a multi-second silence mid-answer.
//  (2) "רגע בודק נאמר פעמיים, כנראה נרשם בשני מקומות" — the fixed acknowledgement is spoken TWICE.
//
// WHY THE v286 TESTS MISSED BOTH: tests/vg-target-temp-release.spec.ts drives vcAskFlow WITHOUT ever
// opening the voice panel, so `vcWarmAck` (app.js:7764, fired on every vcRender that has a task) never
// runs, `gemCache` stays empty, and `vcAck`'s warm branch — the FIRST acknowledgement — never sounds.
// It also mocks synthesis as instantaneous, so no audio-clock gap can exist. Both defects live entirely
// in the shape those two simplifications erase.
//
// THIS harness reproduces the live shape:
//   · the panel is OPEN with a running task  → vcWarmAck pre-warms the ack into gemCache
//   · every synthesis costs its MEASURED time — the same cost model app.js:7530-7538 derives its own
//     chunking budget from: request_ms = 1385 + 55.026·chars, and 204 chars → 19.7 s of audio.
//   · the classifier costs its measured 7-14 s (docs/analysis/2026-08-01-thinking-latency-is-the-bottleneck.md)
// It then reads the AUDIBLE timeline off the real cursor contract — gemSpeakSeg/ttsSpeakSeg
// (text, lang, gen, startAt) → cursor — so "how many acknowledgements were dispatched" and "how long is
// the silence between two spoken segments" are both observable effects of the shipped plumbing, not flags.
const SPEED = 10;   // virtual/real time scale — the modelled timeline is reported in VIRTUAL seconds

const harness = (warm: boolean) => `(async function(){
  const w = window;
  const SPEED = ${SPEED};
  const T0 = performance.now();
  const vnow = () => (performance.now()-T0)*SPEED/1000;
  const sleep = (ms) => new Promise(r=>setTimeout(r, Math.max(0,ms)/SPEED));
  const REQ = (t) => 1385 + 55.026*String(t).length;   // app.js VC_TTS_REQ_OVERHEAD_MS / VC_TTS_CHAR_MS
  const AUD = (t) => String(t).length*0.0966;          // same measurement's audio side (204ch → 19.7s)
  w.__tl = [];

  // streamed TTS — plays progressively, resolves when the last frame is SCHEDULED (R-39 contract)
  w.__gemTtsStreamMock = async function(text, lang, gen, startAt){
    const ev = {kind:'stream', text:String(text), tReq:vnow(), startAt:(startAt||0)};
    w.__tl.push(ev);
    await sleep(1100);                                  // measured first-audio-frame latency
    ev.tAudioStart = Math.max(vnow(), startAt||0);
    await sleep(REQ(text)-1100);
    ev.tAudioEnd = ev.tAudioStart + AUD(text);
    return ev.tAudioEnd;
  };
  // blocking synth (the lookahead-1 prefetch AND the panel-open pre-warm). Delegates to the REAL
  // gemSynthChunk so gemCache is populated exactly as in production; a repeat is free, as a cache hit is.
  const realSynth = w.gemSynthChunk;
  const seen = new Set();
  w.gemSynthChunk = async function(t){
    const k = String(t);
    if(!seen.has(k)){
      const ev = {kind:'synth', text:k, tReq:vnow()};
      w.__tl.push(ev);
      await sleep(REQ(k));
      ev.tDone = vnow(); seen.add(k);
    }
    return realSynth(t);
  };
  w.__gemTtsMock = function(clean){ return {duration:AUD(clean), __text:String(clean)}; };
  w.__gemPlayMock = async function(buf, gen, startAt){
    const ev = {kind:'play', text:(buf&&buf.__text)||'(?)', tCall:vnow(), startAt:(startAt||0)};
    w.__tl.push(ev);
    const t0 = Math.max(vnow()+0.05, startAt||0);
    ev.tAudioStart = t0; ev.tAudioEnd = t0 + ((buf&&buf.duration)||0);
    await sleep((ev.tAudioEnd - vnow())*1000);
    return ev.tAudioEnd;
  };
  // the classifier's measured thinking latency — it is why the acknowledgement exists at all
  const realClass = w.vcClassifySafetyClaims;
  w.vcClassifySafetyClaims = async function(a){
    const ev = {kind:'classifier', tReq:vnow()}; w.__tl.push(ev);
    await sleep(8000);
    const r = await realClass(a); ev.tDone = vnow(); return r;
  };
  w.__vcClassMock = function(){ return { claims:[
    {text:'63°C', kind:'internal_safe_temp',   value:63, unit:'C', subject:{item:'asado',category:'beef',form:'whole'}, confidence:0.98},
    {text:'90°C', kind:'internal_target_temp', value:90, unit:'C', subject:{item:'asado',category:'beef',form:'whole'}, confidence:0.98},
    {text:'95°C', kind:'internal_target_temp', value:95, unit:'C', subject:{item:'asado',category:'beef',form:'whole'}, confidence:0.98}
  ]}; };
  // The model answer is the v287 LIVE asado run-4 shape, verbatim from
  // docs/analysis/2026-08-02-v287-live-verification.md — a safety answer whose FIRST sentence carries a
  // number, which is exactly the shape that freezes the early-opener gate.
  const S = ['טמפרטורת הבטיחות המינימלית לאסאדו, כמו לכל נתח בקר שלם, היא 63°C. ',
             'במרכז הנתח, עם מנוחה של שלוש דקות לפחות. ',
             'יחד עם זאת, כדי שהשומן והרקמות באסאדו יתפרקו והבשר יהיה רך ועסיסי, נהוג להביא אותו לטמפרטורה פנימית של 90°C עד 95°C.'];
  w.__vcAskStreamMock = async function(_q, onDelta){
    await sleep(1200);
    for(let i=0;i<S.length;i++){ onDelta(S[i]); if(i<S.length-1) await sleep(900); }
    return S.join('');
  };

  ${warm ? `
  // WARM — the live shape: the voice panel is open on a running task, so vcWarmAck has pre-warmed the
  // acknowledgement into gemCache and vcAck's warm branch WILL sound it.
  closePanel(); openVoiceCook([{label:'אסאדו', t:new Date()}]);
  for(let i=0;i<300 && !seen.size;i++) await new Promise(r=>setTimeout(r,10));
  w.__tl.length = 0;                       // the step read-aloud openVoiceCook triggers is not under test
  ` : `
  // COLD — the panel was never opened, so nothing is cached: vcAck is silent by design and the SPOKEN
  // acknowledgement must still fire (owner ruling 1.8.26). The negative case for the fix.
  `}
  try{
    await w.vcAskFlow('שאלה מה טמפרטורת הבטיחות באסאדו');
    for(let i=0;i<800;i++) await new Promise(r=>setTimeout(r,10));   // let the answer finish sounding
  } finally {
    w.gemSynthChunk = realSynth; w.vcClassifySafetyClaims = realClass;
    delete w.__vcAskStreamMock; delete w.__gemTtsStreamMock; delete w.__gemTtsMock;
    delete w.__gemPlayMock; w.__vcClassMock = null;
  }
  const ACK = 'רגע, בודק';
  const spoken = w.__tl.filter(e => e.tAudioStart != null).sort((a,b)=>a.tAudioStart-b.tAudioStart);
  const acks   = spoken.filter(e => String(e.text).indexOf(ACK) >= 0);
  const answer = spoken.filter(e => String(e.text).indexOf(ACK) < 0);
  let maxGap = 0, gapAfter = '';
  for(let i=1;i<answer.length;i++){
    const g = answer[i].tAudioStart - answer[i-1].tAudioEnd;
    if(g > maxGap){ maxGap = g; gapAfter = String(answer[i-1].text); }
  }
  return {
    ackCount: acks.length,
    ackTexts: acks.map(e=>String(e.text)),
    ttsRequests: w.__tl.filter(e=>e.kind==='stream'||e.kind==='synth').length,
    answerSegments: answer.map(e=>({t:String(e.text), a:+e.tAudioStart.toFixed(2), e:+e.tAudioEnd.toFixed(2)})),
    maxGap: +maxGap.toFixed(2),
    gapAfter: gapAfter,
    guarded: String(vcLastQA && vcLastQA.a || '')
  };
})()`;

const boot = async (page: any) => {
  await seedApp(page, { 'mk-uilevel-asked':'true', 'mk-lang': JSON.stringify('he'),
                        'mk-gemkey': JSON.stringify('test-key') });
  await page.waitForFunction(`typeof vcAskFlow==='function' && typeof vcWarmAck==='function'`);
};

test.describe('v287 follow-up · the spoken acknowledgement and the mid-answer silence', () => {

  // ── DEFECT 2 ────────────────────────────────────────────────────────────────────────────────────
  test('A1 · WARM panel — the acknowledgement is dispatched EXACTLY ONCE', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    const r = await page.evaluate(harness(true)) as any;
    console.log('A1 acks:', JSON.stringify(r.ackTexts), 'requests:', r.ttsRequests);
    expect(r.ackCount).toBe(1);
  });

  test('A2 · NEGATIVE — COLD (nothing pre-warmed) still speaks the acknowledgement exactly once', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    const r = await page.evaluate(harness(false)) as any;
    console.log('A2 acks:', JSON.stringify(r.ackTexts), 'requests:', r.ttsRequests);
    expect(r.ackCount).toBe(1);
    expect(r.ackTexts[0]).toContain('רגע, בודק');
    expect(r.ackTexts[0]).not.toMatch(/\d/);          // digit-free by construction — the gate is untouched
  });

  // ── DEFECT 1 ────────────────────────────────────────────────────────────────────────────────────
  test('B1 · the guarded answer is read WITHOUT a multi-second silence between its segments', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    const r = await page.evaluate(harness(true)) as any;
    console.log('B1 segments:', JSON.stringify(r.answerSegments, null, 1));
    console.log('B1 maxGap:', r.maxGap, 'after:', r.gapAfter);
    console.log('B1 guarded:', r.guarded);
    expect(r.guarded).toContain('לפי המדריך המאומת');   // the live v287 shape, reproduced by the REAL guard
    expect(r.maxGap).toBeLessThanOrEqual(1.0);
    // DoD-10 safety invariance: closing the gap must not have dropped a syllable — what was SPOKEN is
    // exactly the guarded text, every safety figure included. The re-chunking moves boundaries only.
    const spoken = r.answerSegments.map((s: any) => s.t).join(' ').replace(/\s+/g, ' ').trim();
    expect(spoken).toBe(r.guarded.replace(/\s+/g, ' ').trim());
    expect(spoken).toContain('63°C');
    expect(spoken).toContain('90°C');
    expect(spoken).toContain('95°C');
    // DoD-8/9 — the Hebrew transcript the user reads alongside the corrected read-aloud, at 390x844
    await page.waitForFunction(`document.querySelector('.vc-qa-a')`);
    await page.evaluate(`document.querySelector('.vc-qa').scrollIntoView({block:'center'})`);
    await page.screenshot({ path: '.superpowers/sdd/ack-gap-b1-transcript-390x844.png' });
  });

  test('B2 · the fix does not buy silence with extra TTS requests (quota covenant)', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    const r = await page.evaluate(harness(true)) as any;
    console.log('B2 requests:', r.ttsRequests);
    // v287 baseline for this answer: 1 pre-warm synth + 1 spoken ack + 2 answer chunks = 4.
    // Removing the duplicate ack takes it to 3; nothing may push it back up.
    expect(r.ttsRequests).toBeLessThanOrEqual(3);
  });
});
