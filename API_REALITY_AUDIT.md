# API Reality Audit — Afarensis Enterprise v2.1

**Date:** 2026-03-28
**Auditor:** Claude (Senior QA / Backend Test Architect / Product Auditor)
**Scope:** Full backend API, service layer, frontend integration, database models

---

## 1. Executive Summary

### Verdict: PARTIALLY REAL — Production-Capable Core with Significant Gaps

The Afarensis Enterprise platform has a **real, functional core** covering authentication, project management, patient data ingestion, statistical analysis, and regulatory artifact generation. However, the audit uncovered:

- **7 stub/hardcoded endpoints** that return fake task IDs or empty arrays
- **11 missing backend endpoints** that the frontend tries to call (will 404)
- **12 double-prefixed API calls** in 2 frontend components (all broken)
- **1 HTTP method mismatch** (frontend PUT vs backend PATCH)
- **30+ silent error-swallowing patterns** that mask failures as success
- **4 SQLAlchemy ORM bugs** (`not` vs `~` operator) affecting auth flows
- **10+ schema-model mismatches** (dead Pydantic schemas)
- **23 database tables** never populated by seed data
- **2 pages** rendering hardcoded fake data with no user indication
- **1 unauthenticated WebSocket** endpoint (security issue)

### What Is Production-Real
- Authentication (login, register, password reset, token rotation)
- Project CRUD with multi-tenancy
- Patient data ingestion with regulatory checks
- Statistical analysis pipeline (MI, tipping point, MMRM, Bayesian, DSMB)
- Evidence discovery (PubMed, ClinicalTrials.gov, OpenAlex, Semantic Scholar)
- Study workflow (definition, covariates, cohort, balance, effect estimation)
- Regulatory artifact generation (eCTD, Define-XML, ADRG, CSR)
- Audit logging
- DAG management

### What Is Demo/Theater
- Federated network (hardcoded empty array)
- Evidence patterns (hardcoded empty array)
- Anchor candidate generation (stub)
- Bias analysis trigger (stub, but read endpoint is real)
- Evidence critique generation (stub)
- SAR pipeline init/run-stage (stubs)
- EvidencePatterns.tsx page (entirely hardcoded frontend data)
- FederatedNetwork.tsx page (hardcoded mock nodes)
- Dashboard system health metrics (hardcoded)

### CRITICAL: Fabricated Data in Document Generators
- `document_generator.py` contains **5 fabricated PubMed IDs** (PMID:34521901, etc.) with invented authors/journals used as defaults in regulatory document generation
- **Inconsistent XY-301 data across files**: `document_generator.py` says HR=0.82, `csr_generator.py` says HR=0.72 — conflicting results would appear in documents
- `enhanced_ai.py` has **8 fully mocked functions** that return hardcoded values regardless of input (e.g., always returns sample_size=245, primary_endpoint="overall survival")
- `additional.py` ComparabilityService uses hardcoded baselines (0.70, 0.65) instead of real computation

### Service Layer Reality Breakdown
| Category | Count | Examples |
|---|---|---|
| Fully Real (genuine computation) | 15 files | statistical_models.py, bayesian_methods.py, regulatory_attack.py, ingestion_service.py |
| Simulation/Random data | 4 files | adam_service.py, sdtm_service.py, tfl_generator.py, statistical_models.py (fallback) |
| Hardcoded XY-301 defaults | 7 files | document_generator.py, csr_generator.py, tfl_generator.py, adrg_generator.py, etc. |
| Fully mocked functions | 8 functions | enhanced_ai.py extractors, regulatory context engine |
| Stub methods | 13 methods | citation network (6), notification (5), search_evidence, workflow prefs |

---

## 2. API Inventory — 120 Endpoints

### Status Legend
- ✅ REAL — Performs actual computation, reads/writes DB, calls external APIs
- ⚠️ PARTIAL — Real data path but with hardcoded fallbacks or silent error masking
- 🔴 STUB — Returns canned/fake response, no real work done
- 💀 BROKEN — Frontend calls endpoint that doesn't exist or uses wrong method

