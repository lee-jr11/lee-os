import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { createLocalAdapter,localHttp } from '../packages/providers/src/local';
import { createLocalProviderManager } from '../packages/core/src/provider-manager/service';
import { localGenerateRequest } from '../packages/core/src/provider-manager';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { exerciseLocalProvider,fixtureTransport } from './helpers/local-provider-contract';
test('local adapter allows only fixed protocol paths and validates capacity/usage',async()=>{
 await assert.rejects(localHttp('https://example.com/'));await assert.rejects(localHttp('/api/pull'));
 const fixture=fixtureTransport(),adapter=createLocalAdapter(fixture.transport);
 assert.equal((await adapter.probe()).provider.models[0].capabilities[0],'text');
 assert.deepEqual(await adapter.tokenize('hello'),[1,2,3]);assert.equal((await adapter.generate([1,2,3],2)).outputTokens,2);
 for(const replacement of [
  {model_path:'https://paid.example/model.gguf',build_info:'x',total_slots:1,default_generation_settings:{n_ctx:512}},
  {model_path:'model.gguf',build_info:'x',total_slots:2,default_generation_settings:{n_ctx:512}}
 ]){
  const bad=createLocalAdapter(async(path,body,signal)=>path==='/props'?replacement:fixture.transport(path,body,signal));await assert.rejects(bad.probe());
 }
 const mismatch=createLocalAdapter(async()=>({content:'bad',tokens_evaluated:3,tokens_predicted:999,truncated:false,stop:true}));await assert.rejects(mismatch.generate([1,2,3],2));
});
test('local endpoints require owner authentication, explicit opt-in and strict bodies before storage',async()=>{
 const body={prompt:'Hello',maxOutputTokens:16,idempotencyKey:'test'};
 for(const extra of [{baseUrl:'https://example.com'},{model:'remote'},{maxOutputTokens:129},{prompt:'x'.repeat(8193)},{costUsd:0},{permissions:['network']}])assert.equal(localGenerateRequest.safeParse({...body,...extra}).success,false);
 const token='a'.repeat(64),origin='http://127.0.0.1:3000';let opened=0;const manager=createLocalProviderManager({enabled:()=>false});
 const options={token,origin,localProvider:manager,database:()=>{opened++;throw Error('No database');}};
 const call=(method:string,path:string,input?:unknown,headers:Record<string,string>={})=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:input===undefined?undefined:JSON.stringify(input)}),options);
 const status=await call('GET','/providers/local');assert.equal(status.status,200);assert.equal((await status.json()).data.connection,'disabled');
 assert.equal((await call('POST','/providers/local/calls',body)).status,503);
 assert.equal((await call('POST','/providers/local/calls',body,{Authorization:''})).status,401);
 assert.equal((await call('POST','/providers/local/calls',body,{Origin:'https://example.com'})).status,403);
 assert.equal((await call('POST','/providers/local/calls',{...body,baseUrl:'https://example.com'})).status,400);
 assert.equal((await call('POST','/providers/local/recover',{acknowledgeServerRestart:false})).status,400);assert.equal(opened,0);
});
test('local calls, upgrade and clean-close ledger durability',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-provider-'));let db=await createEmbeddedDatabase(directory);
 try{
  const files=await readMigrations();await migrate(db,files.slice(0,4));assert.deepEqual(await migrate(db),['005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql']);
  await exerciseLocalProvider(db,t);
  const fixture=fixtureTransport(),manager=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(fixture.transport)});
  const input={prompt:'Durable provider result',maxOutputTokens:16,idempotencyKey:'durable-result'};const result=await manager.generate(db,input);
  await db.close();db=await createEmbeddedDatabase(directory);
  const reopened=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(async()=>{throw Error('Replay must not contact provider');})});
  assert.deepEqual(await reopened.generate(db,input),result);
 }finally{await db.close();const absolute=resolve(directory);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-provider-'))throw Error('Unsafe cleanup');await rm(absolute,{recursive:true,force:true});}
});
