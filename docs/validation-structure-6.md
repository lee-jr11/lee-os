# Structure 6 validation — 16 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.4.2, native PostgreSQL 17.10. Node 22 remains the documented CI target; it was not executed locally.

## Passed

- All workspace packages, manifest and lockfile synchronized to 0.6.0. The core-to-executors workspace dependency resolves through the existing installation. Offline package-lock installation and npm ci dry-run passed. No SDK or new external dependency was added; a full clean dependency install was not repeated.
- Repository ESLint passed; focused final checks of execution-manager, executor adapter, state-store guards and execution tests also passed.
- Shared-package and Hub typechecks passed. An initial test annotation error was corrected before final validation.
- Default test suite: 54 passed, zero failed/skipped. Includes fingerprint binding/canonicalization, empty-permission enforcement before storage, adapter metadata without execution, additive upgrade, read-only inspection, atomic preparation, concurrency/idempotency, stale versions, wrong fingerprints, existing jobs, event-failure rollback, immutable receipts/mappings, cancellation races, foreign-key boundaries, internal start/append guards and clean-close receipt durability. Existing checkpoint, attempt fencing, API and model-routing contracts remain covered.
- Native PostgreSQL suite: 26 passed, zero failed/skipped, using actual pooled driver connections, temporary schemas, real run locks and transactions. Repeated after adding internal start/append guards.
- Production Next.js build passed for the final source. The preview was stopped during the build to avoid Windows generated-output conflicts.
- npm run execution:demo passed: two pending jobs, stable retry, cancellation of both jobs, no model/workflow/script/device execution, no persisted demo data.
- Native existing database applied only 003_preparations.sql. Embedded upgrade began with the first two migrations and preserved its project/run/plan while adding preparation storage. Earlier SQL files match the Structure 5 archive byte-for-byte.
- Production HTTP/CLI passed: disabled executor catalog, execution inspection, preparation via owner CLI, rejected permissions/wrong digest, missing credential rejection, identical receipt replay, exactly two pending jobs with zero attempts, cancellation to closed jobs, and replay after cancellation without recreation. Existing model/API/security and unchanged Structure 4 snapshot replay checks also passed.
- Database-outage check passed: model/executor catalogs and model routing remained available to the authenticated owner without storage; execution inspection/state queries returned sanitized 503. Invalid execution permissions returned 400 before database access; missing authentication remained rejected.
- Regular preview showed Structure 6/version 0.6.0 and execution disabled. Its protected API remained disabled by default.
- Source JSON files parsed. Browser static bundles had no matches for owner/database environment names or synthetic model/account markers.
- Source archive integrity, old migration checksums and exclusion of private validation credentials verified. No real environment files, dependencies, generated output, database data, backups or native validation binaries are packaged.

## Cleanup and limits

The temporary authenticated Hub and native database were stopped. The regular preview remains at http://127.0.0.1:3101/ without owner/database configuration. Persistent use requires the existing setup and all three migrations.

This is an execution-manager foundation for reviewed **preparation**, not a live worker. Job dependencies and intended destinations are recorded and inspected; no dispatch, automatic retries, provider calls, shell/Python execution, workflow launch, device control, scheduler or Bible automation is enabled. Internal state methods reject starting preparation-only runs and appending unreviewed jobs to their batch. A complete live-execution permission gateway and capacity reservation remain future work.

Receipt acknowledgement records the authenticated owner's assertion of review, not proof that a human read the plan or a multi-user approval. Identical replay returns historical data. Database administrators can bypass ordinary immutable-record protections. Clean-close embedded persistence was tested; PostgreSQL backup/restore, remote hosting, device/PWA installation and CI execution were not tested in this structure.
