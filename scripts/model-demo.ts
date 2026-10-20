import { routeModel, getProviderCatalog } from '../packages/core/src/model-router';
import { buildPlan } from '../packages/core/src/orchestrator';
import { syntheticRegistry } from './lib/synthetic-provider';
const now=new Date();const request={capabilities:['text'],inputTokens:1000,outputTokens:500};
console.log('REAL DEFAULT CATALOG: unconfigured; no current pricing assumptions.');
console.log(JSON.stringify(getProviderCatalog(),null,2));
console.log(JSON.stringify(routeModel(request,{now}),null,2));
console.log('FICTIONAL DEMO ONLY: illustrates selection, not actual provider availability or free access.');
console.log(JSON.stringify(buildPlan({expectedRunVersion:0,goal:'Demonstrate a model choice',steps:[
 {key:'draft',title:'Draft a report',kind:'model',model:request}
 ]},{registry:syntheticRegistry(now),now}),null,2));
console.log('No network calls, API keys, quota reservations, or execution.');
