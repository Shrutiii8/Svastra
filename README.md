# HeatGuard Twin 🛡️🌡️

**Wearable-powered heat-exposure monitoring for outdoor workers.**

> ⚕️ **Disclaimer:** This is a hackathon proof of concept, not a medical device. All assessments are non-diagnostic, illustrative, and must not replace professional medical or occupational-health advice. Assessment thresholds are configurable and not medically validated.

---

## Problem Statement

Construction workers, delivery riders, street vendors, and traffic police in India work outdoors for extended periods and can experience significant heat exposure. Weather measurements alone cannot tell us how an individual worker is responding physiologically. HeatGuard Twin combines wearable biometrics, environmental conditions, individual baselines, and a rule-based assessment engine to help identify unusual physiological patterns and support timely preventive action.

---

## Features

- 📱 **React Native / Expo mobile app** — onboarding, dashboard, worker list, alerts, individual worker "digital twin"
- ❤️ **Android Health Connect integration** — reads heart rate, steps, distance, SpO₂ from Titan watch (via Titan Smart app) and other wearables
- 🌡️ **Open-Meteo weather integration** — real-time temperature, humidity, wind speed with simulated fallback
- 🧪 **12 synthetic demo workers** — 4 categories, 7 realistic scenarios, all clearly labelled
- 🤖 **Rule-based assessment engine** — transparent, explainable, non-diagnostic monitoring
- 📊 **FastAPI backend** — RESTful API with async PostgreSQL persistence
- 🔒 **Explicit user consent** before any health data is collected or transmitted
- 🔄 **Demo mode** — works offline with no watch or network

---

## Architecture

```
Titan Watch → Titan Smart App → Android Health Connect
                                        ↓
                              HeatGuard Mobile App (Expo)
                                        ↓ HTTPS
                              FastAPI Backend (Python)
                                        ↓
                              PostgreSQL Database
                              Open-Meteo Weather API (cached)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full Mermaid diagram.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo SDK 57, TypeScript (strict), Expo Router |
| Wearable | react-native-health-connect v3, Android Health Connect |
| Charts | react-native-chart-kit, react-native-svg |
| State | Zustand, TanStack Query |
| Backend | Python 3.10, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.x async |
| Database | PostgreSQL + psycopg 3 |
| Migrations | Alembic |
| HTTP client | Axios (mobile), HTTPX (backend) |
| Weather | Open-Meteo (free, no API key) |
| Tests | pytest-asyncio (backend) |
| Deployment | Render (backend), managed PostgreSQL |

---

## Repository Structure

```
heatguard-twin/
├── mobile/                         # React Native / Expo app
│   ├── app/
│   │   ├── _layout.tsx             # Root stack navigator
│   │   ├── index.tsx               # Splash / consent check
│   │   ├── onboarding.tsx          # Data consent screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx         # Tab bar
│   │   │   ├── index.tsx           # Dashboard
│   │   │   ├── workers.tsx         # Worker list
│   │   │   ├── alerts.tsx          # Alerts
│   │   │   └── profile.tsx         # Settings / Health Connect
│   │   └── worker/[id].tsx         # Individual worker twin
│   ├── src/
│   │   ├── components/             # WorkerCard, StatusBadge, WeatherWidget
│   │   ├── services/api.ts         # Axios backend client
│   │   ├── services/healthConnect.ts # Health Connect integration
│   │   ├── constants/theme.ts      # Design system
│   │   └── types/index.ts          # TypeScript types
│   ├── app.json                    # Expo config with HC permissions
│   ├── eas.json                    # EAS Build config
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app
│   │   ├── config.py               # Pydantic settings
│   │   ├── database.py             # Async SQLAlchemy engine
│   │   ├── models/__init__.py      # ORM models
│   │   ├── schemas/__init__.py     # Pydantic schemas
│   │   ├── routers/                # workers, readings, assessments, weather, demo
│   │   ├── services/               # assessment engine, weather service
│   │   └── seed/demo.py            # 12 synthetic demo workers
│   ├── alembic/                    # Database migrations
│   ├── tests/test_api.py           # 18 pytest-asyncio tests (all passing)
│   ├── requirements.txt
│   ├── alembic.ini
│   └── Dockerfile
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   ├── PRIVACY.md
│   └── BUILD_STATUS.md
├── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Node.js** ≥ 18 (tested: v22.23.2)
- **npm** ≥ 9 (tested: 10.9.8)
- **Python** 3.10+ (tested: 3.10.12)
- **PostgreSQL** 14+
- **Java** 11+ (for Android build tools)
- **Android Studio** with SDK 34 (for development build)
- Optional: **EAS CLI** (`npm install -g eas-cli`) for cloud builds

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd heatguard-twin
```

### 2. Set up environment variables

```bash
cp .env.example backend/.env
# Edit backend/.env with your PostgreSQL credentials
```

### 3. Start the backend

```bash
cd backend

