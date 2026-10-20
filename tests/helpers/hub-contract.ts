import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { StateDatabase } from '../../packages/database/src';
import { handleCoreRequest } from '../../packages/core/src/api/http';
import { createLocalAdapter } from '../../packages/providers/src/local';
import { createLocalProviderManager } from '../../packages/core/src/provider-manager/service';
import { fixtureTransport } from './local-provider-contract';
import { OwnerClient } from '../../apps/hub/lib/owner-client';
import { recoverSavedRun,readWorkspace,assignTextAgents,modelBlockers,type Intake,type Provider,type Result } from '../../apps/hub/lib/workflow';
export async function exerciseHub(db:StateDatabase,t:TestContext){
 await t.test('Hub client connects request, plan, prepared jobs, scoped agents and owner-reviewed results',async()=>{
  const origin='http://127.0.0.1:3000',token='d'.repeat(64),fixture=fixtureTransport(),provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(fixture.transport)});
  const transport:typeof fetch=async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3000');return handleCoreRequest(new Request(String(url),{...init,headers}),{origin,token,database:()=>db,localProvider:provider,jobExecutionEnabled:()=>true});};
  const client=new OwnerClient(origin,token,transport);
  try{
   const project=await client.call<{id:string}>('POST','/projects',{name:'Generic Hub workflow'});
   const request=await client.call<Intake>('POST',`/projects/${project.id}/requests`,{text:'Draft a welcome message then rewrite the message in a warmer tone',idempotencyKey:'hub-request'});
   const approved=await client.call<{runId:string}>('POST',`/requests/${request.id}/approve`,{expectedVersion:request.version,reviewedProposalDigest:request.proposalDigest,acknowledgePlanReview:true,action:'create-reviewed-run'});
   let work=await readWorkspace(client,approved.runId);assert.equal(work.jobs.length,0);assert.ok(work.inspection?.canPrepare);
   await assert.rejects(assignTextAgents(client,work));
   await client.call('POST',`/runs/${work.run.id}/execution`,{expectedRunVersion:work.inspection!.runVersion,reviewedPlanDigest:work.inspection!.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
   work=await readWorkspace(client,work.run.id);assert.equal(work.jobs.length,3);assert.ok(modelBlockers(work,work.inspection!.jobs[0],{jobExecutionEnabled:false,coordinationEnabled:false},null).length>0);
   await assignTextAgents(client,work);work=await readWorkspace(client,work.run.id);await assignTextAgents(client,work);assert.equal(work.agents.length,2);
   const local=await client.call<Provider>('GET','/providers/local');
   const later=work.inspection!.jobs.find(j=>j.stepKey==='step_2')!;assert.ok(modelBlockers(work,later,{jobExecutionEnabled:true,coordinationEnabled:false},local).some(r=>r.includes('Earlier')));
   for(const key of ['step_1','step_2']){
    const job=work.inspection!.jobs.find(j=>j.stepKey===key)!,agent=work.agents.find(a=>a.assignment.jobId===job.jobId)!;
    assert.deepEqual(modelBlockers(work,job,{jobExecutionEnabled:true,coordinationEnabled:false},local),[]);
    const result=await client.call<Result>('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,{expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'local:text',agentId:agent.assignment.id,expectedAgentVersion:agent.version,modelFingerprint:local.modelFingerprint,prompt:'Owner-approved fixture prompt',maxOutputTokens:16});
    assert.equal(result.status,'succeeded');assert.ok(result.text);work=await readWorkspace(client,work.run.id);
   }
   const review=work.inspection!.jobs.find(j=>j.kind==='review')!;assert.equal(work.run.status,'running');
   await client.call('POST',`/runs/${work.run.id}/jobs/${review.jobId}/review`,{expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'owner:review',approve:true});
   work=await readWorkspace(client,work.run.id);assert.equal(work.run.status,'succeeded');assert.equal(fixture.generated,2);const recovered=await recoverSavedRun(client,work.run.projectId,work.run.id);assert.equal(recovered.work.run.status,'succeeded');assert.equal(Object.keys(recovered.results).length,3);assert.equal(fixture.generated,2);await assert.rejects(recoverSavedRun(client,'another-project',work.run.id));assert.ok(work.agents.every(a=>a.currentStatus==='dismissed'));
   assert.equal((await client.call<Result>('GET',`/runs/${work.run.id}/jobs/${review.jobId}/result`)).status,'succeeded');
   assert.equal((await client.call<Result>('POST',`/runs/${work.run.id}/jobs/${review.jobId}/reconcile`,{})).status,'succeeded');
  }finally{client.close();}
 });
}
