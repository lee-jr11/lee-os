# Section 5 — Main Hub Navigation

Audit date: 2026-10-18. Implementation: 0.18.1 / Structure 18. Scope: information architecture, persisted relationships, configuration ownership and contracts for the six target areas. This is not another screen-completeness/browser-layout audit. No runtime source, routes, configuration, permissions or schema changed.

## Overall Navigation Verdict

🟡 **PARTIALLY ALIGNED**. Existing entities and versioned owner APIs provide a sound basis for separate Home, Automations and Projects routes. Activity has durable event foundations; Settings has diagnostic/operator configuration foundations. Useful Memory remains NOT STARTED. No demonstrated conflict requires replacing the core, but dedicated routes need additional read models, explicit execution-lifetime handling and frontend session/view contracts.

## Current Milestone Verdict

**Healthy within the verified single-page local-workbench milestone.** Object separation, snapshots, owner-authenticated API access and durable recovery pass the executed contracts. The workbench was never a completed six-route application. Missing top-level pages are future work, not regressions. Persistence independence does not establish background execution independence.

## Navigation Matrix

Status describes readiness toward the target area's information architecture, not merely whether a page file exists. This differs deliberately from Section 4's screen-presence assessment.

| Area | Current State | Backend/Data Readiness | Boundary Quality | Expected Now? | Future Gap |
|---|---|---|---|---|---|
| Home | 🟡 PARTIAL — landing/intake/workbench | Project-scoped requests/runs/events; system/setup/readiness snapshots; exact review records; recorded run spend. API/intake/Hub/acceptance contracts pass | Can compose read views without owning execution | Local entry yes; universal dashboard no | Active/recent work queries, approval inbox, cost aggregation, alerts and Lee360 availability service |
| Automations | 🟡 PARTIAL — project-scoped reusable panel | Stable IDs, name/status/version/definition/cost policy, immutable run snapshots, separate schedules/receipts. State/automation-Hub/coordination contracts pass | Definition distinct from run/job/project; no domain generator hard-coded | Current reusable definitions yes | System-wide discovery/filtering, last-run read view, typed executor/AI/location/input/output metadata and full lifecycle |
| Projects | 🟡 PARTIAL — project list and selected work | Stable IDs, description/status, schema metadata, linked requests/automations/runs/jobs. Rename/persistence/scoping contracts pass | Generic records; text restriction belongs to current UI/worker rather than project identity | Basic project/work records yes | Finite-goal/phase/requirements/problem/blackboard contracts and project-type views |
| Memory | ⚪ NOT STARTED — schema placeholder only | memories has ID, optional project, kind, JSON content, optional source artifact and timestamps; no useful-memory service/tests | Separate from logs/events; clean future service space, not a finished memory contract | No | Typed scopes/tags/evidence/confidence/retrieval/review, automation linkage and permissions |
| Activity | 🟡 PARTIAL — event foundation; timeline screen NOT STARTED | Persistent event ID/sequence/time/kind/entity/payload and optional project/run linkage; project event API/pagination and coordination tests pass | Domain events distinct from user timeline and technical logs | Durable history yes; universal Activity no | Actor/source contract, global access/querying, human descriptions, filtering and concurrency-safe timeline refresh |
| Settings | 🟡 PARTIAL — read-only setup and operator configuration | Server env, manifest/constants, constrained settings rows and per-object configuration; setup/auth/cost contracts pass | Secrets stay server-side; ownership is explicit in code but split among mechanisms | Current diagnostics/operator setup yes | Typed ownership/precedence, preferences API, audited protected edits and redacted connection views |

## Current → Future Mapping

- **Home:** move the existing intake entry and setup summaries into an operational landing view. Requests require project context today; a context selector/default-context policy is needed before a universal goal input. Active/failed work and approvals can be derived from current records, but no single system-wide read API or inbox exists. Notifications/Lee360 resource status require future services. A zero-only label is policy; run spentUsd/model_usage are recorded data, not an implementation estimate or monthly ledger.
- **Automations:** move reusable definitions and trigger controls into registry/detail views. Current metadata includes ID/project/name/status/version/definition/cost policy. Schedules/subscriptions are separate records. SQL has executor_id, but the current create/revise API and DTO do not configure/expose it. There is no typed AI mode, cloud/local/hybrid classification, requires-Lee360 flag, estimated-cost contract or last-run field; a generic JSON definition is not evidence those features work.
- **Projects:** move project selection plus requests/runs/plans/jobs/results into project/detail views. A project can own several automations and ad-hoc runs; it is not an automation run. Project metadata JSON is a schema extension point but is not exposed through the current project DTO/write API as a Blackboard. Names/descriptions and data model are domain-independent; only the supported UI sequence/worker scope is text-oriented.
- **Memory:** create only after a useful-memory service is designed. Existing events/prompts/files must not become a fake Memory page. Current schema allows global-or-project content and source-artifact reference; user/engineering/automation/performance scopes, confidence, provenance, tagging/indexes and retrieval/review remain undefined.
- **Activity:** build a human presentation/read service over events, with explicit source/actor, filters, linked-object summaries and ordering/refresh semantics. Do not simply render arbitrary payload JSON as a finished human timeline. Provider-level events with no project are not returned by the current project-events endpoint.
- **Settings:** separate redacted operator configuration, security policy, runtime switches, object configuration and future user preferences. SetupPanel is a status reader, not the authority that writes settings.

