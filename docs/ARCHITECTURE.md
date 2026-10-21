# Hanover Demonstrator — Architecture & Component Guide

Visual overview: [architecture-overview.svg](images/architecture-overview.svg) (also embedded in the root [README.md](../README.md)).

This document describes how the Repair Shop communicates with the Digital Ski Passport (DPP) provider through Eclipse Dataspace Components (EDC), and which services are required vs. deprecated.

---

## Core Demo Flow: Repair → DPP via EDC

The central use case is a **Repair Shop** scanning a ski's QR code and retrieving its Digital Product Passport from the DPP provider. All data exchange is mediated by EDC connectors, enforcing access control and Gaia-X compliance.

### Sequence Overview

```
Repair UI → Repair API → Repair EDC CP → DPP EDC CP → DPP EDC DP → DPP API
                                                ↓
                                         Gaia-X check
                                                ↓
                                         gx-compliance
```

### Step-by-Step Flow

1. **QR Scan → Repair API** (`POST /api/lookup`): The repair shop frontend sends a serial number to the Repair API.

2. **Catalog Request**: The Repair API asks its own EDC Control Plane (`repair-edc-cp`) to fetch the catalog from the DPP provider's EDC Control Plane (`dpp-edc-cp`) via the DSP protocol endpoint.

3. **Contract Negotiation**: The Repair API initiates a contract negotiation using the offer from the catalog. The DPP EDC Control Plane evaluates the ODRL policy (requiring `gaiaxCompliant = true`). This triggers the Gaia-X Auth Extension:
   - **DID Resolution**: The DPP CP resolves the counterparty's DID document from `/.well-known/did.json` on the repair EDC's hostname.
   - **Verifiable Credential Generation**: A Gaia-X self-description VC is generated for the counterparty and signed with the connector's private key.
   - **Verifiable Presentation**: The VC is wrapped into a VP and submitted to `gx-compliance`.
   - **Compliance Verification**: `gx-compliance` validates the VP and returns a compliance credential.

4. **Agreement**: If the Gaia-X check passes, the negotiation transitions through REQUESTED → ACCEPTED → AGREED → FINALIZED. Both sides emit trace events.

5. **Transfer Process**: The Repair API starts an `HttpData-PULL` transfer. The DPP EDC CP provisions an Endpoint Data Reference (EDR) token, which the Repair API retrieves by polling the EDR endpoint.

6. **Data Plane Fetch**: Using the EDR token for authentication, the Repair API fetches the passport data through the DPP Data Plane (`dpp-edc-dp`), which proxies the request to the DPP API (`dpp-api`).

7. **Passport Response**: The DPP API queries the database for the ski's product model, instance details, and maintenance history, then returns the full Digital Product Passport JSON.

### Tracing

Every step emits trace events to the Trace API (`trace-api`). Sources include:
- `repair_api` — the lookup orchestration steps
- `edc_cp_dpp` — negotiation lifecycle events and Gaia-X compliance checks on the provider side
- `edc_cp_repair_shop` — negotiation lifecycle events on the consumer side
- `dpp_api` — data request/response events

The Trace Dashboard (`trace-dashboard-ui`) visualizes these events in real time, with per-trace drill-down showing the full negotiation and data transfer flow.

**Full reference** (endpoints, `trace_events` columns, event-type catalog, access matrix): open [trace-observability.html](trace-observability.html) in a browser.

---

## Active Services (docker-compose.yml)

The main `docker-compose.yml` contains only the services required for the core demo. Total: **12 containers**.

| Service | Container | Purpose |
|---|---|---|
| **Caddy** | `caddy` | Reverse proxy routing subdomains to services |
| **DPP API** | `dpp-api` | Serves Digital Product Passport data. **Self-seeds its EDC connector on startup** (asset, Gaia-X policy, contract definition). |
| **DPP EDC Control Plane** | `dpp-edc-cp` | Manages policies, contract negotiations. Enforces Gaia-X compliance via the gaiax-auth-extension. Serves DID/well-known documents via the did-web-extension. |
| **DPP EDC Data Plane** | `dpp-edc-dp` | Proxies data requests from consumers to the DPP API, authenticated via EDR tokens. |
| **Repair API** | `repair-api` | Orchestrates the full EDC flow: catalog → negotiate → transfer → fetch. |
| **Repair EDC Control Plane** | `repair-edc-cp` | Consumer-side EDC connector. Initiates negotiations on behalf of the Repair API. |
| **Repair EDC Data Plane** | `repair-edc-dp` | Consumer-side data plane. |
| **Repair UI** | `repair-ui` | Next.js frontend for the repair shop workflow. |
| **Trace API** | `trace-api` | Collects trace events. Provides the `/api/access-matrix` endpoint. |
| **Trace Dashboard** | `trace-dashboard-ui` | Event log, per-trace drill-down, statistics, access control matrix. |
| **gx-compliance** | `gx-compliance` | Gaia-X Compliance Service — validates VPs during EDC negotiations. |
| **Memgraph** | `memgraph` | Graph database used internally by gx-compliance. |

