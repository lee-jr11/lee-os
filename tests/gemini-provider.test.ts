import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createGeminiAdapter,GeminiProviderError,geminiModelId} from '../packages/providers/src/gemini';
import {routeModel} from '../packages/core/src/model-router';

const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const credentials={apiKey:'secret-test-gemini-key',serviceAccountJson:JSON.stringify({type:'service_account',project_id:'leeos-free-test',private_key_id:'fixture-key-id',private_key:privateKey.export({type:'pkcs8',format:'pem'}),client_email:'leeos-readonly@example.test',client_id:'1234567890',auth_uri:'https://accounts.google.com/o/oauth2/auth',token_uri:'https://oauth2.googleapis.com/token',auth_provider_x509_cert_url:'https://www.googleapis.com/oauth2/v1/certs',client_x509_cert_url:'https://www.googleapis.com/robot/v1/metadata/x509/leeos-readonly%40example.test',universe_domain:'googleapis.com'})};
const json=(value:unknown)=>Response.json(value);
function fixture(billingEnabled=false,keyService='generativelanguage.googleapis.com',failAt?:'key-lookup'|'billing-read',generation:{status?:number;countTokensStatus?:number;transportFailure?:boolean}={}){
 const calls:string[]=[];
 const adapter=createGeminiAdapter({credentials:()=>credentials,now:()=>new Date('2026-10-19T12:00:00.000Z'),transport:async(url,init)=>{
  calls.push(url);
  if(url==='https://oauth2.googleapis.com/token')return json({access_token:'test-access-token-with-sufficient-length',expires_in:3600});
  if(url.startsWith('https://apikeys.googleapis.com/v2/keys:lookupKey?')){
   assert.match(url,/secret-test-gemini-key/);assert.equal(new Headers(init.headers).get('Authorization'),'Bearer test-access-token-with-sufficient-length');
   if(failAt==='key-lookup')return new Response(null,{status:403});
   return json({parent:'projects/123456789/locations/global',name:'projects/123456789/locations/global/keys/test'});
  }
  if(url==='https://apikeys.googleapis.com/v2/projects/123456789/locations/global/keys/test')return json({restrictions:{apiTargets:[{service:keyService}]}});
  if(url==='https://cloudbilling.googleapis.com/v1/projects/123456789/billingInfo')return failAt==='billing-read'?new Response(null,{status:403}):json({projectId:'leeos-free-test',billingEnabled,...(billingEnabled?{billingAccountName:'billingAccounts/123-456'}:{})});
  if(url===`https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}`)return json({name:`models/${geminiModelId}`,version:'pinned-test-model',inputTokenLimit:32768,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']});
  if(url.endsWith(':countTokens'))return generation.countTokensStatus?new Response(null,{status:generation.countTokensStatus}):json({totalTokens:4});
  if(url.endsWith(':generateContent')){if(generation.transportFailure)throw Error('connection lost after dispatch');if(generation.status)return new Response(null,{status:generation.status});return json({candidates:[{content:{parts:[{text:'Remote result'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:4,candidatesTokenCount:2,totalTokenCount:6}});}
  throw Error('Unexpected request URL.');
 }});
 return {adapter,calls};
}

test('Gemini zero-cost evidence is bound to the API key project and the actual response usage is retained',async()=>{
 const f=fixture(),preflight=await f.adapter.probe();
 assert.equal(preflight.provider.models[0].cost.status,'verified-zero');assert.equal(preflight.provider.models[0].cost.amountUsd,0);
 assert.equal(preflight.provider.models[0].cost.evidenceRef,'google-project-billing-disabled');assert.equal(preflight.provider.models[0].cost.accountScope,'google-project-123456789');
 assert.equal(routeModel({capabilities:['text'],inputTokens:4,outputTokens:16},{registry:[preflight.provider],now:new Date('2026-10-19T12:00:01.000Z')}).status,'selected');
 assert.equal(await f.adapter.tokenize('only user supplied prompt'),4);
 const fresh=await f.adapter.revalidate(preflight.fingerprint);assert.equal(fresh.fingerprint,preflight.fingerprint);
 assert.deepEqual(await f.adapter.generate('only user supplied prompt',16),{text:'Remote result',inputTokens:4,outputTokens:2,totalTokens:6});
 assert.ok(f.calls.filter(url=>url.endsWith(':generateContent')).length===1);
 assert.equal(JSON.stringify(preflight).includes(credentials.apiKey),false);
});

test('billing enabled or missing cost evidence blocks before any model metadata, tokenization or generation call',async()=>{
 const f=fixture(true);await assert.rejects(f.adapter.probe(),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_BILLING_ENABLED');
 assert.equal(f.calls.filter(url=>url.includes('generativelanguage.googleapis.com')).length,0);
 const noCredentials=createGeminiAdapter({credentials:()=>undefined});
 await assert.rejects(noCredentials.probe(),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_CREDENTIALS_UNAVAILABLE');
});

test('read-only preflight reports which Google permission check is unavailable without disclosing provider responses',async()=>{
 for(const [failedCheck,code] of [['key-lookup','GEMINI_API_KEY_LOOKUP_UNAVAILABLE'],['billing-read','GEMINI_PROJECT_BILLING_READ_UNAVAILABLE']] as const){
  const f=fixture(false,'generativelanguage.googleapis.com',failedCheck);
  await assert.rejects(f.adapter.probe(),(error:unknown)=>error instanceof GeminiProviderError&&error.code===code);
  assert.equal(f.calls.some(url=>url.includes('generativelanguage.googleapis.com')),false);
 }
});

test('only a received Gemini generation HTTP 503 is classified as retryable',async()=>{
 const explicit503=fixture(false,'generativelanguage.googleapis.com',undefined,{status:503});
 await assert.rejects(explicit503.adapter.generate('bounded prompt',16),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_HTTP_503'&&error.retryable);
 const explicit502=fixture(false,'generativelanguage.googleapis.com',undefined,{status:502});
 await assert.rejects(explicit502.adapter.generate('bounded prompt',16),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_HTTP_502'&&!error.retryable);
 const lost=fixture(false,'generativelanguage.googleapis.com',undefined,{transportFailure:true});
 await assert.rejects(lost.adapter.generate('bounded prompt',16),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_CONNECTION_FAILED'&&!error.retryable);
 const tokenization503=fixture(false,'generativelanguage.googleapis.com',undefined,{countTokensStatus:503});
 await assert.rejects(tokenization503.adapter.tokenize('bounded prompt'),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_HTTP_503'&&!error.retryable);
});

test('an API key without an exact Gemini-only service restriction cannot become a route',async()=>{
 const f=fixture(false,'generativelanguage.googleapis.com,compute.googleapis.com');
 await assert.rejects(f.adapter.probe(),(error:unknown)=>error instanceof GeminiProviderError&&error.code==='GEMINI_KEY_SCOPE_TOO_BROAD');
 assert.equal(f.calls.some(url=>url.includes('cloudbilling.googleapis.com')),false);
 assert.equal(f.calls.some(url=>url.includes('generativelanguage.googleapis.com')),false);
});

test('unknown, stale, account-mismatched or nonzero remote cost evidence is ineligible',async()=>{
 const base=fixture(),provider=(await base.adapter.probe()).provider,model=provider.models[0];
 const request={capabilities:['text'],inputTokens:4,outputTokens:16};
 const route=(cost:typeof model.cost,now=new Date('2026-10-19T12:00:01.000Z'))=>routeModel(request,{registry:[{...provider,models:[{...model,cost}]}],now});
 assert.equal(route({...model.cost,status:'unknown'}).status,'blocked');
 assert.equal(route({...model.cost,amountUsd:0.01,status:'nonzero'}).status,'blocked');
 assert.equal(route({...model.cost,accountScope:'google-project-other'}).status,'blocked');
 assert.equal(route({...model.cost,checkedAt:'2026-10-19T11:00:00.000Z'}).status,'blocked');
});
