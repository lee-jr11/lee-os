# Section 9 — Memory Check / Context Retrieval

Audit date: 2026-10-18. Implementation: 0.18.1 / Structure 18. Useful Memory Manager remains **NOT STARTED**, beyond schema/placeholders. This audit inspects foundation/readiness, not feature implementation. No runtime code, dependency, SQL migration, permission, configuration or memory service changed.

## Overall Memory Verdict

🟡 **PARTIALLY ALIGNED** architecturally; useful memory functionality is **⚪ NOT STARTED**. Separate storage concepts, durable IDs and scoped application services are suitable foundations. Typed memory scope, provenance, confidence, trust, lifecycle, retrieval and authorization still need design. Existing SQL rows/results/logs are not a memory implementation.

## Current Milestone Verdict

**Healthy within the verified persistent-state/local-execution milestone.** It does not claim useful memory. No current-stage terminology/security defect requiring a repair was demonstrated. Placeholder schema limitations are not automatically regressions or active data leaks.

## Memory Capability Matrix

Evidence: S = current source/schema/docs search and trace; F = 51 focused existing tests; D = nine direct synthetic SQL schema checks. Green applies to a verified foundation/boundary only, not a functional memory system. “No” in Expected Now means not part of this milestone.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Memory/state separation | 🟢 IMPLEMENTED + VERIFIED | S distinct tables/no runtime memory path; F state contracts | Conceptual separation yes | Keep future learned knowledge distinct from authoritative state |
| Memory/event separation | 🟢 IMPLEMENTED + VERIFIED | S separate memories/events; F transactional append-only event tests | Separation yes | No distillation pipeline yet |
| Memory/log separation | 🟡 PARTIAL | S logs not consumed as memory; no memory reader | Intended roles yes | Future technical evidence ingestion/review |
| Memory/artifact separation | 🟡 PARTIAL | D separate reference tables/FK | Schema separation yes | No artifact manager; source-scope/retention rules incomplete |
| Memory schema foundation | 🟢 IMPLEMENTED + VERIFIED | D fields, ID/JSON/FKs/immutability | Placeholder yes | Not a complete memory record contract |
| User memory | ⚪ NOT STARTED | S no preference-memory service | No | Typed stable preferences/review |
| Engineering memory | ⚪ NOT STARTED | S evidence sources only | No | Distillation/generalization and scope |
| Project memory | ⚪ NOT STARTED | D optional project FK only | No | Project-scoped learned knowledge service |
| Automation memory | ⚪ NOT STARTED | S no automation_id link | No | Automation identity/version provenance/lifecycle |
| Model/agent performance | ⚪ NOT STARTED | F call/usage durability; S separate performance placeholder | No | Observed evaluation/aggregation/routing feedback |
| Memory creation/distillation | ⚪ NOT STARTED | S no writer or ingestion service | No | Selection, distillation, evidence and review |
| Evidence/provenance | 🟡 PARTIAL | D source-artifact FK; F stable run/job/event records | Stable reference foundation | Typed multi-source evidence, versions and trust |
| Confidence | ⚪ NOT STARTED | S no confidence/verification fields/service | No | Confidence semantics/calibration/last verification |
| Scoping | 🟡 PARTIAL | D nullable project_id/FKs and cross-scope limitation | Project-reference foundation | Typed user/engineering/automation scopes plus permission enforcement |
| Targeted retrieval | ⚪ NOT STARTED | S no memory query/context injection | No | Bounded scope/relevance/budget-aware retrieval |
| Deterministic retrieval | ⚪ NOT STARTED | S no retrieval API | No | Indexed structured query service |
| Semantic retrieval | ⚪ NOT STARTED | S no embedding/vector requirement/dependency found | No | Optional later mechanism only if justified |
| Lifecycle/supersession | ⚪ NOT STARTED | S only generic mutable row timestamps | No | Version/review/archive/invalidate/forget semantics |
| Contradiction handling | ⚪ NOT STARTED | S no policy/service | No | Scope priority, evidence conflict and supersession |
| Archive survival | 🟡 PARTIAL | D IDs/references; artifact metadata delete restricted | Storage-reference foundation | Retention/detachment and identity lifecycle |
| Rebuild manifest support | 🟡 PARTIAL | F versioned definitions/run/plan snapshots | Existing snapshots yes | Complete build/version/source/dependency manifest absent |
| Secret isolation | 🟡 PARTIAL | S docs prohibit credentials; F auth/error/provider boundaries | Existing paths yes | JSON placeholder has no secret detection/creation policy |
| Permission-aware retrieval | ⚪ NOT STARTED | S scoped assignments exist, no memory capability | No | Server-side authorization/filtering and source scopes |
| Poisoning resistance | ⚪ NOT STARTED | S no automatic ingestion/consumer; no trust fields | No memory channel yet | Trust/review/source validation before promotion/use |
| Retrieval auditability | ⚪ NOT STARTED | S no memory-used trace | No | Memory revision/hash/query/decision references |
| Feedback/verification | ⚪ NOT STARTED | F reviews/results exist as possible evidence | No | Verified usefulness/correction outcomes |
| $0 retrieval path | 🟡 PARTIAL | Existing PostgreSQL foundation; no paid vector requirement | Architectural compatibility | No implemented or benchmarked retrieval service |

