"""
HeatGuard Twin / Svastra — Email Service (Brevo SMTP)
Sends transactional emails using Brevo SMTP with non-blocking async execution.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from app.config import get_settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> bool:
    """Synchronous SMTP worker function run in a separate thread."""
    settings = get_settings()

    if not settings.mail_host or not settings.mail_user:
        logger.warning("SMTP is not configured. Email to %s skipped.", to_email)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.mail_from
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="svastra.app")

    # Attach plain text fallback first, then HTML
    part_text = MIMEText(text_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    try:
        if settings.mail_secure:
            server = smtplib.SMTP_SSL(settings.mail_host, settings.mail_port, timeout=15)
        else:
            server = smtplib.SMTP(settings.mail_host, settings.mail_port, timeout=15)
            server.ehlo()
            if server.has_extn("STARTTLS") or settings.mail_port in (587, 2525):
                server.starttls()
                server.ehlo()

        if settings.mail_user and settings.mail_pass:
            server.login(settings.mail_user, settings.mail_pass)

        server.send_message(msg)
        server.quit()
        logger.info("Successfully sent email '%s' to %s via Brevo", subject, to_email)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s via Brevo SMTP: %s", to_email, exc, exc_info=True)
        raise exc


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str | None = None,
) -> bool:
    """Send an email asynchronously via Brevo SMTP without blocking the event loop."""
    if text_content is None:
        text_content = html_content

    return await asyncio.to_thread(
        _send_smtp_sync,
        to_email,
        subject,
        html_content,
        text_content,
    )


def generate_otp_email_template(
    otp_code: str,
    expires_in_minutes: int = 10,
    purpose: str = "login",
) -> tuple[str, str]:
    """Generate modern, brand-consistent HTML and text templates for Svastra OTP."""
    action_label = "Registration" if purpose == "register" else "Sign In"
    action_desc = (
        "complete your Svastra administrator registration and access the workforce twin dashboard."
        if purpose == "register"
        else "securely sign in to your Svastra administrative account."
    )

    text_content = (
        f"Your Svastra {action_label} Code is: {otp_code}\n\n"
        f"This code will expire in {expires_in_minutes} minutes.\n\n"
        f"Use this code to {action_desc}\n\n"
        f"If you did not request this verification code, please ignore this email.\n"
        f"Do not share this code with anyone.\n\n"
        f"— Svastra Workforce Heat Strain Intelligence Team"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Svastra {action_label} Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #161e2e 0%, #111827 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); overflow: hidden;">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="display: inline-block; background: linear-gradient(135deg, #2563eb, #38bdf8); padding: 12px 18px; border-radius: 12px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">SVASTRA</span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #f8fafc; letter-spacing: -0.3px;">
                {action_label} Verification
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">
                Workforce Heat Strain & Vitals Intelligence
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1; text-align: center;">
                Use the one-time verification code below to {action_desc}
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background: rgba(37, 99, 235, 0.12); border: 2px dashed #3b82f6; border-radius: 16px; padding: 20px 24px; display: inline-block; min-width: 260px; text-align: center;">
                      <span style="font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, Monaco, monospace; font-size: 38px; font-weight: 700; letter-spacing: 10px; color: #60a5fa; display: block; padding-left: 10px;">
                        {otp_code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Warning -->
              <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 24px 0 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #fbbf24; line-height: 1.5;">
                  ⏱ <strong>Expires in {expires_in_minutes} minutes.</strong> For your security, this code can only be used once.
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b; text-align: center;">
                If you did not request this verification code, you can safely ignore this email. Never forward or share this code with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0e1526; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
                Sent securely • Svastra Digital Twin System<br/>
                Industrial Heat Exposure & Physiological Safety Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return html_content, text_content


async def send_otp_email(
    to_email: str,
    otp_code: str,
    expires_in_minutes: int = 10,
    purpose: str = "login",
) -> bool:
    """Format and send the OTP verification email to the user."""
    action_label = "Registration" if purpose == "register" else "Sign In"
    subject = f"Your Svastra {action_label} Code: {otp_code}"
    html_content, text_content = generate_otp_email_template(
        otp_code=otp_code,
        expires_in_minutes=expires_in_minutes,
        purpose=purpose,
    )
    return await send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
    )
