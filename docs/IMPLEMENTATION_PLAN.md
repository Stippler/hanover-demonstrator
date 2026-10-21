# IMPLEMENTATION PLAN — PASSAT / SIPs4DPP Demo

> Repair Shop ↔ EDC (with Gaia-X auth plugin) ↔ Economic Operator (Digital Ski Passport)

This document describes every component, file, folder, API contract, database table,
Docker change, and implementation order needed to build the new demo alongside the
existing Hanover demonstrator.

**Status:** The planned stack is **implemented**. For the **current** diagram and services, see the root **[README.md](../README.md)** and **[ARCHITECTURE.md](./ARCHITECTURE.md)** ([SVG diagram](./images/architecture-overview.svg)). Remaining sections are a **historical plan**; details (e.g. Gaia-X via bridge vs in-connector compliance client) may differ from the shipped system.

---

## 1. High-level architecture (superseded diagram)

The obsolete “single EDC block in the middle” sketch is replaced by **two participant stacks**: each has **API + EDC Control Plane + EDC Data Plane**. See [README.md](../README.md) and [images/architecture-overview.svg](images/architecture-overview.svg).

### Participants

| ID                | Role              | Description                              |
|-------------------|-------------------|------------------------------------------|
| `dpp`             | economic_operator | Digital Ski Passport — ski manufacturer, owns product data |
| `repair_shop`     | repair_shop       | Independent repair store, scans QR codes |

Each gets its own EDC connector pair (control plane + data plane) with the
**Gaia-X authentication plugin** compiled in.

---

## 2. What we reuse from the existing codebase

| Existing asset | Reuse strategy |
|---|---|
| `backend/common/database.py` | Copy into new backends (identical pattern) |
| `backend/common/auth.py`, `auth_middleware.py` | Reuse for repair-shop and DPP APIs |
| `backend/common/config.py` | Extend with new env vars |
| `backend/Dockerfile` | Clone for new backends |
| `backend/run.py` | Extend `_APP_MODULE_MAP` with new apps |
| `bridge/credentials.py` | Reuse VC/VP generation for new participants |
| `bridge/edc_client.py` | Reuse EDC management API calls |
| `bridge/main.py` | Add new participant entries + seed endpoints |
| `frontend/Dockerfile` | Same multi-app Dockerfile (ARG APP_NAME) |
| `frontend/packages/ui/` | Reuse all shared components (StatCard, EventTimeline, DataTable, QrScanner, LoginForm, etc.) |
| `frontend/turbo.json` | No change needed (glob-based) |
| `vendor/Template-Basic/` | Base for the new EDC extension |
| `edc/Dockerfile.controlplane` | Modified version that includes the Gaia-X extension |
| `edc/Dockerfile.dataplane` | Reuse as-is |
| `supabase/migrations/001_initial_schema.sql` | Add new migration file for new tables |
| `caddy/Caddyfile` | Add routing for new subdomains |
| `docker-compose.yml` | Add new services |

---

## 3. New files and folders to create

### 3.1 EDC Gaia-X authentication extension

Replace the stub `example-extension` with a real Gaia-X verification extension.

```
vendor/Template-Basic/extensions/gaiax-auth-extension/
├── build.gradle.kts
└── src/main/
    ├── java/org/eclipse/edc/gaiax/
    │   ├── GaiaxAuthExtension.java          ← ServiceExtension: registers the policy function
    │   ├── GaiaxComplianceFunction.java     ← AtomicConstraintRuleFunction impl
    │   └── GaiaxComplianceClient.java       ← HTTP client that calls bridge /api/verify/{id}
    └── resources/
        └── META-INF/services/
            └── org.eclipse.edc.spi.system.ServiceExtension
```

**How it works:**

1. `GaiaxAuthExtension` implements `ServiceExtension`.
2. In `initialize()`, it reads config for the bridge URL (`GAIAX_BRIDGE_URL`).
3. It injects `PolicyEngine` and registers `GaiaxComplianceFunction` bound to
   the `contract.negotiation` scope under the key `gaiaxCompliant`.
4. `GaiaxComplianceFunction` implements `AtomicConstraintRuleFunction<Permission, PolicyContext>`.
   When EDC evaluates the policy constraint `{ leftOperand: "gaiaxCompliant", operator: "eq", rightOperand: "true" }`,
   it calls `GaiaxComplianceClient.verify(participantId)`.
5. `GaiaxComplianceClient` makes a synchronous HTTP GET to
   `http://gaiax-bridge:8000/api/verify/{participantId}` and returns `true`
   if `response.verified == true`.
6. If verification fails, the contract negotiation is rejected by EDC.

**`build.gradle.kts`:**

```kotlin
plugins { `java-library` }
dependencies {
    implementation(libs.edc.spi.core)
    implementation(libs.edc.policy.engine.spi)  // new entry in libs.versions.toml
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")
}
```

