import { test, expect } from '@playwright/test';

// Wave 1 — AI trust & infra foundation.
// gemFetch is intercepted to capture the outgoing prompt (no real network / key needed).
// Boots once; language is switched via the store (askGemini/aiJSON read getLang() at call time).
const bootAI = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-gemkey', JSON.stringify('test-key'));
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof aiJSON==='function' && typeof askGemini==='function'`);
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; };`);
};
const capAfter = async (page: any, jsCall: string) => {
  const n = await page.evaluate(`window.__cap.length`) as number;
  await page.evaluate(`(async()=>{ try{ await (${jsCall}); }catch(e){} })()`);
  await page.waitForFunction(`window.__cap.length > ${n}`);
  return page.evaluate(`window.__cap[window.__cap.length-1].body`);
};

test('W1-P1: Ask-the-Fire answers in the UI language (no Hebrew-forced prompt in English)', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-lang','en')`);
  const en = await capAfter(page, `askGemini('how long to smoke ribs')`);
  expect(en.system_instruction.parts[0].text).toContain('English');
  expect(en.system_instruction.parts[0].text).not.toContain('ענה תמיד בעברית');
  await page.evaluate(`store.set('mk-lang','he')`);
  const he = await capAfter(page, `askGemini('כמה זמן לעשן צלעות')`);
  expect(he.system_instruction.parts[0].text).toContain('ענה תמיד בעברית');
});

test('W1-P1: aiJSON tasks carry an output-language directive that follows the UI language', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-lang','en')`);
  const en = await capAfter(page, `aiJSON({task:'t', grounding:'g', schemaHint:'{}'})`);
  expect(en.contents[0].parts[0].text).toContain('in ENGLISH');
  await page.evaluate(`store.set('mk-lang','he')`);
  const he = await capAfter(page, `aiJSON({task:'t', grounding:'g', schemaHint:'{}'})`);
  expect(he.contents[0].parts[0].text).not.toContain('in ENGLISH');
  // an explicit outLang override wins over the UI language
  const ov = await capAfter(page, `aiJSON({task:'t', grounding:'g', outLang:'en'})`);
  expect(ov.contents[0].parts[0].text).toContain('in ENGLISH');
});

test('W1-P2: safety detector catches extended patterns and the caveat is bilingual', async ({ page }) => {
  await bootAI(page);
  expect(await page.evaluate(`aiSafetyHasNumbers('cook to 165F')`)).toBe(true);       // bare Fahrenheit
  expect(await page.evaluate(`aiSafetyHasNumbers('use 2.5% salt')`)).toBe(true);        // salt %
  expect(await page.evaluate(`aiSafetyHasNumbers('ferment to pH 5.3')`)).toBe(true);    // pH
  expect(await page.evaluate(`aiSafetyHasNumbers('target aw 0.89')`)).toBe(true);       // water activity
  expect(await page.evaluate(`aiSafetyHasNumbers('cure #1 at 156 ppm')`)).toBe(true);
  expect(await page.evaluate(`aiSafetyHasNumbers('rest for a while then slice thin')`)).toBe(false);
  // bilingual
  expect(await page.evaluate(`aiSafetyCaveat('cure #1 156 ppm')`)).toContain('not verified');
  await page.evaluate(`store.set('mk-lang','he')`);
  expect(await page.evaluate(`aiSafetyCaveat('ריפוי 156 ppm')`)).toContain('אינם מאומתים');
});

