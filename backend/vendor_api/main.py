from __future__ import annotations

import json
import secrets
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from common.database import execute, fetch_all, fetch_one
from common.models import LoginRequest, PassportEventCreate, Ski, SkiCreate, TransferCreate
from common.passport import build_full_passport
from common.auth_middleware import auth_middleware
from common.auth import verify_credentials, create_token
from common.config import settings

PARTICIPANT_ID = "vendor"

app = FastAPI(title="Vendor API")
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
    return {"status": "ok", "app": "vendor"}


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


@app.get("/api/skis")
async def list_skis():
    rows = await fetch_all(
        "SELECT * FROM skis WHERE vendor_participant_id = $1 ORDER BY created_at DESC",
        PARTICIPANT_ID,
    )
    return rows


@app.post("/api/skis", status_code=201)
async def create_ski(body: SkiCreate):
    serial = body.serial_number or f"SKI-{secrets.token_hex(4).upper()}"

    ski = await fetch_one(
        """INSERT INTO skis (serial_number, model, manufacturer, production_batch, vendor_participant_id, qr_payload)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *""",
        serial,
        body.model,
        body.manufacturer,
        body.production_batch,
        PARTICIPANT_ID,
        json.dumps({"serial": serial, "vendor": PARTICIPANT_ID}),
    )
    if ski is None:
        raise HTTPException(status_code=500, detail="Failed to create ski")

    ski_id = ski["id"]

    # Build rich identity block from all provided fields
    identity_block: dict = {
        "serial_number": serial,
        "model": body.model,
        "manufacturer": body.manufacturer,
    }
    for field in ("category", "year", "length_cm", "width_mm", "radius_m",
                  "weight_kg", "skill_level", "terrain", "color", "material",
                  "country_of_origin", "notes"):
        val = getattr(body, field, None)
        if val is not None:
            identity_block[field] = val

    manufacturer_block: dict = {
        "vendor": PARTICIPANT_ID,
        "production_batch": body.production_batch,
    }
    for field in ("binding_model", "binding_din_range", "year"):
        val = getattr(body, field, None)
        if val is not None:
            manufacturer_block[field] = val

    await execute(
        """INSERT INTO product_passports
           (ski_id, current_owner_participant_id, identity_block, manufacturer_block,
            ownership_block, service_block, snapshot_json)
           VALUES ($1, $2, $3, $4, '{}', '{}', '{}')""",
        ski_id,
        PARTICIPANT_ID,
        json.dumps(identity_block),
        json.dumps(manufacturer_block),
    )

    await execute(
        """INSERT INTO passport_events (ski_id, event_type, actor_participant_id, payload)
           VALUES ($1, 'manufactured', $2, $3)""",
        ski_id,
        PARTICIPANT_ID,
        json.dumps({"serial_number": serial, "model": body.model, **identity_block}),
    )

    await execute(
        """INSERT INTO inventories (ski_id, participant_id, status)
           VALUES ($1, $2, 'active')""",
        ski_id,
        PARTICIPANT_ID,
    )

    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ('info', 'vendor_api', 'ski_created', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"ski_id": str(ski_id), "serial": serial}),
    )

    return ski


@app.get("/api/skis/{ski_id}")
async def get_ski(ski_id: UUID):
    ski = await fetch_one(
        "SELECT * FROM skis WHERE id = $1 AND vendor_participant_id = $2",
        ski_id,
        PARTICIPANT_ID,
    )
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
    """Returns the complete passport: ski info + all passport blocks + event history + service records."""
    data = await build_full_passport(ski_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Ski not found")
    return data


@app.get("/api/skis/{ski_id}/events")
async def get_events(ski_id: UUID):
    rows = await fetch_all(
        """SELECT pe.*, p.name AS actor_name
           FROM passport_events pe
           LEFT JOIN participants p ON p.id = pe.actor_participant_id
           WHERE pe.ski_id = $1 ORDER BY pe.created_at DESC""",
        ski_id,
    )
    return rows


@app.get("/api/inventory")
async def list_inventory():
    rows = await fetch_all(
        """SELECT i.*, s.serial_number, s.model
           FROM inventories i
           JOIN skis s ON s.id = i.ski_id
           WHERE i.participant_id = $1 AND i.status = 'active'
           ORDER BY i.acquired_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.get("/api/transfers")
async def list_transfers():
    """List transfers where vendor is seller or buyer (for UI: "sell to customer")."""
    rows = await fetch_all(
        """SELECT ot.*, s.serial_number AS ski_serial, s.model AS ski_model
           FROM ownership_transfers ot
           JOIN skis s ON s.id = ot.ski_id
           WHERE ot.seller_participant_id = $1 OR ot.buyer_participant_id = $1
           ORDER BY ot.created_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.post("/api/transfers", status_code=201)
async def initiate_transfer(body: TransferCreate):
    """Vendor sells a ski to a buyer (e.g. owner_a). Creates pending transfer; buyer accepts in their vault."""
    inv = await fetch_one(
        "SELECT id FROM inventories WHERE ski_id = $1 AND participant_id = $2 AND status = 'active'",
        body.ski_id,
        PARTICIPANT_ID,
    )
    if not inv:
        raise HTTPException(status_code=400, detail="Ski not in your inventory")

    token = secrets.token_urlsafe(32)
    transfer = await fetch_one(
        """INSERT INTO ownership_transfers
           (ski_id, seller_participant_id, buyer_participant_id, status, transfer_token)
           VALUES ($1, $2, $3, 'pending', $4)
           RETURNING *""",
        body.ski_id,
        PARTICIPANT_ID,
        body.buyer_participant_id,
        token,
    )
    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ('info', 'vendor_api', 'transfer_initiated', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"ski_id": str(body.ski_id), "buyer": body.buyer_participant_id}),
    )
    return transfer
