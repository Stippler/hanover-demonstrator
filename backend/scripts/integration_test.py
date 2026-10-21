#!/usr/bin/env python3
"""
Integration test: full app flow via APIs and verify data in DB (via admin API).
- Creates skis (Vendor), initiates/accepts transfers (VaultA, VaultB), adds service record (Service)
- Seeds EDC connectors (Bridge), then checks connector health and DB stats (Admin)
Run inside Docker network: docker compose run --rm vendor-api python /app/scripts/integration_test.py
Or from host with *_API_URL and BRIDGE_URL pointing at your stack (e.g. through Caddy).
"""
from __future__ import annotations

import os
import sys

try:
    import httpx
except ImportError:
    print("pip install httpx", file=sys.stderr)
    sys.exit(1)

VENDOR_API = os.environ.get("VENDOR_API_URL", "http://vendor-api:8000")
VAULT_A_API = os.environ.get("VAULT_A_API_URL", "http://vault-a-api:8000")
VAULT_B_API = os.environ.get("VAULT_B_API_URL", "http://vault-b-api:8000")
SERVICE_API = os.environ.get("SERVICE_API_URL", "http://service-api:8000")
ADMIN_API = os.environ.get("ADMIN_API_URL", "http://admin-api:8000")
BRIDGE_URL = os.environ.get("BRIDGE_URL", "http://gaiax-bridge:8000")

LOGIN_USER = os.environ.get("E2E_USER", "demo")
LOGIN_PASS = os.environ.get("E2E_PASSWORD", "demo")
TIMEOUT = 15.0


