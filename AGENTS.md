# Samantha Fernando Site

## GitHub Pages

- Repository: https://github.com/nickcaplan/samantha-fernando
- Production domain: https://www.samanthafernando.com/
- Deployment workflow: `.github/workflows/pages.yml`
- Deployment branch: `main`

## Project Notes

- This is a static GitHub Pages site.
- The published site is publicly accessible without a client-side password gate.
- SoundCloud playback uses the SoundCloud Widget API. Spotify recordings use custom rows backed by the Spotify IFrame API.
- `Works`, `Listen` and `Watch` link to `/works/`, `/listen/` and `/watch/` respectively: three standalone pages rendered from one shared catalogue template, with the Listen or Watch view preselected. `index.html` is the shared source template/fallback, not the publishable homepage; build and serve `_site/` for local review.
- YouTube cards use thumbnails and the existing in-page modal rather than loading multiple embedded players on page load.

## Pull Request Preview Routing

- Previews split between Netlify and Cloudflare Pages. Before pushing a pull request branch, run `node scripts/preview-route.mjs` from the repository root instead of a plain `git push`; it routes the preview to whichever provider has headroom (see `docs/hosting.md`). Put the preview URL from whichever provider built it in the PR description. Set `NETLIFY_TEAM` to the verified site-owner team slug or ID; set `CF_PAGES_READY` to this exact owner/repo only after a successful Pages branch build. Missing setup stays on Netlify. The router stops on PR lookup or label verification failures. Test its isolated failure paths with `node --test unit-tests/preview-route.test.mjs` before changing it.

## Documentation

- `README.md` is the concise public project overview.
- `docs/content.md` is the complete CMS-ready source of truth for all content rendered on the site, including metadata, page copy, works, events, media, links, writing, and contact fields. Update it whenever site content changes.
- `docs/project-brief.md` records the project overview and settled decisions that constrain future work.
- `docs/next-steps.md` contains unresolved implementation, product and maintenance work.
- `docs/hosting.md` covers production hosting, DNS precautions, deployment verification and recovery. It is operational documentation and is not part of the published artifact.
- `docs/questions-for-sam.md` contains content and product decisions requiring Samantha's input.
- `docs/website-content-map-specifications.md` is a concise reference to the retired site's structure.
- `docs/website-critique-redesign-strategy.md` records the redesign direction and outstanding product questions.
- `docs/test-strategy.md` describes current automated-test coverage and conventions.
- `docs/sanity.md` is the operational guide for Sanity: Studio and Manage URLs, members, the publish webhook, GitHub token expiry and renewal, and troubleshooting. Keep it updated when the Sanity setup changes.
- `design/` contains local-only design documentation and working visual references, including `playground.html` for component reviews and `design-reference.html` for accepted foundations. These files are not published.

### Documentation Maintenance

- Keep each document scoped to its stated purpose. Do not duplicate content between documents; link to the canonical record instead.
- `docs/content.md` is the only detailed content inventory. Keep its facts aligned with the rendered site.
- `docs/next-steps.md` contains only unresolved work. Move Samantha decisions to `docs/questions-for-sam.md` and remove completed work rather than recording session history.
- `docs/project-brief.md` contains only durable constraints. Replace superseded decisions and omit implementation logs.
- Keep `README.md` and `docs/test-strategy.md` operational: commands, current behaviour and coverage only.
- Treat legacy and strategy documents as concise context. Update them only when the current direction changes.
- Before completing a significant change, remove or correct any documentation statement it makes stale. Prefer editing an existing sentence over adding a dated note.

## Maintenance Notes

- Biography content comes from Sanity at build time (`npm run build:content`, see `docs/project-brief.md`). The Studio is at https://samantha-fernando.sanity.studio (administration and token renewal: `docs/sanity.md`). Edit copy in Sanity Studio, not in the marked region of `index.html`, which is only the fallback. When fallback copy changes, update the Sanity document and `docs/content.md` together. Unit tests live in `unit-tests/` (`npm run test:unit`).

- This repository is public. Before committing or pushing, inspect changed files for passwords, API keys, tokens, private URLs, personal data and other secrets. Never commit secrets, even in Markdown, tests, logs or documentation examples; use placeholders and ask the user for any required runtime values instead.
- Follow the applicable decisions in `docs/project-brief.md` when changing layout, interaction, accessibility or responsive behaviour.
- **IMPORTANT: `assets/tailwind.min.css` is generated and must be rebuilt after every change to Tailwind utility classes in `index.html` or `tailwind.css`. Run `npm run build:css` before testing or reporting the change complete.** The browser loads `assets/tailwind.min.css`, not the source Tailwind directives, so utility changes will not take effect until this build runs.
- After making code changes, run the relevant automated tests when possible. For this site, use `npx playwright test` for the full suite or `npx playwright test tests/site-load.spec.js --project=chromium -g "<test name>"` for a focused check. Report whether the test passed, failed, or was blocked; do not describe browser tests as unavailable if they actually started. If the configured web-server port is already in use, report the process ID and the command needed to kill it to the user, then stop the stale server/process or use the project's configured test workflow before retrying.
- When refining UX or reusable components, offer multiple functional, clearly labelled on-page options for the user to compare when practical. Keep each option responsive and accessible, then apply the chosen direction and remove the temporary alternatives.
- Review `docs/project-brief.md` before revisiting an established product or implementation choice, and update it when a significant decision changes.
- After every major or significant site change or decision, update the relevant local Markdown documentation, including files in `docs/`, `README.md`, or the planning documents as appropriate. Do this before reporting the work complete.
- When the user says "closing the session now", review the current session for outstanding documentation, tests, verification and follow-up updates, then make or record the necessary changes before closing. Before closing, ask whether the user wants the changes deployed; deployment remains opt-in and must not happen without explicit approval.
- Do not deploy or push changes unless the user explicitly asks; ask before deploying if deployment would be useful.
- When the user explicitly asks to push changes, push the requested commit or branch and verify the GitHub Pages Actions workflow completed successfully. BoxedCode cannot fetch the externally published GitHub Pages URL because outbound access to that site is blocked by the sandbox network allowlist: do not attempt `webfetch`, `curl`, or another external fetch after deployment. Treat live-site propagation as unverified unless the user confirms it outside BoxedCode, and report that limitation explicitly.
- Documentation may be committed to source control when relevant, but it must not be included in the published GitHub Pages artifact.
- The published artifact must contain only the public website files: root `index.html` and `404.html`, the generated `biography/`, `works/`, `listen/`, `watch/`, `writing/`, `contact/` and `privacy/` page directories, `CNAME`, `robots.txt`, `sitemap.xml` and `assets/`. Writing contains the full essay directly, not a separate essay page. Keep the exact page allowlist in `scripts/lib/pages.mjs` and `scripts/lib/public-output.mjs`. Never publish Markdown, tests, package files, workflow files, repository metadata, source templates or maintainer notes as part of the live site.