**Changes to `libs.versions.toml`:**

Add under `[libraries]`:
```toml
edc-policy-engine-spi = { module = "org.eclipse.edc:policy-engine-spi", version.ref = "edc" }
```

**Changes to `settings.gradle.kts`:**

Replace `include(":extensions:example-extension")` with
`include(":extensions:gaiax-auth-extension")`.

**Changes to `runtimes/controlplane/build.gradle.kts`:**

Replace `runtimeOnly(project(":extensions:example-extension"))` with
`runtimeOnly(project(":extensions:gaiax-auth-extension"))`.

**Changes to `edc/Dockerfile.controlplane`:**

Remove the `sed` line that strips `example-extension`. Instead, the new extension
is included in the Gradle build. Add `sed` to rename the extension reference if
needed, or better: the source `settings.gradle.kts` and `build.gradle.kts` already
reference the new extension, so no `sed` needed for that line.

Add an env var `GAIAX_BRIDGE_URL=http://gaiax-bridge:8000` in `docker-compose.yml`
for each EDC control plane that uses the extension.

### 3.2 Digital Ski Passport backend (Economic Operator API)

```
backend/dpp_api/
├── __init__.py
└── main.py
```

**Data model** — stores the imported AAS data:

- Uses the shared Postgres (same `hanover` schema).
- New tables (see §4 below).
- Exposes REST endpoints that the EDC connector can proxy.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | JWT login |
| GET | `/api/products` | List all product models |
| GET | `/api/products/{article_number}` | Get product model by article number |
| GET | `/api/products/{article_number}/image` | Product image (binary) |
| GET | `/api/skis` | List all ski instances |
| GET | `/api/skis/{serial_number}` | Get ski instance by serial number |
| GET | `/api/skis/{serial_number}/qr` | QR code image (binary) |
| GET | `/api/skis/{serial_number}/passport` | Full DPP data (identity + model params + maintenance history) |
| GET | `/api/skis/{serial_number}/maintenance` | Maintenance history |
| POST | `/api/skis/{serial_number}/maintenance` | Add maintenance report (from repair shop) |

The `/api/skis/{serial_number}/passport` endpoint is the one that the EDC
connector exposes as an HttpData asset. It returns:

```json
{
  "serialNumber": "99999999",
  "manufacturer": "ATOMIC",
  "model": "REDSTER G7 REVOSHOCK L + MI 12 GW",
  "length": 167.0,
  "steelEdgeSidewallAngle": "87,5 +/- 0,5°",
  "steelEdgeBaseAngle": "0,8 +/- 0,3",
  "season": "WS26",
  "gender": "Unisex",
  "ean": "0190694134041",
  "factory": "ALTENMARKT",
  "productImageUrl": "/api/products/PMAA9999999/image",
  "maintenanceHistory": [
    {
      "serviceType": "Kantenschleifen",
      "message": "Kantenschleifen nach Herstellerangabe",
      "timestamp": "2026-02-15T10:30:00Z"
    }
  ]
}
```

**Changes to `backend/run.py`:**

Add to `_APP_MODULE_MAP`:
```python
"dpp": "dpp_api.main",
```

### 3.3 Repair Shop backend

```
backend/repair_api/
├── __init__.py
└── main.py
```

This is a thin backend that:
1. Accepts a serial number from the frontend.
2. Orchestrates the EDC flow: catalog request → contract negotiation → transfer → fetch data.
3. Emits trace events to the Trace Collector.
4. Returns the passport data to the frontend.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/lookup` | `{ serialNumber }` → triggers EDC flow, returns passport data |
| GET | `/api/lookups` | Recent lookups (for history) |
| POST | `/api/maintenance-report` | Send maintenance report back through EDC |

The `/api/lookup` endpoint does:
1. Emits `qr_scanned` trace event.
2. Calls bridge `POST /api/edc/catalog` (consumer=repair_shop, provider=dpp).
3. Extracts the offer from the catalog response.
4. Emits `edc_catalog_query` trace event.
5. Calls bridge `POST /api/edc/negotiate` with the offer (Gaia-X check happens here in EDC).
6. Emits `gaiax_auth_started` trace event.
7. Polls negotiation status until `FINALIZED`.
8. Emits `edc_contract_negotiation` trace event.
9. Calls bridge `POST /api/edc/transfer` to start HttpData-PULL.
10. Gets EDR (endpoint data reference) from bridge.
11. Emits `edc_transfer_started` trace event.
12. Uses the EDR to fetch the actual passport data from the DPP data plane.
13. Emits `dpp_data_returned` trace event.
14. Returns the data to the frontend.

**Changes to `backend/run.py`:**

Add to `_APP_MODULE_MAP`:
```python
"repair": "repair_api.main",
```

### 3.4 Trace Collector API

```
backend/trace_api/
├── __init__.py
└── main.py
```

A lightweight service that receives structured log/trace events from all
components and stores them in the database.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/traces` | Ingest a trace event (no auth required from internal services) |
| POST | `/api/traces/batch` | Ingest multiple trace events |
| GET | `/api/traces` | List traces (paginated, newest first) |
| GET | `/api/traces/{trace_id}` | Get all events for a single trace/request |
| GET | `/api/traces/stats` | Aggregate counts by event type |

