import {createHash,createSign} from 'node:crypto';
import {z} from 'zod';
import type {ProviderDescriptor} from './index';

export const geminiProviderId='gemini';
export const geminiModelId='gemini-3.1-flash-lite';
const tokenEndpoint='https://oauth2.googleapis.com/token';
const keyLookupEndpoint='https://apikeys.googleapis.com/v2/keys:lookupKey';
const keyMetadataEndpoint='https://apikeys.googleapis.com/v2/';
const billingEndpoint='https://cloudbilling.googleapis.com/v1/projects/';
const modelEndpoint='https://generativelanguage.googleapis.com/v1beta/models/';
const maxEvidenceAgeMs=60_000;

export class GeminiProviderError extends Error{
 constructor(readonly code:string){super('Gemini provider preflight or response validation failed.');}
}
export type GeminiTransport=(url:string,init:RequestInit)=>Promise<Response>;
export type GeminiCredentials={apiKey:string;serviceAccountJson:string};
const serviceAccount=z.strictObject({type:z.literal('service_account'),project_id:z.string().min(1).max(128),client_email:z.string().email(),private_key:z.string().min(100),token_uri:z.literal(tokenEndpoint).optional()});
const responseJson=z.record(z.string(),z.unknown());
const modelInfo=z.object({name:z.string(),version:z.string().optional(),inputTokenLimit:z.number().int().positive(),outputTokenLimit:z.number().int().positive(),supportedGenerationMethods:z.array(z.string())});
const tokenCount=z.object({totalTokens:z.number().int().positive()});
const generation=z.object({
 candidates:z.array(z.object({content:z.object({parts:z.array(z.object({text:z.string().max(65536)})).min(1).max(20)}),finishReason:z.string().optional()})).length(1),
 usageMetadata:z.object({promptTokenCount:z.number().int().positive(),candidatesTokenCount:z.number().int().min(0),thoughtsTokenCount:z.number().int().min(0).optional(),totalTokenCount:z.number().int().positive()})
});
type Probe={provider:ProviderDescriptor;fingerprint:string;context:number;accountScope:string;evidenceRef:string;checkedAt:string;modelVersion:string};

function b64(value:string|Buffer){return Buffer.from(value).toString('base64url');}
function nowPlus(now:number,ms:number){return new Date(now+ms).toISOString();}
function parse<T>(schema:z.ZodType<T>,value:unknown,code:string):T{const result=schema.safeParse(value);if(!result.success)throw new GeminiProviderError(code);return result.data;}
function blockedDescriptor(configured:boolean):ProviderDescriptor{return {id:geminiProviderId,enabled:configured,configured,accountScope:null,models:configured?[{
 id:geminiModelId,capabilities:['text'],contextWindowTokens:1,maxOutputTokens:1,priority:10,enabled:true,
 availability:{status:'unknown',checkedAt:null,expiresAt:null,remainingRequests:null},
 cost:{status:'unknown',amountUsd:null,checkedAt:null,expiresAt:null,evidenceRef:null,accountScope:null,maxInputTokens:null,maxOutputTokens:null,billingHardLimitUsd:null,paidFallbackEnabled:true}
}]:[]};}
async function readJson(response:Response,maxBytes=262144):Promise<unknown>{
 if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''))throw new GeminiProviderError('GEMINI_PROTOCOL_ERROR');
 if(!response.body)throw new GeminiProviderError('GEMINI_PROTOCOL_ERROR');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw new GeminiProviderError('GEMINI_RESPONSE_TOO_LARGE');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 try{return responseJson.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks.map(c=>Buffer.from(c))))));}
 catch(error){if(error instanceof GeminiProviderError)throw error;throw new GeminiProviderError('GEMINI_PROTOCOL_ERROR');}
}
function requestSignal(signal?:AbortSignal){return signal?AbortSignal.any([signal,AbortSignal.timeout(12_000)]):AbortSignal.timeout(12_000);}

