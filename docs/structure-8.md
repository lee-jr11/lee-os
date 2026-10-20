# Structure 8 — the first live provider connection

LeeOS can now make a real, bounded text-generation call to a local llama.cpp server. Earlier structures created plans, eligibility decisions, jobs and assignments. This structure connects a model through an explicitly enabled **owner diagnostic** path. It does not start those prepared jobs or agents.

The first connection runs on the existing PC without a cloud account or per-request API billing. Cloud providers remain blocked because LeeOS has no verified account-specific zero-cost evidence for them. A free-tier label alone cannot establish that evidence.

## The pieces

| Piece | What it does |
| --- | --- |
| Local adapter | Contacts only 127.0.0.1:18081 and a small fixed set of llama.cpp paths |
| Live observation | Checks readiness, one-slot configuration, loaded GGUF model and context capacity |
| Tokenization | Counts the actual prompt tokens instead of trusting a caller estimate |
| Model router | Applies existing capability/capacity/freshness/zero-cost gates to the observed local model |
| Durable reservation | Allows one LeeOS call at a time across processes sharing the database |
| Call ledger | Saves status, bounded result, usage reference and idempotency hash |
| Recovery command | Keeps uncertain dispatches blocked until the owner acknowledges a backend restart |

The local provider ID is `llamacpp-local`; the exposed model alias is `leeos-local`. Only text capability is advertised. The alias is not a claim about model quality. A model's properties/build fingerprint is saved in its eligibility event; it is not a cryptographic hash of model weights or an independent server attestation.

## What $0 means here

The adapter sends no cloud requests, API keys or billing credentials. It uses direct Node HTTP to a literal loopback address, ignoring proxy environment variables, rejecting redirects and allowing no caller-supplied endpoint or model URL. There is no cloud fallback, model-pull endpoint, tool execution or automatic download path in LeeOS.

Cost evidence means a trusted, dedicated local process with no remote backend or billing route, not a cloud-account balance. The operator must run that process locally without remote RPC/cloud forwarding and explicitly attest to that mode through configuration. The adapter can verify protocol/readiness, not prove how an arbitrary local process was started. Local operation still uses the PC's electricity and existing hardware; it does not mean all operating costs are literally zero.

## Setup

1. Follow the existing local PostgreSQL and owner API setup. Run `npm run db:migrate`; new migration `005_local_provider.sql` adds the call ledger and durable slot. Earlier migrations are unchanged.
2. Obtain a trusted llama.cpp CPU server and a compatible local GGUF model from their publishers. Keep binaries/weights outside the source repository. The validation used a small test model to prove the protocol, not a production assistant model.
3. Run a dedicated single-model server on the fixed loopback port. For Windows PowerShell, substitute your real paths:

```powershell
& 'PATH_TO_LLAMA_SERVER.exe' -m 'PATH_TO_LOCAL_MODEL.gguf' --host 127.0.0.1 --port 18081 -c 2048 -np 1 -t 2 -ngl 0 --no-webui --alias leeos-local
```

The reported context may be lower than requested; LeeOS uses the reported value. Its own context ceiling is 2048 tokens. The backend is trusted local infrastructure, not an owner-authenticated LeeOS endpoint; it is intended for dedicated use on this PC rather than remote exposure or other clients sharing its slot.

4. Add these explicit opt-in flags to the existing ignored root `.env` and Hub `.env.local`, then restart the Hub:

```dotenv
LEEOS_LOCAL_PROVIDER_ENABLED=1
LEEOS_LOCAL_PROVIDER_LOCAL_ONLY=1
```

No cloud API key is required. Do not place these or owner credentials in `NEXT_PUBLIC_*`. Leave the flags unset to keep the provider disabled. The source archive includes neither real environment files nor a runtime/model installer.

5. Run `npm run provider:status`. A ready connection reports its context and fingerprint without generating text. `npm run provider:smoke` explicitly requests a small completion and records it in the database. `npm run test:provider` exercises real inference through the owner API; it requires configured services and fails clearly rather than skipping when they are unavailable.

## Owner API

All routes use the existing owner bearer token and loopback/Host/Origin protections:

- `GET /api/v1/providers/local`: connection status; no database required, no inference.
- `POST /api/v1/providers/local/calls`: one bounded, audited text call.
- `GET /api/v1/providers/local/calls`: list records with `limit` 1–100 and optional `after` call-ID cursor, ordered by ID rather than creation time.
- `GET /api/v1/providers/local/calls/CALL_ID`: read the result/state.
- `POST /api/v1/providers/local/recover`: acknowledge restart and clear a held slot.

