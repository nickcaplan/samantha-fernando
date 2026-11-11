import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alignPreviewLabel} from '../scripts/preview-label.mjs';
const filler=Array.from({length:100},(_,i)=>({name:`label-${i}`}));
function fixture({labelled=false,failPage=false,failDelete=false}={}) {
 let present=labelled;const calls=[];
 const api=async(url,{method='GET'}={})=>{
  calls.push(method+' '+url);
  if(method==='DELETE'){if(failDelete)return{ok:false,status:403};present=false;}
  if(method==='POST')present=true;
  const page=new URL(url).searchParams.get('page');
  if(failPage&&page==='2')return{ok:false,status:503};
  return{ok:true,status:200,json:page==='1'?filler:present?[{name:'cloudflare'}]:[]};
 };
 return{api,calls};
}
const args={slug:'nickcaplan/samantha-fernando',pr:{number:77,labels:[]},label:'cloudflare',token:'fixture'};
test('readback finds labels on later pages',async()=>{
 const f=fixture();await alignPreviewLabel({...args,...f,route:'cloudflare'});
 assert.equal(f.calls.filter(x=>x.startsWith('POST')).length,1);
 assert.equal(f.calls.filter(x=>x.includes('page=2')).length,2);
});
test('confirmed absent label does not need a write',async()=>{
 const f=fixture();await alignPreviewLabel({...args,...f,route:'netlify'});
 assert.ok(f.calls.every(x=>x.startsWith('GET')));
});
test('later-page existing label is removed and rechecked',async()=>{
 const f=fixture({labelled:true});await alignPreviewLabel({...args,...f,route:'netlify'});
 assert.equal(f.calls.filter(x=>x.startsWith('DELETE')).length,1);
});
test('later-page failure and denied removal fail closed',async()=>{
 for(const options of [{failPage:true},{labelled:true,failDelete:true}]) {
  const f=fixture(options);await assert.rejects(alignPreviewLabel({...args,...f,route:'netlify'}));
 }
});
