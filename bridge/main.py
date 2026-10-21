"""Gaia-X Verifier Bridge API.

Bridges EDC connectors with Gaia-X compliance services:
- Generates self-description VCs for each participant
- Submits VPs to gx-compliance for validation
- Stores and serves compliance credentials
- Provides verification endpoints for EDC and frontends
- Seeds EDC connectors with assets, policies, and contract definitions
"""

from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager

from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel

import httpx as _httpx

import credentials
import edc_client
from database import close_pool, execute, fetch_all, fetch_one, get_pool
from passport_lookup import get_public_passport

TRACE_COLLECTOR_URL = "http://trace-api:8000"

_pending_traces: dict[str, tuple[str, float]] = {}
_TRACE_TTL = 120


async def _emit_trace(trace_id: str | None, event_type: str, participant_id: str | None = None, payload: dict | None = None):
    if not trace_id:
        return
    try:
        async with _httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{TRACE_COLLECTOR_URL}/api/traces",
                json={
                    "trace_id": trace_id,
                    "event_type": event_type,
                    "source": "gaiax_bridge",
                    "participant_id": participant_id,
                    "payload": payload or {},
                },
            )
    except Exception:
        pass


def _store_pending_trace(participant_id: str, trace_id: str):
    now = time.monotonic()
    _pending_traces[participant_id] = (trace_id, now)
    expired = [k for k, (_, ts) in _pending_traces.items() if now - ts > _TRACE_TTL]
    for k in expired:
        del _pending_traces[k]


def _get_pending_trace(participant_id: str) -> str | None:
    entry = _pending_traces.get(participant_id)
    if entry and time.monotonic() - entry[1] < _TRACE_TTL:
        return entry[0]
    return None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="Gaia-X Verifier Bridge", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PARTICIPANTS = ["vendor", "owner_a", "owner_b", "service_shop", "dpp", "repair_shop"]


# ── Health & Status ──────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "gaiax-verifier-bridge"}


@app.get("/api/status")
async def full_status():
    """Full status of all Gaia-X and EDC services."""
    compliance = await credentials.check_compliance_health()
    registry = await credentials.check_registry_health()
    notary = await credentials.check_notary_health()

    connector_health = {}
    for p in PARTICIPANTS:
        connector_health[p] = await edc_client.get_connector_health(p)

    participants = await fetch_all(
        "SELECT id, name, role, gaiax_compliant FROM participants"
    )

    return {
        "gaiax": {
            "compliance": compliance,
            "registry": registry,
            "notary": notary,
        },
        "edc_connectors": connector_health,
        "participants": participants,
    }


# ── Gaia-X Credential Management ────────────────────────────────────


@app.get("/api/credentials/{participant_id}/self-description")
async def get_self_description(participant_id: str):
    """Get all VCs for a participant's Gaia-X compliance submission."""
    if participant_id not in PARTICIPANTS:
        raise HTTPException(404, f"Unknown participant: {participant_id}")

    vcs = credentials.create_participant_vcs(participant_id)
    return {
        "participant_id": participant_id,
        "vc_count": len(vcs),
        "vc_types": [vc["type"] for vc in vcs],
    }


@app.post("/api/credentials/{participant_id}/submit-compliance")
async def submit_compliance(participant_id: str):
    """Generate a VP with all required VCs and submit to gx-compliance."""
    if participant_id not in PARTICIPANTS:
        raise HTTPException(404, f"Unknown participant: {participant_id}")

    vcs = credentials.create_participant_vcs(participant_id)
    vc_jwts = [credentials.sign_vc_as_jwt(vc) for vc in vcs]
    holder_did = credentials._bridge_did()
    vp_jwt = credentials.create_vp_jwt(vc_jwts, holder_did)

    result = await credentials.submit_to_compliance(vp_jwt)

    is_compliant = result["success"]

    await execute(
        """UPDATE participants
           SET gaiax_compliant = $1,
               participant_json = participant_json || $2,
               updated_at = now()
           WHERE id = $3""",
        is_compliant,
        json.dumps({
            "last_compliance_check": {
                "status_code": result["status_code"],
                "success": is_compliant,
                "response_preview": result["body"][:500],
            }
        }),
        participant_id,
    )

    await execute(
        """INSERT INTO system_logs (level, source, action, participant_id, details)
           VALUES ($1, 'gaiax-bridge', 'compliance_check', $2, $3)""",
        "info" if is_compliant else "warn",
        participant_id,
        json.dumps({
            "compliance_status": result["status_code"],
            "success": is_compliant,
        }),
    )

    return {
        "participant_id": participant_id,
        "compliant": is_compliant,
        "compliance_response": result,
    }


