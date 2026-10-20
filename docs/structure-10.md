# Structure 10 — scheduling and event coordination

Lee, Structure 9 gave a prepared job permission to do one exact action. Structure 10 decides **when a new run should be put on your desk**.

A schedule is an alarm clock. An event rule is a connection such as “when a run of this automation succeeds, queue a follow-up.” Neither gives the queued run permission to call a model, prepare jobs, assign agents or approve its own review. Those remain the explicit owner workflow from earlier structures.

| Piece | What it does |
| --- | --- |
| Schedule | Stores a one-time UTC alarm or a fixed interval anchored to a UTC instant |
| Event rule | Matches selected run outcomes from one source automation in the same project |
| Coordinator | Checks a bounded batch of due alarms and undelivered matching events |
| Trigger receipt | Records one queued run, overlap skip or blocked outcome for each handled occurrence |
| Local poller | Calls the protected coordinator endpoint once or every five seconds while running |

Everything uses the existing local database and owner API. This structure adds no paid service, cloud execution, remote webhook, model download or GitHub Actions run. The Hub's visual layout is unchanged apart from its milestone text.

## What is supported

- **Once:** one explicit UTC instant.
- **Interval:** every 60 to 31,536,000 seconds, starting at an explicit UTC instant. A weekly interval is 604800 seconds.
- **Run outcomes:** `run.succeeded`, `run.failed`, `run.cancelled` or `run.interrupted`, from a specified source automation.
- **One action:** `queue-run-for-review`. A new run starts `queued`, version 0, with the reviewed automation's definition snapshot and no jobs or agent assignments.

UTC inputs must use millisecond precision, such as `2026-10-21T19:00:00.000Z`, within 2020–2100. Local wall-clock cron expressions and daylight-saving conversions are deferred. An interval is elapsed time, not “the same local hour” across time-zone changes. Old cron rows are retained by the migration but excluded from the managed poller.

## Enable the local coordinator

1. Use the existing private PostgreSQL and owner API setup. Apply migration `007_coordination.sql` with `npm run db:migrate`. Migrations 001–006 are unchanged.
2. Set `LEEOS_COORDINATION_ENABLED=1` in the ignored Hub environment and restart the Hub. Examples ship with `0`. This flag permits coordination polls; it does not enable local inference or job execution.
3. Configure the CLI's existing ignored root `.env` with the matching owner token and local API origin. Never put owner values in `NEXT_PUBLIC_*` or commit private request files.
4. Register a trigger, review its settings and explicitly enable it. New registrations are always disabled.
5. Run `npm run coordinator -- once` to check a batch once, or `npm run coordinator -- watch` in a separate terminal to poll every five seconds. Ctrl+C stops the watcher. It reports activity and stops after three consecutive failed polls. Restart it after fixing configuration or storage.

The Hub does not start a hidden timer. The Hub, database and watcher must be running for timely coordination. Sleeping/offline PCs do not run tasks; restart resumes durable polling. `GET /api/v1/coordinator` reports the server flag and policy, not proof that a watcher is alive. The database clock determines due time. Owner API callers cannot supply a pretend current time.

## A one-time or weekly alarm

First create an automation through the earlier API and read its ID and current definition version. Submit this request to `POST /api/v1/projects/PROJECT_ID/schedules`:

```json
{
  "automationId": "AUTOMATION_ID",
  "expectedAutomationVersion": 1,
  "idempotencyKey": "weekly-review-v1",
  "action": "queue-run-for-review",
  "acknowledgeNoExecution": true,
  "kind": "interval",
  "firstRunAt": "2026-10-21T19:00:00.000Z",
  "intervalSeconds": 604800
}
```

For a one-time alarm, use `"kind": "once"` with `"runAt": "2026-10-21T19:00:00.000Z"`, omitting `firstRunAt` and `intervalSeconds`. Replace example IDs and versions with real values. Registration replay with the same project/key/body returns the same identity in its current state; a changed body conflicts. Schedule and event registration keys have separate namespaces.

Enable the returned schedule with `POST /api/v1/schedules/SCHEDULE_ID/commands`:

```json
{"action":"enable","expectedVersion":0}
```

Use the existing request-file CLI, for example `npm run leeos -- POST /schedules/SCHEDULE_ID/commands --json-file .leeos/enable-schedule.json`. Read the latest version before disabling or re-enabling. Polling advances schedule versions too. Duplicate or stale commands conflict rather than changing the clock silently. Configuration is immutable: disable and register a new reviewed trigger to change the target or timing.

## A follow-up event rule

Submit this to `POST /api/v1/projects/PROJECT_ID/event-subscriptions`:

