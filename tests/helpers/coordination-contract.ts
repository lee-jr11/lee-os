import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { createStateStore,createId,type StateDatabase } from '../../packages/database/src';
import { createCoordinator } from '../../packages/core/src/scheduler';
import { handleCoreRequest } from '../../packages/core/src/api/http';
export async function coordinationFixture(db:StateDatabase){
 const store=createStateStore(db),project=await store.createProject('Coordination '+randomUUID());
 const source=await store.createAutomation(project.id,'Source',{purpose:'Source definition'}),target=await store.createAutomation(project.id,'Follow-up',{purpose:'Frozen follow-up'});
 const coordinator=createCoordinator(db,{enabled:()=>true,clock:()=>new Date('2040-01-01T00:00:00.000Z')});
 const base={automationId:target.id,expectedAutomationVersion:1,idempotencyKey:'registration-'+randomUUID(),action:'queue-run-for-review',acknowledgeNoExecution:true};
 const schedule={...base,kind:'once',runAt:'2039-12-31T23:59:00.000Z'};
 const rule={...base,sourceAutomationId:source.id,eventKind:'run.succeeded'};
 async function succeed(){const run=await store.createRun(project.id,{automationId:source.id});await store.transitionRun(run.id,0,'running');await store.transitionRun(run.id,1,'succeeded');return run;}
 return {store,project,source,target,coordinator,base,schedule,rule,succeed};
}
export async function exerciseCoordination(db:StateDatabase,t:TestContext){
 await t.test('synthetic project archive blocks schedule and event work without changing child definitions',async()=>{
  const f=await coordinationFixture(db),schedule=await f.coordinator.create('schedule',f.project.id,f.schedule),sub=await f.coordinator.create('subscription',f.project.id,f.rule);
  await f.coordinator.command('schedule',String(schedule.id),{action:'enable',expectedVersion:0});
  await f.coordinator.command('subscription',String(sub.id),{action:'enable',expectedVersion:0});
  await f.succeed();
  await db.query("UPDATE projects SET status='archived' WHERE id=$1",[f.project.id]);
  const result=await f.coordinator.tick({});
  for(const row of [...result.schedules,...result.events].filter(r=>[schedule.id,sub.id].includes(r.triggerId))){assert.equal(row.outcome,'blocked');assert.equal(row.reason,'PROJECT_ARCHIVED');assert.equal(row.runId,null);}
  assert.equal((await f.coordinator.receipts(f.project.id)).items.length,2);
  assert.equal((await f.coordinator.get('schedule',String(schedule.id))).enabled,false);
  assert.equal((await f.coordinator.get('subscription',String(sub.id))).enabled,false);
  assert.equal((await f.store.getAutomation(f.target.id))?.status,'draft');
  assert.deepEqual(await f.coordinator.create('schedule',f.project.id,f.schedule),await f.coordinator.get('schedule',String(schedule.id)));
  await assert.rejects(f.coordinator.create('schedule',f.project.id,{...f.schedule,idempotencyKey:'new-archived'}));
  await assert.rejects(f.coordinator.command('subscription',String(sub.id),{action:'enable',expectedVersion:2}));
  // Administrative status fixture, not a restore command. Old v1 triggers cannot acquire v2 authority.
  await db.query("UPDATE projects SET status='draft' WHERE id=$1",[f.project.id]);
  await f.store.reviseAutomation(f.target.id,1,{revision:2});
  await assert.rejects(f.coordinator.command('subscription',String(sub.id),{action:'enable',expectedVersion:2}));
 });
 await t.test('disabled registration, replay, one-time due polling and concurrent duplicate protection',async()=>{
  const f=await coordinationFixture(db),a=await f.coordinator.create('schedule',f.project.id,f.schedule);
  assert.equal(a.enabled,false);assert.deepEqual(await f.coordinator.create('schedule',f.project.id,f.schedule),a);
  await assert.rejects(f.coordinator.create('schedule',f.project.id,{...f.schedule,runAt:'2039-12-31T23:58:00.000Z'}));
  assert.equal((await f.coordinator.tick({})).schedules.length,0);
  const enabled=await f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:0});assert.equal(enabled.version,1);
  await assert.rejects(f.coordinator.command('schedule',String(a.id),{action:'disable',expectedVersion:0}));
  await Promise.all([f.coordinator.tick({}),f.coordinator.tick({})]);
  const receipts=await f.coordinator.receipts(f.project.id);assert.equal(receipts.items.length,1);assert.equal(receipts.items[0].outcome,'queued');
  const run=await f.store.getRun(String(receipts.items[0].runId));assert.equal(run?.status,'queued');assert.deepEqual(run?.definition_snapshot,f.target.definition);assert.equal(run?.version,0);
  assert.equal((await f.store.listJobs(run!.id)).items.length,0);
  const current=await f.coordinator.get('schedule',String(a.id));assert.equal(current.enabled,false);assert.equal(current.nextRunAt,null);
  await assert.rejects(f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:2}));
  assert.equal((await f.coordinator.tick({})).schedules.length,0);
 });
 await t.test('missed intervals coalesce once, preserve phase, suppress overlaps and resume without a storm',async()=>{
  const f=await coordinationFixture(db),request={...f.base,kind:'interval',firstRunAt:'2039-12-31T23:00:00.000Z',intervalSeconds:60};
  const a=await f.coordinator.create('schedule',f.project.id,request);await f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:0});
  const result=(await f.coordinator.tick({})).schedules.find(r=>r.triggerId===a.id)!;assert.equal(result.skipped,60);assert.equal(result.nextRunAt,'2040-01-01T00:01:00.000Z');
  await f.coordinator.command('schedule',String(a.id),{action:'disable',expectedVersion:2});
  const later=createCoordinator(db,{enabled:()=>true,clock:()=>new Date('2040-01-01T00:10:30.000Z')});assert.equal((await later.tick({})).schedules.length,0);
  await later.command('schedule',String(a.id),{action:'enable',expectedVersion:3});
  const caught=(await later.tick({})).schedules.find(r=>r.triggerId===a.id)!;assert.equal(caught.outcome,'overlap');assert.equal(caught.scheduledFor,'2040-01-01T00:10:00.000Z');assert.equal(caught.nextRunAt,'2040-01-01T00:11:00.000Z');
  assert.equal((await f.store.listRuns(f.project.id)).items.filter(r=>r.automation_id===f.target.id).length,1);
  await later.command('schedule',String(a.id),{action:'disable',expectedVersion:5});
 });
 await t.test('daily local schedules coalesce downtime, persist occurrence receipts and resume in the future',async()=>{
  const f=await coordinationFixture(db),request={...f.base,kind:'daily',time:'08:00',timezone:'Africa/Accra',idempotencyKey:'calendar-daily-'+randomUUID()};
  const created=await f.coordinator.create('schedule',f.project.id,request);assert.equal(created.nextRunAt,'2040-01-01T08:00:00.000Z');assert.equal(created.timezone,'Africa/Accra');
  await f.coordinator.command('schedule',String(created.id),{action:'enable',expectedVersion:0});
  const resumed=createCoordinator(db,{enabled:()=>true,clock:()=>new Date('2040-01-04T09:00:00.000Z')});
  const due=(await resumed.tick({})).schedules.find(item=>item.triggerId===created.id)!;assert.equal(due.outcome,'queued');assert.equal(due.scheduledLocal,'2040-01-04T08:00');assert.equal(due.skipped,3);assert.equal(due.nextRunAt,'2040-01-05T08:00:00.000Z');
  let receipts=await resumed.receipts(f.project.id);const receipt=receipts.items.find(item=>item.scheduleId===created.id)!;assert.equal(receipt.timezone,'Africa/Accra');assert.equal(receipt.scheduledLocal,'2040-01-04T08:00');assert.equal(receipt.skippedOccurrences,3);
  await assert.rejects(db.query('UPDATE trigger_receipts SET scheduled_local=$2 WHERE id=$1',[receipt.id,'2040-01-04T09:00']));
  await resumed.command('schedule',String(created.id),{action:'disable',expectedVersion:2});
  const later=createCoordinator(db,{enabled:()=>true,clock:()=>new Date('2040-01-06T09:00:00.000Z')});
  const enabled=await later.command('schedule',String(created.id),{action:'enable',expectedVersion:3});assert.equal(enabled.nextRunAt,'2040-01-07T08:00:00.000Z');
  assert.equal((await later.tick({})).schedules.some(item=>item.triggerId===created.id),false);
  receipts=await later.receipts(f.project.id);assert.equal(receipts.items.filter(item=>item.scheduleId===created.id).length,1);
  const run=await f.store.getRun(String(receipt.runId));assert.equal(run?.status,'queued');assert.deepEqual(run?.definition_snapshot,f.target.definition);assert.equal((await f.store.listJobs(String(receipt.runId))).items.length,0);
 });
 await t.test('automation revision or pause blocks a trigger and requires a newly reviewed registration',async()=>{
  for(const revised of [true,false]){
   const f=await coordinationFixture(db),a=await f.coordinator.create('schedule',f.project.id,f.schedule);await f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:0});
   if(revised)await f.store.reviseAutomation(f.target.id,1,{purpose:'Changed'});else await db.query("UPDATE automations SET status='paused' WHERE id=$1",[f.target.id]);
   const result=(await f.coordinator.tick({})).schedules.find(r=>r.triggerId===a.id);
   if(revised){assert.equal(result?.outcome,'blocked');assert.equal(result?.runId,null);assert.equal((await f.coordinator.get('schedule',String(a.id))).enabled,false);await assert.rejects(f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:2}));}
   else{
    assert.equal(result,undefined);const held=await f.coordinator.get('schedule',String(a.id));assert.equal(held.enabled,true);assert.equal(held.version,1);assert.equal((await f.coordinator.receipts(f.project.id)).items.length,0);
    await db.query("UPDATE automations SET status='active' WHERE id=$1",[f.target.id]);const resumed=(await f.coordinator.tick({})).schedules.find(r=>r.triggerId===a.id);assert.equal(resumed?.outcome,'queued');
   }
  }
 });
 await t.test('event rules deliver only scoped events since activation; receipts prevent duplicate follow-ups',async()=>{
  const f=await coordinationFixture(db);await f.succeed();
  const a=await f.coordinator.create('subscription',f.project.id,f.rule);await f.coordinator.command('subscription',String(a.id),{action:'enable',expectedVersion:0});
  assert.equal((await f.coordinator.tick({})).events.length,0);
  await f.succeed();await Promise.all([f.coordinator.tick({}),f.coordinator.tick({})]);
  let receipts=await f.coordinator.receipts(f.project.id);assert.equal(receipts.items.length,1);assert.equal(receipts.items[0].outcome,'queued');assert.ok(receipts.items[0].sourceEventId);
  await f.coordinator.command('subscription',String(a.id),{action:'disable',expectedVersion:1});await f.succeed();
  await f.coordinator.command('subscription',String(a.id),{action:'enable',expectedVersion:2});assert.equal((await f.coordinator.tick({})).events.length,0);
  const targetRun=String(receipts.items[0].runId);await f.store.transitionRun(targetRun,0,'cancelled');await f.succeed();
  assert.equal((await f.coordinator.tick({})).events.filter(r=>r.triggerId===a.id).length,1);receipts=await f.coordinator.receipts(f.project.id);assert.equal(receipts.items.length,2);
  const first=await f.coordinator.receipts(f.project.id,null,1);assert.ok(first.nextCursor);assert.equal((await f.coordinator.receipts(f.project.id,first.nextCursor,1)).items.length,1);
  await assert.rejects(db.query('DELETE FROM trigger_receipts WHERE project_id=$1',[f.project.id]));
  await assert.rejects(db.query('UPDATE event_subscriptions SET event_kind=$2,version=version+1 WHERE id=$1',[a.id,'run.failed']));
 });
 await t.test('event targets cannot cross projects, self-trigger, change silently or invoke arbitrary actions',async()=>{
  const f=await coordinationFixture(db),other=await coordinationFixture(db);
  await assert.rejects(f.coordinator.create('subscription',f.project.id,{...f.rule,sourceAutomationId:other.source.id}));
  await assert.rejects(f.coordinator.create('subscription',f.project.id,{...f.rule,sourceAutomationId:f.target.id}));
  const a=await f.coordinator.create('subscription',f.project.id,f.rule);await f.coordinator.command('subscription',String(a.id),{action:'enable',expectedVersion:0});
  await f.store.reviseAutomation(f.target.id,1,{new:true});await f.succeed();
  const result=(await f.coordinator.tick({})).events.find(r=>r.triggerId===a.id)!;assert.equal(result.outcome,'blocked');assert.equal((await f.coordinator.get('subscription',String(a.id))).enabled,false);
 });
 await t.test('history failure rolls back due progress, queued run and receipt together; retry is safe',async()=>{
  const f=await coordinationFixture(db),a=await f.coordinator.create('schedule',f.project.id,f.schedule);await f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:0});
  await db.exec(`CREATE FUNCTION reject_coordination_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='schedule.fired' THEN RAISE EXCEPTION 'reject coordination history'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_coordination_history BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_coordination_history();`);
  try{await assert.rejects(f.coordinator.tick({}),/reject coordination history/);}finally{await db.exec('DROP TRIGGER reject_coordination_history ON events; DROP FUNCTION reject_coordination_history();');}
  assert.equal((await f.store.listRuns(f.project.id)).items.length,0);assert.equal((await f.coordinator.receipts(f.project.id)).items.length,0);assert.equal((await f.coordinator.get('schedule',String(a.id))).version,1);
  assert.equal((await f.coordinator.tick({})).schedules.find(r=>r.triggerId===a.id)?.outcome,'queued');
 });
 await t.test('owner API registers, enables, lists and polls bounded coordination without execution',async()=>{
  const f=await coordinationFixture(db),token='a'.repeat(64),origin='http://127.0.0.1:3000';
  const call=(method:string,path:string,input?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)}),{token,origin,database:()=>db,coordinationEnabled:()=>true});
  const request={...f.schedule,runAt:'2020-01-01T00:00:00.000Z'};
  const response=await call('POST',`/projects/${f.project.id}/schedules`,request);assert.equal(response.status,201);const a=(await response.json()).data;
  assert.equal((await call('POST',`/schedules/${a.id}/commands`,{action:'enable',expectedVersion:0})).status,200);
  assert.equal((await call('GET',`/schedules/${a.id}`)).status,200);
  assert.equal((await call('POST','/coordinator/tick',{})).status,200);
  assert.equal((await call('GET',`/projects/${f.project.id}/trigger-receipts?limit=1`)).status,200);
  assert.equal((await call('GET',`/projects/${f.project.id}/schedules?limit=1`)).status,200);
  const ruleResponse=await call('POST',`/projects/${f.project.id}/event-subscriptions`,f.rule);assert.equal(ruleResponse.status,201);const rule=(await ruleResponse.json()).data;
  assert.equal((await call('GET',`/event-subscriptions/${rule.id}`)).status,200);
  assert.equal((await call('GET',`/projects/${f.project.id}/event-subscriptions`)).status,200);
 });
 await t.test('event delivery audit failure leaves the event eligible and creates no partial follow-up',async()=>{
  const f=await coordinationFixture(db),rule=await f.coordinator.create('subscription',f.project.id,f.rule);
  await f.coordinator.command('subscription',String(rule.id),{action:'enable',expectedVersion:0});await f.succeed();
  await db.exec(`CREATE FUNCTION reject_delivery_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='subscription.delivered' THEN RAISE EXCEPTION 'reject delivery history'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_delivery_history BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_delivery_history();`);
  try{await assert.rejects(f.coordinator.tick({}),/reject delivery history/);}finally{await db.exec('DROP TRIGGER reject_delivery_history ON events; DROP FUNCTION reject_delivery_history();');}
  assert.equal((await f.coordinator.receipts(f.project.id)).items.length,0);assert.equal((await f.store.listRuns(f.project.id)).items.filter(r=>r.automation_id===f.target.id).length,0);
  assert.equal((await f.coordinator.tick({})).events.find(r=>r.triggerId===rule.id)?.outcome,'queued');
 });
 await t.test('bounded polling leaves remaining alarms durable; legacy cron rows stay inert',async()=>{
  const f=await coordinationFixture(db),ids:string[]=[];
  for(let i=0;i<4;i++){
   const a=await f.coordinator.create('schedule',f.project.id,{...f.schedule,idempotencyKey:'bounded-'+i});ids.push(String(a.id));
   await f.coordinator.command('schedule',String(a.id),{action:'enable',expectedVersion:0});
  }
  const first=await f.coordinator.tick({limit:2});assert.ok(first.schedules.length+first.events.length<=2);assert.equal(first.schedules.length,1);
  for(let i=0;i<4;i++)await f.coordinator.tick({limit:2});
  assert.equal((await f.coordinator.receipts(f.project.id)).items.length,4);assert.ok((await Promise.all(ids.map(id=>f.coordinator.get('schedule',id)))).every(r=>!r.enabled));
  const legacy=createId('schedule');await db.query("INSERT INTO schedules(id,automation_id,kind,expression,enabled,next_run_at) VALUES($1,$2,'cron','* * * * *',true,'2020-01-01')",[legacy,f.target.id]);
  assert.equal((await f.coordinator.tick({})).schedules.length,0);await assert.rejects(f.coordinator.get('schedule',legacy));
  await db.query('UPDATE schedules SET enabled=false WHERE id=$1',[legacy]);
 });
}
export async function exerciseLateCommit(db:StateDatabase,t:TestContext){
 await t.test('native PostgreSQL delivers a lower sequence that commits after a higher delivered event',async()=>{
  const f=await coordinationFixture(db),run=await f.succeed();
  const rule=await f.coordinator.create('subscription',f.project.id,f.rule);await f.coordinator.command('subscription',String(rule.id),{action:'enable',expectedVersion:0});
  let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r),low=createId('event'),high=createId('event');
  const delayed=db.transaction(async tx=>{await tx.query("INSERT INTO events(id,project_id,run_id,kind,entity_id) VALUES($1,$2,$3,'run.succeeded',$3)",[low,f.project.id,run.id]);entered();await hold;});
  await ready;
  try{
   await db.query("INSERT INTO events(id,project_id,run_id,kind,entity_id) VALUES($1,$2,$3,'run.succeeded',$3)",[high,f.project.id,run.id]);
   await f.coordinator.tick({});const receipts=await f.coordinator.receipts(f.project.id);assert.equal(receipts.items.length,1);assert.equal(receipts.items[0].sourceEventId,high);
  }finally{release();await delayed;}
  await f.coordinator.tick({});const receipts=await f.coordinator.receipts(f.project.id);assert.equal(receipts.items.length,2);assert.ok(receipts.items.some(r=>r.sourceEventId===low));
 });
}
