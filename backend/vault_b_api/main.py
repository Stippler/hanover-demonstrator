from __future__ import annotations

import json
import secrets
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from common.database import execute, fetch_all, fetch_one
from common.models import LoginRequest, TransferCreate
from common.passport import build_full_passport
from common.auth_middleware import auth_middleware
from common.auth import verify_credentials, create_token
from common.config import settings

PARTICIPANT_ID = "owner_b"

app = FastAPI(title="Owner B API")
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
    return {"status": "ok", "app": "owner_b"}


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


@app.get("/api/inventory")
async def list_inventory():
    rows = await fetch_all(
        """SELECT i.*, s.serial_number, s.model, s.manufacturer
           FROM inventories i
           JOIN skis s ON s.id = i.ski_id
           WHERE i.participant_id = $1 AND i.status = 'active'
           ORDER BY i.acquired_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.get("/api/skis")
async def list_skis(owner: str | None = Query(default=None)):
    """List skis owned by the given participant (default: current)."""
    pid = owner or PARTICIPANT_ID
    if pid != PARTICIPANT_ID:
        raise HTTPException(status_code=403, detail="Can only list own skis")
    rows = await fetch_all(
        """SELECT s.id, s.serial_number, s.model, s.manufacturer
           FROM skis s
           JOIN inventories i ON i.ski_id = s.id AND i.participant_id = $1 AND i.status = 'active'
           ORDER BY s.created_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.get("/api/skis/{ski_id}/passport")
async def get_passport(ski_id: UUID):
    inv = await fetch_one(
        "SELECT id FROM inventories WHERE ski_id = $1 AND participant_id = $2 AND status = 'active'",
        ski_id,
        PARTICIPANT_ID,
    )
    if not inv:
        raise HTTPException(status_code=403, detail="Ski not in your inventory")
    passport = await fetch_one(
        "SELECT * FROM product_passports WHERE ski_id = $1", ski_id
    )
    if not passport:
        raise HTTPException(status_code=404, detail="Passport not found")
    return passport


@app.get("/api/skis/{ski_id}/full-passport")
async def get_full_passport(ski_id: UUID):
    inv = await fetch_one(
        "SELECT id FROM inventories WHERE ski_id = $1 AND participant_id = $2 AND status = 'active'",
        ski_id,
        PARTICIPANT_ID,
    )
    if not inv:
        raise HTTPException(status_code=403, detail="Ski not in your inventory")
    data = await build_full_passport(ski_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Ski not found")
    return data


@app.get("/api/skis/{ski_id}/events")
async def get_events(ski_id: UUID):
    inv = await fetch_one(
        "SELECT id FROM inventories WHERE ski_id = $1 AND participant_id = $2 AND status = 'active'",
        ski_id,
        PARTICIPANT_ID,
    )
    if not inv:
        raise HTTPException(status_code=403, detail="Ski not in your inventory")
    rows = await fetch_all(
        "SELECT * FROM passport_events WHERE ski_id = $1 ORDER BY created_at DESC",
        ski_id,
    )
    return rows


@app.post("/api/transfers", status_code=201)
async def initiate_transfer(body: TransferCreate):
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
           VALUES ('info', 'vault_b_api', 'transfer_initiated', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"ski_id": str(body.ski_id), "buyer": body.buyer_participant_id}),
    )

    return transfer


@app.get("/api/transfers")
async def list_transfers():
    rows = await fetch_all(
        """SELECT * FROM ownership_transfers
           WHERE seller_participant_id = $1 OR buyer_participant_id = $1
           ORDER BY created_at DESC""",
        PARTICIPANT_ID,
    )
    return rows


@app.post("/api/transfers/{transfer_id}/cancel")
async def cancel_transfer(transfer_id: UUID):
    transfer = await fetch_one(
        "SELECT * FROM ownership_transfers WHERE id = $1 AND seller_participant_id = $2",
        transfer_id,
        PARTICIPANT_ID,
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending transfers can be cancelled")

    await execute(
        "UPDATE ownership_transfers SET status = 'cancelled', updated_at = now() WHERE id = $1",
        transfer_id,
    )

    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ('info', 'vault_b_api', 'transfer_cancelled', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"transfer_id": str(transfer_id)}),
    )

    return {"status": "cancelled", "transfer_id": str(transfer_id)}


@app.post("/api/transfers/{transfer_id}/accept")
async def accept_transfer(transfer_id: UUID):
    transfer = await fetch_one(
        "SELECT * FROM ownership_transfers WHERE id = $1 AND buyer_participant_id = $2",
        transfer_id,
        PARTICIPANT_ID,
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending transfers can be accepted")

    ski_id = transfer["ski_id"]
    seller = transfer["seller_participant_id"]

    await execute(
        "UPDATE ownership_transfers SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1",
        transfer_id,
    )

    await execute(
        "UPDATE inventories SET status = 'archived', archived_at = now() WHERE ski_id = $1 AND participant_id = $2 AND status = 'active'",
        ski_id,
        seller,
    )

    await execute(
        "INSERT INTO inventories (ski_id, participant_id, status) VALUES ($1, $2, 'active')",
        ski_id,
        PARTICIPANT_ID,
    )

    await execute(
        "UPDATE product_passports SET current_owner_participant_id = $1, updated_at = now(), version = version + 1 WHERE ski_id = $2",
        PARTICIPANT_ID,
        ski_id,
    )

    await execute(
        """INSERT INTO passport_events (ski_id, event_type, actor_participant_id, payload)
           VALUES ($1, 'ownership_transferred', $2, $3)""",
        ski_id,
        PARTICIPANT_ID,
        json.dumps({"from": seller, "to": PARTICIPANT_ID, "transfer_id": str(transfer_id)}),
    )

    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ('info', 'vault_b_api', 'transfer_accepted', $1, $2)""",
        PARTICIPANT_ID,
        json.dumps({"transfer_id": str(transfer_id), "ski_id": str(ski_id), "from": seller}),
    )

    return {"status": "completed", "transfer_id": str(transfer_id)}
