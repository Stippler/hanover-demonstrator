"""Verifiable Credential / Presentation generation and Gaia-X compliance submission."""

from __future__ import annotations

import base64
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.x509 import load_pem_x509_certificate

from config import settings

_private_key = None
_certificate = None
_public_key = None
_public_jwk = None
_cert_pem_str = None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _load_keys():
    global _private_key, _certificate, _public_key, _public_jwk, _cert_pem_str
    if _private_key is None:
        key_pem = Path(settings.PRIVATE_KEY_PATH).read_bytes()
        _private_key = serialization.load_pem_private_key(key_pem, password=None)
        cert_pem = Path(settings.CERTIFICATE_PATH).read_bytes()
        _cert_pem_str = cert_pem.decode()
        _certificate = load_pem_x509_certificate(cert_pem)
        _public_key = _certificate.public_key()

        pub_numbers: RSAPublicNumbers = _public_key.public_numbers()
        n_bytes = pub_numbers.n.to_bytes((pub_numbers.n.bit_length() + 7) // 8, "big")
        e_bytes = pub_numbers.e.to_bytes((pub_numbers.e.bit_length() + 7) // 8, "big")

        _public_jwk = {
            "kty": "RSA",
            "n": _b64url(n_bytes),
            "e": _b64url(e_bytes),
            "alg": "RS256",
            "use": "sig",
            "x5u": f"https://bridge.{settings.DOMAIN}/.well-known/x509CertificateChain.pem",
        }


def _bridge_did() -> str:
    """Central issuer DID, resolvable at https://bridge.{DOMAIN}/.well-known/did.json"""
    return f"did:web:bridge.{settings.DOMAIN}"


def _issuer_did() -> str:
    return _bridge_did()


def _participant_did(participant_id: str) -> str:
    slug = participant_id.replace("_", "-")
    return f"did:web:bridge.{settings.DOMAIN}:api:did:{slug}"


PARTICIPANT_METADATA = {
    "vendor": {
        "name": "Alpine Ski Works GmbH",
        "legal_name": "Alpine Ski Works GmbH",
        "country": "DE",
        "description": "Ski manufacturer and vendor",
    },
    "owner_a": {
        "name": "Max Mustermann",
        "legal_name": "Max Mustermann",
        "country": "DE",
        "description": "Ski owner (first buyer)",
    },
    "owner_b": {
        "name": "Anna Schmidt",
        "legal_name": "Anna Schmidt",
        "country": "AT",
        "description": "Ski owner (second-hand buyer)",
    },
    "service_shop": {
        "name": "ProSki Service Center",
        "legal_name": "ProSki Service Center KG",
        "country": "AT",
        "description": "Ski service and maintenance shop",
    },
    "dpp": {
        "name": "Digital Ski Passport",
        "legal_name": "Digital Ski Passport Provider",
        "country": "AT",
        "description": "Digital Product Passport provider for skis",
    },
    "repair_shop": {
        "name": "Repair Shop",
        "legal_name": "Repair Shop",
        "country": "AT",
        "description": "Independent ski service and repair",
    },
}


def create_participant_vcs(participant_id: str) -> list[dict]:
    """Create the set of VCs required for Gaia-X LegalPerson compliance:

    1. Registration number VC (gx:VatID)
    2. Legal person VC (gx:LegalPerson)
    3. Issuer terms & conditions VC
    """
    _load_keys()

    meta = PARTICIPANT_METADATA.get(participant_id, {
        "name": participant_id,
        "legal_name": participant_id,
        "country": "DE",
        "description": f"Participant {participant_id}",
    })

    now = datetime.now(timezone.utc)
    issuer = _issuer_did()
    subject_did = _participant_did(participant_id)
    reg_id = f"urn:uuid:{uuid.uuid4()}"
    lp_id = f"urn:uuid:{uuid.uuid4()}"
    tc_id = f"urn:uuid:{uuid.uuid4()}"

    registration_vc = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://w3id.org/gaia-x/development#",
        ],
        "type": ["VerifiableCredential", "gx:VatID"],
        "id": reg_id,
        "issuer": issuer,
        "validFrom": now.isoformat(),
        "validUntil": now.replace(year=now.year + 10).isoformat(),
        "credentialSubject": {
            "id": reg_id,
            "gx:vatID": f"{meta['country']}000000001",
            "gx:countryCode": meta["country"],
        },
    }

    legal_person_vc = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://w3id.org/gaia-x/development#",
        ],
        "type": ["VerifiableCredential", "gx:LegalPerson"],
        "id": lp_id,
        "issuer": issuer,
        "validFrom": now.isoformat(),
        "validUntil": now.replace(year=now.year + 10).isoformat(),
        "credentialSubject": {
            "id": f"{subject_did}#{uuid.uuid4().hex[:16]}",
            "name": meta["legal_name"],
            "gx:registrationNumber": {
                "id": reg_id,
            },
            "gx:headquartersAddress": {
                "type": "gx:Address",
                "countryCode": meta["country"],
            },
            "gx:legalAddress": {
                "type": "gx:Address",
                "countryCode": meta["country"],
            },
        },
    }

    terms_vc = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://w3id.org/gaia-x/development#",
        ],
        "type": ["VerifiableCredential", "gx:Issuer"],
        "id": tc_id,
        "issuer": issuer,
        "validFrom": now.isoformat(),
        "validUntil": now.replace(year=now.year + 10).isoformat(),
        "credentialSubject": {
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": "gx:Issuer",
            "gx:gaiaxTermsAndConditions": "067dcac5efd18c1927deb1ffed3feab6d0ad044c0a9a263e6d5d8bdc43224515",
        },
    }

    return [registration_vc, legal_person_vc, terms_vc]


