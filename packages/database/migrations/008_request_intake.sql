CREATE TABLE intake_requests (
 id text PRIMARY KEY CHECK(id ~ '^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 project_id text NOT NULL REFERENCES projects(id),
 request_key text NOT NULL,
 source_text text NOT NULL CHECK(length(source_text) BETWEEN 1 AND 4000 AND octet_length(source_text)<=8192),
 creation_input jsonb NOT NULL CHECK(jsonb_typeof(creation_input)='object'),
 status text NOT NULL CHECK(status IN ('needs-clarification','draft','approved','cancelled')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 proposal_version integer NOT NULL DEFAULT 0 CHECK(proposal_version>=0 AND proposal_version<=version),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,request_key),UNIQUE(id,project_id)
);
CREATE TABLE intake_revisions (
 request_id text NOT NULL REFERENCES intake_requests(id),
 version integer NOT NULL CHECK(version>=0),
 proposal jsonb NOT NULL CHECK(jsonb_typeof(proposal)='object' AND (proposal->>'costPolicy'='ZERO_ONLY') IS TRUE
  AND (proposal->'executionEnabled'='false'::jsonb) IS TRUE AND jsonb_typeof(proposal->'questions')='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(request_id,version)
);
ALTER TABLE intake_requests ADD FOREIGN KEY(id,proposal_version) REFERENCES intake_revisions(request_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE intake_approvals (
 request_id text PRIMARY KEY,
 project_id text NOT NULL,
 run_id text NOT NULL UNIQUE,
 input jsonb NOT NULL CHECK(jsonb_typeof(input)='object'),
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object' AND (receipt->'executionEnabled'='false'::jsonb) IS TRUE
  AND (receipt->>'costPolicy'='ZERO_ONLY') IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(request_id,project_id) REFERENCES intake_requests(id,project_id),
 FOREIGN KEY(run_id,project_id) REFERENCES runs(id,project_id)
);
CREATE INDEX intake_requests_project_idx ON intake_requests(project_id,id);
CREATE TRIGGER intake_revisions_immutable BEFORE UPDATE OR DELETE ON intake_revisions FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER intake_approvals_immutable BEFORE UPDATE OR DELETE ON intake_approvals FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER intake_requests_touch BEFORE UPDATE ON intake_requests FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE FUNCTION leeos_intake_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Request history cannot be deleted'; END IF;
 IF (NEW.id,NEW.project_id,NEW.request_key,NEW.source_text,NEW.creation_input,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.project_id,OLD.request_key,OLD.source_text,OLD.creation_input,OLD.created_at)
 OR OLD.status IN ('approved','cancelled') OR NEW.version<>OLD.version+1
 THEN RAISE EXCEPTION 'Request identity is immutable; only versioned draft transitions are allowed'; END IF;
 IF NEW.status IN ('approved','cancelled') THEN
  IF NEW.proposal_version<>OLD.proposal_version THEN RAISE EXCEPTION 'Terminal transition must preserve the reviewed proposal'; END IF;
 ELSIF NEW.proposal_version<>NEW.version THEN RAISE EXCEPTION 'Draft edits require a matching proposal revision';
 END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER intake_requests_boundary BEFORE UPDATE OR DELETE ON intake_requests FOR EACH ROW EXECUTE FUNCTION leeos_intake_boundary();
