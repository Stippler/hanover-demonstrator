# Current End-to-End Process — Summary

Picture: [architecture-overview.svg](images/architecture-overview.svg) (full stack, both connectors). This page focuses on the **Repair API** orchestration sequence.

## Architecture Overview (linear slice)

```
┌─────────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│   Repair Shop   │       │  Repair EDC  │       │  Atomic EDC  │       │  Atomic EDC  │        │  Atomic API  │
│   (repair_api)  │──────▶│  Control     │──────▶│  Control     │──────▶│  Data Plane   │──────▶│  (atomic_api)│
│   Python/Fast   │       │  Plane (CP)  │       │  Plane (CP)  │       │  (DP)        │        │  Python/Fast │
└─────────────────┘       └──────────────┘       └──────────────┘       └──────────────┘        └──────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │  Gaia-X      │
                                                 │  Compliance  │
                                                 │  (gx-compli) │
                                                 └──────────────┘
```

## Current Flow (What Actually Happens)

When a user scans a QR code in the Repair Shop frontend, the following sequence occurs:

### Step 1 — QR Scan (repair_api)

The frontend sends `POST /api/lookup` with `{"serialNumber": "99999999"}` to `repair_api`.
`repair_api` generates a `trace_id` and emits `qr_scanned`.

**Source in trace: `repair_api`**

### Step 2 — Catalog Request (repair_api → repair-edc-cp → dpp-edc-cp)

`repair_api` makes an HTTP POST to `repair-edc-cp:9191/api/management/v3/catalog/request`,
asking it to fetch the catalog from `dpp-edc-cp:9292/api/dsp`.

Behind the scenes, `repair-edc-cp` sends a DSP catalog request to `dpp-edc-cp`.
`dpp-edc-cp` responds with its available datasets and policies.
`repair-edc-cp` returns the aggregated catalog to `repair_api`.

`repair_api` parses the catalog, finds the `dpp-ski-data` asset with the
`gaiaxCompliant eq true` policy constraint, and emits `edc_catalog_received`.

**Source in trace: `repair_api`** (but the actual work is CP-to-CP)

### Step 3 — Contract Negotiation (repair_api → repair-edc-cp ↔ dpp-edc-cp)

`repair_api` sends `POST /v3/contractnegotiations` to `repair-edc-cp`, passing the offer
policy from the catalog. `repair-edc-cp` (consumer) initiates the DSP negotiation protocol
with `dpp-edc-cp` (provider).

On the provider side (`dpp-edc-cp`), an `EventSubscriber` (`GaiaxNegotiationListener`)
fires when the `ContractNegotiationRequested` event occurs. This triggers the Gaia-X
compliance verification flow (steps 5–8 in the trace).

`repair_api` then polls `GET /v3/contractnegotiations/{id}` every second until the state
transitions from `REQUESTED` → `AGREED` → `FINALIZED`.

**Source in trace: `repair_api`** (repair_api orchestrates, but negotiation is CP-to-CP)

### Steps 5–8 — Gaia-X Verification (dpp-edc-cp extension → gx-compliance)

The `GaiaxNegotiationListener` in `dpp-edc-cp` calls `GaiaxComplianceClient.verify()`:

1. **Policy evaluation** — logs the constraint being checked
2. **VC generation** — generates 3 Verifiable Credentials (VatID, LegalPerson, Issuer) as signed JWTs (RS256)
3. **VP creation** — wraps VCs into a Verifiable Presentation JWT
4. **Compliance submission** — sends the VP-JWT to `gx-compliance:3000/api/credential-offers/standard-compliance`
5. **Compliance verified** — `gx-compliance` returns `201 Created` with a compliance VC

This runs asynchronously on the provider EDC. The negotiation state machine proceeds in
parallel, so the `compliance_verified` event often arrives after the data has already been
returned.

**Source in trace: `edc_gaiax_extension`** (runs inside dpp-edc-cp JVM)

### Step 9 — Agreement Reached (repair_api observes)

`repair_api` detects `state=FINALIZED` during polling and extracts the `contractAgreementId`.
Emits `edc_agreement_reached`.

**Source in trace: `repair_api`** (observing EDC state, not doing the work)

