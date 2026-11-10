/**
 * Netlify ignore command (configured in netlify.toml). Exit 1 builds, exit 0
 * skips: https://docs.netlify.com/build/configure-builds/ignore-builds/
 *
 * Pull request builds are skipped when the PR is labelled `cloudflare`, which
 * means its preview builds on Cloudflare Pages instead. The label is managed
 * by scripts/preview-route.mjs; see AGENTS.md. Anything that cannot be checked
 * (no PR context, GitHub API unavailable) builds on Netlify as before.
 */
const repo = 'nickcaplan/samantha-fernando';
const { PULL_REQUEST, REVIEW_ID } = process.env;

if (PULL_REQUEST === 'true' && REVIEW_ID) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${REVIEW_ID}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'netlify-ignore' },
    });
    if (res.ok) {
      const pr = await res.json();
      if ((pr.labels || []).some((label) => label.name === 'cloudflare')) {
        console.log(`PR #${REVIEW_ID} is labelled "cloudflare": skipping this Netlify build; the preview builds on Cloudflare Pages.`);
        process.exit(0);
      }
    } else {
      console.log(`Could not check PR labels (GitHub API HTTP ${res.status}); building on Netlify.`);
    }
  } catch (error) {
    console.log(`Could not check PR labels (${error.message}); building on Netlify.`);
  }
}
process.exit(1);
