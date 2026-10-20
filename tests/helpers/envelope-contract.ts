import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createId,createStateStore,type StateDatabase} from '../../packages/database/src';
import {createRequirementsManager} from '../../packages/core/src/requirements/store';
import {createPlanner} from '../../packages/core/src/orchestrator/store';
import {createEnvelopeManager} from '../../packages/core/src/execution-envelope/store';
import {compileEnvelope,envelopeDigest,type EnvelopeDraft} from '../../packages/core/src/execution-envelope';
import {createExecutionManager} from '../../packages/core/src/execution-manager/store';
import {planDigest} from '../../packages/core/src/execution-manager';
import {createLocalAdapter} from '../../packages/providers/src/local';
import {fixtureTransport} from './local-provider-contract';
import {handleCoreRequest} from '../../packages/core/src/api/http';
import {OwnerClient} from '../../apps/hub/lib/owner-client';
import type {RequirementsContent} from '../../packages/core/src/requirements';
import type {ProviderDescriptor} from '../../packages/providers/src';
export const envelopeRequirements:RequirementsContent={goal:'Draft a message and request owner review',
 requirements:[{id:'content',statement:'Draft the requested message',required:true,capabilityIds:['text_generation']}],
 inputs:[{id:'prompt',description:'Exact owner prompt',required:true}],outputs:[{id:'message',description:'Generated text'}],assumptions:[],questions:[],constraints:[],capabilities:['text_generation'],costPolicy:'ZERO_ONLY',
 acceptanceCriteria:[{id:'generated',description:'Recorded successful generation',required:true,requirementIds:['content'],evidenceKind:'job-result',sourceStepKey:'draft'},
  {id:'reviewed',description:'Owner checks the requested message',required:true,requirementIds:['content'],evidenceKind:'owner-review'}]};
