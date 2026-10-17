"""Workers router"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Worker
from app.schemas import WorkerCreate, WorkerListResponse, WorkerResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workers", tags=["workers"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=WorkerListResponse)
async def list_workers(
    db: DbDep,
    category: str | None = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> WorkerListResponse:
    stmt = select(Worker)
    if active_only:
        stmt = stmt.where(Worker.is_active == True)  # noqa: E712
    if category:
        stmt = stmt.where(Worker.category == category)
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Worker.display_name)
    workers = (await db.execute(stmt)).scalars().all()
    return WorkerListResponse(
        workers=[WorkerResponse.model_validate(w) for w in workers],
        total=total,
    )


@router.get("/{worker_id}", response_model=WorkerResponse)
async def get_worker(worker_id: str, db: DbDep) -> WorkerResponse:
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar_one_or_none()
    if worker is None:
        raise HTTPException(status_code=404, detail=f"Worker {worker_id!r} not found")
    return WorkerResponse.model_validate(worker)


@router.post("", response_model=WorkerResponse, status_code=201)
async def create_worker(payload: WorkerCreate, db: DbDep) -> WorkerResponse:
    existing = await db.execute(select(Worker).where(Worker.id == payload.id))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Worker {payload.id!r} already exists")
    worker = Worker(**payload.model_dump())
    db.add(worker)
    await db.flush()
    await db.refresh(worker)
    return WorkerResponse.model_validate(worker)
