# Section 22 diagnostic — Tool Registry / MCP / External Integrations

Audit date: 2026-10-18. Current repository: LeeOS 0.18.1 / Structure 18. Priority-focused audit of actionable foundation defects, not completeness of a future integration ecosystem.

## Blueprint Section

Section 22 — Tool Registry / MCP / External Integrations.

## Overall Verdict

🟡 PARTIALLY ALIGNED. Capability routing, inert executor metadata and a controlled local text path have usable safety boundaries. The database Tool Registry is a placeholder; MCP and external workflow/API execution are absent. One demonstrated preflight enablement defect was repaired without adding integrations.

## Current Foundation Verdict

🟢 SAFE TO CONTINUE after repair, within the existing local-owner, controlled-text/review foundation. This does not certify deployment/email/workflow/file execution or a general integration revocation platform.

## Current Integration Reality

| Integration | Current Status | Actually Executable? | Cost Checked? | Main Gap |
|---|---|---:|---:|---|
| Python | METADATA ONLY | No | No executable path | Preparation candidate only; no interpreter launch, job sandbox or resource grant |
| Node / TypeScript | WORKING as application infrastructure; NOT STARTED as arbitrary task executor | Hub/core/CLI runtime yes; generated Node tasks no | No generic task-spend path | Not a registered general-purpose job tool; host operating costs are not measured |
| GitHub Actions | METADATA ONLY as LeeOS executor; manual repository CI definition exists | No LeeOS dispatch; CI not run in this audit | No dispatch cost gate yet | workflow_dispatch CI file is not a working automation integration |
| n8n | METADATA ONLY | No | No executable path | No configured server/client, workflow invocation or external-effect receipt |
| Lee360 | METADATA ONLY | No | No executable path | Optional device candidate; no worker transport/resource-wait scheduler |
| MCP | NOT STARTED | No | No executable path | No MCP client/server/tool discovery, invocation, trust or resource adapter |
| Generic APIs | NOT STARTED as arbitrary external API tool | No | No executable path | Existing owner HTTP API and fixed local provider HTTP are not generic external requests |
| llama.cpp local text provider | WORKING bounded adapter/manager; actual availability depends on explicit flags and backend | Yes, owner opt-in only | Fresh zero-cost routing using dedicated local-loopback evidence | Dedicated local-only backend is an operator trust boundary; no arbitrary endpoint or paid fallback |
| Owner review | WORKING | Yes, explicit scoped approval | No external paid operation | Manual review; not autonomous acceptance evaluation |
| Gemini / Codex / Claude provider entries | METADATA ONLY | No | Default unconfigured models block selection | No activated cloud SDK, model or credentials |

WORKING identifies an implemented path verified with fixtures in this audit; it does not assert a live service is currently reachable. No availability probe of a real model was performed.

## Critical Capability Matrix

