// Proves, BY EXECUTION, the task brief's point-3 warning: narrowing SAFETY_UNIT's degree-symbol branch
// from `\s*` to `[^\S\r\n]*` (to make it "consistent" with the deg-branch / isFahrenheitUnit) does NOT
// close the 1b248a1 leak — it relocates it to a different mechanism. Run: node scratch/verify-1b248a1-leak-v1.js

function esc(s){ return JSON.stringify(s); }

// ---- shared pieces (unchanged by either variant) ----
const SAFETY_NUM='(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
function safetyNumVal(s){ return parseFloat(String(s).replace(/,/g,'')); }

// FIXED isFahrenheitUnit (the actual shipped fix — whitespace-agnostic classifier)
function isFahrenheitUnit_FIXED(u){
  const s=String(u||'').replace(/\s+/g,'');
  return /^(?:°?F|deg(?:rees?)?(?:F|fahrenheit)|fahrenheit)$/i.test(s);
}
function aiSafetyToC(n, unit, isF){
  if(isNaN(n)) return NaN;
  return isF(unit) ? Math.round((n-32)*5/9) : n;
}

function makeAiSafetyNums(SAFETY_UNIT, isF){
  const SAFETY_TOKEN_SRC=
      '('+SAFETY_NUM+')\\s*[-–]\\s*('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
    + '|('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
    + '|\\bpH\\s*('+SAFETY_NUM+')';
  function safetyTokenRe(){ return new RegExp(SAFETY_TOKEN_SRC, 'gi'); }
  return function aiSafetyNums(s){
    const out=[]; const str=String(s||''); let m; const re=safetyTokenRe();
    while((m=re.exec(str))!==null){
      if(m[1]!=null){
        const u=m[3]||'';
        const first=aiSafetyToC(safetyNumVal(m[1]), u, isF), second=aiSafetyToC(safetyNumVal(m[2]), u, isF);
        if(!isNaN(first)) out.push(first);
        if(!isNaN(second)) out.push(second);
      } else if(m[4]!=null){
        const n=aiSafetyToC(safetyNumVal(m[4]), m[5]||'', isF);
        if(!isNaN(n)) out.push(n);
      } else if(m[6]!=null){
        const n=safetyNumVal(m[6]);
        if(!isNaN(n)) out.push(n);
      }
    }
    return out;
  };
}

// ---- Variant A: the ACTUAL SHIPPED fix — ° branch keeps its deliberately-broad `\s*` ----
const SAFETY_UNIT_CORRECT='(?:°\\s*[CF]?|[CF]\\b|ppm|%|מעלות|deg(?:rees?)?(?:[^\\S\\r\\n]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|\\.?(?![A-Za-z]))|celsius|fahrenheit)';
const aiSafetyNums_CORRECT = makeAiSafetyNums(SAFETY_UNIT_CORRECT, isFahrenheitUnit_FIXED);

// ---- Variant B: THE TRAP — ° branch "narrowed for consistency" to [^\S\r\n]* like its siblings ----
const SAFETY_UNIT_TRAPPED='(?:°[^\\S\\r\\n]*[CF]?|[CF]\\b|ppm|%|מעלות|deg(?:rees?)?(?:[^\\S\\r\\n]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|\\.?(?![A-Za-z]))|celsius|fahrenheit)';
const aiSafetyNums_TRAPPED = makeAiSafetyNums(SAFETY_UNIT_TRAPPED, isFahrenheitUnit_FIXED);

console.log('=== Point-3 trap check: "74°\\nF" (degree symbol, then a literal newline, then F) ===\n');

const input = '74°\nF';
const correctResult = aiSafetyNums_CORRECT(input);
const trappedResult = aiSafetyNums_TRAPPED(input);

console.log('input:', esc(input));
console.log('SHIPPED FIX  (° branch keeps \\s*)         -> aiSafetyNums ->', JSON.stringify(correctResult), correctResult[0]===23?'(correctly converted to 23, no leak)':'(UNEXPECTED)');
console.log('THE TRAP     (° branch narrowed to [^\\S\\r\\n]*) -> aiSafetyNums ->', JSON.stringify(trappedResult), trappedResult[0]===74?'(LEAK: raw 74 unconverted — the trap reopens the leak by a DIFFERENT mechanism)':'(unexpected)');

// Show exactly WHERE the trap fails: what unit token does SAFETY_UNIT_TRAPPED's ° branch actually capture?
const trapUnitRe = new RegExp('°[^\\S\\r\\n]*[CF]?', 'g');
const trapMatch = trapUnitRe.exec(input);
console.log('\nDiagnostic — what does the TRAPPED °-branch itself match against "74°\\nF"?');
console.log('  match:', trapMatch ? esc(trapMatch[0]) : '(no match)', '<- note: NOT "°\\nF", because [^\\S\\r\\n]* cannot cross the \\n, so [CF]? finds no letter adjacent and matches empty.');
console.log('  -> the unit token is bare "°", isFahrenheitUnit("°") =', isFahrenheitUnit_FIXED('°'), '(false) -> number passes through UNCONVERTED.');
console.log('  -> the "F" is left as ordinary prose text, never bound to any number at all.');

console.log('\n=== CONCLUSION ===');
if (correctResult[0]===23 && trappedResult[0]===74) {
  console.log('CONFIRMED BY EXECUTION: narrowing the °-branch to [^\\S\\r\\n]* does NOT close the leak.');
  console.log('It relocates it — the number is still spoken unconverted, just via a different regex path');
  console.log('(a truncated unit match "°" instead of a misclassified unit "°\\nF"). The shipped fix (widen');
  console.log('isFahrenheitUnit, leave the °-branch\'s \\s* alone) is the only one of the two that actually works.');
  process.exit(0);
} else {
  console.log('UNEXPECTED — the prediction did not hold; re-examine before trusting either variant.');
  process.exit(1);
}
