# Section 8 — Intent Gate

Audit date: 2026-10-18. Implementation: 0.18.1 / Structure 18. Scope: bounded interpretation versus explicit commands, reference ambiguity, read/write separation, auditability and authority. Inspection and tests preceded this report. No runtime source, schema, routes, permissions or settings changed.

## Overall Intent-Gate Verdict

🟡 **PARTIALLY ALIGNED**. Structured rules-based text/review proposals and explicit deterministic command paths exist. There is no general Intent Gate or natural-language entity resolver. Current intake combines recognition with bounded draft-step construction; it is not a technology-neutral general intent contract. It selects no provider and grants no execution authority.

## Current Milestone Verdict

**Healthy within the verified bounded intake/command milestone.** Unknown and dangerous wording is not silently executed. Version/digest review, original source, revisions, distinct definition/run data and explicit command schemas remain intact. Future categories/classification/confidence are missing capabilities, not regressions.

## Intent Capability Matrix

F = the 57 focused repository tests executed below; D = the 24-case pure-interpreter diagnostic; S = inspected source/contracts. Green refers to the named current supported capability, not the complete future Intent Gate.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Structured intent representation | 🟡 PARTIAL | S Proposal goal/interpretations/questions/steps; F intake contracts | Structured proposal yes | Separate general intent/target/mutation/confidence envelope |
| Deterministic commands | 🟢 IMPLEMENTED + VERIFIED | F explicit API/run/trigger/definition/read paths without generation | Supported subset yes | No claim that all example controls exist |
| Natural-language commands | 🟡 PARTIAL | F/D supported text verbs and unresolved control wording | Text/review subset yes | General NEW/BUILD/RUN/PAUSE/etc. commands |
| Entity/reference resolution | ⚪ NOT STARTED | S explicit UUID paths/manual selection; D pronouns unresolved | Explicit IDs yes; NLP lookup no | Scoped names/pronouns/conversation resolution and ambiguity candidates |
| Ambiguity handling | 🟡 PARTIAL | F unresolved references/translation/compound gates; D | Bounded gate yes | Semantic relevance, target ambiguity and contextual defaults |
| Compound intent preservation | 🟡 PARTIAL | F original source/revisions, compound/legacy approval tests | Reject unsupported compounds yes | General safe decomposition/dependency planning |
| Question/action separation | 🟡 PARTIAL | F distinct read/mutation methods; D questions clarify | API separation yes | General QUESTION classification/answer service |
| Destructive intent safety | 🟡 PARTIAL | F DELETE rejection, explicit cancellation/version checks; D | Reject unsupported destruction yes | Exact scope/approval/lifecycle for future deletion |
| Scheduling intent | 🟡 PARTIAL | F UTC registration/control tests; D timing clarification | Separate Scheduler API yes | Natural-language times/target changes |
| Build/run distinction | 🟡 PARTIAL | F reusable definitions separate from snapshots/runs/plans/jobs | Data distinction yes | Actual BUILD/RUN language resolution and general build execution |
| Configuration changes | 🟡 PARTIAL | F versioned definition revision and preserved old snapshot | Current definition changes yes | Unified typed settings/AI preference changes |
| Unknown intent handling | 🟢 IMPLEMENTED + VERIFIED | F unknown input gates/no runtime work; D unsupported examples | Yes within bounded intake | General intent taxonomy remains future |
| Confidence/uncertainty | 🟡 PARTIAL | S unresolved/questions/interpreter version | Bounded uncertainty yes | No confidence score, candidate list or calibrated threshold |
| Rules + AI hybrid path | 🟡 PARTIAL | S separate backend parser/router; F controls bypass model | Rules/UI commands yes | Optional AI classification adapter and result validation |
| Intent auditability | 🟢 IMPLEMENTED + VERIFIED | F immutable normalized source, proposal revisions, digests, events and clean-close restore | Saved proposals yes | No general intent-target trace; previews intentionally unsaved |
| Intent/authorization separation | 🟢 IMPLEMENTED + VERIFIED | F strict non-execution intake, approval/version/digest gates | Current protected actions yes | Broader sensitive actions remain unsupported |
| AI-independent controls | 🟢 IMPLEMENTED + VERIFIED | F API/trigger/planning/intake paths work without provider inference | Yes | Preserve bypass if optional classifier is introduced |

