-- P0.1: reviewed outcome contracts and acceptance evidence; no execution permission.
CREATE TABLE requirements_documents (
 id text PRIMARY KEY CHECK(id ~ '^reqs_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 project_id text NOT NULL REFERENCES projects(id),
 current_revision integer NOT NULL DEFAULT 1 CHECK(current_revision>0),
 request_key text NOT NULL,creation_input jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,request_key),UNIQUE(id,project_id)
);
CREATE TABLE requirements_revisions (
 requirements_id text NOT NULL REFERENCES requirements_documents(id),revision integer NOT NULL CHECK(revision>0),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND (content->>'costPolicy'='ZERO_ONLY') IS TRUE),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requirements_id,revision),UNIQUE(requirements_id,revision,digest)
);
ALTER TABLE requirements_documents ADD FOREIGN KEY(id,current_revision) REFERENCES requirements_revisions(requirements_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE requirements_reviews (
 requirements_id text NOT NULL,revision integer NOT NULL,digest text NOT NULL,
 authority text NOT NULL DEFAULT 'local-owner' CHECK(authority='local-owner'),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(requirements_id,revision),FOREIGN KEY(requirements_id,revision,digest) REFERENCES requirements_revisions(requirements_id,revision,digest),UNIQUE(requirements_id,revision,digest)
);
CREATE TABLE run_requirements (
 run_id text PRIMARY KEY,project_id text NOT NULL,requirements_id text NOT NULL,revision integer NOT NULL,digest text NOT NULL,
 request jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,project_id) REFERENCES runs(id,project_id),
 FOREIGN KEY(requirements_id,project_id) REFERENCES requirements_documents(id,project_id),
 FOREIGN KEY(requirements_id,revision,digest) REFERENCES requirements_reviews(requirements_id,revision,digest),
 UNIQUE(run_id,requirements_id,revision)
);
CREATE TABLE acceptance_evidence (
 id text PRIMARY KEY CHECK(id ~ '^evid_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 run_id text NOT NULL,requirements_id text NOT NULL,revision integer NOT NULL,criterion_id text NOT NULL,
 version integer NOT NULL CHECK(version>0),request_key text NOT NULL,request jsonb NOT NULL,
 kind text NOT NULL CHECK(kind IN ('owner-review','job-result')),outcome text NOT NULL CHECK(outcome IN ('met','not-met')),
 source_job_id text,details jsonb NOT NULL,authority text NOT NULL DEFAULT 'local-owner' CHECK(authority='local-owner'),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(run_id,criterion_id,version),UNIQUE(run_id,request_key),
 FOREIGN KEY(run_id,requirements_id,revision) REFERENCES run_requirements(run_id,requirements_id,revision),
 FOREIGN KEY(source_job_id,run_id) REFERENCES prepared_jobs(job_id,run_id),
 CHECK((kind='owner-review' AND source_job_id IS NULL) OR (kind='job-result' AND source_job_id IS NOT NULL))
);
CREATE FUNCTION leeos_requirements_document_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Requirements history cannot be deleted'; END IF;
 IF (NEW.id,NEW.project_id,NEW.request_key,NEW.creation_input,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.project_id,OLD.request_key,OLD.creation_input,OLD.created_at)
 OR NEW.current_revision<>OLD.current_revision+1 THEN RAISE EXCEPTION 'Requirements identity is immutable; revision must advance once'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER requirements_document_boundary BEFORE UPDATE OR DELETE ON requirements_documents FOR EACH ROW EXECUTE FUNCTION leeos_requirements_document_boundary();
CREATE TRIGGER requirements_revisions_immutable BEFORE UPDATE OR DELETE ON requirements_revisions FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER requirements_reviews_immutable BEFORE UPDATE OR DELETE ON requirements_reviews FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER run_requirements_immutable BEFORE UPDATE OR DELETE ON run_requirements FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER acceptance_evidence_immutable BEFORE UPDATE OR DELETE ON acceptance_evidence FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE INDEX requirements_project_idx ON requirements_documents(project_id,id);
CREATE INDEX acceptance_run_idx ON acceptance_evidence(run_id,criterion_id,version DESC);
