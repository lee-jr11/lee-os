# Structure 11 — English requests into reviewed plans

Lee, this structure adds a front desk to LeeOS. You can describe a task in ordinary words, inspect how LeeOS understood it, clarify or edit the draft, then approve that exact proposal. Approval puts **one queued run with a saved plan** into the system. Preparing jobs, assigning agents, enabling schedules and executing work remain separate actions.

This first intake is deliberately a **bounded English interpreter**, not a general AI planner. The local model connection from Structure 8 is still available for explicitly approved text generation, but its tiny validation model does not establish planning quality. Intake uses transparent rules and makes no model calls, cloud requests or spending claims based on an advertised free tier.

| Piece | What Lee sees | What it does |
| --- | --- | --- |
| Preview | An interpretation, steps and questions | Runs without storage or inference |
| Saved request | Original wording and a permanent request ID | Preserves the original locally |
| Clarification | A clearer English request | Creates a new proposal revision |
| Owner edit | Explicit goal and step graph | Resolves details the interpreter cannot infer |
| Proposal digest | Identity of the exact draft reviewed | Binds approval to request, revision and content |
| Approval receipt | One queued run ID | Saves run, plan and history together |

## Try it without configuring a model

From the repository root:

```text
npm run request -- preview docs/examples/request.txt
```

The example asks LeeOS to draft a volunteer welcome message, rewrite it in a warmer tone, then review the final message. Preview prints its interpretation and draft steps. It needs no account, owner API, database or provider. It neither writes the result nor executes the proposed work.

The supported text-action openings are `write`, `draft`, `summarize`/`summarise`, `rewrite`, `rephrase`, `translate` and `check`. `Review` means an owner review step. An optional `please` is accepted. Separate actions with `then`, `and then`, a semicolon or a newline. At most eight clauses are interpreted. A final owner-review step is added when needed, and each generated step depends on the previous one.

The interpreter treats each recognized clause as a proposed text task. It does not extract a complete specification from arbitrary prose. The proposal shows the full recognized clauses even when a displayed step title is shortened. Earlier outputs are not automatically copied into later prompts, and intake does not read documents, browse URLs or fetch source data.

Examples:

| Request | Result |
| --- | --- |
| `Draft a short welcome message` | Draft text job, then owner review |
| `Summarize the project notes then check the summary` | Two sequential text jobs, then owner review; source text must still be supplied before execution |
| `Translate the greeting into French` | Translation text job, then owner review |
| `Translate my notes` | Clarification about the target language |
| `Write a weekly report and send it` | Clarification about timing/external action; no schedule or sending permission |
| `Build my whole business` | Clarification; no guessed execution graph |

Conservative recognition can flag words appearing in the content itself. Timing words, external actions and code/tool references require clarification. Multiple actions joined ambiguously should be separated explicitly. This is not a security classifier or a promise that every English ambiguity is detected. The owner must compare the original wording, interpretations, assumptions, questions and final steps before approval. Broad language-model planning remains deferred.

## Save and clarify a request

Apply migration `008_request_intake.sql` with `npm run db:migrate` and use the existing private owner API setup. Migrations 001–007 are unchanged. There is no new provider key or intake opt-in flag because this layer performs no inference. The owner API remains disabled until configured as before.

Save a UTF-8 text file in ignored `.leeos/`, then submit it:

```text
npm run request -- submit PROJECT_ID .leeos/request.txt welcome-request-1
```

The request text is limited to 4000 UTF-16 string units and 8192 UTF-8 bytes. The final argument is a stable idempotency key for this project. Repeating the same normalized text/key returns the same request identity in its current state. Changing the text while reusing the key conflicts. Use clarification to revise an existing request, or a new key for a separate task.

The response contains the preserved original `text`, current `status`, `version`, `proposalVersion`, `proposalDigest` and `proposal`. `needs-clarification` means the questions must be resolved before approval. `draft` means the bounded interpreter found a proposed graph, not that the task has been executed or fully understood.

To clarify in English, write the complete revised request to another file and use the current version:

```text
npm run request -- clarify REQUEST_ID 0 .leeos/clearer-request.txt
```

This creates a new proposal revision and runs the same interpreter again. It may still need clarification. The original request is not overwritten; revised wording remains in the revision's goal and clause interpretations. Clarification is a replacement explanation, not an automatic conversational merge of previous answers.

