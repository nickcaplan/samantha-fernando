const { test, expect } = require('@playwright/test');

// A controllable Spotify IFrame API: playback_update events are fired
// explicitly by each test so playback state stays deterministic.
async function mockSpotify(page, { deferControllerCallback = false, deferApiReady = false, realistic = false, durationMs = 30000, tickMs = 500 } = {}) {
  await page.addInitScript(({ defer, realistic, durationMs, tickMs }) => {
    window.__spotifyCalls = [];
    window.__spotifyHandlers = {};
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        const state = { uri: null, positionMs: 0, paused: true, started: false, timer: null };
        const stopTimer = () => {
          if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
          }
        };
        // Realistic mode mirrors the real Spotify embed, so a test cannot
        // pass through behaviour the real player does not have: play()
        // restarts the loaded track from zero, resume() continues from the
        // paused position, and seek() takes seconds.
        const fire = () => {
          const handler = window.__spotifyHandlers.playback_update;
          if (handler && state.uri) {
            handler({ data: { playingURI: state.uri, isPaused: state.paused, isBuffering: false, position: state.positionMs, duration: durationMs } });
          }
        };
        const startTimer = () => {
          stopTimer();
          state.timer = setInterval(() => {
            if (state.paused) return;
            state.positionMs = Math.min(state.positionMs + tickMs, durationMs);
            if (state.positionMs >= durationMs) {
              state.paused = true;
              stopTimer();
            }
            fire();
          }, tickMs);
        };
        const controller = {
          loadUri: uri => {
            window.__spotifyCalls.push(['loadUri', uri]);
            if (realistic) {
              state.uri = uri;
              state.positionMs = 0;
              state.paused = true;
              state.started = false;
              stopTimer();
            }
          },
          seek: position => window.__spotifyCalls.push(['seek', position]),
          play: () => {
            window.__spotifyCalls.push(['play']);
            if (realistic) {
              state.positionMs = 0;
              state.started = true;
              state.paused = false;
              fire();
              startTimer();
            }
          },
          resume: () => {
            window.__spotifyCalls.push(['resume']);
            if (realistic) {
              if (!state.started) state.positionMs = 0;
              state.started = true;
              state.paused = false;
              fire();
              startTimer();
            }
          },
          togglePlay: () => {
            window.__spotifyCalls.push(['togglePlay']);
            if (realistic) {
              if (state.paused) controller.resume();
              else controller.pause();
            }
          },
          pause: () => {
            window.__spotifyCalls.push(['pause']);
            if (realistic) {
              state.paused = true;
              stopTimer();
              fire();
            }
          },
          destroy: () => {
            window.__spotifyCalls.push(['destroy']);
            if (realistic) stopTimer();
          },
          addListener: (event, handler) => {
            window.__spotifyHandlers[event] = handler;
          },
        };
        if (defer) {
          window.__spotifyDeferredController = { callback, controller };
        } else {
          callback(controller);
        }
      },
    };
    localStorage.setItem('analyticsConsent', 'rejected');
    // Test-only: the site's CSS smooth scrolling animates Playwright's
    // scroll-into-view, which can leave a computed click point behind the
    // gliding page (seen as a WebKit CI flake). The product keeps smooth
    // scrolling; specs settle it instantly.
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'html { scroll-behavior: auto !important; }';
      document.head.appendChild(style);
    });
  }, { defer: deferControllerCallback, realistic, durationMs, tickMs });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: deferApiReady
        ? 'window.__spotifyDeferredApiReady = () => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);'
        : 'window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);',
    }),
  );
  await page.route('https://w.soundcloud.com/**', route => route.abort());
}

// Same paused-clock pattern as tests/soundcloud-deferred-playback.spec.js:
// install seeds from the Node clock and pauseAt lands 30s ahead so the
// browser-side clock cannot pass the target before it is paused.
async function installPausedClock(page) {
  const start = new Date();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 30_000));
}

const balconiesCard = page => page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]');
// Firing waits for the API script and controller callback to have run, so a
// test never fires into a page whose listener is not registered yet.
const fireSpotifyUpdate = async (page, data) => {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__spotifyHandlers.playback_update)))
    .toBe(true);
  await page.evaluate(update => window.__spotifyHandlers.playback_update({ data: update }), data);
};

test('keeps the soundbar position at zero until the player reports playback', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbar')).toBeVisible();
  // A pending request reads as cancellable, never as playing.
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect(page.locator('#soundbarPauseIcon')).toHaveClass(/fa-play/);
  await expect(page.locator('#soundStatusIcon')).toHaveClass(/fa-play/);
  await expect(page.locator('#waveContainer')).toHaveClass(/paused/);

  // No wall-clock timer may stand in for real playback: without any
  // playback_update event the position stays exactly where it started, and
  // with the total still unknown the bar is indeterminate (no range
  // attributes at all).
  await page.waitForTimeout(1200);
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuenow', /.+/);
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  // No guessed total: the duration stays unknown until the player reports it.
  await expect(page.locator('#soundbarDurationTime')).toBeHidden();
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuemax', /.+/);
});

