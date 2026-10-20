import { createHash } from 'node:crypto';
import { createLocalAdapter,LocalProviderError,localProviderId } from '@leeos/providers/local';
import { defaultProviderRegistry } from '@leeos/providers';
import { createId,type StateDatabase,type Row,type SqlSession } from '@leeos/database';
import { routeModel } from '../model-router';
import { parse } from '../api/contracts';
import { ApiError } from '../api/errors';
import { localGenerateRequest,recoverLocalRequest } from './index';
import type {ProviderExecutionScope} from './index';
function view(row:Row){return {id:row.id,idempotencyKey:row.request_key,providerId:row.provider_id,modelId:row.model_id,status:row.status,version:row.version,
 text:row.output_text,inputTokens:row.input_tokens,outputTokens:row.output_tokens,errorCode:row.error_code,recoveryRequired:row.recovery_required,
 createdAt:new Date(row.created_at as string|Date).toISOString(),finishedAt:row.finished_at?new Date(row.finished_at as string|Date).toISOString():null};}
async function event(tx:SqlSession,id:string,kind:string,payload:Record<string,unknown>={}){await tx.query('INSERT INTO events(id,kind,entity_id,payload) VALUES($1,$2,$3,$4)',[createId('event'),kind,id,JSON.stringify({providerId:localProviderId,...payload})]);}
export async function getLocalCall(db:StateDatabase,id:string){
 parse(recoverLocalRequest.shape.callId,id);const row=(await db.query('SELECT * FROM provider_calls WHERE id=$1',[id])).rows[0];
 if(!row)throw new ApiError(404,'NOT_FOUND','Provider call not found.');return view(row);
}
export async function listLocalCalls(db:StateDatabase,after:string|null=null,limit=25){
 if(after)parse(recoverLocalRequest.shape.callId,after);
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new ApiError(400,'INVALID_REQUEST','Invalid page size.');
 const rows=(await db.query('SELECT * FROM provider_calls WHERE ($1::text IS NULL OR id>$1) ORDER BY id LIMIT $2',[after,limit+1])).rows;
 const items=rows.slice(0,limit);return {items:items.map(view),nextCursor:rows.length>limit?String(items.at(-1)!.id):null};
}
export function createLocalProviderManager(options:{enabled:()=>boolean;adapter?:ReturnType<typeof createLocalAdapter>}){
 const adapter=options.adapter??createLocalAdapter();const active=new Set<string>();
 const assertEnabled=()=>{if(!options.enabled())throw new ApiError(503,'LOCAL_PROVIDER_DISABLED','Enable the dedicated local-only provider first.');};
 return {
  providerId:localProviderId,
  assertEnabled,
  async inspect(signal?:AbortSignal){
   if(!options.enabled())return {providerId:localProviderId,enabled:false,connection:'disabled',jobAuthority:'separate-owner-grant'};
   try{const state=await adapter.probe(signal);return {providerId:localProviderId,enabled:true,connection:state.busy?'busy':'ready',contextTokens:state.context,modelFingerprint:state.fingerprint,jobAuthority:'separate-owner-grant'};}
   catch{return {providerId:localProviderId,enabled:true,connection:'unavailable',jobAuthority:'separate-owner-grant'};}
  },
  async registry(signal?:AbortSignal){
   const providers=defaultProviderRegistry();if(!options.enabled())return providers;
   try{return [...providers,(await adapter.probe(signal)).provider];}catch{return providers;}
  },
  async generate(db:StateDatabase,value:unknown,callerSignal?:AbortSignal,scope?:ProviderExecutionScope){
   assertEnabled();const input=parse(localGenerateRequest,value);
   if((input.idempotencyKey.startsWith('job-execution:')||input.idempotencyKey.startsWith('env_'))&&!scope)throw new ApiError(400,'INVALID_REQUEST','This key namespace is reserved for controlled work.');
   const hash=createHash('sha256').update(JSON.stringify({prompt:input.prompt,maxOutputTokens:input.maxOutputTokens})).digest('hex');
   const reserved=await db.transaction(async tx=>{
    const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[localProviderId])).rows[0];
    const prior=(await tx.query('SELECT * FROM provider_calls WHERE request_key=$1',[input.idempotencyKey])).rows[0];
    if(prior){
     if(scope?.resumePreflight&&prior.status==='failed'&&['LOCAL_BACKEND_BUSY','LOCAL_MODEL_CHANGED'].includes(String(prior.error_code))&&prior.request_hash===hash){
      if(!slot||slot.call_id)throw new ApiError(409,'LOCAL_PROVIDER_BUSY','A local call holds the durable slot.');
      await scope.resumePreflight(tx,String(prior.id));
      const row=(await tx.query("UPDATE provider_calls SET status='running',version=version+1,error_code=NULL,finished_at=NULL WHERE id=$1 RETURNING *",[prior.id])).rows[0];
      await tx.query('UPDATE provider_slots SET call_id=$2 WHERE id=$1',[localProviderId,prior.id]);await event(tx,String(prior.id),'provider.call-preflight-resumed');return {row,replay:false};
     }
     if(scope)throw new ApiError(409,'REQUEST_CONFLICT','Reconcile the existing job execution instead.');
     if(prior.request_hash!==hash)throw new ApiError(409,'REQUEST_CONFLICT','This key belongs to a different request.');
     if(prior.status==='running')throw new ApiError(409,'CALL_IN_PROGRESS','The original call is still running or requires recovery.');
     return {row:prior,replay:true};
    }
    if(!slot)throw new ApiError(503,'STORAGE_NOT_READY','Apply provider migrations.');
    if(slot.call_id)throw new ApiError(409,'LOCAL_PROVIDER_BUSY','A local call holds the durable slot. Inspect or recover it before retrying.');
    const row=(await tx.query('INSERT INTO provider_calls(id,request_key,request_hash,provider_id,model_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
     [createId('call'),input.idempotencyKey,hash,localProviderId,'leeos-local'])).rows[0];
    await scope?.reserve(tx,String(row.id));
    await tx.query('UPDATE provider_slots SET call_id=$2 WHERE id=$1',[localProviderId,row.id]);await event(tx,String(row.id),'provider.call-started');
    return {row,replay:false};
   });
   if(reserved.replay)return view(reserved.row);
   const id=String(reserved.row.id);active.add(id);let dispatched=false;
   const signal=callerSignal?AbortSignal.any([callerSignal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000);
   try{
    const initial=await adapter.probe(signal);
    if(initial.busy)throw new LocalProviderError('LOCAL_BACKEND_BUSY');
    const tokens=await adapter.tokenize(input.prompt,signal);
    const fresh=await adapter.probe(signal);
    if(initial.fingerprint!==fresh.fingerprint||fresh.busy)throw new LocalProviderError('LOCAL_MODEL_CHANGED');
    const decision=routeModel({capabilities:['text'],inputTokens:tokens.length,outputTokens:input.maxOutputTokens},{registry:[fresh.provider]});
    if(decision.status!=='selected'||tokens.length+input.maxOutputTokens>=fresh.context)throw new LocalProviderError('LOCAL_CAPACITY_EXCEEDED');
    await db.transaction(async tx=>{
     const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[localProviderId])).rows[0];
     if(slot?.call_id!==id)throw new ApiError(409,'RECOVERY_CONFLICT','The reservation changed.');
     await scope?.eligible(tx,fresh.fingerprint,tokens.length);
     await event(tx,id,'provider.call-eligible',{modelFingerprint:fresh.fingerprint,inputTokens:tokens.length,contextTokens:fresh.context,maxOutputTokens:input.maxOutputTokens,costPolicy:'ZERO_ONLY',evidence:'local-loopback-no-billing'});
    });
    // Preflight may await a backend or database lock; entry-time opt-in is not dispatch authority.
    assertEnabled();signal.throwIfAborted();dispatched=true;
    const result=await adapter.generate(tokens,input.maxOutputTokens,signal);
    const row=await db.transaction(async tx=>{
     await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[localProviderId]);
     const usage=createId('usage');
     await tx.query('INSERT INTO model_usage(id,provider_id,model_id,input_tokens,output_tokens,cost_usd,run_id,agent_id,cost_status,cost_evidence_ref,cost_evidence_checked_at,cost_account_scope) VALUES($1,$2,$3,$4,$5,0,$6,$7,\'verified-zero\',\'local-loopback-no-billing\',clock_timestamp(),\'local-process\')',[usage,localProviderId,'leeos-local',result.inputTokens,result.outputTokens,scope?.runId??null,scope?.agentId??null]);
     const saved=(await tx.query("UPDATE provider_calls SET status='succeeded',version=version+1,output_text=$2,input_tokens=$3,output_tokens=$4,usage_id=$5,finished_at=now() WHERE id=$1 AND status='running' RETURNING *",
      [id,result.text,result.inputTokens,result.outputTokens,usage])).rows[0];
     if(!saved)throw new Error('Call state changed.');
     await event(tx,id,'provider.call-succeeded');await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1 AND call_id=$2',[localProviderId,id]);return saved;
    });return view(row);
   }catch(error){
    const code=error instanceof LocalProviderError?error.code:dispatched?'LOCAL_RESULT_UNCERTAIN':'LOCAL_PREFLIGHT_FAILED';
    const row=await db.transaction(async tx=>{
     await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[localProviderId]);
     const saved=(await tx.query('UPDATE provider_calls SET status=$2,version=version+1,error_code=$3,recovery_required=$4,finished_at=now() WHERE id=$1 AND status=$5 RETURNING *',
      [id,dispatched?'interrupted':'failed',code,dispatched,'running'])).rows[0];
     if(!saved)throw new Error('Call state changed.');
     await event(tx,id,dispatched?'provider.call-interrupted':'provider.call-failed');
     if(!dispatched)await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1 AND call_id=$2',[localProviderId,id]);return saved;
    });return view(row);
   }finally{active.delete(id);}
  },
  async recover(db:StateDatabase,value:unknown){
   const input=parse(recoverLocalRequest,value);
   if(active.has(input.callId))throw new ApiError(409,'CALL_IN_PROGRESS','Wait for this process to finish before recovery.');
   return db.transaction(async tx=>{
    const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[localProviderId])).rows[0];
    const call=(await tx.query('SELECT * FROM provider_calls WHERE id=$1',[input.callId])).rows[0];
    if(!call)throw new ApiError(404,'NOT_FOUND','Provider call not found.');
    const owner=(await tx.query("SELECT 1 FROM envelope_operations o JOIN envelope_work w ON w.envelope_id=o.envelope_id WHERE o.call_id=$1 AND w.state='running' AND w.lease_expires_at>clock_timestamp()",[input.callId])).rows[0];
    if(owner)throw new ApiError(409,'CALL_IN_PROGRESS','An independent worker still holds this call. Stop workers and wait for fencing before recovery.');
    if(slot?.call_id!==input.callId||call.version!==input.expectedVersion)throw new ApiError(409,'RECOVERY_CONFLICT','Refresh the held call and version.');
    const saved=(await tx.query("UPDATE provider_calls SET status='interrupted',version=version+1,error_code=COALESCE(error_code,'OWNER_RECOVERED_AFTER_RESTART'),recovery_required=false,finished_at=COALESCE(finished_at,now()) WHERE id=$1 RETURNING *",[input.callId])).rows[0];
    await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1',[localProviderId]);await event(tx,input.callId,'provider.slot-recovered');return view(saved);
   });
  }
 };
}
