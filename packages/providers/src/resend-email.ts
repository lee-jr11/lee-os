import {createHmac,timingSafeEqual} from 'node:crypto';

export type ResendEnvironment=Record<string,string|undefined>;
export type ResendAttachment={filename:string;content:Uint8Array;contentType:string};
export type ResendEmailRequest={effectId:string;to:string;subject:string;text:string;attachments:ResendAttachment[]};
export type ResendInspection={eligible:boolean;confirmationReady:boolean;reason:string;checkedAt:string;validUntil:string|null;costStatus:'owner-attested-zero'|'unknown';costEvidenceRef:string|null;from:string|null};
export type ResendSendResult={kind:'accepted';emailId:string}|{kind:'retryable';reason:string}|{kind:'rejected';reason:string};
const API='https://api.resend.com';
const senderEmail=(from:string)=>from.match(/<([^<>]+)>/)?.[1]??from;
const validEmail=(value:string)=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);

function costAttestation(env:ResendEnvironment,now:Date){
 const at=env.LEEOS_RESEND_ZERO_COST_CONFIRMED_AT;
 const parsed=at?Date.parse(at):NaN,age=now.getTime()-parsed;
 return env.LEEOS_RESEND_FREE_PLAN_CONFIRMED==='1'&&env.LEEOS_RESEND_PAYG_DISABLED==='1'&&Number.isFinite(parsed)&&age>=0&&age<=24*60*60*1000;
}

/** Resend adapter. The API key is read only on the server and never included in results. */
export function createResendEmailAdapter(options:{env?:ResendEnvironment;fetch?:typeof fetch;now?:()=>Date;enabled?:()=>boolean}={}){
 const env=options.env??process.env,transport=options.fetch??fetch,now=options.now??(()=>new Date());
 const enabled=options.enabled??(()=>env.LEEOS_RESEND_EMAIL_ENABLED==='1');
 async function inspect(signal?:AbortSignal):Promise<ResendInspection>{
  const checked=now(),checkedAt=checked.toISOString(),key=env.RESEND_API_KEY,from=env.RESEND_FROM_EMAIL;
  const base={checkedAt,confirmationReady:Boolean(env.RESEND_WEBHOOK_SECRET),validUntil:null as string|null,costStatus:'unknown' as const,costEvidenceRef:null as string|null,from:from??null};
  if(!enabled())return {...base,eligible:false,reason:'EMAIL_PROVIDER_DISABLED'};
  if(!key||!from||!validEmail(senderEmail(from)))return {...base,eligible:false,reason:'EMAIL_PROVIDER_CONFIGURATION_INCOMPLETE'};
  if(!costAttestation(env,checked))return {...base,eligible:false,reason:'FRESH_ZERO_COST_OWNER_ATTESTATION_REQUIRED'};
  try{
   const response=await transport(`${API}/domains`,{method:'GET',headers:{Authorization:`Bearer ${key}`},cache:'no-store',redirect:'error',signal});
   if(!response.ok)return {...base,eligible:false,reason:'RESEND_DOMAIN_CHECK_FAILED'};
   const payload=await response.json() as {data?:Array<{name?:string;status?:string}>};
   const domain=senderEmail(from).split('@')[1]?.toLowerCase();
   const verified=payload.data?.some(item=>item.name?.toLowerCase()===domain&&item.status==='verified')===true;
   if(!verified)return {...base,eligible:false,reason:'RESEND_SENDER_DOMAIN_NOT_VERIFIED'};
   const validUntil=new Date(checked.getTime()+5*60*1000).toISOString();
   const stamp=env.LEEOS_RESEND_ZERO_COST_CONFIRMED_AT!;
   return {eligible:true,confirmationReady:Boolean(env.RESEND_WEBHOOK_SECRET),reason:'RESEND_DOMAIN_VERIFIED_AND_ZERO_COST_OWNER_ATTESTED',checkedAt,validUntil,costStatus:'owner-attested-zero',costEvidenceRef:`resend-free-plan-owner-attestation:${new Date(stamp).toISOString().slice(0,10)}`,from};
  }catch{return {...base,eligible:false,reason:'RESEND_INSPECTION_UNAVAILABLE'};}
 }
 async function send(value:ResendEmailRequest,idempotencyKey:string,signal?:AbortSignal):Promise<ResendSendResult>{
  const verdict=await inspect(signal);if(!verdict.eligible)return {kind:'rejected',reason:verdict.reason};
  const key=env.RESEND_API_KEY!;
  const payload={from:verdict.from!,to:[value.to],subject:value.subject,text:value.text,
   tags:[{name:'leeos_effect',value:value.effectId.replace(/[^A-Za-z0-9_-]/g,'_')}],
   ...(value.attachments.length?{attachments:value.attachments.map(item=>({filename:item.filename,content:Buffer.from(item.content).toString('base64'),content_type:item.contentType}))}:{})};
  let response:Response;
  try{response=await transport(`${API}/emails`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal});}
  catch{return {kind:'retryable',reason:'RESEND_TRANSPORT_OUTCOME_AMBIGUOUS'};}
  if(response.ok){try{const result=await response.json() as {id?:unknown};return typeof result.id==='string'&&result.id.length<=200?{kind:'accepted',emailId:result.id}:{kind:'retryable',reason:'RESEND_RESPONSE_UNREADABLE'};}catch{return {kind:'retryable',reason:'RESEND_RESPONSE_UNREADABLE'};}}
  if(response.status>=500||response.status===429)return {kind:'retryable',reason:response.status===429?'RESEND_RATE_LIMITED':'RESEND_PROVIDER_TEMPORARY_FAILURE'};
  if(response.status===409)return {kind:'retryable',reason:'RESEND_IDEMPOTENT_REQUEST_IN_PROGRESS'};
  return {kind:'rejected',reason:`RESEND_REJECTED_${response.status}`};
 }
 return {inspect,send};
}

