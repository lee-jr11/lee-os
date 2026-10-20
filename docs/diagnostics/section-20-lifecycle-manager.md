# Section 20 diagnostic — Lifecycle Manager / Archive / Delete / Rebuild

Audit date: 2026-10-18. LeeOS 0.18.1, Structure 18. Blueprint compliance and current milestone health are separate judgments. No user database, automation, repository, artifact or credential was archived/deleted; lifecycle scenarios use disposable fixtures and administrative status updates.

## Blueprint Section

Section 20 — Lifecycle Manager / Archive / Delete / Rebuild.

## Overall Lifecycle Verdict

🟡 PARTIALLY ALIGNED. State/history boundaries exist, but no Lifecycle Manager, supported archive/restore/delete/rebuild workflow, Storage Manager or useful-memory preservation pipeline exists.

## Current Milestone Verdict

🟢 IMPLEMENTED + VERIFIED for the currently exposed foundation after repair. Two availability defects were found: manual run creation ignored paused/archived automation state, and new-work entry points ignored archived parent projects. The repaired checks preserve historical replay and existing-run authority. This verdict does not certify a complete lifecycle platform.

## Lifecycle Capability Matrix

Evidence keys refer to actual source/tests below. ⚪ NOT STARTED = absent; 🟡 PARTIAL = foundation/limited boundary only; 🟢 IMPLEMENTED + VERIFIED = scoped capability verified; 🔴 BROKEN / REGRESSION = unresolved current defect. No unresolved demonstrated defect remains in the inspected scope.

