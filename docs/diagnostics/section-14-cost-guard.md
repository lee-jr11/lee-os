## Blueprint Section

Section 14 — Cost Guard / Free-First Policy. Audit date 2026-10-18; LeeOS 0.18.1 / Structure 18. Source inspection, baseline tests and reproduction preceded repairs. No paid service was activated, requested or tested; no cost restriction was weakened.

## Overall Cost-Guard Verdict

🟡 **PARTIALLY ALIGNED.** Current executable paths enforce ZERO_ONLY independently of client/plan/model claims. General free-alternative discovery, external-tool evidence and complete cost reconciliation remain future work. A concrete recorded-spend reporting defect was found and repaired; no spending authorization bypass was demonstrated.

## Current Milestone Verdict

**Current automatic-execution boundary passed; reporting defect repaired and regression verified.** Supported generation remains explicit local-only with no cloud/paid fallback. This audit establishes source/fixture contracts, not independent attestation of a local backend or a real user's account/billing history.

## Cost Guard Capability Matrix

F = focused/full repository tests; D = 38 supplemental pure cost checks; S = source inspection; R = reproduced and repaired spend read model. Green is limited to the supported current subset.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| $0 automatic-spend invariant | 🟢 IMPLEMENTED + VERIFIED | F/D server gates and SQL policy | Current paths yes | Future integrations need equivalent enforcement |
| Server-side authority | 🟢 IMPLEMENTED + VERIFIED | F strict HTTP/worker/preflight | Yes | No unified Cost Guard service |
| Defense-in-depth checks | 🟡 PARTIAL | S policy literals/SQL/router/live preflight | Current checks yes | Central policy/version consistency |
| Known-zero evidence | 🟢 IMPLEMENTED + VERIFIED | F/D fresh scoped model metadata/local boundary | Local/metadata yes | Trusted operator/backend assumption |
| Unknown-cost blocking | 🟢 IMPLEMENTED + VERIFIED | F/D unknown/null/stale rejected | Yes | General tool cost schema absent |
| Nonzero-cost blocking | 🟢 IMPLEMENTED + VERIFIED | D positive sub-cent/minimum-number rejection | Yes | Ledger precision is separate |
| Currency handling | 🟡 PARTIAL | S amountUsd/cost_usd | Fixed USD yes | No conversion/multicurrency |
| Estimate/actual separation | 🟡 PARTIAL | S metadata/ledger; R subtotal | Current subset | No complete actual reconciliation |
| Evidence freshness | 🟢 IMPLEMENTED + VERIFIED | F/D timestamps/expiry/max age | Yes | General tool observers |
| Account scoping | 🟢 IMPLEMENTED + VERIFIED | F/D matching nonnull account | Model subset | Future connection evidence |
| Capability scoping | 🟡 PARTIAL | F capability+model/token checks | Current text yes | No per-capability billing matrix |
| Usage/quota coverage | 🟢 IMPLEMENTED + VERIFIED | F actual tokenization and limits | Local subset | External quota races unverified |
| Paid-fallback blocking | 🟢 IMPLEMENTED + VERIFIED | F/D disabled fallback/zero hard limit | Yes | Future transports absent |
| Subscription/API separation | 🟢 IMPLEMENTED + VERIFIED | S explicit docs and inactive providers | Yes | No entitlement checks performed |
| Free-tier evidence discipline | 🟢 IMPLEMENTED + VERIFIED | S docs; F strict evidence checklist | Current boundary yes | No external free-tier observer |
| Free-alternative foundation | 🟡 PARTIAL | F eligible model ranking; static candidates | Foundation | General discovery NOT STARTED |
| Local-execution classification | 🟢 IMPLEMENTED + VERIFIED | F local-only transport/config | Current path | Hardware/electricity excluded |
| GitHub Actions cost safety | 🟡 PARTIAL | S disabled runtime candidate/manual CI | Placeholder yes | No runtime allowance proof |
| n8n cost safety | 🟡 PARTIAL | S disabled candidate | Placeholder yes | Hosting/billing arrangement absent |
| Cloud-hosting cost safety | 🟡 PARTIAL | S no automatic provisioning | Current absence yes | Future allowance evidence |
| MCP cost safety | 🟡 PARTIAL | S no runtime MCP integration | Future seam | Underlying tool cost contract |
| Tool Registry cost foundation | ⚪ NOT STARTED | S placeholder lacks cost fields | No | Evidence/status/scope/expiry |
| Planner/cost separation | 🟢 IMPLEMENTED + VERIFIED | F/D plans inert; paid overrides rejected | Yes | Future planner must retain boundary |
| Task Router/cost separation | 🟢 IMPLEMENTED + VERIFIED | F inert routes/preparation | Yes | Dynamic option evaluation absent |
| Model Router/cost separation | 🟡 PARTIAL | S costReasons inside router reused live | Current gates yes | Independent policy service absent |
| Agent/cost separation | 🟢 IMPLEMENTED + VERIFIED | F zero-permission assignment/scoped grants | Yes | No agent billing authority |
| External-content resistance | 🟢 IMPLEMENTED + VERIFIED | F/D output is data, no settings dispatch | Authority boundary yes | Not universal semantic injection defense |
| UI non-authority | 🟢 IMPLEMENTED + VERIFIED | F strict server checks | Yes | Preserve for future settings |
| Configuration authority | 🟡 PARTIAL | S code gates/env enables/SQL constraint | Current boundary yes | Informational settings can confuse |
| Runtime policy immutability | 🟢 IMPLEMENTED + VERIFIED | F/D no runtime override, SQL restriction | Ordinary workflow yes | Operators can change code/schema/backend |
| Paid human-approval separation | 🟢 IMPLEMENTED + VERIFIED | S/F no paid grant path | Current absence yes | Paid approval intentionally absent |
| Manual-handoff foundation | 🟡 PARTIAL | F blocked reasons/results/review | Foundation | No free-partial-work handoff workflow |
| Race handling | 🟢 IMPLEMENTED + VERIFIED | F durable slot/preflight/fencing | Local callers yes | External provider/account races unverified |
| Retry cost safety | 🟢 IMPLEMENTED + VERIFIED | F replay/reconcile no generation | Yes | General retry policy future |
| Failed-call accounting | 🟡 PARTIAL | F interrupted/held records | Current evidence yes | Unknown tokens/cost may lack usage |
| Cancellation accounting | 🟡 PARTIAL | F late results; R charges retained | Current records yes | No full external reconciliation |
| Cost ledger | 🟢 IMPLEMENTED + VERIFIED | F successful local usage; R decimal subtotal | Recorded subset yes | No global completeness guarantee |
| Unknown-usage handling | 🟡 PARTIAL | F unknown records; R visible caveat | Honest wording yes | No explicit unreconciled usage metric |
| Cost visibility | 🟡 PARTIAL | R ledger-backed spend and caveat | Current label yes | Estimate/blocked/unknown dashboard absent |
| Cost event foundation | 🟡 PARTIAL | F transactional provider/usage events | Foundation | Dedicated cost/quota event kinds |
| Notification foundation | ⚪ NOT STARTED | S no Notification Manager | No | Future event consumers |
| Cost auditability | 🟡 PARTIAL | F saved decisions/events/call evidence | Current subset | Signed evidence/policyVersion/general trace |
| Trusted evidence authority | 🟡 PARTIAL | S server metadata/local adapter only | Current boundary yes | Not cryptographic billing verification |
| Tamper resistance | 🟢 IMPLEMENTED + VERIFIED | F/D client overrides rejected/SQL locked policy | Runtime clients yes | Privileged server operators remain trusted |

