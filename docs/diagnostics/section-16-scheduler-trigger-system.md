## Blueprint Section

Section 16 — Scheduler / Trigger System. Audit date 2026-10-18; LeeOS 0.18.1 / Structure 18. Source inspection and disposable validation preceded this report. No runtime, schema, UI, dependency, configuration, service or paid integration changes.

## Overall Scheduler Verdict

🟡 **PARTIALLY ALIGNED.** Bounded UTC once/interval scheduling, scoped run-outcome subscriptions, immutable trigger registration and transactional queue-only receipts exist. Calendar/cron/DST, external triggers, inherited execution grants, resource waiting and complete lifecycle handling remain future work. Scheduler decides WHEN to queue a reviewed-version run, not WHAT/HOW or execution permission.

## Current Milestone Verdict

**Healthy within verified queue-only scheduling/trigger scope.** No demonstrated duplicate committed occurrence, lost persisted schedule, stale-definition queueing, enable/disable bypass or historical snapshot rewrite required repair. Concurrent calls were tested on an embedded engine that serializes transactions: this section does not claim native multi-process lock behavior or distributed deployment was freshly verified.

## Scheduler Capability Matrix

F = 57 focused repository tests; D = seven supplemental scenarios; S = inspected source. Green applies only to the named current capability, not the complete future trigger platform.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Scheduler/execution separation | 🟢 IMPLEMENTED + VERIFIED | F/D queued runs without jobs/calls | Yes | Future execution downstream |
| Scheduler/planner separation | 🟢 IMPLEMENTED + VERIFIED | F/D frozen definitions/no plan creation | Yes | Preserve boundary |
| Scheduler/Task Router separation | 🟢 IMPLEMENTED + VERIFIED | S/F no technology selection | Yes | Preserve boundary |
| Scheduler/Model Router separation | 🟢 IMPLEMENTED + VERIFIED | S/F no model selection/call | Yes | Preserve boundary |
| Manual runs | 🟢 IMPLEMENTED + VERIFIED | D disabled schedule does not block explicit queue | Queue subset yes | Complete automation lifecycle separate |
| One-time schedules | 🟢 IMPLEMENTED + VERIFIED | F due once/receipt/consumed guard | Yes | Local-time convenience |
| Recurring schedules | 🟡 PARTIAL | F/D fixed seconds/anchor | Intervals yes | Calendar daily/weekly/monthly rules |
| Cron support | ⚪ NOT STARTED | F/D rejected input, legacy rows inert | No | Parser/timezone/runtime |
| Minimum-frequency safety | 🟢 IMPLEMENTED + VERIFIED | F/D 60-second bound plus SQL | Yes | No aggregate registration-rate policy |
| Enable/disable | 🟢 IMPLEMENTED + VERIFIED | F/D current-version fencing | Yes | Not active-job pause |
| Independent schedule editing | 🟡 PARTIAL | S/F state versioned/config immutable | State yes | Timing edits require new registration |
| Historical integrity | 🟢 IMPLEMENTED + VERIFIED | F/D old snapshots/immutable receipts | Supported paths yes | Not protection against privileged schema rewrites |
| Timezone representation | 🟡 PARTIAL | F explicit managed UTC | UTC yes | User-zone schedule contract |
| UTC/storage separation | 🟡 PARTIAL | S UTC instants/timestamptz/UTC labels | Current subset | Distinct user-zone intent absent |
| DST foundation | ⚪ NOT STARTED | S no wall-clock engine | No | Timezone-aware recurrence |
| Stable schedule identity | 🟢 IMPLEMENTED + VERIFIED | F permanent UUID and config linkage | Yes | No human alias resolver |
| Multiple schedules | 🟢 IMPLEMENTED + VERIFIED | F multiple rows per target | Current records yes | General calendar editor |
| Ownership model | 🟡 PARTIAL | S project/automation FKs | Current scope | Independent long-lived automation lifecycle |
| Due-occurrence calculation | 🟢 IMPLEMENTED + VERIFIED | F/D anchored UTC arithmetic | Yes | Calendar recurrence |
| Duplicate-fire protection | 🟢 IMPLEMENTED + VERIFIED | F/D receipts/atomic advancement/replay | Current engine yes | Native concurrency not rerun |
| Multi-instance safety | 🟡 PARTIAL | S locks/unique constraints; F concurrent callers | Foundation | Fresh native multi-process validation absent |
| Restart recovery | 🟢 IMPLEMENTED + VERIFIED | D fresh coordinator after clean-close restore | Manual poll restart yes | No automatic process supervisor |
| Missed-occurrence policy | 🟢 IMPLEMENTED + VERIFIED | F/D coalesce latest | Current fixed policy | Configurable policies absent |
| Long-downtime behavior | 🟢 IMPLEMENTED + VERIFIED | D seven-day coalescing | Yes | No every-missed-run replay |
| Next-run calculation | 🟢 IMPLEMENTED + VERIFIED | F/D persisted next instant/phase | Yes | No editable timing recalculation |
| Occurrence/execution separation | 🟢 IMPLEMENTED + VERIFIED | F/D receipt versus run outcome | Yes | Rich linked execution status |
| Trigger receipts | 🟢 IMPLEMENTED + VERIFIED | F immutable unique receipt/history | Yes | External delivery receipts absent |
| Manual trigger | 🟢 IMPLEMENTED + VERIFIED | F/D explicit queued snapshot | Current controls yes | Natural-language RUN resolver absent |
| Event-trigger foundation | 🟡 PARTIAL | F scoped run-outcome events | Current kinds yes | General event sources |
| Webhook foundation | ⚪ NOT STARTED | S no webhook ingestion | No | Authentication/replay protection |
| File-trigger foundation | ⚪ NOT STARTED | S no watcher/upload trigger | No | File event/input contracts |
| Email-trigger foundation | ⚪ NOT STARTED | S no email ingestion | No | Connector/event contracts |
| Automation-completion trigger | 🟢 IMPLEMENTED + VERIFIED | F source run outcome→target queued run | Current subset yes | Autonomous target execution absent |
| Lee360-online trigger | ⚪ NOT STARTED | S no presence source/waiting resume | No | Worker presence/lifecycle |
| Trigger filtering | 🟡 PARTIAL | F source/project/kind/activation | Current filters yes | Arbitrary conditions absent |
| Trigger input freezing | 🟡 PARTIAL | S/F target snapshot + immutable event reference | Provenance yes | Explicit mapped event-input snapshot |
| Trigger idempotency | 🟢 IMPLEMENTED + VERIFIED | F receipt per subscription/event | Current internal events yes | External identity contract absent |
| Trigger security | 🟢 IMPLEMENTED + VERIFIED | F strict auth/scope/queue-only schemas | Yes | External ingestion not built |
| Scheduled authorization | 🟡 PARTIAL | F version-bound queue-only action | Queue authority yes | Recurring scoped execution grant absent |
| Definition-change authorization | 🟢 IMPLEMENTED + VERIFIED | F/D changed target blocks/disables | Yes | New registration needs review |
| Fresh cost recheck | 🟢 IMPLEMENTED + VERIFIED | F worker/router; D downstream blocked plan | Current execution yes | Scheduler-specific cost outcome absent |
| Availability recheck | 🟡 PARTIAL | F local worker preflight downstream | Current local yes | Resource wait/scheduler availability policy |
| Schedule/automation pause separation | 🟡 PARTIAL | F schedule disable distinct from paused-target guard | Scheduler yes | Complete automation-pause API absent |
| Schedule deletion | ⚪ NOT STARTED | S no DELETE; managed deletion prohibited | No | Archive/delete lifecycle |
| Archive interaction | 🟡 PARTIAL | S archived automation blocked | Target guard yes | Project archive not checked/complete lifecycle absent |
| Scheduler events | 🟢 IMPLEMENTED + VERIFIED | F transactional existing event kinds | Current kinds yes | Dedicated skipped/due/failure taxonomy |
| Run→schedule traceability | 🟢 IMPLEMENTED + VERIFIED | F/D receipt/key/event/snapshot | Yes | Aggregate last-run UI |
| Scheduler failure isolation | 🟢 IMPLEMENTED + VERIFIED | F history faults rollback occurrence | Yes | Whole tick is not one transaction |
| Execution-failure isolation | 🟢 IMPLEMENTED + VERIFIED | D failed run leaves recurring schedule enabled | Current state yes | Failure escalation future |
| Failure-history foundation | 🟡 PARTIAL | F run events/receipts | Evidence yes | Counts/threshold/pause policy |
| Cost-blocked occurrence foundation | 🟡 PARTIAL | D queued receipt + downstream blocked decision | Foundation | No cost-blocked receipt state |
| Notification foundation | ⚪ NOT STARTED | S Notification Manager absent | No | Typed notification delivery |
| Browser-independent scheduling | 🟢 IMPLEMENTED + VERIFIED | S CLI watch; D server-only coordination | Polling path yes | Actual detached watcher/browser-close not run |
| Host-independent scheduling | ⚪ NOT STARTED | S local host services | No | Independent hosted scheduler |
| Restart persistence | 🟢 IMPLEMENTED + VERIFIED | F/D restored registrations/receipts/next time | Clean-close yes | No hard-kill/power-loss test |
| Configuration authority | 🟡 PARTIAL | S explicit fields/DB clock/env opt-in | Current subset | Informational default timezone can confuse |
| Auditability | 🟢 IMPLEMENTED + VERIFIED | F/D identity/occurrence/outcome/run links | Queue subset yes | General trigger/execution proof |

