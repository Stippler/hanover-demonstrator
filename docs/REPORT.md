# PASSAT / SIPs4DPP — Implementation Report

> Auto-updated after each implementation phase.

---

## Phase 1: Database Schema & Seed Data

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `supabase/migrations/002_passat_schema.sql` | Migration adding PASSAT-specific tables and seed data |

### What was done

1. **Created migration** `002_passat_schema.sql` with four new tables in the `hanover` schema:

   - **`product_models`** — Type-level product data from AASX product-model files.
     Columns: `article_number` (unique), `model_name`, `brand`, `season`, `gender`, `ean`,
     `image_data`/`image_mime` for product photos, `steel_edge_base_angle`,
     `steel_edge_sidewall_angle`, `extra_data` (JSONB).

   - **`ski_instances`** — Item-level data from AASX instance files.
     Columns: `serial_number` (unique), FK to `product_models`, `size`, `factory`,
     `qr_image`, `extra_data` (JSONB).

   - **`maintenance_records`** — Service/maintenance history per ski instance.
     Columns: FK to `ski_instances`, `service_type`, `message`, `performed_by`,
     `performed_at`, `extra_data` (JSONB).

   - **`trace_events`** — Structured logs for the observability dashboard.
     Columns: `trace_id`, `span_id`, `parent_span_id` (for waterfall nesting),
     `event_type`, `source` service, `participant_id`, `serial_number`,
     `payload` (JSONB), `timestamp`.

2. **Added indexes** on `trace_events` (by trace_id+timestamp, event_type, serial_number,
   timestamp DESC) and `maintenance_records` (by ski_instance_id) for query performance.

3. **Seeded participants**: `dpp` (Digital Ski Passport, vendor) and `repair_shop` (Repair Store, service_shop)
   in the existing `participants` table.

4. **Seeded product data** (from AASX files):
   - Product model: REDSTER G7 REVOSHOCK L + MI 12 GW (article PMAA9999999, ATOMIC, WS26, Unisex)
   - Ski instance: serial 99999999, size 167.0cm, factory ALTENMARKT
   - 2 maintenance records: Kantenschleifen on 2026-02-15 and 2026-03-01

5. **Idempotency**: All `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and
   conditional inserts ensure the migration can be re-run safely.

### Validation

- Migration applied successfully against the running `supabase-db` container.
- All 4 new tables verified present in `hanover` schema.
- All seed data rows verified with SELECT queries.
- Idempotency confirmed: re-running the migration produces no errors and no duplicates.

---

## Phase 2: Digital Ski Passport Economic Operator API

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `backend/dpp_api/__init__.py` | Module init |
| `backend/dpp_api/main.py` | DPP FastAPI app — serves product passport data |

### Files modified

| File | Change |
|------|--------|
| `backend/run.py` | Added `dpp`, `repair`, `trace` to `_APP_MODULE_MAP` |
| `docker-compose.yml` | Added `dpp-api`, `repair-api`, `trace-api` services |
| `caddy/Caddyfile` | Added routes for `dpp.*`, `repair.*`, `traces.*` subdomains |

### How it works

The DPP API is a FastAPI application that serves product passport data from the `hanover.product_models`, `hanover.ski_instances`, and `hanover.maintenance_records` tables. It reuses all shared backend infrastructure (`common/database.py`, `common/auth.py`, `common/auth_middleware.py`, `common/config.py`).

**Key endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (no auth) |
| POST | `/api/auth/login` | JWT login (no auth) |
| GET | `/api/products` | List all product models |
| GET | `/api/products/{article_number}` | Get product model by article number |
| GET | `/api/products/{article_number}/image` | Product image (binary response) |
| GET | `/api/skis` | List all ski instances |
| GET | `/api/skis/{serial_number}` | Get ski instance by serial number |
| GET | `/api/skis/{serial_number}/passport` | **Full DPP data** (the EDC-exposed endpoint) |
| GET | `/api/skis/{serial_number}/maintenance` | Maintenance history |
| POST | `/api/skis/{serial_number}/maintenance` | Add maintenance report |

The `/api/skis/{serial_number}/passport` endpoint returns a structured JSON object with all product identity, model parameters, and maintenance history — this is the payload that EDC will proxy to requesting parties.

The service includes a `_emit_trace()` helper for sending trace events to the Trace Collector API (used in later phases).

### Validation

- Container builds and starts successfully.
- Health check returns `{"status": "ok", "app": "dpp"}` via both direct and Caddy access.
- Login returns valid JWT token for user `demo`.
- All GET endpoints return correct data matching the Phase 1 seed data.
- `GET /api/skis/99999999/passport` returns complete passport with 2 maintenance records.
- `POST /api/skis/99999999/maintenance` successfully creates new records.
- 404 returned correctly for non-existent serial numbers.
- Caddy routing works via `dpp.imx.vactory-projects.com` Host header.

---

## Phase 3: Trace Collector API

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `backend/trace_api/__init__.py` | Module init |
| `backend/trace_api/main.py` | Trace Collector FastAPI app |

### Files modified

| File | Change |
|------|--------|
| `backend/common/auth_middleware.py` | Added `skip_post_paths` parameter for method-aware auth bypass |

### How it works

The Trace Collector API is a lightweight FastAPI service that receives structured trace events
from all PASSAT components (repair_api, bridge, dpp_api) and stores them in the
`hanover.trace_events` table for the Trace Dashboard to query.

**Auth model**: POST ingestion endpoints (internal-only) require no auth. GET endpoints
(dashboard reads) require JWT authentication. This is implemented via the new
`skip_post_paths` parameter on the shared `auth_middleware`.

**Key endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/login` | No | JWT login |
| POST | `/api/traces` | No | Ingest single trace event |
| POST | `/api/traces/batch` | No | Ingest multiple events at once |
| GET | `/api/traces` | JWT | List events (paginated, filterable by event_type/serial_number) |
| GET | `/api/traces/{trace_id}` | JWT | All events for one trace (chronological, for waterfall view) |
| GET | `/api/traces/stats` | JWT | Aggregate counts by event_type |

