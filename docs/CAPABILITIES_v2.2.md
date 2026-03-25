# Afarensis Enterprise — Capabilities Overview

**Version 2.2.0** | **March 25, 2026** | **Synthetic Ascension, Inc.**

---

## What Is Afarensis?

Afarensis is a regulatory-grade evidence synthesis platform purpose-built for externally controlled trials (ECTs) in rare disease and oncology. It replaces fragmented spreadsheets, SAS scripts, and ad-hoc analyses with a single, auditable, end-to-end workflow — from protocol definition to regulatory submission.

Designed for biostatisticians, clinical operations teams, and regulatory affairs professionals, Afarensis enforces prespecification, automates causal inference, and generates submission-ready artifacts that satisfy FDA, EMA, PMDA, and Health Canada requirements.

---

## Core Capabilities at a Glance

### 1. Structured Study Design & Protocol Locking

Define your research question, endpoints, estimands, and regulatory context in a guided interface. Once finalized, lock the protocol with an irreversible cryptographic seal (SHA-256 hash) — proving the analysis plan was fixed before outcome data were examined. Every lock event is immutably recorded in the audit trail.

### 2. Prespecified Comparability Protocol

Author a formal comparability protocol specifying inclusion/exclusion criteria, covariates, statistical methods, and sensitivity analyses for the external control arm — before touching the data. Lock the protocol to generate a tamper-proof hash. This is the regulatory cornerstone of any ECT submission.

### 3. Automated Feasibility Assessment

Before committing to a full analysis, Afarensis runs six automated checks against your uploaded data: required column presence, treatment group detection, minimum sample size, event count thresholds, propensity score overlap, and baseline covariate balance. You get a clear verdict — FEASIBLE, FEASIBLE WITH CONCERNS, NOT FEASIBLE, or BLOCKED — before spending weeks on a dead-end dataset.

### 4. Real Causal Inference Engine (Validated Against R)

Every computation is real — not a mockup. The platform runs:

- **Cox Proportional Hazards** (Newton-Raphson solver, Efron tie handling)
- **Propensity Score Estimation** (logistic regression)
- **Inverse Probability of Treatment Weighting (IPTW)**
- **Augmented IPTW / Doubly Robust Estimation (AIPW)**
- **Kaplan-Meier Survival Curves** (Greenwood CI)
- **E-Value Sensitivity Analysis** (VanderWeele-Ding)
- **DerSimonian-Laird Random-Effects Meta-Analysis**
- **Stratified Subgroup Analyses**
- **Bootstrap Confidence Intervals** (500 replicates)

All results are validated against the R `survival` package and Python `lifelines` with a 30-test automated validation suite.

### 5. HIPAA-Compliant Patient Data Ingestion

Upload patient-level data (CSV, XLSX, XPT, SAS7BDAT) through a consent gate requiring IRB attestation. Every upload triggers eight automated regulatory compliance checks: de-identification verification, consent documentation, minimum necessary standard, access logging, encryption verification, audit trail creation, retention policy assignment, and breach notification readiness. Datasets are classified as CLEARED, CLEARED WITH WARNINGS, or BLOCKED.

### 6. Real Data Pipeline — Upload to Analysis in One Click

Uploaded patient data flows directly into the statistical engine, ADaM generator, and TFL generator. No manual export/import. No copy-paste. The pipeline auto-detects column mappings (USUBJID, ARM, AVAL, CNSR, AGE, SEX) and runs the full analysis suite on your actual data — with automatic fallback to simulation mode for demonstration purposes.

### 7. CDISC ADaM Dataset Generation

Automatically generate CDISC-compliant analysis datasets:
- **ADSL** — Subject-Level Analysis Dataset
- **ADAE** — Adverse Events Analysis Dataset
- **ADTTE** — Time-to-Event Analysis Dataset

Each dataset is derived from uploaded patient data when available, with proper variable derivations (TRT01P, TRT01A, PARAMCD, AVAL, CNSR, TRTSDT, TRTEDT).

### 8. Tables, Figures, and Listings (TFL) Generation

Generate publication-quality regulatory outputs:
- **Table 14.1.1** — Demographics and Baseline Characteristics
- **Table 14.3.1** — Adverse Events by System Organ Class
- **Figure 14.2.1** — Kaplan-Meier Survival Curves
- **Figure 14.2.2** — Forest Plot (multi-method effect estimates)
- **Figure 14.2.3** — Love Plot (covariate balance visualization)