## Current Schedule Contract

Strict request common fields: automationId; expectedAutomationVersion (integer >=1); idempotencyKey (1–120 bounded characters); action literal queue-run-for-review; acknowledgeNoExecution true.

- once: runAt, exact millisecond UTC instant within 2020–2100.
- interval: firstRunAt with same instant contract; intervalSeconds integer 60–31,536,000.

Hourly/daily/weekly elapsed intervals can be expressed in seconds; no named calendar/monthly/weekday/local-wall-clock recurrence types exist. Cron is not accepted, parsed or evaluated. Legacy schedules.kind='cron' rows remain in SQL but managed polling joins schedule_configs, excluding unmanaged legacy rows. Minimum 60 seconds applies per interval, not a global limit across many schedules.

Persisted schedules fields: id, automation_id, kind, expression, run_at, timezone, enabled, next_run_at, created_at, updated_at, version, interval_seconds. schedule_configs adds schedule_id, project_id, automation_id, pinned automation_version, request_key and immutable request JSON. One schedule has one config; an automation can have several schedules. sched_ UUIDv4 IDs are stable/immutable. Managed timezone is UTC; expression is null for managed types. next_run_at is persisted and advanced, not inferred from successful execution.

Commands are enable/disable plus expectedVersion; configuration is immutable. Changes to timing require disabling old trigger and registering/reviewing a new one. This does not rebuild the automation or mutate historical runs. There is no schedule PATCH/DELETE API. Version advances on enable/disable and occurrence processing, so stale UI acknowledgements fail.

