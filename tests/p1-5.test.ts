import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { createStateStore,createId } from '../packages/database/src';
import { createLifecycleManager } from '../packages/core/src/lifecycle';
import { createCoordinator } from '../packages/core/src/scheduler';
import { createMemoryManager } from '../packages/core/src/memory-manager';
import { createCommandCenter } from '../packages/core/src/command-center';
import { createArtifactStorage } from '../packages/core/src/storage-manager';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { OwnerClient } from '../apps/hub/lib/owner-client';

test('P1.5 lifecycle holds triggers, blocks new work, resumes safely and archives triggers',{timeout:120000},async()=>{
 const db=await createEmbeddedDatabase();
 try{
  await migrate(db);const store=createStateStore(db),life=createLifecycleManager(db),project=await store.createProject('Lifecycle fixture');
  const automation=await store.createAutomation(project.id,'Scheduled fixture',{goal:'review only'});
  const now=new Date('2040-01-03T00:00:00.000Z'),coordinator=createCoordinator(db,{enabled:()=>true,clock:()=>now});
  const request={automationId:automation.id,expectedAutomationVersion:1,idempotencyKey:`p15-${randomUUID()}`,action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'once',runAt:'2040-01-02T00:00:00.000Z'};
  const schedule=await coordinator.create('schedule',project.id,request),scheduleId=String(schedule.id);await coordinator.command('schedule',scheduleId,{action:'enable',expectedVersion:0});
  const pausedAutomation=await life.automation(automation.id,{action:'pause',expectedVersion:0});assert.equal(pausedAutomation.status,'paused');
  await assert.rejects(store.createRun(project.id,{automationId:automation.id}),/paused|unavailable/i);
  assert.equal((await coordinator.tick({})).schedules.length,0);assert.equal((await coordinator.receipts(project.id)).items.length,0);
  await life.automation(automation.id,{action:'resume',expectedVersion:1});
  const source=await store.createAutomation(project.id,'Event source',{purpose:'Fixture source'});
  const subscription=await coordinator.create('subscription',project.id,{automationId:automation.id,expectedAutomationVersion:1,idempotencyKey:`p15-event-${randomUUID()}`,action:'queue-run-for-review',acknowledgeNoExecution:true,sourceAutomationId:source.id,eventKind:'run.succeeded'});
  await coordinator.command('subscription',String(subscription.id),{action:'enable',expectedVersion:0});const sourceRun=await store.createRun(project.id,{automationId:source.id});
  const pausedProject=await life.project(project.id,{action:'pause',expectedVersion:0});assert.equal(pausedProject.status,'paused');
  await assert.rejects(store.createRun(project.id,{automationId:automation.id}),/paused|completed|archived/i);
  await store.transitionRun(sourceRun.id,0,'running');await store.transitionRun(sourceRun.id,1,'succeeded');
  const held=(await coordinator.tick({}));assert.equal(held.schedules.length,0);assert.equal(held.events.length,0);assert.equal((await coordinator.receipts(project.id)).items.length,0);
  await life.project(project.id,{action:'resume',expectedVersion:1});
  const due=await coordinator.tick({});assert.equal(due.schedules.find(item=>item.triggerId===scheduleId)?.outcome,'queued');assert.equal(due.events.length,0);
  const future=await coordinator.create('schedule',project.id,{...request,idempotencyKey:`p15-archive-${randomUUID()}`,runAt:'2040-01-04T00:00:00.000Z'});
  await coordinator.command('schedule',String(future.id),{action:'enable',expectedVersion:0});
  await life.project(project.id,{action:'archive',expectedVersion:2});
  assert.equal((await coordinator.get('schedule',String(future.id))).enabled,false);
  assert.equal((await coordinator.get('subscription',String(subscription.id))).enabled,false);
  await assert.rejects(store.createRun(project.id,{automationId:automation.id}),/paused|completed|archived/i);
  await assert.rejects(life.project(project.id,{action:'resume',expectedVersion:3}));
 }finally{await db.close();}
});

