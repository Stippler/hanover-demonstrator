# End-to-End Tutorial: Ski Purchase → Transfers → Service

**Scope:** This tutorial targets the **legacy** multi-app stack (Vendor, VaultA, VaultB, Service, Admin). Start the stack with `docker compose -f docker-compose.yml -f docker-compose.legacy.yml` (and the extra services that implies). The **default** [docker-compose.yml](../docker-compose.yml) in this repo is the slimmer **Repair Shop ↔ DPP** demo; for that flow, see [README.md](../README.md) and [SUMMARY.md](./SUMMARY.md).

This tutorial walks through the full lifecycle: **creating a ski (purchase)** in the Vendor UI, **transferring the product passport** to the first vault (VaultA), then to the second vault (VaultB), and finally **providing passport information to the Service** shop. All steps assume the corresponding user has the correct access rights; API calls are authenticated.

---

## Prerequisites

- All services are running (`docker compose up -d`).
- Database schema is applied (see README).
- Default users (each app): **username `demo`, password `demo`** (or the accounts you configured in `APP_USERS` per service).

**Base URLs** (replace with your domain if different):

| App     | URL |
|--------|-----|
| Vendor | https://vendor.imx.vactory-projects.com |
| VaultA | https://vault-a.imx.vactory-projects.com |
| VaultB | https://vault-b.imx.vactory-projects.com |
| Service| https://service.imx.vactory-projects.com |
| Admin  | https://admin.imx.vactory-projects.com |

---

## Access Rights Overview

Every app requires **login**. Only authenticated users can use the UI and APIs.

| Participant | Role    | Can do |
|-------------|---------|--------|
| **Vendor**  | vendor  | Create skis (product passports), list own skis, view passports. Initial owner. |
| **VaultA** (owner_a) | owner | List own inventory, initiate transfer to another participant, accept incoming transfers, scan QR to select ski for transfer. |
| **VaultB** (owner_b) | owner | Same as VaultA: own inventory, send/receive transfers. |
| **Service** | service | Look up any ski by ID (scan or manual), view full passport, add service records. |

**API auth:** All `/api/*` endpoints (except `GET /api/health` and `POST /api/auth/login`) require `Authorization: Bearer <token>`. The token is obtained via login and sent by the frontend; the backend validates it and ensures the caller is acting as the correct participant.

---

## Step 1: Create a Ski (Vendor – “Buy” / Issue Passport)

1. Open **Vendor**: `https://vendor.../`
2. Log in with **demo** / **demo** (or your vendor user).
3. Go to **Create** (or Dashboard and then create a new passport).
4. Fill in the form (e.g. model, manufacturer, serial number or leave blank for auto-generated).
5. Submit. The backend:
   - Creates the ski and product passport in the database.
   - Sets **current owner** to `vendor` and adds the ski to the vendor’s inventory.
   - Records a `manufactured` passport event.

**Access:** Only an authenticated **Vendor** user can call `POST /api/skis`. The API runs as participant `vendor` and stores the ski as owned by vendor.

---

## Step 2: Transfer from Vendor to VaultA (First Owner)

1. Open **Vendor**: `https://vendor.../` (still logged in from Step 1).
2. Go to **Sell / Transfer** in the bottom nav (or **Transfer**).
3. **Select ski:** Choose the ski you created in Step 1.
4. **Buyer participant ID:** Enter `owner_a` (VaultA’s participant ID).
5. Tap **Initiate transfer**. Backend creates a **pending** transfer (seller = vendor, buyer = owner_a).
6. Open **VaultA**: `https://vault-a.../`
7. Log in (e.g. **demo** / **demo**).
8. Go to **Transfers**. You should see an **incoming** transfer for that ski.
9. Tap **Accept**.  
   - Backend: marks transfer completed, moves ski from vendor’s inventory to owner_a’s inventory, updates passport `current_owner_participant_id` to `owner_a`, logs event.

**Access:**  
- Initiate: caller must be the **seller** (owner of the ski).  
- Accept: caller must be the **buyer** (owner_a). Both are enforced by the participant API and DB checks.

---

## Step 3: Transfer from VaultA to VaultB (Second Owner)

1. Stay (or log) in **VaultA**: `https://vault-a.../`
2. Go to **Transfers** → **Send** (or scan the ski QR).
3. **Select ski:** Pick the ski that is now owned by **owner_a** (the one you accepted in Step 2).
4. **Transfer to:** Enter `owner_b`.
5. Submit. A **pending** transfer is created (seller = owner_a, buyer = owner_b).
6. Open **VaultB**: `https://vault-b.../`
7. Log in (e.g. **demo** / **demo**).
8. Go to **Transfers**. You should see the **incoming** transfer.
9. Tap **Accept**. Backend completes the transfer: ski moves to owner_b’s inventory, passport `current_owner` = owner_b.

**Access:** Only **owner_b** can accept this transfer; only **owner_a** could have initiated it (they must own the ski).

---

## Step 4: Service Reads Passport and Records a Service

