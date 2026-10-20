# P0.5 — Remote execution with a verified-zero Gemini route

P0.5 adds one remote worker location and one remote AI route to the existing P0.3/P0.4 envelope queue:

```text
Hub → shared PostgreSQL → accepted envelope → GitHub Actions worker
                                      → current lease/fence
                                      → Gemini 3.1 Flash-Lite
                                      → provider ledger + accepted result
```

The executor, execution location and model remain separate choices. GitHub Actions runs the same `npm run worker:envelopes -- once` worker as other hosts. It does not create a second queue or submit results to a new API. The Hub request, local llama.cpp route, acceptance evidence and human review remain intact.

## Zero-cost dispatch gate

The only remote model route is the standard text endpoint for `gemini-3.1-flash-lite`. Before dispatch, LeeOS:

1. Uses a server-side Google service-account credential to look up which Google project owns the configured Gemini API key.
2. Reads that exact project’s billing state and blocks if billing is enabled, attached, unavailable or ambiguous.
3. Reads the API-key metadata and blocks unless the key is restricted to `generativelanguage.googleapis.com` only.
4. Checks that the pinned model exists, supports `generateContent`, the request fits the live token limits, and fresh zero-cost evidence still passes the model router.
5. Persists the P0.4 dispatch intent, repeats the billing/key/model check immediately before the single generation request, and records the returned input/output token counts with `cost_usd=0`, the evidence reference, check time and Google project scope.

Evidence expires after 60 seconds. The router’s five-minute freshness ceiling remains an additional limit. Unknown, stale, mismatched, attached-billing or nonzero evidence blocks the request. There is no paid fallback, alternate model, SDK retry, grounding/tool call, or automatic retry after dispatch. A lost response stays uncertain until the owner confirms the remote request has ended; reconciliation marks it no-retry.

