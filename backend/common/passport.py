from __future__ import annotations

import json
from uuid import UUID

from common.database import fetch_all, fetch_one


def _parse_block(raw) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return {}


async def build_full_passport(ski_id: UUID) -> dict:
    """Build the rich full-passport payload used by all participant APIs."""
    ski = await fetch_one("SELECT * FROM skis WHERE id = $1", ski_id)
    if not ski:
        return None

    passport = await fetch_one("SELECT * FROM product_passports WHERE ski_id = $1", ski_id)

    owner = await fetch_one(
        "SELECT id, name, role, gaiax_compliant FROM participants WHERE id = $1",
        passport["current_owner_participant_id"] if passport else None,
    ) if passport else None

    events = await fetch_all(
        """SELECT pe.*, p.name AS actor_name
           FROM passport_events pe
           LEFT JOIN participants p ON p.id = pe.actor_participant_id
           WHERE pe.ski_id = $1 ORDER BY pe.created_at DESC""",
        ski_id,
    )

    service_records = await fetch_all(
        """SELECT sr.*, p.name AS service_participant_name
           FROM service_records sr
           LEFT JOIN participants p ON p.id = sr.service_participant_id
           WHERE sr.ski_id = $1 ORDER BY sr.created_at DESC""",
        ski_id,
    )

    transfer_history = await fetch_all(
        """SELECT ot.*,
                  sp.name AS seller_name,
                  bp.name AS buyer_name
           FROM ownership_transfers ot
           LEFT JOIN participants sp ON sp.id = ot.seller_participant_id
           LEFT JOIN participants bp ON bp.id = ot.buyer_participant_id
           WHERE ot.ski_id = $1 ORDER BY ot.created_at DESC""",
        ski_id,
    )

    return {
        "ski": ski,
        "passport": passport,
        "identity": _parse_block(passport["identity_block"] if passport else None),
        "manufacturer": _parse_block(passport["manufacturer_block"] if passport else None),
        "ownership": {
            "current_owner": owner,
            "history": transfer_history,
        },
        "service": {
            "last_service": _parse_block(passport["service_block"] if passport else None),
            "records": service_records,
            "total_services": len(service_records),
        },
        "events": events,
        "meta": {
            "version": passport["version"] if passport else 1,
            "created_at": str(passport["created_at"]) if passport else None,
            "updated_at": str(passport["updated_at"]) if passport else None,
        },
    }
