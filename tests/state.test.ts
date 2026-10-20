import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { exerciseState } from './helpers/state-contract';
import { createStateStore } from '../packages/database/src/index';
import { migrate } from '../packages/database/src/migrations';
test('PostgreSQL state contract and portable snapshot restore', { timeout: 120000 }, async t => {
 const testRoot = resolve('.leeos/tests');
 await mkdir(testRoot,{ recursive: true });
 const directory = await mkdtemp(join(testRoot,'leeos-state-'));
 let db = await createEmbeddedDatabase(directory);
 try {
  const store = await exerciseState(db,t);
  const project = await store.createProject('Persistence');
  const run = await store.createRun(project.id);
  const job = await store.createJob(run.id,'durable-step');
  await store.transitionRun(run.id,0,'running'); const attempt = await store.startJob(job.id);
  await store.saveCheckpoint(job.id,0,attempt.attempt_count,{ savedBeforeClose: true });
  await db.close(); db = await createEmbeddedDatabase(directory);
  await t.test('IDs, state, checkpoints, and events survive closing the engine', async () => {
   assert.deepEqual(await migrate(db),[]);
   const reopened = createStateStore(db);
   assert.equal((await reopened.getProject(project.id))?.name,'Persistence');
   assert.equal((await reopened.getRun(run.id))?.status,'running');
   assert.deepEqual((await reopened.getJob(job.id))?.checkpoint,{ savedBeforeClose: true });
   assert.equal((await reopened.listEvents(project.id)).length,6);
  });
 } finally {
  await db.close();
  const absolute = resolve(directory); const tempRoot = testRoot + sep;
  if (!absolute.startsWith(tempRoot) || !absolute.split(sep).at(-1)?.startsWith('leeos-state-')) throw new Error('Refusing cleanup outside test directory.');
  await rm(absolute,{ recursive: true, force: true });
 }
});
