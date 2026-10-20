# Section 6 — Home / Command Center

Audit date: 2026-10-18. Implementation: 0.18.1 / Structure 18. Diagnostic scope: whether the bounded local foundation can evolve toward a goal-first operational Home while keeping orchestration in the backend. No new dashboard, intent resolver, read-model service, asynchronous worker, schema or execution permission was implemented.

## Overall Home Verdict

🟡 **PARTIALLY ALIGNED**. The current entry accepts a business goal within a disclosed text/review scope; durable state and specialized backend services are useful foundations. It is not the full goal-driven Command Center. General intent resolution, useful memory, automation-opportunity detection, global attention/active-work views, notifications and independent execution remain future work.

## Current Milestone Verdict

**Healthy within the inspected and verified local-workbench scope.** Focused tests passed and the prior readiness repair remains effective. No new current-stage defect requiring a repair was demonstrated. Future Home capabilities are not classified as regressions.

## Home Capability Matrix

Evidence: F = the 39 focused tests executed below; S = current source/contract inspection; H = unchanged historical Section 1/4/5 verification, explicitly not a fresh run. Green applies only to the named verified boundary/capability.

| Home Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Goal-first input | 🟡 PARTIAL | S bounded text input/copy; F Hub intake-to-results contract | Bounded requests yes | General outcome-to-implementation inference; execution still needs owner-supplied prompts/limits |
| Unified entry direction | 🟡 PARTIAL | S independent command schemas vs rules-v1 intake; F deterministic helpers | Separate supported paths yes | Shared intent classification/entity resolution before dispatch |
| Goal preservation | 🟢 IMPLEMENTED + VERIFIED | S immutable source/revisions and exact approval; F preserved snapshots; H Section 1/5 regression suites | Yes | Outer whitespace normalized; no claim of byte-for-byte raw-input archival |
| Clarification | 🟡 PARTIAL | S outcome/input/constraint questions; H compound/legacy draft fencing; F clarification-compatible workflow contracts | Conservative bounded gate yes | Context-aware necessity/default selection; lexical false positives possible |
| Existing-object controls | 🟡 PARTIAL | F reusable-definition, run/review and trigger controls; S explicit IDs/versions | Current ID-scoped controls yes | Natural-language names/pronouns, broader pause/restart/change semantics |
| New-goal flow | 🟡 PARTIAL | F intake→queued plan→prepared jobs→fixture calls→owner review | Text/review path yes | Memory, requirements architect, implementation choice/build/test/deploy |
| Automation opportunity support | 🟡 PARTIAL | F reusable sequence and queue-only triggers; S timing clarification | Reuse/trigger foundations yes | No repeatability metadata or automatic opportunity classifier |
| AI mode separation | 🟡 PARTIAL | F model eligibility and non-model-step schema validation; S separate task/model routers | Routing separation yes | No Home Auto/Manual selector or general provider-choice execution |
| Progress visibility | 🟡 PARTIAL | F persisted dependency/job/result state; S UI renders backend statuses | Current jobs yes | General project phases and operational summary; no fake percentages found |
| Attention-required states | 🟡 PARTIAL | S needs-clarification, pending review, blockers and recoveryRequired; F controls/fencing | Supported gates yes | Unified inbox; richer wait/resource/blocked state and resolution contracts |
| Active-work summary | ⚪ NOT STARTED | S current lists are project-scoped; no global Home query | No global summary yet | Authorized status/time-filtered aggregation with stable pagination |
| Recent activity | 🟡 PARTIAL | S durable project events; H native late-commit scheduler evidence | Event foundation yes | Home summary/human Activity service, actor/source and timeline consistency |
| System health | 🟡 PARTIAL | F setup/readiness/liveness tests; fresh live GETs below | Honest current snapshots yes | General resource health states, timestamps/freshness and degraded summary |
| Cost status | 🟡 PARTIAL | F zero/unknown/paid eligibility gates; S Recorded API spend label | Current $0 policy/recorded data yes | Implementation estimates, period totals and approved paid-path model |
| Notifications | ⚪ NOT STARTED | S table placeholder only | No | Meaningful event-driven notifications and unread/attention aggregation |
| PC independence | 🟡 PARTIAL | S Lee360 remains planned metadata; F API workflows use no Lee360 worker | Lee360 isolation yes | Current host must run; independent hosting/resource wait lifecycle absent |
| Browser-lifetime independence | 🟡 PARTIAL | S request-signal chain; H Section 5's four abort assertions; F persisted/reconnected fixture results | Durable state yes; background continuation no | Durable asynchronous acceptance/claim/completion contract |
| Backend orchestration boundary | 🟢 IMPLEMENTED + VERIFIED | F core/Hub helper contracts work without browser; S client sends API requests, backend validates/routes/executes | Yes for current scope | Full Master Orchestrator still absent; UI sequence/default helpers remain bounded conveniences |

