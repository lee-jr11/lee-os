# Blueprint Section

Section 10 — Clarification Gate. LeeOS 0.18.1 / Structure 18, audited 2026-10-18. Inspection and tests preceded this report. No runtime, schema, UI, dependency or environment changes.

## Overall Clarification Verdict

🟡 **PARTIALLY ALIGNED.** A deterministic bounded clarification gate exists for text-task intake. The general context-aware Clarification Gate is not implemented. Missing future services are not current regressions.

## Current Milestone Verdict

**Healthy within the verified bounded intake milestone.** Clarification revises proposals without creating execution authority. Immutable history, version checks, exact-digest approval and queue-only plan creation passed the focused contracts. This does not establish general semantic completeness or universal safe question generation.

## Clarification Capability Matrix

F = 51 focused repository tests; D = 18 diagnostic examples plus two strict-schema rejections; S = source inspection. Green is limited to the named current contract.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Clarification/approval separation | 🟢 IMPLEMENTED + VERIFIED | F separate revise/approve/grant paths | Yes | Broader protected actions remain future |
| Clarification/review separation | 🟢 IMPLEMENTED + VERIFIED | F draft approval versus completed-work review | Yes | General review workflow vocabulary |
| Materiality | 🟡 PARTIAL | S/D bounded missing-information rules | Bounded rules yes | Context-sensitive necessity test |
| Outcome questions | 🟡 PARTIAL | F/D unresolved outcome question | Bounded yes | Goal-specific questioning |
| Input questions | 🟡 PARTIAL | D source reference/language checks | Bounded yes | Required-input discovery and validation |
| Constraint questions | 🟡 PARTIAL | S generic inputs/constraints wording | Basic wording yes | Typed deadline/delivery/format constraints |
| Technology-question avoidance | 🟢 IMPLEMENTED + VERIFIED | F/D questions ask outcomes, not executor/model choice | Yes | Technology names still over-trigger scope questions |
| Safe defaults | 🟡 PARTIAL | S/D sequential draft/final review | Bounded defaults yes | Contextual default policy |
| Assumption visibility | 🟢 IMPLEMENTED + VERIFIED | S saved proposal/Hub details; F proposal persistence | Saved review yes | Preview omits assumptions; no general assumption provenance |
| Memory-before-question | ⚪ NOT STARTED | S no reader/context parameter | No | Trusted retrieval bundle |
| Config-before-question | 🟡 PARTIAL | S frozen definitions/run-plan editor | Explicit definition path yes | Intake does not consult configuration |
| Project-context reuse | 🟡 PARTIAL | F project/request identity/history | Scoped persistence yes | Structured accepted-requirement reuse |
| Ambiguous-reference handling | 🟡 PARTIAL | D pronouns block bounded proposals | Conservative blocking yes | Scoped entity resolver; anaphora nuance |
| Compound-request handling | 🟡 PARTIAL | F Section 1 safeguards rerun | Reject unsupported compounds yes | General decomposition |
| Destructive-scope clarification | 🟡 PARTIAL | D unsupported destruction remains blocked | Blocking yes | Exact target/archive/purge questions and service |
| Cost clarification | 🟡 PARTIAL | D spending blocked, ZERO_ONLY unchanged | Cost boundary yes | Feasibility/free-alternative conversation |
| External-effect clarification | 🟡 PARTIAL | S/D scope question, F separate grants | Current boundary yes | Typed destination/scope and external executors |
| Question quality | 🟡 PARTIAL | D specific source/language, generic fallback | Bounded templates yes | Relevance, deduplication by requirement |
| Multiple-question handling | 🟡 PARTIAL | S array, deduplicated/capped at ten | Display yes | IDs, answer mapping, dependent questions |
| Persistence | 🟢 IMPLEMENTED + VERIFIED | F saved questions/history clean-close restore | Saved records yes | Unsaved form text remains volatile; browser not retested |
| Revision history | 🟢 IMPLEMENTED + VERIFIED | F immutable source/revisions | Yes | Separate answer/question associations |
| Stale-answer protection | 🟢 IMPLEMENTED + VERIFIED | F expectedVersion/locking/digest checks | Yes | Explicit question/reason revision identity |
| Long-lived waiting foundation | 🟡 PARTIAL | F durable needs-clarification record | Persisted draft yes | Formal wait/resume/timeouts/notifications |
| Agent question coordination | 🟡 PARTIAL | S agents have no direct human-message channel | Scope boundary yes | Central aggregation/deduplication service |
| AI-independent fallback | 🟢 IMPLEMENTED + VERIFIED | F/D rules/forms without inference | Yes | Future optional AI failover not built |
| Secret-request protection | 🟡 PARTIAL | D fixed templates do not follow secret request; S credential boundary | Current separation yes | No general input redaction or future AI guard |
| Auditability | 🟡 PARTIAL | F proposals/revisions/events/digest | Current history yes | Structured reason codes/context evidence |

