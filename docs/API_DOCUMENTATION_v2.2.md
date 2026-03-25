# Afarensis Enterprise v2.2 — API Documentation

## Document Control
| Field | Value |
|-------|-------|
| Version | 2.2.0 |
| Date | 2026-03-25 |
| Base URL | `http://localhost:8000` |
| API Prefix | `/api/v1` |
| Auth | JWT Bearer Token |
| Content-Type | `application/json` (unless noted) |

## Global Headers

All authenticated requests require:
| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <access_token>` | Yes (except auth endpoints) |
| `Content-Type` | `application/json` | Yes (for POST/PUT) |
| `X-Request-ID` | UUID v4 | Optional (auto-generated if absent) |

## Global Error Response Format
```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "request_id": "uuid"
}
```

Common HTTP status codes:
- `400` Bad Request -- validation error
- `401` Unauthorized -- missing/expired token
- `403` Forbidden -- insufficient role or org mismatch
- `404` Not Found
- `409` Conflict -- resource already locked or duplicate
- `413` Payload Too Large -- file exceeds size limit
- `415` Unsupported Media Type -- invalid file type
- `422` Unprocessable Entity -- schema validation failure or pre-analysis validation BLOCKED
- `429` Too Many Requests -- rate limited
- `500` Internal Server Error

## Multi-Tenancy

All project-scoped endpoints enforce organization-level isolation. A user can only access projects belonging to their organization. The `organization_id` is derived from the JWT token and validated on every request.

---

## 1. Health Check

### `GET /health`
**Auth**: None
**Rate Limit**: None

Returns system health status including database connectivity, Redis, and OpenAI configuration.

**Response 200**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-25T10:00:00Z",
  "database": {
    "healthy": true,
    "stats": {},
    "pool": {}
  },
  "dependencies": {
    "database": "healthy",
    "redis": "healthy",
    "openai": "healthy"
  }
}
```

---

## 2. Authentication

### `POST /auth/login`
**Auth**: None
**Rate Limit**: 5 requests / 60 seconds

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `password` | string | Yes | User password |

