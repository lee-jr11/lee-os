# Section 7 — Master Orchestrator

Audit date: 2026-10-18. Implementation: 0.18.1 / Structure 18. Inspection preceded documentation changes. This is a coordination-boundary diagnostic, not implementation of the final orchestrator. No runtime source, SQL, permissions, dependencies or configuration changed.

## Overall Orchestrator Verdict

🟡 **PARTIALLY ALIGNED**. Current software services form usable coordination seams without requiring an LLM for the control plane. The module named `orchestrator` is a deterministic supplied-step planner, not the target Master Orchestrator. There is no goal/context/intent/next-action coordinator yet. Existing boundaries support incremental development, but durable dispatch and domain transition contracts still require design and testing.

## Current Milestone Verdict

**Healthy within the tested reviewed local-workflow scope.** Current preparation, assignment, one-call authorization, persistence, idempotency, review and reconciliation are concrete capabilities. Their existence is not evidence of autonomous general orchestration, distributed workers or generated-solution verification. Missing target features are not regressions.

## Orchestrator Capability Matrix

Evidence keys below refer to the existing default-suite tests executed during this audit; S = source/dependency inspection, H = explicitly identified historical evidence.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Central coordination seam | 🟡 PARTIAL | S API delegates to intake/planner/preparation/worker/coordinator; A | Current service coordination yes | Formal application-level Master Orchestrator/next-action contract |
| Deterministic-first control | 🟢 IMPLEMENTED + VERIFIED | I/P/C/A controls run with fixture generation unchanged until explicit call | Supported ID-scoped commands yes | Natural-language target/action resolution remains future |
| Intent handling | 🟡 PARTIAL | I strict commands, rules-v1 intake and unresolved-goal gates | Current subset yes | General Intent Gate, new/existing goal classification |
| Context assembly | 🟡 PARTIAL | S/W scoped run/plan/job/assignment reads; bounded prompt and model checks | Execution context yes | Relevant preferences/memory/events/tools context service |
| Clarification decision | 🟡 PARTIAL | I compound/legacy draft, revision and approval tests | Bounded conservative gate yes | Semantic question necessity and safe defaults |
| Planner delegation | 🟡 PARTIAL | P pure buildPlan plus separate store; I shared builder | Supplied-step planning yes | Goal-derived requirements before implementation selection |
| Memory delegation | ⚪ NOT STARTED | S separate schema placeholder, no retrieval API | No | Targeted Memory Manager integration |
| Cost policy delegation | 🟡 PARTIAL | M/L unknown/paid/stale rejection; W execution scopes | Current $0 enforcement yes | Unified implementation-wide policy decision/reservation contract |
| Task Router delegation | 🟡 PARTIAL | P kind-to-destination routing without launch | Current metadata yes | Dynamic machinery/location/combinations |
| Model Router delegation | 🟡 PARTIAL | M pure eligibility/ranking; L separate transport | Current snapshots yes | Wider automatic/manual execution across providers |
| Execution delegation | 🟡 PARTIAL | E preparation separated from W/L dispatch; no process launches found | Local text/review yes | General authorized execution/adapter contract |
| Durable submission | 🟡 PARTIAL | I/E durable run/plan/job records; H Section 5 request abort | Durable planning yes | Acceptance separate from HTTP generation, leases/worker claims |
| State-machine coordination | 🟡 PARTIAL | S/W transition/version/race tests | Current supported lifecycle yes | Unified domain transition ownership and richer queue/wait semantics |
| Idempotency | 🟡 PARTIAL | I/E/G/L/W/C keys, immutable grants, replay and reconciliation | Current local effects yes | External side-effect-specific deduplication and recovery |
| Approval separation | 🟢 IMPLEMENTED + VERIFIED | I/E/G/W/A clarification, plan/preparation, assignment, call grant and owner review remain separate | Yes for current protected actions | Central generic approvals for future actions |
| Human-in-the-loop | 🟡 PARTIAL | I needs-clarification; W pending review/recovery gates | Existing gates yes | General waiting reason/resume/notification contract |
| Failure isolation | 🟡 PARTIAL | W failure/cancellation/rollback; H Section 3 six isolation checks | Current local boundaries yes | Cloud/resource/notification isolation not implemented |
| Recovery delegation | 🟡 PARTIAL | S/L/W checkpoints, held slots, saved-result reconciliation | Current mechanisms yes | Coordinating Recovery Manager and effect-specific retry policies |
| Event evidence | 🟡 PARTIAL | S/I/P/E/G/L/W/C transactional history/rollback tests | Current audit evidence yes | Global typed/versioned decisions, consistent actor/source and delivery contracts |
| AI-independent control plane | 🟢 IMPLEMENTED + VERIFIED | I/P/C/G/A and H unavailable-provider isolation | Current deterministic operations yes | General reasoning service may be optional later; no global AI dependency introduced |
| PM/Orchestrator separation | 🟡 PARTIAL | G run/job-scoped roles, no system-wide permissions | Scoped assignment yes | Neither formal Project Manager worker nor Master Orchestrator exists |
| Secret isolation | 🟡 PARTIAL | I/H client/auth/error tests; S server composition | Current owner/local scope yes | Credential broker and isolated external worker credentials |
| Decision trace | 🟡 PARTIAL | P/M persisted plan decisions, I assumptions/questions/digests, L eligibility events | Bounded structured reasons yes | General strategy/requirements/tool/cost decision records and explanations |

