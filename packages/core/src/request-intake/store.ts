import { createId,StateConflict,requireProjectNewWork,type StateDatabase,type SqlSession,type Row } from '@leeos/database';
import { parse,projectId } from '../api/contracts';
import { ApiError } from '../api/errors';
import { buildPlan,planInput } from '../orchestrator';
import { requestId,intakeCreate,intakeClarify,intakeEdit,intakeApprove,intakeCancel,interpretRequest,editedProposal,proposalDigest,type Proposal,type ApprovalReceipt } from './index';
const joined=`SELECT i.*,r.proposal,a.receipt AS approval FROM intake_requests i JOIN intake_revisions r ON r.request_id=i.id AND r.version=i.proposal_version LEFT JOIN intake_approvals a ON a.request_id=i.id`;
function required(row:Row|undefined):Row{if(!row)throw new ApiError(404,'NOT_FOUND','Request or project not found.');return row;}
function view(row:Row){return {id:String(row.id),projectId:String(row.project_id),text:String(row.source_text),status:String(row.status),version:Number(row.version),proposalVersion:Number(row.proposal_version),
 proposalDigest:proposalDigest(String(row.id),Number(row.proposal_version),row.proposal),proposal:row.proposal as Proposal,approval:row.approval??null,
 createdAt:new Date(row.created_at as string|Date).toISOString(),updatedAt:new Date(row.updated_at as string|Date).toISOString()};}