@app.post("/api/credentials/submit-all")
async def submit_all_compliance():
    """Submit compliance for all participants."""
    results = {}
    for p in PARTICIPANTS:
        try:
            vcs = credentials.create_participant_vcs(p)
            vc_jwts = [credentials.sign_vc_as_jwt(vc) for vc in vcs]
            holder_did = credentials._bridge_did()
            vp_jwt = credentials.create_vp_jwt(vc_jwts, holder_did)

            result = await credentials.submit_to_compliance(vp_jwt)
            is_compliant = result["success"]

            await execute(
                """UPDATE participants SET gaiax_compliant = $1, updated_at = now()
                   WHERE id = $2""",
                is_compliant,
                p,
            )

            results[p] = {
                "compliant": is_compliant,
                "status_code": result["status_code"],
            }
        except Exception as e:
            results[p] = {"compliant": False, "error": str(e)}

    return results


@app.get("/api/credentials/{participant_id}/compliance-status")
async def get_compliance_status(participant_id: str):
    """Check the stored compliance status for a participant."""
    row = await fetch_one(
        "SELECT id, name, role, gaiax_compliant, participant_json FROM participants WHERE id = $1",
        participant_id,
    )
    if not row:
        raise HTTPException(404, f"Participant not found: {participant_id}")

    return {
        "participant_id": row["id"],
        "name": row["name"],
        "compliant": row["gaiax_compliant"],
        "details": row.get("participant_json"),
    }


@app.get("/api/credentials/compliance-status")
async def get_all_compliance_status():
    """Compliance status for all participants."""
    rows = await fetch_all(
        "SELECT id, name, role, gaiax_compliant FROM participants ORDER BY id"
    )
    return rows


# ── Participant Verification (called by EDC or backends) ─────────────


class VerifyRequest(BaseModel):
    participant_id: str


@app.post("/api/verify")
async def verify_participant(body: VerifyRequest):
    """Verify if a participant is Gaia-X compliant.

    EDC connectors or backend services call this before data exchange.
    Returns 200 with compliant=true if the participant is verified.
    """
    row = await fetch_one(
        "SELECT gaiax_compliant FROM participants WHERE id = $1",
        body.participant_id,
    )
    if not row:
        raise HTTPException(404, f"Unknown participant: {body.participant_id}")

    return {
        "participant_id": body.participant_id,
        "compliant": row["gaiax_compliant"],
        "verified": row["gaiax_compliant"],
    }


@app.get("/api/verify/{participant_id}")
async def verify_participant_get(participant_id: str, trace_id: str | None = None):
    """GET variant for simple verification checks (called by EDC Gaia-X extension).

    When called by the EDC Gaia-X policy extension during contract negotiation,
    trace_id is not passed as a query parameter. The bridge correlates the call
    with the active trace using the in-memory pending trace store.
    """
    if not trace_id:
        trace_id = _get_pending_trace(participant_id)

    await _emit_trace(trace_id, "gaiax_edc_policy_evaluation", participant_id, {
        "message": "EDC connector triggered Gaia-X policy constraint evaluation",
        "constraint": "gaiaxCompliant eq true",
        "participant_being_verified": participant_id,
    })

    await _emit_trace(trace_id, "gaiax_verify_credential_request", participant_id, {
        "message": "Gaia-X bridge received credential verification request from EDC connector",
        "participant": participant_id,
    })

    row = await fetch_one(
        "SELECT gaiax_compliant, participant_json FROM participants WHERE id = $1",
        participant_id,
    )
    if not row:
        await _emit_trace(trace_id, "gaiax_verify_failed", participant_id, {
            "reason": "unknown_participant",
            "message": f"Participant {participant_id} not found in registry",
        })
        raise HTTPException(404, f"Unknown participant: {participant_id}")

    verified = row["gaiax_compliant"]

    compliance_detail = {}
    if row.get("participant_json"):
        pjson = row["participant_json"] if isinstance(row["participant_json"], dict) else {}
        last_check = pjson.get("last_compliance_check", {})
        if last_check:
            compliance_detail = {
                "last_check_status": last_check.get("status_code"),
                "last_check_success": last_check.get("success"),
            }

    await _emit_trace(trace_id, "gaiax_compliance_db_lookup", participant_id, {
        "participant": participant_id,
        "compliant": verified,
        **compliance_detail,
    })

    if verified:
        await _emit_trace(trace_id, "gaiax_verify_success", participant_id, {
            "participant": participant_id,
            "compliant": True,
            "message": f"Participant {participant_id} holds valid Gaia-X compliance credential",
        })
    else:
        await _emit_trace(trace_id, "gaiax_verify_failed", participant_id, {
            "participant": participant_id,
            "compliant": False,
            "message": f"Participant {participant_id} does NOT hold valid Gaia-X compliance credential",
        })

    return {
        "participant_id": participant_id,
        "compliant": verified,
        "verified": verified,
    }


