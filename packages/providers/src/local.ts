import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ProviderDescriptor } from './index';
export const localProviderId='llamacpp-local';
export const localModelId='leeos-local';
export class LocalProviderError extends Error {
 constructor(readonly code:string){super('Local model connection failed.');}
}
export type LocalTransport=(path:string,body?:unknown,signal?:AbortSignal)=>Promise<unknown>;
const paths=new Set(['/health','/props','/slots','/tokenize','/completion']);
// Direct HTTP to a literal loopback address: no DNS, proxies, redirects or credentials.
export const localHttp:LocalTransport=(path,body,signal)=>new Promise((resolve,reject)=>{
 if(!paths.has(path))return reject(new LocalProviderError('LOCAL_PATH_DENIED'));
 const data=body===undefined?undefined:JSON.stringify(body);let settled=false;
 const fail=(code:string)=>{if(!settled){settled=true;reject(new LocalProviderError(code));}};
 const req=request({hostname:'127.0.0.1',port:18081,path,method:data===undefined?'GET':'POST',agent:false,
  headers:data===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json','Content-Length':Buffer.byteLength(data)},signal},res=>{
  if(res.statusCode!==200){res.destroy();fail('LOCAL_HTTP_ERROR');return;}
  if(!/^application\/json(?:;|$)/i.test(res.headers['content-type']??'')){res.destroy();fail('LOCAL_PROTOCOL_ERROR');return;}
  const chunks:Buffer[]=[];let size=0;
  res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>262144){res.destroy();fail('LOCAL_RESPONSE_TOO_LARGE');}else chunks.push(chunk);});
  res.on('error',()=>fail('LOCAL_CONNECTION_ERROR'));
  res.on('end',()=>{if(settled)return;try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));settled=true;resolve(value);}catch{fail('LOCAL_PROTOCOL_ERROR');}});
 });
 const timer=setTimeout(()=>{fail('LOCAL_TIMEOUT');req.destroy();},path==='/completion'?30000:3000);
 req.on('close',()=>clearTimeout(timer));req.on('error',()=>fail(signal?.aborted?'LOCAL_ABORTED':'LOCAL_CONNECTION_ERROR'));
 if(data)req.write(data);req.end();
});
const properties=z.object({model_path:z.string().min(1).max(4096),build_info:z.string().max(500),total_slots:z.literal(1),
 default_generation_settings:z.object({n_ctx:z.number().int().min(128).max(1000000)})});
const slots=z.array(z.object({id:z.literal(0),is_processing:z.boolean()})).length(1);
const completion=z.object({content:z.string().max(65536),tokens_predicted:z.number().int().min(0),tokens_evaluated:z.number().int().min(1),truncated:z.boolean(),stop:z.literal(true)});
function checked<T>(schema:z.ZodType<T>,value:unknown):T{const result=schema.safeParse(value);if(!result.success)throw new LocalProviderError('LOCAL_PROTOCOL_ERROR');return result.data;}
export function createLocalAdapter(transport:LocalTransport=localHttp){
 return {
  async probe(signal?:AbortSignal){
   checked(z.object({status:z.literal('ok')}),await transport('/health',undefined,signal));
   const props=checked(properties,await transport('/props',undefined,signal));
   if(!props.model_path.toLowerCase().endsWith('.gguf')||/^https?:/i.test(props.model_path))throw new LocalProviderError('LOCAL_MODEL_REQUIRED');
   const state=checked(slots,await transport('/slots',undefined,signal));
   const now=new Date(),expires=new Date(now.getTime()+30000).toISOString();
   const context=Math.min(2048,props.default_generation_settings.n_ctx);
   const fingerprint=createHash('sha256').update(JSON.stringify([props.model_path,props.build_info])).digest('hex');
   const provider:ProviderDescriptor={id:localProviderId,enabled:true,configured:true,accountScope:'local-process',models:[{
    id:localModelId,enabled:true,capabilities:['text'],contextWindowTokens:context,maxOutputTokens:Math.min(128,context-1),priority:0,
    availability:{status:'available',checkedAt:now.toISOString(),expiresAt:expires,remainingRequests:state[0].is_processing?0:1},
    cost:{status:'verified-zero',amountUsd:0,checkedAt:now.toISOString(),expiresAt:expires,evidenceRef:'local-loopback-no-billing',accountScope:'local-process',
     maxInputTokens:context-1,maxOutputTokens:Math.min(128,context-1),billingHardLimitUsd:0,paidFallbackEnabled:false}
   }]};
   return {provider,fingerprint,context,busy:state[0].is_processing};
  },
  async tokenize(prompt:string,signal?:AbortSignal){
   return checked(z.object({tokens:z.array(z.number().int().min(0)).min(1).max(2048)}),await transport('/tokenize',{content:prompt,add_special:true,parse_special:false},signal)).tokens;
  },
  async generate(tokens:number[],maxOutputTokens:number,signal?:AbortSignal){
   const value=checked(completion,await transport('/completion',{prompt:tokens,n_predict:maxOutputTokens,stream:false,temperature:0,seed:0,cache_prompt:false,id_slot:0},signal));
   if(value.truncated||value.tokens_evaluated!==tokens.length||value.tokens_predicted>maxOutputTokens)throw new LocalProviderError('LOCAL_USAGE_MISMATCH');
   return {text:value.content,inputTokens:value.tokens_evaluated,outputTokens:value.tokens_predicted};
  }
 };
}