## What LeeOS Currently Calls Memory

Search inventory of current first-party source/docs/schema/manifest (no functionality inferred from a word):

- `packages/database/migrations/001_state.sql`: memories placeholder, project index, ID constraint and ID/update triggers. `packages/database/src/ids.ts`: memory→mem ID prefix. These are schema/identity support only.
- `leeos.manifest.json`: goal-memory-retrieval is deferred; memory-only-owner-connection means volatile browser RAM, not learned memory.
- `apps/hub/components/workbench.tsx`: owner key stays in connection memory and clears on lock/reload. No Memory screen or memory API is implied.
- `scripts/lib/embedded-database.ts`: memory plus clean-close snapshots describes the test database harness, not distilled knowledge.
- `docs/structure-2.md`: ordinary verb “remember what exists,” a memories storage shelf and explicit later-service boundary; warns against credentials/conversations in JSON. This does not call all persistence useful memory.
- `docs/backup-and-recovery.md`: backups can contain project content and memory because dumps include any populated schema rows; this is a privacy warning, not a claim of automatic learning.
- `docs/core-api.md`, `docs/structure-12.md`, `docs/structure-14.md`, `docs/validation-structure-12.md`: volatile owner connection/key memory.
- `docs/structure-15.md`, `docs/structure-16.md`: volatile connection/idempotency-key memory, not knowledge storage.
- `docs/structure-3.md`, `docs/structure-4.md`, `docs/validation-structure-4.md`: in-memory test/demo database.
- `packages/core/src/orchestrator/README.md`: useful memory delegation explicitly unimplemented. `docs/diagnostics/section-01` through `section-08`: distinguish missing useful memory, schemas and future architecture.
- No current memory REST schema, functional module, UI or vector/embedding service was found in the inspected source/contracts. No matches for configured vector/embedding products/dependencies were found in root/workspace package manifests/lock search. Generic JavaScript RAM references are not memory features.

The inventory records pre-existing uses; this report is an additional diagnostic use. No misleading learned-memory completion claim was found that justified renaming persistence or RAM terminology.

## Placeholder Schema Finding

Actual memories fields:

| Field | Actual contract |
|---|---|
| id | text primary key, mem_ UUID-v4 format, immutable ID trigger |
| project_id | nullable project FK; null can represent a global row, but no typed global-user scope exists |
| kind | non-null text; no category enum, allowed-kind policy or minimum-content requirement |
| content | non-null JSONB object; no typed knowledge/evidence/trust/confidence contract |
| source_artifact_id | nullable artifact FK, one source reference only |
| created_at | non-null timestamptz, defaults now |
| updated_at | non-null timestamptz, defaults now, generic touch trigger |

There is a project_id index. There are no automation/run/job/event evidence joins, tags/search indexes, embedding fields, confidence, verification, trust, revision, superseded_by, archive status, retention or ACL fields. JSON could syntactically contain such values, but that is not a validated/indexed service contract.

Nine direct SQL checks in a fresh disposable embedded PostgreSQL schema verified expected fields/no seed rows; ID format; object-only content; missing-project rejection; nullable global project/arbitrary kind; immutable ID; missing-artifact rejection; cross-project source reference permissiveness; and referenced-artifact deletion restriction. Synthetic inserts are test fixtures, not memory creation functionality.

## Current Memory Writes

**No application memory writers were found** in core/database repository methods, Hub, scripts or tests searched before the diagnostic fixture. Migrations create/index/constrain the empty table; they do not seed useful memories. State/event/call/result writes target their own tables. Raw model output remains a provider-call result, not an automatically distilled memory.

This audit's direct synthetic SQL inserts existed only inside a temporary embedded database that was closed after validation. No normal user database content was queried or changed, and no claim is made that every externally/manual-populated installation contains zero memory rows.

## Current Memory Reads

**No application retrieval or memory-to-prompt path was found.** Existing services read current run/plan/job/assignment/provider state and use an explicit owner prompt. Planner and routers do not SELECT memories or consume a memory bundle. The diagnostic inspected its own fixture schema/rows only; that does not constitute useful retrieval.