**Trace event schema:**

```json
{
  "trace_id": "uuid",
  "span_id": "uuid",
  "parent_span_id": "uuid | null",
  "event_type": "qr_scanned | gaiax_auth_started | gaiax_auth_success | ...",
  "source": "repair_api | edc_connector | gaiax_bridge | dpp_api",
  "participant_id": "repair_shop | dpp",
  "serial_number": "99999999 | null",
  "payload": { ... },
  "timestamp": "ISO8601"
}
```

**Who sends events:**
- `repair_api` — `qr_scanned`, `repair_request_started`, `edc_catalog_query`,
  `edc_contract_negotiation`, `edc_transfer_started`, `edc_transfer_completed`,
  `dpp_data_returned`, `maintenance_report_sent`
- `bridge/main.py` — `gaiax_auth_started`, `gaiax_auth_success`, `gaiax_auth_failed`
  (add `httpx` POST to trace collector in the `/api/verify` and `/api/edc/negotiate` endpoints)
- `dpp_api` — `data_request_received`, `data_response_sent`

**Changes to `backend/run.py`:**

Add to `_APP_MODULE_MAP`:
```python
"trace": "trace_api.main",
```

### 3.5 Repair Shop frontend (Next.js)

```
frontend/apps/repair/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── public/
│   ├── manifest.json
│   └── sw.js
└── src/app/
    ├── globals.css
    ├── layout.tsx
    ├── login/
    │   └── page.tsx
    ├── require-auth.tsx
    ├── shell.tsx             ← mobile-first shell with header
    ├── page.tsx              ← scan page: QR scanner + serial input
    ├── result/
    │   └── page.tsx          ← shows passport data after scan
    ├── history/
    │   └── page.tsx          ← recent lookups
    └── not-found.tsx
```

**UI flow:**

1. **Scan page** (`/`): Shows a QR scanner (reuse `QrScanner` from `@hanover/ui`)
   and a manual serial number input field. On scan/submit, calls `POST /api/lookup`
   with the serial number.

2. **Result page** (`/result?serial=99999999`): Shows a loading spinner during
   the EDC flow, then displays:
   - Product image (from ATOMIC)
   - Manufacturer: ATOMIC
   - Model: REDSTER G7 REVOSHOCK L + MI 12 GW
   - Serial Number: 99999999
   - Length: 167.0 cm
   - Steel Edge Sidewall Angle: 87,5 +/- 0,5°
   - Steel Edge Base Angle: 0,8 +/- 0,3
   - Season, Gender, EAN, Factory
   - Maintenance history timeline (reuse `EventTimeline`)
   - "Send Maintenance Report" button

3. **History page** (`/history`): List of recent lookups with serial number,
   timestamp, and status.

### 3.6 Dashboard frontend (Next.js)

```
frontend/apps/trace-dashboard/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── public/
│   ├── manifest.json
│   └── sw.js
└── src/app/
    ├── globals.css
    ├── layout.tsx
    ├── login/
    │   └── page.tsx
    ├── require-auth.tsx
    ├── shell.tsx
    ├── page.tsx              ← log timeline (all events, newest first)
    ├── trace/
    │   └── [id]/
    │       └── page.tsx      ← trace detail: waterfall view of one request
    └── not-found.tsx
```

**UI flow:**

1. **Log timeline** (`/`): Shows all trace events in reverse chronological order.
   Each row shows: timestamp, event type (color-coded badge), source service,
   participant, serial number, and a short payload summary. Rows with the same
   `trace_id` share the same color/accent. Clicking a row navigates to the
   trace detail page.

2. **Trace detail** (`/trace/{trace_id}`): Shows the full waterfall of a single
   request flow. Each span is a horizontal bar on a timeline:
   ```
   [Repair Shop]  qr_scanned ─────────────────────────────────────▶
   [Repair Shop]  edc_catalog_query ──────▶
   [EDC Connector] gaiax_auth_started ──▶
   [Gaia-X Bridge] gaiax_auth_success ─▶
   [EDC Connector] edc_contract_negotiation ──────▶
   [EDC Connector] edc_transfer_started ──▶
   [DPP API]   data_request_received ──▶
   [DPP API]   data_response_sent ──▶
   [Repair Shop]  dpp_data_returned ──▶
   ```
   Below the waterfall, show the full JSON payload of each selected span.

