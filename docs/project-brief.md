# Project Brief

This repository builds and hosts the website of composer Samantha Fernando: a static GitHub Pages site at https://www.samanthafernando.com/, with generated pages, shared navigation and playback, and content managed in Sanity and rendered into static HTML at build time.

## Decisions

Record only decisions that constrain future work. Implementation history and completed tasks do not belong here.

### Architecture

- Generate real static HTML pages for Home, Biography, Works & Media, Listen, Watch, Writing, Contact and Privacy. Keep shared shell and page sources in `index.html` and generate route-specific output with `scripts/lib/pages.mjs`; do not maintain separate editable copies of the shared UI.
- Use ordinary navigation links, progressively enhanced to preserve the shared audio shell while replacing primary content and page metadata. Direct loads and failed enhancements use normal document navigation. Push browser-history entries for deliberate page and catalogue-view changes; restore matching content and scroll on `popstate`.
- Use stable lowercase trailing-slash page paths. Do not map retired root hash routes; legacy bookmark support is deliberately out of scope.
- Keep local design experiments in Git-ignored `design/`; do not publish them.
- Generate the compact “An unexpected pause” custom `404.html` from the shared shell, using a whole-rest illustration and immediate Home/recordings links. Keep its content near the header, with the footer at the viewport bottom on short pages through normal flex flow (not fixed positioning); spare height sits between the recovery content and footer, not beneath the footer. Serve missing paths with HTTP 404, never a successful homepage fallback; exclude the error page from indexing and the sitemap.
- Give each substantive page a self-referencing canonical URL, unique search/social metadata and initial HTML content. Generate the sitemap from the route registry, excluding preview modes. Keep composition structured data on Works and Article data on the full essay; recordings and films retain authoritative provider links rather than duplicated third-party structured metadata.
- Keep the enquiry form as the sole public contact route. Do not expose Samantha's email address in rendered content, links or structured data; use Formspree's hidden `_gotcha` honeypot to filter basic automated submissions.
- The enquiry form must be safe to submit while the page is still loading. A gate script at the start of `<body>` owns the form's `onsubmit`; before `assets/site.js` has loaded it holds the submission (button disabled, typed values kept, no duplicate sends) and replays it once the real handler exists. If the handler has not appeared after 15 seconds it shows the existing error message instead of posting off-site. Without JavaScript the form still posts to Formspree natively.

### Content Management

- Manage site content in Sanity (project `9a66iw1t`, public `production` dataset) and render it into static HTML at build time. Do not fetch Sanity content in the browser; the site must render without JavaScript calls to a CMS.
- Keep the Studio standalone in `studio/` with its own `package.json`. It is never part of the published artifact. It is hosted by Sanity; see `docs/sanity.md` for URLs and administration.
- Keep a complete committed fallback between the `sanity:<section>:start` and `:end` markers in `index.html`. If Sanity is unreachable or the document is incomplete, the build warns and ships the fallback rather than failing the deploy. Playwright tests run against this committed markup.
- Self-host CMS images: the build downloads them into `assets/` with a content-hash filename. Do not hotlink `cdn.sanity.io`.
- Singleton pages use a fixed document ID equal to the type name and are hidden from generic Studio lists, with duplicate, delete and unpublish disabled.
- Publishing in Sanity triggers a deploy through a webhook that sends `repository_dispatch` (`sanity-content-published`). The GitHub token lives only in the Sanity webhook settings, never in the repository.
- Model Works, Recordings and Films as separate documents connected by Work references, not matching titles. Related Works are optional for media-only entries. Keep composition year separate from media recording/publication year and composition duration separate from track duration.
- Keep catalogue introductory text, availability copy and the default header Recording in the `worksMediaSettings` singleton. With no published default selected, the header Listen control opens the Listen catalogue. Stop resets playback to the selected default.
- Render the catalogue, provider playback configuration and composition structured data from one validated published snapshot. Use an independent complete catalogue fallback on fetch or validation failure; intentionally empty published lists are not errors. Resolve references against published documents so unpublished Works are not resurrected by stale links.
- Let editors order media actions within each Work using non-negative order numbers shared across recordings and films. Keep all three catalogue views newest first, then alphabetical.
- Keep source import keys separate from Sanity-generated document IDs. Catalogue imports create missing records but never overwrite existing published records or drafts.

### Content And Navigation

- Keep Biography at `/biography/`. The root route remains the quote-led homepage with Spotlight Works.
- Use one Works & Media catalogue rendered from one shared template. Works opens All Works at `/works/`, Listen opens recordings at `/listen/` and Watch opens films at `/watch/`; each is a standalone indexable page with its own title, description, social preview and preselected catalogue view. The retired `/works/#listen` and `/works/#watch` fragments redirect to `/listen/` and `/watch/`.
- Show the full Wintering essay, portrait and related video directly at `/writing/`, preserving the original reading experience without an extra click. Do not generate a separate essay page while there is only one essay. Defer composition-detail pages until sufficient work-specific content is agreed.
- Manage Performance documents in Sanity, with optional public event links. Read only published records at build time; keep `content/performances.json` as an independent committed fallback for invalid or unavailable CMS content, never as the editing source. An intentionally empty published list stays empty. Show a homepage Performances section only while there are upcoming events, ordered soonest first; keep past performances newest first in a collapsed disclosure. If none are upcoming, omit the entire section but preserve the historical records. Build-time date classification is refreshed by the daily site rebuild. Month ranges remain upcoming through their final month without displaying invented precise performance dates.
- Use a consistent Works card order: year, category, duration, title, instrumentation, commission, premiere and optional notes.
- Glue a trailing external-link arrow to the final word of its label (non-breaking space) so the arrow never wraps onto its own line, at any width or text size.
- Use a category pill only for the controlled work category. Keep venues, ensembles, awards and recording details in the appropriate metadata field.
- Do not use horizontal separators beneath primary page-intro copy; title, description and section spacing provide the transition. Retain dividers only where they structure content within a component.

