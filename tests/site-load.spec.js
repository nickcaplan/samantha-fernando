const { test, expect } = require('@playwright/test');
const { waitForScrollSettle } = require('./scroll-settle');
const AxeBuilder = require('@axe-core/playwright').default;

async function mockPlaybackProviders(page) {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        const controller = {
          loadUri: uri => window.__spotifyCalls.push(['loadUri', uri]),
          seek: position => window.__spotifyCalls.push(['seek', position]),
          play: () => window.__spotifyCalls.push(['play']),
          resume: () => window.__spotifyCalls.push(['resume']),
          togglePlay: () => window.__spotifyCalls.push(['togglePlay']),
          pause: () => window.__spotifyCalls.push(['pause']),
          addListener: (event, handler) => {
            window.__spotifyHandlers = window.__spotifyHandlers || {};
            window.__spotifyHandlers[event] = handler;
          },
        };
        callback(controller);
      },
    };

    window.__soundCloudCalls = [];
    const Widget = element => {
      const handlers = {};
      const player = {
        bind: (event, handler) => { handlers[event] = handler; },
        getDuration: callback => callback(60_000),
        getPosition: callback => callback(0),
        pause: () => {
          window.__soundCloudCalls.push(['pause', element.id]);
          handlers.PAUSE?.();
        },
        play: () => {
          window.__soundCloudCalls.push(['play', element.id]);
          handlers.PLAY?.();
        },
        seekTo: position => window.__soundCloudCalls.push(['seekTo', element.id, position]),
      };
      window.__soundCloudPlayers ??= {};
      window.__soundCloudPlayers[element.id] = { handlers, player };
      return player;
    };
    Widget.Events = {
      READY: 'READY',
      PLAY: 'PLAY',
      PAUSE: 'PAUSE',
      FINISH: 'FINISH',
      ERROR: 'ERROR',
    };
    window.SC = { Widget };
  });

  await page.route('https://w.soundcloud.com/player/api.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => route.abort());
}

async function rejectAnalyticsCookies(page) {
  const banner = page.locator('#cookieConsentBanner');
  if (await banner.isVisible()) {
    await page.getByRole('button', { name: 'Reject' }).click();
  }
}

test('loads the site and renders primary navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Samantha Fernando - Composer');
  await expect(page.getByRole('navigation')).toContainText('Biography');
  await expect(page.getByRole('link', { name: 'Home' }).first()).toHaveClass(/text-amber-400/);
  await expect(page.locator('#nav-works')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Listen', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watch', exact: true }).first()).toBeVisible();
});

test('exposes canonical metadata and structured data for search', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Official website of British composer Samantha Fernando/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.samanthafernando.com/',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://www.samanthafernando.com/assets/sam-1-1200.webp',
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('link[rel="preload"][href="/assets/sam-1-1200.webp"]')).toHaveAttribute(
    'fetchpriority',
    'high',
  );
  const heading = page.getByRole('heading', { name: 'Samantha Fernando British Composer', level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading.locator('span')).toHaveText('British Composer');
  await expect(heading.locator('span')).toHaveClass(/text-xl/);

  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  const graph = JSON.parse(structuredData)['@graph'];
  expect(graph.find(item => item['@type'] === 'Person')).toMatchObject({
    name: 'Samantha Fernando',
    jobTitle: 'Composer',
  });
  expect(graph.find(item => item['@type'] === 'ItemList')).toBeUndefined();
});

test('publishes crawl-discovery files', async ({ request }) => {
  const [robots, sitemap] = await Promise.all([
    request.get('/robots.txt'),
    request.get('/sitemap.xml'),
  ]);

  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toMatch(/Sitemap: https:\/\/www\.samanthafernando\.com\/sitemap\.xml/);
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toMatch(/<loc>https:\/\/www\.samanthafernando\.com\/<\/loc>/);
});

test('navigation opens the Listen and Watch catalogue views', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Watch', exact: true }).first().click();
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#works-view-watch')).toHaveAttribute('aria-pressed', 'true');
});

test('uses compact browser and home-screen icons', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/assets/favicon.png');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/assets/apple-touch-icon.png');
  await expect(page.locator('link[rel="icon"]')).not.toHaveAttribute('href', /new-favicon/);
});

