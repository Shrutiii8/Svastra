# HeatGuard Twin — ML Pipeline

> ⚠️ **Disclaimer:** All models are trained on entirely **synthetic data** for a hackathon proof-of-concept. Predictions are **illustrative only** and **NOT medically validated**. Do not use for real medical or occupational-health decisions.

---

## Overview

This folder contains the complete ML pipeline for the HeatGuard Twin project:

| Component | Purpose |
|-----------|---------|
| `data/generate.py` | Synthetic training data generator |
| `model/features.py` | Canonical feature set (single source of truth) |
| `model/train.py` | XGBoost classifier training + Optuna tuning |
| `model/evaluate.py` | Evaluation metrics + visual report |
| `serve/api.py` | FastAPI inference microservice |

---

## Architecture

```
                     ┌──────────────────────────────┐
                     │   HeatGuard Backend (FastAPI) │
                     │      port 8000                │
                     └────────────┬─────────────────┘
                                  │ HTTP POST /predict
                                  ▼
                     ┌──────────────────────────────┐
                     │   ML Inference API (FastAPI)  │
                     │      port 8001                │
                     │                              │
                     │  StandardScaler              │
                     │       ↓                      │
                     │  XGBClassifier               │
                     │       ↓                      │
                     │  risk_level: 0 / 1 / 2       │
                     └──────────────────────────────┘
```

---

## Quick Start

### 1. Create a virtual environment

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Generate training data

```bash
# Generates 10,000 synthetic labelled samples
python -m ml.data.generate

# Custom size
python -m ml.data.generate --n-samples 50000
```

### 3. Train the model

```bash
# Quick training (default hyperparameters)
python -m ml.model.train

# With Optuna hyperparameter tuning (recommended)
python -m ml.model.train --tune --n-trials 50
```

### 4. Evaluate the model

```bash
python -m ml.model.evaluate
# Outputs: artifacts/eval/confusion_matrix.png
#          artifacts/eval/roc_curves.png
#          artifacts/eval/feature_importance.png
#          artifacts/eval/evaluation_report.json
```

### 5. Start the inference API

```bash
uvicorn ml.serve.api:app --port 8001 --reload
# Docs: http://localhost:8001/docs
```

---

## Feature Set

| Feature | Description | Range |
|---------|-------------|-------|
| `heart_rate_bpm` | Latest HR reading | 20–250 bpm |
| `baseline_hr_bpm` | Worker's resting baseline | 30–130 bpm |
| `hr_delta` | HR − baseline | computed |
| `temperature_c` | Ambient temperature | °C |
| `humidity_pct` | Relative humidity | 0–100 % |
| `heat_index` | Steadman heat index | °C |
| `age_years` | Worker age | 14–90 |
| `minutes_since_break` | Time since last rest/water | 0–480 min |
| `activity_level` | 0=resting … 3=heavy | 0–3 |
| `reading_age_minutes` | Freshness of HR reading | 0–1440 min |

---

## Risk Levels

| Level | Label | Meaning |
|-------|-------|---------|
| `0` | `no_unusual_pattern` | No unusual physiological pattern detected |
| `1` | `monitor` | HR elevated — monitor the worker |
| `2` | `supervisor_review` | HR significantly elevated — supervisor check needed |

---

## API Reference

### `POST /predict`

```json
{
  "heart_rate_bpm": 112,
  "baseline_hr_bpm": 72,
  "temperature_c": 38.5,
  "humidity_pct": 65,
  "heat_index": 45.2,
  "age_years": 34,
  "minutes_since_break": 60,
  "activity_level": 2,
  "reading_age_minutes": 5
}
```

**Response:**

```json
{
  "risk_level": 1,
  "risk_label": "monitor",
  "confidence": 0.87,
  "probabilities": {
    "no_unusual_pattern": 0.05,
    "monitor": 0.87,
    "supervisor_review": 0.08
  },
  "hr_delta": 40.0,
  "disclaimer": "..."
}
```

### `POST /predict/batch`

Send `{ "samples": [ <PredictRequest>, ... ] }` — up to 100 samples.

### `GET /health`

Returns model load status, training metadata, and accuracy metrics.

---

## Running All Commands (from project root)

```bash
# Always run from the Svastra-master root so Python resolves the `ml` package
cd /path/to/Svastra-master

python -m ml.data.generate
python -m ml.model.train --tune --n-trials 30
python -m ml.model.evaluate
uvicorn ml.serve.api:app --port 8001
```

---

## Artifact Structure

```
ml/
├── artifacts/           # Gitignored — generated locally
│   ├── data/
│   │   └── training.csv
│   ├── model/
│   │   ├── heat_stress_classifier.joblib
│   │   └── metadata.json
│   └── eval/
│       ├── confusion_matrix.png
│       ├── roc_curves.png
│       ├── feature_importance.png
│       └── evaluation_report.json
├── data/
│   ├── __init__.py
│   └── generate.py
├── model/
│   ├── __init__.py
│   ├── features.py
│   ├── train.py
│   └── evaluate.py
├── serve/
│   ├── __init__.py
│   └── api.py
├── __init__.py
├── requirements.txt
├── .gitignore
└── README.md
```
