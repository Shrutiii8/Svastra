"""
HeatGuard Twin — ML: Unit Tests
================================

Tests for the feature engineering, data generator, and inference API.
Run from the project root:
    pytest ml/tests/ -v

NOTE: These tests do NOT require the trained model artifact.
      Model-dependent tests are skipped if artifacts are absent.
"""
from __future__ import annotations

import pytest
import pandas as pd
import numpy as np
from pathlib import Path


# ---------------------------------------------------------------------------
# Feature engineering tests
# ---------------------------------------------------------------------------
class TestFeatures:
    def test_feature_cols_not_empty(self):
        from ml.model.features import FEATURE_COLS
        assert len(FEATURE_COLS) > 0

    def test_build_feature_row_has_all_cols(self):
        from ml.model.features import FEATURE_COLS, build_feature_row
        row = build_feature_row(
            heart_rate_bpm=95.0,
            baseline_hr_bpm=70.0,
            temperature_c=35.0,
            humidity_pct=60.0,
            heat_index=40.0,
            age_years=30,
            minutes_since_break=45,
            activity_level=2,
            reading_age_minutes=5.0,
        )
        for col in FEATURE_COLS:
            assert col in row, f"Missing feature: {col}"

    def test_hr_delta_computed_correctly(self):
        from ml.model.features import build_feature_row
        row = build_feature_row(
            heart_rate_bpm=100.0,
            baseline_hr_bpm=72.0,
            temperature_c=30.0,
            humidity_pct=50.0,
            heat_index=33.0,
            age_years=25,
            minutes_since_break=30,
            activity_level=1,
            reading_age_minutes=10.0,
        )
        assert abs(row["hr_delta"] - (100.0 - 72.0)) < 1e-6

    def test_validate_features_passes_valid(self):
        from ml.model.features import build_feature_row, validate_features
        row = build_feature_row(
            heart_rate_bpm=85.0,
            baseline_hr_bpm=72.0,
            temperature_c=30.0,
            humidity_pct=55.0,
            heat_index=34.0,
            age_years=35,
            minutes_since_break=30,
            activity_level=2,
            reading_age_minutes=5.0,
        )
        warnings = validate_features(row)
        assert warnings == [], f"Unexpected warnings: {warnings}"

    def test_validate_features_warns_on_out_of_range(self):
        from ml.model.features import build_feature_row, validate_features
        row = build_feature_row(
            heart_rate_bpm=300.0,     # Out of range
            baseline_hr_bpm=72.0,
            temperature_c=30.0,
            humidity_pct=55.0,
            heat_index=34.0,
            age_years=35,
            minutes_since_break=30,
            activity_level=2,
            reading_age_minutes=5.0,
        )
        # Override heart_rate_bpm to bypass Pydantic bounds in dict directly
        row["heart_rate_bpm"] = 300.0
        warnings = validate_features(row)
        assert any("heart_rate_bpm" in w for w in warnings)

    def test_features_to_dataframe_shape(self):
        from ml.model.features import FEATURE_COLS, build_feature_row, features_to_dataframe
        row = build_feature_row(
            heart_rate_bpm=80.0, baseline_hr_bpm=70.0, temperature_c=28.0,
            humidity_pct=50.0, heat_index=30.0, age_years=28,
            minutes_since_break=20, activity_level=1, reading_age_minutes=3.0,
        )
        df = features_to_dataframe(row)
        assert df.shape == (1, len(FEATURE_COLS))
        assert list(df.columns) == FEATURE_COLS


# ---------------------------------------------------------------------------
# Data generator tests
# ---------------------------------------------------------------------------
class TestDataGenerator:
    def test_generate_returns_dataframe(self):
        from ml.data.generate import generate_dataset
        df = generate_dataset(n_samples=100, seed=0)
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 100

    def test_generate_has_expected_columns(self):
        from ml.data.generate import generate_dataset
        from ml.model.features import FEATURE_COLS, TARGET_COL
        df = generate_dataset(n_samples=50, seed=1)
        for col in FEATURE_COLS + [TARGET_COL]:
            assert col in df.columns, f"Missing column: {col}"

    def test_generate_risk_labels_valid(self):
        from ml.data.generate import generate_dataset
        df = generate_dataset(n_samples=500, seed=2)
        assert set(df["risk_level"].unique()).issubset({0, 1, 2})

    def test_generate_all_classes_present(self):
        from ml.data.generate import generate_dataset
        # With 1000 samples and default class weights, all 3 classes must appear
        df = generate_dataset(n_samples=1000, seed=3)
        assert len(df["risk_level"].unique()) == 3, "Not all risk classes generated"

    def test_generate_hr_values_in_range(self):
        from ml.data.generate import generate_dataset
        df = generate_dataset(n_samples=200, seed=4)
        assert df["heart_rate_bpm"].between(20, 250).all()
        assert df["baseline_hr_bpm"].between(40, 110).all()

    def test_heat_index_function(self):
        from ml.data.generate import _heat_index
        # At low temperature heat index should equal temp
        hi = _heat_index(20.0, 40.0)
        assert hi == 20.0
        # At high temperature heat index should exceed air temp
        hi_hot = _heat_index(38.0, 80.0)
        assert hi_hot > 38.0


