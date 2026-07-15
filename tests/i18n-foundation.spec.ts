import { test, expect } from '@playwright/test';

const boot = async (page: any) => {
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mk-lang', JSON.stringify('en')); } catch {} });
  await page.goto('/index.html');
  await page.waitForFunction(`typeof L==='function' && typeof aiJSON==='function' && typeof setLang==='function' && typeof I18N_DICTS==='object'`);
};

test('Change 1: L() — English uses inline arg, fr uses dict, he returns source', async ({ page }) => {
  await boot(page);
  // seed test keys; give en a DIFFERENT value to prove English ignores the dict
  await page.evaluate(`I18N_DICTS.en=I18N_DICTS.en||{}; I18N_DICTS.en['__t_key']='DICT-EN';
                       I18N_DICTS.fr=I18N_DICTS.fr||{}; I18N_DICTS.fr['__t_key']='DICT-FR';`);
  await page.evaluate(`setLang('en')`);
  expect(await page.evaluate(`L('__t_key','INLINE-EN')`)).toBe('INLINE-EN');   // English: inline wins (untouched)
  await page.evaluate(`setLang('fr')`);
  expect(await page.evaluate(`L('__t_key','INLINE-EN')`)).toBe('DICT-FR');      // fr: dict wins
  expect(await page.evaluate(`L('__no_key','FALLBACK-EN')`)).toBe('FALLBACK-EN'); // fr: unmapped → inline English
  await page.evaluate(`setLang('he')`);
  expect(await page.evaluate(`L('שלום','hi')`)).toBe('שלום');                    // Hebrew: source verbatim
});

test('Change 2: aiJSON outLang names the target language, not always English', async ({ page }) => {
  await boot(page);
  await page.evaluate(`store.set('mk-gemkey','k'); window.__aiMock=null; window.__cap=null;
    window.gemFetch=async(m,b)=>{ window.__cap=b; return {ok:true, json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})}; };`);
  await page.evaluate(`aiJSON({task:'t', outLang:'fr'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('FRENCH');
  await page.evaluate(`aiJSON({task:'t', outLang:'de'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('GERMAN');
  await page.evaluate(`aiJSON({task:'t', outLang:'en'}).then(()=>1).catch(()=>0)`);
  expect(JSON.stringify(await page.evaluate(`window.__cap`))).toContain('ENGLISH');  // English unchanged
});

test('Change 3: interpolated toasts render English in English mode', async ({ page }) => {
  // standalone toasts are already dict-covered; interpolated ones (e.g. restore-count) can never be dict keys
  await boot(page);
  await page.evaluate(`setLang('en');
    const blob=new Blob([JSON.stringify({app:'matkonet',data:{'mk-fav':[]}})],{type:'application/json'});
    importData(new File([blob],'b.json',{type:'application/json'}));`);
  await page.waitForFunction(`!!((document.querySelector('#toast span')||{}).textContent||'').trim()`);
  const txt = await page.evaluate(`document.querySelector('#toast span').textContent`);
  expect(txt).toMatch(/restored/i);
  expect(txt).not.toMatch(/[֐-׿]/);   // no Hebrew characters
});
