# Afarensis Enterprise v2.1 — API Documentation

## Document Control
| Field | Value |
|-------|-------|
| Version | 2.1.0 |
| Date | 2026-03-24 |
| Base URL | `http://localhost:8000` |
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
- `400` Bad Request — validation error
- `401` Unauthorized — missing/expired token
- `403` Forbidden — insufficient role
- `404` Not Found
- `422` Unprocessable Entity — schema validation failure
- `429` Too Many Requests — rate limited
- `500` Internal Server Error

---

## 1. Health Check

### `GET /health`
**Auth**: None
**Rate Limit**: None

**Response 200**:
```json
{
  "status": "healthy",
  "version": "2.1.0",
  "database": "connected",
  "redis": "connected",
  "openai": "configured",
  "timestamp": "2026-03-24T10:00:00Z"
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
    "fullName": "Jane Doe",
    "role": "analyst",
    "organizationId": "uuid",
    "emailVerified": true
  }
}
```

**Notes**: If no users exist in the database, the first login auto-creates an admin account with the provided credentials.

### `GET /auth/me`
**Auth**: JWT Required

**Response 200**:
```json
{
  "id": "uuid",
  "email": "user@org.com",
  "fullName": "Jane Doe",
  "role": "analyst",
  "organizationId": "uuid",
  "organization": "Acme Pharma",
  "department": "Biostatistics",
  "emailVerified": true,
  "lastLogin": "2026-03-24T10:00:00Z"
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

Revokes all refresh tokens for the current user.

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
{ "message": "If the email exists, a reset code has been sent" }
```

### `POST /auth/verify-reset-code`
**Auth**: None

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | |
| `code` | string | Yes | 6-digit code from email |

**Response 200**:
```json
{ "reset_token": "uuid", "expires_in": 600 }
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
{ "message": "Password reset successfully" }
```

### `POST /auth/refresh`
**Auth**: None
**Rate Limit**: 10 requests / 60 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `refresh_token` | string | Yes |

**Response 200**: Same as login response with new tokens.

**Security**: Token rotation — old refresh token is invalidated. Reuse of an already-rotated token revokes all sessions (compromised token detection).

### `POST /auth/register`
**Auth**: None
**Rate Limit**: 5 requests / 900 seconds

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Must be unique |
| `password` | string | Yes | Min 8 chars |
| `full_name` | string | Yes | |
| `organization_name` | string | Yes | Creates new org |

**Response 201**:
```json
{
  "user": { "id": "uuid", "email": "...", "role": "admin" },
  "organization": { "id": "uuid", "name": "..." },
  "message": "Verification email sent"
}
```

### `POST /auth/verify-email`
**Auth**: None

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `token` | string | Yes |

**Response 200**:
```json
{ "message": "Email verified successfully" }
```

### `POST /auth/resend-verification`
**Auth**: None
**Rate Limit**: 3 requests / 600 seconds

**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |

---

## 3. Task Queue

### `GET /tasks/{task_id}`
**Auth**: JWT Required

**Path Params**:
| Param | Type | Description |
|-------|------|-------------|
| `task_id` | string | Task UUID |

**Response 200**:
```json
{
  "task_id": "uuid",
  "task_type": "evidence_discovery",
  "status": "running|completed|failed|cancelled",
  "progress": 0.75,
  "message": "Searching PubMed...",
  "created_at": "2026-03-24T10:00:00Z",
  "completed_at": null,
  "error": null
}
```

### `GET /tasks/{task_id}/result`
**Auth**: JWT Required

Returns the full result payload of a completed task.

### `GET /tasks`
**Auth**: JWT Required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `task_type` | string | null | Filter by type |
| `limit` | int | 20 | Max results |

### `POST /tasks/{task_id}/cancel`
**Auth**: JWT Required

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

