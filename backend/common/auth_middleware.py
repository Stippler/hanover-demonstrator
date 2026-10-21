"""Require auth on all /api/* (except /api/health and /api/auth/login). Accept API_SECRET or JWT."""
from __future__ import annotations

from typing import Callable, Awaitable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from common.config import settings
from common.auth import verify_token

DEFAULT_SKIP_PATHS = ("/api/health", "/api/auth/login")


def auth_middleware(
    extra_skip_paths: tuple[str, ...] = (),
    skip_post_paths: tuple[str, ...] = (),
) -> type:
    skip_paths = DEFAULT_SKIP_PATHS + extra_skip_paths

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(
            self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
        ) -> Response:
            if not request.url.path.startswith("/api/"):
                return await call_next(request)
            if any(request.url.path == p or request.url.path.startswith(p + "/") for p in skip_paths):
                return await call_next(request)
            if request.method == "POST" and any(
                request.url.path == p or request.url.path.startswith(p + "/") for p in skip_post_paths
            ):
                return await call_next(request)

            auth = request.headers.get("Authorization")
            if not auth or not auth.startswith("Bearer "):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid Authorization header"},
                )
            token = auth[7:].strip()
            if not token:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing or invalid Authorization header"},
                )
            if settings.API_SECRET and token == settings.API_SECRET:
                return await call_next(request)
            payload = verify_token(token)
            if payload:
                return await call_next(request)
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid or expired token"},
            )

    return AuthMiddleware
