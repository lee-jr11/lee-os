import {createRequirementsManager} from '../requirements/store';
import {createEnvelopeWorkerStore} from '../envelope-worker/store';
import {humanReview} from '../envelope-worker';
import {createEnvelopeManager} from '../execution-envelope/store';
import {envelopeId,envelopeDraft,envelopeAccept,envelopeRevoke} from '../execution-envelope';
import {requirementsId,requirementsCreate,requirementsRevise,requirementsReview,requirementsBind,acceptanceEvidence} from '../requirements';
import { interpretRequest,requestId as intakeRequestId,intakePreview,intakeCreate,intakeClarify,intakeEdit,intakeApprove,intakeCancel } from '../request-intake';
import { createRequestIntake } from '../request-intake/store';
import { createCoordinator,scheduleCreate,subscriptionCreate,scheduleId,subscriptionId,triggerCommand,tickRequest } from '../scheduler';
import { createJobWorker,executeJobRequest,reviewJobRequest } from '../job-worker';
import { localGenerateRequest,recoverLocalRequest } from '../provider-manager';
import { createLocalProviderManager,getLocalCall,listLocalCalls } from '../provider-manager/service';
import {createGeminiProviderManager} from '../provider-manager/gemini';
import {defaultProviderRegistry,createResendEmailAdapter,verifyResendWebhook} from '@leeos/providers';
import { getAgentCatalog,roleRegistration,assignAgentRequest,dismissAgentRequest } from '../agent-manager';
import { createAgentManager } from '../agent-manager/store';
import { getExecutorCatalog } from '@leeos/executors';
import { createExecutionManager } from '../execution-manager/store';
import { prepareRequest } from '../execution-manager';
import { getProviderCatalog, routeModel, modelRequest, InvalidProviderRegistry } from '../model-router';
import { createPlanner,planningRequest } from '../orchestrator/store';
import {getCapabilityCatalog} from '../task-router/capabilities';
import { randomUUID } from 'node:crypto';
import { StateConflict, type StateDatabase } from '@leeos/database';
import { getSystemStatus } from '../index';
import { authorize } from './auth';
import { readBinary,readJson } from './body';
import * as c from './contracts';
import { ApiError, validationError } from './errors';
import { createCoreService } from './service';
import {ArtifactStorageError,artifactIdSchema,artifactIdempotencyKeySchema,artifactMaxBytes,artifactMediaTypeSchema,artifactNameSchema,createArtifactStorage} from '../storage-manager';
import { createLifecycleManager,lifecycleCommand,projectLifecycleId,automationLifecycleId } from '../lifecycle';
import { createMemoryManager,memoryCreate,memoryRetrieve } from '../memory-manager';
import { createCommandCenter } from '../command-center';
export interface ApiOptions { coordinationEnabled?:()=>boolean; jobExecutionEnabled?:()=>boolean; artifactStorageEnabled?:()=>boolean; token?: string; origin: string; database: () => Promise<StateDatabase> | StateDatabase; localProvider?: ReturnType<typeof createLocalProviderManager>; geminiProvider?:ReturnType<typeof createGeminiProviderManager>; resendWebhookSecret?:string|(()=>string|undefined) }
function decodeArtifactName(value:string){try{return decodeURIComponent(value);}catch{return validationError();}}
function mappedError(error: unknown): ApiError {
 if(error instanceof ArtifactStorageError)return new ApiError(error.status,error.code,error.message);
 if (error instanceof InvalidProviderRegistry) return new ApiError(503,'MODEL_REGISTRY_INVALID','The server model registry is unavailable.');
 if (error instanceof ApiError) return error;
 if (error instanceof StateConflict) return new ApiError(409,'STATE_CONFLICT','The state changed or this transition is not allowed. Refresh the record before retrying.');
 const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
 if (['23503','23505'].includes(code)) return new ApiError(409,'STATE_CONFLICT','A related record changed or this request conflicts with existing state.');
 if (['23514','22P02','22003'].includes(code)) return new ApiError(400,'INVALID_REQUEST','The request violates a data constraint.');
 if (['42P01','42703'].includes(code)) return new ApiError(503,'STORAGE_NOT_READY','Apply the current database migrations first.');
 if (/^(08|57P0|ECONN|ENET|EHOST|ETIMEDOUT)/.test(code)) return new ApiError(503,'STORAGE_UNAVAILABLE','The database is unavailable.');
 return new ApiError(500,'INTERNAL_ERROR','The request could not be completed.');
}
export async function handleCoreRequest(request: Request, options: ApiOptions): Promise<Response> {
 const requestId=randomUUID(); let allow: string | undefined;
 const headers = () => ({ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Request-Id':requestId, Vary:'Authorization, Origin', ...(allow ? { Allow:allow } : {}) });
 const success = (data: unknown,status=200,location?: string) => Response.json({ data,requestId },{ status,headers:{ ...headers(),...(location ? { Location:location } : {}) } });
 try {
  const url=new URL(request.url);
  if(url.pathname==='/api/v1/webhooks/resend'){
   if(request.method!=='POST')throw new ApiError(405,'METHOD_NOT_ALLOWED','This method is not supported for this route.');
   if(url.search||request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new ApiError(415,'JSON_REQUIRED','Send an unencoded JSON webhook body.');
   const raw=new TextDecoder('utf-8',{fatal:true}).decode(await readBinary(request,65536));
   const secret=typeof options.resendWebhookSecret==='function'?options.resendWebhookSecret():options.resendWebhookSecret??process.env.RESEND_WEBHOOK_SECRET;
   if(!secret||!verifyResendWebhook({payload:raw,secret,id:request.headers.get('svix-id'),timestamp:request.headers.get('svix-timestamp'),signature:request.headers.get('svix-signature')}))throw new ApiError(401,'WEBHOOK_SIGNATURE_INVALID','The provider webhook signature is invalid or expired.');
   let payload:unknown;try{payload=JSON.parse(raw);}catch{throw new ApiError(400,'INVALID_REQUEST','The provider webhook body is invalid.');}
   const eventId=request.headers.get('svix-id')!,received=await createEnvelopeWorkerStore(await options.database()).receiveResendWebhook(eventId,payload);
   if(!received.matched)throw new ApiError(503,'DELIVERY_EFFECT_NOT_READY','The signed provider event is not yet correlated to a durable LeeOS effect.');
   return success({accepted:true,duplicate:received.duplicate,ignored:received.ignored},202);
  }
  authorize(request,options.token,options.origin);
  if (!/^\/api\/v1(?:\/|$)/.test(url.pathname)) throw new ApiError(404,'NOT_FOUND','API route not found.');
  const path=url.pathname.replace(/^\/api\/v1\/?/,'').replace(/\/$/,'');
  function query(allowed: string[]) {
   const result: Record<string,string> = {};
   for (const [key,value] of url.searchParams) { if (!allowed.includes(key) || Object.hasOwn(result,key)) return validationError(); result[key]=value; }
   return result;
  }
  function method(...accepted: string[]) { if (!accepted.includes(request.method)) { allow=accepted.join(', '); throw new ApiError(405,'METHOD_NOT_ALLOWED','This method is not supported for this route.'); } }
  function pagination(idSchema: typeof c.projectId | null) {
   const result=c.parse(c.pageQuery,query(['after','limit']));
   if (result.after !== undefined) {
    if (idSchema) c.parse(idSchema,result.after);
    else if (!/^(0|[1-9]\d{0,18})$/.test(result.after) || BigInt(result.after) > 9223372036854775807n) return validationError();
   }
   return { after:result.after ?? null,limit:result.limit ?? 25 };
  }
  let service: ReturnType<typeof createCoreService> | undefined;
  async function core() { return service ??= createCoreService(await options.database()); }
  function requireArtifactStorage(){if(options.artifactStorageEnabled?.()!==true)throw new ApiError(503,'ARTIFACT_STORAGE_DISABLED','Artifact storage is disabled until an owner enables it.');}
  async function artifactStorage(){requireArtifactStorage();return createArtifactStorage(await options.database(),{enabled:()=>options.artifactStorageEnabled?.()===true});}
  async function providerRegistry(){
   let providers=options.localProvider?await options.localProvider.registry(request.signal):defaultProviderRegistry();
   if(options.geminiProvider){const remote=await options.geminiProvider.registry(request.signal);providers=providers.map(provider=>provider.id==='gemini'?remote.find(candidate=>candidate.id==='gemini')??provider:provider);}
   return providers;
  }
  if (request.method === 'GET' && request.body) return validationError();
  const lifecycleProject=/^projects\/([^/]+)\/lifecycle$/.exec(path);
  if(lifecycleProject){method('POST');query([]);const id=c.parse(projectLifecycleId,lifecycleProject[1]),body=c.parse(lifecycleCommand,await readJson(request));return success(await createLifecycleManager(await options.database()).project(id,body));}
  if(path==='memories'){
   method('POST');query([]);const body=c.parse(memoryCreate,await readJson(request));return success(await createMemoryManager(await options.database()).create(body),201);
  }
  if(path==='memories/retrieve'){
   method('POST');query([]);const body=c.parse(memoryRetrieve,await readJson(request));return success(await createMemoryManager(await options.database()).retrieve(body));
  }
  const commandCenter=/^projects\/([^/]+)\/command-center$/.exec(path);
  if(commandCenter){method('GET');query([]);const id=c.parse(c.projectId,commandCenter[1]);return success(await createCommandCenter(await options.database()).get(id));}
  const lifecycleAutomation=/^automations\/([^/]+)\/lifecycle$/.exec(path);
  if(lifecycleAutomation){method('POST');query([]);const id=c.parse(automationLifecycleId,lifecycleAutomation[1]),body=c.parse(lifecycleCommand,await readJson(request));return success(await createLifecycleManager(await options.database()).automation(id,body));}
  const projectArtifacts=/^projects\/([^/]+)\/artifacts$/.exec(path);
  if(projectArtifacts){
   const projectId=c.parse(c.projectId,projectArtifacts[1]);method('GET','POST');
   if(request.method==='GET'){
    const page=c.parse(c.pageQuery,query(['after','limit'])),after=page.after?c.parse(artifactIdSchema,page.after):null;
    return success(await (await artifactStorage()).list(projectId,page.limit??25,after));
   }
   query([]);requireArtifactStorage();
   const encodedName=request.headers.get('x-leeos-artifact-name'),key=c.parse(artifactIdempotencyKeySchema,request.headers.get('idempotency-key')),
    name=encodedName===null?validationError():decodeArtifactName(encodedName),mediaType=c.parse(artifactMediaTypeSchema,request.headers.get('content-type')),
    rawRunId=request.headers.get('x-leeos-run-id'),runId=rawRunId===null?null:c.parse(c.runId,rawRunId);
   c.parse(artifactNameSchema,name);
   const bytes=await readBinary(request,artifactMaxBytes),receipt=await (await artifactStorage()).register({projectId,runId,name,mediaType,idempotencyKey:key,creator:'owner-api',bytes});
   return success(receipt,receipt.created?201:200,`/api/v1/artifacts/${receipt.artifact.id}`);
  }
  const artifactPath=/^artifacts\/([^/]+)(?:\/(content))?$/.exec(path);
  if(artifactPath){
   method('GET');query([]);const id=c.parse(artifactIdSchema,artifactPath[1]),storage=await artifactStorage();
   if(!artifactPath[2])return success(await storage.get(id));
   const {artifact,bytes}=await storage.getContent(id),encoded=encodeURIComponent(artifact.name).replace(/['()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
   return new Response(Buffer.from(bytes),{status:200,headers:{...headers(),'Content-Type':artifact.mediaType,'Content-Length':String(bytes.byteLength),
    'Content-Disposition':`attachment; filename="artifact"; filename*=UTF-8''${encoded}`,'Content-Security-Policy':'sandbox','ETag':`"sha256-${artifact.sha256}"`}});
  }
  if (path === '' || path === 'system') {
   method('GET'); query([]);
   return success({ ...getSystemStatus(), apiVersion:'v1', access:'local-owner', writes:'state-and-opt-in-controlled-jobs', workerActionsExposed:true, jobExecutionEnabled:options.jobExecutionEnabled?.()===true, coordinationEnabled:options.coordinationEnabled?.()===true });
  }
  const workRun=/^runs\/([^/]+)\/envelope-work$/.exec(path);
  if(workRun){method('GET');query([]);const id=c.parse(c.runId,workRun[1]);return success(await createEnvelopeWorkerStore(await options.database()).forRun(id));}
  const workItem=/^execution-envelopes\/([^/]+)\/(work|review)$/.exec(path);
  if(workItem){
   query([]);const id=c.parse(envelopeId,workItem[1]);method(workItem[2]==='review'?'POST':'GET');
   if(workItem[2]==='work')return success(await createEnvelopeWorkerStore(await options.database()).get(id));
   const input=c.parse(humanReview,await readJson(request)),manager=createEnvelopeWorkerStore(await options.database());await manager.review(id,input);return success(await manager.get(id));
  }
  const envelopeRun=/^runs\/([^/]+)\/execution-envelope(?:\/(preview))?$/.exec(path);
  if(envelopeRun){
   query([]);const id=c.parse(c.runId,envelopeRun[1]),preview=Boolean(envelopeRun[2]);method(...(preview?['POST']:['GET','POST']));
   if(request.method==='GET')return success(await createEnvelopeManager(await options.database()).forRun(id));
   const input=preview?c.parse(envelopeDraft,await readJson(request)):c.parse(envelopeAccept,await readJson(request));
   const manager=createEnvelopeManager(await options.database());
   if(preview)return success(await manager.preview(id,input));
   const data=await manager.accept(id,input);return success(data,201,`/api/v1/execution-envelopes/${data.id}`);
  }
  const envelopeItem=/^execution-envelopes\/([^/]+)(?:\/(revoke))?$/.exec(path);
  if(envelopeItem){
   query([]);const id=c.parse(envelopeId,envelopeItem[1]);method(envelopeItem[2]?'POST':'GET');
   if(!envelopeItem[2])return success(await createEnvelopeManager(await options.database()).get(id));
   const input=c.parse(envelopeRevoke,await readJson(request));return success(await createEnvelopeManager(await options.database()).revoke(id,input));
  }
  const requirementsProject=/^projects\/([^/]+)\/requirements$/.exec(path);
  if(requirementsProject){
   method('GET','POST');const project=c.parse(c.projectId,requirementsProject[1]);
   if(request.method==='GET'){const page=pagination(requirementsId);return success(await createRequirementsManager(await options.database()).list(project,page.after,page.limit));}
   query([]);const body=c.parse(requirementsCreate,await readJson(request));const data=await createRequirementsManager(await options.database()).create(project,body);return success(data,201,`/api/v1/requirements/${data.id}`);
  }
  const requirementsItem=/^requirements\/([^/]+)(?:\/(review|revisions\/([1-9][0-9]{0,9})))?$/.exec(path);
  if(requirementsItem){
   query([]);const id=c.parse(requirementsId,requirementsItem[1]),action=requirementsItem[2];method(...(action==='review'?['POST']:action?['GET']:['GET','PATCH']));
   if(request.method==='GET')return success(await createRequirementsManager(await options.database()).get(id,requirementsItem[3]?Number(requirementsItem[3]):undefined));
   const body=action==='review'?c.parse(requirementsReview,await readJson(request)):c.parse(requirementsRevise,await readJson(request));
   const manager=createRequirementsManager(await options.database());return success(action==='review'?await manager.review(id,body):await manager.revise(id,body));
  }
  const acceptancePath=/^runs\/([^/]+)\/(requirements|acceptance)(?:\/(evidence))?$/.exec(path);
  if(acceptancePath){
   query([]);const id=c.parse(c.runId,acceptancePath[1]),resource=acceptancePath[2],evidence=acceptancePath[3];
   if(resource==='requirements'&&evidence)throw new ApiError(404,'NOT_FOUND','API route not found.');
   method(...(evidence?['POST']:resource==='requirements'?['GET','POST']:['GET']));
   if(request.method==='GET')return success(await createRequirementsManager(await options.database()).assessment(id));
   const body=evidence?c.parse(acceptanceEvidence,await readJson(request)):c.parse(requirementsBind,await readJson(request));const manager=createRequirementsManager(await options.database());
   return success(evidence?await manager.recordEvidence(id,body):await manager.bind(id,body));
  }
  if(path==='requests/preview'){
   method('POST');query([]);const body=c.parse(intakePreview,await readJson(request));return success(interpretRequest(body.text));
  }
  const intakeProject=/^projects\/([^/]+)\/requests$/.exec(path);
  if(intakeProject){
   method('GET','POST');const project=c.parse(c.projectId,intakeProject[1]);
   if(request.method==='GET'){const page=pagination(intakeRequestId);return success(await createRequestIntake(await options.database()).list(project,page.after,page.limit));}
   query([]);const body=c.parse(intakeCreate,await readJson(request));const data=await createRequestIntake(await options.database()).create(project,body);return success(data,201,`/api/v1/requests/${data.id}`);
  }
  const intakeItem=/^requests\/([^/]+)(?:\/(approve|commands|clarify))?$/.exec(path);
  if(intakeItem){
   query([]);const id=c.parse(intakeRequestId,intakeItem[1]),action=intakeItem[2];method(...(action?['POST']:['GET','PATCH']));
   if(request.method==='GET')return success(await createRequestIntake(await options.database()).get(id));
   const value=await readJson(request);
   const input=action==='clarify'?c.parse(intakeClarify,value):action==='approve'?c.parse(intakeApprove,value):action==='commands'?c.parse(intakeCancel,value):c.parse(intakeEdit,value);
   const manager=createRequestIntake(await options.database());
   if(action==='clarify')return success(await manager.clarify(id,input));
   if(action==='approve')return success(await manager.approve(id,input));
   if(action==='commands')return success(await manager.cancel(id,input));
   return success(await manager.edit(id,input));
  }
  if(path==='coordinator'){
   method('GET');query([]);return success({enabled:options.coordinationEnabled?.()===true,mode:'explicit-poll',executionEnabled:false,maxBatchSize:20,missedIntervals:'coalesce-latest'});
  }
  if(path==='coordinator/tick'){
   method('POST');query([]);const input=c.parse(tickRequest,await readJson(request));
   if(!options.coordinationEnabled?.())throw new ApiError(503,'COORDINATION_DISABLED','Enable the local coordinator before polling.');
   return success(await createCoordinator(await options.database(),{enabled:options.coordinationEnabled}).tick(input));
  }
  const coordinationProject=/^projects\/([^/]+)\/(schedules|event-subscriptions|trigger-receipts)$/.exec(path);
  if(coordinationProject){
   const project=c.parse(c.projectId,coordinationProject[1]),resource=coordinationProject[2];
   method(...(resource==='trigger-receipts'?['GET']:['GET','POST']));
   const kind=resource==='schedules'?'schedule':'subscription';
   if(request.method==='GET'){
    const page=pagination(resource==='trigger-receipts'?null:kind==='schedule'?scheduleId:subscriptionId);
    const manager=createCoordinator(await options.database());
    return success(resource==='trigger-receipts'?await manager.receipts(project,page.after,page.limit):await manager.list(kind,project,page.after,page.limit));
   }
   query([]);const value=await readJson(request);const body=resource==='schedules'?c.parse(scheduleCreate,value):c.parse(subscriptionCreate,value);
   const data=await createCoordinator(await options.database()).create(kind,project,body);return success(data,201,`/api/v1/${resource}/${data.id}`);
  }
  const coordinationItem=/^(schedules|event-subscriptions)\/([^/]+)(?:\/(commands))?$/.exec(path);
  if(coordinationItem){
   query([]);const kind=coordinationItem[1]==='schedules'?'schedule':'subscription',id=c.parse(kind==='schedule'?scheduleId:subscriptionId,coordinationItem[2]);
   method(coordinationItem[3]?'POST':'GET');
   if(!coordinationItem[3])return success(await createCoordinator(await options.database()).get(kind,id));
   const body=c.parse(triggerCommand,await readJson(request));return success(await createCoordinator(await options.database()).command(kind,id,body));
  }
  const workerMatch=/^runs\/([^/]+)\/jobs\/([^/]+)\/(execute|review|result|reconcile)$/.exec(path);
  if(workerMatch){
   query([]);const run=c.parse(c.runId,workerMatch[1]),job=c.parse(c.jobId,workerMatch[2]),action=workerMatch[3];
   method(action==='result'?'GET':'POST');
   const input=action==='execute'?c.parse(executeJobRequest,await readJson(request)):action==='review'?c.parse(reviewJobRequest,await readJson(request)):action==='reconcile'?c.parse(c.emptyRequest,await readJson(request)):undefined;
   if(action==='execute'&&(!options.jobExecutionEnabled?.()||!options.localProvider))throw new ApiError(503,'JOB_EXECUTION_DISABLED','Controlled execution is disabled.');
   const worker=createJobWorker(await options.database(),{enabled:options.jobExecutionEnabled??(()=>false),provider:options.localProvider??createLocalProviderManager({enabled:()=>false})});
   if(action==='result')return success(await worker.get(run,job));
   if(action==='reconcile')return success(await worker.reconcile(run,job));
   if(action==='review')return success(await worker.review(run,job,input));
   return success(await worker.execute(run,job,input,request.signal));
  }
  if(path==='providers/local'){
   method('GET');query([]);return success(options.localProvider?await options.localProvider.inspect(request.signal):{providerId:'llamacpp-local',enabled:false,connection:'disabled',jobAuthority:'separate-owner-grant'});
  }
  if(path==='providers/local/calls'){
   method('GET','POST');
   if(request.method==='GET'){const p=pagination(recoverLocalRequest.shape.callId);return success(await listLocalCalls(await options.database(),p.after,p.limit));}
   query([]);const body=c.parse(localGenerateRequest,await readJson(request));
   if(!options.localProvider)throw new ApiError(503,'LOCAL_PROVIDER_DISABLED','The local provider is disabled.');
   options.localProvider.assertEnabled();const data=await options.localProvider.generate(await options.database(),body,request.signal);
   return success(data,201,`/api/v1/providers/local/calls/${data.id}`);
  }
  const callMatch=/^providers\/local\/calls\/([^/]+)$/.exec(path);
  if(callMatch){method('GET');query([]);const id=c.parse(recoverLocalRequest.shape.callId,callMatch[1]);return success(await getLocalCall(await options.database(),id));}
  if(path==='providers/local/recover'){
   method('POST');query([]);const body=c.parse(recoverLocalRequest,await readJson(request));
   const manager=options.localProvider??createLocalProviderManager({enabled:()=>false});
   return success(await manager.recover(await options.database(),body));
  }
  if(path==='providers/gemini/recover'){
   method('POST');query([]);const manager=options.geminiProvider??createGeminiProviderManager({enabled:()=>false});
   return success(await manager.recover(await options.database(),await readJson(request)));
  }
  const geminiCall=/^providers\/gemini\/calls\/([^/]+)$/.exec(path);
  if(geminiCall){method('GET');query([]);const manager=options.geminiProvider??createGeminiProviderManager({enabled:()=>false});return success(await manager.getCall(await options.database(),geminiCall[1]));}
  const providerStatus=/^providers\/(llamacpp-local|gemini)$/.exec(path);
  if(providerStatus){method('GET');query([]);if(providerStatus[1]==='gemini')return success(await (options.geminiProvider??createGeminiProviderManager({enabled:()=>false})).inspect(request.signal));return success(await (options.localProvider??createLocalProviderManager({enabled:()=>false})).inspect(request.signal));}
  if(path==='agents/catalog'){method('GET');query([]);return success(getAgentCatalog());}
  if(path==='agents/roles'){
   method('GET','POST');
   if(request.method==='GET'){const p=pagination(c.roleId);return success(await createAgentManager(await options.database()).listRoles(p.after,p.limit));}
   query([]);const input=c.parse(roleRegistration,await readJson(request));
   const data=await createAgentManager(await options.database()).registerRole(input);return success(data,201,`/api/v1/agents/roles/${data.id}`);
  }
  if (path === 'executors/catalog') {
   method('GET'); query([]); return success(getExecutorCatalog());
  }
  if(path==='capabilities/catalog'){method('GET');query([]);return success(getCapabilityCatalog());}
  if (path === 'models/catalog') {
   method('GET'); query([]); return success(getProviderCatalog(await providerRegistry()));
  }
  if (path === 'models/route') {
   method('POST'); query([]); const input=c.parse(modelRequest,await readJson(request));
   return success(routeModel(input,{registry:await providerRegistry()}));
  }
  if (path === 'projects') {
   method('GET','POST');
   if (request.method === 'GET') { const p=pagination(c.projectId); return success(await (await core()).listProjects(p.after,p.limit)); }
   query([]); const body=c.parse(c.projectCreate,await readJson(request)); const data=await (await core()).createProject(body);
   return success(data,201,`/api/v1/projects/${data.id}`);
  }
  let agentMatch=/^agents\/roles\/([^/]+)$/.exec(path);
  if(agentMatch){method('GET');query([]);const id=c.parse(c.roleId,agentMatch[1]);return success(await createAgentManager(await options.database()).getRole(id));}
  agentMatch=/^agents\/([^/]+)(?:\/(commands))?$/.exec(path);
  if(agentMatch){
   query([]);const id=c.parse(c.agentId,agentMatch[1]);
   if(agentMatch[2]){method('POST');const body=c.parse(dismissAgentRequest,await readJson(request));return success(await createAgentManager(await options.database()).dismiss(id,body));}
   method('GET');return success(await createAgentManager(await options.database()).get(id));
  }
  agentMatch=/^runs\/([^/]+)\/agents$/.exec(path);
  if(agentMatch){method('GET');const id=c.parse(c.runId,agentMatch[1]);const p=pagination(c.agentId);return success(await createAgentManager(await options.database()).list(id,p.after,p.limit));}
  agentMatch=/^runs\/([^/]+)\/jobs\/([^/]+)\/agent$/.exec(path);
  if(agentMatch){
   method('GET','POST');query([]);const run=c.parse(c.runId,agentMatch[1]),job=c.parse(c.jobId,agentMatch[2]);
   if(request.method==='GET')return success(await createAgentManager(await options.database()).forJob(run,job));
   const body=c.parse(assignAgentRequest,await readJson(request));const data=await createAgentManager(await options.database()).assign(run,job,body);
   return success(data,201,`/api/v1/agents/${(data.assignment as {id:string}).id}`);
  }
  let match=/^projects\/([^/]+)$/.exec(path);
  if (match) {
   method('GET','PATCH'); query([]); const id=c.parse(c.projectId,match[1]);
   if (request.method === 'GET') return success(await (await core()).getProject(id));
   const body=c.parse(c.projectRename,await readJson(request)); return success(await (await core()).renameProject(id,body));
  }
  match=/^projects\/([^/]+)\/(automations|runs|events)$/.exec(path);
  if (match) {
   const id=c.parse(c.projectId,match[1]); const resource=match[2]; method(...(resource === 'events' ? ['GET'] : ['GET','POST']));
   if (request.method === 'GET') {
    const p=pagination(resource === 'automations' ? c.automationId : resource === 'runs' ? c.runId : null); const api=await core();
    if (resource === 'automations') return success(await api.listAutomations(id,p.after,p.limit));
    if (resource === 'runs') return success(await api.listRuns(id,p.after,p.limit));
    return success(await api.listEvents(id,p.after ?? '0',p.limit));
   }
   query([]);
   if (resource === 'automations') {
    const body=c.parse(c.automationCreate,await readJson(request)); const data=await (await core()).createAutomation(id,body); return success(data,201,`/api/v1/automations/${data.id}`);
   }
   const body=c.parse(c.runCreate,await readJson(request)); const data=await (await core()).createRun(id,body); return success(data,201,`/api/v1/runs/${data.id}`);
  }
  match=/^automations\/([^/]+)$/.exec(path);
  if (match) {
   method('GET','PATCH'); query([]); const id=c.parse(c.automationId,match[1]);
   if (request.method === 'GET') return success(await (await core()).getAutomation(id));
   const body=c.parse(c.automationRevise,await readJson(request)); return success(await (await core()).reviseAutomation(id,body));
  }
  match=/^runs\/([^/]+)\/execution$/.exec(path);
  if(match){
   method('GET','POST');query([]);const id=c.parse(c.runId,match[1]);
   if(request.method==='GET')return success(await createExecutionManager(await options.database()).inspect(id));
   const input=c.parse(prepareRequest,await readJson(request));
   return success(await createExecutionManager(await options.database()).prepare(id,input),201,`/api/v1/runs/${id}/execution`);
  }
  match=/^runs\/([^/]+)\/plan$/.exec(path);
  if(match) {
   method('GET','POST'); query([]); const id=c.parse(c.runId,match[1]);
   if(request.method==='GET')return success(await createPlanner(await options.database()).get(id));
   const input=c.parse(planningRequest,await readJson(request));
   return success(await createPlanner(await options.database(),{routing:async()=>({registry:await providerRegistry(),emailDelivery:await createResendEmailAdapter().inspect(request.signal)})}).create(id,input),201,`/api/v1/runs/${id}/plan`);
  }
  match=/^runs\/([^/]+)(?:\/(commands|jobs))?$/.exec(path);
  if (match) {
   const id=c.parse(c.runId,match[1]);
   if (match[2] === 'commands') {
    method('POST'); query([]); const body=c.parse(c.runCommand,await readJson(request)); return success(await (await core()).controlRun(id,body));
   }
   method('GET');
   if (match[2] === 'jobs') { const p=pagination(c.jobId); return success(await (await core()).listJobs(id,p.after,p.limit)); }
   query([]); return success(await (await core()).getRun(id));
  }
  match=/^jobs\/([^/]+)$/.exec(path);
  if (match) { method('GET'); query([]); return success(await (await core()).getJob(c.parse(c.jobId,match[1]))); }
  throw new ApiError(404,'NOT_FOUND','API route not found.');
 } catch (error) {
  const safe=mappedError(error);
  return Response.json({ error:{ code:safe.code,message:safe.message },requestId },{ status:safe.status,headers:{ ...headers(),...(safe.status === 401 ? { 'WWW-Authenticate':'Bearer realm="leeos"' } : {}) } });
 }
}
