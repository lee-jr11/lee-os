# P0.1 — Versioned requirements and acceptance criteria

The contract describes **what must be true**, rather than choosing technologies or executing work. A provider/job/run can succeed while the goal assessment remains pending. P0.1 is an opt-in addition to the verified local workflow; legacy runs without a contract have no goal assessment, never an implied pass.

## What is implemented

- Project-owned contracts with stable `reqs_` UUIDs and immutable numbered revisions.
- Goal, requirements, inputs, outputs, assumptions, unresolved questions, constraints, neutral capability labels and acceptance criteria. `ZERO_ONLY` is fixed.
- Criteria may include bounded machine-readable `expected` scalar attributes, such as `format: "docx"`, `font_family: "Times New Roman"`, `body_font_size_pt: 12`. These are reviewed expectations for the future verifier kinds, not instructions or proof. The current owner-review/job-result kinds have fixed semantics and reject nonempty expected attributes rather than silently ignoring them. A future verifier must interpret its own supported attributes; P0.1 never evaluates arbitrary code or routes tools from them.
- Every required requirement must be covered by a required criterion. IDs must be unique, references valid, and at least one requirement/criterion required.
- Explicit owner review of the exact revision digest. Unresolved questions block review. Reviewing creates no run, agent, job, schedule or permission.
- Immutable binding of one current reviewed revision to one unchanged queued run **before preparation or any jobs**. Same-project constraints and current revision/digest/run-version checks apply.
- Separate per-run acceptance evidence and a derived assessment. Evidence is append-only and versioned per criterion; owner corrections retain older observations.
- Existing authenticated Hub/API controls, transactional events and stale/idempotency checks remain authoritative.

## Understand the three statuses

`runStatus` describes existing technical execution. `criteriaStatus` is pending, not-met or met for required criteria. `goalStatus` is pending, not-achieved or achieved.

Goal is achieved only when the bound contract's required criteria are met **and** the technical run succeeded. A failed/cancelled run or required not-met criterion means not-achieved. Optional criteria do not block. Recording evidence never changes technical run status or execution permissions. A goal assessment is a current derived read model, not an immutable automatic completion event; later owner corrections can change it and keep their history.

Evidence provenance matters: `owner-review` is explicitly a local-owner attestation, not machine verification. `job-result` checks the exact declared step key and recorded terminal job result in the bound run; the caller cannot submit its outcome. That proves a technical result exists, not that content is correct or a file was delivered. `automaticVerificationComplete` is true only when every required criterion is met through a recorded job-result source; it does not claim semantic document/delivery verification.

Document-validation, artifact-registration and delivery-confirmation are valid **declared expectations**, but their verifiers are unavailable in P0.1. Their criteria remain pending. Owner notes, model text, fake delivery JSON or a successful unrelated job cannot satisfy them. The sample lesson contract is declarative only; it generates no lesson or file.

## Use it in the Hub

1. Unlock the existing local owner connection and choose a project.
2. In **Outcome requirements and acceptance**, start a new contract. The first editor exposes the contract JSON directly; plain-language interpretation/planning is a later slice.
3. Save the draft, resolve questions by saving a new revision, and review its exact saved requirements/criteria.
4. Select a queued run and bind that reviewed revision before preparing jobs. Existing intake-approved runs may already have a saved plan; P0.1 does not claim that plan was generated from or verified against the requirements.
5. Continue the existing reviewed execution workflow. Load acceptance separately; technical success will not fill missing evidence automatically.
6. Record a personal observation for owner-review criteria or reference the declared step's recorded job result. The server derives job-result outcomes. Unsupported verifier kinds have no override button.

The panel loads saved contracts/read models explicitly; it does not run a watcher. Reopening the Hub clears unsaved edits/checkboxes as before. Saved revisions/bindings/evidence survive clean close/reopen. Use the API for older revisions and collection pagination. Current assessment returns the latest evidence per criterion; complete append-only evidence history is retained in PostgreSQL, without a new history-browser service in this slice.

## API

All endpoints use the existing local-owner bearer/origin protection, strict JSON/body limits and safe error mapping.

