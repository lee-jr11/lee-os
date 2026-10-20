import { z } from 'zod';
import type {StateDatabase,SqlSession} from '@leeos/database';
export type ProviderExecutionScope={runId:string;agentId?:string;reserve:(tx:SqlSession,callId:string)=>Promise<void>;eligible:(tx:SqlSession,fingerprint:string,inputTokens?:number)=>Promise<void>;resumePreflight?:(tx:SqlSession,callId:string)=>Promise<void>};
export interface EnvelopeProviderManager {
 readonly providerId:string;
 inspect(signal?:AbortSignal):Promise<{connection:string;modelFingerprint?:string}>;
 generate(db:StateDatabase,value:unknown,signal?:AbortSignal,scope?:ProviderExecutionScope):Promise<unknown>;
}
export const localGenerateRequest=z.strictObject({
 prompt:z.string().min(1).max(8192).refine(s=>Buffer.byteLength(s,'utf8')<=8192),
 maxOutputTokens:z.number().int().min(1).max(128),
 idempotencyKey:z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/)
});
export const recoverLocalRequest=z.strictObject({
 callId:z.string().regex(/^call_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
 expectedVersion:z.number().int().min(0).max(2147483646),acknowledgeServerRestart:z.literal(true)
});
