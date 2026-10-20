import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { OwnerClient } from '../apps/hub/lib/owner-client';
import { readWorkspace,assignTextAgents,modelBlockers,type Intake,type Provider,type Result,type System } from '../apps/hub/lib/workflow';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const token=process.env.LEEOS_API_TOKEN;if(!token)throw Error('Configure a dedicated local owner API, database and local model for this live test.');
test('Hub client runs general request-to-result workflow through production API and real local inference',{timeout:90000},async()=>{
 const client=new OwnerClient(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000',token);
 try{
  const project=await client.call<{id:string}>('POST','/projects',{name:'Live general Hub '+randomUUID()});
  const request=await client.call<Intake>('POST',`/projects/${project.id}/requests`,{text:'Draft a short welcome message then review the message',idempotencyKey:'hub-live'});
  const approval=await client.call<{runId:string}>('POST',`/requests/${request.id}/approve`,{expectedVersion:request.version,reviewedProposalDigest:request.proposalDigest,acknowledgePlanReview:true,action:'create-reviewed-run'});
  let work=await readWorkspace(client,approval.runId);assert.equal(work.jobs.length,0);
  await client.call('POST',`/runs/${work.run.id}/execution`,{expectedRunVersion:work.inspection!.runVersion,reviewedPlanDigest:work.inspection!.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
  work=await readWorkspace(client,work.run.id);await assignTextAgents(client,work);work=await readWorkspace(client,work.run.id);
  const provider=await client.call<Provider>('GET','/providers/local'),system=await client.call<System>('GET','/system'),job=work.inspection!.jobs.find(j=>j.kind==='model')!,agent=work.agents.find(a=>a.assignment.jobId===job.jobId)!;
  assert.deepEqual(modelBlockers(work,job,system,provider),[]);
  const body={expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'local:text',agentId:agent.assignment.id,expectedAgentVersion:agent.version,modelFingerprint:provider.modelFingerprint,prompt:'Once upon a time',maxOutputTokens:16};
  const result=await client.call<Result>('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,body);assert.equal(result.status,'succeeded');assert.ok(result.text?.length);
  assert.deepEqual(await client.call('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,body),result);
  work=await readWorkspace(client,work.run.id);assert.equal(work.run.status,'running');
  const review=work.inspection!.jobs.find(j=>j.kind==='review')!;
  await client.call('POST',`/runs/${work.run.id}/jobs/${review.jobId}/review`,{expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'owner:review',approve:true});
  assert.equal((await readWorkspace(client,work.run.id)).run.status,'succeeded');
 }finally{client.close();}
});
