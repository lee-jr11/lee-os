import { z } from 'zod';
export interface ProviderAdapter { readonly id: string; readonly enabled: boolean; }
export const plannedProviderIds = ['gemini', 'codex', 'claude'] as const;
export const capability = z.enum(['text', 'code', 'structured-output', 'image-input']);
const identifier = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const tokens = z.number().int().min(1).max(100_000_000);
const instant = z.iso.datetime({ offset: true });
// Snapshots originate from trusted server adapters, never routing request bodies.
export const modelDescriptor = z.strictObject({
 id: identifier, capabilities: z.array(capability).min(1).max(4),
 contextWindowTokens: tokens, maxOutputTokens: tokens,
 priority: z.number().int().min(0).max(1000), enabled: z.boolean(),
 availability: z.strictObject({
  status: z.enum(['unknown','unavailable','available']),
  checkedAt: instant.nullable(), expiresAt: instant.nullable(),
  remainingRequests: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable()
 }),
 cost: z.strictObject({
  status: z.enum(['unknown','nonzero','verified-zero']),
  amountUsd: z.number().min(0).nullable(),
  checkedAt: instant.nullable(), expiresAt: instant.nullable(),
  evidenceRef: identifier.nullable(), accountScope: identifier.nullable(),
  // Evidence must cover this request size and exclude any automatic paid fallback.
  maxInputTokens: tokens.nullable(), maxOutputTokens: tokens.nullable(),
  billingHardLimitUsd: z.number().min(0).nullable(), paidFallbackEnabled: z.boolean()
 })
}).superRefine((m,ctx)=>{
 if(new Set(m.capabilities).size!==m.capabilities.length || m.maxOutputTokens>m.contextWindowTokens)
  ctx.addIssue({code:'custom',message:'Invalid model capacities or capabilities.'});
});
export const providerDescriptor = z.strictObject({
 id: identifier, enabled: z.boolean(), configured: z.boolean(), accountScope: identifier.nullable(),
 models: z.array(modelDescriptor).max(100)
});
export const providerRegistry = z.array(providerDescriptor).max(20).superRefine((providers,ctx)=>{
 if(new Set(providers.map(p=>p.id)).size!==providers.length || providers.some(p=>new Set(p.models.map(m=>m.id)).size!==p.models.length))
  ctx.addIssue({code:'custom',message:'Duplicate provider or model identity.'});
});
export type ModelDescriptor = z.infer<typeof modelDescriptor>;
export type ProviderDescriptor = z.infer<typeof providerDescriptor>;
export type ProviderRegistry = z.infer<typeof providerRegistry>;
// No active model identifiers, SDKs, credentials, or commercial assumptions.
export function defaultProviderRegistry(): ProviderRegistry {
 return plannedProviderIds.map(id=>({id,enabled:false,configured:false,accountScope:null,models:[]}));
}
export {createResendEmailAdapter,verifyResendWebhook,parseResendDeliveryEvent} from './resend-email';
export type {ResendEnvironment,ResendAttachment,ResendEmailRequest,ResendInspection,ResendSendResult} from './resend-email';
