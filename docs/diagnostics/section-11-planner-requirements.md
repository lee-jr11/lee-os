## Blueprint Section

Section 11 — Planner / Requirements Planning. Audit date 2026-10-18; LeeOS 0.18.1 / Structure 18. Inspection and validation preceded this report. No runtime code, migration, UI, dependency, configuration or service changes.

## Overall Planner Verdict

🟡 **PARTIALLY ALIGNED.** Deterministic supplied-step DAG validation and immutable planning snapshots exist. General goal-to-requirements planning is NOT STARTED. The current output incorporates routing metadata; it is not a fully technology-neutral requirements contract. Neither routing nor planning grants execution authority.

## Current Milestone Verdict

**Healthy within the verified supplied-step/bounded planning milestone.** Graph validation, snapshot persistence, exact review, preparation boundaries, cost eligibility and worker scope tests passed. Future requirements/acceptance/replanning services are missing capabilities, not current regressions.

## Planner Capability Matrix

F = 81 focused repository tests in two runs; D = 21 pure diagnostic checks; S = source inspection. Green is limited to the named current contract, not the full target Planner.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Goal preservation | 🟡 PARTIAL | F source/revision/digest/compound safeguards | Bounded yes | Semantic outcome coverage and requirement mapping |
| Requirements representation | ⚪ NOT STARTED | S/D no requirements field | No | First-class requirements |
| Acceptance criteria | ⚪ NOT STARTED | S/D no criteria field/evaluator | No | Criteria, evidence and verification |
| Constraint preservation | 🟡 PARTIAL | F ZERO_ONLY/model scope; S goal prose | Current guards yes | Typed deadline/delivery/format/offline constraints |
| Assumptions | 🟡 PARTIAL | F intake proposal assumptions | Intake yes | Run plan has no assumptions field |
| Inputs | 🟡 PARTIAL | S separate exact-prompt grant | Execution prompt yes | Required-input contracts/source binding |
| Outputs | 🟡 PARTIAL | F saved text results | Local text yes | Expected artifact types/delivery evidence |
| Dependencies | 🟢 IMPLEMENTED + VERIFIED | F/D keys, missing/self/duplicate/cycle checks | Yes | Semantic dependency discovery |
| DAG foundation | 🟢 IMPLEMENTED + VERIFIED | D fork/join and reversed 50-step chain | Yes | General DAG orchestration |
| Parallelism foundation | 🟡 PARTIAL | D independent branches preserved | Representation yes | Parallel scheduler/resources; local model stays serialized |
| Granularity control | 🟡 PARTIAL | F/D size/title/key bounds | Structural yes | Meaningful task sizing |
| Intent/Planner separation | 🟡 PARTIAL | S bounded intake also drafts steps | Acceptable bounded overlap | Neutral intent/requirements stage |
| Task Router separation | 🟡 PARTIAL | F/D separate routeTask; S kind labels | Metadata yes | Technology-neutral capabilities |
| Model Router separation | 🟡 PARTIAL | F separate routeModel eligibility snapshots | Planning snapshots yes | More independent future composition |
| PM/Planner separation | 🟡 PARTIAL | F scoped immutable assignments | Scope yes | PM coordination service absent |
| Plan immutability | 🟢 IMPLEMENTED + VERIFIED | F DB UPDATE/DELETE guard, one-plan replay/conflict | Yes | In-run plan revisions absent |
| Definition/run snapshot separation | 🟢 IMPLEMENTED + VERIFIED | F revised recipe leaves prior run unchanged | Supported paths yes | Direct privileged SQL is outside this guarantee |
| Deterministic planning | 🟢 IMPLEMENTED + VERIFIED | F/D no inference, stable graph | Yes | No autonomous requirements reasoning |
| AI-planning seam | 🟡 PARTIAL | S schema/review boundary | Future seam only | AI adapter, provenance and validation extensions |
| Structured plan contract | 🟡 PARTIAL | F/D strict input, versioned output | Current subset yes | Requirements/criteria/input/output fields |
| Plan validation | 🟡 PARTIAL | F/D structural checks | Structural yes | Semantic completeness/feasibility |
| Cost-policy separation | 🟢 IMPLEMENTED + VERIFIED | F cost eligibility and worker grants | Yes | No arbitrary external paid executors |
| Runtime-resource separation | 🟢 IMPLEMENTED + VERIFIED | F snapshots versus live worker preflight | Current local path yes | General resource policy future |
| Memory integration seam | 🟡 PARTIAL | S possible versioned pre-planning context | No runtime integration | Trusted context contract; retrieval absent |
| Component reuse foundation | 🟡 PARTIAL | F reusable sequences; S inactive catalogs | Recipe subset yes | General component/tool registry lookup |
| Fail-closed planning | 🟢 IMPLEMENTED + VERIFIED | F/D invalid graphs blocked, unknown kinds inert | Current authority yes | No semantic completeness proof |
| Exact plan review | 🟢 IMPLEMENTED + VERIFIED | F digest/run/version/content fencing | Preparation/execution yes | Plan-create API itself is not a review receipt |
| Replanning foundation | 🟡 PARTIAL | F immutable plans/new runs/versioned recipes | New-run boundary yes | Linked supersession/approval workflow |
| Decision trace | 🟡 PARTIAL | S/F route/model reasons, events, provenance | Current trace yes | Requirement-to-step rationale |
| Project/automation-plan separation | 🟡 PARTIAL | F standalone versus automation-linked runs | Data distinction yes | Finite multiphase project plan service |
| Technical verification representation | 🟡 PARTIAL | D check step/dependencies can be named | Representation only | Typed technical-check executor and evidence |

