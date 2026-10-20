import { loadEnvFile } from 'node:process';
import { mkdir, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPostgresDatabase, createStateStore, checkDatabase } from '../packages/database/src/index';
import { migrate } from '../packages/database/src/migrations';
import { createEmbeddedDatabase } from './lib/embedded-database';
try { loadEnvFile('.env'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const command = process.argv[2];
if (command === 'demo') {
 await mkdir('.leeos', { recursive: true });
 const lockPath = resolve('.leeos/demo.lock');
 const lock = await open(lockPath,'wx').catch(() => { throw new Error('Demo is already open, or a stale .leeos/demo.lock remains. Close the other demo before removing a stale lock.'); });
 try {
  const db = await createEmbeddedDatabase(resolve('.leeos/demo'));
  try {
   await migrate(db); const store = createStateStore(db);
   const project = await store.createProject('State layer demonstration');
   const renamed = await store.renameProject(project.id,'LeeOS state demonstration');
   const run = await store.createRun(project.id);
   const job = await store.createJob(run.id,'verify-record');
   const running = await store.transitionRun(run.id,run.version,'running');
   const started = await store.startJob(job.id);
   const saved = await store.saveCheckpoint(job.id,0,started.attempt_count,{ verified: true });
   await store.completeJob(job.id,saved.checkpoint_version,started.attempt_count);
   const completed = await store.transitionRun(run.id,running.version,'succeeded');
   console.log(JSON.stringify({ mode: 'embedded-demo', directory: '.leeos/demo', projectId: project.id, renamedWithoutChangingId: renamed.id === project.id, runId: run.id, status: completed.status, eventCount: (await store.listEvents(project.id)).length },null,2));
  } finally { await db.close(); }
 } finally { await lock.close(); await unlink(lockPath); }
} else if (command === 'migrate' || command === 'status') {
 const url = process.env.DATABASE_URL;
 if (!url || url.includes('REPLACE_WITH')) throw new Error('Set DATABASE_URL in the ignored root .env first.');
 const db = createPostgresDatabase(url);
 try { if (command === 'migrate') console.log({ applied: await migrate(db) }); else { const status = await checkDatabase(db); console.log(status); if (status.status !== 'ready') process.exitCode = 1; } }
 catch { console.error('Database command failed. Check the connection, migrations, and database permissions. No credentials logged.'); process.exitCode = 1; }
 finally { await db.close(); }
} else { throw new Error('Use migrate, status, or demo.'); }
