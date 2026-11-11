// Do not amend or push until GitHub confirms the provider-selection label.
async function readLabels(api, url, token) {
  const labels = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api(`${url}?per_page=100&page=${page}`, { token });
    if (!result.ok || !Array.isArray(result.json)) throw new Error('Could not verify preview label. No push performed.');
    labels.push(...result.json);
    if (result.json.length < 100) return labels;
  }
  throw new Error('Preview label pagination limit exceeded. No push performed.');
}

export async function alignPreviewLabel({ api, slug, pr, route, label, token, dryRun = false }) {
  if (dryRun || !pr) return;
  const hasLabel = (pr.labels || []).some(item => item.name === label);
  if (!token) {
    if (hasLabel) throw new Error('Cannot verify/remove the Cloudflare label without a GitHub token. No push performed.');
    return;
  }
  const url = `https://api.github.com/repos/${slug}/issues/${pr.number}/labels`;
  const before = await readLabels(api, url, token);
  const present = before.some(item => item.name === label);
  if (route === 'cloudflare' && !present) {
    const result = await api(url, { token, method: 'POST', body: { labels: [label] } });
    if (!result.ok) throw new Error(`Could not apply preview label (HTTP ${result.status}). No push performed.`);
  } else if (route !== 'cloudflare' && present) {
    const result = await api(`${url}/${encodeURIComponent(label)}`, { token, method: 'DELETE' });
    if (!result.ok && result.status !== 404) throw new Error(`Could not remove preview label (HTTP ${result.status}). No push performed.`);
  }
  const verified = await readLabels(api, url, token);
  if (verified.some(item => item.name === label) !== (route === 'cloudflare')) {
    throw new Error('Preview label does not match selected provider. No push performed.');
  }
}
