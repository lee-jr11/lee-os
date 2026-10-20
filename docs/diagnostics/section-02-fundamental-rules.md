# Section 2 — Fundamental Rules diagnostic

Audit date: 2026-10-18. Implementation: 0.18.1, Structure 18. Diagnostic inspection and validation preceded this documentation change. No runtime code, dependencies, schema, configuration or execution permissions changed.

## Blueprint Section

The eight fundamental rules: goal first, automation first, dynamic technology selection, free first, PC independence, optional AI, disposable agents/persistent state, and verification over AI confidence.

## Overall Blueprint Verdict

🟡 **PARTIAL**. The reviewed local foundation is compatible with these rules, but the complete target capabilities are not delivered. Missing future capabilities are not regressions.

## Current Milestone Verdict

**Healthy for the documented reviewed local V1 milestone within the tested scope.** Structure 18 promises bounded text intake, reusable definitions, reviewed immutable plans, job preparation, scoped assignments, explicit local text execution and review, durable state, queue-only triggers and inspected recovery. Those paths passed the current contracts. General automation architecture, remote operation and generated-solution correctness are outside that acceptance scope. This is milestone acceptance, not LeeOS feature completeness or production certification.

The default preview currently has no database/owner configuration and all optional execution flags are off. Its health response proves liveness/defaults, not database readiness. Integration validation used a separate disposable PostgreSQL fixture.

## Capability Matrix

Statuses describe each full rule; narrower verified subcapabilities appear in evidence.

| Fundamental Rule | Status | Evidence | Expected Now? | Concern |
|---|---|---|---|---|
| Goal First | 🟡 PARTIAL | `request-intake/index.ts` keeps goal separate from steps and labels rules-v1; `blueprint-core.test.ts` and shared intake contract pass, including unresolved compounds and legacy approval fencing | Bounded goal intake yes; general implementation inference no | Owner must still supply supported prompts/explicit plans. Regex text interpretation is not general reasoning |
| Automation First | 🟡 PARTIAL | Shared acceptance, coordination and Hub contracts pass reusable definitions, versioned run snapshots, once/interval schedules and queue-only receipts | Reusable registration/queueing yes; automatic opportunity discovery no | No classifier of one-time/tool/automation/project/manual outcomes; no automatic promotion of repeated requests |
| Dynamic Technology Selection | 🟡 PARTIAL | Planning tests verify model/review/workflow/python/device metadata and blocked unknown routes; executor adapter is prepare-only; model-router eligibility tests pass | Explicit capability routing/model eligibility yes; autonomous tool selection/external launches no | Fixed kind-to-destination mapping is a scaffold, not technology selection; local text is the only live job adapter |
| Free First | 🟡 PARTIAL | Foundation rejects unknown/nonzero costs; model-router rejects paid/stale/unverified/wrong-account evidence and paid fallback; provider/worker contracts verify bounded opt-in local calls; SQL enforces ZERO_ONLY | Hard automatic $0 protection yes; general free-alternative discovery/approved paid paths no | Current supported cost boundary verified; no general search/estimate/partial-free planning service. Local endpoint policy trusts an operator-managed dedicated backend |
| PC Independence | 🟡 PARTIAL | Core has no Lee360 imports/runtime requirement; `postgres.ts` accepts a connection string; Lee360 is disabled metadata; API/coordination contracts run without a Lee360 service | Isolation from Lee360 yes; cloud service continuity no | Hub/API and the current model run on the host. Turning that host off stops them; no cloud execution or WAITING_FOR_RESOURCE worker lifecycle verified |
| AI Is Optional | 🟢 IMPLEMENTED + VERIFIED | Core state commands and scheduler commands directly transact state; API/intake/planning/coordination tests pass without an LLM; acceptance fixture counter stays zero until explicit text execution and unchanged through trigger/review controls | Yes for existing deterministic operations | Natural-language target resolution and some example controls such as automation pause are not implemented command surfaces; SQL fixture pause is not a user pause feature |
| Disposable Agents / Persistent State | 🟡 PARTIAL | Embedded close/reopen tests preserve state, checkpoints, agent-role snapshots, call/results and replay; native contracts pass transaction rollback, stale-worker fencing and result reconciliation | Durable current records and recovery fences yes; arbitrary replacement workers no | Agent manager is assignment metadata, not autonomous workers. Useful memory and general artifact-backed continuation remain future work; deployment/backup failure domains remain operator-managed |
| Verification Beats AI Confidence | 🟡 PARTIAL | Shared acceptance keeps run running until owner review; worker tests reject premature review and discard revoked late results; failed/uncertain calls cannot succeed jobs. `npm run check` chains lint/typecheck/test/build with &&; manual CI adds native PostgreSQL | Repository gates and controlled execution/review yes; generated technical solution verification no | Text-job success means accepted provider completion, not tested technical correctness. No runtime acceptance-test/build/repair/deployment-smoke lifecycle |

Core paths above are under `packages/core/src/`; shared contracts are under `tests/helpers/`. Executor/provider implementations are under `packages/executors/src/` and `packages/providers/src/`.

## What Is Already Working

- Original intent and immutable proposal revisions are stored separately from reviewed implementation steps; unresolved interpretation prevents approval.
- Reusable automation definitions remain distinct from run snapshots, plans, jobs and scoped assignment records.
- Current control operations bypass model selection/generation. Schedules queue reviewable work and grant no model authority.
- Paid/unknown candidate costs fail closed; no active cloud adapter or paid fallback was found in inspected execution paths.
- State, history and authorization receipts persist transactionally; restart/reconciliation tests avoid duplicate generation and fence stale workers.
- A model completion alone cannot finish the supported draft-plus-review acceptance flow.

