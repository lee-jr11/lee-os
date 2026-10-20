import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { createStateStore, type StateDatabase } from '../../packages/database/src/index';
import { createPlanner } from '../../packages/core/src/orchestrator/store';
import { handleCoreRequest } from '../../packages/core/src/api/http';
export async function exercisePlanning(db: StateDatabase,t: TestContext) {
 const store=createStateStore(db); const planner=createPlanner(db);
 const project=await store.createProject('Planning contract');
 const run=await store.createRun(project.id);
 const input={expectedRunVersion:0,goal:'Review a weekly workflow',steps:[
  {key:'review',title:'Review result',kind:'review',dependsOn:['draft']},
  {key:'draft',title:'Draft result',kind:'model',dependsOn:[]}
 ]};
 await t.test('plan and history commit once; replay is stable and cannot dispatch',async()=>{
  const [saved,concurrent]=await Promise.all([planner.create(run.id,input),planner.create(run.id,input)]);
  assert.deepEqual(concurrent,saved);
  assert.deepEqual(await planner.create(run.id,input),saved);
  assert.deepEqual(await planner.get(run.id),saved);
  const plan=saved.plan as {steps:{key:string;route:{executable:boolean}}[];executionEnabled:boolean;status:string};
  assert.deepEqual(plan.steps.map(s=>s.key),['draft','review']);
  assert.equal(plan.executionEnabled,false); assert.equal(plan.status,'blocked');
  assert.ok(plan.steps.every(s=>s.route.executable===false));
  assert.equal((await store.listJobs(run.id)).items.length,0);
  assert.equal((await store.getRun(run.id))?.version,0);
  assert.equal((await store.listEvents(project.id)).filter(e=>e.kind==='run.planned').length,1);
  await assert.rejects(planner.create(run.id,{...input,goal:'Different goal'}));
  await assert.rejects(db.query('UPDATE run_plans SET run_version=1 WHERE run_id=$1',[run.id]),/immutable/);
  await store.transitionRun(run.id,0,'cancelled');
  assert.deepEqual(await planner.create(run.id,input),saved); // Replay is historical, not renewed permission.
 });
 await t.test('new plans reject stale or nonqueued runs and missing records',async()=>{
  const fresh=await store.createRun(project.id);
  await assert.rejects(planner.create(fresh.id,{...input,expectedRunVersion:1}));
  await store.transitionRun(fresh.id,0,'cancelled');
  await assert.rejects(planner.create(fresh.id,{...input,expectedRunVersion:1}));
  await assert.rejects(planner.get(fresh.id),/not found/);
 });
 await t.test('plan creation rolls back if history cannot be written',async()=>{
  const fresh=await store.createRun(project.id);
  await db.exec(`CREATE FUNCTION reject_plan_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='run.planned' THEN RAISE EXCEPTION 'reject plan'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_plan_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_plan_event();`);
  try {await assert.rejects(planner.create(fresh.id,input),/reject plan/);}
  finally {await db.exec('DROP TRIGGER reject_plan_event ON events; DROP FUNCTION reject_plan_event();');}
  await assert.rejects(planner.get(fresh.id),/not found/);
 });
 await t.test('authenticated plan endpoint creates and reads snapshots',async()=>{
  const fresh=await store.createRun(project.id);const token='a'.repeat(64);const origin='http://127.0.0.1:3000';
  const call=(method:string,body?:unknown)=>handleCoreRequest(new Request(`${origin}/api/v1/runs/${fresh.id}/plan`,{
   method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined
  }),{token,origin,database:()=>db});
  assert.equal((await call('GET')).status,404);
  assert.equal((await call('POST',input)).status,201);
  const response=await call('GET');assert.equal(response.status,200);
  assert.equal((await response.json()).data.runId,fresh.id);
  assert.equal((await call('POST',{...input,executionEnabled:true})).status,400);
 });
 await t.test('model requirements and blocked routing decisions persist as historical snapshots',async()=>{
  const fresh=await store.createRun(project.id);
  const modelInput={...input,steps:[{key:'draft',title:'Draft',kind:'model',model:{capabilities:['text'],inputTokens:1000,outputTokens:500}}]};
  const saved=await planner.create(fresh.id,modelInput);
  const plan=saved.plan as {plannerVersion:string;steps:{modelDecision:{status:string;selected:unknown}}[]};
  assert.equal(plan.plannerVersion,'2');assert.equal(plan.steps[0].modelDecision.status,'blocked');
  assert.equal(plan.steps[0].modelDecision.selected,null);
  assert.deepEqual(await planner.get(fresh.id),saved);
  assert.deepEqual(await planner.create(fresh.id,modelInput),saved);
  assert.equal((await store.listJobs(fresh.id)).items.length,0);
 });

}
