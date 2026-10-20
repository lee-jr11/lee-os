-- One immutable planning snapshot per run. Replanning uses a new run.
CREATE TABLE run_plans (
 run_id text PRIMARY KEY REFERENCES runs(id),
 run_version integer NOT NULL CHECK (run_version >= 0),
 input jsonb NOT NULL CHECK (jsonb_typeof(input)='object'),
 plan jsonb NOT NULL CHECK (jsonb_typeof(plan)='object' AND (plan->>'costPolicy'='ZERO_ONLY') IS TRUE AND (plan->'executionEnabled'='false'::jsonb) IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION leeos_immutable_plan() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Saved plans are immutable'; END $$;
CREATE TRIGGER run_plans_immutable BEFORE UPDATE OR DELETE ON run_plans FOR EACH ROW EXECUTE FUNCTION leeos_immutable_plan();
