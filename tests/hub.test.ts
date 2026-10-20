import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnerClient,OwnerApiError } from '../apps/hub/lib/owner-client';
import { recoverSavedRun,readWorkspace } from '../apps/hub/lib/workflow';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { exerciseHub } from './helpers/hub-contract';
test('owner client keeps keys out of URLs, bodies and serialization and never forwards to a remote origin',async()=>{
 const token='d'.repeat(64);let calls=0;
 const transport:typeof fetch=async(url,init)=>{calls++;assert.equal(new URL(String(url)).origin,'http://127.0.0.1:3000');assert.ok(!String(url).includes(token));assert.ok(!String(init?.body).includes(token));assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');return Response.json({data:{ok:true}});};
 for(const origin of ['https://example.com','http://127.0.0.1:3000/path','http://user@localhost','http://127.0.0.1:3000/?key=x'])assert.throws(()=>new OwnerClient(origin,token,transport));
 const client=new OwnerClient('http://127.0.0.1:3000',token,transport);assert.ok(!JSON.stringify(client).includes(token));assert.deepEqual(await client.call('GET','/system'),{ok:true});
 for(const path of ['//example.com','https://example.com','/../system','/projects#fragment','/\\example.com'])await assert.rejects(client.call('GET',path));assert.equal(calls,1);
 client.close();await assert.rejects(client.call('GET','/system'));assert.equal(calls,1);
});
test('browser transport is called with the global receiver required by native fetch',async()=>{
 const transport:typeof fetch=async function(this:unknown){assert.equal(this,globalThis);return Response.json({data:{connected:true}});};
 const client=new OwnerClient('http://localhost:3000','d'.repeat(64),transport);try{assert.deepEqual(await client.call('GET','/system'),{connected:true});}finally{client.close();}
});
test('locking aborts pending reads and an uncooperative late response cannot return owner data',async()=>{
 let release!:()=>void,seen!:()=>void,signal:AbortSignal|undefined;const entered=new Promise<void>(r=>seen=r),gate=new Promise<void>(r=>release=r);
 const client=new OwnerClient('http://localhost:3000','d'.repeat(64),async(_url,init)=>{signal=init?.signal??undefined;seen();await gate;return Response.json({data:{private:'late'}});});
 const pending=client.call('GET','/system');await entered;client.close();assert.equal(signal?.aborted,true);release();await assert.rejects(pending);
});
test('client errors do not display raw server error text and missing plan is distinct from failed storage',async()=>{
 const client=new OwnerClient('http://localhost:3000','d'.repeat(64),async()=>Response.json({error:{code:'STATE_CONFLICT',message:'private-driver-error'}},{status:409}));
 await assert.rejects(client.call('POST','/projects',{}),(e:unknown)=>e instanceof OwnerApiError&&!e.message.includes('private-driver-error')&&e.status===409);client.close();
 const reader=new OwnerClient('http://localhost:3000','d'.repeat(64),async(url)=>{
  const path=new URL(String(url)).pathname;
  if(path.endsWith('/plan')||path.endsWith('/execution'))return Response.json({error:{code:'NOT_FOUND'}},{status:404});
  return Response.json({data:path.endsWith('/jobs')||path.endsWith('/agents')?{items:[],nextCursor:null}:{id:'run',status:'queued',version:0}});
 });assert.equal((await readWorkspace(reader,'run')).plan,null);reader.close();
});
test('Hub workflow through authenticated core API',{timeout:120000},async t=>{
 const db=await createEmbeddedDatabase();try{await migrate(db);await exerciseHub(db,t);}finally{await db.close();}
});

test('network and unreadable replies are bounded and never retry a mutation',async()=>{
 for(const transport of [async()=>{throw new Error('private connection details');},async()=>new Response('not-json')]){
  let calls=0;const client=new OwnerClient('http://localhost:3000','d'.repeat(64),async()=>{calls++;return transport();});
  await assert.rejects(client.call('POST','/projects',{}),(error:unknown)=>error instanceof OwnerApiError&&['CONNECTION_LOST','RESPONSE_UNREADABLE'].includes(error.code)&&!error.message.includes('private'));
  assert.equal(calls,1);client.close();
 }
});

test('saved-run recovery validates identity and only reads results, including uncertain calls',async()=>{
 const id='run_12345678-1234-4123-8123-123456789abc';const paths:string[]=[];
 const client=new OwnerClient('http://localhost:3000','d'.repeat(64),async(url,init)=>{
  assert.equal(init?.method,'GET');const path=new URL(String(url)).pathname;paths.push(path);
  let data:unknown={id,projectId:'project',status:'running'};
  if(path.endsWith('/jobs'))data={items:[{id:'job_saved',attempt:1},{id:'job_pending',attempt:0}],nextCursor:null};
  else if(path.endsWith('/agents'))data={items:[],nextCursor:null};
  else if(path.endsWith('/result'))data={status:'running',text:null,recoveryRequired:true};
  return Response.json({data});
 });
 await assert.rejects(recoverSavedRun(client,'project','../system'));assert.equal(paths.length,0);
 await assert.rejects(recoverSavedRun(client,'wrong-project',id));assert.equal(paths.length,1);
 const saved=await recoverSavedRun(client,'project',id);assert.equal(saved.results.job_saved.recoveryRequired,true);assert.equal(saved.results.job_pending,undefined);
 assert.equal(paths.filter(p=>p.endsWith('/result')).length,1);client.close();
});
