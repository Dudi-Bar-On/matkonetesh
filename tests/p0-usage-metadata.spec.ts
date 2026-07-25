import { test, expect, seedApp } from './_fixtures';

// P0-app item 7 (spec §4.4) — the approved instrumentation rider. app.js has never read usageMetadata
// from any Gemini response (zero refs), so no token or cost figure exists anywhere in the repo for
// either model, and item 3's $1.22->$0.39 COGS claim is unverifiable after shipping. Read-and-log only.
// NOTE: this test stubs window.fetch, NOT window.gemFetch — the capture lives INSIDE gemFetch, so a test
// that replaces gemFetch (the tests/ai-trust.spec.ts pattern) would never exercise it.
const bootUsage = async (page: any) => {
  await seedApp(page, {
    'mk-uilevel-asked': 'true', 'mk-lang': JSON.stringify('he'),
    'mk-gemkey': JSON.stringify('test-key-1234567890'),
  });
  await page.waitForFunction(`typeof gemFetch==='function' && typeof askGemini==='function'`);
  await page.evaluate(`window.__reqs=[];
    window.fetch=async(url,init)=>{ window.__reqs.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        candidates:[{content:{parts:[{text:'תשובה קבועה'}]}}],
        usageMetadata:{promptTokenCount:11, candidatesTokenCount:22, thoughtsTokenCount:0, totalTokenCount:33}
      }), {status:200, headers:{'content-type':'application/json'}});
    };`);
};

test('item 7: usageMetadata is captured at the gemFetch chokepoint', async ({ page }) => {
  await bootUsage(page);
  await page.evaluate(`askGemini('כמה זמן לעשן צלעות')`);
  await page.waitForFunction(`typeof GEM_USAGE!=='undefined' && GEM_USAGE.length>0`);
  const last = await page.evaluate(`GEM_USAGE[GEM_USAGE.length-1]`) as any;
  expect(last.role).toBe('text');
  expect(last.prompt).toBe(11);
  expect(last.out).toBe(22);
  expect(last.total).toBe(33);
});

test('item 7: the rider changes NOTHING a caller sees — same request body, same parsed answer', async ({ page }) => {
  await bootUsage(page);
  const res = await page.evaluate(`askGemini('כמה זמן לעשן צלעות').then(r=>r.txt)`) as string;
  expect(res).toBe('תשובה קבועה');        // the body was NOT consumed by the capture (r.clone())
  const req = await page.evaluate(`window.__reqs[0]`) as any;
  expect(req.contents).toBeTruthy();
  expect(req.system_instruction).toBeTruthy();
});

test('item 7: a response with no usageMetadata is a silent no-op, never a thrown error', async ({ page }) => {
  await bootUsage(page);
  await page.evaluate(`window.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'x'}]}}]}),{status:200,headers:{'content-type':'application/json'}});`);
  const res = await page.evaluate(`askGemini('שאלה').then(r=>r.txt).catch(e=>'THREW:'+e.message)`) as string;
  expect(res).toBe('x');
});
