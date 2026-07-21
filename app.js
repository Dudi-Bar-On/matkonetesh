
const DATA = __DATA__;
const $ = s=>document.querySelector(s);

/* ---------- helpers ---------- */
function upperHours(h){ // "24-30"->30 , "0.75"->0.75
  if(typeof h!=='string') return parseFloat(h)||0;
  const parts = h.replace(/[^0-9.\-]/g,'').split('-').filter(Boolean);
  if(!parts.length) return 0;
  return parseFloat(parts[parts.length-1])||0;
}
function dots(d){let o='<span class="dots">';for(let i=1;i<=5;i++)o+=`<span class="dot ${i<=d?'f':''}"></span>`;return o+'</span>';}
const PREP_TREAT=["צינון","צינון מלא","ייבוש","ייבוש עור","קילוף קרום","דקירת עור+ניקוז","חריטת עור","ניקוז שומן","הפיכת עור"];
const FINISH_TREAT=["גלייז","מריחה","הפיכה","סיבוב שיפוד"];

const ALT_RUB = {
 "בקר":["קופי-בארק","שפשוף אספרסו טחון + קקאו + סוכר חום + מלח ופלפל גס — קרום כהה ועמוק עם מרירות מאוזנת. שמור על אותם זמנים וטמפ'."],
 "חזיר":["מייפל-חרדל","חרדל דיז'ון כשכבת הדבקה, ומעליו סירופ מייפל + פפריקה מעושנת + מעט קיין. מתוק-חמצמץ קלאסי לחזיר."],
 "טלה":["הריסה-נענע","הריסה + שום כתוש + כמון + נענע יבשה + שמן זית. גוון צפון-אפריקאי שמתאים לשומן של הטלה."],
 "עוף":["לימון-שום-טימין","גרידת לימון + שום + טימין + מלח + פלפל לבן. נקי ורענן, מבליט עור פריך."],
 "הודו":["חמאת מרווה-תפוז","חמאה רכה + מרווה קצוצה + גרידת תפוז מתחת לעור. שומר על לחות בנתח הרזה."],
 "אווז":["חמש-תבלינים ודבש","חמישה תבלינים סיני + דבש + סויה. מאזן את השומן העשיר עם מתיקות ארומטית."],
 "ברווז":["חמש-תבלינים ודבש","חמישה תבלינים סיני + דבש + סויה. מאזן את השומן העשיר עם מתיקות ארומטית."],
 "דג":["מיסו-מייפל","מריחת מיסו לבן + מייפל + מעט סויה לפני העישון — אומאמי וברק יפהפה."],
 "_default":["שום-עשבים","שמן זית + שום + עשבי תיבול טריים. פשוט ועובד כמעט על הכל."]   // generic fallback alt-rub (was keyed "מעורב" — a phantom category now removed)
};

/* ---------- method-toggle engine (Phase 1) ---------- */
// Each cut gets allowed toggles + a recommended default combo + validation rules.
// Toggles: sv (סו-ויד), smoke (עישון), grill (גריל/צריבה ישירה)
// ── user equipment ("הציוד שלי") — device model is EQUIP_CATS + the mk-equipment list (defined below) ──
function gearConfigured(){ return equipConfigured(); }
// ── Equipment 2.0 · mk-equipment device LIST (source of truth; replaces the flat mk-gear) ──
const EQUIP_CATS=[
  {cat:'smoker', he:'מעשנה', en:'Smoker', icon:'💨', acc:'#9a6a3a', accL:'#f4e6d6', capEm:'🗄️', types:['ארון / קבינט','אופסט / סטיק-ברנר','פלטים','קמאדו / קרמי','WSM / חבית','קטל (ככלי עישון)','גז (עם תיבת עשן)','חשמלי'], capKey:'racks', capHe:'מדפים/שבכות', capEn:'racks/grates',
   props:[
    {key:'areaCm2', he:'שטח בישול כולל', en:'Total cooking area', kind:'num', unit:'ס״מ²', em:'📐', tier:'core',
     bounds:[200,40000], alt:['in2->cm2','m2->cm2','ft2->cm2'],
     def:{'ארון / קבינט':6000,'אופסט / סטיק-ברנר':5000,'פלטים':3700,'קמאדו / קרמי':1650,
          'WSM / חבית':3300,'קטל (ככלי עישון)':2400,'גז (עם תיבת עשן)':3500,'חשמלי':4400}},
    {key:'maxC',     he:'טמפ׳ מרבית',  en:'Max temp',  kind:'num',  unit:'°C', em:'🌡️', tier:'core', bounds:[40,600], alt:['F->C'],
     def:{'חשמלי':135,'ארון / קבינט':150,'פלטים':260,'קמאדו / קרמי':350,'אופסט / סטיק-ברנר':300,'WSM / חבית':150,'קטל (ככלי עישון)':300,'גז (עם תיבת עשן)':260}},
    {key:'canHang',  he:'אפשר לתלות',  en:'Can hang',  kind:'bool', em:'🪝', tier:'core',
     def:{'ארון / קבינט':true,'WSM / חבית':true,'קטל (ככלי עישון)':false,'פלטים':false}},
    {key:'hooks',    he:'מספר ווים',   en:'Hooks',     kind:'num',  em:'🪝', tier:'pro', bounds:[1,200], alt:[]},
    {key:'waterPan', he:'מגש מים מובנה',en:'Water pan', kind:'bool', em:'💧', tier:'pro',
     def:{'ארון / קבינט':true,'WSM / חבית':true}},
   ]},
  {cat:'grill', he:'גריל', en:'Grill', icon:'🔥', acc:'#e76f51', accL:'#f9ddd3', capEm:'🔥', types:['פחם','גז','קטל','פלנצ׳ה / פלטה','לבה / אינפרא'], capKey:'zones', capHe:'אזורי חום', capEn:'heat zones',
   props:[
    {key:'areaCm2',    he:'שטח צלייה כולל', en:'Total grilling area', kind:'num', unit:'ס״מ²', em:'📐', tier:'core',
     bounds:[200,40000], alt:['in2->cm2','m2->cm2','ft2->cm2'],
     def:{'פחם':2000,'גז':2800,'קטל':2400,'פלנצ׳ה / פלטה':1800,'לבה / אינפרא':1500}},
    {key:'lid',        he:'מכסה',        en:'Lid',        kind:'bool', em:'🔒', tier:'core',
     def:{'פלנצ׳ה / פלטה':false,'לבה / אינפרא':false,'פחם':true,'גז':true,'קטל':true}},
    {key:'maxC',       he:'טמפ׳ מרבית',  en:'Max temp',   kind:'num', unit:'°C', em:'🌡️', tier:'pro', bounds:[40,600], alt:['F->C'],
     def:{'גז':300,'פחם':400,'קטל':350,'פלנצ׳ה / פלטה':300,'לבה / אינפרא':500}},
    {key:'rotisserie', he:'שיפוד מסתובב',en:'Rotisserie', kind:'bool', em:'🔄', tier:'pro'},
   ]},
  {cat:'oven', he:'תנור', en:'Oven', icon:'♨️', acc:'#f4a261', accL:'#fde9d6', capEm:'🗄️', types:['ביתי','דק','פיצה'], capKey:'racks', capHe:'מדפים', capEn:'racks',
   props:[
    {key:'areaCm2', he:'שטח בישול כולל', en:'Total cooking area', kind:'num', unit:'ס״מ²', em:'📐', tier:'core',
     bounds:[200,40000], alt:['in2->cm2','m2->cm2','ft2->cm2'],
     def:{'ביתי':4400,'דק':3000,'פיצה':1600}},
    {key:'maxC',  he:'טמפ׳ מרבית', en:'Max temp', kind:'num', unit:'°C', em:'🌡️', tier:'core', bounds:[40,600], alt:['F->C'],
     def:{'ביתי':275,'דק':400,'פיצה':500}},
    {key:'fan',   he:'טורבו',      en:'Fan',      kind:'bool', em:'🌀', tier:'pro', def:{'ביתי':true}},
    {key:'steam', he:'אדים',       en:'Steam',    kind:'bool', em:'♨️', tier:'pro'},
   ]},
  {cat:'sousvide', he:'סו-ויד', en:'Sous-vide', icon:'🌊', acc:'#2b7fb8', accL:'#dcecf6', capEm:'', types:['טבילה (immersion)','מיכל ייעודי'], capKey:null, multiCap:{key:'baths', he:'נפחי אמבט (ל׳)', en:'Bath sizes (L)', uHe:'ל׳', uEn:'L', em:'🛁'},
   props:[
    {key:'maxL',  he:'נפח מרבי',   en:'Max volume', kind:'num', unit:'ל׳', em:'🪣', tier:'core', bounds:[2,60], alt:['qt->L','gal->L'],
     def:{'טבילה (immersion)':20,'מיכל ייעודי':12}},
    {key:'watts', he:'הספק',       en:'Power',      kind:'num', unit:'W',  em:'⚡', tier:'pro', bounds:[100,3000], alt:[], def:1000},
    {key:'maxC',  he:'טמפ׳ מרבית', en:'Max temp',   kind:'num', unit:'°C', em:'🌡️', tier:'pro', bounds:[40,600], alt:['F->C'], def:95},
   ]},
  {cat:'vacuum', he:'ואקום', en:'Vacuum', icon:'🗜️', acc:'#7a8a5c', accL:'#e6ecda', capEm:'', types:['שקית חיצונית (edge)','חדר (chamber)','ידני / משאבה'], capKey:null,
   props:[
    {key:'bagW',    he:'רוחב איטום', en:'Seal width', kind:'num', unit:'ס״מ', em:'📏', tier:'core', bounds:[10,60], alt:['mm->cm','in->cm'],
     def:{'שקית חיצונית (edge)':30,'חדר (chamber)':30,'ידני / משאבה':25}},
    {key:'bagKind', he:'סוג שקיות',  en:'Bag type',   kind:'choice', em:'📦', tier:'core', def:'both',
     opts:[{v:'roll',he:'גליל לחיתוך',en:'Cuttable roll'},{v:'bags',he:'שקיות חתוכות',en:'Pre-cut bags'},{v:'both',he:'שניהם',en:'Both'}]},
    {key:'pulse',   he:'מצב לח/פולס', en:'Pulse/moist', kind:'bool', em:'〰️', tier:'pro', def:{'חדר (chamber)':true}},
   ]},
  {cat:'probe', he:'מדחום', en:'Probe', icon:'🌡️', acc:'#1a9a7a', accL:'#d8f0e8', capEm:'🔌', types:['מיידי (instant-read)','פרוב נעוץ','פרוב אלחוטי','בקר-מאוורר'], capKey:'channels', capHe:'ערוצים', capEn:'channels',
   props:[
    {key:'maxC',     he:'טמפ׳ מרבית', en:'Max temp', kind:'num', unit:'°C',  em:'🌡️', tier:'pro', bounds:[40,600], alt:['F->C'], def:300},
    {key:'accuracy', he:'דיוק',       en:'Accuracy', kind:'num', unit:'±°C', em:'🎯', tier:'pro', bounds:[0.1,5], alt:['Fdeg->Cdeg'], def:1},
   ]},
  {cat:'grinder', he:'מטחנת בשר', en:'Grinder', icon:'🥩', acc:'#b5651d', accL:'#f6e3cf', capEm:'', types:['ייעודית','מתאם למיקסר'], capKey:null, multiCap:{key:'plates', he:'פלטות טחינה (מ״מ)', en:'Grinder plates (mm)', uHe:'מ״מ', uEn:'mm', em:'⚙️'},
   props:[
    {key:'throughput', he:'תפוקה', en:'Throughput', kind:'num', unit:'ק״ג/דק׳', em:'⏱️', tier:'pro', bounds:[0.1,20], alt:['lb->kg'],
     def:{'ייעודית':2,'מתאם למיקסר':0.7}},
   ]},
  {cat:'stuffer', he:'מכונת מילוי', en:'Stuffer', icon:'🌭', acc:'#b5651d', accL:'#f6e3cf', capEm:'🛢️', types:['אנכית','אופקית','מזרק / משפך ידני'], capKey:'volume', capHe:'נפח צילינדר (ל׳)', capEn:'cylinder (L)', multiCap:{key:'nozzles', he:'קטרי פייה (מ״מ)', en:'Output sizes (mm)', uHe:'מ״מ', uEn:'mm', em:'🔩'},
   props:[
    {key:'speed', he:'מהירויות', en:'Speeds', kind:'choice', em:'⚙️', tier:'pro',
     opts:[{v:'1',he:'מהירות אחת',en:'Single'},{v:'2',he:'שתי מהירויות',en:'Two-speed'}]},
   ]},
  {cat:'other', he:'אחר', en:'Other', icon:'🧰', acc:'#8a6f5c', accL:'#efe6dd', capEm:'', types:[], capKey:null},
];
function equipCat(cat){ return EQUIP_CATS.find(function(c){return c.cat===cat;})||null; }
// Resolve an equipment property: stored value -> class default for this device TYPE -> undefined.
// Every consumer must read through this, so an unset property behaves exactly like a defaulted one
// and an empty cap is only a precision loss, never a blocker.
function propSpec(cat, key, type){
  // Accessory devices are stored as {cat:'other', type:'<accessory key>'} — their properties live on the
  // matching EQUIP_OTHER_ITEMS entry (matched by its `key` against the device `type`), not on EQUIP_CATS.
  if(cat==='other'){
    const item = (typeof EQUIP_OTHER_ITEMS!=='undefined' ? EQUIP_OTHER_ITEMS : []).find(function(x){ return x.key===type; });
    if(!item) return null;
    return (item.props||[]).find(function(p){ return p.key===key; }) || null;
  }
  const c = equipCat(cat); if(!c) return null;
  return (c.props||[]).find(function(p){ return p.key===key; }) || null;
}
function propDef(cat, key, type){
  const p = propSpec(cat, key, type); if(!p || p.def===undefined) return undefined;
  if(p.def && typeof p.def==='object' && !Array.isArray(p.def)) return p.def[type];
  return p.def;                                   // scalar default (applies to every type)
}
function propOf(dev, key){
  if(!dev) return undefined;
  const v = dev.cap ? dev.cap[key] : undefined;
  if(v!==undefined && v!=='' && v!==null) return v;
  return propDef(dev.cat, key, dev.type);
}
// Unit conversions for values that arrive in the wrong scale — a US spec page gives °F, a seal width is
// quoted in mm, a capacity in lb. These are CORRECT values in another unit, not garbage, so they must be
// converted rather than discarded.
const UNIT_CONV={
  'F->C':     function(v){ return (v-32)*5/9; },
  'Fdeg->Cdeg':function(v){ return v*5/9; },      // a DELTA (tolerance), not a temperature
  'mm->cm':   function(v){ return v/10; },
  'in->cm':   function(v){ return v*2.54; },
  'cm->mm':   function(v){ return v*10; },
  'in->mm':   function(v){ return v*25.4; },
  'lb->kg':   function(v){ return v*0.45359; },
  'g->kg':    function(v){ return v/1000; },
  'qt->L':    function(v){ return v*0.94635; },
  'gal->L':   function(v){ return v*3.78541; },
  'in2->cm2': function(v){ return v*6.4516; },
  'm2->cm2':  function(v){ return v*10000; },
  'ft2->cm2': function(v){ return v*929.03; },
};
// Canonical FIRST: only convert when the value is implausible as-is. 500 stays 500°C (a lava grill really
// reaches it); 900 is impossible in °C, so it becomes 482°C. Returns null when NO interpretation is
// plausible — the caller must then leave it unset and let the user type it, never store a guess.
function propCoerce(p, raw){
  if(raw===undefined||raw===null||raw==='') return null;
  let n=(typeof raw==='number')?raw:parseFloat(String(raw).replace(',','.'));
  if(isNaN(n)) return null;
  const b=p.bounds;
  if(!b) return {v:n, conv:null};
  if(n>=b[0] && n<=b[1]) return {v:n, conv:null};                 // plausible as given — trust it
  for(const key of (p.alt||[])){
    const f=UNIT_CONV[key]; if(!f) continue;
    const c=f(n);
    if(c>=b[0] && c<=b[1]) return {v:Math.round(c*100)/100, conv:key};
  }
  return null;                                                     // implausible in every unit
}
// Manual entry accepts a trailing unit suffix ("500F", "300mm", "11lb", "5 ק״ג") so typing the number
// straight off a spec sheet is never a trap. The suffix is mapped to the matching `alt` conversion key;
// a bare number is treated as already being in the property's canonical unit.
const PROP_SUFFIX_TO_CONV={
  'f':'F->C', '°f':'F->C',
  'c':null, '°c':null,               // canonical — no conversion needed
  'mm':'mm->cm', 'мм':null,
  'cm':null,
  'in':'in->cm',                     // default in->cm; resolved against p.alt below
  'lb':'lb->kg', 'lbs':'lb->kg',
  'kg':null,
  'g':'g->kg',
  'qt':'qt->L',
  'gal':'gal->L',
  '%':null,
  'ק״ג':null, 'קג':null,
  'מ״מ':'mm->cm', 'ממ':'mm->cm',
  'ס״מ':null, 'סמ':null,
  'ל׳':null, 'ל':null,
  'in2':'in2->cm2', 'm2':'m2->cm2', 'ft2':'ft2->cm2', 'cm2':null,   // area suffixes ("800in2", "0.5m2")
};
function propParse(p, text){
  if(text===undefined||text===null) return null;
  let s=String(text).trim();
  if(!s) return null;
  const m=s.match(/^(-?[0-9]+(?:[.,][0-9]+)?)\s*(°?[A-Za-z%]+[0-9]?|[֐-׿"'׳״]+)?$/);
  if(!m) return propCoerce(p, s);
  const numPart=m[1];
  const suffix=(m[2]||'').trim();
  if(!suffix) return propCoerce(p, numPart);            // no suffix — canonical-first, same as manual coerce
  const suffixKey=suffix.toLowerCase();
  let n=parseFloat(numPart.replace(',','.'));
  if(isNaN(n)) return null;
  const b=p.bounds;
  // 'in' is ambiguous (in->cm vs in->mm) — resolve to whichever conversion this property actually declares
  let convKey, known;
  if(suffixKey==='in'){
    known=true;
    convKey=(p.alt||[]).indexOf('in->cm')>=0 ? 'in->cm' : ((p.alt||[]).indexOf('in->mm')>=0 ? 'in->mm' : undefined);
  } else if(PROP_SUFFIX_TO_CONV.hasOwnProperty(suffixKey)){
    known=true; convKey=PROP_SUFFIX_TO_CONV[suffixKey];
  } else if(PROP_SUFFIX_TO_CONV.hasOwnProperty(suffix)){
    // raw (non-lowercased) key for Hebrew suffixes that don't roundtrip through toLowerCase cleanly
    known=true; convKey=PROP_SUFFIX_TO_CONV[suffix];
  } else {
    known=false;
  }
  if(!known || convKey===undefined) return null;         // unrecognised suffix, or 'in' with no matching alt — reject, never guess
  if(convKey===null){                                     // suffix IS the property's own canonical unit — range-check n directly
    if(!b || (n>=b[0] && n<=b[1])) return {v:n, conv:null};
    return null;
  }
  if((p.alt||[]).indexOf(convKey)<0) return null;         // conversion not offered by this property — wrong dimension, reject
  const f=UNIT_CONV[convKey]; if(!f) return null;
  const c=f(n);                                           // convert EXACTLY ONCE — never hand an already-converted number back to propCoerce
  if(b && !(c>=b[0] && c<=b[1])) return null;
  return {v:Math.round(c*100)/100, conv:convKey};
}
function equipList(){ const l=store.get('mk-equipment'); return Array.isArray(l)?l:[]; }
function equipSave(list){ store.set('mk-equipment', Array.isArray(list)?list:[]); }
function equipId(){ return 'eq-'+(typeof uid==='function'?uid():Math.random().toString(36).slice(2,9)); }
function equipByCat(cat){ return equipList().filter(function(d){return d && d.cat===cat;}); }
function hasCat(cat){ return equipByCat(cat).length>0; }
function hasGear(x){ return equipList().some(function(d){return d && (d.cat===x || d.type===x);}); }   // core cat OR migrated 'other' type (e.g. 'torch')
function primaryOf(cat){ return equipByCat(cat)[0]||null; }                                            // first device = single-value display
function cookers(){ return equipList().filter(function(d){return d && (d.cat==='smoker'||d.cat==='grill'||d.cat==='oven');}); }
function probeChannels(){ return equipByCat('probe').reduce(function(n,d){return n+(+(d.cap&&d.cap.channels)||0);},0); }
function svBaths(){ return equipByCat('sousvide'); }
// Equipment 2.0 · Slice 1C — item→cooker assignment (which physical device an item's cook stage uses)
function cookerCatForKind(kind){ return kind==='sv'?'sousvide':kind==='smoke'?'smoker':kind==='cook'?'grill':null; }
function cookerCandidates(kind){
  const cat=cookerCatForKind(kind); if(!cat) return [];
  let list=equipByCat(cat);
  if(kind==='smoke') list=list.concat(equipByCat('grill').filter(function(d){return ['פחם','קטל','גז'].indexOf(d.type)>=0;}));   // a charcoal/kettle/gas grill can also smoke
  if(kind==='cook')  list=list.concat(equipByCat('oven'));   // an oven can roast/finish a 'cook' stage, not just a grill
  return list;
}
function itemCookerScope(scope){ return scope||((typeof evScope==='function')?evScope():'cook'); }
function setItemCooker(itemKey, kind, deviceId, scope){ const k='mk-item-cooker-'+itemCookerScope(scope); const m=store.get(k)||{}; const mk=itemKey+'|'+kind; if(deviceId) m[mk]=deviceId; else delete m[mk]; store.set(k,m); }
function cookerFor(itemKey, kind, scope){
  const cands=cookerCandidates(kind); if(!cands.length) return null;
  const m=store.get('mk-item-cooker-'+itemCookerScope(scope))||{};
  const asg=m[itemKey+'|'+kind];
  if(asg){ const d=cands.find(function(x){return x.id===asg;}); if(d) return d; }
  if(cands.length===1) return cands[0];    // single fit → auto
  // ambiguous → prefer the purpose-built device for this kind: a real smoker outranks a grill-that-can-also-smoke,
  // so owning both no longer drops the smoke stage to "no device" (and out of contention) the moment you add a kettle.
  const cat=cookerCatForKind(kind);
  const native=cands.filter(function(x){return x.cat===cat;});
  if(native.length===1) return native[0];
  return null;   // two of the same class → genuinely needs a pick
}
function cookerLabel(itemKey, kind, scope){ const d=cookerFor(itemKey,kind,scope); return d?(d.name||t(d.type)||''):''; }
// A clash is now a real physical conflict — over usable capacity, or two items that cannot share one
// temperature — evaluated at every moment a device's load changes. Overlapping in time is not a clash.
function cookerContention(computed, scope){
  const marks={};                                   // every instant a device's load could change
  (computed||[]).forEach(function(c){
    if(!c || c.blocked || !c.stages) return;
    c.stages.forEach(function(s){
      if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;
      const d=cookerFor(c.m.key, s.kind, scope); if(!d) return;
      (marks[d.id]=marks[d.id]||[]).push(s.start.getTime());
    });
  });
  const clashes=[];
  Object.keys(marks).forEach(function(devId){
    let worst=null;
    marks[devId].forEach(function(tMs){
      const o=deviceOccupancy(devId, tMs, computed, scope);
      if(o.items.length<2) return;                  // one item can never conflict with itself
      const bad=o.over?'area':(!o.compat.tempOk?'temp':null);
      if(!bad) return;
      if(!worst || (o.pct||0)>(worst.pct||0)) worst={devId:devId, devName:o.devName, at:tMs,
        reason:bad, pct:o.pct, compat:o.compat,
        items:o.items.map(function(i){return {key:i.key, name:i.name, kind:i.kind};})};   // kind drives the move-target lookup
    });
    if(worst) clashes.push(worst);
  });
  return clashes;
}
// ── occupancy primitives ───────────────────────────────────────────────────────────────────
// A cooker's stated area is never fully usable — smoke has to circulate, and packing pieces
// shoulder-to-shoulder gives uneven bark. Everything downstream budgets against usableCm2.
const PACK_EFF=0.85;
const TEMP_TOL_C=6;      // items within this many °C of each other may share one cooker
// A default shelf area is a rough class estimate; a real shelf can plausibly run ~30-50% larger, so a
// modest overflow on an ESTIMATE is "might be tight", not "won't fit". Past this factor no slack explains
// it → over even on an estimate. When the user entered a real area, there is no slack (any overflow is hard).
const FIT_HARD_FACTOR = 1.6;

function deviceCapacity(dev){
  const none={mode:'area', areaCm2:0, usableCm2:0, racks:0, hooks:0, litres:0, known:false};
  if(!dev) return none;
  if(dev.cat==='sousvide'){
    // Precedence matches the rest of the file (app.js:4924, 5480): cap.baths (array) first, else
    // the legacy/live single cap.bathL (written by the AI lookup path — app.js:5413/5429 — which
    // never populates cap.baths), else the class default. Never skip straight to the class
    // default while a real measurement (bathL) is sitting right there — that would report
    // known:true with an invented number.
    const baths=(dev.cap&&Array.isArray(dev.cap.baths))?dev.cap.baths.map(Number).filter(function(n){return n>0;}):[];
    const bathL=(dev.cap&&dev.cap.bathL!=null)?Number(dev.cap.bathL):NaN;
    const litres=baths.length?Math.max.apply(null,baths):((!isNaN(bathL)&&bathL>0)?bathL:(propOf(dev,'maxL')||0));
    return {mode:'volume', areaCm2:0, usableCm2:0, racks:0, hooks:0, litres:litres, known:litres>0};
  }
  const area=Number(propOf(dev,'areaCm2'))||0;
  const racks=Number(dev.cap&&(dev.cap.racks||dev.cap.zones))||0;
  const hooks=(propOf(dev,'canHang')===true)?(Number(propOf(dev,'hooks'))||0):0;
  return {mode:'area', areaCm2:area, usableCm2:Math.round(area*PACK_EFF), racks:racks, hooks:hooks,
          known:area>0, areaMeasured:!!(dev.cap && Number(dev.cap.areaCm2)>0)};
}

// What one item consumes during a given stage kind. Hanging (Task 6) frees grate area entirely,
// which is why it is a distinct mode rather than a smaller footprint.
// Can THIS device hang items? Its own canHang capability + a positive hook count — not a separate
// accessory. (A "hooks" accessory in the pantry can't hang anything without a device that supports it.)
function deviceCanHang(dev){ return !!dev && propOf(dev,'canHang')===true && (Number(propOf(dev,'hooks'))||0)>0; }
function ownsHangingDevice(){ return (typeof equipList==='function') && equipList().some(deviceCanHang); }
// Type-based device contour (Phase 2). Model-based per-body shape capture is deferred to the
// add-device AI lookup; today the silhouette is a pure function of (cat, type).
function deviceSilhouette(dev){
  if(!dev) return 'cabinet';
  if(dev.cat==='sousvide') return 'vessel';
  if(dev.cat==='grill') return (['קטל','פחם'].indexOf(dev.type)>=0) ? 'grill-round' : 'grill-rect';
  if(dev.cat==='smoker' && dev.type==='אופסט / סטיק-ברנר') return 'offset';
  return 'cabinet';   // all other smokers + all ovens: a truthful stacked-grate view
}
// The card shows the device's OWN name (e.g. "אביה 150"), not just its function. When two devices share a
// base name, disambiguate them with a sequential number in equipList() order — "אביה 150 · מס׳ 1 / 2".
function deviceDisplayName(dev){
  if(!dev) return '';
  const base = dev.name || (typeof t==='function'?t(dev.type):dev.type) || '';
  const same = equipList().filter(function(d){ return d && (d.name||(typeof t==='function'?t(d.type):d.type)||'')===base; });
  if(same.length<2) return base;
  const idx = same.findIndex(function(d){ return d===dev || d.id===dev.id; });
  const he = (typeof getLang!=='function'||getLang()==='he');
  return base + (he ? ' · מס׳ '+(idx+1) : ' · #'+(idx+1));
}
function itemOccupancy(meta, stageKind, dev){
  const none={mode:'area', cm2:0, hooks:0, litres:0, hang:null};
  if(!meta) return none;
  const eq=(meta.obj&&meta.obj.equip)||meta.equip; if(!eq) return none;
  const by=(eq.by&&eq.by[stageKind])||{};
  const spec=Object.assign({}, eq.spec||{}, by.spec||{});
  if(stageKind==='sv') return {mode:'volume', cm2:0, hooks:0, litres:Number(spec.min_bath_l)||0, hang:null};
  const hang=spec.hang||null;
  // Hanging is decided by the DEVICE the item is on (its own canHang + hooks). Called with a device →
  // that device's capability; called standalone → fall back to "do you own any device that can hang".
  const canHangHere = dev ? deviceCanHang(dev) : ownsHangingDevice();
  if(hang && canHangHere) return {mode:'hang', cm2:0, hooks:1, litres:0, hang:hang};
  const fp=spec.footprint_cm2;
  const cm2=(fp!=null && !isNaN(Number(fp))) ? Number(fp) : null;   // null = unknown, never silently 0
  return {mode:'area', cm2:cm2, hooks:0, litres:0, hang:null};
}

// Two cuts can only share a pit if the pit can be at one temperature that suits both, and if one
// wood serves both. Area alone was never the whole constraint.
function occupancyCompat(items){
  const temps=(items||[]).map(function(i){return i.temp;}).filter(function(v){return v!=null;});
  const spread=temps.length?(Math.max.apply(null,temps)-Math.min.apply(null,temps)):null;
  const woodSets=(items||[]).map(function(i){
    return String(i.wood||'').split('/').map(function(s){return s.trim();}).filter(Boolean);
  }).filter(function(a){return a.length;});
  let common=null;
  if(woodSets.length){
    common=woodSets.reduce(function(acc,set){ return acc.filter(function(w){return set.indexOf(w)>=0;}); }, woodSets[0].slice());
  }
  return {
    tempSpread: spread,
    tempOk: spread==null || spread<=TEMP_TOL_C,
    // ADVISORY / DISPLAY ONLY. setpoint is the highest temp among items sharing a cooker — shown so the user
    // knows what to run the pit at. It must NEVER be written back onto a stage's `temp`: that would raise a
    // lower-temp cut above its recipe temperature, a food-safety violation. Fenced by tests/setpoint-fence.spec.
    setpoint: temps.length?Math.max.apply(null,temps):null,
    woods: woodSets.length?[].concat.apply([],woodSets).filter(function(w,i,a){return a.indexOf(w)===i;}):[],
    commonWood: (common&&common.length)?common[0]:null,
    woodOk: !woodSets.length || woodSets.length<2 || !!(common&&common.length)
  };
}

// H4 packer — assign each AREA item to ONE slot (shelf / grill zone) for its whole life, by replaying the
// cook chronologically: place each on the lowest slot with room; an over-sized single item still goes on an
// empty slot (flagged over there); only when no slot fits AND none is empty is it truly unplaced. Assign-once
// is deterministic, scrub-stable, and physically true — you put meat on whichever shelf has room when you
// carry it out, and you don't move it mid-cook. Pure; cheap to recompute per call (2-12 items).
function packDevice(devId, computed, scope){
  const dev=equipList().find(function(d){return d && d.id===devId;})||null;
  const cap=deviceCapacity(dev);
  const cc=(typeof EQUIP_CATS!=='undefined')?EQUIP_CATS.find(function(x){return dev&&x.cat===dev.cat;}):null;
  const slotKind=cap.mode==='volume'?'bath':((dev&&dev.cat==='grill')?'zone':'rack');
  const slotCount=cap.mode==='volume'?1:Math.max(1, cap.racks||1);   // racks | zones; unknown count → 1 (whole interior)
  const perSlotCm2=(cap.mode==='volume'||!cap.known||!(cap.usableCm2>0))?null:Math.round(cap.usableCm2/slotCount);
  const meta={slots:slotCount, slotKind:slotKind, perSlotCm2:perSlotCm2,
              slotLabelHe:cc?cc.capHe:'', slotLabelEn:cc?cc.capEn:''};
  const itemSlot={}, unplacedKeys={};
  if(perSlotCm2==null) return {meta:meta, itemSlot:itemSlot, unplacedKeys:unplacedKeys};   // no area → no placement invented
  const events=[];
  (computed||[]).forEach(function(c){ if(!c||c.blocked||!c.stages||!c.m) return;
    c.stages.forEach(function(s){ if(['smoke','cook','sv'].indexOf(s.kind)<0||!s.start||!s.end) return;
      const d=c.devId?{id:c.devId}:cookerFor(c.m.key, s.kind, scope); if(!d||d.id!==devId) return;
      const occ=itemOccupancy(c.m, s.kind, dev);
      if(occ.mode!=='area') return;                 // hung / sous-vide items take no shelf slot
      events.push({key:c.m.key, start:s.start.getTime(), end:s.end.getTime(), cm2:occ.cm2});
    });
  });
  events.sort(function(a,b){ return a.start-b.start || (b.cm2||0)-(a.cm2||0) || (a.key<b.key?-1:a.key>b.key?1:0); });   // total order → deterministic
  const slots=[]; for(var i=0;i<slotCount;i++) slots.push({free:perSlotCm2, occ:[]});   // occ entries: {end, cm2}
  events.forEach(function(e){
    if(e.cm2==null){ itemSlot[e.key]=null; return; }   // unmeasured (H1) → not slotted, and NOT "unplaced"
    slots.forEach(function(sl){ sl.occ=sl.occ.filter(function(o){ if(o.end<=e.start){ sl.free+=o.cm2; return false; } return true; }); });   // release anything already off
    var placed=-1;
    for(i=0;i<slotCount;i++){ if(slots[i].free>=e.cm2){ placed=i; break; } }                       // a shelf it fits on
    if(placed<0){ for(i=0;i<slotCount;i++){ if(slots[i].free===perSlotCm2){ placed=i; break; } } } // else an empty shelf (over-sized single item still goes on it, flagged over)
    if(placed<0){ itemSlot[e.key]=null; unplacedKeys[e.key]=1; return; }                            // no fit, no empty → genuinely nowhere
    slots[placed].free-=e.cm2; slots[placed].occ.push({end:e.end, cm2:e.cm2}); itemSlot[e.key]=placed;
  });
  return {meta:meta, itemSlot:itemSlot, unplacedKeys:unplacedKeys};
}
// The single source of truth for "what is on this device right now". The occupancy view renders this
// object and the clash advisories derive from it — so a diagram and a warning can never disagree.
function deviceOccupancy(devId, tMs, computed, scope){
  const dev=equipList().find(function(d){return d && d.id===devId;})||null;
  const cap=deviceCapacity(dev);
  const pack=packDevice(devId, computed, scope);   // stable item→slot assignment for the whole plan
  cap.slots=pack.meta.slots; cap.slotKind=pack.meta.slotKind; cap.perSlotCm2=pack.meta.perSlotCm2;
  cap.slotLabelHe=pack.meta.slotLabelHe; cap.slotLabelEn=pack.meta.slotLabelEn;
  const out={dev:dev, devName:dev?deviceDisplayName(dev):'', mode:cap.mode, t:tMs, cap:cap,
             items:[], usedCm2:0, usedLitres:0, hooksUsed:0, unknownCm2Count:0, pct:null, over:false, pctFloor:false,
             slots:[], unplaced:[], slotOver:false};
  (computed||[]).forEach(function(c){
    if(!c || c.blocked || !c.stages || !c.m) return;
    c.stages.forEach(function(s){
      if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;
      const st=s.start.getTime(), en=s.end.getTime();
      if(tMs<st || tMs>=en) return;
      const d=c.devId?{id:c.devId}:cookerFor(c.m.key, s.kind, scope); if(!d || d.id!==devId) return;   // caller may pre-resolve in its own event scope
      const occ=itemOccupancy(c.m, s.kind, dev);   // device-aware: hang only if THIS device can hang
      out.items.push({key:c.m.key, name:(typeof itemName==='function'?itemName(c.m):c.m.heb),
                      kind:s.kind, cm2:occ.cm2, hooks:occ.hooks, litres:occ.litres, mode:occ.mode,
                      slot:(Object.prototype.hasOwnProperty.call(pack.itemSlot,c.m.key)?pack.itemSlot[c.m.key]:null),
                      start:st, end:en, temp:(s.temp!=null?s.temp:null),
                      wood:(c.m.obj&&c.m.obj.wood)||c.m.wood||''});
      if(occ.cm2!=null) out.usedCm2+=occ.cm2;                                   // sum KNOWN area only — an unknown must never masquerade as a 0
      if(occ.mode==='area' && occ.cm2==null) out.unknownCm2Count++;             // ...but it must still be counted, so the view can qualify the % as a floor
      out.usedLitres+=occ.litres; out.hooksUsed+=occ.hooks;
    });
  });
  // Per-slot occupancy at this instant: place each LIVE area item in its packer-assigned slot, then a slot
  // is "over" when the items on it exceed one slot's capacity. This is what makes the % a claim about slots
  // that exist — a brisket that fits no single shelf is flagged, not hidden inside a comfortable cabinet %.
  if(cap.perSlotCm2!=null && cap.slots>0){
    for(var si=0; si<cap.slots; si++) out.slots.push({i:si, capCm2:cap.perSlotCm2, usedCm2:0, over:false, pct:0, items:[]});
    out.items.forEach(function(it){
      if(it.mode!=='area') return;                       // hung / sv items are not on a shelf
      if(it.slot!=null && out.slots[it.slot]){ const sl=out.slots[it.slot]; sl.items.push({key:it.key, name:it.name, cm2:it.cm2}); if(it.cm2!=null) sl.usedCm2+=it.cm2; }
      else if(it.cm2!=null){ out.unplaced.push({key:it.key, name:it.name, cm2:it.cm2}); }   // measured but fits nowhere (unmeasured items have cm2==null → neither slotted nor unplaced)
    });
    out.slots.forEach(function(sl){ sl.over=sl.usedCm2>sl.capCm2; sl.pct=Math.round(sl.usedCm2/sl.capCm2*100); });
    out.slotOver = out.slots.some(function(s){return s.over;}) || out.unplaced.length>0;
  }
  // A zero denominator would yield Infinity/NaN and render as "Infinity%" in the occupancy view, so a
  // capacity that rounds away to nothing is treated as unknown rather than as a division we can trust.
  const denom=(cap.mode==='volume')?cap.litres:cap.usableCm2;
  if(cap.known && denom>0){
    if(cap.mode==='volume'){
      // min_bath_l is each item's REQUIRED bath size (a per-item constraint), NOT additive displacement —
      // summing it produced a false "over" for items that share one bath. The binding requirement is the
      // largest single item's need; with 2+ items the true fill is higher (displacement we don't have), so
      // the % is a floor, and "over" means an item literally needs a bigger bath than you own.
      const reqs=out.items.map(function(i){return i.litres;}).filter(function(v){return v>0;});
      const maxReq=reqs.length?Math.max.apply(null,reqs):0;
      out.usedLitres=maxReq;
      out.pct=Math.round(maxReq/cap.litres*100);
      out.over=maxReq>cap.litres;
      out.pctFloor=reqs.length>=2;
    } else {
      out.pct=Math.round(out.usedCm2/cap.usableCm2*100);
      out.over=out.usedCm2>cap.usableCm2;
      out.pctFloor=out.unknownCm2Count>0;   // known-area sum excludes unmeasured items → the % is a floor
    }
  }
  // Fit verdict (Phase 2 honesty ladder) — a MODEL value so the diagram, the sentence and the a11y list agree.
  // Only area devices; volume devices fold into the H2 over-rule below.
  out.fit = {verdict:'ok', measured:!!cap.areaMeasured, hardItems:[], softItems:[]};
  if(cap.mode==='area' && cap.perSlotCm2!=null){
    const bad=[];                                   // measured items that overflow a single slot, or fit nowhere
    (out.slots||[]).forEach(function(sl){ sl.items.forEach(function(it){ if(it.cm2!=null && it.cm2>cap.perSlotCm2) bad.push(it); }); });
    (out.unplaced||[]).forEach(function(it){ if(it.cm2!=null) bad.push(it); });
    bad.forEach(function(it){
      const hard = cap.areaMeasured || (it.cm2 > FIT_HARD_FACTOR*cap.perSlotCm2);
      (hard?out.fit.hardItems:out.fit.softItems).push(it.name);
    });
    out.fit.verdict = out.fit.hardItems.length ? 'over' : (out.fit.softItems.length ? 'tight' : 'ok');
  } else if(cap.mode==='volume'){
    // an item needing a bigger bath than owned is a hard over (H2)
    if(out.over){ out.fit.verdict='over'; out.fit.measured=!!cap.known; }
  }
  out.hooksOver=cap.hooks>0 && out.hooksUsed>cap.hooks;
  out.compat=occupancyCompat(out.items);
  return out;
}
// ── shared-device occupancy view ───────────────────────────────────────────────────────────
// Renders deviceOccupancy() and nothing else — the diagram and the clash advisories must never
// be able to disagree, so this computes no occupancy of its own.
// Phase 2: a device-shaped diagram per cooker, rendered from `o` (deviceOccupancy) ALONE. The dispatcher
// picks the silhouette; each *_Body renders only the interior; the header, fit line and a11y list are shared.
function occupancyDevHtml(o){
  const sil = deviceSilhouette(o.dev);
  let body;
  if(sil==='vessel')       body=_occVesselBody(o);
  else if(sil==='offset')  body=_occOffsetBody(o);
  else if(sil==='grill-round'||sil==='grill-rect') body=_occGrillBody(o, sil==='grill-round');
  else                     body=_occCabinetBody(o);
  const bay = (o.cap && o.cap.hooks>0) ? _occBayHtml(o) : '';
  return `<div class="occ2-dev">${_occHeaderHtml(o)}${bay}${body}${_occFitHtml(o)}${_occListHtml(o)}</div>`;
}
function _occHeaderHtml(o){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const cap=o.cap, facts=[];
  if(o.compat && o.compat.commonWood) facts.push(`🪵 ${esc(t(o.compat.commonWood))}`);
  else if(o.compat && o.compat.woods && o.compat.woods.length>1) facts.push(`🪵 ${L('עצים שונים','different woods')}`);
  // A bath has no shelves — printing "1 מדפים / 1 racks" on a sous-vide is the same mislabel class H4 killed
  // on the kettle. The vessel's own capacity sentence carries its litres, so skip the slot fact entirely.
  if(cap.slots && cap.slotKind!=='bath') facts.push(`🗄️ ${cap.slots} ${he?(cap.slotLabelHe||'מדפים'):(cap.slotLabelEn||'racks')}`);
  if(cap.hooks) facts.push(`🪝 ${o.hooksUsed}/${cap.hooks}`);
  const set = (o.compat && o.compat.setpoint!=null) ? `<span class="occ2-set" dir="ltr">${o.compat.setpoint}°</span>` : '';
  // The setpoint is the MAXIMUM of what the items need. Running the cooker there raises every cooler item
  // by the difference — a temperature change presented as a neutral fact about the device. State the delta
  // and name who pays it. (Scheduler spec §6.3: this must be a visible cost now, and may never become an
  // automatic "share the device" move later without the user seeing exactly this number.)
  let delta='';
  if(o.compat && o.compat.setpoint!=null && o.compat.tempSpread>0){
    const sp=o.compat.setpoint;
    const raised=(o.items||[]).filter(function(i){ return i.temp!=null && i.temp<sp; });
    if(raised.length){
      const names=raised.map(function(i){return esc(i.name);}).filter(function(v,ix,a){return a.indexOf(v)===ix;}).join(', ');
      let worst=0; raised.forEach(function(i){ const d=sp-i.temp; if(d>worst) worst=d; });
      delta=`<span class="occ2-tdelta" title="${L('הפעלת המכשיר בטמפרטורה הגבוהה מעלה את הפריט הקר יותר','Running the cooker at the higher temperature raises the cooler item')}">⚠ ${names} ${L('מבושל ב-','runs ')}${worst}°${L(' מעל הנדרש לו','above its own target')}</span>`;
    }
  }
  return `<div class="occ2-h"><span class="occ2-nm">${esc(o.devName)}</span>${set}<div class="occ2-facts">${facts.join('')}${delta}</div></div>`;
}
// One tile for one item. Solid = measured; dashed (no number) = unmeasured (H1); over = capped + hatched bleed.
function _occTile(it, cap){
  const he=(typeof getLang!=='function'||getLang()==='he');
  if(it.cm2==null)  // unmeasured → dashed, never numbered
    return `<div class="occ2-tile occ2-dashed" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m">${L('מידה לא ידועה','size unknown')}</span></div>`;
  if(cap.perSlotCm2!=null && it.cm2>cap.perSlotCm2)  // over a single slot
    return `<div class="occ2-tile occ2-big" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m" dir="ltr">${it.cm2} ${he?'סמ״ר':'cm²'}</span></div><div class="occ2-bleed"></div>`;
  const frac=(cap.perSlotCm2>0)?Math.max(18,Math.round(it.cm2/cap.perSlotCm2*100)):40;
  return `<div class="occ2-tile" style="flex:0 0 ${frac}%" title="${esc(it.name)}"><span class="occ2-tile-t">${esc(it.name)}</span><span class="occ2-tile-m" dir="ltr">${it.cm2}</span></div>`;
}
// Cabinet / oven: a vertical shelf stack; empty shelves drawn, not hidden.
function _occCabinetBody(o){
  const cap=o.cap;
  if(cap.perSlotCm2==null && !(cap.slots>0))
    return `<div class="occ2-empty">${L('שטח לא ידוע — הוסף את שטח הבישול בכרטיס הציוד','Area unknown — add the cooking area on the device card')}</div>`;
  const rows=[];
  for(let i=0;i<cap.slots;i++){
    const sl=(o.slots||[])[i]||{items:[],over:false};
    const tiles = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-empty">${L('מדף פנוי','shelf free')}</span>`;
    rows.push(`<div class="occ2-shelf${sl.over?' occ2-over':''}"><span class="occ2-n">${i+1}</span>${tiles}</div>`);
  }
  return `<div class="occ2-rack">${rows.join('')}</div>${_occUnknownHtml(o)}`;
}
// Unmeasured items (H1): the packer deliberately gives them NO slot — they must never count toward a
// shelf's area math (S4/S5 lock `it.slot===null` at the model level). The diagram must still show them
// (never silently dropped) but must NOT imply a shelf they were never assigned — so they get their own
// dashed bucket beneath the silhouette: visible, unnumbered, and explicitly marked as not placed.
function _occUnknownHtml(o){
  const unknown=(o.items||[]).filter(function(it){return it.mode==='area' && it.cm2==null;});
  if(!unknown.length) return '';
  const tiles=unknown.map(function(it){ return _occTile(it, o.cap); }).join('');
  return `<div class="occ2-unknown"><span class="occ2-ul">${L('לא שובץ — מידה לא ידועה','not placed — size unknown')}</span><div class="occ2-unknown-row">${tiles}</div></div>`;
}
// Horizontal offset smoker: a lying barrel with a firebox to the side; grates run across.
function _occOffsetBody(o){
  const cap=o.cap;
  if(cap.perSlotCm2==null && !(cap.slots>0))
    return `<div class="occ2-empty">${L('שטח לא ידוע — הוסף את שטח הבישול בכרטיס הציוד','Area unknown — add the cooking area on the device card')}</div>`;
  const rows=[];
  for(let i=0;i<cap.slots;i++){
    const sl=(o.slots||[])[i]||{items:[],over:false};
    const tiles = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-empty">${L('רשת פנויה','grate free')}</span>`;
    rows.push(`<div class="occ2-grate">${tiles}</div>`);
  }
  return `<div class="occ2-offset"><div class="occ2-firebox"><span>${L('תא בערה','firebox')}</span></div><div class="occ2-barrel">${rows.join('')}</div></div>${_occUnknownHtml(o)}`;
}
// Grill: a TOP-VIEW of heat zones side by side. Round contour for a kettle (a true circle), rect otherwise.
// Zone labels are "אזור N" only — the model does NOT know direct vs indirect, so it never claims to.
function _occGrillBody(o, isRound){
  const cap=o.cap, n=Math.max(1, cap.slots||1);
  const he=(typeof getLang!=='function'||getLang()==='he');
  const cells=[];
  for(let i=0;i<n;i++){
    const sl=(o.slots||[])[i]||{items:[]};
    const inner = sl.items.length ? sl.items.map(function(it){return _occTile(it, cap);}).join('')
                                  : `<span class="occ2-free">${L('פנוי','free')}</span>`;
    cells.push(`<div class="occ2-zone">${inner}<span class="occ2-zl">${he?'אזור':'zone'} ${i+1}</span></div>`);
  }
  return `<div class="occ2-grill ${isRound?'occ2-round':'occ2-rect'}"><div class="occ2-zones">${cells.join('')}</div></div>${_occUnknownHtml(o)}`;
}
// Sous-vide: an open-topped vessel with a water line + circulator, one bag per item. NO % (H2): we count
// bags and the largest single required litres; true fill needs displacement we do not have.
function _occVesselBody(o){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const bags=(o.items||[]).map(function(it){ return `<div class="occ2-bag">${esc(it.name)}</div>`; }).join('')
    || `<span class="occ2-free">${L('ריק','empty')}</span>`;
  const need=o.usedLitres||0, has=(o.cap&&o.cap.litres)||0, u=he?'ל׳':'L';
  const isl=function(n){ return `<span dir="ltr">${n} ${u}</span>`; };   // number+unit LTR island (L13) — never wrap the whole Hebrew sentence in ltr
  const cap = `${(o.items||[]).length} ${L('שקיות','bags')} · ${L('הגדולה דורשת','largest needs')} ${isl(need)} · ${L('האמבט','bath')} ${isl(has)}`;
  return `<div class="occ2-vessel"><div class="occ2-wl"></div><div class="occ2-circ"></div><div class="occ2-bags">${bags}</div></div><div class="occ2-svcap">${cap}</div>`;
}
// Hanging bay overlay — a separate channel above the shelves. Lit hooks = in use, dimmed = free. Longer
// items hang lower. The shelves below still render empty: the visual proof that hanging frees grate area.
function _occBayHtml(o){
  const cap=o.cap, used=o.hooksUsed||0, total=cap.hooks||0;
  const hung=(o.items||[]).filter(function(it){return it.mode==='hang';});
  if(!hung.length && !used) return '';
  let hooks='';
  for(let i=0;i<total;i++) hooks += `<span class="${i<used?'':'occ2-off'}">🪝</span>`;
  const tags=hung.map(function(it){
    const longCls = (it.name && it.name.length>6) ? ' occ2-long' : '';
    return `<div class="occ2-hung${longCls}">${esc(it.name)}</div>`;
  }).join('');
  return `<div class="occ2-bay"><span class="occ2-n" dir="ltr">${used}/${total}</span><div class="occ2-hooks">${hooks}</div><div class="occ2-hungrow">${tags}</div></div>`;
}
// Fit line — a MODEL value (o.fit). Green ok / orange tight / red over, naming the items.
function _occFitHtml(o){
  const f=o.fit||{verdict:'ok'};
  const overMsgs=[];
  if(f.verdict==='over'){
    const who = (f.hardItems&&f.hardItems.length) ? esc(f.hardItems.join(', '))+' — ' : '';
    const slotHe=(o.cap.slotKind==='zone')?'אזור':'מדף', slotEn=(o.cap.slotKind==='zone')?'zone':'shelf';
    const msg = (o.mode==='volume') ? L('חריגה מהקיבולת','Over capacity')
                                    : L('לא נכנס ל'+slotHe+' בודד','does not fit a single '+slotEn);
    overMsgs.push(who+msg);
  }
  // Hanging is a SEPARATE channel from shelf/bath area (o.fit covers area only): more hung items than hooks
  // is also an honest "over", so surface it here — the fit line must never read a false "✓ everything fits"
  // while items have nowhere to hang. (This restored the old view's hooks warning, dropped in the T5 rewrite.)
  if(o.hooksOver) overMsgs.push(`${L('יותר תלויים מהווים','more hung items than hooks')} <span dir="ltr">(${o.hooksUsed}/${o.cap.hooks})</span>`);
  if(overMsgs.length) return `<div class="occ2-fit-over">⚠ ${overMsgs.join(' · ')}</div>`;
  if(f.verdict==='tight'){
    const who = (f.softItems&&f.softItems.length) ? esc(f.softItems.join(', '))+' — ' : '';
    return `<div class="occ2-fit-tight">◐ ${who}${L('ייתכן צפוף — השטח מוערך. הזן שטח בישול אמיתי לבדיקה מדויקת','might be tight — area is estimated. Enter a real cooking area for a precise check')}</div>`;
  }
  return `<div class="occ2-fit-ok">✓ ${L('הכל נכנס','everything fits')}</div>`;
}
// The accessible / printable layer: item · slot · cm² for every placed area item.
function _occListHtml(o){
  if(o.mode==='volume') return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  const slotHe=(o.cap.slotKind==='zone')?'אזור':'מדף', slotEn=(o.cap.slotKind==='zone')?'zone':'shelf';
  const lis=(o.items||[]).filter(function(it){return it.mode==='area';}).map(function(it){
    const where = (it.slot!=null) ? `${he?slotHe:slotEn} ${it.slot+1}` : L('לא משובץ','unplaced');
    const size = (it.cm2!=null) ? ` · ${it.cm2} ${he?'סמ״ר':'cm²'}` : ` · ${L('מידה לא ידועה','size unknown')}`;
    return `<li><b>${esc(it.name)}</b><span class="occ2-s">· ${where}${size}</span></li>`;
  });
  return lis.length ? `<ul class="occ2-list">${lis.join('')}</ul>` : '';
}
function occupancyViewHtml(computed, tMs, scope){
  const devs=equipList().filter(function(d){return d && ['smoker','grill','sousvide','oven'].indexOf(d.cat)>=0;});
  if(!devs.length) return `<div class="occ-wrap"><p class="section-sub">${L('לא הוגדרו מכשירים.','No cookers configured.')}</p></div>`;
  return `<div class="occ-wrap">${devs.map(function(d){
    return occupancyDevHtml(deviceOccupancy(d.id, tMs, computed, scope));
  }).join('')}</div>`;
}
// Opening on the wall clock is right while you are actually cooking, but useless the rest of the time —
// browse a plan at 18:56 and every cooker reads "פנוי" because the meat is already resting. So: use the
// clock when it lands on something, otherwise open on the busiest moment, which is the one worth seeing.
function _occOpenAt(computed, span, scope){
  const anyAt=function(tMs){
    return equipList().some(function(d){
      return ['smoker','grill','sousvide','oven'].indexOf(d.cat)>=0 && deviceOccupancy(d.id, tMs, computed, scope).items.length>0;
    });
  };
  if(anyAt(span.now)) return span.now;
  let best=span.now, bestN=-1;
  (computed||[]).forEach(function(c){ if(!c||!c.stages) return; c.stages.forEach(function(s){
    if(!s.start) return; const tMs=s.start.getTime();
    let n=0; equipList().forEach(function(d){
      if(['smoker','grill','sousvide','oven'].indexOf(d.cat)<0) return;
      n+=deviceOccupancy(d.id, tMs, computed, scope).items.length; });
    if(n>bestN){ bestN=n; best=tMs; } }); });
  return best;
}
function openOccupancyView(computed, serve, scope){
  if(typeof showPanel!=='function') return;
  const span=_occSpan(computed);
  span.clock=span.now;                       // the real wall clock — what the "עכשיו" button jumps back to
  span.now=_occOpenAt(computed, span, scope);
  window._occT=span.now;
  showPanel(`${toolTop(L('תפוסת המכשירים','Cooker occupancy'),L('מה נמצא על כל מכשיר, ומתי','What is on each cooker, and when'),'🗄️','#7a5c3c')}
    <div class="panel-body">
      <div id="occScrub"></div>
      <div id="occBody">${occupancyViewHtml(computed, window._occT, scope)}</div>
    </div>`);
  _occWire(computed, span, scope);
}
// the plan's overall time span, and a sensible starting instant (now, clamped into the span)
function _occSpan(computed){
  let lo=Infinity, hi=-Infinity;
  (computed||[]).forEach(function(c){ if(!c||!c.stages) return; c.stages.forEach(function(s){
    if(!s.start||!s.end) return; lo=Math.min(lo,s.start.getTime()); hi=Math.max(hi,s.end.getTime()); }); });
  if(!isFinite(lo)){ const n=Date.now(); return {lo:n, hi:n+3600e3, now:n}; }
  const n=Date.now();
  return {lo:lo, hi:hi, now:Math.max(lo, Math.min(hi, n))};
}
function _occWire(computed, span, scope){
  const host=$("#occScrub"); if(!host) return;
  const fmt=function(ms){ const d=new Date(ms); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  host.innerHTML=`<div class="occ-scrub">
      <input type="range" id="occRange" min="${span.lo}" max="${span.hi}" step="60000" value="${span.now}"
             aria-label="${L('שעה בתוכנית','Time in the plan')}">
      <div class="occ-scrubrow"><button class="mchip" id="occNow">${L('עכשיו','Now')}</button><b id="occClock">${fmt(span.now)}</b></div>
    </div>`;
  const sl=$("#occRange"), clock=$("#occClock"), body=$("#occBody");
  const paint=function(){
    window._occT=Number(sl.value);
    if(clock) clock.textContent=fmt(window._occT);
    if(body)  body.innerHTML=occupancyViewHtml(computed, window._occT, scope);
  };
  sl.addEventListener('input', paint);
  // "עכשיו" means the real clock, not whatever instant the view happened to open on.
  const nb=$("#occNow"); if(nb) nb.addEventListener('click',function(){ sl.value=String(span.clock!=null?span.clock:span.now); paint(); });
}
function equipConfigured(){ return !!store.get('mk-equip-set'); }
function equipSetConfigured(){ store.set('mk-equip-set', true); }
// one-time seed from the old flat mk-gear, then mk-gear is never read again
function equipMigrateFromGear(){
  if(equipList().length) return;                                   // idempotent: already has devices
  const g=store.get('mk-gear'); if(!g || typeof g!=='object') return;
  const CORE={smoker:'smoker', grill:'grill', sousvide:'sousvide', thermo:'probe', grinder:'grinder', stuffer:'stuffer'};
  const list=[];
  Object.keys(g).forEach(function(k){
    const v=g[k]; if(!v || v==='אין') return;
    const isCore=!!CORE[k];
    list.push({id:equipId(), cat:isCore?CORE[k]:'other', type:isCore?v:k, name:v, brand:'', model:'', fuel:'', cap:{}, specSource:'manual', notes:''});
  });
  if(list.length) equipSave(list);
  if(store.get('mk-gear-set')) store.set('mk-equip-set', true);
}
// one-time cleanup: seed a prop-bearing 'Other' accessory's property from its legacy gear value
// (e.g. an old scale named 'יש (0.1 ג׳)' → cap.res '0.1g'; a cure chamber named 'מקרר מומר' → cap.kind 'Converted fridge').
function equipNormalizeOther(){
  if(typeof EQUIP_OTHER_ITEMS==='undefined') return;
  const list=equipList(); if(!list.length) return; let changed=false;
  list.forEach(function(d){ if(!d || d.cat!=='other') return;
    const it=EQUIP_OTHER_ITEMS.find(function(x){ return x.key===d.type; });
    if(!it || !it.prop) return; d.cap=d.cap||{}; if(d.cap[it.prop.key]) return;
    const n=String(d.name||''); let v='';
    it.prop.opts.forEach(function(o){ if(v) return; const val=(typeof o==='string')?o:o.en, he=(typeof o==='string')?o:o.he; if(n.indexOf(he)>=0||n.indexOf(val)>=0) v=val; });
    if(!v && it.key==='scale'){ if(/0\.1/.test(n)) v='0.1g'; else if(/1/.test(n)) v='1g'; }
    if(v){ d.cap[it.prop.key]=v; changed=true; }
  });
  if(changed) equipSave(list);
}
// capability mapping — permissive (true) until the user configures gear, so nothing changes for them until then
function canSV(){ if(!equipConfigured()) return true; return hasCat('sousvide'); }
function canSmoke(){ if(!equipConfigured()) return true;
  if(hasCat('smoker')) return true;
  return equipByCat('grill').some(function(d){ return ['פחם','קטל','גז'].indexOf(d.type)>=0; }); }        // charcoal/kettle/gas grill can smoke
function canGrill(){ if(!equipConfigured()) return true;
  if(hasCat('grill')) return true;
  return equipByCat('smoker').some(function(d){ return ['קמאדו / קרמי','קטל (ככלי עישון)','WSM / חבית','אופסט / סטיק-ברנר'].indexOf(d.type)>=0; }); }
function gearCan(method){ return method==='sv'?canSV():method==='smoke'?canSmoke():method==='grill'?canGrill():true; }
function gearLabelFor(method){ return method==='sv'?'סו-ויד':method==='smoke'?'מעשנה':method==='grill'?'גריל':''; }
// one source of truth for the adaptive home — capability + presence, read from the device list each paint
function homeGear(){
  return {
    canSmoke: canSmoke(), canGrill: canGrill(), canSV: canSV(),
    hasProbe: hasCat('probe'),
    hasCharcuterie: hasCat('grinder') || hasCat('stuffer'),
    configured: equipConfigured()
  };
}
// stamp the adaptive-home body classes (gear = relevance, level = density; is-cooking = live). Render-layer only.
function homeAdaptClasses(){ try{
  const cl=document.body.classList;
  const hg=homeGear();
  const lvKey=(typeof uiLevel==='function')?uiLevel():'mid'; const lv=({beginner:'beg',mid:'mid',pro:'pro'})[lvKey]||'mid';
  const live=(typeof _liveCookState==='function') && _liveCookState().live;
  cl.toggle('is-cooking', !!live);
  cl.toggle('gear-nosv', !hg.canSV);
  cl.toggle('gear-noproj', !hg.hasCharcuterie);
  cl.toggle('gear-noprobe', !hg.hasProbe);
  cl.remove('lvl-beg','lvl-mid','lvl-pro'); cl.add('lvl-'+lv);
}catch(e){} }
function methodRules(c){
  if(isProduce(c)) return {allowed:['sv','smoke','grill'], def:['grill'], minOne:true,
    invalid:[['sv','smoke','grill']]};                       // all three = overcooked produce
  if(isOffal(c)){
    const e=c.eng||'';
    if(e.includes('Gizzard')) return {allowed:['sv','smoke','grill'], def:['sv','grill'], minOne:true,
      require:['sv'], invalid:[]};                           // gizzards must pre-tenderize
    return {allowed:['sv','smoke','grill'], def:['grill'], minOne:true, invalid:[]};  // צריבת-גימור אחרי sv+עישון לגיטימית
  }
  if(c.doneness) return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
    invalid:[]};                                             // steak-like: כל צירוף — גריל כגימור קצר גם אחרי sv+עישון
  // collagen/long cuts: grill allowed ONLY as finish (must have sv or smoke doing the cooking)
  return {allowed:['sv','smoke','grill'], def:['sv','smoke'], minOne:true,
    needsCookFor:'grill', invalid:[['grill']]};
}
function methodKeyFor(key){return 'method:'+key;}
function activeMethods(c,key){
  const saved=store.get(methodKeyFor(key));
  const rules=methodRules(c);
  if(Array.isArray(saved)&&saved.length){
    const ok=saved.filter(m=>rules.allowed.includes(m));
    if(ok.length) return ok;
  }
  return gearAwareDefault(c, rules);
}
/* ── ephemeral cooking-form state (recipe card as interactive scratch) ──
   lives in memory for the current visit only; next entry → clean template */
let cardSess={};
function cardGet(k){ return (k in cardSess)?cardSess[k]:null; }
function cardSet(k,v){ if(v===null||v===undefined) delete cardSess[k]; else cardSess[k]=v; }
function cardClear(key){ Object.keys(cardSess).forEach(k=>{ if(k.startsWith(key+'-')||k==='method:'+key||k==='done:'+key) delete cardSess[k]; }); }
function cardMethods(c,key){
  const s=cardGet('method:'+key); const rules=methodRules(c);
  if(Array.isArray(s)&&s.length){ const ok=s.filter(m=>rules.allowed.includes(m)); if(ok.length) return ok; }
  return gearAwareDefault(c, rules);
}
function ctxMethods(c,key){ return (typeof curProject!=='undefined'&&curProject)?activeMethods(c,key):cardMethods(c,key); }
// prefer a default the user's gear can actually do; fall back gracefully but keep a valid combo
function gearAwareDefault(c, rules){
  const def=[...rules.def];
  if(!gearConfigured()) return def;
  if(def.every(m=>gearCan(m))) return def;                        // user can do the intended route
  // try to salvage: keep gear-capable methods from the default
  let cand=def.filter(m=>gearCan(m));
  // if default was sv+smoke and one is missing, the remaining single often still cooks (smoke-only / sv-only)
  if(cand.length && validCombo(c,cand)) return cand;
  // otherwise search all valid combos for one the gear can fully do, closest to the default
  const all=[['sv'],['smoke'],['grill'],['sv','smoke'],['sv','grill'],['smoke','grill'],['sv','smoke','grill']]
    .filter(cb=>validCombo(c,cb) && cb.every(m=>gearCan(m)));
  if(all.length){ all.sort((a,b)=>a.length-b.length); return all[0]; }
  return def;                                                     // nothing possible — keep intended (shown dimmed w/ tag)
}
function validCombo(c, combo){
  const r=methodRules(c);
  if(r.minOne && !combo.length) return false;
  if(r.require && !r.require.every(m=>combo.includes(m))) return false;
  if(r.needsCookFor && combo.includes(r.needsCookFor) && !combo.some(m=>m!==r.needsCookFor&&(m==='sv'||m==='smoke'))) return false;
  if((r.invalid||[]).some(bad=>bad.length===combo.length && bad.every(m=>combo.includes(m)))) return false;
  return combo.every(m=>r.allowed.includes(m));
}
// Compose steps from the active combo. Order: prep → sv → smoke → grill-finish → rest.
function composedSteps(c, combo){
  const has=m=>combo.includes(m);
  const produce=isProduce(c), offal=isOffal(c);
  // single-method fast paths reuse existing generators (already battle-tested)
  if(produce){
    if(has('grill')&&!has('sv')&&!has('smoke')) return produceGrillSteps(c);
    if(has('smoke')&&!has('sv')&&!has('grill')) return produceSmokeSteps(c);
    if(has('sv')&&!has('smoke')&&!has('grill')) return produceSVSteps(c);
  } else {
    if(has('grill')&&combo.length===1) return meatGrillSteps(c);
    if(has('sv')&&has('smoke')&&!has('grill')) return svSteps(c);
    if(has('smoke')&&combo.length===1) return soSteps(c);
  }
  // combinatorial compose
  const steps=[];
  const dtgt=(c.doneness&&typeof donenessTarget==='function')?donenessTarget(c):c.tgt;
  if(offal) steps.push([L("הכנה ייעודית לאיבר","Offal-specific prep"), offalPrep(c), 0]);
  else if(produce) steps.push([L("הכנה","Prep"),L(`שטוף ונקה. חתוך לגודל אחיד. ${c.somid||''}`,`Rinse and clean. Cut to an even size. ${t(c.somid)||''}`),0]);
  else steps.push([L("הכנה","Prep"),L(`יבש היטב במגבת — משטח יבש = צריבה וקרום טובים.`,`Pat thoroughly dry with a towel — a dry surface means a good sear and bark.`),0]);
  if(has('sv')){
    steps.push([L("סו-ויד","Sous-vide"),L(`ואקום ובשל ב-${c.svt}°C למשך ${c.svh} שעות${produce?' — הפקטין מתרכך לרכות מדויקת':c.doneness?` (יעד ${dtgt}° לפי מידת העשייה)`:''}. ${produce?'הוסף חמאה/שמן לשקית.':''}`,`Vacuum-seal and cook at ${c.svt}°C for ${c.svh} hours${produce?' — the pectin softens to a precise tenderness':c.doneness?` (target ${dtgt}° for your doneness)`:''}. ${produce?'Add butter/oil to the bag.':''}`),upperHours(c.svh)*3600]);
    steps.push([L("ייבוש מעבר","Pat dry"),L(`הוצא מהשקית ויבש היטב במגבת — משטח רטוב לא נצרב ולא מעשן טוב.`,`Remove from the bag and pat thoroughly dry — a wet surface won't sear or smoke well.`),0]);
  }
  if(has('smoke')){
    const smkT=has('sv')?c.smt:(c.sot||c.smt), hrs=has('sv')?c.smh:(c.soh||c.smh);
    const woodHe=c.wood&&c.wood!=='ללא'?c.wood:'עצי פרי', woodEn=c.wood&&c.wood!=='ללא'?t(c.wood):'fruit woods';
    const midHe=(!has('sv')&&c.somid&&c.somid!=='אין')?c.somid+'.':'', midEn=(!has('sv')&&c.somid&&c.somid!=='אין')?t(c.somid)+'.':'';
    steps.push([L("עישון","Smoke"),L(`מעשנת ${smkT}°C עם ${woodHe} למשך ${hrs} שעות${has('sv')?' — לעשן וקרום בלבד, הבישול כבר נעשה':''}. ${midHe}`,`Smoker at ${smkT}°C with ${woodEn} for ${hrs} hours${has('sv')?" — for smoke and bark only, it's already cooked":''}. ${midEn}`),upperHours(hrs)*3600]);
  }
  if(has('grill')){
    steps.push([L("גימור גריל / צריבה","Grill finish / sear"),L(`אש ישירה חמה: ${has('sv')||has('smoke')?'צריבה קצרה 1-2 דק׳/צד לקרום, צבע וטעם אש — הפנים כבר מוכן':'צלה 2-4 דק׳/צד עד מדחום '+(dtgt? (Math.max(40,dtgt-4)+'° (יעד '+dtgt+'°)') : 'מוכנות')}.`,`Hot direct heat: ${has('sv')||has('smoke')?'a quick 1-2 min/side sear for crust, color and fire flavor — the inside is already done':'grill 2-4 min/side to a thermometer reading of '+(dtgt? (Math.max(40,dtgt-4)+'° (target '+dtgt+'°)') : 'doneness')}.`),240]);
  }
  if(!produce||c.rest) steps.push([L("מנוחה והגשה","Rest & serve"),L(`${c.rest||5} דק׳ מנוחה. ${offal?'הגש עם לימון/צ׳ימיצ׳ורי.':produce?'תבל והגש.':'פרוס נגד הסיב.'}`,`${c.rest||5} min rest. ${offal?'Serve with lemon/chimichurri.':produce?'Season and serve.':'Slice against the grain.'}`),(c.rest||5)*60]);
  return steps;
}
const SMOKER_TIPS={
  'ארון / קבינט':'מעשנת ארון: טמפ׳ יציב מאוד — מצוין ל-low & slow ארוך. נצל את המדפים לכמות. זרימת אוויר נמוכה יחסית — ודא pellicle יבש לפני העישון כדי שהעשן ייצמד.',
  'אופסט / סטיק-ברנר':'אופסט: נהל אש קטנה ונקייה (עשן כחלחל). הצד העבה/שומן לכיוון תא-האש, וסובב את הנתח באמצע — יש הפרש חום לאורך התא.',
  'פלטים':'פלט: שגר-ושכח. לעשן חזק יותר — הוסף צינור/מבוך עשן (smoke tube), ועשן ב-max smoke בשעתיים הראשונות כשהבשר קר.',
  'קמאדו / קרמי':'קמאדו: יציב וחסכוני. שים דפלקטור לחום עקיף, כוונן בעדינות עם הפתחים, והמתן שהטמפ׳ תתייצב לפני הכנסת הבשר.',
  'WSM / חבית':'WSM/חבית: מלא את קערת המים לייצוב, שיטת מיניון לפחם, ושמור את הפתחים התחתונים לכיוון האש.',
  'קטל (ככלי עישון)':'קטל: הגדר 2 אזורים (גחלים בצד), הבשר בצד הקר, נתח עץ על הגחלים. הוסף פחם כל ~שעה.',
  'גז (עם תיבת עשן)':'גז: הדלק מבער אחד בלבד לחום עקיף, תיבת עשן עם שבבים על המבער הפעיל, והבשר בצד הכבוי.',
  'חשמלי':'חשמלי: יציב וקל אך עשן חלש — הוסף שבבים לאורך הבישול לשמירת עשן רציף.'
};
const SMOKER_TIPS_EN={
  'ארון / קבינט':'Cabinet smoker: very stable temp — great for long low & slow. Use the shelves for volume. Relatively low airflow — make sure the pellicle is dry before smoking so smoke sticks.',
  'אופסט / סטיק-ברנר':'Offset: run a small, clean fire (bluish smoke). Thick/fat side toward the firebox, and rotate the cut halfway — there is a heat gradient along the chamber.',
  'פלטים':'Pellet: set-and-forget. For heavier smoke — add a smoke tube/maze, and run max smoke for the first two hours while the meat is cold.',
  'קמאדו / קרמי':'Kamado: stable and efficient. Add a deflector for indirect heat, tune gently with the vents, and wait for the temp to stabilize before adding the meat.',
  'WSM / חבית':'WSM/drum: fill the water bowl to stabilize, Minion method for the coals, and keep the bottom vents toward the fire.',
  'קטל (ככלי עישון)':'Kettle: set up 2 zones (coals to one side), meat on the cool side, a wood chunk on the coals. Add charcoal about every ~hour.',
  'גז (עם תיבת עשן)':'Gas: light just one burner for indirect heat, a smoke box with chips over the lit burner, and the meat on the off side.',
  'חשמלי':'Electric: stable and easy but weak smoke — add chips throughout the cook to keep smoke continuous.'
};
function smokerTip(){ if(!equipConfigured()) return ''; const d=primaryOf('smoker'); return d?((getLang()==='he'?SMOKER_TIPS:SMOKER_TIPS_EN)[d.type]||''):''; }
// ── equipment → plan (Phase 3, the seam that was waived) ──────────────────────────────────────
// ONE table for how long a cooker takes to stabilize: `mins` drives the SCHEDULED light-up, the label
// describes it. They cannot drift apart, which was D1 — the plan hard-coded 45 minutes while this advice
// separately said a pellet needs ~15, so a pellet owner was told two different things at once. `mins` is
// the upper end of each range: being ready early is safe, being late is not.
const PREHEAT={
  'פלטים':            {mins:15, he:'~15 דק׳ (פלט מתחמם מהר)', en:'~15 min (pellet heats fast)'},
  'גז (עם תיבת עשן)': {mins:15, he:'~10–15 דק׳',              en:'~10–15 min'},
  'חשמלי':            {mins:30, he:'~20–30 דק׳',              en:'~20–30 min'},
  'ארון / קבינט':     {mins:30, he:'~20–30 דק׳',              en:'~20–30 min'},
  _charcoal:          {mins:45, he:'ארובת פחם ~30–45 דק׳',    en:'Charcoal chimney ~30–45 min'},
  _none:              {mins:45, he:'45 דק׳ ייצוב',            en:'45 min to stabilize'}
};
function _preheatRow(){
  if(typeof equipConfigured!=='function' || !equipConfigured()) return PREHEAT._none;
  const d=primaryOf('smoker'), s=d&&d.type;
  if(!s || s==='אין') return PREHEAT._none;
  return PREHEAT[s] || PREHEAT._charcoal;
}
function preheatMinutes(){ return _preheatRow().mins; }
function preheatHint(){ const r=_preheatRow(); return L(r.he, r.en); }
// How often a device needs more fuel. A device fact, not a recipe fact (D4): a pellet hopper feeds itself,
// a stick burner does not. 0 = nothing to schedule — and an unknown device gets 0 rather than an invented
// cadence. Only applied when the cook actually outlasts one load.
const REFUEL_MIN={
  'אופסט / סטיק-ברנר':45,   // stick burner: a fresh split roughly every 45 min
  'WSM / חבית':90,          // Minion-method drum burns long, but not all day
  'קטל (ככלי עישון)':60,    // a kettle is small — top up about hourly
  'קמאדו / קרמי':0,         // ceramic holds a single load for many hours
  'פלטים':0, 'גז (עם תיבת עשן)':0, 'חשמלי':0, 'ארון / קבינט':0
};
const DEVICE_FUEL={
  'פלטים':{he:'פלטים',en:'pellets'}, 'גז (עם תיבת עשן)':{he:'גז',en:'gas'}, 'חשמלי':{he:'חשמל',en:'electric'},
  'WSM / חבית':{he:'פחם',en:'charcoal'}, 'קטל (ככלי עישון)':{he:'פחם',en:'charcoal'},
  'קמאדו / קרמי':{he:'פחם',en:'charcoal'}, 'אופסט / סטיק-ברנר':{he:'עצים',en:'wood'}
};
// The seam itself: equipment facts enter stage generation HERE and nowhere else. Pure — it returns enriched
// copies and never writes onto the caller's stages — and a complete no-op when no kit is configured, so the
// app behaves exactly as before for a user who has not described their gear.
// It may ENRICH a stage. It may never change one: no duration, no temperature, no kind, no order.
function equipPlan(meta, methodKey, stages, scope){
  const list=stages||[];
  if(typeof equipConfigured!=='function' || !equipConfigured()) return list;
  return list.map(function(s){
    if(!s || ['smoke','cook'].indexOf(s.kind)<0) return s;
    const dev=(typeof cookerFor==='function')?cookerFor(meta&&meta.key, s.kind, scope):null;
    if(!dev) return s;
    const out=Object.assign({}, s);
    const f=DEVICE_FUEL[dev.type]; if(f) out.fuelNote=L(f.he, f.en);
    const rf=REFUEL_MIN[dev.type]||0;
    if(rf>0 && (Number(s.hours)||0)*60 > rf) out.refuelEveryMin=rf;   // only when the cook outlasts one load
    return out;
  });
}
function gearMissingHelp(c, methods){
  const items=methods.map(m=>{
    if(m==='sv'){
      const alt=(c.sot?L(`עישון-בלבד (הנתח תומך: ~${c.soh}ש ב-${c.sot}°C)`,`Smoke-only (this cut supports it: ~${c.soh}h at ${c.sot}°C)`):(canSmoke()?L('עישון','Smoking'):canGrill()?L('גריל עם גימור זהיר','Grill with a careful finish'):L('בישול איטי בתנור','Slow-cook in the oven')));
      return {ic:'🌊',name:L('סו-ויד','Sous-vide'),alt,altnote:L('מרקם: סו-ויד נותן אחידות פנימית; החלופה תיתן קרום/עישון חזק יותר.','Texture: sous-vide gives internal uniformity; the alternative gives a stronger crust/smoke.'),buy:L('סו-ויד טבילה (immersion) — קומפקטי וזול יחסית.','Immersion sous-vide — compact and relatively cheap.')};
    }
    if(m==='smoke'){
      const alt=(canGrill()?L('עישון בגריל עקיף (2-zone) עם תיבת עשן / נתחי עץ על הגחלים','Smoke on an indirect grill (2-zone) with a smoke box / wood chunks on the coals'):(canSV()?L('סו-ויד + גימור (בלי טעם עשן)','Sous-vide + finish (no smoke flavor)'):L('בישול בתנור נמוך','Cook in a low oven')));
      return {ic:'💨',name:L('עישון','Smoking'),alt,altnote:L('ללא מעשנה ייעודית, גריל עקיף עם עץ נותן טעם עשן טוב.','Without a dedicated smoker, an indirect grill with wood gives good smoke flavor.'),buy:L('מעשנת פחם (WSM/חבית), קמאדו, או ארון.','A charcoal smoker (WSM/drum), kamado, or cabinet.')};
    }
    if(m==='grill'){
      const alt=hasGear('torch')?L('גימור במבער/לפיד','Finish with a torch'):L('צריבה במחבת ברזל-יצוק חמה מאוד','Sear in a very hot cast-iron pan');
      return {ic:'🔥',name:L('גריל','Grill'),alt,altnote:L('לגימור/צריבה — מחבת ברזל יצוק או מבער נותנים קרום מצוין.','For finishing/searing — a cast-iron pan or a torch gives an excellent crust.'),buy:L('גריל פחם/גז, או מבער ידני לגימור.','A charcoal/gas grill, or a handheld torch for finishing.')};
    }
    return null;
  }).filter(Boolean);
  if(!items.length) return '';
  return `<div class="gear-alt">${items.map(it=>`<div class="ga-row"><div class="ga-h">${it.ic} ${L('אין לך','You have no')} <b>${it.name}</b></div>
    <div class="ga-line">↳ <b>${L('חלופה','Alternative')}:</b> ${it.alt}</div>
    <div class="ga-sub">${it.altnote}</div>
    <div class="ga-line">🛒 <b>${L('לשדרוג','To upgrade')}:</b> ${it.buy}</div></div>`).join('')}
    <div class="ga-foot">🔒 ${L('אפשר להפעיל בכל זאת (override) אם יש גישה זמנית · לעדכון הציוד: ☰ ← הציוד שלי.','You can enable it anyway (override) if you have temporary access · to update gear: ☰ ← My gear.')}</div></div>`;
}
function methodToggleHTML(c,key){
  const r=methodRules(c), act=ctxMethods(c,key);
  const defs=[['sv',L('🌊 סו-ויד','🌊 Sous-vide')],['smoke',L('💨 עישון','💨 Smoke')],['grill',L('🔥 גריל','🔥 Grill')]];
  const offMethods=[];
  const row=`<div class="mtoggles" data-mtkey="${key}">${defs.map(([m,l])=>{
    const allowed=r.allowed.includes(m), on=act.includes(m);
    const gearOff=allowed && !gearCan(m); if(gearOff) offMethods.push(m);
    const cls=`mtoggle ${on?'on':''} ${allowed?'':'locked'} ${gearOff?'gear-off':''}`;
    const tag=gearOff?` <span class="gear-tag">🔒</span>`:'';
    return `<button class="${cls}" data-mt="${m}" ${allowed?'':`disabled title="${L('לא זמין לפריט זה','Not available for this item')}"`}>${l}${tag}</button>`;
  }).join('')}<span class="mtoggle-hint">${L('שיטות פעילות — התוכנית מתעדכנת','Active methods — the plan updates')}</span></div>`;
  let extra='';
  if(act.includes('smoke')){ const tip=smokerTip(); if(tip) extra+=`<div class="smoker-tip">💡 <b>${L('טיפ למעשנה שלך','Tip for your smoker')}:</b> ${tip}</div>`; }
  extra+=gearThermoNote(c);
  return row + gearMissingHelp(c, offMethods) + extra;
}
function gearThermoNote(c){
  if(!equipConfigured()) return ''; const probes=equipByCat('probe'); const th=(probes.find(function(p){return p.type==='בקר-מאוורר';})||probes[0]||{}).type||null;
  if(!th || th==='אין') return `<div class="thermo-note">🌡️ <b>${L('אין לך מדחום','You have no thermometer')}:</b> ${L('עבוד לפי זמן ומבחני מגע/צבע. לבטיחות (בעיקר עוף ובשר טחון) — מדחום מיידי הוא הדבר הכי מומלץ לרכוש; בלעדיו קשה לוודא','Work by time and touch/color tests. For safety (especially poultry and ground meat) — an instant-read thermometer is the top recommended buy; without it, it is hard to verify')} ${c&&c.safe?c.safe+'°C':L('טמפ׳ בטוחה','a safe temp')} ${L('במרכז','in the center')}.</div>`;
  if(th==='בקר-מאוורר') return `<div class="thermo-note ok">🌡️ <b>${L('בקר-מאוורר','Leave-in probe')}:</b> ${L('הגדר יעד פיט ופרוב בשר — הוא ישמור על הטמפ׳ ויתריע. "הגדר ולך".','Set a pit target and a meat probe — it will hold the temp and alert you. "Set and forget."')}</div>`;
  return '';
}

/* ---------- recipe engine ---------- */
function isProduce(c){return c.cat==='ירקות'||c.cat==='פירות';}
function isOffal(c){return c.cat==='איברים פנימיים';}
function isGrillableMeat(c){ return !isProduce(c) && (!!c.doneness || isOffal(c)); }  // fast cuts + all offal (asado classics)
function offalPrep(c){
  const e=c.eng||'';
  if(e.includes('Sweetbread')) return L("בלאנץ׳ 3-5 דק׳ במים רותחים עם לימון → אמבט קרח → קלף קרום → ייבוש ולחיצה קלה במקרר שעה. זה הסוד למרקם קריספי-קרמי.","Blanch 3-5 min in boiling water with lemon → ice bath → peel the membrane → dry and press lightly in the fridge for an hour. This is the secret to a crispy-creamy texture.");
  if(e.includes('Kidney'))     return L("חצה, הסר את הליבה הלבנה, והשרה בחלב/מי-מלח 30-60 דק׳ להעדנת הטעם. יבש היטב.","Halve, remove the white core, and soak in milk/brine for 30-60 min to mellow the flavor. Pat thoroughly dry.");
  if(e.includes('Brain'))      return L("השרה במים קרים שעה, קלף קרומים בעדינות, בלאנץ׳ קצר 2-3 דק׳ במים עם חומץ → קרח. עדין מאוד — טפל ברכות.","Soak in cold water for an hour, gently peel the membranes, blanch briefly 2-3 min in water with vinegar → ice. Very delicate — handle gently.");
  if(e.includes('Gizzard'))    return L("קורקבנים חייבים בישול-מקדים לרכות: סו-ויד 90° או בישול איטי עד רכים, רק אז לגריל לחריכה קצרה.","Gizzards need a pre-cook to tenderize: sous-vide 90° or slow-cook until tender, only then grill for a quick sear.");
  if(e.includes('Liver'))      return L("הסר קרומים וכלי דם. פרוס עבה (2 ס\"מ) כדי שלא יתייבש. אפשר השריה קצרה בחלב לעידון.","Remove membranes and blood vessels. Slice thick (2 cm) so it doesn't dry out. A short milk soak can mellow it.");
  return L("נקה קרומים ושומן עודף, יבש היטב. חתוך לגודל אחיד.","Clean off membranes and excess fat, pat thoroughly dry. Cut to an even size.");
}
function offalDoneNote(c){
  const e=c.eng||'';
  if(e.includes('Heart')) return L(`צלה חם ומהיר כמו סטייק — מדחום פנים ${c.tgt}°.`,`Grill hot and fast like a steak — ${c.tgt}° internal.`);
  if(e.includes('Liver')||e.includes('Kidney')) return L(`בטיחות: בשל עד ${c.tgt}° — ללא ורוד (איבר נקבובי).`,`Safety: cook to ${c.tgt}° — no pink (a porous organ).`);
  if(e.includes('Sweetbread')||e.includes('Brain')) return L(`צלה עד זהוב-קריספי מבחוץ וקרמי בפנים (~${c.tgt}°).`,`Grill until golden-crispy outside and creamy inside (~${c.tgt}°).`);
  if(e.includes('Gizzard')) return L(`אחרי הריכוך — רק חריכה קצרה לטעם אש.`,`After tenderizing — just a quick sear for fire flavor.`);
  return L(`יעד פנים ${c.tgt}°.`,`${c.tgt}° internal target.`);
}
function meatGrillSteps(c){
  const dtgt=(typeof donenessTarget==='function' && c.doneness)? donenessTarget(c) : c.tgt;
  const pull=Math.max(40, dtgt-4);   // pull ~4° early for carryover
  const offal=isOffal(c);
  const steps=[];
  if(offal){
    steps.push([L("הכנה ייעודית לאיבר","Offal-specific prep"), offalPrep(c), 0]);
    steps.push([L("הכנה לצלייה","Prep for grilling"),L(`שיפוד עוזר לחלקים קטנים (לבבות/כליות). את התיבול עושים קרוב לצלייה — מלח מוקדם מוציא נוזלים.`,`A skewer helps with small pieces (hearts/kidneys). Season close to grilling — early salt draws out moisture.`),0]);
    steps.push([L("חימום גריל","Heat the grill"),L(`אש ישירה חמה-בינונית. חמם שבכה 10 דק׳, נקה ושמן קלות (על האוכל, לא השבכה).`,`Medium-hot direct heat. Preheat the grate 10 min, clean and oil lightly (the food, not the grate).`),0]);
    steps.push([L("צלייה","Grill"),L(`צלה 2-4 דק׳/צד עד השחמה יפה. ${offalDoneNote(c)}`,`Grill 2-4 min/side to a nice sear. ${offalDoneNote(c)}`),300]);
    steps.push([L("הגשה","Serve"),L(`מנוחה קצרה ${c.rest||3} דק׳. הגש עם לימון/צ׳ימיצ׳ורי — הקלאסיקה של האסאדו.`,`A short ${c.rest||3} min rest. Serve with lemon/chimichurri — the asado classic.`),(c.rest||3)*60]);
    return steps;
  }
  steps.push([L("טמפרטורת חדר","Room temperature"),L(`הוצא מהמקרר 30-40 דק׳ לפני. יבש היטב במגבת — משטח יבש = צריבה טובה.`,`Take out of the fridge 30-40 min ahead. Pat thoroughly dry — a dry surface means a good sear.`),0]);
  steps.push([L("2 אזורים + חימום","2 zones + heat"),L(`בנה שני אזורים: צד חם מאוד (ישיר, 250°+) וצד קר (עקיף). חמם את השבכה 10-15 דק׳ ונקה.`,`Build two zones: a very hot side (direct, 250°+) and a cool side (indirect). Preheat the grate 10-15 min and clean.`),0]);
  steps.push([L("צריבה על אש ישירה","Sear over direct heat"),L(`הנח על הצד החם וצרוב 2-4 דק׳/צד עד קרום וסימני שבכה. הפוך פעם אחת (אל תזיז מוקדם מדי).`,`Place on the hot side and sear 2-4 min/side to a crust and grate marks. Flip once (don't move it too early).`),300]);
  steps.push([L("גמר באזור הקר + מדחום","Finish on the cool zone + thermometer"),L(`העבר לצד הקר וסגור מכסה. בשל עד מדחום פנים ${pull}° (יעד ${dtgt}° אחרי carryover). נתח דק — דלג ישר לכאן.`,`Move to the cool side and close the lid. Cook to ${pull}° internal (target ${dtgt}° after carryover). Thin cut — skip straight to here.`),0]);
  steps.push([L("מנוחה","Rest"),L(`הנח לנוח ${c.rest||5} דק׳ — הטמפ׳ תעלה עוד ~3-5° והמיצים יתייצבו. פרוס נגד הסיב.`,`Let it rest ${c.rest||5} min — the temp will climb another ~3-5° and the juices will settle. Slice against the grain.`),(c.rest||5)*60]);
  return steps;
}
// ── context-scoped seasoning: template stays clean, instance saved per cook/event/project ──
function seasCtx(){
  if(curProject) return 'proj:'+curProject;
  if(typeof menuCtx==='function' && menuCtx()==='event'){ const a=(typeof evActive==='function')?evActive():null; return 'ev:'+(a||'cur'); }
  return 'cook';
}
function seasKeyFor(key){ return 'seas:'+seasCtx()+':'+key; }
function houseRubId(key){ return (DATA.houseRub||{})[key]||null; }
// raw stored value: null = not customized (use template default), ['__none__'] = explicit none
function rawSeas(key){ const v=store.get(seasKeyFor(key)); return Array.isArray(v)?v:null; }
function selectedSeasonings(key){
  const raw=rawSeas(key);
  if(raw===null){ const hr=houseRubId(key); return hr?[hr]:[]; }   // template default = house rub
  if(raw.length===1 && raw[0]==='__none__') return [];             // explicit "ללא"
  return raw.filter(x=>x!=='__none__');
}
function toggleSeasoning(key,id){
  const cur=selectedSeasonings(key);
  let next=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
  if(!next.length) next=['__none__'];   // persist explicit none so default doesn't re-appear
  store.set(seasKeyFor(key),next);
  return !cur.includes(id);
}
function seasoningById(id){return (DATA.seasonings||[]).find(s=>s.id===id);}
// inject selected seasonings into a composed step plan
function injectSeasoningSteps(steps, key, tmpl){
  const src=tmpl ? (houseRubId(key)?[houseRubId(key)]:[]) : selectedSeasonings(key);
  const sel=src.map(seasoningById).filter(Boolean);
  if(!sel.length){ const out=[...steps]; out.splice(1,0,[L('🧂 תיבול בסיסי','🧂 Basic seasoning'),L(`מלח גס נדיב (ופלפל) מכל הצדדים — גם בלי ראב, מלח הוא חובה.`,`Generous coarse salt (and pepper) on all sides — even without a rub, salt is a must.`),0]); return out; }
  const out=[...steps];
  const marinades=sel.filter(s=>s.kind==='marinade');
  const rubs=sel.filter(s=>s.kind==='rub');
  const glazes=sel.filter(s=>s.kind==='glaze');
  const sauces=sel.filter(s=>s.kind==='sauce');
  let ins=1; // after first prep step
  marinades.forEach(s=>{ out.splice(ins++,0,[L(`🥣 מרינדה: ${s.heb}`,`🥣 Marinade: ${itemName(s)}`),L(`${s.ing} — ${s.use}`,`${t(s.ing)} — ${t(s.use)}`),0]); });
  rubs.forEach(s=>{ out.splice(ins++,0,[L(`🌶️ ראב: ${s.heb}`,`🌶️ Rub: ${itemName(s)}`),L(`${s.ing} — שפשף היטב לפני הבישול.`,`${t(s.ing)} — rub in well before cooking.`),0]); });
  // glaze before the rest step (or at end)
  let restIdx=out.findIndex(st=>st[0].includes('מנוחה')||st[0].toLowerCase().includes('rest'));
  if(restIdx<0) restIdx=out.length;
  glazes.forEach(s=>{ out.splice(restIdx++,0,[L(`🍯 גלייז: ${s.heb}`,`🍯 Glaze: ${itemName(s)}`),L(`${s.ing} — מברישים ב-10-15 הדקות האחרונות של הבישול, בשכבות.`,`${t(s.ing)} — brush on in the last 10-15 minutes of cooking, in layers.`),0]); });
  sauces.forEach(s=>{ out.splice(restIdx+1,0,[L(`🥄 רוטב הגשה: ${s.heb}`,`🥄 Serving sauce: ${itemName(s)}`),L(`${s.ing} — אפשר להכין מראש (אפילו יום קודם). הגש לצד.`,`${t(s.ing)} — can be made ahead (even a day before). Serve on the side.`),0]); restIdx++; });
  return out;
}
const KIND_LABEL={rub:'ראב יבש',marinade:'מרינדה',glaze:'גלייז',sauce:'רוטב'};
const KIND_LABEL_EN={rub:'Dry rub',marinade:'Marinade',glaze:'Glaze',sauce:'Sauce'};
function kindLabel(k){ return (getLang()==='he'?KIND_LABEL:KIND_LABEL_EN)[k]||k; }
const KIND_EMOJI={rub:'🌶️',marinade:'🥣',glaze:'🍯',sauce:'🥄'};
function seasoningsFor(cat, produce){
  return (DATA.seasonings||[]).filter(s=> produce? s.produce : s.cats.includes(cat));
}
function cont2color(cont){return {'אמריקה':'#c0563a','דרום אמריקה':'#4f8a3d','ישראל/מזה"ת':'#d99a2b','אפריקה':'#a24d5e','אירופה':'#7a90c2','אסיה':'#c94f6d'}[cont]||'#b5603a';}
function seasoningDetailHTML(s){
  return `<div class="seas-detail">
    <div class="seas-head"><span class="seas-kind" style="--sc:${cont2color(s.cont)}">${KIND_EMOJI[s.kind]} ${kindLabel(s.kind)}</span><span class="seas-origin">${t(s.origin)}</span></div>
    <h3 class="seas-title">${itemName(s)}${getLang()==='he'?` <small>${s.eng}</small>`:''}</h3>
    <div class="seas-sec"><h5>${L('מרכיבים ויחסים','Ingredients & ratios')}</h5><p>${t(s.ing)}</p></div>
    <div class="seas-sec"><h5>${L('שימוש והכנה','Use & prep')}</h5><p>${t(s.use)}</p></div>
    <div class="seas-sec"><h5>${L('מתאים ל־','Pairs with')}</h5><p>${s.produce?L('ירקות ופירות · ','Vegetables & fruit · '):''}${s.cats.map(x=>t(x)).join(' · ')}</p></div>
    ${s.sub?`<div class="seas-sec seas-sub"><h5>${L('⚠ תחליף בישראל','⚠ Substitute in Israel')}</h5><p>${t(s.sub)}</p></div>`:''}
  </div>`;
}
let seasFilter={kind:'', cont:'', cat:'', q:'', flavor:'', base:'', heat:''};
let seasCtxKey=null; // when set, browser cards get a ＋ button adding to this instance
/* ══════════ unified seasoning picker (Phase C) ══════════
   5 filter axes: ⭐recommended · 🌍continent · 👅flavor · 🧪base · 🌶️heat
   one-per-kind selection · house rub default · explicit "ללא" · per-recipe recs */
const SPK_FLAVORS=['מתוק','חמצמץ','חריף','מעושן','עשבי','הדרי','ארומטי-חם','אגוזי','אומאמי'];
const SPK_BASES=['יבש','שמן','יוגורט','עגבניות','רכז-פירות','חמאה'];
const SPK_HEAT=[[0,'😌 עדין'],[1,'🌶 קל'],[2,'🌶🌶 חריף'],[3,'🔥 בוער']];
const SPK_HEAT_EN={0:'😌 Mild',1:'🌶 Light',2:'🌶🌶 Spicy',3:'🔥 Blazing'};
function heatLabel(v,heLabel){ return getLang()==='he'?heLabel:(SPK_HEAT_EN[v]||heLabel); }
const SPK_CONTS=['אמריקה','דרום אמריקה','אירופה','אסיה','אפריקה','ישראל/מזה"ת'];
let seasPkState={};
function spkState(key){ return seasPkState[key]=seasPkState[key]||{axis:'rec',val:'',expand:{}}; }
// per-recipe recommendations: house rub ALWAYS first, then spread across kinds for this category
function recsFor(key, cat, isProd){
  const all=seasoningsFor(cat,isProd);
  const hr=key?houseRubId(key):null;
  const out=[]; const seen=new Set();
  if(hr){ const h=seasoningById(hr); if(h){ out.push(h); seen.add(hr); } }
  const order=['rub','marinade','glaze','sauce'];
  const perKind={}; all.forEach(s=>{ if(!seen.has(s.id)){ (perKind[s.kind]=perKind[s.kind]||[]).push(s); } });
  let i=0; while(out.length<8 && i<24){ const k=order[i%4]; if(perKind[k]&&perKind[k].length){ const s=perKind[k].shift(); out.push(s); seen.add(s.id); } i++; if(i>=4 && !order.some(k=>perKind[k]&&perKind[k].length)) break; }
  return out;
}
function spkChip(s, opts){
  const sel=opts.selected, house=opts.house, rec=opts.rec, mode=opts.mode;
  const marks=(house?'🏠':'')+(rec&&!house?'⭐':'');
  const heatDots=s.heat?('🌶'.repeat(Math.min(s.heat,3))):'';
  return `<div class="spk-chip ${sel?'sel':''} ${house?'house':''}">
    <button class="spk-info" data-spkinfo="${s.id}" title="${L('הצג פרטים','Show details')} · ${t(s.origin||'')}">${marks?`<span class="spk-mark">${marks}</span>`:''}<span class="spk-heb">${itemName(s)}</span>${heatDots?`<span class="spk-heat">${heatDots}</span>`:''}</button>
    <button class="spk-add" data-spkpick="${s.id}" data-spkkind="${s.kind}" ${mode==='view'?'disabled':''} title="${sel?L('הסר מהמופע','Remove from instance'):L('הוסף למופע','Add to instance')}">${sel?'✓':'＋'}</button>
  </div>`;
}
function seasPickerHTML(key, cat, isProd, mode){
  const st=spkState(key);
  const all=seasoningsFor(cat,isProd);
  if(!all.length) return '';
  const recs=recsFor(key,cat,isProd);
  const recIds=new Set(recs.map(s=>s.id));
  const hr=key?houseRubId(key):null;
  const picked=(mode==='view') ? (hr?[hr]:[]) : selectedSeasonings(key);   // view = template default, never the instance
  // axis filtering
  const match=s=>{
    if(st.axis==='rec') return recIds.has(s.id);
    if(st.axis==='cont') return !st.val || s.cont===st.val;
    if(st.axis==='flavor') return !st.val || (s.flavor||[]).includes(st.val);
    if(st.axis==='base') return !st.val || s.base===st.val;
    if(st.axis==='heat') return st.val==='' || String(s.heat)===String(st.val);
    return true;
  };
  const AX=[['rec',L('⭐ מומלצים','⭐ Recommended')],['cont',L('🌍 מדינה','🌍 Country')],['flavor',L('👅 טעם','👅 Flavor')],['base',L('🧪 בסיס','🧪 Base')],['heat',L('🌶️ חריפות','🌶️ Heat')]];
  const tabs=`<div class="spk-tabs">${AX.map(([a,l])=>`<button class="spk-tab ${st.axis===a?'on':''}" data-spkaxis="${a}">${l}</button>`).join('')}${(typeof aiAvail==='function'&&aiAvail()&&mode!=='view')?`<button class="spk-tab spk-ai" data-spkairec style="background:var(--fresh-l);border-color:var(--fresh);color:var(--fresh)">✨ ${L('המלץ AI','AI suggest')}</button>`:''}</div>`;
  let vals='';
  if(st.axis==='cont') vals=SPK_CONTS.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${t(v)}</button>`).join('');
  else if(st.axis==='flavor') vals=SPK_FLAVORS.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${t(v)}</button>`).join('');
  else if(st.axis==='base') vals=SPK_BASES.map(v=>`<button class="spk-val ${st.val===v?'on':''}" data-spkval="${v}">${t(v)}</button>`).join('');
  else if(st.axis==='heat') vals=SPK_HEAT.map(([v,l])=>`<button class="spk-val ${String(st.val)===String(v)?'on':''}" data-spkval="${v}">${heatLabel(v,l)}</button>`).join('');
  const valsRow=vals?`<div class="spk-vals">${vals}</div>`:'';
  const KE=KIND_EMOJI;
  const kinds=['rub','marinade','glaze','sauce'].map(kind=>{
    const inKind=all.filter(s=>s.kind===kind);
    if(!inKind.length) return '';
    let list=inKind.filter(match);
    // recommended pinned first within the kind
    list.sort((a,b)=>(recIds.has(b.id)-recIds.has(a.id)) || ((b.id===hr)-(a.id===hr)));
    if(a=>a){ /* noop */ }
    const curSel=picked.find(id=>{const s=seasoningById(id);return s&&s.kind===kind;})||'';
    const CAP=12; const exp=st.expand[kind];
    const shown=exp?list:list.slice(0,CAP);
    const noneChip=`<div class="spk-chip none ${!curSel?'sel':''}"><button class="spk-only" data-spknone="${kind}" ${mode==='view'?'disabled':''}>${L('ללא','None')}${!curSel?' ✓':''}</button></div>`;
    const more=list.length>CAP&&!exp?`<button class="spk-more" data-spkmore="${kind}">${L('עוד','More')} ${list.length-CAP} ›</button>`:'';
    const empty=!list.length?`<span class="spk-empty">${L('אין','No')} ${kindLabel(kind)} ${L('בסינון הזה','in this filter')}</span>`:'';
    return `<div class="spk-kind"><div class="spk-kh">${KE[kind]} ${kindLabel(kind)}${curSel?` <b class="spk-cur">· ${itemName(seasoningById(curSel)||{})}</b>`:''}</div>
      <div class="spk-chips">${noneChip}${shown.map(s=>spkChip(s,{selected:picked.includes(s.id),house:s.id===hr,rec:recIds.has(s.id),mode})).join('')}${more}${empty}</div></div>`;
  }).join('');
  const inEvent=(typeof menuCtx==='function'&&menuCtx()==='event');
  const otherKeys=(()=>{ try{ const m=menuState(); return (m.keys||[]).filter(k=>k!==key).length; }catch(e){ return 0; } })();
  const ctaButtons=inEvent
    ? `<button class="spk-editbtn" data-spkgotl="1">🧂 ${L('לבחירת תיבול באשף האירוע ←','Choose seasoning in the event wizard →')}</button>`
    : (otherKeys>0
        ? `<button class="spk-editbtn" data-spkfresh="1">🍳 ${L('בישול חדש — רק הפריט הזה','New cook — just this item')}</button> <button class="spk-editbtn" data-spkgotl="1">➕ ${L('צרף לתוכנית','Add to plan')} (${otherKeys})</button>`
        : `<button class="spk-editbtn" data-spkgotl="1">🧂 ${L('בחר תיבול ותזמן ←','Pick seasoning and schedule →')}</button>`);
  const viewNote=mode==='view'?`<div class="spk-viewnote">📌 ${L('תצוגת תבנית — ראב הבית 🏠 הוא ברירת המחדל. התאמה אישית נעשית בביצוע ונשמרת לו בלבד.','Template view — the house rub 🏠 is the default. Customization happens at cook time and is saved only there.')} ${ctaButtons}</div>`:'';
  const cnt=picked.length;
  return `<div class="var spk-box" id="spk-${key}">
    <h4>🧂 ${L('תיבול','Seasoning')} ${mode==='view'?`<span style="font-weight:400;font-size:11.5px;color:var(--smoke)">(${L('תבנית · ברירת מחדל: ראב הבית','template · default: house rub')})</span>`:(cnt?`<span class="seas-count">· ${cnt} ${L('נבחרו','selected')}</span>`:'')}</h4>
    ${viewNote}${mode==='edit'?tabs+valsRow:''}${kinds}
    <button class="seasoning-more" data-seasall="${isProd?'__produce':cat}">📖 ${L('דפדוף מלא במאגר ›','Full browse of the database ›')}</button>
  </div>`;
}
function spkGoInstance(key, backFn, fresh){
  const m=(typeof menuState==='function')?menuState():{keys:[]};
  m.keys=m.keys||[];
  if(fresh){ m.keys=[key]; if(typeof saveMenu==='function') saveMenu(m); }
  else if(!m.keys.includes(key)){ m.keys.push(key); if(typeof saveMenu==='function') saveMenu(m); }
  if(typeof updateCartBadge==='function') updateCartBadge();
  window._tlSeasOpen=window._tlSeasOpen||new Set(); window._tlSeasOpen.add(key);
  const ev=(typeof menuCtx==='function'&&menuCtx()==='event');
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwGo==='function') cwGo(3);
  if(typeof toast==='function') toast(ev?'הפריט נוסף לאירוע — בחר תיבול כאן':(fresh?'בישול חדש נפתח — בחר תיבול':'הפריט צורף — בחר תיבול'));
}
function wireSeasPicker(host, key, cat, isProd, mode, onChange, backFn){
  const box=host.querySelector('#spk-'+CSS.escape(key)); if(!box) return;
  const rerender=()=>{ const nb=document.createElement('div'); nb.innerHTML=seasPickerHTML(key,cat,isProd,spkState(key).mode||mode); box.replaceWith(nb.firstElementChild); wireSeasPicker(host,key,cat,isProd,mode,onChange,backFn); };
  box.querySelectorAll('[data-spkinfo]').forEach(ib=>ib.addEventListener('click',()=>{
    const s=seasoningById(ib.dataset.spkinfo); if(!s) return;
    const show=()=>showPanel(`${toolTop(s.heb, s.eng+' · '+s.origin, KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
    if(backFn && typeof openFrom==='function') openFrom(backFn, show); else show();
  }));
  box.querySelectorAll('[data-seasall]').forEach(mb=>mb.addEventListener('click',()=>{
    const val=mb.dataset.seasall;
    if(backFn && typeof openFrom==='function') openFrom(backFn, ()=>openSeasonings(val, key));
    else openSeasonings(val, key);
  }));
  box.querySelectorAll('[data-spkaxis]').forEach(b=>b.addEventListener('click',()=>{ const st=spkState(key); st.axis=b.dataset.spkaxis; st.val=''; rerender(); }));
  box.querySelectorAll('[data-spkairec]').forEach(b=>b.addEventListener('click',()=>{ openSeasonRecAI(key, cat, isProd, ()=>{ if(typeof spkGoInstance==='function') spkGoInstance(key, backFn); }); }));
  box.querySelectorAll('[data-spkval]').forEach(b=>b.addEventListener('click',()=>{ const st=spkState(key); st.val=(String(st.val)===String(b.dataset.spkval))?'':b.dataset.spkval; rerender(); }));
  box.querySelectorAll('[data-spkmore]').forEach(b=>b.addEventListener('click',()=>{ spkState(key).expand[b.dataset.spkmore]=true; rerender(); }));
  box.querySelectorAll('[data-spkgotl]').forEach(b=>b.addEventListener('click',()=>spkGoInstance(key, backFn)));
  box.querySelectorAll('[data-spkfresh]').forEach(b=>b.addEventListener('click',()=>spkGoInstance(key, backFn, true)));
  box.querySelectorAll('[data-spkpick]').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    const id=b.dataset.spkpick, kind=b.dataset.spkkind;
    const cur=selectedSeasonings(key);
    cwApplySeasKind(key, kind, cur.includes(id)?'':id);
    rerender(); if(onChange) onChange();
  }));
  box.querySelectorAll('[data-spknone]').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    cwApplySeasKind(key, b.dataset.spknone, '');
    rerender(); if(onChange) onChange();
  }));
}
function openSeasonings(presetCat, ctxKey){
  seasCtxKey=ctxKey||null;
  const ctxMeta=seasCtxKey?resolveItem(seasCtxKey):null;
  const sub=(DATA.seasonings||[]).length+' '+L('מתכונים מ-6 יבשות','recipes from 6 continents')+(ctxMeta?` · ＋ ${L('מוסיף אל','adding to')}: ${(typeof itemName==='function'?itemName(ctxMeta):ctxMeta.heb)||seasCtxKey}`:' · '+L('סינון לפי סוג, מדינה, טעם, בסיס וחריפות','filter by type, country, flavor, base and heat'));
  showPanel(`${toolTop(L('מתבלים ורטבים','Seasonings & sauces'),sub,'🧂','#b5603a')}
    <div class="panel-body" id="seasBody"></div>`);
  seasFilter={kind:'', cont:'', cat:(presetCat&&presetCat!=='__all')?presetCat:'', q:'', flavor:'', base:'', heat:''};
  renderSeasonings();
}
function openSeasoningDetail(id, backCat){
  const keepCtx=seasCtxKey;
  openFrom(()=>openSeasonings(backCat, keepCtx), ()=>{
    const s=(DATA.seasonings||[]).find(x=>x.id===id); if(!s) return;
    showPanel(`${toolTop(itemName(s), s.eng+' · '+t(s.origin), KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
  });
}
function renderSeasonings(){
  const host=$("#seasBody"); if(!host) return;
  const all=DATA.seasonings||[];
  const q=(seasFilter.q||'').toLowerCase();
  const list=all.filter(s=>{
    if(seasFilter.kind && s.kind!==seasFilter.kind) return false;
    if(seasFilter.cont && s.cont!==seasFilter.cont) return false;
    if(seasFilter.flavor && !(s.flavor||[]).includes(seasFilter.flavor)) return false;
    if(seasFilter.base && s.base!==seasFilter.base) return false;
    if(seasFilter.heat!=='' && String(s.heat)!==String(seasFilter.heat)) return false;
    if(seasFilter.cat){ if(seasFilter.cat==='__produce'){ if(!s.produce) return false; } else if(!s.cats.includes(seasFilter.cat)) return false; }
    if(q && !(s.heb+' '+s.eng+' '+s.ing+' '+s.origin).toLowerCase().includes(q)) return false;
    return true;
  });
  const kinds=[['',L('הכל','All')],['rub',L('🌶️ ראבים','🌶️ Rubs')],['marinade',L('🥣 מרינדות','🥣 Marinades')],['glaze',L('🍯 גלייזים','🍯 Glazes')],['sauce',L('🥄 רטבים','🥄 Sauces')]];
  const conts=['','אמריקה','דרום אמריקה','ישראל/מזה"ת','אפריקה','אירופה','אסיה'];
  host.innerHTML=`
    <div class="searchbar" style="margin-bottom:10px"><input id="seasQ" type="search" placeholder="${L('חפש מתבל, מרכיב או מקור…','Search a seasoning, ingredient or origin…')}" value="${seasFilter.q||''}"><span class="ic">⌕</span></div>
    <div class="chips">${kinds.map(([k,l])=>`<span class="chip ${seasFilter.kind===k?'on':''}" data-sk="${k}">${l}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${conts.map(c=>`<span class="chip ${seasFilter.cont===c?'on':''}" data-scont="${c}">${c?t(c):L('כל היבשות','All continents')}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${[['',L('כל טעם','Any flavor')],...SPK_FLAVORS.map(f=>[f,t(f)])].map(([v,l])=>`<span class="chip ${seasFilter.flavor===v?'on':''}" data-sflav="${v}">👅 ${l}</span>`).join('')}</div>
    <div class="chips" style="margin-top:6px">${[['',L('כל בסיס','Any base')],...SPK_BASES.map(x=>[x,t(x)])].map(([v,l])=>`<span class="chip ${seasFilter.base===v?'on':''}" data-sbase="${v}">🧪 ${l}</span>`).join('')}${[['',L('כל חריפות','Any heat')],...SPK_HEAT.map(([v,l])=>[String(v),heatLabel(v,l)])].map(([v,l])=>`<span class="chip ${String(seasFilter.heat)===v?'on':''}" data-sheat="${v}">${l}</span>`).join('')}</div>
    ${seasFilter.cat?`<div class="count">${L('מסונן ל','Filtered to')}: ${seasFilter.cat==='__produce'?L('ירקות/פירות','Vegetables/fruit'):t(seasFilter.cat)} · <button class="linklike" data-seasclear>${L('נקה','Clear')}</button></div>`:''}
    <div class="count">${list.length} ${L('מתבלים','seasonings')}</div>
    <div class="seas-grid">${list.map(s=>{
      const sel=seasCtxKey?selectedSeasonings(seasCtxKey).includes(s.id):false;
      const add=seasCtxKey?`<button class="seas-cardadd ${sel?'sel':''}" data-scadd="${s.id}" data-sckind="${s.kind}" title="${sel?L('הסר מהמופע','Remove from instance'):L('הוסף למופע','Add to instance')}">${sel?'✓':'＋'}</button>`:'';
      return `<div class="seas-cardwrap">${add}<button class="seas-card ${sel?'sel':''}" data-seas="${s.id}" style="--sc:${cont2color(s.cont)}">
      <div class="seas-card-top"><span>${KIND_EMOJI[s.kind]}</span><span class="seas-card-origin">${t(s.origin)}</span></div>
      <b>${itemName(s)}</b>${getLang()==='he'?`<small>${s.eng}</small>`:''}
      <span class="seas-card-kind">${kindLabel(s.kind)}${s.sub?' · ⚠ '+L('תחליף','substitute'):''}</span>
    </button></div>`;}).join('')||`<div class="shop-empty">${L('לא נמצאו מתבלים בסינון הזה','No seasonings found for this filter')}</div>`}</div>`;
  const sq=$("#seasQ"); if(sq) sq.addEventListener('input',()=>{seasFilter.q=sq.value; renderSeasonings();});
  host.querySelectorAll('[data-sk]').forEach(b=>b.addEventListener('click',()=>{seasFilter.kind=b.dataset.sk; renderSeasonings();}));
  host.querySelectorAll('[data-scont]').forEach(b=>b.addEventListener('click',()=>{seasFilter.cont=b.dataset.scont; renderSeasonings();}));
  host.querySelectorAll('[data-sflav]').forEach(b=>b.addEventListener('click',()=>{seasFilter.flavor=b.dataset.sflav; renderSeasonings();}));
  host.querySelectorAll('[data-sbase]').forEach(b=>b.addEventListener('click',()=>{seasFilter.base=b.dataset.sbase; renderSeasonings();}));
  host.querySelectorAll('[data-sheat]').forEach(b=>b.addEventListener('click',()=>{seasFilter.heat=b.dataset.sheat; renderSeasonings();}));
  const sc=host.querySelector('[data-seasclear]'); if(sc) sc.addEventListener('click',()=>{seasFilter.cat=''; renderSeasonings();});
  host.querySelectorAll('[data-seas]').forEach(b=>b.addEventListener('click',()=>openSeasoningDetail(b.dataset.seas, seasFilter.cat)));
  host.querySelectorAll('[data-scadd]').forEach(b=>b.addEventListener('click',(ev)=>{
    ev.stopPropagation();
    if(!seasCtxKey) return;
    const id=b.dataset.scadd, kind=b.dataset.sckind;
    const was=selectedSeasonings(seasCtxKey).includes(id);
    cwApplySeasKind(seasCtxKey, kind, was?'':id);
    renderSeasonings();
    if(typeof toast==='function'){ const s=seasoningById(id); toast(was?`${s.heb} הוסר מהמופע`:`${s.heb} נבחר (${KIND_LABEL[kind]}) — הקודם מאותו סוג הוחלף`); }
  }));
}
// produce: "גריל / עישון" path (direct fire) — no meat prep/pasteurization language
function produceGrillSteps(c){
  const fruit=c.cat==='פירות';
  const steps=[];
  steps.push([L("הכנה","Prep"),L(fruit?`שטוף, חצה/פרוס לפי הצורך. אין צורך בקילוף אלא אם רלוונטי.`:`שטוף ונקה. פרוס/חתך לגודל אחיד כך שלא ייפול בין השבכות (${c.somid||'ראה טיפ'}).`,fruit?`Rinse, halve/slice as needed. No need to peel unless relevant.`:`Rinse and clean. Slice/cut to an even size so it won't fall through the grate (${t(c.somid)||'see tip'}).`),0]);
  steps.push([L("שימון","Oil it"),L(`מרח שמן על הצומח (לא על השבכה!).`,`Brush oil onto the produce (not the grate!).`),0]);
  steps.push([L("חימום הגריל","Heat the grill"),L(`חמם גריל לחום ${c.smt>=230?'גבוה':'בינוני-גבוה'} (${c.smt}°C). ${c.wood&&c.wood!=='ללא'?`אפשר להוסיף צ'אנק ${c.wood} לניחוח עשן.`:''}`,`Heat the grill to ${c.smt>=230?'high':'medium-high'} (${c.smt}°C). ${c.wood&&c.wood!=='ללא'?`You can add a ${t(c.wood)} chunk for a smoky aroma.`:''}`),0]);
  steps.push([L("צלייה על אש ישירה","Grill over direct heat"),L(`הנח על השבכה וצלה ${c.soh} שעות (~${Math.round(upperHours(c.soh)*60)} דק׳). ${c.somid||''}. הפוך פעם-פעמיים עד סימני חריכה ומרקם רך-נגיס.`,`Place on the grate and grill ${c.soh} hours (~${Math.round(upperHours(c.soh)*60)} min). ${t(c.somid)||''}. Flip once or twice until char marks and a tender bite.`),upperHours(c.soh)*3600]);
  if(c.rest) steps.push([L("הגשה","Serve"),L(`הסר מהאש, ${fruit?'הגש חם עם התוספת המומלצת.':'זלף מעט שמן/לימון והגש חם או בטמפ׳ החדר.'}`,`Remove from the fire, ${fruit?'serve warm with the recommended pairing.':'drizzle a little oil/lemon and serve warm or at room temperature.'}`),c.rest*60]);
  return steps;
}
// produce: sous-vide then finish (roots/starches) — precise softening, not pasteurization
function produceSVSteps(c){
  const steps=[];
  steps.push([L("הכנה","Prep"),L(`שטוף, קלף אם צריך וחתך לגודל אחיד (~1-2 ס\"מ) לבישול אחיד.`,`Rinse, peel if needed and cut to an even size (~1-2 cm) for even cooking.`),0]);
  steps.push([L("שקית עם חמאה/שמן","Bag with butter/oil"),L(`סדר בשכבה אחת בשקית ואקום עם ${c.mid&&c.mid!=='אין'?c.mid:'חמאה/שמן זית ומלח'} — לצומח מוסיפים שומן לשקית (טעם עשיר יותר).`,`Arrange in a single layer in a vacuum bag with ${c.mid&&c.mid!=='אין'?t(c.mid):'butter/olive oil and salt'} — for produce, add fat to the bag (richer flavor).`),0]);
  steps.push([L("סו-ויד לריכוך","Sous-vide to soften"),L(`בשל ב-${c.svt}°C למשך ${c.svh} שעות. בטמפ׳ ~83-90° הפקטין מתרכך והצומח נהיה רך-נגיס בלי להתמסמס — שליטה מדויקת במרקם, ללא צורך בפיסטור.`,`Cook at ${c.svt}°C for ${c.svh} hours. At ~83-90° the pectin softens and the produce becomes tender without falling apart — precise texture control, no pasteurization needed.`),upperHours(c.svh)*3600]);
  steps.push([L("גימור באש/מחבת","Finish on fire/pan"),L(`ייבש, ואז צרוב על גריל חם או במחבת עם חמאה ${c.smh} שעות (~${Math.round(upperHours(c.smh)*60)} דק׳) לצבע, קרמל וטעם עשן. ${c.somid||''}.`,`Dry, then sear on a hot grill or in a pan with butter ${c.smh} hours (~${Math.round(upperHours(c.smh)*60)} min) for color, caramelization and smoky flavor. ${t(c.somid)||''}.`),upperHours(c.smh)*3600]);
  if(c.rest) steps.push([L("הגשה","Serve"),L(`תבל לסיום (מלח/הראב שנבחר) והגש.`,`Season to finish (salt/the chosen rub) and serve.`),c.rest*60]);
  return steps;
}
// produce: low-and-slow smoking (great for cauliflower, cabbage, garlic, tomatoes, peppers)
function produceSmokeSteps(c){
  const fruit=c.cat==='פירות';
  const smokeT=Math.min(c.smt,120); // gentle smoke temp for produce
  const steps=[];
  steps.push([L("הכנה","Prep"),L(fruit?`שטוף, חצה/פרוס. פירות עמידים (אבטיח, אננס) סופגים עשן יפה.`:`שטוף ונקה. ${c.eng.includes('Garlic')?'חתוך קצה ראש השום וחשוף את השיניים.':c.eng.includes('Cauliflower')||c.eng.includes('Cabbage')?'השאר שלם או חצה לראש/סטייק — עישון איטי חודר עמוק.':'חתוך לגודל בינוני שיחזיק על השבכה.'}`,fruit?`Rinse, halve/slice. Sturdy fruits (watermelon, pineapple) take smoke beautifully.`:`Rinse and clean. ${c.eng.includes('Garlic')?'Cut the top off the garlic head and expose the cloves.':c.eng.includes('Cauliflower')||c.eng.includes('Cabbage')?'Leave whole or halve into a head/steak — slow smoke penetrates deep.':'Cut to a medium size that will hold on the grate.'}`),0]);
  steps.push([L("שימון","Oil it"),L(`מרח שמן.${c.eng.includes('Garlic')?' לשום — אפשר לעטוף בנייר כסף עם שמן.':''}`,`Brush with oil.${c.eng.includes('Garlic')?' For garlic — you can wrap in foil with oil.':''}`),0]);
  steps.push([L("הדלקת מעשנת","Fire up the smoker"),L(`ייצב מעשנת על ${smokeT}°C (חום נמוך) עם צ'אנקים ${c.wood&&c.wood!=='ללא'?c.wood:'תפוח/דובדבן'} — עצי פרי עדינים מתאימים במיוחד לצומח.`,`Stabilize the smoker at ${smokeT}°C (low heat) with ${c.wood&&c.wood!=='ללא'?t(c.wood):'apple/cherry'} chunks — mild fruit woods suit produce especially well.`),0]);
  const smokeH=Math.max(0.5,upperHours(c.svh)); // use SV time as a proxy for gentle smoke duration
  steps.push([L("עישון איטי","Slow smoke"),L(`עשן ב-${smokeT}°C למשך ${smokeH.toFixed(1)}-${(smokeH*1.5).toFixed(1)} שעות עד ריכוך וספיגת עשן. ${c.eng.includes('Garlic')?'עד רך וזהוב — ממרח מדהים.':'בדוק רכות עם מזלג.'}`,`Smoke at ${smokeT}°C for ${smokeH.toFixed(1)}-${(smokeH*1.5).toFixed(1)} hours until tender and smoke-infused. ${c.eng.includes('Garlic')?'Until soft and golden — an amazing spread.':'Check tenderness with a fork.'}`),smokeH*3600]);
  steps.push([L("גימור אופציונלי","Optional finish"),L(`להעצמת צבע וקרמל — העבר לאש ישירה לכמה דקות בסוף, או הגש כמו שזה.`,`For deeper color and caramelization — move to direct heat for a few minutes at the end, or serve as is.`),0]);
  if(c.rest) steps.push([L("הגשה","Serve"),L(`תבל לסיום והגש חם או בטמפ׳ החדר.`,`Season to finish and serve warm or at room temperature.`),0]);
  return steps;
}
function svSteps(c,hintSear=true){
  const steps=[];
  let prep=L("נקה, גזום עודפי שומן ויבש היטב את הבשר.","Clean, trim excess fat and pat the meat thoroughly dry.");
  if(c.eng.includes("Ribs")) prep=L("הסר את הקרום (membrane) מגב הצלעות ויבש היטב.","Remove the membrane from the back of the ribs and pat thoroughly dry.");
  if(c.rub.includes("כבישה")) prep=L("בצע כבישה/ריפוי לפי המתכון, שטוף ויבש לפני התיבול.","Brine/cure per the recipe, rinse and dry before seasoning.");
  steps.push([L("הכנת הנתח","Prep the cut"),prep,0]);
  steps.push([L("ואקום + סו-ויד","Vacuum + sous-vide"),L(`סגור בשקית ואקום ובשל בסו-ויד ב-${c.svt}°C למשך ${c.svh} שעות. הפסטור נמדד מהרגע שמרכז הנתח מגיע לטמפ׳ — הוסף ~20% מרווח.${c.svt<55?' ⚠ בטמפ׳ מתחת ל-55°C אין להחזיק מעבר ל-4 שעות.':''}`,`Seal in a vacuum bag and sous-vide at ${c.svt}°C for ${c.svh} hours. Pasteurization counts from when the core reaches temp — add a ~20% margin.${c.svt<55?' ⚠ Below 55°C, do not hold beyond 4 hours.':''}`),upperHours(c.svh)*3600]);
  if(PREP_TREAT.includes(c.mid)) steps.push([L(`טיפול: ${c.mid}`,`Treatment: ${t(c.mid)}`),treatText(c.mid),0]);
  let dry=L("ייבש את פני הבשר היטב לפני העישון — משטח יבש סופג עשן טוב יותר.","Pat the surface thoroughly dry before smoking — a dry surface takes smoke better.");
  if(c.cat==="דג") dry=L("ייבש ליצירת pellicle (קרום דביק שסופג עשן) לפני העישון. ⚠ בטמפ׳ נמוכה — השתמש בדג סושי-גרייד או שהוקפא (-20°C, 7 ימים) לבטיחות מטפילים.","Dry to form a pellicle (a tacky skin that takes smoke) before smoking. ⚠ At low temp — use sushi-grade fish or fish frozen (-20°C, 7 days) for parasite safety.");
  steps.push([L("ייבוש לפני עישון","Dry before smoking"),dry,0]);
  steps.push([L("הדלקת מעשנת","Fire up the smoker"),L(`ייצב מעשנת על ${c.smt}°C עם צ'אנקים ${c.wood} ופחם ${c.coal}.`,`Stabilize the smoker at ${c.smt}°C with ${t(c.wood)} chunks and ${t(c.coal)} charcoal.`),0]);
  steps.push([L("עישון","Smoke"),L(`עשן ב-${c.smt}°C למשך ${c.smh} שעות. אין צורך בעטיפה — הבישול הושלם בסו-ויד.`,`Smoke at ${c.smt}°C for ${c.smh} hours. No wrap needed — cooking was completed in the sous-vide.`),upperHours(c.smh)*3600]);
  if(FINISH_TREAT.includes(c.mid)) steps.push([L(`טיפול: ${c.mid}`,`Treatment: ${t(c.mid)}`),treatText(c.mid),0]);
  if(c.sear==="גלייז") steps.push([L("גלייז סיום","Finishing glaze"),L(`מרח שכבת גלייז דביקה בסוף לברק וטעם.`,`Brush on a sticky glaze at the end for shine and flavor.`),0]);
  else if(c.sear==="כן" && hintSear) steps.push([L("רוצה קרום צרוב?","Want a seared crust?"),L(`💡 הנתח הזה נהנה מצריבה — הדלק את מתג 🔥 גריל והתוכנית תוסיף שלב צריבה מסודר.`,`💡 This cut benefits from a sear — flip the 🔥 grill switch and the plan will add a proper sear step.`),0]);
  if(c.safe) steps.push([L("בדיקת בטיחות","Safety check"),L(`ודא טמפ' פנימית: יעד מרקם ${c.tgt}°C · מינימום בטיחות ${c.safe}°C${c.cat==='דג'?' (ולדג — ראה הערת טפילים למעלה)':''}.`,`Verify internal temp: texture target ${c.tgt}°C · safety minimum ${c.safe}°C${c.cat==='דג'?' (and for fish — see the parasite note above)':''}.`),0]);
  if(c.rest) steps.push([L("מנוחה","Rest"),L(`תן מנוחה של ${c.rest} דקות לפני הפריסה.`,`Let it rest ${c.rest} minutes before slicing.`),c.rest*60]);
  return steps;
}
function soSteps(c){
  const steps=[];
  let prep=L("נקה, גזום ויבש היטב את הבשר.","Clean, trim and pat the meat thoroughly dry.");
  if(c.eng.includes("Ribs")) prep=L("הסר את הקרום מגב הצלעות ויבש.","Remove the membrane from the back of the ribs and dry.");
  if(c.rub.includes("כבישה")) prep=L("בצע כבישה/ריפוי, שטוף ויבש.","Brine/cure, rinse and dry.");
  steps.push([L("הכנת הנתח","Prep the cut"),prep,0]);
  steps.push([L("הדלקת מעשנת","Fire up the smoker"),L(`ייצב מעשנת על ${c.sot}°C עם צ'אנקים ${c.wood} ופחם ${c.coal}.`,`Stabilize the smoker at ${c.sot}°C with ${t(c.wood)} chunks and ${t(c.coal)} charcoal.`),0]);
  steps.push([L("עישון","Smoke"),L(`עשן ב-${c.sot}°C למשך ${c.soh} שעות עד טמפ' פנימית ${c.tgt}°C.${c.tgt>=88?` אפשר גם 'חם ומהיר' (120–135°C) כדי לפרוץ את ה'סטָאל' מהר יותר ולבנות קרום.`:''}`,`Smoke at ${c.sot}°C for ${c.soh} hours to ${c.tgt}°C internal.${c.tgt>=88?` You can also go 'hot and fast' (120–135°C) to power through the stall faster and build a crust.`:''}`),upperHours(c.soh)*3600]);
  if(c.somid && c.somid!=="אין") steps.push([L(`טיפול: ${c.somid}`,`Treatment: ${t(c.somid)}`),soTreatText(c.somid)+(c.somid==='מריחה'||c.somid==='ריסוס'?L(' (ריסוס נוזל הוא אופציונלי-אסתטי — משפיע מעט על הטעם ומקרר קלות את הקרום).',' (spritzing liquid is optional-aesthetic — it affects flavor slightly and cools the bark a touch).'):''),0]);
  if(c.sear==="כן") steps.push([L("רוצה קרום צרוב?","Want a seared crust?"),L(`💡 הנתח הזה נהנה מצריבה — הדלק את מתג 🔥 גריל לשלב צריבה מסודר בסוף.`,`💡 This cut benefits from a sear — flip the 🔥 grill switch for a proper sear step at the end.`),0]);
  if(c.safe) steps.push([L("בדיקת בטיחות","Safety check"),L(`יעד ${c.tgt}°C · מינימום בטיחות ${c.safe}°C.`,`Target ${c.tgt}°C · safety minimum ${c.safe}°C.`),0]);
  if(c.rest) steps.push([L("מנוחה","Rest"),L(`מנוחה ${c.rest} דקות לפני הפריסה.${c.tgt>=90?` לנתחי קולגן — החזקה ארוכה בקופסת בידוד (cambro/צידנית) של שעה+ משפרת מאוד עסיסיות.`:''}`,`Rest ${c.rest} minutes before slicing.${c.tgt>=90?` For collagen cuts — a long hold in an insulated box (cambro/cooler) of an hour+ greatly improves juiciness.`:''}`),c.rest*60]);
  return steps;
}
function treatText(m){
  const he={"צינון":"צנן/החזק את הנתח לפני שלב העישון.","צינון מלא":"צנן את הנתח לחלוטין (אפילו לילה) — מקל על קרום וצריבה.",
   "ייבוש":"ייבש את פני הבשר/העור לקראת העישון.","ייבוש עור":"ייבש את העור היטב לעור פריך.",
   "קילוף קרום":"קלף את הקרום החיצוני של הלשון לאחר הבישול.","דקירת עור+ניקוז":"נקב את העור ונקז שומן עודף.",
   "חריטת עור":"חרוט את שכבת השומן בתבנית מעוינים.","ניקוז שומן":"נקז את השומן הנמס במהלך העישון.","הפיכת עור":"הפוך לצריבת העור בצד מטה."};
  const en={"צינון":"Chill/hold the cut before the smoking step.","צינון מלא":"Chill the cut completely (even overnight) — helps bark and searing.",
   "ייבוש":"Dry the surface of the meat/skin ahead of smoking.","ייבוש עור":"Dry the skin thoroughly for crisp skin.",
   "קילוף קרום":"Peel the outer membrane of the tongue after cooking.","דקירת עור+ניקוז":"Prick the skin and drain excess fat.",
   "חריטת עור":"Score the fat layer in a diamond pattern.","ניקוז שומן":"Drain the fat rendered during smoking.","הפיכת עור":"Flip to sear the skin side down."};
  return (getLang()==='he'?he:en)[m]||t(m);
}
function soTreatText(m){
  if(m.startsWith("עטיפה")) return L(`ב'סטָאל' עטוף בנייר כסף/קצבים (${m}) כדי לעבור מהר ולשמר לחות.`,`At the stall, wrap in foil/butcher paper (${t(m)}) to push through faster and hold moisture.`);
  const he={"שיטת 3-2-1":"3 שעות עישון גלוי, 2 שעות עטוף עם נוזל, 1 שעה גלוי עם גלייז.",
   "שיטת 2-2-1":"2 שעות גלוי, 2 שעות עטוף עם נוזל, 1 שעה גלוי עם גלייז (לצלעות דקות).",
   "גלייז בסיום":"מרח גלייז דביק ב-30 הדקות האחרונות.","מריחה":"רסס/מרח נוזל לשמירת לחות וצבע.",
   "הפיכה":"הפוך באמצע לעישון אחיד.","סיבוב שיפוד":"סובב את השיפוד לעישון אחיד מכל הצדדים.",
   "עטיפת חזה":"עטוף את החזה בנייר כסף כשמגיע ליעד, להגן מייבוש.","דקירת עור+ניקוז":"נקב עור ונקז שומן.","דקירת עור":"נקב את העור לשחרור שומן."};
  const en={"שיטת 3-2-1":"3 hours smoking uncovered, 2 hours wrapped with liquid, 1 hour uncovered with glaze.",
   "שיטת 2-2-1":"2 hours uncovered, 2 hours wrapped with liquid, 1 hour uncovered with glaze (for thin ribs).",
   "גלייז בסיום":"Brush on a sticky glaze in the last 30 minutes.","מריחה":"Spritz/brush liquid to keep moisture and color.",
   "הפיכה":"Flip halfway for even smoking.","סיבוב שיפוד":"Rotate the skewer for even smoking on all sides.",
   "עטיפת חזה":"Wrap the brisket in foil when it hits target, to protect from drying.","דקירת עור+ניקוז":"Prick the skin and drain fat.","דקירת עור":"Prick the skin to release fat."};
  return (getLang()==='he'?he:en)[m]||t(m);
}

/* ---------- checklist + timer state ---------- */
const store={
  get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v)); return true;}catch(e){ try{mkStorageWarn(e);}catch(_){} return false; }}   // Wave C: surface quota failures instead of swallowing them silently
};
let _mkStorageWarned=0;
function mkStorageWarn(e){
  const quota = e && (e.name==='QuotaExceededError' || e.code===22 || e.code===1014 || /quota|exceeded/i.test((e.name||'')+(e.message||'')));
  if(!quota) return;
  const now=Date.now(); if(now-_mkStorageWarned < 60000) return; _mkStorageWarned=now;   // throttle to once/min
  try{ if(typeof toast==='function') toast('⚠ האחסון מלא — ייתכן שנתונים חדשים לא נשמרים. ייצא גיבוי ופנה מקום (הגדרות › גיבוי ושחזור).'); }catch(_){}
}
async function requestPersist(){ try{ if(navigator.storage && navigator.storage.persist){ const p=navigator.storage.persisted?await navigator.storage.persisted():false; if(!p) await navigator.storage.persist(); } }catch(e){} }   // ask the browser not to evict our data under pressure
async function storageInfo(){ try{ if(navigator.storage && navigator.storage.estimate){ const e=await navigator.storage.estimate(); const persisted=navigator.storage.persisted?await navigator.storage.persisted():false; return {usedKB:Math.round((e.usage||0)/1024), quotaMB:Math.round((e.quota||0)/1048576), persisted, pct:e.quota?Math.min(100,Math.round((e.usage/e.quota)*100)):0}; } }catch(e){} return null; }
// HTML-escape helper — MUST wrap any AI-authored or user-authored text before it enters innerHTML.
// AI answers can carry search-grounded, attacker-influenced markup; without this, "<img onerror>" would exfiltrate mk-gemkey.
const ESC_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>ESC_MAP[c]); }
// perf #4: debounce the search input so a keystroke doesn't rebuild ~279 cards synchronously each time
function debounce(fn,ms){ let t; return function(){ const a=arguments,c=this; clearTimeout(t); t=setTimeout(function(){fn.apply(c,a);},ms); }; }
// recipe-in-project context: when set, recipe steps read/write the project's doneSteps
let curProject=null, pendingProject=null;
function projById(id){ try{ return (store.get('mk-pantry')||[]).find(p=>p.id===id)||null; }catch(e){ return null; } }
let timers={}; // id -> interval

/* ---------- shopping cart state ---------- */
let cart=new Set(); // vestigial (shopping now lives in menuState); kept empty to avoid breakage
function saveCart(){/* mk-cart retired */}
function menuHasKey(key){ return (((typeof menuState==='function')&&menuState().keys)||[]).includes(key); }
/* state util: context-aware add/remove of an item in the active plan (no direct UI caller; used programmatically) */
function toggleCart(key){ const s=menuState(); s.keys=s.keys||[]; const i=s.keys.indexOf(key); if(i>=0)s.keys.splice(i,1); else s.keys.push(key); saveMenu(s); updateCartBadge(); render(); }
function updateCartBadge(){ const e=$("#cartN"); if(e) e.textContent=(((typeof menuState==='function')&&menuState().keys)||[]).length; }
/* add-to-menu affordance (UX): a real control wired to the existing toggleCart, on every card + the item panel */
function addMenuBtn(key){ const on=menuHasKey(key); const lbl=on?'הסר מהתפריט':'הוסף לתפריט'; return `<button class="addcart ${on?'on':''}" data-addmenu="${key}" aria-pressed="${on}" aria-label="${lbl}" title="${lbl}">${on?'✓':'＋'}</button>`; }
function syncAddMenuBtn(btn){ if(!btn) return; const on=menuHasKey(btn.dataset.addmenu); btn.classList.toggle('on',on); btn.setAttribute('aria-pressed',on); const lbl=on?'הסר מהתפריט':'הוסף לתפריט'; btn.setAttribute('aria-label',lbl); if(btn.hasAttribute('data-full')){ btn.textContent=on?'✓ בתפריט':'＋ הוסף לתפריט'; } else { btn.setAttribute('title',lbl); btn.textContent=on?'✓':'＋'; } }

function fmt(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=Math.floor(s%60);
  return (h?h+":":"")+String(m).padStart(h?2:1,'0')+":"+String(x).padStart(2,'0');}

/* ---------- category colors + SVG icon art ---------- */
const CAT_COLOR={
 "בקר":"#c0392b","חזיר":"#dd7a93","טלה":"#b46a2b","עוף":"#d99a2b","הודו":"#c77a3a",
 "אווז":"#9c7b4a","ברווז":"#8a6a3c","דג":"#2f9e9e",
 "בשר מיובש":"#9a4b2a","בייקון":"#cf5a4e","נקניק מעושן":"#b5603a","נקניק מיובש":"#9e4a3d",
 "גבינה":"#cda434","נקניקיות":"#cf6a4a","פסטרמה":"#a8392f","שווארמה":"#b9772f",
 "סלומי":"#9b3b46","דג מעושן":"#2f8e9e","BBQ קלאסי":"#b5603a","צלייה טחונה":"#c0563a",
 "איברים פנימיים":"#a24d5e","ירקות":"#4f8a3d","פירות":"#d1663f"
};
function catColor(c){return CAT_COLOR[c]||"var(--ember)";}
const CAT_EMOJI={
 'בקר':'🥩','חזיר':'🥩','טלה':'🐑','עוף':'🍗','הודו':'🍗','אווז':'🍗','ברווז':'🍗',
 'דג':'🐟','דג מעושן':'🐠','בשר מיובש':'🥓','בייקון':'🥓',
 'נקניק מעושן':'🥓','נקניק מיובש':'🧂','גבינה':'🧀','נקניקיות':'🌭',
 'פסטרמה':'🥩','שווארמה':'🌯','סלומי':'🍖','BBQ קלאסי':'🔥','צלייה טחונה':'🍔',
 'איברים פנימיים':'🫀','ירקות':'🥦','פירות':'🍑'
};
function foldCorner(){return '';} // v144: legacy 'vintage' theme branch retired (must be '' — `${false}` prints "false")
function catEmoji(c){return CAT_EMOJI[c]||'🔥';}
const ICONS={
 steak:'<path d="M40 9c12 0 17 9 16 19-1 10-9 16-17 18-10 3-23 2-29-6-5-7-4-19 4-26 7-6 17-5 26-5z"/><path d="M21 26c9-3 19-2 25 4" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" opacity=".22"/><path d="M17 39c9 3 20 3 28-1" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" opacity=".22"/><path d="M30 18c-2 9-3 20 0 30" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" opacity=".15"/>',
 drumstick:'<path d="M45 9c8 1 13 9 11 17-1 6-6 9-11 9-2 5-2 9-6 12-5 4-14 3-18-2s-4-14 1-18c3-3 7-3 11-4 1-5 4-11 9-13 1 0 2-1 2-1z"/><path d="M22 41l-9 9c-2 2-2 6 0 8s6 2 8 0" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>',
 fish:'<ellipse cx="28" cy="32" rx="21" ry="12.5"/><path d="M45 32l13-10v20z"/><circle cx="19" cy="29" r="2.5" fill="#1a1a1a" opacity=".55"/><path d="M30 24c6 2 10 5 12 8" fill="none" stroke="#000" stroke-width="1.7" opacity=".22"/>',
 sausage:'<path d="M15 45c-6-9-3-21 8-25 9-3 15 0 21 4" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><path d="M13 47l-3 4M48 25l4-3" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>',
 cheese:'<path d="M9 43 51 21a6 6 0 0 1 5 6L17 51a6 6 0 0 1-8-8Z"/><circle cx="26" cy="38" r="3" fill="#000" opacity=".18"/><circle cx="38" cy="32" r="2.4" fill="#000" opacity=".18"/>',
 bacon:'<path d="M9 25c10-5 15 4 25 0s15-5 23 2c-2 8-2 9 0 15-8-7-15-2-23 2s-15-4-25 0c2-8 2-11 0-19z"/><path d="M12 31c10-5 15 4 25 0s15-4 22 1" fill="none" stroke="#fff" stroke-width="2.6" opacity=".3"/>',
 jerky:'<rect x="22" y="9" width="14" height="46" rx="6" transform="rotate(20 29 32)"/><path d="M24 20l14 26" stroke="#000" stroke-width="1.6" opacity=".2"/>',
 pastrami:'<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="22" fill="none" stroke="#000" stroke-width="3" opacity=".2"/><path d="M21 29c7-4 15-4 22 0M19 38c9-4 17-4 26 0" fill="none" stroke="#000" stroke-width="1.7" opacity=".2"/>',
 spit:'<rect x="30" y="6" width="4" height="52" rx="2"/><path d="M20 14h24l-3 8H23zM18 24h28l-4 9H22zM16 35h32l-5 11H21z"/>',
 flame:'<path d="M32 6c4 9-6 12-6 20 0 5 3 8 6 9 2-3 2-7 1-10 6 4 12 10 12 18 0 11-9 17-19 17S8 55 8 44c0-9 7-14 10-22 2 4 2 8 5 10-2-9 5-18 9-26z"/>'
};
function iconType(cat){
 const m={"בקר":"steak","חזיר":"steak","טלה":"steak","עוף":"drumstick","הודו":"drumstick","אווז":"drumstick","ברווז":"drumstick","דג":"fish",
  "בשר מיובש":"jerky","בייקון":"bacon","נקניק מעושן":"sausage","נקניק מיובש":"sausage","גבינה":"cheese",
  "נקניקיות":"sausage","פסטרמה":"pastrami","שווארמה":"spit",
  "סלומי":"pastrami","דג מעושן":"fish","BBQ קלאסי":"flame","צלייה טחונה":"sausage"};
 return m[cat]||"flame";
}
function svgRaw(type){return `<svg viewBox="0 0 64 64" fill="currentColor">${ICONS[type]||ICONS.flame}</svg>`;}
function darken(hex,amt){return '#'+(hex.replace('#','').match(/.{2}/g)||['00','00','00']).map(h=>Math.max(0,parseInt(h,16)-amt).toString(16).padStart(2,'0')).join('');}
const CUT_ICON={1:"🥩",2:"🍖",6:"🥩",10:"🍖",11:"🥩",12:"🥩",14:"🍖",17:"🍢",18:"🍔",20:"🥩",21:"🍖",22:"👅",23:"🥩",24:"🍖",25:"🦴",26:"🥩",27:"🥩",28:"🥩",51:"🥓",52:"🍖",53:"🥩",54:"🥩",55:"🥩",56:"🍖",57:"🦴",69:"❤️",3:"🌯",5:"🍗",19:"🍗",38:"🐔",39:"🍗",40:"🍗",41:"🍗",42:"🦃",43:"🦃",67:"🍗",68:"🦃",70:"❤️",71:"🥩",9:"🦆",44:"🦢",45:"🦢",46:"🦆",47:"🦆",48:"🦆",74:"🥩",7:"🍖",8:"🥓",13:"🍖",29:"🥩",30:"🥩",31:"🍖",32:"🍖",33:"🍖",61:"🍖",62:"🦴",63:"🍖",64:"🍖",65:"👂",66:"🍖",4:"🦴",15:"🍖",34:"🍖",35:"🍖",36:"🍖",37:"🍖",58:"🍖",59:"🍖",60:"🥩",73:"🥩",72:"🥩",75:"🧠",76:"🧠",77:"🍗",78:"🫘",79:"🫘",80:"🧠",49:"🐟",50:"🐟",81:"🌽",82:"🫑",83:"🍆",84:"🥒",85:"🧅",86:"🍄",87:"🥬",88:"🥕",89:"🥔",90:"🍠",91:"🥬",92:"🥦",93:"🥦",94:"🥬",95:"🍅",96:"🫛",101:"🌿",102:"🧄",103:"🥬",104:"🥑",105:"🧀",97:"🍍",98:"🍑",99:"🍐",100:"🍌",106:"🍉",107:"🫐",108:"🥩",109:"🥩",110:"🥩",111:"🥩",112:"🥩",113:"🦐",114:"🦐",115:"🦐",116:"🐚",117:"🦞",118:"🦞",119:"🦞",120:"🦀",121:"🦀",122:"🦀",123:"🐙",124:"🦑",125:"🐟",126:"🐟",127:"🐟",128:"🦪",129:"🐚",130:"🦪"};
function itemEmoji(cat,ekey){
  if(ekey&&ekey.startsWith('cut-')){ const n=+ekey.slice(4); if(CUT_ICON[n]) return CUT_ICON[n]; }
  if(ekey&&ekey.startsWith('spec-')) return catEmoji(cat);
  return catEmoji(cat);
}
function svgThumb(cat,label,ekey,origin){
  const col=catColor(cat), em=itemEmoji(cat,ekey);
  let flag='';
  if(origin){ const fm=origin.match(/\p{Regional_Indicator}\p{Regional_Indicator}/u); if(fm) flag=`<span class="t-flag">${fm[0]}</span>`; }
  if(false){ // v144: legacy 'vintage' theme branch retired
    return `<div class="thumb thumb-v">
      <span class="v-emoji">${em}</span>
      ${flag}
      ${label?`<span class="vnum">${label}</span>`:''}
    </div>`;
  }
  if(false){ // v144: legacy 'gold' theme branch retired
    return `<div class="thumb thumb-g" style="--c:${col}">
      <div class="t-blur">${em}</div>
      <div class="gico" style="background:linear-gradient(135deg,${col},${darken(col,50)})">${em}</div>
      ${flag}
      ${label?`<span class="tnum">${label}</span>`:''}
    </div>`;
  }
  return `<div class="thumb" style="--c:${col}">
    <div class="t-blur">${em}</div>
    <div class="t-circle" style="background:linear-gradient(135deg,${col},${darken(col,55)})">${em}</div>
    ${flag}
    ${label?`<span class="tnum">${label}</span>`:''}
  </div>`;
}
function headArt(cat){return `<div class="phead-ico">${svgRaw(iconType(cat))}</div>`;}

/* ---------- render cards ---------- */
function cutCard(c){const col=catColor(c.cat), key="cut-"+c.n;
  return `<article class="card" data-n="${c.n}" data-kind="cut" tabindex="0" role="button" aria-label="${c.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(c.cat,"#"+c.n,"cut-"+c.n)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${c.cat} ${kosherTag("cut-"+c.n)}${gearTag("cut-"+c.n)}</div>
      <h3>${itemName(c)}</h3>
      <div class="en">${c.eng} · ${c.kg} ק״ג</div>
      ${isProduce(c)?`<div class="meta">
        <span>גריל <b>${c.sot}°</b></span>
        <span>סו-ויד <b>${c.svt}°</b></span>
        <span>~${Math.round(upperHours(c.soh)*60)} דק'</span>
      </div>
      <div class="meta" style="justify-content:space-between;align-items:center">
        <span>${dots(c.diff)}${ratingMini(key)}</span>
        <span class="saved" style="background:rgba(79,138,61,.14);border-color:rgba(79,138,61,.4);color:var(--saved-ink)">${c.cat==='פירות'?'🍑 לגריל/קינוח':'🥦 לגריל/תוספת'}</span>
      </div>`:`<div class="meta">
        <span>סו-ויד <b>${c.svt}°</b>/${c.svh}ש</span>
        <span>עישון <b>${c.smt}°</b>/${c.smh}ש</span>
        <span>יעד <b>${c.tgt}°</b></span>
      </div>
      <div class="meta" style="justify-content:space-between;align-items:center">
        <span>${dots(c.diff)}${ratingMini(key)}</span>
        <span class="saved">⏱ חוסך ${c.saved}ש מעשנת</span>
      </div>
      ${DATA.builds["cut-"+c.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}`}
    </div>
  </article>`;
}
function specCard(s){const smk = s.smt? `${s.smt}°/${s.smh}ש` : s.smh, col=catColor(s.cat), key="spec-"+s.n;
  return `<article class="card" data-n="${s.n}" data-kind="spec" tabindex="0" role="button" aria-label="${s.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(s.cat,"#"+s.n,"spec-"+s.n, s.origin)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${s.cat} ${kosherTag(key)}</div>
      <h3>${itemName(s)}</h3>
      <div class="en">${s.eng}${s.origin?` · ${s.origin}`:''}</div>
      <div class="meta"><span>עישון <b>${smk}</b></span>${s.tgt!=='—'&&s.tgt?`<span>יעד <b>${s.tgt}${typeof s.tgt==='number'?'°':''}</b></span>`:''}</div>
      <div class="meta" style="justify-content:space-between;align-items:center"><span>${dots(s.diff)}${ratingMini(key)}</span><span style="color:var(--smoke)">${s.wood}</span></div>
      ${DATA.builds["spec-"+s.n]?'<span class="bld">🔨 בנייה מאפס</span>':''}
    </div>
  </article>`;
}
function makeCard(id,m){const nv=(m.build.variants||[]).length, col=catColor(m.cat), key="make-"+id;
  return `<article class="card" data-mid="${id}" data-kind="make" tabindex="0" role="button" aria-label="${m.heb}">
    ${foldCorner()}${favStar(key)}${addMenuBtn(key)}
    ${svgThumb(m.cat,null,"make-"+id, m.origin)}
    <div class="cbody">
      <div class="cat" style="color:${col}">${m.cat} ${kosherTag(key)}</div>
      <h3>${itemName(m)}</h3>
      <div class="en">${m.eng}${m.origin?` · ${m.origin}`:''}</div>
      <div class="meta" style="justify-content:space-between;align-items:center"><span>${dots(m.diff)}${ratingMini(key)}</span>${nv?`<span style="color:var(--smoke)">${nv} ווריאנטים</span>`:''}</div>
      <span class="bld">🔨 בנייה מאפס</span>
    </div>
  </article>`;
}

let activeCats=new Set();
let activeMakeCat=null;
let filters={fav:false, kosher:false, method:'', diff:0, time:0};
function textBlob(meta){
  let t=(meta.heb+' '+meta.eng+' '+meta.cat).toLowerCase();
  if(meta.obj&&meta.obj.rub) t+=' '+meta.obj.rub.toLowerCase();
  if(meta.obj&&meta.obj.wood) t+=' '+String(meta.obj.wood).toLowerCase();
  const b=meta.build;
  if(b){ if(b.materials) t+=' '+b.materials.join(' ').toLowerCase();
         if(b.variants) t+=' '+b.variants.map(v=>v[0]).join(' ').toLowerCase(); }
  return t;
}
function itemMethods(meta){
  if(!meta) return [];
  if(meta.kind==='cut') return methodRules(meta.obj).allowed.slice();  // single source of truth
  if(meta.kind==='spec') return ['smoke','build'];            // specials: smoked/cured products
  return ['build'];                                           // makes: from-scratch builds
}
function leadForMethod(meta, fm){
  const c=meta.obj||{};
  if(meta.kind==='cut'){
    if(isProduce(c)){
      if(fm==='sv') return upperHours(c.svh)+upperHours(c.smh)+(c.rest||0)/60;
      if(fm==='smoke') return Math.max(0.5,upperHours(c.svh))*1.5;
      return upperHours(c.soh)+(c.rest||0)/60;                // grill / direct fire (default, quick)
    }
    if(fm==='smoke') return upperHours(c.soh||c.smh)+(c.rest||0)/60; // smoke-only
    if(fm==='grill' && isGrillableMeat(c)) return 0.4+(c.rest||0)/60;  // fast direct-heat grill
    return upperHours(c.svh)+4+upperHours(c.smh)+(c.rest||0)/60;       // sv+smoke (default order incl. v144 fridge-dry stage)
  }
  return leadHours(meta);
}
function passFilters(meta){
  if(filters.fav && !isFav(meta.key)) return false;
  if(filters.kosher && !isKosherOk(meta.key)) return false;   // pork / shellfish / blood
  if(filters.diff && (meta.obj.diff||meta.diff||3) > filters.diff) return false;
  if(filters.method && !itemMethods(meta).includes(filters.method)) return false;
  if(filters.time){
    const lead=leadForMethod(meta, filters.method);
    if(lead>filters.time) return false;
  }
  return true;
}
function render(){
  const q=$("#q").value.trim().toLowerCase();
  const anyGlobal = filters.fav||filters.kosher||filters.method||filters.diff||filters.time;
  const eff=effectiveCats(); // Set or null(=all)
  const inScope=cat=>!eff||eff.has(cat);
  const cuts=DATA.cuts.filter(c=>{
    const meta=metaCut(c);
    const okQ=!q||textBlob(meta).includes(q);
    return inScope(c.cat)&&okQ&&passFilters(meta);
  });
  $("#grid").innerHTML=cuts.map(cutCard).join("");
  const cutsEmpty=!cuts.length;

  const makeEntries=Object.entries(DATA.makes).filter(([id,m])=>{
    const meta=metaMake(id,m);
    const okQ=!q||textBlob(meta).includes(q);
    return inScope(m.cat)&&okQ&&passFilters(meta);
  });
  $("#makeGrid").innerHTML=makeEntries.map(([id,m])=>makeCard(id,m)).join("");
  const showMakes=makeEntries.length;
  $("#makesH").style.display=showMakes?"":"none";
  $("#makesSub").style.display=showMakes?"":"none";
  $("#makeGrid").style.display=showMakes?"":"none";

  const specs=DATA.specials.filter(s=>{
    const meta=metaSpec(s);
    return inScope(s.cat)&&(!q||textBlob(meta).includes(q))&&passFilters(meta);
  });
  $("#specGrid").innerHTML=specs.map(specCard).join("");
  const showSpec = specs.length;
  $("#specialsH").style.display=showSpec?"":"none";
  $("#specGrid").style.display=showSpec?"":"none";
  $("#specSub").style.display=showSpec?"":"none";
  $("#count").textContent=`${cuts.length} נתחים · ${makeEntries.length} מלאכה · ${specs.length} מיוחדים${anyGlobal?' · מסונן':''}`;
  const noneAtAll = cutsEmpty && !makeEntries.length && !specs.length;
  // hide the cuts section entirely when there are no cuts but other items exist; keep it (with empty msg) when nothing matches
  $("#cutsWrap").style.display=(cutsEmpty && !noneAtAll)?"none":"";
  $("#empty").style.display=noneAtAll?"block":"none";
  const anyActive = anyGlobal || activeCats.size || activeGroup || q;
  const cab=$("#clearAll"); if(cab){ cab.style.opacity=anyActive?'1':'.5'; }
}
function metaCut(c){return {kind:'cut',key:'cut-'+c.n,heb:c.heb,eng:c.eng,cat:c.cat,obj:c,build:DATA.builds['cut-'+c.n]};}
function metaSpec(s){return {kind:'spec',key:'spec-'+s.n,heb:s.heb,eng:s.eng,cat:s.cat,obj:s,build:DATA.builds['spec-'+s.n]};}
function metaMake(id,m){return {kind:'make',key:'make-'+id,heb:m.heb,eng:m.eng,cat:m.cat,obj:m,diff:m.diff,build:m.build};}
function buildFilterBar(){
  const wrap=$("#filterBar"); if(!wrap) return;
  const msel=(v,cur)=>v==(cur)?' selected':'';
  wrap.innerHTML=`
    <select data-f="method" aria-label="${L('שיטה','Method')}"><option value="">${L('כל שיטה','Any method')}</option><option value="grill"${msel('grill',filters.method)}>🔥 ${L('גריל / אש ישירה','Grill / direct heat')}</option><option value="sv"${msel('sv',filters.method)}>💧 ${L('סו-ויד','Sous-vide')}</option><option value="smoke"${msel('smoke',filters.method)}>💨 ${L('עישון','Smoking')}</option><option value="build"${msel('build',filters.method)}>🔨 ${L('בנייה מאפס','Build from scratch')}</option></select>
    <select data-f="diff" aria-label="${L('קושי','Difficulty')}"><option value="0">${L('כל קושי','Any difficulty')}</option><option value="1"${msel(1,filters.diff)}>${L('קל (1)','Easy (1)')}</option><option value="2"${msel(2,filters.diff)}>${L('עד 2','Up to 2')}</option><option value="3"${msel(3,filters.diff)}>${L('עד 3','Up to 3')}</option><option value="4"${msel(4,filters.diff)}>${L('עד 4','Up to 4')}</option></select>
    <select data-f="time" aria-label="${L('זמן','Time')}"><option value="0">${L('כל זמן','Any time')}</option><option value="2"${msel(2,filters.time)}>${L('עד','Up to')} 2${L('ש','h')}</option><option value="6"${msel(6,filters.time)}>${L('עד','Up to')} 6${L('ש','h')}</option><option value="12"${msel(12,filters.time)}>${L('עד','Up to')} 12${L('ש','h')}</option><option value="24"${msel(24,filters.time)}>${L('עד','Up to')} 24${L('ש','h')}</option></select>
    <button data-f="kosher" class="fchip ${filters.kosher?'on':''}">${filters.kosher?'✓ ':''}${L('כשר בלבד','Kosher only')}</button>`;
  wrap.querySelectorAll("select").forEach(s=>s.addEventListener("change",()=>{
    const k=s.dataset.f; filters[k]= (k==='diff'||k==='time')? +s.value : s.value; render();
  }));
  wrap.querySelector('[data-f="kosher"]').addEventListener("click",e=>{
    filters.kosher=!filters.kosher;
    const b=wrap.querySelector('[data-f="kosher"]');
    b.classList.toggle("on",filters.kosher);
    b.textContent=(filters.kosher?'✓ ':'')+'כשר בלבד';
    if(filters.kosher){ [...activeCats].forEach(c=>{ if(!catHasKosher(c)) activeCats.delete(c); }); }
    if(typeof buildSubChips==='function') buildSubChips();
    render();
  });
}
/* ---------- unified two-tier category system ---------- */
const CAT_GROUPS=[
  {g:'בשר אדום', ic:'🥩', cats:['בקר','חזיר','טלה']},
  {g:'עופות', ic:'🍗', cats:['עוף','הודו','אווז','ברווז']},
  {g:'ים', ic:'🐟', cats:['דג','דג מעושן','פירות ים']},
  {g:'צמחי', ic:'🥦', cats:['ירקות','פירות']},
  {g:'איברים', ic:'🫀', cats:['איברים פנימיים']},
  {g:'מלאכה', ic:'🌭', cats:['נקניקיות','נקניק מעושן','נקניק מיובש','סלומי','פסטרמה','שווארמה','צלייה טחונה','BBQ קלאסי']},
  {g:'מיובש ומעושן', ic:'🥓', cats:['בשר מיובש','בייקון']},
  {g:'גבינות', ic:'🧀', cats:['גבינה']},
];
let activeGroup=null; // group name or null (=all)
function allCatCounts(kosherOnly){
  const c={};
  const add=(cat,key)=>{ if(kosherOnly && typeof isKosherOk==='function' && !isKosherOk(key)) return; c[cat]=(c[cat]||0)+1; };
  DATA.cuts.forEach(x=>add(x.cat,'cut-'+x.n));
  Object.entries(DATA.makes).forEach(([id,x])=>add(x.cat,'make-'+id));
  DATA.specials.forEach(x=>add(x.cat,'spec-'+x.n));
  return c;
}
function groupOf(cat){ const g=CAT_GROUPS.find(gr=>gr.cats.includes(cat)); return g?g.g:'אחר'; }
function effectiveCats(){
  if(activeCats.size) return activeCats;
  if(activeGroup){ const g=CAT_GROUPS.find(x=>x.g===activeGroup); return g?new Set(g.cats):null; }
  return null; // all
}
function setCatNav(group,cats){ activeGroup=group||null; activeCats=new Set(cats||[]); }
function buildChips(){
  buildCatGroups();
  buildSubChips();
}
function buildCatGroups(){
  const wrap=$("#catGroups"); if(!wrap) return;
  const counts=allCatCounts(filters.kosher);
  const groupCount=g=>g.cats.reduce((s,c)=>s+(counts[c]||0),0);
  const shown=CAT_GROUPS.filter(g=>groupCount(g)>0);
  wrap.innerHTML=`<span class="cgroup ${!activeGroup?'on':''}" data-gall>הכל</span>`+
    shown.map(g=>`<span class="cgroup ${activeGroup===g.g?'on':''}" data-group="${g.g}">${g.ic} ${g.g} <b>${groupCount(g)}</b></span>`).join("");
  wrap.onclick=e=>{ const t=e.target.closest('.cgroup'); if(!t) return;
    if(t.hasAttribute('data-gall')){ activeGroup=null; activeCats.clear(); buildCatGroups(); catView('landing'); return; }
    activeGroup=activeGroup===t.dataset.group?null:t.dataset.group;
    activeCats.clear(); buildCatGroups(); buildSubChips();
    if(activeGroup) catView('cat'); else catView('landing');
  };
}
function catHasKosher(cat){
  return (typeof cwAllItems==='function') && cwAllItems().some(i=>i.cat===cat && (typeof kosherStatus!=='function'||isKosherOk(i.key)));
}
function buildSubChips(){
  const wrap=$("#chips"); if(!wrap) return;
  const counts=allCatCounts(filters.kosher);   // counts reflect the active kosher filter
  // which cats to show as sub-filters: the active group's cats with >0 items (under the current filter)
  let cats;
  if(activeGroup){ const g=CAT_GROUPS.find(x=>x.g===activeGroup); cats=(g?g.cats:[]).filter(c=>counts[c]>0); }
  else { wrap.innerHTML=''; wrap.style.display='none'; return; }
  wrap.style.display='';
  wrap.innerHTML=`<span class="chip ${!activeCats.size?'on':''}" data-all>הכל בקבוצה</span>`+
    cats.map(c=>`<span class="chip" data-cat="${c}">${catEmoji(c)} ${c} <b>${counts[c]}</b></span>`).join("");
  wrap.onclick=e=>{ const t=e.target.closest('.chip'); if(!t) return;
    if(t.hasAttribute('data-all')){ activeCats.clear(); }
    else { const c=t.dataset.cat; activeCats.has(c)?activeCats.delete(c):activeCats.add(c); }
    syncChips(); render();
  };
}
function syncChips(){
  const wrap=$("#chips"); if(!wrap) return;
  [...wrap.children].forEach(ch=>{
    if(ch.hasAttribute("data-all"))ch.classList.toggle("on",!activeCats.size);
    else ch.classList.toggle("on",activeCats.has(ch.dataset.cat));
  });
}
function buildMakeChips(){ const w=$("#makeChips"); if(w){ w.innerHTML=''; w.style.display='none'; } }
// ── category landing tiles ──
function buildCatLanding(){
  const host=$("#catLanding"); if(!host) return;
  const counts=allCatCounts();
  const gc=g=>g.cats.reduce((s,c)=>s+(counts[c]||0),0);
  const tiles=CAT_GROUPS.filter(g=>gc(g)>0).map(g=>
    `<button class="cattile" data-tilegroup="${g.g}"><span class="ct-ic">${g.ic}</span><span class="ct-name">${g.g}</span><span class="ct-count">${gc(g)} פריטים</span></button>`).join('');
  host.innerHTML=`<div class="cat-hero"><h3 data-i18n-html="home.what">מה <b>מדליקים</b> היום?</h3><p>בחר קטגוריה או חפש למעלה</p></div>
    <div class="cat-tiles">
      <button class="cattile tfav" data-tilefav><span class="ct-ic">⭐</span><span class="ct-name">מועדפים</span><span class="ct-count" id="favTileN">0 פריטים</span></button>
      ${tiles}
      <button class="cattile tdict" data-tilegloss><span class="ct-ic">📖</span><span class="ct-name">מילון מונחים</span><span class="ct-count">שיטות, עצים ופחם</span></button>
    </div>`;
  host.querySelectorAll('[data-tilegroup]').forEach(b=>b.addEventListener('click',()=>{ filters.fav=false; setCatNav(b.dataset.tilegroup); buildChips(); catView('cat'); }));
  host.querySelectorAll('[data-tilefav]').forEach(b=>b.addEventListener('click',()=>{ filters.fav=true; setCatNav(null); const fb=$("#favBtn"); if(fb)fb.classList.add('on'); catView('fav'); }));
  host.querySelectorAll('[data-tilegloss]').forEach(b=>b.addEventListener('click',()=>catView('gloss')));
  const ft=$("#favTileN"); if(ft) ft.textContent=(favs.size||0)+' פריטים';
}
// ── catalog view controller: landing / category / gloss / fav / search ──
function catView(mode){
  const q=($("#q")&&$("#q").value||'').trim();
  if(!mode){ mode = q ? 'search' : (activeGroup? 'cat' : (filters.fav?'fav':'landing')); }
  const hide=ids=>ids.forEach(id=>{const e=$('#'+id); if(e) e.style.display='none';});
  const show=ids=>ids.forEach(id=>{const e=$('#'+id); if(e) e.style.display='';});
  if(mode==='landing'){
    buildCatLanding();
    show(['catLanding']);
    hide(['catGroups','chips','filterBar','countRow','cutsWrap','makesH','makesSub','makeGrid','specialsH','specSub','specGrid','glossH','glossSub','gloss','glossBar']);
    $("#catTitle").textContent='קטלוג';
  } else if(mode==='gloss'){
    hide(['catLanding','catGroups','chips','filterBar','countRow','cutsWrap','makesH','makesSub','makeGrid','specialsH','specSub','specGrid']);
    show(['glossH','glossSub','gloss','glossBar']);
    $("#catTitle").textContent='מילון מונחים';
  } else {
    hide(['catLanding','glossH','glossSub','gloss','glossBar','catGroups']);
    show(['chips','countRow','cutsWrap']);
    $("#chips").style.display = activeGroup?'':'none';
    $("#filterBar").style.display='';
    $("#catTitle").textContent = mode==='fav'?'מועדפים':(mode==='search'?'תוצאות חיפוש':(activeGroup||'קטלוג'));
    render();
  }
}

/* ---------- detail panel ---------- */
/* ---------- calculators ---------- */
function fmtG(g){ if(g<=0) return '0'; const kg=(typeof L==='function')?L('ק״ג','kg'):'ק״ג', gr=(typeof L==='function')?L('ג׳','g'):'ג׳'; return g>=1000 ? (g/1000).toFixed((g%1000)?2:0)+' '+kg : (g>=10?Math.round(g):g.toFixed(1))+' '+gr; }
// ---------- cure-scale guard ----------
// A cure (Cure #1, nitrite) dose too small for the user's scale to actually resolve is a safety defect,
// not a cosmetic one: under-dosing risks botulism, and the app's default rate (2.5 g/kg = 156ppm) already
// sits at the US regulatory maximum with zero headroom for over-dosing either. This layer is ADDITIVE
// ONLY — it reads an already-computed dose and never feeds back into any computed figure.
// Rule (20d is NIST Handbook 44 §2.20 UR.3.1 Table 8's recommended minimum load for a Class III scale):
//   dose < 5*d  -> hard warning (unweighable)     dose < 20*d -> advisory (poor accuracy)     else -> silent
function scaleReadability(){
  const dev=(typeof equipList==='function')?equipList().find(function(d){return d && d.cat==='other' && d.type==='scale';}):null;
  const res=dev?propOf(dev,'res'):undefined;
  if(res==='0.1g') return {d:0.1, known:true};
  if(res==='1g')   return {d:1,   known:true};
  // Fail-safe (owner-approved divergence from canSV()'s usual permissive-until-configured default):
  // an unknown scale must never stay silent — assume a typical 1g kitchen scale and phrase conditionally.
  return {d:1, known:false};
}
function fmtQty(n){ const r=n>=10?Math.round(n):Math.round(n*10)/10; return String(r); }
// doseG: the already-computed cure grams for this figure (read-only input — never modified).
// perUnitG: grams of cure produced per 1 unit of whatever batch variable the user types (kg meat,
// liters brine water, kg meat+water) — used only to phrase the "scale the batch up to X" suggestion.
function cureScaleGuardHTML(doseG, perUnitG, unitHe, unitEn){
  if(!(doseG>0)) return '';
  const ro=scaleReadability(), d=ro.d, known=ro.known;
  const hardMax=5*d, advMax=20*d;
  if(doseG>=advMax) return '';
  const hard=doseG<hardMax;
  const dTxt=(d===0.1)?L('0.1 גרם','0.1 g'):L('1 גרם','1 g');
  const doseTxt=esc(doseG.toFixed(2))+' '+L('גרם','g');
  const errPct=esc(String(Math.round((d/doseG)*100)));
  const target=perUnitG>0?advMax/perUnitG:0;
  const targetTxt=target>0?(esc(fmtQty(target))+' '+L(unitHe,unitEn)):'';
  const altScale=(d===1)?L('לחלופין, שקלו במשקל מדויק יותר (0.1 גרם).','Or weigh on a more precise 0.1 g scale.'):'';
  const msg = hard
    ? (known
        ? L(`⚠ מינון ה-Cure כאן הוא ${doseTxt} — כמות קטנה מדי לשקילה מדויקת במשקל שלכם (מדייק ל-${dTxt}). שגיאת השקילה עלולה להגיע ל-${errPct}%, ולגרום למינון חסר (סיכון בוטוליזם) או למינון עודף. הגדילו את האצווה ל-${targetTxt} לפחות. ${altScale}`,
             `⚠ This Cure dose is ${doseTxt} — too small to weigh accurately on your scale (reads to ${dTxt}). The weighing error could reach ${errPct}%, risking either under-dosing (botulism risk) or over-dosing. Scale the batch up to at least ${targetTxt}. ${altScale}`)
        : L(`⚠ מינון ה-Cure כאן הוא ${doseTxt}. לא הוגדר משקל בציוד — בהנחה שהמשקל שלכם מדייק ל-${dTxt} (משקל מטבח טיפוסי), הכמות קטנה מדי לשקילה מדויקת. שגיאת השקילה עלולה להגיע ל-${errPct}%, ולגרום למינון חסר (סיכון בוטוליזם) או למינון עודף. הגדילו את האצווה ל-${targetTxt} לפחות. ${altScale}`,
             `⚠ This Cure dose is ${doseTxt}. No scale is configured — assuming your scale reads to ${dTxt} (a typical kitchen scale), this amount is too small to weigh accurately. The weighing error could reach ${errPct}%, risking either under-dosing (botulism risk) or over-dosing. Scale the batch up to at least ${targetTxt}. ${altScale}`))
    : (known
        ? L(`מינון ה-Cure (${doseTxt}) קרוב לגבול הדיוק של המשקל שלכם (מדייק ל-${dTxt}) — שגיאת שקילה אפשרית עד ${errPct}%. לדיוק גבוה יותר, שקלו להגדיל את האצווה ל-${targetTxt}. ${altScale}`,
             `The Cure dose (${doseTxt}) is close to your scale's accuracy limit (reads to ${dTxt}) — possible weighing error up to ${errPct}%. For better accuracy, consider scaling the batch up to ${targetTxt}. ${altScale}`)
        : L(`מינון ה-Cure (${doseTxt}) עשוי להיות קרוב לגבול הדיוק של המשקל — לא הוגדר משקל בציוד; בהנחת משקל טיפוסי (${dTxt}), שגיאת שקילה אפשרית עד ${errPct}%. לדיוק גבוה יותר, שקלו להגדיל את האצווה ל-${targetTxt}. ${altScale}`,
             `The Cure dose (${doseTxt}) may be close to the scale's accuracy limit — no scale is configured; assuming a typical scale (${dTxt}), possible weighing error up to ${errPct}%. For better accuracy, consider scaling the batch up to ${targetTxt}. ${altScale}`));
  const cls=hard?'ai-caveat ai-caveat-strong':'calcnote';
  return `<div class="${cls}" data-cureguard="${hard?'hard':'advisory'}">${msg}</div>`;
}
function calcBoxHTML(calc){
  if(!calc) return '';
  const brine=calc.brine;
  return `<div class="calcbox" data-saltcalc>
    <h4>${L('מחשבון מלח וריפוי','Salt & cure calculator')}</h4>
    <div class="calcrow"><label>${brine?L('מים לתמלחת','Brine water'):L('משקל בשר','Meat weight')}</label>
      <input type="number" data-w min="0" step="${brine?'0.5':'50'}" value="${brine?'2':'1000'}">
      <span class="u">${brine?L('ליטר','liter'):L('גרם','grams')}</span></div>
    ${brine?`<div class="calcrow"><label>${L('משקל הנתח','Cut weight')} <small>(${L('לא חובה','optional')})</small></label><input type="number" data-mw min="0" step="100" value="0"><span class="u">${L('גרם','grams')}</span></div>`:''}
    <div class="calcout" data-out></div>
    <div class="calcnote" data-note></div>
    <div data-guard></div>
  </div>`;
}
function wireCalcBox(root, calc){
  const box=root.querySelector("[data-saltcalc]"); if(!box||!calc) return;
  const w=box.querySelector("[data-w]"), out=box.querySelector("[data-out]"), note=box.querySelector("[data-note]"), mw=box.querySelector("[data-mw]"), guard=box.querySelector("[data-guard]");
  const line=(l,v,s)=>`<div class="cl"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  function recompute(){
    const x=Math.max(0,parseFloat(w.value)||0); let h=''; let g=''; const gL=L('ג׳/ליטר','g/liter'), gKg=L('ג׳/ק״ג','g/kg');
    if(calc.brine){
      h+=line(L('מלח','Salt'), fmtG(x*calc.saltL), calc.saltL+' '+gL);
      const dipDoseG=x*calc.cureL;
      h+=line('Cure #1', fmtG(dipDoseG), calc.cureL+' '+gL);
      if(calc.cureL) g+=cureScaleGuardHTML(dipDoseG, calc.cureL, 'ליטר מים','L water');
      h+=line(L('סוכר','Sugar'), fmtG(x*calc.sugarL), calc.sugarL+' '+gL);
      const meat=mw?Math.max(0,parseFloat(mw.value)||0):0;
      if(meat>0){
        const suggestL=Math.ceil(meat/1000*10)/10; // ~1L per kg to submerge
        const totalKg=(meat+x*1000)/1000; const eqSalt=totalKg*1000*0.028; // grams: 2.8% equilibrium salt of (meat+water)
        h+=`<div class="cl cl-note"><span>${L('שיטת שיווי-משקל (מומלץ, מדויק):','Equilibrium method (recommended, precise):')}</span></div>`;
        h+=line(L('מים מומלצים לכיסוי','Recommended water to cover'), suggestL+' '+L('ליטר','liter'), L('≈1 ל׳/ק״ג בשר בשקית ואקום','≈1 L/kg meat in a vacuum bag'));
        h+=line(L('מלח לשיווי-משקל','Salt for equilibrium'), fmtG(eqSalt), L('2.8% ממשקל בשר+מים','2.8% of meat+water weight'));   // D4: eqSalt is already grams — the previous /1000 showed ~1000× too little
        if(calc.cureL){
          const eqDoseG=totalKg*2.5;
          h+=line(L('Cure #1 לשיווי-משקל','Cure #1 for equilibrium'), fmtG(eqDoseG), L('2.5 ג׳/ק״ג בשר+מים ≈156ppm','2.5 g/kg meat+water ≈156ppm'));   // D4: equilibrium nitrite dose — was left at the per-liter dip rate → unvalidated in the one calc where it's acutely dangerous
          g+=cureScaleGuardHTML(eqDoseG, 2.5, 'ק״ג בשר+מים','kg meat+water');
        }
      }
      note.textContent=L('תמלחת כבישה — שקלו לכסות את הנתח. שיטת שיווי-משקל (בשקית ואקום עם מעט מים) בטוחה מפני מליחות-יתר, ומינון ה-Cure מחושב לפי המשקל הכולל (בטוח). כבישה ~24ש לכל 1 ס״מ עובי.','Curing brine — weigh out to cover the cut. The equilibrium method (in a vacuum bag with a little water) is safe from over-salting, and the Cure dose is calculated from the total weight (safe). Cure ~24h per 1 cm of thickness.');
    } else {
      h+=line(L('מלח','Salt'), fmtG(x*calc.salt/1000), calc.salt+' '+gKg);
      if(calc.cure){
        const doseG=x*(calc.cureRate||2.5)/1000;
        h+=line('Cure #'+calc.cure, fmtG(doseG), (calc.cureRate||2.5)+' '+gKg);
        g+=cureScaleGuardHTML(doseG, calc.cureRate||2.5, 'ק״ג בשר','kg meat');
      }
      if(calc.sugar) h+=line(L('סוכר/דקסטרוז','Sugar/dextrose'), fmtG(x*calc.sugar/1000), calc.sugar+' '+gKg);
      if(calc.water) h+=line(L('קרח/מים','Ice/water'), fmtG(x*calc.water/100), calc.water+'%');
      note.textContent = calc.cure==='2' ? L('⚠ מוצר מיובש לא מבושל — דיוק ה-Cure קריטי לבטיחות.','⚠ Dry-cured, uncooked product — Cure accuracy is critical for safety.')
        : (calc.cure==='1' ? L('Cure #1 ב-2.5 ג׳/ק״ג ≈ 156ppm ניטריט (תקני ובטוח).','Cure #1 at 2.5 g/kg ≈ 156ppm nitrite (standard and safe).') : '');
    }
    out.innerHTML=h;
    if(guard) guard.innerHTML=g;
  }
  w.addEventListener('input',recompute); if(mw) mw.addEventListener('input',recompute); recompute();
}
const SERV_TYPES={
  meat:{heb:'🥩 בשר עיקרי',eng:'🥩 Main meat',light:220,reg:320,heavy:420,note:'מנה עיקרית — סטייק, צלי, עוף',noteEn:'Main course — steak, roast, chicken'},
  ground:{heb:'🌭 נקניקיות / טחון',eng:'🌭 Sausages / ground',light:160,reg:220,heavy:300,note:'נקניקיות, המבורגר, קבב',noteEn:'Sausages, burgers, kebab'},
  fish:{heb:'🐟 דג',eng:'🐟 Fish',light:180,reg:240,heavy:320,note:'פילה דג כמנה עיקרית',noteEn:'Fish fillet as a main'},
  seafood:{heb:'🦐 פירות ים (עם קליפה)',eng:'🦐 Seafood (in shell)',light:220,reg:320,heavy:450,note:'שרימפס/סרטן/לובסטר — כולל פחת קליפה',noteEn:'Shrimp/crab/lobster — includes shell loss'},
  offal:{heb:'🫀 איברים פנימיים',eng:'🫀 Offal',light:120,reg:180,heavy:250,note:'כבד, לב, שקדים — לרוב מנה עשירה וקטנה יותר',noteEn:'Liver, heart, sweetbreads — usually a rich, smaller portion'},
  cured:{heb:'🍖 שרקוטרי / מיובש',eng:'🍖 Charcuterie / cured',light:50,reg:75,heavy:110,note:'סלמי, פסטרמה, בשר מיובש, בייקון — כפרוסות דקות, בלי בישול',noteEn:'Salami, pastrami, cured meat, bacon — thin slices, no cooking'},
  cheese:{heb:'🧀 גבינה / מנה ראשונה',eng:'🧀 Cheese / starter',light:60,reg:90,heavy:130,note:'קרש גבינות, פתיח',noteEn:'Cheese board, appetizer'},
  veg:{heb:'🥦 ירקות (תוספת)',eng:'🥦 Vegetables (side)',light:120,reg:200,heavy:280,note:'ירקות על הגריל/בתנור כתוספת',noteEn:'Grilled/roasted vegetables as a side'},
  fruit:{heb:'🍑 פירות (קינוח)',eng:'🍑 Fruit (dessert)',light:100,reg:150,heavy:220,note:'פירות צלויים כקינוח/תוספת',noteEn:'Grilled fruit as dessert/side'}
};
function servTypeName(v){ return getLang()==='he'?v.heb:(v.eng||v.heb); }
function servTypeNote(v){ return getLang()==='he'?v.note:(v.noteEn||v.note); }
function servTypeFor(c){
  if(!c) return 'meat'; const cat=c.cat||'';
  if(cat==='פירות ים') return /טונה|הליבוט|סלמון|דג/.test(c.heb||'')?'fish':'seafood';
  if(cat==='דג'||cat==='דג מעושן') return 'fish';
  if(cat==='גבינה') return 'cheese';
  if(cat==='ירקות') return 'veg';
  if(cat==='פירות') return 'fruit';
  if(cat==='איברים פנימיים') return 'offal';
  if(/בשר מיובש|נקניק מיובש|סלומי|פסטרמה|בייקון/.test(cat)) return 'cured';
  if(/נקניקיות|צלייה טחונה/.test(cat)) return 'ground';
  return 'meat';
}
function servingsCalcHTML(c){
  const cur=servTypeFor(c);
  const opts=Object.entries(SERV_TYPES).map(([k,v])=>`<option value="${k}" ${k===cur?'selected':''}>${servTypeName(v)}</option>`).join('');
  return `<div class="calcbox" data-servcalc>
    <h4>${L('מחשבון כמויות לפי סועדים','Portions-by-guests calculator')}</h4>
    <div class="calcrow"><label>${L('סוג מנה','Dish type')}</label><select data-stype>${opts}</select></div>
    <div class="calcrow"><label>${L('מספר סועדים','Number of guests')}</label><input type="number" data-d min="1" value="4"><span class="u">${L('איש','people')}</span></div>
    <div class="calcrow"><label>${L('תיאבון','Appetite')}</label>
      <select data-app><option value="light">${L('קל','Light')}</option><option value="reg" selected>${L('רגיל','Regular')}</option><option value="heavy">${L('כבד','Heavy')}</option></select></div>
    <div class="calcout" data-out></div>
  </div>`;
}
function wireServCalc(root, c){
  const box=root.querySelector("[data-servcalc]"); if(!box) return;
  const d=box.querySelector("[data-d]"), app=box.querySelector("[data-app]"), st=box.querySelector("[data-stype]"), out=box.querySelector("[data-out]");
  const yld=()=> !c?0.7 : (c.tgt>=88?0.6:(c.tgt>=70?0.72:0.82));
  function recompute(){
    const diners=Math.max(1,parseInt(d.value)||1), t=SERV_TYPES[st.value]||SERV_TYPES.meat, per=t[app.value]||t.reg, y=yld();
    const noCook=(st.value==='cheese'||st.value==='cured');
    const cooked=diners*per, raw=cooked/y;
    const kg=L('ק״ג','kg');
    out.innerHTML=`<div class="cl"><span>${noCook?L('לקנייה','To buy'):L('נא לקנייה','Raw to buy')}</span><b>${((noCook?cooked:raw)/1000).toFixed(2)} ${kg}</b><small>${diners}×${per}${L('ג׳','g')}</small></div>
      ${!noCook?`<div class="cl"><span>${L('תשואה מבושלת','Cooked yield')}</span><b>${(cooked/1000).toFixed(2)} ${kg}</b><small>~${Math.round(y*100)}% ${L('אחרי בישול','after cooking')}</small></div>`:''}
      <div class="cl cl-note"><span>${servTypeNote(t)}</span></div>
      ${c?`<div class="cl"><span>${L('מול נתח בטבלה','vs the table cut')}</span><b>${c.kg} ${kg}</b><small>≈ ${Math.max(1,Math.round(raw/1000/c.kg))} ${L('יח׳','pcs')}</small></div>`:''}`;
  }
  d.addEventListener('input',recompute); app.addEventListener('change',recompute); st.addEventListener('change',recompute); recompute();
}
function openCalc(){
  const html=`<div class="panel-top"><button class="x" aria-label="${L('סגור','Close')}">✕</button>
     <div class="cat">${L('כלי עזר','Tools')}</div><h2>${L('מחשבונים','Calculators')}</h2><div class="en">${L('מלח · ריפוי · כמויות','Salt · cure · quantities')}</div></div>
   <div class="panel-body">
     <div class="calcrow" style="margin:16px 0 0"><label>${L('סוג מוצר','Product type')}</label>
       <select id="ptype">
        <option value="fresh">${L('נקניקייה טרייה','Fresh sausage')}</option>
        <option value="smoked">${L('מעושן-מבושל','Smoked-cooked')}</option>
        <option value="dry">${L('מיובש (פרמנט)','Dry-cured (fermented)')}</option>
        <option value="bacon">${L('בייקון','Bacon')}</option>
        <option value="brine">${L('פסטרמה (תמלחת)','Pastrami (brine)')}</option>
       </select></div>
     <div id="saltHost"></div>
     <hr style="border:none;border-top:1px solid var(--line);margin:20px 0">
     <div id="servHost"></div>
   </div>`;
  showPanel(html);
  const R={fresh:{salt:18,cure:null,sugar:0,water:10,brine:false},
    smoked:{salt:18,cure:'1',sugar:1,water:10,brine:false},
    dry:{salt:29,cure:'2',sugar:3,water:0,brine:false},
    bacon:{salt:20,cure:'1',sugar:10,water:0,brine:false,cureRate:2.0},
    brine:{brine:true,saltL:50,cureL:12,sugarL:20}};
  function paintSalt(){const c=R[$("#ptype").value];$("#saltHost").innerHTML=calcBoxHTML(c);wireCalcBox($("#saltHost"),c);}
  $("#ptype").addEventListener('change',paintSalt); paintSalt();
  $("#servHost").innerHTML=servingsCalcHTML(); wireServCalc($("#servHost"),null);
}

/* ---------- build (from-scratch) renderer ---------- */
function renderBuildInto(sel, key, b){
  const which='build';
  let h=`<div class="method-note">🔨 <span data-mt>${b.intro}</span></div>`;
  if(b.materials&&b.materials.length){
    h+=`<div class="matlist"><h4>${L('חומרים וציוד','Materials & equipment')}</h4><ul>`+b.materials.map(m=>`<li data-mt>${m}</li>`).join("")+`</ul></div>`;
  }
  if(b.calc) h+=calcBoxHTML(b.calc);
  if(b.variants&&b.variants.length){
    h+=`<div class="var"><h4>${L('סוגים / ווריאנטים','Types / variants')}</h4>`+b.variants.map(v=>`<div class="varitem"><div class="vt" data-mt>${v[0]}</div><p data-mt>${v[1]}</p></div>`).join("")+`</div>`;
  }
  h+=`<div class="steps" style="margin-top:14px"><h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 4px">${L('שלבי הבנייה','Build steps')}</h4>`+
     b.phases.map((p,i)=>stepHTML(key,which,i,p)).join("")+`</div>`;
  if(b.store) h+=`<div class="method-note" data-mt style="margin-top:14px;background:var(--fresh-l);border-color:#b8e0d4">${b.store}</div>`;
  document.querySelector(sel).innerHTML=h;
  if(b.calc) wireCalcBox(document.querySelector(sel), b.calc);
  wireSteps(key,which,b.phases);
  try{ if(typeof hydrateMT==='function') hydrateMT(document.querySelector(sel)); }catch(e){}   // translate build prose (intro/materials/variants/store) offline
}

function grillLine(c){
  if(c.grillable===false) return L('לא מומלץ לגריל ישיר (נתח ארוך-בישול)','Not recommended for direct grilling (a long-cook cut)');
  if(c.grt==null) return null;
  return `${c.grt}°C${c.grh?` · ${c.grh}${L('ש','h')}`:''}${c.grz?` · ${t(c.grz)}`:''}`;
}
function srcRow(label, o){
  if(!o) return '';
  if(o.ref==='UNVERIFIED') return `<tr><td>${label}</td><td style="color:var(--terra-d,#c9822e)">⚠ ${L('טרם אומת ממקור','Not yet source-verified')}</td></tr>`;
  const link=o.url?` <a href="${o.url}" target="_blank" rel="noopener" style="color:var(--ember2);text-decoration:none">↗</a>`:'';
  const note=o.note?`<div style="font-size:.82em;opacity:.7;margin-top:2px" data-mt>${o.note}</div>`:'';
  return `<tr><td>${label}</td><td>${o.ref||'—'}${link}${note}</td></tr>`;
}
function sourcesBlock(c){
  const hd=`<h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px">📚 ${L('מקורות ואימות','Sources & verification')}</h4>`;
  const s=c.src;
  if(!s||typeof s!=='object'){
    return `<div class="raw">${hd}<p style="opacity:.6;font-size:13px;margin:0">${L('טרם אומת ממקור ראשוני.','Not yet verified against a primary source.')}</p></div>`;
  }
  const rows=[srcRow(L('סו-ויד','Sous-vide'),s.sv),srcRow(L('עישון','Smoke'),s.smoke),srcRow(L('גריל','Grill'),s.grill),srcRow(L('בטיחות','Safety'),s.safe),srcRow(L('ריפוי/כבישה','Cure/brine'),s.cure)].join('');
  const ver=s.verified?`<tr><td>${L('אומת','Verified')}</td><td>${s.verified}</td></tr>`:'';
  const oa=c.order_svsmoke, ob=c.order_smokesv;
  let order='';
  if(oa||ob){
    const vt=`style="font-family:'Heebo';font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ember2);margin:2px 0"`;
    const hh=L('ש','h');
    order=`<div style="margin-top:10px"><div ${vt}>🔀 ${L('השפעת סדר','Order impact')}</div>`;
    if(oa) order+=`<div style="font-size:13px;line-height:1.5">${L('סו-ויד→עישון','Sous-vide→smoke')}: ${L('סו-ויד','sous-vide')} ${oa.sv.t}°/${oa.sv.h}${hh}${oa.dry?` → ${L('ייבוש','dry')} ${oa.dry.h}${hh}`:''} → ${L('עישון','smoke')} ${oa.smoke.t}°/${oa.smoke.h}${hh} <span style="opacity:.65">(${L('גימור חם','hot finish')})</span></div>`;
    if(ob) order+=`<div style="font-size:13px;line-height:1.5">${L('עישון→סו-ויד','Smoke→sous-vide')}: ${L('עישון','smoke')} ${ob.smoke.t}°/${ob.smoke.h}${hh}${ob.smoke.cold?` <span style="opacity:.65">(${L('עישון קר','cold smoke')})</span>`:''} → ${L('סו-ויד','sous-vide')} ${ob.sv.t}°/${ob.sv.h}${hh} <span style="opacity:.65">(${L('פסטור מלא','full pasteurization')})</span></div>`;
    order+=`</div>`;
  }
  return `<div class="raw">${hd}<table>${rows}${ver}</table>${order}</div>`;
}
function openCut(c){
  curProject=pendingProject; pendingProject=null;
  const altR=ALT_RUB[c.cat]||ALT_RUB["_default"];
  const key=`cut-${c.n}`;
  const build=DATA.builds["cut-"+c.n];
  const col=catColor(c.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(c.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${t(c.cat)} · ${L('נתח','Cut')} #${c.n}</div>
     <h2>${itemName(c)}</h2>
     <div class="en">${c.eng} · ${c.kg} ${L('ק״ג','kg')} · ${L('רמת קושי','difficulty')} ${dots(c.diff)}</div>
   </div>
   <div class="panel-body">
     ${c.desc?`<p class="itemdesc" data-mt>${c.desc}</p>`:''}
     <div class="statline">
       ${isProduce(c)?`
       <div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.sot}°<small> / ${Math.round(upperHours(c.soh)*60)}${L("ד'",'m')}</small></div></div>
       <div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${L('ש','h')}</small></div></div>
       <div class="stat"><div class="l">${L('גימור','Finish')}</div><div class="v">${c.smt}°</div></div>
       <div class="stat"><div class="l">${L('קושי','Difficulty')}</div><div class="v">${dots(c.diff)}</div></div>
       `:`
       <div class="stat"><div class="l">${L('סו-ויד','Sous-vide')}</div><div class="v">${c.svt}°<small> / ${c.svh}${L('ש','h')}</small></div></div>
       <div class="stat"><div class="l">${L('עישון','Smoke')}</div><div class="v">${c.smt}°<small> / ${c.smh}${L('ש','h')}</small></div></div>
       ${(c.grt!=null||c.grillable===false)?`<div class="stat"><div class="l">${L('גריל','Grill')}</div><div class="v">${c.grillable===false?'—':`${c.grt}°<small> / ${c.grh}${L('ש','h')}</small>`}</div></div>`:''}
       <div class="stat"><div class="l">${L('יעד מרקם','Texture target')}</div><div class="v" id="tgtStat">${c.tgt}°</div></div>
       ${c.safe?`<div class="stat"><div class="l">${L('בטיחות','Safety')}</div><div class="v">${c.safe}°</div></div>`:''}
       <div class="stat"><div class="l">${L('חוסך מעשנת','Smoker saved')}</div><div class="v" style="color:#a7d086">${c.saved}${L('ש','h')}</div></div>
       `}
     </div>
     ${donenessSelector(c)}
     ${methodToggleHTML(c,key)}
     ${build?`<div class="tabs"><div class="tab" data-tab="build">🔨 ${L('בנייה מאפס','Build from scratch')}</div><div class="tab on" data-tab="method">📋 ${L('תוכנית בישול','Cooking plan')}</div></div>`:''}
     <div class="progress"><i id="prog"></i></div>
     <div id="methodArea"></div>

     <div class="var">
       <h4>${isProduce(c)?L('טיפים','Tips'):L('ווריאנט תיבול חלופי','Alternative seasoning variant')}</h4>
       ${isProduce(c)?`<div class="varitem"><div class="vt">${L('טיפ הכנה','Prep tip')}</div><p>${t(c.somid)||'—'}. ${c.wood&&c.wood!=='ללא'?`${L('לניחוח עשן','For smoky aroma')}: ${t(c.wood)}.`:''}</p></div>`
       :`<div class="varitem"><div class="vt">${t(altR[0])}</div><p>${t(altR[1])}</p></div>
       <div class="varitem"><div class="vt">🪵 ${L('עץ מומלץ','Recommended wood')}</div><p>${t(c.wood)}.</p></div>`}
     </div>
     ${equipSectionHtml(c.equip)}
     ${seasPickerHTML(key, c.cat, isProduce(c), curProject?'edit':'view')}

     <div id="servHost"></div>
     <div id="extras"></div>

     <div class="raw">
       <h4 style="font-family:'Heebo';font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ember2);margin:0 0 8px">${L('נתוני גלם מהטבלה','Raw data from the table')}</h4>
       ${isProduce(c)?`<table>
        <tr><td>${L('גריל / אש ישירה','Grill / direct heat')}</td><td>${c.sot}°C · ~${Math.round(upperHours(c.soh)*60)} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('סו-ויד (ריכוך)','Sous-vide (soften)')}</td><td>${c.svt}°C · ${c.svh} ${L('שעות','hours')}</td></tr>
        <tr><td>${L('גימור לאחר סו-ויד','Finish after sous-vide')}</td><td>${c.smt}°C · ~${Math.round(upperHours(c.smh)*60)} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('ראב הבית (תבנית)','House rub (template)')}</td><td>${c.rub}</td></tr>
        <tr><td>${L('טיפ הכנה','Prep tip')}</td><td>${c.somid||'—'}</td></tr>
        <tr><td>${L('עץ לעשן (אופציונלי)','Wood for smoke (optional)')}</td><td>${c.wood}</td></tr>
        <tr><td>${L('רמת קושי','Difficulty')}</td><td>${c.diff} / 5</td></tr>
       </table>`:`<table>
        <tr><td>${L("טמפ' / זמן סו-ויד",'Sous-vide temp / time')}</td><td>${c.svt}°C · ${c.svh} ${L('שעות','hours')}</td></tr>
        <tr><td>${L("טמפ' / זמן עישון (סו-ויד+עישון)",'Smoke temp / time (sous-vide+smoke)')}</td><td>${c.smt}°C · ${c.smh} ${L('שעות','hours')}</td></tr>
        <tr><td>${L("טמפ' / זמן עישון בלבד",'Smoke-only temp / time')}</td><td>${c.sot}°C · ${c.soh} ${L('שעות','hours')}</td></tr>
        ${grillLine(c)?`<tr><td>${L("גריל (טמפ' / זמן / אזור)",'Grill (temp / time / zone)')}</td><td>${grillLine(c)}</td></tr>`:''}
        <tr><td>${L("טמפ' יעד (מרקם) / בטיחות",'Target temp (texture) / safety')}</td><td>${c.tgt}°C${c.safe?` / ${c.safe}°C`:''}</td></tr>
        <tr><td>${L('צריבה','Sear')}</td><td>${c.sear}</td></tr>
        <tr><td>${L('טיפול באמצע (סו-ויד+עישון)','Mid-cook treatment (sous-vide+smoke)')}</td><td>${c.mid}</td></tr>
        <tr><td>${L('טיפול / עטיפה (עישון בלבד)','Treatment / wrap (smoke-only)')}</td><td>${c.somid}</td></tr>
        <tr><td>${L('זמן מנוחה','Rest time')}</td><td>${c.rest} ${L("דק'",'min')}</td></tr>
        <tr><td>${L('מרינדה / ראב','Marinade / rub')}</td><td>${c.rub}</td></tr>
        <tr><td>${L("צ'אנקים / עץ",'Chunks / wood')}</td><td>${c.wood}</td></tr>
        <tr><td>${L('פחם מומלץ','Recommended charcoal')}</td><td>${c.coal}</td></tr>
        <tr><td>${L('רמת קושי','Difficulty')}</td><td>${c.diff} / 5</td></tr>
       </table>`}
     </div>
     ${sourcesBlock(c)}
   </div>`;
  showPanel(html);
  $("#servHost").innerHTML=servingsCalcHTML(c); wireServCalc($("#servHost"),c);
  fillExtras(key);
  // method tabs
  const produce=isProduce(c);
  function comboNote(combo){
    const has=m=>combo.includes(m);
    const parts=[];
    if(has('sv')) parts.push(L('🌊 סו-ויד — בישול מדויק באמבט','🌊 Sous-vide — precise water-bath cooking'));
    if(has('smoke')) parts.push(L('💨 עישון — טעם עשן וקרום','💨 Smoking — smoke flavor and bark'));
    if(has('grill')) parts.push(L('🔥 גריל — צריבה וטעם אש','🔥 Grill — sear and fire flavor'));
    let extra='';
    if(has('sv')&&has('smoke')&&has('grill')) extra=L(' המסלול המלא: דיוק, עשן, וצריבה קצרה לקרום בסוף.',' The full route: precision, smoke, and a quick sear for crust at the end.');
    else if(has('sv')&&has('grill')&&!has('smoke')) extra=L(' הצירוף המנצח למידת עשייה מושלמת עם קרום.',' The winning combo for perfect doneness with a crust.');
    else if(has('sv')&&has('smoke')) extra=L(` חוסך כ-${c.saved||1} שעות מעשנת.`,` Saves about ${c.saved||1} smoker hours.`);
    else if(has('smoke')&&has('grill')) extra=L(' reverse-sear קלאסי: עשן איטי ואז צריבה.',' Classic reverse-sear: slow smoke then sear.');
    return parts.join(' + ')+'.'+extra;
  }
  function paintMethod(){
    const combo=ctxMethods(c,key);
    const steps=injectSeasoningSteps(composedSteps(c,combo), key, !curProject);   // catalog card = template steps
    const mkey='m-'+combo.slice().sort().join('_');
    $("#methodArea").innerHTML=`<div class="method-note">${comboNote(combo)}</div><div class="steps">`+
      steps.map((s,i)=>stepHTML(key,mkey,i,s)).join("")+`</div>`;
    wireSteps(key,mkey,steps);
  }
  function paint(which){
    if(which==='build'&&build){ renderBuildInto("#methodArea", key+"-b", build); $("#prog").style.width="0%"; return; }
    paintMethod();
  }
  // toggle wiring with validation
  $("#panel").querySelectorAll('.mtoggle').forEach(b=>b.addEventListener('click',()=>{
    if(b.disabled) return;
    const cur=ctxMethods(c,key);
    const m=b.dataset.mt;
    const next=cur.includes(m)? cur.filter(x=>x!==m) : [...cur,m];
    if(!validCombo(c,next)){
      const r=methodRules(c);
      let msg='לצומח: עד 2 שיטות — שלושתן יחד יבשלו יתר-על-המידה';
      if(!next.length) msg='חייבת להישאר שיטה אחת לפחות';
      else if(r.require&&!r.require.every(x=>next.includes(x))) msg='הפריט דורש ריכוך מקדים (סו-ויד)';
      else if(r.needsCookFor==='grill'&&next.includes('grill')&&next.length===1) msg='נתח ארוך-בישול: גריל רק כגימור — השאר גם סו-ויד או עישון';
      toast(msg);
      return;
    }
    if(curProject) store.set(methodKeyFor(key),next); else cardSet('method:'+key,next);
    b.classList.toggle('on');
    clearTimers(); paintMethod();
  }));
  $("#panel").querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
    $("#panel").querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
    t.classList.add("on");clearTimers();paint(t.dataset.tab);
  }));
  paintMethod();
  _mkMethodRepaint=paintMethod;   // i18n: let a language switch regenerate these steps
  wireDoneness(c);
  $("#panel").querySelectorAll('[data-seas]').forEach(b=>b.addEventListener('click',()=>openFrom(()=>openCut(c), ()=>{
    const s=(DATA.seasonings||[]).find(x=>x.id===b.dataset.seas); if(!s) return;
    showPanel(`${toolTop(s.heb, s.eng+' · '+s.origin, KIND_EMOJI[s.kind], cont2color(s.cont))}<div class="panel-body">${seasoningDetailHTML(s)}</div>`);
  })));
  wireSeasPicker($("#panel"), key, c.cat, isProduce(c), curProject?'edit':'view', ()=>{ clearTimers(); paintMethod(); toast('התיבול עודכן — השלבים חושבו מחדש'); }, ()=>openCut(c));
}

/* ── per-cut doneness ─────────────────────────────────────────── */
const DONE_SCALES={
  steak:{rare:'נא',mr:'מדיום-רייר',med:'מדיום',mw:'מדיום-וֶל',well:'עשוי'},
  white:{mr:'עסיסי',med:'מאוזן',well:'מוצק'},
  dark:{mr:'רך',med:'מאוזן',well:'נשלף'},
  fish:{mr:'משיי',med:'פלקי',well:'מוצק'}
};
const DONE_SCALES_EN={
  steak:{rare:'Rare',mr:'Medium-rare',med:'Medium',mw:'Medium-well',well:'Well done'},
  white:{mr:'Juicy',med:'Balanced',well:'Firm'},
  dark:{mr:'Tender',med:'Balanced',well:'Fall-apart'},
  fish:{mr:'Silky',med:'Flaky',well:'Firm'}
};
function doneLabel(cut,k){
  const sc=(cut&&cut.doneness&&cut.doneness.scale)||'steak';
  const T=(typeof getLang==='function'&&getLang()!=='he')?DONE_SCALES_EN:DONE_SCALES;
  return (T[sc]&&T[sc][k])||T.steak[k]||k;
}
function doneKey(cut){ return 'done:cut-'+cut.n; }
function currentDoneness(cut){
  if(!cut.doneness) return null;
  const saved=cardGet(doneKey(cut));   // session-only: template resets on next visit
  return (saved && cut.doneness.levels[saved])? saved : cut.doneness.default;
}
function donenessTarget(cut){
  const d=currentDoneness(cut);
  return d? cut.doneness.levels[d].c : cut.tgt;
}
function donenessSelector(cut){
  if(!cut.doneness) return '';
  const cur=currentDoneness(cut);
  const order=['rare','mr','med','mw','well'];
  const btns=order.filter(k=>cut.doneness.levels[k]).map(k=>{
    const lv=cut.doneness.levels[k];
    return `<button class="dn-btn ${k===cur?'on':''}" data-done="${k}">
      <span class="dn-l">${doneLabel(cut,k)}</span><span class="dn-c">${lv.c}°</span></button>`;
  }).join('');
  return `<div class="dn-wrap">
    <div class="dn-head">${L('מידת עשייה','Doneness')} <small>(${L('טמפ׳ פנים = מידת עשייה; הזמן משפיע על מרקם בלבד','internal temp = doneness; time affects texture only')})</small></div>
    <div class="dn-btns">${btns}</div>
    <button class="dn-reset" data-donereset>↺ ${L('חזרה למומלץ','Back to recommended')} (${doneLabel(cut,cut.doneness.default)})</button>
  </div>`;
}
function wireDoneness(cut){
  if(!cut.doneness) return;
  const panel=$("#panel"); if(!panel) return;
  panel.querySelectorAll('[data-done]').forEach(b=>b.addEventListener('click',()=>{
    cardSet(doneKey(cut),b.dataset.done);
    panel.querySelectorAll('[data-done]').forEach(x=>x.classList.toggle('on',x===b));
    const tgt=cut.doneness.levels[b.dataset.done].c;
    const stat=$("#tgtStat"); if(stat) stat.textContent=tgt+'°';
    toast(`${L('יעד עודכן','Target updated')}: ${doneLabel(cut,b.dataset.done)} · ${tgt}°`);
  }));
  const rb=panel.querySelector('[data-donereset]');
  if(rb) rb.addEventListener('click',()=>{
    localStorage.removeItem(doneKey(cut));
    const def=cut.doneness.default, tgt=cut.doneness.levels[def].c;
    panel.querySelectorAll('[data-done]').forEach(x=>x.classList.toggle('on',x.dataset.done===def));
    const stat=$("#tgtStat"); if(stat) stat.textContent=tgt+'°';
    toast(`${L('איפוס למומלץ','Reset to recommended')}: ${doneLabel(cut,def)} · ${tgt}°`);
  });
}

function stepHTML(key,which,i,s){
  const [t,c,sec]=s;
  const ck=(curProject?((projById(curProject)||{}).doneSteps||[]).includes(i):cardGet(`${key}-${which}-${i}`))?'done':'';
  return `<div class="step ${ck}" data-i="${i}">
     <button class="cbx ${ck}" data-ck>${ck?'✓':''}</button>
     <div class="step-main">
       <div class="step-t" data-mt>${t}</div>
       <div class="step-c" data-mt>${c}</div>
       ${sec?timerHTML(sec, key+'-'+which+'-'+i):''}
     </div>
   </div>`;
}
function timerHTML(sec, id, name){
  return `<div class="timer" data-sec="${sec}" data-left="${sec}"${id?` data-tid="${esc(id)}"`:''}${name?` title="${esc(name)}" data-name="${esc(name)}"`:''} role="timer">
     <button data-play aria-label="${L('הפעל טיימר','Start timer')}">▶</button>
     <span class="tt">${fmt(sec)}</span>
     <span class="tt-alert" role="alert" aria-live="assertive"></span>
     <button class="rst" data-reset aria-label="${L('אפס טיימר','Reset timer')}">↻</button>
   </div>`;
}
let mkAudioCtx=null;
// unlock audio inside a user gesture (the play tap) so the completion alarm can actually sound
function timerAudioPrime(){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; if(!mkAudioCtx) mkAudioCtx=new AC(); if(mkAudioCtx.state==='suspended') mkAudioCtx.resume(); }catch(e){} }
// real audible alarm — three short 880Hz beeps (was: new AudioContext() that produced no sound)
function timerBeep(){ try{ if(!mkAudioCtx) timerAudioPrime(); if(!mkAudioCtx) return; if(mkAudioCtx.state==='suspended') mkAudioCtx.resume();
  const ctx=mkAudioCtx, t0=ctx.currentTime;
  [0,0.35,0.7].forEach(function(t){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001,t0+t); g.gain.exponentialRampToValueAtTime(0.3,t0+t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+t+0.3); o.start(t0+t); o.stop(t0+t+0.32); });
  }catch(e){} }
function wireSteps(key,which,steps){
  const area=$("#methodArea");
  area.querySelectorAll(".step").forEach(st=>{
    const i=+st.dataset.i;
    st.querySelector("[data-ck]").addEventListener("click",()=>{
      const done=!st.classList.contains("done");
      st.classList.toggle("done",done);
      const b=st.querySelector(".cbx");b.classList.toggle("done",done);b.textContent=done?'✓':'';
      if(curProject){ const a=pantry(), p=a.find(x=>x.id===curProject); if(p){ p.doneSteps=p.doneSteps||[]; if(done){ if(!p.doneSteps.includes(i)) p.doneSteps.push(i); } else p.doneSteps=p.doneSteps.filter(x=>x!==i); savePantry(a); } }
      else cardSet(`${key}-${which}-${i}`,done);
      updateProg(key,which,steps.length);
    });
  });
  area.querySelectorAll(".timer").forEach(tm=>wireTimer(tm));
  updateProg(key,which,steps.length);
}
function updateProg(key,which,total){
  let done=0;
  if(curProject){ const ds=((projById(curProject)||{}).doneSteps)||[]; done=ds.filter(i=>i<total).length; }
  else { for(let i=0;i<total;i++)if(cardGet(`${key}-${which}-${i}`))done++; }
  const p=$("#prog");if(p)p.style.width=(done/total*100)+"%";
}
// persistent timer state (mk-timers): a running timer stores its END timestamp, so it keeps counting
// real time and survives navigation AND page reload; a paused timer stores its remaining seconds.
function _timerAll(){ return store.get('mk-timers')||{}; }
function _timerGet(id){ return id?(_timerAll()[id]||null):null; }
function _timerSet(id, rec){ if(!id) return; const s=_timerAll(), now=Date.now();
  Object.keys(s).forEach(k=>{ const r=s[k]; if(r&&r.end&&r.end<now-12*3600e3) delete s[k]; });   // prune finished/stale
  if(rec) s[id]=rec; else delete s[id]; store.set('mk-timers', s); }
// opts (optional): { warnSec, onWarn(left), onEnd } — used by the voice-cook timer for spoken alerts.
function wireTimer(tm, opts){
  opts=opts||{};
  const id=tm.dataset.tid||'', sec=+tm.dataset.sec;
  const tt=tm.querySelector(".tt"), play=tm.querySelector("[data-play]"), al=tm.querySelector(".tt-alert");
  let iv=null, endsAt=0, left=+tm.dataset.left, warned=false;
  const stop=()=>{ if(iv){clearInterval(iv);iv=null;} };
  const idle=l=>{ play.textContent="▶"; play.setAttribute('aria-label',L('הפעל טיימר','Start timer')); tt.textContent=fmt(Math.max(0,l)); };
  const done=()=>{ stop(); play.textContent="▶"; play.setAttribute('aria-label',L('הפעל טיימר','Start timer')); tm.classList.add("ringing"); tt.textContent=L('סיום!','Done!'); if(al) al.textContent=L('הטיימר הסתיים!','Timer finished!'); };
  const tick=()=>{ left=Math.round((endsAt-Date.now())/1000);
    if(opts.warnSec && !warned && left<=opts.warnSec && left>0 && opts.onWarn){ warned=true; try{opts.onWarn(left);}catch(e){} }   // R5: one-shot latch (was left===warnSec — stuttered ~4x / could skip)
    if(left<=0){ done(); timerBeep(); _timerSet(id,{end:endsAt,name:tm.dataset.name||'',fired:1}); if(opts.onEnd){ try{opts.onEnd();}catch(e){} } return; }
    tt.textContent=fmt(left); };
  const run=()=>{ play.textContent="❚❚"; play.setAttribute('aria-label',L('השהה טיימר','Pause timer')); tm.classList.remove("ringing"); if(al) al.textContent=""; stop(); iv=setInterval(tick,250); timers["t"+Math.random()]=iv; tick(); };
  const startFresh=()=>{ warned=false; timerAudioPrime(); endsAt=Date.now()+left*1000; _timerSet(id,{end:endsAt,name:tm.dataset.name||''}); run(); };
  const pause=()=>{ stop(); left=Math.max(0,Math.round((endsAt-Date.now())/1000)); idle(left); _timerSet(id,{left:left}); };
  // restore prior state on (re-)wire: running keeps counting, paused shows the remaining time, finished shows סיום
  const rec=_timerGet(id);
  if(rec){ if(rec.end!=null){ if(rec.end-Date.now()<-12*3600e3){ _timerSet(id,null); } else { endsAt=rec.end; left=Math.round((endsAt-Date.now())/1000); if(left<=0) done(); else run(); } }
    else if(typeof rec.left==='number'){ left=rec.left; idle(left); } }
  play.addEventListener("click",()=>{ if(iv){ pause(); return; } if(tm.classList.contains('ringing')){ tm.classList.remove('ringing'); left=sec; } startFresh(); });
  tm.querySelector("[data-reset]").addEventListener("click",()=>{ stop(); left=sec; endsAt=0; warned=false; tm.classList.remove("ringing"); if(al) al.textContent=""; idle(sec); _timerSet(id,null); });
  tm.addEventListener("click", e=>e.preventDefault());   // tapping the timer must not toggle a parent <label> (plan-view rows)
}
function clearTimers(){Object.values(timers).forEach(clearInterval);timers={};}
// global alarm watcher: fires the beep + a notification for ANY expiring timer across all events,
// even when its screen isn't open — essential for parallel multi-event cooking.
let mkTimerWatch=null;
// ── Wave A: background-resilient alarms ──────────────────────────────────────
// A timer only ticks while the page runs, so an alarm can be missed at the smoker. Three
// layers guard against that: a screen wake-lock keeps the page alive; alarms route through
// the service-worker registration so they actually appear on Android/iOS (where a bare
// new Notification() is a no-op); and a fired timer re-pulses (beep+vibrate) until it's
// acknowledged. None of this guarantees delivery on a fully-killed page without a push
// server — the alerts toggle says so honestly.
let mkSWReg=null, mkWakeLock=null, mkRingIv=null;
function mkNotify(title, body, tag){
  try{ if(mkSWReg && mkSWReg.showNotification && ('Notification' in window) && Notification.permission==='granted'){
    mkSWReg.showNotification(title, {body:body||'', icon:'icon-192.png', badge:'icon-192.png', tag:tag||'mk-timer', renotify:true, requireInteraction:true, vibrate:[200,100,200,100,200]});
    return true; } }catch(e){}
  try{ if(('Notification' in window) && Notification.permission==='granted'){ new Notification(title,{body:body||'',icon:'icon-192.png'}); return true; } }catch(e){}   // desktop fallback
  return false;
}
function mkVibrate(pat){ try{ if(navigator.vibrate) navigator.vibrate(pat||[200,100,200]); }catch(e){} }
async function acquireWakeLock(){ try{ if('wakeLock' in navigator && !mkWakeLock){ mkWakeLock=await navigator.wakeLock.request('screen'); mkWakeLock.addEventListener('release',function(){ mkWakeLock=null; }); } }catch(e){ mkWakeLock=null; } }
function releaseWakeLock(){ try{ if(mkWakeLock){ var w=mkWakeLock; mkWakeLock=null; w.release(); } }catch(e){} }
function anyTimerActive(){ const ts=store.get('mk-timers')||{}; return Object.keys(ts).some(function(k){ return ts[k]&&ts[k].end&&!ts[k].fired; }); }
function anyTimerRinging(){ const ts=store.get('mk-timers')||{}; return Object.keys(ts).some(function(k){ return ts[k]&&ts[k].fired; }); }
function syncWakeLock(){ if(anyTimerActive()||anyTimerRinging()) acquireWakeLock(); else releaseWakeLock(); }
function startRingLoop(){ if(mkRingIv) return; mkRingIv=setInterval(function(){
    if(!anyTimerRinging()){ clearInterval(mkRingIv); mkRingIv=null; releaseWakeLock(); return; }
    if(document.visibilityState==='visible'){ try{ timerBeep(); }catch(e){} mkVibrate([300,150,300]); }   // re-pulse a fired-but-unacknowledged alarm every few seconds
  }, 4000); }
try{ document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible' && (anyTimerActive()||anyTimerRinging())) acquireWakeLock(); }); }catch(e){}   // wake-lock drops when hidden — re-take it on return
function startTimerWatch(){
  if(mkTimerWatch) return;
  mkTimerWatch=setInterval(function(){
    const ts=store.get('mk-timers')||{}, now=Date.now(); let changed=false;
    Object.keys(ts).forEach(function(k){ const r=ts[k];
      if(r && r.end && !r.fired && r.end<=now){ r.fired=1; changed=true;
        try{ timerBeep(); }catch(e){}
        mkVibrate([200,100,200,100,200]);
        { var _en=(typeof timerEventName==='function')?timerEventName(k):''; mkNotify('⏱ הטיימר הסתיים'+(_en?' · '+_en:''), (r.name||'טיימר בישול'), 'mk-'+k); }   // E2: name which event's timer fired
      }
    });
    if(changed){ store.set('mk-timers', ts); startRingLoop(); try{ if(typeof renderAlarm==='function') renderAlarm(); }catch(e){} try{ if(typeof cRefreshHome==='function') cRefreshHome(); }catch(e){} try{ if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){} }   // F2: home banner + the global in-app alarm + the floating active shortcut
    syncWakeLock();
  }, 1000);
}
// ── In-app alarm banner ──────────────────────────────────────────────────────
// A fixed overlay listing every RINGING (fired) timer with a Stop button, shown on any screen — so
// an alarm can be seen and silenced from inside the app, not only by finding its specific timer.
function _ringingTimers(){ const ts=store.get('mk-timers')||{};
  return Object.keys(ts).filter(function(k){ return ts[k]&&ts[k].fired; }).map(function(k){ return {id:k, name:(ts[k].name||'טיימר בישול'), ev:(typeof timerEventName==='function'?timerEventName(k):'')}; }); }
function ackAlarm(id){ const ts=store.get('mk-timers')||{};
  if(id){ delete ts[id]; } else { Object.keys(ts).forEach(function(k){ if(ts[k]&&ts[k].fired) delete ts[k]; }); }
  store.set('mk-timers', ts);
  if(!anyTimerRinging() && mkRingIv){ clearInterval(mkRingIv); mkRingIv=null; }   // last one acknowledged → stop the re-pulse loop
  try{ renderAlarm(); }catch(e){} try{ syncWakeLock(); }catch(e){} try{ if(typeof cRefreshHome==='function') cRefreshHome(); }catch(e){} try{ if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){}
}
function renderAlarm(){
  const ring=_ringingTimers(); let el=document.getElementById('mkAlarm');
  if(!ring.length){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement('div'); el.id='mkAlarm'; el.className='mk-alarm'; el.setAttribute('role','alertdialog'); el.setAttribute('aria-live','assertive'); el.setAttribute('aria-label','טיימר הסתיים'); document.body.appendChild(el); }
  el.innerHTML=`<div class="mka-head">⏰ <b>${ring.length>1?ring.length+' טיימרים הסתיימו':'טיימר הסתיים'}</b></div>`+
    ring.map(function(r){ return `<div class="mka-row"><span class="mka-name">${esc(r.name)}${r.ev?` <small>· ${esc(r.ev)}</small>`:''}</span><button class="mka-stop" data-alarmstop="${encodeURIComponent(r.id)}">🔕 עצור</button></div>`; }).join('')+
    (ring.length>1?`<button class="mka-stopall" data-alarmstopall>🔕 עצור הכל</button>`:'');
  el.querySelectorAll('[data-alarmstop]').forEach(function(b){ b.addEventListener('click',function(){ ackAlarm(decodeURIComponent(b.dataset.alarmstop)); }); });
  const sa=el.querySelector('[data-alarmstopall]'); if(sa) sa.addEventListener('click',function(){ ackAlarm(); });
}

function openSpec(s){
  curProject=pendingProject; pendingProject=null;
  const smk = s.smt? `${s.smt}°C · ${s.smh} ${L('שעות','hours')}` : t(s.smh);
  const build=DATA.builds["spec-"+s.n];
  function buildSteps(){
    const steps=[];
    if(s.cure&&s.cure!=='—') steps.push([L("ריפוי / כבישה","Cure / brine"),t(s.cure),0]);
    if(s.smt) steps.push([L("עישון","Smoke"),L(`עשן ב-${s.smt}°C למשך ${s.smh} שעות${typeof s.tgt==='number'?` עד ${s.tgt}°C פנימי`:''}.`,`Smoke at ${s.smt}°C for ${s.smh} hours${typeof s.tgt==='number'?` until ${s.tgt}°C internal`:''}.`),upperHours(s.smh)*3600]);
    else steps.push([L("עישון / ייבוש","Smoke / dry"),t(s.smh),0]);
    if(s.age&&s.age!=='—') steps.push([L("ייבוש / הבשלה","Dry / age"),t(s.age),0]);
    steps.push([L("הערת מקצוע","Pro note"),t(s.note),0]);
    return steps;
  }
  const key=`spec-${s.n}`;
  const col=catColor(s.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(s.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${t(s.cat)}${s.origin?` · ${t(s.origin)}`:` · ${L('מוצר','Product')} #${s.n}`}</div>
     <h2>${itemName(s)}</h2>
     <div class="en">${s.eng} · ${L('רמת קושי','difficulty')} ${dots(s.diff)}</div>
   </div>
   <div class="panel-body">${s.desc?`<p class="itemdesc" data-mt>${s.desc}</p>`:''}
     <div class="statline">
       <div class="stat"><div class="l">${L('עישון','Smoke')}</div><div class="v" style="font-size:15px">${smk}</div></div>
       <div class="stat"><div class="l">${L('יעד / הבשלה','Target / age')}</div><div class="v" style="font-size:15px">${typeof s.tgt==='number'?s.tgt+'°':(s.age!=='—'?t(s.age):s.tgt)}</div></div>
       <div class="stat"><div class="l">${L('עץ','Wood')}</div><div class="v" style="font-size:15px">${t(s.wood)}</div></div>
     </div>
     ${build?`<div class="tabs">
       <div class="tab on" data-tab="build">${L('בנייה מאפס','Build from scratch')}</div>
       <div class="tab" data-tab="quick">${L('סקירה מהירה','Quick overview')}</div>
     </div>`:''}
     <div class="progress"><i id="prog"></i></div>
     <div id="methodArea"></div>
     ${equipSectionHtml(s.equip)}
     <div id="extras"></div>
     ${sourcesBlock(s)}
   </div>`;
  showPanel(html);
  fillExtras(key);
  function quick(){
    const steps=buildSteps();
    $("#methodArea").innerHTML=`<div class="method-note">${t(s.note)}</div><div class="steps">`+
      steps.map((st,i)=>stepHTML(key,'one',i,st)).join("")+`</div>`;
    wireSteps(key,'one',steps);
    _mkMethodRepaint=quick;   // i18n: regenerate these steps on a language switch
  }
  if(build){
    renderBuildInto("#methodArea", key+"-b", build);
    $("#panel").querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
      $("#panel").querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
      t.classList.add("on");clearTimers();
      if(t.dataset.tab==='build'){ _mkMethodRepaint=null; renderBuildInto("#methodArea", key+"-b", build); } else quick();
    }));
  } else { quick(); }
}

function openMake(id){
  const m=DATA.makes[id]; if(!m) return;
  curProject=pendingProject; pendingProject=null;
  const col=catColor(m.cat);
  const html=`
   <div class="panel-top" style="--c:${col}">
     ${headArt(m.cat)}
     <button class="x" aria-label="סגור">✕</button>
     <div class="cat" style="color:${col}">${t(m.cat)}${m.origin?` · ${t(m.origin)}`:''}</div>
     <h2>${itemName(m)}</h2>
     <div class="en">${m.eng} · ${L('רמת קושי','difficulty')} ${dots(m.diff)}</div>
   </div>
   <div class="panel-body">${m.desc?`<p class="itemdesc" data-mt>${m.desc}</p>`:''}<div class="progress"><i id="prog"></i></div><div id="methodArea"></div>${equipSectionHtml(m.equip)}<div id="extras"></div>${sourcesBlock(m)}</div>`;
  showPanel(html);
  renderBuildInto("#methodArea", "make-"+id, m.build);
  fillExtras("make-"+id);
}

let lastFocus=null;
let panelStack=[];        // stack of reopener functions for back-navigation
function showPanel(html){
  lastFocus=document.activeElement;
  _mkMethodRepaint=null;   // i18n: clear any prior recipe-repaint hook; a recipe panel re-registers its own below
  const p=$("#panel");p.innerHTML=html;p.classList.add("open");p.setAttribute("aria-hidden","false");
  try{ if(typeof applyI18n==='function') applyI18n(p); }catch(e){}   // Wave 5: translate any data-i18n chrome inside dynamically-rendered panels
  try{ if(typeof tnode==='function') tnode(p); }catch(e){}           // Wave 5: dictionary-translate exact-match chrome strings in the panel
  try{ if(typeof hydrateMT==='function') hydrateMT(p); }catch(e){}   // Wave 5: async-translate any [data-mt] recipe prose behind the number-safety guard
  $("#scrim").classList.add("open");document.body.classList.add("noscroll");
  try{ if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){}   // hide the floating shortcut while a panel is open
  const xb=p.querySelector(".x"); if(xb) xb.addEventListener("click",closePanel);
  const top=p.querySelector(".panel-top");
  p.scrollTop=0; const body=p.querySelector(".panel-body"); if(body) body.scrollTop=0;
  if(panelStack.length && top && !top.querySelector(".backbtn")){
    const bb=document.createElement("button");
    bb.className="backbtn"; bb.type="button"; bb.textContent=(typeof t==='function'?t('→ חזרה לחלון הקודם'):"→ חזרה לחלון הקודם");
    bb.setAttribute("aria-label",(typeof t==='function'?t('חזרה לחלון הקודם'):"חזרה לחלון הקודם"));
    bb.addEventListener("click",panelBack);
    top.appendChild(bb);   // in panel-top: always a direct child, never wiped by body re-render
  }
  if(top && !top.querySelector(".prbtn")){
    const pb=document.createElement("button");
    pb.className="prbtn"; pb.type="button"; pb.textContent="⎙ PDF"; pb.setAttribute("data-print","");
    top.appendChild(pb);
  }
  p.querySelectorAll("[data-print]").forEach(b=>b.addEventListener("click",()=>window.print()));
  const h=p.querySelector("h2"); p.setAttribute("aria-label", h?h.textContent:"פרטים");
  requestAnimationFrame(()=>{ const x=p.querySelector(".x"); (x||p).focus(); });
}
// open a panel FROM another panel, remembering how to return to the current one
function openFrom(reopenCurrent, openNext){ panelStack.push(reopenCurrent); openNext(); }
function panelBack(){ const fn=panelStack.pop(); if(fn){clearTimers();fn();} else closePanel(); }
/* ── unified in-app dialog (replaces native confirm/prompt/alert) ──
   appConfirm(msg,opts) → Promise<true|false|null(dismiss)>
   appPrompt(msg,def)   → Promise<string|null> */
function appDialog(o){
  return new Promise(res=>{
    const old=document.getElementById('appdlg'); if(old) old.remove();
    const wrap=document.createElement('div'); wrap.id='appdlg';
    wrap.innerHTML=`<div class="appdlg-scrim"></div>
      <div class="appdlg-card" role="dialog" aria-modal="true">
        <div class="appdlg-msg">${o.msg}</div>
        ${o.input!==undefined?`<input class="appdlg-in" value="${(o.input||'').replace(/"/g,'&quot;')}" placeholder="${o.placeholder||''}">`:''}
        <div class="appdlg-btns">
          ${o.cancelLabel!==null?`<button class="appdlg-btn ghost" data-adk="cancel">${o.cancelLabel||(typeof L==='function'?L('ביטול','Cancel'):'Cancel')}</button>`:''}
          <button class="appdlg-btn ${o.danger?'danger':''}" data-adk="ok">${o.okLabel||(typeof L==='function'?L('אישור','OK'):'OK')}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const inp=wrap.querySelector('.appdlg-in');
    const done=v=>{ wrap.remove(); res(v); };
    wrap.querySelector('.appdlg-scrim').addEventListener('click',()=>done(null));
    wrap.querySelectorAll('[data-adk]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.dataset.adk==='cancel') return done(false);
      done(inp?inp.value.trim():true);
    }));
    if(inp){ inp.focus(); inp.addEventListener('keydown',e=>{ if(e.key==='Enter') done(inp.value.trim()); }); }
    else { const ob=wrap.querySelector('[data-adk="ok"]'); if(ob) ob.focus(); }
  });
}
function appConfirm(msg,opts){ return appDialog(Object.assign({msg},opts||{})); }
function appPrompt(msg,def,opts){ return appDialog(Object.assign({msg,input:def||''},opts||{})); }
function closePanel(){
  try{speechSynthesis.cancel();}catch(e){}
  if(typeof gemStop==='function') gemStop();
  if(typeof vcRec!=='undefined'&&vcRec){try{vcRec.stop();}catch(e){} vcRec=null;}clearTimers();if(typeof serveIv!=='undefined'&&serveIv){clearInterval(serveIv);serveIv=null;}panelStack=[];$("#panel").classList.remove("open");$("#panel").setAttribute("aria-hidden","true");
  $("#scrim").classList.remove("open");document.body.classList.remove("noscroll");
  if(lastFocus&&lastFocus.focus){try{lastFocus.focus();}catch(e){}} lastFocus=null;
  try{ if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){}
  // if home is the screen behind the panel, re-sync it — catches state changed inside a tool (e.g. gear edited → lanes/kick re-gate), on any close path
  try{ const h=document.getElementById('scr-home'); if(h&&h.classList.contains('on')&&typeof cRefreshHome==='function') cRefreshHome(); }catch(e){} }

/* ---------- shopping list ---------- */
// Wave E: the event cart's "bought" ticks + menu quantities are per-event — a global namespace meant
// marking brisket bought for one event hid it from another that also needed it (→ under-buying).
function mshopKey(text){ return 'shop:'+((typeof evScope==='function')?evScope():'cook')+':'+text; }
function mkMenuqtyKey(){ return 'mk-menuqty-'+((typeof evScope==='function')?evScope():'cook'); }
function shopData(){
  const meat=[], season=new Set(), wood=new Set(), coal=new Set(), equip=new Set(), items=[], seasSel=[];
  const seenSeas=new Set();
  const nm=(o,key)=>{ try{ const meta=(typeof resolveItem==='function'&&key)?resolveItem(key):null; if(meta && typeof itemName==='function') return itemName(meta); }catch(e){} return (getLang&&getLang()!=='he'&&o&&o.eng)?o.eng:(o&&o.heb)||''; };
  const collectSeas=(k,dispName)=>{
    selectedSeasonings(k).forEach(id=>{
      const s=seasoningById(id); if(!s) return;
      const ex=seasSel.find(x=>x.id===id);
      if(ex){ ex.for.push(dispName); return; }
      seasSel.push({id, heb:s.heb, eng:s.eng, kind:s.kind, ing:s.ing, sub:s.sub, for:[dispName]});
    });
  };
  const kg=L('ק״ג','kg');
  const mq=store.get(mkMenuqtyKey())||{};
  const qkg=k=>mq[k]?` — ~${(mq[k]/1000).toFixed(1)} ${kg} <b style="color:var(--ember2)">(${L('מהתפריט','from menu')})</b>`:null;
  const ilFor=(heb,eng)=>{ const il=(typeof ILCUT!=='undefined')?ILCUT.find(r=>heb.includes(r[0].split(' ')[0])||(eng||'').toLowerCase().includes((r[1]||'').toLowerCase())):null; return il?` — 🥩 ${L('לקצב','for butcher')}: ${t(il[2])}`:''; };
  // shopping list is derived from the ACTIVE event/menu (not a separate cart) — always in sync
  const srcKeys=[...new Set((typeof menuState==='function')?(menuState().keys||[]):[])];
  srcKeys.forEach(k=>{
    if(k.startsWith("cut-")){
      const c=DATA.cuts.find(x=>"cut-"+x.n===k); if(!c)return;
      items.push({cat:c.cat,name:(getLang&&getLang()!=='he'?c.eng:c.heb+" · "+c.eng),key:k});
      collectSeas(k,nm(c,k));
      // per-guest RAW quantity via the shared rawGramsFor — never the whole-cut catalog weight (c.kg),
      // and computed live so it can't go stale against the menu screen or the print menu.
      { const _m=resolveItem(k); const _raw=_m?rawGramsFor(_m):0;
        meat.push(`${nm(c,k)} — ~${(_raw/1000).toFixed(1)} ${kg}${ilFor(c.heb,c.eng)}`); }
      if(k==='cut-18'){ const dn=burgerDiners(); const tps=[...new Set(dn.flatMap(d=>d.tops||[]))]; const chs=[...new Set(dn.filter(d=>d.cheesePos!=='none').map(d=>d.cheese))]; const scs=[...new Set(dn.map(d=>d.sauce).filter(Boolean))]; const bns=[...new Set(dn.map(d=>d.bun).filter(Boolean))];
        meat.push(`🍔 ${L('לבורגרים','for the burgers')} (${dn.length} ${L('סועדים','guests')}): ${L('לחמניות','buns')} ${bns.map(x=>t(x)).join('/')||'—'} ×${dn.length}${chs.length?` · ${L('גבינות','cheeses')}: ${chs.map(x=>t(x)).join(', ')}`:''}${tps.length?` · ${L('תוספות','toppings')}: ${tps.map(x=>t(x)).join(', ')}`:''}${scs.length?` · ${L('רטבים','sauces')}: ${scs.map(x=>t(x)).join(', ')}`:''}`); }
      // house rub flows through collectSeas as the default selection — no separate season.add (avoids double-listing)
      String(c.wood).split("/").forEach(w=>wood.add(w.trim()));
      if(c.coal) coal.add(c.coal);
    } else if(k.startsWith("spec-")){
      const s=DATA.specials.find(x=>"spec-"+x.n===k); if(!s)return;
      items.push({cat:s.cat,name:(getLang&&getLang()!=='he'?s.eng:s.heb+" · "+s.eng),key:k});
      collectSeas(k,nm(s,k));
      { const _m=resolveItem(k); const _raw=_m?rawGramsFor(_m):0;
        meat.push(`${nm(s,k)} — ~${(_raw/1000).toFixed(1)} ${kg}`); }
      if(s.wood&&s.wood!=="ללא") String(s.wood).split("/").forEach(w=>wood.add(w.trim()));
      const b=DATA.builds["spec-"+s.n]; if(b&&b.materials) b.materials.forEach(m=>equip.add(m));
    } else if(k.startsWith("make-")){
      const id=k.slice(5), m=DATA.makes[id]; if(!m)return;
      items.push({cat:m.cat,name:(getLang&&getLang()!=='he'?m.eng:m.heb+" · "+m.eng),key:k});
      collectSeas(k,nm(m,k));
      { const _m=resolveItem(k); const _raw=_m?rawGramsFor(_m):0;
        meat.push(`${nm(m,k)} (${t(m.cat)}) — ~${(_raw/1000).toFixed(1)} ${kg}`); }
      if(m.build&&m.build.materials) m.build.materials.forEach(x=>equip.add(x));
    }
  });
  // extras: sides, drinks, desserts, seasonal fruit — EVENT context only (not relevant for quick-cook)
  const extras=[];
  if(typeof menuCtx!=='function' || menuCtx()==='event'){
    const ms=(typeof menuState==='function')?menuState():{};
    const g=ms.guests||8;
    (ms.sides||[]).forEach(x=>extras.push(`${t(x)} — ${eventQty(x,'side',g)}`));
    (ms.drinks||[]).forEach(x=>extras.push(`${t(x)} — ${eventQty(x,'drink',g)}`));
    (ms.desserts||[]).forEach(x=>{ if(x==='__fruit') extras.push(`${L('מגש פירות העונה','Seasonal fruit platter')} (${t(eventSeason())}: ${seasonalFruitList().map(f=>t(f)).join(', ')}) — ${eventQty('','fruit',g)}`); else extras.push(`${t(x)} — ${eventQty(x,'dessert',g)}`); });
  }
  return {items, meat, season:[...season], wood:[...wood], coal:[...coal], equip:[...equip], seasSel, extras};
}
function cartInventoryHTML(){
  if(typeof invList!=='function') return '';
  const inv=invList()||[]; const low=inv.filter(i=>i.qty<=i.low);
  if(!low.length) return '';
  return `<div class="shop-group"><h4>📦 ${L('מהמזווה — חסר / להשלים','From pantry — missing / to restock')}</h4>${low.map(i=>{
    const key=i.name+(i.low>0?` (${L('יעד','target')} ≥${i.low} ${t(i.unit)})`:'');
    const disp=t(i.name)+(i.low>0?` (${L('יעד','target')} ≥${i.low} ${t(i.unit)})`:'');
    const done=store.get(mshopKey(key))?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(key)}">${done?"✓":""}</span><span>${disp} · <b style="color:var(--terra-d)">${L('יש','have')} ${i.qty}</b></span></div>`;
  }).join('')}</div>`;
}
function shopLine(text){
  const done=store.get(mshopKey(text))?"done":"";
  return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(text)}">${done?"✓":""}</span><span>${text}</span></div>`;
}
function openCart(){
  const d=shopData();
  const grp=(t,a)=> a.length? `<div class="shop-group"><h4>${t}</h4>${a.map(shopLine).join("")}</div>`:"";
  const itemsHTML=d.items.length
    ? `<div class="shop-items">`+d.items.map(it=>`<div class="shop-item"><div><div class="si-cat">${t(it.cat)}</div><h5>${t(it.name)}</h5></div><button class="rm" data-rm="${it.key}" aria-label="${L('הסר','Remove')}">×</button></div>`).join("")+`</div>`
    : `<div class="shop-empty">${L('הרשימה ריקה.','The list is empty.')}<br>${L('הוסף מנות לאירוע (באשף או בכפתור ＋ שעל הכרטיסים) והן יופיעו כאן אוטומטית.','Add dishes to the event (in the wizard or with the ＋ button on the cards) and they will appear here automatically.')}</div>`;
  const html=`
   <div class="panel-top">
     <button class="x" aria-label="${L('סגור','Close')}">✕</button>
     <div class="cat">${(typeof menuCtx==='function'&&menuCtx()==='cook')?L('🔥 בישול מהיר','🔥 Quick cook'):'🎉 '+((menuState().evName||L('תכנון אירוע','Event planning')))}</div>
     <h2>${L('רשימת קניות','Shopping list')}</h2>
     <div class="en">${d.items.length} ${L('פריטים נבחרו','items selected')}</div>
   </div>
   <div class="panel-body">
     ${itemsHTML}
     ${d.items.length?`
       ${grp(L("בשר ודגים","Meat & fish"), d.meat)}
       ${grp(L("תיבול · ראב · מרינדה","Seasoning · rub · marinade"), d.season)}
       ${d.seasSel&&d.seasSel.length?`<div class="shop-group"><h4>🧂 ${L('למתבלים ורטבים שנבחרו','For the chosen seasonings & sauces')}</h4>${d.seasSel.map(s=>`
         <div class="shop-seas"><div class="ss-head">${KIND_EMOJI[s.kind]} <b>${itemName(s)}</b> <small>· ${L('ל','for ')}${s.for.join(', ')}</small></div>
         ${shopLine(`${L('מרכיבים','Ingredients')}: ${t(s.ing)}`)}${s.sub?`<div class="ss-sub">⚠ ${L('תחליף בישראל','Substitute in Israel')}: ${t(s.sub)}</div>`:''}</div>`).join('')}</div>`:''}
       ${grp(L("🥗 תוספות · שתייה · קינוחים","🥗 Sides · drinks · desserts"), d.extras)}
       ${grp(L("עץ לעישון","Smoking wood"), d.wood)}
       ${grp(L("פחם","Charcoal"), d.coal)}
       ${(()=>{ if(!d.equip.length) return '';
         const inv=(typeof invList==='function'&&invList())||[];
         const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(String(name).split(/[0-9(]/)[0].trim())|| String(name).includes(i.name.split(' ')[0])));
         const need=d.equip.filter(m=>!invHas(m)), have=d.equip.filter(m=>invHas(m));
         let html=`<div class="shop-group"><h4>${L('ציוד וחומרי ריפוי','Equipment & curing supplies')}</h4>`;
         html+=need.map(shopLine).join('');
         html+=have.map(m=>`<div class="shop-line have"><span class="cbx-have">✓</span><span>${t(m)} · <b style="color:var(--good)">${L('יש במזווה','in pantry')}</b></span></div>`).join('');
         return html+`</div>`;
       })()}
       ${cartInventoryHTML()}
       <div style="margin-top:20px;display:flex;gap:8px;flex-wrap:wrap">
         <button class="prbtn" style="position:static" data-print>⎙ ${L('הדפס / PDF','Print / PDF')}</button>
         <button class="prbtn" style="position:static" data-clear>${L('נקה הכל','Clear all')}</button>
       </div>`:""}
   </div>`;
  showPanel(html);
  $("#panel").querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{const s=menuState();s.keys=(s.keys||[]).filter(k=>k!==b.dataset.rm);saveMenu(s);updateCartBadge();render();openCart();}));
  $("#panel").querySelectorAll("[data-shopck]").forEach(sp=>sp.addEventListener("click",()=>{
    const t=decodeURIComponent(sp.dataset.shopck), row=sp.closest(".shop-line"), done=!row.classList.contains("done");
    row.classList.toggle("done",done); sp.classList.toggle("done",done); sp.textContent=done?"✓":""; store.set(mshopKey(t),done);
  }));
  const clr=$("#panel").querySelector("[data-clear]");
  if(clr) clr.addEventListener("click",()=>{const s=menuState();s.keys=[];saveMenu(s);updateCartBadge();render();openCart();});
}

/* ---------- glossary ---------- */
let glossFilter={q:'',grp:''};
function buildGloss(){
  const host=$("#gloss"); if(!host) return;
  const groups=[...new Set(DATA.glossary.map(g=>g.group))];
  // inject search + group chips once, above the grid
  let bar=$("#glossBar");
  if(!bar){ bar=document.createElement('div'); bar.id='glossBar'; host.parentNode.insertBefore(bar,host); }
  bar.innerHTML=`<div class="chome-search" style="margin:0 0 10px"><span class="ic">⌕</span><input id="glossSearch" placeholder="${L('חפש מונח — עברית או אנגלית…','Search a term — Hebrew or English…')}" value="${glossFilter.q}"></div>
    <div class="chips" style="margin-bottom:12px"><span class="chip ${!glossFilter.grp?'on':''}" data-glossgrp="">${L('הכל','All')}</span>${groups.map(g=>`<span class="chip ${glossFilter.grp===g?'on':''}" data-glossgrp="${g}">${t(g)}</span>`).join('')}</div>`;
  const s=$("#glossSearch"); if(s){ s.addEventListener('input',()=>{ glossFilter.q=s.value.trim().toLowerCase(); paintGloss(); }); }
  bar.querySelectorAll('[data-glossgrp]').forEach(c=>c.addEventListener('click',()=>{ glossFilter.grp=c.dataset.glossgrp; buildGloss(); }));
  paintGloss();
}
function paintGloss(){
  let items=DATA.glossary;
  if(glossFilter.grp) items=items.filter(g=>g.group===glossFilter.grp);
  if(glossFilter.q) items=items.filter(g=>(g.he+' '+g.en+' '+g.desc).toLowerCase().includes(glossFilter.q));
  $("#gloss").innerHTML=items.length?items.map(g=>`<div class="gitem">
     <div class="gg">${t(g.group)}</div>
     <div class="gh">${getLang()==='he'?g.he:g.en}${getLang()==='he'?`<span class="ge">${g.en}</span>`:''}</div>
     <p data-mt>${g.desc}</p></div>`).join(""):`<div class="shop-empty">${L('לא נמצא מונח תואם.','No matching term found.')}</div>`;
}

/* ---------- wire ---------- */
document.addEventListener("click",e=>{
  const fav=e.target.closest("[data-fav]");
  if(fav){ e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
  const addm=e.target.closest("[data-addmenu]");
  if(addm){ e.stopPropagation(); e.preventDefault(); if(typeof toggleCart==='function') toggleCart(addm.dataset.addmenu); syncAddMenuBtn(addm); if(typeof toast==='function') toast(menuHasKey(addm.dataset.addmenu)?'✓ נוסף לתפריט':'הוסר מהתפריט'); return; }
  const card=e.target.closest(".card");if(!card)return;
  if(card.dataset.kind==="make"){ openMake(card.dataset.mid); return; }
  const n=+card.dataset.n;
  if(card.dataset.kind==="cut") openCut(DATA.cuts.find(c=>c.n===n));
  else openSpec(DATA.specials.find(s=>s.n===n));
});
$("#scrim").addEventListener("click",closePanel);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();});
/* a11y: keyboard operability for non-native interactive surfaces. Enter/Space on a focused
   card / home-path / wizard chip synthesizes a click, routing through the existing handlers. */
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter" && e.key!==" ") return;
  const t=e.target; if(!t||!t.closest) return;
  if(t.closest('button,a[href],input,select,textarea')) return;   // native controls handle their own keys
  const act=t.closest('.card,.cpath,.cnext,[data-cgo],[data-cwm],[data-app],.chip,.cmethod,[data-cwpick]');
  if(!act) return; e.preventDefault(); act.click();
});
// W1-P3: any "🧮 Open calculator" deep-link from an AI safety escalation → the salt/cure/quantity calculator (the number owner)
document.addEventListener('click',function(e){ const b=e.target&&e.target.closest&&e.target.closest('[data-aicalc]'); if(b){ if(typeof closePanel==='function') closePanel(); setTimeout(function(){ if(typeof openCalc==='function') openCalc(); },60); } });
/* a11y: make those surfaces focusable + announced; keep aria-pressed synced with the .on toggle class.
   (Cards carry tabindex/role in their own template — the high-count path — so they stay out of this observer.) */
(function(){
  const BTN='.cpath,.cnext,[data-cgo],[data-cwm],[data-app],.chip,.cmethod,[data-cwpick]';
  const PRESS='.chip,.cmethod,[data-app],.tab,.vc-langbtn';
  function enh(el){
    if(el.matches(BTN)){ if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0'); if(!el.hasAttribute('role')) el.setAttribute('role','button'); }
    if(el.matches(PRESS)) el.setAttribute('aria-pressed', el.classList.contains('on')?'true':'false');
  }
  function scan(n){ if(!n||n.nodeType!==1) return; if(n.matches) enh(n); if(n.querySelectorAll) n.querySelectorAll(BTN+','+PRESS).forEach(enh); }
  scan(document.body);
  new MutationObserver(ms=>ms.forEach(m=>{
    if(m.type==='childList') m.addedNodes.forEach(scan);
    else if(m.target&&m.target.matches&&m.target.matches(PRESS)) m.target.setAttribute('aria-pressed', m.target.classList.contains('on')?'true':'false');
  })).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
/* focus trap inside the open panel */
$("#panel").addEventListener("keydown",e=>{
  if(e.key!=="Tab") return;
  const p=$("#panel"); if(!p.classList.contains("open")) return;
  const list=[...p.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled && el.offsetParent!==null);
  if(!list.length) return;
  const first=list[0], last=list[list.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
/* toast with optional undo */
let toastTmo=null;
function toast(msg, undoFn, actionLabel){
  let t=$("#toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; t.setAttribute("role","status"); t.setAttribute("aria-live","polite"); document.body.appendChild(t); }
  const _d=(typeof getDict==='function')?getDict():null; const tr=(s)=>(_d&&_d[s]!=null)?_d[s]:s;   // i18n: dict-translate the notification, Hebrew passes through unchanged
  t.innerHTML=`<span>${tr(msg)}</span>`+(undoFn?`<button data-undo>${tr(actionLabel||'בטל')}</button>`:'');   // action label defaults to "בטל" (undo); pass e.g. "רענן עכשיו" for non-undo actions
  t.classList.add("show");
  clearTimeout(toastTmo); toastTmo=setTimeout(()=>t.classList.remove("show"),5000);
  if(undoFn){ t.querySelector("[data-undo]").addEventListener("click",()=>{ clearTimeout(toastTmo); t.classList.remove("show"); undoFn(); }); }
}
$("#q").addEventListener("input",debounce(()=>catView(),120));

/* quick-nav jump */
/* =====================================================================
   PRODUCT FEATURES (13): favorites, timeline, kosher, filters, notes,
   pantry, reminders, help, ask, cut-translator, woods, menu, journal
   ===================================================================== */
function uid(){return Math.random().toString(36).slice(2,9);}
function today(){return new Date().toISOString().slice(0,10);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+(+n||0));return x.toISOString().slice(0,10);}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/864e5);}
function fmtDate(d){try{return new Date(d).toLocaleDateString('he-IL');}catch(e){return d;}}

function resolveItem(key){
  if(!key) return null;
  if(key.startsWith('cut-')){const c=DATA.cuts.find(x=>'cut-'+x.n===key);return c&&metaCut(c);}
  if(key.startsWith('spec-')){const s=DATA.specials.find(x=>'spec-'+x.n===key);return s&&metaSpec(s);}
  if(key.startsWith('make-')){const m=DATA.makes[key.slice(5)];return m&&metaMake(key.slice(5),m);}
  if(key.startsWith('umake-')){const m=(typeof umakes==='function'?umakes():{})[key];return m&&{kind:'make',key,heb:m.heb,eng:m.eng||'',cat:m.cat,obj:m,diff:m.diff||2,build:m.build,ai:true};}
  return null;
}

/* ---- favorites ---- */
let favs=new Set(store.get('mk-fav')||[]);
function isFav(k){return favs.has(k);}
function toggleFav(k){favs.has(k)?favs.delete(k):favs.add(k);store.set('mk-fav',[...favs]);updateFavBadge();render();}
function updateFavBadge(){const e=$("#favN");if(e)e.textContent=favs.size;}
function favStar(key){return `<button class="favstar ${isFav(key)?'on':''}" data-fav="${key}" aria-pressed="${isFav(key)}" aria-label="${isFav(key)?'הסר ממועדפים':'הוסף למועדפים'}">${isFav(key)?'★':'☆'}</button>`;}
// perf #4: read all ratings once into a Map instead of a synchronous localStorage.get per card, per render
let _ratings=null;
function ratingsMap(){ if(_ratings) return _ratings; _ratings=new Map(); try{ const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('rating:')===0) ks.push(k); } ks.forEach(function(k){ const v=store.get(k)||0; if(v) _ratings.set(k.slice(7),v); }); }catch(e){} return _ratings; }
function ratingMini(key){const r=ratingsMap().get(key)||0;return r?`<span class="rmini" aria-label="דירוג ${r}">${'★'.repeat(r)}</span>`:'';}

/* ---- kosher ---- */
/* ── kashrut classification (species/recipe-based; not a hechsher) ──
   Statuses: 'pork' · 'shellfish' (non-finned/scaled sea creatures + scaleless fish) ·
             'treif' (blood) · 'dairy' (כשר חלבי) · 'kosher' (kosher species/parve).
   pork/shellfish/treif are filtered out by the kosher filter; dairy is kept and tagged. */
const K_FISH_OK=/(סלמון|salmon|לקס|lox|גרבלקס|gravlax|פורל|trout|טונה|tuna|הליבוט|halibut|מקרל|mackerel|בקלה|\bcod\b|סרדין|sardine|לברק|דניס|בורי|אמנון|טילפיה|tilapia|בס ים|sea ?bass)/;
const K_FISH_NO=/(דג חרב|swordfish|שפמנון|catfish|כריש|\bshark\b|צלופח|\beel\b|sturgeon|חדקן|מרלין|marlin)/;
// pork MEAT/FAT/charcuterie (casing mentions are stripped before this runs — casing is swappable)
// pork MEAT/FAT/charcuterie. Hebrew relies on 'חזיר' (every pork item's meat says so);
// Latin names cover English text. Hebrew transliterations (קופה/פנצ'טה…) are omitted — they
// appear in generic technique notes (e.g. "roll like coppa/pancetta") and cause false positives.
const K_PORK=/(חזיר|לחם חזיר|\bpork\b|לארד|\blard\b|pancetta|guanciale|coppa|capicola|prosciut|serrano|\bspeck\b|lonzino|nduja|jam[oó]n|culatello)/;
const K_BLOOD=/(\bדם\b|נקניק דם|\bblood\b|morcilla|מורסי|blutwurst|בלוטו|\bsundae\b|סונדה|soondae|בלאד)/;
// key -> status override for the few cases the rules get wrong.
// cut-17 (Kebab): 'חזיר' appears only in a cross-reference note comparing it to mici; the dish is beef/lamb.
const KOSHER_OVERRIDE={'cut-17':'kosher'};
// strip pork-CASING mentions (casing is swappable) before scanning for pork MEAT — including
// pork listed as one casing option among kosher ones, e.g. "מעי כבש/חזיר".
function _koshBuildTxt(m){ try{ return JSON.stringify(m.build||'').replace(/(שרוול|שרוולי|מעי|קרום|עור|טבעת)[^,.;\n)"]{0,18}חזיר/g,''); }catch(e){ return ''; } }
// perf #4: memoize kosher classification — inputs are static per item (only static KOSHER_OVERRIDE),
// so the ~6 regex tests per card per render collapse to one compute per key.
const _kosherCache={};
function kosherStatus(key){ const c=_kosherCache[key]; if(c!==undefined) return c; return _kosherCache[key]=kosherStatusRaw(key); }
function kosherStatusRaw(key){
  if(KOSHER_OVERRIDE[key]) return KOSHER_OVERRIDE[key];
  const m=resolveItem(key); if(!m) return 'kosher';
  const s=(m.heb+' '+m.eng+' '+(m.cat||'')).toLowerCase();
  const bt=_koshBuildTxt(m).toLowerCase();          // recipe text, pork-casing stripped
  // dairy (כשר חלבי) — cheese items (incl. halloumi mis-filed under vegetables)
  if(m.cat==='גבינה' || /\bcheese\b|גבינ|halloumi|חלומי/.test(s)) return 'dairy';
  // bacon: pork by default, but "beef bacon" is a kosher species
  if(/bacon|בייקון/.test(s)) return /(בקר|beef|עגל|veal|טלה|lamb)/.test(s)?'kosher':'pork';
  // pork by category, name, or pork meat/fat in the recipe
  if(m.cat==='חזיר' || K_PORK.test(s) || K_PORK.test(bt)) return 'pork';
  // blood products
  if(K_BLOOD.test(s) || K_BLOOD.test(bt)) return 'treif';
  // sea creatures: פירות ים is non-kosher unless a finned+scaled fish
  if(m.cat==='פירות ים') return K_FISH_OK.test(s)?'kosher':'shellfish';
  if(K_FISH_NO.test(s)) return 'shellfish';
  return 'kosher';   // beef/lamb/veal, poultry, kosher fish, vegetables, fruit, parve
}
function kosherLabel(k){return k==='pork'?L('לא כשר (חזיר)','Non-kosher (pork)'):k==='shellfish'?L('לא כשר (פירות ים / דג ללא קשקשת)','Non-kosher (shellfish / finless fish)'):k==='treif'?L('לא כשר (דם)','Non-kosher (blood)'):k==='dairy'?L('כשר · חלבי','Kosher · dairy'):L('כשר','Kosher');}
function kosherTag(key){const k=kosherStatus(key);if(k==='pork'||k==='shellfish'||k==='treif')return '<span class="ktag kp">לא כשר</span>';if(k==='dairy')return '<span class="ktag kd">כשר חלבי</span>';return '';}
// kosher-filter OK = not pork, shellfish, or blood. Dairy is kosher (shown with a "כשר חלבי" tag).
function isKosherOk(key){const k=kosherStatus(key);return k!=='pork'&&k!=='shellfish'&&k!=='treif';}
/* v144: equipment-readiness tag — quiet unless gear is configured AND something's actually missing */
function gearTag(key){
  if(!gearConfigured()) return '';
  const meta=resolveItem(key); if(!meta || meta.kind!=='cut') return '';
  const combo=activeMethods(meta.obj, key);
  const missing=combo.filter(m2=>!gearCan(m2));
  if(!missing.length) return '';
  const names={sv:'סו-ויד',smoke:'מעשנת',grill:'גריל'};
  return `<span class="gtag" title="חסר ציוד: ${missing.map(m2=>names[m2]||m2).join(', ')}">🔧 בדוק ציוד</span>`;
}
function kosherSub(key){
  const m=resolveItem(key); if(!m||kosherStatus(key)!=='pork') return null;
  const s=(m.eng||'').toLowerCase();
  if(s.includes('bacon')) return L('בייקון בקר/הודו','Beef/turkey bacon');
  if(/pancetta|coppa|guanciale|lardo|lonzino|speck|prosciutto|culatella|culatello/.test(s)) return L('ברזאולה/פסטרמה-הודו (בקר/הודו) או טלה מיובש','Bresaola/turkey-pastrami (beef/turkey) or dry-cured lamb');
  if(/salami|saucisson|soppressata|nduja|cacciatore|pepperoni|mortadella|bologna/.test(s)) return L('גרסת בקר/הודו + שומן בקר; שרוול בקר/צלולוז','Beef/turkey version + beef fat; beef/cellulose casing');
  if(/sausage|bratwurst|weisswurst|toulouse|chipolata|frankfurter|kielbasa|lingu|loukaniko/.test(s)) return L('בקר/עוף/הודו + שומן בקר/כבש','Beef/chicken/turkey + beef/lamb fat');
  if(s.includes('porchetta')) return L('רולדת בקר/הודו עם שומר ושום','Beef/turkey roulade with fennel and garlic');
  return L('בקר, טלה או הודו; שומן בקר/כבש במקום שומן חזיר','Beef, lamb or turkey; beef/lamb fat instead of pork fat');
}

/* ---- timeline lead time ---- */
/* ---- cook-process model: stages per item, for the detailed timeline ---- */
// Category profiles for MAKES (no per-recipe structured temps in data, so grounded
// category-level estimates are used; multiDay=true means "from scratch" spans days/weeks
// and isn't meaningful in a same-day clock — those belong in the Pantry tool instead).
const MAKE_COOK={
 'נקניקיות':     {multiDay:false, buildMin:75, restMin:10,
   methods:[{key:'grill',label:'גריל ישיר',tempC:'180-200°',hours:0.35,note:'עד ~71° פנים'},
            {key:'smoke',label:'עישון קצר',tempC:'77°',hours:2.2,note:'עד ~68-71° פנים'}]},
 'נקניק מעושן':   {multiDay:false, buildMin:90, restMin:10,
   methods:[{key:'smoke',label:'עישון',tempC:'77°',hours:3.2,note:'עד ~68-72° פנים'}]},
 'צלייה טחונה':   {multiDay:false, buildMin:75, restMin:5,
   methods:[{key:'grill',label:'גריל ישיר',tempC:'200°+',hours:0.25,note:'מהיר, חם מאוד'}]},
 'שווארמה':       {multiDay:false, buildMin:45, restMin:10,
   methods:[{key:'oven',label:'תנור/רוטיסרי',tempC:'180°',hours:1.1,note:'עד ~74-82° פנים'}]},
 'BBQ קלאסי':     {multiDay:false, buildMin:20, restMin:20,
   methods:[{key:'smoke',label:'עישון',tempC:'110-120°',hours:5,note:'מנתח גולמי; אם כבר מעושן — קצר בהרבה'}]},
 'פסטרמה':        {multiDay:true, buildMin:0, restMin:30,
   methods:[{key:'sv_smoke',label:'סו-ויד + עישון',tempC:'66°/110°',hours:3.5,note:'גימור קרום ועישון'},
            {key:'smoke',label:'עישון בלבד',tempC:'110°',hours:4.5,note:'עד ~74° ואידוי לרכות'}]},
 'דג מעושן':      {multiDay:true, buildMin:0, restMin:15,
   methods:[{key:'hot',label:'עישון חם',tempC:'77°',hours:2.5,note:'עד ~63° פנים'},
            {key:'cold',label:'עישון קר',tempC:'≤25°',hours:5,note:'ללא בישול — לקס/גרבלקס'}]},
 'סלומי':         {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא ופרוס',tempC:'—',hours:0.15,note:'מוכן לאכילה, רק לפרוס'}]},
 'נקניק מיובש':   {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא ופרוס',tempC:'—',hours:0.15,note:'מוכן לאכילה, רק לפרוס'}]},
 'בשר מיובש':     {multiDay:true, buildMin:0, restMin:0,
   methods:[{key:'serve',label:'הוצא והגש',tempC:'—',hours:0.1,note:'ג׳רקי/ביltong מוכן'}]},
};
function comboMethodEntry(c, combo, isCard){
  const names={sv:L('סו-ויד','Sous-vide'),smoke:L('עישון','Smoking'),grill:L('גריל','Grill')};
  const label=(isCard?'⚡ ':'')+combo.map(m=>names[m]).join(' + ')+(isCard?L(' (מהכרטיסייה)',' (from the tab)'):'');
  let hours=0, svH=0, smH=0;
  if(combo.includes('sv')) { svH=upperHours(c.svh); hours+=svH; }
  if(combo.includes('smoke')) { smH=combo.includes('sv')?upperHours(c.smh):upperHours(c.soh||c.smh); hours+=smH; }
  if(combo.includes('grill')) hours+=0.3;
  const dtgt=(typeof donenessTarget==='function' && c.doneness)? donenessTarget(c) : c.tgt;
  const tgtLabel=c.doneness?`${L('יעד פנים','internal target')} ${dtgt}° (${doneLabel(c,currentDoneness(c))})`:`${L('יעד','target')} ${c.tgt}°`;
  return {key:'c:'+combo.slice().sort().join('_'),label,tempC:combo.includes('sv')?`${c.svt}°`:(combo.includes('smoke')?`${c.sot||c.smt}°`:L('אש','fire')),
    hours,note:tgtLabel,svHours:svH,smHours:smH,svTemp:c.svt,smTemp:combo.includes('sv')?c.smt:(c.sot||c.smt),combo};
}
function itemProfile(meta){
  if(!meta) return null;
  if(meta.kind==='cut'){
    const c=meta.obj;
    const cardCombo=activeMethods(c, meta.key||('cut-'+c.n));
    // enumerate all VALID combos from the engine — single source of truth, no duplicates
    const all=[['sv'],['smoke'],['grill'],['sv','smoke'],['sv','grill'],['smoke','grill'],['sv','smoke','grill']]
      .filter(cb=>validCombo(c,cb));
    const cardKey='c:'+cardCombo.slice().sort().join('_');
    const methods=[comboMethodEntry(c,cardCombo,true),
      ...all.filter(cb=>('c:'+cb.slice().sort().join('_'))!==cardKey).map(cb=>comboMethodEntry(c,cb,false))];
    return {multiDay:false, buildMin:15, restMin:c.rest||20, methods, wood:c.wood};
  }
  if(meta.kind==='spec'){
    const s=meta.obj;
    return {multiDay:false, buildMin:15, restMin:15,
      methods:[{key:'smoke',label:L('עישון','Smoke'),tempC:s.smt?`${s.smt}°`:'?',hours:upperHours(s.smh)||3,note:s.tgt&&s.tgt!=='—'?`${L('יעד','target')} ${t(s.tgt)}`:'',smHours:upperHours(s.smh)||3,smTemp:s.smt}],
      wood:s.wood};
  }
  // make
  const prof=MAKE_COOK[meta.cat];
  if(!prof) return {multiDay:false,buildMin:30,restMin:10,methods:[{key:'cook',label:L('בישול','Cook'),tempC:'?',hours:1,note:''}]};
  return prof;
}
function leadHours(meta){
  const p=itemProfile(meta); if(!p) return 1;
  const m=p.methods[0];
  return m.hours + p.restMin/60; // default "כבר מוכן" state — no build/prep time, matches itemStages(..,true)
}
/* build the ordered stage list for one item, working back from a method+ready state */
/* ── v144: sv/smoke order — two schools of thought, user-selectable per item ── */
const SV_SMOKE_ORDERS={
  'sv-smoke':{ name:'סו-ויד ← עישון', nameEn:'Sous-vide → smoke', desc:'בטוח כברירת־מחדל: מתבשל לדיוק ומפוסטר בסו-ויד, ואז מקבל טעם וקראסט בעישון-גימור חם.', descEn:'Safe by default: cooked to precision and pasteurized in the sous-vide, then gets flavor and crust in a hot finishing smoke.' },
  'smoke-sv':{ name:'עישון ← סו-ויד', nameEn:'Smoke → sous-vide', desc:'אסכולה מתקדמת: עישון קר על בשר גולמי לטבעת-עשן מרבית, ואז סו-ויד לדיוק ולפסטור מלא.', descEn:'Advanced school: cold smoke on raw meat for a maximal smoke ring, then sous-vide for precision and full pasteurization.' }
};
function svOrderName(k){ const o=SV_SMOKE_ORDERS[k]||{}; return getLang()==='he'?o.name:(o.nameEn||o.name); }
function svOrderDesc(k){ const o=SV_SMOKE_ORDERS[k]||{}; return getLang()==='he'?o.desc:(o.descEn||o.desc); }
function svSmokeOrderDefault(){ return 'sv-smoke'; }
// app-computed (not AI, not user-typed) conservative cold-smoke temperature ceiling for the smoke-before-sv order
function coldSmokeTemp(hotTemp){ const t=Math.round((hotTemp||110)*0.55); return Math.max(45, Math.min(70, t)); }
// v145 fix: fridge-dry duration scales with the item's own sv-cook length — a flat 4h was absurd for
// quick-cook items (shrimp/produce, svHours≈0) which only need a brief towel-pat, not hours in the fridge.
function drySurfaceHours(svHours){ return Math.min(4, Math.max(0.25, (svHours||0)*0.3)); }
// ── the scheduler's relaxation pass (Phase 4a) ────────────────────────────────────────────────
// Lay a stage chain backward from serve: start(i) = serve − Σ_{j≥i} hours_j. In scheduling terms this is
// the backward critical-path pass of an RCPSP with every resource constraint removed — the correct FIRST
// step of a real scheduler (it yields each stage's latest-feasible finish, hence its slack), which the app
// currently ships as the final answer. It contains no cross-item term, so it cannot avoid a device clash;
// a placer (Phase 4b) moves stages EARLIER than this, never later, or serve is missed.
//
// This was implemented twice — buildList (Date arithmetic, UNGUARDED s.hours) and combinedEventsRows (ms
// arithmetic, (s.hours||0)) — which diverged: a stage with no `hours` produced NaN in the first, poisoning
// every earlier stage in the chain, and 0 in the second. Unified here on the safe reading.
//
// Pure: it returns placements and never writes onto the generator's output, so two candidate schedules can
// coexist — the prerequisite for comparing alternatives at all.
function planSchedule(stages, serveMs){
  const list=stages||[], out=new Array(list.length);
  let end=Number(serveMs);
  for(let i=list.length-1;i>=0;i--){
    const s=list[i]||{};
    const hrs=Number(s.hours)||0;                 // never NaN: an unmeasured duration is 0, not a poisoned chain
    const start=end-hrs*3600e3;
    out[i]={ i:i, tid:s.tid||null, kind:s.kind||null, hours:hrs,
             startMs:start, endMs:end,
             latestFinishMs:end,                  // the relaxation IS the latest feasible finish...
             slackMs:0 };                         // ...so nothing has slack until a placer moves it earlier
    end=start;
  }
  return {stages:out, startMs:end};
}
// ── the placement pass (Phase 4b) ─────────────────────────────────────────────────────────────
// The relaxation ends EVERY item at serve, so a shared cooker is over-subscribed by construction. This
// pass moves stages EARLIER — never later, which would miss serve — until no instant exceeds the device's
// honest capacity. It is the first code in the app where one item's time depends on another's.
//
// Safety boundary (docs/.../scheduler-phase4-spec.md §6): a placement carries ONLY a new start/end pair of
// the SAME length. There is no representation here for a different duration, a different temperature, or a
// different stage order — the forbidden moves are structurally unreachable, not filtered after the fact.
// How far earlier a cook may be pulled before the app stops rescheduling and starts advising. An item moved
// earlier finishes early and must WAIT; until the hold/refrigerate spine exists (Phase 3) the model cannot
// state where it waits, so a long silent wait would be a fabrication. Two hours is roughly how long a large
// cut rests/holds wrapped without a plan for it; past that the honest output is an advisory.
const SCHED_PULL_MAX_MS = 2*3600e3;
function _peakDemand(placed, t){
  let sum=0;
  for(let i=0;i<placed.length;i++){ const p=placed[i]; if(t>=p.startMs && t<p.endMs) sum+=(p.demandCm2||0); }
  return sum;
}
// Would [from,to) fit alongside what is already on this device? Demands are constant across an interval, so
// it suffices to test the window's own start plus every placed interval's start that falls inside it.
function _windowFits(placed, from, to, demand, capacity){
  const pts=[from];
  for(let i=0;i<placed.length;i++){ const st=placed[i].startMs; if(st>from && st<to) pts.push(st); }
  for(let i=0;i<pts.length;i++){ if(_peakDemand(placed, pts[i])+demand > capacity) return false; }
  return true;
}
function schedulePlacements(computed, scope){
  const placements={}, conflicts=[], byDev={};
  (computed||[]).forEach(function(c){
    if(!c || c.blocked || !c.stages || !c.m) return;
    c.stages.forEach(function(s,si){
      if(['smoke','cook','sv'].indexOf(s.kind)<0 || !s.start || !s.end) return;
      const d=c.devId?{id:c.devId}:cookerFor(c.m.key, s.kind, scope);
      const tid=s.tid||(c.m.key+'|'+s.kind+'|'+si);
      const endMs=s.end.getTime();
      const rec={tid:tid, key:c.m.key, kind:s.kind, devId:d?d.id:null,
                 startMs:s.start.getTime(), endMs:endMs,
                 latestFinishMs:endMs, slackMs:0, temp:(s.temp!=null?s.temp:null),
                 demandCm2:0, hooks:0, litres:0, mode:'none'};
      if(!d){ placements[tid]=rec; return; }                       // no device resolved → nothing to contend for
      const dev=equipList().find(function(x){return x&&x.id===d.id;})||null;
      const occ=itemOccupancy(c.m, s.kind, dev);
      rec.mode=occ.mode; rec.hooks=occ.hooks||0; rec.litres=occ.litres||0;
      rec.demandCm2=(occ.mode==='area')?occ.cm2:0;                 // may be null = unmeasured (H1)
      (byDev[d.id]=byDev[d.id]||[]).push(rec);
    });
  });
  Object.keys(byDev).forEach(function(devId){
    const dev=equipList().find(function(x){return x&&x.id===devId;})||null;
    const cap=deviceCapacity(dev);
    const slotCount=Math.max(1, cap.racks||1);
    const perSlot=(cap.mode==='area' && cap.known && cap.usableCm2>0) ? Math.round(cap.usableCm2/slotCount) : null;
    // least slack -> largest demand -> stable key. Slack is 0 for everything on the first pass, so in
    // practice the biggest, hardest-to-place item claims its latest window first.
    const list=byDev[devId].slice().sort(function(a,b){
      return (a.slackMs-b.slackMs) || ((b.demandCm2||0)-(a.demandCm2||0)) || (a.tid<b.tid?-1:a.tid>b.tid?1:0);
    });
    const placed=[];
    list.forEach(function(r){
      const L=r.endMs-r.startMs;
      // An unmeasured item cannot be reasoned about: it must not block others, and must not be used to
      // claim a fit either. Leave it where the relaxation put it; the occupancy view already says "unknown".
      if(r.mode!=='area' || r.demandCm2==null || perSlot==null){
        if(r.mode==='hang' && cap.hooks>0){
          // hooks are a count, not an area — the same sweep with capacity = hooks
          const okHang=_windowFits(placed.filter(function(p){return p.mode==='hang';}), r.startMs, r.endMs, 1, cap.hooks);
          if(!okHang) conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'hooks'});
        }
        if(r.mode==='volume'){
          // a bath is shared, not summed (H2) — but two items may only share it at the SAME temperature
          const clash=placed.some(function(p){ return p.mode==='volume' && p.temp!==r.temp && r.startMs<p.endMs && p.startMs<r.endMs; });
          if(clash) conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'bath-temp'});
          if(cap.litres>0 && r.litres>cap.litres) conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'bath-too-small'});
        }
        placements[r.tid]=r; placed.push(r); return;
      }
      // fits no single shelf at ANY time — staggering cannot rescue it, so say so rather than overlap it
      if(r.demandCm2>perSlot){
        conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'no-single-slot', cm2:r.demandCm2, perSlotCm2:perSlot});
        placements[r.tid]=r; placed.push(r); return;
      }
      // latest-first: try the relaxed window, then each earlier boundary where something already placed begins
      const cands=[r.latestFinishMs];
      placed.forEach(function(p){ if(p.startMs<r.latestFinishMs) cands.push(p.startMs); });
      cands.sort(function(a,b){return b-a;});
      let chosen=null;
      for(let i=0;i<cands.length;i++){
        const end=cands[i], start=end-L;
        if(_windowFits(placed, start, end, r.demandCm2, cap.usableCm2)){ chosen=end; break; }
      }
      if(chosen==null){
        conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'no-window'});
        placements[r.tid]=r; placed.push(r); return;
      }
      // Phase 4c — the pull is BOUNDED. Moving a cook earlier is safe for time and temperature, but the
      // item then finishes early and has to wait, and this app cannot yet say WHERE it waits (the hold /
      // refrigerate spine is Phase 3). An unbounded pull is arithmetically valid and practically absurd —
      // it will happily tell you to finish the ribs 12 hours before dinner. Past the bound we refuse to
      // reschedule silently and raise an advisory instead: the honest answer is "these cannot share this
      // cooker", not a plan that serves cold food.
      const pull=r.latestFinishMs-chosen;
      if(pull>SCHED_PULL_MAX_MS){
        conflicts.push({devId:devId, key:r.key, tid:r.tid, reason:'pull-too-far', neededMs:pull, maxMs:SCHED_PULL_MAX_MS});
        placements[r.tid]=r; placed.push(r); return;                          // left where the relaxation put it, and flagged
      }
      r.endMs=chosen; r.startMs=chosen-L; r.slackMs=pull;                     // duration L is carried through untouched
      placements[r.tid]=r; placed.push(r);
    });
  });
  return {placements:placements, conflicts:conflicts};
}
// Phase 4c — the advisory. When the placer cannot make a load fit, the app says so in the user's own terms
// and names what to change. It never invents a fix it cannot justify: shortening a cook, raising a
// temperature or dropping a check are not representable moves, so the honest last rung of the ladder is
// advice. Each reason maps to the one remedy that is actually safe.
function _schedAdviceHtml(conflicts, computed){
  const list=(conflicts||[]); if(!list.length) return '';
  const nameOf=function(key){
    const c=(computed||[]).find(function(x){return x&&x.m&&x.m.key===key;});
    return c?(typeof itemName==='function'?itemName(c.m):c.m.heb):key;
  };
  const devOf=function(devId){ const d=equipList().find(function(x){return x&&x.id===devId;}); return d?(typeof deviceDisplayName==='function'?deviceDisplayName(d):(d.name||'')):''; };
  const seen={}, lines=[];
  list.forEach(function(cf){
    const sig=cf.reason+'|'+cf.key; if(seen[sig]) return; seen[sig]=1;
    const who=esc(nameOf(cf.key)), dev=esc(devOf(cf.devId));
    if(cf.reason==='pull-too-far'){
      const h=Math.round((cf.neededMs/3600e3)*10)/10;
      lines.push(`<b>${who}</b> ${L('לא נכנס יחד עם השאר ל'+dev+' — כדי לפנות מקום היה צריך להקדים אותו ב-'+h+' שע׳, וזה יסתיים הרבה לפני ההגשה. עדיף לבשל בסבבים, או לפנות מקום במכשיר.','does not fit alongside the rest on '+dev+' — freeing room would mean starting it '+h+'h earlier, finishing long before serving. Better to cook in batches, or free up capacity.')}`);
    } else if(cf.reason==='no-single-slot'){
      lines.push(`<b>${who}</b> ${L('גדול מכל מדף בודד ב'+dev+' ('+cf.cm2+' מול '+cf.perSlotCm2+' סמ״ר) — חתוך לשניים או השתמש במכשיר גדול יותר.','is larger than any single shelf on '+dev+' ('+cf.cm2+' vs '+cf.perSlotCm2+' cm²) — split it or use a bigger cooker.')}`);
    } else if(cf.reason==='no-window'){
      lines.push(`<b>${who}</b> ${L('לא נמצא חלון פנוי ב'+dev+' — בשל בסבבים או הוסף מכשיר.','has no free window on '+dev+' — cook in batches or add a cooker.')}`);
    } else if(cf.reason==='bath-temp'){
      lines.push(`<b>${who}</b> ${L('דורש טמפרטורת אמבט שונה משאר הפריטים באותו זמן — סו-ויד לא מתפשר על טמפרטורה. הפרד לסבבים.','needs a different bath temperature from the other items at that time — sous-vide does not compromise on temperature. Split into batches.')}`);
    } else if(cf.reason==='bath-too-small'){
      lines.push(`<b>${who}</b> ${L('דורש אמבט גדול מזה שברשותך.','needs a bigger bath than you own.')}`);
    } else if(cf.reason==='hooks'){
      lines.push(`<b>${who}</b> ${L('אין מספיק ווים פנויים ב'+dev+' באותו זמן.','has no free hook on '+dev+' at that time.')}`);
    }
  });
  if(!lines.length) return '';
  return `<div class="sched-advice"><b>⚠ ${L('התזמון לא נפתר לבד','The schedule could not resolve itself')}</b><ul>${lines.map(function(x){return '<li>'+x+'</li>';}).join('')}</ul></div>`;
}
function itemStages(meta,methodKey,ready,order){
  const p=itemProfile(meta); if(!p) return [];
  const m=p.methods.find(x=>x.key===methodKey)||p.methods[0];
  const stages=[];
  if(!ready && !p.multiDay && p.buildMin>0) stages.push({label:L('הכנה/בנייה','Prep/build'),hours:p.buildMin/60,kind:'prep'});
  if(m.combo){ // engine combo entry (cuts)
    const hasSV=m.combo.includes('sv'), hasSmoke=m.combo.includes('smoke');
    if(hasSV && hasSmoke && order==='smoke-sv'){
      // v147 (P3): use the CITED reverse-order data (order_smokesv) when present — never a formula for
      // safety-relevant temps/times. Fall back to the conservative computed values only if data is missing.
      const os=(meta.obj&&meta.obj.order_smokesv)||{}, osm=os.smoke||{}, osv=os.sv||{};
      const coldT=(osm.t!=null)?osm.t:coldSmokeTemp(m.smTemp);
      const coldHrs=(osm.h!=null)?upperHours(osm.h):Math.max(2, Math.round((m.smHours||2)*0.6));
      const svT=(osv.t!=null)?osv.t:m.svTemp;
      const svH=(osv.h!=null)?upperHours(osv.h):m.svHours;
      const cited=(osm.t!=null && osv.t!=null);
      stages.push({label:`${L('עישון קר','Cold smoke')} ${coldT}°`,hours:coldHrs,kind:'smoke',temp:coldT,note:L('על בשר גולמי — טבעת עשן מרבית','on raw meat — maximal smoke ring')+(cited?' · '+L('מקור מצוטט','cited source'):'')});
      stages.push({label:L('איטום ומעבר לסו-ויד','Seal and move to sous-vide'),hours:0,kind:'note'});
      stages.push({label:`${L('סו-ויד','Sous-vide')} ${svT}° (${L('כולל פסטור','incl. pasteurization')})`,hours:svH,kind:'sv',temp:svT,safety:'pasteur'});
    } else {
      if(hasSV){
        stages.push({label:`${L('סו-ויד','Sous-vide')} ${m.svTemp}°`,hours:m.svHours,kind:'sv',temp:m.svTemp});
        if(hasSmoke){
          const dryH=drySurfaceHours(m.svHours);
          const dryLbl=dryH<1?L('ניגוב יבש (קצר)','Pat dry (short)'):L('ייבוש במקרר (ללא כיסוי)','Fridge-dry (uncovered)');
          const dryNote=dryH<1?L('נגב היטב מנוזלים — לא נדרש זמן ממושך למנה קלה זו','Pat well of liquids — no long time needed for this light dish'):L('קריטי לקבלת קראסט','critical for a good crust');
          stages.push({label:dryLbl,hours:dryH,kind:'dry',note:dryNote});
        }
      }
      if(hasSmoke) stages.push({label:`${L('עישון','Smoke')} ${m.smTemp}°`,hours:m.smHours,kind:'smoke',temp:m.smTemp,note:m.note});
    }
    if(m.combo.includes('grill')) stages.push({label:m.combo.length===1?L('גריל / אש ישירה','Grill / direct heat'):L('גימור גריל (צריבה)','Grill finish (sear)'),hours:0.3,kind:'cook',note:m.combo.length===1?m.note:''});
  } else {
    if(m.svHours){ stages.push({label:`${L('סו-ויד','Sous-vide')} ${m.svTemp}°`,hours:m.svHours,kind:'sv',temp:m.svTemp}); stages.push({label:L('העברה למעשנת','Move to smoker'),hours:0,kind:'note'}); }
    if(m.smHours||m.hours){
      const hrs=m.smHours||m.hours;
      stages.push({label:`${m.label} ${m.tempC||''}`.trim(),hours:hrs,kind:m.key.includes('smoke')||m.key==='sv'||m.key==='so'||m.key==='hot'||m.key==='cold'?'smoke':'cook',temp:m.smTemp,note:m.note});
    } else if(!m.svHours){
      stages.push({label:m.label,hours:m.hours,kind:'cook',note:m.note});
    }
  }
  // D3: sous-vide pasteurization is timed from when the CORE reaches temp — the card said "+20%" but the
  // scheduler didn't; flag the come-up on every sv stage so thick items aren't scheduled under-held.
  stages.forEach(s=>{ if(s.kind==='sv' && !/הפסטור נמדד|pasteurization is timed/.test(s.note||'')){ const cu=L('הפסטור נמדד מרגע שהליבה מגיעה לטמפ׳ — לנתח עבה הוסף זמן עלייה','pasteurization is timed from when the core reaches temp — for a thick cut add come-up time'); s.note = s.note ? s.note+' · '+cu : cu; } });
  if(p.restMin>0) stages.push({label:L('מנוחה','Rest'),hours:p.restMin/60,kind:'rest'});
  // D1: mandatory internal-temp verification before serving — the operational-flow safety gate the
  // recipe card always had (svSteps/soSteps) but the scheduler/plan/voice flow was missing.
  { const sc = meta.obj ? (meta.obj.safe!=null?meta.obj.safe:meta.obj.tgt) : null;
    if(typeof sc==='number' && sc>0) stages.push({label:`${L('בדיקת טמפ׳ פנים — יעד','Internal temp check — target')} ${sc}°`, hours:0, kind:'bcheck', temp:sc, note:L('מד-חום בליבה לפני הגשה','thermometer in the core before serving')}); }
  return stages;
}
function comboHasSvSmoke(meta,methodKey){
  const p=itemProfile(meta); if(!p) return false;
  const m=p.methods.find(x=>x.key===methodKey)||p.methods[0];
  if(!(m.combo && m.combo.includes('sv') && m.combo.includes('smoke'))) return false;
  // v147 (P3): offer the reverse (smoke→sv) order ONLY when the item carries CITED, pasteurize-safe
  // reverse-order data (order_smokesv). No cited data → sv→smoke only; never a generic svHours>=1 guess.
  const os=meta.obj&&meta.obj.order_smokesv;
  return !!(os && os.smoke && os.sv && os.sv.pasteurize===true);
}

/* ---- per-recipe extras (notes/rating/kosher/actions) ---- */
const PROJ_CATS=['סלומי','נקניק מיובש','בשר מיובש','פסטרמה','דג מעושן'];
/* ── rich item description + origin/continent helpers (for pickers) ── */
const FLAG_CONT={'🇩🇪':'אירופה','🇦🇹':'אירופה','🇵🇱':'אירופה','🇭🇺':'אירופה','🇬🇧':'אירופה','🇫🇷':'אירופה','🇪🇸':'אירופה','🇮🇹':'אירופה','🇵🇹':'אירופה','🇨🇿':'אירופה','🇬🇷':'אירופה','🇧🇪':'אירופה','🇳🇱':'אירופה','🇨🇭':'אירופה','🇸🇪':'אירופה','🇷🇴':'אירופה','🇷🇸':'אירופה','🇭🇷':'אירופה','🇧🇬':'אירופה','🇺🇦':'אירופה','🇸🇮':'אירופה','🇨🇾':'אירופה','🇧🇦':'אירופה','🇩🇰':'אירופה','🇳🇴':'אירופה','🇦🇷':'דרום אמריקה','🇧🇷':'דרום אמריקה','🇨🇱':'דרום אמריקה','🇺🇾':'דרום אמריקה','🇲🇽':'אמריקה','🇺🇸':'אמריקה','🇨🇦':'אמריקה','🇱🇧':'מזרח תיכון','🇹🇷':'מזרח תיכון','🇮🇱':'מזרח תיכון','🇮🇷':'מזרח תיכון','🇮🇶':'מזרח תיכון','🇲🇦':'אפריקה','🇹🇳':'אפריקה','🇿🇦':'אפריקה','🇨🇳':'אסיה','🇹🇭':'אסיה','🇰🇷':'אסיה','🇯🇵':'אסיה','🇻🇳':'אסיה','🇵🇭':'אסיה','🇮🇳':'אסיה'};
function itemOrigin(meta){ if(!meta) return ''; let o=meta.origin||(meta.obj&&meta.obj.origin); if(!o&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); o=r&&(r.origin||(r.obj&&r.obj.origin)); } return o||''; }
function originContinent(origin){ if(!origin) return ''; const f=(origin.match(/\p{Regional_Indicator}\p{Regional_Indicator}/u)||[])[0]; return f?(FLAG_CONT[f]||'אחר'):''; }
function itemContinent(meta){ return originContinent(itemOrigin(meta)); }
function itemRichDesc(meta){
  if(!meta) return '';
  let o=meta.obj||meta;
  if(!o.build&&!o.desc&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); if(r) o=r.obj||r; }
  const bld=o.build||{};
  let d=bld.intro||o.desc||o.note||o.somid||'';
  try{ if(typeof getLang==='function' && getLang()!=='he'){ const dd=(typeof getDict==='function')?getDict():null; if(dd && dd[d]!=null) d=dd[d]; } }catch(e){}   // i18n: pre-translated description (then truncate the translation)
  d=String(d).replace(/\s+/g,' ').trim();
  if(d.length>150) d=d.slice(0,148).replace(/[,\s]+\S*$/,'')+'…';
  return d;
}
function itemPickLabel(meta){
  // "🇩🇪 גרמניה · נקניקיות" — origin + category context line
  const org=itemOrigin(meta); const cat=meta.cat||'';
  return [org, cat].filter(Boolean).join(' · ');
}
/* pure builder: from-scratch build phases → scheduled work-plan tasks (testable) */
/* scratch builds for ground-meat cuts that are made-from-scratch with a mandatory rest/age before cooking */
const CUT_SCRATCH={
  'cut-18':{phases:[
    ['1 · בשר ושומן','בחר בשר ביחס שומן 20-25% (צ׳אק/שריר קדמי + חזה). שמור הכל קר מאוד — 0-2°C.',600],
    ['2 · טחינה','טחן גס (8 מ״מ), פעם אחת. אל תדחוס — נתחים חופשיים לקציצה רכה.',300],
    ['3 · עיצוב רופף','עצב קציצות ביד קלה, שקע-אגודל באמצע. מלח רק על פני השטח וממש לפני הצלייה (מלח מוקדם = מרקם נקניק).',600],
    ['4 · קירור 30-60 דק׳','הנח במקרר על תבנית — מהדק את השומן ומחזיק צורה. חובה לקציצה עסיסית שלא מתפרקת.',2700],
    ['5 · צריבה','גריל/מחבת חמה מאוד. צד ראשון עד קרום, הפיכה אחת. מדחום ליעד — לא ללחוץ!',600]
  ]},
  'cut-17':{phases:[
    ['1 · בשר ושומן','טלה או בקר עם ~20% שומן (אליה/כבש קלאסי). שמור קר.',600],
    ['2 · טחינה ותיבול','טחן, הוסף בצל מגורר וסחוט היטב, פטרוזיליה, כמון, פלפל. אפשר סודה לשתייה (½ כפית/ק״ג) לרכות וקישור.',600],
    ['3 · לישה ארוכה','לוש 5-8 דק׳ עד עיסה דביקה ומחוברת (חילוץ מיוזין) — זה מה שמחזיק על השיפוד.',600],
    ['4 · קירור 1-2 שעות','חובה! העיסה חייבת להתייצב בקור לפני שיפוד. עם סודה — 24-48 שעות במקרר לתוצאה הטובה ביותר.',5400],
    ['5 · עיצוב על שיפוד','לחלח ידיים, מרח את העיסה על שיפוד שטוח-רחב בלחיצות אחידות.',600],
    ['6 · צלייה','גריל חזק, סיבוב מהיר עד חריכה מכל צד. עסיסי בפנים.',600]
  ]}
};
function itemScratchBuild(meta){
  if(!meta) return null;
  const o=meta.obj||meta;
  if(o.build&&(o.build.phases||[]).length) return o.build;
  if(meta.key&&CUT_SCRATCH[meta.key]) return CUT_SCRATCH[meta.key];
  if(meta.cat==='גבינה'){ const cb=cheeseBuild(meta); if(cb&&cb.phases.length) return cb; }
  return null;
}
function hasScratchBuild(meta){ return !!itemScratchBuild(meta); }
// split phases at the rest/aging boundary (or the last cook phase) → {ahead, finish}
const REST_RE=/מנוחה|קירור|יישון|לילה|שעות|24|48|התייצב|הבשלה/;
const FINISH_RE=/בישול|צלייה|עישון|הגשה|טיגון|גריל|בשל|צלה|סיום|חריכה|צריבה/;
function splitPhases(phases){
  const norm=phases.map(p=>Array.isArray(p)?{label:p[0],body:p[1],secs:p[2]||0}:{label:p.title||p.label||'',body:p.body||p.text||'',secs:p.sec||0});
  let cut=-1;
  for(let i=norm.length-1;i>=0;i--){ if(REST_RE.test(norm[i].label)){ cut=i; break; } }   // last rest phase → boundary
  if(cut<0){ cut=norm.length-2; }   // no rest → make-ahead is everything but the final cook step
  cut=Math.max(0,Math.min(cut,norm.length-1));
  return {ahead:norm.slice(0,cut+1), finish:norm.slice(cut+1), hasRest:REST_RE.test((norm[cut]||{}).label||'')};
}
function makeBuildTasks(build, startClock, name, detail, mode){
  const out=[]; const phases=(build&&build.phases)||[]; if(!phases.length) return out;
  const {ahead,finish}=splitPhases(phases);
  const seq = mode==='prepped' ? finish : (mode==='ahead' ? ahead : ahead.concat(finish));
  if(!seq.length) return out;
  const total=seq.reduce((a,s)=>a+(s.secs||0),0)*1000;
  let cursor=new Date(startClock.getTime()-total);
  seq.forEach((s,idx)=>{ out.push({t:new Date(cursor.getTime()),label:`🧫 ${name} — ${s.label}`,sub:idx===0?(mode==='prepped'?'סיום מה שהוכן מראש':'התחלת בנייה מאפס'):'',kind:'prep',det:detail?s.body:''}); cursor=new Date(cursor.getTime()+(s.secs||0)*1000); });
  return out;
}
function isProjectItem(meta){
  if(!meta)return false;
  if(meta.kind==='make'||(meta.key&&meta.key.startsWith('make-'))) return true;   // every make-recipe is built from scratch → project-eligible (fresh sausages included)
  if(PROJ_CATS.includes(meta.cat))return true;
  if(meta.cat==='גבינה'){ let o=meta.obj; if(!o&&meta.key&&typeof resolveItem==='function'){ const r=resolveItem(meta.key); o=r&&r.obj; } o=o||{}; return !!(o.smt||o.age||o.cure); }   // cold-smoked / aged cheeses are projects
  return /Bacon|Jerky|Biltong|Pastrami|Bresaola|Pancetta|Coppa|Guanciale|Lonzino|Speck|Lox|Gravlax|Sucuk|Lap Cheong|Salami|Salume|Pepperoni|Kabanos|Landj/i.test(meta.eng||'');
}
// synthesize from-scratch build phases for aged/smoked cheeses (they have no build.phases in data)
function cheeseBuild(meta){
  const o=(meta&&meta.obj)||{}; if(meta.cat!=='גבינה') return null;
  const ph=[];
  ph.push(['1 · הכנה','הבא את הגבינה לטמפ׳ החדר, יבש את פני השטח היטב (משטח לח = עשן לא נדבק). חתוך לגושים לפי הצורך.',1800]);
  if(o.cure) ph.push(['2 · המלחה/ריפוי',`${o.cure}. שכבת מלח/תמלחת מייבשת פני-שטח ומעצימה טעם.`,3600]);
  if(o.smt) ph.push([`${o.cure?3:2} · עישון קר`,`עישון קר ≤${o.smt}°C למשך ${o.smh||'2-4'} שעות על ${o.wood||'עץ פרי'} (מחולל עשן tube/maze). מעל הטמפ׳ הזו הגבינה נמסה — הימנע!`,(parseInt(o.smh)||3)*3600]);
  ph.push([`${(o.cure?1:0)+(o.smt?1:0)+2} · איטום ויישון`,`${o.age||'עטוף בנייר גבינות/ואקום וקרר'} — היישון מאזן את העשן החד לעומק אגוזי-מעושן נעים. סבלנות משתלמת.`, 0]);
  ph.push([`${(o.cure?1:0)+(o.smt?1:0)+3} · בשלות והגשה`,`הגבינה מוכנה כשהעשן התמזג (${o.age||'שבוע-שבועיים'}). פרוס והגש בטמפ׳ החדר.`,0]);
  return {phases:ph};
}
function fillExtras(key){
  const host=$("#extras"); if(!host) return;
  const meta=resolveItem(key); if(!meta) return;
  const hasOuterPicker=(()=>{ const e=document.getElementById('spk-'+key); return !!(e && !host.contains(e)); })();
  const ks=kosherStatus(key), sub=kosherSub(key);
  const note=store.get('note:'+key)||'', rate=store.get('rating:'+key)||0;
  const projBanner=curProject?(()=>{ const p=projById(curProject); return p?`<div class="proj-banner">🧫 ${L('בתוך פרויקט','Inside project')}: <b>${p.name}</b> · ${L('סימוני השלבים נשמרים בפרויקט','step marks are saved in the project')}</div>`:''; })():'';
  host.innerHTML=`<div class="exbox">${projBanner}
     <button class="exaddmenu ${menuHasKey(key)?'on':''}" data-addmenu="${key}" data-full aria-pressed="${menuHasKey(key)}" aria-label="${menuHasKey(key)?L('הסר מהתפריט','Remove from menu'):L('הוסף לתפריט','Add to menu')}">${menuHasKey(key)?`✓ ${L('בתפריט','On menu')}`:`＋ ${L('הוסף לתפריט','Add to menu')}`}</button>
     <div class="exrow">
       <button class="exfav ${isFav(key)?'on':''}" data-exfav>${isFav(key)?`★ ${L('במועדפים','Favorited')}`:`☆ ${L('הוסף למועדפים','Add to favorites')}`}</button>
       <div class="exrate" data-rate>${[1,2,3,4,5].map(n=>`<span class="star ${n<=rate?'on':''}" data-n="${n}">★</span>`).join('')}</div>
     </div>
     ${(ks!=='kosher'&&!isProduce(meta.obj||{}))?`<div class="kbox k-${ks}"><b>${kosherLabel(ks)}</b>${sub?` · ${L('תחליף כשר','Kosher substitute')}: ${t(sub)}`:''}</div>`:(isProduce(meta.obj||{})?'':`<div class="kbox k-ok">✓ ${L('ניתן להכנה כשרה','Can be made kosher')}</div>`)}
     <div class="exactions">
       ${isProjectItem(meta)?`<button data-startproj>▶ ${L('התחל פרויקט','Start project')}</button>`:''}
       ${key==='cut-18'?`<button data-burger>🍔 ${L('בנה את הבורגר','Build the burger')}</button>`:''}
       <button data-recipecart>🛒 ${L('קניות למתכון זה','Shopping for this recipe')}</button>
       <button data-logcook>📓 ${L('תעד בישול','Log cook')}</button>
       ${(meta.kind==='cut'&&!isProduce(meta.obj||{}))?`<button data-butcher>🥩 ${L('פתק לקצב','Butcher note')}</button>`:''}
       ${meta.obj&&meta.obj.wood&&meta.obj.wood!=='ללא'?`<button data-exwoods>🪵 ${L('עצים','Woods')}</button>`:''}
       <button data-resetprog>↺ ${L('אפס התקדמות','Reset progress')}</button>
     </div>
     <div class="exnotes"><label>${L('הערות אישיות (נשמר אוטומטית)','Personal notes (auto-saved)')}</label><textarea data-note placeholder="${L('טמפ׳ שעבדה, התאמות, מה לשפר…','Temps that worked, tweaks, what to improve…')}">${note}</textarea></div>
     <div data-extraform></div>
   </div>
   ${(!hasOuterPicker&&typeof seasPickerHTML==='function')?seasPickerHTML(key, meta.cat||(meta.obj&&meta.obj.cat), (typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(meta.obj||{}), 'edit'):''}`;
  if(!hasOuterPicker){ const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(meta.obj||{});
    const backFn=meta.kind==='spec'?()=>openSpec(meta.obj):meta.kind==='make'?()=>openMake(key.slice(5)):(meta.kind==='cut'?()=>openCut(meta.obj):null);
    if(typeof wireSeasPicker==='function') wireSeasPicker(host, key, meta.cat||(meta.obj&&meta.obj.cat), isProd, 'edit', null, backFn); }
  host.querySelector('[data-exfav]').addEventListener('click',()=>{toggleFav(key);fillExtras(key);});
  host.querySelectorAll('[data-rate] .star').forEach(s=>s.addEventListener('click',()=>{
    const n=+s.dataset.n, cur=store.get('rating:'+key)||0; store.set('rating:'+key,cur===n?0:n); _ratings=null; fillExtras(key); render();
  }));
  const ta=host.querySelector('[data-note]'); let tmo;
  ta.addEventListener('input',()=>{clearTimeout(tmo);tmo=setTimeout(()=>store.set('note:'+key,ta.value),350);});
  const ff=host.querySelector('[data-extraform]');
  const sp=host.querySelector('[data-startproj]'); if(sp) sp.addEventListener('click',()=>{ if(typeof openProjectWizard==='function') openProjectWizard(meta); else startProjectForm(meta,ff); });
  const bg=host.querySelector('[data-burger]'); if(bg) bg.addEventListener('click',openBurgerBuilder);
  const rc=host.querySelector('[data-recipecart]'); if(rc) rc.addEventListener('click',()=>{
    if(typeof openRecipeShop==='function') openRecipeShop(meta);
  });
  const rp=host.querySelector('[data-resetprog]'); if(rp) rp.addEventListener('click',async()=>{
    if((await appConfirm('לאפס את כל סימוני ההתקדמות למתכון זה?',{okLabel:'↺ אפס',danger:true}))!==true) return;
    if(curProject){ const a=pantry(), p=a.find(x=>x.id===curProject); if(p){ p.doneSteps=[]; savePantry(a); } }
    else resetRecipeProgress(key);
    if(typeof openMake==='function'&&meta.kind==='make'){ pendingProject=curProject; openMake(key.replace(/^make-/,'')); } else if(typeof openSpec==='function'&&meta.kind==='spec'){ pendingProject=curProject; openSpec(meta.obj); } else if(typeof openCut==='function'&&meta.kind==='cut'){ pendingProject=curProject; openCut(meta.obj); }
    if(typeof toast==='function') toast('ההתקדמות אופסה ↺');
  });
  host.querySelector('[data-logcook]').addEventListener('click',()=>logCookForm(meta,ff));
  const bt=host.querySelector('[data-butcher]'); if(bt) bt.addEventListener('click',()=>butcherForm(meta,ff));
  const wd=host.querySelector('[data-exwoods]'); if(wd) wd.addEventListener('click',()=>openWoods(meta.cat));
}

/* ---- pantry (curing/drying tracker) ---- */
function pantry(){return store.get('mk-pantry')||[];}
function savePantry(a){store.set('mk-pantry',a);}
/* ── pantry as component store: source (scratch/bought) + stage (building/ready/done) ── */
function projProgressReady(p){
  if(p.source==='bought') return true;
  if(p.type==='scratch'){ const ph=projPhases(p); return ph.length? (p.doneSteps||[]).length>=ph.length : true; }
  if(p.type==='dry'){ return p.curW<=Math.round(p.startW*p.factor); }
  if(p.type==='cure'){ return daysBetween(p.start,today())>=p.days; }
  return true;
}
function projStage(p){
  if(p.stage==='done') return 'done';
  if(p.source==='bought') return p.stage||'ready';
  return projProgressReady(p)?'ready':'building';
}
const STAGE_LABEL={building:'⏳ בתהליך',ready:'📦 מוכן לסיום',done:'✅ מוכן להגשה'};
const STAGE_LABEL_EN={building:'⏳ In progress',ready:'📦 Ready to finish',done:'✅ Ready to serve'};
function stageLabel(k){ return (getLang()==='he'?STAGE_LABEL:STAGE_LABEL_EN)[k]||k; }
// bridge a ready pantry item into the active plan (event/cook) at the right timeline stage
function pantryToPlan(pid){
  const p=pantry().find(x=>x.id===pid); if(!p||!p.key) return;
  const stg=projStage(p);
  const m=(typeof menuState==='function')?menuState():{keys:[]}; m.keys=m.keys||[];
  if(!m.keys.includes(p.key)){ m.keys.push(p.key); if(typeof saveMenu==='function') saveMenu(m); }
  // set the timeline stage for this item: done→'ready' (serve only), ready→'prepped' (finish only)
  try{ const all=tlState(); all[p.key]=all[p.key]||{method:null}; const tls=(stg==='done')?'ready':'prepped'; all[p.key].stage=tls; all[p.key].ready=(tls==='ready'); tlSetState(all); }catch(e){}
  if(typeof updateCartBadge==='function') updateCartBadge();
  const ctxName=(typeof menuCtx==='function'&&menuCtx()==='event')?L('האירוע','the event'):L('הבישול','the cook');
  if(typeof toast==='function') toast(`${p.name} ${L('נוסף ל','added to ')}${ctxName} · ${stg==='done'?L('מוכן להגשה','ready to serve'):L('רק סיום','finish only')}`);
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwGo==='function') cwGo(3);
}
// attach a finishing step (e.g. cold-smoke) to a bought item → becomes an active tracked project
function pantryAddFinish(pid){
  const a=pantry(); const p=a.find(x=>x.id===pid); if(!p) return;
  const meta=p.key?resolveItem(p.key):null;
  const o=(meta&&meta.obj)||{};
  // cheese → cold-smoke + aging; else generic cure window
  if(p.key && meta && meta.cat==='גבינה'){
    p.type='cure'; p.source='bought-finish'; p.stage='building'; p.start=today();
    const days=parseInt((o.age||'').match(/\d+/)?.[0]||'')||7; p.days=days;
    p.finish='עישון קר'+(o.smt?` ≤${o.smt}°C`:'')+(o.smh?` · ${o.smh}ש`:'')+(o.age?` · יישון ${o.age}`:'');
  } else {
    p.type='cure'; p.source='bought-finish'; p.stage='building'; p.start=today(); p.days=p.days||2;
    p.finish='סיום/יישון לפני הגשה';
  }
  savePantry(a);
  if(typeof projSeedReminders==='function'){ try{ projSeedReminders(p); }catch(e){} }
  if(typeof toast==='function') toast('נוסף שלב סיום — הפריט עבר למעקב פעיל 🧫');
  if(typeof cPaintProjects==='function') cPaintProjects();
}
function startProjectForm(meta,host){
  const dryMode=/Bacon|Pastrami|Brine|כבישה/i.test(meta.eng||'')&&!/Dry|Bresaola|Salame|Salami|Speck|Lonzino|Coppa/i.test(meta.eng||'')?'cure':'dry';
  host.innerHTML=`<div class="miniform">
    <h4>התחלת פרויקט — ${meta.heb}</h4>
    <label>שם<input data-pn value="${meta.heb}"></label>
    <label>סוג
      <select data-pmode>
        <option value="dry" ${dryMode==='dry'?'selected':''}>ייבוש למשקל יעד</option>
        <option value="cure" ${dryMode==='cure'?'selected':''}>כבישה לפי ימים</option>
      </select></label>
    <label>תאריך התחלה<input type="date" data-pstart value="${today()}"></label>
    <div data-dryf><label>משקל התחלה (גרם)<input type="number" data-pw value="1000"></label>
      <label>אחוז ירידת יעד<select data-pf><option value="0.65">35% (×0.65)</option><option value="0.62" selected>38% (×0.62)</option><option value="0.6">40% (×0.60)</option></select></label></div>
    <div data-curef style="display:none"><label>משך כבישה (ימים)<input type="number" data-pd value="7"></label></div>
    <div class="mf-actions"><button data-psave>שמור פרויקט</button><button data-pcancel class="ghost">ביטול</button></div>
  </div>`;
  const mode=host.querySelector('[data-pmode]'), dryf=host.querySelector('[data-dryf]'), curef=host.querySelector('[data-curef]');
  mode.addEventListener('change',()=>{const c=mode.value==='cure';dryf.style.display=c?'none':'';curef.style.display=c?'':'none';});
  if(dryMode==='cure'){dryf.style.display='none';curef.style.display='';}
  host.querySelector('[data-pcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelector('[data-psave]').addEventListener('click',()=>{
    const m=mode.value, p={id:uid(),key:meta.key,name:host.querySelector('[data-pn]').value||meta.heb,
      type:m,start:host.querySelector('[data-pstart]').value||today()};
    if(m==='dry'){p.startW=+host.querySelector('[data-pw]').value||1000;p.factor=+host.querySelector('[data-pf]').value||0.62;p.curW=p.startW;}
    else {p.days=+host.querySelector('[data-pd]').value||7;}
    const a=pantry();a.push(p);savePantry(a);
    if(typeof cPaintProjects==='function') cPaintProjects();
    host.innerHTML=`<div class="okmsg">✓ הפרויקט נוסף למעקב. <button class="linklike" data-openpantry>פתח את הפרויקטים</button></div>`;
    host.querySelector('[data-openpantry]').addEventListener('click',()=>{ if(typeof closePanel==='function') closePanel(); if(typeof cNavGo==='function'){ cNavGo('projects'); } else if(typeof openPantry==='function'){ openPantry(); } });
  });
}
function openPantry(){
  // unified: the pantry/projects live on the projects screen — redirect there
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function'){ cNavGo('projects'); return; }
  const a=pantry();
  const rows=a.map(p=>{
    if(p.type==='dry'){
      const target=Math.round(p.startW*p.factor), lossNow=p.startW?Math.round((1-p.curW/p.startW)*100):0;
      const targetLoss=Math.round((1-p.factor)*100), ready=p.curW<=target;
      const pct=Math.min(100,Math.round(lossNow/targetLoss*100));
      return `<div class="pcard" data-id="${p.id}">
        <div class="pc-top"><b>${p.name}</b><span class="pc-day">יום ${daysBetween(p.start,today())}</span><button class="pc-rm" data-prm="${p.id}">×</button></div>
        <div class="pc-meta">ייבוש למשקל · התחלה ${p.startW} ג׳ · יעד ${target} ג׳ (${targetLoss}%)</div>
        <div class="pbar"><i style="width:${pct}%;background:${ready?'var(--good)':'var(--ember)'}"></i></div>
        <div class="pc-row"><label>משקל נוכחי</label><input type="number" data-pcw="${p.id}" value="${p.curW}"> ג׳ · ירידה ${lossNow}% ${ready?'<b style="color:var(--good)">· מוכן! ✓</b>':`· נותרו ~${Math.max(0,targetLoss-lossNow)}%`}</div>
      </div>`;
    } else {
      const elapsed=daysBetween(p.start,today()), ready=elapsed>=p.days;
      const pct=Math.min(100,Math.round(elapsed/p.days*100));
      return `<div class="pcard" data-id="${p.id}">
        <div class="pc-top"><b>${p.name}</b><span class="pc-day">יום ${elapsed}/${p.days}</span><button class="pc-rm" data-prm="${p.id}">×</button></div>
        <div class="pc-meta">כבישה · סיום ${fmtDate(addDays(p.start,p.days))} ${ready?'<b style="color:var(--good)">· הסתיים ✓</b>':''}</div>
        <div class="pbar"><i style="width:${pct}%;background:${ready?'var(--good)':'var(--ember)'}"></i></div>
      </div>`;
    }
  }).join("");
  showPanel(`${toolTop('המזווה שלי','מעקב ריפוי וייבוש','🧫','#9e4a3d')}
   <div class="panel-body">${a.length?rows:'<div class="shop-empty">אין פרויקטים פעילים.<br>פתח מתכון ריפוי/ייבוש ולחץ "▶ התחל פרויקט".</div>'}
   ${a.length?'<button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ הדפס</button>':''}</div>`);
  $("#panel").querySelectorAll('[data-pcw]').forEach(inp=>inp.addEventListener('input',()=>{
    const a2=pantry(), p=a2.find(x=>x.id===inp.dataset.pcw); if(p){p.curW=+inp.value||p.curW;savePantry(a2);openPantry();}
  }));
  $("#panel").querySelectorAll('[data-prm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=pantry(), idx=arr.findIndex(x=>x.id===b.dataset.prm), removed=arr[idx];
    savePantry(arr.filter(x=>x.id!==b.dataset.prm));openPantry();
    toast('הפרויקט נמחק', ()=>{ const a=pantry(); a.splice(Math.min(idx,a.length),0,removed); savePantry(a); openPantry(); });
  }));
}

/* ---- reminders (derived from pantry + manual) ---- */
function reminders(){return store.get('mk-reminders')||[];}
function openReminders(){
  const man=reminders();
  const derived=pantry().map(p=>{
    if(p.type==='cure') return {text:`${L('סיום כבישה','Curing done')}: ${p.name}`,date:addDays(p.start,p.days),auto:true};
    return {text:`${L('שקילת ביניים','Interim weigh-in')}: ${p.name}`,date:addDays(p.start,7*(Math.floor(daysBetween(p.start,today())/7)+1)),auto:true};
  });
  const all=[...derived,...man].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const rows=all.map((r,i)=>`<div class="shop-line"><span>${fmtDate(r.date)} ${new Date(r.date)<new Date(today())?'<b style="color:var(--ember)">⏰</b>':''}</span><span style="flex:1">${r.text}</span>${r.auto?`<span class="ktag kd" style="position:static">${L('אוטומטי','Auto')}</span>`:`<button class="rm" data-rrm="${r.id}">×</button>`}</div>`).join("");
  showPanel(`${toolTop(L('תזכורות','Reminders'),L('אבני-דרך לתהליכים רב-יומיים','Milestones for multi-day processes'),'⏰','#b5603a')}
   <div class="panel-body">
     <div class="miniform"><h4>${L('תזכורת חדשה','New reminder')}</h4>
       <label>${L('טקסט','Text')}<input data-rtext placeholder="${L('להפוך בייקון, לבדוק pH…','Flip bacon, check pH…')}"></label>
       <label>${L('תאריך','Date')}<input type="date" data-rdate value="${today()}"></label>
       <div class="mf-actions"><button data-radd>${L('הוסף','Add')}</button></div></div>
     <div style="margin-top:14px">${all.length?rows:`<div class="shop-empty">${L('אין תזכורות. פרויקטים במזווה יוצרים תזכורות אוטומטית.','No reminders. Pantry projects create reminders automatically.')}</div>`}</div>
   </div>`);
  $("#panel").querySelector('[data-radd]').addEventListener('click',()=>{
    const t=$("#panel").querySelector('[data-rtext]').value.trim(), d=$("#panel").querySelector('[data-rdate]').value;
    if(!t)return; const m=reminders(); m.push({id:uid(),text:t,date:d||today()}); store.set('mk-reminders',m); openReminders();
  });
  $("#panel").querySelectorAll('[data-rrm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=reminders(), idx=arr.findIndex(x=>x.id===b.dataset.rrm), removed=arr[idx];
    store.set('mk-reminders',arr.filter(x=>x.id!==b.dataset.rrm));openReminders();
    toast('התזכורת נמחקה', ()=>{ const a=reminders(); a.splice(Math.min(idx,a.length),0,removed); store.set('mk-reminders',a); openReminders(); });
  }));
}

/* ---- cook journal ---- */
function journal(){return store.get('mk-journal')||[];}
function logCookForm(meta,host){
  host.innerHTML=`<div class="miniform">
    <h4>תיעוד בישול — ${meta.heb}</h4>
    <label>תאריך<input type="date" data-jd value="${today()}"></label>
    <label>טמפ׳/הערה<input data-jt placeholder="יעד 94°, יצא מצוין"></label>
    <label>דירוג
      <select data-jr><option value="0">—</option><option>1</option><option>2</option><option>3</option><option value="4" selected>4</option><option>5</option></select></label>
    <label>תמונה (אופציונלי)<input type="file" accept="image/*" data-jp></label>
    <div class="mf-actions"><button data-jsave>שמור ליומן</button><button data-jcancel class="ghost">ביטול</button></div>
  </div>`;
  host.querySelector('[data-jcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelector('[data-jsave]').addEventListener('click',async ()=>{
    const e={id:uid(),key:meta.key,name:meta.heb,date:host.querySelector('[data-jd]').value||today(),
      temp:host.querySelector('[data-jt]').value,rating:+host.querySelector('[data-jr]').value||0};
    const f=host.querySelector('[data-jp]').files[0];
    if(f){try{e.photo=await downscale(f);}catch(err){}}
    const a=journal();a.unshift(e);try{store.set('mk-journal',a);}catch(err){if(typeof toast==='function')toast('⚠ אין מקום אחסון לתמונה — נשמר בלי תמונה');delete e.photo;store.set('mk-journal',a);}
    host.innerHTML=`<div class="okmsg">✓ נוסף ליומן הבישולים. <button class="linklike" data-openj>פתח</button></div>`;
    host.querySelector('[data-openj]').addEventListener('click',openJournal);
  });
}
function downscale(file){return new Promise((res,rej)=>{
  const r=new FileReader();r.onerror=rej;
  r.onload=()=>{const img=new Image();img.onerror=rej;img.onload=()=>{
    const max=360,sc=Math.min(1,max/Math.max(img.width,img.height));
    const cv=document.createElement('canvas');cv.width=img.width*sc;cv.height=img.height*sc;
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);res(cv.toDataURL('image/jpeg',0.6));
  };img.src=r.result;};r.readAsDataURL(file);
});}
// Wave 3 · personal coach — deterministic longitudinal intelligence from the journal (no key needed).
function journalCoach(){
  const j=(typeof journal==='function'?journal():[]).filter(function(e){return e;});
  if(j.length<3) return {enough:false, count:j.length};
  const rated=j.filter(function(e){return e.rating;});
  const avg=rated.length?(rated.reduce(function(a,e){return a+e.rating;},0)/rated.length):null;
  const byItem={};
  j.forEach(function(e){ const k=(e.name||e.key||'?'); if(!byItem[k]) byItem[k]={name:k,count:0,rateSum:0,rateN:0}; byItem[k].count++; if(e.rating){byItem[k].rateSum+=e.rating;byItem[k].rateN++;} });
  const items=Object.keys(byItem).map(function(k){ const o=byItem[k]; return {name:o.name,count:o.count,avg:o.rateN?o.rateSum/o.rateN:null}; });
  const mostCooked=items.slice().sort(function(a,b){return b.count-a.count;})[0];
  const bestRated=items.filter(function(i){return i.avg!=null && i.count>=2;}).sort(function(a,b){return b.avg-a.avg;})[0];
  const tnum=function(e){ const m=String(e.temp||'').match(/\d+/); return m?+m[0]:null; };
  const hi=rated.filter(function(e){return e.rating>=4;}).map(tnum).filter(function(n){return n!=null;});
  const lo=rated.filter(function(e){return e.rating<=3;}).map(tnum).filter(function(n){return n!=null;});
  let tempPattern=null;
  if(hi.length>=2 && lo.length>=2){ const ha=hi.reduce(function(a,b){return a+b;},0)/hi.length, la=lo.reduce(function(a,b){return a+b;},0)/lo.length; if(Math.abs(ha-la)>=5) tempPattern={hi:Math.round(ha),lo:Math.round(la)}; }
  return {enough:true, count:j.length, avg:avg?Math.round(avg*10)/10:null, mostCooked:mostCooked, bestRated:bestRated, tempPattern:tempPattern};
}
function _journalCoachHtml(){
  const he=(typeof getLang!=='function'||getLang()==='he'); const c=journalCoach(); if(!c.enough) return '';
  const bits=[];
  bits.push(`<b>${c.count}</b> ${he?'בישולים תועדו':'cooks logged'}${c.avg!=null?` · ${he?'דירוג ממוצע':'avg'} ${c.avg}★`:''}`);
  if(c.mostCooked && c.mostCooked.count>=2) bits.push(`${he?'הכי מבושל':'Most cooked'}: <b>${esc(c.mostCooked.name)}</b> (${c.mostCooked.count})`);
  if(c.bestRated) bits.push(`${he?'הכי מדורג':'Best rated'}: <b>${esc(c.bestRated.name)}</b> (${Math.round(c.bestRated.avg*10)/10}★)`);
  if(c.tempPattern){ const hotter=c.tempPattern.hi>c.tempPattern.lo; bits.push(he?`הבישולים המדורגים גבוה רצו ${hotter?'חם':'קריר'} יותר (~${c.tempPattern.hi}° מול ${c.tempPattern.lo}°).`:`Your higher-rated cooks ran ${hotter?'hotter':'cooler'} (~${c.tempPattern.hi}° vs ${c.tempPattern.lo}°).`); }
  return `<div class="jcoach"><div class="jcoach-h">🎓 ${he?'המאמן שלך':'Your coach'}</div>${bits.map(function(b){return `<div class="jcoach-row">${b}</div>`;}).join('')}</div>`;
}
function openJournal(){
  const a=journal();
  const rows=a.map(e=>`<div class="jcard">
    ${e.photo?`<img src="${e.photo}" alt="">`:''}
    <div class="jc-main"><div class="jc-top"><b>${e.name}</b><span>${fmtDate(e.date)}</span></div>
    ${e.temp?`<div class="jc-temp">${e.temp}</div>`:''}${e.rating?`<div class="rmini">${'★'.repeat(e.rating)}</div>`:''}</div>
    <button class="pc-rm" data-jrm="${e.id}">×</button></div>`).join("");
  showPanel(`${toolTop(L('יומן בישולים','Cook journal'),L('היסטוריה אישית','Personal history'),'📓','#c0563a')}
   <div class="panel-body">${_journalCoachHtml()}${(typeof aiAvail==='function'&&aiAvail()&&a.length>=3)?`<button class="ccta" id="jInsights" style="margin:0 0 14px;background:var(--fresh);border-color:var(--fresh)">✨ ${L('תובנות AI מהיומן','AI insights from the journal')}</button>`:''}${a.length?rows:`<div class="shop-empty">${L('אין רישומים עדיין.','No entries yet.')}<br>${L('פתח מתכון ולחץ "📓 תעד בישול".','Open a recipe and tap "📓 Log cook".')}</div>`}</div>`);
  const ib=$("#jInsights"); if(ib) ib.addEventListener('click',openJournalInsights);
  $("#panel").querySelectorAll('[data-jrm]').forEach(b=>b.addEventListener('click',()=>{
    const arr=journal(), idx=arr.findIndex(x=>x.id===b.dataset.jrm), removed=arr[idx];
    store.set('mk-journal',arr.filter(x=>x.id!==b.dataset.jrm));openJournal();
    toast('הרישום נמחק', ()=>{ const a=journal(); a.splice(Math.min(idx,a.length),0,removed); try{store.set('mk-journal',a);}catch(e){} openJournal(); });
  }));
}

/* ---- butcher note (IL cut translator) ---- */
const ILCUT=[
 // ── בקר: שיטת המספור הישראלית (1–19) ──
 ["אנטריקוט","Ribeye","אנטריקוט / ורד הצלע / עין (נתח 1)","המלך לסטייק. בקש שיוש (marbling) טוב, עובי 2.5–3 ס״מ. צלעות 6–12"],
 ["אונטריב","Chuck / Under-rib","אונטריב / עורף (נתח 2)","בין האנטריקוט לצוואר. סיבי ושומני — מצוין לבישול ארוך, לחמין ולטחינה"],
 ["בריסקט / חזה","Brisket","חזה / ברוסט / בריסקט (נתח 3)","בקש 'פוינט' לעסיסי או 'פלאט' לפרוסות. מלך העישון — low & slow"],
 ["כתף מרכזי","Shoulder Clod","כתף מרכזי / שולטר (נתח 4)","נתח עבודה גדול. לצלי בסיר, לרגו, לטחינה"],
 ["צלי כתף","Chuck Roast","צלי כתף / פלטה / פולקה (נתח 5)","דמוי כיכר. לצלייה איטית ברוטב/תנור — מתרכך יפה"],
 ["פילה מדומה","Chuck Tender","פילה מדומה / פלאש פילה (נתח 6)","ארוך ורזה יחסית. לרולדה ממולאת, לצלי, לתבשיל"],
 ["מכסה אנטריקוט","Rib Cap / Spinalis","מכסה האנטריקוט / מרוצ'ה (נתח 7)","החלק הכי טעים בצלע. לגריל מהיר, או לטחינה לבורגר יוקרתי"],
 ["שריר קדמי","Foreshank / Shin","שריר קדמי / מוזה / מזעל (נתח 8)","עתיר קולגן וג'לטין. לאוסובוקו, לצירים, לחמין"],
 ["אסאדו / שפונדרה","Short Ribs","אסאדו (עם עצם) / שפונדרה (נתח 9)","עבה לעישון, דק לאסאדו על האש. שומני עם טעם עמוק"],
 ["צוואר","Neck / Chuck","צוואר / אלזה (נתח 10)","טעם עמוק, הרבה קולגן. לחמין, לפולד-בקר, לנקניק טחון"],
 ["סינטה","Striploin / Sirloin","סינטה / מותן / פור פילה (נתח 11)","שכבת שומן חיצונית אחת. לסטייק, רוסטביף, קרפצ'יו. חתך 3 ס״מ"],
 ["פילה בקר","Tenderloin","פילה / פילה מיניון / שאטובריאן (נתח 12)","הרך ביותר, דל שומן. צלייה קצרה בלבד — אל תעברו medium. לרוב לא כשר"],
 ["שייטל","Rump / Top Sirloin","שייטל / כנף העוקץ (נתח 13)","טעם בקרי חזק. ליישון, לשיפודים, לסטייק על מחבת. חלק אחורי"],
 ["אווזית / אגוז","Eye of Round","אווזית / אגוז (נתח 14)","עגול ורזה. לרוסטביף פרוס דק, לבישול ארוך, לפסטרמה"],
 ["שפיץ צ'אך / פיקניה","Picanha / Rump Cap","שפיץ צ'אך / פיקניה (נתח 15)","שכבת שומן עבה — השאירו אותה! חרצו שתי-וערב. לגריל, מעשנה או סו-ויד"],
 ["ירכה / צ'ך","Thick Flank / Knuckle","ירכה / צ'ך / כף (נתח 16)","רזה ואחיד. לשניצל, אסקלופ, בישול מהיר בפריסה דקה"],
 ["שריר אחורי / אוסובוקו","Hind Shank / Osso Buco","שריר אחורי / אוסובוקו (נתח 17–18)","פרוסות עם עצם מח. לאוסובוקו קלאסי, בישול ארוך ואיטי"],
 // ── נתחי קצב / סרעפת ומודרניים ──
 ["נתח קצבים","Hanger / Onglet","נתח קצבים / אונגלט / 'אדום'","מהסרעפת, אחד לפרה. טעם עז, MR חובה. הסירו את הגיד המרכזי, חתכו נגד הסיבים. אוהב מרינדה"],
 ["סקירט","Skirt","סקירט / שולכן / רוטפלייש","ארוך ודק מהסרעפת. סופג מרינדה מצוין (סויה/שום/צ'ילי). צלייה חזקה ומהירה, MR"],
 ["פלאנק","Flank","פלאנק / בטן","שטוח מהבטן. למרינדה, גריל חזק, פריסה דקה נגד הסיבים. לפחיטס"],
 ["ואסיו","Vacío / Bavette","ואסיו / בָּוֶט","נתח האסאדו הארגנטינאי מהבטן. שכבת שומן-עור עליונה שמתקרמלת. גריל איטי"],
 ["דנוור","Denver","דנוור / שכם","מהשכם — רך כמעט כאנטריקוט, טעם עז יותר, מחיר נמוך. גריל מהיר, MR, הפיכה אחת"],
 ["פלאט איירון","Flat Iron","פלאט איירון / מכסה הכתף","נתח כתף רך מאוד. הסירו את הגיד המרכזי. לגריל/מחבת, MR–M"],
 ["טרי-טיפ","Tri-Tip","טרי-טיפ / שפיץ סינטה","משולש מהסינטה התחתונה. לגריל/עישון, חתכו נגד הסיבים (משתנה כיוון)"],
 ["טומהוק","Tomahawk","טומהוק / אנטריקוט עם עצם ארוכה","אנטריקוט חגיגי עם עצם צלע שלמה. reverse-sear מומלץ, מנוחה ארוכה"],
 ["לחי בקר","Beef Cheek","לחי בקר","עמוס קולגן, נמס אחרי 3–4 שעות. לבישול איטי, לראגו"],
 ["לשון בקר","Beef Tongue","לשון בקר","לבישול ארוך ואז קילוף. מעושנת או כבושה — מעדן"],
 ["זנב שור","Oxtail","זנב שור / אוקסטייל","עשיר בג'לטין. למרקים, לתבשיל אוסו-באקו-סטייל"],
 ["עצמות מח","Marrow Bones","עצמות מח עצם","חתך אורכי/רוחבי. לצלייה בתנור, למרוח על לחם, לציר"],
 // ── חזיר / עוף / טלה / דג ──
 ["כתף חזיר","Pork Shoulder","כתף חזיר (Boston Butt)","לפולד-פורק; בקש עם שומן. עישון 8+ שעות"],
 ["בטן חזיר","Pork Belly","בטן חזיר","לבייקון/פנצ'טה — בקש עם/בלי עור"],
 ["צלעות חזיר","Pork Ribs","ספר-ריבס / בייבי-בק","בקש להסיר את ה-membrane מהצד הפנימי"],
 ["חזה עוף","Chicken Breast","חזה עוף","עם/בלי עצם לפי המתכון. זהירות מייבוש — בריין מומלץ"],
 ["פרגיות / שוקיים","Chicken Thigh","פרגיות / שוקיים","שומני ועסיסי — סלחני לעישון ולגריל"],
 ["כתף טלה","Lamb Shoulder","כתף טלה","לעישון איטי או לקבב טחון. עשיר בטעם"],
 ["צלע טלה","Lamb Rack","צלעות טלה / קרֶה","בקש חיתוך 'צרפתי' מנוקה. גריל מהיר, MR"],
 ["סלמון","Salmon","פילה סלמון","לגרבלקס/לקס — בקש סושי-גרייד או קפוא-הוקפא כהלכה"],
 // ── דגים ──
 ["פורל","Trout","פורל / טרוטה","דג מים-מתוקים עדין. שלם או פילה, מצוין לעישון קר/חם"],
 ["טונה","Tuna","סטייק טונה אדומה","בקש 'סושי-גרייד' לסירינג. חתוך עבה, MR בלבד — לא לייבש"],
 ["הליבוט","Halibut","הליבוט / פוטית","דג לבן מוצק ורזה. יעד עדין, קל לייבש-יתר"],
 // ── פירות ים ──
 ["שרימפס","Shrimp / Prawns","שרימפס / חסילונים / גמברי","לפי גודל (U-10 ענק ← 41/50 קטן). בקש עם/בלי קליפה, deveined"],
 ["סקלופס","Scallops","צדפות סקלופ / מסרקן","'Dry-pack' עדיף (בלי זרחות) — נצרב מושלם. U-10 לגריל"],
 ["לובסטר","Lobster","לובסטר / זנב לובסטר","זנב לגריל, שלם להרתחה/אידוי. קנה חי או קפוא-בים"],
 ["קלמארי","Squid / Calamari","קלמארי / דיונון","נקה את הצינור והזרועות. גריל חם-קצר או נזיד ארוך — לא באמצע"],
 ["תמנון","Octopus","תמנון / אוקטופוס","בשל-מראש עד ריכוך (נזיד/סו-ויד) ואז חריכה מהירה על האש"],
 ["סרטן","Crab","סרטן / רגלי סרטן","רגלי מלך לאידוי/גריל. קנה מבושל-קפוא או חי"],
 ["מולים","Mussels","מולים / מידיות","קנה חיים וסגורים; זרוק פתוחים שלא נסגרים בהקשה. אידוי מהיר ביין"],
 // ── גבינות לעישון ──
 ["גאודה","Gouda","גאודה","גבינת עישון קר קלאסית — מקשה למחצה, נמסה יפה. עשן ≤25°C"],
 ["צ'דר","Cheddar","צ'דר / צ׳דר מיושן","מצוין לעישון קר; ככל שמיושן יותר — טעם חד יותר"],
 ["חלומי","Halloumi","חלומי / גבינה למנגל","עמידה-חום — נצלית ישירות על הגריל בלי להימס"],
 ["מוצרלה","Mozzarella","מוצרלה / סקמורצה","סקמורצה (מיובשת) לעישון; מוצרלה טרייה לגריל קצר"]
];
function butcherForm(meta,host){
  const heb=meta.heb;
  const il=ILCUT.find(r=>heb.includes(r[0].split(' ')[0])||(meta.eng||'').toLowerCase().includes((r[1]||'').toLowerCase()));
  host.innerHTML=`<div class="miniform">
    <h4>פתק לקצב</h4>
    ${il?`<div class="kbox k-ok">שם ישראלי: <b>${il[2]}</b> · ${il[3]}</div>`:''}
    <label>כמות (ק״ג)<input type="number" step="0.5" data-bkg value="${meta.obj&&meta.obj.kg?meta.obj.kg:2}"></label>
    <label>הערת חיתוך<input data-bnote value="${il?il[3]:''}"></label>
    <div class="butchernote" data-bout></div>
    <div class="mf-actions"><button class="prbtn" style="position:static" data-print>⎙ הדפס פתק</button><button data-bcancel class="ghost">סגור</button></div>
  </div>`;
  function paint(){
    const kg=host.querySelector('[data-bkg]').value, n=host.querySelector('[data-bnote]').value;
    host.querySelector('[data-bout]').innerHTML=`שלום, אבקש: <b>${il?il[2]:heb}</b> — כמות ${kg} ק״ג.${n?' '+n+'.':''} תודה!`;
  }
  host.querySelector('[data-bkg]').addEventListener('input',paint);
  host.querySelector('[data-bnote]').addEventListener('input',paint);
  host.querySelector('[data-bcancel]').addEventListener('click',()=>host.innerHTML='');
  host.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  paint();
}
function openCutTrans(){
  const rows=ILCUT.map(r=>`<div class="ctrow"><div><b>${getLang()==='he'?r[0]:r[1]}</b> <span class="ct-en">${getLang()==='he'?r[1]:t(r[0])}</span></div><div class="ct-il" data-mt>${r[2]}</div><div class="ct-note" data-mt>${r[3]}</div></div>`).join("");
  showPanel(`${toolTop(L('מתרגם נתחים','Cut translator'),L('בשר, דגים, פירות ים וגבינות — שמות גלובליים ↔ ישראליים','Meat, fish, seafood and cheese — global ↔ Israeli names'),'🥩','#c0392b')}
   <div class="panel-body"><div class="ctlist">${rows}</div>
   <p class="section-sub" style="margin-top:14px">${L('טיפ: בכל כרטיס נתח יש כפתור "🥩 פתק לקצב" שמייצר פתק מודפס עם הכמות.','Tip: every cut card has a "🥩 Butcher note" button that generates a printable note with the quantity.')}</p></div>`);
}

/* ---- wood pairing ---- */
const WOOD_INT={"תפוח":"עדין","דובדבן":"עדין","אגוז":"בינוני","אלון":"בינוני","היקורי":"חזק","מסקיט":"חזק מאוד","פקאן":"בינוני","בכר":"עדין","ערבה":"בינוני"};
// ── charcoal guide (types + Israeli suppliers) ──
const CHARCOAL=[
 {heb:"פחם הדרים",eng:"Citrus",flag:"🇪🇬🇮🇱",heat:"גבוה, מהיר",burn:"בינונית",smoke:"ארומה הדרית קלה",best:"מנגל יומיומי, בשר על האש",buy:"חזן גחלים · בית הפחם · סופרים (נפוץ מאוד)"},
 {heb:"קברצ׳ו לבן (Blanco)",eng:"Quebracho Blanco",flag:"🇦🇷",heat:"גבוה יציב",burn:"ארוכה",smoke:"מעט",best:"צלייה מבוקרת, כל-מטרה",buy:"חזן גחלים (10ק״ג) · פחם · בית הפחם"},
 {heb:"קברצ׳ו אדום (Colorado)",eng:"Quebracho Colorado",flag:"🇦🇷",heat:"גבוה מאוד",burn:"ארוכה מאוד",smoke:"מעט",best:"עישון ארוך, סשן ממושך",buy:"פחם · בית הפחם"},
 {heb:"מרבו",eng:"Marabu",flag:"🇨🇺",heat:"גבוה",burn:"ארוכה מאוד (~19ש)",smoke:"עדין נעים",best:"Low&Slow + צריבה",buy:"פחם · בית הפחם (פרימיום)"},
 {heb:"גואייקן",eng:"Guayacan",flag:"🇵🇾",heat:"הכי גבוה",burn:"הכי ארוכה",smoke:"מינימלי",best:"נתחי יוקרה, שפים",buy:"פחם (לפי הזמנה, פרימיום)"},
 {heb:"בינשוטן",eng:"Binchotan",flag:"🇯🇵",heat:"גבוה אחיד",burn:"ארוכה מאוד",smoke:"כמעט ללא",best:"יקיטורי, דגים, צריבה עדינה",buy:"פחם · קומפס גריל (יוקרתי)"},
 {heb:"פחם קוקוס",eng:"Coconut",flag:"🇮🇩🇻🇳",heat:"גבוה יציב",burn:"ארוכה מאוד",smoke:"ניטרלי",best:"דגים, ירקות, קמאדו",buy:"קוקו גריל · חזן גחלים · פחם"},
 {heb:"אלון (לאמפ)",eng:"Oak Lump",flag:"🇺🇸🇮🇱",heat:"גבוה",burn:"ארוכה",smoke:"ארומה קלאסית",best:"בקר, שימוש כללי",buy:"BBQ'NMORE (B&B) · בית הפחם"},
 {heb:"היקורי (לאמפ)",eng:"Hickory Lump",flag:"🇺🇸",heat:"גבוה",burn:"בינונית-ארוכה",smoke:"חזק ומתקתק",best:"חזה, צלעות, חזיר",buy:"BBQ'NMORE (bbq.co.il) · פחם"},
 {heb:"מסקיט",eng:"Mesquite",flag:"🇺🇸🇲🇽",heat:"גבוה מאוד",burn:"מהירה",smoke:"עז ואדמתי",best:"סטייקים, צריבה טקסני",buy:"BBQ'NMORE · פחם"},
 {heb:"בריקטים",eng:"Briquettes",flag:"",heat:"בינוני אחיד",burn:"ארוכה יציבה",smoke:"ניטרלי (לעיתים תוסף)",best:"Low&Slow, מעשנה",buy:"Weber/כל החנויות · סופרים"},
 {heb:"בריקטי קוקוס",eng:"Coconut Briquettes",flag:"🇮🇩",heat:"גבוה יציב",burn:"ארוכה מאוד, מעט אפר",smoke:"ניטרלי",best:"עישון ארוך אקולוגי",buy:"קוקו גריל · פחם"},
 {heb:"אקציה",eng:"Acacia",flag:"🇿🇦",heat:"בינוני",burn:"בינונית (~14ש)",smoke:"ניטרלי",best:"מתחילים, מהיר וקל",buy:"פחם · בית הפחם"},
 {heb:"פחם מקומי (משולש/גדה)",eng:"Local",flag:"🇮🇱",heat:"בינוני-גבוה",burn:"בינונית",smoke:"משתנה",best:"מנגל עממי",buy:"סופרים · תחנות דלק (הכי זמין)"},
 {heb:"פחם דחוס/מעובד",eng:"Compressed",flag:"",heat:"בינוני",burn:"ארוכה",smoke:"תלוי-מותג",best:"תקציבי, נוחות",buy:"סופרים · קוקו גריל"},
];
function openWoods(focusCat){
  const byCat={};
  DATA.cuts.forEach(c=>{(byCat[c.cat]=byCat[c.cat]||new Set());String(c.wood).split('/').forEach(w=>byCat[c.cat].add(w.trim()));});
  const guide={
    "עדין (דג, עוף, גבינה)":"תפוח, דובדבן, בכר — עשן מתוק שלא מכסה.",
    "בינוני (חזיר, הודו, בקר)":"אלון, אגוז, פקאן — האיזון הקלאסי.",
    "חזק (בקר, נתחי קולגן)":"היקורי — בודד או בתערובת.",
    "חזק מאוד (בריסקט טקסני)":"מסקיט — במינון זהיר, מריר אם מוגזם."
  };
  const intRows=Object.entries(guide).map(([k,v])=>`<div class="shop-line"><span style="flex:1"><b data-mt>${k}</b><br><small style="color:var(--smoke)" data-mt>${v}</small></span></div>`).join("");
  const catRows=Object.entries(byCat).map(([c,ws])=>`<div class="ctrow"><div><b style="color:${catColor(c)}">${t(c)}</b></div><div class="ct-note">${[...ws].filter(Boolean).map(w=>t(w)).join(' · ')}</div></div>`).join("");
  showPanel(`${toolTop(L('מדריך עצים ופחמים','Wood & charcoal guide'),L('התאמת דלק, עוצמת עשן והיכן לקנות','Fuel pairing, smoke intensity and where to buy'),'🪵','#8a6a3c')}
   <div class="panel-body">
     <h4 class="mini-h">🔥 ${L('סוגי פחם — והיכן לקנות בישראל','Charcoal types — and where to buy in Israel')}</h4>
     <div class="coallist">${CHARCOAL.map(c=>`<div class="coalcard">
       <div class="coalhead"><b>${c.flag} ${t(c.heb)}</b><span class="coaleng">${c.eng}</span></div>
       <div class="coalmeta"><span>🌡️ ${t(c.heat)}</span><span>⏱️ ${t(c.burn)}</span><span>💨 ${t(c.smoke)}</span></div>
       <div class="coalbest">${L('מתאים ל','Best for')}: ${t(c.best)}</div>
       <div class="coalbuy">🛒 ${t(c.buy)}</div>
     </div>`).join('')}</div>
     <h4 class="mini-h" style="margin-top:20px">🪵 ${L('עצים לפי עוצמה','Woods by intensity')}</h4>${intRows}
     <h4 class="mini-h" style="margin-top:16px">${L('לפי קטגוריה (מהטבלה)','By category (from the table)')}${focusCat?` · ${L('ממוקד','focused')}: ${t(focusCat)}`:''}</h4>
     <div class="ctlist">${catRows}</div>
   </div>`);
}

/* ---- troubleshooting (Help!) ---- */
// troubleshooting knowledge — grouped by topic (rendered as collapsible groups, not all at once)
const TROUBLE_GROUPS=[
 {g:"אש, פחם ועשן",ic:"🔥",items:[
  ["העשן יצא מר / חריף / אפרורי","עשן 'מלוכלך' מבעירה חנוקה שיוצרת קריאוזוט. שאף לעשן כחלחל-שקוף דק, לא לבן סמיך. ודא שהפחם בער לגמרי לפני שהוספת עץ, פתח את הפתחים (אש נקייה חשובה מטמפ׳ נמוכה), והשתמש בעץ יבש ומיושן בלבד."],
  ["עשן לבן וסמיך במקום כחול","סימן ללחות — עץ ירוק/רטוב/קר, או יותר מדי עץ בבת אחת. אל תשרה עץ במים, חמם אותו על הפיירבוקס לפני, הוסף מעט בכל פעם, ותן לענן הלבן לדעוך לפני שמכניסים בשר."],
  ["קשה לשמור טמפ׳ יציבה","אל תרדוף אחרי טמפ׳ נמוכה ע״י חניקת האש — אש קטנה וחמה עדיפה על גדולה ומעשנת. השתמש בשיטת מיניון (פחם לא-בוער על בוער), כוונן בעיקר את פתח הכניסה, וייצב את הטמפ׳ לפני שמכניסים בשר."],
  ["הפחם נכבה או דועך מהר","זרימת אוויר חסומה מאפר או פתחים סגורים. נקה אפר לפני כל בישול, השתמש בארובת-הצתה (chimney) במקום נוזל הצתה (שנותן טעם רע), ופתח פתח תחתון לחמצן."],
  ["טעם כימי / דלק בבשר","נוזל הצתה או פחם דחוס באיכות ירודה. עבור לארובת-הצתה עם קוביות הצתה טבעיות, ותן לפחם להגיע לאפר-אפרפר לפני הבישול."],
  ["התלקחויות (flare-ups) בגריל","שומן שנוטף על גחלים. הזז לאזור עקיף (2-zone fire), קצץ עודף שומן, השתמש במגש טפטוף, ואל תמרח שמן/מרינדה שמנית ישירות מעל להבה."],
 ]},
 {g:"בשר ועישון ארוך",ic:"🥩",items:[
  ["הבריסקט 'תקוע' (Stall) ולא עולה","התאדות-קירור סביב 65–77°C — נורמלי לחלוטין, יכול להימשך 1–3 שעות. אל תעלה חום בפאניקה. אופציות: סבלנות; או 'Texas Crutch' — עטיפה בנייר קצבים/אלומיניום סביב 68°C כדי לפרוץ."],
  ["מתי לעטוף (wrap)?","לא לפי מספר במדחום — לפי הקרום. עטוף כשהקרום כהה, יציב, ולא 'נמרח' במגע. נייר קצבים שומר יותר קרום; אלומיניום מהיר ורך יותר. עטיפה מוקדמת מדי מרככת את הקרום."],
  ["הבשר יצא יבש","לרוב תת-בישול דווקא, לא עודף. בדוק מרקם בחלק העבה ביותר — 'עשוי' זה כשכל הנתח רך, לא נקודה אחת. קח לקולגן ~95°C (לא רק לטמפ׳ בטיחות), ונוח בקופסת בידוד שעה+."],
  ["אין קרום (bark)","יותר מדי לחות מוקדמת, זרימת אוויר חלשה, או ראב עם יותר מדי סוכר ומעט מלח/פלפל. תן לראב להיעשות דביק לפני, הפחת ריסוס בהתחלה, ושמור זרימת אוויר טובה."],
  ["הקרום רך / ספוגי","עטיפה מוקדמת מדי, ריסוס מוגזם, קיטור בתוך אלומיניום, או מנוחה חמה מדי בכלי סגור. פתח את הנתח לאוויר לאחר העטיפה כדי להקשות מחדש."],
  ["הנתח קשה / 'גומי'","תת-בישול של הקולגן. נתחי חזה/כתף צריכים ~90–96°C פנימיים כדי שהקולגן יימס לג׳לטין — הרבה מעבר לטמפ׳ 'עשוי' של סטייק."],
  ["הבשר מתפורר / קרמבלי","עודף בישול — הקולגן נשבר יותר מדי. הוצא מוקדם יותר, חתוך עבה יותר, ובסכין חדה שחותכת ולא קורעת."],
  ["חתכתי והמיצים ברחו","לא נחת מספיק. תן מנוחה 15 דק׳ לנתח קטן, שעה+ לבריסקט/כתף (בקופסת בידוד), וחתוך תמיד נגד כיוון הסיבים."],
  ["טעם מעושן מדי / מריר","נתחים עדינים (עוף, דג, צלעות) סופגים עשן מהר. השתמש בעץ מתון וחשיפה קצרה יותר. לתיקון בדיעבד: רוטב מתוק/חמאה/גלייז מאזנים מרירות."],
 ]},
 {g:"נקניקים ומילוי",ic:"🌭",items:[
  ["השומן 'נמרח' (fat smear)","עבדת חם מדי — השומן נמרח במקום להישאר בגרגר. שמור בשר, שומן וחלקי מטחנה מתחת ל-2–4°C, טחן קפוא-חלקית, ואל תלוש יותר מדי אחרי הוספת השומן."],
  ["הנקניקיות נסדקות/מתפוצצות בצלייה","חום גבוה מדי או שלא נוצר pellicle. ייבש במקרר שעה+ אחרי המילוי, וצלה בחום בינוני-עקיף. חום גבוה מרתיח את הלחות בפנים ומפוצץ את העור."],
  ["בועות אוויר בתוך הנקניק","מילוי לא צפוף או שלא ניקבת. מלא צפוף ואחיד, נַקב את הבועות במחט סטרילית, וסובב לחוליות בכיוונים מתחלפים."],
  ["הנקניק יצא יבש/מפורר","מעט שומן (צריך 20–30%), עודף מלח, או עישון חם מדי. שמור יחס שומן נכון, וקח לטמפ׳ פנימית מדויקת (~68–71°C) בלי לייבש-יתר."],
  ["מרקם 'קמחי'/רך אחרי בישול","טחינה חמה או חוסר קישור (bind). הוסף מלח מוקדם לחילוץ חלבון דביק (myosin), לוש עד שהמסה נדבקת ליד, ושמור הכל קר."],
  ["העור קשיח / 'לעיס'","שרוול טבעי לא הושרה מספיק, או pellicle עבה מדי. השרה מעיים טבעיים 30+ דק׳ והדח פנימית; לשרוולי קולגן — אל תייבש-יתר לפני צלייה."],
 ]},
 {g:"ייבוש וריפוי (שרקוטרי)",ic:"🧫",items:[
  ["הקליפה התקשתה (Case Hardening)","ייבשת מהר מדי — החוץ קשה והפנים רטוב. הגבר לחות ל-78–85%, האט מאוורר (מחזור ~5/25 דק׳), ולעיתים עטוף ב-collagen sheet כדי 'לאזן' לחות חזרה פנימה."],
  ["ה-pH לא יורד בהתססה","התרבית לא 'תפסה'. ודא טמפ׳ 24–26°C, לחות 85–90%, דקסטרוז כמזון לחיידקים, ושלא הרגת את התרבית במים מוכלרים. בדוק תוקף התרבית."],
  ["עובש ירוק/שחור/כחול","עובש לבן (P. nalgiovense) רצוי ומגן. ירוק/שחור — נגב בחומץ או תמי-מלח. אם חדר לעומק או יש ריח אמוניה/רקב — לפסול. שמור לחות יציבה ומחזור אוויר עדין."],
  ["ריח חמצמץ/רקוב או ריר","זיהום — לרוב טמפ׳ גבוהה מדי בשלב מוקדם, מלח לא מספיק, או ירידת pH איטית. פסול אם יש ריר דביק, ריח רע חריף, או צבע אפור-ירקרק בפנים."],
  ["ירד יותר מדי במשקל / קשה מדי","עברת את יעד ה-35–40% ירידה. עטוף בנייר קצב ותן 'לנוח' במקרר שבועות — הלחות מתאזנת חזרה. למדוד תמיד לפי משקל, לא לפי זמן."],
  ["טבעת ייבוש (dry ring) בחתך","החוץ התייבש מהר מהפנים. הכל כמו Case Hardening — לחות גבוהה יותר ומאוורר איטי יותר לאורך כל הייבוש."],
 ]},
 {g:"גבינות ומעושן קר",ic:"🧀",items:[
  ["הגבינה נמסה / 'הזיעה'","חם מדי. עשן קר ב-≤25°C בלבד — עשן בלילה/חורף, הנח מגש קרח מתחת, והשתמש במחולל עשן (maze/tube) בלי חום ישיר."],
  ["הגבינה יצאה מרירה","עודף עשן או עשן מלוכלך. עשן פחות זמן (2–4 שעות), עץ פירות מתון (תפוח/אגס), ואז עטוף ותן 'להתבגר' במקרר 2+ שבועות — הטעם מתמתן ומתאזן."],
  ["אין צבע/טעם עשן","זרימת אוויר מהירה מדי או מרחק גדול מהעשן. קרב את הגבינה, האט מעט את הזרימה, וייבש את פני הגבינה (pellicle) לפני העישון כדי שהעשן ייצמד."],
 ]},
 {g:"דגים ופירות ים",ic:"🐟",items:[
  ["הדג יצא יבש/'מבושל מדי' בסו-ויד","טמפ׳ גבוהה מדי. סלמון: 50–52°C למרקם משיי, פורל דומה. אל תעבור ~55°C אם רוצים עדינות. השתמש בדג סושי-גרייד או קפוא לבטיחות טפילים."],
  ["בטיחות טפילים בדג נא/חלקית","הקפא ל-−20°C ל-7 ימים (או −35°C ל-15 שעות) לפני הגשה נא/חלקית. פירות ים ל-63°C בטיחותי (FDA). קרפצ׳ו/סשימי רק מדג שהוקפא כראוי."],
  ["פירות ים גומיים/קשים","עודף בישול — הם מתבשלים בדקות. שרימפס/סקלופס עד שקיפות נעלמת בלבד, קלמארי או מהר מאוד (דקות) או ארוך מאוד (נזיד) — לא באמצע."],
  ["עור הדג נדבק לגריל","גריל לא חם/נקי מספיק ודג לח. ייבש היטב, שמן את הדג (לא הגריל), הנח על גריל חם ואל תזיז עד שמשתחרר לבד."],
 ]},
 {g:"צומח — ירקות ופירות",ic:"🥬",items:[
  ["הירק נשרף בחוץ וחי בפנים","חום ישיר גבוה מדי. עבור לאזור עקיף לירקות עבים (בטטה, תירס), או חתוך דק יותר. אין 'בטיחות פנים' בצומח — רק שליטה במרקם."],
  ["ירקות יצאו רכים/מימיים","עודף בישול או עודף שמן. צלה בחום גבוה זמן קצר לחריכה עם פנים פריך, ומלח רק בסוף (מלח מוקדם מוציא מים)."],
  ["פירות מתפרקים על הגריל","בשלים מדי או חתוכים דק מדי. בחר פירות מוצקים (אננס, אפרסק לא-בשל-יתר), חתוך עבה, וצלה חם וקצר לקרמול בלי להתפרק."],
 ]},
 {g:"בטיחות מזון",ic:"✅",items:[
  ["כמה Cure להוסיף? חשש מעודף","Cure #1: 2.5 ג׳/ק״ג (=156ppm) למוצרים טחונים/מעושנים; בייקון 2.0 ג׳/ק״ג (120ppm). Cure #2 לייבוש ארוך בלבד. השתמש במחשבון המלח באפליקציה — אל תנחש."],
  ["'כלל 4 השעות' — מה זה?","בשר בטמפ׳ מסוכנת (4–60°C) לא יותר מ-4 שעות מצטברות לאורך חייו. חשוב בעישון איטי: הפנים חייב לעבור 60°C בזמן סביר, במיוחד בבשר טחון/מוזרק."],
  ["פסטור — זמן מול טמפ׳","בטיחות אינה רק טמפ׳ אלא זמן×טמפ׳ במרכז הנתח. עוף ב-60°C למשך ~35 דק׳ בטוח כמו 74°C רגעי — טבלאות באלדווין. סו-ויד מנצל בדיוק את זה."],
  ["זיהום צולב","הפרד קרשים/כלים לנא ומוכן, שטוף ידיים אחרי נגיעה בנא, ואל תחזיר בשר מבושל לצלחת שהחזיקה אותו נא."],
 ]},
];
// rich in-app "about & capabilities" panel — full marketing content, no external file dependency
function openAbout(){
  const nCuts=(DATA.cuts||[]).length, nMakes=Object.keys(DATA.makes||{}).length, nSpec=(DATA.specials||[]).length;
  const nTotal=nCuts+nMakes+nSpec, nSeas=(DATA.seasonings||[]).length;
  const nSea=(DATA.cuts||[]).filter(c=>c.cat==='פירות ים').length;
  const nCheese=(DATA.specials||[]).filter(s=>s.cat==='גבינה').length;
  const stat=(n,l)=>`<div class="ab-stat"><div class="ab-n">${n}</div><div class="ab-l" data-mt>${l}</div></div>`;
  const feat=(ic,t,b)=>`<div class="ab-feat"><div class="ab-fico">${ic}</div><div><h4 data-mt>${t}</h4><p data-mt>${b}</p></div></div>`;
  const tool=(ic,t,b)=>`<div class="ab-tool"><div class="ab-tico">${ic}</div><h5 data-mt>${t}</h5><p data-mt>${b}</p></div>`;
  const fact=(v,k,d)=>`<div class="ab-fact"><div class="ab-fv">${v}</div><div class="ab-fk" data-mt>${k}</div><div class="ab-fd" data-mt>${d}</div></div>`;
  const cats=['בקר','טלה','חזיר','עוף','הודו','דג','איברים פנימיים','ירקות','פירות','נקניקיות','נקניק מעושן','פסטרמה','שווארמה','סלומי','BBQ קלאסי','פירות ים','גבינה','דג מעושן','בשר מיובש','ברווז','אווז','נקניק מיובש','בייקון'];
  const html=`${toolTop('מתכונת · מדריך האש','כל היכולות והמדע מאחורי האפליקציה','🔥','#e07a52')}
   <div class="panel-body ab-body">
     <p class="ab-thesis" data-mt>בישול מדויק מתחיל בעברית. אפליקציה אחת ל<b>סו-ויד</b>, <b>עישון</b>, <b>גריל</b> ו<b>שרקוטרי</b> — מבשר, דגים ופירות-ים ועד גבינות וירקות, מהחומר-גלם ועד הצלחת.</p>

     <div class="ab-eyebrow" data-mt>הרעיון</div>
     <h3 class="ab-h" data-mt>כל בישול הוא טמפרטורה × זמן</h3>
     <p class="ab-p" data-mt>המדריך נבנה סביב התובנה הזו: לכל פריט יש כמה דרכים — <b>סו-ויד + עישון</b> שחוסך שעות ליד המעשנת, <b>עישון בלבד</b> לטעם עמוק, או <b>גריל / אש ישירה</b> לצומח. כל מתכון נותן את כולן, עם זמנים, טמפרטורות, בורר <b>מידת-עשייה</b> מדויק לכל סועד, ובורר <b>תיבול</b> — ראב, מרינדה, רוטב או גלייז מתוך מאגר של ${nSeas} מתכוני מתבלים.</p>
     <div class="ab-stats">${stat(nTotal,'נתחים ופריטים')}${stat('25','קטגוריות')}${stat(nMakes,'בנייות מאפס')}${stat('56','בוררי מידת-עשייה')}</div>

     <div class="ab-eyebrow" data-mt>הספרייה</div>
     <h3 class="ab-h" data-mt>מבשר ועד תאנים על האש — ספרייה שלמה</h3>
     <p class="ab-p" data-mt>${nTotal} פריטים ב-25 קטגוריות: בשר בקר, טלה וחזיר, עוף, הודו, ברווז ואווז, דגים ו<b>${nSea} פירות-ים</b> (שרימפס, סרטן, קלמארי, צדפות), <b>איברים פנימיים</b> (לב, כבד, שקדים), ו<b>ירקות ופירות</b> על הגריל, בעישון ובסו-ויד. ועוד ${nSpec} מוצרים מיוחדים — בהם <b>${nCheese} גבינות</b> — ו-${nMakes} מתכוני בנייה-מאפס: נקניקים, פסטרמות, שווארמות, סלומי, דגים מעושנים וקלאסיקות BBQ.</p>
     <div class="ab-cats">${cats.map(c=>`<span class="ab-cat">${t(c)}</span>`).join('')}</div>
     ${feat('🎯','שיטה מדויקת לכל פריט','סו-ויד+עישון, עישון בלבד, וגריל/אש-ישירה לצומח — עם צ׳קליסט, טיימרים וסרגל התקדמות.')}
     ${feat('🥩','מידת עשייה מבוססת-מחקר','בורר נא→עשוי ל-56 נתחים, עם טמפ׳ מדויקת לכל סועד — סולם נפרד לבקר, עוף, דג, פירות-ים ואיברים.')}
     ${feat('🧮','מחשבונים ונתוני גלם','מחשבון כמויות לפי סוג מנה (בשר/דג/פירות-ים/גבינה/ירקות/קינוח), מחשבון מלח/Cure ותמלחת שיווי-משקל, וכל הטמפרטורות והזמנים.')}
     ${feat('🔧','הציוד שלי — מתכונים שמתאימים אליך','הגדר מה יש לך (מעשנה/גריל/סו-ויד/ואקום/מטחנה/מילוי/משקל ועוד). שיטות ללא ציוד מסומנות עם חלופה מיידית והצעת רכישה, טיפים לפי סוג המעשנה, וברירת-מחדל חכמה.')}

     <div class="ab-eyebrow" data-mt>טעם ודלק</div>
     <h3 class="ab-h" data-mt>התיבול והאש — לא מחשבה שאחרי</h3>
     ${feat('🧂',`${nSeas} מתכוני מתבלים לפי מדינות`,'ראב, מרינדה, רוטב וגלייז מכל העולם — קנזס-סיטי, קרוליינה, בולגוגי, יקיטורי, צ׳ימיצ׳ורי, ג׳רק, שרמולה, טום, סחוג, אל-פסטור, צ׳אר-סיו ועוד — עם מרכיבים והוראות הכנה, מסונן לפי מדינה, ונבחר בתוך המתכון.')}
     ${feat('🔥','מדריך 15 סוגי פחם — והיכן לקנות בישראל','קברצ׳ו לבן ואדום, מרבו, גואייקן, בינשוטן, קוקוס, היקורי, מסקיט, הדרים ועוד — עם חום, זמן בערה, פרופיל עשן, וספק ישראלי לכל סוג (חזן גחלים, פחם, BBQ\'NMORE, קוקו גריל ועוד).')}
     ${feat('🛒','מזווה — מחסן רכיבים + קניות חכמות','עוקב אחרי פרויקטים (ייבוש/כבישה), ומשמש כמחסן רכיבים: מייצרים מאפס או קונים מוכן ומאחסנים, מוסיפים שלב סיום (עישון לגבינה קנויה), וכשמגיע המועד מגשרים ישירות לאירוע/בישול — הפריט נכנס לתוכנית כ"רק סיום" או "מוכן להגשה". כולל 24 חומרי-גלם ומעקב מלאי.')}
     ${feat('✡️','כשרות','כל פריט מסומן (כשר · לא כשר · חלבי), עם סינון "כשר בלבד" לקטלוג ולאירוע.')}

     <div class="ab-eyebrow" data-mt>מלאכות מאפס</div>
     <h3 class="ab-h" data-mt>נקניקים, קבב וגבינות — מאפס עד הצלחת</h3>
     ${feat('🍖',`בנייה מאפס — ${nMakes} מלאכות`,'טחינה→תיבול→קישור→מילוי→בישול, שלב-אחר-שלב עם טיימרים. הבורר מקוטלג לפי סוג, מדינה ויבשת (🇩🇪🇮🇹🇫🇷), עם תיאור מלא לכל פריט — נקניקיות, קבב, שווארמה, פסטרמה, סלומי, דגים מעושנים וגבינות.')}
     ${feat('🌡️','בישול נכון לכל נקניק','טמפ׳-יעד פנימית לכל מתכון (71° לבשר, 74° לעוף), עם פוץ׳ עדין / סו-ויד / גריל לפי עובי — והדקיקות (מרגז) בגריל מהיר כמסורתי. כולל הנחיות אחסון והכנה-מראש לכל נקניקייה טרייה.')}
     ${feat('🔪','שלוש דרכים לכל מלאכה','לכל פריט בתוכנית: "מוכן לגמרי" · "הוכן מראש — רק סיום" · "מאפס היום". מייצרים ומאחסנים במועד אחד, מסיימים ומגישים באחר — הפיצול אוטומטי בגבול היישון.')}
     ${feat('🍔','בונה בורגר לכל סועד','מידת-עשייה, גבינה (מעל / ממולא Juicy Lucy), תוספות, רוטב ולחמנייה — אישית לכל סועד. תוכנית העבודה מקבצת קציצות לפי מידה ומרכיבה אישית בהגשה.')}

     <div class="ab-eyebrow" data-mt>בינה מלאכותית · מפתח אישי</div>
     <h3 class="ab-h" data-mt>7 יכולות AI — מעוגנות בקטלוג, בטיחות מהאפליקציה</h3>
     <p class="ab-p" data-mt>חבר מפתח <b>Gemini</b> אישי (חינם, נשמר רק במכשירך) ותקבל שכבת-AI חכמה. עיקרון-על: ה-AI בוחר <b>אך ורק מתוך הקטלוג</b> — לעולם לא ממציא פריטים, ו<b>מספרי הבטיחות (מלח/ריפוי/טמפ׳) מגיעים תמיד מהאפליקציה</b>, לא מה-AI. הכל אופציונלי — בלי מפתח, הכל עובד עם מנועים מקומיים.</p>
     ${feat('🎉','מתכנן אירוע בשפה חופשית','"מנגל בשרי ל-10 בלי חזיר" → תפריט מאוזן שנטען לאשף. עם הגנת-כשרות כפולה: פריט לא-כשר נזרק באפליקציה גם אם ה-AI הציע אותו.')}
     ${feat('🍳','מה אפשר להכין ממה שיש','מצליב את חומרי-המדף במזווה והציוד שלך מול המתכונים — "אפשר עכשיו" מול "כמעט, חסר מעט". עובד גם בלי מפתח (חישוב מקומי).')}
     ${feat('🗓️','יועץ תזמון (תכנון-אחורה)','בחר תאריך-יעד → מה להתחיל ומתי. משכי-הייצור מחושבים מנתוני האפליקציה; ה-AI מנמק ובוחר, אבל התאריכים תמיד מהאפליקציה.')}
     ${feat('🧂','תיבול מותאם-פריט','ה-AI בוחר 3-5 מתבלים מתוך המאגר המתאימים לנתח והשיטה, עם הסבר לכל אחד — נשמר למופע בלי לשנות את התבנית.')}
     ${feat('🩺','אבחון תקלה אישי','תאר תקלה → אבחון שמתחשב ביומן ובפרויקטים שלך, עם קישור לפתרונות המאומתים באפליקציה (הטקסט תמיד הסמכותי, לא מ-AI).')}
     ${feat('✨','מחולל מתכונים → פרויקט','תאר מתכון (נקניקיה/מעושן/מיובש/שווארמה/קבב) → מתכון-בנייה חדש שנשמר ונהפך לפרויקט. מסומן "לא-מאומת בטיחות", ומספרי המלח/ריפוי מ-presets בטוחים של האפליקציה.')}
     ${feat('📊','תובנות יומן','ניתוח היסטוריית הבישולים שלך — דפוסים והצעות שיפור, מעוגן ברשומות האמיתיות בלבד.')}
     ${feat('🎙️','ממשק קולי דו-לשוני עם AI','ליד המעשנת: שאל שאלות חופשיות בקול, בעברית או באנגלית (זיהוי מדויק יותר) — אפשר לשאול באנגלית ולקבל תשובה בעברית, בהקראה ובכתב, מעוגן בשלב הבישול הנוכחי.')}

     <div class="ab-eyebrow" data-mt>הכלים</div>
     <h3 class="ab-h" data-mt>לא רק מתכונים — מערכת לניהול בישול</h3>
     <div class="ab-tools">
       ${tool('⭐','מועדפים','שמירה וסינון מהיר של המתכונים שחוזרים אליהם.')}
       ${tool('🕒','מתזמן ציר-זמן','שעת הגשה → מתי להתחיל כל פריט, עם התראות בזמן אמת.')}
       ${tool('✡️','כשרות ותחליפים','תיוג כשר/חלבי והצעת תחליף כשר אוטומטית.')}
       ${tool('🔎','סינון וגילוי','לפי שיטה, קושי, זמן וכשרות — וחיפוש לפי מצרך.')}
       ${tool('📝','הערות ודירוג','תיעוד אישי וכוכבים לכל מתכון.')}
       ${tool('🧫','פרויקטים ומזווה','מעקב ייבוש/כבישה/מאפס מול יעד, מזווה כמחסן רכיבים (מייצרים או קונים → מאחסנים → מסיימים → מגשרים לאירוע), וקניות אוטומטיות.')}
       ${tool('⏰','תזכורות','אבני-דרך רב-יומיות, אוטומטיות מהמזווה.')}
       ${tool('🆘','מצב הצילו','אבחון ופתרון 41 תקלות ב-9 נושאים + אבחון-AI אישי מהיומן.')}
       ${tool('🔥','שאל את האש','עוזר בישול חכם: מנוע מקומי (זמן/טמפ׳/עץ/כמות/כשרות) + מצב AI אופציונלי (Gemini, מפתח אישי) עם חיפוש באינטרנט — עונה גם על היכן לקנות, מחירים וספקים.')}
       ${tool('🧂','מתבלים ורטבים',`${nSeas} מתכוני ראב · מרינדה · רוטב · גלייז לפי מדינות.`)}
       ${tool('🥩','מתרגם נתחים','בשר, דגים, פירות ים וגבינות — שמות ישראליים ופתק לקצב.')}
       ${tool('🪵','עצים ופחמים','התאמת עץ ופחם לבשר לפי עוצמת עשן.')}
       ${tool('🎉','אשף אירוע (6 שלבים)','סועדים, מנות, תיבול, תוספות, 40 משקאות וקינוחים (כולל פירות עונתיים) → תפריט, כמויות מדויקות, קניות ותוכנית.')}
       ${tool('📓','יומן בישולים','היסטוריה אישית עם טמפ׳, דירוג ותמונה.')}
       ${tool('🛒','רשימת קניות','מאוחדת לפי קבוצות, מסומנת וניתנת להדפסה.')}
       ${tool('💾','גיבוי ושחזור','ייצוא וייבוא כל הנתונים שלך לקובץ.')}
     </div>

     <div class="ab-eyebrow" data-mt>המדע</div>
     <h3 class="ab-h" data-mt>מדויק במקום שזה חשוב — בטיחות</h3>
     <p class="ab-p" data-mt>המתכונים מעוגנים במקורות מקצועיים (USDA/FSIS, Douglas Baldwin, AmazingRibs). המספרים אינם קישוט — הם ההבדל בין מוצר בטוח ללא-בטוח.</p>
     <div class="ab-facts">
       ${fact('≤5.3','pH בהתססה','מחסום הבטיחות הראשון בנקניק מיובש.')}
       ${fact('120<small>ppm</small>','ניטריט בבייקון','תקן USDA — נמוך מ-156 הרגיל.')}
       ${fact('×0.62','משקל יעד','ירידת 35–40% = מוכנות אמיתית, לא זמן.')}
       ${fact('0.85','פעילות מים (Aw)','הסף שמתחתיו חיידקים לא משגשגים.')}
     </div>
     <p class="ab-p" data-mt>ועוד: פסטור לפי זמן×טמפ׳ ממרכז הנתח, "כלל 4 השעות", הקפאת דג מפני טפילים, פריצת הסטָאל ב-Texas Crutch, גבינות ב-≤25°C, ובילטונג בייבוש חם — לא קר. לאיברים: כבד וכליות עד-סוף, לב חם-ומהיר כמו סטייק. לצומח אין בטיחות-פנים — רק שליטה במרקם.</p>

     <div class="ab-eyebrow" data-mt>איך זה בנוי</div>
     <h3 class="ab-h" data-mt>קובץ אחד. בלי שרת. הנתונים שלך נשארים אצלך.</h3>
     ${feat('📦','עצמאי לחלוטין','HTML יחיד שרץ בכל דפדפן — בלי התקנה, בלי חשבון, בלי שרת.')}
     ${feat('📲','מותקן כאפליקציה','אייקון אש על מסך הבית, פתיחה במסך מלא — PWA אמיתי.')}
     ${feat('🔒','פרטי כברירת מחדל','מועדפים, יומן, מזווה והערות נשמרים מקומית במכשיר בלבד — עם ייצוא/ייבוא.')}
     ${feat('⎙','הדפסה ל-PDF','כל מתכון, תפריט, לוח-זמנים או רשימה — מודפסים נקי בלחיצה.')}
     ${feat('♿','נגיש ו-RTL','עברית-first, ניווט מקלדת, מלכודת-מיקוד, וכיבוד reduced-motion.')}

     <div class="ab-eyebrow" data-mt>לאן זה הולך</div>
     <h3 class="ab-h" data-mt>מהמדריך אל מתכונת המלאה</h3>
     <div class="ab-road">
       <div class="ab-step now" data-mt><span class="ab-ph">עכשיו</span><b>מדריך האש + שכבת AI</b> — ${nTotal} פריטים, ${nMakes} בנייות-מאפס, מידות-עשייה מבוססות-מחקר, 7 יכולות AI וממשק קולי דו-לשוני.</div>
       <div class="ab-step" data-mt><span class="ab-ph">הבא</span><b>אופליין מלא</b> — עבודה גם בלי רשת, פונטים מקומיים, ותזכורות-רקע.</div>
       <div class="ab-step" data-mt><span class="ab-ph">החזון</span><b>מתכונת בענן</b> — חשבונות, סנכרון בין מכשירים, והרחבת שכבת ה-AI.</div>
     </div>

     <div class="ab-credits">
       <div class="ab-mk">${L('מתכונת','Matkonet')} · <span>${L('האש','Fire')}</span></div>
       <p data-mt>בישול מדויק, בעברית. מבשר ועד ירקות — מהחומר-גלם ועד הצלחת.</p>
       <div class="ab-by">${L('פותח ועוצב על-ידי','Developed and designed by')} <b>${L('דודי בר-און','Dudi Bar-On')}</b><br><a href="mailto:dudi.bar.on@gmail.com">dudi.bar.on@gmail.com</a></div>
       <div class="ab-ver" id="abVer"></div>
     </div>
   </div>`;
  showPanel(html);
  const fs=document.querySelector('.foot-stamp'); const v=$("#abVer"); if(v&&fs) v.textContent=fs.textContent||'';
}

// how-to usage guide (distinct from the SOS/troubleshooting panel)
function openGuide(){
  const sec=(ic,title,body)=>`<div class="guide-sec"><h4>${ic} <span data-mt>${title}</span></h4><div class="guide-body" data-mt>${body}</div></div>`;
  const html=`${toolTop(L('איך משתמשים','How to use'),L('מדריך מהיר למסלולים ולכלים','A quick guide to the paths and tools'),'❓','#c77a3a')}
   <div class="panel-body">
   <p class="guide-intro" data-mt>מתכונת · מדריך האש בנוי סביב <b>שלושה מסלולים</b>. בחר לפי מה שאתה צריך עכשיו:</p>
   ${sec('🎉','יש לי אירוע','תכנון ארוחה מרובת-מנות. אשף בן 6 שלבים: סועדים ותיאבון, מנות מהקטלוג, תיבול לכל מנה, תוספות, 40 משקאות (כולל חריפים וקוקטיילים) וקינוחים (אש, קלאסיקות ומגש פירות עונתי לפי תאריך האירוע) → תפריט, כמויות מחושבות לכל פריט, רשימת קניות ותוכנית עבודה. אפשר לשמור ולנהל כמה אירועים.')}
   ${sec('🍳','בא לי לבשל משהו','מסלול מהיר לפריט בודד. נכנס ישר לקטלוג — בוחר נתח/מוצר, ומקבל מתכון מלא: טמפ׳ וזמן, בורר מידת-עשייה לכל סועד, בורר תיבול (ראב/מרינדה/רוטב/גלייז), ורשימת קניות ספציפית למתכון.')}
   ${sec('🧫','פרויקט מתקדם','לתהליכים ארוכים — ייבוש, ריפוי, התססה. מעקב אחרי שלבים, משקל-יעד מול משקל נוכחי, ופס התקדמות. כאן נמצא גם <b>המזווה</b>: חומרי גלם (שרוולים, מלחי ריפוי, תבלינים, עצים) עם מעקב מלאי ורשימת קניות אוטומטית למה שחסר.')}
   ${sec('📚','הקטלוג','279 פריטים ב-25 קטגוריות. בדף הקטלוג: אריחי-קטגוריות לניווט, סינון לפי תת-קטגוריה, חיפוש חופשי, ⭐ מועדפים, ומסנן <b>"כשר בלבד"</b>. כל פריט מסומן בכשרות (כשר/לא כשר/חלבי).')}
   ${sec('🧂','תיבול חכם — תבנית ↔ מופע','289 מתכוני ראב · מרינדה · גלייז · רוטב מרחבי העולם, עם מקור, מרכיבים והוראות. לכל מתכון "ראב בית" מובנה שנבחר כברירת מחדל, והתאמה אישית נעשית בביצוע — באשף האירוע, בתוכנית העבודה או בפרויקט — ונשמרת לאותו הקשר בלבד (אירוע/בישול/פרויקט), כך שהמתכון בקטלוג תמיד נשאר נקי. בורר עם 5 צירי סינון: מומלצים, מדינה, גוון-טעם, בסיס וחריפות.')}
   ${sec('🔥','עצים ופחמים','מדריך 15 סוגי פחם (קברצ׳ו, מרבו, בינשוטן, קוקוס, הדרים ועוד) — עם חום, זמן בערה, פרופיל עשן, והיכן לקנות בישראל. נגיש מתפריט ☰ ← "סוגי עץ".')}
   ${sec('🔥','שאל את האש','עוזר בישול שעונה על זמן, טמפ׳, עץ, כמות, כשרות ותקלות. שני מצבים: <b>מנוע מקומי</b> (מיידי, אופליין) או <b>AI חכם</b> (Gemini) עם חיפוש באינטרנט — עונה גם על איפה לקנות פחם/ציוד, מחירים וספקים, ותומך בשאלות המשך. כל תשובה מסומנת במקורה. נגיש בכפתור בולט בראש דף הבית.')}${sec('🆘','נתקעת?','ב-☰ ← "מצב הצילו (תקלות)": 41 פתרונות ב-9 נושאים מתקפלים (אש/עשן, בשר, נקניקים, ייבוש, גבינות, דגים, צומח, בטיחות) + חיפוש.')}
   <p class="guide-foot" data-mt>טיפ: כל בחירה שאתה עושה (מועדפים, מידת-עשייה, תיבול, מלאי) נשמרת אוטומטית במכשיר שלך.</p>
   <button class="guide-about-link" id="cGuideAbout">ℹ️ ${L('אודות — כל היכולות והמדע מאחורי האפליקציה ←','About — all the capabilities and science behind the app →')}</button>
   </div>`;
  showPanel(html);
  const ga=$("#cGuideAbout"); if(ga) ga.addEventListener('click',()=>{ if(typeof closePanel==='function') closePanel(); setTimeout(openAbout,60); });
}
function openHelp(){
  const total=TROUBLE_GROUPS.reduce((n,g)=>n+g.items.length,0);
  const groupHTML=TROUBLE_GROUPS.map((grp,gi)=>{
    const items=grp.items.map((tt,i)=>`<div class="acc"><button class="acc-q" data-acc="${gi}-${i}"><span data-mt>${tt[0]}</span> <span>+</span></button><div class="acc-a" id="acc-${gi}-${i}" data-mt>${tt[1]}</div></div>`).join("");
    return `<div class="trouble-grp"><button class="tg-head" data-tg="${gi}"><span>${grp.ic} <span data-mt>${grp.g}</span></span><span class="tg-n">${grp.items.length} <b class="tg-chev">▾</b></span></button><div class="tg-body" id="tg-${gi}" hidden>${items}</div></div>`;
  }).join("");
  showPanel(`${toolTop(L('מצב הצילו','Rescue mode'),L('אבחון ופתרון תקלות — לפי נושא','Diagnose & fix problems — by topic'),'🆘','#a8392f')}
   <div class="panel-body">
     <div class="trouble-search"><span class="ic">⌕</span><input id="tSearch" placeholder="${L('חפש תקלה — עשן מר, שומן נמרח, pH, יבש…','Search a problem — bitter smoke, fat smear, pH, dry…')}"></div>
     ${(typeof aiAvail==='function'&&aiAvail())?`<button class="ccta" id="tAiDiag" style="margin:10px 0;background:var(--fresh);border-color:var(--fresh)">✨ ${L('אבחון אישי עם AI','Personal AI diagnosis')}</button>`:''}
     <p class="section-sub" style="margin:2px 0 12px">${total} ${L('פתרונות ב-','solutions in ')}${TROUBLE_GROUPS.length} ${L('נושאים · הקש נושא לפתיחה','topics · tap a topic to open')}</p>
     <div id="tGroups">${groupHTML}</div>
     <div id="tResults" hidden></div>
   </div>`);
  const pnl=$("#panel");
  const adb=$("#tAiDiag"); if(adb) adb.addEventListener('click',openDiagnoseAI);
  // toggle a topic group
  pnl.querySelectorAll('[data-tg]').forEach(b=>b.addEventListener('click',()=>{
    const body=$("#tg-"+b.dataset.tg); const chev=b.querySelector('.tg-chev');
    const opening=body.hasAttribute('hidden');
    if(opening){body.removeAttribute('hidden');chev.textContent='▴';} else {body.setAttribute('hidden','');chev.textContent='▾';}
  }));
  // accordion within groups
  const wireAcc=(root)=>root.querySelectorAll('[data-acc]').forEach(b=>b.addEventListener('click',()=>{
    const a=$("#acc-"+b.dataset.acc); const open=a.style.maxHeight; a.style.maxHeight=open?'':a.scrollHeight+'px';
    b.querySelector('span').textContent=open?'+':'−';
  }));
  wireAcc(pnl);
  // search across all groups
  const si=$("#tSearch"), groups=$("#tGroups"), results=$("#tResults");
  si.addEventListener('input',()=>{
    const q=si.value.trim().toLowerCase();
    if(!q){ results.hidden=true; groups.hidden=false; return; }
    const hits=[]; TROUBLE_GROUPS.forEach(g=>g.items.forEach(t=>{ if((t[0]+' '+t[1]+' '+g.g).toLowerCase().includes(q)) hits.push([g,t]); }));
    groups.hidden=true; results.hidden=false;
    results.innerHTML = hits.length
      ? hits.map((h,i)=>`<div class="acc"><button class="acc-q" data-racc="${i}">${h[1][0]} <span class="tg-tag">${h[0].ic}</span> <span>+</span></button><div class="acc-a" id="racc-${i}">${h[1][1]}</div></div>`).join("")
      : '<p class="section-sub" style="text-align:center;padding:20px">לא נמצאה תקלה תואמת. נסה מילה אחרת (למשל "עשן", "יבש", "עובש").</p>';
    results.querySelectorAll('[data-racc]').forEach(b=>b.addEventListener('click',()=>{
      const a=$("#racc-"+b.dataset.racc); const open=a.style.maxHeight; a.style.maxHeight=open?'':a.scrollHeight+'px';
      b.querySelector('span:last-child').textContent=open?'+':'−';
    }));
  });
}

/* ---- Ask the Fire (smart local intent engine — offline, over app data) ---- */
function askAllItems(){ return [...DATA.cuts.map(metaCut),...DATA.specials.map(metaSpec),...Object.entries(DATA.makes).map(([id,m])=>metaMake(id,m))]; }
const ASK_STOP=new Set(['מה','כמה','איזה','איזו','האם','של','עם','זה','זו','את','על','לי','יש','אני','צריך','רוצה','מתי','למה','איך','כדי','בשביל','טוב','הכי','או','גם','לא','כן','מידת','העשייה','עשייה','בין','לעומת','טמפ','זמן','חום','עץ','תיבול','בטיחות','כשר','כשרות']);
function askStrip(w){ return w.replace(/^(ל|ה|ב|ו|מ|ש|כ|לה|וה|מה|שה|כה)/,''); } // strip common Hebrew prefixes
function askFindEntity(q){
  const all=askAllItems();
  // 1) direct: query contains full item name (with or without prefix), or english first word
  let hits=all.filter(m=>q.includes(m.heb)||('ל'+m.heb!==q&&q.includes(m.heb))|| (m.eng&&m.eng.length>3&&q.includes(m.eng.toLowerCase().split(' ')[0])));
  if(hits.length) return hits.sort((a,b)=>b.heb.length-a.heb.length);
  // 2) token match with prefix-strip + stopword filter; require a meaningful (>=4 char) shared token
  const toks=q.split(/[\s,?.!"'׳״]+/).map(askStrip).filter(w=>w.length>=3 && !ASK_STOP.has(w));
  const score=m=>{ let best=0; toks.forEach(t=>{ const words=m.heb.split(/\s+/); words.forEach(w=>{ const ws=askStrip(w); if((ws.includes(t)||t.includes(ws)) && Math.min(ws.length,t.length)>=3){ best=Math.max(best,Math.min(ws.length,t.length)); } }); }); return best; };
  hits=all.map(m=>[m,score(m)]).filter(x=>x[1]>=4).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  return hits;
}
function askCutTimes(c){
  const parts=[];
  if(c.sot) parts.push(`עישון בלבד: ~${c.soh}ש ב-${c.sot}°C`);
  if(c.svt) parts.push(`סו-ויד: ${c.svh}ש ב-${c.svt}°C`);
  if(c.smt) parts.push(`ואז עישון: ~${c.smh}ש ב-${c.smt}°C`);
  return parts;
}
function askFire(qRaw){
  const q=(qRaw||'').trim().toLowerCase(); if(!q) return '';
  const has=(...ks)=>ks.some(k=>q.includes(k));
  const ents=askFindEntity(q);
  const e=ents[0];
  const link=m=>({key:m.key,heb:m.heb,cat:m.cat});
  const openItem=m=>{const it=resolveItem(m.key); if(!it)return; it.kind==='cut'?openCut(it.obj):it.kind==='spec'?openSpec(it.obj):openMake(it.key.slice(5));};

  // ---- tool routers ----
  if(has('מלח','cure','ריפוי','ניטריט','כמה מלח')) return {t:'למינון מלח/ריפוי מדויק (Cure #1/#2, ppm, אחוזים) — פותח את מחשבון המלח.',act:openCalc};
  if(has('פחם','גחלים','קברצ','מרבו','בינשוטן','קוקוס','charcoal')) return {t:'להשוואת סוגי פחם, חום, זמן בערה והיכן לקנות בישראל — פותח את מדריך העצים והפחמים.',act:openWoods};
  if(has('תקוע','stall','מר','מריר','נמרח','smear','עובש','יבש','נסדק','case','ph','מלוכלך','נמס','case hardening')) return {t:'נשמע כמו תקלה — פותח את "מצב הצילו" לאבחון ופתרון.',act:openHelp};

  // ---- kosher ----
  if(has('כשר','כשרות','טרף','חלבי')){
    if(e){ const k=kosherStatus(e.key); const lbl=kosherLabel(k);
      let extra=''; if(k==='pork'||k==='shellfish'){ const sub=(typeof kosherSub==='function')?kosherSub(e.key):null; extra=sub?` תחליף כשר: ${sub}.`:' אפשר לבחור מקביל כשר מהקטלוג.'; }
      return {t:`<b>${e.heb}</b>: ${lbl}.${extra}`,chips:[link(e)]}; }
    return {t:'לאיזה פריט? כתוב את שמו (למשל "האם שרימפס כשר"), או השתמש במסנן "כשר בלבד" בקטלוג.'};
  }

  // ---- quantity ----
  const ppl=(q.match(/(\d+)\s*(אנשים|סועד|איש|נפש|מוזמנ)/)||[])[1] || (has('כמה בשר','כמה לקנות','כמות','מנה','מנות')? (q.match(/(\d+)/)||[])[1] : null);
  if(ppl && has('בשר','לקנות','כמה','כמות','מנה','מנות','אנשים','סועד')){
    const n=+ppl; const main=Math.round(n*0.35*10)/10, mix=Math.round(n*0.5*10)/10;
    return {t:`ל-<b>${n} סועדים</b> (הערכה): מנה עיקרית בשרית ~<b>${main} ק״ג</b> (350 ג׳/סועד), ובאירוע עם מגוון בשרים ותוספות ~${mix} ק״ג סה״כ. לכמות מדויקת לפי מנה — פתח את "בונה הארוחה".`,act:(typeof openBuilder==='function'?openBuilder:null)};
  }

  // ---- entity-based answers ----
  if(e && e.kind==='cut'){
    const c=e.obj;
    if(has('כמה זמן','זמן','משך','שעות','לעשן כמה','כמה לעשן','כמה שעות')){
      const t=askCutTimes(c); return {t:`<b>${c.heb}</b> — זמנים: ${t.join(' · ')}. יעד פנימי ${donenessTarget(c)}°C. הזמן תלוי-עובי ולא רק משקל — עבוד לפי טמפ׳ פנימית.`,chips:[link(e)]};
    }
    if(has('טמפ','חום','מעלות','°','degrees')){
      return {t:`<b>${c.heb}</b>: יעד פנימי ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''}. ${c.svt?`סו-ויד ${c.svt}°C · `:''}${c.smt?`עישון ${c.smt}°C · `:''}${c.sot?`עישון-בלבד ${c.sot}°C`:''}.`,chips:[link(e)]};
    }
    if(has('מידת','נא','מדיום','עשוי','rare','medium','done')){
      if(c.doneness){ const lv=c.doneness.levels; const list=Object.keys(lv).map(k=>`${lv[k].heb||k} ${lv[k].c}°C`).join(' · '); return {t:`<b>${c.heb}</b> — מידות עשייה: ${list}. בחר מידה במתכון והטמפ׳ מתעדכנת.`,chips:[link(e)]}; }
      return {t:`<b>${c.heb}</b>: יעד ${c.tgt}°C (אין סקאלת מידות עשייה לנתח זה — נתח שדורש בישול-מלא).`,chips:[link(e)]};
    }
    if(has('עץ','עצים','wood','לעשן עם','איזה עץ')){
      return {t:`<b>${c.heb}</b> — עץ מומלץ: <b>${c.wood||'אלון/היקורי'}</b>.${c.coal?` פחם: ${c.coal}.`:''} לפרטים על עוצמת עשן — מדריך העצים.`,chips:[link(e)],act:()=>openWoods(c.cat)};
    }
    if(has('תיבול','ראב','מרינד','רוטב','גלייז','לתבל','rub','season')){
      const s=(typeof seasoningsFor==='function')?seasoningsFor(c.cat,isProduce(c)).slice(0,6):[];
      return {t:`<b>${c.heb}</b> — ראב מובנה: ${c.rub||'מלח+פלפל'}. ${s.length?'תיבולים מתאימים נוספים (נבחרים בתוך המתכון):':'פתח את המתכון לבורר התיבול המלא.'}`,chips:[link(e)]};
    }
    if(has('בטיח','פסטור','בטוח','safe','טפיל')){
      return {t:`<b>${c.heb}</b>: טמפ׳ בטיחות ${c.safe||63}°C. זכור — בטיחות היא זמן×טמפ׳ במרכז הנתח, לא רק המספר. סו-ויד מנצל זאת (טמפ׳ נמוכה יותר לאורך זמן).${/דג|סלמון|טונה|פורל/.test(c.heb)?' לדג נא/חלקי — הקפאה מוקדמת נגד טפילים.':''}`,chips:[link(e)]};
    }
    if(has('איך','שיטה','סו-ויד','עישון','גריל','method')){
      const t=askCutTimes(c); return {t:`<b>${c.heb}</b> — שיטות: ${t.join(' · ')}. יעד ${donenessTarget(c)}°C. פתח את המתכון לצ׳קליסט וטיימרים.`,chips:[link(e)]};
    }
    // default: recipe summary
    const t=askCutTimes(c); return {t:`<b>${c.heb}</b> (${c.cat}): ${t.join(' · ')}. יעד ${donenessTarget(c)}°C${c.safe?` · בטיחות ${c.safe}°C`:''} · עץ ${c.wood||'—'}.`,chips:[link(e)]};
  }
  if(e && e.kind==='spec'){
    const s=e.obj;
    return {t:`<b>${s.heb}</b> (${s.cat}): ${s.cure?`ריפוי ${s.cure} · `:''}${s.smt?`עישון ${s.smt}°C/${s.smh}ש · `:''}${s.age?`יישון ${s.age} · `:''}עץ ${s.wood||'—'}.${s.note?` ${s.note}`:''}`,chips:[link(e)]};
  }
  if(e && e.kind==='make'){
    return {t:`<b>${e.heb}</b> — מתכון בנייה-מאפס. פתח לרשימת חומרים, מינון מלח/ריפוי ושלבים.`,chips:[link(e)]};
  }

  // ---- multiple weak matches ----
  if(ents.length){ return {t:`לא בטוח למה התכוונת. אולי אחד מאלה:`,chips:ents.slice(0,5).map(link)}; }

  // ---- no entity, general knowledge nudges ----
  if(has('הבדל','השוואה','vs','לעומת','מה עדיף')) return {t:'להשוואה — כתוב שני שמות (למשל "בריסקט מול שפונדרה"), או פתח את שני המתכונים מהקטלוג ליד זה מזה.'};
  return {t:'לא מצאתי התאמה. נסה: שם נתח + מה שמעניין ("כמה זמן לעשן צלעות", "טמפ׳ לסלמון", "עץ לחזה"), "כמה בשר ל-10 אנשים", "האם שרימפס כשר", או תיאור תקלה ("עשן מר").'};
}

/* ---- Ask the Fire: AI mode (BYOK Gemini) — optional layer over the local engine ---- */
function askMode(){ const v=store.get('mk-askai'); if(v==='1')return true; if(v==='0')return false; return aiAvail()?true:false; } // default ON when AI is available (personal key OR managed central access)
function setAskMode(on){ store.set('mk-askai', on?'1':'0'); }
// W1-P4: does the question touch a food-safety topic (cure/nitrite/salt%/temp-safety/botulism/pasteurization/mold/ferment/pH/aw)?
function askSafetyIntent(q){
  return /ריפוי|קיור|\bcure\b|ניטריט|nitrite|מלח ורוד|pink salt|כמה מלח|salt\s*%|\bcure\s*#|בוטוליזם|botulism|פסטור|pasteur|עובש|mold|תסיס|ferment|טמפ.*בטוח|safe.*temp|temp.*safe|\bsafe\b.*(eat|chicken|poultry|pork|meat|נתח)|(eat|לאכול|אכול).*(mold|עובש|salami|salami|נקניק|מיובש)|פנים.*°|internal.*temp|water[-\s]*activity|\baw\b|\bpH\b/i.test(String(q||''));
}
// The app's vetted safety anchors + the directive to defer exact doses to the calculator (never invent). Matches the calculator constants.
function SAFETY_FACTS(){
  return 'נתוני בטיחות מאומתים של האפליקציה (השתמש אך ורק במספרים אלה; אם המספר הדרוש אינו כאן — הפנה את המשתמש לפתוח את המחשבון באפליקציה ואל תמציא מספר):\n'
    +'• Cure #1 (מוצרים מבושלים / כבישה קצרה): 2.5 ג׳/ק״ג בשר ≈ 156ppm ניטריט (תקני ובטוח).\n'
    +'• Cure #2: למוצרים מיובשים / לא-מבושלים (סלמי, נקניק יבש) — דיוק המינון קריטי לבטיחות.\n'
    +'• טמפ׳ פנים בטוחות: עוף/הודו 74°C · בשר טחון 71°C · נתח שלם/דג 63°C.\n'
    +'• מוצר יבש / מעושן-קר / יציב-מדף חייב ניטריט (Cure) — היעדרו = סכנת בוטוליזם.\n'
    +'• סלמי מיובש: יעד איבוד משקל ~35% לפני אכילה (קירוב לפעילות-מים בטוחה).\n'
    +'• עובש על בשר מיובש: עובש לבן אחיד ואבקתי תקין; עובש ירוק/שחור/פרוותי — יש להשליך (מיקוטוקסינים), לא לשטוף/לקצוץ ולהמשיך, ולא לאכול.\n'
    +'• תסיסה בטוחה דורשת תרבית-מוצא ובקרת pH; אין לתסוס בטמפ׳ חדר ללא בקרה.\n'
    +'המחשבון של האפליקציה מחשב את המינון המדויק לפי המשקל — הפנה את המשתמש אליו.';
}
function askContextFor(q){
  const ents=askFindEntity((q||'').toLowerCase()).slice(0,3);
  let ctx='';
  if(ents.length){ ctx='נתונים רלוונטיים מהקטלוג של האפליקציה:\n'+ents.map(e=>{const o=e.obj;
    if(e.kind==='cut') return `• ${e.heb} (${e.cat}): סו-ויד ${o.svt}°C/${o.svh}ש · עישון ${o.smt}°C/${o.smh}ש · עישון-בלבד ${o.sot}°C/${o.soh}ש · יעד ${donenessTarget(o)}°C · בטיחות ${o.safe||63}°C · עץ ${o.wood||'-'} · ראב ${o.rub||'-'}${o.doneness?' · מידות: '+Object.entries(o.doneness.levels).map(([k,v])=>(v.heb||k)+' '+v.c+'°C').join('/'):''}`;
    if(e.kind==='spec') return `• ${e.heb} (${e.cat}): ריפוי ${o.cure||'-'} · עישון ${o.smt||'-'}°C/${o.smh||'-'}ש · יישון ${o.age||'-'} · עץ ${o.wood||'-'}${o.note?' · '+o.note:''}`;
    return `• ${e.heb} (${e.cat}): מתכון בנייה-מאפס.`;
  }).join('\n'); }
  // W1-P4: safety questions ALWAYS get the vetted anchors, even with no catalog-item match (closes the "how much Cure #1 for salami?" free-generation hole)
  if(askSafetyIntent(q)) ctx=(ctx?ctx+'\n\n':'')+SAFETY_FACTS();
  return {ctx, ents:ents.map(m=>({key:m.key,heb:m.heb,cat:m.cat}))};
}
// W1-P5: refuse/deflect KNOWN-DANGEROUS intents deterministically — answer from a sourced safety card instead of letting the AI generate.
// Data-driven + extensible: add an entry to refuse another intent. Over-refusing is safe (the cards are advisory + cite sources).
const AI_REFUSALS=[
  { id:'no-nitrite',
    test:function(q){ const s=String(q);
      const dry=/(סלמי|salami|נקניק.?יבש|נקניק מיובש|מיובש|מיושן|dry.?cur|dry.?age|dry.?sausage|dried|air.?dr|shelf.?stable|יציב.?מדף|cold.?smok|עישון.?קר|charcuterie|שרקוטרי|pepperoni|פפרוני|prosciutto|coppa|soppressata|saucisson|כבישה יבשה|cured (meat|sausage|נקניק)|fermented)/i.test(s);
      if(!dry) return false;
      const cure=/(ניטריט|nitrite|מלח ורוד|pink.?salt|cure\s*#?[12]?|curing.?salt|ריפוי|קיור|prague powder|instacure)/i.test(s);
      const omission=/(בלי|ללא|no |without|skip|omit|לוותר|לדלג)/i.test(s);
      const subst=/(instead of|במקום|substitute|replace|celery|סלרי|sea salt|מלח ים|regular salt|מלח רגיל|kosher salt|table salt|מלח שולחן|\bonly\b|\bjust\b|\bרק\b|סתם)/i.test(s);
      const quantity=/(how much|how many|what dose|how many g\b|כמה|מה המינון)/i.test(s);   // a quantity question ("how much nitrite do I need") is legit → grounded answer, not a refusal
      const necessity=!quantity && /(do i (really |even |actually )?need|need i\b|do i have to|must i|is\s+(it|nitrite|cure|pink salt|curing salt)\s*(really |even )?(necessary|required|needed)|really need|even need|האם (צריך|חייב|נחוץ)|חייבים|נחוץ)/i.test(s);
      const onlySalt=!cure && /((just |only |רק |סתם ).{0,15}(salt|מלח))|sea salt|מלח ים|regular salt|מלח רגיל|kosher salt|table salt|מלח שולחן/i.test(s);
      return (cure && (omission||subst||necessity)) || onlySalt;
    },
    he:{title:'ריפוי בלי ניטריט = סכנת בוטוליזם', body:'למוצר מיובש / מעושן-קר / יציב-מדף, הניטריט (Cure #1/#2) אינו רשות — הוא המחסום העיקרי נגד החיידק C. botulinum, שגדל בסביבה נטולת-החמצן של בשר מרוקם ומייצר רעלן (בוטוליזם) שעלול להיות קטלני. מלח ים / אבקת סלרי אינם תחליף בטוח. השתמש במחשבון הריפוי של האפליקציה למינון המדויק.'},
    en:{title:'Curing without nitrite = botulism risk', body:'For dry / cold-smoked / shelf-stable meat, nitrite (Cure #1/#2) is not optional — it is the primary hurdle against the bacterium C. botulinum, which grows in the anaerobic environment of cured meat and produces a potentially fatal toxin (botulism). Sea salt / celery powder is NOT a safe substitute. Use the app cure calculator for the exact, safe dose.'},
    src:'USDA FSIS · Marianski, Home Production of Quality Meats & Sausages', calc:true },
  { id:'poultry-under',
    test:function(q){ const s=String(q);
      const poultry=/(עוף|הודו|chicken|poultry|turkey|duck breast|פרגית)/i.test(s);
      const lowC=/\b(5[0-9]|6[0-2])\s*°?\s*[cC]?\b/.test(s);
      const lowF=/\b(1[0-2][0-9]|13[0-9]|14[0-5])\s*°?\s*[fF]\b/.test(s);
      const cookLow=/(סו.?ויד|sous.?vide|\bsv\b|confit|poach|low.?temp|טמפ.?נמוכ|שעה|hour|\bhr\b|minute|\bmin\b|דקות|overnight|לילה)/i.test(s);
      const rawpink=/(raw|נא|ורוד|pink|undercook|תת.?בישול).{0,18}(chicken|poultry|עוף|הודו)|(chicken|poultry|עוף|הודו).{0,18}(raw|נא|ורוד|pink|undercook|תת.?בישול)/i.test(s);
      return (poultry && (lowC||lowF) && cookLow) || rawpink;
    },
    he:{title:'עוף חייב פסטור בטוח', body:'עוף/הודו חייבים להגיע לפסטור בטוח — 74°C מיידית, או שווה-ערך של זמן-בטמפ׳ (למשל 60°C המוחזק מספיק זמן לפי טבלאות Baldwin). סו-ויד בטמפ׳ נמוכה לזמן קצר מדי אינו מפסטר ומסכן בסלמונלה/קמפילובקטר. בדוק את הטמפ׳ הבטוחה בכרטיס וב-Baldwin.'},
    en:{title:'Poultry needs safe pasteurization', body:'Poultry must reach safe pasteurization — 74°C instantaneous, or an equivalent time-at-temperature (e.g. 60°C held long enough per Baldwin’s tables). Sous-vide at a low temp for too short a time does NOT pasteurize it and risks Salmonella/Campylobacter. Check the card’s safe temp and Baldwin’s tables.'},
    src:'USDA FSIS · Baldwin, Sous-Vide Pasteurization Tables', calc:false },
  { id:'ferment-uncontrolled',
    test:q=>/(תסיס|ferment)/i.test(q) && /(חדר|room|counter|דלפק|warm|חמים|garage|בלי תרבית|ללא תרבית|no starter|without\s+(a\s+)?starter|no culture|without\s+(a\s+)?culture|בלי מוצא|no ph|ללא ph|בלי מד|bactoferm|תרבית)/i.test(q),
    he:{title:'תסיסה ללא בקרה מסוכנת', body:'תסיסת נקניק ללא תרבית-מוצא ובקרת pH מסכנת ברעלן סטפילוקוקוס (S. aureus) ובפתוגנים. תסיסה בטוחה דורשת תרבית מוכחת, טמפ׳ מבוקרת וירידת pH מתחת ל-~5.3 בזמן. עקוב אחר מתכון מאומת.'},
    en:{title:'Uncontrolled fermentation is dangerous', body:'Fermenting sausage without a starter culture and pH control risks Staphylococcus aureus toxin and pathogen growth. Safe fermentation needs a proven starter, a controlled temperature, and a pH drop below ~5.3 in time. Follow a validated recipe.'},
    src:'Marianski · FSIS fermented-products guideline', calc:false },
  { id:'unsafe-mold',
    test:q=>/(עובש|mold)/i.test(q) && /(רחץ|נקה|לשטוף|שטוף|wash|scrub|save|להציל|eat|אכול|לאכול|safe|בסדר|\bok\b|cut.?off|cut it|trim|wipe|brush|scrape|קצוץ|לחתוך|לגרד|המשך|keep.{0,12}(going|drying|eat|it|curing))/i.test(q),
    he:{title:'עובש לא-לבן — יש להשליך', body:'עובש ירוק/שחור/פרוותי על בשר מיובש אינו העובש הלבן הרצוי — הוא עלול לייצר מיקוטוקסינים. אין לשטוף/לקצוץ ולהמשיך, ואין לאכול; יש להשליך את המוצר הפגוע. רק עובש לבן אחיד ואבקתי (או משטח נקי) הוא תקין.'},
    en:{title:'Non-white mold — discard it', body:'Green, black, or fuzzy mold on dry-cured meat is not the good white mold — it can produce mycotoxins. Do not wash/trim it and continue, and do not eat it; discard the affected product. Only even, powdery WHITE mold (or a wiped-clean surface) is normal.'},
    src:'Marianski · charcuterie safety guidance', calc:false },
  { id:'reduce-safety',
    test:function(q){ const s=String(q);
      const cureWord=/(ניטריט|nitrite|ריפוי|\bcure|מלח ורוד|pink.?salt|curing.?salt|קיור)/i.test(s);
      const reduce=/(פחות|הפחת|הורד|חצי|less|lower|reduce|half|cut.?down|instead of|במקום)/i.test(s);   // reduction words only — "what dose/amount" is a legit question, not a reduction
      const timeTemp=/\b(time|זמן|temperature|טמפרטור|how long|כמה זמן)\b/i.test(s);
      const cureDose=cureWord && reduce && !timeTemp;
      const cookLow=/(cook|בשל|צלה|serve|sous.?vide|\bsv\b|pull|finish|pasteur|remove).{0,22}(below|מתחת|under|less than|פחות מ|instead of|במקום).{0,12}(safe|בטוח|\d)/i.test(s);
      return cureDose || cookLow;
    },
    he:{title:'אל תרד מתחת למינון/טמפ׳ הבטוחים', body:'הפחתת ריפוי/ניטריט מתחת למינון המחושב, או בישול מתחת לטמפ׳ הפנים הבטוחה, מסירה את מרווח הבטיחות (בוטוליזם בריפוי; פתוגנים בתת-בישול). המחשבון של האפליקציה מחזיק את המינון המינימלי הבטוח — אל תרד ממנו.'},
    en:{title:'Don’t go below the safe dose / temp', body:'Reducing cure/nitrite below the calculated dose, or cooking below the safe internal temperature, removes the safety margin (botulism for cure; pathogens for undercooking). The app calculator owns the minimum safe dose — don’t go below it.'},
    src:'USDA FSIS · Marianski', calc:true },
];
function askRefuse(q){ q=String(q||''); for(let i=0;i<AI_REFUSALS.length;i++){ try{ if(AI_REFUSALS[i].test(q)) return AI_REFUSALS[i]; }catch(e){} } return null; }
function askRefuseCardHTML(ref){
  const he=(typeof getLang!=='function'||getLang()==='he'); const c=he?ref.he:ref.en;
  return '<div class="abubble ask-refuse"><div class="ai-caveat ai-caveat-strong"><b>🚫 '+esc(c.title)+'</b><br>'+esc(c.body)
    +'<div class="ai-refuse-src">📚 '+esc(ref.src)+'</div>'+(ref.calc?'<button class="ai-calc-link" data-aicalc>🧮 '+(he?'פתח מחשבון':'Open calculator')+'</button>':'')+'</div></div>';
}
// ── centralized Gemini transport (AI #2 timeout · #3 retry/backoff · #9 key-in-header) + the
//    AI #8 endpoint-indirection seam: one place to point at a managed proxy later (monetization seam).
const GEM_HOST='https://generativelanguage.googleapis.com/v1beta/models/';
const GEM_MODEL='gemini-2.5-flash';
function GEM_URL(model){ return GEM_HOST+(model||GEM_MODEL)+':generateContent'; }
async function gemFetch(model, body, opts){
  opts=opts||{};
  // transport: MANAGED (central Worker holds the key, gated by a per-user access code) → BYOK (own key) → off.
  // opts.key forces BYOK (used by askValidateKey to test a raw key). A managed access/quota error falls back to BYOK if a key exists.
  const mode = opts.key ? 'byok' : gemMode();
  if(mode==='off') throw new Error('no-key');
  const url = (mode==='managed') ? (centralUrl()+'/v1beta/models/'+(model||GEM_MODEL)+':generateContent') : GEM_URL(model);
  const headers = (mode==='managed') ? {'Content-Type':'application/json','X-Access-Code':centralCode()} : {'Content-Type':'application/json','x-goog-api-key':(opts.key||gemKey())};
  const timeout=opts.timeout||25000, tries=(opts.retries!=null?opts.retries:1)+1;
  let lastErr;
  for(let i=0;i<tries;i++){
    if(i){ await new Promise(res=>setTimeout(res, 500*Math.pow(2,i-1))); }   // backoff: 500ms, 1s, ...
    const ctl=(typeof AbortController!=='undefined')?new AbortController():null;
    const to=ctl?setTimeout(function(){ try{ctl.abort();}catch(e){} }, timeout):null;
    try{
      const r=await fetch(url, {method:'POST', headers, body:JSON.stringify(body), signal:ctl?ctl.signal:undefined});
      if(to) clearTimeout(to);
      if(r.ok) return r;
      if(mode==='managed' && [401,402,403].indexOf(r.status)>=0 && gemKey()){ return gemFetch(model, body, Object.assign({}, opts, {key:gemKey()})); }   // central code invalid/over-cap → use the user's own key
      if(i<tries-1 && [429,500,502,503,504].indexOf(r.status)>=0){ lastErr=new Error('api-'+r.status); continue; }   // retry only transient statuses
      throw new Error('api-'+r.status);
    }catch(e){ if(to) clearTimeout(to);
      const transient=(e&&e.name==='AbortError')||/networkerror|failed to fetch|load failed/i.test((e&&e.message)||'');
      if(i<tries-1 && transient){ lastErr=e; continue; }
      throw (e&&e.name==='AbortError') ? new Error('timeout') : e;
    }
  }
  throw lastErr||new Error('gem-failed');
}
async function askGemini(qRaw, history){
  if(!aiAvail()) throw new Error('no-key');   // available via a personal key OR managed central access; gemFetch routes the transport
  const q=(qRaw||'').trim();
  const {ctx,ents}=askContextFor(q);
  const he=(typeof getLang!=='function'||getLang()==='he');
  const sys='אתה "האש" — עוזר בישול מומחה לאש, עישון, גריל, סו-ויד ושרקוטרי, בתוך אפליקציה ישראלית בשם "מתכונת · מדריך האש". '+(he?'ענה תמיד בעברית':'Reply ALWAYS in English (the app UI language is English)')+', בצורה מלאה ומועילה — אורך התשובה לפי הצורך, כולל רשימות, המלצות ופירוט כשזה עוזר. יש לך חיפוש באינטרנט: השתמש בו לשאלות על מידע עדכני/מקומי — עסקים, חנויות, ספקים, מחירים, זמינות, כתובות (למשל "היכן לקנות פחם איכותי בשרון" — תן רשימת עסקים אמיתית עם פרטים). כשסופקו נתונים מהקטלוג של האפליקציה והם רלוונטיים — התבסס עליהם וצטט טמפ׳/זמנים משם. אתה יכול לענות גם על שאלות מעשיות סביב עולם הבישול על אש (ציוד, קניות, מקומות) ולא רק על מתכונים. אל תמציא מספרי בטיחות קריטיים — אם אינך בטוח, אמור זאת והפנה לאימות.'+((typeof pref==='function'&&pref('units')==='metric')?(he?' השתמש תמיד ביחידות מטריות (°C, ס״מ, ק״ג, ליטר, מ״מ) — לא פרנהייט/אינץ׳/פאונד.':' Always use metric units (°C, cm, kg, litres, mm) — never Fahrenheit/inches/pounds.'):'');
  const turns=[];
  (history||[]).slice(-4).forEach(h=>turns.push({role:h.role==='ai'?'model':'user',parts:[{text:h.text}]}));
  turns.push({role:'user',parts:[{text:(ctx?ctx+'\n\n':'')+'שאלה: '+q}]});
  const body={
    system_instruction:{parts:[{text:sys}]},
    contents:turns,
    tools:[{google_search:{}}],
    generationConfig:{temperature:0.8,maxOutputTokens:1600,thinkingConfig:{thinkingBudget:0}}
  };
  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json();
  const cand=j.candidates&&j.candidates[0];
  const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
  return {txt,chips:ents,ctx};   // W1-P3: return the grounding so the render can verify the answer's safety numbers against it
}
async function askValidateKey(key){
  try{ await gemFetch(GEM_MODEL, {contents:[{parts:[{text:'שלום'}]}],generationConfig:{maxOutputTokens:20,thinkingConfig:{thinkingBudget:0}}}, {key, retries:0, timeout:12000}); return true; }catch(e){ return false; }
}

/* ═══════════════════════════════════════════════════════════════════
   AI INFRASTRUCTURE LAYER (BYOK) — shared foundation for AI features.
   Contract (ai-prd.md): optional · grounded-only · never invents safety
   numbers · output→action · transparent · local-first.
   ═══════════════════════════════════════════════════════════════════ */

// A3 · availability gate — managed central access OR a personal key
function aiAvail(){ return gemMode()!=='off'; }

// strip ```json fences / stray prose around a JSON body
function aiStripFences(t){
  let s=String(t||'').trim();
  s=s.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=s.indexOf('{'), b=s.lastIndexOf('}'), c=s.indexOf('['), d=s.lastIndexOf(']');
  const objSpan=(a>=0&&b>a)?[a,b]:null, arrSpan=(c>=0&&d>c)?[c,d]:null;
  let span=null;
  if(objSpan&&arrSpan) span = objSpan[0]<arrSpan[0] ? objSpan : arrSpan;
  else span = objSpan||arrSpan;
  if(span) s=s.slice(span[0],span[1]+1);
  return s.trim();
}

// AI #4/#7 · numeric-invariant guard over AI prose. The model can state a fabricated safety number;
// when an answer carries temperature / cure / nitrite / dry-day figures, flag them as unverified and
// point back to the app's cited data + calculator. (We flag rather than redact so cited numbers survive.)
// W1-P2: bilingual, and the detector also catches bare Fahrenheit, salt %, pH, and water-activity (aw).
function aiSafetyHasNumbers(txt){
  return /\d{2,3}\s*°|\d+\s*מעלות|\d+\s*°?[FC]\b|\d+\s*ppm|ניטריט|nitrite|Cure\s*#?[12]|קיור|ריפוי|\d+(\.\d+)?\s*%|\bpH\b|water[-\s]*activity|\baw\b|\d+\s*ימי[םי]?\s*ייבוש|פסטור|pasteur/i.test(String(txt||''));
}
function aiSafetyCaveat(txt){
  if(!aiSafetyHasNumbers(txt)) return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  return '<div class="ai-caveat">⚠ '+(he
    ?'מספרי טמפ׳/ריפוי/בטיחות בתשובת ה-AI אינם מאומתים — אמת מול כרטיס המתכון והמחשבון באפליקציה לפני ביצוע.'
    :'Temperature / cure / safety numbers in the AI answer are not verified — check them against the recipe card and the app calculator before you act.')+'</div>';
}
// W1-P3: numeric-invariant guard. Extract the safety-relevant numbers (temps °/°C/°F/bare C-F, ppm, %, pH) from AI prose,
// and flag any that are NOT present in the vetted grounding context as ungrounded (likely fabricated) → escalate + deep-link the calculator.
function aiSafetyNums(s){
  const out=[]; const str=String(s||''); let m;
  const re=/(\d+(?:\.\d+)?)\s*(?:°\s*[CF]?|[CF]\b|ppm|%)|\bpH\s*(\d+(?:\.\d+)?)/gi;
  while((m=re.exec(str))!==null){ const n=parseFloat(m[1]||m[2]); if(!isNaN(n)) out.push(n); if(m.index===re.lastIndex) re.lastIndex++; }
  return out;
}
function aiUngroundedSafety(answer, context){
  const a=aiSafetyNums(answer); if(!a.length) return [];
  const c=new Set(aiSafetyNums(context).map(function(n){return n.toString();}));
  return a.filter(function(n){ return !c.has(n.toString()); });
}
// The trust contract in one place: no safety numbers → nothing; ungrounded safety numbers → STRONG "don't rely, use the calculator";
// grounded/unknown safety numbers → the mild "verify" caveat.
function aiSafetyNote(answerText, groundingText){
  if(!aiSafetyHasNumbers(answerText)) return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  const ung=(groundingText!=null && groundingText!=='') ? aiUngroundedSafety(answerText, groundingText) : null;
  if(ung && ung.length){
    return '<div class="ai-caveat ai-caveat-strong">🚫 '+(he
      ?'התשובה כוללת מספרי בטיחות שאינם מהנתונים המאומתים של האפליקציה — אל תסתמך עליהם. השתמש במחשבון לחישוב מדויק:'
      :'This answer contains safety numbers that are NOT from the app\'s verified data — do not rely on them. Use the calculator for the exact figure:')
      +' <button class="ai-calc-link" data-aicalc>🧮 '+(he?'פתח מחשבון':'Open calculator')+'</button></div>';
  }
  return aiSafetyCaveat(answerText);
}
// UX #13: one shared AI-loading spinner (the ask flow and the ✨ AI panels used different markup).
function aiSpinner(label){ return `<span class="wcim-loading">✨ ${esc(label||'האש חושב')}<span class="ask-dots"><b>.</b><b>.</b><b>.</b></span></span>`; }
const AI_JSON_SYS = 'אתה מנוע-עזר בתוך אפליקציית בישול-אש ישראלית. החזר אך ורק JSON תקין (בלי Markdown, בלי טקסט לפני או אחרי). '
  + 'בחר אך ורק מתוך רשימת המפתחות (keys) שסופקה — אל תמציא מפתחות, שמות פריטים או מזהים שאינם ברשימה. '
  + 'אל תמציא מספרי בטיחות, טמפרטורות-ריפוי או ימי-ייבוש — אם נדרש מספר כזה השמט אותו והאפליקציה תחשב. '
  + 'הקפד על מבנה ה-JSON המבוקש בדיוק. נימוקים קצרים.';

// A5 · test seam
function aiMockActive(){ return typeof window!=='undefined' && window.__aiMock!==undefined && window.__aiMock!==null; }

// A1 · generic grounded JSON call
async function aiJSON(opts){
  const {task, schemaHint, grounding='', temperature=0.4, maxTokens=1200, search=false}=opts||{};
  if(aiMockActive()){ const m=window.__aiMock; return typeof m==='function' ? m(opts) : m; }
  if(!aiAvail()) throw new Error('no-key');   // available via a personal key OR managed central access; gemFetch routes the transport
  // W1-P1: output-language plumbing — human-readable string values follow the UI language (keys/ids stay as given). Fixes AI JSON coming back Hebrew in the English UI.
  const outLang=(opts&&opts.outLang) || (typeof getLang==='function'?getLang():'he');
  const langLine=(outLang==='he')?'':('\n\nIMPORTANT: write every human-readable string VALUE (reason/note/summary/rationale/tip/warning/text/title/desc) in '+(LANGNAME[outLang]||'English').toUpperCase()+'. Keep every key and id EXACTLY as provided.');
  const metricLine=((typeof pref==='function'&&pref('units')==='metric'))?((outLang==='he')?'\n\nהשתמש אך ורק ביחידות מטריות (°C, ס״מ, ק״ג, ליטר, מ״מ) — לעולם לא °F/אינץ׳/lb.':'\n\nUse metric units ONLY (°C, cm, kg, litres, mm) — never °F/inch/lb.'):'';   // Hebrew → metric
  const userText=(grounding?grounding+'\n\n':'')+'משימה: '+(task||'')+(schemaHint?('\n\nהחזר JSON במבנה הבא בדיוק:\n'+schemaHint):'')+langLine+metricLine;
  const mkBody=()=>{
    // Gemini rejects responseMimeType:'application/json' together with the google_search tool (HTTP 400).
    // When grounding, omit JSON-mode and recover the JSON from the grounded text via aiStripFences
    // (AI_JSON_SYS already mandates "return ONLY valid JSON"). Non-search calls keep strict JSON mode.
    const gen={temperature,maxOutputTokens:maxTokens,thinkingConfig:{thinkingBudget:0}};
    if(!search) gen.responseMimeType='application/json';
    return {
      system_instruction:{parts:[{text:AI_JSON_SYS}]},
      contents:[{role:'user',parts:[{text:userText}]}],
      tools: search?[{google_search:{}}]:undefined,
      generationConfig:gen
    };
  };
  const callOnce=async(body)=>{
    const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
    if(!r.ok) throw new Error('api-'+r.status);
    const j=await r.json();
    const cand=j.candidates&&j.candidates[0];
    const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
    if(!txt){ const fr=(cand&&cand.finishReason)||(j.promptFeedback&&j.promptFeedback.blockReason)||'ריק'; throw new Error('empty-'+fr); }
    return txt;
  };
  let raw;
  try{ raw=await callOnce(mkBody()); }
  catch(e){ if(String(e.message).startsWith('api-4')||String(e.message).startsWith('empty-')){ raw=await callOnce(mkBody()); } else throw e; }
  try{ return JSON.parse(aiStripFences(raw)); }
  catch(_){ try{ return JSON.parse(aiStripFences(raw.replace(/[\u0000-\u001F]+/g,' '))); }catch(e2){ try{ return JSON.parse(aiRepairJson(aiStripFences(String(raw)))); }catch(e3){ throw new Error('bad-json'); } } }
}

// repair the common LLM JSON malformations that break an otherwise-good object:
//   "k":,  →  "k":null,   ·   "k":}  →  "k":null}   ·   trailing comma before } or ]
// (e.g. Gemini emitting `"nozzles":,` when a field has no value). Conservative — only those shapes.
function aiRepairJson(s){
  return String(s||'')
    .replace(/:\s*,/g, ':null,')
    .replace(/:\s*([}\]])/g, ':null$1')
    .replace(/,\s*([}\]])/g, '$1');
}

// A2 · grounding enforcement — every AI-returned key MUST pass here
function aiValidateKeys(keys){
  const valid = (typeof cwAllItems==='function') ? new Set(cwAllItems().map(i=>i.key)) : new Set();
  const kept=[], dropped=[];
  (Array.isArray(keys)?keys:[]).forEach(k=>{ if(valid.has(k)) kept.push(k); else dropped.push(k); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid keys:',dropped);
  return {kept, dropped};
}
function aiValidateItems(arr){
  const valid = (typeof cwAllItems==='function') ? new Set(cwAllItems().map(i=>i.key)) : new Set();
  const seen=new Set(); const kept=[], dropped=[];
  (Array.isArray(arr)?arr:[]).forEach(o=>{ const k=o&&o.key; if(k&&valid.has(k)&&!seen.has(k)){ seen.add(k); kept.push(o); } else dropped.push(o); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid items:',dropped.length);
  return {kept, dropped};
}

// A4 · uniform AI-result confirmation panel (output→action, transparency)
let _aiApply=null;
function aiConfirmPanel(o){
  o=o||{}; _aiApply=o.onApply||null;
  showPanel(`${toolTop(o.title||'הצעת AI', o.sub||'✨ נוצר ע\u05f4י AI · בדוק לפני החלה','✨','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI — ניתן לעריכה וביטול</div>
      <div id="aiCpBody">${o.bodyHTML||''}</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="ccta" id="aiCpApply" style="margin:0;flex:1">${o.applyLabel||'✓ החל'}</button>
        <button class="ccta ghostc" id="aiCpCancel" style="margin:0;flex:1;background:none;border:1.5px solid var(--smoke);color:var(--smoke)">בטל</button>
      </div>
    </div>`);
  const pa=$("#aiCpApply"); if(pa) pa.addEventListener('click',()=>{ const fn=_aiApply; _aiApply=null; if(typeof fn==='function') fn(); });
  const pc=$("#aiCpCancel"); if(pc) pc.addEventListener('click',()=>{ _aiApply=null; if(typeof closePanel==='function') closePanel(); });
}

function openAsk(){
  const examples=getLang()==='he'?['כמה זמן לעשן צלעות','טמפ׳ לסלמון','איזה עץ לחזה','כמה בשר ל-10 אנשים','היכן לקנות פחם איכותי בשרון','עשן יצא מר']:['How long to smoke ribs','Temp for salmon','Which wood for brisket','How much meat for 10 people','Where to buy quality charcoal','Smoke came out bitter'];
  const aiOn=askMode(), hasKey=aiAvail();   // "has AI" = personal key OR managed central access
  const hist=[]; // {role:'user'|'ai', text, src}
  showPanel(`${toolTop(L('שאל את האש','Ask the Fire'),L('עוזר בישול — מנוע מקומי או AI','Cooking assistant — local engine or AI'),'🔥','#e85c1c')}
   <div class="panel-body">
     <div class="ask-mode">
       <button class="ask-modebtn ${!aiOn?'on':''}" data-askmode="local">⚡ ${L('מנוע מקומי','Local engine')}</button>
       <button class="ask-modebtn ${aiOn?'on':''}" data-askmode="ai">🤖 ${L('AI חכם','Smart AI')}${hasKey?'':' <span class="ask-lock">🔑</span>'}</button>
     </div>
     <div id="askthread" class="askthread" role="log" aria-live="polite" aria-atomic="false"></div>
     <div class="askex" id="askex">${examples.map(x=>`<button class="askex-chip" data-ex="${x}">${x}</button>`).join('')}</div>
     <div class="askrow"><input id="askq" placeholder="${L('שאל שאלה…','Ask a question…')}" autocomplete="off"><button id="askgo">${L('שאל','Ask')}</button><button id="askclear" class="askclear" title="${L('שיחה חדשה','New conversation')}" hidden>🗑</button></div>
     <div id="askhint" class="ask-hint">${aiOn?(hasKey?L('🤖 מצב AI פעיל — תשובות חופשיות עם חיפוש באינטרנט, מעוגנות בקטלוג. כלי-עזר בלבד — אמת מספרי טמפ׳/בטיחות מול הקטלוג.','🤖 AI mode on — free-form answers with web search, grounded in the catalog. A helper only — verify temp/safety numbers against the catalog.')+(gemKey()?' <button class="ask-link" data-askmode="disc">'+L('נתק מפתח','Disconnect key')+'</button>':''):L('🤖 מצב AI נבחר — צריך לחבר מפתח חינמי (חד-פעמי).','🤖 AI mode selected — you need to connect a free key (one-time).')):L('⚡ מנוע מקומי — מיידי, פרטי, בלי רשת. עונה מעל נתוני הקטלוג שלך.','⚡ Local engine — instant, private, no network. Answers over your catalog data.')}</div>
   </div>`);
  const pnl=$("#panel"), thread=$("#askthread");
  const badge=src=>src==='ai'?'<span class="ask-src ai">🤖 AI</span>':`<span class="ask-src loc">⚡ ${L('מקומי','Local')}</span>`;
  const scrollDown=()=>{ thread.scrollTop=thread.scrollHeight; };
  function wireChips(el){ el.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{const m=resolveItem(b.dataset.k);m.kind==='cut'?openCut(m.obj):m.kind==='spec'?openSpec(m.obj):openMake(m.key.slice(5));})); }
  function addUser(q){ const d=document.createElement('div'); d.className='ask-q'; d.textContent=q; thread.appendChild(d); scrollDown(); }
  function addAnswer(html){ const d=document.createElement('div'); d.className='ask-a'; d.innerHTML=html; thread.appendChild(d); wireChips(d); scrollDown(); return d; }
  function localHTML(r){ const body=(typeof r==='string')?r:r.t; let h=`<div class="abubble">${badge('local')}${body}</div>`;
    if(r&&r.chips&&r.chips.length) h+=`<div class="askchips">`+r.chips.map(m=>`<button class="askhit" data-k="${m.key}">${(typeof itemName==='function'?itemName(m):m.heb)} · ${t(m.cat)} ▶</button>`).join("")+`</div>`;
    return h; }
  async function go(){
    const q=($("#askq").value||'').trim(); if(!q) return;
    $("#askq").value=''; $("#askex").hidden=true; $("#askclear").hidden=false;   // clear input + hide examples after first Q
    addUser(q); hist.push({role:'user',text:q});
    // W1-P5: refuse known-dangerous intents with a sourced safety card — before any AI or local answer
    { const ref=(typeof askRefuse==='function')?askRefuse(q):null;
      if(ref){ addAnswer(askRefuseCardHTML(ref)); hist.push({role:'ai',text:((typeof getLang==='function'&&getLang()==='he')?ref.he:ref.en).title}); if(typeof scrollDown==='function') scrollDown(); $("#askq").focus(); return; } }
    if(askMode()){
      if(!aiAvail()){ askConnect(); return; }
      const load=addAnswer(`<div class="abubble ask-loading">${badge('ai')}${aiSpinner(L('האש חושב','The Fire is thinking'))}</div>`);
      try{ const r=await askGemini(q, hist);
        load.innerHTML=`<div class="abubble">${badge('ai')}${esc(r.txt||'').replace(/\n/g,'<br>')}${aiSafetyNote(r.txt, r.ctx)}</div>`;   // W1-P3: verify safety numbers against the grounding; escalate + calculator link if ungrounded
        if(r.chips&&r.chips.length){ load.innerHTML+=`<div class="askchips">`+r.chips.map(m=>`<button class="askhit" data-k="${m.key}">${(typeof itemName==='function'?itemName(m):m.heb)} · ${t(m.cat)} ▶</button>`).join("")+`</div>`; wireChips(load); }
        hist.push({role:'ai',text:r.txt||''}); scrollDown();
      }catch(err){ const code=String(err.message||err);
        const why = code.includes('api-4') ? L('מפתח שגוי או חריגת מכסה','invalid key or quota exceeded') : code.startsWith('empty') ? L('ה-AI לא החזיר תשובה','the AI returned no answer') : code.includes('no-key') ? L('אין מפתח מחובר','no key connected') : L('אין חיבור לרשת','no network connection');
        const local=askFire(q);
        load.innerHTML=`<div class="abubble ask-aifail">🤖 ${why}. ${L('הנה תשובת המנוע המקומי:','Here is the local engine answer:')}</div>`+localHTML(local); wireChips(load);
        if(local&&local.act){const btn=document.createElement('button');btn.className='askhit askhit-act';btn.textContent=L('פתח ▶','Open ▶');btn.addEventListener('click',local.act);load.appendChild(btn);}
        hist.push({role:'ai',text:why}); scrollDown();
      }
    } else {
      const local=askFire(q); const d=addAnswer(localHTML(local));
      if(local&&local.act){const btn=document.createElement('button');btn.className='askhit askhit-act';btn.textContent='פתח ▶';btn.addEventListener('click',local.act);d.appendChild(btn);}
      hist.push({role:'ai',text:(typeof local==='string')?local:local.t});
    }
    $("#askq").focus();
  }
  $("#askgo").addEventListener('click',go);
  $("#askq").addEventListener('keydown',e=>{if(e.key==='Enter')go();});
  $("#askclear").addEventListener('click',()=>{ hist.length=0; thread.innerHTML=''; $("#askex").hidden=false; $("#askclear").hidden=true; $("#askq").value=''; $("#askq").focus(); });
  pnl.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>{ $("#askq").value=b.dataset.ex; go(); }));
  pnl.querySelectorAll('[data-askmode]').forEach(b=>b.addEventListener('click',()=>{
    const m=b.dataset.askmode;
    if(m==='local'){ setAskMode(false); openAsk(); }
    else if(m==='ai'){ setAskMode(true); if(aiAvail()) openAsk(); else askConnect(); }
    else if(m==='disc'){ appConfirm('לנתק את מפתח ה-AI? (משפיע גם על הקראה קולית)',{okLabel:'נתק',danger:true}).then(y=>{ if(y===true){ store.set('mk-gemkey',''); setAskMode(false); openAsk(); } }); }
  }));
  $("#askq").focus();
}
// guided, minimal key-connect wizard (reuses mk-gemkey — one key powers AI + voice)
function askConnect(){
  showPanel(`${toolTop(L('חיבור AI חכם','Connect smart AI'),L('מפתח Gemini חינמי · חד-פעמי · ~2 דקות','Free Gemini key · one-time · ~2 minutes'),'🔑','#e07a52')}
   <div class="panel-body">
     <div class="akc-step"><span class="akc-n">1</span><div><b>${L('פתח את Google AI Studio','Open Google AI Studio')}</b><p>${L('צור מפתח חינמי (דורש חשבון Google).','Create a free key (requires a Google account).')}</p><a class="akc-open" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${L('פתח את AI Studio ←','Open AI Studio →')}</a></div></div>
     <div class="akc-step"><span class="akc-n">2</span><div><b>${L('לחץ "Create API key" והעתק','Tap "Create API key" and copy')}</b><p>${L('המפתח נראה כמו רצף ארוך של אותיות ומספרים.','The key looks like a long string of letters and numbers.')}</p></div></div>
     <div class="akc-step"><span class="akc-n">3</span><div><b>${L('הדבק כאן וחבר','Paste here and connect')}</b>
        <div class="akc-keyrow"><input type="password" id="akcKey" placeholder="${L('הדבק מפתח API…','Paste API key…')}" autocomplete="off"><button id="akcSave">${L('חבר','Connect')}</button></div>
        <div id="akcMsg" class="akc-msg"></div>
     </div></div>
     <p class="akc-note">🔒 ${L('המפתח נשמר <b>רק במכשיר שלך</b> ונשלח ישירות ל-Google בלבד. אפשר לנתק בכל רגע.','The key is stored <b>only on your device</b> and sent directly to Google only. You can disconnect anytime.')}</p><p class="akc-note" style="margin-top:8px">💡 ${L('<b>שאל את האש (AI)</b> עובד חינם. <b>הקראה קולית (TTS)</b> היא מודל בתשלום אצל Google — דורש הפעלת <b>Billing</b> בפרויקט (יש מכסה חינמית נדיבה גם אז). בלי חיוב, ההקראה תשתמש בקול המערכת.','<b>Ask the Fire (AI)</b> is free. <b>Voice read-aloud (TTS)</b> is a paid model at Google — it requires enabling <b>Billing</b> on the project (there is a generous free quota even then). Without billing, read-aloud uses the system voice.')}</p>
     <button class="akc-back" id="akcCentral" style="margin-top:10px">🛰️ ${L('יש לך קוד גישה מרכזי? הגדר גישה מרכזית','Have an access code? Set up central access')}</button>
     <button class="akc-back" id="akcBack">→ ${L('חזרה ל"שאל את האש"','Back to "Ask the Fire"')}</button>
   </div>`);
  const cnl=$("#akcCentral"); if(cnl) cnl.addEventListener('click',openKeyManager);
  const msg=$("#akcMsg");
  $("#akcSave").addEventListener('click',async()=>{
    const k=($("#akcKey").value||'').trim();
    if(k.length<20){ msg.className='akc-msg err'; msg.textContent=L('מפתח קצר מדי — ודא שהעתקת את כולו.','Key too short — make sure you copied all of it.'); return; }
    msg.className='akc-msg'; msg.textContent=L('בודק את המפתח…','Checking the key…');
    try{ const ok=await askValidateKey(k);
      if(ok){ store.set('mk-gemkey',k); setAskMode(true); msg.className='akc-msg ok'; msg.textContent=L('✓ מחובר! פותח…','✓ Connected! Opening…'); setTimeout(openAsk,700); }
      else { msg.className='akc-msg err'; msg.textContent=L('המפתח לא התקבל. ודא שיצרת מפתח ל-Gemini API ושהעתקת נכון.','The key was not accepted. Make sure you created a Gemini API key and copied it correctly.'); }
    }catch(e){ msg.className='akc-msg err'; msg.textContent=L('שגיאת רשת — נסה שוב כשיש חיבור.','Network error — try again when connected.'); }
  });
  $("#akcBack").addEventListener('click',openAsk);
  $("#akcKey").focus();
}
// permanent AI-key management — always accessible (☰ settings). Shows status when connected.
function openKeyManager(){
  const key=gemKey(); const cu=centralUrl(), cc=centralCode();
  // NOTE: no early redirect — this hub is the ONLY place with the central-access (Worker URL + code)
  // fields, so a fresh user (no personal key AND no code) must still land here to enter them.
  // The no-key state is handled inline below (status card + "Connect a personal key" button).
  const masked=key.length>8?key.slice(0,4)+'••••••'+key.slice(-4):'••••••';
  const byokBlock = key
    ? `<div class="akm-status"><span class="akm-dot"></span><div><b>${L('מחובר','Connected')}</b><p>${L('מפתח אישי','Personal key')}: <code>${masked}</code></p></div></div>
       <button class="akm-btn" id="akmTest">🧪 ${L('בדוק שהמפתח עובד','Test that the key works')}</button>
       <button class="akm-btn" id="akmReplace">🔁 ${L('החלף מפתח','Replace key')}</button>
       <button class="akm-btn akm-danger" id="akmOff">🔌 ${L('נתק מפתח','Disconnect key')}</button>`
    : `<div class="akm-status akm-off"><span class="akm-dot"></span><div><b>${L('אין מפתח אישי','No personal key')}</b><p>${cc?L('פועל דרך גישה מרכזית','Running via central access'):''}</p></div></div>
       <button class="akm-btn" id="akmConnect">🔑 ${L('חבר מפתח אישי','Connect a personal key')}</button>`;
  showPanel(`${toolTop(L('ניהול AI','Manage AI'),L('מפתח אישי או גישה מרכזית','A personal key or central access'),'🔑','#e07a52')}
   <div class="panel-body">
     ${byokBlock}
     <div id="akmMsg" class="akc-msg"></div>
     <div class="akm-central">
       <div class="akm-central-h">🛰️ ${L('גישה מרכזית (פיתוח)','Central access (dev)')}</div>
       <p class="akc-note">${L('קוד גישה מהמפתח מפעיל AI דרך השרת המרכזי — בלי מפתח אישי.','An access code from the developer runs AI through the central server — no personal key needed.')}</p>
       <label class="eq-step-l" style="margin-top:8px">${L('כתובת השרת','Server URL')}</label>
       <input id="akmCUrl" class="eq-inp" inputmode="url" placeholder="https://…workers.dev" value="${esc(cu)}">
       <label class="eq-step-l">${L('קוד גישה','Access code')}</label>
       <input id="akmCCode" class="eq-inp" value="${esc(cc)}" placeholder="${L('הדבק כאן את הקוד','paste your code here')}">
       <div style="display:flex;gap:8px;margin-top:10px"><button class="akm-btn" id="akmCSave" style="margin:0;flex:1">${L('שמור ובדוק','Save & test')}</button>${cc?`<button class="akm-btn akm-danger" id="akmCClear" style="margin:0">${L('נתק','Disconnect')}</button>`:''}</div>
       <div id="akmCMsg" class="akc-msg"></div>
     </div>
     <p class="akc-note" style="margin-top:14px">🔒 ${L('מפתח אישי נשמר <b>רק במכשיר</b> ונשלח ישירות ל-Google. גישה מרכזית שולחת לשרת שלך (Cloudflare) שמחזיק את המפתח.','A personal key is stored <b>only on your device</b> and sent straight to Google. Central access sends to your server (Cloudflare) which holds the key.')}</p>
     <button class="akc-back" id="akmBack">→ ${L('חזרה','Back')}</button>
   </div>`);
  const msg=$("#akmMsg");
  const tb=$("#akmTest"); if(tb) tb.addEventListener('click',async()=>{ msg.className='akc-msg'; msg.textContent=L('בודק…','Testing…');
    try{ const ok=await askValidateKey(gemKey()); msg.className='akc-msg '+(ok?'ok':'err'); msg.textContent=ok?L('✓ המפתח תקין ופעיל.','✓ The key is valid and active.'):L('✗ המפתח נדחה — כדאי להחליף.','✗ The key was rejected — replace it.'); }
    catch(e){ msg.className='akc-msg err'; msg.textContent=L('שגיאת רשת — נסה שוב כשיש חיבור.','Network error — try again when connected.'); } });
  const rb=$("#akmReplace"); if(rb) rb.addEventListener('click',askConnect);
  const cnb=$("#akmConnect"); if(cnb) cnb.addEventListener('click',askConnect);
  const ob=$("#akmOff"); if(ob) ob.addEventListener('click',async()=>{ if((await appConfirm(L('לנתק את מפתח ה-AI האישי?','Disconnect the personal AI key?'),{okLabel:L('נתק','Disconnect'),danger:true}))!==true) return; store.set('mk-gemkey',''); setAskMode(false); if(typeof gemCache!=='undefined')gemCache.clear(); toast('המפתח נותק'); openKeyManager(); });
  const cmsg=$("#akmCMsg");
  const csb=$("#akmCSave"); if(csb) csb.addEventListener('click',async()=>{
    store.set('mk-central-url', (($("#akmCUrl")||{}).value||'').trim()); store.set('mk-central-code', (($("#akmCCode")||{}).value||'').trim());
    if(!centralUrl()||!centralCode()){ cmsg.className='akc-msg'; cmsg.textContent=L('מלא כתובת וקוד.','Enter a URL and a code.'); return; }
    cmsg.className='akc-msg'; cmsg.textContent=L('בודק גישה…','Testing access…');
    try{ await gemFetch(GEM_MODEL, {contents:[{parts:[{text:'שלום'}]}], generationConfig:{maxOutputTokens:5, thinkingConfig:{thinkingBudget:0}}}, {retries:0, timeout:15000}); cmsg.className='akc-msg ok'; cmsg.textContent=L('✓ הגישה המרכזית פעילה.','✓ Central access is live.'); openKeyManager(); }
    catch(e){ const m=String(e&&e.message||e); cmsg.className='akc-msg err'; cmsg.textContent=/api-40[123]/.test(m)?L('✗ הקוד נדחה או נגמרה המכסה.','✗ Code rejected or quota reached.'):L('✗ בדיקה נכשלה — בדוק כתובת/קוד/רשת.','✗ Test failed — check URL / code / network.'); } });
  const ccl=$("#akmCClear"); if(ccl) ccl.addEventListener('click',()=>{ store.set('mk-central-url',''); store.set('mk-central-code',''); toast(L('גישה מרכזית נותקה','Central access disconnected')); openKeyManager(); });
  $("#akmBack").addEventListener('click',openAsk);
}

/* ---- event menu builder ---- */
/* sides & drinks knowledge for pairing */
const SIDES=[
  {n:"פיתה / לאפה / לחם כפרי",t:["בקר","עוף","טלה","שווארמה","צלייה טחונה","נקניקיות","נקניק מעושן","BBQ קלאסי","פסטרמה"]},
  {n:"סלט ישראלי קצוץ",t:["*"]},
  {n:"קולסלו (כרוב)",t:["בקר","עוף","BBQ קלאסי","נקניק מעושן","נקניקיות"]},
  {n:"תפוחי אדמה בתנור / צ׳יפס",t:["בקר","עוף","טלה","BBQ קלאסי","נקניקיות"]},
  {n:"תירס קלוי בחמאה",t:["בקר","עוף","BBQ קלאסי","נקניקיות","צלייה טחונה"]},
  {n:"אורז / ממליגה",t:["טלה","עוף","צלייה טחונה","נקניק מעושן"]},
  {n:"צ׳ימיצ׳ורי",t:["בקר","טלה","צלייה טחונה","BBQ קלאסי"]},
  {n:"טחינה",t:["טלה","עוף","שווארמה","צלייה טחונה"]},
  {n:"חומוס",t:["שווארמה","עוף","טלה","צלייה טחונה"]},
  {n:"חמוצים / מלפפון חמוץ",t:["שווארמה","נקניק מעושן","נקניק מיובש","סלומי","פסטרמה","בקר"]},
  {n:"בצל סגול בסומק",t:["טלה","שווארמה","צלייה טחונה","בקר"]},
  {n:"שעועית BBQ",t:["בקר","BBQ קלאסי","נקניק מעושן"]},
  {n:"מאק אנד צ׳יז",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"לחם כפרי + חרדל + זיתים",t:["סלומי","נקניק מיובש","פסטרמה","גבינה"]},
  {n:"ריבה/דבש + אגוזים",t:["סלומי","גבינה","נקניק מיובש"]},
  {n:"לימון + עשבי תיבול",t:["דג","דג מעושן","פירות ים"]},
  {n:"סלט עלים ירוק",t:["דג","דג מעושן","סלומי","גבינה","עוף"]},
  // — הרחבה —
  {n:"ירקות שורש צלויים בגריל",t:["בקר","טלה","עוף","BBQ קלאסי","נקניק מעושן"]},
  {n:"פוקצ׳ה / לחם שום",t:["בקר","גבינה","סלומי","נקניק מיובש","BBQ קלאסי"]},
  {n:"בטטה בתנור / צ׳יפס בטטה",t:["בקר","עוף","BBQ קלאסי","טלה"]},
  {n:"באבא גנוש (חצילים שרופים)",t:["טלה","שווארמה","עוף","צלייה טחונה"]},
  {n:"מטבוחה / סלט חצילים חריף",t:["טלה","שווארמה","בקר","צלייה טחונה"]},
  {n:"טאבולה (בורגול ופטרוזיליה)",t:["טלה","עוף","שווארמה","דג"]},
  {n:"סלט תפוחי אדמה",t:["נקניקיות","נקניק מעושן","BBQ קלאסי","בקר"]},
  {n:"כרוב כבוש (זאוארקראוט)",t:["נקניקיות","נקניק מעושן","נקניק מיובש"]},
  {n:"פטריות בגריל בחמאת שום",t:["בקר","טלה","BBQ קלאסי","עוף"]},
  {n:"קורנברד (לחם תירס)",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"גזר צלוי בדבש וכמון",t:["טלה","עוף","דג"]},
  {n:"גוואקמולה / אבוקדו",t:["בקר","עוף","נקניקיות","BBQ קלאסי"]},
  {n:"סלסת עגבניות טרייה (פיקו דה גאיו)",t:["בקר","עוף","נקניקיות","BBQ קלאסי"]},
  {n:"לימון כבוש / ארטישוק",t:["דג","דג מעושן","פירות ים","עוף"]},
  {n:"רוטב חמאת שום-לימון",t:["פירות ים","דג","עוף"]}
];
const DRINKS=[
  // — רכה —
  {n:"לימונדה / מי גזוז",k:"soft",sub:"soft",t:["*"]},
  {n:"תה קר (אייס-טי)",k:"soft",sub:"soft",t:["BBQ קלאסי","בקר","עוף","נקניקיות"]},
  {n:"סודה / מים מוגזים בטעמים",k:"soft",sub:"soft",t:["*"]},
  {n:"קולה / משקה קל",k:"soft",sub:"soft",t:["BBQ קלאסי","בקר","נקניקיות","נקניק מעושן"]},
  {n:"מיץ רימונים / ענבים",k:"soft",sub:"soft",t:["טלה","שווארמה","צלייה טחונה"]},
  {n:"לימונדה נענע",k:"soft",sub:"soft",t:["*"]},
  {n:"ג׳ינג׳ר-אייל ביתי",k:"soft",sub:"soft",t:["בקר","עוף","דג","פירות ים"]},
  {n:"קומבוצ׳ה",k:"soft",sub:"soft",t:["דג","גבינה","עוף","סלומי"]},
  {n:"מוחיטו וירג׳ין (ללא אלכוהול)",k:"soft",sub:"soft",t:["פירות ים","דג","עוף"]},
  {n:"קפה קר / אספרסו טוניק",k:"soft",sub:"soft",t:["גבינה","סלומי","נקניק מיובש"]},
  {n:"איראן / משקה יוגורט",k:"soft",sub:"soft",t:["טלה","שווארמה","צלייה טחונה"]},
  // — בירה —
  {n:"בירה לאגר קרה",k:"alc",sub:"beer",t:["בקר","עוף","נקניקיות","נקניק מעושן","צלייה טחונה","שווארמה","טלה"]},
  {n:"בירה כהה (סטאוט/פורטר)",k:"alc",sub:"beer",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"בירת IPA",k:"alc",sub:"beer",t:["BBQ קלאסי","נקניק מעושן","בקר"]},
  {n:"בירת חיטה (וייצן)",k:"alc",sub:"beer",t:["עוף","נקניקיות","דג","פירות ים"]},
  {n:"פילזנר",k:"alc",sub:"beer",t:["נקניקיות","עוף","דג","פירות ים"]},
  {n:"אמבר אייל",k:"alc",sub:"beer",t:["בקר","BBQ קלאסי","נקניק מעושן","טלה"]},
  {n:"סאוור / גוזה",k:"alc",sub:"beer",t:["דג","פירות ים","גבינה","עוף"]},
  // — יין —
  {n:"יין אדום יבש",k:"alc",sub:"wine",t:["בקר","טלה","סלומי","נקניק מיובש","פסטרמה","BBQ קלאסי","צלייה טחונה"]},
  {n:"יין לבן / רוזה מצונן",k:"alc",sub:"wine",t:["דג","דג מעושן","פירות ים","עוף","גבינה","סלומי"]},
  {n:"יין מבעבע / קאווה",k:"alc",sub:"wine",t:["פירות ים","דג","גבינה","עוף"]},
  {n:"פורט / יין מתוק",k:"alc",sub:"wine",t:["גבינה","נקניק מיובש","סלומי"]},
  // — שתייה חריפה —
  {n:"וויסקי / בורבון",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן","טלה"]},
  {n:"סינגל מאלט סקוטי (מעושן)",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן","גבינה"]},
  {n:"ערק עם נענע וקרח",k:"alc",sub:"spirit",t:["טלה","שווארמה","צלייה טחונה","עוף"]},
  {n:"טקילה / מסקל",k:"alc",sub:"spirit",t:["בקר","BBQ קלאסי","עוף","נקניקיות"]},
  {n:"רום כהה / רום מיושן",k:"alc",sub:"spirit",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"ג׳ין (נקי/עם טוניק)",k:"alc",sub:"spirit",t:["דג","פירות ים","עוף","גבינה"]},
  {n:"וודקה מצוננת",k:"alc",sub:"spirit",t:["דג מעושן","פירות ים","דג"]},
  {n:"קוניאק / ברנדי",k:"alc",sub:"spirit",t:["גבינה","נקניק מיובש","בקר"]},
  {n:"גראפה / עראק איטלקי",k:"alc",sub:"spirit",t:["סלומי","נקניק מיובש","גבינה"]},
  // — קוקטיילים —
  {n:"אולד פאשנד (וויסקי)",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","נקניק מעושן"]},
  {n:"נגרוני",k:"alc",sub:"cocktail",t:["סלומי","נקניק מיובש","בקר","גבינה"]},
  {n:"וויסקי סאוּר",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","עוף"]},
  {n:"מרגריטה (טקילה)",k:"alc",sub:"cocktail",t:["בקר","עוף","נקניקיות","פירות ים"]},
  {n:"מוחיטו (רום)",k:"alc",sub:"cocktail",t:["פירות ים","דג","עוף","נקניקיות"]},
  {n:"מנהטן",k:"alc",sub:"cocktail",t:["בקר","נקניק מעושן","BBQ קלאסי"]},
  {n:"בולברדייה",k:"alc",sub:"cocktail",t:["בקר","סלומי","נקניק מיובש"]},
  {n:"פאלומה (טקילה-אשכולית)",k:"alc",sub:"cocktail",t:["עוף","פירות ים","נקניקיות","דג"]},
  {n:"מסקל סמוקי (עם עשן)",k:"alc",sub:"cocktail",t:["BBQ קלאסי","בקר","נקניק מעושן"]}
];
// ── desserts (fire + classics) + seasonal fresh fruit ──
const DESSERTS=[
  {n:"אננס צלוי בקרמל",fire:1,t:["*"]},
  {n:"אפרסק / משמש על הגריל",fire:1,t:["*"]},
  {n:"בננה בקליפה עם שוקולד",fire:1,t:["*"]},
  {n:"תאנים צלויות בדבש",fire:1,t:["*"]},
  {n:"אבטיח חרוך על האש",fire:1,t:["*"]},
  {n:"מרשמלו / סמורז",fire:1,t:["*"]},
  {n:"מלבי",t:["*"]},
  {n:"קרם ברולה",t:["*"]},
  {n:"טירמיסו",t:["*"]},
  {n:"פאבלובה",t:["*"]},
  {n:"עוגת שוקולד חמה",t:["*"]},
  {n:"גלידה / סורבה",t:["*"]},
  {n:"קנאפה",t:["*"]},
  {n:"סחלב חם",t:["*"]}
];
const SEASONAL_FRUIT={
  אביב:["תות","אפרסק","ענבים","משמש","שסק"],
  קיץ:["אבטיח","מלון","ענבים","נקטרינה","שזיף","תאנה","מנגו"],
  סתיו:["רימון","תאנה","ענבים","חבוש","אפרסמון","גויאבה"],
  חורף:["תפוז / קלמנטינה","פומלה","תפוח","אגס","אפרסמון","קיווי"]
};
function seasonForMonth(m){ if(m>=3&&m<=5) return 'אביב'; if(m>=6&&m<=8) return 'קיץ'; if(m>=9&&m<=11) return 'סתיו'; return 'חורף'; }
// season by EVENT date if set, otherwise current month
function eventSeason(){ let d=new Date(); try{ const s=menuState(); if(s&&s.evDate){ const dd=new Date(s.evDate); if(!isNaN(dd.getTime())) d=dd; } }catch(e){} return seasonForMonth(d.getMonth()+1); }
function seasonalFruitList(){ return SEASONAL_FRUIT[eventSeason()]||[]; }
// per-guest quantity for a side/drink/dessert/fruit → human string
function eventQty(name, kind, guests){
  const g=Math.max(1,guests||1);
  if(kind==='side') return `~${(g*0.175).toFixed(1)} ק״ג`;
  if(kind==='dessert') return `~${g} מנות`;
  if(kind==='fruit') return `~${(g*0.15).toFixed(1)} ק״ג`;
  if(kind==='drink'){
    const d=DRINKS.find(x=>x.n===name); const sub=d?d.sub:'soft';
    if(sub==='soft') return `~${Math.ceil(g*0.5/1.5)} בקבוקי 1.5 ל׳`;
    if(sub==='beer') return `~${g*2}–${g*3} בקבוקים`;
    if(sub==='wine') return `~${Math.ceil(g/2.5)} בקבוקים`;
    return `~${g*2}–${g*3} מנות`; // spirit/cocktail
  }
  return '';
}
function menuCats(keys){const s=new Set();keys.forEach(k=>{const m=resolveItem(k);if(m)s.add(m.cat);});return s;}
function recipesInCat(cat,kosherOnly){
  let l=[];
  DATA.cuts.forEach(c=>{if(c.cat===cat)l.push('cut-'+c.n);});
  Object.keys(DATA.makes).forEach(id=>{if(DATA.makes[id].cat===cat)l.push('make-'+id);});
  DATA.specials.forEach(x=>{if(x.cat===cat)l.push('spec-'+x.n);});
  if(kosherOnly) l=l.filter(isKosherOk);
  return l;
}
function allMenuCats(){const s=new Set();DATA.cuts.forEach(c=>s.add(c.cat));Object.values(DATA.makes).forEach(m=>s.add(m.cat));DATA.specials.forEach(x=>s.add(x.cat));return [...s];}
function pairList(kind,cats){
  const src=kind==='side'?SIDES:DRINKS.filter(d=>d.k===kind);
  const sc=d=>d.t.includes('*')?1:d.t.filter(x=>cats.has(x)).length;
  return src.map(d=>({d,s:sc(d)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.d.n);
}
// ── active context: 'event' (mk-menu) vs 'cook' (mk-cook) — separate cooking routes ──
function menuCtx(){ const c=store.get('mk-context'); return c==='cook'?'cook':'event'; }
function setMenuCtx(c){ store.set('mk-context', c==='cook'?'cook':'event'); }
function menuKey(){ return menuCtx()==='cook'?'mk-cook':'mk-menu'; }
function menuState(){return store.get(menuKey())||{guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};}
function saveMenu(s){ if(s&&Array.isArray(s.keys)) s.keys=[...new Set(s.keys)]; store.set(menuKey(),s); }
function gpp(a){return {light:200,reg:280,heavy:380}[a]||280;}  // cooked g/guest, aggregate for whole meal
function dishYield(m){return m.kind==='cut'?(m.obj.tgt>=88?0.6:0.72):0.82;}
// Single source of truth for how much RAW meat one main dish needs for the active menu. The menu screen,
// the print menu and the shopping cart all call this — three separate copies of this formula had drifted
// (the cart fell back to the whole-cut catalog weight, showing a 5.5 kg brisket where the menu showed 3.7).
// guests × per-guest cooked grams × sides factor, split across the dishes, divided by the cut's raw→cooked yield.
function rawGramsFor(meta, s){
  s = s || ((typeof menuState==='function') ? menuState() : {});
  const n = (s.keys && s.keys.length) ? s.keys.length : 1;
  const basePerGuest = (s.gpm && s.gpm>0) ? s.gpm : gpp(s.appetite);
  const sidesFactor = (s.sides && s.sides.length) ? 0.75 : 1;   // sides fill plates → less meat
  const budget = (s.guests||8) * basePerGuest * sidesFactor;
  return (budget / n) / dishYield(meta);
}
function presetMenu(style){
  const s=menuState();
  const pick=cat=>{const l=recipesInCat(cat,s.kosher);return l.length?l[Math.floor(Math.random()*l.length)]:null;};
  const map={'מנגל מעורב':['בקר','עוף','צלייה טחונה','נקניקיות'],'שרקוטרי':['סלומי','נקניק מיובש','פסטרמה','גבינה'],'נקניקיות':['נקניקיות','נקניק מעושן','צלייה טחונה','בקר'],'דגים':['דג','דג מעושן','עוף']};
  s.keys=(map[style]||[]).map(pick).filter(Boolean);saveMenu(s);renderMenu();
}
function presetFromFavs(){const s=menuState();let f=[...favs];if(s.kosher)f=f.filter(isKosherOk);s.keys=f.slice(0,8);saveMenu(s);renderMenu();}
function presetFromCart(){
  const s=menuState();
  let items=[...cart].filter(k=>resolveItem(k));            // only valid dishes
  if(s.kosher) items=items.filter(isKosherOk);
  const before=s.keys.length;
  items.forEach(k=>{ if(!s.keys.includes(k)) s.keys.push(k); }); // merge, no duplicates
  const added=s.keys.length-before;
  saveMenu(s); renderMenu();
  toast(items.length? (added?`${added} ${L('כרטיסיות מסומנות (✓) נוספו לתפריט','checked cards (✓) added to the menu')}`:L('כל המסומנות כבר בתפריט','All checked cards are already in the menu'))
                    : L('אין כרטיסיות מסומנות — סמן נתחים עם ＋ בכרטיסים','No checked cards — mark cuts with ＋ on the cards'));
}
function swapDish(i){const s=menuState();const cur=s.keys[i];const m=resolveItem(cur);if(!m)return;const cands=recipesInCat(m.cat,s.kosher).filter(k=>k!==cur&&!s.keys.includes(k));if(cands.length){s.keys[i]=cands[Math.floor(Math.random()*cands.length)];saveMenu(s);renderMenu();}}
function copyText(t){try{if(navigator.clipboard)navigator.clipboard.writeText(t);toast('הרשימה הועתקה ✓');}catch(e){toast('הועתק');}}
function resetMenu(){
  const prev=menuState();
  const fresh={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};
  if(typeof menuCtx==='function' && menuCtx()==='event'){ fresh.evName=prev.evName||''; fresh.evDesc=prev.evDesc||''; fresh.evDate=prev.evDate||''; }
  saveMenu(fresh);                       // writes to the ACTIVE context (mk-menu or mk-cook)
  store.set(mkMenuqtyKey(),{});
  renderMenu();
  const label=(typeof menuCtx==='function'&&menuCtx()==='cook')?'הבישול אופס':'התפריט אופס — תפריט חדש';
  toast(label,()=>{ saveMenu(prev); renderMenu(); });
}
function openMenu(){
  showPanel(`${toolTop(L('בונה תפריט לאירוח','Party menu builder'),L('מנות, תוספות, שתייה, כמויות וזמנים','Dishes, sides, drinks, quantities and timing'),'🎉','#b9772f')}
   <div class="panel-body" id="menuBody"></div>`);
  renderMenu();
}
// UX #3: one builder — "build a menu" always routes to the guided wizard (the legacy openMenu panel is retired as an entry point).
function openBuilder(){ if(typeof cwGo==='function' && typeof cNavGo==='function'){ cwGo(1); cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); } else if(typeof openMenu==='function'){ openMenu(); } }
// standalone printable menu — no full builder, returns to caller screen on close
function openMenuPrint(){
  const s=menuState();
  if(!s.keys||!s.keys.length){ if(typeof toast==='function') toast('אין מנות להדפסה'); return; }
  let totalRaw=0;
  const kg=L('ק״ג','kg'), raw_=L('נא','raw');
  const lines=s.keys.map(k=>{const m=resolveItem(k); if(!m) return ''; const raw=rawGramsFor(m, s); totalRaw+=raw; return `<li>${(typeof itemName==='function'?itemName(m):m.heb)} — ~${(raw/1000).toFixed(1)} ${kg} ${raw_}</li>`;}).join('');
  const appName={light:L('קל','Light'),reg:L('רגיל','Regular'),heavy:L('כבד','Heavy')}[s.appetite]||L('רגיל','Regular');
  const serve=store.get('mk-tlserve')||'19:00'; const evName=s.evName||'';
  const menuHTML=`<div class="menuprint" style="display:block">
    <h2 style="font-family:'Suez One'">${evName?evName+' · ':''}${L('תפריט','Menu')} · ${s.guests||8} ${L('אורחים','guests')}</h2>
    <h4>${L('מנות עיקריות','Main dishes')}</h4><ul>${lines}</ul>
    ${(s.sides||[]).length?`<h4>${L('תוספות','Sides')}</h4><ul>${s.sides.map(x=>`<li>${t(x)} <small>(${eventQty(x,'side',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.drinks||[]).length?`<h4>${L('שתייה','Drinks')}</h4><ul>${s.drinks.map(x=>`<li>${t(x)} <small>(${eventQty(x,'drink',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.desserts||[]).length?`<h4>${L('קינוחים','Desserts')}</h4><ul>${s.desserts.map(x=>x==='__fruit'?`<li>${L('מגש פירות העונה','Seasonal fruit platter')} (${t(eventSeason())}: ${seasonalFruitList().map(f=>t(f)).join(', ')}) <small>(${eventQty('','fruit',s.guests)})</small></li>`:`<li>${t(x)} <small>(${eventQty(x,'dessert',s.guests)})</small></li>`).join("")}</ul>`:''}
    <p><b>${L('סה״כ בשר נא משוער','Est. total raw meat')}: ~${(totalRaw/1000).toFixed(1)} ${kg}</b> · ${L('תיאבון','appetite')} ${appName} · ${L('הגשה','serve')} ${serve}</p>
  </div>`;
  showPanel(`${toolTop(L('הדפסת תפריט','Print menu'),evName||L('תפריט האירוע','Event menu'),'🖨️','#cf6a4a')}
    <div class="panel-body" id="menuBody">
      <p class="section-sub" style="margin:0 0 12px">${L('תצוגה מקדימה של התפריט. לחץ "הדפס" כשתהיה מוכן.','Menu preview. Tap "Print" when you are ready.')}</p>
      ${menuHTML}
      <button class="prbtn" style="position:static;margin-top:16px" data-print>⎙ ${L('הדפס / שמור PDF','Print / save PDF')}</button>
    </div>`);
  const p=$("#panel"); if(p) p.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
}
function renderMenu(){
  const host=$("#menuBody"); if(!host) return;
  const s=menuState();
  const cats=menuCats(s.keys);
  let totalRaw=0;
  const qtyMap={};
  const dish=s.keys.map((k,i)=>{
    const m=resolveItem(k); if(!m) return ['',0];
    const raw=rawGramsFor(m, s); totalRaw+=raw; qtyMap[k]=Math.round(raw);
    return [`<div class="mdish"><div class="md-main"><span class="si-cat" style="color:${catColor(m.cat)}">${t(m.cat)} ${kosherTag(k)}</span><b>${(typeof itemName==='function'?itemName(m):m.heb)}</b><small>~${(raw/1000).toFixed(1)} ${L('ק״ג','kg')} ${L('נא','raw')}</small></div><div class="md-act"><button data-mswap="${i}" aria-label="${L('החלף','Swap')}">↻</button><button data-mrm="${i}" aria-label="${L('הסר','Remove')}">✕</button></div></div>`, raw];
  });
  store.set(mkMenuqtyKey(), qtyMap);   // flows into the shopping list (per-event scope — Wave E)
  const rawPerGuest = s.keys.length? Math.round(totalRaw/s.guests) : 0;
  const dishRows=dish.map(d=>d[0]).join("");
  const sides=pairList('side',cats), soft=pairList('soft',cats), alc=pairList('alc',cats);
  const appName={light:L('קל','Light'),reg:L('רגיל','Regular'),heavy:L('כבד','Heavy')}[s.appetite];
  const chip=(name,on,attr)=>`<button class="mchip ${on?'on':''}" ${attr}="${name}">${on?'✓ ':''}${t(name)}</button>`;
  const printHtml=`<div class="menuprint">
    <h2 style="font-family:'Suez One'">${L('תפריט','Menu')} · ${s.guests} ${L('אורחים','guests')}</h2>
    <h4>${L('מנות עיקריות','Main dishes')}</h4><ul>${s.keys.map((k,i)=>{const m=resolveItem(k);return m?`<li>${(typeof itemName==='function'?itemName(m):m.heb)} — ~${(dish[i][1]/1000).toFixed(1)} ${L('ק״ג','kg')} ${L('נא','raw')}</li>`:'';}).join("")}</ul>
    ${s.sides.length?`<h4>${L('תוספות','Sides')}</h4><ul>${s.sides.map(x=>`<li>${t(x)} <small>(${eventQty(x,'side',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${s.drinks.length?`<h4>${L('שתייה','Drinks')}</h4><ul>${s.drinks.map(x=>`<li>${t(x)} <small>(${eventQty(x,'drink',s.guests)})</small></li>`).join("")}</ul>`:''}
    ${(s.desserts||[]).length?`<h4>${L('קינוחים','Desserts')}</h4><ul>${s.desserts.map(x=>x==='__fruit'?`<li>${L('מגש פירות העונה','Seasonal fruit platter')} (${t(eventSeason())}: ${seasonalFruitList().map(f=>t(f)).join(', ')}) <small>(${eventQty('','fruit',s.guests)})</small></li>`:`<li>${t(x)} <small>(${eventQty(x,'dessert',s.guests)})</small></li>`).join("")}</ul>`:''}
  </div>`;
  host.innerHTML=`
    <div class="mrow"><label>${L('אורחים','Guests')}</label><input type="number" id="mG" min="1" value="${s.guests}"><span class="u">${L('איש','people')}</span></div>
    <div class="mrow"><label>${L('תיאבון','Appetite')}</label>
      <select id="mA" ${s.gpm>0?'disabled':''}><option value="light"${s.appetite==='light'?' selected':''}>${L('קל','Light')}</option><option value="reg"${s.appetite==='reg'?' selected':''}>${L('רגיל','Regular')}</option><option value="heavy"${s.appetite==='heavy'?' selected':''}>${L('כבד','Heavy')}</option></select>
      <button class="mchip ${s.kosher?'on':''}" id="mK">${s.kosher?'✓ ':''}${L('כשר בלבד','Kosher only')}</button></div>
    <div class="mrow"><label>${L('גרם/אורח','g/guest')}</label><input type="number" id="mGpm" min="0" step="10" value="${s.gpm||''}" placeholder="${L('אוטו׳','auto')}"><span class="u">${L('ג׳ מבושל · ידני (עוקף תיאבון)','g cooked · manual (overrides appetite)')}</span></div>
    <div class="mpresets"><span>${L('התחלה מהירה:','Quick start:')}</span>
      <button data-preset="מנגל מעורב">${L('מנגל מעורב','Mixed grill')}</button><button data-preset="שרקוטרי">${L('שרקוטרי','Charcuterie')}</button>
      <button data-preset="נקניקיות">${L('נקניקיות','Sausages')}</button><button data-preset="דגים">${L('דגים','Fish')}</button>
      <button data-preset="__fav">${L('מהמועדפים','From favorites')}</button>
      <button data-preset="__cart">✓ ${L('מהמסומנים ברשימה','From list selections')}</button>
      <button id="mReset" class="mreset">🗑️ ${(typeof menuCtx==='function'&&menuCtx()==='cook')?L('בישול חדש','New cook'):L('תפריט חדש','New menu')}</button></div>
    <h4 class="mini-h" style="margin-top:18px">${L('מנות עיקריות','Main dishes')}${s.keys.length?` · ${s.keys.length}`:''}</h4>
    <div class="mdishes">${dishRows||`<div class="shop-empty" style="padding:16px">${L('בחר "התחלה מהירה" למעלה, או הוסף מנה ↓','Pick a "Quick start" above, or add a dish ↓')}</div>`}</div>
    <div class="maddwrap"><button id="mAdd">➕ ${L('הוסף מנה','Add dish')}</button><div id="mAddCats" class="maddcats" style="display:none"></div></div>
    ${s.keys.length?`<div class="kbox k-ok" style="margin-top:12px">${L('סה״כ בשר נא','Total raw meat')}: <b>~${(totalRaw/1000).toFixed(1)} ${L('ק״ג','kg')}</b> · <b>~${rawPerGuest} ${L('ג׳/אורח','g/guest')}</b> ${L('ל-','for ')}${s.guests} ${L('אורחים','guests')}${s.sides.length?' · '+L('הופחת 25% בזכות תוספות','reduced 25% thanks to sides'):''}${s.gpm>0?' · '+L('ידני','manual'):` (${appName})`}</div>`:''}
    ${(typeof menuCtx==='function'&&menuCtx()==='cook')?'':`
    <h4 class="mini-h" style="margin-top:20px">${L('תוספות מומלצות','Recommended sides')}${s.keys.length?'':' '+L('(הוסף מנות תחילה)','(add dishes first)')}</h4>
    <div class="mchips">${sides.map(x=>chip(x,s.sides.includes(x),'data-side')).join("")}</div>
    <h4 class="mini-h" style="margin-top:18px">🥤 ${L('שתייה קלה','Soft drinks')}</h4>
    <div class="mchips">${soft.map(x=>chip(x,s.drinks.includes(x),'data-drink')).join("")}</div>
    <h4 class="mini-h" style="margin-top:14px">🍺 ${L('שתייה חריפה','Alcoholic drinks')}</h4>
    <div class="mchips">${alc.map(x=>chip(x,s.drinks.includes(x),'data-drink')).join("")}</div>
    <div class="mnote">${L('משקאות: תכנן ~2–3 לאדם.','Drinks: plan ~2–3 per person.')}</div>
    <h4 class="mini-h" style="margin-top:18px">🍮 ${L('קינוחים','Desserts')}</h4>
    <div class="mchips">${DESSERTS.map(d=>`<button class="mchip ${(s.desserts||[]).includes(d.n)?'on':''}" data-dessert="${d.n}">${(s.desserts||[]).includes(d.n)?'✓ ':''}${d.fire?'🔥 ':''}${t(d.n)}</button>`).join("")}</div>
    <h4 class="mini-h" style="margin-top:14px">🍑 ${L('פירות טריים','Fresh fruit')} — ${t(eventSeason())}${(()=>{const st=menuState();return st.evDate?L(' (לפי תאריך האירוע)',' (by event date)'):L(' (החודש)',' (this month)');})()}</h4>
    <div class="mchips"><button class="mchip ${(s.desserts||[]).includes('__fruit')?'on':''}" data-dessert="__fruit">${(s.desserts||[]).includes('__fruit')?'✓ ':''}🍉 ${L('מגש פירות העונה','Seasonal fruit platter')}: ${seasonalFruitList().map(f=>t(f)).join(' · ')}</button></div>
    ${(()=>{ const ex=[]; (s.sides||[]).forEach(x=>ex.push([L('תוספת','Side'),t(x),eventQty(x,'side',s.guests)])); (s.drinks||[]).forEach(x=>ex.push([L('שתייה','Drink'),t(x),eventQty(x,'drink',s.guests)])); (s.desserts||[]).forEach(x=>{ if(x==='__fruit') ex.push([L('פירות','Fruit'),L('מגש פירות העונה','Seasonal fruit platter')+' ('+t(eventSeason())+')',eventQty('','fruit',s.guests)]); else ex.push([L('קינוח','Dessert'),t(x),eventQty(x,'dessert',s.guests)]); });
      return ex.length?`<div class="kbox k-ok" style="margin-top:14px"><b>${L('כמויות מומלצות ל-','Recommended quantities for ')}${s.guests} ${L('אורחים','guests')}:</b>${ex.map(e=>`<div class="mqty"><span>${e[0]}: ${e[1]}</span><b>${e[2]}</b></div>`).join('')}</div>`:''; })()}`}
    ${s.keys.length?`<div class="exactions" style="margin-top:16px">
      <button id="mCart">🛒 ${L('הוסף את כל המנות לרשימת קניות','Add all dishes to shopping list')}</button>
      <button id="mCopy">📋 ${L('העתק תוספות+שתייה','Copy sides+drinks')}</button>
      <button id="mTime">🕒 ${L('מתזמן','Scheduler')}</button>
      <button class="prbtn" style="position:static" data-print>⎙ ${L('הדפס תפריט','Print menu')}</button></div>`:''}
    ${printHtml}`;
  $("#mG").addEventListener('change',e=>{const st=menuState();st.guests=Math.max(1,+e.target.value||8);saveMenu(st);renderMenu();});
  $("#mA").addEventListener('change',e=>{const st=menuState();st.appetite=e.target.value;saveMenu(st);renderMenu();});
  { const gp=$("#mGpm"); if(gp) gp.addEventListener('change',e=>{const st=menuState();st.gpm=Math.max(0,+e.target.value||0);saveMenu(st);renderMenu();}); }
  { const mr=$("#mReset"); if(mr) mr.addEventListener('click',resetMenu); }
  $("#mK").addEventListener('click',()=>{const st=menuState();st.kosher=!st.kosher;if(st.kosher)st.keys=st.keys.filter(isKosherOk);saveMenu(st);renderMenu();});
  host.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{b.dataset.preset==='__fav'?presetFromFavs():b.dataset.preset==='__cart'?presetFromCart():presetMenu(b.dataset.preset);}));
  host.querySelectorAll('[data-mswap]').forEach(b=>b.addEventListener('click',()=>swapDish(+b.dataset.mswap)));
  host.querySelectorAll('[data-mrm]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();st.keys.splice(+b.dataset.mrm,1);saveMenu(st);renderMenu();}));
  const addB=$("#mAdd"),addC=$("#mAddCats");
  addB.addEventListener('click',()=>{
    addC.style.display=addC.style.display==='none'?'':'none';
    if(addC.style.display!=='none'){
      addC.innerHTML=allMenuCats().map(c=>`<button class="mchip" data-addcat="${c}" style="border-color:${catColor(c)};color:${catColor(c)}">${c}</button>`).join("");
      addC.querySelectorAll('[data-addcat]').forEach(cb=>cb.addEventListener('click',()=>{
        const st=menuState();const l=recipesInCat(cb.dataset.addcat,st.kosher).filter(k=>!st.keys.includes(k));
        if(l.length){ const pk=l[Math.floor(Math.random()*l.length)]; if(!st.keys.includes(pk)){ st.keys.push(pk); saveMenu(st); } renderMenu();}
      }));
    }
  });
  host.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();const v=b.dataset.side;st.sides=st.sides.includes(v)?st.sides.filter(x=>x!==v):[...st.sides,v];saveMenu(st);renderMenu();}));
  host.querySelectorAll('[data-drink]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();const v=b.dataset.drink;st.drinks=st.drinks.includes(v)?st.drinks.filter(x=>x!==v):[...st.drinks,v];saveMenu(st);renderMenu();}));
  host.querySelectorAll('[data-dessert]').forEach(b=>b.addEventListener('click',()=>{const st=menuState();st.desserts=st.desserts||[];const v=b.dataset.dessert;st.desserts=st.desserts.includes(v)?st.desserts.filter(x=>x!==v):[...st.desserts,v];saveMenu(st);renderMenu();}));
  const mc=$("#mCart");if(mc)mc.addEventListener('click',()=>{
    // menu IS the shopping list now — just open it
    updateCartBadge();
    openFrom(openMenu,openCart);
  });
  const mcp=$("#mCopy");if(mcp)mcp.addEventListener('click',()=>{const st=menuState();copyText(['תוספות:',...st.sides,'','שתייה:',...st.drinks].join('\n'));});
  const mt=$("#mTime");if(mt)mt.addEventListener('click',()=>{updateCartBadge();openFrom(openMenu,openTimeline);});
  host.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
}

/* ---- cook timeline scheduler ---- */
function fmtClock(d){ if(!d) return '—'; return d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}); }
// day offset of d relative to the serving day (negative = earlier calendar day)
function tlDayOffset(d, ref){ if(!d||!ref) return 0; const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()), b=new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()); return Math.round((a-b)/86400e3); }
function tlDayLabel(n){ if(n===0) return ''; if(n===-1) return L('יום לפני','day before'); if(n===-2) return L('יומיים לפני','2 days before'); if(n<0) return L(`${-n} ימים לפני`,`${-n} days before`); if(n===1) return L('למחרת','next day'); return L(`+${n} ימים`,`+${n} days`); }
// clock time + a "N days before" badge when the task falls on an earlier day than serving (e.g. a 30h sous-vide)
function fmtClockRel(d, ref){ const t=fmtClock(d); const lbl=tlDayLabel(tlDayOffset(d,ref)); return lbl? `<span class="wp-day">${lbl}</span>${t}` : t; }
function cssKey(k){ return k.replace(/[^a-zA-Z0-9_-]/g,'_'); }
function tlStateKey(){ return 'mk-tlstate-'+(typeof evScope==='function'?evScope():'cook'); }   // R2: per-event method/order/stage-done
function tlState(){return store.get(tlStateKey())||store.get('mk-tlstate')||{};}   // falls back to the legacy global once (migration)
function tlSetState(s){store.set(tlStateKey(),s);}

let _tlFocusKey=null, _tlFocusTid='', _tlAllOpen=false;   // selected item (across views) + the exact task (its timer id, so the right ROW highlights) + expand-all state
function _tlEsc(s){ return (window.CSS&&CSS.escape)?CSS.escape(String(s)):String(s); }
function openTimeline(focus){
  _tlFocusKey=null; _tlFocusTid='';   // fresh session — don't inherit a stale focus
  showPanel(`${toolTop(L('מתזמן ציר-זמן','Timeline scheduler'),L('שלבי הכנה מפורטים לכל פריט, לפי שעת הגשה','Detailed prep steps per item, by serve time'),'🕒','#cf6a4a')}
   <div class="panel-body" id="tlBody"></div>`);
  renderTimelinePanel();
  if(focus) _tlFocusItem(focus);
}
// scroll the timeline to a specific item and expand its steps — `focus` may be a stage-timer id
// (st-<scope>-<itemKey>-<kind>), a recipe-timer id (cut-1-sv-0), or a bare item key (cut-1)
function _tlFocusItem(focus){
  let ik=(typeof timerItemKey==='function')?timerItemKey(focus):'';   // resolve the item key up front for reliable matching
  if(!ik && /^(cut|spec|make)-/.test(String(focus)) && typeof resolveItem==='function'){ try{ if(resolveItem(String(focus))) ik=String(focus); }catch(e){} }   // focus is already a bare item key (e.g. re-applied across a view switch)
  _tlFocusKey = ik || String(focus||'') || null;                        // remember it so view switches can re-apply
  if(focus && String(focus)!==ik && String(focus).indexOf('st-')===0) _tlFocusTid=String(focus);   // came in on a specific stage timer → keep that exact task highlighted
  const esc=function(s){ return (window.CSS&&CSS.escape)?CSS.escape(String(s)):String(s); };
  const belongs=function(tid){ if(!tid) return false; if(!ik) return false; return tid===ik || tid.indexOf('-'+ik+'-')>=0 || tid.indexOf(ik+'-')===0 || ((typeof timerItemKey==='function')&&timerItemKey(tid)===ik); };
  let tries=0;
  const attempt=function(){ try{
    const list=$("#tlList"); if(!list){ if(tries++<30) setTimeout(attempt,50); return; }
    const ready = list.querySelector('[data-tlexp]') || list.querySelector('[data-tid]') || list.querySelector('.workplan');
    if(!ready){ if(tries++<30) setTimeout(attempt,50); return; }   // wait for the plan to render (either view), retry ~1.5s

    let target=null, hi=null, expandCk=null;
    // 1) the EXACT timer element — present in BOTH the by-item and the work-plan views (same data-tid)
    const tEl = list.querySelector('[data-tid="'+esc(focus)+'"]');
    if(tEl){ const card=tEl.closest('.tlcard');
      if(card){ const stageRow=tEl.closest('.tl-stage'); target=stageRow||card; hi=target; const xb=card.querySelector('[data-tlexp]'); expandCk=xb&&xb.getAttribute('data-ck'); }   // by-item: land on the exact STEP inside the card, not just the card top
      else { target=tEl.closest('.wp-row,.wp-acc,.wp-hcell')||tEl; hi=target; }
    }
    // 2) fall back to the item card matched by its key (bare item key, or no exact timer element)
    if(!target){ list.querySelectorAll('[data-tlexp]').forEach(function(b){ if(target) return; const k=b.getAttribute('data-tlexp');
      if(k && (k===ik || String(focus)===k || String(focus).indexOf('-'+k+'-')>=0 || String(focus).indexOf(k+'-')===0)){ target=b.closest('.tlcard'); hi=target; expandCk=b.getAttribute('data-ck'); } }); }
    // 3) work-plan view with only an item key: first task/timer element that belongs to the item
    if(!target && ik){ const els=list.querySelectorAll('[data-tid]'); for(let i=0;i<els.length;i++){ if(belongs(els[i].getAttribute('data-tid'))){ target=els[i].closest('.wp-row,.wp-acc,.wp-hcell,.tlcard')||els[i]; hi=target; const xb=target.querySelector&&target.querySelector('[data-tlexp]'); expandCk=xb&&xb.getAttribute('data-ck'); break; } } }
    if(!target) return;
    if(expandCk){ const stg=document.getElementById('tlstages-'+expandCk); if(stg) stg.style.display='block'; }   // expand steps (by-item view)
    const acc=target.closest&&target.closest('.wp-acc'); if(acc) acc.classList.add('open');                        // open the task (accordion work-plan view)
    if(hi){ hi.classList.add('tl-focus'); setTimeout(function(){ try{ hi.classList.remove('tl-focus'); }catch(e){} }, 2800); }
    // robust manual scroll of the panel body (scrollIntoView is unreliable inside a fixed+transformed panel);
    // measure on the next frame so the just-applied expansion is laid out first
    requestAnimationFrame(function(){ try{ const scroller=target.closest('.panel-body');
      if(scroller){ const cr=target.getBoundingClientRect(), sr=scroller.getBoundingClientRect(); scroller.scrollBy({top:(cr.top-sr.top)-(sr.height-cr.height)/2, behavior:'smooth'}); }
      else target.scrollIntoView({block:'center'});
    }catch(e){ try{ target.scrollIntoView({block:'center'}); }catch(_){} } });
  }catch(e){} };
  requestAnimationFrame(attempt);
  _tlMarkSelected();   // reflect the (new) selection persistently
}
// user picks a selection. `el` (when given) is the exact element tapped → highlight THAT one, and remember its
// item (for cross-view) and its task timer-id (so the same ROW re-highlights on re-render).
function _tlSelect(itemKey, el){
  if(!itemKey) return; _tlFocusKey=itemKey;
  const tEl = el && el.querySelector ? el.querySelector('[data-tid]') : null;
  _tlFocusTid = tEl ? (tEl.getAttribute('data-tid')||'') : (el && el.getAttribute ? (el.getAttribute('data-tid')||'') : '');
  const list=$("#tlList");
  if(list && el){ list.querySelectorAll('.tl-sel').forEach(function(e){ e.classList.remove('tl-sel'); }); el.classList.add('tl-sel'); }   // highlight exactly what was tapped
  else _tlMarkSelected();
}
// paint a SINGLE persistent selection marker for the current selection (re-run after each render) — never multiple
function _tlMarkSelected(){
  const list=$("#tlList"); if(!list) return;
  list.querySelectorAll('.tl-sel,.tl-step-sel').forEach(function(e){ e.classList.remove('tl-sel'); e.classList.remove('tl-step-sel'); });
  const ik=_tlFocusKey; if(!ik) return;
  // by-item view → the item's card, plus a marker on the exact step we came from
  let card=null;
  list.querySelectorAll('[data-tlexp]').forEach(function(b){ if(!card && b.getAttribute('data-tlexp')===ik) card=b.closest('.tlcard'); });
  if(card){ card.classList.add('tl-sel');
    if(_tlFocusTid){ const tt=card.querySelector('[data-tid="'+_tlEsc(_tlFocusTid)+'"]'); const row=tt&&tt.closest('.tl-stage'); if(row) row.classList.add('tl-step-sel'); }
    return; }
  // work-plan view → the EXACT task by its timer-id if we have one, else the item's first task. One element.
  let target=null;
  if(_tlFocusTid){ const t=list.querySelector('[data-tid="'+_tlEsc(_tlFocusTid)+'"]'); if(t) target=t.closest('[data-tlitem]')||t; }
  if(!target) target=list.querySelector('[data-tlitem="'+_tlEsc(ik)+'"]');
  if(target) target.classList.add('tl-sel');
}
/* ---------- voice cook mode (TTS + closed voice commands) ---------- */
let vcTasks=[], vcIdx=0, vcRec=null, vcVoices=[];
let tlTimers=[]; // in-session timeline notification timers
function stripEmoji(t){return String(t).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
// נרמול טקסט להגייה עברית טובה: קיצורים, סמלים ומספרים
function hebSpeechText(t){
  let s=stripEmoji(t);
  s=s.replace(/(\d+(?:\.\d+)?)\s*°C?/g,'$1 מעלות');
  s=s.replace(/~\s*/g,'בערך ');
  s=s.replace(/ק["״]ג/g,'קילו').replace(/ק"ג/g,'קילו');
  s=s.replace(/דק['׳]/g,'דקות').replace(/\bדק\b/g,'דקות');
  s=s.replace(/(\d+)\s*ש\b/g,'$1 שעות');
  s=s.replace(/שעה\/שעתיים/g,'שעה או שעתיים');
  s=s.replace(/(\d+)-(\d+)/g,'$1 עד $2');
  s=s.replace(/\bMR\b/gi,'מדיום רייר').replace(/\bmw\b/gi,'מדיום ול');
  s=s.replace(/·|•/g,', ').replace(/\s*\/\s*/g,' או ');
  s=s.replace(/\bכפ['׳]\b/g,'כפות').replace(/\bכפית\b/g,'כפית');
  s=s.replace(/\(([^)]*)\)/g,', $1,');
  return s.replace(/\s+/g,' ').trim();
}
/* ── bilingual voice (v132): input(ASR) lang + answer(TTS) lang ── */
function vcLang(){ return store.get('mk-vclang')||((typeof getLang==='function'&&getLang()!=='he')?'en':'he'); }        // recognition language — defaults to the UI language
function vcAnsLang(){ return store.get('mk-vcanslang')||vcLang(); } // answer/TTS language
function vcLocale(l){ return l==='en'?'en-US':'he-IL'; }
function enSpeechText(t){ return stripEmoji(String(t)).replace(/·|•/g,', ').replace(/\s+/g,' ').trim(); }
function speechText(t, lang){ return (lang==='en')?enSpeechText(t):hebSpeechText(t); }
function vcPickVoice(lang){
  const want=(lang||vcAnsLang());
  const rx = want==='en' ? /en[-_]/i : /he|iw/i;
  const list=(speechSynthesis.getVoices()||[]).filter(v=>rx.test(v.lang));
  if(want!=='en') vcVoices=list;    // keep he list for the picker UI
  const savedName=(want!=='en')?store.get('mk-vcvoice'):null;
  let v=savedName&&list.find(x=>x.name===savedName);
  if(!v) v=list.find(x=>/google/i.test(x.name));
  if(!v) v=list[0];
  return v||null;
}
if(window.speechSynthesis) speechSynthesis.onvoiceschanged=()=>{ vcPickVoice(); const s=$("#vcVoiceSel"); if(s&&$("#vcBody")) vcRender(); };
/* ── Gemini TTS (איכות פרימיום, אופציונלי — מפתח אישי) ── */
const GEM_VOICES=['Kore','Aoede','Puck','Charon','Fenrir','Leda'];
const gemCache=new Map();           // text → AudioBuffer (מטמון להקראות חוזרות)
let gemCtx=null, gemSrc=null, vcSpeaking=false;
function gemKey(){return store.get('mk-gemkey')||'';}
// managed central AI (dev): a Worker holds the key server-side, gated by a per-user access code. Configured per device.
function centralUrl(){ const u=store.get('mk-central-url')||''; return u?String(u).trim().replace(/\/+$/,''):''; }
function centralCode(){ return (store.get('mk-central-code')||'').trim(); }
function gemMode(){ return (centralUrl() && centralCode()) ? 'managed' : (gemKey() ? 'byok' : 'off'); }
function gemVoice(){return store.get('mk-gemvoice')||'Kore';}
function gemStop(){ if(gemSrc){try{gemSrc.stop();}catch(e){} gemSrc=null;} vcSpeaking=false; }
function b64ToPcm16(b64){
  const bin=atob(b64), len=bin.length, bytes=new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}
function pcmToBuffer(pcm, rate){
  gemCtx=gemCtx||new (window.AudioContext||window.webkitAudioContext)();
  const buf=gemCtx.createBuffer(1, pcm.length, rate);
  const ch=buf.getChannelData(0);
  for(let i=0;i<pcm.length;i++) ch[i]=pcm[i]/32768;
  return buf;
}
async function gemSpeak(text, lang){
  const key=gemKey(); if(!key) throw new Error('no-key');
  const clean=speechText(text, lang||vcAnsLang());
  let buf=gemCache.get(clean+gemVoice());
  if(!buf){
    const r=await gemFetch('gemini-2.5-flash-preview-tts', {contents:[{parts:[{text:clean}]}], generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:gemVoice()}}}}}, {timeout:20000});
    if(!r.ok){ let reason=''; try{const eb=await r.json(); reason=(eb.error&&eb.error.message)||'';}catch(_){}
      console.warn('Gemini TTS error',r.status,reason); throw new Error('api-'+r.status+(reason?': '+reason:'')); }
    const j=await r.json();
    const part=j.candidates&&j.candidates[0]&&j.candidates[0].content.parts.find(p=>p.inlineData);
    if(!part) throw new Error('no-audio');
    const rate=parseInt((part.inlineData.mimeType.match(/rate=(\d+)/)||[])[1]||'24000');
    buf=pcmToBuffer(b64ToPcm16(part.inlineData.data), rate);
    if(gemCache.size>40) gemCache.clear();
    gemCache.set(clean+gemVoice(), buf);
  }
  gemStop();
  gemCtx=gemCtx||new (window.AudioContext||window.webkitAudioContext)();
  if(gemCtx.state==='suspended') await gemCtx.resume();
  gemSrc=gemCtx.createBufferSource(); gemSrc.buffer=buf; gemSrc.connect(gemCtx.destination);
  vcSpeaking=true; gemSrc.onended=()=>{vcSpeaking=false;};
  gemSrc.start();
}
function sysSpeak(text, lang){
  try{
    const L=lang||vcAnsLang();
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(speechText(text, L));
    u.lang=vcLocale(L); u.rate=0.92; u.pitch=1;
    const v=vcPickVoice(L); if(v) u.voice=v;
    speechSynthesis.speak(u);
  }catch(e){ toast('הקראה אינה נתמכת בדפדפן זה'); }
}
function vcSpeak(text, lang){
  const L=lang||vcAnsLang();
  gemStop(); try{speechSynthesis.cancel();}catch(e){}
  if(gemKey()){
    gemSpeak(text, L).catch(err=>{
      const s=String(err.message||err);
      let m='';
      if(s.includes('api-429')||/quota|RESOURCE_EXHAUSTED/i.test(s)) m='חריגת מכסה — הקראה קולית (TTS) מוגבלת מאוד בשכבה החינמית של Gemini וייתכן שדורשת חשבון עם חיוב.';
      else if(s.includes('api-403')||/permission|billing|PERMISSION/i.test(s)) m='מודל ההקראה (TTS) אינו זמין למפתח זה — לרוב דורש הפעלת חיוב (Billing) בפרויקט. ה-AI הטקסטואלי ימשיך לעבוד.';
      else if(s.includes('api-404')||/not found|NOT_FOUND/i.test(s)) m='מודל ההקראה לא נמצא — ייתכן שהשם השתנה בצד Google.';
      else if(s.includes('api-4')) m='מפתח שגוי או בעיה בהרשאה.';
      if(m) toast(L('קול Gemini: ','Gemini voice: ')+m+L(' עובר לקול המערכת.',' — switching to the system voice.'));
      sysSpeak(text, L);
    });
  } else sysSpeak(text, L);
}
function vcCurrentText(full){
  const t=vcTasks[vcIdx]; if(!t) return L('אין משימות','No tasks');
  if(full) return t.det ? t.det : (t.sub||L('אין פרטים נוספים למשימה הזו','No further details for this task'));
  let s=`${fmtClock(t.t)}. ${t.label}.`;
  if(t.sub) s+=' '+t.sub+'.';
  return s;
}
function vcRender(){
  const host=$("#vcBody"); if(!host) return;
  if(typeof clearTimers==='function') clearTimers();   // stop stale intervals; timers restore from mk-timers
  const t=vcTasks[vcIdx];
  host.innerHTML=t?`
    <div class="vc-pos">${L('משימה','Task')} ${vcIdx+1} ${L('מתוך','of')} ${vcTasks.length}</div>
    <div class="vc-card wp-${t.kind}">
      <div class="vc-time">${fmtClock(t.t)}</div>
      <div class="vc-label">${t.label}</div>
      ${t.sub?`<div class="vc-sub">${t.sub}</div>`:''}
      ${t.det?`<div class="vc-det">${t.det}</div>`:''}
    </div>
    ${(function(){
      if(t.dur && t.tid){ return `<div class="vc-timerwrap"><div class="vc-timerlbl">⏱ ${esc(stripEmoji(t.label))}</div>${timerHTML(t.dur, t.tid, t.label)}</div>`; }   // synced with the work-plan stage timer
      const nx=vcTasks[vcIdx+1]; if(!nx||!(t.t instanceof Date)||!(nx.t instanceof Date)) return ''; const d=Math.round((nx.t-t.t)/1000); if(d<=0||d>24*3600) return '';
      return `<div class="vc-timerwrap"><div class="vc-timerlbl">⏱ ${L('טיימר — עד המשימה הבאה','Timer — until the next task')} (${fmtClock(nx.t)})</div>${timerHTML(d, 'vc-'+(t.t?t.t.getTime():vcIdx))}</div>`;
    })()}
    ${(function(){
      const ts=store.get('mk-timers')||{}, now=Date.now();
      const runners=vcTasks.map((tk,i)=>({tk,i})).filter(o=>o.tk.tid && ts[o.tk.tid] && ts[o.tk.tid].end && ts[o.tk.tid].end>now);
      if(runners.length<2) return '';   // the current task's timer is already prominent; strip is for 2+ in parallel
      return `<div class="vc-running"><div class="vc-running-lbl">🔴 ${L('רצים במקביל','running in parallel')} (${runners.length})</div>${runners.map(o=>{ const rem=Math.round((ts[o.tk.tid].end-now)/1000); return `<button class="vc-runchip ${o.i===vcIdx?'on':''}" data-vcjump="${o.i}">${esc(stripEmoji(o.tk.label))} · ${fmt(rem)}</button>`; }).join('')}</div>`;
    })()}
    <div class="vc-btns">
      <button class="vc-big" data-vc="prev">⏮ ${L('הקודם','Previous')}</button>
      <button class="vc-big vc-main" data-vc="read">🔊 ${L('הקרא','Read')}</button>
      <button class="vc-big" data-vc="next">${L('הבא','Next')} ⏭</button>
    </div>
    <div class="vc-btns2">
      <button class="vc-q" data-vc="readfull">📖 ${L('הקרא עם פרטים','Read with details')}</button>
      <button class="vc-q" data-vc="qtemp">🌡️ ${L('מה הטמפרטורה?','What is the temperature?')}</button>
      <button class="vc-q" data-vc="qwhen">⏰ ${L('מתי הבא?','When is the next?')}</button>
      <button class="vc-q ${vcRec?'on':''}" data-vc="mic">${vcRec?'🎙️ '+L('מאזין… (אמור: הבא / חזור / הקרא)','Listening… (say: next / back / read)'):'🎙️ '+L('פקודות קוליות','Voice commands')}</button>
    </div>
    ${vcTasks.length>2?`<div class="vc-jumprow"><label>🎯 ${L('קפוץ לשלב:','Jump to step:')}</label><select id="vcStepJump">${vcTasks.map((tk,i)=>`<option value="${i}" ${i===vcIdx?'selected':''}>${esc(fmtClock(tk.t)+' · '+stripEmoji(tk.label))}</option>`).join('')}</select></div>`:''}
    <p class="vc-hint">💡 ${L('מסך גדול, כפתורים גדולים — נועד לעמוד ליד המעשנת. פקודות: "הבא", "הקודם", "הקרא שוב", "פרטים".','Big screen, big buttons — meant to stand by the smoker. Commands: "next", "back", "read again", "details".')}</p>
    <div class="vc-langrow">
      <span class="vc-langlbl">🎙️ ${L('שפת דיבור:','Speech language:')}</span>
      <button class="vc-langbtn ${vcLang()==='he'?'on':''}" data-vc="lang-he">עברית</button>
      <button class="vc-langbtn ${vcLang()==='en'?'on':''}" data-vc="lang-en">English</button>
      <span class="vc-langlbl">🔊 ${L('תשובה:','Answer:')}</span>
      <button class="vc-langbtn ${vcAnsLang()==='he'?'on':''}" data-vc="anslang-he">עברית</button>
      <button class="vc-langbtn ${vcAnsLang()==='en'?'on':''}" data-vc="anslang-en">English</button>
    </div>
    <p class="vc-hint">${vcLang()==='en'?'🇬🇧 Voice commands: next · back · read · details · temperature · when.':'פקודות עבריות: הבא · הקודם · הקרא · פרטים · טמפרטורה · מתי.'} ${L('דיבור באנגלית מזוהה לרוב מדויק יותר.','English speech is usually recognized more accurately.')}</p>
    ${aiAvail()?`<p class="vc-hint">✨ ${L('אפשר לשאול שאלות חופשיות בקול (למשל "כמה עוד זמן לחזה?") — אפשר לשאול באנגלית ולקבל תשובה בעברית.','You can ask free questions by voice (e.g. "how much longer for the brisket?") — you can ask in English and get an answer in Hebrew.')}</p>
    <div class="vc-askrow"><input id="vcAskInput" placeholder="${vcAnsLang()==='en'?'Type a question…':'הקלד שאלה…'}"><button class="vc-askbtn" data-vc="asktext">${vcAnsLang()==='en'?'Ask ✨':'שאל ✨'}</button></div>
    ${vcLastQA?`<div class="vc-qa"><div class="vc-qa-q">❓ ${esc(vcLastQA.q)}</div><div class="vc-qa-a">${esc(vcLastQA.a)}</div></div>`:''}`:''}
    ${gemKey()?`<div class="vc-voicerow">✨ ${L('Gemini TTS פעיל','Gemini TTS active')} · <label>${L('קול:','Voice:')}</label><select id="gemVoiceSel">${GEM_VOICES.map(v=>`<option ${v===gemVoice()?'selected':''}>${v}</option>`).join('')}</select> <button class="vc-keybtn" data-vc="gemoff">${L('נתק','Disconnect')}</button></div>`
      :`<details class="vc-gem"><summary>✨ ${L('שדרוג איכות קול — Gemini TTS (מפתח אישי · דורש Billing)','Upgrade voice quality — Gemini TTS (personal key · requires Billing)')}</summary>
        <p>${L('קולות ניורליים עם עברית טבעית. צור מפתח ב-<b>aistudio.google.com</b> → Get API Key, והדבק כאן. נשמר רק בדפדפן שלך, דורש רשת. ⚠ הקראת Gemini היא מודל בתשלום — דורש הפעלת <b>Billing</b> בפרויקט (מכסה חינמית נדיבה גם אז); אחרת יישאר קול המערכת.','Neural voices with natural speech. Create a key at <b>aistudio.google.com</b> → Get API Key, and paste it here. Stored only in your browser, requires network. ⚠ Gemini read-aloud is a paid model — it requires enabling <b>Billing</b> on the project (a generous free quota even then); otherwise the system voice stays.')}</p>
        <div class="vc-keyrow"><input type="password" id="gemKeyInp" placeholder="${L('הדבק מפתח API...','Paste API key...')}"><button class="vc-keybtn" data-vc="gemsave">${L('שמור','Save')}</button></div>
      </details>`}
    ${vcVoices.length>1&&!gemKey()?`<div class="vc-voicerow"><label>${L('קול מערכת:','System voice:')}</label><select id="vcVoiceSel">${vcVoices.map(v=>`<option value="${v.name}" ${v===vcPickVoice()?'selected':''}>${v.name} (${v.lang})</option>`).join('')}</select></div>`
      :(vcVoices.length===0&&!gemKey()?`<p class="vc-hint">${L('⚠ לא נמצא קול עברי במכשיר — באנדרואיד: הגדרות ← ניהול כללי ← המרת טקסט לדיבור ← התקן/בחר "שירותי הדיבור של Google" עם עברית.','⚠ No Hebrew voice found on the device — on Android: Settings → General management → Text-to-speech → install/select "Google speech services" with Hebrew.')}</p>`:'')}`
   :`<div class="shop-empty">${L('אין משימות — בנה תוכנית עבודה במתזמן ואז חזור.','No tasks — build a work plan in the scheduler, then come back.')}</div>`;
  host.querySelectorAll('[data-vc]').forEach(b=>b.addEventListener('click',()=>vcAction(b.dataset.vc)));
  host.querySelectorAll('[data-vcjump]').forEach(b=>b.addEventListener('click',()=>{ vcIdx=+b.dataset.vcjump; vcRender(); vcSpeakContent(vcCurrentText(false)); }));   // jump to a parallel running timer
  { const js=host.querySelector('#vcStepJump'); if(js) js.addEventListener('change',function(){ const i=parseInt(js.value,10); if(!isNaN(i)&&i>=0&&i<vcTasks.length){ vcIdx=i; vcRender(); vcSpeakContent(vcCurrentText(false)); } }); }   // shortcut: jump straight to any work-plan step
  // voice-cook timer: a spoken warning before it expires + a spoken alert at expiry (uses the existing TTS)
  { const tm=host.querySelector('.vc-timerwrap .timer'); if(tm){ const total=+tm.dataset.sec; const warnAt=total>150?120:(total>60?30:0);
      wireTimer(tm, { warnSec:warnAt,
        onWarn:function(left){ const min=Math.round(left/60); vcSpeak(vcAnsLang()==='en'?(left>=60?min+' minutes left':'less than a minute left'):(left>=60?'עוד כ-'+min+' דקות':'עוד פחות מדקה')); },
        onEnd:function(){ vcSpeak(vcAnsLang()==='en'?'Time is up for this step.':'הזמן לשלב הזה נגמר.'); } }); } }
  { const ai=host.querySelector('#vcAskInput'); if(ai) ai.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=ai.value.trim(); if(q) vcAskFlow(q); } }); }
  { const vs=host.querySelector('#vcVoiceSel'); if(vs) vs.addEventListener('change',()=>{ store.set('mk-vcvoice',vs.value); vcSpeak('זה הקול הנבחר. נשמע טוב?'); }); }
  { const gs=host.querySelector('#gemVoiceSel'); if(gs) gs.addEventListener('change',()=>{ store.set('mk-gemvoice',gs.value); vcSpeak('שלום! זה הקול החדש של ההקראה. נשמע טוב?'); }); }
}
function vcAction(a){
  const t=vcTasks[vcIdx];
  const en=vcAnsLang()==='en';
  if(a==='next'&&vcIdx<vcTasks.length-1){vcIdx++;vcRender();vcSpeakContent(vcCurrentText(false));}
  else if(a==='prev'&&vcIdx>0){vcIdx--;vcRender();vcSpeakContent(vcCurrentText(false));}
  else if(a==='read') vcSpeakContent(vcCurrentText(false));
  else if(a==='readfull') vcSpeakContent(vcCurrentText(true));
  else if(a==='qtemp'){
    const m=(t&&((t.det||'')+' '+(t.label||'')).match(/(\d{2,3})°/));
    const chamber = t && (t.kind==='smoke'||t.kind==='cook');   // matched temp is the pit/chamber, not the internal
    const bcheck = t && t.kind==='bcheck';                       // this step IS the internal-temp check
    if(en) vcSpeak(m?`${m[1]} degrees${bcheck?' — that is the target core temperature; check with a probe before serving':chamber?' — that is the chamber temperature; pull when the core reaches the safe internal temp':''}.`:'No temperature for this step.', 'en');
    else vcSpeak(m?(bcheck?`טמפרטורת יעד בליבה: ${m[1]} מעלות — בדוק עם מד-חום לפני הגשה`:chamber?`טמפרטורת התא: ${m[1]} מעלות — הוצא כשהפנים מגיע לטמפרטורה הבטוחה`:`הטמפרטורה: ${m[1]} מעלות`):'אין טמפרטורה במשימה הזו', 'he');
  }
  else if(a==='qwhen'){
    const nx=vcTasks[vcIdx+1];
    const say=en?(nx?`Next task at ${fmtClock(nx.t)}: ${stripEmoji(nx.label)}`:'That was the last task.')
               :(nx?`המשימה הבאה בשעה ${fmtClock(nx.t)}: ${stripEmoji(nx.label)}`:'זו המשימה האחרונה');
    vcSpeak(say, vcAnsLang());   // build in the answer language, speak directly (same voice as the other buttons)
  }
  else if(a==='mic') vcToggleMic();
  else if(a==='asktext'){ const inp=$("#vcAskInput"); const q=inp&&inp.value.trim(); if(q) vcAskFlow(q); }
  else if(a==='lang-he'){ store.set('mk-vclang','he'); const wasOn=!!vcRec; if(wasOn){vcRec._stop=true;try{vcRec.stop();}catch(e){}vcRec=null;} vcRender(); if(wasOn) vcToggleMic(); }
  else if(a==='lang-en'){ store.set('mk-vclang','en'); const wasOn=!!vcRec; if(wasOn){vcRec._stop=true;try{vcRec.stop();}catch(e){}vcRec=null;} vcRender(); if(wasOn) vcToggleMic(); }
  else if(a==='anslang-he'){ store.set('mk-vcanslang','he'); vcRender(); vcSpeak('התשובות יהיו בעברית','he'); }
  else if(a==='anslang-en'){ store.set('mk-vcanslang','en'); vcRender(); vcSpeak('Answers will be in English','en'); }
  else if(a==='gemsave'){
    const inp=$("#gemKeyInp"); const k=(inp&&inp.value||'').trim();
    if(k.length<20){ toast('מפתח לא תקין'); return; }
    store.set('mk-gemkey',k); vcRender();
    vcSpeak('מעולה! Gemini מחובר. ככה אני נשמע עכשיו.');
  }
  else if(a==='gemoff'){ store.set('mk-gemkey',''); gemCache.clear(); vcRender(); toast('Gemini נותק — חוזרים לקול המערכת'); }
}
/* ── voice AI Q&A (v132) — free-form questions during cooking, bilingual ── */
let vcLastQA=null;   // {q, a} for on-screen transcript
const vcTransCache=new Map();   // hebText → enText (avoid re-translating on repeat reads)
async function vcTranslateToEn(text){
  const src=String(text||'').trim(); if(!src) return '';
  if(vcTransCache.has(src)) return vcTransCache.get(src);
  if(typeof window!=='undefined' && window.__vcTransMock!==undefined && window.__vcTransMock!==null){
    const m=window.__vcTransMock; const out=(typeof m==='function'?m(src):m); vcTransCache.set(src,out); return out;
  }
  if(!aiAvail()) throw new Error('no-key');   // managed central access OR a personal key
  const body={ system_instruction:{parts:[{text:'Translate the following Hebrew cooking-instruction text to natural spoken English. Reply with ONLY the English translation, no quotes, no notes.'}]},
    contents:[{role:'user',parts:[{text:src}]}],
    generationConfig:{temperature:0.2,maxOutputTokens:300,thinkingConfig:{thinkingBudget:0}} };
  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json(); const cand=j.candidates&&j.candidates[0];
  const out=(cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim())||src;
  vcTransCache.set(src,out); return out;
}
// speak app CONTENT (task steps), translating to English when the answer language is English
async function vcSpeakContent(text){
  const ansL=vcAnsLang();
  const contentHe=(typeof getLang!=='function')||getLang()==='he';   // vcTasks content is built in the UI language
  if(ansL!=='en'){ vcSpeak(text, ansL); return; }                    // Hebrew answers → speak as-is
  if(!contentHe){ vcSpeak(text, 'en'); return; }                     // content is already English → speak directly (no translation, no key needed) — keeps every button on the same voice
  if(!aiAvail()){ // Hebrew content + English answers, but no key to translate — read the Hebrew, flag it
    if(typeof toast==='function') toast(L('תרגום לאנגלית דורש מפתח AI — מקריא בעברית','English translation needs an AI key — reading in Hebrew'));
    vcSpeak(text, 'he'); return;
  }
  try{ const en=await vcTranslateToEn(text); vcSpeak(en, 'en'); }
  catch(e){ vcSpeak(text, 'he'); }
}
// W2-P5: the live-session state as grounding for the voice Ask (so "how much longer?" uses the real ETA).
function copilotVoiceContext(){
  const s=(typeof liveSession==='function')?liveSession():null;
  if(!s) return '';
  const parts=[];
  if(typeof s.startedAt==='number') parts.push('זמן מתחילת המושב: '+Math.round((Date.now()-s.startedAt)/60000)+' דק׳');
  if(typeof s.targetC==='number') parts.push('טמפ׳-יעד פנימית: '+s.targetC+'°C');
  const pace=(typeof copilotPace==='function')?copilotPace(s):null;
  if(pace){
    if(pace.lastTemp!=null) parts.push('קריאת מדחום אחרונה: '+pace.lastTemp+'°C');
    if(pace.state==='projected'){ parts.push('קצב ~'+pace.rate+'°C/ש');
      if(pace.etaMs && typeof fmtClock==='function') parts.push('צפי סיום ~'+fmtClock(new Date(pace.etaMs)));
      if(pace.verdict) parts.push('מול ההגשה: '+(pace.verdict==='behind'?'מאחר':(pace.verdict==='ahead'?'מקדים':'בקצב'))+(typeof pace.slackMin==='number'?' ('+pace.slackMin+' דק׳)':'')); }
    else if(pace.state==='stall') parts.push('כרגע בסטָאל — הטמפ׳ שטוחה סביב 65-77°C');
    else if(pace.state==='done') parts.push('הגיע לטמפ׳ היעד');
  }
  return parts.length ? (' מצב הבישול החי: '+parts.join(' · ')+'.') : '';
}
function vcCookContext(){
  const t=vcTasks[vcIdx];
  const live=copilotVoiceContext();
  let base='';
  if(t){ const parts=[stripEmoji(t.label||'')]; if(t.sub) parts.push(stripEmoji(t.sub)); if(t.det) parts.push(stripEmoji(t.det));
    base='ההקשר: המשתמש מבשל כרגע, בשלב "'+parts.join(' · ').slice(0,300)+'".'; }
  return (base+live).trim();
}
// question detection per language (Hebrew \b is unreliable — use explicit separators)
function vcLooksLikeQuestion(said){
  const s=(said||'').trim().toLowerCase();
  if(/^(שאלה|תשאל|תשאלי|ask|question)[\s:,]/.test(s)) return true;
  if(/[?？]/.test(s)) return true;
  if(/(^|\s)(מה|כמה|למה|איך|מתי|האם|כדאי|איזה|מהי|מהו|מדוע)(\s|$)/.test(s)) return true;
  return /\b(what|how|why|when|which|should|can|is|are|does|how much|how long)\b/.test(s);
}
function vcStripAskPrefix(said){ return String(said||'').replace(/^(שאלה|תשאל|תשאלי|ask|question)[:,\s]+/i,'').trim(); }
// pure prompt builder (testable) — fully language-matched to force the answer language
function vcBuildAskPrompt(question, ansLang, ctx){
  ctx=ctx||'';
  let sys;
  if(ansLang==='en'){
    sys='You are "The Fire" — a live-fire cooking assistant inside an app. '
      +'CRITICAL: You MUST reply in ENGLISH ONLY, even though the question or context may be in Hebrew. '
      +'Keep it brief (2-3 sentences max), suitable for text-to-speech while the user is actively cooking. '
      +'Do not invent safety temperatures — if unsure, say so.'
      +(ctx?(' Context (may be in Hebrew, translate as needed): '+ctx):'');
  } else {
    sys='אתה "האש" — עוזר בישול-אש חי בתוך אפליקציה. '
      +'חשוב: ענה אך ורק בעברית. '
      +'בקצרה (2-3 משפטים לכל היותר), מתאים להקראה בזמן בישול פעיל. '
      +'אל תמציא טמפרטורות בטיחות — אם אינך בטוח, אמור זאת.'+((typeof pref==='function'&&pref('units')==='metric')?' השתמש ביחידות מטריות בלבד (°C, ס״מ, ק״ג).':'')+(ctx?(' '+ctx):'');
  }
  const userText = ansLang==='en' ? (question+'\n\n(Reply in English only.)') : (question+'\n\n(ענה בעברית בלבד.)');
  return {sys, userText};
}
async function vcAskAI(question){
  if(typeof window!=='undefined' && window.__vcAskMock!==undefined && window.__vcAskMock!==null){
    const m=window.__vcAskMock; return typeof m==='function'?m(question):m;
  }
  if(!aiAvail()) throw new Error('no-key');   // managed central access OR a personal key
  const ans=vcAnsLang();
  const {sys, userText}=vcBuildAskPrompt(question, ans, vcCookContext());
  const body={ system_instruction:{parts:[{text:sys}]},
    contents:[{role:'user',parts:[{text:userText}]}],
    tools:[{google_search:{}}],
    generationConfig:{temperature:0.6,maxOutputTokens:400,thinkingConfig:{thinkingBudget:0}} };
  const r=await gemFetch(GEM_MODEL, body, {timeout:30000});
  if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json(); const cand=j.candidates&&j.candidates[0];
  const txt=cand&&cand.content&&(cand.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!txt) throw new Error('empty');
  return txt;
}
async function vcAskFlow(rawSaid){
  const question=vcStripAskPrefix(rawSaid);
  if(!question){ return; }
  const ansL=vcAnsLang();
  vcSpeak(ansL==='en'?'One moment, checking.':'רגע, בודק.', ansL);
  vcLastQA={q:question, a:(ansL==='en'?'…thinking':'…חושב')}; vcRender();
  try{
    const answer=await vcAskAI(question);
    vcLastQA={q:question, a:answer}; vcRender();
    vcSpeak(answer, ansL);
  }catch(e){
    const msg=ansL==='en'?'Sorry, AI is not available right now.':'מצטער, ה-AI לא זמין כרגע.';
    vcLastQA={q:question, a:msg}; vcRender(); vcSpeak(msg, ansL);
  }
}

function vcToggleMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast('זיהוי דיבור אינו נתמך בדפדפן זה (נתמך בכרום-אנדרואיד) — השתמש בכפתורים'); return; }
  if(vcRec){ vcRec._stop=true; try{vcRec.stop();}catch(e){} vcRec=null; vcRender(); toast('האזנה כבויה'); return; }
  // בקשת הרשאת מיקרופון מפורשת — מפעילה את חלון האישור באמינות
  const startRec=()=>{ try{
    const rec=new SR(); vcRec=rec;
    rec.lang=vcLocale(vcLang()); rec.continuous=false; rec.interimResults=false; rec.maxAlternatives=3;   // one-shot: אמין יותר באנדרואיד
    rec.onresult=(ev)=>{
      if(speechSynthesis.speaking||vcSpeaking) return;    // אל תקלוט את ההקראה של עצמנו
      const alts=[...ev.results[0]].map(r=>r.transcript.trim());
      const said=alts.join(' | ');
      const hit=(re)=>alts.some(a=>re.test(a));
      let acted=true;
      if(hit(/הבא|קדימה|המשך|נקסט|next|forward|continue/i)) vcAction('next');
      else if(hit(/הקודם|אחורה|previous|back/i)) vcAction('prev');
      else if(hit(/פרטים|מלא|הרחב|details|full|expand/i)) vcAction('readfull');
      else if(hit(/הקרא|שוב|תחזור|read|again|repeat/i)) vcAction('read');
      else if(hit(/טמפרטורה|חום|מעלות|temp|temperature|degrees/i)) vcAction('qtemp');
      else if(hit(/מתי|הבאה|when|next step/i)) vcAction('qwhen');
      else if(aiAvail() && vcLooksLikeQuestion(alts[0])){ vcAskFlow(alts[0]); toast('❓ '+alts[0]); return; }
      else acted=false;
      toast((acted?'✓ ':(vcLang()==='en'?'Command not recognized: ':'לא זוהתה פקודה: '))+`"${alts[0]}"`);
    };
    rec.onerror=(e)=>{
      if(e.error==='no-speech'||e.error==='aborted') return;          // שקט — פשוט ממשיכים
      if(e.error==='not-allowed'){ vcRec=null; vcRender(); toast('נדרשת הרשאת מיקרופון — אשר בדפדפן ונסה שוב'); return; }
      if(e.error==='network'){ vcRec=null; vcRender(); toast('זיהוי דיבור דורש חיבור רשת'); return; }
    };
    rec.onend=()=>{ if(vcRec===rec && !rec._stop){ setTimeout(()=>{ try{rec.start();}catch(err){} },250); } };  // לולאת one-shot
    rec.start(); vcRender();
    vcSpeak(vcLang()==='en'?'Listening. Say: next, back, read again, details, temperature — or ask a question.':'מאזין. אמור: הבא, הקודם, הקרא שוב, פרטים, טמפרטורה — או שאל שאלה חופשית.', vcAnsLang());
  }catch(e){ vcRec=null; toast(L('לא ניתן להפעיל מיקרופון: ','Could not start the microphone: ')+e.message); } };
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
      stream.getTracks().forEach(t=>t.stop());   // שחרר — רק ההרשאה חשובה
      startRec();
    }).catch(()=>{
      toast('הרשאת מיקרופון חסומה. פתח: סמל המנעול 🔒 בשורת הכתובת ← הרשאות ← מיקרופון ← אפשר, ואז נסה שוב.');
    });
  } else startRec();
}
// ═══ Wave 2 · Live Cook Copilot — session shell (P1) ═══
// A live session for the current scope's cook. Reuses the timer engine, the work-plan tasks (window._wpTasks),
// and _liveCookState (via setPlanStarted). Session store: mk-cook-live-<scope>. Local-only; P2-P6 add stall/probe/adaptive/voice/AI.
function liveScope(){ return (typeof evScope==='function')?evScope():'cook'; }
function liveKey(sc){ return 'mk-cook-live-'+(sc||liveScope()); }
function liveSession(sc){ const s=store.get(liveKey(sc)); return (s&&typeof s==='object')?s:null; }
function startLiveCook(){
  const sc=liveScope();
  let serveTs=null; try{ const d=(typeof serveDateTime==='function')?serveDateTime():null; if(d&&d.getTime) serveTs=d.getTime(); }catch(e){}
  store.set(liveKey(sc), { startedAt:Date.now(), scope:sc, serveTs:serveTs, probes:[] });
  try{ if(typeof setPlanStarted==='function') setPlanStarted(sc); }catch(e){}   // → _liveCookState().live + home banner
  try{ if(typeof cRefreshHome==='function') cRefreshHome(); if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){}
  openCopilot();
}
function stopLiveCook(sc){ sc=sc||liveScope(); store.set(liveKey(sc), null);
  try{ if(typeof cRefreshHome==='function') cRefreshHome(); if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){} }
// current + next stage from the flattened work-plan tasks (window._wpTasks: {t:Date,label,sub,dur,tid,ikey})
function _copilotStages(){ const tasks=(typeof window!=='undefined'&&Array.isArray(window._wpTasks))?window._wpTasks:[]; const now=Date.now();
  let nextIdx=tasks.findIndex(function(t){return t&&t.t&&t.t.getTime&&t.t.getTime()>now;});
  if(nextIdx===-1) nextIdx=tasks.length;
  return { cur:tasks[Math.max(0,nextIdx-1)]||null, next:tasks[nextIdx]||null, count:tasks.length };
}
// W2-P2: stall detection + wrap/crutch advice, grounded in the app's vetted troubleshooting content (65-77°C evaporative plateau).
function copilotStallInfo(tempC){
  const he=(typeof getLang!=='function'||getLang()==='he');
  const t=(typeof tempC==='number' && !isNaN(tempC))?tempC:null;
  const phase = (t==null)?'unknown' : (t<65?'below' : (t<=77?'stall':'above'));
  const title = phase==='stall' ? (he?'אתה בתוך הסטָאל':'You’re in the stall')
              : phase==='above' ? (he?'עברת את הסטָאל':'Past the stall')
              : (he?'הסטָאל (Stall)':'The stall');
  const body = he
    ? 'התאדות-קירור סביב 65–77°C — נורמלי לחלוטין, יכול להימשך 1–3 שעות. אל תעלה חום בפאניקה. אפשרויות: סבלנות, או "Texas Crutch" — עטוף בנייר קצבים/אלומיניום כשהקרום כהה ויציב (בערך 68–70°C) כדי לפרוץ. עטיפה מוקדמת מדי מרככת את הקרום.'
    : 'Evaporative cooling around 65–77°C — completely normal, can last 1–3 hours. Don’t panic-raise the heat. Options: patience, or the “Texas Crutch” — wrap in butcher paper/foil once the bark is dark and set (around 68–70°C) to break through. Wrapping too early softens the bark.';
  return { inStall: phase==='stall', phase, title, body };
}
// W2-P3: probe capture + pace/ETA — the new subsystem. Manual entry (device-agnostic: read off the MEATER/Inkbird app).
function copilotLogProbe(tempC){ const sc=liveScope(); const s=liveSession(sc); if(!s) return null; if(!Array.isArray(s.probes)) s.probes=[]; s.probes.push({t:Date.now(), tempC:tempC}); store.set(liveKey(sc), s); return s; }
function copilotSetTarget(tempC){ const sc=liveScope(); const s=liveSession(sc); if(!s) return null; s.targetC=tempC; store.set(liveKey(sc), s); return s; }
// W2-P4: adaptive recompute — shift the serve time (running late / moved / ahead). Updates the session verdict AND the
// work-plan serve (mk-tlserve + date) so the plan reschedules backward to match next time it renders.
function copilotAdjustServe(deltaMin){
  const sc=liveScope(); const s=liveSession(sc); if(!s) return null;
  const base=(typeof s.serveTs==='number')?s.serveTs:Date.now();
  const ts=base + deltaMin*60000;
  s.serveTs=ts; store.set(liveKey(sc), s);
  try{ const d=new Date(ts); store.set('mk-tlserve', ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2));
    if(typeof serveDateKey==='function' && typeof isoDate==='function') store.set(serveDateKey(), isoDate(d)); }catch(e){}
  return s;
}
// Pure pace/ETA math from the session's probe readings vs the target internal temp. Honest: never extrapolates through the stall.
function copilotPace(session){
  const s=session||{};
  const probes=(Array.isArray(s.probes)?s.probes.slice():[]).filter(function(p){return p&&typeof p.tempC==='number'&&typeof p.t==='number';}).sort(function(a,b){return a.t-b.t;});
  const targetC=(typeof s.targetC==='number')?s.targetC:null;
  if(!probes.length) return {state:'no-reading'};
  const last=probes[probes.length-1];
  if(targetC==null) return {state:'no-target', lastTemp:last.tempC};
  if(last.tempC>=targetC) return {state:'done', lastTemp:last.tempC};
  if(probes.length<2) return {state:'need-more', lastTemp:last.tempC};
  const a=probes[probes.length-2], b=last;
  const dtH=(b.t-a.t)/3600000;
  const rate = dtH>0 ? (b.tempC-a.tempC)/dtH : 0;               // °C per hour, from the last two readings
  const r1=Math.round(rate*10)/10;
  if(rate<=1 && b.tempC>=65 && b.tempC<=77) return {state:'stall', lastTemp:b.tempC, rate:r1};   // flat in the plateau = the stall (don't project a wild ETA)
  if(rate<=0) return {state:'flat', lastTemp:b.tempC, rate:r1};
  const hoursLeft=(targetC-b.tempC)/rate;
  const etaMs=b.t + hoursLeft*3600000;
  const out={state:'projected', lastTemp:b.tempC, rate:r1, hoursLeft:Math.round(hoursLeft*100)/100, etaMs:etaMs};
  if(typeof s.serveTs==='number'){ const readyBy=s.serveTs - (s.restMin||0)*60000; const slackMs=readyBy-etaMs;
    out.verdict = slackMs>15*60000?'ahead' : (slackMs<-15*60000?'behind':'on-pace'); out.slackMin=Math.round(slackMs/60000); }
  return out;
}
function _copilotPaceHtml(pace){
  const he=(typeof getLang!=='function'||getLang()==='he'); const p=pace||{};
  const note=function(cls,txt){ return `<div class="cop-pacenote ${cls||''}">${txt}</div>`; };
  if(p.state==='no-reading') return note('', (he?'רשום קריאת מדחום כדי לעקוב אחר הקצב.':'Log a probe reading to track your pace.'));
  if(p.state==='no-target') return note('', (he?'הגדר טמפ׳-יעד פנימית כדי לחשב זמן סיום.':'Set a target internal temp to get a finish-time estimate.'));
  if(p.state==='need-more') return note('', `🌡️ ${p.lastTemp}°C · ${he?'רשום קריאה נוספת כדי לחזות זמן סיום.':'Log another reading to project a finish time.'}`);
  if(p.state==='done') return note('cop-pace-ok', `✅ ${p.lastTemp}°C · ${he?'הגיע ליעד — נוח והגש.':'Target reached — rest and serve.'}`);
  if(p.state==='stall') return note('cop-pace-warn', `🧱 ${p.lastTemp}°C · ${he?'בסטָאל — הקצב שטוח. עטוף לפרוץ, או המתן בסבלנות.':'In the stall — pace is flat. Wrap to break through, or wait it out.'}`);
  if(p.state==='flat') return note('cop-pace-warn', `⚠ ${p.lastTemp}°C · ${he?'הטמפ׳ אינה עולה — בדוק את החום/הדלק.':'Temp isn’t rising — check your fire / fuel.'}`);
  // projected
  const eta=(typeof fmtClock==='function')?fmtClock(new Date(p.etaMs)):new Date(p.etaMs).toLocaleTimeString();
  const vTxt = p.verdict==='behind'?(he?'מאחר':'behind') : p.verdict==='ahead'?(he?'מקדים':'ahead') : (he?'בקצב':'on pace');
  const cls = p.verdict==='behind'?'cop-pace-warn':'cop-pace-ok';
  const slack = (typeof p.slackMin==='number')?` (${p.slackMin>0?'+':''}${p.slackMin} ${he?'דק׳':'min'})`:'';
  const fix = p.verdict==='behind' ? (he?'להאיץ: העלה מעט את חום התא, או עטוף (Crutch) עכשיו; אפשר גם לקצר מנוחה או לדחות הגשה.':'To catch up: nudge the pit temp up, or wrap (Crutch) now; you can also shorten the rest or push serve.')
            : p.verdict==='ahead' ? (he?'יש עודף זמן — אפשר להחזיק בקופסת בידוד (faux cambro).':'You have slack — hold it wrapped in a cooler (faux cambro).') : '';
  return note(cls, `📈 ${p.lastTemp}°C · ${he?'קצב':'rate'} ~${p.rate}°C/${he?'ש':'h'} · ${he?'סיום ~':'ETA ~'}${eta}${p.verdict?` · <b>${vTxt}</b>${slack}`:''}`) + (fix?`<div class="cop-pacefix">💡 ${fix}</div>`:'');
}
// W2-P6: "what do I do now?" — deterministic advice from the session state (always available, no key needed).
function copilotAdviceLocal(session){
  const he=(typeof getLang!=='function'||getLang()==='he'); const s=session||{};
  const pace=(typeof copilotPace==='function')?copilotPace(s):{state:'no-reading'};
  if(pace.state==='done') return he?'הגעת ליעד — הוצא, עטוף ונוח בקופסת בידוד לפני הפריסה.':'You’ve hit the target — pull it, wrap it, and rest it in a cooler before slicing.';
  if(pace.state==='stall') return he?'אתה בסטָאל: התאזר בסבלנות, או עטוף (Texas Crutch) כשהקרום כהה ויציב כדי לפרוץ. אל תעלה חום בפאניקה.':'You’re in the stall: wait it out, or wrap (Texas Crutch) once the bark is dark and set to break through. Don’t panic-raise the heat.';
  if(pace.state==='flat') return he?'הטמפ׳ לא עולה — בדוק שהאש/הדלק תקינים ושכיסוי התא סגור.':'The temp isn’t rising — check your fire/fuel and that the lid is closed.';
  if(pace.state==='projected' && pace.verdict==='behind') return he?'אתה מאחר להגשה: העלה מעט את חום התא, או עטוף עכשיו לפרוץ מהר; אפשר גם לקצר מנוחה או לדחות את ההגשה.':'You’re behind for serve: nudge the pit temp up, or wrap now to push faster; you can also shorten the rest or move serve later.';
  if(pace.state==='projected' && pace.verdict==='ahead') return he?'אתה מקדים — כשתגיע ליעד, החזק עטוף בקופסת בידוד (faux cambro) עד ההגשה.':'You’re ahead — when it hits target, hold it wrapped in a cooler (faux cambro) until serve.';
  if(pace.state==='projected') return he?'אתה בקצב טוב — המשך לפי התוכנית ובדוק מדחום מדי פעם.':'You’re on pace — stay the course and check the probe periodically.';
  if(pace.state==='need-more') return he?'רשום עוד קריאת מדחום כדי שאחשב זמן-סיום מדויק.':'Log another probe reading so I can project a finish time.';
  return he?'הגדר טמפ׳-יעד ורשום קריאת מדחום כדי שאעזור לכוון את התזמון.':'Set a target temp and log a reading so I can help you dial in the timing.';
}
async function copilotAskNow(){
  const s=(typeof liveSession==='function')?liveSession():null; if(!s) return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  const host=$("#copAdvice"); if(!host) return;
  const local=copilotAdviceLocal(s);
  host.innerHTML=`<div class="cop-pacenote">${esc(local)}</div>`;                    // deterministic advice, always
  if(typeof aiAvail!=='function' || !aiAvail()) return;                              // no key → local only
  const prev=host.innerHTML;
  host.innerHTML=`<div class="cop-pacenote">${(typeof aiSpinner==='function')?aiSpinner(he?'האש חושב':'The Fire is thinking'):'…'}</div>`;
  try{
    const stage=_copilotStages(); const stageLbl=stage.cur?stripEmoji(stage.cur.label||''):'';
    const q=(he?'מצב הבישול:':'Cook situation:')+copilotVoiceContext()+(stageLbl?(' '+(he?'שלב נוכחי:':'current stage:')+' '+stageLbl):'')+' '+(he?'מה כדאי לעשות עכשיו? תשובה קצרה ומעשית.':'What should I do right now? Short, practical answer.');
    const r=await askGemini(q, []);
    // SAFETY: grounding = the VETTED context only. copilotVoiceContext() carries the user's live probe
    // reading; feeding it here would let the AI "ground" an unsafe number in the user's own telemetry.
    // It stays in the PROMPT (above) — live state may inform the model, never the guard.
    host.innerHTML=`<div class="cop-pacenote">${esc(r.txt||'').replace(/\n/g,'<br>')}${(typeof aiSafetyNote==='function')?aiSafetyNote(r.txt, (r.ctx||'')):''}</div>`;
  }catch(e){ host.innerHTML=prev; }   // AI failed → keep the local advice
}
function openCopilot(){
  if(typeof showPanel!=='function') return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  const sess=liveSession(); const st=_copilotStages();
  // probe check-in + pace/ETA card
  let probeCard='';
  if(sess){
    const tgt=(typeof sess.targetC==='number')?sess.targetC:null;
    probeCard=`<div class="cop-probe"><div class="cop-probeh">🌡️ ${he?'בדיקת מדחום':'Probe check-in'}</div>
      <div class="cop-proberow"><input id="copProbe" class="cop-in" type="number" inputmode="decimal" placeholder="${he?'טמפ׳ פנימית °C':'internal °C'}"><button class="mchip" id="copProbeLog">${he?'רשום':'Log'}</button></div>
      ${tgt==null?`<div class="cop-proberow"><input id="copTarget" class="cop-in" type="number" inputmode="decimal" placeholder="${he?'יעד פנימי °C':'target internal °C'}"><button class="mchip" id="copTargetSet">${he?'הגדר יעד':'Set target'}</button></div>`:`<div class="cop-pacenote">🎯 ${he?'יעד':'target'} ${tgt}°C</div>`}
      ${_copilotPaceHtml(copilotPace(sess))}</div>`;
  }
  // W2-P4: adaptive timing — shift the serve (running late / moved / ahead) → verdict + plan recompute
  let adjustCard='';
  if(sess){
    adjustCard=`<div class="cop-adjust"><div class="cop-adjusth">⏱️ ${he?'תזמון':'Timing'}${(typeof sess.serveTs==='number')?` · ${he?'הגשה':'serve'} ${fmtClock(new Date(sess.serveTs))}`:''}</div>
      <div class="cop-proberow"><button class="mchip" data-copserve="30">+30 ${he?'דק׳':'min'}</button><button class="mchip" data-copserve="60">+1 ${he?'ש':'h'}</button><button class="mchip" data-copserve="-15">−15 ${he?'דק׳':'min'}</button></div></div>`;
  }
  // stall advisory during smoke stages (uses the last probe reading if one exists — capture arrives in P3)
  let stallCard='';
  if((st.cur&&st.cur.kind==='smoke')||(st.next&&st.next.kind==='smoke')){
    const probes=(sess&&Array.isArray(sess.probes))?sess.probes:[];
    const lastT=probes.length?probes[probes.length-1].tempC:null;
    const info=copilotStallInfo(lastT);
    const head=(lastT!=null&&info.inStall)?`🌡️ ${lastT}°C · ${info.title}`:info.title;
    stallCard=`<div class="cop-stall${info.inStall?' cop-stall-on':''}"><div class="cop-stallh">🧱 ${esc(head)}</div><div class="cop-stallb">${esc(info.body)}</div><div class="ai-refuse-src">📚 ${he?'מתוך מדריך התקלות של האפליקציה':'From the app’s troubleshooting guide'}</div></div>`;
  }
  const stageHtml=function(t,tag){ if(!t) return ''; return `<div class="cop-stage"><div class="cop-stagek">${tag}</div><div class="cop-stagel">${esc(t.label||'')}</div>${t.sub?`<div class="cop-stagesub">${esc(t.sub)}</div>`:''}${(t.tid&&t.dur)?timerHTML(t.dur, t.tid, t.label||''):''}</div>`; };
  const body = (st.count
    ? `${stageHtml(st.cur, he?'עכשיו':'Now')}${stageHtml(st.next, he?'הבא':'Next')}`
    : `<div class="cop-empty">${he?'פתח את תוכנית העבודה של הבישול כדי להתחיל מושב חי.':'Open the cook’s work plan to start a live session.'}</div>`) + stallCard + probeCard + adjustCard;
  showPanel(`${typeof toolTop==='function'?toolTop(L('טייס חי','Live Copilot'),L('הבישול שלך בזמן אמת','Your cook, live'),'🔥','#c0392b'):`<h2 style="padding:16px">${L('טייס חי','Live Copilot')}</h2>`}
    <div class="panel-body">
      ${sess?`<div class="cop-hdr">🔥 ${he?'מושב חי פעיל':'Live session active'}${sess.serveTs?` · ${he?'הגשה':'serve'} ${fmtClock(new Date(sess.serveTs))}`:''}</div>`:''}
      ${body}
      ${sess?`<button class="mchip cop-asknow" id="copAskNow">🤖 ${he?'מה לעשות עכשיו?':'What do I do now?'}</button><div id="copAdvice"></div>`:''}
      <div class="cop-actions">
        <button class="mchip vc-launch" data-copvoice>🎙️ ${L('בישול קולי','Voice cook')}</button>
        ${sess?`<button class="mchip" id="copStop">■ ${L('סיים מושב','End session')}</button>`:''}
      </div>
    </div>`);
  $("#panel").querySelectorAll('.timer').forEach(function(tm){ try{ if(typeof wireTimer==='function') wireTimer(tm); }catch(e){} });
  { const vb=$("#panel").querySelector('[data-copvoice]'); if(vb) vb.addEventListener('click',function(){ if(typeof openVoiceCook==='function') openVoiceCook((typeof window!=='undefined'&&window._wpTasks)||[]); }); }
  { const sb=$("#copStop"); if(sb) sb.addEventListener('click',function(){ stopLiveCook(); if(typeof closePanel==='function') closePanel(); }); }
  { const lb=$("#copProbeLog"); if(lb) lb.addEventListener('click',function(){ const inp=$("#copProbe"); const v=inp?parseFloat(inp.value):NaN; if(!isNaN(v)){ copilotLogProbe(v); openCopilot(); } }); }
  { const tb=$("#copTargetSet"); if(tb) tb.addEventListener('click',function(){ const inp=$("#copTarget"); const v=inp?parseFloat(inp.value):NaN; if(!isNaN(v)){ copilotSetTarget(v); openCopilot(); } }); }
  $("#panel").querySelectorAll('[data-copserve]').forEach(function(b){ b.addEventListener('click',function(){ const d=parseInt(b.dataset.copserve,10); if(!isNaN(d)){ copilotAdjustServe(d); openCopilot(); } }); });
  { const an=$("#copAskNow"); if(an) an.addEventListener('click',function(){ copilotAskNow(); }); }
}
function openVoiceCook(tasks){
  vcTasks=tasks||[]; vcIdx=0;
  // start at the nearest upcoming task
  const now=new Date();
  const up=vcTasks.findIndex(t=>t.t>=now); if(up>0) vcIdx=up;
  showPanel(`${toolTop(L('מצב בישול קולי','Voice cooking mode'),L('הטלפון ליד המעשנת — הקראה, ניווט ופקודות','The phone by the smoker — read-aloud, navigation and commands'),'🎙️','#7a5cc2')}
    <div class="panel-body" id="vcBody"></div>`);
  vcRender();
  if(vcTasks.length) vcSpeakContent(vcCurrentText(false));
}
// ── serve time as a full datetime (Wave B: night / next-day cooks) ──────────────
// serve is no longer clock-only-anchored-to-today. The day resolves from: an explicit
// date picker (per scope) → the event's own date → today (rolling to tomorrow only when
// the clock has already passed), so an 18h brisket served tomorrow schedules correctly.
function isoDate(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function serveDateKey(){ return 'mk-tlservedate-'+(typeof evScope==='function'?evScope():'cook'); }
function serveBaseDate(){
  const explicit=store.get(serveDateKey());
  if(explicit){
    const sc=(typeof evScope==='function')?evScope():'cook';
    const isEvent=(sc!=='cook'&&sc!=='draft');
    if(isEvent || explicit>=isoDate(new Date())) return explicit;   // events keep their date (even historical); ad-hoc plans drop a stale past one
    store.set(serveDateKey(),null);
  }
  try{ const m=(typeof menuState==='function')?menuState():null; if(m&&m.evDate) return m.evDate; }catch(e){}
  return '';   // no anchor → today (with roll-forward in serveDateTime)
}
function serveDateTime(){
  const t=(store.get('mk-tlserve')||'19:00').split(':').map(Number);
  const base=serveBaseDate();
  let d;
  if(base){ d=new Date(base+'T00:00:00'); d.setHours(t[0]||0,t[1]||0,0,0); }
  else { d=new Date(); d.setHours(t[0]||0,t[1]||0,0,0); if(d.getTime()<Date.now()) d.setDate(d.getDate()+1); }   // clock already passed today → tomorrow
  return d;
}
function serveDayLabel(d){
  const t0=new Date(); t0.setHours(0,0,0,0);
  const dd=new Date(d); dd.setHours(0,0,0,0);
  const diff=Math.round((dd.getTime()-t0.getTime())/86400e3);
  const _loc=(getLang&&getLang()!=='he')?'en-US':'he-IL';
  if(diff===0) return L('היום','Today'); if(diff===1) return L('מחר','Tomorrow'); if(diff===-1) return L('אתמול','Yesterday');
  if(diff>1 && diff<7) return d.toLocaleDateString(_loc,{weekday:'long'});
  return d.toLocaleDateString(_loc,{weekday:'short',day:'numeric',month:'short'});
}
// clock, with a day tag prefixed only when the serve day isn't today (so "19:00" stays terse, "מחר 12:00" is explicit)
function fmtServe(d){ if(!d) return ''; const t0=new Date(); t0.setHours(0,0,0,0); const dd=new Date(d); dd.setHours(0,0,0,0); return (dd.getTime()===t0.getTime()?'':serveDayLabel(d)+' ')+fmtClock(d); }
// live "time until serving" bar — fills from the first cooking start toward serve time
let serveIv=null;
function updateServeBar(){
  const bar=$("#serveBar"); if(!bar) return;
  const serve=window._wpServe, start=window._wpStart;
  if(!serve){ bar.hidden=true; return; }
  bar.hidden=false;
  const now=Date.now(), sv=serve.getTime(), remMs=sv-now;
  const rem=$("#serveRemain"), at=$("#serveAt"), fill=$("#serveFill");
  if(at) at.textContent='🍽️ '+fmtServe(serve);
  if(remMs<=0){ if(rem) rem.textContent=L('🍽️ הגיע זמן ההגשה!','🍽️ Serve time is here!'); if(fill) fill.style.width='100%'; bar.classList.add('serve-now'); return; }
  bar.classList.remove('serve-now');
  const h=Math.floor(remMs/3600e3), m=Math.floor((remMs%3600e3)/60e3);
  if(rem) rem.textContent='⏱ '+L('עוד ','')+(h?h+L('ש ','h '):'')+m+' '+L('דק׳ עד ההגשה','min to serve');
  const st=start?start.getTime():sv-1, total=sv-st, elapsed=now-st;
  if(fill) fill.style.width=(total>0?Math.max(0,Math.min(100,elapsed/total*100)):0).toFixed(1)+'%';
}
function startServeBar(){ if(serveIv){clearInterval(serveIv);} updateServeBar(); serveIv=setInterval(updateServeBar,30000); }
function planStartKey(){ return 'mk-plan-started-'+(typeof evScope==='function'?evScope():'cook'); }   // per-event start state
function planStarted(){ return !!store.get(planStartKey()); }
function setPlanStarted(v){ store.set(planStartKey(), v||null); }
function resetPlanTimers(){ const sc=evScope(); const ts=store.get('mk-timers')||{}; const removed={}; Object.keys(ts).forEach(k=>{ if(k.indexOf('st-'+sc+'-')===0){ removed[k]=ts[k]; delete ts[k]; } }); store.set('mk-timers',ts); return removed; }   // R1: only THIS event's timers
// "Start plan" gate + feasibility guard: warns (or, if strict mode is on, blocks) when the plan can't finish by serve time
function renderPlanStartRow(earliest, serve, rebuild){
  const el=$("#planStartRow"); if(!el) return;
  const started=planStarted();
  const behind = !!(earliest && Date.now() > earliest.getTime());
  const strict = !!store.get('mk-plan-strict');
  const blockStart = behind && strict && !started;
  let warn='';
  if(behind){ const late=Math.round((Date.now()-earliest.getTime())/60000);
    warn=`<div class="plan-warn">${L(`⚠ הזמן קצר — כדי להגיש ב-${fmtServe(serve)} היה צריך להתחיל ב-${fmtServe(earliest)} (לפני ${late} דק׳). דחה את ההגשה — אל תקצר שלבי בישול (עלול להשאיר את הפנים תת-מבושל ולא בטוח).`,`⚠ Time is short — to serve at ${fmtServe(serve)} you should have started at ${fmtServe(earliest)} (${late} min ago). Push the serve time — don't shorten cooking stages (it may leave the inside undercooked and unsafe).`)} <button class="mchip" data-planpush>➕ ${L('דחה הגשה ב-30 דק׳','Push serve by 30 min')}</button> <button class="mchip" data-planreschedule>▶ ${L('תזמן מחדש מעכשיו','Reschedule from now')}</button></div>`;
  }
  el.innerHTML=`${warn}<div class="plan-startrow">
    <button class="plan-startbtn ${started?'on':''}" data-planstart ${blockStart?'disabled':''}>${started?L('⏹ עצור / אפס תוכנית','⏹ Stop / reset plan'):L('▶ התחל תוכנית','▶ Start plan')}</button>
    <label class="plan-strict"><input type="checkbox" data-planstrict ${strict?'checked':''}> ${L('חסום כשאין מספיק זמן','Block when there isn’t enough time')}</label>
  </div>`;
  const list=$("#tlList"); if(list) list.classList.toggle('plan-idle', !started);   // timers disabled until the plan is started
  const sb=el.querySelector('[data-planstart]'); if(sb) sb.addEventListener('click',()=>{ if(planStarted()){ const removed=resetPlanTimers(); setPlanStarted(null); rebuild(); if(typeof toast==='function' && Object.keys(removed).length) toast('התוכנית אופסה', ()=>{ const t2=store.get('mk-timers')||{}; Object.assign(t2,removed); store.set('mk-timers',t2); setPlanStarted(Date.now()); rebuild(); }); } else { setPlanStarted(Date.now()); if(behind && typeof toast==='function') toast('התחלת עם לחץ-זמן — עקוב אחרי הטיימרים'); rebuild(); } });   // R1: scoped reset + undo
  const stc=el.querySelector('[data-planstrict]'); if(stc) stc.addEventListener('change',()=>{ store.set('mk-plan-strict', stc.checked); rebuild(); });
  const pp=el.querySelector('[data-planpush]'); if(pp) pp.addEventListener('click',()=>{ const inp=$("#tlServe"); if(!inp) return; const d=serveDateTime(); d.setMinutes(d.getMinutes()+30); const nv=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); inp.value=nv; store.set('mk-tlserve',nv); store.set(serveDateKey(), isoDate(d)); rebuild(); });   // push on the full datetime so a past-midnight bump rolls the day, not wraps into today
  const prb=el.querySelector('[data-planreschedule]'); if(prb) prb.addEventListener('click',()=>{ if(!earliest) return; const span=serve.getTime()-earliest.getTime(); const ns=new Date(Date.now()+span+60000); store.set('mk-tlserve', ('0'+ns.getHours()).slice(-2)+':'+('0'+ns.getMinutes()).slice(-2)); store.set(serveDateKey(), isoDate(ns)); rebuild(); });   // F1: shift serve so the plan starts now (earliest→now) instead of only nudging +30m
}
// identity banner at the top of the work plan so it's always clear WHICH event you're in
function tlEventBanner(){
  try{
    const ctx=(typeof menuCtx==='function')?menuCtx():'event';
    if(ctx==='cook') return `<div class="tl-evbanner"><span class="tl-evb-ic">🔥</span><b>${L('בישול מהיר','Quick cook')}</b></div>`;
    const id=(typeof evActive==='function')?evActive():null;
    const evs=(typeof evList==='function')?evList():[];
    const idx=id?evs.findIndex(function(e){return e.id===id;}):-1;
    if(idx>=0){ const ev=evs[idx], col=EV_COLORS[idx%EV_COLORS.length], en=(typeof getLang==='function'&&getLang()!=='he');
      const dateStr=ev.date?new Date(ev.date).toLocaleDateString(en?'en-US':'he-IL',{weekday:'short',day:'numeric',month:'short'}):'';
      const g=(ev.menu&&ev.menu.guests)||8;
      return `<div class="tl-evbanner" style="border-inline-start:5px solid ${col}"><b style="color:${col}">${esc(ev.name)}</b><small>${dateStr?esc(dateStr)+' · ':''}👥 ${g} · ${L('הגשה','Serve')} ${ev.serve||store.get('mk-tlserve')||'19:00'}</small></div>`;
    }
    return `<div class="tl-evbanner"><span class="tl-evb-ic">📝</span><b>${L('טיוטה — לא נשמרה','Draft — not saved')}</b></div>`;
  }catch(e){ return ''; }
}
function renderTimelinePanel(){
  const host=$("#tlBody"); if(!host) return;
  const srcKeys=[...new Set((typeof menuState==='function')?(menuState().keys||[]):[])];
  const items=srcKeys.map(resolveItem).filter(Boolean);
  const serveStr=store.get('mk-tlserve')||'19:00';
  const serveDateStr=isoDate(serveDateTime());
  host.innerHTML=`
    ${tlEventBanner()}
    <div class="calcrow"><label>${L('הגשה','Serve')}</label><input type="time" id="tlServe" value="${serveStr}"><input type="date" id="tlServeDate" value="${serveDateStr}" title="${L('יום ההגשה','Serve day')}"><button id="tlReset" class="mreset">🗑️ ${L('איפוס בחירות','Reset choices')}</button></div>
    <div id="serveBar" class="serve-bar" hidden><div class="serve-lbl"><span id="serveRemain"></span><span id="serveAt"></span></div><div class="serve-track"><div class="serve-fill" id="serveFill"></div></div></div>
    <div id="planStartRow"></div>
    <button id="tlAlerts" class="tl-alerts ${store.get('mk-tlalerts')?'on':''}">🔔 <span>${store.get('mk-tlalerts')?L('התראות פעילות','Alerts on'):L('הפעל התראות לשלבים','Enable stage alerts')}</span></button>
    <p class="section-sub">${L('לכל פריט: סמן אם כבר מוכן (ברירת מחדל) או מתחיל מאפס היום. שיטת הבישול נלקחת מהמתגים בכרטיסייה (⚡) — אפשר לבחור צירוף אחר כאן. לחץ ▾ לפירוט שלבים.','For each item: mark whether it is already made (default) or made from scratch today. The cooking method is taken from the switches on the card (⚡) — you can pick a different combo here. Tap ▾ for step details.')}</p>
    <div id="tlList">${items.length?'':`<div class="shop-empty">${L('הרשימה ריקה — הוסף פריטים (כפתור ＋) או דרך בונה התפריט, ואז חזור לכאן.','The list is empty — add items (the ＋ button) or via the menu builder, then come back here.')}</div>`}</div>`;
  const si=$("#tlServe");
  if(si) si.addEventListener('input',()=>{store.set('mk-tlserve',si.value); buildList();});
  { const sd=$("#tlServeDate"); if(sd) sd.addEventListener('change',()=>{ store.set(serveDateKey(), sd.value||null); buildList(); }); }   // pick the serve day (night / next-day cooks)
  { const ta=$("#tlAlerts"); if(ta) ta.addEventListener('click',async()=>{
      const on=!store.get('mk-tlalerts');
      if(on){ if(!('Notification' in window)){ toast('הדפדפן לא תומך בהתראות'); return; }
        let perm=Notification.permission; if(perm==='default') perm=await Notification.requestPermission();
        if(perm!=='granted'){ toast('צריך לאשר התראות בדפדפן'); return; }
        try{ acquireWakeLock(); }catch(e){}
        toast('התראות פעילות — השאר את האפליקציה פתוחה (המסך יישאר דלוק). התראות רקע אינן מובטחות'); }
      store.set('mk-tlalerts',on); buildList();
      ta.classList.toggle('on',on); ta.querySelector('span').textContent=on?'התראות פעילות':'הפעל התראות לשלבים';
    }); }
  { const tr=$("#tlReset"); if(tr) tr.addEventListener('click',()=>{
      const prev=tlState(); tlSetState({}); buildList();
      toast('בחירות הלוח אופסו',()=>{ tlSetState(prev); buildList(); });
    }); }
  function buildList(){
    if(!items.length) return;
    const serve=serveDateTime();
    { const sd=$("#tlServeDate"); if(sd) sd.value=isoDate(serve); }   // keep the date picker in sync with the (possibly rolled) serve day
    const allState=tlState();
    const computed=items.map(m=>{
      const profile=itemProfile(m);
      let st=allState[m.key];
      if(!st){ st={ready:true}; allState[m.key]=st; }
      // method: follow the card's active combo UNLESS the user explicitly changed it in the timeline selector
      if(!st.methodPinned || !st.method) st.method=profile.methods[0].key;
      if(!st.svSmokeOrder) st.svSmokeOrder=svSmokeOrderDefault();
      const scratchable=hasScratchBuild(m);
      if(scratchable){ st.stage = st.stage || (st.ready===false?'scratch':'ready'); st.ready = (st.stage==='ready'); }
      const blocked=profile.multiDay && !st.ready;
      let stages=[], startClock=null;
      if(!blocked){
        stages=itemStages(m,st.method,st.ready,st.svSmokeOrder);
        stages=equipPlan(m, st.method, stages, (typeof evScope==='function'?evScope():null));   // Phase 3: the seam — equipment facts enter here and nowhere else
        { const _kc={}; stages.forEach((s)=>{ const n=(_kc[s.kind]=(_kc[s.kind]||0)+1); s.tid='st-'+evScope()+'-'+m.key+'-'+s.kind+(n>1?n:''); }); }   // R3: stable per-stage id (kind-based, not array index) so a mid-cook method change doesn't remap a running timer
        // times come from the ONE scheduler (planSchedule); this call site only applies them onto the
        // stages the renderer reads. Removing that mutation is Phase 4b's job, not 4a's.
        const _sched=planSchedule(stages, serve.getTime());
        _sched.stages.forEach(function(p,i){ stages[i].start=new Date(p.startMs); stages[i].end=new Date(p.endMs); });
        startClock=new Date(_sched.startMs);
      }
      return {m,profile,st,stages,startClock,blocked};
    });
    tlSetState(allState);
    // Phase 4b: the walk above is the resource-unconstrained relaxation — it ends EVERY item at serve, so a
    // shared cooker is over-subscribed by construction. Place against real capacity, moving items EARLIER
    // only. A cook cannot move without its own prep (which feeds it), so the whole chain shifts together:
    // durations, temperatures and order are all carried through untouched. The item then genuinely becomes
    // ready before serve — recorded as readyEarlyMs so the plan can SAY so rather than surprise the cook.
    try{
      const _plc=schedulePlacements(computed, null);
      window._plcConflicts=_plc.conflicts;
      computed.forEach(function(c){
        if(c.blocked || !c.stages || !c.stages.length || !c.startClock) return;
        const slacks=[];
        c.stages.forEach(function(s,si){
          const p=_plc.placements[s.tid||(c.m.key+'|'+s.kind+'|'+si)];
          if(p && p.devId) slacks.push(p.slackMs||0);
        });
        if(!slacks.length) return;
        const uniq=slacks.filter(function(v,i,a){return a.indexOf(v)===i;});
        if(uniq.length!==1 || !uniq[0]) return;    // nothing to shift, or stages want different shifts → leave it to the advisory (4c)
        const d=uniq[0];
        c.stages.forEach(function(s){ s.start=new Date(s.start.getTime()-d); s.end=new Date(s.end.getTime()-d); });
        c.startClock=new Date(c.startClock.getTime()-d);
        c.readyEarlyMs=d;
      });
    }catch(e){}
    let earliestSmoke=null;
    computed.forEach(c=>{ if(c.blocked) return; c.stages.forEach(s=>{ if(s.kind==='smoke'&&(!earliestSmoke||s.start<earliestSmoke)) earliestSmoke=s.start; }); });
    const _pmins=(typeof preheatMinutes==='function')?preheatMinutes():45;   // D1: one source for the time AND the label
    const preheat=earliestSmoke? new Date(earliestSmoke.getTime()-_pmins*60e3) : null;
    const sorted=computed.slice().sort((a,b)=>{
      if(a.blocked&&b.blocked) return 0; if(a.blocked) return 1; if(b.blocked) return -1;
      return a.startClock-b.startClock;
    });
    // in-session reminders (work while app is open)
    tlTimers.forEach(t=>clearTimeout(t)); tlTimers=[];
    if(store.get('mk-tlalerts') && ('Notification' in window) && Notification.permission==='granted'){
      const now=Date.now(); const fire=(when,title,body)=>{ const ms=when.getTime()-now; if(ms>0&&ms<24*3600e3) tlTimers.push(setTimeout(()=>{ mkNotify(title, body, 'mk-stage'); },ms)); };
      if(preheat) fire(preheat,L('🔥 זמן להדליק','🔥 Time to light up'),L(`הדלק את המעשנת — ${preheatHint()} לפני העישון הראשון`,`Fire up the smoker — ${preheatHint()} before the first smoke`));
      sorted.forEach(c=>{ if(!c.blocked&&c.startClock){ const nm=(typeof itemName==='function'?itemName(c.m):c.m.heb); fire(c.startClock,'⏰ '+stripEmoji(nm),L('הזמן להתחיל: ','Time to start: ')+nm); } });
    }
    const viewMode=store.get('mk-tlview')||'items';
    let html=`<div class="tl-viewtoggle"><button class="mchip ${viewMode==='items'?'on':''}" data-tlview="items">📦 ${L('לפי פריט','By item')}</button><button class="mchip ${viewMode==='plan'?'on':''}" data-tlview="plan">📋 ${L('תוכנית עבודה','Work plan')}</button><button class="mchip tl-allbtn" data-tlallopen>${_tlAllOpen?'⤡ '+L('כווץ הכל','Collapse all'):'⤢ '+L('הרחב הכל','Expand all')}</button></div>`;
    const _wpHtml=workPlanHtml(computed, preheat, serve);   // F5: always build the plan (populates window._wpTasks for voice cook even when the items view is showing)
    // Phase 4c: a load the placer could not resolve is STATED, never silently left over-subscribed. The
    // occupancy view already shows the overload; this says what to do about it in the plan itself.
    html+=_schedAdviceHtml(window._plcConflicts, computed);
    if(viewMode==='plan'){
      html+=_wpHtml;
    } else {
      if(preheat) html+=`<div class="tlrow tl-preheat"><span class="tl-t"><b>${fmtClockRel(preheat, serve)}</b></span><span class="tl-n">🔥 ${L('הדלקת מעשנת (חימום מוקדם, '+_pmins+' דק׳)','Fire up the smoker (preheat, '+_pmins+' min)')}</span><span class="tl-lead"></span></div>`;
      html+=sorted.map(c=>itemRowHtml(c,serve)).join('');
      html+=`<div class="tlrow tl-serve"><span class="tl-t"><b>${fmtServe(serve)}</b></span><span class="tl-n"><b>🍽️ ${L('הגשה','Serve')}</b></span><span class="tl-lead"></span></div>`;
    }
    html+=`<button class="prbtn" style="position:static;margin-top:12px" data-print>⎙ ${L('הדפס','Print')} ${viewMode==='plan'?L('תוכנית עבודה','work plan'):L('לוח זמנים','schedule')}</button>`;
    if(typeof clearTimers==='function') clearTimers();   // stop stale intervals before re-wiring; state persists in mk-timers
    $("#tlList").innerHTML=html;
    if(_tlAllOpen){ $("#tlList").querySelectorAll('.tl-stages').forEach(function(s){s.style.display='block';}); $("#tlList").querySelectorAll('[data-tlexp]').forEach(function(b){b.textContent='▴';}); $("#tlList").querySelectorAll('.wp-acc').forEach(function(a){a.classList.add('open');}); }   // expand-all
    if(typeof _tlMarkSelected==='function') _tlMarkSelected();   // re-apply the persistent selection ring after re-render
    // select an item by tapping its work-plan task (all shapes) — remembers it across view switches without toggling the done checkbox
    $("#tlList").querySelectorAll('[data-tlitem]').forEach(function(el){ el.addEventListener('click',function(e){ const ik=el.getAttribute('data-tlitem'); if(!ik) return; if(el.classList.contains('wp-row') && !e.target.closest('.wp-ck')) e.preventDefault(); if(typeof _tlSelect==='function') _tlSelect(ik, el); }); });   // highlight the exact task tapped
    $("#tlList").querySelectorAll('.timer').forEach(tm=>wireTimer(tm));   // live countdowns per timed stage (items + plan views)
    { const starts=computed.filter(c=>!c.blocked&&c.startClock).map(c=>c.startClock.getTime());
      let earliest=starts.length?new Date(Math.min(...starts)):null;
      if(preheat && (!earliest||preheat.getTime()<earliest.getTime())) earliest=preheat;
      window._wpServe=serve; window._wpStart=earliest; startServeBar(); renderPlanStartRow(earliest, serve, buildList); }   // live serve bar + start/feasibility controls
    // view / detail / shape switches: rebuild, then re-apply the focused item so it stays in view + expanded across views
    const _reFocus=()=>{ const f=_tlFocusTid||_tlFocusKey; if(f && typeof _tlFocusItem==='function') _tlFocusItem(f); };   // re-focus the EXACT selected task (not the item's first) so a view switch doesn't jump to sous-vide
    $("#tlList").querySelectorAll('[data-tlview]').forEach(b=>b.addEventListener('click',()=>{store.set('mk-tlview',b.dataset.tlview); buildList(); _reFocus();}));
    $("#tlList").querySelectorAll('[data-tldetail]').forEach(b=>b.addEventListener('click',()=>{store.set('mk-tlplandetail',b.dataset.tldetail); buildList(); _reFocus();}));
    $("#tlList").querySelectorAll('[data-tlshape]').forEach(b=>b.addEventListener('click',()=>{setTlShape(b.dataset.tlshape); buildList(); _reFocus();}));
    { const ab=$("#tlList").querySelector('[data-tlallopen]'); if(ab) ab.addEventListener('click',()=>{ _tlAllOpen=!_tlAllOpen; buildList(); }); }   // expand / collapse the whole plan
    $("#tlList").querySelectorAll('.wp-acch').forEach(h=>h.addEventListener('click',()=>{ const acc=h.parentElement; if(acc) acc.classList.toggle('open'); }));
    $("#tlList").querySelectorAll('.wp-ck[data-wpck]').forEach(cb=>cb.addEventListener('change',()=>{ const k=decodeURIComponent(cb.dataset.wpck); store.set(k, cb.checked||null); const row=cb.closest('.wp-row'); if(row) row.classList.toggle('wp-done', cb.checked); }));   // F: persist plan check state
    { const vb=$("#tlList").querySelector('[data-vclaunch]'); if(vb) vb.addEventListener('click',()=>openFrom(openTimeline,()=>openVoiceCook(window._wpTasks||[]))); }
    { const cb=$("#tlList").querySelector('[data-copilotlaunch]'); if(cb) cb.addEventListener('click',()=>{ if(typeof startLiveCook==='function') startLiveCook(); }); }   // W2-P1: start a live copilot session
    wireRows();
  }
  function workPlanHtml(computed, preheat, serve){
    const detail=(store.get('mk-tlplandetail')||'short')==='full';
    const tasks=[];
    const _ckScope=(typeof evScope==='function')?evScope():'cook';
    window._wpCtx={computed:computed, serve:serve, scope:_ckScope};   // wireRows() is a sibling scope — hand it the context explicitly
    const _ckMap=store.get('mk-item-cooker-'+_ckScope)||{};
    const _clashes=cookerContention(computed, _ckScope);
    // Keyed by item AND stage kind: an item can sit on two devices (a bath, then the smoker), and only the
    // stage on the contended device should carry the warning — not every row belonging to that item.
    const _clashOcc={}; _clashes.forEach(function(cl){ cl.items.forEach(function(i){ _clashOcc[i.key+'|'+i.kind]=1; }); });
    // sous-vide batching: same circulator + same temp + overlapping windows → cook together in one bath (the largest available size)
    const _svBatch={}; { const svOcc=[];
      computed.forEach(function(c){ if(c.blocked||!c.stages) return; c.stages.forEach(function(s){ if(s.kind!=='sv'||!s.start||!s.end) return; const d=cookerFor(c.m.key,'sv',_ckScope); if(!d) return; svOcc.push({dev:d, key:c.m.key, name:(typeof itemName==='function'?itemName(c.m):c.m.heb), temp:(s.temp!=null?s.temp:null), start:s.start.getTime(), end:s.end.getTime()}); }); });
      svOcc.forEach(function(o){ const mates=svOcc.filter(function(x){ return x!==o && x.dev.id===o.dev.id && x.temp!=null && o.temp!=null && x.temp===o.temp && x.start<o.end && o.start<x.end; });
        if(mates.length){ const baths=(o.dev.cap&&Array.isArray(o.dev.cap.baths)&&o.dev.cap.baths.length)?o.dev.cap.baths:((o.dev.cap&&o.dev.cap.bathL!=null)?[o.dev.cap.bathL]:[]); _svBatch[o.key+'@'+o.start]={names:mates.map(function(m){return m.name;}), bath:baths.length?Math.max.apply(null,baths):null}; }
      });
    }
    computed.forEach(c=>{
      if(c.blocked) return;
      const _tn0=tasks.length;   // tag every task this item pushes with its key, for "select item" in the work-plan view
      const name=(typeof itemName==='function'?itemName(c.m):c.m.heb);
      // ── from-scratch build phases (make-recipes + ground-meat cuts), split-aware ──
      { const sb2=itemScratchBuild(c.m); const stg=c.st.stage||(c.st.ready?'ready':'scratch');
        if(sb2 && stg!=='ready'){ makeBuildTasks(sb2, c.startClock, name, detail, stg).forEach(t=>tasks.push(t)); } }
      let cardSteps=[];
      if(detail && c.m.kind==='cut'){
        const mm=c.profile.methods.find(x=>x.key===c.st.method)||c.profile.methods[0];
        try{ cardSteps=injectSeasoningSteps(composedSteps(c.m.obj, mm.combo||['smoke']), c.m.key); }catch(e){ cardSteps=[]; }
      }
      const findDetail=(kw)=>{ if(!detail) return '';
        const hit=cardSteps.find(s=>kw.some(k=>s[0].includes(k)));
        return hit? hit[1] : ''; };
      const sel=selectedSeasonings(c.m.key).map(seasoningById).filter(Boolean);
      const _det=(s)=>`${t(s.ing)} · ${t(s.use)}${s.sub?` · ⚠ ${L('תחליף','substitute')}: ${t(s.sub)}`:''}`;
      sel.filter(s=>s.kind==='sauce').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-30*60e3),label:`🥄 ${L('הכן רוטב','Make sauce')} ${itemName(s)} — ${name}`,sub:L('אפשר גם יום קודם','can be made a day ahead'),kind:'prep',det:detail?_det(s):''}));
      sel.filter(s=>s.kind==='marinade').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-2*3600e3),label:`🥣 ${L('השרה במרינדת','Marinate in')} ${itemName(s)} — ${name}`,sub:L('לפחות שעתיים לפני, עדיף יותר','at least two hours ahead, more is better'),kind:'prep',det:detail?_det(s):''}));
      sel.filter(s=>s.kind==='rub').forEach(s=>tasks.push({t:new Date(c.startClock.getTime()-40*60e3),label:`🌶️ ${L('שפשף ראב','Rub with')} ${itemName(s)} — ${name}`,sub:'',kind:'prep',det:detail?_det(s):''}));
      if(c.m.key==='cut-18'){ burgerPlanTasks(burgerDiners(), c.startClock, serve, name, detail).forEach(t=>tasks.push(t)); }
      if(detail){
        const prepDet=findDetail(['הכנה','הכנת הנתח','טמפרטורת חדר','הכנה ייעודית','Prep','Room temperature']);
        if(prepDet) tasks.push({t:new Date(c.startClock.getTime()-20*60e3),label:`🔪 ${L('הכנה','Prep')} — ${name}`,sub:'',kind:'prep',det:prepDet});
      }
      c.stages.forEach(s=>{
        if(s.kind==='rest') tasks.push({t:s.start,label:`⏸️ ${L('מנוחה','Rest')} — ${name}`,sub:'',kind:'rest',det:detail?(findDetail(['מנוחה','Rest'])||''):''});
        else if(s.kind==='bcheck') tasks.push({t:s.start,label:`🌡️ ${s.label} — ${name}`,sub:s.note||'',kind:'bcheck',det:detail?L('הגש רק כשמד-חום בליבה מראה ≥ היעד — בדיקת הבטיחות לפני הגשה','Serve only when the core thermometer reads ≥ target — the safety check before serving'):''});   // D1
        else if(s.kind==='note') return;
        else if(s.kind==='dry'){
          tasks.push({t:s.start,label:`🌬️ ${s.label} — ${name}`,sub:s.note||'',kind:'dry',det:''});
        }
        else{
          let det='';
          if(detail){
            if(s.kind==='sv') det=findDetail(['סו-ויד','ואקום','Sous-vide','Vacuum']);
            else if(s.kind==='smoke'){
              det=findDetail(['עישון','Smoke']);
              const wd=c.m.kind==='cut'?c.m.obj.wood:(c.profile&&c.profile.wood);
              const cl=c.m.kind==='cut'?c.m.obj.coal:'';
              if(wd&&wd!=='ללא'&&!(det||'').includes(wd)) det=(det?det+' ':'')+`[🪵 ${L('עץ','Wood')}: ${t(wd)}${cl?` · ${L('פחם','charcoal')}: ${t(cl)}`:''}]`;
            }
            else det=findDetail(['גימור גריל','צריבה','צלייה','גריל','Grill','sear','Sear']);
            if(s.kind!=='smoke'&&c.m.kind==='cut'&&c.m.obj.doneness){
              const dn=['rare','mr','med','mw','well'].filter(k=>c.m.obj.doneness.levels[k]).map(k=>`${doneLabel(c.m.obj,k)} ${c.m.obj.doneness.levels[k].c}°`).join(' · ');
              det=(det?det+' ':'')+`[${L('מידות','Doneness')}: ${dn}]`;
            }
          }
          let _sub=s.note||'';
          if(s.kind==='sv'){ const bt=_svBatch[c.m.key+'@'+s.start.getTime()]; if(bt){ const bn='🌊 '+L('אמבט משותף עם ','shared bath with ')+bt.names.join(', ')+(bt.bath?(' · '+L('השתמש באמבט ','use the ')+bt.bath+L(' ל׳',' L')+L(' לכולם',' bath for all')):''); _sub=_sub?_sub+' · '+bn:bn; } }
          tasks.push({t:s.start,label:`${s.kind==='sv'?'🌊':s.kind==='smoke'?'💨':'🔥'} ${s.label} — ${name}`,sub:_sub,kind:s.kind,det,dur:Math.round(s.hours*3600),tid:s.tid,cooker:cookerLabel(c.m.key,s.kind),contention:!!_clashOcc[c.m.key+'|'+s.kind]});
        }
      });
      const sel2=sel.filter(s=>s.kind==='glaze');
      const lastCook=c.stages.filter(s=>s.kind!=='rest'&&s.kind!=='note').pop();
      if(lastCook) sel2.forEach(s=>tasks.push({t:new Date(lastCook.end.getTime()-15*60e3),label:`🍯 ${L('הברש גלייז','Brush glaze')} ${itemName(s)} — ${name}`,sub:L('10-15 דק׳ אחרונות, בשכבות','last 10-15 min, in layers'),kind:'glaze',det:detail?`${t(s.ing)}${s.sub?` · ⚠ ${L('תחליף','substitute')}: ${t(s.sub)}`:''}`:''}));
      for(let _ti=_tn0;_ti<tasks.length;_ti++){ if(tasks[_ti]&&tasks[_ti].ikey===undefined) tasks[_ti].ikey=c.m.key; }
    });
    // ── mise-en-place clustering: group flexible prep tasks of the same type (2+) ──
    const clusterDefs=[['🥄',L('🥄 הכנת רטבים (mise en place)','🥄 Make sauces (mise en place)')],['🥣',L('🥣 השריית מרינדות','🥣 Marinades')],['🌶️',L('🌶️ הכנת ושפשוף ראבים','🌶️ Rubs — mix and apply')],['🍯',null]]; // glaze stays clock-bound!
    for(const [prefix,title] of clusterDefs){
      if(!title) continue;
      const grp=tasks.filter(t=>t.label.startsWith(prefix));
      if(grp.length>=2){
        const earliest=new Date(Math.min(...grp.map(t=>t.t.getTime())));
        const merged={t:earliest,kind:'prep',label:title,
          sub:L('ריכוז פעולות דומות — הכל ברצף אחד','similar tasks grouped — all in one go'),
          det:grp.map(t=>`• ${t.label.replace(prefix,'').replace(/^[: ]+/,'')}${t.det?` — ${t.det}`:''}`).join('<br>')};
        for(const t of grp){ const i=tasks.indexOf(t); if(i>=0) tasks.splice(i,1); }
        tasks.push(merged);
      }
    }
    if(preheat) tasks.push({t:preheat,label:L('🔥 הדלקת מעשנת (חימום מוקדם)','🔥 Fire up the smoker (preheat)'),sub:preheatHint(),kind:'fire',det:''});
    // Phase 3 (D3/D4): a refuel cadence is a DEVICE fact, so it becomes real tasks on the clock — a stick
    // burner wants a split every 45 min, a pellet hopper wants nothing. equipPlan attached this; without
    // these rows it would be another computed-and-never-read field.
    (computed||[]).forEach(function(c){
      if(!c || c.blocked || !c.stages) return;
      c.stages.forEach(function(s){
        const every=s.refuelEveryMin||0; if(!every || !s.start || !s.end) return;
        const fuel=s.fuelNote||L('דלק','fuel');
        for(let t=s.start.getTime()+every*60e3; t<s.end.getTime()-5*60e3; t+=every*60e3){
          tasks.push({t:new Date(t), kind:'fire', det:'',
            label:L('🪵 הוספת '+fuel,'🪵 Add '+fuel),
            sub:L('שמירה על חום יציב · '+itemName(c.m),'keep the temperature steady · '+itemName(c.m))});
        }
      });
    });
    tasks.push({t:serve,label:L('🍽️ הגשה','🍽️ Serve'),sub:'',kind:'serve',det:''});
    tasks.sort((a,b)=>a.t-b.t);
    window._wpTasks=tasks;   // for voice cook mode
    const shp=tlShape();
    const shapeBtns=Object.entries(SHAPE_NAMES).map(([k,n])=>`<button class="mchip shp-btn ${k===shp?'on':''}" data-tlshape="${k}">${shapeName(k)}</button>`).join('');
    // v144 (bug-fix): sv/smoke order must be reachable from the PLAN view too, not only the per-item schedule card
    const orderItems=computed.filter(c=>!c.blocked && comboHasSvSmoke(c.m, c.st.method));
    const orderControlsHtml=orderItems.length?`<div class="tl-orderstrip">
      <div class="tl-orderstrip-lbl">🔄 ${L('סדר בישול (סו-ויד/עישון):','Cook order (sous-vide/smoke):')}</div>
      ${orderItems.map(c=>`<div class="tl-order tl-order-plan">
        <span class="tl-order-lbl">${itemName(c.m)}:</span>
        <select data-tlorder="${c.m.key}">${Object.entries(SV_SMOKE_ORDERS).map(([k,o])=>`<option value="${k}" ${k===c.st.svSmokeOrder?'selected':''}>${svOrderName(k)}</option>`).join('')}</select>
      </div>${c.st.svSmokeOrder==='smoke-sv'?`<div class="tl-safety-warn">⚠️ <b>${itemName(c.m)}:</b> ${L('הבשר שוהה בטמפ׳-סכנה בעישון הקר <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו. בספק — עבור לסדר סו-ויד←עישון.','The meat sits in the danger zone during the cold smoke <u>before</u> pasteurization. The sous-vide stage marked "incl. pasteurization" must be carried out in full. When in doubt — switch to the sous-vide→smoke order.')}</div>`:''}`).join('')}
    </div>`:'';
    const _blk=computed.filter(c=>c.blocked).map(c=>esc(itemName(c.m)));   // F4: multi-day items are excluded from the timed plan — surface them as a prep-ahead advisory instead of dropping them silently
    // Slice 1C: per-item cooker picker — only shown when >1 device fits a cook stage (a real choice)
    const _ckRows=[];
    computed.forEach(function(c){ if(c.blocked) return; const kinds=[];
      c.stages.forEach(function(s){ if(['sv','smoke','cook'].indexOf(s.kind)>=0 && kinds.indexOf(s.kind)<0) kinds.push(s.kind); });
      kinds.forEach(function(kind){ const cands=cookerCandidates(kind); if(cands.length<2) return;
        const cur=_ckMap[c.m.key+'|'+kind]||''; const kl=kind==='sv'?L('סו-ויד','Sous-vide'):kind==='smoke'?L('עישון','Smoke'):L('גריל','Grill');
        _ckRows.push(`<div class="tl-order"><span class="tl-order-lbl">${esc(itemName(c.m))} · ${kl}:</span><select data-tlcooker="${c.m.key}|${kind}"><option value="">${L('אוטומטי','Auto')}</option>${cands.map(function(d){return `<option value="${d.id}" ${d.id===cur?'selected':''}>${esc(d.name||t(d.type))}</option>`;}).join('')}</select></div>`);
      });
    });
    const cookerStripHtml=_ckRows.length?`<div class="tl-orderstrip"><div class="tl-orderstrip-lbl">🔧 ${L('שיוך מכשיר:','Assign cooker:')}</div>${_ckRows.join('')}</div>`:'';
    // S3 / residual D6: two devices of the SAME class → cookerFor is ambiguous (null), and the item is then
    // silently skipped by clash detection and occupancy. Rather than leave that gap invisible, surface it:
    // list the items that still need a cooker pick so the user knows capacity checks are pending their choice.
    const _unresolved=[];
    computed.forEach(function(c){ if(c.blocked||!c.stages) return; const seen={};
      c.stages.forEach(function(s){ const kind=s.kind; if(['sv','smoke','cook'].indexOf(kind)<0||seen[kind]) return; seen[kind]=1;
        if(cookerCandidates(kind).length>=2 && !cookerFor(c.m.key, kind, _ckScope)){
          const kl=kind==='sv'?L('סו-ויד','SV'):kind==='smoke'?L('עישון','smoke'):L('גריל','grill');
          _unresolved.push(esc(itemName(c.m))+' ('+kl+')');
        }
      });
    });
    const unresolvedHtml=_unresolved.length?`<div class="wp-advisory wp-assign">🔧 <b>${L('ממתין לשיוך מכשיר','Awaiting cooker assignment')}:</b> ${L('יש לך יותר ממכשיר אחד מאותו סוג — לא אוכל לבדוק קיבולת/חפיפות עד שתשייך כל פריט למכשיר (למעלה). ממתינים:','You have more than one device of the same type — I cannot check capacity or clashes until each item is assigned to a device (above). Waiting:')} ${_unresolved.join(', ')}</div>`:'';
    const contentionHtml=_clashes.length?`<div class="wp-advisory wp-clash">⚠️ <b>${L('התנגשות מכשיר','Cooker clash')}:</b> ${_clashes.map(function(cl){
      const names=cl.items.map(function(i){return esc(i.name);}).join(' + ');
      const last=cl.items[cl.items.length-1];
      const other=cookerCandidates(last.kind).filter(function(d){return d.id!==cl.devId;});   // candidates for THIS stage kind, not always 'smoke'
      const move=other.length?` <button class="mchip cookmove" data-cookermove="${esc(last.key)}|${esc(last.kind)}|${esc(other[0].id)}">${L('העבר','Move')} ${esc(last.name)} → ${esc(other[0].name||t(other[0].type))}</button>`:'';
      const why=cl.reason==='area'
        ? `${L('חורגים מהשטח של','exceed the capacity of')} <b>${esc(cl.devName)}</b> (${cl.pct}%)`
        : `${L('דורשים טמפרטורות שונות על','need different temperatures on')} <b>${esc(cl.devName)}</b> (${L('פער','spread')} ${cl.compat.tempSpread}°C)`;
      return `${names} ${why}${move}`;
    }).join('<br>')}</div>`:'';
    return `${_blk.length?`<div class="wp-advisory">📋 <b>${L('הכנה מראש (רב-יומי):','Prep ahead (multi-day):')}</b> ${_blk.join(', ')} — ${L('תהליך של ימים-שבועות (כבישה/ייבוש). נהל ב"המזווה שלי" והכן מבעוד מועד; לא נכלל בלוח היומי.','a days-to-weeks process (curing/drying). Manage in "My pantry" and prepare in advance; not included in the daily schedule.')}</div>`:''}${orderControlsHtml}${cookerStripHtml}${unresolvedHtml}${contentionHtml}<div class="tl-detailtoggle"><span>${L('רמת פירוט:','Detail level:')}</span><button class="mchip ${!detail?'on':''}" data-tldetail="short">${L('מקוצר','Short')}</button><button class="mchip ${detail?'on':''}" data-tldetail="full">${L('מלא — עצמאי להדפסה','Full — self-contained for print')}</button><button class="mchip" data-occview>🗄️ ${L('תפוסת מכשירים','Cooker occupancy')}</button><button class="mchip cop-launch" data-copilotlaunch>🔥 ${L('טייס חי','Live Copilot')}</button><button class="mchip vc-launch" data-vclaunch>🎙️ ${L('מצב בישול קולי','Voice cooking mode')}</button></div>
    <details class="tl-shapedet"><summary>${L('תצוגה','View')}: ${shapeName(shp)} <span class="tl-shapehint">▾ ${L('שנה','change')}</span></summary><div class="tl-shaperow">${shapeBtns}</div></details>
    ${renderWorkplanShape(tasks, shp, detail, serve)}`;
  }
  /* v144: same computed+scheduled tasks, 3 presentation shapes (does not touch scheduling above) */
  function renderWorkplanShape(tasks, shape, detail, serve){
    if(shape==='3') return renderWpHorizontal(tasks, serve);
    if(shape==='5') return renderWpAccordion(tasks, detail, serve);
    return renderWpVertical(tasks, detail, serve);   // shape '1' — also the pre-v144 default markup
  }
  function renderWpVertical(tasks, detail, serve){
    const sc=(typeof evScope==='function')?evScope():'cook';
    const now=Date.now(); const nextIdx=tasks.findIndex(t=>t.t&&t.t.getTime()>now);   // F: first upcoming task = "now/next" cue
    return `<div class="workplan ${detail?'wp-full':''}">${tasks.map((tk,i)=>{
      const key='wpck:'+sc+':'+tk.label; const done=store.get(key);   // F: persist check state across rebuilds by task identity (scope+label)
      const cue = i===nextIdx?'wp-next':'';
      return `<label class="wp-row wp-${tk.kind} ${done?'wp-done':''} ${cue}" data-tlitem="${tk.ikey||''}"><input type="checkbox" class="wp-ck" data-wpck="${encodeURIComponent(key)}" ${done?'checked':''}>
        <span class="wp-time">${cue?`<span class="wp-nowtag">${L('הבא','Next')}</span>`:''}${fmtClockRel(tk.t, serve)}</span>
        <span class="wp-body"><b>${tk.label}</b>${tk.cooker?`<span class="wp-cooker">🔧 ${esc(tk.cooker)}</span>`:''}${tk.contention?`<span class="wp-clashwarn" title="${L('התנגשות מכשיר','Cooker clash')}">⚠</span>`:''}${tk.sub?`<small>${tk.sub}</small>`:''}${tk.det?`<span class="wp-det">${tk.det}</span>`:''}${tk.dur?`<span class="wp-timer">${timerHTML(tk.dur, tk.tid||('wpv-'+i), tk.label)}</span>`:''}</span>
      </label>`;}).join('')}</div>`;
  }
  function renderWpAccordion(tasks, detail, serve){
    return `<div class="workplan wp-accordion ${detail?'wp-full':''}">${tasks.map((tk,i)=>`
      <div class="wp-acc ${i===0?'open':''}" data-wpacc="${i}" data-tlitem="${tk.ikey||''}">
        <div class="wp-acch"><span class="wp-bar wp-bar-${tk.kind}"></span><span class="wp-time">${fmtClockRel(tk.t, serve)}</span><b class="wp-atitle">${tk.label}</b>${tk.cooker?`<span class="wp-cooker">🔧 ${esc(tk.cooker)}</span>`:''}${tk.contention?`<span class="wp-clashwarn" title="${L('התנגשות מכשיר','Cooker clash')}">⚠</span>`:''}<span class="wp-caret">▾</span></div>
        <div class="wp-accb">${tk.sub?`<small>${tk.sub}</small>`:''}${tk.det?`<span class="wp-det">${tk.det}</span>`:''}${!tk.sub&&!tk.det?`<small>${L('אין פרטים נוספים לשלב זה.','No further details for this step.')}</small>`:''}${tk.dur?`<span class="wp-timer">${timerHTML(tk.dur, tk.tid||('wpa-'+i), tk.label)}</span>`:''}</div>
      </div>`).join('')}</div>`;
  }
  function renderWpHorizontal(tasks, serve){
    const ic={sv:'💧',smoke:'💨',cook:'🔥',rest:'⏸️',prep:'🔪',fire:'🔥',serve:'🍽️',glaze:'🍯',dry:'🌬️',bcheck:'🌡️'};
    return `<div class="workplan wp-horiz">${tasks.map((tk,i)=>`
      <div class="wp-hcell wp-${tk.kind}" data-tlitem="${tk.ikey||''}"><div class="wp-hdot">${ic[tk.kind]||'•'}</div><div class="wp-htime">${fmtClockRel(tk.t, serve)}</div><div class="wp-hlabel">${tk.label}</div>${tk.cooker?`<div class="wp-hcooker">🔧 ${esc(tk.cooker)}</div>`:''}${tk.contention?`<div class="wp-clashwarn">⚠</div>`:''}${tk.dur?`<div class="wp-timer">${timerHTML(tk.dur, tk.tid||('wph-'+i), tk.label)}</div>`:''}</div>`).join('')}</div>`;
  }
  function itemRowHtml(c, serve){
    const {m,profile,st,stages,startClock,blocked}=c;
    const scratchable=hasScratchBuild(m);
    if(blocked){
      return `<div class="tlcard tl-blocked">
        <div class="tlc-head"><b class="tl-name">${itemName(m)}</b><span class="tl-badge">${L('תהליך רב-יומי','Multi-day process')}</span></div>
        <p class="tl-note">${L(`בנייה מאפס לקטגוריה זו (${m.cat}) אורכת ימים-שבועות (כבישה/ייבוש) — מוכנה בהכנה מראש. נהל אותה ב"המזווה שלי", ופה סמן "כבר מוכן" ביום הבישול/ההגשה.`,`Building this category (${t(m.cat)}) from scratch takes days to weeks (curing/drying) — it's ready via prep-ahead. Manage it in "My pantry", and here mark "already made" on the cook/serve day.`)}</p>
        <div class="tlc-controls">
          <button class="mchip on" data-tlfresh="${m.key}">${L('מתחיל מאפס','From scratch')}</button>
          <button class="mchip" data-tlready="${m.key}">${L('כבר מוכן','Already made')}</button>
          <button class="tl-pantrybtn" data-tlpantry>🧫 ${L('פתח את המזווה שלי','Open my pantry')}</button>
        </div>
      </div>`;
    }
    const methodOpts=profile.methods.length>1?`<select data-tlmethod="${m.key}">${profile.methods.map(mm=>`<option value="${mm.key}" ${mm.key===st.method?'selected':''}>${t(mm.label)}</option>`).join('')}</select>`:'';
    const woodNote=profile.wood?`<span class="tl-wood">🪵 ${t(profile.wood)}</span>`:'';
    // Phase 4b: this item was pulled earlier so it would fit the cooker alongside the others, which means it
    // is genuinely DONE before serving. Say so — a silent shift would leave the cook holding meat they were
    // never told about. (It is never pushed later; that would miss serve.)
    const readyEarlyNote=(function(){
      const ms=c.readyEarlyMs||0; if(!(ms>0)) return '';
      const h=Math.floor(ms/3600e3), mn=Math.round((ms%3600e3)/60e3);
      // L13: do NOT wrap this in dir="ltr" — it mixes Hebrew words with numbers, and forcing LTR reorders
      // the segments ("מוכן שע׳ 45 דק׳ 12"). Left in the document's own direction it reads correctly.
      const span=h?(h+' '+L('שע׳','h')+(mn?' '+mn+' '+L('דק׳','m'):'')):(mn+' '+L('דק׳','m'));
      return `<span class="tl-early" title="${L('הוקדם כדי להיכנס למכשיר יחד עם השאר','Pulled earlier so it fits the cooker alongside the rest')}">⏳ ${L('מוכן','ready')} ${span} ${L('לפני ההגשה','before serving')}</span>`;
    })();
    const ck=cssKey(m.key);
    // v144: sv/smoke order — only relevant when this item's chosen method actually combines both
    const showOrder=comboHasSvSmoke(m, st.method);
    const orderRow=showOrder?`<div class="tl-order">
        <span class="tl-order-lbl">${L('סדר בישול','Cook order')}:</span>
        <select data-tlorder="${m.key}">${Object.entries(SV_SMOKE_ORDERS).map(([k,o])=>`<option value="${k}" ${k===st.svSmokeOrder?'selected':''}>${svOrderName(k)}</option>`).join('')}</select>
      </div>`:'';
    const orderWarn=(showOrder && st.svSmokeOrder==='smoke-sv')?`<div class="tl-safety-warn">⚠️ <b>${L('דורש תשומת-לב:','Needs attention:')}</b> ${L('הבשר שוהה בטמפ׳-סכנה בעישון הקר <u>לפני</u> הפסטור. שלב הסו-ויד המסומן "כולל פסטור" חייב להתבצע במלואו — לפי טבלת פסטור מוכרת לפי עובי. בספק — עבור לסדר סו-ויד←עישון.','The meat sits in the danger zone during the cold smoke <u>before</u> pasteurization. The sous-vide stage marked "incl. pasteurization" must be carried out in full — per a recognized pasteurization table by thickness. When in doubt — switch to the sous-vide→smoke order.')}</div>`:'';
    const stageRows=stages.map((s,si)=>{
      if(s.kind==='bcheck') return `<div class="tl-stage tl-bcheck">🌡️ <b>${s.label}</b>${s.note?` · ${s.note}`:''}</div>`;   // D1: internal-temp safety gate
      if(s.hours===0) return `<div class="tl-stage tl-stage-note">↳ ${s.label}</div>`;
      const reload=s.kind==='smoke'&&s.hours>2.5?` · ↻ ${L('הוסף עץ כל','add wood every')} ~90 ${L('דק׳','min')} (${L('כ-','~')}${Math.max(1,Math.round(s.hours*60/90)-1)} ${L('פעמים','times')})`:'';
      const hLabel=s.hours<1?Math.round(s.hours*60)+' '+L('דק׳','min'):s.hours.toFixed(1)+L('ש','h');
      return `<div class="tl-stage"><span class="tl-stage-t">${fmtClockRel(s.start, serve)}</span><span class="tl-stage-l">${s.label}${s.note?` · ${s.note}`:''}${reload}</span><span class="tl-stage-h">${hLabel}</span>${timerHTML(Math.round(s.hours*3600), s.tid||('wpi-'+m.key+'-'+si), s.label+' · '+itemName(m))}</div>`;
    }).join('');
    const cut=m.kind==='cut'?m.obj:null;
    const doneRef=(cut&&cut.doneness)?`<div class="tl-doneref"><b>${L('מידות עשייה לגימור (מד-חום פנים)','Finishing doneness levels (internal thermometer)')}</b> — ${L('להתאמה אישית לכל סועד:','to customize per guest:')}<div class="tl-donelist">${['rare','mr','med','mw','well'].filter(k=>cut.doneness.levels[k]).map(k=>`<span class="${k===currentDoneness(cut)?'on':''}">${doneLabel(cut,k)} <b>${cut.doneness.levels[k].c}°</b></span>`).join('')}</div></div>`:'';
    return `<div class="tlcard">
      <div class="tlc-head">
        <span class="tl-startt"><b>${fmtClockRel(startClock, serve)}</b></span>
        <b class="tl-name">${itemName(m)}</b>
        ${readyEarlyNote}
        ${woodNote}
        <button class="tl-expand" data-tlexp="${m.key}" data-ck="${ck}" aria-label="${L('הרחב פירוט שלבים','Expand step details')}">▾</button>
      </div>
      <div class="tlc-controls">
        ${scratchable?`
          <button class="mchip ${st.stage==='ready'?'on':''}" data-tlstage="ready" data-k="${m.key}">${st.stage==='ready'?'✓ ':''}${L('מוכן לגמרי','Fully ready')}</button>
          <button class="mchip ${st.stage==='prepped'?'on':''}" data-tlstage="prepped" data-k="${m.key}">${st.stage==='prepped'?'✓ ':''}${L('הוכן מראש · רק סיום','Prepped ahead · finish only')}</button>
          <button class="mchip ${st.stage==='scratch'?'on':''}" data-tlstage="scratch" data-k="${m.key}">${st.stage==='scratch'?'✓ ':''}🧫 ${L('מאפס היום','From scratch today')}</button>
        `:`
          <button class="mchip ${st.ready?'on':''}" data-tlready="${m.key}">${st.ready?'✓ ':''}${L('כבר מוכן','Already made')}</button>
          <button class="mchip ${!st.ready?'on':''}" data-tlfresh="${m.key}">${!st.ready?'✓ ':''}${L('מתחיל מאפס','From scratch')}</button>
        `}
        ${methodOpts}
        ${orderRow}
        <button class="mchip ${(window._tlSeasOpen&&window._tlSeasOpen.has(m.key))?'on':''}" data-tlseas="${m.key}" data-ck="${ck}">🧂 ${L('תיבול','Seasoning')}${(()=>{const n=selectedSeasonings(m.key).length;return n?` (${n})`:'';})()}</button>
        ${m.key==='cut-18'?`<button class="mchip" data-tlburger>🍔 ${L('בורגרים','Burgers')} (${burgerDiners().length})</button>`:''}
      </div>
      ${orderWarn}
      <div class="tl-seas" id="tlseas-${ck}" style="display:${(window._tlSeasOpen&&window._tlSeasOpen.has(m.key))?'block':'none'}"></div>
      <div class="tl-stages" id="tlstages-${ck}" style="display:none">${stageRows}${doneRef}</div>
    </div>`;
  }
  function wireRows(){
    const list=$("#tlList");
    list.querySelectorAll('[data-tlstage]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.k; const stg=b.dataset.tlstage;
      all[k]=all[k]||{method:null}; all[k].stage=stg; all[k].ready=(stg==='ready'); tlSetState(all); buildList();
      if(stg==='prepped'||stg==='ready'){ try{ const match=pantry().find(pp=>pp.key===k && (projStage(pp)==='ready'||projStage(pp)==='done')); if(match && typeof toast==='function') toast(L('💡 יש "','💡 There is "')+match.name+L('" מוכן במזווה — אפשר לגשר ממנו','" ready in the pantry — you can bridge from it')); }catch(e){} }
      if(stg==='scratch'){ const meta=resolveItem(k); const sb2=itemScratchBuild(meta); if(sb2){ const sp=splitPhases(sb2.phases); const rest=sp.ahead.find(p=>/24|48|לילה/.test(p.label+p.body)); if(rest && typeof toast==='function') toast('⚠ שים לב: יש שלב יישון ארוך (24-48ש) — כדאי להתחיל יום-יומיים מראש'); } }
    }));
    list.querySelectorAll('[data-tlready]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.tlready; all[k]=all[k]||{method:null}; all[k].ready=true; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlfresh]').forEach(b=>b.addEventListener('click',()=>{
      const all=tlState(); const k=b.dataset.tlfresh; all[k]=all[k]||{method:null}; all[k].ready=false; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlmethod]').forEach(sel=>sel.addEventListener('change',()=>{
      const all=tlState(); const k=sel.dataset.tlmethod; all[k]=all[k]||{ready:true}; all[k].method=sel.value; all[k].methodPinned=true; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlorder]').forEach(sel=>sel.addEventListener('change',()=>{
      const all=tlState(); const k=sel.dataset.tlorder; all[k]=all[k]||{ready:true}; all[k].svSmokeOrder=sel.value; tlSetState(all); buildList();
    }));
    list.querySelectorAll('[data-tlcooker]').forEach(sel=>sel.addEventListener('change',()=>{
      const p=String(sel.dataset.tlcooker||'').split('|'); setItemCooker(p[0], p[1], sel.value); buildList();
    }));
    list.querySelectorAll('[data-cookermove]').forEach(b=>b.addEventListener('click',()=>{ const p=String(b.dataset.cookermove||'').split('|'); setItemCooker(p[0],p[1],p[2]); buildList(); }));
    list.querySelectorAll('[data-occview]').forEach(function(b){ b.addEventListener('click',function(){
      const cx=window._wpCtx||{}; openOccupancyView(cx.computed||[], cx.serve, cx.scope);
    }); });
    window._tlSeasOpen=window._tlSeasOpen||new Set();
    const renderTlSeas=(key,ck)=>{
      const host=document.getElementById('tlseas-'+ck); if(!host) return;
      const meta=resolveItem(key); if(!meta) return;
      const c=meta.obj||meta; const cat=meta.cat||c.cat;
      const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
      host.innerHTML=seasPickerHTML(key,cat,isProd,'edit');
      wireSeasPicker(host,key,cat,isProd,'edit',()=>{ buildList(); }, (typeof openTimeline==='function')?openTimeline:null);
    };
    list.querySelectorAll('[data-tlburger]').forEach(b=>b.addEventListener('click',()=>{ if(typeof openBurgerBuilder==='function') openFrom(openTimeline, openBurgerBuilder); }));
    list.querySelectorAll('[data-tlseas]').forEach(b=>b.addEventListener('click',()=>{
      const key=b.dataset.tlseas, ck=b.dataset.ck;
      if(window._tlSeasOpen.has(key)) window._tlSeasOpen.delete(key); else window._tlSeasOpen.add(key);
      buildList();
    }));
    [...(window._tlSeasOpen||[])].forEach(key=>{ const meta=resolveItem(key); if(!meta){window._tlSeasOpen.delete(key);return;} renderTlSeas(key,cssKey(key)); });
    list.querySelectorAll('[data-tlexp]').forEach(b=>b.addEventListener('click',()=>{
      const el=document.getElementById('tlstages-'+b.dataset.ck);
      if(el){ const open=el.style.display!=='none'; el.style.display=open?'none':'block'; b.textContent=open?'▾':'▴'; }
      if(typeof _tlSelect==='function') _tlSelect(b.dataset.tlexp);   // interacting with an item selects it (kept across view switches)
    }));
    // tapping an item card header (not its controls) also selects it
    list.querySelectorAll('.tlcard .tlc-head').forEach(h=>h.addEventListener('click',function(e){
      if(e.target.closest('[data-tlexp],button,select,input,a')) return; const xb=h.querySelector('[data-tlexp]'); if(xb && typeof _tlSelect==='function') _tlSelect(xb.getAttribute('data-tlexp'));
    }));
    list.querySelectorAll('[data-tlpantry]').forEach(b=>b.addEventListener('click',()=>openFrom(openTimeline,openPantry)));
    list.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  }
  buildList();
}

/* ---- backup / restore (export-import) ---- */
function exportData(){
  const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k==='mk-gemkey') continue; o[k]=localStorage.getItem(k);}   // Wave C: never export the paid AI key — a shared backup would leak it
  const payload={app:'matkonet',ver:1,exported:new Date().toISOString(),data:o};
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='matkonet-backup-'+today()+'.json'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    let o; try{ o=JSON.parse(r.result); }catch(e){ if(typeof toast==='function')toast('❌ הקובץ אינו JSON תקין'); return; }
    const d=(o&&o.data)?o.data:o;
    if(!d||typeof d!=='object'||Array.isArray(d)){ if(typeof toast==='function')toast('❌ הקובץ אינו גיבוי תקין של מתכונת'); return; }
    if(o&&o.app&&o.app!=='matkonet'){ if(typeof toast==='function')toast('❌ הגיבוי שייך לאפליקציה אחרת'); return; }
    const keys=Object.keys(d); let ok=0, fail=0;
    keys.forEach(k=>{ try{ localStorage.setItem(k, typeof d[k]==='string'?d[k]:JSON.stringify(d[k])); ok++; }catch(e){ fail++; } });   // Wave C: count per-key failures instead of swallowing them
    favs=new Set(store.get('mk-fav')||[]);
    applyAppearance(); updateFavBadge(); updateCartBadge(); render();
    if(typeof toast==='function'){
      if(fail>0) toast('⚠ '+L('שוחזרו','Restored')+' '+ok+' '+L('מתוך','of')+' '+keys.length+' '+L('פריטים','items')+' — '+fail+' '+L('נכשלו (ייתכן שהאחסון מלא). ייצא-מחדש אחרי פינוי מקום.','failed (storage may be full). Re-export after freeing space.'));
      else toast('✓ '+L('הנתונים שוחזרו','Data restored')+' ('+ok+' '+L('פריטים','items')+')');
    }
  };
  r.onerror=()=>{ if(typeof toast==='function')toast('❌ שגיאה בקריאת הקובץ'); };
  r.readAsText(file);
}
// ── "הציוד שלי" — equipment profile (settings) ──
// Wave 3 · onboarding concierge — describe your gear in words → config. Local-first keyword parser (offline, no key).
function gearFromText(desc){
  const s=String(desc||'').toLowerCase(); const g={};
  if(/offset|אופסט|stick.?burner|סטיק.?ברנר/.test(s)) g.smoker='אופסט / סטיק-ברנר';
  else if(/kamado|קמאדו|big green egg|\bbge\b|ceramic|קרמי/.test(s)) g.smoker='קמאדו / קרמי';
  else if(/pellet|פלט|traeger|טרייגר/.test(s)) g.smoker='פלטים';
  else if(/\bwsm\b|bullet|barrel|חבית|\bdrum\b/.test(s)) g.smoker='WSM / חבית';
  else if(/cabinet|ארון|electric smoker|מעשנה חשמלית/.test(s)) g.smoker='ארון / קבינט';
  else if(/smoker|מעשנ|עישון/.test(s)) g.smoker='ארון / קבינט';
  if(/kettle|קטל|weber|וובר/.test(s)) g.grill='קטל';
  else if(/charcoal|פחם|lump|briquette/.test(s)) g.grill='פחם';
  else if(/gas grill|גריל גז|propane|\bgas\b|גז/.test(s)) g.grill='גז';
  else if(/plancha|פלנצ|griddle|פלטה/.test(s)) g.grill='פלנצ׳ה / פלטה';
  else if(/grill|גריל|\bbbq\b|על האש/.test(s)) g.grill='פחם';
  if(/sous.?vide|סו.?ויד|circulator|immersion|טבילה|anova|joule|\bisv\b/.test(s)) g.sousvide='טבילה (immersion)';
  if(/meater|wireless|אלחוטי/.test(s)) g.thermo='פרוב אלחוטי';
  else if(/instant.?read|thermapen|מיידי/.test(s)) g.thermo='מיידי (instant-read)';
  else if(/inkbird|\bprobe\b|מדחום|thermometer|פרוב/.test(s)) g.thermo='פרוב נעוץ';
  if(/grinder|מטחנ|mincer|טוחן/.test(s)) g.grinder='ייעודית';
  if(/stuffer|מילוי|sausage stuff|מכונת נקניק/.test(s)) g.stuffer='אנכית';
  if(/chamber vac|ואקום חדר|chamber/.test(s)) g.vacuum='חדר (chamber)';
  else if(/vacuum|ואקום|foodsaver|שואב/.test(s)) g.vacuum='שקית חיצונית (edge)';
  return g;
}
function levelFromText(s, g){ s=String(s||'').toLowerCase();
  if(/beginner|מתחיל|new to|just start|first time|פעם ראשונה/.test(s)) return 'beginner';
  if(/pitmaster|\bpro\b|competition|תחרות|years|שנים|offset|\bwsm\b|charcuterie|שרקוטרי/.test(s) || (g.smoker&&g.grinder)) return 'pro';
  return 'mid';
}
function gearConciergeApply(g, level){
  const CORE={smoker:'smoker', grill:'grill', sousvide:'sousvide', thermo:'probe', grinder:'grinder', stuffer:'stuffer', vacuum:'vacuum'};
  const list=equipList();
  Object.keys(g||{}).forEach(function(k){
    const v=g[k]; if(!v || v==='אין') return;
    const cat=CORE[k]||'other', type=CORE[k]?v:k;
    if(list.some(function(d){ return d.cat===cat && d.type===type; })) return;   // no duplicates
    list.push({id:equipId(), cat:cat, type:type, name:v, brand:'', model:'', fuel:'', cap:{}, specSource:'manual', notes:''});
  });
  equipSave(list); equipSetConfigured();
  if(level) store.set('mk-uilevel', level);
  if(typeof cRefreshHome==='function') cRefreshHome();
}
function _gearConciergePreview(g, level){
  const he=(typeof getLang!=='function'||getLang()==='he'); const rows=[];
  const nameOf={smoker:he?'מעשנה':'Smoker',grill:he?'גריל':'Grill',sousvide:he?'סו-ויד':'Sous-vide',thermo:he?'מדחום':'Probe',grinder:he?'מטחנה':'Grinder',stuffer:he?'מכונת מילוי':'Stuffer',vacuum:he?'ואקום':'Vacuum'};
  Object.keys(g).forEach(function(k){ rows.push(`<div class="gc-row">✓ <b>${nameOf[k]||k}</b> · ${esc(t?t(g[k]):g[k])}</div>`); });
  const lvl=({beginner:he?'מתחיל':'Beginner',mid:he?'בינוני':'Intermediate',pro:he?'מתקדם':'Pro'})[level]||level;
  return rows.length ? `${rows.join('')}<div class="gc-row">🧭 ${he?'רמת ממשק מוצעת':'Suggested level'}: <b>${lvl}</b></div>` : `<div class="cop-pacenote">${he?'לא זיהיתי ציוד — נסה לתאר בפירוט (מעשנה, גריל, סו-ויד, מדחום…).':'Didn’t detect any gear — try describing it (smoker, grill, sous-vide, probe…).'}</div>`;
}
function openGearConcierge(){
  if(typeof showPanel!=='function') return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  showPanel(`${typeof toolTop==='function'?toolTop(L('ספר לי מה יש לך','Tell me your setup'),L('תאר את הציוד במילים שלך — אגדיר אותו','Describe your gear — I’ll set it up'),'✨','#5a7d8c'):`<h2 style="padding:16px">${L('הציוד שלי','My gear')}</h2>`}
    <div class="panel-body">
      <textarea id="gcDesc" class="cop-in" rows="3" style="resize:vertical" placeholder="${he?'למשל: מעשנת אופסט, וובר קטל, מקל סו-ויד, מדחום MEATER, מטחנה ומכונת מילוי':'e.g. an offset smoker, a Weber kettle, a sous-vide stick, a MEATER probe, a grinder and a stuffer'}"></textarea>
      <button class="ccta" id="gcGo" style="margin-top:10px">✨ ${he?'הגדר את הציוד שלי':'Set up my gear'}</button>
      <div id="gcResult"></div>
    </div>`);
  const go=$("#gcGo"); if(go) go.addEventListener('click',function(){ const desc=($("#gcDesc")||{}).value||''; const g=gearFromText(desc); const level=levelFromText(desc,g); const res=$("#gcResult");
    if(res){ res.innerHTML=`<div class="gc-preview">${_gearConciergePreview(g,level)}</div>${Object.keys(g).length?`<button class="ccta" id="gcApply" style="margin-top:10px;background:var(--fresh);border-color:var(--fresh)">✓ ${he?'החל':'Apply'}</button>`:''}`;
      const ap=$("#gcApply"); if(ap) ap.addEventListener('click',function(){ gearConciergeApply(g,level); if(typeof toast==='function') toast(he?'הציוד הוגדר ✓':'Gear set ✓'); if(typeof closePanel==='function') closePanel(); }); }
  });
}
// Equipment 2.0 · Slice 1B — AI equipment helper. Curated brand list (offline) + web-grounded spec/model lookup.
const EQUIP_BRANDS={
  smoker:['Weber','Traeger','Pit Boss','Masterbuilt','Kamado Joe','Big Green Egg','Oklahoma Joe','Char-Griller','Camp Chef','Bradley'],
  grill:['Weber','Napoleon','Char-Broil','Broil King','Pit Boss','Kamado Joe','Big Green Egg'],
  oven:['Ooni','Gozney','Breville','Sage'],
  sousvide:['Anova','Breville','Inkbird','Instant'],
  probe:['MEATER','Inkbird','ThermoWorks','Combustion','ThermoPro'],
  grinder:['LEM','STX','Kitchener','Weston'],
  stuffer:['LEM','Hakka','Waltons','Kitchener'],
  vacuum:['FoodSaver','Anova','Inkbird','Weston','VacMaster','Caso','Bonsenkitchen'],
  other:[]
};
// per-sub-type tile emoji (mockup uses a distinct icon per device, not one per category)
const EQUIP_TYPE_ICON={
  'ארון / קבינט':'🗄️','אופסט / סטיק-ברנר':'📦','פלטים':'🛢️','קמאדו / קרמי':'🥚','WSM / חבית':'🛢️','קטל (ככלי עישון)':'⚫','גז (עם תיבת עשן)':'🔥','חשמלי':'🔌',
  'פחם':'⚫','גז':'🔥','קטל':'🔥','פלנצ׳ה / פלטה':'🍳','לבה / אינפרא':'🔥',
  'ביתי':'♨️','דק':'🍕','פיצה':'🍕',
  'טבילה (immersion)':'🌀','מיכל ייעודי':'🛁',
  'מיידי (instant-read)':'🌡️','פרוב נעוץ':'🌡️','פרוב אלחוטי':'📡','בקר-מאוורר':'🌬️',
  'ייעודית':'🥩','מתאם למיקסר':'🥩','אנכית':'🌭','אופקית':'🌭','מזרק / משפך ידני':'💉',
  'שקית חיצונית (edge)':'🛍️','חדר (chamber)':'🗄️','ידני / משאבה':'💨'
};
function equipTypeIcon(cat,type){ return EQUIP_TYPE_ICON[type] || (equipCat(cat)||{}).icon || '🧰'; }
const FUEL_EMOJI={charcoal:'⚫',wood:'🪵',pellet:'🛢️',gas:'🔥',electric:'🔌'};
// sub-type display per language: legacy English gear keys (migrated 'other' items) → Hebrew/English;
// strip an English "(hint)" parenthetical in Hebrew (e.g. "טבילה (immersion)" → "טבילה"); else dict via t().
const LEGACY_TYPE={torch:['מבער / לפיד','Torch'], humidity:['בקר לחות','Humidity control']};
// The "Other" category is a checklist of accessories — each with a SPECIFIC icon; some carry a small
// property (scale → resolution, cure chamber → type). Keys mirror the old GEAR_GROUPS ids + LEGACY_TYPE
// so migrated gear (scale/injector/slicer/cure-chamber/hooks/torch/humidity) and hasGear() keep working.
// prop.opts entries are plain strings (language-neutral) OR {he,en} (the stored value = the en string).
const EQUIP_OTHER_ITEMS=[
  {key:'scale',       he:'משקל דיגיטלי',        en:'Digital scale',    em:'⚖️', prop:{key:'res',  he:'רזולוציה', en:'Resolution', opts:['1g','0.1g']},
   props:[{key:'maxKg', he:'משקל מרבי', en:'Max capacity', kind:'num', unit:'ק״ג', em:'⚖️', tier:'core', bounds:[0.1,200], alt:['lb->kg','g->kg']}]},
  {key:'injector',    he:'מזרק בשר',            en:'Meat injector',    em:'💉'},
  {key:'slicer',      he:'מכונת פריסה',         en:'Meat slicer',      em:'🍖',
   props:[{key:'maxMm', he:'עובי מרבי', en:'Max thickness', kind:'num', unit:'מ״מ', em:'🔪', tier:'pro', bounds:[0.5,50], alt:['cm->mm','in->mm']}]},
  {key:'curechamber', he:'תא ריפוי / ייבוש',    en:'Cure chamber',     em:'🧊', prop:{key:'kind', he:'סוג',      en:'Type',       opts:[{he:'תא ייעודי',en:'Dedicated'},{he:'מקרר מומר',en:'Converted fridge'},{he:'מייבש',en:'Dehydrator'},{he:'תנור',en:'Oven'}]},
   props:[{key:'tempC', he:'טמפ׳ יעד', en:'Target temp', kind:'num', unit:'°C', em:'🌡️', tier:'pro', def:13, bounds:[0,30], alt:['F->C']},
          {key:'rhPct', he:'לחות יעד',  en:'Target RH',   kind:'num', unit:'%',  em:'💧', tier:'pro', def:78, bounds:[40,95], alt:[]}]},
  {key:'cooler',      he:'צידנית / קמברו',      en:'Cooler / cambro',  em:'🧊'},
  {key:'hooks',       he:'ווים / שבכות לתלייה', en:'Hanging hooks',    em:'🪝',
   props:[{key:'count', he:'מספר ווים', en:'How many', kind:'num', em:'🪝', tier:'core', bounds:[1,200], alt:[]}]},
  {key:'humidity',    he:'בקר לחות',            en:'Humidity control', em:'💧',
   props:[{key:'rhPct', he:'לחות יעד', en:'Target RH', kind:'num', unit:'%', em:'💧', tier:'pro', def:78, bounds:[40,95], alt:[]}]},
  {key:'torch',       he:'מבער / לפיד',         en:'Torch',            em:'🔥'},
  {key:'chimney',     he:'ארובת הצתה',          en:'Chimney starter',  em:'🕯️'},
  {key:'gloves',      he:'כפפות חום',           en:'Heat gloves',      em:'🧤'},
  {key:'tongs',       he:'מלקחיים',             en:'Tongs',            em:'🍢'},
  {key:'brush',       he:'מברשת גריל',          en:'Grill brush',      em:'🧽'},
  {key:'drippan',     he:'מגש איסוף / מים',     en:'Drip / water pan', em:'🫗'},
  {key:'spritz',      he:'בקבוק ריסוס',         en:'Spritz bottle',    em:'💦'},
  {key:'paper',       he:'נייר קצבים',          en:'Butcher paper',    em:'🧻'},
  {key:'foil',        he:'רדיד אלומיניום',      en:'Aluminum foil',    em:'🥡'},
  {key:'blower',      he:'מפוח / מאוורר',       en:'Blower / fan',     em:'💨'},
  {key:'knife',       he:'סכין פריסה',          en:'Slicing knife',    em:'🔪'},
  {key:'board',       he:'קרש חיתוך',           en:'Cutting board',    em:'🪵'},
];
// ── recipe equipment (DATA.cuts[].equip) → the catalog's "what you need" section ───────────────────────────
// Each vocabulary token resolves to either a device category (EQUIP_CATS — carries its own icon + accent colour)
// or an accessory (EQUIP_OTHER_ITEMS). Ownership is read from the user's kit so every chip reads have/missing.
function equipTokenInfo(tok){
  const c=(typeof EQUIP_CATS!=='undefined')?EQUIP_CATS.find(function(x){return x.cat===tok;}):null;
  if(c) return {key:tok, he:c.he, en:c.en, em:c.icon, acc:c.acc, accL:c.accL, dev:true};
  const it=EQUIP_OTHER_ITEMS.find(function(x){return x.key===tok;});
  if(it) return {key:tok, he:it.he, en:it.en, em:it.em, acc:'#7a6a5c', accL:'#ece5df', dev:false};
  return null;   // unknown token → caller skips it (never render a raw key to the user)
}
function equipOwnsToken(tok){
  const info=equipTokenInfo(tok); if(!info) return false;
  return info.dev ? equipByCat(tok).length>0
                  : equipList().some(function(d){return d && d.cat==='other' && d.type===tok;});
}
function equipChip(tok, need){
  const i=equipTokenInfo(tok); if(!i) return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  const owned=equipOwnsToken(tok), configured=(typeof equipConfigured==='function')&&equipConfigured();
  const mark=!configured?'' : (owned?'<span class="eqc-ok">✓</span>':'<span class="eqc-no">✗</span>');
  const cls='eqc'+(need?' eqc-need':' eqc-opt')+(configured&&!owned?' eqc-miss':'');
  return `<span class="${cls}" style="--eqc:${i.acc};--eqcl:${i.accL}"><span class="eqc-em">${i.em}</span>${esc(he?i.he:i.en)}${mark}</span>`;
}
const EQUIP_PHASE_LABEL={sv:['סו-ויד','Sous-vide'], smoke:['עישון','Smoke'], grill:['גריל','Grill'], cook:['בישול','Cook'], cure:['ריפוי','Cure'], prep:['הכנה','Prep']};
function equipSpecNote(spec){
  if(!spec) return '';
  const he=(typeof getLang!=='function'||getLang()==='he'); const bits=[];
  if(spec.min_bath_l)    bits.push(`${he?'אמבט':'Bath'} ≥ ${spec.min_bath_l} ${he?'ל׳':'L'}`);
  if(spec.footprint_cm2) bits.push(`${he?'שטח':'Area'} ~${spec.footprint_cm2} ${he?'סמ״ר':'cm²'}`);
  if(spec.casing_mm)     bits.push(`${he?'מעטה':'Casing'} ${spec.casing_mm} ${he?'מ״מ':'mm'}`);
  if(spec.scale_res)     bits.push(`${he?'משקל':'Scale'} ≥ ${spec.scale_res} ${he?'(למינון קיור מדויק)':'(for accurate cure dosing)'}`);
  return bits.length?`<span class="eq-spec">${bits.join(' · ')}</span>`:'';
}
function equipSectionHtml(eq){
  if(!eq) return '';
  const he=(typeof getLang!=='function'||getLang()==='he');
  const row=(label, need, opt, spec)=>{
    const chips=(need||[]).map(function(k){return equipChip(k,true);}).join('')
              + (opt||[]).map(function(k){return equipChip(k,false);}).join('');
    if(!chips) return '';
    return `<div class="eq-row">${label?`<div class="eq-rl">${label}</div>`:''}<div class="eq-chips">${chips}</div>${equipSpecNote(spec)}</div>`;
  };
  const baseNote=equipSpecNote(eq.spec);
  let body=row('', eq.need, eq.opt, eq.spec);
  Object.keys(eq.by||{}).forEach(function(ph){
    const b=eq.by[ph]||{}, lab=EQUIP_PHASE_LABEL[ph];
    // a phase that just restates the cut's own footprint adds nothing — show only what's new for that phase
    const spec=(equipSpecNote(b.spec)===baseNote)?null:b.spec;
    body+=row(lab?(he?lab[0]:lab[1]):ph, b.need, b.opt, spec);
  });
  if(!body) return '';
  const configured=(typeof equipConfigured==='function')&&equipConfigured();
  return `<div class="var eq-sec">
      <h4>🧰 ${L('ציוד לנתח הזה','Equipment for this cut')}</h4>
      <p class="eq-hint">${configured
        ? L('✓ יש לך · ✗ חסר לך. מסגרת מלאה = נדרש, מקווקוות = מומלץ.','✓ you have it · ✗ missing. Solid = required, dashed = nice-to-have.')
        : L('מסגרת מלאה = נדרש, מקווקוות = מומלץ. הגדר את הציוד שלך כדי לראות מה חסר.','Solid = required, dashed = nice-to-have. Set up your kit to see what you are missing.')}</p>
      ${body}
    </div>`;
}
function typeLabel(type){
  if(!type) return '';
  if(LEGACY_TYPE[type]) return L(LEGACY_TYPE[type][0], LEGACY_TYPE[type][1]);
  if((typeof getLang==='function'?getLang():'he')==='he') return String(type).replace(/\s*\([^)]*[A-Za-z][^)]*\)\s*$/,'').trim()||String(type);
  return (typeof t==='function')?t(type):type;
}
function equipAiOn(){ return typeof aiAvail==='function' && aiAvail(); }
// web-grounded spec lookup → normalized {subtype, fuel, cap:{...}, area, note}. Advisory; user confirms before save.
// format a metric cooking area (cm²) → "3710 cm²", or "2.4 m²" for big rigs
function acmFmt(cm2){ cm2=Math.round(cm2); return cm2>=10000 ? (+(cm2/10000).toFixed(2))+' m²' : cm2+' cm²'; }
async function aiLookupDevice(query, cat){
  if(!equipAiOn()) throw new Error('no-key');
  const c=equipCat(cat)||{}; const types=c.types||[];
  const catProps=(c.props||[]);   // this category's own props[] (Task 1) — only ask for what applies (a stuffer has no maxC)
  // Describe each property by its CANONICAL unit (propCoerce prefers it, converting only when the raw value
  // is implausible as given) so the model's answer needs the least amount of guessing to land in range.
  const propSchemaField=function(p){
    if(p.kind==='bool') return '"'+p.key+'":"true|false|null — '+(p.en||p.key)+'"';
    if(p.kind==='choice') return '"'+p.key+'":"'+(p.opts||[]).map(function(o){return o.v;}).join('|')+'|null — '+(p.en||p.key)+'"';
    return '"'+p.key+'":"<'+(p.en||p.key)+(p.unit?' in '+p.unit:'')+' as a plain number, or null>"';
  };
  const q=String(query||'').trim(); const isUrl=/^https?:\/\//i.test(q);
  // Ask for EVERY orchestration-relevant property, always in METRIC; "name" is a clean model name, never a URL.
  const schema='{"name":"<clean product/model name — NEVER a URL>",'
    +'"subtype":"<exact string from the sub-type list, or null>",'
    +'"fuel":"charcoal|pellet|gas|wood|electric|null",'
    +'"racks":"<racks/shelves count or null>","zones":"<grill heat-zones count or null>",'
    +'"channels":"<probe channels or null>","bathL":"<sous-vide bath litres or null>",'
    +'"volume":"<sausage-stuffer cylinder litres or null>",'
    +'"nozzles":"<array of output-tube diameters in mm, e.g. [10,20,30,40], or null>",'
    +'"areaCm2":"<TOTAL cooking area in square centimetres as a plain number, or null>",'
    +(catProps.length?(catProps.map(propSchemaField).join(',')+','):'')
    +'"note":"<one short factual line>","details":"<extra specs — dimensions, weight, material, power — one line, or null>"}';
  const task=(isUrl?('Extract the published specs for the cooking device on THIS product page: '+q+'. ')
      :('Look up the real, published specs for this cooking device: "'+q+'"'+(cat?(' (a '+(c.en||cat)+')'):'')+'. Search the manufacturer or a retailer page. '))
    +'Return ONLY orchestration-relevant data as JSON, with the MOST properties you can verify. '
    +'ALWAYS use METRIC units — total cooking area as a number of SQUARE CENTIMETRES (areaCm2), volumes in litres, tube diameters in millimetres; convert any imperial spec to metric. '
    +'"name" must be the clean product/model name, NEVER a URL. '
    +(types.length?('For "subtype" return the EXACT string from this list, do NOT translate it: '+JSON.stringify(types)+'. '):'')
    +'Fill every property that applies to this device type: racks/shelves; grill heat zones; probe channels; sous-vide bath litres; sausage-stuffer cylinder litres (volume) and its output-tube diameters in mm (nozzles); total cooking area (areaCm2). Use null for anything not applicable or that you cannot determine. '
    +'Only state a property IF the page actually gives it — use null otherwise. Never guess a value: an absent property falls back to a sane default, but a wrong one silently poisons the plan.';
  const raw=await aiJSON({task, schemaHint:schema, search:true, temperature:0.2, maxTokens:900, outLang:'en'});
  const cap={}; ['racks','zones','channels','bathL','volume'].forEach(function(k){ const v=parseFloat(raw&&raw[k]); if(!isNaN(v)&&v>0&&v<100000) cap[k]=(k==='racks'||k==='zones'||k==='channels')?Math.round(v):v; });
  const keepCap=c.capKey?[c.capKey]:(cat==='sousvide'?['bathL']:[]); Object.keys(cap).forEach(function(k){ if(keepCap.indexOf(k)<0) delete cap[k]; });   // only this category's own capacity (no stray channels on a smoker, etc.)
  const FUELS=['charcoal','pellet','gas','wood','electric'];
  const subtype=(raw&&typeof raw.subtype==='string'&&types.indexOf(raw.subtype)>=0)?raw.subtype:'';
  let nozzles=[];   // stuffer output-tube diameters (mm) → multi-value chips
  if(raw&&Array.isArray(raw.nozzles)) nozzles=raw.nozzles;
  else if(raw&&typeof raw.nozzles==='string'&&raw.nozzles.toLowerCase()!=='null') nozzles=raw.nozzles.split(/[^\d.]+/);
  nozzles=nozzles.map(function(x){return parseFloat(x);}).filter(function(v){return !isNaN(v)&&v>0&&v<1000;});
  let area=''; const acm=parseFloat(raw&&raw.areaCm2); if(!isNaN(acm)&&acm>0&&acm<1e7) area=acmFmt(acm);
  const nm=(raw&&typeof raw.name==='string'&&raw.name.trim()&&!/^https?:\/\//i.test(raw.name.trim()))?raw.name.trim():'';
  const details=(raw&&typeof raw.details==='string'&&raw.details.trim()&&raw.details.toLowerCase()!=='null')?raw.details.trim():'';
  // Category properties: canonical-first via propCoerce (Task 1) — an in-range value is kept as given, an
  // out-of-range one converts ONLY when a declared unit `alt` explains it (a US page's 900°F -> 482°C), and
  // a value implausible in every unit is DISCARDED, never stored. An absent/null property is left unset so
  // propOf's class default applies — a missing property is harmless, a wrong one silently poisons the plan.
  const props={};
  catProps.forEach(function(p){
    const v=raw?raw[p.key]:undefined;
    // "the page didn't say" -> leave unset so the class default applies. A grounded call parses JSON out of
    // TEXT, so a not-stated field can arrive as the literal string "null"/"n/a" — without this guard a bool
    // would fall through to `false`, asserting "this smoker cannot hang" when the page was simply silent.
    if(v===undefined||v===null||v==='') return;
    if(typeof v==='string' && /^(null|none|n\/a|na|unknown|-|—)$/i.test(v.trim())) return;
    if(p.kind==='bool'){ props[p.key]=(v===true||v==='true'); return; }
    if(p.kind==='choice'){ if((p.opts||[]).some(function(o){return o.v===v;})) props[p.key]=v; return; }
    const rc=propCoerce(p, v); if(rc) props[p.key]=rc.v;              // null -> no unit interpretation works -> skip
  });
  return { name:nm, subtype:subtype, fuel:(raw&&FUELS.indexOf(raw.fuel)>=0)?raw.fuel:'', cap:cap, nozzles:nozzles, area:area, props:props, note:(raw&&typeof raw.note==='string')?raw.note:'', details:details };
}
// web-grounded model browse for a brand → array of {name, spec} for the catalogue cards
async function aiBrandModels(brand, cat){
  if(!equipAiOn()) throw new Error('no-key');
  const c=equipCat(cat)||{};
  const schema='{"models":[{"name":"<model name>","spec":"<one short line: fuel · capacity · size / notable feature>"}]}';
  const task='List up to 8 well-known '+(c.en||cat||'cooking equipment')+' models made by "'+String(brand||'')+'", most popular first. For each, give the model name and a short one-line spec summary (fuel / racks or size / a notable feature).';
  const raw=await aiJSON({task, schemaHint:schema, search:true, temperature:0.3, maxTokens:700, outLang:'en'});
  const arr=(raw&&Array.isArray(raw.models))?raw.models:(Array.isArray(raw)?raw:[]);
  return arr.map(function(m){ if(typeof m==='string') return {name:m,spec:''}; if(m&&typeof m.name==='string') return {name:m.name,spec:(typeof m.spec==='string'?m.spec:'')}; return null; }).filter(function(m){return m&&m.name.trim();}).slice(0,8);
}
function openEquipment(){
  let editId=null;
  const cm=function(cat){ return equipCat(cat)||{}; };
  const otherConst=function(type,name){ return EQUIP_OTHER_ITEMS.find(function(x){ return x.key===type||x.he===type||x.en===type||x.he===name||x.en===name; })||null; };   // map an 'other' device → a preset accessory (by key OR name); null = a custom item
  const otherPropVal=function(it,d){ return (it&&it.prop&&d&&d.cap&&d.cap[it.prop.key])||''; };   // the chosen property value (e.g. scale '0.1g')
  const propOptLabel=function(prop,val){ if(!prop||!val) return val||''; const o=prop.opts.find(function(x){ return (typeof x==='string'?x:x.en)===val; }); return o?(typeof o==='string'?o:L(o.he,o.en)):val; };
  const catName=function(cat){ const c=cm(cat); return L(c.he,c.en); };
  const fuelLabel=function(f){ if(!f) return ''; return L(({charcoal:'פחם',wood:'עץ',pellet:'פלטים',gas:'גז',electric:'חשמל'})[f]||f, ({charcoal:'Charcoal',wood:'Wood',pellet:'Pellet',gas:'Gas',electric:'Electric'})[f]||f); };
  const typeOpts=function(cat,sel){ const c=cm(cat); return (c.types||[]).map(function(tp){return `<option value="${esc(tp)}" ${tp===sel?'selected':''}>${esc(typeLabel(tp))}</option>`;}).join('')+`<option value="__custom__" ${sel==='__custom__'?'selected':''}>${L('אחר…','Other…')}</option>`; };
  const brandOpts=function(cat){ return (EQUIP_BRANDS[cat]||[]).map(function(b){return `<option value="${esc(b)}">`;}).join(''); };
  const fuelOpts=function(sel){ return [['','—'],['charcoal',fuelLabel('charcoal')],['wood',fuelLabel('wood')],['pellet',fuelLabel('pellet')],['gas',fuelLabel('gas')],['electric',fuelLabel('electric')]].map(function(o){return `<option value="${o[0]}" ${o[0]===sel?'selected':''}>${o[1]}</option>`;}).join(''); };
  const chipsFor=function(d){ const c=cm(d.cat); let s='';
    if(c.capKey && d.cap && d.cap[c.capKey]!=null) s+=`<span class="eq-chip spec">${c.capEm?c.capEm+' ':''}${esc(d.cap[c.capKey]+' '+L(c.capHe,c.capEn))}</span>`;
    if(c.multiCap){ const mk=c.multiCap; let arr=(d.cap&&Array.isArray(d.cap[mk.key])&&d.cap[mk.key].length)?d.cap[mk.key]:[]; if(!arr.length && mk.key==='baths' && d.cap && d.cap.bathL!=null) arr=[d.cap.bathL];   // legacy single bathL
      if(arr.length) s+=`<span class="eq-chip spec">${mk.em?mk.em+' ':''}${esc(arr.join(' · ')+' '+L(mk.uHe,mk.uEn))}</span>`; }
    if(d.cap && d.cap.area) s+=`<span class="eq-chip spec">📐 ${esc(d.cap.area)}</span>`;   // total cooking / smoking area (metric)
    // Property chips: only STORED values (not class defaults) — a chip means "you told us this".
    (c.props||[]).forEach(function(p){
      const raw=d.cap?d.cap[p.key]:undefined; if(raw===undefined||raw===''||raw===null) return;
      if(p.kind==='bool'){ if(raw===true||raw==='true') s+=`<span class="eq-chip"><span class="em">${p.em}</span> ${esc(L(p.he,p.en))}</span>`; return; }
      if(p.kind==='choice'){ const o=(p.opts||[]).find(function(x){return x.v===raw;}); s+=`<span class="eq-chip"><span class="em">${p.em}</span> ${esc(o?L(o.he,o.en):String(raw))}</span>`; return; }
      s+=`<span class="eq-chip spec"><span class="em">${p.em}</span> ${esc(String(raw)+(p.unit?' '+p.unit:''))}</span>`;
    });
    if(d.fuel) s+=`<span class="eq-chip"><span class="em">${FUEL_EMOJI[d.fuel]||''}</span> ${esc(fuelLabel(d.fuel))}</span>`;
    return s; };
  // mockup .gl-head — Settings kicker + My Equipment title + optional sub + inline Add; .x auto-wires to closePanel
  const headHtml=function(withAdd, sub){
    return `<header class="eq-head"><button class="x eq-x" type="button" aria-label="${L('סגור','Close')}">✕</button>`
      +`<div class="eq-head-t"><p class="eq-kick">${L('הגדרות','Settings')}</p><h1>🧰 ${L('הציוד שלי','My Equipment')}</h1>${sub?`<p class="eq-sub">${sub}</p>`:''}</div>`
      +(withAdd?`<button class="eq-add" id="eqAddNew" type="button"><span class="pl">＋</span> ${L('הוסף','Add')}</button>`:'')
      +`</header>`;
  };

  const drawEmpty=function(){
    const chips=['smoker','grill','oven','sousvide','vacuum','probe'].map(function(cat){ const c=cm(cat); return `<button class="eq-egchip" data-eqpick="${cat}"><span>${equipTypeIcon(cat,(c.types||[])[0])}</span> ${L(c.he,c.en)}</button>`; }).join('');
    showPanel(headHtml(false,'')+`<div class="panel-body eq-wrap"><section class="eq-con"><div class="eq-con-spark">✨</div><div class="eq-con-ic">🔥🍳</div><h2 class="eq-con-h">${L('בוא נכיר את ','Let’s meet ')}<b>${L('הציוד שלך','your kit')}</b></h2><p class="eq-con-sub">${L('הוסף את הציוד שלך — כל מתכון יתאים את עצמו אליו','Add your gear — every recipe then tunes itself to it')}</p><p class="eq-or-add">${L('בחר קטגוריה להוספה','pick a category to add')}</p><div class="eq-egrow">${chips}</div></section></div>`);
    const pnl=$("#panel");
    pnl.querySelectorAll('[data-eqpick]').forEach(function(b){ b.addEventListener('click', function(){ editId=null; drawForm(b.dataset.eqpick); }); });   // chips = quick-add: open the form for that category
  };

  const drawList=function(){
    const list=equipList();
    if(!list.length){ return drawEmpty(); }
    const nCats=EQUIP_CATS.filter(function(c){return list.some(function(d){return d.cat===c.cat;});}).length;
    const sub=`${list.length} ${L(list.length===1?'מכשיר':'מכשירים', list.length===1?'device':'devices')} · ${nCats} ${L(nCats===1?'קטגוריה':'קטגוריות', nCats===1?'category':'categories')}`;
    const caps=[[canSV(),L('סו-ויד','Sous-vide'),'🌊',L('הוסף סו-ויד','add a sous-vide')],[canSmoke(),L('עישון','Smoke'),'💨',L('הוסף מעשנה','add a smoker')],[canGrill(),L('גריל','Grill'),'🔥',L('הוסף גריל','add a grill')]];
    const okN=caps.filter(function(x){return x[0];}).length;
    const nProbe=equipByCat('probe').length;
    const foot=probeChannels()?`<p class="eq-caps-foot">🎯 <b>${nProbe} ${L(nProbe===1?'פרוב':'פרובים', nProbe===1?'probe':'probes')} · ${probeChannels()} ${L('ערוצים','channels')}</b> ${L('למעקב טמפ׳ פנימית','tracked for internal-temp targets')}</p>`:'';
    const capsHtml=`<div class="eq-caps"><div class="eq-caps-x"><h4>${L('מה אפשר לבשל','What you can cook')}</h4><span class="eq-caps-n">${okN}/${caps.length} ${L('פעילים','unlocked')}</span></div><div class="eq-gcaps">${caps.map(function(x){return `<span class="eq-gcap ${x[0]?'ok':'no'}"><span class="em">${x[2]}</span> ${x[1]}${x[0]?'':' · '+x[3]}</span>`;}).join('')}</div>${foot}</div>`;
    const secs=EQUIP_CATS.map(function(c){ const ds=list.filter(function(d){return d.cat===c.cat;}); if(!ds.length) return '';
      if(c.cat==='other'){   // accessories → compact chips + an "edit accessories" (checklist) button, not device cards
        const chips=ds.map(function(d){ const it=otherConst(d.type,d.name); if(!it) return `<span class="eq-chip">🧰 ${esc(d.name||typeLabel(d.type)||d.type)}</span>`; const v=otherPropVal(it,d); return `<span class="eq-chip">${it.em} ${esc(L(it.he,it.en)+(v?' · '+propOptLabel(it.prop,v):''))}</span>`; }).join('');
        return `<section class="eq-sec"><h4><span class="em">${c.icon}</span> ${L(c.he,c.en)} <span class="sc">· ${ds.length}</span></h4><div class="eq-othchips">${chips}</div><button class="eq-add-tile" data-eqaddcat="other"><span class="pl">＋</span> ${L('ערוך אביזרים','Edit accessories')}</button></section>`;
      }
      const cards=ds.map(function(d){ return `<article class="eq-card eq-spine eq-dev" style="--eqacc:${c.acc};--eqacc-l:${c.accL}"><div class="eq-tile">${equipTypeIcon(d.cat,d.type)}</div><div class="eq-dev-main"><div class="eq-dev-top"><span class="eq-dev-name">${esc(d.name||typeLabel(d.type)||'')}</span>${d.specSource==='ai'?`<span class="eq-dev-ai">✨ AI</span>`:''}</div><p class="eq-dev-sub">${esc(typeLabel(d.type)||'')}</p>${chipsFor(d)?`<div class="eq-dev-chips">${chipsFor(d)}</div>`:''}</div><div class="eq-dev-acts"><button class="eq-iconbtn" data-eqedit="${d.id}" aria-label="${L('ערוך','Edit')}">✎</button><button class="eq-iconbtn" data-eqrm="${d.id}" aria-label="${L('הסר','Remove')}">✕</button></div></article>`; }).join('');
      return `<section class="eq-sec"><h4><span class="em">${c.icon}</span> ${L(c.he,c.en)} <span class="sc">· ${ds.length}</span></h4>${cards}<button class="eq-add-tile" data-eqaddcat="${c.cat}"><span class="pl">＋</span> ${L('הוסף עוד','Add another')} ${L(c.he,c.en)}</button></section>`;
    }).join('');
    showPanel(headHtml(true,sub)+`<div class="panel-body eq-wrap">${capsHtml}${secs}</div>`);
    const pnl=$("#panel");
    const an=$("#eqAddNew"); if(an) an.addEventListener('click', function(){ editId=null; drawPicker(); });   // header Add → pick a category first (not a hard-coded smoker form)
    pnl.querySelectorAll('[data-eqaddcat]').forEach(function(b){ b.addEventListener('click', function(){ editId=null; drawForm(b.dataset.eqaddcat); }); });
    pnl.querySelectorAll('[data-eqedit]').forEach(function(b){ b.addEventListener('click', function(){ const d=equipList().find(function(x){return x.id===b.dataset.eqedit;}); if(!d) return; editId=d.id; drawForm(d.cat, d); }); });
    pnl.querySelectorAll('[data-eqrm]').forEach(function(b){ b.addEventListener('click', function(){ equipSave(equipList().filter(function(d){return d.id!==b.dataset.eqrm;})); if(typeof cRefreshHome==='function') cRefreshHome(); drawList(); }); });
  };

  // "Other" = an accessories CHECKLIST: presets (specific icon, some with a small property) + any custom
  // items you defined — all editable (check / pick a property value / add your own / remove).
  const drawOtherChecklist=function(){
    const rowHtml=function(attr, val, em, label, on){ return `<button type="button" class="eq-oth-row${on?' on':''}" ${attr}="${esc(val)}" role="checkbox" aria-checked="${on?'true':'false'}"><span class="eq-oth-box">${on?'✓':''}</span><span class="eq-oth-em">${em}</span><span class="eq-oth-lbl">${esc(label)}</span></button>`; };
    const propHtml=function(it, dev){ const cur=otherPropVal(it, dev);
      const chips=it.prop.opts.map(function(o){ const val=(typeof o==='string')?o:o.en, lbl=(typeof o==='string')?o:L(o.he,o.en); return `<button type="button" class="eq-oth-propchip${val===cur?' on':''}" data-eqprop="${esc(it.key)}|${esc(val)}">${esc(lbl)}</button>`; }).join('');
      return `<div class="eq-oth-prop"><span class="eq-oth-prop-l">${L(it.prop.he,it.prop.en)}:</span>${chips}</div>`;
    };
    const buildRows=function(){ const devs=equipByCat('other'); let html='';
      EQUIP_OTHER_ITEMS.forEach(function(it){ const dev=devs.find(function(d){ return (otherConst(d.type,d.name)||{}).key===it.key; }); const on=!!dev;
        html+=rowHtml('data-eqothkey', it.key, it.em, L(it.he,it.en), on);
        if(it.prop && on) html+=propHtml(it, dev);   // e.g. scale → resolution chips (only when checked)
      });
      devs.filter(function(d){ return !otherConst(d.type,d.name); }).forEach(function(d){ html+=rowHtml('data-eqothdev', d.id, '🧰', d.name||typeLabel(d.type)||d.type, true); });   // custom items you defined
      return html;
    };
    showPanel(`<div class="panel-body eq-wrap eq-form"><div class="eq-sheet"><div class="eq-sheet-grab"></div>
      <div class="eq-sheet-head"><span class="eq-tile" style="--eqacc-l:${cm('other').accL}">${cm('other').icon}</span><h3>${L('אביזרים','Accessories')}</h3><button class="eq-sheet-x" id="eqOthBack" type="button" aria-label="${L('חזרה','Back')}">✕</button></div>
      <div class="eq-sheet-body"><p class="eq-oth-hint">${L('סמן מה יש לך — או הוסף אביזר משלך.','Check what you have — or add your own.')}</p>
        <div class="eq-othlist" id="eqOthlist"></div>
        <div class="eq-oth-add"><input id="eqOthNew" class="eq-oth-newin" placeholder="${L('הוסף אביזר משלך…','Add your own accessory…')}" autocomplete="off"><button type="button" id="eqOthAdd" class="eq-multi-addbtn" aria-label="${L('הוסף','Add')}">＋</button></div>
      </div>
    </div></div>`);
    const pnl=$("#panel");
    const addDev=function(type,name){ const id=equipId(); const list=equipList(); list.push({id:id,cat:'other',type:type,name:name,brand:'',model:'',fuel:'',cap:{},specSource:'manual',notes:''}); equipSave(list); equipSetConfigured(); if(typeof cRefreshHome==='function') cRefreshHome(); return id; };
    const removeDev=function(pred){ equipSave(equipList().filter(function(d){ return !(d.cat==='other' && pred(d)); })); equipSetConfigured(); if(typeof cRefreshHome==='function') cRefreshHome(); };
    const repaint=function(){ const body=$("#panel .eq-sheet-body"); const sc=body?body.scrollTop:0; const el=$("#eqOthlist"); if(el){ el.innerHTML=buildRows(); wireRows(); } if(body) body.scrollTop=sc; };
    const wireRows=function(){
      pnl.querySelectorAll('#eqOthlist .eq-oth-row').forEach(function(b){ b.addEventListener('click', function(){ const key=b.dataset.eqothkey, did=b.dataset.eqothdev;
        if(key){ const it=EQUIP_OTHER_ITEMS.find(function(x){return x.key===key;}); if(!it) return;
          if(b.classList.contains('on')) removeDev(function(d){ return (otherConst(d.type,d.name)||{}).key===key; }); else addDev(it.key, L(it.he,it.en));
        } else if(did){ removeDev(function(d){ return d.id===did; }); }
        repaint();
      }); });
      pnl.querySelectorAll('#eqOthlist [data-eqprop]').forEach(function(b){ b.addEventListener('click', function(e){ e.stopPropagation(); const p=b.dataset.eqprop.split('|'); const key=p[0], val=p[1]; const it=EQUIP_OTHER_ITEMS.find(function(x){return x.key===key;}); if(!it||!it.prop) return;
        const list=equipList(); const dev=list.find(function(d){ return d.cat==='other' && (otherConst(d.type,d.name)||{}).key===key; }); if(!dev) return;
        dev.cap=dev.cap||{}; dev.cap[it.prop.key]=(dev.cap[it.prop.key]===val)?'':val;   // pick / toggle off
        equipSave(list); equipSetConfigured(); if(typeof cRefreshHome==='function') cRefreshHome(); repaint();
      }); });
    };
    repaint();
    const addCustom=function(){ const inp=$("#eqOthNew"); if(!inp) return; const v=(inp.value||'').trim(); if(!v) return; inp.value='';
      if(otherConst(v,v) || equipList().some(function(d){ return d.cat==='other' && (d.name===v||d.type===v); })){ inp.focus(); return; }   // already a preset / already have it
      addDev(v, v); repaint(); inp.focus();
    };
    const ab=$("#eqOthAdd"); if(ab) ab.addEventListener('click', addCustom);
    const ni=$("#eqOthNew"); if(ni) ni.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addCustom(); } });
    const bk=$("#eqOthBack"); if(bk) bk.addEventListener('click', function(){ drawList(); });
  };

  const drawForm=function(cat, dev){
    const curCat=cat||(dev&&dev.cat)||'smoker'; const aiOn=equipAiOn();
    if(curCat==='other') return drawOtherChecklist();   // accessories are a checklist, not a device form
    let vmode = dev ? 'edit' : 'manual';   // → 'ai' after a successful web lookup
    const capC=function(k){ return equipCat(k)||{}; };
    // multi-value capacity list (sous-vide bath sizes / stuffer output tube sizes) — several instances, add/remove
    let multiVals = (function(){ const c0=capC(curCat); if(c0.multiCap && dev){ const mk=c0.multiCap.key; if(dev.cap&&Array.isArray(dev.cap[mk])&&dev.cap[mk].length) return dev.cap[mk].slice(); if(mk==='baths'&&dev.cap&&dev.cap.bathL!=null) return [dev.cap.bathL]; } return []; })();
    let aiDetails='';   // extra web-sourced specs (dimensions/weight/material) → saved into notes
    let _aiProps={};    // Task 5: properties (props[]) extracted by the AI lookup, keyed like dev.cap — preferred for display in propVal, never persisted until Save
    const title=function(nc){ return dev?L('ערוך מכשיר','Edit device'):L('הוסף '+cm(nc).he, 'Add a '+(cm(nc).en||'').toLowerCase()); };
    const note=function(s,cls){ const n=$("#eqAiNote"); if(n){ n.textContent=s||''; n.className='eq-ainote'+(cls?' '+cls:''); } };

    showPanel(`<div class="panel-body eq-wrap eq-form"><div class="eq-sheet">
      <div class="eq-sheet-grab"></div>
      <div class="eq-sheet-head"><span class="eq-tile" id="eqSheetTile" style="--eqacc-l:${cm(curCat).accL}">${equipTypeIcon(curCat,(dev&&dev.type)||((cm(curCat).types||[])[0]))}</span><h3 id="eqFormTitle">${title(curCat)}</h3><button class="eq-sheet-x" id="eqBack" type="button" aria-label="${L('חזרה','Back')}">✕</button></div>
      <div class="eq-sheet-body">
        <label class="eq-step-l">${L('קטגוריה','Category')}</label>
        <select id="eqCat" class="eq-inp">${EQUIP_CATS.map(function(x){return `<option value="${x.cat}" ${x.cat===curCat?'selected':''}>${L(x.he,x.en)}</option>`;}).join('')}</select>
        ${aiOn?`<label class="eq-step-l">${L('אמור לי את הדגם — אמשוך את המפרט','Tell me the model — I’ll pull the specs')}</label>
        <input id="eqLookupQ" class="eq-inp" list="eqBrandList" placeholder="${L('לדוגמה: Traeger Pro 575 · או קישור למוצר','e.g. Traeger Pro 575 · or a product link')}" value="${dev?esc(dev.name||''):''}">
        <div class="eq-lookup-acts"><button id="eqLookup" class="eq-look primary" type="button"><span class="em">🔎</span> ${L('מצא מפרט','Look up specs')}</button><button id="eqModels" class="eq-look" type="button"><span class="em">📋</span> ${L('עיין בדגמים','Browse models')}</button></div>`:''}
        <datalist id="eqBrandList">${brandOpts(curCat)}</datalist>
        <div id="eqAiNote" class="eq-ainote"></div>
        <div class="eq-card eq-verify" id="eqVerify"></div>
        <div class="eq-or" id="eqCatOr" hidden>${L('או בחר מהקטלוג','or pick from the catalogue')}</div>
        <div id="eqModelsWrap"></div>
        ${aiOn?`<div class="eq-miniform"><h4>${L('אין חיבור או ציוד מותאם?','No connection or custom rig?')}</h4><p>${L('פשוט מלא את השדות למעלה ביד.','Just fill the fields above by hand.')}</p></div>`:''}
      </div>
    </div></div>`);

    const doSave=function(){
      const nc=($("#eqCat")||{}).value; const cc=capC(nc);
      let type=($("#eqType")||{}).value; const nameEl=$("#eqName"); let nm=((nameEl&&nameEl.value)||'').trim();
      if(type==='__custom__') type=nm||L('מותאם','Custom');
      if(!nm) nm=t(type)||type;
      // Validate every non-empty user-typed value BEFORE saving. A value that fails validation must never be
      // silently dropped — the old code did `else delete d.cap[key]` and then closed the form, so the user's
      // input vanished with no message (and the capacity data the occupancy layer relies on was corrupted).
      // On any invalid value: surface it, mark the field, and keep the form open with the input intact.
      // Only the numeric PROPERTY fields are text inputs (they accept unit suffixes like '500F'), so only they
      // can receive an unparseable value. The capacity field (#eqCapKey) is type="number" — the browser itself
      // rejects non-numeric text, and empty→class-default is correct — so it needs no guard here.
      const _invalid=[];
      document.querySelectorAll('#panel .eq-invalid').forEach(function(el){ el.classList.remove('eq-invalid'); });
      (cc.props||[]).forEach(function(p){ if(p.kind!=='num') return;
        const pe=$("#eqProp-"+p.key); if(!pe) return; const pv=(pe.value==null?'':String(pe.value)).trim();
        if(pv!=='' && !propParse(p, pv)){ _invalid.push(L(p.he,p.en)); pe.classList.add('eq-invalid'); } });
      if(_invalid.length){
        if(typeof toast==='function') toast(L('לא נשמר — ערכים לא תקינים: ','Not saved — invalid values: ')+_invalid.join(', '));
        return;   // keep the form open, values intact, so the user can correct them
      }
      const list2=equipList(); let d;
      if(editId){ d=list2.find(function(x){return x.id===editId;}); if(!d){ editId=null; return drawList(); } }
      else { d={id:equipId(),cat:nc,type:type,name:nm,brand:'',model:'',fuel:'',cap:{},specSource:'manual',notes:''}; list2.push(d); }
      d.cat=nc; d.type=type; d.name=nm; d.cap=d.cap||{};
      if(cc.capKey){ const v=parseFloat(($("#eqCapKey")||{}).value); if(!isNaN(v)) d.cap[cc.capKey]=v; else delete d.cap[cc.capKey]; }
      if(cc.multiCap){ const mi=$("#eqMultiIn"); if(mi&&mi.value){ const pv=parseFloat((mi.value||'').replace(/[^\d.]/g,'')); if(!isNaN(pv)&&pv>0&&pv<100000&&multiVals.indexOf(pv)<0) multiVals.push(pv); }   // flush a typed-but-not-yet-added size
        if(multiVals.length){ multiVals.sort(function(a,b){return a-b;}); d.cap[cc.multiCap.key]=multiVals.slice(); } else delete d.cap[cc.multiCap.key]; if(cc.multiCap.key==='baths') delete d.cap.bathL; }   // sousvide bath sizes / stuffer output-tube sizes
      const fEl=$("#eqvFuel"); if(fEl) d.fuel=fEl.value||''; else if(['smoker','grill','oven'].indexOf(nc)<0) d.fuel='';
      const aEl=$("#eqvArea"); if(aEl){ const av=(aEl.value||'').trim(); if(av) d.cap.area=av; else delete d.cap.area; }
      // Equipment properties: empty -> delete the key so the class default applies (never store 0/''). Numeric
      // fields route through propParse so a typed unit suffix ('500F') converts, and a mismatched unit
      // ('300mm' into a temperature field) is REJECTED rather than silently stored as a bogus value.
      (cc.props||[]).forEach(function(p){
        const el=$("#eqProp-"+p.key); if(!el) return;
        const raw=(el.value==null?'':String(el.value)).trim();
        if(raw===''){ delete d.cap[p.key]; return; }                 // empty -> fall back to the class default
        if(p.kind==='bool'){ d.cap[p.key]=(raw==='true'); return; }
        if(p.kind==='choice'){ d.cap[p.key]=raw; return; }
        const r=propParse(p, raw); if(r) d.cap[p.key]=r.v; else delete d.cap[p.key];
      });
      if(vmode==='ai'){ d.specSource='ai'; if(aiDetails) d.notes=aiDetails; }
      equipSave(list2); equipSetConfigured(); const bb=$("#gearBanner"); if(bb) bb.remove(); if(typeof cRefreshHome==='function') cRefreshHome();
      editId=null; drawList();
    };
    const wireVerify=function(){
      const s=$("#eqSave"); if(s) s.addEventListener('click', doSave);
      const rd=$("#eqRedo"); if(rd) rd.addEventListener('click', function(){ vmode='manual'; _aiProps={}; const nm=($("#eqName")||{}).value||''; note(''); paintVerify({name:nm}); });
      const cx=$("#eqCancel"); if(cx) cx.addEventListener('click', function(){ editId=null; drawList(); });
    };
    // ── multi-value capacity editor: each size is its own removable chip; input + ＋ to add another ──
    const multiHtml=function(){ const cc=capC(($("#eqCat")||{}).value||curCat); if(!cc.multiCap) return '';
      const u=L(cc.multiCap.uHe,cc.multiCap.uEn); const em=cc.multiCap.em||'';
      const chips=multiVals.map(function(v,i){ return `<span class="eq-multi-chip">${em?`<span class="eq-multi-em">${em}</span>`:''}<b class="eq-multi-v">${esc(v)} ${esc(u)}</b><button type="button" class="eq-multi-x" data-eqmultirm="${i}" aria-label="${L('הסר','Remove')}">✕</button></span>`; }).join('');
      return chips+`<span class="eq-multi-add"><input id="eqMultiIn" class="eq-multi-in" inputmode="decimal" placeholder="${L('גודל','size')} ${esc(u)}"><button type="button" id="eqMultiAdd" class="eq-multi-addbtn" aria-label="${L('הוסף','Add')}">＋</button></span>`;
    };
    const addMulti=function(){ const inp=$("#eqMultiIn"); if(!inp) return; const v=parseFloat((inp.value||'').replace(/[^\d.]/g,'')); if(!isNaN(v)&&v>0&&v<100000 && multiVals.indexOf(v)<0){ multiVals.push(v); multiVals.sort(function(a,b){return a-b;}); } inp.value=''; repaintMulti(); };
    const repaintMulti=function(){ const w=$("#eqMultiWrap"); if(w){ w.innerHTML=multiHtml(); wireMulti(); const inp=$("#eqMultiIn"); if(inp) inp.focus(); } };
    const wireMulti=function(){ const a=$("#eqMultiAdd"); if(a) a.addEventListener('click', addMulti);
      const inp=$("#eqMultiIn"); if(inp) inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addMulti(); } });
      const w=$("#eqMultiWrap"); if(w) w.querySelectorAll('[data-eqmultirm]').forEach(function(b){ b.addEventListener('click', function(){ const i=parseInt(b.dataset.eqmultirm,10); if(!isNaN(i)){ multiVals.splice(i,1); repaintMulti(); } }); });
    };
    const paintVerify=function(data){
      const nc=($("#eqCat")||{}).value||curCat; const cc=capC(nc);
      const showFuel=['smoker','grill','oven'].indexOf(nc)>=0;
      const ai=(vmode==='ai'); const fc=ai?' eq-aifilled':''; const sp=ai?' <span class="sp">✨</span>':'';
      const d=data||{};
      const nameField=`<div class="eq-vfield"><label>${L('שם','Name')}${sp}</label><input id="eqName" class="eq-vin${fc}" placeholder="${L('שם המכשיר','Device name')}" value="${d.name!=null?esc(d.name):''}"></div>`;
      const typeField=`<div class="eq-vfield"><label>${L('תת-סוג','Sub-type')}${sp}</label><select id="eqType" class="eq-vin${fc}">${typeOpts(nc, d.type)}</select></div>`;
      const capField=cc.capKey?`<div class="eq-vfield"><label>${L(cc.capHe,cc.capEn)}${sp}</label><input type="number" min="0" inputmode="numeric" id="eqCapKey" class="eq-vin${fc}" value="${(d.cap!=null&&d.cap!=='')?esc(d.cap):''}"></div>`:'';
      const multiField=cc.multiCap?`<div class="eq-vfield"><label>${L(cc.multiCap.he,cc.multiCap.en)}${sp}</label><div class="eq-multi${fc}" id="eqMultiWrap">${multiHtml()}</div></div>`:'';
      const grid=capField?`<div class="eq-vrow">${typeField}${capField}</div>`:typeField;   // sub-type full-width when there's no single-capacity field
      const extraMulti=cc.multiCap?multiField:'';   // multi-value editor (bath sizes / output sizes) always full-width below
      const fuelRow=showFuel?`<div class="eq-vrow"><div class="eq-vfield"><label>${L('דלק','Fuel')}${sp}</label><select id="eqvFuel" class="eq-vin${fc}">${fuelOpts(d.fuel||'')}</select></div><div class="eq-vfield"><label>${L('שטח בישול','Cooking area')}${sp}</label><input id="eqvArea" class="eq-vin${fc}" placeholder="${L('לדוגמה 3700 cm²','e.g. 3700 cm²')}" value="${d.area?esc(d.area):''}"></div></div>`:'';
      // Equipment properties. Core render inline; pro collapse into one <details>. Each label carries its
      // own icon, tinted by the category accent already on the sheet. The class default is shown as the
      // PLACEHOLDER so an empty field reads as "using the default", never as missing data.
      // Value resolution lives in ONE small helper (propVal) so Task 5 (AI-extracted values) can extend it
      // in one place, without touching propField's rendering logic.
      const propVal=function(p){ if(_aiProps && _aiProps[p.key]!==undefined) return _aiProps[p.key]; return (dev&&dev.cap&&dev.cap[p.key]!=null&&dev.cap[p.key]!=='')?dev.cap[p.key]:''; };
      const propField=function(p){
        const dv=propVal(p);
        const dflt=propDef(nc, p.key, (d.type||((cm(nc).types||[])[0])));
        const lbl=`<label data-propfor="${esc(p.key)}"><span class="eq-pem">${p.em}</span> ${esc(L(p.he,p.en))}${p.unit?` <small>(${esc(p.unit)})</small>`:''}</label>`;
        if(p.kind==='bool'){
          const on=(dv===''?(dflt===true):(dv===true||dv==='true'));
          return `<div class="eq-vfield">${lbl}<select id="eqProp-${esc(p.key)}" class="eq-vin"><option value="true" ${on?'selected':''}>${L('כן','Yes')}</option><option value="false" ${!on?'selected':''}>${L('לא','No')}</option></select></div>`;
        }
        if(p.kind==='choice'){
          const cur=(dv===''?dflt:dv);
          return `<div class="eq-vfield">${lbl}<select id="eqProp-${esc(p.key)}" class="eq-vin">${(p.opts||[]).map(function(o){return `<option value="${esc(o.v)}" ${o.v===cur?'selected':''}>${esc(L(o.he,o.en))}</option>`;}).join('')}</select></div>`;
        }
        // type="text" (not "number") — a native number input CANNOT hold a typed unit suffix like "500F" at
        // all (the browser strips non-numeric characters as you type), which would silently defeat propParse's
        // unit-suffix handling on save. inputmode="decimal" still hints a numeric mobile keyboard for the
        // common bare-number case; propParse validates/converts whatever text ultimately lands here.
        return `<div class="eq-vfield">${lbl}<input id="eqProp-${esc(p.key)}" class="eq-vin" type="text" inputmode="decimal" value="${esc(dv)}" placeholder="${dflt!==undefined?esc(String(dflt)):''}"></div>`;
      };
      const _props=(cm(nc).props||[]);
      const coreProps=_props.filter(function(p){return p.tier==='core';}).map(propField).join('');
      const proProps=_props.filter(function(p){return p.tier==='pro';}).map(propField).join('');
      const propRows=(coreProps?`<div class="eq-vrow">${coreProps}</div>`:'')
        +(proProps?`<details class="eq-adv vc-gem"><summary>⚙️ ${L('מתקדם','Advanced')}</summary><div class="eq-vrow">${proProps}</div></details>`:'');
      const heading=ai?`<div class="eq-verify-h"><span>✨</span> ${L('הנה מה שמצאתי — ','Here’s what I found — ')}<b>${L('אמת ושמור','verify & save')}</b></div>`:`<div class="eq-verify-h">${dev?L('פרטי המכשיר','Device details'):L('פרטים','Details')}</div>`;
      const src=ai?`<p class="eq-v-src">${L('<b>✨ מולא אוטומטית</b> ממקורות רשת. גע בכל שדה כדי לשנות — <b>עדיין לא נשמר.</b>','<b>✨ Auto-filled</b> from web sources. Tap any field to change it — <b>nothing is saved yet.</b>')}</p>`:'';
      const saveLbl=dev?L('שמור','Save'):(ai?L('נראה טוב — שמור','Looks right — save'):L('הוסף','Add'));
      const acts=`<div class="eq-v-acts"><button id="eqSave" class="eq-con-go" type="button">${saveLbl}</button>${ai?`<button id="eqRedo" class="eq-ghost" type="button">↺ ${L('אפס','Redo')}</button>`:`<button id="eqCancel" class="eq-ghost" type="button">${L('בטל','Cancel')}</button>`}</div>`;
      const v=$("#eqVerify"); if(v){ v.innerHTML=heading+nameField+grid+extraMulti+fuelRow+propRows+src+acts; wireVerify(); if(cc.multiCap) wireMulti(); }
      const st=$("#eqSheetTile"); if(st) st.textContent=equipTypeIcon(nc, d.type||((cm(nc).types||[])[0]));
    };

    const ecc=$("#eqCat"); if(ecc) ecc.addEventListener('change', function(){ const nc=ecc.value;
      if(nc==='other') return drawOtherChecklist();   // switching to accessories → the checklist
      const bl=$("#eqBrandList"); if(bl) bl.innerHTML=brandOpts(nc);
      const tt=$("#eqFormTitle"); if(tt&&!dev) tt.textContent=title(nc);
      const st=$("#eqSheetTile"); if(st) st.style.setProperty('--eqacc-l', cm(nc).accL);
      if(vmode==='ai') vmode='manual';
      multiVals=[];   // multi sizes are category-specific — reset on category change
      _aiProps={};    // ditto for AI-extracted properties — a smoker's maxC must not leak into a vacuum form
      paintVerify({name:($("#eqName")||{}).value||''});
    });
    const lookup=$("#eqLookup"); if(lookup) lookup.addEventListener('click', function(){
      const q=((($("#eqLookupQ")||{}).value)||(($("#eqName")||{}).value)||'').trim(); const nc=($("#eqCat")||{}).value;
      if(!q){ note(L('הקלד שם/דגם קודם','Type a name/model first')); return; }
      note(L('מחפש באינטרנט…','Searching the web…'));
      aiLookupDevice(q, nc).then(function(r){ vmode='ai'; const cc=capC(nc); _aiProps=r.props||{};
        if(cc.multiCap){ let add=[];   // sous-vide bath litres OR stuffer output-tube sizes → chips
          if(cc.multiCap.key==='baths' && r.cap && r.cap.bathL!=null) add=[r.cap.bathL];
          else if(cc.multiCap.key==='nozzles' && r.nozzles && r.nozzles.length) add=r.nozzles;
          add.forEach(function(v){ if(multiVals.indexOf(v)<0) multiVals.push(v); }); multiVals.sort(function(a,b){return a-b;});
        }
        aiDetails=r.details||'';
        const nm=(r.name||'').trim() || (/^https?:\/\//i.test(q)?'':q);   // a pasted URL must NEVER become the device name
        paintVerify({ name:nm, type:r.subtype||'', cap:(cc.capKey&&r.cap&&r.cap[cc.capKey]!=null)?r.cap[cc.capKey]:'', fuel:r.fuel||'', area:r.area||'' });
        note('✨ '+(r.note||L('נמצא — אמת ושמור','Found — verify & save')), 'ok');
      }).catch(function(e){ const m=String(e&&e.message||e); note(m.indexOf('no-key')>=0?L('צריך מפתח AI','Needs an AI key'):L('החיפוש נכשל — מלא ידנית','Lookup failed — fill by hand')); });
    });
    const models=$("#eqModels"); if(models) models.addEventListener('click', function(){
      const brand=(($("#eqLookupQ")||{}).value||'').trim(); const nc=($("#eqCat")||{}).value;
      if(!brand){ note(L('הקלד מותג קודם','Type a brand first')); return; }
      note(L('מחפש דגמים…','Finding models…'));
      aiBrandModels(brand, nc).then(function(ms){ const w=$("#eqModelsWrap"); const orr=$("#eqCatOr"); const cc=capC(nc);
        if(orr) orr.hidden=!ms.length;
        if(w){ w.innerHTML=ms.length?`<div class="eq-modellist">${ms.map(function(m){return `<button class="eq-card eq-model" data-eqmodel="${esc(m.name)}"><span class="eq-tile" style="--eqacc-l:${cc.accL||'#fff2e4'}">${cc.icon||'🧰'}</span><span class="eq-model-main"><b>${esc(m.name)}</b>${m.spec?`<small>${esc(m.spec)}</small>`:''}</span><span class="eq-model-go">＋</span></button>`;}).join('')}</div>`:'';
          w.querySelectorAll('[data-eqmodel]').forEach(function(b){ b.addEventListener('click', function(){ const lq=$("#eqLookupQ"); if(lq) lq.value=b.dataset.eqmodel; w.querySelectorAll('.eq-model').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); if(lookup) lookup.click(); }); }); }
        note(ms.length?(ms.length+L(' דגמים — בחר',' models — pick one')):L('לא נמצאו דגמים','No models found'));
      }).catch(function(e){ const m=String(e&&e.message||e); note(m.indexOf('no-key')>=0?L('צריך מפתח AI','Needs an AI key'):L('החיפוש נכשל','Search failed')); });
    });
    const back=$("#eqBack"); if(back) back.addEventListener('click', function(){ editId=null; drawList(); });
    if(dev){ const cc=capC(dev.cat);
      const capVal=(cc.capKey&&dev.cap&&dev.cap[cc.capKey]!=null)?dev.cap[cc.capKey]:'';
      paintVerify({ name:dev.name||'', type:dev.type||'', cap:capVal, fuel:dev.fuel||'', area:(dev.cap&&dev.cap.area)||'' }); }
    else paintVerify({});
  };

  // header "Add" → choose a category first (chips), then its form
  const drawPicker=function(){
    const chips=EQUIP_CATS.map(function(c){ return `<button class="eq-pickchip" data-eqpick="${c.cat}" style="--eqacc:${c.acc};--eqacc-l:${c.accL}"><span class="eq-pick-ic">${c.icon}</span> ${L(c.he,c.en)}</button>`; }).join('');
    showPanel(`<div class="panel-body eq-wrap eq-form"><div class="eq-sheet"><div class="eq-sheet-grab"></div>
      <div class="eq-sheet-head"><span class="eq-tile" style="--eqacc-l:#fff2e4">🧰</span><h3>${L('מה להוסיף?','What are you adding?')}</h3><button class="eq-sheet-x" id="eqPickBack" type="button" aria-label="${L('חזרה','Back')}">✕</button></div>
      <div class="eq-sheet-body"><div class="eq-pickgrid">${chips}</div></div>
    </div></div>`);
    const pnl=$("#panel");
    pnl.querySelectorAll('[data-eqpick]').forEach(function(b){ b.addEventListener('click', function(){ editId=null; drawForm(b.dataset.eqpick); }); });
    const bk=$("#eqPickBack"); if(bk) bk.addEventListener('click', function(){ drawList(); });
  };

  drawList();
}
function openBackup(){
  showPanel(`${toolTop(L('גיבוי ושחזור','Backup & restore'),L('ייצוא וייבוא כל הנתונים שלך','Export and import all your data'),'💾','#6a8caf')}
   <div class="panel-body">
     <div class="kbox k-ok">${L('כל הנתונים שלך (מועדפים, יומן, מזווה, הערות, דירוגים, רשימות וצ׳קליסטים) נשמרים <b>רק בדפדפן הזה</b>. ייצא קובץ גיבוי כדי לא לאבד אותם בניקוי דפדפן או במעבר מכשיר.','All your data (favorites, journal, pantry, notes, ratings, lists and checklists) is stored <b>only in this browser</b>. Export a backup file so you don’t lose it when clearing the browser or switching devices.')}</div>
     <div class="exactions" style="margin-top:14px">
       <button id="bkExp">⬇ ${L('ייצא קובץ גיבוי','Export backup file')}</button>
       <label class="exbtn-lbl" for="bkImp">⬆ ${L('ייבא מקובץ','Import from file')}</label>
       <input type="file" id="bkImp" accept="application/json,.json" hidden>
     </div>
     <p class="section-sub" style="margin-top:12px">${L('שים לב: ייבוא ממזג את הנתונים מהקובץ — מפתחות קיימים יידרסו, ומה שאין בקובץ יישאר. מפתח ה-AI אינו נכלל בגיבוי (אבטחה) — חבר אותו מחדש לאחר שחזור.','Note: import merges the data from the file — existing keys are overwritten, and anything not in the file stays. The AI key isn’t included in the backup (security) — reconnect it after restoring.')}</p>
     <div id="bkStorage" class="bk-storage" style="margin-top:14px"></div>
     <div style="border-top:1px solid var(--line);margin:18px 0 0;padding-top:16px">
       <div class="kbox k-danger">${L('<b>אזור מסוכן</b> · איפוס-על מוחק את <b>כל</b> הנתונים שלך במכשיר הזה: מועדפים, דירוגים, הערות, יומן, מזווה, רשימת קניות, בחירות מידת-עשייה, תפריט ומתזמן. אין ביטול — כדאי לייצא גיבוי קודם.','<b>Danger zone</b> · a full reset erases <b>all</b> your data on this device: favorites, ratings, notes, journal, pantry, shopping list, doneness choices, menu and scheduler. No undo — best to export a backup first.')}</div>
       <button id="bkWipe" class="mreset" style="margin-top:12px">🗑️ ${L('איפוס-על — מחק הכל','Full reset — erase everything')}</button>
     </div>
   </div>`);
  $("#bkExp").addEventListener('click',exportData);
  $("#bkImp").addEventListener('change',e=>{ if(e.target.files[0]) importData(e.target.files[0]); });
  $("#bkWipe").addEventListener('click',wipeAllData);
  // Wave C: show real storage usage + let the user pin persistent storage (so the browser won't evict a live cook)
  (async()=>{ const box=$("#bkStorage"); if(!box) return; const s=await storageInfo();
    if(!s){ box.style.display='none'; return; }
    const used = s.usedKB<1024 ? s.usedKB+' KB' : (s.usedKB/1024).toFixed(1)+' MB';
    box.innerHTML=`<div class="kbox ${s.pct>=80?'k-danger':'k-ok'}"><b>${L('אחסון מקומי','Local storage')}:</b> ${used}${s.quotaMB?` ${L('מתוך','of')} ~${s.quotaMB} MB (${s.pct}%)`:''} · ${s.persisted?L('קבוע ✓ (מוגן מפני מחיקה אוטומטית)','Persistent ✓ (protected from automatic eviction)'):L('רגיל — עלול להימחק תחת לחץ אחסון','Standard — may be evicted under storage pressure')}`+
      (s.persisted?'':` <button class="mchip" id="bkPersist" style="margin-top:8px">🔒 ${L('הפוך לאחסון קבוע','Make storage persistent')}</button>`)+`</div>`;
    const pb=$("#bkPersist"); if(pb) pb.addEventListener('click',async()=>{ await requestPersist(); toast('נשלחה בקשה לאחסון קבוע'); openBackup(); });
  })();
}
function wipeAllData(){
  const btn=$("#bkWipe");
  if(btn && btn.dataset.armed!=='1'){
    btn.dataset.armed='1'; btn.textContent='⚠ לחץ שוב לאישור — פעולה בלתי הפיכה';
    clearTimeout(window._wipeTmo); window._wipeTmo=setTimeout(()=>{ if(btn){btn.dataset.armed='0'; btn.textContent='🗑️ איפוס-על — מחק הכל';} },4000);
    return;
  }
  const snapshot={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); snapshot[k]=localStorage.getItem(k);}
  const keys=Object.keys(snapshot);
  keys.forEach(k=>{ if(k.startsWith('mk-')||k.startsWith('note:')||k.startsWith('rating:')||k.startsWith('shop:')||k.startsWith('done:')) localStorage.removeItem(k); });
  favs=new Set(); cart=new Set(); _ratings=null; activeCats.clear(); activeGroup=null;
  filters={fav:false,kosher:false,method:'',diff:0,time:0};
  const qq=$("#q"); if(qq) qq.value="";
  syncChips(); buildFilterBar(); updateCartBadge(); updateFavBadge(); render();
  closePanel();
  toast('כל הנתונים אופסו',()=>{ Object.entries(snapshot).forEach(([k,v])=>localStorage.setItem(k,v)); favs=new Set(store.get('mk-fav')||[]); cart=new Set(); updateCartBadge(); updateFavBadge(); render(); });
}

/* ---- exit the app (best-effort for installed PWA) ---- */
function exitApp(){
  // the window.open('','_self') step marks the window script-closable on some browsers
  try{ window.open('','_self'); window.close(); }catch(e){}
  try{ window.close(); }catch(e){}
  setTimeout(()=>toast('אנדרואיד חוסם סגירה עצמית — צא עם מחוות/כפתור "חזרה" של המכשיר'),350);
}

/* ---- tools hub ---- */
function toolTop(title,sub,emoji,col){
  return `<div class="panel-top" style="--c:${col||'var(--ember)'}"><button class="x" aria-label="סגור">✕</button><div class="cat" style="color:${col||'var(--ember)'}">${emoji||'🧰'} כלי עזר</div><h2>${title}</h2><div class="en">${sub||''}</div></div>`;
}
function openTools(){
  // UX #10: grouped by noun instead of a flat 15-tool grid
  const groups=[
    ['תכנון ובישול', [
      ['🕒','מתזמן ציר-זמן',openTimeline],['🎉','בונה תפריט לאירוח',openBuilder],
      ['🛒','רשימת קניות',openCart],['⏰','תזכורות',openReminders],['🆘','מצב הצילו',openHelp]
    ]],
    ['ידע ומחשבונים', [
      ['🔥','שאל את האש',openAsk],['🥩','מתרגם נתחים',openCutTrans],['🧮','מחשבון מלח/כמויות',openCalc],
      ['🪵','מדריך עצים',()=>openWoods()],['🧂','מתבלים ורטבים',()=>openSeasonings()]
    ]],
    ['הנתונים שלי', [
      ['🧫','פרויקטים ומזווה',openPantry],['📓','יומן בישולים',openJournal],['💾','גיבוי ושחזור',openBackup]
    ]],
    ['אפליקציה', [
      ['ℹ️','אודות והיכולות',()=>{location.href='product.html';}],['🚪','יציאה מהאפליקציה',exitApp]
    ]]
  ];
  const flat=[]; groups.forEach(g=>g[1].forEach(t=>flat.push(t)));
  const body=groups.map(g=>`<div class="toolgroup"><h4 class="toolgroup-h">${g[0]}</h4><div class="toolgrid">`+
    g[1].map(t=>`<button class="toolbtn" data-tool="${flat.indexOf(t)}"><span>${t[0]}</span>${t[1]}</button>`).join('')+`</div></div>`).join('');
  showPanel(`${toolTop('כלים','כל הכלים של מדריך האש','🧰','#b5603a')}<div class="panel-body"><div class="lang-lbl">🌐 ${t('🌐 שפה')}</div>${langRowHtml()}${body}</div>`);
  wireLangRow($("#panel"));
  $("#panel").querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
    const t=flat[+b.dataset.tool], fn=t[2];
    if(fn===exitApp || t[1]==='אודות והיכולות'){ fn(); return; } // these leave the app
    openFrom(openTools, fn);
  }));
}

// (legacy .navrow handler removed — catalog now uses category tiles)
$("#favBtn").addEventListener("click",()=>{
  filters.fav=!filters.fav; $("#favBtn").classList.toggle("on",filters.fav);
  if(filters.fav){activeCats.clear();setCatNav(null);catView('fav');} else { catView('landing'); }
});
(()=>{ const ab=$("#aboutTop"); if(ab) ab.addEventListener("click",()=>{location.href='product.html';});
        const eb=$("#exitTop"); if(eb) eb.addEventListener("click",exitApp); })();
(()=>{ const cb=$("#clearAll"); if(cb) cb.addEventListener("click",()=>{
  $("#q").value=""; activeCats.clear(); activeGroup=null;
  filters={fav:false, kosher:false, method:'', diff:0, time:0};
  const fb=$("#favBtn"); if(fb) fb.classList.remove("on");
  buildChips(); buildFilterBar(); catView('landing');
  toast("הסינון נוקה");
}); })();

/* ═══ preferences framework — one registry for every user-tunable behavior ═══
   Formalizes the validated-default pattern already used by themeKey()/uiLevel()/fontScale():
   read the stored value, validate it, else fall back to a default that reproduces today's behavior.
   `valid` is a PREDICATE (a lazy closure) so this table may be declared before the constants it
   checks against (THEMES/UI_LEVELS/SHAPE_NAMES are defined further down) — no ordering hazard.
   Entries with he/en/opts render in the "Behavior & automation" hub; the rest keep their own panels. */
const PREFS={
  // existing keys, ADOPTED IN PLACE (no migration, no behavior change)
  theme:      {store:'mk-theme',      def:'cream',   valid:function(v){ return !!THEMES[v]; }},
  fontPair:   {store:'mk-fontpair',   def:'current', valid:function(v){ return !!FONT_PAIRS[v]; }},
  fontScale:  {store:'mk-fontscale',  def:1,         valid:function(v){ return FONT_SCALES.indexOf(v)>=0; }, coerce:Number},
  uiLevel:    {store:'mk-uilevel',    def:'mid',     valid:function(v){ return !!UI_LEVELS[v]; }},
  tlShape:    {store:'mk-tlshape',    def:null,      valid:function(v){ return !!SHAPE_NAMES[v]; }},
  // new — Units is the first live consumer (Task 4)
  units:      {store:'mk-pref-units', def:'metric',  valid:['metric','imperial'], group:'ai',
               he:'יחידות מידה', en:'Units', hintHe:'יחידות בתשובות ה-AI', hintEn:'Units in AI answers',
               opts:[{v:'metric',he:'מטרי (°C, ק״ג)',en:'Metric (°C, kg)'},{v:'imperial',he:'אימפריאלי (°F, lb)',en:'Imperial (°F, lb)'}]},
  // orchestrator knobs — REGISTERED now so Slice 2/3 only add their consumers + the preset selector.
  // They intentionally render NO hub UI yet (no consumer = no dead controls).
  autonomy:   {store:'mk-pref-autonomy', def:'advise', valid:['advise','propose','autopilot']},
  shareTolC:  {store:'mk-pref-sharetol', def:8,        valid:[0,8,15], coerce:Number},
  woodSwap:   {store:'mk-pref-woodswap', def:true,     valid:[true,false]},
  holdEnabled:{store:'mk-pref-hold',     def:true,     valid:[true,false]},
  aiRank:     {store:'mk-pref-airank',   def:true,     valid:[true,false]},
  slotModel:  {store:'mk-pref-slots',    def:'size',   valid:['size','count']},
  holdMaxH:   {store:'mk-pref-holdmax',  def:3,        valid:[1,2,3], coerce:Number},
};
function prefOk(p, v){
  if(typeof p.valid==='function') return !!p.valid(v);
  if(Array.isArray(p.valid)) return p.valid.indexOf(v)>=0;
  return false;
}
function pref(key){
  const p=PREFS[key]; if(!p) return undefined;
  let v=store.get(p.store); if(p.coerce) v=p.coerce(v);
  return prefOk(p,v) ? v : p.def;
}
function setPref(key, val){
  const p=PREFS[key]; if(!p) return false;
  let v=val; if(p.coerce) v=p.coerce(v);
  if(!prefOk(p,v)) return false;
  store.set(p.store, v); return true;
}

/* ── v144: appearance system — color themes · font pairs · text scale ── */
const THEMES={
  cream:{ name:'שמנת חמה', dots:['#fdf6ec','#e76f51','#1a9a7a'],
    t:{'--char':'#fdf6ec','--char2':'#fffaf3','--char3':'#fff2e4','--ember':'#e76f51','--ember2':'#f4a261','--ash':'#6e5340','--bone':'#5a3a28','--smoke':'#7a5f4c','--line':'#f0dcc4','--line2':'#f5e0c8','--fresh':'#1a9a7a','--fresh-l':'#d8f0e8','--over':'#c2553f','--over-l':'#f7e4de','--grate':'#e9d7bf','--cool':'#8fb8c9','--cooll':'#eef4f6','--bg2':'#faecd8','--card':'#fffaf3','--good':'#1a9a7a','--terra-d':'#d2691e','--tint-warm':'#fff6ec','--tint-warm2':'#fdeede','--tint-cool':'#f3f7f9','--tint-info':'#e7ecff','--tint-info-ink':'#3550c7','--tint-warn':'#fbe9e7','--tint-warn-ink':'#7a231b','--ink-strong':'#3a2418','--saved-ink':'#3f7d2f'} },
  charcoal:{ name:'פחם ולהבה', dots:['#17150f','#f59a45','#5bc49f'],
    t:{'--char':'#17150f','--char2':'#221d15','--char3':'#2c2519','--ember':'#f59a45','--ember2':'#f5b45e','--ash':'#b39c7d','--bone':'#f7ecdb','--smoke':'#c4b096','--line':'#3d352a','--line2':'#453c2f','--fresh':'#5bc49f','--fresh-l':'#233129','--over':'#e8795f','--over-l':'#3a201c','--grate':'#3a3327','--cool':'#7fb0c4','--cooll':'#20262b','--bg2':'#17150f','--card':'#221d15','--good':'#5bc49f','--terra-d':'#f2913d','--tint-warm':'#2c2519','--tint-warm2':'#262016','--tint-cool':'#20262b','--tint-info':'#202a44','--tint-info-ink':'#a9bdf5','--tint-warn':'#3a201c','--tint-warn-ink':'#f0b0a5','--ink-strong':'#f7ecdb','--saved-ink':'#8fce76'} },
  walnut:{ name:'עץ ועשן', dots:['#e8dcc6','#9a5528','#3f5b50'],
    t:{'--char':'#e8dcc6','--char2':'#f3ead9','--char3':'#ddcdb0','--ember':'#9a5528','--ember2':'#b56a35','--ash':'#5f4c38','--bone':'#33281c','--smoke':'#6e5a44','--line':'#d0bd9c','--line2':'#c7b18d','--fresh':'#3f5b50','--fresh-l':'#d9e3dd','--over':'#9a4a2a','--over-l':'#f0ddce','--grate':'#d3c0a0','--cool':'#4f7a72','--cooll':'#dde9e3','--bg2':'#e8dcc6','--card':'#f3ead9','--good':'#3f5b50','--terra-d':'#9a4a1e','--tint-warm':'#fff6ec','--tint-warm2':'#fdeede','--tint-cool':'#f3f7f9','--tint-info':'#e7ecff','--tint-info-ink':'#3550c7','--tint-warn':'#fbe9e7','--tint-warn-ink':'#7a231b','--ink-strong':'#3a2418','--saved-ink':'#3f7d2f'} },
  slate:{ name:'נחושת ומלח', dots:['#e7eaee','#a55f2e','#2f6070'],
    t:{'--char':'#e7eaee','--char2':'#f6f8fa','--char3':'#dde2e7','--ember':'#a55f2e','--ember2':'#bc7440','--ash':'#4d5560','--bone':'#232830','--smoke':'#5c6672','--line':'#cdd4db','--line2':'#c1c9d1','--fresh':'#2f6070','--fresh-l':'#d7e5ea','--over':'#a5432a','--over-l':'#f0d8ce','--grate':'#cdd4db','--cool':'#3a6a80','--cooll':'#e2eef2','--bg2':'#e7eaee','--card':'#f6f8fa','--good':'#2f6070','--terra-d':'#a5522e','--tint-warm':'#fff6ec','--tint-warm2':'#fdeede','--tint-cool':'#f3f7f9','--tint-info':'#e7ecff','--tint-info-ink':'#3550c7','--tint-warn':'#fbe9e7','--tint-warn-ink':'#7a231b','--ink-strong':'#3a2418','--saved-ink':'#3f7d2f'} }
};
const FONT_PAIRS={
  current:{ name:'נוכחי', display:"'Suez One'", body:"'Heebo'" },
  editorial:{ name:'מגזין', display:"'Frank Ruhl Libre'", body:"'Assistant'" },
  geometric:{ name:'גאומטרי', display:"'Secular One'", body:"'Rubik'" },
  humanist:{ name:'הומניסטי', display:"'David Libre'", body:"'Alef'" }
};
const FONT_SCALES=[0.9,1,1.15,1.3];
const FONT_SCALE_LABELS={0.9:'קטן',1:'רגיל',1.15:'גדול',1.3:'גדול מאוד'};
const THEME_NAMES_EN={cream:'Warm cream',charcoal:'Charcoal & flame',walnut:'Wood & smoke',slate:'Copper & salt'};
const FONT_NAMES_EN={current:'Current',editorial:'Editorial',geometric:'Geometric',humanist:'Humanist'};
const FONT_SCALE_LABELS_EN={0.9:'Small',1:'Regular',1.15:'Large',1.3:'Very large'};
function themeName(k){ return getLang()==='he'?(THEMES[k]||{}).name:(THEME_NAMES_EN[k]||(THEMES[k]||{}).name); }
function fontName(k){ return getLang()==='he'?(FONT_PAIRS[k]||{}).name:(FONT_NAMES_EN[k]||(FONT_PAIRS[k]||{}).name); }
function scaleLabel(s){ return getLang()==='he'?FONT_SCALE_LABELS[s]:(FONT_SCALE_LABELS_EN[s]||FONT_SCALE_LABELS[s]); }
function themeKey(){ return pref('theme'); }                       // migrates old coal/vintage/gold → cream
function fontPairKey(){ return pref('fontPair'); }
function fontScale(){ return pref('fontScale'); }
const THEME_SCHEME={cream:'light',charcoal:'dark',walnut:'light',slate:'light'};   // native form-control rendering hint
/* ═══ i18n foundation (Wave 5) ═══════════════════════════════════════════════
   Hand-authored keyed CHROME table + a pluggable language provider. This layer
   translates UI chrome only — NO safety numbers, NO machine translation. MT of
   recipe/data prose is gated behind the numeric-invariant safety guard (T1) and
   is deliberately NOT done here. getLang() is host-pluggable so matkonet can drive
   the locale (the platform module seam). */
// ── i18n (Wave 5) — one dictionary file per language (lang/<code>.json, inlined by build.py) ──────
// he is the SOURCE; each dict maps a Hebrew UI string → its translation. Adding a language = drop a
// lang/<code>.json file. getLang() is host-pluggable (matkonet module seam).
const I18N_DICTS = __I18N_DICTS__;
const I18N_LANGS = (function(){ const o={he:'עברית'}; try{ Object.keys(I18N_DICTS).forEach(function(k){ o[k]=((I18N_DICTS[k]||{}).__meta__||{}).name||k; }); }catch(e){} return o; })();
const LANG_FLAG = {he:'🇮🇱', en:'🇬🇧', fr:'🇫🇷', de:'🇩🇪', es:'🇪🇸', ar:'🇸🇦', ru:'🇷🇺', it:'🇮🇹'};
const LANGNAME={en:'English',ar:'Arabic',ru:'Russian',es:'Spanish',fr:'French',de:'German'};   // shared code→language-name map (aiJSON outLang + mtTranslate)
function langFlag(k){ return LANG_FLAG[k]||'🌐'; }
function langRowHtml(){ return `<div class="lang-row" role="group" aria-label="Language">`+Object.keys(I18N_LANGS).map(function(k){ return `<button class="lang-flag ${k===getLang()?'on':''}" data-setlang="${k}" title="${I18N_LANGS[k]}" aria-label="${I18N_LANGS[k]}" aria-pressed="${k===getLang()}"><span class="lf-emoji">${langFlag(k)}</span><span class="lf-name">${I18N_LANGS[k]}</span></button>`; }).join('')+`</div>`; }
function wireLangRow(root){ (root||document).querySelectorAll('[data-setlang]').forEach(function(b){ b.addEventListener('click',function(){ setLang(b.dataset.setlang); }); }); }
function getLang(){
  try{ if(typeof window!=='undefined' && window.__MATKONET_HOST__ && window.__MATKONET_HOST__.lang && I18N_LANGS[window.__MATKONET_HOST__.lang]) return window.__MATKONET_HOST__.lang; }catch(e){}
  const l=(typeof store!=='undefined')?store.get('mk-lang'):null; return I18N_LANGS[l]?l:'he';
}
function setLang(l){ if(!I18N_LANGS[l]) return; store.set('mk-lang',l); applyLang(); }
function getDict(){ return (getLang()==='he')?null:(I18N_DICTS[getLang()]||{}); }
function itemName(m){ if(!m) return ''; if(getLang()!=='he' && m.eng) return m.eng; return m.heb||m.eng||''; }
function t(heb, fallback){ const d=getDict(); if(d && d[heb]!=null) return d[heb]; return (fallback!=null?fallback:heb); }
// Generation-time i18n for dynamically-built recipe prose (steps/notes/tips): the Hebrew string is
// authored inline with its English counterpart; the active language picks which one is emitted. Falls
// back to `en` for any non-Hebrew language (French/German/Spanish get English until localized, and the
// online MT layer can still translate that). Interpolated Hebrew param values should be wrapped in t().
function L(he, en){
  const l=getLang();
  if(l==='he') return he;
  if(l==='en') return en!=null?en:he;               // shipped English: inline arg wins → zero regression
  const d=getDict();                                 // fr/de/es: prefer the per-lang dict, keyed by the Hebrew source
  return (d && d[he]!=null) ? d[he] : (en!=null?en:he);
}
function _reEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function applyI18n(root){ const d=getDict(); if(!d) return; const H=d.__html__||{}; const r=root||document;
  r.querySelectorAll('[data-i18n-html]').forEach(function(el){ const v=H[el.getAttribute('data-i18n-html')]; if(v!=null){ if(el._mkHtml===undefined) el._mkHtml=el.innerHTML; el.innerHTML=v; } });   // remember Hebrew original for restore
}
function tnode(root){ const d=getDict(); if(!d) return; const U=d.__units__||{}, P=d.__pre__||{}; const r=root||document.body; if(!r) return;
  const interp=function(raw){ let nv=raw;
    for(var u in U){ if(u.indexOf('__')===0) continue; nv=nv.replace(new RegExp('(\\d+)\\s*'+_reEsc(u),'g'), '$1 '+U[u]); }
    for(var p in P){ if(p.indexOf('__')===0) continue; nv=nv.replace(new RegExp(_reEsc(p)+'\\s+(?=\\d)','g'), P[p]+' '); }
    return nv; };
  const set=function(node, val){ if(node._mkO===undefined) node._mkO=node.nodeValue; node.nodeValue=val; };   // non-destructive: keep the Hebrew original
  try{ const w=document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null); const list=[]; let n; while((n=w.nextNode())) list.push(n);
    list.forEach(function(node){ if(node.parentElement && node.parentElement.closest && node.parentElement.closest('[data-mt]')) return;   // leave data-mt prose to the guarded MT
      const raw=(node._mkO!==undefined)?node._mkO:node.nodeValue; if(!raw) return; const k=raw.trim(); if(!k) return;   // always translate FROM the Hebrew original
      const v=d[k]; if(v!=null && v!==k){ set(node, raw.replace(k, v)); return; }
      const pm=k.match(/^([^A-Za-z0-9֐-׿]+)(.+)$/); if(pm){ const dv=d[pm[2].trim()]; if(dv!=null){ set(node, raw.replace(k, pm[1]+dv)); return; } }
      if(/[֐-׿]/.test(raw)){ const nv=interp(raw); if(nv!==raw) set(node, nv); }
    });
  }catch(e){}
  try{ r.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function(el){ ['placeholder','aria-label','title'].forEach(function(a){ const raw=(el['_mko_'+a]!==undefined)?el['_mko_'+a]:el.getAttribute(a); if(raw==null) return; const v=d[raw.trim()]; if(v!=null){ if(el['_mko_'+a]===undefined) el['_mko_'+a]=raw; el.setAttribute(a, v); } }); }); }catch(e){}
}
// restore the remembered Hebrew originals (used when switching back to he), since tnode edits are in-place
function restoreHe(root){ const r=root||document.body; if(!r) return;
  try{ const w=document.createTreeWalker(r, NodeFilter.SHOW_TEXT, null); let n; while((n=w.nextNode())){ if(n._mkO!==undefined && n.nodeValue!==n._mkO){ n.nodeValue=n._mkO; } } }catch(e){}
  try{ r.querySelectorAll('[data-i18n-html]').forEach(function(el){ if(el._mkHtml!==undefined) el.innerHTML=el._mkHtml; }); }catch(e){}
  try{ r.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function(el){ ['placeholder','aria-label','title'].forEach(function(a){ if(el['_mko_'+a]!==undefined) el.setAttribute(a, el['_mko_'+a]); }); }); }catch(e){}
  try{ r.querySelectorAll('[data-mt]').forEach(function(el){ if(el._mkMt!==undefined){ el.textContent=el._mkMt; el._mtDone=0; } }); }catch(e){}   // restore data-mt prose
}
// set by an open recipe panel (openCut/openSpec) so applyLang can regenerate its steps in the active
// language — recipe steps are built at generation time (L()), not dict-translated, so a language switch
// must re-run the generator rather than rely on tnode/hydrateMT.
let _mkMethodRepaint=null;
function syncHomeLang(){ try{ const l=getLang(); const f=$("#cHomeLangFlag"); if(f) f.textContent=langFlag(l); const nm=$("#cHomeLangName"); if(nm) nm.textContent=(I18N_LANGS[l]||l); }catch(e){} }
function applyLang(){ const l=getLang(); const d=(l==='he')?null:(I18N_DICTS[l]||{}); const dir=d?((d.__meta__||{}).dir||'ltr'):'rtl';
  try{ const el=document.documentElement; el.lang=l; el.dir=dir; el.classList.toggle('lang-en', l!=='he'); }catch(e){}
  try{ syncHomeLang(); }catch(e){}
  try{ if(typeof cRefreshHome==='function') cRefreshHome(); }catch(e){}   // home greeting + cooking/resume banners are painted by cRefreshHome (L()/getLang-based), not tnode — repaint them so a language switch updates them without a refresh
  try{ if(_mkMethodRepaint && document.getElementById('methodArea')) _mkMethodRepaint(); }catch(e){}   // regenerate open recipe steps in the active language
  if(l==='he'){ try{ restoreHe(); }catch(e){} return; }   // restore originals, then stop (no dict)
  try{ applyI18n(); }catch(e){}
  try{ tnode(document.body); }catch(e){}
  try{ document.querySelectorAll('[data-mt]').forEach(function(el){ el._mtDone=0; }); }catch(e){}   // allow prose to re-translate into the new language
  try{ hydrateMT(document.body); }catch(e){}
}
// ── T1 · numeric-invariant guard for machine translation ─────────────────────
// A machine translation of recipe prose is accepted ONLY if it preserves every number the source
// carries — a dropped or altered cure/temperature/time figure could be dangerous. Any mismatch →
// reject the translation and fall back to the (correct) Hebrew source. This is the gate that must
// pass before any DATA (recipe) translation ships.
function mtNumSig(text){
  // sorted multiset of every number in the text (temps, doses, times, %). Commas→dots so "1,5"=="1.5".
  const nums=(String(text||'').match(/\d+(?:[.,]\d+)?/g)||[]).map(function(n){ return n.replace(',', '.'); });
  return nums.map(Number).sort(function(a,b){return a-b;}).join('|');
}
function mtSafe(src, translated){ return mtNumSig(src)===mtNumSig(translated); }   // every source number must survive, and none may be invented
// return the translation if it passed the numeric guard, else the safe original (with a flag)
function mtGuard(src, translated){ return mtSafe(src, translated) ? {text:translated, ok:true} : {text:src, ok:false}; }
function mtHash(s){ let h=0; s=String(s); for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return h.toString(36); }
// Machine-translate Hebrew recipe prose → target language, GATED by the numeric guard and cached
// (per lang+content). Any translation that changes numbers is rejected in favor of the Hebrew source.
async function mtTranslate(src, lang){
  src=String(src||''); lang=lang||getLang();
  if(!src.trim() || lang==='he') return src;
  const cache=store.get('mk-mtcache')||{}, key=lang+':'+mtHash(src);
  if(cache[key]!=null) return cache[key];
  let out=null;
  try{
    if(typeof window!=='undefined' && window.__mtMock!==undefined && window.__mtMock!==null){
      out=(typeof window.__mtMock==='function'?window.__mtMock(src,lang):window.__mtMock);   // test seam
    } else if(typeof gemFetch==='function' && aiAvail()){
      const LN=LANGNAME[lang]||lang;
      const body={ system_instruction:{parts:[{text:'Translate the following Hebrew cooking text to '+LN+'. Keep ALL numbers, temperatures, times and units EXACTLY as written — never change, add, or drop a number. Reply with ONLY the translation, no notes.'}]},
        contents:[{role:'user',parts:[{text:src}]}], generationConfig:{temperature:0.2,maxOutputTokens:600,thinkingConfig:{thinkingBudget:0}} };
      const r=await gemFetch(GEM_MODEL, body, {timeout:20000}); const j=await r.json();
      const cand=j.candidates&&j.candidates[0]; out=cand&&cand.content&&(cand.content.parts||[]).map(function(p){return p.text||'';}).join('').trim();
    }
  }catch(e){ return src; }   // network/quota failure → safe Hebrew fallback
  if(out==null || out==='') return src;
  const g=mtGuard(src, out);   // T1 gate: reject a translation that mangled a number
  if(g.ok){ cache[key]=g.text; try{ if(Object.keys(cache).length<3000) store.set('mk-mtcache',cache); }catch(e){} }
  return g.text;
}
// Data-MT hydration: async-translate any [data-mt] prose element into the active language behind the
// guard (mirrors the data-i18n chrome walker, but for recipe prose that must go through mtTranslate).
// No-op in Hebrew; without an AI key mtTranslate returns the Hebrew source, so this degrades safely.
function hydrateMT(root){ if(getLang()==='he') return; const d=getDict(); const r=root||document;
  r.querySelectorAll('[data-mt]').forEach(function(el){ if(el._mtDone) return; el._mtDone=1;
    const src=(el._mkMt!==undefined)?el._mkMt:(el.getAttribute('data-mt')||el.textContent||'');
    if(el._mkMt===undefined) el._mkMt=src;   // remember Hebrew original
    if(d && d[src]!=null){ el.textContent=d[src]; return; }                 // pre-translated (offline, no key)
    Promise.resolve().then(function(){ return mtTranslate(src, getLang()); }).then(function(out){ if(out && out!==el.textContent) el.textContent=out; }).catch(function(){});   // else machine-translate (guarded)
  });
}
function applyAppearance(){
  const el=document.documentElement;
  el.classList.remove('light','t-vintage','t-gold');   // clear dead legacy classes permanently
  const th=THEMES[themeKey()].t;
  Object.entries(th).forEach(([k,v])=>el.style.setProperty(k,v));
  el.style.setProperty('color-scheme', THEME_SCHEME[themeKey()]||'light');   // v144: stop the browser from auto-dark-moding inputs against our own theme
  try{ const _mt=document.querySelector('meta[name="theme-color"]'); if(_mt) _mt.setAttribute('content', THEMES[themeKey()].t['--char']); }catch(e){}  // PWA #3: status-bar tint tracks the active theme
  const fp=FONT_PAIRS[fontPairKey()];
  el.style.setProperty('--font-display', fp.display);
  el.style.setProperty('--font-body', fp.body);
  el.style.setProperty('--fscale', String(fontScale()));
}
function setTheme(k){ if(!THEMES[k]) return; store.set('mk-theme',k); applyAppearance(); }
function setFontPair(k){ if(!FONT_PAIRS[k]) return; store.set('mk-fontpair',k); applyAppearance(); }
function setFontScale(n){ if(!FONT_SCALES.includes(n)) return; store.set('mk-fontscale',n); applyAppearance(); }
applyAppearance();
try{ applyLang(); }catch(e){}   // Wave 5: set html lang/dir + translate tagged chrome on boot
try{ equipMigrateFromGear(); }catch(e){}   // Equipment 2.0: seed mk-equipment from any legacy mk-gear
try{ equipNormalizeOther(); }catch(e){}     // backfill 'Other' accessory properties from legacy gear values
/* ── v144: UI levels (beginner/mid/pro) + per-level default work-plan shape ── */
const UI_LEVELS={
  beginner:{ name:'מתחיל', nameEn:'Beginner', desc:'הדרכה צעד-אחר-צעד, פחות מספרים בבת אחת', descEn:'Step-by-step guidance, fewer numbers at once' },
  mid:{ name:'בינוני', nameEn:'Intermediate', desc:'האיזון הרגיל — כל המידע, בלי עומס יתר', descEn:'The usual balance — all the info, without overload' },
  pro:{ name:'מתקדם', nameEn:'Advanced', desc:'הכל גלוי: מספרים מדויקים, כל האפשרויות', descEn:'Everything visible: precise numbers, all options' }
};
function uiLevelName(k){ const o=UI_LEVELS[k]||{}; return getLang()==='he'?o.name:(o.nameEn||o.name); }
function uiLevelDesc(k){ const o=UI_LEVELS[k]||{}; return getLang()==='he'?o.desc:(o.descEn||o.desc); }
const LEVEL_SHAPE={beginner:'5', mid:'1', pro:'3'};   // 5=צירים מתקפלים · 1=קו-זמן אנכי · 3=צעדים אופקי
const SHAPE_NAMES={'5':'צירים מתקפלים','1':'קו-זמן אנכי','3':'צעדים אופקי'};
const SHAPE_NAMES_EN={'5':'Collapsible accordion','1':'Vertical timeline','3':'Horizontal steps'};
function shapeName(k){ return (getLang()==='he'?SHAPE_NAMES:SHAPE_NAMES_EN)[k]||k; }
function uiLevel(){ return pref('uiLevel'); }
function setUiLevel(l){ if(!UI_LEVELS[l]) return; store.set('mk-uilevel',l); }
function tlShapeOverride(){ return pref('tlShape'); }
function tlShape(){ return tlShapeOverride()||LEVEL_SHAPE[uiLevel()]; }
function setTlShape(s){ if(!SHAPE_NAMES[s]) return; store.set('mk-tlshape',s); }
function resetTlShapeToLevel(){ store.set('mk-tlshape',''); }
function openUiLevel(){
  const lvlBtns=Object.entries(UI_LEVELS).map(([k,l])=>`<button class="ap-opt lvl-opt ${k===uiLevel()?'on':''}" data-lvl="${k}">${uiLevelName(k)}</button>`).join('');
  const shapeBtns=Object.entries(SHAPE_NAMES).map(([k,n])=>{
    const isRec=k===LEVEL_SHAPE[uiLevel()];
    return `<button class="ap-opt ${k===tlShape()?'on':''}" data-shp="${k}">${shapeName(k)}${isRec?` <span class="rec-tag">${L('מומלץ','recommended')}</span>`:''}</button>`;
  }).join('');
  showPanel(`${toolTop(L('רמת ממשק','Interface level'),L('קובע כמה פרטים מוצגים ואיך תוכנית-העבודה נראית','Controls how much detail is shown and how the work plan looks'),'🧭','#5a7d8c')}
    <div class="panel-body">
      <div class="ap-lbl">🧭 ${L('הרמה שלי','My level')}</div>
      <div class="ap-opts">${lvlBtns}</div>
      <p class="section-sub" id="uiLevelDesc" style="margin:8px 2px 0">${uiLevelDesc(uiLevel())}</p>
      <div class="ap-lbl">↔ ${L('צורת תוכנית-העבודה','Work-plan shape')}</div>
      <div class="ap-opts">${shapeBtns}</div>
      <p class="section-sub" style="margin:8px 2px 0">${L('משתנה אוטומטית לפי הרמה, וניתן לשנות ידנית כאן בכל עת.','Changes automatically by level, and can be set manually here anytime.')}</p>
    </div>`);
  const pnl=$("#panel");
  pnl.querySelectorAll('[data-lvl]').forEach(b=>b.addEventListener('click',()=>{ setUiLevel(b.dataset.lvl); resetTlShapeToLevel(); openUiLevel(); }));
  pnl.querySelectorAll('[data-shp]').forEach(b=>b.addEventListener('click',()=>{ setTlShape(b.dataset.shp); openUiLevel(); }));
}
// Behavior & automation — the PREFS hub. Renders only prefs that carry he/en (i.e. have a live consumer);
// orchestrator knobs stay registered-but-hidden until their solver lands (Slice 2/3). Reuses .ap-opt styling.
function openPrefGroup(){
  const rows=Object.keys(PREFS).filter(function(k){ return PREFS[k].he && PREFS[k].opts; }).map(function(k){
    const p=PREFS[k], cur=pref(k);
    const opts=p.opts.map(function(o){ return `<button class="ap-opt ${o.v===cur?'on':''}" data-prefkey="${esc(k)}" data-prefval="${esc(String(o.v))}">${esc(L(o.he,o.en))}</button>`; }).join('');
    // EXACTLY the markup openUiLevel() uses: .ap-lbl label + .ap-opts row + .section-sub hint.
    // (.ap-row / .ap-hint do NOT exist in app.css — verified. No new CSS is added.)
    return `<div class="ap-lbl">${esc(L(p.he,p.en))}</div><div class="ap-opts">${opts}</div>`
      +((p.hintHe||p.hintEn)?`<p class="section-sub" style="margin:8px 2px 0">${esc(L(p.hintHe||'',p.hintEn||''))}</p>`:'');
  }).join('');
  showPanel(`${toolTop(L('התנהגות ואוטומציה','Behavior & automation'),L('איך האפליקציה מתנהגת עבורך','How the app behaves for you'),'🎛️','#6a8caf')}
   <div class="panel-body">${rows}</div>`);
  $("#panel").querySelectorAll('[data-prefkey]').forEach(function(b){ b.addEventListener('click', function(){
    const k=b.dataset.prefkey, p=PREFS[k]; if(!p) return;
    const raw=b.dataset.prefval; const opt=p.opts.find(function(o){ return String(o.v)===raw; });
    if(!opt || !setPref(k, opt.v)) return;
    openPrefGroup();   // repaint so the .on marker follows the stored value
  }); });
}
function maybeAskUiLevel(){
  if(store.get('mk-uilevel-asked')) return;
  store.set('mk-uilevel-asked', true);
  showPanel(`${toolTop(L('כמה ניסיון יש לך?','How much experience do you have?'),L('זה קובע כמה פרטים נציג בבת אחת — תמיד אפשר לשנות אח״כ','This sets how much detail we show at once — you can always change it later'),'🧭','#5a7d8c')}
    <div class="panel-body">
      <div class="ap-opts" style="flex-direction:column">
        <button class="ap-opt lvl-opt" data-onb="beginner" style="justify-content:flex-start">🌱 ${L('מתחיל — תדריך אותי צעד-אחר-צעד','Beginner — guide me step by step')}</button>
        <button class="ap-opt lvl-opt on" data-onb="mid" style="justify-content:flex-start">🔥 ${L('בינוני — יש לי קצת ניסיון','Intermediate — I have some experience')}</button>
        <button class="ap-opt lvl-opt" data-onb="pro" style="justify-content:flex-start">🎯 ${L('מתקדם — תראה לי הכל','Advanced — show me everything')}</button>
      </div>
    </div>`);
  $("#panel").querySelectorAll('[data-onb]').forEach(b=>b.addEventListener('click',()=>{ setUiLevel(b.dataset.onb); closePanel(); }));
}
function openAppearance(){
  const swatch=(t)=>`<span class="ap-sw"><i style="background:${t.dots[0]}"></i><i style="background:${t.dots[1]}"></i><i style="background:${t.dots[2]}"></i></span>`;
  const themeBtns=Object.entries(THEMES).map(([k,th])=>`<button class="ap-opt ${k===themeKey()?'on':''}" data-aptheme="${k}">${swatch(th)}${themeName(k)}</button>`).join('');
  const fontBtns=Object.entries(FONT_PAIRS).map(([k,f])=>`<button class="ap-opt ${k===fontPairKey()?'on':''}" data-apfont="${k}" style="font-family:${f.display}">${fontName(k)}</button>`).join('');
  const scaleBtns=FONT_SCALES.map(s=>`<button class="ap-opt ${s===fontScale()?'on':''}" data-apscale="${s}">${scaleLabel(s)}</button>`).join('');
  const langBtns=langRowHtml();   // Wave 5: flag language switcher
  showPanel(`${toolTop(L('מראה','Appearance'),L('גוונים, פונט, שפה — הבחירה שלך נשמרת','Themes, font, language — your choice is saved'),'🎨','#c8542f')}
    <div class="panel-body">
      <div class="ap-lbl">${L('🌐 שפה','🌐 Language')}</div>
      <div class="ap-opts">${langBtns}</div>
      <div class="ap-lbl">${L('🎨 ערכת גוונים','🎨 Color theme')}</div>
      <div class="ap-opts">${themeBtns}</div>
      <div class="ap-lbl">${L('🔤 זיווג פונטים','🔤 Font pairing')}</div>
      <div class="ap-opts">${fontBtns}</div>
      <div class="ap-lbl">${L('🔠 גודל טקסט','🔠 Text size')}</div>
      <div class="ap-opts">${scaleBtns}</div>
      <div class="ap-note">◐ ${L('ניגודיות גבוהה פעילה תמיד — קריאוּת מיטבית ליד האש, בכל ערכת גוון.','High contrast is always on — best readability by the fire, in any theme.')}</div>
      <div class="ap-preview"><div class="ap-pt">${L('חזה בקר מעושן','Smoked beef brisket')}</div><div class="ap-pb">${L('כ-28 שעות · דוגמת תצוגה חיה לבחירה שלך.','~28 hours · a live preview of your choice.')}</div></div>
    </div>`);
  const pnl=$("#panel");
  pnl.querySelectorAll('[data-aptheme]').forEach(b=>b.addEventListener('click',()=>{ setTheme(b.dataset.aptheme); openAppearance(); }));
  pnl.querySelectorAll('[data-apfont]').forEach(b=>b.addEventListener('click',()=>{ setFontPair(b.dataset.apfont); openAppearance(); }));
  pnl.querySelectorAll('[data-apscale]').forEach(b=>b.addEventListener('click',()=>{ setFontScale(+b.dataset.apscale); openAppearance(); }));
  wireLangRow(pnl);   // Wave 5: flag language switcher
}
$("#themeBtn").addEventListener('click',openAppearance);

function fillHero(){
  const el=$("#heroSub"); if(!el) return;
  const nCuts=DATA.cuts.length;
  const nCats=new Set(DATA.cuts.map(c=>c.cat)).size;
  const nMakes=Object.keys(DATA.makes).length;
  const nDone=DATA.cuts.filter(c=>c.doneness).length;
  el.innerHTML=L(`<b>${nCuts} נתחים</b> ב-${nCats} קטגוריות — בשר, עוף, דג, איברים פנימיים, ירקות ופירות — ועוד <b>${nMakes} מתכוני מלאכה</b> (ריפוי, נקניקים, גבינות). לכל פריט: סו-ויד, עישון וגריל, ול-${nDone} נתחים בורר מידת-עשייה מדויק — הכל נגזר מהטבלאות שלך.`,`<b>${nCuts} cuts</b> in ${nCats} categories — meat, poultry, fish, offal, vegetables and fruit — plus <b>${nMakes} craft recipes</b> (curing, sausages, cheeses). For each item: sous-vide, smoking and grill, and a precise doneness picker for ${nDone} cuts — all derived from your tables.`);
}
buildChips();buildMakeChips();buildFilterBar();fillHero();buildGloss();updateCartBadge();updateFavBadge();
(()=>{ const bb=$("#catBack"); if(bb) bb.addEventListener('click',()=>{
  const q=($("#q")&&$("#q").value||'').trim();
  if(!activeGroup && !filters.fav && !q){ if(typeof cNavGo==='function') cNavGo('home'); }
  else { if($("#q")) $("#q").value=''; filters.fav=false; const fb=$("#favBtn"); if(fb)fb.classList.remove('on'); setCatNav(null); buildChips(); catView('landing'); }
}); })();
catView('landing');

function cNavState(){ const m=(typeof menuState==='function')?menuState():{guests:8,keys:[]}; return {current:cCurrent, screens:CSCREENS.slice(), serv:m.guests, keys:(m.keys||[]).slice(), step:cWiz.step, steps:CW_STEPS, projectKeys:CPROJECTS.map(p=>p.key), tileCats:CCAT_TILES.map(t=>t[0])}; }
/* ═══════════ Concept C — navigation router ═══════════ */
const CSCREENS=['home','catalog','wizard','events','projects'];
let cCurrent='home';
function cNavGo(s){
  if(s==='more'){ openMoreSheet(); return; }
  if(!CSCREENS.includes(s)) s='home';
  cCurrent=s;
  document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('on', x.id==='scr-'+s));
  document.querySelectorAll('.cnav button[data-cnav]').forEach(b=>b.classList.toggle('on', b.dataset.cnav===s));
  if(s==='catalog'){ if(typeof catView==='function') catView(); requestAnimationFrame(()=>{const m=document.querySelector('#scr-catalog main'); if(m) m.scrollIntoView({block:'start'});}); }
  if(s==='events') cPaintEvents();
  if(s==='projects') cPaintProjects();
  if(s==='home') cRefreshHome();
  try{ if(typeof syncActiveFab==='function') syncActiveFab(); }catch(e){}
  if(typeof window.scrollTo==='function') window.scrollTo(0,0);
}
// wizard state — now backed by the REAL menu engine
const cWiz={step:0}; try{window.cWiz=cWiz;}catch(e){}
const CW_STEPS=6;
function cwMenu(){ return (typeof menuState==='function')?menuState():{guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0}; }
function cwSave(s){ if(typeof saveMenu==='function') saveMenu(s); else store.set('mk-menu',s); }
function cwPaintProg(){
  const host=$("#cwProg"); if(!host) return;
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  const vis=cook?[0,1,2,3,5]:[0,1,2,3,4,5];
  const cur=vis.indexOf(cWiz.step);
  const LBL=getLang()==='he'?['בסיס','מנות','שיטות','מתבלים','תוספות','סקירה']:['Basics','Dishes','Methods','Seasonings','Sides','Review'];   // UX #14: clickable, labeled steps
  host.innerHTML=vis.map((st,i)=>`<button type="button" class="cwseg ${i<cur?'done':''} ${i===cur?'cur':''}" data-cwseg="${st}" title="${LBL[st]||''}" aria-label="${L('שלב','Step')} ${i+1}: ${LBL[st]||''}"></button>`).join('');
  host.querySelectorAll('[data-cwseg]').forEach(el=>el.addEventListener('click',()=>{ cwGo(+el.dataset.cwseg); }));
}
function cwGo(n){
  n=Math.max(0,Math.min(CW_STEPS-1,n));
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  if(cook&&n===4){ n=(n>cWiz.step)?5:3; }   // cook flow skips the event-extras step
  cWiz.step=n;
  document.querySelectorAll('.cwstep').forEach(s=>s.classList.toggle('on',+s.dataset.cwstep===n));
  cwPaintProg();
  const visSteps=cook?[0,1,2,3,5]:[0,1,2,3,4,5];
  const lbl=$("#cwLbl"); if(lbl) lbl.textContent='שלב '+(visSteps.indexOf(n)+1)+'/'+visSteps.length;
  if(n===0) cwPaintBasics();
  if(n===1) cwPaintPicker();
  if(n===2) cwPaintMethodsFull();
  if(n===3) cwPaintSeasFull();
  if(n===4) cwPaintSidesDrinks();
  if(n===5) cwPaintReview();
  const w=$("#scr-wizard"); if(w&&typeof w.scrollIntoView==='function'){}
  if(typeof window.scrollTo==='function') window.scrollTo(0,0);
}
// ── step 0: basics ──
function cwPaintBasics(){
  const m=cwMenu();
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  const t=$("#cwTitle"); if(t) t.textContent=cook?L('🔥 אשף בישול','🔥 Cook wizard'):L('🎉 אשף האירוע','🎉 Event wizard');
  ['cwEvHead','cwEvSub','cwEvCard'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=cook?'none':''; });
  const v=$("#cServVal"); if(v) v.innerHTML=(m.guests||8)+`<small>${L('סועדים','guests')}</small>`;
  document.querySelectorAll('#cwAppetite .cmethod').forEach(b=>b.classList.toggle('on',b.dataset.app===(m.appetite||'reg')));
  const k=$("#cwKosher"); if(k){ k.dataset.on=m.kosher?'1':'0'; k.classList.toggle('on',!!m.kosher); }
}
// ── step 1: pick from full catalog ──
let cwActiveCat=null, cwQuery='', cwCont='';
function cwAllCats(){
  const s=new Set();
  DATA.cuts.forEach(c=>s.add(c.cat)); Object.values(DATA.makes).forEach(x=>s.add(x.cat)); DATA.specials.forEach(x=>s.add(x.cat));
  return [...s];
}
function cwAllItems(){
  const out=[];
  DATA.cuts.forEach(c=>out.push({key:'cut-'+c.n, heb:c.heb, eng:c.eng||'', cat:c.cat}));
  Object.keys(DATA.makes).forEach(id=>{const x=DATA.makes[id];out.push({key:'make-'+id, heb:x.heb, eng:x.eng||'', cat:x.cat});});
  DATA.specials.forEach(x=>out.push({key:'spec-'+x.n, heb:x.heb, eng:x.eng||'', cat:x.cat}));
  return out;
}
function cwPaintPicker(){
  const chips=$("#cwCatChips");
  if(chips){
    const cats=cwAllCats();
    chips.innerHTML=`<span class="chip ${!cwActiveCat?'on':''}" data-cwcat="">${L('הכל','All')}</span>`+cats.map(c=>`<span class="chip ${cwActiveCat===c?'on':''}" data-cwcat="${c}">${(typeof catEmoji==='function'?catEmoji(c):'')} ${t(c)}</span>`).join('');
    chips.querySelectorAll('[data-cwcat]').forEach(el=>el.addEventListener('click',()=>{ cwActiveCat=el.dataset.cwcat||null; cwCont=''; cwPaintPicker(); }));
    // continent sub-filter — shows when the active category has origins (sausages etc.)
    const catItems=cwAllItems().filter(i=>!cwActiveCat||i.cat===cwActiveCat);
    const conts=[...new Set(catItems.map(i=>(typeof itemContinent==='function')?itemContinent(i):'').filter(Boolean))];
    const crow=$("#cwContChips");
    if(crow){ if(conts.length>1){ crow.style.display=''; crow.innerHTML=[['',L('🌍 כל היבשות','🌍 All continents')],...conts.map(c=>[c,t(c)])].map(([v,l])=>`<span class="chip ${cwCont===v?'on':''}" data-cwcont="${v}">${l}</span>`).join('');
      crow.querySelectorAll('[data-cwcont]').forEach(el=>el.addEventListener('click',()=>{ cwCont=el.dataset.cwcont; cwPaintPicker(); })); } else { crow.style.display='none'; crow.innerHTML=''; } }
  }
  const sb=$("#cwSearch"); if(sb&&!sb._wired){ sb._wired=1; sb.addEventListener('input',()=>{ cwQuery=sb.value.trim().toLowerCase(); cwPaintPickList(); }); }
  cwPaintPickList();
}
function cwPaintPickList(){
  const host=$("#cwPickList"); if(!host) return;
  const m=cwMenu(); const sel=new Set(m.keys||[]);
  let items=cwAllItems();
  if(cwActiveCat) items=items.filter(i=>i.cat===cwActiveCat);
  if(cwCont) items=items.filter(i=>((typeof itemContinent==='function')?itemContinent(i):'')===cwCont);
  if(cwQuery) items=items.filter(i=>(i.heb+' '+i.eng+' '+i.cat).toLowerCase().includes(cwQuery));
  if(m.kosher) items=items.filter(i=>(typeof isKosherOk!=='function')||isKosherOk(i.key));   // pork + shellfish + blood
  const cnt=$("#cwPickCount"); if(cnt){ cnt.innerHTML=`<span>🌿 ${sel.size} ${L('נבחרו','selected')} · ${items.length} ${L('מוצגים','shown')}</span>${sel.size?`<button class="cwclear" id="cwClearSel">${L('נקה בחירה','Clear selection')}</button>`:''}`;
    const cb=$("#cwClearSel"); if(cb) cb.addEventListener('click',()=>{ const mm=cwMenu(); mm.keys=[]; cwSave(mm); cwPaintPickList(); }); }
  // sticky summary of what's already chosen (all categories)
  const selBar=$("#cwPickSel");
  if(selBar){
    const chosen=[...sel];
    if(!chosen.length){ selBar.innerHTML=''; selBar.classList.remove('on'); }
    else{
      selBar.classList.add('on');
      selBar.innerHTML=`<div class="cwsel-title">${L('כבר בעגלה','Already in cart')} (${chosen.length}):</div><div class="cwsel-chips">`+
        chosen.map(k=>{ const meta=resolveItem(k); const heb=meta?((typeof itemName==='function'?itemName(meta):null)||meta.heb||(meta.obj&&meta.obj.heb)||k):k;
          const ico=(typeof itemEmoji==='function'&&meta)?itemEmoji(meta.cat||(meta.obj&&meta.obj.cat),k):'🍽️';
          return `<span class="cwsel-chip" data-cwunpick="${k}">${ico} ${heb} <b>✕</b></span>`; }).join('')+`</div>`;
      selBar.querySelectorAll('[data-cwunpick]').forEach(el=>el.addEventListener('click',()=>{
        const mm=cwMenu(); mm.keys=(mm.keys||[]).filter(x=>x!==el.dataset.cwunpick); cwSave(mm); cwPaintPickList();
      }));
    }
  }
  // UX #3: preset quick-starts moved into the wizard (the one feature the retired openMenu panel had). Shown only in the unfiltered list.
  const presetBar = (!cwActiveCat && !cwCont && !cwQuery) ? `<div class="cw-presets"><span class="cw-presets-lbl">${L('התחלה מהירה','Quick start')}:</span>`+['מנגל מעורב','שרקוטרי','נקניקיות','דגים'].map(p=>`<button type="button" class="mchip" data-cwpreset="${p}">${t(p)}</button>`).join('')+`<button type="button" class="mchip" data-cwpreset="__fav">⭐ ${L('מהמועדפים','From favorites')}</button></div>` : '';
  host.innerHTML=presetBar+(items.map(i=>{
    const on=sel.has(i.key);
    const ico=(typeof itemEmoji==='function')?itemEmoji(i.cat,i.key):'🍽️';
    const org=(typeof itemOrigin==='function')?itemOrigin(i):'';
    const desc=(typeof itemRichDesc==='function')?itemRichDesc(i):'';
    const sub=[(org?(typeof t==='function'?t(org):org):(typeof t==='function'?t(i.cat):i.cat)), i.eng].filter(Boolean).join(' · ');   // i18n: translate the origin/category
    return `<div class="cmore-item" data-cwpick="${i.key}" style="align-items:flex-start;${on?'border-color:var(--ember);background:linear-gradient(135deg,#fff3e8,#ffe9db)':''}">
      <span class="mi">${ico}</span><div style="flex:1"><div style="font-weight:700">${itemName(i)}</div><div style="font-size:11px;color:var(--smoke);font-weight:400">${sub}</div>${desc?`<div style="font-size:11px;color:var(--bone);opacity:.75;line-height:1.5;margin-top:3px">${desc}</div>`:''}</div>
      <span class="mg" style="color:${on?'var(--ember)':'var(--smoke)'};font-size:20px">${on?'✓':'+'}</span></div>`;
  }).join('')||`<div style="color:var(--smoke);text-align:center;padding:20px">${L('לא נמצאו פריטים','No items found')}</div>`);
  host.querySelectorAll('[data-cwpick]').forEach(el=>el.addEventListener('click',()=>{
    const k=el.dataset.cwpick; const mm=cwMenu(); const s=new Set(mm.keys||[]);
    s.has(k)?s.delete(k):s.add(k); mm.keys=[...s]; cwSave(mm); cwPaintPickList();
  }));
  host.querySelectorAll('[data-cwpreset]').forEach(el=>el.addEventListener('click',()=>{ const p=el.dataset.cwpreset;   // UX #3: presets in the wizard
    if(p==='__fav'){ if(typeof presetFromFavs==='function') presetFromFavs(); } else if(typeof presetMenu==='function'){ presetMenu(p); }
    cwPaintPickList(); }));
}
// ── step 2: real method toggles per selected item ──
function cwPaintMethodsFull(){
  const host=$("#cwMethodsFull"); if(!host) return;
  const m=cwMenu(); const keys=(m.keys||[]);
  if(!keys.length){ host.innerHTML=`<div style="color:var(--smoke);text-align:center;padding:16px">${L('לא נבחרו מנות. חזור לשלב הקודם.','No dishes selected. Go back to the previous step.')}</div>`; return; }
  const rows=keys.map(key=>{
    const meta=resolveItem(key); if(!meta) return '';
    const c=meta.obj||meta; const heb=(typeof itemName==='function'?itemName(meta):null)||meta.heb||c.heb||key;
    // items that support method toggles are cuts/makes with methodRules
    if(typeof methodRules!=='function'||meta.kind==='spec'){ return `<div class="cscard"><h4>${heb}</h4><div style="font-size:12px;color:var(--smoke)">${L('מוצר מוכן — ללא שיטת בישול','Ready product — no cooking method')}</div></div>`; }
    const cur=(typeof activeMethods==='function')?activeMethods(c,key):['grill'];
    const MET=[['sv',L('🌊 סו-ויד','🌊 Sous-vide')],['smoke',L('💨 עישון','💨 Smoke')],['grill',L('🔥 גריל','🔥 Grill')]];
    const chips=MET.map(([mk,lbl])=>{
      const valid=(typeof validCombo==='function')?validCombo(c,cur.includes(mk)?cur:[...cur,mk]):true;
      return `<span class="cmethod ${cur.includes(mk)?'on':''}" data-cwm="${key}" data-cwmk="${mk}">${lbl}</span>`;
    }).join('');
    return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4><div class="cmethods">${chips}</div></div>`;
  }).join('');
  host.innerHTML=rows;
  host.querySelectorAll('[data-cwm]').forEach(el=>el.addEventListener('click',()=>{
    const key=el.dataset.cwm, mk=el.dataset.cwmk; const meta=resolveItem(key); if(!meta) return;
    const c=meta.obj||meta;
    let cur=(typeof activeMethods==='function')?activeMethods(c,key).slice():[];
    if(cur.includes(mk)) cur=cur.filter(x=>x!==mk); else cur.push(mk);
    if(typeof validCombo==='function' && !validCombo(c,cur)){ if(typeof toast==='function') toast('שילוב לא תקין למוצר זה'); return; }
    if(typeof methodKeyFor==='function') store.set(methodKeyFor(key),cur);
    cwPaintMethodsFull();
  }));
}
// ── step 3: seasonings per selected item (with kind + description) ──
function cwSeasFull_desc(s){
  // short one-liner: prefer .use, fall back to ingredients summary
  let d=(s.use||'').trim();
  if(!d) d=(s.ing||'').split(/[.,]/)[0];
  if(d.length>72) d=d.slice(0,70).trim()+'…';
  return d;
}
function cwPaintSeasFull(){
  const host=$("#cwSeasFull"); if(!host) return;
  { const nb=document.querySelector('[data-cwstep="3"] [data-cwgo="4"]'); if(nb) nb.textContent=(typeof menuCtx==='function'&&menuCtx()==='cook')?L('המשך לסקירה ותוכנית ←','Continue to review & plan →'):L('המשך לתוספות וקינוחים ←','Continue to sides & desserts →'); }
  const m=cwMenu(); const keys=(m.keys||[]);
  if(!keys.length){ host.innerHTML=`<div class="cscard"><h4>${L('אין מנות','No dishes')}</h4><div style="font-size:12.5px;color:var(--smoke)">${L('חזור לשלב "מה על האש" ובחר פריטים.','Go back to the "what’s on the fire" step and pick items.')}</div></div>`; return; }
  host.innerHTML=keys.map(key=>{
    const meta=resolveItem(key); if(!meta) return '';
    const c=meta.obj||meta; const heb=(typeof itemName==='function'?itemName(meta):null)||meta.heb||c.heb||key;
    const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
    const list=(typeof seasoningsFor==='function')?seasoningsFor(meta.cat||c.cat,isProd):[];
    if(!list.length) return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4><div style="font-size:12px;color:var(--smoke)">${L('אין מתבלים ייעודיים לפריט זה','No dedicated seasonings for this item')}</div></div>`;
    const burgerBtn=key==='cut-18'?`<button class="mchip" data-cwburger style="margin:2px 0 8px">🍔 ${L('בנה את הבורגר — גבינה, תוספות ורטבים','Build the burger — cheese, toppings and sauces')}</button>`:'';
    return `<div class="cscard"><h4>${(typeof itemEmoji==='function'?itemEmoji(meta.cat||c.cat,key):'')} ${heb}</h4>${burgerBtn}${seasPickerHTML(key, meta.cat||c.cat, isProd, 'edit')}</div>`;
  }).join('');
  keys.forEach(key=>{
    const meta=resolveItem(key); if(!meta) return;
    const c=meta.obj||meta;
    const isProd=(typeof isProduce==='function')&&meta.kind==='cut'&&isProduce(c);
    wireSeasPicker(host, key, meta.cat||c.cat, isProd, 'edit', null);
  });
  host.querySelectorAll('[data-cwburger]').forEach(bb=>bb.addEventListener('click',()=>{ if(typeof openBurgerBuilder==='function') openBurgerBuilder(); }));
}
// set exactly one (or none) seasoning of a given kind for an item
function cwApplySeasKind(key,kind,sid){
  if(typeof selectedSeasonings!=='function'||typeof toggleSeasoning!=='function') return;
  // remove any currently selected of this kind
  selectedSeasonings(key).slice().forEach(id=>{
    const s=(typeof seasoningById==='function')?seasoningById(id):null;
    if(s && s.kind===kind) toggleSeasoning(key,id);
  });
  // add the chosen one (if not "none")
  if(sid) toggleSeasoning(key,sid);
}
// compat: toggle by seasoning id, enforcing single-per-kind (used by tests/legacy)
function cwToggleSeasByKind(key,sid){
  if(typeof selectedSeasonings!=='function') return;
  const target=(typeof seasoningById==='function')?seasoningById(sid):null;
  if(selectedSeasonings(key).includes(sid)){ toggleSeasoning(key,sid); return; }
  if(target) cwApplySeasKind(key,target.kind,sid); else toggleSeasoning(key,sid);
}
// ── step 4: sides + drinks matched to selected cats ──
function cwSelectedCats(){
  const m=cwMenu(); const s=new Set();
  (m.keys||[]).forEach(k=>{const meta=resolveItem(k); if(meta) s.add(meta.cat||(meta.obj&&meta.obj.cat));});
  return s;
}
function cwPaintSidesDrinks(){
  const cats=cwSelectedCats(); const m=cwMenu();
  const match=(t)=>t.includes('*')||t.some(x=>cats.has(x));
  const sh=$("#cwSides");
  if(sh && typeof SIDES!=='undefined'){
    const sel=new Set(m.sides||[]);
    const av=SIDES.filter(s=>match(s.t));
    sh.innerHTML=av.map(s=>`<span class="cmethod ${sel.has(s.n)?'on':''}" data-cwside="${s.n}">${sel.has(s.n)?'✓ ':''}${t(s.n)}</span>`).join('')||`<div style="color:var(--smoke);font-size:12px">${L('בחר מנות קודם','Pick dishes first')}</div>`;
    sh.querySelectorAll('[data-cwside]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.sides||[]); const n=el.dataset.cwside;
      s.has(n)?s.delete(n):s.add(n); mm.sides=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
  const dh=$("#cwDrinks");
  if(dh && typeof DRINKS!=='undefined'){
    const sel=new Set(m.drinks||[]);
    const av=DRINKS.filter(s=>match(s.t));
    const SUBS=[['soft',L('🥤 רכה','🥤 Soft')],['beer',L('🍺 בירה','🍺 Beer')],['wine',L('🍷 יין','🍷 Wine')],['spirit',L('🥃 חריף','🥃 Spirits')],['cocktail',L('🍸 קוקטיילים','🍸 Cocktails')]];
    const chip=s=>`<span class="cmethod ${sel.has(s.n)?'on':''}" data-cwdrink="${s.n}">${sel.has(s.n)?'✓ ':''}${t(s.n)}</span>`;
    const html=SUBS.map(([sub,label])=>{ const grp=av.filter(d=>(d.sub||d.k)===sub); if(!grp.length) return '';
      return `<div class="cwd-sub"><div class="cwd-lbl">${label}</div><div class="cmethods" style="flex-wrap:wrap">${grp.map(chip).join('')}</div></div>`;
    }).join('');
    dh.innerHTML=html||`<div style="color:var(--smoke);font-size:12px">${L('בחר מנות קודם','Pick dishes first')}</div>`;
    dh.querySelectorAll('[data-cwdrink]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.drinks||[]); const n=el.dataset.cwdrink;
      s.has(n)?s.delete(n):s.add(n); mm.drinks=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
  const dsh=$("#cwDesserts");
  if(dsh && typeof DESSERTS!=='undefined'){
    const sel=new Set(m.desserts||[]);
    let html=DESSERTS.map(d=>`<span class="cmethod ${sel.has(d.n)?'on':''}" data-cwdessert="${d.n}">${sel.has(d.n)?'✓ ':''}${d.fire?'🔥 ':''}${t(d.n)}</span>`).join('');
    html+=`<div class="cwd-sub" style="width:100%"><div class="cwd-lbl">🍑 ${L('פירות טריים','Fresh fruit')} — ${t(eventSeason())}${m.evDate?L(' (לפי תאריך האירוע)',' (by event date)'):L(' (החודש)',' (this month)')}</div><span class="cmethod ${sel.has('__fruit')?'on':''}" data-cwdessert="__fruit">${sel.has('__fruit')?'✓ ':''}🍉 ${L('מגש פירות העונה','Seasonal fruit platter')}: ${seasonalFruitList().map(x=>t(x)).join(' · ')}</span></div>`;
    dsh.innerHTML=html;
    dsh.querySelectorAll('[data-cwdessert]').forEach(el=>el.addEventListener('click',()=>{
      const mm=cwMenu(); const s=new Set(mm.desserts||[]); const n=el.dataset.cwdessert;
      s.has(n)?s.delete(n):s.add(n); mm.desserts=[...s]; cwSave(mm); cwPaintSidesDrinks();
    }));
  }
}
// ── step 5: review + serve time + generate real plan ──
function cwPaintReview(){
  const m=cwMenu();
  { const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
    const se=document.getElementById('cwSaveEvent'); if(se) se.style.display=cook?'none':'';
    const fe=document.querySelector('#scr-wizard [data-cgo="events"]'); if(fe) fe.style.display=cook?'none':''; }
  const sv=$("#cwServe"); if(sv){ sv.value=store.get('mk-tlserve')||'19:00'; if(!sv._wired){sv._wired=1; sv.addEventListener('change',()=>store.set('mk-tlserve',sv.value));} }
  const host=$("#cwReview"); if(!host) return;
  const keys=(m.keys||[]);
  const gpp=(typeof window.gpp==='function')?window.gpp(m.appetite):({light:200,reg:280,heavy:380}[m.appetite]||280);
  const totalG=Math.round(gpp*(m.guests||8)/1000*10)/10;
  const dishRow=keys.map(k=>{const meta=resolveItem(k); if(!meta) return ''; const heb=(typeof itemName==='function'?itemName(meta):null)||meta.heb||(meta.obj&&meta.obj.heb)||k;
    const meth=(typeof activeMethods==='function'&&meta.kind!=='spec')?activeMethods(meta.obj||meta,k):[];
    const seas=(typeof selectedSeasonings==='function')?selectedSeasonings(k).length:0;
    const mlabel={sv:L('סו-ויד','Sous-vide'),smoke:L('עישון','Smoke'),grill:L('גריל','Grill')};
    return `<div class="csum-row"><span class="si">${(typeof itemEmoji==='function'?itemEmoji(meta.cat||(meta.obj&&meta.obj.cat),k):'🍽️')}</span><div class="sb"><div class="st">${heb}</div><div class="sd">${meth.map(x=>mlabel[x]||x).join(' + ')||L('מוכן','Ready')}${seas?' · '+seas+' '+L('מתבלים','seasonings'):''}</div></div></div>`;
  }).join('');
  host.innerHTML=`<div class="cscard"><h4>📋 ${L('התפריט','The menu')} · ${m.guests||8} ${L('סועדים','guests')} · ~${totalG} ${L('ק״ג בשר','kg meat')}</h4>
    ${dishRow||`<div style="color:var(--smoke)">${L('לא נבחרו מנות','No dishes selected')}</div>`}
    ${(m.sides||[]).length?`<div class="csum-row"><span class="si">🥗</span><div class="sb"><div class="st">${L('תוספות','Sides')}</div><div class="sd">${m.sides.map(x=>t(x)).join(' · ')}</div></div></div>`:''}
    ${(m.drinks||[]).length?`<div class="csum-row"><span class="si">🥤</span><div class="sb"><div class="st">${L('שתייה','Drinks')}</div><div class="sd">${m.drinks.map(x=>t(x)).join(' · ')}</div></div></div>`:''}
    ${(m.desserts||[]).length?`<div class="csum-row"><span class="si">🍮</span><div class="sb"><div class="st">${L('קינוחים','Desserts')}</div><div class="sd">${m.desserts.map(x=>x==='__fruit'?L('מגש פירות העונה','Seasonal fruit platter')+' ('+t(eventSeason())+')':t(x)).join(' · ')}</div></div></div>`:''}
  </div>`;
  // seed resume for home
  const firstName=keys.length?((typeof itemName==='function'?itemName(resolveItem(keys[0])||{}):null)||(resolveItem(keys[0])||{}).heb):L('ארוחה','Meal');
  store.set('mk-cresume',{title:(firstName||L('ארוחה','Meal'))+(keys.length>1?L(' ועוד',' & more'):''), serv:m.guests||8, ctx:(typeof menuCtx==='function'?menuCtx():'event'), step:cWiz.step, ts:Date.now()});
}
// wire wizard controls
(function(){
  const p=$("#cServPlus"),mi=$("#cServMinus");
  const upd=(d)=>{ const m=cwMenu(); m.guests=Math.max(1,(m.guests||8)+d); cwSave(m); const v=$("#cServVal"); if(v) v.innerHTML=m.guests+'<small>סועדים</small>'; };
  if(p) p.addEventListener('click',()=>upd(1)); if(mi) mi.addEventListener('click',()=>upd(-1));
  document.querySelectorAll('#cwAppetite .cmethod').forEach(b=>b.addEventListener('click',()=>{
    const m=cwMenu(); m.appetite=b.dataset.app; cwSave(m);
    document.querySelectorAll('#cwAppetite .cmethod').forEach(x=>x.classList.toggle('on',x===b));
  }));
  const kb=$("#cwKosher"); if(kb) kb.addEventListener('click',()=>{
    const m=cwMenu(); m.kosher=!m.kosher; cwSave(m); kb.classList.toggle('on',m.kosher);
    if(typeof cwPaintPickList==='function') cwPaintPickList();   // re-filter the list immediately
  });
  document.querySelectorAll('[data-cwgo]').forEach(b=>b.addEventListener('click',()=>cwGo(+b.dataset.cwgo)));
  const back=$("#cwBack"); if(back) back.addEventListener('click',()=>{ if(cWiz.step>0) cwGo(cWiz.step-1); else cwExitWizard(); });
  const exit=$("#cwExit"); if(exit) exit.addEventListener('click',cwExitWizard);
  const gen=$("#cwGenPlan"); if(gen) gen.addEventListener('click',()=>{ const sv=$("#cwServe"); if(sv) store.set('mk-tlserve',sv.value); if(typeof openTimeline==='function') openTimeline(); });
  const vc=$("#cwVoice"); if(vc) vc.addEventListener('click',()=>{
    // build the work-plan tasks (openTimeline populates window._wpTasks synchronously), then launch voice
    if(typeof openTimeline==='function') openTimeline();
    const tasks=(typeof window!=='undefined'&&window._wpTasks)||[];
    if(tasks.length && typeof openVoiceCook==='function') openVoiceCook(tasks);
    else if(typeof toast==='function') toast('אין שלבים לבישול קולי — ודא שיש פריטים בתפריט ושהם לא רב-יומיים');
  });
  // event identity fields → persist into working menu (so save snapshots them)
  const nm=$("#cwEvName"); if(nm) nm.addEventListener('input',()=>{ const m=cwMenu(); m.evName=nm.value; cwSave(m); });
  const ds=$("#cwEvDesc"); if(ds) ds.addEventListener('input',()=>{ const m=cwMenu(); m.evDesc=ds.value; cwSave(m); });
  // A native date input paints its own dd/mm/yyyy hint in the BROWSER's locale — Latin text sitting inside the
  // otherwise-Hebrew wizard, which no page-level translation can reach. So rest it as a text field carrying a real
  // Hebrew placeholder, and swap to the date control only while picking (or whenever a date is actually set).
  const dt=$("#cwEvDate");
  if(dt){
    dt.addEventListener('focus',()=>{
      if(dt.type!=='date'){ dt.type='date'; dt.focus(); }   // re-focus: switching type can drop focus, costing the user a second tap
      try{ if(dt.showPicker) dt.showPicker(); }catch(e){}   // needs a user gesture — throws on a programmatic focus, which is fine
    });
    dt.addEventListener('blur', ()=>{ if(!dt.value && dt.type==='date') dt.type='text'; });
    dt.addEventListener('change',()=>{ const m=cwMenu(); m.evDate=dt.value; cwSave(m); });
  }
  const se=$("#cwSaveEvent"); if(se) se.addEventListener('click',async()=>{
    const m=cwMenu();
    let name=(m.evName||'').trim();
    if(!name){ const v=await appPrompt('שם לאירוע:','',{placeholder:'למשל: שישי במשפחה',okLabel:'💾 שמור'}); if(v===null||v===false) return; name=v||'אירוע ללא שם'; const mm=cwMenu(); mm.evName=name; cwSave(mm); const nmf=$("#cwEvName"); if(nmf) nmf.value=name; }
    evSaveCurrent(name); if(typeof toast==='function') toast(L('האירוע נשמר ✓','Event saved ✓')); cNavGo('events');
  });
})();
function cwSeedResume(){ cwPaintReview(); }
function cwPaintMethods(){ /* legacy no-op retained */ }
function cwPaintProteins(){ /* legacy no-op retained */ }
function cwUpdateHint(){ /* legacy no-op */ }
function cRefreshHome(){
  try{ if(typeof homeAdaptClasses==='function') homeAdaptClasses(); }catch(e){}   // adaptive-home body classes (gear/level/live)
  const r=store.get('mk-cresume'); const box=$("#cResume"); if(!box) return;
  // validate against the store for the SAVED context (cook -> mk-cook, event -> mk-menu), not always mk-menu
  const savedCtx=(r&&r.ctx==='cook')?'cook':'event';
  const savedMenu=store.get(savedCtx==='cook'?'mk-cook':'mk-menu')||{keys:[]};
  const hasDraft=(savedMenu.keys||[]).length>0;
  if(r&&r.title&&hasDraft){ box.hidden=false; const m=$("#cResumeM"); if(m) m.textContent=`${r.title} · ${r.serv} ${L('סועדים','guests')}${savedCtx==='cook'?' · '+L('בישול','cook'):''}`; }
  else { box.hidden=true; if(!hasDraft&&r) store.set('mk-cresume',null); }
  // last active project
  const pbox=$("#cResumeProj");
  if(pbox){
    const lid=store.get('mk-lastproj'); const projs=(typeof pantry==='function')?pantry():[];
    const p=lid&&projs.find?projs.find(x=>x.id===lid):null;
    if(p){ pbox.hidden=false; const pm=$("#cResumeProjM");
      const pr=(typeof projProgress==='function')?projProgress(p):null;
      if(pm) pm.textContent=`${p.name}${pr?' · '+(pr.day||pr.label):''}${pr&&pr.ready?' · '+L('מוכן ✓','ready ✓'):''}`;
    } else pbox.hidden=true;
  }
  // F2: live-cook banner — a plan started (any event/scope) or timers running/ringing
  { const cb=$("#cCooking");
    if(cb){
      let anyStarted=false; try{ for(let i=0;i<localStorage.length;i++){ const kk=localStorage.key(i)||''; if(kk.indexOf('mk-plan-started-')===0 && store.get(kk)){ anyStarted=true; break; } } }catch(e){}
      const ts=store.get('mk-timers')||{}, now=Date.now(); let running=0, ringing=0;
      Object.keys(ts).forEach(k=>{ const r=ts[k]; if(r&&r.end){ if(r.fired) ringing++; else if(r.end>now) running++; } });
      const live = anyStarted || running>0 || ringing>0;
      if(live){ cb.hidden=false; const cm=$("#cCookingM"); const en=(typeof getLang==='function'&&getLang()!=='he');
        if(cm) cm.textContent = ringing? `⏰ ${ringing} ${en?(ringing===1?'timer finished — tap':'timers finished — tap'):'טיימרים הסתיימו — הקש'}` : running? `${running} ${en?(running===1?'timer running · tap for the plan':'timers running · tap for the plan'):'טיימרים פעילים · הקש לתוכנית'}` : L('תוכנית פעילה · הקש לתוכנית','Plan active · tap for the plan');
        cb.classList.toggle('cnext-ring', ringing>0);
        cb.onclick=()=>{ if(typeof liveSession==='function' && liveSession() && typeof openCopilot==='function') openCopilot(); else if(typeof openActive==='function') openActive(); else if(typeof openTimeline==='function') openTimeline(); };   // W2-P1: a live session → the Copilot
      } else cb.hidden=true;
    }
  }
  const g=$("#cGreet"); if(g){ const h=new Date().getHours(); g.textContent=(h<12?L('בוקר טוב','Good morning'):h<18?L('צהריים טובים','Good afternoon'):L('ערב טוב','Good evening'))+' 👋'; }
  const kk=$("#cHomeKick"); if(kk){ const hg=(typeof homeGear==='function')?homeGear():{canSV:true,canSmoke:true,canGrill:true}; const p=[]; if(hg.canSV)p.push(L('סו-ויד','Sous-vide')); if(hg.canSmoke)p.push(L('עישון','Smoke')); if(hg.canGrill)p.push(L('גריל','Grill')); p.push(L('אש','Fire')); kk.textContent=p.join(' · '); }   // gear-aware tagline — drops methods you can't do
  try{ if(typeof renderHomeLanes==='function') renderHomeLanes(); }catch(e){}
  try{ if(typeof renderHomeChrome==='function') renderHomeChrome(); }catch(e){}
  try{ if(typeof applyHomeCustom==='function') applyHomeCustom(); }catch(e){}
}
// P7 — home customization: the user picks which home modules show and in what order (a manual override on top
// of the gear/level auto-defaults). Reorder is done by moving nodes inside #cHomeModules (decoupled from Phase 2's
// cooking-lift, which reorders direct children of #scr-home). Conditional visibility (dock=pro, etc.) still applies;
// a toggled-off module gets .home-mod-off on top.
const HOME_MODULES=[
  { id:'cHomeLanes',   he:'מנות מהירות',          en:'Quick-pick lanes' },
  { id:'cHomeAskWrap', he:'שאל את האש · כלי AI',   en:'Ask the Fire · AI' },
  { id:'cHomePaths',   he:'תכנון אירוע / בישול',   en:'Plan / cook cards' },
  { id:'cHomeDock',    he:'כלי הפיטמאסטר',         en:'Pit-tools dock', gate:'pro' },
];
// A module with a `gate` is hidden by default below that interface level — but an explicit "show" from Customize-home
// overrides it. Before this, toggling the dock on at mid level silently did nothing (the level gate always won).
function homeModGate(id){ const m=HOME_MODULES.find(x=>x.id===id); return (m&&m.gate)||''; }
function homeModOn(id){
  const c=homeCustom();
  const off=(c&&Array.isArray(c.off))?c.off:[];
  if(off.indexOf(id)>=0) return false;                                   // explicit hide always wins
  const g=homeModGate(id); if(!g) return true;
  if(typeof uiLevel==='function' && uiLevel()===g) return true;          // level default turns it on
  const on=(c&&Array.isArray(c.on))?c.on:[];
  return on.indexOf(id)>=0;                                             // explicit opt-in beats the level default
}
function homeCustom(){ const c=(typeof store!=='undefined')&&store.get('mk-homecustom'); return (c&&Array.isArray(c.order))?c:null; }
function homeCustomOrder(){ const ids=HOME_MODULES.map(m=>m.id); const c=homeCustom();
  const order=c?c.order.filter(id=>ids.indexOf(id)>=0):ids.slice();
  ids.forEach(id=>{ if(order.indexOf(id)<0) order.push(id); });   // any module missing from a stored order → append (forward-compatible)
  return order;
}
function applyHomeCustom(){
  const host=$("#cHomeModules"); if(!host) return;
  const order=homeCustomOrder();
  const cur=[].slice.call(host.children).map(el=>el.id).filter(Boolean);
  if(cur.join(',')!==order.join(',')){ order.forEach(function(id){ const el=document.getElementById(id); if(el&&el.parentNode===host) host.appendChild(el); }); }   // reorder only when it actually differs (avoid DOM churn each paint)
  order.forEach(function(id){ const el=document.getElementById(id); if(el) el.classList.toggle('home-mod-off', !homeModOn(id)); });
}
// Phase 4 — pro/multi-event home chrome: gear-summary chip, multi-event command-center bar, and the pit-tools dock.
// All gear/level/event derived, re-rendered every cRefreshHome (so language + state changes track live).
// Pit-tools dock is user-customizable: pick WHICH tools (from this pool) appear and in what order. [icon, he, en, fn].
const DOCK_POOL=[
  ['🧮','מלח / ריפוי','Salt / cure','openCalc'],
  ['🌳','עץ ופחם','Wood & charcoal','openWoods'],
  ['🗂️','ציר זמן משולב','Combined timeline','openCombinedTimeline'],
  ['📓','יומן','Journal','openJournal'],
  ['🤖','כלי AI','AI tools','openAiHub'],
  ['🔥','שאל את האש','Ask the Fire','openAsk'],
  ['🧂','מתבלים ורטבים','Seasonings','openSeasonings'],
  ['🥩','מתרגם נתחים','Cut translator','openCutTrans'],
  ['🧫','פרויקטים ומזווה','Projects & pantry','openPantry'],
  ['⏰','תזכורות','Reminders','openReminders'],
  ['🩺','אבחון תקלה','Diagnose','openDiagnoseAI'],
];
const DOCK_DEFAULT=['openCalc','openWoods','openCombinedTimeline','openJournal'];
function dockTools(){ const pool=DOCK_POOL.map(function(t){return t[3];});
  const c=(typeof store!=='undefined')&&store.get('mk-dock-tools');
  if(Array.isArray(c)) return c.filter(function(fn){return pool.indexOf(fn)>=0;});   // set (even empty) is respected
  return DOCK_DEFAULT.slice();
}
function renderHomeChrome(){
  const he=(typeof getLang!=='function'||getLang()==='he');
  // gear-summary chip — the honest "tap to change what the app assumes you have" (only once gear is configured)
  const gc=$("#cHomeGearChip");
  if(gc){
    if(typeof gearConfigured==='function' && gearConfigured()){
      gc.innerHTML=`🔧 <span class="cgc-list">${he?'הציוד שלי':'My gear'}</span> <span class="cgc-edit">· ${he?'שנה':'change'}</span>`;
      gc.hidden=false;
    } else gc.hidden=true;
  }
  try{ if(typeof syncGearBanner==='function') syncGearBanner(); }catch(e){}   // banner ↔ chip symmetry: banner when unconfigured, chip when configured
  // multi-event bar — 2+ events → the combined command center (v203), with a smoker-clash flag
  const mv=$("#cHomeMultiEv");
  if(mv){
    const evs=(typeof evList==='function')?evList():[];
    if(evs.length>=2){
      let clash=0; try{ clash=combinedEventsRows().filter(function(r){return r.contention;}).length; }catch(e){}
      mv.innerHTML=`<span class="mev-ic">🗂️</span><span class="mev-txt"><b>${evs.length} ${he?'אירועים':'cookouts'}</b> · ${he?'לוח-זמנים משולב':'combined schedule'}${clash?` · <span class="mev-warn">⚠ ${clash} ${he?'חפיפות':'clashes'}</span>`:''}</span><span class="mev-go">←</span>`;
      mv.hidden=false;
    } else mv.hidden=true;
  }
  // pit-tools dock — pro level only (the power tools within one tap)
  const dk=$("#cHomeDock");
  if(dk){
    if(homeModOn('cHomeDock')){
      const byFn={}; DOCK_POOL.forEach(function(t){ byFn[t[3]]=t; });
      const tools=dockTools().map(function(fn){ return byFn[fn]; }).filter(Boolean);
      const title=`<div class="dock-title">🛠️ ${he?'כלי הפיטמאסטר':'Pitmaster tools'}<button class="dock-edit" data-dockedit aria-label="${he?'התאם':'Customize'}">✎</button></div>`;
      const grid=tools.length
        ? `<div class="dock-grid">${tools.map(function(x){return `<button class="dockbtn" data-hfn="${x[3]}"><span class="dk-ic">${x[0]}</span>${he?x[1]:x[2]}</button>`;}).join('')}</div>`
        : `<button class="dock-empty" data-dockedit>＋ ${he?'הוסף כלים':'Add tools'}</button>`;
      dk.innerHTML=title+grid;
      dk.hidden=false;
      dk.querySelectorAll('.dockbtn[data-hfn]').forEach(function(b){ b.addEventListener('click',function(){ const fn=b.dataset.hfn; if(typeof window[fn]==='function') window[fn](); }); });
      dk.querySelectorAll('[data-dockedit]').forEach(function(b){ b.addEventListener('click',function(){ if(typeof openDockCustom==='function') openDockCustom(); }); });
    } else { dk.hidden=true; dk.innerHTML=''; }
  }
}
// Phase 3 — home hero quick-pick lanes: gear-gated rails of single cuts, each chip → openCut (the single-cut fast lane
// that skips the event wizard). DATA-derived shortlist per method; resolveItem-guarded so a data change never leaves a dead chip.
const HOME_LANES=[
  { m:'smoke', ic:'💨', he:'מעשנה', en:'Smoker', tip:['נמוך ואיטי — 105-110°C, עשן אלון/היקורי','Low & slow — 105–110°C, oak/hickory smoke'],
    keys:['cut-1','cut-13','cut-2','cut-7','cut-21','cut-15','cut-12'] },       // Brisket, Pork Shoulder, Short Ribs, Pork Ribs, Dino Ribs, Lamb Shoulder, Pastrami
  { m:'grill', ic:'🔥', he:'גריל', en:'Grill',
    keys:['cut-6','cut-20','cut-18','cut-17','cut-5','cut-39','cut-16'] },       // Picanha, Tri-Tip, Hamburger, Kebab, Chicken Thighs, Wings, Sausages
  { m:'sv', ic:'💧', he:'סו-ויד', en:'Sous-vide',
    keys:['cut-6','cut-11','cut-20','cut-27','cut-23','cut-26'] },               // Picanha, Tomahawk, Tri-Tip, Tenderloin, Prime Rib, Striploin
];
function renderHomeLanes(){
  const host=$("#cHomeLanes"); if(!host) return;
  const he=(typeof getLang!=='function' || getLang()==='he');
  let html='';
  HOME_LANES.forEach(function(ln){
    if(typeof gearCan==='function' && !gearCan(ln.m)) return;                    // gear gate — lane shows only for gear you own
    const chips=ln.keys.map(function(k){ const it=(typeof resolveItem==='function')?resolveItem(k):null; if(!it) return '';   // guard: skip a key that no longer resolves
      const nm=he?it.heb:(it.eng||it.heb);
      return `<button class="lane-chip" data-k="${k}">${nm}</button>`;
    }).filter(Boolean).join('');
    if(!chips) return;
    const tip=ln.tip?`<div class="lane-tip">${he?ln.tip[0]:ln.tip[1]}</div>`:'';
    html+=`<div class="lane lane-${ln.m}"><div class="lane-head"><span class="lane-ic">${ln.ic}</span>${he?ln.he:ln.en}</div><div class="lane-rail">${chips}</div>${tip}</div>`;
  });
  host.innerHTML=html;
  host.querySelectorAll('.lane-chip[data-k]').forEach(function(b){ b.addEventListener('click',function(){ const m=resolveItem(b.dataset.k); if(!m) return; m.kind==='cut'?openCut(m.obj):m.kind==='spec'?openSpec(m.obj):openMake(String(m.key).slice(5)); }); });
}
// shared "is something cooking?" state (started plans + running/ringing timers)
function _liveCookState(){
  let anyStarted=false; try{ for(let i=0;i<localStorage.length;i++){ const kk=localStorage.key(i)||''; if(kk.indexOf('mk-plan-started-')===0 && store.get(kk)){ anyStarted=true; break; } } }catch(e){}
  const ts=store.get('mk-timers')||{}, now=Date.now(); let running=0, ringing=0;
  Object.keys(ts).forEach(function(k){ const r=ts[k]; if(r&&r.end){ if(r.fired) ringing++; else if(r.end>now) running++; } });
  return {anyStarted:anyStarted, running:running, ringing:ringing, live:(anyStarted||running>0||ringing>0)};
}
// floating shortcut to the Active-now hub — visible on any screen while cooking, hidden when a panel is open
function syncActiveFab(){ try{ const fab=$("#cActiveFab"); if(!fab) return; const s=_liveCookState();
  const panelOpen=document.body.classList.contains('noscroll');
  if(s.live && !panelOpen){ fab.hidden=false; const t=$("#cActiveFabT"); if(t) t.textContent = s.ringing? (L('הסתיים','Done')+' '+s.ringing) : (s.running? (s.running+' '+L('פעילים','running')) : L('פעיל עכשיו','Active now')); fab.classList.toggle('caf-ring', s.ringing>0); }
  else fab.hidden=true;
}catch(e){} }
// ═══════════ "Active now" hub — every ongoing timer / plan / long-term project in one place, each with a jump-back ═══════════
function _openItemByKey(key){ try{ const it=(typeof resolveItem==='function')?resolveItem(key):null; if(!it) return false;
  if(it.kind==='cut'&&typeof openCut==='function') openCut(it.obj);
  else if(it.kind==='spec'&&typeof openSpec==='function') openSpec(it.obj);
  else if(it.kind==='make'&&typeof openMake==='function') openMake(String(it.key).replace(/^make-/,''));
  else return false; return true; }catch(e){ return false; } }
// parse mk-timers into displayable rows (running / ringing / paused)
function activeTimerRows(){
  const ts=store.get('mk-timers')||{}, now=Date.now(), out=[];
  Object.keys(ts).forEach(function(k){ const r=ts[k]; if(!r) return;
    const running=!!(r.end && !r.fired && r.end>now), ringing=!!(r.end && r.fired), paused=(r.left!=null)&&!r.end;
    if(!running && !ringing && !paused) return;
    out.push({key:k, name:(r.name||''), running:running, ringing:ringing, paused:paused, remain:running?Math.max(0,Math.round((r.end-now)/1000)):(paused?r.left:0), end:r.end||0});
  });
  out.sort(function(a,b){ if(a.ringing!==b.ringing) return a.ringing?-1:1; return (a.end||0)-(b.end||0); });   // ringing (needs attention) first, then soonest
  return out;
}
// derive the catalog item key a timer belongs to, from either id shape:
//   recipe:   <itemKey>-<which>-<index>        (e.g. cut-1-sv-0)
//   timeline: st-<scope>-<itemKey>-<kind>[n]   (scope/itemKey may both contain dashes)
function timerItemKey(key){
  const s=String(key); if(typeof resolveItem!=='function') return '';
  let m=s.match(/^((?:cut|spec|make)-.+?)-[a-z]+-\d+$/);   // recipe form
  if(m && resolveItem(m[1])) return m[1];
  if(s.indexOf('st-')===0){
    const body=s.slice(3).replace(/-[a-z]+\d*$/,'');       // drop 'st-' + trailing stage kind → <scope>-<itemKey>
    const parts=body.split('-');
    for(let i=0;i<parts.length;i++){ const cand=parts.slice(i).join('-'); if(/^(cut|spec|make)-/.test(cand) && resolveItem(cand)) return cand; }   // longest suffix that resolves
  }
  return '';
}
const STAGE_KIND={sv:['סו-ויד','Sous-vide'],smoke:['עישון','Smoke'],grill:['גריל','Grill'],sear:['צריבה','Sear'],rest:['מנוחה','Rest'],prep:['הכנה','Prep'],hot:['עישון חם','Hot smoke'],cold:['עישון קר','Cold smoke'],serve:['הגשה','Serve'],dry:['ייבוש','Dry'],cure:['ריפוי','Cure']};
function timerKindLabel(key){
  const s=String(key); let kind='';
  let m=s.match(/^(?:cut|spec|make)-.+?-([a-z]+)-\d+$/);   // recipe: the "which" segment
  if(m) kind=m[1]; else { m=s.match(/-([a-z]+)\d*$/); if(m) kind=m[1]; }   // timeline: trailing kind
  const kk=STAGE_KIND[kind]; return kk?L(kk[0],kk[1]):'';
}
// which cook / plan / recipe a timer belongs to → a localized item label + context + jump-back
function timerSource(key){
  const s=String(key);
  const ikey=timerItemKey(key);
  const meta=(ikey&&typeof resolveItem==='function')?resolveItem(ikey):null;
  const itemLbl=meta?(typeof itemName==='function'?itemName(meta):meta.heb):'';
  if(s.indexOf('st-')===0){
    const evName=(typeof timerEventName==='function')?timerEventName(key):'';
    if(evName){ const ev=(typeof evList==='function'?evList():[]).find(function(e){ return s.indexOf('st-'+e.id+'-')===0; });
      return {label:itemLbl, ctx:evName, jump: ev?function(){ if(typeof evLoad==='function') evLoad(ev.id); if(typeof openTimeline==='function') openTimeline(key); }:null}; }   // focus this timer's item in the plan
    if(s.indexOf('st-cook-')===0) return {label:itemLbl, ctx:L('בישול','Cook'), jump:function(){ if(typeof setMenuCtx==='function') setMenuCtx('cook'); if(typeof openTimeline==='function') openTimeline(key); }};
    return {label:itemLbl, ctx:L('תוכנית','Plan'), jump:(typeof openTimeline==='function')?function(){ openTimeline(key); }:null};
  }
  if(meta) return {label:itemLbl, ctx:'', jump:function(){ _openItemByKey(ikey); }};
  return {label:'', ctx:'', jump:null};
}
function openActive(){
  const rows=activeTimerRows();
  const plans=[]; try{ for(let i=0;i<localStorage.length;i++){ const kk=localStorage.key(i)||''; if(kk.indexOf('mk-plan-started-')===0 && store.get(kk)) plans.push(kk.replace('mk-plan-started-','')); } }catch(e){}
  const draft=store.get('mk-cresume');
  const projs=(typeof pantry==='function'?pantry():[]).filter(function(p){ return (p.type==='dry'||p.type==='cure') && !((typeof projProgressReady==='function')&&projProgressReady(p)); });
  const en=(typeof getLang==='function'&&getLang()!=='he');
  const trow=function(x){ const src=timerSource(x.key);
    const time=x.ringing?`⏰ ${L('הסתיים!','Done!')}`:(x.paused?`⏸ ${fmt(x.remain)}`:`<span class="atimer-remain" data-end="${x.end}">${fmt(x.remain)}</span>`);
    const stage=timerKindLabel(x.key), item=src.label||'';
    // build the name from the (localized) item + stage; only fall back to the stored name if it isn't stale Hebrew
    let nm = item ? (stage?stage+' · '+item:item) : '';
    if(!nm) nm = (x.name && !(en && /[֐-׿]/.test(x.name))) ? x.name : (stage||L('טיימר','Timer'));
    const sub=src.ctx||'';
    return `<div class="active-row ${x.ringing?'ring':''}"${src.jump?' data-ajump="'+encodeURIComponent(x.key)+'"':''}>
      <div class="ar-main"><b>${esc(nm)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>
      <div class="ar-time">${time}</div>
      <button class="ar-x" data-astop="${encodeURIComponent(x.key)}" aria-label="${L('עצור טיימר','Stop timer')}">✕</button>
    </div>`; };
  const timerHTML=rows.length?rows.map(trow).join(''):`<div class="active-empty">${L('אין טיימרים פעילים.','No active timers.')}</div>`;
  const planHTML=(plans.length||(draft&&draft.title))?(
    ((draft&&draft.title)?`<div class="active-row" data-aresume="1"><div class="ar-main"><b>${esc(draft.title)}</b><small>${draft.ctx==='cook'?L('בישול','Cook'):L('אירוע','Event')} · ${L('טיוטה','draft')}</small></div><span class="ar-go">←</span></div>`:'')
    +plans.map(function(sc){ const ev=(typeof evList==='function'?evList():[]).find(function(e){return e.id===sc;});
        const label=ev?ev.name:(sc==='cook'?L('בישול','Cook'):L('תוכנית','Plan'));
        return `<div class="active-row" data-aplan="${encodeURIComponent(sc)}"><div class="ar-main"><b>${esc(label)}</b><small>▶ ${L('תוכנית פעילה','Plan running')}</small></div><span class="ar-go">←</span></div>`; }).join('')
  ):`<div class="active-empty">${L('אין תוכניות פעילות.','No active plans.')}</div>`;
  const projHTML=projs.map(function(p){ const pr=projProgress(p);
      return `<div class="active-row" data-aproj="1"><div class="ar-main"><b>${esc(p.name)}</b><small>${esc((pr.day||pr.label)+(pr.sub?' · '+pr.sub:''))}</small></div><span class="ar-go">←</span></div>`; }).join('');
  showPanel(`${toolTop(L('פעיל עכשיו','Active now'),L('טיימרים, תוכניות ופרויקטים פעילים','Timers, plans and projects in progress'),'🔥','#c65a3f')}
    <div class="panel-body">
      <div class="active-tip">💡 ${L('הקש טיימר כדי לקפוץ לשלב שלו בתוכנית העבודה · הקש בישול/אירוע כדי לפתוח את תוכנית העבודה שלו','Tap a timer to jump to its step in the work plan · tap a cook/event to open its work plan')}</div>
      <div class="active-sec"><h4>⏱ ${L('טיימרים','Timers')}</h4>${timerHTML}</div>
      <div class="active-sec"><h4>🔥 ${L('בישול / תוכניות','Cooks / plans')}</h4>${planHTML}</div>
      ${projs.length?`<div class="active-sec"><h4>🧫 ${L('פרויקטים ארוכי-טווח','Long-term projects')}</h4>${projHTML}</div>`:''}
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  pnl.querySelectorAll('[data-astop]').forEach(function(b){ b.addEventListener('click',function(e){ e.stopPropagation();
    const key=decodeURIComponent(b.dataset.astop); const ts=store.get('mk-timers')||{}; delete ts[key]; store.set('mk-timers',ts);
    try{ if(typeof cRefreshHome==='function') cRefreshHome(); }catch(_){} openActive(); }); });
  pnl.querySelectorAll('[data-ajump]').forEach(function(row){ row.addEventListener('click',function(){ const src=timerSource(decodeURIComponent(row.dataset.ajump)); if(src&&src.jump) src.jump(); }); });
  pnl.querySelectorAll('[data-aplan]').forEach(function(row){ row.addEventListener('click',function(){ const sc=decodeURIComponent(row.dataset.aplan);
    if(sc==='cook'){ if(typeof setMenuCtx==='function') setMenuCtx('cook'); } else if(typeof evLoad==='function'){ evLoad(sc); }
    if(typeof openTimeline==='function') openTimeline(); }); });
  const dr=pnl.querySelector('[data-aresume]'); if(dr) dr.addEventListener('click',function(){ const d=store.get('mk-cresume')||{}; if(typeof setMenuCtx==='function') setMenuCtx(d.ctx||'event'); if(typeof cwGo==='function') cwGo(typeof d.step==='number'?d.step:5); if(typeof cNavGo==='function') cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); });
  pnl.querySelectorAll('[data-aproj]').forEach(function(row){ row.addEventListener('click',function(){ if(typeof cNavGo==='function') cNavGo('projects'); }); });
  try{ timers['atick']=setInterval(function(){ const now=Date.now();
    pnl.querySelectorAll('.atimer-remain[data-end]').forEach(function(s){ const left=Math.max(0,Math.round((+s.dataset.end-now)/1000));
      if(left<=0){ s.textContent='⏰ '+L('הסתיים!','Done!'); s.removeAttribute('data-end'); } else s.textContent=fmt(left); }); },1000); }catch(e){}
}
// ═══════════ Event manager (mk-events + draft) ═══════════
function evList(){ const l=store.get('mk-events'); return Array.isArray(l)?l:[]; }
function evSaveList(l){ store.set('mk-events', l); }
function evActive(){ return store.get('mk-active')||null; }
// scope for per-event timers + start-state: each event (or the 'cook' route) is an independent parallel session
function evScope(){ return (typeof menuCtx==='function'&&menuCtx()==='cook')?'cook':(evActive()||'draft'); }
// count of currently-running timers for a given event scope (its stage timers are keyed "st-<scope>-…")
function evRunningCount(id){ const ts=store.get('mk-timers')||{}, now=Date.now(); let c=0; Object.keys(ts).forEach(function(k){ const r=ts[k]; if(r&&r.end&&r.end>now && k.indexOf('st-'+id+'-')===0) c++; }); return c; }   // E2: exact scope-prefix, not a fragile substring match
// resolve which event a stage-timer key (st-<scope>-…) belongs to — exact prefix, robust
function timerEventName(key){ if(!key) return ''; const evs=evList(); for(var i=0;i<evs.length;i++){ if(String(key).indexOf('st-'+evs[i].id+'-')===0) return evs[i].name||''; } return ''; }
function evGenId(){ return 'ev-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e4).toString(36); }
function evMenuHasContent(m){ m=m||((typeof menuState==='function')?menuState():{keys:[]}); return (m.keys||[]).length>0; }
function isDraft(){ return !evActive() && evMenuHasContent(); }
// snapshot current working menu (mk-menu) into an event
function evSaveCurrent(name,desc,date){
  const m=(typeof menuState==='function')?menuState():{};
  const id=evActive()||evGenId();
  const list=evList();
  const now=Date.now();
  const existing=list.find(e=>e.id===id);
  const rec={ id, name:(name||m.evName||'אירוע ללא שם').trim()||'אירוע ללא שם', desc:(desc!==undefined?desc:(m.evDesc||'')),
    date:(date!==undefined?date:(m.evDate||'')), serve:store.get('mk-tlserve')||'19:00',
    menu:JSON.parse(JSON.stringify(m)), created:existing?existing.created:now, updated:now };
  const idx=list.findIndex(e=>e.id===id);
  if(idx>=0) list[idx]=rec; else list.push(rec);
  evSaveList(list); store.set('mk-active',id);
  return id;
}
function evLoad(id){
  const e=evList().find(x=>x.id===id); if(!e) return false;
  // E6 (data-safety): never lose unsaved work when switching events, and make the switch explicit.
  const curActive=(typeof evActive==='function')?evActive():null;
  let rescued=null;
  if(curActive && curActive!==id){
    // leaving an active event → persist any working-menu edits back to its record (lossless, quiet)
    try{ if(typeof evMenuHasContent==='function' && evMenuHasContent() && typeof evSaveCurrent==='function') evSaveCurrent(); }catch(_){}
  } else if(!curActive && typeof isDraft==='function' && isDraft()){
    // unsaved draft (no active event) → snapshot so the switch can be undone
    try{ rescued={ menu:JSON.parse(JSON.stringify(menuState())), serve:store.get('mk-tlserve'), ctx:(typeof menuCtx==='function')?menuCtx():'event' }; }catch(_){ rescued=null; }
  }
  setMenuCtx('event');
  if(typeof saveMenu==='function') saveMenu(JSON.parse(JSON.stringify(e.menu))); else store.set('mk-menu',e.menu);
  if(e.serve) store.set('mk-tlserve',e.serve);
  store.set('mk-active',id);
  if(typeof toast==='function'){
    if(rescued) toast(L('עברת לאירוע: ','Switched to event: ')+esc(e.name)+L(' · הטיוטה נשמרה',' · draft saved'), function(){   // undo → restore the rescued draft
        setMenuCtx(rescued.ctx||'event'); if(typeof saveMenu==='function') saveMenu(rescued.menu); if(rescued.serve) store.set('mk-tlserve',rescued.serve); store.set('mk-active',null);
        if(typeof closePanel==='function') closePanel(); if(typeof render==='function') render(); try{ if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); }catch(_){}
        if(typeof updateCartBadge==='function') updateCartBadge(); if(typeof cRefreshHome==='function') cRefreshHome();
      }, L('שחזר טיוטה','Restore draft'));
    else toast(L('עברת לאירוע: ','Switched to event: ')+esc(e.name));
  }
  return true;
}
function evDelete(id){
  const wasActive=(evActive()===id);
  evSaveList(evList().filter(e=>e.id!==id));
  if(wasActive){ evClearActive(); }
}
function evDeleteAll(){
  evSaveList([]); evClearActive();
}
function evClearActive(){
  setMenuCtx('event');
  // deleting/clearing active → clear the meal builder (per decision)
  const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};
  if(typeof saveMenu==='function') saveMenu(empty); else store.set('mk-menu',empty);
  store.set('mk-active',null);
}
function evNewDraft(){
  setMenuCtx('event');
  // start clean for a new event (wizard)
  const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0,evName:'',evDesc:'',evDate:''};
  if(typeof saveMenu==='function') saveMenu(empty); else store.set('mk-menu',empty);
  store.set('mk-active',null);
  store.set('mk-tlserve','19:00');
}
function evGuardBeforeNew(proceed){
  // if there's an unsaved draft, ask to save/discard before starting new
  if(isDraft()){
    const n=((typeof menuState==='function')?menuState().keys.length:0);
    appConfirm(`יש לך טיוטה לא-שמורה (${n} מנות).\nלשמור אותה כאירוע לפני שמתחילים חדש?`,{okLabel:'💾 שמור והמשך',cancelLabel:'🗑️ מחק והמשך'}).then(ans=>{
      if(ans===null) return;                 // dismissed — abort entirely
      if(ans===true) evSaveCurrent();
      evNewDraft(); proceed&&proceed();
    });
    return;
  }
  evNewDraft(); proceed&&proceed();
}
// ── events screen ──
// combined multi-event timeline: every event's item-start actions merged onto one color-coded schedule
const EV_COLORS=['#e76f51','#1a9a7a','#3550c7','#b5603a','#7a5cc2','#2f6070','#c77d2a'];
function parseServeTime(s,ev){ const p=(s||'19:00').split(':').map(Number); let d; if(ev&&ev.date){ d=new Date(ev.date+'T00:00:00'); } else { d=new Date(); if(((p[0]||19)*60+(p[1]||0))*60e3 + new Date().setHours(0,0,0,0) < Date.now()) d.setDate(d.getDate()+1); } d.setHours(p[0]||19,p[1]||0,0,0); return d; }   // event → its real date; ad-hoc → today, rolled to tomorrow if the clock passed
function combinedEventsRows(){
  const rows=[]; const computed=[];   // occupancy-shaped entries feed the SAME model cookerContention uses — one clash rule for the whole app, not two
  evList().forEach(function(ev,ei){ const serve=parseServeTime(ev.serve, ev);
    const evState = store.get('mk-tlstate-'+ev.id) || {};   // E3: this event's real per-item method/order/ready choices
    ((ev.menu&&ev.menu.keys)||[]).forEach(function(key){ const meta=(typeof resolveItem==='function')?resolveItem(key):null; if(!meta) return;
      let totalH=0, stages=[]; const st=evState[key]||{};
      try{ const profile=itemProfile(meta);
        const method=st.method||profile.methods[0].key, ready=(st.ready!==false), order=st.svSmokeOrder||svSmokeOrderDefault();
        stages=itemStages(meta, method, ready, order);
        totalH=stages.reduce(function(a,s){return a+(s.hours||0);},0);
      }catch(e){}
      // schedule backward from serve to get the start clock, this item's smoke window (for the legend),
      // and one occupancy entry per device-relevant stage — real Date range + temp kept, not discarded.
      // The device is resolved in THIS EVENT'S OWN scope (mk-item-cooker-<ev.id>), never the globally
      // active one — two events' assignments must never bleed into each other.
      // times come from the ONE scheduler (planSchedule) — this used to be a second, independent copy of
      // the backward walk. Still iterated BACKWARD: `smokeWin` takes the first smoke seen walking back,
      // i.e. the LAST smoke stage of the chain, and the push order is preserved.
      const _sched=planSchedule(stages, serve.getTime());
      let smokeWin=null; const row={ev:ev, ei:ei, key:key, name:meta.heb, eng:meta.eng, serve:serve, totalH:totalH, contention:false};
      for(var i=_sched.stages.length-1;i>=0;i--){ const p=_sched.stages[i], s=stages[i]||{};
        if(['smoke','cook','sv'].indexOf(p.kind)>=0){
          if(p.kind==='smoke' && !smokeWin) smokeWin={start:p.startMs,end:p.endMs};
          const dev=cookerFor(meta.key, p.kind, ev.id);
          if(dev) computed.push({m:meta, row:row, devId:dev.id, stages:[{kind:p.kind, start:new Date(p.startMs), end:new Date(p.endMs), temp:(s.temp!=null?s.temp:null)}]});
        }
      }
      row.start=new Date(_sched.startMs); row.smoke=smokeWin;
      rows.push(row);
    });
  });
  rows.sort(function(a,b){return a.start-b.start;});
  // No-equipment gate: until the user configures a kit we know no capacity, so the occupancy model has
  // nothing to reason about — and unlike the single-event plan, this view never resolved a device in the
  // first place. It presumed ONE smoker and warned on overlapping smoke windows, which is still the most
  // useful thing we can say with no data. Keep that behaviour byte-identical rather than going silent.
  if(!equipConfigured()){
    for(var a=0;a<rows.length;a++){ for(var b=a+1;b<rows.length;b++){ const A=rows[a],B=rows[b];
      if(A.ev.id!==B.ev.id && A.smoke && B.smoke && A.smoke.start<B.smoke.end && B.smoke.start<A.smoke.end){ A.contention=true; B.contention=true; } } }
    return rows;
  }
  // Configured: contention = a real physical conflict on a shared device (over usable capacity, or
  // temperatures that cannot be reconciled) — never mere time-overlap. Mirrors cookerContention, spanning
  // multiple events' scopes via each computed entry's own pre-resolved devId (deviceOccupancy honours it).
  const marksByDev={};
  computed.forEach(function(c){ c.stages.forEach(function(s){ (marksByDev[c.devId]=marksByDev[c.devId]||[]).push(s.start.getTime()); }); });
  Object.keys(marksByDev).forEach(function(devId){
    marksByDev[devId].forEach(function(tMs){
      const o=deviceOccupancy(devId, tMs, computed, null);
      if(o.items.length<2) return;                 // one item can never conflict with itself
      if(!(o.over || !o.compat.tempOk)) return;
      computed.forEach(function(c){ if(c.devId!==devId) return;
        c.stages.forEach(function(s){ if(tMs>=s.start.getTime() && tMs<s.end.getTime()) c.row.contention=true; }); });
    });
  });
  return rows;
}
// Wave E5: consolidated shopping across ALL events — one trip, quantities summed, per-event breakdown.
function crossEventShopData(){
  const evs=evList(); const map={}; const woods={}, coals={};
  evs.forEach(function(ev){
    const mq=store.get('mk-menuqty-'+ev.id)||{};
    ((ev.menu&&ev.menu.keys)||[]).forEach(function(key){
      const meta=(typeof resolveItem==='function')?resolveItem(key):null; if(!meta) return;
      const c=meta.obj||{};
      // per-guest RAW quantity from the shared rawGramsFor, computed against THIS event's own menu
      // (guests/appetite/sides live in ev.menu) — never the whole-cut catalog weight (c.kg). Prefer the
      // menu-screen cache when present (same formula), else compute live so a wizard-built event is correct too.
      const kg = (mq[key]!=null ? mq[key] : rawGramsFor(meta, ev.menu)) / 1000;
      if(!map[key]) map[key]={key:key, name:meta.heb, eng:meta.eng, cat:meta.cat, totalKg:0, events:[]};
      map[key].totalKg += kg; map[key].events.push({name:ev.name, kg:kg});
      if(c.wood) String(c.wood).split('/').forEach(function(w){ w=w.trim(); if(w&&w!=='ללא') woods[w]=1; });
      if(c.coal) coals[c.coal]=1;
    });
  });
  return {items:Object.keys(map).map(function(k){return map[k];}), woods:Object.keys(woods), coals:Object.keys(coals), eventCount:evs.length};
}
function openCrossEventCart(){
  const d=crossEventShopData();
  const en = typeof getLang==='function' && getLang()!=='he';
  const kg = L('ק״ג','kg');
  if(!d.items.length){ showPanel(`${toolTop(L('רשימת קניות מאוחדת','Combined shopping list'),L('לכל האירועים יחד','For all events together'),'🛒','#4f8a3d')}<div class="panel-body"><div class="shop-empty">${L('אין פריטים באירועים עדיין.','No items in any events yet.')}</div></div>`); return; }
  const byCat={}; d.items.forEach(function(it){ (byCat[it.cat]=byCat[it.cat]||[]).push(it); });
  // key stays the stable (language-independent) label so checkbox state survives a language switch; disp is what's shown
  const xline=function(key, disp, sub){ const k='xshop:'+key; const done=store.get(k)?'done':''; return `<div class="shop-line ${done}"><span class="cbx ${done}" data-xshop="${encodeURIComponent(key)}">${done?'✓':''}</span><span>${esc(disp||key)}${sub?` <small style="color:var(--smoke)">· ${esc(sub)}</small>`:''}</span></div>`; };
  const groups=Object.keys(byCat).map(function(cat){
    return `<div class="shop-group"><h4>${esc(t(cat))}</h4>`+byCat[cat].map(function(it){
      const qty = it.totalKg? `~${it.totalKg.toFixed(1)} ${kg}` : '';
      const brk = it.events.length>1? it.events.map(function(e){return e.name+(e.kg?` ${e.kg.toFixed(1)}${kg}`:'');}).join(' + ') : '';
      const disp = (en?it.eng:`${it.name} (${it.eng})`)+(qty?' — '+qty:'');
      return xline(`${it.name} (${it.eng})${qty?' — '+qty:''}`, disp, brk);
    }).join('')+`</div>`;
  }).join('');
  const woodG = d.woods.length? `<div class="shop-group"><h4>🪵 ${L('עצים','Woods')}</h4>`+d.woods.map(function(w){return xline(w, t(w));}).join('')+`</div>` : '';
  const coalG = d.coals.length? `<div class="shop-group"><h4>⚫ ${L('פחם','Charcoal')}</h4>`+d.coals.map(function(c){return xline(c, t(c));}).join('')+`</div>` : '';
  showPanel(`${toolTop(L('רשימת קניות מאוחדת','Combined shopping list'),L('כל ','All ')+d.eventCount+L(' האירועים יחד — כמויות מסוכמות',' events together — summed quantities'),'🛒','#4f8a3d')}
    <div class="panel-body">
      <div class="kbox k-ok">${L('רשימה אחת לכל האירועים — כמויות מסוכמות עם פירוט לכל אירוע. תבלינים ותוספות ספציפיים נמצאים בעגלה של כל אירוע.','One list for all events — summed quantities with a per-event breakdown. Event-specific seasonings and sides live in each individual event cart.')}</div>
      ${groups}${woodG}${coalG}
    </div>`);
  $("#panel").querySelectorAll('[data-xshop]').forEach(function(sp){ sp.addEventListener('click',function(){
    const t=decodeURIComponent(sp.dataset.xshop), row=sp.closest('.shop-line'), done=!row.classList.contains('done');
    row.classList.toggle('done',done); sp.classList.toggle('done',done); sp.textContent=done?'✓':''; store.set('xshop:'+t,done);
  }); });
}
// shared combined-timeline body (legend + clash note + tappable rows) — used both in the panel and as the Events-screen hero
function combinedTimelineHTML(){
  const evs=evList(), rows=combinedEventsRows(), now=new Date();
  if(!rows.length) return '';
  const en=(typeof getLang==='function'&&getLang()!=='he'); const dloc=en?'en-US':'he-IL';
  const legend=evs.map(function(ev,ei){ return `<span class="cet-leg"><span class="cet-dot" style="background:${EV_COLORS[ei%EV_COLORS.length]}"></span>${esc(ev.name)} · ${ev.serve||'19:00'}${evRunningCount(ev.id)?` · 🔴 ${evRunningCount(ev.id)}`:''}</span>`; }).join('');
  let curDay=null;
  const listHtml=rows.map(function(r){ const col=EV_COLORS[r.ei%EV_COLORS.length];
    const day=isoDate(r.start); let head='';
    if(day!==curDay){ curDay=day; head=`<div class="cet-day">📅 ${esc(serveDayLabel(r.start))} · ${new Date(r.start).toLocaleDateString(dloc,{day:'numeric',month:'short'})}</div>`; }
    return `${head}<div class="cet-row ${r.start<now?'cet-past':''} ${r.contention?'cet-clash':''}" style="border-inline-start:4px solid ${col}" data-cetgo="${esc(r.ev.id)}" data-cetitem="${esc(r.key||'')}"><span class="cet-time">${fmtClock(r.start)}</span><span class="cet-body"><b>${esc(en?(r.eng||r.name):r.name)}${r.contention?' <span class="cet-warn" title="'+L('חפיפת מעשנה בין אירועים','Smoker overlap between events')+'">⚠ '+L('מעשנה','Smoker')+'</span>':''}</b><small style="color:${col}">${esc(r.ev.name)} · ${L('הגשה','Serve')} ${fmtServe(r.serve)}</small></span><span class="cet-dur">${r.totalH?(r.totalH<1?Math.round(r.totalH*60)+L('ד','m'):r.totalH.toFixed(1)+L('ש','h')):''}</span><span class="cet-go">←</span></div>`;
  }).join('');
  const clashN=rows.filter(function(r){return r.contention;}).length;
  const clashNote=clashN?`<div class="cet-clashnote">⚠ <b>${L('חפיפת מעשנה:','Smoker overlap:')}</b> ${clashN} ${L('פריטים מאירועים שונים מתוזמנים לעשן בו-זמנית. מעשנה אחת לא תספיק — פזר את שעות ההגשה או השתמש בשתי מעשנות.','items from different events are scheduled to smoke at the same time. One smoker will not be enough — stagger the serve times or use two smokers.')}</div>`:'';
  return `<div class="cet-legend">${legend}</div>${clashNote}${listHtml}`;
}
// tap a combined-timeline row → open that event's work plan, focused on the item
function _wireCetRows(container){
  if(!container) return;
  container.querySelectorAll('[data-cetgo]').forEach(function(row){ row.addEventListener('click',function(){
    const id=row.getAttribute('data-cetgo'), item=row.getAttribute('data-cetitem');
    if(typeof evLoad==='function' && !evLoad(id)) return;
    if(typeof openTimeline==='function') openTimeline(item||undefined);
  }); });
}
function openCombinedTimeline(){
  const body=combinedTimelineHTML();
  const shopBtn = evList().length? `<button class="mchip" id="cetShop" style="margin-bottom:10px">🛒 ${L('רשימת קניות מאוחדת','Combined shopping list')}</button>` : '';
  showPanel(`${toolTop(L('כל האירועים — תצוגה משולבת','All events — combined view'),L('לוח-זמנים מאוחד לאירועים מקבילים','A unified schedule for parallel events'),'🗂️','#7a5cc2')}<div class="panel-body">${shopBtn}<p class="section-sub">${L('זמני ההתחלה של כל המנות מכל האירועים, לפי השיטה שנבחרה בכל אירוע, ממוזגים לפי יום ושעה. הקש שורה כדי לפתוח את תוכנית העבודה של אותו אירוע.','Start times for every dish from every event — by the method chosen per event — merged by day and hour. Tap a row to open the work plan for that event.')}</p>${body||`<div class="shop-empty">${L('אין אירועים עם מנות עדיין.','No events with dishes yet.')}</div>`}</div>`);
  { const b=$("#cetShop"); if(b) b.addEventListener('click', openCrossEventCart); }
  _wireCetRows($("#panel"));
}
function cPaintEvents(){
  setMenuCtx('event');
  const host=$("#cEvBody"); if(!host) return;
  const list=evList().slice().sort((a,b)=>(b.updated||0)-(a.updated||0));
  const cnt=$("#cEvCount"); if(cnt) cnt.textContent=list.length?`${list.length} ${L('אירועים','events')}`:'';
  let html='';
  // draft card
  if(isDraft()){
    const m=menuState(); const n=(m.keys||[]).length;
    html+=`<div class="cscard" style="border-color:var(--fresh);background:var(--fresh-l)">
      <h4 style="color:var(--fresh)">📝 ${L('טיוטה נוכחית · לא נשמרה','Current draft · not saved')}</h4>
      <div style="font-size:13px;color:var(--ash);margin-bottom:10px">${n} ${L('מנות','dishes')} · ${m.guests||8} ${L('סועדים','guests')}</div>
      <div style="display:flex;gap:8px"><button class="ccta" id="cEvDraftSave" style="margin:0;flex:1;padding:11px;font-size:14px">💾 ${L('שמור כאירוע','Save as event')}</button>
      <button class="cwclear" id="cEvDraftDiscard">${L('מחק','Delete')}</button></div></div>`;
  }
  // active id
  const act=evActive();
  if(!list.length && !isDraft()){
    html+=`<div class="cscard"><h4>${L('אין אירועים עדיין','No events yet')}</h4><div style="font-size:13px;color:var(--smoke);line-height:1.6">${L('התחל אירוע חדש כדי לבנות תפריט ותוכנית עבודה — הכל יישמר כאן לחזרה ועריכה.','Start a new event to build a menu and work plan — everything is saved here to revisit and edit.')}</div></div>`;
  }
  html+=list.map(e=>{
    const n=((e.menu&&e.menu.keys)||[]).length;
    const isAct=(e.id===act);
    const dateStr=e.date?new Date(e.date).toLocaleDateString((getLang&&getLang()!=='he')?'en-US':'he-IL',{day:'numeric',month:'short'}):'';
    return `<div class="cevcard ${isAct?'active':''}">
      <div class="cev-main" data-evload="${e.id}">
        <div class="cev-name">${e.name}${isAct?` <span class="cev-badge">${L('פעיל','Active')}</span>`:''}${(function(){ const rc=evRunningCount(e.id); return rc?` <span class="cev-badge cev-running">🔴 ${rc} ${L('טיימרים רצים','timers running')}</span>`:(store.get('mk-plan-started-'+e.id)?` <span class="cev-badge cev-live">▶ ${L('פעילה','Live')}</span>`:''); })()}</div>
        ${e.desc?`<div class="cev-desc">${e.desc}</div>`:''}
        <div class="cev-meta">${dateStr?`📅 ${dateStr} · `:''}🍽️ ${n} ${L('מנות','dishes')} · 👥 ${e.menu&&e.menu.guests||8}${e.serve?' · ⏰ '+e.serve:''}</div>
        <div class="cev-actions">
          <button class="cev-act" data-evedit="${e.id}">✏️ ${L('ערוך','Edit')}</button>
          <button class="cev-act" data-evcart="${e.id}">🛒 ${L('קניות','Shopping')}</button>
          <button class="cev-act" data-evprint="${e.id}">🖨️ ${L('הדפס תפריט','Print menu')}</button>
        </div>
      </div>
      <button class="cev-del" data-evdel="${e.id}" title="${L('מחק','Delete')}">🗑️</button>
    </div>`;
  }).join('');
  if(list.length){
    html+=`<button class="cwclear" id="cEvDelAll" style="margin:14px auto 0;display:block">${L('מחק את כל האירועים','Delete all events')}</button>`;
    if(list.length>=2){ const hero=combinedTimelineHTML();   // multi-event command center: the combined color-coded schedule, tap a row → that event's plan
      if(hero) html=`<div class="cet-hero"><div class="cet-hero-head"><button class="cet-herotitle" id="cetFull">🗂️ ${L('לוח משולב','Combined schedule')} · ${list.length} ${L('אירועים','events')} ↗</button><button class="mchip" id="cetShopHero">🛒 ${L('קניות מאוחדות','Combined shopping')}</button></div>${hero}</div>`+html; }
  }
  host.innerHTML=html;
  // wire
  { const sh=$("#cetShopHero"); if(sh) sh.addEventListener('click',()=>openCrossEventCart()); }
  { const cf=$("#cetFull"); if(cf) cf.addEventListener('click',()=>openCombinedTimeline()); }
  if(typeof _wireCetRows==='function') _wireCetRows(host);
  const ds=$("#cEvDraftSave"); if(ds) ds.addEventListener('click',async()=>{ const nm=await appPrompt(L('שם לאירוע:','Event name:'),'',{placeholder:L('למשל: שישי במשפחה','e.g. Family Friday'),okLabel:'💾 '+L('שמור','Save')}); if(nm===null||nm===false) return; evSaveCurrent(nm||L('אירוע ללא שם','Untitled event')); cPaintEvents(); if(typeof toast==='function') toast(L('האירוע נשמר','Event saved')); });
  const dd=$("#cEvDraftDiscard"); if(dd) dd.addEventListener('click',async()=>{ if((await appConfirm(L('למחוק את הטיוטה?','Delete the draft?'),{okLabel:'🗑️ '+L('מחק','Delete'),danger:true}))!==true) return; evClearActive(); cPaintEvents(); });
  host.querySelectorAll('[data-evload]').forEach(el=>el.addEventListener('click',ev=>{
    if(ev.target.closest('[data-evdel],[data-evedit],[data-evprint],[data-evcart]')) return;
    const id=el.dataset.evload; if(evLoad(id) && typeof openTimeline==='function') openTimeline();   // tapping an event opens its work-plan (not the wizard start); edit is the ✏️ button
  }));
  host.querySelectorAll('[data-evedit]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evedit;
    if(evLoad(id)){ cwGo(0); cNavGo('wizard'); cwSyncFromMenu(); }   // explicit edit → wizard from the start
  }));
  host.querySelectorAll('[data-evcart]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evcart;
    if(evLoad(id)){ updateCartBadge&&updateCartBadge(); if(typeof openCart==='function') openCart(); }
  }));
  host.querySelectorAll('[data-evprint]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evprint;
    if(evLoad(id) && typeof openMenuPrint==='function') openMenuPrint();
  }));
  host.querySelectorAll('[data-evdel]').forEach(el=>el.addEventListener('click',ev=>{
    ev.stopPropagation(); const id=el.dataset.evdel;
    appConfirm(L('למחוק את האירוע?','Delete this event?'),{okLabel:'🗑️ '+L('מחק','Delete'),danger:true}).then(y=>{ if(y===true){ evDelete(id); cPaintEvents(); } });
  }));
  const da=$("#cEvDelAll"); if(da) da.addEventListener('click',async()=>{ if((await appConfirm(L('למחוק את כל האירועים?\nפעולה בלתי הפיכה.','Delete all events?\nThis cannot be undone.'),{okLabel:'🗑️ '+L('מחק הכל','Delete all'),danger:true}))!==true) return; if((await appConfirm(L('בטוח? כל האירועים יימחקו.','Are you sure? All events will be deleted.'),{okLabel:L('כן, מחק סופית','Yes, delete permanently'),danger:true}))!==true) return; evDeleteAll(); cPaintEvents(); });
}
// exit/cancel the wizard from any step. For an unsaved EVENT draft, offer save/discard/stay;
// otherwise just return home (a cook draft persists as the dismissible home resume card).
async function cwExitWizard(){
  const cook=(typeof menuCtx==='function'&&menuCtx()==='cook');
  const hasContent=(typeof evMenuHasContent==='function')?evMenuHasContent():false;
  if(!cook && typeof isDraft==='function' && isDraft() && hasContent){
    // 3-way: OK = save & exit, Cancel(button) = discard & exit, dismiss(×/esc) = stay
    const ans=await appConfirm(L('לצאת מאשף האירוע? יש טיוטה שלא נשמרה.','Exit the event wizard? You have an unsaved draft.'),{okLabel:'💾 '+L('שמור וצא','Save & exit'),cancelLabel:'🗑️ '+L('מחק וצא','Discard & exit')});
    if(ans===null) return;   // dismissed → stay in the wizard
    if(ans===true){ let nm=(menuState().evName||'').trim(); if(!nm){ const v=await appPrompt(L('שם לאירוע:','Event name:'),'',{placeholder:L('למשל: שישי במשפחה','e.g. Family Friday'),okLabel:'💾 '+L('שמור','Save')}); if(v===null||v===false) return; nm=v||L('אירוע ללא שם','Untitled event'); } evSaveCurrent(nm); if(typeof toast==='function') toast(L('האירוע נשמר','Event saved')); }
    else { const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0}; store.set('mk-menu',empty); try{ evClearActive(); }catch(_){}
      store.set('mk-cresume',null); if(typeof toast==='function') toast(L('הטיוטה בוטלה','Draft discarded')); }
  } else if(cook){
    // cook drafts are non-destructive — leave them; they surface as the (dismissible) resume card
    store.set('mk-cresume',null);
  }
  cwGo(0); cNavGo('home');
}
function cwSyncFromMenu(){
  // reflect loaded event into wizard step 0 fields
  const m=(typeof menuState==='function')?menuState():{};
  const nm=$("#cwEvName"); if(nm) nm.value=m.evName||'';
  const ds=$("#cwEvDesc"); if(ds) ds.value=m.evDesc||'';
  // restore: a stored date needs the real date control (a text field would show the raw ISO string)
  const dt=$("#cwEvDate"); if(dt){ if(m.evDate){ dt.type='date'; dt.value=m.evDate; } else { dt.type='text'; dt.value=''; } }
  cwPaintBasics();
}
const CPROJECTS=[
  {ic:'🌭',flag:'🇪🇸',col:'var(--ember)',cat:'נקניק מיובש',t:'צ׳וריסו ספרדי',d:'4-8 שבועות · פימנטון מעושן',key:'make-n-chorizo-esp'},
  {ic:'🥩',flag:'🇺🇸',col:'var(--beef,#c65a3f)',cat:'BBQ',t:'בריסקט 18 שעות',d:'low & slow טקסני · ליווי לילה',key:'cut-1'},
  {ic:'🥓',flag:'🇮🇹',col:'var(--terra-d)',cat:'סלומי',t:'פנצ׳טה ביתית',d:'2-3 שבועות · למתחילים',key:'make-sal-pancetta'},
];
// ── raw-material inventory (mk-inventory) ──
const INV_STARTER=[
  // — מלחי ריפוי ותרביות —
  {name:'מלח נתרני #1 (Cure #1)',unit:'גרם',low:50,grp:'ריפוי'},
  {name:'מלח נתרני #2 (Cure #2)',unit:'גרם',low:50,grp:'ריפוי'},
  {name:'תרבית T-SPX (איטית)',unit:'מנות',low:1,grp:'ריפוי'},
  {name:'תרבית F-LC (מהירה)',unit:'מנות',low:1,grp:'ריפוי'},
  // — שרוולים ומעיים (לפי קוטר) —
  {name:'מעי כבש 22 מ״מ (נקניקיות דקות)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'מעי חזיר 32 מ״מ (נקניקיות)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'מעי חזיר 36–40 מ״מ (נקניקים)',unit:'מטר',low:3,grp:'שרוולים'},
  {name:'שרוול קולגן 60 מ״מ',unit:'יח׳',low:5,grp:'שרוולים'},
  {name:'שרוול בקר 50–60 מ״מ (סלמי)',unit:'יח׳',low:3,grp:'שרוולים'},
  {name:'שרוול פיברוס 60–80 מ״מ',unit:'יח׳',low:3,grp:'שרוולים'},
  // — מלחים וסוכרים —
  {name:'מלח ים גס',unit:'גרם',low:200,grp:'מלח וסוכר'},
  {name:'מלח דק (לא-מיודד)',unit:'גרם',low:200,grp:'מלח וסוכר'},
  {name:'סוכר חום',unit:'גרם',low:100,grp:'מלח וסוכר'},
  {name:'דקסטרוז (לתסיסה)',unit:'גרם',low:100,grp:'מלח וסוכר'},
  // — תבלינים —
  {name:'פלפל שחור גס',unit:'גרם',low:50,grp:'תבלינים'},
  {name:'פפריקה מעושנת',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'כמון',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'כוסברה (זרעים)',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'שום גרנולה/אבקה',unit:'גרם',low:30,grp:'תבלינים'},
  {name:'זרעי שומר',unit:'גרם',low:20,grp:'תבלינים'},
  {name:'מיורן מיובש',unit:'גרם',low:20,grp:'תבלינים'},
  // — עצים לעישון —
  {name:'שבבי עץ אלון',unit:'ק״ג',low:1,grp:'עצים'},
  {name:'שבבי עץ תפוח/דובדבן',unit:'ק״ג',low:1,grp:'עצים'},
  {name:'שבבי עץ היקורי',unit:'ק״ג',low:1,grp:'עצים'},
];
function invList(){ const a=store.get('mk-inventory'); return Array.isArray(a)?a:null; }
function invSave(a){ store.set('mk-inventory',a); }
const INV_VER=2; // bump when INV_STARTER changes to merge new items for existing users
function invEnsure(){
  let a=invList();
  if(a===null){ a=INV_STARTER.map(x=>({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'})); invSave(a); store.set('mk-inv-ver',INV_VER); return a; }
  // one-time non-destructive merge: add any new starter items the user doesn't have yet (keeps their quantities)
  const ver=store.get('mk-inv-ver')||1;
  if(ver<INV_VER){
    const have=new Set(a.map(i=>i.name));
    INV_STARTER.forEach(x=>{ if(!have.has(x.name)) a.push({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'}); });
    // backfill missing grp on old items
    a.forEach(i=>{ if(!i.grp){ const s=INV_STARTER.find(x=>x.name===i.name); i.grp=s?s.grp:'שונות'; } });
    invSave(a); store.set('mk-inv-ver',INV_VER);
  }
  return a;
}
function invResetFull(){ store.set('mk-inventory', INV_STARTER.map(x=>({id:uid(),name:x.name,qty:0,unit:x.unit,low:x.low,grp:x.grp||'שונות'}))); store.set('mk-inv-ver',INV_VER); }

/* ═══ FEATURE 3 (R1.1) · "מה אפשר להכין ממה שיש לי" ═══
   Cross-references raw-material inventory + gear against make recipes.
   LOCAL core (works WITHOUT key) is deterministic; AI adds phrasing + "almost". */

// fuzzy match a material string against the user's in-stock inventory (qty>0)
function wcimInvHas(name, inv){
  const n=String(name||'').toLowerCase();
  return inv.some(i=>{
    if(i.qty<=0) return false;
    const iname=i.name.toLowerCase();
    const head=n.split(/[0-9(]/)[0].trim();
    return (head && iname.includes(head)) || n.includes(iname.split(' ')[0]);
  });
}
// which method(s) a make needs, and whether gear supports at least one
function wcimGearOk(meta){
  const cat=meta.cat||'', o=meta.obj||{}, b=o.build||{};
  const configured=equipConfigured();
  // sausage-family needs grinder+stuffer (soft: if gear unconfigured, assume yes)
  const isSausage=['נקניקיות','נקניק מעושן','נקניק מיובש','סלומי'].includes(cat);
  if(isSausage && configured){
    const hasGrinder=hasCat('grinder');
    const hasStuffer=hasCat('stuffer');
    if(!hasGrinder||!hasStuffer) return {ok:false, need: [!hasGrinder&&'מטחנת בשר', !hasStuffer&&'מכונת מילוי'].filter(Boolean)};
  }
  // smoked items need smoke capability
  if((cat==='נקניק מעושן'||cat==='דג מעושן'||/עישון/.test(b.intro||'')) && configured && !canSmoke())
    return {ok:false, need:['מעשנה / גריל-פחם']};
  return {ok:true, need:[]};
}
// the deterministic local engine — returns {makeable, almost}
function wcimLocal(){
  const inv=invEnsure();
  const items=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make'));
  const makeable=[], almost=[];
  items.forEach(m=>{
    const meta=(typeof resolveItem==='function')?resolveItem(m.key):m;
    const b=(meta.obj&&meta.obj.build)||{};
    const mats=(b.materials||[]).filter(x=>/מעי|שרוול|תרבית|מלח נתרני|Cure|דקסטרוז|פלפל|פפריקה|כמון|כוסברה|שום|שומר|מיורן|עץ|אלון|היקורי|תפוח|דובדבן/i.test(x));
    if(!mats.length) return; // no trackable raw materials → skip (can't assert)
    const missing=mats.filter(x=>!wcimInvHas(x,inv));
    const gear=wcimGearOk(meta);
    if(missing.length===0 && gear.ok) makeable.push({key:m.key, heb:m.heb, cat:m.cat});
    else if(gear.ok && missing.length<=2) almost.push({key:m.key, heb:m.heb, cat:m.cat, missing});
    else if(!gear.ok) { /* gear-blocked: surface in almost with gear note */ almost.push({key:m.key, heb:m.heb, cat:m.cat, missing:[], gearNeed:gear.need}); }
  });
  return {makeable, almost};
}
// build a compact grounding payload for the AI (inventory in-stock + gear caps + candidate makes)
function wcimGrounding(){
  const inv=invEnsure().filter(i=>i.qty>0).map(i=>i.name);
  const caps=[canGrill()&&'גריל',canSmoke()&&'עישון',canSV()&&'סו-ויד'].filter(Boolean);
  const tools=[hasCat('grinder')&&'מטחנה',hasCat('stuffer')&&'מילוי'].filter(Boolean);
  const cands=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make')).map(m=>({key:m.key,heb:m.heb,cat:m.cat}));
  return 'מלאי במלאי (>0): '+(inv.join(', ')||'ריק')
    +'\nיכולות בישול: '+(caps.join(', ')||'-')+' · כלים: '+(tools.join(', ')||'-')
    +'\nמתכונים אפשריים (בחר keys מכאן בלבד):\n'+cands.map(c=>`${c.key} · ${c.heb} (${c.cat})`).join('\n');
}
async function wcimAI(){
  const grounding=wcimGrounding();
  const schema='{"makeable":[{"key":"<key>","note":"<קצר>"}],"almost":[{"key":"<key>","missing":["<פריט>"]}]}';
  const task='על סמך המלאי, היכולות והכלים — אילו מתכונים אפשר להכין עכשיו (makeable) ואילו כמעט (חסר 1-2 פריטים, almost)? השתמש אך ורק ב-keys מהרשימה.';
  const raw=await aiJSON({task, schemaHint:schema, grounding, temperature:0.3, maxTokens:1400});
  // GROUNDING ENFORCEMENT: drop any key not in catalog
  const mk=aiValidateItems(raw&&raw.makeable).kept;
  const al=aiValidateItems(raw&&raw.almost).kept;
  return {makeable:mk, almost:al};
}

/* ── Feature 3 UI: panel + button ── */
function wcimRowHTML(o){
  const meta=(typeof resolveItem==='function')?resolveItem(o.key):null;
  const emoji=meta?itemEmoji(o.cat,o.key):'🍖';
  const miss=(o.missing&&o.missing.length)?`<div class="wcim-miss">${L('חסר','Missing')}: ${o.missing.map(x=>t(x)).join(' · ')}</div>`:'';
  const gearn=(o.gearNeed&&o.gearNeed.length)?`<div class="wcim-miss">${L('דורש','Requires')}: ${o.gearNeed.map(x=>t(x)).join(' · ')}</div>`:'';
  const note=o.note?`<div class="pp-desc">${esc(o.note)}</div>`:'';
  return `<button class="pp-item" data-wcimkey="${o.key}">
    <div class="pp-item-h"><span class="pp-emoji">${emoji}</span><b>${(typeof itemName==='function'&&meta?itemName(meta):o.heb)}</b><span class="pp-diff" style="color:var(--smoke)">${t(o.cat)}</span></div>
    ${note}${miss}${gearn}</button>`;
}
function wcimRender(res, aiUsed){
  const {makeable,almost}=res;
  let body=aiUsed?`<div class="ai-badge">✨ ${L('הועשר בעזרת AI','Enriched by AI')}</div>`:'';
  body+=`<div class="pp-desc" style="margin-bottom:12px">${L('מבוסס על חומרי-המדף במזווה (שרוולים, מלחי-ריפוי, תבלינים, עצים) והציוד שלך. בשר טרי נרכש בנפרד לכל מלאכה.','Based on your pantry materials (casings, cure salts, spices, woods) and your gear. Fresh meat is bought separately for each craft.')}</div>`;
  body+=`<div class="pp-group"><div class="pp-gh">✅ ${L('אפשר להכין עכשיו','Can make now')} <span style="color:var(--smoke);font-weight:400">· ${makeable.length}</span></div>`;
  body+= makeable.length?makeable.map(wcimRowHTML).join(''):`<div class="shop-empty">${L('אין פריט שכל חומריו וציודו זמינים כרגע. עדכן כמויות במזווה או הוסף רכיבים.','No item has all materials and gear available right now. Update pantry quantities or add ingredients.')}</div>`;
  body+=`</div>`;
  if(almost.length){
    body+=`<div class="pp-group"><div class="pp-gh">🛒 ${L('כמעט — חסר מעט','Almost — missing a little')} <span style="color:var(--smoke);font-weight:400">· ${almost.length}</span></div>`;
    body+= almost.map(wcimRowHTML).join('');
    body+=`</div>`;
  }
  showPanel(`${toolTop(L('מה אפשר להכין','What can I make'),L('ממה שיש במזווה ובציוד שלך','From what is in your pantry and gear'),'🍳','#1a9a7a')}
    <div class="panel-body" id="wcimBody">${body}</div>`);
  const host=$("#wcimBody"); if(host) host.querySelectorAll('[data-wcimkey]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.wcimkey); if(meta){ if(meta.key.startsWith('make-')) openMake(meta.key.replace(/^make-/,'')); else openProjectWizard(meta); }
  }));
}
async function openWhatCanIMake(){
  const local=wcimLocal();               // deterministic base — always computed
  if(!aiAvail()){ wcimRender(local,false); return; }
  wcimRender(local,false);               // show local immediately
  const b=$("#wcimBody"); if(b) b.insertAdjacentHTML('afterbegin',`<div class="wcim-loading" style="color:var(--fresh);font-size:13px;margin-bottom:8px">✨ ${L('מחשב עם AI…','Computing with AI…')}</div>`);
  try{
    const ai=await wcimAI();
    const aiKeys=new Set(ai.makeable.map(o=>o.key));
    const mergedMakeable=[...ai.makeable, ...local.makeable.filter(o=>!aiKeys.has(o.key))];
    const mergedAlmost=ai.almost.length?ai.almost:local.almost;
    wcimRender({makeable:mergedMakeable, almost:mergedAlmost}, true);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין כרגע — מציג חישוב מקומי');
    wcimRender(local,false);
  }
}

/* ── Feature 2 UI: pantry advisor (backward planning) ── */
function padvRowHTML(r){
  const meta=(typeof resolveItem==='function')?resolveItem(r.key):null;
  const emoji=meta?itemEmoji(r.cat,r.key):'🧫';
  const late=r.startBy && daysBetween(today(),r.startBy)<0;
  const _loc=(getLang&&getLang()!=='he')?'en-US':'he-IL';
  const startTxt = late ? L('להתחיל היום (כבר בפיגור)','Start today (already behind)') : (L('להתחיל עד','Start by')+' '+(new Date(r.startBy).toLocaleDateString(_loc,{day:'numeric',month:'short'})));
  const reason=r.reason?`<div class="pp-desc">${r.reason}</div>`:'';
  return `<button class="pp-item" data-padvkey="${r.key}">
    <div class="pp-item-h"><span class="pp-emoji">${emoji}</span><b>${(typeof itemName==='function'&&meta?itemName(meta):r.heb)}</b><span class="pp-diff" style="color:var(--smoke)">${t(r.cat)}</span></div>
    <div class="padv-when ${late?'late':''}">⏱️ ${startTxt} · ${L('משך','duration')} ~${r.days} ${L('ימים','days')}</div>${reason}</button>`;
}
function padvRender(data, aiUsed){
  const {targetDate, daysLeft}=data;
  const rows = aiUsed ? data.recommend : data.feasible;
  const warnings = aiUsed ? (data.warnings||[]) : (data.tooLate||[]).slice(0,5).map(tt=>`${(typeof itemName==='function'&&resolveItem(tt.key)?itemName(resolveItem(tt.key)):tt.heb)} ${L('דורש','needs')} ~${tt.days} ${L('ימים — לא יספיק עד היעד.','days — will not make the target.')}`);
  const _loc2=(getLang&&getLang()!=='he')?'en-US':'he-IL';
  const dstr=new Date(targetDate).toLocaleDateString(_loc2,{weekday:'long',day:'numeric',month:'long'});
  let body=aiUsed?'<div class="ai-badge">✨ הועשר ע\u05f4י AI</div>':'';
  body+=`<div class="padv-target">🎯 ${L('יעד','Target')}: <b>${dstr}</b> · ${L('בעוד','in')} ${daysLeft} ${L('ימים','days')}</div>`;
  body+=`<div class="pp-desc" style="margin:8px 0 14px">${L('משכי-הייצור מחושבים מנתוני האפליקציה. התחל את הארוכים ראשונים.','Production durations are computed from the app data. Start the longest ones first.')}</div>`;
  body+=`<div class="pp-group"><div class="pp-gh">${aiUsed?'✨ '+L('מומלץ להתחיל','Recommended to start'):'📋 '+L('אפשר להספיק','Can finish in time')} <span style="color:var(--smoke);font-weight:400">· ${rows.length}</span></div>`;
  body+= rows.length?rows.map(padvRowHTML).join(''):`<div class="shop-empty">${L('אין מלאכה שניתן להשלים עד התאריך הזה.','No craft can be completed by this date.')}</div>`;
  body+=`</div>`;
  if(warnings.length){
    body+=`<div class="pp-group"><div class="pp-gh" style="color:var(--ember)">⚠️ ${L('לא יספיק בזמן','Will not make it in time')}</div>`;
    body+= warnings.map(w=>`<div class="wcim-miss" style="padding:6px 2px">${w}</div>`).join('');
    body+=`</div>`;
  }
  showPanel(`${toolTop(L('יועץ תזמון','Scheduling advisor'),L('מה להתחיל מתי כדי לעמוד בתאריך','What to start when to hit the date'),'🗓️','#1a9a7a')}
    <div class="panel-body" id="padvBody">
      <div class="padv-daterow"><label>${L('תאריך היעד:','Target date:')}</label><input type="date" id="padvDate" value="${targetDate}" min="${today()}"></div>
      <div id="padvResult">${body}</div>
    </div>`);
  const di=$("#padvDate"); if(di) di.addEventListener('change',()=>runPantryAdvisor(di.value));
  const host=$("#padvResult"); if(host) host.querySelectorAll('[data-padvkey]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.padvkey); if(meta) openProjectWizard(meta);
  }));
}
async function runPantryAdvisor(targetDate){
  const local=pantryAdvisorLocal(targetDate);
  if(!aiAvail()){ padvRender(local,false); return; }
  padvRender(local,false);
  const r=$("#padvResult"); if(r) r.insertAdjacentHTML('afterbegin','<div class="wcim-loading" style="color:var(--fresh);font-size:13px;margin-bottom:8px">✨ מחשב עם AI…</div>');
  try{
    const ai=await pantryAdvisorAI(targetDate);
    padvRender(Object.assign({targetDate:local.targetDate, daysLeft:local.daysLeft}, ai), true);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין כרגע — מציג תזמון מקומי');
    padvRender(local,false);
  }
}
function openPantryAdvisor(){ runPantryAdvisor(addDays(today(),14)); }   // default: 2 weeks out

/* ═══ FEATURE 1 (R1.3) · מתכנן-אירוע בשפה חופשית ═══
   Free-text → validated event menu, loaded into the wizard. */
function evNameSets(){
  return {
    sides:(typeof SIDES!=='undefined'?SIDES.map(s=>s.n):[]),
    drinks:(typeof DRINKS!=='undefined'?DRINKS.map(s=>s.n):[]),
    desserts:(typeof DESSERTS!=='undefined'?DESSERTS.map(s=>s.n):[])
  };
}
function eventPlanGrounding(){
  // catalog mains grouped by category, with kosher status (for the kosher guard)
  const items=cwAllItems();
  const byCat={};
  items.forEach(m=>{ (byCat[m.cat]=byCat[m.cat]||[]).push(m); });
  const cat=Object.entries(byCat).map(([c,list])=>`【${c}】\n`+list.map(m=>`  ${m.key} · ${m.heb} [${(typeof kosherStatus==='function')?kosherStatus(m.key):'kosher'}]`).join('\n')).join('\n');
  const ns=evNameSets();
  return 'קטלוג המנות (בחר keys מכאן בלבד; בסוגריים סטטוס כשרות):\n'+cat
    +'\n\nתוספות אפשריות: '+ns.sides.join(' · ')
    +'\nמשקאות אפשריים: '+ns.drinks.join(' · ')
    +'\nקינוחים אפשריים: '+ns.desserts.join(' · ');
}
async function aiPlanEvent(prompt){
  const grounding=eventPlanGrounding();
  const schema='{"guests":<מספר>,"appetite":"light|reg|heavy","kosher":<true|false>,"keys":["<key>"],"sides":["<שם>"],"drinks":["<שם>"],"desserts":["<שם>"],"rationale":"<נימוק קצר לבחירות>"}';
  const task='בנה תפריט אירוע מאוזן לפי הבקשה: "'+prompt+'". בחר מנות עיקריות (keys מהקטלוג בלבד), תוספות, משקאות וקינוחים מהרשימות. אזן בין סוגי בשר/צומח. אם התבקשה כשרות או "בלי חזיר" — אל תכלול פריטים לא-כשרים/חזיר. החזר מספר סועדים ותיאבון סביר.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1500});
  const wantKosher = !!(raw&&raw.kosher) || /כשר|בלי חזיר|ללא חזיר/.test(prompt);
  let keys=aiValidateKeys(raw&&raw.keys).kept;
  if(wantKosher && typeof isKosherOk==='function') keys=keys.filter(k=>isKosherOk(k));   // drop pork/shellfish/blood
  const ns=evNameSets();
  const filt=(arr,valid)=>[...new Set((Array.isArray(arr)?arr:[]).filter(x=>valid.includes(x)))];
  return {
    guests: Math.max(1, Math.min(200, parseInt(raw&&raw.guests,10)||8)),
    appetite: ['light','reg','heavy'].includes(raw&&raw.appetite)?raw.appetite:'reg',
    kosher: wantKosher,
    keys,
    sides: filt(raw&&raw.sides, ns.sides),
    drinks: filt(raw&&raw.drinks, ns.drinks),
    desserts: filt(raw&&raw.desserts, ns.desserts),
    rationale: (raw&&typeof raw.rationale==='string')?raw.rationale.slice(0,400):''
  };
}
function evPlanPreviewHTML(plan){
  const appName={light:'קל',reg:'רגיל',heavy:'כבד'}[plan.appetite]||'רגיל';
  const mains=plan.keys.map(k=>{ const m=resolveItem(k); return m?`<div class="pp-item" style="cursor:default"><div class="pp-item-h"><span class="pp-emoji">${itemEmoji(m.cat,k)}</span><b>${m.heb}</b><span class="pp-diff" style="color:var(--smoke)">${m.cat}</span></div></div>`:''; }).join('');
  const chips=(arr,label)=>arr.length?`<div style="margin-top:8px"><b style="font-size:12px;color:var(--smoke)">${label}:</b> ${arr.join(' · ')}</div>`:'';
  return `${plan.rationale?`<div class="pp-desc" style="margin-bottom:12px;font-size:13px">💡 ${esc(plan.rationale)}</div>`:''}
    <div class="padv-target">👥 ${plan.guests} סועדים · תיאבון ${appName}${plan.kosher?' · ✡️ כשר':''}</div>
    <div class="pp-group" style="margin-top:12px"><div class="pp-gh">🍖 מנות עיקריות · ${plan.keys.length}</div>${mains||'<div class="shop-empty">לא נבחרו מנות עיקריות.</div>'}</div>
    ${chips(plan.sides,'🥗 תוספות')}${chips(plan.drinks,'🥤 משקאות')}${chips(plan.desserts,'🍮 קינוחים')}`;
}
function evPlanApply(plan){
  setMenuCtx&&setMenuCtx('event');
  const s=menuState();
  s.guests=plan.guests; s.appetite=plan.appetite; s.kosher=plan.kosher;
  s.keys=[...new Set(plan.keys)]; s.sides=plan.sides; s.drinks=plan.drinks; s.desserts=plan.desserts;
  saveMenu(s);
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('wizard');
  if(typeof cwSyncFromMenu==='function') cwSyncFromMenu();
  if(typeof cwGo==='function') cwGo(5);   // jump to review step
  if(typeof toast==='function') toast('התפריט נטען לאשף — סקור וערוך ✓');
}
async function evPlanRun(prompt){
  if(!prompt||!prompt.trim()){ if(typeof toast==='function') toast('כתוב מה לתכנן'); return; }
  showPanel(`${toolTop('מתכנן האירוע','✨ בונה תפריט…','✨','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ בונה תפריט מאוזן…</div></div>`);
  try{
    const plan=await aiPlanEvent(prompt.trim());
    if(!plan.keys.length){ showPanel(`${toolTop('מתכנן האירוע','לא נמצאו מנות','✨','#1a9a7a')}<div class="panel-body"><div class="shop-empty">לא הצלחתי לבנות תפריט מהבקשה. נסה לנסח אחרת (למשל: "מנגל בשרי ל-10 בלי חזיר").</div><button class="ccta" id="evpRetry">← נסה שוב</button></div>`);
      const rb=$("#evpRetry"); if(rb) rb.addEventListener('click',openEventPlanner); return; }
    aiConfirmPanel({ title:'תפריט מוצע', sub:'✨ נוצר ע\u05f4י AI · טען לאשף לעריכה', bodyHTML:evPlanPreviewHTML(plan), applyLabel:'✓ טען לאשף', onApply:()=>evPlanApply(plan) });
  }catch(e){
    showPanel(`${toolTop('מתכנן האירוע','שגיאה','✨','#1a9a7a')}<div class="panel-body"><div class="shop-empty">${/no-key/.test(e.message)?'צריך מפתח AI לתכנון אוטומטי.':'ה-AI לא זמין כרגע. נסה שוב או תכנן ידנית באשף.'}</div><button class="ccta" id="evpRetry">← חזרה</button></div>`);
    const rb=$("#evpRetry"); if(rb) rb.addEventListener('click',openEventPlanner);
  }
}
function openEventPlanner(){
  if(!aiAvail()){
    showPanel(`${toolTop(L('מתכנן האירוע (AI)','Event planner (AI)'),L('דורש מפתח Gemini אישי','Requires a personal Gemini key'),'✨','#1a9a7a')}<div class="panel-body">
      <div class="pp-desc" style="margin-bottom:14px">${L('תכנון-אירוע אוטומטי בשפה חופשית זמין עם חיבור AI. בלי זה — אפשר לבנות אירוע ידנית באשף.','Automatic free-language event planning is available with an AI connection. Without it — you can build an event manually in the wizard.')}</div>
      <button class="ccta" id="evpConnect">🔑 ${L('חבר AI','Connect AI')}</button>
      <button class="akc-back" id="evpManual" style="margin-top:8px">${L('בנה ידנית באשף ←','Build manually in the wizard →')}</button></div>`);
    const c=$("#evpConnect"); if(c) c.addEventListener('click',()=>{ if(typeof askConnect==='function') askConnect(); });
    const m=$("#evpManual"); if(m) m.addEventListener('click',()=>{ if(typeof cStartNewEvent==='function') cStartNewEvent(); });
    return;
  }
  const examples=getLang()==='he'?['מנגל בשרי ל-10 בלי חזיר','אסאדו חגיגי ל-6, תקציב בינוני','ערב עישון אמריקאי ל-8','אירוח כשר ל-12 עם דגים']:['Meaty grill for 10, no pork','Festive asado for 6, medium budget','American smoke night for 8','Kosher hosting for 12 with fish'];
  showPanel(`${toolTop(L('מתכנן האירוע','Event planner'),L('תאר את האירוע — ואבנה תפריט','Describe the event — and I will build a menu'),'✨','#1a9a7a')}<div class="panel-body">
    <div class="ai-badge">✨ ${L('מופעל בעזרת AI','Powered by AI')}</div>
    <textarea id="evpPrompt" placeholder="${L('למשל: מנגל בשרי ל-10 אנשים, בלי חזיר, כולל תוספות ומשקאות','e.g. a meaty grill for 10 people, no pork, including sides and drinks')}" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-evpex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="evpGo">✨ ${L('בנה תפריט','Build menu')}</button></div>`);
  const ta=$("#evpPrompt");
  $("#panel").querySelectorAll('[data-evpex]').forEach(c=>c.addEventListener('click',()=>{ if(ta){ ta.value=c.dataset.evpex; } }));
  const go=$("#evpGo"); if(go) go.addEventListener('click',()=>evPlanRun(ta?ta.value:''));
}

/* ═══ FEATURE 4 (R2.1) · תיבול מותאם-פריט (AI) ═══
   AI picks from the REAL seasoning library for this cut+method, explains why.
   Degrades to recsFor. Saved as context-scoped instance (never mutates template). */
function aiValidateSeasonings(ids, cat, isProd){
  const valid=new Set((typeof seasoningsFor==='function'?seasoningsFor(cat,isProd):[]).map(s=>s.id));
  const kept=[], dropped=[]; const seen=new Set();
  (Array.isArray(ids)?ids:[]).forEach(id=>{ if(valid.has(id)&&!seen.has(id)){ seen.add(id); kept.push(id); } else dropped.push(id); });
  if(dropped.length && typeof console!=='undefined') console.warn('[AI] dropped invalid seasonings:',dropped);
  return {kept, dropped};
}
function seasonRecGrounding(meta, cat, isProd){
  const all=(typeof seasoningsFor==='function')?seasoningsFor(cat,isProd):[];
  const list=all.map(s=>`${s.id} · ${s.heb} [${s.kind}${s.heat?' · חריף '+s.heat:''}${s.cont?' · '+s.cont:''}]`).join('\n');
  const itemLine=meta?`הפריט: ${meta.heb} (${cat})`:`קטגוריה: ${cat}`;
  return itemLine+'\n\nמתבלים תקפים (בחר id מכאן בלבד):\n'+list;
}
async function aiSeasonRec(key, cat, isProd){
  const meta=(typeof resolveItem==='function'&&key)?resolveItem(key):null;
  const grounding=seasonRecGrounding(meta, cat, isProd);
  const schema='{"recommend":[{"id":"<id>","reason":"<קצר: למה מתאים>"}]}';
  const task='המלץ על 3-5 מתבלים/רטבים שמתאימים במיוחד ל'+(meta?meta.heb:cat)+'. גוון בין ראב/מרינדה/רוטב/גלייז אם רלוונטי. הסבר בקצרה למה כל אחד מתאים (טעם, מסורת, איזון). בחר id מהרשימה בלבד.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1000});
  const recs=Array.isArray(raw&&raw.recommend)?raw.recommend:[];
  const validIds=aiValidateSeasonings(recs.map(r=>r.id), cat, isProd).kept;
  const validSet=new Set(validIds);
  return recs.filter(r=>validSet.has(r.id)).map(r=>{ const s=seasoningById(r.id); return {id:r.id, heb:s?s.heb:r.id, kind:s?s.kind:'', origin:s?s.origin:'', reason:(typeof r.reason==='string')?r.reason.slice(0,200):''}; });
}
function seasonRecRender(key, cat, isProd, recs, backFn){
  const rows=recs.map(r=>{
    const s=seasoningById(r.id); if(!s) return '';
    const sel=(selectedSeasonings(key)||[]).includes(r.id);
    return `<div class="pp-item" style="cursor:default">
      <div class="pp-item-h"><span class="pp-emoji">${(typeof KIND_EMOJI!=='undefined'&&KIND_EMOJI[s.kind])||'🧂'}</span><b>${s.heb}</b>${s.origin?`<span class="pp-diff" style="color:var(--smoke)">${s.origin}</span>`:''}</div>
      ${r.reason?`<div class="pp-desc">${esc(r.reason)}</div>`:''}
      <button class="cev-act" data-seasadd="${r.id}" data-seaskind="${s.kind}" style="margin-top:6px;background:${sel?'var(--fresh-l)':'none'};border:1px solid var(--fresh);color:var(--fresh)">${sel?'✓ נבחר':'＋ הוסף למופע'}</button>
    </div>`;
  }).join('');
  if(typeof panelStack!=='undefined' && backFn) panelStack.push(backFn);
  showPanel(`${toolTop('תיבול מומלץ','✨ נבחר עבור '+((resolveItem(key)||{}).heb||cat),'✨','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI</div>
      ${rows||'<div class="shop-empty">לא נמצאה המלצה. נסה את הבורר הידני.</div>'}
    </div>`);
  $("#panel").querySelectorAll('[data-seasadd]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.seasadd, kind=b.dataset.seaskind;
    const cur=selectedSeasonings(key)||[];
    cwApplySeasKind(key, kind, cur.includes(id)?'':id);
    const nowSel=(selectedSeasonings(key)||[]).includes(id);
    b.textContent=nowSel?'✓ נבחר':'＋ הוסף למופע'; b.style.background=nowSel?'var(--fresh-l)':'none';
    if(typeof toast==='function') toast(nowSel?'נוסף למופע ✓':'הוסר מהמופע');
  }));
}
async function openSeasonRecAI(key, cat, isProd, backFn){
  if(!aiAvail()){
    // graceful: local recsFor (the ⭐ tab already exists); just toast + no-op here
    if(typeof toast==='function') toast('המלצות AI דורשות מפתח — משתמש בבורר "⭐ מומלצים"');
    return;
  }
  showPanel(`${toolTop('תיבול מומלץ','✨ בוחר מתבלים…','✨','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מחפש התאמות…</div></div>`);
  try{
    const recs=await aiSeasonRec(key, cat, isProd);
    seasonRecRender(key, cat, isProd, recs, backFn);
  }catch(e){
    if(typeof toast==='function') toast('AI לא זמין — נסה את הבורר הידני');
    if(backFn) backFn(); else if(typeof closePanel==='function') closePanel();
  }
}

/* ═══ FEATURE 5 (R2.2) · אבחון-תקלות אישי (AI) ═══
   Free-text symptom → diagnosis grounded in the 41 canned solutions + journal/projects. */
function troubleIndex(){
  const out=[];
  (typeof TROUBLE_GROUPS!=='undefined'?TROUBLE_GROUPS:[]).forEach((g,gi)=>g.items.forEach((t,i)=>out.push({id:gi+'-'+i, title:t[0], body:t[1], group:g.g, ic:g.ic})));
  return out;
}
function diagnoseGrounding(problem){
  const idx=troubleIndex();
  const sols=idx.map(s=>`${s.id} · ${s.title}`).join('\n');
  const jrn=(typeof journal==='function'?journal():[]).slice(0,5).map(e=>`${e.name||e.key||''}${e.temp?' · '+e.temp:''}${e.rating?' · דירוג '+e.rating:''}`).filter(Boolean);
  const proj=(typeof pantry==='function'?pantry():[]).slice(0,6).map(p=>`${p.name} (${p.type||'?'})`);
  return 'תיאור התקלה: '+problem
    +(jrn.length?'\n\nבישולים אחרונים ביומן:\n'+jrn.join('\n'):'')
    +(proj.length?'\n\nפרויקטים פעילים:\n'+proj.join('\n'):'')
    +'\n\nפתרונות קיימים באפליקציה (הפנה אליהם ב-related לפי id):\n'+sols;
}
async function aiDiagnose(problem){
  const grounding=diagnoseGrounding(problem);
  const schema='{"diagnosis":"<אבחון קצר>","causes":["<סיבה>"],"fixes":["<פעולה מעשית>"],"related":["<id מרשימת הפתרונות>"]}';
  const task='אבחן את התקלה על סמך התיאור וההקשר האישי. תן אבחון קצר, סיבות אפשריות, ופעולות מתקנות מעשיות. הפנה ב-related ל-id של הפתרונות הרלוונטיים מהרשימה. אל תמציא מספרי טמפ׳/בטיחות — הסתמך על הפתרונות הקיימים.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.4,maxTokens:1100});
  const idx=troubleIndex(); const validIds=new Set(idx.map(s=>s.id));
  const related=[...new Set((Array.isArray(raw&&raw.related)?raw.related:[]).filter(id=>validIds.has(id)))].map(id=>idx.find(s=>s.id===id));
  const arr=x=>Array.isArray(x)?x.filter(s=>typeof s==='string').slice(0,6):[];
  return {
    diagnosis:(raw&&typeof raw.diagnosis==='string')?raw.diagnosis.slice(0,500):'',
    causes:arr(raw&&raw.causes), fixes:arr(raw&&raw.fixes), related
  };
}
function diagnoseRender(problem, res){
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  const anchors=res.related.map(s=>`<div class="acc" style="margin-top:8px"><div class="acc-q" style="cursor:default">${s.ic} ${s.title}</div><div class="acc-a" style="max-height:none;padding:10px 14px">${s.body}</div></div>`).join('');
  showPanel(`${toolTop('אבחון אישי','✨ נוצר ע\u05f4י AI','🩺','#a8392f')}
    <div class="panel-body">
      <div class="ai-badge">✨ אבחון AI · מבוסס על הפתרונות המאומתים באפליקציה</div>
      <div class="pp-desc" style="margin-bottom:10px">❓ ${problem}</div>
      ${res.diagnosis?`<div class="padv-target" style="background:var(--char2)">🩺 ${esc(res.diagnosis)}</div>`:''}
      ${res.causes.length?`<div class="pp-group"><div class="pp-gh">סיבות אפשריות</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.causes)}</ul></div>`:''}
      ${res.fixes.length?`<div class="pp-group"><div class="pp-gh">מה לעשות</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.fixes)}</ul></div>`:''}
      ${res.related.length?`<div class="pp-group"><div class="pp-gh">📖 פתרונות מאומתים רלוונטיים</div>${anchors}</div>`:''}
      ${aiSafetyCaveat((res.diagnosis||'')+' '+(res.causes||[]).join(' ')+' '+(res.fixes||[]).join(' '))}
      <button class="akc-back" id="diagFull" style="margin-top:14px">📋 כל התקלות (מצב הצילו) ←</button>
    </div>`);
  const fb=$("#diagFull"); if(fb) fb.addEventListener('click',()=>{ if(typeof openHelp==='function') openHelp(); });
}
async function runDiagnose(problem){
  if(!problem||!problem.trim()){ if(typeof toast==='function') toast('תאר את התקלה'); return; }
  showPanel(`${toolTop('אבחון אישי','✨ מאבחן…','🩺','#a8392f')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מאבחן את התקלה…</div></div>`);
  try{ diagnoseRender(problem.trim(), await aiDiagnose(problem.trim())); }
  catch(e){
    if(typeof toast==='function') toast('AI לא זמין — פותח את מצב הצילו');
    if(typeof openHelp==='function') openHelp();
  }
}
function openDiagnoseAI(){
  const examples=[L('הנקניק יצא יבש ופריך','The sausage came out dry and crumbly'),L('העשן יצא מר','The smoke came out bitter'),L('הבשר נתקע ב-68 מעלות','The meat stalled at 68 degrees'),L('עובש לבן על הסלמי','White mold on the salami'),L('הגבינה לא נמסה','The cheese did not melt')];
  showPanel(`${toolTop(L('אבחון תקלה אישי','Personal troubleshooting'),L('תאר מה קרה — ואאבחן','Describe what happened — and I will diagnose'),'🩺','#a8392f')}<div class="panel-body">
    <div class="ai-badge">✨ ${L('מופעל ע\u05f4י AI · לוקח בחשבון את היומן והפרויקטים שלך','Powered by AI · takes your journal and projects into account')}</div>
    <textarea id="diagPrompt" placeholder="${L('למשל: עישנתי חזה אבל יצא יבש וקשה, למרות שהגעתי לטמפ׳','e.g. I smoked a brisket but it came out dry and tough, even though I hit the target temp')}" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-diagex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="diagGo">✨ ${L('אבחן','Diagnose')}</button></div>`);
  const ta=$("#diagPrompt");
  $("#panel").querySelectorAll('[data-diagex]').forEach(c=>c.addEventListener('click',()=>{ if(ta) ta.value=c.dataset.diagex; }));
  const go=$("#diagGo"); if(go) go.addEventListener('click',()=>runDiagnose(ta?ta.value:''));
}

/* ═══ FEATURE 6 (R3.1) · מחולל-מתכון → פרויקט (AI) ═══
   AI writes the creative parts (intro/materials/phases). SAFETY NUMBERS
   (salt/cure calc) come from APP presets, NOT the AI (P3). Marked unverified. */
function umakes(){ return store.get('mk-umakes')||{}; }
function saveUmakes(o){ store.set('mk-umakes',o); }
// APP-SUPPLIED safe cure/salt presets by product type (NEVER from AI)
const UMAKE_CALC={
  fresh:  {salt:18, cure:null, sugar:0,  water:10, brine:false, saltL:0, cureL:0, sugarL:0},   // fresh sausage
  cooked: {salt:18, cure:'1',  cureRate:2.5, sugar:5, water:10, brine:false, saltL:0, cureL:0, sugarL:0}, // cooked/smoked (cure#1 156ppm)
  dried:  {salt:28, cure:'2',  cureRate:2.5, sugar:3, water:0,  brine:false, saltL:0, cureL:0, sugarL:0},  // dry-cured (cure#2)
  shawarma:{salt:16, cure:null, sugar:0, water:5, brine:false, saltL:0, cureL:0, sugarL:0},    // marinated fresh, cooked same-day
  kofta:  {salt:15, cure:null, sugar:0,  water:5,  brine:false, saltL:0, cureL:0, sugarL:0}    // ground kebab/kofta, fresh
};
const UMAKE_CAT={fresh:'נקניקיות', cooked:'נקניק מעושן', dried:'נקניק מיובש', shawarma:'שווארמה', kofta:'צלייה טחונה'};
function umakeGrounding(){
  const cats=Object.keys(UMAKE_CAT).map(t=>`${t} → ${UMAKE_CAT[t]}`).join(' · ');
  return 'מבנה מתכון-בנייה: intro (תיאור קצר), materials (רשימת חומרים וציוד), phases (שלבים: title + body). '
    +'סוגי מוצר אפשריים (type): '+cats+'. '
    +'בחר את הסוג המתאים: נקניקיות טריות=fresh, נקניק מעושן=cooked, נקניק מיובש=dried, שווארמה/מרינדה=shawarma, קבב/קופתה/מיצי טחונים=kofta. '
    +'חשוב: אל תכלול מספרי מלח/ניטריט/ריפוי — האפליקציה מחשבת אותם לפי הסוג. תאר שלבים איכותיים ומדויקים.';
}
function umakeValidateStructure(raw, type){
  // strict structure validation — reject malformed
  if(!raw||typeof raw!=='object') return null;
  const name=(typeof raw.name==='string'&&raw.name.trim())?raw.name.trim().slice(0,60):null;
  if(!name) return null;
  const t=Object.keys(UMAKE_CALC).includes(raw.type)?raw.type:(Object.keys(UMAKE_CALC).includes(type)?type:'fresh');
  const materials=Array.isArray(raw.materials)?raw.materials.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,120)).slice(0,20):[];
  const phasesRaw=Array.isArray(raw.phases)?raw.phases:[];
  const phases=phasesRaw.map((p,i)=>{
    const title=(p&&typeof p.title==='string'&&p.title.trim())?p.title.trim().slice(0,60):('שלב '+(i+1));
    const body=(p&&typeof p.body==='string')?p.body.trim().slice(0,400):'';
    return body?[title,body,0]:null;
  }).filter(Boolean).slice(0,14);
  if(phases.length<2) return null;   // need a real procedure
  const intro=(typeof raw.intro==='string')?raw.intro.trim().slice(0,300):'';
  return {name, type:t, intro, materials, phases};
}
async function aiGenerateRecipe(prompt){
  const grounding=umakeGrounding();
  const schema='{"name":"<שם>","type":"fresh|cooked|dried","intro":"<תיאור קצר>","materials":["<חומר>"],"phases":[{"title":"<כותרת>","body":"<הסבר>"}]}';
  const task='כתוב מתכון בנייה-מאפס לפי הבקשה: "'+prompt+'". תן שם, סוג מוצר, תיאור, רשימת חומרים וציוד, ושלבי הכנה מפורטים ואיכותיים. אל תציין מספרי מלח/ריפוי — האפליקציה תוסיף מחשבון בטוח.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.6,maxTokens:1600});
  const v=umakeValidateStructure(raw, raw&&raw.type);
  if(!v) throw new Error('bad-structure');
  // ASSEMBLE with APP-SUPPLIED safe calc — never from AI
  const build={intro:v.intro||v.name, calc:Object.assign({}, UMAKE_CALC[v.type]), materials:v.materials, phases:v.phases,
    store:'🧊 מתכון שנוצר ע\u05f4י AI — אמת מספרי בטיחות מול מקור מהימן לפני ייצור.'};
  return {heb:v.name, cat:UMAKE_CAT[v.type], type:v.type, build, ai:true, unverified:true, diff:2};
}
function umakeSave(rec){
  const id='umake-'+uid();
  const o=umakes(); o[id]=rec; saveUmakes(o);
  return id;
}
function umakePreviewHTML(rec){
  const mats=rec.build.materials.length?`<div class="pp-group"><div class="pp-gh">חומרים וציוד</div><ul style="margin:0;padding-inline-start:20px;font-size:13px;line-height:1.7;color:var(--bone)">${rec.build.materials.map(m=>`<li>${m}</li>`).join('')}</ul></div>`:'';
  const phases=`<div class="pp-group"><div class="pp-gh">שלבים · ${rec.build.phases.length}</div>${rec.build.phases.map((p,i)=>`<div class="acc" style="margin-top:6px"><div class="acc-q" style="cursor:default"><b>${i+1}. ${p[0]}</b></div><div class="acc-a" style="max-height:none;padding:8px 14px;font-size:13px">${p[1]}</div></div>`).join('')}</div>`;
  return `<div class="ai-badge" style="background:#fdecea;color:#a8392f;border-color:#f0c0ba">⚠ נוצר ע\u05f4י AI · לא-מאומת בטיחות</div>
    <div class="padv-target"><b>${rec.heb}</b> · ${rec.cat}</div>
    ${rec.build.intro?`<div class="pp-desc" style="margin-top:8px">${rec.build.intro}</div>`:''}
    ${mats}${phases}
    <div class="calcnote" style="margin-top:10px;font-size:12px;color:var(--ember)">מחשבון המלח/ריפוי יתווסף אוטומטית מהאפליקציה (ערכים בטוחים), לא מה-AI.</div>`;
}
async function runGenerateRecipe(prompt){
  if(!prompt||!prompt.trim()){ if(typeof toast==='function') toast('תאר את המתכון'); return; }
  showPanel(`${toolTop('מחולל מתכונים','✨ כותב מתכון…','✨','#9e4a3d')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מנסח מתכון…</div></div>`);
  try{
    const rec=await aiGenerateRecipe(prompt.trim());
    aiConfirmPanel({ title:'מתכון מוצע', sub:'⚠ נוצר ע\u05f4י AI · בדוק לפני שמירה', bodyHTML:umakePreviewHTML(rec), applyLabel:'💾 שמור למתכונים שלי',
      onApply:()=>{ const id=umakeSave(rec); if(typeof toast==='function') toast('נשמר ל"המתכונים שלי" ✓'); if(typeof closePanel==='function') closePanel(); if(typeof openMake==='function'&&id) { const meta=resolveItem(id); if(meta) openMakeMeta(meta); } } });
  }catch(e){
    const msg=/bad-structure/.test(e.message)?'המתכון שהתקבל לא היה תקין. נסה לנסח אחרת.':(/no-key/.test(e.message)?'צריך מפתח AI.':'ה-AI לא זמין כרגע.');
    showPanel(`${toolTop('מחולל מתכונים','שגיאה','✨','#9e4a3d')}<div class="panel-body"><div class="shop-empty">${msg}</div><button class="ccta" id="genRetry">← חזרה</button></div>`);
    const rb=$("#genRetry"); if(rb) rb.addEventListener('click',openRecipeGen);
  }
}
// open a umake recipe (mirrors openMake but for user-generated)
function openMakeMeta(meta){
  if(!meta) return;
  const col='#9e4a3d';
  showPanel(`<div class="panel-top" style="--c:${col}"><button class="x" aria-label="סגור">✕</button><div class="cat" style="color:${col}">${meta.cat} · ✨ המתכון שלי</div><h2>${meta.heb}</h2><div class="en">נוצר ע\u05f4י AI · לא-מאומת בטיחות</div></div>
    <div class="panel-body"><div id="methodArea"></div>
      <button class="ccta" id="umProj" style="margin-top:14px">🧫 צור פרויקט מהמתכון</button>
      <button class="akc-back" id="umDel" style="margin-top:8px;color:var(--ember)">🗑️ מחק מתכון</button></div>`);
  renderBuildInto("#methodArea", meta.key, meta.build);
  const pj=$("#umProj"); if(pj) pj.addEventListener('click',()=>openProjectWizard(meta));
  const dl=$("#umDel"); if(dl) dl.addEventListener('click',async()=>{ if((await appConfirm('למחוק את המתכון?',{okLabel:'מחק',danger:true}))===true){ const o=umakes(); delete o[meta.key]; saveUmakes(o); if(typeof closePanel==='function') closePanel(); if(typeof toast==='function') toast('נמחק'); } });
}
function openRecipeGen(){
  if(!aiAvail()){
    showPanel(`${toolTop(L('מחולל מתכונים (AI)','Recipe generator (AI)'),L('דורש מפתח Gemini אישי','Requires a personal Gemini key'),'✨','#9e4a3d')}<div class="panel-body">
      <div class="pp-desc" style="margin-bottom:14px">${L('יצירת מתכונים חדשים בשפה חופשית זמינה עם חיבור AI.','Creating new recipes in free language is available with an AI connection.')}</div>
      <button class="ccta" id="genConnect">🔑 ${L('חבר AI','Connect AI')}</button></div>`);
    const c=$("#genConnect"); if(c) c.addEventListener('click',()=>{ if(typeof askConnect==='function') askConnect(); });
    return;
  }
  const my=umakes(); const myList=Object.entries(my);
  const examples=getLang()==='he'?['נקניקיית בקר-כמון-הריסה תוניסאית','שווארמה עוף בתיבול ירושלמי','קבב טלה חריף עם צנוברים','סלמי יין אדום ושום']:['Tunisian beef-cumin-harissa sausage','Chicken shawarma in Jerusalem spice','Spicy lamb kebab with pine nuts','Red-wine and garlic salami'];
  showPanel(`${toolTop(L('מחולל מתכונים','Recipe generator'),L('תאר מתכון — ואכתוב אותו','Describe a recipe — and I will write it'),'✨','#9e4a3d')}<div class="panel-body">
    <div class="ai-badge">✨ ${L('מופעל בעזרת AI · מספרי בטיחות מהאפליקציה','Powered by AI · safety numbers from the app')}</div>
    <textarea id="genPrompt" placeholder="${L('למשל: נקניקיית טלה חריפה בסגנון מרוקאי עם הרבה כמון וכוסברה','e.g. a spicy Moroccan-style lamb sausage with lots of cumin and coriander')}" style="width:100%;min-height:80px;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:'Heebo';font-size:15px;margin-bottom:10px"></textarea>
    <div class="chips" style="margin-bottom:14px">${examples.map(e=>`<span class="chip" data-genex="${e}">${e}</span>`).join('')}</div>
    <button class="ccta" id="genGo">✨ ${L('צור מתכון','Create recipe')}</button>
    ${myList.length?`<div class="pp-group" style="margin-top:18px"><div class="pp-gh">✨ ${L('המתכונים שלי','My recipes')} · ${myList.length}</div>${myList.map(([id,m])=>`<button class="pp-item" data-umopen="${id}"><div class="pp-item-h"><span class="pp-emoji">🍖</span><b>${(typeof itemName==='function'?itemName(m):m.heb)}</b><span class="pp-diff" style="color:var(--smoke)">${t(m.cat)}</span></div></button>`).join('')}</div>`:''}
  </div>`);
  const ta=$("#genPrompt");
  $("#panel").querySelectorAll('[data-genex]').forEach(c=>c.addEventListener('click',()=>{ if(ta) ta.value=c.dataset.genex; }));
  const go=$("#genGo"); if(go) go.addEventListener('click',()=>runGenerateRecipe(ta?ta.value:''));
  $("#panel").querySelectorAll('[data-umopen]').forEach(b=>b.addEventListener('click',()=>{ const meta=resolveItem(b.dataset.umopen); if(meta) openMakeMeta(meta); }));
}

/* ═══ FEATURE 7 (R3.2) · תובנות-יומן (AI) ═══
   Analyzes the user's cooking journal for patterns + suggestions.
   Grounded in real entries only; never invents history. */
function journalInsightsGrounding(){
  const j=(typeof journal==='function'?journal():[]).slice(0,25);
  const rows=j.map(e=>`${e.name||e.key||'?'} · ${e.date||''}${e.temp?' · '+e.temp:''}${e.rating?' · דירוג '+e.rating+'/5':' · ללא דירוג'}`);
  return 'יומן הבישולים של המשתמש ('+j.length+' רשומות אחרונות):\n'+rows.join('\n')
    +'\n\nנתח אך ורק את הרשומות שלמעלה. אל תמציא בישולים או נתונים שלא מופיעים.';
}
async function aiJournalInsights(){
  const grounding=journalInsightsGrounding();
  const schema='{"summary":"<סיכום קצר>","patterns":["<דפוס שזוהה>"],"suggestions":[{"title":"<כותרת>","detail":"<פירוט מעשי>"}]}';
  const task='נתח את יומן הבישולים: זהה דפוסים (מה מצליח, מה מדורג נמוך, מגמות טמפ׳/סוגים), ותן 2-4 הצעות שיפור מעשיות. הסתמך אך ורק על הרשומות שסופקו.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.5,maxTokens:1200});
  const arr=x=>Array.isArray(x)?x.filter(s=>typeof s==='string').slice(0,6):[];
  const sugg=Array.isArray(raw&&raw.suggestions)?raw.suggestions.filter(s=>s&&typeof s.title==='string').slice(0,5).map(s=>({title:s.title.slice(0,80),detail:(typeof s.detail==='string')?s.detail.slice(0,300):''})):[];
  return { summary:(raw&&typeof raw.summary==='string')?raw.summary.slice(0,400):'', patterns:arr(raw&&raw.patterns), suggestions:sugg };
}
function journalInsightsRender(res){
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  const sugg=res.suggestions.map(s=>`<div class="acc" style="margin-top:8px"><div class="acc-q" style="cursor:default"><b>💡 ${esc(s.title)}</b></div>${s.detail?`<div class="acc-a" style="max-height:none;padding:8px 14px;font-size:13px">${esc(s.detail)}</div>`:''}</div>`).join('');
  showPanel(`${toolTop('תובנות יומן','✨ ניתוח הבישולים שלך','📊','#1a9a7a')}
    <div class="panel-body">
      <div class="ai-badge">✨ נוצר ע\u05f4י AI · מבוסס על היומן שלך בלבד</div>
      ${res.summary?`<div class="padv-target" style="background:var(--char2)">📊 ${esc(res.summary)}</div>`:''}
      ${res.patterns.length?`<div class="pp-group"><div class="pp-gh">דפוסים שזוהו</div><ul style="margin:0;padding-inline-start:20px;font-size:13.5px;line-height:1.7;color:var(--bone)">${li(res.patterns)}</ul></div>`:''}
      ${res.suggestions.length?`<div class="pp-group"><div class="pp-gh">הצעות שיפור</div>${sugg}</div>`:''}
      ${aiSafetyCaveat((res.summary||'')+' '+(res.patterns||[]).join(' ')+' '+res.suggestions.map(s=>s.title+' '+s.detail).join(' '))}
    </div>`);
}
async function openJournalInsights(){
  const j=(typeof journal==='function'?journal():[]);
  if(j.length<3){ if(typeof toast==='function') toast('צריך לפחות 3 בישולים ביומן לניתוח'); return; }
  showPanel(`${toolTop('תובנות יומן','✨ מנתח…','📊','#1a9a7a')}<div class="panel-body"><div class="wcim-loading" style="color:var(--fresh)">✨ מנתח את היומן…</div></div>`);
  try{ journalInsightsRender(await aiJournalInsights()); }
  catch(e){ if(typeof toast==='function') toast('AI לא זמין כרגע'); if(typeof openJournal==='function') openJournal(); }
}
// projects (pantry) helpers reused: pantry(), savePantry()
function projPhases(p){
  if(!p.key) return [];
  if(p.source==='bought') return [];                 // bought & ready — no from-scratch steps
  if(p.source==='bought-finish') return [p.finish||'שלב סיום לפני הגשה'];   // only the finishing step
  const meta=resolveItem(p.key); if(!meta) return [];
  const bld=itemScratchBuild(meta)||{};              // includes synthesized cheese phases
  return (bld.phases||[]).map(ph=>Array.isArray(ph)?ph[0]:ph);
}
function projStepsHTML(p){
  const phases=projPhases(p);
  if(!phases.length) return '';
  const done=p.doneSteps||[];
  const n=done.length, total=phases.length;
  return `<details class="cpc-steps"><summary>📋 ${L('שלבי הכנה','Prep steps')} · ${n}/${total} ${L('בוצעו','done')}</summary>
    <div class="cpc-steplist">${phases.map((ph,i)=>`<label class="cpc-step ${done.includes(i)?'done':''}"><input type="checkbox" data-cpstep="${p.id}" data-cpi="${i}" ${done.includes(i)?'checked':''}> ${t(ph)}</label>`).join('')}</div>
  </details>`;
}
// Wave 3 · charcuterie safety guardian — CHECKS a dry/cure project against vetted thresholds (never invents numbers).
// ~35% weight loss ≈ safe water activity for dry-cure; nitrite required for dry/cured (botulism). Deterministic.
function charcuterieGuardian(p){
  const he=(typeof getLang!=='function'||getLang()==='he'); const out=[]; if(!p) return out;
  const SAFE_MIN=35;
  if(p.type==='dry' && p.startW && p.curW){
    const lossNow=Math.round((1-p.curW/p.startW)*100);
    const targetLoss=Math.round((1-(p.factor||0.62))*100);
    if(targetLoss<SAFE_MIN) out.push({level:'danger', text: he?`יעד הירידה (${targetLoss}%) נמוך מהמינימום הבטוח (~${SAFE_MIN}%) למוצר מיובש — פעילות-המים תישאר גבוהה מדי (סכנת פתוגנים/בוטוליזם). העלה את היעד.`:`The loss target (${targetLoss}%) is below the safe minimum (~${SAFE_MIN}%) for a dry-cured product — water activity stays too high (pathogen/botulism risk). Raise the target.`});
    if(lossNow<Math.max(targetLoss,SAFE_MIN)) out.push({level:'warn', text: he?`ירדת ${lossNow}% — עדיין לא בטוח לאכילה. המשך לייבש עד ~${Math.max(targetLoss,SAFE_MIN)}%.`:`${lossNow}% lost — not safe to eat yet. Keep drying to ~${Math.max(targetLoss,SAFE_MIN)}%.`});
    else out.push({level:'ok', text: he?`ירדת ${lossNow}% — הגעת לפעילות-מים בטוחה (~${SAFE_MIN}%+).`:`${lossNow}% lost — safe water activity reached (~${SAFE_MIN}%+).`});
  }
  if(p.type==='dry'||p.type==='cure') out.push({level:'info', text: he?'מוצר מיובש/כבוש חייב ניטריט (Cure #1/#2) — ודא שהמתכון כלל אותו; היעדרו = סכנת בוטוליזם.':'A dry/cured product requires nitrite (Cure #1/#2) — make sure the recipe included it; without it = botulism risk.'});
  return out;
}
function _guardianTop(p){ const f=charcuterieGuardian(p); if(!f.length) return null;
  const order={danger:0,warn:1,info:2,ok:3}; f.sort(function(a,b){return order[a.level]-order[b.level];}); return f[0]; }
function projProgress(p){
  if(p.source==='bought'&&p.type!=='cure'&&p.type!=='dry'){ return {pct:100,label:stageLabel(projStage(p))||L('מוכן','Ready'),day:'',ready:projStage(p)!=='building',sub:L('נקנה מוכן','Bought ready')}; }
  if(p.type==='scratch'){ const ph=projPhases(p); const done=(p.doneSteps||[]).length; const total=Math.max(1,ph.length); const ready=done>=ph.length; return {pct:Math.round(done/total*100),label:`${done}/${ph.length} ${L('שלבים','steps')}`,day:'',ready,sub:L('בנייה מאפס','From scratch')}; }
  if(!p.type){ return {pct:0,label:'',day:'',ready:true,sub:''}; }
  if(p.type==='dry'){ const target=Math.round(p.startW*p.factor); const targetLoss=Math.round((1-p.factor)*100);
    const lossNow=p.startW?Math.round((1-p.curW/p.startW)*100):0; const ready=p.curW<=target;
    return {pct:Math.min(100,Math.round(lossNow/Math.max(1,targetLoss)*100)),label:`${L('ירידה','loss')} ${lossNow}% / ${targetLoss}%`,day:`${L('יום','Day')} ${daysBetween(p.start,today())}`,ready,sub:`${L('התחלה','start')} ${p.startW}${L('ג׳','g')} · ${L('יעד','target')} ${target}${L('ג׳','g')}`}; }
  const elapsed=daysBetween(p.start,today()), ready=elapsed>=p.days;
  return {pct:Math.min(100,Math.round(elapsed/Math.max(1,p.days)*100)),label:`${L('יום','Day')} ${elapsed}/${p.days}`,day:'',ready,sub:`${L('סיום','done')} ${fmtDate(addDays(p.start,p.days))}`};
}
function cPaintProjects(){
  const host=$("#cProjBody"); if(!host) return;
  const projs=pantry();
  const inv=invEnsure();
  const lowCount=inv.filter(i=>i.qty<=i.low).length;
  // ── active projects ──
  let html=`<div class="cproj-sec"><div class="cproj-h"><span>🧫 ${L('פרויקטים פעילים','Active projects')}</span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="cev-act" id="cProjWcim" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">🍳 ${L('מה אפשר להכין','What can I make')}</button><button class="cev-act" id="cProjGen" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">✨ ${L('מחולל מתכונים','Recipe generator')}</button><button class="cev-act" id="cProjAdv" style="background:var(--fresh-l);border:1px solid var(--fresh);color:var(--fresh)">🗓️ ${L('יועץ תזמון','Scheduling advisor')}</button><button class="cev-act" id="cProjBuy" style="background:none;border:1px solid var(--ember);color:var(--ember)">🛒 ${L('קניתי — לאחסון','Bought — to store')}</button><button class="cev-act" id="cProjNew">+ ${L('פרויקט חדש','New project')}</button></span></div>`;
  if(!projs.length){
    html+=`<div class="cscard"><h4>${L('אין פרויקטים פעילים','No active projects')}</h4><div style="font-size:12.5px;color:var(--smoke);line-height:1.6">${L('התחל פרויקט שרקוטרי או כבישה — צ׳וריסו, פנצ׳טה, בריסולה, פסטרמה — ועקוב אחרי ירידת המשקל והזמן עד לבשלות. או לחץ "🛒 קניתי — לאחסון" כדי לשמור רכיב מוכן שקנית.','Start a charcuterie or curing project — chorizo, pancetta, bresaola, pastrami — and track weight loss and time to readiness. Or tap "🛒 Bought — to store" to save a ready ingredient you bought.')}</div></div>`;
  } else {
    html+=projs.map(p=>{ const pr=projProgress(p); const stg=projStage(p); const bought=(p.source==='bought'||p.source==='bought-finish');
      return `<div class="cproj-card ${pr.ready?'ready':''}">
        <div class="cpc-top"><b>${p.name}</b><span class="cpc-day">${bought&&p.source==='bought'?stageLabel(stg):(pr.day||pr.label)}</span></div>
        <div class="cpc-sub">${bought?(p.source==='bought'?'🛒 '+L('נקנה מוכן','Bought ready'):'🛒 '+L('נקנה + סיום','Bought + finish')):(p.type==='scratch'?'🍖 '+L('בנייה מאפס','From scratch'):(p.type==='dry'?L('ייבוש למשקל','Dry to weight'):L('כבישה','Curing')))}${p.finish?' · '+t(p.finish):''}${(p.source==='bought'||p.type==='scratch')?'':' · '+pr.sub}</div>
        ${p.source==='bought'?'':`<div class="pbar"><i style="width:${pr.pct}%;background:${pr.ready?'var(--good)':'var(--ember)'}"></i></div>`}
        ${(p.type==='dry'&&p.source!=='bought')?`<div class="cpc-log"><label>${L('משקל נוכחי','Current weight')}</label><input type="number" data-cpw="${p.id}" value="${p.curW}"><span>${L('ג׳','g')} · ${pr.label}</span></div>`:(p.source!=='bought'?`<div class="cpc-log" style="color:var(--smoke)">${pr.label} · ${pr.ready?L('הסתיים ✓','Done ✓'):L('בתהליך','In progress')}</div>`:'')}
        ${pr.ready&&p.source!=='bought'?`<div class="cpc-ready">✓ ${L('מוכן!','Ready!')}</div>`:''}
        ${((p.type==='dry'||p.type==='cure')&&p.source!=='bought')?(function(){ const gt=_guardianTop(p); return gt?`<div class="cpc-guardian cpc-g-${gt.level}">🛡️ ${esc(gt.text)}</div>`:''; })():''}
        ${projStepsHTML(p)}
        <div class="cpc-actions">
          ${(stg==='ready'||stg==='done')?`<button class="cpc-act cpc-bridge" data-cpplan="${p.id}">➕ ${L('לאירוע/בישול','To event/cook')}</button>`:''}
          ${(p.source==='bought'&&stg!=='done')?`<button class="cpc-act" data-cpfinish="${p.id}">➕ ${L('הוסף עישון/סיום','Add smoke/finish')}</button>`:''}
          ${p.source==='bought'?`<button class="cpc-act" data-cpserve="${p.id}">${stg==='done'?'↩ '+L('סמן: צריך סיום','Mark: needs finish'):'✅ '+L('מוכן להגשה','Ready to serve')}</button>`:''}
          ${p.key?`<button class="cpc-act" data-cprecipe="${p.key}">📖 ${L('מתכון מלא','Full recipe')}</button>`:''}
          ${p.key?`<button class="cpc-act" data-cpcart="${p.id}">🛒 ${L('קניות','Shopping')}</button>`:''}
          <button class="cpc-act" data-cpnote="${p.id}">📓 ${L('רישום ליומן','Log to journal')}</button>
          <button class="cpc-rm" data-cprm="${p.id}">${L('מחק','Delete')}</button>
        </div>
      </div>`;
    }).join('');
  }
  html+=`</div>`;
  // ── raw-material inventory ──
  html+=`<div class="cproj-sec"><div class="cproj-h"><span>📦 ${L('מזווה — חומרי גלם','Pantry — raw materials')}${lowCount?` <span class="cinv-low-badge">${lowCount} ${L('חסרים','low')}</span>`:''}</span><span style="display:flex;gap:6px;flex-wrap:wrap">${lowCount?`<button class="cev-act" id="cInvShop">🛒 ${L('קניות','Shopping')}</button>`:''}<button class="cev-act" id="cInvAdd">+ ${L('פריט','Item')}</button><button class="cev-act" id="cInvReset" style="background:none;border:1px solid var(--line2);color:var(--smoke)">↺ ${L('שחזר','Restore')}</button></span></div>`;
  const invGrpOrder=['ריפוי','שרוולים','מלח וסוכר','תבלינים','עצים','שונות'];
  const invByGrp={}; inv.forEach(i=>{ const g=i.grp||'שונות'; (invByGrp[g]=invByGrp[g]||[]).push(i); });
  const invRow=i=>{ const low=i.qty<=i.low;
    return `<div class="cinv-row ${low?'low':''}">
      <div class="cinv-name">${t(i.name)}${low?` <span class="cinv-lowtag">${L('חסר','low')}</span>`:''}</div>
      <div class="cinv-qty"><button data-invdec="${i.id}">−</button><input type="number" data-invq="${i.id}" value="${i.qty}"><span>${t(i.unit)}</span><button data-invinc="${i.id}">+</button></div>
      <button class="cinv-rm" data-invrm="${i.id}">×</button>
    </div>`; };
  invGrpOrder.filter(g=>invByGrp[g]).forEach(g=>{
    html+=`<div class="cinv-grp">${t(g)}</div>`+invByGrp[g].map(invRow).join('');
  });
  html+=`</div>`;
  // ── workflow links ──
  html+=`<div class="cproj-sec"><div class="cproj-h"><span>🗓️ ${L('ניהול תהליך','Process management')}</span></div>
    <div class="cproj-links">
      <button class="cproj-link" data-mfn="openReminders">⏰ ${L('תזכורות','Reminders')}<small>${L('הפוך · הזרק · בדוק לחות','flip · inject · check humidity')}</small></button>
      <button class="cproj-link" data-mfn="openJournal">📓 ${L('יומן','Journal')}<small>${L('תיעוד משקל, תמונות, טעם','log weight, photos, taste')}</small></button>
    </div></div>`;
  host.innerHTML=html;
  // wire — projects
  const np=$("#cProjNew"); if(np) np.addEventListener('click',openProjectPicker);
  const wc=$("#cProjWcim"); if(wc) wc.addEventListener('click',openWhatCanIMake);
  const av=$("#cProjAdv"); if(av) av.addEventListener('click',openPantryAdvisor);
  const gn=$("#cProjGen"); if(gn) gn.addEventListener('click',openRecipeGen);
  const nb=$("#cProjBuy"); if(nb) nb.addEventListener('click',openBuyStorePicker);
  host.querySelectorAll('[data-cpplan]').forEach(b=>b.addEventListener('click',()=>pantryToPlan(b.dataset.cpplan)));
  host.querySelectorAll('[data-cpfinish]').forEach(b=>b.addEventListener('click',()=>pantryAddFinish(b.dataset.cpfinish)));
  host.querySelectorAll('[data-cpserve]').forEach(b=>b.addEventListener('click',()=>{
    const a=pantry(), p=a.find(x=>x.id===b.dataset.cpserve); if(!p) return;
    p.stage=(projStage(p)==='done')?'ready':'done'; savePantry(a); cPaintProjects();
  }));
  host.querySelectorAll('[data-cpw]').forEach(inp=>inp.addEventListener('input',()=>{
    const a=pantry(), p=a.find(x=>x.id===inp.dataset.cpw); if(p){ p.curW=+inp.value||p.curW; savePantry(a); cPaintProjects(); }
  }));
  host.querySelectorAll('[data-cprm]').forEach(b=>b.addEventListener('click',()=>{
    appConfirm('למחוק את הפרויקט?\n(תזכורות אוטומטיות שנוצרו לו יימחקו גם)',{okLabel:'🗑️ מחק',danger:true}).then(__y=>{ if(__y!==true) return; (()=>{
      const pid=b.dataset.cprm;
      savePantry(pantry().filter(x=>x.id!==pid));
      // orphan cleanup: remove reminders tagged to this project
      try{ const rem=reminders().filter(r=>r.proj!==pid); store.set('mk-reminders',rem); }catch(e){}
      // clear last-project pointer if it was this one
      if(store.get('mk-lastproj')===pid) store.set('mk-lastproj',null);
      if(curProject===pid) curProject=null;
      cPaintProjects();
    })(); });
  }));
  // recipe step checklist
  host.querySelectorAll('[data-cpstep]').forEach(cb=>cb.addEventListener('change',()=>{
    const a=pantry(), p=a.find(x=>x.id===cb.dataset.cpstep); if(!p) return;
    p.doneSteps=p.doneSteps||[]; const i=+cb.dataset.cpi;
    if(cb.checked){ if(!p.doneSteps.includes(i)) p.doneSteps.push(i); } else { p.doneSteps=p.doneSteps.filter(x=>x!==i); }
    savePantry(a); store.set('mk-lastproj',p.id); cPaintProjects();
  }));
  // open the recipe + build steps for a project
  host.querySelectorAll('[data-cprecipe]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.cprecipe; const meta=resolveItem(key); if(!meta) return;
    const card=b.closest('[data-cprm]')||b.closest('.cproj-card');
    // find the project id from the sibling delete button
    const rmBtn=b.parentElement&&b.parentElement.querySelector('[data-cprm]'); pendingProject=rmBtn?rmBtn.dataset.cprm:null;
    if(key.startsWith('umake-')&&typeof openMakeMeta==='function') openMakeMeta(meta);
    else if(meta.kind==='make'&&typeof openMake==='function') openMake(key.replace(/^make-/,''));
    else if(meta.kind==='spec'&&typeof openSpec==='function') openSpec(meta.obj);
    else if(meta.kind==='cut'&&typeof openCut==='function') openCut(meta.obj);
  }));
  // quick journal entry for a project
  host.querySelectorAll('[data-cpnote]').forEach(b=>b.addEventListener('click',async()=>{
    const p=pantry().find(x=>x.id===b.dataset.cpnote); if(!p) return;
    const note=await appPrompt('רישום ליומן — מה קרה היום?','',{placeholder:'משקל, ריח, טעם, שלב…',okLabel:'📓 רשום'}); if(note===null||note===false) return;
    const j=journal(); j.unshift({id:uid(),name:p.name+(note?' — '+note:''),date:today(),temp:p.type==='dry'?(p.curW+' ג׳'):''});
    try{ store.set('mk-journal',j); }catch(e){}
    if(typeof toast==='function') toast('נרשם ביומן ✓');
  }));
  // project shopping (materials + inventory)
  host.querySelectorAll('[data-cpcart]').forEach(b=>b.addEventListener('click',()=>{
    const p=pantry().find(x=>x.id===b.dataset.cpcart); if(p) openProjectCart(p);
  }));
  // wire — inventory
  const ia=$("#cInvAdd"); if(ia) ia.addEventListener('click',async()=>{
    const name=await appPrompt('שם החומר:','',{placeholder:'למשל: מלח ורוד #1',okLabel:'המשך'}); if(!name) return;
    const unit=(await appPrompt('יחידה:','גרם',{placeholder:'גרם / מטר / מנות',okLabel:'＋ הוסף'}));
    if(unit===null||unit===false) return;
    const a=invEnsure(); a.push({id:uid(),name,qty:0,unit:unit||'יח׳',low:0}); invSave(a); cPaintProjects();
  });
  const ish=$("#cInvShop"); if(ish) ish.addEventListener('click',openPantryShop);
  const irs=$("#cInvReset"); if(irs) irs.addEventListener('click',()=>{
    appConfirm('לשחזר את המזווה לרשימת ברירת המחדל המלאה (24 חומרים)?\nהכמויות הנוכחיות יאופסו.',{okLabel:'↺ שחזר',danger:true}).then(y=>{ if(y!==true) return; invResetFull(); cPaintProjects(); if(typeof toast==='function') toast('המזווה שוחזר ✓'); });
  });
  const upd=(id,val)=>{ const a=invEnsure(); const it=a.find(x=>x.id===id); if(it){ it.qty=Math.max(0,val); invSave(a); cPaintProjects(); } };
  host.querySelectorAll('[data-invq]').forEach(inp=>inp.addEventListener('change',()=>upd(inp.dataset.invq,+inp.value||0)));
  host.querySelectorAll('[data-invinc]').forEach(b=>b.addEventListener('click',()=>{ const a=invEnsure(); const it=a.find(x=>x.id===b.dataset.invinc); if(it) upd(it.id,it.qty+ (it.unit==='גרם'?10:1)); }));
  host.querySelectorAll('[data-invdec]').forEach(b=>b.addEventListener('click',()=>{ const a=invEnsure(); const it=a.find(x=>x.id===b.dataset.invdec); if(it) upd(it.id,it.qty-(it.unit==='גרם'?10:1)); }));
  host.querySelectorAll('[data-invrm]').forEach(b=>b.addEventListener('click',()=>{
    appConfirm(L('להסיר את הפריט מהמזווה?','Remove this item from the pantry?'),{okLabel:L('הסר','Remove'),danger:true}).then(y=>{ if(y!==true) return; invSave(invEnsure().filter(x=>x.id!==b.dataset.invrm)); cPaintProjects(); });
  }));
  // wire — links
  host.querySelectorAll('[data-mfn]').forEach(b=>b.addEventListener('click',()=>{ const fn=b.dataset.mfn; if(typeof window[fn]==='function') window[fn](); }));
}
// reset all interactive progress marks for a recipe
function resetRecipeProgress(key){
  if(typeof cardClear==='function') cardClear(key);
  try{
    const rm=[];
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
      if(k && (k.startsWith(key+'-')||k==='done:'+key)) rm.push(k);
    }
    rm.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}
// global pantry shopping list — everything low/out of stock across the pantry
function openPantryShop(){
  const inv=invEnsure(); const low=inv.filter(i=>i.qty<=i.low);
  const byGrp={}; low.forEach(i=>{ const g=i.grp||'שונות'; (byGrp[g]=byGrp[g]||[]).push(i); });
  const line=(i)=>{ const txt=t(i.name)+(i.low>0?` · ${L('יעד','target')} ≥${i.low} ${t(i.unit)}`:'')+` · ${L('יש','have')} ${i.qty}`; const done=store.get("shop:"+i.name)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(i.name)}">${done?"✓":""}</span><span>${txt}</span></div>`; };
  const body=low.length?Object.keys(byGrp).map(g=>`<div class="shop-group"><h4>${t(g)}</h4>${byGrp[g].map(line).join('')}</div>`).join(''):`<div class="shop-empty">${L('המזווה מלא — אין חוסרים 🎉','Pantry is full — nothing low 🎉')}</div>`;
  showPanel(`${toolTop(L('קניות למזווה','Pantry shopping'),L('חומרי גלם חסרים או נמוכים','Missing or low raw materials'),'🛒','#9e4a3d')}
    <div class="panel-body">
      ${body}
      ${low.length?`<button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ ${L('הדפס רשימה','Print list')}</button>`:''}
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{ const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openPantryShop(); }));
  const pr=pnl.querySelector('[data-print]'); if(pr) pr.addEventListener('click',()=>window.print());
}
// extract only the relevant shopping items for a single recipe (not the whole menu)
function recipeMaterials(meta){
  if(!meta) return [];
  const out=[];
  const bld=(meta.obj&&meta.obj.build)||(meta.build)||(DATA.makes[(meta.key||'').replace(/^make-/,'')]||{}).build||{};
  if(bld && Array.isArray(bld.materials) && bld.materials.length){
    bld.materials.forEach(m=>out.push(t(String(m))));
  }
  const o=meta.obj||{};
  if(meta.kind==='cut'){
    if(o.heb) out.push((typeof itemName==='function'?itemName(meta):o.heb)+(o.kg?` (~${o.kg} ${L('ק״ג','kg')})`:''));
    if(o.rub && o.rub!=='—') String(o.rub).split(/[+,\/]/).forEach(r=>{const rr=r.trim(); if(rr) out.push(t(rr));});
    if(o.wood && o.wood!=='ללא') out.push(L('עצי ','Wood: ')+t(o.wood));
  } else if(meta.kind==='spec'){
    if(o.cure && o.cure!=='—') out.push(t(o.cure));
    if(o.wood && o.wood!=='ללא') out.push(L('עצי ','Wood: ')+t(o.wood));
  }
  // dedup
  return [...new Set(out.filter(Boolean))];
}
// standalone recipe shopping list — only this recipe's items, marked have/missing, nothing from the menu
function openRecipeShop(meta){
  if(!meta) return;
  const mats=recipeMaterials(meta); const inv=invEnsure();
  const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
  const showMissingKey='shopmiss:'+(meta.key||'');
  const onlyMissing=store.get(showMissingKey)||false;
  const line=(text,have)=>{ const done=store.get("shop:"+text)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(text)}">${done?"✓":""}</span><span>${text} ${have?`<b style="color:var(--good)">· ${L('יש במזווה','in pantry')}</b>`:`<b style="color:var(--terra-d)">· ${L('חסר','missing')}</b>`}</span></div>`; };
  let list=mats.map(mt=>({mt,have:invHas(String(mt).split(/[0-9]/)[0].trim())}));
  if(onlyMissing) list=list.filter(x=>!x.have);
  const matHTML=list.length?list.map(x=>line(x.mt,x.have)).join(''):`<div class="shop-empty">${L('אין פריטים להצגה.','No items to show.')}</div>`;
  const missCount=mats.filter(mt=>!invHas(String(mt).split(/[0-9]/)[0].trim())).length;
  showPanel(`${toolTop(L('קניות למתכון','Recipe shopping'),(typeof itemName==='function'?itemName(meta):meta.heb),'🛒','#e07a52')}
    <div class="panel-body">
      <div class="shop-toggle"><button class="${onlyMissing?'':'on'}" data-showall>${L('הכל','All')} (${mats.length})</button><button class="${onlyMissing?'on':''}" data-showmiss>${L('רק חסר','Only missing')} (${missCount})</button></div>
      <div class="shop-group">${matHTML}</div>
      <button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ ${L('הדפס רשימה','Print list')}</button>
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{ const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openRecipeShop(meta); }));
  const sa=pnl.querySelector('[data-showall]'); if(sa) sa.addEventListener('click',()=>{ store.set(showMissingKey,false); openRecipeShop(meta); });
  const sm=pnl.querySelector('[data-showmiss]'); if(sm) sm.addEventListener('click',()=>{ store.set(showMissingKey,true); openRecipeShop(meta); });
  const pr=pnl.querySelector('[data-print]'); if(pr) pr.addEventListener('click',()=>window.print());
}
function openProjectCart(p){
  const meta=resolveItem(p.key)||{};
  const boughtRaw=(p.source==='bought');
  const bld=boughtRaw?{}:((meta.obj&&meta.obj.build)||itemScratchBuild(meta)||(DATA.makes[(p.key||'').replace(/^make-/,'')]||{}).build||{});
  const mats=boughtRaw?[]:(bld.materials||[]); const inv=invEnsure();
  const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
  // key stays the language-independent Hebrew label so checkbox state survives a language switch; disp is shown
  const line=(key,disp,have)=>{ const done=store.get("shop:"+key)?"done":"";
    return `<div class="shop-line ${done}"><span class="cbx ${done}" data-shopck="${encodeURIComponent(key)}">${done?"✓":""}</span><span>${disp||key}${have?` <b style="color:var(--good)">· ${L('יש','in pantry')}</b>`:` <b style="color:var(--terra-d)">· ${L('חסר','missing')}</b>`}</span></div>`; };
  const matHTML=mats.length?mats.map(mt=>{const key=String(mt).split(/[0-9]/)[0].trim();return line(mt,t(String(mt)),invHas(key));}).join(''):(boughtRaw?`<div class="shop-empty">${L('פריט שנקנה מוכן — אין חומרי-גלם לרכישה.','A bought item is ready — no raw ingredients to purchase.')}${p.finish?' '+L('שלב סיום:','Finishing step:')+' '+t(p.finish):''}</div>`:`<div class="shop-empty">${L('אין רשימת מרכיבים למתכון זה.','No ingredient list for this recipe.')}</div>`);
  const low=inv.filter(i=>i.qty<=i.low);
  const lowHTML=low.length?`<div class="shop-group"><h4>📦 ${L('מהמזווה — להשלים','From the pantry — to restock')}</h4>${low.map(i=>line(i.name+(i.low>0?` (יעד ≥${i.low} ${i.unit})`:'')+` · יש ${i.qty}`, t(i.name)+(i.low>0?` (${L('יעד','target')} ≥${i.low} ${t(i.unit)})`:'')+` · ${L('יש','have')} ${i.qty}`,false)).join('')}</div>`:'';
  showPanel(`${toolTop(L('קניות לפרויקט','Project shopping'),p.name,'🛒','#9e4a3d')}
    <div class="panel-body">
      <div class="shop-group"><h4>🧫 ${L('מרכיבים וציוד','Ingredients & equipment')}</h4>${matHTML}</div>
      ${lowHTML}
      <button class="prbtn" style="position:static;margin-top:14px" data-print>⎙ ${L('הדפס רשימה','Print list')}</button>
    </div>`);
  const pnl=$("#panel");
  if(pnl){
    pnl.querySelectorAll('[data-shopck]').forEach(cb=>cb.addEventListener('click',()=>{
      const k="shop:"+decodeURIComponent(cb.dataset.shopck); store.set(k,!store.get(k)); openProjectCart(p);
    }));
    pnl.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
  }
}
let projPick={cat:'', cont:'', q:''};
function openProjectPicker(){
  projPick={cat:'', cont:'', q:''};
  showPanel(`${toolTop(L('פרויקט חדש','New project'),L('שרקוטרי · נקניקים · כבישה — בחר מלאכה','Charcuterie · sausages · curing — pick a craft'),'🧫','#9e4a3d')}
    <div class="chome-search" style="margin:12px 16px 6px"><span class="ic">⌕</span><input id="ppSearch" placeholder="${L('חפש — שם, מדינה, סוג…','Search — name, country, type…')}"></div>
    <div id="ppChips" style="padding:0 12px"></div>
    <div class="panel-body" id="ppBody" style="padding-top:6px"></div>`);
  const s=$("#ppSearch"); if(s) s.addEventListener('input',()=>{ projPick.q=s.value.trim().toLowerCase(); ppRender(); });
  ppRender('project');
}
function openBuyStorePicker(){
  projPick={cat:'', cont:'', q:''};
  showPanel(`${toolTop(L('קניתי — לאחסון','Bought — to store'),L('בחר מה קנית · יישמר במזווה כרכיב מוכן','Pick what you bought · saved in the pantry as a ready ingredient'),'🛒','#1a9a7a')}
    <div class="chome-search" style="margin:12px 16px 6px"><span class="ic">⌕</span><input id="ppSearch" placeholder="${L('חפש — נקניק, גבינה, פסטרמה…','Search — sausage, cheese, pastrami…')}"></div>
    <div id="ppChips" style="padding:0 12px"></div>
    <div class="panel-body" id="ppBody" style="padding-top:6px"></div>`);
  const s=$("#ppSearch"); if(s) s.addEventListener('input',()=>{ projPick.q=s.value.trim().toLowerCase(); ppRender('buy'); });
  ppRender('buy');
}
async function buyStoreCreate(meta){
  const finishable=(meta.cat==='גבינה')||isProjectItem(meta);
  const ans=await appConfirm(`${L('קנית','You bought')} "${itemName(meta)}" — ${L('באיזה מצב?','in what state?')}`,{okLabel:'✅ '+L('מוכן להגשה','Ready to serve'),cancelLabel:'📦 '+L('צריך סיום','Needs finishing')});
  if(ans===null) return;
  const stage=(ans===true)?'done':'ready';
  const p={id:uid(),key:meta.key,name:meta.heb,source:'bought',stage,start:today(),doneSteps:[]};
  const a=pantry(); a.push(p); savePantry(a);
  if(typeof toast==='function') toast(`${itemName(meta)} ${L('נשמר במזווה','saved to pantry')} · ${stage==='done'?L('מוכן להגשה','ready to serve'):L('מוכן לסיום','ready to finish')}`);
  cNavGo('projects'); cPaintProjects();
}
function ppAllItems(){
  const all=(typeof cwAllItems==='function')?cwAllItems():[];
  return all.filter(m=>m&&isProjectItem(m));
}
function ppRender(mode){
  mode=mode||projPick.mode||'project'; projPick.mode=mode;
  const items0=ppAllItems();
  const cats=[...new Set(items0.map(m=>m.cat))];
  const conts=[...new Set(items0.map(m=>itemContinent(m)).filter(Boolean))];
  const chips=$("#ppChips"); if(chips){
    chips.innerHTML=`<div class="chips">${[['',L('הכל','All')],...cats.map(c=>[c,t(c)])].map(([v,l])=>`<span class="chip ${projPick.cat===v?'on':''}" data-ppcat="${v}">${v?catEmoji(v)+' ':''}${l}</span>`).join('')}</div>`+
      (conts.length>1?`<div class="chips" style="margin-top:6px">${[['',L('🌍 כל היבשות','🌍 All continents')],...conts.map(c=>[c,t(c)])].map(([v,l])=>`<span class="chip ${projPick.cont===v?'on':''}" data-ppcont="${v}">${l}</span>`).join('')}</div>`:'');
    chips.querySelectorAll('[data-ppcat]').forEach(el=>el.addEventListener('click',()=>{ projPick.cat=el.dataset.ppcat; ppRender(); }));
    chips.querySelectorAll('[data-ppcont]').forEach(el=>el.addEventListener('click',()=>{ projPick.cont=el.dataset.ppcont; ppRender(); }));
  }
  let items=items0;
  if(projPick.cat) items=items.filter(m=>m.cat===projPick.cat);
  if(projPick.cont) items=items.filter(m=>itemContinent(m)===projPick.cont);
  if(projPick.q) items=items.filter(m=>(m.heb+' '+m.eng+' '+m.cat+' '+itemOrigin(m)+' '+itemRichDesc(m)).toLowerCase().includes(projPick.q));
  // group by category for display
  const host=$("#ppBody"); if(!host) return;
  if(!items.length){ host.innerHTML=`<div class="shop-empty">${L('לא נמצאו מתכונים בסינון הזה.','No recipes found for this filter.')}</div>`; return; }
  const groups={}; items.forEach(m=>{ (groups[m.cat]=groups[m.cat]||[]).push(m); });
  host.innerHTML=Object.entries(groups).map(([cat,list])=>`
    <div class="pp-group"><div class="pp-gh">${catEmoji(cat)} ${t(cat)} <span style="color:var(--smoke);font-weight:400">· ${list.length}</span></div>
    ${list.map(m=>{
      const org=itemOrigin(m), desc=itemRichDesc(m);
      const diff=(m.obj&&m.obj.diff)||m.diff;
      return `<button class="pp-item" data-ppick="${m.key}">
        <div class="pp-item-h"><span class="pp-emoji">${itemEmoji(m.cat,m.key)}</span><b>${itemName(m)}</b>${diff?`<span class="pp-diff">${'★'.repeat(Math.min(diff,3))}</span>`:''}</div>
        ${org?`<div class="pp-org">${t(org)}</div>`:''}
        ${desc?`<div class="pp-desc">${desc}</div>`:''}
      </button>`;
    }).join('')}</div>`).join('');
  host.querySelectorAll('[data-ppick]').forEach(el=>el.addEventListener('click',()=>{
    const meta=resolveItem(el.dataset.ppick); if(!meta) return;
    if(mode==='buy') buyStoreCreate(meta); else openProjectWizard(meta);
  }));
}
// ── interactive burger builder ──
const BURGER_TOPPINGS=['🥬 חסה','🍅 עגבנייה','🧅 בצל טרי','🧅 בצל מקורמל','🥒 חמוצים','🥓 בייקון','🍳 ביצת עין','🍄 פטריות מוקפצות','🌶️ הלפיניו','🥑 אבוקדו/גוואק'];
const BURGER_SAUCES=['קטשופ','חרדל','מיונז','רוטב BBQ','איולי שום','רוטב הבית (1000 island)'];
const BURGER_BUNS=['בריוש','שומשום קלאסי','פרעצל','לחמניית תפו״א','אנגלית (מאפין)','ללא (חסה)'];
function cheeseNames(){ const s=new Set(); const grab=c=>{ if(c&&c.cat==='גבינה') s.add(String(c.heb).split(' /')[0].split(' (')[0].trim()); }; (DATA.cuts||[]).forEach(grab); (DATA.specials||[]).forEach(grab); return s.size?[...s]:['צ׳דר','גאודה','אמנטל','מוצרלה']; }
/* ── burgers per diner — context-scoped instance (like seasonings) ── */
const BURGER_DONE={mr:['מדיום-רייר',55],med:['מדיום',57],mw:['מדיום-וול',63],well:['וול-דאן',71]};
function burgerKey(){ return 'burgers:'+seasCtx(); }
function burgerDiners(){
  const a=store.get(burgerKey());
  if(Array.isArray(a)&&a.length) return a;
  const legacy=store.get('mk-burger')||{};
  return [Object.assign({id:uid(),name:'סועד 1',done:'med',cheesePos:'top',cheese:'צ׳דר',tops:['🥬 חסה','🍅 עגבנייה','🧅 בצל מקורמל'],sauce:'רוטב הבית (1000 island)',bun:'בריוש'},legacy)];
}
function saveBurgerDiners(a){ store.set(burgerKey(),a); }
function burgerSummaryLine(d){
  const dn=BURGER_DONE[d.done]||BURGER_DONE.med;
  const ch=d.cheesePos==='none'?L('ללא גבינה','No cheese'):(d.cheesePos==='stuffed'?`🧀 ${t(d.cheese)} ${L('ממולא','stuffed')}`:`🧀 ${t(d.cheese)}`);
  return `${t(dn[0])} ${dn[1]}° · ${ch} · ${d.tops.length} ${L('תוספות','toppings')}${d.sauce?` · ${t(d.sauce.split(' (')[0])}`:''}`;
}
// pure task builder for the work plan (testable)
function burgerPlanTasks(diners, startClock, serveClock, name, detail){
  const tasks=[]; if(!diners||!diners.length) return tasks;
  const tops=[...new Set(diners.flatMap(d=>d.tops||[]))];
  const sauces=[...new Set(diners.map(d=>d.sauce).filter(Boolean))];
  const buns=[...new Set(diners.map(d=>d.bun).filter(Boolean))];
  tasks.push({t:new Date(startClock.getTime()-45*60e3),label:`🍔 מיז-אן-פלאס בורגרים (${diners.length} סועדים) — ${name}`,sub:tops.join(' · ')||'ללא תוספות',kind:'prep',det:detail?`רטבים: ${sauces.join(', ')||'—'} · לחמניות: ${buns.join(', ')||'—'} · קלייה קלה ללחמניות לקראת הגשה`:''});
  const stuffed=diners.filter(d=>d.cheesePos==='stuffed');
  if(stuffed.length) tasks.push({t:new Date(startClock.getTime()-30*60e3),label:`🧀 Juicy Lucy — מילוי קציצות (${stuffed.map(d=>d.name).join(', ')})`,sub:'',kind:'prep',det:detail?'שתי קציצות דקות לכל אחת, גבינה באמצע, לאטום היטב את השוליים':''});
  const byDone={}; diners.forEach(d=>{ (byDone[d.done]=byDone[d.done]||[]).push(d); });
  Object.entries(byDone).sort((a,b)=>(BURGER_DONE[b[0]]||[,0])[1]-(BURGER_DONE[a[0]]||[,0])[1]).forEach(([done,ds])=>{
    const dn=BURGER_DONE[done]||BURGER_DONE.med;
    const cheeseTop=ds.filter(d=>d.cheesePos==='top');
    tasks.push({t:startClock,label:`🔥 קציצות ${dn[0]} — יעד ${dn[1]}°C (${ds.map(d=>d.name).join(', ')})`,sub:done==='well'?'בטיחות בשר טחון: 71°C':'',kind:'cook',det:detail?(cheeseTop.length?`🧀 גבינה מעל בדקה האחרונה: ${cheeseTop.map(d=>d.name).join(', ')} · `:'')+'הפיכה אחת, לא ללחוץ על הקציצה':''});
  });
  tasks.push({t:new Date(serveClock.getTime()-10*60e3),label:`🍔 הרכבה אישית לפי סועד — ${name}`,sub:`${diners.length} בורגרים`,kind:'serve',det:detail?diners.map(d=>`${d.name}: ${burgerSummaryLine(d)}`).join(' | '):''});
  return tasks;
}
let _bOpen=null;
function openBurgerBuilder(){
  const diners=burgerDiners(); saveBurgerDiners(diners); // ensure persisted in this ctx
  if(_bOpen===null||!diners.some(d=>d.id===_bOpen)) _bOpen=diners[0].id;
  const cheeses=cheeseNames();
  const guests=(typeof menuState==='function')?(menuState().guests||0):0;
  const chip=(txt,on,attr)=>`<span class="cmethod ${on?'on':''}" ${attr}>${txt}</span>`;
  const dinerCard=d=>{
    const open=d.id===_bOpen;
    if(!open) return `<div class="cscard" style="cursor:pointer" data-bopen="${d.id}"><h4>🍔 ${d.name} <span style="font-weight:400;font-size:11.5px;color:var(--smoke)">· ${burgerSummaryLine(d)}</span></h4></div>`;
    return `<div class="cscard" data-bcard="${d.id}">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input data-bname="${d.id}" value="${(d.name||'').replace(/"/g,'&quot;')}" style="flex:1;background:var(--char);border:1.5px solid var(--line2);border-radius:10px;padding:9px;color:var(--bone);font-family:'Heebo';font-weight:800">
        <button class="mchip" data-bdup="${d.id}" title="${L('שכפל','Duplicate')}">⧉</button>
        ${diners.length>1?`<button class="mchip" data-brm="${d.id}" title="${L('הסר','Remove')}">🗑</button>`:''}
      </div>
      <h4>🌡️ ${L('מידת עשייה','Doneness')}</h4><div class="cmethods">${Object.entries(BURGER_DONE).map(([k,[l,c]])=>chip(`${t(l)} ${c}°`,d.done===k,`data-bdone="${k}" data-bid="${d.id}"`)).join('')}</div>
      ${d.done!=='well'?`<div style="font-size:11px;color:var(--smoke);margin:4px 2px 0">${L('⚠ בבשר טחון ההמלצה הרשמית היא 71°C — פחות מזה על אחריותך ומבשר טרי בלבד.','⚠ For ground meat the official recommendation is 71°C — below that is at your own risk and from fresh meat only.')}</div>`:''}
      <h4 style="margin-top:12px">🧀 ${L('גבינה','Cheese')}</h4><div class="cmethods">
        ${chip(L('ללא','None'),d.cheesePos==='none',`data-bcp="none" data-bid="${d.id}"`)}
        ${chip(L('מעל (נמסה)','On top (melted)'),d.cheesePos==='top',`data-bcp="top" data-bid="${d.id}"`)}
        ${chip(L('ממולאת (Juicy Lucy)','Stuffed (Juicy Lucy)'),d.cheesePos==='stuffed',`data-bcp="stuffed" data-bid="${d.id}"`)}
      </div>
      ${d.cheesePos!=='none'?`<div class="cmethods" style="margin-top:6px">${cheeses.map(c=>chip(t(c),d.cheese===c,`data-bche="${c}" data-bid="${d.id}"`)).join('')}</div>`:''}
      <h4 style="margin-top:12px">🥗 ${L('תוספות','Toppings')}</h4><div class="cmethods">${BURGER_TOPPINGS.map(tp=>chip(t(tp),(d.tops||[]).includes(tp),`data-btop="${tp}" data-bid="${d.id}"`)).join('')}</div>
      <h4 style="margin-top:12px">🥫 ${L('רוטב','Sauce')}</h4><div class="cmethods">${BURGER_SAUCES.map(x=>chip(t(x),d.sauce===x,`data-bsauce="${x}" data-bid="${d.id}"`)).join('')}</div>
      <h4 style="margin-top:12px">🍞 ${L('לחמנייה','Bun')}</h4><div class="cmethods">${BURGER_BUNS.map(x=>chip(t(x),d.bun===x,`data-bbun="${x}" data-bid="${d.id}"`)).join('')}</div>
    </div>`;
  };
  showPanel(`${toolTop(L('בורגר לכל סועד','A burger per guest'),L('מידת עשייה, גבינה, תוספות ורוטב — אישית','Doneness, cheese, toppings and sauce — personal'),'🍔','#c0563a')}
    <div class="panel-body">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="ccta" data-badd style="margin:0;flex:1;padding:11px;font-size:13.5px">＋ ${L('הוסף סועד','Add guest')}</button>
        ${guests>diners.length?`<button class="ccta ghostc" data-bfill style="margin:0;flex:1;padding:11px;font-size:13.5px;background:none;border:1.5px solid var(--ember);color:var(--ember)">${L('השלם ל-','Fill to ')}${guests} ${L('סועדים','guests')}</button>`:''}
      </div>
      ${diners.map(dinerCard).join('')}
      <div style="font-size:11.5px;color:var(--smoke);padding:6px 4px 8px">${L('ההגדרות נשמרות לבישול/אירוע הנוכחי ומופיעות בתוכנית העבודה — כולל קיבוץ קציצות לפי מידת עשייה והרכבה אישית.','Settings are saved to the current cook/event and appear in the work plan — including grouping patties by doneness and personal assembly.')}</div>
    </div>`);
  const pnl=$("#panel"); if(!pnl) return;
  const upd=fn=>{ const a=burgerDiners(); fn(a); saveBurgerDiners(a); openBurgerBuilder(); };
  pnl.querySelectorAll('[data-bopen]').forEach(x=>x.addEventListener('click',()=>{ _bOpen=x.dataset.bopen; openBurgerBuilder(); }));
  pnl.querySelectorAll('[data-badd]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const base=a[a.length-1]; const nd=Object.assign({},base,{id:uid(),name:L('סועד ','Guest ')+(a.length+1),tops:[...(base.tops||[])]}); a.push(nd); _bOpen=nd.id; })));
  pnl.querySelectorAll('[data-bfill]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const base=a[0]; while(a.length<guests){ a.push(Object.assign({},base,{id:uid(),name:L('סועד ','Guest ')+(a.length+1),tops:[...(base.tops||[])]})); } })));
  pnl.querySelectorAll('[data-bdup]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const i=a.findIndex(d=>d.id===x.dataset.bdup); if(i<0)return; const nd=Object.assign({},a[i],{id:uid(),name:a[i].name+' (2)',tops:[...(a[i].tops||[])]}); a.splice(i+1,0,nd); _bOpen=nd.id; })));
  pnl.querySelectorAll('[data-brm]').forEach(x=>x.addEventListener('click',async()=>{ if((await appConfirm(L('להסיר את הסועד?','Remove this guest?'),{okLabel:L('הסר','Remove'),danger:true}))!==true) return; upd(a=>{ const i=a.findIndex(d=>d.id===x.dataset.brm); if(i>=0&&a.length>1) a.splice(i,1); }); }));
  pnl.querySelectorAll('[data-bname]').forEach(x=>x.addEventListener('change',()=>upd(a=>{ const d=a.find(y=>y.id===x.dataset.bname); if(d) d.name=x.value.trim()||d.name; })));
  const bid=x=>x.dataset.bid;
  pnl.querySelectorAll('[data-bdone]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.done=x.dataset.bdone; })));
  pnl.querySelectorAll('[data-bcp]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.cheesePos=x.dataset.bcp; })));
  pnl.querySelectorAll('[data-bche]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.cheese=x.dataset.bche; })));
  pnl.querySelectorAll('[data-btop]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(!d)return; const t=x.dataset.btop; d.tops=(d.tops||[]).includes(t)?d.tops.filter(z=>z!==t):[...(d.tops||[]),t]; })));
  pnl.querySelectorAll('[data-bsauce]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.sauce=d.sauce===x.dataset.bsauce?'':x.dataset.bsauce; })));
  pnl.querySelectorAll('[data-bbun]').forEach(x=>x.addEventListener('click',()=>upd(a=>{ const d=a.find(y=>y.id===bid(x)); if(d) d.bun=x.dataset.bbun; })));
}
// ── guided project-creation wizard (multi-step, like the event wizard) ──
let pwState=null;
const AGED_CATS=['נקניק מיובש','פסטרמה','סלומי','בשר מיובש','דג מעושן','בייקון'];
function projItemKind(meta){
  // 'aged' = weight/days tracking (dry/cure) · 'scratch' = fresh build-from-phases (sausages, kofta, shawarma)
  if(!meta) return 'scratch';
  const o=meta.obj||{};
  if(AGED_CATS.includes(meta.cat)) return 'aged';
  if(meta.cat==='גבינה' && (o.smt||o.age||o.cure)) return 'aged';
  if(/Bacon|Jerky|Biltong|Pastrami|Bresaola|Pancetta|Coppa|Guanciale|Lonzino|Speck|Lox|Gravlax|Sucuk|Salami|Salume|Pepperoni|Kabanos|Landj/i.test(meta.eng||'')) return 'aged';
  return 'scratch';
}
function pwGuessType(meta){
  if(projItemKind(meta)==='scratch') return 'scratch';
  return /Bacon|Pastrami|Brine|כבישה|Lox|Gravlax/i.test(meta.eng||'')&&!/Dry|Bresaola|Salame|Salami|Speck|Lonzino|Coppa|Chorizo|Sucuk|Pepperoni/i.test(meta.eng||'')?'cure':'dry';
}
function pwSuggestDays(meta){
  const t=(meta.desc||'')+' '+(meta.heb||'');
  const wk=t.match(/(\d+)\s*[-–]?\s*(\d+)?\s*שבוע/); if(wk){ const a=+wk[1], b=wk[2]?+wk[2]:a; return Math.round((a+b)/2)*7; }
  const dy=t.match(/(\d+)\s*[-–]?\s*(\d+)?\s*ימ/); if(dy){ const a=+dy[1], b=dy[2]?+dy[2]:a; return Math.round((a+b)/2); }
  return 21;
}

/* ═══ FEATURE 2 (R1.2) · יועץ-מזווה (תכנון-אחורה) ═══
   prodDaysFor = deterministic lead-time FROM THE DATA (P3 — never from AI). */
function prodDaysFor(meta){
  if(!meta) return 1;
  const kind=(typeof projItemKind==='function')?projItemKind(meta):'scratch';
  if(kind==='aged') return Math.max(1, pwSuggestDays(meta));         // dry/cure: weeks/days parsed from description
  // scratch (fresh sausage/kofta/shawarma): lead-time from rest/aging in phases
  const b=(typeof itemScratchBuild==='function')?itemScratchBuild(meta):null;
  const txt=(b?(b.phases||[]).map(p=>Array.isArray(p)?(p[1]||''):(p.body||'')).join(' '):'')+' '+(meta.desc||'')+' '+(meta.heb||'');
  if(/48\s*שע|יומיים|2[-–\s]*3\s*ימ|2\s*ימ/.test(txt)) return 2;    // long overnight rest
  if(/24\s*שע|לילה|מנוחת|יישון קצר/.test(txt)) return 1;            // single overnight
  return 1;                                                          // fresh: same-day / day-before prep
}
// deterministic backward schedule for a target date (works WITHOUT a key)
function pantryAdvisorLocal(targetDate){
  const tgt=targetDate||today();
  const daysLeft=daysBetween(today(),tgt);
  const cands=cwAllItems().filter(m=>typeof isProjectItem==='function'?isProjectItem(m):(m.kind==='make'));
  const feasible=[], tooLate=[];
  cands.forEach(m=>{
    const meta=(typeof resolveItem==='function')?resolveItem(m.key):m;
    const days=prodDaysFor(meta);
    const startBy=addDays(tgt,-days);
    const row={key:m.key,heb:m.heb,cat:m.cat,days,startBy,kind:projItemKind(meta)};
    if(days<=daysLeft) feasible.push(row); else tooLate.push(row);
  });
  feasible.sort((a,b)=>b.days-a.days);   // longest lead-time first (start those now)
  tooLate.sort((a,b)=>a.days-b.days);
  return {targetDate:tgt, daysLeft, feasible, tooLate};
}
// grounding for the AI: target + days-left + candidates WITH their data-derived lead-times
function pantryAdvisorGrounding(targetDate){
  const loc=pantryAdvisorLocal(targetDate);
  const rows=loc.feasible.concat(loc.tooLate).map(r=>`${r.key} · ${r.heb} (${r.cat}) · משך ייצור ${r.days} ימים`);
  const pan=(typeof pantry==='function'?pantry():[]).map(p=>p.name).join(', ')||'ריק';
  return `תאריך יעד: ${loc.targetDate} · ימים עד היעד: ${loc.daysLeft}\nכבר במזווה: ${pan}\n`
    +`מועמדים (משך-הייצור כבר מחושב — אל תשנה אותו; בחר keys מכאן בלבד):\n`+rows.join('\n');
}
async function pantryAdvisorAI(targetDate){
  const grounding=pantryAdvisorGrounding(targetDate);
  const schema='{"recommend":[{"key":"<key>","reason":"<קצר: למה כדאי>"}],"warnings":["<אזהרה>"]}';
  const task='המלץ אילו מלאכות כדאי להתחיל כדי להיות מוכן לתאריך היעד, לפי משכי-הייצור הנתונים. סדר לפי מה שצריך להתחיל ראשון. הוסף אזהרות אם משהו לא יספיק. בחר keys מהרשימה בלבד.';
  const raw=await aiJSON({task,schemaHint:schema,grounding,temperature:0.35,maxTokens:1200});
  const rec=aiValidateItems(raw&&raw.recommend).kept;
  // recompute startBy IN-APP from data (never trust AI dates/durations — P3)
  const enriched=rec.map(r=>{ const meta=resolveItem(r.key); const days=prodDaysFor(meta); return {key:r.key, heb:meta.heb, cat:meta.cat, reason:r.reason, days, startBy:addDays(targetDate,-days), kind:projItemKind(meta)}; });
  const warnings=Array.isArray(raw&&raw.warnings)?raw.warnings.slice(0,4):[];
  return {recommend:enriched, warnings};
}
function openProjectWizard(meta){
  pwState={meta,step:0,name:meta.heb,type:pwGuessType(meta),start:today(),startW:1000,factor:0.62,days:pwSuggestDays(meta)};
  showPanel(`${toolTop(L('אשף פרויקט','Project wizard'),L('צור פרויקט מלאכה חדש','Create a new craft project'),'🧫','#9e4a3d')}
    <div class="cwprog" id="pwProg" style="padding:0 22px 16px"></div>
    <div class="panel-body" id="pwBody"></div>`);
  pwRender();
}
function pwRender(){
  const host=$("#pwBody"); if(!host||!pwState) return;
  const s=pwState, meta=s.meta; const TOTAL=4;
  const prog=$("#pwProg"); if(prog) prog.innerHTML=Array.from({length:TOTAL},(_,i)=>`<div class="cwseg ${i<s.step?'done':''} ${i===s.step?'cur':''}"></div>`).join('');
  const inp='width:100%;background:var(--char);border:1.5px solid var(--line2);border-radius:12px;padding:12px;color:var(--bone);font-family:\'Heebo\';font-size:15px;margin-bottom:10px';
  let body='';
  if(s.step===0){
    const scratch=s.type==='scratch';
    body=`<div class="cwq">${L('פרטי הפרויקט','Project details')}</div><div class="cwsub">${L('תן שם ובחר את סוג התהליך.','Name it and pick the process type.')}</div>
      <div class="cscard">
        <input id="pwn" placeholder="${L('שם הפרויקט','Project name')}" value="${s.name}" style="${inp}">
        <input id="pwstart" type="date" value="${s.start}" style="${inp}">
      </div>
      <div class="cscard"><h4>⚙️ ${L('סוג התהליך','Process type')}</h4><div class="cmethods" id="pwtype">
        <span class="cmethod ${s.type==='scratch'?'on':''}" data-pwt="scratch">🍖 ${L('בנייה מאפס (טרי)','Build from scratch (fresh)')}</span>
        <span class="cmethod ${s.type==='dry'?'on':''}" data-pwt="dry">🧫 ${L('ייבוש למשקל','Dry to weight')}</span>
        <span class="cmethod ${s.type==='cure'?'on':''}" data-pwt="cure">🧂 ${L('כבישה בימים','Cure by days')}</span>
      </div></div>
      ${scratch?`<div class="cscard" style="background:var(--fresh-l);border-color:#b8e0d4"><h4>🍖 ${L('בנייה מאפס','Build from scratch')}</h4><div style="font-size:12.5px;color:var(--bone);line-height:1.6">${L('מלאכה טרייה — טחינה, תיבול, מילוי/עיצוב ובישול.','A fresh craft — grinding, seasoning, stuffing/shaping and cooking.')} ${(()=>{const ph=(itemScratchBuild(meta)||{}).phases||[];return ph.length?`${ph.length} ${L('שלבים.','steps.')}`:'';})()} ${L('עוקבים אחרי השלבים במזווה, ואפשר לאחסן ולסיים בהמשך.','Follow the steps in the pantry — you can store it and finish later.')}</div></div>
      <button class="ccta" data-pwcreate>🍖 ${L('צור פרויקט מאפס','Create scratch project')}</button>`
      :`<button class="ccta" data-pwnext>${L('המשך ליעד ←','Next: target →')}</button>`}`;
  } else if(s.step===1){
    body=s.type==='dry'?`<div class="cwq">${L('יעד ייבוש','Drying target')}</div><div class="cwsub">${L('המוצר מוכן כשאיבד אחוז מהמשקל (35–40% קלאסי).','Ready when it has lost a percentage of its weight (35–40% is classic).')}</div>
      <div class="cstepper"><button data-pwwm>−</button><div class="val" id="pwwv">${s.startW}<small>${L('גרם התחלה','g start')}</small></div><button data-pwwp>+</button></div>
      <div class="cscard"><h4>📉 ${L('אחוז ירידת יעד','Target weight-loss %')}</h4><div class="cmethods">
        <span class="cmethod ${s.factor==0.65?'on':''}" data-pwf="0.65">35%</span>
        <span class="cmethod ${s.factor==0.62?'on':''}" data-pwf="0.62">38%</span>
        <span class="cmethod ${s.factor==0.6?'on':''}" data-pwf="0.6">40%</span>
      </div><div style="font-size:13px;color:var(--fresh);font-weight:700;margin-top:12px">${L('יעד משקל:','Target weight:')} ${Math.round(s.startW*s.factor)} ${L('ג׳','g')}</div></div>
      <button class="ccta" data-pwnext>${L('המשך למרכיבים ←','Next: ingredients →')}</button>`
    :`<div class="cwq">${L('משך כבישה','Cure duration')}</div><div class="cwsub">${L('כמה ימים עד שהמוצר מוכן.','How many days until it is ready.')}</div>
      <div class="cstepper"><button data-pwdm>−</button><div class="val" id="pwdv">${s.days}<small>${L('ימים','days')}</small></div><button data-pwdp>+</button></div>
      <div class="cscard"><div style="font-size:13px;color:var(--fresh);font-weight:700">${L('סיום משוער:','Estimated finish:')} ${fmtDate(addDays(s.start,s.days))}</div></div>
      <button class="ccta" data-pwnext>${L('המשך למרכיבים ←','Next: ingredients →')}</button>`;
  } else if(s.step===2){
    const bld=(meta.obj&&meta.obj.build)||(DATA.makes[(meta.key||'').replace(/^make-/,'')]||{}).build||{};
    const mats=(bld.materials||[]); const inv=invEnsure();
    const invHas=(name)=>inv.some(i=>i.qty>0 && (i.name.includes(name)||name.includes(i.name.split(' ')[0])));
    body=`<div class="cwq">${L('מרכיבים וציוד','Ingredients & equipment')}</div><div class="cwsub">${L('✓ = יש במזווה · חסרים יתווספו לרשימת הקניות.','✓ = in the pantry · missing ones are added to the shopping list.')}</div>
      <div class="cscard">${mats.length?mats.map(mt=>{const key=String(mt).split(/[0-9]/)[0].trim();const have=invHas(key);
        return `<div class="pw-mat ${have?'have':''}"><span>${have?'✓':'○'}</span> ${t(String(mt))}</div>`;}).join(''):`<div style="color:var(--smoke);font-size:12.5px">${L('אין רשימת מרכיבים ייעודית.','No dedicated ingredient list.')}</div>`}</div>
      <button class="ccta" data-pwnext>${L('סקירה ויצירה ←','Review & create →')}</button>`;
  } else {
    const tgt=s.type==='dry'?`${L('יעד','target')} ${Math.round(s.startW*s.factor)} ${L('ג׳','g')} (${L('ירידה','loss')} ${Math.round((1-s.factor)*100)}%)`:`${s.days} ${L('ימים','days')} · ${L('סיום','finish')} ${fmtDate(addDays(s.start,s.days))}`;
    body=`<div class="cwq">${L('סקירה','Review')}</div><div class="cwsub">${L('בדוק ואשר — ייווצרו תזכורות אוטומטיות.','Check and confirm — automatic reminders will be created.')}</div>
      <div class="cscard">
        <div class="pw-rr"><span>${L('שם','Name')}</span><b>${s.name}</b></div>
        <div class="pw-rr"><span>${L('סוג','Type')}</span><b>${s.type==='dry'?L('ייבוש למשקל','Dry to weight'):L('כבישה בימים','Cure by days')}</b></div>
        <div class="pw-rr"><span>${L('התחלה','Start')}</span><b>${fmtDate(s.start)}</b></div>
        <div class="pw-rr"><span>${L('יעד','Target')}</span><b>${tgt}</b></div>
      </div>
      <button class="ccta" data-pwcreate>✓ ${L('צור פרויקט','Create project')}</button>`;
  }
  const backBtn=s.step>0?`<button class="cwclear" data-pwback style="margin:0 16px 8px">${L('← חזרה','← Back')}</button>`:'';
  host.innerHTML=body+backBtn;
  const g=sel=>host.querySelector(sel);
  if(g('#pwn')) g('#pwn').addEventListener('input',e=>s.name=e.target.value);
  if(g('#pwstart')) g('#pwstart').addEventListener('change',e=>s.start=e.target.value);
  host.querySelectorAll('[data-pwt]').forEach(b=>b.addEventListener('click',()=>{s.type=b.dataset.pwt;pwRender();}));
  host.querySelectorAll('[data-pwf]').forEach(b=>b.addEventListener('click',()=>{s.factor=+b.dataset.pwf;pwRender();}));
  if(g('[data-pwwm]')) g('[data-pwwm]').addEventListener('click',()=>{s.startW=Math.max(100,s.startW-100);pwRender();});
  if(g('[data-pwwp]')) g('[data-pwwp]').addEventListener('click',()=>{s.startW=s.startW+100;pwRender();});
  if(g('[data-pwdm]')) g('[data-pwdm]').addEventListener('click',()=>{s.days=Math.max(1,s.days-1);pwRender();});
  if(g('[data-pwdp]')) g('[data-pwdp]').addEventListener('click',()=>{s.days=s.days+1;pwRender();});
  if(g('[data-pwback]')) g('[data-pwback]').addEventListener('click',()=>{s.step--;pwRender();});
  if(g('[data-pwnext]')) g('[data-pwnext]').addEventListener('click',()=>{s.step++;pwRender();});
  if(g('[data-pwcreate]')) g('[data-pwcreate]').addEventListener('click',pwCreate);
}
function pwCreate(){
  const s=pwState; if(!s) return;
  const p={id:uid(),key:s.meta.key,name:s.name||s.meta.heb,type:s.type,start:s.start||today(),doneSteps:[]};
  if(s.type==='scratch'){ p.source='scratch'; p.stage='building'; }
  else if(s.type==='dry'){ p.startW=s.startW||1000; p.factor=s.factor||0.62; p.curW=p.startW; }
  else { p.days=s.days||7; }
  const a=pantry(); a.push(p); savePantry(a);
  // auto-generate reminders
  projSeedReminders(p);
  store.set('mk-lastproj',p.id);
  pwState=null;
  if(typeof toast==='function') toast(s.type==='scratch'?L('פרויקט מאפס נוצר 🍖 · עקוב אחרי השלבים במזווה','Scratch project created 🍖 · follow the steps in the pantry'):L('הפרויקט נוצר · תזכורות נוספו ✓','Project created · reminders added ✓'));
  if(typeof closePanel==='function') closePanel();
  if(typeof cNavGo==='function') cNavGo('projects'); else if(typeof cPaintProjects==='function') cPaintProjects();
}
// auto-seed reminders based on project type/duration
function projSeedReminders(p){
  const rem=reminders(); const add=(text,date)=>rem.push({id:uid(),text:`[${p.name}] ${text}`,date,proj:p.id});
  if(p.type==='scratch'){ add(L('סיים והכן להגשה / אחסון','Finish and prep for serving / storage'),addDays(p.start,1)); store.set('mk-reminders',rem); return; }
  if(p.type==='dry'){
    add(L('בדוק משקל ושקול','Check and weigh'),addDays(p.start,7));
    add(L('בדוק לחות/עובש לבן תקין','Check humidity / healthy white mold'),addDays(p.start,14));
    const half=Math.max(21,Math.round((p.startW?21:21)));
    add(L('שקילה — קרוב ליעד?','Weigh — close to target?'),addDays(p.start,28));
  } else {
    add(L('הפוך/ערבב את המוצר','Flip / mix the product'),addDays(p.start,Math.max(1,Math.round(p.days/2))));
    add(L('סיום כבישה — הוצא ושטוף','End of cure — remove and rinse'),addDays(p.start,p.days));
  }
  store.set('mk-reminders',rem);
}
// catalog category tiles → jump into existing catalog filtered
const CCAT_TILES=[
  ['בקר','🥩','var(--beef,#c65a3f)'],['עוף','🍗','var(--poultry,#daa04a)'],['נקניקיות','🌭','var(--sausage,#e07a52)'],
  ['נקניק מיובש','🧂','var(--dried,#b07a3a)'],['טלה','🐑','var(--terra)'],['חזיר','🥩','var(--fruit,#e0748a)'],
  ['ירקות','🥦','var(--veg,#5aa84a)'],['פירות','🍑','var(--fruit,#e0748a)'],['דג','🐟','var(--fish,#5a9ab0)'],
  ['איברים פנימיים','🫀','#b06a7a'],['נקניק מעושן','🥓','var(--dried,#b07a3a)'],['מיוחדים','⭐','var(--ember2)'],
];
// P8 — AI tools hub: one discoverable place for every AI feature, reachable at EVERY interface level.
// The only gate is the API key (aiAvail), never experience level — without a key the tools still show, with an "unlock" route.
// [icon, title, blurb, fn, needsKey]. Add new AI tools here.
// Wave 3 · photo analyzer — Gemini multimodal read of bark / doneness / smoke-ring / charcuterie mold. ALWAYS advisory ("probe decides").
async function gemVision(dataUrl, prompt){
  if(typeof aiAvail!=='function' || !aiAvail()) throw new Error('no-key');   // managed central access OR a personal key
  const m=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/); if(!m) throw new Error('bad-image');
  const body={ contents:[{parts:[{inlineData:{mimeType:m[1], data:m[2]}}, {text:prompt}]}], generationConfig:{temperature:0.4, maxOutputTokens:800, thinkingConfig:{thinkingBudget:0}} };
  const r=await gemFetch(GEM_MODEL, body, {timeout:40000}); if(!r.ok) throw new Error('api-'+r.status);
  const j=await r.json(); const cand=j.candidates&&j.candidates[0];
  const txt=cand&&cand.content&&(cand.content.parts||[]).map(function(p){return p.text||'';}).join('').trim();
  if(!txt) throw new Error('empty'); return txt;
}
function _photoPrompt(){ const he=(typeof getLang!=='function'||getLang()==='he');
  return he
    ? 'אתה מומחה בישול-אש. נתח את התמונה של בשר/נקניק על האש: הערך קרום (bark), טבעת עשן, מידת עשייה חיצונית, ולשרקוטרי — עובש/התקשות-שפה. תשובה קצרה ומעשית בעברית. חשוב: זו הערכה ויזואלית בלבד — סיים תמיד ב"אמת עם מדחום לפי טמפ׳ הבטיחות בכרטיס". אל תקבע מספר טמפ׳-פנים בטוחה מהתמונה.'
    : 'You are a fire-cooking expert. Analyze this photo of meat/sausage on the fire: assess bark, smoke ring, exterior doneness, and for charcuterie mold/case-hardening. Short, practical answer in English. IMPORTANT: this is a VISUAL estimate only — always end with "confirm with a probe against the safe temp on the card". Never state a numeric safe internal temperature from the photo.';
}
function openPhotoAnalyze(){
  if(typeof showPanel!=='function') return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  showPanel(`${typeof toolTop==='function'?toolTop(L('ניתוח תמונה','Photo read'),L('צלם/העלה — אעריך קרום, עשייה, עובש','Snap/upload — I’ll read the bark, doneness, mold'),'📸','#7a5cc2'):`<h2 style="padding:16px">${L('ניתוח תמונה','Photo read')}</h2>`}
    <div class="panel-body">
      <div class="pa-note">📸 ${he?'הערכה ויזואלית · 🌡️ המדחום מכריע':'Advises visually · 🌡️ the probe decides'}</div>
      <input type="file" accept="image/*" id="paFile" class="cop-in" style="padding:9px">
      <div id="paPreview"></div>
      <button class="ccta" id="paGo" style="margin-top:10px" disabled>✨ ${he?'נתח':'Analyze'}</button>
      <div id="paResult"></div>
    </div>`);
  let dataUrl=null;
  const f=$("#paFile"); if(f) f.addEventListener('change',function(){ const file=f.files&&f.files[0]; if(!file) return; const rd=new FileReader(); rd.onload=function(){ dataUrl=rd.result; const pv=$("#paPreview"); if(pv) pv.innerHTML=`<img src="${dataUrl}" alt="" style="max-width:100%;border-radius:12px;margin:10px 0">`; const go=$("#paGo"); if(go) go.disabled=false; }; rd.readAsDataURL(file); });
  const go=$("#paGo"); if(go) go.addEventListener('click',async function(){ if(!dataUrl) return; const res=$("#paResult");
    if(typeof aiAvail!=='function' || !aiAvail()){ if(res) res.innerHTML=`<div class="ai-keybanner"><span>🔑 ${he?'ניתוח תמונות דורש מפתח AI.':'Photo analysis needs an AI key.'}</span><button class="ai-calc-link" id="paKey">${he?'הוסף מפתח':'Add key'}</button></div>`; const kb=$("#paKey"); if(kb) kb.addEventListener('click',function(){ if(typeof openKeyManager==='function') openKeyManager(); }); return; }
    if(res) res.innerHTML=`<div class="cop-pacenote">${(typeof aiSpinner==='function')?aiSpinner(he?'מנתח את התמונה':'Analyzing the photo'):'…'}</div>`;
    try{ const txt=await gemVision(dataUrl, _photoPrompt()); if(res) res.innerHTML=`<div class="pa-read">${esc(txt).replace(/\n/g,'<br>')}${(typeof aiSafetyNote==='function')?aiSafetyNote(txt, (typeof SAFETY_FACTS==='function'?SAFETY_FACTS():'')):''}</div>`; }
    catch(e){ if(res) res.innerHTML=`<div class="cop-pacenote cop-pace-warn">${he?'הניתוח נכשל — נסה שוב או בדוק את המפתח.':'Analysis failed — try again or check your key.'}</div>`; }
  });
}
const AI_TOOLS=[
  ['📸', L('ניתוח תמונה','Photo read'), L('צלם את הבישול — קרום, עשייה, עובש (הערכה)','Snap your cook — bark, doneness, mold (advisory)'), 'openPhotoAnalyze', true],
  ['🔥', L('שאל את האש','Ask the Fire'), L('שאלות חופשיות — זמן, טמפ׳, עץ, כמות, כשרות, איפה לקנות','Free questions — time, temp, wood, quantity, kosher, where to buy'), 'openAsk', false],
  ['✨', L('מחולל מתכונים','Recipe generator'), L('צור מתכון חדש בשפה חופשית','Generate a new recipe from a free description'), 'openRecipeGen', true],
  ['🩺', L('אבחון תקלה','Diagnose a cook'), L('תאר מה השתבש — אבחון לפי היומן והפרויקטים שלך','Describe what went wrong — diagnosed against your journal'), 'openDiagnoseAI', true],
  ['📊', L('תובנות יומן','Journal insights'), L('דפוסים מהבישולים הקודמים שלך','Patterns from your past cooks'), 'openJournalInsights', true],
];
function openAiHub(){
  if(typeof showPanel!=='function') return;
  const key=(typeof aiAvail==='function' && aiAvail());
  const items=AI_TOOLS.map(function(tl){ const locked=tl[4] && !key; const fn=locked?'openKeyManager':tl[3];
    return `<button class="ai-tool${locked?' ai-locked':''}" data-aifn="${fn}"><span class="ai-tic">${tl[0]}</span><span class="ai-tbody"><b>${tl[1]}${locked?' <span class="ai-lock">🔒</span>':''}</b><small>${tl[2]}</small></span><span class="ai-go">←</span></button>`;
  }).join('');
  const keyBanner = key ? '' : `<button class="ai-keybanner" data-aifn="openKeyManager">🔑 <span><b>${L('הוסף מפתח AI כדי לפתוח את הכל','Add an AI key to unlock everything')}</b> — ${L('מפתח Gemini אישי (חינמי)','a personal Gemini key (free)')}</span><span class="ai-go">←</span></button>`;
  showPanel(`${typeof toolTop==='function'?toolTop(L('כלי AI','AI tools'),L('כל היכולות החכמות במקום אחד','Every smart feature in one place'),'🤖','#7a5cc2'):`<h2 style="padding:16px">${L('כלי AI','AI tools')}</h2>`}
    <div class="panel-body">${keyBanner}<div class="ai-tools">${items}</div>
    <p class="section-sub" style="margin-top:14px">${L('הכלים זמינים בכל רמת ממשק. חלקם דורשים חיבור AI (מפתח אישי).','These tools are available at every interface level. Some need an AI connection (a personal key).')}</p></div>`);
  $("#panel").querySelectorAll('[data-aifn]').forEach(function(b){ b.addEventListener('click',function(){ const fn=b.dataset.aifn;
    if(typeof closePanel==='function') closePanel(); setTimeout(function(){ if(typeof window[fn]==='function') window[fn](); }, 60);
  }); });
}
// P7 — the "Customize home" editor: drag to reorder + tap to show/hide each home module, with reset-to-smart-default.
function openHomeCustom(){
  if(typeof showPanel!=='function') return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  const order=homeCustomOrder();
  const nameOf=id=>{ const m=HOME_MODULES.find(x=>x.id===id); return m?(he?m.he:m.en):id; };
  const rows=order.map(function(id){ const on=homeModOn(id);   // true visibility, incl. level gates — not just the off-list
    return `<div class="hc-row" data-hcid="${id}"><span class="hc-handle" aria-hidden="true">⠿</span><span class="hc-name">${nameOf(id)}</span><button class="hc-toggle${on?' on':''}" data-hctoggle="${id}">${on?(he?'מוצג':'Shown'):(he?'מוסתר':'Hidden')}</button></div>`;
  }).join('');
  showPanel(`${typeof toolTop==='function'?toolTop(L('התאמת מסך הבית','Customize home'),L('גרור לשינוי סדר · הקש להצגה/הסתרה','Drag to reorder · tap to show/hide'),'⚙️','#5a7d8c'):`<h2 style="padding:16px">${L('התאמת מסך הבית','Customize home')}</h2>`}
    <div class="panel-body">
      <p class="section-sub">${L('בחר אילו חלקים יופיעו במסך הבית ובאיזה סדר. חלק שתדליק כאן יוצג גם אם רמת הממשק שלך לא מציגה אותו כברירת מחדל.','Choose which parts of the home show, and in what order. Anything you switch on here shows even if your interface level hides it by default.')}</p>
      <div class="hc-list" id="hcList">${rows}</div>
      <button class="hc-reset" id="hcReset">↺ ${L('אפס לברירת המחדל החכמה','Reset to the smart default')}</button>
    </div>`);
  const listEl=$("#hcList"); if(!listEl) return;
  const save=function(){ const ord=[].slice.call(listEl.querySelectorAll('.hc-row')).map(r=>r.dataset.hcid);
    const offArr=[].slice.call(listEl.querySelectorAll('.hc-toggle:not(.on)')).map(b=>b.dataset.hctoggle);
    const onArr=[].slice.call(listEl.querySelectorAll('.hc-toggle.on')).map(b=>b.dataset.hctoggle).filter(homeModGate);   // only gated modules need a recorded opt-in
    store.set('mk-homecustom',{order:ord, off:offArr, on:onArr}); if(typeof cRefreshHome==='function') cRefreshHome(); };
  listEl.querySelectorAll('[data-hctoggle]').forEach(function(b){ b.addEventListener('click',function(){ b.classList.toggle('on');
    b.textContent = b.classList.contains('on')?(he?'מוצג':'Shown'):(he?'מוסתר':'Hidden'); save(); }); });
  { const r=$("#hcReset"); if(r) r.addEventListener('click',function(){ store.set('mk-homecustom',null); if(typeof cRefreshHome==='function') cRefreshHome(); openHomeCustom(); }); }
  hcWireDrag(listEl, save);
}
// "Customize dock" — pick WHICH pit-tools appear + order, from the full pool (owner-requested). Reuses the drag/toggle pattern.
function openDockCustom(){
  if(typeof showPanel!=='function') return;
  const he=(typeof getLang!=='function'||getLang()==='he');
  const chosen=dockTools(); const chosenSet=new Set(chosen); const byFn={}; DOCK_POOL.forEach(function(t){ byFn[t[3]]=t; });
  const ordered=chosen.map(function(fn){return byFn[fn];}).filter(Boolean).concat(DOCK_POOL.filter(function(t){return !chosenSet.has(t[3]);}));   // chosen (in order) first, then the rest of the pool
  const rows=ordered.map(function(t){ const on=chosenSet.has(t[3]);
    return `<div class="hc-row" data-hcid="${t[3]}"><span class="hc-handle" aria-hidden="true">⠿</span><span class="dk-ic">${t[0]}</span><span class="hc-name">${he?t[1]:t[2]}</span><button class="hc-toggle${on?' on':''}" data-hctoggle="${t[3]}">${on?(he?'✓ במזח':'✓ In'):(he?'+ הוסף':'+ Add')}</button></div>`;
  }).join('');
  showPanel(`${typeof toolTop==='function'?toolTop(L('כלי הפיטמאסטר','Pitmaster tools'),L('בחר וסדר את הכלים במזח','Pick and order the dock tools'),'🛠️','#5a7d8c'):`<h2 style="padding:16px">${L('כלי הפיטמאסטר','Pitmaster tools')}</h2>`}
    <div class="panel-body">
      <p class="section-sub">${L('בחר אילו כלים יופיעו במזח הכלים שבמסך הבית ובאיזה סדר. גרור לשינוי סדר, הקש להוספה/הסרה.','Choose which tools appear in the home dock, and in what order. Drag to reorder, tap to add/remove.')}</p>
      <div class="hc-list" id="dkList">${rows}</div>
      <button class="hc-reset" id="dkReset">↺ ${L('אפס לברירת המחדל','Reset to default')}</button>
    </div>`);
  const listEl=$("#dkList"); if(!listEl) return;
  const save=function(){ const inc=[].slice.call(listEl.querySelectorAll('.hc-row')).filter(function(r){ const tb=r.querySelector('.hc-toggle'); return tb&&tb.classList.contains('on'); }).map(function(r){return r.dataset.hcid;});
    store.set('mk-dock-tools', inc); if(typeof cRefreshHome==='function') cRefreshHome(); };
  listEl.querySelectorAll('[data-hctoggle]').forEach(function(b){ b.addEventListener('click',function(){ b.classList.toggle('on');
    b.textContent=b.classList.contains('on')?(he?'✓ במזח':'✓ In'):(he?'+ הוסף':'+ Add'); save(); }); });
  { const r=$("#dkReset"); if(r) r.addEventListener('click',function(){ store.set('mk-dock-tools',null); if(typeof cRefreshHome==='function') cRefreshHome(); openDockCustom(); }); }
  if(typeof hcWireDrag==='function') hcWireDrag(listEl, save);
}
// pointer-based drag reorder (works on touch): drag a row's handle; on drop, persist the new order.
// Move/up are bound on document (not the handle) so drags keep tracking after the pointer leaves the handle.
function hcWireDrag(listEl, onDrop){
  listEl.querySelectorAll('.hc-row').forEach(function(row){
    const handle=row.querySelector('.hc-handle')||row;
    handle.addEventListener('pointerdown', function(e){
      e.preventDefault(); row.classList.add('hc-dragging');
      const move=function(ev){ const y=ev.clientY; let placed=false;
        const others=[].slice.call(listEl.querySelectorAll('.hc-row:not(.hc-dragging)'));
        for(let i=0;i<others.length;i++){ const rect=others[i].getBoundingClientRect(); if(y < rect.top+rect.height/2){ listEl.insertBefore(row, others[i]); placed=true; break; } }
        if(!placed) listEl.appendChild(row);
      };
      const up=function(){ row.classList.remove('hc-dragging');
        document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up); document.removeEventListener('pointercancel',up);
        if(row.isConnected && typeof onDrop==='function') onDrop();   // skip a stale save if the editor was closed mid-drag (e.g. Escape)
      };
      document.addEventListener('pointermove',move); document.addEventListener('pointerup',up); document.addEventListener('pointercancel',up);
    });
  });
}
// more sheet — grouped tools. Phase 6: data-driven + adaptive — a "most-used" top section, and advanced items (adv:true)
// trimmed for beginners so the sheet gets shorter for the default persona. Each item = [icon, label, fn, adv?].
function openMoreSheet(){
  if(typeof showPanel!=='function'){ if(typeof openTools==='function') openTools(); return; }
  const beg=(typeof uiLevel==='function' && uiLevel()==='beginner');
  const GROUPS=[
    ['🍽️', L('עבודה','Work'), [['🔥',L('פעיל עכשיו','Active now'),'openActive'],['🍽️',L('בונה ארוחה','Meal builder'),'openMenu'],['📋',L('מתזמן','Scheduler'),'openTimeline',true],['🖨️',L('הדפסת תפריט','Print menu'),'openMenuPrint',true],['🛒',L('רשימת קניות','Shopping list'),'openCart']]],
    ['✨', L('חוויה','Experience'), [['🤖',L('כלי AI','AI tools'),'openAiHub'],['🧂',L('מתבלים ורטבים','Seasonings & sauces'),'openSeasonings'],['🔥',L('שאל את האש','Ask the Fire'),'openAsk'],['✨',L('מחולל מתכונים','Recipe generator'),'openRecipeGen']]],
    ['🧰', L('עזר','Utilities'), [['🧮',L('מחשבון מלח/כמויות','Salt/quantity calculator'),'openCalc'],['🥩',L('מתרגם נתחים','Cut translator'),'openCutTrans',true],['🌳',L('סוגי עץ','Wood types'),'openWoods'],['🧫',L('פרויקטים ומזווה','Projects & pantry'),'openPantry'],['⏰',L('תזכורות','Reminders'),'openReminders',true],['📓',L('יומן','Journal'),'openJournal'],['📖',L('מילון','Glossary'),'__gloss']]],
    ['⚙️', L('הגדרות ועזרה','Settings & help'), [['🎨',L('מראה — גוונים, פונט וגודל','Appearance — themes, font and size'),'openAppearance'],['🧭',L('רמת ממשק — מתחיל/בינוני/מתקדם','Interface level — beginner/intermediate/advanced'),'openUiLevel'],['🎚️',L('התנהגות ואוטומציה','Behavior & automation'),'openPrefGroup'],['🎛️',L('התאמת מסך הבית','Customize home'),'openHomeCustom'],['🧰',L('הציוד שלי','My equipment'),'openEquipment'],['✨',L('תאר את הציוד שלי','Describe my gear'),'openGearConcierge'],['❓',L('איך משתמשים','How to use'),'openGuide'],['🆘',L('מצב הצילו (תקלות)','Rescue mode (problems)'),'openHelp'],['🔑',L('נהל מפתח AI','Manage AI key'),'openKeyManager'],['ℹ️',L('אודות והיכולות','About & features'),'__about'],['💾',L('גיבוי ושחזור','Backup & restore'),'openBackup']]],
  ];
  const reg={}; GROUPS.forEach(g=>g[2].forEach(it=>reg[it[2]]=it));
  const visible=it=>!(beg && it[3]);                                   // advanced items hidden at beginner level
  // "most-used": recent tools from history, backfilled with a curated default so it's never sparse
  let recent=((typeof store!=='undefined'&&store.get('mk-recent-tools'))||[]).map(fn=>reg[fn]).filter(Boolean).filter(visible).slice(0,5);
  ['openAsk','openCalc','openSeasonings','openJournal','openEquipment'].map(fn=>reg[fn]).filter(Boolean).filter(visible).forEach(d=>{ if(recent.length<5 && recent.indexOf(d)<0) recent.push(d); });
  const quick=recent.length?`<div class="cmore-grp cmore-quick"><h4>⭐ ${L('בשימוש נפוץ','Most used')}</h4><div class="cmore-quickrow">${recent.map(([ic,label,fn])=>`<button class="cmore-qchip" data-mfn="${fn}"><span>${ic}</span>${label}</button>`).join('')}</div></div>`:'';
  const grp=(ic,title,items)=>{ const its=items.filter(visible); if(!its.length) return ''; return `<div class="cmore-grp"><h4>${ic} ${title}</h4>${its.map(([i,label,fn])=>`<div class="cmore-item" data-mfn="${fn}"><span class="mi">${i}</span>${label}<span class="mg">←</span></div>`).join('')}</div>`; };
  const html=`${typeof toolTop==='function'?toolTop(L('עוד','More'),L('כל הכלים והתכונות','All the tools and features'),'☰','#e07a52'):`<h2 style="padding:16px">${L('עוד','More')}</h2>`}
    <div class="panel-body">${langRowHtml()}${quick}${GROUPS.map(g=>grp(g[0],g[1],g[2])).join('')}</div>`;
  showPanel(html);
  if(typeof wireLangRow==='function') wireLangRow($("#panel"));
  document.querySelectorAll('#panel [data-mfn]').forEach(el=>el.addEventListener('click',()=>{
    const fn=el.dataset.mfn;
    try{ if(reg[fn]){ const r=((store.get('mk-recent-tools'))||[]).filter(x=>x!==fn); r.unshift(fn); store.set('mk-recent-tools', r.slice(0,8)); } }catch(e){}   // remember for "most used"
    if(fn==='__about'){ if(typeof closePanel==='function') closePanel(); setTimeout(openAbout,60); return; }
    if(fn==='__gloss'){ closePanel&&closePanel(); cNavGo('catalog'); requestAnimationFrame(()=>{ if(typeof catView==='function') catView('gloss'); }); return; }
    if(typeof window[fn]==='function'){ if(typeof closePanel==='function') closePanel(); setTimeout(()=>window[fn](),60); }
  }));
}
// wire nav + home controls
// wizard triggers get cStartNewEvent below — exclude them here so we never have to clone them off cNavGo (cloneNode strips the i18n _mkO restore expando → title stuck in the other language)
document.querySelectorAll('[data-cnav]').forEach(b=>{ if(b.dataset.cnav==='wizard') return; b.addEventListener('click',()=>cNavGo(b.dataset.cnav)); });
document.querySelectorAll('[data-cgo]').forEach(b=>{ if(b.dataset.cgo==='wizard') return; b.addEventListener('click',()=>cNavGo(b.dataset.cgo)); });
// floating Active-now shortcut: click → hub; keep it in sync on boot + a slow tick (for ringing while idle on a screen)
(()=>{ const fab=$("#cActiveFab"); if(fab) fab.addEventListener('click',()=>{ if(typeof openActive==='function') openActive(); }); try{ if(typeof syncActiveFab==='function'){ syncActiveFab(); setInterval(syncActiveFab, 5000); } }catch(e){} })();
// Phase 4 home chrome (buttons persist; only their innerHTML is re-rendered, so wire once): gear chip → gear editor, multi-event bar → command center
(()=>{ const gc=$("#cHomeGearChip"); if(gc) gc.addEventListener('click',()=>{ if(typeof openEquipment==='function') openEquipment(); }); const mv=$("#cHomeMultiEv"); if(mv) mv.addEventListener('click',()=>{ if(typeof openCombinedTimeline==='function') openCombinedTimeline(); }); })();
// "יש לי אירוע" path + FAB → start a NEW clean event (guard unsaved draft)
function cStartNewEvent(){ setMenuCtx('event'); evGuardBeforeNew(()=>{ cwGo(0); cNavGo('wizard'); cwSyncFromMenu(); }); }
function cStartCook(){ setMenuCtx('cook'); cwGo(0); cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); }
document.querySelectorAll('[data-cgo="wizard"],[data-cnav="wizard"]').forEach(b=>b.addEventListener('click',cStartNewEvent));
// UX #12: real global search from home — typing carries the query into the catalog search and shows results
(()=>{ const wrap=$("#cHomeSearch"); const inp=$("#cHomeSearchInput");
  if(inp){
    const jump=()=>{ const v=inp.value; if(typeof cNavGo==='function') cNavGo('catalog'); const q=$("#q"); if(q){ q.value=v; q.focus(); } if(typeof catView==='function') catView(v.trim()?'search':'landing'); };
    inp.addEventListener('input', jump);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); jump(); } });
  } else if(wrap){ wrap.addEventListener('click',()=>cNavGo('catalog')); }
})();
(()=>{ const m=$("#cHomeMore"); if(m) m.addEventListener('click',openMoreSheet); })();
function openLangMenu(){ showPanel(`${toolTop(t('🌐 שפה'),t('בחר שפה'),'🌐','#5a7d8c')}<div class="panel-body">${langRowHtml()}</div>`); wireLangRow($("#panel")); }
(()=>{ const lb=$("#cHomeLang"); if(lb) lb.addEventListener('click',openLangMenu); try{ syncHomeLang(); }catch(e){} })();
(()=>{ const a=$("#cHomeAbout"); if(a) a.addEventListener('click',()=>{ if(typeof openGuide==='function') openGuide(); }); })();
// gear banner ↔ chip are symmetric: banner prompts setup when unconfigured, chip (in renderHomeChrome) takes over once configured.
// Managed on every cRefreshHome (not boot-once) so it reappears if gear is un-configured mid-session (e.g. a full data reset). L()-generated so a cNavGo re-create can't leak Hebrew in English.
function syncGearBanner(){
  const host=$("#cGearBanner"); if(!host) return;
  if(typeof gearConfigured==='function' && !gearConfigured()){
    if(!host.firstChild){
      host.innerHTML=`<button class="gear-banner" id="gearBanner">🔧 <span><b>${L('הגדר את הציוד שלך','Set up your equipment')}</b> — ${L('כדי שהמתכונים יתאימו למה שיש לך','so recipes match what you have')}</span><span class="gb-go">←</span></button>`;
      const b=$("#gearBanner"); if(b) b.addEventListener('click',()=>{ if(typeof openEquipment==='function') openEquipment(); });
    }
  } else host.innerHTML='';
}
(()=>{ try{ syncGearBanner(); }catch(e){} })();
(()=>{ const a=$("#cHomeAsk"); if(a) a.addEventListener('click',()=>{ if(typeof openAsk==='function') openAsk(); }); })();
(()=>{ const a=$("#cHomeAiMore"); if(a) a.addEventListener('click',()=>{ if(typeof openAiHub==='function') openAiHub(); }); })();   // P8: home → AI tools hub (all levels)
(()=>{ const r=$("#cResume"); if(r) r.addEventListener('click',()=>{ const d=store.get('mk-cresume')||{}; if(typeof setMenuCtx==='function') setMenuCtx(d.ctx||'event'); if(typeof cwGo==='function') cwGo(typeof d.step==='number'?d.step:5); if(typeof cNavGo==='function') cNavGo('wizard'); if(typeof cwSyncFromMenu==='function') cwSyncFromMenu(); }); })();
// dismiss the "resume where you left off" card — discard the unsaved draft so it stops appearing
(()=>{ const x=$("#cResumeX"); if(x) x.addEventListener('click',async(e)=>{ e.stopPropagation();
  if(typeof appConfirm==='function' && (await appConfirm(L('לבטל את הטיוטה שלא נשמרה?','Discard the unsaved draft?'),{okLabel:L('בטל טיוטה','Discard'),danger:true}))!==true) return;
  const d=store.get('mk-cresume')||{}; const ctx=(d.ctx==='cook')?'cook':'event';
  const empty={guests:8,appetite:'reg',kosher:false,keys:[],sides:[],drinks:[],desserts:[],gpm:0};
  store.set(ctx==='cook'?'mk-cook':'mk-menu',empty); store.set('mk-cresume',null);
  try{ if(ctx==='event' && typeof evClearActive==='function') evClearActive(); }catch(_){}
  if(typeof toast==='function') toast(L('הטיוטה בוטלה','Draft discarded'));
  if(typeof cRefreshHome==='function') cRefreshHome();
}); })();
// stop / clear the "cooking now" banner. A timer started from a recipe step (not the timeline) isn't
// scoped to any event, so "Stop plan" can't reach it and it only auto-clears 12h after its end — leaving
// the banner stuck with no way out. This ✕ clears EVERY started-plan flag + all timers, so it's always removable.
(()=>{ const x=$("#cCookingX"); if(x) x.addEventListener('click',async(e)=>{ e.stopPropagation();
  if(typeof appConfirm==='function' && (await appConfirm(L('לעצור את הבישול הפעיל ולנקות את כל הטיימרים?','Stop the active cook and clear all its timers?'),{okLabel:L('עצור ונקה','Stop & clear'),danger:true}))!==true) return;
  try{ const rm=[]; for(let i=0;i<localStorage.length;i++){ const kk=localStorage.key(i)||''; if(kk.indexOf('mk-plan-started-')===0) rm.push(kk); } rm.forEach(k=>localStorage.removeItem(k)); }catch(_){}
  store.set('mk-timers',{});
  try{ if(typeof clearTimers==='function') clearTimers(); }catch(_){}
  if(typeof toast==='function') toast(L('הבישול הפעיל נעצר','Active cook stopped'));
  if(typeof cRefreshHome==='function') cRefreshHome();
}); })();
(()=>{ const r=$("#cResumeProj"); if(r) r.addEventListener('click',()=>cNavGo('projects')); })();
// dismiss the "resume project" card (just hides the shortcut; the project itself stays in Projects)
(()=>{ const x=$("#cResumeProjX"); if(x) x.addEventListener('click',(e)=>{ e.stopPropagation(); store.set('mk-lastproj',null); const pb=$("#cResumeProj"); if(pb) pb.hidden=true; }); })();
(()=>{ const c=$("#cPathCook"); if(c) c.addEventListener('click',(e)=>{ e.stopPropagation(); cStartCook(); }); })();   // the "or just cook" branch lives inside the hosting card — don't also trigger the card's new-event handler
(()=>{ const c=$("#cPathProj"); if(c) c.addEventListener('click',()=>{ if(typeof openProjectPicker==='function') openProjectPicker(); else cNavGo('projects'); }); })();
document.querySelectorAll('[data-mfn="__more"]').forEach(b=>b.addEventListener('click',openMoreSheet));
(()=>{ const n=$("#cEvNew"); if(n) n.addEventListener('click',cStartNewEvent); })();
(()=>{ const a=$("#cEvAiPlan"); if(a) a.addEventListener('click',openEventPlanner); })();
// ── one-time migration: old global seas:<recipeKey> → context-scoped seas:cook:<recipeKey> ──
(function migrateSeasContext(){
  try{
    if(store.get('mk-seas-migrated')) return;
    const moves=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && /^seas:(cut-|spec-|make-)/.test(k)) moves.push(k);
    }
    moves.forEach(k=>{
      const rest=k.slice(5);              // after "seas:"
      const nk='seas:cook:'+rest;
      if(localStorage.getItem(nk)===null){ localStorage.setItem(nk, localStorage.getItem(k)); }
      localStorage.removeItem(k);
    });
    store.set('mk-seas-migrated',1);
  }catch(e){ /* non-fatal */ }
})();
try{ cRefreshHome(); cNavGo('home'); }catch(e){ /* headless/init guard */ }
try{ if(typeof startTimerWatch==='function') startTimerWatch(); }catch(e){}   // parallel multi-event alarms
try{ if(typeof anyTimerRinging==='function' && anyTimerRinging()){ if(typeof renderAlarm==='function') renderAlarm(); if(typeof startRingLoop==='function') startRingLoop(); } }catch(e){}   // reopened while a timer is ringing → show the in-app alarm + resume the re-pulse
// Wave 5: keep translating as the SPA re-renders. childList only (subtree) — tnode edits text values,
// not structure, so it never re-triggers itself. Debounced; no-op in Hebrew.
try{ let _tnTmo=null; const _mo=new MutationObserver(function(){ if(getLang()==='he') return; clearTimeout(_tnTmo); _tnTmo=setTimeout(function(){ try{ applyI18n(document.body); }catch(e){} try{ tnode(document.body); }catch(e){} try{ hydrateMT(document.body); }catch(e){} }, 50); }); _mo.observe(document.body, {childList:true, subtree:true}); }catch(e){}
try{ if(typeof requestPersist==='function') requestPersist(); }catch(e){}   // Wave C: ask for persistent storage so a live cook's data isn't evicted
try{ document.addEventListener('pointerdown', function(){ if(typeof timerAudioPrime==='function') timerAudioPrime(); }, {once:true}); }catch(e){}   // R4: unlock audio on first gesture so timers restored after a reload still beep
try{ setTimeout(()=>{ if(typeof maybeAskUiLevel==='function') maybeAskUiLevel(); }, 400); }catch(e){}
/* T4: register the service worker in production (https only — the http test server skips it).
   Prompts a refresh when a new build has been fetched and is waiting. */
if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){
      mkSWReg=reg; try{ navigator.serviceWorker.ready.then(function(r){ mkSWReg=r||reg; }); }catch(e){}   // Wave A: alarms show via the SW registration (fixes the mobile new Notification() no-op)
      reg.addEventListener('updatefound',function(){ const nw=reg.installing; if(!nw) return;
        nw.addEventListener('statechange',function(){ if(nw.state==='installed' && navigator.serviceWorker.controller && typeof toast==='function'){
          if((typeof anyTimerActive==='function'&&anyTimerActive())||(typeof planStarted==='function'&&planStarted())) return;   // don't interrupt a live cook — the update applies on the next natural reload
          toast('גרסה חדשה זמינה', function(){location.reload();}, 'רענן עכשיו'); } });
      });
      // Actively ASK for a new worker instead of waiting for the browser to notice. An installed PWA that is
      // resumed (phone picked up by the smoker) may never issue a navigation, so without this a shipped
      // version can sit undelivered indefinitely — v255 reached the server but not the device. Check on
      // launch, and again whenever the app comes back to the foreground.
      const _swPoke=function(){ try{ reg.update(); }catch(e){} };
      _swPoke();
      document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') _swPoke(); });
    }).catch(function(){});
  });
}
