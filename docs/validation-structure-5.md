# Structure 5 validation — 16 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.4.2, native PostgreSQL 17.10. Node 22 remains the CI target and was not run locally.

## Passed

- Workspace packages, manifest and lockfile synchronized to 0.5.0. Explicit core-to-providers and providers-to-Zod dependencies resolve using existing installed dependencies. Offline package-lock install and npm ci dry-run passed; a full clean install was not repeated. No new external dependency or SDK was added.
- Repository ESLint and shared/Hub typechecks passed.
- Default suite: 42 passed, zero failed/skipped. Covers metadata validation, capability/context/output requirements, account scope, unknown/nonzero cost, paid fallback, quota, evidence freshness, stable ranking, request restrictions, planner decisions, and prior state/API contracts.
- Native PostgreSQL suite: 19 passed, zero failed/skipped, using temporary schemas and actual pooled driver transactions. Model requirements and blocked decisions persisted/replayed without creating jobs.
- Production Next.js build passed. The previous preview was stopped before building to avoid the Windows generated-output conflict encountered during Structure 4.
- npm run model:demo passed. Real default providers remained unconfigured; a separate explicitly fictional fixture demonstrated selection with execution disabled. No API key, network call, quota reservation, or data persistence was used by the demo.
- Production HTTP/CLI checks passed: catalog, blocked routing, owner authentication, Host/Origin rejection, rejected client execution override, model-routing CLI, model decision in a saved plan, replay/conflict, no jobs created, and existing API commands.
- A real planner-version-1 snapshot saved during Structure 4 was read and replayed unchanged through the Structure 5 production API.
- With native PostgreSQL stopped, authenticated catalog and routing still returned 200 (routing blocked); state queries returned sanitized 503 and missing model API credentials returned 401.
- Hub liveness reported Structure 5/version 0.5.0, execution disabled; the page showed the updated milestone. No layout redesign was made. Regular preview protected API remained disabled by default.
- Browser static bundles contained no matches for the synthetic model/account/evidence markers or owner/database configuration names.
- Source JSON and archive contents checked. Both existing SQL migrations matched the Structure 4 archive byte-for-byte. Source package excludes real environment files, database data, dependencies, native validation tools, build output and private credentials.

## Limits and cleanup

The temporary authenticated Hub and native database were stopped. The regular preview remains at http://127.0.0.1:3101/ without owner or database configuration. Persistent planning still requires the existing setup and migrations.

The router validates trusted server metadata; no real provider observer or billing verifier exists yet. The Hub uses the unconfigured default registry. Eligible selection is demonstrated with fictional metadata only. Selection is advisory, makes no reservation and cannot authorize execution. Input/output sizes are caller estimates, not tokenized content. Existing snapshots remain historical even after evidence expiration.

No live model calls, provider credentials, SDKs, external/paid execution, job dispatch, scheduler, automatic English decomposition or Bible Lesson Generator were implemented. No database migration was added. CI was not dispatched; remote hosting, device/PWA installation and backup/restore were not tested.
