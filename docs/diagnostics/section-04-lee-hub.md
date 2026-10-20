# Section 4 — Lee Hub diagnostic

Audit date: 2026-10-18. Current codebase: 0.18.1 / Structure 18. Inspection and browser observations preceded the repair. The change is a current-milestone presentation correction, not a new structure or remote deployment.

## Overall Hub Verdict

🟡 **PARTIALLY ALIGNED** with the target Hub. The current workbench is an API-based local control surface with real persisted workflows. The target navigation, useful memory, universal activity, managed files and remote phone operation remain incomplete. Missing future screens are not bugs.

## Current Milestone Verdict

**Healthy within the validated reviewed local V1 scope after the presentation repair.** One misleading static readiness claim was found and corrected. Desktop owner-review workflow, refresh recovery and fresh-tab recovery were exercised against a disposable local database. Existing text-generation workflows are covered by fixture-based default/native contracts; no fresh real inference was performed.

## Hub Capability Matrix

Evidence labels: B = this audit's browser observations; H = executed Hub/helper/acceptance contracts; I = executed intake/API/approval tests; P = executed service-worker/manifest tests; S = executed setup/security/error tests; C = executed automation/coordination Hub tests; R = new rendered-Home regression test. All full-suite results are listed below. A green row applies to the stated current capability, not remote deployment or final-system completion.

| Hub Capability | Status | Evidence | Expected Now? | Gap |
|---|---|---|---|---|
| Hub/API separation | 🟢 IMPLEMENTED + VERIFIED | H/I; React imports client helpers, not database/executor/model transport; browser workflow uses API | Yes | Shared UI DTO/builders and local-text-specific grant UX remain extension debt |
| Responsive foundation | 🟡 PARTIAL | CSS media rules at 700/850px; B desktop layout | Yes, foundation | Tablet/phone browser viewport verification not available in this run |
| PWA | 🟡 PARTIAL | P verifies manifest/icons, static-only cache and API exclusion; install/update guidance inspected | Limited PWA support yes | No OS-installed PWA/phone/offline-device lifecycle certification |
| Home | 🟡 PARTIAL | B/R show real workbench entry and honest installed-code label | Local landing/workbench yes | No operational overview of all projects/alerts/resources |
| Natural-language intake | 🟡 PARTIAL | B saved preserved wording; I tests clarification, unsupported compounds and approval fencing | Bounded intake yes | General goals/control-intent resolution absent |
| Automations | 🟡 PARTIAL | C/H verify reusable definitions, reviewed queueing and snapshot/version handling | Current definitions yes | No full pause/restart/archive/delete/AI/files/memory controls |
| Projects | 🟡 PARTIAL | B project creation/reload; H backend-linked lists | Basic projects yes | No dedicated project dashboard or progress lifecycle |
| Project detail | 🟡 PARTIAL | B/H show project-selected requests, plans, jobs, assignment/result state | Work detail yes | No phase/requirements/issues/deployment blackboard view |
| Memory | ⚪ NOT STARTED | No Memory screen or functional useful-memory API found | No | Search/review/distilled knowledge UI |
| Activity | ⚪ NOT STARTED | Backend event history exists; no universal human timeline UI | No | Human-readable activity screen and event presentation |
| Settings | 🟡 PARTIAL | B/S setup snapshot and H explicit operator flags | Read-only setup/operator controls yes | No centralized persisted AI/autonomy/security/preferences UI |
| System status | 🟡 PARTIAL | B setup distinguishes unconfigured state; S tests states; R removes static readiness claim | Current snapshots yes | No general connection/resource health dashboard; no background monitor |
| Cost visibility | 🟡 PARTIAL | B displays backend run spentUsd as Recorded API spend; policy label explicit | Current recorded spend yes | No daily/monthly accounting or arbitrary implementation cost estimates |
| Approvals | 🟡 PARTIAL | B exact draft/plan/review gates; I/H stale digest/version checks | Current review grants yes | No generic risk/deployment/destructive-action approval center |
| Run/job visibility | 🟢 IMPLEMENTED + VERIFIED | B run/job/result status; H failure/cancel/recovery contracts | Supported states yes | Richer queue/wait/retry states are future; lists require refresh |
| Logs | ⚪ NOT STARTED | No dedicated technical-log screen found | No | Backend events and saved plan/result are not a completed logs UX |
| Files/artifacts | ⚪ NOT STARTED | Schema references only; no Hub artifact browser/download handler | No | Managed storage, authorized viewing/download and retention |
| Refresh persistence | 🟢 IMPLEMENTED + VERIFIED | B refresh and separate fresh-tab recovery retained original run/version/result; H read-only recovery tests | Saved state yes | Unsaved input, connection/key and review checkboxes intentionally clear |
| Mobile usability | 🟡 PARTIAL | Responsive source foundation; B desktop only | Direction yes | Real phone/tablet usability and remote access unverified/unimplemented |
| Security boundary | 🟡 PARTIAL | S/H auth, bounded errors, key/redirect rules and static-only caching; built-JS scan below | Current local owner boundary yes | No comprehensive security certification, credential broker or remote auth |

