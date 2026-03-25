# Afarensis Enterprise API Documentation

**Version:** 2.1 | **Base URL:** /api/v1 | **Auth:** Bearer JWT | **Total Endpoints:** 133

---

## Table of Contents

1. **Authentication & Health** (8 endpoints)
2. **Projects** (10 endpoints)
3. **Evidence & Analysis** (6 endpoints)
4. **Review & Artifacts** (3 endpoints)
5. **Collaborative Review** (9 endpoints)
6. **Study Configuration** (27 endpoints)
7. **SAP Generation** (1 endpoints)
8. **TFL Generation** (7 endpoints)
9. **Missing Data Analysis** (4 endpoints)
10. **CDISC ADaM Datasets** (4 endpoints)
11. **Statistics** (2 endpoints)
12. **SAR Pipeline** (5 endpoints)
13. **Search & Discovery** (10 endpoints)
14. **eCTD Packaging** (3 endpoints)
15. **Define-XML** (2 endpoints)
16. **ADRG Generation** (1 endpoints)
17. **Clinical Study Report** (5 endpoints)
18. **Submission Status** (1 endpoints)
19. **Federated Network** (2 endpoints)
20. **Workflow & AI** (3 endpoints)
21. **Security** (1 endpoints)
22. **Administration** (9 endpoints)
23. **Program Dashboard** (4 endpoints)
24. **Other** (6 endpoints)

---

## Authentication & Health

### GET `/api/v1/health`

**Function:** `health_check`

System health check

---

### POST `/api/v1/auth/login`

**Function:** `login`

Authenticate user and return JWT tokens

---

### GET `/api/v1/auth/me`

**Function:** `get_me`

Get current authenticated user info (camelCase for frontend UserSchema)

---

### POST `/api/v1/auth/logout`

**Function:** `logout`

Log out current user (client-side token removal)

---

### POST `/api/v1/auth/forgot-password`

**Function:** `forgot_password`

Request a password reset. Sends a 6-digit verification code.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| body | Dict | Required |

---

### POST `/api/v1/auth/verify-reset-code`

**Function:** `verify_reset_code`

Verify the 6-digit reset code.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| body | Dict | Required |

---

### POST `/api/v1/auth/reset-password`

**Function:** `reset_password`

Reset the user's password using a verified reset token.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| body | Dict | Required |

---

### POST `/api/v1/auth/refresh`

**Function:** `refresh_token_endpoint`

Refresh access token using refresh token

---


## Projects

### GET `/api/v1/projects/{project_id}`

**Function:** `get_project`

Get detailed project information

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/upload`

**Function:** `upload_protocol_document`

Upload protocol document or SAP for parsing

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| file | UploadFile | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/generate-anchors`

**Function:** `generate_anchor_candidates`

Generate and score anchor candidates

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/analyze-bias`

**Function:** `analyze_bias_and_fragility`

Perform bias detection and fragility analysis

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/generate-critique`

**Function:** `generate_evidence_critique`

Generate AI-powered regulatory critique

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| reviewer_persona | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/generate-artifact`

**Function:** `generate_regulatory_artifact`

Generate regulatory submission artifact with real content

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| artifact_type | str | Required |
| format | str | Required |
| body | ArtifactGenerateBody | title=None include_sections=None regulatory_agency='FDA' submission_context=None custom_parameters=None |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/sdtm/generate/{domain}`

**Function:** `gen_sdtm_domain`

Generate a single SDTM domain (dm, ae, lb, vs, ex, ds).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| domain | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/sdtm/generate-all`

**Function:** `gen_sdtm_all`

Generate all SDTM domains for a project.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/sdtm/validate`

**Function:** `validate_sdtm_ep`

Validate all generated SDTM domains.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/sdtm/acrf`

**Function:** `get_sdtm_acrf`

Generate annotated CRF (aCRF) HTML.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Evidence & Analysis

### POST `/api/v1/projects/{project_id}/discover-evidence`

**Function:** `discover_evidence`

Discover and extract evidence from PubMed and ClinicalTrials.gov

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| max_pubmed_results | int | Required |
| max_trials_results | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/evidence`

**Function:** `get_project_evidence`

Get evidence records for a project

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| source_type | Optional | None |
| min_score | Optional | None |
| limit | int | Required |
| offset | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/comparability-scores`

**Function:** `get_comparability_scores`

Get comparability scores for project evidence

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| min_overall_score | Optional | None |
| limit | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/bias-analysis`

**Function:** `get_bias_analysis`

