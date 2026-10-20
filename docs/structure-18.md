# Structure 18 — local V1 acceptance and handoff

LeeOS has a local control desk for describing bounded work, reviewing it, preparing jobs, explicitly running supported local text work and reviewing the saved results. The foundation is general-purpose; it includes no domain-specific generator.

The acceptance principle is simple: each boundary must remain real. A definition is not a run. A queued run is not a plan. A plan is not job preparation. Assignment is not model permission. A completed model call is not final owner approval. A schedule is not execution authority.

## What local V1 supports

| Area | Supported behavior | Current limit |
| --- | --- | --- |
| Hub | Next.js/TypeScript control desk with owner connection | Local loopback, one owner; no remote account system |
| State | Permanent IDs, migrations, history, versions, checkpoints, receipts and saved results | PostgreSQL must be running; manual backup/recovery procedures |
| Requests | Bounded English interpretation, clarification and edited sequential drafts | Not general language-model planning; supply source text yourself |
| Reusable work | Sequential text definitions with final owner review; run snapshots and separately reviewed immutable plans | Definition revision, advanced graphs and model requirements remain in the owner API |
| Preparation/agents | Reviewed job batches and scoped role assignment | Assignment cannot call a model |
| Execution | Explicit one-job local text permission, bounded output, dependency/version/agent fencing and owner review | Opt-in dedicated local llama.cpp; no tools, cloud fallback or automatic output chaining |
| Triggers | Once/fixed-interval UTC schedules and supported source-run outcome rules | Queue-only; no cron/DST/webhooks; explicit global poll/watcher |
| Recovery | Read saved run/results, reconcile saved calls and inspect retained model slots | No blind retries; operator restart acknowledgement remains separate |
| PWA | Manifest/icons, update guidance and cached static offline help | No offline workspace/queue; native installation and phone behavior not certified |
| Setup | Safe configuration/readiness states and documented local commands | Does not install/start services or expose credentials |

Local text output is capped at 128 tokens and by actual model capacity; prompts are bounded by the existing server's 8192 UTF-8 byte limit. A model fingerprint is not an attestation of weight bytes. The tiny validation model proves the execution path, not useful assistant quality. Local CPU/model operation introduces no paid API charge; this does not imply hardware operation has no resource cost.

## Start using the baseline

Follow [Structure 17](structure-17.md) for first setup and daily operation. Keep ignored private configuration and backups outside source archives. Start the database and matching-port Hub, check readiness, then unlock. Optional model/job/coordination flags remain disabled until explicitly configured by the operator.

For a request, use [Structure 12](structure-12.md). For a reusable sequence, use [Structure 16](structure-16.md). For triggers, use [Structure 15](structure-15.md): refresh run lists, review the triggered run snapshot and save a plan separately. No hidden background loop turns queued work into authorized execution.

Before leaving, keep needed run IDs, inspect saved results and lock the Hub. Closing/reloading or losing a connection does not cancel accepted server work. Use [saved-run recovery](structure-13.md) and [backup/recovery](backup-and-recovery.md). Unknown outcomes and retained provider slots require inspection/operator recovery, not regeneration by guesswork.

## Acceptance checks

The shared automated acceptance flow creates a reusable sequence, queues its run, reviews a plan, prepares/assigns jobs, rejects an unacknowledged execution request, allows exactly one fixture completion, replays without another completion, requires owner review, reconnects to saved results, then handles a schedule occurrence as an unplanned queued run with no jobs/agents. The same contract runs on the embedded engine and native PostgreSQL.

The full suites also cover auth/origin checks, cost eligibility, stale versions, cancellation/dismissal races, audit rollback, uncertain calls, recovery, immutable plans, trigger overlap/coalescing, late event commits, request revisions, setup diagnostics and static-only offline behavior. Fixtures do not prove real inference or browser/device lifecycle; those checks are separately identified in [validation](validation-structure-18.md).

The existing default checks are `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Native tests require a disposable test database. Live inference checks are separate, deliberate local operations with validation data; do not enable them against important work merely to open the Hub.

## Fixes in this pass

Consumed one-time schedules now explain that the occurrence is finished and disable re-enabling in the Hub; the server remains the final authority. Setup checks now abort any outstanding companion read when finishing, including after an error. No migration, dependency, remote access or new execution permission was added.

## What acceptance does not establish

This is a reviewed local baseline, not a security audit, production-hosting certification, high-availability system or general autonomous automation builder. Fresh-machine Docker installation, OS-installed PWA/device behavior and a full operator backup restoration are not certified by unit/native contract tests. Manual CI configuration is present; no hosted CI run is claimed unless separately recorded.

GitHub Actions/n8n/Python/Lee360 execution, cloud models, external webhooks, unrestricted planning, automatic source reading/chaining and phone access remain later work. The original larger vision still needs those separately designed integrations. Version 0.18.0 deliberately records this pre-1.0 implementation rather than implying all that scope is delivered.

The numbered build stops here. Choose later priorities after reviewing the acceptance evidence; no further structure, deployment or paid service starts automatically.

## Later blueprint audit

Patch 0.18.1 found that the full section 1 core idea is only partially implemented. Historical acceptance above covers the narrowed local-text baseline. See [the exact-code section 1 audit](diagnostics/section-01-core-idea.md) for repairs and outstanding architecture.