test('loads Google Analytics only after the visitor accepts analytics cookies', async ({ page }) => {
  const analyticsRequests = [];
  await page.route('https://www.googletagmanager.com/gtag/js?id=G-N74SECKP5X', route => {
    analyticsRequests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  await expect(page.locator('#cookieConsentBanner')).toBeVisible();
  expect(analyticsRequests).toEqual([]);

  await page.getByRole('button', { name: 'Accept' }).click();
  await expect.poll(() => analyticsRequests).toHaveLength(1);
  await expect(page.locator('#cookieConsentBanner')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.dataLayer?.[1]?.[0])).toBe('config');
});

test('persists a rejected analytics choice and exposes cookie preferences', async ({ page }) => {
  const analyticsRequests = [];
  await page.route('https://www.googletagmanager.com/gtag/js?id=G-N74SECKP5X', route => {
    analyticsRequests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.reload();
  await expect(page.locator('#cookieConsentBanner')).toBeHidden();
  expect(analyticsRequests).toEqual([]);

  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/#cookie-settings$/);
  // Enhanced navigation smooth-scrolls to the anchor; let the scroll settle
  // before clicking so the button is not mid-motion (WebKit animates in bursts).
  await waitForScrollSettle(page, '#cookie-settings');
  await page.getByRole('button', { name: 'Cookie preferences' }).click();
  await expect(page.getByRole('dialog', { name: 'Analytics and privacy' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Cookie preferences' })).toBeFocused();
  await expect(page.locator('#cookieConsentBanner')).toBeVisible();
});

test('defers the Spotify API until playback is requested', async ({ page }) => {
  const spotifyRequests = [];
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => {
    spotifyRequests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  expect(spotifyRequests).toEqual([]);

  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();
  await page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]').click();
  await expect.poll(() => spotifyRequests).toHaveLength(1);
});

test('uses the precompiled local stylesheet', async ({ page }) => {
  const tailwindCompilerRequests = [];
  await page.route('https://cdn.tailwindcss.com/**', route => {
    tailwindCompilerRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto('/');

  await expect(page.locator('link[href="/assets/tailwind.min.css"]')).toHaveCount(1);
  expect(tailwindCompilerRequests).toEqual([]);
});

test('switches to the works list and filters by category', async ({ page }) => {
  await page.goto('/');

  await page.locator('#nav-works').click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#tab-works')).toBeVisible();
  await expect(page.locator('#worksContainer')).toContainText('Wintering');
  await expect(page.locator('#worksFilterToolbar')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search works by title or instrumentation' })).toBeVisible();
  await expect(page.locator('#worksFilterToolbar')).toContainText('Instrumentation: All');

  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await expect(page.getByRole('option', { name: 'Opera & Stage' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { name: 'Opera & Stage' })).toBeHidden();

  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await page.getByRole('option', { name: 'Opera & Stage' }).click();
  await expect(page.locator('#worksContainer')).toContainText('glass human');
  await expect(page.locator('#worksContainer')).not.toContainText('Wintering');
});

test('supports keyboard navigation in the instrumentation menu', async ({ page }) => {
  await page.goto('/works/');

  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await expect(page.getByRole('option', { name: 'Instrumentation: All' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Solo & Chamber (1-4)' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Orchestral' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Instrumentation: All' })).toBeFocused();
});

test('hero actions navigate to their destinations', async ({ page }) => {
  await page.goto('/');

  await page.locator('.hero-actions').getByRole('link', { name: 'Listen' }).click();
  await expect(page.locator('#tab-works')).toBeVisible();
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/');
  await page.locator('.hero-actions').getByRole('link', { name: 'Explore works' }).click();
  await expect(page.locator('#tab-works')).toBeVisible();

  await page.goto('/');
  await page.locator('.hero-actions').getByRole('link', { name: 'Get in touch' }).click();
  await expect(page.locator('#tab-contact')).toBeVisible();
  await expect(page.locator('#tab-contact img[alt="Samantha Fernando"]')).toHaveAttribute('loading', 'eager');
  await expect(page.locator('#tab-contact img[alt="Samantha Fernando"]')).toHaveAttribute('src', /sam-6-800\.webp$/);
});

test('Biography opens as a real page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Biography' }).click();
  await expect(page).toHaveURL(/\/biography\/$/);
  await expect(page.locator('#tab-bio')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Samantha Fernando' })).toBeVisible();
  await expect(page.locator('#tab-bio')).toContainText('In recent years, her music');
  await page.getByRole('link', { name: 'Discuss a commission or performance' }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.locator('#tab-contact')).toBeVisible();
});

test('Writing shows the full Wintering essay, portrait and video directly', async ({ page }) => {
  await page.goto('/writing/');

  const writing = page.locator('#tab-writing');
  await expect(writing).toBeVisible();
  await expect(writing.getByRole('heading', { name: 'On My Creative Process: 1. Wintering' })).toBeVisible();
  await expect(writing).toContainText('Why do I write? What makes me start?');
  await expect(writing).toContainText('I’m still uncovering, still trying to get closer to the compositional ideals I hold in mind.');
  await expect(writing.locator('figure.writing-portrait')).toHaveClass(/float-right/);
  await expect(writing.locator('figure.writing-portrait img')).toHaveAttribute('src', /sam-3\.webp$/);
  await expect(writing.locator('p.text-lg')).toContainText('Why do I write? What makes me start?');
  await expect(writing.getByRole('button', { name: 'Watch Wintering (Trailer)' })).toBeVisible();
});

test('restores site sections with browser Back and Forward', async ({ page }) => {
  await page.goto('/');

  await page.locator('#nav-works').click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#tab-works')).toBeVisible();
  await page.getByRole('link', { name: 'Writing' }).click();
  await expect(page).toHaveURL(/\/writing\/$/);

  // Wait for the enhanced route, not a full document load event.
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#tab-works')).toBeVisible();

  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#tab-home')).toBeVisible();

  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#tab-works')).toBeVisible();
});

test('restores Listen and Watch views with browser Back', async ({ page }) => {
  await page.goto('/works/');

  await page.locator('#works-view-listen').click();
  await expect(page).toHaveURL(/\/listen\/$/);
  await page.locator('#works-view-watch').click();
  await expect(page).toHaveURL(/\/watch\/$/);

  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#worksContainer .work-media-action').first()).toBeVisible();
});

test('toggles the visual theme', async ({ page }) => {
  await page.goto('/');

  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/light-mode/);
  await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-label', 'Switch to light mode');
  await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('body')).not.toHaveClass(/light-mode/);

  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('body')).toHaveClass(/light-mode/);
  await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-label', 'Switch to dark mode');
  await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-pressed', 'false');
});

test('uses the dark palette for the Instrumentation menu', async ({ page }) => {
  await page.goto('/works/');
  await page.locator('#themeToggleBtn').click();
  await page.getByRole('button', { name: 'Instrumentation: All' }).click();

  await expect(page.locator('#worksInstrumentationMenu')).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(page.getByRole('option', { name: 'Opera & Stage' })).toHaveCSS('color', 'rgb(212, 212, 212)');
});

test('keeps the selected Instrumentation option legible in both themes', async ({ page }) => {
  await page.goto('/works/');
  await page.getByRole('button', { name: 'Instrumentation: All' }).click();

  const selectedOption = page.getByRole('option', { name: 'Instrumentation: All' });
  await expect(selectedOption).toHaveCSS('background-color', 'rgb(169, 87, 0)');
  await expect(selectedOption).toHaveCSS('color', 'rgb(255, 255, 255)');

  await page.locator('#themeToggleBtn').click();
  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await expect(selectedOption).toHaveCSS('background-color', 'rgb(169, 87, 0)');
  await expect(selectedOption).toHaveCSS('color', 'rgb(255, 255, 255)');
});

test('opens and closes the mobile navigation menu @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menuButton = page.locator('#mobileMenuToggle');
  const menu = page.locator('#mobileMenu');

  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Listen', exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Watch', exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Biography' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Contact' })).toBeVisible();

  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeHidden();
});

test('uses the dark palette for the mobile navigation menu @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#themeToggleBtn').click();
  await page.locator('#mobileMenuToggle').click();

  await expect(page.locator('#mobileMenu')).toHaveCSS('background-color', 'rgb(26, 26, 26)');
  await expect(page.locator('#mobileMenu').getByRole('link', { name: 'Home' })).toHaveCSS('color', 'rgb(251, 191, 36)');
  await expect(page.locator('#mobileMenuToggle')).toHaveCSS('border-top-color', 'rgba(245, 158, 11, 0.7)');
});

test('keeps mobile header controls and hero content usable @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const headerBar = page.locator('header > div').first();
  const menuButton = page.locator('#mobileMenuToggle');
  const portrait = page.locator('#tab-home .lg\\:col-span-5 img');
  const introduction = page.locator('.hero-introduction');

  await expect(headerBar).toHaveCSS('height', '56px');
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveCSS('align-items', 'center');
  await expect(menuButton).toHaveCSS('justify-content', 'center');
  await expect(portrait).toBeVisible();
  await expect(introduction).toBeVisible();
  await expect(page.locator('#soundLabel')).toBeHidden();
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-label', 'Close navigation menu');
  await expect(menuButton).toHaveCSS('border-top-color', 'rgba(169, 87, 0, 0.7)');
  await expect(page.locator('#mobileMenu')).toBeVisible();
});

test('shows the next home section in the initial mobile viewport @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await rejectAnalyticsCookies(page);
  const nextHeading = await page.locator('#performances').count()
    ? page.locator('#performances-title')
    : page.locator('#featured-projects h2');
  await expect(nextHeading).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#featured-projects')).toContainText('Spotlight Works');
  await page.locator('#featured-projects h2').scrollIntoViewIfNeeded();
  await expect(page.locator('#featured-projects h2')).toBeInViewport({ ratio: 1 });
});

