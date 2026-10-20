import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {createStateStore} from '../packages/database/src';
import {migrate} from '../packages/database/src/migrations';
import {createRequirementsManager} from '../packages/core/src/requirements/store';
import {createPlanner} from '../packages/core/src/orchestrator/store';
import {planDigest} from '../packages/core/src/execution-manager';
import {createEnvelopeManager} from '../packages/core/src/execution-envelope/store';
import {createEnvelopeWorkerStore} from '../packages/core/src/envelope-worker/store';
import {createArtifactStorage} from '../packages/core/src/storage-manager';
import {generateDocx,validateDocx,PythonDocxError} from '../packages/executors/src/python-docx/index';
import type {RequirementsContent} from '../packages/core/src/requirements';
import type {EnvelopeDraft} from '../packages/core/src/execution-envelope';

const requirements:RequirementsContent={goal:'Create and store a formatted lesson document.',
 requirements:[{id:'document',statement:'Create and store the requested DOCX.',required:true,capabilityIds:['document_generation','artifact_storage']}],
 inputs:[{id:'topic',description:'The owner supplied subject for the document.',required:true}],
 outputs:[{id:'file',description:'A validated, retrievable DOCX artifact.'}],assumptions:[],questions:[],constraints:[],
 capabilities:['document_generation','artifact_storage'],costPolicy:'ZERO_ONLY',
 acceptanceCriteria:[
  {id:'valid',description:'DOCX content and formatting passed the local validator.',requirementIds:['document'],required:true,evidenceKind:'document-validation',expected:{format:'docx',font_family:'Times New Roman',body_font_size_pt:12}},
  {id:'stored',description:'The validated bytes are durably registered and retrievable.',requirementIds:['document'],required:true,evidenceKind:'artifact-registration',expected:{registered:true,bytes_retrievable:true,integrity_matches:true}}
 ]};

async function fixture(label:string){
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(join(root,`leeos-docx-${label}-`));const db=await createEmbeddedDatabase(dir);
 try{
  await migrate(db);const state=createStateStore(db),manager=createRequirementsManager(db),project=await state.createProject('P1.2 '+randomUUID()),run=await state.createRun(project.id);
  const doc=await manager.create(project.id,{content:requirements,idempotencyKey:randomUUID()});await manager.review(doc.id,{revision:1,reviewedDigest:doc.digest,acknowledgeRequirementsReview:true});
  await manager.bind(run.id,{requirementsId:doc.id,revision:1,reviewedDigest:doc.digest,expectedRunVersion:0,acknowledgeBinding:true});
  const saved=await createPlanner(db).create(run.id,{mode:'capability-first',expectedRunVersion:0,reviewedRequirementsDigest:doc.digest});
  const now=new Date(),draft:EnvelopeDraft={expectedRunVersion:0,reviewedPlanDigest:planDigest(run.id,0,saved.plan),grantExpiresAt:new Date(now.getTime()+3600000).toISOString(),
   contractInputs:{topic:'Courage and kindness'},constraints:{location:'local',network:'loopback-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0},
   operations:[{key:'document',kind:'docx.generate',requirementIds:['document'],dependsOn:[],name:'lesson-guide.docx',document:{title:{source:'contract-input',inputId:'topic'},sections:[{heading:{source:'literal',text:'Study notes'},paragraphs:[{source:'literal',text:'A generated document must be validated and stored before it can satisfy these criteria.'}]}]}}],
   acceptanceBindings:[{criterionId:'valid',operationKey:'document'},{criterionId:'stored',operationKey:'document'}]};
  const envelopeManager=createEnvelopeManager(db,{now:()=>now}),preview=await envelopeManager.preview(run.id,draft);
  assert.equal(preview.canAccept,true,JSON.stringify(preview.blockers));
  const input={...draft,idempotencyKey:randomUUID(),reviewedEnvelopeDigest:preview.digest!,acknowledgeAuthorization:true as const},accepted=await envelopeManager.accept(run.id,input);
  return {root,dir,db,project,run,doc,draft,envelopeManager,accepted,async cleanup(){await db.close();const absolute=resolve(dir);if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1)?.startsWith(`leeos-docx-${label}-`))throw Error('Unsafe DOCX fixture cleanup');await rm(absolute,{recursive:true,force:true});}};
 }catch(error){await db.close();const absolute=resolve(dir);if(absolute.startsWith(root+sep))await rm(absolute,{recursive:true,force:true});throw error;}
}

test('Python specialist generates readable DOCX and separate validation checks exact content and formatting',{timeout:60000},async()=>{
 const document={title:'A focused lesson',sections:[{heading:'Main idea',paragraphs:['Required paragraph with exact text.']}]};
 const bytes=await generateDocx(document),report=await validateDocx(bytes,document);
 assert.equal(report.format,'docx');assert.equal(report.readable,true);assert.equal(report.contentMatches,true);assert.equal(report.fontFamily,'Times New Roman');assert.equal(report.bodyFontSizePt,12);assert.ok(report.sha256);assert.ok(report.bytes>0);
 await assert.rejects(validateDocx(bytes,{...document,title:'Different title'}),error=>error instanceof PythonDocxError&&error.code==='DOCX_VALIDATION_FAILED');
 await assert.rejects(validateDocx(new Uint8Array([1,2,3]),document),error=>error instanceof PythonDocxError&&error.code==='DOCX_VALIDATION_FAILED');
});

