// Task 1 · §3.5 live measurement — the safety-claim classifier, standalone against the real API.
// Mirrors the request shape vcClassifySafetyClaims (app.js, ~line 7797) builds: same system prompt,
// same responseSchema, same generationConfig (temperature:0, maxOutputTokens:8192, thinkingLevel:'high',
// NO google_search — AI_SEARCH.safetyClass==='never'). This script does NOT touch app.js or the running
// product; it is read-only measurement input for the Task 1 report and a baseline for Task 3 (D11).
//
// Run:  GEMINI_API_KEY read from process.env only — never printed, logged, or committed.
//   $env:GEMINI_API_KEY=[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User'); node scratch/voice-governance/classifier-probe.mjs

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY not set in env — aborting (no key printed).'); process.exit(1); }

const MODEL = 'gemini-3.6-flash';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const REPEATS = 3;

const SAFETY_CLAIM_KINDS = ['internal_safe_temp','internal_target_temp','chamber_temp','bath_temp',
  'surface_temp','duration','cure_ppm','weight','spacing','other'];
const SAFETY_CLAIM_UNITS = ['C','F','min','h','ppm','g_per_kg','g','kg','cm','in'];
const SAFETY_CLAIM_SCHEMA = {
  type:'OBJECT',
  properties:{ claims:{ type:'ARRAY', items:{
    type:'OBJECT',
    properties:{
      text:{type:'STRING'}, kind:{type:'STRING', enum:SAFETY_CLAIM_KINDS},
      value:{type:'NUMBER'}, unit:{type:'STRING', enum:SAFETY_CLAIM_UNITS},
      subject:{ type:'OBJECT', properties:{
        item:{type:'STRING', nullable:true}, category:{type:'STRING', nullable:true},
        form:{type:'STRING', enum:['whole','ground','unknown']} },
        required:['form'] },
      confidence:{type:'NUMBER'}
    },
    required:['text','kind','value','unit','confidence']
  }}},
  required:['claims']
};
const SAFETY_CLAIM_SYS =
  'You are a strict extractor, not an advisor. You are given a cooking answer. For EVERY number in it '+
  'that carries a unit, emit ONE claim describing what that number REFERS TO. `text` MUST be the number '+
  'token copied byte-for-byte from the answer, including its unit. Never invent, merge, split, convert '+
  'or reword a number. `kind` classifies the ROLE: internal_safe_temp = the minimum safe internal '+
  'temperature of the food; internal_target_temp = a doneness/texture internal target; chamber_temp = '+
  'smoker/oven/pit air temperature; bath_temp = sous-vide water bath; surface_temp = sear/grate surface; '+
  'duration = a time; cure_ppm = curing-salt nitrite concentration; weight/spacing = mass or distance. '+
  'Use "other" when you are not sure. `confidence` is your own certainty in the kind, 0..1. '+
  'Return ONLY the JSON object. No prose, no markdown.';

// 8 real answers — Hebrew + English, including the D3 smoking-answer shape from the spec (§5.3 example:
// chamber temp + duration + internal safe temp all in one sentence).
const ANSWERS = [
  { id:'D3-smoke-he', lang:'he', text:'עשן את הבריסקט בתא בטמפרטורה של 110°C במשך כ-6 שעות, עד שהטמפ׳ הפנימית מגיעה ל-71°C.' },
  { id:'sous-vide-en', lang:'en', text:'Cook the chicken breast sous vide at a bath temperature of 60°C for 90 min, then sear at a surface temp around 230°C for 45 seconds per side.' },
  { id:'cure-he', lang:'he', text:'להשתמש ב-156 ppm חנקתי לק"ג בשר, לתבל ולהניח למנוחה 24 שעות במקרר לפני העישון.' },
  { id:'ground-beef-en', lang:'en', text:'Ground beef patties need an internal safe temperature of 71°C — do not rely on color alone.' },
  { id:'mixed-category-he', lang:'he', text:'מה הטמפרטורה הבטוחה לבקר?' },
  { id:'spacing-en', lang:'en', text:'Leave at least 2.5 cm of spacing between racks in the smoker chamber, running at 107°C for 8 h.' },
  { id:'no-number-he', lang:'he', text:'תן לבשר לנוח בטמפרטורת החדר לפני הבישול, אין צורך במדחום.' },
  { id:'whole-poultry-en', lang:'en', text:'A whole chicken must reach an internal safe temperature of 74°C in the thickest part of the thigh, roasted at a chamber temp of 200°C for about 90 min.' },
];

