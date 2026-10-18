"""
HeatGuard Twin / Svastra — Authentication & JWT Security Service
Handles token generation, verification, user lifecycle, and FastAPI auth dependencies.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User, utcnow

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def create_access_token(
    user_id: str,
    email: str,
    role: str = "worker",
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Create a signed JWT access token."""
    settings = get_settings()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email.lower(),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    # PyJWT 2.x returns str
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def authenticate_existing_user(
    db: AsyncSession,
    email: str,
) -> User:
    """
    Authenticate an existing registered user for sign-in.
    Updates last_login_at and preserves original user profile details.
    """
    normalized_email = email.strip().lower()
    now = utcnow()

    query = select(User).where(User.email == normalized_email)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email. Please sign up first.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is deactivated. Please contact an administrator.",
        )

    user.last_login_at = now
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    logger.info("User signed in successfully: %s (role: %s)", normalized_email, user.role)
    return user


async def register_new_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    role: str = "admin",
) -> User:
    """
    Register a brand new user account for sign-up.
    Enforces uniqueness and defaults to admin role.
    """
    normalized_email = email.strip().lower()
    clean_name = full_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Full name is required for registration.",
        )

    query = select(User).where(User.email == normalized_email)
    result = await db.execute(query)
    existing = result.scalars().first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in instead.",
        )

    now = utcnow()
    new_user = User(
        id=str(uuid.uuid4()),
        email=normalized_email,
        full_name=clean_name,
        role=role.strip().lower() if role else "admin",
        is_active=True,
        is_verified=True,
        created_at=now,
        updated_at=now,
        last_login_at=now,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info("New admin user registered: %s (name: %s, role: %s)", normalized_email, clean_name, new_user.role)
    return new_user


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    full_name: str | None = None,
    role: str = "admin",
) -> tuple[User, bool]:
    """
    Retrieve existing user by email or register a new verified user.
    Returns (user, is_new_user).
    """
    normalized_email = email.strip().lower()
    now = utcnow()

    query = select(User).where(User.email == normalized_email)
    result = await db.execute(query)
    user = result.scalars().first()

    if user:
        user.last_login_at = now
        user.is_verified = True
        if full_name and not user.full_name:
            user.full_name = full_name.strip()
        await db.commit()
        await db.refresh(user)
        logger.info("Existing user logged in: %s", normalized_email)
        return user, False

    # Create new user
    new_user = User(
        id=str(uuid.uuid4()),
        email=normalized_email,
        full_name=full_name.strip() if full_name else None,
        role=role.strip().lower() if role else "admin",
        is_active=True,
        is_verified=True,
        created_at=now,
        updated_at=now,
        last_login_at=now,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info("New user registered via OTP: %s", normalized_email)
    return new_user, True


async def get_current_user(
    auth_header: HTTPAuthorizationCredentials | None = Security(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency to protect endpoints with Bearer JWT token."""
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please include 'Authorization: Bearer <token>' header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth_header.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


async def get_optional_user(
    auth_header: HTTPAuthorizationCredentials | None = Security(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional authentication dependency: returns User if valid token provided, else None."""
    if not auth_header or not auth_header.credentials:
        return None

    try:
        payload = decode_access_token(auth_header.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalars().first()
        if user and user.is_active:
            return user
        return None
    except HTTPException:
        return None
