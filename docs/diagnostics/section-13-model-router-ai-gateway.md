## Blueprint Section

Section 13 — Model Router / AI Gateway. Audit date 2026-10-18, LeeOS 0.18.1 / Structure 18. Source inspection and tests preceded this report. No runtime, schema, dependency, configuration, provider or service changes.

## Overall Model-Router Verdict

🟡 **PARTIALLY ALIGNED.** Verified deterministic model eligibility/ranking and a bounded local llama.cpp execution path exist. A general multi-provider AI Gateway, cloud transports, Ollama, quality learning and privacy-aware routing are not implemented. Selection is an advisory snapshot, never execution authority.

## Current Milestone Verdict

**Healthy within the current metadata-routing/local-text milestone.** Focused contracts verify cost/availability/capability rejection, scoped grants, durable reservations, replay/recovery, usage and failure boundaries. Previously disclosed request-bound cancellation remains technical debt, not a newly introduced regression. No current defect required repair.

## Model Router Capability Matrix

F = 69 focused tests; D = 15 supplemental synthetic checks; S = source inspection. Green covers the supported current boundary, not the full target Gateway.

| Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| AI-optional behavior | 🟢 IMPLEMENTED + VERIFIED | F deterministic controls/intake; D nonmodel planning | Yes | General AI-need reasoning absent |
| Task/Model Router separation | 🟢 IMPLEMENTED + VERIFIED | S/F separate route/modelDecision | Yes | Preserve in later orchestration |
| Agent/model separation | 🟢 IMPLEMENTED + VERIFIED | F roles/assignments no provider identity | Yes | Multi-provider role use not live |
| Router/provider separation | 🟢 IMPLEMENTED + VERIFIED | F/D pure routeModel versus adapter | Yes | General dispatcher future |
| Provider adapter contract | 🟡 PARTIAL | F local probe/tokenize/generate | Local yes | Common multi-provider operations |
| Provider replaceability | 🟡 PARTIAL | F disabled providers/control independence | Control plane yes | Local SQL/worker specialization |
| Capability matching | 🟢 IMPLEMENTED + VERIFIED | F/D candidate-by-candidate eligibility | Yes | Execution supports text only |
| Manual model selection | 🟡 PARTIAL | F/D provider allowlist | Scoped constraint yes | Exact model settings/Hub AUTO selector |
| Automatic model selection | 🟡 PARTIAL | F/D eligible priority ranking | Metadata yes | Quality/task-aware ranking |
| Preference/requirement distinction | 🟡 PARTIAL | S priority versus hard allowlist | Basic yes | Per-request soft preference/local requirement |
| Cost-policy enforcement | 🟢 IMPLEMENTED + VERIFIED | F/D unknown/nonzero/stale rejected, local recheck | Current path yes | Future cloud billing evidence |
| Subscription/API distinction | 🟢 IMPLEMENTED + VERIFIED | S docs explicitly deny entitlement assumption; F inactive clouds | Documentation/config yes | Actual cloud access not established |
| Quota awareness | 🟡 PARTIAL | F/D fresh remainingRequests eligibility | Snapshot yes | Provider rate-limit observers/windows |
| Usage tracking | 🟢 IMPLEMENTED + VERIFIED | F call/usage/run/agent records, durable replay | Successful local calls yes | Incomplete uncertain-call accounting |
| Estimated/actual cost separation | 🟡 PARTIAL | S metadata estimate scope versus ledger | Local recorded subset | General estimate/reconciliation schema |
| Availability/readiness | 🟢 IMPLEMENTED + VERIFIED | F metadata gates, local protocol checks | Local/snapshot yes | Unified rate-limit/host states |
| Local-model foundation | 🟢 IMPLEMENTED + VERIFIED | F adapter/worker fixture contracts | llama.cpp yes | No new live inference; Ollama absent |
| Cloud-model foundation | 🟡 PARTIAL | S generic descriptors/inactive IDs | Metadata only | No cloud SDK/transport/credentials |
| Fallback candidates | 🟡 PARTIAL | F/D eligible alternatives | Selection yes | No fallback calls/retry orchestration |
| Fallback capability validation | 🟢 IMPLEMENTED + VERIFIED | F/D each candidate checked | Selection yes | Runtime alternative dispatch absent |
| Provider failure isolation | 🟢 IMPLEMENTED + VERIFIED | F normalized failures/rollback/recovery | Local yes | Local global slot deliberately blocks peers |
| Output/task-success separation | 🟡 PARTIAL | F separate call/job/review records | Current semantics yes | No acceptance-criteria evaluator |
| Structured output foundation | 🟡 PARTIAL | S capability metadata, protocol validation | Metadata/protocol yes | Task-output schema validation absent |
| Reservation/grant separation | 🟢 IMPLEMENTED + VERIFIED | F grants then atomic durable reservation | Yes | General multi-provider reservations |
| Decision snapshot | 🟢 IMPLEMENTED + VERIFIED | F saved immutable plan modelDecision | Yes | Actual call selection has local-specific trace |
| Router versioning foundation | 🟡 PARTIAL | S routerVersion 1/plannerVersion 2 | Existing history yes | No explicit policyVersion |
| Performance-learning foundation | 🟡 PARTIAL | F call/usage/review evidence; SQL placeholder | Evidence only | Learning NOT STARTED |
| Verified-outcome foundation | 🟡 PARTIAL | F separate human review | Foundation | Typed quality/criteria linkage |
| Privacy constraints foundation | 🟡 PARTIAL | F allowlist/local isolation | Current subset | No local-only/no-AI/privacy field |
| Credential isolation | 🟢 IMPLEMENTED + VERIFIED | F strict bodies/error sanitization; S no provider keys | Current paths yes | Future secret-manager integration |
| Prompt isolation | 🟢 IMPLEMENTED + VERIFIED | F bounded exact prompts/no automatic history | Yes | No general secret redaction |
| Prompt-injection authority boundary | 🟢 IMPLEMENTED + VERIFIED | F grants independent; D output stays data | Yes | Semantic injection defenses not general |
| Cancellation semantics | 🟡 PARTIAL | F preflight/late-result fences; S request.signal | Safe recording yes | Disconnect/timeout/cancel not fully distinguished |
| Concurrency foundation | 🟢 IMPLEMENTED + VERIFIED | F durable slot/call IDs across managers | Serialized local slot yes | No concurrency expansion |
| Retry safeguards | 🟢 IMPLEMENTED + VERIFIED | F replay/reconcile never regenerate | Yes | Typed deliberate retry policy absent |
| Manual override foundation | 🟡 PARTIAL | F hard provider allowlist/exact local grant | API subset | Configuration modes/UI absent |
| Fail-closed no-model path | 🟢 IMPLEMENTED + VERIFIED | F/D null selection/block reasons | Yes | General handoff future |
| Provider status foundation | 🟡 PARTIAL | F local status + safe metadata catalog | Subset yes | Unified multi-provider status dashboard |
| AI Gateway centralization | 🟡 PARTIAL | S centralized local transport/manager | Bounded yes | Worker/API/SQL local specialization |