1. Open **Service**: `https://service.../`
2. Log in (e.g. **demo** / **demo**).
3. Go to **Scan** (or equivalent).
4. **Scan the ski’s QR** (or enter the ski ID manually). The service app calls the Service API to look up the ski and then the **full passport** (identity, manufacturer, ownership, events, service history).
5. Open the passport view. You should see:
   - Current owner: **owner_b** (VaultB).
   - Transfer history: vendor → owner_a → owner_b.
   - Any service records already stored.
6. Optionally add a **service record** (e.g. “Tuning”, “Wax”). The Service API inserts a service record and a passport event; only an authenticated **service_shop** user can do this.

**Access:** The service API can **read** any ski/passport (by ID). **Writing** (adding service records) is restricted to the **service_shop** participant and authenticated users.

---

## Summary Flow (Current Implementation)

| Step | Actor    | Action                    | API / Data flow |
|------|----------|---------------------------|------------------|
| 1    | Vendor   | Create ski (passport)     | `POST /api/skis` (vendor-api); DB: skis, product_passports, inventories, events. |
| 2a   | Vendor   | Initiate transfer to VaultA | `POST /api/transfers` (vendor-api) from **Vendor → Sell / Transfer**; DB: ownership_transfers. |
| 2b   | VaultA   | Accept transfer           | `POST /api/transfers/{id}/accept` (vault-a-api); DB: inventories, product_passports, events. |
| 3a   | VaultA   | Initiate transfer to VaultB | `POST /api/transfers` (vault-a-api); DB: ownership_transfers. |
| 3b   | VaultB   | Accept transfer           | `POST /api/transfers/{id}/accept` (vault-b-api); DB: same as 2b. |
| 4    | Service  | Read passport, add service | `GET /api/skis/{id}/full-passport`, `POST /api/skis/{id}/service` (service-api); DB read/write. |

All of the above use **the same shared database**. Each API checks that the authenticated user’s participant matches the operation (e.g. only buyer can accept, only owner can initiate transfer).

---

## Target: Communications Over EDC Connectors

Today, participant APIs talk **only to the shared database**. To have **all communications between APIs happen over the EDC connectors** and still enforce access rights, the flow would look like this.

### Conceptual EDC Flow

1. **Vendor creates ski**  
   - Vendor API creates the ski and passport in its **own** (or a shared) store.  
   - Vendor **registers an EDC asset** for this passport (e.g. asset ID = `passport-{ski_id}`), with a **data address** pointing to the vendor’s **data plane** endpoint that serves the passport (e.g. `GET /public/passport/{ski_id}`).  
   - Policy and contract definition are created so that only intended consumers (e.g. owner_a) can request the asset.

2. **Transfer Vendor → VaultA**  
   - **VaultA (consumer)** requests the **catalog** from the **Vendor (provider)** EDC connector.  
   - VaultA **negotiates a contract** for the passport asset (with policy that reflects “transfer of ownership”).  
   - After agreement, VaultA **initiates an EDC transfer** (HttpData-PULL).  
   - VaultA’s connector receives the **EndpointDataReference** and **pulls** the passport data from the Vendor’s data plane.  
   - VaultA API **stores** the received passport in its own store and updates its **inventory** and **ownership** state.  
   - **Access:** Only the consumer that completed the contract can pull the data; EDC enforces this.

3. **Transfer VaultA → VaultB**  
   - Same pattern: **VaultB** requests catalog from **VaultA**, negotiates contract for the passport asset, initiates transfer, pulls data, and stores it.  
   - VaultA’s asset for this ski would need to be registered when it became owner (or the same asset ID with updated source URL).

4. **Service gets passport from VaultB**  
   - **Service** requests catalog from **VaultB** (current owner), negotiates for **read-only** or **service-record** permission, pulls the passport data via EDC.  
   - Service API uses the received data to display the passport and can add a **service record** (which might be sent back to the owner via another EDC transfer or a separate contract).

### What Must Change for Full EDC

- **Per-participant data source:** Each participant API (or its data plane) must expose the passport (and possibly other assets) at a **public or in-network URL** that the EDC data plane can use as `baseUrl` for the asset.  
  - Example: Vendor API exposes `GET /api/public/passport/{ski_id}` (with optional token or EDC-validated request) and the Vendor EDC asset’s `HttpData.baseUrl` points to that.
- **Asset/contract lifecycle:** When a ski is created or ownership changes, the **bridge** or the participant API must:  
  - Create/update the **asset** on the **provider’s** EDC connector.  
  - Create **contract definitions** so the right consumer(s) can request it.
- **Consumer APIs use EDC instead of DB for cross-participant data:**  
  - **VaultA** when “accepting” a transfer: call EDC (via bridge or directly) to **request catalog** from Vendor, **negotiate** contract, **initiate transfer**, **pull** data using the EDR, then **store** locally (or in a local DB).  
  - Same for VaultB from VaultA, and Service from VaultB (or current owner).  
