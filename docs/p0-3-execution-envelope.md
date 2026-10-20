# P0.3 — Durable execution envelope

The envelope answers: **What exact work did Lee authorize LeeOS to remember and perform later?** It stores that answer before dispatch, independently of the browser connection. P0.4 will answer who claims it and executes it.

Reviewed contract → immutable capability plan → exact execution draft → preview/digest → explicit owner authorization → committed envelope and history event.

## What is durable

Each run can have one accepted, immutable envelope. Its server-generated ID and digest identify:

- The exact run/project, authorized run version, reviewed contract ID/revision/digest and complete contract snapshot.
- The immutable routing plan/digest and selected implementations, including their historical model eligibility decision.
- Ordered, versioned operations, exact literal input bytes or typed references to earlier text outputs, requirement scopes and explicit dependencies.
- Model ID/provider and an owner-requested model fingerprint pin, plus input/output token budgets and byte bounds.
- Required acceptance-source bindings, including exact `sourceStepKey` matches.
- Narrow grants, owner authority, grant expiry, no fallback, one authorized attempt per operation, zero spend and supported execution constraints.
- Stable operation identities derived from the accepted envelope ID and operation key. Losing a response must not create a fresh identity or renewed grant.

The draft is compiled on the server from the saved plan. Clients do not supply a replacement contract, routing registry, selected implementation, arbitrary permissions or executable code. The full request (including explicit acknowledgment and idempotency key) is stored with the accepted envelope. Owner API credentials are never part of that record. Events contain metadata/digests rather than duplicating prompts.

## The bounded operation contract

This first envelope version supports `text.generate` through the existing `llamacpp-local` / `leeos-local` implementation and `owner.review` as a request for a human to inspect text. The latter carries `owner:review-request`, **not permission to approve** the review. It cannot be completed automatically by accepting an envelope.

Named contractInputs capture the exact values for the reviewed contract input IDs. Required inputs must be supplied and referenced by an operation; unknown IDs and missing bindings are rejected. Literal text preserves whitespace exactly and is limited to 8 KiB. A text input can reference a captured contract input or the `text` output of another text operation in the same envelope, with an explicit dependency. References to another run, an unknown operation, a review decision, a file path or a URL are not input bindings. Graph cycles, duplicate operation keys, missing work for required capabilities/requirements, unsupported implementations and missing acceptance bindings block acceptance. The stable topological order preserves request order among eligible operations.

Text generation is bounded to the existing local adapter's maximum of 128 output tokens and cannot exceed the plan's output budget. Future dispatch must tokenize/check the resolved prompt against the persisted input budget and check the 8 KiB consumption limit; a large upstream output is not permission to exceed those limits. A text-parts input concatenates an explicit ordered list of literals, captured input references or output references with an exact separator. Fully known compositions are byte-checked at acceptance; dynamic compositions must be checked when resolved. There is no arbitrary templating, implicit source reading or code evaluation.

Owner-review bindings must point to a human-review operation scoped to the criterion's requirements, with references to relevant generated outputs. Job-result bindings must match the criterion's exact `sourceStepKey`. These are bindings for future evidence; no criterion is passed by creating them.

Supported execution constraints are explicit and closed: local execution, loopback network, no external effects, $0 maximum spend, an 8 KiB input bound and one authorized attempt per operation. Arbitrary prose constraints are retained in the reviewed contract but cannot be treated as enforced. Contracts with unresolved prose constraints are rejected by this version. They need supported, enforceable semantics before acceptance; a checkbox cannot override them. Required DOCX, file and delivery work also remains blocked by its unavailable routes/operation contracts.

## Authorization and readiness are different

Grant expiry is explicit, later than acceptance and no more than 24 hours ahead. The grant is scoped to this exact envelope. Matching retries return the same accepted work even after expiry, cancellation, document revision or revocation; they never renew authority. Different input, a different key or a changed review digest conflicts. A new authorization needs a new run and review.

A routing decision is historical. It may expire while the owner reviews the envelope or while accepted work waits for a worker. Acceptance does not claim current availability, reserve quota, verify a currently loaded model fingerprint, or refresh cost evidence. It can store authorized work after routing eligibility expires, with mandatory fresh eligibility checks before dispatch and no implementation fallback.

The model fingerprint is an owner-requested narrowing constraint (the Hub can load it from the existing read-only local inspection). Acceptance records it; it does not assert that a live model currently matches it. A future worker must verify the exact pin, provider/model, current quota/cost, resolved input bytes/tokens, grant expiry, revocation and run state before generating anything.

`dispatch.enabledAtAcceptance: false` records this slice's persist-only boundary. It is not a permanent revocation of accepted work. Dispatch permission at a later time must come from the independently enabled worker and fresh gates, rather than mutating the immutable envelope. The read model currently always reports `dispatchEnabled: false` and `workerStatus: "not-implemented"`.

## Hub flow

