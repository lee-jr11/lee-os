import type { OwnerClient } from './owner-client';
import { readWorkspace,type Run } from './workflow';
export type Sequence={format:'leeos-sequence-v1';goal:string;steps:{key:string;title:string;kind:'model'|'review';dependsOn:string[]}[]};
export function sequenceDefinition(goal:string,lines:string):Sequence{
 const titles=lines.split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
 if(!goal.trim()||goal.trim().length>4000||!titles.length||titles.length>49||titles.some(t=>t.length>200))throw new Error('Supply a goal (up to 4000 characters) and 1–49 text steps, each up to 200 characters.');
 return {format:'leeos-sequence-v1',goal:goal.trim(),steps:[...titles.map((title,i)=>({key:`step_${i+1}`,title,kind:'model' as const,dependsOn:i?[`step_${i}`]:[]})),{key:'owner_review',title:'Owner reviews the completed work',kind:'review',dependsOn:[`step_${titles.length}`]}]};
}
function canonical(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function readSequence(value:unknown):Sequence|null{
 if(!value||typeof value!=='object')return null;
 const d=value as Sequence;
 if(d.format!=='leeos-sequence-v1'||typeof d.goal!=='string'||!Array.isArray(d.steps))return null;
 try{const expected=sequenceDefinition(d.goal,d.steps.slice(0,-1).map(s=>s.title).join('\n'));return canonical(d)===canonical(expected)?expected:null;}catch{return null;}
}
export async function queueAutomationRun(c:OwnerClient,project:string,automation:string,reviewedVersion:number,key:string){
 // The API queues the current definition atomically. Check before queuing and disclose
 // any intervening revision from the returned snapshot; never plan automatically.
 const current=await c.call<{version:number}>('GET',`/automations/${automation}`);
 if(current.version!==reviewedVersion)throw new Error('The definition changed. Reload and review it before queuing a run.');
 const run=await c.call<Run>('POST',`/projects/${project}/runs`,{automationId:automation,idempotencyKey:key});
 return {work:await readWorkspace(c,run.id),revisionChanged:run.automationVersion!==reviewedVersion};
}
export async function saveReviewedSequence(c:OwnerClient,run:Run,definition:Sequence){
 await c.call('POST',`/runs/${run.id}/plan`,{expectedRunVersion:run.version,goal:definition.goal,steps:definition.steps});
 return readWorkspace(c,run.id);
}
