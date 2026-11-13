import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCloudflareCapacity } from '../scripts/preview-capacity.mjs';
test('retained deployment history cannot establish unused build capacity', async () => {
 for (const result of [[],[{id:'one-retained-build'}]]) {
  let calls=0;
  await assert.rejects(checkCloudflareCapacity({token:'fixture',accountId:'account',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({success:true,result})}}}),/capacity is unknown/);
  assert.equal(calls,0,'must not treat deployment listings as authoritative usage');
 }
});
