import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {createId,createStateStore,type StateDatabase} from '../packages/database/src';
import {migrate} from '../packages/database/src/migrations';
import {handleCoreRequest} from '../packages/core/src/api/http';
import {ArtifactStorageError,artifactMaxBytes,createArtifactStorage} from '../packages/core/src/storage-manager';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {authorizedInput,envelopeFixture} from './helpers/envelope-contract';

async function fixture(name:string){
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,`leeos-artifact-${name}-`));let db=await createEmbeddedDatabase(dir);
 try{await migrate(db);return {root,dir,get db(){return db;},async reopen(){await db.close();db=await createEmbeddedDatabase(dir);await migrate(db);},async cleanup(){await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith(`leeos-artifact-${name}-`))throw Error('Unsafe artifact fixture cleanup');await rm(absolute,{recursive:true,force:true});}};}
 catch(error){await db.close();const absolute=resolve(dir);if(absolute.startsWith(root+sep))await rm(absolute,{recursive:true,force:true});throw error;}
}
function api(db:()=>Promise<StateDatabase>|StateDatabase,enabled:()=>boolean){
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);
 return (path:string,init:RequestInit={})=>handleCoreRequest(new Request(origin+'/api/v1'+path,{...init,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,...init.headers}}),{origin,token,database:db,artifactStorageEnabled:enabled});
}
type ArtifactApiRecord={id:string;name:string;status?:string;sourceEnvelopeId?:string|null;sourceFence?:string|null};
type ArtifactApiData=ArtifactApiRecord&{artifact?:ArtifactApiRecord;items?:ArtifactApiRecord[];nextCursor?:string|null;storageUri?:string};
function dto(response:Response){return response.json() as Promise<{data:ArtifactApiData;error?:{code:string};requestId:string}>;}
function requestBody(bytes:Uint8Array):ArrayBuffer{const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(bytes);return copy;}

