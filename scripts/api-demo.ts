import { randomBytes } from 'node:crypto';
import { createEmbeddedDatabase } from './lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { handleCoreRequest } from '../packages/core/src/api/index';
const db=await createEmbeddedDatabase();const token=randomBytes(32).toString('hex');
const origin='http://127.0.0.1:3000';
async function call(method:string,path:string,body?:unknown) {
 const request=new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,...(body === undefined ? {} : {'Content-Type':'application/json'})},body:body === undefined ? undefined : JSON.stringify(body)});
 const response=await handleCoreRequest(request,{token,origin,database:()=>db});const result=await response.json();
 if (!response.ok) throw new Error(`Demo command failed: ${result.error.code}`);return result.data;
}
try {
 await migrate(db);
 const project=await call('POST','/projects',{name:'Core API demonstration'});
 const automation=await call('POST',`/projects/${project.id}/automations`,{name:'A stored recipe',definition:{purpose:'state-only demonstration'}});
 const input={automationId:automation.id,idempotencyKey:'demo-request-1'};
 const run=await call('POST',`/projects/${project.id}/runs`,input);
 const replay=await call('POST',`/projects/${project.id}/runs`,input);
 const cancelled=await call('POST',`/runs/${run.id}/commands`,{action:'cancel',expectedVersion:run.version});
 const events=await call('GET',`/projects/${project.id}/events`);
 console.log(JSON.stringify({mode:'local-api-demo',projectId:project.id,runId:run.id,duplicateRequestReusedRun:run.id === replay.id,status:cancelled.status,eventCount:events.items.length,executionEnabled:false},null,2));
} finally {await db.close();}