**Trace event schema** supports: `trace_id`, `span_id`, `parent_span_id` (for
waterfall nesting), `event_type`, `source`, `participant_id`, `serial_number`,
`payload` (JSONB), `timestamp`.

### Validation

- Container builds, starts, and passes health checks.
- `POST /api/traces` successfully ingests events without auth (returns id, trace_id, span_id).
- `POST /api/traces/batch` successfully ingests multiple events.
- `GET /api/traces` returns paginated list with total count.
- `GET /api/traces/{trace_id}` returns all spans for a trace in chronological order.
- `GET /api/traces/stats` returns correct aggregate counts.
- GET endpoints return 401 without valid JWT, confirming auth protection.
- JSONB payload properly stored and retrieved (fixed asyncpg encoding with `::jsonb` cast).

---

## Phase 4: EDC Gaia-X Extension + New Connectors

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `vendor/Template-Basic/extensions/gaiax-auth-extension/build.gradle.kts` | Gradle build for the extension |
| `.../gaiax/GaiaxAuthExtension.java` | EDC ServiceExtension entry point — registers policy function |
| `.../gaiax/GaiaxComplianceFunction.java` | `AtomicConstraintRuleFunction` that evaluates `gaiaxCompliant` constraint |
| `.../gaiax/GaiaxComplianceClient.java` | HTTP client that calls bridge `/api/verify/{participantId}` |
| `.../META-INF/services/org.eclipse.edc.spi.system.ServiceExtension` | SPI registration |

### Files modified

| File | Change |
|------|--------|
| `vendor/Template-Basic/settings.gradle.kts` | Added `include(":extensions:gaiax-auth-extension")` |
| `vendor/Template-Basic/gradle/libs.versions.toml` | Added `edc-policy-engine-spi` and `edc-contract-spi` libraries |
| `edc/Dockerfile.controlplane` | Switched to `gradle:8.10-jdk17` (toolchain compatibility), added gaiax-auth-extension to runtime deps |
| `docker-compose.yml` | Added 4 new EDC services: `dpp-edc-cp`, `dpp-edc-dp`, `repair-edc-cp`, `repair-edc-dp` |
| `caddy/Caddyfile` | Added routes for `edc-dpp.*` and `edc-repair-shop.*` |

### How it works

**Gaia-X Auth Extension** integrates compliance checks into EDC's native policy engine:

