import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { localOrigin } from '../packages/core/src/api/auth';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Configure owner API credentials and an opted-in coordinator for the live test.');
const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
test('production API queues one scheduled run and one event follow-up without model execution',{timeout:45000},async()=>{
 const call=async(method:string,path:string,body?:unknown)=>{
  const response=await fetch(origin+'/api/v1'+path,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const value=await response.json();assert.ok(response.status===200||response.status===201,JSON.stringify(value));return value.data;
 };
 assert.equal((await call('GET','/coordinator')).enabled,true);
 const project=await call('POST','/projects',{name:'Live coordination '+randomUUID()});
 const source=await call('POST',`/projects/${project.id}/automations`,{name:'Scheduled source',definition:{test:'schedule'}});
 const target=await call('POST',`/projects/${project.id}/automations`,{name:'Event follow-up',definition:{test:'event'}});
 const common={expectedAutomationVersion:1,action:'queue-run-for-review',acknowledgeNoExecution:true};
 const request={...common,automationId:source.id,idempotencyKey:'live-schedule',kind:'once',runAt:'2020-01-01T00:00:00.000Z'};
 const schedule=await call('POST',`/projects/${project.id}/schedules`,request);assert.equal(schedule.enabled,false);
 await call('POST',`/schedules/${schedule.id}/commands`,{action:'enable',expectedVersion:0});await call('POST','/coordinator/tick',{});
 const first=(await call('GET',`/projects/${project.id}/trigger-receipts`)).items;assert.equal(first.length,1);assert.equal(first[0].outcome,'queued');
 const run=await call('GET',`/runs/${first[0].runId}`);assert.equal(run.status,'queued');assert.deepEqual(run.definitionSnapshot,{test:'schedule'});
 assert.equal((await call('GET',`/runs/${run.id}/jobs`)).items.length,0);
 const subscription=await call('POST',`/projects/${project.id}/event-subscriptions`,{...common,automationId:target.id,sourceAutomationId:source.id,eventKind:'run.cancelled',idempotencyKey:'live-event'});
 await call('POST',`/event-subscriptions/${subscription.id}/commands`,{action:'enable',expectedVersion:0});
 await call('POST',`/runs/${run.id}/commands`,{action:'cancel',expectedVersion:0});
 await Promise.all([call('POST','/coordinator/tick',{}),call('POST','/coordinator/tick',{})]);
 const receipts=(await call('GET',`/projects/${project.id}/trigger-receipts`)).items;assert.equal(receipts.length,2);
 const follow=receipts.find((r:{subscriptionId:string|null})=>r.subscriptionId===subscription.id);assert.ok(follow);assert.equal(follow.outcome,'queued');
 const queued=await call('GET',`/runs/${follow.runId}`);assert.equal(queued.status,'queued');assert.equal(queued.automationId,target.id);
 assert.equal((await call('GET',`/runs/${queued.id}/jobs`)).items.length,0);
 await call('POST','/coordinator/tick',{});assert.equal((await call('GET',`/projects/${project.id}/trigger-receipts`)).items.length,2);
 assert.equal((await call('POST',`/projects/${project.id}/schedules`,request)).id,schedule.id);
 await call('POST',`/event-subscriptions/${subscription.id}/commands`,{action:'disable',expectedVersion:1});
});
