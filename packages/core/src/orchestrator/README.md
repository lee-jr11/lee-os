# orchestrator

This module implements deterministic planning of supplied steps and persistence of immutable run-plan snapshots. See [the planning guide](../../../../docs/structure-4.md).

It is a planning foundation, not the target Master Orchestrator. General intent/context assembly, useful memory delegation and autonomous next-action coordination are not implemented here. Planning grants no execution authority; separately authorized local text execution lives in the job-worker/provider services, while external executor launch remains unimplemented.
