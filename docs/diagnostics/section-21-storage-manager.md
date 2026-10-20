# Section 21 diagnostic — Storage Manager / Artifacts / File Ownership

Audit date: 2026-10-18. LeeOS 0.18.1 / Structure 18. This report audits the current implementation, not a proposed storage platform. All database failure/concurrency scenarios used generated disposable schemas. No artifact file bytes, user resources or external storage were deleted or connected.

## Blueprint Section

Section 21 — Storage Manager / Artifacts / File Ownership.

## Overall Storage Verdict

🟡 PARTIALLY ALIGNED. There is a useful artifact metadata table, stable identity, project/run referential integrity and separation from controlled text execution. Storage Manager, artifact registration/access, physical storage policy, provenance/integrity verification and cleanup services are not built.

## Current Milestone Verdict

🟢 IMPLEMENTED + VERIFIED for the limited foundation actually exposed: artifact identity/SQL parent constraints, no ambient model/file execution authority, guarded developer cleanup and retained state/history tests. This does not certify complete artifact ownership, immutable files, secure upload/download or physical storage. Native diagnostics explicitly demonstrate the placeholder schema's weaknesses; they are deferred requirements because no current artifact or memory service exposes these operations. No genuine runtime regression or destructive path was found in the audited scope, so no runtime/schema change was made.

## Storage Capability Matrix

Status vocabulary: ⚪ NOT STARTED; 🟡 PARTIAL; 🟢 IMPLEMENTED + VERIFIED; 🔴 BROKEN / REGRESSION. A passed audit check can prove a limitation; it does not mark the corresponding future feature implemented.

Evidence keys:

