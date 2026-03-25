"""
Pre-Analysis Validation Gate
=============================
Hard gate that runs BEFORE any statistical model is allowed to execute.
Implements 6 phases of validation with ZERO tolerance for:
- Silent data loss
- Malformed datasets
- Invalid temporal logic
- Unsupported causal assumptions
- Cross-session contamination

If ANY phase fails, modeling is BLOCKED.
"""
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class ValidationVerdict:
    """Immutable result of the pre-analysis validation gate."""

    def __init__(self):
        self.phases: Dict[str, dict] = {}
        self.blocked: bool = False
        self.block_reasons: List[str] = []
        self.timestamp: str = datetime.utcnow().isoformat() + "Z"

    def add_phase(self, name: str, status: str, findings: list, detail: str = ""):
        self.phases[name] = {
            "status": status,  # PASS | FAIL | WARN | SKIP
            "findings": findings,
            "detail": detail,
        }
        if status == "FAIL":
            self.blocked = True
            self.block_reasons.append(f"{name}: {detail}")

    def to_dict(self) -> dict:
        return {
            "validation_timestamp": self.timestamp,
            "model_execution_allowed": not self.blocked,
            "verdict": "BLOCKED" if self.blocked else "ALLOWED",
            "block_reasons": self.block_reasons,
            "phases": self.phases,
        }


