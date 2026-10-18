"""
HeatGuard Twin — ML: Synthetic Training Data Generator
=======================================================

Generates a realistic, labelled dataset of worker heat-stress readings
for training and evaluating the heat-stress risk classifier.

IMPORTANT:
- All data is entirely synthetic and does NOT represent real individuals.
- No real health data is used or implied.
- This generator is for model development only.

Features generated per sample:
    heart_rate_bpm      — latest HR reading (bpm)
    baseline_hr_bpm     — worker's personal resting baseline (bpm)
    hr_delta            — heart_rate_bpm - baseline_hr_bpm
    temperature_c       — ambient temperature (°C)
    humidity_pct        — relative humidity (%)
    heat_index          — derived heat index (Steadman approximation)
    age_years           — worker age
    minutes_since_break — simulated time since last rest/water break
    activity_level      — 0=resting, 1=light, 2=moderate, 3=heavy
    reading_age_minutes — how fresh the reading is (minutes ago)

Label (target):
    risk_level  — 0=no_unusual_pattern, 1=monitor, 2=supervisor_review
"""
from __future__ import annotations

import argparse
import logging
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Illustrative thresholds — MUST MATCH assessment.py for consistency
# These are hackathon demo values, NOT medically validated.
# ---------------------------------------------------------------------------
HR_ELEVATED_THRESHOLD_BPM = 20   # > 20 bpm above baseline → monitor
HR_HIGH_THRESHOLD_BPM = 40       # > 40 bpm above baseline → supervisor_review
HR_ABS_ELEVATED = 100            # > 100 bpm → monitor (no baseline)
HR_ABS_HIGH = 130                # > 130 bpm → supervisor_review (no baseline)
VERY_HOT_TEMP_C = 40.0           # ≥ 40°C → elevated environmental risk

# Risk label mapping
RISK_LABELS = {0: "no_unusual_pattern", 1: "monitor", 2: "supervisor_review"}


@dataclass
class WorkerSample:
    heart_rate_bpm: float
    baseline_hr_bpm: float
    hr_delta: float
    temperature_c: float
    humidity_pct: float
    heat_index: float
    age_years: int
    minutes_since_break: int
    activity_level: int   # 0=resting, 1=light, 2=moderate, 3=heavy
    reading_age_minutes: float
    risk_level: int       # 0, 1, 2


def _heat_index(temp_c: float, humidity_pct: float) -> float:
    """
    Steadman / NOAA Heat Index approximation.
    Uses °C input; returns °C Heat Index.
    Non-validated illustrative approximation for feature engineering.
    """
    T = temp_c * 9 / 5 + 32          # convert to °F for Steadman formula
    RH = humidity_pct
    # Rothfusz regression (NWS)
    HI = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * RH
        - 0.22475541 * T * RH
        - 6.83783e-3 * T ** 2
        - 5.481717e-2 * RH ** 2
        + 1.22874e-3 * T ** 2 * RH
        + 8.5282e-4 * T * RH ** 2
        - 1.99e-6 * T ** 2 * RH ** 2
    )
    HI_c = (HI - 32) * 5 / 9         # back to °C
    # Clamp to avoid spurious values at low temperatures
    if temp_c < 27:
        HI_c = temp_c
    return round(float(HI_c), 2)


def _assign_risk_label(
    hr: float,
    baseline_hr: float,
    temp_c: float,
    humidity_pct: float,
    rng: random.Random,
) -> int:
    """
    Assign a risk label using the same rule logic as assessment.py
    with a small amount of noise to simulate real-world uncertainty.
    This ensures the ML model learns to replicate (and potentially
    surpass) the rule engine's decisions.

    Returns: 0, 1, or 2
    """
    delta = hr - baseline_hr
    heat_index = _heat_index(temp_c, humidity_pct)

    # Core HR rules (mirrors assessment.py)
    if delta >= HR_HIGH_THRESHOLD_BPM or hr >= HR_ABS_HIGH:
        base = 2
    elif delta >= HR_ELEVATED_THRESHOLD_BPM or hr >= HR_ABS_ELEVATED:
        base = 1
    else:
        base = 0

    # Environmental escalation (mirrors assessment.py VERY_HOT_TEMP_C logic)
    if base == 0 and heat_index >= VERY_HOT_TEMP_C:
        base = 1

    # Add label noise to ~5% of samples (simulates real-world ambiguity)
    if rng.random() < 0.05:
        base = rng.choice([0, 1, 2])

    return int(base)


