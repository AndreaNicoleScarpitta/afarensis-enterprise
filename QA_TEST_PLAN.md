# Afarensis Enterprise v2.1 — Full Release QA Test Plan

**Date:** 2026-03-26
**Scope:** Pre-release functional validation — every screen, every endpoint, every flow
**Standard:** All success paths must return HTTP 200 (or 202 for async). All screens must render without crash.

---

## TABLE OF CONTENTS

1. [Endpoint Validation Matrix](#1-endpoint-validation-matrix)
2. [UI Rendering Validation Matrix](#2-ui-rendering-validation-matrix)
3. [User Flow Validation](#3-user-flow-validation)
4. [Multi-Request / Multi-Source Cases](#4-multi-request--multi-source-cases)
5. [Async / Job / Queue Validation](#5-async--job--queue-validation)
6. [State Consistency](#6-state-consistency)
7. [Error Handling](#7-error-handling)
8. [Performance Sanity](#8-performance-sanity)
9. [Chaos Functional Test](#9-chaos-functional-test)
10. [UI State Rendering Matrix](#10-ui-state-rendering-matrix)

---

## 1. ENDPOINT VALIDATION MATRIX

### 1.1 Authentication Endpoints

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 1 | POST | /api/v1/auth/login | 200 | access_token, refresh_token, token_type, expires_in, user | 401 invalid creds, 429 rate limit (5/60s) | N |
| 2 | GET | /api/v1/auth/me | 200 | id, email, full_name, role, organization_id, is_active | 401 no token, 401 expired token | Y |
| 3 | POST | /api/v1/auth/logout | 200 | message | 401 no token | Y |
| 4 | POST | /api/v1/auth/revoke-all-sessions | 200 | message, revoked_count | 401 no token | Y |
| 5 | POST | /api/v1/auth/forgot-password | 200 | message | 429 rate limit (3/300s), 404 email not found | N |
| 6 | POST | /api/v1/auth/verify-reset-code | 200 | valid, reset_token | 400 invalid code, 410 expired code | N |
| 7 | POST | /api/v1/auth/reset-password | 200 | message | 400 weak password, 410 expired token | N |
| 8 | POST | /api/v1/auth/refresh | 200 | access_token, refresh_token, token_type, expires_in | 401 invalid refresh token, 429 rate limit (10/60s) | N |
| 9 | POST | /api/v1/auth/register | 200 | user, message | 409 email exists, 429 rate limit (5/900s), 422 validation | N |
| 10 | POST | /api/v1/auth/verify-email | 200 | message | 400 invalid token, 410 expired | N |
| 11 | POST | /api/v1/auth/resend-verification | 200 | message | 429 rate limit (3/600s), 404 email not found | N |

### 1.2 Health & Diagnostics

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 12 | GET | /health | 200 | status, service | Never (always returns) | N |
| 13 | GET | /health/detailed | 200 | status, service, version, dependencies | DB down → degraded | N |
| 14 | GET | /api/v1/health/circuit-breakers | 200 | circuit_breakers, summary | 401 no token | Y |

### 1.3 Task Management

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 15 | GET | /api/v1/tasks | 200 | tasks[] | 401 no token | Y |
| 16 | GET | /api/v1/tasks/{task_id} | 200 | task_id, task_type, state, progress, message, created_at, checkpoints | 404 not found, 401 no token | Y |
| 17 | GET | /api/v1/tasks/{task_id}/result | 200 | task_id, result | 404 not found, 409 not completed | Y |
| 18 | POST | /api/v1/tasks/{task_id}/cancel | 200 | message, task_id | 400 already completed, 404 not found | Y |

### 1.4 Project CRUD

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 19 | POST | /api/v1/projects | 200 | id, title, status, created_at, created_by | 422 missing research_intent, 401 no token | Y |
| 20 | GET | /api/v1/projects | 200 | items[], pagination{total, page, page_size, total_pages} | 401 no token | Y |
| 21 | GET | /api/v1/projects/{id} | 200 | id, title, status, processing_config, evidence_records | 404 not found, 403 wrong org | Y |
| 22 | GET | /api/v1/projects/{id}/dag | 200 | nodes[], edges[] | 404 project not found | Y |
| 23 | POST | /api/v1/projects/{id}/dag/generate | 200 | nodes[], edges[], message | 404 project not found | Y |
| 24 | PATCH | /api/v1/projects/{id}/dag/nodes/{key}/status | 200 | node_key, new_status | 404 node not found | Y |

### 1.5 Evidence Discovery & Management

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 25 | POST | /api/v1/projects/{id}/upload | 200 | file_id, filename, parsed_content | 413 file too large, 415 wrong type | Y |
| 26 | POST | /api/v1/projects/{id}/discover-evidence | 202 | task_id, message | 400 no research intent, 200 already running (dedup) | Y |
| 27 | GET | /api/v1/projects/{id}/evidence | 200 | items[], pagination | 404 project not found | Y |
| 28 | GET | /api/v1/projects/{id}/evidence/network | 200 | nodes[], edges[] | 404 project not found | Y |
| 29 | POST | /api/v1/projects/{id}/generate-anchors | 200 | anchor_candidates[] | 404 no evidence | Y |
| 30 | GET | /api/v1/projects/{id}/comparability-scores | 200 | scores[] | 404 project not found | Y |
| 31 | POST | /api/v1/projects/{id}/analyze-bias | 200 | bias_results[] | 404 no evidence | Y |
| 32 | GET | /api/v1/projects/{id}/bias-analysis | 200 | analyses[] | 404 project not found | Y |
| 33 | POST | /api/v1/projects/{id}/generate-critique | 200 | critique_text, severity, risks[] | 404 no evidence | Y |
| 34 | POST | /api/v1/projects/{id}/evidence/{eid}/decision | 200 | id, decision, confidence_level, decided_at | 404 evidence not found, 422 invalid decision | Y |
| 35 | GET | /api/v1/projects/{id}/decisions | 200 | decisions[] | 404 project not found | Y |
| 36 | POST | /api/v1/projects/{id}/generate-artifact | 200 | id, artifact_type, title, format | 404 project not found | Y |
| 37 | GET | /api/v1/projects/{id}/artifacts | 200 | artifacts[] | 404 project not found | Y |

### 1.6 Study Workflow Endpoints

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 38 | GET | /api/v1/projects/{id}/study/definition | 200 | processing_config section or {} | 404 project not found | Y |
| 39 | PUT | /api/v1/projects/{id}/study/definition | 200 | saved data echo | 404, 422 validation, 409 locked | Y |
| 40 | PUT | /api/v1/projects/{id}/study/lock | 200 | locked, locked_at, locked_by | 404, 409 already locked | Y |
| 41 | GET | /api/v1/projects/{id}/study/covariates | 200 | covariates section or {} | 404 | Y |
| 42 | PUT | /api/v1/projects/{id}/study/covariates | 200 | saved data echo | 404, 422 | Y |
| 43 | GET | /api/v1/projects/{id}/study/data-sources | 200 | data sources section or {} | 404 | Y |
| 44 | PUT | /api/v1/projects/{id}/study/data-sources | 200 | saved data echo | 404, 422 | Y |
| 45 | GET | /api/v1/projects/{id}/study/cohort | 200 | cohort section or {} | 404 | Y |
| 46 | PUT | /api/v1/projects/{id}/study/cohort | 200 | saved data echo | 404, 422 | Y |
| 47 | POST | /api/v1/projects/{id}/study/cohort/run | 200 | attrition_steps[], final_n | 404 | Y |
| 48 | GET | /api/v1/projects/{id}/study/balance | 200 | balance section or {} | 404 | Y |
| 49 | POST | /api/v1/projects/{id}/study/balance/compute | 200 | covariates[], smd_values[] | 404 | Y |
| 50 | GET | /api/v1/projects/{id}/study/results/forest-plot | 200 | forest_plot data or {} | 404 | Y |
| 51 | GET | /api/v1/projects/{id}/study/bias | 200 | bias section or {} | 404 | Y |
| 52 | POST | /api/v1/projects/{id}/study/bias/run | 200 | e_value, sensitivity_analyses[] | 404 | Y |
| 53 | GET | /api/v1/projects/{id}/study/reproducibility | 200 | reproducibility section or {} | 404 | Y |
| 54 | PUT | /api/v1/projects/{id}/study/reproducibility | 200 | saved data echo | 404, 422 | Y |
| 55 | GET | /api/v1/projects/{id}/study/audit | 200 | events[] | 404 | Y |
| 56 | GET | /api/v1/projects/{id}/study/audit/export | 200 | streaming file response | 404 | Y |
| 57 | GET | /api/v1/projects/{id}/study/regulatory | 200 | readiness section or {} | 404 | Y |
| 58 | POST | /api/v1/projects/{id}/study/regulatory/generate | 200 | artifact_id, content | 404 | Y |
| 59 | GET | /api/v1/projects/{id}/study/regulatory/download/{aid} | 200 | file response | 404 artifact not found | Y |

### 1.7 Comparability Protocol

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 60 | GET | /api/v1/projects/{id}/study/comparability-protocol | 200 | protocol data or {} | 404 | Y |
| 61 | POST | /api/v1/projects/{id}/study/comparability-protocol | 200 | saved data | 404, 422 | Y |
| 62 | PUT | /api/v1/projects/{id}/study/comparability-protocol/lock | 200 | locked, locked_at | 404, 409 already locked | Y |

### 1.8 Advanced Analyses

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 63 | POST | /api/v1/projects/{id}/study/sap/generate | 200 | sap_content, sections[] | 404 | Y |
| 64 | POST | /api/v1/projects/{id}/study/feasibility-assessment | 200 | assessment results | 404 | Y |
| 65 | POST | /api/v1/projects/{id}/study/evidence-package | 200 | package data | 404 | Y |
| 66 | POST | /api/v1/projects/{id}/study/missing-data/impute | 200 | imputation results | 404 | Y |
| 67 | POST | /api/v1/projects/{id}/study/missing-data/tipping | 200 | tipping results | 404 | Y |
| 68 | POST | /api/v1/projects/{id}/study/missing-data/mmrm | 200 | mmrm results | 404 | Y |
| 69 | GET | /api/v1/projects/{id}/study/missing-data/summary | 200 | summary data | 404 | Y |
| 70 | POST | /api/v1/projects/{id}/study/bayesian/analyze | 200 | posterior, credible_interval | 404 | Y |
| 71 | POST | /api/v1/projects/{id}/study/bayesian/prior-elicitation | 200 | prior data | 404 | Y |
| 72 | POST | /api/v1/projects/{id}/study/bayesian/adaptive | 200 | adaptive design results | 404 | Y |
| 73 | POST | /api/v1/projects/{id}/study/interim/boundaries | 200 | boundaries[] | 404 | Y |
| 74 | POST | /api/v1/projects/{id}/study/interim/evaluate | 200 | evaluation results | 404 | Y |
| 75 | POST | /api/v1/projects/{id}/study/interim/dsmb-report | 200 | report content | 404 | Y |

### 1.9 TFL Generation

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 76 | POST | /api/v1/projects/{id}/study/tfl/demographics | 200 | table_data | 404 | Y |
| 77 | POST | /api/v1/projects/{id}/study/tfl/ae-table | 200 | table_data | 404 | Y |
| 78 | POST | /api/v1/projects/{id}/study/tfl/km-curve | 200 | figure_data | 404 | Y |
| 79 | POST | /api/v1/projects/{id}/study/tfl/forest-plot | 200 | figure_data | 404 | Y |
| 80 | POST | /api/v1/projects/{id}/study/tfl/love-plot | 200 | figure_data | 404 | Y |
| 81 | GET | /api/v1/projects/{id}/study/tfl/shells | 200 | shells[] | 404 | Y |
| 82 | POST | /api/v1/projects/{id}/study/tfl/generate-all | 200 | results{} | 404 | Y |

### 1.10 ADaM & SDTM

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 83 | POST | /api/v1/projects/{id}/adam/generate/{type} | 200 | dataset_id, records_count | 404, 422 invalid type | Y |
| 84 | GET | /api/v1/projects/{id}/adam/datasets | 200 | datasets[] | 404 | Y |
| 85 | POST | /api/v1/projects/{id}/adam/validate | 200 | validation_results[] | 404 | Y |
| 86 | GET | /api/v1/projects/{id}/adam/metadata | 200 | metadata | 404 | Y |
| 87 | POST | /api/v1/projects/{id}/sdtm/generate/{domain} | 200 | dataset_id, records_count | 404, 422 invalid domain | Y |
| 88 | POST | /api/v1/projects/{id}/sdtm/generate-all | 200 | datasets{} | 404 | Y |
| 89 | POST | /api/v1/projects/{id}/sdtm/validate | 200 | validation_results[] | 404 | Y |
| 90 | GET | /api/v1/projects/{id}/sdtm/acrf | 200 | acrf data | 404 | Y |

### 1.11 Regulatory Submission

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 91 | POST | /api/v1/projects/{id}/submission/ectd/generate | 200 | package data | 404 | Y |
| 92 | GET | /api/v1/projects/{id}/submission/ectd/manifest | 200 | manifest data | 404 | Y |
| 93 | POST | /api/v1/projects/{id}/submission/ectd/validate | 200 | validation results | 404 | Y |
| 94 | POST | /api/v1/projects/{id}/submission/define-xml/generate | 200 | xml content | 404 | Y |
| 95 | POST | /api/v1/projects/{id}/submission/define-xml/validate | 200 | validation results | 404 | N |
| 96 | POST | /api/v1/projects/{id}/submission/adrg/generate | 200 | adrg content | 404 | Y |
| 97 | POST | /api/v1/projects/{id}/submission/csr/synopsis | 200 | content | 404 | Y |
| 98 | POST | /api/v1/projects/{id}/submission/csr/section-11 | 200 | content | 404 | Y |
| 99 | POST | /api/v1/projects/{id}/submission/csr/section-12 | 200 | content | 404 | Y |
| 100 | POST | /api/v1/projects/{id}/submission/csr/appendix-16 | 200 | content | 404 | Y |
| 101 | POST | /api/v1/projects/{id}/submission/csr/full | 200 | content | 404 | Y |
| 102 | GET | /api/v1/projects/{id}/submission/status | 200 | status data | 404 | Y |
| 103 | POST | /api/v1/projects/{id}/submission/evidence-package | 200 | package data | 404 | Y |

### 1.12 Search

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 104 | POST | /api/v1/search/semantic | 200 | results[] | 422 missing query | Y |
| 105 | POST | /api/v1/search/hybrid | 200 | results[] | 422 missing query | Y |
| 106 | GET | /api/v1/search/recommendations/{eid} | 200 | recommendations[] | 404 evidence not found | Y |
| 107 | POST | /api/v1/search/save | 200 | id, name, query | 422 validation | Y |
| 108 | GET | /api/v1/search/saved | 200 | searches[] | 401 | Y |
| 109 | POST | /api/v1/search/citation-network | 200 | nodes[], edges[] | 422 | Y |
| 110 | POST | /api/v1/search/pubmed | 200 | results[] | 503 circuit breaker open | Y |
| 111 | POST | /api/v1/search/clinical-trials | 200 | results[] | 503 circuit breaker open | Y |
| 112 | POST | /api/v1/search/openalex | 200 | results[] | 503 circuit breaker open | Y |
| 113 | GET | /api/v1/search/semantic-scholar | 200 | results[] | 503 circuit breaker open | Y |
| 114 | GET | /api/v1/search/semantic-scholar/paper/{pid} | 200 | paper data | 404 paper not found | Y |
| 115 | POST | /api/v1/search/semantic-scholar/recommendations | 200 | papers[] | 422 | Y |
| 116 | POST | /api/v1/search/rare-disease-evidence | 200 | results[] | 422 | Y |

### 1.13 Review & Collaboration

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 117 | POST | /api/v1/review/workflows | 200 | workflow_id | 422 | Y |
| 118 | POST | /api/v1/review/assignments | 200 | assignment_id | 404 evidence/user not found | Y |
| 119 | GET | /api/v1/review/assignments | 200 | assignments[] | 401 | Y |
| 120 | POST | /api/v1/review/comments | 200 | comment_id, content | 404 evidence not found | Y |
| 121 | GET | /api/v1/review/comments/{eid} | 200 | comments[] | 404 | Y |
| 122 | POST | /api/v1/review/decisions | 200 | decision_id | 422 | Y |
| 123 | POST | /api/v1/review/conflicts/resolve | 200 | resolution | 404 | Y |
| 124 | GET | /api/v1/review/presence/{eid} | 200 | active_users[] | 404 | Y |
| 125 | POST | /api/v1/review/presence/{eid} | 200 | updated presence | 404 | Y |
| 126 | GET | /api/v1/workflows/{wid}/progress | 200 | progress data | 404 | Y |

### 1.14 SAR Pipeline

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 127 | POST | /api/v1/sar-pipeline/init | 200 | pipeline_id, status | 422 | Y |
| 128 | GET | /api/v1/sar-pipeline/{id}/status | 200 | status, stages[] | 404 | Y |
| 129 | POST | /api/v1/sar-pipeline/{id}/run-stage | 200 | stage_result | 404, 409 wrong order | Y |
| 130 | GET | /api/v1/sar-pipeline/{id}/results | 200 | results | 404 | Y |
| 131 | GET | /api/v1/sar-pipeline/{id}/report | 200 | report content | 404 | Y |

### 1.15 Data Ingestion

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 132 | POST | /api/v1/projects/{id}/ingestion/consent | 200 | consent_id, status | 422 | Y |
| 133 | POST | /api/v1/projects/{id}/ingestion/upload | 200 | dataset_id, compliance_report, status | 400 no consent, 413 too large, 422 bad format | Y |
| 134 | GET | /api/v1/projects/{id}/ingestion/reports | 200 | reports[] | 404 | Y |
| 135 | GET | /api/v1/projects/{id}/ingestion/reports/{rid} | 200 | report detail | 404 | Y |
| 136 | POST | /api/v1/projects/{id}/ingestion/reports/{rid}/acknowledge | 200 | acknowledged | 404 | Y |
| 137 | GET | /api/v1/projects/{id}/ingestion/datasets | 200 | datasets[] | 404 | Y |
| 138 | GET | /api/v1/ingestion/attestation | 200 | attestation_text | none | Y |

### 1.16 Dataset Analysis

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 139 | POST | /api/v1/projects/{id}/study/analyze-dataset | 202 | task_id, message | 404 no dataset, 400 empty data, 200 already running (dedup) | Y |
| 140 | GET | /api/v1/projects/{id}/datasets | 200 | datasets[] | 404 | Y |
| 141 | GET | /api/v1/projects/{id}/study/analysis-results | 200 | results or {} | 404 | Y |
| 142 | GET | /api/v1/projects/{id}/study/validation-report | 200 | report or {} | 404 | Y |
| 143 | GET | /api/v1/projects/{id}/study/dataset-info | 200 | info or {} | 404 | Y |

### 1.17 User & Org Management

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 144 | GET | /api/v1/users/me | 200 | id, email, role | 401 | Y |
| 145 | GET | /api/v1/users | 200 | users[] | 401 | Y |
| 146 | POST | /api/v1/user/{uid}/workflow/optimize | 200 | recommendations | 404 | Y |
| 147 | GET | /api/v1/org/info | 200 | id, name, slug | 401 | Y |
| 148 | GET | /api/v1/org/users | 200 | users[] | 401 | Y |
| 149 | POST | /api/v1/org/users/invite | 200 | user_id, message | 409 email exists, 403 not admin | Y |
| 150 | PUT | /api/v1/org/users/{uid}/role | 200 | updated user | 404, 403 not admin | Y |
| 151 | PUT | /api/v1/org/users/{uid}/deactivate | 200 | message | 404, 403 | Y |
| 152 | PUT | /api/v1/org/users/{uid}/activate | 200 | message | 404, 403 | Y |

### 1.18 AI & BioGPT

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 153 | GET | /api/v1/biogpt/status | 200 | available, model | 401 | Y |
| 154 | POST | /api/v1/biogpt/generate | 200 | generated_text | 503 unavailable | Y |
| 155 | POST | /api/v1/biogpt/explain-mechanism | 200 | explanation | 503 | Y |
| 156 | POST | /api/v1/biogpt/summarize | 200 | summary | 503 | Y |
| 157 | POST | /api/v1/projects/{id}/ai/comprehensive-analysis | 200 | analysis results | 404 | Y |

### 1.19 System & Monitoring

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 158 | GET | /api/v1/system/storage-stats | 200 | stats | 401 | Y |
| 159 | GET | /api/v1/system/cache-stats | 200 | stats | 401 | Y |
| 160 | GET | /api/v1/system/metrics | 200 | metrics | 401 | Y |
| 161 | GET | /api/v1/system/health/detailed | 200 | health details | 401 | Y |
| 162 | GET | /api/v1/analytics/dashboard | 200 | dashboard data | 401 | Y |
| 163 | GET | /api/v1/statistics/full-analysis | 200 | analysis data | 401 | Y |
| 164 | GET | /api/v1/statistics/summary | 200 | summary data | 401 | Y |
| 165 | GET | /api/v1/audit/logs | 200 | logs[] | 401 | Y |

### 1.20 Remaining Endpoints

| # | Method | Endpoint | Expected Status | Required Response Fields | Failure Conditions | Auth |
|---|--------|----------|----------------|--------------------------|-------------------|------|
| 166 | POST | /api/v1/data/classify | 200 | classification result | 422 | Y |
| 167 | GET | /api/v1/artifacts/{aid}/download | 200 | file response | 404 | Y |
| 168 | POST | /api/v1/projects/{id}/security/threat-detection | 200 | threats[] | 404 | Y |
| 169 | POST | /api/v1/projects/{id}/retention/decide | 200 | decision result | 404 | Y |
| 170 | POST | /api/v1/reference-populations | 200 | id, population_name | 422 | Y |
| 171 | GET | /api/v1/reference-populations | 200 | populations[] | 401 | Y |
| 172 | POST | /api/v1/projects/{id}/study/compare-to-reference/{rid} | 200 | comparison results | 404 | Y |
| 173 | GET | /api/v1/program/overview | 200 | overview data | 401 | Y |
| 174 | GET | /api/v1/program/portfolio | 200 | portfolio data | 401 | Y |
| 175 | GET | /api/v1/program/{id}/readiness | 200 | readiness data | 404 | Y |
| 176 | GET | /api/v1/program/{id}/milestones | 200 | milestones[] | 404 | Y |
| 177 | GET | /api/v1/federated/nodes | 200 | nodes[] | 401 | Y |
| 178 | GET | /api/v1/evidence-patterns | 200 | patterns[] | 401 | Y |
| 179 | GET | /api/v1/projects/{id}/workflow/guidance | 200 | guidance data | 404 | Y |
| 180 | POST | /api/v1/projects/{id}/workflow/execute-step | 200 | step result | 404 | Y |

### 1.21 WebSocket

| # | Protocol | Endpoint | Expected Behavior | Failure Conditions |
|---|----------|----------|-------------------|-------------------|
| 181 | WS | /api/v1/evidence/{eid}/collaborate | Connect, receive user_joined, cursor_update, comment_added | 403 no auth, disconnect on invalid evidence_id |

---

## 2. UI RENDERING VALIDATION MATRIX

### Test Cases: Every Page Must Render

| # | Page | Route | Test Case | Expected Result | Failure Signal |
|---|------|-------|-----------|-----------------|----------------|
| R-1 | Login | /login | Navigate to login page | Form renders with email + password fields | Blank page, React error overlay |
| R-2 | EnhancedDashboard | /dashboard | Login and navigate to dashboard | Project grid renders, status filters visible | Crash, infinite spinner, undefined in UI |
| R-3 | Dashboard (Legacy) | /dashboard | Load analytics dashboard | MetricCards render with values | NaN in metrics, missing cards |
| R-4 | StudyDefinition | /projects/:id/study | Open project, go to Step 1 | Form with endpoint, estimand, phase dropdowns | Blank form, missing dropdowns |
| R-5 | StudyDAG | /projects/:id/dag | Open project DAG view | SVG canvas with nodes and edges | Empty canvas, no nodes |
| R-6 | CausalFramework | /projects/:id/causal-framework | Open Step 3 | Covariate table renders | Table crash, missing headers |
| R-7 | DataProvenance | /projects/:id/data-provenance | Open Step 4 | Data source cards render | Blank page |
| R-8 | CohortConstruction | /projects/:id/cohort | Open Step 5 | Inclusion/exclusion tables render | Empty tables without add button |
| R-9 | ComparabilityBalance | /projects/:id/comparability | Open Step 6 | Balance table with SMD columns | Missing columns, NaN in SMD |
| R-10 | EffectEstimation | /projects/:id/effect-estimation | Open Step 7 | Forest plot SVG renders | Blank SVG, axis labels missing |
| R-11 | BiasSensitivity | /projects/:id/bias-sensitivity | Open Step 8 | E-value card + sensitivity table | Missing E-value, NaN |
| R-12 | Reproducibility | /projects/:id/reproducibility | Open Step 9 | Manifest table renders | Empty with no add button |
| R-13 | AuditTrail | /projects/:id/audit | Open Step 10 | Timeline event list renders | Empty timeline, crash on date formatting |
| R-14 | RegulatoryOutput | /projects/:id/regulatory-output | Open Step 11 | SAR sections list renders | Missing sections, broken badges |
| R-15 | LiteratureSearch | /projects/:id/literature-search | Open literature search | Search bar + source toggles render | Missing search bar |
| R-16 | EvidenceReview | (within literature) | View evidence item detail | Evidence card + review form render | Crash on null abstract |
| R-17 | InputExplorer | /projects/:id/input-explorer | Open input explorer | Data source tree renders | Crash on empty sources |
| R-18 | VariableNotebook | /projects/:id/variable-notebook | Open variable notebook | Variable registry list renders | Crash on empty derivations |
| R-19 | TracePackExport | /projects/:id/trace-pack | Open trace pack | Artifact registry renders | Missing checksums |
| R-20 | UserManagement | /admin/users | Navigate to admin users | User table renders | Crash on null last_login |
| R-21 | SystemSettings | /admin/settings | Navigate to settings | Settings sections render | Missing config values |
| R-22 | AuditLogs | /admin/audit | Navigate to audit logs | Log table renders | Crash on empty logs |
| R-23 | TermsOfUse | /terms | Navigate to terms | Legal text renders | Blank page |
| R-24 | PrivacyPolicy | /privacy | Navigate to privacy | Policy text renders | Blank page |
| R-25 | AIUsePolicy | /policies/computational-methods | Navigate to AI policy | Policy text renders | Blank page |

---

## 3. USER FLOW VALIDATION

### Flow 1: Authentication

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F1-1 | Register | POST /auth/register with valid email/password | 200, user created, verification email sent | 500, no user returned |
| F1-2 | Verify email | POST /auth/verify-email with code | 200, email_verified=true | Token expired, wrong code |
| F1-3 | Login | POST /auth/login with credentials | 200, access_token + refresh_token returned | 401, no tokens |
| F1-4 | Access protected | GET /auth/me with Bearer token | 200, user data | 401 |
| F1-5 | Refresh | POST /auth/refresh with refresh_token | 200, new access_token | 401 expired |
| F1-6 | Logout | POST /auth/logout | 200, session revoked | Session still valid after |
| F1-7 | Forgot password | POST /auth/forgot-password | 200, reset email sent | 500 |
| F1-8 | Reset password | POST /auth/reset-password with reset_token | 200, password changed | Old password still works |

### Flow 2: Project Lifecycle

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F2-1 | Create project | POST /projects with title + research_intent | 200, project with id + draft status | Missing id |
| F2-2 | List projects | GET /projects | 200, new project in list | Empty list after create |
| F2-3 | Get project | GET /projects/{id} | 200, full project detail | 404 |
| F2-4 | Define study | PUT /study/definition with endpoint + estimand | 200, saved to processing_config | Data not persisted on refetch |
| F2-5 | Save covariates | PUT /study/covariates with covariate list | 200, saved | Data lost |
| F2-6 | Lock protocol | PUT /study/lock | 200, locked=true | Can still edit after lock |
| F2-7 | Generate DAG | POST /dag/generate | 200, nodes + edges returned | Empty DAG |
| F2-8 | Discover evidence | POST /discover-evidence | 202, task_id | 500, no task_id |
| F2-9 | Poll task | GET /tasks/{task_id} until completed | progress 0→100, state=completed | Stuck at running, never completes |
| F2-10 | View evidence | GET /evidence | 200, records from PubMed/CT.gov | Empty after successful discovery |
| F2-11 | Generate artifacts | POST /generate-artifact | 200, artifact created | 500 |

### Flow 3: Patient Data Upload & Analysis

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F3-1 | Get attestation | GET /ingestion/attestation | 200, HIPAA attestation text | Empty text |
| F3-2 | Record consent | POST /ingestion/consent with attestation | 200, consent_id | Missing consent_id |
| F3-3 | Upload CSV | POST /ingestion/upload with consent_id + file | 200, dataset_id + compliance_report | 400 no consent, 422 bad format |
| F3-4 | View report | GET /ingestion/reports/{rid} | 200, 8 checks with severity | Missing checks |
| F3-5 | Acknowledge warnings | POST /ingestion/reports/{rid}/acknowledge | 200, acknowledged | Still shows unacknowledged |
| F3-6 | Run analysis | POST /study/analyze-dataset | 202, task_id | 404 no dataset |
| F3-7 | Poll analysis | GET /tasks/{task_id} | progress 0→100 with phase names | Stuck, no checkpoints |
| F3-8 | View results | GET /study/analysis-results | 200, forest plot + KM + PS data | Empty after completed task |

### Flow 4: Literature Search Multi-Source

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F4-1 | Search PubMed | POST /search/pubmed with query | 200, results[] with pmid, title, abstract | Empty results, 503 |
| F4-2 | Search CT.gov | POST /search/clinical-trials with query | 200, results[] with nct_id | Empty, 503 |
| F4-3 | Search OpenAlex | POST /search/openalex with query | 200, results[] | Empty, 503 |
| F4-4 | Search Semantic Scholar | GET /search/semantic-scholar?query=... | 200, results[] | Empty, 503 |
| F4-5 | Semantic search | POST /search/semantic with query | 200, results[] with scores | Empty |
| F4-6 | Save search | POST /search/save | 200, search saved | Not in saved list after |
| F4-7 | Get saved | GET /search/saved | 200, includes saved search | Missing |

### Flow 5: Review Workflow

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F5-1 | Create workflow | POST /review/workflows | 200, workflow_id | Missing workflow_id |
| F5-2 | Assign reviewer | POST /review/assignments | 200, assignment_id | 404 user not found |
| F5-3 | Add comment | POST /review/comments | 200, comment_id | Missing comment_id |
| F5-4 | Get comments | GET /review/comments/{eid} | 200, comments[] includes new | Empty |
| F5-5 | Submit decision | POST /review/decisions | 200, decision recorded | Not reflected in decisions list |
| F5-6 | Check presence | GET /review/presence/{eid} | 200, active_users | Crash |

### Flow 6: Regulatory Submission

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F6-1 | Generate eCTD | POST /submission/ectd/generate | 200, package | 500 |
| F6-2 | Get manifest | GET /submission/ectd/manifest | 200, manifest | Empty |
| F6-3 | Validate eCTD | POST /submission/ectd/validate | 200, results | 500 |
| F6-4 | Generate Define-XML | POST /submission/define-xml/generate | 200, xml | 500 |
| F6-5 | Generate ADRG | POST /submission/adrg/generate | 200, content | 500 |
| F6-6 | Generate CSR full | POST /submission/csr/full | 200, report content | 500 |
| F6-7 | Check status | GET /submission/status | 200, status data | 500 |
| F6-8 | Download artifact | GET /artifacts/{aid}/download | 200, file binary | 404 |

### Flow 7: Admin User Management

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F7-1 | List org users | GET /org/users | 200, users[] | 401 |
| F7-2 | Invite user | POST /org/users/invite with email + role | 200, user created | 409 exists |
| F7-3 | Change role | PUT /org/users/{uid}/role | 200, role updated | 403 not admin |
| F7-4 | Deactivate | PUT /org/users/{uid}/deactivate | 200, deactivated | 404 |
| F7-5 | Activate | PUT /org/users/{uid}/activate | 200, activated | 404 |
| F7-6 | Verify deactivated user cannot login | POST /auth/login with deactivated creds | 401 or 403 | 200 (security hole) |

### Flow 8: Navigation

| # | Step | Action | Expected Result | Failure Signal |
|---|------|--------|-----------------|----------------|
| F8-1 | Dashboard to project | Click project card | Navigate to /projects/:id/study | Full page reload (using `<a>` instead of `<Link>`) |
| F8-2 | Step to step | Click sidebar step 1-11 | Navigate without losing JWT | 401 after navigation |
| F8-3 | Back button | Browser back from step 5 to step 4 | Previous step loads with data | Blank page, lost state |
| F8-4 | Direct URL | Paste /projects/:id/comparability | Page loads with data | 404, blank page |
| F8-5 | Admin nav | Click admin > users | Admin page loads | 403 for non-admin |

---

## 4. MULTI-REQUEST / MULTI-SOURCE CASES

| # | Test Case | Action | Expected Result | Failure Signal |
|---|-----------|--------|-----------------|----------------|
| M-1 | Evidence discovery uses 4 APIs | POST /discover-evidence | All 4 sources return data (PubMed, CT.gov, OpenAlex, SS) | Missing source, silent failure in one |
| M-2 | One API down during discovery | Kill PubMed, run discovery | Other 3 sources still return, PubMed gracefully empty | Entire discovery fails |
| M-3 | Circuit breaker triggers | 5 consecutive PubMed failures | Circuit breaker opens, PubMed returns empty, others work | PubMed keeps retrying, blocking |
| M-4 | Slow API | PubMed takes 25s | Other sources return first, PubMed eventually resolves | Timeout crash, infinite spinner |
| M-5 | Partial data from API | PubMed returns 10/50, CT.gov returns 50/50 | Both sets saved, counts correct | Wrong counts, duplicates |
| M-6 | Dashboard loads projects + stats | GET /projects + GET /analytics/dashboard | Both render independently | One blocks the other |
| M-7 | Study page loads multiple sections | GET /study/definition + GET /study/covariates | Both sections render | One overrides the other |
| M-8 | Concurrent saves | Two users save study/definition simultaneously | Optimistic lock handles conflict, one retries | Lost update, data corruption |

---

## 5. ASYNC / JOB / QUEUE VALIDATION

| # | Test Case | Action | Expected Result | Failure Signal |
|---|-----------|--------|-----------------|----------------|
| A-1 | Evidence discovery starts | POST /discover-evidence | 202, task_id returned immediately | Hangs waiting for completion |
| A-2 | Evidence discovery completes | Poll GET /tasks/{task_id} | state transitions: pending → running → completed, progress 0→100 | Stuck at running |
| A-3 | Analysis task starts | POST /study/analyze-dataset | 202, task_id | Hangs |
| A-4 | Analysis checkpoints | Poll task during analysis | Checkpoint phases visible: dataset_isolation → pre_analysis_validation → statistical_computation → ... | No checkpoints, progress jumps |
| A-5 | Task failure | Trigger analysis on empty dataset | state=failed, error message set | state=running forever |
| A-6 | Task cancel | POST /tasks/{task_id}/cancel | state=cancelled | Still running after cancel |
| A-7 | Duplicate task rejected | POST /study/analyze-dataset twice quickly | Second returns 200 with existing task_id | Two tasks created (double analysis) |
| A-8 | Duplicate discovery rejected | POST /discover-evidence twice | Second returns 200 with existing task_id | Two discoveries run |
| A-9 | Task survives in DB | Start task, restart server, GET /tasks/{tid} | Task found in DB with last known state | 404 after restart |
| A-10 | Orphaned task cleanup | Task running when server stops, restart | Orphaned task marked as failed | Stuck in 'running' forever |
| A-11 | Task result retrieval | GET /tasks/{tid}/result after completed | Full analysis results returned | 409 or empty |
| A-12 | Task list with history | GET /tasks?include_history=true | Includes DB-persisted historical tasks | Only in-memory tasks shown |

---

## 6. STATE CONSISTENCY

| # | Test Case | Action | Expected Result | Failure Signal |
|---|-----------|--------|-----------------|----------------|
| S-1 | Refresh page | Save study definition, refresh | Same data renders | Data lost, empty form |
| S-2 | Repeat GET | GET /projects/{id} twice | Identical response | Different data |
| S-3 | Retry POST | POST /discover-evidence with same Idempotency-Key | Same response replayed (X-Idempotency-Replayed: true) | Second discovery run |
| S-4 | New tab | Open project in new tab | Same project data | Different state |
| S-5 | Back/forward | Navigate steps 1→3→back→forward | Each step shows correct data | Wrong step data, crash |
| S-6 | Save then read | PUT /study/covariates then GET /study/covariates | Saved data returned | Old data returned |
| S-7 | Lock then edit | Lock protocol, try PUT /study/definition | 409 Conflict, cannot edit | Edit succeeds (lock bypassed) |
| S-8 | Concurrent edit | User A saves, User B saves same section | One succeeds, other gets conflict error | Both succeed (lost update) |
| S-9 | Delete then list | (If delete exists) Delete project, GET /projects | Project not in list | Still in list |
| S-10 | Upload then query | Upload patient data, GET /datasets | Dataset in list with active status | Missing from list |

---

## 7. ERROR HANDLING

### API Error Responses

| # | Test Case | Trigger | Expected Status | Expected Body | Failure Signal |
|---|-----------|---------|----------------|---------------|----------------|
| E-1 | Invalid login | Wrong password | 401 | {detail: "..."} | 200 with no token |
| E-2 | Missing auth | GET /projects without token | 401 | {detail: "Not authenticated"} | 200 or 500 |
| E-3 | Expired token | Use expired JWT | 401 | {detail: "..."} | 200 with stale data |
| E-4 | Wrong org | Access project from different org | 403 | {detail: "..."} | 200 returns data (leak) |
| E-5 | Not found | GET /projects/nonexistent-id | 404 | {detail: "..."} | 500 or crash |
| E-6 | Validation error | POST /projects with empty title | 422 | {detail: [{field, message}]} | 500 or 200 |
| E-7 | Rate limit | 6 login attempts in 60s | 429 | Retry-After header | 200 on 6th attempt |
| E-8 | File too large | Upload 200MB file | 413 | {detail: "..."} | Server OOM crash |
| E-9 | Wrong file type | Upload .exe as patient data | 422 or 415 | {detail: "..."} | File accepted |
| E-10 | DB down | Kill DB, any request | 500 | {detail: "..."} | Hang, no response |
| E-11 | Malformed JSON body | POST with invalid JSON | 422 | {detail: "..."} | 500 |
| E-12 | SQL injection attempt | project_id = "'; DROP TABLE--" | 404 or 422 | Not found / validation | Data deleted (critical) |

### UI Error Rendering

| # | Test Case | Trigger | Expected UI | Failure Signal |
|---|-----------|---------|-------------|----------------|
| E-13 | API 500 on dashboard | Mock 500 from /projects | Error banner + retry button | Blank page, crash |
| E-14 | API 500 on study step | Mock 500 from /study/definition | Error banner + retry button | Infinite spinner |
| E-15 | Network offline | Disconnect network | Error message shown | Blank page, crash |
| E-16 | API timeout | Mock 30s delay | Loading indicator, eventually error | Infinite spinner |
| E-17 | 404 project | Navigate to nonexistent project | "Project not found" message | Crash, blank page |
| E-18 | Unauthorized page | Non-admin visits /admin/users | 403 or redirect to dashboard | Admin page renders (security) |
| E-19 | Null data in response | API returns null for required field | Graceful empty state, no crash | "undefined" or "null" text in UI |
| E-20 | Empty array | API returns empty evidence list | "No evidence found" message | Blank table with no message |

---

## 8. PERFORMANCE SANITY

| # | Test Case | Action | Expected Result | Failure Signal |
|---|-----------|--------|-----------------|----------------|
| P-1 | Slow API renders | Mock 5s delay on /projects | Loading spinner shows, then data | No spinner, blank page for 5s |
| P-2 | Loading indicators | Navigate to any page | Spinner visible during fetch | Content flashes/jumps |
| P-3 | No infinite spinner | API returns error after 10s | Spinner stops, error shown | Spinner never stops |
| P-4 | Large evidence list | 200+ evidence records | Paginated, no browser freeze | Browser hangs, scroll lag |
| P-5 | Large patient dataset | Upload 50MB CSV | Upload completes, chunked reading | Browser crash, OOM |
| P-6 | Forest plot with many rows | 50+ analysis rows | SVG renders, scrollable | SVG overflow, clipping |
| P-7 | Rapid navigation | Click steps 1→3→5→7→9 quickly | Each step loads correctly | Stale data from wrong step |
| P-8 | Background task progress | Poll analysis task every 2s | Smooth progress bar updates | Jerky updates, NaN progress |
| P-9 | Multiple concurrent requests | Dashboard loads 3 APIs simultaneously | All resolve independently | One blocks another |
| P-10 | WebSocket connection | Open collaborative review | WS connects, cursor updates flow | Connection refused, no updates |

---

## 9. CHAOS FUNCTIONAL TEST

### 10 Ways a Real User Could Break Functionality

| # | Chaos Scenario | Steps | Expected Behavior | Failure Signal |
|---|---------------|-------|-------------------|----------------|
| C-1 | **Double-click submit** | Double-click "Save" on study definition | Only one save executes, no duplicate | Two saves fire, data corrupted, double toast |
| C-2 | **Spam-click discover** | Click "Discover Evidence" 5 times in 2s | First request accepted, rest return existing task_id (dedup) | 5 discovery tasks created, duplicate evidence |
| C-3 | **Refresh mid-request** | Start analysis, refresh page at 40% | Task continues in background, re-poll shows progress | Task orphaned, stuck at 40%, new task starts |
| C-4 | **Open multiple tabs** | Open same project in 3 tabs, edit step 1 in each | All tabs save independently, optimistic lock prevents lost-update | Silent data loss from last-writer-wins |
| C-5 | **Change filters quickly** | Type search query character by character rapidly | Only final query executes (debounce), results match final query | Results for intermediate query displayed, race condition |
| C-6 | **Cancel mid-flight** | Start evidence discovery, cancel at 50% | Task cancelled, partial results committed, status=cancelled | Task continues running, cancel ignored |
| C-7 | **Network drop during upload** | Upload 10MB CSV, kill network at 5MB | Error message shown, upload can be retried | Partial file stored, corrupted dataset |
| C-8 | **Partial API response** | PubMed returns 10 results, then connection drops | 10 results saved, other sources continue | All results lost, error shown |
| C-9 | **Expired auth during workflow** | Start 10-step workflow, token expires at step 5 | Token auto-refreshes, or shows login prompt | Silent 401s, data not saving, user doesn't know |
| C-10 | **Stale tab after server restart** | Leave tab open, restart backend, click save | Request succeeds after reconnection, or clear error | Infinite spinner, silent failure, stale cached response |

### Detailed Test Cases

**C-1: Double-click submit**
```
1. Open StudyDefinition page
2. Fill in endpoint field
3. Double-click "Save" button rapidly
4. Check: only 1 PUT request sent (button disabled during save)
5. Check: processing_config updated once
6. Check: only 1 success toast shown
PASS: Single save, single toast
FAIL: Two PUTs, data overwritten, two toasts
```

**C-2: Spam-click discover evidence**
```
1. Open project with research_intent set
2. Click "Discover Evidence" 5 times in 2 seconds
3. Check: only 1 background task created
4. Check: clicks 2-5 return same task_id
5. Check: evidence records not duplicated
PASS: Single task, dedup returns existing task_id
FAIL: 5 tasks running, 5x evidence records
```

**C-3: Refresh mid-analysis**
```
1. POST /study/analyze-dataset → get task_id
2. Poll until progress=40%
3. Refresh browser page
4. Navigate back to analysis page
5. Check: task_id still polling, progress continues from 40%+
PASS: Task continues, UI reconnects to same task
FAIL: Task orphaned, new task needed, lost work
```

**C-5: Rapid filter changes**
```
1. Open LiteratureSearch page
2. Type "c" → "ca" → "can" → "canc" → "cance" → "cancer" rapidly
3. Check: only "cancer" query sent to API (debounce)
4. Check: results shown are for "cancer", not "ca"
PASS: Debounced, final results correct
FAIL: Results for "ca" shown, then flash to "cancer"
```

**C-9: Expired auth during workflow**
```
1. Login (get access_token with 30min expiry)
2. Work through steps 1-4 (20 minutes)
3. Wait 10 more minutes (token expires)
4. Click Save on step 5
5. Check: refresh_token used to get new access_token automatically
6. Check: save succeeds without user intervention
PASS: Silent token refresh, save works
FAIL: 401 error, data lost, must re-login
```

---

## 10. UI STATE RENDERING MATRIX

Every page must correctly render these 9 states:

### State Definitions

| State | Description | Trigger |
|-------|-------------|---------|
| **loading** | Initial data fetch in progress | Page mount, first API call |
| **empty** | API succeeded but returned no data | New project, no evidence |
| **error** | API returned error status | 500, network error, timeout |
| **partial data** | Some fields null/missing in response | Incomplete project config |
| **full data** | All data present and valid | Complete project with evidence |
| **slow data** | API takes >3s to respond | Slow network, large dataset |
| **retry state** | After error, retry button visible and functional | After error, before retry |
| **unauthorized** | User lacks permission for this page/action | Wrong role, expired token |
| **not found** | Resource does not exist | Invalid project_id in URL |

### Per-Page State Matrix

| Page | loading | empty | error | partial | full | slow | retry | unauth | not found |
|------|---------|-------|-------|---------|------|------|-------|--------|-----------|
| EnhancedDashboard | Spinner over project grid | "No projects yet" + Create button | Error banner + retry button | Projects without descriptions | Full project cards | Spinner >3s visible | Retry reloads projects | Redirect to login | N/A |
| StudyDefinition | Spinner in form area | Empty form with defaults | Error alert + refetch | Some fields empty | All fields populated | Spinner >3s | Refetch button | 401 redirect | "Project not found" |
| StudyDAG | Spinner over canvas | "No DAG configured" | Error alert + retry | Partial nodes missing edges | Full graph | Spinner >3s | Retry loads DAG | 401 redirect | "Project not found" |
| CausalFramework | Spinner over table | Empty table + "Add covariate" | Error alert + retry | Covariates without type | Full covariate table | Spinner >3s | Retry reloads | 401 redirect | "Project not found" |
| DataProvenance | Spinner | "No data sources" + Add | Error + retry | Sources without coverage | Full source cards | Spinner >3s | Retry | 401 redirect | "Project not found" |
| CohortConstruction | Spinner | Empty inclusion/exclusion | Error + retry | Inclusion only, no exclusion | Full criteria + funnel | Spinner >3s | Retry | 401 redirect | "Project not found" |
| ComparabilityBalance | Spinner | "No balance data" | Error + retry | Some covariates missing SMD | Full balance table | Spinner >3s | Retry | 401 redirect | "Project not found" |
| EffectEstimation | Spinner | "Run analysis first" | Error + retry | Forest plot missing rows | Full forest plot | Spinner >3s | Retry | 401 redirect | "Project not found" |
| BiasSensitivity | Spinner | "No bias analysis" | Error + retry | E-value without CI | Full E-value + table | Spinner >3s | Retry | 401 redirect | "Project not found" |
| Reproducibility | Spinner | Empty manifest | Error + retry | Manifest without hashes | Full manifest | Spinner >3s | Retry | 401 redirect | "Project not found" |
| AuditTrail | Spinner | Empty timeline | Error + retry | Events without user | Full timeline | Spinner >3s | Retry | 401 redirect | "Project not found" |
| RegulatoryOutput | Spinner | All sections pending | Error + retry | Some sections complete | All sections complete | Spinner >3s | Retry | 401 redirect | "Project not found" |
| LiteratureSearch | N/A (pre-search) | "Enter a query" | Per-source error msg | Some sources failed | All sources returned | Per-source spinner | Per-source retry | 401 redirect | N/A |
| InputExplorer | Spinner | "No data sources" | Error + retry | Sources without fields | Full tree | Spinner >3s | Retry | 401 redirect | "Project not found" |
| VariableNotebook | Spinner | "No variables" | Error + retry | Variables without derivations | Full variable detail | Spinner >3s | Retry | 401 redirect | "Project not found" |
| TracePackExport | Spinner | "No artifacts" | Error + retry | Missing checksums | Full artifact list | Spinner >3s | Retry | 401 redirect | "Project not found" |
| UserManagement | Spinner | "No users" | Error + retry | Users without last_login | Full user table | Spinner >3s | Retry | 403 not admin | N/A |
| SystemSettings | Spinner | Defaults loaded | Error + retry | Partial settings | All settings | Spinner >3s | Retry | 403 not admin | N/A |
| AuditLogs | Spinner | "No logs" or demo data | Error + retry | Logs without details | Full log table | Spinner >3s | Retry | 403 not admin | N/A |

### Critical Render Checks

| # | Check | Test | Expected | Failure Signal |
|---|-------|------|----------|----------------|
| UI-1 | No "undefined" in UI | Render every page with partial data | No text "undefined" visible | "undefined" shows as text |
| UI-2 | No "null" in UI | Render every page with null fields | No text "null" visible | "null" shows as text |
| UI-3 | No "NaN" in UI | Render balance/forest plot with missing numbers | "—" or empty, not "NaN" | "NaN" in metrics |
| UI-4 | No "[object Object]" | Render every page | No raw object serialization | "[object Object]" in text |
| UI-5 | No blank page | Navigate to every route | Content or error message | White page, no content |
| UI-6 | No infinite spinner | Wait 30s on any page | Spinner resolves to data or error | Spinner never stops |
| UI-7 | No console errors | Open console, navigate all pages | Zero React errors, zero undefined access | Red console errors |
| UI-8 | No broken images | Check all icon/image references | All render or graceful fallback | Broken image icon |
| UI-9 | No overlapping text | Check all pages at 1280px, 1920px | Text readable, no overlap | Text clipped or overlapping |
| UI-10 | No broken buttons | Click every button on every page | Action fires or disabled state | Button does nothing, no feedback |

---

## APPENDIX A: ENDPOINT VALIDATION CHECKLIST (Quick Reference)

```
AUTHENTICATION (11 endpoints)
[ ] POST /auth/login                         → 200 + tokens
[ ] GET  /auth/me                            → 200 + user
[ ] POST /auth/logout                        → 200
[ ] POST /auth/revoke-all-sessions           → 200
[ ] POST /auth/forgot-password               → 200
[ ] POST /auth/verify-reset-code             → 200
[ ] POST /auth/reset-password                → 200
[ ] POST /auth/refresh                       → 200 + new token
[ ] POST /auth/register                      → 200 + user
[ ] POST /auth/verify-email                  → 200
[ ] POST /auth/resend-verification           → 200

HEALTH (3 endpoints)
[ ] GET  /health                             → 200
[ ] GET  /health/detailed                    → 200
[ ] GET  /api/v1/health/circuit-breakers     → 200

TASKS (4 endpoints)
[ ] GET  /tasks                              → 200
[ ] GET  /tasks/{id}                         → 200 + checkpoints
[ ] GET  /tasks/{id}/result                  → 200
[ ] POST /tasks/{id}/cancel                  → 200

PROJECTS (7 endpoints)
[ ] POST /projects                           → 200
[ ] GET  /projects                           → 200 + pagination
[ ] GET  /projects/{id}                      → 200
[ ] GET  /projects/{id}/dag                  → 200
[ ] POST /projects/{id}/dag/generate         → 200
[ ] PATCH /projects/{id}/dag/nodes/{k}/status → 200
[ ] POST /projects/{id}/upload               → 200

EVIDENCE (12 endpoints)
[ ] POST /projects/{id}/discover-evidence    → 202
[ ] GET  /projects/{id}/evidence             → 200
[ ] GET  /projects/{id}/evidence/network     → 200
[ ] POST /projects/{id}/generate-anchors     → 200
[ ] GET  /projects/{id}/comparability-scores → 200
[ ] POST /projects/{id}/analyze-bias         → 200
[ ] GET  /projects/{id}/bias-analysis        → 200
[ ] POST /projects/{id}/generate-critique    → 200
[ ] POST /projects/{id}/evidence/{eid}/decision → 200
[ ] GET  /projects/{id}/decisions            → 200
[ ] POST /projects/{id}/generate-artifact    → 200
[ ] GET  /projects/{id}/artifacts            → 200

STUDY WORKFLOW (22 endpoints)
[ ] GET  /projects/{id}/study/definition     → 200
[ ] PUT  /projects/{id}/study/definition     → 200
[ ] PUT  /projects/{id}/study/lock           → 200
[ ] GET  /projects/{id}/study/covariates     → 200
[ ] PUT  /projects/{id}/study/covariates     → 200
[ ] GET  /projects/{id}/study/data-sources   → 200
[ ] PUT  /projects/{id}/study/data-sources   → 200
[ ] GET  /projects/{id}/study/cohort         → 200
[ ] PUT  /projects/{id}/study/cohort         → 200
[ ] POST /projects/{id}/study/cohort/run     → 200
[ ] GET  /projects/{id}/study/balance        → 200
[ ] POST /projects/{id}/study/balance/compute → 200
[ ] GET  /projects/{id}/study/results/forest-plot → 200
[ ] GET  /projects/{id}/study/bias           → 200
[ ] POST /projects/{id}/study/bias/run       → 200
[ ] GET  /projects/{id}/study/reproducibility → 200
[ ] PUT  /projects/{id}/study/reproducibility → 200
[ ] GET  /projects/{id}/study/audit          → 200
[ ] GET  /projects/{id}/study/audit/export   → 200
[ ] GET  /projects/{id}/study/regulatory     → 200
[ ] POST /projects/{id}/study/regulatory/generate → 200
[ ] GET  /projects/{id}/study/regulatory/download/{aid} → 200

COMPARABILITY PROTOCOL (3 endpoints)
[ ] GET  /projects/{id}/study/comparability-protocol → 200
[ ] POST /projects/{id}/study/comparability-protocol → 200
[ ] PUT  /projects/{id}/study/comparability-protocol/lock → 200

ADVANCED ANALYSIS (13 endpoints)
[ ] POST /projects/{id}/study/sap/generate   → 200
[ ] POST /projects/{id}/study/feasibility-assessment → 200
[ ] POST /projects/{id}/study/evidence-package → 200
[ ] POST /projects/{id}/study/missing-data/impute → 200
[ ] POST /projects/{id}/study/missing-data/tipping → 200
[ ] POST /projects/{id}/study/missing-data/mmrm → 200
[ ] GET  /projects/{id}/study/missing-data/summary → 200
[ ] POST /projects/{id}/study/bayesian/analyze → 200
[ ] POST /projects/{id}/study/bayesian/prior-elicitation → 200
[ ] POST /projects/{id}/study/bayesian/adaptive → 200
[ ] POST /projects/{id}/study/interim/boundaries → 200
[ ] POST /projects/{id}/study/interim/evaluate → 200
[ ] POST /projects/{id}/study/interim/dsmb-report → 200

TFL (7 endpoints)
[ ] POST /projects/{id}/study/tfl/demographics → 200
[ ] POST /projects/{id}/study/tfl/ae-table   → 200
[ ] POST /projects/{id}/study/tfl/km-curve   → 200
[ ] POST /projects/{id}/study/tfl/forest-plot → 200
[ ] POST /projects/{id}/study/tfl/love-plot  → 200
[ ] GET  /projects/{id}/study/tfl/shells     → 200
[ ] POST /projects/{id}/study/tfl/generate-all → 200

ADAM & SDTM (8 endpoints)
[ ] POST /projects/{id}/adam/generate/{type}  → 200
[ ] GET  /projects/{id}/adam/datasets         → 200
[ ] POST /projects/{id}/adam/validate         → 200
[ ] GET  /projects/{id}/adam/metadata         → 200
[ ] POST /projects/{id}/sdtm/generate/{domain} → 200
[ ] POST /projects/{id}/sdtm/generate-all    → 200
[ ] POST /projects/{id}/sdtm/validate        → 200
[ ] GET  /projects/{id}/sdtm/acrf            → 200

SUBMISSION (13 endpoints)
[ ] POST /projects/{id}/submission/ectd/generate → 200
[ ] GET  /projects/{id}/submission/ectd/manifest → 200
[ ] POST /projects/{id}/submission/ectd/validate → 200
[ ] POST /projects/{id}/submission/define-xml/generate → 200
[ ] POST /projects/{id}/submission/define-xml/validate → 200
[ ] POST /projects/{id}/submission/adrg/generate → 200
[ ] POST /projects/{id}/submission/csr/synopsis → 200
[ ] POST /projects/{id}/submission/csr/section-11 → 200
[ ] POST /projects/{id}/submission/csr/section-12 → 200
[ ] POST /projects/{id}/submission/csr/appendix-16 → 200
[ ] POST /projects/{id}/submission/csr/full   → 200
[ ] GET  /projects/{id}/submission/status     → 200
[ ] POST /projects/{id}/submission/evidence-package → 200

SEARCH (13 endpoints)
[ ] POST /search/semantic                    → 200
[ ] POST /search/hybrid                      → 200
[ ] GET  /search/recommendations/{eid}       → 200
[ ] POST /search/save                        → 200
[ ] GET  /search/saved                       → 200
[ ] POST /search/citation-network            → 200
[ ] POST /search/pubmed                      → 200
[ ] POST /search/clinical-trials             → 200
[ ] POST /search/openalex                    → 200
[ ] GET  /search/semantic-scholar             → 200
[ ] GET  /search/semantic-scholar/paper/{pid} → 200
[ ] POST /search/semantic-scholar/recommendations → 200
[ ] POST /search/rare-disease-evidence       → 200

REVIEW (10 endpoints)
[ ] POST /review/workflows                   → 200
[ ] POST /review/assignments                 → 200
[ ] GET  /review/assignments                 → 200
[ ] POST /review/comments                    → 200
[ ] GET  /review/comments/{eid}              → 200
[ ] POST /review/decisions                   → 200
[ ] POST /review/conflicts/resolve           → 200
[ ] GET  /review/presence/{eid}              → 200
[ ] POST /review/presence/{eid}              → 200
[ ] GET  /workflows/{wid}/progress           → 200

SAR PIPELINE (5 endpoints)
[ ] POST /sar-pipeline/init                  → 200
[ ] GET  /sar-pipeline/{id}/status           → 200
[ ] POST /sar-pipeline/{id}/run-stage        → 200
[ ] GET  /sar-pipeline/{id}/results          → 200
[ ] GET  /sar-pipeline/{id}/report           → 200

INGESTION (7 endpoints)
[ ] POST /projects/{id}/ingestion/consent    → 200
[ ] POST /projects/{id}/ingestion/upload     → 200
[ ] GET  /projects/{id}/ingestion/reports    → 200
[ ] GET  /projects/{id}/ingestion/reports/{rid} → 200
[ ] POST /projects/{id}/ingestion/reports/{rid}/acknowledge → 200
[ ] GET  /projects/{id}/ingestion/datasets   → 200
[ ] GET  /ingestion/attestation              → 200

DATASET ANALYSIS (5 endpoints)
[ ] POST /projects/{id}/study/analyze-dataset → 202
[ ] GET  /projects/{id}/datasets             → 200
[ ] GET  /projects/{id}/study/analysis-results → 200
[ ] GET  /projects/{id}/study/validation-report → 200
[ ] GET  /projects/{id}/study/dataset-info   → 200

USER & ORG (9 endpoints)
[ ] GET  /users/me                           → 200
[ ] GET  /users                              → 200
[ ] POST /user/{uid}/workflow/optimize       → 200
[ ] GET  /org/info                           → 200
[ ] GET  /org/users                          → 200
[ ] POST /org/users/invite                   → 200
[ ] PUT  /org/users/{uid}/role               → 200
[ ] PUT  /org/users/{uid}/deactivate         → 200
[ ] PUT  /org/users/{uid}/activate           → 200

AI & BIOGPT (5 endpoints)
[ ] GET  /biogpt/status                      → 200
[ ] POST /biogpt/generate                    → 200
[ ] POST /biogpt/explain-mechanism           → 200
[ ] POST /biogpt/summarize                   → 200
[ ] POST /projects/{id}/ai/comprehensive-analysis → 200

SYSTEM (8 endpoints)
[ ] GET  /system/storage-stats               → 200
[ ] GET  /system/cache-stats                 → 200
[ ] GET  /system/metrics                     → 200
[ ] GET  /system/health/detailed             → 200
[ ] GET  /analytics/dashboard                → 200
[ ] GET  /statistics/full-analysis           → 200
[ ] GET  /statistics/summary                 → 200
[ ] GET  /audit/logs                         → 200

MISC (13 endpoints)
[ ] POST /data/classify                      → 200
[ ] GET  /artifacts/{aid}/download           → 200
[ ] POST /projects/{id}/security/threat-detection → 200
[ ] POST /projects/{id}/retention/decide     → 200
[ ] POST /reference-populations              → 200
[ ] GET  /reference-populations              → 200
[ ] POST /projects/{id}/study/compare-to-reference/{rid} → 200
[ ] GET  /program/overview                   → 200
[ ] GET  /program/portfolio                  → 200
[ ] GET  /program/{id}/readiness             → 200
[ ] GET  /program/{id}/milestones            → 200
[ ] GET  /federated/nodes                    → 200
[ ] GET  /evidence-patterns                  → 200
[ ] GET  /projects/{id}/workflow/guidance     → 200
[ ] POST /projects/{id}/workflow/execute-step → 200

WEBSOCKET (1 endpoint)
[ ] WS   /evidence/{eid}/collaborate         → connect + messages

TOTAL: 181 endpoints (180 REST + 1 WebSocket)
```

---

## APPENDIX B: UI PAGE RENDERING CHECKLIST

```
DASHBOARD & LANDING
[ ] EnhancedDashboard       /dashboard
[ ] Dashboard (Legacy)      /dashboard

WORKFLOW STEPS (11 pages)
[ ] StudyDefinition          /projects/:id/study
[ ] StudyDAG                 /projects/:id/dag
[ ] CausalFramework          /projects/:id/causal-framework
[ ] DataProvenance           /projects/:id/data-provenance
[ ] CohortConstruction       /projects/:id/cohort
[ ] ComparabilityBalance     /projects/:id/comparability
[ ] EffectEstimation         /projects/:id/effect-estimation
[ ] BiasSensitivity          /projects/:id/bias-sensitivity
[ ] Reproducibility          /projects/:id/reproducibility
[ ] AuditTrail               /projects/:id/audit
[ ] RegulatoryOutput         /projects/:id/regulatory-output

LITERATURE & EVIDENCE
[ ] LiteratureSearch         /projects/:id/literature-search
[ ] EvidenceReview           (within literature context)

ANALYSIS LINEAGE
[ ] InputExplorer            /projects/:id/input-explorer
[ ] VariableNotebook         /projects/:id/variable-notebook
[ ] TracePackExport          /projects/:id/trace-pack

ADMIN
[ ] UserManagement           /admin/users
[ ] SystemSettings           /admin/settings
[ ] AuditLogs                /admin/audit

LEGAL
[ ] TermsOfUse               /terms
[ ] PrivacyPolicy            /privacy
[ ] AIUsePolicy              /policies/computational-methods

TOTAL: 25 routed pages
```

---

## APPENDIX C: CRITICAL PATH SMOKE TEST (10 minutes)

If you can only run 10 tests, run these:

```
1. [ ] POST /auth/login → 200 with tokens
2. [ ] GET  /projects → 200 with project list
3. [ ] POST /projects → 200 creates project
4. [ ] GET  /projects/{id} → 200 project detail
5. [ ] PUT  /projects/{id}/study/definition → 200 saves data
6. [ ] GET  /projects/{id}/study/definition → 200 returns saved data
7. [ ] POST /projects/{id}/discover-evidence → 202 with task_id
8. [ ] GET  /tasks/{task_id} → 200 with progress
9. [ ] Dashboard renders without crash
10. [ ] StudyDefinition renders with form fields
```

---

**END OF TEST PLAN**
**Total Test Cases: 300+**
**Total Endpoints: 181**
**Total UI Pages: 25**
**Total User Flows: 8**
**Total Chaos Scenarios: 10**
