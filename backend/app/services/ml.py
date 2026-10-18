"""
HeatGuard Twin — ML Integration Service
=======================================

Provides a resilient 3-tier ML inference integration for the HeatGuard Twin backend:
  1. Microservice Tier: Async HTTP POST to the ML inference service (ml/serve/api.py)
     using a permanent non-expiring service token (X-API-Key / Bearer).
  2. Local In-Process Tier: If microservice is offline, automatically executes the
     trained XGBoost pipeline artifact (ml/artifacts/model/heat_stress_classifier.joblib)
     in-process with zero network dependency.
  3. Graceful Fallback: If neither is reachable, cleanly returns None so the
     rule-based assessment engine continues without interruption or 500 errors.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings
from app.schemas import MLHealthResponse, MLPrediction

logger = logging.getLogger(__name__)

# Feature column order required by the trained pipeline
FEATURE_COLS = [
    "heart_rate_bpm",
    "baseline_hr_bpm",
    "hr_delta",
    "temperature_c",
    "humidity_pct",
    "heat_index",
    "age_years",
    "minutes_since_break",
    "activity_level",
    "reading_age_minutes",
]

RISK_LEVEL_MAP = {
    0: "no_unusual_pattern",
    1: "monitor",
    2: "supervisor_review",
}

# Resolve backend directory, workspace root and local model artifacts
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_ROOT = BACKEND_DIR.parent

def _get_model_path() -> Path | None:
    """Find trained model artifact from bundled backend path or workspace root."""
    candidates = [
        # 1. Bundled inside backend/app/ml_artifacts (solo backend deployment)
        Path(__file__).resolve().parent.parent / "ml_artifacts" / "heat_stress_classifier.joblib",
        # 2. Bundled inside backend/ml_artifacts
        BACKEND_DIR / "ml_artifacts" / "heat_stress_classifier.joblib",
        # 3. Monorepo root / ml/artifacts/model/
        WORKSPACE_ROOT / "ml" / "artifacts" / "model" / "heat_stress_classifier.joblib",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

def _get_metadata_path() -> Path | None:
    """Find model metadata from bundled backend path or workspace root."""
    candidates = [
        Path(__file__).resolve().parent.parent / "ml_artifacts" / "metadata.json",
        BACKEND_DIR / "ml_artifacts" / "metadata.json",
        WORKSPACE_ROOT / "ml" / "artifacts" / "model" / "metadata.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


@lru_cache(maxsize=1)
def _load_local_pipeline():
    """Load local trained model pipeline if present on disk."""
    model_path = _get_model_path()
    if not model_path:
        return None
    try:
        import joblib
        pipeline = joblib.load(model_path)
        logger.info("Loaded in-process ML pipeline from %s", model_path)
        return pipeline
    except Exception as exc:
        logger.warning("Could not load local ML pipeline from %s: %s", model_path, exc)
        return None


@lru_cache(maxsize=1)
def _load_local_metadata() -> dict[str, Any]:
    meta_path = _get_metadata_path()
    if meta_path and meta_path.exists():
        try:
            return json.loads(meta_path.read_text())
        except Exception:
            pass
    return {}


async def _predict_via_microservice(payload: dict[str, Any]) -> MLPrediction | None:
    """Tier 1: Call FastAPI ML microservice via HTTP with permanent service token."""
    settings = get_settings()
    if not settings.ml_enabled or not settings.ml_service_url:
        return None

    url = f"{settings.ml_service_url.rstrip('/')}/predict"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": settings.ml_api_token,
        "Authorization": f"Bearer {settings.ml_api_token}",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ml_timeout_seconds) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return MLPrediction(
                    risk_level=data["risk_level"],
                    risk_label=data["risk_label"],
                    confidence=data["confidence"],
                    probabilities=data["probabilities"],
                    source="ml_service",
                    model_name="XGBoost Heat Stress Classifier (Microservice)",
                    disclaimer=data.get(
                        "disclaimer",
                        "Trained on synthetic data. Illustrative non-diagnostic assessment.",
                    ),
                )
            else:
                logger.warning(
                    "ML microservice returned status %d: %s", resp.status_code, resp.text
                )
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
        logger.debug("ML microservice unavailable (%s), trying local pipeline fallback.", exc)

    return None


def _predict_via_local_pipeline(payload: dict[str, Any]) -> MLPrediction | None:
    """Tier 2: In-process local prediction using scikit-learn/XGBoost pipeline."""
    pipeline = _load_local_pipeline()
    if pipeline is None:
        return None

    try:
        import pandas as pd

        hr = float(payload["heart_rate_bpm"])
        baseline = float(payload["baseline_hr_bpm"])
        row = {
            "heart_rate_bpm": hr,
            "baseline_hr_bpm": baseline,
            "hr_delta": hr - baseline,
            "temperature_c": float(payload["temperature_c"]),
            "humidity_pct": float(payload["humidity_pct"]),
            "heat_index": float(payload.get("heat_index") or payload["temperature_c"]),
            "age_years": int(payload.get("age_years", 30)),
            "minutes_since_break": int(payload.get("minutes_since_break", 30)),
            "activity_level": int(payload.get("activity_level", 2)),
            "reading_age_minutes": float(payload.get("reading_age_minutes", 5.0)),
        }
        df = pd.DataFrame([{col: row[col] for col in FEATURE_COLS}])

        y_pred = int(pipeline.predict(df)[0])
        y_prob = pipeline.predict_proba(df)[0].tolist()
        confidence = float(max(y_prob))

        prob_dict = {RISK_LEVEL_MAP[i]: round(y_prob[i], 4) for i in range(3)}

        return MLPrediction(
            risk_level=y_pred,
            risk_label=RISK_LEVEL_MAP.get(y_pred, "unknown"),
            confidence=round(confidence, 4),
            probabilities=prob_dict,
            source="ml_local",
            model_name="XGBoost Heat Stress Classifier (Local)",
            disclaimer=(
                "Non-diagnostic illustrative model prediction trained on synthetic data. "
                "Evaluated in-process via local model pipeline."
            ),
        )
    except Exception as exc:
        logger.warning("Local ML pipeline evaluation error: %s", exc)
        return None


async def get_ml_prediction(
    heart_rate_bpm: float,
    baseline_hr_bpm: float,
    temperature_c: float,
    humidity_pct: float,
    heat_index: float | None = None,
    age_years: int = 30,
    minutes_since_break: int = 30,
    activity_level: int = 2,
    reading_age_minutes: float = 5.0,
) -> MLPrediction | None:
    """
    Execute heat-stress risk inference with full fallback protection:
      1. Calls remote ML microservice (using permanent service token).
      2. If remote service fails, evaluates via local XGBoost model pipeline.
      3. If both fail, returns None (allowing safe rule-based fallback).
    """
    hi = heat_index if heat_index is not None else temperature_c
    payload = {
        "heart_rate_bpm": heart_rate_bpm,
        "baseline_hr_bpm": baseline_hr_bpm,
        "temperature_c": temperature_c,
        "humidity_pct": humidity_pct,
        "heat_index": hi,
        "age_years": age_years,
        "minutes_since_break": minutes_since_break,
        "activity_level": activity_level,
        "reading_age_minutes": reading_age_minutes,
    }

    # Tier 1: Microservice
    ml_res = await _predict_via_microservice(payload)
    if ml_res is not None:
        return ml_res

    # Tier 2: In-process fallback
    return _predict_via_local_pipeline(payload)


async def check_ml_health() -> MLHealthResponse:
    """Inspect status of ML service and local model pipeline."""
    settings = get_settings()
    service_ok = False
    meta: dict[str, Any] = {}

    if settings.ml_enabled and settings.ml_service_url:
        try:
            url = f"{settings.ml_service_url.rstrip('/')}/health"
            headers = {"X-API-Key": settings.ml_api_token}
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    service_ok = True
                    meta = resp.json()
        except Exception:
            service_ok = False

    resolved_model_path = _get_model_path()
    local_model_exists = resolved_model_path is not None
    if not meta and local_model_exists:
        meta = _load_local_metadata()

    if service_ok:
        mode = "microservice"
        status_str = "online"
    elif local_model_exists:
        mode = "local_pipeline"
        status_str = "local_only"
    else:
        mode = "rule_fallback"
        status_str = "fallback_rules_only"

    return MLHealthResponse(
        status=status_str,
        service_available=service_ok,
        local_model_available=local_model_exists,
        active_mode=mode,
        model_path=str(resolved_model_path) if resolved_model_path else None,
        token_auth_enabled=bool(settings.ml_api_token),
        token_status="permanent_non_expiring",
        trained_at=meta.get("trained_at"),
        test_accuracy=meta.get("test_accuracy"),
        test_f1_macro=meta.get("test_f1_macro"),
        disclaimer=(
            "HeatGuard Twin ML pipeline operates on synthetic data. "
            "Illustrative non-diagnostic heat strain evaluation."
        ),
    )
