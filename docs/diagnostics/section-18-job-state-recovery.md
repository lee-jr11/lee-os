## Blueprint Section

Section 18 — Job Queue / State Machine & Recovery. Audited 2026-10-18 against LeeOS 0.18.1 / Structure 18. Inspection and disposable embedded/native PostgreSQL validation preceded this report. No runtime, schema, UI, dependency or user configuration changes.

## Overall State-System Verdict

🟡 **PARTIALLY ALIGNED.** Persistent run/job state, generic attempt/checkpoint fencing, one-use controlled executions and manual reconciliation are implemented. A durable authorized dispatch queue, worker claims/leases, automatic orphan recovery and mid-job resumption are NOT STARTED. State authority is distributed, not one complete transition service. Existing current-stage invariants passed the audited tests; missing future states were not added.

## Current Milestone Verdict

**Healthy within current run/job/local-text/reconciliation scope.** No demonstrated invalid supported transition, duplicate execution, stale-attempt overwrite, lost committed job/result, cancellation inconsistency or unsafe recovery required repair. Failed required local work fails the run and cancels all unfinished jobs; independent-branch continuation is not a current policy. Hard-crash/process-kill safety was not tested.

## State Capability Matrix

F = 76 focused embedded tests; N = 74 native integration tests; D = eight additional native scenarios; S = inspected implementation. Green is limited to the stated supported boundary.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Automation/run separation | 🟢 IMPLEMENTED + VERIFIED | F/N snapshot survives definition revision | Yes | Broader lifecycle future |
| Run/job separation | 🟢 IMPLEMENTED + VERIFIED | F/N stable run FK and step uniqueness | Yes | General project planning |
| Job/attempt separation | 🟡 PARTIAL | F/D attempt_count versus job ID | Generic counter yes | No separate attempt history rows |
| Job/agent separation | 🟢 IMPLEMENTED + VERIFIED | F/N assignment records | Yes | Dynamic agent coordination |
| Job/executor separation | 🟢 IMPLEMENTED + VERIFIED | S/F blueprint/provider/grant separate | Local subset yes | Neutral executors future |
| Stable run identity | 🟢 IMPLEMENTED + VERIFIED | F/N UUID/immutable-ID checks | Yes | Alias resolver absent |
| Stable job identity | 🟢 IMPLEMENTED + VERIFIED | F/N UUID/FK/uniqueness | Yes | Attempt IDs absent |
| Explicit job states | 🟢 IMPLEMENTED + VERIFIED | S/F DB enum-like CHECK | Existing states yes | Wait/pause/retry states absent |
| Controlled transition graph | 🟡 PARTIAL | S/F state store + worker + SQL | Current paths yes | Central transition policy absent |
| Invalid-transition rejection | 🟢 IMPLEMENTED + VERIFIED | F/N/D illegal/stale state tests | Supported services yes | Raw SQL graph not enforced |
| Terminal-state protection | 🟢 IMPLEMENTED + VERIFIED | N/D no service revival/late overwrite | Supported paths yes | Direct SQL caveat |
| Explicit run states | 🟢 IMPLEMENTED + VERIFIED | S/F graph and DB CHECK | Yes | No pause/wait |
| Run/job reconciliation | 🟢 IMPLEMENTED + VERIFIED | F/N/D all-job completion/failure | Local subset yes | Generic completion not automatic |
| Partial-completion handling | 🟢 IMPLEMENTED + VERIFIED | F/N completed jobs retained/others closed | Current fail-fast yes | Alternate branch policies |
| Dependency persistence | 🟢 IMPLEMENTED + VERIFIED | F/N immutable plan/blueprint edges | Yes | No semantic discovery |
| Dependency readiness | 🟢 IMPLEMENTED + VERIFIED | N/D worker checks predecessor success | Yes | No claimable queue state |
| Failed-dependency handling | 🟢 IMPLEMENTED + VERIFIED | D failed required job cancels successors | Current policy yes | Branch-local failure handling |
| Independent branches | 🟡 PARTIAL | D DAG branches retained | Representation yes | Failure cancels independent unfinished work |
| Join dependencies | 🟢 IMPLEMENTED + VERIFIED | D join rejected until both succeed | Yes | Parallel dispatch future |
| Persistent pending work | 🟢 IMPLEMENTED + VERIFIED | F/N jobs restore | Yes | Not authorized payload queue |
| Durable dispatch queue | ⚪ NOT STARTED | S no payload/dispatcher | No | Browser-independent accepted work |
| Queue ordering | ⚪ NOT STARTED | S ID pagination only | No | FIFO/dispatch order absent |
| Priority | ⚪ NOT STARTED | S no job priority field | No | Priority scheduler |
| Backpressure | 🟡 PARTIAL | F slot busy rejects/pending retained | Capacity safety yes | Rejected grant not queued |
| Worker claiming | ⚪ NOT STARTED | S no claim/lease API | No | Provider slot is not queue claim |
| Running-job ownership | 🟡 PARTIAL | F/N agent/call/attempt links | Current subset | Worker/process owner absent |
| Attempt identity | 🟡 PARTIAL | F/N count and execution.attempt | Counter yes | Stable separate attempt records |
| Attempt fencing | 🟢 IMPLEMENTED + VERIFIED | N/D old attempts/checkpoints rejected | Current subset yes | Lease generations future |
| Optimistic concurrency | 🟢 IMPLEMENTED + VERIFIED | N/D expected versions/digests/CAS | Yes | No universal job version |
| Database constraints | 🟢 IMPLEMENTED + VERIFIED | F/N FKs/CHECKs/immutable records | Current integrity yes | Full transition graph not in SQL |
| Run-snapshot immutability | 🟡 PARTIAL | F/N supported API preserves snapshot | Application yes | Snapshot direct-SQL guard absent |
| Run cancellation | 🟢 IMPLEMENTED + VERIFIED | F/N/D job/agent revoke and history | State safety yes | Provider termination not promised |
| Job cancellation | ⚪ NOT STARTED | S no independent job cancel command | No | Run-level cascade only |
| Cancellation race safety | 🟢 IMPLEMENTED + VERIFIED | D native complete/reconcile races | Current paths yes | External effect cancellation absent |
| Active pause | ⚪ NOT STARTED | S no active pause contract | No | Not schedule disablement |
| Interrupted semantics | 🟡 PARTIAL | S/F multiple record-specific meanings | Current records yes | Unified cause taxonomy |
| Failed/interrupted separation | 🟡 PARTIAL | F/N linked call versus job/run status | Evidence yes | Failed job may have uncertain call |
| Blocked-state foundation | 🟡 PARTIAL | F plan/model/receipt reasons | Separate records | No formal blocked job state |
| Waiting-for-user foundation | 🟡 PARTIAL | S intake questions/pending review | Separate records | No formal job wait/resume |
| Waiting-for-resource foundation | ⚪ NOT STARTED | S preflight fails/busy rejects | No | Resource waiting service |
| Waiting-for-dependency foundation | 🟡 PARTIAL | F inspection/readiness flags | Derived yes | Pending has no dedicated wait state |
| Retry semantics | 🟡 PARTIAL | F/N replay/reconcile/new-run distinction | Safe current subset | Automatic retries absent |
| Retry limits | 🟡 PARTIAL | S one controlled grant/attempt | Local one-use yes | Generic retry budget absent |
| Retry cost safety | 🟢 IMPLEMENTED + VERIFIED | F/N/D recovery never regenerates | Yes | Future deliberate retries need checks |
| Recovery entry points | 🟢 IMPLEMENTED + VERIFIED | F/N versioned provider recover/job reconcile | Local subset yes | General Recovery Manager |
| Recovery decision logic | 🟡 PARTIAL | F/N saved call/state checks | Local subset | No executor-wide decision service |
| Restart recovery | 🟡 PARTIAL | F clean-close restore; D pool reopen | State/results yes | No automatic resume |
| Hard-crash validation | ⚪ NOT STARTED | No process-kill/power-loss test | No | Hard-crash evidence absent |
| Running-job recovery | 🟡 PARTIAL | D saved result reconciles after reopen | Manual yes | Orphan sweep/continuation absent |
| Orphan detection | ⚪ NOT STARTED | S no worker lease/liveness sweep | No | Worker presence/death detection |
| Reservation recovery | 🟢 IMPLEMENTED + VERIFIED | N/D held slot/versioned acknowledgement | Manual local yes | Stop/restart is operator assertion |
| Recovery idempotency | 🟢 IMPLEMENTED + VERIFIED | D double reconcile once; stale recover rejected | Yes | General recovery orchestration |
| Checkpoint foundation | 🟡 PARTIAL | F/D JSON progress with CAS | Generic foundation | Local checkpoint is call reference |
| Mid-job resumability | ⚪ NOT STARTED | S no executor continuation | No | Reconcile is not resume |
| Run completion rules | 🟢 IMPLEMENTED + VERIFIED | F/N/D all-job success/failure closure | Current semantics yes | No task acceptance evaluator |
| Required/optional jobs | ⚪ NOT STARTED | S no optional marker | No | All prepared jobs count |
| Result persistence | 🟢 IMPLEMENTED + VERIFIED | F/N/D saved call/job/checkpoint links | Local text yes | General file outputs absent |
| Error persistence | 🟢 IMPLEMENTED + VERIFIED | F/N provider error/recovery/run reason | Current subset | Unified job error record absent |
| Error taxonomy | 🟡 PARTIAL | F ApiError/StateConflict/LocalProviderError | Current subset | Cross-executor typed categories |
| State events | 🟢 IMPLEMENTED + VERIFIED | F/N transactional transition history | Supported paths yes | Administrative SQL not captured |
| Transition actor | 🟡 PARTIAL | S grant/reason/agent references | Inferred subset | Uniform actor envelope absent |
| Log/state separation | 🟢 IMPLEMENTED + VERIFIED | S state updates require service transactions | Boundary yes | General log service absent |
| Artifact/state separation | 🟡 PARTIAL | S separate artifact/run metadata | Foundation | Job/attempt artifact service absent |
| Memory/state separation | 🟢 IMPLEMENTED + VERIFIED | S distinct table/no memory consumer | Foundation yes | Useful memory NOT STARTED |
| Aggregate read models | 🟡 PARTIAL | F scoped read/inspection/spend subtotal | Current subset | Global counts/wait summaries absent |
| Truthful progress | 🟡 PARTIAL | F persisted statuses/dependencies/results | Current subset | No semantic percentage/phase model |
| Concurrency safety | 🟢 IMPLEMENTED + VERIFIED | N/D native start/cancel/reconcile/recovery races | Current subset yes | Distributed worker failover absent |
| Transaction boundaries | 🟢 IMPLEMENTED + VERIFIED | F/N injected failure rollback | Current boundaries yes | Network and SQL commits separate |
| Atomic job creation | 🟢 IMPLEMENTED + VERIFIED | F/N batch+receipt+history rollback | Yes | No enqueue/dispatch envelope |
| Atomic DAG creation | 🟢 IMPLEMENTED + VERIFIED | F/N validation before persistence | Current schema yes | General planner completeness absent |
| Delete protection | 🟡 PARTIAL | S no public delete, immutable references | Current paths yes | Unreferenced raw rows not universally guarded |
| Archive separation | 🟡 PARTIAL | S no automatic history mutation | Current absence | Complete archive lifecycle absent |
| Retention policy | ⚪ NOT STARTED | S no TTL/cleanup | No | Retention design |
| State auditability | 🟡 PARTIAL | F/N run/job/grant/result/event chain | Current subset | Worker/actor/criteria/effect gaps |

