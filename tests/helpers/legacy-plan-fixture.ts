import {createId,type StateDatabase} from '../../packages/database/src';
import {buildPlan,planInput} from '../../packages/core/src/orchestrator';

// Upgrade fixtures represent data written before requirements existed. Do not
// run today's requirements-aware persistence service against that old schema.
export async function seedLegacyPlan(db:StateDatabase,runId:string,value:unknown){
 const input=planInput.parse(value),plan=buildPlan(input);
 await db.transaction(async tx=>{
  const run=(await tx.query('SELECT project_id FROM runs WHERE id=$1',[runId])).rows[0];
  await tx.query('INSERT INTO run_plans(run_id,run_version,input,plan) VALUES($1,$2,$3,$4)',[runId,input.expectedRunVersion,JSON.stringify(input),JSON.stringify(plan)]);
  await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$3,$5)',[createId('event'),run.project_id,runId,'run.planned',JSON.stringify({plannerVersion:'2',stepCount:input.steps.length,status:'blocked'})]);
 });
}