test('drives the soundbar position and duration from playback_update events', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5000, duration: 413000 });

  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5000');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuemax', '413000');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuetext', '0:05 of 6:53');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:05');
  await expect(page.locator('#soundbarDurationTime')).toHaveText('6:53');

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 6500, duration: 413000 });
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '6500');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:06');
});

test('mirrors a real pause and resumes from the reported position', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5000, duration: 30000 });
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 5234, duration: 30000 });

  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5234');

  await page.locator('#soundbarPauseBtn').click();
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual(['resume']);
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5234, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
});

test('resuming from the track card keeps the known position and total', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5000, duration: 30000 });
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 5234, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  // Resuming from the card re-enters playSpotifyTrack: before any new player
  // report the bar keeps the last known position and total, not a blanked one.
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5234');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuemax', '30000');
});

test('treats a real pause at the end as finished and replays from the start', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 29500, duration: 30000 });
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 30000, duration: 30000 });

  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '30000');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuetext', '0:30 of 0:30');

  // Reselecting the finished track starts it over instead of resuming the end.
  await balconiesCard(page).click();
  // The fresh request has no player report yet: the bar must reset to the
  // indeterminate pending state, not carry the finished position or total.
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuenow', /.*/);
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuemax', /.*/);
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  await expect(page.locator('#soundbarDurationTime')).toBeHidden();
  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls.filter(call => call[0] === 'loadUri')).toHaveLength(2);
  expect(calls.filter(call => call[0] === 'seek')).toEqual([
    ['seek', 0],
    ['seek', 0],
  ]);
  expect(calls.filter(call => call[0] === 'play')).toHaveLength(2);
});

test('shows loading feedback with the piece name as soon as playback is requested', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  // Capture the request's first frame from inside the click event itself: a
  // page.evaluate after click() returns can land past the 0.3s reveal and
  // pass or fail on timing rather than on what the visitor actually saw.
  await page.evaluate(() => {
    document.addEventListener('click', () => {
      window.__pendingFirstFrame = {
        progress: getComputedStyle(document.getElementById('soundbarProgress')).visibility,
        times: getComputedStyle(document.getElementById('soundbarTimes')).visibility,
        loading: getComputedStyle(document.getElementById('soundbarLoading')).visibility,
      };
    }, { once: true });
  });
  await balconiesCard(page).click();
  // The same frame as the request: the rows have already yielded - nothing
  // shows and then disappears - and the loading message has not revealed yet.
  const firstFrame = await page.evaluate(() => window.__pendingFirstFrame);
  expect(firstFrame).toEqual({ progress: 'hidden', times: 'hidden', loading: 'hidden' });

  await expect(page.locator('#soundbar')).toBeVisible();
  // One-step reveal: the loading feedback is part of the pending
  // presentation, and the piece name stays visible underneath it.
  await expect(page.locator('#soundbarLoading')).toBeVisible();
  await expect(page.locator('#soundbarLoading')).toHaveText('Loading audio…');
  await expect(page.locator('#soundbarProgress')).toBeHidden();
  await expect(page.locator('#soundbarTimes')).toBeHidden();
  await expect(page.locator('#soundbarTitle')).toBeVisible();
  await expect(page.locator('#soundbarTitle')).toHaveText('Balconies');

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 0, duration: 30000 });
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  // The yielded rows come back once the wait is over.
  await expect(page.locator('#soundbarProgress')).toBeVisible();
  await expect(page.locator('#soundbarTimes')).toBeVisible();
  await expect(page.locator('#soundbarTitle')).toBeVisible();
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();
});