- M: packages/database/migrations/001_state.sql, plus migrations 002–008 for historical ledgers.
- ID: packages/database/src/ids.ts.
- H: packages/core/src/api/http.ts, contracts.ts, body.ts; apps/hub components and catch-all route.
- R: packages/database/migrations/005_local_provider.sql and 006_job_execution.sql; provider/result read model.
- J: packages/core/src/job-worker/index.ts and tests/helpers/worker-contract.ts.
- E: packages/executors/src/index.ts; preparation and execution contract tests.
- F: scripts/lib/embedded-database.ts, scripts/lib/api-config.ts, scripts/configure-local-database.ts, scripts/database.ts, guarded test fixtures.
- P: apps/hub/public/sw.js and tests/pwa.test.ts.
- D2/D9/D20: Structure 2 documentation and prior Memory/Lifecycle diagnostic findings.
- B: docs/backup-and-recovery.md.
- Audit checks 1–10: reproducible native script and JSON findings linked below. These use privileged SQL, not a nonexistent artifact service.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Storage Manager | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage/lifecycle separation | 🟡 PARTIAL | M, D20; schema/module inspection | Boundary now; managers future | Metadata/history separated; coordinating Lifecycle/Storage/Memory managers absent. |
| Artifact definition | 🟡 PARTIAL | M; audit checks 1,4,8 | Schema now | Nine metadata fields, no registered physical-file contract or validation pipeline. |
| Stable artifact identity | 🟢 IMPLEMENTED + VERIFIED | M, ID; audit check 1 | Yes | file_ + lowercase UUID v4; PK and immutable-ID trigger. Stability is not full metadata immutability. |
| Artifact metadata | 🟡 PARTIAL | M; audit checks 1,4,8 | Schema now | Nine metadata fields, no registered physical-file contract or validation pipeline. |
| Artifact/file separation | 🟡 PARTIAL | M; audit checks 1,4,8 | Schema now | Nine metadata fields, no registered physical-file contract or validation pipeline. |
| Artifact/result separation | 🟢 IMPLEMENTED + VERIFIED | R, J; focused/native worker tests | Yes | Job result uses job/run/call identity and provider output text; no artifact record is minted by text results. |
| Artifact/memory separation | 🟡 PARTIAL | M, R; audit checks 6,7 | Existing boundary now | Separate tables/text results and diagnostics; no typed artifact event/evidence or file-log retention pipeline. |
| Artifact/event separation | 🟡 PARTIAL | M, R; audit checks 6,7 | Existing boundary now | Separate tables/text results and diagnostics; no typed artifact event/evidence or file-log retention pipeline. |
| Artifact/log separation | 🟡 PARTIAL | M, R; audit checks 6,7 | Existing boundary now | Separate tables/text results and diagnostics; no typed artifact event/evidence or file-log retention pipeline. |
| Ownership model | 🟡 PARTIAL | M; audit checks 1,2,5 | Schema scope now | Explicit mandatory project plus optional same-project run; no automation/job/agent/user/source ownership chain. |
| Primary ownership | 🟡 PARTIAL | M; audit checks 1,2,5 | Schema scope now | Explicit mandatory project plus optional same-project run; no automation/job/agent/user/source ownership chain. |
| Cross-project isolation | 🟡 PARTIAL | Audit checks 2,5,6,9 | Current FK scope now; access future | Mismatched run/project rejected; standalone privileged SQL reparenting and cross-project memory evidence allowed. No read/update API. |
| Creation authorization | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Write authority | 🟡 PARTIAL | J, E, H; API and worker tests | Prevent ambient authority now | No model/agent arbitrary file IO or artifact registration. Future upload/parser/tool capabilities need explicit scopes. |
| Path safety | 🟡 PARTIAL | Audit checks 8,9; CLI readers; H | Existing no-file API boundary now | Locations remain inert strings; unknown file endpoints rejected. No canonicalization/root/symlink/drive policy for future artifacts. |
| Filename safety | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| MIME/type handling | 🟡 PARTIAL | M; audit checks 4,5,8 | Declaration only now | media_type is unvalidated text; optional sha256 checks syntax only, never bytes. No MIME sniffing or integrity verification. |
| File-size metadata | 🟢 IMPLEMENTED + VERIFIED | M; audit check 4 | Yes, metadata only | Nullable nonnegative bigint; declaration is not physical measurement. |
| Size limits | 🟡 PARTIAL | M, R, H; audit checks 4,8 | Current text limits now; files future | No upload/generated-file cap or artifact-field length budget; provider output text max 262144 bytes, API JSON 64 KiB are separate. |
| Integrity hashes | 🟡 PARTIAL | M; audit checks 4,5,8 | Declaration only now | media_type is unvalidated text; optional sha256 checks syntax only, never bytes. No MIME sniffing or integrity verification. |
| Deduplication | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Artifact versioning | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Historical immutability | 🟡 PARTIAL | M; audit checks 1,5,7 | Stable ID now; file-output policy future | ID immutable; privileged SQL can replace metadata after run success; no ordinary file replacement API or byte retention guarantee. |
| Working-file mutation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| User/generated distinction | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Artifact classes | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Temporary classification | 🟡 PARTIAL | F; .gitignore; generated build/test locations | Developer tooling now | Owned UUID temp files and .next/dist/test directories exist, not typed artifact lifecycle classes. |
| Cache classification | 🟡 PARTIAL | P; focused PWA tests | PWA cache boundary now | Named static-help browser cache; no artifact CACHE class or global cache inventory. |
| Build-artifact classification | 🟡 PARTIAL | F; .gitignore; generated build/test locations | Developer tooling now | Owned UUID temp files and .next/dist/test directories exist, not typed artifact lifecycle classes. |
| Rebuildable classification | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Required-artifact classification | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Provenance | 🟡 PARTIAL | M; audit checks 1,2,5 | Schema scope now | Explicit mandatory project plus optional same-project run; no automation/job/agent/user/source ownership chain. |
| Lineage | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| File-format validation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Acceptance validation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Bible-DOCX foundation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Artifact registration | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage-location contract | 🟡 PARTIAL | M, F; audit check 8 | Schema/dev tooling now | Nonempty arbitrary storage_uri only; no selected artifact host/provider. Dev snapshots/config/build outputs are host local. |
| Local-host dependency | 🟡 PARTIAL | M, F; audit check 8 | Schema/dev tooling now | Nonempty arbitrary storage_uri only; no selected artifact host/provider. Dev snapshots/config/build outputs are host local. |
| Object-storage foundation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Database-blob separation | 🟢 IMPLEMENTED + VERIFIED | M, R; migration inspection | Yes | No binary artifact column/bytea store; DB retains metadata and bounded provider text, not generated document blobs. |
| Git/artifact separation | 🟡 PARTIAL | D2, .gitignore; source inventory | Yes, architecture boundary | Source/config and generated build dirs separated; no generated-artifact producer/auto-commit path. Arbitrary user artifacts not universally gitignored. |
| Repository references | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| External-storage foundation | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage-provider abstraction | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage inventory | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Per-project accounting | 🟡 PARTIAL | M; audit checks 1,4 | Metadata foundation now | Declared size_bytes can be grouped by project/optional run; no implemented aggregate API, physical measurement or dedup-aware attribution. |
| Per-automation accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Per-run accounting | 🟡 PARTIAL | M; audit checks 1,4 | Metadata foundation now | Declared size_bytes can be grouped by project/optional run; no implemented aggregate API, physical measurement or dedup-aware attribution. |
| Database accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Artifact accounting | 🟡 PARTIAL | M; audit checks 1,4 | Metadata foundation now | Declared size_bytes can be grouped by project/optional run; no implemented aggregate API, physical measurement or dedup-aware attribution. |
| Log accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Memory accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Cache accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Repository accounting | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage budgets | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage warnings | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Cleanup candidate detection | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Cleanup suggestions | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Automatic-delete safety | 🟢 IMPLEMENTED + VERIFIED | F, P; cleanup source review and focused tests | Yes | No automatic important project/user-file cleanup service; only owned dev temporary files/test fixtures/static caches. |
| Temporary cleanup | 🟡 PARTIAL | F, P; focused tests | Existing tooling now | UUID temporary/lock cleanup and old leeos-shell caches only; no user-facing artifact cleanup operation. |
| Cache cleanup | 🟡 PARTIAL | F, P; focused tests | Existing tooling now | UUID temporary/lock cleanup and old leeos-shell caches only; no user-facing artifact cleanup operation. |
| Artifact deletion | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Metadata/bytes deletion separation | 🟡 PARTIAL | M, D2; audit checks 7,8 | Foundation now; cleanup future | Metadata separate from bytes but neither file-only deletion workflow nor tombstone/retained-evidence contract exists. |
| Missing-file detection | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Orphan-file detection | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Orphan-metadata prevention | 🟢 IMPLEMENTED + VERIFIED | M; audit checks 2,10 | Yes, mandatory SQL parents | Required project and optional referenced run must exist with matching project; does not verify physical bytes or arbitrary JSON references. |
| Memory-reference handling | 🟡 PARTIAL | M; audit check 6; D9/D20 | FK foundation now | Referenced artifact metadata deletion restricted; no byte evidence retention or same-project evidence enforcement. |
| Event-history preservation | 🟡 PARTIAL | M; audit checks 5,7; native suite | Current history now | Status/metadata changes preserve run/events; generic event references can dangle and no artifact tombstone exists. |
| Run-history preservation | 🟡 PARTIAL | M; audit checks 5,7; native suite | Current history now | Status/metadata changes preserve run/events; generic event references can dangle and no artifact tombstone exists. |
| Artifact archive | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Project-archive interaction | 🟢 IMPLEMENTED + VERIFIED | Audit check 7; D20; native archive tests | Yes, current limited semantics | Administrative archived status leaves artifacts/history intact; no supported file availability/archive service implied. |
| Delete-files-only foundation | 🟡 PARTIAL | M, D2; audit checks 7,8 | Foundation now; cleanup future | Metadata separate from bytes but neither file-only deletion workflow nor tombstone/retained-evidence contract exists. |
| Permanent erasure | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| File recovery | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Backup foundation | 🟡 PARTIAL | B, F; focused clean-close tests | Documented process now | Separate artifact-byte backup instructed; dev snapshots tested. No native file-backup/restore/hash verification executed or automatic service. |
| Backup verification | 🟡 PARTIAL | B, F; focused clean-close tests | Documented process now | Separate artifact-byte backup instructed; dev snapshots tested. No native file-backup/restore/hash verification executed or automatic service. |
| Artifact access | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Signed URLs | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Filesystem-path isolation | 🟡 PARTIAL | Audit checks 8,9; CLI readers; H | Existing no-file API boundary now | Locations remain inert strings; unknown file endpoints rejected. No canonicalization/root/symlink/drive policy for future artifacts. |
| Download authorization | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Upload authorization | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Untrusted-content boundary | 🟡 PARTIAL | J, E, H; API and worker tests | Prevent ambient authority now | No model/agent arbitrary file IO or artifact registration. Future upload/parser/tool capabilities need explicit scopes. |
| Storage/execution separation | 🟢 IMPLEMENTED + VERIFIED | E, J; preparation/worker tests; audit 8,9 | Yes | Stored location/code string grants no execution. Python/workflow/device adapters prepare metadata only; controlled text/review grants remain separate. |
| Agent file scope | 🟡 PARTIAL | J, E, H; API and worker tests | Prevent ambient authority now | No model/agent arbitrary file IO or artifact registration. Future upload/parser/tool capabilities need explicit scopes. |
| Tool file scope | 🟡 PARTIAL | J, E, H; API and worker tests | Prevent ambient authority now | No model/agent arbitrary file IO or artifact registration. Future upload/parser/tool capabilities need explicit scopes. |
| Secret-file separation | 🟡 PARTIAL | F, .gitignore, D2; API config tests | Existing credentials now | Environment/key files ignored and server-side; no credential-artifact registration path. Schema alone cannot prevent a future secret URI. |
| Artifact events | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage events | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage/cost separation | 🟡 PARTIAL | Core assertZeroCost; provider/executor catalogs; source inventory | ZERO_ONLY boundary now | No paid/object-storage adapter activated; future storage requires verified cost evidence, not a free-tier assumption. |
| Storage/Tool-Registry relationship | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage/Lifecycle relationship | 🟡 PARTIAL | M, D20; schema/module inspection | Boundary now; managers future | Metadata/history separated; coordinating Lifecycle/Storage/Memory managers absent. |
| Storage/Memory relationship | 🟡 PARTIAL | M, D20; schema/module inspection | Boundary now; managers future | Metadata/history separated; coordinating Lifecycle/Storage/Memory managers absent. |
| Storage/Execution relationship | 🟢 IMPLEMENTED + VERIFIED | E, J; preparation/worker tests; audit 8,9 | Yes | Stored location/code string grants no execution. Python/workflow/device adapters prepare metadata only; controlled text/review grants remain separate. |
| Storage/PM relationship | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| GitHub boundary | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| n8n boundary | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| MCP boundary | ⚪ NOT STARTED | Source/API/module inventory | Future | No corresponding artifact/storage service, operation or dedicated contract exists. |
| Storage concurrency | 🟡 PARTIAL | Native audit checks 2,3,5 | SQL constraint safety now | Concurrent duplicate ID: one insert; mismatched ownership rejected. Same URI/hash allowed; no idempotent registration or versioned mutation service. |
| Duplicate registration safety | 🟡 PARTIAL | Native audit checks 2,3,5 | SQL constraint safety now | Concurrent duplicate ID: one insert; mismatched ownership rejected. Same URI/hash allowed; no idempotent registration or versioned mutation service. |
| Auditability | 🟡 PARTIAL | M, R; audit checks 5,7,10 | Existing state history now | Artifact has created_at/project/run; no creator/job/agent/model lineage, artifact event writer or mutation history. |

