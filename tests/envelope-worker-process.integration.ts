import test from 'node:test';
import {loadEnvFile} from 'node:process';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createPostgresDatabase} from '../packages/database/src';
import {migrate} from '../packages/database/src/migrations';
import {workerFixture,approve,expire} from './helpers/envelope-worker-contract';
import {envelopeFixture,authorizedInput} from './helpers/envelope-contract';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {createLocalProviderManager} from '../packages/core/src/provider-manager/service';
import {OwnerClient} from '../apps/hub/lib/owner-client';
import {handleCoreRequest} from '../packages/core/src/api/http';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const url=process.env.LEEOS_TEST_DATABASE_URL;
if(!url)throw Error('Set the dedicated LEEOS_TEST_DATABASE_URL for native process tests.');
function child(schema:string,mode:'complete'|'die-during-call'){
 const processChild=spawn(process.execPath,['--import','tsx','tests/fixtures/envelope-worker-child.ts',mode],{cwd:process.cwd(),env:{...process.env,LEEOS_WORKER_TEST_SCHEMA:schema},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
 let entered!:()=>void;const started=new Promise<void>(r=>entered=r);let failure=false;
 processChild.on('message',message=>{const m=message as {type:string};if(m.type==='generation-entered')entered();if(m.type==='failure')failure=true;});
 const done=new Promise<number|null>((resolve,reject)=>{processChild.once('error',reject);processChild.once('exit',code=>resolve(code));});
 const deadline=setTimeout(()=>processChild.kill('SIGKILL'),30000);deadline.unref();done.finally(()=>clearTimeout(deadline)).catch(()=>undefined);
 return {processChild,started,done,failed:()=>failure};
}
test('OS-process worker outlives the owner connection and conservatively recovers a killed claimant',{timeout:90000},async t=>{
 const schema='leeos_test_'+randomUUID().replaceAll('-',''),admin=createPostgresDatabase(url!);await admin.exec('CREATE SCHEMA '+schema);const db=createPostgresDatabase(url!,schema);
 try{
  await migrate(db);await db.exec('CREATE TABLE worker_test_effects(id bigserial PRIMARY KEY,marker text NOT NULL)');
  await t.test('an accepted HTTP submission executes in another process after the browser client closes',async()=>{
   const base=await envelopeFixture(db),input=await authorizedInput(base),origin='http://127.0.0.1:3000',token='e'.repeat(64);
   const client=new OwnerClient(origin,token,async(input,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3000');return handleCoreRequest(new Request(String(input),{...init,headers}),{origin,token,database:()=>db});});
   const accepted=await client.call<{id:string}>('POST',`/runs/${base.run.id}/execution-envelope`,input);client.close();
   const f={...base,receipt:await base.manager.forRun(base.run.id),store:createEnvelopeWorkerStore(db)};assert.equal(accepted.id,f.receipt.id);
   const processWorker=child(schema,'complete');assert.equal(await processWorker.done,0);assert.equal(processWorker.failed(),false);
   assert.equal((await f.store.get(f.receipt.id)).state,'waiting-human');assert.equal((await db.query('SELECT * FROM worker_test_effects')).rows.length,1);
   await approve(f);assert.equal(await child(schema,'complete').done,0);assert.equal((await f.store.get(f.receipt.id)).state,'succeeded');assert.equal((await f.requirements.assessment(f.run.id)).goalStatus,'achieved');
  });
  await t.test('a killed worker leaves a fenced uncertain call; restart discovers it without a second generation',async()=>{
   const f=await workerFixture(db),processWorker=child(schema,'die-during-call');
   await Promise.race([processWorker.started,processWorker.done.then(()=>{throw Error('Fixture worker exited before its dispatch checkpoint.');})]);
   try{
    await new Promise(r=>setTimeout(r,2200));const live=await f.store.get(f.receipt.id);assert.equal(live.state,'running');assert.ok(new Date(live.leaseExpiresAt!).getTime()>Date.now());assert.equal(await f.store.claim('worker_competing_process',f.receipt.id),null);
   }finally{processWorker.processChild.kill('SIGKILL');await processWorker.done;}
   await expire(db,f.receipt.id);const restarted=createEnvelopeWorkerStore(db,{backoffMs:0});await restarted.reap();assert.equal((await restarted.get(f.receipt.id)).state,'recovery-required');
   assert.equal(await child(schema,'complete').done,0);assert.equal((await db.query('SELECT * FROM worker_test_effects')).rows.length,2);
   const work=await restarted.get(f.receipt.id),callId=work.operations[0].callId!;const version=(await db.query('SELECT version FROM provider_calls WHERE id=$1',[callId])).rows[0].version;
   // The fixture process is confirmed dead. This explicit recovery only releases
   // its uncertain provider reservation; it does not authorize replay.
   await createLocalProviderManager({enabled:()=>false}).recover(db,{callId,expectedVersion:version,acknowledgeServerRestart:true});
   assert.equal(await child(schema,'complete').done,0);assert.equal((await restarted.get(f.receipt.id)).state,'failed');assert.equal((await db.query('SELECT * FROM worker_test_effects')).rows.length,2);
  });
 }finally{await db.close();if(/^leeos_test_[a-f0-9]{32}$/.test(schema))await admin.exec('DROP SCHEMA '+schema+' CASCADE');await admin.close();}
});