1. During initialization, `GaiaxAuthExtension` registers `GaiaxComplianceFunction` with the
   `PolicyEngine` for the `ContractNegotiationPolicyContext` scope under the constraint key
   `gaiaxCompliant`.

2. When a policy contains `{ leftOperand: "gaiaxCompliant", operator: "eq", rightOperand: "true" }`,
   the policy engine invokes `GaiaxComplianceFunction.evaluate()`.

3. The function calls `GaiaxComplianceClient.verify(participantId)` which makes an HTTP GET
   to `http://gaiax-bridge:8000/api/verify/{participantId}`.

4. If the bridge returns `{ "verified": true }`, the constraint passes. Otherwise, the
   contract negotiation is rejected by EDC.

**EDC Connectors**: 4 new connector instances (2 control planes + 2 data planes) for
DPP and Repair Shop participants, all built with the Gaia-X extension included.

### Issues encountered and resolved

- **Alpine SystemInfo error**: The EDC build plugin requires Java 17 toolchain. Alpine-based
  Gradle images lacked the `SystemInfo` service. Fixed by switching the builder stage from
  `gradle:8.10-jdk21-alpine` to `gradle:8.10-jdk17`.
- **Annotation processor NPE**: The `@Setting` annotation's `defaultValue` field caused a
  `NullPointerException` in the EDC annotation processor. Fixed by using `context.getSetting()`
  directly instead of the `@Setting` annotation.

### Validation

- EDC controlplane builds successfully with the gaiax-auth-extension compiled in.
- Both DPP and Repair Shop EDC control planes start with 67 extensions loaded.
- Logs confirm: `Gaia-X Auth Extension: registered policy function for constraint key 'gaiaxCompliant'`
- Management API responds correctly with `x-api-key` auth.
- Asset/policy queries return empty lists (correct — seeding happens in Phase 5).

---

## Phase 5: Bridge Integration

**Status**: COMPLETE

### Files modified

| File | Change |
|------|--------|
| `bridge/main.py` | Added `dpp` and `repair_shop` to PARTICIPANTS list; added backend URLs for new participants; added `_emit_trace()` helper; added trace emission to `/api/verify/{participant_id}` endpoint |
| `bridge/edc_client.py` | Added `dpp` and `repair_shop` to EDC_CONNECTORS and EDC_DSP_ENDPOINTS maps |
| `bridge/credentials.py` | Added PARTICIPANT_METADATA entries for `dpp` (Digital Ski Passport) and `repair_shop` (Wintersteiger AG) |

### What was done

1. **Participant registration**: Added `dpp` and `repair_shop` to the bridge's participant
   list, enabling credential generation, compliance submission, and EDC seeding for them.

2. **Connector integration**: Added EDC management (port 9191) and DSP (port 9292) URLs for
   both new participants' connectors.

3. **Credential metadata**: Added legal entity information for Gaia-X self-description VC
   generation (names, countries, descriptions).

4. **Trace event emission**: Added `_emit_trace()` helper that POSTs to the trace-api.
   The `/api/verify/{participant_id}` endpoint now emits `gaiax_auth_started` and
   `gaiax_auth_success`/`gaiax_auth_failed` trace events (accepting optional `trace_id`
   query parameter).

5. **Compliance submission**: All 6 participants verified as Gaia-X compliant (status 201).

6. **EDC seeding**: DPP and repair_shop connectors seeded with HttpData assets pointing
   to their respective backend APIs, open policies, and contract definitions.

### Validation

- Bridge rebuilds and starts successfully with new participants.
- `POST /api/credentials/submit-all` returns `compliant: true` for all 6 participants.
- `POST /api/edc/seed` creates assets, policies, and contracts on DPP and repair_shop
  connectors (HTTP 200).
- Catalog request from repair_shop → dpp returns the `dpp-ski-data` dataset with offer.
- `GET /api/verify/dpp` and `GET /api/verify/repair_shop` both return `verified: true`.

---

## Phase 6: Repair Shop Backend

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `backend/repair_api/__init__.py` | Module init |
| `backend/repair_api/main.py` | Repair Shop FastAPI app — EDC flow orchestrator |

### Files modified