### Supported controls versus future controls

Current Hub controls: create/select a reusable text definition; review queueing a run snapshot; separately save a reviewed plan; register/enable/disable queue-only triggers; prepare/assign/authorize supported jobs; review saved work; cancel a supported run. Definition revision, interrupt/requeue and some inspection functions exist in the owner API rather than all being exposed in the panel. Requeue is explicit interrupted-run recovery, not generic restart.

Automation pause/resume/restart/archive/delete, generic stop/configure, AI settings, files, memory and log navigation are not implemented controls. A paused status allowed in SQL or set by a test fixture is not a working pause command. Queueing a run is not automatically executing an automation.

### Route architecture

Next App Router currently has `/`, the layout/manifest and diagnostic/owner API routes. It can add resource directories such as `/projects/[id]` or `/automations/[id]` without replacing core services. Exact paths are a later product decision; none were added here.

Object reads already use stable IDs (`/api/v1/projects/:id`, `/automations/:id`, `/runs/:id`, `/jobs/:id`, and `/runs/:id/plan`). Current buttons select React state without changing the URL; browser Back/deep-link restoration of a selected object is not implemented. Shared neutral DTOs, route loaders, typed not-found/permission/error states and a memory-only owner-session scope above routed views will need design. Reusing RootLayout is possible; it does not automatically establish any of these behaviors.

## Object Relationship Map

These are actual database relationships; arrows do not imply a current clickable Hub link.

```text
Project
  ├─ Automation (project_id required)
  │    ├─ Run (optional automation_id + same-project FK,
  │    │        version + immutable definition snapshot)
  │    └─ Schedule (automation_id)
  │         └─ managed schedule_config (project + automation/version)
  ├─ Request (intake_requests.project_id)
  │    ├─ immutable Revision (request_id + version)
  │    └─ intake Approval (same project; one request -> one approved Run)
  ├─ ad-hoc Run (automation_id may be null)
  │    ├─ Plan (run_id primary key; one immutable plan per run)
  │    ├─ Preparation receipt -> prepared Job records
  │    ├─ Job (run_id) -> execution/owner-review records
  │    └─ scoped agent assignments -> Job + Run
  └─ Event history (optional project_id + run_id)

Schedule / Event subscription -> trigger Receipt -> optional queued Run
Event subscription -> source Automation + target Automation + Project
Event subscription receipt -> source Event

Placeholder Artifact -> required Project + optional same-project Run
Placeholder Memory  -> optional Project + optional source Artifact
Placeholder generic Approval -> optional Run
```

The request-derived Run also records source request/revision/digest in definition_snapshot JSON; the actual relational request-to-run join is intake_approvals. Request and automation are not interchangeable, and not every run comes from either an automation or approved request.

Events carry polymorphic `entity_id` and JSON metadata; there is no typed job_id or artifact_id foreign key in events. Job/automation/schedule/agent relationships may be resolved using kind/entity/payload. There is **no direct Job→Artifact, Automation→Memory or Artifact→Event foreign key**, no separate permanent Plan UUID, and no useful Memory service. Placeholder artifacts/memories need service-level scope/integrity rules before being exposed. Existing artifact run/project scoping uses a composite FK, but placeholder memory source-artifact scoping is not a full authorization contract.

Automations currently must belong to a project. A global Automations screen can aggregate them without conflating identities, but later design must define organization/ownership for long-lived automations after a finite build project ends. No automatic project-complete→automation-archive lifecycle is established by the current contracts.

## Configuration Ownership Map

