# P1.5 — Lifecycle, Minimum Useful Memory, and Hub Controls

P1.5 completes the last broad V1 control slice. It adds owner-controlled pause, resume, and archive transitions; small structured memory with tag-targeted retrieval; and a project command center based on saved backend state.

## Lifecycle behavior

Project and automation lifecycle commands use a separate monotonic `lifecycle_version`; editing an automation definition keeps its own `definition_version`. Commands require the expected lifecycle version, so a stale Hub cannot silently overwrite a newer choice.

- **Pause** prevents new work and holds scheduler/event polling. Existing run records and worker ownership remain intact. Due calendar occurrences are left pending and coalesce when polling resumes.
- **Resume** returns the record to `active`. Event rules receive a new activation boundary so events from the paused interval are not replayed; calendar schedules retain their durable next occurrence.
- **Archive** is terminal for new work. Project archive disables its schedules and event rules; automation archive disables triggers that use that automation as either source or target.

Run creation, request intake, requirements creation and trigger registration use the shared project availability gate. New Hub request and automation controls are also disabled for paused, completed, or archived projects. Backend checks remain authoritative.

## Memory contract

Memory kinds are `user-preference`, `automation-knowledge`, `project-decision`, and `engineering-lesson`. Each saved item has a short summary, structured JSON content, tags, an explicit owner review, and one of three scopes:

- `owner`: reusable owner preference, independent of a project;
- `project`: visible only in its project;
- `automation`: visible only in the selected automation within its project.

Retrieval is deterministic and requires one or more tags. It returns at most five matching, owner-reviewed memories authorized for the requested project and optional automation. It is not semantic search and does not inject results into plans or model prompts.

Migration `017_lifecycle_memory.sql` adds composite project/artifact and project/automation scope constraints for new or updated rows. Existing memory rows are preserved but start with retrieval disabled. The retrieval query also requires any cited artifact to belong to the same project and have matching stored bytes, so a legacy cross-project reference remains excluded even if its metadata is still present. No legacy scope is guessed during migration.

## Command center

`GET /projects/{id}/command-center` returns a bounded read model containing project and automation lifecycle state, recent runs and their goal assessments, schedules and event rules, trigger receipts, artifact availability, completed runs, and an attention list. Queued work, failures, interruptions, pending approvals, blocked/overlapping triggers, and successful runs with pending goal evidence are shown as backend-derived states.

The Hub exposes versioned lifecycle controls and tagged memory entry/retrieval. Memory remains separate from logs, events, artifacts, and current state. The read model lists artifact metadata and whether owned bytes are present; the existing artifact API still governs content access.

## Migration and operational status

Migration 017 is included in the source and fixture tests. It has **not** been applied to the intended external database. Apply it only after deliberately selecting that database and reviewing its storage/back-up allowance; do not run the migration against an unconfigured or important database.

P1.5 completes feature implementation for the current V1 path. **Local verification passed:** lint, typecheck, all 220 tests, and the production Hub build. The previously observed Windows Next.js `EPERM` did not recur in the final build. The next phase is integration/deployment verification: apply reviewed migrations to the selected database, configure the public-repository worker and verified-zero provider route, then exercise remote artifact, DOCX, and email paths before the first end-to-end acceptance. After that, test a second, substantially different automation. No new feature slice is started automatically by this guide.
