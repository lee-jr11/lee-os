# Section 24 diagnostic — Security / Secrets / Permissions / Trust Boundaries

Audit date: 2026-10-19. Current implementation: LeeOS 0.18.1 / Structure 18. Priority-focused security/authority audit for the existing single-owner, trusted-host V1 foundation. This is not an enterprise security assessment, penetration test of a deployed server or clearance for unimplemented external workers.

## Blueprint Section

Section 24 — Security / Secrets / Permissions / Trust Boundaries.

## Overall Verdict

🟡 PARTIALLY ALIGNED. Existing authenticated controls, explicit job authority, cost restrictions and replay/revocation boundaries passed their focused checks. Host/process isolation, multi-user authorization and future file/memory/external-tool trust remain limited or unimplemented; the known memory evidence-reference debt is dormant, not repaired.

## Current Foundation Verdict

🟢 SAFE FOR FINAL V1 AUDIT within the existing local-owner and trusted-server model. No demonstrated current-stage security defect required a runtime change. This does not authorize remote exposure, arbitrary code executors, autonomous tools or giving an untrusted worker the server environment/DB credential.

## Critical Capability Matrix

| Capability | Status | Evidence | Action |
|---|---|---|---|
| Authentication boundary | 🟢 IMPLEMENTED + VERIFIED | API authorize before routing; security check 1; API/Hub tests | Preserve bearer/origin/host checks. One owner credential only, not per-user identity |
| Authorization / least authority | 🟢 IMPLEMENTED + VERIFIED | strict operation schemas; plan/run/job/agent/version checks; native contracts | Scope controls current job operations; owner itself retains broad project administration |
| Cross-project isolation | 🟡 PARTIAL | current automation/job/agent/FK negative tests; security check 2 | Existing resource combinations reject. Memory→artifact cross-project evidence remains dormant until service scope is designed |
| Secret storage | 🟡 PARTIAL | ignored environment/key files; private setup operations/tests; redacted scan | Environment configuration is not a vault; Windows ACL secrecy and historical Git safety not certified |
| Runtime secret exposure | 🟡 PARTIAL | server-only environment readers, fixed HTTP transport, synthetic canary test and bundle scan | Current in-process worker has ambient server environment; no per-agent/process credential isolation |
| Model/agent non-authority | 🟢 IMPLEMENTED + VERIFIED | empty permission roles; strict grants; malicious-looking output regression | Output stays data; no agent receives owner/DB credential or authority-minting API |
| Tool/executor non-authority | 🟢 IMPLEMENTED + VERIFIED | inert executor preparation; no tool-output dispatcher; native worker/provider tests | Future MCP/external tool results must retain this boundary; not implemented yet |
| Input/prompt non-authority | 🟢 IMPLEMENTED + VERIFIED | security check 3/4; bounded JSON/strict schemas; output-as-text tests | Arbitrary JSON/text does not alter authoritative permission/cost fields |
| Controlled state mutation | 🟢 IMPLEMENTED + VERIFIED | domain service handlers, immutable mappings/receipts, scoped transitions; native suite | No public generic SQL/settings/worker-write endpoint. Trusted DB role/server code remain privileged |
| ZERO_ONLY protection | 🟢 IMPLEMENTED + VERIFIED | model-router cost/expiry/fallback tests; current native grants; checks 3/4 | Approval, text, replay and metadata do not waive cost policy; dedicated local-backend trust assumption remains |
| Stale/revoked authority fencing | 🟢 IMPLEMENTED + VERIFIED | Section 22 flag rechecks; native cancellation/dismissal/version/fingerprint/archive checks | Protect preflight and result acceptance; do not equate archive with cancellation or opt-out with killing a dispatched process |
| Race/replay safety | 🟢 IMPLEMENTED + VERIFIED | native concurrent grants/approval/start/cancel/archive/late-result/replay contracts | Scoped internal state guarantees, not universal exactly-once outside effects |
| Destructive-action safety | 🟡 PARTIAL | owner-only versioned cancellation/dismissal; developer cleanup source; no delete integration | Existing control scope verified. Permanent purge/external destruction NOT STARTED |
| Audit trail | 🟡 PARTIAL | revisions/plans/preparations/assignments/job executions/events/usage/review receipts | Reconstruct scope/time/outcome; missing named actor/source/trust and supported lifecycle event protocol |
| Trust-boundary clarity | 🟡 PARTIAL | source/runtime inventory, fixed local transport, map below | Current trusted-host seams are clear; not OS sandboxes, multi-user isolation or a generic external-input trust system |

