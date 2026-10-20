import { createId, StateConflict, type StateDatabase, type Row } from '@leeos/database';
import { ApiError } from '../api/errors';
import { parse, runId } from '../api/contracts';
import { buildPlan, planInput } from './index';
import {z} from 'zod';
import {buildCapabilityPlan,capabilityPlanInput} from './capability-plan';
import type {RoutingOptions} from '../model-router';
import type {EmailDeliveryRouteSnapshot} from '../task-router/capabilities';
import {requirementsContent} from '../requirements';
export const planningRequest=z.union([capabilityPlanInput,planInput]);
function view(row: Row) {
 return {runId:row.run_id,runVersion:row.run_version,plan:row.plan,createdAt:new Date(String(row.created_at)).toISOString()};
}
export function createPlanner(db: StateDatabase,options:{routing?:()=>Promise<RoutingOptions&{emailDelivery?:EmailDeliveryRouteSnapshot}>|RoutingOptions&{emailDelivery?:EmailDeliveryRouteSnapshot}}={}) {
 return {
  async get(id: string) {
   parse(runId,id);
   const row=(await db.query('SELECT * FROM run_plans WHERE run_id=$1',[id])).rows[0];
   if(!row)throw new ApiError(404,'NOT_FOUND','Plan not found.');
   return view(row);
  },
  async create(id: string,value: unknown) {
   parse(runId,id); const input=parse(planningRequest,value);
   return db.transaction(async tx=>{
    const run=(await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!run)throw new ApiError(404,'NOT_FOUND','Run not found.');
    const saved=(await tx.query('SELECT * FROM run_plans WHERE run_id=$1',[id])).rows[0];
    // JSONB compares normalized objects, independent of client property order.
    if(saved) {
     const same=(await tx.query<{same:boolean}>('SELECT input=$2::jsonb AS same FROM run_plans WHERE run_id=$1',[id,JSON.stringify(input)])).rows[0].same;
     if(!same)throw new StateConflict('A different plan already exists.');
     return view(saved);
    }
    if(run.status!=='queued' || run.version!==input.expectedRunVersion)throw new StateConflict('Run must still be queued at the expected version.');
    const binding=(await tx.query(`SELECT b.*,v.content FROM run_requirements b
     JOIN requirements_revisions v ON v.requirements_id=b.requirements_id AND v.revision=b.revision
     JOIN requirements_reviews r ON r.requirements_id=b.requirements_id AND r.revision=b.revision AND r.digest=b.digest
     WHERE b.run_id=$1`,[id])).rows[0];
    if((await tx.query('SELECT id FROM jobs WHERE run_id=$1 LIMIT 1',[id])).rows.length)throw new StateConflict('Plan before preparing jobs.');
    let plan;
    if('mode' in input){
     if(!binding||binding.digest!==input.reviewedRequirementsDigest)throw new StateConflict('Bind and review this exact requirements contract first.');
     const content=parse(requirementsContent,binding.content);
     const needsModelRoute=content.capabilities.includes('text_generation')&&Boolean(input.modelBudget),needsEmailRoute=content.capabilities.includes('approved_delivery')||content.capabilities.includes('delivery_confirmation');
     const routing=needsModelRoute||needsEmailRoute?await options.routing?.()??{}:{};
     plan=buildCapabilityPlan(input,{id:binding.requirements_id,revision:binding.revision,digest:binding.digest,content},routing);
    }else{
     if(binding)throw new StateConflict('Requirements-bound runs require capability-first planning.');
     plan=buildPlan(input);
    }
    const row=(await tx.query('INSERT INTO run_plans(run_id,run_version,input,plan) VALUES($1,$2,$3,$4) RETURNING *',[id,run.version,JSON.stringify(input),JSON.stringify(plan)])).rows[0];
    await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$3,$5)',[createId('event'),run.project_id,id,'run.planned',JSON.stringify({plannerVersion:plan.plannerVersion,stepCount:plan.steps.length,status:'blocked',...('contract' in plan?{requirementsId:plan.contract.id,requirementsRevision:plan.contract.revision,requirementsDigest:plan.contract.digest,routingStatus:plan.routingStatus}:{})})]);
    return view(row);
   });
  }
 };
}
