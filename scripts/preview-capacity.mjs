// Retained Pages deployment history is not a billing usage counter: deleted
// deployments still consume builds. Until authoritative usage is available,
// stop before selecting Cloudflare, changing labels, amending or pushing.
export async function checkCloudflareCapacity() {
  throw new Error('Cloudflare capacity is unknown: retained deployment history cannot prove monthly build usage. No push performed; choose an approved preview route.');
}
