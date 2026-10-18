"""
HeatGuard Twin — FastAPI Application Entry Point
"""
from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# On Windows, psycopg async requires WindowsSelectorEventLoopPolicy
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, get_db, AsyncSessionLocal
from app.models import Base
from app.routers import assessments, auth, demo, ml, readings, weather, workers
from app.schemas import HealthResponse
from app.seed.demo import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables and seed demo data on startup."""
    logger.info("Starting HeatGuard Twin API v%s", settings.app_version)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE risk_assessments ADD COLUMN IF NOT EXISTS ml_prediction_json TEXT;"))
        except Exception as exc:
            logger.debug("ALTER TABLE check skipped: %s", exc)
        logger.info("Database tables created/verified")

    if settings.demo_mode:
        async with AsyncSessionLocal() as db:
            result = await seed_demo_data(db)
            await db.commit()
            logger.info(
                "Demo seed: %d workers, %d readings",
                result["worker_count"],
                result["reading_count"],
            )

    yield

    logger.info("Shutting down HeatGuard Twin API")
    await engine.dispose()


app = FastAPI(
    title="Svastra API",
    description=(
        "Wearable-powered heat-exposure monitoring for outdoor workers. "
        "Hackathon proof of concept — not a medical device. "
        "All assessments are illustrative and non-diagnostic."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
_cors_origins = [str(o).strip().rstrip("/") for o in settings.backend_cors_origins if str(o).strip()]
_allow_all = "*" in _cors_origins or not _cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors_origins,
    allow_credentials=False if _allow_all else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(workers.router, prefix="/api/v1")
app.include_router(readings.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(demo.router, prefix="/api/v1")
app.include_router(ml.router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Basic health check endpoint."""
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(__import__("sqlalchemy", fromlist=["text"]).text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:
        logger.error("DB health check failed: %s", exc)
        db_status = "error"

    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
        database=db_status,
    )


@app.get("/", tags=["root"])
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
        "disclaimer": (
            "This is a hackathon proof of concept, not a medical device. "
            "All assessments are non-diagnostic and illustrative only."
        ),
    }
