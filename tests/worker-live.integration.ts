import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
import { createPostgresDatabase } from '../packages/database/src';
import { localOrigin } from '../packages/core/src/api/auth';
import { workerFixture } from './helpers/worker-contract';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const token=process.env.LEEOS_API_TOKEN,url=process.env.DATABASE_URL;
if(!token||!/^[a-f0-9]{64}$/.test(token)||!url)throw Error('Configure a dedicated migrated local database and owner API for this live test.');
const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
test('real prepared jobs execute through production owner API and require owner review',{timeout:90000},async()=>{
 const db=createPostgresDatabase(url!);
 const call=async(method:string,path:string,body?:unknown)=>{
  const response=await fetch(origin+'/api/v1'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000),redirect:'error'});
  const envelope=await response.json();assert.equal(response.status,200,JSON.stringify(envelope));return envelope.data;
 };
 try{
  const status=await call('GET','/providers/local');assert.equal(status.connection,'ready');
  const f=await workerFixture(db,status.modelFingerprint),base=`/runs/${f.run.id}/jobs/`;
  const first=await call('POST',base+f.job('draft')+'/execute',f.requests.draft);assert.equal(first.status,'succeeded');assert.ok(first.text.length>0);
  assert.deepEqual(await call('POST',base+f.job('draft')+'/execute',f.requests.draft),first);
  assert.equal((await call('POST',base+f.job('check')+'/execute',{...f.requests.check,expectedRunVersion:1})).status,'succeeded');
  assert.equal((await f.store.getRun(f.run.id))?.status,'running');
  assert.equal((await call('POST',base+f.job('review')+'/review',f.review)).status,'succeeded');
  assert.equal((await f.store.getRun(f.run.id))?.status,'succeeded');
  const usage=(await db.query('SELECT * FROM model_usage WHERE run_id=$1',[f.run.id])).rows;
  assert.equal(usage.length,2);assert.ok(usage.every(u=>u.agent_id&&Number(u.input_tokens)>0&&Number(u.output_tokens)>0&&Number(u.cost_usd)===0));
 }finally{await db.close();}
});