### Media And Interaction

- Keep the light theme as the default and persist an explicit visitor theme selection locally. Every new or changed visual surface, including transient menus, hover, focus, selected and disabled states, must define dark defaults and light-mode overrides.
- Render compact Works and Listen cards. Render Watch as thumbnail-led YouTube cards that open the in-page modal.
- Show only the year in Watch metadata. Do not repeat the implied `Film` label.
- Use `Preview` for Spotify and `Listen` for SoundCloud actions. Show a related-work category and duration when known.
- Keep audio playback and the soundbar active during in-page navigation. SoundCloud players initialise on playback intent and queue the request until each player is ready.
- Use the custom playback rows rather than provider-native embeds. Native embeds add uncontrollable UI and inconsistent mobile sizing.
- Use a shared media-action width on desktop; stack multiple actions there and use equal-width paired actions on mobile, wrapping when more than two actions are present. Left-align single mobile media actions.
- Use a neutral treatment for availability and missing-metadata notices unless an actual error occurred.
- Use role-based colour tokens and a shared visible focus treatment for interactive controls. Preserve the current amber focus colour in dark mode and the darker amber focus colour in light mode.

### Responsive And Performance

- Use the real page in a `430px` iframe for desktop mobile preview. Do not create preview-only responsive CSS.
- Keep compact mobile layout rules in the page's narrow-screen media queries, including the 3.5rem header, icon-only narrow-phone sound control, persistent top-right menu close control and 13rem hero portrait.
- Keep the navigation drawer available below 1024px; show the full navigation from 1024px. When the responsive mode swap or closing the drawer hides the focused navigation control, move focus to the equivalent control in the new mode (the matching desktop link, or the menu toggle when the drawer links are not visible) rather than dropping it to the document body. Keep phone-only content styling below 768px. Let header/footer controls wrap and content grids reflow with enlarged text rather than clipping horizontal page overflow.
- Preload `assets/sam-1-1200.webp` for the homepage hero. Load the smaller `assets/sam-6-800.webp` contact portrait eagerly at low priority.
- Load the visible Writing portrait (`assets/sam-3.webp`) eagerly at high priority; keep below-the-fold catalogue and video thumbnails lazy-loaded.

### Testing And Deployment

- Pull requests targeting `main` must pass all unit tests and the complete configured Playwright matrix before merging. Enforce this with required GitHub status checks, not only post-merge deployment tests.
- Keep keyboard-navigation coverage honest: assert the single-activation visitor outcome (one key press reaches the destination) rather than retrying a failed activation until it passes, and track genuine focus or behaviour losses in `docs/next-steps.md` instead of encoding them as expected in tests.
- Test provider integrations through mocked browser APIs, not live providers.
- Test the deployed-host mapping locally to ensure the public site loads without host-specific behaviour.
- For theme-dependent interactive surfaces, Playwright coverage must exercise the visible state in both light and dark modes.
- Load GA4 only after a visitor explicitly accepts analytics cookies. Persist accept or reject choices locally. The footer links every page directly to the Privacy page's Cookie settings panel, which reopens the choice. Withdrawing consent disables analytics and deletes its host-only and domain-scoped cookies without clearing unrelated site data.
- Scan npm dependencies for known vulnerabilities with Google's open-source OSV-Scanner (`.github/workflows/osv-scanner.yml`). Pull requests fail only when they introduce a new vulnerability; pushes to `main`, manual runs and the weekly scan report all findings to Security > Code scanning and fail while any remain. Both the root and `studio/` lockfiles are scanned; unresolved findings stay tracked in `docs/next-steps.md`. The scan is not a required branch-protection check unless the repository owner adds it in settings.
- Send explicit consented page views after completed enhanced navigation; keep GA4's automatic history-based page measurement disabled in the data stream to avoid duplicate events. Do not initialise analytics in the local mobile-preview iframe.
- Test generated output before publishing. Audit the artifact against the explicit page/asset allowlist and fail on unexpected or stale files; never upload source templates or maintainer content.

Past performances show the two newest cards by default in one desktop row, with a native Show more/Show less disclosure for the remaining history. Preserve whole-summary keyboard activation, no-JavaScript access, reduced-motion behavior and existing grouped tour dates. The recent-history treatment is a preview proposal pending final visual checks.

Mobile navigation uses compact vertical spacing while retaining at least 44px link targets and readable enlarged text. When open, a backdrop intercepts page taps: tapping outside the menu dismisses it without activating the content below. Header controls remain available. The compact treatment is a review proposal until approved.

On phones, performance headings use the existing Newsreader serif treatment and rem-based sizes; card side padding is capped by viewport width so enlarged text has room to wrap at word boundaries. Preserve emergency wrapping for unusually long future CMS words, rather than truncating or hiding content.
