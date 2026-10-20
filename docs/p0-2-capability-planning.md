# P0.2 — Capability-first planning and routing

LeeOS now plans from a run's exact reviewed requirements snapshot. It identifies **what abilities are needed**, then asks the server-owned capability catalog which implementations can supply them. A goal that needs text, a document, storage and delivery no longer has to start with Python, n8n or a workflow engine.

This is a bounded deterministic planner over a structured, owner-reviewed contract. It does not infer arbitrary requirements from prose or search the internet for tools. The existing English intake and reusable text-sequence flows remain legacy manual planning paths; they do not automatically become capability-first plans.

## The chain

Reviewed requirements → immutable run binding → requirement/capability links → acceptance-check capabilities → implementation eligibility → immutable planning snapshot.

The planner preserves the complete bound contract: goal, requirements, inputs, outputs, assumptions, constraints, criterion parameters and evidence source step keys. It never substitutes the document's newest revision for the one bound to the run. If the document changes later, the old run keeps its old contract and plan.

## Link outcomes to capabilities

Requirements may now include `capabilityIds`, referencing the contract's declared `capabilities`:

```json
{
  "id": "lesson",
  "statement": "Generate lesson content from the supplied topic.",
  "required": true,
  "capabilityIds": ["text_generation"]
}
```

These links are part of the reviewed digest. Duplicated links and references to undeclared capabilities are rejected. The field is optional for P0.1 backward compatibility; a required requirement without links produces `REQUIREMENT_CAPABILITY_UNMAPPED` in P0.2. Create and review a new revision to add links; existing immutable bindings are never backfilled.

Coverage means an explicit owner-reviewed structural link, not proof that an implementation fulfills the requirement's meaning. Acceptance evidence remains independent. Required, linked capabilities block routing when unavailable. Optional-only gaps remain visible without blocking mandatory routing coverage. An unlinked contract-wide capability is conservatively required.

## Work and evidence capabilities

Declared work capabilities currently recognized are `text_generation`, `document_generation`, `artifact_storage`, `approved_delivery` and `owner_review`. Other IDs are permitted in a contract so gaps can be recorded, but receive `UNKNOWN_CAPABILITY`; technology names such as `python` do not become business capabilities or executable commands.

Acceptance kinds independently add check capabilities:

| Acceptance kind | Check capability |
|---|---|
| owner-review | owner_review |
| job-result | recorded_job_result |
| document-validation | document_validation |
| artifact-registration | artifact_registration |
| delivery-confirmation | delivery_confirmation |

Every need includes its requirement/criterion references and source. Work and verification cannot silently substitute for each other.

AI text needs delegate to the existing model router, scoped by the supplied input/output token budgets. Only server-sourced provider metadata is used. Existing configuration, capability, quota, freshness, capacity, account, zero-cost and no-paid-fallback checks all apply. The owner does not pick a provider in this planning request. If local model inspection is enabled, planning may perform its bounded read-only health/metadata probe; it never generates text or reserves a call. No model probe is needed for contracts without text generation or without a model budget. Missing budgets produce `MODEL_BUDGET_REQUIRED`.

Owner review and recorded-job verification have existing local implementations and no external API spend. Their selection does not assert that a human has reviewed anything or that a job result exists. Document, file and delivery implementations/verifiers remain unimplemented with unknown cost and explicit rejection reasons. Node/Python document alternatives are metadata only. GitHub Actions, n8n, remote services and Lee360 receive no launch authority from this slice.

## Use the Hub

1. Open **Outcome requirements and acceptance**. Create a contract with requirement `capabilityIds`, then review the exact revision. The [lesson contract example](../schemas/examples/lesson-requirements.json) includes links and expected document attributes; it is a declarative example, not a generator.
2. **Create or reopen unplanned run**, then bind the reviewed contract. Repeating that action reopens the same run. **Start another run** begins a new intentional creation key.
3. Load the run's acceptance if needed. In **Capability-first planning**, supply reasonable model token budgets and select **Plan from bound requirements**.
4. Inspect coverage, selected implementations, rejected candidates and remaining blockers. **Load saved capability plan** retrieves the historical decision without probing or selecting again.

