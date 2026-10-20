import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createStateStore,createId,type StateDatabase } from '../../packages/database/src';
import { createPlanner } from '../../packages/core/src/orchestrator/store';
import { createExecutionManager } from '../../packages/core/src/execution-manager/store';
import { createAgentManager } from '../../packages/core/src/agent-manager/store';
import { handleCoreRequest } from '../../packages/core/src/api/http';
export async function exerciseAgents(db:StateDatabase,t:TestContext){
 const store=createStateStore(db),agents=createAgentManager(db),execution=createExecutionManager(db);
 const project=await store.createProject('Agent contract');
 const registration={name:'Writer',purpose:'Draft for owner review',stepKinds:['model'],permissions:[],idempotencyKey:'writer-'+randomUUID()};
 const writer=await agents.registerRole(registration);
 async function fixture(){
  const run=await store.createRun(project.id);
  await createPlanner(db).create(run.id,{expectedRunVersion:0,goal:'Write and review',steps:[
   {key:'draft',title:'Draft report',kind:'model'},
   {key:'check',title:'Check report',kind:'model',dependsOn:['draft']},
   {key:'review',title:'Owner review',kind:'review',dependsOn:['check']}
  ]});
  const preview=await execution.inspect(run.id);
  await execution.prepare(run.id,{expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,acknowledgePlanReview:true,mode:'prepare-only',permissions:[]});
  const jobs=(await store.listJobs(run.id)).items;
  const job=jobs.find(j=>j.step_key==='draft')!,review=jobs.find(j=>j.step_key==='review')!;
  const input={roleId:writer.id,expectedRunVersion:0,reviewedPlanDigest:preview.planDigest,mode:'assignment-only',permissions:[]};
  return {run,job,review,jobs,input};
 }
 await t.test('role registration is immutable, deduplicated, paginated and separately audited',async()=>{
  const [a,b]=await Promise.all([agents.registerRole(registration),agents.registerRole(registration)]);
  assert.deepEqual(a,b);assert.deepEqual(a,writer);assert.equal(a.version,1);
  assert.deepEqual((a.definition as {permissions:unknown[]}).permissions,[]);
  assert.equal((await db.query("SELECT * FROM events WHERE entity_id=$1 AND kind='agent-role.registered'",[writer.id])).rows.length,1);
  await assert.rejects(agents.registerRole({...registration,purpose:'Changed'}));
  const second=await agents.registerRole({...registration,idempotencyKey:'second-'+randomUUID(),name:'Second writer'});
  assert.notEqual(second.id,writer.id);
  const first=await agents.listRoles(null,1);assert.equal(first.items.length,1);assert.ok(first.nextCursor);
  const next=await agents.listRoles(first.nextCursor,1);assert.ok(String(next.items[0].id)>first.nextCursor!);
  assert.deepEqual(await agents.getRole(String(writer.id)),writer);
  await assert.rejects(db.query('UPDATE agent_roles SET definition=definition WHERE id=$1',[writer.id]),/immutable/);
 });
 await t.test('one role is bound to one prepared job with zero permissions; identical races replay once',async()=>{
  const {run,job,input}=await fixture();
  const [a,b]=await Promise.all([agents.assign(run.id,job.id,input),agents.assign(run.id,job.id,input)]);assert.deepEqual(a,b);
  const assignment=a.assignment as {id:string;roleSnapshot:unknown;jobId:string;executionEnabled:boolean;permissions:unknown[]};
  assert.equal(assignment.jobId,job.id);assert.equal(assignment.executionEnabled,false);assert.deepEqual(assignment.permissions,[]);
  assert.deepEqual(assignment.roleSnapshot,writer.definition);
  const current=await agents.get(assignment.id);assert.equal(current.currentStatus,'planned');assert.equal(current.version,0);
  assert.equal((await agents.list(run.id)).items.length,1);assert.equal((await store.getRun(run.id))?.version,0);
  assert.equal((await store.getJob(job.id))?.attempt_count,0);
  assert.equal((await store.listEvents(project.id)).filter(e=>e.run_id===run.id&&e.kind==='agent.assigned').length,1);
  await assert.rejects(agents.assign(run.id,job.id,{...input,expectedRunVersion:1}));
  await assert.rejects(db.query('UPDATE agent_assignments SET request=request WHERE agent_id=$1',[assignment.id]),/immutable/);
  for(const [sql,value] of [["UPDATE agents SET status=$2 WHERE id=$1",'working'],["UPDATE agents SET permissions=$2 WHERE id=$1",'["network"]'],["UPDATE agents SET model_id=$2 WHERE id=$1",'unreviewed-model']])
   await assert.rejects(db.query(sql,[assignment.id,value]));
 });
 await t.test('cross-run scope, stale reviews, wrong roles and human-review steps are rejected',async()=>{
  const a=await fixture(),b=await fixture();
  await assert.rejects(agents.assign(b.run.id,a.job.id,a.input),/Prepared job not found/);
  await assert.rejects(agents.assign(a.run.id,a.job.id,{...a.input,reviewedPlanDigest:'0'.repeat(64)}));
  await assert.rejects(agents.assign(a.run.id,a.job.id,{...a.input,expectedRunVersion:1}));
  await assert.rejects(agents.assign(a.run.id,a.job.id,{...a.input,roleId:createId('role')}),/Role not found/);
  const workflow=await agents.registerRole({...registration,idempotencyKey:'workflow-'+randomUUID(),name:'Workflow role',stepKinds:['workflow']});
  await assert.rejects(agents.assign(a.run.id,a.job.id,{...a.input,roleId:workflow.id}),/Role does not support/);
  await assert.rejects(agents.assign(a.run.id,a.review.id,a.input),/Human review/);
  const raw=await store.createRun(project.id),rawJob=await store.createJob(raw.id,'unprepared');
  await assert.rejects(agents.assign(raw.id,rawJob.id,a.input),/Prepared job not found/);
  await store.transitionRun(a.run.id,0,'cancelled');await assert.rejects(agents.assign(a.run.id,a.job.id,a.input));
  assert.equal((await agents.list(a.run.id)).items.length,0);
 });
 await t.test('registration and assignment roll back when their history cannot be written',async()=>{
  const f=await fixture();
  await db.exec(`CREATE FUNCTION reject_agent_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind IN ('agent.assigned','agent-role.registered') THEN RAISE EXCEPTION 'reject agent event'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_agent_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_agent_event();`);
  const failedKey='failed-'+randomUUID();
  try{
   await assert.rejects(agents.registerRole({...registration,idempotencyKey:failedKey}),/reject agent event/);
   await assert.rejects(agents.assign(f.run.id,f.job.id,f.input),/reject agent event/);
  }finally{await db.exec('DROP TRIGGER reject_agent_event ON events; DROP FUNCTION reject_agent_event();');}
  assert.equal((await db.query('SELECT * FROM agent_roles WHERE registration_key=$1',[failedKey])).rows.length,0);
  assert.equal((await db.query('SELECT * FROM agents WHERE run_id=$1',[f.run.id])).rows.length,0);
  assert.equal((await agents.list(f.run.id)).items.length,0);
  await agents.assign(f.run.id,f.job.id,f.input);
 });
 await t.test('owner dismissal fences stale commands and preserves historical assignment replay',async()=>{
  const f=await fixture(),saved=await agents.assign(f.run.id,f.job.id,f.input);
  const id=String((saved.assignment as {id:string}).id);
  const dismissed=await agents.dismiss(id,{action:'dismiss',expectedVersion:0});assert.equal(dismissed.currentStatus,'dismissed');assert.equal(dismissed.version,1);
  await assert.rejects(agents.dismiss(id,{action:'dismiss',expectedVersion:0}));
  assert.deepEqual(await agents.assign(f.run.id,f.job.id,f.input),saved);
  assert.equal((await agents.forJob(f.run.id,f.job.id)).currentStatus,'dismissed');
  await assert.rejects(db.query("UPDATE agents SET status='planned',version=version+1 WHERE id=$1",[id]),/cannot start or restart/);
  assert.equal((await store.getJob(f.job.id))?.status,'pending');
 });
 await t.test('cancellation dismisses agents atomically; failed dismissal history restores the entire run',async()=>{
  const f=await fixture(),saved=await agents.assign(f.run.id,f.job.id,f.input);const id=String((saved.assignment as {id:string}).id);
  await db.exec(`CREATE FUNCTION reject_dismiss_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='agent.dismissed' THEN RAISE EXCEPTION 'reject dismissal'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_dismiss_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_dismiss_event();`);
  try{await assert.rejects(store.transitionRun(f.run.id,0,'cancelled'),/reject dismissal/);}
  finally{await db.exec('DROP TRIGGER reject_dismiss_event ON events; DROP FUNCTION reject_dismiss_event();');}
  assert.equal((await store.getRun(f.run.id))?.status,'queued');assert.equal((await store.getJob(f.job.id))?.status,'pending');
  assert.equal((await agents.get(id)).currentStatus,'planned');
  await store.transitionRun(f.run.id,0,'cancelled');assert.equal((await agents.get(id)).currentStatus,'dismissed');
  assert.equal((await agents.get(id)).version,1);assert.deepEqual(await agents.assign(f.run.id,f.job.id,f.input),saved);
 });
 await t.test('assignment and dismissal races with cancellation leave no active scoped agents',async()=>{
  const f=await fixture();const outcomes=await Promise.allSettled([agents.assign(f.run.id,f.job.id,f.input),store.transitionRun(f.run.id,0,'cancelled')]);
  assert.equal(outcomes[1].status,'fulfilled');assert.ok((await agents.list(f.run.id)).items.every(a=>a.currentStatus==='dismissed'));
  const g=await fixture(),saved=await agents.assign(g.run.id,g.job.id,g.input),id=String((saved.assignment as {id:string}).id);
  await Promise.allSettled([agents.dismiss(id,{action:'dismiss',expectedVersion:0}),store.transitionRun(g.run.id,0,'cancelled')]);
  assert.equal((await agents.get(id)).version,1);assert.equal((await agents.get(id)).currentStatus,'dismissed');
  assert.equal((await store.listEvents(project.id)).filter(e=>e.entity_id===id&&e.kind==='agent.dismissed').length,1);
 });
 await t.test('database foreign keys reject cross-run agent/job mapping',async()=>{
  const a=await fixture(),b=await fixture();const agent=createId('agent');
  await db.query('INSERT INTO agents(id,run_id,role) VALUES($1,$2,$3)',[agent,a.run.id,'Fixture']);
  await assert.rejects(db.query('INSERT INTO agent_assignments(agent_id,run_id,job_id,role_id,request,assignment) VALUES($1,$2,$3,$4,$5,$6)',
   [agent,a.run.id,b.job.id,writer.id,'{}',JSON.stringify({mode:'assignment-only',executionEnabled:false,permissions:[]})]));
 });
 await t.test('owner API registers, assigns, reads and dismisses with bounded team pagination',async()=>{
  const f=await fixture(),token='a'.repeat(64),origin='http://127.0.0.1:3000';
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{token,origin,database:()=>db});
  const role=await call('POST','/agents/roles',{...registration,idempotencyKey:'http-'+randomUUID()});assert.equal(role.status,201);
  const roleData=(await role.json()).data;assert.equal((await call('GET','/agents/roles/'+roleData.id)).status,200);
  const path=`/runs/${f.run.id}/jobs/${f.job.id}/agent`;
  const assigned=await call('POST',path,{...f.input,roleId:roleData.id});assert.equal(assigned.status,201);
  const id=(await assigned.json()).data.assignment.id;
  assert.equal(assigned.headers.get('Location'),`/api/v1/agents/${id}`);
  assert.equal((await call('GET',path)).status,200);
  const second=f.jobs.find(j=>j.step_key==='check')!;await call('POST',`/runs/${f.run.id}/jobs/${second.id}/agent`,f.input);
  const page=(await (await call('GET',`/runs/${f.run.id}/agents?limit=1`)).json()).data;assert.equal(page.items.length,1);assert.ok(page.nextCursor);
  assert.equal((await call('GET',`/runs/${f.run.id}/agents?after=${page.nextCursor}&limit=1`)).status,200);
  assert.equal((await call('POST',`/agents/${id}/commands`,{action:'start',expectedVersion:0})).status,400);
  assert.equal((await call('POST',`/agents/${id}/commands`,{action:'dismiss',expectedVersion:0})).status,200);
  assert.equal((await (await call('GET',`/agents/${id}`)).json()).data.currentStatus,'dismissed');
 });
}
