# P1.4 — Generic Calendar Scheduling

P1.4 adds local calendar rules to LeeOS's existing durable coordinator. Manual runs remain on the existing owner request/review path. A scheduled or event trigger can queue only a run for owner review, pinned to the automation definition version selected when the trigger was registered. It creates no job, plan, execution envelope, grant, provider call, or external effect.

## What Lee can schedule

- **Once:** a local date and wall-clock time in an explicit IANA timezone.
- **Daily:** one wall-clock time in an explicit timezone.
- **Weekly:** one ISO weekday (Monday = 1 through Sunday = 7), wall-clock time, and timezone.
- **Manual:** use the existing owner request/review workflow when work should start now.

The previous fixed UTC interval remains available for compatibility. Legacy cron rows remain inert; P1.4 does not add cron, monthly rules, or external event providers.

## Timezone and daylight-saving behavior

The API validates the date, time, weekday, and timezone before saving a rule. Recurrences retain their local wall-clock time as UTC offsets change. A repeated local minute during a daylight-saving fall-back selects the earlier instant. A nonexistent minute during a spring-forward gap moves forward by the size of the gap while preserving its minute position; for example, 02:30 becomes 03:30 across a one-hour gap. The resolved UTC occurrence is calculated by LeeOS, not by the browser.

New calendar occurrences persist both the UTC instant and the intended local timestamp/timezone. Their append-only receipts also record the number of older occurrences coalesced during a late poll. `scheduled_for` remains the unique occurrence key, so concurrent pollers cannot queue the same occurrence twice.

## Late polling and enable/disable

While an enabled recurring schedule is unattended, the coordinator queues at most the latest due occurrence, records the number skipped, and advances to the next future calendar occurrence. This avoids a restart storm. Disabling a daily or weekly schedule pauses it; re-enabling recalculates its next occurrence strictly after the current coordinator clock, so disabled time is not replayed. A one-time schedule is consumed after its receipt is recorded and cannot be re-enabled. Existing fixed intervals retain their prior anchored/coalescing behavior.

If the project or pinned automation version is no longer available, the occurrence receives a durable blocked receipt and the schedule is disabled. Receipt rows and schedule definitions are append-only/immutable; enable, disable, and occurrence advancement only increment the trigger version.

## Safety boundary

An enabled schedule is a trigger, not blanket permission. Each occurrence uses the existing exact-version queue path and creates a run with `executionEnabled=false` and `OWNER_REVIEW_REQUIRED`. Normal review and downstream requirements, capability routing, ZERO_ONLY checks, execution grants, and worker ownership remain separate gates. The coordinator is still explicitly polled; this change does not install a background timer or deploy a hosted scheduler.

## Database and verification

Migration `016_calendar_scheduling.sql` adds local rule fields and occurrence context. The P1.3 migration `015_email_effect_receipts.sql` and P1.4 migration 016 have **not** been applied to an intended external database. Apply migrations 001–016 only after the owner has configured and deliberately selected that database and reviewed its capacity/backup terms; the fixture tests apply them only to disposable PGlite databases.

Local validation covers timezone conversion across daylight-saving gaps and repeats, weekday calculations, daily outage coalescing, skipped-occurrence receipts, re-enable behavior, receipt immutability, disabled-by-default registration, owner-review-only run creation, and the complete migration chain. No hosted scheduler or live database is configured or verified by this milestone.
