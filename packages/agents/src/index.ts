import { z } from 'zod';
export const agentStepKind = z.enum(['model','workflow','python','device']);
export const roleDefinition = z.strictObject({
 name:z.string().trim().min(1).max(200),purpose:z.string().trim().min(1).max(4000),
 stepKinds:z.array(agentStepKind).min(1).max(4).refine(k=>new Set(k).size===k.length),
 permissions:z.array(z.never()).length(0)
});
export type AgentDefinition = z.infer<typeof roleDefinition> & {id:string};
export const roleRegistration = roleDefinition.extend({
 idempotencyKey:z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/)
});
// Templates are descriptive metadata, not registered roles or active agents.
export function getAgentCatalog(){
 return {catalogVersion:'1',mode:'assignment-only',executionEnabled:false,templates:[
  {templateId:'writer',name:'Writing assistant',purpose:'Prepare draft content for owner review.',stepKinds:['model'],permissions:[]},
  {templateId:'quality-reviewer',name:'Quality reviewer',purpose:'Check generated content before a separate human review step.',stepKinds:['model'],permissions:[]},
  {templateId:'workflow-coordinator',name:'Workflow coordinator',purpose:'Coordinate a future controlled workflow job.',stepKinds:['workflow'],permissions:[]}
 ]};
}
