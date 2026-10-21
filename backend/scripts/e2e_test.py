#!/usr/bin/env python3
"""
E2E test: auth + REST API + EDC connector health.
Run from host: API_BASE_URL=http://localhost:8100 (Caddy) with Host header, or
run inside Docker network with default URLs (vendor-api:8000, etc.).
"""
from __future__ import annotations

import os
import sys

try:
    import httpx
except ImportError:
    print("pip install httpx", file=sys.stderr)
    sys.exit(1)

# When running inside Docker compose network
DEFAULT_HOST = os.environ.get("API_HOST", "localhost")
# For Caddy proxy use port 80 (or 8100 from host); for direct APIs use 8000
DEFAULT_PORT = os.environ.get("API_PORT", "8000")
BASE = os.environ.get("API_BASE_URL", f"http://{DEFAULT_HOST}:{DEFAULT_PORT}")

# Per-app base URLs (override when running against Caddy with different hosts)
VENDOR_API = os.environ.get("VENDOR_API_URL", "http://vendor-api:8000")
VAULT_A_API = os.environ.get("VAULT_A_API_URL", "http://vault-a-api:8000")
VAULT_B_API = os.environ.get("VAULT_B_API_URL", "http://vault-b-api:8000")
SERVICE_API = os.environ.get("SERVICE_API_URL", "http://service-api:8000")
ADMIN_API = os.environ.get("ADMIN_API_URL", "http://admin-api:8000")

LOGIN_USER = os.environ.get("E2E_USER", "demo")
LOGIN_PASS = os.environ.get("E2E_PASSWORD", "demo")


def main() -> int:
    errors: list[str] = []

    apis = [
        ("vendor", VENDOR_API),
        ("vault-a", VAULT_A_API),
        ("vault-b", VAULT_B_API),
        ("service", SERVICE_API),
        ("admin", ADMIN_API),
    ]

    # 1) Health checks (no auth)
    print("1. Health checks (no auth)...")
    for name, base in apis:
        try:
            r = httpx.get(f"{base}/api/health", timeout=5.0)
            if r.status_code != 200:
                errors.append(f"{name} health: status {r.status_code}")
            else:
                print(f"   {name}: ok")
        except Exception as e:
            errors.append(f"{name} health: {e}")
            print(f"   {name}: FAIL - {e}")

    # 2) Login to each API and get token
    print("\n2. Login (auth)...")
    tokens: dict[str, str] = {}
    for name, base in apis:
        try:
            r = httpx.post(
                f"{base}/api/auth/login",
                json={"username": LOGIN_USER, "password": LOGIN_PASS},
                timeout=5.0,
            )
            if r.status_code != 200:
                errors.append(f"{name} login: status {r.status_code} {r.text}")
                print(f"   {name}: FAIL - {r.status_code}")
                continue
            data = r.json()
            token = data.get("token")
            if not token:
                errors.append(f"{name} login: no token in response")
                print(f"   {name}: FAIL - no token")
                continue
            tokens[name] = token
            print(f"   {name}: ok")
        except Exception as e:
            errors.append(f"{name} login: {e}")
            print(f"   {name}: FAIL - {e}")

    # 3) Authenticated request to each API
    print("\n3. Authenticated API calls...")
    if tokens.get("vendor"):
        try:
            r = httpx.get(
                f"{VENDOR_API}/api/skis",
                headers={"Authorization": f"Bearer {tokens['vendor']}"},
                timeout=5.0,
            )
            if r.status_code != 200:
                errors.append(f"vendor /api/skis: {r.status_code}")
            else:
                print("   vendor /api/skis: ok")
        except Exception as e:
            errors.append(f"vendor /api/skis: {e}")

    if tokens.get("vault-a"):
        try:
            r = httpx.get(
                f"{VAULT_A_API}/api/inventory",
                headers={"Authorization": f"Bearer {tokens['vault-a']}"},
                timeout=5.0,
            )
            if r.status_code != 200:
                errors.append(f"vault-a /api/inventory: {r.status_code}")
            else:
                print("   vault-a /api/inventory: ok")
        except Exception as e:
            errors.append(f"vault-a /api/inventory: {e}")

    if tokens.get("admin"):
        try:
            r = httpx.get(
                f"{ADMIN_API}/api/connector-health",
                headers={"Authorization": f"Bearer {tokens['admin']}"},
                timeout=15.0,
            )
            if r.status_code != 200:
                errors.append(f"admin /api/connector-health: {r.status_code}")
            else:
                data = r.json()
                edc = data.get("edc_connectors", [])
                participants_ok = data.get("participant_apis", [])
                print(f"   admin /api/connector-health: ok (participant APIs: {len(participants_ok)}, EDC connectors: {len(edc)})")
                for c in edc:
                    status = "ok" if c.get("health") is True else "fail"
                    print(f"      EDC {c.get('participant_id', '?')}: {status}")
        except Exception as e:
            errors.append(f"admin /api/connector-health: {e}")
            print(f"   admin /api/connector-health: FAIL - {e}")

    # Summary
    print()
    if errors:
        print("FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("All E2E checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
