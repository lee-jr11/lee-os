# Section 23 diagnostic — Notifications / Human Intervention / Approvals

Audit date: 2026-10-19. Current implementation: LeeOS 0.18.1 / Structure 18. Priority-focused audit of existing authority boundaries, not future notification completeness. Disposable SQL fixtures and in-process provider transports only.

## Blueprint Section

Section 23 — Notifications / Human Intervention / Approvals.

## Overall Verdict

🟡 PARTIALLY ALIGNED. Existing clarification, queued-plan approval, preparation, scoped text execution and explicit result review are distinct and safe in the tested scope. Generic human waiting/resume and notification delivery remain unimplemented.

## Current Foundation Verdict

🟢 SAFE TO CONTINUE. No demonstrated current-stage defect required a runtime repair. This certifies the bounded owner-controlled workflows, not a complete intervention/notification platform or arbitrary external-action approval system.

## Critical Capability Matrix

| Capability | Status | Evidence | Action |
|---|---|---|---|
| Clarification/approval/review separation | 🟢 IMPLEMENTED + VERIFIED | Intake schemas/store; Job Worker review; native checks 1,2,4,5 | Preserve separate authenticated actions; clarification alone creates no run |
| Approval scope | 🟢 IMPLEMENTED + VERIFIED | Proposal/request digest; composite FKs; run-bound plan digest; strict job operation schemas; checks 1,2,4,6 | Scope is fixed by authenticated target path + stored identity/digest, not a reusable blanket approval token |
| Stale approval protection | 🟢 IMPLEMENTED + VERIFIED | Intake revision/digest/version checks; job run version/plan/dependencies; checks 1,4,6; existing race tests | Distinguish new authorization rejection from matching historical replay |
| Approval/execution-grant separation | 🟢 IMPLEMENTED + VERIFIED | Empty-permission intake/preparation receipts; explicit local:text grants; checks 2,4 | Approved plan does not dispatch, assign agents or authorize arbitrary work |
| Human waiting state | ⚪ NOT STARTED | Actual run/job enums; no intervention service | needs-clarification belongs to requests; pending review is not generic WAITING_FOR_USER; never label waiting as failed |
| Human-input resume | 🟡 PARTIAL | Durable request revisions, pending review and saved results; checks 1,5,6; Hub recovery tests | Bounded clarification/review continuation exists; no generic durable intervention response/resume protocol |
| Destructive/external-action approval foundation | 🟡 PARTIAL | Owner auth, strict scopes, inactive external executors; generic approvals table not consumed | Reuse narrow patterns later; no delete/publish/send/deploy approval workflow exists |
| ZERO_ONLY preservation | 🟢 IMPLEMENTED + VERIFIED | Literal policies/strict schemas; model cost routing; native checks 2,5,7; native cost/grant contracts | Approval cannot waive cost policy or enable paid fallback; paid handoff workflow not implemented |
| AI cannot self-approve | 🟢 IMPLEMENTED + VERIFIED | Authenticated POST handlers; output-as-text storage; checks 5,7 | APPROVED text/JSON-looking output is not an owner action; future tool results must keep this boundary |
| Approval audit trail | 🟡 PARTIAL | intake_approvals, append-only revisions/events, job_executions hashes/timestamps; checks 2,6 | Records scope/version/time/outcome; single owner control path, no named-user/token attribution or complete general approval ledger |
| Notification foundation | 🟡 PARTIAL | notifications schema; generic events; ephemeral Hub feedback; check 7 | METADATA/EVENT FOUNDATION ONLY for notifications; no sender, preferences, delivery retry or receipts |
| Notification/state separation | 🟢 IMPLEMENTED + VERIFIED | No runtime notification consumer; check 7 changes sent/failed/dismissed without state changes | Preserve state authority in transactions; future delivery must remain separate |
| Notification/approval separation | 🟢 IMPLEMENTED + VERIFIED | No click-to-approve notification handler; authenticated review endpoint; check 7 | Notification/viewing does not authorize; real decisions need explicit owner POST |