# Create a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server (tables auto-created on startup, demo data auto-seeded)
uvicorn app.main:app --reload --port 8000
```

Backend will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 4. Set up the mobile app

```bash
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npm start

# OR start with Android target directly
npm run android
```

---

## PostgreSQL Configuration

### Create user and database

```sql
-- Run as postgres superuser
CREATE USER heatguard WITH PASSWORD 'changeme';
CREATE DATABASE heatguard OWNER heatguard;
GRANT ALL PRIVILEGES ON DATABASE heatguard TO heatguard;
```

### Database migrations (optional — tables auto-create on startup)

```bash
cd backend
PATH="$HOME/.local/bin:$PATH" alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"
```

---

## Android Health Connect Setup

### Requirements
- Android 9+ with Health Connect APK, or Android 14+ (Health Connect built-in)
- Expo **development build** (not Expo Go) — native modules required

### Install Health Connect APK (Android 9–13)

Download from: https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata

### Build the development client

```bash
cd mobile

# Option A: Local build (requires Android Studio + SDK)
npm run dev-build   # runs: expo run:android

# Option B: EAS cloud build
npx eas-cli build --profile development --platform android
# Install the resulting .apk on your device
```

### Required Android Manifest permissions

These are configured in `app.json` and applied automatically during build:
```
android.permission.health.READ_HEART_RATE
android.permission.health.READ_STEPS
android.permission.health.READ_DISTANCE
android.permission.health.READ_OXYGEN_SATURATION
```

### Titan Smartwatch setup

1. Install **Titan Smart** app on your Android phone
2. Pair and sync your Titan watch
3. Open Titan Smart → Settings → Health Connect → Enable sync
4. Open HeatGuard Twin → Profile → Request Permissions
5. Grant health permissions in the Android Health Connect dialog
6. Navigate to a worker profile → Readings tab → Sync from Health Connect

---

## Environment Variables

Copy `.env.example` to `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg://heatguard:changeme@localhost:5432/heatguard` |
| `SECRET_KEY` | App secret (change in production) | `dev-secret-key-...` |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `BACKEND_CORS_ORIGINS` | JSON array of allowed origins (pydantic-settings v2 requires JSON) | `["http://localhost:8081"]` |
| `WEATHER_DEFAULT_LATITUDE` | Demo weather latitude | `28.6139` (New Delhi) |
| `WEATHER_DEFAULT_LONGITUDE` | Demo weather longitude | `77.2090` |
| `WEATHER_CACHE_SECONDS` | Weather cache TTL | `300` |
| `DEMO_MODE` | Auto-seed demo data on startup | `true` |

**Mobile:** Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:
```
# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000

# Physical device (replace with your machine's LAN IP)
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/workers` | List workers (filterable) |
| GET | `/api/v1/workers/{id}` | Get worker |
| POST | `/api/v1/workers` | Create worker |
| GET | `/api/v1/readings/{worker_id}` | Worker reading history |
| POST | `/api/v1/readings` | Submit single reading |
| POST | `/api/v1/readings/batch` | Submit batch (idempotent) |
| GET | `/api/v1/assessments/workers/{id}` | Fresh assessment |
| GET | `/api/v1/assessments` | Recent assessments |
| GET | `/api/v1/weather/current` | Current weather |
| GET | `/api/v1/weather/history` | Stored weather history |
| GET | `/api/v1/demo/status` | Demo data summary |
| POST | `/api/v1/demo/reset` | Reset + re-seed demo data |

Full OpenAPI docs available at `/docs` when the server is running.

