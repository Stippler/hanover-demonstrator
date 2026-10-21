"""Digital Ski Passport API — serves product passport data from PASSAT AAS."""
from __future__ import annotations

import asyncio
import base64
import logging
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

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

log = logging.getLogger("dpp_api")

PARTICIPANT_ID = "dpp"
TRACE_COLLECTOR_URL = os.getenv("TRACE_COLLECTOR_URL", "http://trace-api:8000")

EDC_MGMT_URL = os.getenv("EDC_MGMT_URL", "http://dpp-edc-cp:9191/api/management")
EDC_API_KEY = os.getenv("EDC_API_KEY", "password")
EDC_SEED_ENABLED = os.getenv("EDC_SEED_ENABLED", "true").lower() in ("true", "1", "yes")

# ── AAS / PASSAT configuration ──────────────────────────────────────────────
AAS_REPO_URL = os.getenv("AAS_REPO_URL", "https://atomic-ski.passat.srfg.at")
AAS_CARRIER_BASE = os.getenv("AAS_CARRIER_BASE", "http://wseqr.amersports.com")
AAS_MACHINE_TYPE = os.getenv("AAS_MACHINE_TYPE", "Jupiter-X-TEST")
AAS_MACHINE_NUMBER = os.getenv("AAS_MACHINE_NUMBER", "1234-1234")

MAINTENANCE_SHELL_ID = "urn:samm:at.srfg.passat.AtomicSki:2.0.0#SkiMaintenance"
MAINTENANCE_SUBMODEL_ID = "urn:samm:at.srfg.passat.AtomicSki:2.0.0#SkiMaintenance/submodel"
CATALOG_SHELL_ID = "urn:samm:at.srfg.passat.AtomicSki:2.0.0#AtomicSki"

app = FastAPI(title="Digital Ski Passport API")
app.add_middleware(auth_middleware())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MaintenanceReportCreate(BaseModel):
    service_type: str
    message: Optional[str] = None
    performed_by: Optional[str] = None
    performed_at: Optional[datetime] = None


async def _emit_trace(trace_id: str | None, event_type: str, serial_number: str | None = None, payload: dict | None = None):
    if not trace_id:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{TRACE_COLLECTOR_URL}/api/traces",
                json={
                    "trace_id": trace_id,
                    "event_type": event_type,
                    "source": "dpp_api",
                    "participant_id": PARTICIPANT_ID,
                    "serial_number": serial_number,
                    "payload": payload or {},
                },
            )
    except Exception:
        pass


# ── AAS helpers ──────────────────────────────────────────────────────────────

def _b64url(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def _parse_smc(elements: list[dict]) -> dict:
    result: dict = {}
    for el in elements:
        id_short = el.get("idShort", "")
        model_type = el.get("modelType", "")
        if model_type == "Property":
            result[id_short] = el.get("value")
        elif model_type == "SubmodelElementCollection":
            result[id_short] = _parse_smc(el.get("value", []))
        elif model_type in ("File", "Blob"):
            result[id_short] = el.get("value")
    return result


def _safe_num(value) -> float | int | None:
    if value is None:
        return None
    try:
        f = float(value)
        return int(f) if f == int(f) else f
    except (ValueError, TypeError):
        return None


async def _invoke_get_ski_service_data(client: httpx.AsyncClient, serial: str) -> dict:
    carrier_data = f"{AAS_CARRIER_BASE}/?sn={serial}"
    shell_b64 = _b64url(MAINTENANCE_SHELL_ID)
    sub_b64 = _b64url(MAINTENANCE_SUBMODEL_ID)
    url = f"{AAS_REPO_URL}/shells/{shell_b64}/submodels/{sub_b64}/submodel-elements/getSkiServiceData/invoke"

    resp = await client.post(url, json={
        "inputArguments": [{
            "value": {
                "modelType": "SubmodelElementCollection",
                "idShort": "serviceRequest",
                "value": [
                    {"modelType": "Property", "idShort": "carrierData", "valueType": "xs:anyURI", "value": carrier_data},
                    {"modelType": "Property", "idShort": "machineType", "valueType": "xs:string", "value": AAS_MACHINE_TYPE},
                    {"modelType": "Property", "idShort": "machineNumber", "valueType": "xs:string", "value": AAS_MACHINE_NUMBER},
                ],
            }
        }],
        "inoutputArguments": [],
        "clientTimeoutDuration": None,
    })

    if resp.status_code != 200:
        raise HTTPException(502, f"AAS getSkiServiceData failed (HTTP {resp.status_code})")

    body = resp.json()
    if not body.get("success"):
        raise HTTPException(502, "AAS getSkiServiceData returned failure")

    for arg in body.get("outputArguments", []):
        val = arg.get("value", {})
        if val.get("idShort") == "serviceData":
            return _parse_smc(val.get("value", []))

    raise HTTPException(502, "AAS response contained no serviceData")


async def _fetch_item_data(client: httpx.AsyncClient, serial: str) -> dict:
    cat_b64 = _b64url(CATALOG_SHELL_ID)
    item_sm_id = f"urn:samm:at.srfg.passat.AtomicSki:2.0.0#Item/SN{serial}/submodel"
    item_b64 = _b64url(item_sm_id)
    url = f"{AAS_REPO_URL}/shells/{cat_b64}/submodels/{item_b64}"

    resp = await client.get(url)
    if resp.status_code != 200:
        return {}

    data = resp.json()
    for el in data.get("submodelElements", []):
        if el.get("modelType") == "SubmodelElementCollection":
            return _parse_smc(el.get("value", []))
    return {}


async def _fetch_product_model_data(client: httpx.AsyncClient, component_code: str) -> dict:
    pm_article = "PM" + component_code.rstrip("+")
    cat_b64 = _b64url(CATALOG_SHELL_ID)
    pm_sm_id = f"urn:samm:at.srfg.passat.AtomicSki:2.0.0#ProductModel/{pm_article}"
    pm_b64 = _b64url(pm_sm_id)
    url = f"{AAS_REPO_URL}/shells/{cat_b64}/submodels/{pm_b64}"

    resp = await client.get(url)
    if resp.status_code != 200:
        return {}

    data = resp.json()
    for el in data.get("submodelElements", []):
        if el.get("modelType") == "SubmodelElementCollection":
            return _parse_smc(el.get("value", []))
    return {}


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "dpp"}


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(body.username, settings.APP_NAME)
    return {"token": token, "username": body.username, "app": settings.APP_NAME}


