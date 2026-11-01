const { test, expect } = require('@playwright/test');

// The analytics privacy dialog is fixed and centred. At enlarged text its
// content used to outgrow the viewport: flex centring clipped the top, the
// close button rendered off-screen and nothing scrolled. The panel is now
// capped to the viewport with a scrolling body, so the heading and close
// control stay visible at any zoom while the copy remains readable.

async function openDialog(page) {
  await page.goto('/listen/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#openPrivacyNotice').scrollIntoViewIfNeeded();
  await page.locator('#openPrivacyNotice').click();
  await expect(page.locator('#privacyNoticeDialog')).toBeVisible();
}

for (const width of [320, 412]) {
  test(`privacy dialog keeps its close control visible and body scrollable at ${width}px 200% text @mobile`, async ({ page }) => {
    // Consent stays unanswered: the dialog opens from the banner's "How
    // analytics works" button, which is hidden once a choice is stored.
    await page.setViewportSize({ width, height: Math.round(width * 1.3) });
    await openDialog(page);
    await page.evaluate(() => document.documentElement.style.fontSize = '32px');
    // Settled state: header (and its close button) fully inside the viewport.
    await expect.poll(() => page.evaluate(() => {
      const r = document.getElementById('closePrivacyNotice').getBoundingClientRect();
      return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.height > 0;
    })).toBe(true);
    // The copy overflows at this zoom and must scroll to its end.
    await expect.poll(() => page.evaluate(() => {
      const panel = document.querySelector('#privacyNoticeDialog > div');
      return panel.scrollHeight > panel.clientHeight + 1;
    })).toBe(true);
    const endState = await page.evaluate(() => {
      const panel = document.querySelector('#privacyNoticeDialog > div');
      panel.scrollTop = panel.scrollHeight;
      const pr = panel.getBoundingClientRect();
      const last = panel.querySelector('p:last-child').getBoundingClientRect();
      const close = document.getElementById('closePrivacyNotice').getBoundingClientRect();
      return {
        endReached: last.bottom <= pr.bottom + 0.5,
        closeStillVisible: close.top >= -0.5 && close.bottom <= innerHeight + 0.5,
      };
    });
    expect(endState.endReached, 'final paragraph scrolls into view').toBe(true);
    expect(endState.closeStillVisible, 'close control stays pinned while scrolled').toBe(true);
    // Keyboard dismissal and focus return keep working.
    await page.keyboard.press('Escape');
    await expect(page.locator('#privacyNoticeDialog')).toBeHidden();
    await expect(page.locator('#openPrivacyNotice')).toBeFocused();
  });
}

test('privacy dialog still centres with a visible close control on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDialog(page);
  await expect.poll(() => page.evaluate(() => {
    const r = document.getElementById('closePrivacyNotice').getBoundingClientRect();
    return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.height > 0;
  })).toBe(true);
  // Desktop content fits: the whole panel sits inside the viewport.
  await expect.poll(() => page.evaluate(() => {
    const r = document.querySelector('#privacyNoticeDialog > div').getBoundingClientRect();
    return r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#privacyNoticeDialog')).toBeHidden();
});