---

## 4. Database changes

New migration file:

```
supabase/migrations/002_passat_schema.sql
```

### New tables

```sql
-- Product models (type-level, from AASX product-model files)
CREATE TABLE hanover.product_models (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_number  TEXT NOT NULL UNIQUE,
    model_name      TEXT NOT NULL,
    brand           TEXT NOT NULL,
    season          TEXT,
    gender          TEXT,
    ean             TEXT,
    image_data      BYTEA,
    image_mime      TEXT DEFAULT 'image/png',
    steel_edge_base_angle      TEXT,
    steel_edge_sidewall_angle  TEXT,
    extra_data      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Ski instances (item-level, from AASX instance files)
CREATE TABLE hanover.ski_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number   TEXT NOT NULL UNIQUE,
    product_model_id UUID NOT NULL REFERENCES hanover.product_models(id),
    size            NUMERIC,
    factory         TEXT,
    qr_image        BYTEA,
    extra_data      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Maintenance history for ski instances
CREATE TABLE hanover.maintenance_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ski_instance_id UUID NOT NULL REFERENCES hanover.ski_instances(id),
    service_type    TEXT NOT NULL,
    message         TEXT,
    performed_by    TEXT,
    performed_at    TIMESTAMPTZ DEFAULT now(),
    extra_data      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Trace events (from all services)
CREATE TABLE hanover.trace_events (
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

CREATE INDEX idx_trace_events_trace ON hanover.trace_events(trace_id, timestamp);
CREATE INDEX idx_trace_events_type ON hanover.trace_events(event_type);
CREATE INDEX idx_trace_events_serial ON hanover.trace_events(serial_number);
CREATE INDEX idx_trace_events_timestamp ON hanover.trace_events(timestamp DESC);
CREATE INDEX idx_maintenance_records_ski ON hanover.maintenance_records(ski_instance_id);

-- New participants
INSERT INTO hanover.participants (id, name, description, role) VALUES
    ('dpp',       'Digital Ski Passport',           'Economic Operator — ski manufacturer',  'vendor'),
    ('repair_shop',  'Repair Store',     'Independent ski repair shop',           'service_shop');

-- Seed: product model (ATOMIC brand, from PMAA9999999.aasx)
INSERT INTO hanover.product_models (article_number, model_name, brand, season, gender, ean,
    steel_edge_base_angle, steel_edge_sidewall_angle, extra_data) VALUES
    ('PMAA9999999', 'REDSTER G7 REVOSHOCK L + MI 12 GW', 'ATOMIC', 'WS26', 'Unisex',
     '0190694134041', '0,8 +/- 0,3', '87,5 +/- 0,5°',
     '{"sap_article": "AASS03858+", "component_article": "AA9999999+"}');

-- Seed: ski instance (from 99999999.aasx)
INSERT INTO hanover.ski_instances (serial_number, product_model_id, size, factory) VALUES
    ('99999999',
     (SELECT id FROM hanover.product_models WHERE article_number = 'PMAA9999999'),
     167.0, 'ALTENMARKT');

-- Seed: maintenance history (from 99999999.aasx)
INSERT INTO hanover.maintenance_records (ski_instance_id, service_type, message, performed_at) VALUES
    ((SELECT id FROM hanover.ski_instances WHERE serial_number = '99999999'),
     'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', '2026-02-15T10:30:00Z'),
    ((SELECT id FROM hanover.ski_instances WHERE serial_number = '99999999'),
     'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', '2026-03-01T14:00:00Z');
```

---

## 5. Docker Compose changes

Add these services to `docker-compose.yml`:

### New backends

```yaml
# ── Digital Ski Passport Economic Operator API ─────────────────────────────────
dpp-api:
  build:
    context: ./backend
  environment:
    APP_NAME: dpp
    JWT_SECRET: ${JWT_SECRET:-change-me}
    APP_USERS: ${DPP_USERS:-demo:demo,dpp:dpp}
    POSTGRES_HOST: supabase-db
    POSTGRES_PORT: "5432"
    POSTGRES_DB: postgres
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    TRACE_COLLECTOR_URL: http://trace-api:8000
  networks:
    - hanover-internal
    - supabase_default
  restart: unless-stopped

# ── Repair Shop API ──────────────────────────────────────────────
repair-api:
  build:
    context: ./backend
  environment:
    APP_NAME: repair
    JWT_SECRET: ${JWT_SECRET:-change-me}
    APP_USERS: ${REPAIR_USERS:-demo:demo,repair:repair}
    POSTGRES_HOST: supabase-db
    POSTGRES_PORT: "5432"
    POSTGRES_DB: postgres
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    BRIDGE_URL: http://gaiax-bridge:8000
    TRACE_COLLECTOR_URL: http://trace-api:8000
  networks:
    - hanover-internal
    - supabase_default
  restart: unless-stopped

# ── Trace Collector API ──────────────────────────────────────────
trace-api:
  build:
    context: ./backend
  environment:
    APP_NAME: trace
    JWT_SECRET: ${JWT_SECRET:-change-me}
    APP_USERS: ${TRACE_USERS:-demo:demo,trace:trace}
    POSTGRES_HOST: supabase-db
    POSTGRES_PORT: "5432"
    POSTGRES_DB: postgres
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  networks:
    - hanover-internal
    - supabase_default
  restart: unless-stopped
```

