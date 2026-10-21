# Hanover Demonstrator — E2E Tests (Playwright)

**Note:** These tests target the **legacy** app hostnames (`vendor.*`, `vault-a.*`, `admin.*`, …). The default [docker-compose.yml](../docker-compose.yml) stack is **Repair + DPP + trace**; smoke tests may not apply until you run the legacy compose overlay or retarget env vars.

Browser end-to-end tests that run against the **live app domains** (e.g. `vendor.imx.vactory-projects.com`). They log in, navigate, and assert that the UIs and flows work.

## Prerequisites

- **Stack running** and reachable at the chosen domain (Caddy on port 8100 or your setup).
- **Domain** must resolve to your server (or use `E2E_DOMAIN` / `E2E_PORT` for your environment).

## Configuration

| Env | Default | Description |
|-----|--------|-------------|
| `E2E_DOMAIN` | `imx.vactory-projects.com` | Base domain; each app is `{vendor,vault-a,vault-b,service,admin}.{domain}` |
| `E2E_PORT` | `8100` | Port (e.g. Caddy). Omit for 80/443. |
| `E2E_USE_HTTPS` | `false` | Set `true` for `https://` |
| `E2E_USER` | `demo` | Login username |
| `E2E_PASSWORD` | `demo` | Login password |

## Commands

```bash
# Install
pnpm install
npx playwright install chromium

# Smoke: login on each app and check dashboard
pnpm test:smoke
# or
E2E_DOMAIN=your-domain.com E2E_PORT=8100 npx playwright test smoke

# Full flow: create ski → transfer → accept → service → admin
pnpm test:full
# or
E2E_DOMAIN=your-domain.com E2E_PORT=8100 npx playwright test full-flow

# All tests
pnpm test

# Headed (see browser)
pnpm test:headed
```

## What the tests do

- **Smoke**  
  For each of Vendor, VaultA, VaultB, Service, Admin: open app → login (demo/demo) → assert redirect off `/login` and that a dashboard/inventory/scan title is visible.

- **Full flow**  
  1. Vendor: login, go to Create, fill model/manufacturer, submit → redirect to inventory.  
  2. Vendor: go to Transfer, select the new ski, buyer `owner_a`, initiate.  
  3. VaultA: login, Transfers, accept incoming transfer.  
  4. VaultA: initiate transfer to `owner_b`.  
  5. VaultB: login, Transfers, accept incoming transfer.  
  6. Service: login, Scan, manual entry with ski ID, view passport.  
  7. Admin: login, Product Passes and Transfers, assert the ski and owner_b appear.

All of this runs in a real browser against the outside domains you configure.
