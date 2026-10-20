import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createStateStore,type StateDatabase} from '../../packages/database/src';
import {createRequirementsManager} from '../../packages/core/src/requirements/store';
import {requirementsDigest,type RequirementsContent} from '../../packages/core/src/requirements';
import {createPlanner} from '../../packages/core/src/orchestrator/store';
import {createExecutionManager} from '../../packages/core/src/execution-manager/store';
import {createAgentManager} from '../../packages/core/src/agent-manager/store';
import {createJobWorker} from '../../packages/core/src/job-worker';
import {fixtureTransport} from './local-provider-contract';
import {createLocalAdapter} from '../../packages/providers/src/local';
import {createLocalProviderManager} from '../../packages/core/src/provider-manager/service';
import {handleCoreRequest} from '../../packages/core/src/api/http';
export const exampleRequirements:RequirementsContent={goal:'Create and deliver a lesson guide',
 requirements:[{id:'lesson',statement:'Record a generated lesson',required:true},{id:'document',statement:'Validate Times New Roman 12 DOCX',required:true},{id:'delivery',statement:'Confirm approved delivery',required:true}],
 inputs:[{id:'topic',description:'Owner supplies the lesson topic',required:true}],outputs:[{id:'guide',description:'Stored DOCX lesson guide'}],assumptions:[],questions:[],constraints:['Body text: Times New Roman 12 pt'],capabilities:['text_generation','document_generation','delivery'],costPolicy:'ZERO_ONLY',
 acceptanceCriteria:[{id:'generated',description:'Lesson job result recorded',requirementIds:['lesson'],required:true,evidenceKind:'job-result',sourceStepKey:'draft'},
 {id:'format',description:'DOCX format validation evidence',requirementIds:['document'],required:true,evidenceKind:'document-validation',expected:{format:'docx',font_family:'Times New Roman',body_font_size_pt:12}},
 {id:'delivered',description:'Delivery confirmation evidence',requirementIds:['delivery'],required:true,evidenceKind:'delivery-confirmation'}]};
