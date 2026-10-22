-- A definitive Gemini HTTP 503 is distinct from a lost response after dispatch.
ALTER TABLE provider_calls ADD COLUMN retryable boolean NOT NULL DEFAULT false;
ALTER TABLE provider_calls ADD CONSTRAINT provider_calls_retryable_check CHECK(
 NOT retryable OR (provider_id='gemini' AND status='failed' AND error_code='GEMINI_HTTP_503' AND recovery_required=false)
);

-- Each call identity is retained, including a bounded retry under one operation.
CREATE TABLE envelope_operation_attempts (
 envelope_id text NOT NULL,run_id text NOT NULL,operation_key text NOT NULL,
 attempt_number integer NOT NULL CHECK(attempt_number BETWEEN 1 AND 2),
 call_id text NOT NULL UNIQUE REFERENCES provider_calls(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(envelope_id,operation_key,attempt_number),
 UNIQUE(envelope_id,operation_key,call_id),
 FOREIGN KEY(envelope_id,operation_key,run_id) REFERENCES envelope_operations(envelope_id,operation_key,run_id)
);
INSERT INTO envelope_operation_attempts(envelope_id,run_id,operation_key,attempt_number,call_id)
 SELECT envelope_id,run_id,operation_key,1,call_id FROM envelope_operations WHERE call_id IS NOT NULL;
CREATE TRIGGER envelope_operation_attempts_immutable BEFORE UPDATE OR DELETE ON envelope_operation_attempts FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE FUNCTION leeos_envelope_operation_attempt_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM envelope_operations o JOIN provider_calls p ON p.id=NEW.call_id JOIN execution_envelopes e ON e.id=NEW.envelope_id
  WHERE o.envelope_id=NEW.envelope_id AND o.run_id=NEW.run_id AND o.operation_key=NEW.operation_key
   AND o.kind='text.generate' AND o.state='pending' AND o.call_id IS NULL
   AND p.request_key=CASE WHEN NEW.attempt_number=1 THEN NEW.envelope_id||':'||NEW.operation_key
      ELSE NEW.envelope_id||':'||NEW.operation_key||':attempt:'||NEW.attempt_number END
   AND NEW.attempt_number=COALESCE((SELECT max(a.attempt_number)+1 FROM envelope_operation_attempts a
      WHERE a.envelope_id=NEW.envelope_id AND a.operation_key=NEW.operation_key),1)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(e.envelope->'operations') authorized_op
    WHERE authorized_op->>'key'=NEW.operation_key AND (
     (NEW.attempt_number=1 AND e.envelope->'authorization'->>'maxAttempts'='1'
      AND authorized_op->>'implementationContractVersion' IN ('local-text-1','gemini-free-text-1')
      AND NOT (authorized_op ? 'providerRetryPolicy'))
     OR (authorized_op->>'implementationContractVersion'='gemini-free-text-2'
      AND authorized_op->'providerRetryPolicy'='{"maxProviderAttempts":2,"retryableReason":"GEMINI_HTTP_503","maxAutomaticRetries":1,"backoff":{"strategy":"exponential","baseDelayMs":5000,"maxDelayMs":30000},"revalidateBeforeRetry":{"costPolicy":"ZERO_ONLY","billing":true,"modelFingerprint":true},"retryCallIdentity":"new-durable-call-per-attempt","uncertainOutcome":"recovery-required-no-retry"}'::jsonb
      AND e.envelope->'authorization'->>'maxAttempts'='2'
      AND (NEW.attempt_number=1 OR NEW.attempt_number=2))
    ))
   AND (NEW.attempt_number=1 OR EXISTS(
    SELECT 1 FROM envelope_operation_attempts a JOIN provider_calls prior ON prior.id=a.call_id
    WHERE a.envelope_id=NEW.envelope_id AND a.operation_key=NEW.operation_key AND a.attempt_number=1
     AND prior.status='failed' AND prior.retryable=true AND prior.error_code='GEMINI_HTTP_503' AND prior.recovery_required=false
   ))
  ) THEN RAISE EXCEPTION 'Provider attempt identity or retry authorization is invalid'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER envelope_operation_attempt_insert_guard BEFORE INSERT ON envelope_operation_attempts FOR EACH ROW EXECUTE FUNCTION leeos_envelope_operation_attempt_insert_guard();

-- The current call may be detached only after a received, explicitly retryable
-- 503 on attempt one. All call identities remain in the append-only ledger.
CREATE OR REPLACE FUNCTION leeos_envelope_operation_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Operation history cannot be deleted'; END IF;
 IF (NEW.envelope_id,NEW.run_id,NEW.operation_key,NEW.kind) IS DISTINCT FROM (OLD.envelope_id,OLD.run_id,OLD.operation_key,OLD.kind)
 OR OLD.state IN ('succeeded','failed','uncertain','discarded')
 OR (OLD.call_id IS NOT NULL AND (NEW.call_id,NEW.resolved_request) IS DISTINCT FROM (OLD.call_id,OLD.resolved_request)
  AND NOT (
   NEW.call_id IS NULL AND NEW.resolved_request IS NOT DISTINCT FROM OLD.resolved_request
   AND OLD.state='dispatched' AND NEW.state='pending'
   AND EXISTS(
    SELECT 1 FROM envelope_operation_attempts a JOIN provider_calls p ON p.id=a.call_id JOIN execution_envelopes e ON e.id=OLD.envelope_id
    WHERE a.envelope_id=OLD.envelope_id AND a.operation_key=OLD.operation_key AND a.call_id=OLD.call_id
    AND a.attempt_number=1 AND p.status='failed' AND p.retryable=true AND p.recovery_required=false
    AND NOT EXISTS(SELECT 1 FROM envelope_operation_attempts a2 WHERE a2.envelope_id=OLD.envelope_id AND a2.operation_key=OLD.operation_key AND a2.attempt_number>1)
    AND e.envelope->'authorization'->>'maxAttempts'='2'
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(e.envelope->'operations') authorized_op
     WHERE authorized_op->>'key'=OLD.operation_key AND authorized_op->>'implementationContractVersion'='gemini-free-text-2'
      AND authorized_op->'providerRetryPolicy'='{"maxProviderAttempts":2,"retryableReason":"GEMINI_HTTP_503","maxAutomaticRetries":1,"backoff":{"strategy":"exponential","baseDelayMs":5000,"maxDelayMs":30000},"revalidateBeforeRetry":{"costPolicy":"ZERO_ONLY","billing":true,"modelFingerprint":true},"retryCallIdentity":"new-durable-call-per-attempt","uncertainOutcome":"recovery-required-no-retry"}'::jsonb)
   )
  ))
 OR (OLD.call_id IS NOT NULL AND NEW.dispatch_fence IS DISTINCT FROM OLD.dispatch_fence AND NOT(OLD.state='reserved' AND NEW.state='reserved'))
 THEN RAISE EXCEPTION 'Operation identity and terminal facts are immutable'; END IF;
 RETURN NEW;
END $$;
