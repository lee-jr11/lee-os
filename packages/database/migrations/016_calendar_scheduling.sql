-- P1.4: durable local-calendar schedules and immutable occurrence context.
ALTER TABLE schedules ADD COLUMN local_date date;
ALTER TABLE schedules ADD COLUMN local_time time(0);
ALTER TABLE schedules ADD COLUMN day_of_week smallint;

ALTER TABLE schedules DROP CONSTRAINT schedules_kind_check;
ALTER TABLE schedules DROP CONSTRAINT schedules_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_kind_check CHECK(kind IN ('once','cron','interval','daily','weekly'));
ALTER TABLE schedules ADD CONSTRAINT schedules_managed_shape_check CHECK(
 (kind='once' AND run_at IS NOT NULL AND expression IS NULL AND interval_seconds IS NULL AND day_of_week IS NULL
   AND ((local_date IS NULL AND local_time IS NULL) OR (local_date IS NOT NULL AND local_time IS NOT NULL))) OR
 (kind='interval' AND run_at IS NOT NULL AND expression IS NULL AND interval_seconds IS NOT NULL AND local_date IS NULL AND local_time IS NULL AND day_of_week IS NULL) OR
 (kind='daily' AND run_at IS NULL AND expression IS NULL AND interval_seconds IS NULL AND local_date IS NULL AND local_time IS NOT NULL AND day_of_week IS NULL) OR
 (kind='weekly' AND run_at IS NULL AND expression IS NULL AND interval_seconds IS NULL AND local_date IS NULL AND local_time IS NOT NULL AND day_of_week IS NOT NULL AND day_of_week BETWEEN 1 AND 7) OR
 (kind='cron' AND expression IS NOT NULL AND run_at IS NULL AND interval_seconds IS NULL AND local_date IS NULL AND local_time IS NULL AND day_of_week IS NULL)
);

ALTER TABLE trigger_receipts ADD COLUMN scheduled_local text CHECK(scheduled_local IS NULL OR scheduled_local ~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$');
ALTER TABLE trigger_receipts ADD COLUMN timezone text;
ALTER TABLE trigger_receipts ADD COLUMN skipped_occurrences integer NOT NULL DEFAULT 0 CHECK(skipped_occurrences>=0);

CREATE OR REPLACE FUNCTION leeos_managed_schedule_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF EXISTS(SELECT 1 FROM schedule_configs WHERE schedule_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Managed schedules cannot be deleted'; END IF;
  IF (NEW.id,NEW.automation_id,NEW.kind,NEW.expression,NEW.run_at,NEW.timezone,NEW.interval_seconds,NEW.local_date,NEW.local_time,NEW.day_of_week)
   IS DISTINCT FROM (OLD.id,OLD.automation_id,OLD.kind,OLD.expression,OLD.run_at,OLD.timezone,OLD.interval_seconds,OLD.local_date,OLD.local_time,OLD.day_of_week)
   OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Managed schedule identity is immutable and changes require a version'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
 END $$;
