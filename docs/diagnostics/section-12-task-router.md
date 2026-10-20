## Blueprint Section

Section 12 — Task Router / Technology Selection. Audited 2026-10-18 against LeeOS 0.18.1 / Structure 18. Inspection and validation preceded this report. No runtime code, schema, UI, dependencies, settings or services changed.

## Overall Task-Router Verdict

🟡 **PARTIALLY ALIGNED.** A pure deterministic task-kind lookup and inert executor-preparation metadata exist. Dynamic goal-driven capability/tool/technology selection is NOT STARTED. Manifest `capability-routing` means this bounded lookup; `goal-driven-implementation-selection` is explicitly deferred. No claim of general intelligent routing is justified.

## Current Milestone Verdict

**Healthy within verified fixed-routing/prepare-only scope.** Unknown kinds remain unassigned, all task routes are non-executable, and actual supported local execution requires independent scope/permission/model checks. Future registry discovery, locations, alternatives and re-routing are missing capabilities, not regressions.

## Task Router Capability Matrix

F = 67 focused repository tests; D = 24 diagnostic checks; S = inspected source. Green covers the stated current boundary, not operational future integrations.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Capability-first routing | 🟡 PARTIAL | S/D kind lookup | Bounded yes | Neutral capability requirements |
| Goal-driven technology selection | ⚪ NOT STARTED | S no goal input; manifest deferred | No | Strategy discovery/selection |
| Planner/Router separation | 🟡 PARTIAL | F separate pure function; saved metadata | Current composition yes | Machinery encoded in kinds |
| Intent/Router separation | 🟡 PARTIAL | S prior intake boundary | Bounded yes | Intake still maps verbs to model/review |
| Model Router separation | 🟢 IMPLEMENTED + VERIFIED | F/D model target delegates; separate modelDecision | Yes | Preserve in future dynamic routing |
| Executor separation | 🟢 IMPLEMENTED + VERIFIED | S pure lookup; F/D no launch, inert blueprints | Yes | Actual external launch remains absent |
| Tool Registry foundation | 🟡 PARTIAL | S SQL placeholder/static executor catalog | Schema/catalog only | Reader/writer, evidence/availability/cost |
| Reusable component discovery | ⚪ NOT STARTED | S no lookup/selection | No | Verified component registry |
| Multi-tool strategies | 🟡 PARTIAL | D mixed step kinds/dependencies | Metadata yes | Strategy planning/hybrid execution |
| Cloud/local/hybrid classification | ⚪ NOT STARTED | S no location field | No | Location independent of machinery |
| PC-independence routing | 🟡 PARTIAL | S no Lee360 probe/call | No hidden mandatory adapter | Offline requirement/cloud execution |
| Lee360-specific routing | 🟡 PARTIAL | D device→lee360 metadata | Placeholder yes | Worker registration/dispatch |
| Availability separation | 🟢 IMPLEMENTED + VERIFIED | S pure lookup; F independent live gates | Current boundary yes | Tool availability/resource waiting |
| Cost-policy integration | 🟡 PARTIAL | F cost/model guards; D inert routes | Current guard yes | Task-wide option cost evidence |
| Free-alternative foundation | 🟡 PARTIAL | D candidate list; F model eligibility ranking | Metadata only | Ranked task alternatives/free search |
| Unknown-cost handling | 🟢 IMPLEMENTED + VERIFIED | F unknown/nonzero/unverified model cost blocked | Current executable subset yes | General tool cost schema absent |
| Availability states | 🟡 PARTIAL | S executor booleans/model states | Subset yes | Unified tool/host states |
| Permission-aware routing | 🟡 PARTIAL | F separate assignments/grants | Authority boundary yes | Router itself does not evaluate permissions |
| Risk/effect classification | ⚪ NOT STARTED | S no route effect field | No | Typed effects/sensitivity |
| Deterministic routing | 🟢 IMPLEMENTED + VERIFIED | D all mappings and unknown cases | Yes | No general semantic selection |
| AI-assisted routing seam | 🟡 PARTIAL | S versioned plan + independent gates | Future seam only | Validated candidate contract/adapter |
| Structured route contract | 🟡 PARTIAL | D target/reason/executable | Current subset yes | Capability/tool/location/cost/version |
| Decision trace | 🟡 PARTIAL | F saved plan routes/reasons | Snapshot yes | Evidence-backed structured rationale |
| Route versioning | 🟡 PARTIAL | F immutable plan; S plannerVersion | History yes | Dedicated task-router/rule version |
| Fallback routes | 🟡 PARTIAL | D workflow candidate IDs | Candidates only | Ordered conditional fallback policy |
| Scheduler separation | 🟢 IMPLEMENTED + VERIFIED | F queue-only trigger contracts | Yes | Preserve independent WHEN/HOW |
| Agent Manager separation | 🟢 IMPLEMENTED + VERIFIED | F scoped assignments separate from routing | Yes | Team strategy/role composition future |
| MCP replaceability | 🟡 PARTIAL | S absent dependency/control plane | Future seam | No MCP adapter/registry support yet |
| n8n replaceability | 🟡 PARTIAL | S/D disabled candidate, no control dependency | Placeholder yes | Actual integration unverified |
| GitHub Actions executor boundary | 🟡 PARTIAL | S candidate/disabled catalog; CI separate | Placeholder yes | No runtime workflow dispatch |
| Python/Node replaceability | 🟡 PARTIAL | S/D Python optional kind, no universal executor | Worker options yes | Node tool adapter absent; TS/Node host remains |
| Fail-closed routing | 🟢 IMPLEMENTED + VERIFIED | F/D unknown inert, no paid/unsafe fallback | Current subset yes | Explicit dynamic NO_VALID_ROUTE contract |
| Re-routing foundation | 🟡 PARTIAL | F immutable history/new-run boundary | Foundation only | New decision approval/supersession |

