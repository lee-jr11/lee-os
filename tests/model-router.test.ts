import test from 'node:test';
import assert from 'node:assert/strict';
import { providerRegistry, defaultProviderRegistry } from '../packages/providers/src';
import { routeModel, getProviderCatalog, modelRequest, InvalidProviderRegistry } from '../packages/core/src/model-router';
import { buildPlan, planInput } from '../packages/core/src/orchestrator';
import { handleCoreRequest } from '../packages/core/src/api/http';
import { syntheticRegistry } from '../scripts/lib/synthetic-provider';
const now=new Date('2026-10-16T12:00:00Z');
const request={capabilities:['text'],inputTokens:1000,outputTokens:500};
function decision(change:(registry:ReturnType<typeof syntheticRegistry>)=>void) {
 const registry=syntheticRegistry(now);change(registry);return routeModel(request,{registry,now});
}
test('default providers are unconfigured; routing is blocked without external calls',()=>{
 const catalog=getProviderCatalog();assert.deepEqual(catalog.providers.map(p=>p.id),['gemini','codex','claude']);
 assert.ok(catalog.providers.every(p=>!p.enabled && !p.configured && p.models.length===0));
 const result=routeModel(request,{now});assert.equal(result.status,'blocked');assert.equal(result.selected,null);
 assert.equal(result.reason,'NO_CONFIGURED_MODELS');assert.equal(result.executionEnabled,false);
});
test('eligible snapshot selects only a model; does not reserve quota or mutate registry',()=>{
 const registry=syntheticRegistry(now),before=structuredClone(registry);
 const result=routeModel(request,{registry,now});assert.equal(result.status,'selected');
 assert.deepEqual(result.selected,{providerId:'demo-only',modelId:'fictional-model'});
 assert.equal(result.costPolicy,'ZERO_ONLY');assert.equal(result.executionEnabled,false);
 assert.deepEqual(routeModel(request,{registry,now}),result);assert.deepEqual(registry,before);
});
test('capability, capacity, account configuration, quota, and billing gates fail closed',()=>{
 const cases:[string,(r:ReturnType<typeof syntheticRegistry>)=>void][]=[
  ['PROVIDER_NOT_CONFIGURED',r=>{r[0].enabled=false;}],
  ['PROVIDER_NOT_CONFIGURED',r=>{r[0].configured=false;}],
  ['MODEL_DISABLED',r=>{r[0].models[0].enabled=false;}],
  ['CAPABILITY_MISMATCH',r=>{r[0].models[0].capabilities=['code'];}],
  ['TOKEN_CAPACITY_INSUFFICIENT',r=>{r[0].models[0].contextWindowTokens=2048;r[0].models[0].maxOutputTokens=400;}],
  ['TOKEN_CAPACITY_INSUFFICIENT',r=>{r[0].models[0].contextWindowTokens=1400;r[0].models[0].maxOutputTokens=1000;}],
  ['MODEL_UNAVAILABLE',r=>{r[0].models[0].availability.status='unknown';}],
  ['MODEL_UNAVAILABLE',r=>{r[0].models[0].availability.status='unavailable';}],
  ['QUOTA_UNAVAILABLE',r=>{r[0].models[0].availability.remainingRequests=0;}],
  ['QUOTA_UNAVAILABLE',r=>{r[0].models[0].availability.remainingRequests=null;}],
  ['COST_ACCOUNT_MISMATCH',r=>{r[0].models[0].cost.accountScope='other-account';}],
  ['COST_ACCOUNT_MISMATCH',r=>{r[0].accountScope=null;}],
  ['ZERO_COST_UNVERIFIED',r=>{r[0].models[0].cost.status='unknown';}],
  ['ZERO_COST_UNVERIFIED',r=>{r[0].models[0].cost.amountUsd=0.01;}],
  ['ZERO_COST_UNVERIFIED',r=>{r[0].models[0].cost.evidenceRef=null;}],
  ['PAID_FALLBACK_NOT_EXCLUDED',r=>{r[0].models[0].cost.billingHardLimitUsd=null;}],
  ['PAID_FALLBACK_NOT_EXCLUDED',r=>{r[0].models[0].cost.billingHardLimitUsd=1;}],
  ['PAID_FALLBACK_NOT_EXCLUDED',r=>{r[0].models[0].cost.paidFallbackEnabled=true;}],
  ['COST_SCOPE_INSUFFICIENT',r=>{r[0].models[0].cost.maxInputTokens=999;}],
  ['COST_SCOPE_INSUFFICIENT',r=>{r[0].models[0].cost.maxOutputTokens=null;}]
 ];
 for(const [reason,change] of cases){const result=decision(change);assert.equal(result.status,'blocked',reason);assert.ok(result.evaluations[0].reasons.includes(reason),reason);}
});
test('expired, future, missing, and overly long evidence is rejected for availability and cost',()=>{
 for(const field of ['availability','cost'] as const)for(const [checkedAt,expiresAt] of [
  [null,null],['2026-10-16T11:58:00Z',now.toISOString()],
  ['2026-10-16T12:00:01Z','2026-10-16T12:01:00Z'],
  ['2026-10-16T11:00:00Z','2026-10-16T12:01:00Z'],
  ['2026-10-16T12:00:00Z','2026-10-16T12:06:00Z'],
  ['2026-10-16T12:00:00Z','2026-10-16T11:59:00Z']
 ]) {
  const result=decision(r=>{Object.assign(r[0].models[0][field],{checkedAt,expiresAt});});
  assert.equal(result.status,'blocked');assert.ok(result.evaluations[0].reasons.includes(field==='cost'?'COST_EVIDENCE_STALE':'AVAILABILITY_STALE'));
 }
 const valid=decision(r=>{r[0].models[0].cost.expiresAt='2026-10-16T12:04:59Z';});assert.equal(valid.status,'selected');
});
test('selection is deterministic and ineligible preferred candidates never cause paid fallback',()=>{
 const registry=syntheticRegistry(now);const first=registry[0].models[0];
 registry[0].models=[{...structuredClone(first),id:'z-free',priority:5},{...structuredClone(first),id:'a-free',priority:5},
  {...structuredClone(first),id:'cheap-but-paid',priority:0,cost:{...first.cost,amountUsd:0.001}}];
 const selected=routeModel(request,{registry,now});assert.equal(selected.selected?.modelId,'a-free');
 registry[0].models.reverse();assert.deepEqual(routeModel(request,{registry,now}),selected);
 const restricted=routeModel({...request,allowedProviderIds:['other-provider']},{registry,now});assert.equal(restricted.status,'blocked');
 assert.ok(restricted.evaluations.every(e=>e.reasons.includes('PROVIDER_NOT_ALLOWED')));
});
test('registry validation rejects malformed identities, duplicates, invalid capacities and numbers',()=>{
 for(const change of [
  (r:ReturnType<typeof syntheticRegistry>)=>{r.push(structuredClone(r[0]));},
  (r:ReturnType<typeof syntheticRegistry>)=>{r[0].models.push(structuredClone(r[0].models[0]));},
  (r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].maxOutputTokens=9000;},
  (r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].cost.amountUsd=NaN;},
  (r:ReturnType<typeof syntheticRegistry>)=>{r[0].models[0].availability.remainingRequests=-1;}
 ]){const registry=syntheticRegistry(now);change(registry);assert.equal(providerRegistry.safeParse(registry).success,false);assert.throws(()=>routeModel(request,{registry,now}),InvalidProviderRegistry);}
 assert.throws(()=>routeModel(request,{registry:{secret:'never echo'}}),InvalidProviderRegistry);
 assert.throws(()=>routeModel(request,{now:new Date(NaN)}),InvalidProviderRegistry);
 assert.deepEqual(defaultProviderRegistry(),defaultProviderRegistry());
});
test('routing requirements reject unknown/duplicate capabilities, empty allowlists, and client cost claims',()=>{
 for(const input of [{...request,capabilities:[]},{...request,capabilities:['shell']},{...request,capabilities:['text','text']},
  {...request,allowedProviderIds:[]},{...request,allowedProviderIds:['x','x']},{...request,inputTokens:0},
  {...request,outputTokens:1.5},{...request,costPolicy:'PAID'},{...request,registry:syntheticRegistry(now)},
  {...request,now:now.toISOString()},{...request,executionEnabled:true}])assert.equal(modelRequest.safeParse(input).success,false);
});
test('planner includes model decisions but keeps every step blocked for dispatch',()=>{
 const input={expectedRunVersion:0,goal:'Draft',steps:[{key:'draft',title:'Draft',kind:'model',model:request}]};
 const blocked=buildPlan(input,{now});assert.equal(blocked.steps[0].modelDecision?.status,'blocked');
 const selected=buildPlan(input,{registry:syntheticRegistry(now),now});assert.equal(selected.plannerVersion,'2');
 assert.equal(selected.steps[0].modelDecision?.status,'selected');assert.equal(selected.status,'blocked');
 assert.equal(selected.steps[0].route.executable,false);
 assert.equal(planInput.safeParse({...input,steps:[{...input.steps[0],kind:'workflow'}]}).success,false);
 // Existing Structure 4 requests still validate; missing requirements do not guess a model.
 const legacy=buildPlan({...input,steps:[{key:'draft',title:'Draft',kind:'model'}]},{now});
 assert.equal(legacy.steps[0].modelDecision,undefined);assert.match(legacy.steps[0].route.reason,/requirements/);
});
test('owner catalog and routing API require auth and strict input, without opening storage',async()=>{
 const token='a'.repeat(64),origin='http://127.0.0.1:3000';let opened=0;
 const options={token,origin,database:()=>{opened++;throw Error('Must not open database');}};
 const call=(method:string,path:string,body?:unknown,headers:Record<string,string>={})=>handleCoreRequest(new Request(`${origin}/api/v1${path}`,{
  method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)
 }),options);
 assert.equal((await call('GET','/models/catalog',undefined,{Authorization:''})).status,401);
 assert.equal((await call('POST','/models/route',request,{Origin:'https://example.com'})).status,403);
 const catalog=await call('GET','/models/catalog');assert.equal(catalog.status,200);assert.equal(catalog.headers.get('Cache-Control'),'no-store');
 const response=await call('POST','/models/route',request);assert.equal(response.status,200);
 const data=(await response.json()).data;assert.equal(data.status,'blocked');assert.equal(data.selected,null);
 assert.equal((await call('POST','/models/route',{...request,registry:syntheticRegistry(now)})).status,400);
 assert.equal((await call('GET','/models/route')).status,405);
 assert.equal((await call('GET','/models/catalog?limit=5')).status,400);
 assert.equal((await call('POST','/models/route',{...request,now:now.toISOString()})).status,400);
 assert.equal(opened,0);
});
