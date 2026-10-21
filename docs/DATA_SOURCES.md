# Svastra — Data Sources

## Overview

This document describes the data sources used or intended for use by Svastra, their provenance, licensing, and integration into the hackathon proof of concept.

Some implementation details below reflect the project's documented design and should be verified against the current code before submission.

---

## 1. Android Health Connect

**What it is:** Android's unified health and fitness data repository. Apps and wearable companion apps can write health records, such as heart rate and steps, to Health Connect. Other apps can read those records with the user's permission.

**How Svastra uses it:**
- Reads `HeartRate`, `Steps`, `Distance`, and `OxygenSaturation` records where available and supported.
- Requires the relevant Health Connect permissions before accessing the corresponding records.
- Reads the last 24 hours of records per sync, as documented for the project. Verify that this time window is enforced by the current implementation.
- Records obtained from Health Connect should be labelled `source: "health_connect"` and `is_synthetic: false`.

**Titan Smartwatch integration:**
- Svastra does not connect directly to the Titan smartwatch. It relies on compatible software writing supported health records to Android Health Connect.
- Availability depends on the Titan companion app, device, permissions, Android version, and supported data types. Confirm that the target phone actually receives the required records before presenting them as live readings.
- Readings may be intermittent. Missing data is treated as unavailable rather than as a measured value.

**Permissions required:**

The following permissions are documented for the intended data types. Verify that the Android manifest and runtime permission requests match the records the application actually reads.

```text
android.permission.health.READ_HEART_RATE
android.permission.health.READ_STEPS
android.permission.health.READ_DISTANCE
android.permission.health.READ_OXYGEN_SATURATION
```