**Response 200**:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@org.com",
    "full_name": "Jane Doe",
    "role": "analyst",
    "organization_id": "uuid",
    "organization_name": "Acme Pharma"
  }
}
```

**Notes**: If no users exist in the database, the first login with `admin@afarensis.com` auto-creates an admin account with the provided credentials.

### `GET /auth/me`
**Auth**: JWT Required

**Response 200**:
```json
{
  "id": "uuid",
  "email": "user@org.com",
  "fullName": "Jane Doe",
  "role": "analyst",
  "isActive": true,
  "mfaSecret": null,
  "organizationId": "uuid",
  "organizationName": "Acme Pharma",
  "createdAt": "2026-03-25T10:00:00Z",
  "updatedAt": "2026-03-25T10:00:00Z"
}
```

### `POST /auth/logout`
**Auth**: JWT Required

**Response 200**:
```json
{ "message": "Logged out successfully" }
```

### `POST /auth/revoke-all-sessions`
**Auth**: JWT Required

Revokes all refresh tokens for the current user (force re-login on all devices).

**Response 200**:
```json
{ "message": "All sessions revoked", "revoked_count": 3 }
```

### `POST /auth/forgot-password`
**Auth**: None
**Rate Limit**: 3 requests / 300 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

**Response 200**:
```json
{ "message": "If an account with that email exists, a verification code has been sent." }
```

**Notes**: In development mode, the response includes a `reset_token` field for convenience. Always returns 200 to prevent email enumeration.

### `POST /auth/verify-reset-code`
**Auth**: None

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | |
| `code` | string | Yes | 6-digit code from email |

**Response 200**:
```json
{ "message": "Code verified", "reset_token": "new-single-use-token" }
```

### `POST /auth/reset-password`
**Auth**: None

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `reset_token` | string | Yes |
| `new_password` | string | Yes |

**Response 200**:
```json
{ "message": "Password reset successfully. You can now sign in with your new password." }
```

**Notes**: Revokes all existing refresh tokens for the user, forcing re-authentication everywhere.

### `POST /auth/refresh`
**Auth**: None
**Rate Limit**: 10 requests / 60 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `refresh_token` | string | Yes |

**Response 200**: Same format as login response with new `access_token` and `refresh_token`.

**Security**: Token rotation -- old refresh token is invalidated. Reuse of an already-rotated token revokes ALL sessions (compromised token detection).

### `POST /auth/register`
**Auth**: None
**Rate Limit**: 5 requests / 900 seconds

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Must be unique |
| `password` | string | Yes | Must meet strength requirements |
| `full_name` | string | Yes | |
| `organization_name` | string | Yes | Creates or joins org by slug |

**Response 200**:
```json
{
  "message": "Account created. Check your email to verify your address.",
  "user_id": "uuid"
}
```

### `POST /auth/verify-email`
**Auth**: None

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `token` | string | Yes |

**Response 200**:
```json
{ "message": "Email verified. You can now sign in." }
```

### `POST /auth/resend-verification`
**Auth**: None
**Rate Limit**: 3 requests / 600 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

**Response 200**:
```json
{ "message": "If an account exists, a new verification email has been sent." }
```

---

## 3. Task Queue

Background tasks are used for long-running operations (evidence discovery, etc.).

### `GET /tasks/{task_id}`
**Auth**: JWT Required

**Response 200**:
```json
{
  "task_id": "uuid",
  "task_type": "evidence_discovery",
  "state": "running",
  "progress": 75.0,
  "message": "Searching PubMed...",
  "created_at": "2026-03-25T10:00:00Z",
  "completed_at": null,
  "error": null
}
```

### `GET /tasks/{task_id}/result`
**Auth**: JWT Required

Returns the full result payload of a completed task. Returns 409 if the task is not yet completed.

### `GET /tasks`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `task_type` | string | null | Filter by type |
| `limit` | int | 20 | Max results (1-100) |

**Response 200**:
```json
{ "tasks": [...] }
```

### `POST /tasks/{task_id}/cancel`
**Auth**: JWT Required

**Response 200**:
```json
{ "message": "Task cancelled", "task_id": "uuid" }
```

---

## 4. Projects

### `POST /projects`
**Auth**: JWT Required
**Rate Limit**: 20 requests / 60 seconds

**Request Body**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | Yes | | Max 500 chars |
| `description` | string | No | "" | |
| `research_intent` | string | No | "" | |
| `processing_config` | object | No | {} | Initial config |

**Response 201**:
```json
{
  "id": "uuid",
  "title": "My Study",
  "description": "...",
  "status": "draft",
  "research_intent": "...",
  "created_by": "uuid",
  "created_at": "2026-03-25T10:00:00Z",
  "updated_at": "2026-03-25T10:00:00Z"
}
```

### `GET /projects`
**Auth**: JWT Required
**Cache**: 30 seconds (org-scoped)

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | null | Filter: draft/processing/review/completed/archived |
| `page` | int | 1 | Page number |
| `page_size` | int | 20 | Items per page (max 100) |

**Response 200**:
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

### `GET /projects/{project_id}`
**Auth**: JWT Required
**Cache**: 120 seconds

Returns detailed project information including evidence counts, review decision counts, and parsed specification.

### `POST /projects/{project_id}/upload`
**Auth**: JWT Required
**Content-Type**: `multipart/form-data`

**Form Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF, DOCX, DOC, TXT, or MD. Max 100MB |

**Validation**: Magic byte verification (PDF: `%PDF`, DOCX: `PK` ZIP header, DOC: OLE2 header). Text files validated via UTF-8 decode. Rejects mismatched types.

---

## 5. Evidence Discovery

### `POST /projects/{project_id}/discover-evidence`
**Auth**: JWT Required
**Rate Limit**: 5 requests / 60 seconds

Starts a background task searching PubMed, ClinicalTrials.gov, OpenAlex, and Semantic Scholar.

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `max_pubmed_results` | int | 50 | Max PubMed results (max 200) |
| `max_trials_results` | int | 50 | Max ClinicalTrials.gov results (max 200) |

**Response 202**:
```json
{ "task_id": "uuid", "message": "Evidence discovery started" }
```

### `GET /projects/{project_id}/evidence`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `source_type` | string | null |
| `min_score` | float | null |
| `page` | int | 1 |
| `page_size` | int | 20 |

**Response 200**: Paginated list of evidence records with source type, title, abstract, authors, journal, publication year, and structured data.

---

## 6. Comparability Scoring & Anchor Generation

### `POST /projects/{project_id}/generate-anchors`
**Auth**: JWT Required

Initiates anchor candidate generation and scoring.

### `GET /projects/{project_id}/comparability-scores`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `min_overall_score` | float | null |
| `limit` | int | 50 (max 200) |

**Response 200**:
```json
[
  {
    "id": "uuid",
    "evidence_record_id": "uuid",
    "population_similarity": 0.85,
    "endpoint_alignment": 0.92,
    "covariate_coverage": 0.78,
    "temporal_alignment": 0.88,
    "evidence_quality": 0.90,
    "provenance_score": 0.95,
    "overall_score": 0.88,
    "regulatory_viability": 0.82,
    "scoring_rationale": "...",
    "scored_at": "2026-03-25T10:00:00Z"
  }
]
```

---

## 7. Bias & Fragility Analysis

### `POST /projects/{project_id}/analyze-bias`
**Auth**: JWT Required

Initiates bias detection and fragility analysis.

### `GET /projects/{project_id}/bias-analysis`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `bias_type` | string | null |
| `min_severity` | float | null |

**Response 200**: Array of bias analysis records with type, severity, description, fragility score, regulatory risk, and mitigation strategies.

---

## 8. Evidence Critique & Review Decisions

### `POST /projects/{project_id}/generate-critique`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `reviewer_persona` | string | "fda_statistical_reviewer" |

### `POST /projects/{project_id}/evidence/{evidence_id}/decision`
**Auth**: JWT Required (reviewer or admin role)

Submit reviewer decision with cryptographic e-signature.

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `decision` | string | Yes | accept/reject/request_more_info/deferred/pending |
| `confidence_level` | float | No |
| `rationale` | string | No |

**Response 200**: Decision record with `e_signature` hash.

### `GET /projects/{project_id}/decisions`
**Auth**: JWT Required

**Query Params**: `reviewer_id`, `decision`

---

## 9. Regulatory Artifact Generation

### `POST /projects/{project_id}/generate-artifact`
**Auth**: JWT Required
**Rate Limit**: 10 requests / 60 seconds

**Query Params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `artifact_type` | string | Yes | safety_assessment_report, fda_reviewer_packet, ema_assessment, summary_report, evidence_table, statistical_analysis_plan |
| `format` | string | No | "html" (default) or "docx" |

**Request Body** (optional):
| Field | Type | Default |
|-------|------|---------|
| `title` | string | auto-generated |
| `include_sections` | string[] | all |
| `regulatory_agency` | string | "FDA" |
| `submission_context` | string | null |
| `custom_parameters` | object | null |

**Response 200**:
```json
{
  "artifact_id": "uuid",
  "artifact_type": "safety_assessment_report",
  "title": "...",
  "format": "html",
  "status": "generated",
  "file_size": 125000,
  "checksum": "sha256...",
  "download_url": "/api/v1/artifacts/{artifact_id}/download"
}
```

### `GET /artifacts/{artifact_id}/download`
**Auth**: JWT Required

Returns file download with appropriate Content-Type and Content-Disposition headers. Falls back to inline HTML if file not on disk.

### `GET /projects/{project_id}/artifacts`
**Auth**: JWT Required

Lists all generated artifacts for a project with optional `artifact_type` filter.

---

## 10. Study Workflow Endpoints

All study endpoints follow the pattern `/projects/{project_id}/study/...`. Data is stored as JSON sections in `Project.processing_config`.

### `GET /projects/{id}/study/definition`
**Auth**: JWT Required

Returns study definition from `processing_config`.

### `PUT /projects/{id}/study/definition`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| `protocolTitle` | string | Protocol name |
| `indication` | string | Therapeutic area |
| `primaryEndpoint` | string | OS, PFS, ORR, etc. |
| `estimandType` | string | ATT, ATE, ITT, PP |
| `phase` | string | II, III, IV |
| `regulatoryBody` | string | FDA, EMA, PMDA |
| `treatmentName` | string | |
| `comparatorName` | string | |
| `secondaryEndpoints` | string[] | |

### `PUT /projects/{id}/study/lock`
**Auth**: JWT Required

Locks the study protocol. **Irreversible.** Computes SHA-256 hash of study definition. Creates an audit log entry with `regulatory_significance: true`.

**Response 200**:
```json
{
  "status": "locked",
  "locked_at": "2026-03-25T10:00:00Z",
  "protocol_hash": "sha256..."
}
```

### `GET /projects/{id}/study/covariates`
### `PUT /projects/{id}/study/covariates`
**Request Body**:
| Field | Type |
|-------|------|
| `covariates` | object[] |
| `covariates[].name` | string |
| `covariates[].role` | string (confounder/effect_modifier/mediator/precision) |
| `covariates[].selected` | boolean |

### `GET /projects/{id}/study/data-sources`
### `PUT /projects/{id}/study/data-sources`

### `GET /projects/{id}/study/cohort`
### `PUT /projects/{id}/study/cohort`

### `POST /projects/{id}/study/cohort/run`
**Auth**: JWT Required

Runs cohort attrition simulation based on inclusion/exclusion criteria. Returns funnel with counts at each step.

**Response 200**:
```json
{
  "funnel": [
    { "step": "Initial population", "n": 500000, "criterion": null },
    { "step": "Apply: Age 18-75", "n": 420000, "criterion": "Age 18-75", "type": "inclusion" },
    { "step": "Exclude: Prior treatment", "n": 395000, "criterion": "Prior treatment", "type": "exclusion" },
    { "step": "Final analytic cohort", "n": 395000, "criterion": null }
  ],
  "initial_n": 500000,
  "final_n": 395000
}
```

### `GET /projects/{id}/study/balance`
**Auth**: JWT Required

Returns covariate balance data (SMD) for a Love plot. Uses cached results from `processing_config` or computes from covariate list.

### `POST /projects/{id}/study/balance/compute`
**Auth**: JWT Required

Computes propensity scores, IPTW weights, and covariate balance (SMD). Uses real uploaded patient data if available, falls back to simulation.

**Response 200**:
```json
{
  "smd_data": [
    {
      "name": "age",
      "smd_raw": 0.23,
      "smd_weighted": 0.04,
      "pass": true
    }
  ],
  "propensity_summary": {
    "c_statistic": 0.72,
    "mean_ps_treated": 0.55,
    "mean_ps_control": 0.45,
    "n_trimmed": 0
  }
}
```

### `GET /projects/{id}/study/results/forest-plot`
**Auth**: JWT Required

Returns forest plot data (primary + sensitivity + subgroup results). Uses real patient data when available.

**Response 200**:
```json
[
  {
    "label": "Primary (IPTW Cox PH)",
    "est": 0.73,
    "lo": 0.58,
    "hi": 0.92,
    "primary": true,
    "note": "p=0.007"
  },
  {
    "label": "Subgroup: age < 60.0",
    "est": 0.81,
    "lo": 0.55,
    "hi": 1.19,
    "primary": false,
    "note": "subgroup (n=68, events=52)"
  }
]
```

### `GET /projects/{id}/study/bias`
**Auth**: JWT Required

Returns bias analysis results: E-values, bias domains, and mitigation strategies.

**Response 200**:
```json
{
  "e_value": {
    "e_value_point": 2.14,
    "e_value_ci": 1.45,
    "interpretation": "An unmeasured confounder would need..."
  },
  "bias_domains": [
    { "domain": "Selection Bias", "risk": "low", "mitigation": "IPTW balancing applied" },
    { "domain": "Confounding", "risk": "moderate", "mitigation": "Measured covariates adjusted via propensity scores" }
  ]
}
```

### `POST /projects/{id}/study/bias/run`
**Auth**: JWT Required

Runs bias analysis and computes E-values. Stores results in `processing_config`.

### `GET /projects/{id}/study/reproducibility`
### `PUT /projects/{id}/study/reproducibility`

### `GET /projects/{id}/study/audit`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by action category (partial match) |

Returns up to 500 audit log entries for the project.

### `GET /projects/{id}/study/regulatory`
**Auth**: JWT Required

Returns regulatory readiness checklist with section completion status and readiness score.

**Response 200**:
```json
{
  "sections": [
    { "section": "study_definition", "label": "Study Definition", "populated": true, "required": true, "status": "complete" }
  ],
  "readiness_score": 0.778,
  "total_sections": 9,
  "completed_sections": 7
}
```

### `POST /projects/{id}/study/regulatory/generate`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `format` | string | "html" |

Generates a regulatory document (SAR) using real project data from `processing_config`.

### `GET /projects/{id}/study/regulatory/download/{artifact_id}`
**Auth**: JWT Required

Returns file download with appropriate Content-Type and Content-Disposition headers.

---

## 11. Comparability Protocol [NEW in v2.2]

### `GET /projects/{id}/study/comparability-protocol` [NEW in v2.2]
**Auth**: JWT Required

Returns the latest comparability protocol for the project, including lock status and protocol hash.

**Response 200**:
```json
{
  "exists": true,
  "id": "uuid",
  "version": 1,
  "trial_population_criteria": "Adults 18-75 with confirmed diagnosis",
  "external_source_description": "Flatiron Health EHR database",
  "external_source_type": "ehr",
  "covariates": ["age", "sex", "ecog", "prior_therapy"],
  "adjustment_method": "iptw",
  "primary_estimand": "ATT",
  "feasibility_thresholds": {
    "min_n_per_arm": 20,
    "max_smd_threshold": 0.1,
    "min_ps_overlap": 0.1,
    "min_events": 10
  },
  "is_locked": false,
  "locked_at": null,
  "protocol_hash": null,
  "created_at": "2026-03-25T10:00:00Z",
  "updated_at": "2026-03-25T10:00:00Z"
}
```

### `POST /projects/{id}/study/comparability-protocol` [NEW in v2.2]
**Auth**: JWT Required

Creates or updates the comparability protocol. Returns 409 if the protocol is locked.

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| `trial_population_criteria` | string | Inclusion/exclusion criteria description |
| `external_source_description` | string | Description of external data source |
| `external_source_type` | string | Type: ehr, registry, claims, rwd |
| `covariates` | array | List of covariate names |
| `adjustment_method` | string | iptw, matching, stratification (default: iptw) |
| `primary_estimand` | string | ATT, ATE, ITT, PP (default: ATT) |
| `feasibility_thresholds` | object | Thresholds for feasibility gates |

**Response 200**:
```json
{ "id": "uuid", "version": 1, "status": "created" }
```

### `PUT /projects/{id}/study/comparability-protocol/lock` [NEW in v2.2]
**Auth**: JWT Required

Locks the comparability protocol. **Irreversible.** Computes SHA-256 hash. Creates audit log entry.

**Response 200**:
```json
{
  "locked": true,
  "locked_at": "2026-03-25T10:00:00Z",
  "protocol_hash": "sha256...",
  "version": 1
}
```

---

## 12. Feasibility Assessment [NEW in v2.2]

### `POST /projects/{id}/study/feasibility-assessment` [NEW in v2.2]
**Auth**: JWT Required

Runs feasibility assessment on the project's active uploaded dataset against comparability protocol thresholds.

**Prerequisites**: Active patient dataset (upload via `/ingestion/upload`).

**Response 200**:
```json
{
  "verdict": "PASS",
  "summary": "Dataset meets all feasibility thresholds",
  "checks": {
    "n_per_arm": { "pass": true, "treated": 120, "control": 480, "threshold": 20 },
    "max_smd": { "pass": true, "max_smd": 0.08, "threshold": 0.1 },
    "ps_overlap": { "pass": true, "overlap": 0.85, "threshold": 0.1 },
    "min_events": { "pass": true, "events": 45, "threshold": 10 }
  }
}
```

**Error 404**: No active patient dataset found.

---

## 13. Evidence Package Export [NEW in v2.2]

### `POST /projects/{id}/study/evidence-package` [NEW in v2.2]
**Auth**: JWT Required

Bundles all regulatory artifacts into a single Evidence Package with SHA-256 manifest. Returns a JSON evidence bundle with per-artifact hashes and a master manifest hash.

**Response 200**:
```json
{
  "package_id": "uuid",
  "project_id": "uuid",
  "project_title": "My Study",
  "generated_at": "2026-03-25T10:00:00Z",
  "generated_by": "uuid",
  "protocol_hash": "sha256...",
  "artifact_count": 7,
  "manifest_hash": "sha256...",
  "manifest": [
    { "name": "Comparability Protocol", "category": "protocol", "sha256": "...", "size_bytes": 2048 },
    { "name": "Study Definition", "category": "study", "sha256": "...", "size_bytes": 1024 }
  ],
  "artifacts": [...]
}
```

### `POST /projects/{id}/submission/evidence-package` [NEW in v2.2]
**Auth**: JWT Required

Bundles all regulatory artifacts into a single Evidence Package **ZIP file** for submission. Includes comparability protocol, analysis results, study definition, ADaM metadata, regulatory artifacts, audit trail, and reproducibility manifest.

**Response 200**: Binary ZIP file download (`application/zip`) with Content-Disposition header.

ZIP contents:
- `MANIFEST.json` -- Package manifest with file listing and SHA-256 hashes
- `comparability_protocol.json`
- `analysis_results.json`
- `study_definition.json`
- `adam/*.json` -- ADaM dataset metadata
- `artifacts/*.html` -- Generated regulatory artifacts
- `audit_trail.json` -- Full audit trail
- `reproducibility_manifest.json`

---

## 14. Audit Trail Export [NEW in v2.2]

### `GET /projects/{id}/study/audit/export` [NEW in v2.2]
**Auth**: JWT Required

Exports the project's complete audit trail as a regulatory-grade document with integrity hash.

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | "json" | Export format |

**Response 200**:
```json
{
  "title": "Audit Trail Export -- Regulatory Record",
  "project_id": "uuid",
  "project_title": "My Study",
  "protocol_hash": "sha256...",
  "exported_at": "2026-03-25T10:00:00Z",
  "exported_by": "uuid",
  "total_events": 42,
  "regulatory_events": 15,
  "date_range": {
    "first": "2026-01-15T09:00:00Z",
    "last": "2026-03-25T10:00:00Z"
  },
  "entries": [
    {
      "id": "uuid",
      "action": "protocol_locked",
      "resource_type": "project",
      "resource_id": "uuid",
      "user_id": "uuid",
      "ip_address": "10.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2026-03-20T14:30:00Z",
      "change_summary": "Study protocol locked for regulatory submission",
      "regulatory_significance": true,
      "duration_ms": 45
    }
  ],
  "export_hash": "sha256..."
}
```

---

## 15. Reference Populations [NEW in v2.2]

### `POST /reference-populations` [NEW in v2.2]
**Auth**: JWT Required

Creates a reference population record from a completed project's external control data.

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Population name |
| `description` | string | No | |
| `disease_area` | string | No | e.g. "NSCLC", "Breast Cancer" |
| `source_type` | string | No | ehr, registry, claims, rwd |
| `n_subjects` | int | No | Number of subjects |
| `demographics_summary` | object | No | `{mean_age, pct_female, pct_white}` |
| `outcome_types` | string[] | No | e.g. ["OS", "PFS", "ORR"] |
| `covariate_profile` | object[] | No | List of covariate descriptors |
| `inclusion_criteria` | string[] | No | |
| `project_id` | string | No | Source project ID |

**Response 200**:
```json
{
  "id": "uuid",
  "name": "NSCLC External Control Cohort",
  "disease_area": "NSCLC",
  "n_subjects": 850,
  "created_at": "2026-03-25T10:00:00Z"
}
```

### `GET /reference-populations` [NEW in v2.2]
**Auth**: JWT Required

Lists available reference populations, scoped to the user's organization (plus global/unscoped populations).

**Query Params**:
| Param | Type | Description |
|-------|------|-------------|
| `disease_area` | string | Filter by disease area (partial match) |

**Response 200**:
```json
[
  {
    "id": "uuid",
    "name": "NSCLC External Control Cohort",
    "description": "...",
    "disease_area": "NSCLC",
    "source_type": "ehr",
    "n_subjects": 850,
    "outcome_types": ["OS", "PFS"],
    "validated": true,
    "created_at": "2026-03-25T10:00:00Z"
  }
]
```

### `POST /projects/{id}/study/compare-to-reference/{ref_id}` [NEW in v2.2]
**Auth**: JWT Required

Compares the project's trial population against a reference population across demographics, outcomes, and covariates.

**Response 200**:
```json
{
  "project_id": "uuid",
  "reference_id": "uuid",
  "reference_name": "NSCLC External Control Cohort",
  "reference_disease_area": "NSCLC",
  "reference_n": 850,
  "dimensions": [
    {
      "dimension": "mean_age",
      "project_value": 62.5,
      "reference_value": 60.1,
      "absolute_difference": 2.4,
      "comparable": true
    }
  ],
  "outcome_alignment": {
    "reference_outcomes": ["OS", "PFS"],
    "project_endpoint": "OS",
    "aligned": true
  },
  "covariate_overlap": {
    "reference_covariates": ["age", "sex", "ecog"],
    "project_covariates": ["age", "sex", "ecog", "bmi"],
    "shared": ["age", "sex", "ecog"],
    "coverage_ratio": 1.0
  },
  "feasibility_verdict": "PASS",
  "feasibility_summary": "..."
}
```

---

## 16. Data Ingestion & Patient Data

### `GET /ingestion/attestation`
**Auth**: JWT Required

Returns the HIPAA attestation text that must be confirmed before upload.

### `POST /projects/{id}/ingestion/consent`
**Auth**: JWT Required

Records HIPAA consent attestation before data upload. Returns `consent_id` and `attestation_hash`.

### `POST /projects/{id}/ingestion/upload`
**Auth**: JWT Required
**Content-Type**: `multipart/form-data`

Uploads patient-level data file with regulatory compliance checks.

**Accepted formats**: `.csv`, `.xlsx`, `.xls`, `.xpt`, `.sas7bdat`
**Max size**: 100MB

**Query Params**:
| Param | Type | Description |
|-------|------|-------------|
| `consent_id` | string | Consent log ID (auto-resolved if absent) |

Runs 8 regulatory checks and returns an ingestion report with compliance status (`CLEARED`, `CLEARED_WITH_WARNINGS`, `BLOCKED`).

**Response 200**:
```json
{
  "report_id": "uuid",
  "dataset_id": "uuid",
  "compliance_status": "CLEARED",
  "file_name": "patient_data.csv",
  "file_hash": "sha256...",
  "file_size_bytes": 1048576,
  "consent_reference": "uuid",
  "findings": [...],
  "critical_count": 0,
  "major_count": 0,
  "warning_count": 2,
  "dataset_summary": {
    "total_rows": 600,
    "n_by_arm": { "Treatment": 120, "Control": 480 },
    "columns_detected": ["SUBJID", "ARM", "AGE", "SEX"],
    "key_variables_present": true,
    "missingness_summary": {}
  },
  "next_step": "Dataset is ready for ADEFF derivation. Proceed to matching and PS estimation."
}
```

### `GET /projects/{id}/ingestion/reports`
**Auth**: JWT Required

Lists all ingestion reports for a project.

### `GET /projects/{id}/ingestion/reports/{report_id}`
**Auth**: JWT Required

Returns detailed ingestion report.

### `POST /projects/{id}/ingestion/reports/{report_id}/acknowledge`
**Auth**: JWT Required

Acknowledges warnings on an ingestion report to proceed.

### `GET /projects/{id}/ingestion/datasets`
**Auth**: JWT Required

Lists uploaded patient datasets for a project.

### `POST /projects/{id}/retention/decide`
**Auth**: JWT Required

Sets data retention decision (`PERSIST` or `PURGE`) for project archival. PURGE permanently removes patient-level data and generates a purge certificate.

---

## 17. Patient Data Analysis [NEW in v2.2]

### `POST /projects/{id}/study/analyze-dataset` [NEW in v2.2]
**Auth**: JWT Required

Runs full statistical analysis on the project's active uploaded dataset. Enforces a 6-phase pre-analysis validation gate before any statistical model executes.

**Request Body** (optional):
| Field | Type | Description |
|-------|------|-------------|
| `column_mapping` | object | Custom column name mapping |

**Validation Gate**: Pre-analysis validation must PASS before models execute. If BLOCKED, returns 422 with detailed block reasons and validation report.

**Response 200**: Full statistical analysis results including:
- Primary analysis (hazard ratio, CI, p-value)
- Propensity scores and IPTW
- Kaplan-Meier curves
- E-values and fragility index
- Sensitivity analyses
- Subgroup analyses
- Covariate balance
- Meta-analysis
- Pre-analysis validation report
- Dataset hash and analysis result ID for reproducibility

**Response 422** (validation blocked):
```json
{
  "detail": {
    "message": "Pre-analysis validation BLOCKED. Models will not execute.",
    "block_reasons": ["Fewer than 10 subjects per arm", "No outcome variable detected"],
    "validation_report": {...},
    "validation_record_id": 1
  }
}
```

### `GET /projects/{id}/datasets` [NEW in v2.2]
**Auth**: JWT Required

Lists uploaded datasets with extended metadata including compliance status.

**Response 200**:
```json
{
  "project_id": "uuid",
  "datasets": [
    {
      "id": "uuid",
      "name": "patient_data.csv",
      "status": "active",
      "records_count": 600,
      "columns": ["SUBJID", "ARM", "AGE", "SEX"],
      "upload_timestamp": "2026-03-25T10:00:00Z",
      "source_type": "csv",
      "compliance_status": "CLEARED",
      "findings_summary": { "critical": 0, "major": 0, "warning": 2 }
    }
  ],
  "count": 1
}
```

### `GET /projects/{id}/study/analysis-results` [NEW in v2.2]
**Auth**: JWT Required

Returns the stored analysis results from `processing_config`.

### `GET /projects/{id}/study/validation-report` [NEW in v2.2]
**Auth**: JWT Required

Returns the pre-analysis validation report from `processing_config`.

### `GET /projects/{id}/study/dataset-info` [NEW in v2.2]
**Auth**: JWT Required

Returns the active dataset metadata for this project including file hash and compliance status.

**Response 200**:
```json
{
  "id": "uuid",
  "name": "patient_data.csv",
  "status": "active",
  "records_count": 600,
  "columns": ["SUBJID", "ARM", "AGE", "SEX"],
  "hash": "sha256...",
  "upload_timestamp": "2026-03-25T10:00:00Z",
  "source_type": "csv",
  "compliance_status": "CLEARED"
}
```

---

## 18. Statistical Analysis Plan (SAP)

### `POST /projects/{id}/study/sap/generate`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `format` | string | "docx" |

Generates a complete SAP document.

**Response 200**:
```json
{
  "id": "uuid",
  "artifact_type": "statistical_analysis_plan",
  "format": "docx",
  "title": "SAP -- My Study",
  "file_size": 45000,
  "generated_at": "2026-03-25T10:00:00Z"
}
```

---

## 19. Tables, Figures & Listings (TFLs)

### `POST /projects/{id}/study/tfl/demographics`
**Auth**: JWT Required

Generates Table 14.1.1: Demographics and Baseline Characteristics. Uses uploaded patient data when available.

### `POST /projects/{id}/study/tfl/ae-table`
**Auth**: JWT Required

Generates Table 14.3.1: Adverse Events Summary.

### `POST /projects/{id}/study/tfl/km-curve`
**Auth**: JWT Required

Generates Figure 14.2.1: Kaplan-Meier Survival Curves.

### `POST /projects/{id}/study/tfl/forest-plot`
**Auth**: JWT Required

Generates Figure 14.2.2: Forest Plot of Treatment Effects.

### `POST /projects/{id}/study/tfl/love-plot`
**Auth**: JWT Required

Generates Figure 14.1.1: Love Plot of Covariate Balance.

### `GET /projects/{id}/study/tfl/shells`
**Auth**: JWT Required

Lists all TFL shells (templates) for the project.

### `POST /projects/{id}/study/tfl/generate-all`
**Auth**: JWT Required

Generates all TFLs in a single batch operation.

---

## 20. ADaM Datasets

### `POST /projects/{id}/adam/generate/{dataset_type}`
**Auth**: JWT Required

**Path Params**:
| Param | Values | Description |
|-------|--------|-------------|
| `dataset_type` | `adsl`, `adae`, `adtte` | CDISC ADaM dataset type |

Uses uploaded patient data when available.

**Response 200**:
```json
{
  "id": "uuid",
  "dataset_name": "ADSL",
  "records_count": 300,
  "variables_count": 13,
  "created_at": "2026-03-25T10:00:00Z"
}
```

### `GET /projects/{id}/adam/datasets`
**Auth**: JWT Required

Lists all generated ADaM datasets for the project.

### `POST /projects/{id}/adam/validate`
**Auth**: JWT Required

Validates all ADaM datasets against CDISC conformance rules.

**Response 200**:
```json
{
  "datasets_validated": 3,
  "reports": [
    { "valid": true, "dataset": "ADSL", "errors": [], "warnings": [] }
  ]
}
```

### `GET /projects/{id}/adam/metadata`
**Auth**: JWT Required

Returns Define-XML style metadata for all ADaM datasets.

---

## 21. Missing Data Methods

### `POST /projects/{id}/study/missing-data/impute`
**Auth**: JWT Required

Multiple imputation using Rubin's rules (20 imputations by default).

### `POST /projects/{id}/study/missing-data/tipping`
**Auth**: JWT Required

Tipping-point sensitivity analysis.

### `POST /projects/{id}/study/missing-data/mmrm`
**Auth**: JWT Required

Mixed Model for Repeated Measures analysis.

### `GET /projects/{id}/study/missing-data/summary`
**Auth**: JWT Required

Returns missing data pattern summary with variable-level missingness and any stored imputation/tipping/MMRM results.

---

## 22. Submission Packages

### `POST /projects/{id}/submission/ectd/generate`
**Auth**: JWT Required

Generate eCTD Module 5 clinical study report package.

### `GET /projects/{id}/submission/ectd/manifest`
**Auth**: JWT Required

Returns eCTD HTML manifest.

### `POST /projects/{id}/submission/ectd/validate`
**Auth**: JWT Required

Validate eCTD package structure and completeness.

### `POST /projects/{id}/submission/define-xml/generate`
**Auth**: JWT Required

Generate CDISC Define-XML 2.1 document.

### `POST /projects/{id}/submission/define-xml/validate`
**Auth**: JWT Required

Validate Define-XML against CDISC schema. If no XML content provided, generates and validates.

### `POST /projects/{id}/submission/adrg/generate`
**Auth**: JWT Required

Generate Analysis Data Reviewer's Guide (ADRG) as DOCX.

### `POST /projects/{id}/submission/csr/synopsis`
**Auth**: JWT Required

Generate CSR Synopsis as DOCX.

### `POST /projects/{id}/submission/csr/section-11`
**Auth**: JWT Required

Generate CSR Section 11: Efficacy Evaluation as DOCX.

### `POST /projects/{id}/submission/csr/section-12`
**Auth**: JWT Required

Generate CSR Section 12: Safety Evaluation as DOCX.

### `POST /projects/{id}/submission/csr/appendix-16`
**Auth**: JWT Required

Generate CSR Appendix 16.1.9: Individual Patient Data as DOCX.

### `POST /projects/{id}/submission/csr/full`
**Auth**: JWT Required

Generate all CSR sections and save each as a regulatory artifact.

### `GET /projects/{id}/submission/status`
**Auth**: JWT Required

Get overall submission readiness status across all outputs (eCTD, Define-XML, ADRG, CSR sections, ADaM validation).

---

## 23. Full Statistical Analysis (Simulation)

### `GET /statistics/full-analysis`
**Auth**: JWT Required

Runs the complete statistical pipeline on **simulated reference data** (NOT uploaded patient data).

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `seed` | int | 42 |

**Response 200** (abbreviated):
```json
{
  "_data_source": "simulated_reference_data",
  "_warning": "Results are from simulated reference data, not uploaded patient data.",
  "primary_analysis": {
    "hazard_ratio": 0.73,
    "ci_lower": 0.58,
    "ci_upper": 0.92,
    "p_value": 0.007
  },
  "propensity_scores": { "c_statistic": 0.72 },
  "iptw": { "hazard_ratio": 0.73 },
  "kaplan_meier": { "curves": {}, "log_rank_test": {} },
  "e_value": { "e_value_point": 2.14, "e_value_ci": 1.45 },
  "fragility_index": { "fragility_index": 4 },
  "sensitivity_analyses": {},
  "covariate_balance": [],
  "meta_analysis": {},
  "subgroup_analyses": []
}
```

### `GET /statistics/summary`
**Auth**: JWT Required

Returns condensed summary statistics from simulated reference data.

---

## 24. Search

### `POST /search/semantic`
**Auth**: JWT Required
**Rate Limit**: 30 requests / 60 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `query` | string | Yes |
| `limit` | int | No (default 10) |

### `POST /search/hybrid`
**Auth**: JWT Required
**Rate Limit**: 30 requests / 60 seconds

Combines semantic and keyword search.

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `query` | string | Yes |
| `limit` | int | No |
| `semantic_weight` | float | No |

### `GET /search/recommendations/{evidence_id}`
**Auth**: JWT Required

**Query Params**: `recommendation_type` (similar/citing/cited/co_cited), `limit`

### `POST /search/save`
### `GET /search/saved`
### `POST /search/citation-network`

### Semantic Scholar Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/search/semantic-scholar` | Search papers. Params: `query`, `limit`, `offset`, `year_from`, `year_to`, `fields_of_study`, `open_access_only`, `min_citation_count` |
| `GET` | `/search/semantic-scholar/paper/{paper_id}` | Get paper by ID |
| `POST` | `/search/semantic-scholar/recommendations` | Get recommendations. Body: `positive_paper_ids`, `limit` |
| `POST` | `/search/rare-disease-evidence` | Search rare disease evidence. Body: `disease_name`, `intervention`, `limit`, `year_from` |

---

## 25. Collaborative Review

### `POST /review/workflows`
**Auth**: admin or reviewer

### `POST /review/assignments`
**Auth**: admin or reviewer

### `GET /review/assignments`
**Auth**: JWT Required

**Query Params**: `evidence_id`, `reviewer_id`, `status`

### `POST /review/comments`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `evidence_id` | string | Yes |
| `content` | string | Yes |
| `parent_id` | string | No (for threading) |
| `mentions` | string[] | No |

### `GET /review/comments/{evidence_id}`
**Auth**: JWT Required

Returns threaded comments.

### `POST /review/decisions`
### `POST /review/conflicts/resolve`
**Auth**: admin or reviewer

### `GET /review/presence/{evidence_id}`
### `POST /review/presence/{evidence_id}`

### `GET /workflows/{workflow_id}/progress`

---

## 26. SAR Pipeline

### `POST /sar-pipeline/init`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | Yes | |
| `treatment_source` | string | Yes | |
| `control_source` | string | Yes | |
| `primary_endpoint` | string | Yes | |
| `analysis_type` | string | No | Default: "ATT" |

Initialize 8-stage SAR pipeline. Returns pipeline ID and stage status.

### `GET /sar-pipeline/{project_id}/status`
**Auth**: JWT Required

Returns real-time pipeline status populated from `processing_config`.

### `POST /sar-pipeline/{project_id}/run-stage`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| `stage` | string | Stage name (data_ingestion, endpoint_harmonization, propensity_model, effect_estimation, sensitivity_analyses, bias_analysis, reproducibility_packaging, report_assembly) |
| `config` | object | Stage-specific configuration |

### `GET /sar-pipeline/{project_id}/results`
**Auth**: JWT Required

Returns full results from the SAR pipeline using real project data.

### `GET /sar-pipeline/{project_id}/report`
**Auth**: JWT Required

Returns the assembled SAR regulatory report with section completion status.

---

## 27. Bayesian Methods

### `POST /projects/{id}/study/bayesian/analyze`
**Auth**: JWT Required

Runs full Bayesian analysis pipeline.

### `POST /projects/{id}/study/bayesian/prior-elicitation`
**Auth**: JWT Required

Computes Bayesian prior elicitation from historical data.

### `POST /projects/{id}/study/bayesian/adaptive`
**Auth**: JWT Required

Computes Bayesian adaptive decision at interim.

---

## 28. Interim Analysis

### `POST /projects/{id}/study/interim/boundaries`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `n_looks` | int | 3 | Number of interim looks (2-10) |
| `method` | string | "obrien_fleming" | Spending function |
| `alpha` | float | 0.05 | Overall alpha level |

Computes group-sequential stopping boundaries.

### `POST /projects/{id}/study/interim/evaluate`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| `z_statistic` | float | Observed z-statistic |
| `look_number` | int | Current interim look number |

### `POST /projects/{id}/study/interim/dsmb-report`
**Auth**: JWT Required

Generates a structured DSMB/IDMC report.

---

## 29. SDTM Datasets

### `POST /projects/{id}/sdtm/generate/{domain}`
**Auth**: JWT Required

**Path Params**:
| Param | Values |
|-------|--------|
| `domain` | `dm`, `ae`, `lb`, `vs`, `ex`, `ds` |

### `POST /projects/{id}/sdtm/generate-all`
**Auth**: JWT Required

Generate all SDTM domains.

### `POST /projects/{id}/sdtm/validate`
**Auth**: JWT Required

Validate all generated SDTM domains.

### `GET /projects/{id}/sdtm/acrf`
**Auth**: JWT Required

Generate annotated CRF (aCRF) HTML.

---

## 30. Program Dashboard

### `GET /program/overview`
**Auth**: JWT Required

Cross-study program overview, scoped to user's organization.

### `GET /program/portfolio`
**Auth**: JWT Required

Portfolio summary with readiness scores for all projects.

### `GET /program/{project_id}/readiness`
**Auth**: JWT Required

Submission readiness checklist for a project.

### `GET /program/{project_id}/milestones`
**Auth**: JWT Required

Milestone timeline for a project.

---

## 31. AI & Intelligent Workflow

### `POST /projects/{id}/ai/comprehensive-analysis`
**Auth**: JWT Required
**Rate Limit**: 5 requests / 60 seconds

**Query Params**: `evidence_id` (required), `analysis_depth` (default: "comprehensive")

AI-powered comprehensive evidence analysis with zero-trust security verification.

### `GET /projects/{id}/workflow/guidance`
**Auth**: JWT Required

AI-powered intelligent workflow guidance and recommendations.

**Query Params**: `user_context` (JSON string, optional)

### `POST /projects/{id}/workflow/execute-step`
**Auth**: JWT Required

**Query Params**: `step_id` (required), `automation_level` (default: "assisted")

### `GET /projects/{id}/evidence/network`
**Auth**: JWT Required

Evidence network data for visualization. Returns nodes and relationships.

**Query Params**: `include_relationships` (default: true), `min_quality_score` (0.0-1.0)

### `POST /user/{user_id}/workflow/optimize`
**Auth**: JWT Required (own user or admin)

---

## 32. Security

### `POST /projects/{id}/security/threat-detection`
**Auth**: admin only

Real-time security threat detection and analysis.

### `POST /data/classify`
**Auth**: admin only

Classify data sensitivity and determine protection requirements.

---

## 33. Admin Endpoints

### `GET /users/me`
**Auth**: JWT Required

### `GET /users`
**Auth**: admin only

**Query Params**: `role`, `organization`, `page`, `page_size`

### `GET /audit/logs`
**Auth**: admin only

**Query Params**: `project_id`, `user_id`, `action`, `start_date`, `end_date`, `page`, `page_size`

### `GET /analytics/dashboard`
**Auth**: admin only
**Cache**: 60 seconds

Returns real counts from the database: active projects, evidence records, review decisions, total users, projects by status.

---

## 34. Organization Management

### `GET /org/info`
**Auth**: JWT Required

Returns organization details including user count and project count.

### `GET /org/users`
**Auth**: JWT Required

Lists users in the current user's organization.

### `POST /org/users/invite`
**Auth**: admin only

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `full_name` | string | Yes |
| `role` | string | Yes |

Returns invited user with temporary password.

### `PUT /org/users/{user_id}/role`
**Auth**: admin only

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `role` | string | Yes |

### `PUT /org/users/{user_id}/deactivate`
**Auth**: admin only

### `PUT /org/users/{user_id}/activate`
**Auth**: admin only

---

## 35. System & Observability

### `GET /system/storage-stats`
**Auth**: admin only

File storage backend statistics.

### `GET /system/cache-stats`
**Auth**: admin only

Cache backend statistics.

### `GET /system/metrics`
**Auth**: admin only

Request metrics, latency percentiles, and error rates.

### `GET /system/health/detailed`
**Auth**: admin only

Detailed health check with component status (database, cache, metrics).

---

## 36. BioGPT (Biomedical Language Model)

### `GET /biogpt/status`
**Auth**: JWT Required

Returns BioGPT model status (loaded, device, parameters).

### `POST /biogpt/generate`
**Auth**: JWT Required

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `prompt` | string | Yes |
| `max_new_tokens` | int | No (default 256) |
| `temperature` | float | No (default 0.7) |

### `POST /biogpt/explain-mechanism`
**Auth**: JWT Required

**Request Body**: `drug` (required), `condition` (required)

### `POST /biogpt/summarize`
**Auth**: JWT Required

**Request Body**: `title` (required), `abstract` (optional)

---

## 37. Federated Network & Evidence Patterns

### `GET /federated/nodes`
**Auth**: admin only

Lists federated network nodes. Status: beta.

### `GET /evidence-patterns`
**Auth**: JWT Required

**Query Params**: `indication_category`, `regulatory_agency`, `min_approval_likelihood`

Get successful evidence patterns from the pattern library. Status: beta.

---

## 38. WebSocket

### `WS /evidence/{evidence_id}/collaborate`

Real-time collaborative review with cursor tracking and live comments.

**Messages**:
```json
{"type": "join_session"}
{"type": "cursor_update", "cursor": {"x": 100, "y": 200}}
{"type": "comment_added", "comment": {"content": "...", "author": "..."}}
```

**Server Events**:
```json
{"type": "connected", "evidence_id": "uuid"}
{"type": "user_joined", "user": {"id": "..."}}
{"type": "cursor_update", "cursor": {...}}
{"type": "comment_added", "comment": {...}}
```

---

## Appendix A: Rate Limits Summary

| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 5 / 60s |
| `POST /auth/refresh` | 10 / 60s |
| `POST /auth/register` | 5 / 900s |
| `POST /auth/forgot-password` | 3 / 300s |
| `POST /auth/resend-verification` | 3 / 600s |
| `POST /projects` | 20 / 60s |
| `POST /projects/{id}/discover-evidence` | 5 / 60s |
| `POST /projects/{id}/generate-artifact` | 10 / 60s |
| `POST /projects/{id}/ai/comprehensive-analysis` | 5 / 60s |
| `POST /search/semantic` | 30 / 60s |
| `POST /search/hybrid` | 30 / 60s |

## Appendix B: Role Permissions

| Action | Admin | Reviewer | Analyst | Viewer |
|--------|-------|----------|---------|--------|
| Create projects | Yes | Yes | Yes | No |
| View projects (own org) | Yes | Yes | Yes | Yes |
| Submit review decisions | Yes | Yes | No | No |
| Resolve review conflicts | Yes | Yes | No | No |
| Manage users (invite/deactivate/roles) | Yes | No | No | No |
| View audit logs | Yes | No | No | No |
| Data classification | Yes | No | No | No |
| Threat detection | Yes | No | No | No |
| View analytics dashboard | Yes | No | No | No |
| System metrics/cache/storage | Yes | No | No | No |
| Federated nodes | Yes | No | No | No |

## Appendix C: v2.2 New Endpoints Summary

| Endpoint | Method | Section |
|----------|--------|---------|
| `/projects/{id}/study/comparability-protocol` | GET, POST | 11. Comparability Protocol |
| `/projects/{id}/study/comparability-protocol/lock` | PUT | 11. Comparability Protocol |
| `/projects/{id}/study/feasibility-assessment` | POST | 12. Feasibility Assessment |
| `/projects/{id}/study/evidence-package` | POST | 13. Evidence Package Export |
| `/projects/{id}/submission/evidence-package` | POST | 13. Evidence Package Export |
| `/projects/{id}/study/audit/export` | GET | 14. Audit Trail Export |
| `/reference-populations` | POST, GET | 15. Reference Populations |
| `/projects/{id}/study/compare-to-reference/{ref_id}` | POST | 15. Reference Populations |
| `/projects/{id}/study/analyze-dataset` | POST | 17. Patient Data Analysis |
| `/projects/{id}/datasets` | GET | 17. Patient Data Analysis |
| `/projects/{id}/study/analysis-results` | GET | 17. Patient Data Analysis |
| `/projects/{id}/study/validation-report` | GET | 17. Patient Data Analysis |
| `/projects/{id}/study/dataset-info` | GET | 17. Patient Data Analysis |

## Appendix D: Changelog from v2.1

### New in v2.2.0 (2026-03-25)
- **Comparability Protocol**: Full CRUD + lock workflow for pre-registering external comparator study designs
- **Feasibility Assessment**: Automated validation of uploaded data against protocol-defined thresholds
- **Evidence Package Export**: JSON manifest bundle and ZIP archive for regulatory submissions
- **Audit Trail Export**: Regulatory-grade export with SHA-256 integrity hash
- **Reference Population Library**: Create, list, and compare reference populations across projects
- **Patient Data Analysis**: Full statistical pipeline on uploaded datasets with 6-phase pre-analysis validation gate
- **Dataset Management**: Extended dataset listing with compliance status and findings summary
- **Analysis Results API**: Direct access to stored analysis results, validation reports, and dataset metadata
