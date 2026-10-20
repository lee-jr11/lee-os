-- P1.3: email is an external effect. Its durable identity and attempt receipt
-- are committed before any provider request is made.
ALTER TABLE envelope_operations DROP CONSTRAINT envelope_operations_kind_check;
ALTER TABLE envelope_operations ADD CHECK(kind IN ('text.generate','owner.review','docx.generate','email.send'));
ALTER TABLE envelope_work DROP CONSTRAINT envelope_work_state_check;
ALTER TABLE envelope_work ADD CHECK(state IN ('queued','running','waiting-human','waiting-external','recovery-required','succeeded','failed','cancelled','expired'));

CREATE TABLE external_effects (
 effect_id text PRIMARY KEY CHECK(effect_id ~ '^eff_[A-Za-z0-9_-]{1,80}$'),
 envelope_id text NOT NULL,run_id text NOT NULL,operation_key text NOT NULL,
 provider_id text NOT NULL CHECK(provider_id='resend'),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 1 AND 256),
 request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 recipient_hash text NOT NULL CHECK(recipient_hash ~ '^[a-f0-9]{64}$'),
 source_fence bigint NOT NULL CHECK(source_fence>0),
 state text NOT NULL CHECK(state IN ('attempted','accepted','delivered','failed','unknown')),
 provider_reference text CHECK(provider_reference IS NULL OR length(provider_reference) BETWEEN 1 AND 200),
 idempotency_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(envelope_id,operation_key),UNIQUE(effect_id,envelope_id,operation_key,run_id),
 FOREIGN KEY(envelope_id,operation_key,run_id) REFERENCES envelope_operations(envelope_id,operation_key,run_id),
 FOREIGN KEY(envelope_id,source_fence) REFERENCES envelope_claims(envelope_id,fence)
);
ALTER TABLE envelope_operations ADD COLUMN output_effect_id text;
ALTER TABLE envelope_operations ADD FOREIGN KEY(output_effect_id) REFERENCES external_effects(effect_id);
ALTER TABLE envelope_operations ADD UNIQUE(output_effect_id);
ALTER TABLE envelope_operations DROP CONSTRAINT envelope_operations_check;
ALTER TABLE envelope_operations ADD CHECK(
 (kind='docx.generate' AND output_effect_id IS NULL AND
   ((state='succeeded' AND output_artifact_id IS NOT NULL AND output_sha256 IS NOT NULL AND output_validation IS NOT NULL)
   OR (state<>'succeeded' AND output_artifact_id IS NULL AND output_sha256 IS NULL AND output_validation IS NULL)))
 OR (kind='email.send' AND output_artifact_id IS NULL AND output_sha256 IS NULL AND output_validation IS NULL
   AND ((state IN ('pending','reserved','dispatched') AND (output_effect_id IS NULL OR output_effect_id IS NOT NULL))
    OR state='failed'
    OR (state='uncertain' AND output_effect_id IS NOT NULL)
    OR (state='succeeded' AND output_effect_id IS NOT NULL)))
 OR (kind NOT IN ('docx.generate','email.send') AND output_artifact_id IS NULL AND output_sha256 IS NULL AND output_validation IS NULL AND output_effect_id IS NULL)
);

CREATE TABLE external_effect_receipts (
 receipt_id text PRIMARY KEY CHECK(receipt_id ~ '^effrcpt_[0-9a-f-]{36}$'),
 effect_id text NOT NULL REFERENCES external_effects(effect_id),receipt_key text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('attempted','accepted','delivered','failed','unknown')),
 provider_event_id text,provider_reference text,source_envelope_id text,source_fence bigint,
 details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(effect_id,receipt_key),UNIQUE(provider_event_id),
 FOREIGN KEY(source_envelope_id,source_fence) REFERENCES envelope_claims(envelope_id,fence)
);

CREATE FUNCTION leeos_external_effect_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'External effect identities cannot be deleted'; END IF;
 IF (NEW.effect_id,NEW.envelope_id,NEW.run_id,NEW.operation_key,NEW.provider_id,NEW.idempotency_key,NEW.request_digest,NEW.request,NEW.recipient_hash,NEW.source_fence,NEW.idempotency_expires_at,NEW.created_at)
   IS DISTINCT FROM (OLD.effect_id,OLD.envelope_id,OLD.run_id,OLD.operation_key,OLD.provider_id,OLD.idempotency_key,OLD.request_digest,OLD.request,OLD.recipient_hash,OLD.source_fence,OLD.idempotency_expires_at,OLD.created_at)
   OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS DISTINCT FROM OLD.provider_reference)
 THEN RAISE EXCEPTION 'External effect identity is immutable'; END IF;
 IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
   (OLD.state='attempted' AND NEW.state IN ('accepted','failed','unknown')) OR
   (OLD.state='accepted' AND NEW.state IN ('delivered','failed','unknown')) OR
   (OLD.state='unknown' AND NEW.state IN ('accepted','delivered','failed'))
 ) THEN RAISE EXCEPTION 'Invalid external effect state transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER external_effect_boundary BEFORE UPDATE OR DELETE ON external_effects FOR EACH ROW EXECUTE FUNCTION leeos_external_effect_boundary();
