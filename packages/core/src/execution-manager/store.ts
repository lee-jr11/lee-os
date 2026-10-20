import { createId, StateConflict, type StateDatabase, type SqlSession, type Row } from '@leeos/database';
import { ApiError } from '../api/errors';
import { parse, runId } from '../api/contracts';
import { planDigest, prepareBlueprint, prepareRequest } from './index';
function stamp(value:unknown){return (value instanceof Date?value:new Date(String(value))).toISOString();}
function receiptView(row:Row){return {receipt:row.receipt,createdAt:stamp(row.created_at)};}
async function load(tx:SqlSession,id:string,lock:'UPDATE'|'SHARE') {
 const run=(await tx.query('SELECT * FROM runs WHERE id=$1 FOR '+lock,[id])).rows[0];
 if(!run)throw new ApiError(404,'NOT_FOUND','Run not found.');
 const plan=(await tx.query('SELECT * FROM run_plans WHERE run_id=$1',[id])).rows[0];
 if(!plan)throw new ApiError(404,'NOT_FOUND','Plan not found.');
 return {run,plan};
}
export function createExecutionManager(db:StateDatabase){
 return {
  async inspect(id:string){
   parse(runId,id);
   return db.transaction(async tx=>{
    const {run,plan}=await load(tx,id,'SHARE');
    if((plan.plan as Row).plannerVersion==='3'){
     const envelope=(await tx.query('SELECT id,digest FROM execution_envelopes WHERE run_id=$1',[id])).rows[0];
     return {
     runId:id,runStatus:run.status,runVersion:run.version,planRunVersion:plan.run_version,
     planDigest:planDigest(id,Number(plan.run_version),plan.plan),mode:'prepare-only',permissions:[],executionEnabled:false,
     canPrepare:false,blockingReasons:[envelope?'INDEPENDENT_WORKER_REQUIRED':'EXECUTION_ENVELOPE_REQUIRED'],jobs:[],preparation:null,
     acceptedEnvelope:envelope?{id:envelope.id,digest:envelope.digest}:null
    };}
    const blueprints=prepareBlueprint(plan.plan,Number(plan.run_version));
    const saved=(await tx.query('SELECT * FROM run_preparations WHERE run_id=$1',[id])).rows[0];
    const jobs=(await tx.query('SELECT id,step_key,status FROM jobs WHERE run_id=$1',[id])).rows;
    const states=new Map(jobs.map(j=>[String(j.step_key),j]));
    const blockers:string[]=[];
    if(saved)blockers.push('ALREADY_PREPARED');
    if(run.status!=='queued')blockers.push('RUN_NOT_QUEUED');
    if(run.version!==plan.run_version)blockers.push('PLAN_RUN_VERSION_CHANGED');
    if(jobs.length && !saved)blockers.push('EXISTING_JOBS');
    return {runId:id,runStatus:run.status,runVersion:run.version,planRunVersion:plan.run_version,
     planDigest:planDigest(id,Number(plan.run_version),plan.plan),mode:'prepare-only',permissions:[],executionEnabled:false,
     canPrepare:blockers.length===0,blockingReasons:blockers,
     jobs:blueprints.map(b=>({...b,jobId:states.get(b.stepKey)?.id??null,currentStatus:states.get(b.stepKey)?.status??null,
      dependenciesSatisfied:b.dependsOn.every(key=>states.get(key)?.status==='succeeded')})),
     preparation:saved?receiptView(saved):null};
   });
  },
  async prepare(id:string,value:unknown){
   parse(runId,id);const input=parse(prepareRequest,value);
   return db.transaction(async tx=>{
    const {run,plan}=await load(tx,id,'UPDATE');
    const saved=(await tx.query('SELECT * FROM run_preparations WHERE run_id=$1',[id])).rows[0];
    if(saved){
     const same=(await tx.query<{same:boolean}>('SELECT request=$2::jsonb AS same FROM run_preparations WHERE run_id=$1',[id,JSON.stringify(input)])).rows[0].same;
     if(!same)throw new StateConflict('A different preparation already exists.');
     return receiptView(saved);
    }
    const digest=planDigest(id,Number(plan.run_version),plan.plan);
    if(run.status!=='queued' || run.version!==input.expectedRunVersion || run.version!==plan.run_version || digest!==input.reviewedPlanDigest)
     throw new StateConflict('Review the current plan and run before preparation.');
    if((await tx.query('SELECT id FROM jobs WHERE run_id=$1 LIMIT 1',[id])).rows.length)throw new StateConflict('Run already has jobs.');
    const blueprints=prepareBlueprint(plan.plan,Number(plan.run_version));
    const jobs=blueprints.map(b=>({jobId:createId('job'),...b,initialStatus:'pending'}));
    const receipt={managerVersion:'1',runId:id,runVersion:run.version,reviewedPlanDigest:digest,mode:'prepare-only',
     permissions:[],executionEnabled:false,costPolicy:'ZERO_ONLY',jobs};
    const savedRow=(await tx.query('INSERT INTO run_preparations(run_id,request,receipt) VALUES($1,$2,$3) RETURNING *',[id,JSON.stringify(input),JSON.stringify(receipt)])).rows[0];
    for(const job of jobs){
     await tx.query('INSERT INTO jobs(id,run_id,step_key) VALUES($1,$2,$3)',[job.jobId,id,job.stepKey]);
     await tx.query('INSERT INTO prepared_jobs(job_id,run_id,step_key,blueprint) VALUES($1,$2,$3,$4)',[job.jobId,id,job.stepKey,JSON.stringify(job)]);
     await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',
      [createId('event'),run.project_id,id,'job.prepared',job.jobId,JSON.stringify({stepKey:job.stepKey,mode:'prepare-only'})]);
    }
    await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$3,$5)',
     [createId('event'),run.project_id,id,'run.jobs-prepared',JSON.stringify({planDigest:digest,jobCount:jobs.length,mode:'prepare-only'})]);
    return receiptView(savedRow);
   });
  }
 };
}
