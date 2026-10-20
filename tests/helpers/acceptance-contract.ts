import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { StateDatabase } from '../../packages/database/src';
import { handleCoreRequest } from '../../packages/core/src/api/http';
import { createLocalAdapter } from '../../packages/providers/src/local';
import { createLocalProviderManager } from '../../packages/core/src/provider-manager/service';
import { fixtureTransport } from './local-provider-contract';
import { OwnerClient } from '../../apps/hub/lib/owner-client';
import { sequenceDefinition,readSequence,queueAutomationRun,saveReviewedSequence } from '../../apps/hub/lib/automations';
import { readCoordination,type Automation,type Trigger } from '../../apps/hub/lib/coordination';
import { readWorkspace,recoverSavedRun,assignTextAgents,type Provider,type Result } from '../../apps/hub/lib/workflow';
export async function exerciseAcceptance(db:StateDatabase,t:TestContext){
 await t.test('V1 acceptance: reusable work, one authorized call, owner review, recovery and queue-only trigger',async()=>{
  const origin='http://127.0.0.1:3000',token='b'.repeat(64),fixture=fixtureTransport();
  const provider=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(fixture.transport)});
  const transport:typeof fetch=async(url,init)=>{const headers=new Headers(init?.headers);headers.set('Host','127.0.0.1:3000');return handleCoreRequest(new Request(String(url),{...init,headers}),{origin,token,database:()=>db,localProvider:provider,jobExecutionEnabled:()=>true,coordinationEnabled:()=>true});};
  const c=new OwnerClient(origin,token,transport);let reconnected:OwnerClient|undefined;
  try{
   const p=await c.call<{id:string}>('POST','/projects',{name:'V1 acceptance'}),definition=sequenceDefinition('Draft and review a note','Draft a note');
   const a=await c.call<Automation>('POST',`/projects/${p.id}/automations`,{name:'Reusable acceptance note',definition});
   let work=(await queueAutomationRun(c,p.id,a.id,a.version,'acceptance-run')).work;assert.equal(work.plan,null);assert.equal(work.jobs.length,0);assert.deepEqual(readSequence(work.run.definitionSnapshot),definition);
   work=await saveReviewedSequence(c,work.run,definition);assert.equal(work.jobs.length,0);
   await c.call('POST',`/runs/${work.run.id}/execution`,{expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
   work=await readWorkspace(c,work.run.id);await assignTextAgents(c,work);work=await readWorkspace(c,work.run.id);
   assert.equal(fixture.generated,0);const model=await c.call<Provider>('GET','/providers/local'),job=work.inspection!.jobs.find(j=>j.kind==='model')!,agent=work.agents.find(a=>a.assignment.jobId===job.jobId)!;
   const body={expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'local:text',agentId:agent.assignment.id,expectedAgentVersion:agent.version,modelFingerprint:model.modelFingerprint,prompt:'Owner approved acceptance fixture',maxOutputTokens:16};
   await assert.rejects(c.call('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,{...body,acknowledgeExecution:false}));assert.equal(fixture.generated,0);
   const result=await c.call<Result>('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,body);assert.equal(result.status,'succeeded');
   assert.deepEqual(await c.call('POST',`/runs/${work.run.id}/jobs/${job.jobId}/execute`,body),result);assert.equal(fixture.generated,1);
   work=await readWorkspace(c,work.run.id);assert.equal(work.run.status,'running');const review=work.inspection!.jobs.find(j=>j.kind==='review')!;
   await c.call('POST',`/runs/${work.run.id}/jobs/${review.jobId}/review`,{expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection!.planDigest,acknowledgeExecution:true,permission:'owner:review',approve:true});
   c.close();await assert.rejects(c.call('GET','/system'));reconnected=new OwnerClient(origin,token,transport);
   const recovered=await recoverSavedRun(reconnected,p.id,work.run.id);assert.equal(recovered.work.run.status,'succeeded');assert.equal(Object.keys(recovered.results).length,2);assert.equal(fixture.generated,1);assert.equal(Number(recovered.work.run.spentUsd),0);
   const schedule=await reconnected.call<Trigger>('POST',`/projects/${p.id}/schedules`,{automationId:a.id,expectedAutomationVersion:a.version,idempotencyKey:'acceptance-trigger',action:'queue-run-for-review',acknowledgeNoExecution:true,kind:'once',runAt:'2020-01-01T00:00:00.000Z'});assert.equal(schedule.enabled,false);
   await reconnected.call('POST',`/schedules/${schedule.id}/commands`,{action:'enable',expectedVersion:0});await reconnected.call('POST','/coordinator/tick',{limit:10});
   const view=await readCoordination(reconnected,p.id),receipt=view.receipts.items.find(r=>r.scheduleId===schedule.id)!;assert.equal(receipt.outcome,'queued');
   const triggered=await readWorkspace(reconnected,receipt.runId!);assert.equal(triggered.run.status,'queued');assert.equal(triggered.plan,null);assert.equal(triggered.jobs.length,0);assert.equal(triggered.agents.length,0);assert.equal(fixture.generated,1);
   assert.equal(view.schedules.items.find(s=>s.id===schedule.id)?.nextRunAt,null);
   await reconnected.call('POST',`/runs/${triggered.run.id}/commands`,{action:'cancel',expectedVersion:triggered.run.version});assert.equal((await readWorkspace(reconnected,triggered.run.id)).run.status,'cancelled');
  }finally{c.close();reconnected?.close();}
 });
}
