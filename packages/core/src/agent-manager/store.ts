import { createId,StateConflict,type StateDatabase,type SqlSession,type Row } from '@leeos/database';
import { roleRegistration,roleDefinition } from '@leeos/agents';
import { parse,runId,jobId,roleId,agentId } from '../api/contracts';
import { ApiError } from '../api/errors';
import { assignAgentRequest,dismissAgentRequest } from './index';
function required<T>(value:T|undefined,kind:string):T{if(!value)throw new ApiError(404,'NOT_FOUND',`${kind} not found.`);return value;}
function stamp(value:unknown){return (value instanceof Date?value:new Date(String(value))).toISOString();}
function roleView(row:Row){return {id:row.id,version:1,definition:row.definition,createdAt:stamp(row.created_at)};}
function receipt(row:Row){return {assignment:row.assignment,createdAt:stamp(row.created_at)};}
function current(row:Row){return {...receipt(row),currentStatus:row.status,version:row.version,jobStatus:row.job_status,runStatus:row.run_status};}
function limit(value:number){if(!Number.isInteger(value)||value<1||value>100)throw new ApiError(400,'INVALID_REQUEST','Invalid page size.');return value;}
const joined=`SELECT a.*,g.status,g.version,j.status AS job_status,r.status AS run_status
 FROM agent_assignments a JOIN agents g ON g.id=a.agent_id JOIN jobs j ON j.id=a.job_id JOIN runs r ON r.id=a.run_id`;