## Authority Chain

The actual intake path is:

```text
Authenticated local owner describes request
  → storage-free preview OR durable request + proposal revision
  → needs-clarification, if unresolved
  → owner clarifies/edits → new version/digest, still no run
  → separate explicit approval of exact request revision/digest
  → one queued run + saved inert plan + immutable approval receipt
     [ZERO_ONLY, executionEnabled=false, permissions=[]; no jobs/calls]
  → separate plan-digest review and prepare-only action
  → pending job batch and immutable preparation receipt, still no launch authority
  → separate role/agent assignment for text jobs, empty permissions
  → explicit per-job local:text execution request
     [owner auth + flags + run/job + plan digest + run/agent versions
      + assigned agent + fingerprint + prompt/output scope]
  → fresh eligibility/cost/agent checks + durable reservation
  → bounded fixture-verified local text call → persisted result
  → dependency review job stays pending; no automatic result acceptance
  → explicit authenticated owner:review action for that exact review job
  → review job succeeds; run succeeds only when all required jobs succeeded
```

A separate low-level owner API can create a queued automation run and save its immutable plan without intake. It still needs prepare/assignment/execution/review actions as applicable. The manual local-generation endpoint is a separate opt-in owner computation path, not an intake approval or result acceptance mechanism.

### What each decision permits

- Clarification updates the draft's meaning and saves a new revision. It may resolve questions; it grants no execution, scheduling or spending permission.
- Intake approval accepts the exact reviewed proposal as the plan for one queued run. Its action is literally create-reviewed-run, not launch-everything. It does not prepare jobs or generate text.
- Preparation acknowledges a run-bound plan digest and creates one prepare-only job batch. Permissions must be empty. It is not a local:text grant.
- Agent assignment binds a planned agent to an eligible prepared job; assignment alone grants no execution.
- A text grant authorizes one specific controlled job/prompt/output/fingerprint/agent scope, subject to fresh current eligibility. A result or generic SQL approval row is not a grant.
- Owner review completes a pending review-kind job after dependencies succeed. It does not grant local:text, rerun generation, activate another tool or raise the cost ceiling. Review intentionally works with model/job-execution flags off because it is a separate owner action and makes no provider request.

The HTTP target supplies request/run/job identity; an approval body or digest is not a secret bearer capability. Existing receipts are stored against that identity. An authenticated owner submitting an explicit new action for another eligible target is a new decision, not automatic reuse of an old receipt. Wrong run/job/plan/digest/operation inputs are rejected; no receipt is interpreted as universal permission.

### Staleness, replay and lifecycle distinctions

Proposal digest includes request ID, proposal version and canonical proposal content. Request/project binding is immutable and FK-protected. Plan digest includes run ID, saved plan run-version and canonical plan. Prepared plans are append-only; ordinary plan edits are not silently accepted. Current run version/status, job pending state/attempt, kind, dependencies, agent version and model scope add independent fences.

Historical same-input approval/review retries return the old receipt/result even after a run is terminal; this does not mint new work. A new mismatched decision is rejected. In native tests, simultaneous approval requests produced one run, one receipt and one approval event; simultaneous final reviews produced one job decision/event and no new call. Existing native tests also cover approval racing with request edits/cancellation and transaction rollback when approval history fails.

Changing a reusable automation definition does not retroactively invalidate an already retained run snapshot; the approval targets that run/plan, not whatever definition happens to be current later. An approval for changed proposal content or a first review with a stale run version/digest is rejected. Do not conflate snapshot preservation with accepting a changed plan under stale authorization.

Cancelled requests/runs reject new approvals/reviews. Section 20's limited archive policy is retained: an administratively archived project rejects first intake approval creating a NEW run, while an existing retained run may still receive exact owner review and finish. Native check 6 verified this intentionally allowed case, with both model execution opt-ins off. Archive is not cancellation, and there is no supported lifecycle archive command yet. Matching old receipt replay is historical access, not fresh approval of an archived/cancelled target.

