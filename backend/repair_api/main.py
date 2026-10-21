"""Repair Shop API — EDC-secured access to Digital Product Passport via dataspace.

Architecture:  repair-api → repair-EDC → (Gaia-X + DSP) → dpp-EDC → dpp-api → AAS
All data flows through EDC data planes.  No polling, no fallbacks.
EDC callbacks notify when negotiation/transfer complete, then blocking GETs retrieve results.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse, parse_qs

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from common.auth import create_token, verify_credentials
from common.auth_middleware import auth_middleware
from common.config import settings
from common.database import execute, fetch_all, fetch_one
from common.models import LoginRequest

PARTICIPANT_ID = "repair_shop"
TRACE_COLLECTOR_URL = os.getenv("TRACE_COLLECTOR_URL", "http://trace-api:8000")

EDC_MGMT_URL = os.getenv("EDC_MGMT_URL", "http://repair-edc-cp:9191/api/management")
EDC_API_KEY = os.getenv("EDC_API_KEY", "password")
DPP_DSP_URL = os.getenv("DPP_DSP_URL", "http://dpp-edc-cp:9292/api/dsp")
CALLBACK_BASE = os.getenv("EDC_CALLBACK_URL", "http://repair-api:8000")
EDR_TTL_SECONDS = int(os.getenv("EDR_TTL_SECONDS", "60"))

_edc_lock = asyncio.Lock()
_edc_cached: dict | None = None  # {agreement_id, asset_id, edr_endpoint, edr_auth_key, edr_auth_code, ...}
_edc_cached_at: float = 0  # epoch when the EDR was obtained
_edc_session_info: dict | None = None  # Credential/session metadata for the access-control page

_waiters: dict[str, asyncio.Future] = {}

app = FastAPI(title="Repair Shop API")
app.add_middleware(auth_middleware(extra_skip_paths=("/api/products", "/api/edc", "/api/edc/status")))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LookupRequest(BaseModel):
    serialNumber: str


class MaintenanceReportRequest(BaseModel):
    serialNumber: str
    serviceType: str
    message: Optional[str] = None
    performedBy: Optional[str] = None


def _edc_headers() -> dict:
    return {"x-api-key": EDC_API_KEY, "Content-Type": "application/json"}


def _extract_serial(raw: str) -> str:
    raw = raw.strip()
    if "wseqr.amersports.com" in raw or "?" in raw:
        qs = parse_qs(urlparse(raw).query)
        candidates = qs.get("sn", [])
        if candidates:
            return candidates[0]
    return raw


def _jld(body: dict, key: str, default="") -> str:
    return body.get(key, body.get(f"edc:{key}", default))


def _decode_jwt_exp(token: str) -> int | None:
    """Extract the `exp` claim from a JWT without verifying the signature."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("exp")
    except Exception:
        return None


async def _emit_trace(
    trace_id: str,
    event_type: str,
    serial_number: str | None = None,
    payload: dict | None = None,
    parent_span_id: str | None = None,
    *,
    source: str = "repair_api",
):
    span_id = str(uuid.uuid4())
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.post(
                f"{TRACE_COLLECTOR_URL}/api/traces",
                json={
                    "trace_id": trace_id, "span_id": span_id,
                    "parent_span_id": parent_span_id, "event_type": event_type,
                    "source": source, "participant_id": PARTICIPANT_ID,
                    "serial_number": serial_number, "payload": payload or {},
                },
            )
    except Exception:
        pass
    return span_id


# ── EDC callback ─────────────────────────────────────────────────────────────

@app.post("/api/edc/callback")
async def edc_callback(request: Request):
    """Receives EDC lifecycle callbacks.  Since callbackAddresses already filters
    events, any matching negotiation/transfer ID means the event we subscribed to fired."""
    body = await request.json()
    payload = body.get("payload", body)

    neg_id = _jld(payload, "contractNegotiationId")
    if neg_id and f"neg:{neg_id}" in _waiters:
        f = _waiters[f"neg:{neg_id}"]
        if not f.done():
            f.set_result(payload)

    tp_id = _jld(payload, "transferProcessId")
    if tp_id and f"tp:{tp_id}" in _waiters:
        f = _waiters[f"tp:{tp_id}"]
        if not f.done():
            f.set_result(payload)

    return {"ok": True}


