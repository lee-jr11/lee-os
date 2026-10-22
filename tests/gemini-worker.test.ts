import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate,readMigrations} from '../packages/database/src/migrations';
import {createGeminiAdapter,geminiModelId} from '@leeos/providers/gemini';
import {createGeminiProviderManager} from '../packages/core/src/provider-manager/gemini';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {runEnvelopeWorkerOnce} from '../packages/core/src/envelope-worker/runner';
import type {CapabilityPlan} from '../packages/core/src/orchestrator/capability-plan';
import {envelopeFixture,authorizedInput} from './helpers/envelope-contract';
import {envelopeDigest,gemini503RetryPolicy} from '../packages/core/src/execution-envelope';
import {envelopeRequirements} from './helpers/envelope-contract';

function remoteAdapter(){
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),credentials={apiKey:'gemini-test-secret',serviceAccountJson:JSON.stringify({type:'service_account',project_id:'leeos-test',client_email:'leeos-test@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 let billingEnabled=false,generations=0,generationTransportFailures=0;const generationStatuses:number[]=[],prompts:string[]=[];
 const adapter=createGeminiAdapter({credentials:()=>credentials,transport:async(url,init)=>{
  if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'gemini-test-access-token-long-enough',expires_in:3600});
  if(url.startsWith('https://apikeys.googleapis.com/v2/keys:lookupKey?'))return Response.json({parent:'projects/987654321/locations/global',name:'projects/987654321/locations/global/keys/test'});
  if(url==='https://apikeys.googleapis.com/v2/projects/987654321/locations/global/keys/test')return Response.json({restrictions:{apiTargets:[{service:'generativelanguage.googleapis.com'}]}});
  if(url==='https://cloudbilling.googleapis.com/v1/projects/987654321/billingInfo')return Response.json({projectId:'leeos-test',billingEnabled,...(billingEnabled?{billingAccountName:'billingAccounts/987-654'}:{})});
  if(url===`https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}`)return Response.json({name:`models/${geminiModelId}`,version:'test-pinned-model',inputTokenLimit:32768,outputTokenLimit:8192,supportedGenerationMethods:['generateContent']});
  if(url.endsWith(':countTokens')){const body=JSON.parse(String(init.body)) as {contents:{parts:{text:string}[]}[]};prompts.push(body.contents[0].parts[0].text);return Response.json({totalTokens:4});}
  if(url.endsWith(':generateContent')){generations++;if(generationTransportFailures>0){generationTransportFailures--;throw Error('connection lost after dispatch');}const status=generationStatuses.shift();if(status)return new Response(null,{status});return Response.json({candidates:[{content:{parts:[{text:'Remote durable result'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:4,candidatesTokenCount:3,totalTokenCount:7}});}
  throw Error('Unexpected Gemini transport request.');
 }});
 return {adapter,setBillingEnabled:(v:boolean)=>{billingEnabled=v;},setGenerationStatuses:(...statuses:number[])=>generationStatuses.push(...statuses),setGenerationTransportFailures:(count:number)=>{generationTransportFailures=count;},get generations(){return generations;},prompts,credentials};
}

async function fixture(testName:string,retryable503=false){
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,'leeos-gemini-'+testName+'-'));const db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db,await readMigrations());const remote=remoteAdapter(),probe=await remote.adapter.probe();
  const base=await envelopeFixture(db,envelopeRequirements,{provider:probe.provider,fingerprint:probe.fingerprint,location:'remote'},retryable503),input=await authorizedInput(base),receipt=await base.manager.accept(base.run.id,input);
  const provider=createGeminiProviderManager({enabled:()=>true,adapter:remote.adapter});
  return {db,dir,root,base,remote,provider,receipt,async cleanup(){await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith('leeos-gemini-'+testName+'-'))throw Error('Unsafe test cleanup');await rm(absolute,{recursive:true,force:true});}};
 }catch(error){await db.close();const absolute=resolve(dir);if(absolute.startsWith(root+sep))await rm(absolute,{recursive:true,force:true});throw error;}
}

test('remote Gemini uses the accepted envelope worker and records exact free-tier usage evidence',{timeout:120000},async()=>{
 const f=await fixture('success');
 try{
  assert.equal(f.receipt.envelope.constraints.location,'remote');assert.equal(f.receipt.envelope.operations[0].implementationContr