import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { createId,createStateStore,type StateDatabase } from '../../packages/database/src';
import { interpretRequest } from '../../packages/core/src/request-intake';
import { createRequestIntake } from '../../packages/core/src/request-intake/store';
import { createPlanner } from '../../packages/core/src/orchestrator/store';
import { createExecutionManager } from '../../packages/core/src/execution-manager/store';
import { handleCoreRequest } from '../../packages/core/src/api/http';
export const explicitDraft={goal:'Draft a short report and review it',steps:[{key:'draft',title:'Draft the report',kind:'model',dependsOn:[]},{key:'review',title:'Owner review',kind:'review',dependsOn:['draft']}],acknowledgeScope:true};
export function approvalFor(request:{version:number;proposalDigest:string}){return {expectedVersion:request.version,reviewedProposalDigest:request.proposalDigest,acknowledgePlanReview:true,action:'create-reviewed-run'};}
export async function exerciseIntake(db:StateDatabase,t:TestContext){
 const store=createStateStore(db),intake=createRequestIntake(db),project=await store.createProject('Request intake');
 const input=(text='Draft a short welcome message')=>({text,idempotencyKey:'intake-'+randomUUID()});
 await t.test('archived project blocks fresh intake and approval but preserves historical replays',async()=>{
  const isolated=await store.createProject('Retired intake'),body=input(),request=await intake.create(isolated.id,body),approval=approvalFor(request);
  const receipt=await intake.approve(request.id,approval),draft=await intake.create(isolated.id,input());
  await db.query("UPDATE projects SET status='archived' WHERE id=$1",[isolated.id]);
  assert.equal((await intake.create(isolated.id,body)).id,request.id);
  assert.deepEqual(await intake.approve(request.id,approval),receipt);
  await assert.rejects(intake.create(isolated.id,input()));
  await assert.rejects(intake.approve(draft.id,approvalFor(draft)));
  assert.equal((await store.listRuns(isolated.id)).items.length,1);
 });
 await t.test('English intake is durable, scoped and deduplicated without creating runtime work',async()=>{
  const body=input(),[a,b]=await Promise.all([intake.create(project.id,body),intake.create(project.id,body)]);assert.deepEqual(a,b);
  assert.equal(a.text,body.text);assert.equal(a.status,'draft');assert.equal(a.proposal.interpreter,'rules-v1');assert.equal(a.proposal.executionEnabled,false);
  await assert.rejects(intake.create(project.id,{...body,text:'Changed request'}));
  assert.equal((await store.listRuns(project.id)).items.length,0);
  const other=await store.createProject('Other request project'),second=await intake.create(other.id,body);assert.notEqual(second.id,a.id);
  assert.ok((await intake.list(project.id)).items.every(r=>r.id!==second.id));
  assert.equal((await db.query("SELECT * FROM events WHERE entity_id=$1 AND kind='request.created'",[a.id])).rows.length,1);
 });
 await t.test('unsupported compound goals stay unapproved and create no run or plan',async()=>{
  const isolated=await store.createProject('Core-idea audit regression');
  for(const text of ['Draft a report and deploy it','Write a script and test it','Draft a report and monitor it']){
   const request=await intake.create(isolated.id,input(text));assert.equal(request.status,'needs-clarification');assert.equal(request.text,text);await assert.rejects(intake.approve(request.id,approvalFor(request)));
  }
  // Seed an old persisted rule draft without rewriting immutable history.
  const legacyId=createId('request'),legacyText='Draft a report and deploy it',legacy=interpretRequest(legacyText);legacy.questions=[];
  await db.transaction(async tx=>{await tx.query('INSERT INTO intake_requests(id,project_id,request_key,source_text,creation_input,status) VALUES($1,$2,$3,$4,$5,$6)',[legacyId,isolated.id,'legacy-'+randomUUID(),legacyText,JSON.stringify({text:legacyText,idempotencyKey:'legacy'}),'draft']);
  await tx.query('INSERT INTO intake_revisions(request_id,version,proposal) VALUES($1,0,$2)',[legacyId,JSON.stringify(legacy)]);});
  const saved=await intake.get(legacyId);assert.equal(saved.status,'draft');assert.equal(saved.proposal.questions.length,0);await assert.rejects(intake.approve(legacyId,approvalFor(saved)));
  assert.equal((await intake.get(legacyId)).text,legacyText);
  assert.equal((await store.listRuns(isolated.id)).items.length,0);
 });
 await t.test('clarification must be resolved by an explicit versioned edit; original text and old revisions remain',async()=>{
  const body=input('Email this every Wednesday'),created=await intake.create(project.id,body);assert.equal(created.status,'needs-clarification');assert.ok(created.proposal.questions.length);
  await assert.rejects(intake.approve(created.id,approvalFor(created)));
  const edited=await intake.edit(created.id,{...explicitDraft,expectedVersion:0});assert.equal(edited.version,1);assert.equal(edited.proposalVersion,1);assert.equal(edited.status,'draft');assert.equal(edited.text,body.text);
  assert.notEqual(edited.proposalDigest,created.proposalDigest);assert.equal(edited.proposal.interpreter,'owner-edit');
  await assert.rejects(intake.edit(created.id,{...explicitDraft,expectedVersion:0}));await assert.rejects(intake.approve(created.id,approvalFor(created)));
  const revisions=(await db.query('SELECT * FROM intake_revisions WHERE request_id=$1 ORDER BY version',[created.id])).rows;assert.equal(revisions.length,2);
  assert.deepEqual(revisions[0].proposal,created.proposal);
  await assert.rejects(db.query('UPDATE intake_revisions SET proposal=proposal WHERE request_id=$1',[created.id]));
  await assert.rejects(db.query('UPDATE intake_requests SET source_text=$2,version=version+1 WHERE id=$1',[created.id,'Rewritten history']));
 });
 await t.test('exact reviewed proposal creates one queued run and immutable plan; replay survives run cancellation',async()=>{
  const request=await intake.create(project.id,input('Write a welcome message then check the wording'));
  const approval=approvalFor(request),[a,b]=await Promise.all([intake.approve(request.id,approval),intake.approve(request.id,approval)]);assert.deepEqual(a,b);
  const run=await store.getRun(a.runId);assert.equal(run?.project_id,project.id);assert.equal(run?.status,'queued');assert.equal(run?.version,0);assert.equal(run?.automation_id,null);
  assert.equal(run?.definition_snapshot.sourceRequestId,request.id);assert.equal((await store.listJobs(a.runId)).items.length,0);
  const plan=await createPlanner(db).get(a.runId);assert.equal((plan.plan as {executionEnabled:boolean}).executionEnabled,false);
  const prepared=await createExecutionManager(db).inspect(a.runId);assert.equal(prepared.canPrepare,true);assert.equal(prepared.preparation,null);
  const current=await intake.get(request.id);assert.equal(current.status,'approved');assert.equal(current.version,1);assert.equal(current.proposalDigest,request.proposalDigest);
  await assert.rejects(intake.approve(request.id,{...approval,expectedVersion:1}));await assert.rejects(intake.edit(request.id,{...explicitDraft,expectedVersion:1}));
  await store.transitionRun(a.runId,0,'cancelled');assert.deepEqual(await intake.approve(request.id,approval),a);
  assert.equal((await db.query('SELECT * FROM intake_approvals WHERE request_id=$1',[request.id])).rows.length,1);
 });
 await t.test('plain-English clarification creates a new draft revision while preserving the original request',async()=>{
  const original=await intake.create(project.id,input('Help me automate something'));assert.equal(original.status,'needs-clarification');
  const clarified=await intake.clarify(original.id,{expectedVersion:0,text:'Draft a friendly welcome message then review the message'});
  assert.equal(clarified.status,'draft');assert.equal(clarified.version,1);assert.equal(clarified.proposal.interpreter,'rules-v1');assert.equal(clarified.text,original.text);
  assert.notEqual(clarified.proposalDigest,original.proposalDigest);assert.ok(clarified.proposal.goal.startsWith('Draft'));
  await assert.rejects(intake.clarify(original.id,{expectedVersion:0,text:'Draft something else'}));await assert.rejects(intake.approve(original.id,approvalFor(original)));
  assert.ok((await intake.approve(original.id,approvalFor(clarified))).runId);
 });
 await t.test('digest binds request identity and revision; cancellation never becomes an approval',async()=>{
  const a=await intake.create(project.id,input()),b=await intake.create(project.id,input());
  await assert.rejects(intake.approve(a.id,approvalFor(b)));
  const cancelled=await intake.cancel(a.id,{action:'cancel',expectedVersion:0});assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.proposalDigest,a.proposalDigest);
  await assert.rejects(intake.approve(a.id,approvalFor(a)));await assert.rejects(intake.cancel(a.id,{action:'cancel',expectedVersion:0}));
 });
 await t.test('approval races with edits/cancellation never create a run from an unreviewed revision',async()=>{
  for(const cancel of [false,true]){
   const request=await intake.create(project.id,input());
   await Promise.allSettled([intake.approve(request.id,approvalFor(request)),cancel?intake.cancel(request.id,{action:'cancel',expectedVersion:0}):intake.edit(request.id,{...explicitDraft,expectedVersion:0})]);
   const current=await intake.get(request.id),approvals=(await db.query('SELECT * FROM intake_approvals WHERE request_id=$1',[request.id])).rows;
   assert.equal(approvals.length,current.status==='approved'?1:0);
   if(approvals.length)assert.equal((approvals[0].receipt as {reviewedProposalDigest:string}).reviewedProposalDigest,request.proposalDigest);
  }
 });
 await t.test('history failure rolls back approval, run, plan and terminal request state together',async()=>{
  const request=await intake.create(project.id,input());
  await db.exec(`CREATE FUNCTION reject_intake_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='request.approved' THEN RAISE EXCEPTION 'reject intake history'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_intake_history BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_intake_history();`);
  try{await assert.rejects(intake.approve(request.id,approvalFor(request)),/reject intake history/);}finally{await db.exec('DROP TRIGGER reject_intake_history ON events; DROP FUNCTION reject_intake_history();');}
  assert.equal((await intake.get(request.id)).status,'draft');assert.equal((await db.query('SELECT * FROM intake_approvals WHERE request_id=$1',[request.id])).rows.length,0);
  assert.equal((await db.query("SELECT * FROM runs WHERE definition_snapshot->>'sourceRequestId'=$1",[request.id])).rows.length,0);
  assert.ok((await intake.approve(request.id,approvalFor(request))).runId);
 });
 await t.test('owner API previews, creates, edits, reads, paginates and approves without inference',async()=>{
  const origin='http://127.0.0.1:3000',token='a'.repeat(64);
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{token,origin,database:()=>db});
  const response=await call('POST',`/projects/${project.id}/requests`,input('Build me an automation'));assert.equal(response.status,201);const request=(await response.json()).data;
  assert.equal(response.headers.get('Location'),`/api/v1/requests/${request.id}`);assert.equal((await call('GET',`/requests/${request.id}`)).status,200);
  const edited=await call('PATCH',`/requests/${request.id}`,{...explicitDraft,expectedVersion:0});assert.equal(edited.status,200);const current=(await edited.json()).data;
  const approved=await call('POST',`/requests/${request.id}/approve`,approvalFor(current));assert.equal(approved.status,200);assert.equal((await approved.json()).data.executionEnabled,false);
  const page=(await (await call('GET',`/projects/${project.id}/requests?limit=1`)).json()).data;assert.equal(page.items.length,1);assert.ok(page.nextCursor);
  assert.equal((await call('GET',`/projects/${project.id}/requests?after=${page.nextCursor}&limit=1`)).status,200);
  const toCancel=(await (await call('POST',`/projects/${project.id}/requests`,input())).json()).data;
  assert.equal((await call('POST',`/requests/${toCancel.id}/commands`,{action:'cancel',expectedVersion:0})).status,200);
  assert.equal((await call('POST','/requests/preview',{text:'Draft a welcome message'})).status,200);
 });
}
