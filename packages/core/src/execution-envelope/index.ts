import {createHash} from 'node:crypto';
import {z} from 'zod';
import {requirementsContent,requirementsDigest} from '../requirements';
import {planDigest} from '../execution-manager';
import type {CapabilityPlan} from '../orchestrator/capability-plan';

const key=z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const gemini503RetryPolicy={
 maxProviderAttempts:2,
 retryableReason:'GEMINI_HTTP_503',
 maxAutomaticRetries:1,
 backoff:{strategy:'exponential',baseDelayMs:5000,maxDelayMs:30000},
 revalidateBeforeRetry:{costPolicy:'ZERO_ONLY',billing:true,modelFingerprint:true},
 retryCallIdentity:'new-durable-call-per-attempt',
 uncertainOutcome:'recovery-required-no-retry'
} as const;
const gemini503RetryPolicySchema=z.strictObject({
 maxProviderAttempts:z.literal(2),retryableReason:z.literal('GEMINI_HTTP_503'),maxAutomaticRetries:z.literal(1),
 backoff:z.strictObject({strategy:z.literal('exponential'),baseDelayMs:z.literal(5000),maxDelayMs:z.literal(30000)}),
 revalidateBeforeRetry:z.strictObject({costPolicy:z.literal('ZERO_ONLY'),billing:z.literal(true),modelFingerprint:z.literal(true)}),
 retryCallIdentity:z.literal('new-durable-call-per-attempt'),uncertainOutcome:z.literal('recovery-required-no-retry')
});
export const envelopeId=z.string().regex(/^env_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const text=z.string().min(1).max(8192).refine(v=>Buffer.byteLength(v,'utf8')<=8192);
const textLeaf=z.discriminatedUnion('source',[
 z.strictObject({source:z.literal('literal'),text}),
 z.strictObject({source:z.literal('contract-input'),inputId:key}),
 z.strictObject({source:z.literal('operation-output'),operationKey:key,output:z.literal('text')})
]);
const textInput=z.union([textLeaf,z.strictObject({source:z.literal('text-parts'),parts:z.array(textLeaf).min(1).max(20),separator:z.string().max(32)})]);
const operationArtifact=z.strictObject({source:z.literal('operation-artifact'),operationKey:key});
const common={key,requirementIds:z.array(key).min(1).max(50),dependsOn:z.array(key).max(50)};
const docxDocument=z.strictObject({title:textInput,sections:z.array(z.strictObject({heading:textInput,paragraphs:z.array(textInput).min(1).max(40)})).min(1).max(30)});
const docxName=z.string().trim().min(6).max(180).regex(/^[\p{L}\p{N}][^\p{Cc}\p{Cf}<>:"/\\|?*]*\.docx$/u).refine(v=>!/[. ]\.docx$/i.test(v),'Unsafe DOCX filename.');
const emailAddress=z.string().trim().email().max(254);
export const envelopeDraft=z.strictObject({
 expectedRunVersion:z.number().int().min(0).max(2147483646),reviewedPlanDigest:digest,
 grantExpiresAt:z.iso.datetime({offset:true}),
 contractInputs:z.record(key,text).refine(v=>Object.keys(v).length<=30).default({}),
 constraints:z.union([
  z.strictObject({location:z.literal('local'),network:z.literal('loopback-only'),externalEffects:z.literal('none'),maxAttempts:z.literal(1),maxInputBytes:z.literal(8192),spendLimitUsd:z.literal(0)}),
  z.strictObject({location:z.literal('remote'),network:z.literal('provider-allowlist-only'),externalEffects:z.literal('none'),maxAttempts:z.literal(1),maxInputBytes:z.literal(8192),spendLimitUsd:z.literal(0)}),
  z.strictObject({location:z.literal('remote'),network:z.literal('provider-allowlist-only'),externalEffects:z.literal('approved-email-only'),maxAttempts:z.literal(1),maxInputBytes:z.literal(8192),spendLimitUsd:z.literal(0)})
 ]),
 operations:z.array(z.discriminatedUnion('kind',[
  z.strictObject({...common,kind:z.literal('text.generate'),input:textInput,maxOutputTokens:z.number().int().min(1).max(128),modelFingerprint:digest,providerRetryPolicy:gemini503RetryPolicySchema.optional()}),
  z.strictObject({...common,kind:z.literal('owner.review'),inputs:z.array(textInput).min(1).max(20),artifacts:z.array(operationArtifact).max(10).default([])}),
  z.strictObject({...common,kind:z.literal('docx.generate'),name:docxName,document:docxDocument}),
  z.strictObject({...common,kind:z.literal('email.send'),to:emailAddress,subject:textInput,text:textInput,attachments:z.array(z.strictObject({source:z.literal('operation-artifact'),operationKey:key})).max(10).default([]),deliveryPolicy:z.literal('verified-zero-only')})
 ])).min(1).max(50),
 acceptanceBindings:z.array(z.strictObject({criterionId:key,operationKey:key})).min(1).max(50)
});
export const envelopeAccept=envelopeDraft.extend({idempotencyKey:z.string().regex(/^[A-Za-z0-9._:-]{1,120}$/),reviewedEnvelopeDigest:digest,acknowledgeAuthorization:z.literal(true)});
export const envelopeRevoke=z.strictObject({reviewedEnvelopeDigest:digest,acknowledgeRevocation:z.literal(true),reason:z.string().trim().min(1).max(2000)});
export type EnvelopeDraft=z.infer<typeof envelopeDraft>;
function canonical(v:unknown):string{
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object')return '{'+Object.keys(v).filter(k=>(v as Record<string,unknown>)[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(v);
}
export function envelopeDigest(v:unknown){return createHash('sha256').update(canonical(v)).digest('hex');}
const capabilityFor=(kind:'text.generate'|'owner.review'|'docx.generate'|'email.send')=>kind==='text.generate'?'text_generation':kind==='owner.review'?'owner_review':kind==='email.send'?'approved_delivery':'document_generation';
function operationInputs(operation:EnvelopeDraft['operations'][number]){
 if(operation.kind==='text.generate')return [operation.input];
 if(operation.kind==='owner.review')return operation.inputs;
 if(operation.kind==='email.send')return [operation.subject,operation.text];
 return [operation.document.title,...operation.document.sections.flatMap(section=>[section.heading,...section.paragraphs])];
}
export function compileEnvelope(run:{id:string;projectId:string;version:number},planVersion:number,planValue:unknown,value:unknown,now=new Date()){
 const draft=envelopeDraft.parse(value),p=planValue as CapabilityPlan;
 const blockers:string[]=[];
 if(!p||p.plannerVersion!=='3'||p.mode!=='capability-first'||p.costPolicy!=='ZERO_ONLY'||p.executionEnabled!==false)return {canAccept:false as const,blockers:['CAPABILITY_PLAN_REQUIRED'],candidate:null,digest:null};
 const content=requirementsContent.parse(p.contract.content);
 if(p.contract.digest!==requirementsDigest(p.contract.id,p.contract.revision,content))blockers.push('CONTRACT_DIGEST_MISMATCH');
 if(draft.expectedRunVersion!==run.version||planVersion!==run.version)blockers.push('RUN_VERSION_CHANGED');
 if(draft.reviewedPlanDigest!==planDigest(run.id,planVersion,p))blockers.push('PLAN_DIGEST_CHANGED');
 if(p.routingStatus!=='covered'||p.routingBlockers.length)blockers.push('ROUTING_GAPS');
 // Free text is retained, but never silently treated as an enforced constraint.
 if(content.constraints.length)blockers.push('UNRESOLVED_PROSE_CONSTRAINTS');
 const expires=Date.parse(draft.grantExpiresAt);
 if(!Number.isFinite(now.getTime())||expires<=now.getTime()||expires>now.getTime()+86400000)blockers.push('GRANT_EXPIRY_OUT_OF_RANGE');
 const operations=draft.operations,byKey=new Map(operations.map(o=>[o.key,o]));
 if(byKey.size!==operations.length)blockers.push('DUPLICATE_OPERATION_KEYS');
 const refs=(o:typeof operations[number])=>operationInputs(o).flatMap(v=>v.source==='text-parts'?v.parts:[v]);
 const artifactRefs=(o:typeof operations[number])=>o.kind==='owner.review'?o.artifacts:[];
 for(const input of content.inputs)if(input.required&&!Object.hasOwn(draft.contractInputs,input.id))blockers.push('CONTRACT_INPUT_MISSING:'+input.id);
 for(const id of Object.keys(draft.contractInputs))if(!content.inputs.some(i=>i.id===id))blockers.push('UNKNOWN_CONTRACT_INPUT:'+id);
 for(const input of content.inputs.filter(i=>i.required))if(!operations.some(o=>refs(o).some(ref=>ref.source==='contract-input'&&ref.inputId===input.id)))blockers.push('CONTRACT_INPUT_UNUSED:'+input.id);
 for(const o of operations){
  if(new Set(o.dependsOn).size!==o.dependsOn.length||o.dependsOn.some(k=>k===o.key||!byKey.has(k)))blockers.push('INVALID_DEPENDENCY:'+o.key);
  if(new Set(o.requirementIds).size!==o.requirementIds.length||o.requirementIds.some(id=>!content.requirements.some(r=>r.id===id)))blockers.push('INVALID_REQUIREMENT_SCOPE:'+o.key);
  for(const ref of artifactRefs(o))if(!o.dependsOn.includes(ref.operationKey)||byKey.get(ref.operationKey)?.kind!=='docx.generate')blockers.push('INVALID_ARTIFACT_BINDING:'+o.key);
  const capability=capabilityFor(o.kind),need=p.capabilities.find(n=>n.id===capability);
  if(!need||need.route.status!=='selected'||!need.route.selected)blockers.push('CAPABILITY_NOT_SELECTED:'+o.key);
  if(o.requirementIds.some(id=>{
   const r=content.requirements.find(r=>r.id===id);
   const textProducers=o.kind==='docx.generate'?operations.filter(producer=>producer.kind==='text.generate'&&producer.requirementIds.includes(id)):[];
   const assemblesText=textProducers.length>0&&textProducers.every(producer=>refs(o).some(ref=>ref.source==='operation-output'&&ref.operationKey===producer.key));
   return !r?.capabilityIds?.includes(capability)&&!(o.kind==='owner.review'&&content.acceptanceCriteria.some(c=>c.evidenceKind==='owner-review'&&c.requirementIds.includes(id)))&&!(o.kind==='docx.generate'&&(assemblesText||r?.capabilityIds?.some(id=>['artifact_storage','document_generation'].includes(id))));
  }))blockers.push('OPERATION_SCOPE_MISMATCH:'+o.key);
  for(const ref of refs(o))if(ref.source==='operation-output'&&(!o.dependsOn.includes(ref.operationKey)||byKey.get(ref.operationKey)?.kind!=='text.generate'))blockers.push('INVALID_OUTPUT_BINDING:'+o.key);
  for(const ref of refs(o))if(ref.source==='contract-input'&&!Object.hasOwn(draft.contractInputs,ref.inputId))blockers.push('INVALID_CONTRACT_INPUT_BINDING:'+o.key);
  // Fully known compositions must also fit the input byte bound. Dynamic
  // output compositions retain the same mandatory dispatch-time bound.
  for(const input of operationInputs(o)){
   const parts=input.source==='text-parts'?input.parts:[input],values=parts.map(part=>part.source==='literal'?part.text:part.source==='contract-input'?draft.contractInputs[part.inputId]:undefined);
   if(values.every(v=>v!==undefined)&&Buffer.byteLength(values.join(input.source==='text-parts'?input.separator:''),'utf8')>8192)blockers.push('RESOLVED_INPUT_TOO_LARGE:'+o.key);
  }
  if(o.kind==='docx.generate'){
   const route=need?.route,storage=p.capabilities.find(n=>n.id==='artifact_storage')?.route,validator=p.capabilities.find(n=>n.id==='document_validation')?.route,artifactVerifier=p.capabilities.find(n=>n.id==='artifact_registration')?.route;
   if(route?.status!=='selected'||route.selected?.implementationId!=='python-document'||storage?.status!=='selected'||storage.selected?.implementationId!=='artifact-service'||validator?.status!=='selected'||validator.selected?.implementationId!=='python-docx-validator'||artifactVerifier?.status!=='selected'||artifactVerifier.selected?.implementationId!=='artifact-service')blockers.push('DOCX_PIPELINE_NOT_ROUTABLE:'+o.key);
   const resolveKnown=(input:typeof o.document.title):string|undefined=>{
    if(input.source==='literal')return input.text;
    if(input.source==='contract-input')return draft.contractInputs[input.inputId];
    if(input.source==='operation-output')return undefined;
    const values=input.parts.map(part=>part.source==='literal'?part.text:part.source==='contract-input'?draft.contractInputs[part.inputId]:undefined);
    return values.some(value=>value===undefined)?undefined:values.join(input.separator);
   };
   const title=resolveKnown(o.document.title),sections=o.document.sections.map(section=>({heading:resolveKnown(section.heading),paragraphs:section.paragraphs.map(resolveKnown)}));
   if(title!==undefined&&sections.every(section=>section.heading!==undefined&&section.paragraphs.every(value=>value!==undefined))){
    const request={name:o.name,document:{title,sections:sections.map(section=>({heading:section.heading as string,paragraphs:section.paragraphs as string[]}))}};
    if(Buffer.byteLength(JSON.stringify(request),'utf8')>draft.constraints.maxInputBytes)blockers.push('RESOLVED_DOCUMENT_TOO_LARGE:'+o.key);
   }
  }
  if(o.kind==='email.send'){
   if(draft.constraints.location!=='remote'||draft.constraints.externalEffects!=='approved-email-only'||need?.route.selected?.implementationId!=='email-delivery'||(need?.route.selected as {providerId?:string}|null)?.providerId!=='resend'||need?.route.costStatus!=='owner-attested-zero'||!need.route.costEvidenceRef||!need.route.validUntil||Date.parse(need.route.validUntil)<=now.getTime())blockers.push('EMAIL_DELIVERY_NOT_AUTHORIZED_OR_ROUTABLE:'+o.key);
   if(Buffer.byteLength(o.to,'utf8')>254||Buffer.byteLength(JSON.stringify({subject:o.subject,text:o.text}),'utf8')>draft.constraints.maxInputBytes)blockers.push('EMAIL_INPUT_TOO_LARGE:'+o.key);
   if(o.attachments.some(ref=>!o.dependsOn.includes(ref.operationKey)||byKey.get(ref.operationKey)?.kind!=='docx.generate'))blockers.push('INVALID_EMAIL_ATTACHMENT_BINDING:'+o.key);
  }else if(o.kind==='text.generate'){
   const route=need?.route,selected=route?.selected as {implementationId:string;providerId?:string;modelId?:string}|null|undefined;
   const model=route&&'modelDecision' in route?route.modelDecision:undefined;
   const providerId=model?.selected?.providerId,modelId=model?.selected?.modelId;
   const local=providerId==='llamacpp-local'&&modelId==='leeos-local'&&draft.constraints.location==='local'&&draft.constraints.network==='loopback-only';
   const gemini=providerId==='gemini'&&modelId==='gemini-3.1-flash-lite'&&draft.constraints.location==='remote'&&draft.constraints.network==='provider-allowlist-only';
   if(!selected||selected.implementationId!=='model-router'||!('providerId' in selected)||!(selected.providerId==='llamacpp-local'||selected.providerId==='gemini')||!(selected.modelId==='leeos-local'||selected.modelId==='gemini-3.1-flash-lite')||!((selected.providerId==='llamacpp-local'&&selected.modelId==='leeos-local')||(selected.providerId==='gemini'&&selected.modelId==='gemini-3.1-flash-lite')))blockers.push('IMPLEMENTATION_UNSUPPORTED:'+o.key);
   if(!local&&!gemini)blockers.push('EXECUTION_LOCATION_PROVIDER_MISMATCH:'+o.key);
   if(!model||model.status!=='selected'||model.costPolicy!=='ZERO_ONLY'||!model.selected||model.selected.providerId!==providerId||model.selected.modelId!==modelId||model.request.capabilities.length!==1||model.request.capabilities[0]!=='text'||o.maxOutputTokens>model.request.outputTokens)blockers.push('MODEL_SCOPE_MISMATCH:'+o.key);
   if(o.providerRetryPolicy&&(!gemini||providerId!=='gemini'))blockers.push('RETRY_POLICY_REQUIRES_GEMINI:'+o.key);
  }else if(o.kind==='owner.review'){
   if(need?.route.selected?.implementationId!=='local-owner')blockers.push('IMPLEMENTATION_UNSUPPORTED:'+o.key);
  }else if(o.kind==='docx.generate'&&need?.route.selected?.implementationId!=='python-document')blockers.push('IMPLEMENTATION_UNSUPPORTED:'+o.key);
 }
 const done=new Set<string>(),ordered:typeof operations=[];
 while(done.size<byKey.size){const o=operations.find(o=>!done.has(o.key)&&o.dependsOn.every(k=>done.has(k)));if(!o){blockers.push('CYCLIC_OR_INVALID_GRAPH');break;}done.add(o.key);ordered.push(o);}
 for(const r of content.requirements.filter(r=>r.required)){
  if(!r.capabilityIds?.length)blockers.push('UNMAPPED_REQUIREMENT:'+r.id);
  for(const cap of r.capabilityIds??[])if(!operations.some(o=>(capabilityFor(o.kind)===cap||(o.kind==='docx.generate'&&cap==='artifact_storage'))&&o.requirementIds.includes(r.id)))blockers.push('REQUIRED_WORK_MISSING:'+r.id+':'+cap);
 }
 for(const need of p.capabilities.filter(n=>n.required&&n.sources.includes('declared-capability')))if(!operations.some(o=>capabilityFor(o.kind)===need.id||(o.kind==='docx.generate'&&need.id==='artifact_storage')))blockers.push('REQUIRED_CAPABILITY_MISSING:'+need.id);
 const bindings=new Map(draft.acceptanceBindings.map(b=>[b.criterionId,b]));
 if(bindings.size!==draft.acceptanceBindings.length)blockers.push('DUPLICATE_ACCEPTANCE_BINDINGS');
 for(const b of draft.acceptanceBindings){
  const c=content.acceptanceCriteria.find(c=>c.id===b.criterionId),op=byKey.get(b.operationKey);
  if(!c||!op||c.requirementIds.some(id=>!op.requirementIds.includes(id))){blockers.push('INVALID_ACCEPTANCE_SCOPE:'+b.criterionId);continue;}
  if(c.evidenceKind==='job-result'){if(c.sourceStepKey!==op.key)blockers.push('SOURCE_STEP_MISMATCH:'+c.id);}
  else if(c.evidenceKind==='owner-review'){
   if(op.kind!=='owner.review')blockers.push('OWNER_REVIEW_REQUIRED:'+c.id);
   for(const producer of operations.filter(o=>o.kind==='text.generate'&&o.requirementIds.some(id=>c.requirementIds.includes(id))))if(!refs(op).some(ref=>ref.source==='operation-output'&&ref.operationKey===producer.key))blockers.push('REVIEW_OUTPUT_MISSING:'+c.id+':'+producer.key);
  }else if(c.evidenceKind==='document-validation'){
   if(op.kind!=='docx.generate'||c.expected?.format!=='docx'||c.expected.font_family!=='Times New Roman'||c.expected.body_font_size_pt!==12)blockers.push('DOCX_VALIDATION_CONTRACT_UNSUPPORTED:'+c.id);
  }else if(c.evidenceKind==='artifact-registration'){
   if(op.kind!=='docx.generate')blockers.push('ARTIFACT_REGISTRATION_REQUIRED:'+c.id);
  }else if(c.evidenceKind==='delivery-confirmation'){
   if(op.kind!=='email.send')blockers.push('EMAIL_DELIVERY_CONFIRMATION_REQUIRED:'+c.id);
  }else blockers.push('VERIFIER_UNSUPPORTED:'+c.id);
 }
 for(const review of operations.filter((o):o is Extract<typeof operations[number],{kind:'owner.review'}>=>o.kind==='owner.review')){
  const isRequiredReview=draft.acceptanceBindings.some(binding=>binding.operationKey===review.key&&content.acceptanceCriteria.some(c=>c.id===binding.criterionId&&c.required&&c.evidenceKind==='owner-review'));
  if(isRequiredReview){
   for(const document of operations.filter((o):o is Extract<typeof operations[number],{kind:'docx.generate'}>=>o.kind==='docx.generate')){
    if(!review.artifacts.some(ref=>ref.operationKey===document.key))blockers.push('OWNER_REVIEW_ARTIFACT_REQUIRED:'+review.key+':'+document.key);
   }
  }
 }
 for(const op of operations.filter(o=>o.kind==='docx.generate')){
  const kinds=draft.acceptanceBindings.filter(binding=>binding.operationKey===op.key).map(binding=>content.acceptanceCriteria.find(c=>c.id===binding.criterionId)?.evidenceKind);
  if(!kinds.includes('document-validation')||!kinds.includes('artifact-registration'))blockers.push('DOCX_ACCEPTANCE_EVIDENCE_REQUIRED:'+op.key);
 }
 for(const op of operations.filter(o=>o.kind==='email.send')){
  const kinds=draft.acceptanceBindings.filter(binding=>binding.operationKey===op.key).map(binding=>content.acceptanceCriteria.find(c=>c.id===binding.criterionId)?.evidenceKind);
  if(!kinds.includes('delivery-confirmation'))blockers.push('EMAIL_DELIVERY_EVIDENCE_REQUIRED:'+op.key);
 }
 for(const c of content.acceptanceCriteria.filter(c=>c.required))if(!bindings.has(c.id))blockers.push('ACCEPTANCE_BINDING_MISSING:'+c.id);
 if(blockers.length)return {canAccept:false as const,blockers:[...new Set(blockers)],candidate:null,digest:null};
 const hasEmail=operations.some(o=>o.kind==='email.send');
 if(hasEmail!==(draft.constraints.externalEffects==='approved-email-only'))return {canAccept:false as const,blockers:['EXTERNAL_EFFECT_SCOPE_MISMATCH'],candidate:null,digest:null};
 const candidate={schemaVersion:'1',run:{...run,authorizedRunVersion:draft.expectedRunVersion},
  contract:p.contract,routing:{planDigest:draft.reviewedPlanDigest,planRunVersion:planVersion,plan:p},
  constraints:draft.constraints,contractInputs:draft.contractInputs,
  operations:ordered.map(o=>{const route=p.capabilities.find(n=>n.id===capabilityFor(o.kind))!.route;return {...o,capabilityId:capabilityFor(o.kind),selectedImplementation:route.selected,
   operationVersion:'1',implementationContractVersion:o.kind==='text.generate'?(route.selected&&'providerId' in route.selected&&route.selected.providerId==='gemini'?(o.providerRetryPolicy?'gemini-free-text-2':'gemini-free-text-1'):'local-text-1'):o.kind==='owner.review'?(o.artifacts.length?'owner-review-request-2':'owner-review-request-1'):o.kind==='docx.generate'?'python-docx-1':'resend-email-1',
   permission:o.kind==='text.generate'?(route.selected&&'providerId' in route.selected&&route.selected.providerId==='gemini'?'remote:gemini-free-text':'local:text'):o.kind==='owner.review'?'owner:review-request':o.kind==='docx.generate'?'document:generate-docx':'external:email-send',requiresHuman:o.kind==='owner.review',
   ...(o.kind==='text.generate'&&'modelDecision' in route?{modelScope:route.modelDecision?.request}:{}),
   ...(o.kind==='docx.generate'?{validatorImplementation:p.capabilities.find(n=>n.id==='document_validation')?.route.selected,storageImplementation:p.capabilities.find(n=>n.id==='artifact_storage')?.route.selected}:{}),
   output:o.kind==='text.generate'?{type:'text',maxBytes:65536}:o.kind==='owner.review'?{type:'owner-decision'}:o.kind==='docx.generate'?{type:'artifact',format:'docx',mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',maxBytes:10485760}:{type:'external-effect',format:'email',provider:'resend',confirmation:'recipient-server-delivery'},consumptionMaxBytes:8192};}),
  acceptanceBindings:draft.acceptanceBindings,acceptanceStatus:'pending',
  authorization:{authority:'local-owner',scope:'exact-envelope-only',expiresAt:draft.grantExpiresAt,maxAttempts:Math.max(1,...operations.filter((o):o is Extract<typeof operations[number],{kind:'text.generate'}>=>o.kind==='text.generate').map(o=>o.providerRetryPolicy?.maxProviderAttempts??1)),attemptScope:'per-operation',noFallback:true},
  costPolicy:{policy:'ZERO_ONLY',maxSpendUsd:0,paidFallbackEnabled:false,revalidationRequiredBeforeDispatch:true},
  dispatch:{enabledAtAcceptance:false,requiredGate:'INDEPENDENT_WORKER_AND_FRESH_ZERO_COST_EVIDENCE',revalidate:['run-and-revocation','grant-expiry','cost-and-availability','model-fingerprint','resolved-input-size-and-tokens']},
  idempotency:{scope:'one-envelope-per-run',operationKeys:ordered.map(o=>o.key),retries:'same-envelope-identity-only'}};
 return {canAccept:true as const,blockers:[],candidate,digest:envelopeDigest(candidate)};
}
export type EnvelopePreview=ReturnType<typeof compileEnvelope>;
