import { modelRequest, routeModel, type RoutingOptions } from '../model-router';
import { z } from 'zod';
import { routeTask } from '../task-router';
export const planInput = z.strictObject({
 expectedRunVersion: z.number().int().min(0).max(2147483646),
 goal: z.string().trim().min(1).max(4000),
 steps: z.array(z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  title: z.string().trim().min(1).max(200),
  kind: z.string().trim().min(1).max(80),
  model: modelRequest.optional(),
  dependsOn: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).max(50).default([])
 })).min(1).max(50)
}).superRefine((input,ctx) => {
 const keys=new Set(input.steps.map(s=>s.key));
 if(keys.size!==input.steps.length) ctx.addIssue({code:'custom',message:'Duplicate step keys.'});
 for(const step of input.steps) {
  if(step.kind!=='model' && step.model)ctx.addIssue({code:'custom',message:'Model requirements only apply to model steps.'});
  if(new Set(step.dependsOn).size!==step.dependsOn.length || step.dependsOn.some(k=>!keys.has(k) || k===step.key))
   ctx.addIssue({code:'custom',message:'Invalid dependencies.'});
 }
 const done=new Set<string>();
 for(let i=0;i<input.steps.length;i++) for(const step of input.steps)
  if(step.dependsOn.every(k=>done.has(k))) done.add(step.key);
 if(done.size!==keys.size)ctx.addIssue({code:'custom',message:'Cyclic dependencies.'});
});
export type PlanInput = z.infer<typeof planInput>;
// Stable topological ordering preserves input order among equally eligible steps.
export function buildPlan(value: unknown,options: RoutingOptions={}) {
 const routingOptions={...options,now:options.now ?? new Date()};
 const input=planInput.parse(value); const done=new Set<string>(); const ordered=[];
 while(done.size<input.steps.length) {
  const step=input.steps.find(s=>!done.has(s.key) && s.dependsOn.every(k=>done.has(k)))!;
  const route=routeTask(step.kind);
  const modelDecision=step.kind==='model' && step.model ? routeModel(step.model,routingOptions) : undefined;
  const reason=step.kind==='model' ? modelDecision?.status==='selected'
   ? 'Model selected for planning only; live execution is disabled.'
   : modelDecision ? 'No eligible model; inspect modelDecision for rejection reasons.'
   : 'Supply model capability and token requirements before selection.' : route.reason;
  done.add(step.key); ordered.push({...step,route:{...route,reason},...(modelDecision?{modelDecision}:{})});
 }
 return { plannerVersion:'2', goal:input.goal, costPolicy:'ZERO_ONLY', executionEnabled:false,
  status:'blocked', steps:ordered, blockers:ordered.map(s=>({stepKey:s.key,reason:s.route.reason})) };
}