## Current Intent Types

The system does not currently emit the blueprint's NEW/BUILD/RUN/etc. vocabulary.

- `rules-v1` accepts write/draft/summarize/summarise/rewrite/rephrase/translate/check as bounded model-text draft actions; review maps to an owner-review step. These are parser rules, not semantic understanding of every possible object/content.
- Each parsed clause receives `recognizedAs: model | owner-review | unresolved`. Interpretation adds sequential steps and, where needed, final owner review.
- Explicit API/UI operations use HTTP resource/method + strict action schemas: project create/read/rename; automation create/read/revise; run snapshot create/read/cancel/interrupt/requeue; intake clarification/edit/cancel/approval; preparation, assignment/dismissal and job review/execution; schedule/subscription registration/enable/disable/poll.
- Run requeue is reviewed interrupted-run recovery, not a generic RESTART command. Run creation queues a snapshot; it is not general external automation execution. Automation pause/resume/delete, arbitrary job cancellation and build/deploy are not supported merely because their words appear in the blueprint.

## Current Intent Flow

```text
Selected project + normalized bounded text
  -> owner API authentication and strict input schema
  -> interpretRequest (pure rules; no lookup/provider/side effect)
  -> recognized/unresolved clauses + draft steps + questions/warnings
  ├─ preview: response only, no storage
  └─ save: original source + immutable proposal revision + event
       -> needs-clarification or draft
       -> explicit revision/owner edit as needed
       -> exact version/digest review
       -> one queued run + immutable plan + receipt
       -> preparation/assignment/execution remain separate actions
```

Sources: `packages/core/src/request-intake/{index,store}.ts`, `api/{contracts,http,service}.ts`. No natural-language string is routed directly to an executable command, provider SDK or database mutation chosen by the text itself.

## Deterministic Path

Explicit target/action requests bypass generation. Schema validation identifies UUID/type/action/version, the owner API authenticates, and a scoped service executes a transaction/read. Plan validation, rule preview/intake, definition revision, queueing, trigger mechanics and saved-result inspection/reconciliation do not require an LLM. Local model probe/tokenization are protocol operations, distinct from generation.

No supported deterministic operation was found to invoke a model unnecessarily. Controls would remain callable if a future AI classifier were unavailable because they already use separate routes/services. This is a current structural/contract property, not a newly deployed AI-classifier failover test.

## Generative / Reasoning Path

AI is not used to classify the current natural-language input. A model-text proposal can eventually become a supported local generation job only after exact proposal review, separate plan preparation, scoped assignment and exact prompt/limit/model authorization. Backend execution rechecks eligibility/authority. No general goal-reasoning, confidence-classification or entity-resolution AI service exists.

Task Router maps supplied step kinds; Model Router ranks eligible model metadata. The parser itself calls neither. Technology words such as Python/n8n/GitHub trigger conservative scope clarification, not automatic executor/provider selection. The owner sequence editor can explicitly supply future step kinds; that is reviewed manual planning, not general intent classification and not launch authority.

## Entity Resolution Finding

Current targets come from selected UI objects and strict IDs in API paths/bodies, with versions/digests where required. IDs survive rename, and project relationships are checked. Names are not generally unique; a future resolver must consider project scope, object type, candidate ambiguity, current conversation context and authorization, then return an exact identity for review.

“Pause it,” “Run that again,” “Change its schedule” and “Delete the old one” were unresolved in D. This does not prove a general reference resolver exists; it proves these examples do not produce executable authority. There is no persisted conversational referent/candidate-resolution service. Project/UI selection is useful explicit context, not permission to guess a destructive target from a pronoun.

