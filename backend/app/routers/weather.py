"""Weather router"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import WeatherReading
from app.schemas import WeatherResponse
from app.services.weather import fetch_current_weather

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/weather", tags=["weather"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/current", response_model=WeatherResponse)
async def get_current_weather(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
) -> WeatherResponse:
    """
    Fetch current weather from Open-Meteo (or simulated fallback).
    Default location: New Delhi, India (Connaught Place area).
    Air temperature is contextual information; it does not measure individual heat strain.
    """
    data = await fetch_current_weather(lat, lon)
    return WeatherResponse(**data)


@router.get("/history", response_model=list[WeatherResponse])
async def get_weather_history(
    db: DbDep,
    limit: int = Query(24, ge=1, le=168),
) -> list[WeatherResponse]:
    """Return recently stored weather readings."""
    stmt = (
        select(WeatherReading)
        .order_by(WeatherReading.observed_at.desc())
        .limit(limit)
    )
    readings = (await db.execute(stmt)).scalars().all()
    return [WeatherResponse.model_validate(r) for r in readings]