## Current Artifact Contract

The actual table has exactly nine columns:

| Field | Actual contract |
|---|---|
| id | text PK; lowercase `file_<UUID v4>` format; immutable-ID trigger |
| project_id | NOT NULL project FK; primary ownership anchor |
| run_id | nullable; composite FK with project_id to runs(id, project_id) |
| storage_uri | NOT NULL text with nonempty-length check only |
| name | NOT NULL text; no filename normalization, reserved-name rule, length cap or uniqueness |
| media_type | NOT NULL text; no MIME detection/content validation |
| sha256 | nullable text; exactly 64 lowercase hexadecimal characters if present |
| size_bytes | nullable bigint, nonnegative if present |
| created_at | timestamp with time zone, NOT NULL, default now() |

There is a project index. No automation_id, job_id, agent_id, user owner, kind/class, version, original filename, source inputs, lineage, validation state, required/rebuildable flag, tombstone, deletion receipt or update version exists. ID immutability does not make the record immutable. `createId('artifact')` generates the `file_` prefix with crypto.randomUUID().

## Storage Location Finding

STATE/history/metadata: native PostgreSQL via DATABASE_URL; local Compose provides a PostgreSQL 17 named volume. CODE/config: repository source and workspace packages. FILES: `storage_uri` is a placeholder reference; no artifact storage root or provider is configured by the implementation. Actual controlled text results live in provider_calls.output_text, bounded to 262144 bytes, linked from job_executions; these are not DOCX/file blobs. MEMORY: placeholder memories JSON table, not distilled useful knowledge. LOGS: persisted events/checkpoints/results plus console diagnostics, no managed file-log store. CACHE/temp: static-help browser cache, Next build directories, UUID configuration/snapshot temporaries and isolated development/test directories.

