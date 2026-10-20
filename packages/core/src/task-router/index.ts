// A routing decision describes a future capability, never invokes an adapter.
export function routeTask(kind: string) {
 const routes: Record<string, { target: string; reason: string }> = {
  review: { target: 'owner', reason: 'Human review is required; no automatic execution.' },
  model: { target: 'model-router', reason: 'Model routing is available; live provider execution is disabled.' },
  workflow: { target: 'github-actions-or-n8n', reason: 'External workflow execution is not configured.' },
  python: { target: 'python', reason: 'The Python executor is not configured.' },
  device: { target: 'lee360', reason: 'The Lee360 device executor is not configured.' }
 };
 return { ...(Object.hasOwn(routes,kind) ? routes[kind] : { target: 'unassigned', reason: 'Unsupported task capability.' }), executable: false as const };
}
