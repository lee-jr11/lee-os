import {z} from 'zod';
import {envelopeId} from '../execution-envelope';
export const workerId=z.string().regex(/^worker_[a-zA-Z0-9_-]{1,80}$/);
export const claimSchema=z.strictObject({envelopeId,workerId,fence:z.string().regex(/^[1-9][0-9]{0,17}$/)});
export type Claim=z.infer<typeof claimSchema>;
export const humanReview=z.strictObject({operationKey:z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),reviewedEnvelopeDigest:z.string().regex(/^[a-f0-9]{64}$/),reviewedInputDigest:z.string().regex(/^[a-f0-9]{64}$/),acknowledgeReview:z.literal(true),approve:z.boolean(),note:z.string().trim().min(1).max(2000)});
