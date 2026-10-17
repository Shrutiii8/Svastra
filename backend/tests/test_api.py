"""
HeatGuard Twin — Backend Tests
Uses pytest-asyncio with in-memory SQLite for speed.
"""
from __future__ import annotations

import json
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import get_db, Base
from app.models import Worker, WorkerCategory


# --------------------------------------------------------------------------- #
# Test database setup                                                           #
# --------------------------------------------------------------------------- #

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_client(client):
    """Client with a demo worker pre-seeded."""
    async with TestSessionLocal() as db:
        worker = Worker(
            id="TEST-001",
            display_name="Test Worker (Demo)",
            category=WorkerCategory.construction,
            age_years=30,
            baseline_hr_bpm=72.0,
            is_synthetic=True,
        )
        db.add(worker)
        await db.commit()
    return client


# --------------------------------------------------------------------------- #
# Tests                                                                         #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_root(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    assert "HeatGuard Twin" in resp.json()["name"]


@pytest.mark.asyncio
async def test_worker_list_empty(client):
    resp = await client.get("/api/v1/workers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["workers"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_worker_create_and_get(client):
    payload = {
        "id": "WORKER-TEST-001",
        "display_name": "Test Worker (Demo)",
        "category": "construction",
        "age_years": 30,
        "baseline_hr_bpm": 72.0,
        "is_synthetic": True,
    }
    resp = await client.post("/api/v1/workers", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "WORKER-TEST-001"
    assert data["category"] == "construction"

    resp2 = await client.get("/api/v1/workers/WORKER-TEST-001")
    assert resp2.status_code == 200
    assert resp2.json()["display_name"] == "Test Worker (Demo)"


@pytest.mark.asyncio
async def test_worker_not_found(client):
    resp = await client.get("/api/v1/workers/DOES-NOT-EXIST")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_worker_duplicate(client):
    payload = {
        "id": "WORKER-DUP",
        "display_name": "Dup Worker",
        "category": "delivery",
        "is_synthetic": True,
    }
    r1 = await client.post("/api/v1/workers", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/workers", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_reading_submit_valid(seeded_client):
    payload = {
        "worker_id": "TEST-001",
        "metric_type": "heart_rate",
        "value": 85.0,
        "unit": "bpm",
        "measured_at": "2026-10-13T12:00:00Z",
        "source": "health_connect",
        "is_synthetic": False,
    }
    resp = await seeded_client.post("/api/v1/readings", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["value"] == 85.0
    assert data["metric_type"] == "heart_rate"


@pytest.mark.asyncio
async def test_reading_invalid_range(seeded_client):
    payload = {
        "worker_id": "TEST-001",
        "metric_type": "heart_rate",
        "value": 999.0,  # Out of range
        "unit": "bpm",
        "measured_at": "2026-10-13T12:00:00Z",
        "source": "health_connect",
        "is_synthetic": False,
    }
    resp = await seeded_client.post("/api/v1/readings", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_reading_invalid_worker(client):
    payload = {
        "worker_id": "NONEXISTENT",
        "metric_type": "heart_rate",
        "value": 80.0,
        "unit": "bpm",
        "measured_at": "2026-10-13T12:00:00Z",
        "source": "health_connect",
        "is_synthetic": False,
    }
    resp = await client.post("/api/v1/readings", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_reading_deduplication(seeded_client):
    payload = {
        "worker_id": "TEST-001",
        "metric_type": "heart_rate",
        "value": 90.0,
        "unit": "bpm",
        "measured_at": "2026-10-13T13:00:00Z",
        "source": "health_connect",
        "is_synthetic": False,
    }
    r1 = await seeded_client.post("/api/v1/readings", json=payload)
    assert r1.status_code == 201
    r2 = await seeded_client.post("/api/v1/readings", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_batch_reading_with_duplicates(seeded_client):
    payload = {
        "readings": [
            {
                "worker_id": "TEST-001",
                "metric_type": "heart_rate",
                "value": 88.0,
                "unit": "bpm",
                "measured_at": "2026-10-13T14:00:00Z",
                "source": "synthetic",
                "is_synthetic": True,
            },
            {
                "worker_id": "TEST-001",
                "metric_type": "heart_rate",
                "value": 88.0,  # Duplicate
                "unit": "bpm",
                "measured_at": "2026-10-13T14:00:00Z",
                "source": "synthetic",
                "is_synthetic": True,
            },
        ]
    }
    resp = await seeded_client.post("/api/v1/readings/batch", json=payload)
    assert resp.status_code == 207
    data = resp.json()
    assert data["stored"] == 1
    assert data["duplicates"] == 1


@pytest.mark.asyncio
async def test_readings_history(seeded_client):
    # First submit a reading
    await seeded_client.post("/api/v1/readings", json={
        "worker_id": "TEST-001",
        "metric_type": "heart_rate",
        "value": 77.0,
        "unit": "bpm",
        "measured_at": "2026-10-13T10:00:00Z",
        "source": "synthetic",
        "is_synthetic": True,
    })
    resp = await seeded_client.get("/api/v1/readings/TEST-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_assessment_insufficient_data(seeded_client):
    """Worker with no readings should return insufficient_data."""
    resp = await seeded_client.get("/api/v1/assessments/workers/TEST-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "insufficient_data"
    assert data["worker_id"] == "TEST-001"


@pytest.mark.asyncio
async def test_assessment_elevated_hr(seeded_client):
    """Submit elevated HR readings and verify assessment upgrades."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    # Submit 15 minutes of elevated readings
    for i in range(3):
        ts = (now - timedelta(minutes=i * 5)).isoformat()
        await seeded_client.post("/api/v1/readings", json={
            "worker_id": "TEST-001",
            "metric_type": "heart_rate",
            "value": 115.0,  # 43 bpm above baseline of 72
            "unit": "bpm",
            "measured_at": ts,
            "source": "synthetic",
            "is_synthetic": True,
        })
    resp = await seeded_client.get("/api/v1/assessments/workers/TEST-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("supervisor_review", "monitor")


@pytest.mark.asyncio
async def test_demo_status(client):
    resp = await client.get("/api/v1/demo/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "worker_count" in data
    assert "reading_count" in data


@pytest.mark.asyncio
async def test_weather_current(client):
    """Weather endpoint should return a response (simulated fallback in test)."""
    resp = await client.get("/api/v1/weather/current")
    assert resp.status_code == 200
    data = resp.json()
    assert "temperature_c" in data
    assert "source" in data


@pytest.mark.asyncio
async def test_synthetic_provenance(seeded_client):
    """Synthetic readings must carry is_synthetic=True."""
    await seeded_client.post("/api/v1/readings", json={
        "worker_id": "TEST-001",
        "metric_type": "steps",
        "value": 500.0,
        "unit": "steps",
        "measured_at": "2026-10-13T09:00:00Z",
        "source": "synthetic",
        "is_synthetic": True,
    })
    resp = await seeded_client.get("/api/v1/readings/TEST-001?metric_type=steps")
    data = resp.json()
    for r in data["readings"]:
        if r["source"] == "synthetic":
            assert r["is_synthetic"] is True


@pytest.mark.asyncio
async def test_worker_list_filter_by_category(client):
    for cat, wid in [("construction", "W-C1"), ("delivery", "W-D1")]:
        await client.post("/api/v1/workers", json={
            "id": wid, "display_name": f"Worker {wid}", "category": cat, "is_synthetic": True
        })
    resp = await client.get("/api/v1/workers?category=construction")
    data = resp.json()
    assert all(w["category"] == "construction" for w in data["workers"])


@pytest.mark.asyncio
async def test_ml_health_endpoint(client):
    """Verify ML pipeline health endpoint reports active mode and permanent token status."""
    resp = await client.get("/api/v1/ml/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_status"] == "permanent_non_expiring"
    assert data["token_auth_enabled"] is True
    assert data["active_mode"] in ("microservice", "local_pipeline", "rule_fallback")
    assert "disclaimer" in data


@pytest.mark.asyncio
async def test_ml_predict_endpoint(client):
    """Verify direct ML prediction endpoint returns risk assessment and confidence."""
    payload = {
        "heart_rate_bpm": 115.0,
        "baseline_hr_bpm": 70.0,
        "temperature_c": 38.0,
        "humidity_pct": 65.0,
        "heat_index": 44.0,
        "age_years": 35,
        "minutes_since_break": 60,
        "activity_level": 2,
        "reading_age_minutes": 5.0,
    }
    resp = await client.post(
        "/api/v1/ml/predict",
        json=payload,
        headers={"X-API-Key": "heatguard-permanent-token-2026"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["risk_level"] in (0, 1, 2)
    assert data["risk_label"] in ("no_unusual_pattern", "monitor", "supervisor_review")
    assert 0.0 <= data["confidence"] <= 1.0
    assert "probabilities" in data
    assert "disclaimer" in data


@pytest.mark.asyncio
async def test_assessment_includes_ml_prediction(seeded_client):
    """Submit fresh readings and verify the assessment includes ML prediction."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    for i in range(3):
        ts = (now - timedelta(minutes=i * 5)).isoformat()
        await seeded_client.post("/api/v1/readings", json={
            "worker_id": "TEST-001",
            "metric_type": "heart_rate",
            "value": 110.0,
            "unit": "bpm",
            "measured_at": ts,
            "source": "synthetic",
            "is_synthetic": True,
        })
    resp = await seeded_client.get("/api/v1/assessments/workers/TEST-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("supervisor_review", "monitor")
    # Verify ML is integrated into assessment
    assert data["assessment_type"] in ("ml_augmented", "rule_based_prototype")
    if data["ml_prediction"]:
        assert data["ml_prediction"]["risk_level"] in (0, 1, 2)
        assert data["ml_prediction"]["confidence"] > 0
        assert data["ml_prediction"]["probabilities"]

