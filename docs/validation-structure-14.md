# Structure 14 validation

- Offline clean-install dry run passed; no dependency was added.
- ESLint and root/Hub typechecks passed.
- Full default suite: 125 passed, no failures or skips.
- Focused PWA suite: 4 passed; targeted lint passed after the final test change.
- The worker harness executes the actual service-worker source in an isolated runtime with controlled cache/network interfaces. It verifies static-only installation, owned-cache cleanup, API/mutation/asset/cross-origin bypass, network-first page navigation, preserved HTTP errors, offline fallback and explicit 503 when the fallback is missing.
- Manifest identity/scope/start address and actual PNG icon dimensions are checked.
- All eight database migration files match Structure 13 byte for byte. No native PostgreSQL or model inference rerun was needed for this PWA-only change.

The harness does not establish real-browser worker lifecycle or device installation. Those are reported separately below. No cloud/model requests or hosted services are introduced. The preview remains unconfigured with execution disabled.

## Production browser evidence

Production build passed. The in-app browser loaded version 0.14.0 and displayed the existing-worker waiting-update notice. The page was not forced to reload. Navigating away from the old page and returning allowed the new worker to activate; the waiting notice disappeared.

With the production server stopped, reloading displayed the new cached static help page at the Hub URL. Its text correctly warns that accepted actions might already have saved and that no work is queued offline. Screenshot: `../LeeOS-Structure-14-offline.jpg` alongside the archive. Restarting the server and choosing Try the Hub again restored the locked Structure 14 Hub. Both original preview ports were restored without owner/model execution configuration.

The production health endpoint reports 0.14.0 / structure 14 / executionEnabled false. The unconfigured owner API returns 503. The worker response has no-cache/no-store update headers.

Actual native installation, OS uninstall, phone installation and an OS-installed standalone-window update were not tested. This browser has no exposed native installation control. Browser network online/offline event toggling was not simulated; server unavailability was tested instead. No remote access or full offline workspace capability is claimed.
