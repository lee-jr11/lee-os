# Structure 8 validation — 17 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.4.2, PostgreSQL 17.10. Local CPU model server: llama.cpp b11699 (build b11699-7182ef71e), two CPU threads, one slot. Node 22 remains the CI target and was not executed locally.

## Passed

- All workspaces, manifest and lockfile synchronized to 0.8.0. No new external dependency or cloud SDK. Offline lockfile installation and npm ci dry-run passed; full clean dependency install was not repeated.
- Repository lint and shared/Hub typechecks passed after correcting an initial adapter string-formatting error. Focused final lint covered provider manager, transport, API, CLI and new tests.
- Full default suite: 78 passed, zero failed/skipped. Focused local-provider suite: 11 passed after the final audit changes. Existing project/run/plan/preparation/agent contracts remain covered.
- Native PostgreSQL suite: 43 passed, zero failed/skipped; repeated for final source. Includes durable cross-manager reservation, idempotent replay, actual-token capacity checks, preflight release, uncertain-dispatch hold, explicit recovery, crash residue, start/final audit rollback, usage and provider API pagination.
- Production Next.js build passed; no provider or database connection occurred during the build.
- Native existing database applied only 005_local_provider.sql. Earlier four SQL files remain byte-for-byte equal to the Structure 7 archive. Embedded upgrade and clean-close call/result replay passed.
- Real inference through the production owner API passed (npm run test:provider equivalent): five input tokens, 32 generated tokens, nonempty story text, stored usage/result, identical replay and GET result equality. This was genuine model inference, not a fixture response.
- provider:smoke operator path passed against the authenticated production Hub. Manual diagnostic calls did not start prepared jobs or assigned agents.
- A genuine completion was followed by a deliberate final-audit rejection in the temporary database. The call became interrupted, output/usage finalization rolled back, the slot remained held and a second call was rejected. After actually stopping/restarting the backend, explicit versioned owner recovery released capacity, replay preserved the interrupted call, and a fresh real call succeeded. Validation-only database triggers/functions were removed.
- Existing production owner API/CLI checks passed with local provider metadata enabled: roles, assignments, human-review rejection, versioned dismissal, cancellation, preparation replay, model routing, Host/Origin restrictions, bounded bodies and old Structure 4 snapshots. Earlier preparation receipts also replayed unchanged.
- With PostgreSQL stopped, local readiness and metadata remained readable, while generation and ledger reads returned sanitized 503 before dispatch. With the model server stopped, readiness became unavailable and routing remained blocked without a cloud fallback.
- The regular preview reports Structure 8/version 0.8.0, with job/agent execution disabled and manual generation described as opt-in. Its owner API remains disabled without local setup.
- Browser static bundles contained no matches for owner/database configuration names, local-enable flag names or synthetic account/model markers. Source JSON, archive integrity and actual validation-credential exclusion checked during packaging.

## Runtime and model provenance

Portable runtime archive: llama-b11699-bin-win-cpu-x64.zip, 19,594,023 bytes, SHA-256 4cffd1a580bc42f072a6f01bd34822e09e42368631486160300f1bed3e6d2be0 (matched GitHub release metadata).

Test model: ggml-org/models revision 499bc8821c6b12b4e53c5bffcb21ec206f212d81, tinyllamas/stories15M-q4_0.gguf, 19,077,344 bytes, SHA-256 66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739 (matched publisher LFS metadata).

Downloads were resumed in verified ranges after an interrupted transfer. Both complete files were hash-checked before execution. Files stayed in the workspace's private validation area; no system-wide runtime installation, global environment change, cloud key, account login or billing activation was used. Binaries, weights and validation database data are excluded from the source archive.

## Cleanup and limitations

The temporary authenticated Hub, local model server and PostgreSQL cluster were stopped. The normal preview at http://127.0.0.1:3101/ remains available with provider opt-in unset. To use live generation persistently, follow Structure 8 setup with a trusted local runtime/model and owner API/database configuration.

The small test model proves transport, inference, limits, ledger and recovery; it does not establish assistant quality, instruction-following ability or Bible-lesson suitability. Only text capability is advertised. Readiness and fingerprint checks trust the dedicated local backend and operator's local-only configuration; they are not independent process attestation. Zero cost refers to external API billing, not electricity or existing hardware costs.

The lease covers instances sharing one database and a dedicated backend. Recovery requires an honest owner restart acknowledgement after other callers are stopped. It is not automatic proof of process restart or an exactly-once remote execution guarantee. Prompts are hashed for deduplication rather than encrypted; raw prompts are not persisted by LeeOS, while bounded generated output is stored. Backend logging is outside that ledger policy.

Prepared jobs and agent assignments still have no execution permissions. No worker dispatch, cloud-provider calls, scheduler, agent tools, automatic English decomposition or Bible automation was enabled. CI, remote hosting, device/PWA installation and PostgreSQL backup/restore were not exercised.
