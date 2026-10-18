"""
HeatGuard Twin / Svastra — OTP (One-Time Password) Service
Cryptographically secure 6-digit OTP generation, HMAC hashing, rate-limiting, and verification.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import EmailOTP, utcnow

logger = logging.getLogger(__name__)


def generate_otp(length: int = 6) -> str:
    """Generate cryptographically secure N-digit numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))


def hash_otp(email: str, otp: str) -> str:
    """HMAC-SHA256 hash OTP bound to email and secret key."""
    settings = get_settings()
    key = settings.secret_key.encode("utf-8")
    payload = f"{email.strip().lower()}:{otp.strip()}".encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


async def create_email_otp(
    db: AsyncSession,
    email: str,
    purpose: str = "login_or_register",
) -> tuple[str, EmailOTP]:
    """
    Generate and store an OTP for the given email address.
    Enforces cooldown rate limiting and invalidates prior unused OTPs.
    """
    settings = get_settings()
    normalized_email = email.strip().lower()
    now = utcnow()

    # Rate limiting check: check if a recent OTP was requested within cooldown period
    query_recent = (
        select(EmailOTP)
        .where(
            EmailOTP.email == normalized_email,
            EmailOTP.purpose == purpose,
            EmailOTP.is_used.is_(False),
        )
        .order_by(EmailOTP.created_at.desc())
    )
    result = await db.execute(query_recent)
    recent_otps = result.scalars().all()

    if recent_otps:
        latest = recent_otps[0]
        # Ensure latest.created_at is tz-aware
        created_at = latest.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        elapsed = (now - created_at).total_seconds()
        if elapsed < settings.otp_cooldown_seconds:
            remaining = int(settings.otp_cooldown_seconds - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting another verification code.",
            )

        # Invalidate earlier active OTPs
        for otp in recent_otps:
            otp.is_used = True

    # Generate new 6-digit OTP
    otp_code = generate_otp(6)
    hashed = hash_otp(normalized_email, otp_code)
    expires_at = now + timedelta(minutes=settings.otp_expire_minutes)

    otp_record = EmailOTP(
        id=str(uuid.uuid4()),
        email=normalized_email,
        otp_hash=hashed,
        purpose=purpose,
        attempts=0,
        is_used=False,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(otp_record)
    await db.commit()
    await db.refresh(otp_record)

    logger.info("Generated OTP for %s (purpose: %s, expires: %s)", normalized_email, purpose, expires_at)
    return otp_code, otp_record


async def verify_email_otp(
    db: AsyncSession,
    email: str,
    otp_code: str,
    purpose: str = "login_or_register",
) -> EmailOTP:
    """
    Verify OTP for email. Validates expiration, attempt limit, and hash match.
    Marks OTP as used upon successful verification.
    """
    settings = get_settings()
    normalized_email = email.strip().lower()
    clean_otp = otp_code.strip()
    now = utcnow()

    query = (
        select(EmailOTP)
        .where(
            EmailOTP.email == normalized_email,
            EmailOTP.purpose == purpose,
            EmailOTP.is_used.is_(False),
        )
        .order_by(EmailOTP.created_at.desc())
    )
    result = await db.execute(query)
    record = result.scalars().first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found for this email. Please request a new code.",
        )

    # Check expiration
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        record.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Check attempt limit
    if record.attempts >= settings.otp_max_attempts:
        record.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. This verification code has been invalidated. Please request a new code.",
        )

    # Validate OTP hash
    expected_hash = record.otp_hash
    computed_hash = hash_otp(normalized_email, clean_otp)

    if not hmac.compare_digest(expected_hash, computed_hash):
        record.attempts += 1
        await db.commit()
        remaining = max(0, settings.otp_max_attempts - record.attempts)
        if remaining == 0:
            record.is_used = True
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. This verification code has been invalidated. Please request a new code.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining.",
        )

    # Mark as used
    record.is_used = True
    await db.commit()
    logger.info("Successfully verified OTP for %s", normalized_email)
    return record
