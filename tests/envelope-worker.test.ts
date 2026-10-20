import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate,readMigrations} from '../packages/database/src/migrations';
import {createId} from '../packages/database/src';
import {envelopeFixture,authorizedInput} from './helpers/envelope-contract';
import {exerciseEnvelopeWorkers,workerFixture,expire} from './helpers/envelope-worker-contract';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {runEnvelopeWorkerOnce} from '../packages/core/src/envelope-worker/runner';
import {createEnvelopeManager} from '../packages/core/src/execution-envelope/store';
import {createLocalProviderManager} from '../packages/core/src/provider-manager/service';
import {createLocalAdapter} from '../packages/providers/src/local';
import {fixtureTransport} from './helpers/local-provider-contract';
import {handleCoreRequest} from '../packages/core/src/api/http';
test('worker timing, identities and owner review boundaries fail closed',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opened=0;
 const options={origin,token,database:()=>{opened++;throw Error('No storage');}};
 const response=await handleCoreRequest(new Request(origin+'/api/v1/execution-envelopes/env_12345678-1234-4234-8234-123456789abc/review',{method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operationKey:'review',reviewedEnvelopeDigest:'a'.repeat(64),reviewedInputDigest:'b'.repeat(64),approve:true,note:'Forged',acknowledgeReview:false})}),options);
 assert.equal(response.status,400);assert.equal(opened,0);
 assert.throws(()=>createEnvelopeWorkerStore({} as never,{leaseMs:0}));
});
test('P0.4 additive queue backfill, claim/recovery contracts and clean-close rediscovery',{timeout:180000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'leeos-workers-'));let db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db,(await readMigrations()).slice(0,10));
  // Seed an accepted P0.3 row with its original persistence shape, rather than
  // invoking today's queue-aware acceptance service against an older schema.
  const old=await envelopeFixture(db),request=await authorizedInput(old),preview=await old.manager.preview(old.run.id,old.draft);assert.ok(preview.candidate&&preview.digest);
  const id=createId('envelope');await db.query('INSERT INTO execution_envelopes(id,run_id,project_id,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,envelope,digest,grant_expires_at) VALUES($1,$2,$3,$4,1,$5,0,$6,$7,$8,$9,$10,$11)',[id,old.run.id,old.project.id,old.doc.id,old.doc.digest,old.draft.reviewedPlanDigest,request.idempotencyKey,JSON.stringify(request),JSON.stringify(preview.candidate),preview.digest,old.draft.grantExpiresAt]);
  assert.deepEqual(await migrate(db),['011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql']);assert.equal((await createEnvelopeWorkerStore(db).get(id)).state,'queued');assert.equal((await createEnvelopeManager(db).get(id)).digest,preview.digest);
  await exerciseEnvelopeWorkers(db,t);
  const f=await workerFixture(db),claim=await f.store.claim('worker_before_restart',f.receipt.id);assert.ok(claim);await expire(db,f.receipt.id);
  await db.close();db=await createEmbeddedDatabase(dir);assert.deepEqual(await migrate(db),[]);
  const transport=fixtureTransport(),provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(transport.transport)});
  const result=await runEnvelopeWorkerOnce(db,{workerId:'worker_after_process_reopen',enabled:()=>true,provider,envelopeId:f.receipt.id,backoffMs:0});assert.equal(result.status,'waiting-human');assert.equal(transport.generated,1);
  const recovered=await createEnvelopeWorkerStore(db).get(f.receipt.id);assert.equal(recovered.fence,'2');assert.equal((await createEnvelopeManager(db).get(f.receipt.id)).digest,f.receipt.digest);
 }finally{await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-workers-'))throw Error('Unsafe cleanup');await rm(absolute,{recursive:true,force:true});}
});