## State vs Memory Finding

PostgreSQL stores current state and historical snapshots; events record actions; calls/results preserve execution evidence. These do not establish lessons, relevance or learning. The Project Blackboard must remain authoritative for current requirements/phase/decisions; a distilled lesson or preference can reference it but must not override current requirements or replace a real project-state contract.

Hard $0 policy is enforced through schemas, eligibility checks, local transport boundaries and SQL constraints. It is not a preference retrieved fuzzily from memories. A later preference cannot authorize spending, change permissions or supersede an immutable grant.

## Event / Log / Artifact Separation

Events are transactional append-only domain history; technical logs are diagnostic evidence; artifacts reference file bytes intended for file/object storage; memories would be compact learned knowledge. The schema separates these tables and permits optional artifact provenance. No log/model response import currently turns those sources into trusted learned records.

Future evidence could link original request/revision, immutable plan/definition version, job/attempt, provider result/usage, failure/reconciliation event and owner review. A successful fixture/local text call or owner review is not proof of a general engineering claim. General model performance must be measured separately from learned user/project preferences. `model_performance` currently has usage_id, capability, outcome, duration_ms, human_corrected, timestamp and perf ID support, but no evaluator/writer/routing feedback service was found. `model_usage` stores observed tokens/cost/provider/model/run/agent links, not correctness scores.

## Future Memory Creation Flow

```text
Run/project/interaction evidence
  -> candidate lesson (not automatic trust)
  -> bounded distillation outside authoritative state mutation
  -> stable source/version references + scope + sensitivity/trust checks
  -> review/verification + confidence semantics
  -> versioned compact learned record
```

Place this in a specialized future Memory Manager/application use case, informed by events/results/reviews rather than making every executor append its own unreviewed “lessons.” Review can be deterministic where appropriate; no requirement for an LLM or vector service follows. Relevance, evidence and authority checks must precede storage/use. No such pipeline was built.

## Future Retrieval Flow

```text
Future Master Orchestrator: goal + identified project/automation + authority
  -> scoped bounded memory query
  -> eligible relevant records, with source/revision/trust/freshness metadata
  -> small context bundle + explicit conflict/unknown handling
  -> requirements Planner / relevant Router / scoped Agent
  -> persisted used-record/version references and observed feedback
```

The seam sits before planning/routing as a specialized dependency, not inside React or provider transport. Current bounded prompt/context limits and scoped services discourage unbounded database concatenation. Exact IDs/category/scope/structured search can come first; semantic ranking may be optional later. No architecture/dependency found requires loading everything or buying a vector database.

## Scope / Provenance / Confidence Finding

The schema needs extension before functional retrieval:

- Define typed scopes and eligibility for user/global/engineering/project/automation knowledge. Nullable project_id does not distinguish those categories or authorize retrieval.
- Add automation anchors and version/source provenance separately from the originating project. Stable automation IDs survive definition revision; existing run snapshots preserve version evidence, but no memory link currently exists.
- Link multiple evidence sources with types/revisions. A mutable memory row ID alone cannot reproduce what a past planner used; use immutable revisions/content hashes or equivalent traceable snapshots.
- Define confidence, verification time/state, provenance/trust, supersession, conflict resolution and scope priority. created_at/updated_at are not verification timestamps. Generic content JSON does not implement these semantics.

Important observed placeholder limit: a memory scoped to fixture Project B can reference an artifact owned by Project A; the FK verifies existence, not same-project access. No current service leaks it because no memory reader exists. Enforce source/read authorization and any intended scope invariants before exposure rather than treating project_id or FK presence as privacy protection. Do not retroactively edit applied migration 001 to introduce the future contract.

## Security Finding

Current docs explicitly prohibit storing credentials, raw tokens/signed URLs or whole conversations in memories/checkpoints/events/artifact locations. Server configuration is not assembled into planner/model prompts. Focused auth/error/local-provider tests passed. No application memory path currently expects or writes raw credentials.

This is **not** a content audit of a real user database and not a schema-level secret guarantee: arbitrary JSONB content can hold arbitrary strings. Future memory creation/retrieval must validate sensitivity and prevent raw credential promotion, with a separate credential capability layer. An owner could also paste sensitive content into an ordinary prompt; absence of memory service is not automatic redaction. No secret values were read into or reproduced by this report.

## Poisoning / Trust Finding

External content cannot currently be automatically promoted into trusted memory by an absent ingestion service. Stored provider outputs/events are still execution evidence, not trusted instructions. No functional poisoning-resistance system is implemented either.

