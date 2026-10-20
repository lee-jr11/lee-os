# Structure 17 — local setup and everyday operation

The Hub is the desk, PostgreSQL is the filing cabinet, and optional model/coordinator services are separate machines. Opening the desk does not start the other machines or grant them permission to work.

## Check before changing anything

Open **Local setup and everyday operation**, then **Check local setup**. The check reads safe configuration states and the existing database-readiness endpoint. It starts no service, edits no environment file, submits no job and makes no model call. It uses no owner key and stores no credentials in browser storage.

- Database **ready** means the existing readiness check found the expected migration names; it does not prove backup health or independently verify every migration checksum.
- **not-configured** means the Hub process has no database URL. **unavailable** means it cannot establish readiness. **migration-required** means expected migration records are missing or different. Run the existing migration command to inspect/apply migrations; do not reset a database to solve this.
- Owner **configured** means the server has a correctly shaped token and valid loopback origin, not that a browser key was authenticated. **incomplete** or **invalid** needs private configuration review. The panel never displays the token, database connection string or configured address.
- A mismatched origin means the current host/protocol/port differs from the private owner setup. `localhost` and `127.0.0.1` remain distinct owner origins. Open the exact configured address; do not weaken origin checks.
- Provider/job/coordination states report operator flags only. They do not prove a model is ready, a watcher is running or a job has permission. Their separate existing controls remain authoritative.

Status is shown only after an explicit check, with its local check time. It is not a monitor. After a failed check, an older report is labelled potentially out of date. Restart the Hub after changing private server settings and check again. Public `/api/setup` exposes only the bounded states; `/api/ready` checks the database. Both use no-store responses. No new public write endpoint exists.

## First setup on a fresh checkout

These are manual commands from the repository folder. They are not run by the Hub. Use the declared Node range (22–24); Node 22 is the CI target. PostgreSQL setup below uses the existing Docker Compose file. If you already have a database or environment files, skip the credential-generation commands and preserve that installation.

```sh
npm ci
npm run db:configure
npm run api:configure -- --origin http://127.0.0.1:3102
docker compose up -d db
npm run db:migrate
npm run db:status
npm run build
npm run start -w @leeos/hub -- --port 3102
```

`db:configure` creates ignored root `.env` and `apps/hub/.env.local` with a random database password. It refuses existing files. `api:configure` appends a matching owner key and loopback origin without printing it, and refuses existing owner values. Keep these private. The Hub loads its own environment file; database/operator scripts use the root one. If using an existing PostgreSQL installation, supply the matching private database URL to both files yourself instead of generating replacement credentials.

Docker/Node/PostgreSQL installation and the first image/dependency download are prerequisites, not automated here. No cloud account is required. Do not paste credentials into source, the system manifest, `NEXT_PUBLIC_*`, screenshots or support messages. Open your private environment file locally when you need the existing owner key; enter it only into the local Hub's owner-unlock field. The setup panel does not ask for it.

Open `http://127.0.0.1:3102`, check setup, then unlock the workbench. Using another port requires configuring that exact origin and passing that same port when starting. PWA offline help requires a production build; a shortcut does not keep the server running. See [Structure 14](structure-14.md).

## Start an established installation each day

1. Start the existing database service. With this repository's Compose setup: `docker compose up -d db`.
2. Run `npm run db:status`. After an upgrade, take a backup and apply `npm run db:migrate` before expecting readiness.
3. Start the existing Hub build with the matching port: `npm run start -w @leeos/hub -- --port 3102`. Build again after source changes; production start does not rebuild.
4. Open the configured address, check setup and unlock. Reopen projects/runs and inspect saved work before repeating interrupted actions.
5. Start optional services only when intended. The local model requires Structure 8 setup and opt-in flags; job execution requires its separate opt-in and exact job approval. The Structure 10 coordinator watcher must be running for ongoing polls; the Hub's one-time check does not start it.

Keep the terminals/services running while they are needed. PC sleep, process shutdown or closing a server terminal can make services unavailable. A browser online indicator does not establish local server readiness. Costs remain ZERO_ONLY; no provider is enabled by this guide.

## Finish the day

Keep needed run IDs and save any drafts you want retained. Inspect results and lock the Hub. Locking clears browser waiting/credentials; it does not cancel work accepted by the server. Cancel unfinished work explicitly if that is your intention, and inspect the outcome. Then stop optional pollers/callers deliberately, stop the Hub terminal, and stop the database only when no callers need it. With Compose, `docker compose stop db` preserves the database volume. Do not delete volumes as routine shutdown.

Stopping during an in-flight model call can leave an uncertain call or retained model slot. Never assume stopping or restarting makes it safe to regenerate. Follow [Structure 8](structure-8.md), inspect saved results and use the existing versioned operator recovery acknowledgement where required. Saved-run recovery is in [Structure 13](structure-13.md).

## Upgrade and recovery

Before upgrades, back up both the database and private configuration using the existing [backup/recovery guide](backup-and-recovery.md). Source ZIPs intentionally exclude private configuration and saved database records: they are not data backups. Test restoration before relying on a backup.

Stop callers before replacing a build or applying operational changes. Keep a recoverable previous source version and compatible database backup. Migrations are additive and checksum guarded by the migration runner; rolling back source does not automatically roll back a database. If migration or readiness fails, inspect the failure rather than deleting state or inventing a replacement database.

Common checks: **Hub unreachable** → start/check its terminal and exact port; **database unavailable** → inspect its service and private settings; **owner rejected** → correct existing key and exact origin; **stale state** → refresh before a new review; **provider busy/recovery required** → inspect saved call and follow operator recovery, not blind retry.

This structure installs no software, rotates no credentials, changes no existing configuration, and enables no provider or execution. See [validation](validation-structure-17.md). Structure 18 remains the proposed final V1 acceptance, fixes and documentation pass; later external integrations and remote phone access are separate phases.