### Auth (11 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 1 | POST | /auth/login | ✅ | Rate limited, bcrypt verified |
| 2 | GET | /auth/me | ⚠️ | `is_active: True` hardcoded |
| 3 | POST | /auth/logout | ⚠️ | No server-side invalidation |
| 4 | POST | /auth/revoke-all-sessions | ⚠️ | **BUG:** `not SessionToken.is_revoked` uses Python not, not SQL |
| 5 | POST | /auth/forgot-password | ⚠️ | Email failures silently swallowed |
| 6 | POST | /auth/verify-reset-code | ⚠️ | **BUG:** Same `not` operator issue |
| 7 | POST | /auth/reset-password | ⚠️ | **BUG:** Same `not` operator issue |
| 8 | POST | /auth/refresh | ✅ | Token rotation with reuse detection |
| 9 | POST | /auth/register | ✅ | Full flow with email verification |
| 10 | POST | /auth/verify-email | ⚠️ | **BUG:** `not EmailVerificationToken.used` |
| 11 | POST | /auth/resend-verification | ✅ | |

### Projects (6 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 12 | POST | /projects | ✅ | Full CRUD with audit logging |
| 13 | GET | /projects | ✅ | Paginated, cached, multi-tenant |
| 14 | GET | /projects/{id} | ✅ | With evidence/review counts |
| 15 | PATCH | /projects/{id} | 💀 | Frontend sends PUT, backend expects PATCH |
| 16 | DELETE | /projects/{id} | ✅ | Cascading delete |
| 17 | GET | /debug/projects-error | ✅ | Temporary diagnostic |

### DAG (3 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 18 | GET | /projects/{id}/dag | ✅ | Auto-generates if empty |
| 19 | POST | /projects/{id}/dag/generate | ✅ | |
| 20 | PATCH | /projects/{id}/dag/nodes/{key}/status | ✅ | |

### Evidence Discovery (3 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 21 | POST | /projects/{id}/upload | ✅ | Protocol document |
| 22 | POST | /projects/{id}/discover-evidence | ✅ | Real PubMed/CT.gov/OpenAlex calls; per-source failures silently swallowed |
| 23 | GET | /projects/{id}/evidence | ✅ | Paginated |

### Anchor & Comparability (2 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 24 | POST | /projects/{id}/generate-anchors | 🔴 | Returns fake task_id |
| 25 | GET | /projects/{id}/comparability-scores | ✅ | |

### Bias & Critique (4 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 26 | POST | /projects/{id}/analyze-bias | 🔴 | Returns fake task_id |
| 27 | GET | /projects/{id}/bias-analysis | ✅ | |
| 28 | POST | /projects/{id}/generate-critique | 🔴 | Returns fake critique_id |
| 29 | POST | /projects/{id}/evidence/{eid}/decision | ✅ | |
| 30 | GET | /projects/{id}/decisions | ✅ | |

### Regulatory Artifacts (3 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 31 | POST | /projects/{id}/generate-artifact | ✅ | Falls back to simulation for stats |
| 32 | GET | /artifacts/{id}/download | ✅ | |
| 33 | GET | /projects/{id}/artifacts | ✅ | |

### Federated & Patterns (2 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 34 | GET | /federated/nodes | 🔴 | Returns `{"nodes": [], "status": "beta"}` |
| 35 | GET | /evidence-patterns | 🔴 | Returns `{"patterns": [], "status": "beta"}` |

### SAR Pipeline (5 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 36 | POST | /sar-pipeline/init | 🔴 | Returns fake pipeline_id |
| 37 | GET | /sar-pipeline/{id}/status | ✅ | Computed from processing_config |
| 38 | POST | /sar-pipeline/{id}/run-stage | 🔴 | Returns "queued" with hardcoded duration |
| 39 | GET | /sar-pipeline/{id}/results | ⚠️ | Real but falls back to simulation |
| 40 | GET | /sar-pipeline/{id}/report | ✅ | |

