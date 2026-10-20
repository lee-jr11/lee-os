import { createId,StateConflict,projectAllowsNewWork,requireProjectNewWork,type StateDatabase,type SqlSession,type Row } from '@leeos/database';
import { parse,projectId } from '../api/contracts';
import { ApiError } from '../api/errors';
import { scheduleCreate,subscriptionCreate,scheduleId,subscriptionId,triggerCommand,tickRequest,dueOccurrence } from './contracts';
import { dueCalendarOccurrence,localDateTimeToInstant,nextCalendarOccurrence,type CalendarRule } from './calendar';
export * from './contracts';
export * from './calendar';
function required(row:Row|undefined,kind='Trigger'):Row{if(!row)throw new ApiError(404,'NOT_FOUND',`${kind} not found.`);return row;}
function stamp(value:unknown){return value?new Date(value as string|Date).toISOString():null;}
function dateText(value:unknown){return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);}
function view(row:Row,kind:'schedule'|'subscription'){
 return kind==='schedule'?{id:row.id,projectId:row.project_id,automationId:row.automation_id,automationVersion:row.automation_version,kind:row.kind,
  runAt:stamp(row.run_at),intervalSeconds:row.interval_seconds,localDate:row.local_date?dateText(row.local_date):null,
  localTime:row.local_time?String(row.local_time).slice(0,5):null,dayOfWeek:row.day_of_week,timezone:row.timezone,enabled:row.enabled,version:row.version,nextRunAt:stamp(row.next_run_at),action:'queue-run-for-review'}:
 {id:row.id,projectId:row.project_id,automationId:row.target_automation_id,automationVersion:row.target_version,sourceAutomationId:row.source_automation_id,
  eventKind:row.event_kind,enabled:row.enabled,version:row.version,enabledSince:stamp(row.enabled_since),action:'queue-run-for-review'};
}
async function history(tx:SqlSession,project:unknown,kind:string,id:string,payload:Row={},run:unknown=null){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),project,run,kind,id,JSON.stringify(payload)]);
}
const schedules='SELECT s.*,c.project_id,c.automation_version,c.request FROM schedules s JOIN schedule_configs c ON c.schedule_id=s.id';
async function target(tx:SqlSession,project:string,id:string,version:number){
 await requireProjectNewWork(tx,project);
 const row=required((await tx.query('SELECT * FROM automations WHERE id=$1 AND project_id=$2 FOR UPDATE',[id,project])).rows[0],'Automation');
 if(row.definition_version!==version||['paused','archived'].includes(String(row.status)))throw new StateConflict('Review the current available automation version.');
 return row;
}
async function queue(tx:SqlSession,project:string,id:string,version:number,key:string){
 if(!await projectAllowsNewWork(tx,project)){
  const state=String((await tx.query('SELECT status FROM projects WHERE id=$1',[project])).rows[0]?.status??'archived');
  return {outcome:'blocked',reason:`PROJECT_${state.toUpperCase()}`,runId:null};
 }
 const row=required((await tx.query('SELECT * FROM automations WHERE id=$1 AND project_id=$2 FOR UPDATE',[id,project])).rows[0],'Automation');
 if(row.definition_version!==version||['paused','archived'].includes(String(row.status)))return {outcome:'blocked',reason:'AUTOMATION_CHANGED_OR_UNAVAILABLE',runId:null};
 if((await tx.query("SELECT id FROM runs WHERE automation_id=$1 AND status IN ('queued','running','interrupted') LIMIT 1",[id])).rows.length)
  return {outcome:'overlap',reason:'EXISTING_UNFINISHED_RUN',runId:null};
 const run=createId('run');
 await tx.query('INSERT INTO runs(id,project_id,automation_id,automation_version,definition_snapshot,idempotency_key) VALUES($1,$2,$3,$4,$5,$6)',[run,project,id,version,JSON.stringify(row.definition),key]);
 await history(tx,project,'run.created',run,{triggerKey:key,executionEnabled:false},run);
 return {outcome:'queued',reason:'OWNER_REVIEW_REQUIRED',runId:run};
}
export function createCoordinator(db:StateDatabase,options:{enabled:()=>boolean;clock?:()=>Date}={enabled:()=>false}){
 const assertEnabled=()=>{if(!options.enabled())throw new ApiError(503,'COORDINATION_DISABLED','Enable the local coordinator before polling.');};
 async function get(kind:'schedule'|'subscription',id:string){
  parse(kind==='schedule'?scheduleId:subscriptionId,id);
  const row=required((await db.query(kind==='schedule'?schedules+' WHERE s.id=$1':'SELECT * FROM event_subscriptions WHERE id=$1',[id])).rows[0]);
  return view(row,kind);
 }
 async function list(kind:'schedule'|'subscription',project:string,after:string|null=null,limit=25){
  parse(projectId,project);if(after)parse(kind==='schedule'?scheduleId:subscriptionId,after);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new ApiError(400,'INVALID_REQUEST','Invalid page size.');
  required((await db.query('SELECT id FROM projects WHERE id=$1',[project])).rows[0],'Project');
  const sql=kind==='schedule'?schedules+' WHERE c.project_id=$1 AND ($2::text IS NULL OR s.id>$2) ORDER BY s.id LIMIT $3':
   'SELECT * FROM event_subscriptions WHERE project_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3';
  const rows=(await db.query(sql,[project,after,limit+1])).rows,items=rows.slice(0,limit);
  return {items:items.map(r=>view(r,kind)),nextCursor:rows.length>limit?String(items.at(-1)!.id):null};
 }
 async function create(kind:'schedule'|'subscription',project:string,value:unknown){
  parse(projectId,project);
  const input=kind==='schedule'?parse(scheduleCreate,value):parse(subscriptionCreate,value);
  return db.transaction(async tx=>{
   // Serialize registration by project so same-key races return the original identity.
   required((await tx.query('SELECT id FROM projects WHERE id=$1 FOR NO KEY UPDATE',[project])).rows[0],'Project');
   const prior=(await tx.query(kind==='schedule'?schedules+' WHERE c.project_id=$1 AND c.request_key=$2':
    'SELECT * FROM event_subscriptions WHERE project_id=$1 AND request_key=$2',[project,input.idempotencyKey])).rows[0];
   if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(input)){
    const same=(await tx.query<{same:boolean}>('SELECT $1::jsonb=$2::jsonb AS same',[JSON.stringify(prior.request),JSON.stringify(input)])).rows[0].same;
    if(!same)throw new StateConflict('This registration key belongs to another trigger.');
   }return view(prior,kind);}
   await target(tx,project,input.automationId,input.expectedAutomationVersion);
   let id:string;
   if('kind' in input){
    id=createId('schedule');
    const now=options.clock?.()??new Date((await tx.query('SELECT clock_timestamp() AS now')).rows[0].now as Date);
    let at:string|null=null,nextRunAt:string,timezone='UTC',localDateValue:string|null=null,localTimeValue:string|null=null,dayOfWeek:number|null=null;
    if(input.kind==='once'&&'localDate' in input){
     at=localDateTimeToInstant(input.localDate,input.localTime,input.timezone).toISOString();nextRunAt=at;timezone=input.timezone;localDateValue=input.localDate;localTimeValue=input.localTime;
    }else if(input.kind==='once'){
     at=input.runAt;nextRunAt=at;
    }else if(input.kind==='interval'){
     at=input.firstRunAt;nextRunAt=at;
    }else{
     const rule:CalendarRule=input.kind==='daily'?{kind:'daily',time:input.time,timezone:input.timezone}:
      {kind:'weekly',time:input.time,timezone:input.timezone,dayOfWeek:input.dayOfWeek};
     const first=nextCalendarOccurrence(now,rule);nextRunAt=first.scheduledFor;timezone=input.timezone;localTimeValue=input.time;
     if(input.kind==='weekly')dayOfWeek=input.dayOfWeek;
    }
    await tx.query('INSERT INTO schedules(id,automation_id,kind,run_at,interval_seconds,timezone,next_run_at,local_date,local_time,day_of_week) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
     [id,input.automationId,input.kind,at,input.kind==='interval'?input.intervalSeconds:null,timezone,nextRunAt,localDateValue,localTimeValue,dayOfWeek]);
    await tx.query('INSERT INTO schedule_configs(schedule_id,project_id,automation_id,automation_version,request_key,request) VALUES($1,$2,$3,$4,$5,$6)',[id,project,input.automationId,input.expectedAutomationVersion,input.idempotencyKey,JSON.stringify(input)]);
   }else{
    if(input.sourceAutomationId===input.automationId)throw new StateConflict('Choose a different follow-up automation.');
    required((await tx.query('SELECT id FROM automations WHERE id=$1 AND project_id=$2',[input.sourceAutomationId,project])).rows[0],'Source automation');
    id=createId('subscription');
    await tx.query('INSERT INTO event_subscriptions(id,project_id,source_automation_id,target_automation_id,target_version,event_kind,request_key,request) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,project,input.sourceAutomationId,input.automationId,input.expectedAutomationVersion,input.eventKind,input.idempotencyKey,JSON.stringify(input)]);
   }
   await history(tx,project,`${kind}.created`,id,{action:'queue-run-for-review',enabled:false});
   const saved=required((await tx.query(kind==='schedule'?schedules+' WHERE s.id=$1':'SELECT * FROM event_subscriptions WHERE id=$1',[id])).rows[0]);return view(saved,kind);
  });
 }
 async function command(kind:'schedule'|'subscription',id:string,value:unknown){
  parse(kind==='schedule'?scheduleId:subscriptionId,id);const input=parse(triggerCommand,value);
  return db.transaction(async tx=>{
   const row=required((await tx.query(kind==='schedule'?schedules+' WHERE s.id=$1 FOR UPDATE OF s':'SELECT * FROM event_subscriptions WHERE id=$1 FOR UPDATE',[id])).rows[0]);
   const enabled=input.action==='enable';
   if(row.version!==input.expectedVersion||row.enabled===enabled)throw new StateConflict('Refresh this trigger version and state.');
   if(enabled){
    await target(tx,String(row.project_id),String(kind==='schedule'?row.automation_id:row.target_automation_id),Number(kind==='schedule'?row.automation_version:row.target_version));
    if(kind==='schedule'&&(!row.next_run_at||(row.kind==='once'&&(await tx.query('SELECT id FROM trigger_receipts WHERE schedule_id=$1 LIMIT 1',[id])).rows.length)))throw new StateConflict('This one-time occurrence was consumed. Create another reviewed schedule.');
   }
   let nextRunAt:string|null=null;
   if(kind==='schedule'&&enabled&&['daily','weekly'].includes(String(row.kind))){
    const now=options.clock?.()??new Date((await tx.query('SELECT clock_timestamp() AS now')).rows[0].now as Date);
    const rule:CalendarRule=row.kind==='daily'?{kind:'daily',time:String(row.local_time).slice(0,5),timezone:String(row.timezone)}:
     {kind:'weekly',time:String(row.local_time).slice(0,5),timezone:String(row.timezone),dayOfWeek:Number(row.day_of_week)};
    nextRunAt=nextCalendarOccurrence(now,rule).scheduledFor;
   }
   if(kind==='schedule')await tx.query('UPDATE schedules SET enabled=$2,version=version+1,next_run_at=COALESCE($3,next_run_at) WHERE id=$1',[id,enabled,nextRunAt]);
   else await tx.query('UPDATE event_subscriptions SET enabled=$2,version=version+1,enabled_since=CASE WHEN $2 THEN clock_timestamp() ELSE enabled_since END WHERE id=$1',[id,enabled]);
   await history(tx,row.project_id,`${kind}.${enabled?'enabled':'disabled'}`,id);
   const saved=required((await tx.query(kind==='schedule'?schedules+' WHERE s.id=$1':'SELECT * FROM event_subscriptions WHERE id=$1',[id])).rows[0]);return view(saved,kind);
  });
 }
 async function scheduleOne(now:Date){
  return db.transaction(async tx=>{
   const row=(await tx.query(schedules+` JOIN projects p ON p.id=c.project_id JOIN automations a ON a.id=c.automation_id AND a.project_id=c.project_id
    WHERE s.enabled AND s.next_run_at<=$1 AND p.status<>'paused' AND a.status<>'paused'
    ORDER BY s.next_run_at,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED`,[now.toISOString()])).rows[0];
   if(!row)return null;
   let occurrence:{scheduledFor:string;scheduledLocal:string|null;timezone:string|null;nextRunAt:string|null;skipped:number};
   if(row.kind==='daily'||row.kind==='weekly'){
    const rule:CalendarRule=row.kind==='daily'?{kind:'daily',time:String(row.local_time).slice(0,5),timezone:String(row.timezone)}:
     {kind:'weekly',time:String(row.local_time).slice(0,5),timezone:String(row.timezone),dayOfWeek:Number(row.day_of_week)};
    occurrence=dueCalendarOccurrence(row.next_run_at as Date,rule,now);
   }else{
    const due=dueOccurrence(row.next_run_at as Date,row.interval_seconds as number|null,now);
    occurrence={...due,scheduledLocal:row.local_date?`${dateText(row.local_date)}T${String(row.local_time).slice(0,5)}`:null,
     timezone:row.local_date?String(row.timezone):null};
   }
   const outcome=await queue(tx,String(row.project_id),String(row.automation_id),Number(row.automation_version),`schedule:${row.id}:${occurrence.scheduledFor}`);
   await tx.query('INSERT INTO trigger_receipts(project_id,schedule_id,scheduled_for,scheduled_local,timezone,skipped_occurrences,run_id,outcome,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [row.project_id,row.id,occurrence.scheduledFor,occurrence.scheduledLocal,occurrence.timezone,occurrence.skipped,outcome.runId,outcome.outcome,outcome.reason]);
   await tx.query('UPDATE schedules SET next_run_at=$2,enabled=$3,version=version+1 WHERE id=$1',[row.id,occurrence.nextRunAt,occurrence.nextRunAt!==null&&outcome.outcome!=='blocked']);
   await history(tx,row.project_id,'schedule.fired',String(row.id),{...occurrence,...outcome},outcome.runId);
   return {triggerId:row.id,...occurrence,...outcome};
  });
 }
 async function eventOne(){
  return db.transaction(async tx=>{
   // Receipts, not sequence watermarks: a lower sequence may commit after a higher one.
   const candidate=(await tx.query(`SELECT s.*,e.id AS event_id FROM event_subscriptions s
    JOIN events e ON e.project_id=s.project_id AND e.kind=s.event_kind AND e.occurred_at>=s.enabled_since
    JOIN runs r ON r.id=e.run_id AND r.automation_id=s.source_automation_id
    JOIN projects p ON p.id=s.project_id
    JOIN automations target ON target.id=s.target_automation_id AND target.project_id=s.project_id
    JOIN automations source ON source.id=s.source_automation_id AND source.project_id=s.project_id
    WHERE s.enabled AND p.status<>'paused'
     AND target.status<>'paused' AND source.status<>'paused'
     AND NOT EXISTS(SELECT 1 FROM trigger_receipts t WHERE t.subscription_id=s.id AND t.source_event_id=e.id)
    ORDER BY e.occurred_at,e.id,s.id LIMIT 1 FOR UPDATE OF s SKIP LOCKED`)).rows[0];
   if(!candidate)return null;
   if((await tx.query('SELECT id FROM trigger_receipts WHERE subscription_id=$1 AND source_event_id=$2',[candidate.id,candidate.event_id])).rows.length)return null;
   const outcome=await queue(tx,String(candidate.project_id),String(candidate.target_automation_id),Number(candidate.target_version),`subscription:${candidate.id}:${candidate.event_id}`);
   await tx.query('INSERT INTO trigger_receipts(project_id,subscription_id,source_event_id,run_id,outcome,reason) VALUES($1,$2,$3,$4,$5,$6)',[candidate.project_id,candidate.id,candidate.event_id,outcome.runId,outcome.outcome,outcome.reason]);
   if(outcome.outcome==='blocked')await tx.query('UPDATE event_subscriptions SET enabled=false,version=version+1 WHERE id=$1',[candidate.id]);
   await history(tx,candidate.project_id,'subscription.delivered',String(candidate.id),{sourceEventId:candidate.event_id,...outcome},outcome.runId);
   return {triggerId:candidate.id,sourceEventId:candidate.event_id,...outcome};
  });
 }
 return {assertEnabled,get,list,create,command,
  async receipts(project:string,after:string|null=null,limit=25){
   parse(projectId,project);
   if(!Number.isInteger(limit)||limit<1||limit>100||(after!==null&&(!/^(0|[1-9]\d{0,18})$/.test(after)||BigInt(after)>9223372036854775807n)))throw new ApiError(400,'INVALID_REQUEST','Invalid receipt page.');
   required((await db.query('SELECT id FROM projects WHERE id=$1',[project])).rows[0],'Project');
   const rows=(await db.query('SELECT * FROM trigger_receipts WHERE project_id=$1 AND ($2::bigint IS NULL OR id>$2::bigint) ORDER BY id LIMIT $3',[project,after,limit+1])).rows,items=rows.slice(0,limit);
   return {items:items.map(r=>({id:String(r.id),projectId:r.project_id,scheduleId:r.schedule_id,subscriptionId:r.subscription_id,scheduledFor:stamp(r.scheduled_for),scheduledLocal:r.scheduled_local,timezone:r.timezone,skippedOccurrences:r.skipped_occurrences,sourceEventId:r.source_event_id,runId:r.run_id,outcome:r.outcome,reason:r.reason,createdAt:stamp(r.created_at)})),nextCursor:rows.length>limit?String(items.at(-1)!.id):null};
  },
  async tick(value:unknown){
   const input=parse(tickRequest,value);assertEnabled();
   const now=options.clock?.()??new Date((await db.query('SELECT clock_timestamp() AS now')).rows[0].now as Date);
   const timeResults:Row[]=[],eventResults:Row[]=[];
   for(let i=0;i<Math.ceil(input.limit/2);i++){const result=await scheduleOne(now);if(!result)break;timeResults.push(result);}
   for(let i=0;i<input.limit-timeResults.length;i++){const result=await eventOne();if(!result)break;eventResults.push(result);}
   return {at:now.toISOString(),executionEnabled:false,schedules:timeResults,events:eventResults};
  }
 };
}
