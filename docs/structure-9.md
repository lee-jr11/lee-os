# Structure 9 — controlled job execution

Lee, a plan describes the work, preparation creates its job cards, and an assignment names the role responsible for a card. Structure 9 adds permission to perform **one exact action** on that card. It also checks what happened before marking the card finished.

For example, a draft job can generate local text. A checking job must wait for the draft to succeed. An owner-review job stays pending until you explicitly approve it. Finishing both model jobs does not approve the review for you.

| Piece | Responsibility |
| --- | --- |
| Job worker | Checks owner approval, plan digest, run version, dependencies and assigned agent |
| Execution authorization | Stores one job-scoped permission and a request hash; never stores the raw prompt |
| Local provider | Reserves the dedicated model slot, checks capacity and records the bounded result |
| Reconciliation | Applies an already recorded result once, without generating again |
| Owner review | Completes a review card only after its dependencies succeed |

The assignment's old receipt still says `assignment-only`, with empty permissions. It remains historical evidence. Its agent status stays `planned` while available and becomes `dismissed` when revoked or the run ends. Actual activity is tracked in the job and its separate execution record. This is a scoped executor using an assigned role, not an autonomous reasoning/tool loop. All agent assignments must be made while the run is queued, before its first execution.

## Enable deliberately

Keep the PostgreSQL, owner API and dedicated llama.cpp setup from Structure 8. Apply migrations with `npm run db:migrate`. Migration `006_job_execution.sql` adds execution records; migrations 001–005 are unchanged.

Add the following to the ignored Hub environment and restart it when you intend to allow model jobs:

```dotenv
LEEOS_LOCAL_PROVIDER_ENABLED=1
LEEOS_LOCAL_PROVIDER_LOCAL_ONLY=1
LEEOS_JOB_EXECUTION_ENABLED=1
```

The examples ship with execution disabled. No account, cloud key, remote endpoint or paid fallback is introduced. The existing local-process trust and electricity/hardware limitations described in Structure 8 still apply. No binaries or model weights are included in the source archive.

## Owner workflow

1. Create a project and run, save an explicit step plan, inspect it and prepare its jobs using the earlier API.
2. Register compatible roles and assign every model job while the run is still queued. A human review step requires no agent.
3. Read `GET /api/v1/providers/local`. Review its model fingerprint and the exact prompt/output limit you want to authorize. The fingerprint identifies reported model path and server build, not a cryptographic weight hash.
4. Read the current run version. Submit the following request to `POST /api/v1/runs/RUN_ID/jobs/JOB_ID/execute` for a prepared **model** job. Replace each example identifier/digest with the actual reviewed value:

```json
{
  "expectedRunVersion": 0,
  "reviewedPlanDigest": "64_LOWERCASE_HEX_FROM_EXECUTION_INSPECTION",
  "acknowledgeExecution": true,
  "permission": "local:text",
  "agentId": "ASSIGNED_AGENT_ID",
  "expectedAgentVersion": 0,
  "modelFingerprint": "64_LOWERCASE_HEX_FROM_LOCAL_STATUS",
  "prompt": "Once upon a time",
  "maxOutputTokens": 32
}
```

Use the existing CLI with a private request file: `npm run leeos -- POST /runs/RUN_ID/jobs/JOB_ID/execute --json-file REQUEST_FILE`. Keep private prompts/request files under ignored `.leeos/`, not tracked source. The CLI allows 45 seconds for the provider's 30-second bound and storage work.

The prompt is at most 8192 UTF-8 bytes; output is capped at 128 tokens and by actual local capacity. The worker checks any plan capability/provider allowlist and does not widen its planned output-token limit. Actual tokenization determines context eligibility. The owner supplies each exact prompt; earlier outputs are not automatically inserted into subsequent prompts.

The first authorized job changes the run from `queued` to `running` and increments its version. Read the run again before the next job. Assignment creation and generic start commands cannot launch prepared work. Workflow, Python, device and arbitrary step kinds cannot use this text worker.

5. Read `GET /api/v1/runs/RUN_ID/jobs/JOB_ID/result` for the current execution. A terminal response uses HTTP 200 with `data.status`; check it rather than treating HTTP success as generation success. Status is `running`, `succeeded`, `failed` or `discarded`. Only an accepted succeeded execution exposes its text here. The underlying owner-only provider ledger still preserves any returned text and usage.
6. After a review step's dependencies succeed, approve it through `POST /api/v1/runs/RUN_ID/jobs/REVIEW_JOB_ID/review`:

```json
{
  "expectedRunVersion": 1,
  "reviewedPlanDigest": "64_LOWERCASE_HEX_FROM_EXECUTION_INSPECTION",
  "acknowledgeExecution": true,
  "permission": "owner:review",
  "approve": true
}
```

This is an explicit owner action with no inference and works with local inference disabled. To reject work, cancel the run using the existing versioned owner command. A run succeeds only when every prepared job has succeeded. Ending a run dismisses its scoped agents.

## Boundaries and recovery

- Authorization, run/job start, provider reservation and their history commit in one transaction before model work. No database transaction stays open during network inference. Lock order is provider slot, then run; reconciliation needs only the run lock and reads the saved provider call.
- The worker rechecks the run, job attempt/checkpoint, assignment and exact observed fingerprint immediately before dispatch. Cancellation after that check may allow an already accepted call to finish; cancellation does not promise to stop the model process. Its late result cannot complete the cancelled job. Dismissal likewise revokes result acceptance.
- Success records a checkpoint containing the provider call reference and links zero-dollar usage to the run and assigned agent. It does not write files, execute generated code or invoke tools.
- A job has one authorization and one attempt. An identical request resolves/replays that execution; a changed request conflicts. Concurrent submissions cannot create a second inference. Even preflight failure consumes the authorization. Create a newly reviewed run for another attempt.
- If the provider saved a result but job finalization failed, submit `{}` to `POST /api/v1/runs/RUN_ID/jobs/JOB_ID/reconcile`. This performs no inference and works with execution disabled. Terminal replays do not reopen jobs.
- If the provider call is still `running` after a process crash, do not blindly resubmit. Stop all callers, restart the dedicated backend, use the existing versioned provider recovery acknowledgement, then reconcile the job. An uncertain/interrupted call fails the job without retrying and continues to hold provider capacity until recovery. A failed run cancels its other unfinished jobs.
- Existing interruption/requeue commands preserve historical evidence, but never grant a second execution to a consumed job. Cancel that run and create a new reviewed run when another attempt is needed.
- If a result arrives after an interruption/cancellation or an agent dismissal, reconciliation records `discarded` and leaves the owner state authoritative. A dismissed agent on an otherwise running job makes that job/run fail and closes remaining work.

## Validation and next structure

Run `npm run check` for lint, type checks, tests and production build. `npm run test:postgres` additionally needs the dedicated PostgreSQL test URL. `npm run test:worker-live` needs a migrated dedicated local database, the opted-in production owner API and a running local model; it creates validation records, performs two real inferences and explicitly approves a review step. It fails rather than silently skipping if services are missing. CPU model quality is a separate concern from execution correctness.

See [validation evidence](validation-structure-9.md). Structure 10 will add scheduling and event-driven coordination around these boundaries. Nothing schedules itself in this structure.