CREATE TRIGGER external_effect_receipts_immutable BEFORE UPDATE OR DELETE ON external_effect_receipts FOR EACH ROW EXECUTE FUNCTION leeos_append_only();

-- Signed provider events are deduplicated by Svix ID before they can change
-- effect state. Only the minimal metadata needed for confirmation is retained.
CREATE TABLE external_effect_webhook_receipts (
 provider_event_id text PRIMARY KEY CHECK(length(provider_event_id) BETWEEN 1 AND 200),
 effect_id text NOT NULL REFERENCES external_effects(effect_id),event_type text NOT NULL CHECK(event_type IN ('email.sent','email.delivered','email.bounced','email.failed')),
 recipient_hash text NOT NULL CHECK(recipient_hash ~ '^[a-f0-9]{64}$'),provider_reference text NOT NULL CHECK(length(provider_reference) BETWEEN 1 AND 200),
 received_at timestamptz NOT NULL DEFAULT now(),UNIQUE(effect_id,provider_event_id)
);
CREATE TRIGGER external_effect_webhook_receipts_immutable BEFORE UPDATE OR DELETE ON external_effect_webhook_receipts FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE INDEX external_effects_state_idx ON external_effects(state,updated_at);
CREATE INDEX external_effect_webhook_effect_idx ON external_effect_webhook_receipts(effect_id,event_type);

-- Delivery evidence is produced only by a provider signed-delivery receipt
-- whose recipient digest and effect identity match this exact operation.
ALTER TABLE acceptance_evidence ADD COLUMN source_effect_id text;
ALTER TABLE acceptance_evidence ADD FOREIGN KEY(source_effect_id) REFERENCES external_effects(effect_id);
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_authority_check;
ALTER TABLE acceptance_evidence ADD CHECK(authority IN ('local-owner','envelope-worker','resend-webhook'));
ALTER TABLE acceptance_evidence DROP CONSTRAINT acceptance_evidence_check;
ALTER TABLE acceptance_evidence ADD CHECK(
 (kind='owner-review' AND source_job_id IS NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL AND source_artifact_id IS NULL AND source_fence IS NULL AND source_effect_id IS NULL)
 OR (kind='job-result' AND source_artifact_id IS NULL AND source_fence IS NULL AND source_effect_id IS NULL AND
   ((source_job_id IS NOT NULL AND source_envelope_id IS NULL AND source_operation_key IS NULL)
   OR (source_job_id IS NULL AND source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL)))
 OR (kind IN ('document-validation','artifact-registration') AND source_job_id IS NULL AND source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL AND source_artifact_id IS NOT NULL AND source_fence IS NOT NULL AND source_effect_id IS NULL AND authority='envelope-worker')
 OR (kind='delivery-confirmation' AND source_job_id IS NULL AND source_envelope_id IS NOT NULL AND source_operation_key IS NOT NULL AND source_artifact_id IS NULL AND source_effect_id IS NOT NULL
   AND ((authority='resend-webhook' AND source_fence IS NULL) OR (authority='envelope-worker' AND source_fence IS NOT NULL)))
);

CREATE FUNCTION leeos_delivery_acceptance_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind<>'delivery-confirmation' THEN RETURN NEW; END IF;
 IF NEW.outcome NOT IN ('met','not-met') OR NOT EXISTS(
   SELECT 1 FROM external_effects e JOIN envelope_operations o ON o.envelope_id=e.envelope_id AND o.operation_key=e.operation_key AND o.run_id=e.run_id
   WHERE e.effect_id=NEW.source_effect_id AND e.run_id=NEW.run_id AND e.state=CASE WHEN NEW.outcome='met' THEN 'delivered' ELSE 'failed' END
    AND e.envelope_id=NEW.source_envelope_id AND e.operation_key=NEW.source_operation_key AND o.kind='email.send'
    AND o.state=CASE WHEN NEW.outcome='met' THEN 'succeeded' ELSE 'failed' END AND o.output_effect_id=e.effect_id
    AND ((NEW.outcome='met' AND NEW.authority='resend-webhook' AND EXISTS(
       SELECT 1 FROM external_effect_webhook_receipts w WHERE w.effect_id=e.effect_id AND w.event_type='email.delivered'
        AND w.recipient_hash=e.recipient_hash AND w.provider_reference=e.provider_reference))
     OR (NEW.outcome='not-met' AND NEW.authority='resend-webhook' AND EXISTS(
       SELECT 1 FROM external_effect_webhook_receipts w WHERE w.effect_id=e.effect_id AND w.event_type IN ('email.bounced','email.failed')
        AND w.recipient_hash=e.recipient_hash AND w.provider_reference=e.provider_reference))
     OR (NEW.outcome='not-met' AND NEW.authority='envelope-worker' AND EXISTS(
       SELECT 1 FROM external_effect_receipts r WHERE r.effect_id=e.effect_id AND r.kind='failed'
        AND r.source_envelope_id=NEW.source_envelope_id AND r.source_fence=NEW.source_fence)))
 ) THEN RAISE EXCEPTION 'Delivery evidence requires a matching provider recipient receipt'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_acceptance_evidence_guard BEFORE INSERT ON acceptance_evidence FOR EACH ROW EXECUTE FUNCTION leeos_delivery_acceptance_evidence_guard();
