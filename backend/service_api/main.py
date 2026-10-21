from __future__ import annotations

import json
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from common.database import execute, fetch_all, fetch_one
from common.models import LoginRequest, ServiceRecordCreate
from common.passport import build_full_passport
from common.auth_middleware import auth_middleware
from common.auth import verify_credentials, create_token
from common.config import settings

PARTICIPANT_ID = "service_shop"

app = FastAPI(title="Service API")
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
    return {"status": "ok", "app": "service"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, settings.APP_NAME)
    return {"token": token, "username": body.username, "app": settings.APP_NAME}


@app.get("/api/gaiax/status")
async def gaiax_status():
    participant = await fetch_one(
        "SELECT id, name, role, gaiax_compliant FROM participants WHERE id = $1",
        PARTICIPANT_ID,
    )
    all_participants = await fetch_all(
        "SELECT id, name, role, gaiax_compliant FROM participants ORDER BY id"
    )
    return {
        "participant": participant,
        "all_participants": all_participants,
        "bridge_url": "http://gaiax-bridge:8000",
    }


@app.get("/api/skis/{ski_id}")
async def get_ski(ski_id: UUID):
    ski = await fetch_one("SELECT * FROM skis WHERE id = $1", ski_id)
    if not ski:
        raise HTTPException(status_code=404, detail="Ski not found")
    return ski


@app.get("/api/skis/{ski_id}/passport")
async def get_passport(ski_id: UUID):
    passport = await fetch_one(
        "SELECT * FROM product_passports WHERE ski_id = $1", ski_id
    )
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    return passport


@app.get("/api/skis/{ski_id}/full-passport")
async def get_full_passport(ski_id: UUID):
    data = await build_full_passport(ski_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Ski not found")
    return data


@app.post("/api/skis/{ski_id}/service", status_code=201)
async def add_service_record(ski_id: UUID, body: ServiceRecordCreate):
    if body.ski_id != ski_id:
        raise HTTPException(status_code=400, detail="ski_id in body must match path")

    ski = await fetch_one("SELECT * FROM skis WHERE id = $1", ski_id)
    if not ski:
        raise HTTPException(status_code=404, detail="Ski not found")

    event = await fetch_one(
        """INSERT INTO passport_events (ski_id, event_type, actor_participant_id, payload)
           VALUES ($1, 'serviced', $2, $3)
           RETURNING *""",
        ski_id,
        PARTICIPANT_ID,
        json.dumps({
            "service_type": body.service_type,
            "description": body.description,
            "technician": body.technician_name,
        }),
    )

    record = await fetch_one(
        """INSERT INTO service_records
           (ski_id, service_participant_id, service_type, description, technician_name, notes, event_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *""",
        ski_id,
        PARTICIPANT_ID,
        body.service_type,
        body.description,
        body.technician_name,
        body.notes,
        event["id"] if event else None,
    )

    await execute(
        """UPDATE product_passports
           SET service_block = jsonb_set(
               COALESCE(service_block, '{}'),
               '{last_service}',
               $2::jsonb
           ),
           version = version + 1,
           updated_at = now()
           WHERE ski_id = $1""",
        ski_id,
        json.dumps({
            "type": body.service_type,
            "date": record["created_at"].isoformat() if record and record.get("created_at") else None,
            "technician": body.technician_name,
        }),
    )

    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ('info', 'service_api', 'service_recorded', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"ski_id": str(ski_id), "service_type": body.service_type}),
    )

    return record


@app.get("/api/stats")
async def get_stats():
    """Dashboard stats: total services, this week, unique skis serviced."""
    total = await fetch_one(
        "SELECT count(*) AS count FROM service_records WHERE service_participant_id = $1",
        PARTICIPANT_ID,
    )
    # Start of current week (Monday 00:00)
    now = datetime.utcnow()
    weekday = now.weekday()
    start_week = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
    this_week = await fetch_one(
        """SELECT count(*) AS count FROM service_records
           WHERE service_participant_id = $1 AND created_at >= $2""",
        PARTICIPANT_ID,
        start_week,
    )
    unique_skis = await fetch_one(
        "SELECT count(DISTINCT ski_id) AS count FROM service_records WHERE service_participant_id = $1",
        PARTICIPANT_ID,
    )
    last_service = await fetch_one(
        """SELECT created_at FROM service_records
           WHERE service_participant_id = $1 ORDER BY created_at DESC LIMIT 1""",
        PARTICIPANT_ID,
    )
    return {
        "servicesCompleted": total["count"] if total else 0,
        "thisWeek": this_week["count"] if this_week else 0,
        "skisScanned": unique_skis["count"] if unique_skis else 0,
        "lastServiceAt": last_service["created_at"].isoformat() if last_service and last_service.get("created_at") else None,
    }


@app.get("/api/events")
async def list_events(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Recent passport events (for dashboard). Same shape as admin /api/events."""
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


@app.get("/api/service-records")
async def list_service_records():
    rows = await fetch_all(
        """SELECT sr.*, s.serial_number, s.model
           FROM service_records sr
           JOIN skis s ON s.id = sr.ski_id
           WHERE sr.service_participant_id = $1
           ORDER BY sr.created_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.get("/api/service-records/{record_id}")
async def get_service_record(record_id: UUID):
    record = await fetch_one(
        "SELECT * FROM service_records WHERE id = $1 AND service_participant_id = $2",
        record_id,
        PARTICIPANT_ID,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Service record not found")
    return record
