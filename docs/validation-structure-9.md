# Structure 9 validation

Validated on Windows with Node 24.14.1, npm 11.11.0, native PostgreSQL 17 and the existing dedicated llama.cpp CPU backend. Node 22 remains the documented CI target; the manual GitHub Actions workflow was not dispatched.

## Completed checks

- Offline lockfile refresh and clean-install dry run passed; no new dependencies were added. The existing installed workspace was used for builds/tests.
- ESLint passed. Root TypeScript and Hub type generation/typecheck passed.
- Full default suite: **89 tests passed**, including the new worker contract and clean-close execution-record restore.
- Native PostgreSQL contract: **52 tests passed**, including preparation/assignment history, provider recovery, controlled execution and transaction rollback.
- Historical migrations 001–005 match the Structure 8 archive byte for byte. Migration 006 upgrades the existing validation database without replacing its earlier records.
- Source JSON documents parse; final archive and credential checks are recorded below after live validation.

## Covered execution boundaries

The contract checks dependency order; agent/job/run scope; dismissed agents; default-disabled dispatch; stale run versions; reviewed plan/model fingerprints; plan capability, provider allowlist and output limits; explicit review; one-use request replay; changed-request conflicts; legacy worker write rejection; scoped zero-dollar usage; immutable execution identity; no raw prompt in execution records; cancellation during preflight; late results after cancellation/dismissal; and no generation during saved-result reconciliation.

Injected audit failures verify that authorization, provider reservation and job/run start roll back together, and that a provider result survives failed job finalization for later reconciliation. Uncertain calls fail once, retain the provider fence and do not automatically retry.

## Limits

Tests using the injected transport are protocol fixtures, not inference evidence. Real model evidence is recorded separately below. Local usage has no API billing; hardware and electricity remain operating costs. The backend's reported-path/build fingerprint does not independently attest model weights or backend internals.

Each job has one attempt. Generic interruption/requeue preserves evidence but does not renew its authorization. Autonomous agents, external executors, cloud model calls and scheduling remain future work. Domain examples are illustrative. No UI redesign was included.

## Production and real model evidence

The optimized production Hub/core build passed, including Next.js TypeScript and static generation. The final preview label was corrected to Structure 9 and checked again after rebuilding.

Two live integration tests passed through the authenticated production API on temporary port 3102: the existing manual provider diagnostic and the new prepared-job workflow. The latter performed two genuine local completions, replayed the first without another inference, verified two run/agent-scoped zero-dollar usage records, left the run running until explicit owner review, and then verified run success.

The existing llama.cpp b11699 CPU runtime and tiny stories15M-q4_0 model were reused from the Structure 8 validation resources, outside the source tree. The server reported a 128-token context. These calls prove bounded dispatch and bookkeeping, not assistant or Bible lesson quality. No cloud calls, paid services or new downloads were used.

The temporary authenticated Hub, model server and PostgreSQL validation server were stopped. The ordinary preview on port 3101 serves the current foundation with the owner API and execution disabled. The complete source package excludes dependencies, build products, model/runtime binaries, private environments, database files and validation scratch files. Historical source archives remain unchanged.

Final packaging checks: 143 source files scanned; private validation credentials absent; source JSON valid; ZIP integrity and exclusions verified.
