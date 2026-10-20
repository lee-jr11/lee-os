import { createStateStore, type StateDatabase, type Row } from '@leeos/database';
import * as c from './contracts';
import { ApiError } from './errors';
function required<T>(value: T | null, resource: string): T { if (value === null) throw new ApiError(404,'NOT_FOUND',`${resource} not found.`); return value; }
function stamp(value: unknown) { if (value == null) return null; return (value instanceof Date ? value : new Date(String(value))).toISOString(); }
function projectView(row: Row) { return { id: row.id, name: row.name, description: row.description, status: row.status, lifecycleVersion: Number(row.lifecycle_version??0), createdAt: stamp(row.created_at), updatedAt: stamp(row.updated_at) }; }
function automationView(row: Row) { return { id: row.id, projectId: row.project_id, name: row.name, status: row.status, version: row.definition_version, lifecycleVersion:Number(row.lifecycle_version??0), definition: row.definition, costPolicy: row.cost_policy, createdAt: stamp(row.created_at), updatedAt: stamp(row.updated_at) }; }
function runView(row: Row, recordedSpend: string) { return { id: row.id, projectId: row.project_id, automationId: row.automation_id, automationVersion: row.automation_version, definitionSnapshot: row.definition_snapshot, status: row.status, version: row.version, spentUsd: recordedSpend, startedAt: stamp(row.started_at), finishedAt: stamp(row.finished_at), createdAt: stamp(row.created_at), updatedAt: stamp(row.updated_at) }; }
function jobView(row: Row) { return { id: row.id, runId: row.run_id, stepKey: row.step_key, status: row.status, attempt: row.attempt_count, checkpointVersion: row.checkpoint_version, checkpoint: row.checkpoint, createdAt: stamp(row.created_at), updatedAt: stamp(row.updated_at) }; }
function eventView(row: Row) { return { id: row.id, sequence: String(row.sequence), projectId: row.project_id, runId: row.run_id, kind: row.kind, entityId: row.entity_id, payload: row.payload, occurredAt: stamp(row.occurred_at) }; }
function page<T extends Row>(result: {items:T[];nextCursor:string|null}, view: (row: Row) => unknown) { return { items: result.items.map(view), nextCursor: result.nextCursor }; }
export function createCoreService(db: StateDatabase) {
 const store = createStateStore(db);
 const project = async (id: string) => required(await store.getProject(c.parse(c.projectId,id)),'Project');
 const automation = async (id: string) => required(await store.getAutomation(c.parse(c.automationId,id)),'Automation');
 const run = async (id: string) => required(await store.getRun(c.parse(c.runId,id)),'Run');
 // Sum recorded evidence in PostgreSQL, preserving decimal precision. This is
 // a ledger subtotal, not proof that interrupted/missing usage has been reconciled.
 async function runViews(rows: Row[]) {
  if(!rows.length)return [];
  const usage=await db.query('SELECT run_id,SUM(cost_usd)::text AS recorded_spend FROM model_usage WHERE run_id=ANY($1::text[]) GROUP BY run_id',[rows.map(row=>row.id)]);
  const totals=new Map(usage.rows.map(row=>[String(row.run_id),String(row.recorded_spend)]));
  return rows.map(row=>runView(row,totals.get(String(row.id))??'0.000000'));
 }
 return {
  async createProject(input: unknown) { const body = c.parse(c.projectCreate,input); return projectView(await store.createProject(body.name,body.description)); },
  async getProject(id: string) { return projectView(await project(id)); },
  async renameProject(id: string,input: unknown) { const body=c.parse(c.projectRename,input); await project(id); return projectView(await store.renameProject(id,body.name)); },
  async listProjects(after: string | null, limit: number) { if (after) c.parse(c.projectId,after); return page(await store.listProjects(after,limit),projectView); },
  async createAutomation(projectId: string,input: unknown) { const body=c.parse(c.automationCreate,input); await project(projectId); return automationView(await store.createAutomation(projectId,body.name,body.definition)); },
  async getAutomation(id: string) { return automationView(await automation(id)); },
  async reviseAutomation(id: string,input: unknown) { const body=c.parse(c.automationRevise,input); await automation(id); return automationView(await store.reviseAutomation(id,body.expectedVersion,body.definition)); },
  async listAutomations(projectId: string, after: string | null, limit: number) { await project(projectId); if (after) c.parse(c.automationId,after); return page(await store.listAutomations(projectId,after,limit),automationView); },
  async createRun(projectId: string,input: unknown) {
   const body=c.parse(c.runCreate,input); await project(projectId);
   if (body.automationId) { const recipe = await automation(body.automationId); if (recipe.project_id !== projectId) throw new ApiError(404,'NOT_FOUND','Automation not found in this project.'); }
   return (await runViews([await store.createRun(projectId,body)]))[0];
  },
  async getRun(id: string) { return (await runViews([await run(id)]))[0]; },
  async listRuns(projectId: string,after: string | null,limit: number) { await project(projectId); if (after) c.parse(c.runId,after); const result=await store.listRuns(projectId,after,limit); return {items:await runViews(result.items),nextCursor:result.nextCursor}; },
  async controlRun(id: string,input: unknown) {
   const body=c.parse(c.runCommand,input); await run(id);
   const next = { cancel: 'cancelled', interrupt: 'interrupted', requeue: 'queued' } as const;
   return (await runViews([await store.transitionRun(id,body.expectedVersion,next[body.action],body.action === 'interrupt' ? body.reason : undefined)]))[0];
  },
  async listJobs(runId: string,after: string | null,limit: number) { await run(runId); if (after) c.parse(c.jobId,after); return page(await store.listJobs(runId,after,limit),jobView); },
  async getJob(id: string) { return jobView(required(await store.getJob(c.parse(c.jobId,id)),'Job')); },
  async listEvents(projectId: string,after: string,limit: number) {
   await project(projectId);
   if (!/^(0|[1-9]\d{0,18})$/.test(after) || BigInt(after) > 9223372036854775807n) throw new ApiError(400,'INVALID_REQUEST','Invalid event cursor.');
   const rows=await store.listEvents(projectId,after,limit+1); const items=rows.slice(0,limit);
   return { items: items.map(eventView), nextCursor: rows.length > limit ? String(items.at(-1)!.sequence) : null };
  }
 };
}