## Current Scheduling Flow

Owner registers version-bound trigger disabled → explicit enable validates target version/status → independently started CLI/API poll → coordinator gets database clock (or injected test clock) → locks earliest due managed enabled schedule with FOR UPDATE SKIP LOCKED → computes latest due occurrence → locks target automation/rechecks pinned version/status/overlap → inserts queued run with exact current matching definition snapshot, version 0, idempotency key → inserts unique occurrence receipt → advances next instant/enabled/version → emits history → commits.

Receipt outcomes: queued/OWNER_REVIEW_REQUIRED, overlap/EXISTING_UNFINISHED_RUN, blocked/AUTOMATION_CHANGED_OR_UNAVAILABLE. Overlap checks queued/running/interrupted runs for that automation and consumes the occurrence rather than waiting to retry. One-time schedules terminate even on overlap/blocked. Definition mismatch or paused/archived target blocks and disables trigger. Draft targets may receive queued runs because queueing is not execution.

Ticks handle 2–20 total occurrences (default 10), reserve approximately half capacity for schedules, then give remaining capacity to events. Each occurrence is its own transaction; earlier occurrences can remain committed if a later one fails. Unhandled rows stay durable. No whole-batch rollback or universal fairness guarantee is claimed.

## Scheduler / Execution Boundary

