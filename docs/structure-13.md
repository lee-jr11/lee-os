# Structure 13 — reconnect and inspect saved work

Think of recovery as reopening the workshop ledger. Losing the browser connection does not tell you whether a server action finished. Read the ledger before doing it again.

## Use it

1. Keep the **Saved run ID** shown beside an open run. It is a record identifier, not an access key.
2. If disconnected, lock the Hub and unlock using your existing owner key at the configured local address.
3. Choose the project. Expand **Reconnect and inspect saved work**, enter its run ID and choose **Inspect saved run**.
4. Read the refreshed jobs and saved results. A running or recovery-required result is not permission to regenerate. Use the existing operator procedure for a retained model slot.
5. Before new execution, check the local model again and review fresh approvals.

Reopening uses GET requests only. It neither executes, reviews, reconciles nor releases slots. Results for attempted jobs are loaded together with the workspace; a failed read leaves the previously displayed workspace intact and reports failure. Reads are not a transactional snapshot: server version guards remain authoritative.

Recovery clears local job prompts and approvals, plan/review acknowledgements and checked provider metadata. It stores no owner key, run ID or prompt in browser storage. Locking/reload still clears the connection. Keep needed IDs yourself; you can also select runs from project lists. Recovery does not restore unsaved drafts or stop accepted server work.

Network failures and unreadable replies now use fixed messages rather than raw transport details. There are no automatic retries, including for mutations with uncertain outcomes. This build adds no database migration, dependency, cloud call or new execution permission.

PWA installation, remote access, scheduling screens and a visual redesign remain separate work. The next proposed structure is installation/offline lifecycle verification; it needs its own validation rather than a claim of phone-ready deployment.
