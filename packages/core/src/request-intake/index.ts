import { createHash } from 'node:crypto';
import { z } from 'zod';
import { planInput,type PlanInput } from '../orchestrator';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const requestId=z.string().regex(new RegExp(`^req_${uuid}$`));
const version=z.number().int().min(0).max(2147483646);
export const requestText=z.string().trim().min(1).max(4000).refine(s=>Buffer.byteLength(s,'utf8')<=8192);
export const intakeCreate=z.strictObject({text:requestText,idempotencyKey:z.string().min(1).max(120).regex(/^[A-Za-z0-9._:-]+$/)});
export const intakeClarify=z.strictObject({expectedVersion:version,text:requestText});
export const intakePreview=z.strictObject({text:requestText});
export const intakeEdit=z.strictObject({expectedVersion:version,goal:planInput.shape.goal,steps:planInput.shape.steps,acknowledgeScope:z.literal(true)})
 .superRefine((input,ctx)=>{
  const parsed=planInput.safeParse({expectedRunVersion:0,goal:input.goal,steps:input.steps});
  if(!parsed.success){ctx.addIssue({code:'custom',message:'Invalid dependency graph.'});return;}
  if(input.steps.some(s=>!['model','review','workflow','python','device'].includes(s.kind)))ctx.addIssue({code:'custom',message:'Unsupported step kind.'});
  const last=input.steps.at(-1)!;
  const ancestors=new Set(last.dependsOn);
  for(let i=0;i<input.steps.length;i++)for(const step of input.steps)if(ancestors.has(step.key))for(const key of step.dependsOn)ancestors.add(key);
  if(last.kind!=='review'||input.steps.slice(0,-1).some(s=>!ancestors.has(s.key)))ctx.addIssue({code:'custom',message:'End with an owner review depending on all earlier steps.'});
 });
export const intakeApprove=z.strictObject({expectedVersion:version,reviewedProposalDigest:z.string().regex(/^[a-f0-9]{64}$/),acknowledgePlanReview:z.literal(true),action:z.literal('create-reviewed-run')});
export const intakeCancel=z.strictObject({expectedVersion:version,action:z.literal('cancel')});
export interface Proposal {
 intakeVersion:'1';interpreter:'rules-v1'|'owner-edit';goal:string;steps:PlanInput['steps'];
 interpretations:{clause:string;recognizedAs:'model'|'owner-review'|'unresolved'}[];
 questions:string[];assumptions:string[];warnings:string[];costPolicy:'ZERO_ONLY';executionEnabled:false;
}
const warnings=['Current goal handling is limited to reviewed text tasks; automatic implementation selection and build/test/deploy/learn workflows are not connected.','This draft grants no execution or scheduling permission.','No sources are fetched or files read. Supply source text, prompts and model limits before executing jobs.'];
export function interpretRequest(value:unknown):Proposal{
 const text=requestText.parse(value),questions:string[]=[],steps:PlanInput['steps']=[],interpretations:Proposal['interpretations']=[];
 const clauses=text.split(/\s+(?:and\s+)?then\s+|[;\n]+/i).map(s=>s.trim()).filter(Boolean);
 if(!clauses.length)questions.push('Describe at least one action in words.');
 if(clauses.length>8)questions.push('Please shorten the request to at most eight explicit actions, or provide an edited plan.');
 if(/\b(?:every|daily|weekly|monthly|tomorrow|tonight|schedule|cron|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text))
  questions.push('Do these timing words describe the content or a schedule? Review a schedule separately; intake does not create one.');
 if(/\b(?:send|email\s+it|publish|upload|delete|remove|execute|install|download|purchase|pay|charge|subscribe|n8n|python|lee360|github)\b/i.test(text))
  questions.push('This may involve an external action, code or spending. Describe the intended outcome, available inputs and constraints. LeeOS must determine and verify a supported implementation; this text draft authorizes no external action.');
 for(const clause of clauses.slice(0,8)){
  const match=/^(?:please\s+)?(write|draft|summari[sz]e|rewrite|rephrase|translate|review|check)\s+(.+?)[.!]?$/is.exec(clause);
  if(!match){interpretations.push({clause,recognizedAs:'unresolved'});questions.push('What result should this action produce, and what inputs and constraints apply? The current intake only plans text drafting and owner review; general automation implementation is not available yet.');continue;}
  if(/\b(?:and|also|afterwards|before|after)\s+(?:please\s+)?(?:write|draft|summari[sz]e|rewrite|rephrase|translate|review|check|send|email|publish|post|delete|run|execute|download|install|build|test|fix|deploy|monitor|learn|automate)\b/i.test(clause)||/[,.!?]\s+(?:please\s+)?(?:write|draft|review|send|run|check|build|test|fix|deploy|monitor|learn|automate)\b/i.test(clause)||/\s&\s+(?:build|test|fix|deploy|monitor|learn|automate)\b/i.test(clause))
   questions.push('This combines multiple outcomes. Clarify the result and order of each action; separate them with then, a semicolon or a newline. Build, test, fix, deploy, monitor and learn are not implemented by a text-only draft.');
  const verb=match[1].toLowerCase(),object=match[2].trim();
  if(/^(?:this|it|that|them|the above|my notes|my document|my file)[.!]?$/i.test(object))questions.push('Specify the source material or subject instead of an unresolved reference such as this or it.');
  if(verb==='translate'&&!/\b(?:to|into)\s+[a-z][a-z -]{1,40}[.!]?$/i.test(object))questions.push('Which language should the translation use?');
  const kind=verb==='review'?'review':'model';
  interpretations.push({clause,recognizedAs:kind==='review'?'owner-review':'model'});
  steps.push({key:`step_${steps.length+1}`,title:clause.length<=200?clause:clause.slice(0,197)+'...',kind,dependsOn:steps.length?[steps.at(-1)!.key]:[]});
 }
 if(steps.length&&steps.at(-1)!.kind!=='review')steps.push({key:'owner_review',title:'Owner reviews the completed work',kind:'review',dependsOn:[steps.at(-1)!.key]});
 return {intakeVersion:'1',interpreter:'rules-v1',goal:text,steps,interpretations,questions:[...new Set(questions)].slice(0,10),
  assumptions:['Each recognized text action becomes one model job; review is an owner action.','Actions are sequential. Earlier outputs are not automatically inserted into later prompts.'],warnings:[...warnings],costPolicy:'ZERO_ONLY',executionEnabled:false};
}
export function editedProposal(value:z.infer<typeof intakeEdit>):Proposal{
 const parsed=planInput.parse({expectedRunVersion:0,goal:value.goal,steps:value.steps});
 return {intakeVersion:'1',interpreter:'owner-edit',goal:parsed.goal,steps:parsed.steps,interpretations:[],questions:[],
  assumptions:['The owner supplied explicit steps. Compare them with the preserved original request.'],warnings:[...warnings],costPolicy:'ZERO_ONLY',executionEnabled:false};
}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function proposalDigest(id:string,proposalVersion:number,proposal:unknown){return createHash('sha256').update(canonical({requestId:id,proposalVersion,proposal})).digest('hex');}

export interface ApprovalReceipt {requestId:string;proposalVersion:number;reviewedProposalDigest:string;runId:string;initialRunStatus:'queued';costPolicy:'ZERO_ONLY';executionEnabled:false;permissions:never[]}