async def _await_edc(key: str, timeout: float = 20.0) -> dict:
    """Block until EDC callback fires. Raises on timeout — no fallback."""
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    _waiters[key] = fut
    try:
        return await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(504, f"EDC callback timeout ({key})")
    finally:
        _waiters.pop(key, None)


def _cb(events: list[str]) -> list[dict]:
    return [{"uri": f"{CALLBACK_BASE}/api/edc/callback", "events": events, "transactional": False}]


# ── EDC flow ─────────────────────────────────────────────────────────────────

async def _ensure_edr(client: httpx.AsyncClient, trace_id: str, serial: str, root_span: str) -> dict:
    """Ensure we have a valid EDR.  Returns cached EDR or runs full negotiation.
    Raises HTTPException on any failure — no fallbacks."""
    global _edc_cached, _edc_cached_at
    _edc = "repair_shop_edc"

    async with _edc_lock:
        if _edc_cached is not None:
            if time.time() - _edc_cached_at < EDR_TTL_SECONDS:
                return _edc_cached
            # TTL expired — force re-negotiation
            _edc_cached = None
            _edc_cached_at = 0

    # ── Catalog ──
    catalog_span = await _emit_trace(trace_id, "edc_catalog_query", serial, {
        "dsp_endpoint": DPP_DSP_URL,
        "message": f"Querying DPP catalog at {DPP_DSP_URL}",
    }, root_span, source=_edc)

    catalog_resp = await client.post(
        f"{EDC_MGMT_URL}/v3/catalog/request",
        json={
            "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
            "@type": "CatalogRequest",
            "counterPartyAddress": DPP_DSP_URL,
            "protocol": "dataspace-protocol-http",
        },
        headers=_edc_headers(),
    )
    if catalog_resp.status_code != 200:
        raise HTTPException(502, f"EDC catalog request failed ({catalog_resp.status_code})")

    dataset = catalog_resp.json().get("dcat:dataset", {})
    if isinstance(dataset, list):
        dataset = dataset[0] if dataset else {}
    offer = dataset.get("odrl:hasPolicy", {})
    offer_id, asset_id = offer.get("@id", ""), dataset.get("@id", "")
    if not offer_id or not asset_id:
        raise HTTPException(502, "DPP catalog contains no valid offer")

    await _emit_trace(trace_id, "edc_catalog_received", serial, {
        "asset_id": asset_id, "offer_id": offer_id,
        "message": f"Catalog: asset '{asset_id}' with Gaia-X policy",
    }, catalog_span, source=_edc)

    # ── Negotiate (callback-driven) ──
    neg_span = await _emit_trace(trace_id, "edc_contract_negotiation", serial, {
        "asset_id": asset_id,
        "message": "Initiating contract negotiation — Gaia-X verification required",
    }, root_span, source=_edc)

    # Reformat catalog policy to EDC management API format
    offer_policy = {
        "@context": "http://www.w3.org/ns/odrl.jsonld",
        "@id": offer_id,
        "@type": "Offer",
        "assigner": "dpp",
        "target": asset_id,
        "permission": [{
            "action": "use",
            "constraint": {
                "leftOperand": "gaiaxCompliant",
                "operator": "eq",
                "rightOperand": "true",
            },
        }],
    }

    neg_resp = await client.post(
        f"{EDC_MGMT_URL}/v3/contractnegotiations",
        json={
            "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/", "odrl": "http://www.w3.org/ns/odrl/2/"},
            "@type": "ContractRequest",
            "counterPartyAddress": DPP_DSP_URL,
            "protocol": "dataspace-protocol-http",
            "policy": offer_policy,
            "callbackAddresses": _cb(["contract.negotiation.finalized", "contract.negotiation.terminated"]),
        },
        headers=_edc_headers(),
    )
    if neg_resp.status_code != 200:
        raise HTTPException(502, f"EDC negotiation request failed ({neg_resp.status_code})")

    negotiation_id = neg_resp.json().get("@id", "")

    gx_span = await _emit_trace(trace_id, "gaiax_compliance_submission", serial, {
        "negotiation_id": negotiation_id,
        "message": "DPP EDC verifying consumer identity via Gaia-X compliance service",
    }, neg_span, source="gx-compliance")

    neg_result = await _await_edc(f"neg:{negotiation_id}", timeout=20.0)

    ca = neg_result.get("contractAgreement", neg_result.get("edc:contractAgreement", {}))
    if not isinstance(ca, dict) or not ca:
        raise HTTPException(502, "EDC contract negotiation was rejected (no agreement)")

    agreement_id = ca.get("id", ca.get("@id", _jld(ca, "contractAgreementId")))
    if not agreement_id:
        agreement_id = _jld(neg_result, "contractAgreementId")
    if not agreement_id:
        raise HTTPException(502, "EDC negotiation finalized but no agreement ID in callback")

    await _emit_trace(trace_id, "gaiax_compliance_verified", serial, {
        "result": "PASS", "compliant": True,
        "message": "Gaia-X compliance verified — consumer credentials accepted",
    }, gx_span, source="gx-compliance")
    await _emit_trace(trace_id, "edc_agreement_reached", serial, {
        "agreement_id": agreement_id,
        "message": f"Contract finalized — agreement {agreement_id[:12]}…",
    }, neg_span, source=_edc)

    # ── Transfer (callback-driven) ──
    transfer_span = await _emit_trace(trace_id, "edc_transfer_started", serial, {
        "agreement_id": agreement_id, "transfer_type": "HttpData-PULL",
        "message": "Starting HttpData-PULL transfer",
    }, root_span, source=_edc)

    tr = await client.post(
        f"{EDC_MGMT_URL}/v3/transferprocesses",
        json={
            "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
            "@type": "TransferRequest",
            "connectorId": "dpp",
            "counterPartyAddress": DPP_DSP_URL,
            "contractId": agreement_id,
            "assetId": asset_id,
            "protocol": "dataspace-protocol-http",
            "transferType": "HttpData-PULL",
            "callbackAddresses": _cb(["transfer.process.started", "transfer.process.terminated"]),
        },
        headers=_edc_headers(),
    )
    if tr.status_code != 200:
        raise HTTPException(502, f"EDC transfer request failed ({tr.status_code})")

    transfer_id = tr.json().get("@id", "")

    await _await_edc(f"tp:{transfer_id}", timeout=15.0)

    # ── Retrieve EDR (single blocking GET) ──
    edr_resp = await client.get(
        f"{EDC_MGMT_URL}/v3/edrs/{transfer_id}/dataaddress",
        headers=_edc_headers(),
    )
    if edr_resp.status_code != 200:
        raise HTTPException(502, f"EDR not available ({edr_resp.status_code})")

    eb = edr_resp.json()
    edr = {
        "agreement_id": agreement_id,
        "asset_id": asset_id,
        "edr_endpoint": _jld(eb, "endpoint"),
        "edr_auth_key": _jld(eb, "authKey") or "Authorization",
        "edr_auth_code": _jld(eb, "authCode") or _jld(eb, "authorization"),
    }
    if not edr["edr_endpoint"]:
        raise HTTPException(502, "EDR has no endpoint")

    obtained_at = int(time.time())
    expires_at = obtained_at + EDR_TTL_SECONDS

    await _emit_trace(trace_id, "edc_edr_received", serial, {
        "endpoint": edr["edr_endpoint"],
        "ttl_seconds": EDR_TTL_SECONDS,
        "expires_at_epoch": expires_at,
        "message": f"EDR received — data plane: {edr['edr_endpoint']} (TTL {EDR_TTL_SECONDS}s)",
    }, transfer_span, source=_edc)

    session_info = {
        "agreement_id": agreement_id,
        "asset_id": asset_id,
        "negotiation_id": negotiation_id,
        "edr_endpoint": edr["edr_endpoint"],
        "edr_obtained_at": obtained_at,
        "edr_obtained_at_iso": datetime.fromtimestamp(obtained_at, tz=timezone.utc).isoformat(),
        "edr_expires_at": expires_at,
        "edr_expires_at_iso": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        "gaiax_verified": True,
        "gaiax_verified_at": obtained_at,
        "gaiax_verified_at_iso": datetime.fromtimestamp(obtained_at, tz=timezone.utc).isoformat(),
    }

    async with _edc_lock:
        _edc_cached = edr
        _edc_cached_at = obtained_at
        global _edc_session_info
        _edc_session_info = session_info

    return edr