All TFLs use real patient data when uploaded, with automatic fallback to simulated data.

### 9. Evidence Package Export

Bundle every regulatory artifact into a single evidence package with per-artifact SHA-256 integrity hashes and a master manifest hash. The package includes: comparability protocol, analysis results, feasibility assessment, dataset metadata, audit trail summary, bias assessments, covariate balance diagnostics, and reference population comparisons.

### 10. Reference Population Library

Build a library of validated reference populations from completed studies. Compare new trial populations against established benchmarks across demographics, covariate profiles, and outcome types. Assess feasibility of new external control comparisons before committing resources.

### 11. Regulatory Document Generation

Generate submission-ready documents directly from analysis results:
- Statistical Analysis Report (SAR)
- eCTD Module 5 Package
- Define-XML 2.1
- Analysis Data Reviewer's Guide (ADRG)
- Clinical Study Report sections (Synopsis, Section 11: Efficacy, Section 12: Safety, Appendix 16)

### 12. Multi-Source Literature Search

Search PubMed, ClinicalTrials.gov, OpenAlex, and Semantic Scholar from a unified interface. Save evidence to projects, filter by study type and year, and build a comprehensive evidence base that feeds into regulatory outputs.

### 13. Immutable Audit Trail with Regulatory Export

Every action — protocol locks, data uploads, computation runs, document generation — is recorded in an immutable, append-only audit log with 7-year retention. Export the complete audit trail as a regulatory-grade document with SHA-256 integrity verification, ready for FDA 21 CFR Part 11 inspection.

### 14. Role-Based Access & Multi-Tenant Isolation

Four roles (Admin, Reviewer, Analyst, Viewer) with hierarchical permissions. Organization-scoped data isolation ensures complete separation between tenants. JWT authentication with token rotation and reuse detection.

### 15. Bias & Sensitivity Analysis Suite

Quantify robustness to unmeasured confounding with E-values, fragility indices, tipping-point analyses, and pattern-mixture models. Four bias domain gauges (selection, confounding, measurement, temporal) provide at-a-glance risk assessment.

### 16. Reproducibility & Lineage Tracking

Cryptographic hashes on every input, intermediate output, and final result. Visual lineage graphs trace data flow from raw files through every transformation. Reproducibility scores quantify deterministic coverage. Export complete trace packages for independent verification.

---

## What Makes Afarensis Different

| Dimension | Traditional Approach | Afarensis |
|-----------|---------------------|-----------|
| Protocol prespecification | Word document, honor system | Cryptographically locked, SHA-256 hashed, audit-logged |
| Statistical analysis | SAS/R scripts, manual QC | Validated engine, automated test suite, one-click execution |
| Data ingestion | Manual ETL, email attachments | HIPAA-gated upload, 8 regulatory checks, automated pipeline |
| Regulatory documents | Manual authoring, months of work | Auto-generated from analysis results, submission-ready |
| Audit trail | Spreadsheet logs, reconstructed after the fact | Immutable, real-time, 7-year retention, exportable |
| Reproducibility | "Trust me, it works" | Deterministic hashes, lineage graphs, trace packages |
| Feasibility | Weeks of exploratory analysis | 6 automated checks, verdict in seconds |

---

## Supported Regulatory Frameworks

- FDA 21 CFR Part 11 (electronic records and signatures)
- ICH E6(R2) (Good Clinical Practice)
- ICH E9(R1) (estimands and sensitivity analysis)
- CDISC ADaM (Analysis Data Model)
- CDISC Define-XML 2.1
- eCTD Module 5

---

## Technology

- **Backend**: Python 3.10, FastAPI, SQLAlchemy (async), PostgreSQL
- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Statistical Engine**: NumPy, SciPy (custom Newton-Raphson Cox solver)
- **Security**: JWT with rotation, AES-256 encryption at rest, RBAC
- **Compliance**: HIPAA consent gate, immutable audit logs, 7-year retention

---

*Afarensis Enterprise v2.2.0 — Synthetic Ascension, Inc.*
*For inquiries: contact@syntheticascension.com*
