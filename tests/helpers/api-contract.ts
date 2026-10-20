import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { TestContext } from 'node:test';
import { createId, createStateStore, type StateDatabase } from '../../packages/database/src/index';
import { handleCoreRequest } from '../../packages/core/src/api/index';
export async function exerciseApi(db: StateDatabase,t: TestContext) {
 const token=randomBytes(32).toString('hex');const origin='http://127.0.0.1:3000';
 async function request(method:string,path:string,body?:unknown) {
  const response=await handleCoreRequest(new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,...(body === undefined ? {} : {'Content-Type':'application/json'})},body:body === undefined ? undefined : JSON.stringify(body)}),{token,origin,database:()=>db});
  const result=await response.json();
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Request-Id'),result.requestId);
  assert.match(result.requestId,/^[0-9a-f-]{36}$/);
  return {response,result};
 }
 const created=await request('POST','/projects',{name:' API project ',description:'State-only commands'});
 assert.equal(created.response.status,201);const project=created.result.data;assert.equal(project.name,'API project');
 await t.test('project DTOs, renames, locations, and bounded pagination',async()=>{
  assert.equal(created.response.headers.get('Location'),`/api/v1/projects/${project.id}`);
  assert.ok(!('created_at' in project));assert.ok(!('metadata' in project));assert.match(project.createdAt,/Z$/);
  const get=await request('GET',`/projects/${project.id}`);assert.equal(get.response.status,200);
  const renamed=await request('PATCH',`/projects/${project.id}`,{name:'Renamed API project'});assert.equal(renamed.result.data.id,project.id);
  for(let i=0;i<3;i++)assert.equal((await request('POST','/projects',{name:`Page ${i}`})).response.status,201);
  const first=await request('GET','/projects?limit=1');assert.equal(first.result.data.items.length,1);assert.ok(first.result.data.nextCursor);
  const second=await request('GET',`/projects?limit=1&after=${first.result.data.nextCursor}`);assert.notEqual(first.result.data.items[0].id,second.result.data.items[0].id);
  assert.equal((await request('GET','/projects?limit=0')).response.status,400);
  assert.equal((await request('GET','/projects?limit=1&limit=2')).response.status,400);
  assert.equal((await request('GET',`/projects/${createId('project')}`)).response.status,404);
 });
 const recipe=await request('POST',`/projects/${project.id}/automations`,{name:'A recipe',definition:{revision:1}});
 assert.equal(recipe.response.status,201);const automation=recipe.result.data;
 const input={automationId:automation.id,idempotencyKey:'api-request-1'};
 const queued=await request('POST',`/projects/${project.id}/runs`,input);assert.equal(queued.response.status,201);const run=queued.result.data;
 await t.test('run creation is queued, deduplicated, scoped, and snapshot-preserving',async()=>{
  assert.equal(run.status,'queued');assert.equal(Number(run.spentUsd),0);
  assert.equal((await request('POST',`/projects/${project.id}/runs`,input)).result.data.id,run.id);
  const revised=await request('PATCH',`/automations/${automation.id}`,{expectedVersion:1,definition:{revision:2}});assert.equal(revised.result.data.version,2);
  assert.equal((await request('PATCH',`/automations/${automation.id}`,{expectedVersion:1,definition:{revision:9}})).response.status,409);
  assert.deepEqual((await request('GET',`/runs/${run.id}`)).result.data.definitionSnapshot,{revision:1});
  const other=await request('POST','/projects',{name:'Other API project'});
  assert.equal((await request('POST',`/projects/${other.result.data.id}/runs`,{...input,idempotencyKey:'other-request'})).response.status,404);
  assert.equal((await request('GET',`/projects/${other.result.data.id}/runs`)).result.data.items.length,0);
  assert.equal((await request('POST',`/projects/${project.id}/runs`,{...input,status:'running'})).response.status,400);
  assert.equal((await request('POST',`/projects/${project.id}/runs`,{automationId:automation.id})).response.status,400);
  assert.equal((await request('POST',`/projects/${project.id}/automations`,{name:'Paid',costPolicy:'PAID'})).response.status,400);
  assert.equal((await request('GET',`/projects/${project.id}/automations`)).result.data.items.length,1);
 });
 await t.test('recorded spend follows scoped usage evidence on reads, lists and replay',async()=>{
  const other=await request('POST',`/projects/${project.id}/runs`,{idempotencyKey:'cost-evidence-other'});
  for(const [id,amount] of [[run.id,'0.010001'],[run.id,'0.020002'],[other.result.data.id,'9.000000']])
   await db.query('INSERT INTO model_usage(id,run_id,provider_id,model_id,cost_usd) VALUES($1,$2,$3,$4,$5)',[createId('usage'),id,'audit-fixture','synthetic-only',amount]);
  const check=async()=>{
   assert.equal((await request('GET',`/runs/${run.id}`)).result.data.spentUsd,'0.030003');
   const list=(await request('GET',`/projects/${project.id}/runs`)).result.data.items;
   assert.equal(list.find((r:{id:string})=>r.id===run.id).spentUsd,'0.030003');
   assert.equal(list.find((r:{id:string})=>r.id===other.result.data.id).spentUsd,'9.000000');
   assert.equal((await request('POST',`/projects/${project.id}/runs`,input)).result.data.spentUsd,'0.030003');
  };
  await check();
 });
 await t.test('owner commands enforce versions and do not expose worker writes',async()=>{
  assert.equal((await request('POST',`/runs/${run.id}/commands`,{action:'start',expectedVersion:0})).response.status,400);
  assert.equal((await request('POST',`/runs/${run.id}/commands`,{action:'succeed',expectedVersion:0})).response.status,400);
  const cancelled=await request('POST',`/runs/${run.id}/commands`,{action:'cancel',expectedVersion:0});assert.equal(cancelled.result.data.status,'cancelled');assert.equal(cancelled.result.data.version,1);
  assert.equal(cancelled.result.data.spentUsd,'0.030003');
  assert.equal((await request('POST',`/runs/${run.id}/commands`,{action:'cancel',expectedVersion:0})).response.status,409);
  assert.equal((await request('POST',`/runs/${run.id}/jobs`,{})).response.status,405);
  assert.equal((await request('POST',`/jobs/${createId('job')}/start`,{})).response.status,404);
  assert.equal((await request('GET',`/runs/${run.id}/jobs`)).result.data.items.length,0);
  const activity=await request('GET',`/projects/${project.id}/events`);assert.equal(activity.result.data.items.filter((event:{kind:string})=>event.kind==='run.cancelled').length,1);
 });
 await t.test('reviewed recovery retains checkpoint evidence and requires acknowledgement',async()=>{
  const store=createStateStore(db);const running=await store.createRun(project.id);const job=await store.createJob(running.id,'worker-fixture');
  await store.transitionRun(running.id,0,'running');const attempt=await store.startJob(job.id);
  await store.saveCheckpoint(job.id,0,attempt.attempt_count,{phase:'saved'});
  const stopped=await request('POST',`/runs/${running.id}/commands`,{action:'interrupt',expectedVersion:1,reason:'Operator inspected a lost worker'});assert.equal(stopped.result.data.status,'interrupted');
  assert.equal((await request('POST',`/runs/${running.id}/commands`,{action:'requeue',expectedVersion:2})).response.status,400);
  const requeued=await request('POST',`/runs/${running.id}/commands`,{action:'requeue',expectedVersion:2,acknowledgeExternalEffects:true});assert.equal(requeued.result.data.status,'queued');
  const evidence=await request('GET',`/jobs/${job.id}`);assert.deepEqual(evidence.result.data.checkpoint,{phase:'saved'});assert.equal(evidence.result.data.status,'pending');assert.equal(evidence.result.data.attempt,1);
 });
 await t.test('activity pagination and error responses are predictable',async()=>{
  const first=await request('GET',`/projects/${project.id}/events?limit=1`);assert.equal(first.result.data.items.length,1);assert.ok(first.result.data.nextCursor);
  const next=await request('GET',`/projects/${project.id}/events?limit=1&after=${first.result.data.nextCursor}`);assert.notEqual(first.result.data.items[0].id,next.result.data.items[0].id);
  assert.equal((await request('GET',`/projects/${project.id}/events?after=9223372036854775808`)).response.status,400);
  assert.equal((await request('GET','/projects/not-an-id')).response.status,400);
  assert.equal((await request('GET','/unknown')).response.status,404);
  const blocked=await request('DELETE',`/projects/${project.id}`);assert.equal(blocked.response.status,405);assert.equal(blocked.response.headers.get('Allow'),'GET, PATCH');
  const system=await request('GET','/system');assert.equal(system.result.data.executionEnabled,false);assert.equal(system.result.data.workerActionsExposed,true);
 });
}
