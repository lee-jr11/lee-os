import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {createStateStore} from '../packages/database/src';
import {migrate} from '../packages/database/src/migrations';
import {createRequirementsManager} from '../packages/core/src/requirements/store';
import type {RequirementsContent} from '../packages/core/src/requirements';
import {createPlanner} from '../packages/core/src/orchestrator/store';
import {planDigest} from '../packages/core/src/execution-manager';
import {createEnvelopeManager} from '../packages/core/src/execution-envelope/store';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {runEnvelopeWorkerOnce} from '../packages/core/src/envelope-worker/runner';
import {handleCoreRequest} from '../packages/core/src/api/http';
import type {EnvelopeEmailDelivery} from '../packages/core/src/envelope-worker/store';
import type {EnvelopeProviderManager} from '../packages/core/src/provider-manager';
import type {ResendEmailRequest,ResendInspection,ResendSendResult} from '../packages/providers/src';

const address='lee@example.com';
const content:RequirementsContent={goal:'Send the exact approved message to the specified recipient.',
 requirements:[{id:'delivery',statement:'Send this exact message through the approved email provider.',required:true,capabilityIds:['approved_delivery']}],
 inputs:[],outputs:[{id:'mail',description:'Email delivered to the recipient mail server.'}],assumptions:[],questions:[],constraints:[],capabilities:['approved_delivery'],costPolicy:'ZERO_ONLY',
 acceptanceCriteria:[{id:'delivered',description:'The recipient mail server accepted the email.',required:true,requirementIds:['delivery'],evidenceKind:'delivery-confirmation'}]};
const inspection:ResendInspection={eligible:true,confirmationReady:true,reason:'RESEND_DOMAIN_VERIFIED_AND_ZERO_COST_OWNER_ATTESTED',checkedAt:new Date().toISOString(),validUntil:new Date(Date.now()+300000).toISOString(),costStatus:'owner-attested-zero',costEvidenceRef:'resend-free-plan-owner-attestation:test',from:'Lee <noreply@example.com>'};
const idleProvider:EnvelopeProviderManager={providerId:'unused',inspect:async()=>({connection:'disabled'}),generate:async()=>{throw Error('Text provider must not run in an email-only envelope.');}};
async function fixture(){
 const db=await createEmbeddedDatabase();await migrate(db);
 const state=createStateStore(db),requirements=createRequirementsManager(db),project=await state.createProject('P1.3 email '+randomUUID()),run=await state.createRun(project.id),doc=await requirements.create(project.id,{content,idempotencyKey:randomUUID()});
 await requirements.review(doc.id,{revision:1,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true});
 await requirements.bind(run.id,{requirementsId:doc.id,revision:1,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true});
 const saved=await createPlanner(db,{routing:()=>({emailDelivery:inspection})}).create(run.id,{mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:doc.digest});
 const draft={expectedRunVersion:0,reviewedPlanDigest:planDigest(run.id,0,saved.plan),grantExpiresAt:new Date(Date.now()+3600000).toISOString(),contractInputs:{},
  constraints:{location:'remote' as const,network:'provider-allowlist-only' as const,externalEffects:'approved-email-only' as const,maxAttempts:1 as const,maxInputBytes:8192 as const,spendLimitUsd:0 as const},
  operations:[{key:'send',kind:'email.send' as const,requirementIds:['delivery'],dependsOn:[],to:address,subject:{source:'literal' as const,text:'A reusable LeeOS delivery'},text:{source:'literal' as const,text:'This is a fixture message; no email is sent in tests.'},attachments:[],deliveryPolicy:'verified-zero-only' as const}],
  acceptanceBindings:[{criterionId:'delivered',operationKey:'send'}]};
 const manager=createEnvelopeManager(db),preview=await manager.preview(run.id,draft);assert.equal(preview.canAccept,true,JSON.stringify(preview.blockers));
 const input={...draft,idempotencyKey:randomUUID(),reviewedEnvelopeDigest:preview.digest!,acknowledgeAuthorization:true as const},receipt=await manager.accept(run.id,input);
 return {db,state,requirements,project,run,doc,manager,saved,draft,input,receipt};
}
function fakeEmail(options:{retryOnce?:boolean;eligible?:boolean}={}):EnvelopeEmailDelivery&{requests:()=>number;effects:()=>number;keys:()=>string[]}{
 const seen=new Map<string,string>();let requests=0;
 return {requests:()=>requests,effects:()=>seen.size,keys:()=>[...seen.keys()],inspect:async()=>({...inspection,eligible:options.eligible??true,reason:options.eligible===false?'FRESH_ZERO_COST_OWNER_ATTESTATION_REQUIRED':inspection.reason}),
  send:async(_request:ResendEmailRequest,key:string):Promise<ResendSendResult>=>{requests++;let id=seen.get(key);if(!id){id='resend_'+randomUUID();seen.set(key,id);}
   if(options.retryOnce&&requests===1)return {kind:'retryable',reason:'RESEND_TRANSPORT_OUTCOME_AMBIGUOUS'};
   return {kind:'accepted',emailId:id};}};
}
function signedWebhook(secret:string,eventId:string,body:string,timestamp=String(Math.floor(Date.now()/1000))){
 const key=Buffer.from(secret.slice(6),'base64'),signature=createHmac('sha256',key).update(`${eventId}.${timestamp}.${body}`).digest('base64');
 return {id:eventId,timestamp,signature:`v1,${signature}`};
}
function webhookPayload(effectId:string,emailId:string,type='email.delivered'){
 return JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:emailId,to:[address],tags:{leeos_effect:effectId}}});
}
function webhookRequest(body:string,secret:string,eventId=`evt_${randomUUID()}`,signedBody=body){
 const signed=signedWebhook(secret,eventId,signedBody);
 return new Request('https://leeos.example/api/v1/webhooks/resend',{method:'POST',headers:{'Content-Type':'application/json','svix-id':signed.id,'svix-timestamp':signed.timestamp,'svix-signature':signed.signature},body});
}