### New EDC connectors (with Gaia-X extension)

```yaml
# ── DPP EDC Connectors ────────────────────────────────────────
dpp-edc-cp:
  build:
    context: .
    dockerfile: edc/Dockerfile.controlplane
  environment:
    EDC_PARTICIPANT_ID: dpp
    EDC_DSP_CALLBACK_ADDRESS: http://dpp-edc-cp:9292/api/dsp
    EDC_IAM_DID_WEB_USE_HTTPS: "false"
    WEB_HTTP_PORT: "8080"
    WEB_HTTP_PATH: "/api"
    WEB_HTTP_MANAGEMENT_PORT: "9191"
    WEB_HTTP_MANAGEMENT_PATH: "/api/management"
    WEB_HTTP_MANAGEMENT_AUTH_TYPE: tokenbased
    WEB_HTTP_MANAGEMENT_AUTH_KEY: ${EDC_API_KEY:-password}
    WEB_HTTP_PROTOCOL_PORT: "9292"
    WEB_HTTP_PROTOCOL_PATH: "/api/dsp"
    WEB_HTTP_CONTROL_PORT: "9393"
    WEB_HTTP_CONTROL_PATH: "/api/control"
    EDC_DPF_SELECTOR_URL: http://dpp-edc-cp:9393/api/control/v1/dataplanes
    GAIAX_BRIDGE_URL: http://gaiax-bridge:8000
  networks:
    - hanover-internal
  restart: unless-stopped

dpp-edc-dp:
  build:
    context: .
    dockerfile: edc/Dockerfile.dataplane
  environment:
    EDC_RUNTIME_ID: dpp-dataplane
    EDC_PARTICIPANT_ID: dpp
    WEB_HTTP_PORT: "8080"
    WEB_HTTP_PATH: "/api"
    WEB_HTTP_CONTROL_PORT: "9393"
    WEB_HTTP_CONTROL_PATH: "/api/control"
    WEB_HTTP_PUBLIC_PORT: "9291"
    WEB_HTTP_PUBLIC_PATH: "/api/public"
    EDC_DPF_SELECTOR_URL: http://dpp-edc-cp:9393/api/control/v1/dataplanes
    EDC_TRANSFER_PROXY_TOKEN_VERIFIER_PUBLICKEY_ALIAS: dppkey
    EDC_TRANSFER_PROXY_TOKEN_SIGNER_PRIVATEKEY_ALIAS: dppkey
  networks:
    - hanover-internal
  restart: unless-stopped

# ── Repair Shop EDC Connectors ───────────────────────────────────
repair-edc-cp:
  build:
    context: .
    dockerfile: edc/Dockerfile.controlplane
  environment:
    EDC_PARTICIPANT_ID: repair_shop
    EDC_DSP_CALLBACK_ADDRESS: http://repair-edc-cp:9292/api/dsp
    EDC_IAM_DID_WEB_USE_HTTPS: "false"
    WEB_HTTP_PORT: "8080"
    WEB_HTTP_PATH: "/api"
    WEB_HTTP_MANAGEMENT_PORT: "9191"
    WEB_HTTP_MANAGEMENT_PATH: "/api/management"
    WEB_HTTP_MANAGEMENT_AUTH_TYPE: tokenbased
    WEB_HTTP_MANAGEMENT_AUTH_KEY: ${EDC_API_KEY:-password}
    WEB_HTTP_PROTOCOL_PORT: "9292"
    WEB_HTTP_PROTOCOL_PATH: "/api/dsp"
    WEB_HTTP_CONTROL_PORT: "9393"
    WEB_HTTP_CONTROL_PATH: "/api/control"
    EDC_DPF_SELECTOR_URL: http://repair-edc-cp:9393/api/control/v1/dataplanes
    GAIAX_BRIDGE_URL: http://gaiax-bridge:8000
  networks:
    - hanover-internal
  restart: unless-stopped

repair-edc-dp:
  build:
    context: .
    dockerfile: edc/Dockerfile.dataplane
  environment:
    EDC_RUNTIME_ID: repair-dataplane
    EDC_PARTICIPANT_ID: repair_shop
    WEB_HTTP_PORT: "8080"
    WEB_HTTP_PATH: "/api"
    WEB_HTTP_CONTROL_PORT: "9393"
    WEB_HTTP_CONTROL_PATH: "/api/control"
    WEB_HTTP_PUBLIC_PORT: "9291"
    WEB_HTTP_PUBLIC_PATH: "/api/public"
    EDC_DPF_SELECTOR_URL: http://repair-edc-cp:9393/api/control/v1/dataplanes
    EDC_TRANSFER_PROXY_TOKEN_VERIFIER_PUBLICKEY_ALIAS: repair-key
    EDC_TRANSFER_PROXY_TOKEN_SIGNER_PRIVATEKEY_ALIAS: repair-key
  networks:
    - hanover-internal
  restart: unless-stopped
```

