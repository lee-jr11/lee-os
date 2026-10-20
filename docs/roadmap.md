# LeeOS V1 implementation roadmap

**Audit phase complete: Sections 1–25. Verdict: READY TO BUILD V1, not V1 complete.** Version 0.18.1 / Structure 18 remains the reviewed local text-workflow baseline. The [Section 25 canonical readiness report](diagnostics/section-25-final-v1-readiness.md) owns the current scope, acceptance gates, 12-theme architecture register and evidence. It supersedes earlier next-build suggestions; historical audit findings remain intact.

## Working baseline

Local owner Hub/API, PostgreSQL, bounded English clarification, reusable text/review definitions, immutable reviewed plans, prepare-only jobs, scoped assignments, explicit local text grants, persisted results/usage, owner review, inspected recovery and queue-only triggers. Current “V1 acceptance” tests prove this local baseline with fixture inference, not the intended cloud/file/delivery experience.

| Structures | Historical delivered area |

|---|---|

| 1–3 | TypeScript workspace, PostgreSQL state and local owner API |

| 4–7 | Reviewed planning, model eligibility, job preparation and scoped agents |

| 8–11 | Local provider, controlled execution, coordination and request intake |

| 12–13 | Hub workflow and read-only saved-run recovery |

| 14 | PWA installation/update guidance and static offline help |

| 15–16 | Schedule/event controls and reusable reviewed sequence planning |

| 17 | Setup inspection and operation guide |

| 18 | Shared local acceptance contract and handoff documentation |

The API/browser remains loopback-only and has no remote Hub deployment. P0.4 moved envelope execution to an independent worker; P0.5 adds a GitHub Actions worker and one verified-zero Gemini route. P1.1 provides opt-in, bounded PostgreSQL-backed artifact bytes and owner retrieval. P1.2 adds worker-owned Python DOCX generation, independent content/format validation and acceptance evidence tied to the stored artifact. P1.3 adds generic, opt-in Resend delivery with durable effect receipts and signed recipient-delivery confirmation. P1.4 adds generic once/daily/weekly local-calendar schedules with explicit timezone and durable coalesced occurrence receipts. Actual hosted operation still depends on owner-configured shared PostgreSQL, a public GitHub repository, provider credentials and a reachable HTTPS webhook. P0.5, remote DOCX, P1.3 live delivery and P1.4 hosted polling remain unverified.

## Current implementation sequence

The latest implementation sequence selected by Lee is:

P0.1 Requirements + Acceptance Criteria → P0.2 Capability-First Planning/Routing → P0.3 Durable Execution Envelope → P0.4 Worker Claim/Lease/Recovery → P0.5 Remote $0 Execution + AI → P1.1 Artifact/File Service → P1.2 DOCX → P1.3 Email/Effect Confirmation → P1.4 Calendar Scheduling → P1.5 Lifecycle/Memory/Hub Controls → Bible E2E acceptance.

**P0.1 is implemented; validation is recorded in [the implementation guide](p0-1-requirements.md).** It adds reviewed versioned outcome contracts, immutable run bindings and separate evidence-driven goal assessments. P0.2 adds contract-driven capability coverage and inert implementation routing; see [its implementation guide](p0-2-capability-planning.md). P0.3 adds durable exact-input execution envelopes and scoped owner authorization; see [its guide](p0-3-execution-envelope.md). P0.4 adds independent worker ownership, leases/fences and conservative recovery; see [its guide](p0-4-worker-ownership.md). P0.5 adds a GitHub Actions worker, Gemini free-tier adapter, live project billing/key restrictions and honest usage evidence; see [its guide](p0-5-remote-zero-cost.md). P1.1 adds file-type-neutral PostgreSQL byte storage, ownership-scoped metadata, content integrity checks, idempotent writes, retrieval and current-claim worker fencing; see [its guide](p1-1-artifact-storage.md). P1.2 adds the Python DOCX specialist, separate validation and evidence-bound artifact storage; see [its guide](p1-2-docx-generation.md). P1.3 adds generic approved email delivery, durable effect identity/receipts and signed recipient-delivery evidence; see [its guide](p1-3-email-delivery.md). P1.4 adds local-calendar once/daily/weekly rules, timezone-aware occurrence calculation, deterministic DST policy, durable missed-occurrence receipts, and review-only run queueing; see [its guide](p1-4-calendar-scheduling.md). P0.5, remote DOCX, P1.3 live delivery, and P1.4 hosted polling remain unverified because no Git remote, hosted database, provider credentials, HTTPS webhook, or deployed scheduler are configured. The themes below preserve the final audit's priority grouping; use the sequence above for current slice numbering.