## Current Plan Contract

Source: `packages/core/src/orchestrator/index.ts`. Actual strict input:

```ts
{
 expectedRunVersion: number, // required integer 0..2147483646
 goal: string,              // required trimmed 1..4000 characters
 steps: [{                 // required 1..50
  key: string,             // required [a-z][a-z0-9_-]{0,63}
  title: string,           // required trimmed 1..200 characters
  kind: string,            // required trimmed 1..80; not an enum
  model?: {               // optional, model-kind steps only
   capabilities: Capability[], // required unique 1..4
   inputTokens: number, outputTokens: number, // required positive bounds
   allowedProviderIds?: string[] // optional unique 1..20
  },
  dependsOn: string[]      // defaults []; maximum 50
 }]
}
```

`buildPlan` returns `{plannerVersion:'2', goal, costPolicy:'ZERO_ONLY', executionEnabled:false, status:'blocked', steps, blockers}`. Topologically ordered steps retain supplied fields, gain `route:{target,reason,executable:false}`, and optionally `modelDecision` from Model Router. Blockers contain stepKey/reason. No requirement, acceptanceCriteria, assumptions, inputs, outputs, deadline, destination or artifact schema exists in this plan contract. Strict input rejects adding undeclared fields; arbitrary goal/title prose is not structured enforcement.

Migration `002_plans.sql` stores one `run_plans` row per run: run_id PK/FK, run_version, input JSONB, plan JSONB, created_at. UPDATE/DELETE are rejected. Execution preparation supports saved planner versions 1 and 2, validates the graph/order again, and produces inert metadata blueprints. Extending requirements requires a versioned schema/reader strategy and retained old snapshots, rather than silently changing existing digests or merely adding JSON properties.

## Current Planning Flow

Two supported paths:

1. Intake source → deterministic interpretation/questions → immutable clarified or owner-edited proposal revision → owner approval of exact proposal version/digest → atomic queued run with source request/revision/digest plus immutable plan. Clarification itself creates no run.
2. Explicit queued standalone/automation-snapshot run → owner-supplied goal/steps (Hub can prefill a recognized frozen sequence) → schema validation/router metadata → lock queued run/check expected version → immutable plan plus event. Hub form acknowledgement binds run/version/snapshot/edited fields; API validates owner authority and input but does not require a distinct plan-creation acknowledgement/digest.

Both converge on inspect exact saved plan → separate prepare-only request with run version/digest/acknowledgement and no permissions → pending jobs → scoped assignment → separate exact local-prompt/model grant or human review. Planning alone neither prepares nor executes jobs. Same-input replay returns history; different input conflicts, including after cancellation.

## Requirements Finding