test('uses the shared Instrumentation menu on mobile @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/works/');

  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await expect(page.getByRole('option', { name: 'Opera & Stage' })).toBeVisible();
  await page.getByRole('option', { name: 'Opera & Stage' }).click();
  await expect(page.locator('#worksContainer')).toContainText('glass human');
  await expect(page.locator('#worksContainer')).not.toContainText('Wintering');
});

test('uses a compact portrait on mobile Biography @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/biography/');

  await expect(page.locator('.bio-mobile-portrait')).toBeVisible();
  await expect(page.locator('#tab-bio aside > figure')).toBeHidden();
});

test('keeps the Biography portrait viewport-sized at 200% root text @mobile', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/biography/');
    // Enlarge the root font size itself: real 200% browser text scales rem-based
    // geometry, unlike a container font-size override.
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });

    const portrait = page.locator('.bio-mobile-portrait');
    await expect(portrait).toBeVisible();
    const portraitBox = await portrait.boundingBox();
    expect(portraitBox.width).toBeLessThanOrEqual(170);
    expect(portraitBox.width).toBeGreaterThan(100);

    // The opening text must still render beside the float, not drop below it.
    // A paragraph's bounding box stays beside the float even when its lines do
    // not fit, so measure the first rendered text fragment instead.
    const firstLine = await page.locator('#tab-bio article > p').first().evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p.firstChild);
      const rect = range.getClientRects()[0];
      return rect ? { x: rect.x, y: rect.y } : null;
    });
    expect(firstLine).not.toBeNull();
    expect(firstLine.y).toBeLessThan(portraitBox.y + portraitBox.height);
    expect(firstLine.x).toBeLessThan(portraitBox.x);
  }
});

test('enlarges the mobile Biography portrait and shows the birth year @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/biography/');

  const portrait = page.locator('.bio-mobile-portrait');
  await expect(portrait).toBeVisible();
  const box = await portrait.boundingBox();
  expect(box.width).toBeGreaterThan(130);
  expect(box.width).toBeLessThanOrEqual(160);

  const birthYear = page.locator('#tab-bio article').getByText('b. 1984', { exact: true });
  await expect(birthYear).toBeVisible();
  const headingBox = await page.locator('#tab-bio article').getByRole('heading', { name: 'Samantha Fernando' }).boundingBox();
  const birthYearBox = await birthYear.boundingBox();
  expect(birthYearBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height - 1);
});

test('aligns Works and Listen CTAs with card content on mobile @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/works/');

  const wintering = page.locator('#worksContainer > div', { has: page.getByRole('heading', { name: 'Wintering' }) });
  const worksAction = wintering.getByRole('button', { name: 'Watch Wintering (Trailer)' });
  await expect(worksAction).toHaveText('Trailer');
  const worksContent = wintering.locator('div').first();
  expect((await worksAction.boundingBox()).x).toBe((await worksContent.boundingBox()).x);

  await page.locator('#works-view-listen').click();
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#worksContainer .work-media-action').first()).toBeVisible();
  const listenAction = page.locator('#worksContainer .work-media-action').first();
  const listenCard = page.locator('#worksContainer > div').first();
  const listenContent = listenCard.locator('div').first();
  expect((await listenAction.boundingBox()).x).toBe((await listenContent.boundingBox()).x);
});

test('mobile preview uses the real mobile viewport', async ({ page }) => {
  await page.goto('/');
  await page.locator('#mobilePreviewBtn').click();

  const dialog = page.locator('#mobilePreviewDialog');
  const preview = page.frameLocator('#mobilePreviewFrame');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#mobilePreviewBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(preview.locator('#mobileMenuToggle')).toBeVisible();
  await expect(preview.locator('header nav')).toBeHidden();
  await expect(preview.locator('html')).toHaveClass(/mobile-preview-session/);

  await page.locator('#closeMobilePreview').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#mobilePreviewBtn')).toHaveAttribute('aria-pressed', 'false');
});