Future source/evidence/trust/review/scope fields and validation must treat third-party content and generated lessons as data. Retrieval must not change hard policy or execution authority; an assertion that paid services are allowed must not override ZERO_ONLY. Confidence alone is not permission. The generic source-artifact pointer does not attest that its content is safe or true.

## Archive / Rebuild Finding

Stable project/automation/run/job/artifact/memory IDs, definition versions, immutable plans and receipts provide anchors for future retained knowledge. They do not constitute an archive/rebuild service. There is no complete rebuild manifest containing source Git reference, dependencies, architecture, configuration schema, toolchain and verified successful procedure.

Current FKs use default deletion restrictions rather than a memory-survival policy. The diagnostic verified artifact metadata deletion is blocked while a memory references it. Deleting heavy file bytes is different from deleting artifact metadata; no current Storage Manager performs either cleanup. A later retention design can preserve reference/tombstone metadata or deliberately detach/replace evidence while retaining compact verified knowledge. It must not silently orphan provenance.

Likewise projects cannot simply be removed while referenced records remain. Automations are project-owned today, so a long-lived automation's learned records after its finite build project ends need an explicit ownership/archive policy. Definition revisions alone should not erase useful knowledge, but applicability to a new version must be checked. No Archive/Purge/Forget operation was implemented or tested against user data.

## $0 Memory Path

The existing PostgreSQL/local software foundation can support bounded exact-ID, scope/category/filter and later text-search retrieval without a paid vector store or embedding service. That is an architectural path, **not an implemented or benchmarked retrieval capability**. Add indexes/limits/retention/authorization deliberately before use. Optional semantic methods must pass the same free-first policy if later justified. Local hardware/storage still consume resources; no cloud service or payment was activated.

## Dangerous Coupling

**No blocking memory-layer coupling detected.** No inspected runtime path treats logs, full prompt history, artifact bytes, generic state or a vector database as useful memory. No secret-storage expectation was found in the docs; they explicitly warn against it. Browser RAM and test-harness RAM terminology is distinct and need not be renamed.

Placeholder weaknesses—untyped JSON/kind, missing memory-source scope enforcement, restrictive cleanup FKs and no revision/trust/retrieval contract—are prerequisites for future implementation, not a demonstrated current Memory Manager regression. Do not expose the raw table as a completed memory API or substitute it for Project Blackboard/performance evaluation.

## Current Regressions

**No current-stage regressions detected.** No evidence justifies a current runtime or terminology repair. Useful memory remains unstarted, not broken.

## Repairs Made

**No repairs were necessary.** Added this report only. Temporary schema diagnostic code/results live in workspace `work/`, not the runtime source. No Memory Manager, schema migration, confidence/trust system, retrieval index, vector service or cleanup operation was built.

## Validation Evidence

Executed during Section 9:

- `node --import tsx --test tests/state.test.ts tests/planning.test.ts tests/model-router.test.ts tests/local-provider.test.ts tests/setup.test.ts tests/api.test.ts`: **51 passed, 0 failed, 0 skipped**, exit 0. Covers schema migration/history, persistent state, atomic events/checkpoints, planning/model boundaries, bounded local calls/results/recovery, auth/config/error safety. These tests do not verify nonexistent memory features.
- `node --import tsx ../../work/memory-placeholder-audit.ts`: **9 schema checks passed, 0 failed**, exit 0. Pure synthetic SQL in a fresh disposable embedded PostgreSQL schema; included explicit negative/limitation observations, not nine useful-memory capabilities. Script/result: workspace `work/memory-placeholder-audit.ts`, `work/section09-memory-placeholder.json`.
- Repository search for memory terminology, runtime memories/model_performance reads/writes, prompt assembly and vector/embedding requirements; inspected actual migrations/constraints, IDs, planner/provider state and security/backup documentation. No application memories read/write query was found in the searched runtime/harness sources; the new external audit fixture is explicitly separate.

No normal user database/memory contents, secret values or external content were ingested. No new native PostgreSQL server, browser check, real inference, full suite/lint/typecheck/build, paid service or remote deployment was executed. Runtime source and normal preview configuration/services were unchanged.

## Future Memory Gaps

Typed categories/scopes and preferences, engineering/project/automation learned records, creation/distillation, evidence/verification/confidence, lifecycle/contradictions, deterministic/optional semantic retrieval, permission/trust enforcement, retrieval audit/feedback and archive/rebuild retention. Model/agent performance evaluation remains separately unstarted. Existing records are evidence candidates only.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Before a later memory build, define compact versioned knowledge records, evidence/scope/trust/lifecycle and bounded deterministic retrieval contracts; preserve hard policy and authoritative project state outside memory. Do not implement this recommendation automatically.
