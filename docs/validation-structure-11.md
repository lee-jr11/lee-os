# Structure 11 validation

Validated on Windows with Node 24.14.1, npm 11.11.0 and native PostgreSQL 17. Node 22 remains the documented CI target; GitHub Actions was not dispatched. No new dependencies were added.

## Source and database checks

- Offline lockfile refresh and clean-install dry run passed against the installed workspace.
- Root TypeScript and Hub type generation/typecheck passed.
- Full default suite: **113 tests passed**.
- Native PostgreSQL contract: **70 tests passed**.
- Clean-close embedded-database restore preserved original requests, proposal revisions and approval receipts.
- Migration 008 upgraded the existing validation database. Migrations 001–007 match the Structure 10 archive byte for byte.
- All 18 source JSON documents parse.
- The standalone CLI preview interpreted the supplied welcome-message example into draft, rewrite and owner-review steps without a database or model.

Coverage includes supported and unsupported phrasing, timing/external-action clarification, unresolved references, translation language clarification, bounded clause counts, strict bodies, storage-free preview, owner authentication, source preservation, idempotent project-scoped identity, English clarification, owner-edited dependency graphs, final-review barriers, canonical request/revision/content digests, stale edits/approvals, cancellation, approval-versus-edit/cancel races, immutable revisions, one-run approval replay and interoperability with the existing planner/preparation inspector.

An injected request-approval history failure verifies that the request remains editable and no run, plan or approval receipt remains. Identical approval retry then succeeds once. Replaying an approved request after its run is cancelled preserves the original approval receipt and cannot restart work.

## Scope limits

Intake is a transparent bounded English interpreter with explicit owner edits, not general language-model understanding. It makes no inference calls and does not establish model-planning quality. Saved original text and revisions remain in the local database. It does not read source documents, create automations, prepare jobs, assign agents, create schedules or grant execution permissions. Roadmap correction: domain examples are illustrative. Structure 12 connects the general-purpose Hub workflow.

## Production and CLI evidence

ESLint and the optimized production Hub/core build passed, including Next.js TypeScript and static generation. The production owner-API integration test passed: preview, ambiguous-request creation, English clarification, manual graph editing, concurrent exact approval replay, one queued run with an immutable plan, no jobs/agents/schedules/event rules, and current-state registration replay.

CLI submission, same-key identity replay and English clarification were tested against the production API using the supplied example. No run was created by these CLI operations before approval. The standalone preview also worked without the owner API/database.

Before/after provider-call and model-usage counts were identical. Runtime checks confirmed that the local provider, job execution and coordinator opt-ins were all disabled during the live intake test. No model server, cloud calls, paid services or new downloads were used.

The temporary authenticated Hub and PostgreSQL validation service were stopped. The ordinary preview on port 3101 was checked for Structure 11/version 0.11.0, its correct milestone label, disabled owner API and disabled execution.

## Source package

The final ZIP contains 163 source files. Source JSON parsing, private validation credential scanning, historical migration comparison, ZIP integrity and exclusion checks passed. Dependencies, build products, private environments, database files, validation scratch data, binaries and model weights are excluded. Previous structure archives remain unchanged.
