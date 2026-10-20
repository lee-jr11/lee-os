import { z } from 'zod';
import { createId, StateConflict, type StateDatabase, type SqlSession, type Row } from '@leeos/database';
import { ApiError } from '../api/errors';

const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const memoryId=z.string().regex(new RegExp(`^mem_${uuid}$`));
const projectId=z.string().regex(new RegExp(`^proj_${uuid}$`));
const automationId=z.string().regex(new RegExp(`^auto_${uuid}$`));
const artifactId=z.string().regex(new RegExp(`^file_${uuid}$`));
const memoryKinds=['user-preference','automation-knowledge','project-decision','engineering-lesson'] as const;
const scope=z.enum(['owner','project','automation']);
const tags=z.array(z.string().trim().toLowerCase().min(1).max(50).regex(/^[a-z0-9][a-z0-9._:-]*$/)).max(20);
export const memoryCreate=z.strictObject({
 kind:z.enum(memoryKinds),scope,projectId:projectId.optional(),automationId:automationId.optional(),
 summary:z.string().trim().min(1).max(500),content:z.record(z.string(),z.json()),tags,
 sourceArtifactId:artifactId.optional(),acknowledgeReview:z.literal(true)
});
export const memoryRetrieve=z.strictObject({projectId,automationId:automationId.optional(),tags:z.array(z.string().trim().toLowerCase().min(1).max(50).regex(/^[a-z0-9][a-z0-9._:-]*$/)).min(1).max(10)});
function required(row:Row|undefined,message='The selected memory scope is unavailable.'):Row{if(!row)throw new ApiError(404,'NOT_FOUND',message);return row;}
function stamp(value:unknown){return value?new Date(value as string|Date).toISOString():null;}
function sameProject(row:Row,project:string){if(String(row.project_id)!==project)throw new ApiError(404,'NOT_FOUND','Automation not found in this project.');}
async function history(tx:SqlSession,project:string|null,id:string,kind:string,details:Record<string,unknown>={}){
 await tx.query('INSERT INTO events(id,project_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5)',[createId('event'),project,kind,id,JSON.stringify(details)]);
}
export function createMemoryManager(db:StateDatabase){
 return {
  async create(value:unknown){
   const input=memoryCreate.parse(value);
   const shapeOk=input.scope==='owner'?!input.projectId&&!input.automationId&&!input.sourceArtifactId:
    input.scope==='project'?!!input.projectId&&!input.automationId:!!input.projectId&&!!input.automationId;
   if(!shapeOk)throw new ApiError(400,'INVALID_REQUEST','Memory scope, project, automation and evidence must match.');
   return db.transaction(async tx=>{
    if(input.projectId)required((await tx.query('SELECT id FROM projects WHERE id=$1 FOR SHARE',[input.projectId])).rows[0],'Project not found.');
    if(input.automationId){const a=required((await tx.query('SELECT id,project_id,status FROM automations WHERE id=$1 AND project_id=$2 FOR SHARE',[input.automationId,input.projectId])).rows[0],'Automation not found in this project.');sameProject(a,input.projectId!);if(a.status==='archived')throw new StateConflict('Archived automations cannot receive new memory.');}
    if(input.sourceArtifactId){
     if(!input.projectId)throw new ApiError(400,'INVALID_REQUEST','Owner-wide memories cannot cite project artifacts.');
     required((await tx.query(`SELECT a.id FROM artifacts a JOIN artifact_blobs b ON b.artifact_id=a.id AND b.project_id=a.project_id
      WHERE a.id=$1 AND a.project_id=$2 AND a.storage_backend='postgres-bytea' FOR SHARE OF a`,[input.sourceArtifactId,input.projectId])).rows[0],'Evidence artifact is not stored in this project.');
    }
    const id=createId('memory');
    const saved=required((await tx.query(`INSERT INTO memories(id,project_id,kind,content,source_artifact_id,scope,automation_id,summary,tags,retrieval_enabled,attestation,reviewed_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'owner-reviewed',clock_timestamp()) RETURNING *`,
     [id,input.projectId??null,input.kind,JSON.stringify(input.content),input.sourceArtifactId??null,input.scope,input.automationId??null,input.summary,input.tags])).rows[0]);
    await history(tx,input.projectId??null,id,'memory.reviewed',{kind:input.kind,scope:input.scope,tags:input.tags,artifactEvidence:!!input.sourceArtifactId});
    return thisView(saved);
   });
  },
  async retrieve(value:unknown){
   const input=memoryRetrieve.parse(value);
   required((await db.query('SELECT id FROM projects WHERE id=$1',[input.projectId])).rows[0],'Project not found.');
   if(input.automationId){
    const a=required((await db.query('SELECT id,project_id FROM automations WHERE id=$1',[input.automationId])).rows[0],'Automation not found.');sameProject(a,input.projectId);
   }
   const rows=(await db.query(`SELECT m.* FROM memories m
    LEFT JOIN artifacts a ON a.id=m.source_artifact_id AND a.project_id=m.project_id AND a.storage_backend='postgres-bytea'
    LEFT JOIN artifact_blobs b ON b.artifact_id=a.id AND b.project_id=a.project_id
    WHERE m.retrieval_enabled AND m.attestation='owner-reviewed' AND m.tags && $2::text[]
     AND (m.source_artifact_id IS NULL OR b.artifact_id IS NOT NULL)
     AND (m.scope='owner' OR (m.project_id=$1 AND m.scope='project') OR
      (m.project_id=$1 AND m.scope='automation' AND m.automation_id=$3))
    ORDER BY cardinality(ARRAY(SELECT unnest(m.tags) INTERSECT SELECT unnest($2::text[]))) DESC,m.updated_at DESC,m.id
    LIMIT 5`,[input.projectId,input.tags,input.automationId??null])).rows;
   return {projectId:input.projectId,automationId:input.automationId??null,tags:input.tags,limit:5,items:rows.map(thisView)};
  }
 };
}
function thisView(row:Row){return {id:String(row.id),projectId:row.project_id??null,kind:String(row.kind),scope:String(row.scope),automationId:row.automation_id??null,
 summary:String(row.summary),content:row.content,tags:row.tags as string[],sourceArtifactId:row.source_artifact_id??null,
 retrievalEnabled:Boolean(row.retrieval_enabled),reviewedAt:stamp(row.reviewed_at),createdAt:stamp(row.created_at),updatedAt:stamp(row.updated_at)};}
