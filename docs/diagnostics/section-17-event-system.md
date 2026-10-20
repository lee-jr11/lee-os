## Blueprint Section

Section 17 — Event System / Trigger Receipts. Audited 2026-10-18 against LeeOS 0.18.1 / Structure 18. Inspection and disposable embedded/native PostgreSQL validation preceded this report. No runtime code, migration, UI, dependency, user settings or paid integration changes.

## Overall Event-System Verdict

🟡 **PARTIALLY ALIGNED.** Durable append-only event facts, transactional producers and receipt-driven internal subscriptions are implemented. There is no complete versioned event bus, external ingestion, commit-ordered Activity stream, trust envelope or general delivery/retention platform. Events and receipts do not confer execution or cost authority.

## Current Milestone Verdict

**Healthy within current durable-history/internal-trigger scope.** Native tests verified independent subscribers, partial failure isolation, immutable/unique receipts, activation/stale-version checks and late-committing event discovery. No supported transactional event loss, duplicate subscription outcome, incorrect run/project FK, mutable receipt or authorization bypass was demonstrated. Activity sequence cursors remain inspection pagination, not reliable delivery cursors.

## Event Capability Matrix

F = 93 focused embedded tests; N = 74 native integration tests; D = seven supplemental native scenarios; S = inspected source. Green covers the named current subset, not a complete event platform.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Durable events | 🟢 IMPLEMENTED + VERIFIED | F/N committed history and restore | Yes | Not a general event bus |
| Event/command separation | 🟢 IMPLEMENTED + VERIFIED | F/N commands cause transactional facts | Yes | Preserve future ingestion boundary |
| Event/state separation | 🟢 IMPLEMENTED + VERIFIED | S/F state tables + history | Yes | Full event sourcing not intended |
| PostgreSQL state authority | 🟢 IMPLEMENTED + VERIFIED | F/N versioned state/services | Yes | Events explain, not fully rebuild |
| Stable event identity | 🟢 IMPLEMENTED + VERIFIED | F/N evt UUID PK/format | Yes | External delivery identity absent |
| Event ordering | 🟡 PARTIAL | D sequence versus late commit | Allocation order only | No global commit order |
| Sequence semantics | 🟢 IMPLEMENTED + VERIFIED | S/D identity/gaps/late visibility | Current semantics yes | Not a delivery watermark |
| Timestamp semantics | 🟡 PARTIAL | S now() transaction timestamp | DB time yes | No external/committed timestamp |
| Actor identity | ⚪ NOT STARTED | S no actor field | No | Named human/system actor envelope |
| Source identity | 🟡 PARTIAL | S selected payload refs/receipts | Partial | No uniform source/trust class |
| Entity linkage | 🟡 PARTIAL | F/N project/run FKs + generic entity_id | Current links yes | Typed entity references |
| Structured payload | 🟡 PARTIAL | S JSON object + producer metadata | Current shapes | Kind-specific validation absent |
| Schema versioning | ⚪ NOT STARTED | S no event schema version | No | Versioned envelope/catalog |
| Append-only history | 🟢 IMPLEMENTED + VERIFIED | F/N/D update/delete denied | Yes | Privileged admin outside guarantee |
| Transactional creation | 🟢 IMPLEMENTED + VERIFIED | F/N producers share state transactions | Supported paths yes | No universal mutation interceptor |
| Failure atomicity | 🟢 IMPLEMENTED + VERIFIED | F/N/D injected rollback faults | Yes | Network effects remain separate |
| Event deduplication | 🟡 PARTIAL | F/N producer idempotency | Supported commands | No generic semantic-event uniqueness |
| Scheduler-event integration | 🟢 IMPLEMENTED + VERIFIED | F/N receipts/run/advance/history atomic | Yes | External scheduling events future |
| Trigger-receipt separation | 🟢 IMPLEMENTED + VERIFIED | N/D separate event/receipt/run | Yes | General consumer receipts future |
| Receipt identity | 🟢 IMPLEMENTED + VERIFIED | N/D unique subscription/event and schedule/instant | Yes | IDs are not commit order |
| Receipt immutability | 🟢 IMPLEMENTED + VERIFIED | N/D update/delete/duplicate rejected | Yes | No purge lifecycle |
| Trigger deduplication | 🟢 IMPLEMENTED + VERIFIED | N/D repeat/concurrent polling | Current internal triggers yes | External source dedup absent |
| Multiple subscribers | 🟢 IMPLEMENTED + VERIFIED | D same event→two receipts/two targets | Yes | Overlap can legitimately consume another outcome |
| Subscription identity | 🟢 IMPLEMENTED + VERIFIED | F/N stable scoped IDs/FKs | Yes | External consumers absent |
| Activation fencing | 🟢 IMPLEMENTED + VERIFIED | F/N/D disable/reactivate excludes earlier events | Current timestamp policy | Transaction-start timestamp caveat |
| Stale-subscription safety | 🟢 IMPLEMENTED + VERIFIED | N/D pinned target blocks/disables | Yes | Source intentionally follows identity |
| Subscription filtering | 🟡 PARTIAL | F/N fixed source/project/kind/time | Subset | Generic predicates absent |
| Subscription authorization | 🟢 IMPLEMENTED + VERIFIED | F/N queue-only reviewed target | Yes | No inherited execution grant |
| Event→run traceability | 🟢 IMPLEMENTED + VERIFIED | N/D event/receipt/run/key/history | Yes | Rich causal envelope future |
| Payload freezing foundation | 🟡 PARTIAL | S immutable event ref + target snapshot | Provenance | Selected payload→input mapping absent |
| External-ingestion boundary | ⚪ NOT STARTED | S no ingest API | No | Validation/auth/replay/trust contracts |
| Internal/external trust distinction | ⚪ NOT STARTED | S no trust-class field | No | Explicit source class |
| Payload non-authority | 🟢 IMPLEMENTED + VERIFIED | S/F consumer ignores arbitrary instructions | Current flow yes | General untrusted ingestion future |
| Replay safety | 🟢 IMPLEMENTED + VERIFIED | N/D poll replay skips receipt pairs | Current consumer | No general replay/reset tool |
| Redelivery foundation | 🟡 PARTIAL | N/D stable internal IDs/receipts | Internal yes | External delivery IDs/dedup |
| Processing failure isolation | 🟢 IMPLEMENTED + VERIFIED | N/D failed transaction leaves event eligible | Yes | No dead-letter policy |
| Partial-subscriber isolation | 🟢 IMPLEMENTED + VERIFIED | D A commits, B fails/retries independently | Yes | Tick may stop at poison event |
| Retry foundation | 🟡 PARTIAL | N/D later tick retries unreceipted event | Poll retry yes | No per-consumer backoff/count |
| Dead-letter foundation | ⚪ NOT STARTED | S no DLQ/status | No | Poison-event isolation |
| Recovery evidence | 🟡 PARTIAL | F/N durable state/history/receipts | Evidence yes | General Recovery Manager absent |
| Notification foundation | ⚪ NOT STARTED | S manager absent | No | Consumer/delivery service |
| Memory/event separation | 🟢 IMPLEMENTED + VERIFIED | S distinct table/no memory reader/writer | Foundation yes | Useful memory NOT STARTED |
| Log/event separation | 🟡 PARTIAL | S domain facts distinct from diagnostics | Current boundary | General log service absent |
| Artifact/event separation | 🟡 PARTIAL | S separate artifact metadata | Foundation | No global payload/binary-size guard |
| Cost/event separation | 🟢 IMPLEMENTED + VERIFIED | F/N independent cost preflight | Yes | Cost event catalog absent |
| Execution/event separation | 🟢 IMPLEMENTED + VERIFIED | F/N independent scoped grants | Yes | Preserve future event consumers |
| Agent/event separation | 🟢 IMPLEMENTED + VERIFIED | F/N assignment explicit/zero permissions | Yes | Automatic coordination absent |
| Blackboard/event separation | ⚪ NOT STARTED | S no structured Blackboard service | No | Versioned projection/notification seam |
| Event query support | 🟡 PARTIAL | F/N project/after/limit | Current API | Kind/run/date/actor filters |
| Global Activity foundation | 🟡 PARTIAL | S common table + IDs/indexes | Storage only | Global read model/API absent |
| Human-readable activity | ⚪ NOT STARTED | S no dedicated description renderer | No | Safe presentation mapping |
| Retention policy | ⚪ NOT STARTED | S no cleanup/TTL | No | Retention/archive/purge design |
| Archive history | 🟡 PARTIAL | D synthetic archived project still readable | History yes | Complete archive lifecycle absent |
| Delete semantics | 🟡 PARTIAL | F/N/D append-only + references | Current restrictions | Permanent purge unsupported |
| Secret minimization | 🟡 PARTIAL | S small hashes/IDs, no raw prompts in current events | Current practice | No universal redactor |
| Payload bounds | 🟡 PARTIAL | S upstream bounded inputs, SQL object check | Partial | No per-event bytes/depth limits |
| Query indexes | 🟢 IMPLEMENTED + VERIFIED | S actual index definitions; N queries | Current schema | No performance benchmark |
| Cross-transaction ordering | 🟡 PARTIAL | D native reversed commit visibility | Known limitation | Reliable Activity continuation absent |
| Versioned-contract foundation | 🟡 PARTIAL | S stable envelope/JSON can evolve | Foundation | No actual schemaVersion contract |

