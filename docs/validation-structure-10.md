# Structure 10 validation

Validated on Windows with Node 24.14.1, npm 11.11.0 and native PostgreSQL 17. Node 22 remains the documented CI target; GitHub Actions was not dispatched. No new dependencies were added.

## Completed source and database checks

- Offline lockfile refresh and clean-install dry run passed against the existing installed workspace.
- ESLint, root TypeScript and Hub type generation/typecheck passed.
- Full default suite: **101 tests passed**.
- Native PostgreSQL contract: **62 tests passed**.
- Clean-close embedded-database restore preserved trigger receipts and migration history.
- Migration 007 upgraded the existing local validation database. Migrations 001–006 match the Structure 9 archive byte for byte.
- All 17 source JSON documents parse.

Coverage includes disabled registration, idempotent identity replay, changed-request conflicts, one-time completion, interval phase and outage coalescing, versioned pause/resume, overlap suppression, revised/paused target blocking, project/source scope, rejection of self-trigger rules, activation boundaries, bounded polling, legacy cron exclusion, strict owner API validation and concurrent duplicate protection.

Injected history failures verify independent rollback of schedule progress/run/receipt and event delivery/run/receipt. The next poll safely resumes each eligible occurrence. Native PostgreSQL also holds an event transaction open while a higher-sequence event commits and is delivered, then commits the earlier event and verifies that it is delivered later through the receipt-based scan.

## Runtime policy

The coordinator uses the database clock and creates queued runs for owner review only. It performs no inference, prepares no jobs and grants no agent permissions. The watcher must be explicitly started; the Hub contains no startup timer. UTC one-time alarms and fixed intervals are supported. Wall-clock cron, DST conversion and external webhook ingestion remain deferred.

Restoring an older backup may omit newer receipts. Stop pollers and inspect the restore boundary before enabling triggers; see backup-and-recovery.md. These checks do not claim disaster recovery beyond the backed-up history.

## Production runtime evidence

The optimized production Hub/core build passed, including Next.js TypeScript and static generation. The live coordination integration test passed through the authenticated production API on temporary port 3102. It registered/enabled a one-time schedule, verified a queued run with the expected snapshot and no jobs, enabled a run-cancellation event rule, and verified one queued follow-up after concurrent polls. Repeated polling created no duplicate receipt or run. Registration replay preserved the schedule identity.

The one-shot CLI poller passed against that server. The five-second watcher was smoke-tested and stopped, and a process check confirmed no watcher remained. Before/after counts of both provider calls and model usage were identical. Local model execution was disabled, and no model server, cloud calls or paid services were used.

The temporary authenticated Hub and PostgreSQL server were stopped. The ordinary preview on port 3101 was verified to serve Structure 10/version 0.10.0, with the owner API disabled and execution disabled. Coordination also remains disabled in the supplied environment examples.

## Source package

The final archive contains 152 source files. Source JSON parsing, historical migration comparison, private validation credential scanning, ZIP integrity and archive exclusions passed. Dependencies, build products, private environments, database files, validation scratch data, binaries and model weights are excluded. Previous structure archives remain unchanged.
