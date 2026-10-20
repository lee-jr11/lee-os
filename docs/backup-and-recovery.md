# Backups and recovery

PostgreSQL is live state; Git does not back it up. Artifact files must be backed up separately, alongside a record of their storage locations/hashes. Keep backups private: they can contain project content and memory. `backups/`, `.leeos/`, and `*.dump` are ignored by Git.

For the local Compose setup, create an ignored `backups` folder, then use:

```sh
docker compose exec db pg_dump -U leeos -d leeos -Fc -f /tmp/leeos.dump
docker compose cp db:/tmp/leeos.dump backups/leeos.dump
```

These commands keep the binary dump inside a file rather than sending it through PowerShell text redirection. Copy the dump to a separate trusted storage location. Use your configured database/user names if different from the generated local defaults. Normal `docker compose down` preserves the named database volume; deleting that volume destroys its data.

Prove a backup can restore into a separate empty database before relying on it:

```sh
docker compose exec db createdb -U leeos leeos_restore_check
docker compose cp backups/leeos.dump db:/tmp/leeos.restore.dump
docker compose exec db pg_restore -U leeos -d leeos_restore_check --no-owner --exit-on-error /tmp/leeos.restore.dump
docker compose exec db psql -U leeos -d leeos_restore_check -c "SELECT name FROM schema_migrations ORDER BY name"
docker compose exec db psql -U leeos -d leeos_restore_check -c "SELECT count(*) FROM projects"
docker compose exec db psql -U leeos -d leeos_restore_check -c "SELECT count(*) FROM events"
```

Compare known IDs, run statuses, checkpoint values, row counts, and artifact hashes against your backup record. Only change application connection settings after verifying the restored database. Do not restore over the working database as a test. These backup commands are documented procedures, not a scheduled backup service; check the validation record for what was actually exercised.

For the disposable PGlite demo only, close it and copy the complete `.leeos/demo` directory before reopening. Never copy an open database directory as a substitute for a consistent backup. It is not interchangeable with a PostgreSQL server data directory.

After a worker crash, leave the run’s evidence intact. In a future recovery service, inspect the recorded checkpoint and any outside effect before transitioning running → interrupted → queued. This structure provides the transitions and stale-worker protection; it does not automatically infer which outside steps are safe to retry.

## Structure 9 execution recovery

Back up `job_executions` alongside jobs, provider calls/slots, usage and append-only events. Restore the whole database consistently. A consumed authorization never grants another attempt. After restoring a running call, stop callers and restart the dedicated backend before acknowledging provider recovery. Then reconcile the job using `{}` at its `/reconcile` endpoint. A saved succeeded provider result can be reconciled without generation; revoked or interrupted jobs cannot accept a late result. See [Structure 9](structure-9.md).

## Structure 10 coordination state

Back up managed schedules, `schedule_configs`, `event_subscriptions` and `trigger_receipts` with runs and append-only events as one consistent database. Stop pollers before restore and inspect enabled triggers before restarting them. The Hub does not start a watcher automatically. Restored pending intervals coalesce to one latest due occurrence; already consumed occurrences/events have receipts and are not queued again within that restored history. Restoring an older backup can omit later receipts and runs, so review the backup boundary before enabling polling; no database-only mechanism can prove what happened after a stale backup. The execution safeguards remain separate. See [Structure 10](structure-10.md).

## Structure 11 request history

Back up `intake_requests`, `intake_revisions` and `intake_approvals` with their linked runs, plans and events as one consistent database. The original text and proposal revisions contain the owner's request content. Restoring the whole history preserves digests and approval receipts; matching approval retries return the recorded run rather than creating another one. On an uncertain HTTP result, read the request and use the same approval input to recover the receipt. Cancel a draft through the request command, and cancel already approved work through its run command. See [Structure 11](structure-11.md).


## P0.1 requirements and acceptance evidence

Back up requirements_documents, requirements_revisions, requirements_reviews, run_requirements and acceptance_evidence with their referenced projects/runs/plans/prepared jobs/executions/events as one consistent database. A run keeps its exact reviewed revision after the document is edited; do not restore only the current document header or rewrite old bindings. Evidence corrections are append-only and the current assessment derives from each criterion's latest version plus the technical run state. Missing artifact/delivery verifiers remain pending. Source snapshots and the system manifest are not substitutes for this live data. See [P0.1](p0-1-requirements.md).

## P0.3 durable work and authorization

Include execution_envelopes and execution_envelope_revocations with their linked plans, reviewed contracts, run bindings, runs and events in the same consistent backup/restore. They intentionally contain exact authorized inputs and model pins. Preserve original digests, grant expiries, operation identities and revocations; restoring a backup must not be treated as a renewed grant or a fresh attempt. See [P0.3](p0-3-execution-envelope.md). At P0.3 delivery independent worker state did not yet exist; the P0.4 requirements below now apply.

## P0.4 independent ownership

Back up envelope_work, envelope_claims, envelope_operations and envelope_reviews together with accepted envelopes/revocations, provider_calls/provider_slots, usage, runs, acceptance evidence and events. Claims are historical; never restore an old in-memory lease as current ownership. Unknown dispatched calls require conservative reconciliation, not automatic replay or slot clearing. See [P0.4 recovery rules](p0-4-worker-ownership.md).