## Current Event Contract

Migration 001:

```ts
{
 sequence: bigint, // generated identity, unique, allocation order
 id: string,       // evt_ UUIDv4 primary key, format checked
 project_id: string | null, // FK projects
 run_id: string | null,     // FK runs and composite run/project FK
 kind: string,             // required free text
 entity_id: string,        // required generic text, no polymorphic FK
 payload: object,          // JSONB, defaults {}, object shape only
 occurred_at: timestamp    // timestamptz, defaults database now()
}
```

run_id requires project_id and matching run/project linkage. No actor/source/correlation/causation/schemaVersion/commit timestamp/trust-class fields. Kind is not an enum or event-specific schema. Append-only trigger rejects UPDATE/DELETE. Event DTO exposes id/sequence/projectId/runId/kind/entityId/payload/occurredAt; no schema version is added by API.

## Current Event Producers

- State store: project.created/renamed; automation.created/revised; run.created/running/succeeded/failed/cancelled/interrupted/queued; job.created/started/checkpoint-saved/succeeded/failed/cancelled/interrupted/requeued; assignment dismissals on terminal runs.
- Planner: run.planned with planner version, step count and blocked state.
- Execution preparation: job.prepared and run.jobs-prepared with mode/digest/count.
- Agent Manager: agent-role.registered, agent.assigned, agent.dismissed with role/job/mode/reason metadata.
- Provider Manager: provider.call-started/eligible/succeeded/failed/interrupted and provider.slot-recovered; eligibility includes fingerprint/token/context/limit/policy/local evidence.
- Controlled worker: run.running/succeeded/failed; job.execution-authorized/execution-succeeded/execution-failed/execution-discarded; job.started/succeeded/failed/cancelled/owner-approved; agent.dismissed.
- Scheduler: schedule.created/enabled/disabled/fired; subscription.created/enabled/disabled/delivered; trigger-caused run.created.
- Intake: request.created/revised/cancelled/approved and resulting run.created/planned.

