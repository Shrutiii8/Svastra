"""Assessments router"""
from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import RiskAssessment, Worker
from app.schemas import AssessmentResponse, DataQuality, EnvironmentContext, MLPrediction
from app.services.assessment import run_assessment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assessments", tags=["assessments"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/workers/{worker_id}", response_model=AssessmentResponse)
async def get_worker_assessment(worker_id: str, db: DbDep) -> AssessmentResponse:
    """Run a fresh assessment for the given worker."""
    worker_check = await db.execute(select(Worker.id).where(Worker.id == worker_id))
    if worker_check.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"Worker {worker_id!r} not found")
    return await run_assessment(worker_id, db)


@router.get("", response_model=list[AssessmentResponse])
async def list_assessments(
    db: DbDep,
    worker_id: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> list[AssessmentResponse]:
    """List recent stored assessments."""
    stmt = select(RiskAssessment).order_by(RiskAssessment.assessed_at.desc()).limit(limit)
    if worker_id:
        stmt = stmt.where(RiskAssessment.worker_id == worker_id)
    results = (await db.execute(stmt)).scalars().all()
    output = []
    for a in results:
        try:
            obs = json.loads(a.observations or "[]")
            actions = json.loads(a.recommended_actions or "[]")
        except (json.JSONDecodeError, TypeError):
            obs = []
            actions = []
        env = None
        if a.temperature_c is not None:
            env = EnvironmentContext(
                temperature_c=a.temperature_c,
                humidity_pct=None,
                source=a.weather_source or "unknown",
                observed_at=None,
            )
        dq = DataQuality(
            freshness=a.data_freshness or "unavailable",
            baseline_available=a.baseline_available,
            reading_count=0,
        )
        ml_pred = None
        if getattr(a, "ml_prediction_json", None):
            try:
                ml_pred = MLPrediction.model_validate_json(a.ml_prediction_json)
            except Exception:
                ml_pred = None

        output.append(AssessmentResponse(
            worker_id=a.worker_id,
            status=a.status,
            assessment_type=a.assessment_type,
            observations=obs,
            environment=env,
            data_quality=dq,
            recommended_actions=actions,
            assessed_at=a.assessed_at,
            latest_hr=a.latest_hr,
            baseline_hr=a.baseline_hr,
            ml_prediction=ml_pred,
        ))
    return output