**License and documentation:** Health Connect is an Android platform API. Refer to the [Android Health Connect documentation](https://developer.android.com/health-and-fitness/guides/health-connect) for API usage, permissions, and platform requirements.

**Important limitations:**
- Wearable heart-rate and oxygen-saturation readings are indicative and may vary in accuracy by device and measurement conditions.
- These readings are not necessarily clinically precise.
- Svastra is a heat-exposure monitoring proof of concept, not a medical diagnostic system.

---

## 2. Open-Meteo Weather API

**Documentation:** [Open-Meteo API documentation](https://open-meteo.com/en/docs)

**What it is:** A weather API that provides weather data and forecasts. API availability, usage limits, and licensing conditions depend on the service and applicable terms.

**Variables used:**

| Variable | Description |
|----------|-------------|
| `temperature_2m` | Air temperature at 2 metres (°C) |
| `relative_humidity_2m` | Relative humidity (%) |
| `wind_speed_10m` | Wind speed at 10 metres; confirm the configured unit |
| `weather_code` | Weather interpretation code |

**Default demonstration location:** New Delhi, India (28.6139°N, 77.2090°E), documented as the Connaught Place area.

This is a configured demonstration location and should not be interpreted as the worker's actual location. The project should claim that precise GPS is not collected only after verifying that the mobile app and backend do not request or transmit GPS coordinates.

**Caching:** The project documentation specifies a five-minute cache controlled by `WEATHER_CACHE_SECONDS`. Confirm the actual implementation and configured value before relying on this behavior.

**Fallback:** The documented design returns simulated weather when Open-Meteo is unavailable, labelled:

- `source: "simulated_fallback"`
- `is_simulated: true`

Verify that the fallback exists and that these labels are returned by the current implementation. Simulated weather should be visibly distinguished from live API data in the dashboard and any resulting assessment.

**License and attribution:** Consult the [Open-Meteo terms and licensing information](https://open-meteo.com/en/terms) and confirm the terms applicable to the selected API endpoint and intended use. Do not assume that every service or use case is covered by the same license.

**Important limitations:**
- Air temperature at 2 metres does not directly measure occupational heat strain or physiological heat load.
- Weather variables provide environmental context; they do not constitute a validated Wet Bulb Globe Temperature (WBGT) measurement.
- The configured weather location may not reflect conditions at a worker's actual worksite.
- Weather information alone is insufficient to determine whether a worker is medically safe to continue working.

---

## 3. Synthetic Demo Data (Internal)

**Documented source:** `backend/app/seed/demo.py`

**What it is:** Fictional worker profiles and simulated readings generated within the project for demonstration purposes.

**Documented details:**
- 12 fictional worker profiles with invented names marked "(Demo)".
- Four target categories: construction, delivery, street vendor, and traffic police.
- Seven demo scenarios:
  - `normal`
  - `elevated`
  - `supervisor_review`
  - `stale`
  - `disconnected`
  - `insufficient_data`
  - `no-baseline`
- Deterministic generation using `random.Random(seed=42)`, as documented for the project. Verify that the current seed file retains this implementation.
- Synthetic records should carry `is_synthetic: true` and `source: "synthetic"`.

**Provenance:** These records are documented as generated within the codebase and not derived from real individuals.

Synthetic records must remain clearly labelled as demo data. They should not be presented as real worker measurements or mixed with live readings without preserving their source and synthetic-status labels.

**Repository statement:** The project documentation states that no real personal health records are included in the repository. Verify the repository files, sample data, logs, and committed history before making this claim publicly.

---

## 4. Synthea (Not Integrated)

**Status:** Not integrated in the documented version of Svastra.

Synthea is an open-source synthetic patient generator. It was considered as a potential source of synthetic health-context records but was not included in the documented hackathon implementation.

Reasons for not integrating it:
1. The three-day development deadline prioritized end-to-end functionality.
2. Importing and validating Synthea output would require additional data-pipeline work.
3. The current documented functionality focuses on wearable data, weather context, and rule-based assessment.

**Potential future integration:**
- Source: [Synthea GitHub repository](https://github.com/synthetichealth/synthea)
- License: The project documentation identifies the license as Apache 2.0; verify the repository's current license before integration or redistribution.
- Clearly label all generated records as synthetic.
- Document the generation configuration, sample size, fields used, provenance, and limitations.
- Keep synthetic health-context data distinguishable from real wearable readings.
- Do not imply that generated records represent actual patients or validate the system's clinical performance.

---

## Summary Table

| Source | Type | Real or simulated? | Label / handling |
|--------|------|--------------------|------------------|
| Android Health Connect | Wearable biometrics | Real device readings, when available and permissioned | `LIVE` only for confirmed Health Connect readings |
| Open-Meteo | Weather | External API data | Show source and timestamp where available |
| Internal demo seed | Worker profiles and readings | Synthetic | `SYNTHETIC` / `DEMO`; preserve provenance labels |
| Simulated weather fallback | Weather payload | Simulated | `SIMULATED`; do not present as live weather |
| Synthea | Synthetic patient records | Not integrated | No current data contribution |

---

## Before Submission — Verification Checklist

- [ ] Confirm that the application requests only the Health Connect permissions it needs.
- [ ] Test whether the target Titan companion app writes the required data types to Health Connect on the demo phone.
- [ ] Confirm the actual sync window and source labels in the code.
- [ ] Verify the configured weather location, wind-speed units, cache duration, and fallback behavior.
- [ ] Check Open-Meteo's applicable terms and attribution requirements.
- [ ] Confirm that synthetic worker profiles and readings are clearly labelled.
- [ ] Check that no real personal health data, credentials, or API secrets have been committed.
- [ ] Ensure that the dashboard distinguishes live readings, synthetic demo records, and simulated weather.
- [ ] Verify that the final README, architecture diagram, and presentation use the name **Svastra** consistently.

---

## Scope and Limitations

This document describes the data sources and reported design of a hackathon proof of concept. It is not a clinical validation, security audit, or legal compliance certification.

Svastra's heat-risk assessment should be treated as an experimental, rule-based demonstration unless and until its thresholds and predictions have been independently validated. It must not replace professional medical advice, workplace safety procedures, or emergency response protocols.