async def _dp_get(client: httpx.AsyncClient, edr: dict, path: str, **kwargs) -> httpx.Response:
    """Blocking GET through EDC data plane."""
    return await client.get(
        f"{edr['edr_endpoint']}{path}",
        headers={edr["edr_auth_key"]: edr["edr_auth_code"]},
        **kwargs,
    )


async def _dp_post(client: httpx.AsyncClient, edr: dict, path: str, body: dict, **kwargs) -> httpx.Response:
    """Blocking POST through EDC data plane."""
    return await client.post(
        f"{edr['edr_endpoint']}{path}",
        headers={edr["edr_auth_key"]: edr["edr_auth_code"], "Content-Type": "application/json"},
        json=body,
        **kwargs,
    )


async def _invalidate_edr():
    global _edc_cached, _edc_cached_at, _edc_session_info
    async with _edc_lock:
        _edc_cached = None
        _edc_cached_at = 0
        if _edc_session_info:
            _edc_session_info["edr_expires_at"] = int(time.time())
            _edc_session_info["edr_expires_at_iso"] = datetime.fromtimestamp(
                _edc_session_info["edr_expires_at"], tz=timezone.utc
            ).isoformat()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "repair"}


@app.post("/api/edc/reset")
async def edc_reset():
    """Clear all in-memory EDR/session state so the next lookup starts fresh."""
    global _edc_cached, _edc_cached_at, _edc_session_info
    async with _edc_lock:
        _edc_cached = None
        _edc_cached_at = 0
        _edc_session_info = None
    return {"ok": True, "message": "EDR session cleared"}


