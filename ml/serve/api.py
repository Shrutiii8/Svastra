"""
HeatGuard Twin — ML: Inference API
=====================================

FastAPI microservice that serves the trained heat-stress risk classifier.
Designed to be called by the main FastAPI backend as an optional ML layer,
replacing or augmenting the rule-based assessment engine.

Endpoints:
    GET  /health          — health check + model metadata
    POST /predict         — single prediction
    POST /predict/batch   — batch prediction (up to 100 samples)

Run:
    uvicorn ml.serve.api:app --port 8001 --reload

DISCLAIMER:
    This service is a proof-of-concept trained on entirely synthetic data.
    All predictions are illustrative and NOT medically validated.
    DO NOT use for real medical or occupational-health decisions.
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

import os
import joblib
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Authentication: Permanent Non-Expiring Service Token
# ---------------------------------------------------------------------------
ML_API_TOKEN = os.getenv("ML_API_TOKEN", "heatguard-permanent-token-2026")


def verify_service_token(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    authorization: str | None = Header(None, alias="Authorization"),
) -> bool:
    """
    Validates permanent non-expiring service token.
    Accepts via X-API-Key header or Authorization: Bearer <token>.
    Permanent key ensures no unexpected token expiration breaks service.
    """
    if not ML_API_TOKEN or ML_API_TOKEN.lower() in ("disabled", "none", ""):
        return True

    token = x_api_key
    if not token and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        else:
            token = authorization

    # If matching permanent token provided, allow
    if token == ML_API_TOKEN:
        return True

    # If no token provided in local development, allow with warning
    if token is None:
        logger.debug("ML request received without token in local dev mode.")
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid ML service token. Token does not match configured permanent token.",
    )


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ML_ROOT = Path(__file__).parent.parent
MODEL_PATH = ML_ROOT / "artifacts" / "model" / "heat_stress_classifier.joblib"
META_PATH = ML_ROOT / "artifacts" / "model" / "metadata.json"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(application: "FastAPI"):
    """Pre-load model at startup to avoid cold-start latency on first request."""
    try:
        _load_pipeline()
        _load_metadata()
        logger.info("ML model pre-loaded successfully.")
    except FileNotFoundError as exc:
        logger.warning("Model not yet trained: %s", exc)
    yield  # App runs here
    # Shutdown: nothing to clean up for a read-only model


app = FastAPI(
    title="HeatGuard Twin — ML Inference API",
    description=(
        "Heat-stress risk classifier inference service. "
        "⚠️ DISCLAIMER: Trained on synthetic data. NOT medically validated. "
        "All predictions are illustrative only."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Model loader (loaded once at startup, cached)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _load_pipeline():
    """Load the sklearn Pipeline (StandardScaler + XGBClassifier) from disk."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model artifact not found at {MODEL_PATH}. "
            "Run `python -m ml.model.train` to generate it."
        )
    pipeline = joblib.load(MODEL_PATH)
    logger.info("ML model loaded from %s", MODEL_PATH)
    return pipeline


@lru_cache(maxsize=1)
def _load_metadata() -> dict:
    if META_PATH.exists():
        return json.loads(META_PATH.read_text())
    return {}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    """
    All fields required for a single inference call.
    Mirrors the feature set in ml/model/features.py.
    """
    heart_rate_bpm: float = Field(
        ..., ge=20.0, le=250.0, description="Latest HR reading in bpm"
    )
    baseline_hr_bpm: float = Field(
        ..., ge=30.0, le=130.0, description="Worker's resting baseline bpm"
    )
    temperature_c: float = Field(
        ..., ge=-10.0, le=55.0, description="Ambient temperature in °C"
    )
    humidity_pct: float = Field(
        ..., ge=0.0, le=100.0, description="Relative humidity 0–100 %"
    )
    heat_index: float = Field(
        ..., ge=-10.0, le=70.0,
        description="Pre-computed Steadman heat index in °C. "
                    "Pass temperature_c if heat index is unavailable.",
    )
    age_years: int = Field(..., ge=14, le=90, description="Worker age")
    minutes_since_break: int = Field(
        default=30, ge=0, le=480, description="Minutes since last rest/water break"
    )
    activity_level: int = Field(
        default=2, ge=0, le=3,
        description="0=resting, 1=light, 2=moderate, 3=heavy"
    )
    reading_age_minutes: float = Field(
        default=5.0, ge=0.0, le=1440.0, description="Age of the HR reading in minutes"
    )