test('restores mobile preview after refresh', async ({ page }) => {
  await page.goto('/');
  await page.locator('#mobilePreviewBtn').click();
  await page.reload();

  await expect(page.locator('#mobilePreviewDialog')).toBeVisible();
  await expect(page.locator('#mobilePreviewBtn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.frameLocator('#mobilePreviewFrame').locator('#mobileMenuToggle')).toBeVisible();
});

test('gates the mobile preview tool on the production hostname', async ({ page, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Chromium maps the production hostname to the local server.');
  await page.goto(`http://www.samanthafernando.com:${new URL(baseURL).port}/`);

  await expect(page.locator('#mobilePreviewBtn')).toBeHidden();
  await page.evaluate(() => window.toggleMobilePreview());
  await expect(page.locator('#mobilePreviewDialog')).toBeHidden();
});

test('submits the contact form through Formspree', async ({ page }) => {
  await page.goto('/');
  await page.route('https://formspree.io/f/mlgqqjen', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.getByRole('link', { name: 'Contact' }).click();
  await expect(page.locator('#tab-contact')).toBeVisible();

  await page.getByPlaceholder('Name...').fill('Test Visitor');
  await page.getByPlaceholder('Email...').fill('test@example.com');
  await page.getByPlaceholder('Specify work title or details...').fill('Test inquiry');
  await page.getByRole('button', { name: 'Send Inquiry Message' }).click();

  await expect(page.locator('#contactToast')).toBeVisible();
  await expect(page.locator('#contactToast')).toContainText('Message sent successfully');
});

test('includes a non-interactive Formspree honeypot', async ({ page }) => {
  await page.goto('/contact/');

  const honeypot = page.locator('#contactForm input[name="_gotcha"]');
  await expect(honeypot).toHaveAttribute('tabindex', '-1');
  await expect(honeypot).toHaveAttribute('autocomplete', 'off');
  await expect(honeypot).toHaveAttribute('aria-hidden', 'true');
  await expect(honeypot).toBeHidden();
});

test('keeps Samantha email address out of public contact content', async ({ page }) => {
  await page.goto('/contact/');

  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('sam@samanthafernando.com');

  const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(structuredData)['@graph'].find(item => item['@type'] === 'Person')).not.toHaveProperty('email');
});

test('shows a contact error when Formspree rejects the submission', async ({ page }) => {
  await page.goto('/contact/');
  await page.route('https://formspree.io/f/mlgqqjen', async route => {
    await route.fulfill({ status: 422, contentType: 'application/json', body: '{}' });
  });

  await page.getByPlaceholder('Name...').fill('Test Visitor');
  await page.getByPlaceholder('Email...').fill('test@example.com');
  await page.getByPlaceholder('Specify work title or details...').fill('Test inquiry');
  await page.getByRole('button', { name: 'Send Inquiry Message' }).click();

  await expect(page.locator('#contactError')).toBeVisible();
  await expect(page.locator('#contactError')).toContainText('Unable to send your message');
});

test('filters the Listen view by instrumentation', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();
  await expect(page.locator('#tab-works')).toBeVisible();
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#worksContainer .work-media-action').first()).toBeVisible();

  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await page.getByRole('option', { name: 'Vocal & Choral', exact: true }).click();
  await expect(page.locator('#worksInstrumentationLabel')).toHaveText('Vocal & Choral');
  await expect(page.locator('#worksContainer')).toContainText('Everything Passes, Everything is Connected');
  await expect(page.locator('#worksContainer h3', { hasText: 'Balconies' })).toHaveCount(0);
});

test('shows Wintering watch CTA in All Works', async ({ page }) => {
  await page.goto('/works/');

  const wintering = page.locator('#worksContainer > div', { has: page.getByRole('heading', { name: 'Wintering' }) });
  await expect(wintering.getByRole('button', { name: 'Watch Wintering (Trailer)' })).toBeVisible();
});

test('lists TRAPPIST-1e as an orchestral work with both premieres', async ({ page }) => {
  await page.goto('/works/');

  const exoplanets = page.locator('#worksContainer > div', {
    has: page.getByRole('heading', { name: 'Exoplanets: TRAPPIST-1e' })
  });
  await expect(exoplanets).toContainText('Orchestral');
  await expect(exoplanets).toContainText('Norwich Theatre Royal, 2025 (Naomi Woo)');
  await expect(exoplanets).toContainText('Hackney Empire, 2026 (Micah Gleason)');
  await expect(exoplanets.getByRole('button', { name: 'Watch The Exoplanets: Samantha Fernando introduces TRAPPIST-1e' })).toBeVisible();
});

test('shows the TRAPPIST-1e introduction in Watch', async ({ page }) => {
  await page.goto('/watch/');

  await expect(page.locator('#worksContainer')).toContainText('The Exoplanets: Samantha Fernando introduces TRAPPIST-1e');
  await expect(page.locator('#worksContainer').getByRole('button', { name: 'Watch The Exoplanets: Samantha Fernando introduces TRAPPIST-1e' })).toBeVisible();
});

test('excludes removed films from Watch', async ({ page }) => {
  await page.goto('/watch/');

  const works = page.locator('#worksContainer');
  await expect(works).not.toContainText('Today the Letter Must Come');
  await expect(works).not.toContainText('glass human - Official Trailer');
  await expect(works).not.toContainText("The Composer's Mind");
  await expect(works).not.toContainText('Samantha Fernando: Pathways');
  await expect(page.locator('#worksViewDescription')).toHaveText('Performance films and composer features.');
});

test('shows CTAs for title variants linked to works', async ({ page }) => {
  await page.goto('/works/');

  for (const [workTitle, mediaTitle] of [
    ['Current, Rising', "Trailer: Current, Rising - The World's First Hyper-Reality Opera"],
    ['Fault-Line', 'Fault Line for Solo Cello']
  ]) {
    const work = page.locator('#worksContainer > div', { has: page.getByRole('heading', { name: workTitle, exact: true }) });
    await expect(work.getByRole('button', { name: `Watch ${mediaTitle}` })).toBeVisible();
  }

  const currentRising = page.locator('#worksContainer > div', { has: page.getByRole('heading', { name: 'Current, Rising', exact: true }) });
  await expect(currentRising.getByRole('button', { name: "Watch Trailer: Current, Rising - The World's First Hyper-Reality Opera" })).toBeVisible();
  await expect(currentRising.getByRole('button', { name: "Watch Current, Rising: The World's First Hyper-Reality Opera" })).toHaveCount(0);
});

test('includes Samantha\'s PhD in the biography', async ({ page }) => {
  await page.goto('/biography/');

  await expect(page.locator('#tab-bio')).toContainText('She holds a PhD in Composition.');
});

test('resets filters when switching between Works, Listen and Watch views', async ({ page }) => {
  await page.goto('/listen/');
  const search = page.locator('#worksSearchInput');

  await search.fill('Vocal');
  await page.getByRole('button', { name: 'Instrumentation: All' }).click();
  await page.getByRole('option', { name: 'Vocal & Choral', exact: true }).click();

  await page.locator('#works-view-watch').click();
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#works-view-watch')).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('');
  await expect(page.locator('#worksInstrumentationLabel')).toHaveText('Instrumentation: All');
  await expect(page.locator('#worksContainer')).toContainText('Look Up');
  await expect(page.locator('#worksContainer').getByRole('button', { name: 'Watch Sound Inhabitants' })).toBeVisible();

  await page.locator('#works-view-all').click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#works-view-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('');
  await expect(page.locator('#worksInstrumentationLabel')).toHaveText('Instrumentation: All');
  await expect(page.locator('#worksContainer')).toContainText('Wintering');
});

test('soundbar progress display is present and non-interactive', async ({ page }) => {
  await page.goto('/');

  const progress = page.locator('#soundbarProgress');
  await expect(progress).toHaveAttribute('role', 'progressbar');
  // No track is loaded: the bar is indeterminate, so it carries no
  // determinate range attributes (aria-valuemax/aria-valuenow).
  await expect(progress).not.toHaveAttribute('aria-valuenow', /.+/);
  await expect(progress).not.toHaveAttribute('aria-valuemax', /.+/);
  await expect(page.locator('#soundbarProgress button, #soundbarProgress input')).toHaveCount(0);
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  await expect(page.locator('#soundbarDurationTime')).toBeHidden();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarRestartBtn')).toHaveAttribute('aria-label', 'Restart track');
  await expect(page.locator('#soundbarStopBtn')).toHaveAttribute('aria-label', 'Stop playback');
});

test('soundbar starts with the default track name', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#soundbarTitle')).toHaveText('Everything Passes, Everything is Connected');
  await expect(page.locator('#soundbarPerformer')).toHaveText('The Crossing');
  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();
  await expect(page.locator('#worksContainer [data-spotify-track="3YV79qjiJLOgYjjEzTsVEy"]')).toBeVisible();
});

test('exposes catalogue audio actions as keyboard-operable buttons', async ({ page }) => {
  await mockPlaybackProviders(page);
  await page.goto('/listen/');

  const action = page.locator('#worksContainer [data-track="illuminations"]');
  await expect(action).toHaveRole('button');
  await action.press('Enter');
  await expect.poll(() => page.evaluate(() => Boolean(window.__soundCloudPlayers?.soundcloudPlayerIlluminations))).toBe(true);
});

test('lists confirmed Listen metadata without placeholder details', async ({ page }) => {
  await page.goto('/listen/');

  const works = page.locator('#worksContainer');
  await expect(works).toContainText('The Journey Between Us - Reflection 1');
  await expect(works).toContainText('How Many Moments Must');
  const spotifyCard = works.locator('[data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]').locator('../..');
  await expect(spotifyCard).toContainText('Solo & Chamber');
  await expect(spotifyCard).toContainText('6:53');
  await expect(spotifyCard.getByRole('button', { name: 'Preview' })).toBeVisible();
  await expect(spotifyCard).not.toContainText('30 sec preview');
  await expect(spotifyCard).not.toContainText('Spotify');
  await expect(works).not.toContainText('[Missing Spotify title]');
  await expect(works).not.toContainText('[Missing duration]');
});

test('keeps Works view controls legible in light mode', async ({ page }) => {
  await page.goto('/listen/');

  await expect(page.locator('#works-view-listen')).toHaveCSS('background-color', 'rgb(111, 53, 8)');
  await expect(page.locator('#works-view-listen')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('#works-view-all')).toHaveCSS('background-color', 'rgb(232, 225, 213)');
  await expect(page.locator('#works-view-all')).toHaveCSS('color', 'rgb(24, 33, 31)');
});

test('Spotify loads the selected first track from the beginning', async ({ page }) => {
  await mockPlaybackProviders(page);
  await page.goto('/');
  await page.evaluate(() => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi));
  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();

  await page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]').click();

  await expect(page.locator('#soundbarTitle')).toHaveText('Balconies');
  await expect(page.locator('#soundbarPerformer')).toHaveText('Olivia de Prato');
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual([
    'loadUri',
    'spotify:track:2wNL47uCuwDpbOqCIpbSTS',
  ]);
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual(['seek', 0]);
  // No guessed total: the duration stays unknown until the player reports
  // it, so the bar carries no determinate range attributes at all.
  await expect(page.locator('#soundbarDurationTime')).toBeHidden();
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuemax', /.+/);
});

