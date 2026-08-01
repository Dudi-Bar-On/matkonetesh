import { test, expect, seedApp } from './_fixtures';

// R-53 sweep (owner-reported, live v282): pressing the Voice Cook "next task" button in Russian spoke
// PART Hebrew. Root cause: `vcAction`'s qwhen/qtemp handlers, plus the wireTimer onWarn/onEnd callbacks
// and two more spoken/displayed strings, built their text with a BINARY `vcVoiceLang()==='en'` ternary —
// true only for English, false (and therefore Hebrew) for every other live language (fr/de/es/it/ru).
// Fixed by routing every site through L(), so all 7 live languages get their own sentence. This spec
// asserts on the actual text handed to vcSpeak (never on the removed `en` flag — DoD-9's own lesson),
// in two non-en/non-he languages (Russian, the reported case, and French), covering both the happy path
// and the empty/last-task and no-temperature branches (DoD-6).

const HEBREW_RE = /[֐-׿]/;

const bootVC = async (page: any, lang: string) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true',   // app.js:12763 replaces an open panel 400ms after boot otherwise (see voice-wave0.spec.ts FLAKE ROOT CAUSE)
    'mk-lang': JSON.stringify(lang),
  });
  // wait for the async dict fetch to settle before touching L()-backed strings (same 3-condition wait
  // established in voice-wave0.spec.ts's R-36a/T9 regression tests — no vacuous pass, no timeout).
  await page.waitForFunction(`(function(){ var g=window.__mkLangReady; return !!g && typeof g.then==='function'; })()`, undefined, { polling: 50 });
  await page.evaluate(() => (window as any).__mkLangReady);
  await page.waitForFunction(`(function(){ return typeof getLang==='function' && (getLang()==='he' || !!(I18N_DICTS||{})[getLang()]); })()`, undefined, { polling: 50 });
  // capture what actually reaches speech, without a real TTS call (established pattern, p0-spoken-safety.spec.ts)
  await page.evaluate(`window.__spoke=[]; window.vcSpeak=(t,l)=>{ window.__spoke.push({t:String(t),l:l||''}); };`);
};

for (const lg of ['ru', 'fr']) {
  test(`qwhen: "next task at HH:MM" is spoken in ${lg}, no Hebrew leak`, async ({ page }) => {
    await bootVC(page, lg);
    const clock = await page.evaluate(`(function(){
      vcTasks=[{ikey:'cut-1',label:'x',t:new Date(2026,0,1,18,30)},{ikey:'cut-2',label:'y',t:new Date(2026,0,1,19,0)}]; vcIdx=0;
      vcAction('qwhen');
      return fmtClock(vcTasks[1].t);
    })()`) as string;
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(HEBREW_RE.test(spoken)).toBe(false);
    expect(spoken).toContain(clock);   // the interpolated time itself must survive
  });

  test(`qwhen: the last-task branch is spoken in ${lg}, no Hebrew leak`, async ({ page }) => {
    await bootVC(page, lg);
    await page.evaluate(`(function(){
      vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0;   // vcIdx is the LAST task — no next
      vcAction('qwhen');
    })()`);
    await page.waitForFunction(`window.__spoke.length>0`);
    const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
    expect(HEBREW_RE.test(spoken)).toBe(false);
  });
}

