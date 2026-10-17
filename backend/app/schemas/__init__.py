"""
HeatGuard Twin — Pydantic Schemas (request/response validation)
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models import (
    AssessmentStatus,
    DataSource,
    MetricType,
    WorkerCategory,
)

# ============================================================
# Shared helpers
# ============================================================

VALID_UNITS: dict[MetricType, list[str]] = {
    MetricType.heart_rate: ["bpm"],
    MetricType.steps: ["steps", "count"],
    MetricType.distance: ["m", "km", "meters"],
    MetricType.oxygen_saturation: ["%", "percent"],
    MetricType.skin_temperature: ["°C", "C", "celsius"],
}

VALID_RANGES: dict[MetricType, tuple[float, float]] = {
    MetricType.heart_rate: (20, 250),
    MetricType.steps: (0, 100_000),
    MetricType.distance: (0, 200_000),
    MetricType.oxygen_saturation: (50, 100),
    MetricType.skin_temperature: (25, 45),
}


# ============================================================
# Worker schemas
# ============================================================


class WorkerBase(BaseModel):
    display_name: str = Field(..., max_length=100)
    category: WorkerCategory
    age_years: int | None = Field(None, ge=16, le=80)
    baseline_hr_bpm: float | None = Field(None, ge=30, le=120)
    is_synthetic: bool = True
    notes: str | None = None


class WorkerCreate(WorkerBase):
    id: str = Field(..., max_length=50, pattern=r"^[A-Z0-9\-]+$")


class WorkerResponse(WorkerBase):
    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkerListResponse(BaseModel):
    workers: list[WorkerResponse]
    total: int


# ============================================================
# Reading schemas
# ============================================================


class ReadingCreate(BaseModel):
    worker_id: str = Field(..., max_length=50)
    metric_type: MetricType
    value: float
    unit: str = Field(..., max_length=20)
    measured_at: datetime
    source: DataSource = DataSource.health_connect
    is_synthetic: bool = False
    source_record_id: str | None = None

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str, info: Any) -> str:
        return v.strip()

    @model_validator(mode="after")
    def validate_range(self) -> "ReadingCreate":
        lo, hi = VALID_RANGES[self.metric_type]
        if not (lo <= self.value <= hi):
            raise ValueError(
                f"{self.metric_type} value {self.value} is outside valid range "
                f"[{lo}, {hi}]"
            )
        return self


class ReadingBatchCreate(BaseModel):
    readings: list[ReadingCreate] = Field(..., min_length=1, max_length=500)


class ReadingResponse(BaseModel):
    id: str
    worker_id: str
    metric_type: MetricType
    value: float
    unit: str
    measured_at: datetime
    source: DataSource
    is_synthetic: bool
    source_record_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReadingListResponse(BaseModel):
    readings: list[ReadingResponse]
    total: int
    page: int
    page_size: int


# ============================================================
# Weather schemas
# ============================================================


class WeatherResponse(BaseModel):
    latitude: float
    longitude: float
    temperature_c: float | None
    humidity_pct: float | None
    wind_speed_kmh: float | None
    weather_code: int | None
    source: str
    is_simulated: bool
    observed_at: datetime
    fetched_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# ============================================================
# ML schemas
# ============================================================


class MLPrediction(BaseModel):
    risk_level: int = Field(..., description="0=no_unusual_pattern, 1=monitor, 2=supervisor_review")
    risk_label: str = Field(..., description="Human-readable risk label")
    confidence: float = Field(..., description="Model confidence score 0.0 to 1.0")
    probabilities: dict[str, float] = Field(..., description="Per-class probability distribution")
    source: str = Field("ml_service", description="Source of prediction: ml_service, ml_local, or rule_fallback")
    model_name: str = Field("XGBoost Heat Stress Classifier", description="Architecture/algorithm")
    disclaimer: str = Field(
        "Non-diagnostic illustrative model prediction trained on synthetic data. "
        "Not a substitute for clinical or occupational health assessment."
    )


class MLPredictRequest(BaseModel):
    heart_rate_bpm: float = Field(..., ge=20.0, le=250.0)
    baseline_hr_bpm: float = Field(..., ge=30.0, le=130.0)
    temperature_c: float = Field(..., ge=-10.0, le=55.0)
    humidity_pct: float = Field(..., ge=0.0, le=100.0)
    heat_index: float | None = None
    age_years: int = Field(30, ge=14, le=90)
    minutes_since_break: int = Field(30, ge=0, le=480)
    activity_level: int = Field(2, ge=0, le=3)
    reading_age_minutes: float = Field(5.0, ge=0.0, le=1440.0)


class MLHealthResponse(BaseModel):
    status: str
    service_available: bool
    local_model_available: bool
    active_mode: str  # "microservice", "local_pipeline", "rule_fallback"
    model_path: str | None = None
    token_auth_enabled: bool = True
    token_status: str = "permanent_non_expiring"
    trained_at: str | None = None
    test_accuracy: float | None = None
    test_f1_macro: float | None = None
    disclaimer: str


# ============================================================
# Assessment schemas
# ============================================================


class DataQuality(BaseModel):
    freshness: str  # "recent" | "stale" | "unavailable"
    baseline_available: bool
    reading_count: int


class EnvironmentContext(BaseModel):
    temperature_c: float | None
    humidity_pct: float | None
    source: str
    observed_at: datetime | None


class AssessmentResponse(BaseModel):
    worker_id: str
    status: AssessmentStatus
    assessment_type: str = "rule_based_prototype"
    observations: list[str]
    environment: EnvironmentContext | None
    data_quality: DataQuality
    recommended_actions: list[str]
    assessed_at: datetime
    latest_hr: float | None
    baseline_hr: float | None
    ml_prediction: MLPrediction | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(
        cls,
        model: Any,
        observations: list[str],
        actions: list[str],
        env: EnvironmentContext | None,
        dq: DataQuality,
        ml_prediction: MLPrediction | None = None,
    ) -> "AssessmentResponse":
        return cls(
            worker_id=model.worker_id,
            status=model.status,
            assessment_type=model.assessment_type,
            observations=observations,
            environment=env,
            data_quality=dq,
            recommended_actions=actions,
            assessed_at=model.assessed_at,
            latest_hr=model.latest_hr,
            baseline_hr=model.baseline_hr,
            ml_prediction=ml_prediction,
        )


# ============================================================
# Demo schemas
# ============================================================


class DemoStatus(BaseModel):
    demo_mode: bool
    worker_count: int
    reading_count: int
    categories: dict[str, int]
    last_reset: datetime | None


class DemoReset(BaseModel):
    success: bool
    message: str
    worker_count: int


# ============================================================
# Health check schema
# ============================================================


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str


# ============================================================
# Auth & OTP schemas
# ============================================================


class OTPRequest(BaseModel):
    email: str = Field(..., description="User email address to send OTP to")
    mode: str = Field("login", description="'login' for existing accounts, 'register' for new accounts")
    full_name: str | None = Field(None, max_length=100, description="Full name of the user (required for register)")
    role: str = Field("admin", max_length=50, description="Account role, defaults to 'admin'")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("login", "register"):
            raise ValueError("mode must be either 'login' or 'register'")
        return v


class OTPResponse(BaseModel):
    message: str
    email: str
    mode: str = "login"
    cooldown_seconds: int
    expires_in_minutes: int


class OTPVerifyRequest(BaseModel):
    email: str = Field(..., description="User email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification OTP")
    mode: str = Field("login", description="'login' or 'register'")
    full_name: str | None = Field(None, max_length=100, description="Display name when registering")
    role: str = Field("admin", max_length=50, description="Account role, defaults to 'admin'")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v

    @field_validator("otp")
    @classmethod
    def normalize_otp(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("login", "register"):
            raise ValueError("mode must be either 'login' or 'register'")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    role: str
    is_active: bool
    is_verified: bool
    worker_id: str | None = None
    created_at: datetime
    last_login_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(None, max_length=100)
    role: str | None = Field(None, max_length=50)


class EmailTestRequest(BaseModel):
    to_email: str = Field(..., description="Target email address to test Brevo delivery")

    @field_validator("to_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v


class EmailTestResponse(BaseModel):
    success: bool
    message: str
    to_email: str
    smtp_host: str
    smtp_port: int