test('keeps the revealed loading message steady while the player finishes setting up', async ({ page }) => {
  await mockSpotify(page, { deferControllerCallback: true, deferApiReady: true });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  // The reveal runs on the real compositor clock: once the 0.3s grace has
  // passed, the message is visible.
  await expect(page.locator('#soundbarLoading')).toBeVisible();

  // The intercepted script defines the deferred API-ready handle when it
  // executes. The reveal is real-clock and is not proof the script ran, so
  // wait for the handle before invoking it.
  await page.waitForFunction(() => window.__spotifyDeferredApiReady);

  // Confirm the post-reveal state before dispatching: the progress and time
  // rows must already have yielded.
  await expect(page.locator('#soundbarProgress')).toBeHidden();
  await expect(page.locator('#soundbarTimes')).toBeHidden();

  // The API becoming ready must not hide the revealed message and restart its
  // delay. Read the computed style in the same JavaScript turn as the ready
  // dispatch so a restarted (still delayed) animation cannot slip past.
  let styles = await page.evaluate(() => {
    window.__spotifyDeferredApiReady();
    const loading = getComputedStyle(document.getElementById('soundbarLoading'));
    const progress = getComputedStyle(document.getElementById('soundbarProgress'));
    const times = getComputedStyle(document.getElementById('soundbarTimes'));
    return {
      loading: { visibility: loading.visibility, display: loading.display },
      rows: { progress: progress.visibility, times: times.visibility },
    };
  });
  expect(styles).toEqual({
    loading: { visibility: 'visible', display: 'flex' },
    rows: { progress: 'hidden', times: 'hidden' },
  });

  // The deferred controller handle exists once the ready API has fielded
  // the site's createController call; wait for it before invoking.
  await page.waitForFunction(() => window.__spotifyDeferredController);

  // The asynchronous controller callback must not restart it either.
  styles = await page.evaluate(() => {
    const deferred = window.__spotifyDeferredController;
    deferred.callback(deferred.controller);
    const loading = getComputedStyle(document.getElementById('soundbarLoading'));
    const progress = getComputedStyle(document.getElementById('soundbarProgress'));
    const times = getComputedStyle(document.getElementById('soundbarTimes'));
    return {
      loading: { visibility: loading.visibility, display: loading.display },
      rows: { progress: progress.visibility, times: times.visibility },
    };
  });
  expect(styles).toEqual({
    loading: { visibility: 'visible', display: 'flex' },
    rows: { progress: 'hidden', times: 'hidden' },
  });
});

test('surfaces the unavailable message when playback never starts', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbar')).toBeVisible();
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();

  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
  await expect(page.locator('#audioAvailabilityMessage')).toContainText(
    'Spotify could not start playback in the embedded player.',
  );
  await expect(page.locator('#audioAvailabilityMessage a')).toHaveText('Play on Spotify');
  await expect(page.locator('#audioAvailabilityMessage a')).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/2wNL47uCuwDpbOqCIpbSTS',
  );
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  // The failure is surfaced where the visitor is: fixed above the soundbar,
  // never a notice scrolled out of view in the catalogue flow.
  await expect(page.locator('#audioAvailabilityMessage')).toHaveCSS('position', 'fixed');
});

test('a Spotify API that becomes ready after the failure notice cannot start playback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => callback({
        loadUri: uri => window.__spotifyCalls.push(['loadUri', uri]),
        seek: position => window.__spotifyCalls.push(['seek', position]),
        play: () => window.__spotifyCalls.push(['play']),
        resume: () => window.__spotifyCalls.push(['resume']),
        togglePlay: () => window.__spotifyCalls.push(['togglePlay']),
        pause: () => window.__spotifyCalls.push(['pause']),
        addListener: () => {},
      }),
    };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  // The API script hangs past the watchdog timeout.
  await page.route('https://open.spotify.com/embed/iframe-api/v1', () => new Promise(() => {}));
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();

  // The API arrives late: the failed request must stay failed, not revive.
  await page.evaluate(() => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi));
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  expect(await page.evaluate(() => window.__spotifyCalls)).toEqual([]);
});

test('a retry after a stalled controller request is cancellable and watchdogged', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    // createController never invokes its callback: every request waits forever.
    window.__spotifyIFrameApi = { createController: () => {} };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__spotifyApiReadyCalled = true; window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);',
    }),
  );
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__spotifyApiReadyCalled))).toBe(true);
  // The first request times out waiting on a controller callback that never comes.
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();

  // Retry with the API ready but no controller: the new request must still
  // present as pending - cancellable immediately, showing the loading
  // feedback, and guarded by its own watchdog - not silent.
  await balconiesCard(page).click();
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await page.clock.runFor(600);
  await expect(page.locator('#soundbarLoading')).toBeVisible();
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
});

test('reselecting a track waiting on the controller callback cancels the request', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    // createController never invokes its callback: every request waits forever.
    window.__spotifyIFrameApi = { createController: () => {} };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.__spotifyApiReadyCalled = true; window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);',
    }),
  );
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__spotifyApiReadyCalled))).toBe(true);
  // The API-ready dispatch must not cancel the queued request: it stays pending.
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  // A direct reselection in the controller-callback window cancels the request:
  // no failure notice, no loading, and the request leaves the pending state.
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await page.clock.runFor(600);
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();
});

test('cancelling pending playback from the soundbar clears the loading state', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await page.clock.runFor(600);
  await expect(page.locator('#soundbarLoading')).toBeVisible();

  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  // A cancelled request must not trip the watchdog, and a late
  // playback_update for the cancelled request must be ignored.
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 30000 });
  await page.clock.runFor(16000);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuenow', /.+/);
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();
  // Cancellation destroys the controller outright: no pause, and the log
  // shows the teardown instead.
  expect(await page.evaluate(() => window.__spotifyCalls)).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['destroy'],
  ]);
});