Evidence groups: I = API/intake and blueprint-core tests; P = planning tests/shared planning contract; E = execution/preparation tests/shared contract; G = agents/shared assignment contract; M = model-router tests; L = local-provider/shared call contract; W = worker/shared execution contract; C = coordination/Hub coordination contracts; A = Hub/shared acceptance contract. Tests are under `tests/` and `tests/helpers/`. Fixture generation is not real inference.

## Current Coordination Flow

```text
Explicit command or selected project + bounded request
  -> owner API authentication + strict contract parsing
  ├─ deterministic control -> scoped state service transaction/events
  ├─ supported goal -> intake rules -> saved proposal/revisions
  │    -> clarification/edit -> exact approval
  │    -> shared buildPlan -> queued run/immutable plan + receipt/events
  └─ reviewed run/definition -> planner store -> same pure buildPlan

Separate owner preparation -> preparation manager -> persisted job batch
Separate owner assignment -> Agent Manager -> scoped metadata only
Separate owner call grant -> controlled job worker
  -> run/plan/dependency/agent checks + provider reservation
  -> provider manager -> local adapter probe/tokenize/probe
  -> Model Router zero-cost eligibility -> authority recheck
  -> bounded local generation -> saved call/usage
  -> worker reconciliation -> job/run result/events
Separate owner review -> durable approval/result

Explicit coordinator poll -> due schedule/event receipt -> queued run only
```

No master AI prompt drives this flow, no useful memory is retrieved, and no schedule grants launch authority. Browser/CLI actions currently select the next explicit operation; the system does not infer an autonomous overall next step. Non-model control paths skip model generation.

## Future Orchestration Flow

```text
Authenticated request
  -> future Master Orchestrator application service
  -> explicit Intent Gate / target lookup
     ├─ known deterministic command -> policy + existing state service
     └─ complex/new goal
          -> relevant context + targeted Memory Manager [future]
          -> clarification or requirements Planner [future extensions]
          -> system-level Cost Guard [future extension]
          -> Task Router for machinery [future extension]
          -> Model Router only if intelligence needed
          -> exact review/approval/capability authorization
          -> durable accepted work before dispatch [future]
          -> general Execution Manager -> independently claimed worker [future]
          -> verification/review + durable outcomes/events
          -> Recovery/attention services if needed [future extensions]
```

The intended seam is an application service above current specialized operations, callable by API/CLI and future event consumers. It should not replace the pure planner with a single LLM agent or move the coordinator into JSX. A future orchestration module may need a distinct name/package boundary because the current `orchestrator` directory already means planning.

## Current Orchestration Owners

| Owner | Actual responsibility / limit |
|---|---|
| `apps/hub/lib/core-api.ts` | Server configuration/database/provider composition; not goal reasoning |
| `core/src/api/http.ts` | Authentication, route/body/query validation, service dispatch and bounded errors; no model prompt reasoning or SQL lifecycle implementation |
| `request-intake/index.ts` + `store.ts` | Bounded interpretation, clarification/revisions, exact proposal approval and atomic run/plan creation |
| `orchestrator/index.ts` + `store.ts` | Pure supplied-step DAG planning/routing plus immutable persistence; no execution |
| `task-router` / `model-router` | Separate machinery metadata mapping versus model eligibility/ranking |
| `execution-manager` | Review-bound job preparation and dependency/state inspection; metadata-only adapter |
| `agent-manager` | Immutable role registration and versioned, revocable job/run-scoped assignments; no autonomous agent launch |
| `job-worker` | Narrow local:text/owner:review authorization, state updates and saved-call reconciliation |
| `provider-manager` / provider adapter | Durable reservation/usage/uncertain-call recovery versus protocol transport; not project planning |
| `scheduler` | Due-occurrence/event receipt processing and atomic queueing, not automation content/execution |
| `database/src/state.ts` | Generic persistent state lifecycle/checkpoints/events with guards against prepared-job bypass |
| Hub helpers/components | Explicit user command composition, sequence defaults, display blockers and saved-state reads; not authoritative policy/execution |

