# P1.3 — Generic Email Delivery and Effect Confirmation

P1.3 adds a reusable `email.send` operation and an opt-in Resend adapter. Email is an external effect: provider acceptance is recorded separately from recipient-server delivery, and only a signed, deduplicated delivery event can satisfy the matching P0.1 delivery criterion.

```text
Reviewed contract + approved-email-only grant
        ↓
Immutable email.send operation (one recipient, exact subject/body, optional prior DOCX artifacts)
        ↓
Durable effect identity + attempted receipt, committed before network dispatch
        ↓
Resend with a stable idempotency key
        ↓
Provider acceptance receipt (still waiting)
        ↓
Signed, fresh, recipient-matching webhook
        ↓
Delivered/failed receipt + P0.1 evidence + Hub read model
```

The operation is generic. It contains no Bible-specific assumptions. A reviewed envelope authorizes one exact recipient, subject, text body, and zero or more artifacts produced by earlier DOCX operations in that same envelope. The document and delivery requirements may be different; the explicit dependency and artifact identity bind them together. HTML mail, multiple recipients, arbitrary file paths and inbound attachments are outside this slice.

## Effect states and recovery

`attempted` is durable before the worker makes the provider request. A successful Resend API response records `accepted`, but the run stays pending while LeeOS awaits the recipient event. A signed `email.delivered` event means the recipient mail server accepted the message; it does not prove inbox placement, reading, or human attention. A signed bounce/failure or a definitive pre-acceptance provider rejection can record failure. If the worker loses the response, LeeOS retries only with the same provider idempotency key and only within Resend's documented 24-hour key window. Once the outcome cannot safely be resolved, the effect becomes `unknown` and waits for reconciliation; LeeOS never silently starts a new send.

Signed webhook events are checked against the exact body, Svix signature and timestamp, unique provider event ID, LeeOS effect tag, provider message ID and normalized recipient digest. Duplicate events cannot duplicate receipts or acceptance evidence. A webhook after cancellation or grant expiry may be preserved as factual receipt data, but cannot revive the run or restore worker authority. The Hub shows the effect state without exposing the email address, message body, credentials or webhook secret.

## Zero-spend boundary and provider setup

Email delivery is disabled by default. Resend's API does not provide LeeOS a live billing-plan/overage check. Therefore the route labels cost evidence `owner-attested-zero`: Lee must attest that the Resend account is on its free plan and paid overages are disabled. The attestation timestamp is required to be no older than 24 hours. It is not represented as provider-verified billing evidence. Reconfirm those settings before each activation window. Resend's free plan has included usage limits, while paid plans and overages can incur charges; see [current Resend pricing](https://resend.com/pricing?product=marketing).

Before enabling delivery:

1. Apply migrations 001–015 to the intended database and verify the database's included capacity/backup/overage terms. P1.3 uses PostgreSQL for durable effect and receipt state.
2. Verify a sender domain in Resend and use a sender address on that domain.
3. In the Resend account, confirm the $0 plan and disable paid overages. Set a fresh `LEEOS_RESEND_ZERO_COST_CONFIRMED_AT` value in UTC, `LEEOS_RESEND_FREE_PLAN_CONFIRMED=1`, and `LEEOS_RESEND_PAYG_DISABLED=1`.
4. Store `RESEND_API_KEY` only in the private sending worker, and store `RESEND_WEBHOOK_SECRET` only in the HTTPS API environment. The API will keep the route unavailable until webhook verification is configured. Set `RESEND_FROM_EMAIL`, then opt in with `LEEOS_RESEND_EMAIL_ENABLED=1` on the worker. Never use `NEXT_PUBLIC_*` variables or commit actual values.
5. Configure a reachable HTTPS Resend webhook for the exact LeeOS endpoint `/api/v1/webhooks/resend`, using its signing secret. Subscribe to `email.sent`, `email.delivered`, `email.bounced` and `email.failed`. `email.sent` records provider acceptance; only the matching `email.delivered` event satisfies delivery acceptance.

The GitHub Actions sending worker reads only the Resend API key from `RESEND_API_KEY`; sender and attestation values come from environment variables with the matching `RESEND_FROM_EMAIL` and `LEEOS_RESEND_*` names. The webhook signing secret is needed only by the HTTPS API that receives provider receipts, so it is not sent to the worker. The workflow passes `LEEOS_RESEND_EMAIL_ENABLED=1` only when sending credentials and attestation inputs are present. This is a configuration gate, not proof of billing state. The runner remains limited to the public repository's default branch and does not apply migrations.

Local/server variables are listed in `.env.example`. Migration 015 is deliberately not applied by the code, Hub, or workflow. Check status before migration and apply it only to the database you intend to use:

```powershell
npm run db:status
npm run db:migrate
npm run db:status
```

## Acceptance and verification

The central invariant remains:

```text
provider accepted ≠ recipient server delivered ≠ user goal achieved
```

Delivery confirmation only marks the exact bound P0.1 criterion met after a signed recipient-specific receipt. It cannot stand in for DOCX validation, artifact custody, or other goal requirements. The existing P0.1 contract still decides whether the user's goal succeeded.

Fixture tests cover cost-attestation freshness, verified sender-domain checks, stable idempotency keys, signed webhook validation, one-recipient matching, webhook deduplication, acceptance evidence, expired idempotency windows, PII minimization and disabled-route behavior. Run `npx tsx --test tests/resend-email.test.ts tests/email-delivery.test.ts` and then `npm run check` for repository validation.

This workspace has no configured Resend credentials, webhook endpoint or hosted database, and no live message was sent. The provider adapter and delivery lifecycle are fixture-verified; hosted delivery and live billing/account configuration remain unverified deployment work. Do not claim P1.3 production readiness until a controlled real-recipient test confirms signed events and the database shows the corresponding receipt/evidence. Keep that live test separate from automatic ZERO_ONLY execution until free-plan and overage settings are personally confirmed.