test('cancelling pending playback before the Spotify API loads keeps it cancelled', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        callback({
          loadUri: uri => window.__spotifyCalls.push(['loadUri', uri]),
          seek: position => window.__spotifyCalls.push(['seek', position]),
          play: () => window.__spotifyCalls.push(['play']),
          resume: () => window.__spotifyCalls.push(['resume']),
          togglePlay: () => window.__spotifyCalls.push(['togglePlay']),
          pause: () => window.__spotifyCalls.push(['pause']),
          addListener: () => {},
        });
      },
    };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  // The API script arrives but never initialises until the test fires it.
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
  await page.route('https://w.soundcloud.com/**', route => route.abort());
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  // The API arriving late must not start the cancelled request.
  await page.evaluate(() => window.onSpotifyIframeApiReady(window.__spotifyIFrameApi));
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__spotifyCalls)).toEqual([]);
});

test('reselecting a pending track cancels the playback request', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await page.clock.runFor(600);
  await expect(page.locator('#soundbarLoading')).toBeVisible();

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeHidden();
});

test('resuming the same paused track continues from where it paused', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5000, duration: 30000 });
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5000, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5000');

  expect(await page.evaluate(() => window.__spotifyCalls)).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['pause'],
    ['resume'],
  ]);
});

test('stays pending while the player reports buffering, confirms on actual playback', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  // An unpaused but buffering report is not playback: the request stays
  // pending and cancellable, and the watchdog keeps running.
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: true, position: 0, duration: 413000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 0, duration: 413000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
});

test('ignores playback events that report a different track', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  // A late event from a previously loaded track must not confirm or move
  // the current track's bar.
  await fireSpotifyUpdate(page, { playingURI: 'spotify:track:3YV79qjiJLOgYjjEzTsVEy', isPaused: false, isBuffering: false, position: 9000, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');

  await fireSpotifyUpdate(page, { playingURI: 'spotify:track:2wNL47uCuwDpbOqCIpbSTS', isPaused: false, isBuffering: false, position: 1000, duration: 413000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:01');
});

test('a cancelled request destroys its controller and its late events cannot confirm the re-armed one', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyControllers = [];
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        const controller = {
          calls: [],
          destroyed: false,
          loadUri: uri => controller.calls.push(['loadUri', uri]),
          seek: position => controller.calls.push(['seek', position]),
          play: () => controller.calls.push(['play']),
          resume: () => controller.calls.push(['resume']),
          togglePlay: () => controller.calls.push(['togglePlay']),
          pause: () => controller.calls.push(['pause']),
          destroy: () => { controller.destroyed = true; },
          addListener: (event, handler) => { controller.handler = handler; },
        };
        window.__spotifyControllers.push(controller);
        callback(controller);
      },
    };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);',
    }),
  );
  await page.route('https://w.soundcloud.com/**', route => route.abort());
  await installPausedClock(page);
  await page.goto('/listen/');

  const card = page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]');
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__spotifyControllers.length)).toBe(1);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  // Cancel, then reselect the same track: the cancelled controller is
  // destroyed and the new request gets a fresh controller.
  await page.locator('#soundbarPauseBtn').click();
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__spotifyControllers.length)).toBe(2);
  const tornDown = await page.evaluate(() => window.__spotifyControllers[0].destroyed);
  expect(tornDown).toBe(true);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  // Even if an already-queued event from the cancelled controller still
  // runs, it cannot touch the new request's state.
  await page.evaluate(() => window.__spotifyControllers[0].handler?.({
    data: { playingURI: 'spotify:track:2wNL47uCuwDpbOqCIpbSTS', isPaused: false, isBuffering: false, position: 5000, duration: 413000 },
  }));
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');

  // The new controller's own report confirms the request normally.
  await page.evaluate(() => window.__spotifyControllers[1].handler?.({
    data: { playingURI: 'spotify:track:2wNL47uCuwDpbOqCIpbSTS', isPaused: false, isBuffering: false, position: 1000, duration: 413000 },
  }));
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
});

