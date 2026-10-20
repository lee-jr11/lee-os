import test from 'node:test';
import assert from 'node:assert/strict';
import { sequenceDefinition,readSequence,queueAutomationRun,saveReviewedSequence } from '../apps/hub/lib/automations';
import { readWorkspace,type Run } from '../apps/hub/lib/workflow';
import { OwnerClient } from '../apps/hub/lib/owner-client';
import type { Automation } from '../apps/hub/lib/coordination';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
test('reusable sequences are bounded, ordered and recognized after JSON key reordering',()=>{
 const d=sequenceDefinition(' A goal ','First task\nSecond task');assert.equal(d.goal,'A goal');assert.equal(d.steps.at(-1)?.kind,'review');assert.deepEqual(d.steps[1].dependsOn,['step_1']);
 const reordered={steps:d.steps.map(s=>({dependsOn:s.dependsOn,kind:s.kind,title:s.title,key:s.key})),goal:d.goal,format:d.format};assert.deepEqual(readSequence(reordered),d);
 for(const bad of [null,{...d,extra:true},{...d,steps:d.steps.slice(0,-1)},{...d,steps:[{...d.steps[0],kind:'python'},...d.steps.slice(1)]}])assert.equal(readSequence(bad),null);
 assert.throws(()=>sequenceDefinition('goal',''));assert.throws(()=>sequenceDefinition('goal',Array(50).fill('step').join('\n')));assert.throws(()=>sequenceDefinition('goal','x'.repeat(201)));
});
test('Hub definitions and reviewed plans preserve snapshots and never prepare jobs',{timeout:120000},async()=>{
 const db=await createEmbeddedDatabase();try{await migrate(db);const token='f'.repeat(64),origin='http://127.0.0.1:3000';
 const c=new OwnerClient(origin,token,async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3000');return handleCoreRequest(new Request(String(url),{...init,headers}),{origin,token,database:()=>db,coordinationEnabled:()=>true});});
 try{
  const p=await c.call<{id:string}>('POST','/projects',{name:'Reusable Hub validation'}),first=sequenceDefinition('Original goal','Write a draft');
  const a=await c.call<Automation>('POST',`/projects/${p.id}/automations`,{name:'Reusable sequence',definition:first});
  const queued=await queueAutomationRun(c,p.id,a.id,a.version,'one-run');assert.equal(queued.work.plan,null);assert.equal(queued.work.jobs.length,0);assert.equal((await queueAutomationRun(c,p.id,a.id,a.version,'one-run')).work.run.id,queued.work.run.id);
  const second=sequenceDefinition('Revised goal','Write another draft');await c.call('PATCH',`/automations/${a.id}`,{expectedVersion:1,definition:second});
  await assert.rejects(queueAutomationRun(c,p.id,a.id,1,'stale-review'));
  assert.deepEqual(readSequence(queued.work.run.definitionSnapshot),first);
  const planned=await saveReviewedSequence(c,queued.work.run,first);assert.equal(planned.plan?.plan.goal,'Original goal');assert.equal(planned.jobs.length,0);assert.equal(planned.run.status,'queued');
  await assert.rejects(saveReviewedSequence(c,planned.run,second));
  await c.call('POST',`/runs/${planned.run.id}/commands`,{action:'cancel',expectedVersion:0});
  const trigger=await c.call<{id:string}>('POST',`/projects/${p.id}/schedules`,{automationId:a.id,expectedAutomationVersion:2,idempotencyKey:'trigger',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'once',runAt:'2020-01-01T00:00:00.000Z'});
  await c.call('POST',`/schedules/${trigger.id}/commands`,{action:'enable',expectedVersion:0});await c.call('POST','/coordinator/tick',{limit:10});
  const runs=await c.call<{items:Run[]}>('GET',`/projects/${p.id}/runs`),run=runs.items.find(r=>r.id!==planned.run.id)!;assert.ok(run);
  const work=await readWorkspace(c,run.id);assert.equal(work.plan,null);assert.deepEqual(readSequence(work.run.definitionSnapshot),second);
  const saved=await saveReviewedSequence(c,run,second);assert.equal(saved.plan?.plan.goal,'Revised goal');assert.equal(saved.jobs.length,0);
 }finally{c.close();}}finally{await db.close();}
});
