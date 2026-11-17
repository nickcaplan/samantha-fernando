const {test, expect} = require('@playwright/test');

// Scan alphabetic runs, not punctuation compounds: a slash/hyphen is a valid
// line boundary but a split inside Negative or Trailer is not.
async function splitWords(locator) {
  return locator.evaluateAll(elements => {
    const split = [];
    for (const element of elements) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (const match of node.textContent.matchAll(/[A-Za-z]{4,}/g)) {
          const range = new Range();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const rects = [...range.getClientRects()].filter(r => r.width && r.height);
          if (new Set(rects.map(r => Math.round(r.top))).size > 1) split.push(match[0]);
        }
      }
    }
    return split;
  });
}
for (const theme of ['light','dark']) for (const width of [320,390,768,1440]) {
  test(`card words reflow ${width} ${theme}`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(t => {
      localStorage.setItem('theme',t);
      localStorage.setItem('analyticsConsent','rejected');
    }, theme);
    for (const route of ['/','/listen/','/works/']) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      for (const fontSize of [16,32]) {
        await page.evaluate(size => document.documentElement.style.fontSize = `${size}px`,fontSize);
        const elements = page.locator(route === '/' ? '.performance-entry h3, #featured-projects :is(h3,p)' : '#worksContainer h3, #worksContainer .work-media-action');
        expect(await elements.count()).toBeGreaterThan(0);
        expect(await splitWords(elements),`${route} at ${width}/${fontSize}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  });
}
