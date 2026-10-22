import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate,readMigrations } from '../packages/database/src/migrations';
import { dueOccurrence,dueCalendarOccurrence,localDateTimeToInstant,nextCalendarOccurrence,scheduleCreate } from '../packages/core/src/scheduler';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { exerciseCoordination } from './helpers/coordination-contract';
test('UTC intervals coalesce across long outages while preserving their anchor',()=>{
 assert.deepEqual(dueOccurrence('2040-01-01T00:00:00Z',60,'2040-01-01T01:00:30Z'),{scheduledFor:'2040-01-01T01:00:00.000Z',nextRunAt:'2040-01-01T01:01:00.000Z',skipped:60});
 assert.throws(()=>dueOccurrence('2040-01-02',null,'2040-01-01'));
});
test('calendar rules resolve local time, weekdays and daylight-saving transitions deterministically',()=>{
 assert.equal(localDateTimeToInstant('2024-03-10','02:30','America/New_York').toISOString(),'2024-03-10T07:30:00.000Z');
 assert.equal(localDateTimeToInstant('2024-11-03','01:30','America/New_York').toISOString(),'2024-11-03T05:30:00.000Z');
 assert.deepEqual(nextCalendarOccurrence('2040-01-01T06:00:00.000Z',{kind:'daily',time:'08:00',timezone:'Africa/Accra'}),{scheduledFor:'2040-01-01T08:00:00.000Z',scheduledLocal:'2040-01-01T08:00'});
 assert.deepEqual(nextCalendarOccurrence('2040-01-01T06:00:00.000Z',{kind:'weekly',dayOfWeek:1,time:'08:00',timezone:'Africa/Accra'}),{scheduledFor:'2040-01-02T08:00:00.000Z',scheduledLocal:'2040-01-02T08:00'});
 assert.deepEqual(dueCalendarOccurrence('2040-01-01T08:00:00.000Z',{kind:'daily',time:'08:00',timezone:'Africa/Accra'},'2040-01-04T09:00:00.000Z'),{scheduledFor:'2040-01-04T08:00:00.000Z',scheduledLocal:'2040-01-04T08:00',timezone:'Africa/Accra',nextRunAt:'2040-01-05T08:00:00.000Z',skipped:3});
 assert.equal(scheduleCreate.safeParse({automationId:'auto_12345678-1234-4234-8234-123456789abc',expectedAutomationVersion:1,idempotencyKey:'daily',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'daily',time:'08:00',timezone:'Africa/Accra'}).success,true);
 for(const time of ['8:00','24:00'])assert.equal(scheduleCreate.safeParse({automationId:'auto_12345678-1234-4234-8234-123456789abc',expectedAutomationVersion:1,idempotencyKey:'daily',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'daily',time,timezone:'Africa/Accra'}).success,false);
 assert.equal(scheduleCreate.safeParse({automationId:'auto_12345678-1234-4234-8234-123456789abc',expectedAutomationVersion:1,idempotencyKey:'bad-zone',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'weekly',dayOfWeek:8,time:'08:00',timezone:'Nowhere/Nope'}).success,false);
});
test('coordination API rejects execution authority, unsupported clocks, auth and disabled polling before storage',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opened=0;
 const options={token,origin,database:()=>{opened++;throw Error('No storage');}};
 const call=(path:string,input:unknown,auth=token)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:JSON.stringify(input)}),options);
 const base={automationId:'auto_12345678-1234-4234-8234-123456789abc',expectedAutomationVersion:1,idempotencyKey:'test',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'once',runAt:'2040-01-01T00:00:00.000Z'};
 for(const extra of [{action:'execute'},{permissions:['local:text']},{timezone:'America/New_York'},{runAt:'2040-01-01T01:00:00.000+01:00'},{kind:'cron',expression:'* * * * *'}])assert.equal(scheduleCreate.safeParse({...base,...extra}).success,false);
 assert.equal((await call('/coordinator/tick',{})).status,503);assert.equal((await call('/coordinator/tick',{},'')).status,401);
 for(const input of [{now:'2040-01-01'},{limit:100},{limit:1},{execute:true}])assert.equal((await call('/coordinator/tick',input)).status,400);
 assert.equal((await call('/projects/proj_12345678-1234-4234-8234-123456789abc/schedules',{...base,action:'execute'})).status,400);assert.equal(opened,0);
});
test('coordination upgrade, transactional contract and restored receipts',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-coordination-'));let db=await createEmbeddedDatabase(directory);
 try{
  await migrate(db,(await readMigrations()).slice(0,6));assert.deepEqual(await migrate(db),['007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_tran