Both submission and clarification require the matching local owner token/origin in the ignored root `.env` and a running configured Hub/database. Preview remains a local storage-free command. The original wording and proposal revisions are stored as text/JSON in the local database, so include them in normal database access and backup protections.

## Edit details explicitly

For a request that needs more detail, edit the goal and graph using `PATCH /api/v1/requests/REQUEST_ID`. A request example is provided in `docs/examples/intake-edit.json`. Copy it into ignored `.leeos/`, replace its version and edit its steps, then use:

```text
npm run leeos -- PATCH /requests/REQUEST_ID --json-file .leeos/intake-edit.json
```

An edit requires `expectedVersion` and `acknowledgeScope: true`. The graph must be acyclic, use known step kinds and end with an owner review that depends transitively on every earlier step. The edit becomes a new immutable revision with interpreter `owner-edit`; earlier questions are replaced by the owner's explicit specification. It preserves the original request for comparison.

Owner edits may describe `model`, `review`, `workflow`, `python` or `device` steps. Mentioning a planned executor does not enable it. The existing planner records unsupported external execution as blocked. Model capability/token requirements may be supplied using the existing plan step schema. English intake does not guess model IDs, credentials, token counts, URLs or billing evidence.

## Approve the exact proposal

Read the request again. Compare the original with the latest draft and copy the current version and digest into a private approval file:

```json
{
  "expectedVersion": 1,
  "reviewedProposalDigest": "64_LOWERCASE_HEX_FROM_CURRENT_REQUEST",
  "acknowledgePlanReview": true,
  "action": "create-reviewed-run"
}
```

Submit it with:

```text
npm run leeos -- POST /requests/REQUEST_ID/approve --json-file .leeos/approve-request.json
```

Approval requires a `draft` with no outstanding questions. A changed request identity, revision, graph or goal changes its digest; stale approval conflicts. The digest identifies the proposal, not the separate run-plan digest used later for job preparation.

The transaction creates one queued run, a normal immutable planner snapshot, an immutable approval receipt, and the corresponding history. The run's definition snapshot links back to the source request/revision/digest. It does not create an automation, jobs, assignments, schedules, event rules, artifacts or provider calls. The saved plan remains blocked for execution, and the final owner-review step remains pending for the eventual work.

Identical approval retries replay the original receipt, including after the resulting run is cancelled. A different approval conflicts. Approval increments request state version but leaves `proposalVersion` and its digest stable. After approval, use the earlier run/plan workflow for preparation and execution. Cancelling a draft request uses its own versioned command; cancelling an approved run uses the existing run command.

## Routes and state

All API routes below use the existing local owner authentication and Host/Origin protections:

| Route under `/api/v1` | Purpose |
| --- | --- |
| `POST /requests/preview` | Interpret `{ "text": "..." }` without persistence or inference |
| `GET/POST /projects/:projectId/requests` | List summaries or save `{ "text": "...", "idempotencyKey": "..." }` |
| `GET /requests/:requestId` | Original wording, latest proposal/digest and approval receipt |
| `POST /requests/:requestId/clarify` | Reinterpret `{ "expectedVersion": 0, "text": "..." }` as a new revision |
| `PATCH /requests/:requestId` | Save explicit edited goal/steps with current version |
| `POST /requests/:requestId/approve` | Create one reviewed queued run and plan |
| `POST /requests/:requestId/commands` | Cancel with `{ "action": "cancel", "expectedVersion": 0 }` |

Listing accepts an `after` request-ID cursor and `limit` 1–100. Status is `needs-clarification`, `draft`, `approved` or `cancelled`. Editing/clarifying/cancelling terminal requests is rejected. This structure provides no model-generated plan import endpoint and never treats text such as “ignore the rules” as execution authority.

## Recovery and validation

State, revisions and approval history commit transactionally. If approval history cannot be written, no new run or plan remains. Concurrent edits/cancellation and approval serialize on the request: the old digest cannot approve a new revision. On uncertain HTTP completion, read the request; repeat an identical create/approval request to recover the existing identity/receipt. A stale edit or clarification should be reviewed again rather than blindly retried.

See [validation](validation-structure-11.md) for checks. The Hub layout remains unchanged apart from its milestone label. Roadmap correction: the Bible lesson example was illustrative, not a feature commitment. Structure 12 connects the general request-to-results workflow in the Hub.