test('qtemp: a plain temperature reading is spoken in Russian, no Hebrew leak, number intact', async ({ page }) => {
  await bootVC(page, 'ru');
  await page.evaluate(`(function(){
    vcTasks=[{ikey:'cut-1',label:'משימה',det:'150° בתא',kind:'other',t:new Date()}]; vcIdx=0;
    vcAction('qtemp');
  })()`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(HEBREW_RE.test(spoken)).toBe(false);
  expect(spoken).toContain('150');   // the safety-adjacent number must survive untouched (DoD-10)
});

test('qtemp: the no-temperature-for-this-step branch is spoken in Russian, no Hebrew leak', async ({ page }) => {
  await bootVC(page, 'ru');
  await page.evaluate(`(function(){
    vcTasks=[{ikey:'cut-1',label:'משימה',det:'',kind:'other',t:new Date()}]; vcIdx=0;
    vcAction('qtemp');
  })()`);
  await page.waitForFunction(`window.__spoke.length>0`);
  const spoken = await page.evaluate(`window.__spoke[window.__spoke.length-1].t`) as string;
  expect(HEBREW_RE.test(spoken)).toBe(false);
});

test('timer onWarn/onEnd countdown text is localized in Russian, no Hebrew leak', async ({ page }) => {
  await bootVC(page, 'ru');
  // Capture the REAL onWarn/onEnd closures vcRender's own timer-wiring block (app.js ~7380-7381) hands
  // to wireTimer, by monkey-patching wireTimer for one call — this exercises the production closures
  // themselves, not a re-implementation of their string-building logic.
  const spoken = await page.evaluate(`(function(){
    var captured=null;
    var realWireTimer=wireTimer;
    window.wireTimer=function(tm, opts){ captured=opts; return realWireTimer(tm, opts); };
    var host=document.getElementById('vcBody');
    var made=false;
    if(!host){ host=document.createElement('div'); host.id='vcBody'; document.body.appendChild(host); made=true; }
    var now=new Date();
    vcTasks=[
      {ikey:'cut-1', label:'x', t:now},
      {ikey:'cut-2', label:'y', t:new Date(now.getTime()+200*1000)}   // 200s gap → the vc-timerwrap branch (app.js:7344), sec>150 → warnAt=120
    ];
    vcIdx=0;
    vcRender();
    window.wireTimer=realWireTimer;
    var out={ hadWarn: typeof (captured&&captured.onWarn)==='function', hadEnd: typeof (captured&&captured.onEnd)==='function', warnMsg:null, endMsg:null };
    var spokenLog=[];
    window.vcSpeak=function(t){ spokenLog.push(String(t)); };
    if(captured){ captured.onWarn(90); captured.onEnd(); }   // 90s left → the "minutes" branch (left>=60)
    out.warnMsg=spokenLog[0]||null; out.endMsg=spokenLog[1]||null;
    if(made) host.remove();
    return out;
  })()`) as { hadWarn: boolean; hadEnd: boolean; warnMsg: string | null; endMsg: string | null };
  expect(spoken.hadWarn).toBe(true);   // sanity: the real timer-wiring block ran and passed callbacks
  expect(spoken.hadEnd).toBe(true);
  expect(spoken.warnMsg).not.toBeNull();
  expect(spoken.endMsg).not.toBeNull();
  expect(HEBREW_RE.test(spoken.warnMsg as string)).toBe(false);
  expect(spoken.warnMsg).toContain('2');   // Math.round(90/60)=2 minutes — the interpolated number must survive
  expect(HEBREW_RE.test(spoken.endMsg as string)).toBe(false);
});

test('"listening" prompt and "command not recognized" toast are localized in Russian, no Hebrew leak', async ({ page }) => {
  await bootVC(page, 'ru');
  // Drive the REAL vcToggleMic()/startRec() production path (app.js ~7942-7982), not a re-implementation:
  // stub navigator.mediaDevices away so startRec() runs synchronously (the `else startRec()` branch,
  // app.js:7982), and install a fake SpeechRecognition constructor so `new SR()` succeeds without a real
  // mic. `rec.start()`/`vcSpeak(...)` then fire for real, and `rec.onresult` is invoked with a transcript
  // that matches none of the command regexes, exercising the real "not recognized" toast branch.
  const r = await page.evaluate(`(function(){
    var toastLog=[]; window.toast=function(m){ toastLog.push(m); };
    var spokenLog=[]; window.vcSpeak=function(t){ spokenLog.push(String(t)); };
    var savedMD=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
    try{ Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true}); }catch(e){}
    function FakeRec(){}
    FakeRec.prototype.start=function(){};
    FakeRec.prototype.stop=function(){};
    window.SpeechRecognition=FakeRec;
    vcTasks=[{ikey:'cut-1',label:'x',t:new Date()}]; vcIdx=0;
    vcToggleMic();
    var rec=vcRec;   // top-level let in app.js — bare identifier, not a window.* property
    rec.onresult({ results: [ [ { transcript: 'zzz totally unrecognized gibberish' } ] ] });
    if(savedMD) Object.defineProperty(navigator,'mediaDevices',savedMD); else delete navigator.mediaDevices;
    delete window.SpeechRecognition;
    return { listening: spokenLog[0]||null, notRecognized: toastLog[toastLog.length-1]||null };
  })()`) as { listening: string | null; notRecognized: string | null };
  expect(r.listening).not.toBeNull();
  expect(r.notRecognized).not.toBeNull();
  expect(HEBREW_RE.test(r.listening as string)).toBe(false);
  expect(HEBREW_RE.test(r.notRecognized as string)).toBe(false);
  expect((r.listening as string).length).toBeGreaterThan(10);
  expect(r.notRecognized).toContain('zzz totally unrecognized gibberish');
});
