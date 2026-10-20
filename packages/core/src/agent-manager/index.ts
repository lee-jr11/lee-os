import { z } from 'zod';
import { roleId } from '../api/contracts';
export { getAgentCatalog,roleRegistration,roleDefinition } from '@leeos/agents';
export const assignAgentRequest = z.strictObject({
 roleId,expectedRunVersion:z.number().int().min(0).max(2147483646),
 reviewedPlanDigest:z.string().regex(/^[0-9a-f]{64}$/),
 mode:z.literal('assignment-only'),permissions:z.array(z.never()).length(0)
});
export const dismissAgentRequest = z.strictObject({
 action:z.literal('dismiss'),expectedVersion:z.number().int().min(0).max(2147483646)
});