## Current Cost Invariant

Actual enforcement points:

- `packages/core/src/model-router/index.ts`: cost eligibility requires exact zero, verified-zero status, evidence/account/freshness/token scope, zero billing hard limit, paid fallback disabled. Every candidate is checked; priority cannot override rejection.
- Provider manager reuses routeModel on freshly probed local metadata with actual tokenized prompt immediately before dispatch, plus capacity/fingerprint/authority checks.
- Strict request schemas reject caller cost/registry/execute/paid-policy additions. Worker permits local:text or owner:review only; external executors have no launch path.
- SQL constrains automation policy, saved plans, intake proposals/receipts and preparation receipts to ZERO_ONLY; system_settings cost_policy value is constrained to ZERO_ONLY.
- `assertZeroCost` requires a verified finite numeric exact zero. Its call-site search found no production invocation: it is a foundation utility/test boundary, not the runtime authority by itself.
- Manifest/status/UI disclose policy; they do not grant authority. Local-provider enable flags permit only the supported local pathway, not paid mode.

No configurable positive automatic budget, tolerance threshold or ordinary paid API exists. Direct recorded nonzero cost is allowed in the ledger for honest auditing; that is not authorization to spend.

## Cost Authority

There is **no single centralized Cost Guard service**. Actual authority is distributed server code: Model Router's costReasons checklist, provider lifecycle preflight, strict grants/transport boundaries and SQL restrictions. It is defense in depth, but not a central policy authority plus mechanically repeated calls everywhere. Generic assertZeroCost has a simpler verified/amount contract than model evidence. Several modules repeat policy literals; drift is a future maintenance risk. No drift creating a current paid path was found. Future centralization needs a versioned policy/evidence contract without removing final execution checks.