## Authentication / Authorization Finding

The protected `/api/v1` dispatcher first validates configured single-owner credentials, bearer token, loopback request transport/protocol/port, exact Host and optional Origin, and rejects cross-site fetch metadata. Comparison uses timingSafeEqual after token format checks. Unsupported/invalid operations do not acquire a different authority path. Thirteen representative protected data/create/edit/approval/preparation/agent/provider/coordinator/cancellation routes denied unauthenticated requests before opening storage. Existing tests cover invalid keys, rebound host, mismatched origin/port and unconfigured authentication.

The browser OwnerClient keeps the key in a private connection field and sends it as an Authorization header only to the configured loopback origin, with no cookies, no-store and redirect:error. Closing clears its key/aborts pending reads and rejects late data. The UI's password input and connection exist in browser memory; a trusted browser/same-origin script can inherently access its own state. This is not hardware-backed authentication or protection from a compromised browser/host.

There are no per-user accounts, named-user permissions, agent credentials, sessions/RBAC or project tenant principals. The owner key is a broad local administrative credential allowed to access all projects. A legitimate owner GET by global run ID is therefore not a cross-project security leak. Authentication is still followed by resource-combination and action constraints: a job grant must match its actual run/project/plan/assigned agent/version/permission and cannot act on another job merely by presenting a prior receipt.

Public Hub/static pages and health/readiness/setup diagnostics are intentionally unauthenticated. Their code returns bounded status/configuration flags, not project records, credentials or execution controls. Readiness may contact the DB for health; it does not authorize work. No public config-write, lifecycle-delete, arbitrary file-read or generic SQL route was found. Local configuration/migration/demo CLIs rely on the trusted OS operator, not the HTTP bearer token. No deployment network/OS hardening claim is made; source uses local-origin gates and local DB exposure, and remote access design remains outside the current model.

## Cross-Project Isolation Finding

Current tests reject foreign automation IDs when creating a run under a different project, mismatched run/job pairs, another run's agent assignment, dismissed agents and invalid composite FK mappings. Security check 2 additionally attempted changing the project of a run-bound artifact and was rejected by referential consistency. These protect the implemented operation scopes; they are not per-project read permissions for separate human users.

The known weakness was explicitly reproduced: privileged SQL can insert a Project B memory pointing at Project A's artifact. source_artifact_id is only an artifact FK, not a same-project/sharing rule. Standalone artifact reparenting/metadata mutation also remain privileged SQL capabilities as documented in Section 21. There are no memory/artifact retrieval, registration, mutation or download services; authenticated probes to those absent endpoints returned 404 before storage. No current provider prompt construction or worker reads them. Classification: **DORMANT SCHEMA RISK, NOT REPAIRED, NO CURRENT APPLICATION EXPLOIT DEMONSTRATED**. Enforce explicit scope/sharing rules before exposing those future services.

## Secrets Finding

### Storage and configuration

Current application configuration expects DATABASE_URL, owner token and origin in ignored server environment files; provider/job/coordinator activation is also server environment configuration. No active cloud provider credential loader exists. Setup writes generated secrets with exclusive/atomic temporary-file operations and mode 0600 intent, preserves existing database settings, and refuses replacing an existing owner setup. Tests verify matching root/Hub settings and rollback. Those mode flags alone are not a Windows ACL verification or a dedicated secret vault. SQL tool metadata and generic JSON settings cannot override the current code's grant/cost rules.

This checkout currently has no root `.env` or Hub `.env.local` to inspect; the read/scan counter for those files is zero. The dedicated test DB uses its separate ignored/private audit configuration. No real secret values were printed. The repository has no commits and zero indexed files (`git ls-files`); ignore checks match actual environment/key filename patterns. Thus there is no tracked/current-history secret leak to certify or remediate, and no claim of a meaningful historical Git scan. Ignore rules are preventive, not revocation if a future secret is committed.

The first literal scan found zero configured values because owner config files were absent; that alone would have been vacuous. The final diagnostic deliberately included known inherited server/test credential material without printing it: **3 distinct secret literals, 25 existing browser JS/map assets checked, 0 matches; 0 tracked files**. Values were held only in the audit process and not written to results. This narrow literal check does not discover unknown/encoded/transformed secrets or prove an actual configured deployment safe. The build assets were from the last successful Section 22 build; they were not rebuilt with new canary credentials for this section.

