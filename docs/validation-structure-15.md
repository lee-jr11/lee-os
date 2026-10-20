# Structure 15 validation

No dependency or database migration was added. All eight SQL migrations match Structure 14 byte for byte. Offline clean-install dry run passed.

The new coordination-client contract uses the actual authenticated core API with the embedded PostgreSQL engine. It covers definition/version loading, disabled registration and idempotent replay, current-version enablement, stale command rejection, a bounded system-wide tick, trigger receipts, a queued run with no jobs and event-rule enable/disable. Registration-body tests bind target versions and queue-only authority, reject ambiguous/invalid UTC dates and enforce fixed-interval limits.

The first full run failed because the test transport omitted the required Host header. The test fixture was corrected; the production authorization boundary was not weakened. Final outcomes and browser checks are recorded below.

## Final checks

- Full ESLint and root/Hub typechecks passed.
- Full default suite: 127 tests passed, no failures or skips. Focused coordination-client suite: 2 passed.
- Production compilation/typecheck passed, but the restricted build initially failed to create a generated directory (Windows EPERM). Retrying the production build outside the restricted shell completed successfully.
- Browser validation against native PostgreSQL and the production API used a disposable project and temporary owner key. The old database port was rejected by Windows; an alternate loopback port was used without changing committed configuration.
- The Hub loaded reviewed automation definitions, registered a disabled one-time UTC schedule, separately enabled it, performed one explicitly acknowledged system-wide check and displayed its queued receipt. An API read-back confirmed exactly one queued run with zero jobs.
- An event-follow-up rule was registered from the same browser and verified disabled. Event enable/disable was exercised by the authenticated client contract; full event delivery/interval policy remains covered by existing coordination tests. Browser pagination and stale-command races were not separately simulated.
- Temporary owner access was locked/closed, its server and database stopped, and both original preview ports restored with their default-disabled configuration.

No model calls, paid/cloud services, new migrations or execution permissions were introduced. Trigger-created runs still need a separately reviewed plan; automation creation/planning UI is deferred. The source archive excludes dependencies, build outputs and actual environment files; integrity and private-value scans are checked during packaging.