| Capability | Status | Evidence | Action |
|---|---|---|---|
| Tool Registry truthfulness | 🟡 PARTIAL | tool_registry schema; executor/provider catalogs; native metadata check | Keep table labelled metadata. No operational registry lifecycle or revoked-tool status yet |
| Capability-first routing | 🟡 PARTIAL | task-router; inert executor prepare; model-router tests | Bounded kind→candidate mapping is safe; dynamic capability matching/placement remains future |
| Tool/execution-authority separation | 🟢 IMPLEMENTED + VERIFIED | plan/preparation/agent/job contracts; unknown invocation endpoint tests | Preserve independent reviewed plan, scoped job grant and runtime eligibility |
| ZERO_ONLY enforcement | 🟢 IMPLEMENTED + VERIFIED | model-router gates; mocked unknown/nonzero actual manager preflight tests | Preserve no-paid-fallback and local-only trust boundary; future integrations need their own cost checks |
| Fresh eligibility checks | 🟢 IMPLEMENTED + VERIFIED | provider double probe, fingerprint/capacity checks; new revocation test; agent/cancel tests | Repaired opt-in rechecks after asynchronous preflight; no process-kill claim |
| Secret isolation | 🟢 IMPLEMENTED + VERIFIED | environment-only server configuration; fixed local HTTP; API error/config tests | Preserve current secret flow; no universal sanitization of owner-supplied text claimed |
| Configuration authority | 🟢 IMPLEMENTED + VERIFIED | apps/hub/lib/core-api.ts; environment examples; config tests; tool-table inertness check | Runtime environment controls activation; DB history/metadata and source catalogs are separate |
| Permission/resource scoping | 🟢 IMPLEMENTED + VERIFIED | strict local:text / owner:review schemas; agent/run/job/fingerprint/plan validation tests | No automatic scope expansion; repository/cloud/file scopes are absent |
| Cross-project isolation | 🟢 IMPLEMENTED + VERIFIED | existing worker/agent/API composite-scope tests on native PostgreSQL | Applies to project/run/job-bound work. Manual provider history is owner-wide, not a project tenant API |
| Execution-location separation | 🟡 PARTIAL | Node Hub/core runtime; fixed local backend; inactive device/workflow candidates | LOCAL path only; no CLOUD/HYBRID placement protocol or worker-location schema |
| External-effect safety | 🟡 PARTIAL | no publish/send/deploy/delete paths; provider reservation/uncertainty tests | Do not equate DB deduplication with external exactly-once; general effect receipts remain future |
| Replaceability | 🟡 PARTIAL | executor interface/candidates; injected local transport/provider; independent core modules | Safe current seams; local text implementation is deliberately bounded, not a generic plugin runtime |
| Tool-output non-authority | 🟢 IMPLEMENTED + VERIFIED | instruction-like output regression; strict request schemas; no output dispatcher | Preserve results as data, including future untrusted MCP descriptions/results |

### What the current registry actually means

`tool_registry` stores id/name/adapter_id/enabled/capabilities/timestamps, defaults enabled=false, and has ID checks. No runtime code reads that table to select or launch a tool. It does not implement AVAILABLE/REVOKED/UNSUPPORTED operational states, credential resolution or trusted discovery. A disposable SQL row marked enabled with shell/deploy/paid capabilities did not activate any provider/executor; unknown tool/MCP invocation paths stayed 404 before DB access.

Operational truth currently lives in separate explicit surfaces: planned executor catalog entries are disabled/unconfigured; all task routes remain executable=false; cloud provider defaults are unconfigured with no models; local inspect reports disabled/unavailable/busy/ready when explicitly enabled. A ready local connection still requires separate job authority. Local preparation adapter enabled=true means its inert metadata-copying operation works, not that its candidate Python/workflow/device executors can launch. Saved planning snapshots are historical suggestions, not fresh availability or dispatch authorization.

### Routing and authority trace

User input is bounded rules/owner-edited planning, not an autonomous tool-selection agent. Task kinds map to candidates: review→owner, model→model-router, workflow→GitHub Actions or n8n, python→Python, device→Lee360; unknown kinds remain unassigned and nonexecutable. The word automation does not universally route to n8n. There is no general Node/MCP executor. These hard-coded candidates are a harmless bounded scaffold while they grant no launch authority; they are not a completed dynamic capability marketplace.

A saved plan cannot dispatch. A reviewed plan digest prepares immutable job blueprints with empty permissions. Role/agent assignment is separately scoped metadata. Current text execution then needs the owner API, explicit server opt-ins, exact run/job, reviewed plan digest, expected run/agent versions, assigned agent, local:text permission, fingerprint and output bounds. Provider reservation and a fresh eligibility transaction precede the fixed local completion request. Owner review uses its own strict scope. SQL registry metadata, agent/model output and router selection cannot substitute for those grants.

### Freshness, cost and revocation boundary