1. Create/review a structured contract, create an unplanned queued run, bind it, and save a P0.2 capability plan with covered mandatory routing. The lesson/DOCX example is still deliberately blocked.
2. Under **Durable execution envelope**, load the template. Replace the example text, inspect requirement/criterion scopes and dependencies, and set the intended expiry. The template is a starting point; complex contracts need explicit editing. A missing model fingerprint must be supplied from the intended local model inspection.
3. **Preview exact envelope**. The preview creates no record, grant, job or provider call. Resolve all blockers, then inspect the complete proposed record and its digest.
4. Check the exact authorization acknowledgment and **Accept and persist authorized work**. This commits the envelope and its event atomically. Nothing is dispatched.
5. Close/lock the Hub if desired. Reconnect, open the saved run, load its acceptance context and **Load accepted envelope** to recover the record from PostgreSQL. Saving the run ID is sufficient; prompts and browser-local state are not needed to reconstruct accepted work.
6. **Revoke authorization** records a permanent, append-only revocation with a reason. The original work remains available for inspection. Run cancellation also makes its authorization inactive. Reloading old work does not undo either action.

Prompts are now intentional durable owner data. Include these tables in the normal private database backup, rather than relying on source files or browser storage.

## API

All routes use existing local-owner authentication, origin/host protections, bounded strict JSON and no-store responses:

- `POST /api/v1/runs/:runId/execution-envelope/preview`: validate an `EnvelopeDraft`, return `canAccept`, blockers, candidate and digest. No persistent side effect.
- `POST /api/v1/runs/:runId/execution-envelope`: the same draft plus `idempotencyKey`, `reviewedEnvelopeDigest` and `acknowledgeAuthorization: true`. Returns the durable receipt only after commit.
- `GET /api/v1/runs/:runId/execution-envelope`: recover the accepted envelope for a run.
- `GET /api/v1/execution-envelopes/:id`: inspect by envelope ID.
- `POST /api/v1/execution-envelopes/:id/revoke`: exact digest, `acknowledgeRevocation: true` and a reason. Identical retry is read-only; a conflicting second revocation fails.

The request includes `expectedRunVersion`, `reviewedPlanDigest`, `grantExpiresAt`, `contractInputs`, `constraints`, `operations` and `acceptanceBindings`. The complete strict schemas live in `packages/core/src/execution-envelope/index.ts`. The Hub template supplies the supported JSON shape. Each operation has a key, kind, requirement IDs, dependencies and typed input(s); a text operation also has maximum output tokens and a model fingerprint.

Acceptance requires an unchanged queued run, its exact bound capability plan, covered required routing, no prepared jobs, a valid unexpired grant deadline and the exact compiled envelope digest. The run lock serializes acceptance, cancellation and revocation. Plan, contract and envelope hashes bind the relevant snapshots; read inspection verifies envelope integrity. A failed history write rolls the associated acceptance/revocation back.

## Migration and compatibility

Run `npm run db:migrate` against the intended configured database before using this slice. New additive migration **010_execution_envelopes.sql** adds `execution_envelopes` and `execution_envelope_revocations`, composite scope references, immutable triggers, a plan-version uniqueness constraint and zero-cost/persist-only checks. Readiness now requires ten migrations. No unknown working database is migrated automatically; migrations 001–009 are unchanged.

Existing P0.1/P0.2 data and legacy local jobs remain supported. V3 execution inspection now reports either `EXECUTION_ENVELOPE_REQUIRED` or `INDEPENDENT_WORKER_NOT_IMPLEMENTED`. Legacy preparation still rejects capability-plan snapshots even after an envelope is accepted. This prevents the old request-bound worker from accidentally consuming new durable grants.

Application version remains 0.18.1 / historical Structure 18; the manifest/system milestone is P0.3. There are no new package dependencies, paid services or active integrations.

## Validation and next slice

Validated on 2026-10-19:

- Lint, root/Hub typechecking and all 180 standard tests passed on the final implementation.
- All 104 native PostgreSQL integration tests passed, including eight envelope contracts covering concurrency, rollback, scope and policy enforcement.
- The focused envelope suite passed 11 tests, including additive migration 009 → 010 and clean-close database restore.
- The production Hub build passed. The final aggregate check's build phase first encountered a Windows EPERM creating a Next.js output directory; rerunning only npm run build with the required child-process filesystem permissions succeeded. No source change or test relaxation was used for that retry.

Acceptance checks include a lost HTTP response after commit, owner-client closure/reconnection, and database close/reopen with a fresh API/service instance. Exact named inputs, text bytes, dependency/output bindings, contract, routing plan, grants and operation identities survive. Matching retries cannot duplicate work or renew authority; cancellation/expiry/revocation remain visible. Unsupported work, unknown or unused required inputs, malformed graphs, source mismatches, policy widening and oversized resolved compositions fail closed. No jobs or model generations are produced by envelope acceptance.

Validation used disposable databases, fixture provider metadata and an injected owner HTTP transport. It did not run a real browser interaction, live inference or an independent worker. The disposable native PostgreSQL server was stopped after testing. Migration 010 has not been applied to an unknown configured working database.

P0.4 remains unimplemented: no claimant identity, worker process, lease, heartbeat, autonomous dispatch, attempt consumption, output resolution or uncertain-effect recovery is added here. It must consume this durable specification while enforcing its current authority and freshness gates. Goal acceptance remains pending until actual execution and required evidence succeed.

## P0.4 follow-up

[P0.4](p0-4-worker-ownership.md) supplies a separately started local worker, ownership leases/fences and conservative recovery; [P0.5](p0-5-remote-zero-cost.md) adds an optional remote host on the same queue. Current readiness requires migration 014. P0.3 bodies/grants remain immutable; worker state is separate. apiDispatchEnabled remains false: the browser/API never launches a worker. Earlier unimplemented-worker statements above describe the P0.3 delivery boundary.
