import { createHash } from 'node:crypto';
import { z } from 'zod';
import { jobId } from '../api/contracts';
const text=z.string().trim().min(1).max(2000);
const key=z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const version=z.number().int().min(1).max(2147483646);
export const requirementsId=z.string().regex(/^reqs_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const evidenceKind=z.enum(['owner-review','job-result','document-validation','artifact-registration','delivery-confirmation']);
const requirement=z.strictObject({id:key,statement:text,required:z.boolean(),capabilityIds:z.array(key).min(1).max(20).optional()});
const expected=z.record(key,z.union([z.string().trim().min(1).max(500),z.number().finite().min(-1e9).max(1e9),z.boolean()])).refine(values=>Object.keys(values).length<=20,'At most twenty expected attributes.');
const criterion=z.strictObject({id:key,description:text,requirementIds:z.array(key).min(1).max(50),required:z.boolean(),evidenceKind,expected:expected.optional(),sourceStepKey:key.optional()});
export const requirementsContent=z.strictObject({
 goal:text,requirements:z.array(requirement).min(1).max(50),
 inputs:z.array(z.strictObject({id:key,description:text,required:z.boolean()})).max(30),
 outputs:z.array(z.strictObject({id:key,description:text})).max(30),
 assumptions:z.array(text).max(20),questions:z.array(text).max(20),
 constraints:z.array(text).max(20),capabilities:z.array(key).max(20),
 acceptanceCriteria:z.array(criterion).min(1).max(50),costPolicy:z.literal('ZERO_ONLY')
}).superRefine((c,ctx)=>{
 const unique=(values:string[])=>new Set(values).size===values.length;
 if(![c.requirements,c.inputs,c.outputs,c.acceptanceCriteria].every(rows=>unique(rows.map(r=>r.id)))||!unique(c.capabilities))ctx.addIssue({code:'custom',message:'Identifiers must be unique within each collection.'});
 if(c.acceptanceCriteria.some(r=>(r.evidenceKind==='job-result')!==Boolean(r.sourceStepKey)))ctx.addIssue({code:'custom',message:'Job-result criteria require a sourceStepKey; other criteria cannot specify one.'});
 if(c.acceptanceCriteria.some(r=>['owner-review','job-result'].includes(r.evidenceKind)&&r.expected&&Object.keys(r.expected).length>0))ctx.addIssue({code:'custom',message:'Current evidence kinds have fixed semantics; expected attributes are reserved for future verifiers.'});
 const ids=new Set(c.requirements.map(r=>r.id));
 if(c.requirements.some(r=>r.capabilityIds&&(!unique(r.capabilityIds)||r.capabilityIds.some(id=>!c.capabilities.includes(id)))))ctx.addIssue({code:'custom',message:'Requirement capabilities must be unique references to declared capabilities.'});
 if(c.acceptanceCriteria.some(r=>!unique(r.requirementIds)||r.requirementIds.some(id=>!ids.has(id))))ctx.addIssue({code:'custom',message:'Criteria must reference existing unique requirement IDs.'});
 if(!c.acceptanceCriteria.some(r=>r.required)||!c.requirements.some(r=>r.required))ctx.addIssue({code:'custom',message:'At least one requirement and criterion must be required.'});
 if(c.requirements.some(r=>r.required&&!c.acceptanceCriteria.some(a=>a.required&&a.requirementIds.includes(r.id))))ctx.addIssue({code:'custom',message:'Every required requirement needs a required acceptance criterion.'});
});
export type RequirementsContent=z.infer<typeof requirementsContent>;
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const requestKey=z.string().regex(/^[A-Za-z0-9._:-]{1,120}$/);
export const requirementsCreate=z.strictObject({idempotencyKey:requestKey,content:requirementsContent});
export const requirementsRevise=z.strictObject({expectedRevision:version,content:requirementsContent});
export const requirementsReview=z.strictObject({revision:version,reviewedDigest:digest,acknowledgeRequirementsReview:z.literal(true)});
export const requirementsBind=z.strictObject({requirementsId,revision:version,reviewedDigest:digest,expectedRunVersion:z.number().int().min(0).max(2147483646),acknowledgeBinding:z.literal(true)});
const evidenceCommon={criterionId:key,expectedEvidenceVersion:z.number().int().min(0).max(2147483646),idempotencyKey:requestKey};
export const acceptanceEvidence=z.discriminatedUnion('kind',[
 z.strictObject({...evidenceCommon,kind:z.literal('owner-review'),outcome:z.enum(['met','not-met']),note:text,acknowledgeOwnerReview:z.literal(true)}),
 z.strictObject({...evidenceCommon,kind:z.literal('job-result'),jobId})
]);
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).filter(k=>(value as Record<string,unknown>)[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function sameContent(a:unknown,b:unknown){return canonical(a)===canonical(b);}
export function requirementsDigest(id:string,revision:number,content:unknown){return createHash('sha256').update(canonical({requirementsId:id,revision,content})).digest('hex');}
