"""Central lookup for DPP by ski id. Used for QR scan → public passport view."""

from __future__ import annotations

import json
from uuid import UUID

from database import fetch_all, fetch_one


def _parse_block(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return {}


async def get_public_passport(ski_id: UUID) -> dict | None:
    """Load ski + product passport + current owner from central DB.
    Returns a public view (identity, manufacturer, current owner, service summary).
    """
    ski = await fetch_one("SELECT id, serial_number, model, manufacturer FROM skis WHERE id = $1", ski_id)
    if not ski:
        return None

    passport = await fetch_one(
        "SELECT current_owner_participant_id, identity_block, manufacturer_block, service_block, version, created_at, updated_at FROM product_passports WHERE ski_id = $1",
        ski_id,
    )
    if not passport:
        return None

    owner = await fetch_one(
        "SELECT id, name, role, gaiax_compliant FROM participants WHERE id = $1",
        passport["current_owner_participant_id"],
    )

    service_records = await fetch_all(
        "SELECT service_type, description, technician_name, created_at FROM service_records WHERE ski_id = $1 ORDER BY created_at DESC",
        ski_id,
    )

    return {
        "ski": dict(ski),
        "identity": _parse_block(passport.get("identity_block")),
        "manufacturer": _parse_block(passport.get("manufacturer_block")),
        "current_owner": dict(owner) if owner else None,
        "service_count": len(service_records),
        "last_service": _parse_block(passport.get("service_block")) if passport.get("service_block") else None,
        "meta": {
            "version": passport.get("version", 1),
            "created_at": str(passport["created_at"]) if passport.get("created_at") else None,
            "updated_at": str(passport["updated_at"]) if passport.get("updated_at") else None,
        },
    }
