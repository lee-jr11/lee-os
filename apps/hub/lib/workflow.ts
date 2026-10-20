import type { Proposal,ApprovalReceipt } from '@leeos/core/request-intake';
import { OwnerClient,OwnerApiError } from './owner-client';
export type Page<T>={items:T[];nextCursor:string|null};
export type Project={id:string;name:string;status:string;lifecycleVersion:number};
export type RequestSummary={id:string;goal:string;status:string;version:number};
export type Intake={id:string;text:string;status:string;version:number;proposalVersion:number;proposalDigest:string;proposal:Proposal;approval:ApprovalReceipt|null};
export type Run={automationVersion?:number;definitionSnapshot?:unknown;projectId:string;id:string;status:string;version:number;spentUsd:string;createdAt:string};
export type Job={id:string;stepKey:string;status:string;attempt:number;checkpointVersion:number};
export type Agent={assignment:{id:string;jobId:string;roleId:string};currentStatus:string;version:number};
export type Blueprint={jobId:string|null;stepKey:string;title:string;kind:string;dependsOn:string[];dependenciesSatisfied:boolean;currentStatus:string|null};
export type Inspection={runVersion:number;planDigest:string;canPrepare:boolean;blockingReasons:string[];jobs:Blueprint[];preparation:{receipt:unknown;createdAt:string}|null};
export type Plan={plan:{plannerVersion?:string;goal:string;steps:{key:string;title:string;kind:string;dependsOn:string[]}[]}};
export type Result={status:string;text:string|null;callId:string|null;providerStatus:string|null;errorCode:string|null;recoveryRequired:boolean};
export type Provider={enabled:boolean;connection:string;modelFingerprint?:string;contextTokens?:number};
export type System={jobExecutionEnabled:boolean;coordinationEnabled:boolean};
export type Workspace={run:Run;plan:Plan|null;inspection:Inspection|null;jobs:Job[];agents:Agent[]};
async function optional<T>(work:Promise<T>){try{return await work;}catch(error){if(error instanceof OwnerApiError&&error.status===404)return null;throw error;}}
export async function readWorkspace(client:OwnerClient,id:string):Promise<Workspace>{
 const [run,plan,inspection,jobs,agents]=await Promise.all([client.call<Run>('GET',`/runs/${id}`),optional(client.call<Plan>('GET',`/runs/${id}/plan`)),optional(client.call<Inspection>('GET',`/runs/${id}/execution`)),client.call<Page<Job>>('GET',`/runs/${id}/jobs?limit=100`),client.call<Page<Agent>>('GET',`/runs/${id}/agents?limit=100`)]);
 if(jobs.nextCursor||agents.nextCursor)throw new Error('This run exceeds the Hub view limit. Use the owner API to inspect the complete run.');
 return {run,plan,inspection,jobs:jobs.items,agents:agents.items};
}
export async function assignTextAgents(client:OwnerClient,work:Workspace){
 if(work.run.status!=='queued'||!work.inspection?.preparation)throw new Error('Prepare a queued run before assigning agents.');
 const role=await client.call<{id:string}>('POST','/agents/roles',{name:'Local text assistant',purpose:'Carry out owner-approved local text jobs.',stepKinds:['model'],permissions:[],idempotencyKey:'hub-local-text-role-v1'});
 for(const job of work.inspection.jobs.filter(j=>j.kind==='model'&&j.jobId)){
  if(work.agents.some(a=>a.assignment.jobId===job.jobId))continue;
  await client.call('POST',`/runs/${work.run.id}/jobs/${job.jobId}/agent`,{roleId:role.id,expectedRunVersion:work.run.version,reviewedPlanDigest:work.inspection.planDigest,mode:'assignment-only',permissions:[]});
 }
}
export function modelBlockers(work:Workspace,job:Blueprint,system:System|null,provider:Provider|null){
 const agent=work.agents.find(a=>a.assignment.jobId===job.jobId),reasons:string[]=[];
 if(!system?.jobExecutionEnabled)reasons.push('Local job execution is disabled.');
 if(!provider?.enabled||provider.connection!=='ready'||!provider.modelFingerprint)reasons.push('Check a ready local model first.');
 if(!['queued','running'].includes(work.run.status)||job.currentStatus!=='pending')reasons.push('This job is not available to start.');
 if(!job.dependenciesSatisfied)reasons.push('Earlier steps must finish first.');
 if(agent?.currentStatus!=='planned')reasons.push('This job needs an available assigned agent.');
 if(work.run.status==='queued'&&work.inspection?.jobs.some(j=>j.kind==='model'&&!work.agents.some(a=>a.assignment.jobId===j.jobId&&a.currentStatus==='planned')))reasons.push('Assign all text jobs before starting this run.');
 return reasons;
}

// Recovery is deliberately read-only. Never retry a mutation or reconcile automatically.
export async function recoverSavedRun(client:OwnerClient,projectId:string,id:string){
 if(!/^run_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw new Error('Enter a saved run ID, starting with run_.');
 const run=await client.call<Run>('GET',`/runs/${id}`);
 if(run.projectId!==projectId)throw new Error('This run belongs to another project. Choose its project first.');
 const work=await readWorkspace(client,id),results:Record<string,Result>={};
 for(const job of work.jobs){if(job.attempt>0)results[job.id]=await client.call<Result>('GET',`/runs/${id}/jobs/${job.id}/result`);}
 return {work,results};
}
