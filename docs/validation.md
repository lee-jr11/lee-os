# Structure 1 validation — 16 October 2026

Environment: Windows, Node.js 24.14.1, npm 11.11.0. Node 22 LTS is the documented development/CI target; CI has not been dispatched.

- PASS: clean dependency resolution and committed-ready package-lock.json.
- PASS: npm ci (356 packages).
- PASS: npm run lint (rerun after configuring the Hub workspace path; no warnings).
- PASS: npm run typecheck (shared packages and generated Hub route types).
- PASS: npm test (2 tests: cost rejection and health contract).
- PASS: npm run build (Next.js 16.4.2 production build).
- PASS: production server startup on loopback port 3101.
- PASS: HTTP 200 and expected Hub content, health JSON, standalone web manifest, service worker, offline fallback, and both PNG icons.
- PASS: Git ignore checks for root/Hub local environment files and private key files; safe examples remain visible.
- PASS: repository JSON parsing.

Dependency overrides for nanoid and es-abstract resolve registry inconsistencies; see structure-1.md. Package installation and localhost verification required permitted access outside the network-isolated sandbox.

Not tested: device installation, actual browser service-worker/offline lifecycle, hosted deployment, GitHub Actions, or any external integration. Full JSON Schema validation was not run. No database or Bible Lesson Generator was implemented.