Requirements are not first-class data. Goal/title prose, model-request constraints, proposal assumptions and frozen configuration preserve fragments. No requirement IDs, must/should classification, source spans or requirement-to-step coverage exist. A schema-versioned requirements layer can precede this graph foundation without replacing it. Current supplied steps may omit a prose goal outcome; validation cannot detect that. Section 1/8/10 compound protections remain valid for bounded intake, not a general semantic coverage guarantee. Explicit owner edits intentionally change the interpreted plan while retaining original source and requiring fresh review.

Typed required inputs and expected outputs are also absent. Execution prompts are separately supplied/reviewed; titles never automatically become prompts, sources are not automatically fetched and prior outputs are not automatically chained. Persisted provider text results are actual outputs, not a declared output contract or artifact-registration service. Proposal assumptions remain retrievable through intake provenance but are not copied into every run plan, and standalone plans have none. Significant format/deadline/destination/offline constraints remain prose unless a dedicated current model/cost guard handles them.

## Acceptance-Criteria Finding

No machine-checkable goal-specific criteria/evaluator exists. Worker completion records provider/job outcomes, dependency success and explicit human-review actions. A model returning text is not proof of correctness, DOCX validity, delivery, tests or deployment health. General planInput does not require a final review; intake and Hub sequence contracts add one. Direct model-only supplied plans remain legal and still require exact model-call authorization. This documented boundary is not a missing-review regression.

## Dependency / DAG Finding

Explicit keys/dependsOn support chains, independent nodes, branches and joins. Duplicate keys/edges, missing/self references and cycles are rejected; deterministic topological ordering preserves input preference among eligible nodes. D verified a fork/join without introducing serialization and a reversed 50-node chain. API DAG support already exceeds the sequential intake/Hub convenience editors. Worker checks actual dependency success before a protected action. Neither graph representation nor sorted order establishes parallel dispatch; one local provider slot remains deliberately serialized. No parallel executor was added.

## Intent / Planner Boundary

Carry-forward finding: backend intake recognition creates sequential draft model/review steps in the same function that asks questions. This is an acceptable bounded implementation and a future separation seam, not blocking coupling. A general neutral intent/requirements stage should precede graph construction; no module split is justified merely for purity.

## Planner / Task Router Boundary

`buildPlan` calls separate pure `routeTask(kind)` and stores descriptive metadata. Known kinds are model/review/workflow/python/device, with future targets model-router/owner/GitHub Actions-or-n8n/Python/Lee360. These kind labels already mix capability with machinery, so the current plan is only partially technology-neutral. Unknown kinds route unassigned and stay inert. No adapter is launched or actual workflow implementation selected. Current limitations are suitable for the documented subset; future capability requirements should precede concrete machinery selection.

## Planner / Model Router Boundary

Optional model requirements invoke separate `routeModel`, not provider transport. Plans can persist selected/blocked decisions, provider/model IDs, eligibility reasons and expiry from a server registry snapshot. Caller allowedProviderIds can express explicit scope; no hard-coded goal→Gemini/Codex mapping exists. Planner store uses default routing options, and no quota reservation/model call occurs. A planning-time selected model is neither a live reservation nor an execution grant; worker/provider checks current model fingerprint, scope, capacity and authority. F verified grants cannot widen capability/provider/output scope. Planning and model choice are separate functions but composed into the same saved output, hence partial target separation.

## Definition / Run Snapshot Finding

Definitions have independent versions. Run creation locks the selected definition and copies version/configuration; revising the recipe does not rewrite existing runs, as F verifies. Standalone runs need no automation. The Hub's preliminary reviewed-definition check can race queueing; it discloses a changed returned version and requires review of the actual frozen snapshot before planning, never automatically planning that mismatch. No supported snapshot-edit API exists. Unlike run_plans, definition_snapshot has no dedicated SQL immutability trigger: this guarantee covers supported service paths, not privileged direct SQL.

## Plan Immutability / Approval Finding

One immutable plan per run; DB blocks update/delete. Exact-input replay is historical, not renewed execution permission. Intake approval binds request identity, revision and complete proposal digest. Preparation's planDigest binds run ID, plan run-version and canonical complete saved plan including array order and routing/model metadata. Wrong digest/run/version, edited proposals and stale/nonqueued runs fail. Assignment/execution carry that digest and own scope/version checks. A future PM role can coordinate around these records but currently has no service or authority to rewrite them; roles/assignments have zero permissions and immutable scope snapshots.

