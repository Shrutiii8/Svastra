"""
HeatGuard Twin — ML Router
==========================

Exposes endpoints for:
  - Checking ML inference pipeline health and active mode
  - On-demand heat-stress risk classification using the 3-tier inference engine
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import get_settings
from app.schemas import MLHealthResponse, MLPredictRequest, MLPrediction
from app.services.ml import check_ml_health, get_ml_prediction

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ml", tags=["machine_learning"])


def verify_client_token(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    authorization: str | None = Header(None, alias="Authorization"),
) -> bool:
    """
    Optional client authentication with permanent, non-expiring token.
    Allows easy development while ensuring secured deployments never expire.
    """
    settings = get_settings()
    configured_token = getattr(settings, "api_auth_token", None) or getattr(settings, "ml_api_token", None)
    if not configured_token:
        return True

    token = x_api_key
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        else:
            token = authorization

    if token == configured_token:
        return True

    # Allow unauthenticated in local development mode
    if token is None and settings.environment == "development":
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token. Ensure the configured permanent token is provided.",
    )


@router.get("/health", response_model=MLHealthResponse, summary="Inspect ML pipeline health and active mode")
async def ml_health() -> MLHealthResponse:
    """
    Check availability of the ML microservice and local XGBoost pipeline.
    Reports active mode (microservice, local_pipeline, or rule_fallback).
    """
    return await check_ml_health()


@router.post(
    "/predict",
    response_model=MLPrediction,
    summary="Direct biometric heat-stress risk classification",
)
async def ml_predict(
    req: MLPredictRequest,
    _auth: bool = Depends(verify_client_token),
) -> MLPrediction:
    """
    Run heat-stress risk inference on biometric and atmospheric parameters.
    Returns predicted risk level (0, 1, 2), confidence score, and class probabilities.
    Uses resilient 3-tier inference (microservice -> local pipeline -> rule fallback).
    """
    pred = await get_ml_prediction(
        heart_rate_bpm=req.heart_rate_bpm,
        baseline_hr_bpm=req.baseline_hr_bpm,
        temperature_c=req.temperature_c,
        humidity_pct=req.humidity_pct,
        heat_index=req.heat_index,
        age_years=req.age_years,
        minutes_since_break=req.minutes_since_break,
        activity_level=req.activity_level,
        reading_age_minutes=req.reading_age_minutes,
    )
    if pred is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML inference is currently unavailable (no microservice or local model artifact).",
        )
    return pred
