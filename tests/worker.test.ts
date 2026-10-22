import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { exerciseWorker } from './helpers/worker-contract';
test('controlled worker upgrade, execution and restored results',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-worker-'));let db=await createEmbeddedDatabase(directory);
 try{
  await migrate(db,(await readMigrations()).slice(0,5));assert.deepEqual(await migrate(db),['006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_transient_retries.sql']);await exerciseWorker(db,t);
  const saved=(await db.query('SELECT * FROM job_executions ORDER BY job_id')).rows;
  await db.close();db=await createEmbeddedDatabase(directory);assert.deepEqual((await db.query('SELECT * FROM job_executions ORDER BY job_id')).rows,saved);
 }finally{await db.close();const absolute=resolve(directory);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-worker-'))throw Error('Unsafe cleanup');await rm(absolute,{recursive:true,force:true});}
});
test('worker API rejects invalid permissions, auth and disabled dispatch before opening storage',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opened=0;
 const path='/runs/run_12345678-1234-4234-8234-123456789abc/jobs/job_12345678-1234-4234-8234-123456789abc/execute';
 const body={expectedRunVersion:0,reviewedPlanDigest:'a'.repeat(64),acknowledgeExecution:true,permission:'local:text',agentId:'agent_12345678-1234-4234-8234-123456789abc',expectedAgentVersion:0,modelFingerprint:'b'.repeat(64),prompt:'Test',maxOutputTokens:16};
 const call=(input:unknown,auth=token)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:JSON.stringify(input)}),{origin,token,database:()=>{opened++;throw Error('No storage');}});
 assert.equal((await call(body)).status,503);assert.equal((await call(body,'')).status,401);
 for(const extra of [{permission:'shell'},{acknowledgeExecution:false},{baseUrl:'https://example.com'},{maxOutputTokens:129},{expectedRunVersion:-1}])assert.equal((await call({...body,...extra})).status,400);
 assert.equal(opened,0);
});