## Current Clarification Triggers

Source: `packages/core/src/request-intake/index.ts`, `interpretRequest`.

1. No action clauses after splitting nonempty text on then/semicolon/newline: asks for at least one action. Empty/oversize input instead fails validation.
2. More than eight clauses: asks for a shorter request or edited plan; interprets only eight while preserving the complete goal/source.
3. Timing keywords: every, daily, weekly, monthly, tomorrow, tonight, schedule, cron and weekdays. Asks whether timing concerns content or a separately reviewed schedule.
4. Scope keywords: send, email it, publish, upload, delete, remove, execute, install, download, purchase, pay, charge, subscribe, n8n, python, lee360, github. Asks about outcome/inputs/constraints and discloses no external authority.
5. Clause outside recognized write/draft/summarize/summarise/rewrite/rephrase/translate/review/check plus an object: asks for result, inputs and constraints, disclosing bounded support.
6. Recognized clause containing supported compound-action conjunction/punctuation/ampersand patterns: asks for each outcome/order, disclosing unsupported build/test/fix/deploy/monitor/learn.
7. Exact unresolved object this/it/that/them/the above/my notes/my document/my file: asks for source or subject.
8. Translation lacking the bounded to/into-language suffix: asks which language.

Questions are deduplicated by identical string and capped at ten. They are deterministic templates, not AI questions or formal reason-code records. Other parser/schema failures reject input rather than starting a clarification session.

## Current Clarification Flow

Selected project + bounded normalized request → owner-authenticated preview/save → rules proposal → questions cause `needs-clarification`, otherwise `draft` → save complete revised English request using `expectedVersion`, or explicitly edit goal/steps → append immutable proposal revision and `request.revised` event → newly reviewed exact version/digest → separate approval → one queued run and immutable plan, with execution disabled and no permissions → separate preparation/assignment/job grant/completed-work review.

Preview is storage-free. CLI `scripts/request.ts` and HTTP `POST /requests/:id/clarify` use the same backend contract. The Hub labels its field **Clarify with a complete revised request**. This is replacement interpretation, not merging a short answer into an unresolved field. “French” alone is not associated with the earlier translation question. Original source stays unchanged; each revised normalized text survives as proposal.goal, with interpretations/questions and revision timestamp. There is no separate answer record or exact per-question linkage.

## Clarification vs Approval

Distinct schemas and transactions. `clarify` can only revise editable request state; it creates no run, jobs, grants, schedules or payments. A new draft requires its own version/digest approval; even that only queues a plan. Backend authorization is independent of UI checkboxes. Saying yes/use a paid option cannot change ZERO_ONLY. Unsupported destruction has no project-delete/purge executor; resolving target details could not invent one or authorize it.

## Clarification vs Review

Resolving missing information creates a new proposal. Reviewing that exact proposal acknowledges the interpreted plan. Owner-review steps later acknowledge completed outputs; exact-prompt approval separately authorizes a bounded local model call. These current contracts remain separate even though the intake endpoint calls queue-plan review “approve.”

## Materiality Finding

Source identity, translation language, uncertain outcomes/order, scheduling and external scope can materially matter. The parser asks no semicolon/style question and never delegates Python/n8n/provider selection to Lee. But its broad keyword rules lack a necessity/relevance model. D confirms “Draft a guide about GitHub” asks scope clarification and “Draft a welcome message then review it” asks for the otherwise apparent referent. These are documented conservative parser limitations, not a demonstrated approval bypass. Conversely it does not discover every genuinely required input or critical constraint. It can draft “Draft a report” without having sources because source/prompt supply is a separate disclosed execution boundary. No claim of complete feasibility analysis is justified.

## Context-Reuse Finding

`interpretRequest(value)` accepts text alone. Project identity scopes persistence; it does not inject requirements. Existing definition-run paths retain immutable configuration snapshots, and the Hub's run-plan editor recognizes supported sequence definitions to prefill an explicit review. They can avoid re-entering known steps on that separate path; intake does not search these records before asking. Original requests/revisions can anchor authoritative requirements later, but are not a structured requirements/Blackboard service. Memory Manager remains NOT STARTED.

Future seam: validate a small authoritative configuration/project/trusted-memory bundle before question generation; record origins, applied defaults and unresolved fields. Adding it requires a versioned contract, not passing a raw conversation or silently reinterpreting old approvals. Current assumptions explicitly disclose sequential jobs, no automatic prior-output prompt insertion, and owner-supplied manual steps. Saved Hub review shows assumptions/warnings in details; preview shows steps/questions only.

## Persistence / Staleness Finding