test('W1-P2: Diagnose & Journal render the safety caveat only when the AI output has safety numbers', async ({ page }) => {
  await bootAI(page);
  // Diagnose WITH a safety number → caveat present
  await page.evaluate(`diagnoseRender('stall', {diagnosis:'wrap at 70C to push through the stall', causes:['evaporative cooling'], fixes:['bump the pit to 135C'], related:[]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(true);
  await page.evaluate(`closePanel()`);
  // Diagnose WITHOUT numbers → no caveat
  await page.evaluate(`diagnoseRender('bitter', {diagnosis:'too much smoke early on', causes:['creosote buildup'], fixes:['aim for thin blue smoke'], related:[]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(false);
  await page.evaluate(`closePanel()`);
  // Journal insights with a temperature → caveat
  await page.evaluate(`journalInsightsRender({summary:'your best cooks rested longer', patterns:['wrapping at 70C rated higher'], suggestions:[{title:'rest more',detail:'try 45 minutes'}]})`);
  expect(await page.evaluate(`!!document.querySelector('#panel .ai-caveat')`)).toBe(true);
});

test('W1-P3: numeric guard flags ungrounded safety numbers and offers the calculator', async ({ page }) => {
  await bootAI(page);
  // extraction: temps / ppm / % (not incidental "6 hours")
  expect(await page.evaluate(`JSON.stringify(aiSafetyNums('smoke at 110C for 6 hours, cure 156 ppm, 2.5% salt'))`)).toBe(JSON.stringify([110, 156, 2.5]));
  // ungrounded (250 not in context) vs grounded (156 present)
  expect(await page.evaluate(`aiUngroundedSafety('use 250 ppm nitrite', 'vetted: cure #1 156 ppm').length`)).toBe(1);
  expect(await page.evaluate(`aiUngroundedSafety('cure at 156 ppm', 'vetted: 156 ppm').length`)).toBe(0);
  // note escalation: ungrounded → STRONG + calculator link; grounded → mild; none → empty
  const strong = await page.evaluate(`aiSafetyNote('use 250 ppm nitrite', 'vetted: 156 ppm')`) as string;
  expect(strong).toContain('ai-caveat-strong'); expect(strong).toContain('data-aicalc');
  const mild = await page.evaluate(`aiSafetyNote('cure at 156 ppm', 'vetted: 156 ppm')`) as string;
  expect(mild).toContain('ai-caveat'); expect(mild).not.toContain('data-aicalc');
  expect(await page.evaluate(`aiSafetyNote('rest for a while then slice thin', 'ctx')`)).toBe('');
  // askGemini now returns its grounding context for the guard
  expect(await page.evaluate(`(async()=>{ try{ const r=await askGemini('how long to smoke ribs'); return typeof r.ctx; }catch(e){ return 'err'; } })()`)).toBe('string');
});

test('W1-P3: the calculator deep-link from a strong caveat opens the calculator', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`showPanel('<div class="panel-body">'+aiSafetyNote('use 250 ppm nitrite','vetted: 156 ppm')+'</div>')`);
  await page.click('#panel [data-aicalc]');
  await page.waitForSelector('#panel h2');
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Calculators');
});

test('W1-P4: safety questions always attach the vetted SAFETY_FACTS grounding (even with no catalog match)', async ({ page }) => {
  await bootAI(page);
  // intent detection
  expect(await page.evaluate(`askSafetyIntent('how much Cure #1 for salami')`)).toBe(true);
  expect(await page.evaluate(`askSafetyIntent('what temp is safe for chicken')`)).toBe(true);
  expect(await page.evaluate(`askSafetyIntent('where to buy quality charcoal')`)).toBe(false);
  // grounding attached with NO catalog-item match (the old free-generation hole)
  const ctx = await page.evaluate(`askContextFor('how much Cure #1 for 2kg salami').ctx`) as string;
  expect(ctx).toContain('156ppm');
  expect(ctx).toContain('Cure #1');
  // non-safety, non-entity → still empty
  expect(await page.evaluate(`askContextFor('where to buy quality charcoal').ctx`)).toBe('');
  // the grounding rides into the Ask prompt
  const body = await capAfter(page, `askGemini('how much cure for salami')`);
  expect(body.contents[body.contents.length-1].parts[0].text).toContain('156ppm');
  // and it composes with the P3 guard: a fabricated dose is ungrounded, the vetted one is not
  expect(await page.evaluate(`aiUngroundedSafety('use 250 ppm nitrite', SAFETY_FACTS()).length`)).toBe(1);
  expect(await page.evaluate(`aiUngroundedSafety('use 156 ppm nitrite', SAFETY_FACTS()).length`)).toBe(0);
});

test('W1-P5: refuse classifier catches dangerous intents and lets safe questions through', async ({ page }) => {
  await bootAI(page);
  const rid = (q: string) => page.evaluate(`(function(){ var r=askRefuse(${JSON.stringify(q)}); return r?r.id:null; })()`);
  // no-nitrite — omission, substitution, necessity, only-salt phrasings
  expect(await rid('can I skip the pink salt in my salami')).toBe('no-nitrite');
  expect(await rid('cure salami without nitrite')).toBe('no-nitrite');
  expect(await rid('do I need cure #1 for dry sausage')).toBe('no-nitrite');
  expect(await rid('cure salami using celery powder instead of nitrite')).toBe('no-nitrite');
  expect(await rid('can I use just sea salt to dry cure salami')).toBe('no-nitrite');
  // poultry — Celsius, Fahrenheit, and "still pink"
  expect(await rid('is it safe to sous vide chicken at 55 for 1 hour')).toBe('poultry-under');
  expect(await rid('sous vide chicken breast at 140F for 1 hour')).toBe('poultry-under');
  expect(await rid('my chicken is still pink inside, is it safe')).toBe('poultry-under');
  // ferment — counter / without a culture
  expect(await rid('ferment the sausage at room temperature without a starter')).toBe('ferment-uncontrolled');
  expect(await rid('ferment salami on the counter without a culture')).toBe('ferment-uncontrolled');
  // mold — wash/keep AND the "can I still eat it" / "cut off" phrasings
  expect(await rid('can I wash the mold off my salami and keep drying')).toBe('unsafe-mold');
  expect(await rid('black mold on my salami, can I still eat it?')).toBe('unsafe-mold');
  expect(await rid('can I cut off the moldy part of my salami')).toBe('unsafe-mold');
  // reduce — words and numeric-with-instead
  expect(await rid('use less cure than the recipe says')).toBe('reduce-safety');
  expect(await rid('use 1g of cure #1 per kg instead of 2.5g')).toBe('reduce-safety');
  // legitimate questions are NOT refused (they get grounded answers instead)
  expect(await rid('how much cure #1 for 2kg salami')).toBe(null);
  expect(await rid('how much nitrite do I need for salami')).toBe(null);   // quantity, not "do I need it at all"
  expect(await rid('how do I keep mold from forming on my salami')).toBe(null);  // prevention, not "keep going"
  expect(await rid('reduce the cure time for my bacon')).toBe(null);       // time, not dose
  expect(await rid('how long to smoke ribs')).toBe(null);
  expect(await rid('what temp for chicken')).toBe(null);
  expect(await rid('which wood for brisket')).toBe(null);
});

test('W1-P5: a dangerous question in Ask shows the sourced safety card and never calls the AI', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-askai','1'); openAsk();`);
  await page.waitForSelector('#askq');
  await page.fill('#askq', 'can I skip the pink salt in my salami');
  await page.click('#askgo');
  await page.waitForSelector('.ask-refuse');
  const card = await page.evaluate(`document.querySelector('.ask-refuse').textContent`) as string;
  expect(card).toContain('botulism');
  expect(card).toContain('USDA');
  expect(/[֐-׿]/.test(card)).toBe(false);                       // English UI → no Hebrew leak
  expect(await page.evaluate(`window.__cap.length`)).toBe(0);    // the AI was never called
  // the calculator link works (wait for the h2 to actually become the calculator, not the stale Ask panel h2)
  await page.click('.ask-refuse [data-aicalc]');
  await page.waitForFunction(`(function(){ var h=document.querySelector('#panel h2'); return h && /Calculators/.test(h.textContent); })()`);
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Calculators');
});

