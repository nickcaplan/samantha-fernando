const { test, expect } = require('@playwright/test');

// The shared header swaps between the desktop bar and the compact menu at the
// 1024px CSS-width boundary. Which mode renders follows the measured CSS width,
// so a vertical scrollbar can carry a 1024px layout viewport across the boundary.
// These checks pin the boundary behaviour without masking it: the rendered mode
// must match the measured CSS width, a single key press must reach the destination,
// and navigation must still complete after a resize across the boundary. The swap
// hides the focused link; focus must move to the equivalent control in the new
// mode (the matching desktop link, or the menu toggle when the drawer links are
// not visible), never drop to the document body.

function measuredMode(page) {
  return page.evaluate(() => (document.documentElement.clientWidth >= 1024 ? 'desktop' : 'compact'));
}

async function expectMode(page, mode) {
  const desktopLink = page.locator('#nav-watch');
  const toggle = page.locator('#mobileMenuToggle');
  if (mode === 'desktop') {
    await expect(desktopLink).toBeVisible();
    await expect(toggle).toBeHidden();
  } else {
    await expect(toggle).toBeVisible();
    await expect(desktopLink).toBeHidden();
  }
}

async function openCompactMenu(page) {
  const toggle = page.locator('#mobileMenuToggle');
  if (await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function keyboardNavigateToWatch(page, mode) {
  if (mode === 'compact') {
    await openCompactMenu(page);
  }
  const link = page.locator(mode === 'compact' ? '[data-mobile-nav="watch"]' : '#nav-watch');
  await expect(link).toBeVisible();
  // One activation must reach the destination; no retrying a failed press.
  await link.press('Enter');
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#mobileMenu')).toBeHidden();
}

for (const width of [1023, 1025]) {
  test(`keyboard navigation works ${width === 1023 ? 'just below' : 'just above'} the desktop breakpoint (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    const mode = await measuredMode(page);
    await expectMode(page, mode);
    await keyboardNavigateToWatch(page, mode);
  });
}

for (const { startWidth, targetWidth, startMode, endMode } of [
  { startWidth: 900, targetWidth: 1280, startMode: 'compact', endMode: 'desktop' },
  { startWidth: 1280, targetWidth: 900, startMode: 'desktop', endMode: 'compact' },
]) {
  test(`resizing from ${startMode} to ${endMode} swaps the navigation mode and keyboard navigation still completes`, async ({ page }) => {
    // Both endpoints are deterministic even when a vertical scrollbar is present.
    await page.setViewportSize({ width: startWidth, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Reject', exact: true }).click();

    expect(await measuredMode(page)).toBe(startMode);
    await expectMode(page, startMode);

    // Focus Watch in the starting mode so the swap's effect on focus is observable.
    const startLink = page.locator(startMode === 'compact' ? '[data-mobile-nav="watch"]' : '#nav-watch');
    if (startMode === 'compact') {
      await openCompactMenu(page);
    }
    await startLink.focus();
    await expect(startLink).toBeFocused();

    await page.setViewportSize({ width: targetWidth, height: 1000 });
    expect(await measuredMode(page)).toBe(endMode);
    await expectMode(page, endMode);

    // The swap hides the previously focused link; focus must land on the
    // equivalent control in the new mode.
    await expect(startLink).toBeHidden();
    if (endMode === 'desktop') {
      await expect(page.locator('#nav-watch')).toBeFocused();
    } else {
      await expect(page.locator('#mobileMenuToggle')).toBeFocused();
    }

    // A single keyboard activation from the recovered focus reaches the destination.
    await keyboardNavigateToWatch(page, endMode);
  });
}
