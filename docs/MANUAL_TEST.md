# Manual test checklist (hosted website)

**Scope:** Checklist for the **legacy** admin + vendor + vault + service apps. The default stack documented in the root [README.md](../README.md) is **Repair + DPP + trace**; use that README for URLs and flows there.

Use this to verify every step by clicking through the UI. Base URL: your hosted domain (e.g. `https://admin.imx.vactory-projects.com`).

## Admin

1. **Login / open admin** – Open admin app URL. You should see the top navbar and "System Overview" below.
2. **Navbar** – Click **Dashboard**, **Participants**, **Events**, **Transfers**, **Logs**. Each page should load (no 404).
3. **Apps dropdown** – Click **Apps** in the top right; open **Vendor**, **VaultA**, **VaultB**, **Peak Service** in new tabs. Each should load.
4. **Language toggle** – Click **DE** / **EN**. UI language should switch; label should be centered.
5. **Theme toggle** – Click sun/moon. Light/dark should switch.
6. **Dashboard** – On Dashboard: "Last updated" and **Live** badge visible. Click **refresh** (circle icon). Stats should update.
7. **EDC / Connector health** – In "EDC Activity & Connector Health": **Participant APIs** and **EDC Control Planes** should each show 4 rows with green checkmarks (vendor, owner_a, owner_b, service_shop). If any red, EDC or backend is down.
8. **Participants** – Page lists 4 participants with Gaia-X status.
9. **Events** – List of events (e.g. manufactured, serviced). Search if present.
10. **Transfers** – List (may be empty). Columns: From, To, Ski, Status.
11. **Logs** – Table with Zeit, Level, Dienst, Nachricht, Details. Details should be pretty-printed JSON, not raw escaped.

## Vendor

1. Open Vendor app. Dashboard / inventory with skis.
2. **New Passport** – Create a ski; fill form, submit. Redirect to inventory and new ski appears.
3. **Ski detail** – Open a ski; passport and **Download PNG** (QR) work.

## VaultA / VaultB

1. Open VaultA (vault-a.* or owner-a.*) and VaultB (vault-b.* or owner-b.*). Each shows its vault inventory.
2. **Transfers** – From VaultA: Initiate transfer to owner_b. From VaultB: accept or reject if any pending.

## Peak Service

1. Open Service app. Hero and "Scan a Ski" CTA.
2. **Stats** – "Services Done", "This Week", "Skis Scanned" and "Last service" line show (may be 0).
3. **Scan** – Use camera or manual entry; open a ski passport then **Record Service**. Submit; record appears in **History**.
4. **History** – List of service records.

## EDC connectors (backend)

- Admin dashboard **EDC Activity & Connector Health** is the main place to see if EDC is working: all 4 Participant APIs and all 4 EDC Control Planes should be **up** (green). If not, check backend and EDC containers (e.g. `docker compose ps`).
