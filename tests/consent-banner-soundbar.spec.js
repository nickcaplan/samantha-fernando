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

test('failure notice stays clear of the lifted soundbar on a short viewport @mobile', async ({ page }) => {
  // Enlarged text on a short viewport caps the lift: the bar sits at the top
  // edge and the banner scrolls beneath it. A playback failure notice must
  // land in the band below the bar - on-screen, and never over the bar's
  // controls.
  await page.setViewportSize({ width: 320, height: 420 });
  // The notice element lives in the Listen tab's markup.
  await page.goto('/listen/');
  await page.evaluate(() => document.documentElement.style.fontSize = '32px');
  await revealSoundbar(page);
  await expectClearOfBanner(page);
  await page.evaluate(() => document.getElementById('audioAvailabilityMessage').classList.remove('hidden'));
  // Whichever position the geometry picks, the notice must stay fully
  // on-screen and never cover the bar's controls.
  await expect.poll(() => page.evaluate(() => {
    const n = document.getElementById('audioAvailabilityMessage').getBoundingClientRect();
    const s = document.getElementById('soundbar').getBoundingClientRect();
    const band = document.documentElement.classList.contains('failure-notice-below-bar');
    const onScreen = n.top >= -0.5 && n.bottom <= innerHeight + 0.5;
    const clear = band ? n.top >= s.bottom - 0.5 : n.bottom <= s.top + 0.5;
    return onScreen && clear;
  })).toBe(true);
});

test('consent buttons stay clickable while the failure notice bands below the bar @mobile', async ({ page }) => {
  // 320x240 with 200% text cannot fit bar, notice and banner at once. The
  // banner scrolls over the (non-interactive) notice as a last resort, but
  // its Accept and Reject buttons must stay independently clickable: the
  // analytics choice can never be trapped behind a playback failure.
  await page.setViewportSize({ width: 320, height: 240 });
  await page.goto('/listen/');
  await page.evaluate(() => document.documentElement.style.fontSize = '32px');
  await revealSoundbar(page);
  await expectClearOfBanner(page);
  await page.evaluate(() => {
    const notice = document.getElementById('audioAvailabilityMessage');
    notice.textContent = "SoundCloud couldn't start playback. Check your connection or try again.";
    notice.classList.remove('hidden');
  });
  // The band reservation settles through the ResizeObserver; assert it, then
  // scroll the banner to its end, where the buttons live.
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.classList.contains('failure-notice-below-bar'))).toBe(true);
  for (const name of ['Reject', 'Accept']) {
    const result = await page.evaluate((buttonName) => {
      const banner = document.getElementById('cookieConsentBanner');
      banner.scrollTop = banner.scrollHeight;
      const button = [...banner.querySelectorAll('button')].find(b => b.textContent.trim() === buttonName);
      button.scrollIntoView({ block: 'center' });
      const r = button.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const hit = document.elementFromPoint(cx, cy);
      return { clickable: hit === button || button.contains(hit), top: r.top, bottom: r.bottom };
    }, name);
    expect(result.clickable, `${name} must receive its own clicks`).toBe(true);
  }
});

test('privacy notice dialog opens above a visible failure notice', async ({ page }) => {
  // Band mode puts the failure notice at z-index 80, above the dialog's old
  // z-index 70: after a playback failure the Cookie preferences modal could
  // open UNDER the notice. The dialog must stay topmost and clickable.
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto('/listen/');
  await page.evaluate(() => document.documentElement.style.fontSize = '32px');
  await revealSoundbar(page);
  await expectClearOfBanner(page);
  await page.evaluate(() => document.getElementById('audioAvailabilityMessage').classList.remove('hidden'));
  await page.locator('#openPrivacyNotice').scrollIntoViewIfNeeded();
  await page.locator('#openPrivacyNotice').click();
  const dialog = page.locator('#privacyNoticeDialog');
  await expect(dialog).toBeVisible();
  // The dialog, not the notice, receives the pointer at its own centre.
  await expect.poll(() => page.evaluate(() => {
    const d = document.getElementById('privacyNoticeDialog').getBoundingClientRect();
    const el = document.elementFromPoint(d.left + d.width / 2, d.top + d.height / 2);
    return !!el && !!el.closest('#privacyNoticeDialog');
  })).toBe(true);
  await page.keyboard.press('Escape');
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
