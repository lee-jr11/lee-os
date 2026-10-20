import type { StateDatabase, Row } from '@leeos/database';
import { createRequirementsManager } from '../requirements/store';
import { ApiError } from '../api/errors';

function stamp(value:unknown){return value?new Date(value as string|Date).toISOString():null;}
function required(row:Row|undefined){if(!row)throw new ApiError(404,'NOT_FOUND','Project not found.');return row;}
export function createCommandCenter(db:StateDatabase){
 const requirements=createRequirementsManager(db);
 return {
  async get(projectId:string){
   const project=required((await db.query('SELECT * FROM projects WHERE id=$1',[projectId])).rows[0]);
   const [automations,runs,schedules,subscriptions,receipts,artifacts,approvals,goalRuns]=await Promise.all([
    db.query(`SELECT id,project_id,name,status,definition_version,lifecycle_version,updated_at FROM automations WHERE project_id=$1 ORDER BY updated_at DESC,id LIMIT 50`,[projectId]),
    db.query(`SELECT id,project_id,automation_id,automation_version,status,version,spent_usd,created_at,updated_at,finished_at FROM runs WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25`,[projectId]),
    db.query(`SELECT s.id,s.kind,s.enabled,s.version,s.next_run_at,s.timezone,c.automation_id,c.automation_version FROM schedules s JOIN schedule_configs c ON c.schedule_id=s.id WHERE c.project_id=$1 ORDER BY s.next_run_at NULLS LAST,s.id LIMIT 50`,[projectId]),
    db.query(`SELECT id,source_automation_id,target_automation_id,target_version,event_kind,enabled,version,enabled_since FROM event_subscriptions WHERE project_id=$1 ORDER BY id LIMIT 50`,[projectId]),
    db.query(`SELECT id,schedule_id,subscription_id,run_id,outcome,reason,scheduled_for,created_at FROM trigger_receipts WHERE project_id=$1 ORDER BY id DESC LIMIT 25`,[projectId]),
    db.query(`SELECT id,run_id,name,media_type,sha256,size_bytes,storage_backend,created_at,EXISTS(SELECT 1 FROM artifact_blobs b WHERE b.artifact_id=a.id AND b.project_id=a.project_id) AS has_bytes FROM artifacts a WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25`,[projectId]),
    db.query(`SELECT ap.id,ap.run_id,ap.action,ap.status,ap.created_at FROM approvals ap JOIN runs r ON r.id=ap.run_id WHERE r.project_id=$1 AND ap.status='pending' ORDER BY ap.created_at LIMIT 25`,[projectId]),
    db.query(`SELECT r.run_id FROM run_requirements r JOIN runs x ON x.id=r.run_id WHERE r.project_id=$1 ORDER BY x.created_at DESC LIMIT 15`,[projectId])
   ]);
   const runIds=runs.rows.map(row=>String(row.id));
   const [spend,goalAssessments]=await Promise.all([
    runIds.length?db.query('SELECT run_id,SUM(cost_usd)::text AS recorded_spend FROM model_usage WHERE run_id=ANY($1::text[]) GROUP BY run_id',[runIds]):Promise.resolve({rows:[] as Row[]}),
    Promise.all(goalRuns.rows.map(row=>requirements.assessment(String(row.run_id))))
   ]);
   const spendByRun=new Map(spend.rows.map(row=>[String(row.run_id),String(row.recorded_spend)]));
   const goalByRun=new Map(goalAssessments.map(item=>[item.runId,item]));
   const runViews=runs.rows.map(row=>({id:String(row.id),automationId:row.automation_id??null,automationVersion:row.automation_version??null,status:String(row.status),version:Number(row.version),
    spentUsd:spendByRun.get(String(row.id))??String(row.spent_usd??'0.000000'),createdAt:stamp(row.created_at),updatedAt:stamp(row.updated_at),finishedAt:stamp(row.finished_at),goalAssessment:goalByRun.get(String(row.id))??null}));
   const receiptRows=receipts.rows;
   const attention:Array<Record<string,unknown>>=[];
   for(const run of runViews){
    if(run.status==='queued')attention.push({id:`run:${run.id}`,kind:'queued-run',status:'needs-review',runId:run.id,summary:'Queued work is waiting for its next reviewed step.'});
    if(run.status==='failed'||run.status==='interrupted')attention.push({id:`run:${run.id}`,kind:'run-problem',status:run.status,runId:run.id,summary:run.status==='failed'?'This run failed. Inspect its saved result and recovery state.':'This run was interrupted. Inspect before requeueing.'});
    if(run.goalAssessment?.goalStatus==='pending'&&run.status==='succeeded')attention.push({id:`goal:${run.id}`,kind:'goal-assessment',status:'pending',runId:run.id,summary:'Technical execution succeeded; required goal evidence is still pending.'});
   }
   for(const row of approvals.rows)attention.push({id:`approval:${row.id}`,kind:'approval',status:'pending',runId:String(row.run_id),summary:`Approval required: ${String(row.action)}.`});
   for(const row of receiptRows)if(row.outcome==='blocked'||row.outcome==='overlap')attention.push({id:`trigger:${row.id}`,kind:'trigger-receipt',status:String(row.outcome),runId:row.run_id??null,summary:String(row.reason)});
   return {
    project:{id:String(project.id),name:String(project.name),description:String(project.description),status:String(project.status),lifecycleVersion:Number(project.lifecycle_version),createdAt:stamp(project.created_at),updatedAt:stamp(project.updated_at)},
    automations:automations.rows.map(row=>({id:String(row.id),name:String(row.name),status:String(row.status),version:Number(row.definition_version),lifecycleVersion:Number(row.lifecycle_version),updatedAt:stamp(row.updated_at)})),
    runs:runViews,
    schedules:schedules.rows.map(row=>({id:String(row.id),automationId:String(row.automation_id),automationVersion:Number(row.automation_version),kind:String(row.kind),enabled:Boolean(row.enabled),version:Number(row.version),timezone:String(row.timezone),nextRunAt:stamp(row.next_run_at)})),
    subscriptions:subscriptions.rows.map(row=>({id:String(row.id),sourceAutomationId:String(row.source_automation_id),automationId:String(row.target_automation_id),automationVersion:Number(row.target_version),eventKind:String(row.event_kind),enabled:Boolean(row.enabled),version:Number(row.version),enabledSince:stamp(row.enabled_since)})),
    artifacts:artifacts.rows.map(row=>({id:String(row.id),runId:row.run_id??null,name:String(row.name),mediaType:String(row.media_type),sha256:row.sha256??null,sizeBytes:row.size_bytes===null?null:Number(row.size_bytes),storageBackend:String(row.storage_backend),available:row.storage_backend==='postgres-bytea'&&Boolean(row.has_bytes),createdAt:stamp(row.created_at)})),
    receipts:receiptRows.map(row=>({id:String(row.id),scheduleId:row.schedule_id??null,subscriptionId:row.subscription_id??null,runId:row.run_id??null,outcome:String(row.outcome),reason:String(row.reason),scheduledFor:stamp(row.scheduled_for),createdAt:stamp(row.created_at)})),
    goalAssessments,attention:attention.slice(0,50),
    completedRuns:runViews.filter(run=>run.status==='succeeded').map(run=>({runId:run.id,goalStatus:run.goalAssessment?.goalStatus??'unassessed',finishedAt:run.finishedAt}))
   };
  }
 };
}