class PreAnalysisValidator:
    """6-phase validation gate. Stateless by design — every call is independent."""

    # Required columns for survival analysis
    REQUIRED_SCHEMA = {
        "subject_id": ["USUBJID", "SUBJID", "patient_id", "subject_id", "id", "ID"],
        "arm": ["ARM", "TRT01P", "ARMCD", "treatment", "TREATMENT", "arm", "group"],
        "time": ["AVAL", "TIME", "time_to_event", "OS_MONTHS", "PFS_MONTHS",
                 "time_to_event_months", "months", "duration", "follow_up",
                 "EFS_MONTHS", "DFS_MONTHS", "SURVTIME", "TTR",
                 "TIME_TO_RESOLUTION", "RESOLUTION_TIME"],
        "event": ["CNSR", "EVENT", "event_indicator", "STATUS", "EVNTFL",
                  "event", "censor", "outcome", "COMPLETE_RESOLUTION",
                  "RESOLUTION", "response"],
    }

    # Time-dependent variables that enable temporal validation
    TEMPORAL_VARS = [
        "treatment_start_month", "treatment_start_date", "enrollment_date",
        "randomization_date", "treatment_start", "trt_start_month",
    ]

    def __init__(self):
        # No instance state — each validate() call is fully independent
        pass

    def validate(self, raw_rows: list, column_mapping: dict = None) -> ValidationVerdict:
        """Run all 6 phases on the raw input data.

        Args:
            raw_rows: List of dicts (the raw JSON from PatientDataset.data_content)
            column_mapping: Optional explicit mapping {"arm": "ARM", ...}

        Returns:
            ValidationVerdict with per-phase results and final decision.
        """
        import pandas as pd

        verdict = ValidationVerdict()

        # ================================================================
        # PHASE 1: DATASET INTEGRITY
        # ================================================================
        phase1_findings = []

        if not raw_rows or not isinstance(raw_rows, list):
            verdict.add_phase(
                "Phase 1: Dataset Integrity", "FAIL",
                [{"issue": "Empty or invalid input", "severity": "CRITICAL"}],
                "Input is empty or not a list of records."
            )
            return verdict

        n_raw = len(raw_rows)

        # Check each row is a dict
        non_dict_rows = [i for i, r in enumerate(raw_rows) if not isinstance(r, dict)]
        if non_dict_rows:
            phase1_findings.append({
                "issue": "Non-dict rows",
                "severity": "CRITICAL",
                "detail": f"{len(non_dict_rows)} rows are not valid records (indices: {non_dict_rows[:10]})"
            })

        # Check for consistent column sets
        if n_raw > 0 and not non_dict_rows:
            first_keys = set(raw_rows[0].keys())
            inconsistent_rows = []
            for i, row in enumerate(raw_rows[1:], start=1):
                if set(row.keys()) != first_keys:
                    inconsistent_rows.append({
                        "row": i,
                        "extra": list(set(row.keys()) - first_keys),
                        "missing": list(first_keys - set(row.keys())),
                    })
            if inconsistent_rows:
                phase1_findings.append({
                    "issue": "Inconsistent columns across rows",
                    "severity": "MAJOR",
                    "detail": (f"{len(inconsistent_rows)} rows have different columns than row 0. "
                              f"First mismatch at row {inconsistent_rows[0]['row']}: "
                              f"extra={inconsistent_rows[0]['extra']}, missing={inconsistent_rows[0]['missing']}")
                })

        # Detect duplicate header rows embedded as data
        if n_raw > 1 and not non_dict_rows:
            header_keys = list(raw_rows[0].keys())
            header_as_values = []
            for i, row in enumerate(raw_rows):
                vals = list(row.values())
                str_vals = [str(v).strip() for v in vals]
                # If a row's values match the header names, it's a duplicate header
                overlap = sum(1 for v in str_vals if v in header_keys)
                if overlap >= max(2, len(header_keys) * 0.6):
                    header_as_values.append(i)
            if header_as_values:
                phase1_findings.append({
                    "issue": "Duplicate header rows in data",
                    "severity": "CRITICAL",
                    "detail": (f"Rows {header_as_values} appear to be header rows embedded as data. "
                              "Dataset may be concatenated.")
                })

        # Convert to DataFrame for further checks
        try:
            df = pd.DataFrame(raw_rows)
        except Exception as exc:
            verdict.add_phase(
                "Phase 1: Dataset Integrity", "FAIL",
                phase1_findings + [{"issue": "DataFrame conversion failed",
                                    "severity": "CRITICAL", "detail": str(exc)}],
                f"Cannot convert input to DataFrame: {exc}"
            )
            return verdict

        n_parsed = len(df)
        phase1_findings.append({
            "issue": "Row count reconciliation",
            "severity": "INFO" if n_raw == n_parsed else "CRITICAL",
            "detail": f"Raw input: {n_raw} rows, Parsed: {n_parsed} rows. "
                     + ("Match." if n_raw == n_parsed else "MISMATCH — data loss detected.")
        })

        if n_raw != n_parsed:
            verdict.add_phase(
                "Phase 1: Dataset Integrity", "FAIL", phase1_findings,
                f"Row count mismatch: {n_raw} raw vs {n_parsed} parsed."
            )
            return verdict

        # Check for duplicate subject IDs
        id_col = self._find_col(df, self.REQUIRED_SCHEMA["subject_id"], column_mapping, "subject_id")
        if id_col:
            n_unique = df[id_col].nunique()
            n_total = len(df)
            dupes = df[df[id_col].duplicated(keep=False)]
            if len(dupes) > 0:
                dupe_ids = dupes[id_col].unique().tolist()[:10]
                phase1_findings.append({
                    "issue": "Duplicate subject IDs",
                    "severity": "CRITICAL",
                    "detail": (f"{n_total - n_unique} duplicate entries for {len(dupe_ids)} subject(s). "
                              f"IDs: {dupe_ids}")
                })
            else:
                phase1_findings.append({
                    "issue": "Subject ID uniqueness",
                    "severity": "INFO",
                    "detail": f"All {n_unique} subject IDs are unique."
                })

        has_critical_p1 = any(f["severity"] == "CRITICAL" for f in phase1_findings)
        verdict.add_phase(
            "Phase 1: Dataset Integrity",
            "FAIL" if has_critical_p1 else "PASS",
            phase1_findings,
            f"{'BLOCKED: ' + '; '.join(f['detail'] for f in phase1_findings if f['severity'] == 'CRITICAL')}"
            if has_critical_p1 else f"Clean: {n_parsed} rows, {df.shape[1]} columns."
        )

        if has_critical_p1:
            return verdict

        # ================================================================
        # PHASE 2: VARIABLE AUDIT
        # ================================================================
        phase2_findings = []
        all_columns = list(df.columns)
        col_lower = {c.lower(): c for c in all_columns}

        detected = {}
        missing_required = []
        for role, candidates in self.REQUIRED_SCHEMA.items():
            found = self._find_col(df, candidates, column_mapping, role)
            if found:
                detected[role] = found
                phase2_findings.append({
                    "variable": role,
                    "mapped_to": found,
                    "status": "PRESENT",
                })
            else:
                missing_required.append(role)
                phase2_findings.append({
                    "variable": role,
                    "mapped_to": None,
                    "status": "MISSING",
                })

        # Detect time-dependent variables
        temporal_present = []
        temporal_absent = []
        for tv in self.TEMPORAL_VARS:
            if tv.lower() in col_lower:
                temporal_present.append(col_lower[tv.lower()])
            else:
                temporal_absent.append(tv)

        phase2_findings.append({
            "variable": "time_dependent_vars",
            "present": temporal_present,
            "absent": temporal_absent,
            "status": "PRESENT" if temporal_present else "ABSENT",
            "note": ("Time-dependent variables found — temporal validation will be performed."
                    if temporal_present else
                    "No time-dependent variables found. Temporal validation (e.g., immortal time bias) "
                    "CANNOT be evaluated and will NOT be inferred from prior analyses.")
        })

        # Schema: detect mixed types in numeric columns
        type_issues = []
        for role in ["time", "event"]:
            col = detected.get(role)
            if col:
                numeric = pd.to_numeric(df[col], errors="coerce")
                n_coerced = numeric.isna().sum() - df[col].isna().sum()
                if n_coerced > 0:
                    type_issues.append({
                        "column": col,
                        "issue": f"{n_coerced} values are non-numeric (stored as text?)",
                        "severity": "MAJOR",
                    })

        if type_issues:
            phase2_findings.extend([{**t, "variable": "type_check"} for t in type_issues])

        critical_missing = [m for m in missing_required if m in ("arm", "time", "event")]
        if critical_missing:
            verdict.add_phase(
                "Phase 2: Variable Audit", "FAIL", phase2_findings,
                f"Missing required variables for survival analysis: {critical_missing}"
            )
            return verdict

        verdict.add_phase(
            "Phase 2: Variable Audit",
            "WARN" if missing_required else "PASS",
            phase2_findings,
            f"Detected: {list(detected.keys())}. Missing: {missing_required or 'None'}. "
            f"Time-dependent vars: {temporal_present or 'None'}."
        )

        # ================================================================
        # PHASE 3: TEMPORAL & LOGICAL VALIDATION
        # ================================================================
        phase3_findings = []
        arm_col = detected.get("arm")
        time_col = detected.get("time")
        event_col = detected.get("event")

        if temporal_present:
            for tv_col in temporal_present:
                tv_vals = pd.to_numeric(df[tv_col], errors="coerce")
                time_vals = pd.to_numeric(df[time_col], errors="coerce")
                event_vals = pd.to_numeric(df[event_col], errors="coerce")

                violations = []

                # Check treatment_start > time_to_event (treatment after death/censoring)
                mask_after_event = tv_vals > time_vals
                if mask_after_event.any():
                    affected = df.index[mask_after_event & tv_vals.notna() & time_vals.notna()].tolist()
                    for idx in affected[:20]:
                        subj = df.at[idx, detected["subject_id"]] if "subject_id" in detected else f"row_{idx}"
                        violations.append({
                            "row": idx,
                            "subject": str(subj),
                            "issue": "treatment_start > time_to_event",
                            "treatment_start": float(tv_vals.iloc[idx]) if pd.notna(tv_vals.iloc[idx]) else None,
                            "time_to_event": float(time_vals.iloc[idx]) if pd.notna(time_vals.iloc[idx]) else None,
                            "event": int(event_vals.iloc[idx]) if pd.notna(event_vals.iloc[idx]) else None,
                        })

                    n_violations = int(mask_after_event.sum())
                    # Calculate immortal time
                    immortal_time = (tv_vals[mask_after_event & tv_vals.notna()] -
                                    time_vals[mask_after_event & time_vals.notna()])
                    total_immortal = float(immortal_time.sum()) if len(immortal_time) > 0 else 0

                    phase3_findings.append({
                        "check": "Immortal time bias",
                        "severity": "CRITICAL",
                        "n_violations": n_violations,
                        "total_immortal_time": round(total_immortal, 1),
                        "detail": (f"{n_violations} patients have treatment_start_month > time_to_event_months. "
                                  f"Total immortal person-time: {round(total_immortal, 1)} months. "
                                  "These patients received treatment AFTER their recorded endpoint."),
                        "violations": violations,
                    })

                # Check treatment after death (event=1 and treatment_start > time)
                mask_after_death = (event_vals == 1) & (tv_vals > time_vals)
                if mask_after_death.any():
                    n_dead = int(mask_after_death.sum())
                    phase3_findings.append({
                        "check": "Treatment after death",
                        "severity": "CRITICAL",
                        "detail": f"{n_dead} patients received treatment after recorded death event."
                    })

            if not phase3_findings:
                phase3_findings.append({
                    "check": "Temporal consistency",
                    "severity": "INFO",
                    "detail": "All temporal relationships are logically consistent."
                })
        else:
            phase3_findings.append({
                "check": "Temporal validation",
                "severity": "INFO",
                "detail": ("No time-dependent variables (e.g., treatment_start_month) present in dataset. "
                          "Temporal validation SKIPPED. Immortal time bias CANNOT be assessed. "
                          "This finding is derived ONLY from the current dataset's column structure — "
                          "not from any prior analysis.")
            })

        has_temporal_critical = any(f["severity"] == "CRITICAL" for f in phase3_findings)
        verdict.add_phase(
            "Phase 3: Temporal & Logical Validation",
            "FAIL" if has_temporal_critical else ("SKIP" if not temporal_present else "PASS"),
            phase3_findings,
            "BLOCKED: Temporal violations detected." if has_temporal_critical else
            ("Skipped — no time-dependent variables." if not temporal_present else "No temporal violations.")
        )

        # ================================================================
        # PHASE 4: CAUSAL VALIDITY CHECK
        # ================================================================
        import numpy as np

        phase4_findings = []
        df_analysis = df.copy()

        # Coerce critical columns
        df_analysis[time_col] = pd.to_numeric(df_analysis[time_col], errors="coerce")
        df_analysis[event_col] = pd.to_numeric(df_analysis[event_col], errors="coerce")

        # Drop rows with missing critical values (with audit)
        na_mask = df_analysis[arm_col].isna() | df_analysis[time_col].isna() | df_analysis[event_col].isna()
        n_excluded = int(na_mask.sum())
        df_valid = df_analysis[~na_mask].copy()

        if n_excluded > 0:
            phase4_findings.append({
                "check": "Inclusion/Exclusion",
                "severity": "WARNING",
                "detail": f"{n_excluded} of {len(df_analysis)} rows excluded due to missing arm/time/event values.",
                "n_included": len(df_valid),
                "n_excluded": n_excluded,
            })

        arms = df_valid[arm_col].unique()
        if len(arms) < 2:
            verdict.add_phase(
                "Phase 4: Causal Validity", "FAIL", phase4_findings,
                f"Only {len(arms)} treatment group(s) found. Need >= 2 for causal comparison."
            )
            if has_temporal_critical:
                return verdict
            # Continue to collect all issues before final gate

        # 4a. Covariate Balance (SMD)
        if len(arms) >= 2:
            # Identify control vs treated
            CONTROL_KEYWORDS = {"untreated", "placebo", "control", "standard", "soc", "bsc"}
            str_arms = [str(a) for a in arms]
            lower_arms = [a.lower().replace(" ", "_").replace("-", "_") for a in str_arms]

            control_idx = None
            for i, la in enumerate(lower_arms):
                if any(kw in la for kw in CONTROL_KEYWORDS):
                    control_idx = i
                    break
            if control_idx is None:
                sorted_arms = sorted(str_arms)
                control_label, treated_label = sorted_arms[0], sorted_arms[-1]
            else:
                control_label = str_arms[control_idx]
                treated_label = str_arms[1 - control_idx] if len(arms) == 2 else "Combined"

            g_ctrl = df_valid[df_valid[arm_col].astype(str) == control_label]
            g_trt = df_valid[df_valid[arm_col].astype(str) != control_label]

            phase4_findings.append({
                "check": "Arm sizes",
                "severity": "INFO",
                "detail": f"Control ({control_label}): n={len(g_ctrl)}, Treated ({treated_label}): n={len(g_trt)}."
            })

            # Compute SMD for all numeric covariates
            exclude_cols = {arm_col.lower(), time_col.lower(), event_col.lower()}
            id_col_name = detected.get("subject_id", "")
            if id_col_name:
                exclude_cols.add(id_col_name.lower())
            # Also exclude temporal vars
            for tv in temporal_present:
                exclude_cols.add(tv.lower())

            smd_table = []
            imbalanced = []
            for col in df_valid.columns:
                if col.lower() in exclude_cols:
                    continue
                numeric = pd.to_numeric(df_valid[col], errors="coerce")
                if numeric.notna().sum() < len(df_valid) * 0.3:
                    continue

                m1 = pd.to_numeric(g_ctrl[col], errors="coerce").mean()
                m2 = pd.to_numeric(g_trt[col], errors="coerce").mean()
                s1 = pd.to_numeric(g_ctrl[col], errors="coerce").std()
                s2 = pd.to_numeric(g_trt[col], errors="coerce").std()

                if pd.isna(m1) or pd.isna(m2):
                    continue

                pooled_sd = np.sqrt((s1**2 + s2**2) / 2) if (s1 > 0 or s2 > 0) else 1.0
                smd = abs(m1 - m2) / pooled_sd if pooled_sd > 0 else 0.0

                entry = {
                    "covariate": col,
                    "smd": round(float(smd), 4),
                    "control_mean": round(float(m1), 3),
                    "treated_mean": round(float(m2), 3),
                    "imbalanced": smd > 0.1,
                }
                smd_table.append(entry)
                if smd > 0.1:
                    imbalanced.append(entry)

            smd_table.sort(key=lambda x: x["smd"], reverse=True)

            if imbalanced:
                phase4_findings.append({
                    "check": "Covariate balance (SMD > 0.1)",
                    "severity": "WARNING" if len(imbalanced) <= 2 else "MAJOR",
                    "detail": (f"{len(imbalanced)} of {len(smd_table)} covariates exceed SMD threshold of 0.1. "
                              f"Worst: {imbalanced[0]['covariate']} (SMD={imbalanced[0]['smd']})."),
                    "imbalanced_covariates": imbalanced,
                    "full_smd_table": smd_table,
                })
            else:
                phase4_findings.append({
                    "check": "Covariate balance",
                    "severity": "INFO",
                    "detail": f"All {len(smd_table)} covariates have SMD <= 0.1. Adequate balance.",
                    "full_smd_table": smd_table,
                })

            # 4b. Overlap / Positivity
            # Check if both arms have events
            events_ctrl = pd.to_numeric(g_ctrl[event_col], errors="coerce").sum()
            events_trt = pd.to_numeric(g_trt[event_col], errors="coerce").sum()

            if event_col.lower() in ("cnsr", "censor"):
                events_ctrl = len(g_ctrl) - events_ctrl
                events_trt = len(g_trt) - events_trt

            if events_ctrl < 3 or events_trt < 3:
                phase4_findings.append({
                    "check": "Overlap / Positivity",
                    "severity": "CRITICAL",
                    "detail": (f"Insufficient events: Control has {int(events_ctrl)} events, "
                              f"Treated has {int(events_trt)} events. Minimum 3 per arm required."),
                })
            else:
                phase4_findings.append({
                    "check": "Overlap / Positivity",
                    "severity": "INFO",
                    "detail": f"Events: Control={int(events_ctrl)}, Treated={int(events_trt)}. Sufficient.",
                })

            # Check for empty strata in key covariates
            positivity_violations = []
            for cov_entry in smd_table[:5]:  # check top 5 covariates
                col = cov_entry["covariate"]
                numeric_col = pd.to_numeric(df_valid[col], errors="coerce")
                if numeric_col.notna().sum() < 10:
                    continue
                # Split at median
                med = numeric_col.median()
                for stratum, label in [("low", numeric_col <= med), ("high", numeric_col > med)]:
                    stratum_data = df_valid[label]
                    arms_in_stratum = stratum_data[arm_col].nunique()
                    if arms_in_stratum < 2:
                        positivity_violations.append(f"{col} {stratum}: only 1 arm represented")

            if positivity_violations:
                phase4_findings.append({
                    "check": "Positivity violations",
                    "severity": "MAJOR",
                    "detail": f"{len(positivity_violations)} strata have insufficient arm overlap: {positivity_violations}",
                })

            # 4c. Subgroup Consistency
            subgroup_findings = []
            for col in df_valid.columns:
                if col.lower() in exclude_cols:
                    continue
                numeric_col = pd.to_numeric(df_valid[col], errors="coerce")
                if numeric_col.notna().sum() < len(df_valid) * 0.5:
                    continue
                med = numeric_col.median()
                if pd.isna(med):
                    continue

                for stratum_label, mask in [("below_median", numeric_col <= med),
                                            ("above_median", numeric_col > med)]:
                    sub = df_valid[mask]
                    if len(sub) < 10:
                        continue
                    sub_arms = sub[arm_col].unique()
                    if len(sub_arms) < 2:
                        continue
                    # Quick event rate comparison
                    sub_events = pd.to_numeric(sub[event_col], errors="coerce")
                    if event_col.lower() in ("cnsr", "censor"):
                        sub_events = 1 - sub_events
                    ctrl_rate = sub_events[sub[arm_col].astype(str) == control_label].mean()
                    trt_rate = sub_events[sub[arm_col].astype(str) != control_label].mean()

                    if pd.notna(ctrl_rate) and pd.notna(trt_rate):
                        subgroup_findings.append({
                            "covariate": col,
                            "stratum": stratum_label,
                            "control_event_rate": round(float(ctrl_rate), 3),
                            "treated_event_rate": round(float(trt_rate), 3),
                            "direction": "treatment_benefit" if trt_rate < ctrl_rate else "treatment_harm",
                        })

            # Detect effect reversal (Simpson's paradox signal)
            effect_reversals = []
            covariates_checked = set()
            for sf in subgroup_findings:
                cov = sf["covariate"]
                if cov in covariates_checked:
                    continue
                strata = [s for s in subgroup_findings if s["covariate"] == cov]
                if len(strata) >= 2:
                    covariates_checked.add(cov)
                    directions = set(s["direction"] for s in strata)
                    if len(directions) > 1:
                        effect_reversals.append({
                            "covariate": cov,
                            "detail": f"Treatment effect REVERSES across {cov} strata (Simpson's paradox signal)",
                            "strata": strata,
                        })

            if effect_reversals:
                phase4_findings.append({
                    "check": "Subgroup consistency / Simpson's paradox",
                    "severity": "MAJOR",
                    "detail": (f"Effect reversal detected across {len(effect_reversals)} covariate(s): "
                              f"{[er['covariate'] for er in effect_reversals]}. "
                              "Aggregate treatment effect may be misleading."),
                    "reversals": effect_reversals,
                })
            elif subgroup_findings:
                phase4_findings.append({
                    "check": "Subgroup consistency",
                    "severity": "INFO",
                    "detail": "No effect reversals detected across subgroups.",
                })

            # 4d. Confounding Assessment
            confounding_drivers = []
            for entry in smd_table:
                if entry["smd"] > 0.2:
                    confounding_drivers.append(entry["covariate"])
            if confounding_drivers:
                phase4_findings.append({
                    "check": "Confounding assessment",
                    "severity": "WARNING",
                    "detail": (f"Variables driving treatment assignment (SMD > 0.2): {confounding_drivers}. "
                              "These must be adjusted for in any causal model."),
                })

        has_critical_p4 = any(f.get("severity") == "CRITICAL" for f in phase4_findings)
        has_major_p4 = any(f.get("severity") == "MAJOR" for f in phase4_findings)

        if has_critical_p4:
            p4_status = "FAIL"
            p4_detail = "BLOCKED: Critical causal validity issues."
        elif has_major_p4:
            p4_status = "WARN"
            p4_detail = "Causal assumptions are weakened. Proceed with caution and adjustment methods."
        else:
            p4_status = "PASS"
            p4_detail = "Causal validity checks passed."

        verdict.add_phase("Phase 4: Causal Validity", p4_status, phase4_findings, p4_detail)

        # ================================================================
        # PHASE 5: MODEL PERMISSION GATE
        # ================================================================
        phase5_findings = []
        conditions = {
            "dataset_integrity": verdict.phases.get("Phase 1: Dataset Integrity", {}).get("status") == "PASS",
            "variable_audit": verdict.phases.get("Phase 2: Variable Audit", {}).get("status") in ("PASS", "WARN"),
            "temporal_valid": verdict.phases.get("Phase 3: Temporal & Logical Validation", {}).get("status") in ("PASS", "SKIP"),
            "causal_valid": verdict.phases.get("Phase 4: Causal Validity", {}).get("status") in ("PASS", "WARN"),
        }

        for cond_name, passed in conditions.items():
            phase5_findings.append({
                "condition": cond_name,
                "met": passed,
            })

        all_conditions_met = all(conditions.values())

        if all_conditions_met:
            # Additional check: is the sample sufficient?
            if len(df_valid) < 20:
                phase5_findings.append({
                    "condition": "minimum_sample_size",
                    "met": False,
                    "detail": f"Only {len(df_valid)} valid rows. Minimum 20 required for reliable inference."
                })
                all_conditions_met = False

        gate_detail = ""
        if all_conditions_met:
            gate_detail = (f"ALL conditions met. Cox PH, KM, and propensity score methods are ALLOWED. "
                          f"N={len(df_valid)} patients.")
            if has_major_p4:
                gate_detail += (" NOTE: Causal assumptions are weakened — propensity score adjustment "
                               "or IPTW is REQUIRED, not optional.")
        else:
            failed = [k for k, v in conditions.items() if not v]
            gate_detail = f"BLOCKED. Failed conditions: {failed}. Models will NOT execute."

        verdict.add_phase(
            "Phase 5: Model Permission Gate",
            "PASS" if all_conditions_met else "FAIL",
            phase5_findings,
            gate_detail,
        )

        # ================================================================
        # PHASE 6: OUTPUT SUMMARY
        # ================================================================
        phase6 = {
            "A_dataset_integrity": verdict.phases.get("Phase 1: Dataset Integrity", {}).get("status"),
            "B_parsing_inclusion_exclusion": {
                "total_input": n_raw,
                "total_analyzed": len(df_valid) if 'df_valid' in dir() else 0,
                "total_excluded": n_excluded if 'n_excluded' in dir() else 0,
            },
            "C_variable_presence": {
                "detected": detected,
                "missing": missing_required,
                "temporal_vars_present": temporal_present,
                "temporal_vars_absent": temporal_absent[:5],
            },
            "D_temporal_validation": verdict.phases.get("Phase 3: Temporal & Logical Validation", {}).get("status"),
            "E_covariate_balance": "See Phase 4 findings",
            "F_causal_validity": verdict.phases.get("Phase 4: Causal Validity", {}).get("status"),
            "G_model_decision": "ALLOWED" if all_conditions_met else "BLOCKED",
            "H_unsupported_claims": [],
        }

        # Build unsupported claims list
        if not temporal_present:
            phase6["H_unsupported_claims"].append(
                "Immortal time bias assessment: CANNOT be evaluated (no treatment_start variable in dataset)"
            )
        if has_major_p4 and all_conditions_met:
            phase6["H_unsupported_claims"].append(
                "Naive (unadjusted) causal inference: NOT supported due to covariate imbalance. "
                "Propensity-score-adjusted analysis required."
            )
        if effect_reversals if 'effect_reversals' in dir() else []:
            phase6["H_unsupported_claims"].append(
                "Aggregate treatment effect: may be misleading due to Simpson's paradox signal. "
                "Stratified analysis required."
            )

        verdict.add_phase("Phase 6: Output Summary", "INFO", [phase6], "Validation complete.")

        return verdict

    def _find_col(self, df, candidates: list, mapping: dict = None, key: str = None) -> Optional[str]:
        """Find a column in the DataFrame by candidate names (case-insensitive)."""
        if mapping and key and key in mapping:
            val = mapping[key]
            if val in df.columns:
                return val
            for c in df.columns:
                if c.lower() == val.lower():
                    return c
        for cand in candidates:
            for c in df.columns:
                if c.lower() == cand.lower():
                    return c
        return None