No bytea/binary artifact column or object-storage service exists. Dev PGlite clean-close database.tar snapshots under explicit local directories are development database persistence, not artifact files. Paths for developer-owned configuration/builds/snapshots create ordinary host dependence; artifact host portability is not implemented. No individual artifact bytes are guaranteed to exist anywhere merely because its record exists.

## Ownership Finding

An artifact's explicit primary owner is project_id. Optional run_id must point to a run in that same project; it is not the sole way to infer ownership. An automation can only be traced indirectly through that run where present; no artifact automation/job/agent/user FK exists. created_at is not a creator identity. Privileged SQL can reparent an artifact with no run, or change both project/run to another valid pairing; there is no owner-aware artifact mutation service, row-level tenant policy or sharing model. The current application uses a single local owner, so project-scoped future file authorization must not be inferred from authentication alone.

## Isolation Finding

Native check 2 rejects a Project B artifact referencing Project A's run, a missing project, a missing run, changing only project on a run-bound artifact, and changing only run to another project's run. These demonstrate referential consistency, not universal cross-project access authorization. Check 5 confirms standalone reparenting via privileged SQL is allowed. Check 6 confirms a Project B memory can reference Project A's artifact because source_artifact_id is only an artifact FK; this carries forward Sections 9/20 debt. There is no artifact or memory retrieval/mutation API to exploit through normal services. Check 9 verifies artifact routes (including foreign-project paths) are 404 before opening the database, while missing owner credentials are 401. Unsupported endpoints are not a completed isolation feature.