@app.get("/api/edc/status")
async def edc_status():
    """Returns the current EDR/credential session state for the access-control page."""
    async with _edc_lock:
        session = dict(_edc_session_info) if _edc_session_info else None
        has_edr = _edc_cached is not None
    if not session:
        return {
            "active": False,
            "status": "no_session",
            "message": "No active EDC session — no lookup has been performed yet",
        }
    now = int(time.time())
    expires_at = session.get("edr_expires_at")
    is_expired = (expires_at is not None and now >= expires_at) or not has_edr
    if is_expired:
        return {
            "active": False,
            "status": "expired",
            "message": "EDR token has expired — next lookup will trigger Gaia-X re-verification",
            **session,
            "expired": True,
        }
    elapsed = now - session.get("edr_obtained_at", now)
    return {
        "active": True,
        "status": "active",
        "message": "Active EDR session — data plane access granted, no re-verification needed",
        **session,
        "expired": False,
        "remaining_seconds": (expires_at - now) if expires_at else None,
        "elapsed_seconds": elapsed,
    }


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, settings.APP_NAME)
    return {"token": token, "username": body.username, "app": settings.APP_NAME}


@app.post("/api/lookup")
async def lookup(body: LookupRequest):
    serial = _extract_serial(body.serialNumber)
    if not serial:
        raise HTTPException(400, "Missing serial number")

    trace_id = str(uuid.uuid4())
    root_span = await _emit_trace(trace_id, "qr_scanned", serial, {
        "serial_number": serial,
        "message": f"Passport lookup initiated for ski serial {serial}",
    })

    async with httpx.AsyncClient(timeout=45.0) as client:
        edr = await _ensure_edr(client, trace_id, serial, root_span)

        dp_span = await _emit_trace(trace_id, "edc_data_plane_fetch", serial, {
            "endpoint": f"{edr['edr_endpoint']}/skis/{serial}/passport",
            "message": f"Fetching passport through EDC data plane",
        }, root_span, source="repair_shop_edc")

        resp = await _dp_get(client, edr, f"/skis/{serial}/passport", timeout=20.0)

        if resp.status_code in (401, 403):
            await _invalidate_edr()
            raise HTTPException(502, "EDC data plane auth rejected — EDR expired")
        if resp.status_code != 200:
            raise HTTPException(502, f"Data plane returned {resp.status_code}")

        passport = resp.json()
        product = passport.get("productData", {})

        await _emit_trace(trace_id, "edc_data_plane_received", serial, {
            "brand": product.get("skiBrand"),
            "productName": product.get("skiProductName"),
            "message": f"Received via data plane: {product.get('skiBrand')} {product.get('skiProductName')}",
        }, dp_span, source="repair_shop_edc")

    # Maintenance records are already included in the passport from DPP API
    # (both services share the same database, so no local merge needed)

    await _emit_trace(trace_id, "dpp_data_returned", serial, {
        "source": "edc", "serial_number": serial,
        "brand": product.get("skiBrand"), "productName": product.get("skiProductName"),
        "maintenanceRecords": len(passport["maintenanceHistory"]),
        "message": f"Passport delivered via EDC: {product.get('skiBrand')} {product.get('skiProductName')} (SN: {serial})",
    }, root_span)

    return {"serialNumber": serial, "source": "edc", "traceId": trace_id, "passport": passport}


