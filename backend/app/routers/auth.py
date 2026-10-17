"""
HeatGuard Twin / Svastra — Auth & OTP API Router
Endpoints for email-based OTP request, verification, user profile, and Brevo delivery test.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import (
    EmailTestRequest,
    EmailTestResponse,
    OTPRequest,
    OTPResponse,
    OTPVerifyRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)
from sqlalchemy import select
from app.services.auth import (
    authenticate_existing_user,
    create_access_token,
    get_current_user,
    get_or_create_user,
    register_new_user,
)
from app.services.email import send_email, send_otp_email
from app.services.otp import create_email_otp, verify_email_otp

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_response(user: User) -> UserResponse:
    """Helper to convert ORM User model to UserResponse schema."""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        worker_id=user.worker_id,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post(
    "/request-otp",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
    summary="Request email verification OTP for login or registration",
)
async def request_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
) -> OTPResponse:
    """
    Generate a 6-digit OTP code and send it to the specified email via Brevo SMTP.
    - If mode is 'login': validates that the user account exists.
    - If mode is 'register': validates that the email is not already registered.
    """
    email = payload.email.strip().lower()
    mode = payload.mode.strip().lower()
    purpose = mode

    # Check existence depending on mode
    user_query = select(User).where(User.email == email)
    user_result = await db.execute(user_query)
    existing_user = user_result.scalars().first()

    if mode == "login":
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email. Please sign up to create an administrator account.",
            )
        if not existing_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated. Please contact support.",
            )
    elif mode == "register":
        if not payload.full_name or not payload.full_name.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Full name is required for registration.",
            )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please sign in instead.",
            )

    # Create OTP record in database
    otp_code, otp_record = await create_email_otp(
        db=db,
        email=email,
        purpose=purpose,
    )

    # Send email via Brevo SMTP
    try:
        await send_otp_email(
            to_email=email,
            otp_code=otp_code,
            expires_in_minutes=settings.otp_expire_minutes,
            purpose=purpose,
        )
    except Exception as exc:
        logger.error("Failed to deliver OTP email to %s: %s", email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please check SMTP configuration or try again.",
        )

    action_label = "registration" if mode == "register" else "sign-in"
    return OTPResponse(
        message=f"Verification code for {action_label} sent to {email}",
        email=email,
        mode=mode,
        cooldown_seconds=settings.otp_cooldown_seconds,
        expires_in_minutes=settings.otp_expire_minutes,
    )


@router.post(
    "/resend-otp",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
    summary="Resend verification OTP",
)
async def resend_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db),
) -> OTPResponse:
    """Alias to request a new OTP code, respecting cooldown rate limit."""
    return await request_otp(payload, db)


@router.post(
    "/verify-otp",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify OTP and authenticate user",
)
async def verify_otp(
    payload: OTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Verify the 6-digit OTP for the given email.
    - If mode is 'login': signs in existing user and preserves their name and role.
    - If mode is 'register': registers brand new user with role 'admin'.
    """
    email = payload.email.strip().lower()
    mode = payload.mode.strip().lower()
    purpose = mode

    # Verify the OTP code
    await verify_email_otp(
        db=db,
        email=email,
        otp_code=payload.otp,
        purpose=purpose,
    )

    if mode == "register":
        user = await register_new_user(
            db=db,
            email=email,
            full_name=payload.full_name or "",
            role=payload.role or "admin",
        )
    else:
        user = await authenticate_existing_user(
            db=db,
            email=email,
        )

    # Generate JWT token
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_response(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve details of the currently authenticated user from Bearer JWT."""
    return _user_to_response(current_user)


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update current authenticated user profile",
)
async def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update profile information (e.g. full name, role) for the authenticated user."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.role is not None:
        current_user.role = payload.role.strip()

    await db.commit()
    await db.refresh(current_user)
    return _user_to_response(current_user)


@router.post(
    "/logout",
    summary="Log out user",
)
async def logout(
    _current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Client-side token disposal endpoint."""
    return {"message": "Logged out successfully"}


@router.post(
    "/test-email",
    response_model=EmailTestResponse,
    summary="Test Brevo SMTP connectivity and deliverability",
)
async def test_email_endpoint(
    payload: EmailTestRequest,
) -> EmailTestResponse:
    """Send a test email via Brevo SMTP to verify credentials and connectivity."""
    to_email = payload.to_email.strip().lower()
    subject = "Svastra Brevo SMTP Integration Test"
    text_content = "This is a test email from Svastra backend confirming Brevo SMTP integration is working."
    html_content = (
        "<div style='font-family: sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 12px;'>"
        "<h2 style='color: #38bdf8;'>Svastra SMTP Integration Test</h2>"
        "<p>This email confirms that your Brevo SMTP credentials configured in <code>.env</code> are active and functioning correctly.</p>"
        "<p style='color: #94a3b8; font-size: 12px;'>Timestamp: " + settings.app_name + " v" + settings.app_version + "</p>"
        "</div>"
    )

    try:
        await send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )
        return EmailTestResponse(
            success=True,
            message="Test email successfully dispatched via Brevo SMTP",
            to_email=to_email,
            smtp_host=settings.mail_host,
            smtp_port=settings.mail_port,
        )
    except Exception as exc:
        logger.error("Test email failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Brevo SMTP test failed: {str(exc)}",
        )
