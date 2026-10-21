-- Hanover Ski Passport Demonstrator -- Initial Schema
-- All tables live in the "hanover" schema to isolate from existing Supabase data.

CREATE SCHEMA IF NOT EXISTS hanover;

-- Participants: vendor, owner_a, owner_b, service_shop
CREATE TABLE hanover.participants (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    role            TEXT NOT NULL CHECK (role IN ('vendor', 'owner', 'service_shop', 'admin')),
    did_url         TEXT,
    participant_json JSONB,
    gaiax_compliant BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Demo user profiles mapped to participants
CREATE TABLE hanover.user_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    UUID UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    participant_id  TEXT NOT NULL REFERENCES hanover.participants(id),
    role            TEXT NOT NULL DEFAULT 'user',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Physical ski identity
CREATE TABLE hanover.skis (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number   TEXT NOT NULL UNIQUE,
    model           TEXT NOT NULL,
    manufacturer    TEXT,
    production_batch TEXT,
    vendor_participant_id TEXT NOT NULL REFERENCES hanover.participants(id),
    qr_payload      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Current materialized passport view
CREATE TABLE hanover.product_passports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_id          UUID NOT NULL UNIQUE REFERENCES hanover.skis(id),
    current_owner_participant_id TEXT NOT NULL REFERENCES hanover.participants(id),
    identity_block  JSONB NOT NULL DEFAULT '{}',
    manufacturer_block JSONB NOT NULL DEFAULT '{}',
    ownership_block JSONB NOT NULL DEFAULT '{}',
    service_block   JSONB NOT NULL DEFAULT '{}',
    document_block  JSONB NOT NULL DEFAULT '{}',
    audit_block     JSONB NOT NULL DEFAULT '{}',
    snapshot_json   JSONB NOT NULL DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Append-only event history
CREATE TABLE hanover.passport_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_id          UUID NOT NULL REFERENCES hanover.skis(id),
    event_type      TEXT NOT NULL CHECK (event_type IN (
        'manufactured', 'sold', 'ownership_transferred',
        'serviced', 'inspected', 'theft_checked', 'warranty_registered'
    )),
    actor_participant_id TEXT NOT NULL REFERENCES hanover.participants(id),
    actor_user_id   UUID REFERENCES hanover.user_profiles(id),
    payload         JSONB NOT NULL DEFAULT '{}',
    source_connector_id TEXT,
    gaiax_decision_id UUID,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Ownership transfer handshake
CREATE TABLE hanover.ownership_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_id          UUID NOT NULL REFERENCES hanover.skis(id),
    seller_participant_id TEXT NOT NULL REFERENCES hanover.participants(id),
    buyer_participant_id  TEXT NOT NULL REFERENCES hanover.participants(id),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'transferring', 'completed', 'cancelled', 'expired'
    )),
    transfer_token  TEXT,
    qr_payload      TEXT,
    expires_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Service / maintenance records
CREATE TABLE hanover.service_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_id          UUID NOT NULL REFERENCES hanover.skis(id),
    service_participant_id TEXT NOT NULL REFERENCES hanover.participants(id),
    service_type    TEXT NOT NULL CHECK (service_type IN (
        'waxing', 'edge_tuning', 'base_repair', 'binding_adjustment',
        'full_service', 'inspection', 'theft_check', 'other'
    )),
    description     TEXT,
    technician_name TEXT,
    notes           TEXT,
    event_id        UUID REFERENCES hanover.passport_events(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Inventory: which participant currently holds which ski
CREATE TABLE hanover.inventories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_id          UUID NOT NULL REFERENCES hanover.skis(id),
    participant_id  TEXT NOT NULL REFERENCES hanover.participants(id),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'transferring')),
    acquired_at     TIMESTAMPTZ DEFAULT now(),
    archived_at     TIMESTAMPTZ,
    UNIQUE(ski_id, participant_id, status)
);

-- System logs for observability
CREATE TABLE hanover.system_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level           TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
    source          TEXT NOT NULL,
    action          TEXT NOT NULL,
    participant_id  TEXT REFERENCES hanover.participants(id),
    details         JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_passport_events_ski ON hanover.passport_events(ski_id, created_at);
CREATE INDEX idx_passport_events_type ON hanover.passport_events(event_type);
CREATE INDEX idx_inventories_participant ON hanover.inventories(participant_id, status);
CREATE INDEX idx_inventories_ski ON hanover.inventories(ski_id, status);
CREATE INDEX idx_service_records_ski ON hanover.service_records(ski_id);
CREATE INDEX idx_ownership_transfers_status ON hanover.ownership_transfers(status);
CREATE INDEX idx_system_logs_source ON hanover.system_logs(source, created_at);
CREATE INDEX idx_product_passports_owner ON hanover.product_passports(current_owner_participant_id);

-- Seed the 4 participants
INSERT INTO hanover.participants (id, name, description, role) VALUES
    ('vendor',       'Ski Vendor',       'Ski manufacturer and original seller', 'vendor'),
    ('owner_a',      'Owner Cloud A',    'Initial ski owner cloud',             'owner'),
    ('owner_b',      'Owner Cloud B',    'Second ski owner cloud',              'owner'),
    ('service_shop', 'Service Shop',     'Ski maintenance and repair shop',     'service_shop');

-- Seed demo user profiles (no auth_user_id yet -- set after Supabase Auth signup)
INSERT INTO hanover.user_profiles (email, display_name, participant_id, role) VALUES
    ('vendor@demo.hanover',   'Vendor Admin',      'vendor',       'admin'),
    ('ownera@demo.hanover',   'Owner A',           'owner_a',      'user'),
    ('ownerb@demo.hanover',   'Owner B',           'owner_b',      'user'),
    ('service@demo.hanover',  'Service Operator',  'service_shop', 'user'),
    ('admin@demo.hanover',    'System Admin',      'vendor',       'admin');