test('P1.5 quarantines legacy evidence and retrieves only reviewed, authorized tagged memories',{timeout:120000},async()=>{
 const db=await createEmbeddedDatabase();
 try{
  const files=await readMigrations();await migrate(db,files.slice(0,16));
  const store=createStateStore(db),projectA=await store.createProject('Memory scope A'),projectB=await store.createProject('Memory scope B'),automation=await store.createAutomation(projectA.id,'Scoped automation');
  const storage=createArtifactStorage(db,{enabled:()=>true}),artifact=await storage.register({projectId:projectA.id,name:'Evidence.txt',mediaType:'text/plain',idempotencyKey:'p15-evidence',creator:'owner-api',bytes:new TextEncoder().encode('verified evidence')});
  const legacyId=createId('memory');await db.query('INSERT INTO memories(id,project_id,kind,content,source_artifact_id) VALUES($1,$2,$3,$4,$5)',[legacyId,projectB.id,'engineering-lesson',JSON.stringify({summary:'legacy cross-project evidence'}),artifact.artifact.id]);
  assert.deepEqual(await migrate(db,files),['017_lifecycle_memory.sql']);
  const legacy=(await db.query('SELECT retrieval_enabled,scope,source_artifact_id FROM memories WHERE id=$1',[legacyId])).rows[0];assert.equal(legacy.retrieval_enabled,false);assert.equal(legacy.scope,'project');assert.equal(legacy.source_artifact_id,artifact.artifact.id);
  const memory=createMemoryManager(db);
  const projectMemory=await memory.create({kind:'engineering-lesson',scope:'project',projectId:projectA.id,summary:'Use a verified fixture for storage checks',content:{text:'The artifact API verifies SHA-256.'},tags:['storage','verification'],sourceArtifactId:artifact.artifact.id,acknowledgeReview:true});
  const automationMemory=await memory.create({kind:'automation-knowledge',scope:'automation',projectId:projectA.id,automationId:automation.id,summary:'This automation expects weekly inputs',content:{text:'Collect the latest source before planning.'},tags:['weekly','inputs'],acknowledgeReview:true});
  const ownerMemory=await memory.create({kind:'user-preference',scope:'owner',summary:'Prefer concise status reports',content:{text:'Lead with the current state.'},tags:['reports','concise'],acknowledgeReview:true});
  await assert.rejects(memory.create({kind:'project-decision',scope:'project',projectId:projectB.id,summary:'Cross-project evidence must be rejected',content:{text:'invalid'},tags:['storage'],sourceArtifactId:artifact.artifact.id,acknowledgeReview:true}));
  const projectResults=await memory.retrieve({projectId:projectA.id,tags:['storage']});assert.deepEqual(projectResults.items.map(item=>item.id),[projectMemory.id]);
  const automationResults=await memory.retrieve({projectId:projectA.id,automationId:automation.id,tags:['weekly']});assert.deepEqual(automationResults.items.map(item=>item.id),[automationMemory.id]);
  const otherProjectResults=await memory.retrieve({projectId:projectB.id,tags:['storage','reports']});assert.deepEqual(otherProjectResults.items.map(item=>item.id),[ownerMemory.id]);
  const unscoped=await db.query('SELECT id FROM memories WHERE id=$1 AND retrieval_enabled=false',[legacyId]);assert.equal(unscoped.rows.length,1);await store.createRun(projectA.id,{automationId:automation.id});
  const center=await createCommandCenter(db).get(projectA.id);assert.equal(center.project.id,projectA.id);assert.ok(center.artifacts.some(item=>item.id===artifact.artifact.id&&item.available));
  assert.ok(center.automations.some(item=>item.id===automation.id));assert.ok(center.runs.length>0);
  const origin='http://127.0.0.1:3102',token='e'.repeat(64),transport:typeof fetch=async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3102');return handleCoreRequest(new Request(String(url),{...init,headers}),{origin,token,database:()=>db});};
  const client=new OwnerClient(origin,token,transport);
  try{
   const throughApi=await client.call<typeof center>('GET',`/projects/${projectA.id}/command-center`);assert.equal(throughApi.project.id,projectA.id);
   const scoped=await client.call<{items:{id:string}[]}>('POST','/memories/retrieve',{projectId:projectA.id,tags:['storage']});assert.deepEqual(scoped.items.map(item=>item.id),[projectMemory.id]);
   const paused=await client.call<{status:string;lifecycleVersion:number}>('POST',`/projects/${projectA.id}/lifecycle`,{action:'pause',expectedVersion:0});assert.equal(paused.status,'paused');
   const pausedView=await client.call<{project:{status:string}}>('GET',`/projects/${projectA.id}/command-center`);assert.equal(pausedView.project.status,'paused');
  }finally{client.close();}
 }finally{await db.close();}
});
