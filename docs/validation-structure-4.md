# Structure 4 validation — 16 October 2026

Environment: Windows, Node 24.14.1, npm 11.11.0, Next 16.4.2, native PostgreSQL 17.10. Node 22 remains the CI target and was not run locally.

Passed:

- Workspace versions and lockfile synchronized to 0.4.0 with offline package-lock installation; offline npm ci dry-run passed. No new dependencies were needed. A full clean dependency install was not repeated.
- ESLint and shared/Hub typechecks passed. A focused final lint of planning modules, demo and tests also passed.
- Default suite: 32 tests passed, zero failed/skipped, including graph validation, unknown capabilities, strict input before storage, additive upgrade, immutable plans, replay after cancellation, concurrent duplicates, event rollback, and existing API/state contracts.
- Native PostgreSQL suite: 18 tests passed, zero failed/skipped. Uses actual pooled driver connections and unique temporary schemas, including planning concurrency and rollback contracts.
- Native existing database upgrade applied only 002_plans.sql. Original 001_state.sql was not edited. Embedded upgrade test preserved a project created before the upgrade.
- Production build passed after stopping the previous preview server and retrying outside the restricted sandbox. The first attempt hit Windows EPERM creating generated Next.js output; no source correction was needed for that error.
- npm run plan:demo passed using only a temporary in-memory database, with no model calls or dispatched jobs.
- Production HTTP/CLI check passed: owner authentication, Host/Origin rejection, project create/read, run deduplication, plan create/read/replay, changed-plan conflict, no jobs created, cancellation/version checks, JSON size rejection, activity reads, default-disabled preview API, Structure 4/version 0.4.0 Hub.
- JSON source files and source archive parsed/inspected. Archive excludes real environment files, generated output, dependencies, databases, native binaries and private validation credentials.

Temporary authenticated Hub and native database were stopped after validation. The regular preview remains at port 3101 without database/owner credentials. Apply migrations and follow existing local setup for persistent API use.

Limits: plans require explicit structured steps; English decomposition, approval commands, model selection/calls, job dispatch and scheduling remain deferred. Domain examples are illustrative. Every plan is blocked for automatic execution. Routing expresses intended capabilities, not a working connection or verified external price. Replanning requires a new run. The UI only has updated milestone text, with no new planning form. CI was not dispatched; remote hosting, PWA installation and backup/restore were not tested.
