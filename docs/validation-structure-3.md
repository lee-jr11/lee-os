# Structure 3 validation — 16 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.4.2, native PostgreSQL 17.10. Node 22 LTS remains the documented/CI target; it was not executed locally.

## Passed

- Explicit Zod runtime dependency and core/database workspace references installed; version 0.3.0 lockfile synchronized. Final npm ci dry-run (offline, ignore-scripts) passed. A new full clean install was not repeated for this structure; the existing foundation full install and added dependencies had already succeeded.
- npm run check passed: lint, shared package/Hub typechecks, all 25 default tests, and production build.
- Default tests cover owner authentication before database access, origin/Host restrictions, Next.js loopback normalization, wrong ports and external URLs, malformed/unknown input, JSON byte/depth/time limits, sanitized errors, project/recipe/run commands, scoped references, stale versions, idempotency, worker-write exclusion, reviewed recovery, pagination, and existing state durability contracts.
- API configuration fixture: existing database settings preserved, random matching owner credentials in root/Hub files, replacement refused when already configured, and partial setup rolled back.
- Native PostgreSQL state/API contract: 14 passed, 0 failed, 0 skipped. Used unique temporary schemas, the actual pg driver, pooled connections, and real SQL transactions.
- api:demo passed without network calls or saved data: stored recipe, queued run, duplicate request reused ID, cancellation, activity, execution disabled.
- Production HTTP + CLI integration passed: missing credentials 401; cross-origin 403; spoofed Host 403 using raw HTTP; authorized CLI project create/read; stored recipe; queued run creation/replay; worker-start command rejected; cancellation and stale-version conflict; oversized JSON 413; activity read; regular preview API disabled 503; Structure 3/version 0.3.0 liveness and page.
- Database-outage production check: authenticated API requests returned sanitized 503, while unauthenticated requests still returned 401. No database URL or owner token in error bodies.
- Git ignores real environment files, staged .env temporary files, local snapshots, and backups. Owner configuration references are confined to server/operator code; no owner token configuration was found in browser static bundles.
- Source JSON and archive contents checked during packaging. No credentials, database data, dependencies, or native validation binaries are included in the source archive.

## Integration correction

Next.js normalizes loopback URL hostnames to localhost. The API accommodates normalized loopback transport URLs only when scheme/port agree, while keeping exact Host and browser Origin checks. Wrong Host was verified with raw HTTP because this environment's fetch normalized the Host test header. No diagnostic wrapper is part of the delivered source or running preview.

## Limits and cleanup

The native database and authenticated second Hub were temporary local validation services. Both have been stopped. The regular preview on port 3101 remains available without owner credentials or a live database; protected API routes correctly return API_DISABLED until the guided configuration is completed.

The API is single-owner and loopback-only. It has no browser login, multi-user roles, remote hosting mode, worker dispatch, model calls, paid execution, automatic recovery, event delivery, or Bible Lesson Generator. Existing SQL migrations were not edited, and no new migration was needed. Project rename remains last-write-wins. Run requests are idempotent per project/key, not a general response-cache/retry system for every command.

OpenAPI is a static reference; runtime request validation is provided by Zod contracts. CI remains manual-only and was not dispatched. Hosted deployment, device/PWA installation, remote authentication, and PostgreSQL backup/restore were not tested in this structure.