test('disabled artifact storage is inert and authentication precedes database access',async()=>{
 let opened=0;const call=api(()=>{opened++;throw Error('Storage must remain closed');},()=>false),origin='http://127.0.0.1:3000';
 const response=await call('/projects/proj_12345678-1234-4234-8234-123456789abc/artifacts',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-LeeOS-Artifact-Name':'draft.docx','Idempotency-Key':'disabled'},body:new Uint8Array([1])});
 assert.equal(response.status,503);assert.equal((await dto(response)).error?.code,'ARTIFACT_STORAGE_DISABLED');assert.equal(opened,0);
 const unauthorized=await handleCoreRequest(new Request(origin+'/api/v1/projects/proj_12345678-1234-4234-8234-123456789abc/artifacts',{method:'GET',headers:{Host:'127.0.0.1:3000'}}),{origin,token:'a'.repeat(64),database:()=>{opened++;throw Error('Must not open');},artifactStorageEnabled:()=>true});
 assert.equal(unauthorized.status,401);assert.equal(opened,0);
});

test('worker-origin bytes register in PostgreSQL and retrieve intact after the process/database is reopened',{timeout:120000},async()=>{
 const f=await fixture('durability');let db=f.db;
 try{
  const setup=await envelopeFixture(db),accepted=await setup.manager.accept(setup.run.id,await authorizedInput(setup)),workers=createEnvelopeWorkerStore(db,{leaseMs:60000,backoffMs:0}),staleClaim=await workers.claim('worker_artifact_old',accepted.id);
  assert.ok(staleClaim);await workers.release(staleClaim);const workerClaim=await workers.claim('worker_artifact_current',accepted.id);assert.ok(workerClaim);
  const bytes=new TextEncoder().encode('Bytes handed directly from a remote worker; no runner path is retained.'),store=createArtifactStorage(db,{enabled:()=>true});
  await assert.rejects(store.register({projectId:setup.project.id,runId:setup.run.id,name:'stale.bin',mediaType:'application/octet-stream',idempotencyKey:'stale-claim',creator:'envelope-worker',workerClaim:staleClaim,bytes}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_SCOPE_INVALID');
  const stored=await store.register({projectId:setup.project.id,runId:setup.run.id,name:'worker-output.bin',mediaType:'application/octet-stream',idempotencyKey:'run-result-1',creator:'envelope-worker',workerClaim,bytes});
  assert.equal(stored.created,true);assert.equal(stored.artifact.creator,'envelope-worker');assert.equal(stored.artifact.status,'available');assert.ok(stored.artifact.sha256);assert.equal(stored.artifact.sha256.length,64);assert.equal(stored.artifact.sizeBytes,bytes.byteLength);
  assert.equal(stored.artifact.sourceEnvelopeId,accepted.id);assert.equal(stored.artifact.sourceFence,workerClaim.fence);
  assert.equal((await db.query('SELECT content FROM artifact_blobs WHERE artifact_id=$1',[stored.artifact.id])).rows.length,1);
  await f.reopen();db=f.db;const call=api(()=>db,()=>true),meta=await call(`/artifacts/${stored.artifact.id}`),metaBody=await dto(meta);
  assert.equal(meta.status,200);assert.equal(metaBody.data.name,'worker-output.bin');assert.equal(metaBody.data.status,'available');assert.equal(metaBody.data.sourceEnvelopeId,accepted.id);assert.equal(metaBody.data.sourceFence,workerClaim.fence);assert.equal('storageUri' in metaBody.data,false);
  const downloaded=await call(`/artifacts/${stored.artifact.id}/content`);assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'application/octet-stream');
  assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');assert.match(downloaded.headers.get('content-disposition')??'',/attachment/);assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),bytes);
  const list=await call(`/projects/${setup.project.id}/artifacts?limit=1`);assert.equal((await dto(list)).data.items![0].id,stored.artifact.id);
  const events=(await db.query<{kind:string}>('SELECT kind FROM events WHERE entity_id=$1 ORDER BY sequence',[stored.artifact.id])).rows.map(row=>row.kind);assert.deepEqual(events,['artifact.registered','artifact.retrieved']);
  const replay=await createArtifactStorage(db,{enabled:()=>true}).register({projectId:setup.project.id,runId:setup.run.id,name:'worker-output.bin',mediaType:'application/octet-stream',idempotencyKey:'run-result-1',creator:'envelope-worker',workerClaim,bytes});
  assert.equal(replay.created,false);assert.equal(replay.artifact.id,stored.artifact.id);
 }finally{await f.cleanup();}
});

test('binary API registration validates metadata, is idempotent, lists and retrieves only owned project records',{timeout:120000},async()=>{
 const f=await fixture('api');
 try{
  const db=f.db,project=await createStateStore(db).createProject('Artifact API'),call=api(()=>db,()=>true),payload=new TextEncoder().encode('file neutral bytes');
  const request=(name:string,key:string,body:Uint8Array)=>call(`/projects/${project.id}/artifacts`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-LeeOS-Artifact-Name':encodeURIComponent(name),'Idempotency-Key':key},body:requestBody(body)});
  const first=await request('résumé file.bin','same-key',payload),saved=await dto(first);assert.equal(first.status,201);assert.equal(saved.data.artifact!.name,'résumé file.bin');
  const replay=await request('résumé file.bin','same-key',payload);assert.equal(replay.status,200);assert.equal((await dto(replay)).data.artifact!.id,saved.data.artifact!.id);
  const conflict=await request('résumé file.bin','same-key',new TextEncoder().encode('different'));assert.equal(conflict.status,409);assert.equal((await dto(conflict)).error?.code,'ARTIFACT_IDEMPOTENCY_CONFLICT');
  const invalidName=await request('../outside','bad-name',payload);assert.equal(invalidName.status,400);
  const badType=await call(`/projects/${project.id}/artifacts`,{method:'POST',headers:{'Content-Type':'text/html; charset=utf-8','X-LeeOS-Artifact-Name':'unsafe.html','Idempotency-Key':'bad-type'},body:payload});assert.equal(badType.status,400);
  const second=await request('second.bin','second-key',new TextEncoder().encode('second file'));assert.equal(second.status,201);const secondBody=await dto(second);
  const list=await call(`/projects/${project.id}/artifacts?limit=1`),page=await dto(list);assert.equal(list.status,200);assert.equal(page.data.items!.length,1);assert.ok(page.data.nextCursor);
  const next=await dto(await call(`/projects/${project.id}/artifacts?limit=1&after=${page.data.nextCursor}`));assert.equal(next.data.items!.length,1);
  assert.deepEqual(new Set([page.data.items![0].id,next.data.items![0].id]),new Set([saved.data.artifact!.id,secondBody.data.artifact!.id]));
  const absent=await call('/artifacts/file_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');assert.equal(absent.status,404);
 }finally{await f.cleanup();}
});

test('quota, cross-project run ownership, and filename/type validation fail closed',{timeout:120000},async()=>{
 const f=await fixture('bounds');
 try{
  const db=f.db,state=createStateStore(db),project=await state.createProject('Small artifact quota'),other=await state.createProject('Other project'),foreignRun=await state.createRun(other.id),store=createArtifactStorage(db,{enabled:()=>true,maxProjectBytes:5});
  let registration=0;const register=(input:Partial<Parameters<typeof store.register>[0]>)=>store.register({projectId:project.id,name:'data.bin',mediaType:'application/octet-stream',idempotencyKey:`bound-${++registration}`,creator:'owner-api',bytes:new Uint8Array([1,2,3,4]),...input});
  await assert.rejects(register({runId:foreignRun.id}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_SCOPE_INVALID');
  await assert.rejects(register({name:'../file'}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_INVALID');
  await assert.rejects(register({mediaType:'text/html; charset=utf-8'}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_INVALID');
  await assert.rejects(register({bytes:new Uint8Array()}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_INVALID');
  await register({});
  await assert.rejects(register({bytes:new Uint8Array([1,2])}),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_QUOTA_EXCEEDED');
  await assert.rejects(createArtifactStorage(db).get('file_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),error=>error instanceof ArtifactStorageError&&error.code==='ARTIFACT_STORAGE_DISABLED');
  assert.ok(artifactMaxBytes===10*1024*1024);
 }finally{await f.cleanup();}
});

test('database guards keep metadata and bytes append-only and refuse metadata without matching content',{timeout:120000},async()=>{
 const f=await fixture('database-guards');
 try{
  const db=f.db,project=await createStateStore(db).createProject('Artifact constraints'),store=createArtifactStorage(db,{enabled:()=>true}),bytes=new Uint8Array([0,1,2,255]);
  const result=await store.register({projectId:project.id,name:'binary.bin',mediaType:'application/octet-stream',idempotencyKey:'immutable',creator:'owner-api',bytes});
  await assert.rejects(db.query('UPDATE artifacts SET name=$2 WHERE id=$1',[result.artifact.id,'changed.bin']),/immutable/i);
  await assert.rejects(db.query('DELETE FROM artifacts WHERE id=$1',[result.artifact.id]),/immutable/i);
  await assert.rejects(db.query('UPDATE artifact_blobs SET content=$2 WHERE artifact_id=$1',[result.artifact.id,new Uint8Array([9])]),/immutable/i);
  await assert.rejects(db.query('DELETE FROM artifact_blobs WHERE artifact_id=$1',[result.artifact.id]),/immutable/i);
  const incompleteId=createId('artifact'),sha='a'.repeat(64);
  await assert.rejects(db.transaction(async tx=>{await tx.query(`INSERT INTO artifacts(id,project_id,storage_uri,name,media_type,sha256,size_bytes,storage_backend,creator,idempotency_key,request_fingerprint)
    VALUES($1,$2,$3,'incomplete.bin','application/octet-stream',$4,1,'postgres-bytea','owner-api','incomplete',$5)`,[incompleteId,project.id,`leeos-artifact://postgres-bytea/${incompleteId}`,sha,sha]);}),/requires matching durable bytes/i);
  assert.equal((await db.query('SELECT id FROM artifacts WHERE id=$1',[incompleteId])).rows.length,0);
 }finally{await f.cleanup();}
});

test('binary request size is bounded before reading an oversized body',{timeout:120000},async()=>{
 const f=await fixture('request-limit');
 try{
  const project=await createStateStore(f.db).createProject('Request limit'),call=api(()=>f.db,()=>true),oversized=artifactMaxBytes+1;
  const response=await call(`/projects/${project.id}/artifacts`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-LeeOS-Artifact-Name':'large.bin','Idempotency-Key':'large','Content-Length':String(oversized)},body:new Uint8Array([1])});
  assert.equal(response.status,413);assert.equal((await dto(response)).error?.code,'ARTIFACT_TOO_LARGE');
 }finally{await f.cleanup();}
});
