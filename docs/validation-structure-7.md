# Structure 7 validation — 16 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.4.2, native PostgreSQL 17.10. Node 22 remains the CI target; it was not executed locally.

## Passed

- Workspace packages, manifest and lockfile synchronized to 0.7.0. Explicit core-to-agents and agents-to-Zod dependencies resolve through existing workspace installation. Offline package-lock installation and npm ci dry-run passed. No new external package or provider SDK was added; a full clean install was not repeated.
- Repository ESLint, shared package typechecks and Hub typechecks passed.
- Default test suite: 67 passed, zero failed/skipped. Includes metadata-only templates, strict role/assignment contracts, empty permissions, auth/input validation before storage, immutable/deduplicated role registration, scoped assignment races, role snapshots, wrong-run and human-review rejection, stale review/version guards, rollback on failed history writes, dismissal CAS, assignment/dismissal races with cancellation, cross-run foreign keys, pagination, upgrade and clean-close persistence. Existing model/API/state/preparation/checkpoint contracts remain covered.
- Native PostgreSQL suite: 35 passed, zero failed/skipped. Uses actual pooled driver connections, temporary schemas, run row locks and real transactions for all shared state/API/planning/preparation/agent contracts.
- Production Next.js build passed. The regular preview was stopped during the build, then restored.
- npm run agent:demo passed: a temporary role and prepared-job assignment, stable replay, human review left with Lee, cancellation dismissing the scoped agent, no agent process/model/tool execution or persisted demo data.
- Native existing database applied only 004_agent_assignments.sql. The embedded upgrade began with the first three migrations and preserved the earlier preparation receipt while adding role and assignment records. Earlier SQL files match the Structure 6 archive byte-for-byte.
- Production HTTP/CLI checks passed: agent catalog, role registration via CLI and replay, role read, assignment via CLI and replay, empty permissions, team inspection, human-review assignment rejection, start-command rejection, explicit dismissal/version conflict, cancellation dismissal and historical assignment replay. Existing security/model/preparation flows also passed.
- Actual Structure 4 planner-version-1 and earlier preparation receipts were replayed unchanged through the Structure 7 production API.
- Database-outage check passed: authenticated agent/model/executor catalogs remained available without storage, while registered role/state queries returned sanitized 503. Invalid role permissions returned 400 before storage and missing credentials still returned 401.
- Regular preview liveness reported Structure 7/version 0.7.0 with execution disabled; page milestone updated and protected API disabled by default.
- Browser static bundles had no matches for owner/database configuration names or synthetic model/account markers.
- Source JSON and archive integrity checked; old migration bytes and exclusion of actual private validation credentials verified. Archive contains no real environment files, databases, dependencies, native validation tools, generated output or backups.

## Cleanup and limits

Temporary authenticated Hub and native PostgreSQL were stopped. The regular preview remains at http://127.0.0.1:3101/ without owner/database configuration. Persistent use needs existing local setup and all four migrations.

This is a role registry and assignment lifecycle, not a live agent runtime. Roles are immutable version-1 records with empty permissions. Each prepared job supports one assignment in this milestone; dismissal does not permit silent reassignment. Templates are descriptive and do not register roles automatically. Human review cannot be delegated through this API.

All endpoints remain owner-authenticated. No per-agent credentials, sandbox, delegation, tool grants, live model calls, background workers, scheduling, automatic team assembly or Bible Lesson Generator was introduced. Scope and lifecycle database guards apply to managed assignments; legacy unscoped agent rows are preserved. Database administrators can bypass ordinary protections. Clean-close persistence was tested; backup/restore, remote hosting, PWA installation and CI execution were not tested in this structure.