## Artifact / Result / Event / Memory / Log Finding

Artifact identity is distinct from job result identity: job_executions uses job/run/agent/call IDs and controlled status/permission; text is read from provider_calls only under existing execution/result rules. Model output is never interpreted as a storage destination or a file registration instruction. Memory has its own table and optional source-artifact FK. Events are append-only generic JSON evidence, not an artifact byte store; entity_id/payload artifact references are not FK-validated. A raw event may therefore outlive an unreferenced artifact metadata row without a typed tombstone explanation. Logs/console diagnostics are not classified artifacts. No typed artifact-reference output or event attachment protocol exists yet.

## User / Generated / Temporary Finding

There is no USER_FILE/GENERATED_FILE/TEMPORARY/CACHE/BUILD_ARTIFACT/PROJECT_FILE/ARCHIVE classification in artifacts. Developer tooling knows its own temporary/lock filenames and build directories; the service worker knows its own static cache namespace. These are narrow implementation conventions, not a general rule that a user/project file is disposable. No current cleanup process uses artifact name/media type/URI to classify files for deletion.

## Provenance / Integrity Finding

Available provenance is project plus optional run and creation time. There is no producing job/agent/model/tool/input lineage or source/parent artifact relation. sha256 enforces syntax, not correspondence to physical content; size_bytes is an optional claim, not a measurement. MIME text is declared, neither detected nor checked. Native checks accept a missing physical file, dangerous-looking URI strings and long/reserved-looking names because there is no consumer. No DOCX/PDF parser validation, acceptance evaluator, content scanner, artifact versioning, safe replacement/CAS operation or immutable-byte store exists. Historical metadata can be changed through privileged SQL even after run success (check 5). With no ordinary artifact producer/editor, these are unimplemented integrity/ownership requirements rather than a regression in an exposed file workflow.

