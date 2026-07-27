#!/usr/bin/env node
// RED/GREEN witness for the cook_measure unit-class extension (LEAK 2 gate fix, §3.10 safety-sensitive).
// Faithful cooking-measure translations must PASS; real SAFETY-unit swaps must STILL FAIL.
import { unitLiteralCheck } from './gates.mjs';

let pass = 0, fail = 0;
function expect(label, he, mt, wantPass) {
  const r = unitLiteralCheck(he, mt);
  const ok = r.pass === wantPass;
  console.log(`${ok ? 'OK  ' : 'BAD '} [want ${wantPass ? 'PASS' : 'FAIL'}] ${label}  -> pass=${r.pass}  ${r.mismatches.map(m => m.reason).join(',')}`);
  ok ? pass++ : fail++;
}

console.log('--- GREEN: faithful cooking-measure translations MUST PASS ---');
expect('ru tbsp  4 כפ׳ -> 4 ст.л.', '4 כפ׳ פפריקה', '4 ст.л. паприки', true);
expect('ru tsp   1 כפית -> 1 ч.л.', '1 כפית ג׳ינג׳ר', '1 ч.л. имбиря', true);           // the collision case (ч.л. was read as HOUR)
expect('ru cup   1 כוס -> 1 стакан', '1 כוס יוגורט', '1 стакан йогурта', true);
expect('en tbsp  4 כף -> 4 tablespoons', '4 כף פפריקה', '4 tablespoons paprika', true);
expect('de tbsp  2 כף -> 2 EL', '2 כף דבש', '2 EL Honig', true);
expect('it tsp   1 כפית -> 1 cucchiaino', '1 כפית מלח', '1 cucchiaino di sale', true);
expect('fr cup   1 כוס -> 1 tasse', '1 כוס קמח', '1 tasse de farine', true);
expect('es tbsp  2 כף -> 2 cucharadas', '2 כף אבקת שום', '2 cucharadas de ajo en polvo', true);

console.log('--- RED: real SAFETY swaps MUST STILL FAIL ---');
expect('tempC->tempF  68°C -> 68°F', 'עשן ב-68°C', 'Smoke at 68°F', false);
expect('g->kg  50 g -> 50 kg', '50 גרם מלח ורוד', '50 kg de sal rosa', false);
expect('min->hr  30 min -> 30 h', 'המתן 30 דקות', 'Wait 30 h', false);
expect('cup->ml conversion  ½ כוס -> 125 ml', '½ כוס סויה, 2 כף סוכר', '125 ml di salsa di soia, 30 ml di zucchero', false);

console.log(`\n${pass} OK, ${fail} BAD`);
process.exit(fail === 0 ? 0 : 1);
