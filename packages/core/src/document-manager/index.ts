import {ArtifactStorageError,artifactNameSchema,createArtifactStorage,type ArtifactMetadata} from '../storage-manager';
import {claimSchema,type Claim} from '../envelope-worker';
import {type StateDatabase} from '@leeos/database';
import {docxDocumentSchema,docxMaxBytes,generateDocx,validateDocx,type DocxDocument,type DocxValidationReport} from '@leeos/executors/python-docx';

export const docxMediaType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export class DocumentExecutionError extends Error{
 constructor(readonly code:'DOCUMENT_AUTHORITY_INVALID'|'DOCUMENT_STORAGE_DISABLED'|'DOCUMENT_REQUEST_INVALID'|'DOCUMENT_ARTIFACT_CONFLICT'|'DOCUMENT_INTEGRITY_FAILURE'){
  super('The document operation could not be completed.');this.name='DocumentExecutionError';
 }
}
export interface DocumentOperationInput{runId:string;projectId:string;envelopeId:string;operationKey:string;name:string;document:DocxDocument;claim:Claim;signal?:AbortSignal}
export interface StoredDocx{artifact:ArtifactMetadata;validation:DocxValidationReport;created:boolean}
const operationKeyPattern=/^[a-z][a-z0-9_-]{0,63}$/;
const safeFileKey=(envelopeId:string,key:string)=>`docx-${envelopeId}-${key}`;

export function createDocumentManager(db:StateDatabase,options:{enabled?:()=>boolean;maxProjectBytes?:number}={}){
 const enabled=options.enabled??(()=>false),storage=createArtifactStorage(db,{enabled,maxProjectBytes:options.maxProjectBytes});
 async function assertOwned(input:DocumentOperationInput){
  const claim=claimSchema.safeParse(input.claim),doc=docxDocumentSchema.safeParse(input.document),name=artifactNameSchema.safeParse(input.name);
  if(!claim.success||!doc.success||!name.success||!name.data.toLowerCase().endsWith('.docx')||!operationKeyPattern.test(input.operationKey))throw new DocumentExecutionError('DOCUMENT_REQUEST_INVALID');
  if(!enabled())throw new ArtifactStorageError('ARTIFACT_STORAGE_DISABLED');
  const row=(await db.query<{valid:boolean}>(`SELECT (w.state='running' AND w.worker_id=$4 AND w.fence=$5
    AND w.lease_expires_at>clock_timestamp() AND e.grant_expires_at>clock_timestamp()
    AND r.status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM execution_envelope_revocations v WHERE v.envelope_id=e.id)) AS valid
   FROM envelope_work w JOIN execution_envelopes e ON e.id=w.envelope_id JOIN runs r ON r.id=w.run_id
   JOIN envelope_operations o ON o.envelope_id=w.envelope_id AND o.run_id=w.run_id
   WHERE w.envelope_id=$1 AND w.run_id=$2 AND r.project_id=$3 AND o.operation_key=$6
    AND o.kind='docx.generate' AND o.state='reserved' AND o.dispatch_fence=$5 AND o.resolved_request=$7::jsonb`,
   [input.envelopeId,input.runId,input.projectId,claim.data.workerId,claim.data.fence,input.operationKey,JSON.stringify({name:name.data,document:doc.data})])).rows[0];
  if(!row?.valid)throw new DocumentExecutionError('DOCUMENT_AUTHORITY_INVALID');return {name:name.data,document:doc.data,workerClaim:claim.data};
 }
 return {async generateAndStore(input:DocumentOperationInput):Promise<StoredDocx>{
  const request=await assertOwned(input),idempotencyKey=safeFileKey(input.envelopeId,input.operationKey);
  const prior=await storage.findByIdempotencyKey(input.projectId,idempotencyKey);
  if(prior){
   if(prior.runId!==input.runId||prior.name!==request.name||prior.mediaType!==docxMediaType||prior.sourceEnvelopeId!==input.envelopeId||prior.status!=='available')throw new DocumentExecutionError('DOCUMENT_ARTIFACT_CONFLICT');
   const saved=await storage.getContent(prior.id),validation=await validateDocx(saved.bytes,request.document,input.signal);
   if(saved.artifact.sha256!==validation.sha256||saved.bytes.byteLength!==validation.bytes)throw new DocumentExecutionError('DOCUMENT_INTEGRITY_FAILURE');
   return {artifact:saved.artifact,validation,created:false};
  }
  if(input.signal?.aborted)throw new Error('Document operation cancelled.');
  const bytes=await generateDocx(request.document,input.signal);
  if(bytes.byteLength>docxMaxBytes)throw new DocumentExecutionError('DOCUMENT_REQUEST_INVALID');
  const validation=await validateDocx(bytes,request.document,input.signal);
  const receipt=await storage.register({projectId:input.projectId,runId:input.runId,name:request.name,mediaType:docxMediaType,idempotencyKey,creator:'envelope-worker',workerClaim:request.workerClaim,bytes});
  if(receipt.artifact.sourceEnvelopeId!==input.envelopeId||receipt.artifact.status!=='available')throw new DocumentExecutionError('DOCUMENT_ARTIFACT_CONFLICT');
  const persisted=await storage.getContent(receipt.artifact.id);
  if(persisted.artifact.sha256!==validation.sha256||persisted.bytes.byteLength!==validation.bytes||!Buffer.from(persisted.bytes).equals(Buffer.from(bytes)))throw new DocumentExecutionError('DOCUMENT_INTEGRITY_FAILURE');
  return {artifact:persisted.artifact,validation,created:receipt.created};
 }};
}
