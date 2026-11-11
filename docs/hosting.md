# Hosting And Recovery

## Production

- Repository: https://github.com/nickcaplan/samantha-fernando
- Canonical domain: https://www.samanthafernando.com/
- Hosting: GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`.
- DNS provider: Namecheap.
- Content publishing, webhook settings and scheduling limitations: [Sanity operations](sanity.md).

The site is live. No Squarespace cutover steps remain to perform.

## Deployment

Pushes to `main`, Sanity publish webhooks, manual dispatch and the daily schedule run the Pages workflow. It runs unit and browser tests against deterministic generated pages, builds the stylesheet, renders published Sanity content and tests that production artifact with `playwright.built.config.js` before uploading `_site/`. A failed test or artifact audit prevents deployment.

To rebuild the current `main` without a code change:

```sh
gh workflow run pages.yml --repo nickcaplan/samantha-fernando --ref main
gh run list --repo nickcaplan/samantha-fernando --workflow pages.yml --limit 5
gh run watch <run-id> --repo nickcaplan/samantha-fernando --exit-status
```

Confirm both the test and deploy jobs succeed. Check the content-build logs for fallback warnings if a Sanity edit is missing. Builds use current published content, not drafts; fallback behaviour is documented in [Sanity operations](sanity.md).

The published artifact contains root `index.html`, the exact generated page directories in `scripts/lib/pages.mjs`, `CNAME`, `robots.txt`, `sitemap.xml` and public `assets/`. `scripts/lib/public-output.mjs` rejects unexpected files, symlinks and stale routes rather than publishing them. Never add documentation, Studio files, tests, package files, repository metadata, source templates or maintainer notes. If a removed route causes an audit failure locally, inspect and remove only that obsolete generated file before rebuilding; CI starts from a clean checkout.

## Pull Request Previews

- Netlify normally builds pull-request previews against `main`; a verified `cloudflare` label routes the preview to Cloudflare instead. Use the selected provider's check/comment for the preview URL.
- Configuration lives in `netlify.toml`: previews inherit the general `[build]` command (`npm ci && npm run build:css && npm run build:content`, publish `_site/`, Node 22); the production context runs only the redirect writer in `[context.production]`.
- The Netlify production address (https://samanthafernando.netlify.app) only redirects to the canonical domain; GitHub Pages remains the live host and no custom domain is attached on Netlify.
- Branch deploys are disabled beyond the production branch `main` (deploy previews for pull requests are a separate context and still build), and the Netlify Drawer and Powered by Netlify badge are switched off.
- Previews split between Netlify and Cloudflare Pages to stay inside Netlify's monthly build minutes. `node scripts/preview-route.mjs`, run before each push to a pull request branch, checks this month's Netlify minutes: with headroom it prefixes the HEAD commit message with `[CF-Pages-Skip]` so only Netlify builds; at or over the threshold (240 minutes by default) it removes the prefix and labels the PR `cloudflare`, so Netlify's ignore command (`scripts/netlify-ignore.mjs`) skips and Cloudflare Pages builds the preview.
- Usage measurement requires `NETLIFY_TEAM`, the exact team slug or ID owning this preview site. Missing, inaccessible or ambiguous team configuration falls back to Netlify; the script never selects the first available account. Cloudflare routing also requires `CF_PAGES_READY=nickcaplan/samantha-fernando`, set only after a successful branch deployment has verified the project connection and build. Without that readiness confirmation, stay on Netlify even above the threshold. This PR does not establish that live readiness.
- PR lookup errors stop before changing the commit or pushing. Provider labels must be applied/removed and read back successfully before any amend or push; failed or mismatched labels stop the script. A genuine missing label (DELETE 404) is accepted only after readback confirms absence. The router checks the live remote branch before any label or commit changes and stops on unknown or divergent history. Unpublished commit-message amendments use `--only` to keep staged files out; for an already-published HEAD it adds an empty routing marker commit instead. Pushes are normal fast-forwards only, so retrying a failed push preserves published history without force. Run `node --test unit-tests/preview-route.test.mjs` for isolated failure-path tests that make no provider requests or remote pushes.
- When a same-repository PR carries the `cloudflare` label, the Netlify check posts "Deploy Preview canceled" by design and the Cloudflare Pages check carries the preview URL. Existing previews keep working; a PR only moves provider on its next push.
- Before selecting Cloudflare, the router requires `CF_API_TOKEN` and `CF_ACCOUNT_ID` with read access to every Pages project in that account, paginates all projects/deployments, and conservatively counts all current-month deployments. Missing access, malformed data or 450+ deployments stops before label/amend/push, leaving headroom below the Free-plan 500-build cap. This is a point-in-time check, not a reservation against simultaneous activity or an audit of provider billing. It never changes plans or pays for capacity.
- Netlify's ignore command can use optional `PREVIEW_GITHUB_READ_TOKEN` for authenticated public label reads. Supply only a read-only token in trusted build contexts; do not expose it to fork/untrusted code. Without safe authentication, or on API/network/rate-limit failure, the defined fallback is to build on Netlify so previews are not lost; a Cloudflare-routed PR can then build twice. No credential is installed by this PR.
- The Cloudflare Pages project builds with the same command and output directory as Netlify previews, from every non-production branch. Automatic production deployments stay disabled: GitHub Pages remains the live host.
- The older manual snapshot project (heartfelt-speculoos-87c44e.netlify.app) predates the Git connection and is not part of this flow.

## Domain And DNS Precautions

GitHub repository **Settings → Pages** should retain the custom domain `www.samanthafernando.com`. Check the DNS and HTTPS status there when diagnosing domain or certificate problems. Keep HTTPS enforcement enabled once a valid certificate is provisioned.

The expected GitHub Pages DNS configuration is:

| Host | Type | Target |
|---|---|---|
| `www` | CNAME | `nickcaplan.github.io` |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |

These are the intended records, not a live DNS audit. Compare the actual records with GitHub's current [custom-domain guidance](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) before changing them. A repository rename does not change the account-level `www` CNAME target.

Before any DNS change, export or screenshot the existing records. Change only the relevant website records. Leave MX and email-related TXT records, including SPF, DKIM and DMARC, unchanged. DNS changes are not a remedy for a broken code or content deployment.

## Verification

After a deployment or hosting change, check in a browser:

- `https://www.samanthafernando.com/` loads without a certificate warning.
- `https://samanthafernando.com/` redirects to the canonical `www` URL.
- Works filters, SoundCloud/Spotify controls, YouTube modals, theme control and desktop/mobile navigation work.
- Direct loads and refreshes at `/biography/`, `/works/`, `/writing/` and `/contact/` return their own content and metadata. Writing includes the complete essay directly. Unknown paths return HTTP 404 with the “An unexpected pause” custom page, keeping the requested URL and working Home/recordings links even on deeply nested paths. `npm run serve` reproduces this locally through `scripts/serve.py`. Old root hash bookmarks are intentionally unsupported.
- Audio continues through ordinary enhanced page navigation; full reloads or opening another tab create independent players. Check real provider playback rather than the soundbar alone.
- The sitemap lists the canonical page URLs. Submit it in Search Console if owner access is available and monitor indexing after launch.
- The enquiry form works; confirm delivery when testing submission, without including sensitive information.