## Current Run Contract

Migration 001 runs fields: id; project_id; nullable automation_id/automation_version; definition_snapshot JSONB object; nullable idempotency_key; status; version; spent_usd legacy numeric; started_at/finished_at; interrupted_reason; created_at/updated_at. Composite automation/project FK, consistent automation/version nullability, positive automation version, unique project/request key, permanent run_ UUID and nonnegative counters/cost constraints.

States: queued, running, succeeded, failed, cancelled, interrupted. version is lifecycle optimistic concurrency, not definition version. API spentUsd now comes from scoped model_usage decimal sums (Section 14 repair), not the legacy field. State-only runs can exist without automation/jobs; runs from intake reference reviewed request identity and runs from automation freeze definition/version.

## Current Job Contract

jobs fields: permanent job_ UUID id; run_id FK; step_key; status; attempt_count; checkpoint_version; checkpoint JSONB object; last_heartbeat_at; created_at/updated_at. Unique run/step and composite job/run/step identity constrain prepared mappings. States: pending, running, succeeded, failed, cancelled, interrupted.

No generic job version/priority/worker/lease/optional/next-retry field. checkpoint_version is progress CAS, attempt_count is start generation; neither is job-definition version. Controlled job_executions separately stores job/run/agent/call, immutable request hash/permission/attempt and running/succeeded/failed/discarded status with timestamps. One execution authorization per prepared job, not an append-only attempts table. Agents/roles/assignments and executor/provider identity are separate.

