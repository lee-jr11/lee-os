import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, planInput } from '../packages/core/src/orchestrator';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { exercisePlanning } from './helpers/planning-contract';
const base={expectedRunVersion:0,goal:'Prepare a plan',steps:[{key:'a',title:'Task',kind:'unknown'}]};
test('planner validates graph and rejects caller execution or cost claims',()=>{
 for(const steps of [[],[{key:'a',title:'A',kind:'review',dependsOn:['missing']}],
  [{key:'a',title:'A',kind:'review',dependsOn:['b']},{key:'b',title:'B',kind:'review',dependsOn:['a']}],
  [base.steps[0],base.steps[0]]])assert.equal(planInput.safeParse({...base,steps}).success,false);
 for(const extra of [{costPolicy:'PAID'},{executionEnabled:true}])assert.equal(planInput.safeParse({...base,...extra}).success,false);
 const plan=buildPlan(base);assert.equal(plan.steps[0].route.target,'unassigned');assert.equal(plan.executionEnabled,false);
 for(const kind of ['review','model','workflow','python','device','shell','toString','__proto__'])assert.equal(buildPlan({...base,steps:[{...base.steps[0],kind}]}).steps[0].route.executable,false);
});
test('invalid plans are rejected before database access',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);
 const response=await handleCoreRequest(new Request(`${origin}/api/v1/runs/run_12345678-1234-4234-8234-123456789abc/plan`,{
 method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,steps:[]})
 }),{token,origin,database:()=>{throw Error('Storage must not open');}});
 assert.equal(response.status,400);
});
test('planning persistence and additive upgrade',async t=>{
 const db=await createEmbeddedDatabase();
 try {
  const files=await readMigrations();await migrate(db,files.slice(0,1));
  await db.query("INSERT INTO projects(id,name) VALUES('proj_12345678-1234-4234-8234-123456789abc','Before upgrade')");
  assert.deepEqual(await migrate(db),['002_plans.sql','003_preparations.sql','004_agent_assignments.sql','005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql']);
  assert.equal((await db.query("SELECT name FROM projects WHERE name='Before upgrade'")).rows.length,1);
  await exercisePlanning(db,t);
 }finally{await db.close();}
});
