"""
Tests for Svastra Email Authentication & Brevo OTP Verification System
Validates separated Sign In and Sign Up flows, role assignment (admin), and security.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import get_db, Base
from app.models import EmailOTP, User
from app.services.email import generate_otp_email_template
from app.services.otp import hash_otp


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# OTP Email Template Tests                                                    #
# --------------------------------------------------------------------------- #


def test_otp_email_template_generation():
    otp = "482910"
    html, text = generate_otp_email_template(otp, expires_in_minutes=10, purpose="register")
    assert otp in html
    assert otp in text
    assert "SVASTRA" in html
    assert "10 minutes" in html
    assert "Registration Verification" in html


# --------------------------------------------------------------------------- #
# Sign Up / Register Endpoint Tests                                           #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_request_otp_register_success(client):
    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        resp = await client.post(
            "/api/v1/auth/request-otp",
            json={
                "email": "newadmin@svastra.demo",
                "mode": "register",
                "full_name": "Dr. Ananya Rao",
                "role": "admin",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "newadmin@svastra.demo"
        assert "registration" in data["message"].lower()

        # Check DB OTP record
        async with TestSessionLocal() as db:
            result = await db.execute(
                select(EmailOTP).where(EmailOTP.email == "newadmin@svastra.demo")
            )
            record = result.scalars().first()
            assert record is not None
            assert record.purpose == "register"


@pytest.mark.asyncio
async def test_request_otp_register_missing_name(client):
    resp = await client.post(
        "/api/v1/auth/request-otp",
        json={
            "email": "noname@svastra.demo",
            "mode": "register",
            "full_name": "",
        },
    )
    assert resp.status_code == 422
    assert "Full name is required" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_request_otp_register_already_exists(client):
    # Pre-create user
    async with TestSessionLocal() as db:
        user = User(
            id="U-EXIST-1",
            email="existing@svastra.demo",
            full_name="Existing Admin",
            role="admin",
            is_active=True,
        )
        db.add(user)
        await db.commit()

    # Attempting to register again must fail with 409
    resp = await client.post(
        "/api/v1/auth/request-otp",
        json={
            "email": "existing@svastra.demo",
            "mode": "register",
            "full_name": "Duplicate User",
        },
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


# --------------------------------------------------------------------------- #
# Sign In / Login Endpoint Tests                                              #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_request_otp_login_user_not_found(client):
    # Non-existent user trying to sign in
    resp = await client.post(
        "/api/v1/auth/request-otp",
        json={
            "email": "unknown@svastra.demo",
            "mode": "login",
        },
    )
    assert resp.status_code == 404
    assert "No account found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_request_otp_login_success(client):
    # Pre-create user
    async with TestSessionLocal() as db:
        user = User(
            id="U-ADMIN-01",
            email="admin@svastra.demo",
            full_name="Admin Supervisor",
            role="admin",
            is_active=True,
        )
        db.add(user)
        await db.commit()

    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        resp = await client.post(
            "/api/v1/auth/request-otp",
            json={
                "email": "admin@svastra.demo",
                "mode": "login",
            },
        )
        assert resp.status_code == 200
        assert "sign-in" in resp.json()["message"].lower()


@pytest.mark.asyncio
async def test_request_otp_rate_limiting_cooldown(client):
    # Pre-create user for login
    async with TestSessionLocal() as db:
        user = User(
            id="U-RATELIMIT-01",
            email="ratelimit@svastra.demo",
            full_name="Ratelimit User",
            role="admin",
            is_active=True,
        )
        db.add(user)
        await db.commit()

    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        # First request succeeds
        resp1 = await client.post(
            "/api/v1/auth/request-otp",
            json={"email": "ratelimit@svastra.demo", "mode": "login"},
        )
        assert resp1.status_code == 200

        # Immediate second request should be throttled
        resp2 = await client.post(
            "/api/v1/auth/request-otp",
            json={"email": "ratelimit@svastra.demo", "mode": "login"},
        )
        assert resp2.status_code == 429
        assert "Please wait" in resp2.json()["detail"]


# --------------------------------------------------------------------------- #
# OTP Verification & Authentication Tests                                     #
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_verify_otp_registration_creates_admin(client):
    sent_otp = None
    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        req_resp = await client.post(
            "/api/v1/auth/request-otp",
            json={
                "email": "headofsafety@svastra.demo",
                "mode": "register",
                "full_name": "Vikram Singh",
                "role": "admin",
            },
        )
        assert req_resp.status_code == 200
        sent_otp = mock_send.call_args.kwargs["otp_code"]

    # Verify registration OTP
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={
            "email": "headofsafety@svastra.demo",
            "otp": sent_otp,
            "mode": "register",
            "full_name": "Vikram Singh",
            "role": "admin",
        },
    )
    assert verify_resp.status_code == 200
    token_data = verify_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    assert token_data["user"]["email"] == "headofsafety@svastra.demo"
    assert token_data["user"]["full_name"] == "Vikram Singh"
    # User seeing the workers should be admin!
    assert token_data["user"]["role"] == "admin"
    assert token_data["user"]["is_verified"] is True


@pytest.mark.asyncio
async def test_verify_otp_login_preserves_profile_details(client):
    # Pre-create user with distinct name and role
    async with TestSessionLocal() as db:
        existing = User(
            id="U-PRESERVE-01",
            email="supervisor_pre@svastra.demo",
            full_name="Original Name",
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(existing)
        await db.commit()

    sent_otp = None
    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        await client.post(
            "/api/v1/auth/request-otp",
            json={"email": "supervisor_pre@svastra.demo", "mode": "login"},
        )
        sent_otp = mock_send.call_args.kwargs["otp_code"]

    # Verify login
    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={
            "email": "supervisor_pre@svastra.demo",
            "otp": sent_otp,
            "mode": "login",
        },
    )
    assert verify_resp.status_code == 200
    data = verify_resp.json()
    # Name and role must be completely preserved!
    assert data["user"]["full_name"] == "Original Name"
    assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_verify_otp_invalid_code_and_attempts(client):
    # Pre-create user
    async with TestSessionLocal() as db:
        user = User(
            id="U-ATTEMPT-01",
            email="attempts@svastra.demo",
            full_name="Attempts Admin",
            role="admin",
            is_active=True,
        )
        db.add(user)
        await db.commit()

    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        await client.post(
            "/api/v1/auth/request-otp",
            json={"email": "attempts@svastra.demo", "mode": "login"},
        )

    # 1st wrong attempt
    resp1 = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "attempts@svastra.demo", "otp": "000000", "mode": "login"},
    )
    assert resp1.status_code == 400
    assert "Invalid verification code" in resp1.json()["detail"]
    assert "4 attempt(s) remaining" in resp1.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_and_update_profile(client):
    # Register admin user
    sent_otp = None
    with patch("app.routers.auth.send_otp_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        await client.post(
            "/api/v1/auth/request-otp",
            json={
                "email": "profileadmin@svastra.demo",
                "mode": "register",
                "full_name": "Initial Admin",
                "role": "admin",
            },
        )
        sent_otp = mock_send.call_args.kwargs["otp_code"]

    verify_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={
            "email": "profileadmin@svastra.demo",
            "otp": sent_otp,
            "mode": "register",
            "full_name": "Initial Admin",
            "role": "admin",
        },
    )
    token = verify_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # GET /auth/me
    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "profileadmin@svastra.demo"
    assert me_resp.json()["role"] == "admin"

    # PUT /auth/me
    update_resp = await client.put(
        "/api/v1/auth/me",
        headers=headers,
        json={"full_name": "Chief Safety Officer", "role": "admin"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["full_name"] == "Chief Safety Officer"
    assert update_resp.json()["role"] == "admin"