export function verifyResendWebhook(input:{payload:string;secret:string;id:string|null;timestamp:string|null;signature:string|null;now?:Date;toleranceSeconds?:number}):boolean{
 const {payload,secret,id,timestamp,signature}=input,now=input.now??new Date(),tolerance=input.toleranceSeconds??300;
 if(!secret.startsWith('whsec_')||!id||!timestamp||!signature||!/^[A-Za-z0-9._-]{1,200}$/.test(id)||!/^\d{1,12}$/.test(timestamp))return false;
 const epoch=Number(timestamp),age=Math.abs(Math.floor(now.getTime()/1000)-epoch);if(!Number.isSafeInteger(epoch)||age>tolerance)return false;
 let key:Buffer;try{key=Buffer.from(secret.slice(6),'base64');}catch{return false;}if(key.byteLength<16)return false;
 const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${payload}`).digest();
 for(const candidate of signature.split(' ')){
  const match=/^v1,([A-Za-z0-9+/=]+)$/.exec(candidate);if(!match)continue;
  try{const supplied=Buffer.from(match[1],'base64');if(supplied.byteLength===expected.byteLength&&timingSafeEqual(supplied,expected))return true;}catch{/* Ignore malformed candidate signatures. */}
 }
 return false;
}

export function parseResendDeliveryEvent(value:unknown):{providerEventId:string;kind:'accepted'|'delivered'|'failed'|'ignored';emailId:string|null;effectId:string|null;recipient:string|null;eventType:string}{
 const body=value&&typeof value==='object'?value as Record<string,unknown>:{},data=body.data&&typeof body.data==='object'?body.data as Record<string,unknown>:{},
  eventType=typeof body.type==='string'?body.type:'',tags=data.tags&&typeof data.tags==='object'?data.tags as Record<string,unknown>:{},
  effect=tags.leeos_effect,addresses=Array.isArray(data.to)?data.to:[],recipient=addresses.length===1&&typeof addresses[0]==='string'?addresses[0].trim().toLowerCase():null,
  emailId=typeof data.email_id==='string'?data.email_id:null;
 const kind=eventType==='email.sent'?'accepted':eventType==='email.delivered'?'delivered':eventType==='email.bounced'||eventType==='email.failed'?'failed':'ignored';
 return {providerEventId:'',kind,emailId,effectId:typeof effect==='string'&&/^eff_[A-Za-z0-9_-]{1,80}$/.test(effect)?effect:null,recipient,eventType:eventType.slice(0,100)};
}
