# LeeOS — V1 implementation baseline

Version **0.18.1**, Structure **18**. LeeOS is a single-owner automation system with a Next.js/TypeScript Hub, PostgreSQL state and explicit review boundaries. It supports bounded English requests, reusable text sequences, reviewed run plans, queue-only triggers, opt-in local text jobs and one opt-in remote worker/model route. The Hub is not yet deployed as a remote phone service.

**Blueprint audits 1–25 complete: ready to build the intended V1, not V1 complete.** P0.1–P0.5 provide versioned goal contracts, capability-first routing, accepted execution envelopes, independent worker ownership and one guarded remote path. P1.1 provides opt-in, project-scoped PostgreSQL artifact storage; P1.2 adds worker-owned DOCX generation, independent format/content validation and artifact-bound acceptance evidence. A live hosted run still requires a public GitHub repository, a reachable shared PostgreSQL database and owner-configured Google/GitHub secrets. Confirmed delivery remains future work. See the [canonical readiness/acceptance report](docs/diagnostics/section-25-final-v1-readiness.md) and [implementation roadmap](docs/roadmap.md).

Start with [local setup and daily operation](docs/structure-17.md). Read [the local V1 guide and support matrix](docs/structure-18.md), [acceptance evidence](docs/validation-structure-18.md) and [backup/recovery](docs/backup-and-recovery.md) before relying on saved work.

**P1.5 — Lifecycle, Minimum Useful Memory & Hub Controls is implemented and locally verified.** Versioned pause/resume/archive commands, trigger-aware lifecycle behavior, reviewed owner/project/automation memories with tag-targeted authorized retrieval, and a backend-derived command center are covered by **220 passing tests**, lint, typecheck, and a successful production Hub build. Migration 017 is fixture-tested but has not been applied to the intended database. Next is integration/deployment verification: configure the shared database and public-repository worker, then exercise remote artifact/DOCX/email paths. See the [P1.5 guide](docs/p1-5-lifecycle-memory-hub.md), [P1.2 DOCX guide](docs/p1-2-docx-generation.md), and [P1.1 storage guide](docs/p1-1-artifact-storage.md). No hosted service or paid provider is activated by these code changes.

## Understand the workflow

A project groups work. A request captures your words. An automation holds a reusable definition. A run snapshots one attempt. Its immutable plan is reviewed before job preparation. Scoped agents, exact local model-call permission and final owner review are separate steps. A trigger only queues a run; it grants none of those permissions.

Use the [Hub workflow](docs/structure-12.md), [saved-run recovery](docs/structure-13.md), [offline/update guide](docs/structure-14.md), [schedule/event controls](docs/structure-15.md) and [reusable automation planning](docs/structure-16.md). The numbered guides describe their historical milestones; Structure 18 is the current scope reference.

## Validate locally

```sh

npm ci

npm run lint

npm run typecheck

npm test

npm run build

```

The default tests use an embedded PostgreSQL engine and fixture providers; they require no paid account or model download. `npm run test:postgres` needs a dedicated local test database via the private `LEEOS_TEST_DATABASE_URL`; it creates and removes its own generated test schema. `npm run test:hub-live` is a separate intentional local-inference check and requires the documented private production API/database/model setup. It creates validation records and makes a real local model call. Do not point validation at important working data.

The CI workflow remains manual-only. The separate remote worker workflow is opt-in through default-branch-restricted GitHub environment secrets, and runs only for public repositories. No remote hosted run was initiated during this implementation.

## Repository map

| Area | Purpose |

| --- | --- |

| `apps/hub` | Local control desk, owner API adapter, PWA help and setup inspection |

| `packages/core` | State commands, planning, routing, controlled jobs, coordination and artifact storage/retrieval |

| `packages/database` | PostgreSQL state store, durable artifact bytes, seventeen migrations and readiness |

| `packages/providers` | Provider contracts, bounded local llama.cpp and guarded Gemini adapters |

| `packages/executors` | Executor contracts/metadata; external launch remains inactive |

| `packages/agents` | Agent definitions and scope contracts |

| `packages/automations` | Reusable automation contracts, with no domain-specific generator |

| `packages/ui` | Shared display components |

| `schemas`, `tests`, `docs`, `workflows` | Contracts, validation, guides and portable workflow boundaries |

`leeos.manifest.json` is the root system manifest. Execution is disabled by default. Private environment files, saved databases, models and dependencies are excluded from source archives. Source ZIPs are not data backups.

The ZERO_ONLY policy fails closed on unknown or paid operation costs. Only the documented Gemini free-tier path and public-repository standard runner are implemented; other cloud models/executors, remote Hub hosting, remote webhooks, automatic source-file reading, autonomous agent loops, document generation and delivery remain inactive. Gemini’s unpaid tier may use submitted prompts to improve Google products, as explained in the Hub and P0.5 guide. No domain-specific generator is implemented. The latest Section 25 blueprint selects a Bible lesson as a future reusable acceptance scenario; see the [current roadmap](docs/roadmap.md) for scope.