Replanning currently means explicitly creating another run/plan or revising a reusable recipe for future runs. Versioned records/events provide a foundation but no automatic failure→replan, supersedes link, criteria carry-forward or protected-outcome change approval exists.

## Technical Verification Finding

Steps named typecheck/tests/build/browser/deployment-health can be represented with dependencies. Unknown check kinds stay unassigned/inert even when prepared as pending metadata. A workflow/python placeholder can identify future work but cannot execute checks. A model “check” step generates text; owner review records human acknowledgement. Neither is technical proof. Future verifiers need typed inputs/commands, scoped executor authority, exit/result/artifact evidence and criteria mapping before coding/build completion can be claimed.

## Dangerous Coupling

**No blocking planner-layer coupling detected.** Core graph validation/persistence does not depend on React, provider transport, executor launch or worker availability. React contains bounded sequence form construction, while backend revalidates. Planner deliberately composes pure Task/Model Router snapshots; that is partial boundary separation, not collapsed execution authority. Model snapshot time/availability metadata can expire; runtime rechecks independently. Future memory/context and component/capability lookup need explicit versioned pre-planning seams. Existing reusable definitions, agent/provider/executor catalogs and empty automation module are not a general component registry/recipe discovery engine. Memory remains NOT STARTED.

Current trace includes original source/revisions, interpreter version, saved plan/input, planning events, route reasons/model rejection reasons and review identities. It lacks structured requirement→step rationale or semantic completeness explanations; do not substitute hidden model chain-of-thought.

## Current Regressions

None identified against the documented current planning milestone. Missing general requirements, criteria, technical verifiers and replanning are future capabilities.

## Repairs Made

No runtime repair needed. Added this report and a workspace-only diagnostic script/results. Did not build a full Planner, requirements service, AI planner, parallel executor or memory integration.

## Validation Evidence

- `node --import tsx --test tests/planning.test.ts tests/execution.test.ts tests/model-router.test.ts tests/intake.test.ts tests/blueprint-core.test.ts tests/state.test.ts tests/automation-hub.test.ts tests/agent.test.ts`: **57 passed, 0 failed, 0 skipped**, exit 0. `agent.test.ts` is not a repository test filename; actual agent coverage was explicitly run separately below, not inferred from that argument.
- `node --import tsx --test tests/worker.test.ts tests/agents.test.ts`: **24 passed, 0 failed, 0 skipped**, exit 0. Controlled worker uses fixture transport, not real model inference. Includes scope/allowlist/output enforcement, dependency/review barriers, races, recovery, role/job/run binding and durable results.
- Total repository tests executed: **81 passed** across the two runs. These are focused embedded SQL/fixture contracts, not native PostgreSQL/live-provider evidence.
- `node --import tsx ../../work/planner-audit.ts`: **21 checks passed**, exit 0; `work/section11-planner-checks.json`. Pure graph/schema/routing/preparation blueprint checks: fork/join, reverse maximum chain, determinism, limits, malformed edges/cycles, forbidden policy/schema additions, unknown verifier kind, model metadata, digest identity/version/content and absence of implicit criteria/final-review requirements. No jobs dispatched.
- Source inspection: planner index/store/README; migration 002 and run schema; intake contracts carried forward; task/model routers; execution manager/adapters; scoped agents; worker validation; state snapshots; Hub sequence builder/editor; automation skeleton.

No runtime code changed. No fresh full suite, lint/typecheck/build, browser, native PostgreSQL, real inference, deployment or paid/external execution was performed. Existing previews/configuration were untouched.

## Future Planner Gaps

Goal-to-requirements derivation; typed constraints/assumptions/inputs/outputs; requirement coverage and acceptance criteria/evidence; appropriate granularity; technology-neutral capabilities and component lookup; optional validated AI proposals; bounded trusted memory context; PM coordination; parallel orchestration; technical verification jobs; versioned replanning/supersession and structured decision rationale. Current schema can be evolved with new versions and backward-compatible readers while preserving historical plans/digests.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Do not automatically implement it. Before later general planning work, define the requirements/acceptance/output contract and how it delegates to existing DAG validation, routers and independently authorized execution.