def create_self_description_vc(participant_id: str) -> dict:
    """Backwards-compatible: return only the legal person VC."""
    return create_participant_vcs(participant_id)[1]


def sign_vc_as_jwt(vc: dict) -> str:
    """Sign a VC as JWT. Payload IS the VC itself (per gx-compliance expectations)."""
    _load_keys()

    issuer_did = vc["issuer"]
    kid = f"{issuer_did}#key-1"
    headers = {"alg": "RS256", "iss": issuer_did, "kid": kid}
    return jwt.encode(vc, _private_key, algorithm="RS256", headers=headers)


def create_vp_jwt(vc_jwts: list[str], holder_did: str) -> str:
    """Create VP-JWT. Payload IS the VP object (flat, not wrapped in 'vp' key).

    The compliance service reads verifiableCredential directly from the JWT payload.
    Each VC is an EnvelopedVerifiableCredential with id = "data:application/vc+jwt,{jwt}".
    """
    _load_keys()

    kid = f"{holder_did}#key-1"

    vp_payload = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://www.w3.org/ns/credentials/examples/v2",
        ],
        "type": ["VerifiablePresentation"],
        "verifiableCredential": [
            {
                "@context": "https://www.w3.org/ns/credentials/v2",
                "id": f"data:application/vc+jwt,{vc_jwt}",
                "type": "EnvelopedVerifiableCredential",
            }
            for vc_jwt in vc_jwts
        ],
    }

    headers = {"alg": "RS256", "iss": holder_did, "kid": kid}
    return jwt.encode(vp_payload, _private_key, algorithm="RS256", headers=headers)


async def submit_to_compliance(vp_jwt: str) -> dict:
    """Submit a VP-JWT to the Gaia-X compliance service and return the result."""
    url = f"{settings.GX_COMPLIANCE_URL}/api/credential-offers/standard-compliance"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            content=vp_jwt,
            headers={"Content-Type": "application/vp+jwt"},
            params={"vcid": f"urn:uuid:{uuid.uuid4()}"},
        )

    return {
        "status_code": resp.status_code,
        "success": 200 <= resp.status_code < 300,
        "body": resp.text[:2000],
        "content_type": resp.headers.get("content-type", ""),
    }


async def check_compliance_health() -> dict:
    """Check if the Gaia-X compliance service is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.GX_COMPLIANCE_URL)
        return {"reachable": True, "status": resp.status_code, "body": resp.json()}
    except Exception as e:
        return {"reachable": False, "error": str(e)}


async def check_registry_health() -> dict:
    """Check if the Gaia-X registry service is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.GX_REGISTRY_URL)
        return {"reachable": True, "status": resp.status_code, "body": resp.json()}
    except Exception as e:
        return {"reachable": False, "error": str(e)}


async def check_notary_health() -> dict:
    """Check if the Gaia-X notary service is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.GX_NOTARY_URL)
        return {"reachable": True, "status": resp.status_code, "body": resp.json()}
    except Exception as e:
        return {"reachable": False, "error": str(e)}


def get_did_document(participant_id: str) -> dict:
    """Generate a DID Document with publicKeyJwk.

    For 'bridge': returns the root DID doc (did:web:bridge.{DOMAIN})
    For participants: returns a sub-path DID doc (did:web:bridge.{DOMAIN}:api:did:{slug})
    """
    _load_keys()

    if participant_id == "bridge":
        did = _bridge_did()
    else:
        did = _participant_did(participant_id)

    slug = participant_id.replace("_", "-")
    doc = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/jws-2020/v1",
        ],
        "id": did,
        "verificationMethod": [
            {
                "id": f"{did}#key-1",
                "type": "JsonWebKey2020",
                "controller": did,
                "publicKeyJwk": _public_jwk,
            }
        ],
        "authentication": [f"{did}#key-1"],
        "assertionMethod": [f"{did}#key-1"],
    }

    if participant_id != "bridge":
        doc["service"] = [
            {
                "id": f"{did}#edc-dsp",
                "type": "ProtocolEndpoint",
                "serviceEndpoint": f"https://edc-{slug}.{settings.DOMAIN}/dsp/api/dsp",
            },
        ]

    return doc


def get_x509_certificate_chain() -> str:
    """Return the PEM certificate chain."""
    _load_keys()
    return _cert_pem_str