Plus the external **Supabase PostgreSQL** database.

### EDC Self-Seeding

The DPP API seeds its own EDC connector automatically on startup (with retries). No separate seeding step or bridge service is needed. The seeding registers:
- An `HttpData` asset (`dpp-ski-data`) backed by the DPP API
- A Gaia-X compliance policy (`dpp-gaiax-policy`) requiring `gaiaxCompliant = true`
- A contract definition (`dpp-contract`) linking the two

This is controlled by the `EDC_SEED_ENABLED` environment variable (default: `true`).

---

## Deprecated / Legacy Services (docker-compose.legacy.yml)

These services are preserved in `docker-compose.legacy.yml` for reference or if the broader supply-chain scenario is needed. They are **not required** for the core Repair → DPP demo.

To start them alongside the core: `docker compose -f docker-compose.yml -f docker-compose.legacy.yml up -d`

| Service | Why Deprecated |
|---|---|
| **Gaia-X Bridge** (`gaiax-bridge`) | All bridge responsibilities moved into the EDC extensions (DID hosting, Gaia-X verification) and the DPP API (EDC seeding). |
| **Vendor API + UI** | The ski manufacturer role is not part of the repair demo flow. Product data is already seeded in the database. |
| **Vendor EDC** | EDC connector for the vendor participant. Not involved in repair → DPP communication. |
| **Vault A/B API + UI** | Ski owner personal vaults. Owner-to-owner data sharing is not part of the repair flow. |
| **Owner A/B EDC** | EDC connectors for ski owners. |
| **Service API + UI** | Generic service provider role. |
| **Service EDC** | EDC connector for the service shop. |
| **Admin API + UI** | Admin dashboard. Useful but not required. |
| **gx-registry** | Gaia-X Registry for IPFS-based self-description indexing. The compliance service works without it (offline mode). |
| **gx-notary** | Gaia-X Notary for registration number validation. Not needed for the demo compliance flow. |
| **Kubo (IPFS)** | IPFS node backing gx-registry. |
| **E2E Test** | Test runner for the legacy supply-chain scenario. |

---

## EDC Extension Architecture

Each EDC Control Plane image includes two custom Java extensions:

### DID Web Extension (`did-web-extension`)
Serves `/.well-known/did.json`, `/.well-known/participant.json`, and `/.well-known/x509CertificateChain.pem` directly from the EDC connector. Reads the X.509 certificate mounted at `/app/keys/cert.pem`, extracts the RSA public key, and builds a W3C DID document with a JWK verification method. Registers on the default web context (port 8080); Caddy rewrites `/.well-known/*` to `/api/*`. The **Gaia-X legal participant** JSON is built in `did-web-extension` from `DIDWEB_PARTICIPANT_NAME`, `DIDWEB_PARTICIPANT_COUNTRY`, and optionally: `DIDWEB_REGISTRATION_COMPANY_NUMBER`, `DIDWEB_REGISTRATION_COMPANY_QUALIFIER`, and `DIDWEB_REGISTRATION_COUNTRY_CODE` (all three are required together to emit `gx:registrationNumber`); plus `DIDWEB_HEADQUARTERS_STREET`, `DIDWEB_HEADQUARTERS_LOCALITY`, `DIDWEB_HEADQUARTERS_POSTAL_CODE`, and `DIDWEB_LEGAL_STREET`, `DIDWEB_LEGAL_LOCALITY`, `DIDWEB_LEGAL_POSTAL_CODE` for addresses. Add these under `dpp-edc-cp` and `repair-edc-cp` in `docker-compose.yml` as needed. **Rebuild the control-plane image** after changing `did-web-extension`.

### Gaia-X Auth Extension (`gaiax-auth-extension`)
- **Policy function** for evaluating `gaiaxCompliant` ODRL constraints during contract negotiations.
- **Negotiation listener** subscribing to all contract negotiation and transfer process lifecycle events, emitting trace events for each.
- **Compliance client** performing the full verification flow: DID resolution → VC generation → VP assembly → gx-compliance submission → result evaluation.

---

## Network & Routing

All services communicate over a Docker bridge network (`hanover-internal`). Caddy listens on port 80 (mapped to host port 8100) and routes based on subdomain:

| Subdomain | Destination |
|---|---|
| `dpp.*` | dpp-api:8000 |
| `repair.*` | repair-api:8000 (API) / repair-ui:3000 (UI) |
| `traces.*` | trace-api:8000 (API) / trace-dashboard-ui:3000 (UI) |
| `compliance.*` | gx-compliance:3000 |
| `edc-dpp.*` | dpp-edc-cp (mgmt/DSP) / dpp-edc-dp (public) |
| `edc-repair-shop.*` | repair-edc-cp / repair-edc-dp |

The `/.well-known/*` paths on EDC subdomains are rewritten to `/api/*` and forwarded to the control plane's default web context (port 8080), where the DID Web Extension serves them.