async function history(tx:SqlSession,projectId:unknown,run:string|null,kind:string,id:string,payload:unknown={}){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),projectId,run,kind,id,JSON.stringify(payload)]);
}
export function createAgentManager(db:StateDatabase){
 return {
  async registerRole(value:unknown){
   const input=parse(roleRegistration,value);const {idempotencyKey,...definition}=input;
   return db.transaction(async tx=>{
    const inserted=(await tx.query('INSERT INTO agent_roles(id,registration_key,request,definition) VALUES($1,$2,$3,$4) ON CONFLICT(registration_key) DO NOTHING RETURNING *',
     [createId('role'),idempotencyKey,JSON.stringify(input),JSON.stringify(definition)])).rows[0];
    if(!inserted){
     const saved=required((await tx.query('SELECT *,request=$2::jsonb AS same FROM agent_roles WHERE registration_key=$1',[idempotencyKey,JSON.stringify(input)])).rows[0],'Role');
     if(!saved.same)throw new StateConflict('Registration key belongs to another definition.');
     return roleView(saved);
    }
    await history(tx,null,null,'agent-role.registered',String(inserted.id));return roleView(inserted);
   });
  },
  async getRole(id:string){parse(roleId,id);return roleView(required((await db.query('SELECT * FROM agent_roles WHERE id=$1',[id])).rows[0],'Role'));},
  async listRoles(after:string|null=null,pageSize=25){
   if(after)parse(roleId,after);limit(pageSize);
   const rows=(await db.query('SELECT * FROM agent_roles WHERE ($1::text IS NULL OR id>$1) ORDER BY id LIMIT $2',[after,pageSize+1])).rows;
   const items=rows.slice(0,pageSize);return {items:items.map(roleView),nextCursor:rows.length>pageSize?String(items.at(-1)!.id):null};
  },
  async assign(run:string,job:string,value:unknown){
   parse(runId,run);parse(jobId,job);const input=parse(assignAgentRequest,value);
   return db.transaction(async tx=>{
    const parent=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[run])).rows[0],'Run');
    const prepared=required((await tx.query(`SELECT p.*,j.status,j.attempt_count FROM prepared_jobs p JOIN jobs j ON j.id=p.job_id WHERE p.job_id=$1 AND p.run_id=$2`,[job,run])).rows[0],'Prepared job');
    const saved=(await tx.query('SELECT *,request=$2::jsonb AS same FROM agent_assignments WHERE job_id=$1',[job,JSON.stringify(input)])).rows[0];
    if(saved){if(!saved.same)throw new StateConflict('This job already has a different assignment.');return receipt(saved);}
    const preparation=required((await tx.query('SELECT * FROM run_preparations WHERE run_id=$1',[run])).rows[0],'Preparation');
    const preparationReceipt=preparation.receipt as Row;
    if(parent.status!=='queued'||parent.version!==input.expectedRunVersion||parent.version!==preparationReceipt.runVersion||
      preparationReceipt.reviewedPlanDigest!==input.reviewedPlanDigest||prepared.status!=='pending'||prepared.attempt_count!==0)
     throw new StateConflict('Assignment requires the reviewed pending job and current queued run.');
    const savedRole=required((await tx.query('SELECT * FROM agent_roles WHERE id=$1',[input.roleId])).rows[0],'Role');
    const definition=roleDefinition.safeParse(savedRole.definition);const blueprint=prepared.blueprint as Row;
    if(!definition.success||blueprint.executionEnabled!==false||blueprint.mode!=='prepare-only'||!Array.isArray(blueprint.permissions)||blueprint.permissions.length)
     throw new StateConflict('Unsupported role or preparation permissions.');
    if(!definition.data.stepKinds.some(kind=>kind===blueprint.kind))throw new StateConflict('Role does not support this step. Human review remains with the owner.');
    const id=createId('agent');
    const assignment={managerVersion:'1',id,runId:run,jobId:job,stepKey:prepared.step_key,roleId:input.roleId,
     roleVersion:1,roleSnapshot:definition.data,reviewedPlanDigest:input.reviewedPlanDigest,
     mode:'assignment-only',permissions:[],executionEnabled:false,initialStatus:'planned'};
    await tx.query('INSERT INTO agents(id,run_id,role,status,permissions) VALUES($1,$2,$3,$4,$5)',[id,run,definition.data.name,'planned','[]']);
    const row=(await tx.query('INSERT INTO agent_assignments(agent_id,run_id,job_id,role_id,request,assignment) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
     [id,run,job,input.roleId,JSON.stringify(input),JSON.stringify(assignment)])).rows[0];
    await history(tx,parent.project_id,run,'agent.assigned',id,{jobId:job,roleId:input.roleId,mode:'assignment-only'});return receipt(row);
   });
  },
  async get(id:string){parse(agentId,id);return current(required((await db.query(joined+' WHERE a.agent_id=$1',[id])).rows[0],'Assignment'));},
  async forJob(run:string,job:string){
   parse(runId,run);parse(jobId,job);
   return current(required((await db.query(joined+' WHERE a.run_id=$1 AND a.job_id=$2',[run,job])).rows[0],'Assignment'));
  },
  async list(run:string,after:string|null=null,pageSize=25){
   parse(runId,run);if(after)parse(agentId,after);limit(pageSize);
   required((await db.query('SELECT id FROM runs WHERE id=$1',[run])).rows[0],'Run');
   const rows=(await db.query(joined+' WHERE a.run_id=$1 AND ($2::text IS NULL OR a.agent_id>$2) ORDER BY a.agent_id LIMIT $3',[run,after,pageSize+1])).rows;
   const items=rows.slice(0,pageSize);return {items:items.map(current),nextCursor:rows.length>pageSize?String(items.at(-1)!.agent_id):null};
  },
  async dismiss(id:string,value:unknown){
   parse(agentId,id);const input=parse(dismissAgentRequest,value);
   return db.transaction(async tx=>{
    const mapping=required((await tx.query('SELECT run_id FROM agent_assignments WHERE agent_id=$1',[id])).rows[0],'Assignment');
    const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[mapping.run_id])).rows[0],'Run');
    const changed=(await tx.query("UPDATE agents SET status='dismissed',version=version+1 WHERE id=$1 AND status='planned' AND version=$2 RETURNING *",[id,input.expectedVersion])).rows[0];
    if(!changed)throw new StateConflict('Agent state changed.');
    await history(tx,run.project_id,String(run.id),'agent.dismissed',id,{reason:'owner-request'});
    return current(required((await tx.query(joined+' WHERE a.agent_id=$1',[id])).rows[0],'Assignment'));
   });
  }
 };
}