test('durable worker stores validated bytes, records artifact-bound acceptance evidence, and recovers an artifact across a new fence',{timeout:120000},async()=>{
 const f=await fixture('recovery');
 try{
  const workers=createEnvelopeWorkerStore(f.db,{leaseMs:60000,backoffMs:0,artifactStorageEnabled:()=>true}),first=await workers.claim('worker_docx_old',f.accepted.id);assert.ok(first);
  const op=f.draft.operations[0];assert.equal(op.kind,'docx.generate');
  const request={name:op.name,document:{title:'Courage and kindness',sections:[{heading:'Study notes',paragraphs:['A generated document must be validated and stored before it can satisfy these criteria.']}]}};
  await f.db.query("UPDATE envelope_operations SET state='reserved',dispatch_fence=$3,resolved_request=$4,updated_at=clock_timestamp() WHERE envelope_id=$1 AND operation_key=$2",[f.accepted.id,op.key,first.fence,JSON.stringify(request)]);
  const storage=createArtifactStorage(f.db,{enabled:()=>true}),{createDocumentManager}=await import('../packages/core/src/document-manager/index');
  const saved=await createDocumentManager(f.db,{enabled:()=>true}).generateAndStore({runId:f.run.id,projectId:f.project.id,envelopeId:f.accepted.id,operationKey:op.key,name:request.name,document:request.document,claim:first});
  assert.equal(saved.created,true);const storedId=saved.artifact.id;
  await f.db.query("UPDATE envelope_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE envelope_id=$1",[f.accepted.id]);await workers.reap();
  const recovered=await workers.claim('worker_docx_recovery',f.accepted.id);assert.ok(recovered);assert.notEqual(recovered.fence,first.fence);
  assert.equal(await workers.step(recovered,{} as never),'continue');
  const result=await workers.get(f.accepted.id),operation=result.operations[0],validation=operation.validation as {fontFamily?:string;bodyFontSizePt?:number}|null;assert.equal(operation.state,'succeeded');assert.equal(operation.artifactId,storedId);assert.equal(validation?.fontFamily,'Times New Roman');assert.equal(validation?.bodyFontSizePt,12);
  assert.equal((await workers.step(recovered,{} as never)),'stopped');assert.equal((await workers.get(f.accepted.id)).state,'succeeded');
  const stored=await storage.getContent(storedId);assert.equal(stored.artifact.sha256,operation.sha256);assert.ok(stored.bytes.byteLength>0);
  const evidence=(await f.db.query<{kind:string;authority:string;source_fence:string;source_artifact_id:string}>('SELECT kind,authority,source_fence,source_artifact_id FROM acceptance_evidence WHERE run_id=$1 ORDER BY kind',[f.run.id])).rows;
  assert.deepEqual(evidence.map(row=>row.kind),['artifact-registration','document-validation']);assert.ok(evidence.every(row=>row.authority==='envelope-worker'&&String(row.source_fence)===recovered.fence&&row.source_artifact_id===storedId));
  assert.equal((await f.db.query('SELECT id FROM artifacts WHERE run_id=$1',[f.run.id])).rows.length,1);
  const assessment=await f.envelopeManager.get(f.accepted.id);assert.equal(assessment.workerStatus,'succeeded');
  const goal=await createRequirementsManager(f.db).assessment(f.run.id);assert.equal(goal.goalStatus,'achieved');assert.equal(goal.automaticVerificationComplete,true);
  assert.equal((await f.db.query('SELECT id FROM provider_calls')).rows.length,0);
 }finally{await f.cleanup();}
});

test('artifact storage opt-in keeps a DOCX envelope queued without generating or writing bytes',{timeout:120000},async()=>{
 const f=await fixture('disabled');
 try{
  const workers=createEnvelopeWorkerStore(f.db,{backoffMs:0,artifactStorageEnabled:()=>false}),claim=await workers.claim('worker_docx_disabled',f.accepted.id);assert.ok(claim);
  assert.equal(await workers.step(claim,{} as never),'stopped');const result=await workers.get(f.accepted.id);
  assert.equal(result.state,'queued');assert.equal(result.reason,'ARTIFACT_STORAGE_DISABLED');assert.equal(result.operations[0].state,'reserved');
  assert.equal((await f.db.query('SELECT id FROM artifacts WHERE run_id=$1',[f.run.id])).rows.length,0);
  assert.equal((await f.db.query('SELECT id FROM acceptance_evidence WHERE run_id=$1',[f.run.id])).rows.length,0);
 }finally{await f.cleanup();}
});