## Current Model-Router Inputs

`modelRequest` is strict: unique capabilities 1–4 from text/code/structured-output/image-input; positive integer inputTokens/outputTokens up to 100,000,000 each; optional unique allowedProviderIds 1–20 validated identifiers. Sizes are caller estimates at planning time. No task prose, role name, keys, arbitrary registry, price, client clock, exact model allowlist, privacy flag or soft preference is accepted in the request.

`routeModel(value, options)` separately receives trusted server `registry` and `now` options. HTTP authenticates owner, validates the body and obtains registry through the local provider manager or inactive defaults. Client-supplied metadata/clock overrides are rejected. Nonmodel planning does not call routeModel; model steps without model requirements do not guess a model. Deterministic reads/commands/rules need no generation. When local provider is enabled, explicit catalog/routing probes may contact its readiness protocol; probing is not inference.

## Current Model-Router Output Contract

```ts
{
 routerVersion: '1', evaluatedAt, costPolicy: 'ZERO_ONLY',
 executionEnabled: false, status: 'selected' | 'blocked',
 request, validUntil,
 selected: {providerId, modelId} | null,
 reason: 'ELIGIBLE_SNAPSHOT_ONLY' | 'NO_ELIGIBLE_MODEL' | 'NO_CONFIGURED_MODELS',
 evaluations: [{providerId, modelId, priority, eligible, reasons}]
}
```

