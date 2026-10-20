-- P1.1: bind immutable artifact metadata to durable PostgreSQL bytes.
-- Legacy external-reference rows remain metadata-only and are not upgraded into files.
ALTER TABLE artifacts ADD COLUMN storage_backend text NOT NULL DEFAULT 'external-reference'
 CHECK(storage_backend IN ('external-reference','postgres-bytea'));
ALTER TABLE artifacts ADD COLUMN creator text NOT NULL DEFAULT 'legacy'
 CHECK(creator IN ('legacy','owner-api','envelope-worker'));
ALTER TABLE artifacts ADD COLUMN idempotency_key text
 CHECK(idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9._:-]{1,200}$');
ALTER TABLE artifacts ADD COLUMN request_fingerprint text
 CHECK(request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE artifacts ADD COLUMN source_envelope_id text;
ALTER TABLE artifacts ADD COLUMN source_fence bigint CHECK(source_fence IS NULL OR source_fence>0);
ALTER TABLE artifacts ADD CONSTRAINT artifacts_project_id_id_unique UNIQUE(project_id,id);
ALTER TABLE artifacts ADD CONSTRAINT artifacts_source_envelope_run_fk
 FOREIGN KEY(source_envelope_id,run_id) REFERENCES execution_envelopes(id,run_id);
ALTER TABLE artifacts ADD CONSTRAINT artifacts_source_envelope_fence_fk
 FOREIGN KEY(source_envelope_id,source_fence) REFERENCES envelope_claims(envelope_id,fence);
ALTER TABLE artifacts ADD CONSTRAINT artifacts_storage_record_check CHECK(
 (storage_backend='external-reference' AND creator='legacy')
 OR (storage_backend='postgres-bytea' AND creator IN ('owner-api','envelope-worker')
     AND idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL
     AND sha256 IS NOT NULL AND size_bytes IS NOT NULL
     AND ((creator='owner-api' AND source_envelope_id IS NULL AND source_fence IS NULL)
       OR (creator='envelope-worker' AND source_envelope_id IS NOT NULL AND source_fence IS NOT NULL))
     AND storage_uri=('leeos-artifact://postgres-bytea/' || id))
);
CREATE UNIQUE INDEX artifacts_project_idempotency_idx ON artifacts(project_id,idempotency_key)
 WHERE idempotency_key IS NOT NULL;
CREATE INDEX artifacts_project_created_id_idx ON artifacts(project_id,created_at DESC,id DESC)
 WHERE storage_backend='postgres-bytea';

CREATE TABLE artifact_blobs(
 artifact_id text PRIMARY KEY,
 project_id text NOT NULL,
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 10485760),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,artifact_id) REFERENCES artifacts(project_id,id)
);

CREATE FUNCTION leeos_artifact_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.storage_backend='postgres-bytea' THEN RAISE EXCEPTION 'Stored artifact metadata is immutable'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.storage_backend='postgres-bytea' OR NEW.storage_backend='postgres-bytea' THEN
  RAISE EXCEPTION 'Stored artifact metadata is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER artifact_immutable BEFORE UPDATE OR DELETE ON artifacts
 FOR EACH ROW EXECUTE FUNCTION leeos_artifact_immutable();

CREATE FUNCTION leeos_artifact_blob_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM artifacts a WHERE a.id=NEW.artifact_id AND a.project_id=NEW.project_id
   AND a.storage_backend='postgres-bytea') THEN
  RAISE EXCEPTION 'Artifact bytes require a matching PostgreSQL-backed artifact';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER artifact_blob_insert_guard BEFORE INSERT ON artifact_blobs
 FOR EACH ROW EXECUTE FUNCTION leeos_artifact_blob_insert_guard();

CREATE FUNCTION leeos_artifact_blob_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Stored artifact bytes are immutable'; END $$;
CREATE TRIGGER artifact_blob_immutable BEFORE UPDATE OR DELETE ON artifact_blobs
 FOR EACH ROW EXECUTE FUNCTION leeos_artifact_blob_immutable();

CREATE FUNCTION leeos_artifact_requires_bytes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.storage_backend='postgres-bytea' AND NOT EXISTS(
  SELECT 1 FROM artifact_blobs b WHERE b.artifact_id=NEW.id AND b.project_id=NEW.project_id
   AND octet_length(b.content)=NEW.size_bytes
 ) THEN
  RAISE EXCEPTION 'PostgreSQL-backed artifact metadata requires matching durable bytes';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER artifact_requires_bytes AFTER INSERT OR UPDATE ON artifacts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION leeos_artifact_requires_bytes();