## Current Transition Graph

Generic run graph:

```text
queued      -> running | cancelled
running     -> succeeded | failed | cancelled | interrupted
interrupted -> queued | cancelled
succeeded/failed/cancelled -> no supported transition
```

Generic internal jobs:

```text
pending -> running                         (start, increments attempt)
running -> succeeded                       (matching attempt/checkpoint)
running -> interrupted                     (parent interruption)
interrupted -> pending                     (parent requeue, retains evidence)
pending/running/interrupted -> cancelled    (parent cancellation)
pending/running/interrupted -> failed       (generic parent failure)
```

Generic job mutation requires running parent and rejects prepared jobs. Preparation receipt forbids generic run start; controlled worker starts the reviewed run through its separately validated transaction.

Controlled model job: pending attempt 0→running attempt 1→succeeded/failed; parent cancellation/interruption can change the job first, then late execution resolves discarded. Controlled human-review job: pending→succeeded atomically after dependencies/grant, without a separate running interval. Worker failure marks parent failed and **cancels** all other pending/running/interrupted jobs; this differs from generic parent failure's cascade to failed. Terminal completed jobs remain recorded. Existing prepared authorization cannot be reset by requeue.

## Run / Job / Attempt Finding

Automation is reusable definition; run is one frozen execution context; job is a stable unit in that run; attempt_count identifies generic execution generation; agent is separate scoped assignment; executor/provider performs work without defining job ID. Generic repeated starts after explicit interrupt/requeue increment attempt and retain checkpoint. No separate attempt_ identity/history table exists; events preserve transitions. Controlled local job permits one grant/attempt even on preflight failure. A new run is currently required for another controlled attempt.

