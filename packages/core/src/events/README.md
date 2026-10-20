# Durable event coordination

Append-only database events now drive explicitly enabled, project-scoped subscriptions through the scheduler module. Delivery uses a receipt per subscription/event rather than a sequence watermark, so late commits remain discoverable. Only selected run-outcome kinds can queue reviewed follow-up runs. No external publication or delivery channel is enabled. See [Structure 10](../../../../docs/structure-10.md).
