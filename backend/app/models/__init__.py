"""
HeatGuard Twin — ORM Models
All timestamps are timezone-aware (UTC).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Enums                                                                         #
# --------------------------------------------------------------------------- #


class WorkerCategory(str, enum.Enum):
    construction = "construction"
    delivery = "delivery"
    street_vendor = "street_vendor"
    traffic_police = "traffic_police"


class MetricType(str, enum.Enum):
    heart_rate = "heart_rate"
    steps = "steps"
    distance = "distance"
    oxygen_saturation = "oxygen_saturation"
    skin_temperature = "skin_temperature"


class DataSource(str, enum.Enum):
    health_connect = "health_connect"
    synthetic = "synthetic"
    simulated = "simulated"
    manual = "manual"


class AssessmentStatus(str, enum.Enum):
    insufficient_data = "insufficient_data"
    no_unusual_pattern = "no_unusual_pattern"
    monitor = "monitor"
    supervisor_review = "supervisor_review"


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


# --------------------------------------------------------------------------- #
# Worker                                                                        #
# --------------------------------------------------------------------------- #


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100))
    category: Mapped[WorkerCategory] = mapped_column(
        Enum(WorkerCategory, name="worker_category")
    )
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Baseline resting heart rate in bpm — computed or manually set
    baseline_hr_bpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    readings: Mapped[list["WearableReading"]] = relationship(
        back_populates="worker", cascade="all, delete-orphan"
    )
    assessments: Mapped[list["RiskAssessment"]] = relationship(
        back_populates="worker", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_workers_category", "category"),
        Index("ix_workers_is_active", "is_active"),
    )


# --------------------------------------------------------------------------- #
# Wearable Readings                                                             #
# --------------------------------------------------------------------------- #


class WearableReading(Base):
    __tablename__ = "wearable_readings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    worker_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False
    )
    metric_type: Mapped[MetricType] = mapped_column(
        Enum(MetricType, name="metric_type")
    )
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    source: Mapped[DataSource] = mapped_column(Enum(DataSource, name="data_source"))
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    # Stable deduplication key: (source, metric_type, worker_id, measured_at, value)
    source_record_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dedup_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    worker: Mapped["Worker"] = relationship(back_populates="readings")

    __table_args__ = (
        UniqueConstraint("dedup_hash", name="uq_wearable_readings_dedup_hash"),
        Index("ix_wearable_readings_worker_metric_time", "worker_id", "metric_type", "measured_at"),
        Index("ix_wearable_readings_measured_at", "measured_at"),
    )


# --------------------------------------------------------------------------- #
# Weather Readings                                                               #
# --------------------------------------------------------------------------- #


class WeatherReading(Base):
    __tablename__ = "weather_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    weather_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="open_meteo")
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    __table_args__ = (
        Index("ix_weather_readings_observed_at", "observed_at"),
    )


# --------------------------------------------------------------------------- #
# Risk Assessment                                                                #
# --------------------------------------------------------------------------- #


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    worker_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[AssessmentStatus] = mapped_column(
        Enum(AssessmentStatus, name="assessment_status")
    )
    assessment_type: Mapped[str] = mapped_column(
        String(50), default="rule_based_prototype"
    )
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array stored as text
    recommended_actions: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    weather_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    baseline_hr: Mapped[float | None] = mapped_column(Float, nullable=True)
    latest_hr: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_freshness: Mapped[str | None] = mapped_column(String(20), nullable=True)
    baseline_available: Mapped[bool] = mapped_column(Boolean, default=False)
    ml_prediction_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    worker: Mapped["Worker"] = relationship(back_populates="assessments")

    __table_args__ = (
        Index("ix_risk_assessments_worker_time", "worker_id", "assessed_at"),
    )


# --------------------------------------------------------------------------- #
# Consent Records                                                                #
# --------------------------------------------------------------------------- #


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    worker_id: Mapped[str] = mapped_column(String(50), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(20), default="1.0")
    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    data_types: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# --------------------------------------------------------------------------- #
# Alert Acknowledgment                                                           #
# --------------------------------------------------------------------------- #


class AlertAcknowledgment(Base):
    __tablename__ = "alert_acknowledgments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    assessment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("risk_assessments.id", ondelete="CASCADE")
    )
    acknowledged_by: Mapped[str] = mapped_column(String(100))
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# --------------------------------------------------------------------------- #
# User & Email OTP Authentication                                             #
# --------------------------------------------------------------------------- #


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="admin")  # admin, supervisor, worker
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    worker_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("workers.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    worker: Mapped["Worker | None"] = relationship()

    __table_args__ = (
        Index("ix_users_role", "role"),
        Index("ix_users_is_active", "is_active"),
    )


class EmailOTP(Base):
    __tablename__ = "email_otps"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), default="login_or_register")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    __table_args__ = (
        Index("ix_email_otps_email_purpose", "email", "purpose"),
        Index("ix_email_otps_expires_at", "expires_at"),
    )
