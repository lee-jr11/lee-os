import {z} from 'zod';
import {requirementsContent,requirementsId,requirementsDigest} from '../requirements';
import {routeCapability} from '../task-router/capabilities';
import type {EmailDeliveryRouteSnapshot} from '../task-router/capabilities';
import type {RoutingOptions} from '../model-router';

export const capabilityPlanInput=z.strictObject({
 mode:z.literal('capability-first'),expectedRunVersion:z.number().int().min(0).max(2147483646),
 reviewedRequirementsDigest:z.string().regex(/^[a-f0-9]{64}$/),
 modelBudget:z.strictObject({inputTokens:z.number().int().min(1).max(100_000_000),outputTokens:z.number().int().min(1).max(100_000_000)}).optional()
});
const boundContract=z.strictObject({id:requirementsId,revision:z.number().int().min(1).max(2147483646),digest:z.string().regex(/^[a-f0-9]{64}$/),content:requirementsContent});
const verifiers={
 'owner-review':'owner_review','job-result':'recorded_job_result','document-validation':'document_validation',
 'artifact-registration':'artifact_registration','delivery-confirmation':'delivery_confirmation'
} as const;
export function buildCapabilityPlan(value:unknown,contractValue:unknown,options:RoutingOptions&{emailDelivery?:EmailDeliveryRouteSnapshot}={}){
 const input=capabilityPlanInput.parse(value),contract=boundContract.parse(contractValue),content=contract.content;
 if(contract.digest!==input.reviewedRequirementsDigest||contract.digest!==requirementsDigest(contract.id,contract.revision,content))throw new Error('Requirements digest mismatch.');
 if(content.questions.length)throw new Error('Reviewed requirements contain unresolved questions.');
 const needs=new Map<string,{id:string;required:boolean;requirementIds:string[];criterionIds:string[];sources:string[]}>();
 function need(id:string,required:boolean,requirements:string[],criteria:string[],source:string){
  const row=needs.get(id)??{id,required:false,requirementIds:[],criterionIds:[],sources:[]};row.required ||=required;
  row.requirementIds=[...new Set([...row.requirementIds,...requirements])].sort();row.criterionIds=[...new Set([...row.criterionIds,...criteria])].sort();
  row.sources=[...new Set([...row.sources,source])].sort();needs.set(id,row);
 }
 // Requirements define the work; acceptance kinds independently define the checks.
 for(const id of content.capabilities){
  const linked=content.requirements.filter(r=>r.capabilityIds?.includes(id));
  need(id,linked.length===0||linked.some(r=>r.required),linked.map(r=>r.id),[],'declared-capability');
 }
 for(const c of content.acceptanceCriteria)need(verifiers[c.evidenceKind],c.required,c.requirementIds,[c.id],'acceptance-verifier');
 const routingOptions={...options,now:options.now??new Date()};
 const capabilities=[...needs.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(n=>({...n,route:routeCapability(n.id,input.modelBudget,routingOptions)}));
 const coverage=content.requirements.map(r=>({requirementId:r.id,required:r.required,capabilityIds:r.capabilityIds??[],
  criterionIds:content.acceptanceCriteria.filter(c=>c.requirementIds.includes(r.id)).map(c=>c.id),
  status:r.capabilityIds?.length?'mapped':'unmapped'}));
 const routingBlockers=[
  ...coverage.filter(r=>r.required&&r.status==='unmapped').map(r=>({code:'REQUIREMENT_CAPABILITY_UNMAPPED',requirementId:r.requirementId})),
  ...capabilities.filter(n=>n.required&&n.route.status==='blocked').map(n=>({code:n.route.reason,capabilityId:n.id}))
 ];
 return {plannerVersion:'3' as const,mode:'capability-first' as const,goal:content.goal,costPolicy:'ZERO_ONLY' as const,
  executionEnabled:false as const,permissions:[],status:'blocked' as const,
  routingStatus:routingBlockers.length?'blocked' as const:'covered' as const,
  contract,capabilities,coverage,routingBlockers,
  blockers:[...routingBlockers,{code:'EXECUTION_ENVELOPE_REQUIRED'}],
  // P0.3 must build the ordered envelope, including sourceStepKey bindings.
  // An empty graph cannot be mistaken for a legacy executable plan.
  steps:[],executionPlanRequired:true};
}
export type CapabilityPlan=ReturnType<typeof buildCapabilityPlan>;