async function load(tx:SqlSession,id:string,lock=false){return required((await tx.query(joined+' WHERE i.id=$1'+(lock?' FOR UPDATE OF i':''),[id])).rows[0]);}
async function history(tx:SqlSession,project:unknown,id:string,kind:string,payload:Row={},run:unknown=null){
 await tx.query('INSERT INTO events(id,project_id,run_id,kind,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',[createId('event'),project,run,kind,id,JSON.stringify(payload)]);
}
export function createRequestIntake(db:StateDatabase){
 async function revise(id:string,expectedVersion:number,proposal:Proposal){
  return db.transaction(async tx=>{
   const row=await load(tx,id,true);
   if(!['draft','needs-clarification'].includes(String(row.status))||row.version!==expectedVersion)throw new StateConflict('Refresh the editable request and its version.');
   const next=Number(row.version)+1,status=proposal.questions.length?'needs-clarification':'draft';
   await tx.query('INSERT INTO intake_revisions(request_id,version,proposal) VALUES($1,$2,$3)',[id,next,JSON.stringify(proposal)]);
   await tx.query('UPDATE intake_requests SET status=$3,version=$2,proposal_version=$2 WHERE id=$1',[id,next,status]);
   await history(tx,row.project_id,id,'request.revised',{version:next,interpreter:proposal.interpreter});return view(await load(tx,id));
  });
 }
 return {
  async get(id:string){parse(requestId,id);return view(await load(db,id));},
  async list(project:string,after:string|null=null,limit=25){
   parse(projectId,project);if(after)parse(requestId,after);
   if(!Number.isInteger(limit)||limit<1||limit>100)throw new ApiError(400,'INVALID_REQUEST','Invalid page size.');
   required((await db.query('SELECT id FROM projects WHERE id=$1',[project])).rows[0]);
   const rows=(await db.query(joined+' WHERE i.project_id=$1 AND ($2::text IS NULL OR i.id>$2) ORDER BY i.id LIMIT $3',[project,after,limit+1])).rows,items=rows.slice(0,limit);
   return {items:items.map(r=>({id:r.id,status:r.status,version:r.version,goal:(r.proposal as Proposal).goal,questionCount:(r.proposal as Proposal).questions.length,createdAt:new Date(r.created_at as string|Date).toISOString()})),nextCursor:rows.length>limit?String(items.at(-1)!.id):null};
  },
  async create(project:string,value:unknown){
   parse(projectId,project);const input=parse(intakeCreate,value),proposal=interpretRequest(input.text);
   return db.transaction(async tx=>{
    required((await tx.query('SELECT id FROM projects WHERE id=$1 FOR NO KEY UPDATE',[project])).rows[0]);
    const prior=(await tx.query('SELECT id,creation_input=$3::jsonb AS same FROM intake_requests WHERE project_id=$1 AND request_key=$2',[project,input.idempotencyKey,JSON.stringify(input)])).rows[0];
    if(prior){if(!prior.same)throw new StateConflict('This key belongs to a different request.');return view(await load(tx,String(prior.id)));}
    await requireProjectNewWork(tx,project);
    const id=createId('request'),status=proposal.questions.length?'needs-clarification':'draft';
    await tx.query('INSERT INTO intake_requests(id,project_id,request_key,source_text,creation_input,status) VALUES($1,$2,$3,$4,$5,$6)',[id,project,input.idempotencyKey,input.text,JSON.stringify(input),status]);
    await tx.query('INSERT INTO intake_revisions(request_id,version,proposal) VALUES($1,0,$2)',[id,JSON.stringify(proposal)]);
    await history(tx,project,id,'request.created',{status,interpreter:proposal.interpreter});return view(await load(tx,id));
   });
  },
  async clarify(id:string,value:unknown){
   parse(requestId,id);const input=parse(intakeClarify,value);return revise(id,input.expectedVersion,interpretRequest(input.text));
  },
  async edit(id:string,value:unknown){
   parse(requestId,id);const input=parse(intakeEdit,value);return revise(id,input.expectedVersion,editedProposal(input));
  },
  async cancel(id:string,value:unknown){
   parse(requestId,id);const input=parse(intakeCancel,value);
   return db.transaction(async tx=>{
    const row=await load(tx,id,true);
    if(!['draft','needs-clarification'].includes(String(row.status))||row.version!==input.expectedVersion)throw new StateConflict('Refresh the editable request and its version.');
    await tx.query("UPDATE intake_requests SET status='cancelled',version=version+1 WHERE id=$1",[id]);
    await history(tx,row.project_id,id,'request.cancelled');return view(await load(tx,id));
   });
  },
  async approve(id:string,value:unknown){
   parse(requestId,id);const input=parse(intakeApprove,value);
   return db.transaction(async tx=>{
    const row=await load(tx,id,true);
    const saved=(await tx.query('SELECT *,input=$2::jsonb AS same FROM intake_approvals WHERE request_id=$1',[id,JSON.stringify(input)])).rows[0];
    if(saved){if(!saved.same)throw new StateConflict('A different approval is already recorded.');return saved.receipt as ApprovalReceipt;}
    await requireProjectNewWork(tx,String(row.project_id));
    if(row.status!=='draft'||row.version!==input.expectedVersion||proposalDigest(id,Number(row.proposal_version),row.proposal)!==input.reviewedProposalDigest)
     throw new StateConflict('Resolve clarification and review the current proposal digest/version.');
    const proposal=row.proposal as Proposal;
    if(proposal.questions.length)throw new StateConflict('Clarification is still required.');
    // Preserve historical proposals/receipts, but do not authorize an old rule draft
    // whose compound outcome is unresolved under the current interpreter.
    if(proposal.interpreter==='rules-v1'&&interpretRequest(proposal.goal).questions.length)throw new StateConflict('Current goal interpretation requires clarification. Save a clarification and review it again.');
    parse(intakeEdit,{expectedVersion:input.expectedVersion,goal:proposal.goal,steps:proposal.steps,acknowledgeScope:true});
    const planRequest=parse(planInput,{expectedRunVersion:0,goal:proposal.goal,steps:proposal.steps}),plan=buildPlan(planRequest),run=createId('run');
    await tx.query('INSERT INTO runs(id,project_id,definition_snapshot) VALUES($1,$2,$3)',[run,row.project_id,JSON.stringify({sourceRequestId:id,sourceProposalVersion:row.proposal_version,sourceProposalDigest:input.reviewedProposalDigest})]);
    await tx.query('INSERT INTO run_plans(run_id,run_version,input,plan) VALUES($1,0,$2,$3)',[run,JSON.stringify(planRequest),JSON.stringify(plan)]);
    const receipt:ApprovalReceipt={requestId:id,proposalVersion:Number(row.proposal_version),reviewedProposalDigest:input.reviewedProposalDigest,runId:run,initialRunStatus:'queued',costPolicy:'ZERO_ONLY',executionEnabled:false,permissions:[]};
    await tx.query('INSERT INTO intake_approvals(request_id,project_id,run_id,input,receipt) VALUES($1,$2,$3,$4,$5)',[id,row.project_id,run,JSON.stringify(input),JSON.stringify(receipt)]);
    await tx.query("UPDATE intake_requests SET status='approved',version=version+1 WHERE id=$1",[id]);
    await history(tx,row.project_id,run,'run.created',{sourceRequestId:id,executionEnabled:false},run);
    await history(tx,row.project_id,run,'run.planned',{plannerVersion:plan.plannerVersion,stepCount:planRequest.steps.length,status:'blocked'},run);
    await history(tx,row.project_id,id,'request.approved',{runId:run,proposalVersion:row.proposal_version},run);
    return receipt;
   });
  }
 };
}
