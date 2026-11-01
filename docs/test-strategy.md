# Test Strategy

Use Playwright smoke tests to protect visitor-facing behaviour without coupling tests to layout implementation.

## Run

```bash
npm test
```

`npm test` runs Chromium. Use `npm run test:all` for the complete browser and tagged-mobile matrix. Playwright runs `npm run build:test -- --test-font-fixtures` and serves `_site/` on port 8010, without reusing existing servers. Use `--config=playwright.built.config.js` to check already-built production output without replacing it with fallbacks.

`npm run test:unit` runs the Node unit tests in `unit-tests/`. They are kept outside `tests/` so Playwright does not pick them up.

## Covered

- Sanity Biography renderer (`unit-tests/biography.test.mjs`): output keeps the committed fallback's structure and mark classes, CMS content is HTML-escaped, hotspots become `object-position`, missing fields are reported and only the marked region is replaced.
- Sanity catalogue (`unit-tests/catalogue.test.mjs`): complete fallback, provider URL allowlist/canonicalisation, references, either default provider, empty published lists, unsafe input rejection, script-safe JSON, shared composition structured data and atomic fallback. The import uses generated IDs and returned references, skips existing editor content and refuses draft-only imported records before writing.
- Generated catalogue browser fixtures (`tests/catalogue-build.spec.js`): renamed Work relationships, media-action ordering, new SoundCloud/Spotify playback configuration, default selection, unrelated media, empty lists and safe rendering/modal actions in both themes. Fixtures use the production renderer and mocked providers, not live Sanity or provider playback.
- Page load, core assets, search metadata, crawl-discovery files and navigation.
- Performances (`unit-tests/performances.test.mjs`, `tests/performances.spec.js`): date ordering, month ranges, London midnight, complete section omission when no upcoming events remain, safe copy, event links, published snapshot validation/empty-list handling, non-overwriting initial import, responsive light/dark reflow and build-time date rollover. Explicit fallback builds use a fixed event-date fixture; production uses the current London date.
- Static page build (`unit-tests/pages.test.mjs`): distinct primary content/headings, route metadata, initial catalogue HTML, shared snapshot/structured data, full essay directly on Writing, the Privacy page's notice sections and per-page footer link, glued trailing link arrows, sitemap, empty content, fallback generation and rejection of private/stale artifact files.
- Multi-page browser checks (`tests/multi-page.spec.js`): every canonical page loads/reloads directly and works without JavaScript; enhanced navigation updates metadata, focus and history without replacing the document; instant page-top resets and Back-button scroll restoration; new-tab links, failed-enhancement fallback, 404s and explicit consented page views. Same-document history checks wait for the expected URL and content rather than a full page-load event.
- Privacy and consent revisit (`tests/privacy.spec.js`): the footer Privacy link reaches Cookie settings through enhanced navigation; the panel reopens the choice and notice in both themes with focus restored; withdrawing consent disables analytics and removes host-only, hostname-domain and parent-domain GA cookies without deleting unrelated cookies, using locally served content under the production hostname; without JavaScript the panel explains that analytics stays off.
- Responsive layout (`tests/responsive-layout.spec.js`): all seven navigation destinations plus the Privacy page and footer at 390, 768, 820, 1024 and 1280px in light/dark mode with 100% and 200% root text size. Checks document width, individual element bounds, open-drawer bounds, keyboard activation of every navigation link, drawer dismissal and visible header utilities. Works and Listen action buttons retain their shared desktop width even beside long copy. Root text scaling exercises reflow; it is not OS text scaling or browser zoom emulation.
- Wrapped phone header (`tests/wrapped-phone-header.spec.js`): 320/390px in both themes, 200% text applied before and after opening, drawer below every header utility, real pointer close/reopen/theme access, last follow-link reachability and outside-dismiss focus restoration.
- Navigation breakpoint (`tests/nav-breakpoint.spec.js`): keyboard activation just below and above the 1024px desktop boundary, with the rendered navigation mode matched against the measured CSS width. Resize cases cover compact → desktop (900 → 1280px) and desktop → compact (1280 → 900px), asserting focus moves to the matching desktop link or compact menu toggle. The tests use keyboard input from recovered focus, without programmatically refocusing the destination, to complete navigation. Additional cases cover recovery from the menu toggle and drawer follow links, and preserve focus on the incoming page heading after drawer navigation.
- Real page routes, browser history, the Works/Listen/Watch catalogue views and search. Old root-fragment routes have no compatibility redirects; the retired `/works/#listen` and `/works/#watch` views redirect to the new pages.
- Custom error page (`tests/not-found.spec.js`): nested missing paths keep their URLs and return branded GET/HEAD 404 responses through `scripts/serve.py`; root-relative recovery and mobile navigation work without JavaScript; the real theme toggle persists the choice; enhanced recovery removes error-only metadata and restores the standard layout; Back returns to the error page. Live playback-provider requests are stubbed or aborted so recovery checks catch site errors rather than third-party embed failures. Light/dark desktop and narrow-phone checks cover visible recovery links, a footer at the document bottom without trailing blank space or overlap, overflow and Axe accessibility. Build tests cover the error page's metadata, sitemap exclusion and public-artifact allowlist.
- Persisted theme switching and mobile preview state (including Netlify preview hosts, iframe nesting prevention and production-host gating), the Instrumentation menu's selected state in both themes, and mobile-navigation menus. Theme-dependent interactive states are exercised in both light and dark modes.
- Works and YouTube modal semantics, focus restoration, score-request flow and contact-form success/failure states. Enhanced page navigation leaves an inactive video iframe untouched; closing an active video disposes of the player without adding iframe history entries.
- Contact-form readiness (`tests/contact-form-timing.spec.js`): a local server streams `/contact/` up to the form and holds the scripts back, then checks that an early submission is held and sent exactly once after load, keeps typed values when rejected, and shows the existing error (with no request and no navigation) if the scripts never load. Formspree is always mocked.
- Keyboard-operable audio rows, catalogue view state, result announcements and Instrumentation-menu keyboard navigation.
- Mocked Spotify and SoundCloud playback state, including provider hand-off and controller/playback preservation through repeated page changes.
- Spotify playback state (`tests/spotify-playback-confirmation.spec.js`): the soundbar follows the player's own playback_update events - position, duration and pause state come only from reported values; a request stays pending (loading feedback, cancellable) until the first event; a request that never starts surfaces the unavailable message with a 'Play on Spotify' link after 15 seconds, and a failed player script surfaces it immediately; stale events after a cancellation or stop are ignored; a real pause at the end marks the track finished so replaying starts over.
- Deferred SoundCloud initialisation (`tests/soundcloud-deferred-playback.spec.js`): no SoundCloud requests before the first playback request; the soundbar appears at intent; the "Loading audio…" message (steady text beside a small spinner, static when reduced motion is enabled) appears only when playback takes a moment: the progress/time rows yield as soon as the request starts and it fades in after a 0.3s grace delay, so a request that confirms within 0.3s never shows it, and the soundbar keeps the piece name visible above it; the message clears on playback start, cancellation or a new selection; a request that never starts surfaces the unavailable message after 15 seconds and pauses the player; a failed player script surfaces it immediately unless the visitor already cancelled that request. Pending-playback timing uses Playwright's mocked clock, not fixed waits. The loading message takes over the soundbar's progress/time rows while the piece name stays visible, so the bar never changes size, and while a request is pending the soundbar control reads 'Cancel playback request' until the player confirms playback.
- Public accessibility on the deployed hostname mapped to the local server.
- Serious and critical Axe violations across interactive states.

