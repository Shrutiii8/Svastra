"""
HeatGuard Twin — Digital Twin Assessment Engine

Implements a transparent, rule-based monitoring assessment.
This is a proof-of-concept prototype. It does NOT:
  - Diagnose heat illness
  - Claim clinically validated accuracy
  - Replace professional medical or occupational-health advice

If a worker reports severe symptoms, the system advises seeking immediate
human assistance regardless of calculated status.

Assessment logic is based on documented occupational health guidelines
used as illustrative thresholds for hackathon demonstration only.
All thresholds are labelled as configurable and not medically validated.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AssessmentStatus,
    MetricType,
    RiskAssessment,
    WearableReading,
    Worker,
    WorkerCategory,
)
from app.schemas import AssessmentResponse, DataQuality, EnvironmentContext, MLPrediction
from app.services.ml import get_ml_prediction
from app.services.weather import fetch_current_weather

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Illustrative thresholds (hackathon demo only — NOT medically validated)
# ---------------------------------------------------------------------------
# Heart rate elevation above personal baseline
HR_ELEVATED_THRESHOLD_BPM = 20     # >20 bpm above baseline → "monitor"
HR_HIGH_THRESHOLD_BPM = 40         # >40 bpm above baseline → "supervisor_review"
# Absolute thresholds when no baseline is available
HR_ABS_ELEVATED = 100              # >100 bpm → "monitor" (no baseline)
HR_ABS_HIGH = 130                  # >130 bpm → "supervisor_review" (no baseline)
# Data freshness
FRESH_READING_MINUTES = 30
STALE_READING_MINUTES = 120
# Minimum readings to compute a reliable baseline
MIN_BASELINE_READINGS = 5
# Environmental context (illustrative)
HOT_TEMP_C = 35.0                  # ≥35°C flagged as hot environment
VERY_HOT_TEMP_C = 40.0             # ≥40°C flagged as very hot

ACTIVITY_MAP: dict[WorkerCategory, int] = {
    WorkerCategory.construction: 2,
    WorkerCategory.delivery: 2,
    WorkerCategory.street_vendor: 1,
    WorkerCategory.traffic_police: 1,
}


def compute_heat_index(temp_c: float | None, humidity_pct: float | None) -> float:
    """Steadman heat index approximation in °C."""
    if temp_c is None:
        return 30.0
    if humidity_pct is None or temp_c < 27.0:
        return temp_c
    T = temp_c * 9 / 5 + 32
    RH = humidity_pct
    HI = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * RH
        - 0.22475541 * T * RH
        - 6.83783e-3 * T**2
        - 5.481717e-2 * RH**2
        + 1.22874e-3 * T**2 * RH
        + 8.5282e-4 * T * RH**2
        - 1.99e-6 * T**2 * RH**2
    )
    return round((HI - 32) * 5 / 9, 2)


async def run_assessment(
    worker_id: str,
    db: AsyncSession,
) -> AssessmentResponse:
    """
    Run a rule-based assessment for a single worker.
    Fetches recent readings, computes (or loads) baseline, evaluates rules.
    """
    now = datetime.now(timezone.utc)

    # 1. Load worker
    worker_result = await db.execute(
        select(Worker).where(Worker.id == worker_id)
    )
    worker = worker_result.scalar_one_or_none()
    if worker is None:
        raise ValueError(f"Worker {worker_id!r} not found")

    # 2. Load recent heart-rate readings (last 2 hours)
    recent_cutoff = now - timedelta(hours=2)
    hr_result = await db.execute(
        select(WearableReading)
        .where(
            WearableReading.worker_id == worker_id,
            WearableReading.metric_type == MetricType.heart_rate,
            WearableReading.measured_at >= recent_cutoff,
        )
        .order_by(WearableReading.measured_at.desc())
        .limit(50)
    )
    recent_hr_readings = hr_result.scalars().all()

    # 3. Load baseline readings (last 7 days, resting context)
    baseline_cutoff = now - timedelta(days=7)
    all_hr_result = await db.execute(
        select(WearableReading)
        .where(
            WearableReading.worker_id == worker_id,
            WearableReading.metric_type == MetricType.heart_rate,
            WearableReading.measured_at >= baseline_cutoff,
            WearableReading.measured_at < recent_cutoff,
        )
        .order_by(WearableReading.measured_at.asc())
    )
    baseline_readings = all_hr_result.scalars().all()

    # 4. Determine latest reading and freshness
    latest_hr: float | None = None
    latest_ts: datetime | None = None
    if recent_hr_readings:
        latest_reading = recent_hr_readings[0]
        latest_hr = latest_reading.value
        latest_ts = latest_reading.measured_at
    else:
        # Check for the latest recorded reading for this worker across history
        hist_result = await db.execute(
            select(WearableReading)
            .where(
                WearableReading.worker_id == worker_id,
                WearableReading.metric_type == MetricType.heart_rate,
            )
            .order_by(WearableReading.measured_at.desc())
            .limit(1)
        )
        hist_reading = hist_result.scalar_one_or_none()
        if hist_reading is not None:
            latest_hr = hist_reading.value
            latest_ts = hist_reading.measured_at

    freshness = _compute_freshness(latest_ts, now)

    # 5. Compute or load personal baseline
    baseline_hr: float | None = worker.baseline_hr_bpm
    baseline_available = False
    if len(baseline_readings) >= MIN_BASELINE_READINGS:
        hr_values = [r.value for r in baseline_readings]
        computed = sum(hr_values) / len(hr_values)
        if baseline_hr is None:
            baseline_hr = computed
        baseline_available = True
    elif worker.baseline_hr_bpm is not None:
        baseline_available = True

    # If still no baseline, default to 72.0 bpm resting standard
    if baseline_hr is None:
        baseline_hr = 72.0

    # 6. Fetch weather context
    weather_data = await fetch_current_weather()
    env_context = EnvironmentContext(
        temperature_c=weather_data.get("temperature_c"),
        humidity_pct=weather_data.get("humidity_pct"),
        source=weather_data.get("source", "unknown"),
        observed_at=weather_data.get("observed_at"),
    )

    # 7. Apply assessment rules
    observations: list[str] = []
    recommended_actions: list[str] = []
    status = AssessmentStatus.no_unusual_pattern

    total_readings = len(recent_hr_readings) + len(baseline_readings)
    reading_count = len(recent_hr_readings) or (1 if latest_hr is not None else 0)

    if latest_hr is None:
        status = AssessmentStatus.insufficient_data
        observations.append(
            "No heart-rate readings recorded yet. Telemetry data is required to assess risk."
        )
        recommended_actions.append(
            "Sync wearable device or wait for next telemetry transmission."
        )
    else:
        # Note data freshness if stale, but do not block assessment
        if freshness == "stale":
            observations.append(
                f"Most recent reading is from {_format_ts(latest_ts)} (stale telemetry; device sync recommended)."
            )

        # Evaluate HR relative to baseline
        delta = latest_hr - baseline_hr
        if baseline_available:
            if delta >= HR_HIGH_THRESHOLD_BPM:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) is {delta:.0f} bpm above the "
                    f"estimated baseline ({baseline_hr:.0f} bpm). "
                    "[Illustrative threshold — not medically validated]"
                )
                recommended_actions.extend([
                    "A supervisor should check on the worker.",
                    "Ensure access to shade, water, and rest.",
                    "If the worker reports symptoms of heat illness (dizziness, "
                    "nausea, confusion), seek immediate appropriate human assistance.",
                ])
                status = AssessmentStatus.supervisor_review
            elif delta >= HR_ELEVATED_THRESHOLD_BPM:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) is {delta:.0f} bpm above the "
                    f"estimated baseline ({baseline_hr:.0f} bpm). "
                    "[Illustrative threshold — not medically validated]"
                )
                recommended_actions.extend([
                    "Monitor the worker's condition.",
                    "Encourage regular hydration and rest breaks.",
                ])
                status = AssessmentStatus.monitor
            else:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) is within "
                    f"{abs(delta):.0f} bpm of the estimated baseline "
                    f"({baseline_hr:.0f} bpm)."
                )
        else:
            # No personal baseline — use absolute thresholds
            if latest_hr >= HR_ABS_HIGH:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) exceeds {HR_ABS_HIGH} bpm. "
                    "No personal baseline is available for comparison. "
                    "[Illustrative absolute threshold — not medically validated]"
                )
                recommended_actions.extend([
                    "Consider checking the worker's condition.",
                    "More readings are needed to establish a personal baseline.",
                    "If symptoms are present, seek immediate appropriate assistance.",
                ])
                status = AssessmentStatus.monitor
            elif latest_hr >= HR_ABS_ELEVATED:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) exceeds {HR_ABS_ELEVATED} bpm. "
                    "No personal baseline is currently available. "
                    "[Illustrative absolute threshold — not medically validated]"
                )
                recommended_actions.append(
                    "Continue monitoring. More readings are needed for a personal baseline."
                )
                status = AssessmentStatus.monitor
            else:
                observations.append(
                    f"Heart rate ({latest_hr:.0f} bpm) is within a typical resting range. "
                    "No personal baseline has been established yet."
                )

        # Environmental context (informational only)
        temp = env_context.temperature_c
        if temp is not None:
            source_note = " (simulated)" if "simulated" in env_context.source else ""
            if temp >= VERY_HOT_TEMP_C:
                observations.append(
                    f"Environmental temperature is {temp:.1f}°C{source_note} — "
                    "conditions are very hot. Heat strain risk increases with prolonged outdoor exposure. "
                    "Note: air temperature alone does not measure individual physiological heat strain."
                )
                if status == AssessmentStatus.no_unusual_pattern:
                    status = AssessmentStatus.monitor
                    recommended_actions.append(
                        "Given the high ambient temperature, ensure regular shade and water access."
                    )
            elif temp >= HOT_TEMP_C:
                observations.append(
                    f"Environmental temperature is {temp:.1f}°C{source_note}. "
                    "Conditions are hot. Monitor for signs of discomfort."
                )

        if not recommended_actions:
            recommended_actions.append(
                "No specific action needed at this time. Continue routine monitoring."
            )

    # 7b. Execute ML Inference if valid heart-rate telemetry is present
    ml_pred: MLPrediction | None = None
    assessment_type = "rule_based_prototype"

    if latest_hr is not None:
        reading_age_minutes = 5.0
        if latest_ts is not None:
            ts_aware = latest_ts if latest_ts.tzinfo is not None else latest_ts.replace(tzinfo=timezone.utc)
            now_aware = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
            reading_age_minutes = max(0.0, (now_aware - ts_aware).total_seconds() / 60)

        heat_idx = compute_heat_index(env_context.temperature_c, env_context.humidity_pct)
        act_level = ACTIVITY_MAP.get(worker.category, 2)

        ml_pred = await get_ml_prediction(
            heart_rate_bpm=latest_hr,
            baseline_hr_bpm=baseline_hr or 72.0,
            temperature_c=env_context.temperature_c or 30.0,
            humidity_pct=env_context.humidity_pct or 50.0,
            heat_index=heat_idx,
            age_years=worker.age_years or 32,
            minutes_since_break=30,
            activity_level=act_level,
            reading_age_minutes=reading_age_minutes,
        )

        if ml_pred is not None:
            assessment_type = "ml_augmented"
            observations.append(
                f"ML Model ({ml_pred.model_name}) evaluated risk as '{ml_pred.risk_label}' "
                f"with {int(ml_pred.confidence * 100)}% confidence ({ml_pred.source}). "
                f"[Non-diagnostic illustrative model prediction]"
            )
            # Safety enhancement: if ML identifies elevated risk, escalate status
            if ml_pred.risk_level == 2 and status == AssessmentStatus.no_unusual_pattern:
                status = AssessmentStatus.supervisor_review
                recommended_actions.insert(0, "ML classifier flagged elevated physiological risk: supervisor review recommended.")
            elif ml_pred.risk_level == 1 and status == AssessmentStatus.no_unusual_pattern:
                status = AssessmentStatus.monitor
                recommended_actions.insert(0, "ML classifier flagged moderate physiological strain: continue monitoring.")

    data_quality = DataQuality(
        freshness=freshness,
        baseline_available=baseline_available,
        reading_count=reading_count,
    )

    # 8. Persist assessment
    assessment = RiskAssessment(
        worker_id=worker_id,
        status=status,
        assessment_type=assessment_type,
        observations=json.dumps(observations),
        recommended_actions=json.dumps(recommended_actions),
        temperature_c=env_context.temperature_c if env_context else None,
        weather_source=env_context.source if env_context else None,
        baseline_hr=baseline_hr,
        latest_hr=latest_hr,
        data_freshness=freshness,
        baseline_available=baseline_available,
        ml_prediction_json=ml_pred.model_dump_json() if ml_pred else None,
        assessed_at=now,
    )
    db.add(assessment)
    await db.flush()

    return AssessmentResponse(
        worker_id=worker_id,
        status=status,
        assessment_type=assessment_type,
        observations=observations,
        environment=env_context,
        data_quality=data_quality,
        recommended_actions=recommended_actions,
        assessed_at=now,
        latest_hr=latest_hr,
        baseline_hr=baseline_hr,
        ml_prediction=ml_pred,
    )


def _compute_freshness(ts: datetime | None, now: datetime) -> str:
    if ts is None:
        return "unavailable"
    # Ensure both are timezone-aware for safe comparison
    ts_aware = ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)
    now_aware = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
    age = (now_aware - ts_aware).total_seconds() / 60
    if age <= FRESH_READING_MINUTES:
        return "recent"
    if age <= STALE_READING_MINUTES:
        return "stale"
    return "unavailable"


def _format_ts(ts: datetime | None) -> str:
    if ts is None:
        return "unknown time"
    return ts.strftime("%H:%M UTC")
