"""Readings router"""
from __future__ import annotations

import hashlib
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import WearableReading, Worker
from app.schemas import (
    ReadingBatchCreate,
    ReadingCreate,
    ReadingListResponse,
    ReadingResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/readings", tags=["readings"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


def _make_dedup_hash(r: ReadingCreate) -> str:
    raw = (
        f"{r.worker_id}|{r.metric_type}|"
        f"{r.measured_at.isoformat()}|{r.value:.4f}"
    )
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


async def _persist_reading(reading: ReadingCreate, db: AsyncSession) -> WearableReading | None:
    """Persist a reading; return None if duplicate."""
    dedup = _make_dedup_hash(reading)
    existing = await db.execute(
        select(WearableReading).where(WearableReading.dedup_hash == dedup)
    )
    if existing.scalar_one_or_none() is not None:
        return None

    # Validate worker exists
    worker_exists = await db.execute(
        select(Worker.id).where(Worker.id == reading.worker_id)
    )
    if worker_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=422, detail=f"Worker {reading.worker_id!r} does not exist")

    obj = WearableReading(
        worker_id=reading.worker_id,
        metric_type=reading.metric_type,
        value=reading.value,
        unit=reading.unit,
        measured_at=reading.measured_at,
        source=reading.source,
        is_synthetic=reading.is_synthetic,
        source_record_id=reading.source_record_id,
        dedup_hash=dedup,
    )
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.post("", response_model=ReadingResponse, status_code=201)
async def submit_reading(payload: ReadingCreate, db: DbDep) -> ReadingResponse:
    result = await _persist_reading(payload, db)
    if result is None:
        raise HTTPException(status_code=409, detail="Duplicate reading; already stored")
    return ReadingResponse.model_validate(result)


@router.post("/batch", status_code=207)
async def submit_batch(payload: ReadingBatchCreate, db: DbDep) -> dict:
    stored = 0
    duplicates = 0
    errors: list[str] = []
    for idx, reading in enumerate(payload.readings):
        try:
            result = await _persist_reading(reading, db)
            if result is None:
                duplicates += 1
            else:
                stored += 1
        except HTTPException as exc:
            errors.append(f"[{idx}] {exc.detail}")
        except Exception as exc:
            errors.append(f"[{idx}] Unexpected error: {exc}")
    return {
        "stored": stored,
        "duplicates": duplicates,
        "errors": errors,
        "total": len(payload.readings),
    }


@router.get("/{worker_id}", response_model=ReadingListResponse)
async def get_worker_readings(
    worker_id: str,
    db: DbDep,
    metric_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> ReadingListResponse:
    stmt = select(WearableReading).where(WearableReading.worker_id == worker_id)
    if metric_type:
        stmt = stmt.where(WearableReading.metric_type == metric_type)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(WearableReading.measured_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    readings = (await db.execute(stmt)).scalars().all()
    return ReadingListResponse(
        readings=[ReadingResponse.model_validate(r) for r in readings],
        total=total,
        page=page,
        page_size=page_size,
    )
