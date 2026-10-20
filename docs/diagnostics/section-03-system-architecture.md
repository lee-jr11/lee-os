# Section 3 — Overall System Architecture

Audit date: 2026-10-18. Codebase: version 0.18.1, Structure 18. Inspection, dependency tracing and validation preceded this report. No runtime source, permissions, dependencies, migrations or environment settings changed.

## Overall Architecture Verdict

🟡 **PARTIALLY ALIGNED**. The current modular local foundation can support incremental development toward the target. No blocking architectural contradiction was demonstrated in inspected current paths. This is not a guarantee that every future integration can be added without interface changes: general orchestration, executor dispatch and requirements contracts still need design.

## Current Milestone Verdict

**Healthy within the verified reviewed local V1 scope.** Bounded intake, reviewed immutable plans, reusable definitions, preparation, scoped assignments, explicit local text calls, persisted results, owner-review steps, queue-only triggers and recovery contracts pass. Neither module names nor placeholder SQL tables establish full target-component completion. Normal preview access remains unconfigured/default-disabled; integration tests used isolated fixtures.

## Architecture Matrix

Statuses refer to the target component. Evidence keys below identify executed tests, rather than treating source presence as verification. Boundary judgments come from source tracing and the dependency scan.

| Component | Status | Current Implementation / Evidence | Boundary Quality | Expected Now? | Future Gap |
|---|---|---|---|---|---|
| Lee Hub | 🟡 PARTIAL | React control surface and OwnerClient; H/A | API-based; client helpers compose requests, not durable authority | Local workflow yes | Phone/remote access, memory/files UI and broader controls |
| Core API | 🟢 IMPLEMENTED + VERIFIED | Versioned authenticated local API; thin Next route; I/H/A | Backend validates before storage/side effects; testable without browser | Local owner interface yes | Remote/multi-client authentication and independently hosted service are future scope |
| Master Orchestrator | 🟡 PARTIAL | Intake/planning/coordinator/worker collaboration; P/I/A | Delegation seams exist; no central goal-to-next-action coordinator | Narrow coordination yes | Actual Master Orchestrator and project-manager distinction |
| Intent Gate | 🟡 PARTIAL | Explicit command schemas and rules-v1 intake; I/C/S | Deterministic commands bypass generation | Supported subset yes | Unified NEW/BUILD/RUN/CHANGE/etc. classification and target resolution |
| Planner | 🟡 PARTIAL | Supplied goal/step DAG validation and immutable plans; P/I | Pure buildPlan separate from store; calls routers, never launches | Reviewed supplied-step planning yes | Goal-to-requirements specification before machinery selection |
| Memory | ⚪ NOT STARTED | SQL placeholder only; no retrieval/distillation path found | Separate memories/events tables; no functional integration to verify | No | Useful reusable knowledge and retrieval |
| Cost Guard | 🟡 PARTIAL | assertZeroCost, model eligibility, local preflight and SQL restrictions; M/L/S | System-enforced for supported paths; policy spread across layers | Current $0 enforcement yes | Unified implementation-wide evaluation/reservation contract for future executors |
| Task Router | 🟡 PARTIAL | Pure kind-to-destination metadata mapping; P | Distinct from model selection; unknown routes non-executable | Capability mapping yes | Dynamic selection among machinery/combinations |
| Model Router | 🟡 PARTIAL | Deterministic capability/quota/cost/capacity snapshot ranking; M/L | Vendor transport isolated in adapter; no calls during ranking | Current eligibility yes | Complexity/privacy/performance routing and more actual providers |
| Execution Manager | 🟡 PARTIAL | Metadata preparation plus separate controlled job worker; E/W/A | Authorization before model dispatch; model worker intentionally local-specific | Local preparation/execution yes | Common launch contract, cloud/GitHub/Lee360/hybrid execution |
| Event System | 🟡 PARTIAL | Append-only transactional events and receipt-based run-outcome subscriptions; S/C | Durable history distinct from delivery; no event bus | Current kinds/polling yes | Versioned payload catalog and general consumers/delivery |
| Scheduler | 🟡 PARTIAL | Independent UTC once/interval records and explicit polling; C/A | Queues run snapshots; no automation implementation/model calls | Queue-only triggers yes | Cron/DST, independent service hosting and additional triggers |
| Recovery Manager | 🟡 PARTIAL | Checkpoints, version fencing, held provider slots, result reconciliation; S/L/W/H | Logic belongs to current state/provider/worker services; not a centralized manager | Current inspected recovery yes | Distributed heartbeat supervision, retry/resource policy and notifications |
| Notification Manager | ⚪ NOT STARTED | Notifications table only; no delivery/preferences service found | UI notices are presentation, not notification delivery | No | Event-driven channels, retries and preferences |
| Job Queue | 🟡 PARTIAL | Persisted pending/running/terminal jobs and attempt/version fences; S/E/W | Workers transact durable state; no agent-owned queue | Prepared jobs yes | Distributed claiming/leasing and richer wait/block/pause states |
| Automation Registry | 🟡 PARTIAL | Versioned generic definitions, snapshots and reusable sequence UI; S/H/A | Automation identity distinct from runs/plans/jobs | Current reusable definitions yes | Capability/input/output/deployment/location metadata and full lifecycle |
| Tool Registry | 🟡 PARTIAL | Static disabled executor catalog; verified model snapshots; P/M/L | Capability metadata separate from live provider checks | Current catalogs yes | SQL registry service, general health/location/discovery and live tool registration |
| Project Blackboard | 🟡 PARTIAL | Project records plus linked goals/plans/jobs/assignments/events; S/I/E | Durable state outside agents | Current project/work records yes | Shared phase/requirements/issues/acceptance model; records alone are not a full blackboard |
| Agent Manager | 🟡 PARTIAL | Immutable role definitions and scoped, revocable assignment receipts; G/W | Agent/role IDs distinct from provider/model IDs; assignment grants no calls | Scoped metadata yes | Dynamic temporary workers, project manager, researcher/developer/tester execution |
| Lifecycle Manager | 🟡 PARTIAL | Versioned cancel/interrupt/requeue, trigger enable/disable, agent dismissal; S/I/C/G | Service validation and transactional history | Supported actions yes | Unified pause/resume/restart/archive/restore/delete semantics |
| Storage Manager | ⚪ NOT STARTED | Artifact-reference schema only; model text currently stored in SQL | Artifact bytes explicitly intended outside DB; no managed store | No general file lifecycle yet | File/object adapter, retention, cleanup and generated artifact handling |
| Approval Manager | 🟡 PARTIAL | Intake receipts, reviewed plan digest, job permission/hash and owner-review records; I/E/W | Owner-authenticated, scope/version-bound; generic approvals table unused | Current grants/review yes | Central typed approvals for deployment, destructive actions, messaging and spend |
| Secrets/Permissions | 🟡 PARTIAL | Ignored private env, placeholder examples, memory-only owner token, auth/origin and scoped permissions tests; I/H/L/W | Credentials handled at server composition boundary, not assignments | Current single-owner scope yes | Credential broker/vault, external worker isolation and broader authorization |
| Model Performance | ⚪ NOT STARTED | Usage/results measurable; model_performance schema only | Performance not conflated with project memory | No | Outcome evaluation, aggregation and routing feedback |