function median(arr){ const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }

async function callOnce(text){
  const body = {
    system_instruction:{parts:[{text:SAFETY_CLAIM_SYS}]},
    contents:[{role:'user',parts:[{text}]}],
    generationConfig: {
      temperature:0, maxOutputTokens:8192,
      thinkingConfig:{ thinkingLevel:'high' },
      responseMimeType:'application/json', responseSchema:SAFETY_CLAIM_SCHEMA
    }
  };
  const t0 = Date.now();
  const r = await fetch(URL, { method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':KEY}, body: JSON.stringify(body) });
  const ms = Date.now() - t0;
  if(!r.ok) return { ms, ok:false, status:r.status, finishReason:null, parsed:false, claimCount:0, droppedCount:0 };
  const j = await r.json();
  const cand = j && j.candidates && j.candidates[0];
  const finishReason = cand && cand.finishReason;
  const rawText = cand && cand.content && (cand.content.parts||[]).map(p=>p.text||'').join('');
  let parsed = false, claims = [];
  try{ const obj = JSON.parse(rawText); if(obj && Array.isArray(obj.claims)){ parsed = true; claims = obj.claims; } }catch(e){}
  return { ms, ok:true, status:r.status, finishReason, parsed, claimCount: claims.length, claims };
}

async function main(){
  console.log(`classifier-probe · model=${MODEL} thinkingLevel=high maxOutputTokens=8192 repeats=${REPEATS}\n`);
  const rows = [];
  for(const a of ANSWERS){
    for(let i=0;i<REPEATS;i++){
      let res;
      try{ res = await callOnce(a.text); }
      catch(e){ res = { ms:null, ok:false, status:'ERR', finishReason:null, parsed:false, claimCount:0, error:String(e && e.message || e) }; }
      rows.push({ id:a.id, lang:a.lang, rep:i+1, ...res });
      const tag = res.ok ? (res.parsed ? `parsed claims=${res.claimCount}` : 'UNPARSEABLE-JSON') : `HTTP-FAIL ${res.status}`;
      console.log(`${a.id}#${i+1}: ms=${res.ms} finishReason=${res.finishReason} ${tag}`);
    }
  }
  const oks = rows.filter(r=>r.ok);
  const parseFails = rows.filter(r=>r.ok && !r.parsed);
  const nonStop = rows.filter(r=>r.ok && r.finishReason!=='STOP');
  const times = oks.filter(r=>typeof r.ms==='number').map(r=>r.ms);
  console.log('\n── summary ──');
  console.log(`calls: ${rows.length}  http-ok: ${oks.length}  finishReason!=STOP: ${nonStop.length}  JSON-parse failures: ${parseFails.length}`);
  console.log(`median latency (ms): ${times.length ? median(times) : 'n/a'}`);
  console.log(`min/max (ms): ${times.length ? Math.min(...times)+'/'+Math.max(...times) : 'n/a'}`);
  // Validation drop rate: of all emitted claims across ok+parsed calls, how many are per-item so a human
  // can spot-check plausibility (full byte-for-byte token/schema validation is vcBuildClaimMap's job,
  // exercised in tests/vg-classifier.spec.ts — this script measures the RAW model behaviour only).
  const totalClaims = oks.filter(r=>r.parsed).reduce((n,r)=>n+r.claimCount, 0);
  console.log(`total claims emitted across parsed responses: ${totalClaims}`);
}

main().catch(e => { console.error('probe failed:', e && e.message || e); process.exit(1); });
