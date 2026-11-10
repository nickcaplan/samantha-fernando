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
 *   NETLIFY_MINUTES_THRESHOLD  Flip point in build minutes (default 240).
 *   CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECTS (comma separated)
 *                              Optional: warn when this month's Cloudflare
 *                              Pages deployments approach the 500 build cap.
 *
 * Without NETLIFY_TOKEN (or if the usage API fails) the script routes to
 * Netlify, matching the long-standing setup. Without a GitHub token it cannot
 * move a PR to Cloudflare, so it also routes to Netlify and warns.
 */
import { execFileSync } from 'node:child_process';

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
  const accountId = accounts?.[0]?.id || accounts?.[0]?.slug;
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

async function cloudflareDeploymentCount() {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, CF_PAGES_PROJECTS } = process.env;
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_PAGES_PROJECTS) return null;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  let total = 0;
  for (const project of CF_PAGES_PROJECTS.split(',').map((p) => p.trim()).filter(Boolean)) {
    let page = 1;
    for (;;) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${project}/deployments?per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } },
      ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      const deployments = res.result ?? [];
      if (deployments.length === 0) break;
      total += deployments.filter((d) => new Date(d.created_on) >= monthStart).length;
      const oldest = deployments[deployments.length - 1];
      if (new Date(oldest.created_on) < monthStart || deployments.length < 100) break;
      page += 1;
    }
  }
  return total;
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
    if (minutes.used >= THRESHOLD) route = 'cloudflare';
  } catch (error) {
    console.log(`Could not read Netlify build minutes (${error.message}): routing to Netlify.`);
  }
}

// 2. Find the open PR for this branch.
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const prs = await api(`https://api.github.com/repos/${slug}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=open`, { token: githubToken });
const pr = prs.ok && Array.isArray(prs.json) ? prs.json[0] : null;
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
      git('commit', '--amend', '-m', wanted);
      amended = true;
    }
  }
}

// 5. Align the PR label.
if (pr && githubToken && !DRY_RUN) {
  await api(`https://api.github.com/repos/${slug}/labels`, {
    token: githubToken, method: 'POST',
    body: { name: LABEL, color: '1d76db', description: 'Preview builds on Cloudflare Pages instead of Netlify' },
  }); // 422 = already exists, fine either way
  if (route === 'cloudflare') {
    const res = await api(`https://api.github.com/repos/${slug}/issues/${pr.number}/labels`, { token: githubToken, method: 'POST', body: { labels: [LABEL] } });
    console.log(res.ok ? `Labelled PR #${pr.number} "${LABEL}".` : `Could not label PR #${pr.number} (HTTP ${res.status}).`);
  } else {
    await api(`https://api.github.com/repos/${slug}/issues/${pr.number}/labels/${LABEL}`, { token: githubToken, method: 'DELETE' });
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
  try {
    const count = await cloudflareDeploymentCount();
    if (count !== null) console.log(`Cloudflare Pages deployments this month: ${count} of 500${count >= 450 ? ' - near the limit, consider pausing previews' : ''}.`);
  } catch (error) {
    console.log(`Could not count Cloudflare deployments (${error.message}).`);
  }
} else {
  console.log('The preview builds on Netlify as a deploy preview for the PR.');
}