test('email delivery is opt-in, durable, owner-scoped and only confirmed by a signed recipient receipt',{timeout:120000},async()=>{
 const f=await fixture();try{
  const email=fakeEmail(),store=createEnvelopeWorkerStore(f.db,{backoffMs:0,emailDelivery:email,artifactStorageEnabled:()=>false});
  const worked=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_email_send',enabled:()=>true,provider:idleProvider,emailDelivery:email,artifactStorageEnabled:()=>false,backoffMs:0,envelopeId:f.receipt.id});
  assert.equal(worked.status,'waiting-external');assert.equal(email.effects(),1);
  let effect=(await f.db.query('SELECT * FROM external_effects WHERE envelope_id=$1',[f.receipt.id])).rows[0];
  assert.equal(effect.state,'accepted');assert.equal(effect.provider_id,'resend');assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'pending');
  const work=await store.get(f.receipt.id);assert.equal(work.operations[0].state,'dispatched');assert.equal(work.operations[0].externalEffectState,'accepted');assert.ok(work.operations[0].externalEffectId);
  const events=await f.db.query('SELECT payload FROM events WHERE run_id=$1',[f.run.id]);assert.equal(JSON.stringify(events.rows).includes(address),false);
  const secret=`whsec_${Buffer.from('fixture-webhook-key-with-at-least-32-bytes').toString('base64')}`;
  const body=webhookPayload(String(effect.effect_id),String(effect.provider_reference)),eventId=`evt_${randomUUID()}`,origin='https://leeos.example';
  const options={origin,database:()=>f.db,resendWebhookSecret:secret};
  const response=await handleCoreRequest(webhookRequest(body,secret,eventId),options);assert.equal(response.status,202);
  effect=(await f.db.query('SELECT * FROM external_effects WHERE effect_id=$1',[effect.effect_id])).rows[0];assert.equal(effect.state,'delivered');
  assert.equal((await store.get(f.receipt.id)).state,'succeeded');assert.equal((await f.state.getRun(f.run.id))?.status,'succeeded');
  const assessment=await f.requirements.assessment(f.run.id);assert.equal(assessment.goalStatus,'achieved');assert.equal(assessment.criteria.find(item=>item.id==='delivered')?.status,'met');
  const duplicate=await handleCoreRequest(webhookRequest(body,secret,eventId),options);assert.equal(duplicate.status,202);assert.equal((await f.db.query('SELECT * FROM acceptance_evidence WHERE run_id=$1 AND kind=\'delivery-confirmation\'',[f.run.id])).rows.length,1);
  const tampered=await handleCoreRequest(webhookRequest(body.replace(address,'wrong@example.com'),secret,`evt_${randomUUID()}`,body),options);assert.equal(tampered.status,401);
  await assert.rejects(store.receiveResendWebhook(`evt_${randomUUID()}`,{type:'email.delivered',data:{email_id:'some-id',to:['attacker@example.com'],tags:{leeos_effect:effect.effect_id}}}));
  assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'achieved');
 }finally{await f.db.close();}
});

