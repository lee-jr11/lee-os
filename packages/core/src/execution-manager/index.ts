import { createHash } from 'node:crypto';
import { z } from 'zod';
import { localPreparationAdapter } from '@leeos/executors';
import { planInput } from '../orchestrator';
import { StateConflict } from '@leeos/database';
export const prepareRequest = z.strictObject({
 expectedRunVersion:z.number().int().min(0).max(2147483646),
 reviewedPlanDigest:z.string().regex(/^[0-9a-f]{64}$/),
 acknowledgePlanReview:z.literal(true), mode:z.literal('prepare-only'),
 permissions:z.array(z.never()).length(0)
});
// Sort object keys while preserving array order: JSONB property order is not a fingerprint.
function canonical(value: unknown): string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function planDigest(runId:string,runVersion:number,plan:unknown) {
 return createHash('sha256').update(canonical({runId,runVersion,plan})).digest('hex');
}
const snapshot=z.object({plannerVersion:z.enum(['1','2']),goal:z.string(),costPolicy:z.literal('ZERO_ONLY'),executionEnabled:z.literal(false),
 status:z.literal('blocked'),steps:z.array(z.object({key:z.string(),title:z.string(),kind:z.string(),dependsOn:z.array(z.string())})).min(1).max(50)});
export function prepareBlueprint(plan:unknown,runVersion:number) {
 const saved=snapshot.safeParse(plan);
 if(!saved.success)throw new StateConflict('Unsupported saved plan.');
 const graph=planInput.safeParse({expectedRunVersion:runVersion,goal:saved.data.goal,steps:saved.data.steps});
 if(!graph.success)throw new StateConflict('Invalid saved dependency graph.');
 const done=new Set<string>();
 for(const step of graph.data.steps){
  if(!step.dependsOn.every(key=>done.has(key)))throw new StateConflict('Saved plan order is invalid.');
  done.add(step.key);
 }
 return graph.data.steps.map(step=>localPreparationAdapter.prepare(step));
}
