const {test, expect} = require('@playwright/test');
const {readFile} = require('node:fs/promises');

let sourceHtml;
let catalogue;
let pages;

test.beforeAll(async () => {
  catalogue = await import('../scripts/lib/catalogue.mjs');
  pages = await import('../scripts/lib/pages.mjs');
  sourceHtml = await readFile('index.html', 'utf8');
});

async function serveSnapshot(page, update) {
  const data = catalogue.readCatalogueFallback(sourceHtml);
  update(data);
  const files = pages.renderPages(catalogue.renderCatalogue(sourceHtml, data));
  await page.route('http://127.0.0.1:8010/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = files.get(path === '/' ? 'index.html' : `${path.slice(1)}index.html`);
    return body ? route.fulfill({contentType: 'text/html', body}) : route.continue();
  });
  await page.addInitScript(() => {
    window.__calls = [];
    window.__spotifyHandlers = {};
    window.__spotifyApi = {
      createController: (_element, _options, callback) => callback({
        loadUri: uri => window.__calls.push(['spotify', uri]),
        seek: () => {}, play: () => {}, pause: () => {}, resume: () => {}, togglePlay: () => {},
        addListener: (event, handler) => {
          window.__spotifyHandlers[event] = handler;
        },
      }),
    };
    const Widget = element => {
      const handlers = {};
      return {
        bind: (event, handler) => {
          handlers[event] = handler;
          if (event === 'READY') queueMicrotask(handler);
        },
        getDuration: callback => callback(60_000),
        getPosition: callback => callback(0),
        pause: () => handlers.PAUSE?.(),
        seekTo: () => {},
        play: () => { window.__calls.push(['soundcloud', element.id]); handlers.PLAY?.(); },
      };
    };
    Widget.Events = {READY: 'READY', PLAY: 'PLAY', PAUSE: 'PAUSE', FINISH: 'FINISH', ERROR: 'ERROR'};
    window.SC = {Widget};
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://w.soundcloud.com/player/api.js', route => route.fulfill({contentType: 'application/javascript', body: ''}));
  await page.route('https://w.soundcloud.com/player/?**', route => route.fulfill({contentType: 'text/html', body: ''}));
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({contentType: 'text/html', body: ''}));
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => route.fulfill({contentType: 'application/javascript', body: 'window.onSpotifyIframeApiReady(window.__spotifyApi);'}));
  return data;
}

