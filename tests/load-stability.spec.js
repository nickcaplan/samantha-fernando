const {test,expect} = require('@playwright/test');
const path = require('node:path');

for (const theme of ['light','dark']) for (const width of [390,1440]) for (const route of ['/','/works/','/listen/','/watch/']) {
 test(`late fonts keep painted content stable ${route} ${width} ${theme}`,async({page,browserName})=>{
  test.skip(browserName!=='chromium','Layout Instability API is Chromium-only; other engines keep the general layout suite.');
  await page.setViewportSize({width,height:900});
  await page.addInitScript(t=>{
   localStorage.setItem('theme',t); localStorage.setItem('analyticsConsent','rejected');
   window.loadShifts=[];
   new PerformanceObserver(list=>{
    for(const entry of list.getEntries()) if(!entry.hadRecentInput) window.loadShifts.push(entry.value);
   }).observe({type:'layout-shift',buffered:true});
  },theme);
  // A real font with different metrics from the fallback is released only after
  // first paint. The production URL selects optional vs swap: no source-text
  // assertion or fabricated LayoutShift entries can make this test pass.
  await page.route('https://fonts.googleapis.com/**',async request=>{
   const policy=new URL(request.request().url()).searchParams.get('display');
   await request.fulfill({contentType:'text/css',body:`@font-face {font-family: Inter; font-style: normal; font-weight: 100 900; font-display: ${policy}; src: url(https://fonts.gstatic.com/test-inter.ttf) format('truetype');}`});
  });
  let releaseFont; const fontGate=new Promise(resolve=>releaseFont=resolve);
  let requestedFont; const fontRequested=new Promise(resolve=>requestedFont=resolve);
  await page.route('https://fonts.gstatic.com/test-inter.ttf',async request=>{
   requestedFont(); await fontGate;
   await request.fulfill({path:path.join(__dirname,'fixtures/inter/Inter-Regular.ttf'),contentType:'font/ttf',headers:{'Access-Control-Allow-Origin':'*'}});
  });
  try {
   await page.goto(route,{waitUntil:'domcontentloaded'});
   await fontRequested;
   await page.waitForFunction(()=>{
    const paint=performance.getEntriesByName('first-contentful-paint')[0];
    return paint && performance.now()-paint.startTime>250;
   });
   expect(await page.locator('main').isVisible()).toBe(true);
   releaseFont();
   await page.evaluate(()=>document.fonts.ready);
   expect(await page.evaluate(()=>document.fonts.check('16px Inter'))).toBe(true);
   // Give the buffered observer two rendering opportunities to deliver entries.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   expect(await page.evaluate(()=>window.loadShifts.reduce((sum,value)=>sum+value,0))).toBeLessThan(0.00001);
  } finally {releaseFont();}
 });
}
