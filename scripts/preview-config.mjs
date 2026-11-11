// Missing or ambiguous configuration must never select another team's quota.
export function selectNetlifyAccount(accounts, team) {
  if (!team || !Array.isArray(accounts)) throw new Error('Set NETLIFY_TEAM to the preview site team slug or ID');
  const matches = accounts.filter(account => account.slug === team || account.id === team);
  if (matches.length !== 1) throw new Error('Configured Netlify team is missing or ambiguous');
  return matches[0].id || matches[0].slug;
}

export function readPreviewPullRequest(response) {
  if (!response.ok || !Array.isArray(response.json) || response.json.length > 1) {
    throw new Error('PR lookup failed or was ambiguous. No amend or push performed.');
  }
  return response.json[0] || null;
}

export function choosePreviewProvider(used, threshold, ready) {
  return Number.isFinite(threshold) && threshold >= 0 && used >= threshold && ready ? 'cloudflare' : 'netlify';
}