## Bible DOCX Readiness Finding

The user previously clarified that the Bible Lesson Generator was an example of the intended direction, not a required LeeOS automation. This audit does not promote it into the implemented V1 acceptance flow. For a generic DOCX use case, the current schema could describe a resulting file and link it to a project/run, but cannot generate, validate, store, register, format or deliver it. Python is an inactive preparation-only executor candidate, not a running document-generation component. No current LeeOS DOCX generator or Times New Roman 12 verification exists. The current acceptance test exercises the bounded text/review workflow. Nothing was generated or connected for this section.

## Storage Inventory Finding

No Storage Manager inventory or measurement endpoint/UI exists. Declared size_bytes values could be summed in SQL per project or optional run; nullable values, repeated URIs and shared references make that neither physical disk usage nor unique bytes. No per-automation aggregate exists without an indirect run join, and no implemented aggregate service does even that. PostgreSQL engine size functions and operating-system disk tools exist independently of LeeOS, but LeeOS has no database/log/memory/cache/repository size monitor, storage budget, warning event, threshold or cleanup recommendation logic. This audit did not implement monitoring or claim an inventory from schema columns.

## Cleanup Finding

No important user/project/artifact cleanup service was found. Actual removals are narrowly owned: UUID temporary config/snapshot files in finally blocks, demo/config lock files, newly created configuration rollback when setup fails, guarded disposable test directories, and older `leeos-shell-*` browser caches. API configuration tests verify existing database settings are preserved and partial setup rolls back. Focused PWA tests verify only older owned caches are removed, unrelated caches remain, and API/mutation/cross-origin requests are never intercepted. These are not artifact cleanup suggestions or user-facing cache-clearing controls. The current service worker caches static offline help only, not owner API results or work.

CLI request tools read a file path deliberately supplied by the local operator, with JSON/UTF-8/body-size checks. They are trusted local input paths, not server endpoints taking a model-supplied destination. They do not implement an artifact sandbox. Test/config cleanup is not authorized deletion of arbitrary project files, and no lifecycle policy decision is delegated to these routines.

## Delete / Missing / Orphan Finding

No artifact-delete API, metadata/byte removal transaction, tombstone, missing-file scan, orphan-file scan or permanent file-erasure operation exists. Required project and referenced run are protected by NO ACTION FKs; a run/project mismatch is rejected. Artifact ID mutation is rejected, but other metadata is mutable to the database role. A referenced artifact metadata row cannot be deleted while a memory FK refers to it; no FK can preserve external bytes. Unreferenced metadata can be deleted by privileged SQL while generic event artifact references remain. Native diagnostics only deleted disposable metadata rows, never physical artifact bytes or user files.

Records can reference missing files and accept arbitrary nonempty URI/path strings. There is no physical existence/hash comparison, detection event or recovery action. Bytes without metadata are likewise undetectable to LeeOS. Duplicate same-ID concurrent inserts yield one winner, but the same URI/hash/name can have multiple IDs; no request-idempotent registration or file deduplication exists. Artifact metadata mutation has no expectedVersion/stale update rejection protocol. No guarantee of recoverability follows from these records.

## Archive / Lifecycle Finding

