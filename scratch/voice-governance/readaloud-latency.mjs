// Task 3 · D11 live measurement — read-aloud (steps/timers/schedule) TTS latency, unaffected by the R-62
// classifier wiring. Mirrors gemSpeakSegStream's exact request shape (app.js ~6923: streamGenerateContent,
// responseModalities:['AUDIO'], the SAME model/voice the read-aloud path uses) so this measures the SAME
// wire the app's own vcSpeakContent/vcSpeak ultimately drive. This script does NOT touch app.js or the
// running product — read-only measurement input for the Task 3 report (D11).
//
// "firstSound" proxy: time from request-send to the first SSE data frame carrying inlineData audio bytes.
// gemPlayPcmStream's own firstAudio mark fires immediately on receiving that same first chunk (app.js:6964,
// `Math.max(ctx.currentTime+0.05, cursor)` — a fixed ~50ms scheduling floor, not a variable cost), so the
// network time to first chunk is the dominant, honestly-comparable component of firstSound.
//
// Run:  GEMINI_API_KEY read from process.env only — never printed, logged, or committed.
//   $env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User'); node scratch/voice-governance/readaloud-latency.mjs

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY not set in env — aborting (no key printed).'); process.exit(1); }

const MODEL = 'gemini-3.1-flash-tts-preview';   // GEM_MODELS.tts.id, app.js:5510
const VOICE = 'Kore';                            // GEM_MODELS.tts.voiceDefault, app.js:5510
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;
const REPEATS = 10;
const SENTENCE = 'הוצא את החזה מהמעשנה ועטוף אותו בנייר קצבים למנוחה של שעה.';   // one fixed step-readout sentence

async function oneRun() {
  const body = {
    contents: [{ role: 'user', parts: [{ text: SENTENCE }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      maxOutputTokens: 8192,
    },
  };
  const t0 = performance.now();
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // A frame with actual inline audio bytes — the SAME signal gemPlayPcmStream's schedule() reacts to.
    if (/"inlineData"|"inline_data"/.test(buf)) {
      const dt = performance.now() - t0;
      try { reader.cancel(); } catch (e) {}
      return dt;
    }
    // bound the scan buffer — never let one slow run hold megabytes just to find the first frame
    if (buf.length > 200000) buf = buf.slice(-50000);
  }
  throw new Error('stream ended with no audio frame observed');
}

(async () => {
  const samples = [];
  for (let i = 0; i < REPEATS; i++) {
    try {
      const ms = await oneRun();
      samples.push(ms);
      console.log(`run ${i + 1}/${REPEATS}: ${ms.toFixed(0)}ms`);
    } catch (e) {
      console.log(`run ${i + 1}/${REPEATS}: FAILED — ${e && e.message}`);
    }
    await new Promise((res) => setTimeout(res, 400));   // small gap between requests, not a rate-limit dodge
  }
  if (!samples.length) { console.error('no successful runs'); process.exit(1); }
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
  const baseline = 1101;
  const pct = ((median - baseline) / baseline) * 100;
  console.log('---');
  console.log(`n=${samples.length} median firstSound(proxy) = ${median.toFixed(0)}ms`);
  console.log(`baseline (documented, R-39) = ${baseline}ms`);
  console.log(`delta = ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%  (threshold: ±15%)`);
  console.log(pct > 15 || pct < -15 ? 'REGRESSION — outside ±15%' : 'within threshold');
})();
