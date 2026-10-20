# Structure 5 — choosing a suitable model

Structure 4 is the planning desk. Structure 5 adds its model-selection checklist: what ability is needed, what fits, what is available, and what has trustworthy evidence of zero cost. Selection produces a reviewable decision; it never starts a model call.

## How to understand it

Imagine asking LeeOS to draft a report. The model step says it needs text generation, estimates 1,000 input tokens, and allows 500 output tokens. Tokens are the units used to measure model input and output; these are caller-supplied planning estimates today.

The provider registry describes possible models. The model router applies the same rules to every candidate and returns either a selected identity or a blocked decision with rejection codes. The orchestrator can save that decision inside the existing immutable run plan.

| Part | Its job |
| --- | --- |
| Provider metadata contracts | Describe capabilities, account configuration, capacities, availability, quota and cost evidence |
| Model router | Filter candidates, then choose deterministically among eligible candidates |
| Planner | Attach the decision to a model step and preserve it for review |
| Provider adapter, later | Obtain genuine account-specific observations and eventually make a controlled call |

The provider package still has no SDK, credential reader, or network client. Gemini, Codex, and Claude remain planned provider IDs with no configured models. They are names reserved by the existing architecture, not promises about current access, subscription entitlements, pricing, or capabilities. No subscription is assumed to provide API access.

## The selection checklist

A candidate must pass every gate:

1. Its provider is enabled/configured and permitted by the optional provider allowlist.
2. The model is enabled and supports every requested capability: `text`, `code`, `structured-output`, or `image-input`.
3. Input plus reserved output fits its context window, and output fits its output limit.
4. Availability is explicitly known, its evidence is fresh, and at least one request remains.
5. Cost is explicitly verified zero for the configured account, with an evidence reference and limits covering both requested input and output.
6. The account's recorded hard billing limit is exactly zero and paid fallback is disabled.

Unknown or missing evidence blocks selection. Both availability and cost records must have valid timestamps, must not originate in the future, must not be expired, and must cover a window no longer than five minutes. A stale or paid preferred candidate is rejected before ranking. Eligible candidates sort by lower configured priority number, then provider ID and model ID using stable character order. This ranking is an operator preference, not a benchmark of model quality.

Cost and availability evidence are trusted **server adapter assertions** under this contract. The router checks their consistency and freshness; it does not independently contact billing services, authenticate evidence, or prove a provider's claims. No real adapter currently supplies such evidence, so the default catalog cannot select a model. The stricter zero-billing requirement may also exclude services that cannot enforce it.

## Try the demonstration

From the repository folder, run `npm run model:demo`.

It first shows the real default catalog and a blocked result. It then uses clearly labelled fictional metadata to demonstrate an eligible selection inside a plan. The fixture is only imported by the demonstration and tests, never registered by the Hub. It has no working provider, API key, network call, cost, or persisted data.

## Owner API and CLI

The existing private owner credentials, loopback-only restrictions and JSON limits protect both new endpoints. They do not require a database:

- `GET /api/v1/models/catalog`: provider/model metadata; credentials, account scope and evidence references are not returned.
- `POST /api/v1/models/route`: read-only routing evaluation. A valid request returns HTTP 200 even when the decision is blocked.

Use `npm run leeos -- GET /models/catalog` after existing API setup. Save this example to a request JSON file and use `npm run leeos -- POST /models/route --json-file PATH_TO_FILE`:

```json
{
  "capabilities": ["text"],
  "inputTokens": 1000,
  "outputTokens": 500
}
```

`allowedProviderIds` is optional and constrains eligibility; it never bypasses the gates. Unknown fields are rejected. The caller cannot supply a registry, cost evidence, account, priority, clock, or execution override. The Hub currently uses the unconfigured default registry; no registry-edit endpoint or runtime registry file loader is exposed.

The decision includes `routerVersion`, evaluation time, normalized requirements, status, selected identity or null, `validUntil` for a selection, and each candidate's rejection codes. With no registered models, the reason is `NO_CONFIGURED_MODELS`. With registered but ineligible candidates, it is `NO_ELIGIBLE_MODEL`. The catalog describes metadata rather than live eligibility; use the routing evaluation for the latter.

## Connect a model step to the planner

A model step may now include a `model` object:

```json
{
  "expectedRunVersion": 0,
  "goal": "Draft and review a report",
  "steps": [
    {
      "key": "draft",
      "title": "Draft report",
      "kind": "model",
      "model": {"capabilities":["text"],"inputTokens":1000,"outputTokens":500}
    },
    {"key":"review","title":"Lee reviews report","kind":"review","dependsOn":["draft"]}
  ]
}
```

Send it through the existing `POST /api/v1/runs/:runId/plan` route. The saved plan uses planner version 2. Old Structure 4 request shapes still work; a model step without requirements remains blocked rather than guessing its requirements. Supplying model requirements on a non-model step is rejected.

Existing version 1 plan snapshots remain unchanged. Identical request replay returns the original snapshot even after its evidence expires; that is historical information, not current eligibility. A new run is required to replan. Standalone routing evaluations are read-only and not stored as events. No database migration is needed.

## What selected means today

A selection says that one trusted metadata snapshot passed the checklist at its evaluation time. It does not reserve quota, prevent another request using the same remaining allowance, authorize a call, or guarantee a later result. A future executor must recheck live eligibility, reserve capacity atomically, enforce actual token limits and billing controls, and record usage before any live integration can be considered ready.

All plans still report `status: blocked` and `executionEnabled: false`. No jobs, provider calls, approvals, or spending are introduced. The Hub layout is unchanged apart from its milestone label.

## Where the pieces live

- `packages/providers/src/index.ts`: validated provider metadata contracts and default catalog.
- `packages/core/src/model-router/index.ts`: deterministic eligibility and selection.
- `packages/core/src/orchestrator/index.ts`: model requirements and saved routing decisions.
- `tests/model-router.test.ts`: policy, freshness, ranking, strict API and planner checks.
- `scripts/model-demo.ts`: runnable, explicitly fictional demonstration.

## Structure 6

Next is the execution-manager and executor-adapter foundation: turning a reviewed plan into controlled jobs, with clear permissions and recovery boundaries. Live model/provider calls and external or paid execution remain separate work. Stop here until Lee gives the go-ahead.