@app.get("/api/products")
async def list_products():
    rows = await fetch_all(
        "SELECT id, article_number, model_name, brand, season, gender, ean, "
        "steel_edge_base_angle, steel_edge_sidewall_angle, extra_data, created_at "
        "FROM product_models ORDER BY created_at DESC"
    )
    return rows


@app.get("/api/products/{article_number}")
async def get_product(article_number: str):
    row = await fetch_one(
        "SELECT id, article_number, model_name, brand, season, gender, ean, "
        "steel_edge_base_angle, steel_edge_sidewall_angle, extra_data, created_at "
        "FROM product_models WHERE article_number = $1",
        article_number,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product model not found")
    return row


@app.get("/api/products/{article_number}/image")
async def get_product_image(article_number: str):
    """Proxy product image from AAS product model."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            pm_data = await _fetch_product_model_data(client, article_number)
            image_url = pm_data.get("imageUrl")
            if not image_url:
                raise HTTPException(404, "No image URL in product model")
            img_resp = await client.get(image_url)
            if img_resp.status_code == 200:
                ct = img_resp.headers.get("content-type", "image/png")
                return Response(
                    content=img_resp.content,
                    media_type=ct,
                    headers={"Cache-Control": "public, max-age=86400"},
                )
            raise HTTPException(img_resp.status_code, "Image fetch failed")
    except HTTPException:
        raise
    except Exception:
        row = await fetch_one(
            "SELECT image_data, image_mime FROM product_models WHERE article_number = $1",
            article_number,
        )
        if row and row["image_data"]:
            return Response(content=bytes(row["image_data"]), media_type=row["image_mime"] or "image/png")
        raise HTTPException(404, "No image available")


@app.get("/api/skis")
async def list_skis():
    rows = await fetch_all(
        "SELECT si.id, si.serial_number, si.size, si.factory, si.extra_data, si.created_at, "
        "pm.article_number, pm.model_name, pm.brand "
        "FROM ski_instances si "
        "JOIN product_models pm ON pm.id = si.product_model_id "
        "ORDER BY si.created_at DESC"
    )
    return rows


@app.get("/api/skis/{serial_number}")
async def get_ski(serial_number: str):
    row = await fetch_one(
        "SELECT si.id, si.serial_number, si.size, si.factory, si.extra_data, si.created_at, "
        "pm.article_number, pm.model_name, pm.brand, pm.season, pm.gender, pm.ean, "
        "pm.steel_edge_base_angle, pm.steel_edge_sidewall_angle, pm.extra_data AS model_extra "
        "FROM ski_instances si "
        "JOIN product_models pm ON pm.id = si.product_model_id "
        "WHERE si.serial_number = $1",
        serial_number,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Ski instance not found")
    return row


@app.get("/api/skis/{serial_number}/qr")
async def get_ski_qr(serial_number: str):
    row = await fetch_one(
        "SELECT qr_image FROM ski_instances WHERE serial_number = $1",
        serial_number,
    )
    if not row or not row["qr_image"]:
        raise HTTPException(status_code=404, detail="No QR image available")
    return Response(content=bytes(row["qr_image"]), media_type="image/png")


async def _lookup_trace_id() -> str | None:
    """Look up the most recent active trace from the trace collector."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"{TRACE_COLLECTOR_URL}/api/traces",
                params={"event_type": "edc_transfer_started", "limit": "1"},
            )
            if resp.status_code == 200:
                data = resp.json()
                events = data.get("events", [])
                if events:
                    return events[0].get("trace_id")
    except Exception:
        pass
    return None


