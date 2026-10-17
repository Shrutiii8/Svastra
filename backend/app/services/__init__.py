"""services package"""
from app.services.email import send_email, send_otp_email
from app.services.otp import create_email_otp, verify_email_otp
from app.services.auth import (
    create_access_token,
    decode_access_token,
    get_or_create_user,
    get_current_user,
    get_optional_user,
)

__all__ = [
    "send_email",
    "send_otp_email",
    "create_email_otp",
    "verify_email_otp",
    "create_access_token",
    "decode_access_token",
    "get_or_create_user",
    "get_current_user",
    "get_optional_user",
]