## Principles

- Select by accessible role, visible name or stable ID.
- Assert visitor outcomes rather than CSS classes, spacing or exact copy.
- Mock third-party providers. Verify live media manually on the deployed site.
- Add regression coverage when a defect is fixed.

## Pull Requests

`.github/workflows/pr-checks.yml` runs on every pull request targeting `main`, including documentation-only changes:

- `Unit tests`: all Node unit tests.
- `Browser tests (chromium)`, `Browser tests (firefox)`, `Browser tests (webkit)` and `Browser tests (mobile-chromium)`: the complete configured Playwright matrix, with a fresh stylesheet build in each job.
- `Studio build`: a clean install from `studio/package-lock.json` and a local Studio bundle build with `npm run build -- --no-auto-updates`. This checks the locked dependencies rather than the hosted auto-update module and needs no CMS credentials.

Browser projects run independently so one failure does not cancel the remaining projects. Failed jobs upload `test-results/` for diagnosis. CI rejects focused tests (`test.only`) and starts its own HTTP server. Provider integrations remain mocked; checks need no CMS credentials and never deploy.

The GitHub branch protection rule for `main` requires pull requests, the unit and four browser checks above and branches to be up to date. It applies to administrators without bypass. `Studio build` runs on every PR but is not required by branch protection unless the repository owner adds it in settings. The workflow alone does not block merging; keep the required check names aligned with these job names when changing the workflow.

