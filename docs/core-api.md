# Core API v1 reference

All routes below use the local owner bearer token. Use the CLI to avoid typing credentials. The [OpenAPI file](../schemas/core-api.openapi.json) describes request fields and authentication.

| Method | Path after /api/v1 | Purpose |
| --- | --- | --- |
| GET | / or /system | Capabilities; execution remains disabled |
| GET / POST | /projects | List / create projects |
| GET / PATCH | /projects/{projectId} | Read / rename project |
| GET / POST | /projects/{projectId}/automations | List / create stored recipes |
| GET / PATCH | /automations/{automationId} | Read / revise a recipe |
| GET / POST | /projects/{projectId}/runs | List / request queued runs |
| GET | /runs/{runId} | Read a run and its original recipe snapshot |
| POST | /runs/{runId}/commands | Cancel, interrupt, or reviewed requeue |
| GET | /runs/{runId}/jobs | Read steps and checkpoint evidence |
| GET | /jobs/{jobId} | Read one step |
| GET | /projects/{projectId}/events | Read activity history |

List queries accept optional `limit=1..100` and `after=cursor`. Responses contain `data.items` and nullable `data.nextCursor`. Single-record queries accept no query parameters. POST/PATCH routes accept no query parameters.

## Request examples

```json
{"name":"Project","description":"Optional goal description"}
```

Project PATCH: `{"name":"Updated name"}`.

Automation POST: `{"name":"Recipe","definition":{"purpose":"A future task"}}`.

Automation PATCH: `{"expectedVersion":1,"definition":{"purpose":"Revised future task"}}`.

Run POST: `{"automationId":"auto_<uuid>","idempotencyKey":"manual-request-1"}`. Omit automationId for a project-only run. Keys use letters, digits, `.`, `_`, `:`, or `-`, up to 200 characters.

Cancel: `{"action":"cancel","expectedVersion":0}`.

Interrupt: `{"action":"interrupt","expectedVersion":1,"reason":"Worker loss inspected"}`.

Reviewed retry: `{"action":"requeue","expectedVersion":2,"acknowledgeExternalEffects":true}`.

Replace placeholder IDs with IDs returned by LeeOS. Real IDs have the entity prefix and a UUID v4. There is no generic status setter.

## Errors

| HTTP | Code / meaning |
| --- | --- |
| 400 | INVALID_REQUEST: wrong fields, IDs, cursor, or JSON |
| 401 | UNAUTHORIZED: missing/wrong owner credential |
| 403 | ORIGIN_REJECTED: wrong local origin, Host, or cross-site browser request |
| 404 | NOT_FOUND: unknown route/resource, including an automation outside the requested project |
| 405 | METHOD_NOT_ALLOWED: route exists, method unsupported; Allow lists supported methods |
| 408 | BODY_TIMEOUT: body read exceeded five seconds |
| 409 | STATE_CONFLICT: stale version, invalid transition, or idempotency conflict |
| 413 | BODY_TOO_LARGE: more than 64 KiB |
| 415 | JSON_REQUIRED: unsupported media type/encoding |
| 500 | INTERNAL_ERROR: sanitized unexpected failure |
| 503 | API_DISABLED / STORAGE_NOT_CONFIGURED / STORAGE_NOT_READY / STORAGE_UNAVAILABLE |

All JSON responses include a requestId and no-store/nosniff headers. 401 includes a Bearer challenge. HEAD has normal HTTP body suppression and is not a supported query method. OPTIONS does not grant cross-origin access.

No call in this reference dispatches a job or changes the zero-spend policy. The next execution layer must enforce its own capabilities, cost checks, and approval rules; possession of this local owner token is not a future worker credential.

## Structure 4 planning

`POST /api/v1/runs/:runId/plan` saves a deterministic, blocked plan for a queued run. `GET` on the same path reads its historical snapshot. POST requires `expectedRunVersion`, `goal`, and 1–50 explicit `steps`. See [Structure 4](structure-4.md) for the full contract and example. Invalid graphs return 400, different saved input or stale/nonqueued runs return 409, and missing records return 404. Identical POST replay returns 201 with the original snapshot. No dispatch or approval endpoints are exposed.

## Structure 5 model routing

`GET /api/v1/models/catalog` describes the default unconfigured providers. `POST /api/v1/models/route` evaluates strict capability/token requirements without storage access, writes, or model calls. Both use existing owner authentication. HTTP 200 can contain a blocked decision. Request bodies cannot provide a registry or cost assertions. Model plan steps may now include the same requirements in a `model` field. See [Structure 5](structure-5.md) for examples, evidence rules, and replay semantics.

## Structure 6 job preparation

`GET /api/v1/executors/catalog` returns disabled destination metadata without opening storage. `GET /api/v1/runs/:runId/execution` inspects the exact plan fingerprint, run version, dependencies and receipt. `POST` to the same execution path requires the strict review acknowledgement and prepares one immutable batch of pending jobs. New preparation and identical retries return 201. Wrong/stale fingerprints, versions, existing unmanaged jobs and conflicting retries return 409. Missing runs/plans return 404. Permissions must be empty; no start/dispatch endpoint is exposed. See [Structure 6](structure-6.md).

## Structure 7 agents

`GET /agents/catalog` reads descriptive templates without storage. `GET/POST /agents/roles` lists/registers immutable definitions; `GET /agents/roles/:roleId` reads one. `GET/POST /runs/:runId/jobs/:jobId/agent` reads/creates an assignment, `GET /runs/:runId/agents` lists the team, and `GET /agents/:agentId` returns its current lifecycle and historical receipt. `POST /agents/:agentId/commands` accepts only versioned dismissal. All paths are under `/api/v1` and owner-authenticated. New role/assignment creation and identical replay return 201; changed replay, stale lifecycle, incompatible roles or review scopes return 409. Missing roles, runs, prepared jobs or assignments return 404. Permissions must be empty. See [Structure 7](structure-7.md) for examples and pagination.

