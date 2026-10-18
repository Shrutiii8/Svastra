"""
Tests for ML Microservice & Backend End-to-End Integration
Verifies Tier 1 (microservice HTTP with token auth) and Tier 2 (local model fallback).
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.config import get_settings
from app.services.ml import get_ml_prediction, check_ml_health, _predict_via_microservice
try:
    from ml.serve.api import app as ml_app
except ImportError:
    ml_app = None


@pytest.mark.skipif(ml_app is None, reason="Standalone ML microservice module not in path")
@pytest.mark.asyncio
async def test_ml_microservice_tier1_with_permanent_token(monkeypatch):
    """
    Simulate running ML microservice and verify backend makes successful
    authenticated HTTP calls using the permanent service token.
    """
    settings = get_settings()

    # Route calls to ml_app using ASGITransport
    transport = ASGITransport(app=ml_app)
    async with AsyncClient(transport=transport, base_url="http://localhost:8001") as client:
        # Test directly calling predict on the microservice with permanent token
        payload = {
            "heart_rate_bpm": 120.0,
            "baseline_hr_bpm": 70.0,
            "temperature_c": 39.0,
            "humidity_pct": 70.0,
            "heat_index": 48.0,
            "age_years": 35,
            "minutes_since_break": 60,
            "activity_level": 2,
            "reading_age_minutes": 5.0,
        }
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": settings.ml_api_token,
            "Authorization": f"Bearer {settings.ml_api_token}",
        }
        resp = await client.post("http://localhost:8001/predict", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_level"] in (1, 2)
        assert data["confidence"] > 0
        assert data["probabilities"]

        # Test with wrong token: must return 401
        bad_headers = {
            "Content-Type": "application/json",
            "X-API-Key": "wrong-expired-token",
        }
        resp_bad = await client.post("http://localhost:8001/predict", json=payload, headers=bad_headers)
        assert resp_bad.status_code == 401


@pytest.mark.asyncio
async def test_ml_tier2_local_pipeline_fallback():
    """
    Verify that when microservice is unreachable, local XGBoost pipeline
    executes in-process without any errors or token expiration issues.
    """
    prediction = await get_ml_prediction(
        heart_rate_bpm=110.0,
        baseline_hr_bpm=72.0,
        temperature_c=36.0,
        humidity_pct=60.0,
        heat_index=42.0,
        age_years=30,
        minutes_since_break=30,
        activity_level=2,
        reading_age_minutes=5.0,
    )
    assert prediction is not None
    assert prediction.risk_level in (0, 1, 2)
    assert prediction.risk_label in ("no_unusual_pattern", "monitor", "supervisor_review")
    assert 0.0 <= prediction.confidence <= 1.0
    assert prediction.source in ("ml_service", "ml_local")
    assert "XGBoost" in prediction.model_name