test('SoundCloud and Spotify playback are mutually exclusive', async ({ page }) => {
  await mockPlaybackProviders(page);
  await page.goto('/');
  await page.evaluate(() => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi));
  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();

  await page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]').click();
  await page.locator('#worksContainer [data-track="look-up"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__soundCloudPlayers?.soundcloudPlayerLookUp))).toBe(true);
  await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.READY());

  await expect(page.locator('#soundbarTitle')).toHaveText('Look Up');
  await expect(page.locator('#soundbarPerformer')).toHaveText('4 voices, viola da gamba and electronics');
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual(['pause']);
  await expect.poll(() => page.evaluate(() => window.__soundCloudCalls)).toContainEqual(['play', 'soundcloudPlayerLookUp']);
});

test('SoundCloud queued playback responds to pause and finish events', async ({ page }) => {
  await mockPlaybackProviders(page);
  await page.goto('/');
  await rejectAnalyticsCookies(page);
  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();

  await page.locator('#worksContainer [data-track="look-up"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__soundCloudPlayers?.soundcloudPlayerLookUp))).toBe(true);
  await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.READY());
  // Wait for the player's own play() acknowledgement before trusting the
  // bar: the request path presents the playing label optimistically, so the
  // label alone cannot prove the queued playback actually started.
  await expect.poll(() => page.evaluate(() => window.__soundCloudCalls)).toContainEqual(['play', 'soundcloudPlayerLookUp']);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');

  await page.locator('#soundbarPauseBtn').click();
  await expect.poll(() => page.evaluate(() => window.__soundCloudCalls)).toContainEqual(['pause', 'soundcloudPlayerLookUp']);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.FINISH());
  await page.locator('#nav-works').click();
  await expect(page.locator('#soundbar')).toBeHidden();
});

test('header Listen opens the soundbar for the default track', async ({ page }) => {
  await page.goto('/');

  await page.locator('#ambientSoundBtn').click();

  await expect(page.locator('#soundbar')).toBeVisible();
  await expect(page.locator('#soundbarTitle')).toHaveText('Everything Passes, Everything is Connected');
  await expect(page.locator('#soundbarPerformer')).toHaveText('The Crossing');
});