Gemini’s unpaid tier may use submitted prompts and responses to improve Google products. The Hub surfaces this before an owner accepts a Gemini envelope. Avoid confidential prompts on this route. See [Google’s free-tier terms](https://ai.google.dev/gemini-api/terms) and [pricing page](https://ai.google.dev/gemini-api/docs/pricing).

## Remote runner

`.github/workflows/remote-envelope-worker.yml` supports manual dispatch and a 15-minute schedule. The interval leaves a five-minute-idle database room to autosuspend between polls; at Neon Free's smallest 0.25-CU size, a regularly spaced poll with five minutes active and ten minutes idle is roughly 60 compute-hours/month before Hub or migration activity. Keep the compute capped at 0.25 CU and monitor the provider's usage meter. The job has read-only repository permission and runs only on the default branch of a **public** repository, where standard GitHub-hosted runners are free. Private repositories and non-default refs skip the job instead of consuming paid runner minutes or exposing credentials. It checks out the default-branch code explicitly and uses at most one envelope per workflow run; GitHub’s schedule is best-effort, not an uptime guarantee. The accepted work remains queued in PostgreSQL if a run is delayed, skipped or unavailable.

Create the GitHub environment named `leeos-remote-worker`. Set its deployment branch policy to **Selected branches and tags**, with only the repository’s default branch allowed. The database secret is required for any remote worker operation. Add these environment secrets only for the capabilities you intend to enable (do not add them as repository-wide secrets):

| Secret | Purpose |
|---|---|
| `LEEOS_REMOTE_DATABASE_URL` | Required TLS PostgreSQL connection shared with the Hub |
| `GEMINI_API_KEY` | Optional AI route key, restricted to Gemini API only |
| `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON` | Optional read-only identity for API-key lookup and project billing inspection |

Secrets alone do not enable a capability. Keep these environment variables unset or set to `0` until the corresponding route is intentionally enabled:

| Environment variable | Effect when explicitly set to `1` |
|---|---|
| `LEEOS_REMOTE_WORKER_ENABLED` | Allows the scheduled/manual workflow to claim one accepted envelope; also requires `LEEOS_REMOTE_DATABASE_URL` |
| `LEEOS_GEMINI_PROVIDER_ENABLED` | Allows the worker to use the Gemini route; also requires both Gemini secrets and fresh ZERO_ONLY checks |
| `LEEOS_ARTIFACT_STORAGE_ENABLED` | Allows worker artifact custody after storage capacity is reviewed |

Resend additionally requires the free-plan, pay-as-you-go-disabled, and zero-cost owner attestations shown in the workflow. A database URL or provider credential by itself never turns on its route.

Keep the Google identity read-only. It needs API-key lookup permission and `resourcemanager.projects.get` on the key’s project; it does not need permission to change billing or API keys. Store the same provider credentials in the Hub server environment only when the Hub must plan and preview Gemini routes. Never use `NEXT_PUBLIC_*`, envelope inputs, events or browser storage for credentials.

## Setup sequence

1. Configure a PostgreSQL database reachable from both the Hub host and the GitHub runner. The current workspace has no Git remote, so the workflow is not running anywhere yet. Keep the database private and use TLS; do not expose a workstation database to the public internet.
2. Apply all migrations with `npm run db:migrate`. Readiness now includes **014_docx_operations.sql** as well as the P0.5 and P1.1 migrations. Run this deliberately against the intended shared database; migrations are never applied by the workflow.
3. Create a Gemini API key in a project with billing disabled. Restrict the key to the Generative Language API. Give the separate service account read-only permission to look up that key and read the project’s billing state. If Google cannot verify either fact, LeeOS blocks planning/dispatch.
4. Configure `LEEOS_GEMINI_PROVIDER_ENABLED=1`, `GEMINI_API_KEY` and `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON` in the Hub server environment. If a local model is ready and eligible during planning, the model router prefers the local route. When it is unavailable or disabled, a verified Gemini route may be selected. The Hub displays which route the plan selected.
5. Create the `leeos-remote-worker` GitHub environment, restrict it to the default branch, and add `LEEOS_REMOTE_DATABASE_URL`. Keep `LEEOS_REMOTE_WORKER_ENABLED=0` or unset until the owner deliberately enables remote execution. Add both Gemini secrets only when enabling the Gemini route, and keep `LEEOS_GEMINI_PROVIDER_ENABLED=0` or unset until its zero-cost checks and privacy tradeoff are reviewed. Keep GitHub Actions enabled and protect the default branch because its trusted workflow code receives configured secrets.
6. Dispatch the workflow manually once. Then accept a Gemini-routed envelope in the Hub and close the browser. The schedule will discover queued work independently, subject to GitHub’s schedule availability. Reopen the Hub and inspect the same run and usage evidence.

For local generation, leave the Gemini flag off and use the dedicated llama.cpp flags and separately started P0.4 worker. The local provider remains independently selectable when its live zero-cost route is available.

## Recovery and limits

`GET /api/v1/providers/gemini/calls/:callId` returns the provider-call status, exact usage and recorded cost evidence without the API key. If a dispatched request is uncertain, cancel the GitHub Actions run and wait for the request to end. In the Hub’s worker panel, confirm that the remote request has stopped; LeeOS then releases the provider slot and permanently records no-retry for that call. The run fails when the worker reconciles it. A new attempt requires a new run and authorization.

P0.5 supplies the code and deployment contract; it does not provision a hosted database, publish this repository, create Google credentials, add environment secrets or run a live hosted inference. This workspace has no Git remote, so live GitHub execution must be configured by the owner. The automated tests use a fake Gemini transport and a disposable embedded database; they prove cost-gate, ledger and worker behavior without contacting Google or GitHub.

The free tier’s model access and quotas can change. LeeOS probes the current model and current billing/key state for every route check; any provider outage, missing role, stale response or unsupported model blocks or leaves accepted work queued. This worker is not a hosted Hub, a database service, DOCX generator or delivery system.

## Validation

The P0.5 tests verify API-key project lookup, Gemini-only key restriction, disabled-billing proof, unknown/stale/nonzero cost rejection, actual token usage and evidence persistence, a complete remote-provider envelope worker cycle, and a billing-state change between acceptance and dispatch. They use fixture HTTP responses. No real provider key, Google call, GitHub run or billable service is used by the test suite.