Reasons cover provider configuration, allowlist, disabled model, missing capabilities, token capacity, availability/freshness/quota and cost evidence/account/billing/token scope. validUntil is the earlier selected availability/cost expiry. No quota reservation occurs and input registry is not mutated. Saved plan decisions remain historical after expiry.

## Current Candidate Ranking

All candidates receive the full eligibility checklist. Evaluations sort by ascending numeric priority, then provider ID, then model ID using deterministic lexical comparison. The first eligible candidate wins, even if an ineligible candidate sorts earlier. No quality, measured latency, performance learning, task specialty, privacy or location ranking exists. remainingRequests must be at least one but quota-low is not a ranking factor. Priority is a server metadata preference; allowedProviderIds is a hard request constraint. There is no dedicated per-project soft model preference or AUTO configuration UI.

## Provider Adapter Finding

`packages/providers/src/index.ts` generic ProviderAdapter only declares id/enabled. Provider/model descriptors are structured metadata, not a complete transport abstraction. The actual local adapter in local.ts exposes probe, tokenize and generate via injected LocalTransport. It supports bounded text only, not separate reason/code/review/tool operations. LocalProviderError normalizes code and uses a generic public message.

Transport is direct node:http to literal 127.0.0.1:18081, with no proxy/DNS/redirect/credential forwarding, allowlisted health/props/slots/tokenize/completion paths, JSON/content-type/UTF-8/response-size checks, bounded timers, one slot and no model pull/download. Adapter validates readiness properties, GGUF path, token counts, stopped/nontruncated response and output limits. generate returns text/inputTokens/outputTokens. Protocol JSON validation is not validation of model-generated task JSON. Model response content remains an arbitrary text string.

Local manager centralizes enabled state, status/registry, reservation, preflight, usage/results/recovery; HTTP and worker call it. No cloud transport exists. Extending actual providers needs transport/dispatch integration and schema evolution, not just changing an ID.

## Agent / Model Separation

Roles contain name/purpose/stepKinds/empty permissions; assignment stores role snapshot, job/run identity and reviewed plan digest. Neither binds a provider/model. Writer/quality-reviewer templates describe roles, not Gemini/Codex aliases. Local worker currently uses one transport independently of role name. A PM coordinator or cross-provider role execution service is not implemented.

## Task / Model Router Separation

Task Router returns model-router as descriptive target, selects no AI product and launches no executor. Planner composes separate route and optional modelDecision. Recognized text intake drafts model/review steps without choosing provider IDs. No Intent/Planner/Task shortcut coding→Codex or writing→Gemini was found.

## Cost Finding

Model eligibility requires verified-zero, amount zero, evidence reference, matching nonnull account scope, fresh checkedAt/expiresAt, request token coverage, billing hard limit zero and paid fallback disabled. Evidence validity is at most five minutes; expired/future/missing/overlong evidence blocks. Router checks trusted server assertions; it does not independently authenticate billing claims or contact billing services.

Execution never trusts an old plan snapshot as live cost authority. Local manager probes, tokenizes actual prompt, probes again, checks fingerprint/busy state, calls routeModel on fresh local-only metadata and enforces context headroom. Dedicated enable+LOCAL_ONLY configuration is required. The loopback local process and operator attestation establish the supported no-API-billing assumption; protocol checks/fingerprint cannot prove weights/backend internals or prevent an operator running a forwarding proxy. No cloud billing route or fallback is configured. Zero API spend excludes hardware/electricity costs.