### New frontends

```yaml
# ── Repair Shop UI ───────────────────────────────────────────────
repair-ui:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      APP_NAME: repair
  environment:
    NEXT_PUBLIC_PARTICIPANT_ID: repair_shop
    NEXT_PUBLIC_APP_TITLE: Repair Shop
    NEXT_PUBLIC_API_URL: /api
  networks:
    - hanover-internal
  restart: unless-stopped

# ── Trace Dashboard UI ───────────────────────────────────────────
trace-dashboard-ui:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      APP_NAME: trace-dashboard
  environment:
    NEXT_PUBLIC_PARTICIPANT_ID: admin
    NEXT_PUBLIC_APP_TITLE: Trace Dashboard
    NEXT_PUBLIC_API_URL: /api
  networks:
    - hanover-internal
  restart: unless-stopped
```

---

## 6. Caddy changes

Add to `caddy/Caddyfile`:

```
repair.imx.vactory-projects.com:80 {
    handle /api/* {
        reverse_proxy repair-api:8000
    }
    handle {
        reverse_proxy repair-ui:3000
    }
}

dpp.imx.vactory-projects.com:80 {
    handle /api/* {
        reverse_proxy dpp-api:8000
    }
}

traces.imx.vactory-projects.com:80 {
    handle /api/* {
        reverse_proxy trace-api:8000
    }
    handle {
        reverse_proxy trace-dashboard-ui:3000
    }
}

edc-dpp.imx.vactory-projects.com:80 {
    handle /dsp/* {
        reverse_proxy dpp-edc-cp:9292
    }
    handle /public/* {
        reverse_proxy dpp-edc-dp:9291
    }
    handle {
        reverse_proxy dpp-edc-cp:9191
    }
}

edc-repair.imx.vactory-projects.com:80 {
    handle /dsp/* {
        reverse_proxy repair-edc-cp:9292
    }
    handle /public/* {
        reverse_proxy repair-edc-dp:9291
    }
    handle {
        reverse_proxy repair-edc-cp:9191
    }
}
```

---

## 7. Bridge changes

### `bridge/main.py`

1. Add `"dpp"` and `"repair_shop"` to the `PARTICIPANTS` list.
2. In `/api/edc/negotiate`, after the compliance check, emit a trace event to the
   trace collector:
   ```python
   await httpx.AsyncClient().post(
       "http://trace-api:8000/api/traces",
       json={"trace_id": ..., "event_type": "gaiax_auth_success", ...}
   )
   ```
3. In `/api/verify/{participant_id}`, similarly emit `gaiax_auth_started` and
   `gaiax_auth_success`/`gaiax_auth_failed`.

### `bridge/edc_client.py`

Add entries to `EDC_CONNECTORS` and `EDC_DSP_ENDPOINTS`:

```python
EDC_CONNECTORS["dpp"] = "http://dpp-edc-cp:9191"
EDC_CONNECTORS["repair_shop"] = "http://repair-edc-cp:9191"

EDC_DSP_ENDPOINTS["dpp"] = "http://dpp-edc-cp:9292/api/dsp"
EDC_DSP_ENDPOINTS["repair_shop"] = "http://repair-edc-cp:9292/api/dsp"
```

### `bridge/credentials.py`

Add entries to `PARTICIPANT_METADATA`:

```python
"dpp": {
    "name": "Digital Ski Passport",
    "legal_name": "Digital Ski Passport",
    "country": "AT",
    "description": "Ski manufacturer and economic operator",
},
"repair_shop": {
    "name": "Wintersteiger Service Center",
    "legal_name": "Wintersteiger AG",
    "country": "AT",
    "description": "Independent ski service and repair",
},
```

---

## 8. EDC seeding for new participants

After the stack is up, the bridge's `POST /api/edc/seed` must also seed the
DPP and repair_shop connectors. The existing code iterates `PARTICIPANTS`, so
adding them to that list is sufficient.

The DPP connector's asset should point to the DPP API's passport endpoint:

```python
backend_urls["dpp"] = "http://dpp-api:8000/api"
backend_urls["repair_shop"] = "http://repair-api:8000/api"
```

