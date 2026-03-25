"""Tests for the 6-phase Pre-Analysis Validation Gate.

Each phase is tested independently:
- Phase 1: Dataset Integrity (row counts, duplicates, structure)
- Phase 2: Variable Audit (required columns, temporal vars, type checks)
- Phase 3: Temporal & Logical Validation (immortal time bias, treatment after death)
- Phase 4: Causal Validity (SMD, overlap, Simpson's paradox, confounding)
- Phase 5: Model Permission Gate (composite decision)
- Phase 6: Output Summary (report structure)

Also tests the GLOBAL RULES:
- No cross-dataset memory
- No inferred variables
- No partial execution
- Dataset isolation
"""
import pytest
from app.services.pre_analysis_validator import PreAnalysisValidator


@pytest.fixture
def validator():
    return PreAnalysisValidator()


def _make_clean_dataset(n=40):
    """Generate a clean, balanced dataset that passes all phases."""
    rows = []
    for i in range(1, n + 1):
        rows.append({
            "USUBJID": f"S{i:03d}",
            "ARM": "Treatment" if i % 2 == 0 else "Control",
            "AGE": 45 + (i % 30),
            "SEX": 1 if i % 3 == 0 else 0,
            "OS_MONTHS": 6.0 + (i * 0.5),
            "EVENT": 1 if i % 3 != 0 else 0,
        })
    return rows


def _make_ipf_dataset_with_immortal_time():
    """IPF dataset with treatment_start_month — some patients have
    treatment_start > time_to_event (immortal time bias)."""
    rows = [
        {"patient_id": "IPF001", "time_to_event_months": 24.5, "event": 0, "treatment": 1,
         "fvc_baseline": 72.3, "age": 58, "sex": "M", "dlco_baseline": 45,
         "treatment_start_month": 2.0},
        {"patient_id": "IPF002", "time_to_event_months": 8.3, "event": 1, "treatment": 0,
         "fvc_baseline": 55.1, "age": 71, "sex": "M", "dlco_baseline": 32,
         "treatment_start_month": 0},
        {"patient_id": "IPF003", "time_to_event_months": 18.7, "event": 0, "treatment": 1,
         "fvc_baseline": 68.9, "age": 63, "sex": "F", "dlco_baseline": 41,
         "treatment_start_month": 1.5},
        # VIOLATION: treatment_start_month > time_to_event_months
        {"patient_id": "IPF004", "time_to_event_months": 5.2, "event": 1, "treatment": 1,
         "fvc_baseline": 48.2, "age": 76, "sex": "M", "dlco_baseline": 28,
         "treatment_start_month": 8.0},
        {"patient_id": "IPF005", "time_to_event_months": 3.1, "event": 1, "treatment": 1,
         "fvc_baseline": 42.0, "age": 80, "sex": "F", "dlco_baseline": 22,
         "treatment_start_month": 6.0},
    ]
    # Add more valid rows to have enough data
    for i in range(6, 35):
        rows.append({
            "patient_id": f"IPF{i:03d}",
            "time_to_event_months": 10.0 + i * 0.5,
            "event": 1 if i % 3 == 0 else 0,
            "treatment": 1 if i % 2 == 0 else 0,
            "fvc_baseline": 60 + (i % 20),
            "age": 50 + (i % 25),
            "sex": "M" if i % 2 else "F",
            "dlco_baseline": 35 + (i % 15),
            "treatment_start_month": 1.0 if i % 2 == 0 else 0,
        })
    return rows


# ═══════════════════════════════════════════════════════════════════════
# PHASE 1: DATASET INTEGRITY
# ═══════════════════════════════════════════════════════════════════════