## Current Hub Map

The application has **one main page at `/`**, not six completed navigation screens:

- Landing: local foundation/version, $0 policy, reviewed-job explanation and explicitly planned integrations.
- Local setup disclosure: manually reads `/api/setup` and `/api/ready`; shows configuration, readiness and optional flags without keys. Includes operation guidance; does not run setup commands.
- Locked workbench: owner-key field and local-only connection. Key lives in the OwnerClient instance; unlock requires API/database access.
- Unlocked workspace: project creation/pagination/selection, request and run lists, request interpretation/clarification/editing, exact draft approval, immutable plan review and job preparation.
- Reusable automations disclosure: create a bounded sequential text definition, list/select persisted definitions, inspect version/status and queue a snapshot for separate plan review.
- Schedules/events disclosure: register reviewed disabled once/interval/run-outcome rules, enable/disable them, inspect receipts and explicitly poll due work. It does not run automation business logic.
- Run/job panels: backend state, recorded API spend, preparation, assignment, local-model check, exact local text grant, owner review, saved result inspection/reconciliation and cancel-run control.
- Saved-work disclosure: choose project and inspect a known run ID; reads persisted state/results without automatically retrying actions.
- Installation/connection disclosure: browser network status, service-worker help/update guidance and local-address limitations. Footer links health. `/offline.html` is static help.

There are no fake Memory/Activity/Files pages, and external connections are labelled planned. Public health/setup/readiness endpoints are diagnostics, not additional application navigation screens.

## Working User Journey

Executed in a temporary production Hub at loopback port 3103 against the disposable audit PostgreSQL database, with provider/job/coordination flags disabled:

1. Unlock with a disposable owner credential and create project **Section 4 Hub audit** through the UI.
2. Save **Review the Section 4 audit note**. Original wording remains displayed. This is a supported owner-review-only request, not an AI-generated document.
3. Check exact-draft acknowledgement; approve into one queued run/immutable plan. No job starts.
4. Separately acknowledge the saved plan and prepare its owner-review job card.
5. Check owner-review acknowledgement and approve. Backend records job/run success; the UI shows saved result `succeeded`, run version 2 and recorded API spend 0.000000.
6. Refresh: the workbench locks and the owner field clears. Unlock, select the project and recover the known run ID. Approved request, original run, version 2 and saved result remain.
7. Lock and close the temporary tab, open a new tab, reconnect and recover again. The same saved state/result is returned; no action is repeated.

Run ID: `run_715e39e8-e87f-4b79-b18b-6bf7bd2404dc`. Screenshot evidence is in outputs `LeeOS-Diagnostics-Section-04-result.jpg` and `LeeOS-Diagnostics-Section-04-recovered.jpg`. These are disposable validation records, not a substantive automation or useful-AI-quality demonstration. The generated-text branch is separately exercised through authenticated API/Hub-helper fixture contracts, not claimed as a fresh browser inference test.