@app.get("/api/skis/{serial_number}/passport")
async def get_ski_passport(serial_number: str, request: Request):
    """Full DPP data from PASSAT AAS + local maintenance.
    This is the primary endpoint exposed through EDC data plane."""
    trace_id = await _lookup_trace_id()
    await _emit_trace(trace_id, "data_request_received", serial_number, {
        "message": f"DPP API received passport request for serial {serial_number} via EDC data plane",
        "endpoint": f"/api/skis/{serial_number}/passport",
        "aas_target": AAS_REPO_URL,
    })

    async with httpx.AsyncClient(timeout=20.0) as client:
        service_data = await _invoke_get_ski_service_data(client, serial_number)

        product = service_data.get("productData", {})
        identification = service_data.get("identification", {})
        side_edge = service_data.get("sideEdgeParameter", {})
        base_edge = service_data.get("baseEdgeParameter", {})
        edge_perf = service_data.get("edgePerformance", {})

        item_data = await _fetch_item_data(client, serial_number)

        component_code = identification.get("componentCode", "")
        pm_data: dict = {}
        if component_code:
            pm_data = await _fetch_product_model_data(client, component_code)

    component_code_clean = component_code.rstrip("+") if component_code else ""
    image_url = f"/api/products/{component_code_clean}/image" if pm_data.get("imageUrl") else None

    records = await fetch_all(
        "SELECT service_type, message, performed_by, performed_at "
        "FROM maintenance_records WHERE serial_number = $1 "
        "ORDER BY performed_at DESC",
        serial_number,
    )

    maintenance_history = [
        {
            "serviceType": r["service_type"],
            "message": r["message"],
            "performedBy": r["performed_by"],
            "timestamp": r["performed_at"].isoformat() if r["performed_at"] else None,
        }
        for r in records
    ]

    passport = {
        "serialNumber": serial_number,
        "identification": {
            "serialNumber": identification.get("serialNumber", serial_number),
            "componentCode": identification.get("componentCode", ""),
            "setCode": identification.get("setCode", ""),
            "serviceCount": len(records),
        },
        "productData": {
            "skiBrand": product.get("skiBrand", pm_data.get("brand", "")),
            "skiManufacturer": product.get("skiManufacturer", ""),
            "skiProductName": product.get("skiProductName", pm_data.get("productName", "")),
            "skiLength": _safe_num(product.get("skiLength", pm_data.get("size"))),
            "skiWidthTip": _safe_num(product.get("skiWidthTip", pm_data.get("sideCutTipMaxMarketing"))),
            "skiWidthWaist": _safe_num(product.get("skiWidthWaist", pm_data.get("sideCutWaistMarketing"))),
            "skiWidthTail": _safe_num(product.get("skiWidthTail", pm_data.get("sideCutTailMaxMarketing"))),
        },
        "sideEdgeParameter": {
            "angleTip": _safe_num(side_edge.get("angleTip")),
            "angleWaist": _safe_num(side_edge.get("angleWaist")),
            "angleTail": _safe_num(side_edge.get("angleTail")),
        },
        "baseEdgeParameter": {
            "angleTip": _safe_num(base_edge.get("angleTip")),
            "angleWaist": _safe_num(base_edge.get("angleWaist")),
            "angleTail": _safe_num(base_edge.get("angleTail")),
        },
        "edgePerformance": {
            "performanceClass": edge_perf.get("performanceClass", ""),
        },
        "productModelData": {
            "season": pm_data.get("season", ""),
            "gender": pm_data.get("gender", ""),
            "eanCode": pm_data.get("eanCode", ""),
            "sapArticleNumber": pm_data.get("sapArticleNumber", ""),
            "steelEdgeBaseAngle": pm_data.get("steelEdgeBaseAngle", ""),
            "steelEdgeSidewallAngle": pm_data.get("steelEdgeSidewallAngle", ""),
        },
        "itemData": {
            "factory": item_data.get("factory", item_data.get("werkProdauftrag", "")),
            "url": item_data.get("url", ""),
            "registrationDate": item_data.get("erfassdatum", ""),
            "deliveryDate": item_data.get("lieferdatum", ""),
            "orderNumber": item_data.get("auftragnr", ""),
            "pairSerial": item_data.get("qrsnrPaar", ""),
        },
        "productImageUrl": image_url,
        "maintenanceHistory": maintenance_history,
    }

    await _emit_trace(trace_id, "data_response_sent", serial_number, {
        "message": f"DPP API returning passport: {product.get('skiBrand')} {product.get('skiProductName')} via EDC data plane",
        "brand": product.get("skiBrand"),
        "productName": product.get("skiProductName"),
        "skiLength": product.get("skiLength"),
        "maintenance_records": len(maintenance_history),
        "source": "AAS/PASSAT",
    })

    return passport


