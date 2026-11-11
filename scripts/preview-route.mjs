#!/usr/bin/env node
/**
 * preview-route.mjs - push this branch so its pull request preview builds on
 * the provider with headroom, splitting preview load between Netlify and
 * Cloudflare Pages.
 *
 * The split:
 *   - Netlify under threshold: the HEAD commit message carries the prefix
 *     [CF-Pages-Skip] (so Cloudflare Pages skips the push) and the PR's
 *     `cloudflare` label is removed. Only Netlify builds the preview.
 *   - Netlify at or over threshold: the prefix comes off and the PR is
 *     labelled `cloudflare`, so Netlify's ignore command
 *     (scripts/netlify-ignore.mjs) skips the build and Cloudflare Pages
 *     builds the preview instead.
 *
 * Run from the repository root instead of a plain `git push` whenever pushing
 * a pull request branch:
 *
 *   node scripts/preview-route.mjs [--dry-run]
 *
 * Environment:
 *   NETLIFY_TOKEN              Netlify personal access token. Read-only use:
 *                              GET /api/v1/accounts and
 *                              GET /api/v1/{account_id}/builds/status.
 *   GITHUB_TOKEN or GH_TOKEN   Repo token, used to find the open PR for this
 *                              branch and to add or remove its label.
 *   NETLIFY_TEAM               Required team slug or ID for usage measurement.
 *   CF_PAGES_READY             Exact owner/repo, only after verifying a branch
 *                              preview builds on its configured Pages project.
 *   NETLIFY_MINUTES_THRESHOLD  Flip point in build minutes (default 240).
 *   CF_API_TOKEN, CF_ACCOUNT_ID Required for Cloudflare: read all Pages projects
 *                              and deployments to check account-wide capacity.
 *                              Stop at 450 builds, leaving conservative headroom.
 *
 * Without NETLIFY_TOKEN (or if the usage API fails) the script routes to
 * Netlify, matching the long-standing setup. Without a GitHub token it cannot
 * move a PR to Cloudflare, so it also routes to Netlify and warns.
 */
import { execFileSync } from 'node:child_process';
import { checkCloudflareCapacity } from './preview-capacity.mjs';
import { alignPreviewLabel } from './preview-label.mjs';
import { selectNetlifyAccount, readPreviewPullRequest, choosePreviewProvider } from './preview-config.mjs';

const SKIP_PREFIX = '[CF-Pages-Skip]';
const SKIP_PATTERN = /^\[(CF-Pages-Skip|CI Skip|CI-Skip|Skip CI|Skip-CI)\]\s*/i;
const LABEL = 'cloudflare';
const THRESHOLD = parseInt(process.env.NETLIFY_MINUTES_THRESHOLD || '240', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch === 'main' || branch === 'master') {
  console.log(`On ${branch}: preview routing only applies to pull request branches. Push directly.`);
  process.exit(0);
}

const origin = git('remote', 'get-url', 'origin');
const match = origin.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
if (!match) {
  console.error(`Cannot parse a GitHub owner/repo from origin: ${origin}`);
  process.exit(1);
}
const slug = match[1];
const owner = slug.split('/')[0];

async function api(url, { token, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'preview-route',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, json };
}

async function netlifyMinutes(token) {
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'preview-route' };
  const accounts = await fetch('https://api.netlify.com/api/v1/accounts', { headers })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
  const accountId = selectNetlifyAccount(accounts, process.env.NETLIFY_TEAM);
  if (!accountId) throw new Error('no Netlify account found');
  const status = await fetch(`https://api.netlify.com/api/v1/${accountId}/builds/status`, { headers })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
  const entry = Array.isArray(status) ? status[0] : status;
  const minutes = entry?.minutes ?? {};
  const used = Number(minutes.current ?? minutes.used);
  const included = Number(minutes.included_minutes ?? minutes.included);
  if (!Number.isFinite(used)) throw new Error('could not read minutes used');
  return { used, included: Number.isFinite(included) ? included : 300, periodEnd: minutes.period_end_date };
}

