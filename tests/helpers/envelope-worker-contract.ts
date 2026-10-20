import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import type {StateDatabase} from '../../packages/database/src';
import {envelopeFixture,authorizedInput,envelopeRequirements} from './envelope-contract';
import {createEnvelopeWorkerStore,LeaseLost} from '../../packages/core/src/envelope-worker/store';
import {runEnvelopeWorkerOnce} from '../../packages/core/src/envelope-worker/runner';
import {createLocalProviderManager} from '../../packages/core/src/provider-manager/service';
import {createLocalAdapter} from '../../packages/providers/src/local';
import {handleCoreRequest} from '../../packages/core/src/api/http';
export async function workerFixture(db:StateDatabase){
 const f=await envelopeFixture(db),input=await authorizedInput(f),receipt=await f.manager.accept(f.run.id,input);
 let available=true;
 const provider=createLocalProviderManager({enabled:()=>available,adapter:createLocalAdapter(f.fixture.transport)}),store=createEnvelopeWorkerStore(db,{backoffMs:0,leaseMs:15000});
 const once=(worker='worker_fixture')=>runEnvelopeWorkerOnce(db,{workerId:worker,enabled:()=>true,provider,envelopeId:receipt.id,backoffMs:0});
 return {...f,input,receipt,provider,store,once,setAvailable:(v:boolean)=>{available=v;}};
}
export async function expire(db:StateDatabase,id:string){await db.query("UPDATE envelope_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE envelope_id=$1",[id]);}
export function gate(){let open!:()=>void,entered!:()=>void;const wait=new Promise<void>(r=>open=r),ready=new Promise<void>(r=>entered=r);const safety=setTimeout(()=>open(),10000);safety.unref();return {ready,release:()=>{clearTimeout(safety);open();},hold:async()=>{entered();await wait;}};}
export async function approve(f:Pick<Awaited<ReturnType<typeof workerFixture>>,'store'|'receipt'>){const work=await f.store.get(f.receipt.id);assert.ok(work.review);return f.store.review(f.receipt.id,{operationKey:work.review.operationKey,reviewedEnvelopeDigest:f.receipt.digest,reviewedInputDigest:work.review.digest,acknowledgeReview:true,approve:true,note:'Inspected exact fixture output'});}
export async function exerciseEnvelopeWorkers(db:StateDatabase,t:TestContext){
 await t.test('one active claim wins races; DB leases renew and expired owners cannot renew or submit',async()=>{
  const f=await workerFixture(db),raced=await Promise.all([f.store.claim('worker_a',f.receipt.id),f.store.claim('worker_b',f.receipt.id)]),claim=raced.find(c=>c!==null)!;
  assert.equal(raced.filter(Boolean).length,1);assert.equal(claim.fence,'1');await f.store.heartbeat(claim);
  await assert.rejects(f.store.heartbeat({...claim,workerId:'worker_impostor'}),LeaseLost);
  await expire(db,f.receipt.id);await assert.rejects(f.store.heartbeat(claim),LeaseLost);await assert.rejects(f.store.step(claim,f.provider),LeaseLost);
  await f.store.reap();const next=await f.store.claim('worker_restart',f.receipt.id);assert.ok(next);assert.equal(next.fence,'2');
  await assert.rejects(f.store.step(claim,f.provider),LeaseLost);assert.equal(f.fixture.generated,0);
  assert.equal((await db.query('SELECT * FROM envelope_claims WHERE envelope_id=$1',[f.receipt.id])).rows.length,2);
  await assert.rejects(db.query('UPDATE envelope_work SET fence=0 WHERE envelope_id=$1',[f.receipt.id]),/fencing|identity/i);
  await f.store.release(next);
 });
 await t.test('independent cycle executes once, waits for real human review and only then succeeds',async()=>{
  const f=await workerFixture(db);assert.equal((await f.once()).status,'waiting-human');assert.equal(f.fixture.generated,1);
  let state=await f.store.get(f.receipt.id);assert.equal(state.workerId,null);assert.equal(state.operations[0].state,'succeeded');assert.equal(state.operations[1].state,'pending');
  const assessment=await f.requirements.assessment(f.run.id);assert.equal(assessment.criteria.find(c=>c.id==='generated')?.status,'met');assert.equal(assessment.goalStatus,'pending');
  assert.ok(state.review);await assert.rejects(f.store.review(f.receipt.id,{operationKey:'review',reviewedEnvelopeDigest:f.receipt.digest,reviewedInputDigest:'0'.repeat(64),acknowledgeReview:true,approve:true,note:'Stale review'}));
  const before=await f.store.get(f.receipt.id);await approve(f);assert.equal((await f.once('worker_after_review')).status,'succeeded');assert.equal(f.fixture.generated,1);
  assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'achieved');state=await f.store.get(f.receipt.id);assert.equal(state.state,'succeeded');
  assert.equal((await f.manager.accept(f.run.id,f.input)).id,f.receipt.id);assert.equal((await f.store.claim('worker_late',f.receipt.id)),null);assert.ok(before.review);
 });
 await t.test('restart between operations resolves persisted output bindings and never repeats completed work',async()=>{
  const base=await envelopeFixture(db,{...envelopeRequirements,acceptanceCriteria:[...envelopeRequirements.acceptanceCriteria,{id:'rewritten',description:'Rewrite result exists',required:true,requirementIds:['content'],evidenceKind:'job-result',sourceStepKey:'rewrite'}]});
  const textOp=base.draft.operations[0],reviewOp=base.draft.operations[1];assert.ok(textOp.kind==='text.generate');assert.ok(reviewOp.kind==='owner.review');
  const draft={...base.draft,operations:[textOp,{...textOp,key:'rewrite',kind:'text.generate' as const,dependsOn:['draft'],input:{source:'text-parts' as const,separator:'\n',parts:[{source:'literal' as const,text:'Rewrite exactly this:'},{source:'operation-output' as const,operationKey:'draft',output:'text' as const}]}},{...reviewOp,kind:'owner.review' as const,dependsOn:['draft','rewrite'],inputs:[{source:'operation-output' as const,operationKey:'draft',output:'text' as const},{source:'operation-output' as const,operationKey:'rewrite',output:'text' as const}]}],acceptanceBindings:[...base.draft.acceptanceBindings,{criterionId:'rewritten',operationKey:'rewrite'}]};
  const receipt=await base.manager.accept(base.run.id,await authorizedInput(base,draft)),store=createEnvelopeWorkerStore(db,{backoffMs:0}),prompts:string[]=[];
  const provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(async(path,body,signal)=>{if(path==='/tokenize')prompts.push((body as {content:string}).content);return base.fixture.transport(path,body,signal);})});
  const claim=await store.claim('worker_chain_before_crash',receipt.id);assert.ok(claim);assert.equal(await store.step(claim,provider),'continue');assert.equal(base.fixture.generated,1);
  await expire(db,receipt.id);assert.equal((await runEnvelopeWorkerOnce(db,{workerId:'worker_chain_after_restart',enabled:()=>true,provider,envelopeId:receipt.id,backoffMs:0})).status,'waiting-human');
  assert.equal(base.fixture.generated,2);assert.equal(prompts[1],'Rewrite exactly this:\nFixture text, not model inference.');
  await approve({store,receipt});assert.equal((await runEnvelopeWorkerOnce(db,{workerId:'worker_chain_finish',enabled:()=>true,provider,envelopeId:receipt.id,backoffMs:0})).status,'succeeded');assert.equal(base.fixture.generated,2);assert.equal((await base.requirements.assessment(base.run.id)).goalStatus,'achieved');
 });
 await t.test('unavailable workers and providers preserve queued identity without owner resubmission',async()=>{
  const f=await workerFixture(db);const disabled=await runEnvelopeWorkerOnce(db,{workerId:'worker_disabled',enabled:()=>false,provider:f.provider,envelopeId:f.receipt.id});assert.equal(disabled.status,'disabled');
  f.setAvailable(false);assert.equal((await f.once()).status,'queued');assert.equal(f.fixture.generated,0);assert.equal((await f.store.get(f.receipt.id)).reason,'LOCAL_PROVIDER_UNAVAILABLE');
  f.setAvailable(true);assert.equal((await f.once('worker_resource_ready')).status,'waiting-human');assert.equal(f.fixture.generated,1);
  assert.equal((await db.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[f.run.id])).rows.length,1);assert.equal((await f.manager.forRun(f.run.id)).id,f.receipt.id);
 });
 await t.test('proven backend backpressure after reservation resumes preflight under the same identity, never a dispatched call',async()=>{
  const f=await workerFixture(db);let slots=0;
  const provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(async(path,body,signal)=>{if(path==='/slots'&&++slots===2)return [{id:0,is_processing:true}];return f.fixture.transport(path,body,signal);})});
  const once=()=>runEnvelopeWorkerOnce(db,{workerId:'worker_busy_race',enabled:()=>true,provider,envelopeId:f.receipt.id,backoffMs:0});
  assert.equal((await once()).status,'queued');assert.equal(f.fixture.generated,0);const reserved=(await f.store.get(f.receipt.id)).operations[0];assert.equal(reserved.state,'reserved');assert.ok(reserved.callId);
  assert.equal((await once()).status,'waiting-human');assert.equal(f.fixture.generated,1);assert.equal((await f.store.get(f.receipt.id)).operations[0].callId,reserved.callId);
  assert.equal((await db.query('SELECT * FROM provider_calls WHERE request_key=$1',[f.receipt.id+':draft'])).rows.length,1);
 });
 await t.test('lost ownership during a call rejects the stale result; a fresh fence reconciles saved output without regeneration',async()=>{
  const f=await workerFixture(db),claim=await f.store.claim('worker_old',f.receipt.id);assert.ok(claim);const g=gate();f.fixture.gate=g.hold;
  const pending=f.store.step(claim,f.provider).then(value=>({value,error:null}),error=>({value:null,error}));await g.ready;
  const call=(await f.store.get(f.receipt.id)).operations[0].callId;assert.ok(call);
  const otherProvider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(f.fixture.transport)});
  await assert.rejects(otherProvider.recover(db,{callId:call,expectedVersion:0,acknowledgeServerRestart:true}));
  await expire(db,f.receipt.id);await f.store.reap();assert.equal((await f.store.get(f.receipt.id)).state,'recovery-required');assert.equal(await f.store.claim('worker_cannot_duplicate',f.receipt.id),null);
  g.release();assert.ok((await pending).error instanceof LeaseLost);assert.equal((await f.store.get(f.receipt.id)).operations[0].state,'dispatched');
  await f.store.reap();assert.equal((await f.once('worker_reconcile')).status,'waiting-human');assert.equal(f.fixture.generated,1);
  const op=(await f.store.get(f.receipt.id)).operations[0];assert.equal(op.dispatchFence,'1');assert.equal(op.resultFence,'2');assert.equal(op.state,'succeeded');
  await assert.rejects(f.store.step(claim,f.provider),LeaseLost);
 });
 await t.test('cancellation and permanent revocation fence late results and prevent new claims',async()=>{
  for(const mode of ['cancel','revoke']){
   const f=await workerFixture(db),claim=await f.store.claim('worker_effect',f.receipt.id);assert.ok(claim);const g=gate();f.fixture.gate=g.hold;
   const result=f.store.step(claim,f.provider).then(()=>null,e=>e);await g.ready;
   if(mode==='cancel'){const run=await f.state.getRun(f.run.id);await f.state.transitionRun(f.run.id,run!.version,'cancelled');}
   else await f.manager.revoke(f.receipt.id,{reviewedEnvelopeDigest:f.receipt.digest,acknowledgeRevocation:true,reason:'Withdraw this work'});
   await assert.rejects(f.store.heartbeat(claim),LeaseLost);g.release();assert.ok(await result instanceof LeaseLost);await f.store.reap();
   const state=await f.store.get(f.receipt.id);assert.equal(state.state,'cancelled');assert.equal(state.operations[0].outputText,null);assert.equal(await f.store.claim('worker_late',f.receipt.id),null);
   assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'not-achieved');assert.equal(f.fixture.generated,1);
  }
 });
 await t.test('uncertain generation is quarantined; explicit provider recovery never authorizes another call',async()=>{
  const f=await workerFixture(db);f.fixture.malformed=true;assert.equal((await f.once()).status,'recovery-required');assert.equal(f.fixture.generated,1);
  assert.equal((await f.once('worker_no_retry')).status,'idle');assert.equal(f.fixture.generated,1);
  const callId=(await f.store.get(f.receipt.id)).operations[0].callId!;
  const call=(await db.query('SELECT version FROM provider_calls WHERE id=$1',[callId])).rows[0];
  await f.provider.recover(db,{callId,expectedVersion:call.version,acknowledgeServerRestart:true});
  assert.equal((await f.once('worker_resolve_uncertainty')).status,'failed');assert.equal(f.fixture.generated,1);
  assert.equal((await f.store.get(f.receipt.id)).operations[0].state,'uncertain');
 });
 await t.test('a recorded response outside the authorized byte limit fails once rather than being accepted or regenerated',async()=>{
  const f=await workerFixture(db),provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(async(path,body,signal)=>{const value=await f.fixture.transport(path,body,signal);return path==='/completion'?{...(value as Record<string,unknown>),content:'🙂'.repeat(20000)}:value;})});
  const options={workerId:'worker_output_limit',enabled:()=>true,provider,envelopeId:f.receipt.id,backoffMs:0};assert.equal((await runEnvelopeWorkerOnce(db,options)).status,'failed');assert.equal(f.fixture.generated,1);
  const state=await f.store.get(f.receipt.id);assert.equal(state.operations[0].errorCode,'RESULT_SCOPE_INVALID');assert.equal(state.operations[0].outputText,null);assert.equal((await runEnvelopeWorkerOnce(db,options)).status,'idle');assert.equal(f.fixture.generated,1);
 });
 await t.test('claim/reservation/result audit failures roll back authority and recover stored results without extra calls',async()=>{
  const f=await workerFixture(db);
  const reject=async(kind:string)=>db.exec(`CREATE FUNCTION reject_worker_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='${kind}' THEN RAISE EXCEPTION 'reject worker event'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_worker_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_worker_event();`);
  const clear=()=>db.exec('DROP TRIGGER reject_worker_event ON events; DROP FUNCTION reject_worker_event();');
  await reject('envelope-work.claimed');try{await assert.rejects(f.store.claim('worker_rollback',f.receipt.id));}finally{await clear();}
  assert.equal((await f.store.get(f.receipt.id)).fence,'0');assert.equal((await f.state.getRun(f.run.id))?.version,0);
  await reject('envelope-operation.reserved');try{assert.equal((await f.once()).status,'queued');}finally{await clear();}
  assert.equal(f.fixture.generated,0);assert.equal((await f.store.get(f.receipt.id)).operations[0].callId,null);
  await reject('envelope-operation.succeeded');try{await assert.rejects(f.once('worker_saved_result'));}finally{await clear();}
  assert.equal(f.fixture.generated,1);assert.equal((await f.store.get(f.receipt.id)).operations[0].state,'dispatched');
  assert.equal((await f.once('worker_after_failure')).status,'waiting-human');assert.equal(f.fixture.generated,1);
 });
 await t.test('heartbeat keeps a long call owned independently of any HTTP lifetime',async()=>{
  const f=await workerFixture(db),g=gate();f.fixture.gate=g.hold;
  const work=runEnvelopeWorkerOnce(db,{workerId:'worker_heartbeats',enabled:()=>true,provider:f.provider,envelopeId:f.receipt.id,leaseMs:1500,backoffMs:0});await g.ready;
  await new Promise(r=>setTimeout(r,2200));const current=await f.store.get(f.receipt.id);assert.equal(current.state,'running');assert.ok(new Date(current.leaseExpiresAt!).getTime()>Date.now());
  assert.equal(await f.store.claim('worker_competitor',f.receipt.id),null);g.release();assert.equal((await work).status,'waiting-human');assert.equal(f.fixture.generated,1);
 });
 await t.test('owner HTTP can inspect and explicitly review work but cannot claim or submit worker results',async()=>{
  const f=await workerFixture(db);await f.once();const state=await f.store.get(f.receipt.id);assert.ok(state.review);
  const origin='http://127.0.0.1:3000',token='a'.repeat(64);
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{origin,token,database:()=>db});
  assert.equal((await call('GET',`/runs/${f.run.id}/envelope-work`)).status,200);
  assert.equal((await call('POST',`/execution-envelopes/${f.receipt.id}/claim`,{})).status,404);
  assert.equal((await call('POST',`/execution-envelopes/${f.receipt.id}/work`,{output:'forged'})).status,405);
  assert.equal((await call('POST',`/execution-envelopes/${f.receipt.id}/review`,{operationKey:'review',reviewedEnvelopeDigest:f.receipt.digest,reviewedInputDigest:state.review.digest,acknowledgeReview:true,approve:true,note:'Owner inspected fixture'})).status,200);
 });
}
