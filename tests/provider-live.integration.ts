import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { localOrigin } from '../packages/core/src/api/auth';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[0-9a-f]{64}$/.test(token))throw Error('Configure owner API credentials for the live provider test.');
const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
test('real local model inference through the production owner API',{timeout:90000},async()=>{
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const status=await fetch(origin+'/api/v1/providers/local',{headers,signal:AbortSignal.timeout(5000)});assert.equal(status.status,200);assert.equal((await status.json()).data.connection,'ready');
 const body={prompt:'Once upon a time',maxOutputTokens:32,idempotencyKey:'live-test-'+randomUUID()};
 const invoke=()=>fetch(origin+'/api/v1/providers/local/calls',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const response=await invoke();assert.equal(response.status,201);const data=(await response.json()).data;
 assert.equal(data.status,'succeeded',String(data.errorCode));assert.ok(data.text.length>0);assert.ok(data.inputTokens>0);assert.ok(data.outputTokens>0&&data.outputTokens<=32);
 assert.deepEqual((await (await invoke()).json()).data,data);
 const saved=await fetch(origin+'/api/v1/providers/local/calls/'+data.id,{headers});assert.deepEqual((await saved.json()).data,data);
});