After DNS changes, also verify normal inbound and outbound email. Restore the saved mail records if they were accidentally changed.

BoxedCode cannot fetch the public website because its sandbox blocks outbound access to that domain. A successful Actions run verifies deployment, not live-site propagation; check the public site outside BoxedCode.

## Recovery

### Failed Workflow Or Transient Build Problem

A failed test or build normally leaves the previously deployed site in place. Inspect the failed job before retrying. For a transient failure, rerun the failed jobs or manually dispatch the workflow above. Do not alter DNS or disable HTTPS.

### Regressed Website Code

1. Identify the regression and a known-good commit from successful Pages runs and Git history.
2. Create a fix branch from the latest `origin/main` in a clean checkout or worktree. Revert the offending commit(s), or make a targeted fix; do not reset or force-push shared history. Merge commits require an explicitly chosen mainline.
3. Run the relevant automated tests. Rebuild CSS with `npm run build:css` if Tailwind utility classes or stylesheet sources change.
4. Review and merge the recovery change to `main` through the repository's normal review/check requirements, then confirm the Pages workflow succeeds and perform the browser checks above.

Reverting code does not recreate an exact historical site: every build reads current published Sanity content, and the committed fallback is used only when live content cannot be rendered.

### Incorrect Published Content

Restore the intended document version in Sanity Studio and publish it. Confirm the webhook triggers a successful Pages run; if needed, dispatch the workflow manually. See [Sanity operations](sanity.md) for webhook troubleshooting. Do not reseed or overwrite the dataset to undo an editorial mistake.
