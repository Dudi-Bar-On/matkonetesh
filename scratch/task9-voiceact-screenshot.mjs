import { chromium } from 'playwright';
import path from 'node:path';

const dist = path.resolve('dist/index.html');

async function shot(lang, outfile) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('file:///' + dist.replace(/\\/g, '/'));
  await page.evaluate((l) => {
    localStorage.clear();
    localStorage.setItem('mk-uilevel-asked', 'true');
    if (l !== 'he') localStorage.setItem('mk-lang', l);
  }, lang);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  if (lang !== 'he') {
    await page.waitForFunction(() => (window).getLang && (window).getLang() !== 'he', null, { timeout: 10000 }).catch(() => {});
  }
  await page.evaluate(() => {
    const w = window;
    w.vcSpeak = () => Promise.resolve();
    w.voiceSay('timers', 'הטיימר של חזה בקר הסתיים · שבת');
  });
  await page.waitForFunction(() => !!document.getElementById('mkVoiceAct'), null, { timeout: 5000 });
  const h = await page.locator('#mkVoiceAct .mka-ack56').boundingBox();
  console.log(lang, 'ack button height:', h ? h.height : null);
  await page.screenshot({ path: outfile });
  await browser.close();
}

await shot('he', 'mockups/task9-voiceact-he-390x844.png');
await shot('ru', 'mockups/task9-voiceact-ru-390x844.png');
console.log('done');
