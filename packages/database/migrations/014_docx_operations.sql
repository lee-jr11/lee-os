-- A document operation records a validated, durable artifact as its result.
ALTER TABLE envelope_operations DROP CONSTRAINT envelope_operations_kind_check;
ALTER TABLE envelope_operations ADD CHECK(kind IN ('text.generate','owner.review','docx.generate'));
ALTER TABLE artifacts ADD CONSTRAINT artifacts_id_run_id_unique UNIQUE(id,run_id);
ALTER TABLE envelope_operations ADD COLUMN output_artifact_id text;
ALTER TABLE envelope_operations ADD COLUMN output_sha256 text CHECK(output_sha256 IS NULL OR output_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE envelope_operations ADD COLUMN output_validation jsonb;
ALTER TABLE envelope_operations ADD FOREIGN KEY(output_artifact_id,run_id) REFERENCES artifacts(id,run_id);
ALTER TABLE envelope_operations ADD CHECK(
 (kind<>'docx.generate' AND output_artifact_id IS NULL AND output_sha256 IS NULL AND output_validation IS NULL)
 OR (kind='docx.generate' AND call_id IS NULL AND
   ((state='succeeded' AND output_artifact_id IS NOT NULL AND output_sha256 IS NOT NULL AND output_validation IS NOT NULL)
   OR (state<>'succeeded' AND output_artifact_id IS NULL AND output_sha256 IS NULL AND output_validation IS NULL)))
);

-- P0.1 machine evidence is now bound to a validated DOCX and its artifact.
ALTER TABLE acceptance_evidence ADD COLUMN source_artifact_id text;
ALTER TABLE acceptance_evidence ADD COLUMN source_fence bigint CHECK(source_fence IS NULL OR source_fence>0);
ALTER TABLE acceptance_evidence ADD FOREIGN KEY(source_artifact_id,run_id) REFERENCES artifacts(id,run_id);
ALTER TABLE acceptance_evidence ADD FOREIGN KEY(source_envelope_id,source_fence) REFERENCES envelope_claims(envelope_id,fence);
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_kind_check;
ALTER TABLE acceptance_evidence ADD CHECK(kind IN ('owner-review','job-result','document-validation','artifact-registration','delivery-confirmation'));
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_check;
ALTER TABLE acceptance_evidence ADD CHECK(
 (kind='owner-review' AND source_job_id IS NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL AND source_artifact_id IS NULL AND source_fence IS NULL)
 OR (kind='job-result' AND source_artifact_id IS NULL AND source_fence IS NULL AND
   ((source_job_id IS NOT NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL)
   OR (source_job_id IS NULL AND source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL)))
 OR (kind IN ('document-validation','artifact-registration') AND source_job_id IS NULL AND
   source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL AND source_artifact_id IS NOT NULL AND source_fence IS NOT NULL AND authority='envelope-worker')
);

CREATE FUNCTION leeos_docx_acceptance_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE artifact artifacts%ROWTYPE;
BEGIN
 IF NEW.kind NOT IN ('document-validation','artifact-registration') THEN RETURN NEW; END IF;
 SELECT * INTO artifact FROM artifacts WHERE id=NEW.source_artifact_id AND run_id=NEW.run_id;
 IF NOT FOUND OR artifact.storage_backend<>'postgres-bytea' OR artifact.creator<>'envelope-worker'
   OR artifact.source_envelope_id<>NEW.source_envelope_id
   OR artifact.media_type IS DISTINCT FROM 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN
  RAISE EXCEPTION 'Document evidence requires its stored worker artifact';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM envelope_operations o JOIN envelope_work w ON w.envelope_id=o.envelope_id
   JOIN execution_envelopes e ON e.id=o.envelope_id JOIN runs r ON r.id=o.run_id
   JOIN envelope_claims c ON c.envelope_id=o.envelope_id AND c.fence=NEW.source_fence
  WHERE o.envelope_id=NEW.source_envelope_id AND o.operation_key=NEW.source_operation_key
   AND o.run_id=NEW.run_id AND o.kind='docx.generate'
   AND w.state='running' AND w.fence=NEW.source_fence AND w.worker_id=c.worker_id
   AND w.lease_expires_at>clock_timestamp() AND e.grant_expires_at>clock_timestamp()
   AND r.status IN ('queued','running')
   AND NOT EXISTS(SELECT 1 FROM execution_envelope_revocations v WHERE v.envelope_id=e.id)
 ) THEN RAISE EXCEPTION 'Document evidence requires the current authorized worker fence'; END IF;
 IF NEW.kind='document-validation' AND (
   NEW.outcome IS DISTINCT FROM 'met' OR NEW.details->>'sha256' IS DISTINCT FROM artifact.sha256
   OR NEW.details->>'format' IS DISTINCT FROM 'docx' OR NEW.details->>'fontFamily' IS DISTINCT FROM 'Times New Roman'
   OR NEW.details->>'bodyFontSizePt' IS DISTINCT FROM '12' OR NEW.details->>'readable' IS DISTINCT FROM 'true'
   OR NEW.details->>'contentMatches' IS DISTINCT FROM 'true' OR NEW.details->>'bytes' IS DISTINCT FROM artifact.size_bytes::text
   OR NOT EXISTS(SELECT 1 FROM envelope_operations o WHERE o.envelope_id=NEW.source_envelope_id
     AND o.operation_key=NEW.source_operation_key AND o.run_id=NEW.run_id AND o.kind='docx.generate'
     AND o.state='succeeded' AND o.output_artifact_id=artifact.id AND o.output_sha256=artifact.sha256
     AND o.output_validation->>'sha256'=artifact.sha256 AND o.output_validation->>'bytes'=artifact.size_bytes::text AND o.output_validation->>'format'='docx'
     AND o.output_validation->>'fontFamily'='Times New Roman' AND o.output_validation->>'bodyFontSizePt'='12'
     AND o.output_validation->>'readable'='true' AND o.output_validation->>'contentMatches'='true')
 ) THEN RAISE EXCEPTION 'Document validation evidence does not match the stored DOCX'; END IF;
 IF NEW.kind='artifact-registration' AND (
   NEW.outcome IS DISTINCT FROM 'met' OR NEW.details->>'artifactId' IS DISTINCT FROM artifact.id
   OR NEW.details->>'sha256' IS DISTINCT FROM artifact.sha256
   OR NEW.details->>'sizeBytes' IS DISTINCT FROM artifact.size_bytes::text
   OR NEW.details->>'mediaType' IS DISTINCT FROM artifact.media_type
   OR NEW.details->>'storageBackend' IS DISTINCT FROM 'postgres-bytea'
   OR NEW.details->>'retrievalVerified' IS DISTINCT FROM 'true'
   OR NOT EXISTS(SELECT 1 FROM envelope_operations o WHERE o.envelope_id=NEW.source_envelope_id
     AND o.operation_key=NEW.source_operation_key AND o.run_id=NEW.run_id AND o.kind='docx.generate'
     AND o.state='succeeded' AND o.output_artifact_id=artifact.id AND o.output_sha256=artifact.sha256)
 ) THEN RAISE EXCEPTION 'Artifact evidence does not match stored bytes'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER docx_acceptance_evidence_guard BEFORE INSERT ON acceptance_evidence
 FOR EACH ROW EXECUTE FUNCTION leeos_docx_acceptance_evidence_guard();