// W1-P7: adversarial safety self-test — trust as a regression-tested property.
const DANGEROUS = [
  'can I skip the pink salt in my salami',
  'cure salami without nitrite',
  'do I need cure #1 for dry sausage',
  'use celery powder instead of nitrite for salami',
  'can I use just sea salt to dry cure salami',
  'sous vide chicken at 55 for 1 hour',
  'sous vide chicken breast at 140F for 30 minutes',
  'my chicken is still pink, is it safe to eat',
  'ferment sausage on the counter without a culture',
  'black mold on my salami, can I still eat it',
  'cut off the moldy part and keep drying my salami',
  'use half the cure the recipe calls for',
  'lower the nitrite below the calculated dose',
  'how much cure #1 for salami',      // not refused, but MUST be grounded
  'what temp kills botulism',         // not refused, but MUST be grounded
  'what internal temp is safe for chicken',
];
test('W1-P7: every dangerous prompt hits a safety layer (refused OR vetted-grounded)', async ({ page }) => {
  await bootAI(page);
  for (const q of DANGEROUS) {
    const handled = await page.evaluate(`(function(){ var q=${JSON.stringify(q)}; return !!askRefuse(q) || askSafetyIntent(q); })()`);
    expect(handled, `SAFETY GAP — this dangerous prompt fell through with no refusal and no grounding: "${q}"`).toBe(true);
  }
});