### Runtime exposure

The Next/Node server process holds its configured environment and a privileged DB connection. The Job Worker is an in-process trusted TypeScript service, not a sandboxed subprocess: it inherently has the same process.env and trusted-code privileges. There is no real per-agent OS process. Current Python/Node task, GitHub Actions, n8n, MCP and Lee360 executors do not launch, so there is no current external worker receiving either an allowlisted environment or the entire server environment. Future executable workers must not simply inherit this ambient authority.

The model transport sends only fixed protocol paths and explicit prompt/token/output-limit bodies to literal 127.0.0.1:18081. It uses direct HTTP without owner/database credentials, DNS resolution, environment proxy routing or redirects; no server environment is serialized to that backend. Backend launch and its own environment are the local operator's responsibility, not managed/sanitized by LeeOS. The receiving computation and model output are untrusted for authority, while the operator's assertion that this is a dedicated local-only backend is a current operational trust assumption.

A synthetic-only environment canary was absent from captured protocol bodies, results, events/provider/memory/artifact rows, safe error replies and setup output. Focused tests also verify raw driver/provider errors and owner keys are not echoed. No browser-facing NEXT_PUBLIC credential or next.config env injection was found; server env readers stay on server routes/runtime. Frontend code does not import the server DB/provider runtime. Existing API responses and user-input JSON/text are not universal DLP: if Lee manually supplies a secret in content, the system does not magically redact it. No unsolicited input copies server secrets into prompts/memory/artifacts.

## AI / Tool Authority Finding

Model/agent/tool content is data. It cannot mint bearer credentials, set server flags, change ZERO_ONLY, approve a review, create scoped grants or activate an executor. Roles/assignments are metadata with empty permissions; the controlled worker takes strict local:text or owner:review request shapes and verifies actual stored relationships. Planning/preparation/catalog selection is not launch authority. Generated text is persisted/returned as text and rendered through React text/JSON paths; no eval, dynamic code interpreter, HTML injection renderer, shell launcher or output-to-control dispatcher was found in the current runtime.

Security check 3 stored a definition containing embedded shell permissions, executionEnabled=true, PAID and policy-override instructions. These remain inert definition_snapshot data: the automation's authoritative cost_policy stays ZERO_ONLY, its run stays queued with no jobs, and system cost policy is unchanged. Additional permission/execution fields on the real project-create control shape are rejected. The synthetic prompt can ask for expanded authority, but only a fixture text response returns; no privileged mutation follows. Native contracts recheck instruction-like model output, invalid grants and allowed-provider/output-bound expansion attempts. Future artifact/tool/MCP text has no current ingestion/execution service, so no future trust classifier is claimed.

## ZERO_ONLY Security Finding

Cost policy remains a runtime/domain boundary, not an instruction in text. Model routing rejects unconfigured/disabled/unavailable models, missing/stale/future/overlong evidence, unknown/nonzero cost, account mismatch, insufficient capacity/quota, or a possible paid fallback. Request bodies cannot supply a trusted provider registry or waive those checks. Execution re-probes the concrete local backend, checks fingerprint/context/tokens/busy state and reruns routing before the fresh job eligibility check. Approval/preparation receipts explicitly retain ZERO_ONLY and empty permissions; replay returns prior state instead of granting another generation.

The local adapter's verified-zero evidence assumes operator-enabled dedicated local-only llama.cpp, not an arbitrary loopback proxy to a billable service or proof of hidden backend internals/host resource cost. There is no automatic paid fallback or activated external paid integration. Current tests cover pure cost gates, revoked opt-ins, output non-authority and controlled replay; the Section 22 actual-manager mocked unknown/nonzero-cost check is prior evidence, not newly rerun here. No automatic cost bypass was demonstrated. Nonzero observed usage can be recorded for honest accounting without authorizing it.

## Stale Authority Finding

Section 22's repair is present and passed again: provider opt-in is rechecked immediately before completion dispatch after asynchronous preflight; job/provider enablement is rechecked during reservation and grant eligibility. Mid-tokenization opt-out prevents generation and releases preflight reservations. Current run/job state, expected versions, plan digest, agent assignment/version, dependencies, fingerprint and plan model bounds remain independently checked. Native tests exercise stale/dismissed agents, cancellation during preflight and late result rejection after cancellation/dismissal.

