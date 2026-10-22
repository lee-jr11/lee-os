import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { createStateStore, createId, StateConflict, checkDatabase, type StateDatabase } from '../../packages/database/src/index';
import { migrate, readMigrations } from '../../packages/database/src/migrations';
export async function exerciseState(db: StateDatabase, t: TestContext) {
 const store = createStateStore(db);
 await t.test('migrations are repeatable and checksum-protected', async () => {
  assert.equal((await checkDatabase(db)).status,'migration-required');
  assert.deepEqual(await migrate(db),['001_state.sql','002_plans.sql','003_preparations.sql','004_agent_assignments.sql','005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_transient_retries.sql']);
  assert.equal((await checkDatabase(db)).status,'ready');
  assert.deepEqual(await migrate(db),[]);
  const files = await readMigrations();
  await assert.rejects(migrate(db,[{ ...files[0], sql: files[0].sql + '\n-- changed' }]),/history differs/);
  await assert.rejects(migrate(db,[...files,{ name: '012_bad.sql', sql: 'CREATE TABLE never_committed (id int); SELECT * FROM table_that_does_not_exist;' }]));
  assert.equal((await db.query<{ value: string | null }>("SELECT to_regclass('never_committed')::text AS value")).rows[0].value,null);
  assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length,18);
 });
 await t.test('permanent IDs survive rename; names are parameterized data', async () => {
  const project = await store.createProject('Original');
  const name = "Lee'; DROP TABLE projects; --";
  const renamed = await store.renameProject(project.id,name);
  assert.equal(renamed.id,project.id); assert.equal(renamed.name,name);
  await assert.rejects(db.query('UPDATE projects SET id=$2 WHERE id=$1',[project.id,createId('project')]),/permanent/);
  assert.equal((await store.getProject(project.id))?.name,name);
 });
 await t.test('state and history roll back together when event writing fails', async () => {
  const project = await store.createProject('Keep this name');
  const before = (await store.listEvents(project.id)).length;
  await db.exec(`CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN IF NEW.kind='project.renamed' AND NEW.payload->>'name'='reject-me' THEN RAISE EXCEPTION 'Test event rejection'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_test_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_test_event();`);
  try { await assert.rejects(store.renameProject(project.id,'reject-me'),/Test event rejection/); }
  finally { await db.exec('DROP TRIGGER reject_test_event ON events; DROP FUNCTION reject_test_event();'); }
  assert.equal((await store.getProject(project.id))?.name,'Keep this name');
  assert.equal((await store.listEvents(project.id)).length,before);
 });
 await t.test('run requests deduplicate and keep the original automation snapshot', async () => {
  const project = await store.createProject('Snapshots');
  const automation = await store.createAutomation(project.id,'A definition',{ revision: 'first' });
  const request = { automationId: automation.id, idempotencyKey: 'manual-request-1' };
  const [a,b] = await Promise.all([store.createRun(project.id,request),store.createRun(project.id,request)]);
  assert.equal(a.id,b.id);
  await store.reviseAutomation(automation.id,1,{ revision: 'second' });
  await assert.rejects(store.reviseAutomation(automation.id,1,{ revision: 'stale' }),StateConflict);
  assert.deepEqual((await store.getRun(a.id))?.definition_snapshot,{ revision: 'first' });
  assert.equal((await store.createRun(project.id,request)).id,a.id);
  const other = await store.createAutomation(project.id,'Other');
  await assert.rejects(store.createRun(project.id,{ ...request, automationId: other.id }),/different request/);
  assert.equal((await store.listEvents(project.id)).filter(e => e.kind === 'run.created').length,1);
 });
 await t.test('retired definitions block new runs while retaining replay and active history', async () => {
  const project=await store.createProject('Lifecycle guard'), other=await store.createProject('Unaffected');
  const automation=await store.createAutomation(project.id,'Retained',{original:true});
  const request={automationId:automation.id,idempotencyKey:'before-retirement'};
  const run=await store.createRun(project.id,request),job=await store.createJob(run.id,'finish-existing');
  await store.transitionRun(run.id,0,'running');const attempt=await store.startJob(job.id);
  for(const status of ['paused','archived']){
   await db.query('UPDATE automations SET status=$2 WHERE id=$1',[automation.id,status]);
   await assert.rejects(store.createRun(project.id,{automationId:automation.id}),StateConflict);
   assert.equal((await store.createRun(project.id,request)).id,run.id);
  }
  await db.query("UPDATE projects SET status='archived' WHERE id=$1",[project.id]);
  await assert.rejects(store.createRun(project.id),StateConflict);
  await assert.rejects(store.createAutomation(project.id,'Forbidden'),StateConflict);
  assert.equal((await store.createRun(project.id,request)).id,run.id);
  await assert.rejects(store.createRun(project.id,{...request,automationId:undefined}),/different request/);
  await store.completeJob(job.id,0,attempt.attempt_count);await store.transitionRun(run.id,1,'succeeded');
  assert.deepEqual((await store.getRun(run.id))?.definition_snapshot,{original:true});
  assert.equal((await store.listEvents(project.id)).filter(e=>e.kind==='run.created').length,1);
  assert.equal((await store.createRun(other.id)).project_id,other.id);
  await assert.rejects(db.query('DELETE FROM automations WHERE id=$1',[automation.id]));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE contype='f' AND connamespace=current_schema()::regnamespace AND confdeltype='c'")).rows[0].n,0);
 });
 await t.test('competing run updates cannot both win', async () => {
  const project = await store.createProject('Race'); const run = await store.createRun(project.id);
  const outcomes = await Promise.allSettled([store.transitionRun(run.id,0,'running'),store.transitionRun(run.id,0,'running')]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(outcomes.filter(r => r.status === 'rejected').length,1);
  assert.equal((await store.getRun(run.id))?.version,1);
 });
 await t.test('interrupted jobs retain checkpoints and fence out stale workers', async () => {
  const project = await store.createProject('Recovery'); const run = await store.createRun(project.id);
  const job = await store.createJob(run.id,'step-1');
  await assert.rejects(store.startJob(job.id),StateConflict);
  let current = await store.transitionRun(run.id,0,'running');
  const first = await store.startJob(job.id);
  const checkpoint = await store.saveCheckpoint(job.id,0,first.attempt_count,{ step: 1, artifact: 'reference-only' });
  await assert.rejects(store.saveCheckpoint(job.id,0,first.attempt_count,{ step: 99 }),StateConflict);
  current = await store.transitionRun(run.id,current.version,'interrupted','Worker process lost');
  assert.equal((await store.getJob(job.id))?.status,'interrupted');
  assert.deepEqual((await store.getJob(job.id))?.checkpoint,checkpoint.checkpoint);
  await assert.rejects(store.saveCheckpoint(job.id,1,first.attempt_count,{ step: 99 }),StateConflict);
  current = await store.transitionRun(run.id,current.version,'queued');
  current = await store.transitionRun(run.id,current.version,'running');
  const resumed = await store.startJob(job.id); assert.equal(resumed.attempt_count,2);
  await assert.rejects(store.saveCheckpoint(job.id,1,first.attempt_count,{ step: 99 }),StateConflict);
  await assert.rejects(store.completeJob(job.id,1,first.attempt_count),StateConflict);
  const saved = await store.saveCheckpoint(job.id,1,resumed.attempt_count,{ step: 2 });
  await assert.rejects(store.transitionRun(run.id,current.version,'succeeded'),/unfinished jobs/);
  await store.completeJob(job.id,saved.checkpoint_version,resumed.attempt_count);
  current = await store.transitionRun(run.id,current.version,'succeeded');
  await assert.rejects(store.transitionRun(run.id,current.version,'running'),StateConflict);
  assert.equal((await store.getJob(job.id))?.id,job.id);
 });
 await t.test('foreign keys, IDs, zero-only policy, and event immutability are enforced', async () => {
  const first = await store.createProject('First'); const second = await store.createProject('Second');
  const run = await store.createRun(first.id);
  await assert.rejects(store.createAutomation(createId('project'),'Orphan'));
  await assert.rejects(db.query('INSERT INTO projects (id,name) VALUES ($1,$2)',['bad-id','Invalid']));
  await assert.rejects(db.query('INSERT INTO automations (id,project_id,name,cost_policy) VALUES ($1,$2,$3,$4)',[createId('automation'),first.id,'Paid','PAID']));
  await assert.rejects(db.query('INSERT INTO events (id,project_id,run_id,kind,entity_id) VALUES ($1,$2,$3,$4,$5)',[createId('event'),second.id,run.id,'test',run.id]));
  await assert.rejects(db.query('UPDATE events SET kind=$2 WHERE project_id=$1',[first.id,'altered']),/append-only/);
  await assert.rejects(db.query('DELETE FROM events WHERE project_id=$1',[first.id]),/append-only/);
  await assert.rejects(db.query('UPDATE system_settings SET value=$1::jsonb WHERE key=$2',['"PAID"','cost_policy']));
  // Observed charges must still be recordable for an honest audit.
  await db.query('INSERT INTO model_usage (id,run_id,provider_id,model_id,cost_usd) VALUES ($1,$2,$3,$4,$5)',[createId('usage'),run.id,'test','test',1]);
 });
 await t.test('failed and cancelled runs terminate unfinished jobs', async () => {
  for (const status of ['failed','cancelled'] as const) {
   const project = await store.createProject(status); const run = await store.createRun(project.id);
   const job = await store.createJob(run.id,'step');
   const running = await store.transitionRun(run.id,0,'running');
   await store.transitionRun(run.id,running.version,status);
   assert.equal((await store.getJob(job.id))?.status,status);
   await assert.rejects(store.startJob(job.id),StateConflict);
  }
 });
 return store;
}
