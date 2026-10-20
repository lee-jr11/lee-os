import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { localOrigin } from '../packages/core/src/api/auth';
import { explicitDraft,approvalFor } from './helpers/intake-contract';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Configure the local owner API for the intake live test.');
const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
test('production owner API clarifies, revises and approves English intake into one queued plan',{timeout:45000},async()=>{
 const call=async(method:string,path:string,body?:unknown)=>{
  const response=await fetch(origin+'/api/v1'+path,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const value=await response.json();assert.ok(response.status===200||response.status===201,JSON.stringify(value));return value.data;
 };
 const preview=await call('POST','/requests/preview',{text:'Draft a welcome message then review the message'});assert.equal(preview.questions.length,0);assert.equal(preview.executionEnabled,false);
 const project=await call('POST','/projects',{name:'Live intake '+randomUUID()});
 const input={text:'Write a weekly report and send it',idempotencyKey:'live-intake'};
 const request=await call('POST',`/projects/${project.id}/requests`,input);assert.equal(request.status,'needs-clarification');
 assert.equal((await call('GET',`/projects/${project.id}/runs`)).items.length,0);
 const clarified=await call('POST',`/requests/${request.id}/clarify`,{expectedVersion:0,text:'Draft a short welcome message then review the message'});assert.equal(clarified.status,'draft');assert.equal(clarified.text,input.text);
 const edited=await call('PATCH',`/requests/${request.id}`,{...explicitDraft,expectedVersion:1});assert.equal(edited.version,2);assert.notEqual(edited.proposalDigest,clarified.proposalDigest);
 const approval=approvalFor(edited),[a,b]=await Promise.all([call('POST',`/requests/${request.id}/approve`,approval),call('POST',`/requests/${request.id}/approve`,approval)]);assert.deepEqual(a,b);
 const runs=(await call('GET',`/projects/${project.id}/runs`)).items;assert.equal(runs.length,1);assert.equal(runs[0].status,'queued');assert.equal(runs[0].id,a.runId);
 const plan=await call('GET',`/runs/${a.runId}/plan`);assert.equal(plan.plan.executionEnabled,false);assert.equal(plan.plan.steps.at(-1).kind,'review');
 assert.equal((await call('GET',`/runs/${a.runId}/jobs`)).items.length,0);assert.equal((await call('GET',`/runs/${a.runId}/agents`)).items.length,0);
 assert.equal((await call('GET',`/projects/${project.id}/schedules`)).items.length,0);assert.equal((await call('GET',`/projects/${project.id}/event-subscriptions`)).items.length,0);
 assert.equal((await call('POST',`/projects/${project.id}/requests`,input)).id,request.id);
 assert.equal((await call('GET',`/requests/${request.id}`)).status,'approved');
});
