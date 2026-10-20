import {createId,StateConflict,type StateDatabase,type SqlSession,type Row} from '@leeos/database';
import {parse,runId} from '../api/contracts';
import {ApiError} from '../api/errors';
import {sameContent} from '../requirements';
import {compileEnvelope,envelopeDraft,envelopeAccept,envelopeRevoke,envelopeId,envelopeDigest} from './index';
import type {CapabilityPlan} from '../orchestrator/capability-plan';
const required=(row:Row|undefined)=>{if(!row)throw new ApiError(404,'NOT_FOUND','Run, plan or execution envelope not found.');return row;};
const stamp=(v:unknown)=>new Date(v as string|Date).toISOString();
async function history(tx:SqlSession,run:Row,id:string,kind:string,payload:Row){await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),run.project_id,run.id,kind,id,JSON.stringify(payload)]);}
export function createEnvelopeManager(db:StateDatabase,options:{now?:()=>Date}={}){
 const now=()=>options.now?.()??new Date();
 async function view(tx:SqlSession,row:Row){
  if(envelopeDigest(row.envelope)!==row.digest)throw new ApiError(503,'ENVELOPE_INTEGRITY_FAILED','The stored envelope failed its integrity check.');
  const run=required((await tx.query('SELECT status FROM runs WHERE id=$1',[row.run_id])).rows[0]);
  const revoked=(await tx.query('SELECT * FROM execution_envelope_revocations WHERE envelope_id=$1',[row.id])).rows[0];
  // Read-only inspection is not a claim or a live readiness check.
  return {id:String(row.id),runId:String(row.run_id),projectId:String(row.project_id),digest:String(row.digest),envelope:row.envelope as NonNullable<ReturnType<typeof compileEnvelope>['candidate']>,
   acceptedAt:stamp(row.created_at),authority:row.authority,acceptance:'persisted',dispatchEnabled:false,
   authorizationStatus:revoked?'revoked':new Date(row.grant_expires_at as string|Date).getTime()<=now().getTime()?'expired':!['queued','running'].includes(String(run.status))?'run-inactive':'recorded',
   revocation:revoked?{request:revoked.request,createdAt:stamp(revoked.created_at),authority:revoked.authority}:null,
   operationIdentities:(row.envelope as {operations:{key:string}[]}).operations.map(o=>({operationKey:o.key,idempotencyKey:String(row.id)+':'+o.key})),
   workerStatus:(await tx.query('SELECT state FROM envelope_work WHERE envelope_id=$1',[row.id])).rows[0]?.state??'queued',dispatchOwner:'independent-worker',apiDispatchEnabled:false};
 }
 async function candidate(tx:SqlSession,run:Row,value:unknown){
  const plan=required((await tx.query('SELECT * FROM run_plans WHERE run_id=$1',[run.id])).rows[0]);
  const binding=(await tx.query('SELECT * FROM run_requirements WHERE run_id=$1',[run.id])).rows[0];
  const p=plan.plan as CapabilityPlan;
  if(!binding||p.plannerVersion!=='3'||p.contract?.id!==binding.requirements_id||p.contract.revision!==binding.revision||p.contract.digest!==binding.digest)throw new StateConflict('Exact contract-bound capability plan required.');
  const result=compileEnvelope({id:String(run.id),projectId:String(run.project_id),version:Number(run.version)},Number(plan.run_version),p,value,now());
  const extra:string[]=[];
  if(run.status!=='queued')extra.push('RUN_NOT_QUEUED');
  if((await tx.query('SELECT id FROM jobs WHERE run_id=$1 LIMIT 1',[run.id])).rows.length||(await tx.query('SELECT run_id FROM run_preparations WHERE run_id=$1',[run.id])).rows.length)extra.push('RUN_ALREADY_PREPARED');
  if(extra.length)return {canAccept:false as const,blockers:[...result.blockers,...extra],candidate:null,digest:null};
  return result;
 }
 return {
  async preview(id:string,value:unknown){parse(runId,id);const input=parse(envelopeDraft,value);return db.transaction(async tx=>{
   const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR SHARE',[id])).rows[0]);
   const saved=(await tx.query('SELECT id FROM execution_envelopes WHERE run_id=$1',[id])).rows[0];
   if(saved)return {canAccept:false as const,blockers:['ENVELOPE_ALREADY_ACCEPTED'],candidate:null,digest:null};
   return candidate(tx,run,input);
  });},
  async get(id:string){parse(envelopeId,id);return db.transaction(async tx=>{const row=required((await tx.query('SELECT * FROM execution_envelopes WHERE id=$1',[id])).rows[0]);await tx.query('SELECT id FROM runs WHERE id=$1 FOR SHARE',[row.run_id]);return view(tx,row);});},
  async forRun(id:string){parse(runId,id);return db.transaction(async tx=>{required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR SHARE',[id])).rows[0]);return view(tx,required((await tx.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[id])).rows[0]));});},
  async accept(id:string,value:unknown){parse(runId,id);const input=parse(envelopeAccept,value);return db.transaction(async tx=>{
   const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[id])).rows[0]);
   const prior=(await tx.query('SELECT * FROM execution_envelopes WHERE run_id=$1',[id])).rows[0];
   if(prior){if(!sameContent(prior.request,input))throw new StateConflict('This run already has a different accepted envelope.');return view(tx,prior);}
   const draft=parse(envelopeDraft,{expectedRunVersion:input.expectedRunVersion,reviewedPlanDigest:input.reviewedPlanDigest,grantExpiresAt:input.grantExpiresAt,contractInputs:input.contractInputs,constraints:input.constraints,operations:input.operations,acceptanceBindings:input.acceptanceBindings});
   const result=await candidate(tx,run,draft);
   if(!result.canAccept||!result.candidate||result.digest!==input.reviewedEnvelopeDigest)throw new ApiError(409,'ENVELOPE_BLOCKED','Preview and review the exact supported envelope before acceptance.');
   const body=result.candidate,p=body.routing.plan,acceptedId=createId('envelope');
   const row=(await tx.query('INSERT INTO execution_envelopes(id,run_id,project_id,requirements_id,requirements_revision,requirements_digest,plan_run_version,plan_digest,request_key,request,envelope,digest,grant_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
    [acceptedId,run.id,run.project_id,p.contract.id,p.contract.revision,p.contract.digest,body.routing.planRunVersion,body.routing.planDigest,input.idempotencyKey,JSON.stringify(input),JSON.stringify(body),result.digest,input.grantExpiresAt])).rows[0];
   if(envelopeDigest(row.envelope)!==result.digest)throw new Error('Envelope persistence integrity mismatch.');
   await tx.query('INSERT INTO envelope_work(envelope_id,run_id) VALUES($1,$2)',[acceptedId,run.id]);
   // No prompt, response, credential or full input is copied to the event log.
   await history(tx,run,acceptedId,'execution-envelope.accepted',{digest:result.digest,planDigest:body.routing.planDigest,requirementsDigest:p.contract.digest,operationCount:body.operations.length,dispatchEnabled:false});
   return view(tx,row);
  });},
  async revoke(id:string,value:unknown){parse(envelopeId,id);const input=parse(envelopeRevoke,value);return db.transaction(async tx=>{
   const row=required((await tx.query('SELECT * FROM execution_envelopes WHERE id=$1',[id])).rows[0]);
   const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[row.run_id])).rows[0]);
   const prior=(await tx.query('SELECT * FROM execution_envelope_revocations WHERE envelope_id=$1',[id])).rows[0];
   if(prior){if(!sameContent(prior.request,input))throw new StateConflict('Envelope already revoked with another decision.');return view(tx,row);}
   if(row.digest!==input.reviewedEnvelopeDigest)throw new StateConflict('Review the exact accepted envelope.');
   await tx.query('INSERT INTO execution_envelope_revocations(envelope_id,run_id,request) VALUES($1,$2,$3)',[id,row.run_id,JSON.stringify(input)]);
   await history(tx,run,id,'execution-envelope.revoked',{digest:row.digest});return view(tx,row);
  });}
 };
}
