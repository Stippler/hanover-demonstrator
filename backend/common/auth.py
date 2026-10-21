"""JWT creation/verification and user lookup for login."""
from __future__ import annotations

import time
from typing import Any

import jwt

from common.config import settings

# Default 24h
JWT_EXPIRY_SECONDS = 86400


def _parse_users() -> dict[str, str]:
    out: dict[str, str] = {}
    for part in (settings.APP_USERS or "").strip().split(","):
        part = part.strip()
        if ":" in part:
            u, _, p = part.partition(":")
            out[u.strip()] = p.strip()
    return out


def verify_credentials(username: str, password: str) -> bool:
    users = _parse_users()
    return users.get(username) == password


def create_token(username: str, app_name: str | None = None) -> str:
    payload: dict[str, Any] = {
        "sub": username,
        "app": app_name or settings.APP_NAME,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET or "secret",
        algorithm="HS256",
    )


def verify_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET or "secret",
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        return None