# ---------------------------------------------------------------------------
# Inference API tests (no model required — uses TestClient)
# ---------------------------------------------------------------------------
class TestInferenceAPI:
    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from ml.serve.api import app
        return TestClient(app)

    def test_health_endpoint_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "model_loaded" in data
        assert "disclaimer" in data

    def test_predict_returns_503_if_no_model(self, client, tmp_path, monkeypatch):
        """If no model file exists, /predict must return 503."""
        import ml.serve.api as api_module
        # Clear cached model
        api_module._load_pipeline.cache_clear()
        # Point MODEL_PATH to a non-existent file
        monkeypatch.setattr(api_module, "MODEL_PATH", tmp_path / "nonexistent.joblib")
        resp = client.post("/predict", json={
            "heart_rate_bpm": 95.0,
            "baseline_hr_bpm": 72.0,
            "temperature_c": 35.0,
            "humidity_pct": 60.0,
            "heat_index": 40.0,
            "age_years": 30,
        })
        assert resp.status_code == 503

    def test_predict_validation_rejects_bad_hr(self, client):
        """Values outside Pydantic bounds must return 422."""
        resp = client.post("/predict", json={
            "heart_rate_bpm": 999,  # Out of 20–250 range
            "baseline_hr_bpm": 72.0,
            "temperature_c": 35.0,
            "humidity_pct": 60.0,
            "heat_index": 40.0,
            "age_years": 30,
        })
        assert resp.status_code == 422

    def test_batch_predict_validation_rejects_empty(self, client):
        resp = client.post("/predict/batch", json={"samples": []})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# End-to-end smoke test (skipped if model artifact is absent)
# ---------------------------------------------------------------------------
class TestEndToEnd:
    MODEL_PATH = (
        Path(__file__).parent.parent / "artifacts" / "model" / "heat_stress_classifier.joblib"
    )

    @pytest.mark.skipif(
        not (Path(__file__).parent.parent / "artifacts" / "model" / "heat_stress_classifier.joblib").exists(),
        reason="Trained model artifact not found — run `python -m ml.model.train` first",
    )
    def test_full_predict_pipeline(self):
        from fastapi.testclient import TestClient
        import ml.serve.api as api_module
        api_module._load_pipeline.cache_clear()
        api_module.MODEL_PATH = self.MODEL_PATH

        from ml.serve.api import app
        client = TestClient(app)

        resp = client.post("/predict", json={
            "heart_rate_bpm": 112.0,
            "baseline_hr_bpm": 72.0,
            "temperature_c": 38.5,
            "humidity_pct": 65.0,
            "heat_index": 45.2,
            "age_years": 34,
            "minutes_since_break": 60,
            "activity_level": 2,
            "reading_age_minutes": 5.0,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_level"] in [0, 1, 2]
        assert data["risk_label"] in ["no_unusual_pattern", "monitor", "supervisor_review"]
        assert 0.0 <= data["confidence"] <= 1.0
        assert "disclaimer" in data

    def test_permanent_token_auth(self, monkeypatch):
        from fastapi.testclient import TestClient
        import ml.serve.api as api_module
        from ml.serve.api import app

        monkeypatch.setattr(api_module, "ML_API_TOKEN", "permanent-test-token-123")
        client = TestClient(app)

        # Health is public
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["token_status"] == "permanent_non_expiring"

        valid_payload = {
            "heart_rate_bpm": 80.0,
            "baseline_hr_bpm": 70.0,
            "temperature_c": 30.0,
            "humidity_pct": 50.0,
            "heat_index": 32.0,
            "age_years": 28,
        }

        # Valid permanent token via X-API-Key
        resp_valid = client.post(
            "/predict",
            json=valid_payload,
            headers={"X-API-Key": "permanent-test-token-123"},
        )
        assert resp_valid.status_code == 200

        # Valid permanent token via Bearer Authorization
        resp_bearer = client.post(
            "/predict",
            json=valid_payload,
            headers={"Authorization": "Bearer permanent-test-token-123"},
        )
        assert resp_bearer.status_code == 200

        # Invalid token returns 401
        resp_bad = client.post(
            "/predict",
            json=valid_payload,
            headers={"X-API-Key": "wrong-expired-token"},
        )
        assert resp_bad.status_code == 401

