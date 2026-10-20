# P1.2 — DOCX Generation & Validation

P1.2 adds a document-generation specialist to LeeOS without making Python the capability contract. The reviewed plan routes `document_generation` to `python-document`; the accepted envelope pins the implementation version; the independent worker executes the exact resolved request; and the DOCX validator must pass before P1.1 stores the bytes.

```text
Reviewed requirement and selected capabilities
        ↓
Accepted durable envelope: docx.generate
        ↓
Current worker claim, lease and fencing token
        ↓
Python specialist creates DOCX bytes
        ↓
Separate validator reopens bytes and checks format, text and styles
        ↓
P1.1 stores bytes and verifies retrieval/integrity
        ↓
Worker atomically records artifact-bound P0.1 evidence
```

Generation, validation, storage, delivery and goal achievement are separate states. A successful Python process does not itself mark the operation successful. The operation becomes successful only after the validator passes, P1.1 owns and re-reads the exact bytes, and the current authorized worker fence commits the output and machine evidence. The run may still succeed technically while other goal criteria remain pending.

## Contract and validation scope

The `docx.generate` input is structured: a title, sections, headings and paragraph strings, plus a safe `.docx` filename. Inputs are resolved from the accepted contract at execution time and capped at 8 KiB for the complete serialized request. The generated artifact is capped at the existing 10 MiB P1.1 per-file limit. The envelope records the Python implementation contract, validation implementation, storage implementation and DOCX MIME type.

The generator sets all paragraph styles and visible text runs to Times New Roman, 12 pt, including the complex-script font-size and font-family attributes. The separate validator checks that the bytes are a readable Office Open XML DOCX package, required package parts exist, the package has no VBA or external relationships, the exact requested paragraph content is present, and each visible run has the required font and size. It returns a byte count and SHA-256 digest.

Validation proves structural readability, exact supplied text and requested formatting. It does not judge lesson quality, render pages for visual layout, verify citations or theology, send the file, or prove delivery. No Bible-specific content is built into this capability.

The Python dependency is pinned in `requirements-python.txt`. `LEEOS_PYTHON_EXECUTABLE` is optional; the default executable name is `python`. `LEEOS_PYTHON_DOCX_DIRECTORY` is optional when a worker starts outside the monorepo root. The subprocess uses an allowlisted environment, bounded input/output, a 30-second timeout and no shell. The fixed scripts make no network requests and receive no credentials. Their stderr and input text are not included in LeeOS events or worker logs.

## Durability and recovery

The worker first reserves the exact resolved document request and current dispatch fence. It then generates, validates and registers through the existing P1.1 service. If the worker loses its lease after bytes are stored but before the operation result commits, the next valid fence finds the stable artifact idempotency identity, retrieves the saved bytes, validates them again and commits the result without creating a second artifact. A stale worker cannot commit operation output or evidence after its fence changes.

P0.1 evidence kinds `document-validation` and `artifact-registration` are written only inside the worker transaction. Migration 014 binds both evidence rows to the successful DOCX operation, its artifact and current worker claim; SQL checks reject evidence that does not match the actual stored artifact and validation report. The owner evidence API does not accept these machine-authored kinds.

## Dependencies and opt-in

P1.2 requires migrations 001–014. Apply them deliberately to the configured database:

```powershell
npm run db:status
npm run db:migrate
npm run db:status
```

Before enabling file storage, verify the database provider's included capacity, backup allowance and overage settings. Then set `LEEOS_ARTIFACT_STORAGE_ENABLED=1` only in the private worker/server environment. It stays disabled by default, and an unconfigured or disabled store leaves the accepted document operation queued without running Python or writing bytes.

For a local standalone worker, install the pinned Python dependency and enable the existing worker separately:

```sh
python -m pip install -r requirements-python.txt
$env:LEEOS_ENVELOPE_WORKER_ENABLED='1'
$env:LEEOS_ARTIFACT_STORAGE_ENABLED='1'
npm run worker:envelopes -- once
```

The remote GitHub workflow can run document-only work with the required `LEEOS_REMOTE_DATABASE_URL` secret and the GitHub environment variable `LEEOS_ARTIFACT_STORAGE_ENABLED=1`. It prepares Python only when storage is explicitly enabled. Gemini credentials remain optional for document-only operations; the AI route stays unavailable unless both provider secrets are configured. The public-repository/default-branch runner gate and zero-automatic-spend policy still apply. The workflow does not run database migrations.

## Verification and limits

`tests/docx-generation.test.ts` performs a real local Python generation/validation round-trip, rejects mismatched or invalid DOCX input, verifies durable worker recovery from an already stored artifact under a new fence, checks both acceptance evidence records and confirms the storage opt-in leaves work queued. Migration 014 is exercised by the embedded PostgreSQL-compatible migration tests. The full repository checks are `npm run check` and `npm run test:postgres` when a separate test PostgreSQL URL is configured.

This workspace has no configured Git remote, shared hosted database, GitHub secrets or enabled artifact-storage allowance. Local worker/integration verification therefore does not prove hosted execution. P0.5 hosted E2E and remote DOCX upload remain deployment gates; the Hub has no structured DOCX authoring UI yet. Delivery belongs to P1.3. The Bible Lesson Generator end-to-end scenario is not complete.
