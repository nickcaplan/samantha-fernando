const { test, expect } = require('@playwright/test');

// First visit leaves the analytics choice unanswered: its banner owns the
// bottom of the viewport, where the soundbar also sits. The soundbar must lift
// above the unanswered banner - not hide beneath it - and settle back to the
// viewport edge once the visitor answers. Covers both themes per the brief's
// rule for themed interactive surfaces.

async function revealSoundbar(page) {
  // Starting playback unhides the bar; the geometry under test is the same.
  await page.evaluate(() => document.getElementById('soundbar').classList.remove('hidden'));
}

async function expectClearOfBanner(page) {
  const banner = page.locator('#cookieConsentBanner');
  await expect(banner).toBeVisible();
  // The offset follows the banner's rendered height via ResizeObserver; assert
  // the settled state rather than a fixed delay. When enlarged text makes the
  // banner and bar together taller than the viewport, the bar must stay
  // on-screen rather than being pushed off the top edge.
  await expect.poll(() => page.evaluate(() => {
    const b = document.getElementById('cookieConsentBanner').getBoundingClientRect();
    const s = document.getElementById('soundbar').getBoundingClientRect();
    if (s.top < -1) return false;
    const fits = b.height + (innerHeight - b.bottom) + 16 + s.height <= innerHeight;
    return fits ? s.bottom - b.top <= 0.5 : true;
  })).toBe(true);
  const offset = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--consent-banner-offset').trim());
  expect(parseFloat(offset)).toBeGreaterThan(0);
}

for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
  test(`soundbar lifts above the unanswered consent banner ${width}px ${theme}${width < 768 ? ' @mobile' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(t => localStorage.setItem('theme', t), theme);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await revealSoundbar(page);
    for (const scale of [1, 2]) {
      await page.evaluate(s => document.documentElement.style.fontSize = 16 * s + 'px', scale);
      await expectClearOfBanner(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('soundbar returns to the viewport edge once the choice is made @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await revealSoundbar(page);
  await expectClearOfBanner(page);
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.locator('#cookieConsentBanner')).toBeHidden();
  // The ResizeObserver resets the offset asynchronously once the banner is
  // gone: poll the offset and the bar position together until both settle.
  await expect.poll(() => page.evaluate(() => {
    const s = document.getElementById('soundbar').getBoundingClientRect();
    const offset = getComputedStyle(document.documentElement).getPropertyValue('--consent-banner-offset').trim();
    return offset === '0px' && Math.abs(s.bottom - innerHeight) <= 1;
  })).toBe(true);
});

test('reopening the choice from Cookie preferences lifts the soundbar again', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/privacy/');
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await revealSoundbar(page);
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--consent-banner-offset').trim());
  expect(before).toBe('0px');
  await page.locator('#manageAnalyticsCookies').click();
  await expectClearOfBanner(page);
  await page.keyboard.press('Escape');
});