## Compound Request Finding

Section 1 protections remain present and their relevant tests passed again: full normalized source stays separate from steps, clarifications produce immutable revisions, unsupported compound build/test/fix/deploy/monitor outcomes require questions, and old unapproved rule drafts are rechecked before approval. Rejected compound requests create no run/plan. Common conjunction/punctuation/ampersand variants are covered, not arbitrary natural-language completeness.

Recognized actions separated by then/semicolon/newline form a bounded sequential draft, not general intent decomposition. More than eight clauses triggers clarification; only eight are interpreted, while the full source remains preserved. Titles may be visibly abbreviated to 200 characters without replacing the full goal/source. Future decomposition should record all action spans/outcomes, dependencies/ambiguities and review identity rather than silently rewriting source intent.

## Question vs Mutation Finding

Read paths for current records/results/events/status are distinct from POST/PATCH mutation paths and strict commands. The preview endpoint uses POST but is pure interpretation and storage-free; method name alone is not the whole semantic boundary. All current owner API operations share owner authentication; there is no separate read-only token/RBAC scheme.

“Why did yesterday's run fail?”, “What is running?” and “How much did this cost?” required clarification in D; there is no QUESTION answer service. Saving one can create a non-executing intake/audit record, so it is not literally zero database writes, but it does not restart work, change an automation or dispatch a job. No inspected path executes an operational mutation merely because a question is entered.

Current records can later support deterministic answers about known run/job status, saved errors/recovery flags, recorded spend/usage, provider/model IDs and next scheduled occurrence. They do not yet provide universal “today/running” queries or reliable causal explanations. Learned-knowledge questions cannot be answered through a nonexistent Memory Manager.

## Authorization Boundary

**Intent is not authority.** Every proposal has ZERO_ONLY and executionEnabled false. Interpretation creates no schedule or execution grant. Unknown fields requesting execute/provider/cost-policy overrides are rejected; unsupported intent never changes these permissions.

Clarification is a revision, not approval. Exact proposal approval creates a queued run/plan, not a model call. Preparation creates zero-permission metadata; assignment creates scope without call authority. Execution/review use their own strict grants and backend checks. An owner-edited supported plan is a separate explicit reviewed interpretation, retaining the original source; it cannot make unavailable external executors launch.

There are no current project/automation DELETE or file/deployment purge endpoints. DELETE project is tested as 405; unknown routes/actions fail 404/400 as appropriate. Supported run/draft cancellation and assignment dismissal require explicit commands and state versions; saved history/results are retained. Detecting destructive words or a $5 spending request cannot authorize deletion, billing or deployment. Future destructive actions still need exact target/scope/approval/lifecycle service; they were not built here.

Scheduling is likewise separate: timing vocabulary raises clarification, while Scheduler accepts explicit reviewed automation/version and UTC once/interval/event rules, registers disabled, and only queues runs for review. No current interpreter parses “Wednesday/midnight/tomorrow” into a live trigger. Definition revision is versioned; old run snapshots/plans remain immutable. General AI preference/configuration changes are unimplemented.

## Unknown / Ambiguous Input Finding

For valid-size unknown text, clauses are unresolved and questions block approval. Missing/invalid types, overlength input and illegal commands fail strict validation. Empty/separator-only clauses cannot become a valid reviewed plan. Reference, translation-language, scheduling/external scope and compound checks are deterministic but conservative. They can ask unnecessary questions or miss linguistic nuance; they are not a full confidence/semantic system.

D checked 21 unsupported command/question/ambiguous/destructive/scheduling/compound inputs plus three supported text/review inputs. All 24 preserved the supplied example goal and executionEnabled false; the 21 unsupported examples required clarification. This checks those cases only, not universal NLP safety or classification accuracy.

## Dangerous Coupling