Scheduler inserts run snapshots/events/receipts only. It creates no plan, jobs, agents, model call, executor dispatch or execution grant and selects no technology/provider. Manual run controls likewise queue snapshots through their explicit path, then require the normal reviewed planning/preparation/authorization workflow. Section 15's request-bound local execution debt remains downstream and is not fixed by browser-independent polling.

## Timezone Finding

Managed requests require explicit UTC instants with milliseconds/Z; non-UTC offsets or timezone overrides are rejected. PostgreSQL timestamptz stores instants, DTOs format ISO UTC, Hub labels UTC anchors/next times. Due calculation uses database clock_timestamp, not server-local wall time or browser time; caller HTTP tick cannot inject now. Internal test clock is trusted test configuration only.

Stored system_settings.default_timezone='Africa/Accra' is not consulted by managed scheduler. No user-timezone recurrence intent is retained separately from UTC instant. No DST library/parser/fold-gap policy exists. General SQL timezone/cron fields are not proof of working timezone-aware recurrence. Future calendar support requires a versioned user-zone rule with UTC occurrence calculation, preserving old snapshots; no DST/currency/current geography claims were researched or needed.

## Duplicate-Fire Finding

Stable occurrence key is schedule ID + scheduledFor. SQL UNIQUE(schedule_id,scheduled_for), target locking, run key, receipt and advancement commit atomically. Events use UNIQUE(subscription_id,source_event_id), with per-rule locks and receipt existence checks. Target automation locking serializes overlap decisions across different triggers. SKIP LOCKED leaves another caller's row eligible for later processing rather than duplicating it.

F/D repeated/concurrent coordinator calls produced one committed occurrence. **Embedded database transactions serialize**, so this proves API/state idempotency in that engine, not real multi-process row-lock contention. Source/constraints provide a native PostgreSQL design foundation; no fresh native multi-instance scheduler deployment test was run. Do not overstate distributed safety.

## Restart / Missed-Occurrence Finding

Once: a past-due instant is processed once when polling resumes. Interval: compute floor((now-next)/interval), emit only latest due instant, record skipped earlier count and advance one interval beyond it while preserving phase. Seven-day daily downtime in D emitted one latest occurrence, skipped=7 from the chosen anchor and next day persisted. No seven-run catch-up storm. Overlap can instead yield zero new runs and a consumed receipt; blocked target yields zero and disables trigger. No configurable skip/run-once/catch-up policy selector exists; coordinator reports coalesce-latest.

Disabling prevents future polling of that trigger but retains its next instant/history and queued runs. Re-enabling an interval coalesces elapsed time. A consumed one-time schedule cannot re-enable; register a new reviewed occurrence. Timing cannot be edited near due time; SQL rejects immutable-field changes, commands reject stale versions. D closed/reopened the embedded snapshot with pending enabled schedule and fresh coordinators processed it correctly. This is clean-close restart evidence, not a real killed process or clock-skew/power-loss test.

## Trigger-System Finding

Event subscriptions contain stable sub_ ID, project_id, source_automation_id, target_automation_id, pinned target_version, event_kind, request_key/request, enabled/enabled_since, version and timestamps. Allowed event kinds are run.succeeded/failed/cancelled/interrupted. Source is a permanent automation identity across its versions; target version is pinned. Source/target must differ and share project. Filters are fixed source/project/kind and events occurred at/after latest activation; no general predicate/expression/filter engine.

Event handling joins append-only events to source runs and selects undelivered matching events by receipt absence, not a sequence watermark that could lose late commits. Re-enable resets activation boundary and excludes earlier events. Stored sourceEventId references immutable event evidence; target configuration is frozen in new run. No arbitrary event payload→run-input mapping or copied external payload contract exists. Source event reference is provenance, not a complete input snapshot feature.

trigger_receipts stores identity, project, schedule/subscription ID, scheduledFor or sourceEventId, optional run ID, outcome/reason and createdAt. Queued iff run ID exists; run/project FK and event/schedule relationships constrain shape. Receipts/configs are append-only; each subscription/event or schedule/instant handled once in current tests. Receipt IDs/page sequence are inspection data, not a universal external-delivery cursor. Last occurrence can be derived from receipt/history independently of whether run succeeded; no dedicated last-success aggregate exists.