- **Access rights:** EDC **policies** and **contract definitions** encode who can request which asset. Backend still checks that the **authenticated user** is the correct participant for the operation (e.g. only buyer can “accept”, which triggers the EDC pull and local update).

The **bridge** already has an EDC client (`edc_client.py`) for health, assets, policies, contract definitions, catalog request, contract negotiation, and transfer. The next step is to have participant APIs (or the bridge on their behalf) **register assets** when skis are created/transferred, and have **consumer APIs** (vaults, service) **call EDC** to fetch passport data instead of reading from a shared DB.

---

## Alternative: Run the Flow via REST API (with Auth)

You can drive the same flow with `curl` (or any HTTP client) using tokens from login.

1. **Login and get token (each app):**

   ```bash
   TOKEN_VENDOR=$(curl -s -X POST https://vendor.../api/auth/login \
     -H "Content-Type: application/json" -d '{"username":"demo","password":"demo"}' | jq -r .token)
   TOKEN_VAULT_A=$(curl -s -X POST https://vault-a.../api/auth/login \
     -H "Content-Type: application/json" -d '{"username":"demo","password":"demo"}' | jq -r .token)
   TOKEN_VAULT_B=$(curl -s -X POST https://vault-b.../api/auth/login \
     -H "Content-Type: application/json" -d '{"username":"demo","password":"demo"}' | jq -r .token)
   TOKEN_SERVICE=$(curl -s -X POST https://service.../api/auth/login \
     -H "Content-Type: application/json" -d '{"username":"demo","password":"demo"}' | jq -r .token)
   ```

2. **Create ski (Vendor):**

   ```bash
   curl -s -X POST https://vendor.../api/skis \
     -H "Authorization: Bearer $TOKEN_VENDOR" -H "Content-Type: application/json" \
     -d '{"model":"Demo Ski","manufacturer":"Vendor Co"}' | jq .
   # Note the returned ski id (e.g. SKI_ID).
   ```

3. **Initiate transfer Vendor → owner_a** (Vendor API exposes `POST /api/transfers`):

   ```bash
   curl -s -X POST https://vendor.../api/transfers \
     -H "Authorization: Bearer $TOKEN_VENDOR" -H "Content-Type: application/json" \
     -d "{\"ski_id\":\"$SKI_ID\",\"buyer_participant_id\":\"owner_a\"}" | jq .
   # Note the transfer id (TRANSFER_ID).
   ```

4. **Accept on VaultA:**

   ```bash
   curl -s -X POST "https://vault-a.../api/transfers/$TRANSFER_ID/accept" \
     -H "Authorization: Bearer $TOKEN_VAULT_A" | jq .
   ```

5. **Initiate transfer owner_a → owner_b (from VaultA):**

   ```bash
   curl -s -X POST https://vault-a.../api/transfers \
     -H "Authorization: Bearer $TOKEN_VAULT_A" -H "Content-Type: application/json" \
     -d "{\"ski_id\":\"$SKI_ID\",\"buyer_participant_id\":\"owner_b\"}" | jq .
   # Note the new transfer id (TRANSFER_ID2).
   ```

6. **Accept on VaultB:**

   ```bash
   curl -s -X POST "https://vault-b.../api/transfers/$TRANSFER_ID2/accept" \
     -H "Authorization: Bearer $TOKEN_VAULT_B" | jq .
   ```

7. **Service: read passport and add service record:**

   ```bash
   curl -s "https://service.../api/skis/$SKI_ID/full-passport" \
     -H "Authorization: Bearer $TOKEN_SERVICE" | jq .
   curl -s -X POST "https://service.../api/skis/$SKI_ID/service" \
     -H "Authorization: Bearer $TOKEN_SERVICE" -H "Content-Type: application/json" \
     -d '{"ski_id":"'$SKI_ID'","service_type":"Tuning","technician_name":"Tech"}' | jq .
   ```

In all cases, the **correct access rights** are enforced: only the seller can initiate a transfer for a ski they own, only the buyer can accept, and only an authenticated service user can read passports and add service records.

---

## Next Steps for EDC-Mediated Implementation

1. **Expose passport by participant:** Add a **public** (or EDC-callable) endpoint per participant that serves passport JSON for a given `ski_id` when the participant is the current owner (or has a contract). Data plane or API can proxy this.
2. **Register assets on EDC:** When a ski is created or ownership changes, create/update the **asset** and **contract definition** on the **provider’s** EDC connector (via bridge or participant API).
3. **Consumer flow:** On “accept transfer” or “fetch passport”, the consumer API calls the **bridge** or EDC to **request catalog**, **negotiate contract**, **initiate transfer**, and **pull** data via EDR; then store or use the result.
4. **Policies:** Define EDC policies so that only the intended consumer (e.g. buyer participant ID) can obtain a contract for the asset.
5. **Keep auth:** Continue to require **JWT (or API_SECRET)** on all participant APIs and map the token to the participant so that only the right user can trigger EDC operations (e.g. only buyer can trigger “accept” which runs the EDC pull).

This keeps **access rights** in place while moving **data exchange** to the EDC connectors.
