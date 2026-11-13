#!/usr/bin/env node
/**
 * Optional fast-forward push helper for explicitly requested previews.
 * Netlify usage is scoped by NETLIFY_TEAM. Preview consent remains the
 * `preview` label; this script never adds it. A proposed Cloudflare route
 * stops before mutations because retained deployments cannot establish
 * authoritative monthly build usage. See docs/hosting.md.
 * Run: node scripts/preview-route.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { inspectPreviewHistory, setPreviewMessage } from './preview-git.mjs';
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

// Check live history before any provider-label or commit mutation.
const history = inspectPreviewHistory(git, branch);

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
  await checkCloudflareCapacity();
}

// Verify provider selection before amending the commit or pushing.
await alignPreviewLabel({ api, slug, pr, route, label: LABEL, token: githubToken, dryRun: DRY_RUN });

// 4. Adjust the HEAD commit message prefix.
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
      setPreviewMessage(git, wanted, history.publishedHead);
    }
  }
}

// 6. Push.
if (!DRY_RUN) {
  const pushArgs = ['push', '-u', 'origin', `HEAD:${branch}`];
  console.log(`git ${pushArgs.join(' ')}`);
  git(...pushArgs);
}

// 7. Report.
if (route === 'cloudflare') {
  console.log('The preview builds on Cloudflare Pages: https://<branch>.<project>.pages.dev (check the PR for the Cloudflare Pages check run).');

} else {
  console.log('The preview builds on Netlify as a deploy preview for the PR.');
}
