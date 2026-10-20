import { createId } from './ids';
import type { StateDatabase, SqlSession, Row } from './types';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
export type Project = Row & { id: string; name: string; status: string };
export type Automation = Row & { id: string; project_id: string; definition_version: number; definition: Record<string, unknown> };
export type Run = Row & { id: string; project_id: string; automation_id: string | null; status: RunStatus; version: number; definition_snapshot: Record<string, unknown> };
export type Job = Row & { id: string; run_id: string; status: string; checkpoint: Record<string, unknown>; checkpoint_version: number; attempt_count: number };
export class StateConflict extends Error { constructor(message = 'State changed or operation is not allowed.') { super(message); this.name = 'StateConflict'; } }
// Serialize new-work decisions with status updates; this is not an archive command.
export async function projectAllowsNewWork(tx: SqlSession, id: string): Promise<boolean> {
 const row=(await tx.query('SELECT status FROM projects WHERE id=$1 FOR SHARE',[id])).rows[0];
 if(!row)throw new StateConflict('Project is unavailable.');
 return !['paused','completed','archived'].includes(String(row.status));
}
export async function requireProjectNewWork(tx: SqlSession, id: string) {
 if(!await projectAllowsNewWork(tx,id))throw new StateConflict('Paused, completed, or archived projects cannot create new work.');
}
const transitions: Record<RunStatus, readonly RunStatus[]> = {
 queued: ['running','cancelled'], running: ['succeeded','failed','cancelled','interrupted'],
 interrupted: ['queued','cancelled'], succeeded: [], failed: [], cancelled: []
};
function one<T>(rows: T[]): T { if (!rows[0]) throw new StateConflict(); return rows[0]; }
function object(value: Record<string, unknown>) {
 if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Expected a JSON object.');
 return JSON.stringify(value);
}
async function event(tx: SqlSession, projectId: string, runId: string | null, kind: string, entityId: string, payload: Record<string, unknown> = {}) {
 await tx.query('INSERT INTO events (id, project_id, run_id, kind, entity_id, payload) VALUES ($1,$2,$3,$4,$5,$6::jsonb)', [createId('event'), projectId, runId, kind, entityId, object(payload)]);
}
async function lockedRun(tx: SqlSession, id: string): Promise<Run> { return one((await tx.query<Run>('SELECT * FROM runs WHERE id=$1 FOR UPDATE', [id])).rows); }
async function jobRun(tx: SqlSession, jobId: string): Promise<Run> {
 const job = one((await tx.query<Job>('SELECT * FROM jobs WHERE id=$1', [jobId])).rows);
 const run = await lockedRun(tx, job.run_id);
 if((await tx.query('SELECT job_id FROM prepared_jobs WHERE job_id=$1',[jobId])).rows.length)throw new StateConflict('Prepared jobs require controlled execution.');
 if (run.status !== 'running') throw new StateConflict('Job changes require a running parent run.');
 return run;
}
function pageLimit(limit: number) { if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid page limit.'); return limit; }
function page<T extends Row & { id: string }>(rows: T[], limit: number) {
 const items = rows.slice(0,limit); return { items, nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}
export function createStateStore(db: StateDatabase) {
 return {
  async listProjects(after: string | null = null, limit = 25) {
   const rows = (await db.query<Project>('SELECT * FROM projects WHERE ($1::text IS NULL OR id>$1) ORDER BY id LIMIT $2',[after,pageLimit(limit)+1])).rows; return page(rows,limit);
  },
  async listAutomations(projectId: string, after: string | null = null, limit = 25) {
   const rows = (await db.query<Automation>('SELECT * FROM automations WHERE project_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3',[projectId,after,pageLimit(limit)+1])).rows; return page(rows,limit);
  },
  async getAutomation(id: string) { return (await db.query<Automation>('SELECT * FROM automations WHERE id=$1',[id])).rows[0] ?? null; },
  async listRuns(projectId: string, after: string | null = null, limit = 25) {
   const rows = (await db.query<Run>('SELECT * FROM runs WHERE project_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3',[projectId,after,pageLimit(limit)+1])).rows; return page(rows,limit);
  },
  async listJobs(runId: string, after: string | null = null, limit = 25) {
   const rows = (await db.query<Job>('SELECT * FROM jobs WHERE run_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3',[runId,after,pageLimit(limit)+1])).rows; return page(rows,limit);
  },
  async createProject(name: string, description = ''): Promise<Project> {
   return db.transaction(async tx => {
    const row = one((await tx.query<Project>('INSERT INTO projects (id,name,description) VALUES ($1,$2,$3) RETURNING *', [createId('project'), name, description])).rows);
    await event(tx, row.id, null, 'project.created', row.id); return row;
   });
  },
  async renameProject(id: string, name: string): Promise<Project> {
   return db.transaction(async tx => {
    const row = one((await tx.query<Project>('UPDATE projects SET name=$2 WHERE id=$1 RETURNING *', [id,name])).rows);
    await event(tx, id, null, 'project.renamed', id, { name }); return row;
   });
  },
  async getProject(id: string) { return (await db.query<Project>('SELECT * FROM projects WHERE id=$1', [id])).rows[0] ?? null; },
  async createAutomation(projectId: string, name: string, definition: Record<string, unknown> = {}): Promise<Automation> {
   return db.transaction(async tx => {
    await requireProjectNewWork(tx,projectId);
    const row = one((await tx.query<Automation>('INSERT INTO automations (id,project_id,name,definition) VALUES ($1,$2,$3,$4::jsonb) RETURNING *', [createId('automation'),projectId,name,object(definition)])).rows);
    await event(tx, projectId, null, 'automation.created', row.id); return row;
   });
  },
  async reviseAutomation(id: string, expectedVersion: number, definition: Record<string, unknown>): Promise<Automation> {
   return db.transaction(async tx => {
    const row = one((await tx.query<Automation>('UPDATE automations SET definition=$3::jsonb, definition_version=definition_version+1 WHERE id=$1 AND definition_version=$2 RETURNING *', [id,expectedVersion,object(definition)])).rows);
    await event(tx, row.project_id, null, 'automation.revised', row.id, { version: row.definition_version }); return row;
   });
  },
  async createRun(projectId: string, options: { automationId?: string; idempotencyKey?: string } = {}): Promise<Run> {
   return db.transaction(async tx => {
    const available=await projectAllowsNewWork(tx,projectId);
    if(options.idempotencyKey){
     const prior=(await tx.query<Run>('SELECT * FROM runs WHERE project_id=$1 AND idempotency_key=$2',[projectId,options.idempotencyKey])).rows[0];
     if(prior){
      if(prior.automation_id!==(options.automationId??null))throw new StateConflict('Idempotency key belongs to a different request.');
      return prior;
     }
    }
    if(!available)throw new StateConflict('Archived projects cannot create new work.');
    let automation: Automation | undefined;
    if (options.automationId) automation = one((await tx.query<Automation>('SELECT * FROM automations WHERE id=$1 AND project_id=$2 FOR SHARE', [options.automationId,projectId])).rows);
    if(automation && ['paused','archived'].includes(String(automation.status)))throw new StateConflict('Paused or archived automations cannot create a run.');
    const inserted = await tx.query<Run>(`INSERT INTO runs (id,project_id,automation_id,automation_version,definition_snapshot,idempotency_key)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (project_id,idempotency_key) DO NOTHING RETURNING *`,
     [createId('run'), projectId, automation?.id ?? null, automation?.definition_version ?? null, object(automation?.definition ?? {}), options.idempotencyKey ?? null]);
    if (!inserted.rows[0]) {
     const existing = one((await tx.query<Run>('SELECT * FROM runs WHERE project_id=$1 AND idempotency_key=$2', [projectId,options.idempotencyKey])).rows);
     if (existing.automation_id !== (options.automationId ?? null)) throw new StateConflict('Idempotency key belongs to a different request.');
     return existing;
    }
    const row = inserted.rows[0]; await event(tx, projectId, row.id, 'run.created', row.id); return row;
   });
  },
  async getRun(id: string) { return (await db.query<Run>('SELECT * FROM runs WHERE id=$1', [id])).rows[0] ?? null; },
  async transitionRun(id: string, expectedVersion: number, next: RunStatus, reason?: string): Promise<Run> {
   return db.transaction(async tx => {
    const previous = await lockedRun(tx,id);
    if (previous.version !== expectedVersion || !transitions[previous.status].includes(next)) throw new StateConflict();
    // A preparation receipt grants no launch permissions, even to internal workers.
    if (next === 'running' && (await tx.query('SELECT run_id FROM run_preparations WHERE run_id=$1',[id])).rows.length)
     throw new StateConflict('Preparation-only runs cannot start.');
    if (next === 'interrupted' && !reason?.trim()) throw new Error('An interruption requires a reason.');
    if (next === 'succeeded') {
     const unfinished = await tx.query('SELECT id FROM jobs WHERE run_id=$1 AND status<>$2 LIMIT 1', [id,'succeeded']);
     if (unfinished.rows.length) throw new StateConflict('A run cannot succeed with unfinished jobs.');
    }
    if (['interrupted','failed','cancelled'].includes(next)) {
     const states = next === 'interrupted' ? ['running'] : ['pending','running','interrupted'];
     const changed = await tx.query<Job>('UPDATE jobs SET status=$2 WHERE run_id=$1 AND status=ANY($3::text[]) RETURNING *', [id,next,states]);
     for (const job of changed.rows) await event(tx, previous.project_id, id, `job.${next}`, job.id);
    }
    if (['succeeded','failed','cancelled'].includes(next)) {
     const dismissed=await tx.query("UPDATE agents SET status='dismissed',version=version+1 WHERE run_id=$1 AND status='planned' AND EXISTS(SELECT 1 FROM agent_assignments WHERE agent_id=agents.id) RETURNING id",[id]);
     for(const agent of dismissed.rows)await event(tx,previous.project_id,id,'agent.dismissed',String(agent.id),{reason:`run.${next}`});
    }
    if (previous.status === 'interrupted' && next === 'queued') {
     const reset = await tx.query<Job>("UPDATE jobs SET status='pending' WHERE run_id=$1 AND status='interrupted' RETURNING *", [id]);
     for (const job of reset.rows) await event(tx, previous.project_id, id, 'job.requeued', job.id);
    }
    const row = one((await tx.query<Run>(`UPDATE runs SET status=$3, version=version+1,
     started_at=CASE WHEN $3='running' THEN COALESCE(started_at,now()) ELSE started_at END,
     finished_at=CASE WHEN $3 IN ('succeeded','failed','cancelled') THEN now() ELSE NULL END,
     interrupted_reason=CASE WHEN $3='interrupted' THEN $4 ELSE interrupted_reason END
     WHERE id=$1 AND version=$2 RETURNING *`, [id,expectedVersion,next,reason ?? null])).rows);
    await event(tx, row.project_id,id,`run.${next}`,id,{ previous: previous.status, reason: reason ?? null }); return row;
   });
  },
  async createJob(runId: string, stepKey: string): Promise<Job> {
   return db.transaction(async tx => {
    const run = await lockedRun(tx,runId);
    if (!['queued','running'].includes(run.status)) throw new StateConflict();
    if ((await tx.query('SELECT run_id FROM run_preparations WHERE run_id=$1',[runId])).rows.length)
     throw new StateConflict('Reviewed job batches cannot be extended.');
    const row = one((await tx.query<Job>('INSERT INTO jobs (id,run_id,step_key) VALUES ($1,$2,$3) RETURNING *', [createId('job'),runId,stepKey])).rows);
    await event(tx,run.project_id,runId,'job.created',row.id); return row;
   });
  },
  async getJob(id: string) { return (await db.query<Job>('SELECT * FROM jobs WHERE id=$1', [id])).rows[0] ?? null; },
  async startJob(id: string): Promise<Job> {
   return db.transaction(async tx => {
    const run = await jobRun(tx,id);
    const row = one((await tx.query<Job>("UPDATE jobs SET status='running', attempt_count=attempt_count+1, last_heartbeat_at=now() WHERE id=$1 AND status='pending' RETURNING *", [id])).rows);
    await event(tx,run.project_id,run.id,'job.started',id,{ attempt: row.attempt_count }); return row;
   });
  },
  async saveCheckpoint(id: string, expectedVersion: number, expectedAttempt: number, checkpoint: Record<string, unknown>): Promise<Job> {
   return db.transaction(async tx => {
    const run = await jobRun(tx,id);
    const row = one((await tx.query<Job>(`UPDATE jobs SET checkpoint=$3::jsonb,checkpoint_version=checkpoint_version+1,last_heartbeat_at=now()
     WHERE id=$1 AND checkpoint_version=$2 AND attempt_count=$4 AND status='running' RETURNING *`, [id,expectedVersion,object(checkpoint),expectedAttempt])).rows);
    await event(tx,run.project_id,run.id,'job.checkpoint-saved',id,{ version: row.checkpoint_version }); return row;
   });
  },
  async completeJob(id: string, expectedVersion: number, expectedAttempt: number): Promise<Job> {
   return db.transaction(async tx => {
    const run = await jobRun(tx,id);
    const row = one((await tx.query<Job>("UPDATE jobs SET status='succeeded' WHERE id=$1 AND checkpoint_version=$2 AND attempt_count=$3 AND status='running' RETURNING *", [id,expectedVersion,expectedAttempt])).rows);
    await event(tx,run.project_id,run.id,'job.succeeded',id); return row;
   });
  },
  async listEvents(projectId: string, afterSequence = '0', limit = 100) {
   if (!/^\d+$/.test(afterSequence) || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid event page.');
   return (await db.query('SELECT * FROM events WHERE project_id=$1 AND sequence>$2::bigint ORDER BY sequence LIMIT $3', [projectId,afterSequence,limit])).rows;
  }
 };
}
