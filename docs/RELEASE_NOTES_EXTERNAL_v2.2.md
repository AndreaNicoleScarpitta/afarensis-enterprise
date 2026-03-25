# Afarensis Enterprise v2.2 — Release Notes

**Release Date**: March 25, 2026
**Previous Version**: v2.1.0 (March 24, 2026)

---

## Overview

Afarensis v2.2 introduces six foundational capabilities that bring the platform into full alignment with regulatory expectations for externally controlled trials. This release focuses on prespecification enforcement, feasibility gating, and evidence bundling — the three pillars that regulatory reviewers look for when evaluating ECT submissions.

---

## What's New

### Comparability Protocol

You can now author, version, and lock a formal comparability protocol directly within Afarensis. The protocol captures your prespecified inclusion/exclusion criteria, covariates, statistical methods, and sensitivity analyses for the external control comparison. Once you're satisfied with the design, lock the protocol — this action is irreversible and generates a SHA-256 cryptographic hash that proves the analysis plan was fixed before outcome data were examined.

- Author protocols with structured fields for populations, methods, and thresholds
- Version tracking — each save increments the version number
- Irreversible lock with cryptographic hash and audit trail entry
- Locked protocols cannot be modified, ensuring prespecification integrity

### Feasibility Assessment Gate

Before committing to a full analysis, Afarensis now runs six automated feasibility checks against your uploaded dataset:

1. **Required columns** — Verifies that essential variables (subject ID, treatment arm, time-to-event, event indicator) are present
2. **Treatment groups** — Confirms at least two distinct treatment arms exist
3. **Sample size** — Checks that the total sample meets minimum thresholds
4. **Event count** — Ensures sufficient events occurred for reliable survival analysis
5. **Propensity score overlap** — Assesses whether treatment groups have comparable covariate distributions
6. **Baseline balance** — Evaluates initial covariate balance between arms

Each check returns a severity level, and the overall verdict is one of: FEASIBLE, FEASIBLE WITH CONCERNS, NOT FEASIBLE, or BLOCKED.

### Evidence Package Export

Bundle all regulatory artifacts from a completed analysis into a single, verifiable evidence package. The package includes your comparability protocol, statistical analysis results, feasibility assessment, dataset metadata, audit trail summary, bias assessments, and covariate balance diagnostics. Every artifact is individually hashed (SHA-256), and a master manifest hash seals the entire bundle for tamper detection.

### Cryptographic Protocol Hashing

When you lock a study protocol or comparability protocol, the system now computes a SHA-256 hash of the complete protocol content. This hash is stored alongside the lock timestamp and is included in all downstream artifacts (evidence packages, audit trail exports, regulatory documents). It provides cryptographic proof that the analysis plan was not altered after locking.

### Audit Trail Export

Export your project's complete audit trail as a regulatory-grade document suitable for FDA 21 CFR Part 11 inspection. The export includes every recorded event (protocol locks, data uploads, computation runs, document generation), organized chronologically with user identification, timestamps, and regulatory significance flags. The export itself is integrity-hashed so reviewers can verify it hasn't been modified after generation.

### Reference Population Library

Build a library of validated reference populations from completed studies and compare new trial populations against established benchmarks. When planning a new external control comparison, you can now check whether your trial population aligns with previously validated reference cohorts across demographics, covariate profiles, and clinical outcomes — before investing weeks of analysis effort.

---

## Real Data Pipeline Enhancements

This release also completes the end-to-end real data pipeline. Uploaded patient data now flows directly into:

- **Statistical analysis** — Cox PH, IPTW, AIPW, KM, E-value, and subgroup analyses all run on your actual data
- **ADaM generation** — ADSL, ADAE, and ADTTE datasets are derived from uploaded patient data with automatic column mapping
- **TFL generation** — Demographics tables, AE tables, KM curves, forest plots, and love plots all use real patient data

The system auto-detects standard column names (USUBJID, ARM, AVAL, CNSR, AGE, SEX, AEDECOD) and maps them to analysis variables. If no patient data is uploaded, the platform gracefully falls back to simulation mode for demonstration.

---

## Improvements

- **Bootstrap CI performance** — Fixed an infinite recursion issue in bootstrap confidence interval computation that could cause analysis runs to hang. Bootstrap now completes reliably within expected timeframes.
- **Expanded dataset endpoints** — New endpoints for querying dataset metadata, analysis results, and validation reports directly via API.
- **Frontend build stability** — Resolved ErrorBoundary rendering issues and improved error recovery behavior.

---

## API Changes

New endpoints added in v2.2:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/{id}/study/comparability-protocol` | Retrieve comparability protocol |
| `POST` | `/projects/{id}/study/comparability-protocol` | Create/update comparability protocol |
| `PUT` | `/projects/{id}/study/comparability-protocol/lock` | Lock comparability protocol (irreversible) |
| `POST` | `/projects/{id}/study/feasibility-assessment` | Run feasibility assessment |
| `POST` | `/projects/{id}/study/evidence-package` | Export evidence package (JSON) |
| `POST` | `/projects/{id}/submission/evidence-package` | Export evidence package (ZIP) |
| `GET` | `/projects/{id}/study/audit/export` | Export audit trail |
| `POST` | `/reference-populations` | Create reference population |
| `GET` | `/reference-populations` | List reference populations |
| `POST` | `/projects/{id}/study/compare-to-reference/{ref_id}` | Compare to reference population |
| `POST` | `/projects/{id}/study/analyze-dataset` | Run analysis on uploaded data |
| `GET` | `/projects/{id}/datasets` | List project datasets |
| `GET` | `/projects/{id}/study/analysis-results` | Get stored analysis results |
| `GET` | `/projects/{id}/study/validation-report` | Get validation report |
| `GET` | `/projects/{id}/study/dataset-info` | Get active dataset metadata |

All existing endpoints remain unchanged and fully backward compatible.

---

## Compatibility

- **Backend**: Python 3.10+
- **Frontend**: Node 18+, all modern browsers
- **Database**: PostgreSQL 14+ (new tables auto-created via SQLAlchemy)
- **Migration**: No breaking changes. New database tables (`comparability_protocols`, `reference_populations`) are created automatically on first access.

---

## Known Limitations

- Evidence Package ZIP export bundles metadata and results but does not include raw patient data files (by design, for HIPAA compliance)
- Reference population comparison currently supports demographic and covariate overlap metrics; outcome-level statistical comparison is planned for v2.3
- Feasibility assessment overlap check uses a heuristic propensity overlap measure; a formal positivity diagnostic is planned for v2.3

---

*Afarensis Enterprise v2.2.0 — Synthetic Ascension, Inc.*
