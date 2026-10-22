import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createEmbeddedDatabase} from '../scripts/lib/embedded-database';
import {migrate,readMigrations} from '../packages/database/src/migrations';
import {requirementsContent,requirementsCreate,acceptanceEvidence,requirementsDigest} from '../packages/core/src/requirements';
import {createRequirementsManager} from '../packages/core/src/requirements/store';
import {createStateStore} from '../packages/database/src';
import {handleCoreRequest} from '../packages/core/src/api/http';
import {exerciseRequirements,exampleRequirements,ownerRequirements} from './helpers/requirements-contract';
test('requirements validate coverage, distinct identities, verifier scope and immutable cost policy',()=>{
 assert.equal(requirementsContent.safeParse(exampleRequirements).success,true);
 for(const content of [
  {...exampleRequirements,costPolicy:'PAID'},
  {...ownerRequirements,acceptanceCriteria:[{...ownerRequirements.acceptanceCriteria[0],expected:{ignored:true}}]},
  {...ownerRequirements,acceptanceCriteria:[{...ownerRequirements.acceptanceCriteria[0],expected:{nested:{code:'shell'}}}]},
  {...exampleRequirements,permissions:['shell']},
  {...exampleRequirements,requirements:[...exampleRequirements.requirements,exampleRequirements.requirements[0]]},
  {...exampleRequirements,acceptanceCriteria:[]},
  {...exampleRequirements,acceptanceCriteria:exampleRequirements.acceptanceCriteria.map(c=>({...c,required:false}))},
  {...exampleRequirements,acceptanceCriteria:exampleRequirements.acceptanceCriteria.slice(0,1)},
  {...ownerRequirements,acceptanceCriteria:[{...ownerRequirements.acceptanceCriteria[0],requirementIds:['missing']}]},
  {...ownerRequirements,acceptanceCriteria:[{...ownerRequirements.acceptanceCriteria[0],evidenceKind:'job-result'}]}
 ])assert.equal(requirementsContent.safeParse(content).success,false);
 const a=requirementsDigest('one',1,exampleRequirements);assert.equal(a,requirementsDigest('one',1,JSON.parse(JSON.stringify(exampleRequirements))));assert.notEqual(a,requirementsDigest('one',2,exampleRequirements));assert.notEqual(a,requirementsDigest('two',1,exampleRequirements));assert.notEqual(a,requirementsDigest('one',1,{...exampleRequirements,acceptanceCriteria:exampleRequirements.acceptanceCriteria.map(c=>c.id==='format'?{...c,expected:{body_font_size_pt:14}}:c)}));
 assert.equal(acceptanceEvidence.safeParse({kind:'job-result',criterionId:'generated',jobId:'job_12345678-1234-4234-8234-123456789abc',expectedEvidenceVersion:0,idempotencyKey:'x',outcome:'met'}).success,false);
 assert.equal(acceptanceEvidence.safeParse({kind:'document-validation',criterionId:'format',expectedEvidenceVersion:0,idempotencyKey:'forged'}).success,false);
});
test('requirements API denies unauthenticated, forged-verifier and permission inputs before storage',async()=>{
 const origin='http://127.0.0.1:3000',token='a'.repeat(64);let opened=0;
 const options={origin,token,database:()=>{opened++;throw Error('Must not open');}};
 const path='/projects/proj_12345678-1234-4234-8234-123456789abc/requirements';
 const request=(body:unknown,auth=token)=>new Request(origin+'/api/v1'+path,{method:'POST',headers:{Host:'127.0.0.1:3000',Authorization:auth?'Bearer '+auth:'','Content-Type':'application/json'},body:JSON.stringify(body)});
 const input={content:exampleRequirements,idempotencyKey:'x'};assert.equal(requirementsCreate.safeParse(input).success,true);
 assert.equal((await handleCoreRequest(request(input,''),options)).status,401);
 assert.equal((await handleCoreRequest(request({...input,executionEnabled:true}),options)).status,400);
 assert.equal(opened,0);
});
test('P0.1 requirements/evidence contracts and clean-close persistence',{timeout:120000},async t=>{
 const root=resolve('.leeos/tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(join(root,'leeos-requirements-'));let db=await createEmbeddedDatabase(directory);
 try{
  await migrate(db,(await readMigrations()).slice(0,8));
  const legacyStore=createStateStore(db),legacyProject=await legacyStore.createProject('Before P0.1'),legacyRun=await legacyStore.createRun(legacyProject.id),legacyHistory=await legacyStore.listEvents(legacyProject.id);
  assert.deepEqual(await migrate(db),['009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql','018_gemini_transient_retries.sql']);assert.deepEqual(await createStateStore(db).getRun(legacyRun.id),legacyRun);assert.deepEqual(await createStateStore(db).listEvents(legacyProject.id),legacyHistory);
  await exerciseRequirements(db,t);
  const project=await createStateStore(db).createProject('Requirements persistence'),manager=createRequirementsManager(db),doc=await manager.create(proj