# Structure 18 acceptance evidence

Date: 2026-10-18 (Africa/Accra). Scope: the local single-owner V1 baseline, version 0.18.0. This is not certification of the broader future integration vision.

## Completed automated checks

- Offline install dry-run passed against the existing cache. No dependency was added or upgraded.
- ESLint and root/Hub typechecks passed.
- Full default suite: 134 passed, no failures or skips.
- Native PostgreSQL suite: 72 passed, no failures or skips, including the new shared acceptance workflow and late-commit event delivery case. The suite created and removed its generated test schema in a disposable database.
- All eight SQL migrations and third-party lock entries match Structure 17. Only LeeOS workspace/release metadata changed.

The shared acceptance contract exercises reusable definition creation, one queued attempt, immutable reviewed plan, prepare-only jobs, scoped agent assignment, rejection of an unacknowledged execution, exactly one fixture completion, replay without another completion, separate owner review, reconnect/read-only result recovery, and a one-time trigger yielding an unplanned queued run with no jobs/agents. It then cancels that queued run. The same contract passed on embedded and native engines.

These contracts use fixture providers. Existing tests also cover uncertain dispatch/provider recovery, stale state/permissions, cancellation/dismissal fences, transactional audit rollback, checkpoint restoration, request revisions, trigger coalescing/overlap and static-only service-worker behavior. They are not proof of useful model output, a full security audit or native device installation.

## Production, live and browser checks

The final checks passed for the documented local V1 scope. Temporary validation processes/records remain separate from normal private configuration; no hosted checks, paid APIs or external executors are invoked.

- Production build passed, including build-time TypeScript and page generation.
- Real production API/local-model integration passed: one 16-token CPU-model completion, idempotent replay and explicit final owner review. The reused tiny validation model has a capped 128-token context; this is plumbing evidence, not assistant-quality evaluation. No model download, paid API or cloud call was made.
- Browser validation confirmed the consumed one-time schedule explanation and disabled re-enable control. The real-inference run was reopened and recovered read-only; its saved text, succeeded result/provider status, final reviewed run and recorded API spend $0.000000 were visible. No new generation was requested by recovery. Screenshot is alongside the source ZIP.
- The temporary browser connection was locked and closed. Listener checks confirmed that the temporary API (3103), CPU model (18081) and disposable database (54321) were no longer listening. Both original previews (3101/3102) were restored without owner/provider/job/coordination configuration. Unconfigured owner access returns 503.

## Acceptance decision and limits

The 18-structure local V1 baseline passed the checks above. No next structure, hosted run, deployment or external integration was started. The build remains version 0.18.0; the larger unrestricted/remote automation vision remains future work.

This pass did not repeat a new-machine Docker installation, a full operator pg_dump/restore drill, mobile/native PWA installation or every manual browser flow from prior milestones. Prior PWA offline/update browser evidence is recorded in Structure 14; the actual worker contract passed again in the default suite. Node 22 is the manual CI target, not a newly claimed hosted run. Existing private owner configuration was not replaced.

The source ZIP excludes environment files, dependencies, generated builds, local models and database records. JSON parsing, private-value/client-bundle scans and archive integrity are checked during packaging; a SHA-256 checksum accompanies the archive. Source delivery is not a data backup or a security audit.