Metadata cost.amountUsd is eligibility evidence, not an observed charge. Successful local usage records cost_usd=0; schema permits honest observed nonzero charges. Failure/uncertain calls may have no usage record; missing usage is not proof of zero consumed tokens or complete accounting. No general estimate field, cloud invoice reconciliation or global actual-cost completeness claim exists. Section 6's Recorded API spend remains a supported ledger subtotal, not total operating cost.

## Subscription vs API Finding

Structure 5 explicitly states reserved provider names promise no access, entitlement, pricing or capability and that no subscription is assumed to provide API access. Cloud IDs remain disabled with no models. Structure 8 rejects a free-tier label alone as zero-cost proof. No subscription/student-plan→free-API assumption or active billing path was found. This is local source/config inspection; no external entitlement or current product pricing was verified or needed.

## Quota / Usage Finding

Generic snapshots carry availability status, checkedAt/expiresAt and nullable remainingRequests; selection blocks null/zero quota. Local remainingRequests is one or zero based on a busy slot, not a commercial allowance. No provider-specific rate-limit windows, quota-low state or cloud usage observer exists.

provider_calls persists call/request key/hash, provider/model IDs, status/version, output text, nullable tokens/error/usage link, recovery flag and timestamps; raw prompt is not stored there. Unique request key/hash fences mismatched replay. provider_slots has one durable local slot. model_usage links successful observed local tokens/cost to provider/model and optional run/agent. Worker execution records link job/run/agent/call/grant hash and outcome; events preserve fingerprint, limits and local evidence. Standalone owner calls have null run/agent. Call IDs preserve attempted/failed calls even without usage. There is no general usage analytics dashboard or reliable token estimate for uncertain dispatch.

## Local / Cloud Model Finding

Only local llama.cpp text transport is implemented. Ollama is absent and was not installed. Generic descriptors can represent another local/cloud provider, but provider_calls/provider_slots SQL explicitly constrain current IDs and worker grants are local:text. Cloud Gemini/Codex/Claude entries have no configured models/transports/credentials. Host location and privacy are not independent routing fields. Allowlist can constrain IDs but cannot semantically express must-run-locally unless a trusted adapter contract defines it. Current local host must be online; cloud continuity while Lee360 is off is future capability. Deterministic control paths remain provider-independent.

## Fallback Finding

Every candidate rechecks all required capabilities/capacity/cost/availability/allowlist constraints. F/D confirm an ineligible preferred candidate yields a valid alternative or null selection, never a capability downgrade or paid fallback. Evaluations retain candidate/rejection data; validUntil bounds the snapshot. This is selection among metadata, not retry/failover execution. There is no automatic second-provider call, ranked runtime fallback plan or relaxation of hard requirements.

## Reservation / Grant Finding

Selection snapshot alone creates no call. For a prepared job: owner supplies current run/agent versions, exact plan digest, local:text permission, execution acknowledgement, exact prompt/output limit and model fingerprint → worker validates kind/dependencies/scope/allowlist → manager locks durable slot and creates call → scope.reserve atomically records job grant/start and slot claim → probes/tokenizes/rechecks model eligibility → scope.eligible rechecks authority and fingerprint before dispatch → one bounded call → transactional usage/result/event → job reconciliation and separate owner-review step where planned. Reservation intentionally precedes live preflight to fence competition; failed preflight releases it. A returned selected ID is not an arbitrary provider dispatcher.

Standalone owner API calls use authenticated strict local calls plus explicit local-provider enablement and request key, without a job grant. They are intentional owner calls, not a bypass derived from a saved plan. Controlled-job key namespace is reserved. No agent may turn a response into a grant.

## Failure / Retry / Cancellation Finding