Get bias analysis results

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| bias_type | Optional | None |
| min_severity | Optional | None |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/evidence/{evidence_id}/decision`

**Function:** `submit_evidence_decision`

Submit reviewer decision on evidence record with cryptographic e-signature

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| evidence_id | str | Required |
| decision_request | ReviewDecisionRequest | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/evidence/network`

**Function:** `get_evidence_network`

Get evidence network data for advanced visualization

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| include_relationships | bool | Required |
| min_quality_score | float | Required |

> **Auth Required:** Bearer token

---


## Review & Artifacts

### GET `/api/v1/projects/{project_id}/decisions`

**Function:** `get_review_decisions`

Get review decisions for a project

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| reviewer_id | Optional | None |
| decision | Optional | None |

> **Auth Required:** Bearer token

---

### GET `/api/v1/artifacts/{artifact_id}/download`

**Function:** `download_regulatory_artifact`

Download generated regulatory artifact as a file

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| artifact_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/artifacts`

**Function:** `list_project_artifacts`

List artifacts generated for a project

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| artifact_type | Optional | None |

> **Auth Required:** Bearer token

---


## Collaborative Review

### POST `/api/v1/review/workflows`

**Function:** `create_review_workflow`

Create a collaborative review workflow

> **Auth Required:** Bearer token

---

### POST `/api/v1/review/assignments`

**Function:** `assign_reviewer`

Assign a reviewer to evidence

> **Auth Required:** Bearer token

---

### GET `/api/v1/review/assignments`

**Function:** `get_review_assignments`

Get review assignments with filtering

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| evidence_id | Optional | None |
| reviewer_id | Optional | None |
| status | Optional | None |

> **Auth Required:** Bearer token

---

### POST `/api/v1/review/comments`

**Function:** `add_review_comment`

Add a comment to evidence review

> **Auth Required:** Bearer token

---

### GET `/api/v1/review/comments/{evidence_id}`

**Function:** `get_evidence_comments`

Get all comments for evidence with threading

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| evidence_id | str | Required |
| include_resolved | bool | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/review/decisions`

**Function:** `submit_collaborative_review_decision`

Submit a review decision via collaborative review service

> **Auth Required:** Bearer token

---

### POST `/api/v1/review/conflicts/resolve`

**Function:** `resolve_review_conflicts`

Resolve conflicts between reviewer decisions

> **Auth Required:** Bearer token

---

### GET `/api/v1/review/presence/{evidence_id}`

**Function:** `get_real_time_presence`

Get real-time presence information for evidence review

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| evidence_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/review/presence/{evidence_id}`

**Function:** `update_user_presence`

Update user's real-time presence

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| evidence_id | str | Required |

> **Auth Required:** Bearer token

---


## Study Configuration

### GET `/api/v1/projects/{project_id}/study/definition`

**Function:** `get_study_definition`

Retrieve the study definition section from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/definition`

**Function:** `save_study_definition`

Save or update the study definition section in processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/lock`

**Function:** `lock_study_protocol`

Lock the study protocol, preventing further edits, and create an audit log entry.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/covariates`

**Function:** `get_study_covariates`

Retrieve the covariates section from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/covariates`

**Function:** `save_study_covariates`

Save or update the covariates section in processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/data-sources`

**Function:** `get_study_data_sources`

Retrieve the data sources section from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/data-sources`

**Function:** `save_study_data_sources`

Save or update the data sources section in processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/cohort`

**Function:** `get_study_cohort`

Retrieve the cohort section from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/cohort`

**Function:** `save_study_cohort`

Save or update the cohort section in processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/cohort/run`

**Function:** `run_cohort_attrition`

Simulate an attrition funnel based on cohort inclusion/exclusion criteria.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/balance`

**Function:** `get_study_balance`

Get covariate balance data (SMD) for a Love plot.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/balance/compute`

**Function:** `compute_study_balance`

Compute propensity scores, IPTW, and covariate balance (SMD).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/results/forest-plot`

**Function:** `get_study_forest_plot`

Get forest plot data (primary + sensitivity + subgroup results).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/bias`

**Function:** `get_study_bias`

Get bias analysis results for the study.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/bias/run`

**Function:** `run_study_bias_analysis`

Run bias analysis for the project and compute E-values.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/reproducibility`

**Function:** `get_study_reproducibility`

Retrieve the reproducibility section from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/projects/{project_id}/study/reproducibility`

**Function:** `save_study_reproducibility`

Save or update the reproducibility section in processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/audit`

**Function:** `get_study_audit`

Get audit log events for a project, optionally filtered by category.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| category | Optional | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/regulatory`

**Function:** `get_study_regulatory_readiness`

Compute regulatory readiness checklist from processing_config sections.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/regulatory/generate`

