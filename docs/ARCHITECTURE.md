# Svastra — Architecture

## System Overview

HeatGuard Twin is a wearable-powered heat-exposure monitoring proof of concept for outdoor workers. It combines wearable biometrics (via Android Health Connect), environmental weather data (via Open-Meteo), personal baseline modeling, and a rule-based assessment engine to support preventive safety actions.

> **Disclaimer:** This is a hackathon proof of concept, not a medical device. All assessments are non-diagnostic and illustrative. Thresholds are configurable and not medically validated.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Physical Layer"
        TITAN[Titan Smartwatch]
        ANDROID[Android Phone]
        HC[Health Connect]
        TITAN -->|Titan Smart app| HC
    end

    subgraph "Mobile App (Expo / React Native)"
        SPLASH[Splash / Consent]
        DASHBOARD[Dashboard Tab]
        WORKERS[Workers Tab]
        ALERTS[Alerts Tab]
        PROFILE[Profile / Settings Tab]
        TWIN[Worker Digital Twin Screen]
        HC_SVC[Health Connect Service]
        API_SVC[API Service]
        
        HC -->|readRecords| HC_SVC
        HC_SVC -->|ReadingCreate[]| API_SVC
        SPLASH --> DASHBOARD
        DASHBOARD --> TWIN
        WORKERS --> TWIN
    end

    subgraph "Backend (FastAPI + PostgreSQL)"
        FASTAPI[FastAPI App]
        WORKERS_R[Workers Router]
        READINGS_R[Readings Router]
        ASSESS_R[Assessments Router]
        WEATHER_R[Weather Router]
        DEMO_R[Demo Router]
        ASSESS_ENGINE[Assessment Engine\nrule-based]
        WEATHER_SVC[Weather Service\nOpen-Meteo + cache]
        SEED[Demo Seed\n12 synthetic workers]
        DB[(PostgreSQL)]
    end

    subgraph "External Services"
        OPENMETEO[Open-Meteo API\nWeather data]
        RENDER[Render / Cloud Host]
        NEON[Managed PostgreSQL\ne.g. Neon / Supabase]
    end

    API_SVC -->|HTTPS JSON| FASTAPI
    FASTAPI --> WORKERS_R
    FASTAPI --> READINGS_R
    FASTAPI --> ASSESS_R
    FASTAPI --> WEATHER_R
    FASTAPI --> DEMO_R
    ASSESS_R --> ASSESS_ENGINE
    WEATHER_R --> WEATHER_SVC
    WEATHER_SVC -->|GET forecast| OPENMETEO
    ASSESS_ENGINE --> DB
    READINGS_R --> DB
    WORKERS_R --> DB
    SEED --> DB
    FASTAPI -.->|deploy| RENDER
    DB -.->|managed| NEON
```

## Data Flow

### Wearable Sync Flow
```
Titan Watch → Titan Smart App → Android Health Connect → HeatGuard App
→ Health Connect Service (readRecords) → deduplicate → POST /api/v1/readings/batch
→ FastAPI → PostgreSQL
```

### Assessment Flow
```
GET /api/v1/assessments/workers/{id}
→ Load recent HR readings (last 2h) from DB
→ Load baseline readings (last 7 days) from DB
→ Compute personal baseline (mean, if ≥5 readings)
→ Fetch current weather from Open-Meteo (cached 5min)
→ Apply rule-based thresholds (documented, illustrative)
→ Generate observations + recommended actions
→ Persist assessment → Return AssessmentResponse
```

## Components

### Mobile (Expo SDK 57 / React Native 0.86)

| File | Purpose |
|------|---------|
| `app/index.tsx` | Splash screen, consent check |
| `app/onboarding.tsx` | Data collection consent |
| `app/(tabs)/index.tsx` | Dashboard overview |
| `app/(tabs)/workers.tsx` | Searchable worker list |
| `app/(tabs)/alerts.tsx` | Active alerts & assessments |
| `app/(tabs)/profile.tsx` | HC status, demo controls |
| `app/worker/[id].tsx` | Individual worker twin |
| `src/services/api.ts` | Axios backend client |
| `src/services/healthConnect.ts` | Health Connect integration |
| `src/components/WorkerCard.tsx` | Reusable worker card |
| `src/components/StatusBadge.tsx` | Assessment status badge |
| `src/components/WeatherWidget.tsx` | Environmental widget |
| `src/types/index.ts` | TypeScript types |
| `src/constants/theme.ts` | Design system tokens |

### Backend (FastAPI + SQLAlchemy 2.x)

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, lifespan, CORS |
| `app/config.py` | Pydantic-settings config |
| `app/database.py` | Async SQLAlchemy engine |
| `app/models/__init__.py` | ORM models |
| `app/schemas/__init__.py` | Pydantic v2 schemas |
| `app/routers/workers.py` | Workers CRUD |
| `app/routers/readings.py` | Readings ingestion |
| `app/routers/assessments.py` | Assessment triggers |
| `app/routers/weather.py` | Weather proxy |
| `app/routers/demo.py` | Demo status/reset |
| `app/services/assessment.py` | Rule-based engine |
| `app/services/weather.py` | Open-Meteo client |
| `app/seed/demo.py` | Demo data generator |

## Assessment Engine Logic

The engine is **rule-based and transparent** — no ML model is used.

```
Input: recent HR readings, baseline HR, weather context, data quality

Rules (illustrative thresholds, not medically validated):
├─ No readings / stale → "insufficient_data"
├─ Baseline available:
│   ├─ HR > baseline + 40 bpm → "supervisor_review"
│   ├─ HR > baseline + 20 bpm → "monitor"
│   └─ otherwise → "no_unusual_pattern"
└─ No baseline (absolute fallback):
    ├─ HR > 130 → "monitor"
    ├─ HR > 100 → "monitor"
    └─ otherwise → "no_unusual_pattern"

Environmental modifier:
└─ temp ≥ 40°C → escalate to "monitor" if currently "no_unusual_pattern"
```

All thresholds are configurable via `app/services/assessment.py` constants.

## Demo Scenarios

| Worker ID | Scenario | Expected Status |
|-----------|----------|----------------|
| WORKER-C001 | Elevated HR | monitor |
| WORKER-C002 | Normal | no_unusual_pattern |
| WORKER-C003 | Supervisor review | supervisor_review |
| WORKER-D003 | Stale readings | insufficient_data |
| WORKER-P003 | Disconnected | insufficient_data |
| WORKER-V003 | No baseline | insufficient_data |

## Security Considerations

- Health Connect permissions requested before data access
- Explicit user consent before data transmission
- No credentials committed to Git
- CORS configured; restrict in production
- Add API authentication before exposing multi-user health data in production
- See `docs/PRIVACY.md` for full privacy approach
