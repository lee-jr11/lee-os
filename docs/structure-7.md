# Structure 7 — roles and scoped agent assignments

A role is a reusable job description. An assignment says which role belongs to one prepared job in one run. Structure 7 gives LeeOS that directory and those assignment records; it does not start an AI process.

Think of Structure 6 as preparing work orders. Structure 7 puts a named responsibility on a work order, with no permission to perform it yet.

## What was built

| Piece | What it does |
| --- | --- |
| Agent templates | Describe example responsibilities without registering or running anything |
| Immutable role registry | Saves owner-defined names, purposes, supported step kinds and empty permissions |
| Scoped assignment | Links one role snapshot to exactly one prepared job and run |
| Team inspection | Shows original assignment plus current agent, job and run states |
| Dismissal lifecycle | Allows an owner to dismiss an assignment and automatically dismisses it on run cancellation |
| Database boundary | Preserves role/assignment history and prevents managed agents gaining scope, tools or working status |

Templates include a writing assistant, a quality reviewer and a workflow coordinator. A quality-reviewer template supports a future **model** step that checks content. It cannot replace the separate **human review** step. Template IDs are labels, not registered role IDs.

Registered roles are owner-wide and reusable across projects. Roles can describe `model`, `workflow`, `python` or `device` work. Supporting a step kind is descriptive eligibility, not permission to call a model, run a tool or control a device. The owner registers a template's fields or a custom definition explicitly. No automatic team assembly or model-based role selection is introduced.

## Try the demonstration

Run `npm run agent:demo` from the repository folder.

It registers a temporary writer role, prepares a report plan, assigns the draft job, retries without duplication, then cancels the run. The team inspection shows the assignment as dismissed. Human review remains with Lee. No agent process, model call, tool access or spending occurs; demo data is discarded.

## Persistent owner workflow

Follow the existing local database/API setup, apply `npm run db:migrate`, and start the Hub. Migration `004_agent_assignments.sql` adds role/assignment records, lifecycle versioning and scope guards. It preserves the earlier plan and preparation tables. All four migrations are required for readiness.

1. Read `npm run leeos -- GET /agents/catalog` for descriptive templates. This endpoint needs owner credentials but no database.
2. Register a role with `npm run leeos -- POST /agents/roles --json-file ROLE_FILE`.
3. Create a run, save its plan, inspect and acknowledge that plan, and prepare jobs as described in Structure 6.
4. Read `/runs/RUN_ID/execution` and `/runs/RUN_ID/jobs` for the reviewed fingerprint, current run version and prepared job ID.
5. Assign the role using `POST /runs/RUN_ID/jobs/JOB_ID/agent` and an assignment JSON file.
6. Inspect `/runs/RUN_ID/agents` or `/agents/AGENT_ID` for current team state.

Example role file:

```json
{
  "name": "Writing assistant",
  "purpose": "Prepare a draft for Lee to review.",
  "stepKinds": ["model"],
  "permissions": [],
  "idempotencyKey": "writer-role-1"
}
```

Save the returned `role_...` ID. Role registration is idempotent by key: the same normalized request returns the same definition; changed content under that key conflicts. Names are not unique identifiers. Definitions are immutable version-1 records; create a new role/key to change a definition. Display names and purpose text are never interpreted as code or executed prompts.

Example assignment file, substituting real values:

```json
{
  "roleId": "REPLACE_WITH_ROLE_ID",
  "expectedRunVersion": 0,
  "reviewedPlanDigest": "REPLACE_WITH_DIGEST_FROM_EXECUTION_INSPECTION",
  "mode": "assignment-only",
  "permissions": []
}
```

Submit it with `npm run leeos -- POST /runs/RUN_ID/jobs/JOB_ID/agent --json-file ASSIGNMENT_FILE`.

A new assignment requires the exact run/job scope, a pending prepared job with zero attempts, a queued run at the reviewed preparation version, a matching plan digest and a role supporting that job's kind. Unprepared jobs, foreign-run jobs, wrong fingerprints, incompatible roles and human-review steps are rejected. Only one assignment is allowed per job in this milestone, including after dismissal. Reassignment requires a new run; a versioned reassignment protocol is future work.

## Inspect and dismiss

- `GET /agents/roles` and `/agents/roles/ROLE_ID` read registered definitions.
- `GET /runs/RUN_ID/agents` lists the run's scoped assignments.
- `GET /runs/RUN_ID/jobs/JOB_ID/agent` reads the exact job assignment.
- `GET /agents/AGENT_ID` reads the same assignment by permanent agent ID.
- `POST /agents/AGENT_ID/commands` accepts only dismissal:

```json
{"action":"dismiss","expectedVersion":0}
```

List endpoints accept `limit` (1–100; default 25) and `after` permanent-ID cursors. They order by ID, not creation time. Agent IDs use `agent_...`; role IDs use `role_...`.

The original assignment records `initialStatus: planned`, a full role snapshot, the reviewed fingerprint and empty permissions. Inspection returns current status/version separately, along with current job/run states. Dismissal changes the agent from `planned` version 0 to `dismissed` version 1; stale commands conflict. Dismissing an agent leaves its pending job unchanged.

Identical assignment POST replay always returns the historical receipt, including after dismissal or cancellation. It never reactivates an agent. Changed assignment input conflicts. Replay is distinct from current team inspection.

## Permissions and lifecycle guarantees

Only `mode: assignment-only` and `permissions: []` are accepted. Caller-supplied provider/model IDs, execution flags, tool grants and start commands are rejected before database access. Every assignment reports `executionEnabled: false`. Agents have no per-agent token or credentials in this milestone; all endpoints remain owner-only. Scope records are the foundation for future access controls, not a running-agent sandbox.

Registration commits its definition and event together. Assignment locks the run and commits the scoped agent, mapping, role snapshot and event together. A history-write failure rolls back all those records. Concurrent duplicate requests return one assignment. Foreign keys prevent a job or scoped agent from being attached to a different run.

Database triggers reject updates/deletes of role definitions and assignment records. For assigned agents they reject scope/permission/provider/model changes, working status, and restarting a dismissed agent. Only versioned planned-to-dismissed lifecycle changes are permitted. These guards apply to ordinary SQL; administrators can bypass them.

Run cancellation closes pending jobs and dismisses its scoped planned agents in one transaction with history. A failed dismissal event restores the whole run, jobs and agents. Races with assignment or manual dismissal cannot leave a planned scoped agent on the cancelled run or increment dismissal twice. Existing preparation-only start/append guards remain in force. Existing legacy unscoped agent rows are preserved; the new owner API exposes scoped assignments only.

There are no role-edit, grant, agent-start, automatic reassignment, provider-call, delegation, worker or automatic retry endpoints. The Hub layout is unchanged apart from its milestone text.

## Where to look

- `packages/agents/src/index.ts`: role contracts and descriptive templates.
- `packages/core/src/agent-manager`: assignment/dismissal requests and transactional role/team management.
- `packages/database/migrations/004_agent_assignments.sql`: durable roles, mapping constraints and lifecycle boundaries.
- `packages/database/src/state.ts`: atomic dismissal when a run terminates.
- `tests/helpers/agent-contract.ts`: shared embedded/native database checks, concurrency and rollback.
- `tests/agents.test.ts`: input boundaries, additive upgrade and clean-close persistence.

## Structure 8

Next is the live-provider connection foundation: choose a supported provider, establish real account-specific availability and zero-cost evidence, and add a controlled model-call path that cannot silently fall back to paid usage. Actual availability and pricing must be verified during that build. A provider that cannot meet the zero-cost policy must remain blocked. Stop here until Lee approves the next structure.