## Strong UI Boundaries

`components/workbench.tsx`, `automation-panel.tsx` and `coordination-panel.tsx` collect input and compose OwnerClient requests. No inspected React client imports database pools, process execution or model HTTP transport. The Next route delegates to server composition/core services. Backend validation enforces scopes, dependency/version/digest checks, cost restrictions and state transitions even if client disabled controls are bypassed.

Client-side builders add sequence defaults and display blockers; they are convenience/UX duplication, not the authoritative policy layer. `assignTextAgents` composes assignment requests rather than spawning workers. Saved-run recovery helpers read state; provider-slot recovery remains an explicit backend/operator operation. The owner-key field connects to an existing credential, not a client secrets vault.

## Misleading Capability Claims

**Found and repaired:** Home displayed **Foundation ready / Hub and core are connected** as a static card even while the live setup check reported database and owner access **not-configured**. Although the card did not explicitly claim database readiness, its unqualified ready/connected wording could reasonably be read as a live health result.

It now says **Local foundation / Hub and core API code are included. Check local setup for live readiness.** This distinguishes included code from live service status without adding a new monitor.

Other inspected limitations are disclosed: local-only use, planned external connections, bounded text understanding, separate model permission, no automatic chaining, queue-only schedules, snapshot setup checks and static offline help. The $0 card expresses policy, not a claim that every resource or historical bill is free. A successful text job is not presented here as verified deployment or general technical completion.

## Persistence Findings

Saved project/request/approval/plan/job/review result survived actual refresh and closing/reopening a test tab. Reopening required authentication and project/run selection. Owner keys, unsaved prompts, current view and unsaved review acknowledgements are not persistent; the UI warns Lee to save drafts/keep run IDs. No browser-storage workspace is claimed. Run lists are snapshots and can require Refresh lists after an action; they are not a live progress stream.

Closing a tab does not explicitly cancel accepted work. Connection aborts can stop preflight/in-flight calls, whose durable outcome requires inspection. The UI must not be read as a guarantee that this local server runs after host shutdown.

## Responsive Findings

Browser inspected at **1280 × 720** CSS viewport. Initial document width was 1265px, within that viewport; the reviewed desktop work/recovery controls were visible and usable with normal vertical scrolling. Desktop screenshot inspected after recovery. Source CSS stacks cards at 700px and workspace columns at 850px, wraps actions/identifiers and provides a focus-visible outline.

The supplied browser interface exposed no viewport-resize capability. **Tablet and phone viewports were not tested.** Narrow-width long definition JSON, nested forms, tap targets and installed-device behavior therefore remain unverified. No mobile usability certification is claimed from CSS inspection alone. Loopback-only OwnerClient/auth also means the current Hub cannot be accessed from a phone by using the PC's localhost address.

## Accessibility Baseline

Browser accessibility trees exposed named text fields, checkboxes, buttons, headings and native disclosure controls. Approval buttons remained disabled until acknowledgement. State is shown as text, not only color; error/busy/notice elements use alert/status roles; focus-visible styling exists. One basic keyboard focus check is recorded with final validation. No full screen-reader, contrast, keyboard-journey or WCAG conformance audit is claimed.

## Security Findings

Source/test inspection confirms server-side private environment access is in server composition/readiness/setup code. Client setup receives bounded states, not raw environment values; the owner field is password type with autocomplete off. OwnerClient uses an Authorization header, same-local-origin checks, no-store, omitted ambient credentials and redirect rejection. Auth/origin, stale approval, permissions, bounded error and no-mutation-retry tests were rerun.

The service worker caches only static offline help; tests reject interception/caching of API replies/mutations and do not create an offline work queue. No browser localStorage/sessionStorage use was found in the inspected Hub source. Model/job permissions are scoped and backend-enforced.

