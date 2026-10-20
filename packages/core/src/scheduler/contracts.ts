import { z } from 'zod';
import { automationId } from '../api/contracts';
import { localDateTimeToInstant } from './calendar';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const scheduleId=z.string().regex(new RegExp(`^sched_${uuid}$`));
export const subscriptionId=z.string().regex(new RegExp(`^sub_${uuid}$`));
const version=z.number().int().min(0).max(2147483646);
const base={automationId,expectedAutomationVersion:version.min(1),idempotencyKey:z.string().min(1).max(120).regex(/^[A-Za-z0-9._:-]+$/),
 action:z.literal('queue-run-for-review'),acknowledgeNoExecution:z.literal(true)};
// Legacy UTC instants remain supported. Calendar rules use explicit local time
// and an IANA timezone; DST ambiguity/gap behavior is defined in calendar.ts.
const instant=z.iso.datetime({precision:3}).refine(s=>Number.isFinite(Date.parse(s))&&Date.parse(s)>=Date.UTC(2020,0,1)&&Date.parse(s)<=Date.UTC(2100,0,1));
const localDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
 const time=Date.parse(`${value}T00:00:00.000Z`);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value&&time>=Date.UTC(2020,0,1)&&time<=Date.UTC(2100,0,1);
},'Use a real calendar date from 2020 through 2100.');
const localTime=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const timezone=z.string().min(1).max(100).refine(value=>{
 try{new Intl.DateTimeFormat('en',{timeZone:value}).format(0);return true;}catch{return false;}
},'Use a supported IANA timezone.');
const localOnce=z.strictObject({...base,kind:z.literal('once'),localDate,localTime,timezone});
const daily=z.strictObject({...base,kind:z.literal('daily'),time:localTime,timezone});
const weekly=z.strictObject({...base,kind:z.literal('weekly'),dayOfWeek:z.number().int().min(1).max(7),time:localTime,timezone});
export const scheduleCreate=z.union([
 z.strictObject({...base,kind:z.literal('once'),runAt:instant}),localOnce,
 z.strictObject({...base,kind:z.literal('interval'),firstRunAt:instant,intervalSeconds:z.number().int().min(60).max(31536000)}),
 daily,weekly
]).superRefine((value,ctx)=>{
 if(value.kind==='once'&&'localDate' in value){
  try{const time=localDateTimeToInstant(value.localDate,value.localTime,value.timezone).getTime();if(time<Date.UTC(2020,0,1)||time>Date.UTC(2100,0,1))ctx.addIssue({code:'custom',message:'The resolved instant must be within 2020–2100.'});}
  catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid local date and time.'});}
 }
});
export const subscriptionCreate=z.strictObject({...base,sourceAutomationId:automationId,eventKind:z.enum(['run.succeeded','run.failed','run.cancelled','run.interrupted'])});
export const triggerCommand=z.strictObject({action:z.enum(['enable','disable']),expectedVersion:version});
export const tickRequest=z.strictObject({limit:z.number().int().min(2).max(20).default(10)});
export function dueOccurrence(next:string|Date,intervalSeconds:number|null,now:string|Date){
 const start=new Date(next).getTime(),clock=new Date(now).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(clock)||start>clock)throw new Error('Schedule is not due.');
 if(intervalSeconds===null)return {scheduledFor:new Date(start).toISOString(),nextRunAt:null,skipped:0};
 const skipped=Math.floor((clock-start)/(intervalSeconds*1000));
 const latest=start+skipped*intervalSeconds*1000;
 return {scheduledFor:new Date(latest).toISOString(),nextRunAt:new Date(latest+intervalSeconds*1000).toISOString(),skipped};
}
