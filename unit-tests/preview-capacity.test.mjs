import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCloudflareCapacity } from '../scripts/preview-capacity.mjs';

const now = new Date('2026-11-11T15:00:00Z');
function fixture({ full = false, fail = false, malformed = false, duplicate = false } = {}) {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(url);
    const u = new URL(url), page = Number(u.searchParams.get('page'));
    let result, totalPages;
    if (!url.includes('/deployments?')) {
      result = page === 1 ? [{name:'other-site'}] : [{name:'sam-site'}]; totalPages = 2;
    } else if (url.includes('/other-site/')) {
      result = Array.from({length:full ? (page===5?50:100) : 2}, (_, i) => ({id:`other-${page}-${i}`,created_on:'2026-11-01T00:00:00Z'})); totalPages = full?5:1;
    } else {
      result = page === 1 ? [{id:duplicate?'other-1-0':'sam-1',created_on:'2026-11-02T00:00:00Z'}] : [{id:'old',created_on:'2026-10-31T23:59:59Z'}]; totalPages = 2;
    }
    return {ok:!fail,status:fail?403:200,json:async()=>({success:true,result:malformed?null:result,result_info:{total_pages:totalPages}})};
  };
  return { requests, fetchImpl };
}
test('capacity aggregates all account projects and all pages; month boundary is UTC', async () => {
  const f=fixture(); assert.equal(await checkCloudflareCapacity({token:'fixture',accountId:'account',now,fetchImpl:f.fetchImpl}),3);
  assert.equal(f.requests.length,5); assert.ok(f.requests.some(x=>x.includes('other-site')));
  assert.ok(f.requests.some(x=>x.includes('/sam-site/deployments?per_page=100&page=2')));
});
test('near/full quota, inaccessible, malformed and duplicated capacity data fail closed', async () => {
  for (const opts of [{full:true},{fail:true},{malformed:true},{duplicate:true}]) {
    const f=fixture(opts);
    await assert.rejects(checkCloudflareCapacity({token:'fixture',accountId:'account',now,fetchImpl:f.fetchImpl}));
  }
});
test('capacity rejects malformed dates, API error envelopes and invalid pagination', async () => {
  for (const body of [
    {success:false,result:[]},
    {success:true,result:[],result_info:{total_pages:2}},
    {success:true,result:[{name:'project'}],result_info:{total_pages:'2'}},
  ]) {
    await assert.rejects(checkCloudflareCapacity({token:'fixture',accountId:'account',now,fetchImpl:async()=>({ok:true,json:async()=>body})}));
  }
  let n=0;
  await assert.rejects(checkCloudflareCapacity({token:'fixture',accountId:'account',now,fetchImpl:async()=>({ok:true,json:async()=>({success:true,result:++n===1?[{name:'project'}]:[{id:'bad',created_on:'not a date'}],result_info:{total_pages:1}})})}));
});
