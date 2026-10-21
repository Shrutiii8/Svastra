# Svastra — Build Status

Last updated: 2026-10-14

---

## ✅ Backend (FastAPI)

| Component | Status | Notes |
|-----------|--------|-------|
| Configuration (pydantic-settings) | ✅ Complete | `backend/app/config.py` |
| Database engine (async SQLAlchemy 2.x) | ✅ Complete | SQLite-safe pool config |
| ORM Models | ✅ Complete | 6 models, all relationships |
| Pydantic v2 schemas | ✅ Complete | Input validation, range checks |
| Workers router | ✅ Complete | CRUD + pagination + filtering |
| Readings router | ✅ Complete | Single + batch, deduplication |
| Assessments router | ✅ Complete | Per-worker, list, rule-based |
| Weather router | ✅ Complete | Open-Meteo + 5-min cache + fallback |
| Demo router | ✅ Complete | Status + reset endpoints |
| Assessment engine | ✅ Complete | Rule-based, transparent, non-diagnostic |
| Weather service | ✅ Complete | Open-Meteo, simulated fallback |
| Demo seed | ✅ Complete | 12 workers, 370 readings, 7 scenarios |
| FastAPI main app | ✅ Complete | Lifespan, CORS, OpenAPI, disclaimers |
| Alembic migrations | ✅ Complete | `alembic/env.py`, `alembic.ini` |
| Dockerfile | ✅ Complete | Production-ready |
| Docker Compose | ✅ Complete | PostgreSQL + backend |
| **Tests** | ✅ **18/18 passing** | pytest-asyncio, SQLite in-memory |
| Startup verified | ✅ Verified | SQLite + seed: 12 workers, 370 readings |

---

## ✅ Mobile App (Expo SDK 57 / React Native 0.86)

| Component | Status | Notes |
|-----------|--------|-------|
| `package.json` | ✅ Complete | 603 packages installed |
| `app.json` | ✅ Complete | HC permissions, SDK targets |
| `tsconfig.json` | ✅ Complete | Strict, ignoreDeprecations |
| `babel.config.js` | ✅ Complete | expo preset |
| `metro.config.js` | ✅ Complete | Default Expo config |
| `eas.json` | ✅ Complete | dev + preview + production profiles |
| TypeScript types (`src/types/index.ts`) | ✅ Complete | All backend types mirrored |
| Design system (`src/constants/theme.ts`) | ✅ Complete | Colors, spacing, typography |
| API service (`src/services/api.ts`) | ✅ Complete | All endpoints, error handling |
| Health Connect service | ✅ Complete | Lazy-load, availability, permissions, sync |
| `StatusBadge` component | ✅ Complete | Color-coded assessment status |
| `WorkerCard` component | ✅ Complete | Category bar, HR, stale detection |
| `WeatherWidget` component | ✅ Complete | Simulated data warning |
| Splash/index screen | ✅ Complete | Consent check, redirect |
| Onboarding/consent screen | ✅ Complete | Detailed, checkbox, disclaimer |
| Root `_layout.tsx` | ✅ Complete | Stack navigator |
| Tabs `_layout.tsx` | ✅ Complete | 4 tabs with Ionicons |
| Dashboard tab | ✅ Complete | Stats, weather, assessments, backend status |
| Workers tab | ✅ Complete | Search, filter, enriched cards |
| Alerts tab | ✅ Complete | Active/all filter, non-diagnostic notice |
| Profile/Settings tab | ✅ Complete | HC status, demo controls, privacy |
| Worker Digital Twin screen | ✅ Complete | 3 tabs, HR trend, sync, observations |
| App icons / assets | ✅ Complete | Generated with AI, all 4 sizes |
| **TypeScript check** | ✅ **0 errors** | `npx tsc --noEmit` |

---

## 📚 Documentation

| File | Status |
|------|--------|
| `README.md` | ✅ Complete |
| `docs/ARCHITECTURE.md` | ✅ Complete (with Mermaid diagram) |
| `docs/DATA_SOURCES.md` | ✅ Complete |
| `docs/PRIVACY.md` | ✅ Complete |
| `docs/BUILD_STATUS.md` | ✅ This file |
| `.env.example` | ✅ Complete |
| `mobile/.env.example` | ✅ Complete |

---

## ⚠️ Manual Setup Required Before Running

### 1. PostgreSQL (for `uvicorn` mode)

```bash
# Create user and DB
psql -U postgres -c "CREATE USER heatguard WITH PASSWORD 'changeme';"
psql -U postgres -c "CREATE DATABASE heatguard OWNER heatguard;"
```

OR use Docker Compose (no manual Postgres needed):

```bash
docker-compose up -d
```

### 2. Backend `.env` file

```bash
cp .env.example backend/.env
# Edit DATABASE_URL if your Postgres credentials differ from defaults
```

### 3. Mobile `.env` file

```bash
cp mobile/.env.example mobile/.env
# If using physical device: set EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP
```

### 4. Android Health Connect (for live wearable data)

- Requires Expo **development build** (not Expo Go)
- Requires Android 9+ with Health Connect installed
- Titan Smart app must be installed and synced
- Grant permissions in Profile tab → "Request Permissions"

### 5. Building the Android dev client

```bash
cd mobile

# Local build (requires Android Studio + SDK 34)
npm run dev-build   # expo run:android

# Cloud build (requires EAS account, free tier available)
npx eas-cli build --profile development --platform android
```

---

## 🚀 Quick Start (Demo Mode)

```bash
# 1. Start backend with Docker Compose
docker-compose up -d

# 2. Start mobile dev server
cd mobile && npm start

# 3. Open Expo Go / scan QR code
# NOTE: Health Connect will show "not available" in Expo Go — expected
# All 12 demo workers and scenarios work without a watch
```

---

## 🔮 Known Gaps (Post-Hackathon)

| Gap | Priority | Notes |
|-----|----------|-------|
| API authentication (JWT) | HIGH | Required before multi-user production |
| Background sync | MEDIUM | Foreground-only in this version |
| Data retention policies | MEDIUM | No automatic expiry implemented |
| Push notifications | MEDIUM | For active alerts |
| WBGT estimation | LOW | Air temp context only, not heat strain |
| Production CORS restriction | HIGH | Currently allows multiple origins |
| Formal DPIA | HIGH | Required before real health data use |
| Penetration testing | HIGH | Before production deployment |