export function createGeminiAdapter(options:{credentials:()=>GeminiCredentials|undefined;transport?:GeminiTransport;now?:()=>Date}){
 const transport=options.transport??((url,init)=>fetch(url,init));
 let tokenCache:{value:string;expiresAt:number}|undefined;
 function credentials(){
  if(!options.credentials)throw new GeminiProviderError('GEMINI_CREDENTIALS_UNAVAILABLE');
  const value=options.credentials();if(!value?.apiKey||!value.serviceAccountJson)throw new GeminiProviderError('GEMINI_CREDENTIALS_UNAVAILABLE');
  let decoded:unknown;try{decoded=JSON.parse(value.serviceAccountJson);}catch{throw new GeminiProviderError('GEMINI_CREDENTIALS_INVALID');}
  const parsed=parse(serviceAccount,decoded,'GEMINI_CREDENTIALS_INVALID');
  return {apiKey:value.apiKey,account:parsed};
 }
 async function accessToken(signal?:AbortSignal){
  const now=(options.now?.()??new Date()).getTime();if(tokenCache&&tokenCache.expiresAt>now+60_000)return tokenCache.value;
  const {account}=credentials(),issued=Math.floor(now/1000),header=b64(JSON.stringify({alg:'RS256',typ:'JWT'})),claim=b64(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:tokenEndpoint,iat:issued,exp:issued+3600}));
  const signer=createSign('RSA-SHA256');signer.update(header+'.'+claim);signer.end();const assertion=header+'.'+claim+'.'+signer.sign(account.private_key,'base64url');
  let response:Response;try{response=await transport(tokenEndpoint,{method:'POST',redirect:'error',signal:requestSignal(signal),headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});}
  catch{throw new GeminiProviderError('GEMINI_BILLING_AUTH_UNAVAILABLE');}
  if(!response.ok)throw new GeminiProviderError('GEMINI_BILLING_AUTH_UNAVAILABLE');
  const data=parse(z.object({access_token:z.string().min(20).max(8192),expires_in:z.number().int().positive()}),await readJson(response,32768),'GEMINI_BILLING_AUTH_INVALID');
  tokenCache={value:data.access_token,expiresAt:now+Math.min(data.expires_in,3600)*1000};return data.access_token;
 }
 async function billingProof(apiKey:string,signal?:AbortSignal){
  const bearer=await accessToken(signal);let response:Response;
  try{response=await transport(keyLookupEndpoint+'?keyString='+encodeURIComponent(apiKey),{method:'GET',redirect:'error',signal:requestSignal(signal),headers:{Authorization:'Bearer '+bearer,Accept:'application/json'}});}
  catch{throw new GeminiProviderError('GEMINI_BILLING_PROOF_UNAVAILABLE');}
  if(!response.ok)throw new GeminiProviderError('GEMINI_BILLING_PROOF_UNAVAILABLE');
  const lookup=parse(z.object({parent:z.string().regex(/^projects\/[0-9]+\/locations\/global$/),name:z.string().regex(/^projects\/[0-9]+\/locations\/global\/keys\/[a-zA-Z0-9_-]+$/)}),await readJson(response,32768),'GEMINI_BILLING_PROOF_INVALID');
  const projectNumber=lookup.parent.split('/')[1];let billing:Response;
  let keyMetadata:Response;
  try{keyMetadata=await transport(keyMetadataEndpoint+lookup.name,{method:'GET',redirect:'error',signal:requestSignal(signal),headers:{Authorization:'Bearer '+bearer,Accept:'application/json'}});}
  catch{throw new GeminiProviderError('GEMINI_KEY_SCOPE_UNAVAILABLE');}
  if(!keyMetadata.ok)throw new GeminiProviderError('GEMINI_KEY_SCOPE_UNAVAILABLE');
  const restrictions=parse(z.object({restrictions:z.object({apiTargets:z.array(z.object({service:z.string(),methods:z.array(z.string()).optional()})).min(1)})}),await readJson(keyMetadata,32768),'GEMINI_KEY_SCOPE_INVALID');
  if(restrictions.restrictions.apiTargets.length!==1||restrictions.restrictions.apiTargets[0].service!=='generativelanguage.googleapis.com')throw new GeminiProviderError('GEMINI_KEY_SCOPE_TOO_BROAD');
  try{billing=await transport(billingEndpoint+encodeURIComponent(projectNumber)+'/billingInfo',{method:'GET',redirect:'error',signal:requestSignal(signal),headers:{Authorization:'Bearer '+bearer,Accept:'application/json'}});}
  catch{throw new GeminiProviderError('GEMINI_BILLING_PROOF_UNAVAILABLE');}
  if(!billing.ok)throw new GeminiProviderError('GEMINI_BILLING_PROOF_UNAVAILABLE');
  const info=parse(z.object({projectId:z.string().min(1),billingEnabled:z.boolean(),billingAccountName:z.string().optional()}),await readJson(billing,32768),'GEMINI_BILLING_PROOF_INVALID');
  if(info.billingEnabled||Boolean(info.billingAccountName))throw new GeminiProviderError('GEMINI_BILLING_ENABLED');
  return {projectNumber,accountScope:'google-project-'+projectNumber,evidenceRef:'google-project-billing-disabled',projectId:info.projectId};
 }
 async function google<T>(url:string,method:'GET'|'POST',apiKey:string,signal:AbortSignal|undefined,body?:unknown,schema?:z.ZodType<T>,code='GEMINI_PROTOCOL_ERROR'):Promise<T>{
  let response:Response;try{response=await transport(url,{method,redirect:'error',signal:requestSignal(signal),headers:{Accept:'application/json','x-goog-api-key':apiKey,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{throw new GeminiProviderError('GEMINI_CONNECTION_FAILED');}
  if(!response.ok)throw new GeminiProviderError(url.endsWith(':countTokens')&&response.status===429?'GEMINI_RATE_LIMITED':'GEMINI_HTTP_'+response.status);
  const raw=await readJson(response);return schema?parse(schema,raw,code):raw as T;
 }
 async function probe(signal?:AbortSignal):Promise<Probe>{
  const {apiKey}=credentials(),billing=await billingProof(apiKey,signal),now=(options.now?.()??new Date()).getTime();
  const info=await google(modelEndpoint+geminiModelId,'GET',apiKey,signal,undefined,modelInfo,'GEMINI_MODEL_INVALID');
  if(info.name!=='models/'+geminiModelId||!info.supportedGenerationMethods.includes('generateContent'))throw new GeminiProviderError('GEMINI_MODEL_UNAVAILABLE');
  const checkedAt=new Date(now).toISOString(),expiresAt=nowPlus(now,maxEvidenceAgeMs),fingerprint=createHash('sha256').update(JSON.stringify([geminiProviderId,info.name,info.version??null,info.inputTokenLimit,info.outputTokenLimit,billing.projectNumber])).digest('hex');
  return {provider:{id:geminiProviderId,enabled:true,configured:true,accountScope:billing.accountScope,models:[{
   id:geminiModelId,capabilities:['text'],contextWindowTokens:info.inputTokenLimit+info.outputTokenLimit,maxOutputTokens:Math.min(128,info.outputTokenLimit),priority:10,enabled:true,
   availability:{status:'available',checkedAt,expiresAt,remainingRequests:1},
   cost:{status:'verified-zero',amountUsd:0,checkedAt,expiresAt,evidenceRef:billing.evidenceRef,accountScope:billing.accountScope,maxInputTokens:info.inputTokenLimit,maxOutputTokens:Math.min(128,info.outputTokenLimit),billingHardLimitUsd:0,paidFallbackEnabled:false}
  }]},fingerprint,context:info.inputTokenLimit+info.outputTokenLimit,accountScope:billing.accountScope,evidenceRef:billing.evidenceRef,checkedAt,modelVersion:info.version??info.name};
 }
 return {
  async probe(signal?:AbortSignal){return probe(signal);},
  async registry(signal?:AbortSignal){
   try{return (await probe(signal)).provider;}
   catch{return blockedDescriptor(Boolean(options.credentials()?.apiKey&&options.credentials()?.serviceAccountJson));}
  },
  async tokenize(prompt:string,signal?:AbortSignal){
   const {apiKey}=credentials(),result=await google(modelEndpoint+geminiModelId+':countTokens','POST',apiKey,signal,{contents:[{role:'user',parts:[{text:prompt}]}]},tokenCount,'GEMINI_TOKEN_COUNT_INVALID');return result.totalTokens;
  },
  async revalidate(fingerprint:string,signal?:AbortSignal){const current=await probe(signal);if(current.fingerprint!==fingerprint)throw new GeminiProviderError('GEMINI_MODEL_CHANGED');return current;},
  async generate(prompt:string,maxOutputTokens:number,signal?:AbortSignal){
   const {apiKey}=credentials();
   const result=await google(modelEndpoint+geminiModelId+':generateContent','POST',apiKey,signal,{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0,maxOutputTokens}},generation,'GEMINI_USAGE_INVALID');
   const usage=result.usageMetadata,outputTokens=usage.candidatesTokenCount+(usage.thoughtsTokenCount??0),inputTokens=usage.promptTokenCount;
   if(inputTokens+outputTokens>usage.totalTokenCount||outputTokens>maxOutputTokens)throw new GeminiProviderError('GEMINI_USAGE_MISMATCH');
   const text=result.candidates[0].content.parts.map(part=>part.text).join('');if(!text.trim()||Buffer.byteLength(text,'utf8')>65536)throw new GeminiProviderError('GEMINI_OUTPUT_INVALID');
   return {text,inputTokens,outputTokens,totalTokens:usage.totalTokenCount};
  },
  async describeBlocked(){return blockedDescriptor(Boolean(options.credentials()?.apiKey&&options.credentials()?.serviceAccountJson));}
 };
}