## Current Routing Inputs

`packages/core/src/task-router/index.ts`: `routeTask(kind: string)`. It receives only step.kind, not goal, requirements, title, host, credentials, cost, permission or tool-registry records. Planner's strict schema validates kind as a trimmed 1–80-character string before this call; the pure function itself is not an untrusted-input API schema. Exact matching is case-sensitive. It performs no text classification or discovery.

## Current Routing Output Contract

```ts
{ target: string, reason: string, executable: false }
```

No router version, tool ID, location, requiresLee360, costStatus, availability, effect, ranking or formal reasonCode exists. Planner embeds the result per step in an immutable versioned plan; model decisions are a separate optional step property.

Separate executor preparation produces:

```ts
{ stepKey, title, kind, dependsOn,
  candidateExecutorIds, destination,
  executionEnabled: false, permissions: [],
  mode: 'prepare-only', blockedReason }
```

`blockedReason` is UNSUPPORTED_CAPABILITY or EXECUTION_DISABLED. These are metadata, not a dispatch strategy or grant. Prepared jobs may exist for unsupported kinds but remain inert; mere job-row existence does not imply execution eligibility.

## Current Routing Rules

| Kind | Task target | Preparation destination | Candidate executor IDs |
|---|---|---|---|
| review | owner | owner | [] |
| model | model-router | model-provider | [] |
| workflow | github-actions-or-n8n | workflow | github-actions, n8n |
| python | python | python | python |
| device | lee360 | lee360 | lee360 |
| anything else | unassigned | unassigned | [] |

Reason strings disclose human review, planning-only model routing, unconfigured external executors or unsupported capability. Model route wording about disabled execution describes this inert routing layer, not a live readiness determination for the separately authorized local worker. Object.hasOwn prevents inherited names such as constructor/toString/__proto__ from becoming routes. No process, filesystem, network, provider or environment side effect exists in task-router. Preparation copies metadata only and exposes no launch method.

## Capability-First Finding

The router is primarily a fixed kind catalog mixing capability classes and machinery labels. It cannot infer DOCX→Python, website→Node or automation→n8n. It also has no Node/MCP/cloud/agent-team capability entry or general no-special-executor decision. Human review maps to owner, which needs no automated executor; that is not a universal simple-task classifier. Future capability-first schemas can be versioned with old plan readers preserved. Do not rewrite old plans/digests just because new rules would choose differently.

## Planner / Router Finding

Carry forward Section 11: supplied kind python/device already chooses machinery; Planner calls routeTask rather than containing a discovery algorithm. It saves route explanations alongside blocked steps. Acceptable bounded implementation with future technical debt; no present blocking coupling. A later neutral requirements→capability→strategy contract can precede existing preparation, with validated versioned outputs.

Intent carry-forward from Section 8/10: recognized text verbs become model/owner-review drafts. Technology keywords prompt conservative clarification rather than select an executor. Owner-edited steps explicitly choose kinds. This is partial separation, not a full neutral intent pipeline; no BUILD→Codex or automation-word→n8n shortcut was found.

