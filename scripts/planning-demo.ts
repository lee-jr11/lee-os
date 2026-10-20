import { createEmbeddedDatabase } from './lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { createStateStore } from '../packages/database/src';
import { createPlanner } from '../packages/core/src/orchestrator/store';
const db=await createEmbeddedDatabase();
try {
 await migrate(db);const store=createStateStore(db);
 const project=await store.createProject('Planning demonstration');const run=await store.createRun(project.id);
 console.log(JSON.stringify(await createPlanner(db).create(run.id,{expectedRunVersion:0,goal:'Prepare and review a report',steps:[
  {key:'draft',title:'Draft the report',kind:'model'},
  {key:'review',title:'Lee reviews the report',kind:'review',dependsOn:['draft']}
 ]}),null,2));
 console.log('No model called. No jobs dispatched. Demonstration data is discarded.');
}finally{await db.close();}
