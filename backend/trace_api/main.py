"""Trace Collector API — ingests structured trace events and serves them to the dashboard."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from common.auth import create_token, verify_credentials
from common.auth_middleware import auth_middleware
from common.config import settings
from common.database import execute, fetch_all, fetch_one

log = logging.getLogger(__name__)

EDC_API_KEY = os.environ.get("EDC_API_KEY", "password")
EDC_CONNECTORS = {
    "dpp": "http://dpp-edc-cp:9191",
    "repair_shop": "http://repair-edc-cp:9191",
}
EDC_PARTICIPANT_NAMES = {
    "dpp": "Atomic",
    "repair_shop": "Wintersteiger Machine",
}

REPAIR_API_URL = os.environ.get("REPAIR_API_URL", "http://repair-api:8000")
COMPOSE_PROJECT = os.environ.get("COMPOSE_PROJECT", "hanover-demonstrator")
DOCKER_SOCK = "/var/run/docker.sock"


app = FastAPI(title="Trace Collector API")
app.add_middleware(auth_middleware(skip_post_paths=("/api/traces",), extra_skip_paths=("/api/traces",)))
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TraceEventIn(BaseModel):
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    event_type: str
    source: str
    participant_id: Optional[str] = None
    serial_number: Optional[str] = None
    payload: Optional[dict] = None
    timestamp: Optional[datetime] = None


class TraceEventBatchIn(BaseModel):
    events: list[TraceEventIn]


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "trace"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, settings.APP_NAME)
    return {"token": token, "username": body.username, "app": settings.APP_NAME}


@app.post("/api/traces", status_code=201)
async def ingest_trace(body: TraceEventIn):
    """Ingest a single trace event. No auth required (internal-only endpoint)."""
    trace_id = body.trace_id or str(uuid.uuid4())
    span_id = body.span_id or str(uuid.uuid4())
    ts = body.timestamp or datetime.utcnow()

    row = await fetch_one(
        "INSERT INTO trace_events (trace_id, span_id, parent_span_id, event_type, source, "
        "participant_id, serial_number, payload, timestamp) "
        "VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb, $9) RETURNING id, trace_id, span_id",
        uuid.UUID(trace_id) if isinstance(trace_id, str) else trace_id,
        uuid.UUID(span_id) if isinstance(span_id, str) else span_id,
        uuid.UUID(body.parent_span_id) if body.parent_span_id else None,
        body.event_type,
        body.source,
        body.participant_id,
        body.serial_number,
        json.dumps(body.payload or {}),
        ts,
    )
    return row


@app.post("/api/traces/batch", status_code=201)
async def ingest_batch(body: TraceEventBatchIn):
    """Ingest multiple trace events at once. No auth required."""
    results = []
    for evt in body.events:
        trace_id = evt.trace_id or str(uuid.uuid4())
        span_id = evt.span_id or str(uuid.uuid4())
        ts = evt.timestamp or datetime.utcnow()

        row = await fetch_one(
            "INSERT INTO trace_events (trace_id, span_id, parent_span_id, event_type, source, "
            "participant_id, serial_number, payload, timestamp) "
            "VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb, $9) RETURNING id, trace_id, span_id",
            uuid.UUID(trace_id) if isinstance(trace_id, str) else trace_id,
            uuid.UUID(span_id) if isinstance(span_id, str) else span_id,
            uuid.UUID(evt.parent_span_id) if evt.parent_span_id else None,
            evt.event_type,
            evt.source,
            evt.participant_id,
            evt.serial_number,
            json.dumps(evt.payload or {}),
            ts,
        )
        results.append(row)
    return {"ingested": len(results), "events": results}


_SEED_MAINTENANCE = [
    "TRUNCATE maintenance_records",
    (
        "INSERT INTO maintenance_records (ski_instance_id, serial_number, service_type, message, performed_at) "
        "SELECT si.id, si.serial_number, 'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', "
        "'2026-02-15T10:30:00Z'::timestamptz "
        "FROM ski_instances si WHERE si.serial_number = '99999999'"
    ),
    (
        "INSERT INTO maintenance_records (ski_instance_id, serial_number, service_type, message, performed_at) "
        "SELECT si.id, si.serial_number, 'Kantenschleifen', 'Kantenschleifen nach Herstellerangabe', "
        "'2026-03-01T14:00:00Z'::timestamptz "
        "FROM ski_instances si WHERE si.serial_number = '99999999'"
    ),
]

_EDC_CONTAINERS = ["dpp-edc-cp", "dpp-edc-dp", "repair-edc-cp", "repair-edc-dp"]
_API_CONTAINERS = ["repair-api", "dpp-api"]


async def _restart_container(docker: httpx.AsyncClient, service: str) -> bool:
    """Restart a Docker container by its compose service name."""
    name = f"{COMPOSE_PROJECT}-{service}-1"
    try:
        resp = await docker.post(f"/containers/{name}/restart", params={"t": "5"})
        ok = resp.status_code < 300
        log.info("restart %s → %s", name, resp.status_code)
        return ok
    except Exception as exc:
        log.warning("restart %s failed: %s", name, exc)
        return False


async def _wait_healthy(docker: httpx.AsyncClient, service: str, timeout: float = 60.0) -> bool:
    """Poll container until it reports healthy or timeout is reached."""
    name = f"{COMPOSE_PROJECT}-{service}-1"
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            resp = await docker.get(f"/containers/{name}/json")
            if resp.status_code == 200:
                health = resp.json().get("State", {}).get("Health", {}).get("Status", "")
                if health == "healthy":
                    return True
        except Exception:
            pass
        await asyncio.sleep(2)
    return False


@app.post("/api/reset")
async def reset_all():
    """Full demo reset: wipe DB traces, re-seed maintenance, restart EDC connectors
    (clears in-memory agreements), wait for them to be healthy, then restart
    repair-api + dpp-api so sessions and EDC seeds are re-initialised from scratch."""
    await execute("TRUNCATE trace_events")
    for stmt in _SEED_MAINTENANCE:
        await execute(stmt)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{REPAIR_API_URL}/api/edc/reset")
    except Exception:
        pass

    has_socket = Path(DOCKER_SOCK).exists()
    restarted: list[str] = []
    if has_socket:
        transport = httpx.AsyncHTTPTransport(uds=DOCKER_SOCK)
        async with httpx.AsyncClient(transport=transport, base_url="http://docker", timeout=90.0) as docker:
            for svc in _EDC_CONTAINERS:
                if await _restart_container(docker, svc):
                    restarted.append(svc)

            for svc in ["dpp-edc-cp", "repair-edc-cp"]:
                await _wait_healthy(docker, svc, timeout=60.0)

            for svc in _API_CONTAINERS:
                if await _restart_container(docker, svc):
                    restarted.append(svc)

    return {
        "ok": True,
        "message": "All trace events cleared, maintenance re-seeded, EDR session reset",
        "containers_restarted": restarted,
    }


@app.get("/api/traces")
async def list_traces(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None),
    serial_number: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    """List trace events, newest first. Supports filtering by event_type, serial_number, and source."""
    conditions = []
    params: list = []
    param_idx = 0

    if event_type:
        param_idx += 1
        conditions.append(f"event_type = ${param_idx}")
        params.append(event_type)
    if serial_number:
        param_idx += 1
        conditions.append(f"serial_number = ${param_idx}")
        params.append(serial_number)
    if source:
        param_idx += 1
        conditions.append(f"source = ${param_idx}")
        params.append(source)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    param_idx += 1
    limit_param = param_idx
    param_idx += 1
    offset_param = param_idx
    params.extend([limit, offset])

    rows = await fetch_all(
        f"SELECT id, trace_id, span_id, parent_span_id, event_type, source, "
        f"participant_id, serial_number, payload, timestamp "
        f"FROM trace_events {where} "
        f"ORDER BY timestamp DESC "
        f"LIMIT ${limit_param} OFFSET ${offset_param}",
        *params,
    )

    count_row = await fetch_one(
        f"SELECT count(*) AS total FROM trace_events {where}",
        *params[:-2],
    )

    return {
        "total": count_row["total"] if count_row else 0,
        "limit": limit,
        "offset": offset,
        "events": rows,
    }


@app.get("/api/traces/stats")
async def trace_stats():
    """Aggregate counts by event_type and source."""
    type_rows = await fetch_all(
        "SELECT event_type, count(*) AS cnt FROM trace_events GROUP BY event_type ORDER BY cnt DESC"
    )
    source_rows = await fetch_all(
        "SELECT source, count(*) AS cnt FROM trace_events GROUP BY source ORDER BY cnt DESC"
    )
    total_row = await fetch_one("SELECT count(*) AS total FROM trace_events")
    total = total_row["total"] if total_row else 0

    by_type = {r["event_type"]: r["cnt"] for r in type_rows}
    by_source = {r["source"]: r["cnt"] for r in source_rows}

    return {"total_events": total, "by_type": by_type, "by_source": by_source, "stats": type_rows}


@app.get("/api/traces/{trace_id}")
async def get_trace(trace_id: str):
    """Get all events for a single trace, ordered chronologically for waterfall view."""
    try:
        tid = uuid.UUID(trace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trace_id format")

    rows = await fetch_all(
        "SELECT id, trace_id, span_id, parent_span_id, event_type, source, "
        "participant_id, serial_number, payload, timestamp "
        "FROM trace_events WHERE trace_id = $1 ORDER BY timestamp ASC",
        tid,
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {"trace_id": trace_id, "events": rows}


EDC_DEFAULT_PORTS = {
    "dpp": "http://dpp-edc-cp:8080/api",
    "repair_shop": "http://repair-edc-cp:8080/api",
}


async def _query_edc(base_url: str, path: str) -> list[dict]:
    """Query an EDC connector's management API (POST with empty filter)."""
    headers = {"x-api-key": EDC_API_KEY, "Content-Type": "application/json"}
    body = {"@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"}, "@type": "QuerySpec"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(f"{base_url}/api/management{path}", json=body, headers=headers)
            if resp.status_code < 300:
                return resp.json() if isinstance(resp.json(), list) else []
    except Exception:
        pass
    return []