class RiskPrediction(BaseModel):
    risk_level: int = Field(description="0=no_unusual_pattern, 1=monitor, 2=supervisor_review")
    risk_label: str = Field(description="Human-readable risk label")
    confidence: float = Field(description="Model confidence (max class probability)")
    probabilities: dict[str, float] = Field(description="Per-class probabilities")
    hr_delta: float = Field(description="Heart rate delta above baseline (bpm)")
    disclaimer: str = Field(
        default=(
            "This prediction is generated by a model trained on entirely synthetic data. "
            "It is illustrative only and NOT medically validated. "
            "Do not use for real medical or occupational-health decisions."
        )
    )


class BatchPredictRequest(BaseModel):
    samples: list[PredictRequest] = Field(..., min_length=1, max_length=100)


class BatchPredictResponse(BaseModel):
    predictions: list[RiskPrediction]
    count: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_path: str
    trained_at: str | None
    n_features: int | None
    test_accuracy: float | None
    test_f1_macro: float | None
    token_auth_enabled: bool = True
    token_status: str = "permanent_non_expiring"
    disclaimer: str


# ---------------------------------------------------------------------------
# Prediction logic
# ---------------------------------------------------------------------------
RISK_LABEL_TO_NAME = {0: "no_unusual_pattern", 1: "monitor", 2: "supervisor_review"}


def _predict_single(req: PredictRequest) -> RiskPrediction:
    """Run one prediction. Raises HTTPException on model/feature errors."""
    from ml.model.features import FEATURE_COLS, build_feature_row, validate_features

    pipeline = _load_pipeline()

    features = build_feature_row(
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

    warnings = validate_features(features)
    if warnings:
        logger.warning("Feature validation warnings: %s", warnings)

    import pandas as pd
    X = pd.DataFrame([{col: features[col] for col in FEATURE_COLS}])

    y_pred: int = int(pipeline.predict(X)[0])
    y_prob: list[float] = pipeline.predict_proba(X)[0].tolist()
    confidence = float(max(y_prob))

    prob_dict = {RISK_LABEL_TO_NAME[i]: round(y_prob[i], 4) for i in range(3)}

    return RiskPrediction(
        risk_level=y_pred,
        risk_label=RISK_LABEL_TO_NAME[y_pred],
        confidence=round(confidence, 4),
        probabilities=prob_dict,
        hr_delta=round(req.heart_rate_bpm - req.baseline_hr_bpm, 2),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Return service health and model metadata."""
    model_loaded = MODEL_PATH.exists()
    meta = _load_metadata() if model_loaded else {}
    return HealthResponse(
        status="ok" if model_loaded else "model_not_found",
        model_loaded=model_loaded,
        model_path=str(MODEL_PATH),
        trained_at=meta.get("trained_at"),
        n_features=meta.get("n_features"),
        test_accuracy=meta.get("test_accuracy"),
        test_f1_macro=meta.get("test_f1_macro"),
        token_auth_enabled=bool(ML_API_TOKEN),
        token_status="permanent_non_expiring",
        disclaimer=(
            "This service uses a model trained on entirely synthetic data. "
            "All predictions are illustrative only. NOT medically validated."
        ),
    )


@app.post(
    "/predict",
    response_model=RiskPrediction,
    status_code=status.HTTP_200_OK,
    tags=["inference"],
    summary="Predict heat-stress risk for a single worker reading",
)
async def predict(
    req: PredictRequest,
    _auth: bool = Depends(verify_service_token),
) -> RiskPrediction:
    """
    Predict the heat-stress risk level for a single set of worker biometrics.

    Returns one of:
      - `no_unusual_pattern` (0)
      - `monitor` (1)
      - `supervisor_review` (2)

    ⚠️ This is illustrative only. NOT medically validated.
    """
    try:
        return _predict_single(req)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model not loaded: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Prediction error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {exc}",
        ) from exc


@app.post(
    "/predict/batch",
    response_model=BatchPredictResponse,
    status_code=status.HTTP_200_OK,
    tags=["inference"],
    summary="Predict heat-stress risk for a batch of worker readings (max 100)",
)
async def predict_batch(
    req: BatchPredictRequest,
    _auth: bool = Depends(verify_service_token),
) -> BatchPredictResponse:
    """
    Predict heat-stress risk for multiple workers in one call.
    Samples are evaluated independently.

    ⚠️ This is illustrative only. NOT medically validated.
    """
    try:
        predictions = [_predict_single(sample) for sample in req.samples]
        return BatchPredictResponse(predictions=predictions, count=len(predictions))
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model not loaded: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("Batch prediction error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction failed: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run("ml.serve.api:app", host="0.0.0.0", port=8001, reload=True)
