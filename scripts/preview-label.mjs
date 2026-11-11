// Do not amend or push until GitHub confirms the provider-selection label.
export async function alignPreviewLabel({ api, slug, pr, route, label, token, dryRun = false }) {
  if (dryRun || !pr) return;
  const hasLabel = (pr.labels || []).some(item => item.name === label);
  if (!token) {
    if (hasLabel) throw new Error('Cannot verify/remove the Cloudflare label without a GitHub token. No push performed.');
    return;
  }
  if (route === 'cloudflare') {
    const result = await api(`https://api.github.com/repos/${slug}/issues/${pr.number}/labels`, {
      token, method: 'POST', body: { labels: [label] },
    });
    if (!result.ok) throw new Error(`Could not apply preview label (HTTP ${result.status}). No push performed.`);
  } else {
    const result = await api(`https://api.github.com/repos/${slug}/issues/${pr.number}/labels/${label}`, {
      token, method: 'DELETE',
    });
    if (!result.ok && result.status !== 404) throw new Error(`Could not remove preview label (HTTP ${result.status}). No push performed.`);
  }
  const verified = await api(`https://api.github.com/repos/${slug}/issues/${pr.number}/labels`, { token });
  if (!verified.ok || !Array.isArray(verified.json)) throw new Error('Could not verify preview label. No push performed.');
  if (verified.json.some(item => item.name === label) !== (route === 'cloudflare')) {
    throw new Error('Preview label does not match selected provider. No push performed.');
  }
}
