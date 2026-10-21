-- AAS Integration — Decouple maintenance_records from ski_instances
-- Product/instance data now comes live from the PASSAT AAS endpoints.
-- Maintenance records are keyed by serial_number directly.

ALTER TABLE hanover.maintenance_records
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

ALTER TABLE hanover.maintenance_records
  ALTER COLUMN ski_instance_id DROP NOT NULL;

-- Backfill serial_number from ski_instances for existing records
UPDATE hanover.maintenance_records mr
SET serial_number = si.serial_number
FROM hanover.ski_instances si
WHERE mr.ski_instance_id = si.id
  AND mr.serial_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_records_serial
  ON hanover.maintenance_records(serial_number);