## Dependency Finding

Strict plan validation rejects empty/oversize/duplicate/missing/self/cyclic dependencies before insertion. Immutable plan then blueprint freezes ordered dependsOn keys. Execution inspection derives dependenciesSatisfied; worker rechecks predecessor statuses in the locked run transaction. D native fork/join rejected a join before both branch predecessors completed, preserved pending independent branch and accepted duplicate final review only once.

All prepared jobs are required; no optional/conditional dependency mode exists. Required local failure fails the parent and cancels all unfinished work, including unrelated branches. D verified successor/review cancellation after fixture provider failure; source code applies the same whole-run rule to independent branches. DAG representation supports branches, but execution does not preserve independent unfinished branches after another branch fails. This is current documented fail-fast policy, not an implemented branch-aware recovery engine.

Generic completeJob alone does not auto-complete its run; trusted caller must transition the run after all jobs succeed. Controlled worker automatically succeeds run only when no job remains nonsucceeded, or fails/closes run after required local failure. A state-only run with no jobs can be explicitly completed by trusted internal state APIs; public owner commands expose cancel/interrupt/requeue, not arbitrary succeed/start. Recorded state success is not technical acceptance-criteria verification (Section 11).

## Queue Finding

Durable pending job records persist. They are **not a durable authorized dispatch queue**: no complete saved prompt/enqueue envelope, background dispatcher, claim/lease or autonomous work selection exists. List APIs sort random UUID IDs for pagination, not FIFO execution; no priority or creation-time queue-order contract. Provider slot capacity rejection does not delete pending job, but it does reject rather than durably enqueue that authorization. Once accepted, current request still owns active call lifetime (Section 15).