def generate_dataset(
    n_samples: int = 10_000,
    seed: int = 42,
    class_weights: tuple[float, float, float] = (0.55, 0.30, 0.15),
) -> pd.DataFrame:
    """
    Generate a synthetic dataset.

    Args:
        n_samples:      Number of samples to generate.
        seed:           Random seed for reproducibility.
        class_weights:  Approximate desired proportions of
                        (no_unusual_pattern, monitor, supervisor_review).
                        The generator will over-sample rarer classes.

    Returns:
        pd.DataFrame with one row per sample and columns:
            heart_rate_bpm, baseline_hr_bpm, hr_delta, temperature_c,
            humidity_pct, heat_index, age_years, minutes_since_break,
            activity_level, reading_age_minutes, risk_level
    """
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)

    records: list[WorkerSample] = []

    for _ in range(n_samples):
        # Determine target class for this sample
        target_class = rng.choices([0, 1, 2], weights=list(class_weights))[0]

        # Worker demographics
        age = rng.randint(18, 60)
        baseline = float(rng.gauss(72, 8))
        baseline = max(50.0, min(100.0, baseline))

        # Environment
        temp_c = float(rng.gauss(32, 8))
        temp_c = max(18.0, min(50.0, temp_c))
        humidity_pct = float(rng.gauss(55, 20))
        humidity_pct = max(10.0, min(100.0, humidity_pct))

        activity = rng.choices([0, 1, 2, 3], weights=[0.1, 0.3, 0.4, 0.2])[0]
        minutes_since_break = rng.randint(0, 180)
        reading_age_minutes = abs(rng.gauss(10, 8))

        # Simulate actual HR based on target class
        if target_class == 0:
            # Normal: HR near baseline with small physiological variation
            activity_bump = activity * rng.gauss(5, 2)
            hr = baseline + activity_bump + rng.gauss(0, 5)
            hr = max(50.0, min(baseline + HR_ELEVATED_THRESHOLD_BPM - 1, hr))
        elif target_class == 1:
            # Elevated: HR 20–39 bpm above baseline
            elev = rng.uniform(HR_ELEVATED_THRESHOLD_BPM, HR_HIGH_THRESHOLD_BPM - 1)
            hr = baseline + elev + rng.gauss(0, 3)
        else:
            # Supervisor review: HR 40+ bpm above baseline
            elev = rng.uniform(HR_HIGH_THRESHOLD_BPM, HR_HIGH_THRESHOLD_BPM + 30)
            hr = baseline + elev + rng.gauss(0, 3)

        hr = max(30.0, min(220.0, hr))
        hr_delta = hr - baseline
        hi = _heat_index(temp_c, humidity_pct)

        risk = _assign_risk_label(hr, baseline, temp_c, humidity_pct, rng)

        records.append(WorkerSample(
            heart_rate_bpm=round(hr, 1),
            baseline_hr_bpm=round(baseline, 1),
            hr_delta=round(hr_delta, 2),
            temperature_c=round(temp_c, 1),
            humidity_pct=round(humidity_pct, 1),
            heat_index=hi,
            age_years=age,
            minutes_since_break=minutes_since_break,
            activity_level=activity,
            reading_age_minutes=round(reading_age_minutes, 1),
            risk_level=risk,
        ))

    df = pd.DataFrame([asdict(r) for r in records])
    logger.info(
        "Generated %d samples. Class distribution:\n%s",
        len(df),
        df["risk_level"].value_counts().to_string(),
    )
    return df


def save_dataset(df: pd.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info("Dataset saved to %s", output_path)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Generate synthetic heat-stress training data")
    parser.add_argument("--n-samples", type=int, default=10_000, help="Number of samples")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent.parent / "artifacts" / "data" / "training.csv",
        help="Output CSV path",
    )
    args = parser.parse_args()

    df = generate_dataset(n_samples=args.n_samples, seed=args.seed)
    save_dataset(df, args.output)
    print(f"\nDataset saved to: {args.output}")
    print(f"Shape: {df.shape}")
    print(f"\nRisk level distribution:\n{df['risk_level'].value_counts()}")


if __name__ == "__main__":
    main()
