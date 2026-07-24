// Regression fix v7 — verify the task-specified SAFETY_UNIT replacement fragment BEFORE touching app.js.
// Task's literal replacement (both the "degrees?..." and "deg\\b..." alternatives collapsed into ONE):
//   deg(?:rees?)?\.?(?:[ \t]*(?:C\b|F\b|celsius\b|fahrenheit\b)|(?![A-Za-z]))

const SAFETY_NUM='(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const NEW_DEG_FRAGMENT='deg(?:rees?)?\\.?(?:[ \\t]*(?:C\\b|F\\b|celsius\\b|fahrenheit\\b)|(?![A-Za-z]))';
const SAFETY_UNIT='(?:°\\s*[CF]?|[CF]\\b|ppm|%|מעלות|'+NEW_DEG_FRAGMENT+'|celsius|fahrenheit)';
const SAFETY_TOKEN_SRC=
    '('+SAFETY_NUM+')\\s*[-–]\\s*('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
  + '|('+SAFETY_NUM+')\\s*('+SAFETY_UNIT+')'
  + '|\\bpH\\s*('+SAFETY_NUM+')';
function safetyTokenRe(){ return new RegExp(SAFETY_TOKEN_SRC, 'gi'); }
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

console.log('=== task table rows, literal fragment as given ===');
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
console.log('\nangle spacing check (vcMapSafetyNums-equivalent via direct replace):');
{
  const out='slice at a 45 degree angle'.replace(safetyTokenRe(), function(){ return '[…]'; });
  console.log('->', JSON.stringify(out));
  row('angle spacing keeps the space', out, 'slice at a […] angle');
}
console.log('\n'+(fail===0?'ALL PASS':(fail+' FAILED')));
process.exit(fail===0?0:1);
