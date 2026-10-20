import {createId,StateConflict,requireProjectNewWork,type StateDatabase,type SqlSession,type Row} from '@leeos/database';
import {parse,projectId,runId} from '../api/contracts';
import {ApiError} from '../api/errors';
import {requirementsId,requirementsCreate,requirementsRevise,requirementsReview,requirementsBind,acceptanceEvidence,requirementsDigest,sameContent,type RequirementsContent} from './index';
function required(row:Row|undefined){if(!row)throw new ApiError(404,'NOT_FOUND','Requirements or run not found.');return row;}
function stamp(v:unknown){return new Date(v as string|Date).toISOString();}
async function history(tx:SqlSession,project:unknown,entity:string,kind:string,payload:Row={},run:unknown=null){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),project,run,kind,entity,JSON.stringify(payload)]);
}
async function document(tx:SqlSession,id:string,lock=false){return required((await tx.query('SELECT * FROM requirements_documents WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0]);}
async function view(tx:SqlSession,id:string,revision?:number){
 const row=required((await tx.query(`SELECT d.*,v.revision,v.content,v.digest,v.created_at AS revision_created_at,r.authority,r.created_at AS reviewed_at
 FROM requirements_documents d JOIN requirements_revisions v ON v.requirements_id=d.id AND v.revision=COALESCE($2,d.current_revision)
 LEFT JOIN requirements_reviews r ON r.requirements_id=v.requirements_id AND r.revision=v.revision WHERE d.id=$1`,[id,revision??null])).rows[0]);
 return {id:String(row.id),projectId:String(row.project_id),currentRevision:Number(row.current_revision),revision:Number(row.revision),digest:String(row.digest),content:row.content as RequirementsContent,
  status:row.reviewed_at?'reviewed':'draft',review:row.reviewed_at?{authority:row.authority,createdAt:stamp(row.reviewed_at)}:null,
  createdAt:stamp(row.created_at),revisionCreatedAt:stamp(row.revision_created_at),executionEnabled:false as const,permissions:[]};
}
export function createRequirementsManager(db:StateDatabase){
 async function assessment(tx:SqlSession,id:string){
  const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR SHARE',[id])).rows[0]);
  const binding=required((await tx.query('SELECT * FROM run_requirements WHERE run_id=$1',[id])).rows[0]);
  const snapshot=await view(tx,String(binding.requirements_id),Number(binding.revision));
  const latest=(await tx.query('SELECT DISTINCT ON (criterion_id) * FROM acceptance_evidence WHERE run_id=$1 ORDER BY criterion_id,version DESC',[id])).rows;
  const criteria=snapshot.content.acceptanceCriteria.map(c=>{
   const e=latest.find(row=>row.criterion_id===c.id);
   return {...c,status:e?String(e.outcome):'pending',evidenceVersion:e?Number(e.version):0,
    evidence:e?{id:e.id,kind:e.kind,outcome:e.outcome,sourceJobId:e.source_job_id,details:e.details as Row,authority:e.authority,createdAt:stamp(e.created_at)}:null,
    verifierAvailable:['owner-review','job-result','document-validation','artifact-registration'].includes(c.evidenceKind)};
  });
  const mandatory=criteria.filter(c=>c.required),criteriaStatus=mandatory.some(c=>c.status==='not-met')?'not-met':mandatory.every(c=>c.status==='met')?'met':'pending';
  // Neither technical success nor an evidence string alone establishes goal success.
  const goalStatus=['failed','cancelled'].includes(String(run.status))||criteriaStatus==='not-met'?'not-achieved':criteriaStatus==='met'&&run.status==='succeeded'?'achieved':'pending';
  const automatedKinds=['job-result','document-validation','artifact-registration'];
  return {runId:id,projectId:String(run.project_id),runStatus:run.status,requirements:snapshot,boundAt:stamp(binding.created_at),criteria,criteriaStatus,goalStatus,
   automaticVerificationComplete:mandatory.every(c=>c.status==='met'&&automatedKinds.includes(c.evidenceKind)),
   authority:'recorded-evidence',executionEnabled:false,permissions:[]};
 }
 return {
  async get(id:string,revision?:number){parse(requirementsId,id);if(revision!==undefined&&(!Number.isInteger(revision)||revision<1||revision>2147483646))throw new ApiError(400,'INVALID_REQUEST','Invalid revision.');return view(db,id,revision);},
  async list(project:string,after:string|null=null,limit=25){
   parse(projectId,project);if(after)parse(requirementsId,after);if(!Number.isInteger(limit)||limit<1||limit>100)throw new ApiError(400,'INVALID_REQUEST','Invalid page size.');
   required((await db.query('SELECT id FROM projects WHERE id=$1',[project])).rows[0]);
   const rows=(await db.query('SELECT id FROM requirements_documents WHERE project_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3',[project,after,limit+1])).rows;
   return {items:await Promise.all(rows.slice(0,limit).map(row=>view(db,String(row.id)))),nextCursor:rows.length>limit?String(rows[limit-1].id):null};
  },
  async create(project:string,value:unknown){
   parse(projectId,project);const input=parse(requirementsCreate,value);
   return db.transaction(async tx=>{
    required((await tx.query('SELECT id FROM projects WHERE id=$1 FOR NO KEY UPDATE',[project])).rows[0]);
    const prior=(await tx.query('SELECT * FROM requirements_documents WHERE project_id=$1 AND request_key=$2',[project,input.idempotencyKey])).rows[0];
    if(prior){if(!sameContent(prior.creation_input,input))throw new StateConflict('This key belongs to a different requirements request.');return view(tx,String(prior.id));}
    await requireProjectNewWork(tx,project);const id=createId('requirements'),digest=requirementsDigest(id,1,input.content);
    await tx.query('INSERT INTO requirements_documents(id,project_id,request_key,creation_input) VALUES($1,$2,$3,$4)',[id,project,input.idempotencyKey,JSON.stringify(input)]);
    await tx.query('INSERT INTO requirements_revisions(requirements_id,revision,content,digest) VALUES($1,1,$2,$3)',[id,JSON.stringify(input.content),digest]);
    await history(tx,project,id,'requirements.created',{revision:1,digest});return view(tx,id);
   });
  },
  async revise(id:string,value:unknown){
   parse(requirementsId,id);const input=parse(requirementsRevise,value);
   return db.transaction(async tx=>{
    const row=await document(tx,id,true);if(row.current_revision!==input.expectedRevision||input.expectedRevision>=2147483646)throw new StateConflict('Review the current requirements revision.');
    const revision=input.expectedRevision+1,digest=requirementsDigest(id,revision,input.content);
    await tx.query('INSERT INTO requirements_revisions(requirements_id,revision,content,digest) VALUES($1,$2,$3,$4)',[id,revision,JSON.stringify(input.content),digest]);
    await tx.query('UPDATE requirements_documents SET current_revision=$2 WHERE id=$1',[id,revision]);
    await history(tx,row.project_id,id,'requirements.revised',{revision,digest});return view(tx,id);
   });
  },
  async review(id:string,value:unknown){
   parse(requirementsId,id);const input=parse(requirementsReview,value);
   return db.transaction(async tx=>{
    const row=await document(tx,id,true),snapshot=await view(tx,id,input.revision);
    if(snapshot.review){if(snapshot.digest!==input.reviewedDigest)throw new StateConflict('Reviewed digest differs.');return snapshot;}
    if(row.current_revision!==input.revision||snapshot.digest!==input.reviewedDigest||snapshot.content.questions.length)throw new StateConflict('Resolve questions and review the current exact digest.');
    await tx.query('INSERT INTO requirements_reviews(requirements_id,revision,digest) VALUES($1,$2,$3)',[id,input.revision,input.reviewedDigest]);
    await history(tx,row.project_id,id,'requirements.reviewed',{revision:input.revision,digest:input.reviewedDigest,authority:'local-owner',executionEnabled:false});return view(tx,id);
   });
  },
  async bind(id:string,value:unknown){
   parse(runId,id);const input=parse(requirementsBind,value);
   return db.transaction(async tx=>{
    const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[id])).rows[0]);
    const prior=(await tx.query('SELECT * FROM run_requirements WHERE run_id=$1',[id])).rows[0];
    if(prior){if(!sameContent(prior.request,input))throw new StateConflict('Run already has a different requirements binding.');return assessment(tx,id);}
    const doc=required((await tx.query('SELECT * FROM requirements_documents WHERE id=$1 AND project_id=$2 FOR SHARE',[input.requirementsId,run.project_id])).rows[0]);
    const snapshot=await view(tx,input.requirementsId,input.revision);
    if(run.status!=='queued'||run.version!==input.expectedRunVersion||doc.current_revision!==input.revision||!snapshot.review||snapshot.digest!==input.reviewedDigest)throw new StateConflict('Bind the current reviewed contract to an unchanged queued run.');
    if((await tx.query('SELECT id FROM jobs WHERE run_id=$1 LIMIT 1',[id])).rows.length||(await tx.query('SELECT run_id FROM run_preparations WHERE run_id=$1',[id])).rows.length)throw new StateConflict('Requirements must be bound before job preparation.');
    await tx.query('INSERT INTO run_requirements(run_id,project_id,requirements_id,revision,digest,request) VALUES($1,$2,$3,$4,$5,$6)',[id,run.project_id,input.requirementsId,input.revision,input.reviewedDigest,JSON.stringify(input)]);
    await history(tx,run.project_id,id,'run.requirements-bound',{requirementsId:input.requirementsId,revision:input.revision,digest:input.reviewedDigest},id);return assessment(tx,id);
   });
  },
  async assessment(id:string){parse(runId,id);return db.transaction(tx=>assessment(tx,id));},
  async recordEvidence(id:string,value:unknown){
   parse(runId,id);const input=parse(acceptanceEvidence,value);
   return db.transaction(async tx=>{
    const run=required((await tx.query('SELECT * FROM runs WHERE id=$1 FOR UPDATE',[id])).rows[0]);
    const prior=(await tx.query('SELECT * FROM acceptance_evidence WHERE run_id=$1 AND request_key=$2',[id,input.idempotencyKey])).rows[0];
    if(prior){if(!sameContent(prior.request,input))throw new StateConflict('Evidence key belongs to another decision.');return assessment(tx,id);}
    if(run.status==='cancelled')throw new StateConflict('Cancelled work cannot receive new acceptance evidence.');
    const current=await assessment(tx,id),criterion=current.criteria.find(c=>c.id===input.criterionId);
    if(!criterion||criterion.evidenceKind!==input.kind||criterion.evidenceVersion!==input.expectedEvidenceVersion)throw new StateConflict('Review the bound criterion, verifier kind and current evidence version.');
    let outcome:string,details:Row,job:string|null=null;
    if(input.kind==='owner-review'){outcome=input.outcome;details={note:input.note,verification:'owner-attestation'};}
    else{
     const source=(await tx.query('SELECT e.*,j.step_key FROM job_executions e JOIN jobs j ON j.id=e.job_id WHERE e.job_id=$1 AND e.run_id=$2',[input.jobId,id])).rows[0];
     if(!source||source.step_key!==criterion.sourceStepKey||source.status==='running')throw new StateConflict('Evidence requires the exact step result recorded in this run.');
     outcome=source.status==='succeeded'?'met':'not-met';job=input.jobId;details={jobId:job,callId:source.call_id,status:source.status,verification:'recorded-job-result'};
    }
    const evidenceId=createId('evidence'),version=criterion.evidenceVersion+1;
    await tx.query('INSERT INTO acceptance_evidence(id,run_id,requirements_id,revision,criterion_id,version,request_key,request,kind,outcome,source_job_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[evidenceId,id,current.requirements.id,current.requirements.revision,input.criterionId,version,input.idempotencyKey,JSON.stringify(input),input.kind,outcome,job,JSON.stringify(details)]);
    await history(tx,run.project_id,evidenceId,'acceptance.evidence-recorded',{criterionId:input.criterionId,version,kind:input.kind,outcome,requirementsId:current.requirements.id,revision:current.requirements.revision,authority:'local-owner'},id);
    return assessment(tx,id);
   });
  }
 };
}
