import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectPreviewHistory,setPreviewMessage} from '../scripts/preview-git.mjs';
function fixture(fn) {
 const dir=mkdtempSync(join(tmpdir(),'preview-history-'));
 try {
  const remote=join(dir,'remote.git'),local=join(dir,'local');mkdirSync(local);
  const cmd=(cwd,...a)=>execFileSync('git',a,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  cmd(dir,'init','--bare',remote);const git=(...a)=>cmd(local,...a);
  git('init','-b','preview');git('config','user.name','Test');git('config','user.email','test@example.invalid');
  git('remote','add','origin',remote);writeFileSync(join(local,'tracked'),'base');git('add','.');git('commit','-m','base');
  fn({git,local,remote,cmd});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('unpublished amend preserves staged files and commit tree',()=>fixture(({git,local})=>{
 const h=inspectPreviewHistory(git,'preview');assert.equal(h.publishedHead,false);
 const tree=git('rev-parse','HEAD^{tree}');writeFileSync(join(local,'staged'),'local');git('add','staged');
 setPreviewMessage(git,'[CF-Pages-Skip] base',h.publishedHead);
 assert.equal(git('rev-parse','HEAD^{tree}'),tree);assert.equal(git('diff','--cached','--name-only'),'staged');
}));
test('published HEAD uses tree-preserving marker; failed push retry stays fast-forward',()=>fixture(({git,local,remote})=>{
 git('push','origin','HEAD:preview');const published=git('rev-parse','HEAD');
 const h=inspectPreviewHistory(git,'preview');assert.equal(h.publishedHead,true);
 const tree=git('rev-parse','HEAD^{tree}');writeFileSync(join(local,'staged'),'local');git('add','staged');
 setPreviewMessage(git,'[CF-Pages-Skip] base',h.publishedHead);
 assert.equal(git('rev-parse','HEAD^'),published);assert.equal(git('rev-parse','HEAD^{tree}'),tree);
 assert.equal(git('diff','--cached','--name-only'),'staged');
 const hook=join(remote,'hooks','pre-receive');writeFileSync(hook,'#!/bin/sh\nexit 1\n',{mode:0o700});
 assert.throws(()=>git('push','origin','HEAD:preview'));unlinkSync(hook);
 // A rejected push leaves this local history intact. A fresh invocation retries normally.
 assert.equal(inspectPreviewHistory(git,'preview').publishedHead,false);
 git('push','origin','HEAD:preview');assert.equal(inspectPreviewHistory(git,'preview').publishedHead,true);
}));
test('pre-existing divergence stops without rewriting local or remote history',()=>fixture(({git})=>{
 git('push','origin','HEAD:preview');const published=git('rev-parse','HEAD');
 git('commit','--amend','-m','diverged');const local=git('rev-parse','HEAD');
 assert.throws(()=>inspectPreviewHistory(git,'preview'),/diverge/);
 assert.equal(git('rev-parse','HEAD'),local);assert.match(git('ls-remote','origin','refs/heads/preview'),new RegExp(published));
}));
test('remote lookup failure does not masquerade as a new branch',()=>{
 assert.throws(()=>inspectPreviewHistory(()=>{throw Error('network');},'preview'),/network/);
});
