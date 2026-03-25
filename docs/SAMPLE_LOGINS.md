# Afarensis Enterprise — Sample User Logins

**Version**: 2.2.0
**Date**: 2026-03-25
**Environment**: Development / Demo

---

## How Login Works

Afarensis has two user-creation mechanisms:

1. **Bootstrap admin** — On a fresh database with zero users, logging in as `admin@afarensis.com` with any password auto-creates an admin account with that password. This only works once, on the very first login attempt.

2. **Seed data** — The `seed_database()` function in `backend/app/seed_data.py` populates the database with 7 sample users across 2 organizations, 4 sample projects, and realistic analysis results. Passwords are bcrypt-hashed at round 12.

---

## Sample Users

### Organization: Afarensis Inc.

| Role | Email | Password | Name | Department |
|------|-------|----------|------|------------|
| **Admin** | `admin@afarensis.com` | `admin123` | Platform Administrator | Administration |
| **Reviewer** | `reviewer1@afarensis.com` | `reviewer123` | Dr. Sarah Chen, Biostatistician | Biostatistics |
| **Reviewer** | `reviewer2@afarensis.com` | `reviewer123` | Dr. Michael Torres, Epidemiologist | Epidemiology |
| **Analyst** | `analyst@afarensis.com` | `analyst123` | Emily Park, Research Analyst | Research |
| **Viewer** | `viewer@afarensis.com` | `viewer123` | James Liu, Regulatory Affairs | Regulatory Affairs |

### Organization: Meridian Therapeutics

| Role | Email | Password | Name | Department |
|------|-------|----------|------|------------|
| **Admin** | `meridian-admin@example.com` | `meridian123` | Dr. Rachel Kim, VP Clinical | Clinical Operations |
| **Analyst** | `meridian-analyst@example.com` | `meridian123` | Tom Harris, Data Analyst | Biostatistics |

---

## Role Permissions

| Capability | Admin | Reviewer | Analyst | Viewer |
|-----------|-------|----------|---------|--------|
| Create projects | Yes | No | Yes | No |
| Configure analysis | Yes | No | Yes | No |
| Run computations | Yes | No | Yes | No |
| Review & approve | Yes | Yes | No | No |
| View projects | Yes | Yes | Yes | Yes |
| Manage users | Yes | No | No | No |
| System settings | Yes | No | No | No |
| Generate documents | Yes | Yes | Yes | No |
| Lock protocol | Yes | No | Yes | No |
| Upload patient data | Yes | No | Yes | No |
| Export audit trail | Yes | Yes | Yes | Yes |

---

## Sample Projects (Pre-seeded)

| Project | Status | Owner | Organization | Description |
|---------|--------|-------|-------------|-------------|
| XY-301: Rare CNS Disorder (Pediatric) | In Review | admin@afarensis.com | Afarensis Inc. | Phase 3 single-arm study, external control from registry data. HR = 0.38, E-value = 4.68 |
| CLARITY-AD: Alzheimer's Disease Phase 3 | Completed | reviewer1@afarensis.com | Afarensis Inc. | Phase 3 RCT, monoclonal antibody in early AD. HR = 0.69, E-value = 2.24 |
| GLP1-2026: Cardiovascular Outcomes | Draft | analyst@afarensis.com | Afarensis Inc. | CV outcomes trial, novel GLP-1 receptor agonist. No analysis results yet. |
| MRD-100: Autoimmune Hepatitis Phase 2 | Draft | meridian-admin@example.com | Meridian Therapeutics | Phase 2 dose-ranging, JAK1 inhibitor. No analysis results yet. |

---

## Quick Login Guide

### Using the UI

1. Navigate to `http://localhost:5173` (frontend) or wherever the app is deployed
2. Enter one of the email/password combinations from the table above
3. Click **Sign in**

### Using the API

```bash
# Login as admin
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@afarensis.com", "password": "admin123"}'

# Login as reviewer
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "reviewer1@afarensis.com", "password": "reviewer123"}'

# Login as analyst
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "analyst@afarensis.com", "password": "analyst123"}'

# Login as viewer
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "viewer@afarensis.com", "password": "viewer123"}'

# Login as Meridian org admin
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "meridian-admin@example.com", "password": "meridian123"}'
```

### Response Format

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@afarensis.com",
    "fullName": "Platform Administrator",
    "role": "ADMIN",
    "organizationId": "uuid",
    "organizationName": "Afarensis Inc.",
    "emailVerified": true
  }
}
```

Use the `access_token` in subsequent requests:
```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:8000/api/v1/projects
```

---

## Multi-Tenant Isolation Demo

To demonstrate that organizations are fully isolated:

1. Log in as `admin@afarensis.com` → You see **3 projects** (XY-301, CLARITY-AD, GLP1-2026)
2. Log in as `meridian-admin@example.com` → You see **1 project** (MRD-100)
3. Neither organization can see the other's projects, users, or data

---

## Running the Seed Script

The seed script runs automatically on application startup if the database is empty. To manually trigger it:

```python
# From the backend directory
import asyncio
from app.seed_data import seed_database
from app.core.database import async_session_factory

async def run_seed():
    async with async_session_factory() as session:
        await seed_database(session)

asyncio.run(run_seed())
```

Or if using the application startup:
```bash
cd backend
python -m uvicorn app.main:app --reload
# Seed runs automatically on first startup if users table is empty
```

---

## Fresh Database (No Seed Data)

If you start with a completely empty database and the seed script hasn't run:

- The **only** way to create the first user is the bootstrap mechanism
- Log in with `admin@afarensis.com` and **any password you choose**
- That password becomes the admin password
- All subsequent users must be created via the registration endpoint or admin user management

---

*Afarensis Enterprise v2.2.0 — Synthetic Ascension, Inc.*
