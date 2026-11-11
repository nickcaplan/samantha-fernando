// Count all projects, not a caller-selected subset, before changing routing.
// Conservative: count every current-month deployment, including skipped/direct uploads.
export async function checkCloudflareCapacity({ token, accountId, fetchImpl = fetch, now = new Date() }) {
  if (!token || !accountId) throw new Error('Cloudflare capacity is unknown: set CF_API_TOKEN and CF_ACCOUNT_ID. No push performed.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects`;
  const headers = { Authorization: `Bearer ${token}` };
  async function pages(url, visit) {
    for (let page = 1; page <= 1000; page += 1) {
      const response = await fetchImpl(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { headers });
      if (!response.ok) throw new Error(`Cloudflare capacity lookup failed (HTTP ${response.status}). No push performed.`);
      const data = await response.json();
      if (data.success !== true || !Array.isArray(data.result)) throw new Error('Malformed Cloudflare capacity response. No push performed.');
      await visit(data.result);
      const totalPages = data.result_info?.total_pages;
      if (totalPages !== undefined) {
        if (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > 1000 || (totalPages > 0 && data.result.length === 0)) {
          throw new Error('Invalid Cloudflare pagination. No push performed.');
        }
        if (page >= totalPages) return;
      } else if (data.result.length < 100) return;
    }
    throw new Error('Cloudflare pagination limit reached. No push performed.');
  }
  const projects = new Set();
  await pages(base, async entries => {
    for (const project of entries) {
      if (typeof project.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(project.name) || projects.has(project.name)) {
        throw new Error('Invalid/duplicate Cloudflare project. No push performed.');
      }
      projects.add(project.name);
    }
  });
  if (!projects.size) throw new Error('No Cloudflare projects visible; capacity cannot verify this route. No push performed.');
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let count = 0;
  const ids = new Set();
  for (const project of projects) {
    await pages(`${base}/${encodeURIComponent(project)}/deployments`, async entries => {
      for (const deployment of entries) {
        const date = Date.parse(deployment.created_on);
        if (!Number.isFinite(date) || !deployment.id || ids.has(deployment.id)) throw new Error('Invalid/duplicate Cloudflare deployment. No push performed.');
        ids.add(deployment.id);
        if (date >= monthStart) count += 1;
      }
      // Reserve headroom for concurrent builds rather than route at the hard limit.
      if (count >= 450) throw new Error('Cloudflare is at or near the 500-build Free-plan monthly limit. No push performed; wait for reset or review another preview route.');
    });
  }
  return count;
}
