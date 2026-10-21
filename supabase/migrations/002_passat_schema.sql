-- PASSAT / SIPs4DPP Demo — Additional Schema
-- Tables for Digital Ski Passport (DPP) data, ski instances, maintenance, and trace events.
-- Depends on: 001_initial_schema.sql (hanover schema + participants table)

-- Product models (type-level, from AASX product-model files like PMAA9999999.aasx)
CREATE TABLE IF NOT EXISTS hanover.product_models (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_number             TEXT NOT NULL UNIQUE,
    model_name                 TEXT NOT NULL,
    brand                      TEXT NOT NULL,
    season                     TEXT,
    gender                     TEXT,
    ean                        TEXT,
    image_data                 BYTEA,
    image_mime                 TEXT DEFAULT 'image/png',
    steel_edge_base_angle      TEXT,
    steel_edge_sidewall_angle  TEXT,
    extra_data                 JSONB DEFAULT '{}',
    created_at                 TIMESTAMPTZ DEFAULT now()
);

-- Ski instances (item-level, from AASX instance files like 99999999.aasx)
CREATE TABLE IF NOT EXISTS hanover.ski_instances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number    TEXT NOT NULL UNIQUE,
    product_model_id UUID NOT NULL REFERENCES hanover.product_models(id),
    size             NUMERIC,
    factory          TEXT,
    qr_image         BYTEA,
    extra_data       JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- Maintenance history for ski instances
CREATE TABLE IF NOT EXISTS hanover.maintenance_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_instance_id  UUID NOT NULL REFERENCES hanover.ski_instances(id),
    service_type     TEXT NOT NULL,
    message          TEXT,
    performed_by     TEXT,
    performed_at     TIMESTAMPTZ DEFAULT now(),
    extra_data       JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- Trace events (structured logs from all services for the dashboard)
CREATE TABLE IF NOT EXISTS hanover.trace_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id        UUID NOT NULL,
    span_id         UUID NOT NULL,
    parent_span_id  UUID,
    event_type      TEXT NOT NULL,
    source          TEXT NOT NULL,
    participant_id  TEXT,
    serial_number   TEXT,
    payload         JSONB DEFAULT '{}',
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trace_events_trace     ON hanover.trace_events(trace_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_trace_events_type      ON hanover.trace_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trace_events_serial    ON hanover.trace_events(serial_number);
CREATE INDEX IF NOT EXISTS idx_trace_events_timestamp ON hanover.trace_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_ski ON hanover.maintenance_records(ski_instance_id);

-- New participants (ON CONFLICT to be idempotent)
INSERT INTO hanover.participants (id, name, description, role)
VALUES
    ('dpp',         'Digital Ski Passport', 'Digital Product Passport provider', 'vendor'),
    ('repair_shop', 'Repair Store', 'Independent ski repair shop',          'service_shop')
ON CONFLICT (id) DO NOTHING;

-- Seed: DPP product model (from PMAA9999999.aasx)
INSERT INTO hanover.product_models (article_number, model_name, brand, season, gender, ean,
    steel_edge_base_angle, steel_edge_sidewall_angle, extra_data)
VALUES (
    'PMAA9999999',
    'REDSTER G7 REVOSHOCK L + MI 12 GW',
    'ATOMIC',  -- brand name stays as manufacturer brand
    'WS26',
    'Unisex',
    '0190694134041',
    '0,8 +/- 0,3',
    '87,5 +/- 0,5°',
    '{"sap_article": "AASS03858+", "component_article": "AA9999999+"}'
)
ON CONFLICT (article_number) DO NOTHING;

-- Seed: ski instance (from 99999999.aasx)
INSERT INTO hanover.ski_instances (serial_number, product_model_id, size, factory)
VALUES (
    '99999999',
    (SELECT id FROM hanover.product_models WHERE article_number = 'PMAA9999999'),
    167.0,
    'ALTENMARKT'
)
ON CONFLICT (serial_number) DO NOTHING;

-- Seed: maintenance history (from 99999999.aasx)
INSERT INTO hanover.maintenance_records (ski_instance_id, service_type, message, performed_at)
SELECT si.id, 'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', '2026-02-15T10:30:00Z'::timestamptz
FROM hanover.ski_instances si WHERE si.serial_number = '99999999'
AND NOT EXISTS (
    SELECT 1 FROM hanover.maintenance_records mr
    WHERE mr.ski_instance_id = si.id AND mr.performed_at = '2026-02-15T10:30:00Z'::timestamptz
);

INSERT INTO hanover.maintenance_records (ski_instance_id, service_type, message, performed_at)
SELECT si.id, 'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', '2026-03-01T14:00:00Z'::timestamptz
FROM hanover.ski_instances si WHERE si.serial_number = '99999999'
AND NOT EXISTS (
    SELECT 1 FROM hanover.maintenance_records mr
    WHERE mr.ski_instance_id = si.id AND mr.performed_at = '2026-03-01T14:00:00Z'::timestamptz
);