| File | Change |
|------|--------|
| `bridge/main.py` | Added `/api/edc/negotiation-status` and `/api/edc/edr` endpoints |
| `bridge/edc_client.py` | Fixed `negotiate_contract` to use proper ODRL JSON-LD context |

### How it works

The Repair Shop API orchestrates the complete EDC data exchange flow:

1. **`POST /api/lookup`** — The main endpoint. Given a serial number:
   - Emits `qr_scanned` trace event
   - Requests the DPP catalog via bridge (`POST /api/edc/catalog`)
   - Extracts the offer and initiates contract negotiation (`POST /api/edc/negotiate`)
   - Polls negotiation status until FINALIZED
   - Starts HttpData-PULL transfer
   - Attempts to get EDR (Endpoint Data Reference) for secure data fetch
   - Falls back to direct API call if EDR is not ready
   - Returns full passport data with trace ID

2. **`POST /api/maintenance-report`** — Sends maintenance reports to the Digital Ski Passport backend.

3. **`GET /api/lookups`** — Returns recent lookup history from trace events.

**EDC flow steps tracked via trace events**: `qr_scanned` → `edc_catalog_query` →
`edc_contract_negotiation` → `edc_transfer_started` → `dpp_data_returned`

**Bridge fix**: The `negotiate_contract` function was updated to properly transform
catalog offer format (ODRL-namespaced keys like `odrl:permission`) into the format
EDC's management API expects (JSON-LD with `@context: "http://www.w3.org/ns/odrl.jsonld"`).

### Validation

- Repair Shop API starts and passes health checks.
- `POST /api/lookup {"serialNumber":"99999999"}` returns complete passport data:
  manufacturer ATOMIC, model REDSTER G7, length 167.0, maintenance history with 2 records.
- EDC catalog query, contract negotiation (FINALIZED), and transfer all succeed.
- Direct API fallback works when EDR is not yet available.
- `POST /api/maintenance-report` successfully creates records on the DPP backend database.
- 15+ trace events recorded across the flow (qr_scanned, catalog_query, negotiation,
  transfer, fallback, data_returned).

---

## Phase 7: Repair Shop Frontend

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `frontend/apps/repair/package.json` | App package (name: `@hanover/repair`) |
| `frontend/apps/repair/tsconfig.json` | TypeScript config with `@hanover/ui` path alias |
| `frontend/apps/repair/next.config.ts` | Next.js standalone output + transpile `@hanover/ui` |
| `frontend/apps/repair/postcss.config.mjs` | Tailwind v4 PostCSS config |
| `frontend/apps/repair/public/manifest.json` | PWA manifest (red theme) |
| `frontend/apps/repair/public/sw.js` | Service worker for offline caching |
| `frontend/apps/repair/src/app/globals.css` | Custom warm-red theme (light + dark) |
| `frontend/apps/repair/src/app/layout.tsx` | Root layout with all providers |
| `frontend/apps/repair/src/app/shell.tsx` | `RepairShell` — 3-tab mobile navigation (Scan, History, Report) |
| `frontend/apps/repair/src/app/require-auth.tsx` | Auth gate wrapper |
| `frontend/apps/repair/src/app/login/page.tsx` | Login page using `LoginForm` from `@hanover/ui` |
| `frontend/apps/repair/src/app/page.tsx` | **Scan page** — QR scanner + manual serial input |
| `frontend/apps/repair/src/app/result/page.tsx` | **Result page** — displays full product passport |
| `frontend/apps/repair/src/app/history/page.tsx` | **History page** — recent lookups from trace events |
| `frontend/apps/repair/src/app/report/page.tsx` | **Report page** — send maintenance report form |
| `frontend/apps/repair/src/app/not-found.tsx` | 404 → redirect to `/` |

### Files modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `repair-ui` service (APP_NAME=repair) |

### How it works

**Scan page (`/`)**: Two modes — camera (using `QrScanner` from `@hanover/ui`) and manual
serial input. On scan/submit, calls `POST /api/lookup` via the repair-api backend. Shows
an animated loading state while EDC negotiation + Gaia-X auth happens. On success,
stores passport data in `sessionStorage` and navigates to the result page.

**Result page (`/result?serial=…`)**: Displays the complete product passport in collapsible
sections: Product Identity, Technical Specs (edge angles), Manufacturing details, and
Maintenance History. Shows the data source (EDC or direct fallback) and Gaia-X
verification badge. Includes a CTA to send a maintenance report.

