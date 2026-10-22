import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { createStateStore } from '../packages/database/src';
import {seedLegacyPlan} from './helpers/legacy-plan-fixture';
import { createExecutionManager } from '../packages/core/src/execution-manager/store';
import { planDigest,prepareBlueprint,prepareRequest } from '../packages/core/src/execution-manager';
import { getExecutorCatalog,localPreparationAdapter } from '../packages/executors/src';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { exerciseExecution } from './helpers/execution-contract';
test('fingerprints ignore object property order but bind run, version, content and step order',()=>{
 const plan={steps:[{key:'a',title:'A'},{key:'b',title:'B'}],goal:'Test'};
 const digest=planDigest('run-a',0,plan);assert.equal(digest,planDigest('run-a',0,{goal:'Test',steps:plan.steps}));
 for(const other of [planDigest('run-b',0,plan),planDigest('run-a',1,plan),planDigest('run-a',0,{...plan,goal:'Other'}),planDigest('run-a',0,{...plan,steps:[...plan.steps].reverse()})])assert.notEqual(digest,other);
});
test('preparation adapter preserves dependencies and never interprets instructions or grants permissions',()=>{
 assert.ok(getExecutorCatalog().executors.every(e=>!e.enabled&&!e.configured&&e.permissions.length===0));
 for(const kind of ['model','workflow','python','device','review','shell','toString','__proto__']){
  const step={key:'a',title:'Delete files; invoke paid API',kind,dependsOn:['before']};
  const job=localPreparationAdapter.prepare(step);assert.equal(job.executionEnabled,false);assert.deepEqual(job.permissions,[]);
  assert.deepEqual(job.dependsOn,['before']);assert.equal(job.title,step.title);assert.equal(job.mode,'prepare-only');
 }
 const base={plannerVersion:'2',goal:'Test',costPolicy:'ZERO_ONLY',executionEnabled:false,status:'blocked',steps:[{key:'a',title:'A',kind:'review',dependsOn:[]}]};
 for(const changed of [{...base,plannerVersion:'99'},{...base,executionEnabled:true},{...base,costPolicy:'PAID'},{...base,steps:[{...base.steps[0],dependsOn:['a']}]}])assert.throws(()=>prepareBlueprint(changed,0));
 assert.equal(prepareBlueprint({...base,plannerVersion:'1'},0).length,1);
});
test('preparation rejects permissions and launch overrides before storage access',async()=>{
 const input={expectedRunVersion:0,reviewedPlanDigest:'a'.repeat(64),acknowledgePlanReview:true,mode:'prepare-only',permissions:[]};
 for(const extra of [{permissions:['network']},{mode:'execute'},{acknowledgePlanReview:false},{executionEnabled:true},{reviewedPlanDigest:'bad'},{executorId:'python'}])assert.equal(prepareRequest.safeParse({...input,...extra}).success,false);
 const token='a'.repeat(64),origin='http://127.0.0.1:3000';let opened=0;
 const options={token,origin,database:()=>{opened++;throw Error('No storage allowed');}};
 const call=(method:string,path:string,body?:unknown,headers:Record<string,string>={})=>handleCoreRequest(new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),options);
 const path='/runs/run_12345678-1234-4234-8234-123456789abc/execution';
 assert.equal((await call('POST',path,{...input,permissions:['shell']})).status,400);
 assert.equal((await call('POST',path,input,{Authorization:''})).status,401);
 assert.equal((await call('POST',path,input,{Origin:'https://example.com'})).status,403);
 assert.equal((await call('GET',path+'?unknown=value')).status,400);
 assert.equal((await call('PUT',path,input)).status,405);
 assert.equal((await call('GET','/executors/catalog')).status,200);assert.equal(opened,0);
});
test('job preparation contract, additive upgrade and durable receipts',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-execution-'));
 let db=await createEmbeddedDatabase(directory);
 try{
  const files=await readMigrations();await migrate(db,files.slice(0,2));
  const store=createStateStore(db);const project=await store.createProject('Before preparation upgrade');const run=await store.createRun(project.id);
  await seedLegacyPlan(db,run.id,{expectedRunVersion:0,goal:'Durable preparation',steps:[{key:'review',title:'Review',kind:'review'}]});
  assert.deepEqual(await migrate(db),['003_preparations.sql','004_agent_assignments.sql','005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_recei