### Actual human waiting and continuation

Requests have needs-clarification/draft/approved/cancelled; runs and jobs have their existing execution states. There is no WAITING_FOR_USER run/job state, durable intervention record/question/response ID, automatic blocked-work wakeup or continuation scheduler. A pending owner-review job can prevent dependent work from becoming eligible and leave the run running. That is a real dependency/owner boundary, not a general human waiting service. It is not changed to failed merely because an owner has not decided yet.

Durable request clarification preserves original text/revisions; the owner must approve the new digest separately. Pending review and saved results persist, and a known run can be reopened read-only through the Hub's existing recovery path. Explicit review advances that job; subsequent model steps would still require their own explicit grants, not automatic dispatch. Unsaved prompts, checkboxes and browser connection state are deliberately not durable. Generic resume-after-human-response and rejection/rework workflows remain future work; review accepts approve=true only, with cancellation a separate available control.

### Approval attribution and history

Working request approvals are in intake_approvals, not the generic approvals table. They retain request/project/run identity, the exact approval input, receipt and created_at. Append-only proposal revisions and events preserve prior content and the transition. job_executions retains scoped job/run/agent/call where applicable, permission, request hash, attempt, status, created/finished timestamps; job.owner-approved and downstream run events show what happened next. The plan and job blueprint remain separately available.

The decision originates from the authenticated single local-owner HTTP control path. No named person, user-account ID, bearer-token fingerprint or durable actor identity is stored on these working decisions. Do not label this as named-user attribution. The generic approvals schema has decided_by/decided_at fields, but no current service writes/consumes it as execution authority; its presence does not fill that attribution gap. Request IDs/error correlation and timestamps are not a general identity audit service. Owner review binds the current immutable application plan/job state, not a separate signed hash of every displayed output byte; there is no general result-acceptance evaluator or artifact acceptance record.

### Notification reality and separation

Classification: **METADATA/EVENT FOUNDATION ONLY** for the notification subsystem. notifications stores ID, optional event FK, channel, pending/sent/failed/dismissed status, JSON content and timestamps. There is no notification-producing service, sender, delivery API, durable push subscription, email channel, preferences, escalation, retry/deduplication policy or delivery receipt service. Generic completion/failure/blocked-trigger/approval events are evidence, not notifications delivered to Lee.

The open Hub does provide WORKING ephemeral feedback/status/error messages, clarification questions, current job/run state and explicit approval/review controls. These depend on current page actions/readbacks; they are not background alerts or a notification inbox. Browser/service-worker update notices are app lifecycle feedback, not intervention delivery. No current code treats viewing a row or message as consent.

Native fixtures changed a notification's status through sent/failed/dismissed and even inserted a generic approval row with approved status: the run remained queued and its review job pending. The genuine review endpoint still enforced dependencies/authentication. An unauthenticated review POST was rejected before DB access. Unknown notification/approval routes returned 404 before DB access. These demonstrate non-authority of placeholder metadata; they do not certify sender failure isolation, delivery or click authorization features that have not been built.

### Cost, external actions and AI output

All current request/preparation receipts retain ZERO_ONLY and empty permissions. Execution permission schemas are strict local:text or owner:review; arbitrary cost-policy or executor fields do not become authority. The Section 22 audit verified unknown/nonzero-cost exclusion; current native contracts also rechecked provider/job enablement revocation. Generic approval metadata cannot authorize a paid path or change the constrained system policy.

There is no currently executable delete/publish/send/deploy integration or paid handoff workflow to approve. Future unavoidable manual/paid steps need explicit handoff design; an approval receipt must not silently waive $0 automatic spend. External-effect approval/denial/resource-scope protocols remain unimplemented.