// 1. Measure Netlify usage.
let route = 'netlify';
let minutes = null;
if (!process.env.NETLIFY_TOKEN) {
  console.log('NETLIFY_TOKEN not set: cannot measure build minutes, routing to Netlify.');
} else {
  try {
    minutes = await netlifyMinutes(process.env.NETLIFY_TOKEN);
    console.log(`Netlify build minutes this period: ${minutes.used} of ${minutes.included} (threshold ${THRESHOLD}).`);
    route = choosePreviewProvider(minutes.used, THRESHOLD, process.env.CF_PAGES_READY === slug);
  } catch (error) {
    console.log(`Could not read Netlify build minutes (${error.message}): routing to Netlify.`);
  }
}

// 2. Find the open PR for this branch.
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const prs = await api(`https://api.github.com/repos/${slug}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=open`, { token: githubToken });
const pr = readPreviewPullRequest(prs);
if (pr) console.log(`Open PR: #${pr.number} (${pr.title})`);

// 3. A Cloudflare route needs the PR label; without a token or PR, stay on Netlify.
if (route === 'cloudflare') {
  if (!githubToken) {
    console.log('No GITHUB_TOKEN/GH_TOKEN: cannot label the PR, routing to Netlify instead.');
    route = 'netlify';
  } else if (!pr) {
    console.log('No open PR for this branch yet: routing this push to Netlify. Create the PR with the `cloudflare` label, or re-run this script after creating it.');
    route = 'netlify';
  }
}
console.log(`Route: ${route === 'cloudflare' ? 'Cloudflare Pages' : 'Netlify'}`);

// Capacity is account-wide and checked before any label or commit change.
if (route === 'cloudflare') {
  const count = await checkCloudflareCapacity({ token: process.env.CF_API_TOKEN, accountId: process.env.CF_ACCOUNT_ID });
  console.log(`Cloudflare current-month deployments: ${count}; below conservative 450-build routing cutoff.`);
}

// Verify provider selection before amending the commit or pushing.
await alignPreviewLabel({ api, slug, pr, route, label: LABEL, token: githubToken, dryRun: DRY_RUN });

// 4. Adjust the HEAD commit message prefix.
let amended = false;
const headOnMain = (() => {
  try { git('merge-base', '--is-ancestor', 'HEAD', 'origin/main'); return true; } catch { return false; }
})();
if (headOnMain) {
  console.log('HEAD has no commits beyond origin/main: leaving the commit message unchanged.');
} else {
  const current = git('log', '-1', '--pretty=%B');
  const stripped = current.replace(SKIP_PATTERN, '');
  const wanted = route === 'netlify' ? `${SKIP_PREFIX} ${stripped}` : stripped;
  if (wanted !== current) {
    console.log(route === 'netlify'
      ? `Prefixing HEAD commit message with ${SKIP_PREFIX}.`
      : `Removing the Cloudflare skip prefix from HEAD.`);
    if (!DRY_RUN) {
      git('commit', '--amend', '--only', '-m', wanted);
      amended = true;
    }
  }
}

// 6. Push.
if (!DRY_RUN) {
  const upstream = (() => { try { return git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'); } catch { return ''; } })();
  const pushArgs = amended
    ? ['push', '--force-with-lease', 'origin', `HEAD:${branch}`]
    : upstream
      ? ['push']
      : ['push', '-u', 'origin', `HEAD:${branch}`];
  console.log(`git ${pushArgs.join(' ')}`);
  git(...pushArgs);
}

// 7. Report.
if (route === 'cloudflare') {
  console.log('The preview builds on Cloudflare Pages: https://<branch>.<project>.pages.dev (check the PR for the Cloudflare Pages check run).');

} else {
  console.log('The preview builds on Netlify as a deploy preview for the PR.');
}