## Model Router Separation

Task Router sends model work to model-router and selects no AI product. Planner separately invokes routeModel only when model requirements are supplied, persisting modelDecision independently of route. Model Router uses server registry capability/capacity/cost/account/availability evidence; default cloud providers are inactive. It reserves no call. Worker/provider services independently validate actual local text grants, fingerprint, capacity and current readiness. F verified scope cannot be widened through a job grant. Model priority ranking is not task-executor alternative discovery.

## Tool Registry Finding

Migration 001 placeholder fields: id text PK with tool_ UUIDv4 constraint and immutable-ID trigger; name text NOT NULL UNIQUE; adapter_id text NOT NULL; enabled boolean NOT NULL default false; capabilities JSONB NOT NULL default [] with array check; created_at/updated_at timestamps default now and update touch trigger. Capabilities are not a validated catalog of tool capability strings. There are no tool cost, location, host, permission, risk or availability fields and no inspected application reader/writer/query service. A table is not an operational registry.

Static getExecutorCatalog returns executionEnabled:false, mode:prepare-only and executor records `{id,enabled:false,configured:false,permissions:[]}` for GitHub Actions/n8n/Python/Lee360. It has no live probes/cost/capabilities. Provider registry is separate and richer: provider id/enabled/configured/accountScope/models; model capability/token/priority/enabled, availability status unknown/unavailable/available plus timestamps/quota, cost status unknown/nonzero/verified-zero plus amount/freshness/evidence/account/token scope/hard-limit/fallback evidence. These model records are not a general Tool Registry. Reusable automation sequences exist, but Task Router does not discover reusable components or recipes.

## Cost / Availability / Permission Finding

Task Router evaluates none of these; it cannot pronounce a route free, available or permitted. Every route stays non-executable. Existing zero-cost assertions reject unknown/unverified/nonzero costs; Model Router rejects stale or insufficient evidence and paid fallback. Current local provider/worker uses separate bounded authorization and preflight. No free assumption is made for future GitHub Actions, cloud service or n8n usage; external executors stay disabled. No paid path was activated.

Executor enabled/configured booleans and inert reasons are limited availability metadata; richer model availability is separate. No unified OFFLINE/UNSUPPORTED/UNKNOWN tool-state contract or resource wait state exists. Assignment has zero permissions; execution uses exact local:text or owner:review grants, plan/run/job/agent scopes, versions and dependency checks. Availability does not confer authority. Empty permissions do not classify future read/write/email/deploy/delete effects: that typed risk layer is absent. Future option acceptance must consult independent cost/permission/availability policy rather than trust AI/router prose.

## Cloud / Local / Hybrid Finding

No independent execution-location contract exists in task routes, plans or executor blueprints. Device→Lee360 is a named destination, not host discovery. A technology can run in several places, and the current data does not model that distinction. Future strategy needs separate executor implementation, location/worker requirements and resource identity.

## PC Independence Finding

No hidden Lee360 client, availability probe or mandatory device call is used by Task Router. Only explicit device metadata selects Lee360. However, the currently delivered Hub/database/local-model setup needs its hosting machine and services running. This audit does not establish cloud operation or PC-off availability. requiresLee360/offline requirements are not typed current plan fields. Lee360 integration remains an optional future worker direction, not an implemented remote server.

## Hybrid Strategy Finding

One plan can contain model, workflow, python, device and review steps with DAG dependencies; D verified mixed metadata survives into blueprints. Workflow candidate IDs name two possibilities, not two tools to run or ordered approved fallbacks. No general multicapability-per-step composition, CLOUD/LOCAL/HYBRID strategy, ranked alternatives or hybrid execution exists. A future AI strategy proposal could enter through a validated versioned candidate contract followed by registry/policy checks and fresh review; no AI routing adapter exists today.

## Replaceability Finding

n8n/GitHub Actions/Python/Lee360 appear as disabled integration IDs/candidates, not state authorities. PostgreSQL/core state and owner services remain independent of them. GitHub Actions CI is a manual workflow_dispatch repository-check workflow with contents:read; it is not LeeOS runtime job dispatch or the permanent server, and was not run here. MCP has no runtime integration or control-plane dependency; it could later be added behind a registry capability/adapter, but the current strict contracts do not automatically make that implemented. Node is required by the TypeScript/Next.js host, not mandated as the executor of every task; no general Node task executor exists. Replaceability is a design seam, not a tested swap between live implementations.

