import { createId, StateConflict, type StateDatabase, type SqlSession, type Row } from '@leeos/database';
import { z } from 'zod';
import { ApiError } from '../api/errors';

const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const projectLifecycleId=z.string().regex(new RegExp(`^proj_${uuid}$`));
export const automationLifecycleId=z.string().regex(new RegExp(`^auto_${uuid}$`));
export const lifecycleCommand=z.strictObject({action:z.enum(['pause','resume','archive']),expectedVersion:z.number().int().min(0).max(2147483646)});
function required(row:Row|undefined,label:string){if(!row)throw new ApiError(404,'NOT_FOUND',`${label} not found.`);return row;}
function stamp(value:unknown){return value?new Date(value as string|Date).toISOString():null;}
async function event(tx:SqlSession,project:string|null,kind:string,id:string,from:string,to:string){
 await tx.query('INSERT INTO events(id,project_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5)',[createId('event'),project,kind,id,JSON.stringify({from,to})]);
}
function nextStatus(current:string,action:'pause'|'resume'|'archive'){
 if(action==='archive'){if(current==='archived')throw new StateConflict('This record is already archived.');return 'archived';}
 if(action==='pause'){if(!['active','draft'].includes(current))throw new StateConflict('Only an active or draft record can be paused.');return 'paused';}
 if(current!=='paused')throw new StateConflict('Only a paused record can be resumed.');return 'active';
}
async function freezeSubscriptions(tx:SqlSession,where:string,params:unknown[],resetBoundary:boolean,disable=false){
 const rows=(await tx.query(`SELECT id,project_id FROM event_subscriptions WHERE enabled AND (${where}) FOR UPDATE`,params)).rows;
 for(const row of rows){
  await tx.query('UPDATE event_subscriptions SET version=version+1,enabled=CASE WHEN $3 THEN false ELSE enabled END,enabled_since=CASE WHEN $2 THEN clock_timestamp() ELSE enabled_since END WHERE id=$1',[row.id,resetBoundary,disable]);
 }
}
async function disableSchedules(tx:SqlSession,where:string,params:unknown[]){
 const rows=(await tx.query(`SELECT s.id,c.project_id FROM schedules s JOIN schedule_configs c ON c.schedule_id=s.id WHERE s.enabled AND (${where}) FOR UPDATE OF s`,params)).rows;
 for(const row of rows)await tx.query('UPDATE schedules SET enabled=false,version=version+1 WHERE id=$1',[row.id]);
}
export function createLifecycleManager(db:StateDatabase){
 return {
  async project(id:string,value:unknown){
   const key=projectLifecycleId.parse(id),input=lifecycleCommand.parse(value);
   return db.transaction(async tx=>{
    const row=required((await tx.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE',[key])).rows[0],'Project');
    if(Number(row.lifecycle_version)!==input.expectedVersion)throw new StateConflict('Refresh the project lifecycle version.');
    const status=nextStatus(String(row.status),input.action);
    await tx.query('UPDATE projects SET status=$2,lifecycle_version=lifecycle_version+1 WHERE id=$1',[key,status]);
    if(input.action==='archive'){
     await disableSchedules(tx,'c.project_id=$1',[key]);
     await freezeSubscriptions(tx,'project_id=$1',[key],false,true);
    }else if(input.action==='resume'){
     await freezeSubscriptions(tx,'project_id=$1',[key],true);
    }
    await event(tx,key,`project.${input.action}d`,key,String(row.status),status);
    return {id:key,name:String(row.name),description:String(row.description),status,lifecycleVersion:input.expectedVersion+1,createdAt:stamp(row.created_at),updatedAt:stamp(row.updated_at)};
   });
  },
  async automation(id:string,value:unknown){
   const key=automationLifecycleId.parse(id),input=lifecycleCommand.parse(value);
   return db.transaction(async tx=>{
    const row=required((await tx.query('SELECT * FROM automations WHERE id=$1 FOR UPDATE',[key])).rows[0],'Automation');
    if(Number(row.lifecycle_version)!==input.expectedVersion)throw new StateConflict('Refresh the automation lifecycle version.');
    const project=required((await tx.query('SELECT status FROM projects WHERE id=$1 FOR SHARE',[row.project_id])).rows[0],'Project');
    if(input.action==='resume'&&project.status==='archived')throw new StateConflict('An automation in an archived project cannot be resumed.');
    const status=nextStatus(String(row.status),input.action);
    await tx.query('UPDATE automations SET status=$2,lifecycle_version=lifecycle_version+1 WHERE id=$1',[key,status]);
    if(input.action==='archive'){
     await disableSchedules(tx,'c.automation_id=$1',[key]);
     await freezeSubscriptions(tx,'source_automation_id=$1 OR target_automation_id=$1',[key],false,true);
    }else if(input.action==='resume'){
     await freezeSubscriptions(tx,'source_automation_id=$1 OR target_automation_id=$1',[key],true);
    }
    await event(tx,String(row.project_id),`automation.${input.action}d`,key,String(row.status),status);
    return {id:key,projectId:String(row.project_id),name:String(row.name),status,version:Number(row.definition_version),lifecycleVersion:input.expectedVersion+1,updatedAt:stamp(row.updated_at)};
   });
  }
 };
}
