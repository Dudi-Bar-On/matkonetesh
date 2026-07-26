// AI-4/smart-lookup (owner-reported 2026-07-26): a direct precise-name lookup ("הנפח אביה 150") used to
// acquire all properties (dims/area/racks) but came back patchy — root cause: aiLookupDevice ran at
// aiJSON's default think:'minimal'. Fix: bump to think:'high', and self-correct with ONE enriched retry
// when the first result is THIN for its category (see _lookupIsThin in app.js). Stubbed AI only — no real
// model call. Do NOT run the full suite (a local translation job holds the GPU) — this file (+ equipment.spec.ts
// if shared helpers are touched) only: `npx playwright test tests/equip-lookup-smart.spec.ts`.
import { test, expect, seedApp } from './_fixtures';

const boot = async (page: any, seedGear?: any) => {
  const kv: Record<string, string> = { 'mk-lang': JSON.stringify('en'), 'mk-uilevel-asked': 'true' };
  if (seedGear) { kv['mk-gear'] = JSON.stringify(seedGear); kv['mk-gear-set'] = 'true'; }
  await seedApp(page, kv);
  await page.waitForFunction(`typeof equipList==='function' && typeof aiLookupDevice==='function'`);
};

test('AI-1: aiLookupDevice passes think:"high" to aiJSON (was undefined/minimal)', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiCalls=[];
    window.__aiMock=function(opts){ window.__aiCalls.push(opts.think); return {racks:2}; };`);
  const r = await page.evaluate(`aiLookupDevice('Weber Kettle','smoker')`) as any;
  expect(r.cap.racks).toBe(2);
  const calls = await page.evaluate(`window.__aiCalls`) as any[];
  expect(calls.length).toBe(1);           // a non-thin result (racks present) never retries
  expect(calls[0]).toBe('high');
});

test('AI-2: a THIN first result triggers ONE enriched retry (also think:high); the FULLER result wins', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiCalls=[];
    window.__aiMock=function(opts){
      window.__aiCalls.push(opts.think);
      if(window.__aiCalls.length===1) return {name:'הנפח אביה 150'};   // THIN: no racks/zones, no dims, no areaCm2
      return {name:'הנפח אביה 150', racks:5, dimH_cm:150, dimW_cm:60, dimD_cm:43, areaCm2:12900};   // FULL (enriched retry)
    };`);
  const r = await page.evaluate(`aiLookupDevice('הנפח אביה 150','smoker')`) as any;
  const calls = await page.evaluate(`window.__aiCalls`) as any[];
  expect(calls.length).toBe(2);           // exactly one retry, not a loop
  expect(calls[0]).toBe('high'); expect(calls[1]).toBe('high');
  expect(r.cap.racks).toBe(5);
  expect(r.props.dimH_cm).toBe(150);
  expect(r.props.dimW_cm).toBe(60);
  expect(r.props.dimD_cm).toBe(43);
  expect(r.area).toBe('1.29 m²');
});

test('AI-3: a FULL first result short-circuits — no retry', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiCalls=[];
    window.__aiMock=function(opts){ window.__aiCalls.push(opts.think);
      return {name:'Traeger Ironwood 885', racks:4, dimH_cm:120, dimW_cm:55, dimD_cm:45, areaCm2:6500}; };`);
  const r = await page.evaluate(`aiLookupDevice('Traeger Ironwood 885','smoker')`) as any;
  const calls = await page.evaluate(`window.__aiCalls`) as any[];
  expect(calls.length).toBe(1);           // full result -> never retries
  expect(r.cap.racks).toBe(4);
  expect(r.props.dimH_cm).toBe(120);
  expect(r.area).toBe('6500 cm²');
});

test('AI-4: real #eqLookup flow shows the FULL retry result in the verify card', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiCalls=[];
    window.__aiMock=function(opts){ window.__aiCalls.push(opts.think);
      if(window.__aiCalls.length===1) return {name:'הנפח אביה 150'};
      return {name:'הנפח אביה 150', racks:5, dimH_cm:150, dimW_cm:60, dimD_cm:43, areaCm2:12900}; };
    openEquipment();`);
  await page.waitForSelector('#panel [data-eqpick="smoker"]');
  await page.click('#panel [data-eqpick="smoker"]');            // pick Smoker -> the form
  await page.waitForSelector('#panel #eqLookup');
  await page.selectOption('#panel #eqCat', 'smoker');
  await page.fill('#panel #eqName', 'הנפח אביה 150');
  await page.click('#panel #eqLookup');
  // condition wait, not a timeout (DoD #11): the capacity field only reaches the FULL retry's value once
  // both sequential model calls inside aiLookupDevice have resolved.
  await page.waitForFunction(`(document.querySelector('#panel #eqCapKey')||{}).value==='5'`);
  expect(await page.evaluate(`window.__aiCalls.length`)).toBe(2);
  expect(await page.evaluate(`(document.querySelector('#panel #eqProp-dimH_cm')||{}).value`)).toBe('150');
  expect(await page.evaluate(`(document.querySelector('#panel #eqProp-areaCm2')||{}).value`)).toBe('12900');
});