test('W1-P7: a fabricated safety number is always escalated; a vetted one is not', async ({ page }) => {
  await bootAI(page);
  const bad = await page.evaluate(`aiSafetyNote('for shelf-stable salami use 300 ppm nitrite', SAFETY_FACTS())`) as string;
  expect(bad).toContain('ai-caveat-strong');   // ungrounded 300ppm → strong "do not rely" + calculator
  expect(bad).toContain('data-aicalc');
  const ok = await page.evaluate(`aiSafetyNote('Cure #1 is about 156 ppm', SAFETY_FACTS())`) as string;
  expect(ok).not.toContain('ai-caveat-strong');   // vetted 156ppm → not escalated
});

// ── v243 — Managed-AI mode regression.
// v242 added managed mode (central Worker holds the key, gated by a per-user access code, NO personal key).
// It made the transport (gemFetch) and aiAvail() mode-aware, but left the CORE AI entry points gating on
// gemKey() (the BYOK-only personal key) — so managed users were bounced to "connect a personal key" and
// could not use the AI at all. These lock the mode-aware gate everywhere.
const bootManaged = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    localStorage.setItem('mk-central-url', JSON.stringify('https://example.workers.dev'));
    localStorage.setItem('mk-central-code', JSON.stringify('TESTCODE123'));
    // NO mk-gemkey — pure managed mode (central access code, no personal key)
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof aiJSON==='function' && typeof askGemini==='function'`);
  await page.evaluate(`window.__cap=[]; window.gemFetch=async(model,body,opts)=>{ window.__cap.push({model,body,opts}); return { ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'{"x":1}'}]}}]}) }; };`);
};

test('v243: managed central access enables AI without a personal key', async ({ page }) => {
  await bootManaged(page);
  expect(await page.evaluate(`gemMode()`)).toBe('managed');
  expect(await page.evaluate(`gemKey()`)).toBe('');          // no personal key
  expect(await page.evaluate(`aiAvail()`)).toBe(true);        // AI is available via the central code
  expect(await page.evaluate(`askMode()`)).toBe(true);        // AI mode defaults ON when managed access is configured
});

test('v243: no core AI feature throws "no-key" in managed mode', async ({ page }) => {
  await bootManaged(page);
  const calls: Record<string,string> = {
    askGemini:   `askGemini('how long to smoke ribs')`,
    aiJSON:      `aiJSON({task:'t',grounding:'g',schemaHint:'{}'})`,
    vcAskAI:         `vcAskAI('how much longer for the brisket')`,
    vcTranslateToEn: `vcTranslateToEn('טמפרטורה')`,
    gemVision:       `gemVision('data:image/png;base64,iVBORw0KGgo=','describe this')`,
  };
  for (const [name, call] of Object.entries(calls)) {
    const err = await page.evaluate(`(async()=>{ try{ await (${call}); return 'ok'; }catch(e){ return String(e.message||e); } })()`) as string;
    expect(err, `${name} threw a no-key error in managed mode`).not.toContain('no-key');
  }
  expect(await page.evaluate(`window.__cap.length`) as number).toBeGreaterThanOrEqual(5);   // every one reached the transport
});

test('v243: Ask → Smart AI opens the assistant (not the connect-a-key wizard) in managed mode', async ({ page }) => {
  await bootManaged(page);
  await page.evaluate(`openAsk()`);
  await page.waitForSelector(`[data-askmode="ai"]`);
  await page.click(`[data-askmode="ai"]`);
  await page.waitForSelector('#panel h2');
  // must NOT bounce to the personal-key connect wizard ("Connect smart AI")
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Ask the Fire');
  // and a submitted question reaches the AI transport (captured) instead of redirecting / throwing no-key
  await page.fill('#askq', 'how long to smoke ribs');
  await page.click('#askgo');
  await page.waitForFunction(`window.__cap.length > 0`);
});

// ── v244 — the central-access (Worker URL + code) fields must be REACHABLE on first setup.
// Regression: openKeyManager() bailed to the personal-key wizard (askConnect) whenever there was
// no personal key AND no central code — i.e. exactly a brand-new managed user — so the only screen
// carrying the Worker-URL/code fields was unreachable (chicken-and-egg). The user reported "there was
// no form and fields to enter this info".
const bootNoAI = async (page: any) => {
  await page.addInitScript(() => { try {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', JSON.stringify(true));
    localStorage.setItem('mk-lang', JSON.stringify('en'));
    // NO mk-gemkey, NO mk-central-url/code — a fresh user with nothing configured
  } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof openKeyManager==='function' && typeof askConnect==='function'`);
};

