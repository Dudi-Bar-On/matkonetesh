// v7b — the CORRECTED fragment: relocate \.? into the no-unit-letter branch only, so the abbreviation
// period ("deg.") is still consumable, but a sentence-ending period can never let the unit-letter branch
// read across it (that reintroduction of FIX C defect 3 was confirmed empirically in v7).
// LITERAL (task-given, FAILED empirically in v7):
//   deg(?:rees?)?\.?(?:[ \t]*(?:C\b|F\b|celsius\b|fahrenheit\b)|(?![A-Za-z]))
// CORRECTED (this file):
//   deg(?:rees?)?(?:[ \t]*(?:C\b|F\b|celsius\b|fahrenheit\b)|\.?(?![A-Za-z]))

const SAFETY_NUM='(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const NEW_DEG_FRAGMENT='deg(?:rees?)?(?:[ \\t]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|\\.?(?![A-Za-z]))';
const SAFETY_UNIT='(?:°\\s*[CF]?|[CF]\\b|ppm|%|מעלות|'+NEW_DEG_FRAGMENT+'|celsius|fahrenheit)';
const SAFETY_TOKEN_SRC=
    '('+SAFETY_NUM+')\\s*[-–]\\s*('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
  + '|('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
  + '|\\bpH\\s*('+SAFETY_NUM+')';
function safetyTokenRe(){ return new RegExp(SAFETY_TOKEN_SRC, 'gi'); }
function safetyNumRe(){ return new RegExp(SAFETY_NUM, 'g'); }
function safetyNumVal(s){ return parseFloat(String(s).replace(/,/g,'')); }
function isTempUnit(u){ return new RegExp('^(?:'+SAFETY_UNIT+')$','i').test(String(u||'').trim()) && !/^(?:ppm|%)$/i.test(String(u||'').trim()); }
function aiSafetyToC(n, unit){
  if(isNaN(n)) return NaN;
  return /F/i.test(String(unit||'')) ? Math.round((n-32)*5/9) : n;
}
function aiSafetyNums(s){
  const out=[]; const str=String(s||''); let m; const re=safetyTokenRe();
  while((m=re.exec(str))!==null){
    if(m[1]!=null){
      const u=m[3]||'';
      const first=aiSafetyToC(safetyNumVal(m[1]), u), second=aiSafetyToC(safetyNumVal(m[2]), u);
      if(!isNaN(first)) out.push(first);
      if(!isNaN(second)) out.push(second);
    } else if(m[4]!=null){
      const n=aiSafetyToC(safetyNumVal(m[4]), m[5]||'');
      if(!isNaN(n)) out.push(n);
    } else if(m[6]!=null){
      const n=safetyNumVal(m[6]);
      if(!isNaN(n)) out.push(n);
    }
  }
  return out;
}

let fail=0;
function row(label, actual, expected){
  const a=JSON.stringify(actual), e=JSON.stringify(expected);
  const ok=a===e;
  console.log((ok?'PASS':'FAIL'), '-', label, '-> got', a, ok?'':(' expected '+e));
  if(!ok) fail++;
}

console.log('=== REGRESSION TASK TABLE (all rows) ===');
row('74 degrees',              aiSafetyNums('74 degrees'), [74]);
row('74 degree',               aiSafetyNums('74 degree'), [74]);
row('74 degrees Celsius',      aiSafetyNums('74 degrees Celsius'), [74]);
row('165 degrees Fahrenheit',  aiSafetyNums('165 degrees Fahrenheit'), [74]);
row('74 deg',                  aiSafetyNums('74 deg'), [74]);
row('74 deg.',                 aiSafetyNums('74 deg.'), [74]);
row('74 DEG',                  aiSafetyNums('74 DEG'), [74]);
row('74degC',                  aiSafetyNums('74degC'), [74]);
row('74degF',                  aiSafetyNums('74degF'), [23]);
row('2 degC',                  aiSafetyNums('2 degC'), [2]);
row('74degreesC',              aiSafetyNums('74degreesC'), [74]);
row('5 degradation events',    aiSafetyNums('5 degradation events'), []);
row('74degradation',           aiSafetyNums('74degradation'), []);
row('3 deg of freedom',        aiSafetyNums('3 deg of freedom'), [3]);
row('63 degrees. F is what the probe shows', aiSafetyNums('63 degrees. F is what the probe shows'), [63]);
{
  const out='slice at a 45 degree angle'.replace(safetyTokenRe(), function(){ return '[…]'; });
  row('angle spacing keeps the space', out, 'slice at a […] angle');
}

console.log('\n=== FULL EXISTING SUITE REGRESSION (every prior FIX-1/2/A/B/C case) ===');
row('hold at 74 degrees', aiSafetyNums('hold at 74 degrees'), [74]);
row('165 degrees Fahrenheit (sentence)', aiSafetyNums('165 degrees Fahrenheit'), [74]);
row('74 deg C', aiSafetyNums('74 deg C'), [74]);
row('165 deg F', aiSafetyNums('165 deg F'), [74]);
row('74°F is safe for chicken', aiSafetyNums('74°F is safe for chicken'), [23]);
row('cook the breast to 165°F', aiSafetyNums('cook the breast to 165°F'), [74]);
row('range with pct', aiSafetyNums('ירידה 30-40%'), [30,40]);
row('spores range', aiSafetyNums('spores are destroyed at 100-121°C'), [100,121]);
row('hebrew maalot', aiSafetyNums('הטמפ׳ הבטוחה היא 74 מעלות'), [74]);
row('cure ppm', aiSafetyNums('cure #1 at 156 ppm'), [156]);
row('ph', aiSafetyNums('ferment to pH 5.3'), [5.3]);
row('pct salt', aiSafetyNums('use 2.5% salt'), [2.5]);
row('no numbers negative', aiSafetyNums('rest it a while, then slice thin'), []);
row('comma thousands', aiSafetyNums('sear at 1,063°C'), [1063]);
row('hebrew decimal comma', aiSafetyNums('63,5°C'), [5]);
row('mixed range single', aiSafetyNums('cure 156 ppm, then dry until 30-40% weight loss'), [156,30,40]);
{
  const leak='Botulism spores are destroyed at 121 degrees Celsius; the toxin breaks down near 85 degrees.';
  const nums=aiSafetyNums(leak);
  console.log((nums.length>0?'PASS':'FAIL'),'- word-form leak sentence still extracts numbers ->', JSON.stringify(nums));
}
for(const r of ['63-74°C','63°C-74°C','between 63°C and 74°C','between 63 and 74°C','63 to 74°C']){
  const digitRuns=(r.match(safetyNumRe())||[]).length;
  console.log('digitRuns for range "'+r+'" =', digitRuns, '(expect >=2, forces redact-all branch)');
}

console.log('\n=== isTempUnit over an enumeration of plausible emittable units ===');
for(const u of ['°','°C','°F','C','F','מעלות','degrees','degree','degrees celsius','degrees fahrenheit','deg','deg.','deg C','deg F','degC','degF','degreesC','degreesF','celsius','fahrenheit']){
  console.log('isTempUnit('+JSON.stringify(u)+') =', isTempUnit(u));
}
console.log('isTempUnit("ppm") =', isTempUnit('ppm'), '(expect false)');
console.log('isTempUnit("%") =', isTempUnit('%'), '(expect false)');

console.log('\n'+(fail===0?'ALL REQUIRED-TABLE ROWS PASS':(fail+' FAILED')));
process.exit(fail===0?0:1);
