from __future__ import annotations

import os
from contextlib import asynccontextmanager
from types import ModuleType

from fastapi import FastAPI

from common.database import close_pool, get_pool

APP_NAME = os.getenv("APP_NAME", "vendor")

_APP_MODULE_MAP = {
    "vendor": "vendor_api.main",
    "owner_a": "vault_a_api.main",
    "owner_b": "vault_b_api.main",
    "service": "service_api.main",
    "admin": "admin_api.main",
    "dpp": "dpp_api.main",
    "repair": "repair_api.main",
    "trace": "trace_api.main",
}

_loaded_mod: ModuleType | None = None


@asynccontextmanager
async def lifespan(application: FastAPI):
    await get_pool()
    if _loaded_mod and hasattr(_loaded_mod, "on_startup"):
        await _loaded_mod.on_startup()
    yield
    await close_pool()


def _load_app() -> FastAPI:
    global _loaded_mod
    module_path = _APP_MODULE_MAP.get(APP_NAME)
    if module_path is None:
        raise ValueError(f"Unknown APP_NAME: {APP_NAME!r}. Choose from {list(_APP_MODULE_MAP)}")

    import importlib

    mod = importlib.import_module(module_path)
    _loaded_mod = mod
    application: FastAPI = mod.app
    application.router.lifespan_context = lifespan
    return application


app = _load_app()