class TestPhase1DatasetIntegrity:

    def test_clean_dataset_passes(self, validator):
        rows = _make_clean_dataset()
        verdict = validator.validate(rows)
        p1 = verdict.phases["Phase 1: Dataset Integrity"]
        assert p1["status"] == "PASS"

    def test_empty_input_blocked(self, validator):
        verdict = validator.validate([])
        assert verdict.blocked
        assert "Phase 1" in verdict.block_reasons[0]

    def test_none_input_blocked(self, validator):
        verdict = validator.validate(None)
        assert verdict.blocked

    def test_non_dict_rows_blocked(self, validator):
        rows = [{"USUBJID": "S001", "ARM": "Treatment", "OS_MONTHS": 10, "EVENT": 1},
                "this is not a dict",
                {"USUBJID": "S003", "ARM": "Control", "OS_MONTHS": 8, "EVENT": 0}]
        verdict = validator.validate(rows)
        assert verdict.blocked
        p1 = verdict.phases["Phase 1: Dataset Integrity"]
        critical = [f for f in p1["findings"] if f["severity"] == "CRITICAL"]
        assert any("Non-dict" in f["issue"] for f in critical)

    def test_duplicate_subject_ids_blocked(self, validator):
        rows = [
            {"USUBJID": "S001", "ARM": "Treatment", "OS_MONTHS": 10, "EVENT": 1},
            {"USUBJID": "S001", "ARM": "Treatment", "OS_MONTHS": 12, "EVENT": 0},  # duplicate
            {"USUBJID": "S002", "ARM": "Control", "OS_MONTHS": 8, "EVENT": 1},
        ]
        # Add enough rows to make it parseable
        for i in range(3, 25):
            rows.append({"USUBJID": f"S{i:03d}", "ARM": "Control" if i % 2 else "Treatment",
                        "OS_MONTHS": 10 + i, "EVENT": 1 if i % 3 else 0})
        verdict = validator.validate(rows)
        p1 = verdict.phases["Phase 1: Dataset Integrity"]
        dup_findings = [f for f in p1["findings"] if "Duplicate" in f.get("issue", "")]
        assert len(dup_findings) >= 1
        assert dup_findings[0]["severity"] == "CRITICAL"

    def test_duplicate_header_rows_detected(self, validator):
        """Rows where values match column names should be flagged as duplicate headers."""
        rows = [
            {"USUBJID": "S001", "ARM": "Treatment", "OS_MONTHS": 10, "EVENT": 1},
            {"USUBJID": "USUBJID", "ARM": "ARM", "OS_MONTHS": "OS_MONTHS", "EVENT": "EVENT"},  # header as data
            {"USUBJID": "S002", "ARM": "Control", "OS_MONTHS": 8, "EVENT": 0},
        ]
        for i in range(3, 25):
            rows.append({"USUBJID": f"S{i:03d}", "ARM": "Control" if i % 2 else "Treatment",
                        "OS_MONTHS": 10 + i, "EVENT": 1 if i % 3 else 0})
        verdict = validator.validate(rows)
        p1 = verdict.phases["Phase 1: Dataset Integrity"]
        header_findings = [f for f in p1["findings"]
                          if "header" in f.get("issue", "").lower() or "header" in f.get("detail", "").lower()]
        assert len(header_findings) >= 1

    def test_row_count_reconciliation(self, validator):
        rows = _make_clean_dataset(30)
        verdict = validator.validate(rows)
        p1 = verdict.phases["Phase 1: Dataset Integrity"]
        recon = [f for f in p1["findings"] if "reconciliation" in f.get("issue", "").lower()]
        assert len(recon) == 1
        assert "30" in recon[0]["detail"]
        assert recon[0]["severity"] == "INFO"


# ═══════════════════════════════════════════════════════════════════════
# PHASE 2: VARIABLE AUDIT
# ═══════════════════════════════════════════════════════════════════════