## Current Cost Evidence

Model cost descriptor fields: status unknown/nonzero/verified-zero; nullable amountUsd; checkedAt/expiresAt; evidenceRef; accountScope; nullable maxInputTokens/maxOutputTokens; nullable billingHardLimitUsd; paidFallbackEnabled. It is nested under a specific provider/model descriptor with model capabilities and availability/quota.

Local adapter supplies short-lived evidence `local-loopback-no-billing`, account `local-process`, amount/hard limit zero and paid fallback false. It advertises text only. The operator must explicitly attest dedicated local-only configuration; direct fixed-loopback transport sends no billing credentials or remote endpoints. This trusts local process/operator configuration, not cryptographic backend attestation. Cost evidence is checked for internal consistency/freshness, not independently verified against cloud billing.

Actual successful calls reference model_usage rows. Provider call records retain IDs/status/version/hash/output/token/error/recovery/usage/timestamps. Eligibility events include fingerprint, actual input count, context/output limits, policy and local evidence label. Full evaluation decisions are persisted when part of immutable plans; preview routing is not automatically persisted. No standalone cost evidence registry or policyVersion exists.

## Known / Unknown / Nonzero Finding

Verified exact zero may qualify; unknown/null/unverified/stale evidence blocks. No rounding occurs before eligibility comparison. D rejected Number.MIN_VALUE, Number.EPSILON, 1e-9, one microdollar, one cent and larger positives. Negative/nonfinite values are invalid or rejected. Numeric strings/null/undefined do not pass the typed utility's amount check. These floating-point checks concern representable values; they are not a foreign-currency conversion mechanism.

Currency is fixed USD naming (`amountUsd`, `cost_usd`, `spent_usd`), with no currency selector/conversion. Ledger uses numeric(16,6), so recorded precision is six decimals; that precision is not used to round an external positive price into eligibility. General estimated/actual/unknown states do not exist as one unified ledger schema. Model eligibility cost is evidence for the proposed scope, not a billed receipt. Missing usage must never be interpreted as proven zero consumption.

## Freshness / Scope Finding

Router checks checkedAt<=now<expiresAt, positive validity interval, at most five-minute age/window, matching nonnull provider/account scope and evidence reference. Remaining requests must be known and at least one; model capability/context/output capacity and cost token coverage must all pass. Evidence is nested by provider/model, but has no distinct per-capability price schedule; future providers that charge differently per feature need a stronger capability-scoped contract. Current local text adapter does not expose paid image/tools capabilities.

Execution uses actual tokenizer counts, output cap at most 128 and conservative context headroom. Two probes reject changed fingerprint or busy backend. Durable local slot prevents competing LeeOS callers from consuming that slot. It cannot prove freedom from another external billing client/account race or a locally installed billing proxy. No external quota-race guarantee is claimed.

## Planner / Router / Agent Separation

Plans carry ZERO_ONLY but remain blocked/non-executable. Task Router merely supplies inert destinations/candidates and does not establish price. Model Router combines eligibility/ranking but cannot call a provider; provider manager rechecks live evidence before one authorized call. Agents receive zero-permission assignments and cannot turn text recommendations into spending authority. Model/external outputs are data, not settings/grant mutation commands. Explicit proposal review/clarification/human output review creates no paid authority. UI state cannot override backend schemas or the fixed local transport.

## Model Execution Cost Flow

Model requirements → server metadata and cost eligibility → historical selection snapshot → explicit owner local grant (or intentional authenticated standalone local call) → atomic call/slot/job reservation → actual tokenization and fresh model/cost eligibility → final scope/fingerprint recheck → bounded local completion → transactional usage/result/history and slot release → job reconciliation, with owner review where planned.

Policy checks: exact-zero/evidence scope/freshness/no paid fallback. Lifecycle checks: unique request hash, durable slot, current versions, dependency/agent scope, fingerprint, timeouts and completion reconciliation. The reservation comes before live probes to fence local competition; selection itself reserves nothing. Unknown/invalid preflight releases capacity without generation. No fallback can automatically bill after free quota disappears.

## Retry / Failure / Cancellation Cost Finding