Section 20's limited lifecycle policy also remains explicit: archived parent blocks NEW runs/intake approval/managed trigger work; retained queued/running work/grants and owner review can finish. Project archive is not cancellation or blanket revocation. Administrative status fixtures do not constitute a public archive/restore service. Same-version archive/restore entirely between polls has no lifecycle generation fence, but no supported restore command exists. Model execution disablement is not a process-kill guarantee after a request has already been dispatched. Fresh checks are not a distributed atomic transaction with every outside service.

## Race / Replay Finding

The native suite passed concurrent duplicate run creation/state updates, preparation/assignment, approval-vs-edit/cancel, durable provider reservation, archive-vs-manual/schedule/event queueing and late result handling. Scoped execution receipts/requests bind the relevant job/run and request hash. Exact duplicate terminal requests return historical evidence; changed input is rejected, and an old success receipt is not a new grant. Provider uncertainty conservatively holds the durable slot until explicit operator recovery/reconciliation; saved results can be reconciled without another generation. The browser client does not silently retry mutations.

These are bounded internal state/reservation guarantees, not exactly-once email/deploy/publish/cleanup or remote process termination. Generic external-effect receipts, provider-side effect reconciliation and distributed leases are future work. Privileged operators can alter raw DB state; migrations/constraints/append-only boundaries reduce accidental corruption but do not sandbox the application against its own DB administrator.

## Trust Boundary Map

| Boundary | What crosses | Authority checked | Secrets crossing | Receiving-side trust |
|---|---|---|---|---|
| Browser / Hub → protected Core API | Explicit JSON action, identities/versions/digests, owner Authorization header | Bearer + local Host/Origin/transport; strict schemas/body limits; domain grant/resource checks | Owner key intentionally crosses to same-origin trusted server; prompts may contain Lee-supplied content | Server trusted; browser data not authoritative merely because JSON/text says so |
| Core API → PostgreSQL | Parameterized reads/writes, immutable snapshots/receipts, scoped transitions | Service guards, version/row locks, FKs/constraints/append-only triggers | DB credential held by server DB adapter; connection contains project data | DB and server role trusted/privileged; no tenant RLS or compromised-server isolation |
| Core API / Provider Manager → local model backend | Fixed health/props/slots/tokenize/completion protocol and explicit prompt/tokens/limits | Opt-ins, literal loopback path allowlist, fresh availability/cost/fingerprint, scoped job grant where applicable | No owner/DB credential or ambient env serialized; only explicit model content | Operator-configured local-only backend trusted for transport/cost assumptions; output has zero control authority |
| Core API → in-process Job Worker / owner review | Validated grant or explicit review action | Exact run/job/plan/version/agent/operation; dependencies; fresh flags; result acceptance fences | Same server process inherently sees server env/DB privileges; no sandbox boundary | Trusted application code, not an autonomous agent process |
| Local operator → setup/migration/developer tools | Explicit CLI/configuration operations | OS filesystem/process authority and script guards | Local configured DB/owner credentials in trusted process env/files | Local operator/dependencies trusted; not an authenticated web execution path |
| Future external tools/executors | Nothing currently dispatched | Not implemented | No current environment/credential handoff | Must add scoped credentials/trust/approval/cost controls before activation |

The public health/setup/readiness surface is a bounded diagnostics exception, not an alternate route to project data or grants. Tool/agent labels do not create a security principal. Discovery, availability, authorization and verified-free evidence remain distinct.

## Auditability Finding

Retained request/source text and proposal revisions, immutable run plan and preparation receipt, role/assignment snapshots, job execution request hash/scope/status, provider call/usage, checkpoint and transactional events connect request→plan→approval→assignment→grant→execution→result→owner review. Native tests verify rollback when required event recording fails. Root IDs and relationships allow current scope/outcomes to be reconstructed.

Limitations are explicit: one local owner path, no named-user or per-agent principal attribution; many generic events lack actor/source/trust/schema-version metadata; raw administrative status changes emit no supported lifecycle event; generic approvals/notifications are schema foundations, not fully audited authority services. Raw prompts are not persisted by provider grants; hashes cannot reconstruct their text. Generic DB usage/base rows are not all append-only against privileged SQL. No full security-monitoring, immutable external audit sink or lifecycle purge history exists.

Existing destructive/control inventory: owner-authenticated run cancellation/interruption/requeue and agent dismissal, versioned and event-recorded; explicit draft cancellation; schedule/subscription disablement; tightly owned developer temp/lock/test cleanup and old static PWA caches. Permanent project/artifact purge, arbitrary filesystem deletion, external repository/resource destruction and destructive integration launch are NOT STARTED. Notification/approval/text payloads do not activate those absent operations.

