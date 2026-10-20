import { z } from 'zod';
import { validationError } from './errors';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const projectId = z.string().regex(new RegExp(`^proj_${uuid}$`));
export const automationId = z.string().regex(new RegExp(`^auto_${uuid}$`));
export const runId = z.string().regex(new RegExp(`^run_${uuid}$`));
export const roleId = z.string().regex(new RegExp(`^role_${uuid}$`));
export const agentId = z.string().regex(new RegExp(`^agent_${uuid}$`));
export const jobId = z.string().regex(new RegExp(`^job_${uuid}$`));
const name = z.string().trim().min(1).max(200);
const version = z.number().int().min(0).max(2147483646);
const definition = z.record(z.string(),z.json());
export const projectCreate = z.strictObject({ name, description: z.string().max(4000).default('') });
export const projectRename = z.strictObject({ name });
export const automationCreate = z.strictObject({ name, definition: definition.default({}) });
export const automationRevise = z.strictObject({ expectedVersion: version.min(1), definition });
export const runCreate = z.strictObject({ automationId: automationId.optional(), idempotencyKey: z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/) });
export const runCommand = z.discriminatedUnion('action',[
 z.strictObject({ action: z.literal('cancel'), expectedVersion: version }),
 z.strictObject({ action: z.literal('interrupt'), expectedVersion: version, reason: z.string().trim().min(1).max(1000) }),
 z.strictObject({ action: z.literal('requeue'), expectedVersion: version, acknowledgeExternalEffects: z.literal(true) })
]);
export const pageQuery = z.strictObject({ after: z.string().optional(), limit: z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.number().max(100)).optional() });
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
 const result = schema.safeParse(value); if (!result.success) return validationError(); return result.data;
}
export type CreateProject = z.infer<typeof projectCreate>;
export type CreateRun = z.infer<typeof runCreate>;
export type RunCommand = z.infer<typeof runCommand>;

export const emptyRequest=z.strictObject({});
