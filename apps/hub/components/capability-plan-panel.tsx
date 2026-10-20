'use client';
import {useState} from 'react';
import type {CapabilityPlan} from '@leeos/core/capability-planning';
import type {OwnerClient} from '../lib/owner-client';
import {OwnerApiError} from '../lib/owner-client';
import {readWorkspace,type Run,type Workspace} from '../lib/workflow';
type Act=(action:(client:OwnerClient)=>Promise<()=>void>)=>Promise<void>;
export function CapabilityPlanPanel({run,digest,busy,act,onSaved}:{run:Run;digest:string;busy:boolean;act:Act;onSaved:(work:Workspace)=>void}){
 const [saved,setSaved]=useState<CapabilityPlan|null>(null),[inputTokens,setInputTokens]=useState(1000),[outputTokens,setOutputTokens]=useState(500),[notice,setNotice]=useState('');
 function load(){void act(async client=>{
  try{const result=await client.call<{plan:CapabilityPlan}>('GET',`/runs/${run.id}/plan`);return()=>{
   if(result.plan.plannerVersion==='3'){setSaved(result.plan);setNotice('Saved historical routing snapshot loaded. It grants no execution authority.');}
   else{setSaved(null);setNotice('This run has a legacy manual plan. Use a new unplanned run for capability-first planning.');}
  };}catch(error){if(error instanceof OwnerApiError&&error.status===404)return()=>{setSaved(null);setNotice('No saved plan. You can plan from the bound contract.');};throw error;}
 });}
 return <section className="draft"><h4>Capability-first planning · P0.2</h4>
  <p>LeeOS uses this run’s reviewed contract to identify work capabilities and evidence checks before choosing implementations. Missing requirement links and unavailable implementations remain explicit gaps.</p>
  <label>Estimated AI input token budget<input type="number" min={1} max={100000000} value={inputTokens} disabled={busy} onChange={e=>setInputTokens(Number(e.target.value))}/></label>
  <label>Maximum AI output tokens<input type="number" min={1} max={100000000} value={outputTokens} disabled={busy} onChange={e=>setOutputTokens(Number(e.target.value))}/></label>
  <p>These budgets scope model eligibility. They do not submit a prompt or reserve quota.</p>
  <div className="actions"><button className="secondary" disabled={busy} onClick={load}>Load saved capability plan</button><button disabled={busy||run.status!=='queued'||!Number.isInteger(inputTokens)||!Number.isInteger(outputTokens)||inputTokens<1||outputTokens<1||inputTokens>100000000||outputTokens>100000000} onClick={()=>void act(async client=>{
   const result=await client.call<{plan:CapabilityPlan}>('POST',`/runs/${run.id}/plan`,{mode:'capability-first',expectedRunVersion:run.version,reviewedRequirementsDigest:digest,modelBudget:{inputTokens,outputTokens}});
   const work=await readWorkspace(client,run.id);return()=>{setSaved(result.plan);onSaved(work);setNotice('Capability plan saved. No jobs, provider calls or permissions were created.');};
  })}>Plan from bound requirements</button></div>
  {saved&&<><p>Routing coverage: {saved.routingStatus} · Execution needs a separately accepted envelope and an independent worker.</p><p>Bound revision {saved.contract.revision} · {saved.contract.id}</p>
   <h4>Requirement coverage</h4><ul>{saved.coverage.map(r=><li key={r.requirementId}>{r.requirementId} · {r.required?'required':'optional'} · {r.status} · {r.capabilityIds.join(', ')||'needs capability links'}</li>)}</ul>
   <h4>Capabilities and implementations</h4>{saved.capabilities.map(n=><article className="job" key={n.id}><h4>{n.route.label}</h4><p>{n.required?'Required':'Optional'} · {n.route.status} · {n.route.reason}</p><p>Requirements: {n.requirementIds.join(', ')||'contract-wide'} · Criteria: {n.criterionIds.join(', ')||'none'}</p><pre>{JSON.stringify({selected:n.route.selected,evaluations:n.route.evaluations},null,2)}</pre></article>)}
   <h4>Remaining blockers</h4><pre>{JSON.stringify(saved.blockers,null,2)}</pre><p>This is a historical eligibility snapshot. Future execution must check availability, cost and permissions again. Review of these routes does not satisfy acceptance criteria.</p></>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
