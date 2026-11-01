# Next Steps

Use this file to track unresolved implementation, product and maintenance work. Remove completed work; durable decisions belong in `docs/project-brief.md` and questions requiring Samantha's input belong in `docs/questions-for-sam.md`.

## Verification And Accessibility

- [ ] **Restore local Firefox and WebKit execution.** The local harness fails during Firefox page creation (`browserContext.newPage`, undefined `_page`) and stalls launching WebKit. Use the full PR-check browser matrix to verify multi-page navigation and responsive behaviour until local execution is repaired.
- [ ] **Release the multi-page site after explicit deployment approval.** Verify direct nested URLs and refreshes, page metadata, contact delivery and uninterrupted real-provider playback outside BoxedCode. Submit the generated sitemap in Search Console if owner access is available and monitor page indexing after launch. Old root-hash bookmarks are intentionally unsupported.
- [ ] **Disable automatic GA4 history-based page views before releasing enhanced navigation.** Follow [analytics setup](google-analytics-setup.md); the site now sends explicit consented page views. Verify the data-stream setting and Realtime reporting externally to rule out duplicates.
- [ ] **Plan the GitHub Actions runner upgrade.** The Pages test and deploy jobs are pinned to `ubuntu-24.04`; test them on `ubuntu-26.04` and update both jobs deliberately after confirming the workflow passes.
- [ ] **HIGH PRIORITY: Manually verify third-party media on the deployed site.** Check SoundCloud playback events, Spotify and SoundCloud mutual exclusion, soundbar restart and stop controls, soundbar visibility during navigation, and YouTube thumbnail/modal behaviour. Use widget events, not the soundbar alone, to establish that audio is playing.
- [ ] **HIGH PRIORITY: Configure and verify Formspree delivery controls.** Confirm server-side spam protection, recipient notifications and the intended recipient inbox in Formspree; submit a non-sensitive deployed-site test and confirm delivery.
- [ ] **Keep keyboard focus across the 1024px navigation-mode swap.** When a resize carries the CSS viewport across the desktop breakpoint, the focused navigation link hides and focus drops to the document body (measured in Chromium and Firefox by `tests/nav-breakpoint.spec.js`; WebKit's focus destination is unmeasured). After the swap the tests refocus the new mode's link programmatically before activating it, so a pass proves recovery with a refocused control, not preserved focus and not keyboard-only recovery. Decide whether the site should move focus to the equivalent control in the new mode; do not mask the loss in tests.
- [ ] **Align responsive breakpoints.** Reconcile the documented and implemented mobile thresholds, then test desktop, phone landscape, narrow mobile and iframe preview layouts.
- [ ] **Standardise notice and reduced-motion behaviour.** Distinguish informational availability or metadata gaps from errors, and provide reduced-motion alternatives for transitions, playback animation and media hover scaling.

## Sanity CMS

- [ ] **Renew the Sanity publish-webhook token by 27 November 2026.** The GitHub token has a 30-day expiry and an expired token silently stops deploys. Follow the renewal steps in `docs/sanity.md` and update the expiry date there.
- [ ] **Confirm Samantha can sign in to the Studio and publish.** She was invited as an Editor on 7 October 2026. Check her first edit appears on the live site.
- [ ] **Verify normal catalogue editing in production.** Studio schemas and initial 48-document import are complete, the site is deployed and the webhook dispatch was verified with a temporary non-rendered marker. During routine content work, verify a Recording add/edit/unpublish and both default-recording providers. Live-site propagation remains unverified from BoxedCode; confirm outside the sandbox.
- [ ] **Migrate the remaining sections to Sanity, one at a time.** Remaining scope: Writing essay, site metadata and hero, homepage Spotlight Works, Contact. Reuse `scripts/lib/` and the marker pattern in `index.html`.
- [ ] **Decide whether to add the 2013 RPS Composition Prize to the Biography milestones.** It is in the content record but not on the page; see `docs/questions-for-sam.md`.
- [ ] **Add a draft preview route.** Studio cannot preview a static build; consider a local `build:content` against drafts or a separate preview deploy.

## Mobile Preview Performance

- [ ] **Instrument cold and warm preview startup.** Record iframe navigation, DOM readiness, first paint, route readiness and load completion, then inspect the request waterfall to identify what accounts for the current first-open delay before making further optimisations.
- [ ] **Create a lightweight preview boot profile.** Keep the real page and responsive CSS, but use the `mobilePreview` flag to avoid initializing media providers, hidden modals, inactive catalogue views and other functionality that is not needed until it is used.
- [ ] **Reduce render-blocking external assets.** Measure Google Fonts and Font Awesome in the preview critical path; evaluate self-hosted/subset fonts and inline SVG icons so first render does not depend on third-party stylesheet requests.
- [ ] **Audit preview image delivery.** Add appropriately sized `srcset` candidates, preserve lazy loading for inactive content and ensure only the visible route's critical image receives high priority.
- [ ] **Add an explicit preview-ready handshake.** Have the iframe notify the parent when its current route is rendered, show a lightweight loading state until then and distinguish navigation readiness from slow non-critical resources.
- [ ] **Add mobile-preview regression and performance coverage.** Verify first open, repeated open/close reuse, current-route synchronization, refresh restoration, recursion prevention and a bounded set of preview startup requests. Capture timing as diagnostic output before enforcing a stable performance budget.
- [ ] **Reconsider the iframe architecture if boot profiling remains slow.** Compare the retained real-page iframe with a same-document responsive preview or dedicated preview entry point, documenting state-sync, accessibility and maintenance trade-offs before changing the current architecture decision.

## Deferred Structural Work

- [ ] **Review content for individual composition pages.** Add stable Work slugs and detail routes only when sufficient work-specific notes, credits, recordings and score-enquiry context are available; do not generate thin duplicates of catalogue cards.
- [ ] **Evaluate Cloudflare.** Compare its DNS, redirects, caching, security, analytics and traffic-measurement benefits against the current Namecheap and GitHub Pages setup.
- [ ] **Secure durable Google Analytics ownership.** Ask the existing GA4 account administrator to grant Administrator access to Samantha or another durable site-owner account, then retain at least two trusted administrators. The site implementation and consent controls are documented in `docs/google-analytics-setup.md`.

## Constraints And Verification

- The visualizer is simulated because the SoundCloud Widget API does not expose audio amplitude. SoundCloud progress comes from the Widget API; Spotify progress is a display-only local elapsed-time estimate. Neither progress bar supports seeking.
- Tailwind is compiled locally to `assets/tailwind.min.css`. Run `npm run build:css` after changing `tailwind.css` or Tailwind utility usage.
- Build with `npm run build:test` (committed fallbacks) or `npm run build:content` (Sanity), then serve the generated site over HTTP with `npm run serve`, not the source tree or `file://`.
- Run `npm test` before deployment. Use `npm run test:all` for the full Chromium, Firefox, WebKit and tagged-mobile matrix.