test('a stale controller callback cannot replace the live controller', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spotifyPending = [];
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        const controller = {
          calls: [],
          destroyed: false,
          loadUri: uri => controller.calls.push(['loadUri', uri]),
          seek: position => controller.calls.push(['seek', position]),
          play: () => controller.calls.push(['play']),
          resume: () => controller.calls.push(['resume']),
          togglePlay: () => controller.calls.push(['togglePlay']),
          pause: () => controller.calls.push(['pause']),
          destroy: () => { controller.destroyed = true; },
          addListener: (event, handler) => { controller.handler = handler; },
        };
        window.__spotifyPending.push({ controller, callback });
      },
    };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);',
    }),
  );
  await page.route('https://w.soundcloud.com/**', route => route.abort());
  await installPausedClock(page);
  await page.goto('/listen/');

  const card = page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]');
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__spotifyPending.length)).toBe(1);
  // Cancel, then reselect: a second controller creation starts while the
  // first callback is still held.
  await page.locator('#soundbarPauseBtn').click();
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__spotifyPending.length)).toBe(2);

  // The live callback lands first, the stale one late.
  await page.evaluate(() => {
    const live = window.__spotifyPending[1];
    live.callback(live.controller);
  });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await page.evaluate(() => {
    const stale = window.__spotifyPending[0];
    stale.callback(stale.controller);
  });

  // The stale controller is destroyed, never stored, never listened to.
  const state = await page.evaluate(() => ({
    staleDestroyed: window.__spotifyPending[0].controller.destroyed,
    staleCalls: window.__spotifyPending[0].controller.calls,
    staleHandler: Boolean(window.__spotifyPending[0].controller.handler),
    liveCalls: window.__spotifyPending[1].controller.calls,
  }));
  expect(state.staleDestroyed).toBe(true);
  expect(state.staleCalls).toEqual([]);
  expect(state.staleHandler).toBe(false);
  expect(state.liveCalls).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
  ]);
});

test('a failure after the watchdog tears down the controller and a late report cannot revive the bar', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__spotifyHandlers.playback_update)))
    .toBe(true);

  // The startup watchdog fires before the player reports anything: the
  // failure path must end the controller's stream, not only pause it.
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual(['destroy']);
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  // A late playback report from the torn-down controller cannot revive the bar.
  await page.evaluate(() =>
    window.__spotifyHandlers.playback_update({
      data: { playingURI: 'spotify:track:2wNL47uCuwDpbOqCIpbSTS', isPaused: false, isBuffering: false, position: 1000, duration: 30000 },
    }),
  );
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await expect(page.locator('#soundbarProgress')).not.toHaveAttribute('aria-valuenow', /.+/);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();

  // Resuming after the failure starts a fresh request through the usual path.
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect
    .poll(() => page.evaluate(() => window.__spotifyCalls.filter(call => call[0] === 'loadUri').length))
    .toBe(2);
});

test('cancelling a re-armed pending request resets the bar position to zero', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5234, duration: 30000 });
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 5234, duration: 30000 });
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5234');

  // Re-arm the paused track, then cancel before the player confirms: the
  // torn-down controller's position must not linger on the bar.
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
});

test('stopping playback ends the Spotify controller and its events', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');

  await page.locator('#soundbarStopBtn').click();
  await expect(page.locator('#soundbar')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__spotifyCalls)).toContainEqual(['destroy']);

  // An event from the stopped controller cannot restart anything.
  await page.evaluate(() =>
    window.__spotifyHandlers.playback_update({
      data: { playingURI: 'spotify:track:2wNL47uCuwDpbOqCIpbSTS', isPaused: false, isBuffering: false, position: 2000, duration: 30000 },
    }),
  );
  await expect(page.locator('#soundbar')).toBeHidden();
});

test('a failed resume after the watchdog resets the bar position to zero', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 5234, duration: 30000 });
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 5234, duration: 30000 });
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5234');

  // Resume, then let the watchdog fire before the player confirms: the
  // destroyed controller's position must not linger on the bar.
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
});


test('returning to a track that another selection displaced starts it from the beginning', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  const everythingPassesCard = page.locator('#worksContainer [data-spotify-track="3YV79qjiJLOgYjjEzTsVEy"]');
  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 12000, duration: 30000 });

  await everythingPassesCard.click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 8000, duration: 30000 });

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarTitle')).toHaveText('Balconies');
  await expect(page.locator('#soundbarPerformer')).toHaveText('Olivia de Prato');

  // A fresh request: reload and seek to zero, never a mid-track resume.
  expect(await page.evaluate(() => window.__spotifyCalls)).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['loadUri', 'spotify:track:3YV79qjiJLOgYjjEzTsVEy'],
    ['seek', 0],
    ['play'],
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
  ]);
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 0, duration: 30000 });
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '0');
});

test('surfaces the unavailable message when the Spotify API fails to load', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route => route.abort());
  await page.route('https://w.soundcloud.com/**', route => route.abort());
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();
  await expect(page.locator('#audioAvailabilityMessage')).toContainText(
    'Spotify could not start playback in the embedded player.',
  );
  await expect(page.locator('#audioAvailabilityMessage a')).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/2wNL47uCuwDpbOqCIpbSTS',
  );
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
});