Same-key terminal replay returns stored result; worker reconcile never generates another completion. Running/held calls conflict. No automatic retry/backoff/fallback engine exists. A new deliberate request is new work and repeats preflight. Recovery clears a held reservation only with current version and explicit restart acknowledgement; it does not regenerate the old call.

Preflight failures record failed/no dispatch. Dispatched uncertainty records interrupted/recoveryRequired and holds the slot. Such records may lack tokens/usage; failure is not proof of zero usage. A successful local call records zero API charge under the dedicated-local assumption. Cancellation/dismissal fences late job completion; provider results and usage are retained where captured. Cancellation does not delete charges or rewrite them to zero. Browser disconnect can abort request-bound work, as carried forward from Sections 5/7/13; durable records do not establish independent background execution.

## External Tool Cost Finding

GitHub Actions/n8n/Python/Lee360 runtime adapters remain disabled prepare-only candidates with no launch method. None is considered verified-free merely from its name. Repository CI is manual workflow_dispatch; it was not invoked. A workflow file alone is not allowance/billing proof.

n8n metadata does not distinguish self-hosted/cloud arrangement, location/account or billing plan; therefore it cannot establish either is free. No cloud hosting provisioning or runtime permanent free-tier fact was found. No MCP runtime exists; a future MCP tool needs independent underlying-service cost evidence. Tool Registry currently stores id/name/adapter_id/enabled/capabilities/timestamps, with no costStatus/evidence/freshness/account/capability/fallback fields and no operational cost reader/writer. No schema expansion was made.

Documentation explicitly rejects subscription→free API and free-tier label→sufficient proof. No actual entitlement/pricing/account was contacted. Future free-alternative search is NOT STARTED beyond model eligibility ranking and static executor candidates. Blocked records/reasons can support eventual explain/free-partial-work/manual handoff, but no such end-to-end service exists. No paid human-approval path or accumulating budget was built.

## Configuration Authority Finding

Runtime policy is code/literal/schema enforced, not a database setting read on every call. system_settings.cost_policy is a constrained persisted declaration; changing/deleting that row cannot change routeModel's code. Manifest controls status display, not cost eligibility. No environment variable enables a paid budget/policy; local enable/local-only/job flags activate only fixed supported scope. SQL execution_enabled remains informational relative to environment-controlled execution, as previously established; false global status is not a claim that explicitly opted-in local calls can never occur.

Ordinary client/API/agent workflows cannot change cost policy. A privileged operator can change source/build, migrations, trusted adapters, manifest or backend launch mode; that is outside ordinary runtime authority. SQL constraints can be removed by a sufficiently privileged DB operator. The system does not promise resistance to administrators rewriting it. Informational policy declarations can drift if manually edited, but no current runtime paid override exists. Future policy centralization should make active policy/version and declarations unambiguous.

## Tamper-Resistance Finding

HTTP rejects caller registries, cost claims, arbitrary endpoints, alternate currency/budget and paid-policy additions. Schemas/plan digest/worker checks prevent UI state changes from self-authorizing calls. Generic automation JSON can contain prose/custom fields including a cost claim, but no current runtime reader trusts those as billing evidence. Model output cannot modify settings, permissions or trusted provider records.

Trusted server code can inject a synthetic registry/adapter for tests; such metadata can qualify because this contract trusts adapters, not signatures. It is not reachable as an arbitrary client evidence API. Local process responses are untrusted for protocol/capacity validation but local no-billing mode still relies on operator trust. No independent billing attestation/signature system or arbitrary-worker evidence service exists. These are future evidence-authority limits, not a demonstrated remote zero-cost forgery path.

## Cost Ledger / Visibility Finding

**Reproduced defect:** run DTO spentUsd read legacy runs.spent_usd, which stayed at default zero even when model_usage held nonzero observed charges. Disposable regression recorded 0.010001+0.020002 and API incorrectly returned 0.000000. This supersedes the earlier broad characterization of that display as a reliable recorded-data subtotal in Sections 6/13. Those sections did not test this mismatch.

**Repair:** core API run DTOs now use a batched PostgreSQL SUM(cost_usd)::text grouped by selected run IDs. Reads, lists, create/replay and control responses share it. Decimal precision is retained, rows from other runs are excluded and cancellation preserves evidence. Legacy runs.spent_usd remains for compatibility but is not the API ledger source. A single aggregate query per response batch avoids per-row queries. This remains a normal nontransactional read view; records can advance between status and subtotal reads, and large ledgers may need future indexing/aggregation work.

