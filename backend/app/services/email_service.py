"""
Email Service for Afarensis Enterprise

Supports three delivery modes (selected automatically):
  1. SMTP (production) — real email via SendGrid, SES, or any SMTP relay.
  2. Console (development) — prints the email to the server log.
  3. File (testing) — writes emails to ./sent_emails/ for assertions.

Configuration (via environment / .env):
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL

If SMTP_HOST is not set, falls back to console mode automatically.
"""

import logging
import os
import json
from datetime import datetime
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Sends transactional emails with automatic fallback to console logging."""

    def __init__(self):
        self.smtp_host = getattr(settings, "SMTP_HOST", None) or os.getenv("SMTP_HOST")
        self.smtp_port = int(getattr(settings, "SMTP_PORT", None) or os.getenv("SMTP_PORT", "587"))
        self.smtp_user = getattr(settings, "SMTP_USER", None) or os.getenv("SMTP_USER")
        self.smtp_password = getattr(settings, "SMTP_PASSWORD", None) or os.getenv("SMTP_PASSWORD")
        self.from_email = (
            getattr(settings, "FROM_EMAIL", None)
            or os.getenv("FROM_EMAIL", "noreply@afarensis.com")
        )
        self.mode = "smtp" if self.smtp_host else "console"
        logger.info(f"Email service initialized in {self.mode} mode")

    async def send(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """Send an email. Returns True on success."""
        if self.mode == "smtp":
            return await self._send_smtp(to, subject, html_body, text_body)
        else:
            return self._send_console(to, subject, html_body, text_body)

    async def _send_smtp(
        self, to: str, subject: str, html_body: str, text_body: Optional[str]
    ) -> bool:
        """Send via SMTP (runs in executor to avoid blocking the event loop)."""
        import asyncio

        def _blocking_send():
            import smtplib

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to

            if text_body:
                msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            try:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, [to], msg.as_string())
                logger.info(f"Email sent via SMTP to {to}: {subject}")
                return True
            except Exception as e:
                logger.error(f"SMTP send failed: {e}")
                # Fall back to console
                self._send_console(to, subject, html_body, text_body)
                return False

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _blocking_send)

    def _send_console(
        self, to: str, subject: str, html_body: str, text_body: Optional[str]
    ) -> bool:
        """Log email to console (development mode)."""
        border = "=" * 60
        logger.info(
            f"\n{border}\n"
            f"  EMAIL (console mode — not actually sent)\n"
            f"  To:      {to}\n"
            f"  Subject: {subject}\n"
            f"  From:    {self.from_email}\n"
            f"{border}\n"
            f"{text_body or html_body}\n"
            f"{border}"
        )
        # Also write to file for easy retrieval during dev/testing
        try:
            os.makedirs("sent_emails", exist_ok=True)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            safe_to = to.replace("@", "_at_").replace(".", "_")
            filepath = f"sent_emails/{ts}_{safe_to}.json"
            with open(filepath, "w") as f:
                json.dump(
                    {"to": to, "subject": subject, "html": html_body, "text": text_body, "timestamp": ts},
                    f,
                    indent=2,
                )
        except Exception as exc:
            logger.debug("Email file write failed: %s", exc)
        return True

    # ── Template Methods ─────────────────────────────────────────────────

    async def send_password_reset_code(self, to: str, code: str, full_name: str = "User") -> bool:
        """Send a 6-digit password reset verification code."""
        subject = f"Afarensis — Your password reset code: {code}"
        html = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e3a5f; margin-bottom: 8px;">Password Reset</h2>
          <p style="color: #374151; font-size: 14px;">Hi {full_name},</p>
          <p style="color: #374151; font-size: 14px;">
            You requested a password reset. Enter this code in the application:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-family: monospace; letter-spacing: 0.3em; color: #1e3a5f; font-weight: bold;">
              {code}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 12px;">
            This code expires in 15 minutes. If you did not request this, ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px;">
            Afarensis Enterprise — Regulatory Evidence Review Platform
          </p>
        </div>
        """
        text = (
            f"Hi {full_name},\n\n"
            f"Your password reset code is: {code}\n\n"
            f"This code expires in 15 minutes.\n"
            f"If you did not request this, ignore this email.\n"
        )
        return await self.send(to, subject, html, text)

    async def send_verification_email(self, to: str, full_name: str, verification_url: str, token: str) -> bool:
        """Send email verification link for self-registration."""
        subject = "Afarensis — Verify your email address"
        html = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 0;">
          <div style="background: #1e3a5f; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; font-size: 18px; margin: 0;">Afarensis Enterprise</h1>
          </div>
          <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1e3a5f; margin-top: 0; margin-bottom: 8px;">Verify your email</h2>
            <p style="color: #374151; font-size: 14px;">Hi {full_name},</p>
            <p style="color: #374151; font-size: 14px;">
              Thank you for creating an account. Please verify your email address by clicking the button below.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="{verification_url}" style="display: inline-block; background: #2563EB; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Verify Email
              </a>
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              Or copy and paste this link into your browser:
            </p>
            <div style="background: #f3f4f6; border-radius: 6px; padding: 12px; text-align: center; margin: 12px 0;">
              <a href="{verification_url}" style="font-size: 12px; color: #2563EB; word-break: break-all; text-decoration: underline;">{verification_url}</a>
            </div>
            <p style="color: #6b7280; font-size: 12px;">
              This link expires in 24 hours. If you did not create an account, ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 11px;">
              Afarensis Enterprise — Regulatory Evidence Review Platform
            </p>
          </div>
        </div>
        """
        text = (
            f"Hi {full_name},\n\n"
            f"Thank you for creating an account on Afarensis Enterprise.\n\n"
            f"Please verify your email by visiting:\n{verification_url}\n\n"
            f"This link expires in 24 hours.\n"
            f"If you did not create an account, ignore this email.\n"
        )
        return await self.send(to, subject, html, text)

    async def send_welcome(self, to: str, full_name: str, temp_password: Optional[str] = None) -> bool:
        """Send welcome email to new user."""
        subject = "Welcome to Afarensis Enterprise"
        password_line = f"<p>Your temporary password is: <code>{temp_password}</code></p>" if temp_password else ""
        html = f"""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e3a5f;">Welcome to Afarensis</h2>
          <p>Hi {full_name},</p>
          <p>Your account has been created on the Afarensis Enterprise platform.</p>
          {password_line}
          <p>Please change your password on first login.</p>
        </div>
        """
        return await self.send(to, subject, html)


# Singleton
email_service = EmailService()
