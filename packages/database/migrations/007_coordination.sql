-- Existing legacy cron rows are retained but never polled by the managed scheduler.
ALTER TABLE schedules ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
ALTER TABLE schedules ADD COLUMN interval_seconds integer CHECK(interval_seconds BETWEEN 60 AND 31536000);
ALTER TABLE schedules DROP CONSTRAINT schedules_kind_check;
ALTER TABLE schedules DROP CONSTRAINT schedules_check;
ALTER TABLE schedules ADD CHECK(kind IN ('once','cron','interval'));
ALTER TABLE schedules ADD CHECK(
 (kind='once' AND run_at IS NOT NULL AND expression IS NULL AND interval_seconds IS NULL) OR
 (kind='cron' AND expression IS NOT NULL AND run_at IS NULL AND interval_seconds IS NULL) OR
 (kind='interval' AND run_at IS NOT NULL AND expression IS NULL AND interval_seconds IS NOT NULL));
CREATE TABLE schedule_configs (
 schedule_id text PRIMARY KEY REFERENCES schedules(id),
 project_id text NOT NULL REFERENCES projects(id),
 automation_id text NOT NULL,
 automation_version integer NOT NULL CHECK(automation_version>0),
 request_key text NOT NULL,
 request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 UNIQUE(project_id,request_key),
 FOREIGN KEY(automation_id,project_id) REFERENCES automations(id,project_id)
);
CREATE TABLE event_subscriptions (
 id text PRIMARY KEY CHECK(id ~ '^sub_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 project_id text NOT NULL REFERENCES projects(id),
 source_automation_id text NOT NULL,
 target_automation_id text NOT NULL,
 target_version integer NOT NULL CHECK(target_version>0),
 event_kind text NOT NULL CHECK(event_kind IN ('run.succeeded','run.failed','run.cancelled','run.interrupted')),
 request_key text NOT NULL,
 request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'),
 enabled boolean NOT NULL DEFAULT false,
 enabled_since timestamptz,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,request_key),
 FOREIGN KEY(source_automation_id,project_id) REFERENCES automations(id,project_id),
 FOREIGN KEY(target_automation_id,project_id) REFERENCES automations(id,project_id),
 CHECK(source_automation_id<>target_automation_id),
 CHECK(NOT enabled OR enabled_since IS NOT NULL)
);
CREATE TABLE trigger_receipts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 project_id text NOT NULL REFERENCES projects(id),
 schedule_id text REFERENCES schedules(id),
 subscription_id text REFERENCES event_subscriptions(id),
 scheduled_for timestamptz,
 source_event_id text REFERENCES events(id),
 run_id text,
 outcome text NOT NULL CHECK(outcome IN ('queued','overlap','blocked')),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(schedule_id,scheduled_for),
 UNIQUE(subscription_id,source_event_id),
 FOREIGN KEY(run_id,project_id) REFERENCES runs(id,project_id),
 CHECK((outcome='queued')=(run_id IS NOT NULL)),
 CHECK((schedule_id IS NOT NULL AND subscription_id IS NULL AND scheduled_for IS NOT NULL AND source_event_id IS NULL)
 OR (subscription_id IS NOT NULL AND schedule_id IS NULL AND scheduled_for IS NULL AND source_event_id IS NOT NULL))
);
CREATE INDEX trigger_receipts_project_idx ON trigger_receipts(project_id,id);
CREATE INDEX subscriptions_enabled_idx ON event_subscriptions(id) WHERE enabled;
CREATE INDEX events_coordination_idx ON events(project_id,kind,occurred_at,id) WHERE run_id IS NOT NULL;
CREATE TRIGGER schedule_config_immutable BEFORE UPDATE OR DELETE ON schedule_configs FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER trigger_receipts_immutable BEFORE UPDATE OR DELETE ON trigger_receipts FOR EACH ROW EXECUTE FUNCTION leeos_append_only();
CREATE TRIGGER subscriptions_immutable_id BEFORE UPDATE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION leeos_immutable_id();
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION leeos_touch_updated_at();
CREATE FUNCTION leeos_managed_schedule_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF EXISTS(SELECT 1 FROM schedule_configs WHERE schedule_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Managed schedules cannot be deleted'; END IF;
  IF (NEW.id,NEW.automation_id,NEW.kind,NEW.expression,NEW.run_at,NEW.timezone,NEW.interval_seconds)
   IS DISTINCT FROM (OLD.id,OLD.automation_id,OLD.kind,OLD.expression,OLD.run_at,OLD.timezone,OLD.interval_seconds)
   OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Managed schedule identity is immutable and changes require a version'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER schedules_managed_boundary BEFORE UPDATE OR DELETE ON schedules FOR EACH ROW EXECUTE FUNCTION leeos_managed_schedule_boundary();
CREATE FUNCTION leeos_subscription_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Event rules cannot be deleted'; END IF;
 IF (NEW.project_id,NEW.source_automation_id,NEW.target_automation_id,NEW.target_version,NEW.event_kind,NEW.request_key,NEW.request,NEW.created_at)
  IS DISTINCT FROM (OLD.project_id,OLD.source_automation_id,OLD.target_automation_id,OLD.target_version,OLD.event_kind,OLD.request_key,OLD.request,OLD.created_at)
  OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Event rule configuration is immutable and changes require a version'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER subscriptions_boundary BEFORE UPDATE OR DELETE ON event_subscriptions FOR EACH ROW EXECUTE FUNCTION leeos_subscription_boundary();