These are actual fixed/template families in current services. No automation.completed alias, quota.warning, cost.detected, deployment.completed, lee360.online or agent.needs_input producer was found. Global agent-role/provider events may have null project/run. Events from provider calls associated with jobs remain discoverable indirectly through call/worker linkage, not automatically included in project-event queries.

## Event / State / Command Finding

Explicit commands validate authority and mutate current state; events record resulting committed facts. A schedule.fired event with overlap/blocked means an occurrence was handled, not that execution succeeded. A grant event means authorization was recorded, not that a model completed. Routing/plan creation facts describe committed decisions without claiming the planned work happened.

PostgreSQL state tables remain current authority. Events help explain history but do not contain every field needed to rebuild all state: many payloads contain IDs/counts/versions or are empty. This is not full event sourcing. No replay-from-zero rebuild service exists. A later consumer may create new work under its own policy, but an event itself is not a command or execution permission.

## Ordering Finding

Sequence is a table-wide generated bigint identity, unique allocation order with gaps from rollbacks/faults. It is not per-project and does not order commit visibility. Random UUID IDs also do not imply temporal order. occurred_at defaults now(), PostgreSQL transaction-start timestamp: it is neither a separate insertion instant nor an external occurrence/commit timestamp. Several events in one transaction may share it. Subscriber ordering uses occurred_at,id,subscription ID as deterministic visible-row preference, not global causality or commit order.

