"""
HeatGuard Twin — Application Configuration
Uses pydantic-settings to load from environment variables / .env
"""
from functools import lru_cache
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Database ---
    database_url: str = (
        "postgresql+psycopg://heatguard:changeme@localhost:5432/heatguard"
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_url(cls, v: Any) -> str:
        """Ensure PostgreSQL connection strings use the async psycopg driver."""
        if isinstance(v, str):
            v = v.strip().strip("'\"")
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+psycopg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                v = v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    # --- FastAPI ---
    secret_key: str = "dev-secret-key-change-in-production"
    environment: str = "development"
    backend_cors_origins: list[str] = [
        "http://localhost:8081",
        "http://10.0.2.2:8081",
        "http://127.0.0.1:8081",
    ]

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: Any) -> list[str]:
        """Accept both JSON arrays and comma-separated strings."""
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    # --- Open-Meteo / Weather ---
    # Default: New Delhi, India (Connaught Place area — clearly documented demo location)
    weather_default_latitude: float = 28.6139
    weather_default_longitude: float = 77.2090
    weather_cache_seconds: int = 300

    # --- Demo ---
    demo_mode: bool = True
    demo_seed: int = 42

    # --- ML Inference Service ---
    # Set to the URL of the running ml/serve/api.py service.
    # Leave empty / unset to disable ML assessments and use rule-based only.
    ml_service_url: str = "http://localhost:8001"
    ml_enabled: bool = True
    # Timeout in seconds for calls to the ML microservice
    ml_timeout_seconds: float = 5.0
    # Permanent non-expiring service token for ML microservice & client auth
    ml_api_token: str = "heatguard-permanent-token-2026"
    api_auth_token: str = "heatguard-permanent-token-2026"

    # --- Email / Brevo SMTP ---
    mail_from: str = "Svastra <iambeinganupam@gmail.com>"
    mail_host: str = "smtp-relay.brevo.com"
    mail_port: int = 2525
    mail_secure: bool = False
    mail_user: str = "b26160001@smtp-brevo.com"
    mail_pass: str = ""

    @field_validator("mail_from", mode="before")
    @classmethod
    def _strip_quotes_from_mail_from(cls, v: Any) -> str:
        if isinstance(v, str):
            return v.strip().strip("'\"")
        return v

    @field_validator("mail_secure", mode="before")
    @classmethod
    def _parse_bool_mail_secure(cls, v: Any) -> bool:
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes")
        return bool(v)

    # --- OTP & Authentication ---
    otp_expire_minutes: int = 10
    otp_cooldown_seconds: int = 60
    otp_max_attempts: int = 5
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- App ---
    app_name: str = "HeatGuard Twin"
    app_version: str = "0.1.0"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
