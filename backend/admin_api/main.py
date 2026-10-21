from __future__ import annotations

import asyncio
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from common.database import fetch_all, fetch_one
from common.auth_middleware import auth_middleware
from common.models import LoginRequest
from common.auth import verify_credentials, create_token
from common.config import settings

PARTICIPANT_API_HOSTS = [
    ("vendor", "vendor-api", 8000),
    ("owner_a", "vault-a-api", 8000),
    ("owner_b", "vault-b-api", 8000),
    ("service_shop", "service-api", 8000),
]
# EDC control plane health is on port 8080, path /api/check/health (same as bridge)
EDC_CP_HOSTS = [
    ("vendor", "vendor-edc-cp", 8080),
    ("owner_a", "owner-a-edc-cp", 8080),
    ("owner_b", "owner-b-edc-cp", 8080),
    ("service_shop", "service-edc-cp", 8080),
]
EDC_HEALTH_PATH = "/api/check/health"

app = FastAPI(title="Admin API")
app.add_middleware(auth_middleware())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "admin"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, settings.APP_NAME)
    return {"token": token, "username": body.username, "app": settings.APP_NAME}


@app.get("/api/gaiax/status")
async def gaiax_status():
    all_participants = await fetch_all(
        "SELECT id, name, role, gaiax_compliant FROM participants ORDER BY id"
    )
    return {
        "participant": None,
        "all_participants": all_participants,
        "bridge_url": "http://gaiax-bridge:8000",
    }


@app.get("/api/participants")
async def list_participants():
    rows = await fetch_all("SELECT * FROM participants ORDER BY id")
    return rows


@app.get("/api/skis")
async def list_skis():
    rows = await fetch_all("SELECT * FROM skis ORDER BY created_at DESC")
    return rows


@app.get("/api/passports")
async def list_passports():
    """List all digital product passes with ski identity and current owner name."""
    rows = await fetch_all(
        """SELECT pp.id, pp.ski_id, pp.current_owner_participant_id, pp.version,
                  pp.created_at, pp.updated_at,
                  s.serial_number, s.model, s.manufacturer,
                  p.name AS current_owner_name
           FROM product_passports pp
           JOIN skis s ON s.id = pp.ski_id
           LEFT JOIN participants p ON p.id = pp.current_owner_participant_id
           ORDER BY pp.updated_at DESC"""
    )
    return rows


@app.get("/api/events")
async def list_events(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    rows = await fetch_all(
        """SELECT pe.*, s.serial_number, p.name AS actor_name
           FROM passport_events pe
           JOIN skis s ON s.id = pe.ski_id
           LEFT JOIN participants p ON p.id = pe.actor_participant_id
           ORDER BY pe.created_at DESC
           LIMIT $1 OFFSET $2""",
        limit,
        offset,
    )
    total = await fetch_one("SELECT count(*) AS count FROM passport_events")
    return {"items": rows, "total": total["count"] if total else 0, "limit": limit, "offset": offset}


@app.get("/api/transfers")
async def list_transfers():
    rows = await fetch_all(
        """SELECT ot.*, s.serial_number,
                  sp.name AS seller_name, bp.name AS buyer_name
           FROM ownership_transfers ot
           JOIN skis s ON s.id = ot.ski_id
           LEFT JOIN participants sp ON sp.id = ot.seller_participant_id
           LEFT JOIN participants bp ON bp.id = ot.buyer_participant_id
           ORDER BY ot.created_at DESC"""
    )
    return rows


@app.get("/api/logs")
async def list_logs(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    rows = await fetch_all(
        """SELECT * FROM system_logs
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2""",
        limit,
        offset,
    )
    total = await fetch_one("SELECT count(*) AS count FROM system_logs")
    return {"items": rows, "total": total["count"] if total else 0, "limit": limit, "offset": offset}


@app.get("/api/stats")
async def get_stats():
    skis = await fetch_one("SELECT count(*) AS count FROM skis")
    events = await fetch_one("SELECT count(*) AS count FROM passport_events")
    transfers = await fetch_one("SELECT count(*) AS count FROM ownership_transfers")
    services = await fetch_one("SELECT count(*) AS count FROM service_records")
    return {
        "total_skis": skis["count"] if skis else 0,
        "total_events": events["count"] if events else 0,
        "total_transfers": transfers["count"] if transfers else 0,
        "total_services": services["count"] if services else 0,
    }


async def _check_health(host: str, port: int, path: str = "/api/health") -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"http://{host}:{port}{path}")
            return {"status": "up" if r.status_code == 200 else "error", "status_code": r.status_code}
    except Exception as e:
        return {"status": "down", "error": str(e)}


@app.get("/api/connector-health")
async def connector_health():
    """Aggregated health of participant APIs and EDC control planes."""
    participant_tasks = [
        _check_health(host, port) for _, host, port in PARTICIPANT_API_HOSTS
    ]
    edc_tasks = [
        _check_health(host, port, EDC_HEALTH_PATH)
        for _, host, port in EDC_CP_HOSTS
    ]
    # EDC may use different path; fallback to root
    participant_results = await asyncio.gather(*participant_tasks, return_exceptions=False)
    edc_results = await asyncio.gather(*edc_tasks, return_exceptions=False)
    participant_apis = [
        {"participant_id": pid, "host": host, "health": participant_results[i]}
        for i, (pid, host, _) in enumerate(PARTICIPANT_API_HOSTS)
    ]
    edc_connectors = [
        {"participant_id": pid, "host": host, "health": edc_results[i]}
        for i, (pid, host, _) in enumerate(EDC_CP_HOSTS)
    ]
    return {
        "participant_apis": participant_apis,
        "edc_connectors": edc_connectors,
    }