**Policy change:** The seeded policy must include the Gaia-X constraint
instead of the current open policy:

```python
"policy": {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    "permission": [{
        "action": "use",
        "constraint": {
            "leftOperand": "gaiaxCompliant",
            "operator": "eq",
            "rightOperand": "true"
        }
    }],
    "prohibition": [],
    "obligation": [],
}
```

This ensures the Gaia-X extension's `GaiaxComplianceFunction` is invoked during
contract negotiation.

---

## 9. Implementation order

Execute in this order. Each phase should be testable before starting the next.

### Phase 1: Database and seed data
1. Create `supabase/migrations/002_passat_schema.sql`
2. Apply migration: `docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/002_passat_schema.sql`
3. Import product image from AASX into `product_models.image_data` (SQL UPDATE or a one-time script)

### Phase 2: Digital Ski Passport backend
4. Create `backend/dpp_api/__init__.py` and `backend/dpp_api/main.py`
5. Add `"dpp": "dpp_api.main"` to `backend/run.py`
6. Add `dpp-api` service to `docker-compose.yml`
7. Add Caddy route for `dpp.*`
8. Test: `curl http://localhost:8100/api/skis/99999999/passport` (via Caddy with Host header)

### Phase 3: Trace Collector
9. Create `backend/trace_api/__init__.py` and `backend/trace_api/main.py`
10. Add `"trace": "trace_api.main"` to `backend/run.py`
11. Add `trace-api` service to `docker-compose.yml`
12. Add Caddy route for `traces.*`
13. Test: `curl -X POST http://trace-api:8000/api/traces -d '{"trace_id":"...","event_type":"test"}'`

### Phase 4: EDC Gaia-X extension
14. Create `vendor/Template-Basic/extensions/gaiax-auth-extension/` with all files
15. Update `settings.gradle.kts` and `runtimes/controlplane/build.gradle.kts`
16. Update `edc/Dockerfile.controlplane` to include (not strip) the extension
17. Add new EDC connector services to `docker-compose.yml`
18. Add Caddy routes for `edc-dpp.*` and `edc-repair.*`
19. Build and test: `docker compose build dpp-edc-cp repair-edc-cp`
20. Verify extension loads: check container logs for extension name

### Phase 5: Bridge integration
21. Update `bridge/main.py` — add participants
22. Update `bridge/edc_client.py` — add connector entries
23. Update `bridge/credentials.py` — add metadata
24. Update `bridge/edc_client.py` `create_policy()` — add Gaia-X constraint
25. Add trace event emission to bridge verify/negotiate endpoints
26. Rebuild bridge: `docker compose up -d --build gaiax-bridge`
27. Seed new connectors: `curl -X POST http://bridge:8000/api/edc/seed`
28. Submit compliance for new participants: `curl -X POST http://bridge:8000/api/credentials/submit-all`
29. Test: catalog request from repair_shop to dpp should succeed

### Phase 6: Repair Shop backend
30. Create `backend/repair_api/__init__.py` and `backend/repair_api/main.py`
31. Add `"repair": "repair_api.main"` to `backend/run.py`
32. Add `repair-api` service to `docker-compose.yml`
33. Test end-to-end: `POST /api/lookup {"serialNumber":"99999999"}` should return DPP passport data

### Phase 7: Repair Shop frontend
34. Create `frontend/apps/repair/` with all files
35. Add `repair-ui` to `docker-compose.yml`
36. Add Caddy route for `repair.*`
37. Build and test: scan QR → see ski data

### Phase 8: Trace Dashboard frontend
38. Create `frontend/apps/trace-dashboard/` with all files
39. Add `trace-dashboard-ui` to `docker-compose.yml`
40. Build and test: see log timeline, click → see trace waterfall

### Phase 9: Polish and integration test
41. Write integration test script (`backend/scripts/passat_e2e_test.py`) that:
    - Logs into repair shop
    - Performs a lookup for serial 99999999
    - Verifies passport data returned
    - Checks trace events were recorded
    - Verifies Gaia-X auth events in trace
42. Run full flow end-to-end
43. Polish UI (loading states, error handling, animations)

---

## 10. Files changed (summary)

### Modified existing files

| File | Change |
|------|--------|
| `backend/run.py` | Add `dpp`, `repair`, `trace` to app map |
| `bridge/main.py` | Add participants, emit trace events |
| `bridge/edc_client.py` | Add connector/DSP entries |
| `bridge/credentials.py` | Add participant metadata |
| `docker-compose.yml` | Add 9 new services |
| `caddy/Caddyfile` | Add 5 new route blocks |
| `vendor/Template-Basic/settings.gradle.kts` | Replace example-extension → gaiax-auth-extension |
| `vendor/Template-Basic/gradle/libs.versions.toml` | Add policy-engine-spi library |
| `vendor/Template-Basic/runtimes/controlplane/build.gradle.kts` | Reference gaiax-auth-extension |
| `edc/Dockerfile.controlplane` | Remove sed that strips extension; add GAIAX_BRIDGE_URL |

