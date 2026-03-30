"""
Afarensis Enterprise — Public-facing API Routes

Unauthenticated endpoints for the marketing website:
  - Waitlist signup
  - Contact form
  - Sample report download request & file serving

Data is stored in a standalone SQLite database (public_leads.db) so that the
public website never touches the main application database.
"""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error
import json as _json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api", tags=["public"])

# ---------------------------------------------------------------------------
# Database setup — standalone SQLite, created on import
# ---------------------------------------------------------------------------

_DB_PATH = os.environ.get(
    "PUBLIC_LEADS_DB",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public_leads.db"),
)

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def _get_conn() -> sqlite3.Connection:
    """Return a new connection to the public leads database."""
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db() -> None:
    """Create tables if they don't already exist."""
    conn = _get_conn()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT    NOT NULL,
                email           TEXT    NOT NULL UNIQUE,
                organization    TEXT,
                company_size    TEXT,
                use_cases       TEXT,
                requirements    TEXT,
                timeline        TEXT,
                design_partner  INTEGER NOT NULL DEFAULT 0,
                curiosity       TEXT,
                lead_source     TEXT,
                created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS contact_submissions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT    NOT NULL,
                email           TEXT    NOT NULL,
                message         TEXT    NOT NULL,
                organization    TEXT,
                created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sample_requests (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT    NOT NULL,
                email           TEXT    NOT NULL,
                phone           TEXT    NOT NULL,
                download_token  TEXT    NOT NULL UNIQUE,
                created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


# Initialise tables on module import
try:
    _init_db()
    logger.info("Public leads database initialised at %s", _DB_PATH)
except Exception as exc:
    logger.warning("Could not initialise public leads database: %s", exc)

# ---------------------------------------------------------------------------
# SMTP helper — best-effort, never raises
# ---------------------------------------------------------------------------

def _send_notification(subject: str, body: str) -> None:
    """Send an email notification via SendGrid HTTP API.

    Env vars:
      SENDGRID_API_KEY    — SendGrid API key (starts with SG.)
      FROM_EMAIL          — verified sender address
      NOTIFICATION_EMAIL  — where lead notifications are delivered

    Falls back to SMTP_PASSWORD if SENDGRID_API_KEY is not set (for
    backwards compatibility — the SMTP_PASSWORD field holds the SG key).

    All exceptions are caught and logged so that a missing or misconfigured
    mail service never causes an API request to fail.
    """
    try:
        api_key = os.environ.get("SENDGRID_API_KEY") or os.environ.get("SMTP_PASSWORD")
        from_email = os.environ.get("FROM_EMAIL")
        to_email = os.environ.get("NOTIFICATION_EMAIL")

        if not all([api_key, from_email, to_email]):
            logger.warning(
                "SendGrid not configured — skipping notification. "
                "Set SENDGRID_API_KEY (or SMTP_PASSWORD), FROM_EMAIL, NOTIFICATION_EMAIL."
            )
            return

        payload = _json.dumps({
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": from_email},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            logger.info("SendGrid notification sent (%d): %s", status, subject)

    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.warning("SendGrid HTTP error (%d) for '%s': %s", exc.code, subject, error_body)
    except Exception as exc:
        logger.warning("Failed to send notification (%s): %s", subject, exc)


@router.get("/smtp-test")
async def smtp_test():
    """Temporary diagnostic — remove after confirming email works."""
    api_key = os.environ.get("SENDGRID_API_KEY") or os.environ.get("SMTP_PASSWORD")
    from_email = os.environ.get("FROM_EMAIL")
    to_email = os.environ.get("NOTIFICATION_EMAIL")

    config = {
        "SENDGRID_API_KEY": "***SET***" if api_key else "***MISSING***",
        "FROM_EMAIL": from_email,
        "NOTIFICATION_EMAIL": to_email,
    }

    if not all([api_key, from_email, to_email]):
        return {"status": "error", "message": "SendGrid not configured", "config": config}

    try:
        payload = _json.dumps({
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": from_email},
            "subject": "Afarensis Email Test",
            "content": [{"type": "text/plain", "value": "This is a test email from Afarensis diagnostics. If you received this, email delivery is working."}],
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"status": "success", "message": f"Email sent to {to_email} (HTTP {resp.status})", "config": config}

    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        return {"status": "error", "http_code": exc.code, "message": error_body, "config": config}
    except Exception as exc:
        return {"status": "error", "message": str(exc), "error_type": type(exc).__name__, "config": config}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LeadRequest(BaseModel):
    name: str
    email: str
    organization: Optional[str] = None
    companySize: Optional[str] = None
    useCases: Optional[str] = None
    requirements: Optional[str] = None
    timeline: Optional[str] = None
    designPartner: bool = False
    curiosity: Optional[str] = None
    leadSource: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Email is required")
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str
    organization: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Email is required")
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message is required")
        return v.strip()


class SampleDownloadRequest(BaseModel):
    name: str
    email: str
    phone: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Email is required")
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("phone")
    @classmethod
    def phone_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Phone is required")
        return v.strip()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/v2/leads")
async def waitlist_signup(payload: LeadRequest):
    """Register a new lead / waitlist signup.

    If the email already exists the record is updated with the new data.
    """
    try:
        conn = _get_conn()
        try:
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO leads
                    (name, email, organization, company_size, use_cases,
                     requirements, timeline, design_partner, curiosity,
                     lead_source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    name           = excluded.name,
                    organization   = excluded.organization,
                    company_size   = excluded.company_size,
                    use_cases      = excluded.use_cases,
                    requirements   = excluded.requirements,
                    timeline       = excluded.timeline,
                    design_partner = excluded.design_partner,
                    curiosity      = excluded.curiosity,
                    lead_source    = excluded.lead_source,
                    updated_at     = excluded.updated_at
                """,
                (
                    payload.name,
                    payload.email,
                    payload.organization,
                    payload.companySize,
                    payload.useCases,
                    payload.requirements,
                    payload.timeline,
                    int(payload.designPartner),
                    payload.curiosity,
                    payload.leadSource,
                    now,
                    now,
                ),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logger.error("Failed to store lead: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process signup. Please try again later.")

    _send_notification(
        subject="New Afarensis Waitlist Signup",
        body=(
            f"Name: {payload.name}\n"
            f"Email: {payload.email}\n"
            f"Organization: {payload.organization or 'N/A'}\n"
            f"Company Size: {payload.companySize or 'N/A'}\n"
            f"Use Cases: {payload.useCases or 'N/A'}\n"
            f"Timeline: {payload.timeline or 'N/A'}\n"
            f"Design Partner: {payload.designPartner}\n"
        ),
    )

    return {"status": "success", "message": "Successfully joined waitlist"}


@router.post("/contact/submit")
async def contact_submit(payload: ContactRequest):
    """Handle a contact-form submission from the public website."""
    try:
        conn = _get_conn()
        try:
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO contact_submissions (name, email, message, organization, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (payload.name, payload.email, payload.message, payload.organization, now),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logger.error("Failed to store contact submission: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again later.")

    _send_notification(
        subject="New Afarensis Contact Form Submission",
        body=(
            f"Name: {payload.name}\n"
            f"Email: {payload.email}\n"
            f"Organization: {payload.organization or 'N/A'}\n"
            f"Message:\n{payload.message}\n"
        ),
    )

    return {"status": "success", "message": "Message sent successfully"}


@router.post("/sample-download")
async def sample_download_request(payload: SampleDownloadRequest):
    """Request access to a sample validation report.

    Returns a unique download token that can be exchanged for the PDF.
    """
    download_token = str(uuid.uuid4())

    try:
        conn = _get_conn()
        try:
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT INTO sample_requests (name, email, phone, download_token, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (payload.name, payload.email, payload.phone, download_token, now),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logger.error("Failed to store sample download request: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process request. Please try again later.")

    _send_notification(
        subject="New Sample Report Download Request",
        body=(
            f"Name: {payload.name}\n"
            f"Email: {payload.email}\n"
            f"Phone: {payload.phone}\n"
            f"Token: {download_token}\n"
        ),
    )

    return {"status": "success", "download_token": download_token}


@router.get("/sample-download/file")
async def sample_download_file(token: str = Query(..., description="Download token from sample request")):
    """Serve the sample validation report PDF.

    The token must have been previously generated via POST /api/sample-download.
    """
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Token is required")

    # Validate token
    try:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT id FROM sample_requests WHERE download_token = ?",
                (token.strip(),),
            ).fetchone()
        finally:
            conn.close()
    except Exception as exc:
        logger.error("Database error validating download token: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error")

    if row is None:
        raise HTTPException(status_code=403, detail="Invalid or expired download token")

    # Locate the PDF
    base_dir = Path(__file__).resolve().parent.parent.parent  # backend/
    pdf_path = base_dir / "public" / "sample-validation-report.pdf"

    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Sample report file not found")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename="sample-validation-report.pdf",
    )