Webhook, file upload/watch, email arrival and Lee360-online ingestion are NOT STARTED. No connector was activated. Future presence events could feed a versioned trigger system, but current event-kind schema rejects them and no waiting-resource resume exists. Direct source→target self-trigger is rejected; longer multi-automation trigger cycles are not generally detected. Current queue-only owner-review boundary prevents autonomous execution loops; arbitrary future unattended chains need cycle/rate controls.

## Scheduled Authorization Finding

Enablement authorizes only repeated queue-run-for-review for the exact target version under this trigger. It conveys no recurring prompt/model/tool/cost/execution permission. Every queued run still requires owner review, plan/preparation and supported execution grants. The future “same safe work every morning without repeated approval” contract does not exist. External events cannot supply grant fields; owner auth/Host/Origin/strict schemas precede managed mutation. There is no external untrusted trigger endpoint whose security is already verified.

## Definition-Change Finding

Registration and enable validate target definition version and paused/archived status. Due handling rechecks before copying the definition. Target revision causes blocked receipt/no run and disables trigger; a newly reviewed registration is required. Existing run snapshots remain old, verified by F/D. There is no silent opt-in to a new definition. Ordinary disable/re-enable does not rewrite definition or historical receipts. Source automation version is intentionally not pinned for run-outcome subscriptions; target is pinned. Definition snapshot immutability covers supported paths; privileged SQL administrators remain trusted.

## Cost / Availability Finding

Scheduler does not require model availability to queue a run and does not inspect cost. Downstream local execution still performs fresh model/cost/token/fingerprint/authorization checks. D queued a scheduled run, created a model plan with unknown/unconfigured model eligibility, observed blocked decision/no provider call and unchanged enabled recurring schedule. This is a downstream planning-boundary test, not a real scheduled model-call rejection. Existing worker/router tests cover actual fixture preflight and scope gates.

There is no scheduler receipt outcome for cost-blocked execution; original receipt remains queued while linked plan/job/provider records explain later blocking/failure. Local resource unavailability fails bounded execution preflight; no WAITING_FOR_RESOURCE service. A downstream failed run does not disable recurring schedule, as D simulated through supported state transitions and verified next occurrence queues. No actual model inference occurred in that scenario. Failure history can support future counts/notifications, but no N-failures pause policy exists.

## Pause / Disable / Delete Finding

Schedule disable stops that trigger's future handling; it does not cancel existing runs, pause active work or delete automation/history. D verified explicit manual queueing while a schedule was disabled. Complete automation-pause semantics are not established by that test: current public API has no general pause/resume lifecycle action, although scheduler guards paused/archived target status. Manual run creation does not use the scheduler's paused/archived guard; no claim of a unified automation lifecycle is made.

Managed schedule deletion is unsupported and prohibited by SQL; event rule/config/receipt history also cannot be deleted through supported APIs. Timing edits use disable+new registration. Archived/paused automation target is blocked at next poll/enable; trigger is not necessarily immediately disabled before a due check. **Project archive status is not checked by coordinator target/queue logic.** There is no complete current project archive/delete workflow/cascade; FKs preserve ownership references but do not implement lifecycle policy. Carry forward Sections 5/9 automation ownership ambiguity rather than invent archive survival/deletion behavior. This is a future lifecycle gap, not a newly broken public archive operation.

## Browser / Host Independence Finding

Polling is server/CLI driven and needs no open browser. scripts/coordinator.ts once/watch calls protected API, watch polls about every five seconds, stops on signal or after three consecutive errors, and must be explicitly started/restarted. Hub offers manual checks; it starts no hidden timer. D server-only calls/fresh coordinators and source inspection establish no browser dependency; no detached real watcher/browser-close experiment was run.

Host independence is NOT STARTED: API/database/poller must run, and current local host shutdown stops its processes. Saved schedules persist for later polling but no work happens while local hosting is off. No specific Lee360 adapter is required by scheduling; the current physical host is nevertheless required. Provider/model availability is downstream, not proof of cloud scheduling. No hosted scheduler/supervisor was deployed.

## Configuration Authority Finding

