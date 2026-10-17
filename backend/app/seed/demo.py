"""
HeatGuard Twin — Demo Seed Data
Generates deterministic fictional worker profiles and synthetic readings.
All workers and readings are clearly marked as synthetic.
No real personal health data is used or implied.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    DataSource,
    MetricType,
    Worker,
    WearableReading,
    WorkerCategory,
)

logger = logging.getLogger(__name__)

DEMO_SEED = 42
DEMO_WORKERS: list[dict[str, Any]] = [
    # Construction workers
    {
        "id": "WORKER-C001",
        "display_name": "Rajesh K.",
        "category": WorkerCategory.construction,
        "age_years": 34,
        "baseline_hr_bpm": 72,
        "scenario": "elevated",
    },
    {
        "id": "WORKER-C002",
        "display_name": "Suresh M.",
        "category": WorkerCategory.construction,
        "age_years": 28,
        "baseline_hr_bpm": 68,
        "scenario": "normal",
    },
    {
        "id": "WORKER-C003",
        "display_name": "Priya D.",
        "category": WorkerCategory.construction,
        "age_years": 42,
        "baseline_hr_bpm": 76,
        "scenario": "supervisor_review",
    },
    # Delivery riders
    {
        "id": "WORKER-D001",
        "display_name": "Amit T.",
        "category": WorkerCategory.delivery,
        "age_years": 25,
        "baseline_hr_bpm": 65,
        "scenario": "normal",
    },
    {
        "id": "WORKER-D002",
        "display_name": "Kavita R.",
        "category": WorkerCategory.delivery,
        "age_years": 31,
        "baseline_hr_bpm": 70,
        "scenario": "elevated",
    },
    {
        "id": "WORKER-D003",
        "display_name": "Vikram S.",
        "category": WorkerCategory.delivery,
        "age_years": 27,
        "baseline_hr_bpm": 67,
        "scenario": "stale",
    },
    # Street vendors
    {
        "id": "WORKER-V001",
        "display_name": "Lata P.",
        "category": WorkerCategory.street_vendor,
        "age_years": 45,
        "baseline_hr_bpm": 78,
        "scenario": "normal",
    },
    {
        "id": "WORKER-V002",
        "display_name": "Mohan G.",
        "category": WorkerCategory.street_vendor,
        "age_years": 52,
        "baseline_hr_bpm": 80,
        "scenario": "elevated",
    },
    {
        "id": "WORKER-V003",
        "display_name": "Sunita B.",
        "category": WorkerCategory.street_vendor,
        "age_years": 38,
        "baseline_hr_bpm": None,  # No baseline — insufficient data
        "scenario": "insufficient_data",
    },
    # Traffic police
    {
        "id": "WORKER-P001",
        "display_name": "Constable J.",
        "category": WorkerCategory.traffic_police,
        "age_years": 36,
        "baseline_hr_bpm": 73,
        "scenario": "supervisor_review",
    },
    {
        "id": "WORKER-P002",
        "display_name": "Head Const. A.",
        "category": WorkerCategory.traffic_police,
        "age_years": 44,
        "baseline_hr_bpm": 75,
        "scenario": "normal",
    },
    {
        "id": "WORKER-P003",
        "display_name": "Const. N.",
        "category": WorkerCategory.traffic_police,
        "age_years": 29,
        "baseline_hr_bpm": 69,
        "scenario": "disconnected",
    },
]


def _dedup_hash(worker_id: str, metric_type: str, measured_at: datetime, value: float) -> str:
    raw = f"{worker_id}|{metric_type}|{measured_at.isoformat()}|{value:.4f}"
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def _generate_readings(
    worker: dict[str, Any],
    rng: random.Random,
    now: datetime,
) -> list[WearableReading]:
    """Generate synthetic readings for a worker based on scenario."""
    scenario = worker["scenario"]
    worker_id = worker["id"]
    baseline = worker.get("baseline_hr_bpm") or 72.0
    readings: list[WearableReading] = []

    if scenario == "disconnected":
        # No readings at all — device disconnected
        return []

    if scenario == "stale":
        # Last reading was 3 hours ago
        intervals = [(now - timedelta(hours=3 + i * 0.25)) for i in range(8)]
        for ts in intervals:
            hr_val = baseline + rng.gauss(2, 4)
            hr_val = max(50, min(160, hr_val))
            readings.append(WearableReading(
                id=str(uuid.uuid4()),
                worker_id=worker_id,
                metric_type=MetricType.heart_rate,
                value=round(hr_val, 1),
                unit="bpm",
                measured_at=ts,
                source=DataSource.synthetic,
                is_synthetic=True,
                dedup_hash=_dedup_hash(worker_id, "heart_rate", ts, round(hr_val, 1)),
            ))
        return readings

    if scenario == "insufficient_data":
        # Only 2 readings — not enough for baseline
        for i in range(2):
            ts = now - timedelta(minutes=10 * (i + 1))
            hr_val = 85 + rng.gauss(0, 3)
            readings.append(WearableReading(
                id=str(uuid.uuid4()),
                worker_id=worker_id,
                metric_type=MetricType.heart_rate,
                value=round(hr_val, 1),
                unit="bpm",
                measured_at=ts,
                source=DataSource.synthetic,
                is_synthetic=True,
                dedup_hash=_dedup_hash(worker_id, "heart_rate", ts, round(hr_val, 1)),
            ))
        return readings

    # Generate baseline readings (past 2–7 days)
    for day in range(2, 8):
        for hour in [8, 10, 14, 16]:
            ts = now - timedelta(days=day, hours=hour, minutes=rng.randint(0, 30))
            hr_val = baseline + rng.gauss(0, 5)
            hr_val = max(50, min(120, hr_val))
            readings.append(WearableReading(
                id=str(uuid.uuid4()),
                worker_id=worker_id,
                metric_type=MetricType.heart_rate,
                value=round(hr_val, 1),
                unit="bpm",
                measured_at=ts,
                source=DataSource.synthetic,
                is_synthetic=True,
                dedup_hash=_dedup_hash(worker_id, "heart_rate", ts, round(hr_val, 1)),
            ))

    # Generate recent readings (last 2 hours)
    for i in range(12):
        ts = now - timedelta(minutes=10 * (i + 1))
        if scenario == "normal":
            delta = rng.gauss(2, 5)
        elif scenario == "elevated":
            # 20–35 bpm above baseline — "monitor" zone
            delta = 20 + rng.gauss(7, 3)
        elif scenario == "supervisor_review":
            # 40+ bpm above baseline — "supervisor_review" zone
            delta = 42 + rng.gauss(5, 3)
        else:
            delta = rng.gauss(0, 4)

        hr_val = baseline + delta
        hr_val = max(50, min(200, hr_val))
        readings.append(WearableReading(
            id=str(uuid.uuid4()),
            worker_id=worker_id,
            metric_type=MetricType.heart_rate,
            value=round(hr_val, 1),
            unit="bpm",
            measured_at=ts,
            source=DataSource.synthetic,
            is_synthetic=True,
            dedup_hash=_dedup_hash(worker_id, "heart_rate", ts, round(hr_val, 1)),
        ))

    # Add step readings for variety
    if scenario not in ("insufficient_data", "disconnected"):
        for i in range(4):
            ts = now - timedelta(minutes=30 * (i + 1))
            steps = rng.randint(200, 1200)
            readings.append(WearableReading(
                id=str(uuid.uuid4()),
                worker_id=worker_id,
                metric_type=MetricType.steps,
                value=float(steps),
                unit="steps",
                measured_at=ts,
                source=DataSource.synthetic,
                is_synthetic=True,
                dedup_hash=_dedup_hash(worker_id, "steps", ts, float(steps)),
            ))

    return readings


async def seed_demo_data(db: AsyncSession) -> dict[str, int]:
    """
    Seed the database with fictional demo workers and synthetic readings.
    All seeded data is clearly marked synthetic.
    Idempotent: skips existing workers.
    """
    from sqlalchemy import select

    rng = random.Random(DEMO_SEED)
    now = datetime.now(timezone.utc)
    worker_count = 0
    reading_count = 0

    for worker_def in DEMO_WORKERS:
        # Check if worker exists
        existing = await db.execute(
            select(Worker).where(Worker.id == worker_def["id"])
        )
        if existing.scalar_one_or_none() is not None:
            logger.debug("Worker %s already exists, skipping.", worker_def["id"])
            continue

        worker = Worker(
            id=worker_def["id"],
            display_name=worker_def["display_name"],
            category=worker_def["category"],
            age_years=worker_def.get("age_years"),
            baseline_hr_bpm=worker_def.get("baseline_hr_bpm"),
            is_synthetic=True,
            notes=f"Operational Profile: {worker_def['scenario'].replace('_', ' ').title()}",
        )
        db.add(worker)
        worker_count += 1

        readings = _generate_readings(worker_def, rng, now)
        for reading in readings:
            # Check dedup
            existing_r = await db.execute(
                select(WearableReading).where(
                    WearableReading.dedup_hash == reading.dedup_hash
                )
            )
            if existing_r.scalar_one_or_none() is None:
                db.add(reading)
                reading_count += 1

    await db.flush()
    logger.info("Demo seed complete: %d workers, %d readings", worker_count, reading_count)
    return {"worker_count": worker_count, "reading_count": reading_count}


async def clear_demo_data(db: AsyncSession) -> None:
    """Remove all synthetic workers and their readings (for demo reset)."""
    from sqlalchemy import delete

    await db.execute(
        delete(Worker).where(Worker.is_synthetic == True)  # noqa: E712
    )
    await db.flush()
