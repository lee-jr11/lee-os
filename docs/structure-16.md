# Structure 16 — reusable definitions and reviewed run plans

A definition is the reusable recipe. A run is one attempt, holding a snapshot of that recipe. A plan is the reviewed set of steps for that attempt. None of these records grants execution permission.

## Create a reusable definition

Unlock the local owner connection and choose a project. Expand **Reusable automations**. Enter a name, goal and one text-step title per line. The supported format contains 1–49 sequential text jobs and adds a final owner-review step. Review the acknowledgement, then save. It creates a definition only: no schedule, run, jobs, agents or model call.

Inspect the saved definition and its version. **Load automation definitions** shows existing definitions, 25 at a time, with More definitions for further pages. Selecting a definition reads its latest record. Refresh coordination after creating a definition to make it available in the schedule panel.

The existing create-definition API has no deduplication key. If a save is interrupted, inspect the list before creating again. The Hub never retries automatically. This build offers creation and inspection; definition revision remains a versioned owner API operation.

## Queue one attempt

A separate checkbox acknowledges the selected definition version. **Create queued automation run** checks the current definition version before queueing and reuses a run key for the same selection. Repeating it reopens that run. Reload definitions to begin a fresh selection when another run is intentional. Reloading/locking loses the in-memory key: inspect run lists after uncertain outcomes.

The server snapshots the current definition atomically, but its existing queue endpoint does not accept an expected definition version. A revision can race the preliminary read. The Hub reports a different returned version, opens its actual snapshot and never saves its plan automatically. Review that snapshot before continuing. Reusable definitions do not silently schedule themselves.

## Plan a manual or triggered run

Open a queued run from the automation panel or project run list. An unplanned run now shows **Review a plan for this queued run**, including its saved definition snapshot. A recognized LeeOS sequence supplies an editable draft. Other definition JSON is not interpreted: supply an explicit goal and text steps instead. Unknown/extra format fields are not silently dropped into an executable sequence.

Review the displayed goal, ordered text steps and final owner-review step. A checkbox is bound to the run ID, run version, snapshot and edited fields. **Save reviewed run plan** uses the existing planner API and creates an immutable plan; it does not prepare jobs. Changing the form invalidates the acknowledgement. Advanced dependency graphs, custom model requirements and non-text capabilities remain in the owner API.

This also works for trigger-created runs: refresh project run lists, open the queued run and review its frozen snapshot. Revising the reusable definition later does not change existing runs. Editing this draft changes only that run's plan, not its recipe.

One run has one immutable plan. To use a changed plan after saving, create a new run and review again. After saving, the existing preparation, agent assignment, model checking, exact-prompt approval and final owner-review controls remain separate. Step titles never become automatic prompts and outputs are not automatically chained.

## Boundaries and recovery

The global workbench serializes actions. Locking/switching projects clears the definition panel. Saved-run recovery remains available; no owner key or form draft is persisted to browser storage. After an uncertain save, refresh and inspect records rather than assuming nothing happened. Multi-endpoint views are not a transactional snapshot; the server checks run versions and immutable plan identity.

No dependency, migration, executor, cloud call, model permission or background worker was added. See [validation](validation-structure-16.md). Structure 17 is proposed as guided local setup and everyday operation, followed by Structure 18 acceptance checks and V1 documentation. These remain subject to Lee's approval.