export const ownerRequirements:RequirementsContent={...exampleRequirements,requirements:[{id:'outcome',statement:'Owner accepts the outcome',required:true}],acceptanceCriteria:[{id:'accepted',description:'Owner reviewed the outcome',requirementIds:['outcome'],required:true,evidenceKind:'owner-review'}]};
export async function exerciseRequirements(db:StateDatabase,t:TestContext){
 const store=createStateStore(db),manager=createRequirementsManager(db);
 async function fixture(content:RequirementsContent=ownerRequirements){
  const project=await store.createProject('P0.1 '+randomUUID()),run=await store.createRun(project.id);
  const doc=await manager.create(project.id,{content,idempotencyKey:randomUUID()});
  const review={revision:doc.revision,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true};
  const bind={requirementsId:doc.id,revision:doc.revision,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true};
  return {project,run,doc,review,bind};
 }
 await t.test('requirements create deduplicates without planning, jobs, execution or permission',async()=>{
  const project=await store.createProject('Requirements duplicate'),input={content:exampleRequirements,idempotencyKey:'same'};
  const [a,b]=await Promise.all([manager.create(project.id,input),manager.create(project.id,input)]);assert.deepEqual(a,b);assert.equal(a.status,'draft');assert.equal(a.executionEnabled,false);assert.deepEqual(a.permissions,[]);
  await assert.rejects(manager.create(project.id,{...input,content:ownerRequirements}));assert.equal((await store.listRuns(project.id)).items.length,0);
  await db.query("UPDATE projects SET status='archived' WHERE id=$1",[project.id]);await assert.rejects(manager.create(project.id,{...input,idempotencyKey:'new'}));assert.equal((await manager.create(project.id,input)).id,a.id);
 });
 await t.test('requirements review rejects questions/digest mismatch; revision race preserves old review',async()=>{
  const f=await fixture({...ownerRequirements,questions:['Who is the audience?']});await assert.rejects(manager.review(f.doc.id,f.review));
  const revised=await manager.revise(f.doc.id,{expectedRevision:1,content:ownerRequirements});await assert.rejects(manager.review(f.doc.id,f.review));
  await assert.rejects(manager.review(f.doc.id,{revision:2,reviewedDigest:'0'.repeat(64),acknowledgeRequirementsReview:true}));
  const input={revision:2,reviewedDigest:revised.digest,acknowledgeRequirementsReview:true};await Promise.all([manager.review(f.doc.id,input),manager.review(f.doc.id,input)]);
  const changes=await Promise.allSettled([manager.revise(f.doc.id,{expectedRevision:2,content:ownerRequirements}),manager.revise(f.doc.id,{expectedRevision:2,content:ownerRequirements})]);assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await manager.get(f.doc.id)).status,'draft');assert.equal((await manager.get(f.doc.id,2)).status,'reviewed');assert.equal((await manager.review(f.doc.id,input)).revision,2);
  assert.equal((await db.query("SELECT * FROM events WHERE entity_id=$1 AND kind='requirements.reviewed'",[f.doc.id])).rows.length,1);
 });
 await t.test('binding requires current reviewed digest, matching project/version and no preparation',async()=>{
  const f=await fixture(),other=await fixture();await assert.rejects(manager.bind(f.run.id,f.bind));await manager.review(f.doc.id,f.review);
  await assert.rejects(manager.bind(other.run.id,f.bind));await assert.rejects(manager.bind(f.run.id,{...f.bind,expectedRunVersion:1}));
  const bound=await manager.bind(f.run.id,f.bind);assert.equal(bound.requirements.revision,1);
  const revised=await manager.revise(f.doc.id,{expectedRevision:1,content:{...ownerRequirements,goal:'A changed goal'}});assert.notEqual(revised.digest,f.doc.digest);
  const fresh=await store.createRun(f.project.id);await assert.rejects(manager.bind(fresh.id,f.bind));
  assert.equal((await manager.assessment(f.run.id)).requirements.digest,f.doc.digest);assert.equal((await manager.bind(f.run.id,f.bind)).requirements.revision,1);
  await assert.rejects(manager.bind(f.run.id,{...f.bind,revision:2,reviewedDigest:revised.digest}));
  await assert.rejects(db.query('UPDATE run_requirements SET digest=$2 WHERE run_id=$1',[f.run.id,revised.digest]));
  await assert.rejects(db.query('UPDATE requirements_revisions SET content=content WHERE requirements_id=$1',[f.doc.id]));
  await assert.rejects(db.query('DELETE FROM requirements_reviews WHERE requirements_id=$1',[f.doc.id]));
  await assert.rejects(db.query('UPDATE requirements_documents SET project_id=$2,current_revision=current_revision+1 WHERE id=$1',[f.doc.id,other.project.id]));
  const late=await fixture();await manager.review(late.doc.id,late.review);await store.createJob(late.run.id,'already-created');await assert.rejects(manager.bind(late.run.id,late.bind));
 });
 await t.test('binding versus revision and competing evidence decisions serialize without stale authority',async()=>{
  const f=await fixture();await manager.review(f.doc.id,f.review);
  await Promise.allSettled([manager.bind(f.run.id,f.bind),manager.revise(f.doc.id,{expectedRevision:1,content:{...ownerRequirements,goal:'New requirements'}})]);
  assert.equal((await manager.get(f.doc.id)).revision,2);
  const bindings=(await db.query('SELECT * FROM run_requirements WHERE run_id=$1',[f.run.id])).rows;
  if(bindings.length){assert.equal(bindings[0].revision,1);assert.equal((await manager.assessment(f.run.id)).requirements.digest,f.doc.digest);}
  const g=await fixture();await manager.review(g.doc.id,g.review);await manager.bind(g.run.id,g.bind);
  const base={kind:'owner-review',criterionId:'accepted',expectedEvidenceVersion:0,note:'Explicit owner decision',acknowledgeOwnerReview:true};
  const results=await Promise.allSettled([manager.recordEvidence(g.run.id,{...base,idempotencyKey:'yes',outcome:'met'}),manager.recordEvidence(g.run.id,{...base,idempotencyKey:'no',outcome:'not-met'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await manager.assessment(g.run.id)).criteria[0].evidenceVersion,1);
 });
 await t.test('technical run success leaves document and delivery criteria pending; only scoped server results count',async()=>{
  const f=await fixture(exampleRequirements);await manager.review(f.doc.id,f.review);
  // Existing manual plans remain compatible. New bound-run planning uses P0.2.
  await createPlanner(db).create(f.run.id,{expectedRunVersion:0,goal:exampleRequirements.goal,steps:[{key:'draft',title:'Draft fixture text',kind:'model'},{key:'review',title:'Owner review',kind:'review',dependsOn:['draft']}]});
  await manager.bind(f.run.id,f.bind);
  const preparation=createExecutionManager(db),preview=await preparation.inspect(f.run.id);await preparation.prepare(f.run.id,{expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
  const jobs=(await store.listJobs(f.run.id)).items,draft=jobs.find(j=>j.step_key==='draft')!,review=jobs.find(j=>j.step_key==='review')!;
  const agents=createAgentManager(db),role=await agents.registerRole({name:'Evidence fixture',purpose:'Record text only',stepKinds:['model'],permissions:[],idempotencyKey:randomUUID()});
  const assignment=await agents.assign(f.run.id,draft.id,{roleId:role.id,expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,mode:'assignment-only',permissions:[]});
  const adapter=createLocalAdapter(fixtureTransport().transport),fingerprint=(await adapter.probe()).fingerprint,worker=createJobWorker(db,{enabled:()=>true,provider:createLocalProviderManager({enabled:()=>true,adapter})});
  await worker.execute(f.run.id,draft.id,{expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgeExecution:true,permission:'local:text',agentId:(assignment.assignment as {id:string}).id,expectedAgentVersion:0,modelFingerprint:fingerprint,prompt:'Fixture, not a lesson',maxOutputTokens:16});
  await worker.review(f.run.id,review.id,{expectedRunVersion:1,reviewedPlanDigest:preview.planDigest,acknowledgeExecution:true,permission:'owner:review',approve:true});
  const before=await manager.assessment(f.run.id);assert.equal(before.runStatus,'succeeded');assert.equal(before.goalStatus,'pending');assert.ok(before.criteria.every(c=>c.status==='pending'));
  const evidence={kind:'job-result',criterionId:'generated',expectedEvidenceVersion:0,idempotencyKey:'result',jobId:draft.id};
  await assert.rejects(manager.recordEvidence(f.run.id,{...evidence,jobId:review.id}));const foreign=await fixture(exampleRequirements);await manager.review(foreign.doc.id,foreign.review);await manager.bind(foreign.run.id,foreign.bind);await assert.rejects(manager.recordEvidence(foreign.run.id,evidence));
  const after=await manager.recordEvidence(f.run.id,evidence);assert.equal(after.criteria.find(c=>c.id==='generated')?.status,'met');assert.equal(after.goalStatus,'pending');
  assert.deepEqual(after.criteria.find(c=>c.id==='format')?.expected,{format:'docx',font_family:'Times New Roman',body_font_size_pt:12});assert.equal(after.criteria.find(c=>c.id==='format')?.verifierAvailable,true);assert.equal(after.criteria.find(c=>c.id==='delivered')?.status,'pending');
  await assert.rejects(manager.recordEvidence(f.run.id,{kind:'owner-review',criterionId:'format',expectedEvidenceVersion:0,idempotencyKey:'fake',outcome:'met',note:'AI said approved',acknowledgeOwnerReview:true}));
  assert.equal((await manager.recordEvidence(f.run.id,evidence)).criteria.find(c=>c.id==='generated')?.evidenceVersion,1);
  await assert.rejects(manager.recordEvidence(f.run.id,{...evidence,jobId:review.id}));
 });
 await t.test('owner evidence corrections are versioned; duplicates replay; technical state is never mutated',async()=>{
  const f=await fixture();await manager.review(f.doc.id,f.review);await manager.bind(f.run.id,f.bind);
  const input={kind:'owner-review',criterionId:'accepted',expectedEvidenceVersion:0,idempotencyKey:'decision',outcome:'met',note:'Owner checked this outcome',acknowledgeOwnerReview:true};
  const [a,b]=await Promise.all([manager.recordEvidence(f.run.id,input),manager.recordEvidence(f.run.id,input)]);assert.deepEqual(a,b);assert.equal(a.criteriaStatus,'met');assert.equal(a.goalStatus,'pending');assert.equal((await store.getRun(f.run.id))?.status,'queued');
  await assert.rejects(manager.recordEvidence(f.run.id,{...input,idempotencyKey:'stale'}));
  const next=await manager.recordEvidence(f.run.id,{...input,expectedEvidenceVersion:1,idempotencyKey:'correction',outcome:'not-met',note:'Correction after inspection'});assert.equal(next.goalStatus,'not-achieved');
  assert.equal((await db.query('SELECT * FROM acceptance_evidence WHERE run_id=$1',[f.run.id])).rows.length,2);
  await assert.rejects(db.query('UPDATE acceptance_evidence SET outcome=$2 WHERE run_id=$1',[f.run.id,'met']));
  await manager.recordEvidence(f.run.id,{...input,expectedEvidenceVersion:2,idempotencyKey:'final'});await store.transitionRun(f.run.id,0,'running');await store.transitionRun(f.run.id,1,'succeeded');
  const final=await manager.assessment(f.run.id);assert.equal(final.goalStatus,'achieved');assert.equal(final.automaticVerificationComplete,false);
  assert.equal(final.criteria[0].evidence?.details.verification,'owner-attestation');
  const cancelled=await fixture();await manager.review(cancelled.doc.id,cancelled.review);await manager.bind(cancelled.run.id,cancelled.bind);await store.transitionRun(cancelled.run.id,0,'cancelled');await assert.rejects(manager.recordEvidence(cancelled.run.id,input));
 });
 await t.test('required history failure rolls back contract, review, binding and evidence',async()=>{
  const f=await fixture();
  await db.exec(`CREATE FUNCTION reject_requirements_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind IN ('requirements.created','requirements.reviewed','run.requirements-bound','acceptance.evidence-recorded') THEN RAISE EXCEPTION 'requirements test rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_requirements_test_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_requirements_test_event();`);
  try{await assert.rejects(manager.create(f.project.id,{content:ownerRequirements,idempotencyKey:'rollback'}),/requirements test rejection/);await assert.rejects(manager.review(f.doc.id,f.review),/requirements test rejection/);}
  finally{await db.exec('DROP TRIGGER reject_requirements_test_event ON events; DROP FUNCTION reject_requirements_test_event();');}
  assert.equal((await manager.get(f.doc.id)).status,'draft');assert.equal((await manager.list(f.project.id)).items.length,1);
  await manager.review(f.doc.id,f.review);
  await db.exec(`CREATE FUNCTION reject_requirements_binding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind IN ('run.requirements-bound','acceptance.evidence-recorded') THEN RAISE EXCEPTION 'requirements test rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_requirements_binding BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_requirements_binding();`);
  try{await assert.rejects(manager.bind(f.run.id,f.bind),/requirements test rejection/);}finally{await db.exec('DROP TRIGGER reject_requirements_binding ON events; DROP FUNCTION reject_requirements_binding();');}
  await assert.rejects(manager.assessment(f.run.id));await manager.bind(f.run.id,f.bind);
  await db.exec(`CREATE FUNCTION reject_requirements_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='acceptance.evidence-recorded' THEN RAISE EXCEPTION 'requirements test rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_requirements_evidence BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_requirements_evidence();`);
  try{await assert.rejects(manager.recordEvidence(f.run.id,{kind:'owner-review',criterionId:'accepted',expectedEvidenceVersion:0,idempotencyKey:'rollback',outcome:'met',note:'Owner',acknowledgeOwnerReview:true}),/requirements test rejection/);}finally{await db.exec('DROP TRIGGER reject_requirements_evidence ON events; DROP FUNCTION reject_requirements_evidence();');}
  assert.equal((await manager.assessment(f.run.id)).criteria[0].evidenceVersion,0);
 });
 await t.test('owner API creates, reads historical revisions, reviews, binds and assesses without grants',async()=>{
  const origin='http://127.0.0.1:3000',token='a'.repeat(64),project=await store.createProject('Requirements API');
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{origin,token,database:()=>db});
  const response=await call('POST',`/projects/${project.id}/requirements`,{content:ownerRequirements,idempotencyKey:'api'});assert.equal(response.status,201);const doc=(await response.json()).data;
  assert.equal((await call('POST',`/requirements/${doc.id}/review`,{revision:1,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true})).status,200);
  assert.equal((await call('GET',`/requirements/${doc.id}/revisions/1`)).status,200);
  const run=await store.createRun(project.id);assert.equal((await call('POST',`/runs/${run.id}/requirements`,{requirementsId:doc.id,revision:1,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true})).status,200);
  assert.equal((await call('GET',`/runs/${run.id}/acceptance`)).status,200);
  const page=(await (await call('GET',`/projects/${project.id}/requirements?limit=1`)).json()).data;assert.equal(page.items.length,1);
  const evidence=await call('POST',`/runs/${run.id}/acceptance/evidence`,{kind:'owner-review',criterionId:'accepted',expectedEvidenceVersion:0,idempotencyKey:'owner',outcome:'met',note:'Reviewed',acknowledgeOwnerReview:true});assert.equal(evidence.status,200);assert.equal((await evidence.json()).data.goalStatus,'pending');
  assert.equal((await call('POST',`/runs/${run.id}/acceptance/evidence`,{kind:'delivery-confirmation',criterionId:'accepted',outcome:'met'})).status,400);
  assert.equal((await call('PATCH',`/requirements/${doc.id}`,{expectedRevision:1,content:ownerRequirements})).status,200);assert.equal((await call('DELETE',`/requirements/${doc.id}`)).status,405);
  assert.equal(doc.digest,requirementsDigest(doc.id,1,doc.content));
 });
}
