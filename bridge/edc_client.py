"""Client for interacting with EDC connector management APIs."""

from __future__ import annotations

import httpx

from config import settings

EDC_CONNECTORS = {
    "vendor": "http://vendor-edc-cp:9191",
    "owner_a": "http://owner-a-edc-cp:9191",
    "owner_b": "http://owner-b-edc-cp:9191",
    "service_shop": "http://service-edc-cp:9191",
    "dpp": "http://dpp-edc-cp:9191",
    "repair_shop": "http://repair-edc-cp:9191",
}

EDC_DSP_ENDPOINTS = {
    "vendor": "http://vendor-edc-cp:9292/api/dsp",
    "owner_a": "http://owner-a-edc-cp:9292/api/dsp",
    "owner_b": "http://owner-b-edc-cp:9292/api/dsp",
    "service_shop": "http://service-edc-cp:9292/api/dsp",
    "dpp": "http://dpp-edc-cp:9292/api/dsp",
    "repair_shop": "http://repair-edc-cp:9292/api/dsp",
}


def _headers() -> dict:
    return {
        "x-api-key": settings.EDC_API_KEY,
        "Content-Type": "application/json",
    }


def _mgmt_url(participant_id: str, path: str) -> str:
    base = EDC_CONNECTORS.get(participant_id)
    if not base:
        raise ValueError(f"Unknown participant: {participant_id}")
    return f"{base}/api/management{path}"


async def get_connector_health(participant_id: str) -> dict:
    """Check a connector's health."""
    base = EDC_CONNECTORS.get(participant_id)
    if not base:
        return {"error": f"Unknown participant: {participant_id}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{base.replace(':9191', ':8080')}/api/check/health"
            )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


async def create_asset(
    participant_id: str,
    asset_id: str,
    description: str,
    base_url: str,
    auth_key: str | None = None,
    auth_code: str | None = None,
) -> dict:
    """Create an HTTP-backed asset on a connector."""
    data_address = {
        "@type": "DataAddress",
        "type": "HttpData",
        "baseUrl": base_url,
        "proxyPath": "true",
        "proxyQueryParams": "true",
    }
    if auth_key and auth_code:
        data_address["authKey"] = auth_key
        data_address["authCode"] = auth_code

    body = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@id": asset_id,
        "@type": "Asset",
        "properties": {
            "description": description,
        },
        "dataAddress": data_address,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _mgmt_url(participant_id, "/v3/assets"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:1000]}


async def create_policy(
    participant_id: str,
    policy_id: str,
) -> dict:
    """Create a policy requiring Gaia-X compliance for data access."""
    body = {
        "@context": {
            "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
            "odrl": "http://www.w3.org/ns/odrl/2/",
        },
        "@id": policy_id,
        "@type": "PolicyDefinition",
        "policy": {
            "@context": "http://www.w3.org/ns/odrl.jsonld",
            "@type": "Set",
            "permission": [
                {
                    "action": "use",
                    "constraint": {
                        "leftOperand": "gaiaxCompliant",
                        "operator": "eq",
                        "rightOperand": "true",
                    },
                }
            ],
            "prohibition": [],
            "obligation": [],
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _mgmt_url(participant_id, "/v3/policydefinitions"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:1000]}


async def create_contract_definition(
    participant_id: str,
    contract_id: str,
    policy_id: str,
    asset_id: str,
) -> dict:
    """Create a contract definition linking asset to policy."""
    body = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@id": contract_id,
        "@type": "ContractDefinition",
        "accessPolicyId": policy_id,
        "contractPolicyId": policy_id,
        "assetsSelector": {
            "@type": "Criterion",
            "operandLeft": "https://w3id.org/edc/v0.0.1/ns/id",
            "operator": "=",
            "operandRight": asset_id,
        },
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            _mgmt_url(participant_id, "/v3/contractdefinitions"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:1000]}


async def request_catalog(
    consumer_id: str,
    provider_id: str,
) -> dict:
    """Request the catalog from a provider connector."""
    dsp_url = EDC_DSP_ENDPOINTS.get(provider_id)
    if not dsp_url:
        return {"error": f"Unknown provider: {provider_id}"}

    body = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@type": "CatalogRequest",
        "counterPartyAddress": dsp_url,
        "protocol": "dataspace-protocol-http",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _mgmt_url(consumer_id, "/v3/catalog/request"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:4000]}


async def negotiate_contract(
    consumer_id: str,
    provider_id: str,
    offer_id: str,
    asset_id: str,
    policy: dict,
) -> dict:
    """Initiate a contract negotiation with a provider."""
    dsp_url = EDC_DSP_ENDPOINTS.get(provider_id)

    offer_policy = dict(policy)
    offer_policy["@type"] = "Offer"
    offer_policy.setdefault("@context", "http://www.w3.org/ns/odrl.jsonld")
    offer_policy["assigner"] = provider_id
    offer_policy["target"] = asset_id

    body = {
        "@context": {
            "@vocab": "https://w3id.org/edc/v0.0.1/ns/",
            "odrl": "http://www.w3.org/ns/odrl/2/",
            "edc": "https://w3id.org/edc/v0.0.1/ns/",
        },
        "@type": "ContractRequest",
        "counterPartyAddress": dsp_url,
        "protocol": "dataspace-protocol-http",
        "policy": offer_policy,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _mgmt_url(consumer_id, "/v3/contractnegotiations"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:2000]}


async def get_negotiation_status(
    consumer_id: str,
    negotiation_id: str,
) -> dict:
    """Check status of a contract negotiation."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            _mgmt_url(consumer_id, f"/v3/contractnegotiations/{negotiation_id}"),
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:2000]}


async def initiate_transfer(
    consumer_id: str,
    contract_agreement_id: str,
    asset_id: str,
    provider_id: str,
) -> dict:
    """Start a data transfer using HttpData-PULL."""
    dsp_url = EDC_DSP_ENDPOINTS.get(provider_id)

    body = {
        "@context": {"@vocab": "https://w3id.org/edc/v0.0.1/ns/"},
        "@type": "TransferRequest",
        "connectorId": provider_id,
        "counterPartyAddress": dsp_url,
        "contractId": contract_agreement_id,
        "assetId": asset_id,
        "protocol": "dataspace-protocol-http",
        "transferType": "HttpData-PULL",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _mgmt_url(consumer_id, "/v3/transferprocesses"),
            json=body,
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:2000]}


async def get_edr(consumer_id: str, transfer_id: str) -> dict:
    """Get the EndpointDataReference for an active transfer."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            _mgmt_url(consumer_id, f"/v3/edrs/{transfer_id}/dataaddress"),
            headers=_headers(),
        )
    return {"status": resp.status_code, "body": resp.text[:2000]}
