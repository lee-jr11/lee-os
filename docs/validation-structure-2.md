# Structure 2 validation — 16 October 2026

Tested locally on Windows with Node.js 24.14.1 and npm 11.11.0. The documented development/CI target remains Node 22 LTS. Versions tested: native PostgreSQL 17.10, pg 8.23.0, PGlite 0.5.10, Next.js 16.4.2.

## Passed

- Installation of PostgreSQL driver/types and embedded test engine; workspace lockfile synchronized at version 0.2.0.
- npm ci --dry-run --ignore-scripts --offline confirms the final lockfile is consistent. The existing foundation's full npm ci had passed; dependencies added for this structure were installed successfully.
- npm run lint; shared and Hub typechecks.
- Default tests: 14 passed, 0 failed, 0 skipped. Includes SQL migrations, checksum mismatch detection, failed migration rollback, permanent IDs, parameterized names, transaction/event rollback, definition snapshots, idempotency, competing run updates, checkpoint/attempt fencing, foreign keys, immutable events, failure/cancellation, readiness, and portable snapshot restore.
- Native PostgreSQL contract: 9 passed, 0 failed, 0 skipped, using the actual pg driver and a unique temporary schema. Covers the same migration/state behaviors with multiple pooled connections.
- Native database server stopped/restarted; project ID, running state, checkpoint JSON, and event count preserved.
- Database readiness before/after explicit migration: 503 migration-required, then 200 ready.
- Production build passed, including a final rebuild after correcting the structure label.
- Production HTTP checks: Hub 200, liveness reports structure 2/version 0.2.0/execution disabled, unconfigured database readiness 503, configured migrated PostgreSQL readiness 200, stopped database readiness sanitized 503.
- Portable demo passed twice, reopening the saved state on the second invocation.
- Local credential generation in a disposable fixture: matching random credentials, no credential logging, refusal to overwrite files, original files preserved.
- Git ignore rules exclude root/Hub environment files, local database snapshots, and backup dumps. Safe examples remain visible.

## Limits and cleanup

The native PostgreSQL server was a portable temporary validation cluster in work/, not a provisioned application database. It and the second test Hub have been stopped. The regular preview remains on loopback port 3101 without a configured live database; /api/ready therefore correctly returns 503 until the guided PostgreSQL setup is completed.

PGlite NodeFS reopen failed under this Windows environment. The portable demo/test harness instead uses the supported data-directory snapshot API, persisting only on clean close. It is not crash-safe live storage. Native PostgreSQL is the application's durable database adapter.

Docker/Compose is not installed here, so the Compose recipe was not executed. The equivalent schema/driver behavior was tested against native PostgreSQL 17.10. CI is manual-only and has not been dispatched. Node 22 was not run locally. pg_dump/pg_restore procedures are documented but not exercised: the temporary binary bundle omitted those client utilities. No backup/restore success is claimed.

No public write APIs, authentication, automatic worker recovery, event dispatcher, scheduler, provider calls, or Bible Lesson Generator were implemented.