The local manager probes model/context/capacity, tokenizes, probes again, verifies unchanged fingerprint/busy state, reruns cost/capability routing on that fresh descriptor, and revalidates current job/agent authority. Cancellation/dismissal during preflight prevents generation; late results after revoked run/agent authority are not accepted as successful job output. New checks re-read enablement before dispatch and during controlled job reservation/eligibility. A provider/job flag disabled during tokenization now fails preflight, makes zero completion requests and releases the reservation with historical failure evidence. Failure is not automatically retried.

Revocation here means current flags, run cancellation and agent dismissal, not a new persisted tool-revocation service. Environment file changes are not watched; flags change only when the running process observes changed configuration (or after restart). No database transaction can atomically combine every future flag/status change with an outside completion request. Already dispatched calls retain existing uncertain-result and reconciliation rules; disabling a flag does not guarantee termination of the backend process.

Cost selection rejects unknown/nonzero/stale evidence, account mismatch, insufficient quota/capacity, unexcluded paid fallback or disabled models. Native mocked adapter evidence with unknown/nonzero cost blocked actual manager dispatch, not just pure planning selection. The concrete executable adapter uses only literal 127.0.0.1:18081 with fixed health/props/slots/tokenize/completion paths, direct HTTP, no DNS/proxy/redirect/credentials and bounded replies. Its zero-cost evidence assumes the operator-enabled dedicated local-only llama.cpp backend; it cannot attest hidden backend internals or all host costs. No cloud/paid alternative is silently selected.

### Secrets and configuration authority

Server credentials are DATABASE_URL, local owner bearer token and associated origin in ignored root/Hub environment files. Root environment config is loaded by CLI tools; the Hub reads its server environment. Setup writes matching owner configuration while preserving database settings and refuses silent overwrite. Separate copies can diverge if manually edited; there is no automatic DB/env/file merge or settings dashboard. Current runtime callbacks read the server environment for local provider/local-only acknowledgement, job execution and coordinator flags. Provider catalogs/adapters are source-controlled server code; SQL tool enabled flags do not override them. ZERO_ONLY source/manifest guards and constrained DB policy records do not grant independent spending authority.

No active cloud integration keys exist in the current adapter implementation. Fixed local HTTP sends the explicitly supplied prompt/tokens only, without server owner/database credentials. The browser sends its owner key only as an authenticated same-origin header; APIs return safe errors, never raw driver/provider exceptions or bearer tokens. Local inspection returns a fingerprint/context, not raw backend model paths. Credential configuration files are ignored by Git; no credential contents were opened or printed for this audit. These are application secret-flow boundaries, not universal DLP: an owner can manually paste sensitive text into a prompt or generic JSON, and model output is returned as data without magical secret redaction. Memory/artifact integration is not implemented.

### Locations, scope and external effects

Node/TypeScript currently hosts LeeOS itself and its CLIs; it is not an arbitrary generated-code execution tool. The provider is fixed local-only; cloud/hybrid worker placement is unimplemented. Python/workflow/device are preparation destinations, not locations or standalone servers. Lee360 remains an optional future worker and is not needed for the Hub/core/database to operate. These candidates do not own orchestration, routing, cost guard or project authority.

Scoped worker tests reject another project's run/job/agent, stale or dismissed assignments and requested permission/model/output widening. Manual local-provider calls/history are explicitly global to the single local owner, separate from job-scoped generation; do not mistake them for a multi-user project-isolated tool API. There are no repository/resource operations, email/WhatsApp delivery, deployments, publishing, remote resource deletion or pushes to authorize today. The manual GitHub CI definition uses workflow_dispatch with contents:read; it was inspected, not dispatched. CI hosting costs and a future dispatch cost gate are not verified by merely having that YAML.

The local provider is still an outside computation effect relative to the DB. Durable reservation serializes calls and idempotency replays saved results without dispatch; uncertain calls hold the slot until explicit versioned recovery/reconciliation. A stale backup or backend behavior is outside DB exactly-once guarantees. General external-effect receipts for sending/publishing/deleting are not implemented and were not invented during this audit.

## Blocking Problems

**No blocking integration problems detected** after the current-stage repair. The missing MCP/n8n/cloud/general-tool ecosystem does not block continuing the bounded V1 foundation.

