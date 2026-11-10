# Samantha Fernando Website

Static multi-page portfolio for composer Samantha Fernando. Biography, Works & Media, Listen, Watch, Writing, Contact and Privacy have directly loadable HTML pages. Homepage performances come from published Sanity Performance documents (with an independent committed fallback) and are shown only while upcoming events exist. Writing shows the complete Wintering essay directly.

## Technical Overview

- Shared HTML/CSS/JavaScript source and committed content fallbacks in `index.html`; `scripts/lib/pages.mjs` generates distinct pages and a shared `assets/site.js` runtime into `_site/`.
- Ordinary navigation links are progressively enhanced to preserve audio controllers while replacing page content and metadata. Full loads work without the enhancement; reloading resets playback.
- Page-specific titles, descriptions, canonical/social metadata and structured data, plus a sitemap generated from the canonical route registry. A compact custom `404.html` uses the shared shell and is excluded from indexing and the sitemap. The Works catalogue is pre-rendered using `assets/catalogue-renderer.js`, shared with browser filtering.
- Compiled Tailwind CSS in `assets/tailwind.min.css`; Font Awesome and Google Fonts loaded from CDNs.
- SoundCloud Widget API for verified SoundCloud recordings.
- Spotify track playback through the Spotify IFrame API.
- A unified Works & Media catalogue. The committed fallback contains 23 works, thirteen recordings and eleven films; Sanity can add or remove entries.
- YouTube videos open in an in-page modal from thumbnail cards.
- GitHub Pages deployment from the `main` branch.

## Content (Sanity)

Biography and the Works & Media catalogue have Sanity schemas (`studio/`, project `9a66iw1t`) and build-time integration. Both are editable at <https://samantha-fernando.sanity.studio>. Published content is baked into the static pages, never fetched from Sanity in the browser.

```bash
npm run build:content        # writes the publishable site to _site/ using live Sanity content
cd studio && npm run dev     # run the Studio locally
cd studio && npm run deploy  # publish the hosted Studio after schema changes
```

If Sanity is unavailable or incomplete, `build:content` keeps the committed section fallback in `index.html`. Biography and Works & Media fall back independently. `studio/scripts/seed-biography.ts` recreates Biography; `studio/scripts/seed-catalogue.ts` imports the catalogue without overwriting existing editor changes. See `docs/sanity.md` before running either import.

## Run Locally

```bash
npm run build:css
npm run build:test     # deterministic committed content; use build:content for published Sanity content
npm run serve
```

Open <http://localhost:8000>. Serve `_site/`, not the repository root or `file://`. Rebuild after source changes. Generated pages live at `/`, `/biography/`, `/works/`, `/listen/`, `/watch/`, `/writing/`, `/contact/` and `/privacy/`. The retired `/works/#listen` and `/works/#watch` views redirect to the new pages; old root-fragment bookmarks are not mapped. `npm run serve` uses `scripts/serve.py` so missing URLs, such as `/missing-page/`, show the custom error page with HTTP 404, matching GitHub Pages behaviour. `/404.html` also opens the design directly.

## Tests

Install dependencies and Chromium once with `npm install` and `npx playwright install chromium`, then run `npm test`. Playwright builds deterministic pages and serves `_site/` on port 8010 without reusing an existing server. Use `npm run test:unit` for build/renderer checks and `npm run test:all` for the full browser matrix. `playwright.built.config.js` tests an already-built artifact without replacing its content.

PR checks run unit tests and all four Playwright projects (Chromium, Firefox, WebKit and mobile Chromium). Install all desktop browser engines locally with `npx playwright install chromium firefox webkit` to run the full matrix. See [the test strategy](docs/test-strategy.md#pull-requests) for the required merge checks and branch-protection setup.

## Deployment

- Hosting, DNS precautions, deployment verification and recovery: [hosting guide](docs/hosting.md).
- Production domain: <https://www.samanthafernando.com/>
- The Pages workflow runs on pushes to `main`, Sanity publish webhooks, manual dispatch and daily at 8am UK time (`Europe/London`, following GMT/BST). See `docs/sanity.md` for scheduling limitations.

## Owner-invoked Robin review

After this setup is merged to `main`, Nick can post exactly `/review` on an open, non-draft PR from this public repository to `main`. Other users, forks, automatic PR/push events and comment edits do not invoke it. No review runs merely because this PR is opened or merged.

Robin is advisory only: it cannot approve a merge, block CI or request changes. Nick's explicit per-PR Merge approval and existing checks still apply. The workflow runs the pinned Robin action `808e18045c93f80f917a41be8fa3f80fa03d70a0` without checking out or executing PR code. It sends the public PR diff to OpenRouter and its free model provider; do not put private information in a public diff. Agent mode is off. Diffs over 20,000 characters or empty diffs are rejected. A final head check flags stale findings but cannot undo a review already posted if the head changes during a run.

The model is `nvidia/nemotron-3-ultra-550b-a55b:free`, with reasoning `none`, a 4,000 output-token cap and a five-minute job deadline. No paid fallback is configured. Provider retries can use more than one free request; provider capacity and review quality are not guaranteed. If a provider rejects the reasoning override, Robin may retry without it and log a warning. Inspect the run before trusting the result.

`OPENROUTER_ROBIN_PILOT` is a repository Actions secret, never a committed value. The approved shared key has a $0 spending cap with no reset and expires **17 November 2026 at 12:29 UTC**. All configured repositories share the account's 50 free requests per UTC day, not 50 each. The request counter resets at midnight UTC independently of the $0 spending cap. Expiry or a failed free request is not permission to raise the cap, add credits, add a card or switch to a paid model. Key renewal or replacement needs separate approval.

Run the offline safety checks from the repository root with `python3 scripts/test-robin-guards.py`. These do not call GitHub, OpenRouter or a model. The native Compass run succeeded on 10 November 2026 with this pinned action and model setting; this repository's live review remains untested until an approved invocation after Merge.
