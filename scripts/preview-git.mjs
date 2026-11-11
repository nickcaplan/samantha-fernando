/** Read the live branch tip, refusing unknown or divergent history before edits. */
export function inspectPreviewHistory(git, branch) {
  const ref = `refs/heads/${branch}`;
  const listing = git('ls-remote', '--heads', 'origin', ref);
  if (!listing) return { publishedHead: false };
  const lines = listing.split('\n');
  if (lines.length !== 1 || !/^[a-f0-9]{40,64}\s/.test(lines[0]) || lines[0].split(/\s+/)[1] !== ref) {
    throw new Error('Could not verify remote branch. No label, commit or push change performed.');
  }
  git('fetch', '--no-tags', 'origin', ref);
  const remote = git('rev-parse', 'FETCH_HEAD');
  try { git('merge-base', '--is-ancestor', remote, 'HEAD'); }
  catch { throw new Error('Local and remote branch histories diverge. Reconcile the branch before retrying; this router never force-pushes. No label, commit or push change performed.'); }
  return { publishedHead: remote === git('rev-parse', 'HEAD') };
}

/** Keep published history intact and exclude unrelated staged files. */
export function setPreviewMessage(git, wanted, publishedHead) {
  if (publishedHead) git('commit', '--allow-empty', '--only', '-m', wanted);
  else git('commit', '--amend', '--only', '-m', wanted);
}
