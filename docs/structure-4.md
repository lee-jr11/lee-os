# Structure 4 — the planning desk

LeeOS now turns an accepted run request into a saved, reviewable plan. Think of Structure 2 as the filing cabinet, Structure 3 as its guarded counter, and Structure 4 as the planning desk behind that counter.

## What it understands today

You provide a goal and explicit steps. Each step has a permanent key within the plan, a title, a capability (`kind`), and optional dependencies. LeeOS validates the dependency graph, orders prerequisites first, and records where each step would go. It does not infer steps from English yet. Arbitrary automation definition JSON is not interpreted as a program.

| Kind | Intended destination | Current decision |
| --- | --- | --- |
| review | Lee, the owner | Await human review; no automatic execution |
| model | Future model router | Blocked until model selection and verified free capacity exist |
| workflow | Future GitHub Actions/n8n adapter | Blocked; adapter not configured |
| python | Future Python executor | Blocked; adapter not configured |
| device | Future Lee360 executor | Blocked; adapter not configured |
| Anything else | Unassigned | Blocked; unsupported capability |

All plans have `executionEnabled: false`, `costPolicy: ZERO_ONLY`, and `status: blocked`. These are planning decisions, not a price quote or a claim that an external service is free. Even a human-review-only plan stays blocked for automatic dispatch. A goal or title containing commands remains text.

## Try it without setup or spending

From the repository folder run `npm run plan:demo`. It creates a temporary project/run and prints a report-planning example. It uses an in-memory test database, discards the data, and makes no model or external workflow calls.

For persistent use, follow the existing database/API setup in Structure 3, apply `npm run db:migrate`, and start the Hub. The new migration is `002_plans.sql`; `001_state.sql` is unchanged. Readiness requires both migrations.

Create a project and queued run using the existing CLI. Save this JSON as a local request file, replacing no fields inside the example:

```json
{
  "expectedRunVersion": 0,
  "goal": "Prepare and review a report",
  "steps": [
    {"key":"draft","title":"Draft report","kind":"model"},
    {"key":"review","title":"Lee reviews report","kind":"review","dependsOn":["draft"]}
  ]
}
```

Then call `npm run leeos -- POST /runs/RUN_ID/plan --json-file PATH_TO_FILE`, substituting the real run ID and file path. Read it with `npm run leeos -- GET /runs/RUN_ID/plan`. Credentials stay in the existing private environment files. The Hub UI has no new planning form in this structure.

## What happens inside

1. Existing owner authentication and bounded JSON validation protect the endpoint.
2. The planner rejects duplicate keys, missing/self/duplicate dependencies, cycles, empty graphs, unknown fields, and more than 50 steps.
3. The router selects an intended destination using a closed capability map. Unknown capabilities remain blocked.
4. A transaction locks the run, checks it is queued at the supplied version, and saves both the immutable plan and its history event.
5. No job, approval, agent, provider call, or external execution is created. The run remains queued with the same version.

One plan belongs to one run. An identical normalized request replays the original snapshot, including after cancellation; this is historical information, never renewed permission to act. A changed goal, step, order, or expected version conflicts. Create a new run to plan again. The stored snapshot contains planner version 1 and the run version at planning time; it is not a live view of the run. Concurrent requests serialize on the run lock. A failed event insert rolls back the plan too.

Database triggers prevent ordinary updates/deletes of plans. As with event history, a database administrator can bypass those protections; this is not a tamper-proof ledger.

## Where to look

- `packages/core/src/orchestrator`: request graph validation, deterministic plan construction, transactional persistence.
- `packages/core/src/task-router`: capability decisions without side effects.
- `packages/database/migrations/002_plans.sql`: immutable plan storage.
- `tests/helpers/planning-contract.ts`: shared embedded/native database checks.
- `schemas/core-api.openapi.json`: API reference; runtime Zod contracts remain authoritative.

## Structure 5

Next is the model-router/provider foundation: capability metadata, availability and verified-zero-cost eligibility, with deterministic selection tests. Live provider calls and external execution need their own later implementation. Stop here until Lee chooses to continue.