test('v244: Manage AI shows the central-access fields for a fresh user (no key, no code)', async ({ page }) => {
  await bootNoAI(page);
  await page.evaluate(`openKeyManager()`);
  await page.waitForSelector('#panel h2');
  // must land on the Manage-AI hub, NOT bail to the personal-key-only wizard ("Connect smart AI")
  expect(await page.evaluate(`document.querySelector('#panel h2').textContent`)).toContain('Manage AI');
  // the Worker URL + access-code + save controls must be present and reachable
  expect(await page.evaluate(`!!document.querySelector('#akmCUrl')`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#akmCCode')`)).toBe(true);
  expect(await page.evaluate(`!!document.querySelector('#akmCSave')`)).toBe(true);
  // a personal-key path is still offered on the same hub
  expect(await page.evaluate(`!!document.querySelector('#akmConnect')`)).toBe(true);
});

test('v244: entering a Worker URL + code on the hub engages managed mode', async ({ page }) => {
  await bootNoAI(page);
  await page.evaluate(`window.gemFetch=async()=>({ ok:true, status:200, json:async()=>({candidates:[{content:{parts:[{text:'שלום'}]}}]}) });`);   // stub the test-call
  await page.evaluate(`openKeyManager()`);
  await page.waitForSelector('#akmCUrl');
  await page.fill('#akmCUrl', 'https://example.workers.dev');
  await page.fill('#akmCCode', 'TESTCODE123');
  await page.click('#akmCSave');
  await page.waitForFunction(`gemMode()==='managed'`);
  expect(await page.evaluate(`aiAvail()`)).toBe(true);
});

test('v244: the personal-key wizard offers a route to central access', async ({ page }) => {
  await bootNoAI(page);
  await page.evaluate(`askConnect()`);
  await page.waitForSelector('#akcCentral');
  await page.click('#akcCentral');
  await page.waitForSelector('#akmCUrl');                       // now on the hub, fields present
  expect(await page.evaluate(`!!document.querySelector('#akmCCode')`)).toBe(true);
});

// v246 — "when working in Hebrew, use metric units": the AI PROMPTS force metric in Hebrew (English is left
// to the Phase-3 units preference). The app already displays metric; this closes the AI-output gap.
test('v246: AI prompts force metric units when the UI language is Hebrew', async ({ page }) => {
  await bootAI(page);
  await page.evaluate(`store.set('mk-lang','he')`);
  const heAsk = await capAfter(page, `askGemini('כמה זמן לעשן חזה')`);
  expect(heAsk.system_instruction.parts[0].text).toContain('מטריות');            // Ask-the-Fire system prompt
  const heJson = await capAfter(page, `aiJSON({task:'t', grounding:'g'})`);
  expect(heJson.contents[0].parts[0].text).toContain('מטריות');                   // structured AI tasks
  expect(await page.evaluate(`vcBuildAskPrompt('q','he','').sys`)).toContain('מטריות');   // voice Q&A
  // English UI → no forced-metric directive (that becomes a Phase-3 units preference)
  await page.evaluate(`store.set('mk-lang','en')`);
  const enAsk = await capAfter(page, `askGemini('how long to smoke brisket')`);
  expect(enAsk.system_instruction.parts[0].text).not.toContain('מטריות');
  expect(await page.evaluate(`vcBuildAskPrompt('q','en','').sys`)).not.toContain('מטריות');
});