test('soundbar is anchored to the viewport bottom with readable theme colours', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/');
  // Answer the analytics choice: while it is unanswered the bar deliberately
  // lifts above the consent banner instead of sitting at the viewport edge
  // (see tests/consent-banner-soundbar.spec.js).
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.locator('#ambientSoundBtn').click();

  const soundbar = page.locator('#soundbar');
  await expect(soundbar).toBeVisible();
  await expect(soundbar).toHaveCSS('bottom', '0px');
  await expect(soundbar).toHaveCSS('color', 'rgb(253, 243, 227)');
  await expect(soundbar).toHaveCSS('background-color', 'rgb(110, 53, 0)');
  await expect(page.locator('#soundbarTimes')).toHaveCSS('color', 'rgb(238, 207, 163)');

  await page.locator('#themeToggleBtn').click();
  // Both themes keep the amber-lit bar so it contrasts with the page:
  // cream text on a deep amber surface.
  await expect(soundbar).toHaveCSS('color', 'rgb(253, 243, 227)');
  await expect(soundbar).toHaveCSS('background-color', 'rgb(110, 53, 0)');
  await expect(page.locator('#soundbarTimes')).toHaveCSS('color', 'rgb(238, 207, 163)');
});

test('soundbar keeps stable geometry across track names, loading and enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  // Reveal the bar without starting playback: the ambient button starts the
  // real Spotify embed, whose first asynchronous playback_update re-applies
  // the current track label and can land between this test's label pokes.
  await page.evaluate(() => document.getElementById('soundbar').classList.remove('hidden'));

  const soundbar = page.locator('#soundbar');
  await expect(soundbar).toBeVisible();
  const barHeight = async () => Math.round((await soundbar.boundingBox()).height);

  // The approved layout reserves one row for the title and one for the
  // performer credit: the bar and its controls never move when the
  // selection changes or the loading message comes and goes.
  const baseHeight = await barHeight();
  await page.evaluate(() => setSoundbarLabel('Everything Passes, Everything is Connected · The Crossing, unaccompanied choir'));
  expect(await barHeight()).toBe(baseHeight);
  await page.evaluate(() => setSoundbarLabel('Recollections'));
  expect(await barHeight()).toBe(baseHeight);
  await expect(page.locator('#soundbarPerformer')).toHaveText('');
  await page.evaluate(() => {
    setSoundbarLabel('The Journey Between Us - Reflection 1 · Mixed ensemble');
    document.getElementById('soundbar').classList.add('loading');
    document.getElementById('soundbarLoading').classList.remove('hidden');
  });
  expect(await barHeight()).toBe(baseHeight);

  // Enlarged root text scales the reserved rows; the states still match.
  await page.evaluate(() => {
    document.getElementById('soundbar').classList.remove('loading');
    document.getElementById('soundbarLoading').classList.add('hidden');
    document.documentElement.style.fontSize = '200%';
  });
  const enlargedHeight = await barHeight();
  expect(enlargedHeight).toBeGreaterThan(baseHeight);
  await page.evaluate(() => setSoundbarLabel('Everything Passes, Everything is Connected · The Crossing, unaccompanied choir'));
  expect(await barHeight()).toBe(enlargedHeight);
  await page.evaluate(() => setSoundbarLabel('Recollections'));
  expect(await barHeight()).toBe(enlargedHeight);

  // Narrow 320px phones: the reserved rows truncate harder but the bar and
  // controls stay put exactly as at wider widths.
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 320, height: 568 });
  const narrowHeight = await barHeight();
  await page.evaluate(() => setSoundbarLabel('Everything Passes, Everything is Connected · The Crossing, unaccompanied choir'));
  expect(await barHeight()).toBe(narrowHeight);
  await page.evaluate(() => setSoundbarLabel('Recollections'));
  expect(await barHeight()).toBe(narrowHeight);
  await page.evaluate(() => {
    setSoundbarLabel('The Journey Between Us - Reflection 1 · Mixed ensemble');
    document.getElementById('soundbar').classList.add('loading');
    document.getElementById('soundbarLoading').classList.remove('hidden');
  });
  expect(await barHeight()).toBe(narrowHeight);
});

test('soundbar keeps usable text room at 320px with 200% text', async ({ page }) => {
  // A visitor combining a narrow phone with a 200% text setting: the bar's
  // chrome (padding, control cluster) is sized in px so the enlarged text
  // rows keep real room instead of being crushed by a scaled-up frame.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });

  const metrics = await page.evaluate(() => {
    const bar = document.getElementById('soundbar').getBoundingClientRect();
    const info = document.getElementById('soundbarTrackInfo').getBoundingClientRect();
    const controls = document.getElementById('soundbarControls').getBoundingClientRect();
    const firstButton = document.querySelector('#soundbarControls button').getBoundingClientRect();
    return {
      barWidth: bar.width,
      barHeight: bar.height,
      infoWidth: info.width,
      infoBottom: info.bottom,
      controlsLeft: controls.left,
      controlsTop: controls.top,
      infoRight: info.right,
      buttonWidth: firstButton.width,
      buttonHeight: firstButton.height,
    };
  });
  // The piece name column keeps enough room for several characters of the
  // enlarged text, the controls never overlap it (here: wrapped to their own
  // row below), and the buttons grow with the visitor's text setting while
  // staying at least the standard 28px touch size of the normal layout.
  expect(metrics.infoWidth).toBeGreaterThanOrEqual(96);
  expect(metrics.controlsTop).toBeGreaterThanOrEqual(metrics.infoBottom);
  expect(metrics.controlsLeft).toBeGreaterThanOrEqual(metrics.infoRight - metrics.infoWidth);
  expect(metrics.buttonWidth).toBeGreaterThanOrEqual(28);
  expect(metrics.buttonHeight).toBeGreaterThanOrEqual(28);
});