### Search (13 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 41-46 | Various | /search/* | ⚠️ | All have silent error swallowing |
| 47-48 | POST | /search/pubmed, /search/clinical-trials | ✅ | Real external API calls |
| 49 | POST | /search/openalex | ✅ | Real external API |
| 50-53 | Various | /search/semantic-scholar/* | ✅ | Real external API |

### Collaborative Review (10 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 54-63 | Various | /review/* | ⚠️ | All have silent error swallowing; frontend double-prefixes all calls |

### Study Workflow (40+ endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 64-103 | Various | /projects/{id}/study/* | ✅ | Core workflow is real |

### Patient Data Ingestion (8 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 104-111 | Various | /projects/{id}/ingestion/* | ✅ | Full regulatory compliance pipeline |

### Submission (13 endpoints)
| # | Method | Path | Status | Notes |
|---|--------|------|--------|-------|
| 112-124 | Various | /projects/{id}/submission/* | ✅ | eCTD, Define-XML, ADRG, CSR |

---

## 3. Critical Bugs Found

### BUG-001: SQLAlchemy `not` vs `~` operator (4 locations)
**Severity:** HIGH — Auth flows affected
**Files:** `backend/app/api/routes.py` lines 325, 449, 500, 787
**Problem:** `not SessionToken.is_revoked` evaluates Python's `not` on a SQLAlchemy column object, producing a constant `False` boolean instead of a SQL `WHERE NOT is_revoked` clause.
**Impact:** Token revocation queries filter incorrectly — may revoke already-revoked tokens or miss active ones.
**Fix:** Replace `not X` with `X == False` or `~X` or `X.is_(False)`.

### BUG-002: Frontend double-prefix in CollaborativeReview.tsx (6 calls)
**Severity:** HIGH — All collaborative review API calls fail with 404
**File:** `frontend/src/components/CollaborativeReview.tsx`
**Problem:** Passes `/api/v1/review/...` to `apiClient.request()` which prepends `/api/v1`, resulting in `/api/v1/api/v1/review/...`.
**Fix:** Remove `/api/v1` prefix from all paths in this component.

### BUG-003: Frontend double-prefix in AdvancedSearch.tsx (6 calls)
**Severity:** HIGH — All advanced search API calls fail with 404
**File:** `frontend/src/components/AdvancedSearch.tsx`
**Problem:** Same double-prefix issue.
**Fix:** Remove `/api/v1` prefix from all paths.

### BUG-004: HTTP method mismatch — updateProject
**Severity:** MEDIUM — Project updates fail with 405
**File:** `frontend/src/services/hooks.ts` or `apiClient.ts`
**Problem:** Frontend sends PUT but backend route is PATCH.
**Fix:** Change frontend to use PATCH, or add PUT route on backend.

### BUG-005: Unauthenticated WebSocket
**Severity:** HIGH — Security vulnerability
**File:** `backend/app/api/routes.py` line 2561
**Problem:** WebSocket `/evidence/{id}/collaborate` has no authentication.
**Fix:** Add token verification on WebSocket connect.

### BUG-006: Temporary password in HTTP response
**Severity:** MEDIUM — Security concern
**File:** `backend/app/api/routes.py` line 7455
**Problem:** `/org/users/invite` returns plaintext temporary password.
**Fix:** Send password only via email, not in response body.

---

## 4. Missing Backend Endpoints (Frontend expects, backend doesn't have)

| Frontend Call | Expected Path | Status |
|---|---|---|
| useEvidence | GET /evidence/{id} | MISSING — only project-scoped |
| useEvidenceList | GET /evidence?... | MISSING |
| updateEvidence | PUT /evidence/{id} | MISSING |
| deleteEvidence | DELETE /evidence/{id} | MISSING |
| aiSummary | POST /evidence/{id}/ai-summary | MISSING |
| useReviews | GET /reviews?... | MISSING — backend uses /review/assignments |
| createReview | POST /reviews | MISSING |
| updateReview | PUT /reviews/{id} | MISSING |
| advancedSearch | POST /search/advanced | MISSING — backend has /search/semantic |
| biasAssessments | GET /bias-assessments | MISSING |
| comparabilityAnalyses | GET /comparability-analyses | MISSING |
| systemSettings | PUT /settings | MISSING |
| federatedSync | POST /federated-network/nodes/{id}/sync | MISSING |

---

## 5. Schema-Model Mismatches

| Schema Field | Model Reality | Impact |
|---|---|---|
| UserBase.username | No `username` column on User model | Dead field |
| ProjectBase.name | Model uses `title` not `name` | Potential silent drop |
| ProjectBase.indication | Lives on ParsedSpecification, not Project | Must join |
| ReviewDecisionRequest values (accept/reject) | Enum uses ACCEPTED/REJECTED | Value mismatch |
| EvidenceCritiqueResponse.evidence_record_id | Model has project_id only | Wrong granularity |
| ComparabilityScoreResponse.composite_score | No such column | Dead field |
| BiasAnalysisResponse.project_id | Model links via comparability_score_id | Needs 2 joins |
| AuditLogResponse.audit_type | Model has `action` | Field name mismatch |
| RegulatoryArtifactResponse.file_hash | Model has `checksum` | Field name mismatch |
| BiasTypeEnum.INFORMATION_BIAS | Model has PUBLICATION_BIAS | Enum value mismatch |

---

## 6. Silent Error Swallowing — 30+ Locations

Pattern: `except Exception: return {"status": "unavailable"}` or `logger.debug(...); pass`

**Highest-risk locations:**
1. `/auth/forgot-password` — email send failure silently ignored (user thinks reset sent)
2. `/projects/{id}/discover-evidence` — individual source failures hidden
3. All `/review/*` endpoints — entire collaborative review silently fails
4. All `/search/*` endpoints — search failures return empty results
5. `/projects/{id}/ai/comprehensive-analysis` — AI failures return "unavailable"
6. `/projects/{id}/submission/evidence-package` — partial package silently generated

---

## 7. Fake Data Rendering (Frontend)

| Page | What's Fake | User Warning? |
|---|---|---|
| EvidencePatterns.tsx | Entire PATTERNS array (6 items) hardcoded | ❌ NONE |
| FederatedNetwork.tsx | MOCK_NODES array (6 fake nodes) | ❌ NONE |
| Dashboard.tsx | System health metrics, request counts | ✅ "Demo Data" label |
| LineageContext.tsx | Demo data sources/variables/cohorts | ✅ "SAMPLE DATA" banner |
| AuditLogs.tsx | DEMO_LOGS fallback (8 entries) | ✅ Amber banner |

---

## 8. Database Tables Never Populated

23 of 38 tables are never seeded and likely never written to during normal operation:
- evidence_critiques, federated_nodes, constraint_patterns, evidence_patterns
- session_tokens (auth creates them but seed doesn't)
- saved_searches, evidence_embeddings
- review_assignments, review_comments, workflow_steps
- user_presence, notification_settings, citation_relationships
- adam_datasets, consent_logs, ingestion_reports, patient_datasets
- comparability_protocols, reference_populations
- project_retention_log, validation_records, analysis_results
- background_tasks, execution_events

---

## 9. Prioritized Fix Recommendations

### P0 — Fix Immediately (Breaking/Security)
1. **BUG-001:** Fix `not` → `~` in 4 auth query locations
2. **BUG-002/003:** Fix double-prefix in CollaborativeReview.tsx and AdvancedSearch.tsx
3. **BUG-004:** Fix PUT→PATCH mismatch for project updates
4. **BUG-005:** Add WebSocket authentication
5. **BUG-006:** Remove temp password from invite response body

### P1 — Fix Soon (Functional Gaps)
6. Add missing backend endpoints or fix frontend to use correct paths
7. Replace 7 stub endpoints with real implementations or honest "not implemented" responses
8. Fix 30+ silent error swallowing patterns — return proper HTTP errors
9. Add "Demo Feature" labels to EvidencePatterns.tsx and FederatedNetwork.tsx

### P2 — Fix Before Production (Quality)
10. Align Pydantic schemas with actual model columns
11. Remove dead schema classes that are never imported
12. Add FK constraints to WorkflowStep.workflow_id, ReviewAssignment.workflow_id
13. Add ondelete CASCADE to ExecutionEvent.project_id
14. Remove hardcoded analytics values (avg_processing_time, uptime)

### P3 — Structural Improvements
15. Implement real anchor generation, bias analysis trigger, critique generation
16. Wire federated network and evidence patterns to real data
17. Add integration tests for all critical paths
18. Add provenance verification tests
19. Rotate seed data passwords and add strength requirements

---

## 10. Final Verdict

| Category | Count | % |
|---|---|---|
| ✅ REAL endpoints | 89 | 74% |
| ⚠️ PARTIALLY REAL | 21 | 18% |
| 🔴 STUB/MOCK | 7 | 6% |
| 💀 BROKEN (frontend) | 13 | — |

**The core platform is real and functional.** Authentication, project management, evidence discovery, statistical analysis, patient data ingestion, and regulatory artifact generation all perform real computation with real database persistence. The gaps are concentrated in:
1. Federated features (beta/stub)
2. Collaborative review (frontend broken due to double-prefix)
3. Advanced search (frontend broken due to double-prefix)
4. Anchor/bias/critique triggers (stubs — but their read endpoints work)

**Production readiness:** The system is ~75% production-real. The P0 fixes (5 items) are critical and should be addressed before any production deployment. The P1 fixes (4 items) should follow within the first sprint.
