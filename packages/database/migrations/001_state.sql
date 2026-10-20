-- LeeOS Structure 2. Apply only to a dedicated LeeOS database.
CREATE TABLE projects (
 id text PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
 metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE automations (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
 definition_version integer NOT NULL DEFAULT 1 CHECK (definition_version > 0),
 definition jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(definition) = 'object'),
 executor_id text, cost_policy text NOT NULL DEFAULT 'ZERO_ONLY' CHECK (cost_policy = 'ZERO_ONLY'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, project_id)
);
CREATE TABLE runs (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), automation_id text,
 automation_version integer, definition_snapshot jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(definition_snapshot) = 'object'),
 idempotency_key text CHECK (length(idempotency_key) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled','interrupted')),
 version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
 spent_usd numeric(16,6) NOT NULL DEFAULT 0 CHECK (spent_usd >= 0),
 started_at timestamptz, finished_at timestamptz, interrupted_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (automation_id, project_id) REFERENCES automations(id, project_id),
 CHECK ((automation_id IS NULL) = (automation_version IS NULL)),
 CHECK (automation_version IS NULL OR automation_version > 0),
 UNIQUE(project_id, idempotency_key)
);
CREATE TABLE jobs (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES runs(id), step_key text NOT NULL CHECK (length(trim(step_key)) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','cancelled','interrupted')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
 checkpoint_version integer NOT NULL DEFAULT 0 CHECK (checkpoint_version >= 0),
 checkpoint jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(checkpoint) = 'object'),
 last_heartbeat_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id, step_key)
);
CREATE TABLE schedules (
 id text PRIMARY KEY, automation_id text NOT NULL REFERENCES automations(id),
 kind text NOT NULL CHECK (kind IN ('once','cron')), expression text, run_at timestamptz,
 timezone text NOT NULL DEFAULT 'Africa/Accra', enabled boolean NOT NULL DEFAULT false,
 next_run_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind = 'once' AND run_at IS NOT NULL AND expression IS NULL) OR (kind = 'cron' AND expression IS NOT NULL AND run_at IS NULL))
);
CREATE TABLE agents (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES runs(id), role text NOT NULL,
 provider_id text, model_id text, status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','working','completed','failed','dismissed')),
 permissions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(permissions) = 'array'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE artifacts (
 id text PRIMARY KEY, project_id text NOT NULL REFERENCES projects(id), run_id text,
 storage_uri text NOT NULL CHECK (length(storage_uri) > 0), name text NOT NULL, media_type text NOT NULL,
 sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'), size_bytes bigint CHECK (size_bytes >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Artifact bytes stay in file/object storage; only their location and metadata live here.
CREATE TABLE memories (
 id text PRIMARY KEY, project_id text REFERENCES projects(id), kind text NOT NULL,
 content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'), source_artifact_id text REFERENCES artifacts(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE, id text PRIMARY KEY,
 project_id text REFERENCES projects(id), run_id text REFERENCES runs(id),
 kind text NOT NULL, entity_id text NOT NULL, payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload) = 'object'),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
 id text PRIMARY KEY, event_id text REFERENCES events(id), channel text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','dismissed')),
 content jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(content) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE model_usage (
 id text PRIMARY KEY, run_id text REFERENCES runs(id), agent_id text REFERENCES agents(id),
 provider_id text NOT NULL, model_id text NOT NULL,
 input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0), output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
 -- Record observed charges honestly, even if a future adapter violates the spending policy.
 cost_usd numeric(16,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE model_performance (
 id text PRIMARY KEY, usage_id text REFERENCES model_usage(id), capability text NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('succeeded','failed','needs-review')),
 duration_ms bigint CHECK (duration_ms >= 0), human_corrected boolean,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tool_registry (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, adapter_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false, capabilities jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(capabilities) = 'array'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE approvals (
 id text PRIMARY KEY, run_id text REFERENCES runs(id), action text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired')),
 requested_details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(requested_details) = 'object'),
 decided_by text, decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status IN ('approved','denied') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR (status IN ('pending','expired') AND decided_by IS NULL AND decided_at IS NULL))
);
CREATE TABLE system_settings (
 key text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 100), value jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO system_settings (key, value) VALUES ('cost_policy', '"ZERO_ONLY"'), ('execution_enabled', 'false'), ('default_timezone', '"Africa/Accra"');

ALTER TABLE runs ADD UNIQUE(id, project_id);
ALTER TABLE artifacts ADD FOREIGN KEY (run_id, project_id) REFERENCES runs(id, project_id);
CREATE INDEX automations_project_idx ON automations(project_id);
CREATE INDEX runs_project_created_idx ON runs(project_id, created_at DESC);
CREATE INDEX runs_status_idx ON runs(status) WHERE status IN ('queued','running','interrupted');
CREATE INDEX jobs_run_idx ON jobs(run_id);
CREATE INDEX events_project_sequence_idx ON events(project_id, sequence DESC);
CREATE INDEX events_run_sequence_idx ON events(run_id, sequence DESC);
CREATE INDEX schedules_due_idx ON schedules(next_run_at) WHERE enabled;
CREATE INDEX artifacts_project_idx ON artifacts(project_id);
CREATE INDEX memories_project_idx ON memories(project_id);

CREATE FUNCTION leeos_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;
CREATE FUNCTION leeos_immutable_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'LeeOS IDs are permanent'; END IF; RETURN NEW; END $$;
CREATE FUNCTION leeos_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'LeeOS events are append-only'; END $$;
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
ALTER TABLE projects ADD CONSTRAINT projects_id_format CHECK (id ~ '^proj_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER projects_immutable_id BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE automations ADD CONSTRAINT automations_id_format CHECK (id ~ '^auto_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER automations_immutable_id BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE runs ADD CONSTRAINT runs_id_format CHECK (id ~ '^run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER runs_immutable_id BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE jobs ADD CONSTRAINT jobs_id_format CHECK (id ~ '^job_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER jobs_immutable_id BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE schedules ADD CONSTRAINT schedules_id_format CHECK (id ~ '^sched_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER schedules_immutable_id BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE agents ADD CONSTRAINT agents_id_format CHECK (id ~ '^agent_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER agents_immutable_id BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE memories ADD CONSTRAINT memories_id_format CHECK (id ~ '^mem_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER memories_immutable_id BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE artifacts ADD CONSTRAINT artifacts_id_format CHECK (id ~ '^file_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER artifacts_immutable_id BEFORE UPDATE ON artifacts FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE events ADD CONSTRAINT events_id_format CHECK (id ~ '^evt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
ALTER TABLE notifications ADD CONSTRAINT notifications_id_format CHECK (id ~ '^notif_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER notifications_immutable_id BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE model_usage ADD CONSTRAINT model_usage_id_format CHECK (id ~ '^usage_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER model_usage_immutable_id BEFORE UPDATE ON model_usage FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE model_performance ADD CONSTRAINT model_performance_id_format CHECK (id ~ '^perf_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER model_performance_immutable_id BEFORE UPDATE ON model_performance FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE tool_registry ADD CONSTRAINT tool_registry_id_format CHECK (id ~ '^tool_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER tool_registry_immutable_id BEFORE UPDATE ON tool_registry FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
ALTER TABLE approvals ADD CONSTRAINT approvals_id_format CHECK (id ~ '^appr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
CREATE TRIGGER approvals_immutable_id BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER runs_updated_at BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER memories_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER tool_registry_updated_at BEFORE UPDATE ON tool_registry FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE TRIGGER system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();

ALTER TABLE events ADD CHECK (run_id IS NULL OR project_id IS NOT NULL);
ALTER TABLE events ADD FOREIGN KEY (run_id, project_id) REFERENCES runs(id, project_id);
ALTER TABLE agents ADD UNIQUE(id, run_id);
ALTER TABLE model_usage ADD CHECK (agent_id IS NULL OR run_id IS NOT NULL);
ALTER TABLE model_usage ADD FOREIGN KEY (agent_id, run_id) REFERENCES agents(id, run_id);
ALTER TABLE system_settings ADD CHECK (key <> 'cost_policy' OR value = '"ZERO_ONLY"'::jsonb);