// Custom mock: the first controller confirms; the second (post-cancel)
// never calls back, simulating a stalled embed for the new selection.
async function mockSpotifyStallOnSecond(page) {
  await page.addInitScript(() => {
    window.__spotifyCalls = [];
    window.__spotifyHandlers = {};
    let created = 0;
    window.__spotifyIFrameApi = {
      createController: (_container, _options, callback) => {
        created += 1;
        const controller = {
          loadUri: uri => window.__spotifyCalls.push(['loadUri', uri]),
          seek: position => window.__spotifyCalls.push(['seek', position]),
          play: () => window.__spotifyCalls.push(['play']),
          resume: () => window.__spotifyCalls.push(['resume']),
          togglePlay: () => window.__spotifyCalls.push(['togglePlay']),
          pause: () => window.__spotifyCalls.push(['pause']),
          destroy: () => window.__spotifyCalls.push(['destroy']),
          addListener: (event, handler) => { window.__spotifyHandlers[event] = handler; },
        };
        if (created === 1) callback(controller);
      },
    };
    localStorage.setItem('analyticsConsent', 'rejected');
  });
  await page.route('https://open.spotify.com/embed/iframe-api/v1', route =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.onSpotifyIframeApiReady(window.__spotifyIFrameApi);' }));
  await page.route('https://w.soundcloud.com/**', route => route.abort());
}

test('failure notice after a cancelled request names the new track, not the cancelled one', async ({ page }) => {
  await mockSpotifyStallOnSecond(page);
  await installPausedClock(page);
  await page.goto('/listen/');
  const balconies = page.locator('#worksContainer [data-spotify-track="2wNL47uCuwDpbOqCIpbSTS"]');
  const everythingPasses = page.locator('#worksContainer [data-spotify-track="3YV79qjiJLOgYjjEzTsVEy"]');

  // A confirms.
  await balconies.click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__spotifyHandlers.playback_update))).toBe(true);
  await page.evaluate(() => window.__spotifyHandlers.playback_update({ data: { isPaused: false, isBuffering: false, position: 0, duration: 30000 } }));
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');

  // Pause, resume (pending again), then cancel by reselecting A.
  await page.locator('#soundbarPauseBtn').click();
  await page.evaluate(() => window.__spotifyHandlers.playback_update({ data: { isPaused: true, isBuffering: false, position: 5000, duration: 30000 } }));
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await balconies.click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  expect(await page.evaluate(() => window.__spotifyCalls.filter(c => c[0] === 'destroy').length)).toBe(1);

  // Select B; its controller callback stalls. The watchdog fires.
  await everythingPasses.click();
  await expect(page.locator('#soundbarTitle')).toHaveText('Everything Passes, Everything is Connected');
  await page.clock.runFor(16000);
  await expect(page.locator('#audioAvailabilityMessage')).toBeVisible();

  // The failure link and state must name B, the stalled request - not A.
  await expect(page.locator('#audioAvailabilityMessage a')).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/3YV79qjiJLOgYjjEzTsVEy',
  );
});

test('a visitor pause keeps the position the player reports with its paused update', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 30000 });
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '1000');

  // The visitor pauses: the bar switches to paused immediately. The
  // player's own paused update arrives after that and carries the true
  // stop position; the bar must keep it rather than the last sample.
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 5000, duration: 30000 });
  await expect(page.locator('#soundbarProgress')).toHaveAttribute('aria-valuenow', '5000');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:05');
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
});

test('glides the progress fill between the player\'s one-per-second reports', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');

  const widthPercent = () => page.locator('#soundbarProgressFill').evaluate(el => parseFloat(el.style.width));

  // The first real report lands the fill exactly on the player's position.
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 20000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:01');
  await expect.poll(widthPercent).toBeCloseTo(5, 1);

  // Half a second passes with no new report: the fill glides ahead on the
  // wall clock instead of holding at the last one-second step. The glide
  // renders on animation frames (~16ms apart), so the last rendered frame
  // may lag the fake clock's edge by up to one frame - 0.08 width-% of a
  // 20s track - but the fill must never run ahead of the wall clock.
  await page.clock.runFor(500);
  const oneFramePercent = (16 / 20000) * 100;
  await expect.poll(widthPercent).toBeGreaterThan(7.5 - oneFramePercent - 0.02);
  expect(await widthPercent()).toBeLessThanOrEqual(7.5 + 1e-6);

  // The next real report re-anchors the fill exactly on the player's truth.
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 2000, duration: 20000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:02');
  await expect.poll(widthPercent).toBeCloseTo(10, 1);

  // Pause snaps the fill to the reported position and stops the glide: the
  // bar never runs ahead of where playback actually stopped.
  await fireSpotifyUpdate(page, { isPaused: true, isBuffering: false, position: 2600, duration: 20000 });
  await page.clock.runFor(500);
  await expect.poll(widthPercent).toBeCloseTo(13, 1);
});

