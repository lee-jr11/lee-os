# Structure 12 — the general-purpose Hub workflow

LeeOS now has a working front desk in the Hub. You can move from a request to a reviewed plan, prepare its job cards, assign text agents, approve individual local model calls, read saved results and approve the finished work.

The Bible lesson example was an illustration of the intended direction, not a product requirement. No domain-specific generator was built. The [corrected roadmap](roadmap.md) is the current scope reference.

## Understand the pieces

| Piece | Meaning |
| --- | --- |
| Project | A place to group related requests and runs |
| Request | Your original words, plus clarification and draft revisions |
| Plan | Reviewed steps and their dependencies |
| Run | One attempt at carrying out that plan |
| Job card | One prepared step of the run |
| Assigned agent | A scoped role attached to a job; assignment alone cannot call a model |
| Result | The saved outcome of an explicitly approved job |

Plan approval, job preparation, agent assignment, model-call permission and final owner review are separate controls. The Hub uses the existing authenticated APIs for each; it adds no privileged execution shortcut or new database migration.

## Open your workbench

1. Use the existing local PostgreSQL and owner API setup. Run the existing migration command if needed; the latest migration remains 008.
2. Start the Hub at the exact address configured as `LEEOS_API_ORIGIN`. The API enforces that address, including its port and host. The ordinary unconfigured preview remains locked.
3. Enter your existing private owner key in **Unlock local owner access**. The key stays in the browser connection's memory and Authorization headers. It is not put in URLs, localStorage, sessionStorage or cookies, and it is not rendered into the page by the server. The input clears after connection.
4. Choose or create a project. **More projects**, **More requests** and **More runs** load older ID pages. **Refresh lists** reloads the initial pages; it is not a live event subscription.

**Lock Hub** aborts outstanding browser requests, closes the connection, and clears the visible workspace and its in-memory key. Reloading the page also loses that connection. Locking does not promise to roll back a server action already accepted or to stop a model process. Reconnect and inspect saved state after an interrupted operation.

This is the current single-owner, loopback-only model. It is not a remote login system, multi-user account service or phone-access deployment. No secret is passed from the server environment into the client bundle. A person controlling an already unlocked browser can perform owner actions; lock it when finished.

## Move a request through the Hub

### 1. Describe and inspect

Enter a task such as “Draft a welcome message then review the message.” **Preview interpretation** shows the bounded interpreter's draft without saving. **Save request** preserves it locally. Repeating an interrupted save with unchanged text in the same connection reuses its key.

The supported English vocabulary and limits from Structure 11 still apply. This is not unrestricted language-model planning. Read clarification questions, interpretations and assumptions. Source documents are not fetched automatically.

### 2. Clarify or edit

Use **Save English clarification** for a complete revised explanation. The original wording stays visible. **Edit as a sequence** provides editable titles and step types; saving deliberately replaces the dependency graph with that displayed sequence and includes a final owner-review step. Review its scope checkbox before saving.

The sequence editor is a simplified editing path. It does not preserve custom parallel dependencies or model requirements when replacing the plan. Advanced graphs and model requirements remain available through the existing owner API. Unsupported workflow, Python or device steps remain visibly planned and cannot run from this Hub.

### 3. Approve the draft

Review the current goal and steps, then check the exact-draft acknowledgement and choose **Approve draft and create queued plan**. The checkbox is bound to that request ID, version and proposal digest. Clarification or edits invalidate it automatically. Outstanding questions prevent approval.

The Hub opens the new queued run. Nothing has executed. An already approved request can reopen its run from **Open approved run**, and existing runs can be reopened from the project list. A run created without a saved plan is shown as such rather than silently inventing one.

### 4. Prepare and assign

Read **Saved plan**, check its preparation acknowledgement and choose **Prepare job cards**. That acknowledgement is bound to the plan digest and run version.

Choose **Assign text agents** while the run is still queued. All text jobs must be assigned before the first one starts, because the existing assignment boundary does not add agents to a running plan. The Hub registers/reuses one immutable text role and binds it to each still-unassigned text job with empty permissions. A partial assignment failure can leave completed assignments; refresh and inspect them before continuing. Repeating assignment skips jobs already mapped to an agent.

### 5. Check and explicitly run a text job

The local model and job execution remain disabled by default. To use them, the operator must follow Structure 8's dedicated llama.cpp setup and enable these existing flags in the private Hub environment before restarting:

```dotenv
LEEOS_LOCAL_PROVIDER_ENABLED=1
LEEOS_LOCAL_PROVIDER_LOCAL_ONLY=1
LEEOS_JOB_EXECUTION_ENABLED=1
```

**Check local model** reads the server state and its reported model/build fingerprint. It does not download a model or generate text. The underlying local-process trust limits remain unchanged; the fingerprint does not attest the weight bytes.

For an eligible text job, enter its **Exact prompt** and **Maximum output tokens**, then check the prompt/model/limit acknowledgement and choose **Approve and run this text job**. Editing the prompt, output limit, checked fingerprint or relevant job/run identity invalidates that checkbox. Dependencies and available agent assignments gate the button; the server independently rechecks current authority and actual capacity before dispatch.

The model path remains local, one call per consumed job authorization, with output capped at 128 tokens and by actual model capacity. The prompt is bounded to 8192 UTF-8 bytes by the server. No earlier output is automatically inserted into another prompt. Copy or supply the needed source text yourself. Generated text is displayed as text, never executed as code or interpreted as HTML.

### 6. Read results and review the finished work

Read each saved result and its status. A provider's completed call is not automatically an accepted job result; cancelled or revoked work may be discarded. **View saved result** reloads a record without generation. **Reconcile saved call** applies the existing durable call result without requesting a new completion.

An uncertain call may retain its model slot. The Hub reports recovery requirements; the existing operator stop/restart/versioned provider recovery procedure still applies. This structure does not automate that acknowledgement or retry a consumed job.

When dependencies succeed, explicitly check and approve the owner-review card. The run succeeds only after all cards succeed. **Cancel run** closes unfinished work with the current version. Completed results remain recorded. Commands are serialized in this first browser workflow; cancellation while a model call is already pending requires the existing owner API, or waiting for its bounded call to finish. Locking stops browser waiting but does not guarantee server cancellation.

## Errors and limits

- Stale state or conflicting permissions are rejected by the existing API. Refresh the selected request/run and inspect the saved state before repeating a command.
- Browser reads across several API endpoints are not one database snapshot. Server version/digest/attempt guards remain the authority if another caller changes state.
- The Hub shows at most 100 jobs/agents for one run and refuses a truncated view. Normal prepared plans are already capped at 50 steps.
- Request/run/project lists are paged and do not claim commit-ordered delivery. Coordination still uses durable server receipts.
- Model capabilities, token budgets and output quality have not expanded. The tiny validation model proves the workflow, not useful assistant quality. Cloud models, external executors, automatic source reading and autonomous agent loops remain inactive.
- Scheduling and event-rule management screens, role dismissal, provider restart acknowledgement, advanced graph editing, PWA installation/offline behavior and remote hosting are outside this structure. Their existing APIs or future work remain documented separately.
- The existing visual palette is retained. This is the functional workflow, not a final UI redesign.

See [validation evidence](validation-structure-12.md). There is no domain-specific next module implied by this structure; agree the next general LeeOS improvement with Lee before proceeding.
