"""Demo router"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import WearableReading, Worker, WorkerCategory
from app.schemas import DemoReset, DemoStatus
from app.seed.demo import clear_demo_data, seed_demo_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/demo", tags=["demo"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

_last_reset: datetime | None = None


@router.get("/status", response_model=DemoStatus)
async def demo_status(db: DbDep) -> DemoStatus:
    worker_count = (await db.execute(
        select(func.count()).select_from(Worker).where(Worker.is_synthetic == True)  # noqa: E712
    )).scalar_one()
    reading_count = (await db.execute(
        select(func.count()).select_from(WearableReading).where(WearableReading.is_synthetic == True)  # noqa: E712
    )).scalar_one()

    categories: dict[str, int] = {}
    for cat in WorkerCategory:
        count = (await db.execute(
            select(func.count()).select_from(Worker).where(
                Worker.category == cat,
                Worker.is_synthetic == True,  # noqa: E712
            )
        )).scalar_one()
        categories[cat.value] = count

    return DemoStatus(
        demo_mode=True,
        worker_count=worker_count,
        reading_count=reading_count,
        categories=categories,
        last_reset=_last_reset,
    )


@router.post("/reset", response_model=DemoReset)
async def demo_reset(db: DbDep) -> DemoReset:
    global _last_reset
    await clear_demo_data(db)
    result = await seed_demo_data(db)
    _last_reset = datetime.now(timezone.utc)
    return DemoReset(
        success=True,
        message="Workforce telemetry reset successfully. Standard profiles restored.",
        worker_count=result["worker_count"],
    )