- S: packages/database/src/state.ts; tests/helpers/state-contract.ts.
- C: packages/core/src/scheduler/index.ts; tests/helpers/coordination-contract.ts.
- I: packages/core/src/request-intake/store.ts; tests/helpers/intake-contract.ts.
- W: packages/core/src/job-worker and tests/helpers/worker-contract.ts.
- M: packages/database/migrations/001_state.sql through 008_request_intake.sql.
- H: packages/core/src/api/http.ts, contracts.ts, service.ts and API/Hub tests.
- N: tests/postgres.integration.ts (native transactions and generated isolated schema).

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Lifecycle Manager boundary | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Project lifecycle | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Automation lifecycle | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Project/automation separation | 🟢 IMPLEMENTED + VERIFIED | M; coordination archive test | Yes | Independent rows; project archive fixture leaves child definition draft. |
| Active semantics | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Pause semantics | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Archive semantics | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Archive/pause separation | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Archive/delete separation | 🟡 PARTIAL | S, C, M; guard tests | Guards now; full transitions future | Status fields and availability checks; no versioned lifecycle transitions. Project pause/completed policy undefined. |
| Restore | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Delete modes | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Historical-run protection | 🟢 IMPLEMENTED + VERIFIED | M, H; state/API tests and native FK catalog | Yes | No ordinary delete API; referenced definition deletion rejected; no cascade FKs. Privileged SQL is outside API authority. |
| Cascade safety | 🟢 IMPLEMENTED + VERIFIED | M, H; state/API tests and native FK catalog | Yes | No ordinary delete API; referenced definition deletion rejected; no cascade FKs. Privileged SQL is outside API authority. |
| Destructive authorization | 🟡 PARTIAL | H; owner API tests; server new-work guards | Yes for exposed operations | Existing owner authorization is enforced; no destructive lifecycle endpoint or scoped purge approval exists. |
| Server authority | 🟡 PARTIAL | H; owner API tests; server new-work guards | Yes for exposed operations | Existing owner authorization is enforced; no destructive lifecycle endpoint or scoped purge approval exists. |
| Archive idempotency | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Restore idempotency | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Stale-command rejection | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Lifecycle concurrency | 🟡 PARTIAL | N native lock test, S, C | New-work safety now | Manual/time/event queue decisions wait for archive status commit; archive/restore command races unavailable. |
| Archive-during-run semantics | 🟢 IMPLEMENTED + VERIFIED | W retained grant/active-result test; S history test | Yes, existing-run boundary | Existing runs/assignments/grants remain valid; explicit run cancellation/dismissal is separate. Synthetic SQL status, not lifecycle API. |
| Future-run blocking | 🟢 IMPLEMENTED + VERIFIED | S, I, C; new regressions plus N | Yes; repaired | Archived project rejects new work; manual paused/archived automation rejected; matching historical replay retained. |
| Manual-run archive behavior | 🟢 IMPLEMENTED + VERIFIED | S, I, C; new regressions plus N | Yes; repaired | Archived project rejects new work; manual paused/archived automation rejected; matching historical replay retained. |
| Scheduler/archive interaction | 🟢 IMPLEMENTED + VERIFIED | C, N; synthetic archive tests | Yes; repaired | Archived project => blocked PROJECT_ARCHIVED receipt and disable when polled. Automation unavailable/version mismatch also blocks. No immediate propagation service. |
| Trigger/archive interaction | 🟢 IMPLEMENTED + VERIFIED | C, N; synthetic archive tests | Yes; repaired | Archived project => blocked PROJECT_ARCHIVED receipt and disable when polled. Automation unavailable/version mismatch also blocks. No immediate propagation service. |
| Queued-run archive behavior | 🟢 IMPLEMENTED + VERIFIED | W retained grant/active-result test; S history test | Yes, existing-run boundary | Existing runs/assignments/grants remain valid; explicit run cancellation/dismissal is separate. Synthetic SQL status, not lifecycle API. |
| Agent/archive interaction | 🟢 IMPLEMENTED + VERIFIED | W retained grant/active-result test; S history test | Yes, existing-run boundary | Existing runs/assignments/grants remain valid; explicit run cancellation/dismissal is separate. Synthetic SQL status, not lifecycle API. |
| Grant/archive interaction | 🟢 IMPLEMENTED + VERIFIED | W retained grant/active-result test; S history test | Yes, existing-run boundary | Existing runs/assignments/grants remain valid; explicit run cancellation/dismissal is separate. Synthetic SQL status, not lifecycle API. |
| Project archive propagation | 🟡 PARTIAL | C, S, I, W | New-work fencing now | No child status propagation; guards stop new work; observed triggers disable; existing runs/history/resources preserved. |
| Project restore | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Definition-version preservation | 🟡 PARTIAL | S, M; snapshot tests | Existing revisions now | Definition revisions and run snapshots retained; status edits do not bump definition version; no restore/rebuild version policy. |
| Stale-schedule fencing | 🟡 PARTIAL | C; version tests and synthetic reactivation v2 test | Version pins now | Old v1 cannot target v2. Same-version archive/restore entirely between polls has no generation fence; no supported restore command. |
| Stale-subscription fencing | 🟡 PARTIAL | C; version tests and synthetic reactivation v2 test | Version pins now | Old v1 cannot target v2. Same-version archive/restore entirely between polls has no generation fence; no supported restore command. |
| Rebuild manifest | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| leeos.manifest role | 🟢 IMPLEMENTED + VERIFIED | leeos.manifest.json; manifest validation tests | Yes | Root system inventory/policy only; not per-automation reconstruction data. |
| Restore/rebuild separation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Rebuild authorization | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Rebuild versioning | 🟡 PARTIAL | S, M; snapshot tests | Existing revisions now | Definition revisions and run snapshots retained; status edits do not bump definition version; no restore/rebuild version policy. |
| Memory preservation foundation | 🟡 PARTIAL | M memories/artifacts; Section 9 findings | Schema only now | Optional project/evidence FKs; referenced metadata deletion restricted. No distillation/retrieval/retention service; artifact bytes and cross-project evidence scope not enforced. |
| Memory distillation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Memory/evidence retention | 🟡 PARTIAL | M memories/artifacts; Section 9 findings | Schema only now | Optional project/evidence FKs; referenced metadata deletion restricted. No distillation/retrieval/retention service; artifact bytes and cross-project evidence scope not enforced. |
| Memory scope after archive | 🟡 PARTIAL | M memories/artifacts; Section 9 findings | Schema only now | Optional project/evidence FKs; referenced metadata deletion restricted. No distillation/retrieval/retention service; artifact bytes and cross-project evidence scope not enforced. |
| Memory purge | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Artifact lifecycle classes | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Artifact ownership | 🟡 PARTIAL | M artifacts definition/composite FK | Schema only now | Project + optional same-project run metadata; no automation/job/agent ownership or file classes/byte cleanup. |
| Delete-files-only foundation | 🟡 PARTIAL | M artifacts definition/composite FK | Schema only now | Project + optional same-project run metadata; no automation/job/agent ownership or file classes/byte cleanup. |
| User/generated-file distinction | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Temporary/cache classification | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Storage Manager | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Storage inventory | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Cleanup suggestions | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Automatic-delete safety | 🟢 IMPLEMENTED + VERIFIED | H, scripts and module inspection | Yes | No automatic important project/user-file deletion path; disposable fixture/build cache cleanup is separate. |
| Log retention | 🟡 PARTIAL | M, run/provider stores, backup docs | Evidence preservation now | Persisted events/checkpoints/results; no unified retention, archival log tier or pruning policy. |
| Event retention | 🟡 PARTIAL | M; state/worker/intake/native tests | Preserve current history now | Status mutation does not delete history; append-only protections on relevant ledgers/receipts. No lifecycle retention policy or complete immutable cost ledger. |
| Cost-history retention | 🟡 PARTIAL | M; state/worker/intake/native tests | Preserve current history now | Status mutation does not delete history; append-only protections on relevant ledgers/receipts. No lifecycle retention policy or complete immutable cost ledger. |
| Review-history retention | 🟡 PARTIAL | M; state/worker/intake/native tests | Preserve current history now | Status mutation does not delete history; append-only protections on relevant ledgers/receipts. No lifecycle retention policy or complete immutable cost ledger. |
| Lifecycle events | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Archive visibility | 🟡 PARTIAL | S list methods, Hub panels | Honest labels now | Archived rows still listed; no archive filter/view. |
| Hub lifecycle controls | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Lifecycle-label honesty | 🟢 IMPLEMENTED + VERIFIED | Hub automation/coordination panels; API DTOs | Yes | Displays actual status; schedule disabled, run cancellation and agent dismissal not labelled deleted. |
| Dependency cleanup | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| GitHub-resource tracking | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Git-history separation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| n8n-resource tracking | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| External-resource registry | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| External-delete safety | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| External-effect confirmation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Secret lifecycle | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Credential references | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Orphan prevention | 🟡 PARTIAL | M FK/composite constraints; negative tests | Database references now | Referenced project/run/automation rows protected; external bytes/resources and optional memory source ownership not fully modelled. |
| Orphan detection | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Permanent purge | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Purge preview | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Purge confirmation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Purge idempotency | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Backup foundation | 🟡 PARTIAL | docs/backup-and-recovery.md; clean-close tests | Documentation now | Manual dump/restore instructions and source/config foundation; no automatic backup/rebuild service. Native pg_dump recovery not exercised in this audit. |
| Backup/archive separation | 🟡 PARTIAL | docs/backup-and-recovery.md; clean-close tests | Documentation now | Manual dump/restore instructions and source/config foundation; no automatic backup/rebuild service. Native pg_dump recovery not exercised in this audit. |
| Git rebuild foundation | 🟡 PARTIAL | docs/backup-and-recovery.md; clean-close tests | Documentation now | Manual dump/restore instructions and source/config foundation; no automatic backup/rebuild service. Native pg_dump recovery not exercised in this audit. |
| Manifest+memory rebuild | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Lifecycle/cost separation | 🟡 PARTIAL | S, C, I, W, M; native suite | Existing boundaries now | New-work guards do not grant spending/dispatch or rewrite evidence. Dedicated coordinating Lifecycle Manager and lifecycle events remain absent. |
| Lifecycle/event separation | 🟡 PARTIAL | S, C, I, W, M; native suite | Existing boundaries now | New-work guards do not grant spending/dispatch or rewrite evidence. Dedicated coordinating Lifecycle Manager and lifecycle events remain absent. |
| Lifecycle/memory separation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Lifecycle/scheduler separation | 🟡 PARTIAL | S, C, I, W, M; native suite | Existing boundaries now | New-work guards do not grant spending/dispatch or rewrite evidence. Dedicated coordinating Lifecycle Manager and lifecycle events remain absent. |
| Lifecycle/execution separation | 🟡 PARTIAL | S, C, I, W, M; native suite | Existing boundaries now | New-work guards do not grant spending/dispatch or rewrite evidence. Dedicated coordinating Lifecycle Manager and lifecycle events remain absent. |
| Lifecycle/PM separation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Lifecycle/storage separation | ⚪ NOT STARTED | API, schema and module inspection | Future | No corresponding lifecycle command/service or ownership protocol. |
| Cross-project isolation | 🟡 PARTIAL | State/API/coordination/agent native tests | Existing operation scope now | Foreign-project targets rejected and unrelated project remains runnable; no cross-project archive command exists to test. |
| Shared-resource safety | 🟡 PARTIAL | No external/credential deletion API; module inspection | No accidental deletion now | No shared-resource cleanup path; ownership/reference counting still absent. |
| Lifecycle auditability | 🟡 PARTIAL | S, C, I; transactional event tests | Existing actions now | Existing creations/revisions/cancellations/trigger receipts audited; administrative status changes emit no archive/restore event. |

