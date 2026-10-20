import { z } from 'zod';
import { capability, defaultProviderRegistry, providerRegistry, type ProviderRegistry, type ModelDescriptor } from '@leeos/providers';
export const modelRequest = z.strictObject({
 capabilities: z.array(capability).min(1).max(4).refine(items=>new Set(items).size===items.length),
 inputTokens: z.number().int().min(1).max(100_000_000),
 outputTokens: z.number().int().min(1).max(100_000_000),
 allowedProviderIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/)).min(1).max(20)
  .refine(items=>new Set(items).size===items.length).optional()
});
export type ModelRequest = z.infer<typeof modelRequest>;
export class InvalidProviderRegistry extends Error {}
export const evidenceMaxAgeMs = 5 * 60 * 1000;
export interface RoutingOptions { registry?: unknown; now?: Date }
function registry(value: unknown): ProviderRegistry {
 const parsed=providerRegistry.safeParse(value);
 if(!parsed.success)throw new InvalidProviderRegistry('Invalid server provider registry.');
 return parsed.data;
}
function fresh(checked: string|null,expires: string|null,now: number) {
 if(!checked || !expires)return false;
 const start=Date.parse(checked),end=Date.parse(expires);
 return start<=now && now<end && end>start && now-start<=evidenceMaxAgeMs && end-start<=evidenceMaxAgeMs;
}
function costReasons(m: ModelDescriptor,request: ModelRequest,now: number,accountScope: string|null) {
 const cost=m.cost;const reasons: string[]=[];
 if(!accountScope || cost.accountScope!==accountScope)reasons.push('COST_ACCOUNT_MISMATCH');
 if(cost.status!=='verified-zero' || cost.amountUsd!==0 || !cost.evidenceRef)reasons.push('ZERO_COST_UNVERIFIED');
 if(!fresh(cost.checkedAt,cost.expiresAt,now))reasons.push('COST_EVIDENCE_STALE');
 if(cost.billingHardLimitUsd!==0 || cost.paidFallbackEnabled)reasons.push('PAID_FALLBACK_NOT_EXCLUDED');
 if(cost.maxInputTokens===null || cost.maxOutputTokens===null || request.inputTokens>cost.maxInputTokens || request.outputTokens>cost.maxOutputTokens)reasons.push('COST_SCOPE_INSUFFICIENT');
 return reasons;
}
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function routeModel(value: unknown,options: RoutingOptions={}) {
 const request=modelRequest.parse(value);
 const providers=registry(options.registry === undefined ? defaultProviderRegistry() : options.registry);
 const now=(options.now ?? new Date()).getTime();
 if(!Number.isFinite(now))throw new InvalidProviderRegistry('Invalid routing clock.');
 const evaluations=providers.flatMap(provider=>provider.models.map(model=>{
  const reasons: string[]=[];
  if(!provider.enabled || !provider.configured)reasons.push('PROVIDER_NOT_CONFIGURED');
  if(request.allowedProviderIds && !request.allowedProviderIds.includes(provider.id))reasons.push('PROVIDER_NOT_ALLOWED');
  if(!model.enabled)reasons.push('MODEL_DISABLED');
  if(!request.capabilities.every(c=>model.capabilities.includes(c)))reasons.push('CAPABILITY_MISMATCH');
  if(request.inputTokens+request.outputTokens>model.contextWindowTokens || request.outputTokens>model.maxOutputTokens)reasons.push('TOKEN_CAPACITY_INSUFFICIENT');
  if(model.availability.status!=='available')reasons.push('MODEL_UNAVAILABLE');
  if(!fresh(model.availability.checkedAt,model.availability.expiresAt,now))reasons.push('AVAILABILITY_STALE');
  if(model.availability.remainingRequests===null || model.availability.remainingRequests<1)reasons.push('QUOTA_UNAVAILABLE');
  reasons.push(...costReasons(model,request,now,provider.accountScope));
  return {providerId:provider.id,modelId:model.id,priority:model.priority,eligible:reasons.length===0,reasons};
 })).sort((a,b)=>a.priority-b.priority || compare(a.providerId,b.providerId) || compare(a.modelId,b.modelId));
 const winner=evaluations.find(e=>e.eligible);
 const selectedModel=winner ? providers.find(p=>p.id===winner.providerId)!.models.find(m=>m.id===winner.modelId)! : undefined;
 const validUntil=selectedModel ? new Date(Math.min(Date.parse(selectedModel.availability.expiresAt!),Date.parse(selectedModel.cost.expiresAt!))).toISOString() : null;
 return {routerVersion:'1',evaluatedAt:new Date(now).toISOString(),costPolicy:'ZERO_ONLY',executionEnabled:false,
  status:winner?'selected':'blocked', request, validUntil,
  selected:winner?{providerId:winner.providerId,modelId:winner.modelId}:null,
  reason:winner?'ELIGIBLE_SNAPSHOT_ONLY':evaluations.length?'NO_ELIGIBLE_MODEL':'NO_CONFIGURED_MODELS',
  evaluations};
}
export function getProviderCatalog(value: unknown=defaultProviderRegistry()) {
 return {catalogVersion:'1',executionEnabled:false,providers:registry(value).map(p=>({
  id:p.id,enabled:p.enabled,configured:p.configured,
  models:p.models.map(m=>({id:m.id,enabled:m.enabled,capabilities:m.capabilities,
   contextWindowTokens:m.contextWindowTokens,maxOutputTokens:m.maxOutputTokens,priority:m.priority}))
 }))};
}
