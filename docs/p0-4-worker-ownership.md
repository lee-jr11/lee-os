# P0.4 — Worker claim, lease and recovery

Accepted work now has an execution owner outside the browser/API request. A separately started Node/TypeScript process discovers durable work in PostgreSQL, claims an envelope, renews its lease, resolves exact persisted inputs, and records results. The API never starts or owns this worker's generation lifetime.

Accepted envelope → queued work → claim/fence → worker-owned execution → persisted result or explicit recovery state. An envelope, operation job, lease, dispatch intent and result remain separate records/concepts. The new operation ledger is separate from legacy request-bound `jobs`/`prepared_jobs`; those APIs cannot execute envelope operations.

**P0.5 follow-on:** An opt-in GitHub Actions host and guarded Gemini route now use this same envelope queue and worker. See [the P0.5 guide](p0-5-remote-zero-cost.md); local worker execution remains available.

## Ownership

Migration 011 adds a unique `envelope_work` row per accepted envelope, append-only `envelope_claims`, scoped `envelope_operations`, and append-only `envelope_reviews`. It backfills existing P0.3 envelopes without changing their bodies, hashes, grants or identities. New acceptance inserts the queue row in its existing transaction, with no job dispatch or AI call.

States are `queued`, `running`, `waiting-human`, `recovery-required`, `succeeded`, `failed`, `cancelled` and `expired`. Queue state is mutable ownership; envelope authorization remains immutable.

Claims lock both the run and queue row using `FOR UPDATE ... SKIP LOCKED`. Each claim increments a database bigint fencing token; history records the worker identity and fence. Heartbeats and result publication check the exact current worker/fence, live lease, run state, grant expiry and permanent revocation. Database `clock_timestamp()` is authoritative for expiry. An expired worker cannot renew its old lease or publish an accepted result.

The default lease is 15 seconds, renewed about every five seconds by the worker's own timer. A bounded reaper scans recoverable/inactive work and never holds locks over a model HTTP call. Active valid workers are not included in routine expired-lease scans. A worker handles one envelope at a time; the existing durable local-provider slot prevents simultaneous model calls across processes. Resource unavailability returns work to the queue with backoff, retaining its original accepted identity. The operator does not need to resubmit it.

The process uses its own shutdown signal. Neither an owner HTTP abort nor a closed Hub connection is passed to the worker. Stopping/killing the worker is different: it relinquishes work when possible or lets its lease expire. Another process can rediscover the durable state. Continuous operation still requires the worker host and database to be available; P0.5 now supplies an optional remote host, subject to owner setup.

## Before, during and after dispatch

The worker supports the versioned P0.3 local text-generation and human-review operation contracts. It checks the envelope hash and supported contract versions, resolves named/literal/output-reference inputs, and checks byte limits. Before generation, the existing local provider performs fresh health, capacity, quota, tokenization and zero-cost checks. The worker additionally checks the exact pinned model fingerprint and persisted input-token budget.

Provider reservation and the operation's call identity/resolved input are committed together under a valid claim. The operation then records an audited **dispatch intent** under the current lease before the provider sends a generation request. A saved provider result is an observation; publishing it as an accepted operation result requires a valid current claim again. An output beyond the authorized byte bound fails the operation once, retaining the raw provider fact without accepting or regenerating it. A stale process may leave a raw provider observation, but cannot publish accepted operation output or acceptance evidence.

The model output and usage are recorded in the existing provider ledger. Operation publication verifies the scoped call ID, stable request key and exact request hash. It records the dispatch fence and the result-publication fence separately. A fresh owner can reconcile a saved result from an older fence without calling the model again. Completed operation results and identities are immutable.

Cancellation, revocation and grant expiry invalidate claim checks immediately. Heartbeat failure aborts the worker-owned call; late results are not accepted. Housekeeping subsequently classifies the queue and terminal run state. Cancellation cannot undo a request already sent to a provider; it fences acceptance of the result. This is not a claim of exactly-once network effects.

## Recovery rules

- **No reservation/dispatch:** lease expiry requeues the same work. A new claim uses a higher fence and resumes from persisted completed operations.
- **Proven preflight backpressure:** a `reserved` operation with a known busy/model-change preflight failure can retry preflight with the exact same call/request identity and unchanged inputs under a fresh valid claim. It has not reached dispatch intent and has made no generation. This path is not available to dispatched or uncertain calls, or to legacy generic caller replay. Ownership/preflight retries do not authorize a second generation attempt.
- **Saved terminal result:** a new legitimate claim reconciles it from the provider ledger. It never regenerates a completed operation. Dependent operations read persisted outputs, including after process/database reopen.
- **Call may have been dispatched, outcome unknown:** work enters `recovery-required`; the provider reservation remains held. Restart does not retry generation. The operator must inspect it, stop all relevant worker processes and stop/drain/restart the dedicated model backend before explicit provider recovery. A currently live envelope claim blocks provider recovery even from another API/process instance.
- **Explicitly recovered uncertain call:** the existing provider-recovery action can release the held slot after the stop/restart acknowledgment. That action does not authorize a new generation. The worker records the uncertain operation as unresolved/failed with `UNCERTAIN_CALL_NO_RETRY`; a new intentional execution requires a new run and authorization.

The existing recovery endpoint is `POST /api/v1/providers/local/recover`, using the exact `callId`, current `expectedVersion` from `GET /api/v1/providers/local/calls/:id`, and `acknowledgeServerRestart: true`. Acknowledgment is an operational prerequisite, not proof that a remote process is dead. Never clear a slot while its old backend request may still be running. There is no “retry uncertain call” button or automatic paid/alternate-provider fallback.