class TestPhase2VariableAudit:

    def test_all_required_vars_detected(self, validator):
        rows = _make_clean_dataset()
        verdict = validator.validate(rows)
        p2 = verdict.phases["Phase 2: Variable Audit"]
        assert p2["status"] == "PASS"
        present = [f for f in p2["findings"] if f.get("status") == "PRESENT" and f.get("variable") != "time_dependent_vars"]
        assert len(present) >= 3  # arm, time, event at minimum

    def test_missing_arm_blocks(self, validator):
        rows = [{"USUBJID": f"S{i:03d}", "OS_MONTHS": 10 + i, "EVENT": 1}
                for i in range(30)]
        verdict = validator.validate(rows)
        assert verdict.blocked
        p2 = verdict.phases["Phase 2: Variable Audit"]
        assert p2["status"] == "FAIL"
        missing = [f for f in p2["findings"] if f.get("status") == "MISSING"]
        assert any(f["variable"] == "arm" for f in missing)

    def test_missing_time_blocks(self, validator):
        rows = [{"USUBJID": f"S{i:03d}", "ARM": "Treatment" if i % 2 else "Control", "EVENT": 1}
                for i in range(30)]
        verdict = validator.validate(rows)
        assert verdict.blocked

    def test_temporal_vars_correctly_reported(self, validator):
        """Dataset WITHOUT treatment_start_month must NOT report immortal time findings."""
        rows = _make_clean_dataset()
        verdict = validator.validate(rows)
        p2 = verdict.phases["Phase 2: Variable Audit"]
        temporal = [f for f in p2["findings"] if f.get("variable") == "time_dependent_vars"]
        assert len(temporal) == 1
        assert temporal[0]["status"] == "ABSENT"
        assert "CANNOT be evaluated" in temporal[0]["note"]

    def test_temporal_vars_detected_when_present(self, validator):
        rows = _make_ipf_dataset_with_immortal_time()
        verdict = validator.validate(rows)
        p2 = verdict.phases["Phase 2: Variable Audit"]
        temporal = [f for f in p2["findings"] if f.get("variable") == "time_dependent_vars"]
        assert temporal[0]["status"] == "PRESENT"
        assert "treatment_start_month" in temporal[0]["present"]

    def test_no_cross_dataset_inference(self, validator):
        """Run validator on dataset A (with temporal vars), then dataset B (without).
        Dataset B must NOT carry temporal findings from dataset A."""
        dataset_a = _make_ipf_dataset_with_immortal_time()
        dataset_b = _make_clean_dataset()

        verdict_a = validator.validate(dataset_a)
        verdict_b = validator.validate(dataset_b)

        # Dataset B should have NO temporal violations
        p3_b = verdict_b.phases.get("Phase 3: Temporal & Logical Validation", {})
        if p3_b:
            critical = [f for f in p3_b["findings"] if f.get("severity") == "CRITICAL"]
            assert len(critical) == 0, "Dataset B inherited temporal findings from Dataset A!"

        # Dataset B should explicitly state temporal vars are absent
        p2_b = verdict_b.phases["Phase 2: Variable Audit"]
        temporal = [f for f in p2_b["findings"] if f.get("variable") == "time_dependent_vars"]
        assert temporal[0]["status"] == "ABSENT"


# ═══════════════════════════════════════════════════════════════════════
# PHASE 3: TEMPORAL & LOGICAL VALIDATION
# ═══════════════════════════════════════════════════════════════════════

class TestPhase3TemporalValidation:

    def test_no_temporal_vars_skips_phase(self, validator):
        rows = _make_clean_dataset()
        verdict = validator.validate(rows)
        p3 = verdict.phases["Phase 3: Temporal & Logical Validation"]
        assert p3["status"] == "SKIP"
        assert "CANNOT be assessed" in p3["findings"][0]["detail"]

    def test_immortal_time_bias_detected(self, validator):
        rows = _make_ipf_dataset_with_immortal_time()
        verdict = validator.validate(rows)
        p3 = verdict.phases["Phase 3: Temporal & Logical Validation"]
        assert p3["status"] == "FAIL"
        itb = [f for f in p3["findings"] if f.get("check") == "Immortal time bias"]
        assert len(itb) >= 1
        assert itb[0]["severity"] == "CRITICAL"
        assert itb[0]["n_violations"] >= 2  # IPF004 and IPF005

    def test_treatment_after_death_detected(self, validator):
        rows = _make_ipf_dataset_with_immortal_time()
        verdict = validator.validate(rows)
        p3 = verdict.phases["Phase 3: Temporal & Logical Validation"]
        death_findings = [f for f in p3["findings"] if f.get("check") == "Treatment after death"]
        assert len(death_findings) >= 1
        assert death_findings[0]["severity"] == "CRITICAL"

    def test_clean_temporal_data_passes(self, validator):
        """Dataset with treatment_start_month always <= time_to_event should pass."""
        rows = []
        for i in range(1, 35):
            rows.append({
                "patient_id": f"P{i:03d}",
                "time_to_event_months": 10.0 + i,
                "event": 1 if i % 3 == 0 else 0,
                "treatment": 1 if i % 2 == 0 else 0,
                "age": 50 + i,
                "treatment_start_month": 1.0 if i % 2 == 0 else 0,  # always < time_to_event
            })
        verdict = validator.validate(rows)
        p3 = verdict.phases["Phase 3: Temporal & Logical Validation"]
        assert p3["status"] == "PASS"


