import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {StateDatabase,SqlSession} from '@leeos/database';

export const artifactMaxBytes=10*1024*1024;
export const artifactMaxProjectBytes=100*1024*1024;
export const artifactMaxTotalBytes=500*1024*1024;
const id='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const projectIdSchema=z.string().regex(new RegExp(`^proj_${id}$`));
const runIdSchema=z.string().regex(new RegExp(`^run_${id}$`));
const envelopeIdSchema=z.string().regex(new RegExp(`^env_${id}$`));
export const artifactIdSchema=z.string().regex(new RegExp(`^file_${id}$`));
export const artifactNameSchema=z.string().trim().min(1).max(180).regex(/^[\p{L}\p{N}][^\p{Cc}\p{Cf}<>:"/\\|?*]*$/u)
 .refine(value=>!/[. ]$/.test(value),'Unsafe filename.').refine(value=>{
  const base=value.split('.')[0].toUpperCase();return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base);
 },'Reserved filename.');
export const artifactMediaTypeSchema=z.string().trim().toLowerCase().max(127).regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/);
export const artifactIdempotencyKeySchema=z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/);
const workerClaimSchema=z.strictObject({envelopeId:envelopeIdSchema,workerId:z.string().regex(/^worker_[A-Za-z0-9_-]{1,80}$/),fence:z.string().regex(/^[1-9][0-9]{0,17}$/)});
const registrationInput=z.strictObject({projectId:projectIdSchema,runId:runIdSchema.nullable().optional(),name:artifactNameSchema,mediaType:artifactMediaTypeSchema,idempotencyKey:artifactIdempotencyKeySchema,
 creator:z.enum(['owner-api','envelope-worker']),workerClaim:workerClaimSchema.optional(),bytes:z.instanceof(Uint8Array)}).superRefine((value,ctx)=>{
 if(value.bytes.byteLength<1||value.bytes.byteLength>artifactMaxBytes)ctx.addIssue({code:'custom',message:'Artifact byte limit exceeded.'});
 if(value.creator==='envelope-worker'&&(!value.runId||!value.workerClaim))ctx.addIssue({code:'custom',message:'Worker artifacts require run and claim ownership.'});
 if(value.creator==='owner-api'&&value.workerClaim)ctx.addIssue({code:'custom',message:'Owner registrations cannot claim worker provenance.'});
});

export type ArtifactCreator='owner-api'|'envelope-worker';
export type ArtifactStatus='available'|'metadata-only'|'missing';
export interface ArtifactMetadata{
 id:string;projectId:string;runId:string|null;name:string;mediaType:string;sha256:string|null;sizeBytes:number|null;
 storageBackend:'postgres-bytea'|'external-reference';creator:ArtifactCreator|'legacy';sourceEnvelopeId:string|null;sourceFence:string|null;status:ArtifactStatus;createdAt:string;
}
export interface ArtifactWorkerClaim{envelopeId:string;workerId:string;fence:string}
export interface ArtifactRegistration{projectId:string;runId?:string|null;name:string;mediaType:string;idempotencyKey:string;creator:ArtifactCreator;workerClaim?:ArtifactWorkerClaim;bytes:Uint8Array}
export type ArtifactStorageErrorCode='ARTIFACT_STORAGE_DISABLED'|'ARTIFACT_INVALID'|'ARTIFACT_NOT_FOUND'|'ARTIFACT_CONTENT_MISSING'|'ARTIFACT_INTEGRITY_FAILURE'|'ARTIFACT_SCOPE_INVALID'|'PROJECT_ARCHIVED'|'ARTIFACT_IDEMPOTENCY_CONFLICT'|'ARTIFACT_QUOTA_EXCEEDED';
const statuses:Record<ArtifactStorageErrorCode,number>={ARTIFACT_STORAGE_DISABLED:503,ARTIFACT_INVALID:400,ARTIFACT_NOT_FOUND:404,ARTIFACT_CONTENT_MISSING:503,ARTIFACT_INTEGRITY_FAILURE:500,ARTIFACT_SCOPE_INVALID:404,PROJECT_ARCHIVED:409,ARTIFACT_IDEMPOTENCY_CONFLICT:409,ARTIFACT_QUOTA_EXCEEDED:413};
export class ArtifactStorageError extends Error{
 readonly status:number;
 constructor(readonly code:ArtifactStorageErrorCode){super('The artifact operation could not be completed.');this.name='ArtifactStorageError';this.status=statuses[code];}
}
function fail(code:ArtifactStorageErrorCode):never{throw new ArtifactStorageError(code);}
function digest(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}
function stamp(value:unknown){const date=value instanceof Date?value:new Date(String(value));if(!Number.isFinite(date.getTime()))fail('ARTIFACT_INTEGRITY_FAILURE');return date.toISOString();}
type ArtifactRow={id:string;project_id:string;run_id:string|null;storage_uri:string;name:string;media_type:string;sha256:string|null;size_bytes:number|string|null;
 storage_backend:'postgres-bytea'|'external-reference';creator:'owner-api'|'envelope-worker'|'legacy';request_fingerprint:string|null;source_envelope_id:string|null;source_fence:string|number|null;created_at:Date|string;has_bytes?:boolean;content?:Uint8Array};