## Current-Stage Defects

One demonstrated defect: provider/job enablement was checked at entry but could become false during asynchronous preflight while execution continued. The new regression initially returned succeeded where failed was expected; the first provider-revocation case reproduced the bypass. This was not a missing future integration or metadata-only status gap. No other current-stage blocker was demonstrated in the prioritized scope.

## Repairs Made

- Provider Manager rechecks its enabled callback immediately before completion dispatch after asynchronous preflight/DB eligibility work.
- Job Worker rechecks job/provider enablement at reservation and during eligibility, including after asynchronous grant lookups.
- Added regression coverage for provider and worker opt-out during tokenization and for instruction-like model output remaining non-authoritative.
- Documented flag authority, preflight failure and post-dispatch limitations in docs/core-api.md.

No schema migration, tool activation service, MCP client, remote executor, new credential, billing exception or external integration was introduced. Model output remains a text result: the malicious-looking fixture could not change ZERO_ONLY, enable SQL tools, create roles/agents or complete the pending owner review.

## Validation

- Before repair: `node --import tsx --test tests/worker.test.ts` failed the new revocation regression, with actual succeeded versus expected failed. Parent suite failure reflects the same child failure.
- Focused: `node --import tsx --test tests/worker.test.ts tests/local-provider.test.ts tests/model-router.test.ts tests/execution.test.ts tests/foundation.test.ts` — **48 passed**.
- Full: `npm test` — **146 passed**, zero failed.
- Native PostgreSQL: `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts` — **81 passed**, zero failed, isolated generated schema cleaned up.
- Additional native integration diagnostic: `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/integration-boundary-audit.ts` — **3 passed groups**: inert enabled tool metadata, unsupported tool/MCP/executor paths, and actual manager refusal with mocked unknown/nonzero cost. Generated schema removed.
- `npm run lint` — passed. `npm run typecheck` — passed. `npm run build` — passed on escalated retry. Initial sandbox run compiled/typechecked but failed with EPERM creating a generated _global-error static-page directory; retry generated all pages and completed build traces.
- External services contacted: none. Only dedicated local PostgreSQL 17 was contacted; provider transports were in-process fixtures. No real llama.cpp, MCP, n8n, GitHub API or cloud provider connection/probe/dispatch occurred. No real inference.
- Paid services used: none. No destructive real-world actions, user-resource deletion, commits or pushes. Audit PostgreSQL server restored to its initial stopped state; ordinary Hub preview untouched.

Required failure scenarios are covered where supported: unsupported/unavailable candidates; provider/worker opt-out and agent dismissal; unknown/nonzero costs; invalid grants; cross-project/run/job misuse; permission/output/provider expansion; malicious-looking output; duplicate/uncertain provider-result replay. A general revoked MCP tool or duplicate email/deployment cannot be tested because those execution paths do not exist. Existing uncertainty tests prove reservation/reconciliation, not exactly-once arbitrary external effects.

## Future Gaps

Operational Tool Registry discovery/trust/status/revocation; MCP; real n8n and GitHub Actions dispatch; general API/Python/Node task adapters; cloud/hybrid placement; general external-effect receipts; email/WhatsApp delivery; optional Lee360 resource waiting; tool performance learning. These remain future work and were not deeply audited or implemented.

## Final Recommendation

### 🟢 GO

Current integration foundation is safe enough to continue V1.

## Evidence files

- [Provider dispatch guard](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/provider-manager/service.ts:76)
- [Job grant and eligibility](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/job-worker/index.ts:96)
- [Regression tests](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/tests/helpers/worker-contract.ts:88)
- [Task routing](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/task-router/index.ts)
- [Inert executor catalog](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/executors/src/index.ts)
- [Server configuration authority](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/apps/hub/lib/core-api.ts)
- [Integration diagnostic script](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/integration-boundary-audit.ts)
- [Saved diagnostic results](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/section22-integration-checks.json)