test('failure notice and page end stay clear of the fixed soundbar', async ({ page }) => {
  const offsetVar = () => page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--soundbar-offset')));
  const geometry = () => page.evaluate(() => {
    const bar = document.getElementById('soundbar').getBoundingClientRect();
    const notice = document.getElementById('audioAvailabilityMessage').getBoundingClientRect();
    return { barTop: bar.top, barHeight: bar.height, noticeBottom: notice.bottom };
  });
  const showNotice = () => page.evaluate(() => {
    const notice = document.getElementById('audioAvailabilityMessage');
    notice.textContent = 'This recording is not currently available to embed from Spotify.';
    notice.classList.remove('hidden');
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/listen/');
  await rejectAnalyticsCookies(page);

  // Hidden bar: no reservation, the notice keeps its normal offset.
  expect(await offsetVar()).toBe(0);
  await expect(page.locator('body')).toHaveCSS('padding-bottom', '0px');

  // Shown, unwrapped: the reservation and the notice track the bar's height.
  await page.evaluate(() => document.getElementById('soundbar').classList.remove('hidden'));
  await expect(page.locator('#soundbar')).toBeVisible();
  await expect.poll(offsetVar).toBeGreaterThan(0);
  let geo = await geometry();
  expect(await offsetVar()).toBeCloseTo(geo.barHeight, 0);
  await showNotice();
  geo = await geometry();
  expect(geo.noticeBottom).toBeLessThanOrEqual(geo.barTop + 0.5);

  // Wrapped at 320px with 200% text: the notice still clears the taller bar.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect.poll(async () => (await geometry()).barHeight).toBeGreaterThan(150);
  geo = await geometry();
  expect(await offsetVar()).toBeCloseTo(geo.barHeight, 0);
  expect(geo.noticeBottom).toBeLessThanOrEqual(geo.barTop + 0.5);
  // ...and the whole message stays on screen rather than clipping off the top.
  expect(await page.evaluate(() =>
    document.getElementById('audioAvailabilityMessage').getBoundingClientRect().top
  )).toBeGreaterThanOrEqual(0);
  // The capped message scrolls internally, so its full text stays reachable.
  const scroll = await page.evaluate(() => {
    const notice = document.getElementById('audioAvailabilityMessage');
    const before = notice.scrollTop;
    notice.scrollTop = notice.scrollHeight;
    const endLine = document.createRange();
    endLine.selectNodeContents(notice);
    return {
      scrollable: notice.scrollHeight > notice.clientHeight,
      moved: notice.scrollTop > before,
      endBottom: endLine.getBoundingClientRect().bottom,
      boxBottom: notice.getBoundingClientRect().bottom,
    };
  });
  expect(scroll.scrollable).toBe(true);
  expect(scroll.moved).toBe(true);
  expect(scroll.endBottom).toBeLessThanOrEqual(scroll.boxBottom + 0.5);

  // Back to normal text: the reservation shrinks with the bar.
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await expect.poll(offsetVar).toBeLessThan(150);
  geo = await geometry();
  expect(await offsetVar()).toBeCloseTo(geo.barHeight, 0);

  // The page end scrolls clear: the last footer link is never trapped under
  // the bar at maximum scroll, even wrapped at 320px with 200% text.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect.poll(async () => (await geometry()).barHeight).toBeGreaterThan(150);
  // Scroll to the end after the enlarged-text reflow settles.
  await expect.poll(async () => page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return Math.round(scrollY + innerHeight - document.documentElement.scrollHeight);
  })).toBe(0);
  const reach = await page.evaluate(() => {
    const bar = document.getElementById('soundbar').getBoundingClientRect();
    const links = [...document.querySelectorAll('footer a')];
    const last = links[links.length - 1].getBoundingClientRect();
    return { lastLinkBottom: last.bottom, barTop: bar.top };
  });
  expect(reach.lastLinkBottom).toBeLessThanOrEqual(reach.barTop + 0.5);
});

test('soundbar is anchored to the viewport bottom on mobile @mobile', async ({ page }) => {
  await page.goto('/');
  // Answer the analytics choice first: while unanswered the bar deliberately
  // lifts above the consent banner (see tests/consent-banner-soundbar.spec.js).
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await page.locator('#ambientSoundBtn').click();

  await expect(page.locator('#soundbar')).toBeVisible();
  await expect(page.locator('#soundbar')).toHaveCSS('bottom', '0px');
});

test('soundbar stays visible while navigating between pages', async ({ page }) => {
  await page.goto('/');
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();

  await page.locator('#nav-works').click();

  await expect(page.locator('#tab-works')).toBeVisible();
  await expect(page.locator('#soundbar')).toBeVisible();
});

for (const provider of ['soundcloud', 'spotify']) {
  test(`${provider} controllers and playback survive repeated real-page navigation`, async ({page}) => {
    await mockPlaybackProviders(page);
    await page.goto('/listen/');
    await rejectAnalyticsCookies(page);
    if (provider === 'soundcloud') {
      await page.locator('#worksContainer [data-track="look-up"]').click();
      await expect.poll(() => page.evaluate(() => Boolean(window.__soundCloudPlayers?.soundcloudPlayerLookUp))).toBe(true);
      await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.READY());
    } else {
      await page.evaluate(() => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi));
      await page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]').click();
      // The Spotify player confirms the request; only then does the bar show playing.
      await expect
        .poll(() => page.evaluate(() => Boolean(window.__spotifyHandlers?.playback_update)))
        .toBe(true);
      await page.evaluate(() =>
        window.__spotifyHandlers.playback_update({
          data: { isPaused: false, isBuffering: false, position: 0, duration: 30000 },
        }),
      );
    }
    await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
    const calls = await page.evaluate(() => JSON.stringify([window.__soundCloudCalls, window.__spotifyCalls]));
    await page.evaluate(() => { window.__originalPlayers = document.getElementById('soundcloudPlayers'); });
    for (const tab of ['bio', 'contact', 'writing', 'listen', 'home', 'listen']) {
      await page.locator(`#nav-${tab}`).click();
      await expect(page.locator(`#nav-${tab}`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#soundbar')).toBeVisible();
      await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
    }
    expect(await page.evaluate(() => document.getElementById('soundcloudPlayers') === window.__originalPlayers)).toBe(true);
    expect(await page.evaluate(() => JSON.stringify([window.__soundCloudCalls, window.__spotifyCalls]))).toBe(calls);
    const active = provider === 'soundcloud' ? '[data-track="look-up"]' : '[data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]';
    await expect(page.locator(`#worksContainer ${active} .fa-pause`)).toBeVisible();
    await page.locator(`#worksContainer ${active}`).click();
    await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  });
}

