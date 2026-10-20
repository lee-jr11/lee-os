-- Review acknowledges job preparation only; it cannot authorize dispatch.
CREATE TABLE run_preparations (
 run_id text PRIMARY KEY REFERENCES run_plans(run_id),
 request jsonb NOT NULL CHECK (jsonb_typeof(request)='object'),
 receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt)='object'
  AND (receipt->>'mode'='prepare-only') IS TRUE
  AND (receipt->'executionEnabled'='false'::jsonb) IS TRUE
  AND (receipt->'permissions'='[]'::jsonb) IS TRUE
  AND (receipt->>'costPolicy'='ZERO_ONLY') IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE jobs ADD UNIQUE(id,run_id,step_key);
CREATE TABLE prepared_jobs (
 job_id text PRIMARY KEY,
 run_id text NOT NULL REFERENCES run_preparations(run_id),
 step_key text NOT NULL,
 blueprint jsonb NOT NULL CHECK (jsonb_typeof(blueprint)='object'
  AND (blueprint->>'mode'='prepare-only') IS TRUE
  AND (blueprint->'executionEnabled'='false'::jsonb) IS TRUE
  AND (blueprint->'permissions'='[]'::jsonb) IS TRUE),
 UNIQUE(run_id,step_key),
 FOREIGN KEY(job_id,run_id,step_key) REFERENCES jobs(id,run_id,step_key)
);
CREATE FUNCTION leeos_immutable_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Preparation records are immutable'; END $$;
CREATE TRIGGER run_preparations_immutable BEFORE UPDATE OR DELETE ON run_preparations FOR EACH ROW EXECUTE FUNCTION leeos_immutable_preparation();
CREATE TRIGGER prepared_jobs_immutable BEFORE UPDATE OR DELETE ON prepared_jobs FOR EACH ROW EXECUTE FUNCTION leeos_immutable_preparation();
