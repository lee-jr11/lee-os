import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { createStateStore, createId, type StateDatabase } from '../../packages/database/src';
import { createPlanner } from '../../packages/core/src/orchestrator/store';
import { createExecutionManager } from '../../packages/core/src/execution-manager/store';
import { handleCoreRequest } from '../../packages/core/src/api/http';
export async function exerciseExecution(db:StateDatabase,t:TestContext){
 const store=createStateStore(db),planner=createPlanner(db),manager=createExecutionManager(db);
 const project=await store.createProject('Execution contract');
 async function fixture(){
  const run=await store.createRun(project.id);
  await planner.create(run.id,{expectedRunVersion:0,goal:'Prepare a report',steps:[
   {key:'draft',title:'Draft report',kind:'model',model:{capabilities:['text'],inputTokens:1000,outputTokens:500}},
   {key:'review',title:'Lee reviews report',kind:'review',dependsOn:['draft']}
  ]});
  const preview=await manager.inspect(run.id);
  const input={expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]};
  return {run,preview,input};
 }
 await t.test('inspection is read-only and preparation binds reviewed plan to one atomic job batch',async()=>{
  const {run,preview,input}=await fixture();const before=(await store.listEvents(project.id)).length;
  assert.equal(preview.canPrepare,true);assert.equal(preview.executionEnabled,false);
  assert.equal(preview.jobs[0].dependenciesSatisfied,true);assert.equal(preview.jobs[1].dependenciesSatisfied,false);
  assert.equal((await store.listJobs(run.id)).items.length,0);await manager.inspect(run.id);
  assert.equal((await store.listEvents(project.id)).length,before);
  const [a,b]=await Promise.all([manager.prepare(run.id,input),manager.prepare(run.id,input)]);assert.deepEqual(a,b);
  const jobs=(await store.listJobs(run.id)).items;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.status==='pending'&&j.attempt_count===0));
  await assert.rejects(store.transitionRun(run.id,0,'running'),/cannot start/);
  await assert.rejects(store.createJob(run.id,'unreviewed-extra'),/cannot be extended/);
  const after=await manager.inspect(run.id);assert.deepEqual(after.preparation,a);assert.equal(after.canPrepare,false);
  assert.ok(after.blockingReasons.includes('ALREADY_PREPARED'));assert.deepEqual(after.jobs[1].dependsOn,['draft']);
  assert.ok(after.jobs.every(j=>!j.executionEnabled&&j.permissions.length===0));
  assert.equal((await store.getRun(run.id))?.version,0);assert.equal((await store.getRun(run.id))?.status,'queued');
  const events=await store.listEvents(project.id);assert.equal(events.filter(e=>e.run_id===run.id&&e.kind==='job.prepared').length,2);
  assert.equal(events.filter(e=>e.run_id===run.id&&e.kind==='run.jobs-prepared').length,1);
  await assert.rejects(manager.prepare(run.id,{...input,expectedRunVersion:1}));
  await assert.rejects(db.query('UPDATE run_preparations SET request=request WHERE run_id=$1',[run.id]),/immutable/);
  await assert.rejects(db.query('DELETE FROM prepared_jobs WHERE run_id=$1',[run.id]),/immutable/);
 });
 await t.test('wrong fingerprint, stale run, missing plan, and pre-existing jobs cannot prepare',async()=>{
  const {run,input}=await fixture();
  await assert.rejects(manager.prepare(run.id,{...input,reviewedPlanDigest:'0'.repeat(64)}));
  await assert.rejects(manager.prepare(run.id,{...input,expectedRunVersion:1}));
  const other=await fixture();await assert.rejects(manager.prepare(other.run.id,input));
  const noPlan=await store.createRun(project.id);await assert.rejects(manager.inspect(noPlan.id),/Plan not found/);
  await assert.rejects(manager.inspect(createId('run')),/Run not found/);
  await store.createJob(run.id,'legacy-job');assert.ok((await manager.inspect(run.id)).blockingReasons.includes('EXISTING_JOBS'));
  await assert.rejects(manager.prepare(run.id,input));
  await store.transitionRun(other.run.id,0,'running');await store.transitionRun(other.run.id,1,'interrupted','Worker fixture');
  await store.transitionRun(other.run.id,2,'queued');
  await assert.rejects(manager.prepare(other.run.id,{...other.input,expectedRunVersion:3}));
  assert.ok((await manager.inspect(other.run.id)).blockingReasons.includes('PLAN_RUN_VERSION_CHANGED'));
 });
 await t.test('job records, mappings, receipt and history roll back together on event failure',async()=>{
  const {run,input}=await fixture();
  await db.exec(`CREATE FUNCTION reject_preparation_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='run.jobs-prepared' THEN RAISE EXCEPTION 'reject preparation'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_preparation_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_preparation_event();`);
  try{await assert.rejects(manager.prepare(run.id,input),/reject preparation/);}
  finally{await db.exec('DROP TRIGGER reject_preparation_event ON events; DROP FUNCTION reject_preparation_event();');}
  for(const table of ['jobs','prepared_jobs','run_preparations'])assert.equal((await db.query(`SELECT * FROM ${table} WHERE run_id=$1`,[run.id])).rows.length,0);
  assert.equal((await store.listEvents(project.id)).filter(e=>e.run_id===run.id&&String(e.kind).includes('prepared')).length,0);
  await manager.prepare(run.id,input);assert.equal((await store.listJobs(run.id)).items.length,2);
 });
 await t.test('cancellation closes prepared jobs; retries return historical receipt without restarting work',async()=>{
  const {run,input}=await fixture();const saved=await manager.prepare(run.id,input);
  await store.transitionRun(run.id,0,'cancelled');
  assert.deepEqual(await manager.prepare(run.id,input),saved);
  const inspected=await manager.inspect(run.id);assert.equal(inspected.runStatus,'cancelled');assert.equal(inspected.canPrepare,false);
  assert.ok(inspected.jobs.every(j=>j.currentStatus==='cancelled'));assert.deepEqual(inspected.preparation?.receipt,saved.receipt);
  assert.equal((await store.listJobs(run.id)).items.length,2);
 });
 await t.test('concurrent cancellation and preparation leave no active or orphaned job batch',async()=>{
  const {run,input}=await fixture();
  const outcomes=await Promise.allSettled([manager.prepare(run.id,input),store.transitionRun(run.id,0,'cancelled')]);
  assert.equal(outcomes[1].status,'fulfilled');
  assert.equal((await store.getRun(run.id))?.status,'cancelled');
  const jobs=(await store.listJobs(run.id)).items;
  assert.ok(jobs.length===0 || jobs.length===2);assert.ok(jobs.every(j=>j.status==='cancelled'));
  const mappings=(await db.query('SELECT * FROM prepared_jobs WHERE run_id=$1',[run.id])).rows;
  assert.equal(mappings.length,jobs.length);
  assert.equal((await manager.inspect(run.id)).preparation!==null,jobs.length>0);
 });
 await t.test('prepared mappings cannot point to jobs from another run',async()=>{
  const a=await fixture(),b=await fixture();await manager.prepare(a.run.id,a.input);await manager.prepare(b.run.id,b.input);
  const job=(await store.listJobs(a.run.id)).items[0];
  const third=await store.createRun(project.id);const foreign=await store.createJob(third.id,'foreign-step');
  await assert.rejects(db.query('INSERT INTO prepared_jobs(job_id,run_id,step_key,blueprint) VALUES($1,$2,$3,$4)',
   [foreign.id,b.run.id,foreign.step_key,JSON.stringify({mode:'prepare-only',permissions:[],executionEnabled:false})]));
  await assert.rejects(db.query('UPDATE jobs SET step_key=$2 WHERE id=$1',[job.id,'changed-step']));
 });
 await t.test('owner API inspects and prepares jobs, but cannot start them',async()=>{
  const {run}=await fixture();const token='a'.repeat(64),origin='http://127.0.0.1:3000';
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(`${origin}/api/v1${path}`,{
   method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)
  }),{token,origin,database:()=>db});
  const preview=await call('GET',`/runs/${run.id}/execution`);assert.equal(preview.status,200);
  const input={expectedRunVersion:0,reviewedPlanDigest:(await preview.json()).data.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]};
  const response=await call('POST',`/runs/${run.id}/execution`,input);assert.equal(response.status,201);
  assert.equal(response.headers.get('Location'),`/api/v1/runs/${run.id}/execution`);
  assert.equal((await call('POST',`/runs/${run.id}/execution`,{...input,permissions:['network']})).status,400);
  assert.equal((await call('POST',`/runs/${run.id}/commands`,{action:'start',expectedVersion:0})).status,400);
  const jobs=await call('GET',`/runs/${run.id}/jobs`);assert.equal((await jobs.json()).data.items.length,2);
 });
}