D tested native PostgreSQL: transaction A allocated lower sequence and held; B allocated higher sequence and committed; Activity could see B without A; then A committed. A forward cursor after B's sequence omitted A, while a fresh query from earlier history saw both. **Activity pagination can miss late-visible rows when used as a continuously advancing watermark.** This is the carried-forward inspection/read-model limitation, not persisted event loss. No strict global Activity delivery promise is currently implemented.

Internal event subscription uses receipt absence, not Activity cursor, and processed the lower late event after the higher one. Native existing late-commit integration test also passed. No new outbox/global commit cursor was built. Activation uses occurred_at>=enabled_since: with now() semantics it compares transaction timestamps, not commit times; an event from an earlier-started transaction can be excluded at a later activation even if it commits afterward. That is the present timestamp policy, not a verified external event-time contract.

## Actor / Source Finding

No explicit actor field distinguishes named Lee/worker/agent/system. Owner API authentication does not persist a per-event human identity. Selected payloads/links infer source: triggerKey, sourceRequestId, agentId, jobId, providerId, run authority/reason and receipt schedule/subscription/sourceEventId.

entity_id is generic, not uniformly typed subject identity. For example some worker run.* facts carry the causing job ID as entity_id, while run_id identifies the actual run; generic state-store run events use run ID. Do not infer a typed entity reference solely from kind or entity_id. Composite project/run FKs protect actual run linkage, verified in tests. Uniform actor/source/typed subject+cause contracts remain future work; no existing consumer relies on entity_id to choose a source automation.

## Payload / Versioning Finding

Payload JSONB must be an object; producer code constructs known small shapes. No central kind registry, event-kind-specific validator, schemaVersion, formal policyVersion, byte/depth cap or binary restriction exists. Some payloads include plannerVersion/interpreter/attempt/version, which are domain metadata, not an event-schema version.

Current producers mostly record IDs, reasons, hashes, scope and counts, rather than prompt/output/file bytes or raw exceptions. HTTP inputs are bounded, but trusted internal callers and direct SQL can write much larger objects. This is payload validation/size/privacy debt, not an implemented safe external-ingestion envelope. Existing object/identity fields can support a versioned extension, but strict consumer schemas/version compatibility need explicit design; no historical event migration was done.

## Transactional Event Finding

Supported state create/rename/revise/transition/checkpoint, plan, intake revision/approval, preparation, assignment/dismissal, provider reservation/result/recovery, controlled job resolution/review and scheduler occurrence/delivery insert history in their respective state transaction. No generic event interceptor captures every possible SQL mutation; raw administrative updates may produce no event.

F/N inject history failures and verify rollback of state/receipt/run/job/usage as applicable. D inserted an event, changed project state and then deliberately threw: both rolled back, leaving a sequence gap possible. Provider and worker commits remain separate recoverable boundaries as Section 15 explains; network effects are not a single atomic SQL transaction. Idempotent replay returns existing records/receipts without emitting another expected semantic transition.

## Trigger Receipt Finding

Event states source fact; receipt states subscription/occurrence handled it; run states target work was queued. Separate tables preserve these meanings. trigger_receipts fields: bigint identity id, project_id, schedule_id/subscription_id, scheduled_for/source_event_id, optional run_id, outcome/reason and created_at. Shape constraints distinguish schedule/event receipts; queued iff run exists; run/project FK matches. Unique schedule/instant and subscription/event pairs are deduplication authority, supplemented by row locks/run keys/state advancement.

Receipts are append-only. D verified duplicate insert, UPDATE and DELETE rejection. Receipt ID allocation is not commit order or external exactly-once proof. A receipt may record overlap or blocked with no run; do not claim a subscriber always started work.

## Subscription Finding

Stable sub_ UUIDv4, scoped source/target/project FKs, immutable registration/key/request, pinned target version, allowed event kind, enabled/enabled_since and mutable versioned activation state. Allowed kinds: run.succeeded/failed/cancelled/interrupted. Source/target must differ and share project. Filters are evaluated during poll: enabled; project/kind; source run automation ID; event occurred_at at/after latest activation; receipt absence. Source follows permanent identity across revisions; target stays pinned.

Enable/disable requires exact current version. Re-enable uses fresh database clock_timestamp and excludes prior events. Target revision/paused/archived state at handling yields blocked receipt, disables rule and grants no new run. Source event fact persists regardless of subscriber outcome. No external payload instructions or route/grant fields are interpreted.