Authoritative: immutable registration (target version, kind, anchor, interval), versioned enabled/next_run_at state, database current clock and LEEOS_COORDINATION_ENABLED for permitted tick calls. Flag does not enable execution or start a watcher. Registration/list/state control remain available while polling opt-in is false; only polling checks the flag. Tick body limit is 2–20, not a client-supplied current time. GET coordinator reports configuration/policy, not live watcher health.

Informational/nonparticipating: global default_timezone, global SQL execution_enabled, legacy cron rows and static policy displays. Hub explicitly labels UTC, no background timer and queue-only behavior; no inspected setting claims the default timezone controls these schedules. Configuration-readiness/liveness must not be conflated with a running poller.

## Dangerous Coupling

**No blocking scheduler-layer coupling detected.** Coordinator contains no executor/provider call, planning, Task/Model Router selection or Lee360 transport. React builds bounded registration forms; backend/SQL enforce the real contract. Scheduler uses state SQL directly to atomically snapshot and receipt a queued run, rather than invoking external technology. Manual CLI is browser-independent but API/host-dependent. Routing/cost/assignment/execution remain separate.

## Current Regressions

No current-stage scheduler defect detected in the audited cases. Missing calendar triggers, native distributed validation, inherited execution authority and project archive lifecycle are future gaps. No evidence justified changing recurrence/enablement or adding a broad trigger platform.

## Repairs Made

No runtime repair necessary. Added this report and workspace-only supplemental diagnostic/results. No cron/DST, webhook/email/file connector, archive service, external platform, paid path or new scheduler state was built. Normal previews/settings/user databases were untouched.

## Validation Evidence

- `node --import tsx --test tests/coordination.test.ts tests/coordination-hub.test.ts tests/state.test.ts tests/api.test.ts tests/worker.test.ts tests/model-router.test.ts tests/automation-hub.test.ts`: **57 passed, 0 failed, 0 skipped**, exit 0. Existing tests cover repeat/concurrent polling, disabled due schedules, immutable config, stale target version, overlap/coalescing, event scope/activation/dedupe, history rollback, restored receipts, queue-only authority and downstream grants/model cost. Section 14 recorded-spend regression remains passing.
- `node --import tsx ../../work/scheduler-audit.ts`: **seven scenario groups passed**, exit 0. Results work/section16-scheduler-checks.json. Manual run with disabled schedule; rejected near-due timing edit/stale toggle; clean-close restoration/fresh concurrent coordinator calls and seven-day coalescing; downstream unknown-cost model selection blocked without calls/schedule disable; simulated execution failure retains recurring schedule/next occurrence; definition revision preserves snapshots and blocks stale schedule; minimum/maximum interval/cron/timezone/offset rejection and terminating one-time calculation.
- Disposable synthetic clocks and embedded database under `.leeos/tests/leeos-section16-*`, closed/discarded with guarded cleanup. Promise concurrency is serialized by embedded SQL; not native multi-process row-lock evidence. Execution failure was a state fixture, cost rejection a blocked planning decision, not real provider execution. No paid services, real user data or deployed clock changes.
- Inspected contracts/coordinator/migration 007; state/manual/API boundaries; Hub coordination helpers/panel; CLI watch lifecycle and current scheduling documentation. Native late-commit test exists in shared test source but was not executed by these embedded suites; no fresh native late-commit claim is made.

No runtime changes; no fresh full suite/build/lint/typecheck/browser/native PostgreSQL, real poller process restart, real inference or external trigger test was performed. Historical broader evidence is not added to these counts.

## Future Scheduler Gaps

Calendar/local-zone/DST/cron; editable versioned timing policy; webhook/file/email/presence ingestion; generic filters/input mapping; recurring scoped execution authorization; complete automation/project archive lifecycle; resource/cost waiting outcomes; typed failure/notification events; notification delivery; hosted/supervised polling; fresh native multi-instance deployment validation; richer last-occurrence/execution status and chain-cycle/rate policy. Preserve queue-only boundaries until new authority is explicitly designed.

## Recommended Next Step

Audit the next blueprint section Lee supplies; do not implement it automatically. Before broader scheduling work, define timezone/calendar semantics, trigger input/provenance, lifecycle rules and recurring authority separately from execution machinery.