test('stopped playback is cleared when navigating away', async ({ page }) => {
  await page.goto('/');
  await rejectAnalyticsCookies(page);
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();

  await expect(page.locator('#soundbarRestartBtn')).toHaveAttribute('aria-label', 'Restart track');
  await page.locator('#soundbarStopBtn').click();
  await expect(page.locator('#soundbarStopBtn')).toHaveAttribute('aria-label', 'Stop playback');

  await page.locator('#nav-works').click();
  await expect(page.locator('#soundbar')).toBeHidden();
});

test('stop playback removes and hides the soundbar immediately', async ({ page }) => {
  await page.goto('/');
  await rejectAnalyticsCookies(page);
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();

  await page.locator('#soundbarStopBtn').click();

  await expect(page.locator('#soundbar')).toBeHidden();
  await expect(page.locator('#soundbarTitle')).toHaveText('Everything Passes, Everything is Connected');
  await expect(page.locator('#soundbarPerformer')).toHaveText('The Crossing');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
});

test('initialises navigation before the audio players', async ({ page }) => {
  await page.goto('/');

  await page.locator('#nav-works').click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#tab-works')).toBeVisible();
});

test('opens and closes a featured project modal', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'View Full Project Details' }).first();
  await trigger.click();
  await expect(page.locator('#modalOverlay')).toBeVisible();
  await expect(page.locator('#modalContent')).toContainText('Wintering');
  await expect(page.locator('#modalOverlay')).toHaveAttribute('aria-labelledby', 'modalTitle');
  await expect(page.locator('#modalOverlay').getByRole('heading', { name: 'Wintering' })).toHaveAttribute('id', 'modalTitle');
  await expect(page.getByRole('button', { name: 'Close project details' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#modalOverlay')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('opens and closes a YouTube modal without playing video', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('link', { name: 'Watch', exact: true }).first().click();
  await page.locator('#worksContainer').getByRole('button', { name: /^Watch / }).first().click();

  await expect(page.locator('#videoModalOverlay')).toBeVisible();
  await expect(page.locator('#videoFrame')).toHaveAttribute('src', /youtube\.com\/embed/);
  await expect(page.getByRole('button', { name: 'Close video' })).toBeFocused();

  await page.getByRole('button', { name: 'Close video' }).click();
  await expect(page.locator('#videoModalOverlay')).toBeHidden();
  await expect(page.locator('#videoFrame')).toHaveAttribute('src', '');
});

test('opening a video removes active audio and hides the soundbar', async ({ page }) => {
  await page.goto('/');
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();

  await page.getByRole('link', { name: 'Watch', exact: true }).first().click();
  await page.locator('#worksContainer').getByRole('button', { name: /^Watch / }).first().click();

  await expect(page.locator('#videoModalOverlay')).toBeVisible();
  await expect(page.locator('#soundbar')).toBeHidden();
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
});

test('announces catalogue result changes and exposes mutually exclusive views', async ({ page }) => {
  await page.goto('/works/');

  await expect(page.locator('#worksContainer')).toHaveAttribute('role', 'region');
  await expect(page.locator('#worksContainer')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#works-view-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#works-view-listen').click();
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');
});

test('Listen and Watch views expose their selected state and deep links', async ({ page }) => {
  await page.goto('/listen/');

  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#works-view-watch').click();
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#works-view-watch')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'false');

  await page.getByLabel('Works and media view').getByRole('button', { name: 'Works', exact: true }).click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('#works-view-all')).toHaveAttribute('aria-pressed', 'true');
});

test('retired Works view fragments land on the Listen and Watch pages', async ({ page }) => {
  await page.goto('/works/#listen');
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/works/#watch');
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#works-view-watch')).toHaveAttribute('aria-pressed', 'true');
});

test('deployed hostname is publicly accessible', async ({ page, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Chromium maps the production hostname to the local server.');
  await page.goto(`http://www.samanthafernando.com:${new URL(baseURL).port}/`);

  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Private site' })).toHaveCount(0);
});

test('searches works and shows the empty result state', async ({ page }) => {
  await page.goto('/works/');

  const search = page.locator('#worksSearchInput');
  await search.fill('Wintering');
  await expect(page.locator('#worksContainer')).toContainText('Wintering');

  await search.fill('No matching composition');
  await expect(page.locator('#worksContainer')).toContainText('No compositions found matching your search query.');
});

test('uses mobile navigation to switch sections @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.locator('#mobileMenuToggle').click();
  await page.getByRole('link', { name: 'Contact' }).last().click();

  await expect(page.locator('#tab-contact')).toBeVisible();
  await expect(page.locator('#mobileMenu')).toBeHidden();
});

test('mobile navigation opens Listen and Watch directly @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.locator('#mobileMenuToggle').click();
  await page.locator('#mobileMenu').getByRole('link', { name: 'Listen', exact: true }).click();
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#mobileMenuToggle').click();
  await page.locator('#mobileMenu').getByRole('link', { name: 'Watch', exact: true }).click();
  await expect(page).toHaveURL(/\/watch\/$/);
  await expect(page.locator('#works-view-watch')).toHaveAttribute('aria-pressed', 'true');
});

[
  ['bio', '#tab-bio'],
  ['works', '#tab-works'],
  ['listen', '#tab-works'],
  ['watch', '#tab-works'],
  ['writing', '#tab-writing'],
  ['contact', '#tab-contact'],
].forEach(([anchor, sectionSelector]) => {
  test(`opens the ${anchor} deep link`, async ({ page }) => {
    const path = { bio: '/biography/', works: '/works/', listen: '/listen/', watch: '/watch/', writing: '/writing/', contact: '/contact/' }[anchor];
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator(sectionSelector)).toBeVisible();
  });
});

async function expectNoSeriousAxeViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blockingViolations = results.violations.filter(
    violation => ['serious', 'critical'].includes(violation.impact),
  );

  expect(blockingViolations).toEqual([]);
}

test('has no serious or critical accessibility violations across interactive states', async ({ page }) => {
  await page.goto('/');
  await expectNoSeriousAxeViolations(page);

  await page.locator('#nav-works').click();
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('link', { name: 'Listen', exact: true }).first().click();
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('link', { name: 'Contact' }).click();
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('link', { name: 'Biography' }).click();
  await expectNoSeriousAxeViolations(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobileMenuToggle').click();
  await expectNoSeriousAxeViolations(page);
});