## Deduplication Finding

Events have stable unique IDs/sequences, but no universal semantic idempotency key or entity-version uniqueness. Two independently inserted event IDs can describe the same semantic fact. Producer commands' own keys/versions/receipts suppress expected repeats; this is not external delivery deduplication.

For each supported subscriber, pair(subscription,event) uniquely identifies processing. Native D concurrent/repeated ticks produced two receipts and two distinct queued targets for the same event through two subscriptions, then no more. Same-target multiple subscriptions may independently yield overlap receipts under the unfinished-run policy; that is deliberate, not incorrect cross-subscriber deduplication. Native locks/unique constraints were exercised here rather than inferred from embedded transaction serialization alone.

## Event → Run Finding

Source run transition commits run.succeeded fact → enabled matching subscription finds unreceipted event → locks rule and target/checks pinned version/overlap → copies target definition into new queued run/version 0 with subscription:event idempotency key → records receipt/sourceEventId/run link and subscription.delivered plus run.created → atomic commit.

This queues no plan/jobs/agents/calls. New run freezes target configuration, not arbitrary source payload. Immutable source event reference remains in receipt; there is no selected payload mapping/input-freezing engine. Run→receipt→event/source run and target snapshot explain why work exists.

## External Event Security Finding

There is no public event-create, webhook, file/email/presence ingestion endpoint. Current HTTP routes expose bounded project history reads and authenticated trigger control only. Future ingestion must authenticate source/delivery identity, validate kind/schema/size, persist trust/source class and freeze selected inputs before any consumer; those protections are not already implemented merely because JSONB exists.

Current consumer reads identity/kind/time/scope, not instruction strings in payload. Events cannot supply trusted cost evidence, arbitrary execution grants, model selection, role permissions or settings. Model/external text has no event-to-command parser. This is a current non-authority boundary, not a universal future poisoning defense. No external connector or ingest API was built.

## Replay / Failure Finding

Re-polling handles only unreceipted eligible pairs. There is no event reset/replay/delete tool or general external-effect replay promise. Duplicate external deliveries carrying fresh internal IDs would require a future external ID constraint; internal receipts alone cannot recognize their semantic equivalence.

Each delivery transaction rolls back its follow-up run/receipt/history on failure, leaving source event true and eligible. D faulted subscriber B after A committed: A stayed committed; B's work/receipt/history rolled back; later native concurrent ticks completed B without duplicating A. A tick can stop on one failed occurrence, so persistent poison events can repeatedly obstruct progress; no dead letter, retry counter/backoff or general isolation scheduler exists. Later explicit polls retry, and CLI watch repeats polling but stops after three consecutive errors. This is polling retry, not a durable per-consumer retry policy.

History/receipts provide recovery evidence, but no general Recovery Manager, Blackboard event projection, notification subscriber or Memory Manager exists. Notifications remain NOT STARTED; schema notification event FK is a placeholder, not delivery. Events must not be repurposed as learned memory or current accepted project requirements.

## Event / Memory / Log / Artifact Finding

Separate memory/artifact/state/result tables retain distinct roles. Events contain facts/links, provider text is a result, artifact metadata points to bytes elsewhere, logs are diagnostic output. No automatic event→memory distillation or event store→Blackboard substitution exists. No general log streaming/storage or artifact event writer exists. JSON object alone does not prohibit base64/file-sized data; a future global payload contract is needed. Cost eligibility and execution/assignment authority remain separate validated services; events report their actions rather than create permission by existing.

## Activity / Query Finding

Current API: GET /projects/:projectId/events with after sequence and limit 1–100. Service validates project/sequence and returns bounded ascending sequence DTOs. Current endpoint has no global/run/job/date/kind/actor filters or universal continuous-feed guarantee. Provider/role events with null project cannot be fetched through that project feed. No dedicated human-readable activity renderer or global Activity view exists.

Actual indexes: events_project_sequence_idx(project_id,sequence DESC), events_run_sequence_idx(run_id,sequence DESC), events_coordination_idx(project_id,kind,occurred_at,id) WHERE run_id IS NOT NULL; unique identity/PK indexes plus receipt pair/project indexes and enabled-subscription index. These support current access patterns but no throughput/query-plan benchmark was performed. Shared storage/indexes are foundations, not implemented richer filter APIs. Activity refresh/re-query must account for late commits; its cursor is unsuitable as notification/consumer delivery authority.

