'use client';
import { useState,type FormEvent } from 'react';
import type { OwnerClient } from '../lib/owner-client';
import type { Project } from '../lib/workflow';

type Act=(action:(client:OwnerClient)=>Promise<()=>void>)=>Promise<void>;
type Center={
 project:Project&{description:string;updatedAt:string};
 automations:{id:string;name:string;status:string;version:number;lifecycleVersion:number;updatedAt:string}[];
 runs:{id:string;automationId:string|null;status:string;createdAt:string;finishedAt:string|null;goalAssessment:{goalStatus:string;criteriaStatus:string}|null}[];
 schedules:{id:string;automationId:string;automationVersion:number;kind:string;enabled:boolean;nextRunAt:string|null;timezone:string}[];
 subscriptions:{id:string;automationId:string;eventKind:string;enabled:boolean}[];
 artifacts:{id:string;runId:string|null;name:string;mediaType:string;sizeBytes:number|null;available:boolean;createdAt:string}[];
 receipts:{id:string;outcome:string;reason:string;createdAt:string}[];
 attention:{id:string;kind:string;status:string;runId:string|null;summary:string}[];
 completedRuns:{runId:string;goalStatus:string;finishedAt:string|null}[];
};
type Memory={id:string;kind:string;scope:string;summary:string;content:Record<string,unknown>;tags:string[];sourceArtifactId:string|null};
const memoryKinds=['user-preference','automation-knowledge','project-decision','engineering-lesson'];
export function CommandCenterPanel({projectId,busy,act,onProjectUpdate}:{projectId:string;busy:boolean;act:Act;onProjectUpdate:(project:Project)=>void}){
 const [view,setView]=useState<Center|null>(null),[confirmed,setConfirmed]=useState(''),[notice,setNotice]=useState('');
 const [kind,setKind]=useState('project-decision'),[scope,setScope]=useState<'owner'|'project'|'automation'>('project'),[automationId,setAutomationId]=useState(''),[summary,setSummary]=useState(''),[content,setContent]=useState(''),[tags,setTags]=useState(''),[artifactId,setArtifactId]=useState(''),[memoryReview,setMemoryReview]=useState(false);
 const [retrieveTags,setRetrieveTags]=useState(''),[retrieveAutomation,setRetrieveAutomation]=useState(''),[memories,setMemories]=useState<Memory[]>([]);
 function refresh(){void act(async c=>{const next=await c.call<Center>('GET',`/projects/${projectId}/command-center`);return()=>{setView(next);onProjectUpdate(next.project);setConfirmed('');};});}
 function transition(kind:'project'|'automation',id:string,action:'pause'|'resume'|'archive',version:number){
  const signature=`${kind}:${id}:${action}:${version}`;if(confirmed!==signature)return;
  void act(async c=>{
   const path=kind==='project'?`/projects/${id}/lifecycle`:`/automations/${id}/lifecycle`;
   await c.call('POST',path,{action,expectedVersion:version});
   const next=await c.call<Center>('GET',`/projects/${projectId}/command-center`);
   return()=>{setView(next);onProjectUpdate(next.project);setConfirmed('');setNotice(`${kind==='project'?'Project':'Automation'} ${action} command saved.`);};
  });
 }
 function createMemory(e:FormEvent){e.preventDefault();if(!memoryReview)return;const cleanTags=tags.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
  void act(async c=>{const body={kind,scope,...(scope==='owner'?{}:{projectId}),...(scope==='automation'?{automationId}:{}),summary:summary.trim(),content:{text:content.trim()},tags:cleanTags,...(artifactId?{sourceArtifactId:artifactId}:{}),acknowledgeReview:true};
   const saved=await c.call<Memory>('POST','/memories',body);return()=>{setSummary('');setContent('');setTags('');setArtifactId('');setMemoryReview(false);setNotice(`Reviewed memory saved (${saved.scope} scope). It is available only through tagged retrieval.`);};
  });
 }
 function retrieve(e:FormEvent){e.preventDefault();const cleanTags=retrieveTags.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);if(!cleanTags.length)return;
  void act(async c=>{const result=await c.call<{items:Memory[]}>('POST','/memories/retrieve',{projectId,...(retrieveAutomation?{automationId:retrieveAutomation}:{}),tags:cleanTags});return()=>setMemories(result.items);});
 }
 return <section className="panel" aria-label="LeeOS command center"><details><summary>Command center · current status, controls and attention</summary>
  <p>LeeOS backend state is authoritative. This view reads the saved project, automations, runs, schedules, artifacts and goal evidence; it does not infer success from a browser action.</p>
  <button className="secondary" disabled={busy} onClick={refresh}>{view?'Refresh command center':'Load command center'}</button>
  {notice&&<p role="status">{notice}</p>}
  {view&&<>
   <article className="job"><div className="section-title"><h4>{view.project.name}</h4><span className="state">{view.project.status}</span></div><p className="identifier">{view.project.id} · lifecycle version {view.project.lifecycleVersion}</p>
    <label className="check"><input type="checkbox" disabled={busy} checked={confirmed===`project:${projectId}:${view.project.status==='paused'?'resume':'pause'}:${view.project.lifecycleVersion}`} onChange={e=>setConfirmed(e.target.checked?`project:${projectId}:${view.project.status==='paused'?'resume':'pause'}:${view.project.lifecycleVersion}`:'')}/>I reviewed the project pause or resume change.</label>
    {view.project.status!=='archived'&&<label className="check"><input type="checkbox" disabled={busy} checked={confirmed===`project:${projectId}:archive:${view.project.lifecycleVersion}`} onChange={e=>setConfirmed(e.target.checked?`project:${projectId}:archive:${view.project.lifecycleVersion}`:'')}/>I reviewed the permanent archive action.</label>}
    <div className="actions">{view.project.status==='paused'?<button className="secondary" disabled={busy||!confirmed.startsWith(`project:${projectId}:resume:`)} onClick={()=>transition('project',projectId,'resume',view.project.lifecycleVersion)}>Resume project</button>:!['archived','completed'].includes(view.project.status)&&<button className="secondary" disabled={busy||!confirmed.startsWith(`project:${projectId}:pause:`)} onClick={()=>transition('project',projectId,'pause',view.project.lifecycleVersion)}>Pause project</button>}
     {view.project.status!=='archived'&&<button className="secondary" disabled={busy||!confirmed.startsWith(`project:${projectId}:archive:`)} onClick={()=>transition('project',projectId,'archive',view.project.lifecycleVersion)}>Archive project</button>}</div>
    <p className="muted">Pause holds new work and trigger polling while existing runs retain their recorded state. Archive also disables the project’s schedules and event rules.</p>
   </article>
   <h4>Attention</h4>{view.attention.length?<div className="item-list">{view.attention.map(item=><article className="job" key={item.id}><strong>{item.kind} · {item.status}</strong><p>{item.summary}</p>{item.runId&&<small className="identifier">Run {item.runId}</small>}</article>)}</div>:<p>No blocked work or pending review is reported.</p>}
   <h4>Automations</h4>{view.automations.map(a=>{const signature=`automation:${a.id}:${a.status==='paused'?'resume':'pause'}:${a.lifecycleVersion}`;return <article className="job" key={a.id}><div className="section-title"><h4>{a.name}</h4><span className="state">{a.status}</span></div><p className="identifier">{a.id} · definition v{a.version} · lifecycle v{a.lifecycleVersion}</p>
    <label className="check"><input type="checkbox" disabled={busy} checked={confirmed===signature} onChange={e=>setConfirmed(e.target.checked?signature:'')}/>I reviewed this automation pause or resume change.</label>
    {a.status!=='archived'&&<label className="check"><input type="checkbox" disabled={busy} checked={confirmed===`automation:${a.id}:archive:${a.lifecycleVersion}`} onChange={e=>setConfirmed(e.target.checked?`automation:${a.id}:archive:${a.lifecycleVersion}`:'')}/>I reviewed the permanent archive action.</label>}
    <div className="actions">{a.status==='paused'?<button className="secondary" disabled={busy||confirmed!==signature} onClick={()=>transition('automation',a.id,'resume',a.lifecycleVersion)}>Resume</button>:!['archived'].includes(a.status)&&<button className="secondary" disabled={busy||confirmed!==`automation:${a.id}:pause:${a.lifecycleVersion}`} onClick={()=>transition('automation',a.id,'pause',a.lifecycleVersion)}>Pause</button>}
     {a.status!=='archived'&&<button className="secondary" disabled={busy||confirmed!==`automation:${a.id}:archive:${a.lifecycleVersion}`} onClick={()=>transition('automation',a.id,'archive',a.lifecycleVersion)}>Archive</button>}</div>
   </article>;})}
   <h4>Recent runs and goal state</h4>{view.runs.length?<div className="item-list">{view.runs.map(run=><article className="job" key={run.id}><strong>{run.status} · {run.goalAssessment?.goalStatus??'goal not assessed'}</strong><p className="identifier">{run.id} · {new Date(run.createdAt).toLocaleString()}</p></article>)}</div>:<p>No runs recorded.</p>}
   <h4>Schedules and event rules</h4>{[...view.schedules.map(x=>({id:x.id,label:`${x.kind} · ${x.enabled?'enabled':'disabled'} · ${x.nextRunAt?new Date(x.nextRunAt).toLocaleString()+' '+x.timezone:'no next occurrence'}`})),...view.subscriptions.map(x=>({id:x.id,label:`${x.eventKind} · ${x.enabled?'enabled':'disabled'}`}))].map(item=><p className="identifier" key={item.id}>{item.label} · {item.id}</p>)}{!view.schedules.length&&!view.subscriptions.length&&<p>No triggers registered.</p>}
   <h4>Files and results</h4>{view.artifacts.map(item=><article className="job" key={item.id}><strong>{item.name}</strong><p>{item.mediaType} · {item.available?'stored bytes available':'metadata only or bytes unavailable'}{item.sizeBytes===null?'':` · ${item.sizeBytes} bytes`}</p><small className="identifier">{item.id}{item.runId?` · run ${item.runId}`:''}</small></article>)}{!view.artifacts.length&&<p>No artifacts registered.</p>}
   <h4>Completed work</h4>{view.completedRuns.map(item=><p className="identifier" key={item.runId}>{item.runId} · goal {item.goalStatus} · {item.finishedAt?new Date(item.finishedAt).toLocaleString():'completion time unavailable'}</p>)}{!view.completedRuns.length&&<p>No completed runs yet.</p>}
  </>}
  <details><summary>Structured memory · separate from logs, events, artifacts and current state</summary><p>Memories are written only after your review and retrieved by matching tags. Retrieval returns at most five authorized owner, project or automation memories and is not inserted into prompts automatically.</p>
   <form onSubmit={createMemory}><fieldset disabled={busy}><label>Memory type<select value={kind} onChange={e=>setKind(e.target.value)}>{memoryKinds.map(x=><option key={x}>{x}</option>)}</select></label><label>Scope<select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="owner">Owner-wide preference</option><option value="project">This project</option><option value="automation">One automation</option></select></label>
    {scope==='automation'&&<label>Automation<select required value={automationId} onChange={e=>setAutomationId(e.target.value)}><option value="">Choose an automation</option>{(view?.automations??[]).map(a=><option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}</select></label>}
    <label>Short summary<input required maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)}/></label><label>Memory detail<textarea required maxLength={8000} value={content} onChange={e=>setContent(e.target.value)}/></label><label>Tags, comma-separated<input required value={tags} onChange={e=>setTags(e.target.value)} placeholder="formatting, reports"/></label>
    {scope!=='owner'&&<label>Stored artifact evidence<select value={artifactId} onChange={e=>setArtifactId(e.target.value)}><option value="">No artifact evidence</option>{(view?.artifacts??[]).filter(a=>a.available).map(a=><option key={a.id} value={a.id}>{a.name} · {a.id}</option>)}</select></label>}
    <label className="check"><input type="checkbox" checked={memoryReview} onChange={e=>setMemoryReview(e.target.checked)}/>I reviewed this reusable fact and its scope. Enable tagged retrieval.</label><button disabled={!memoryReview||!summary.trim()||!content.trim()||!tags.trim()||(scope==='automation'&&!automationId)}>Save reviewed memory</button>
   </fieldset></form>
   <form onSubmit={retrieve}><fieldset disabled={busy}><label>Retrieve by tags<input required value={retrieveTags} onChange={e=>setRetrieveTags(e.target.value)} placeholder="formatting, reports"/></label><label>Limit to automation<select value={retrieveAutomation} onChange={e=>setRetrieveAutomation(e.target.value)}><option value="">Project-wide context</option>{(view?.automations??[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button disabled={!retrieveTags.trim()}>Retrieve relevant memories</button></fieldset></form>
   {memories.map(m=><article className="job" key={m.id}><strong>{m.summary}</strong><p>{String(m.content.text??'')}</p><small className="identifier">{m.kind} · {m.scope} · tags: {m.tags.join(', ')}{m.sourceArtifactId?` · evidence ${m.sourceArtifactId}`:''}</small></article>)}{memories.length===0&&<p>No matching memory is currently displayed.</p>}
  </details>
 </details></section>;
}