**Function:** `generate_study_regulatory_document`

Generate a regulatory document (SAR) using real project data from processing_config.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| format | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/regulatory/download/{artifact_id}`

**Function:** `download_study_regulatory_artifact`

Download a generated regulatory artifact by its ID.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| artifact_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/bayesian/analyze`

**Function:** `run_bayesian_analyze`

Run full Bayesian analysis pipeline with simulation data.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/bayesian/prior-elicitation`

**Function:** `run_bayesian_prior`

Compute Bayesian prior elicitation from historical data.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/bayesian/adaptive`

**Function:** `run_bayesian_adaptive`

Compute Bayesian adaptive decision at interim.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/interim/boundaries`

**Function:** `compute_interim_boundaries_ep`

Compute group-sequential stopping boundaries.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| n_looks | int | Required |
| method | str | Required |
| alpha | float | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/interim/evaluate`

**Function:** `evaluate_interim_ep`

Evaluate an observed z-statistic against pre-computed boundaries.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/interim/dsmb-report`

**Function:** `generate_dsmb_report_ep`

Generate a structured DSMB/IDMC report.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## SAP Generation

### POST `/api/v1/projects/{project_id}/study/sap/generate`

**Function:** `generate_sap_document`

Generate a Statistical Analysis Plan (SAP) document.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| format | str | Required |

> **Auth Required:** Bearer token

---


## TFL Generation

### POST `/api/v1/projects/{project_id}/study/tfl/demographics`

**Function:** `gen_tfl_demo`

Generate demographics table (Table 14.1.1).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/tfl/ae-table`

**Function:** `gen_tfl_ae`

Generate adverse events table (Table 14.3.1).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/tfl/km-curve`

**Function:** `gen_tfl_km`

Generate Kaplan-Meier survival curves (Figure 14.2.1).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/tfl/forest-plot`

**Function:** `gen_tfl_forest`

Generate forest plot (Figure 14.2.2).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/tfl/love-plot`

**Function:** `gen_tfl_love`

Generate covariate balance Love plot (Figure 14.1.1).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/tfl/shells`

**Function:** `get_tfl_shells_ep`

List planned TFL shells.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/tfl/generate-all`

**Function:** `gen_all_tfls_ep`

Generate all TFLs as a package.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Missing Data Analysis

### POST `/api/v1/projects/{project_id}/study/missing-data/impute`

**Function:** `run_mi_ep`

Run multiple imputation with Rubin's rules.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/missing-data/tipping`

**Function:** `run_tipping_ep`

Run tipping-point sensitivity analysis.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/study/missing-data/mmrm`

**Function:** `run_mmrm_ep`

Run MMRM analysis.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/study/missing-data/summary`

**Function:** `missing_summary_ep`

Get missing data pattern summary.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## CDISC ADaM Datasets

### POST `/api/v1/projects/{project_id}/adam/generate/{dataset_type}`

**Function:** `gen_adam`

Generate a CDISC ADaM dataset (adsl, adae, adtte).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| dataset_type | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/adam/datasets`

**Function:** `list_adam_ep`

List generated ADaM datasets.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/adam/validate`

**Function:** `validate_adam_ep`

Validate all ADaM datasets.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/adam/metadata`

**Function:** `adam_metadata_ep`

Export ADaM metadata (Define-XML style JSON).

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Statistics

### GET `/api/v1/statistics/full-analysis`

**Function:** `run_full_analysis`

Run complete statistical analysis for XY-301 study

> **Auth Required:** Bearer token

---

### GET `/api/v1/statistics/summary`

**Function:** `get_stats_summary`

Get statistical results summary

> **Auth Required:** Bearer token

---


## SAR Pipeline

### POST `/api/v1/sar-pipeline/init`

**Function:** `init_sar_pipeline`

Initialize a new SAR pipeline for a project

> **Auth Required:** Bearer token

---

### GET `/api/v1/sar-pipeline/{project_id}/status`

**Function:** `get_sar_pipeline_status`

Get SAR pipeline status for a project, populated from processing_config

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/sar-pipeline/{project_id}/run-stage`

**Function:** `run_sar_stage`

Trigger execution of a specific SAR pipeline stage

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/sar-pipeline/{project_id}/results`

**Function:** `get_sar_results`

Get full results from a completed SAR pipeline using real project data

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/sar-pipeline/{project_id}/report`

**Function:** `get_sar_report`

Get the assembled SAR regulatory report derived from processing_config

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Search & Discovery

### POST `/api/v1/search/semantic`

**Function:** `semantic_search`

Perform semantic search with AI-powered similarity

> **Auth Required:** Bearer token