| Category | Actual owner / storage | Current behavior and ambiguity |
|---|---|---|
| Server environment | Private DATABASE_URL, owner token/origin, setup-generated env files | Server composition reads live process environment. PostgreSQL credentials and owner key are not user preferences; normal edits require operator setup/restart, not a browser toggle |
| Security policy | ZERO_ONLY in source/manifest, Zod schemas, model eligibility, local transport restrictions and SQL constraints | No current paid-approval mode. Constrained SQL cost_policy is not a policy editor; changing a display/DB row cannot authorize arbitrary spending |
| Runtime execution | LEEOS_JOB_EXECUTION_ENABLED, both local-provider flags, LEEOS_COORDINATION_ENABLED | Server callbacks are actual gates. Assignment, a saved plan or a schedule does not override them |
| System-setting rows | cost_policy=ZERO_ONLY, execution_enabled=false, default_timezone=Africa/Accra seeded in SQL | No runtime service reads these rows to drive execution/timezone. execution_enabled is not the live gate; scheduler's managed instants use explicit UTC. Editing these rows is not a supported way to configure those behaviors |
| Provider configuration | Fixed loopback llama.cpp protocol/port, operator-managed model server; verified runtime metadata snapshots | Cloud provider names are inactive. No user-preference UI, SDK credentials or general provider config service. Local-only acknowledgement is an operator policy boundary, not backend binary attestation |
| Executor configuration | Static disabled catalog and preparation metadata; separate local text worker | No configured cloud/GitHub/n8n/Python/Lee360 launch adapters; executor_id schema field is not a functional backend selector |
| Project configuration | projects description/status/metadata plus linked requests/plans | Current API exposes description/status but supports create/rename, not a typed phase/metadata editing service |
| Automation configuration | automations.definition/version/status/cost_policy; immutable run snapshots | Definition create/revise is supported. Triggers are separately versioned; modifying a run's plan does not revise its automation |
| Trigger configuration | schedules/schedule_configs/event_subscriptions | Explicit UTC times, immutable reviewed target version and separate enable/disable state; DB default timezone is not consulted |
| Run/job authority | Immutable plan, preparation receipt, assignment and exact execution/review records | Per-object persisted authority, not a global autonomy preference |
| User preferences | No general persistent preferences contract found | Future AI-routing, notification, autonomy and execution preferences must be distinguished from hard policy and secrets |

**Ownership debt:** security policy and runtime switches have clear active code paths but overlapping names in SQL/source/env invite confusion. No supported UI/API currently edits the inactive SQL settings as though they were live, so this is not a demonstrated current defect. A later typed configuration service should declare owner, scope, precedence, effective value and update/audit rules. No configuration reorganization was performed.

## Strong Foundations

- Stable IDs survive rename, scopes are enforced by database relationships and owner API validation, and historical run/plan/approval snapshots remain separate from current definitions.
- Data retrieval and mutation already work without the current React page. Future resource pages can consume these contracts rather than invent browser-owned system state.
- Reusable definitions and finite/project work have different records. Generic project/definition data is not hard-coded to the Bible example or a named domain.
- Current access/errors distinguish configuration, authentication, state conflicts, missing records, transport loss and disabled capabilities; unsupported executors are labelled planned rather than falsely enabled.

## Weak Foundations

1. **Global read models:** projects can be listed globally, but runs/automations/events/intake lists are project-scoped. Home/Automations/Activity need system-wide queries or explicit bounded aggregation. Current UUID-ordered project/run lists are not “most recent” or status-filtered queries. No generic outstanding-approval inbox/alerts/cost totals endpoint exists.
2. **Activity metadata:** timestamps, kind, ID, entity, payload and project/run links exist; actor/source are not consistent first-class fields. Entity linkage is polymorphic. Payloads lack a general versioned presentation schema.
3. **Activity ordering:** event API reads ascending sequence with an after cursor. Sequence is allocation order, not commit order; `occurred_at` defaults to transaction time. A transaction with a lower sequence can commit after a higher returned event, so a client that only advances a watermark can miss it. Receipt-based scheduler delivery explicitly handles this and its native test passes; that is not proof that a future live Activity stream is complete. Define overlap/reconciliation/ordering before claiming a universal timeline.
4. **Frontend ownership:** OwnerClient, selected project/run and unsaved review state live inside Workbench. Moving among dedicated pages needs explicit session lifetime, URL identity, reloading and unsaved-input behavior. Browser selection state is not the backend truth.
5. **Project and automation semantics:** project metadata needs typed Blackboard API fields; automation's generic JSON and unused executor field are not typed capability/configuration contracts.
6. **Empty/unsupported states:** OwnerApiError centralizes bounded transport/auth/storage messages and panels distinguish not-checked/disabled/planned/no-records. Feature-specific empty/loading/unsupported content is still locally authored, not one reusable discriminated presentation model. Unknown codes use a safe generic message. This is a shared-view design task, not evidence all states collapse to “Unavailable.”