Evidence keys (all part of this audit's executed default/native suites):

- S: `tests/state.test.ts`, `tests/helpers/state-contract.ts`: constraints, rollback, explicit transitions, checkpoints, clean-close persistence.
- I: `tests/api.test.ts`, `tests/helpers/api-contract.ts`, `tests/blueprint-core.test.ts`, `tests/helpers/intake-contract.ts`: owner/API validation, bounded interpretation, immutable revisions, approval races and preserved goals.
- P: `tests/planning.test.ts`, `tests/helpers/planning-contract.ts`: DAG validation, blocked routes, immutable plans, no dispatch.
- M: `tests/model-router.test.ts`: candidate eligibility, stale/unknown/paid rejection, deterministic ordering and no registry mutation.
- E: `tests/execution.test.ts`, `tests/helpers/execution-contract.ts`: reviewed preparation, immutable receipts and job batches.
- G: `tests/agents.test.ts`, `tests/helpers/agent-contract.ts`: role/assignment boundaries, revocation, races and restore.
- L: `tests/local-provider.test.ts`, `tests/helpers/local-provider-contract.ts`: fixed local transport, reservations, recovery, bounded failure and no duplicate generation.
- W: `tests/worker.test.ts`, `tests/helpers/worker-contract.ts`: dependency/permission checks, preflight cancellation, revoked late completions, saved-result reconciliation.
- C: `tests/coordination.test.ts`, `tests/helpers/coordination-contract.ts`: queue-only triggers, independent registration, coalescing, overlap and late-commit receipts.
- H: `tests/hub.test.ts`, `tests/helpers/hub-contract.ts`, automation/coordination Hub tests: OwnerClient contracts, read-only reconnect/recovery, supported workflow helpers. These are not a fresh browser session.
- A: `tests/acceptance.test.ts`, `tests/helpers/acceptance-contract.ts`: reviewed reusable text workflow and queue-only scheduled follow-up. Native PostgreSQL runs the shared contracts too.

## Current Request Flow

Actual supported example: “Draft a welcome message then review the message.” This is traced source plus the executed shared intake/Hub/acceptance contracts; no fresh browser action or real inference is claimed.

```text
Lee enters request in Workbench
  -> OwnerClient -> /api/v1/projects/:id/requests
  -> thin Next route -> core-api server composition -> handleCoreRequest
  -> owner Host/Origin/bearer checks + strict input validation
  -> createRequestIntake -> deterministic rules-v1 interpretation
  -> PostgreSQL original request + immutable revision + events

Lee reviews exact proposal/version/digest
  -> intake approval transaction
  -> buildPlan -> task-kind routing (model eligibility only if requirements supplied)
  -> queued run + immutable plan + intake approval receipt + events
  -> NO execution authority yet

Separate plan review -> preparation manager -> jobs + preparation receipt
Separate assignment -> Agent Manager -> scoped assignment records
Separate exact-prompt/model permission -> job worker
  -> validate plan/version/dependencies/assignment; durable provider reservation
  -> local provider manager -> probe/tokenize/reprobe -> zero-cost model eligibility
  -> recheck authority -> fixed-loopback llama.cpp adapter
  -> saved provider result/usage -> worker reconciliation -> job/run events
Separate owner-review step -> persisted owner approval -> run completion
```

The current flow does not pass through a formal Master Orchestrator, useful memory, a general Intent Gate, deployment or a notification service. The Hub knows the current local-text grant/fingerprint protocol; the target executor-neutral user contract is incomplete. The authenticated API also intentionally exposes a separate manual bounded local-call path. That path does not authorize or complete a job; it is not a hidden bypass of job execution review.

Core implementation paths: `packages/core/src/api/http.ts`, `request-intake/{index,store}.ts`, `orchestrator/{index,store}.ts`, `task-router/index.ts`, `model-router/index.ts`, `execution-manager/{index,store}.ts`, `agent-manager/store.ts`, `job-worker/index.ts`, `provider-manager/service.ts`. The transport is `packages/providers/src/local.ts`.

## Current Source-of-Truth Map

| Information | Actual owner/location | Important limit |
|---|---|---|
| System policy/configuration | Source manifest, server environment and constrained `system_settings` SQL rows | DB execution_enabled is not the live opt-in switch; actual optional execution uses server env callbacks. Documented overlapping configuration ownership, not a unified configuration service |
| Project state | PostgreSQL `projects`, linked records | Project metadata is not full phase/requirements blackboard |
| Automation definitions | PostgreSQL `automations.definition` + definition_version | Reusable sequence is a narrower supported format; generic definitions are not executable programs |
| Requests/goals | `intake_requests`, immutable `intake_revisions` | No useful memory retrieval |
| Runs/plans | `runs` snapshots; `run_plans` | Historical definition/plan distinct from current definition |
| Jobs/preparation | `jobs`, `prepared_jobs`, `run_preparations` | No distributed queue broker/claim service |
| Assignments | `agent_roles`, `agents`, `agent_assignments` | Durable identity/history, not permanent running agents |
| Events | Append-only `events`; trigger delivery in subscription/receipt records | Durable domain history, not console logs or general learned memory |
| Approvals | `intake_approvals`, preparation receipts, `job_executions` request hashes/permissions, owner-review checkpoints/events | Generic `approvals` table is not the current centralized implementation |
| Provider calls/results | `provider_calls`, `provider_slots`, `model_usage`, linked `job_executions` | Durable holds/reconciliation; process-local active Set is only a local recovery guard, not sole authority |
| Schedules/subscriptions | `schedules`, `schedule_configs`, `event_subscriptions`, `trigger_receipts` | Explicit queue-only polling |
| Artifacts | `artifacts` reference schema; current generated model text in provider_calls.output_text | No implemented managed file/object storage service |
| Secrets | Ignored private server environment; owner key only in browser connection memory | No general credential broker; owner-provided prompt content is not automatically scrubbed |
| Useful memory / performance / notifications | Placeholder tables only | No verified runtime service for retrieval, learned ranking or delivery |
| Code/engineering assets | Local monorepo; optional future GitHub usage | GitHub is not consulted as the runtime database; no remote repository/CI execution asserted |

## Strong Boundaries

- `apps/hub/app/api/v1/[[...path]]/route.ts` delegates to `apps/hub/lib/core-api.ts`; auth, validation, policy and writes occur in backend modules. React controls do not directly open SQL connections, launch processes or contact model servers.
- Type-only Proposal/Receipt imports share contracts without loading backend implementations into client entry points in the inspected source graph.
- `buildPlan` is pure planning; `orchestrator/store.ts` persists it separately. Neither contains provider protocol or process launch logic.
- Model adapters own transport/protocol; they do not mutate project SQL. Provider manager owns reservations/usage; worker owns job authorization/reconciliation.
- Task selection and model eligibility are separate modules. Known state commands bypass both where unnecessary.
- Preparation, assignment, model authorization and owner review remain distinct. Agents cannot independently approve themselves through a worker credential: the current API is owner-authenticated and assignments contain no such credential.
- Schedule logic determines due occurrences and queues snapshots; it contains no automation's content-generation/business implementation.

## Weak / Partial Boundaries

- The `orchestrator` name currently covers a graph planner, while `api/http.ts` dispatches services and Hub helpers compose reviewed steps. Neither is the full Master Orchestrator. Requirements and explicit machinery kinds share the current plan schema.
- UI sequence builders supply default text/review steps and compose assignment commands. Backend checks remain authoritative, but reusable workflow construction/DTOs could move to neutral shared contracts before adding more clients.
- Services import `api/contracts.ts` and `api/errors.ts`. These have no HTTP/provider side effects, so no runtime cycle was found; the names/location put transport-labelled validation/errors below application services. Extract neutral domain contracts/errors before broad multi-transport expansion.
- Cost protection is enforced through generic assertion, model eligibility, local-only transport and SQL constraints, rather than one complete Cost Guard service. Any new launch adapter needs its own execution-time policy check; an unused helper is not system-wide protection.
- Events are string kinds/JSON payloads written by multiple services. Supported subscriptions validate a fixed set of run-outcome kinds. There is no global versioned event schema/outbox/notification delivery contract.
- Recovery is intentionally specialized across state, provider and worker services. A future manager can coordinate these; consolidating them prematurely would obscure distinct side-effect recovery semantics.

## Missing Future Components

Useful Memory Manager, Notification Manager, managed Storage Manager and learned Model Performance service have not started beyond schemas. Full Master Orchestrator, general Intent Gate/requirements Planner, dynamic tool registry, cloud/Lee360 workers, distributed queue claims, project blackboard and centralized protected-action approvals are partial or future. These are not counted as regressions.

## Dangerous Coupling

**No blocking architectural coupling detected** in inspected current supported paths. This does not imply a completed plugin architecture. Local-text identity/permission details are intentionally present in the provider manager, controlled worker, API routes and Hub form. New execution backends should extend dispatch/contracts rather than make these local-only paths accept arbitrary processes or endpoints.

No inspected path showed UI-to-process launch, UI-to-model transport, planner-to-command execution, provider-to-project-state mutation, scheduler-to-content implementation, GitHub-as-runtime-database, logs-as-useful-memory, or Lee360-required-for-core behavior. Several schema names are future placeholders; no service completion was inferred from them.

## Current Regressions

**No current-stage regressions detected.** Failed validation and missing future architecture are reported separately. No new runtime fix is justified by the current evidence.

## Failure Isolation Findings

Six additional diagnostic assertions passed using the authenticated in-process Core API, embedded PostgreSQL and an unavailable provider fixture:

1. Creating project/run records makes no provider request.
2. Provider unavailability returns a bounded unavailable status.
3. Failed provider preflight persists a failed call.
4. An unrelated queued run remains unchanged after that failure.
5. Deterministic cancellation still succeeds without provider use.
6. New unrelated work can still be queued without provider use.

Executed default/native contracts additionally verify transactional rollback when history fails, durable reservations across manager instances, no duplicate generation on replay, cancellation/dismissal fencing, retained uncertain-call capacity and saved-result reconciliation after finalization failure. Clean-close tests restore state/assignment/results; Hub recovery helpers use reads only and do not blindly retry mutations.

Closing a browser connection clears its key and aborts pending fetches; it does not delete durable records. Cancellation signals may stop preflight/in-flight calls, leaving a recorded failure/uncertain result. This is not an assurance of an independent long-running backend worker after browser/server shutdown. Physical browser-close/process-kill/cloud failover/notification-failure isolation was not newly tested; notifications and cloud executors do not exist yet. PostgreSQL remains a shared critical dependency; provider uncertainty intentionally occupies the single local model slot while unrelated state controls remain available.

## Replaceability Findings

| Component | Finding |
|---|---|
| AI provider/model | Generic descriptors and pure eligibility ranking can admit alternatives. Actual transport is local llama.cpp only; replacing it needs an adapter plus dispatch integration, not merely changing an ID. Cloud names are inactive metadata; Ollama is not implemented |
| PostgreSQL adapter | StateDatabase/SqlSession permit pool/harness replacement; embedded/native contracts exercise the same services. SQL uses PostgreSQL JSONB, locks, triggers and constraints, so another SQL engine is not a drop-in replacement |
| Execution backend | Preparation adapter is metadata-only; no general launch interface exists. Add a dispatch/authorization contract while retaining immutable plans and current local fences |
| Hub client | Core API works without browser and CLI also calls it. OwnerClient currently requires loopback and local-owner auth; phone/remote clients require deliberate authentication/hosting changes |
| Email/n8n/GitHub/Lee360 | No live implementation exists to replace or certify. Catalog identities are extension placeholders |

## Repairs Made

**No runtime repairs were necessary.** Added this scoped audit report only. Temporary diagnostic scripts/results live in workspace `work/`, outside the source tree; they are audit evidence, not new LeeOS runtime services. No major future component, dependency, schema, permission or cloud service was introduced.

## Validation Evidence

Executed during this Section 3 audit:

- `npm test`: **138 passed, 0 failed, 0 skipped**.
- `npm run test:postgres`: **73 passed, 0 failed, 0 skipped** on the isolated generated native PostgreSQL schema; disposable fixture stopped after validation.
- `npm run lint`: passed, exit 0.
- `npm run typecheck`: passed, exit 0 (root + Hub route generation/TypeScript).
- TypeScript-resolved static import/export scan: **56 source files, 121 local edges, zero runtime import cycles, zero package-to-presentation imports, zero client paths reaching database/provider/executor implementations or server composition**. Declaration-level type-only edges excluded from runtime graph; mixed imports counted conservatively. Dynamic loading and third-party internals were not analyzed. Source graph findings do not alone certify emitted bundles or runtime security.
- Additional authenticated API failure-isolation diagnostic: **6 passed, 0 failed**, fixture transport only, no model/network use. Evidence scripts: workspace `work/audit_architecture.cjs`, `work/architecture-isolation.ts`; results: `work/section03-dependencies.json`, `work/section03-isolation.json`.
- Current checkout scan `git ls-files -- .env **/.env *.pem *.key` returned no matching tracked files; `.gitignore` excludes private env/key files, `.env.example` contains configuration placeholders. Auth/error/transport tests passed. This is not a complete historical secret scan or a guarantee users cannot paste secrets into prompts/definition data.

No fresh production build, browser action, real model inference, physical crash/restart, hosted CI, phone/PWA installation, external notification, paid service or remote deployment was executed. This documentation-only audit did not change runtime source. Passing repository checks is not evidence of missing target architecture or generated-solution correctness.

## Architecture Debt

- **Safe future work:** memory, notifications, file storage, learned performance, general orchestration/planning, external adapters and independently hosted workers.
- **Technical debt before expansion:** neutral domain contracts/errors; shared DTOs/workflow builders; execution capability/dispatch interface; consistent system-level cost evaluation; versioned event payload contracts; explicit live configuration ownership; splitting the growing API dispatcher when new routes warrant it.
- **Blocking architecture debt:** none demonstrated for the current milestone. Future external execution requires real credential/authorization/cost/resource contracts before activation; placeholder adapters must not bypass them.

## Blueprint Gap

The current architecture is a modular, owner-controlled local text/workflow foundation with persistent state. It is not yet the diagram's goal-driven Master Orchestrator with useful memory, general requirements planning, autonomous technology choices, cloud/local/hybrid dispatch and event-driven recovery/notifications. The existing seams allow staged work, but the missing contracts still need implementation and tests.

## Recommended Next Step

Continue the next supplied blueprint section. Before a later general-execution build, define neutral requirements/capability and execution-authority contracts, then add one verified adapter behind them. Preserve deterministic control bypass, $0 policy, immutable approvals, persistent state and distinct task/model routing. Do not build those future structures during this audit.
