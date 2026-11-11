import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script=resolve('scripts/netlify-ignore.mjs');
function run({status=200,labels=['cloudflare'],token='',network=false,pr='true',head='nickcaplan/samantha-fernando'}={}) {
  const dir=mkdtempSync(join(tmpdir(),'preview-ignore-'));
  try {
    const fixture=join(dir,'fixture.mjs');
    writeFileSync(fixture,`import {writeFileSync} from 'node:fs';
      globalThis.fetch=async(url,options)=>{
        writeFileSync(${JSON.stringify(join(dir,'request'))},JSON.stringify({url,headers:options.headers}));
        if(${network})throw Error('fixture network failure');
        return {ok:${status>=200&&status<300},status:${status},json:async()=>({head:{repo:{full_name:${JSON.stringify(head)}}},labels:${JSON.stringify(labels.map(name=>({name})))}})};
      };`);
    const r=spawnSync(process.execPath,['--import',fixture,script],{env:{PULL_REQUEST:pr,REVIEW_ID:'77',PREVIEW_GITHUB_READ_TOKEN:token},encoding:'utf8',timeout:5000});
    let request=null;try{request=JSON.parse(readFileSync(join(dir,'request'),'utf8'));}catch{}
    return {status:r.status,request,output:r.stdout+r.stderr};
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('ignore check uses optional read-only auth without logging it',()=>{
  const r=run({token:'fixture-secret'});assert.equal(r.status,0);assert.equal(r.request.headers.Authorization,'Bearer fixture-secret');assert.doesNotMatch(r.output,/fixture-secret/);
});
test('ignore check without auth still reads public labels',()=>{
  const r=run();assert.equal(r.status,0);assert.equal(r.request.headers.Authorization,undefined);
});
test('rate limit and network failure deliberately build rather than lose preview',()=>{
  for(const options of [{status:403},{status:429},{network:true},{labels:[]}])assert.equal(run(options).status,1);
});
test('non-PR build makes no GitHub request',()=>{
  const r=run({pr:'false'});assert.equal(r.status,1);assert.equal(r.request,null);
});

test('fork and missing head build on Netlify even when labelled',()=>{
  for(const head of ['someone/fork','',null])assert.equal(run({head}).status,1);
  assert.equal(run({head:'NickCaplan/Samantha-Fernando'}).status,0);
});
