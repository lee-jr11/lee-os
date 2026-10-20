-- Role definitions and scoped assignment receipts do not authorize execution.
ALTER TABLE agents ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
CREATE TABLE agent_roles (
 id text PRIMARY KEY CHECK(id ~ '^role_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 registration_key text NOT NULL UNIQUE CHECK(length(registration_key) BETWEEN 1 AND 200),
 request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object' AND (definition->'permissions'='[]'::jsonb) IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE prepared_jobs ADD UNIQUE(job_id,run_id);
CREATE TABLE agent_assignments (
 agent_id text PRIMARY KEY,
 run_id text NOT NULL,
 job_id text NOT NULL UNIQUE,
 role_id text NOT NULL REFERENCES agent_roles(id),
 request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 assignment jsonb NOT NULL CHECK(jsonb_typeof(assignment)='object'
  AND (assignment->>'mode'='assignment-only') IS TRUE
  AND (assignment->'executionEnabled'='false'::jsonb) IS TRUE
  AND (assignment->'permissions'='[]'::jsonb) IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(agent_id,run_id) REFERENCES agents(id,run_id),
 FOREIGN KEY(job_id,run_id) REFERENCES prepared_jobs(job_id,run_id)
);
CREATE INDEX agent_assignments_run_idx ON agent_assignments(run_id,agent_id);
CREATE INDEX agent_assignments_role_idx ON agent_assignments(role_id);
CREATE FUNCTION leeos_immutable_agent_record() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Agent role and assignment records are immutable'; END $$;
CREATE TRIGGER agent_roles_immutable BEFORE UPDATE OR DELETE ON agent_roles FOR EACH ROW EXECUTE FUNCTION leeos_immutable_agent_record();
CREATE TRIGGER agent_assignments_immutable BEFORE UPDATE OR DELETE ON agent_assignments FOR EACH ROW EXECUTE FUNCTION leeos_immutable_agent_record();
CREATE FUNCTION leeos_assignment_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF EXISTS(SELECT 1 FROM agent_assignments WHERE agent_id=OLD.id) THEN
  IF (NEW.id,NEW.run_id,NEW.role,NEW.provider_id,NEW.model_id,NEW.permissions)
    IS DISTINCT FROM (OLD.id,OLD.run_id,OLD.role,OLD.provider_id,OLD.model_id,OLD.permissions)
   THEN RAISE EXCEPTION 'Assigned agent scope and permissions cannot change'; END IF;
  IF NEW.status=OLD.status THEN
   IF NEW.version<>OLD.version THEN RAISE EXCEPTION 'Agent version must track status'; END IF;
  ELSIF NOT (OLD.status='planned' AND NEW.status='dismissed' AND NEW.version=OLD.version+1) THEN
   RAISE EXCEPTION 'Assignment-only agents cannot start or restart';
  END IF;
 END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER agents_assignment_boundary BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION leeos_assignment_boundary();
