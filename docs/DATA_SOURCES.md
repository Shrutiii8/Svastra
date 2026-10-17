# HeatGuard Twin — Data Sources

## Overview

This document describes all data sources used in HeatGuard Twin, their provenance, licenses, and how they are integrated.

---

## 1. Android Health Connect

**What it is:** Android's unified health and fitness data repository. Apps and wearable companion apps write health records (heart rate, steps, etc.) to Health Connect, and other apps can read them with user permission.

**How HeatGuard uses it:**
- Reads `HeartRate`, `Steps`, `Distance`, and `OxygenSaturation` records
- Only reads data after the user explicitly grants permission
- Only reads the last 24 hours of records per sync
- All readings from Health Connect are labelled `source: "health_connect"` and `is_synthetic: false`

**Titan Smartwatch integration:**
- The Titan Smart companion app writes Titan watch data to Android Health Connect
- HeatGuard reads from Health Connect — it does not connect directly to the watch
- Titan readings may be intermittent; missing periods are not interpolated

**Permissions required:**
```
android.permission.health.READ_HEART_RATE
android.permission.health.READ_STEPS
android.permission.health.READ_DISTANCE
android.permission.health.READ_OXYGEN_SATURATION
```

**License:** Health Connect API is provided by Google under the [Android Health SDK](https://developer.android.com/health-and-fitness/guides/health-connect).

**Important:** Heart rate data from wearables should be considered indicative, not clinically precise. Device accuracy varies.

---

## 2. Open-Meteo Weather API

**URL:** https://open-meteo.com/en/docs

**What it is:** A free, open-source weather API providing global weather forecasts. No API key is required for the free tier.

**Variables used:**
| Variable | Description |
|----------|-------------|
| `temperature_2m` | Air temperature at 2m height (°C) |
| `relative_humidity_2m` | Relative humidity (%) |
| `wind_speed_10m` | Wind speed at 10m height (km/h) |
| `weather_code` | WMO weather interpretation code |

**Default location:** New Delhi, India (28.6139°N, 77.2090°E) — Connaught Place area.
This is a documented demonstration location. The user's precise GPS location is not collected.

**Caching:** Responses are cached for 5 minutes (configurable via `WEATHER_CACHE_SECONDS`).

**Fallback:** If Open-Meteo is unavailable, a simulated weather payload is returned (clearly labelled `source: "simulated_fallback"`, `is_simulated: true`).

**License:** Open-Meteo data is provided under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license.

**Important limitations:**
- Air temperature at 2m does NOT directly measure occupational heat strain (WBGT, physiological heat load)
- Weather data is contextual environmental information only
- HeatGuard does not claim to calculate a validated Wet Bulb Globe Temperature (WBGT)

---

## 3. Synthetic Demo Data (Internal)

**What it is:** Deterministic, procedurally generated worker profiles and simulated readings created entirely within this codebase.

**Source:** `backend/app/seed/demo.py`

**Details:**
- 12 fictional worker profiles with invented names (marked "(Demo)")
- Workers cover all 4 target categories: construction, delivery, street vendor, traffic police
- 7 demo scenarios: normal, elevated, supervisor_review, stale, disconnected, insufficient_data, no-baseline
- All readings generated with `random.Random(seed=42)` for reproducibility
- Workers carry `is_synthetic: True` and `source: "synthetic"`

**Provenance:** Entirely generated; not derived from any real person's data.

**No real personal health records are included in this repository.**

---

## 4. Synthea (Not Integrated)

**Status:** NOT integrated in this version.

Synthea is an open-source synthetic patient generator. It was considered for generating realistic health context records but was not included because:
1. The three-day deadline prioritized end-to-end functionality over synthetic EHR enrichment
2. Importing and validating Synthea output requires additional data pipeline work
3. The core functionality (wearable + weather + rule-based assessment) does not require Synthea

**If integrated in future:**
- Source: https://github.com/synthetichealth/synthea
- License: Apache 2.0
- Any Synthea data must be clearly documented as synthetic and not derived from real patients
- Provenance, sample size, features, and limitations must be documented

---

## Summary Table

| Source | Type | Is Real Data? | Label in App |
|--------|------|---------------|--------------|
| Android Health Connect | Wearable biometrics | Yes (user's own) | LIVE |
| Open-Meteo | Weather | Yes (public) | Source timestamp shown |
| Demo seed (`seed/demo.py`) | Synthetic | No | SYNTHETIC / DEMO |
| Simulated weather fallback | Simulated | No | SIMULATED |