### Step 10 — Transfer Initiation (repair_api → repair-edc-cp ↔ dpp-edc-cp)

`repair_api` sends `POST /v3/transferprocesses` to `repair-edc-cp` with `HttpData-PULL`
transfer type. `repair-edc-cp` (consumer) negotiates the transfer with `dpp-edc-cp`
(provider), which provisions the data plane.

**Source in trace: `repair_api`** (again, repair_api initiates, EDC CPs do the work)

### Step 11 — EDR Received (repair_api ← repair-edc-cp)

`repair_api` polls `GET /v3/edrs/{transferId}/dataaddress` until `repair-edc-cp` returns
the Endpoint Data Reference (EDR), which contains:
- `endpoint`: `http://dpp-edc-dp:9291/api/public` (the provider's data plane)
- `authorization`: a signed JWT token for authenticating against the data plane

**Source in trace: `repair_api`**

### Step 12 — Data Plane Fetch (repair_api → dpp-edc-dp → dpp_api)

`repair_api` uses the EDR to make a direct HTTP GET to the provider data plane:
`GET http://dpp-edc-dp:9291/api/public/skis/99999999/passport`
with `Authorization: <EDR JWT>`.

The data plane (`dpp-edc-dp`) validates the JWT, then proxies the request to the backend
(`dpp-api:8000/api/skis/99999999/passport`) using the asset's configured auth
(`Authorization: Bearer edc-internal-2026`).

**Source in trace: `repair_api`** (makes the HTTP call to the data plane)

### Steps 13–14 — Digital Ski Passport API Handling (dpp_api)

`dpp_api` receives the request, looks up the trace ID from the trace collector,
builds the Digital Product Passport from its database, and returns it.

**Source in trace: `dpp_api`**

### Step 15 — Data Returned (repair_api)

`repair_api` receives the passport JSON, emits `dpp_data_returned`, and returns
the data to the frontend.

**Source in trace: `repair_api`**

### Step 16 — Compliance Verified (edc_gaiax_extension, late)

The asynchronous `gx-compliance` call (~6 seconds) finally completes and the extension
emits `gaiax_compliance_verified`. This arrives after the data is already returned because
the Gaia-X verification runs in a fire-and-forget thread while the EDC state machine
continues independently.

**Source in trace: `edc_gaiax_extension`**

---

## What the Trace Shows vs. What Actually Happens

| Trace step | Source label | Who actually does the work |
|---|---|---|
| 1. QR Scanned | `repair_api` | `repair_api` (correct) |
| 2. Catalog Request | `repair_api` | `repair-edc-cp` → `dpp-edc-cp` |
| 3. Catalog Received | `repair_api` | `repair-edc-cp` returns result |
| 4. Contract Negotiation | `repair_api` | `repair-edc-cp` ↔ `dpp-edc-cp` (DSP protocol) |
| 5–8. Gaia-X Verification | `edc_gaiax_extension` | Java extension inside `dpp-edc-cp` → `gx-compliance` |
| 9. Agreement Reached | `repair_api` | Both CPs finalize (observed by `repair_api`) |
| 10. Transfer Started | `repair_api` | `repair-edc-cp` ↔ `dpp-edc-cp` (DSP protocol) |
| 11. EDR Received | `repair_api` | `repair-edc-cp` provisions the token |
| 12. Data Plane Fetch | `repair_api` | `repair_api` → `dpp-edc-dp` → `dpp_api` |
| 13–14. Data handling | `dpp_api` | `dpp_api` (correct) |
| 15. Data Returned | `repair_api` | `repair_api` (correct) |
| 16. Compliance Verified | `edc_gaiax_extension` | Java extension inside `dpp-edc-cp` (correct, but late) |

## The Problem

Steps 2–4 and 9–12 are labeled as `repair_api` events because `repair_api` is the one
making the Management API calls to `repair-edc-cp`. But the actual inter-connector
communication (DSP protocol, contract negotiation, transfer provisioning, data plane proxy)
happens inside the EDC connectors.

The trace gives the impression that `repair_api` handles everything, when in reality it is
just an orchestrator that drives the EDC Management API. The EDC connectors do the real
dataspace work but emit no trace events of their own (except the Gaia-X extension).