function metadata(row:ArtifactRow):ArtifactMetadata{
 return {id:row.id,projectId:row.project_id,runId:row.run_id,name:row.name,mediaType:row.media_type,sha256:row.sha256,
  sizeBytes:row.size_bytes===null?null:Number(row.size_bytes),storageBackend:row.storage_backend,creator:row.creator,
  sourceEnvelopeId:row.source_envelope_id,sourceFence:row.source_fence===null?null:String(row.source_fence),
  status:row.storage_backend==='external-reference'?'metadata-only':row.has_bytes===false?'missing':'available',createdAt:stamp(row.created_at)};
}
function verifyBytes(row:ArtifactRow,bytes:Uint8Array){
 if(row.storage_backend!=='postgres-bytea'||row.sha256===null||row.size_bytes===null||bytes.byteLength!==Number(row.size_bytes)||digest(bytes)!==row.sha256)fail('ARTIFACT_INTEGRITY_FAILURE');
}
const selectMetadata=`SELECT a.*,EXISTS(SELECT 1 FROM artifact_blobs b WHERE b.artifact_id=a.id AND b.project_id=a.project_id) AS has_bytes
 FROM artifacts a`;

export function createArtifactStorage(db:StateDatabase,options:{enabled?:()=>boolean;maxProjectBytes?:number}={}){
 const enabled=options.enabled??(()=>false),projectLimit=options.maxProjectBytes??artifactMaxProjectBytes;
 if(!Number.isSafeInteger(projectLimit)||projectLimit<1||projectLimit>artifactMaxProjectBytes)throw new Error('Invalid artifact project limit.');
 function assertEnabled(){if(!enabled())fail('ARTIFACT_STORAGE_DISABLED');}
 async function existing(tx:SqlSession,project:string,key:string):Promise<ArtifactRow|undefined>{
  return (await tx.query<ArtifactRow>(`${selectMetadata} WHERE a.project_id=$1 AND a.idempotency_key=$2`,[project,key])).rows[0];
 }
 async function replay(tx:SqlSession,row:ArtifactRow,fingerprint:string,legacyFingerprint:string):Promise<ArtifactMetadata>{
  if(row.request_fingerprint!==fingerprint&&row.request_fingerprint!==legacyFingerprint)fail('ARTIFACT_IDEMPOTENCY_CONFLICT');
  const blob=await tx.query<{content:Uint8Array}>('SELECT content FROM artifact_blobs WHERE artifact_id=$1 AND project_id=$2',[row.id,row.project_id]);
  if(!blob.rows[0])fail('ARTIFACT_CONTENT_MISSING');
  verifyBytes(row,blob.rows[0].content);return metadata({...row,has_bytes:true});
 }
 async function register(input:ArtifactRegistration){
  assertEnabled();
  const parsed=registrationInput.safeParse(input);if(!parsed.success)fail('ARTIFACT_INVALID');
  const value=parsed.data,bytes=Buffer.from(value.bytes),sha=digest(bytes),size=bytes.byteLength,workerClaim=value.workerClaim??null,
   // Provenance is recorded on the first write, while exact-content replays
   // remain recoverable when a later worker owns the retry under a new fence.
   fingerprint=digest(Buffer.from(JSON.stringify([value.projectId,value.runId??null,value.name,value.mediaType,sha,size,value.creator]))),
   legacyFingerprint=digest(Buffer.from(JSON.stringify([value.projectId,value.runId??null,value.name,value.mediaType,sha,size,value.creator,workerClaim])));
  return db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(710026,3)');
   const project=(await tx.query<{id:string;status:string}>('SELECT id,status FROM projects WHERE id=$1 FOR UPDATE',[value.projectId])).rows[0];
   if(!project)fail('ARTIFACT_SCOPE_INVALID');
   if(project.status==='archived')fail('PROJECT_ARCHIVED');
   if(value.runId){const run=(await tx.query('SELECT id FROM runs WHERE id=$1 AND project_id=$2',[value.runId,value.projectId])).rows[0];if(!run)fail('ARTIFACT_SCOPE_INVALID');}
   const prior=await existing(tx,value.projectId,value.idempotencyKey);
   if(prior)return {artifact:await replay(tx,prior,fingerprint,legacyFingerprint),created:false};
   if(value.creator==='envelope-worker'){
    const claim=workerClaim!;
    const authority=(await tx.query<{state:string;worker_id:string;fence:string|number;lease_live:boolean;grant_live:boolean;run_status:string;revoked:boolean}>(`SELECT w.state,w.worker_id,w.fence,w.lease_expires_at>clock_timestamp() AS lease_live,
      e.grant_expires_at>clock_timestamp() AS grant_live,r.status AS run_status,
      EXISTS(SELECT 1 FROM execution_envelope_revocations v WHERE v.envelope_id=e.id) AS revoked
     FROM envelope_work w JOIN execution_envelopes e ON e.id=w.envelope_id JOIN runs r ON r.id=e.run_id
     WHERE w.envelope_id=$1 AND e.run_id=$2 AND r.project_id=$3 FOR UPDATE OF w,r`,[claim.envelopeId,value.runId,value.projectId])).rows[0];
    if(!authority||authority.state!=='running'||authority.worker_id!==claim.workerId||String(authority.fence)!==claim.fence||authority.lease_live!==true||authority.grant_live!==true||authority.revoked||!['queued','running'].includes(authority.run_status))fail('ARTIFACT_SCOPE_INVALID');
   }
   const usage=(await tx.query<{bytes:string|number}>('SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM artifacts WHERE project_id=$1 AND storage_backend=\'postgres-bytea\'',[value.projectId])).rows[0];
   if(Number(usage?.bytes??0)+size>projectLimit)fail('ARTIFACT_QUOTA_EXCEEDED');
   const total=(await tx.query<{bytes:string|number}>("SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM artifacts WHERE storage_backend='postgres-bytea'")).rows[0];
   if(Number(total?.bytes??0)+size>artifactMaxTotalBytes)fail('ARTIFACT_QUOTA_EXCEEDED');
   const artifactId=`file_${randomUUID()}`;
   const inserted=(await tx.query<ArtifactRow>(`INSERT INTO artifacts(id,project_id,run_id,storage_uri,name,media_type,sha256,size_bytes,storage_backend,creator,idempotency_key,request_fingerprint,source_envelope_id,source_fence)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'postgres-bytea',$9,$10,$11,$12,$13) RETURNING *`,
    [artifactId,value.projectId,value.runId??null,`leeos-artifact://postgres-bytea/${artifactId}`,value.name,value.mediaType,sha,size,value.creator,value.idempotencyKey,fingerprint,workerClaim?.envelopeId??null,workerClaim?.fence??null])).rows[0];
   await tx.query('INSERT INTO artifact_blobs(artifact_id,project_id,content) VALUES($1,$2,$3)',[artifactId,value.projectId,bytes]);
   await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',
    [`evt_${randomUUID()}`,value.projectId,value.runId??null,'artifact.registered',artifactId,JSON.stringify({creator:value.creator,name:value.name,mediaType:value.mediaType,sizeBytes:size,sha256:sha,storageBackend:'postgres-bytea',sourceEnvelopeId:workerClaim?.envelopeId??null,sourceFence:workerClaim?.fence??null})]);
   return {artifact:metadata({...inserted,has_bytes:true}),created:true};
  });
 }
 async function get(idValue:string){
  assertEnabled();const id=artifactIdSchema.safeParse(idValue);if(!id.success)fail('ARTIFACT_NOT_FOUND');
  const row=(await db.query<ArtifactRow>(`${selectMetadata} WHERE a.id=$1`,[id.data])).rows[0];if(!row)fail('ARTIFACT_NOT_FOUND');return metadata(row);
 }
 async function findByIdempotencyKey(projectValue:string,keyValue:string){
  assertEnabled();const project=projectIdSchema.safeParse(projectValue),key=artifactIdempotencyKeySchema.safeParse(keyValue);
  if(!project.success||!key.success)fail('ARTIFACT_INVALID');
  const row=(await db.query<ArtifactRow>(`${selectMetadata} WHERE a.project_id=$1 AND a.idempotency_key=$2`,[project.data,key.data])).rows[0];
  return row?metadata(row):null;
 }
 async function list(projectValue:string,limit=25,after?:string|null){
  assertEnabled();const project=projectIdSchema.safeParse(projectValue);if(!project.success||!Number.isInteger(limit)||limit<1||limit>100)fail('ARTIFACT_INVALID');
  let cursor: {created_at:Date|string;id:string}|undefined;
  if(after){const parsed=artifactIdSchema.safeParse(after);if(!parsed.success)fail('ARTIFACT_INVALID');cursor=(await db.query<{created_at:Date|string;id:string}>('SELECT created_at,id FROM artifacts WHERE project_id=$1 AND id=$2 AND storage_backend=\'postgres-bytea\'',[project.data,parsed.data])).rows[0];if(!cursor)fail('ARTIFACT_INVALID');}
  const rows=(await db.query<ArtifactRow>(`${selectMetadata} WHERE a.project_id=$1 AND a.storage_backend='postgres-bytea'
    ${cursor?'AND (a.created_at,a.id)<($2::timestamptz,$3::text)':''}
    ORDER BY a.created_at DESC,a.id DESC LIMIT $${cursor?4:2}`,
    cursor?[project.data,cursor.created_at,cursor.id,limit+1]:[project.data,limit+1])).rows;
  const hasMore=rows.length>limit,items=rows.slice(0,limit).map(metadata);
  return {items,nextCursor:hasMore?items.at(-1)!.id:null};
 }
 async function getContent(idValue:string){
  assertEnabled();const parsed=artifactIdSchema.safeParse(idValue);if(!parsed.success)fail('ARTIFACT_NOT_FOUND');
  return db.transaction(async tx=>{
   const row=(await tx.query<ArtifactRow>(`SELECT a.*,b.content,true AS has_bytes FROM artifacts a
    LEFT JOIN artifact_blobs b ON b.artifact_id=a.id AND b.project_id=a.project_id WHERE a.id=$1`,[parsed.data])).rows[0];
   if(!row)fail('ARTIFACT_NOT_FOUND');if(row.storage_backend!=='postgres-bytea'||!row.content)fail('ARTIFACT_CONTENT_MISSING');
   const bytes=Buffer.from(row.content);verifyBytes(row,bytes);
   await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',
    [`evt_${randomUUID()}`,row.project_id,row.run_id,'artifact.retrieved',row.id,JSON.stringify({sha256:row.sha256,sizeBytes:bytes.byteLength})]);
   return {artifact:metadata({...row,has_bytes:true}),bytes};
  });
 }
 return {register,get,findByIdempotencyKey,list,getContent};
}