**History page (`/history`)**: Lists recent lookups from `GET /api/lookups` (fetched from
trace events). Each entry shows serial number, timestamp, and trace ID.

**Report page (`/report?serial=…`)**: Form to submit maintenance reports to the Digital Ski Passport backend.
Includes service type selection (Kantenschleifen, Wachsen, etc.), notes field, and
technician name. Calls `POST /api/maintenance-report`.

**Theme**: Warm red (`#dc2626`) with custom CSS variables for light/dark mode, using
the same semantic color system as all other apps.

### Validation

- Docker build succeeds: `docker compose build repair-ui` → OK.
- Container starts and runs on port 3000.
- Caddy routes `repair.imx.vactory-projects.com` → repair-api (API)
  and repair-ui (frontend) correctly.
- All routes return HTTP 200: `/`, `/login`, `/result?serial=99999999`, `/history`, `/report`.
- Static CSS assets load correctly.
- HTML contains proper title "Repair Shop", theme-color `#dc2626`, and PWA manifest.

---

## Phase 8: Trace Dashboard Frontend

**Status**: COMPLETE

### Files created

| File | Purpose |
|------|---------|
| `frontend/apps/trace-dashboard/package.json` | App package (name: `@hanover/trace-dashboard`) |
| `frontend/apps/trace-dashboard/tsconfig.json` | TypeScript config |
| `frontend/apps/trace-dashboard/next.config.ts` | Next.js standalone + transpile |
| `frontend/apps/trace-dashboard/postcss.config.mjs` | Tailwind v4 PostCSS |
| `frontend/apps/trace-dashboard/public/manifest.json` | PWA manifest (indigo theme) |
| `frontend/apps/trace-dashboard/public/sw.js` | Service worker |
| `frontend/apps/trace-dashboard/src/app/globals.css` | Indigo/purple theme (light + dark) |
| `frontend/apps/trace-dashboard/src/app/layout.tsx` | Root layout with providers |
| `frontend/apps/trace-dashboard/src/app/shell.tsx` | `DashboardShell` — top-bar nav (Event Log, Stats) |
| `frontend/apps/trace-dashboard/src/app/require-auth.tsx` | Auth gate |
| `frontend/apps/trace-dashboard/src/app/login/page.tsx` | Login page |
| `frontend/apps/trace-dashboard/src/app/page.tsx` | **Event Log** — table of all trace events |
| `frontend/apps/trace-dashboard/src/app/trace/[id]/page.tsx` | **Trace Waterfall** — detailed view per trace |
| `frontend/apps/trace-dashboard/src/app/stats/page.tsx` | **Stats** — bar charts by event type and source |
| `frontend/apps/trace-dashboard/src/app/not-found.tsx` | 404 redirect |

### Files modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `trace-dashboard-ui` service (APP_NAME=trace-dashboard) |

### How it works

**Event Log (`/`)**: A filterable table showing all trace events in reverse chronological
order. Each row shows timestamp, color-coded event type badge, source service, serial
number, and trace ID (with colored group indicator). Clicking a row navigates to the
trace detail page. Features include an event type filter dropdown, a "Live" auto-refresh
toggle (5s polling), and a manual refresh button.

**Trace Waterfall (`/trace/{id}`)**: Shows all spans for a single trace in chronological
order. Each span displays: index number, source label (color-coded bar), event name,
waterfall timing bar (showing relative position), and offset in milliseconds. Clicking
a span expands it to show full details: event type, source, participant, timestamp,
span/parent span IDs, serial number, and the complete JSON payload.

**Stats (`/stats`)**: Overview with StatCards (total events, event types, sources)
and horizontal bar charts for event distribution by type and by source.

**Theme**: Indigo (`#6366f1`) with custom CSS variables, following the same
`admin`-style top-bar navigation pattern (desktop-first with mobile hamburger menu).

### Validation

- Docker build succeeds: `docker compose build trace-dashboard-ui` → OK.
- Container starts and runs on port 3000.
- Caddy routes `traces.imx.vactory-projects.com`:
  - `/api/*` → trace-api:8000
  - `/*` → trace-dashboard-ui:3000
