import {exerciseEnvelopeWorkers} from './helpers/envelope-worker-contract';
import {exerciseEnvelopes} from './helpers/envelope-contract';
import {exerciseCapabilityPlanning} from './helpers/capability-planning-contract';
import {exerciseRequirements} from './helpers/requirements-contract';
import assert from 'node:assert/strict';
import { coordinationFixture } from './helpers/coordination-contract';
import { exerciseAcceptance } from './helpers/acceptance-contract';
import { exerciseHub } from './helpers/hub-contract';
import { exerciseIntake } from './helpers/intake-contract';
import { exerciseCoordination,exerciseLateCommit } from './helpers/coordination-contract';
import { exerciseWorker } from './helpers/worker-contract';
import { exerciseLocalProvider } from './helpers/local-provider-contract';
import { exerciseAgents } from './helpers/agent-contract';
import { exerciseExecution } from './helpers/execution-contract';
import { exercisePlanning } from './helpers/planning-contract';
import test from 'node:test';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { createPostgresDatabase } from '../packages/database/src/index';
import { exerciseState } from './helpers/state-contract';
import { exerciseApi } from './helpers/api-contract';
try { loadEnvFile('.env'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const url = process.env.LEEOS_TEST_DATABASE_URL;
if (!url) throw new Error('Set LEEOS_TEST_DATABASE_URL to a dedicated local test database before running test:postgres.');
test('state contract against a PostgreSQL server', { timeout: 120000 }, async t => {
 const schema = `leeos_test_${randomUUID().replaceAll('-','')}`;
 const admin = createPostgresDatabase(url!);
 let created = false;
 try {
  // Identifier is generated locally and contains only the validated safe characters.
  await admin.exec(`CREATE SCHEMA ${schema}`); created = true;
  const db = createPostgresDatabase(url!,schema);
  try { await exerciseState(db,t); await t.test('committed administrative archive fences concurrent manual, scheduled and event new work',async()=>{
    for(const mode of ['manual','schedule','event']){
     const f=await coordinationFixture(db);
     let trigger:string|undefined;
     if(mode!=='manual'){
      const kind=mode==='schedule'?'schedule':'subscription';
      const row=await f.coordinator.create(kind,f.project.id,mode==='schedule'?f.schedule:f.rule);trigger=String(row.id);
      await f.coordinator.command(kind,trigger,{action:'enable',expectedVersion:0});
      if(mode==='event')await f.succeed();
     }
     let release!:()=>void,locked!:()=>void;
     const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>locked=r);
     const archive=db.transaction(async tx=>{await tx.query("UPDATE projects SET status='archived' WHERE id=$1",[f.project.id]);locked();await gate;});
     await ready;
     const pending=(mode==='manual'?f.store.createRun(f.project.id,{automationId:f.target.id}):f.coordinator.tick({})).then(value=>({value,error:null}),error=>({value:null,error}));
     try{
      let blocked=false;
      for(let n=0;n<80;n++){
       const rows=(await db.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0 AND query LIKE 'SELECT status FROM projects%' ")).rows;
       if(rows.length){blocked=true;break;}await new Promise(r=>setTimeout(r,25));
      }
      assert.equal(blocked,true,'New-work decision must wait for the project status transaction');
     }finally{release();await archive;}
     const outcome=await pending;
     if(mode==='manual')assert.equal(outcome.error?.name,'StateConflict');
     else{assert.equal(outcome.error,null);const result=outcome.value as Awaited<ReturnType<typeof f.coordinator.tick>>;
      const receipt=[...result.schedules,...result.events].find(r=>r.triggerId===trigger);assert.equal(receipt?.reason,'PROJECT_ARCHIVED');assert.equal(receipt?.runId,null);}
     assert.equal((await f.store.listRuns(f.project.id)).items.filter(r=>r.automation_id===f.target.id).length,0);
    }
   }); await exerciseApi(db,t); await exercisePlanning(db,t); await exerciseExecution(db,t); await exerciseAgents(db,t); await exerciseLocalProvider(db,t); await exerciseWorker(db,t); await exerciseCoordination(db,t); await exerciseLateCommit(db,t); await exerciseIntake(db,t); await exerciseHub(db,t); await exerciseAcceptance(db,t); await exerciseRequirements(db,t); await exerciseCapabilityPlanning(db,t); await exerciseEnvelopes(db,t); await exerciseEnvelopeWorkers(db,t); } finally { await db.close(); }
 } finally {
  if (created && /^leeos_test_[a-f0-9]{32}$/.test(schema)) await admin.exec(`DROP SCHEMA ${schema} CASCADE`);
  await admin.close();
 }
});