```json
{
  "automationId": "FOLLOW_UP_AUTOMATION_ID",
  "expectedAutomationVersion": 1,
  "sourceAutomationId": "SOURCE_AUTOMATION_ID",
  "eventKind": "run.succeeded",
  "idempotencyKey": "source-success-follow-up-v1",
  "action": "queue-run-for-review",
  "acknowledgeNoExecution": true
}
```

Enable it through `POST /api/v1/event-subscriptions/SUBSCRIPTION_ID/commands` with the same versioned command body. Source and target must be different automations in the same project. The source filter follows that automation's permanent identity across future versions; the target is bound to the explicitly reviewed version.

Only matching durable events whose `occurred_at` is on or after the latest activation are eligible. Re-enabling starts a new activation boundary: events from before that boundary, including the disabled period, are not replayed. No historical replay or external event publishing endpoint is provided. A late commit is still found if its event time belongs to the current activation period. `run.created` and coordination events cannot match the allowed event kinds, so queuing a follow-up cannot immediately trigger another rule by itself.

## Missed work, overlap and failure

- After a long outage, an interval emits **one latest due occurrence**, records the number of skipped earlier occurrences, and advances to the next future time without shifting its original phase. A past-due one-time alarm is handled once.
- If the target already has a queued, running or interrupted run, the occurrence is consumed with an `overlap` receipt. It does not keep retrying when that run later finishes. This prevents trigger-created piles of unfinished work; manually creating another run remains an explicit owner action.
- Changing the target automation's version, pausing it or archiving it produces a `blocked` receipt and disables the trigger. Review and register a new trigger when appropriate. Draft automations can receive queued runs because queuing grants no execution permission.
- A one-time occurrence is consumed even if blocked or skipped for overlap. It cannot be re-enabled for another attempt; create a newly reviewed schedule.
- Each occurrence commits the queued run, receipt, history and schedule advancement together. If storage/history fails, that occurrence stays eligible. Retrying the poll does not generate another already committed run. A batch may contain earlier committed occurrences if a later occurrence fails; the next poll safely continues.
- Pausing a schedule does not cancel runs already queued. Re-enabling an interval coalesces missed time; re-enabling an event rule uses a fresh activation boundary. Cancelling a queued run still uses the earlier run command.
- Work is bounded to at most 20 handled occurrences per API poll, with capacity reserved for both time and event work. Each rule/schedule row is locked while handled, and target automation locking serializes overlap checks across different triggers. Work skipped because another poller holds a row remains eligible for a later poll.

## Owner API reference

All paths below are under `/api/v1`, with the existing bearer, loopback, Host and Origin protections:

| Route | Purpose |
| --- | --- |
| `GET /coordinator` | Read opt-in and polling policy |
| `POST /coordinator/tick` | Poll using `{}` or `{"limit":10}`; limit is 2–20 |
| `GET/POST /projects/:projectId/schedules` | List or register managed schedules |
| `GET /schedules/:scheduleId` | Read current settings/version |
| `POST /schedules/:scheduleId/commands` | Enable or disable with current version |
| `GET/POST /projects/:projectId/event-subscriptions` | List or register event rules |
| `GET /event-subscriptions/:subscriptionId` | Read current settings/version |
| `POST /event-subscriptions/:subscriptionId/commands` | Enable or disable with current version |
| `GET /projects/:projectId/trigger-receipts` | Read queued/overlap/blocked receipts |

Lists accept `limit` 1–100 and `after`. Schedules/rules use ID cursors; receipts use decimal receipt IDs. Receipt projections include `id`, `projectId`, `scheduleId`, `subscriptionId`, `scheduledFor`, `sourceEventId`, `runId`, `outcome`, `reason` and `createdAt`. These lists are inspection views, not reliable downstream delivery cursors. Triggered work is delivered through durable per-event receipts.

## Why event receipts matter

Database sequence values can be allocated before their transactions commit. An event with a lower sequence can therefore appear after a higher sequence has already been seen. The coordinator does not advance a sequence watermark. It asks which currently eligible events lack a receipt for the rule, so late commits remain discoverable. Row locks and unique receipt constraints protect concurrent delivery.

The implementation uses PostgreSQL's documented [row-locking clauses](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE) for bounded concurrent polling; [sequence semantics](https://www.postgresql.org/docs/17/functions-sequence.html) explain why sequence order alone is unsuitable for delivery tracking. The native database test explicitly delays one transaction's commit to verify this behavior.

See [validation](validation-structure-10.md) for actual checks. Structure 11 will add natural-language request intake and planning. This structure stops at reliable coordination.
