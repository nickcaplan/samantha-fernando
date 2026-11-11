import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { selectNetlifyAccount } from '../scripts/preview-config.mjs';

const script = resolve('scripts/preview-route.mjs');
const git = (cwd, ...args) => execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// Real local Git history/index; only remote push and HTTP are replaced.
function run(mode = 'normal', overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'preview-route-'));
  try {
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    writeFileSync(join(dir, 'tracked'), 'base');
    git(dir, 'add', '.'); git(dir, 'commit', '-m', 'base');
    git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(dir, 'checkout', '-b', 'preview');
    writeFileSync(join(dir, 'tracked'), 'branch');
    git(dir, 'commit', '-am', 'branch');
    const before = git(dir, 'rev-parse', 'HEAD');
    const tree = git(dir, 'rev-parse', 'HEAD^{tree}');
    writeFileSync(join(dir, 'staged'), 'must stay local'); git(dir, 'add', 'staged');
    git(dir, 'remote', 'add', 'origin', 'https://github.com/nickcaplan/samantha-fernando.git');
    mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, 'bin', 'git'), '#!/bin/sh\nif [ "$1" = push ]; then printf "%s\\n" "$*" >> "$FIXTURE_DIR/pushes"; exit 0; fi\nexec /usr/bin/git "$@"\n', { mode: 0o700 });
    writeFileSync(join(dir, 'http.mjs'), `
import { appendFileSync } from 'node:fs';
const mode = process.env.FIXTURE_MODE;
let labels = mode === 'labelled-no-token' || mode === 'delete-fail' || mode === 'delete-404-present' ? [{name:'cloudflare'}] : [];
globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  appendFileSync(process.env.FIXTURE_DIR + '/requests', method+' '+url+'\\n');
  let status=200, data;
  if (url.endsWith('/accounts')) data=[{id:'wrong',slug:'other'},{id:'right',slug:'site-team'}];
  else if (url.endsWith('/right/builds/status')) data={minutes:{current:300,included:300}};
  else if (url.includes('api.netlify.com')) throw Error('wrong Netlify team queried');
  else if (url.includes('/pulls?')) {
    if(mode==='lookup-throw') throw Error('network');
    status=mode==='lookup-403'?403:mode==='lookup-503'?503:200;
    data=mode==='lookup-invalid'?{}:mode==='no-pr'?[]:[{number:77,title:'preview',labels}];
  } else if (url.endsWith('/labels/cloudflare') && method==='DELETE') {
    status=mode==='delete-fail'?503:mode==='delete-404'||mode==='delete-404-present'?404:200;
    if(status===200) labels=[];
    data={};
  } else if (url.endsWith('/labels') && method==='POST') {
    status=mode==='add-fail'?403:200;
    if(status===200) labels=[{name:'cloudflare'}];
    data=labels;
  } else if (url.endsWith('/labels') && method==='GET') {
    status=mode==='verify-fail'?503:200;
    data=mode==='verify-invalid'?{}:mode==='verify-mismatch'?[]:labels;
  } else throw Error('Unexpected request '+method+' '+url);
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data),json:async()=>data};
};
`);
    // Strip all real credentials/configuration from the fixture's environment.
    const env = { PATH: join(dir, 'bin') + ':' + process.env.PATH, HOME: dir,
      FIXTURE_DIR: dir, FIXTURE_MODE: mode, NETLIFY_TOKEN: 'fixture',
      GITHUB_TOKEN: 'fixture', NETLIFY_TEAM: 'site-team', ...overrides };
    const result = spawnSync(process.execPath, ['--import', join(dir, 'http.mjs'), script], { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
    const read = name => { try { return readFileSync(join(dir, name), 'utf8'); } catch { return ''; } };
    return { status: result.status, error: result.error, output: result.stdout + result.stderr,
      pushes: read('pushes'), requests: read('requests'), before,
      after: git(dir, 'rev-parse', 'HEAD'), treeBefore: tree, treeAfter: git(dir, 'rev-parse', 'HEAD^{tree}'),
      staged: git(dir, 'diff', '--cached', '--name-only'), message: git(dir, 'log', '-1', '--pretty=%B') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const mode of ['lookup-403', 'lookup-503', 'lookup-throw', 'lookup-invalid', 'delete-fail', 'delete-404-present', 'labelled-no-token']) {
  test(`${mode} stops before amend or push`, () => {
    const r = run(mode, mode==='labelled-no-token'?{GITHUB_TOKEN:''}:{});
    assert.equal(r.error, undefined); assert.notEqual(r.status, 0, r.output);
    assert.equal(r.pushes, ''); assert.equal(r.after, r.before); assert.equal(r.staged, 'staged');
  });
}
for (const mode of ['add-fail', 'verify-fail', 'verify-invalid', 'verify-mismatch']) {
  test(`${mode} stops Cloudflare push before amend`, () => {
    const r = run(mode, {CF_PAGES_READY:'nickcaplan/samantha-fernando'});
    assert.notEqual(r.status, 0, r.output); assert.equal(r.pushes, ''); assert.equal(r.after, r.before);
  });
}
test('message-only amend preserves the real commit tree and staged file', () => {
  const r = run(); assert.equal(r.status, 0, r.output); assert.notEqual(r.after, r.before);
  assert.equal(r.treeAfter, r.treeBefore); assert.equal(r.staged, 'staged');
  assert.match(r.message, /^\[CF-Pages-Skip\]/); assert.match(r.pushes, /push/);
  assert.match(r.requests, /\/right\/builds\/status/); assert.doesNotMatch(r.requests, /\/wrong\/builds\/status/);
});
test('Cloudflare readiness must match this exact repository', () => {
  for (const readiness of ['', 'nickcaplan/foa-website']) {
    const r = run('normal', {CF_PAGES_READY:readiness}); assert.equal(r.status,0,r.output);
    assert.match(r.output,/Route: Netlify/); assert.doesNotMatch(r.requests,/POST .*\/labels/);
  }
});
test('verified readiness and label readback allow Cloudflare push', () => {
  const r = run('normal', {CF_PAGES_READY:'nickcaplan/samantha-fernando'});
  assert.equal(r.status,0,r.output); assert.match(r.output,/Route: Cloudflare Pages/);
  assert.match(r.requests,/POST .*\/labels/); assert.match(r.pushes,/push/);
});
test('missing/inaccessible Netlify team falls back safely without wrong usage query', () => {
  for (const team of ['', 'missing']) {
    const r=run('normal',{NETLIFY_TEAM:team,CF_PAGES_READY:'nickcaplan/samantha-fernando'});
    assert.equal(r.status,0,r.output); assert.match(r.output,/Route: Netlify/);
    assert.doesNotMatch(r.requests,/builds\/status/);
  }
});
test('genuine absent label DELETE404 is confirmed by readback', () => {
  const r=run('delete-404'); assert.equal(r.status,0,r.output); assert.match(r.pushes,/push/);
});
test('successful lookup with no PR is distinct from lookup failure', () => {
  const r=run('no-pr',{CF_PAGES_READY:'nickcaplan/samantha-fernando'});
  assert.equal(r.status,0,r.output); assert.match(r.output,/Route: Netlify/); assert.match(r.pushes,/push/);
});
test('no GitHub token keeps unlabelled PR on Netlify', () => {
  const r=run('normal',{GITHUB_TOKEN:'',CF_PAGES_READY:'nickcaplan/samantha-fernando'});
  assert.equal(r.status,0,r.output); assert.match(r.output,/Route: Netlify/); assert.match(r.pushes,/push/);
});
test('team selection rejects missing, duplicate and malformed account data', () => {
  assert.throws(()=>selectNetlifyAccount([], 'site-team'));
  assert.throws(()=>selectNetlifyAccount([{slug:'site-team'},{slug:'site-team'}], 'site-team'));
  assert.throws(()=>selectNetlifyAccount({}, 'site-team'));
  assert.equal(selectNetlifyAccount([{slug:'site-team',id:'right'}], 'right'), 'right');
});