Paths beginning core above are under `packages/core/src/`. SQL persistence is deliberately colocated with application services for atomic invariants; pure planning remains separate from its store.

### Context assembly

Intake currently uses the selected project and normalized request text; it does not assemble preferences/history/memory/tool state into reasoning. Execution reloads the parent run, immutable plan, prepared job/dependencies, assignment/version, requested prompt/limits and probed model metadata. Backend validation does not trust the browser's displayed state. The provider prompt is explicitly owner supplied, bounded to 8192 UTF-8 bytes; output is bounded to 128 tokens and model capacity. No whole-database dump, automatic file loading, automatic prior-output injection or server credential insertion into prompts was found.

This avoids excessive context but also lacks the target's context/requirements planner. Unsaved prompts and review selections live in the browser until submission; committed authorization/state is outside it. Useful memory can later enter as a targeted dependency before requirements/decision making, with scoped references/evidence rather than raw database concatenation. No existing persistent rows/events were relabelled as useful memory.

## Durable Submission Finding

**Create durable authorized work before dispatch**, via an atomic application-service operation coordinated by the future Master Orchestrator and persisted through the queue/execution service. The orchestrator need not implement queue SQL or directly run the adapter. Acceptance should return an ID/receipt before the worker performs the side effect.

Current runs, immutable plans, preparations/jobs, scoped assignments, execution hashes, checkpoints, provider slots/calls and events are reusable ingredients. They are not already a distributed queue: `job_executions` explicitly records one narrow authorization per prepared job, not a lease; current execution has one-attempt semantics and an HTTP-bound provider call.

Later move worker claim/permission/fresh cost/resource checks and generation behind an independent backend execution lifecycle. Use explicit acceptance, idempotent identity, scope/version binding, queue lease/attempt fencing, side-effect status and uncertain-result reconciliation. Persist inputs/artifact references with appropriate privacy/access/retention; do not assume the current prompt hash alone is a replayable work payload. Execution authorization must not become an implicit launch merely because a preparation row exists.

Browser/API observation cancellation should stop waiting for a result, while a separate authenticated, persisted cancel intent revokes/cancels work under the execution state machine. Retain current cancellation/dismissal fences and honest uncertain outcomes. Changing a signal wire alone without a queue/recovery contract is insufficient. Section 5's four abort assertions remain historical evidence of this limitation; it is not a new regression.

## State Ownership Finding

Current run/job lifecycle values: queued or pending, running, succeeded, failed, cancelled and interrupted. Additional record types have their own states: intake draft/needs-clarification/approved/cancelled; job execution running/succeeded/failed/discarded; provider call recovery state; planned/dismissed scoped assignments. A planner's blocked snapshot is not a universal persisted blocked-run state.

Generic run transition rules are in `database/src/state.ts`, with version checks, parent locks and immutable/enum/FK SQL constraints. The controlled `job-worker` deliberately performs specialized transactional starts/finalization rather than calling the generic path, which refuses prepared-job mutation. It checks exact grants, dependencies/assignment and current run/job states before dispatch and reconciliation. API handlers map explicit commands to these services; they do not invent arbitrary status values.

Transition ownership is therefore **service-owned but distributed**, not one completed centralized lifecycle service. Trusted backend services can issue SQL; arbitrary future agents should not receive that database authority. SQL enum checks constrain values, not the complete legal transition graph. Adding waiting/retry/resource states needs coordinated domain rules/migrations, execution/preparation/provider behavior and race tests—not just extra strings or frontend badges. Preserve specialized invariants while extracting shared transition/unit-of-work contracts when future execution expansion warrants it.

## Idempotency Finding

Current protections include:

- Intake project/key deduplication with same-input checking; immutable request revisions and request/revision/digest-bound approval receipts.
- Project/run idempotency keys and definition snapshots, immutable same-input plan replay and exact preparation receipts.
- Role registration/assignment replay bound to job/run/scope; dismissal permanently revokes authority.
- One durable execution authorization per prepared job with request hash, permission, attempt, assigned agent and provider call reference. Changed prompts/grants conflict; matching repeats reconcile the saved result rather than regenerate.
- Provider request-key/prompt-limit hash, serialized durable slot and held uncertain results; replay and operator recovery do not blindly retry effects.
- Schedule-occurrence/subscription-event receipts and overlap suppression. No fixed sequence watermark loses late-committing subscription events.

These are tested **local effect protections**, not proof of exactly-once email/deployment/payment semantics. Future adapters need effect identity, provider-side idempotency where available, intent/result records, deduplication scope and reconciliation/compensation policies. A local transaction cannot atomically guarantee an arbitrary remote side effect.

## Approval / Clarification / Execution Finding

The concepts remain distinct:

1. Clarification changes a proposal revision while preserving source intent; it grants no execution authority.
2. Exact proposal approval creates a queued run/plan and receipt.
3. Plan review/preparation creates job metadata with zero permissions.
4. Assignment binds a role/scope, still with zero call authority.
5. Exact local:text permission binds prompt/limit/model fingerprint/plan/version/agent and is separately checked before dispatch.
6. Owner review records acceptance of supported completed work; it is not model self-approval.

The separate owner-authenticated manual local-call API is intentionally a bounded generation capability, not authority to change/complete a prepared job; its namespace rejects forged job-execution keys. Generic approvals SQL is a future placeholder. There is no paid-path approval mode, destructive executor or production deployment path currently enabled.

Human gates exist through needs-clarification, unapproved proposals/plans, pending review and recovery fences. There is no universal WAITING_FOR_USER/resource state or notification/resume inbox. No future names were faked in current enums.

## AI Independence Finding

The control plane is ordinary TypeScript/SQL. Deterministic commands, plans, role registration, trigger management, review and reads require no generation. Existing acceptance/provider tests measure fixture generation counters and assert no calls before exact execution and none on replay/control operations. No supported deterministic operation was found to invoke an unnecessary LLM.

Section 3's six isolation assertions additionally showed provider unavailability/failure did not corrupt unrelated queued work or prevent cancellation/new work. Those unchanged results were inspected as historical evidence, not rerun/added to this section's count. Notification/cloud/Lee360 isolation cannot be certified because those live components do not exist yet.

A failed controlled job can fail its run and cancel remaining unfinished jobs, but does not mark its containing project failed or destroy its reusable definition. Failure handling is narrow and explicit, not automatic total-project failure. PostgreSQL remains a shared critical dependency, and an uncertain provider call intentionally blocks the one local model slot until reviewed recovery.

## Dangerous Coupling

**No blocking orchestration coupling detected** in the inspected current paths. No planner/controller process launch or provider SDK/protocol embedded in goal planning was found; local HTTP transport is in its adapter. No React component sends model transport requests or owns authoritative state changes.

Manageable debt:

- HTTP-labelled contracts/errors are reused below the API layer; extract neutral application/domain contracts before broader transports.
- The controlled worker/provider manager and Hub grant UX know local-text identity/permissions. Add general capability/dispatch contracts before adding external backends instead of making the existing local path arbitrary.
- State writes/event helper patterns occur in multiple services. Intake approval and scheduler queueing write run/plan/receipt records inside the same transaction; this preserves tested rollback guarantees. Do not replace that with separate public API calls merely to remove duplication.
- Runtime policy is distributed among schemas, model eligibility, local transport and SQL constraints. A future central decision service must supplement—not remove—execution-time revalidation; planning snapshots/metadata alone are not cost authorization. Current supported side effects remain local-only, explicitly enabled and checked; no active paid fallback or cloud-billing bypass was found.
- Request lifetime still reaches model generation; durable backend dispatch is needed before autonomous continuity is claimed.

### PM versus Master Orchestrator; secret boundaries

Roles/assignments are run/job-scoped metadata with empty permissions, distinct from provider/model identity. No system-wide Project Manager agent/controller exists. The catalog's workflow-coordinator template is descriptive metadata, not an active orchestrator. Future PM workers must act within project authority and use the software coordinator's services; a role name cannot confer global authority.