### New files

| Path | Purpose |
|------|---------|
| `supabase/migrations/002_passat_schema.sql` | New tables + seed data |
| `backend/dpp_api/__init__.py` | Module init |
| `backend/dpp_api/main.py` | DPP API (FastAPI) |
| `backend/repair_api/__init__.py` | Module init |
| `backend/repair_api/main.py` | Repair Shop API (FastAPI) |
| `backend/trace_api/__init__.py` | Module init |
| `backend/trace_api/main.py` | Trace Collector API (FastAPI) |
| `vendor/Template-Basic/extensions/gaiax-auth-extension/build.gradle.kts` | Extension build |
| `vendor/Template-Basic/extensions/gaiax-auth-extension/src/main/java/org/eclipse/edc/gaiax/GaiaxAuthExtension.java` | Extension entry point |
| `vendor/Template-Basic/extensions/gaiax-auth-extension/src/main/java/org/eclipse/edc/gaiax/GaiaxComplianceFunction.java` | Policy function |
| `vendor/Template-Basic/extensions/gaiax-auth-extension/src/main/java/org/eclipse/edc/gaiax/GaiaxComplianceClient.java` | HTTP client for bridge |
| `vendor/Template-Basic/extensions/gaiax-auth-extension/src/main/resources/META-INF/services/org.eclipse.edc.spi.system.ServiceExtension` | SPI registration |
| `frontend/apps/repair/` (13+ files) | Repair Shop Next.js app |
| `frontend/apps/trace-dashboard/` (11+ files) | Trace Dashboard Next.js app |

### Total new services in Docker Compose

| Service | Image | Purpose |
|---------|-------|---------|
| `dpp-api` | backend | DPP product data API |
| `repair-api` | backend | Repair shop orchestration API |
| `trace-api` | backend | Trace event collection API |
| `dpp-edc-cp` | edc controlplane | DPP EDC control plane |
| `dpp-edc-dp` | edc dataplane | DPP EDC data plane |
| `repair-edc-cp` | edc controlplane | Repair shop EDC control plane |
| `repair-edc-dp` | edc dataplane | Repair shop EDC data plane |
| `repair-ui` | frontend | Repair shop Next.js app |
| `trace-dashboard-ui` | frontend | Trace dashboard Next.js app |

---

## 11. Logging: how trace data flows

```
  ┌─────────────┐     POST /api/traces     ┌───────────────┐
  │ repair_api  │─────────────────────────▶│               │
  └─────────────┘                          │               │
  ┌─────────────┐     POST /api/traces     │  trace_api    │     SELECT * FROM
  │ bridge      │─────────────────────────▶│  (collector)  │────▶ trace_events
  └─────────────┘                          │               │
  ┌─────────────┐     POST /api/traces     │               │
  │ dpp_api     │─────────────────────────▶│               │
  └─────────────┘                          └───────┬───────┘
                                                   │
                                           ┌───────▼───────┐
                                           │ trace-        │
                                           │ dashboard-ui  │
                                           │ (Next.js)     │
                                           └───────────────┘
```

Each service creates a `trace_id` (UUID) for every logical request and passes it
through the EDC flow. The repair-api generates the `trace_id` when `/api/lookup`
is called and includes it in all subsequent bridge/EDC calls as a header
(`X-Trace-Id`). The bridge reads this header and includes it when emitting its
own trace events. The DPP API reads the same header from the EDC data request.

The trace collector (`trace-api`) has **no auth required** for `POST /api/traces`
(internal network only) but requires JWT auth for `GET` endpoints (dashboard reads).

---

## 12. Key design decisions

1. **Gaia-X auth in EDC, not just bridge**: The extension adds a real policy
   function so EDC itself rejects non-compliant participants. The bridge
   `/api/verify` endpoint is the data source.

2. **Separate trace collector**: Decoupled from the main system_logs table.
   Trace events have `trace_id`/`span_id` for waterfall views, which is
   structurally different from the existing flat log table.

3. **Same backend Docker image**: All Python backends share one Dockerfile
   and `run.py` dispatcher. Adding a new app = adding a module + an env var.

4. **Same frontend Docker image**: All Next.js apps share one Dockerfile
   with `ARG APP_NAME`. Adding a new app = adding a folder under `apps/`.

5. **Shared UI package**: The repair shop and dashboard both import from
   `@hanover/ui` for consistent look and feel.

6. **Product model vs instance separation**: Matches the AASX file structure.
   Angles/parameters live on the product model; serial/factory/size on the
   instance.
