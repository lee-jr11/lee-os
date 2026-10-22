import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate,readMigrations} from '../packages/database/src/migrations';
import {createGeminiAdapter,geminiModelId} from '../packages/providers/src/gemini';
import {createGeminiProviderManager} from '../packages/core/src/provider-manager/gemini';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {runEnvelopeWorkerOnce} from '../packages/core/src/envelope-worker/runner';
import type {CapabilityPlan} from '../packages/core/src/orchestrator/capability-plan';
import {envelopeFixture,authorizedInput} from './helpers/envelope-contract';
import {envelopeDigest,gemini503RetryPolicy} from '../packages/core/src/execution-envelope';
import {envelopeRequirements} from './helpers/envelope-contract';

function remoteAdapter(){
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),credentials={apiKey:'gemini-test-secret',serviceAccountJson:JSON.stringify({type:'service_account',project_id:'leeos-test',client_email:'leeos-test@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 let billingEnabled=false,generations=0,generationTransportFailures=0;const generationStatuses:number[]=[],prompts:string[]=[];
 const adapter=createGeminiAdapter({credentials:()=>credentials,transport:async(url,init)=>{
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'gemini-test-access-token-long-enough',expires_in:3600});
  if(url.startsWith('https://apikeys.googleapis.com/v2/keys:lookupKey?'))return Response.json({parent:'projects/987654321/locations/global',name:'projects/987654321/locations/global/keys/test'});
  if(url==='https://apikeys.googleapis.com/v2/projects/987654321/locations/global/keys/test')return Response.json({restrictions:{apiTargets:[{service:'generativelanguage.googleapis.com'}]}});
  if(url==='https://cloudbilling.googleapis.com/v1/projects/987654321/billingInfo')return Response.json({projectId:'leeos-test',billingEnabled,...(billingEnabled?{billingAccountName:'billingAccounts/987-654'}:{})});
  if(url===`https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}`)return Response.json({name:`models/${geminiModelId}`,version:'test-pinned-model',inputTokenLimit:32768,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']});
  if(url.endsWith(':countTokens')){const body=JSON.parse(String(init.body)) as {contents:{parts:{text:string}[]}[]};prompts.push(body.contents[0].parts[0].text);return Response.json({totalTokens:4});}
  if(url.endsWith(':generateContent')){generations++;if(generationTransportFailures>0){generationTransportFailures--;throw Error('connection lost after dispatch');}const status=generationStatuses.shift();if(status)return new Response(null,{status});return Response.json({candidates:[{content:{parts:[{text:'Remote durable result'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:4,candidatesTokenCount:3,totalTokenCount:7}});}
  throw Error('Unexpected Gemini transport request.');
 }});
 return {adapter,setBillingEnabled:(v:boolean)=>{billingEnabled=v;},setGenerationStatuses:(...statuses:number[])=>generationStatuses.push(...statuses),setGenerationTransportFailures:(count:number)=>{generationTransportFailures=count;},get generations(){return generations;},prompts,credentials};
}

async function fixture(testName:string,retryable503=false){
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'leeos-gemini-'+testName+'-'));const db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db,await readMigrations());const remote=remoteAdapter(),probe=await remote.adapter.probe();
  const base=await envelopeFixture(db,envelopeRequirements,{provider:probe.provider,fingerprint:probe.fingerprint,location:'remote'},retryable503),input=await authorizedInput(base),receipt=await base.manager.accept(base.run.id,input);
  const provider=createGeminiProviderManager({enabled:()=>true,adapter:remote.adapter});
  return {db,dir,root,base,remote,provider,receipt,async cleanup(){await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-gemini-'+testName+'-'))throw Error('Unsafe test cleanup');await rm(absolute,{recursive:true,force:true});}};
 }catch(error){await db.close();const absolute=resolve(dir);if(absolute.startsWith(root+sep))await rm(absolute,{recursive:true,force:true});throw error;}
}

test('remote Gemini uses the accepted envelope worker and records exact free-tier usage evidence',{timeout:120000},async()=>{
 const f=await fixture('success');
 try{
  assert.equal(f.receipt.envelope.constraints.location,'remote');assert.equal(f.receipt.envelope.operations[0].implementationContractVersion,'gemini-free-text-1');
  const plan=f.base.saved.plan as CapabilityPlan,decision=plan.capabilities.find(capability=>capability.id==='text_generation')?.route;assert.deepEqual(decision?.selected,{implementationId:'model-router',providerId:'gemini',modelId:geminiModelId});
  const result=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_remote_gemini',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(result.status,'waiting-human');assert.equal(f.remote.generations,1);
  const work=await createEnvelopeWorkerStore(f.db).get(f.receipt.id);assert.equal(work.operations[0].state,'succeeded');assert.equal(work.operations[0].outputText,'Remote durable result');assert.equal(work.operations[0].providerId,'gemini');
  const usage=(await f.db.query('SELECT * FROM model_usage WHERE run_id=$1',[f.base.run.id])).rows[0];assert.ok(usage);assert.equal(usage.provider_id,'gemini');assert.equal(usage.model_id,geminiModelId);
  assert.equal(Number(usage.input_tokens),4);assert.equal(Number(usage.output_tokens),3);assert.equal(Number(usage.cost_usd),0);assert.equal(usage.cost_status,'verified-zero');
  assert.equal(usage.cost_evidence_ref,'google-project-billing-disabled');assert.equal(usage.cost_account_scope,'google-project-987654321');assert.ok(usage.cost_evidence_checked_at);
  const events=(await f.db.query('SELECT payload FROM events WHERE run_id=$1',[f.base.run.id])).rows;assert.equal(JSON.stringify(events).includes(f.remote.credentials.apiKey),false);assert.equal(JSON.stringify(events).includes('Exact fixture prompt'),false);
  assert.equal((await f.provider.getCall(f.db,String(work.operations[0].callId))).costStatus,'verified-zero');
 }finally{await f.cleanup();}
});

test('a billing change between acceptance and claim blocks remote dispatch and leaves work recoverable',{timeout:120000},async()=>{
 const f=await fixture('billing-change');
 try{
  f.remote.setBillingEnabled(true);
  const result=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_cost_blocked',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(result.status,'queued');assert.equal(f.remote.generations,0);assert.equal((await f.db.query('SELECT id FROM provider_calls')).rows.length,0);
  const state=await createEnvelopeWorkerStore(f.db).get(f.receipt.id);assert.equal(state.reason,'PROVIDER_ZERO_COST_OR_AVAILABILITY_BLOCKED');assert.equal(state.operations[0].state,'pending');
 }finally{await f.cleanup();}
});

test('a received Gemini 503 schedules one fresh ZERO_ONLY attempt only under the digest-covered v2 policy',{timeout:120000},async()=>{
 const f=await fixture('transient-retry',true);
 try{
  const authorized=f.receipt.envelope.operations[0];if(authorized.kind!=='text.generate')throw Error('Text operation expected.');assert.equal(authorized.implementationContractVersion,'gemini-free-text-2');assert.deepEqual(authorized.providerRetryPolicy,gemini503RetryPolicy);assert.equal(f.receipt.envelope.authorization.maxAttempts,2);assert.equal(f.receipt.digest,envelopeDigest(f.receipt.envelope));
  const changed=structuredClone(f.receipt.envelope) as unknown as {operations:{providerRetryPolicy:{retryableReason:string}}[]};changed.operations[0].providerRetryPolicy.retryableReason='GEMINI_HTTP_502';assert.notEqual(envelopeDigest(changed),f.receipt.digest);
  f.remote.setGenerationStatuses(503);
  const first=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_503_first',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(first.status,'queued');assert.equal(f.remote.generations,1);
  const scheduled=await createEnvelopeWorkerStore(f.db).get(f.receipt.id);assert.equal(scheduled.operations[0].state,'pending');assert.equal(scheduled.operations[0].callId,null);assert.equal(scheduled.reason,'GEMINI_HTTP_503_RETRY_SCHEDULED');
  const retryEvent=(await f.db.query("SELECT payload FROM events WHERE entity_id=$1 AND kind='envelope-operation.transient-retry-scheduled' LIMIT 1",[f.receipt.id])).rows[0],retryPayload=typeof retryEvent.payload==='string'?JSON.parse(retryEvent.payload):retryEvent.payload as Record<string,unknown>;assert.equal(retryPayload.delayMs,5000);assert.deepEqual(retryPayload.retryPolicy,gemini503RetryPolicy);
  const firstAttempt=(await f.db.query('SELECT a.attempt_number,a.call_id,p.request_key,p.status,p.error_code,p.retryable,p.recovery_required FROM envelope_operation_attempts a JOIN provider_calls p ON p.id=a.call_id WHERE a.envelope_id=$1 ORDER BY a.attempt_number',[f.receipt.id])).rows;
  assert.equal(firstAttempt.length,1);assert.equal(firstAttempt[0].attempt_number,1);assert.equal(firstAttempt[0].request_key,`${f.receipt.id}:draft`);assert.equal(firstAttempt[0].status,'failed');assert.equal(firstAttempt[0].error_code,'GEMINI_HTTP_503');assert.equal(firstAttempt[0].retryable,true);assert.equal(firstAttempt[0].recovery_required,false);

  await f.db.query('UPDATE envelope_work SET available_at=clock_timestamp() WHERE envelope_id=$1',[f.receipt.id]);
  const second=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_503_second',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(second.status,'waiting-human');assert.equal(f.remote.generations,2);
  const attempts=(await f.db.query('SELECT a.attempt_number,a.call_id,p.request_key,p.status,p.error_code,p.retryable,p.recovery_required FROM envelope_operation_attempts a JOIN provider_calls p ON p.id=a.call_id WHERE a.envelope_id=$1 ORDER BY a.attempt_number',[f.receipt.id])).rows;
  assert.equal(attempts.length,2);assert.notEqual(attempts[0].call_id,attempts[1].call_id);assert.equal(attempts[1].attempt_number,2);assert.equal(attempts[1].request_key,`${f.receipt.id}:draft:attempt:2`);assert.equal(attempts[1].status,'succeeded');
  const work=await createEnvelopeWorkerStore(f.db).get(f.receipt.id);assert.equal(work.operations[0].state,'succeeded');assert.equal(work.operations[0].outputText,'Remote durable result');assert.equal(work.operations[0].callId,attempts[1].call_id);
  assert.equal((await f.db.query('SELECT id FROM model_usage WHERE run_id=$1',[f.base.run.id])).rows.length,1);
  assert.equal(JSON.stringify(await f.db.query('SELECT payload FROM events WHERE run_id=$1',[f.base.run.id])).includes('GEMINI_HTTP_503'),true);
 }finally{await f.cleanup();}
});

test('a second received Gemini 503 exhausts the authorized v2 limit without producing usage or a third call',{timeout:120000},async()=>{
 const f=await fixture('transient-exhausted',true);
 try{
  f.remote.setGenerationStatuses(503,503);
  const first=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_503_limit_1',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(first.status,'queued');
  await f.db.query('UPDATE envelope_work SET available_at=clock_timestamp() WHERE envelope_id=$1',[f.receipt.id]);
  const second=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_503_limit_2',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(second.status,'failed');assert.equal(f.remote.generations,2);
  const attempts=(await f.db.query('SELECT a.attempt_number,a.call_id,p.status,p.error_code,p.retryable,p.recovery_required FROM envelope_operation_attempts a JOIN provider_calls p ON p.id=a.call_id WHERE a.envelope_id=$1 ORDER BY a.attempt_number',[f.receipt.id])).rows;
  assert.equal(attempts.length,2);assert.ok(attempts.every(row=>row.status==='failed'&&row.error_code==='GEMINI_HTTP_503'&&row.retryable===true&&row.recovery_required===false));
  assert.equal((await f.db.query('SELECT id FROM model_usage WHERE run_id=$1',[f.base.run.id])).rows.length,0);
  assert.equal((await runEnvelopeWorkerOnce(f.db,{workerId:'worker_503_limit_3',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0})).status,'idle');assert.equal(f.remote.generations,2);
 }finally{await f.cleanup();}
});

test('an already-accepted v1 Gemini envelope never retries a received 503',{timeout:120000},async()=>{
 const f=await fixture('v1-no-retry');
 try{
  const operation=f.receipt.envelope.operations[0];if(operation.kind!=='text.generate')throw Error('Text operation expected.');assert.equal(operation.implementationContractVersion,'gemini-free-text-1');assert.equal(operation.providerRetryPolicy,undefined);assert.equal(f.receipt.envelope.authorization.maxAttempts,1);
  f.remote.setGenerationStatuses(503,200);
  const first=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_v1_503',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(first.status,'failed');assert.equal(f.remote.generations,1);
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM envelope_operation_attempts WHERE envelope_id=$1',[f.receipt.id])).rows[0].count,1);
  assert.equal((await runEnvelopeWorkerOnce(f.db,{workerId:'worker_v1_no_retry_again',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0})).status,'idle');assert.equal(f.remote.generations,1);
 }finally{await f.cleanup();}
});

test('v2 revalidates ZERO_ONLY billing before scheduling the authorized retry',{timeout:120000},async()=>{
 const f=await fixture('retry-revalidation',true);
 try{
  f.remote.setGenerationStatuses(503);
  assert.equal((await runEnvelopeWorkerOnce(f.db,{workerId:'worker_revalidation_first',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0})).status,'queued');
  f.remote.setBillingEnabled(true);await f.db.query('UPDATE envelope_work SET available_at=clock_timestamp() WHERE envelope_id=$1',[f.receipt.id]);
  const second=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_revalidation_second',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(second.status,'queued');assert.equal(f.remote.generations,1);
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM envelope_operation_attempts WHERE envelope_id=$1',[f.receipt.id])).rows[0].count,1);
  assert.equal((await f.db.query('SELECT count(*)::int AS count FROM model_usage WHERE run_id=$1',[f.base.run.id])).rows[0].count,0);
  assert.equal((await createEnvelopeWorkerStore(f.db).get(f.receipt.id)).reason,'PROVIDER_ZERO_COST_OR_AVAILABILITY_BLOCKED');
 }finally{await f.cleanup();}
});

test('a lost generation response remains recovery-required and is never retried automatically',{timeout:120000},async()=>{
 const f=await fixture('lost-response');
 try{
  f.remote.setGenerationTransportFailures(1);
  const first=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_lost_response',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal(first.status,'recovery-required');assert.equal(f.remote.generations,1);
  const call=(await f.db.query('SELECT p.status,p.error_code,p.retryable,p.recovery_required FROM envelope_operation_attempts a JOIN provider_calls p ON p.id=a.call_id WHERE a.envelope_id=$1',[f.receipt.id])).rows[0];
  assert.equal(call.status,'interrupted');assert.equal(call.error_code,'GEMINI_CONNECTION_FAILED');assert.equal(call.retryable,false);assert.equal(call.recovery_required,true);
  assert.equal((await f.db.query('SELECT id FROM model_usage WHERE run_id=$1',[f.base.run.id])).rows.length,0);
  assert.equal((await runEnvelopeWorkerOnce(f.db,{workerId:'worker_lost_response_second',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,backoffMs:0})).status,'idle');
  assert.equal((await createEnvelopeWorkerStore(f.db).get(f.receipt.id)).state,'recovery-required');assert.equal(f.remote.generations,1);
 }finally{await f.cleanup();}
});