**Response 201**:
```json
{
  "id": "uuid",
  "title": "...",
  "description": "...",
  "status": "draft",
  "created_at": "...",
  "created_by": "uuid",
  "organization_id": "uuid"
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
| `per_page` | int | 20 | Items per page (max 100) |

**Response 200**:
```json
{
  "projects": [...],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

### `GET /projects/{project_id}`
**Auth**: JWT Required
**Cache**: 120 seconds

### `POST /projects/{project_id}/upload`
**Auth**: JWT Required
**Content-Type**: `multipart/form-data`

**Form Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF, DOCX, or TXT. Max 100MB |

**Validation**: Magic byte verification (PDF: `%PDF`, DOCX: `PK` ZIP header). Rejects mismatched extensions.

---

## 5. Evidence Discovery

### `POST /projects/{project_id}/discover-evidence`
**Auth**: JWT Required

Starts a background task searching PubMed, ClinicalTrials.gov, OpenAlex, and Semantic Scholar.

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
| `page` | int | 1 |
| `per_page` | int | 20 |

---

## 6. Study Workflow Endpoints

All study endpoints follow the pattern `/projects/{project_id}/study/...`

### `GET /projects/{id}/study/definition`
Returns study definition from `processing_config`.

### `PUT /projects/{id}/study/definition`
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
Locks the protocol. Irreversible. Audit-logged.

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
Runs cohort attrition simulation. Returns funnel with counts at each step.

### `GET /projects/{id}/study/balance`
### `POST /projects/{id}/study/balance/compute`
Computes propensity scores, IPTW weights, and SMDs. Returns Love plot data.

**Response 200**:
```json
{
  "covariates": [
    {
      "name": "age",
      "smd_unadjusted": 0.23,
      "smd_adjusted": 0.04,
      "mean_treated": 62.3,
      "mean_control": 58.1
    }
  ],
  "propensity_score": {
    "c_statistic": 0.72,
    "effective_n_treated": 145,
    "effective_n_control": 138
  }
}
```

### `GET /projects/{id}/study/results/forest-plot`
**Response 200**:
```json
{
  "primary_hr": 0.73,
  "primary_ci": [0.58, 0.92],
  "primary_p": 0.007,
  "forest": [
    {
      "label": "IPTW (Primary)",
      "est": 0.73,
      "lo": 0.58,
      "hi": 0.92,
      "note": "primary"
    },
    {
      "label": "Subgroup: age < 60.0",
      "est": 0.81,
      "lo": 0.55,
      "hi": 1.19,
      "note": "subgroup (n=68, events=52)"
    }
  ],
  "meta_analysis": {
    "pooled_effect": 0.71,
    "ci_lower": 0.55,
    "ci_upper": 0.91,
    "i_squared": 12.3,
    "method": "DerSimonian-Laird"
  }
}
```

### `GET /projects/{id}/study/bias`
### `POST /projects/{id}/study/bias/run`
Returns E-values, fragility index, bias domain scores.

**Response 200**:
```json
{
  "e_value": {
    "point": 2.14,
    "ci": 1.45,
    "interpretation": "An unmeasured confounder would need..."
  },
  "fragility_index": 4,
  "bias_domains": {
    "selection": 0.3,
    "confounding": 0.2,
    "measurement": 0.15,
    "temporal": 0.1
  }
}
```

### `GET /projects/{id}/study/reproducibility`
### `PUT /projects/{id}/study/reproducibility`
### `GET /projects/{id}/study/audit`
### `GET /projects/{id}/study/regulatory`

### `POST /projects/{id}/study/regulatory/generate`
**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | Yes | "html" or "docx" |
| `artifact_type` | string | No | "sar" (default) |

### `GET /projects/{id}/study/regulatory/download/{artifact_id}`
Returns file download with appropriate Content-Type and Content-Disposition headers.

---

## 7. Statistical Analysis Plan (SAP)

### `POST /projects/{id}/study/sap/generate`
Generates a complete SAP document.

---

## 8. Tables, Figures & Listings (TFLs)

### `POST /projects/{id}/study/tfl/demographics`
Generates Table 14.1.1: Demographics and Baseline Characteristics.

### `POST /projects/{id}/study/tfl/ae-table`
Generates Table 14.3.1: Adverse Events Summary.

### `POST /projects/{id}/study/tfl/km-curve`
Generates Figure 14.2.1: Kaplan-Meier Survival Curves.

### `POST /projects/{id}/study/tfl/forest-plot`
Generates Figure 14.2.2: Forest Plot of Treatment Effects.

### `POST /projects/{id}/study/tfl/love-plot`
Generates Figure 14.1.1: Love Plot of Covariate Balance.

### `GET /projects/{id}/study/tfl/shells`
Lists all TFL shells (templates) for the project.

### `POST /projects/{id}/study/tfl/generate-all`
Generates all TFLs in a single batch operation.

---

## 9. ADaM Datasets

### `POST /projects/{id}/adam/generate/{dataset_type}`
**Path Params**:
| Param | Values | Description |
|-------|--------|-------------|
| `dataset_type` | `adsl`, `adae`, `adtte` | CDISC ADaM dataset type |

**Response 200**:
```json
{
  "dataset_id": "uuid",
  "dataset_name": "ADSL",
  "dataset_label": "Subject-Level Analysis Dataset",
  "records_count": 300,
  "variables": ["STUDYID", "USUBJID", "SUBJID", "SITEID", "AGE", "AGEGR1", "SEX", "RACE", "ARM", "TRT01P", "TRT01A"],
  "validation_status": "valid"
}
```

### `GET /projects/{id}/adam/datasets`
Lists all generated ADaM datasets for the project.

### `POST /projects/{id}/adam/validate`
Validates all ADaM datasets against CDISC conformance rules.

### `GET /projects/{id}/adam/metadata`
Returns Define-XML style metadata for all ADaM datasets.

---

## 10. Missing Data Methods

### `POST /projects/{id}/study/missing-data/impute`
Multiple imputation using Rubin's rules.

**Request Body**:
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `n_imputations` | int | 20 | Number of imputed datasets |
| `method` | string | "pmm" | Imputation method |

### `POST /projects/{id}/study/missing-data/tipping`
Tipping-point sensitivity analysis.

### `POST /projects/{id}/study/missing-data/mmrm`
Mixed Model for Repeated Measures.

### `GET /projects/{id}/study/missing-data/summary`
Missing data pattern summary.

---

## 11. Submission Packages

### `POST /projects/{id}/submission/ectd/generate`
Generate eCTD Module 5 clinical study report package.

### `GET /projects/{id}/submission/ectd/manifest`
Returns eCTD HTML manifest.

### `POST /projects/{id}/submission/ectd/validate`
Validate eCTD package structure and completeness.

### `POST /projects/{id}/submission/define-xml/generate`
Generate CDISC Define-XML 2.1 document.

### `POST /projects/{id}/submission/define-xml/validate`
Validate Define-XML against CDISC schema.

### `POST /projects/{id}/submission/adrg/generate`
Generate Analysis Data Reviewer's Guide (DOCX).

### `POST /projects/{id}/submission/csr/synopsis`
Generate CSR Synopsis (DOCX).

### `POST /projects/{id}/submission/csr/section-11`
Generate CSR Section 11: Efficacy Evaluation (DOCX).

### `POST /projects/{id}/submission/csr/section-12`
Generate CSR Section 12: Safety Evaluation (DOCX).

### `POST /projects/{id}/submission/csr/appendix-16`
Generate CSR Appendix 16.1.9: Individual Patient Data (DOCX).

---

## 12. Full Statistical Analysis

### `GET /statistics/full-analysis`
**Auth**: JWT Required

Runs the complete statistical pipeline on simulated data (or uploaded patient data when available).

**Query Params**:
| Param | Type | Default |
|-------|------|---------|
| `seed` | int | 42 |

**Response 200** (abbreviated):
```json
{
  "primary_analysis": {
    "hazard_ratio": 0.73,
    "ci_lower": 0.58,
    "ci_upper": 0.92,
    "p_value": 0.007,
    "ci_method": "wald_asymptotic",
    "bootstrap": { "bootstrap_ci_lower": 0.56, "bootstrap_ci_upper": 0.94, "n_bootstrap": 500 },
    "concordance_index": 0.64,
    "converged": true,
    "coefficients": { "treatment": {}, "age": {} }
  },
  "unadjusted_analysis": {},
  "propensity_scores": {
    "c_statistic": 0.72,
    "mean_ps_treated": 0.55,
    "mean_ps_control": 0.45,
    "n_matched_treated": 120,
    "n_matched_control": 600
  },
  "iptw": {
    "hazard_ratio": 0.73,
    "ci_lower": 0.58,
    "ci_upper": 0.92,
    "effective_n": 285
  },
  "kaplan_meier": {
    "curves": {
      "Treatment": { "times": [], "survival_probabilities": [], "ci_lower": [], "ci_upper": [], "median_survival": 18.5 },
      "Control": {}
    },
    "log_rank_test": { "test_statistic": 7.2, "p_value": 0.007, "degrees_of_freedom": 1 }
  },
  "e_value": { "e_value_point": 2.14, "e_value_ci": 1.45 },
  "fragility_index": { "fragility_index": 4 },
  "sensitivity_analyses": {
    "ps_matched": { "hazard_ratio": 0.71 },
    "overlap_weighted": {},
    "trimmed_iptw": {}
  },
  "covariate_balance": [],
  "meta_analysis": {
    "pooled_effect": 0.71,
    "ci_lower": 0.55,
    "ci_upper": 0.91,
    "heterogeneity": { "I_squared": 12.3, "Q": 5.6, "tau_squared": 0.01 }
  },
  "multiplicity_adjustment": {},
  "subgroup_analyses": [
    {
      "label": "age < 60.0",
      "hazard_ratio": 0.81,
      "ci_lower": 0.55,
      "ci_upper": 1.19,
      "p_value": 0.28,
      "n_subjects": 68,
      "n_events": 52
    }
  ]
}
```

### `GET /statistics/summary`
Returns condensed summary statistics.

---

## 13. Search

### `POST /search/semantic`
**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `query` | string | Yes |
| `top_k` | int | No (default 10) |
| `project_id` | string | No |

### `POST /search/hybrid`
Combines semantic and keyword search.

### `GET /search/recommendations/{evidence_id}`
AI-powered evidence recommendations.

### `POST /search/save`
### `GET /search/saved`
### `POST /search/citation-network`

### Semantic Scholar Endpoints
| Method | Path | Key Params |
|--------|------|------------|
| `GET` | `/search/semantic-scholar` | `query`, `year_start`, `year_end`, `fields_of_study`, `open_access_only`, `min_citations`, `limit` |
| `GET` | `/search/semantic-scholar/paper/{paper_id}` | |
| `POST` | `/search/semantic-scholar/recommendations` | `paper_ids: string[]` |
| `POST` | `/search/rare-disease-evidence` | `query`, `disease_name` |

---

## 14. Collaborative Review

### `POST /review/workflows`
**Auth**: admin or reviewer

### `POST /review/assignments`
### `GET /review/assignments`
**Query Params**: `evidence_id`, `reviewer_id`, `status`

### `POST /review/comments`
**Request Body**:
| Field | Type | Required |
|-------|------|----------|
| `evidence_id` | string | Yes |
| `content` | string | Yes |
| `comment_type` | string | No |
| `parent_comment_id` | string | No (for threading) |
| `mentions` | string[] | No |

### `GET /review/comments/{evidence_id}`
Returns threaded comments.

### `POST /review/decisions`
### `POST /review/conflicts/resolve`
**Auth**: admin or reviewer

### `GET /review/presence/{evidence_id}`
### `POST /review/presence/{evidence_id}`

### `GET /workflows/{workflow_id}/progress`

---

## 15. SAR Pipeline

### `POST /sar-pipeline/init`
Initialize 8-stage SAR pipeline.

### `GET /sar-pipeline/{project_id}/status`
### `POST /sar-pipeline/{project_id}/run-stage`
**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| `stage` | string | Stage name to execute |

### `GET /sar-pipeline/{project_id}/results`
### `GET /sar-pipeline/{project_id}/report`

---

## 16. Admin Endpoints

### `GET /users/me`
### `GET /users`
**Auth**: admin
**Query Params**: `role`, `organization_id`, `page`, `per_page`

### `GET /audit/logs`
**Auth**: admin
**Query Params**: `project_id`, `user_id`, `action`, `start_date`, `end_date`, `page`, `per_page`

### `GET /analytics/dashboard`
**Auth**: admin
**Cache**: 60 seconds

---

## 17. WebSocket

### `WS /evidence/{evidence_id}/collaborate`
Real-time collaborative review with cursor tracking and live comments.

**Messages**:
```json
{"type": "cursor_update", "position": {"x": 100, "y": 200}}
{"type": "comment", "content": "...", "author": "..."}
{"type": "presence", "users": ["user1", "user2"]}
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

## Appendix B: Role Permissions

| Action | Admin | Reviewer | Analyst | Viewer |
|--------|-------|----------|---------|--------|
| Create projects | Yes | Yes | Yes | No |
| View projects (own org) | Yes | Yes | Yes | Yes |
| Submit review decisions | Yes | Yes | No | No |
| Manage users | Yes | No | No | No |
| View audit logs | Yes | No | No | No |
| Data classification | Yes | No | No | No |
| Threat detection | Yes | No | No | No |
