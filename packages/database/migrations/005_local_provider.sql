CREATE TABLE provider_calls (
 id text PRIMARY KEY CHECK(id ~ '^call_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 request_key text NOT NULL UNIQUE CHECK(length(request_key) BETWEEN 1 AND 200),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 provider_id text NOT NULL CHECK(provider_id='llamacpp-local'),model_id text NOT NULL CHECK(model_id='leeos-local'),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','failed','interrupted')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 output_text text CHECK(octet_length(output_text)<=262144),input_tokens integer CHECK(input_tokens>=0),output_tokens integer CHECK(output_tokens>=0),
 error_code text, recovery_required boolean NOT NULL DEFAULT false,
 usage_id text UNIQUE REFERENCES model_usage(id),
 created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 CHECK((status='running' AND finished_at IS NULL) OR (status<>'running' AND finished_at IS NOT NULL))
);
CREATE TABLE provider_slots (
 id text PRIMARY KEY CHECK(id='llamacpp-local'),call_id text UNIQUE REFERENCES provider_calls(id)
);
INSERT INTO provider_slots(id) VALUES('llamacpp-local');
CREATE TRIGGER provider_calls_immutable_id BEFORE UPDATE ON provider_calls FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
