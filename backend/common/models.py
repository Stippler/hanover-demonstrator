from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Participant(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    role: str
    gaiax_compliant: bool = False
    created_at: Optional[datetime] = None


class Ski(BaseModel):
    id: UUID
    serial_number: str
    model: str
    manufacturer: Optional[str] = None
    production_batch: Optional[str] = None
    vendor_participant_id: str
    qr_payload: Optional[str] = None
    created_at: Optional[datetime] = None


class SkiCreate(BaseModel):
    serial_number: Optional[str] = None
    model: str
    manufacturer: Optional[str] = None
    production_batch: Optional[str] = None
    # Extended identity fields
    category: Optional[str] = None          # e.g. "Carving", "Freeride", "Race"
    year: Optional[int] = None              # production year
    length_cm: Optional[int] = None         # ski length in cm
    width_mm: Optional[int] = None          # waist width in mm
    radius_m: Optional[float] = None        # turning radius in meters
    weight_kg: Optional[float] = None       # pair weight in kg
    skill_level: Optional[str] = None       # "Beginner" / "Intermediate" / "Expert"
    terrain: Optional[str] = None           # "Groomed" / "All-Mountain" / "Off-Piste"
    color: Optional[str] = None
    material: Optional[str] = None          # e.g. "Titanal / Carbon"
    binding_model: Optional[str] = None
    binding_din_range: Optional[str] = None # e.g. "3–12"
    country_of_origin: Optional[str] = None
    notes: Optional[str] = None  # free-form notes stored in product pass


class ProductPassport(BaseModel):
    id: UUID
    ski_id: UUID
    current_owner_participant_id: str
    identity_block: Optional[dict] = None
    manufacturer_block: Optional[dict] = None
    ownership_block: Optional[dict] = None
    service_block: Optional[dict] = None
    snapshot_json: Optional[dict] = None
    version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PassportEvent(BaseModel):
    id: UUID
    ski_id: UUID
    event_type: str
    actor_participant_id: str
    payload: Optional[dict] = None
    created_at: Optional[datetime] = None


class PassportEventCreate(BaseModel):
    ski_id: UUID
    event_type: str
    payload: Optional[dict] = None


class OwnershipTransfer(BaseModel):
    id: UUID
    ski_id: UUID
    seller_participant_id: str
    buyer_participant_id: str
    status: str
    transfer_token: Optional[str] = None
    created_at: Optional[datetime] = None


class TransferCreate(BaseModel):
    ski_id: UUID
    buyer_participant_id: str


class ServiceRecord(BaseModel):
    id: UUID
    ski_id: UUID
    service_type: str
    description: Optional[str] = None
    technician_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class ServiceRecordCreate(BaseModel):
    ski_id: UUID
    service_type: str
    description: Optional[str] = None
    technician_name: Optional[str] = None
    notes: Optional[str] = None


class InventoryItem(BaseModel):
    id: UUID
    ski_id: UUID
    participant_id: str
    status: str
    acquired_at: Optional[datetime] = None


class SystemLog(BaseModel):
    id: UUID
    level: str
    source: str
    action: str
    participant_id: Optional[str] = None
    details: Optional[dict] = None
    created_at: Optional[datetime] = None


class LoginRequest(BaseModel):
    username: str
    password: str
