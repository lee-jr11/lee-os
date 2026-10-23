import {createHash} from 'node:crypto';
import {z} from 'zod';
import {createId,type StateDatabase,type Row,type SqlSession} from '@leeos/database';
import {defaultProviderRegistry} from '@leeos/providers';
import {createGeminiAdapter,GeminiProviderError,geminiModelId,geminiProviderId} from '@leeos/providers/gemini';
import type {ProviderDescriptor} from '@leeos/providers';
import {routeModel} from '../model-router';
import {ApiError} from '../api/errors';
import {localGenerateRequest,recoverLocalRequest,type ProviderExecutionScope} from './index';

const zeroCostRetries=new Set(['GEMINI_RATE_LIMITED']);
const preflightTimeoutMs=30_000;
const generationTimeoutMs=60_000;
function withTimeout(callerSignal:AbortSignal|undefined,timeoutMs:number){const timeout=AbortSignal.timeout(timeoutMs);return callerSignal?AbortSignal.any([callerSignal,timeout]):timeout;}
const view=(row:Row)=>({id:row.id,idempotencyKey:row.request_key,providerId:row.provider_id,modelId:row.model_id,status:row.status,version:row.version,
 text:row.output_text,inputTokens:row.input_tokens,outputTokens:row.output_tokens,errorCode:row.error_code,recoveryRequired:row.recovery_required,
 retryable:row.retryable===true,
 costStatus:row.usage_cost_status??null,costEvidenceRef:row.cost_evidence_ref??null,
 createdAt:new Date(row.created_at as string|Date).toISOString(),finishedAt:row.finished_at?new Date(row.finished_at as string|Date).toISOString():null});
const recoverGemini=z.strictObject({callId:recoverLocalRequest.shape.callId,expectedVersion:recoverLocalRequest.shape.expectedVersion,acknowledgeRemoteRequestFinished:z.literal(true)});
const requestHash=(prompt:string,maxOutputTokens:number)=>createHash('sha256').update(JSON.stringify({prompt,maxOutputTokens})).digest('hex');
async function event(tx:SqlSession,id:string,kind:string,payload:Record<string,unknown>={}){await tx.query('INSERT INTO events(id,kind,entity_id,payload) VALUES($1,$2,$3,$4)',[createId('event'),kind,id,JSON.stringify({providerId:geminiProviderId,...payload})]);}
function safeCode(error:unknown){return error instanceof GeminiProviderError?error.code:'GEMINI_PREFLIGHT_FAILED';}

