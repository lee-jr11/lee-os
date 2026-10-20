# Structure 13 validation

- Offline clean-install dry run passed; no dependencies added.
- Full lint, root/Hub typecheck and production build passed.
- Full default suite passed 120 tests. After adding one further recovery test, the targeted Hub suite passed all 8 tests (including its nested contract).
- Targeted lint passed after the final recovery test and ID validation change.
- Authenticated core contract on the embedded PostgreSQL engine reopens a succeeded run and all three saved results without additional fixture model generation; wrong-project recovery is rejected.
- Additional recovery test asserts every request is GET, invalid IDs cause no request, wrong-project IDs stop before workspace reads, pending jobs are not treated as results, and uncertain calls retain recovery-required state.
- Transport tests assert network/unreadable replies are bounded and each attempted mutation is sent only once.
- All eight SQL migration files match Structure 12 byte for byte.
- Browser loaded Structure 13 version 0.13.0 in the locked production preview. Network access had to be granted to make loopback reachable. Authenticated browser recovery was not exercised: starting its temporary configured preview was rejected by session policy because sandbox approval is disabled. Native PostgreSQL and live inference were not rerun for this browser-only structure. Earlier validation counts are historical, not new evidence.

No paid/cloud calls, new credentials, migrations or external integrations were introduced. PWA installation/offline lifecycle remains deferred. The source archive excludes environment files, dependencies and generated builds; archive integrity and private validation-value scans are checked during packaging.