test('stops gliding when reduced motion is turned on mid-playback', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.goto('/listen/');

  await balconiesCard(page).click();
  const widthPercent = () => page.locator('#soundbarProgressFill').evaluate(el => parseFloat(el.style.width));

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 20000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:01');
  await page.clock.runFor(500);
  await expect.poll(widthPercent).toBeGreaterThan(5.5);

  // The preference flips mid-playback: the next frame stops the glide and
  // snaps back to the player's last report, and the fill stays there.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.runFor(500);
  expect(await widthPercent()).toBeCloseTo(5, 1);
  await page.clock.runFor(500);
  expect(await widthPercent()).toBeCloseTo(5, 1);
});

test('holds the fill at the player\'s reports when reduced motion is preferred', async ({ page }) => {
  await mockSpotify(page);
  await installPausedClock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  const widthPercent = () => page.locator('#soundbarProgressFill').evaluate(el => parseFloat(el.style.width));

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 20000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:01');
  expect(await widthPercent()).toBeCloseTo(5, 1);

  // Half a second passes: no glide under reduced motion - the fill moves only
  // when the player reports.
  await page.clock.runFor(500);
  expect(await widthPercent()).toBeCloseTo(5, 1);

  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 2000, duration: 20000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:02');
  expect(await widthPercent()).toBeCloseTo(10, 1);
});

test('a SoundCloud pause report arriving after a Spotify selection cannot move the Spotify bar', async ({ page }) => {
  await mockSpotify(page);
  await page.addInitScript(() => {
    window.__soundCloudCalls = [];
    const Widget = element => {
      const handlers = {};
      const player = {
        bind: (event, handler) => { handlers[event] = handler; },
        getDuration: callback => callback(60_000),
        // Holds the position answer back so a test can deliver it late.
        getPosition: callback => { window.__soundCloudDeferredPosition = callback; },
        pause: () => {
          window.__soundCloudCalls.push(['pause', element.id]);
          handlers.PAUSE?.();
        },
        play: () => {
          window.__soundCloudCalls.push(['play', element.id]);
        },
        seekTo: position => window.__soundCloudCalls.push(['seekTo', element.id, position]),
      };
      window.__soundCloudPlayers ??= {};
      window.__soundCloudPlayers[element.id] = { handlers, player };
      return player;
    };
    Widget.Events = { READY: 'READY', PLAY: 'PLAY', PAUSE: 'PAUSE', FINISH: 'FINISH', ERROR: 'ERROR' };
    window.SC = { Widget };
  });
  await page.route('https://w.soundcloud.com/player/api.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  );
  await page.route('https://w.soundcloud.com/player/?**', route =>
    route.fulfill({ contentType: 'text/html', body: '' }),
  );
  await page.goto('/listen/');

  // Play a SoundCloud recording, then pause it: the pause re-anchor asks the
  // widget for its position, and this mock holds that answer back.
  await page.locator('#worksContainer [data-track="look-up"]').click();
  await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.READY?.());
  await expect.poll(() => page.evaluate(() => window.__soundCloudCalls)).toContainEqual([
    'play',
    'soundcloudPlayerLookUp',
  ]);
  await page.evaluate(() => window.__soundCloudPlayers.soundcloudPlayerLookUp.handlers.PLAY?.());
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  // Select a Spotify track before the SoundCloud position answer returns.
  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Cancel playback request');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');

  // The late answer belongs to the displaced SoundCloud pause: the Spotify
  // bar must stay at zero.
  await page.evaluate(() => window.__soundCloudDeferredPosition(9000));
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
});

test('never flashes the progress rows while a Spotify request is pending', async ({ page }) => {
  await mockSpotify(page);
  await page.goto('/listen/');

  // Capture the request's first frame from inside the click event itself: a
  // page.evaluate after click() returns can land past the 0.3s reveal and
  // pass or fail on timing rather than on what the visitor actually saw.
  await page.evaluate(() => {
    document.addEventListener('click', () => {
      window.__pendingFirstFrame = {
        progress: getComputedStyle(document.getElementById('soundbarProgress')).visibility,
        times: getComputedStyle(document.getElementById('soundbarTimes')).visibility,
        loading: getComputedStyle(document.getElementById('soundbarLoading')).visibility,
      };
    }, { once: true });
  });
  await balconiesCard(page).click();
  // The same frame as the request: the rows have already yielded - nothing
  // shows and then disappears - and the loading message has not revealed yet.
  const duringPending = await page.evaluate(() => window.__pendingFirstFrame);
  expect(duringPending).toEqual({ progress: 'hidden', times: 'hidden', loading: 'hidden' });

  // After the 0.3s grace window the message takes over the (already empty)
  // rows area: no bar appeared first.
  await expect(page.locator('#soundbarLoading')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('soundbarProgress')).visibility)).toBe('hidden');

  // Confirmation restores the rows with the reported position.
  await fireSpotifyUpdate(page, { isPaused: false, isBuffering: false, position: 1000, duration: 21000 });
  await expect(page.locator('#soundbarLoading')).toBeHidden();
  await expect(page.locator('#soundbarProgress')).toBeVisible();
  await expect(page.locator('#soundbarTimes')).toBeVisible();
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:01');
});

