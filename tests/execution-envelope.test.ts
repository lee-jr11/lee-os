import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {envelopeDraft,envelopeAccept,envelopeDigest} from '../packages/core/src/execution-envelope';
import {createEnvelopeManager} from '../packages/core/src/execution-envelope/store';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate,readMigrations} from '../packages/database/src/migrations';
import {createStateStore} from '../packages/database/src';
import {createPlanner} from '../packages/core/src/orchestrator/store';
import {handleCoreRequest} from '../packages/core/src/api/http';
import {exerciseEnvelopes,envelopeFixture,authorizedInput} from './helpers/envelope-contract';
const base={expectedRunVersion:0,reviewedPlanDigest:'a'.repeat(64),grantExpiresAt:'2026-10-19T13:00:00.000Z',
 constraints:{location:'local',network:'loopback-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0},
 operations:[{key:'draft',kind:'text.generate',requirementIds:['content'],dependsOn:[],input:{source:'literal',text:'  Exact whitespace\n'},maxOutputTokens:32,modelFingerprint:'b'.repeat(64)}],acceptanceBindings:[{criterionId:'generated',operationKey:'draft'}]};
test('envelopes accept only bounded typed data and explicit exact authorization',()=>{
 assert.equal(envelopeDraft.safeParse(base).success,true);assert.deepEqual(envelopeDraft.parse(base).operations[0],base.operations[0]);
 for(const extra of [{dispatchEnabled:true},{permissions:['shell']},{providerRegistry:[]},{constraints:{...base.constraints,spendLimitUsd:1}},{constraints:{...base.constraints,maxAttempts:2}},
  {operations:[{...base.operations[0],kind:'shell'}]},{operations:[{...base.operations[0],input:{source:'file',path:'C:/secret'}}]},
  {operations:[{...base.operations[0],input:{source:'literal',text:'🙂'.repeat(4096)}}]}, {operations:[{...base.operations[0],maxOutputTokens:129}]},
  {acceptanceBindings:[]}
 ])assert.equal(envelopeDraft.safeParse({...base,...extra}).success,false);
 const accept={...base,idempotencyKey:'one',reviewedEnvelopeDigest:'c'.repeat(64),acknowledgeAuthorization:true};assert.equal(envelopeAccept.safeParse(accept).success,true);
 assert.equal(envelopeAccept.safeParse({...accept,acknowledgeAuthorization:false}).success,false);
 assert.equal(envelopeDigest({a:1,b:2}),envelopeDigest({b:2,a:1}));assert.notEqual(envelopeDigest(base),envelopeDigest({...base,grantExpiresAt:'2026-10-19T14:00:00Z'}));
});
test('envelope API enforces owner access, methods and strict schemas before opening storage',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opens=0;
 const options={origin,token,database:()=>{opens++;throw Error('Do not open');}};
 const call=(method:string,path:string,body?:unknown,auth=token)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:auth?'Bearer '+auth:'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),options);
 const path='/runs/run_12345678-1234-4234-8234-123456789abc/execution-envelope';
 assert.equal((await call('POST',path,base,'')).status,401);assert.equal((await call('POST',path,base)).status,400);
 assert.equal((await call('POST',path+'/preview',{...base,permissions:['network']})).status,400);
 assert.equal((await call('GET',path+'?dispatch=true')).status,400);assert.equal((await call('DELETE',path)).status,405);
 assert.equal((await call('POST','/execution-envelopes/env_12345678-1234-4234-8234-123456789abc/revoke',{reviewedEnvelopeDigest:'a'.repeat(64),reason:'Stop',acknowledgeRevocation:false})).status,400);
 assert.equal(opens,0);
});
test('P0.3 additive upgrade, exact acceptance and recovery after database/process close',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'leeos-envelopes-'));let db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db,(await readMigrations()).slice(0,9));const old=await envelopeFixture(db),legacyRun=await old.state.getRun(old.run.id),legacyEvents=await old.state.listEvents(old.project.id);
  assert.deepEqual(await migrate(db),['010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_transient_retries.sql']);assert.deepEqual(await old.state.getRun(old.run.id),legacyRun);assert.deepEqual(await old.state.listEvents(old.project.id),legacyEvents);assert.deepEqual(await createPlanner(db).get(old.run.id),old.saved);
  await exerciseEnvelopes(db,t);
  const f=await envelopeFixture(db),input=await authorizedInput(f),before=await f.manager.accept(f.run.id,input);
  await db.close();db=await createEmbeddedDatabase(dir);assert.deepEqual(await migrate(db),[]);
  const recovered=await createEnvelopeManager(db).forRun(f.run.id);assert.deepEqual(recovered,before);assert.equal(recovered.digest,envelopeDigest(recovered.envelope));
  assert.equal((await createStateStore(db).listJobs(f.run.id)).items.length,0);
  assert.deepEqual(await createEnvelopeManager(db).accept(f.run.id,input),before);
  const origin='http://127.0.0.1:3000',token='a'.repeat(64);
  const response=await handleCoreRequest(new Request(`${origin}/api/v1/execution-envelopes/${before.id}`,{headers:{Host:'127.0.0.1:3000',Authorization:'Bearer '+token}}),{origin,token,database:()=>db});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).data,before);
  const oldEnvelope=(await createEnvelopeManager(db).accept(old.run.id,await authorizedInput({...old,manager:createEnvelopeManager(db)}))).envelope;
  assert.equal(oldEnvelope.contract.revision,1);
 }finally{await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-envelopes-'))throw Error('Unsafe cleanup');await rm(absolute,{recursive:true,force:true});}
});