Section 20 remains in force: archived parent status blocks new-work creation at current guarded entry points, while retained runs/grants/history remain separate. A disposable administrative project archive does not alter artifact metadata or history. No artifact archive, file availability gate, supported project archive API or file-only deletion feature exists. Metadata/bytes separation is a useful start for future file removal with retained state, but selected useful-memory preservation and rebuild manifests are not implemented. Storage Manager and Lifecycle Manager are both absent as coordinating services; neither currently absorbs the other.

## Access / Path Security Finding

The Hub and API have no artifact list/get/register/upload/download/update/delete routes. Native check 9 exercised GET/POST/PATCH/DELETE against artifact, foreign-project artifact, download-with-absolute-path and encoded traversal-looking paths: all return 404 before database access; missing authentication returns 401. No current API serializes storage_uri or reads a host file by artifact reference. Generic project/definition/checkpoint JSON is not a file access capability and could contain owner-supplied strings; no schema promise of universal path redaction is made.

Because there is no file consumer, accepting `../`, absolute drive paths, file: URIs or long/reserved names in SQL did not cause traversal or physical IO. This is absence of a consumer, not proof of normalization, symlink protection, root confinement, MIME security or upload/download authorization. These controls must be established before exposing a storage service. No destructive path tests were performed, no outside file was read via the API, and no secret file contents were used.

## Execution / Secret Safety Finding

Stored code or an artifact URI provides no execution authority. Executor adapters prepare inert metadata; Python/n8n/GitHub Actions/Lee360 have no launch implementation. Controlled worker actions accept strict reviewed run/job/agent scope and either local:text or owner:review, not a file path or storage grant. Native and focused tests preserve these fences. Agents have no artifact listing/reading/writing capability; there is also no future per-tool file capability mechanism yet.

Current owner/database credentials live in ignored server environment files, not registered artifacts. Setup uses exclusive/atomic private-file operations and refuses overwriting existing owner configuration. There is no artifact service ingesting credential files, but the permissive metadata schema itself does not detect secret content or prohibit a secret-bearing URI. Docs explicitly prohibit placing credentials/signed URLs in artifact locations, events, memories or checkpoints. Future secret references and storage scopes still need implementation; nothing here warrants printing or opening private credential files.

## GitHub / n8n / MCP Finding

Git is the source/configuration boundary; .next/dist/node_modules/.leeos/backups/environment/key files are ignored. There is no automatic generated-user-artifact producer or Git commit path. Arbitrary future DOCX/PDF output filenames are not globally ignored by .gitignore, so a future export location must be intentionally selected rather than assuming Git exclusion. No typed owned repository reference, n8n workflow/file reference, MCP resource-to-artifact mapping, external storage connector or storage-provider abstraction exists. Root manifest planned integrations and executor IDs are not working storage adapters.

## Cost Finding

No paid object/external-storage provider was configured or invoked. Core ZERO_ONLY rejects unknown/nonzero cost, and current integrations remain inactive. There is no storage-specific quota/pricing verification/provider cost gate to certify yet. Future object storage must supply verified cost evidence; an advertised free tier alone is insufficient. No external account or service was connected for the audit.

## Auditability Finding

Artifact created_at/project/run are minimal metadata, not lifecycle/provenance events. Search found no application writer for artifact.created/validated/archived/deleted/missing or storage.warning/cleanup events. Generic event insertion can accept such a kind but does not implement its semantics. Privileged artifact updates/deletes have no dedicated audit record. Existing run/provider/approval/assignment events/receipts remain transactional and were revalidated. The native artifact diagnostic has a saved, reproducible check log; fixture event kinds are explicitly audit fixtures, not runtime features.

## Dangerous Coupling

**No blocking storage-layer coupling detected.** There is no storage service acting as Lifecycle, Execution, Memory, Project Manager, Cost Guard or UI authority. Existing cleanup stays within developer-owned temporaries/static caches; stored strings do not trigger execution or cleanup. Future code must not interpret the current permissive URI/filename fields or raw memory/event references as already authorized file access.

## Current Regressions