## Current Project Lifecycle

Stored statuses: `draft`, `active`, `paused`, `completed`, `archived`; creation defaults to `draft`. Public project PATCH renames only. No status-transition command, lifecycle version or transition graph exists. Archived status now blocks fresh automation definitions, new intake, new intake approval and new runs. Existing retained definitions remain editable/readable. `paused`/`completed` have no implemented project-wide execution semantics. `active` is not required for the currently reviewed draft workflows.

## Current Automation Lifecycle

Stored statuses: `draft`, `active`, `paused`, `archived`; default `draft`. API supports creation and expected-definition-version revision, not lifecycle transitions. Manual new runs now reject paused/archived definitions, consistent with existing Hub and scheduler checks. A run snapshots definition/version; later edits do not rewrite it. Identity/status and historical execution are separate.

## Archive Finding

There is no archive command. Administrative archived status is now honored at new-work boundaries. It retains names, definitions, runs and history; it does not hide normal list results, revoke prior grants, cancel work, clean files or propagate child status. SQL fixtures demonstrate guards, not an implemented archive workflow. This repairs the narrower parent-availability gap carried forward from Sections 16–19 without claiming those deferred lifecycle features were built.

## Pause / Archive / Delete Finding

Automation paused and archived both block new manual/managed-trigger runs, but no distinct transition/reversibility/visibility policies exist yet. Schedule disablement only stops polling that schedule. Run cancellation and agent dismissal are separate versioned operations. No file-only or permanent resource-delete API exists. DELETE routed through the Hub catch-all is rejected by supported-method checks; exporting an HTTP method is not a deletion feature.