## Human review and goal evidence

`owner.review` requests human work; it never grants approval. The worker persists `waiting-human`, clears its lease and continues serving other envelopes. The Hub displays the exact resolved output bytes and digest. The owner submits a separate explicit decision, note, reviewed envelope digest and reviewed input digest. Stale/mismatched decisions, expired/revoked grants and automatic approvals are rejected. Review replay is read-only and cannot renew authorization.

Human approval records an immutable decision and queues any further work. The independently running worker performs subsequent operations/finalization; the browser does not take over execution. Rejection fails the operation/run.

Successful or failed recorded operation results can now supply P0.1 `job-result` evidence through a composite envelope/operation/run reference. The criterion must be bound to that exact operation. Machine evidence is labelled `envelope-worker`; owner observations remain `local-owner` attestations. Uncertain calls do not manufacture success evidence. Goal success still requires technical run success and every required acceptance criterion; generating text alone leaves required human review pending.

## Run locally

1. Back up the intended database and run `npm run db:migrate`. Readiness now requires **011_envelope_workers.sql** in addition to migrations 001–010. No unknown working database is migrated automatically.
2. Keep the existing dedicated llama.cpp local-only setup. In the ignored root `.env`, deliberately set `LEEOS_ENVELOPE_WORKER_ENABLED=1`. Text generation also requires `LEEOS_LOCAL_PROVIDER_ENABLED=1` and `LEEOS_LOCAL_PROVIDER_LOCAL_ONLY=1`. The new worker opt-in defaults to `0`; the legacy `LEEOS_JOB_EXECUTION_ENABLED` flag does not start this worker.
3. From a **separate terminal** in the repository root, run `npm run worker:envelopes -- watch`. `npm run worker:envelopes -- once` performs a bounded housekeeping/claim cycle and handles one claimed envelope until it yields, waits, finishes or needs recovery. The CLI talks directly to PostgreSQL and the fixed local provider; it does not need an owner API token or a running Hub request.
4. Accept an envelope through the Hub, or use an existing unexpired accepted envelope. In **Independent worker ownership**, load state to inspect queue status, fence, worker, lease, operation outputs, call IDs and recovery reasons. Refreshing is read-only.
5. Close the Hub if desired. The separate worker continues while its process/host remain available. Reopen and inspect the same envelope/run later. Do not resubmit accepted work for ordinary worker downtime or resource backpressure. Grant expiry still requires fresh authorization; it is never silently extended.
6. Use Ctrl+C to stop that worker. Stopping during a call may leave an uncertain result requiring the explicit procedure above. Environment-file changes require a process restart; durable revocation/cancellation is checked through the database while the worker runs.

No production worker was started automatically during implementation. No cloud provisioning, DOCX, file storage, email, calendar or Bible automation is activated here. New flags contain no secrets and no `NEXT_PUBLIC_*` credentials.

## Owner API and storage

`GET /api/v1/runs/:runId/envelope-work` and `GET /api/v1/execution-envelopes/:id/work` inspect ownership and results. `POST /api/v1/execution-envelopes/:id/review` records an explicit human decision. There is no public HTTP claim, heartbeat, dispatch or worker-result submission endpoint. Accepted-envelope reads retain `apiDispatchEnabled: false` and expose separate worker state; reading a receipt does not grant or execute work.

Back up the new queue, claims, operation ledger and review records with their envelopes, revocations, contracts, runs, provider calls/slot, usage, acceptance evidence and events in one consistent database. Restoring a backup is not permission to clear uncertainty or replay a dispatch. On restart, the worker uses database leases/fences and stored provider facts, not remembered in-process ownership.

The envelope and claim IDs are traceable identities, not bearer credentials. This is a trusted local worker using the existing database trust boundary. Public remote worker authentication and independent cloud deployment remain outside this slice.

## Validation

Final validation passed:

- npm run check exited successfully: lint, root/Hub typechecking, all **194 standard tests**, and the production Hub build.
- All **116 native PostgreSQL tests** passed, including the final ownership/recovery and output-boundary contracts.
- All **3 process-suite tests** passed (two separate-OS-process acceptance scenarios plus their parent test).
- The focused worker suite passed all **14 tests**. It verifies queue backfill from migration 010, clean-close rediscovery, race exclusion, monotonic fences, stale-worker rejection, heartbeat renewal, revocation/cancellation, resource backpressure, conservative uncertainty, transactional rollback, exact output chaining after restart and terminal handling of out-of-scope results.

The first sandboxed build encountered a Windows EPERM while creating Next.js generated output. The final complete check ran with the child-process filesystem permissions required on this host and exited 0. No validation assertion was relaxed for that permission issue.

Separate Node worker-process tests submit accepted work through the owner HTTP client, close that client, and execute through a different OS process. Another test kills a fixture worker after a durably observable generation checkpoint, restarts discovery, and verifies no second generation. Tests use isolated schemas and fixture inference; no live model or external delivery service is contacted. P0.5 is implemented separately and uses the same envelope, queue and worker contracts.

The disposable native PostgreSQL server was stopped after validation, and fixture worker processes were closed or explicitly killed and awaited. No production worker was enabled or started, and no unknown configured working database was migrated. Migration 011 introduced these worker controls; current readiness also requires migrations 012–014. Apply migrations deliberately to the intended database.
