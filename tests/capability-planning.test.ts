import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {buildCapabilityPlan,capabilityPlanInput} from '../packages/core/src/orchestrator/capability-plan';
import {requirementsContent,requirementsDigest} from '../packages/core/src/requirements';
import {routeCapability} from '../packages/core/src/task-router/capabilities';
import {syntheticRegistry} from '../scripts/lib/synthetic-provider';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate} from '../packages/database/src/migrations';
import {createPlanner} from '../packages/core/src/orchestrator/store';
import {handleCoreRequest} from '../packages/core/src/api/http';
import {exerciseCapabilityPlanning,capabilityFixture,lessonContract} from './helpers/capability-planning-contract';
const now=new Date('2026-10-19T12:00:00Z'),id='reqs_12345678-1234-4234-8234-123456789abc';
test('neutral capabilities, requirement links and evidence checks precede technology selection',async()=>{
 const content=await lessonContract(),digest=requirementsDigest(id,1,content),contract={id,revision:1,digest,content};
 const input={mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:digest,modelBudget:{inputTokens:1000,outputTokens:500}};
 const plan=buildCapabilityPlan(input,contract,{now,registry:syntheticRegistry(now)});
 assert.deepEqual(plan.capabilities.map(n=>n.id),['approved_delivery','artifact_registration','artifact_storage','delivery_confirmation','document_generation','document_validation','recorded_job_result','text_generation']);
 assert.ok(plan.coverage.every(r=>r.status==='mapped'));assert.equal(plan.capabilities.find(n=>n.id==='text_generation')?.route.status,'selected');
 assert.equal(plan.capabilities.find(n=>n.id==='document_generation')?.route.selected?.implementationId,'python-document');
 assert.ok(plan.capabilities.find(n=>n.id==='document_generation')?.route.evaluations.length===2);
 assert.equal(plan.routingStatus,'blocked');assert.equal(plan.status,'blocked');assert.equal(plan.executionEnabled,false);
 assert.deepEqual(buildCapabilityPlan(input,structuredClone(contract),{now,registry:syntheticRegistry(now)}),plan);
 assert.throws(()=>buildCapabilityPlan(input,{...contract,content:{...content,goal:'Changed'}},{now}));
 for(const extra of [{steps:[]},{registry:[]},{executionEnabled:true},{costPolicy:'PAID'},{providerId:'free-model'},{permissions:['shell']}])assert.equal(capabilityPlanInput.safeParse({...input,...extra}).success,false);
 for(const capabilityIds of [['python'],['text_generation','text_generation']])assert.equal(requirementsContent.safeParse({...content,requirements:[{...content.requirements[0],capabilityIds},...content.requirements.slice(1)]}).success,false);
});
test('missing coverage and unknown capabilities never get inferred from goal prose or technology names',async()=>{
 const content=await lessonContract();delete content.requirements[0].capabilityIds;content.capabilities.push('python');
 const digest=requirementsDigest(id,1,content),plan=buildCapabilityPlan({mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:digest},{id,revision:1,digest,content},{now});
 assert.ok(plan.routingBlockers.some(b=>'requirementId' in b&&b.requirementId==='lesson'));
 assert.ok(plan.routingBlockers.some(b=>b.code==='UNKNOWN_CAPABILITY'));assert.ok(plan.routingBlockers.some(b=>b.code==='MODEL_BUDGET_REQUIRED'));
 for(const name of ['python','github-actions','n8n','lee360','constructor','toString','__proto__']){const r=routeCapability(name,undefined);assert.equal(r.selected,null);assert.equal(r.reason,'UNKNOWN_CAPABILITY');}
 const old=requirementsContent.parse(content);assert.equal(old.requirements[0].capabilityIds,undefined);
});
test('model routes inherit verified-zero, freshness, capacity and quota gates without provider fallback',()=>{
 const budget={inputTokens:1000,outputTokens:500};
 for(const change of [(r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].cost.amountUsd=1;},(r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].availability.remainingRequests=0;},(r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].cost.expiresAt=now.toISOString();}]){
  const registry=syntheticRegistry(now);change(registry);assert.equal(routeCapability('text_generation',budget,{registry,now}).status,'blocked');
 }
 assert.equal(routeCapability('text_generation',budget,{now}).status,'blocked');
 assert.equal(routeCapability('owner_review',undefined,{now}).status,'selected');
});
test('capability API denies forged authority and invalid requests before storage access',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opens=0;
 const options={origin,token,database:()=>{opens++;throw Error('Must not open');}};
 const call=(body:unknown,auth=token)=>handleCoreRequest(new Request(origin+'/api/v1/runs/run_12345678-1234-4234-8234-123456789abc/plan',{method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:auth?'Bearer '+auth:'','Content-Type':'application/json'},body:JSON.stringify(body)}),options);
 const input={mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:'0'.repeat(64)};
 assert.equal((await call(input,'')).status,401);assert.equal((await call({...input,registry:[]})).status,400);assert.equal((await call({...input,modelBudget:{inputTokens:0,outputTokens:1}})).status,400);assert.equal(opens,0);
});
test('P0.2 persistence, concurrency, compatibility and clean-close restore',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'leeos-capabilities-'));let db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db);await exerciseCapabilityPlanning(db,t);
  const f=await capabilityFixture(db),before=await createPlanner(db).create(f.run.id,f.input);
  await db.close();db=await createEmbeddedDatabase(dir);assert.deepEqual(await migrate(db),[]);assert.deepEqual(await createPlanner(db).get(f.run.id),before);
 }finally{await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-capabilities-'))throw Error('Unsafe cleanup');await rm(absolute,{recursive:true,force:true});}
});