## Restore Finding

No project or automation restore command exists. SQL changing a status back is not restoration. Old definition-version pins cannot authorize a revised v2 automation. A status-only archive/restore cycle entirely between polls can go unnoticed at the same definition version; a future lifecycle command needs explicit generations and resume policy. Once polling has disabled a subscription after observing archive, flipping status alone does not enable it. Consumed one-time schedules stay consumed.

## Active-Run / Queued-Run Finding

Current rule: definition retirement blocks NEW runs, while previously queued/running runs retain their snapshots and controlled execution authority. State tests finish an existing generic job after parent/definition retirement. A fixture provider call held in flight during project archive succeeds; the already prepared second job and explicit owner review can finish. Native tests use a fixture transport, never actual inference. Existing cancellation/dismissal still revokes acceptance as tested separately. No OS-process termination or blanket project cancellation is implied.

## Scheduler / Trigger Finding

Registration/enabling checks parent availability and target definition/version. At polling, archived parent produces a `blocked` receipt, reason `PROJECT_ARCHIVED`, no run, and disables the affected trigger. Existing paused/archived automation or version mismatch produces `AUTOMATION_CHANGED_OR_UNAVAILABLE`. Project row SHARE locks serialize those decisions with concurrent status updates. Native tests hold an administrative archive transaction, verify queue operations are blocked on its lock, commit, then verify manual/time/event work is refused. This is serialization, not priority for archive over already committed work. No eager scan disables every future trigger at archive time because no archive command exists.

