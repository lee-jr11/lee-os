'use client';
import {useRef,useState} from 'react';
import type {EnvelopeDraft,EnvelopePreview} from '@leeos/core/execution-envelope';
import type {CapabilityPlan} from '@leeos/core/capability-planning';
import type {OwnerClient} from '../lib/owner-client';
import {OwnerApiError} from '../lib/owner-client';
import type {Run} from '../lib/workflow';
type Act=(action:(client:OwnerClient)=>Promise<()=>void>)=>Promise<void>;
type Receipt={id:string;digest:string;envelope:unknown;operationIdentities:unknown;authorizationStatus:string;dispatchEnabled:false;acceptedAt:string};
export function ExecutionEnvelopePanel({run,busy,act}:{run:Run;busy:boolean;act:Act}){
 const [editor,setEditor]=useState(''),[preview,setPreview]=useState<EnvelopePreview|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null),[reviewed,setReviewed]=useState(''),[notice,setNotice]=useState(''),[revoke,setRevoke]=useState(false),[reason,setReason]=useState('');
 const remoteProvider=preview?.candidate?.constraints.location==='remote';
 const attempt=useRef<{signature:string;key:string}|null>(null);
 function draft():EnvelopeDraft{try{return JSON.parse(editor);}catch{throw new Error('Enter valid envelope JSON.');}}
 function load(){void act(async client=>{
  try{const saved=await client.call<Receipt>('GET',`/runs/${run.id}/execution-envelope`);return()=>{setReceipt(saved);setNotice('Accepted work recovered from server storage. Loading this record started no work.');};}
  catch(e){if(e instanceof OwnerApiError&&e.status===404)return()=>{setReceipt(null);setNotice('No accepted envelope for this run.');};throw e;}
 });}
 function seed(){void act(async client=>{
  const saved=await client.call<{runVersion:number;plan:CapabilityPlan}>('GET',`/runs/${run.id}/plan`);
  if(saved.plan.plannerVersion!=='3')throw new Error('This needs a capability-first plan.');
  const inspection=await client.call<{planDigest:string}>('GET',`/runs/${run.id}/execution`),c=saved.plan.contract.content;
  const textIds=c.requirements.filter(r=>r.capabilityIds?.includes('text_generation')).map(r=>r.id),reviewIds=[...new Set([...c.requirements.filter(r=>r.capabilityIds?.includes('owner_review')).map(r=>r.id),...c.acceptanceCriteria.filter(a=>a.evidenceKind==='owner-review').flatMap(a=>a.requirementIds)])];
  const textKey=c.acceptanceCriteria.find(a=>a.evidenceKind==='job-result')?.sourceStepKey??'draft',reviewKey=textKey==='review'?'review_outcome':'review';
  const textRoute=saved.plan.capabilities.find(n=>n.id==='text_generation')?.route;const modelDecision=textRoute&&'modelDecision' in textRoute?textRoute.modelDecision:undefined;
  const providerId=modelDecision?.selected?.providerId??'llamacpp-local';
  let fingerprint='';if(textIds.length){const provider=await client.call<{modelFingerprint?:string}>('GET',`/providers/${providerId}`);fingerprint=provider.modelFingerprint??'';}
  const budget=modelDecision?.request.outputTokens??128;
  const constraints:EnvelopeDraft['constraints']=providerId==='gemini'?{location:'remote',network:'provider-allowlist-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0}:{location:'local',network:'loopback-only',externalEffects:'none',maxAttempts:1,maxInputBytes:8192,spendLimitUsd:0};
  const contractInputs=Object.fromEntries(c.inputs.filter(i=>i.required).map(i=>[i.id,'Replace with the exact value for '+i.id]));
  const value:EnvelopeDraft={contractInputs,expectedRunVersion:run.version,reviewedPlanDigest:inspection.planDigest,grantExpiresAt:new Date(Date.now()+3600000).toISOString(),
   constraints,
   operations:[...(textIds.length?[{key:textKey,kind:'text.generate' as const,requirementIds:textIds,dependsOn:[],input:{source:'text-parts' as const,separator:'\n',parts:[{source:'literal' as const,text:'Replace with the exact prompt to authorize.'},...Object.keys(contractInputs).map(inputId=>({source:'contract-input' as const,inputId}))]},maxOutputTokens:Math.min(128,budget??128),modelFingerprint:fingerprint}]:[]),
    ...(reviewIds.length?[{key:reviewKey,kind:'owner.review' as const,requirementIds:reviewIds,dependsOn:textIds.length?[textKey]:[],inputs:textIds.length?[{source:'operation-output' as const,operationKey:textKey,output:'text' as const}]:[{source:'text-parts' as const,separator:'\n',parts:[{source:'literal' as const,text:'Replace with the exact text for the owner to review.'},...Object.keys(contractInputs).map(inputId=>({source:'contract-input' as const,inputId}))]}],artifacts:[]}]:[])],
   acceptanceBindings:c.acceptanceCriteria.filter(a=>a.evidenceKind==='job-result'||a.evidenceKind==='owner-review').map(a=>({criterionId:a.id,operationKey:a.evidenceKind==='job-result'?a.sourceStepKey!:reviewKey}))};
  return()=>{setEditor(JSON.stringify(value,null,2));setPreview(null);setReviewed('');setNotice('Template loaded. Replace the example input and inspect every binding. Complex contracts need explicit editing; preview identifies unsupported or missing work.');};
 });}
 return <section className="draft"><h4>Durable execution envelope · P0.3 / P0.5</h4><p>Record the exact work LeeOS may carry out later. Acceptance stores a narrow authorization; it does not start a worker or approve a human review. Remote model routes require fresh $0 project evidence again at dispatch.</p>
  <div className="actions"><button className="secondary" disabled={busy} onClick={load}>Load accepted envelope</button><button className="secondary" disabled={busy||run.status!=='queued'} onClick={seed}>Load envelope template</button></div>
  {!receipt&&<><label>Exact execution request<textarea rows={20} disabled={busy} value={editor} onChange={e=>{setEditor(e.target.value);setPreview(null);setReviewed('');}}/></label><p>Prompts are persisted in the owner database. Do not put credentials in them. Text outputs referenced by another operation remain explicit bindings; input bytes, tokens and pinned model identity must be checked before future dispatch.</p>
   <button disabled={busy||!editor||run.status!=='queued'} onClick={()=>void act(async client=>{const result=await client.call<EnvelopePreview>('POST',`/runs/${run.id}/execution-envelope/preview`,draft());return()=>{setPreview(result);setReviewed('');};})}>Preview exact envelope</button>
   {preview&&<>{remoteProvider&&<p role="note">Gemini’s unpaid tier may use prompts and responses to improve Google products. Review the exact prompt and avoid confidential material before accepting this route.</p>}<pre>{JSON.stringify(preview.canAccept?preview.candidate:preview.blockers,null,2)}</pre>{preview.canAccept&&<><p className="identifier">Envelope digest: {preview.digest}</p><label className="check"><input type="checkbox" disabled={busy} checked={reviewed===preview.digest} onChange={e=>setReviewed(e.target.checked?preview.digest:'')}/>I reviewed these exact inputs, implementation pins, constraints and expiring grants. Persist this authorized work; do not dispatch it.</label><button disabled={busy||reviewed!==preview.digest||run.status!=='queued'} onClick={()=>void act(async client=>{
    const value=draft(),signature=JSON.stringify([value,preview.digest]);if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
    const saved=await client.call<Receipt>('POST',`/runs/${run.id}/execution-envelope`,{...value,reviewedEnvelopeDigest:preview.digest,idempotencyKey:attempt.current.key,acknowledgeAuthorization:true});
    return()=>{setReceipt(saved);setReviewed('');setNotice('Authorized work persisted. Closing the browser will not erase it. The separately enabled worker can discover this work; this request does not launch it.');};
   })}>Accept and persist authorized work</button></>}</>}
  </>}
  {receipt&&<><p>Envelope {receipt.id} · Authorization: {receipt.authorizationStatus} · Accepted {receipt.acceptedAt}</p><p>This API does not dispatch work. Inspect independent worker ownership below. Reloading this record does not renew its grant or cost eligibility.</p><details><summary>Persisted exact work and operation identities</summary><pre>{JSON.stringify({digest:receipt.digest,envelope:receipt.envelope,operationIdentities:receipt.operationIdentities},null,2)}</pre></details>
   {receipt.authorizationStatus!=='revoked'&&<><label>Reason for revocation<input maxLength={2000} disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);setRevoke(false);}}/></label><label className="check"><input type="checkbox" disabled={busy} checked={revoke} onChange={e=>setRevoke(e.target.checked)}/>Revoke this envelope’s authorization permanently. Keep its history.</label><button className="secondary" disabled={busy||!revoke||!reason.trim()} onClick={()=>void act(async client=>{const saved=await client.call<Receipt>('POST',`/execution-envelopes/${receipt.id}/revoke`,{reviewedEnvelopeDigest:receipt.digest,acknowledgeRevocation:true,reason});return()=>{setReceipt(saved);setRevoke(false);setNotice('Authorization revoked; the immutable work record remains.');};})}>Revoke authorization</button></>}
  </>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
