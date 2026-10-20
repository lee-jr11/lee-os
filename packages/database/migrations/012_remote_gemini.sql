-- Extend the existing provider ledger for a single remotely hosted Gemini route.
ALTER TABLE provider_calls DROP CONSTRAINT provider_calls_provider_id_check;
ALTER TABLE provider_calls ADD CHECK(provider_id IN ('llamacpp-local','gemini'));
ALTER TABLE provider_calls DROP CONSTRAINT provider_calls_model_id_check;
ALTER TABLE provider_calls ADD CHECK(model_id IN ('leeos-local','gemini-3.1-flash-lite'));

ALTER TABLE provider_slots DROP CONSTRAINT provider_slots_id_check;
ALTER TABLE provider_slots ADD CHECK(id IN ('llamacpp-local','gemini'));
INSERT INTO provider_slots(id) VALUES('gemini');

ALTER TABLE model_usage ADD COLUMN cost_evidence_ref text;
ALTER TABLE model_usage ADD COLUMN cost_evidence_checked_at timestamptz;
ALTER TABLE model_usage ADD COLUMN cost_account_scope text;
ALTER TABLE model_usage ADD COLUMN cost_status text NOT NULL DEFAULT 'unknown' CHECK(cost_status IN ('unknown','verified-zero','nonzero'));
UPDATE model_usage SET cost_status='verified-zero',cost_evidence_ref='local-loopback-no-billing',cost_evidence_checked_at=created_at,cost_account_scope='local-process'
 WHERE provider_id='llamacpp-local' AND cost_usd=0;
ALTER TABLE model_usage ADD CHECK(
 (cost_status='verified-zero' AND cost_usd=0 AND cost_evidence_ref IS NOT NULL AND cost_evidence_checked_at IS NOT NULL AND cost_account_scope IS NOT NULL)
 OR (cost_status='nonzero' AND cost_usd>0)
 OR (cost_status='unknown' AND cost_evidence_ref IS NULL AND cost_evidence_checked_at IS NULL AND cost_account_scope IS NULL));

-- Usage and cost evidence are historical facts. Corrections are new records.
CREATE FUNCTION leeos_model_usage_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Model usage and cost evidence are append-only';
END $$;
CREATE TRIGGER model_usage_append_only BEFORE UPDATE OR DELETE ON model_usage FOR EACH ROW EXECUTE FUNCTION leeos_model_usage_append_only();