## Concurrency Finding

State store locks parent run and uses expected version/status/CAS. Generic job starts serialize via run lock and conditional pending update. Native D two starts yielded one winner; old checkpoint version and prior attempt writes failed. Cancel/complete race produced a cancelled parent with either preserved completed job or cancelled unfinished job, never revival. Prepared worker uses the same run lock for grants/reconciliation/review, plus durable provider slot.

D native cancel versus saved-result reconciliation preserved authoritative cancelled parent with legal completed-or-cancelled job outcome. Two reconciliations accepted one saved result and did not dispatch again. Duplicate provider recovery had one successful current-version transition; the other stale recovery rejected. A stale replay may return terminal history without new mutation, which is safe idempotent observation, not renewed permission. These tests cover current local/SQL races, not worker lease failover.

## Cancellation Finding

Public owner cancellation validates run/version, atomically cancels unfinished jobs, dismisses planned scoped agents and records history. Succeeded jobs/results remain. Run state and assignment changes revoke current acceptance; preflight observes revocation, and late provider completion cannot complete revoked job. Underlying call/usage may still finish and remain available in ledger. A completed job under a cancelled overall run is valid partial-completion history, not inconsistency.

No independent job-cancel API exists. Run cancellation is distinct from provider-request abort and schedule disablement. No active pause. There is no promise of killing the local model process or erasing recorded charges. F/N/D race tests verify acceptance fencing rather than process termination.

## Interrupted Finding

Generic run interrupt requires running parent, expected version and explicit reason; it marks running jobs interrupted and leaves pending work pending. Explicit requeue restores interrupted jobs to pending retaining attempt/checkpoint; no automatic replay occurs. Generic caller must start a new attempt and old attempt cannot write.

Provider interruption instead marks dispatched/uncertain call interrupted with recoveryRequired and holds slot. Controlled worker can mark linked job/run **failed** while provider outcome remains interrupted/unknown. Therefore failed job does not mean safe provider retry or proven zero usage. Errors/status must be read together with call/recovery evidence. No unified typed interruption-cause contract exists.

There is no blocked/waiting job enum: policy/capability rejection lives in plan/model decisions or command errors; stale scheduler target lives in blocked trigger receipt; missing approval is pending state/no grant; intake clarification is needs-clarification on a separate request. Dependency waits are derived flags while job remains pending. Resource unavailable yields preflight failure or busy rejection, not durable waiting/resume.

## Retry / Replay / Reconciliation Finding

Replay returns existing record/outcome; reconciliation reads and resolves persisted provider result; generic requeue restores low-level interrupted work but confers no prepared authorization; retry would be new execution and is not automatic; a new controlled run needs new review/preparation/assignment/grant. No automatic retry budget/backoff/counter exists beyond attempt_count and one-use local authorization. Recovery/reconcile never regenerates; F/N/D verify this. Current ZERO_ONLY live checks remain required for any new intentional call.

Consumed prepared jobs may appear pending after generic requeue but cannot obtain another call from their old grant. Documentation explicitly directs cancel/new reviewed run when another attempt is needed. This is not a complete resumable prepared-job workflow or evidence of a lost database row. No recovery feature was invented to reset authorizations.

## Recovery Finding

Entry points: read saved run/job/provider result; POST job reconcile (also matching execute replay when enabled); versioned provider recovery acknowledgement; generic run interrupt/requeue with explicit acknowledgement; read-only Hub saved-run recovery. Reconcile works with execution disabled and does not call provider. If call still running it refuses terminal inference and directs operator intervention. Saved terminal call resolves once subject to current run/job/assignment/attempt fences; revoked authority produces discarded result.

Abandoned durable slot/call remains visible through status/call records. Operator must stop callers/restart backend and acknowledge current call/version before clearing. Duplicate recovery does not repeat generation; stale recovery rejects. The restart acknowledgement is a trusted operational statement, not independent backend attestation. No worker identity/lease/periodic heartbeat means no automatic orphan detection, startup sweep or safe takeover.

