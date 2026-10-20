import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createStateStore,type StateDatabase} from '../../packages/database/src';
import {requirementsContent,type RequirementsContent} from '../../packages/core/src/requirements';
import {createRequirementsManager} from '../../packages/core/src/requirements/store';
import {createPlanner} from '../../packages/core/src/orchestrator/store';
import {createExecutionManager} from '../../packages/core/src/execution-manager/store';
import {planDigest} from '../../packages/core/src/execution-manager';
import {handleCoreRequest} from '../../packages/core/src/api/http';
import {syntheticRegistry} from '../../scripts/lib/synthetic-provider';
import type {CapabilityPlan} from '../../packages/core/src/orchestrator/capability-plan';

export async function lessonContract(){return requirementsContent.parse(JSON.parse(await readFile('schemas/examples/lesson-requirements.json','utf8')));}
export async function capabilityFixture(db:StateDatabase,value?:RequirementsContent){
 const content=value??await lessonContract();
 const store=createStateStore(db),manager=createRequirementsManager(db),project=await store.createProject('P0.2 '+randomUUID()),run=await store.createRun(project.id);
 const doc=await manager.create(project.id,{content,idempotencyKey:randomUUID()});
 await manager.review(doc.id,{revision:1,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true});
 await manager.bind(run.id,{requirementsId:doc.id,revision:1,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true});
 const input={mode:'capability-first' as const,expectedRunVersion:0,reviewedRequirementsDigest:doc.digest,modelBudget:{inputTokens:1000,outputTokens:500}};
 return {store,manager,project,run,doc,input};
}
export async function exerciseCapabilityPlanning(db:StateDatabase,t:TestContext){
 const now=new Date('2026-10-19T12:00:00Z');
 await t.test('capability plan is immutable, deduplicated, scoped to the bound revision and grants no execution',async()=>{
  const f=await capabilityFixture(db);let probes=0;const callsBefore=(await db.query('SELECT id FROM provider_calls')).rows.length;
  const planner=createPlanner(db,{routing:()=>{probes++;return {now,registry:syntheticRegistry(now)};}});
  const [a,b]=await Promise.all([planner.create(f.run.id,f.input),planner.create(f.run.id,f.input)]);assert.deepEqual(a,b);assert.equal(probes,1);
  const plan=a.plan as CapabilityPlan;assert.equal(plan.plannerVersion,'3');assert.equal(plan.contract.digest,f.doc.digest);
  assert.equal(plan.capabilities.find(n=>n.id==='text_generation')?.route.status,'selected');
  assert.equal(plan.routingStatus,'blocked');assert.ok(plan.coverage.every(r=>r.status==='mapped'));assert.deepEqual(plan.contract.content,f.doc.content);
  assert.deepEqual(plan.steps,[]);assert.deepEqual(plan.permissions,[]);assert.equal(plan.executionEnabled,false);
  assert.equal((await f.store.listJobs(f.run.id)).items.length,0);assert.equal((await f.store.getRun(f.run.id))?.version,0);
  assert.equal((await db.query('SELECT id FROM provider_calls')).rows.length,callsBefore);
  assert.equal((await f.manager.assessment(f.run.id)).goalStatus,'pending');
  assert.equal((await f.store.listEvents(f.project.id)).filter(e=>e.kind==='run.planned').length,1);
  await f.manager.revise(f.doc.id,{expectedRevision:1,content:{...f.doc.content,goal:'Changed later'}});
  await f.store.transitionRun(f.run.id,0,'cancelled');
  assert.deepEqual(await planner.create(f.run.id,f.input),a);assert.equal(probes,1);assert.deepEqual(await planner.get(f.run.id),a);
  await assert.rejects(planner.create(f.run.id,{...f.input,modelBudget:{inputTokens:1000,outputTokens:600}}));
  await assert.rejects(db.query('UPDATE run_plans SET plan=$2 WHERE run_id=$1',[f.run.id,JSON.stringify(plan)]),/immutable/);
 });
 await t.test('new plans reject missing bindings, stale run/digest, existing jobs and manual bound-run bypass',async()=>{
  const f=await capabilityFixture(db),planner=createPlanner(db),unbound=await f.store.createRun(f.project.id);
  await assert.rejects(planner.create(unbound.id,f.input));
  await assert.rejects(planner.create(f.run.id,{...f.input,expectedRunVersion:1}));
  const other=await capabilityFixture(db);await assert.rejects(planner.create(f.run.id,{...f.input,reviewedRequirementsDigest:other.doc.digest}));
  await assert.rejects(planner.create(f.run.id,{expectedRunVersion:0,goal:'Ignore contract',steps:[{key:'x',kind:'review',title:'Ignore'}]}));
  await f.store.createJob(f.run.id,'already');await assert.rejects(planner.create(f.run.id,f.input));
  await other.store.transitionRun(other.run.id,0,'cancelled');await assert.rejects(planner.create(other.run.id,other.input));
 });
 await t.test('bound historical revision remains authoritative after document revision',async()=>{
  const f=await capabilityFixture(db);await f.manager.revise(f.doc.id,{expectedRevision:1,content:{...f.doc.content,goal:'Later goal'}});
  const result=await createPlanner(db).create(f.run.id,f.input),plan=result.plan as CapabilityPlan;
  assert.equal(plan.goal,f.doc.content.goal);assert.equal(plan.contract.revision,1);assert.equal(plan.contract.digest,f.doc.digest);
 });
 await t.test('conflicting concurrent planning inputs have one durable winner',async()=>{
  const f=await capabilityFixture(db),planner=createPlanner(db);
  const results=await Promise.allSettled([planner.create(f.run.id,f.input),planner.create(f.run.id,{...f.input,modelBudget:{inputTokens:2000,outputTokens:500}})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await f.store.listEvents(f.project.id)).filter(e=>e.kind==='run.planned').length,1);
 });
 await t.test('routing gaps and covered routes both remain non-preparable until P0.3',async()=>{
  const content=await lessonContract();const simple:RequirementsContent={...content,requirements:[{id:'review',statement:'Owner reviews supplied text',required:true,capabilityIds:['owner_review']}],capabilities:['owner_review'],acceptanceCriteria:[{id:'reviewed',description:'Owner confirms review',requirementIds:['review'],required:true,evidenceKind:'owner-review'}]};
  for(const value of [content,simple]){
   const f=await capabilityFixture(db,value),saved=await createPlanner(db,value===simple?{routing:()=>{throw Error('Owner-only routing must not probe AI');}}:{}).create(f.run.id,f.input),execution=createExecutionManager(db);
   const p=saved.plan as CapabilityPlan;if(value===simple)assert.equal(p.routingStatus,'covered');
   const inspection=await execution.inspect(f.run.id);assert.equal(inspection.canPrepare,false);assert.deepEqual(inspection.blockingReasons,['EXECUTION_ENVELOPE_REQUIRED']);
   await assert.rejects(execution.prepare(f.run.id,{expectedRunVersion:0,reviewedPlanDigest:planDigest(f.run.id,0,p),acknowledgePlanReview:true,mode:'prepare-only',permissions:[]}));
   assert.equal((await f.store.listJobs(f.run.id)).items.length,0);assert.equal((await f.manager.assessment(f.run.id)).goalStatus,'pending');
  }
 });
 await t.test('plan and history roll back together on routing or event failure',async()=>{
  const f=await capabilityFixture(db);
  await assert.rejects(createPlanner(db,{routing:()=>{throw Error('probe failed');}}).create(f.run.id,f.input));
  await db.exec(`CREATE FUNCTION reject_capability_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='run.planned' THEN RAISE EXCEPTION 'reject capability event'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_capability_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_capability_event();`);
  try{await assert.rejects(createPlanner(db).create(f.run.id,f.input),/reject capability event/);}
  finally{await db.exec('DROP TRIGGER reject_capability_event ON events; DROP FUNCTION reject_capability_event();');}
  assert.equal((await db.query('SELECT * FROM run_plans WHERE run_id=$1',[f.run.id])).rows.length,0);
  assert.equal((await f.store.listEvents(f.project.id)).filter(e=>e.kind==='run.planned').length,0);
 });
 await t.test('owner API persists and reads capability plans with protected methods and body validation',async()=>{
  const f=await capabilityFixture(db),origin='http://127.0.0.1:3000',token='a'.repeat(64);
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{origin,token,database:()=>db});
  const path=`/runs/${f.run.id}/plan`;assert.equal((await call('POST',path,f.input)).status,201);
  const response=await call('GET',path);assert.equal(response.status,200);assert.equal((await response.json()).data.plan.plannerVersion,'3');
  assert.equal((await call('GET',`/runs/${f.run.id}/execution`)).status,200);
  assert.equal((await call('DELETE',path)).status,405);assert.equal((await call('GET',path+'?registry=forged')).status,400);
  assert.equal((await call('GET','/capabilities/catalog')).status,200);assert.equal((await call('POST','/capabilities/catalog',{})).status,405);
 });
}