## Structure 8 local provider

`GET /providers/local` checks optional local readiness. `GET/POST /providers/local/calls` lists records or creates a bounded manual text-generation diagnostic, and `GET /providers/local/calls/:callId` reads one. `POST /providers/local/recover` requires a version and explicit server-restart acknowledgement. All are under `/api/v1` and owner-authenticated. Call creation/replay returns 201 with `data.status`; failed/interrupted diagnostics are recorded resources, not successful generations. Disabled configuration returns 503; held capacity, running duplicates and changed keys return 409. No caller-controlled endpoint, model, credentials or generation options are accepted. See [Structure 8](structure-8.md).

## Structure 9 controlled jobs

Under `/runs/:runId/jobs/:jobId`, `POST /execute` authorizes one local text generation, `GET /result` reads execution state, `POST /reconcile` accepts only `{}` and resolves saved provider state without inference, and `POST /review` records an explicit owner approval for a dependency-ready review step. All use the existing owner protections. Execute requires the extra server opt-in and both provider flags; review/reconcile perform no inference. Bodies, lifecycle, one-use semantics and recovery are documented in [Structure 9](structure-9.md). The `job-execution:` provider request-key namespace is reserved internally. Existing preparation and assignment receipts never become execution grants.

## Structure 10 coordination

Managed schedules and event subscriptions are created disabled under their project. Versioned enable/disable commands control them. The opted-in `POST /coordinator/tick` endpoint checks bounded batches and queues runs for owner review; it never dispatches jobs. `GET /coordinator` reports configuration only. Trigger receipts document queued, overlap and blocked outcomes. The explicit local CLI poller is started with `npm run coordinator -- once|watch`. See [Structure 10](structure-10.md) for bodies, routes, clock semantics and recovery.

## Structure 11 request intake

`POST /requests/preview` interprets bounded English without storage or inference. Project requests can be saved/listed at `/projects/:projectId/requests`. Read a request at `/requests/:requestId`, clarify it in English at `/clarify`, edit its explicit graph with PATCH, approve its exact current digest at `/approve`, or cancel it at `/commands`. Approval creates one queued run and immutable plan atomically; it does not grant execution or scheduling authority. Original wording and immutable revisions remain local. See [Structure 11](structure-11.md) for supported phrasing, strict bodies and state transitions.

## Structure 12 Hub client

The browser workbench calls these same owner endpoints with a memory-only bearer connection. It introduces no session cookie, server credential forwarding, new API or migration. Draft, preparation and per-job approvals remain separate and use the existing version/digest boundaries. See [Structure 12](structure-12.md) for the general workflow and limits, and the [corrected roadmap](roadmap.md) for scope.

## Structure 17 public setup inspection

`GET /api/setup` reports only bounded local configuration states and origin matching, without credential/address values or database access. It does not authenticate the owner or authorize any action. `GET /api/ready` remains the separate database readiness check. Both are no-store; the Hub requests them only on an explicit setup check. See [Structure 17](structure-17.md).

## Recorded run spend

Run DTO `spentUsd` is the PostgreSQL decimal sum of `model_usage.cost_usd` linked to that run. Reads, lists, create/replay and control responses use the same evidence subtotal; cancellation does not erase recorded charges. The legacy `runs.spent_usd` field is not the API's ledger source. This read model is not a cost estimate or proof of complete actual accounting. No linked usage records means no spend recorded in that subtotal, not proof that a dispatched/interrupted call consumed nothing. Inspect provider-call recovery/result records for unreconciled usage. Standalone calls without a run are outside that run's subtotal; no global reconciliation is implemented.


## Retained definitions and new work (Section 20 audit)

There is no public project/automation pause, archive, restore, delete or rebuild command yet. Status fields are not a complete lifecycle service. The backend nevertheless treats an archived project as unavailable for new automations, fresh intake requests, new intake approvals and new runs. Manual runs also reject paused/archived automation definitions. Managed trigger registration/enabling checks the parent project; polling records a blocked `PROJECT_ARCHIVED` receipt and disables an affected schedule/subscription when it observes that status. These decisions lock the project row so a concurrent status update cannot slip between the check and insertion.

Matching historical run, intake and approval replays remain readable after retirement. Existing queued/running runs, prepared jobs, agent assignments and scoped grants are preserved; archiving a parent is not run cancellation. Explicit run cancellation and agent dismissal retain their existing fencing rules. Project `paused`/`completed` states do not yet define a project-wide execution policy. Retained definitions may still be edited and listed.

Administrative SQL used by diagnostics is not a supported archive/restore API and emits no lifecycle event. A future restore command needs explicit generation/version fencing: an archive/restore cycle entirely between polls is not detectable from status alone. Existing trigger definition-version pins still reject a changed automation version. No storage or external resources are deleted by these guards.


## Integration enablement during preflight (Section 22 audit)

Local provider opt-in is rechecked immediately before dispatch after asynchronous model/token/context checks and database eligibility recording. Controlled jobs also recheck job/provider opt-in while reserving and validating their grant. If the running process observes either flag disabled before those checks, the pending call fails preflight without a completion request, releases its reservation, and retains its failure history. It is not automatically retried. Already dispatched calls still use the existing uncertain-result/reconciliation rules; disabling a flag is not a process-kill guarantee.

These checks do not introduce a dynamic settings endpoint or environment-file watcher. Runtime server environment flags remain authoritative for enablement; the placeholder database tool_registry does not activate adapters. Catalog selection and inert preparation metadata grant no execution authority.
