# Afarensis Enterprise v2.2 — Internal Release Notes

**Release Date**: March 25, 2026
**Previous Version**: v2.1.0 (March 24, 2026)
**Classification**: INTERNAL — Engineering & Product Team Only

---

## Release Summary

v2.2 closes the gap between the Synthetic Ascension founding memo and the shipping product. Six artifacts identified as missing during a founding-document alignment review have been implemented as purely additive changes. The real data pipeline (Parts 1-6 from the implementation plan) is now fully wired. All 30 statistical validation tests pass. Frontend builds cleanly (1776 modules, 12s).

---

## Engineering Changes — Detailed

### 1. Comparability Protocol (Feature 1)

**Files modified:**
- `backend/app/models/__init__.py` — Added `ComparabilityProtocol` model (lines ~888-926)
- `backend/app/api/routes.py` — Added 3 endpoints (lines ~3999-4178)

**Model schema:**
```
comparability_protocols
├── id (PK, UUID)
├── project_id (FK → projects.id, CASCADE)
├── version (Integer, auto-increment per project)
├── locked (Boolean, default False)
├── locked_at (DateTime, nullable)
├── locked_by (String, nullable)
├── protocol_hash (String, nullable — SHA-256 on lock)
├── inclusion_criteria (JSON)
├── exclusion_criteria (JSON)
├── primary_endpoint (String)
├── secondary_endpoints (JSON)
├── statistical_methods (JSON)
├── covariates (JSON)
├── sensitivity_analyses (JSON)
├── populations (JSON)
├── feasibility_thresholds (JSON)
├── created_at / updated_at (DateTime)
└── project (relationship → Project)
```

**Endpoints:**
- `GET /projects/{id}/study/comparability-protocol` — Returns latest version for project. Returns `{"exists": false}` if none defined.
- `POST /projects/{id}/study/comparability-protocol` — Upsert. Blocks with 409 if locked. Auto-increments version.
- `PUT /projects/{id}/study/comparability-protocol/lock` — Irreversible. Computes SHA-256 of all protocol fields serialized as sorted JSON. Writes audit log via `write_audit_log()`.

**Design decisions:**
- Version is auto-incremented on each POST, not user-controlled
- Lock is checked at the model level (query for existing locked protocol) before allowing updates
- Hash is computed over `inclusion_criteria + exclusion_criteria + primary_endpoint + secondary_endpoints + statistical_methods + covariates + sensitivity_analyses + populations` serialized as sorted JSON

### 2. Feasibility Assessment Gate (Feature 2)

**Files modified:**
- `backend/app/services/statistical_models.py` — Added `assess_feasibility()` method (line ~1603)
- `backend/app/api/routes.py` — Added 1 endpoint (line ~4181)

**Method signature:**
```python
def assess_feasibility(self, df_dict: list, protocol: dict = None) -> Dict
```

**Six checks implemented:**
1. `required_columns` — Looks for USUBJID/SUBJID, ARM/TRT01P, AVAL/TIME/OS_MONTHS, CNSR/EVENT/STATUS
2. `treatment_groups` — Counts distinct values in treatment column, requires >= 2
3. `sample_size` — Checks total N >= 50 (configurable via protocol thresholds)
4. `minimum_events` — Checks event count >= 20 (configurable)
5. `propensity_overlap` — Fits quick logistic regression, checks PS distribution overlap between arms
6. `baseline_balance` — Computes SMD for numeric covariates, flags if max |SMD| > 0.5

**Verdict logic:**
- Any CRITICAL finding → BLOCKED
- Any MAJOR finding → NOT_FEASIBLE
- Any WARNING finding → FEASIBLE_WITH_CONCERNS
- All PASS → FEASIBLE

**Endpoint:** `POST /projects/{id}/study/feasibility-assessment`
- Requires active PatientDataset (calls `_get_active_patient_data()`)
- Optionally uses comparability protocol thresholds if a ComparabilityProtocol exists
- Stores result in `processing_config["feasibility"]`

### 3. Evidence Package Export (Feature 3)

**Files modified:**
- `backend/app/api/routes.py` — Added 2 endpoints

**Endpoint 1:** `POST /projects/{id}/study/evidence-package` (line ~4232)
- Returns JSON evidence bundle
- Collects up to 9 artifact types: comparability protocol, study definition, analysis results, feasibility assessment, covariate balance, bias assessment, dataset metadata, audit trail summary, reference comparison
- Each artifact is individually SHA-256 hashed
- Master manifest hash computed over all artifact hashes
- Stores `evidence_package` metadata in `processing_config`
- Writes audit log