No demonstrated defect in a currently exposed artifact/storage workflow was found. There is no such producer/consumer workflow to repair. Native checks demonstrate schema debt: mutable historical metadata, standalone reparenting, cross-project memory evidence, duplicate locations, unverified paths/hash/size/MIME, dangling generic event references and missing-file acceptance. Sections 9/20 already separated these foundations from their future services. They must not be presented as implemented isolation/integrity guarantees, but enforcing an invented immutable-output/sharing/storage policy during this audit would exceed the authorized scope.

## Repairs Made

No runtime, database migration, Hub, package or configuration changes. Added only this diagnostic report and an isolated reproducible native audit script/result outside product source. No Storage Manager, upload/download API, object provider, cleanup engine, document generator or future ownership policy was introduced.

## Validation Evidence

1. Source audit: all runtime packages, Hub/API, executor catalog, migrations, developer filesystem operations, ignored paths, backup instructions and relevant prior diagnostics were searched/read. No app artifact SQL producer/consumer exists beyond the schema/ID catalog.
2. Native script: `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/storage-boundary-audit.ts` — **10 passed diagnostic groups**, including the required supported ownership/reference/duplicate/mutation/missing-path/archive checks. Some assertions deliberately verify permissive behavior; a green check does not imply a finished feature.
3. Existing native contracts: `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts` — **79 passed**, zero failed, including the Section 20 lock races, retained grants and active-result completion.
4. Focused tooling/cleanup/execution: `node --import tsx --test tests/pwa.test.ts tests/api-config.test.ts tests/execution.test.ts tests/worker.test.ts` — **29 passed**, zero failed.
5. Both native runs used locally generated, pattern-validated schemas, dropped in finally. Dedicated PostgreSQL 17 audit server was restored to its initial stopped state. No normal Hub preview or user database was altered.
6. No build/lint/typecheck rerun for this section: product source/configuration was unchanged; their Section 20 pass remains the last such verification. Audit script is executed via tsx outside the product tsconfig; no static-typecheck claim is made for it. No paid storage, actual model inference, user file deletion, DOCX output or new backup was performed.

Unsupported tests are stated explicitly: there is no ordinary artifact registration/mutation/replacement endpoint, stale artifact command, upload/download sandbox, physical-byte deletion or scoped cross-project storage service race to exercise. Native same-ID insert races and mismatched composite-FK mutations were tested instead; arbitrary path strings were inserted as inert metadata, not opened or deleted. Generic history remains readable after administrative project archive. File backup/restore verification was not performed.

## Future Storage Gaps

Storage Manager inventory and technical-cleanability classification; safe storage-provider seam/root confinement; owner-aware registration and retrieval; upload/download limits and authorization; user/generated/temp provenance classes; creator/job/agent/model/input lineage; same-project or explicitly shared evidence references; hash/size/MIME/format validation against bytes; typed artifact outputs and acceptance checks; immutable-output versus working-file/version policy; idempotent registration and concurrency; missing/orphan detection; tombstones/retention; explicit lifecycle-authorized file cleanup; storage budgets/events; verified artifact-byte backups and recovery; owned GitHub/n8n/MCP/external resource references; verified zero-cost storage activation. None were automatically built.

## Recommended Next Step

Continue with Lee's supplied Section 22 blueprint audit. Do not automatically implement the Storage Manager or reinterpret the Bible example as a required automation. Before future file features go live, make ownership, path, untrusted-content and execution boundaries explicit rather than relying on the placeholder metadata schema.

## Evidence files

- [Native audit script](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/storage-boundary-audit.ts)
- [Native diagnostic results](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/section21-storage-checks.json)
- [Artifact schema](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/database/migrations/001_state.sql:53)
- [API dispatcher](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/api/http.ts)
- [Execution boundary](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/executors/src/index.ts)
- [PWA cleanup](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/apps/hub/public/sw.js)
- [Backup instructions](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/docs/backup-and-recovery.md)
- [Section 20](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/docs/diagnostics/section-20-lifecycle-manager.md)