Preflight failure records failed/no recovery and releases slot. Dispatched failure, malformed result or finalization uncertainty records interrupted/recoveryRequired and retains slot conservatively. Adapter errors normalize connection/timeout/abort/HTTP/protocol/usage codes; non-200 including a potential rate limit is LOCAL_HTTP_ERROR, not a distinct cloud rate-limit state. Raw backend messages do not enter public errors. Atomic start/success history failures roll back partial state/usage, and uncertain dispatch is not silently retried. Section 3 failure-isolation findings carry forward: current records scope failures, though one local slot intentionally blocks other local calls until safe recovery.

Same-key replay returns terminal history without generation; running/held calls conflict. Worker reconciliation uses stored result without a second call. No automatic retry/backoff/fallback exists. A new deliberate request is new work; recovery requires exact version and explicit backend-restart acknowledgement after stopping callers. This acknowledgement is operational, not independent proof the backend restarted.

HTTP forwards request.signal to worker/provider; manager combines it with a 30-second timeout. Browser disconnect, explicit caller abort and timeout can therefore interrupt execution; only error/phase and surrounding run events partly distinguish them, not a dedicated cancellation-cause contract. Explicit run cancellation/dismissal revokes current authority; preflight cancels generation, and late results are retained but cannot complete revoked work. Post-dispatch cancellation may still consume local computation. Carry forward Section 5/7 request-lifetime debt: durable records are not a browser-independent background worker. No new cancellation-engine or concurrent dispatch was built.

Unique call IDs, global durable slot locking and request hashes prevent overwrite/duplicate generation across managers. Concurrent expansion is deliberately absent. The in-process active set prevents same-manager recovery during its call; durable recovery still relies on owner stopping other callers/restarting as documented.

## Model Output / Verification Finding

Protocol validation establishes a bounded provider response, not task correctness. Worker marks a supported model job succeeded on reconciled successful response; a model-only supplied plan can consequently finish. Intake/Hub sequence paths add final owner review, which is separate explicit evidence of human acceptance, not a technical criterion evaluator. Section 11's missing acceptance criteria remain relevant. No general tests/build/browser/output-schema verifier exists. structured-output is a metadata capability; local advertises text only and never parses generated JSON into control actions.

Call/usage/grant/result/human-review records can seed future metrics, but no model_performance writer/evaluator/ranking feedback exists. Its placeholder usage/capability/outcome/duration/human-correction fields are not learning. Future verified outcomes need explicit criterion/review-to-call attribution and must not label HTTP success as quality.

## Credential / Prompt Security Finding

Routing accepts safe metadata, no raw keys. Strict bodies reject credential/endpoint/registry/cost overrides; local transport sends no provider credentials. Owner bearer key stays at the separate local connection/authentication boundary and is not copied into model prompts or provider records. No real credential content was read in this audit.

Owner supplies an exact prompt, at most 8192 UTF-8 bytes and output at most 128 tokens with actual context limits. No automatic database/memory/project-history/source-file context or earlier output chaining occurs. Provider ledger stores a request hash rather than raw prompt, though approved source/intake text and generated output can independently contain sensitive text. There is no universal secret-redaction/privacy classifier. Model output stays display/result data; no tools, permission expansion, deployment or execution command parser consumes it. D confirmed JSON-looking deployment instructions remain plain text. This is an authority boundary, not a universal semantic prompt-injection detector.

## Hard-Coded Provider Finding

Inactive default names: gemini/codex/claude. Actual adapter/slot/ledger: llamacpp-local and leeos-local, fixed loopback port and single slot. Core worker explicitly rejects nontext or nonlocal provider scope; provider manager writes local IDs; API disabled-status fallback names local ID. Hub/CLI configuration and local checks reflect this supported adapter. No role/task→commercial-provider shortcut was found. These are deliberate bounded safety constraints, not general replaceability. Model fingerprint hashes reported model path/build info, not weight bytes. Future providers need their own validated identities/dispatch and migration path.

