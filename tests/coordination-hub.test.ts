import test from 'node:test';
import assert from 'node:assert/strict';
import { OwnerClient } from '../apps/hub/lib/owner-client';
import { readCoordination,registrationBody,type Trigger,type TriggerDraft } from '../apps/hub/lib/coordination';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { coordinationFixture } from './helpers/coordination-contract';
test('Hub registration bodies bind reviewed versions, local calendar time and queue-only authority',()=>{
 const draft:TriggerDraft={mode:'once',target:{id:'target',name:'Target',version:3,status:'draft',definition:{}},instant:'2030-01-01T00:00:00.000Z',localDate:'2030-01-02',localTime:'08:30',timezone:'Africa/Accra',dayOfWeek:1,intervalSeconds:60,source:'source',eventKind:'run.succeeded'};
 assert.deepEqual(registrationBody(draft,'key'),{automationId:'target',expectedAutomationVersion:3,idempotencyKey:'key',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'once',localDate:draft.localDate,localTime:draft.localTime,timezone:draft.timezone});
 assert.throws(()=>registrationBody({...draft,localDate:'2030-02-30'},'key'));
 for(const instant of ['2030-01-01T00:00:00Z','2030-02-30T00:00:00.000Z','2030-01-01T00:00:00.000+01:00','2019-01-01T00:00:00.000Z'])assert.throws(()=>registrationBody({...draft,mode:'interval',instant},'key'));
 assert.throws(()=>registrationBody({...draft,mode:'interval',intervalSeconds:59},'key'));
 assert.equal('runAt' in registrationBody({...draft,mode:'interval'},'key'),false);
 assert.equal('firstRunAt' in registrationBody({...draft,mode:'event'},'key'),false);
 assert.equal((registrationBody({...draft,mode:'weekly'},'key') as {dayOfWeek:number}).dayOfWeek,1);
});
test('Hub coordination client registers disabled, fences commands and queues without jobs',{timeout:120000},async()=>{
 const db=await createEmbeddedDatabase();try{
  await migrate(db);const f=await coordinationFixture(db);const token='e'.repeat(64),origin='http://localhost:3102';
  const client=new OwnerClient(origin,token,async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','localhost:3102');return handleCoreRequest(new Request(String(url),{...init,headers}),{token,origin,database:()=>db,coordinationEnabled:()=>true});});
  try{
   const before=await readCoordination(client,f.project.id);assert.equal(before.automations.items.length,2);assert.equal(before.coordinator.executionEnabled,false);
   const target=before.automations.items.find(a=>a.id===f.target.id)!;
   const body=registrationBody({mode:'once',target,instant:'',localDate:'2020-01-01',localTime:'00:00',timezone:'Africa/Accra',dayOfWeek:1,intervalSeconds:60,source:'',eventKind:'run.succeeded'},'hub-schedule');
   const path=`/projects/${f.project.id}/schedules`;const saved=await client.call<Trigger>('POST',path,body);assert.equal(saved.enabled,false);assert.equal((await client.call<Trigger>('POST',path,body)).id,saved.id);
   await client.call('POST',`/schedules/${saved.id}/commands`,{action:'enable',expectedVersion:0});
   await assert.rejects(client.call('POST',`/schedules/${saved.id}/commands`,{action:'disable',expectedVersion:0}));
   await client.call('POST','/coordinator/tick',{limit:10});const after=await readCoordination(client,f.project.id);assert.equal(after.receipts.items.length,1);assert.equal(after.receipts.items[0].outcome,'queued');
   const run=await f.store.getRun(after.receipts.items[0].runId!);assert.equal(run?.status,'queued');assert.equal((await f.store.listJobs(run!.id)).items.length,0);
   const rule=await client.call<Trigger>('POST',`/projects/${f.project.id}/event-subscriptions`,registrationBody({mode:'event',target,instant:'',localDate:'',localTime:'',timezone:'Africa/Accra',dayOfWeek:1,intervalSeconds:0,source:f.source.id,eventKind:'run.succeeded'},'hub-event'));
   assert.equal(rule.enabled,false);await client.call('POST',`/event-subscriptions/${rule.id}/commands`,{action:'enable',expectedVersion:0});await client.call('POST',`/event-subscriptions/${rule.id}/commands`,{action:'disable',expectedVersion:1});
   assert.equal((await readCoordination(client,f.project.id)).subscriptions.items[0].enabled,false);
  }finally{client.close();}
 }finally{await db.close();}
});
