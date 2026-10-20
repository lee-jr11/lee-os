# Structure 17 validation

- Full default suite: 132 tests passed, no failures or skips.
- ESLint and root/Hub typechecks passed.
- Offline install dry-run passed using the existing normal npm cache.
- All third-party lock records and eight SQL migrations match Structure 16.
- New pure/endpoint tests cover missing/incomplete/invalid/configured owner states, strict loopback origin validation, exact host/protocol matching, flag semantics, bounded public response fields and no-store behavior. Credential and address values are absent from the diagnostic output.

The setup panel performs only explicit GET requests to the bounded configuration endpoint and existing readiness endpoint. It neither changes configuration nor calls providers. Status flags are not model/worker health or owner authentication evidence. Readiness checks expected migration names; the migration runner supplies checksum enforcement separately.

The first-setup guide uses the repository's existing commands and refuse-overwrite setup scripts. A new-machine Docker install, full first image download, backup restoration and fresh credential generation were not repeated in this structure. The existing configuration script tests remain part of the full suite. User private configuration was not changed. Production/browser evidence follows below.

## Production/browser checks

Production build passed. The exact documented workspace startup command successfully launched the production Hub at a chosen loopback port. In the browser, an explicit setup check reported not-configured database/owner states in the ordinary preview without requiring a key. A temporary configured preview reported native PostgreSQL ready, owner configuration configured and origin matching, while job execution/provider/coordination remained disabled. No owner unlock or model request was needed.

Stopping the disposable database and checking again replaced ready with unavailable while still reporting the setting present/configuration configured. The temporary browser tab/server and database were closed/stopped. No private configuration files were overwritten. The panel was then aligned with existing Hub styling and received targeted lint plus a final production rebuild.

Timeout UI, migration-required UI, wrong-origin browser navigation and fresh-machine Docker setup were not separately simulated in the browser. State classification/origin validation passed automated tests; existing readiness tests cover unavailable/missing configuration. Native full database and live model suites were not rerun for this read-only feature.

Both original preview ports are restored with default-disabled owner access/execution. Archive integrity, JSON parsing, private validation-value scans and client-bundle scans are checked during packaging. No hosted services, external integrations or provider permissions were added.