## Current Intake Flow

Supported example: “Draft a welcome message then review the message.”

```text
Selected project + Lee's text
  -> Workbench -> OwnerClient -> authenticated Core API
  -> rules-v1 bounded interpretation (no LLM)
  -> source text + immutable proposal revision + events in PostgreSQL
  -> clarification/edit if required; new revision retains original source
  -> exact version/digest approval
  -> queued Run + immutable supplied-step Plan + approval receipt
  -> separate reviewed preparation -> persisted Job cards
  -> separate scoped agent assignment (no call authority)
  -> exact prompt/output limit/model grant for one supported text job
  -> backend dependency/version/agent checks + durable provider reservation
  -> local probe/token capacity + verified-zero eligibility + authority recheck
  -> local text call -> persisted call/usage -> job reconciliation
  -> explicit owner-review job -> saved run/result state
```

Submission itself creates no autonomous implementation or execution. The current path stops at supported local text/review work, not a website/document/delivery deployment pipeline. The focused acceptance test uses a fixture provider; it verifies control/state boundaries, not useful model output or real inference.

### Goal preservation and clarification

`requestText` normalizes outer whitespace and enforces size limits. `intake_requests.source_text` preserves the normalized full source; `intake_revisions` holds interpretations/edits and `intake_approvals` binds request, revision/digest and resulting run. A shortened step title (up to 200 characters) does not replace the preserved full goal or authorize silently dropped actions. Excess/unknown/compound actions produce questions and cannot pass rule-draft approval while unresolved.

The Section 1 fixes remain in `request-intake/index.ts` and `store.ts`: outcomes/inputs/constraints instead of asking Lee to choose an executor; compound implementation goals and saved legacy rule drafts are held for clarification. Their unchanged dedicated regression suite was not repeated for this section; Section 5 reran the full 139-test/default and 73-check/native suites with those repairs present.

Current safe defaults are sequential ordering and final owner review for recognized model-text requests; no sources are fetched, output is not automatically chained and no external execution authority is inferred. Timing words, external-action terms and some technology references conservatively trigger clarification. This is not a semantic judge of whether each question is materially necessary. Broad “build/pause/change/why” examples remain unresolved, not falsely implemented. Typed editing can express future step kinds, but cannot enable their absent launch adapters.

## Future Goal Flow

```text
Home: goal or known-object command
  -> Core API / future Master Orchestrator + Intent Gate
     ├─ identified deterministic control -> authorized state service
     └─ new/complex goal
          -> useful Memory/context [future]
          -> meaningful clarification + requirements Planner [future]
          -> implementation-wide Cost Guard [future extension]
          -> dynamic machinery Task Router [future extension]
          -> Model Router only if AI is needed [current eligibility foundation]
          -> exact authority / durable submission [future extension]
          -> build/test/repair/deploy or supported execution [mostly future]
          -> persisted result/events/review
          -> Home read model / attention / activity [future]
```

Keep current pure routing, immutable plans, zero-cost restrictions and service-owned state as foundations. Do not put this decision tree into Home JSX. Auto/Manual AI preference is a provider/model concern; executor choice is a separate capability/location concern. Current `allowedProviderIds` restricts eligible candidates and cannot bypass cost/capacity checks; it is not a complete manual-AI execution mode.

## Current Deterministic Controls

The following use ordinary backend logic, not AI reasoning:

- Read project/automation/run/job/event/status records and recover saved run/results.
- Create/rename projects; create/revise versioned automation definitions through the owner API; queue a definition snapshot as a run.
- Preview bounded interpretation, save/clarify/edit/cancel a draft and approve an exact proposal into a plan/run.
- Validate/save plans, prepare jobs and register/assign/dismiss scoped role metadata.
- Record owner review; cancel/interrupt a run; explicitly requeue a supported interrupted run with external-effects acknowledgement. Requeue is not generic restart.
- Register disabled triggers, enable/disable them and explicitly poll queue-only schedule/event rules when enabled by the operator.
- Inspect/reconcile saved execution outcomes and perform separately acknowledged local-provider recovery. A model-health probe uses protocol checks, not generation; a model-text execution does generate.

UI coverage is narrower than the owner API. There is no natural-language object resolver, general automation pause/resume/restart/delete command, automatic schedule rewrite or failure-explanation service. IDs/names/project scopes and versions are useful resolution inputs, but names need not be unique and pronouns have no persisted conversational reference resolver. Changing supported trigger timing requires disabling/registering a new reviewed trigger rather than a hidden in-place schedule mutation.