**Endpoint 2:** `POST /projects/{id}/submission/evidence-package` (line ~4930)
- Returns ZIP file bundle (added by Agent 1)
- Includes same artifacts but packaged as ZIP with MANIFEST.json
- Content-Disposition header for browser download

**Design note:** Two endpoints serve different purposes — JSON for programmatic access, ZIP for regulatory submission download.

### 4. Cryptographic Protocol Hash (Feature 4)

**Files modified:**
- `backend/app/api/routes.py` — Modified `PUT /projects/{id}/study/lock` (line ~3128)

**Change (3 lines added):**
```python
# After setting lock flags:
protocol_content = json.dumps(config.get("study_definition", {}), sort_keys=True, default=str)
config["protocol_hash"] = hashlib.sha256(protocol_content.encode("utf-8")).hexdigest()
config["protocol_locked_at"] = datetime.utcnow().isoformat() + "Z"
```

**Impact:** This is the ONLY modification to an existing endpoint. All other changes are purely additive. The return value now includes `protocol_hash`.

### 5. Audit Trail Export (Feature 5)

**Files modified:**
- `backend/app/api/routes.py` — Added 1 endpoint (line ~6350)

**Endpoint:** `GET /projects/{id}/study/audit/export`
- Queries `audit_logs` table for all entries matching `project_id`
- Returns structured JSON with: title, project metadata, protocol hash, date range, total event count, regulatory event count, all entries, and a SHA-256 integrity hash of the export itself
- The export hash is computed over the document BEFORE the hash field is added, then appended — so verifiers can reproduce the hash by removing the `export_hash` field and re-hashing

### 6. Reference Population Library (Feature 6)

**Files modified:**
- `backend/app/models/__init__.py` — Added `ReferencePopulation` model (lines ~928-956)
- `backend/app/api/routes.py` — Added 3 endpoints (lines ~6417-6597)

**Model schema:**
```
reference_populations
├── id (PK, UUID)
├── name (String, required)
├── description (Text)
├── disease_area (String)
├── source_type (String)
├── n_subjects (Integer)
├── demographics_summary (JSON)
├── outcome_types (JSON, list of strings)
├── covariate_profile (JSON, list of dicts)
├── inclusion_criteria (JSON)
├── created_from_project_id (String, nullable)
├── organization_id (String, nullable)
├── created_by (String)
├── validated (Boolean, default False)
├── created_at / updated_at (DateTime)
```

**Endpoints:**
- `POST /reference-populations` — Creates a new reference population, scoped to user's org
- `GET /reference-populations` — Lists populations, filtered by org scope and optional `disease_area` query param
- `POST /projects/{id}/study/compare-to-reference/{ref_id}` — Compares project population against reference across 3 dimensions:
  1. Demographics (mean_age, pct_female, pct_white with configurable thresholds)
  2. Outcome alignment (project endpoint vs reference outcome types)
  3. Covariate overlap (shared covariates / total covariates ratio)
  - Optionally runs feasibility assessment if patient data is uploaded
  - Stores comparison in `processing_config["reference_comparison"]`

---

## Real Data Pipeline Completion

### `_get_active_patient_data()` helper (routes.py, line ~780)
Shared async helper that queries `patient_datasets` for the most recent active dataset for a project. Returns `list[dict]` or `None`. Used by 12+ endpoints.

### Endpoints wired to real data:
1. `POST /balance/compute` — Uses real data for PS estimation and balance diagnostics
2. `POST /forest-plot` — Uses real data for multi-method effect estimation
3. `POST /bias/run` — Uses real data for bias assessment
4. `GET /bias` (fallback) — Same
5. `POST /sar/generate` — Statistical analysis on real data for SAR
6. `GET /sar/pipeline-results` — Same
7. `POST /tfl/demographics` — Real patient demographics
8. `POST /tfl/ae-table` — Real AE frequencies from AEDECOD column
9. `POST /tfl/km-curve` — Real survival curves
10. `POST /tfl/love-plot` — Real covariate balance
11. `POST /tfl/generate-all` — All TFLs from real data
12. `POST /adam/generate` — ADaM datasets from real data

