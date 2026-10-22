import {createHash,randomUUID} from 'node:crypto';
import {createId,StateConflict,type StateDatabase,type SqlSession,type Row} from '@leeos/database';
import {createResendEmailAdapter,parseResendDeliveryEvent,type ResendAttachment,type ResendEmailRequest,type ResendInspection,type ResendSendResult} from '@leeos/providers';
import {parse,runId} from '../api/contracts';
import {ApiError} from '../api/errors';
import {envelopeId,envelopeDigest,gemini503RetryPolicy,type EnvelopePreview} from '../execution-envelope';
import {sameContent} from '../requirements';
import type {EnvelopeProviderManager} from '../provider-manager';
import {createDocumentManager,DocumentExecutionError} from '../document-manager';
import {docxDocumentSchema,PythonDocxError} from '@leeos/executors/python-docx';
import {ArtifactStorageError,createArtifactStorage} from '../storage-manager';
import {claimSchema,workerId,humanReview,type Claim} from './index';
type Envelope=NonNullable<EnvelopePreview['candidate']>;
type Operation=Envelope['operations'][number];
type Context={run:Row;work:Row;row:Row;body:Envelope;ops:Row[]};
type ProviderSource=EnvelopeProviderManager|{forProvider:(id:string)=>EnvelopeProviderManager};
export type EnvelopeEmailDelivery={inspect:(signal?:AbortSignal)=>Promise<ResendInspection>;send:(value:ResendEmailRequest,key:string,signal?:AbortSignal)=>Promise<ResendSendResult>};
export class LeaseLost extends StateConflict{}
const required=(row:Row|undefined)=>{if(!row)throw new ApiError(404,'NOT_FOUND','Durable work not found.');return row;};
const requestHash=(prompt:string,maxOutputTokens:number)=>createHash('sha256').update(JSON.stringify({prompt,maxOutputTokens})).digest('hex');
async function event(tx:SqlSession,c:Context,kind:string,payload:Row={}){await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),c.run.project_id,c.run.id,kind,c.row.id,JSON.stringify(payload)]);}
async function load(tx:SqlSession,id:string):Promise<Context>{
 const row=required((await tx.query('SELECT * FROM execution_envelopes WHERE id=$1',[id])).rows[0]);
 const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[row.run_id])).rows[0]);
 const work=required((await tx.query('SELECT *,lease_expires_at>clock_timestamp() AS lease_live FROM envelope_work WHERE envelope_id=$1 FOR UPDATE',[id])).rows[0]);
 if(envelopeDigest(row.envelope)!==row.digest)throw new StateConflict('Envelope integrity failed.');
 const body=row.envelope as Envelope;
 const authorizedProviderAttempts=Math.max(1,...body.operations.filter((o):o is Extract<Operation,{kind:'text.generate'}>=>o.kind==='text.generate').map(o=>o.implementationContractVersion==='gemini-free-text-2'?gemini503RetryPolicy.maxProviderAttempts:1));
 if(body.schemaVersion!=='1'||body.costPolicy.maxSpendUsd!==0||body.constraints.spendLimitUsd!==0||body.constraints.externalEffects!==(body.operations.some(o=>o.kind==='email.send')?'approved-email-only':'none')||body.authorization.attemptScope!=='per-operation'||body.authorization.maxAttempts!==authorizedProviderAttempts||body.operations.some(o=>{
  if(o.operationVersion!=='1')return true;
  if(o.kind==='owner.review')return !['owner-review-request-1','owner-review-request-2'].includes(o.implementationContractVersion);
  if(o.kind==='docx.generate')return o.implementationContractVersion!=='python-docx-1'||(o.selectedImplementation as {implementationId?:string}).implementationId!=='python-document'||(o.validatorImplementation as {implementationId?:string}|undefined)?.implementationId!=='python-docx-validator'||(o.storageImplementation as {implementationId?:string}|undefined)?.implementationId!=='artifact-service'||o.output?.format!=='docx'||o.output?.mediaType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||o.consumptionMaxBytes!==8192;
  if(o.kind==='email.send')return o.implementationContractVersion!=='resend-email-1'||(o.selectedImplementation as {implementationId?:string;providerId?:string}).implementationId!=='email-delivery'||(o.selectedImplementation as {providerId?:string}).providerId!=='resend'||o.permission!=='external:email-send'||body.constraints.location!=='remote'||body.constraints.network!=='provider-allowlist-only'||body.constraints.externalEffects!=='approved-email-only'||o.deliveryPolicy!=='verified-zero-only'||o.output?.type!=='external-effect'||o.output?.format!=='email';
  const selected=o.selectedImplementation as {providerId?:string;modelId?:string};
  return !((o.implementationContractVersion==='local-text-1'&&o.providerRetryPolicy===undefined&&selected.providerId==='llamacpp-local'&&selected.modelId==='leeos-local'&&body.constraints.location==='local')||
   (o.implementationContractVersion==='gemini-free-text-1'&&o.providerRetryPolicy===undefined&&selected.providerId==='gemini'&&selected.modelId==='gemini-3.1-flash-lite'&&body.constraints.location==='remote')||
   (o.implementationContractVersion==='gemini-free-text-2'&&sameContent(o.providerRetryPolicy,gemini503RetryPolicy)&&selected.providerId==='gemini'&&selected.modelId==='gemini-3.1-flash-lite'&&body.constraints.location==='remote'));
 }))throw new StateConflict('Unsupported envelope operation contract.');
 if((body.constraints.location==='local'&&body.constraints.network!=='loopback-only')||(body.constraints.location==='remote'&&body.constraints.network!=='provider-allowlist-only'))throw new StateConflict('Unsupported execution location or network contract.');
 return {row,run,work,body:row.envelope as Envelope,ops:(await tx.query('SELECT o.*,p.status AS provider_call_status,p.version AS provider_call_version,p.recovery_required AS provider_call_recovery_required,p.error_code AS provider_call_error_code,u.cost_usd AS provider_cost_usd,u.cost_status AS provider_cost_status,u.cost_evidence_ref AS provider_cost_evidence_ref,u.cost_evidence_checked_at AS provider_cost_checked_at,u.cost_account_scope AS provider_cost_account_scope,e.state AS external_effect_state,e.provider_reference AS external_effect_provider_reference,e.idempotency_expires_at AS external_effect_idempotency_expires_at FROM envelope_operations o LEFT JOIN provider_calls p ON p.id=o.call_id LEFT JOIN model_usage u ON u.id=p.usage_id LEFT JOIN external_effects e ON e.effect_id=o.output_effect_id WHERE o.envelope_id=$1',[id])).rows};
}
async function authority(tx:SqlSession,c:Context){
 if((await tx.query('SELECT 1 FROM execution_envelope_revocations WHERE envelope_id=$1',[c.row.id])).rows.length||c.run.status==='cancelled')return 'cancelled';
 if(!(await tx.query<{live:boolean}>('SELECT $1::timestamptz>clock_timestamp() AS live',[c.row.grant_expires_at])).rows[0].live)return 'expired';
 if(!['queued','running'].includes(String(c.run.status)))return c.run.status==='interrupted'?'recovery-required':'failed';
 return null;
}
async function owns(tx:SqlSession,c:Context,claim:Claim){
 if(await authority(tx,c)||!(await tx.query("SELECT 1 FROM envelope_work WHERE envelope_id=$1 AND state='running' AND worker_id=$2 AND fence=$3 AND lease_expires_at>clock_timestamp()",[claim.envelopeId,claim.workerId,claim.fence])).rows.length)throw new LeaseLost('Worker lease or authorization is no longer valid.');
}
async function change(tx:SqlSession,c:Context,state:string,reason:string,delay=0){
 await tx.query('UPDATE envelope_work SET state=$2,worker_id=NULL,lease_expires_at=NULL,reason=$3,available_at=clock_timestamp()+$4::integer*interval \'1 millisecond\',updated_at=clock_timestamp() WHERE envelope_id=$1',[c.row.id,state,reason,delay]);
 await event(tx,c,'envelope-work.'+state,{reason,fence:String(c.work.fence)});
}
async function finishRun(tx:SqlSession,c:Context,success:boolean){
 if(!['queued','running'].includes(String(c.run.status)))return;
 const status=success?'succeeded':'failed';
 await tx.query('UPDATE runs SET status=$2,version=version+1,finished_at=clock_timestamp() WHERE id=$1',[c.run.id,status]);
 await event(tx,c,'run.'+status,{authority:'durable-envelope-worker'});
}
async function terminate(tx:SqlSession,c:Context,state:string){
 await change(tx,c,state,'AUTHORIZATION_OR_RUN_INACTIVE');
 if(state==='cancelled'&&['queued','running'].includes(String(c.run.status))){await tx.query("UPDATE runs SET status='cancelled',version=version+1,finished_at=clock_timestamp() WHERE id=$1",[c.run.id]);await event(tx,c,'run.cancelled',{authority:'envelope-revocation'});}
 else if(state==='expired'||state==='failed')await finishRun(tx,c,false);
}
function resolve(input:unknown,c:Context):string{
 const v=input as {source:string;text?:string;inputId?:string;operationKey?:string;parts?:unknown[];separator?:string};
 let value:string;
 if(v.source==='literal')value=v.text!;
 else if(v.source==='contract-input')value=c.body.contractInputs[v.inputId!];
 else if(v.source==='operation-output'){
  const op=c.ops.find(o=>o.operation_key===v.operationKey);if(!op||op.state!=='succeeded'||typeof op.output_text!=='string')throw new StateConflict('Dependency output is not available.');value=op.output_text;
 }else if(v.source==='text-parts')value=v.parts!.map(p=>resolve(p,c)).join(v.separator!);
 else throw new StateConflict('Unsupported input contract.');
 if(typeof value!=='string'||!value.length||Buffer.byteLength(value,'utf8')>8192)throw new StateConflict('Resolved input exceeds its exact scope.');
 return value;
}
function resolveDocx(op:Operation,c:Context){
 if(op.kind!=='docx.generate')throw new StateConflict('DOCX operation required.');
 const value={name:op.name,document:{title:resolve(op.document.title,c),sections:op.document.sections.map(section=>({heading:resolve(section.heading,c),paragraphs:section.paragraphs.map(paragraph=>resolve(paragraph,c))}))}};
 const document=docxDocumentSchema.parse(value.document);
 if(Buffer.byteLength(JSON.stringify({name:value.name,document}),'utf8')>8192)throw new StateConflict('Resolved document exceeds its exact scope.');
 return {name:value.name,document};
}
async function resolveEmail(tx:SqlSession,op:Operation,c:Context){
 if(op.kind!=='email.send')throw new StateConflict('Email operation required.');
 const request={to:op.to.trim().toLowerCase(),subject:resolve(op.subject,c),text:resolve(op.text,c),attachments:[] as Array<{artifactId:string;filename:string;sha256:string;mediaType:string;sizeBytes:number}>};
 for(const reference of op.attachments){
  const source=c.body.operations.find(item=>item.key===reference.operationKey),row=c.ops.find(item=>item.operation_key===reference.operationKey);
  if(source?.kind!=='docx.generate'||!row||row.state!=='succeeded'||!row.output_artifact_id||!row.output_sha256)throw new StateConflict('Email attachments must reference an accepted prior artifact.');
  const artifact=(await tx.query<{id:string;project_id:string;run_id:string|null;name:string;media_type:string;sha256:string|null;size_bytes:string|number|null;storage_backend:string;creator:string;source_envelope_id:string|null}>(
   'SELECT id,project_id,run_id,name,media_type,sha256,size_bytes,storage_backend,creator,source_envelope_id FROM artifacts WHERE id=$1',[row.output_artifact_id])).rows[0];
  if(!artifact||artifact.project_id!==c.run.project_id||artifact.run_id!==c.run.id||artifact.storage_backend!=='postgres-bytea'||artifact.creator!=='envelope-worker'||artifact.source_envelope_id!==c.row.id||artifact.sha256!==row.output_sha256||!artifact.size_bytes)throw new StateConflict('Email attachment ownership or integrity does not match this envelope.');
  request.attachments.push({artifactId:artifact.id,filename:artifact.name,sha256:artifact.sha256,mediaType:artifact.media_type,sizeBytes:Number(artifact.size_bytes)});
 }
 if(Buffer.byteLength(JSON.stringify(request),'utf8')>c.body.constraints.maxInputBytes||request.attachments.reduce((n,item)=>n+item.sizeBytes,0)>10*1024*1024)throw new StateConflict('Resolved email request exceeds its authorized byte scope.');
 return request;
}
function reviewMaterial(c:Context,op:Operation){
 if(op.kind!=='owner.review')throw new StateConflict('Human review required.');
 const inputs=op.inputs.map(input=>resolve(input,c));
 const artifactReferences=op.artifacts??[];
 const artifacts=artifactReferences.map(reference=>{
  const document=c.body.operations.find(candidate=>candidate.key===reference.operationKey),result=c.ops.find(candidate=>candidate.operation_key===reference.operationKey);
  const validation=result?.output_validation as {sha256?:unknown;bytes?:unknown}|null|undefined;
  const artifactId=result?.output_artifact_id,sha256=result?.output_sha256,sizeBytes=Number(validation?.bytes);
  if(document?.kind!=='docx.generate'||result?.state!=='succeeded'||typeof artifactId!=='string'||typeof sha256!=='string'||validation?.sha256!==sha256||!Number.isSafeInteger(sizeBytes)||sizeBytes<1){
   throw new StateConflict('The owner review requires a successfully validated and retrieved DOCX artifact.');
  }
  return {artifactId,name:document.name,mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sha256,sizeBytes,
   downloadPath:`/artifacts/${artifactId}/content`};
 });
 const digestInput=op.implementationContractVersion==='owner-review-request-2'?{envelopeId:c.row.id,operationKey:op.key,inputs,artifacts}:{envelopeId:c.row.id,operationKey:op.key,inputs};
 return {operationKey:op.key,inputs,artifacts,digest:envelopeDigest(digestInput)};
}
type MailEvent={providerEventId:string;kind:'accepted'|'delivered'|'failed'|'ignored';emailId:string|null;effectId:string|null;recipient:string|null;eventType:string};
function recipientHash(address:string){return createHash('sha256').update(address.trim().toLowerCase()).digest('hex');}
async function addEffectReceipt(tx:SqlSession,effect:Row,input:{key:string;kind:'attempted'|'accepted'|'delivered'|'failed'|'unknown';providerEventId?:string|null;providerReference?:string|null;envelopeId?:string|null;fence?:string|null;details?:Row}){
 await tx.query('INSERT INTO external_effect_receipts(receipt_id,effect_id,receipt_key,kind,provider_event_id,provider_reference,source_envelope_id,source_fence,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(effect_id,receipt_key) DO NOTHING',
  [createId('effectReceipt'),effect.effect_id,input.key,input.kind,input.providerEventId??null,input.providerReference??null,input.envelopeId??null,input.fence??null,JSON.stringify(input.details??{})]);
}
async function deliveryEvidence(tx:SqlSession,c:Context,effect:Row,outcome:'met'|'not-met',receiptIdentity:string,authority:'resend-webhook'|'envelope-worker'='resend-webhook',sourceFence?:string,reason?:string){
 const operation=c.body.operations.find(item=>item.key===effect.operation_key);if(!operation||operation.kind!=='email.send')throw new StateConflict('Delivery evidence is outside the accepted email operation.');
 for(const binding of c.body.acceptanceBindings.filter(item=>item.operationKey===operation.key)){
  const criterion=c.body.contract.content.acceptanceCriteria.find(item=>item.id===binding.criterionId);
  if(!criterion||criterion.evidenceKind!=='delivery-confirmation')continue;
  const key=`email-effect:${effect.effect_id}:${criterion.id}`;
  if((await tx.query('SELECT id FROM acceptance_evidence WHERE run_id=$1 AND request_key=$2',[c.run.id,key])).rows.length)continue;
  const version=Number((await tx.query('SELECT COALESCE(max(version),0)+1 AS version FROM acceptance_evidence WHERE run_id=$1 AND criterion_id=$2',[c.run.id,criterion.id])).rows[0].version),id=createId('evidence');
  const details={provider:'resend',effectId:effect.effect_id,providerReference:effect.provider_reference,receiptIdentity,recipientHash:effect.recipient_hash,confirmation:outcome==='met'?'recipient-server-delivery':undefined,reason};
  await tx.query('INSERT INTO acceptance_evidence(id,run_id,requirements_id,revision,criterion_id,version,request_key,request,kind,outcome,details,authority,source_envelope_id,source_operation_key,source_fence,source_effect_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'delivery-confirmation\',$9,$10,$11,$12,$13,$14,$15)',
   [id,c.run.id,c.body.contract.id,c.body.contract.revision,criterion.id,version,key,JSON.stringify({effectId:effect.effect_id,receiptIdentity,outcome}),outcome,JSON.stringify(details),authority,c.row.id,operation.key,sourceFence??null,effect.effect_id]);
  await event(tx,c,'acceptance.evidence-recorded',{evidenceId:id,criterionId:criterion.id,kind:'delivery-confirmation',outcome,version,effectId:effect.effect_id});
 }
}
async function settleMailEvent(tx:SqlSession,c:Context,effect:Row,event:MailEvent):Promise<'applied'|'duplicate'>{
 if(event.kind==='ignored')return 'applied';
 const matched=event.effectId===String(effect.effect_id)||(!event.effectId&&event.emailId!==null&&event.emailId===effect.provider_reference);
 if(!matched||!event.emailId||!event.recipient||recipientHash(event.recipient)!==effect.recipient_hash)throw new StateConflict('Signed provider event does not match the exact authorized email recipient.');
 if(effect.provider_reference&&effect.provider_reference!==event.emailId)throw new StateConflict('Provider email identity changed for this effect.');
 const inserted=await tx.query('INSERT INTO external_effect_webhook_receipts(provider_event_id,effect_id,event_type,recipient_hash,provider_reference) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_event_id) DO NOTHING RETURNING provider_event_id',
  [event.providerEventId,effect.effect_id,event.eventType,effect.recipient_hash,event.emailId]);
 if(!inserted.rows.length)return 'duplicate';
 const kind=event.kind==='accepted'?'accepted':event.kind;
 await addEffectReceipt(tx,effect,{key:`webhook:${event.providerEventId}`,kind,providerEventId:event.providerEventId,providerReference:event.emailId,details:{eventType:event.eventType,recipientHash:effect.recipient_hash}});
 let next=String(effect.state);
 if(event.kind==='accepted'&&['attempted','unknown'].includes(next))next='accepted';
 if(event.kind==='delivered'&&next!=='failed')next='delivered';
 if(event.kind==='failed'&&next!=='delivered')next='failed';
 if(next!==effect.state||effect.provider_reference===null)await tx.query('UPDATE external_effects SET state=$2,provider_reference=COALESCE(provider_reference,$3),updated_at=clock_timestamp() WHERE effect_id=$1',[effect.effect_id,next,event.emailId]);
 await eventRecord(tx,c,event.kind==='accepted'?'external-effect.accepted':event.kind==='delivered'?'external-effect.delivered':'external-effect.failed',
  {effectId:effect.effect_id,operationKey:effect.operation_key,provider:'resend',providerEventId:event.providerEventId,confirmation:event.kind==='delivered'?'recipient-server-delivery':undefined});
 if(next==='delivered'||next==='failed'){
  const outcome=next==='delivered'?'met':'not-met',state=next==='delivered'?'succeeded':'failed';
  await tx.query('UPDATE envelope_operations SET state=$3,error_code=$4,result_fence=$5,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2 AND output_effect_id=$6 AND state IN (\'dispatched\',\'reserved\')',
   [c.row.id,effect.operation_key,state,next==='failed'?'EMAIL_DELIVERY_FAILED':null,effect.source_fence,effect.effect_id]);
  await deliveryEvidence(tx,c,{...effect,provider_reference:event.emailId},outcome,event.providerEventId);
  if(!['cancelled','expired','failed','succeeded'].includes(String(c.work.state))&&!(await authority(tx,c))){
   if(next==='failed'){
    await tx.query("UPDATE envelope_work SET state='failed',worker_id=NULL,lease_expires_at=NULL,reason='EMAIL_DELIVERY_FAILED',updated_at=clock_timestamp() WHERE envelope_id=$1",[c.row.id]);
    await finishRun(tx,c,false);
   }else{
    const remaining=Number((await tx.query("SELECT count(*) AS count FROM envelope_operations WHERE envelope_id=$1 AND state<>'succeeded'",[c.row.id])).rows[0].count);
    if(remaining===0){await tx.query("UPDATE envelope_work SET state='succeeded',worker_id=NULL,lease_expires_at=NULL,reason='ALL_OPERATIONS_SUCCEEDED',updated_at=clock_timestamp() WHERE envelope_id=$1",[c.row.id]);await finishRun(tx,c,true);}
    else await tx.query("UPDATE envelope_work SET state='queued',worker_id=NULL,lease_expires_at=NULL,available_at=clock_timestamp(),reason='EXTERNAL_EFFECT_CONFIRMED',updated_at=clock_timestamp() WHERE envelope_id=$1",[c.row.id]);
   }
  }
 }
 return 'applied';
}
async function eventRecord(tx:SqlSession,c:Context,kind:string,payload:Row){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),c.run.project_id,c.run.id,kind,c.row.id,JSON.stringify(payload)]);
}
async function evidence(tx:SqlSession,c:Context,op:Operation,outcome:string,note?:string){
 for(const binding of c.body.acceptanceBindings.filter(b=>b.operationKey===op.key)){
  const criterion=c.body.contract.content.acceptanceCriteria.find(a=>a.id===binding.criterionId)!;
  if(criterion.evidenceKind!=='job-result'&&!(criterion.evidenceKind==='owner-review'&&note!==undefined))continue;
  const key='envelope-result:'+c.row.id+':'+op.key+':'+criterion.id;
  if((await tx.query('SELECT id FROM acceptance_evidence WHERE run_id=$1 AND request_key=$2',[c.run.id,key])).rows.length)continue;
  const version=Number((await tx.query('SELECT COALESCE(max(version),0)+1 AS version FROM acceptance_evidence WHERE run_id=$1 AND criterion_id=$2',[c.run.id,criterion.id])).rows[0].version);
  const details=note!==undefined&&criterion.evidenceKind==='owner-review'?{note,verification:'owner-attestation'}:{verification:'durable-envelope-result',envelopeId:c.row.id,operationKey:op.key,fence:String(c.work.fence)};
  const id=createId('evidence');
  await tx.query('INSERT INTO acceptance_evidence(id,run_id,requirements_id,revision,criterion_id,version,request_key,request,kind,outcome,details,authority,source_envelope_id,source_operation_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
   [id,c.run.id,c.body.contract.id,c.body.contract.revision,criterion.id,version,key,JSON.stringify({envelopeId:c.row.id,operationKey:op.key,outcome}),criterion.evidenceKind,outcome,JSON.stringify(details),note!==undefined?'local-owner':'envelope-worker',criterion.evidenceKind==='job-result'?c.row.id:null,criterion.evidenceKind==='job-result'?op.key:null]);
  await event(tx,c,'acceptance.evidence-recorded',{evidenceId:id,criterionId:criterion.id,kind:criterion.evidenceKind,outcome,version});
 }
}
export function createEnvelopeWorkerStore(db:StateDatabase,options:{leaseMs?:number;backoffMs?:number;artifactStorageEnabled?:()=>boolean;emailDelivery?:EnvelopeEmailDelivery;emailIdempotencyWindowMs?:number}={}){
 const leaseMs=options.leaseMs??15000,backoffMs=options.backoffMs??5000;
 const maxProviderAttempts=(op:Operation)=>op.kind==='text.generate'&&op.implementationContractVersion==='gemini-free-text-2'?gemini503RetryPolicy.maxProviderAttempts:1;
 const emailIdempotencyWindowMs=options.emailIdempotencyWindowMs??86400000;
 const artifactStorageEnabled=options.artifactStorageEnabled??(()=>process.env.LEEOS_ARTIFACT_STORAGE_ENABLED==='1');
 const documentManager=createDocumentManager(db,{enabled:artifactStorageEnabled});
 const artifactStorage=createArtifactStorage(db,{enabled:artifactStorageEnabled});
 const emailDelivery=options.emailDelivery??createResendEmailAdapter();
 if(!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>60000||!Number.isInteger(backoffMs)||backoffMs<0||backoffMs>60000||!Number.isInteger(emailIdempotencyWindowMs)||emailIdempotencyWindowMs<1||emailIdempotencyWindowMs>86400000)throw Error('Invalid worker timing or provider idempotency window.');
 async function releaseClaim(value:Claim,reason='RESOURCE_UNAVAILABLE',delay=backoffMs){const claim=parse(claimSchema,value);return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);await change(tx,c,'queued',reason,delay);});}
 async function settle(tx:SqlSession,c:Context,claim:Claim,op:Operation,row:Row):Promise<'continue'|'stopped'>{
  await owns(tx,c,claim);
  const call=required((await tx.query('SELECT * FROM provider_calls WHERE id=$1',[row.call_id])).rows[0]);
  const input=row.resolved_request as {prompt:string;maxOutputTokens:number};
  const attempt=required((await tx.query('SELECT attempt_number FROM envelope_operation_attempts WHERE envelope_id=$1 AND operation_key=$2 AND call_id=$3',[c.row.id,op.key,call.id])).rows[0]);
  const attemptNumber=Number(attempt.attempt_number),baseKey=String(c.row.id)+':'+op.key,expectedRequestKey=attemptNumber===1?baseKey:`${baseKey}:attempt:${attemptNumber}`;
  if(attemptNumber<1||attemptNumber>maxProviderAttempts(op)||call.request_key!==expectedRequestKey||call.request_hash!==requestHash(input.prompt,input.maxOutputTokens))throw new StateConflict('Saved call identity differs.');
  if(call.status==='succeeded'){
   if(row.state!=='dispatched')throw new StateConflict('Unproven result cannot be accepted.');
   if(typeof call.output_text!=='string'||Buffer.byteLength(call.output_text,'utf8')>65536){
    await tx.query("UPDATE envelope_operations SET state='failed',error_code='RESULT_SCOPE_INVALID',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence]);
    await evidence(tx,c,op,'not-met');await change(tx,c,'failed','RESULT_SCOPE_INVALID');await finishRun(tx,c,false);return 'stopped';
   }
   await tx.query("UPDATE envelope_operations SET state='succeeded',output_text=$3,result_fence=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,call.output_text,claim.fence]);
   await evidence(tx,c,op,'met');await event(tx,c,'envelope-operation.succeeded',{operationKey:op.key,callId:call.id,fence:claim.fence});return 'continue';
  }
  if(call.status==='failed'){
   if(op.kind==='text.generate'&&op.implementationContractVersion==='gemini-free-text-2'&&sameContent(op.providerRetryPolicy,gemini503RetryPolicy)&&call.retryable===true&&gemini503RetryPolicy.retryableReason===call.error_code&&!call.recovery_required&&row.state==='dispatched'){
    if(attemptNumber<maxProviderAttempts(op)){
     const delay=Math.min(gemini503RetryPolicy.backoff.baseDelayMs*2**(attemptNumber-1),gemini503RetryPolicy.backoff.maxDelayMs);
     await tx.query("UPDATE envelope_operations SET state='pending',call_id=NULL,error_code=NULL,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key]);
     await event(tx,c,'envelope-operation.transient-retry-scheduled',{operationKey:op.key,callId:call.id,attemptNumber,nextAttemptNumber:attemptNumber+1,maxAttempts:maxProviderAttempts(op),retryPolicy:op.providerRetryPolicy,errorCode:call.error_code,delayMs:delay});
     await change(tx,c,'queued','GEMINI_HTTP_503_RETRY_SCHEDULED',delay);return 'stopped';
    }
   }
   if(row.state==='reserved'&&['LOCAL_BACKEND_BUSY','LOCAL_MODEL_CHANGED','GEMINI_RATE_LIMITED'].includes(String(call.error_code))){await change(tx,c,'queued','PROVEN_PREFLIGHT_BACKPRESSURE',backoffMs);return 'stopped';}
   await tx.query("UPDATE envelope_operations SET state='failed',error_code=$3,result_fence=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,call.error_code,claim.fence]);
   await evidence(tx,c,op,'not-met');await change(tx,c,'failed','PROVIDER_PREFLIGHT_FAILED');await finishRun(tx,c,false);return 'stopped';
  }
  if(call.status==='interrupted'&&!call.recovery_required){
   await tx.query("UPDATE envelope_operations SET state='uncertain',error_code='UNCERTAIN_CALL_NO_RETRY',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence]);
   await change(tx,c,'failed','UNCERTAIN_CALL_NO_RETRY');await finishRun(tx,c,false);return 'stopped';
  }
  await change(tx,c,'recovery-required','CALL_RESULT_UNCERTAIN');return 'stopped';
 }
 async function get(id:string){parse(envelopeId,id);return db.transaction(async tx=>{
  const c=await load(tx,id);
  const authorizationBlocked=await authority(tx,c);
  const pending=c.body.operations.find(op=>!c.ops.some(r=>r.operation_key===op.key&&r.state==='succeeded'));
  return {envelopeId:id,runId:String(c.run.id),state:String(c.work.state),fence:String(c.work.fence),workerId:c.work.worker_id,leaseExpiresAt:c.work.lease_expires_at?new Date(c.work.lease_expires_at as string|Date).toISOString():null,
   reason:c.work.reason,authorizationBlocked,availableAt:new Date(c.work.available_at as string|Date).toISOString(),apiDispatchEnabled:false,
   operations:c.body.operations.map(op=>{const r=c.ops.find(row=>row.operation_key===op.key),selected=op.kind==='text.generate'?op.selectedImplementation as {providerId?:string}:undefined;return {operationKey:op.key,kind:op.kind,state:r?.state??'pending',callId:r?.call_id??null,providerId:selected?.providerId??null,outputText:r?.output_text??null,artifactId:r?.output_artifact_id??null,sha256:r?.output_sha256??null,validation:r?.output_validation??null,externalEffectId:r?.output_effect_id??null,externalEffectState:r?.external_effect_state??null,externalEffectProviderReference:r?.external_effect_provider_reference??null,externalEffectIdempotencyExpiresAt:r?.external_effect_idempotency_expires_at?new Date(r.external_effect_idempotency_expires_at as string|Date).toISOString():null,errorCode:r?.error_code??null,providerCallStatus:r?.provider_call_status??null,providerCallVersion:r?.provider_call_version==null?null:Number(r.provider_call_version),providerRecoveryRequired:r?.provider_call_recovery_required===true,providerErrorCode:r?.provider_call_error_code??null,costUsd:r?.provider_cost_usd==null?null:String(r.provider_cost_usd),costStatus:r?.provider_cost_status??null,costEvidenceRef:r?.provider_cost_evidence_ref??null,costEvidenceCheckedAt:r?.provider_cost_checked_at?new Date(r.provider_cost_checked_at as string|Date).toISOString():null,costAccountScope:r?.provider_cost_account_scope??null,dispatchFence:r?.dispatch_fence?String(r.dispatch_fence):null,resultFence:r?.result_fence?String(r.result_fence):null};}),
   review:!authorizationBlocked&&c.work.state==='waiting-human'&&pending?.kind==='owner.review'?reviewMaterial(c,pending):null};
 });}
 return {leaseMs,get,
  async forRun(id:string){parse(runId,id);const row=required((await db.query('SELECT id FROM execution_envelopes WHERE run_id=$1',[id])).rows[0]);return get(String(row.id));},
  async reap(){return db.transaction(async tx=>{
   const rows=(await tx.query("SELECT w.envelope_id FROM envelope_work w JOIN runs r ON r.id=w.run_id JOIN execution_envelopes e ON e.id=w.envelope_id WHERE w.state IN ('queued','running','recovery-required','waiting-human','waiting-external') AND (w.state='recovery-required' OR (w.state='queued' AND w.available_at<=clock_timestamp()) OR (w.state='running' AND w.lease_expires_at<=clock_timestamp()) OR e.grant_expires_at<=clock_timestamp() OR r.status NOT IN ('queued','running') OR EXISTS(SELECT 1 FROM execution_envelope_revocations v WHERE v.envelope_id=w.envelope_id)) ORDER BY w.updated_at,w.envelope_id LIMIT 50 FOR UPDATE OF r,w SKIP LOCKED")).rows;
   for(const row of rows){
    const c=await load(tx,String(row.envelope_id)),denied=await authority(tx,c);
    await tx.query('UPDATE envelope_work SET updated_at=clock_timestamp() WHERE envelope_id=$1',[c.row.id]);
    if(denied){
     if(c.work.state!==denied)await terminate(tx,c,denied);continue;
    }
    if(c.work.state==='waiting-human'||c.work.state==='waiting-external'||(c.work.state==='running'&&c.work.lease_live))continue;
    const calls=(await tx.query("SELECT o.*,p.status AS call_status,p.recovery_required FROM envelope_operations o JOIN provider_calls p ON p.id=o.call_id WHERE o.envelope_id=$1 AND o.state IN ('reserved','dispatched')",[c.row.id])).rows;
    const uncertain=calls.some(r=>r.call_status==='running'||(r.call_status==='interrupted'&&r.recovery_required));
    if(uncertain){if(c.work.state!=='recovery-required')await change(tx,c,'recovery-required','ABANDONED_CALL_REQUIRES_RECONCILIATION');}
    else if(c.work.state==='running'||c.work.state==='recovery-required')await change(tx,c,'queued',calls.length?'SAVED_RESULT_AVAILABLE':'LEASE_EXPIRED_BEFORE_DISPATCH');
   }
  });},
  async claim(value:string,target?:string):Promise<Claim|null>{const owner=parse(workerId,value);if(target)parse(envelopeId,target);return db.transaction(async tx=>{
   const selected=(await tx.query("SELECT w.envelope_id FROM envelope_work w JOIN runs r ON r.id=w.run_id WHERE w.state='queued' AND w.available_at<=clock_timestamp() AND r.status IN ('queued','running') AND ($1::text IS NULL OR w.envelope_id=$1) ORDER BY w.available_at,w.envelope_id LIMIT 1 FOR UPDATE OF r,w SKIP LOCKED",[target??null])).rows[0];
   if(!selected)return null;const c=await load(tx,String(selected.envelope_id));
   const denied=await authority(tx,c);if(denied){await terminate(tx,c,denied);return null;}
   const row=(await tx.query("UPDATE envelope_work SET state='running',fence=fence+1,worker_id=$2,lease_expires_at=clock_timestamp()+$3::integer*interval '1 millisecond',updated_at=clock_timestamp(),reason=NULL WHERE envelope_id=$1 RETURNING fence",[c.row.id,owner,leaseMs])).rows[0];
   const fence=String(row.fence);await tx.query('INSERT INTO envelope_claims(envelope_id,fence,worker_id) VALUES($1,$2,$3)',[c.row.id,fence,owner]);
   for(const op of c.body.operations)await tx.query('INSERT INTO envelope_operations(envelope_id,run_id,operation_key,kind) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[c.row.id,c.run.id,op.key,op.kind]);
   if(c.run.status==='queued'){await tx.query("UPDATE runs SET status='running',version=version+1,started_at=COALESCE(started_at,clock_timestamp()) WHERE id=$1",[c.run.id]);await event(tx,c,'run.running',{authority:'durable-envelope-worker'});}
   await event(tx,c,'envelope-work.claimed',{workerId:owner,fence});return {envelopeId:String(c.row.id),workerId:owner,fence};
  });},
  async heartbeat(value:Claim){const claim=parse(claimSchema,value);return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);await tx.query("UPDATE envelope_work SET lease_expires_at=clock_timestamp()+$2::integer*interval '1 millisecond',updated_at=clock_timestamp() WHERE envelope_id=$1",[claim.envelopeId,leaseMs]);});},
  async release(value:Claim,reason='RESOURCE_UNAVAILABLE',delay=backoffMs){return releaseClaim(value,reason,delay);},
  async step(value:Claim,providers:ProviderSource,signal?:AbortSignal):Promise<string>{
   const claim=parse(claimSchema,value);
   const action=await db.transaction(async tx=>{
    const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);
    const op=c.body.operations.find(op=>!c.ops.some(row=>row.operation_key===op.key&&row.state==='succeeded'));
    if(!op){await change(tx,c,'succeeded','ALL_OPERATIONS_SUCCEEDED');await finishRun(tx,c,true);return {state:'stopped' as const};}
    const row=required(c.ops.find(r=>r.operation_key===op.key));
    if(row.call_id){
     const call=(await tx.query('SELECT status,error_code FROM provider_calls WHERE id=$1',[row.call_id])).rows[0];
     if(!(op.kind==='text.generate'&&row.state==='reserved'&&call?.status==='failed'&&['LOCAL_BACKEND_BUSY','LOCAL_MODEL_CHANGED','GEMINI_RATE_LIMITED'].includes(String(call.error_code))))return {state:await settle(tx,c,claim,op,row)};
    }
    if(op.dependsOn.some(key=>!c.ops.some(r=>r.operation_key===key&&r.state==='succeeded')))throw new StateConflict('Dependency result unavailable.');
    try{
     if(op.kind==='owner.review'){reviewMaterial(c,op);await change(tx,c,'waiting-human','EXPLICIT_OWNER_REVIEW_REQUIRED');return {state:'stopped' as const};}
     if(op.kind==='docx.generate'){
      const request=resolveDocx(op,c);
      if(row.state==='reserved'&&row.resolved_request&&!sameContent(row.resolved_request,request))throw new StateConflict('Reserved DOCX input changed.');
      await tx.query("UPDATE envelope_operations SET state='reserved',dispatch_fence=$3,resolved_request=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence,JSON.stringify(request)]);
      await event(tx,c,'envelope-operation.docx-reserved',{operationKey:op.key,fence:claim.fence});
      return {state:'docx' as const,op,request};
     }
     if(op.kind==='email.send'){
      const request=await resolveEmail(tx,op,c);
      if(row.resolved_request&&!sameContent(row.resolved_request,request))throw new StateConflict('Reserved email request or attachment scope changed.');
      const prior=(await tx.query('SELECT * FROM external_effects WHERE envelope_id=$1 AND operation_key=$2',[c.row.id,op.key])).rows[0];
      if(prior){
       if(prior.request_digest!==envelopeDigest(request)||!sameContent(prior.request,request)||row.output_effect_id!==prior.effect_id)throw new StateConflict('Saved external effect differs from the authorized request.');
       if(prior.state==='accepted'||prior.state==='unknown'){await change(tx,c,'waiting-external',prior.state==='accepted'?'EMAIL_AWAITING_SIGNED_DELIVERY':'EMAIL_OUTCOME_UNKNOWN_NO_AUTOMATIC_RETRY');return {state:'stopped' as const};}
       if(prior.state==='failed'){
        if(row.state!=='failed'){await tx.query("UPDATE envelope_operations SET state='failed',error_code='EMAIL_PROVIDER_REJECTED',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence]);await change(tx,c,'failed','EMAIL_PROVIDER_REJECTED');await finishRun(tx,c,false);}
        return {state:'stopped' as const};
       }
       if(prior.state==='delivered')throw new StateConflict('Delivered external effect lacks its terminal operation result.');
       const live=(await tx.query<{live:boolean}>('SELECT idempotency_expires_at>clock_timestamp() AS live FROM external_effects WHERE effect_id=$1',[prior.effect_id])).rows[0].live;
       if(!live){await tx.query("UPDATE external_effects SET state='unknown',updated_at=clock_timestamp() WHERE effect_id=$1",[prior.effect_id]);await addEffectReceipt(tx,prior,{key:`unknown:${claim.fence}`,kind:'unknown',envelopeId:String(c.row.id),fence:claim.fence,details:{reason:'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'}});await event(tx,c,'external-effect.unknown',{effectId:prior.effect_id,operationKey:op.key,reason:'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'});await change(tx,c,'waiting-external','EMAIL_OUTCOME_UNKNOWN_NO_AUTOMATIC_RETRY');return {state:'stopped' as const};}
      }
      return {state:'email' as const,op,request};
     }
    const prompt=resolve(op.input,c);
    const attemptRow=row.call_id
     ?(await tx.query('SELECT attempt_number FROM envelope_operation_attempts WHERE envelope_id=$1 AND operation_key=$2 AND call_id=$3',[c.row.id,op.key,row.call_id])).rows[0]
     :(await tx.query('SELECT COALESCE(max(attempt_number),0)+1 AS attempt_number FROM envelope_operation_attempts WHERE envelope_id=$1 AND operation_key=$2',[c.row.id,op.key])).rows[0];
    const attemptNumber=Number(attemptRow?.attempt_number);
    if(!Number.isInteger(attemptNumber)||attemptNumber<1||attemptNumber>maxProviderAttempts(op)){
     await tx.query("UPDATE envelope_operations SET state='failed',error_code='PROVIDER_ATTEMPT_LIMIT_REACHED',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence]);
     await evidence(tx,c,op,'not-met');await change(tx,c,'failed','PROVIDER_ATTEMPT_LIMIT_REACHED');await finishRun(tx,c,false);return {state:'stopped' as const};
    }
    return {state:'generate' as const,prompt,op,attemptNumber};
    }catch(error){
     if(!(error instanceof StateConflict))throw error;
     await tx.query("UPDATE envelope_operations SET state='failed',error_code='RESOLVED_INPUT_INVALID',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[c.row.id,op.key,claim.fence]);
     await change(tx,c,'failed','RESOLVED_INPUT_INVALID');await finishRun(tx,c,false);return {state:'stopped' as const};
    }
   });
   if(action.state==='docx'){
    if(!artifactStorageEnabled()){await releaseClaim(claim,'ARTIFACT_STORAGE_DISABLED',backoffMs);return 'stopped';}
    let stored;
    try{stored=await documentManager.generateAndStore({runId:String((await db.query('SELECT run_id FROM envelope_work WHERE envelope_id=$1',[claim.envelopeId])).rows[0].run_id),projectId:String((await db.query('SELECT project_id FROM execution_envelopes WHERE id=$1',[claim.envelopeId])).rows[0].project_id),envelopeId:claim.envelopeId,operationKey:action.op.key,name:action.request.name,document:action.request.document,claim,signal});}
    catch(error){
     if(error instanceof LeaseLost)throw error;
     const transient=error instanceof PythonDocxError&&['PYTHON_DOCX_UNAVAILABLE','DOCX_PROCESS_TIMEOUT','DOCX_PROCESS_ABORTED'].includes(error.code)||error instanceof ArtifactStorageError&&error.code==='ARTIFACT_STORAGE_DISABLED';
     if(transient){try{await releaseClaim(claim,error instanceof PythonDocxError?error.code:'ARTIFACT_STORAGE_DISABLED',backoffMs);}catch{/* Lease or authorization already changed. */}return 'stopped';}
     if(error instanceof PythonDocxError||error instanceof DocumentExecutionError||error instanceof ArtifactStorageError){
      return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);await tx.query("UPDATE envelope_operations SET state='failed',error_code=$3,result_fence=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,error instanceof PythonDocxError?error.code:error instanceof DocumentExecutionError?error.code:error.code,claim.fence]);await change(tx,c,'failed','DOCX_GENERATION_OR_VALIDATION_FAILED');await finishRun(tx,c,false);return 'stopped';});
     }
     try{await releaseClaim(claim,'DOCX_WORKER_UNAVAILABLE',backoffMs);}catch{/* Lease or authorization already changed. */}return 'stopped';
    }
    return db.transaction(async tx=>{
     const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const current=required(c.ops.find(r=>r.operation_key===action.op.key));
     if(current.state!=='reserved'||String(current.dispatch_fence)!==claim.fence||!sameContent(current.resolved_request,action.request))throw new LeaseLost('Reserved DOCX request or current fence changed.');
     await tx.query("UPDATE envelope_operations SET state='succeeded',output_artifact_id=$3,output_sha256=$4,output_validation=$5,result_fence=$6,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,stored.artifact.id,stored.validation.sha256,JSON.stringify(stored.validation),claim.fence]);
     await evidence(tx,c,action.op,'met');
     for(const binding of c.body.acceptanceBindings.filter(b=>b.operationKey===action.op.key)){
      const criterion=c.body.contract.content.acceptanceCriteria.find(item=>item.id===binding.criterionId);if(!criterion||!['document-validation','artifact-registration'].includes(criterion.evidenceKind))continue;
      const kind=criterion.evidenceKind,key='envelope-docx:'+claim.envelopeId+':'+action.op.key+':'+criterion.id;
      if((await tx.query('SELECT id FROM acceptance_evidence WHERE run_id=$1 AND request_key=$2',[c.run.id,key])).rows.length)continue;
      const version=Number((await tx.query('SELECT COALESCE(max(version),0)+1 AS version FROM acceptance_evidence WHERE run_id=$1 AND criterion_id=$2',[c.run.id,criterion.id])).rows[0].version),id=createId('evidence');
      const details=kind==='document-validation'?{format:'docx',fontFamily:'Times New Roman',bodyFontSizePt:12,readable:true,contentMatches:true,sha256:stored.validation.sha256,validator:stored.validation.validator,paragraphCount:stored.validation.paragraphCount,bytes:stored.validation.bytes,artifactId:stored.artifact.id}:{artifactId:stored.artifact.id,sha256:stored.artifact.sha256,sizeBytes:stored.artifact.sizeBytes,mediaType:stored.artifact.mediaType,storageBackend:stored.artifact.storageBackend,retrievalVerified:true};
      await tx.query('INSERT INTO acceptance_evidence(id,run_id,requirements_id,revision,criterion_id,version,request_key,request,kind,outcome,details,authority,source_envelope_id,source_operation_key,source_artifact_id,source_fence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,\'met\',$10,\'envelope-worker\',$11,$12,$13,$14)',[id,c.run.id,c.body.contract.id,c.body.contract.revision,criterion.id,version,key,JSON.stringify({envelopeId:claim.envelopeId,operationKey:action.op.key,artifactId:stored.artifact.id,sha256:stored.artifact.sha256}),kind,JSON.stringify(details),claim.envelopeId,action.op.key,stored.artifact.id,claim.fence]);
      await event(tx,c,'acceptance.evidence-recorded',{evidenceId:id,criterionId:criterion.id,kind,outcome:'met',version,artifactId:stored.artifact.id});
     }
     await event(tx,c,'envelope-operation.docx-succeeded',{operationKey:action.op.key,artifactId:stored.artifact.id,sha256:stored.artifact.sha256,created:stored.created,fence:claim.fence});return 'continue';
    });
   }
   if(action.state==='email'){
    let inspection:ResendInspection;
    try{inspection=await emailDelivery.inspect(signal);}catch{await releaseClaim(claim,'EMAIL_PROVIDER_INSPECTION_UNAVAILABLE',backoffMs);return 'stopped';}
    if(!inspection.eligible||inspection.costStatus!=='owner-attested-zero'||!inspection.costEvidenceRef||!inspection.validUntil||Date.parse(inspection.validUntil)<=Date.now()){
     await releaseClaim(claim,inspection.reason||'EMAIL_ZERO_COST_ROUTE_UNAVAILABLE',backoffMs);return 'stopped';
    }
    if(action.request.attachments.length&&!artifactStorageEnabled()){await releaseClaim(claim,'ARTIFACT_STORAGE_DISABLED',backoffMs);return 'stopped';}
    const attachments:ResendAttachment[]=[];
    try{
     for(const reference of action.request.attachments){
      const stored=await artifactStorage.getContent(reference.artifactId);
      if(stored.artifact.runId!==String((await db.query('SELECT run_id FROM envelope_work WHERE envelope_id=$1',[claim.envelopeId])).rows[0].run_id)||stored.artifact.name!==reference.filename||stored.artifact.sha256!==reference.sha256||stored.artifact.mediaType!==reference.mediaType||createHash('sha256').update(stored.bytes).digest('hex')!==reference.sha256)throw new ArtifactStorageError('ARTIFACT_INTEGRITY_FAILURE');
      attachments.push({filename:reference.filename,contentType:reference.mediaType,content:stored.bytes});
     }
    }catch(error){
     if(error instanceof ArtifactStorageError&&error.code==='ARTIFACT_STORAGE_DISABLED'){await releaseClaim(claim,'ARTIFACT_STORAGE_DISABLED',backoffMs);return 'stopped';}
     return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);await tx.query("UPDATE envelope_operations SET state='failed',error_code='EMAIL_ATTACHMENT_INTEGRITY_FAILURE',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,claim.fence]);await change(tx,c,'failed','EMAIL_ATTACHMENT_INTEGRITY_FAILURE');await finishRun(tx,c,false);return 'stopped';});
    }
    const effectId=`eff_${randomUUID()}`,idempotencyKey=`leeos:${claim.envelopeId}:${action.op.key}`,requestDigest=envelopeDigest(action.request);
    const shouldSend=await db.transaction(async tx=>{
     const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const current=required(c.ops.find(r=>r.operation_key===action.op.key));
     const prior=(await tx.query('SELECT * FROM external_effects WHERE envelope_id=$1 AND operation_key=$2',[claim.envelopeId,action.op.key])).rows[0];
     if(prior&&prior.request_digest!==requestDigest)throw new StateConflict('External effect request changed after authorization.');
     if(!prior){
      const effect=(await tx.query('INSERT INTO external_effects(effect_id,envelope_id,run_id,operation_key,provider_id,idempotency_key,request_digest,request,recipient_hash,source_fence,state,idempotency_expires_at) VALUES($1,$2,$3,$4,\'resend\',$5,$6,$7,$8,$9,\'attempted\',clock_timestamp()+$10::integer*interval \'1 millisecond\') RETURNING *',
       [effectId,claim.envelopeId,c.run.id,action.op.key,idempotencyKey,requestDigest,JSON.stringify(action.request),recipientHash(action.request.to),claim.fence,emailIdempotencyWindowMs])).rows[0];
      await tx.query("UPDATE envelope_operations SET state='dispatched',dispatch_fence=$3,resolved_request=$4,output_effect_id=$5,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,claim.fence,JSON.stringify(action.request),effect.effect_id]);
      await addEffectReceipt(tx,effect,{key:`attempt:${claim.fence}`,kind:'attempted',envelopeId:claim.envelopeId,fence:claim.fence,details:{requestDigest,provider:'resend'}});
      await event(tx,c,'external-effect.attempted',{effectId:effect.effect_id,operationKey:action.op.key,provider:'resend',fence:claim.fence,requestDigest});return effect as Row;
     }
     if(!sameContent(prior.request,action.request)||current.output_effect_id!==prior.effect_id)throw new StateConflict('Saved external effect differs from the authorized request.');
     if(prior.state==='attempted'){
      const live=(await tx.query<{live:boolean}>('SELECT idempotency_expires_at>clock_timestamp() AS live FROM external_effects WHERE effect_id=$1',[prior.effect_id])).rows[0].live;
      if(!live){await tx.query("UPDATE external_effects SET state='unknown',updated_at=clock_timestamp() WHERE effect_id=$1",[prior.effect_id]);await addEffectReceipt(tx,prior,{key:`unknown:${claim.fence}`,kind:'unknown',envelopeId:claim.envelopeId,fence:claim.fence,details:{reason:'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'}});await change(tx,c,'waiting-external','EMAIL_OUTCOME_UNKNOWN_NO_AUTOMATIC_RETRY');return null;}
      await tx.query("UPDATE envelope_operations SET state='dispatched',dispatch_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,claim.fence]);
      await addEffectReceipt(tx,prior,{key:`attempt:${claim.fence}`,kind:'attempted',envelopeId:claim.envelopeId,fence:claim.fence,details:{requestDigest,provider:'resend',idempotentReplay:true}});
      await event(tx,c,'external-effect.idempotent-replay-authorized',{effectId:prior.effect_id,operationKey:action.op.key,provider:'resend',fence:claim.fence});return prior as Row;
     }
     if(prior.state==='failed'){
      if(current.state!=='failed'){await tx.query("UPDATE envelope_operations SET state='failed',error_code='EMAIL_PROVIDER_REJECTED',result_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,claim.fence]);await change(tx,c,'failed','EMAIL_PROVIDER_REJECTED');await finishRun(tx,c,false);}
      return null;
     }
     await change(tx,c,'waiting-external',prior.state==='accepted'?'EMAIL_AWAITING_SIGNED_DELIVERY':'EMAIL_OUTCOME_UNKNOWN_NO_AUTOMATIC_RETRY');return null;
    });
    if(!shouldSend)return 'stopped';
    let result:ResendSendResult;
    try{result=await emailDelivery.send({effectId:String(shouldSend.effect_id),to:action.request.to,subject:action.request.subject,text:action.request.text,attachments},String(shouldSend.idempotency_key),signal);}
    catch{result={kind:'retryable',reason:'RESEND_ADAPTER_OUTCOME_AMBIGUOUS'};}
    return db.transaction(async tx=>{
     const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const effect=required((await tx.query('SELECT * FROM external_effects WHERE effect_id=$1 FOR UPDATE',[shouldSend.effect_id])).rows[0]);
     if(result.kind==='accepted'){
      await tx.query("UPDATE external_effects SET state=CASE WHEN state IN ('attempted','unknown') THEN 'accepted' ELSE state END,provider_reference=COALESCE(provider_reference,$2),updated_at=clock_timestamp() WHERE effect_id=$1",[effect.effect_id,result.emailId]);
      await addEffectReceipt(tx,effect,{key:`provider-accepted:${claim.fence}`,kind:'accepted',providerReference:result.emailId,details:{provider:'resend'}});
      await event(tx,c,'external-effect.accepted',{effectId:effect.effect_id,operationKey:action.op.key,provider:'resend',providerReference:result.emailId});
      const current=(await tx.query('SELECT state FROM external_effects WHERE effect_id=$1',[effect.effect_id])).rows[0];
      if(current.state==='attempted'||current.state==='accepted')await change(tx,c,'waiting-external','EMAIL_AWAITING_SIGNED_DELIVERY');
      return 'stopped';
     }
     if(result.kind==='rejected'){
      await tx.query("UPDATE external_effects SET state='failed',updated_at=clock_timestamp() WHERE effect_id=$1 AND state IN ('attempted','unknown')",[effect.effect_id]);
      await addEffectReceipt(tx,effect,{key:`provider-rejected:${claim.fence}`,kind:'failed',envelopeId:claim.envelopeId,fence:claim.fence,details:{reason:result.reason}});
      await tx.query("UPDATE envelope_operations SET state='failed',error_code=$3,result_fence=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,action.op.key,result.reason,claim.fence]);
      await deliveryEvidence(tx,c,effect,'not-met',`provider-rejected:${claim.fence}`,'envelope-worker',claim.fence,result.reason);
      await change(tx,c,'failed','EMAIL_PROVIDER_REJECTED');await finishRun(tx,c,false);return 'stopped';
     }
     const live=(await tx.query<{live:boolean}>('SELECT idempotency_expires_at>clock_timestamp() AS live FROM external_effects WHERE effect_id=$1',[effect.effect_id])).rows[0].live;
     if(live){await addEffectReceipt(tx,effect,{key:`ambiguous:${claim.fence}`,kind:'attempted',envelopeId:claim.envelopeId,fence:claim.fence,details:{reason:result.reason,idempotentReplayAllowed:true}});await change(tx,c,'queued','EMAIL_AMBIGUOUS_IDEMPOTENT_RETRY',backoffMs);}
     else{await tx.query("UPDATE external_effects SET state='unknown',updated_at=clock_timestamp() WHERE effect_id=$1 AND state='attempted'",[effect.effect_id]);await addEffectReceipt(tx,effect,{key:`unknown:${claim.fence}`,kind:'unknown',envelopeId:claim.envelopeId,fence:claim.fence,details:{reason:result.reason}});await change(tx,c,'waiting-external','EMAIL_OUTCOME_UNKNOWN_NO_AUTOMATIC_RETRY');}
     return 'stopped';
    });
   }
   if(action.state!=='generate')return action.state;
   const {op,prompt,attemptNumber}=action;const selected=op.selectedImplementation as {providerId?:string;modelId?:string},providerId=selected.providerId??'llamacpp-local';
   let provider:EnvelopeProviderManager;
   try{provider='forProvider' in providers?providers.forProvider(providerId):providers.providerId===providerId?providers:(()=>{throw new StateConflict('The pinned provider is unavailable to this worker.');})();}
   catch{await this.release(claim,'PINNED_PROVIDER_UNAVAILABLE');return 'stopped';}
   const inspected=await provider.inspect(signal);
   if(inspected.connection!=='ready'||inspected.modelFingerprint!==op.modelFingerprint){const reason=inspected.connection==='ready'?'MODEL_PIN_MISMATCH':providerId==='llamacpp-local'?'LOCAL_PROVIDER_UNAVAILABLE':'PROVIDER_ZERO_COST_OR_AVAILABILITY_BLOCKED';await this.release(claim,reason);return 'stopped';}
   try{
    const baseKey=claim.envelopeId+':'+op.key,idempotencyKey=attemptNumber===1?baseKey:`${baseKey}:attempt:${attemptNumber}`;
    await provider.generate(db,{prompt,maxOutputTokens:op.maxOutputTokens,idempotencyKey},signal,{
     runId:(await db.query('SELECT run_id FROM envelope_work WHERE envelope_id=$1',[claim.envelopeId])).rows[0].run_id as string,
     resumePreflight:async(tx,callId)=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const current=required(c.ops.find(r=>r.operation_key===op.key));
      if(current.state!=='reserved'||current.call_id!==callId||!sameContent(current.resolved_request,{prompt,maxOutputTokens:op.maxOutputTokens}))throw new LeaseLost('Only an exact proven preflight may resume.');
      await tx.query('UPDATE envelope_operations SET dispatch_fence=$3,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2',[claim.envelopeId,op.key,claim.fence]);await event(tx,c,'envelope-operation.preflight-resumed',{operationKey:op.key,callId,fence:claim.fence});},
     reserve:async(tx,callId)=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const current=required(c.ops.find(r=>r.operation_key===op.key)),resolved={prompt,maxOutputTokens:op.maxOutputTokens};if(current.state!=='pending'||current.call_id||(current.resolved_request&&!sameContent(current.resolved_request,resolved)))throw new LeaseLost('Operation already reserved or its request changed.');
      await tx.query("INSERT INTO envelope_operation_attempts(envelope_id,run_id,operation_key,attempt_number,call_id) VALUES($1,$2,$3,$4,$5)",[claim.envelopeId,c.run.id,op.key,attemptNumber,callId]);
      await tx.query("UPDATE envelope_operations SET state='reserved',call_id=$3,dispatch_fence=$4,resolved_request=$5,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,op.key,callId,claim.fence,JSON.stringify(resolved)]);await event(tx,c,'envelope-operation.reserved',{operationKey:op.key,callId,attemptNumber,fence:claim.fence});},
     eligible:async(tx,fingerprint,inputTokens)=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const current=required(c.ops.find(r=>r.operation_key===op.key));
      if(current.state!=='reserved'||String(current.dispatch_fence)!==claim.fence||fingerprint!==op.modelFingerprint||inputTokens===undefined||!op.modelScope||inputTokens>op.modelScope.inputTokens)throw new LeaseLost('Exact model/input scope changed.');
      await tx.query("UPDATE envelope_operations SET state='dispatched',updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[claim.envelopeId,op.key]);await event(tx,c,'envelope-operation.dispatch-intent',{operationKey:op.key,callId:current.call_id,fence:claim.fence});}
    });
   }catch(error){
    if(error instanceof LeaseLost)throw error;
    return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);const row=required(c.ops.find(r=>r.operation_key===op.key));await change(tx,c,row.call_id?'recovery-required':'queued',row.call_id?'CALL_STATE_REQUIRES_RECONCILIATION':error instanceof ApiError?error.code:'WORKER_PREFLIGHT_OR_STORAGE_FAILURE',backoffMs);return 'stopped';});
   }
   return db.transaction(async tx=>{const c=await load(tx,claim.envelopeId);await owns(tx,c,claim);return settle(tx,c,claim,op,required(c.ops.find(r=>r.operation_key===op.key)));});
  },
  async receiveResendWebhook(providerEventId:string,value:unknown){
   if(!/^[A-Za-z0-9._-]{1,200}$/.test(providerEventId))throw new StateConflict('Invalid signed provider event identity.');
   const parsed=parseResendDeliveryEvent(value),mailEvent:MailEvent={...parsed,providerEventId};
   if(mailEvent.kind==='ignored')return {matched:true,duplicate:false,ignored:true};
   if(!mailEvent.emailId||!mailEvent.recipient)return {matched:false,duplicate:false,ignored:false};
   return db.transaction(async tx=>{
    const effect=(await tx.query('SELECT * FROM external_effects WHERE provider_id=\'resend\' AND (($1::text IS NOT NULL AND effect_id=$1) OR ($1::text IS NULL AND provider_reference=$2)) ORDER BY CASE WHEN effect_id=$1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE',
     [mailEvent.effectId,mailEvent.emailId])).rows[0];
    if(!effect)return {matched:false,duplicate:false,ignored:false};
    const c=await load(tx,String(effect.envelope_id));
    const result=await settleMailEvent(tx,c,effect,mailEvent);
    return {matched:true,duplicate:result==='duplicate',ignored:false,effectId:String(effect.effect_id)};
   });
  },
  async review(id:string,value:unknown){parse(envelopeId,id);const input=parse(humanReview,value);return db.transaction(async tx=>{
   const c=await load(tx,id),prior=(await tx.query('SELECT * FROM envelope_reviews WHERE envelope_id=$1 AND operation_key=$2',[id,input.operationKey])).rows[0];
   if(prior){if(!sameContent(prior.request,input))throw new StateConflict('A different human decision already exists.');return {recorded:true};}
   if(c.work.state!=='waiting-human'||await authority(tx,c)||input.reviewedEnvelopeDigest!==c.row.digest)throw new StateConflict('Review the active exact envelope.');
   const op=c.body.operations.find(op=>op.key===input.operationKey);if(!op||op.kind!=='owner.review'||c.ops.find(r=>r.operation_key===op.key)?.state!=='pending'||reviewMaterial(c,op).digest!==input.reviewedInputDigest)throw new StateConflict('Review the exact current output.');
   for(const reference of op.artifacts??[]){
    const document=c.body.operations.find(candidate=>candidate.key===reference.operationKey),result=c.ops.find(candidate=>candidate.operation_key===reference.operationKey),artifactId=result?.output_artifact_id;
    if(document?.kind!=='docx.generate'||result?.state!=='succeeded'||typeof artifactId!=='string')throw new StateConflict('The review artifact is not complete.');
    const sizeBytes=Number((result.output_validation as {bytes?:unknown}|null)?.bytes);
    const retrieved=(await tx.query<{present:boolean}>(`SELECT EXISTS(SELECT 1 FROM events
     WHERE project_id=$1 AND run_id=$2 AND kind='artifact.retrieved' AND entity_id=$3
      AND occurred_at>$4 AND payload->>'sha256'=$5 AND payload->>'sizeBytes'=$6) AS present`,
     [c.run.project_id,c.run.id,artifactId,result.updated_at,String(result.output_sha256),String(sizeBytes)])).rows[0]?.present===true;
    if(!retrieved)throw new StateConflict('Retrieve and verify the exact DOCX artifact in the Hub before recording owner review.');
   }
   await tx.query('INSERT INTO envelope_reviews(envelope_id,operation_key,run_id,request) VALUES($1,$2,$3,$4)',[id,op.key,c.run.id,JSON.stringify(input)]);
   await tx.query('UPDATE envelope_operations SET state=$3,error_code=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2',[id,op.key,input.approve?'succeeded':'failed',input.approve?null:'OWNER_REJECTED']);
   await evidence(tx,c,op,input.approve?'met':'not-met',input.note);await event(tx,c,'envelope-operation.owner-reviewed',{operationKey:op.key,approved:input.approve});
   await change(tx,c,input.approve?'queued':'failed',input.approve?'OWNER_REVIEW_RECORDED':'OWNER_REJECTED');if(!input.approve)await finishRun(tx,c,false);return {recorded:true};
  });}
 };
}