Example request file for `npm run leeos -- POST /providers/local/calls --json-file REQUEST_FILE`:

```json
{
  "prompt": "Once upon a time",
  "maxOutputTokens": 32,
  "idempotencyKey": "first-local-check"
}
```

Prompts are limited to 8192 UTF-8 bytes and outputs to 1–128 requested tokens, further constrained by actual context capacity. Generation uses a token-ID sequence from the same backend tokenizer; input plus reserved output must remain strictly below its context limit. Model properties and eligibility are checked again before dispatch. Only fixed generation settings are sent, without caller-controlled options. Responses must contain consistent token counts and no truncation.

A created record returns HTTP **201**, including when its diagnostic result is `failed` or `interrupted`; always inspect `data.status`, `errorCode` and `recoveryRequired`. Validation/auth/storage/reservation failures return ordinary HTTP errors before dispatch. Output text and successful token usage are persisted; raw prompt text is not saved in the ledger or history. The request hash is for deduplication, not encryption. Model output remains untrusted text and is never executed.

Reusing the same key and normalized input returns the current saved record without calling the model again. Changed input under that key conflicts. A running original returns 409. Failed/interrupted records also replay without regeneration; use a new key for a deliberate new attempt after resolving the cause.

## Reservation, usage and uncertain outcomes

The database transaction commits the call, reservation and start event before any inference. No database transaction remains open while the model runs. A separate eligibility event records the current model fingerprint, token budget and local cost evidence before dispatch. Successful result, usage record, history and slot release commit together. Usage is linked to this standalone call, with no run/agent identity and zero external API charge.

Preflight failures free the slot without model inference. An abort, timeout, malformed reply or failed final audit after dispatch marks the result interrupted and retains the slot. A lost database connection may leave the record running; the reservation still prevents an automatic second call. There is no automatic retry, lease expiry, fallback or claim of exactly-once remote execution.

For recovery:

1. Stop the diagnostic callers and any other LeeOS instances using this backend. Wait for any active call in the current process to finish; recovery rejects known active calls.
2. Stop and restart the dedicated local model server so an old generation cannot still be running.
3. List calls to find the held `call_...` record and current version.
4. Submit the following with `npm run leeos -- POST /providers/local/recover --json-file RECOVERY_FILE`:

```json
{
  "callId": "REPLACE_WITH_HELD_CALL_ID",
  "expectedVersion": 1,
  "acknowledgeServerRestart": true
}
```

Recovery is an owner assertion, not automated proof of restart. It releases capacity and preserves the interrupted call; it never regenerates that request. All instances must share the same database and use the dedicated backend for the reservation guarantee to apply.

## What remains inactive

Prepared jobs and agent assignments still have empty permissions and cannot start. Their saved plans continue to use the original conservative planning path; an owner diagnostic call does not grant them access. The system's `executionEnabled: false` is explicitly scoped to jobs/agents; `manualLocalGeneration: opt-in` describes this separate manual path. Model catalog/routing endpoints can include fresh local metadata when configured, but a routing selection is still advisory and reserves nothing.

The normal preview is left with opt-in flags unset after validation. The Hub layout only has updated milestone text. No scheduler, background worker, cloud-provider call, agent tool access or Bible automation is introduced.

## Validation model

A genuine local completion was tested with publisher-checksummed llama.cpp CPU build `b11699` and `ggml-org/models`' small `tinyllamas/stories15M-q4_0.gguf`. The portable runtime was about 19.6 MB and the model about 19.1 MB. The test model reported a 128-token context and produced real story text within a 32-token output budget. This proves connection, controls and persistence, not useful assistant quality or Bible-lesson suitability. Binaries and model files are excluded from source deliverables.

## Structure 9

Next is controlled job execution: connect an explicitly reviewed execution permission to prepared jobs, enforce dependencies and agent scope, and retain recovery fences. The manual diagnostic path does not implement that authority. Stop at Structure 8 until Lee gives the go-ahead.

## Primary references

- [llama.cpp server and protocol](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
- [Verified runtime release](https://github.com/ggml-org/llama.cpp/releases/tag/b11699)
- [Publisher test models](https://huggingface.co/ggml-org/models)
- [Gemini billing controls](https://ai.google.dev/gemini-api/docs/billing): cloud account evidence is not supplied by an API-key name or free-tier label.
