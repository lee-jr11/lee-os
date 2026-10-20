import type { ProviderRegistry } from '@leeos/providers';
// Fictional metadata for demos/tests only. Never registered by the Hub.
export function syntheticRegistry(now: Date): ProviderRegistry {
 const checkedAt=new Date(now.getTime()-1000).toISOString();
 const expiresAt=new Date(now.getTime()+60_000).toISOString();
 return [{id:'demo-only',enabled:true,configured:true,accountScope:'demo-account',models:[{
  id:'fictional-model',enabled:true,priority:10,capabilities:['text','code','structured-output'],
  contextWindowTokens:8192,maxOutputTokens:2048,
  availability:{status:'available',checkedAt,expiresAt,remainingRequests:2},
  cost:{status:'verified-zero',amountUsd:0,checkedAt,expiresAt,evidenceRef:'synthetic-evidence',accountScope:'demo-account',
   maxInputTokens:4096,maxOutputTokens:2048,billingHardLimitUsd:0,paidFallbackEnabled:false}
 }]}];
}