---

### POST `/api/v1/search/hybrid`

**Function:** `hybrid_search`

Perform hybrid search combining semantic and keyword approaches

> **Auth Required:** Bearer token

---

### GET `/api/v1/search/recommendations/{evidence_id}`

**Function:** `get_evidence_recommendations`

Get AI-powered recommendations for evidence

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| evidence_id | str | Required |
| recommendation_type | str | Required |
| limit | int | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/search/save`

**Function:** `save_search`

Save a search for later reuse and alerts

> **Auth Required:** Bearer token

---

### GET `/api/v1/search/saved`

**Function:** `get_saved_searches`

Get user's saved searches

> **Auth Required:** Bearer token

---

### POST `/api/v1/search/citation-network`

**Function:** `analyze_citation_network`

Analyze citation relationships between evidence records

> **Auth Required:** Bearer token

---

### GET `/api/v1/search/semantic-scholar`

**Function:** `search_semantic_scholar`

Search Semantic Scholar academic papers

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| query | str | Required |
| limit | int | Required |
| offset | int | Required |
| year_from | Optional | Required |
| year_to | Optional | Required |
| fields_of_study | Optional | Required |
| open_access_only | bool | Required |
| min_citation_count | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/search/semantic-scholar/paper/{paper_id:path}`

**Function:** `get_semantic_scholar_paper`

Get a specific paper from Semantic Scholar by ID

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| paper_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/search/semantic-scholar/recommendations`

**Function:** `get_semantic_scholar_recommendations`

Get paper recommendations from Semantic Scholar

> **Auth Required:** Bearer token

---

### POST `/api/v1/search/rare-disease-evidence`

**Function:** `search_rare_disease_evidence`

Search for rare disease evidence across Semantic Scholar

> **Auth Required:** Bearer token

---


## eCTD Packaging

### POST `/api/v1/projects/{project_id}/submission/ectd/generate`

**Function:** `generate_ectd_package`

Generate eCTD Module 5 submission package.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/submission/ectd/manifest`

**Function:** `get_ectd_manifest`

Get HTML manifest for the eCTD package.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/ectd/validate`

**Function:** `validate_ectd_package`

Validate eCTD package structure and completeness.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Define-XML

### POST `/api/v1/projects/{project_id}/submission/define-xml/generate`

**Function:** `generate_define_xml`

Generate Define-XML 2.1 for ADaM datasets.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/define-xml/validate`

**Function:** `validate_define_xml_ep`

Validate Define-XML content.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| xml_content | str | Required |

> **Auth Required:** Bearer token

---


## ADRG Generation

### POST `/api/v1/projects/{project_id}/submission/adrg/generate`

**Function:** `generate_adrg`

Generate Analysis Data Reviewer's Guide (ADRG) as DOCX.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Clinical Study Report

### POST `/api/v1/projects/{project_id}/submission/csr/synopsis`

**Function:** `generate_csr_synopsis`

Generate CSR Synopsis as DOCX.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/csr/section-11`

**Function:** `generate_csr_section_11`

Generate CSR Section 11: Efficacy as DOCX.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/csr/section-12`

**Function:** `generate_csr_section_12`

Generate CSR Section 12: Safety as DOCX.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/csr/appendix-16`

**Function:** `generate_csr_appendix_16`

Generate CSR Appendix 16.1.9 as DOCX.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/submission/csr/full`

**Function:** `generate_full_csr`

Generate all CSR sections and save each as a regulatory artifact.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Submission Status

### GET `/api/v1/projects/{project_id}/submission/status`

**Function:** `get_submission_status`

Get overall submission readiness status across all Phase 3 outputs.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Federated Network

### GET `/api/v1/federated/nodes`

**Function:** `list_federated_nodes`

List federated network nodes

> **Auth Required:** Bearer token

---

### GET `/api/v1/evidence-patterns`

**Function:** `get_evidence_patterns`

Get successful evidence patterns from the pattern library

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| indication_category | Optional | None |
| regulatory_agency | Optional | None |
| min_approval_likelihood | Optional | None |

> **Auth Required:** Bearer token

---


## Workflow & AI

### POST `/api/v1/projects/{project_id}/ai/comprehensive-analysis`

**Function:** `ai_comprehensive_analysis`

AI-powered comprehensive evidence analysis

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| evidence_id | str | Required |
| analysis_depth | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects/{project_id}/workflow/guidance`

**Function:** `get_intelligent_workflow_guidance`

Get AI-powered intelligent workflow guidance and recommendations

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| user_context | Optional | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/projects/{project_id}/workflow/execute-step`

**Function:** `execute_intelligent_workflow_step`