async def _fetch_identity(base_url: str) -> dict:
    """Fetch did.json and participant.json from an EDC connector's default context."""
    result: dict = {"did_document": None, "participant": None}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            did_resp = await client.get(f"{base_url}/did.json")
            if did_resp.status_code == 200:
                result["did_document"] = did_resp.json()
            part_resp = await client.get(f"{base_url}/participant.json")
            if part_resp.status_code == 200:
                result["participant"] = part_resp.json()
    except Exception:
        pass
    return result


def _ld_str(val: object) -> str:
    """Unwrap a JSON-LD value to a plain string (handles {"@id": "..."} objects)."""
    if isinstance(val, dict):
        return str(val.get("@id", val.get("@value", next(iter(val.values()), "?"))))
    return str(val) if val is not None else "?"


async def _fetch_edr_status() -> dict | None:
    """Query repair-api for current EDR/credential session status."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{REPAIR_API_URL}/api/edc/status")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


@app.get("/api/access-matrix")
async def access_matrix():
    """Provider-centric access matrix: assets, ODRL policies, identity documents,
    and which consumers have been granted access via contract agreements."""

    all_identities: dict[str, dict] = {}
    providers = {}

    edr_status = await _fetch_edr_status()

    for pid, base_url in EDC_CONNECTORS.items():
        identity = await _fetch_identity(EDC_DEFAULT_PORTS.get(pid, ""))
        all_identities[pid] = identity

        assets = await _query_edc(base_url, "/v3/assets/request")
        policies = await _query_edc(base_url, "/v3/policydefinitions/request")
        contracts = await _query_edc(base_url, "/v3/contractdefinitions/request")
        agreements = await _query_edc(base_url, "/v3/contractagreements/request")

        parsed_assets = [
            {"id": _ld_str(a.get("@id", a.get("id", "?"))),
             "description": _ld_str((a.get("properties", {}) or {}).get("description", ""))}
            for a in assets
        ]

        parsed_policies = []
        for p in policies:
            pol = p.get("policy", {}) or {}
            perms = pol.get("permission", pol.get("odrl:permission", []))
            if not isinstance(perms, list):
                perms = [perms] if perms else []
            constraints = []
            for perm in perms:
                c = perm.get("constraint", perm.get("odrl:constraint", {}))
                if c:
                    constraints.append({
                        "left": _ld_str(c.get("leftOperand", c.get("odrl:leftOperand", "?"))),
                        "op": _ld_str(c.get("operator", c.get("odrl:operator", "?"))),
                        "right": _ld_str(c.get("rightOperand", c.get("odrl:rightOperand", "?"))),
                    })
            parsed_policies.append({
                "id": _ld_str(p.get("@id", p.get("id", "?"))),
                "constraints": constraints,
                "gaiax_required": any(
                    "gaiax" in str(c.get("left", "")).lower() for c in constraints
                ),
            })

        parsed_contracts = [
            {"id": _ld_str(cd.get("@id", cd.get("id", "?"))),
             "access_policy_id": _ld_str(cd.get("accessPolicyId", "?")),
             "contract_policy_id": _ld_str(cd.get("contractPolicyId", "?"))}
            for cd in contracts
        ]

        parsed_agreements = []
        for ag in agreements:
            consumer_id = _ld_str(ag.get("consumerId", "?"))
            consumer_identity = all_identities.get(consumer_id) or await _fetch_identity(
                EDC_DEFAULT_PORTS.get(consumer_id, ""))
            consumer_part = consumer_identity.get("participant") or {}
            consumer_did = consumer_identity.get("did_document") or {}
            parsed_agreements.append({
                "id": _ld_str(ag.get("@id", ag.get("id", "?"))),
                "provider_id": _ld_str(ag.get("providerId", "?")),
                "consumer_id": consumer_id,
                "consumer_name": consumer_part.get("gx:legalName", EDC_PARTICIPANT_NAMES.get(consumer_id, consumer_id)),
                "consumer_did": consumer_did.get("id", ""),
                "consumer_country": (consumer_part.get("gx:headquartersAddress") or {}).get("gx:countryCode", ""),
                "asset_id": _ld_str(ag.get("assetId", "?")),
                "signed_at": ag.get("contractSigningDate", None),
            })

        has_identity = bool(identity.get("did_document") or identity.get("participant"))
        if not parsed_assets and not has_identity:
            continue

        did_doc = identity.get("did_document") or {}
        participant = identity.get("participant") or {}
        credential_status = None
        if pid == "repair_shop" and edr_status:
            credential_status = edr_status
        elif pid == "dpp":
            credential_status = {
                "active": True,
                "status": "always_verify",
                "message": "Gaia-X verification is performed on every new contract negotiation — the provider always verifies the consumer's credentials",
            }

        providers[pid] = {
            "name": EDC_PARTICIPANT_NAMES.get(pid, pid),
            "role": "consumer" if pid == "repair_shop" else "provider",
            "reachable": True,
            "identity": {
                "did": did_doc.get("id", ""),
                "legal_name": participant.get("gx:legalName", ""),
                "country": (participant.get("gx:headquartersAddress") or {}).get("gx:countryCode", ""),
                "type": participant.get("type", ""),
                "did_document": did_doc,
                "participant_json": participant,
            },
            "assets": parsed_assets,
            "policies": parsed_policies,
            "contract_definitions": parsed_contracts,
            "agreements": parsed_agreements,
            "credential_status": credential_status,
        }

    return {"providers": providers}
