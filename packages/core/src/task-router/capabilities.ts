import {routeModel,type RoutingOptions,type ModelRequest} from '../model-router';

// Server-owned metadata. Naming an implementation never enables an adapter.
const definitions = {
 text_generation: {label:'AI text generation',implementations:['model-router']},
 document_generation: {label:'Document generation',implementations:['node-document','python-document']},
 artifact_storage: {label:'File storage',implementations:['artifact-service']},
 approved_delivery: {label:'Approved external delivery',implementations:['email-delivery']},
 owner_review: {label:'Owner review',implementations:['local-owner']},
 recorded_job_result: {label:'Recorded job result verification',implementations:['recorded-job-verifier']},
 document_validation: {label:'Document format verification',implementations:['python-docx-validator']},
 artifact_registration: {label:'Artifact integrity verification',implementations:['artifact-service']},
 delivery_confirmation: {label:'Delivery confirmation verification',implementations:['delivery-verifier']}
} as const;
const readyImplementation:Partial<Record<keyof typeof definitions,string>>={
 owner_review:'local-owner',recorded_job_result:'recorded-job-verifier',
 document_generation:'python-document',document_validation:'python-docx-validator',
 artifact_storage:'artifact-service',artifact_registration:'artifact-service'
};
export type EmailDeliveryRouteSnapshot={eligible:boolean;confirmationReady:boolean;reason:string;checkedAt:string;validUntil:string|null;costStatus:'owner-attested-zero'|'unknown';costEvidenceRef:string|null;from:string|null};
type CapabilityRoutingOptions=RoutingOptions&{emailDelivery?:EmailDeliveryRouteSnapshot};
export function getCapabilityCatalog(){
 return {catalogVersion:'2',executionEnabled:false,permissions:[],capabilities:Object.entries(definitions).map(([id,d])=>({id,label:d.label,implementations:[...d.implementations]}))};
}
export function routeCapability(id:string,budget:Pick<ModelRequest,'inputTokens'|'outputTokens'>|undefined,options:CapabilityRoutingOptions={}){
 const known=Object.hasOwn(definitions,id)?definitions[id as keyof typeof definitions]:undefined;
 const base={capabilityId:id,label:known?.label??id,routerVersion:'capabilities-2',executionEnabled:false as const,permissions:[],validUntil:null as string|null,costStatus:'unknown' as 'unknown'|'owner-attested-zero',costEvidenceRef:null as string|null};
 if(!known)return {...base,status:'blocked' as const,selected:null,reason:'UNKNOWN_CAPABILITY',evaluations:[]};
 if(id==='text_generation'){
  if(!budget)return {...base,status:'blocked' as const,selected:null,reason:'MODEL_BUDGET_REQUIRED',evaluations:[]};
  const modelDecision=routeModel({...budget,capabilities:['text']},options);
  return {...base,status:modelDecision.status as 'selected'|'blocked',selected:modelDecision.selected?{implementationId:'model-router',...modelDecision.selected}:null,
   reason:modelDecision.reason,validUntil:modelDecision.validUntil,modelDecision,evaluations:modelDecision.evaluations};
 }
 if(id==='approved_delivery'||id==='delivery_confirmation'){
  const snapshot=options.emailDelivery,eligible=snapshot?.eligible===true&&snapshot.confirmationReady===true&&snapshot.validUntil!==null&&Date.parse(snapshot.validUntil)>=(options.now??new Date()).getTime();
  const implementationId=id==='approved_delivery'?'email-delivery':'delivery-verifier';
  return {...base,status:eligible?'selected' as const:'blocked' as const,
   selected:eligible?{implementationId,...(id==='approved_delivery'?{providerId:'resend'}:{})}:null,
   reason:eligible?'RESEND_SENDER_VERIFIED_ZERO_COST_OWNER_ATTESTED_AND_WEBHOOK_READY':snapshot?.eligible&&snapshot.confirmationReady!==true?'RESEND_SIGNED_WEBHOOK_NOT_CONFIGURED':snapshot?.reason??'EMAIL_ZERO_COST_ROUTE_UNAVAILABLE',
   checkedAt:snapshot?.checkedAt??null,validUntil:snapshot?.validUntil??null,costStatus:snapshot?.costStatus??'unknown',costEvidenceRef:snapshot?.costEvidenceRef??null,
   evaluations:known.implementations.map(candidate=>({implementationId:candidate,eligible:eligible&&candidate===implementationId,
    availability:eligible?'available':'not-configured',costStatus:snapshot?.costStatus??'unknown',costEvidenceRef:snapshot?.costEvidenceRef??null,
    reasons:eligible?[]:[snapshot?.reason??'EMAIL_ZERO_COST_ROUTE_UNAVAILABLE']}))};
 }
 const implementationId=readyImplementation[id as keyof typeof definitions],available=Boolean(implementationId);
 return {...base,status:available?'selected' as const:'blocked' as const,
  selected:available?{implementationId}:null,
  reason:available?'LOCAL_IMPLEMENTATION_SNAPSHOT':'IMPLEMENTATION_NOT_AVAILABLE',
  evaluations:known.implementations.map(candidate=>{
   const eligible=candidate===implementationId;return {implementationId:candidate,eligible,
    availability:eligible?'implemented':'not-implemented',costStatus:eligible?'intrinsic-zero-api-spend':'unknown',
    reasons:eligible?[]:['NOT_IMPLEMENTED','ZERO_COST_UNVERIFIED']};
  })};
}
