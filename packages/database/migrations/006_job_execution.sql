-- One durable, narrowly scoped owner authorization per prepared job. Never a queue lease.
CREATE TABLE job_executions (
 job_id text PRIMARY KEY,
 run_id text NOT NULL,
 agent_id text,
 call_id text UNIQUE REFERENCES provider_calls(id),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 permission text NOT NULL CHECK(permission IN ('local:text','owner:review')),
 attempt integer NOT NULL CHECK(attempt>0),
 status text NOT NULL CHECK(status IN ('running','succeeded','failed','discarded')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 FOREIGN KEY(job_id,run_id) REFERENCES prepared_jobs(job_id,run_id),
 FOREIGN KEY(agent_id,run_id) REFERENCES agents(id,run_id),
 CHECK((permission='local:text' AND agent_id IS NOT NULL AND call_id IS NOT NULL)
    OR (permission='owner:review' AND agent_id IS NULL AND call_id IS NULL)),
 CHECK((status='running')=(finished_at IS NULL))
);
CREATE FUNCTION leeos_execution_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Execution authorization cannot be deleted'; END IF;
 IF (NEW.job_id,NEW.run_id,NEW.agent_id,NEW.call_id,NEW.request_hash,NEW.permission,NEW.attempt,NEW.created_at)
 IS DISTINCT FROM (OLD.job_id,OLD.run_id,OLD.agent_id,OLD.call_id,OLD.request_hash,OLD.permission,OLD.attempt,OLD.created_at)
 OR OLD.status<>'running' OR NEW.status='running'
 THEN RAISE EXCEPTION 'Execution authorization is immutable; only one terminal resolution is allowed'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER job_execution_boundary BEFORE UPDATE OR DELETE ON job_executions FOR EACH ROW EXECUTE FUNCTION leeos_execution_boundary();
