import { randomUUID } from 'node:crypto';
export const idPrefixes = { envelope: 'env', requirements: 'reqs', evidence: 'evid', request: 'req', subscription: 'sub', call: 'call', role: 'role', project: 'proj', automation: 'auto', run: 'run', job: 'job', schedule: 'sched', agent: 'agent', memory: 'mem', artifact: 'file', event: 'evt', notification: 'notif', usage: 'usage', performance: 'perf', tool: 'tool', approval: 'appr', effect:'eff', effectReceipt:'effrcpt' } as const;
export type Entity = keyof typeof idPrefixes;
export type EntityId<K extends Entity> = `${typeof idPrefixes[K]}_${string}`;
export function createId<K extends Entity>(kind: K): EntityId<K> { return `${idPrefixes[kind]}_${randomUUID()}`; }