## Attention-State Findings

| Attention concept | What exists now | Missing target behavior |
|---|---|---|
| Clarification required | Persisted intake status needs-clarification + questions/revisions | Cross-project attention inbox and relevance-aware dialogue |
| Review/approval required | Draft proposal, preparation review and pending owner-review jobs; exact receipts | No universal pending-approval queue/service; generic approvals table remains a placeholder |
| Execution blocked | Plan status blocked, routing rejection reasons, dependency inspection and disabled/unavailable flags | Plan blocked is a prepare-only planning result, not a persisted universal blocked-run state |
| Recovery required | Provider recoveryRequired, retained slot and saved interrupted/failed calls | Central recovery/task resolution policy and notification |
| Automation/run failed | Persisted failed status and events | Global failure query, grouping/severity and human explanation |
| Credential/configuration missing | Bounded owner/config/readiness states; disabled provider metadata | General credential/resource requests; no secret exposure |
| Lee360/resource wait | Planned adapter identity only | No WAITING_FOR_RESOURCE state/worker monitor |
| Cost approval required | Unknown/nonzero evidence rejected | No approved paid execution path or spend-approval inbox |

Run states are queued/running/succeeded/failed/cancelled/interrupted; job states are pending/running/succeeded/failed/cancelled/interrupted. WAITING_FOR_USER, WAITING_FOR_RESOURCE, BLOCKED, PAUSED and RETRYING are not implemented job/run enum states. Existing attention can sometimes be derived from structured records, but it must not be fabricated by renaming queued/pending. Richer states or typed derived reasons/resolution actions need deliberate modelling.

Progress can use plan dependencies, actual job outcomes and events. A planned agent is an assignment, not evidence that a worker is running; a queued trigger-created run may have no plan/jobs. Current UI shows status text and manual refresh, not invented percentages or technical project-phase completion. Successful text generation plus review is not evidence of a generated technical solution passing tests.

## Browser-Lifetime Finding

Carry forward Section 5: **durable records are independent of React, but synchronous model work is request-bound.** Workbench closes OwnerClient on lock/unmount; it aborts pending fetches. `/runs/:run/jobs/:job/execute` and manual `/providers/local/calls` pass request.signal into worker/provider generation, combined with a bounded timeout. Browser-disconnected in-flight work can be failed/interrupted/uncertain and require saved-state inspection. A job worker can map the interrupted call to a failed job while retaining the provider recovery fence.

Non-generative mutations perform short transactional state changes; there is no durable background queue worker hiding behind them. Read refresh/unlock does not delete committed state. Coordinator polling can be driven by a separate explicit server-side CLI, but it queues reviewable runs and grants no execution authority. Browser probe/read requests can also abort; that is cancellation of observation, not a persistent work lifecycle.

The previous four-assertion diagnostic established persisted interrupted status, recoveryRequired, readable state and one dispatch after abort. It is unchanged historical evidence, not a newly discovered regression or rerun. Final Home continuity needs durable submission that acknowledges a persisted acceptance ID separately from execution: immutable authority/scope, idempotency, backend claim/lease/fencing, progress/results, cancellation intent separate from view disconnection and explicit uncertain-side-effect recovery. No asynchronous executor was implemented here.

## Home Read-Model Finding

**A backend-composed global read model is needed before a general Command Center.** Current APIs offer project-scoped intake/run/automation/events, individual job/plan/results, setup/readiness/system snapshots and explicit coordination views. Home would otherwise page through projects, join records and infer business meaning client-side. There is no current `/home` equivalent, status-filtered global work view, outstanding-attention API, universal activity or period-cost ledger.

A later read contract should provide:

- Owner-authorized, bounded active work and attention items with stable IDs, precise reasons and safe drill-down/resolution actions. Distinguish a future scheduled automation from an actively running job.
- An as-of timestamp plus component freshness/unknown/error distinctions so one unavailable dependency does not produce a fake healthy/zero-cost summary. Describe snapshot consistency explicitly.
- Recent human Activity sourced from the same durable events, not a second competing history store. Actor/source, presentation schemas and global queries are missing; sequence allocation is not commit order, so incremental timeline completeness needs reconciliation/overlap semantics. Scheduler receipt-based late-commit correctness does not make a future timeline complete.
- Effective cost policy separate from recorded usage, estimates and unknown/rejected eligibility; no UI-side inference that a default numeric zero means a verified implementation cost.
- Resource/health details that distinguish configured/available/busy/unavailable/unknown/unsupported and ultimately degraded/waiting states. Planned integrations must remain unsupported/unconfigured rather than online/offline guesses.