@app.get("/api/products/{article_number}/image")
async def proxy_product_image(article_number: str):
    """Proxy product image through EDC data plane — no direct external access."""
    async with _edc_lock:
        edr = _edc_cached
    if not edr:
        raise HTTPException(503, "No active EDC session — perform a lookup first")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await _dp_get(client, edr, f"/products/{article_number}/image")

    if resp.status_code in (401, 403):
        await _invalidate_edr()
        raise HTTPException(502, "EDR expired")
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Image not available")

    ct = resp.headers.get("content-type", "image/png")
    return Response(content=resp.content, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/maintenance-report")
async def send_maintenance_report(body: MaintenanceReportRequest):
    serial = _extract_serial(body.serialNumber)
    if not serial:
        raise HTTPException(400, "Missing serial number")

    trace_id = str(uuid.uuid4())
    root_span = await _emit_trace(trace_id, "maintenance_report_created", serial, {
        "service_type": body.serviceType,
        "performed_by": body.performedBy or "Wintersteiger Machine",
        "message": f"Maintenance report '{body.serviceType}' for serial {serial}",
    })

    async with httpx.AsyncClient(timeout=45.0) as client:
        edr = await _ensure_edr(client, trace_id, serial, root_span)

        await _emit_trace(trace_id, "edc_data_plane_fetch", serial, {
            "endpoint": f"{edr['edr_endpoint']}/skis/{serial}/maintenance",
            "method": "POST",
            "message": "Sending maintenance report through EDC data plane",
        }, root_span, source="repair_shop_edc")

        resp = await _dp_post(client, edr, f"/skis/{serial}/maintenance", {
            "service_type": body.serviceType,
            "message": body.message or f"{body.serviceType} durchgeführt",
            "performed_by": body.performedBy or "Wintersteiger Machine",
        }, timeout=20.0)

        if resp.status_code in (401, 403):
            await _invalidate_edr()
            raise HTTPException(502, "EDC data plane auth rejected — EDR expired")
        if resp.status_code >= 300:
            raise HTTPException(502, f"Data plane returned {resp.status_code}: {resp.text[:200]}")

    await _emit_trace(trace_id, "maintenance_report_sent", serial, {
        "service_type": body.serviceType,
        "message": f"Maintenance report delivered via EDC data plane for serial {serial}",
    }, root_span)

    return {"success": True, "serialNumber": serial, "traceId": trace_id}


@app.get("/api/lookups")
async def list_lookups():
    rows = await fetch_all(
        "SELECT s.trace_id, s.serial_number, s.timestamp, "
        "  CASE WHEN r.trace_id IS NOT NULL THEN 'success' "
        "       WHEN e.trace_id IS NOT NULL THEN 'error' "
        "       ELSE 'unknown' END AS event_type "
        "FROM trace_events s "
        "LEFT JOIN trace_events r ON r.trace_id = s.trace_id AND r.event_type = 'dpp_data_returned' "
        "LEFT JOIN trace_events e ON e.trace_id = s.trace_id AND e.event_type = 'lookup_error' "
        "WHERE s.source = 'repair_api' AND s.event_type = 'qr_scanned' "
        "ORDER BY s.timestamp DESC LIMIT 50"
    )
    return rows