A legacy run already has an immutable manual plan and cannot replace it with a capability plan. Use a new unplanned run. The legacy sequence editor cannot create a new manual plan on an already requirements-bound run; it must use the contract-driven path. Existing saved legacy plans, including P0.1 bindings, retain their prior behavior and do not acquire a requirement-coverage certification.

## API

`GET /api/v1/capabilities/catalog` exposes inert server-owned definitions. The existing owner authentication, origin/host checks, body limits and no-store responses apply.

`POST /api/v1/runs/:runId/plan` now accepts the additional strict request form:

```json
{
  "mode": "capability-first",
  "expectedRunVersion": 0,
  "reviewedRequirementsDigest": "<64 lowercase hex characters from the bound contract>",
  "modelBudget": { "inputTokens": 1000, "outputTokens": 500 }
}
```

`modelBudget` is optional; a text need without it stays blocked. Caller-supplied provider registries, execution permissions, technology choices, steps and cost-policy overrides are rejected. `GET /api/v1/runs/:runId/plan` returns the saved snapshot.

Creation requires an unchanged queued run with a reviewed binding, matching digest and no existing jobs. A run lock serializes competing plans, binding and run commands. Normalized matching retries return the saved plan without re-probing, including after cancellation or a requirements-document edit. Different input conflicts. Replanning or refreshing expired route evidence requires a new run; historical snapshots never turn into current permission. Plan and `run.planned` event commit atomically.

## Planning is separate from execution and acceptance

New snapshots use `plannerVersion: "3"`, `mode: "capability-first"`, and `routingStatus: "covered" | "blocked"`. Covered means every mandatory declared need has a selected eligibility snapshot and every required requirement has links. It does not certify arbitrary prose constraints, input availability, output chaining, or semantic compliance.

All P0.2 plans have `status: "blocked"`, `executionEnabled: false`, empty permissions/steps and `EXECUTION_ENVELOPE_REQUIRED`. Execution inspection reports this blocker with no job cards. Preparation rejects the new snapshot version before creating any jobs. Even a fully covered owner-only plan stays non-executable through this path.

P0.3 must construct and validate the ordered execution envelope: operations, dependencies, input/output bindings, structured constraints, evidence `sourceStepKey` resolution and downstream authority. Model eligibility must be checked again at execution time. P0.2 records no acceptance evidence, changes no run status, and never declares the goal achieved.

## Persistence and deployment

No new migration, package dependency or service is needed: P0.2 reuses immutable `run_plans` and P0.1's reviewed bindings. Database readiness still expects nine migrations. If P0.1 migration 009 has not been applied to the intended configured database, run `npm run db:migrate` before using the updated Hub. No unknown working database is migrated automatically. The application remains version 0.18.1 / historical Structure 18; system status and the manifest identify milestone P0.2.

## Validation

Validated on 2026-10-19:

- npm run check passed lint, root/Hub TypeScript, all 169 standard tests and the production Hub build.
- Native PostgreSQL integration passed all 96 tests, including seven P0.2 persistence/concurrency/API contracts.
- Focused capability planning passed all 12 tests; legacy execution/agent upgrade checks passed all 25 tests after their historical-data fixtures were corrected.
- Tests verify exact bound revisions after later edits, required/unknown capability blockers, model eligibility gates, concurrent duplicates/conflicts, immutable snapshots, rollback on history failure, read-only replay, and non-preparability even when routing coverage is complete. Existing P0.1 technical-success-with-pending-acceptance behavior still passes.

Validation used disposable databases and fixture eligibility/inference. No live AI generation, document/file/delivery integration, external execution or browser interaction was verified. The disposable native PostgreSQL server was stopped after validation; no configured working database was migrated. P0.3 remains a separate slice and is not implemented here.

## P0.3 follow-up

[P0.3](p0-3-execution-envelope.md) now persists exact authorized envelopes before dispatch. Current readiness requires migration 010 in addition to the nine recorded at P0.2 delivery. P0.2 routing snapshots remain immutable; acceptance does not create jobs or refresh their historical eligibility. Independent dispatch is still P0.4.
