-- Accepted, immutable work. No worker claims, leases, dispatch or attempts.
ALTER TABLE run_plans ADD UNIQUE(run_id,run_version);
CREATE TABLE execution_envelopes (
 id text PRIMARY KEY CHECK(id ~ '^env_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 run_id text NOT NULL UNIQUE,project_id text NOT NULL,
 requirements_id text NOT NULL,requirements_revision integer NOT NULL,requirements_digest text NOT NULL,
 plan_run_version integer NOT NULL CHECK(plan_run_version>=0),plan_digest text NOT NULL CHECK(plan_digest ~ '^[a-f0-9]{64}$'),
 request_key text NOT NULL,request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 envelope jsonb NOT NULL CHECK(jsonb_typeof(envelope)='object'),digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 grant_expires_at timestamptz NOT NULL,authority text NOT NULL DEFAULT 'local-owner' CHECK(authority='local-owner'),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,run_id),UNIQUE(run_id,request_key),
 FOREIGN KEY(run_id,project_id) REFERENCES runs(id,project_id),
 FOREIGN KEY(run_id,requirements_id,requirements_revision) REFERENCES run_requirements(run_id,requirements_id,revision),
 FOREIGN KEY(requirements_id,requirements_revision,requirements_digest) REFERENCES requirements_reviews(requirements_id,revision,digest),
 FOREIGN KEY(run_id,plan_run_version) REFERENCES run_plans(run_id,run_version),
 CHECK((envelope->>'schemaVersion'='1') IS TRUE AND (envelope#>>'{run,id}'=run_id) IS TRUE
  AND (envelope#>>'{contract,id}'=requirements_id) IS TRUE
  AND ((envelope#>>'{contract,revision}')::integer=requirements_revision) IS TRUE
  AND (envelope#>>'{contract,digest}'=requirements_digest) IS TRUE
  AND (envelope#>>'{routing,planDigest}'=plan_digest) IS TRUE
  AND (envelope#>>'{costPolicy,policy}'='ZERO_ONLY') IS TRUE
  AND (envelope#>'{costPolicy,maxSpendUsd}'='0'::jsonb) IS TRUE
  AND (envelope#>'{costPolicy,paidFallbackEnabled}'='false'::jsonb) IS TRUE
  AND (envelope#>'{dispatch,enabledAtAcceptance}'='false'::jsonb) IS TRUE
  AND (envelope#>>'{authorization,authority}'='local-owner') IS TRUE
  AND ((envelope#>>'{authorization,expiresAt}')::timestamptz=grant_expires_at) IS TRUE)
);
CREATE TABLE execution_envelope_revocations (
 envelope_id text PRIMARY KEY,run_id text NOT NULL,request jsonb NOT NULL,
 authority text NOT NULL DEFAULT 'local-owner' CHECK(authority='local-owner'),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(envelope_id,run_id) REFERENCES execution_envelopes(id,run_id)
);
CREATE TRIGGER execution_envelopes_immutable BEFORE UPDATE OR DELETE ON execution_envelopes FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER execution_envelope_revocations_immutable BEFORE UPDATE OR DELETE ON execution_envelope_revocations FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE INDEX execution_envelopes_project_idx ON execution_envelopes(project_id,id);
