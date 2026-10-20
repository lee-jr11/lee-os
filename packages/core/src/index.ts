import manifest from '../../../leeos.manifest.json';
export type CostPolicy = 'ZERO_ONLY';
export interface OperationCost { amountUsd: number; verified: boolean }
// Unknown costs fail closed, even when a provider advertises a free tier.
export function assertZeroCost(cost: OperationCost): void {
  if (!cost.verified || !Number.isFinite(cost.amountUsd) || cost.amountUsd !== 0) {
    throw new Error('ZERO_ONLY requires a verified zero-cost operation.');
  }
}
export function getSystemStatus() {
  return { system: manifest.name, version: manifest.version, structure: manifest.structure, implementationMilestone: manifest.implementationMilestone,
    status: 'hub-workflow-ready' as const, costPolicy: manifest.costPolicy,
    executionEnabled: false, goalImplementation:'bounded-text-only' as const, requestIntake:'bounded-english-and-owner-edits' as const, coordination:'explicit-poll-queue-for-review' as const, defaultExecution:'disabled' as const, controlledJobExecution:'owner-opt-in' as const, executionScope:'jobs-and-agents' as const, manualLocalGeneration:'opt-in' as const, persistence: 'check-readiness' as const,
    integrations: manifest.plannedIntegrations.map(id => ({ id, status: 'planned' as const })) };
}