Migration `008_request_intake.sql` stores source/request status/current version, append-only proposal revisions, and append-only approvals. Pending clarification is an intake status, not a run WAITING_FOR_USER state. Revisions lock the request and require the current version; terminal requests cannot be edited. Approval checks current status/version/digest and rechecks legacy rules drafts. F verifies stale answer/edit/approval rejection, race behavior, immutable history and clean-close restore. Reload can recover saved questions through list/get after reconnecting and selecting the request; unsaved browser text is not durable. No fresh browser test was performed here.

The persisted request does not depend on an open browser and has no clarification expiration. It does not establish autonomous wait/resume, timeout policy, background orchestration or notification delivery. `request.created` includes status; `request.revised` includes version/interpreter, not a dedicated clarification-required payload. A future notification consumer would need a typed status/revision event or authenticated lookup, idempotent delivery and stale-question suppression. No timers or notifications were added.

## Human-Interaction Boundary

Current owner UI/CLI/API supply inputs centrally. Scoped agent roles/assignments are metadata; supported model calls are text-only with no tool or direct user-contact channel. This preserves a seam for agents to report structured missing requirements to an orchestrator. No agent-question aggregation, priority policy or human-question deduplication exists. Do not equate absence of direct messaging with a completed coordination service.

## Security Finding

Current clarification consumes owner text only, fetches no external sources and invokes no model. Its fixed templates do not echo an instruction to request an API key; D verifies that example remains unsupported and no generated template requests credentials. Owner bearer credentials use the separate local connection boundary, are not part of clarification schemas and are never automatically supplied as prompt context. Strict schemas reject execution/cost-policy override fields.

There is no general secret detector/redactor: an owner can paste a secret into text and it can be persisted as source/proposal content. This audit inspected no user secret records. Future untrusted-content/AI-assisted questions need validated reason/field types, a rule routing credential needs to connections, and isolation from stored instructions. Fixed templates today do not prove general future poisoning resistance.

## Dangerous Coupling

**No blocking clarification-layer coupling detected.** Rules live in backend request-intake, not UI, Model Router, Task Router, executor or agent prompts. UI renders questions/submits explicit revisions; schemas and store enforce boundaries. Intake currently combines clause recognition, questions and bounded Planner-step construction; this is the known partial seam, not a standalone general Clarification Gate. Future context/materiality logic belongs before planning/technology selection, preserving reviewed revision identity. Unsupported actions are not enabled by editing a draft.

## Current Regressions

No current-stage regression detected. Broad keyword/reference limitations, missing question-answer mappings and absent context services are future gaps, not defects against the documented bounded contract.

## Repairs Made

No runtime repair necessary. Added this diagnostic report. Temporary diagnostic code/results live in workspace `work/`; no general clarification engine, Memory Manager, WAITING_FOR_USER state, notification system or paid path was built.

## Validation Evidence

- `node --import tsx --test tests/intake.test.ts tests/blueprint-core.test.ts tests/api.test.ts tests/hub.test.ts tests/planning.test.ts tests/agent.test.ts tests/model-router.test.ts`: **51 passed, 0 failed, 0 skipped**, exit 0. Includes transactional embedded SQL contracts, version/digest/race safeguards, immutable revisions, clean-close restoration, explicit owner workflow and no-inference rules/commands. Prior Section 1/8 compound findings were carried forward through these existing tests, without a new decomposition implementation.
- `node --import tsx ../../work/clarification-gate-audit.ts`: **18 examples and 2 strict-schema rejection checks passed**, exit 0. Results `work/section10-clarification-cases.json`; pure interpreter/schema only. Confirms trigger families, bounded defaults, conservative false positives, secret-request example, cost/execution invariants and multiple-question cap. An initial scratch-only run failed on top-level await under CJS; wrapped diagnostic in async main and reran successfully. No product defect was involved.
- Inspected intake index/store; migration 008; API contracts/dispatcher; Hub workbench; CLI; scoped agent store; definition/run snapshot state and Structure 16–18 documentation.

No fresh full suite, native PostgreSQL, lint/typecheck/build, browser refresh, actual inference, external delivery or payment test is claimed. No runtime source changed and existing preview services/configuration were untouched.

## Future Clarification Gaps

Materiality/context sufficiency; typed required inputs/constraints; scoped reference resolution; compound decomposition; visible consequential default provenance; trusted memory/configuration/project reuse; stable question/reason IDs and answer mappings; supersession/stale question identity; long-lived orchestration wait/resume; typed clarification-required events and notifications; agent question aggregation; secret-safe AI question validation; bounded optional AI fallback; free-alternative feasibility discussion. Preserve separation between information, review and authority throughout.

## Recommended Next Step

Audit the next blueprint section Lee supplies. No automatic next implementation. Before any later general gate build, specify a versioned missing-requirement/context/reason contract and retain existing stale-version and independent approval protections.
