export const plannedExecutorIds = ['github-actions', 'n8n', 'python', 'lee360'] as const;
export interface JobBlueprint {
 stepKey: string; title: string; kind: string; dependsOn: string[];
 candidateExecutorIds: string[]; destination: string; executionEnabled: false;
 permissions: []; mode: 'prepare-only'; blockedReason: string;
}
export interface ExecutorAdapter {
 readonly id: string; readonly enabled: boolean;
 // Metadata preparation only. This interface deliberately exposes no launch method.
 prepare(step: {key:string;title:string;kind:string;dependsOn:readonly string[]}): JobBlueprint;
}
export function getExecutorCatalog() {
 return {executionEnabled:false,mode:'prepare-only',executors:plannedExecutorIds.map(id=>({id,enabled:false,configured:false,permissions:[]}))};
}
// Only copies metadata; never interprets a title as code or contacts a destination.
export const localPreparationAdapter: ExecutorAdapter = {
 id:'local-preparation',enabled:true,
 prepare(step) {
  let destination='unassigned';let candidates:string[]=[];
  switch(step.kind) {
   case 'model':destination='model-provider';break;
   case 'review':destination='owner';break;
   case 'workflow':destination='workflow';candidates=['github-actions','n8n'];break;
   case 'python':destination='python';candidates=['python'];break;
   case 'device':destination='lee360';candidates=['lee360'];break;
  }
  return {stepKey:step.key,title:step.title,kind:step.kind,dependsOn:[...step.dependsOn],
   candidateExecutorIds:candidates,destination,executionEnabled:false,permissions:[],mode:'prepare-only',
   blockedReason:destination==='unassigned'?'UNSUPPORTED_CAPABILITY':'EXECUTION_DISABLED'};
 }
};