Execute workflow step with AI assistance and automation

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| step_id | str | Required |
| automation_level | str | Required |

> **Auth Required:** Bearer token

---


## Security

### POST `/api/v1/projects/{project_id}/security/threat-detection`

**Function:** `detect_security_threats`

Real-time security threat detection and analysis

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |
| session_data | Dict | Required |

> **Auth Required:** Bearer token

---


## Administration

### GET `/api/v1/users/me`

**Function:** `get_current_user_info`

Get current user information

> **Auth Required:** Bearer token

---

### GET `/api/v1/users`

**Function:** `list_users`

List system users (admin only)

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| role | Optional | None |
| organization | Optional | None |
| limit | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/audit/logs`

**Function:** `get_audit_logs`

Get audit logs for compliance reporting

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | Optional | None |
| user_id | Optional | None |
| action | Optional | None |
| start_date | Optional | None |
| end_date | Optional | None |
| limit | int | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/analytics/dashboard`

**Function:** `get_analytics_dashboard`

Get analytics dashboard data with real counts from the database

> **Auth Required:** Bearer token

---

### GET `/api/v1/org/users`

**Function:** `list_org_users`

List users in the current user's organization.

> **Auth Required:** Bearer token

---

### POST `/api/v1/org/users/invite`

**Function:** `invite_user`

Invite a new user to the organization. Admin only.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/org/users/{user_id}/role`

**Function:** `update_user_role`

Update a user's role. Admin only.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| user_id | str | Required |
| body | Dict | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/org/users/{user_id}/deactivate`

**Function:** `deactivate_user`

Deactivate a user. Admin only.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| user_id | str | Required |

> **Auth Required:** Bearer token

---

### PUT `/api/v1/org/users/{user_id}/activate`

**Function:** `activate_user`

Re-activate a user. Admin only.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| user_id | str | Required |

> **Auth Required:** Bearer token

---


## Program Dashboard

### GET `/api/v1/program/overview`

**Function:** `program_overview`

Get cross-study program overview.

> **Auth Required:** Bearer token

---

### GET `/api/v1/program/portfolio`

**Function:** `program_portfolio`

Get portfolio summary with readiness scores for all projects.

> **Auth Required:** Bearer token

---

### GET `/api/v1/program/{project_id}/readiness`

**Function:** `program_readiness`

Get submission readiness checklist for a project.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/program/{project_id}/milestones`

**Function:** `program_milestones`

Get milestone timeline for a project.

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| project_id | str | Required |

> **Auth Required:** Bearer token

---


## Other

### POST `/api/v1/projects`

**Function:** `create_project`

Create a new evidence review project

> **Auth Required:** Bearer token

---

### GET `/api/v1/projects`

**Function:** `list_projects`

List evidence review projects

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| status | Optional | None |
| limit | int | Required |
| offset | int | Required |

> **Auth Required:** Bearer token

---

### POST `/api/v1/user/{user_id}/workflow/optimize`

**Function:** `optimize_user_workflow`

Optimize workflow for specific user

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| user_id | str | Required |
| workflow_history | List | [] |
| performance_metrics | Dict | {} |

> **Auth Required:** Bearer token

---

### POST `/api/v1/data/classify`

**Function:** `classify_data_sensitivity`

Classify data sensitivity and determine protection requirements

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| data_type | str | Required |
| content_indicators | List | Required |
| regulatory_context | Dict | {} |

> **Auth Required:** Bearer token

---

### GET `/api/v1/workflows/{workflow_id}/progress`

**Function:** `get_workflow_progress`

Get progress of a review workflow

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| workflow_id | str | Required |

> **Auth Required:** Bearer token

---

### GET `/api/v1/org/info`

**Function:** `get_org_info`

Get current organization info.

> **Auth Required:** Bearer token

---


## Authentication

All endpoints except /health and /auth/login require a Bearer JWT token in the Authorization header.

```
Authorization: Bearer <access_token>
```

Tokens are obtained via POST /api/v1/auth/login with {"email": "...", "password": "..."}.
Access tokens expire after 30 minutes. Use POST /api/v1/auth/refresh to get a new one.

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "type": "HTTPException",
    "message": "Human-readable error message",
    "correlation_id": "uuid"
  },
  "detail": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

## Roles

| Role | Permissions |
|------|------------|
| ADMIN | Full access to all endpoints |
| REVIEWER | Review decisions, comments, evidence analysis |
| ANALYST | Project creation, evidence discovery, statistical analysis |
| VIEWER | Read-only access to projects and results |

---

*Generated for Afarensis Enterprise v2.1 - Synthetic Ascension*