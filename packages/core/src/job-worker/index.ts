import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createId,StateConflict,type StateDatabase,type SqlSession,type Row } from '@leeos/database';
import { parse,runId,jobId,agentId } from '../api/contracts';
import { ApiError } from '../api/errors';
import { localGenerateRequest } from '../provider-manager';
import { createLocalProviderManager } from '../provider-manager/service';
import { planDigest } from '../execution-manager';

const common={expectedRunVersion:z.number().int().min(0).max(2147483646),reviewedPlanDigest:z.string().regex(/^[a-f0-9]{64}$/),acknowledgeExecution:z.literal(true)};
export const executeJobRequest=z.strictObject({...common,permission:z.literal('local:text'),agentId,expectedAgentVersion:z.number().int().min(0).max(2147483646),
 modelFingerprint:z.string().regex(/^[a-f0-9]{64}$/),prompt:localGenerateRequest.shape.prompt,maxOutputTokens:localGenerateRequest.shape.maxOutputTokens});
export const reviewJobRequest=z.strictObject({...common,permission:z.literal('owner:review'),approve:z.literal(true)});
function hash(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function required(row:Row|undefined):Row{if(!row)throw new ApiError(404,'NOT_FOUND','Prepared job or execution not found.');return row;}
async function history(tx:SqlSession,run:Row,job:string,kind:string,payload:Row={}){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),run.project_id,run.id,kind,job,JSON.stringify(payload)]);
}
async function load(tx:SqlSession,run:string,job:string){
 const parent=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[run])).rows[0]);
 const prepared=required((await tx.query('SELECT j.*,p.blueprint FROM jobs j JOIN prepared_jobs p ON p.job_id=j.id WHERE j.id=$1 AND j.run_id=$2',[job,run])).rows[0]);
 return {parent,prepared};
}
async function validate(tx:SqlSession,parent:Row,prepared:Row,input:z.infer<typeof reviewJobRequest>|z.infer<typeof executeJobRequest>,kind:string){
 if(!['queued','running'].includes(String(parent.status))||parent.version!==input.expectedRunVersion||prepared.status!=='pending'||prepared.attempt_count!==0)
  throw new StateConflict('Review the current run and pending job.');
 const plan=required((await tx.query('SELECT * FROM run_plans WHERE run_id=$1',[parent.id])).rows[0]);
 if(input.reviewedPlanDigest!==planDigest(String(parent.id),Number(plan.run_version),plan.plan))throw new StateConflict('Plan review changed.');
 const blueprint=prepared.blueprint as Row;
 if(blueprint.kind!==kind)throw new StateConflict('This executor does not support that step kind.');
 const deps=blueprint.dependsOn as string[];
 const states=(await tx.query('SELECT step_key,status FROM jobs WHERE run_id=$1',[parent.id])).rows;
 if(!deps.every(key=>states.some(j=>j.step_key===key&&j.status==='succeeded')))throw new StateConflict('Dependencies must succeed first.');
 // Explicit model requirements are retained by the plan, not the preparation blueprint.
 if(kind==='model'){
  const step=(plan.plan as {steps:({key:string;model?:{capabilities:string[];allowedProviderIds?:string[];outputTokens:number}})[]}).steps.find(s=>s.key===prepared.step_key);
  if(step?.model){
   if(step.model.capabilities.some(c=>c!=='text')||(step.model.allowedProviderIds&&!step.model.allowedProviderIds.includes('llamacpp-local'))||('maxOutputTokens' in input&&input.maxOutputTokens>step.model.outputTokens))throw new StateConflict('The local text grant does not satisfy this plan model scope.');
  }
 }
}
async function agentValid(tx:SqlSession,run:string,job:string,id:string,version:number){
 const agent=(await tx.query('SELECT g.* FROM agents g JOIN agent_assignments a ON a.agent_id=g.id WHERE a.job_id=$1 AND a.run_id=$2 AND g.id=$3',[job,run,id])).rows[0];
 if(!agent||agent.status!=='planned'||agent.version!==version)throw new StateConflict('The assigned agent was changed or dismissed.');
}
async function startRun(tx:SqlSession,parent:Row,job:string){
 if(parent.status==='queued'){
  await tx.query("UPDATE runs SET status='running',version=version+1,started_at=COALESCE(started_at,now()) WHERE id=$1",[parent.id]);
  await history(tx,parent,job,'run.running',{authority:'owner-controlled-job'});
 }
}
async function finishRun(tx:SqlSession,parent:Row,job:string,failed=false){
 const unfinished=(await tx.query("SELECT id FROM jobs WHERE run_id=$1 AND status<>'succeeded' LIMIT 1",[parent.id])).rows.length;
 if(!failed&&unfinished)return;
 const status=failed?'failed':'succeeded';
 if(failed){
  const cancelled=(await tx.query("UPDATE jobs SET status='cancelled' WHERE run_id=$1 AND status IN ('pending','running','interrupted') RETURNING id",[parent.id])).rows;
  for(const row of cancelled)await history(tx,parent,String(row.id),'job.cancelled',{reason:'run.failed'});
 }
 await tx.query('UPDATE runs SET status=$2,version=version+1,finished_at=now() WHERE id=$1',[parent.id,status]);
 const dismissed=(await tx.query("UPDATE agents SET status='dismissed',version=version+1 WHERE run_id=$1 AND status='planned' AND EXISTS(SELECT 1 FROM agent_assignments WHERE agent_id=agents.id) RETURNING id",[parent.id])).rows;
 for(const row of dismissed)await history(tx,parent,String(row.id),'agent.dismissed',{reason:`run.${status}`});
 await history(tx,parent,job,`run.${status}`);
}
export function createJobWorker(db:StateDatabase,options:{enabled:()=>boolean;provider:ReturnType<typeof createLocalProviderManager>}){
 const assertEnabled=()=>{if(!options.enabled())throw new ApiError(503,'JOB_EXECUTION_DISABLED','Explicitly enable controlled job execution first.');options.provider.assertEnabled();};
 async function get(run:string,job:string){
  parse(runId,run);parse(jobId,job);
  const execution=required((await db.query('SELECT * FROM job_executions WHERE job_id=$1 AND run_id=$2',[job,run])).rows[0]);
  const call=execution.call_id?(await db.query('SELECT status,output_text,error_code,recovery_required FROM provider_calls WHERE id=$1',[execution.call_id])).rows[0]:null;
  return {jobId:job,runId:run,agentId:execution.agent_id,permission:execution.permission,status:execution.status,attempt:execution.attempt,callId:execution.call_id,
   providerStatus:call?.status??null,text:execution.status==='succeeded'?call?.output_text??null:null,errorCode:call?.error_code??null,recoveryRequired:call?.recovery_required??false};
 }
 async function reconcile(run:string,job:string){
  parse(runId,run);parse(jobId,job);
  await db.transaction(async tx=>{
   const {parent,prepared}=await load(tx,run,job);
   const execution=required((await tx.query('SELECT * FROM job_executions WHERE job_id=$1 AND run_id=$2',[job,run])).rows[0]);
   if(execution.status!=='running')return;
   const call=required((await tx.query('SELECT * FROM provider_calls WHERE id=$1',[execution.call_id])).rows[0]);
   if(call.status==='running')throw new StateConflict('Call still running. Recover the provider after stopping callers and restarting the backend if necessary.');
   const agent=(await tx.query('SELECT status,version FROM agents WHERE id=$1',[execution.agent_id])).rows[0];
   const live=parent.status==='running'&&prepared.status==='running'&&prepared.attempt_count===execution.attempt&&prepared.checkpoint_version===0&&agent?.status==='planned'&&agent.version===0;
   const status=!live?'discarded':call.status==='succeeded'?'succeeded':'failed';
   await tx.query('UPDATE job_executions SET status=$2,finished_at=now() WHERE job_id=$1',[job,status]);
   await history(tx,parent,job,`job.execution-${status}`,{callId:call.id,attempt:execution.attempt});
   if(live){
    await tx.query('UPDATE jobs SET status=$2,checkpoint_version=checkpoint_version+1,checkpoint=$3,last_heartbeat_at=now() WHERE id=$1',[job,status,JSON.stringify({callId:call.id,permission:'local:text'})]);
    await history(tx,parent,job,`job.${status}`,{attempt:execution.attempt});
    await finishRun(tx,parent,job,status==='failed');
   }else if(parent.status==='running'&&prepared.status==='running'){
    await tx.query("UPDATE jobs SET status='failed' WHERE id=$1",[job]);
    await history(tx,parent,job,'job.failed',{reason:'execution-authority-revoked'});await finishRun(tx,parent,job,true);
   }
  });return get(run,job);
 }
 return {get,reconcile,assertEnabled,
  async execute(run:string,job:string,value:unknown,signal?:AbortSignal){
   parse(runId,run);parse(jobId,job);const input=parse(executeJobRequest,value);assertEnabled();const digest=hash(input);
   const prior=(await db.query('SELECT request_hash FROM job_executions WHERE job_id=$1 AND run_id=$2',[job,run])).rows[0];
   if(prior){if(prior.request_hash!==digest)throw new StateConflict('This job already has a different execution authorization.');return reconcile(run,job);}
   await options.provider.generate(db,{prompt:input.prompt,maxOutputTokens:input.maxOutputTokens,idempotencyKey:`job-execution:${job}`},signal,{
    runId:run,agentId:input.agentId,
    async reserve(tx,callId){
     assertEnabled();
     const {parent,prepared}=await load(tx,run,job);await validate(tx,parent,prepared,input,'model');await agentValid(tx,run,job,input.agentId,input.expectedAgentVersion);
     // Assignment versions can only be zero while planned; dismissal permanently revokes the grant.
     if(input.expectedAgentVersion!==0)throw new StateConflict('Agent has been revoked.');
     await tx.query("INSERT INTO job_executions(job_id,run_id,agent_id,call_id,request_hash,permission,attempt,status) VALUES($1,$2,$3,$4,$5,'local:text',1,'running')",[job,run,input.agentId,callId,digest]);
     await startRun(tx,parent,job);
     await tx.query("UPDATE jobs SET status='running',attempt_count=1,last_heartbeat_at=now() WHERE id=$1",[job]);
     await history(tx,parent,job,'job.execution-authorized',{agentId:input.agentId,callId,permission:input.permission,modelFingerprint:input.modelFingerprint,maxOutputTokens:input.maxOutputTokens,requestHash:digest});
     await history(tx,parent,job,'job.started',{attempt:1});
    },
    async eligible(tx,fingerprint){
     assertEnabled();
     const {parent,prepared}=await load(tx,run,job);
     if(parent.status!=='running'||prepared.status!=='running'||prepared.attempt_count!==1||prepared.checkpoint_version!==0||fingerprint!==input.modelFingerprint)throw new StateConflict('Execution authority or local model changed.');
     await agentValid(tx,run,job,input.agentId,input.expectedAgentVersion);
     assertEnabled();
    }
   });
   return reconcile(run,job);
  },
  async review(run:string,job:string,value:unknown){
   parse(runId,run);parse(jobId,job);const input=parse(reviewJobRequest,value);const digest=hash(input);
   await db.transaction(async tx=>{
    const {parent,prepared}=await load(tx,run,job);
    const saved=(await tx.query('SELECT request_hash FROM job_executions WHERE job_id=$1',[job])).rows[0];
    if(saved){if(saved.request_hash!==digest)throw new StateConflict('Different review already recorded.');return;}
    await validate(tx,parent,prepared,input,'review');await startRun(tx,parent,job);
    await tx.query("INSERT INTO job_executions(job_id,run_id,request_hash,permission,attempt,status,finished_at) VALUES($1,$2,$3,'owner:review',1,'succeeded',now())",[job,run,digest]);
    await tx.query("UPDATE jobs SET status='succeeded',attempt_count=1,checkpoint_version=checkpoint_version+1,checkpoint=$2 WHERE id=$1",[job,JSON.stringify({permission:'owner:review',approved:true})]);
    await history(tx,parent,job,'job.owner-approved');await finishRun(tx,parent,job);
   });return get(run,job);
  }
 };
}