export async function envelopeFixture(db:StateDatabase,content:RequirementsContent=envelopeRequirements,route?:{provider:ProviderDescriptor;fingerprint:string;location:'local'|'remote'}){
 const state=createStateStore(db),requirements=createRequirementsManager(db),project=await state.createProject('P0.3 '+randomUUID()),run=await state.createRun(project.id);
 const doc=await requirements.create(project.id,{content,idempotencyKey:randomUUID()});await requirements.review(doc.id,{revision:1,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true});
 await requirements.bind(run.id,{requirementsId:doc.id,revision:1,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true});
 const fixture=fixtureTransport(),probe=await createLocalAdapter(fixture.transport).probe(),now=new Date(),provider=route?.provider??probe.provider,fingerprint=route?.fingerprint??probe.fingerprint,location=route?.location??'local';
 const saved=await createPlanner(db,{routing:()=>({registry:[provider],now})}).create(run.id,{mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:doc.digest,modelBudget:{inputTokens:128,outputTokens:64}});
 const draft:EnvelopeDraft={expectedRunVersion:0,reviewedPlanDigest:planDigest(run.id,0,saved.plan),grantExpiresAt:new Date(now.getTime()+3600000).toISOString(),
  contractInputs:{prompt:' \nExact fixture prompt; do not generate in this test.  '},constraints:location==='remote'?{location:'remote',network:'provider-allowlist-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0}:{location:'local',network:'loopback-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0},
  operations:[{key:'draft',kind:'text.generate',requirementIds:['content'],dependsOn:[],input:{source:'contract-input',inputId:'prompt'},maxOutputTokens:32,modelFingerprint:fingerprint},
   {key:'review',kind:'owner.review',requirementIds:['content'],dependsOn:['draft'],inputs:[{source:'operation-output',operationKey:'draft',output:'text'}]}],
  acceptanceBindings:[{criterionId:'generated',operationKey:'draft'},{criterionId:'reviewed',operationKey:'review'}]};
 const manager=createEnvelopeManager(db,{now:()=>now});
 return {state,requirements,project,run,doc,saved,now,draft,manager,fixture};
}
export async function authorizedInput(f:Awaited<ReturnType<typeof envelopeFixture>>,draft=f.draft){
 const preview=await f.manager.preview(f.run.id,draft);assert.equal(preview.canAccept,true,JSON.stringify(preview.blockers));
 return {...draft,idempotencyKey:randomUUID(),reviewedEnvelopeDigest:preview.digest!,acknowledgeAuthorization:true as const};
}
export async function exerciseEnvelopes(db:StateDatabase,t:TestContext){
 await t.test('preview is inert; acceptance persists exact grants, inputs, references and identities exactly once',async()=>{
  const f=await envelopeFixture(db),callsBefore=(await db.query('SELECT id FROM provider_calls')).rows.length;
  const input=await authorizedInput(f);assert.equal((await db.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[f.run.id])).rows.length,0);
  const [a,b]=await Promise.all([f.manager.accept(f.run.id,input),f.manager.accept(f.run.id,input)]);assert.deepEqual(a,b);
  assert.equal(a.digest,envelopeDigest(a.envelope));assert.equal(a.envelope.operations[0].kind,'text.generate');
  assert.ok('input' in a.envelope.operations[0]);assert.deepEqual(a.envelope.operations[0].input,f.draft.operations[0].kind==='text.generate'?f.draft.operations[0].input:null);
  assert.equal(a.envelope.operations[1].permission,'owner:review-request');assert.equal(a.envelope.operations[1].requiresHuman,true);
  assert.deepEqual(a.envelope.routing.plan,f.saved.plan);assert.equal(a.envelope.contract.digest,f.doc.digest);
  assert.equal(a.envelope.contractInputs.prompt,' \nExact fixture prompt; do not generate in this test.  ');assert.equal(a.authorizationStatus,'recorded');assert.equal(a.dispatchEnabled,false);assert.equal(a.workerStatus,'queued');
  assert.deepEqual(await f.manager.forRun(f.run.id),a);assert.deepEqual(await f.manager.get(a.id),a);
  assert.equal((await f.state.listJobs(f.run.id)).items.length,0);assert.equal((await f.state.getRun(f.run.id))?.version,0);assert.equal(f.fixture.generated,0);
  assert.equal((await db.query('SELECT id FROM provider_calls')).rows.length,callsBefore);
  assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'pending');
  const events=(await f.state.listEvents(f.project.id)).filter(e=>e.kind==='execution-envelope.accepted');assert.equal(events.length,1);assert.equal(JSON.stringify(events).includes('Exact fixture prompt'),false);
  await assert.rejects(f.manager.accept(f.run.id,{...input,idempotencyKey:'different'}));
  await assert.rejects(f.manager.accept(f.run.id,{...input,operations:[{...input.operations[0],maxOutputTokens:16},input.operations[1]]}));
  await assert.rejects(db.query('UPDATE execution_envelopes SET digest=$2 WHERE id=$1',[a.id,'0'.repeat(64)]),/append.only|immutable/i);
  await assert.rejects(db.query('DELETE FROM execution_envelopes WHERE id=$1',[a.id]),/append.only|immutable/i);
  assert.equal((await f.manager.preview(f.run.id,f.draft)).canAccept,false);
 });
 await t.test('scope, graph, source step, cost, implementation and constraint gaps block authorization',async()=>{
  const f=await envelopeFixture(db);
  const changes:EnvelopeDraft[]=[
   {...f.draft,contractInputs:{}},{...f.draft,contractInputs:{...f.draft.contractInputs,foreign:'unexpected'}},
   {...f.draft,operations:[{...f.draft.operations[0],input:{source:'literal',text:'unused input'}} as EnvelopeDraft['operations'][number],f.draft.operations[1]]},
   {...f.draft,reviewedPlanDigest:'0'.repeat(64)}, {...f.draft,expectedRunVersion:1},
   {...f.draft,grantExpiresAt:f.now.toISOString()}, {...f.draft,grantExpiresAt:new Date(f.now.getTime()+86400001).toISOString()},
   {...f.draft,operations:[{...f.draft.operations[0],dependsOn:['review']},f.draft.operations[1]]},
   {...f.draft,operations:[f.draft.operations[0],f.draft.operations[0]]},
   {...f.draft,operations:[{...f.draft.operations[0],requirementIds:['foreign']},f.draft.operations[1]]},
   {...f.draft,operations:[{...f.draft.operations[0],maxOutputTokens:65} as EnvelopeDraft['operations'][number],f.draft.operations[1]]},
   {...f.draft,operations:[f.draft.operations[0],{...f.draft.operations[1],dependsOn:[]}]},
   {...f.draft,operations:[f.draft.operations[0]]},
   {...f.draft,acceptanceBindings:[{criterionId:'generated',operationKey:'review'},{criterionId:'reviewed',operationKey:'review'}]},
   {...f.draft,acceptanceBindings:[...f.draft.acceptanceBindings,f.draft.acceptanceBindings[0]]}
  ];
  for(const value of changes){const result=await f.manager.preview(f.run.id,value);assert.equal(result.canAccept,false,JSON.stringify(value));}
  const composed:EnvelopeDraft={...f.draft,operations:[{...f.draft.operations[0],input:{source:'text-parts',separator:'\n',parts:[{source:'literal',text:'Exact instruction'},{source:'contract-input',inputId:'prompt'}]}} as EnvelopeDraft['operations'][number],f.draft.operations[1]]};
  assert.equal((await f.manager.preview(f.run.id,composed)).canAccept,true);
  const tooLarge:EnvelopeDraft={...composed,operations:[{...composed.operations[0],input:{source:'text-parts',separator:'\n',parts:[{source:'literal',text:'x'.repeat(8192)},{source:'contract-input',inputId:'prompt'}]}} as EnvelopeDraft['operations'][number],composed.operations[1]]};
  assert.ok((await f.manager.preview(f.run.id,tooLarge)).blockers.some(b=>b==='RESOLVED_INPUT_TOO_LARGE:draft'));
  const input=await authorizedInput(f);await assert.rejects(f.manager.accept(f.run.id,{...input,reviewedEnvelopeDigest:'0'.repeat(64)}));
  const other=await envelopeFixture(db);await assert.rejects(other.manager.accept(other.run.id,input));
  const constrained=await envelopeFixture(db,{...envelopeRequirements,constraints:['Some unstructured rule']});assert.ok((await constrained.manager.preview(constrained.run.id,constrained.draft)).blockers.some(b=>b==='UNRESOLVED_PROSE_CONSTRAINTS'));
  // A different implementation never inherits the local-text operation contract.
  const changed=structuredClone(f.saved.plan) as {capabilities:{id:string;route:{selected:unknown}}[]};changed.capabilities.find(n=>n.id==='text_generation')!.route.selected={implementationId:'model-router',providerId:'other',modelId:'other'};
  const changedDraft={...f.draft,reviewedPlanDigest:planDigest(f.run.id,0,changed)};
  assert.equal(compileEnvelope({id:f.run.id,projectId:f.project.id,version:0},0,changed,changedDraft,f.now).canAccept,false);
  assert.equal((await db.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[f.run.id])).rows.length,0);
 });
 await t.test('bound revision and accepted authorization survive later edits, cancellation and expiry without renewal',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f),a=await f.manager.accept(f.run.id,input);
  await f.requirements.revise(f.doc.id,{expectedRevision:1,content:{...envelopeRequirements,goal:'A later outcome'}});
  await f.state.transitionRun(f.run.id,0,'cancelled');
  assert.equal((await f.manager.accept(f.run.id,input)).authorizationStatus,'run-inactive');assert.deepEqual((await f.manager.get(a.id)).envelope,a.envelope);
  const later=createEnvelopeManager(db,{now:()=>new Date(f.now.getTime()+7200000)});assert.equal((await later.accept(f.run.id,input)).authorizationStatus,'expired');
  const fresh=await envelopeFixture(db),expiredRoute=createEnvelopeManager(db,{now:()=>new Date(fresh.now.getTime()+120000)}),preview=await expiredRoute.preview(fresh.run.id,fresh.draft);
  assert.equal(preview.canAccept,true);assert.equal(preview.candidate?.costPolicy.revalidationRequiredBeforeDispatch,true);
 });
 await t.test('competing authorizations and cancellation serialize on the run without dispatch',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f),different={...input,idempotencyKey:randomUUID()};
  const results=await Promise.allSettled([f.manager.accept(f.run.id,input),f.manager.accept(f.run.id,different)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const g=await envelopeFixture(db),command=await authorizedInput(g);
  await Promise.allSettled([g.manager.accept(g.run.id,command),g.state.transitionRun(g.run.id,0,'cancelled')]);
  assert.equal((await g.state.getRun(g.run.id))?.status,'cancelled');
  const rows=(await db.query('SELECT id FROM execution_envelopes WHERE run_id=$1',[g.run.id])).rows;
  if(rows.length)assert.equal((await g.manager.forRun(g.run.id)).authorizationStatus,'run-inactive');
  assert.equal((await g.state.listJobs(g.run.id)).items.length,0);
 });
 await t.test('authorization and revocation are append-only and roll back if their event cannot commit',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f);
  await db.exec(`CREATE FUNCTION reject_envelope_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind IN ('execution-envelope.accepted','execution-envelope.revoked') THEN RAISE EXCEPTION 'reject envelope event'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_envelope_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_envelope_event();`);
  try{await assert.rejects(f.manager.accept(f.run.id,input),/reject envelope event/);}finally{await db.exec('DROP TRIGGER reject_envelope_event ON events; DROP FUNCTION reject_envelope_event();');}
  await assert.rejects(f.manager.forRun(f.run.id));const saved=await f.manager.accept(f.run.id,input),revoke={reviewedEnvelopeDigest:saved.digest,reason:'Stop this authorization',acknowledgeRevocation:true};
  await db.exec(`CREATE FUNCTION reject_revoke_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='execution-envelope.revoked' THEN RAISE EXCEPTION 'reject revoke'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_revoke_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_revoke_event();`);
  try{await assert.rejects(f.manager.revoke(saved.id,revoke),/reject revoke/);}finally{await db.exec('DROP TRIGGER reject_revoke_event ON events; DROP FUNCTION reject_revoke_event();');}
  assert.equal((await f.manager.get(saved.id)).authorizationStatus,'recorded');
  const [a,b]=await Promise.all([f.manager.revoke(saved.id,revoke),f.manager.revoke(saved.id,revoke)]);assert.deepEqual(a,b);assert.equal(a.authorizationStatus,'revoked');
  assert.equal((await f.manager.accept(f.run.id,input)).authorizationStatus,'revoked');
  await assert.rejects(f.manager.revoke(saved.id,{...revoke,reason:'Changed'}));await assert.rejects(db.query('DELETE FROM execution_envelope_revocations WHERE envelope_id=$1',[saved.id]),/append.only|immutable/i);
  assert.equal((await f.state.getRun(f.run.id))?.status,'queued');
 });
 await t.test('lost acceptance response and closed browser connection recover the same durable work',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f),origin='http://127.0.0.1:3000',token='d'.repeat(64);let drop=true;
  const transport:typeof fetch=async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3000');const response=await handleCoreRequest(new Request(String(url),{...init,headers}),{origin,token,database:()=>db});
   if(drop&&init?.method==='POST'){assert.equal(response.status,201);drop=false;throw Error('Response lost after commit');}return response;};
  const client=new OwnerClient(origin,token,transport);await assert.rejects(client.call('POST',`/runs/${f.run.id}/execution-envelope`,input));client.close();
  const reconnect=new OwnerClient(origin,token,transport);
  try{const a=await reconnect.call<{id:string;envelope:unknown;dispatchEnabled:boolean}>('GET',`/runs/${f.run.id}/execution-envelope`),b=await reconnect.call<{id:string}>('POST',`/runs/${f.run.id}/execution-envelope`,input);assert.equal(a.id,b.id);assert.equal(a.dispatchEnabled,false);assert.deepEqual(a.envelope,(await f.manager.forRun(f.run.id)).envelope);}
  finally{reconnect.close();}
  assert.equal((await db.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[f.run.id])).rows.length,1);assert.equal(f.fixture.generated,0);
 });
 await t.test('accepted capability work cannot use legacy job preparation or acquire a worker',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f),saved=await f.manager.accept(f.run.id,input),execution=createExecutionManager(db),inspection=await execution.inspect(f.run.id);
  assert.equal(inspection.canPrepare,false);assert.deepEqual(inspection.blockingReasons,['INDEPENDENT_WORKER_REQUIRED']);
  await assert.rejects(execution.prepare(f.run.id,{expectedRunVersion:0,reviewedPlanDigest:f.draft.reviewedPlanDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]}));
  assert.equal((await f.state.listJobs(f.run.id)).items.length,0);assert.equal(saved.envelope.acceptanceStatus,'pending');
 });
 await t.test('database scope and policy constraints reject cross-run work and executable or paid envelopes',async()=>{
  const f=await envelopeFixture(db),input=await authorizedInput(f),saved=await f.manager.accept(f.run.id,input),other=await envelopeFixture(db);
  const cross={...saved.envelope,run:{...saved.envelope.run,id:other.run.id,projectId:other.project.id}};
  await assert.rejects(db.query(`INSERT INTO execution_envelopes(id,run_id,project_id,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,envelope,digest,grant_expires_at)
   SELECT $1,$2,$3,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,$4::jsonb,digest,grant_expires_at FROM execution_envelopes WHERE id=$5`,
   [createId('envelope'),other.run.id,other.project.id,JSON.stringify(cross),saved.id]),(error:unknown)=>(error as {code:string}).code==='23503');
  for(const body of [{...saved.envelope,dispatch:{...saved.envelope.dispatch,enabledAtAcceptance:true}},{...saved.envelope,costPolicy:{...saved.envelope.costPolicy,maxSpendUsd:1}}]){
   await assert.rejects(db.query(`INSERT INTO execution_envelopes(id,run_id,project_id,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,envelope,digest,grant_expires_at)
    SELECT $1,run_id,project_id,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,$2::jsonb,digest,grant_expires_at FROM execution_envelopes WHERE id=$3`,[createId('envelope'),JSON.stringify(body),saved.id]),(error:unknown)=>(error as {code:string}).code==='23514');
  }
 });
}