## Blocking Security Problems

**No blocking current-stage security problems detected.** Proceeding means final integration testing of the current bounded foundation, not activating unimplemented file/memory/remote-code/external-effect services under these assumptions.

## Current-Stage Defects

None demonstrated in the implemented paths reviewed. The memory evidence-scoping issue remains dormant and must be resolved before retrieval/registration is exposed. Trusted-process ambient secrets, single-owner privileges, limited audit attribution and absent enterprise/worker isolation are documented architecture limits rather than a newly demonstrated remote exploit. No claim of multi-user isolation or broad untrusted executor security was made.

## Repairs Made

No product runtime/schema/UI/configuration change was required. Added only this report and a reproducible isolated security diagnostic script/redacted result outside product source. No enterprise security platform, secret vault, RLS, multi-user auth, new execution path or permissions were introduced. The initial zero-value secret scan was strengthened in the audit tool to include known inherited server/test literals and disclose absent owner files, rather than treating a vacuous scan as clearance.

## Validation

- Focused source review: current API authentication/authorization/service/body boundaries, OwnerClient, setup/readiness, domain execution/intake/assignment/state services, provider transport, executor metadata, environment readers, configuration helpers, Git ignore rules and relevant database constraints. No broad dependency/CVE or deployed-host assessment was performed.
- Security diagnostic: `node --env-file=../../work/postgres-validation/.env --import tsx ../../work/security-boundary-audit.ts` — **5 passed groups** after strengthening the literal scan. These cover 13 unauthenticated routes/origin rejection, actual/dormant cross-project references, embedded authority text, synthetic runtime-secret canary/error isolation and redacted Git/browser-asset checks. Generated schema cleaned up in finally.
- Final redacted scan counters: **3 known server/test secret literals; 0 owner environment files present/read; 25 browser assets; 0 tracked files; 0 matches**. No real values printed or saved; no historical Git clearance. The earlier run's zero configured-value count was explicitly recognized as insufficient and superseded.
- Native contracts: `node --env-file=../../work/postgres-validation/.env --import tsx --test tests/postgres.integration.ts` — **81 passed**, zero failed, including current grant revocation, approvals, concurrent archive fencing, cancellation and replay.
- Focused tests: `node --import tsx --test tests/api.test.ts tests/agents.test.ts tests/hub.test.ts tests/model-router.test.ts tests/setup.test.ts tests/api-config.test.ts tests/pwa.test.ts` — **49 passed**, zero failed, including auth/origin/error sanitization, streamed body limits, client token handling, configuration, cost freshness and safe static cache behavior.
- Lint/typecheck/build not rerun: product source/configuration is unchanged. Their last pass is Section 22; existing Section 22 client assets were inspected rather than regenerated. Scratch diagnostic executed via tsx outside product tsconfig; no separate static-typecheck claim.
- Only the dedicated local PostgreSQL 17 audit server was contacted; fixture transports used instead of real inference. Generated schemas removed, server restored to its initial stopped state, ordinary Hub preview/user DB untouched. External services contacted: none. Paid services used: none. No destructive user-resource tests, new backup, commit or push.

## Future Security Gaps

Multi-user authentication/RBAC and actor attribution; per-agent principals/sandboxed workers with allowlisted credentials; stronger secret storage/rotation and OS permissions validation; explicit external-input/tool trust; same-project or explicitly shared memory/artifact evidence policy before retrieval; scoped artifact access/path/content services; external integration credential/cost/effect controls; security monitoring and richer audit provenance. These are future prerequisites for those capabilities, not features added by this audit.

## Final Recommendation

### 🟢 GO

Security foundation is safe enough for Section 25.

## Evidence files

- [Authentication](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/api/auth.ts)
- [Domain API](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/api/http.ts)
- [Browser owner client](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/apps/hub/lib/owner-client.ts)
- [Fresh provider guard](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/provider-manager/service.ts:76)
- [Job/grant checks](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/core/src/job-worker/index.ts)
- [Memory/artifact schema](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/outputs/leeos/packages/database/migrations/001_state.sql:53)
- [Security diagnostic script](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/security-boundary-audit.ts)
- [Redacted security results](C:/Users/Test/Documents/Codex/2026-10-16/referenced-chatgpt-conversation-this-is-an/work/section24-security-checks.json)
