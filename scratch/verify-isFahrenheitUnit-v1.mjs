// isFahrenheitUnit — enumerate every unit string the FIXED SAFETY_UNIT can actually emit (verified by
// testing candidates against the anchored pattern itself, not guessed), classify each with the new
// isFahrenheitUnit, and confirm the true-set is EXACTLY the genuine Fahrenheit spellings.

const NEW_DEG_FRAGMENT='deg(?:rees?)?(?:[ \\t]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|\\.?(?![A-Za-z]))';
const SAFETY_UNIT='(?:°\\s*[CF]?|[CF]\\b|ppm|%|מעלות|'+NEW_DEG_FRAGMENT+'|celsius|fahrenheit)';
function isEmittable(u){ return new RegExp('^(?:'+SAFETY_UNIT+')$','i').test(u); }
function isTempUnit(u){ return isEmittable(u) && !/^(?:ppm|%)$/i.test(String(u||'').trim()); }
function isFahrenheitUnit(u){
  return /^(?:°[ \t]*F|F|deg(?:rees?)?[ \t]*F|deg(?:rees?)?[ \t]*fahrenheit|fahrenheit)$/i.test(String(u||'').trim());
}

// Candidate generation — every combination the grammar's own shape suggests, then FILTER to only those
// the pattern itself actually accepts (empirical enumeration, not a guess).
const base = ['°','°C','°F','C','F','ppm','%','מעלות','celsius','fahrenheit'];
const degWords = ['deg','degree','degrees'];
const bareSuffix = ['','.'];
const unitLetters = ['C','F','celsius','fahrenheit'];
const spacing = ['',' '];

const candidates = new Set();
base.forEach(b=>candidates.add(b));
degWords.forEach(w=>bareSuffix.forEach(suf=>candidates.add(w+suf)));
degWords.forEach(w=>unitLetters.forEach(u=>spacing.forEach(sp=>candidates.add(w+sp+u))));
// also case variants that matter for Fahrenheit classification (case-insensitivity is the pattern's job,
// not the enumeration's — one representative case per form is enough since both isEmittable and
// isFahrenheitUnit are explicitly case-insensitive).

const emittable = [...candidates].filter(isEmittable).sort();
console.log('Total candidates generated:', candidates.size);
console.log('Total EMITTABLE (confirmed by the pattern itself):', emittable.length);
console.log('');
console.log('unit'.padEnd(22), 'isTempUnit'.padEnd(12), 'isFahrenheitUnit');
const fClassified = [];
for(const u of emittable){
  const t = isTempUnit(u), f = isFahrenheitUnit(u);
  console.log(JSON.stringify(u).padEnd(22), String(t).padEnd(12), String(f));
  if(f) fClassified.push(u);
}
console.log('');
console.log('Classified TRUE (Fahrenheit) — n=', fClassified.length, ':', JSON.stringify(fClassified));

console.log('');
console.log('=== required negatives (must ALL be false) ===');
const mustBeFalse = ['celsius','degrees celsius','deg','degrees','°','°C','ppm','%','מעלות'];
let fail=0;
for(const u of mustBeFalse){
  const f = isFahrenheitUnit(u);
  console.log((f===false?'PASS':'FAIL'), '- isFahrenheitUnit('+JSON.stringify(u)+') === false ->', f);
  if(f!==false) fail++;
}
console.log('');
console.log('=== required positives (spot-check genuine Fahrenheit spellings) ===');
const mustBeTrue = ['F','°F','deg F','degF','degrees F','degreesF','degrees fahrenheit','fahrenheit','Fahrenheit','DEG F'];
for(const u of mustBeTrue){
  const f = isFahrenheitUnit(u);
  console.log((f===true?'PASS':'FAIL'), '- isFahrenheitUnit('+JSON.stringify(u)+') === true ->', f);
  if(f!==true) fail++;
}
console.log('');
console.log(fail===0 ? 'ALL CHECKS PASSED' : (fail+' CHECK(S) FAILED'));
process.exit(fail===0?0:1);