// Realistic-mode tests: the mock mirrors the real Spotify embed - play()
// restarts the loaded track from zero, resume() continues from the paused
// position, and seek() takes seconds. These tests fail if a resume path ever
// goes back to play().

const elapsedSeconds = async page =>
  page.locator('#soundbarElapsedTime').innerText().then(text => {
    const [minutes, seconds] = text.split(':').map(Number);
    return minutes * 60 + seconds;
  });

const waitForElapsed = async (page, atLeast) => {
  await expect.poll(() => elapsedSeconds(page), { timeout: 15000 }).toBeGreaterThanOrEqual(atLeast);
};

test('resuming from the soundbar continues from the paused position (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await waitForElapsed(page, 2);

  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  const pausedAt = await elapsedSeconds(page);
  const pausedNow = Number(await page.locator('#soundbarProgress').getAttribute('aria-valuenow'));

  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');

  // Continues from the paused position: a play() restart would read 0:00 here.
  const resumedNow = Number(await page.locator('#soundbarProgress').getAttribute('aria-valuenow'));
  expect(resumedNow).toBeGreaterThanOrEqual(pausedNow);
  expect(await elapsedSeconds(page)).toBeGreaterThanOrEqual(pausedAt);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls.filter(call => call[0] === 'play')).toHaveLength(1);
  expect(calls.filter(call => call[0] === 'resume')).toHaveLength(1);
});

test('resuming from the track card continues from the paused position (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await waitForElapsed(page, 2);

  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
  const pausedNow = Number(await page.locator('#soundbarProgress').getAttribute('aria-valuenow'));

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  const resumedNow = Number(await page.locator('#soundbarProgress').getAttribute('aria-valuenow'));
  expect(resumedNow).toBeGreaterThanOrEqual(pausedNow);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls.filter(call => call[0] === 'play')).toHaveLength(1);
  expect(calls.filter(call => call[0] === 'resume')).toHaveLength(1);
});

test('repeated pauses keep resuming where they stopped (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  await waitForElapsed(page, 2);

  const stops = [];
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.locator('#soundbarPauseBtn').click();
    await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');
    stops.push(await elapsedSeconds(page));
    await page.locator('#soundbarPauseBtn').click();
    await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
    // Each resume continues from its own pause point, never from zero.
    expect(await elapsedSeconds(page)).toBeGreaterThanOrEqual(stops[cycle]);
    // Let the next pause land on a later displayed second.
    await waitForElapsed(page, stops[cycle] + 1);
  }
  expect(stops[1]).toBeGreaterThan(stops[0]);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls.filter(call => call[0] === 'play')).toHaveLength(1);
  expect(calls.filter(call => call[0] === 'resume')).toHaveLength(2);
});

test('selecting a different track after a pause still starts from zero (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true });
  await page.goto('/listen/');

  const everythingPassesCard = page.locator('#worksContainer [data-spotify-track="3YV79qjiJLOgYjjEzTsVEy"]');
  await balconiesCard(page).click();
  await waitForElapsed(page, 2);
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback');

  await everythingPassesCard.click();
  await expect(page.locator('#soundbarTitle')).toHaveText('Everything Passes, Everything is Connected');
  // A fresh track is a fresh request: reload, seek to zero, play from zero.
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  await waitForElapsed(page, 1);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['pause'],
    ['loadUri', 'spotify:track:3YV79qjiJLOgYjjEzTsVEy'],
    ['seek', 0],
    ['play'],
  ]);
});

test('replaying a finished track starts from zero (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true, durationMs: 4000 });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  // The short mock track ends on its own: the player pauses at the end.
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback', { timeout: 15000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:04');

  await balconiesCard(page).click();
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  await waitForElapsed(page, 1);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
  ]);
});


test('replaying a finished track from the soundbar starts from zero (real embed semantics)', async ({ page }) => {
  await mockSpotify(page, { realistic: true, durationMs: 4000 });
  await page.goto('/listen/');

  await balconiesCard(page).click();
  // The short mock track ends on its own: the player pauses at the end.
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Resume playback', { timeout: 15000 });
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:04');

  // The soundbar toggle on a finished track replays it from the beginning.
  await page.locator('#soundbarPauseBtn').click();
  await expect(page.locator('#soundbarPauseBtn')).toHaveAttribute('aria-label', 'Pause playback');
  await expect(page.locator('#soundbarElapsedTime')).toHaveText('0:00');
  await waitForElapsed(page, 1);

  const calls = await page.evaluate(() => window.__spotifyCalls);
  expect(calls).toEqual([
    ['loadUri', 'spotify:track:2wNL47uCuwDpbOqCIpbSTS'],
    ['seek', 0],
    ['play'],
    ['play'],
  ]);
});