## Agent / Grant Finding

No archive propagation dismisses agents or revokes assignments/grants. They remain scoped to an existing run/job, reviewed plan, agent version and model fingerprint. Active-result and retained-follow-up tests verify this explicitly. New run blocking does not prohibit preparing or authorizing remaining steps within a retained run; full project freeze is not implemented. Use explicit existing run cancellation/dismissal when revocation is intended.

## Historical Integrity Finding

No ON DELETE CASCADE or SET NULL clauses exist in migrations; foreign keys default to NO ACTION. Native catalog checks find zero cascading FKs in the disposable schema. Deleting a referenced automation is rejected. Composite foreign keys protect run/project, agent/run and assignment/job scope. Events, revisions, mappings and receipts have relevant append-only guards; this does not make every base row or usage row globally immutable against privileged SQL. No ordinary historical run deletion route exists. Snapshot, event, approval and execution tests verify history remains readable after status changes and clean close/reopen.

## Rebuild Finding

Root `leeos.manifest.json` is system inventory/version/policy metadata, not a per-automation rebuild manifest. Retained definitions, plan snapshots, decisions and receipts help explain what existed but do not reconstruct removed implementation/resources. There is no restore/rebuild API, build authorization, reconstruction job or deploy process. Definition versioning is a useful foundation, not verified rebuilding. A future manifest must remain descriptive and acquire reviewed build authority separately.

## Memory Preservation Finding

`memories` is a schema placeholder: optional project and source-artifact references plus JSON content. No retrieval, distillation, trust verification, purge or useful-knowledge preservation service exists. FK protection prevents deleting referenced artifact metadata; it cannot preserve external file bytes or establish evidence quality. Same-project evidence ownership is not fully enforced by that optional artifact FK, as carried forward from Section 9. No retrieval path currently exposes an archive-related cross-project leak; future scope must be designed explicitly.

## Artifact / Storage Finding

Artifacts have project ownership, optional same-project run, URI/name/media/hash/size metadata. There is no automation/job/agent ownership chain, lifecycle class, user/generated distinction, physical byte deletion manager, inventory accounting or cleanup recommendation service. Hash/size fields are not actual storage verification. No automatic deletion of important project/user files was found. Build/PWA caches, lock/temp files and guarded disposable test cleanup do not constitute project resource purging.

## External Resource Finding

GitHub Actions, n8n, Python and Lee360 remain planned adapter boundaries. No owned GitHub repository/n8n workflow/cloud-resource registry, reference-only versus actual delete operation, external destruction receipt or uncertain-effect reconciliation exists. No external resource was contacted or deleted. Git source is separate from generated files/live database; no automation Git reconstruction has been verified.

## Secrets Finding

Current server configuration uses ignored environment files for database/owner authentication. No project credential ownership, shared reference accounting or per-resource revocation service exists. There is no lifecycle path deleting global credentials. No private environment contents or connection URL were printed, and no secret was committed. Future resource cleanup must track references rather than copy or delete shared secrets implicitly.

## Orphan Finding

FKs prevent missing referenced database parents, and composite keys protect important project/run/agent scopes. Optional references and absent physical/external ownership leave file/cloud orphans outside that protection. No orphan inventory, detector, sweeper or permanent purge exists; none was added.

## Backup Finding

`docs/backup-and-recovery.md` documents manual PostgreSQL pg_dump/pg_restore into a separate empty database, artifact byte backup and consistent whole-history recovery. Those native backup commands were inspected, not executed for this audit. Automated backup scheduling/retention and per-resource restore do not exist. Existing embedded clean-close persistence/snapshot tests passed. Git covers source/config, not live DB or artifacts; archive is not backup and restoring stale backups cannot prove outside effects after the backup boundary.

## Lifecycle / Cost / Event Boundary

New-work availability checks do not grant execution, enable a paid provider, relax ZERO_ONLY or mutate historical cost evidence. Existing owner review, provider reservation and grant rules remain. Existing trigger events/blocked receipts are transactional; no project.archived/automation.restored/purge event exists because those commands do not exist. Current administrative status changes have no lifecycle event.