## Retention / Archive Finding

No retention timer, cleanup, archival export, purge or deletion API exists. Append-only trigger rejects ordinary UPDATE/DELETE even under normal SQL connections. Events reference project/run; receipts and notification placeholders reference events, so supported deletion cannot silently erase history. A privileged administrator can disable/drop constraints or truncate/drop schema; append-only is not tamper-proof against server/database administrators.

D synthetically set a project to archived through test SQL and verified historical events still readable. This proves current read behavior, not a full archive lifecycle. API history queries do not exclude archived project status. Automation/project archive retention and permanent purge remain future design; direct status changes do not manufacture missing archive events or stop every consumer. No user history was removed.

## Dangerous Coupling

**No blocking event-layer coupling detected.** State remains authoritative; events are facts/history, receipts control supported delivery deduplication and consumers queue inert work. No inspected event path replaces cost/execution grants, planning, agents, memory or UI authority. Current generic producer helpers and schema absence are evolution debt. Forward Activity pagination must not become a consumer watermark; current subscription correctly avoids it.

## Current Regressions

No current-stage event/receipt defect detected in tested supported flows. Late-commit Activity omission under a forward cursor is a previously identified read-model limitation, not deletion of persisted data or a receipt-consumer loss. Versioning/actor/size/trust/dead-letter gaps remain future work. No general event platform rewrite was justified.

## Repairs Made

No runtime repair necessary. Added this report and workspace-only native diagnostic/results. No event migration, external ingest, outbox/broker, replay engine, Notification Manager or paid service was built. Used isolated generated schemas only and dropped them after testing. The existing dedicated test PostgreSQL cluster was initially stopped, temporarily started on loopback 55432 and stopped after verification; normal previews/user configuration were untouched.

## Validation Evidence

- `node --import tsx --test tests/state.test.ts tests/coordination.test.ts tests/api.test.ts tests/intake.test.ts tests/worker.test.ts tests/local-provider.test.ts tests/execution.test.ts tests/agents.test.ts`: **93 passed, 0 failed, 0 skipped**, exit 0. Embedded SQL and injected protocol fixtures; covers producer rollback/replay, scope, receipt/activation handling and preserved current-stage behavior.
- `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts`: **74 passed, 0 failed, 0 skipped**, exit 0. Actual local PostgreSQL 17, generated disposable leeos_test schema; includes native late-commit event delivery, concurrent polling, shared transactional failures, worker/provider fixtures and the Section 14 spend repair. No real inference.
- `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/event-system-audit.ts`: **seven native scenario groups passed**, exit 0. Results work/section17-event-system-checks.json. Partial-subscriber failure; two subscribers/concurrent repeat handling; unique/immutable receipt+event constraints; failure after event insertion; activation and stale target; reversed commit order/Activity cursor versus receipt delivery; synthetic archive/history read. Scenario count is not assertion count.
- Dedicated loopback cluster start/stop used existing validation binaries/data, no software install. Initial sandbox connection attempts failed EACCES; approved local-network execution was used. A sandbox-started server did not remain available (ECONNREFUSED); approved test-server start succeeded. Final tests passed; generated schemas were removed; cluster stopped. Connection secrets were loaded from private existing env and not printed.

No runtime source changed; no fresh production build/lint/typecheck/browser, hosted execution, external events or paid services were run. This section does include fresh native SQL concurrency evidence; do not conflate it with a deployed external delivery platform or browser test.

## Future Event-System Gaps

Versioned kind-specific envelope/schema registry; explicit actor/source/typed entity/trust/correlation; safe payload bounds/redaction; external delivery identity/authentication/input freezing; reliable Activity continuation/commit visibility strategy; per-consumer retry/backoff/dead-letter handling; notification/Blackboard projections; retention/archive/purge; human-readable global activity and richer filters; verified effect/recovery linkage. Preserve state authority, receipt deduplication and independent execution/cost authorization.

## Recommended Next Step

Audit the next blueprint section Lee supplies; do not implement it automatically. Before broader event consumers, define versioned facts and provenance, delivery identity and retry/visibility semantics without treating a fact as permission.