A native fixture returned literal `APPROVED` plus JSON-looking approve/owner:review/PAID instructions from both text jobs. Both results were stored as text; the run stayed running, review remained pending, no owner-review execution row appeared, and ZERO_ONLY remained intact. The model has no owner key or API-invocation tool, and no output parser translates content into a decision. Current tool output has no additional execution path; future MCP results must retain this non-authority boundary rather than being considered already approved.

## Blocking Problems

**No blocking approval/intervention problems detected.** The absence of a generic waiting state or notification delivery is a future feature gap, not a current authority bypass.

## Current-Stage Defects

None demonstrated in the audited current paths. Same-input historical replay after cancellation/archive and owner review of retained archived-project runs are intentional existing semantics, not fresh automatic authority. Missing actor attribution, intervention/resume, approval denial/rework and notification delivery are explicitly limited foundations; they were not reclassified as working features.

## Repairs Made

No runtime/schema/UI/configuration changes were necessary. Added this report plus an isolated reproducible approval diagnostic script/result outside product source. No Notification Manager, human waiting platform, notification channel, paid approval mode or new permission was built.

## Validation

- Source inspection: request clarification/approval schemas/store, plan digest/store, preparation, assignments, job execution/review/reconciliation, API authentication/handlers, Hub checkboxes/feedback/recovery, and notifications/approvals/intake/job migrations.
- Native diagnostic: `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/approval-boundary-audit.ts` — **7 passed groups**, covering clarification and stale/cross-project request rejection, concurrent duplicate intake approval, archived-project new-work blocking, wrong-operation/job/run review rejection, literal APPROVED model output, concurrent retained-run review, and notification/generic-approval non-authority. All inference was an in-process fixture.
- Native contracts: `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts` — **81 passed**, zero failed, including approval/edit/cancel races, immutable evidence, auth, grant revocation and recovery.
- Focused contracts: `node --import tsx --test tests/intake.test.ts tests/worker.test.ts tests/execution.test.ts tests/hub.test.ts` — **48 passed**, zero failed, including clean-close evidence and safe Hub recovery/approval behavior.
- Native scenarios used generated disposable schemas removed in finally. The dedicated PostgreSQL 17 audit server was restored to its initial stopped state. Normal Hub preview/user DB was untouched.
- No lint/typecheck/build rerun: product code/configuration did not change. All three passed in Section 22; this is a prior result, not a fresh Section 23 run. The scratch script is outside product tsconfig and was executed with tsx; no static-typecheck claim is made for it.
- External/paid services contacted: none. No real local model, notification sender, email/push provider, MCP tool or destructive resource action. No new backup, commit or push.

Unsupported failure scenarios are not fabricated: no notification delivery/click workflow, generic intervention response command, arbitrary external-action approval, named-user grant system or true WAITING_FOR_USER state exists to exercise. The tested archived status is an administrative fixture, not a public lifecycle command. Prior receipt replays intentionally preserve recorded results and do not execute again.

## Future Gaps

Generic WAITING_FOR_USER state and durable response/resume protocol; notification producer/inbox/preferences, push/email delivery, escalation/retry/delivery receipts; named actor attribution; general approve/deny/expiry/rework/resource-scope workflows; explicit manual paid handoffs; typed output/artifact acceptance evidence. Keep these separate from current clarification, review and execution grants.

## Final Recommendation

### 🟢 GO

Current approval/human-intervention foundation is safe enough to continue V1.

## Evidence files

- [Intake approval and clarification](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/request-intake/store.ts)
- [Strict decision contracts](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/request-intake/index.ts)
- [Job grants and owner review](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/job-worker/index.ts)
- [Preparation authority](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/execution-manager/store.ts)
- [Authenticated control paths](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/api/http.ts:114)
- [Hub explicit decisions](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/apps/hub/components/workbench.tsx)
- [Native approval diagnostic](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/approval-boundary-audit.ts)
- [Saved diagnostic results](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/section23-approval-checks.json)
