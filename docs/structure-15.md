# Structure 15 — schedules and event follow-ups in the Hub

A trigger is an alarm or a follow-up rule. It puts a new run on your review desk. It does not carry permission to plan, prepare, assign agents or execute work.

## Open the controls

Unlock the existing local owner connection, choose a project and expand **Schedules and event follow-ups**. Choose **Load coordination**. Lists show 25 records per page; the More buttons load older ID pages. Refresh reads the initial pages again; this is not a live subscription.

The panel shows automation definitions and versions, schedules, event rules, coordinator configuration and receipts. A configured coordinator flag does not prove a watcher is running. The Hub never starts a hidden timer.

## Register a trigger

1. Inspect the target automation's definition and version. Existing automation definitions are created through the earlier owner API. Approved English request plans are separate records; this build does not turn them into reusable automations.
2. Choose Once, Fixed interval or Run-outcome follow-up.
3. For time triggers, enter an exact UTC instant such as `2026-10-21T19:00:00.000Z`. Intervals are whole seconds from 60 to 31536000; a week is 604800 seconds. No implicit local-time or DST conversion is made.
4. For events, choose a different source automation in the same project and a supported succeeded/failed/cancelled/interrupted run outcome.
5. Check the acknowledgement and register. The server creates a disabled trigger. An identical registration retry in the same panel reuses its key and can return an existing trigger in its current state. Reloading/locking discards that in-memory key: inspect existing lists before retrying an uncertain registration.
6. Review the saved card, acknowledge its current state and choose Enable trigger. Disabling is separately acknowledged and does not cancel queued runs. Commands use the displayed version; stale commands fail rather than overwrite changes.

Refresh after errors and inspect what saved. Registration, enablement and a poll are different actions. Configuration is immutable: disable a trigger and register a new reviewed one to change its timing or target. Paused/archived targets cannot be enabled; consumed one-time schedules cannot be reused. The server remains authoritative if another caller changes state after your review.

## Check due work

The existing private server flag `LEEOS_COORDINATION_ENABLED=1` enables polling after restart. It ships disabled. It does not enable model calls or job execution.

**Check due triggers once** requires an explicit acknowledgement. It checks enabled triggers across **all projects**, up to 10 occurrences, using the database clock. Only receipts for the selected project appear here. It is not a project-scoped poll or a repeating timer. For ongoing local polling, use the existing Structure 10 watcher; keep the server, database and watcher running.

Inspect receipts for queued, overlap or blocked outcomes, then refresh project run lists. Trigger-created runs carry the reviewed automation snapshot and start queued without jobs or a saved request plan. The current request workflow does not automatically invent a plan for them; use existing planning APIs to supply a reviewed plan before preparing work.

Missed interval occurrences coalesce into one latest due occurrence. Active queued/running/interrupted target work causes an overlap skip. Target revision/pause can block a trigger and disable it. Re-enabling an event rule starts a new activation boundary; earlier events are excluded. These are existing Structure 10 policies, not options silently changed by the Hub.

## Boundaries

No migration, new provider, external service, webhook, cron/DST scheduler or autonomous execution was added. Keys remain in memory and lock/reload clears the panel. Switching projects resets this panel. Lists across endpoints are not one transactional snapshot. The global workbench serializes commands; server versions remain authoritative.

See [validation](validation-structure-15.md) and [Structure 10](structure-10.md) for coordination details. The next proposed structure is reusable automation creation and reviewed planning in the Hub, so triggered runs can be handled there without request-specific assumptions. It waits for Lee.
