// leak2-run.mjs — focused re-translation of the runtime-verified LEAK-2 seasoning prose set only
// (scratch/translate-bulk/leak2-set.json). Pivot en->target (§10.19), shipped prompt + a measure-keeping
// clause (translategemma converts "½ cup"->"125 ml"; the cook_measure gate now FAILS that, so we ask it to
// keep the measure word). Gates with the EXTENDED gates.mjs. Writes leak2-out.json {staged, failed}.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadShippedGuard, mtSafeFolded, hebrewLeak, unitLiteralCheck, safetyLexiconCheck } from '../translate-eval/gates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const LANGNAME = { fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', ru: 'Russian' };
const HOST = 'http://localhost:11434', MODEL = 'translategemma:27b';
const guard = loadShippedGuard(REPO);
const enData = JSON.parse(readFileSync(join(REPO, 'lang', 'en.data.json'), 'utf8'));
const rows = JSON.parse(readFileSync(join(HERE, 'leak2-set.json'), 'utf8'));

const CLAUSE = 'Keep cooking measures as the target language’s own words (tablespoon, teaspoon, cup) — do NOT convert them to millilitres, grams or any metric unit.';

async function translateOne(langName, sourceText) {
  const sys = `Translate the following English cooking text to ${langName}. Keep ALL numbers, temperatures, times and units EXACTLY as written — never change, add, or drop a number. Reply with ONLY the translation, no notes. ${CLAUSE}`;
  const res = await fetch(`${HOST}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: sys }, { role: 'user', content: sourceText }], stream: false, options: { temperature: 0.2, num_predict: 600 } }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  return (raw.message && raw.message.content || '').trim();
}
function gate(he, mt, lang) {
  const safe = mtSafeFolded(guard, he, mt), leak = hebrewLeak(mt), unit = unitLiteralCheck(he, mt), lex = safetyLexiconCheck(he, mt, lang);
  const f = []; if (!safe) f.push('mtSafe'); if (leak) f.push('hebrewLeak'); if (!unit.pass) f.push('unitLiteral'); if (!lex.pass) f.push('safetyLexicon');
  return { pass: f.length === 0, f, unit: unit.mismatches, lex: lex.failures };
}

const staged = [], failed = [];
for (const r of rows) {
  const en = enData[r.he] || r.en;
  const src = en || r.he;
  let mt = '', attempt = 0, g;
  for (attempt = 1; attempt <= 3; attempt++) {
    try { mt = await translateOne(LANGNAME[r.lang], src); } catch (e) { mt = ''; }
    g = gate(r.he, mt, r.lang);
    if (g.pass) break;
  }
  const rec = { lang: r.lang, id: r.id, field: r.field, he: r.he, en, [r.lang]: mt, attempts: attempt, gate: g };
  (g.pass ? staged : failed).push(rec);
  console.log(`${g.pass ? 'PASS' : 'FAIL'} [${r.lang}] ${r.id}.${r.field} (try ${attempt})  ${g.pass ? '' : g.f.join(',')}`);
}
writeFileSync(join(HERE, 'leak2-out.json'), JSON.stringify({ staged, failed }, null, 1));
console.log(`\nstaged=${staged.length} failed=${failed.length}`);
