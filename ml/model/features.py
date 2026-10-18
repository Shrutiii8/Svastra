"""
HeatGuard Twin — ML: Feature Engineering
=========================================

Defines the canonical feature set for the heat-stress risk classifier.
Both training and inference use this module to ensure consistency.

Feature columns (FEATURE_COLS) are the single source of truth.
Adding or removing features here automatically updates training & serving.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Canonical feature list — order matters for the trained model artifacts
# ---------------------------------------------------------------------------
FEATURE_COLS: list[str] = [
    "heart_rate_bpm",       # Latest HR reading in bpm
    "baseline_hr_bpm",      # Worker's personal resting baseline in bpm
    "hr_delta",             # heart_rate_bpm − baseline_hr_bpm
    "temperature_c",        # Ambient temperature in °C
    "humidity_pct",         # Relative humidity 0–100 %
    "heat_index",           # Derived Steadman heat index in °C
    "age_years",            # Worker age
    "minutes_since_break",  # Minutes since last rest / water break
    "activity_level",       # 0=resting, 1=light, 2=moderate, 3=heavy
    "reading_age_minutes",  # How stale the last reading is (minutes)
]

TARGET_COL: str = "risk_level"

# Risk level mapping (matches AssessmentStatus enum in backend)
RISK_LABEL_TO_NAME: dict[int, str] = {
    0: "no_unusual_pattern",
    1: "monitor",
    2: "supervisor_review",
}
RISK_NAME_TO_LABEL: dict[str, int] = {v: k for k, v in RISK_LABEL_TO_NAME.items()}


# ---------------------------------------------------------------------------
# Feature validation bounds (soft — log warnings, don't raise by default)
# ---------------------------------------------------------------------------
FEATURE_BOUNDS: dict[str, tuple[float, float]] = {
    "heart_rate_bpm": (20.0, 250.0),
    "baseline_hr_bpm": (30.0, 130.0),
    "hr_delta": (-80.0, 150.0),
    "temperature_c": (-10.0, 55.0),
    "humidity_pct": (0.0, 100.0),
    "heat_index": (-10.0, 70.0),
    "age_years": (14.0, 90.0),
    "minutes_since_break": (0.0, 480.0),
    "activity_level": (0.0, 3.0),
    "reading_age_minutes": (0.0, 1440.0),
}


def build_feature_row(
    heart_rate_bpm: float,
    baseline_hr_bpm: float,
    temperature_c: float,
    humidity_pct: float,
    heat_index: float,
    age_years: int,
    minutes_since_break: int,
    activity_level: int,
    reading_age_minutes: float,
) -> dict[str, Any]:
    """
    Construct a single feature dict for inference.
    Computes hr_delta automatically from the provided values.

    Args:
        heart_rate_bpm:       Latest HR reading in bpm.
        baseline_hr_bpm:      Worker's resting baseline (0 = use absolute thresholds).
        temperature_c:        Ambient temperature in °C.
        humidity_pct:         Relative humidity 0–100 %.
        heat_index:           Pre-computed heat index in °C (or pass temperature_c
                              if not available — the model will still work).
        age_years:            Worker age.
        minutes_since_break:  Minutes since last rest / water break.
        activity_level:       0=resting, 1=light, 2=moderate, 3=heavy.
        reading_age_minutes:  Age of the reading in minutes (freshness).

    Returns:
        dict mapping FEATURE_COLS → values.
    """
    hr_delta = heart_rate_bpm - baseline_hr_bpm
    return {
        "heart_rate_bpm": float(heart_rate_bpm),
        "baseline_hr_bpm": float(baseline_hr_bpm),
        "hr_delta": float(hr_delta),
        "temperature_c": float(temperature_c),
        "humidity_pct": float(humidity_pct),
        "heat_index": float(heat_index),
        "age_years": int(age_years),
        "minutes_since_break": int(minutes_since_break),
        "activity_level": int(activity_level),
        "reading_age_minutes": float(reading_age_minutes),
    }


def validate_features(features: dict[str, Any], strict: bool = False) -> list[str]:
    """
    Validate feature values against expected bounds.

    Args:
        features:  dict from build_feature_row().
        strict:    If True, raise ValueError on any violation.
                   If False, return a list of warning messages.

    Returns:
        List of warning strings (empty if all values are in-bounds).
    """
    warnings: list[str] = []
    for col, (lo, hi) in FEATURE_BOUNDS.items():
        val = features.get(col)
        if val is None:
            warnings.append(f"Missing feature: {col}")
            continue
        if not (lo <= float(val) <= hi):
            msg = f"Feature '{col}' value {val} is outside expected range [{lo}, {hi}]"
            warnings.append(msg)
    if strict and warnings:
        raise ValueError("Feature validation failed:\n" + "\n".join(warnings))
    return warnings


def features_to_dataframe(features: dict[str, Any]) -> pd.DataFrame:
    """
    Convert a single feature dict to a one-row DataFrame in the correct
    column order for model prediction.
    """
    return pd.DataFrame([{col: features[col] for col in FEATURE_COLS}])


def get_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract the feature matrix from a DataFrame that also contains
    the target column and/or other columns.
    """
    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"DataFrame is missing required feature columns: {missing}")
    return df[FEATURE_COLS].copy()