Current built browser JS was scanned for known private diagnostic credential/connection values and the disposable audit key; final counts appear below. That is a limited known-value scan, not a complete historical secret scan or proof that a user cannot paste sensitive content into a prompt or arbitrary definition. Artifact/download authorization is future work, not an existing unsafe public file handler.

## Current Regressions

One current UX defect was found: static readiness wording. Repaired as above. No remaining current-stage regression was demonstrated by the executed checks. Missing future screens/PWA-device verification are not counted as bugs.

## Repairs Made

- Problem: static ready/connected copy could misrepresent live readiness. It belongs to the current Home/status milestone and Section 4 explicitly requires honest capability presentation.
- Small fix: change only the foundation card title/explanation in `apps/hub/app/page.tsx`; retain the existing manual setup check as the authority for live readiness.
- Regression coverage: `tests/hub-presentation.test.ts` renders Home with owner/database settings absent and checks that it describes included code, directs readiness checking and avoids the prior ready/connected claim.
- The standalone JSX test harness needed React setup and type-safe cleanup; initial test/typecheck failures were corrected in that harness. No production React workaround or future Hub feature was added.

## Validation Evidence

Before repair: **138 default tests passed**. The new rendering test passed after its harness correction. Native PostgreSQL contracts after the presentation repair: **73 passed, 0 failed, 0 skipped**, using an isolated generated test schema. Native fixture stopped after browser/native checks.

Browser checks: unconfigured normal-preview status; exact-draft/plan/review acknowledgements; supported owner-review result; refresh lock/recovery; fresh-tab recovery; desktop layout and semantic controls. No real model calls or paid services were used. No phone/tablet/native-installed PWA/offline-device or real-generation browser result is claimed.

Final results:

- `npm run check`: lint and root/Hub typechecking passed; **139 default tests passed, 0 failed, 0 skipped**, including the new rendering regression. Its build stage encountered sandbox EPERM creating a generated Next.js chunk directory.
- Standalone `npm run build` retried with the required filesystem permission: **passed, exit 0**, including compilation, Next TypeScript validation, static generation and route output. The aggregate command itself is not claimed to have exited successfully; its blocked build stage was validated separately.
- The first aggregate attempt also caught the new test harness's cleanup typing issue; fixed before the final lint/typecheck/139-test results. No remaining validation failure is being hidden as a pass.
- Rebuilt browser JavaScript known-private-value scan: **25 files checked, passed**. Script/result: workspace `work/scan_hub_bundle.py` and `work/section04-bundle-scan.json`. No private values are reproduced in this report.
- Current static dependency scan: **56 TypeScript sources, 121 local edges, no detected runtime cycles, package-to-presentation imports or client paths to database/provider/executor/server-composition implementations**. This is limited static analysis, not comprehensive security certification.
- Rebuilt preview browser check: **Local foundation** copy visible; manual setup reports **not-configured** database/owner and disabled optional flags without contradicting the card. Repaired screenshot: outputs `LeeOS-Diagnostics-Section-04-preview.jpg`.
- Basic keyboard check: Tab from a nonempty owner-key field focused **Unlock Hub** with a solid focus outline; test text was cleared without submitting it. This is one focus-path check, not complete keyboard accessibility verification.
- Both existing previews were restored on loopback ports 3101/3102. The original user tab was refreshed to the repaired page. Temporary port 3103 and audit PostgreSQL were stopped; no optional provider/job/coordination execution was enabled in the normal preview.

## Future Hub Gaps

Dedicated target navigation, richer Home/project dashboards, useful memory, human Activity timeline, technical logs, managed files, centralized settings, universal approvals, richer lifecycle/resource state, mobile/device verification and securely hosted remote phone access. These are future capability gaps, not evidence that the reviewed local milestone is broken.

## Recommended Next Step

Continue the next supplied blueprint section. A later Hub phase can introduce navigation and shared view contracts around verified backend capabilities, then conduct phone/tablet/accessibility testing. Do not add placeholder screens or enable remote/paid execution just to improve this audit score.