test('generated catalogue keeps renamed Work relationships and editorial action order', async ({page}) => {
  await serveSnapshot(page, data => {
    data.works.find(work => work.id === 'work-10').title = 'Renamed song cycle';
    data.media.find(media => media.title === 'The Half Moon').actionOrder = 0;
    data.media.find(media => media.title === 'How Many Moments Must').actionOrder = 2;
    data.settings.heading = 'Edited catalogue heading';
  });
  await page.goto('/works/');
  await expect(page.locator('#worksHeading')).toHaveText('Edited catalogue heading');
  await page.locator('#worksSearchInput').fill('Renamed song cycle');
  const actions = page.locator('#worksContainer [data-spotify-track]');
  await expect(actions).toHaveCount(3);
  await expect(actions.first()).toHaveAttribute('data-spotify-track', '1o0qiFnwPPgBA3k6QWVPM8');
  await actions.first().click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContainEqual(['spotify', 'spotify:track:1o0qiFnwPPgBA3k6QWVPM8']);
  // The bar shows playing only once the Spotify player confirms the request.
  await page.evaluate(() =>
    window.__spotifyHandlers.playback_update?.({
      data: { isPaused: false, isBuffering: false, position: 0, duration: 30000 },
    }),
  );
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await actions.first().click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await page.locator('#nav-listen').click();
  await expect(page.locator('#works-view-listen')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#worksSearchInput').fill('Renamed song cycle');
  await expect(page.locator('#worksContainer h3')).toHaveCount(3);
});

test('new SoundCloud recording supplies its player configuration and can be the header default', async ({page}) => {
  await serveSnapshot(page, data => {
    data.media.push({key: 'new-recording', type: 'listen', title: 'New public recording', detail: 'New performer', provider: 'soundcloud', id: 'new-recording', url: 'https://soundcloud.com/samanthafernando/new-recording', actionOrder: 0});
    data.settings.defaultRecording = 'new-recording';
  });
  await page.goto('/');
  await page.locator('#ambientSoundBtn').click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContainEqual(['soundcloud', 'soundcloudPlayer-new-recording']);
  await expect(page.locator('#soundbarTitle')).toHaveText('New public recording');
  await expect(page.locator('#soundbarPerformer')).toHaveText('');
  await expect(page.locator('#soundcloudPlayer-new-recording')).toHaveAttribute('src', /samanthafernando%2Fnew-recording/);
  await page.locator('#soundbarStopBtn').click();
  await expect(page.locator('#soundbar')).toBeHidden();
  await page.locator('#ambientSoundBtn').click();
  await expect(page.locator('#soundbar')).toBeVisible();
});

test('new Spotify URL supplies the playback ID and header default without a hard-coded map', async ({page}) => {
  await serveSnapshot(page, data => {
    data.media.push({key: 'new-spotify', type: 'listen', title: 'New Spotify recording', detail: 'New performer', provider: 'spotify', id: 'generated-document-id', url: 'https://open.spotify.com/track/7lmUNPa9oAkmYwdo88guI4', actionOrder: 0});
    data.settings.defaultRecording = 'new-spotify';
  });
  await page.goto('/');
  await page.locator('#ambientSoundBtn').click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContainEqual(['spotify', 'spotify:track:7lmUNPa9oAkmYwdo88guI4']);
  await expect(page.locator('#soundbarTitle')).toHaveText('New Spotify recording');
  await expect(page.locator('#soundbarPerformer')).toHaveText('');
});

test('CMS quotes and markup render as text, with functional media actions in both themes', async ({page}) => {
  const maliciousTitle = `A "quoted" <img src=x onerror="window.__injected=true"> title's </script>`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await serveSnapshot(page, data => {
    const film = data.media.find(media => media.type === 'watch');
    film.title = maliciousTitle;
    film.detail = '<script>window.__injected=true</script>';
  });
  await page.goto('/watch/');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.locator('#themeToggleBtn').click();
    await page.locator('#worksSearchInput').fill('quoted');
    await expect(page.locator('#worksContainer h3')).toHaveText(maliciousTitle);
    await expect(page.locator('#worksContainer img')).toHaveCount(1); // only the thumbnail
    await page.getByRole('button', {name: `Watch ${maliciousTitle}`, exact: true}).click();
    await expect(page.locator('#videoModalTitle')).toHaveText(maliciousTitle);
    await expect(page.locator('#videoFrame')).toHaveAttribute('src', /PtuinjIcJD0/);
    await page.getByRole('button', {name: 'Close video', exact: true}).click();
  }
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('empty published catalogue stays empty and header Listen opens the catalogue', async ({page}) => {
  await serveSnapshot(page, data => {
    data.works = [];
    data.media = [];
    data.settings.defaultRecording = null;
  });
  await page.goto('/works/');
  await expect(page.locator('#worksContainer')).toContainText('No compositions found');
  await page.locator('#ambientSoundBtn').click();
  await expect(page).toHaveURL(/\/listen\/$/);
  await expect(page.locator('#worksContainer')).toContainText('No recordings found');
  await expect(page.locator('#soundbar')).toBeHidden();
  await page.locator('#nav-watch').click();
  await expect(page.locator('#worksContainer')).toContainText('No films found');
});

test('unrelated recordings remain playable and films need no composition relationship', async ({page}) => {
  await serveSnapshot(page, data => {
    data.media.find(media => media.type === 'watch').workId = null;
  });
  await page.goto('/listen/');
  await page.locator('#worksSearchInput').fill('Recollections');
  await expect(page.locator('#worksContainer h3')).toHaveText('Recollections');
  await page.locator('#worksContainer [data-track="recollections"]').click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContainEqual(['soundcloud', 'soundcloudPlayerRecollections']);
  await page.locator('#nav-watch').click();
  await expect(page).toHaveURL(/\/watch\/$/);
  await page.locator('#worksSearchInput').fill('TRAPPIST');
  await page.locator('#worksContainer button').click();
  await expect(page.locator('#videoFrame')).toHaveAttribute('src', /PtuinjIcJD0/);
  await expect(page.locator('#soundbar')).toBeHidden();
});