`.github/workflows/osv-scanner.yml` adds an OSV-Scanner dependency scan. On pull requests it compares the branch with `main` and fails only on newly introduced vulnerabilities. On pushes to `main`, manual runs and weekly it scans every lockfile, including `studio/`, reports all findings to Security > Code scanning and fails while any remain. It is not one of the required branch-protection checks above unless the repository owner adds it in settings.

## Deployment

The Pages workflow runs unit/browser tests on deterministic generated pages and the multi-page smoke suite on the final Sanity-backed artifact before upload. The exact public-file allowlist is enforced by `scripts/lib/public-output.mjs`; source templates, docs and test files are never published. Verify the GitHub Actions deployment after each requested push; live-site propagation should be checked separately.

### Font Awesome isolation and live dependency gate

Browser checks use `npm run build:test -- --test-font-fixtures`: the explicit flag is valid only with `--fallback`. It copies the exact pinned Font Awesome 6.4.0 CSS and all referenced font formats from `tests/fixtures/` into a test-only output directory. Hashes are checked at build time. The HTML rewrite changes only the Font Awesome stylesheet URL; production source and normal build output keep the CDN URL. The production artifact allowlist rejects test fixture directories, including stale output left by a test build. Use a clean output directory before switching build modes.

For PR CI only (`GITHUB_EVENT_NAME=pull_request`), Playwright global setup runs `scripts/check-font-assets.mjs` in each required browser job. It downloads each live CDN asset with a 30-second limit and checks the same SHA-256 manifest, so deterministic browser tests do not hide an unavailable or changed production dependency. Ordinary local/offline unit tests and deployment jobs gain no live asset gate; the already-built production config explicitly disables it. Google Fonts and media providers are not replaced by this fixture. Browser assertions, timeouts and retries are unchanged. Failed browser traces are retained in the existing seven-day failure artifact for diagnosis.

Recent past performances (`tests/recent-past-performances.spec.js`) checks two cards visible before interaction, one desktop row/mobile stacking, older history hidden then revealed, Show more/Show less names, keyboard collapse, both themes/enlarged text and native no-JavaScript access. Empty or short history has no redundant disclosure.

Display heading reflow (`tests/display-heading-reflow.spec.js`) checks Featured and the Works, Listen, Watch, Writing, Contact and Privacy page headings at 320/390px, the 768px boundary, 780px tablet and desktop, both themes, normal and 200% text. Individual word ranges expose mid-word splits even without overflow. Assertions verify the actual theme, preserve uppercase Cinzel, check actual font-size doubling and leave tablet/desktop sizing unchanged. This does not cover inner card titles.

The display-heading test derives the expected style from the actual phone media query at the 768px boundary: WebKit excludes its desktop scrollbar from that viewport. Separate 780px cases assert the tablet treatment, while phone cases still assert the phone treatment. No browser-specific stylesheet exception is used.

Performance heading reflow (`tests/performance-heading-reflow.spec.js`) checks 320/390px phones and desktop in both themes at normal and 200% root text size. It measures individual word ranges, so word-internal splits fail even without page overflow; it also checks the actual rem-based size increase, default recent cards, expanded grouped-history titles and page/card containment.