export function createGeminiProviderManager(options:{enabled:()=>boolean;adapter?:ReturnType<typeof createGeminiAdapter>}){
 const adapter=options.adapter??createGeminiAdapter({credentials:()=>{
  const apiKey=process.env.GEMINI_API_KEY,serviceAccountJson=process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;
  return apiKey&&serviceAccountJson?{apiKey,serviceAccountJson}:undefined;
 }});
 const active=new Set<string>();
 const enabled=()=>options.enabled();
 const assertEnabled=()=>{if(!enabled())throw new ApiError(503,'GEMINI_PROVIDER_DISABLED','Enable the explicitly configured Gemini free-tier provider first.');};
 return {
  providerId:geminiProviderId,
  assertEnabled,
  async inspect(signal?:AbortSignal){
   if(!enabled())return {providerId:geminiProviderId,enabled:false,connection:'disabled',jobAuthority:'separate-owner-grant'};
   try{const state=await adapter.probe(signal);return {providerId:geminiProviderId,enabled:true,connection:'ready',modelFingerprint:state.fingerprint,contextTokens:state.context,costEvidence:{status:'verified-zero',checkedAt:state.checkedAt,evidenceRef:state.evidenceRef,accountScope:state.accountScope},jobAuthority:'separate-owner-grant'};}
   catch(error){return {providerId:geminiProviderId,enabled:true,connection:'blocked',reason:safeCode(error),jobAuthority:'separate-owner-grant'};}
  },
  async registry(signal?:AbortSignal):Promise<ProviderDescriptor[]>{
   const providers=defaultProviderRegistry();
   if(!enabled())return providers;
   const gemini=await adapter.registry(signal);
   return providers.map(provider=>provider.id===geminiProviderId?gemini:provider);
  },
  async generate(db:StateDatabase,value:unknown,callerSignal?:AbortSignal,scope?:ProviderExecutionScope){
   assertEnabled();const input=localGenerateRequest.parse(value);
   if((input.idempotencyKey.startsWith('job-execution:')||input.idempotencyKey.startsWith('env_'))&&!scope)throw new ApiError(400,'INVALID_REQUEST','This key namespace is reserved for controlled work.');
   const hash=requestHash(input.prompt,input.maxOutputTokens);
   const reserved=await db.transaction(async tx=>{
    const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[geminiProviderId])).rows[0];
    const prior=(await tx.query('SELECT * FROM provider_calls WHERE request_key=$1',[input.idempotencyKey])).rows[0];
    if(prior){
     if(scope?.resumePreflight&&prior.status==='failed'&&zeroCostRetries.has(String(prior.error_code))&&prior.request_hash===hash){
      if(!slot||slot.call_id)throw new ApiError(409,'GEMINI_PROVIDER_BUSY','A Gemini request holds the provider slot.');
      await scope.resumePreflight(tx,String(prior.id));
      const row=(await tx.query("UPDATE provider_calls SET status='running',version=version+1,error_code=NULL,finished_at=NULL WHERE id=$1 RETURNING *",[prior.id])).rows[0];
      await tx.query('UPDATE provider_slots SET call_id=$2 WHERE id=$1',[geminiProviderId,prior.id]);await event(tx,String(prior.id),'provider.call-preflight-resumed');return {row,replay:false};
     }
     if(scope)throw new ApiError(409,'REQUEST_CONFLICT','Reconcile the existing remote provider call instead.');
     if(prior.request_hash!==hash)throw new ApiError(409,'REQUEST_CONFLICT','This key belongs to a different request.');
     if(prior.status==='running')throw new ApiError(409,'CALL_IN_PROGRESS','The original remote call is active or requires recovery.');
     return {row:prior,replay:true};
    }
    if(!slot)throw new ApiError(503,'STORAGE_NOT_READY','Apply the remote-provider migration.');
    if(slot.call_id)throw new ApiError(409,'GEMINI_PROVIDER_BUSY','A remote call holds the durable provider slot. Inspect or recover it before retrying.');
    const row=(await tx.query('INSERT INTO provider_calls(id,request_key,request_hash,provider_id,model_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
     [createId('call'),input.idempotencyKey,hash,geminiProviderId,geminiModelId])).rows[0];
    await scope?.reserve(tx,String(row.id));await tx.query('UPDATE provider_slots SET call_id=$2 WHERE id=$1',[geminiProviderId,row.id]);await event(tx,String(row.id),'provider.call-started');return {row,replay:false};
   });
   if(reserved.replay)return view(reserved.row);
   const id=String(reserved.row.id);active.add(id);let dispatched=false;
   const preflightSignal=withTimeout(callerSignal,preflightTimeoutMs);
   try{
    const initial=await adapter.probe(preflightSignal),tokens=await adapter.tokenize(input.prompt,preflightSignal),fresh=await adapter.probe(preflightSignal);
    if(initial.fingerprint!==fresh.fingerprint)throw new GeminiProviderError('GEMINI_MODEL_CHANGED');
    const decision=routeModel({capabilities:['text'],inputTokens:tokens,outputTokens:input.maxOutputTokens},{registry:[fresh.provider]});
    if(decision.status!=='selected')throw new GeminiProviderError(decision.evaluations.flatMap(e=>e.reasons).find(reason=>reason.includes('COST'))??'GEMINI_ZERO_COST_UNVERIFIED');
    if(tokens+input.maxOutputTokens>fresh.context)throw new GeminiProviderError('GEMINI_CAPACITY_EXCEEDED');
    await db.transaction(async tx=>{
     const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[geminiProviderId])).rows[0];if(slot?.call_id!==id)throw new ApiError(409,'RECOVERY_CONFLICT','The remote reservation changed.');
     await scope?.eligible(tx,fresh.fingerprint,tokens);
     await event(tx,id,'provider.call-eligible',{modelId:geminiModelId,modelFingerprint:fresh.fingerprint,inputTokens:tokens,contextTokens:fresh.context,maxOutputTokens:input.maxOutputTokens,costPolicy:'ZERO_ONLY',costStatus:'verified-zero',costUsd:0,costEvidenceRef:fresh.evidenceRef,costEvidenceCheckedAt:fresh.checkedAt,accountScope:fresh.accountScope});
    });
    // Repeat the live project billing and model check after the dispatch-intent
    // transaction, immediately before the single generation request.
    const final=await adapter.revalidate(fresh.fingerprint,preflightSignal),finalRoute=routeModel({capabilities:['text'],inputTokens:tokens,outputTokens:input.maxOutputTokens},{registry:[final.provider]});
    if(finalRoute.status!=='selected')throw new GeminiProviderError('GEMINI_ZERO_COST_UNVERIFIED');
    assertEnabled();preflightSignal.throwIfAborted();
    const generationSignal=withTimeout(callerSignal,generationTimeoutMs);generationSignal.throwIfAborted();dispatched=true;
    const result=await adapter.generate(input.prompt,input.maxOutputTokens,generationSignal);
    const row=await db.transaction(async tx=>{
     await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[geminiProviderId]);
     if(result.inputTokens!==tokens)throw new GeminiProviderError('GEMINI_USAGE_MISMATCH');
     const usage=createId('usage');
     await tx.query('INSERT INTO model_usage(id,provider_id,model_id,input_tokens,output_tokens,cost_usd,run_id,agent_id,cost_status,cost_evidence_ref,cost_evidence_checked_at,cost_account_scope) VALUES($1,$2,$3,$4,$5,0,$6,$7,\'verified-zero\',$8,$9,$10)',
      [usage,geminiProviderId,geminiModelId,result.inputTokens,result.outputTokens,scope?.runId??null,scope?.agentId??null,final.evidenceRef,final.checkedAt,final.accountScope]);
     const saved=(await tx.query("UPDATE provider_calls SET status='succeeded',version=version+1,output_text=$2,input_tokens=$3,output_tokens=$4,usage_id=$5,finished_at=clock_timestamp() WHERE id=$1 AND status='running' RETURNING *",
      [id,result.text,result.inputTokens,result.outputTokens,usage])).rows[0];if(!saved)throw new Error('Provider call state changed.');
     await event(tx,id,'provider.call-succeeded',{inputTokens:result.inputTokens,outputTokens:result.outputTokens,costUsd:0,costEvidenceRef:final.evidenceRef,costEvidenceCheckedAt:final.checkedAt,accountScope:final.accountScope});
     await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1 AND call_id=$2',[geminiProviderId,id]);return saved;
    });return view(row);
   }catch(error){
    const code=safeCode(error);
    const retryable=dispatched&&error instanceof GeminiProviderError&&error.retryable&&code==='GEMINI_HTTP_503';
    const interrupted=dispatched&&!retryable;
    const row=await db.transaction(async tx=>{
     await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[geminiProviderId]);
     const saved=(await tx.query('UPDATE provider_calls SET status=$2,version=version+1,error_code=$3,recovery_required=$4,retryable=$5,finished_at=clock_timestamp() WHERE id=$1 AND status=$6 RETURNING *',
      [id,interrupted?'interrupted':'failed',code,interrupted,retryable,'running'])).rows[0];if(!saved)throw new Error('Provider call state changed.');
     await event(tx,id,interrupted?'provider.call-interrupted':retryable?'provider.call-transient-failure':'provider.call-failed',{errorCode:code,retryable});
     if(!interrupted)await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1 AND call_id=$2',[geminiProviderId,id]);return saved;
    });return view(row);
   }finally{active.delete(id);}
  },
  async getCall(db:StateDatabase,id:string){
   const callId=recoverLocalRequest.shape.callId.parse(id),row=(await db.query('SELECT c.*,u.cost_status AS usage_cost_status,u.cost_evidence_ref FROM provider_calls c LEFT JOIN model_usage u ON u.id=c.usage_id WHERE c.id=$1 AND c.provider_id=$2',[callId,geminiProviderId])).rows[0];
   if(!row)throw new ApiError(404,'NOT_FOUND','Remote provider call not found.');return view(row);
  },
  async recover(db:StateDatabase,value:unknown){
   const input=recoverGemini.parse(value);if(active.has(input.callId))throw new ApiError(409,'CALL_IN_PROGRESS','Wait for this worker process to finish before recovery.');
   return db.transaction(async tx=>{
    const slot=(await tx.query('SELECT * FROM provider_slots WHERE id=$1 FOR UPDATE',[geminiProviderId])).rows[0];
    const call=(await tx.query('SELECT * FROM provider_calls WHERE id=$1 AND provider_id=$2',[input.callId,geminiProviderId])).rows[0];
    if(!call)throw new ApiError(404,'NOT_FOUND','Remote provider call not found.');
    const owner=(await tx.query("SELECT 1 FROM envelope_operations o JOIN envelope_work w ON w.envelope_id=o.envelope_id WHERE o.call_id=$1 AND w.state='running' AND w.lease_expires_at>clock_timestamp()",[input.callId])).rows[0];
    if(owner)throw new ApiError(409,'CALL_IN_PROGRESS','A valid worker lease still owns this request.');
    if(slot?.call_id!==input.callId||call.version!==input.expectedVersion||call.status!=='interrupted'||!call.recovery_required)throw new ApiError(409,'RECOVERY_CONFLICT','The remote call is not an unresolved request at that exact version.');
    const saved=(await tx.query("UPDATE provider_calls SET version=version+1,error_code='OWNER_CONFIRMED_REMOTE_REQUEST_FINISHED',recovery_required=false,finished_at=clock_timestamp() WHERE id=$1 RETURNING *",[input.callId])).rows[0];
    await tx.query('UPDATE provider_slots SET call_id=NULL WHERE id=$1',[geminiProviderId]);await event(tx,input.callId,'provider.remote-call-recovery-confirmed',{noRetry:true});return view(saved);
   });
  }
 };
}
