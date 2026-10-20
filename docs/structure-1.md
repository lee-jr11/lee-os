# Structure 1: a guided tour

Start at `apps/hub/app/page.tsx`. The Hub asks `@leeos/core` for status and displays it with `@leeos/ui`. `/api/health` exposes that same status as JSON. The core reads the root manifest. This proves the workspace pieces connect without a separate server or cloud bill.

A workspace is a named package in the same repository. Imports such as `@leeos/core` point to local source, not a deployed service. Next.js compiles these TypeScript packages. They are intentionally private and are not independently distributable yet.

Core has reserved spaces for orchestration, routing, events, scheduling, execution management, and agent management. Their README files explain their future roles; they contain no pretend implementations. Provider/executor interfaces are deliberately minimal and must grow alongside actual integrations.

## Cost and secrets

Running the foundation locally makes no model/provider requests. The core rejects unverified or nonzero operation costs. Future execution paths must call this guard before work; the current guard alone cannot enforce a future provider’s billing. Free-tier quotas can change. Do not enable hosting, model calls, GitHub Actions, n8n hosting, or other services until their costs and limits are verified. Lee360 and Python remain future executor boundaries.

`.env.example` files contain safe documentation/defaults only. Copy the Hub example to `apps/hub/.env.local` if desired. Next loads environment files from the Hub folder, not the repository root. Git ignores real environment files and key files. Never expose secrets through `NEXT_PUBLIC_*`, browser code, the manifest, screenshots, logs, or committed workflow files. Future providers must read credentials only on the server; GitHub jobs must use repository secrets. If a secret is committed, revoke it immediately; deleting the file is insufficient.

## PWA foundation

The Hub provides an installation manifest, PNG icons, and a production service worker with a static offline message. It does not queue offline work or cache API responses. Installation requires a compatible browser and HTTPS (localhost is allowed); mobile browser behavior varies. Run a production build to try the worker. Device installation/offline lifecycle still needs browser testing. See the [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

## Validation

`npm run lint` catches suspicious source patterns. `npm run typecheck` checks package boundaries and Hub types. `npm test` verifies the zero-cost boundary and health contract. `npm run build` produces the production Hub. CI contains these same checks and is manual-only to avoid automatic hosted usage. The build uses system fonts and needs no font download or external account.

## Structure 2 — Database & State Layer (now built)

This page records the original foundation. Structure 2 now adds PostgreSQL state, stable IDs, migrations, and local development configuration. Read `structure-2.md` for the current implementation. The earlier Bible lesson example illustrates an automation; it is not a committed LeeOS module.

## Dependency resolution note

The root overrides pin nanoid 3.3.11 and es-abstract 1.24.0 because this build environment advertised versions that could not be installed consistently. Review and remove these overrides after checking registry availability and rerunning all checks during a dependency update. The lockfile records the full tested resolution.
