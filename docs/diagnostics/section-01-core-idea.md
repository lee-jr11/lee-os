# Blueprint diagnostics — section 1: the core idea

Audit date: 2026-10-18. Patch: 0.18.1. **Verdict: PARTIAL / DOES NOT PASS the complete blueprint.**

The blueprint says Lee supplies the goal and LeeOS determines the implementation across understand → remember → clarify → plan → cost → technology/AI selection → build/test/fix/deploy/run/monitor/learn. The inspected code delivers a narrower reviewed local-text pipeline. Passing its tests does not make the complete blueprint implemented. The earlier 18-structure completion covered that narrowed local baseline, not this full operating-system objective.

## Exact-code assessment

| Blueprint stage | Finding | Code evidence |
| --- | --- | --- |
| Understand | Partial: bounded verb/regex interpreter, not general goal reasoning | `packages/core/src/request-intake/index.ts`, `interpretRequest` |
| Remember | Partial persistence only: requests, revisions, runs and results survive; no goal-memory retrieval/injection | request-intake/store.ts; database migrations/001_state.sql contains a memories table, but no inspected core/API memory service |
| Clarify | Implemented within the bounded intake; business ambiguity persists and prevents approval | request-intake/index.ts and store.ts, `clarify`/`approve` |
| Plan | Partial: caller-supplied/owner-edited steps form a validated immutable dependency graph; no goal-to-implementation architect | orchestrator/index.ts `planInput`/`buildPlan`, orchestrator/store.ts |
| Check cost | Working guards for supported model/local calls; unknown/paid evidence fails closed. No general implementation-wide cost estimation | core/index.ts `assertZeroCost`; model-router/index.ts; provider-manager/service.ts |
| Select technology | Missing general selection: fixed mapping from already supplied step kind; workflow route does not choose GitHub Actions versus n8n | task-router/index.ts; executors/src/index.ts (metadata/prepare only, no launch method) |
| Select AI | Partial eligibility ranking when explicit capabilities/token scope and a trusted registry are supplied; default cloud registry inactive | model-router/index.ts; providers/src/index.ts; API `models/route`; local provider manager |
| Build | Missing runtime automation implementation/build subsystem | No build capability in task-router/executor catalog; generated text is not an installed implementation |
| Test | Missing runtime generated-solution test harness | Repository validation tests test LeeOS itself; they are not an automated goal-solution testing service |
| Fix | Missing runtime repair/retest loop | No repair/retest lifecycle in inspected orchestrator/worker |
| Deploy | Missing deployment executor/lifecycle | External launch deferred; no deployment capability in executor catalog |
| Run | Partial: owner-approved local text and owner-review jobs, with fencing/reconciliation | job-worker/index.ts; agent-manager; provider-manager |
| Monitor | Partial: explicit reads/history/checkpoints/receipts and optional bounded coordination polling; no general proactive solution monitor | API service, scheduler/index.ts, job-worker |
| Learn | Missing feedback-driven strategy selection/learning loop | Model usage persistence is accounting, not implemented learning |

Python, n8n, GitHub Actions and Lee360 are planned executor identities, not callable implementation choices. Gemini/Codex/Claude identities are inactive registry entries, not an active AI team. There is no general MCP discovery/selection/authorization runtime. Scoped job-agent records are not autonomous coding/reasoning agents.

## Concrete defects repaired in this section

1. Clarification told Lee to specify an executor. It now asks for the intended result, inputs and constraints and states the unsupported implementation boundary.
2. Compound goals such as “Draft a report and deploy it” could be treated as an ordinary text step. Compound build/test/fix/deploy/monitor/learn clauses now require clarification, including common punctuation/ampersand variants. This is a bounded rule fix, not general natural-language understanding. Educational text requests such as “Draft a deployment guide” remain valid text drafts.
3. Already persisted, unapproved rule drafts could retain an earlier unsafe interpretation. Approval now rechecks the saved rule goal under the current interpreter and rejects newly unresolved goals until explicitly clarified/reviewed. Immutable history is not rewritten. Existing approval receipts still replay before this check; owner-edited explicit plans retain their separate review path.
4. The Hub and system status now disclose bounded-text-only goal handling. The manifest explicitly tracks missing implementation selection, goal-memory retrieval, build/test/fix/deploy and learning. No missing feature was marked implemented.

These repairs introduce no dependency, migration, cloud call, external executor, automatic execution or new authority. Existing original request wording is preserved. Version 0.18.1 is a diagnostic bug-fix patch, not Structure 19 or completion of this blueprint.

## Outstanding architectural work

To pass this section, LeeOS still needs a connected goal/context interpreter, useful memory retrieval, a planner that derives implementation requirements, a verified tool/executor capability registry with actual adapters, an AI selection path driven by those requirements, and an artifact-based build/test/repair/deploy/monitor/feedback lifecycle. These must integrate with existing cost, state, approval and recovery boundaries. A regex expansion or an agent supplied by this coding session cannot stand in for those runtime features.

No new accounts, credentials, external providers or hosting were assumed or activated. This report keeps the section open as a feature-completeness gap while fixing the concrete defects safely. Later blueprint sections can refine the missing architecture without retroactively treating it as delivered.

## Validation

Regression coverage checks compound outcomes, outcome-based clarification, educational text requests and persisted legacy drafts. The shared intake contract checks that rejected requests create no run and executes on embedded/native PostgreSQL. Final results are recorded after validation below.

Final validation: 138 default tests and 73 native PostgreSQL checks passed. ESLint, sequential TypeScript checks and the production Next.js build passed. The offline install dry run passed; third-party lock records and all eight migrations match Structure 18. The browser saved the compound goal as needs-clarification and verified its approval button was disabled. No provider inference or external automation was executed. An initial legacy test fixture needed a transaction for deferred foreign keys; it was corrected. A typecheck overlapping generated-file rebuilding was rerun successfully after the build.