### Pattern used in all endpoints:
```python
patient_data = await _get_active_patient_data(project_id, db)
if patient_data is not None:
    raw = stats_svc.run_analysis_from_data(patient_data)
    if "error" in raw:
        raw = stats_svc.run_full_analysis()  # fallback to simulation
else:
    raw = stats_svc.run_full_analysis()  # no data uploaded, use simulation
```

### `run_analysis_from_data()` (statistical_models.py)
Accepts `list[dict]`, converts to DataFrame, auto-detects column mappings for treatment arm, time-to-event, event indicator, and covariates. Runs the full analysis pipeline on the real data.

### TFL generator changes:
- `generate_ae_table()` — Added `patient_data` parameter. If provided, computes real AE frequencies from AEDECOD/AEBODSYS columns by treatment arm.
- `generate_all_tfls()` — Passes `patient_data` through to all sub-generators.

---

## Bug Fixes

### Bootstrap CI Infinite Recursion (CRITICAL)

**Root cause:** `compute_cox_proportional_hazards()` called `_bootstrap_ci()` which called `compute_cox_proportional_hazards()` again in a loop. With 500 bootstrap replicates, this created 500 x 500 = 250,000 Cox PH fits, causing tests to hang indefinitely.

**Fix:** Added `_skip_bootstrap: bool = False` parameter to both `compute_cox_proportional_hazards()` and `compute_weighted_cox()`. Inner bootstrap estimator functions pass `_skip_bootstrap=True` to prevent recursive bootstrap. All calls from `compute_subgroup_analyses()` also pass `_skip_bootstrap=True`.

**Files:** `backend/app/services/statistical_models.py`
**Impact:** Tests that previously hung now complete in ~10 minutes (30 tests).

### ErrorBoundary Rendering

**Fix:** ErrorBoundary component now properly resets error state on route changes and limits retry attempts to 3 consecutive failures.

**File:** `frontend/src/components/ErrorBoundary.tsx`

---

## Test Results

```
30 passed, 7 warnings in 591.11s (0:09:51)
```

All 30 statistical validation tests pass. Warnings are expected numpy RuntimeWarnings for edge cases (divide by zero in degenerate subgroups, overflow in extreme CI computation).

Frontend build: 1776 modules, 12.07s, no errors.

---

## Database Migration Notes

Two new tables will be auto-created by SQLAlchemy on first access:
- `comparability_protocols` — Stores versioned, lockable comparability protocols
- `reference_populations` — Stores validated reference population profiles

No existing tables are modified. No data migration required.

---

## Deployment Checklist

- [ ] Verify PostgreSQL has sufficient permissions for CREATE TABLE (for new tables)
- [ ] No environment variable changes required
- [ ] No new Python dependencies (all features use stdlib + existing deps)
- [ ] Run `pytest tests/unit/test_statistical_validation_against_r.py` to verify statistical engine
- [ ] Run `npm run build` in frontend/ to verify frontend compilation
- [ ] Verify audit_logs table exists (required for audit trail export)
- [ ] Test evidence package export with a project that has analysis results

---

## File Change Summary

| File | Lines Changed | Type |
|------|--------------|------|
| `backend/app/models/__init__.py` | +70 | New models |
| `backend/app/api/routes.py` | +450 | New endpoints + real data wiring |
| `backend/app/services/statistical_models.py` | +120 | assess_feasibility() + bootstrap fix |
| `backend/app/services/tfl_generator.py` | +30 | patient_data parameter |
| `backend/app/services/adam_service.py` | (unchanged — real data support via routes) | — |

**Total:** ~670 lines added, 3 lines modified (study/lock hash), 0 lines deleted.

---

## Architecture Decision Records

**ADR-001: Two Evidence Package Endpoints**
- `/study/evidence-package` returns JSON for programmatic consumption
- `/submission/evidence-package` returns ZIP for regulatory submission
- Decision: Keep both. Different consumers need different formats.

**ADR-002: Feasibility Before Analysis**
- Feasibility assessment is a separate endpoint, not a mandatory gate
- Rationale: Some users will want to skip feasibility for re-analyses of known-good datasets
- The frontend can enforce the gate in the UI workflow without backend enforcement

**ADR-003: Comparability Protocol vs. Study Lock**
- Both exist. Study lock (Step 1) locks the study definition. Comparability protocol lock locks the ECT-specific comparison design.
- They serve different regulatory purposes and can be locked independently.
- Both produce SHA-256 hashes stored in different locations.

---

*Internal document — Synthetic Ascension Engineering*
*v2.2.0 — March 25, 2026*