@app.get("/api/skis/{serial_number}/maintenance")
async def get_maintenance(serial_number: str):
    rows = await fetch_all(
        "SELECT service_type, message, performed_by, performed_at "
        "FROM maintenance_records WHERE serial_number = $1 "
        "ORDER BY performed_at DESC",
        serial_number,
    )
    return rows


@app.post("/api/skis/{serial_number}/maintenance", status_code=201)
async def add_maintenance(serial_number: str, body: MaintenanceReportCreate):
    await execute(
        "INSERT INTO maintenance_records (serial_number, service_type, message, performed_by, performed_at) "
        "VALUES ($1, $2, $3, $4, $5)",
        serial_number,
        body.service_type,
        body.message,
        body.performed_by,
        body.performed_at or datetime.utcnow(),
    )
    return {"success": True, "serialNumber": serial_number}


# ── EDC Self-Seeding ─────────────────────────────────────────────────


async def _edc_post(client: httpx.AsyncClient, path: str, body: dict) -> dict:
    headers = {"x-api-key": EDC_API_KEY, "Content-Type": "application/json"}
    resp = await client.post(f"{EDC_MGMT_URL}{path}", json=body, headers=headers)
    # 409 = already seeded (dpp-api restarted while the connector kept its in-memory state).
    # Anything else non-2xx (connector still booting) must fail so on_startup retries.
    if resp.status_code != 409 and not resp.is_success:
        raise RuntimeError(f"EDC {path} returned HTTP {resp.status_code}: {resp.text[:200]}")
    return {"status": resp.status_code, "body": resp.text[:500]}


async def _seed_edc():
    """Register the DPP asset, Gaia-X policy, and contract definition on the EDC CP."""
    internal_token = f"Bearer {settings.API_SECRET}" if settings.API_SECRET else ""

    async with httpx.AsyncClient(timeout=10.0) as client:
        asset = await _edc_post(client, "/v3/assets", {
            "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
            "@id": "dpp-ski-data",
            "@type": "Asset",
            "properties": {"description": "Digital Ski Passport data"},
            "dataAddress": {
                "@type": "DataAddress",
                "type": "HttpData",
                "baseUrl": "http://dpp-api:8000/api",
                "proxyPath": "true",
                "proxyQueryParams": "true",
                "proxyBody": "true",
                "proxyMethod": "true",
                **({"authKey": "Authorization", "authCode": internal_token} if internal_token else {}),
            },
        })
        log.info("EDC seed asset: %s", asset["status"])

        policy = await _edc_post(client, "/v3/policydefinitions", {
            "@context": {
                "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
                "odrl": "http://www.w3.org/ns/odrl/2/",
            },
            "@id": "dpp-gaiax-policy",
            "@type": "PolicyDefinition",
            "policy": {
                "@context": "http://www.w3.org/ns/odrl.jsonld",
                "@type": "Set",
                "permission": [{
                    "action": "use",
                    "constraint": {
                        "leftOperand": "gaiaxCompliant",
                        "operator": "eq",
                        "rightOperand": "true",
                    },
                }],
                "prohibition": [],
                "obligation": [],
            },
        })
        log.info("EDC seed policy: %s", policy["status"])

        contract = await _edc_post(client, "/v3/contractdefinitions", {
            "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
            "@id": "dpp-contract",
            "@type": "ContractDefinition",
            "accessPolicyId": "dpp-gaiax-policy",
            "contractPolicyId": "dpp-gaiax-policy",
            "assetsSelector": {
                "@type": "Criterion",
                "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id",
                "operator": "=",
                "operandRight": "dpp-ski-data",
            },
        })
        log.info("EDC seed contract: %s", contract["status"])


async def on_startup():
    """Called by run.py lifespan after database pool is ready."""
    if not EDC_SEED_ENABLED:
        return
    for attempt in range(12):
        try:
            await _seed_edc()
            log.info("EDC connector seeded successfully")
            return
        except Exception as e:
            if attempt < 11:
                log.warning("EDC seed attempt %d failed (%s), retrying in 5s...", attempt + 1, e)
                await asyncio.sleep(5)
            else:
                log.error("EDC seeding failed after %d attempts: %s", attempt + 1, e)
