# Structure 16 validation

No migration or dependency was added. All eight SQL migrations and all third-party lock records match Structure 15. Only LeeOS workspace versions changed. The initial broad version replacement touched a third-party lock entry; it was restored before final validation. Offline install dry-run passed against the normal npm cache; the restricted cache lacked metadata.

New tests execute the actual authenticated core API on the embedded PostgreSQL engine. They cover reusable definition creation, idempotent run reopening, stale definition review rejection, frozen run snapshots after definition revision, immutable reviewed plans, and separately planning a trigger-created run with no jobs. Pure tests check step bounds, sequential dependencies/final review, rejection of unknown fields/capabilities and recognition after JSON object-key reordering.

The initial lint check found a text-escaping issue, corrected before the final check. Final build/test and browser evidence follows below.

## Automated results

- ESLint, root/Hub typechecks and the final targeted workbench lint passed.
- Full default suite: 129 passed, no failures or skips.
- The restricted build failed creating a generated Next.js directory (EPERM); it was retried outside that restriction. No source permission or authentication safeguard was weakened.

## Browser and production evidence

The unrestricted production build completed successfully. Browser validation used a disposable native PostgreSQL cluster and temporary owner key, with model execution disabled. LeeOS created a reusable two-text-step definition plus final owner review, separately queued a run and prefilled a draft from its frozen snapshot despite PostgreSQL JSON key reordering. Editing the plan goal invalidated its acknowledgement. After renewed review, saving produced an immutable three-step plan while job preparation remained a separate disabled-until-acknowledged control.

API read-back confirmed one reusable definition, one queued run, three saved plan steps, zero jobs and an unchanged reusable goal despite editing the run plan. Trigger-created-run planning and definition-revision isolation passed through the authenticated automated contract; they were not separately repeated in the browser. Browser pagination, concurrent revision races and advanced graphs were not simulated. The existing server contracts and documented limits remain authoritative.

The temporary owner connection was locked/closed, its server and database stopped, and both original preview ports restored with owner access/execution disabled. No model calls, paid services or external executors were used. Native full-database suites from previous milestones are historical evidence, not new runs in this structure. Definition revision remains in the owner API.

Source ZIP integrity, source JSON parsing, private validation-value scans and browser-bundle scans are performed during packaging. Environment files, generated builds, dependencies and local validation assets are excluded.