Scheduler remains WHEN: current trigger contracts queue snapshot runs for review, with no technology selection, job preparation or execution permission. Agent Manager separately registers/scopes roles and assignments to prepared jobs; router does not spawn teams or select roles. PM/team strategy and dynamic resource waiting remain future services.

## Hard-Coded Shortcut Finding

The five exact kind mappings and matching preparation switch are explicit bounded shortcuts. No title/goal keyword document→Python, website→Node or automation→n8n routing was found. D varied titles without changing routing. Fixed destinations appear in both Task Router and executor metadata adapter, which is manageable duplication but should move toward one versioned capability/adapter contract when adding integrations. It causes no observed current discrepancy: model-router versus model-provider and workflow-target versus candidate list describe different stages. Do not describe these mappings as intelligent technology selection.

## Fail-Closed Finding

Unsupported strings, inherited object names, new capability names and injected-looking kind strings return unassigned/executable:false; preparation retains UNSUPPORTED_CAPABILITY with no candidates/permissions. Valid unknown-kind plans can be saved/prepared as inert records, not executable jobs. Worker only handles supported local model/review actions and checks its own grant/blueprint/dependencies; it cannot run shell/Python/remote workflow because a title says so. There is no dynamic NO_VALID_ROUTE reason enum, alternative search or unsafe fallback. Existing model unknown-cost/availability failures block selection.

Route decisions/reasons are frozen in immutable run plans. plannerVersion exists, but no dedicated task-router/rule version is stored. Changed rules can affect new plans; historical get returns saved metadata. Future controlled re-routing needs a new approved strategy revision/run, explicit supersession and new permission/cost/resource checks, not mutation of historical snapshots. No re-routing was implemented.

## Dangerous Coupling

**No blocking task-router coupling detected.** Router imports no provider transport, executor implementation, Scheduler or React. Planner composes pure routing output and separate Model Router snapshots; intake remains a bounded drafting overlap. UI sends/reviews explicit plans, not its own dynamic routing policy. Executor adapter duplicates fixed kind metadata but does not launch. These partial seams warrant versioned evolution, not an audit-time module rewrite.

## Current Regressions

No current-stage routing regression detected. Missing dynamic selection, tool discovery, locations and alternatives are future capabilities.

## Repairs Made

No runtime repair needed. Added this report; temporary diagnostic script/results are in workspace work/. No general dynamic router, registry, schema migration, MCP integration or fallback executor was built.

## Validation Evidence

- `node --import tsx --test tests/planning.test.ts tests/execution.test.ts tests/model-router.test.ts tests/worker.test.ts tests/agents.test.ts tests/coordination.test.ts tests/foundation.test.ts`: **67 passed, 0 failed, 0 skipped**, exit 0. Focused embedded SQL/fixture tests cover immutable snapshots, digest fencing, inert adapters, unknown/nonzero cost, model eligibility, scoped worker grants, dependency/review gates and queue-only scheduling. Worker transport is a fixture, not real model inference.
- `node --import tsx ../../work/task-router-audit.ts`: **24 checks passed**, exit 0. Results work/section12-task-router-checks.json. Pure five-route mapping/determinism, 14 unsupported/case/inherited/injection-looking strings, mutation isolation, mixed-plan metadata, title independence, unsupported preparation and disabled catalog checks. No database/process/network/dispatch.
- Inspected full task-router and executor adapter sources; planner/router composition; model/provider contracts; tool_registry schema and application references; worker/assignment/preparation contracts; manifest; scheduling tests and CI workflow. Prior Sections 8/10/11 findings carried forward without rerunning their entire intake diagnostic.

No fresh full suite, lint/typecheck/build, browser, native PostgreSQL, real inference, remote workflow, deployment or paid service was run. Existing previews/configuration were untouched.

## Future Task-Router Gaps

Capability-first input; dynamic goal-driven strategies; live Tool Registry with verified component discovery; independently represented cost/availability/location/worker/permission/effect constraints; ranked free alternatives and conditional fallbacks; neutral typed reasons and routing versions; optional validated AI proposals; multi-tool/hybrid strategy execution; agent-team delegation; controlled re-routing. Keep all execution authority outside route recommendations.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Do not implement it automatically. Before later dynamic routing work, define a versioned capability/candidate/strategy/evidence contract and preserve independent Model Router and execution policy boundaries.
