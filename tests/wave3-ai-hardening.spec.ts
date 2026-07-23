import { test, expect } from '@playwright/test';

// Wave 3 (original roadmap) — AI hardening: centralized transport (key-in-header, timeout, retry,
// endpoint seam) + a numeric-invariant safety guard over AI prose.

const init = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-uilevel-asked', JSON.stringify(true)); } catch {} });
  await page.goto('/index.html');
};

test('transport: gemFetch sends the API key in a header, never in the URL', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(async function(){
    store.set('mk-gemkey','SECRET123');
    let captured=null;
    window.fetch = async (url, opts)=>{ captured={ urlHasKey:/[?&]key=/.test(url), keyHeader: opts.headers && opts.headers['x-goog-api-key'] }; return { ok:true, status:200, json: async()=>({ok:1}) }; };
    const resp = await gemFetch(GEM_MODEL, {contents:[]}, {retries:0});
    return { captured, body: await resp.json() };
  })()`) as any;
  expect(r.captured.urlHasKey).toBe(false);       // key is NOT in the URL (no more ?key= leak)
  expect(r.captured.keyHeader).toBe('SECRET123'); // key IS in the x-goog-api-key header
  expect(r.body.ok).toBe(1);
});

test('transport: gemFetch retries a transient 503 then succeeds', async ({ page }) => {
  await init(page);
  const calls = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    let n=0;
    window.fetch = async ()=>{ n++; if(n===1) return {ok:false, status:503}; return {ok:true, status:200, json:async()=>({}) }; };
    await gemFetch(GEM_MODEL, {}, {retries:2});
    return n;
  })()`);
  expect(calls).toBe(2);   // one transient failure, one retry that succeeds
});

test('transport: gemFetch does NOT retry a hard 400 and surfaces it', async ({ page }) => {
  await init(page);
  const r = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    let n=0;
    window.fetch = async ()=>{ n++; return {ok:false, status:400}; };
    try{ await gemFetch(GEM_MODEL, {}, {retries:3}); return {n, err:'none'}; }catch(e){ return {n, err:String(e.message)}; }
  })()`) as any;
  expect(r.n).toBe(1);              // no retry on a client error
  expect(r.err).toContain('400');
});

test('transport: gemFetch aborts to a timeout error', async ({ page }) => {
  await init(page);
  const msg = await page.evaluate(`(async function(){
    store.set('mk-gemkey','K');
    window.fetch = (url, opts)=> new Promise((_,rej)=>{ if(opts.signal) opts.signal.addEventListener('abort', ()=>{ const e=new Error('aborted'); e.name='AbortError'; rej(e); }); });
    try{ await gemFetch(GEM_MODEL, {}, {retries:0, timeout:50}); return 'no-throw'; }catch(e){ return String(e.message); }
  })()`);
  expect(msg).toBe('timeout');
});

test('seam: GEM_URL centralizes the endpoint and defaults the model (no key in URL)', async ({ page }) => {
  await init(page);
  const d = await page.evaluate(`GEM_URL()`) as string;
  const t = await page.evaluate(`GEM_URL('gemini-2.5-flash-preview-tts')`) as string;
  expect(d).toContain('gemini-2.5-flash:generateContent');   // 3.6-flash reverted (api-400 on the developer API); still on 2.5 pending the correct 3.x id
  expect(t).toContain('preview-tts:generateContent');
  expect(d).not.toContain('key=');
});

test('safety guard: a caveat appears only when an AI answer carries safety numbers', async ({ page }) => {
  await init(page);
  const withNum = await page.evaluate(`aiSafetyCaveat('חמם את הבריסקט ל-95 מעלות פנימי לפני הגשה')`) as string;
  const plain = await page.evaluate(`aiSafetyCaveat('כדאי להשתמש בעץ אלון לעישון עמוק')`) as string;
  expect(withNum).toContain('אינם מאומתים');   // temperature present → flagged
  expect(plain).toBe('');                        // no safety numbers → no caveat
});