## AI Gateway Finding

Network behavior is centralized in provider local.ts; reservation/preflight/usage/recovery in provider-manager; pure ranking in model-router. Provider-specific local identity/scope exists in worker, API fallback and SQL, so no complete company-neutral gateway exists. Manual Hub override can later be typed configuration consumed by routing, not hard-coded per-provider UI branches; current Hub offers checked local model/fingerprint and exact grant rather than AUTO/Codex/Gemini settings. Catalog/status endpoints expose sanitized metadata. Local inspect returns disabled/ready/busy/unavailable; model snapshot status is unknown/unavailable/available plus independent configured flags. The catalog omits full cost/availability evidence; route decisions contain rejection reasons. A unified multi-provider status/credential manager remains future work.

## Dangerous Coupling

**No blocking model-router coupling detected.** Intent, Task Router and role definitions do not contain provider transport or product selection. Planner explicitly composes a separate pure router snapshot, not a call. Local worker/SQL/API specialization is known gateway evolution debt and safety scope, not a demonstrated authorization defect. Generic descriptors alone do not guarantee drop-in transport replacement. Retain independent execution-time checks when centralizing more providers.

## Current Regressions

None identified within the documented current model-routing/local-text milestone. Request-bound execution, incomplete uncertain-usage accounting and absent general gateway are carried-forward limitations.

## Repairs Made

No runtime repair needed. Added this report; temporary supplemental diagnostic script/results remain in workspace work/. No providers, cloud keys, subscriptions, paid paths, Ollama install, retry engine or multi-provider gateway were added.

## Validation Evidence

- `node --import tsx --test tests/model-router.test.ts tests/local-provider.test.ts tests/worker.test.ts tests/agents.test.ts tests/api.test.ts tests/intake.test.ts tests/foundation.test.ts`: **69 passed, 0 failed, 0 skipped**, exit 0. Focused embedded SQL/fixture contracts cover eligibility/freshness, capability/allowlist/cost/quota, strict owner boundaries, deterministic controls, local protocol limits, durable reservations, usage/replay/rollback/recovery, scoped agents and late-result/preflight cancellation fences.
- `node --import tsx ../../work/model-gateway-audit.ts`: **15 checks passed**, exit 0. Results work/section13-model-gateway-checks.json. Synthetic cross-provider tie/order/mutation checks; paid/unknown/incapable/quota/unavailable/expired preferred candidates; hard allowlist and no-capability downgrade; no-model path; nonmodel planning independent of registry; strict credential/cost/privacy/preference override rejection; prompt bytes/output cap; injected-adapter response remains data and usage mismatch rejects. No real providers/network/database in this supplemental diagnostic.
- Inspected router, descriptors, local transport, provider manager/contracts, migrations 001/005, worker grant/reconcile logic, HTTP signal/auth boundary, local configuration, current tests and Structures 5/8 plus prior diagnostic findings. No live entitlement/pricing assertions were needed.

No fresh full suite, build/lint/typecheck, native PostgreSQL, browser, real-model inference or paid/cloud service was run. Section 5/7 browser-disconnect evidence remains historical, not a new test count. Normal previews/settings were untouched.

## Future Model-Router Gaps

Multi-provider transport/dispatch; cloud access evidence/secret management; Ollama integration; exact model/project preferences and privacy/location constraints; quota/rate-limit observers; quality/latency/outcome learning; structured task-output validation; policyVersion; controlled fallback/retry; comprehensive uncertain usage accounting; cancellation-cause records and durable background execution; unified status/manual override UI. Preserve historical routerVersion/modelDecision snapshots and introduce versioned policy/adapter contracts without rewriting prior plans or receipts.

## Recommended Next Step

Audit the next blueprint section Lee supplies. Do not automatically implement it. Before expanding providers, define the common invocation/result/error/usage/authority contract and independent cost evidence for each actual access path.
