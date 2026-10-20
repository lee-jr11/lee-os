import { createEmbeddedDatabase } from './lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { createStateStore } from '../packages/database/src';
import { createPlanner } from '../packages/core/src/orchestrator/store';
import { createExecutionManager } from '../packages/core/src/execution-manager/store';
import { createAgentManager } from '../packages/core/src/agent-manager/store';
const db=await createEmbeddedDatabase();
try{
 await migrate(db);const store=createStateStore(db),agents=createAgentManager(db);
 const project=await store.createProject('Agent assignment demonstration'),run=await store.createRun(project.id);
 await createPlanner(db).create(run.id,{expectedRunVersion:0,goal:'Draft and review',steps:[
  {key:'draft',title:'Draft report',kind:'model'},
  {key:'review',title:'Owner reviews report',kind:'review',dependsOn:['draft']}
 ]});
 const execution=createExecutionManager(db),preview=await execution.inspect(run.id);
 await execution.prepare(run.id,{expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
 const role=await agents.registerRole({name:'Writing assistant',purpose:'Prepare a draft for Lee to review.',stepKinds:['model'],permissions:[],idempotencyKey:'demo-writer'});
 const job=(await store.listJobs(run.id)).items.find(j=>j.step_key==='draft')!;
 const input={roleId:role.id,expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,mode:'assignment-only',permissions:[]};
 console.log(JSON.stringify(await agents.assign(run.id,job.id,input),null,2));
 await agents.assign(run.id,job.id,input);console.log('Retry kept the same assignment. Human review remains with Lee.');
 await store.transitionRun(run.id,0,'cancelled');console.log('Run cancelled. Current team:',JSON.stringify(await agents.list(run.id),null,2));
 console.log('No agent process, model call, tool access, or spending. Temporary demonstration data is discarded.');
}finally{await db.close();}
