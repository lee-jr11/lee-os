import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { getAgentCatalog,roleRegistration } from '../packages/agents/src';
import { assignAgentRequest } from '../packages/core/src/agent-manager';
import { createAgentManager } from '../packages/core/src/agent-manager/store';
import { createStateStore } from '../packages/database/src';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import {seedLegacyPlan} from './helpers/legacy-plan-fixture';
import { createExecutionManager } from '../packages/core/src/execution-manager/store';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { exerciseAgents } from './helpers/agent-contract';
test('agent catalog is metadata only; role/assignment permissions fail closed',()=>{
 const catalog=getAgentCatalog();assert.equal(catalog.executionEnabled,false);assert.ok(catalog.templates.every(t=>t.permissions.length===0));
 const role={name:'Writer',purpose:'Draft',stepKinds:['model'],permissions:[],idempotencyKey:'test'};
 for(const extra of [{permissions:['network']},{stepKinds:['review']},{stepKinds:['model','model']},{stepKinds:[]},{providerId:'some-provider'},{executionEnabled:true},{name:' '}])assert.equal(roleRegistration.safeParse({...role,...extra}).success,false);
 const assignment={roleId:'role_12345678-1234-4234-8234-123456789abc',expectedRunVersion:0,reviewedPlanDigest:'a'.repeat(64),permissions:[],mode:'assignment-only'};
 for(const extra of [{permissions:['model-call']},{mode:'execute'},{modelId:'some-model'},{reviewedPlanDigest:'bad'},{expectedRunVersion:-1}])assert.equal(assignAgentRequest.safeParse({...assignment,...extra}).success,false);
});
test('agent API authenticates and validates before accessing storage',async()=>{
 const token='a'.repeat(64),origin='http://127.0.0.1:3000';let opened=0;
 const options={token,origin,database:()=>{opened++;throw Error('Do not open storage');}};
 const call=(method:string,path:string,body?:unknown,headers:Record<string,string>={})=>handleCoreRequest(new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),options);
 assert.equal((await call('GET','/agents/catalog')).status,200);
 assert.equal((await call('GET','/agents/catalog',undefined,{Authorization:''})).status,401);
 assert.equal((await call('POST','/agents/roles',{name:'X'},{Origin:'https://example.com'})).status,403);
 assert.equal((await call('POST','/agents/roles',{name:'X',purpose:'X',stepKinds:['model'],permissions:['network'],idempotencyKey:'x'})).status,400);
 assert.equal((await call('GET','/agents/roles?limit=101')).status,400);
 assert.equal((await call('GET','/agents/roles?after=agent_12345678-1234-4234-8234-123456789abc')).status,400);
 assert.equal((await call('POST','/agents/agent_12345678-1234-4234-8234-123456789abc/commands',{action:'start',expectedVersion:0})).status,400);
 assert.equal((await call('GET','/agents/catalog?unknown=true')).status,400);assert.equal(opened,0);
});
test('agent contract, additive upgrade and durable assignments',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-agents-'));
 let db=await createEmbeddedDatabase(directory);
 try{
  const files=await readMigrations();await migrate(db,files.slice(0,3));
  const store=createStateStore(db),project=await store.createProject('Before agent upgrade'),run=await store.createRun(project.id);
  await seedLegacyPlan(db,run.id,{expectedRunVersion:0,goal:'Durable agent scope',steps:[{key:'draft',title:'Draft',kind:'model'}]});
  const execution=createExecutionManager(db),preview=await execution.inspect(run.id);
  const prepInput={expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]};
  const preparation=await execution.prepare(run.id,prepInput);
  assert.deepEqual(await migrate(db),['004_agent_assignments.sql','005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_transient_retries.sql']);
  assert.deepEqual(await execution.prepare(run.id,prepInput),preparation);
  const agents=createAgentManager(db),role=await agents.registerRole({name:'Durable writer',purpose:'Draft',stepKinds:['model'],permissions:[],idempotencyKey:'durable-writer'});
  const job=(await store.listJobs(run.id)).items[0],input={roleId:role.id,expectedRunVersion:0,reviewedPl