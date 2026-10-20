# Structure 3 — Core API & Commands

Structure 2 gave LeeOS its filing system. Structure 3 is the service counter: requests now pass through access checks and validation before they change those records. The Hub layout is unchanged. Its structure label/version now reflects this build.

## Follow one request

```text
Operator CLI / future Hub controls
            |
       /api/v1 request
            |
Local origin + private owner token
            |
Strict fields, bounded JSON, valid IDs
            |
Core service: project / automation / run command
            |
State store: transaction + event history
            |
       PostgreSQL
```

The API adapter lives in `apps/hub`, but the commands live in `packages/core/src/api`. This keeps business rules available to future workers and adapters without tying them to Next.js. The public core entry remains small; the server-side API has its own `@leeos/core/api` entry. Internal service calls are trusted server code, not an alternative public authentication mechanism.

A **command** asks for a change. A **query** reads the result. For example: create a project, request a run, cancel a queued run, then read its events. These are state changes only. A queued run is a record waiting for a future executor; it does not invoke a provider, start a process, spend money, or send a notification.

## Try the core without configuration

```sh
npm ci
npm run api:demo
```

The demo uses the same authenticated HTTP handler and core service over an in-memory PostgreSQL engine. It makes no network requests. A temporary owner credential exists only inside that process and is not printed. It creates a sample recipe/run, proves duplicate requests reuse the run ID, cancels the run, and reads the event history. Nothing is saved by this demo.

## Enable the local owner API

For a fresh checkout, follow this order:

```sh
npm run db:configure
npm run api:configure
docker compose up -d db
npm run db:migrate
npm run dev
```

Docker/PostgreSQL setup is covered in [Structure 2](structure-2.md). `db:configure` creates the local database environment files. `api:configure` then appends a random 256-bit owner token and matching local origin to those files while preserving database values. It refuses to replace an existing owner token or API origin. File replacements are staged, and a failure writing the second file rolls back the first.

If local environment files already exist, keep them and follow their existing database setup; do not overwrite them from an example. If you enable the API before database setup, configure the database values manually afterward because `db:configure` deliberately refuses existing files.

The default origin is `http://127.0.0.1:3000`. To use a different local port during setup:

```sh
npm run api:configure -- --origin http://127.0.0.1:3101
npm run dev -w @leeos/hub -- --port 3101
```

Root commands load root `.env`. Next.js loads `apps/hub/.env.local`. Both must have the same `LEEOS_API_TOKEN` and `LEEOS_API_ORIGIN`. Restart the Hub after changing them. The helper prints no token. Real credentials, local data, and backups remain ignored by Git.

This is a single-owner local API. The owner can access all projects. It has no user accounts, per-project roles, browser login, or remote access mode. All `/api/v1` reads and writes require `Authorization: Bearer <owner-token>`. The configured origin must be loopback; the request URL must remain loopback with the same scheme/port, and Host plus any Origin header must match the configured origin exactly. Next.js normalizes loopback URL hostnames internally; this is accommodated without trusting forwarded headers. Cross-site browser requests are rejected, and no CORS access is granted. Tokens are checked with a constant-time comparison and never placed in URLs or browser bundles. The Hub is still bound to loopback.

There is no API bypass flag. Missing/malformed owner configuration returns 503; missing/wrong credentials return 401. Public `/api/health` and `/api/ready` remain small operational probes and do not expose project records. A future phone/remote interface needs its own authenticated deployment design before this local boundary changes.

## Use the operator CLI

```sh
npm run leeos -- GET /system
npm run leeos -- GET /projects
```

To create a project, save this safe request as `work/create-project.json` inside the repository:

```json
{"name":"My first LeeOS project","description":"A goal to build toward"}
```

Then run:

```sh
npm run leeos -- POST /projects --json-file work/create-project.json
```

The CLI reads the private token from root `.env` and sends it as a header. Credentials are never command-line arguments. It permits local origins only, refuses redirects, limits request files to 64 KiB, and exits unsuccessfully on HTTP errors. Successful output is the requested project data, so do not put credentials into project names or definitions.

## The API contract

Base path: `/api/v1`. See [the route reference](core-api.md) and [OpenAPI document](../schemas/core-api.openapi.json).

Responses have one shape:

```json
{"data":{"example":"result"},"requestId":"server-generated-uuid"}
```

Errors have a code/message and the same request ID. No raw SQL, stack traces, connection strings, or database errors are returned. Response fields use camelCase, and timestamp fields use UTC ISO strings. Monetary amounts are decimal strings. Responses are not cached.

Creation and rename fields are strict: unknown fields are rejected instead of silently ignored. Names are trimmed and limited to 200 characters, descriptions to 4,000, JSON bodies to 64 KiB, nesting to 16 levels, and total JSON nodes to 5,000. Body reads have a five-second deadline. Supported write bodies are UTF-8 application/json without compression. API input definitions are JSON records, not executable programs; their future execution semantics are not implemented.

Collections default to 25 records, with a maximum of 100. `after` is a permanent ID for project/automation/run/job collections, ordered by ID. Activity uses the event sequence. Cursors are not stable snapshots under concurrent inserts; refresh the collection to see new records. Event sequences are for display, not reliable delivery acknowledgements. Unknown or repeated query parameters are rejected.

## Run control rules

- Run creation requires an idempotency key. Retrying the same project/key and automation reuses the existing run ID. The response shows its current state, not a cached copy of the original response. Creation/replay both return 201.
- Automation revisions require `expectedVersion`; stale revisions return 409. Existing run snapshots do not change.
- Run commands require `expectedVersion`; a stale or invalid transition returns 409. Refresh before deciding whether to retry.
- `cancel` closes the recorded run and unfinished jobs. It is not a signal to an external process in this structure.
- `interrupt` records a lost/interrupted worker and requires a reason.
- `requeue` requires `acknowledgeExternalEffects: true`, meaning the operator has reviewed whether outside actions might already have happened. Checkpoints and completed jobs are preserved; no automatic work starts.
- Project rename currently uses last-write-wins semantics; it has no project version counter.

There are no public commands to start a worker, mark success, modify a job checkpoint, enable paid execution, approve actions, delete data, invoke a model, or fire a schedule. Worker writes remain internal to the state store for later structures. No additional SQL migration was needed, and the applied Structure 2 migration was left intact.

## Validation and next step

Run `npm run check` for lint, typechecks, the embedded SQL/API tests, and production build. `npm run test:postgres` requires `LEEOS_TEST_DATABASE_URL` for a dedicated native test database; it fails clearly if that URL is missing. The manual CI workflow runs the same state/API contract against PostgreSQL.

See the Structure 3 validation record for executed checks and limitations. Local owner authentication is not a production identity system, and the CLI is not a natural-language interpreter.

Structure 4 will introduce the orchestrator and task/command routing foundation: translating an accepted request into a controlled plan. Model/provider execution remains later work. Domain examples are not committed modules. Stop for Lee before proceeding.

References: [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Zod validation](https://zod.dev/basics), [OWASP REST access controls](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