# ── Central DPP lookup (QR scan → unique product identifier, weblink per Ökodesign/DPP) ─
# See: https://de.wikipedia.org/wiki/Digitaler_Produktpass


@app.get("/api/passport/lookup/{ski_id}")
async def passport_lookup(ski_id: UUID):
    """Central lookup by unique product identifier (ski id).
    Returns public DPP data: identity, manufacturer, current owner, life-cycle summary.
    """
    data = await get_public_passport(ski_id)
    if not data:
        raise HTTPException(404, "Product pass not found")
    return data


@app.get("/p/{ski_id}", response_class=HTMLResponse)
async def passport_public_page(ski_id: UUID):
    """Public DPP page (weblink for QR/NFC). Per EU Ökodesign: unique product identifier
    and weblink to access DPP data. Renders a digital nameplate-style view.
    """
    data = await get_public_passport(ski_id)
    if not data:
        return HTMLResponse(
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>DPP not found</title></head>"
            "<body><p>Digitaler Produktpass nicht gefunden.</p></body></html>",
            status_code=404,
        )

    ski = data["ski"]
    identity = data.get("identity") or {}
    manufacturer = data.get("manufacturer") or {}
    owner = data.get("current_owner") or {}
    meta = data.get("meta") or {}

    def row(label: str, value) -> str:
        if value is None or value == "":
            return ""
        return f"<tr><td class='label'>{label}</td><td>{value}</td></tr>"

    rows = []
    rows.append(row("Produktkennung / Unique product ID", ski.get("serial_number")))
    rows.append(row("Modell", ski.get("model")))
    rows.append(row("Hersteller", identity.get("manufacturer") or ski.get("manufacturer")))
    rows.append(row("Kategorie", identity.get("category")))
    rows.append(row("Baujahr", identity.get("year")))
    rows.append(row("Länge (cm)", identity.get("length_cm")))
    rows.append(row("Aktueller Inhaber", owner.get("name")))
    rows.append(row("DPP-Version", f"v{meta.get('version', 1)}"))

    table = "".join(rows)
    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Digitaler Produktpass · {ski.get('model', 'Produkt')}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1rem; background: #f1f5f9; color: #0f172a; line-height: 1.5; }}
    .card {{ max-width: 480px; margin: 0 auto; background: #fff; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); overflow: hidden; }}
    h1 {{ margin: 0; padding: 1rem 1.25rem; font-size: 1.125rem; background: linear-gradient(135deg, #0f766e, #0d9488); color: #fff; }}
    .sub {{ font-size: 0.75rem; opacity: .9; font-weight: 500; display: block; margin-top: 0.25rem; }}
    .badge {{ display: inline-block; margin: 0 0 0.5rem 1.25rem; font-size: 0.65rem; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }}
    table {{ width: 100%; border-collapse: collapse; }}
    .label {{ padding: 0.5rem 1.25rem; color: #64748b; font-size: 0.8125rem; width: 42%; }}
    td {{ padding: 0.5rem 1.25rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9375rem; }}
    tr:last-child td {{ border-bottom: 0; }}
    .footer {{ padding: 0.75rem 1.25rem; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #f1f5f9; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{ski.get("model", "Produkt")}<span class="sub">{ski.get("serial_number", "")}</span></h1>
    <p class="badge">Digitaler Produktpass · Zugriff über Weblink (QR-Code)</p>
    <table>
      {table}
    </table>
    <p class="footer">Daten aus dem Produktlebenszyklus. DPP-System Hanover Demonstrator.</p>
  </div>
</body>
</html>"""
    return HTMLResponse(html)


# ── DID Document Hosting ────────────────────────────────────────────
# did:web:bridge.{DOMAIN}                -> /.well-known/did.json
# did:web:bridge.{DOMAIN}:api:did:{slug} -> /api/did/{slug}/did.json


@app.get("/.well-known/did.json")
async def root_did_document():
    """DID document for did:web:bridge.{DOMAIN} (the central issuer)."""
    return credentials.get_did_document("bridge")


@app.get("/.well-known/x509CertificateChain.pem")
async def x509_certificate_chain():
    """Serve the X.509 certificate used for VC/VP signing."""
    return PlainTextResponse(
        credentials.get_x509_certificate_chain(),
        media_type="application/x-pem-file",
    )


@app.get("/api/did/{participant_slug}/did.json")
async def participant_did_document(participant_slug: str):
    """DID document for did:web:bridge.{DOMAIN}:api:did:{slug}."""
    pid = participant_slug.replace("-", "_")
    if pid not in PARTICIPANTS and participant_slug != "bridge":
        raise HTTPException(404, f"Unknown participant: {participant_slug}")
    return credentials.get_did_document(pid if pid in PARTICIPANTS else participant_slug)


@app.get("/api/did/{participant_id}")
async def participant_did_info(participant_id: str):
    """Convenience endpoint to view participant DID info."""
    pid = participant_id.replace("-", "_")
    if pid not in PARTICIPANTS:
        raise HTTPException(404, f"Unknown participant: {participant_id}")
    return credentials.get_did_document(pid)


# ── EDC Connector Management ────────────────────────────────────────


@app.post("/api/edc/seed")
async def seed_edc_connectors():
    """Seed all EDC connectors with ski passport assets, policies, and contracts.

    Creates an HttpData asset backed by the participant's FastAPI backend,
    an open policy, and a contract definition for each connector.
    """
    from config import settings as bridge_settings

    backend_urls = {
        "vendor": "http://vendor-api:8000/api",
        "owner_a": "http://vault-a-api:8000/api",
        "owner_b": "http://vault-b-api:8000/api",
        "service_shop": "http://service-api:8000/api",
        "dpp": "http://dpp-api:8000/api",
        "repair_shop": "http://repair-api:8000/api",
    }

    internal_token = f"Bearer {bridge_settings.EDC_INTERNAL_SECRET}"

    results = {}
    for p_id in PARTICIPANTS:
        try:
            asset_result = await edc_client.create_asset(
                p_id,
                asset_id=f"{p_id}-ski-data",
                description=f"Ski passport data from {p_id}",
                base_url=backend_urls[p_id],
                auth_key="Authorization",
                auth_code=internal_token,
            )

            policy_result = await edc_client.create_policy(
                p_id,
                policy_id=f"{p_id}-open-policy",
            )

            contract_result = await edc_client.create_contract_definition(
                p_id,
                contract_id=f"{p_id}-contract",
                policy_id=f"{p_id}-open-policy",
                asset_id=f"{p_id}-ski-data",
            )

            results[p_id] = {
                "asset": asset_result,
                "policy": policy_result,
                "contract": contract_result,
            }

            await execute(
                """INSERT INTO system_logs (level, source, action, participant_id, details)
                   VALUES ('info', 'gaiax-bridge', 'edc_seeded', $1, $2)""",
                p_id,
                json.dumps(results[p_id]),
            )
        except Exception as e:
            results[p_id] = {"error": str(e)}

    return results


@app.get("/api/edc/{participant_id}/health")
async def edc_connector_health(participant_id: str):
    """Check health of a specific EDC connector."""
    return await edc_client.get_connector_health(participant_id)


@app.post("/api/edc/catalog")
async def request_edc_catalog(consumer_id: str, provider_id: str, request: Request):
    """Request the data catalog from a provider's connector."""
    trace_id = request.headers.get("x-trace-id")
    await _emit_trace(trace_id, "bridge_catalog_proxy", consumer_id, {
        "provider": provider_id,
        "action": "forwarding catalog request to EDC management API",
    })
    result = await edc_client.request_catalog(consumer_id, provider_id)
    await _emit_trace(trace_id, "bridge_catalog_response", consumer_id, {
        "provider": provider_id,
        "status": result.get("status"),
    })
    return result


class NegotiateRequest(BaseModel):
    consumer_id: str
    provider_id: str
    offer_id: str
    asset_id: str
    policy: dict


@app.post("/api/edc/negotiate")
async def negotiate(body: NegotiateRequest, request: Request):
    """Initiate a contract negotiation between consumer and provider."""
    trace_id = request.headers.get("x-trace-id")

    if trace_id:
        _store_pending_trace(body.consumer_id, trace_id)

    await _emit_trace(trace_id, "gaiax_edc_policy_evaluation", body.consumer_id, {
        "message": "EDC policy requires Gaia-X compliance — evaluating constraint",
        "constraint": "gaiaxCompliant eq true",
        "consumer": body.consumer_id,
        "provider": body.provider_id,
    })

    await _emit_trace(trace_id, "gaiax_verify_credential_request", body.consumer_id, {
        "message": "Verifying Gaia-X compliance credentials for both participants",
        "consumer": body.consumer_id,
        "provider": body.provider_id,
    })

    consumer_row = await fetch_one(
        "SELECT gaiax_compliant, participant_json FROM participants WHERE id = $1",
        body.consumer_id,
    )
    provider_row = await fetch_one(
        "SELECT gaiax_compliant, participant_json FROM participants WHERE id = $1",
        body.provider_id,
    )

    consumer_compliant = consumer_row and consumer_row["gaiax_compliant"]
    provider_compliant = provider_row and provider_row["gaiax_compliant"]

    await _emit_trace(trace_id, "gaiax_compliance_db_lookup", body.consumer_id, {
        "consumer": body.consumer_id,
        "consumer_compliant": consumer_compliant,
        "provider": body.provider_id,
        "provider_compliant": provider_compliant,
    })

    if consumer_compliant and provider_compliant:
        await _emit_trace(trace_id, "gaiax_verify_success", body.consumer_id, {
            "message": "Both participants hold valid Gaia-X compliance credentials",
            "consumer": body.consumer_id,
            "consumer_compliant": True,
            "provider": body.provider_id,
            "provider_compliant": True,
        })
    else:
        await _emit_trace(trace_id, "gaiax_verify_failed", body.consumer_id, {
            "message": "Gaia-X compliance verification failed for one or both participants",
            "consumer": body.consumer_id,
            "consumer_compliant": consumer_compliant,
            "provider": body.provider_id,
            "provider_compliant": provider_compliant,
        })

    compliance_check = {
        "consumer_compliant": consumer_compliant,
        "provider_compliant": provider_compliant,
    }

    await _emit_trace(trace_id, "bridge_negotiate_proxy", body.consumer_id, {
        "provider": body.provider_id,
        "asset_id": body.asset_id,
        "offer_id": body.offer_id,
        "action": "forwarding contract negotiation to EDC management API",
    })

    result = await edc_client.negotiate_contract(
        body.consumer_id,
        body.provider_id,
        body.offer_id,
        body.asset_id,
        body.policy,
    )

    return {
        "compliance_check": compliance_check,
        "negotiation": result,
    }


class TransferRequest(BaseModel):
    consumer_id: str
    provider_id: str
    contract_agreement_id: str
    asset_id: str


@app.post("/api/edc/transfer")
async def start_transfer(body: TransferRequest, request: Request):
    """Start a data transfer (HttpData-PULL)."""
    trace_id = request.headers.get("x-trace-id")
    await _emit_trace(trace_id, "bridge_transfer_proxy", body.consumer_id, {
        "provider": body.provider_id,
        "asset_id": body.asset_id,
        "agreement_id": body.contract_agreement_id,
        "transfer_type": "HttpData-PULL",
        "action": "initiating data plane transfer via EDC management API",
    })
    return await edc_client.initiate_transfer(
        body.consumer_id,
        body.contract_agreement_id,
        body.asset_id,
        body.provider_id,
    )


@app.get("/api/edc/negotiation-status")
async def get_negotiation_status(consumer_id: str, negotiation_id: str):
    """Check status of a contract negotiation."""
    return await edc_client.get_negotiation_status(consumer_id, negotiation_id)


@app.get("/api/edc/edr")
async def get_edr(consumer_id: str, transfer_id: str):
    """Get the Endpoint Data Reference for an active transfer."""
    return await edc_client.get_edr(consumer_id, transfer_id)
