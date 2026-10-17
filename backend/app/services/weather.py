"""
HeatGuard Twin — Weather Service
Fetches current weather from Open-Meteo (no API key required for free tier).
Documentation: https://open-meteo.com/en/docs
Implements caching, timeouts, error handling, and simulated fallback.

IMPORTANT: Air temperature alone is not a validated measure of occupational heat
strain. Weather data is contextual information only.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Simple in-memory cache: (lat, lon) -> (fetched_at, payload)
_weather_cache: dict[tuple[float, float], tuple[datetime, dict[str, Any]]] = {}

# Simulated fallback for offline demo (represents a hot summer day in Delhi)
_SIMULATED_WEATHER = {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "temperature_c": 38.5,
    "humidity_pct": 45.0,
    "wind_speed_kmh": 12.0,
    "weather_code": 0,  # Clear sky
    "source": "simulated_fallback",
    "is_simulated": True,
    "observed_at": None,  # Filled at call time
    "fetched_at": None,
}

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_SECONDS = 8.0


async def fetch_current_weather(
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    """
    Fetch current weather conditions from Open-Meteo.

    Returns a dict compatible with WeatherResponse schema.
    Falls back to a clearly labelled simulated payload on failure.
    Weather timestamps are preserved from the API response.
    """
    lat = latitude or settings.weather_default_latitude
    lon = longitude or settings.weather_default_longitude
    cache_key = (round(lat, 4), round(lon, 4))
    now = datetime.now(timezone.utc)

    # Check cache
    if cache_key in _weather_cache:
        cached_at, cached_payload = _weather_cache[cache_key]
        age_seconds = (now - cached_at).total_seconds()
        if age_seconds < settings.weather_cache_seconds:
            logger.debug("Weather cache hit (age=%.0fs)", age_seconds)
            return cached_payload

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "weather_code",
        ],
        "timezone": "UTC",
        "forecast_days": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()

        current = data.get("current", {})
        # Open-Meteo returns time as ISO string like "2026-10-13T12:00"
        observed_str = current.get("time", now.isoformat())
        try:
            observed_at = datetime.fromisoformat(observed_str).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            observed_at = now

        payload: dict[str, Any] = {
            "latitude": lat,
            "longitude": lon,
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "weather_code": current.get("weather_code"),
            "source": "open_meteo",
            "is_simulated": False,
            "observed_at": observed_at,
            "fetched_at": now,
        }
        _weather_cache[cache_key] = (now, payload)
        return payload

    except (httpx.TimeoutException, httpx.HTTPError, Exception) as exc:
        logger.warning("Weather fetch failed (%s). Using simulated fallback.", exc)
        fallback = dict(_SIMULATED_WEATHER)
        fallback["observed_at"] = now
        fallback["fetched_at"] = now
        fallback["latitude"] = lat
        fallback["longitude"] = lon
        return fallback