# ═══════════════════════════════════════════════════════════════════════
# PHASE 4: CAUSAL VALIDITY
# ═══════════════════════════════════════════════════════════════════════

class TestPhase4CausalValidity:

    def test_balanced_dataset_passes(self, validator):
        rows = _make_clean_dataset(40)
        verdict = validator.validate(rows)
        p4 = verdict.phases["Phase 4: Causal Validity"]
        assert p4["status"] in ("PASS", "WARN")

    def test_insufficient_events_blocked(self, validator):
        """If one arm has < 3 events, it should flag overlap issues."""
        rows = []
        for i in range(1, 30):
            rows.append({
                "USUBJID": f"S{i:03d}",
                "ARM": "Treatment" if i % 2 == 0 else "Control",
                "OS_MONTHS": 10 + i,
                "EVENT": 0,  # NO events at all
                "AGE": 50 + i,
            })
        # Add just 1 event in treatment
        rows[1]["EVENT"] = 1
        verdict = validator.validate(rows)
        p4 = verdict.phases["Phase 4: Causal Validity"]
        overlap = [f for f in p4["findings"] if f.get("check") == "Overlap / Positivity"]
        assert len(overlap) >= 1
        assert overlap[0]["severity"] == "CRITICAL"

    def test_extreme_imbalance_flagged(self, validator):
        """Large SMD should produce a warning."""
        rows = []
        for i in range(1, 41):
            arm = "Treatment" if i % 2 == 0 else "Control"
            # Create extreme age imbalance: Treatment avg ~70, Control avg ~30
            age = 70 + (i % 10) if arm == "Treatment" else 30 + (i % 10)
            rows.append({
                "USUBJID": f"S{i:03d}",
                "ARM": arm,
                "OS_MONTHS": 10 + i * 0.5,
                "EVENT": 1 if i % 3 else 0,
                "AGE": age,
            })
        verdict = validator.validate(rows)
        p4 = verdict.phases["Phase 4: Causal Validity"]
        smd_findings = [f for f in p4["findings"] if "SMD" in f.get("check", "")]
        assert len(smd_findings) >= 1
        assert smd_findings[0]["severity"] in ("WARNING", "MAJOR")

    def test_single_arm_fails(self, validator):
        rows = [{"USUBJID": f"S{i:03d}", "ARM": "Treatment", "OS_MONTHS": 10 + i, "EVENT": 1}
                for i in range(30)]
        verdict = validator.validate(rows)
        assert verdict.blocked


# ═══════════════════════════════════════════════════════════════════════
# PHASE 5: MODEL PERMISSION GATE
# ═══════════════════════════════════════════════════════════════════════

class TestPhase5ModelGate:

    def test_clean_dataset_allowed(self, validator):
        rows = _make_clean_dataset(40)
        verdict = validator.validate(rows)
        assert not verdict.blocked
        p5 = verdict.phases["Phase 5: Model Permission Gate"]
        assert p5["status"] == "PASS"
        assert "ALLOWED" in p5["detail"]

    def test_temporal_violation_blocks_models(self, validator):
        rows = _make_ipf_dataset_with_immortal_time()
        verdict = validator.validate(rows)
        assert verdict.blocked
        p5 = verdict.phases.get("Phase 5: Model Permission Gate")
        if p5:
            assert p5["status"] == "FAIL"

    def test_too_few_rows_blocks(self, validator):
        rows = _make_clean_dataset(15)  # < 20 minimum
        verdict = validator.validate(rows)
        p5 = verdict.phases.get("Phase 5: Model Permission Gate")
        if p5:
            min_size = [f for f in p5["findings"] if f.get("condition") == "minimum_sample_size"]
            if min_size:
                assert not min_size[0]["met"]