These are requirements for future architecture, not a new endpoint/schema or source of authority added during this diagnostic.

## Honest-Status Findings

Section 4's Home card still reads **Local foundation** and directs checking live readiness. Its rendered regression test passed again with owner/database environment settings absent. No new unqualified Home-level ready/online/complete/success claim was demonstrated.

Fresh localhost checks on the normal preview:

- `/api/health`: HTTP 200, static implementation label hub-workflow-ready, persistence check-readiness, ZERO_ONLY and default execution disabled.
- `/api/setup`: HTTP 200, owner not-configured, databaseConfigured false, optional model/job execution disabled.
- `/api/ready`: HTTP 503, database not-configured.

The health implementation label is static capability/liveness metadata, **not an aggregate operational verdict**; a future Home must not render it as “LeeOS Ready.” Setup is a configuration snapshot, database ready means migrated/reachable at check time, and model ready means an explicit provider probe succeeded. Browser navigator.onLine is explicitly labelled as not proving server/database readiness. Tests and existing wording preserve those distinctions; no API status identifier was renamed merely to change an audit score.

UI run/job statuses come from persisted state. Success is scoped to its recorded job/review semantics; static phase checkmarks or progress percentages were not found. Planned integrations are labelled planned. Model state is explicitly checked rather than a claim that all providers are running.

### Cost status detail

Provider descriptors distinguish verified-zero, unknown and nonzero with nullable amount/evidence; model decisions are selected or blocked with rejection reasons. Verified-zero additionally requires fresh, account/token-scoped evidence, a zero billing hard limit and no paid fallback. Unknown/nonzero cost is not automatically approved. There is no approved-paid state or payment override path to expose in Home.

The Home $0 card states financial policy; a selected run displays **Recorded API spend** from backend spentUsd. That is recorded data for the supported local milestone, not total operating cost, a quoted implementation estimate or proof of full historical accounting. Observed charges may be recorded honestly in model_usage; that does not authorize spending. No global cost aggregation/reconciliation or general planner estimate is claimed.

## Current Regressions

**No current-stage regressions detected.** Conservative lexical clarification, missing general goals/commands, no global Home view and request-bound execution remain disclosed limitations, not newly broken functionality. No task required activating a model, remote adapter, paid service or Lee360.

## Repairs Made

**No repairs were necessary.** Added this report only. No runtime source, dashboard, routing/intent UI, services, dependency, schema, environment or permissions changed.

## Validation Evidence

Executed for Section 6:

- Focused command: `node --import tsx --test tests/hub-presentation.test.ts tests/foundation.test.ts tests/readiness.test.ts tests/setup.test.ts tests/model-router.test.ts tests/planning.test.ts tests/hub.test.ts tests/acceptance.test.ts tests/automation-hub.test.ts tests/coordination-hub.test.ts`.
- Result: **39 passed, 0 failed, 0 skipped**, exit 0. Covers rendered Home honesty, zero-cost/unknown rejection, setup/readiness distinctions, routing separation, supplied-step plans, immutable snapshots, Hub connection/recovery and fixture request→review acceptance/reusable triggers.
- Fresh read-only HTTP checks of normal-preview health/setup/readiness produced the exact bounded results above. No secret values were returned in the report.
- Source trace of intake/revisions/approvals, current commands, status enums, task/model routing, run/job/provider execution, React callbacks, lifetime signals and Home/status/cost presentation.

No unnecessary full rerun of Section 1's dedicated preservation suite or Section 5's abort diagnostic was performed. Section 5's unchanged **139 default / 73 native** results and four lifetime assertions remain historical evidence, not new Section 6 passes. No new native PostgreSQL server, full-suite/lint/typecheck/build, browser interaction, mobile/device check, real inference, cloud deployment or paid operation was run; no runtime code changed. Existing previews were left in their original configuration.

## Future Home Gaps

General goal/intent and object resolution; useful memory; requirements and implementation planning; automation-opportunity classification; Auto/Manual AI UX; global progress/attention/active-work/activity/health/cost read models; notifications; independent hosting/resource state and durable asynchronous execution. Reusable definitions/triggers are foundations, not automatic repeatability detection. These capabilities must remain backend-owned and separately verified.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Before implementing a full Command Center later, define the backend Home read model and durable work-submission/attention contracts alongside the Master Orchestrator/Intent Gate design. Home should render those decisions and send explicit commands rather than reconstruct orchestration from many low-level records. Do not build that recommendation automatically.