- `GET/POST /api/v1/projects/:projectId/requirements`: paginated collection or create `{idempotencyKey, content}`.
- `GET/PATCH /api/v1/requirements/:id`: read current revision or save `{expectedRevision, content}` as a new revision.
- `GET /api/v1/requirements/:id/revisions/:revision`: inspect an immutable historical revision.
- `POST /api/v1/requirements/:id/review`: `{revision, reviewedDigest, acknowledgeRequirementsReview:true}`.
- `GET/POST /api/v1/runs/:runId/requirements`: inspect bound assessment or bind `{requirementsId, revision, reviewedDigest, expectedRunVersion, acknowledgeBinding:true}`.
- `GET /api/v1/runs/:runId/acceptance`: coherent current technical/criteria/goal assessment.
- `POST /api/v1/runs/:runId/acceptance/evidence`: one of the evidence inputs below.

Owner observation:

```json
{
  "kind": "owner-review",
  "criterionId": "owner_check",
  "expectedEvidenceVersion": 0,
  "idempotencyKey": "observation-1",
  "outcome": "met",
  "note": "I checked the requested outcome.",
  "acknowledgeOwnerReview": true
}
```

Recorded result:

```json
{
  "kind": "job-result",
  "criterionId": "content_recorded",
  "expectedEvidenceVersion": 0,
  "idempotencyKey": "result-1",
  "jobId": "job_12345678-1234-4234-8234-123456789abc"
}
```

Job-result criteria must declare `sourceStepKey`; other kinds must not. Requesting a future verifier through the evidence endpoint is rejected, not trusted. The illustrative job ID above must be replaced by an actual prepared job in the bound run. Capability strings and descriptive constraints are inert declarations, not routing or runtime policy overrides.

A create key is scoped to a project. Matching retries reopen the current contract; changed input under the same key conflicts. Review retries return the recorded revision. Binding retries preserve the old binding even after the document or run moves on; a new binding may only use the current reviewed revision. Evidence keys are scoped to a run: matching retries add no fact and return its current assessment, changed requests conflict, and corrections require the latest evidence version plus a new key. API authorization is not a general signed approval token.

Revising a reviewed contract produces a new draft/digest. New runs cannot bind its old review; old run bindings continue to assess the immutable old revision. Cross-project binding/results and binding after preparation are rejected. Archived projects cannot create new contracts; retained contract edits/reviews/bindings follow existing retained-run semantics and do not restore execution authority. Cancelled runs cannot receive new evidence (matching old-key replay remains read-only).

## Persistence and deployment

`009_requirements.sql` adds five tables: requirements_documents, requirements_revisions, requirements_reviews, run_requirements and acceptance_evidence. References are scoped/composite where relevant; reviews, revisions, bindings and evidence are append-only. Mutable document identity is protected while current revision advances once. Required history events share the write transaction; event failure rolls back the associated state.

Run the existing `npm run db:migrate` against the intended configured database before using the updated app. Readiness now expects nine migrations. This implementation does not automatically migrate an unknown working database. Existing eight-migration data is preserved by the additive upgrade. Back up/restore these tables with their linked runs/plans/jobs/results/events as one consistent database; a source checkout or root manifest is not a live-data backup.

## Boundaries and next slice

P0.1 does not generate requirements with AI, route capabilities, create a durable execution envelope/worker, generate documents, store files, deliver email or execute recurring work. The existing Planner/worker is not yet driven by this contract. Binding therefore does not certify plan coverage; P0.2 must consume this reviewed contract when it plans/routes. Existing runs remain compatible and unbound ones are explicitly unassessed.

The application version stays 0.18.1 / historical Structure 18; the root manifest and system status identify implementation milestone **P0.1**. No additional structure/audit number is introduced. The next slice is P0.2 only after this slice's validation and Lee's go-ahead.

## Validation

Validated on 2026-10-19: npm run check passed lint, TypeScript, all 157 standard tests and the production Hub build. Native PostgreSQL integration passed all 89 tests, including the P0.1 contract cases. The shipped lesson example parses with four requirements and four criteria. Tests cover additive migration, immutable history, stale revisions, concurrency, scoped binding/results, replay, rollback and technical-success-with-pending-goal behavior.

Validation used disposable databases and recorded fixtures; no live AI, document generation, delivery or browser interaction was verified. The disposable PostgreSQL server was stopped afterward. The intended working database still needs npm run db:migrate before using the new Hub flow.


## P0.2 follow-up

P0.2 now consumes bound contracts for new capability-first plans. Optional requirement capabilityIds links are included in the reviewed digest; missing links remain compatible with P0.1 storage but block P0.2 mandatory coverage. Existing revisions/bindings are unchanged. See [the P0.2 guide](p0-2-capability-planning.md) for the new path and its execution boundary. Earlier next-slice statements above describe P0.1 at delivery.