## Missing Future Areas

Dedicated six-area route shell/deep linking; operational Home aggregates; global automation discovery; project Blackboard views; useful Memory; human Activity; central Settings/preferences; artifact/log views and generic approval inbox. Do not implement placeholders to improve the score.

## Misleading Navigation / Labels

**No misleading navigation claims detected.** Current disclosures name actual supported functions, not fake completed pages. Section 4's readiness wording correction remains present and its rendering test passes again. The operator/API-only wording in some guidance is narrower than the whole workbench but does not promise unavailable navigation; no new UI copy repair was required here.

## Backend Lifetime Findings

**Persisted state is independent of React; uninterrupted execution is not yet fully independent of the HTTP caller.**

Source trace: Workbench unmount/lock closes OwnerClient; OwnerClient aborts its pending fetches. Core API passes request.signal to the job worker/manual local generation path; provider manager combines it with a timeout and forwards it to the model adapter. Navigation does not directly issue run cancellation/delete, but an abort can interrupt synchronous model work. Merely moving a future execution form to another page would not guarantee continuation.

A focused authenticated-API diagnostic held a fixture model dispatch, aborted its Request signal and verified **four assertions**: persisted call status interrupted; recoveryRequired true; fresh authenticated read still returns interrupted; exactly one dispatch. No automatic retry occurred. This proves honest persisted interruption, not autonomous background execution. Existing close/reopen and Hub recovery contracts verify durable state and reads; they do not prove a model keeps running after component unmount.

Before promising “start job, navigate to Settings, job continues,” introduce an independently claimed backend execution lifecycle or explicitly separate view cancellation from execution authorization. This is required future architecture work; changing caller-signal behavior now without a worker/recovery contract would exceed this diagnostic. It is not a regression against the bounded synchronous local-call milestone.

## Authorization Findings

Every current `/api/v1` dispatch authenticates before data access using the configured single-owner token and strict Host/Origin checks. Backend version/digest/capability checks remain authoritative. Existing tests reject absent auth, cross-origin requests, cross-project object relationships and stale/invalid protected commands. Future route loaders/client calls can use these services without relying on hidden menu buttons.

New Next pages are not automatically protected merely by being added to a directory: keep public shells free of private data and enforce authentication/redaction in any server data loader/API. Current owner access is system-wide, not multi-user/per-project RBAC. Future files, provider connections and settings mutations need their own server-side capabilities and redacted response contracts. Public setup/health expose bounded status only; no private config values are copied here.

## Current Regressions

**No current-stage regressions detected.** Global query gaps, memory placeholders, configuration ownership debt and request-bound execution lifetime are target-readiness limitations, not newly failed current controls. No current source change was justified by this audit.

## Repairs Made

**No repairs were necessary.** Added this audit report only. No pages, routes, settings service, Memory/Activity subsystem, background executor, dependencies or SQL migrations were built. Temporary lifetime diagnostic script/results live outside the repo source in workspace `work/`.

## Validation Evidence

Executed during Section 5:

- `npm test`: **139 passed, 0 failed, 0 skipped**. Includes stable IDs, scoping, preserved snapshots, intake/approval, automation/coordination helpers, bounded state/error presentation, auth, rendered Home wording, recovery and fixture execution.
- `npm run test:postgres`: **73 passed, 0 failed, 0 skipped** on the disposable native PostgreSQL fixture's generated test schema. Includes relational boundaries, version/transaction behavior, run snapshots and late-commit-safe scheduler receipts. The fixture was stopped afterward.
- Additional in-process API abort/lifetime diagnostic: **4 assertions passed, 0 failed**. Script/result: workspace `work/navigation-lifetime.ts`, `work/section05-lifetime.json`. Embedded PostgreSQL and fixture transport; no real model/network/browser navigation/remote job used.
- Inspected current App Router tree, DTOs/API paths, schema/migrations, configuration readers, state/approval/trigger services, OwnerClient/unmount handling and empty-state/error patterns.

No runtime source changed. Lint, typechecking, production build, browser refresh/layout/security-bundle checks and actual tab reopening from Section 4 remain historical evidence, not newly executed Section 5 checks. No new browser test, remote access, paid service or six-page navigation demonstration is claimed. Normal preview services/configuration were not changed.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Before implementing dedicated navigation later, agree route/object identity and read models, configuration ownership, owner-session scope and navigation-independent execution semantics. The current domain model does not require replacement to add the six areas; those missing contracts still require implementation and verification. Do not implement that recommendation automatically.
