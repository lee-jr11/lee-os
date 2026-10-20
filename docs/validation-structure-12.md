# Structure 12 validation

Scope was corrected to a general-purpose Hub workflow. The Bible lesson example is illustrative and was removed from the active manifest roadmap. Current guides and the dedicated roadmap describe domain-agnostic work; historical ZIP archives remain unchanged.

Validated on Windows with Node 24.14.1, npm 11.11.0 and native PostgreSQL 17. Node 22 remains the CI target and was not locally exercised. No new dependencies or database migrations were added.

## Completed automated checks

- Offline lockfile refresh and clean-install dry run passed against the installed workspace.
- ESLint, root TypeScript and Hub type generation/typecheck passed.
- Full default suite: **119 tests passed**.
- Native PostgreSQL contract: **71 tests passed**.
- All eight database migrations match the Structure 11 archive byte for byte.

New client tests verify literal-loopback origin restriction, bearer-only transmission, absence of keys from URLs/bodies/serialization, omitted browser credentials, no-store fetches, redirect rejection, connection closing, pending-request abort and suppression of late data after locking. Error handling does not display raw server error text. Missing plans are handled separately from storage errors.

The authenticated workflow contract connects an English request to plan approval, job preparation, idempotent text-role/agent assignment, dependency gating, two explicitly approved text calls, saved results/reconciliation and final owner review. This runs both against the embedded SQL engine and native PostgreSQL. Its injected provider is a fixture, not real inference evidence.

## Limits

This is a functional workbench using existing APIs and safeguards, not a final visual redesign or a new authentication system. The key is held only for the current in-memory browser connection. JavaScript memory is not a secure hardware vault. Requests accepted before locking may still have committed; reconnect and inspect saved state.

External executors/cloud models, general AI planning, automatic output chaining, scheduling management screens, provider restart acknowledgement, remote access and PWA installation/offline behavior remain outside this build. The local model's quality and token limits have not expanded. The ordinary preview remains default-disabled after validation.

## Production and browser validation

The production build passed. A live Hub-client integration passed against the production API, native PostgreSQL and the existing local CPU model. It verified saved results, idempotent replay and final owner review without paid/cloud calls.

The browser completed project creation, clarification, proposal editing, exact draft approval, plan preparation, agent assignment, local-model checking, an explicitly approved text call, saved-result reconciliation and separate final owner review. Changing the output limit disabled the original approval. The run succeeded at recorded API spend $0.000000. Locking cleared the displayed workspace and key; reload required a new key, and reconnecting showed the persisted succeeded run. A screenshot is supplied alongside the source archive.

Browser validation exposed a fetch receiver compatibility issue; the client now binds transport to the browser global receiver, with a regression test. The tiny test model proves execution plumbing, not useful assistant quality. It generated only 16 output tokens in a 128-token context.