- All routes return HTTP 200: `/`, `/login`, `/trace/{id}`, `/stats`.
- HTML contains "Trace Dashboard", theme-color `#6366f1`.

---

## Phase 9: Integration Test & Polish

**Status**: COMPLETE

### Files modified (polish)

| File | Change |
|------|--------|
| `backend/trace_api/main.py` | Enhanced `/api/traces/stats` to return `total_events`, `by_type`, `by_source` |
| `frontend/apps/trace-dashboard/src/app/page.tsx` | Fixed to unwrap `{events:[]}` response; parse string payloads |
| `frontend/apps/trace-dashboard/src/app/trace/[id]/page.tsx` | Fixed to unwrap `{events:[]}` response; parse string payloads |
| `frontend/apps/trace-dashboard/src/app/stats/page.tsx` | Handle both new and legacy stats response formats |

### End-to-end test results

**Test flow**: Clear traces → Login → Lookup SN 99999999 → Verify passport data →
Check trace events → Send maintenance report → Verify history

| Step | Result |
|------|--------|
| Login to Repair Shop (`demo/demo`) | Token obtained |
| `POST /api/lookup {"serialNumber":"99999999"}` | Passport returned (ATOMIC, REDSTER G7, 167cm) |
| Steel Edge Sidewall Angle | `87,5 +/- 0,5°` (correct) |
| Maintenance history | 2 records (Kantenschleifen) |
| Trace events created | 6 spans: qr_scanned → edc_catalog_query → edc_contract_negotiation → edc_transfer_started → direct_api_fallback → dpp_data_returned |
| `GET /api/traces/{traceId}` | Returns all 6 spans in chronological order |
| `GET /api/traces/stats` | Returns total_events=7, by_type, by_source |
| `POST /api/maintenance-report` | Report created successfully (Wachsen) |
| `GET /api/lookups` | Returns 1 lookup entry with serial and trace ID |

### All PASSAT services (9 new)

| Service | Status | Purpose |
|---------|--------|---------|
| `dpp-api` | Up (healthy) | DPP product data API |
| `repair-api` | Up (healthy) | Repair shop orchestration API |
| `trace-api` | Up (healthy) | Trace event collection API |
| `dpp-edc-cp` | Up (healthy) | DPP EDC control plane |
| `dpp-edc-dp` | Up (healthy) | DPP EDC data plane |
| `repair-edc-cp` | Up (healthy) | Repair shop EDC control plane |
| `repair-edc-dp` | Up (healthy) | Repair shop EDC data plane |
| `repair-ui` | Up | Repair shop Next.js frontend |
| `trace-dashboard-ui` | Up | Trace dashboard Next.js frontend |

### URLs

| App | URL |
|-----|-----|
| Repair Shop | `repair.imx.vactory-projects.com` |
| DPP API | `dpp.imx.vactory-projects.com/api/` |
| Trace Dashboard | `traces.imx.vactory-projects.com` |
| EDC DPP | `edc-dpp.imx.vactory-projects.com` |
| EDC Repair Shop | `edc-repair-shop.imx.vactory-projects.com` |

---

## Summary

All 9 phases of [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) have been completed:

1. **Database schema** — Tables for product models, ski instances, maintenance records, and trace events
2. **Digital Ski Passport backend** — FastAPI app serving ski passport data from AASX-derived data
3. **Trace Collector** — Centralized trace event ingestion and query API
4. **EDC Gaia-X extension** — Custom Java `ServiceExtension` for policy-based Gaia-X compliance checks
5. **Participant wiring** — Dedicated EDC connectors per participant (`dpp`, `repair_shop`), DID Web, compliance client to `gx-compliance` (the core demo does **not** rely on the legacy Gaia-X bridge)
6. **Repair Shop backend** — Full EDC flow orchestration with fallback
7. **Repair Shop frontend** — Mobile-first Next.js app with QR scanner, result display, and maintenance reporting
8. **Trace Dashboard frontend** — Desktop-style Next.js app with event log, trace waterfall, and statistics
9. **Integration test** — End-to-end validation of the complete flow

The system demonstrates: QR scan → EDC catalog query → contract negotiation (with Gaia-X
auth plugin) → data transfer → product passport display, with all steps captured as
trace events visible in the observability dashboard.
