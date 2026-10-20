import { OwnerClient } from './owner-client';
import type { Page } from './workflow';
export type Automation={id:string;name:string;version:number;status:string;definition:unknown};
export type Trigger={id:string;projectId:string;automationId:string;automationVersion:number;version:number;enabled:boolean;kind?:string;runAt?:string;intervalSeconds?:number;localDate?:string|null;localTime?:string|null;dayOfWeek?:number|null;timezone?:string;nextRunAt?:string|null;sourceAutomationId?:string;eventKind?:string;enabledSince?:string};
export type Receipt={id:string;runId:string|null;outcome:string;reason:string|null;scheduleId:string|null;subscriptionId:string|null;scheduledFor:string|null;scheduledLocal:string|null;timezone:string|null;skippedOccurrences:number;createdAt:string};
export type Coordinator={enabled:boolean;mode:string;executionEnabled:false;maxBatchSize:number};
export type CoordinationView={automations:Page<Automation>;schedules:Page<Trigger>;subscriptions:Page<Trigger>;receipts:Page<Receipt>;coordinator:Coordinator};
export async function readCoordination(c:OwnerClient,project:string):Promise<CoordinationView>{
 const [automations,schedules,subscriptions,receipts,coordinator]=await Promise.all([c.call<Page<Automation>>('GET',`/projects/${project}/automations?limit=25`),c.call<Page<Trigger>>('GET',`/projects/${project}/schedules?limit=25`),c.call<Page<Trigger>>('GET',`/projects/${project}/event-subscriptions?limit=25`),c.call<Page<Receipt>>('GET',`/projects/${project}/trigger-receipts?limit=25`),c.call<Coordinator>('GET','/coordinator')]);
 return {automations,schedules,subscriptions,receipts,coordinator};
}
export type TriggerDraft={mode:'once'|'interval'|'daily'|'weekly'|'event';target:Automation;instant:string;localDate:string;localTime:string;timezone:string;dayOfWeek:number;intervalSeconds:number;source:string;eventKind:string};
export function registrationBody(d:TriggerDraft,key:string){
 const base={automationId:d.target.id,expectedAutomationVersion:d.target.version,idempotencyKey:key,action:'queue-run-for-review',acknowledgeNoExecution:true};
 if(d.mode==='event')return {...base,sourceAutomationId:d.source,eventKind:d.eventKind};
 if(d.mode==='once'){
  const date=Date.parse(`${d.localDate}T00:00:00.000Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.localDate)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==d.localDate||d.localDate<'2020-01-01'||d.localDate>'2100-01-01'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.localTime)||!d.timezone.trim())throw new Error('Choose a valid local date, time and IANA timezone.');
  return {...base,kind:'once',localDate:d.localDate,localTime:d.localTime,timezone:d.timezone.trim()};
 }
 if(d.mode==='daily'||d.mode==='weekly'){
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.localTime)||!d.timezone.trim())throw new Error('Choose a local time and IANA timezone.');
  if(d.mode==='weekly'&&(!Number.isInteger(d.dayOfWeek)||d.dayOfWeek<1||d.dayOfWeek>7))throw new Error('Choose a weekday.');
  return d.mode==='daily'?{...base,kind:'daily',time:d.localTime,timezone:d.timezone.trim()}:
   {...base,kind:'weekly',dayOfWeek:d.dayOfWeek,time:d.localTime,timezone:d.timezone.trim()};
 }
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(d.instant)||!Number.isFinite(Date.parse(d.instant))||new Date(d.instant).toISOString()!==d.instant||d.instant<'2020-01-01T00:00:00.000Z'||d.instant>'2100-01-01T00:00:00.000Z')throw new Error('Use an exact UTC instant, for example 2026-10-21T19:00:00.000Z (2020–2100).');
 if(!Number.isInteger(d.intervalSeconds)||d.intervalSeconds<60||d.intervalSeconds>31536000)throw new Error('Use an interval of 60–31536000 whole seconds.');
 return {...base,kind:'interval',firstRunAt:d.instant,intervalSeconds:d.intervalSeconds};
}