D committed provider success while deliberately faulting job finalization, closed all test connection-pool handles, reopened against the same native schema and reconciled twice through fresh disabled services. Saved job/run/call state survived and resolved once without inference. The PostgreSQL server itself remained running; this is connection/service reconstruction, not server crash. Existing embedded tests verify clean-close snapshot restoration; native tests seed orphan reservation/crash residue. **No process-kill, power-loss, hard-crash or mid-call resume test was performed.** Lost in-flight prompt cannot be reconstructed from saved hash; no automatic completion is claimed.

Checkpoint JSON supports generic callers saving meaningful progress with optimistic version/attempt checks; executor-specific interpretation/resume is absent. Controlled local success checkpoint contains call reference/permission, not a resumable tokenizer/model state. Version counters alone are not checkpoints.

## Snapshot / Immutability Finding

Supported APIs freeze definition/version in new runs and preserve old snapshots after automation revision. Plans, preparation receipts, prepared blueprints, role/assignment scope, events/trigger receipts and execution authorization identity have SQL immutable/append-only protections. Execution identity permits one terminal resolution only. Permanent IDs and composite FKs prevent cross-run mapping changes in constrained paths.

Run definition_snapshot, many lifecycle counters/statuses and generic checkpoint contents are not protected by a universal SQL state-transition trigger. Privileged direct SQL can alter valid-enum statuses/snapshots without service history; ordinary API cannot. Enums/nonnegative constraints prevent malformed values, not all illegal graph edges. No blanket run/job delete trigger exists; FKs/immutable dependent rows restrict deletion, and no ordinary DELETE endpoint exists. Do not equate application integrity with administrator-proof database immutability.

## Atomicity Finding

Each run create+history is atomic; run is initially queued without jobs. Planning validates before saving one immutable plan+event. Preparation creates all reviewed jobs, mappings, receipt and events in one transaction; injected failure leaves no partial batch. Invalid DAGs fail before persistence, so malformed dependency input cannot leave partial jobs. Trusted low-level createJob is per-job, not a public multi-job plan builder, and cannot extend prepared batches.

State transitions commit job/run/assignment history atomically. Local grant/start/call/slot transaction precedes generation. Provider result/usage/history/slot release commit together; worker reconciliation is a separate recoverable transaction updating job checkpoint/execution/run/agents/events. A result saved but not finalized can reconcile; a network result never committed can remain uncertain. F/N exercise rollback at state/plan/preparation/assignment/reservation/provider/result boundaries. No transaction spans network inference and no external exactly-once guarantee is claimed.

## Error / Result Finding

Job execution DTO links run/job/agent/permission/attempt/call and returns accepted text from provider call only for execution succeeded. Provider result is inline text with token counts/error code/recovery flag; controlled checkpoint references call ID. Discarded output remains in provider ledger, not accepted job text. General artifact/structured result schema is absent.

Errors include ApiError status/code, StateConflict, LocalProviderError normalized codes, provider_calls.error_code and runs.interrupted_reason. jobs has no general last_error/error_category column. Invalid/stale commands may fail before a job execution/error record is created. HTTP/Hub sanitize driver/raw backend messages; persisted provider codes differ from diagnostics. No universal policy/dependency/resource/cancellation taxonomy exists, and code alone may not distinguish browser abort from every timeout. Current error/result evidence does not prove real-world acceptance criteria.

## State / Event / Log / Artifact / Memory Finding

State tables are lifecycle authority. Transactional events explain important supported transitions; raw log text cannot cause a transition. Section 17's missing uniform actor/source envelope remains: permission/hash/agent/reason metadata infer some causes but do not name every human/worker. General artifact metadata has project/run references, no implemented job/attempt registration service; bytes/results do not decide state by existing. Memory remains a separate placeholder with no active useful-memory reader/writer. None replaces lifecycle checks. No active log, artifact or memory consumer can grant execution.

## Read Model / Progress Finding

