const { test, expect } = require('@playwright/test');

// The analytics privacy dialog is fixed and centred. At enlarged text its
// content used to outgrow the viewport: flex centring clipped the top, the
// close button rendered off-screen and nothing scrolled. The panel is now
// capped to the viewport with a non-scrolling control strip above a scrolling
// body, so the close control stays visible and the copy readable.
// Coverage is 200% TEXT ENLARGEMENT (root font size 32px at phone widths,
// matching the repo's other enlarged-text specs and WCAG 1.4.4 Resize Text) -
// not browser zoom, which would also halve the CSS viewport; compounding both
// axes (halved viewport AND doubled root) would test a state no single setting
// produces.

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
    // Keyboard users reach the scrollable body through the dialog's focus
    // trap and scroll it with the arrow keys (the region is focusable).
    await page.keyboard.press('Tab');
    await expect(page.locator('#privacyNoticeBody')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('privacyNoticeBody').scrollTop
    )).toBeGreaterThan(0);
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#closePrivacyNotice')).toBeFocused();

    // The copy overflows at this text size and must scroll to its end; the same
    // emergency wrap the site applies elsewhere keeps even the longest word
    // inside the column (no horizontal clipping).
    await expect.poll(() => page.evaluate(() => {
      const body = document.querySelector('#privacyNoticeDialog > div > div:last-child');
      return body.scrollHeight > body.clientHeight + 1;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const body = document.querySelector('#privacyNoticeDialog > div > div:last-child');
      return body.scrollWidth <= body.clientWidth + 1;
    })).toBe(true);
    // At every scroll position - top, middle, end - the copy must stay out
    // of the pinned control strip's space entirely.
    const scrollScan = await page.evaluate(() => {
      const panel = document.querySelector('#privacyNoticeDialog > div > div:last-child');
      const strip = document.getElementById('privacyNoticeControls').getBoundingClientRect();
      const close = document.getElementById('closePrivacyNotice').getBoundingClientRect();
      const out = { overlap: [], endReached: false, closeVisible: true };
      for (const pos of [0, panel.scrollHeight / 2, panel.scrollHeight]) {
        panel.scrollTop = pos;
        const pr = panel.getBoundingClientRect();
        // Sample the strip's row across its full width: every point must hit
        // the strip or its button, never body copy showing through or beside.
        const y = strip.top + strip.height / 2;
        for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const el = document.elementFromPoint(strip.left + strip.width * fx, y);
          if (!el || !el.closest('#privacyNoticeControls')) {
            out.overlap.push(`${el ? el.textContent.trim().slice(0, 20) : 'nothing'} visible in strip row @scroll ${Math.round(pos)} x${fx}`);
          }
        }
        const cr = document.getElementById('closePrivacyNotice').getBoundingClientRect();
        if (cr.top < -0.5 || cr.bottom > innerHeight + 0.5) out.closeVisible = false;
        if (pos === panel.scrollHeight) {
          // The end of the copy is visible below the strip: a paragraph can
          // legitimately be taller than the window at this text size, so assert
          // on its bottom edge, not the whole paragraph.
          const last = panel.querySelector('p:last-child').getBoundingClientRect();
          out.endReached = last.bottom <= pr.bottom + 0.5 && last.bottom >= strip.bottom - 0.5;
        }
      }
      return out;
    });
    expect(scrollScan.overlap, 'copy never shares the control strip').toEqual([]);
    expect(scrollScan.endReached, 'final paragraph scrolls fully into view below the strip').toBe(true);
    expect(scrollScan.closeVisible, 'close control stays pinned while scrolled').toBe(true);
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
