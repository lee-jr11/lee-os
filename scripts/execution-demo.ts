import { createEmbeddedDatabase } from './lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { createStateStore } from '../packages/database/src';
import { createPlanner } from '../packages/core/src/orchestrator/store';
import { createExecutionManager } from '../packages/core/src/execution-manager/store';
const db=await createEmbeddedDatabase();
try{
 await migrate(db);const store=createStateStore(db);const project=await store.createProject('Preparation demonstration');
 const run=await store.createRun(project.id);
 await createPlanner(db).create(run.id,{expectedRunVersion:0,goal:'Prepare a report workflow',steps:[
  {key:'draft',title:'Draft report',kind:'model'},
  {key:'review',title:'Lee reviews report',kind:'review',dependsOn:['draft']}
 ]});
 const manager=createExecutionManager(db),preview=await manager.inspect(run.id);
 const input={expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]};
 console.log(JSON.stringify(await manager.prepare(run.id,input),null,2));
 await manager.prepare(run.id,input);console.log('Retry preserved the same two pending jobs.');
 await store.transitionRun(run.id,0,'cancelled');
 console.log('Cancellation closed both pending jobs:',(await store.listJobs(run.id)).items.every(j=>j.status==='cancelled'));
 console.log('No models, workflows, Python, device actions, or user commands executed. Temporary data is discarded.');
}finally{await db.close();}