**No blocking intent-layer coupling detected.** The key partial boundary is inside `request-intake/index.ts`: clause recognition and sequential draft construction happen in one function, and Proposal depends on Planner's step schema. Recognized text immediately maps to model/owner-review kinds. This is a bounded drafting convenience, not a complete technology-neutral Intent Gate.

A later gate should precede draft planning and separate action classification from target resolution, confidence/ambiguity, mutation/clarification metadata and plan construction. Reuse explicit commands and planners behind it. No provider/executor transport belongs in the classifier; no provider-specific mapping such as BUILD→Codex was found. The parser runs in the backend, not React; the UI displays interpretations and sends reviewed commands.

### Contract evolution and auditability

Current Proposal is structured: intakeVersion 1, interpreter rules-v1/owner-edit, goal, interpretations, steps, questions, assumptions, warnings, policy and disabled execution. It lacks a general intent, targetType/targetId, mutating flag, confidence/candidates or resolver provenance. Questions/unresolved provide coarse uncertainty only.

An explicit versioned intent-result envelope or reviewed optional metadata can extend this without replacing downstream state/execution services. It is not automatically compatible with today's literal interpreter/version types. Preserve existing stored revisions/receipts, validate new outputs, and bind any changed interpreted target/action/scope to a newly reviewed digest. Confidence must not confer authority; AI output requires the same validation as rules/UI input.

Saved source + complete structured proposal/revisions + interpreter/version + events/digest already support a bounded decision trace; owner edits are labelled. Preview results are intentionally not persisted. Generic explicit command events record actions, not a natural-language interpretation that never occurred. Future trace should record concise classification/target evidence, not hidden chain-of-thought.

## Current Regressions

**No current-stage regressions detected.** No demonstrated current-stage intent/authority bug or dangerous coupling justified a runtime repair. Missing general intents, entity resolution and confidence are future capabilities.

## Repairs Made

**No repairs were necessary.** Added this report only. The temporary pure-interpreter diagnostic and results are in workspace `work/`, outside repo source. No Intent Gate, entity resolver, decomposition engine, model UI, deletion feature or scheduling parser was built.

## Validation Evidence

Executed during Section 8:

- `node --import tsx --test tests/blueprint-core.test.ts tests/intake.test.ts tests/api.test.ts tests/planning.test.ts tests/model-router.test.ts tests/automation-hub.test.ts tests/coordination-hub.test.ts tests/foundation.test.ts tests/hub.test.ts`: **57 passed, 0 failed, 0 skipped**, exit 0.
- Covers Section 1 compound/legacy-draft protection, source/revision durability, strict auth/method/body boundaries, version/digest review, definition snapshots, planner/router separation, queue-only scheduling, zero-cost protection and fixture Hub workflow/recovery.
- `node --import tsx ../../work/intent-gate-audit.ts`: **24 input cases passed, 0 failed**, exit 0. Result: workspace `work/section08-intent-cases.json`. Pure interpreter; no storage/entity lookup/provider/executor/network/browser action.
- Source tracing across intake, approval store, API command schemas/dispatcher/services, planner/router separation, Scheduler contracts and Hub interpretation display.

No runtime source changed. No fresh full-suite/native PostgreSQL/lint/typecheck/build, browser test, real inference, remote execution or paid service is claimed. Prior broader/native/worker safety evidence remains historical, not added to these counts. Normal preview configuration/services were untouched.

## Future Intent Gaps

General action classification; scoped entity/reference resolution; safe compound decomposition; QUESTION answering; context-relevant clarification; calibrated confidence/candidates; versioned neutral intent contract; optional AI classification; destructive/sensitive action lifecycles and typed interpretation traces. Keep classification, planning, machinery selection, model selection and authority distinct.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Before a later Intent Gate build, define a versioned action/target/ambiguity/result contract and how it delegates to existing deterministic commands or planning. Preserve immutable original intent, exact review and $0 policy. Do not implement this recommendation automatically.