test('ambiguous submission only replays the same provider-idempotent request inside its 24-hour window',{timeout:120000},async()=>{
 const f=await fixture();try{
  const email=fakeEmail({retryOnce:true}),options={workerId:'worker_email_replay',enabled:()=>true,provider:idleProvider,emailDelivery:email,artifactStorageEnabled:()=>false,backoffMs:0,envelopeId:f.receipt.id};
  assert.equal((await runEnvelopeWorkerOnce(f.db,options)).status,'queued');
  assert.equal((await f.db.query('SELECT state FROM external_effects WHERE envelope_id=$1',[f.receipt.id])).rows[0].state,'attempted');
  assert.equal((await runEnvelopeWorkerOnce(f.db,options)).status,'waiting-external');
  assert.equal(email.requests(),2);assert.equal(email.effects(),1);assert.equal(new Set(email.keys()).size,1);
  const attempts=await f.db.query("SELECT kind,details FROM external_effect_receipts WHERE effect_id=(SELECT effect_id FROM external_effects WHERE envelope_id=$1) ORDER BY created_at",[f.receipt.id]);
  assert.ok(attempts.rows.some(row=>(row.details as {idempotentReplay?:boolean}).idempotentReplay===true));
  assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'pending');
 }finally{await f.db.close();}
});

test('expired provider idempotency window becomes UNKNOWN and cannot trigger another send',{timeout:120000},async()=>{
 const f=await fixture();try{
  const email=fakeEmail({retryOnce:true}),options={workerId:'worker_email_expired',enabled:()=>true,provider:idleProvider,emailDelivery:email,artifactStorageEnabled:()=>false,emailIdempotencyWindowMs:1000,backoffMs:0,envelopeId:f.receipt.id};
  assert.equal((await runEnvelopeWorkerOnce(f.db,options)).status,'queued');
  await new Promise(resolve=>setTimeout(resolve,1050));
  assert.equal((await runEnvelopeWorkerOnce(f.db,options)).status,'waiting-external');
  assert.equal((await f.db.query('SELECT state FROM external_effects WHERE envelope_id=$1',[f.receipt.id])).rows[0].state,'unknown');
  assert.equal(email.requests(),1);
  assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'pending');
 }finally{await f.db.close();}
});

test('missing current $0 eligibility keeps email queued and creates no external effect',{timeout:120000},async()=>{
 const f=await fixture();try{
  const email=fakeEmail({eligible:false}),result=await runEnvelopeWorkerOnce(f.db,{workerId:'worker_email_blocked',enabled:()=>true,provider:idleProvider,emailDelivery:email,artifactStorageEnabled:()=>false,backoffMs:0,envelopeId:f.receipt.id});
  assert.equal(result.status,'queued');assert.equal((await f.db.query('SELECT * FROM external_effects WHERE envelope_id=$1',[f.receipt.id])).rows.length,0);
 }finally{await f.db.close();}
});