# ═══════════════════════════════════════════════════════════════════════
# PHASE 6: OUTPUT SUMMARY
# ═══════════════════════════════════════════════════════════════════════

class TestPhase6OutputSummary:

    def test_output_has_all_sections(self, validator):
        rows = _make_clean_dataset(40)
        verdict = validator.validate(rows)
        p6 = verdict.phases["Phase 6: Output Summary"]
        summary = p6["findings"][0]
        assert "A_dataset_integrity" in summary
        assert "B_parsing_inclusion_exclusion" in summary
        assert "C_variable_presence" in summary
        assert "D_temporal_validation" in summary
        assert "E_covariate_balance" in summary
        assert "F_causal_validity" in summary
        assert "G_model_decision" in summary
        assert "H_unsupported_claims" in summary

    def test_unsupported_claims_for_no_temporal_vars(self, validator):
        rows = _make_clean_dataset(40)
        verdict = validator.validate(rows)
        p6 = verdict.phases["Phase 6: Output Summary"]
        claims = p6["findings"][0]["H_unsupported_claims"]
        assert any("Immortal time bias" in c for c in claims)
        assert any("CANNOT" in c for c in claims)

    def test_verdict_dict_structure(self, validator):
        rows = _make_clean_dataset(40)
        verdict = validator.validate(rows)
        d = verdict.to_dict()
        assert "validation_timestamp" in d
        assert "model_execution_allowed" in d
        assert "verdict" in d
        assert d["verdict"] in ("ALLOWED", "BLOCKED")
        assert "phases" in d
        assert len(d["phases"]) == 6


# ═══════════════════════════════════════════════════════════════════════
# GLOBAL RULES: DATASET ISOLATION
# ═══════════════════════════════════════════════════════════════════════

class TestDatasetIsolation:

    def test_no_cross_session_contamination(self, validator):
        """Running validation twice on different datasets must produce
        completely independent results. No state leakage."""
        # Dataset 1: has immortal time bias
        ds1 = _make_ipf_dataset_with_immortal_time()
        v1 = validator.validate(ds1)
        assert v1.blocked  # Should be blocked due to temporal violations

        # Dataset 2: clean, no temporal vars
        ds2 = _make_clean_dataset(40)
        v2 = validator.validate(ds2)

        # Dataset 2 must NOT be blocked
        assert not v2.blocked, (
            "Clean dataset was blocked after validating a dirty dataset. "
            "Cross-session contamination detected!"
        )

        # Dataset 2 must have NO temporal violation findings
        p3 = v2.phases["Phase 3: Temporal & Logical Validation"]
        critical = [f for f in p3["findings"] if f.get("severity") == "CRITICAL"]
        assert len(critical) == 0, (
            f"Clean dataset inherited {len(critical)} CRITICAL temporal finding(s) from prior validation. "
            "This is a dataset isolation failure."
        )

    def test_validator_is_stateless(self, validator):
        """The validator instance should have no mutable state between calls."""
        ds1 = _make_clean_dataset(30)
        ds2 = _make_clean_dataset(50)

        v1 = validator.validate(ds1)
        v2 = validator.validate(ds2)

        # Row counts must match their respective datasets
        p1_v1 = v1.phases["Phase 1: Dataset Integrity"]
        p1_v2 = v2.phases["Phase 1: Dataset Integrity"]
        recon_v1 = [f for f in p1_v1["findings"] if "reconciliation" in f.get("issue", "").lower()]
        recon_v2 = [f for f in p1_v2["findings"] if "reconciliation" in f.get("issue", "").lower()]
        assert "30" in recon_v1[0]["detail"]
        assert "50" in recon_v2[0]["detail"]

    def test_fresh_validator_same_results(self):
        """A new validator instance must produce identical results to reusing one."""
        ds = _make_clean_dataset(40)
        v1 = PreAnalysisValidator()
        v2 = PreAnalysisValidator()

        result1 = v1.validate(ds)
        result2 = v2.validate(ds)

        assert result1.blocked == result2.blocked
        assert set(result1.phases.keys()) == set(result2.phases.keys())
        for phase in result1.phases:
            assert result1.phases[phase]["status"] == result2.phases[phase]["status"]