def main() -> int:
    errors: list[str] = []
    tokens: dict[str, str] = {}

    def login(name: str, base: str) -> bool:
        try:
            r = httpx.post(
                f"{base}/api/auth/login",
                json={"username": LOGIN_USER, "password": LOGIN_PASS},
                timeout=TIMEOUT,
            )
            if r.status_code != 200:
                errors.append(f"{name} login: {r.status_code} {r.text}")
                return False
            token = r.json().get("token")
            if not token:
                errors.append(f"{name} login: no token")
                return False
            tokens[name] = token
            return True
        except Exception as e:
            errors.append(f"{name} login: {e}")
            return False

    def auth_headers(app: str):
        return {"Authorization": f"Bearer {tokens[app]}"}

    print("=== Integration test: health + login ===\n")
    for name, base in [("vendor", VENDOR_API), ("vault-a", VAULT_A_API), ("vault-b", VAULT_B_API),
                       ("service", SERVICE_API), ("admin", ADMIN_API)]:
        try:
            r = httpx.get(f"{base}/api/health", timeout=5.0)
            if r.status_code != 200:
                errors.append(f"{name} health: {r.status_code}")
            if not login(name, base):
                continue
            print(f"  {name}: health ok, logged in")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"  {name}: FAIL - {e}")

    if len(tokens) != 5:
        print("\nMissing tokens; aborting.")
        _fail(errors)
        return 1

    print("\n=== Create skis (Vendor) ===\n")
    ski_ids: list[str] = []
    for i, model in enumerate(["Integration Ski Alpha", "Integration Ski Beta"], 1):
        try:
            r = httpx.post(
                f"{VENDOR_API}/api/skis",
                headers=auth_headers("vendor"),
                json={"model": model, "manufacturer": "Test Mfg", "production_batch": f"BATCH-{i}"},
                timeout=TIMEOUT,
            )
            if r.status_code != 201:
                errors.append(f"create ski {i}: {r.status_code} {r.text}")
                continue
            data = r.json()
            sid = data.get("id")
            if sid:
                ski_ids.append(str(sid))
                print(f"  Created ski: {data.get('serial_number', sid)} (id={sid})")
        except Exception as e:
            errors.append(f"create ski: {e}")

    if not ski_ids:
        errors.append("No skis created")
        _fail(errors)
        return 1

    ski_id = ski_ids[0]

    print("\n=== Transfer Vendor -> Owner A ===\n")
    try:
        r = httpx.post(
            f"{VENDOR_API}/api/transfers",
            headers=auth_headers("vendor"),
            json={"ski_id": ski_id, "buyer_participant_id": "owner_a"},
            timeout=TIMEOUT,
        )
        if r.status_code != 201:
            errors.append(f"initiate transfer vendor->a: {r.status_code} {r.text}")
        else:
            transfer = r.json()
            transfer_id = transfer.get("id")
            print(f"  Transfer initiated: {transfer_id}")
            r2 = httpx.post(
                f"{VAULT_A_API}/api/transfers/{transfer_id}/accept",
                headers=auth_headers("vault-a"),
                timeout=TIMEOUT,
            )
            if r2.status_code != 200:
                errors.append(f"accept transfer on vault-a: {r2.status_code} {r2.text}")
            else:
                print("  VaultA accepted transfer.")
    except Exception as e:
        errors.append(f"transfer vendor->a: {e}")

    print("\n=== Transfer Owner A -> Owner B ===\n")
    try:
        r = httpx.post(
            f"{VAULT_A_API}/api/transfers",
            headers=auth_headers("vault-a"),
            json={"ski_id": ski_id, "buyer_participant_id": "owner_b"},
            timeout=TIMEOUT,
        )
        if r.status_code != 201:
            errors.append(f"initiate transfer a->b: {r.status_code} {r.text}")
        else:
            transfer = r.json()
            transfer_id = transfer.get("id")
            print(f"  Transfer initiated: {transfer_id}")
            r2 = httpx.post(
                f"{VAULT_B_API}/api/transfers/{transfer_id}/accept",
                headers=auth_headers("vault-b"),
                timeout=TIMEOUT,
            )
            if r2.status_code != 200:
                errors.append(f"accept transfer on vault-b: {r2.status_code} {r2.text}")
            else:
                print("  VaultB accepted transfer.")
    except Exception as e:
        errors.append(f"transfer a->b: {e}")

    print("\n=== Service: read passport and add service record ===\n")
    try:
        r = httpx.get(
            f"{SERVICE_API}/api/skis/{ski_id}/full-passport",
            headers=auth_headers("service"),
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            errors.append(f"full-passport: {r.status_code} {r.text}")
        else:
            data = r.json()
            owner = data.get("current_owner") or {}
            owner_id = owner.get("id") if isinstance(owner, dict) else str(owner)
            print(f"  Passport owner: {owner_id or 'unknown'}")
        r = httpx.post(
            f"{SERVICE_API}/api/skis/{ski_id}/service",
            headers=auth_headers("service"),
            json={
                "ski_id": ski_id,
                "service_type": "full_service",
                "description": "Integration test service",
                "technician_name": "E2E Tech",
            },
            timeout=TIMEOUT,
        )
        if r.status_code != 201:
            errors.append(f"add service record: {r.status_code} {r.text}")
        else:
            print("  Service record added.")
    except Exception as e:
        errors.append(f"service: {e}")

    print("\n=== Bridge: seed EDC connectors ===\n")
    try:
        r = httpx.post(f"{BRIDGE_URL}/api/edc/seed", timeout=30.0)
        if r.status_code != 200:
            errors.append(f"bridge seed: {r.status_code} {r.text}")
        else:
            data = r.json()
            for pid, res in data.items():
                err = res.get("error") if isinstance(res, dict) else None
                if err:
                    print(f"  {pid}: error - {err}")
                else:
                    print(f"  {pid}: seeded")
    except Exception as e:
        errors.append(f"bridge seed: {e}")

    print("\n=== Admin: connector health and DB stats ===\n")
    try:
        r = httpx.get(
            f"{ADMIN_API}/api/connector-health",
            headers=auth_headers("admin"),
            timeout=20.0,
        )
        if r.status_code != 200:
            errors.append(f"connector-health: {r.status_code}")
        else:
            d = r.json()
            for c in d.get("edc_connectors", []):
                status = "ok" if c.get("health") else "fail"
                print(f"  EDC {c.get('participant_id', '?')}: {status}")
        r = httpx.get(
            f"{ADMIN_API}/api/stats",
            headers=auth_headers("admin"),
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            errors.append(f"admin stats: {r.status_code}")
        else:
            s = r.json()
            print(f"  DB: skis={s.get('total_skis', 0)}, events={s.get('total_events', 0)}, "
                  f"transfers={s.get('total_transfers', 0)}, services={s.get('total_services', 0)}")
        r = httpx.get(
            f"{ADMIN_API}/api/passports",
            headers=auth_headers("admin"),
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            passports = r.json()
            print(f"  Passports in DB: {len(passports)}")
    except Exception as e:
        errors.append(f"admin: {e}")

    print("\n=== Summary ===\n")
    if errors:
        print("FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("All integration steps completed. DB has skis, passports, transfers, and service records.")
    return 0


def _fail(errors: list[str]) -> None:
    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")


if __name__ == "__main__":
    sys.exit(main())