Current owner APIs expose scoped project/run/job lists, attempts/checkpoint versions, saved results and preparation inspection with dependency readiness. Section 14's ledger-backed run spend remains passing. No global running/waiting/failed aggregate or typed waiting summary exists. Truthful progress is completed/pending/failed counts and satisfied dependencies under exact saved plan, not an arbitrary percentage or claim of technical validation. Hub uses stored statuses/blockers and read-only saved-run recovery; no complete phase/progress engine exists. UUID list ordering is not execution queue order.

## Dangerous Coupling

**No blocking state-machine coupling detected.** State authority does not come from UI, routers, logs or memory. Scheduler creates queued snapshots only. Agent assignment scopes but does not launch; provider transport reports responses while worker validates result acceptance. Transition rules are distributed across state store, specialized worker/provider lifecycle and SQL. This is architectural debt for central policy consistency, not justification to collapse current independent guards or add a distributed queue during audit.

## Current Regressions

No current-stage state/recovery defect detected in the supported tested paths. Request-bound execution, consumed-job requeue limits, fail-fast branches, missing orphan detector and no hard-crash proof are disclosed target gaps. No invalid terminal revival, stale-attempt overwrite, duplicate recovery side effect or corrupted committed result was demonstrated.

## Repairs Made

No runtime repair necessary. Added this report and workspace-only native diagnostic/results. No state enum expansion, lease/queue, retries, Recovery Manager, retention or paid execution added. Temporary native test schemas were removed and the existing dedicated test cluster restored to stopped state; user data/settings/previews were untouched.

## Validation Evidence

- `node --import tsx --test tests/state.test.ts tests/worker.test.ts tests/execution.test.ts tests/agents.test.ts tests/local-provider.test.ts tests/api.test.ts tests/planning.test.ts`: **76 passed, 0 failed, 0 skipped**, exit 0. Embedded SQL plus fixture transports; includes atomic creation/rollback, illegal/stale commands, attempts/checkpoints, result fencing, uncertainty, preserved Section 14 spend regression.
- `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts`: **74 passed, 0 failed, 0 skipped**, exit 0. Native PostgreSQL 17 on loopback 55432 in generated disposable schema, shared state/worker/provider/recovery/scheduler/intake/acceptance contracts. Provider calls are fixture transport, not real inference.
- `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/state-recovery-audit.ts`: **eight native scenario groups passed**, exit 0. Results work/section18-state-recovery-checks.json. Terminal-transition rejection; competing starts/stale checkpoint+attempts; cancel/complete; fork/join+duplicate final review; pool reopen/two reconciliations; cancel/reconcile; seeded orphan+duplicate recovery; required provider failure/dependent cancellation/recovery without retry. An initial seven-scenario version passed, then failure propagation was added and the full eight-scenario version passed; count is final scenario groups, not a sum of runs.
- Existing dedicated test cluster was temporarily started/stopped with approved loopback access. Tests created/dropped only generated isolated schemas. Private test URL loaded without printing credentials.

No runtime changes; no fresh full suite/build/lint/typecheck/browser, real model, paid/external service, server-kill or hard-crash test was performed. Native pool reopen does not establish database/server restart or power-loss safety. Previous Section 15/16/17 findings were carried forward with current shared contracts and additional native races rather than relabelled as newly implemented queue features.

## Future State/Recovery Gaps

Central versioned transition policy; durable authorized dispatch queue; worker identity/claims/leases/liveness; FIFO/priority/backpressure scheduling; explicit waiting/pause/blocked semantics; separate attempts and bounded retry policy; optional/branch-aware jobs; automated orphan/running-job recovery; recoverable scoped inputs; executor checkpoints/mid-work resume; hard-crash validation; typed errors/actor/effect evidence; job artifacts and global progress/read models; complete archive/delete/retention lifecycle. Preserve current grant, attempt, cost and uncertainty fences.

## Recommended Next Step

Audit the next blueprint section Lee supplies; do not implement it automatically. Before expanding recovery, define attempt ownership, input durability, transition authority and uncertainty decisions together so unfinished work is never blindly re-executed.