## Cross-Project Isolation Finding

State regression confirms an archived project does not prevent an unrelated project from creating a run. Existing API/coordination/assignment tests reject foreign-project or foreign-run targets. No public cross-project archive attempt can be exercised because there is no archive command. This verifies existing scope only, not future cleanup/shared-resource isolation.

## Auditability Finding

Creation, revision, queued-run, trigger outcome, approval, cancellation, assignment, dismissal and execution evidence use transactional events/receipts. No archive/restore/delete history or lifecycle actor/version receipt exists. Native lock fixtures change administrative status only and are explicitly not presented as supported auditable lifecycle commands.

## Dangerous Coupling

The earlier automation UI checked paused/archive state while manual backend creation did not: that availability safety depended on UI behavior. Repaired with backend checks. Project new-work checks are now shared transaction helpers consumed by state, intake and coordinator; they do not absorb storage, execution or memory responsibilities. Scheduler disables only triggers it observes as blocked, rather than pretending to be a Lifecycle Manager. No blocking lifecycle-layer coupling detected after repair in the implemented scope.

## Current Regressions

Before repair: backend manual creation accepted paused/archived automation definitions; archived parent projects could admit new definitions/intake/approved runs and managed-trigger/manual runs. The added state regression failed before changes with `Missing expected rejection (StateConflict)` at the paused-definition case. Source traces identified equivalent new-work entry points. These are genuine availability defects; absent purge/rebuild/memory platforms are future gaps, not regressions. No demonstrated unresolved current-stage defect remains after validation.

## Repairs Made

1. Added shared project availability checks with transactional row locking.
2. Blocked new runs for archived projects and paused/archived automations; preserved original same-key replay and request mismatch checks.
3. Blocked fresh automation creation, intake creation and first intake approval under archived projects; retained prior idempotent receipts.
4. Added project checks to trigger registration/enabling and queue processing; archive observation records a blocked receipt and disables the trigger.
5. Added state/intake/coordination/worker regressions plus native manual/schedule/event lock races. Documented exact limited semantics in `docs/core-api.md`.

No migrations, archive/restore endpoint, file deletion, purge, storage service, agent revocation rule or cost-policy relaxation was introduced.

## Validation Evidence

- Before repair: `node --import tsx --test tests/state.test.ts` failed the new retired-definition regression; parent suite failure is the same failing child, not a separate defect.
- Focused: `node --import tsx --test tests/state.test.ts tests/coordination.test.ts tests/intake.test.ts` — 38 passed.
- `npm test` — 143 passed. This run began before the final added worker lifecycle test; that added case was verified in the subsequent native suite.
- Final native: `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts` — 79 passed, including the added active-result test and three native lock races; generated schema removed in finally.
- `npm run lint` — passed. `npm run typecheck` — passed.
- `npm run build` — initial sandbox attempt compiled/typechecked, then EPERM creating a generated static page directory; escalated retry: passed (all static pages generated, route/build traces completed).
- Dedicated test PostgreSQL server started only for isolated tests and restored to stopped state. No normal preview server was altered. No paid calls, real inference, external cleanup or user-resource destruction.

Unsupported tests: duplicate/stale archive, archive-vs-restore commands and cross-project archive command are not applicable because those commands do not exist. Synthetic status changes test availability and history only. Stale v1 subscription reactivation after administrative return to draft plus definition v2 is rejected; ordinary schedule-version regression independently rejects changed versions. No same-version restore safety is claimed.

## Future Lifecycle Gaps

Versioned/idempotent/authorized lifecycle commands and events; explicit project pause/archive/restore and child propagation rules; restore generations; selective file cleanup with ownership classes and preview; useful-memory evidence retention/distillation; resource rebuild manifests; controlled rebuild/deploy; external ownership/uncertain-effect receipts; shared secret references; orphan inventory; purge confirmation/idempotency; operational backup/retention verification. These remain separate future work.

## Recommended Next Step

Continue with Lee's next supplied blueprint audit (Section 21). Do not implement the Lifecycle/Storage/Memory/rebuild platforms automatically. Preserve the distinction between pause, archive, file removal, permanent erasure, restore and rebuild.
