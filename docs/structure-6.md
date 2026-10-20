# Structure 6 — from a reviewed plan to pending jobs

Structure 4 made the plan. Structure 5 checked possible models. Structure 6 adds the execution-manager foundation: a guarded way to turn the exact reviewed plan into a recorded batch of pending jobs.

Think of it as preparing work orders. Each work order names its step, prerequisites and intended destination. Preparing it does not start the work.

## What each piece does

| Piece | Purpose |
| --- | --- |
| Execution inspection | Shows the plan fingerprint, current run state, dependencies, and whether preparation is allowed |
| Review-bound preparation | Requires the owner to acknowledge the exact saved plan and run version |
| Local preparation adapter | Copies plan metadata into job blueprints without interpreting instructions |
| Preparation receipt | Permanently records the reviewed fingerprint, initial job IDs, and zero launch permissions |
| Prepared job mapping | Binds each job to its run, step and immutable blueprint |
| Existing state store | Preserves job states, cancellation, checkpoints and attempt fencing for future controlled workers |

The external executor catalog contains GitHub Actions, n8n, Python and Lee360 as disabled/unconfigured destinations. Workflow jobs list GitHub Actions and n8n as candidates; the system does not guess which one is configured. Model jobs point toward future provider execution; review jobs point toward Lee. Unknown capabilities remain unassigned and blocked.

## The permission boundary

Only `mode: prepare-only` with `permissions: []` is accepted. The API cannot grant network access, filesystem access, shell commands, model calls or device control. There is no start-job or start-run command. Every blueprint and receipt explicitly reports `executionEnabled: false`.

Preparing jobs is allowed even when the saved plan has blocked model or executor steps, because it only records work orders. Those blockers are not cleared. Titles remain text, even when they contain code or commands. The existing model decision is historical and cannot authorize a call.

The receipt records the authenticated owner's assertion that the plan was reviewed; a checkbox or fingerprint cannot prove a human read it. This is a single-owner preparation acknowledgement, not a multi-user approval system, signature or execution permit.

## Try the local demonstration

From the repository folder run `npm run execution:demo`.

It creates a temporary plan, inspects its fingerprint, prepares two pending jobs, retries without duplication, and cancels the run. Cancellation closes both pending jobs. All data is discarded. No model, workflow, script or device action runs.

## Persistent use through the owner API

Apply `npm run db:migrate` after the existing local database/API setup. New migration `003_preparations.sql` adds preparation receipts and job mappings. Earlier migrations remain unchanged. Readiness requires all three migrations.

Create a queued run and save its plan through the existing routes. Then:

1. Read it with `npm run leeos -- GET /runs/RUN_ID/plan` and review its content.
2. Inspect `npm run leeos -- GET /runs/RUN_ID/execution` to obtain `planDigest` and `runVersion`.
3. Save the JSON below to a local file, substituting that digest and current version.
4. Submit `npm run leeos -- POST /runs/RUN_ID/execution --json-file PATH_TO_FILE`.
5. Read current job states with `npm run leeos -- GET /runs/RUN_ID/jobs`.

```json
{
  "expectedRunVersion": 0,
  "reviewedPlanDigest": "REPLACE_WITH_64_CHARACTER_DIGEST_FROM_INSPECTION",
  "acknowledgePlanReview": true,
  "mode": "prepare-only",
  "permissions": []
}
```

`GET /api/v1/executors/catalog` requires the existing owner authentication but no database. The execution GET/POST routes require the database. Existing loopback/Host/Origin controls, strict JSON input and request size/time limits apply. No extra credentials or provider accounts are needed. The Hub has updated milestone text and no new preparation form.

## What preparation guarantees

The fingerprint is SHA-256 over the run ID, plan's recorded run version, and complete saved plan. Object property order does not affect it; step order and content do. A fingerprint from another run cannot acknowledge this run.

A transaction locks the run before checking its plan, version, jobs and existing receipt. New preparation requires a queued run at the exact reviewed version, the same plan version, a matching digest, and no existing jobs. A run that was interrupted and requeued has changed version and must be replanned in a new run.

The manager validates supported planner versions 1 and 2 and the saved dependency graph, then creates all job IDs, receipt, mappings, pending jobs and history together. A failed job or event write rolls everything back. Concurrent identical requests serialize and return the same receipt. Existing unmanaged jobs block preparation rather than being silently adopted.

The run remains queued at the same version, job attempts remain zero, and no cost is recorded. The internal state store also refuses to start a preparation-only run or append unreviewed jobs to its batch. Job dependencies are immutable metadata. Inspection reports `dependenciesSatisfied`; it never labels a job executable. A root step may have satisfied dependencies while still being blocked for dispatch.

## Recovery and history

An identical request replays the original receipt, including after cancellation. A changed request conflicts. Replay does not recreate, reset or start jobs. Current states appear separately in execution inspection and the existing jobs endpoint; receipt `initialStatus` records what was created originally.

Cancellation uses the existing versioned run command and closes pending jobs atomically. A cancellation racing with preparation either prevents the batch or closes the whole prepared batch. It cannot leave an active partial batch. Receipts and job blueprints survive clean-close snapshot restore; ordinary SQL updates/deletes are rejected by triggers. Database administrators can bypass such protections.

Existing internal state-store methods and tests cover interruption, checkpoints, attempt fencing and explicit recovery. They are trusted low-level building blocks. They now reject starting preparation-only runs or extending reviewed batches; a complete live-execution permission gateway remains future work. No background worker or automatic retry is introduced here. Future workers must enforce the preparation mode and permissions, dependencies, owner authorization, current model eligibility, capacity reservation and actual token/cost limits before any dispatch.

## Where to look

- `packages/core/src/execution-manager`: fingerprinting, review contracts, inspection and atomic preparation.
- `packages/executors/src/index.ts`: disabled destination catalog and side-effect-free preparation adapter.
- `packages/database/migrations/003_preparations.sql`: immutable receipts/mappings and job/run foreign keys.
- `tests/helpers/execution-contract.ts`: shared embedded/native database checks, races and rollback.
- `tests/execution.test.ts`: fingerprint, permission, adapter, upgrade and durable receipt checks.

## Structure 7

Next is the agent-manager foundation: registered roles, scoped assignments and permission checks. Live agents, model calls and external execution remain separate later work. Stop after Structure 6 until Lee gives the go-ahead.
