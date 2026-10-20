-- Mutable ownership is separate from immutable authorization and claim history.
CREATE TABLE envelope_work (
 envelope_id text PRIMARY KEY,run_id text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','waiting-human','recovery-required','succeeded','failed','cancelled','expired')),
 fence bigint NOT NULL DEFAULT 0 CHECK(fence>=0),worker_id text,lease_expires_at timestamptz,
 available_at timestamptz NOT NULL DEFAULT now(),reason text,updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(envelope_id,run_id) REFERENCES execution_envelopes(id,run_id),
 CHECK((state='running')=(worker_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
 CHECK(state='running' OR (worker_id IS NULL AND lease_expires_at IS NULL))
);
CREATE TABLE envelope_claims (
 envelope_id text NOT NULL REFERENCES envelope_work(envelope_id),fence bigint NOT NULL CHECK(fence>0),
 worker_id text NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(envelope_id,fence)
);
CREATE TABLE envelope_operations (
 envelope_id text NOT NULL,run_id text NOT NULL,operation_key text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('text.generate','owner.review')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reserved','dispatched','succeeded','failed','uncertain','discarded')),
 call_id text UNIQUE REFERENCES provider_calls(id),dispatch_fence bigint,result_fence bigint,
 resolved_request jsonb,output_text text,error_code text,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(envelope_id,operation_key),UNIQUE(envelope_id,operation_key,run_id),
 FOREIGN KEY(envelope_id,run_id) REFERENCES execution_envelopes(id,run_id),
 FOREIGN KEY(envelope_id,dispatch_fence) REFERENCES envelope_claims(envelope_id,fence),
 FOREIGN KEY(envelope_id,result_fence) REFERENCES envelope_claims(envelope_id,fence),
 CHECK(call_id IS NULL OR (kind='text.generate' AND resolved_request IS NOT NULL AND dispatch_fence IS NOT NULL))
);
CREATE TABLE envelope_reviews (
 envelope_id text NOT NULL,operation_key text NOT NULL,run_id text NOT NULL,
 request jsonb NOT NULL,authority text NOT NULL DEFAULT 'local-owner' CHECK(authority='local-owner'),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(envelope_id,operation_key),FOREIGN KEY(envelope_id,operation_key,run_id) REFERENCES envelope_operations(envelope_id,operation_key,run_id)
);
CREATE TRIGGER envelope_claims_immutable BEFORE UPDATE OR DELETE ON envelope_claims FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER envelope_reviews_immutable BEFORE UPDATE OR DELETE ON envelope_reviews FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE FUNCTION leeos_envelope_operation_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Operation history cannot be deleted'; END IF;
 IF (NEW.envelope_id,NEW.run_id,NEW.operation_key,NEW.kind) IS DISTINCT FROM (OLD.envelope_id,OLD.run_id,OLD.operation_key,OLD.kind)
 OR OLD.state IN ('succeeded','failed','uncertain','discarded')
 OR (OLD.call_id IS NOT NULL AND (NEW.call_id,NEW.resolved_request) IS DISTINCT FROM (OLD.call_id,OLD.resolved_request))
 OR (OLD.call_id IS NOT NULL AND NEW.dispatch_fence IS DISTINCT FROM OLD.dispatch_fence AND NOT(OLD.state='reserved' AND NEW.state='reserved'))
 THEN RAISE EXCEPTION 'Operation identity and terminal facts are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER envelope_operation_boundary BEFORE UPDATE OR DELETE ON envelope_operations FOR EACH ROW EXECUTE FUNCTION leeos_envelope_operation_boundary();
-- Existing accepted work is discoverable without resubmission, including work
-- that will subsequently be classified expired/cancelled by the worker gates.
INSERT INTO envelope_work(envelope_id,run_id) SELECT id,run_id FROM execution_envelopes;
CREATE INDEX envelope_work_due_idx ON envelope_work(state,available_at,envelope_id);
CREATE FUNCTION leeos_envelope_work_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Durable work cannot be deleted'; END IF;
 IF (NEW.envelope_id,NEW.run_id) IS DISTINCT FROM (OLD.envelope_id,OLD.run_id) OR NEW.fence<OLD.fence OR NEW.fence>OLD.fence+1
 OR (NEW.fence<>OLD.fence AND (NEW.state<>'running' OR NEW.worker_id IS NULL))
 OR (NEW.worker_id IS NOT NULL AND NEW.worker_id IS DISTINCT FROM OLD.worker_id AND NEW.fence=OLD.fence)
 THEN RAISE EXCEPTION 'Invalid work identity or fencing transition'; END IF; RETURN NEW; END $$;
CREATE TRIGGER envelope_work_boundary BEFORE UPDATE OR DELETE ON envelope_work FOR EACH ROW EXECUTE FUNCTION leeos_envelope_work_boundary();

-- Machine evidence may now reference a scoped, persisted envelope result.
ALTER TABLE acceptance_evidence ADD COLUMN source_envelope_id text;
ALTER TABLE acceptance_evidence ADD COLUMN source_operation_key text;
ALTER TABLE acceptance_evidence ADD FOREIGN KEY(source_envelope_id,source_operation_key,run_id) REFERENCES envelope_operations(envelope_id,operation_key,run_id);
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_check;
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_authority_check;
ALTER TABLE acceptance_evidence ADD CHECK(authority IN ('local-owner','envelope-worker'));
ALTER TABLE acceptance_evidence ADD CHECK(
 (kind='owner-review' AND source_job_id IS NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL)
 OR (kind='job-result' AND ((source_job_id IS NOT NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL)
 OR (source_job_id IS NULL AND source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL))));
