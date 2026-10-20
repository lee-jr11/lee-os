import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { handleCoreRequest, ApiError } from '../packages/core/src/api/index';
import { readJson, maxBodyBytes } from '../packages/core/src/api/body';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { exerciseApi } from './helpers/api-contract';
const token=randomBytes(32).toString('hex');const origin='http://127.0.0.1:3000';
function request(path='/projects',headers:Record<string,string>={},method='GET',body?:string) {
 return new Request(`${origin}/api/v1${path}`,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,...headers},body});
}
test('API denies unauthenticated, cross-origin, and rebound-host requests before database access',async()=>{
 let opened=0;const options={token,origin,database:()=>{opened++;throw new Error('No database should be opened');}};
 for(const headers of [{Authorization:''},{Authorization:`Bearer ${'f'.repeat(64)}`}])assert.equal((await handleCoreRequest(request('/projects',headers),options)).status,401);
 for(const headers of [{Origin:'https://example.com'},{Host:'evil.example:3000'},{'Sec-Fetch-Site':'cross-site'}] as Record<string,string>[])assert.equal((await handleCoreRequest(request('/projects',headers),options)).status,403);
 assert.equal((await handleCoreRequest(request(),{...options,token:undefined})).status,503);
 assert.equal((await handleCoreRequest(request(),{...options,origin:'https://example.com'})).status,503);
 const system=await handleCoreRequest(request('/system'),options);assert.equal(system.status,200);assert.equal(opened,0);
 const normalized=new Request('http://localhost:3000/api/v1/system',{headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`}});
 assert.equal((await handleCoreRequest(normalized,options)).status,200);
 for (const url of ['http://evil.example:3000/api/v1/system','http://localhost:3001/api/v1/system']) {
  const invalid=new Request(url,{headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`}});
  assert.equal((await handleCoreRequest(invalid,options)).status,403);
 }
 assert.equal((await handleCoreRequest(request('/system',{Origin:'http://localhost:3000'}),options)).status,403);

 const unauthorized=await handleCoreRequest(request('/projects',{Authorization:''}),options);
 assert.equal(unauthorized.headers.get('WWW-Authenticate'),'Bearer realm="leeos"');assert.equal(unauthorized.headers.get('Access-Control-Allow-Origin'),null);
});
test('invalid requests and unknown fields are rejected before storage access',async()=>{
 const options={token,origin,database:()=>{throw new Error('Storage must not open');}};
 const invalid=[request('/projects',{'Content-Type':'application/json'},'POST','{bad'),request('/projects',{'Content-Type':'text/plain'},'POST','{}'),request('/projects',{'Content-Type':'application/json'},'POST',JSON.stringify({name:'X',executionEnabled:true})),request('/projects?limit=101'),request('/projects?unknown=value'),request('/projects/not-an-id')];
 for(const req of invalid){const response=await handleCoreRequest(req,options);assert.ok([400,415].includes(response.status));assert.ok(!(await response.text()).includes('Storage must not open'));}
});
test('body limits count streamed bytes and bound nested JSON and read time',async()=>{
 const oversized=request('/projects',{'Content-Type':'application/json'},'POST',JSON.stringify({name:'x'.repeat(maxBodyBytes)}));
 await assert.rejects(readJson(oversized),(error:unknown)=>error instanceof ApiError && error.status===413);
 let deep:unknown={};for(let i=0;i<20;i++)deep={nested:deep};await assert.rejects(readJson(request('/projects',{'Content-Type':'application/json'},'POST',JSON.stringify(deep))),(error:unknown)=>error instanceof ApiError && error.status===400);
 const stream=new ReadableStream<Uint8Array>({start(){}});
 const slow=new Request(`${origin}/api/v1/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'} as RequestInit & {duplex:'half'});
 await assert.rejects(readJson(slow,10),(error:unknown)=>error instanceof ApiError && error.status===408);
});
test('database and unexpected failures never expose driver messages or credentials',async()=>{
 for(const [error,status] of [[new Error('password=must-not-leak'),500],[Object.assign(new Error('secret-url'),{code:'ECONNREFUSED'}),503],[new ApiError(503,'STORAGE_NOT_CONFIGURED','Configure local storage.'),503]] as const){
  const response=await handleCoreRequest(request(),{token,origin,database:()=>{throw error;}});assert.equal(response.status,status);const text=await response.text();assert.ok(!text.includes('must-not-leak'));assert.ok(!text.includes('secret-url'));assert.ok(!text.includes(token));
 }
});
test('core API contract over transactional PostgreSQL SQL engine',{timeout:120000},async t=>{
 const db=await createEmbeddedDatabase();try{await migrate(db);await exerciseApi(db,t);}finally{await db.close();}
});