---

## Demo Mode

Demo mode is active by default (`DEMO_MODE=true`). On first startup, 12 fictional workers are seeded with synthetic readings covering 7 scenarios:

| Scenario | What it shows |
|----------|--------------|
| `normal` | No unusual pattern detected |
| `elevated` | HR elevated ~25 bpm above baseline → Monitor |
| `supervisor_review` | HR elevated ~45 bpm above baseline → Supervisor Review |
| `stale` | Last reading 3+ hours ago → Insufficient Data |
| `disconnected` | No readings at all |
| `insufficient_data` | Only 2 readings, no baseline |
| No baseline | Readings available but no baseline established |

All synthetic workers carry `is_synthetic: true`. To reset:
```bash
curl -X POST http://localhost:8000/api/v1/demo/reset
```
Or use the "Reset Demo Data" button in the app's Profile tab.

---

## Testing

### Backend tests (18 tests, all passing)

```bash
cd backend
PATH="$HOME/.local/bin:$PATH" python3 -m pytest tests/ -v
```

Test coverage includes:
- Health endpoint, root
- Worker CRUD, duplicates, 404
- Reading submission, invalid range rejection
- Duplicate deduplication (single + batch)
- Reading history retrieval
- Assessment: insufficient data, elevated HR
- Demo status endpoint
- Weather current (uses simulated fallback in tests)
- Synthetic data provenance (is_synthetic flag)
- Worker category filtering

### TypeScript type check (mobile)

```bash
cd mobile
npm run type-check
```

---

## Deployment

### Backend on Render

1. Push to GitHub
2. Create a new **Web Service** on Render
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add environment variables from `.env.example` in Render's dashboard
4. Create a **PostgreSQL** database on Neon/Supabase/Render and set `DATABASE_URL`

### Mobile distribution

```bash
# Development APK (install directly)
npx eas-cli build --profile development --platform android

# Preview APK (shareable)
npx eas-cli build --profile preview --platform android
```

---

## Data Sources & Licenses

| Source | License | Notes |
|--------|---------|-------|
| Android Health Connect | Android SDK terms | User data, permission-gated |
| Open-Meteo | CC BY 4.0 | Free tier, no API key |
| Demo seed data | MIT (this project) | Entirely synthetic |

See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for details.

---

## Known Limitations & Future Work

### Current Limitations

1. **No API authentication** — all endpoints are open in this POC. Add JWT/OAuth before multi-user production use.
2. **Health Connect requires dev build** — Expo Go does not support native Health Connect modules.
3. **Titan readings may be intermittent** — the system correctly handles gaps; missing periods are not interpolated.
4. **No ML model** — the assessment is rule-based with illustrative thresholds. A validated ML model requires labelled data, proper evaluation, and regulatory review.
5. **Demo weather location fixed** — New Delhi. Configurable via environment variables.
6. **No background sync** — sync is foreground-only in this version.
7. **ANDROID_HOME not configured on dev machine** — native build requires Android Studio setup.

### Future Work

- [ ] JWT authentication for multi-user deployment
- [ ] Background sync on Android using WorkManager / Expo Background Fetch
- [ ] WBGT estimation with documented formula and limitations
- [ ] Supervisor web dashboard (separate from mobile)
- [ ] Push notifications for active alerts
- [ ] ML model (if suitable labelled occupational heat dataset found)
- [ ] Data retention policies and automatic expiry
- [ ] DPIA and compliance review for production use

---

## Privacy

See [`docs/PRIVACY.md`](docs/PRIVACY.md) for the full privacy approach.

Key points:
- Explicit consent required before data collection
- Health Connect permissions required before any reading
- No GPS location collected (fixed demo location for weather)
- All demo data is synthetic and clearly labelled
- Add API authentication before exposing real health data

---

## Contributing

This is a hackathon submission. If you fork and extend it:
- Keep synthetic and real data clearly separated
- Do not add fake ML accuracy metrics
- Maintain the non-diagnostic disclaimers
- Review `docs/PRIVACY.md` before collecting any real health data

---

## License

MIT License — see LICENSE file.

> HeatGuard Twin was built during a 3-day hackathon. It is a proof of concept for demonstration purposes only.