Private owner/database configuration is handled in server composition. The local model adapter requires no cloud credential. No current planner prompt/context assembly fetches raw environment secrets. Owner authentication is not passed into agent role snapshots/prompts. A future isolated credential broker remains unimplemented; owner-supplied prompts could contain sensitive text, so this is not a claim of automatic secret scrubbing or comprehensive security certification.

## God-Object Finding

**No current function implements the entire target system.** `handleCoreRequest` is a growing route/validation/dispatch function, not a reasoning/execution/recovery/notification god object. The provider manager coordinates one local-call lifecycle (reservation, preflight, usage, uncertainty); the worker coordinates one job's authority/state/results. Their responsibilities are related and tested, though future transports/backends warrant splitting by application use case.

`buildPlan` validates/orders supplied steps and delegates to routers; persistence is in a separate store. It does not inspect all state or choose a general implementation. Hub code composes explicit reviewed API actions and display state, with bounded sequence defaults. These are not a hidden AI orchestrator.

No evidence supports replacing small direct service calls with an event/service hop for every deterministic read. Keep simple operations direct while introducing orchestration only where cross-service coordination is required.

### Decision trace and recovery delegation

Current proposals retain interpretation/questions/assumptions/warnings and immutable revision/digest; plans retain goal, supplied steps, task routing reasons, model decisions/rejection metadata when evaluated and planner version. Eligibility/authorization/call/job/trigger events and receipts record fingerprint, token scope, actor authority in some payloads, outcomes and recovery state. These are bounded structured explanations, not hidden model reasoning or a general record of why a technology was best. Event actor/source/version contracts and human explanations remain incomplete.

Current checkpoints, provider slot recovery, saved-call reconciliation and read-only Hub recovery are separable mechanisms that a future Recovery Manager can coordinate. Retrying after unknown external side effects must remain adapter-specific and reviewed. Repository tests verify LeeOS boundaries; no runtime generated-solution acceptance/build/test/repair loop is implied.

## Current Regressions

**No current-stage runtime regression detected** in the inspected/executed scope. One documentation scope ambiguity was narrowed: the module README's unqualified “Implemented” wording did not distinguish supplied-step planning from the target Master Orchestrator. This was a completion-claim clarity correction, not a missing-feature runtime failure.

## Repairs Made

Documentation only: updated `packages/core/src/orchestrator/README.md` to identify deterministic supplied-step planning and immutable persistence, state explicitly that the full Master Orchestrator is not implemented, and distinguish disabled planning authority from separately authorized local execution. Added this report. No runtime behavior changed; no future orchestration or dispatch layer was built.

## Validation Evidence

Fresh execution during Section 7:

- `npm test`: **139 passed, 0 failed, 0 skipped**, exit 0. The default suite covers intake/state/planning/model/preparation/agents/provider/worker/coordination/auth/Hub/acceptance, including races, rollback, replay, revocation and clean-close persistence. Provider completions are fixtures, not real inference.
- TypeScript-resolved dependency scan: **56 sources, 121 local import/export edges; zero detected runtime cycles, package-to-presentation imports or client paths to database/provider/executor/server-composition code**. Script: workspace `work/audit_architecture.cjs`. Static scan excludes declaration-level type-only edges and does not certify dynamic/third-party behavior.
- Source/contract inspection of current coordination owners, prompt/context bounds, transition writes, cost preflight, grants, idempotency, scoped roles, events and recovery paths.

Historical evidence reused explicitly: Section 3's **six** authenticated-API unavailable-provider isolation assertions; Section 5's **four** request-abort assertions and **73** native PostgreSQL checks. They were inspected, not rerun or counted as new Section 7 results. No runtime source changed; no new native database server, build/lint/typecheck, browser session, real inference, external side effect, cloud deployment or paid service was run. Normal preview configuration/services were not changed.

## Future Orchestrator Gaps

Formal next-action/intent/context coordination; targeted memory; requirements planning; general machinery and provider execution dispatch; centralized policy/transition contracts; durable submission/worker claiming; generic human attention/approval; distributed recovery; technical verification; external side-effect idempotency; broader typed decision/event contracts and credential capability isolation. These are future work, not automatically broken current features.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Before a later Master Orchestrator build, define its application-service contract and explicit dependencies/transaction ownership, then durable submission/dispatch and typed decisions. Preserve deterministic bypass, execution-time cost/authority checks, atomic receipts and independent specialized services. No recommendation is implemented automatically.