## What Is Partial

Goal interpretation is bounded text rules, automation reuse is owner-driven, technology routing maps supplied kinds, and AI selection ranks supplied verified metadata. These are useful foundations rather than generalized reasoning. Persistent records are not useful memory retrieval. Current local durability is not PC-independent hosting. Repository tests are not a runtime verifier of generated solutions.

## What Is Not Started Yet

⚪ NOT STARTED: automatic automation-opportunity classification; general free-alternative discovery and approved paid implementation planning; remote Lee360 resource-wait/dispatch lifecycle; cloud execution continuity; runtime generated-solution acceptance testing/build/repair/deploy verification. These are future gaps, not current-stage bugs. General technology selection and memory retrieval remain incomplete as described in Section 1.

## Regressions / Actual Bugs

**No current-stage regressions detected.** This is a statement about inspected paths and executed tests, not proof that all possible defects are absent. Section 1 intake repairs were already present at audit start and passed again; they are not new Section 2 repairs.

### Current violations

No demonstrated current-milestone rule violation was found in the inspected supported paths. Local-only execution, manual plan editing and bounded text intake are disclosed limitations. They would contradict the target if presented as full dynamic automation or PC independence; they are not being counted as completed target capabilities here.

## Architecture Concerns

No demonstrated blocker requires replacement of the entire architecture. Several extension boundaries will need deliberate work:

- Task-kind routing and the metadata-only executor interface need a separately authorized execution contract; preparation must not silently become launch authority.
- The local provider protocol fixes `127.0.0.1:18081` and the controlled worker grants only `local:text`. Preserve that adapter's boundary when adding providers rather than exposing arbitrary endpoints through it. A local probe/fingerprint is not proof of backend binaries/weights or proof against an operator installing a billing proxy.
- The core/API shares the Hub process and the current coordination runner is local; there is no demonstrated independent cloud service. Configurable PostgreSQL is an extension point, not deployment evidence.
- Agent context, audit events, persistent state and useful memory must stay separate. Existing agent rows are scoped assignments, not an autonomous AI team.
- `succeeded` is a lifecycle result for the current job. Future technical tasks need persisted acceptance evidence before using it to claim technical completion.

### Completion-claim review

`docs/structure-18.md` explicitly narrows acceptance to local V1, and Section 1 now corrects broader claims. Wording such as “general-purpose” means domain-independent within the bounded supported workflows; it does not prove arbitrary implementation. The roadmap's stale release reference is corrected to 0.18.1. Structure completion, local milestone acceptance, generalized feature completion and LeeOS completion must not be conflated.

## Repairs Made

**No runtime repairs were necessary.** Documentation only: recorded this evidence-based audit and corrected the roadmap's stale release number/Section 1 failure wording. No new tests were added because existing behavioral contracts cover the inspected milestone paths; no future structure was built.

## Validation Evidence

Executed for this audit:

- `npm test`: **138 passed, 0 failed, 0 skipped**. Covers API/auth, bounded intake, cost gates, plans, assignments, provider/worker failures, deterministic controls, reusable automations, coordination, close/reopen persistence and local acceptance. Model generation uses fixtures; this is not a fresh inference-quality test.
- `npm run test:postgres`: **73 passed, 0 failed, 0 skipped** against native PostgreSQL on a disposable local fixture with an isolated generated schema. Fixture stopped after validation. Covers database constraints, rollback, races, saved results, recovery and the shared acceptance contract. It does not certify a full backup restoration or cloud failover.
- `npm run lint`: passed; `npm run typecheck`: passed (root TypeScript and Hub route generation/typechecking).
- Read-only localhost `/api/health`: version 0.18.1, structure 18, ZERO_ONLY, bounded-text-only and default execution disabled; planned external integrations remain planned.
- Read-only `/api/setup`: database and owner access unconfigured in the normal preview; local provider/job execution/coordination disabled. This is the normal safe preview state, not the configured disposable test environment.

No runtime source changed, so no new production build, browser mutation, real model inference, paid service, hosted CI run, cloud deployment, phone/OS lifecycle test or fault-injected host shutdown is claimed for this section. Prior Section 1 build/browser evidence is historical, not a newly executed Section 2 check. Existing `npm run check` and manual CI configuration were inspected but the complete aggregate command/hosted workflow was not executed here.

## Blueprint Gap

The current system aligns with the principles through explicit boundaries, persistent records and fail-closed execution. The target still needs goal-derived implementation planning, automation opportunity discovery, useful memory, actual alternative executors, independent hosting/resource management, and evidence-driven runtime technical verification. Documented future gaps do not make the local milestone broken.

## Recommended Next Build Step

Continue the remaining blueprint diagnostics before selecting a new numbered structure. The next implementation candidate is a reviewed capability/requirements planning layer that can distinguish deterministic, text, reusable and unsupported outcomes without launching them. It should precede general autonomous execution and retain cost/authority boundaries. This is a recommendation only.

The repository does not yet have `docs/blueprint.md`, `docs/implementation-status.md` or `docs/capability-matrix.md`. Recommend consolidating audited evidence into those after the section audits; no large documentation framework is created here.

## Final Section 2 Verdict

**Partially aligned with the full blueprint; healthy and aligned within the verified local milestone.** No evidence found of an active architectural direction that forces all future work through AI/local text/Lee360, activates paid usage, or relies on agent context as the sole durable state. Future capabilities remain explicitly open.