## P0 — Critical path to first vertical acceptance

1. **Versioned requirements and acceptance criteria** plus a thin coordinator: capture outcome, inputs/outputs, assumptions, capabilities, constraints and success evidence.

2. Small trusted capability registry and neutral scoped operation/grant contracts, including typed output chaining.

3. Durable accepted execution envelope, independent claims/leases/fences/backpressure, cancellation and uncertain-effect recovery.

4. **Implemented in code, owner setup remains:** one public-repository GitHub Actions worker, shared PostgreSQL connection, and Gemini free-tier text route gated by key/project billing checks. Validate actual hosted operation with Lee360 off before calling it deployed. The Hub still needs intentional HTTPS hosting for off-device use.

5. **P1.1 and P1.2 implemented:** bounded owned byte storage plus replaceable DOCX generation, validation and artifact-bound evidence.

6. **P1.3 implemented locally:** owner-attested verified-zero-cost email, exact recipient scope, durable effect receipts, conservative reconciliation and signed delivery confirmation. Live provider/account validation remains pending.

7. Real manual goal→content→DOCX→artifact→confirmed delivery acceptance with Lee360 off, browser closed and duplicate/recovery tests.

## P1 — Complete intended V1

P1.1–P1.5 are implemented in the local foundation, including versioned lifecycle controls, once/daily/weekly calendar scheduling, owner-reviewed project-scoped SQL memory retrieval, command-center read models, and Hub visibility for attention, runs, goals, triggers, and artifact state. This does not complete deployment acceptance: remote execution, artifact/DOCX/email flows, off-device Hub access, failure recovery, and backup/restore still need live integration verification.

P1 is mandatory for the intended V1 release, even if the first P0 manual slice passes first. Do not call all of V1 complete at that intermediate milestone.

## P2 — Immediately after V1

Scoped cleanup/missing-file recovery, richer notification/rework preferences, controlled replanning/retry UX, memory retention/distillation, stronger backup automation and later file-only deletion/restore/rebuild. Preserve evidence and require explicit destructive scope.

## P3 — Later expansion

Full Blackboard/Project Manager/dynamic teams, broad MCP/tool ecosystem, additional providers/executors, advanced trigger/calendar rules, general generated-code build/test/fix/deploy, full Storage Manager/purge ecosystem, performance learning and multi-user RBAC. None is necessary just to turn audit rows green.

## Acceptance scope and success

The latest Section 25 blueprint selects the **Bible Lesson Generator as a future acceptance scenario**, superseding earlier example-only wording for roadmap purposes. It is a replaceable automation on a reusable platform, not a Bible-specific operating system or an already implemented module.

Required scenario: outcome/topic/theme/verse → reviewed requirements → eligible AI content → actual validated Times New Roman 12 DOCX → durable owned hash-matched artifact → approved confirmed delivery, working through a hosted phone/PC Hub with Lee360 off. Choose email to Lee plus manual WhatsApp forwarding for initial V1; no WhatsApp automation/free-account claim. Email/hosting/model eligibility must be verified before activation.

Success requires required content acceptance, DOCX validation, retrievable durable bytes and confirmed approved delivery. Generated text, a filename, SMTP submission or an unknown-cost option is not final success. Pending confirmation is explicit waiting, not fabricated completion. See the canonical report for exact gates/failure cases.

## Dependency order and next build

Requirements/contracts → durable worker (with parallel free-host/provider feasibility) → secure independent deployment/remote text → artifact/DOCX → email/effect verification → real manual vertical acceptance → lifecycle/recurring schedules → scoped memory/Hub/attention → complete release matrix.

**P1.5 — Lifecycle, Minimum Useful Memory, and Hub Controls is implemented and locally verified:** lint, typecheck, all 220 tests, and the production build passed; the earlier Windows Next.js `EPERM` did not recur. The feature sequence is now closed. Move to integration/deployment mode: select and review the intended database before applying migrations 001–017, configure the public-repository worker and verified-zero provider route, and run remote artifact/DOCX/email checks before the first end-to-end acceptance. Then validate a second, substantially different automation. This roadmap does not publish the repository, provision a database, add secrets, or activate a provider account.

Historical local setup/support remains in [Structure 17](structure-17.md), [Structure 18](structure-18.md) and [backup/recovery](backup-and-recovery.md). No runtime capability is upgraded merely by this documentation.