No usage rows yields a recorded subtotal of zero, not zero actual usage. Runless standalone calls are outside run subtotals. A successful zero-cost call is distinguishable from missing usage via call/usage records, but no dedicated missing/unreconciled dashboard counter exists. Hub now says **Recorded usage only; interrupted calls may be unreconciled.** Static $0 card describes policy/local operation, not a live account balance. There is no general estimate/global spend/blocked-paid-actions dashboard or accounting reconciliation engine. No real user ledger was inspected.

Events remain audit facts, not policy authority: provider.call-eligible/started/succeeded/failed/interrupted, worker grant/results and recovery events already provide transactional evidence. Dedicated cost.detected/cost.blocked/quota.warning/usage.unreconciled events are not implemented. Notification Manager remains NOT STARTED; future typed cost-state/events can feed it after adding freshness/idempotent delivery/reason identity. No event/notification service was added.

## Dangerous Coupling

**No blocking cost-policy coupling detected after repair.** UI/Planner/Task Router/model output do not authorize costs. The runtime trusts server adapter evidence and local operator configuration; it does not trust a model's “free” claim. Model cost policy currently resides inside model-router, reused at execution, rather than an independent Cost Guard; generic utility/literals/SQL also exist. This distributed authority is partial architecture and drift risk, not current paid-provider bypass. Future executor self-claims require independent validation before launch.

## Current Regressions

🔴 **Recorded-spend reporting defect found → repaired and verified.** Valid observed charges were omitted from run API/Hub subtotal. No current automatic-spend authorization bypass found. Missing global reconciliation/free discovery/external evidence are future gaps rather than regressions.

## Repairs Made

- packages/core/src/api/service.ts: ledger-backed decimal run spend across response paths.
- tests/helpers/api-contract.ts: fixture nonzero totals, run isolation, list/get/replay and cancellation preservation.
- apps/hub/components/workbench.tsx: explicit incomplete-usage caveat.
- docs/core-api.md: subtotal semantics, legacy field and missing/standalone usage limits.
- This report plus workspace-only pure cost diagnostic/results.

No migration, budget, paid approval, provider activation or cost-policy relaxation. Synthetic nonzero records existed only in disposable test databases, not real spending or user data.

## Validation Evidence

Baseline: 68 focused tests passed before repairs. Added shared API regression reproduced 0.000000 versus expected 0.030003 before fix (the failing subtest also failed its parent). After repair the API suite passed 11/11.

Final validation after the repair:

- `npm test`: **140 passed, 0 failed, 0 skipped**, exit 0. Includes the shared API recorded-spend regression, all existing local provider/worker/cost-policy contracts and broader milestone acceptance.
- `npm run lint`: passed, exit 0.
- `npm run typecheck`: passed, exit 0 (root plus Hub route generation/TypeScript).
- `npm run build`: production webpack build passed, exit 0; compiled, checked TypeScript and generated static/API routes.
- Baseline focused command: `node --import tsx --test tests/foundation.test.ts tests/model-router.test.ts tests/local-provider.test.ts tests/worker.test.ts tests/state.test.ts tests/execution.test.ts tests/setup.test.ts tests/api.test.ts` (68 passed before adding the new regression).
- Regression reproduction and repaired verification: `node --import tsx --test tests/api.test.ts` (initial expected failure; final 11 passed). These runs are separate evidence, not added to the final full-suite count.

Supplemental `node --import tsx ../../work/cost-guard-audit.ts`: **38 checks passed**, exit 0; work/section14-cost-guard-checks.json. Pure exact-zero/sub-cent/nonfinite/unknown/freshness/account/evidence/hard-limit/fallback/token-scope and client schema override checks; no network/provider/user data. Existing repository tests cover quota, paid fallback, stale/wrong-account evidence, actual token preflight, strict grants, atomic reservations, uncertain results, replay and recovery.

No real model/API billing, external services, hosted CI, cloud provisioning, browser or fresh native PostgreSQL run was performed. Normal previews/configuration were not deliberately started/stopped or changed. Focused/full tests use embedded SQL and injected transport fixtures.

## Future Cost-Guard Gaps

Central versioned policy authority; signed/independently verified cloud/tool evidence; per-capability billing scope; account/connection observers; general free-alternative search; explicit partial-work/manual handoff; typed unknown/reconciled usage and complete accounting; dedicated events/notifications; external quota-race prevention; wider status/estimate visibility. Future paid work requires a separate deliberate human-approved design and is not enabled here.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Do not implement it automatically. Preserve the current zero automatic-spend invariant and independent live checks in every future execution path.
