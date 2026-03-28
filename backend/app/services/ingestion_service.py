"""
Patient-Level Data Ingestion & Regulatory Compliance Service

Implements HIPAA Safe Harbor scanning, SDTM conformance checks,
missing data pattern analysis, baseline balance signals, temporal
consistency checks, duplicate detection, arm balance, and
implausible value detection.
"""

import json
import hashlib
from datetime import datetime


class IngestionService:
    """Patient-Level Data Ingestion & Regulatory Compliance Service.

    Implements HIPAA Safe Harbor scanning, SDTM conformance checks,
    missing data pattern analysis, baseline balance signals, temporal
    consistency checks, duplicate detection, arm balance, and
    implausible value detection.
    """

    # The 18 Safe Harbor identifiers to scan for
    SAFE_HARBOR_IDENTIFIERS = [
        "name", "address", "city", "state", "zip", "zipcode", "zip_code",
        "date_of_birth", "dob", "birth_date", "birthdate",
        "phone", "telephone", "fax",
        "email", "e_mail", "email_address",
        "ssn", "social_security", "social_security_number",
        "mrn", "medical_record", "medical_record_number",
        "health_plan", "health_plan_number", "insurance_id",
        "account_number", "acct", "account_no",
        "certificate", "license", "license_number",
        "vin", "vehicle_identification",
        "device_identifier", "device_id", "udi",
        "url", "web_address", "website",
        "ip_address", "ip_addr",
        "biometric", "fingerprint", "retinal",
        "photograph", "photo", "facial",
        "patient_name", "first_name", "last_name", "surname",
    ]

    # Regex patterns for value-level PII detection
    PII_PATTERNS = {
        "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
        "Phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
        "Email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
        "ZIP_Code": r"\b\d{5}(-\d{4})?\b",
        "Date_MMDDYYYY": r"\b\d{1,2}/\d{1,2}/\d{4}\b",
        "MRN_Pattern": r"\b(MRN|mrn)[:\s]?\d{6,}\b",
        "IP_Address": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
    }

    REQUIRED_COLUMNS = ["USUBJID", "ARM"]
    KEY_ANALYSIS_COLUMNS = ["AGE", "SEX"]

    SDTM_STANDARD_VARS = {
        "USUBJID", "STUDYID", "SITEID", "ARM", "ARMCD",
        "RFSTDTC", "RFENDTC", "AGE", "AGEU", "SEX", "RACE",
        "COUNTRY", "DTHFL", "DTHDTC",
    }

    def __init__(self):
        pass

    def generate_attestation_hash(self, attestation_text: str, user_id: str, timestamp: str) -> str:
        """Generate SHA-256 hash of attestation + user + timestamp."""
        payload = f"{attestation_text}|{user_id}|{timestamp}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def generate_file_hash(self, file_content: bytes) -> str:
        """Generate SHA-256 hash of file content."""
        return hashlib.sha256(file_content).hexdigest()

    def generate_row_hashes(self, df) -> list:
        """Generate SHA-256 hash for each row."""
        hashes = []
        for _, row in df.iterrows():
            row_str = "|".join(str(v) for v in row.values)
            hashes.append(hashlib.sha256(row_str.encode()).hexdigest())
        return hashes

    def parse_file(self, file_content: bytes, filename: str):
        """Parse uploaded file into a pandas DataFrame.

        Returns (df, parse_warnings, error_message) where parse_warnings is a
        list of CRITICAL/MAJOR findings discovered during parsing itself
        (before the 8 regulatory checks run).  An empty list means clean parse.

        A regulatory-grade parser must NEVER silently drop rows.  Every
        discrepancy between raw line count and DataFrame row count is surfaced
        as a CRITICAL finding so the analyst can decide whether to proceed.
        """
        import pandas as pd
        import io

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        parse_warnings = []  # findings generated during parse

        try:
            if ext == "csv":
                df, csv_warnings = self._parse_csv_strict(file_content)
                parse_warnings.extend(csv_warnings)
            elif ext in ("xlsx", "xls"):
                df = pd.read_excel(io.BytesIO(file_content))
            elif ext == "xpt":
                try:
                    import pyreadstat
                    df, meta = pyreadstat.read_xport(io.BytesIO(file_content))
                except ImportError:
                    df = pd.read_sas(io.BytesIO(file_content), format="xport")
            elif ext == "sas7bdat":
                try:
                    import pyreadstat
                    df, meta = pyreadstat.read_sas7bdat(io.BytesIO(file_content))
                except ImportError:
                    df = pd.read_sas(io.BytesIO(file_content))
            else:
                return None, [], f"Unsupported file type: .{ext}. Accepted: .csv, .xlsx, .xpt, .sas7bdat"

            if len(df) == 0:
                return None, parse_warnings, "File contains 0 rows."

            # Any CRITICAL parse warning means the file is not trustworthy
            critical_parse = [w for w in parse_warnings if w["severity"] == "CRITICAL"]
            if critical_parse:
                return None, parse_warnings, (
                    f"File rejected: {len(critical_parse)} CRITICAL parsing issue(s) detected. "
                    + "; ".join(w["detail"] for w in critical_parse)
                )

            return df, parse_warnings, None
        except Exception as e:
            return None, parse_warnings, f"Failed to parse file: {str(e)}"

    def _parse_csv_strict(self, file_content: bytes):
        """Parse CSV with strict row-count verification and malformed-row detection.

        Returns (df, warnings) where warnings is a list of finding dicts.
        Raises on unrecoverable errors.
        """
        import pandas as pd
        import io
        import csv

        warnings = []

        # --- Phase 1: Raw line analysis ---
        text = file_content.decode("utf-8", errors="replace")
        raw_lines = text.splitlines()
        # Strip truly empty lines (whitespace-only)
        non_empty_lines = [ln for ln in raw_lines if ln.strip()]

        if len(non_empty_lines) < 2:
            raise ValueError("CSV file has fewer than 2 non-empty lines (need header + at least 1 data row).")

        header_line = non_empty_lines[0]

        # --- Phase 2: Detect duplicate / concatenated headers ---
        # Use csv.reader to properly parse the header
        header_fields = next(csv.reader(io.StringIO(header_line)))
        header_fields_stripped = [f.strip() for f in header_fields]
        n_header_cols = len(header_fields_stripped)

        # Check for duplicate column names (exact match)
        seen = {}
        for f in header_fields_stripped:
            seen[f] = seen.get(f, 0) + 1
        duplicated_cols = {k: v for k, v in seen.items() if v > 1}
        if duplicated_cols:
            warnings.append({
                "check": "CSV Parse Integrity",
                "result": "FAIL",
                "severity": "CRITICAL",
                "detail": (
                    f"Duplicate column names detected in header: {duplicated_cols}. "
                    "This may indicate a concatenated file (two copies pasted together)."
                ),
                "action": "Inspect the CSV for duplicate headers. Re-export a clean copy."
            })

        # Look for the header pattern appearing again in data rows
        # (indicates concatenated CSV — e.g. copy-pasted twice)
        header_set = set(header_fields_stripped)
        concatenation_lines = []
        for i, line in enumerate(non_empty_lines[1:], start=2):
            fields = next(csv.reader(io.StringIO(line)))
            fields_stripped = [f.strip() for f in fields]
            # If >60% of fields match header names, it's likely a repeated header
            if len(header_set) > 0:
                overlap = sum(1 for f in fields_stripped if f in header_set)
                if overlap >= max(2, len(header_set) * 0.6):
                    concatenation_lines.append(i)

        if concatenation_lines:
            warnings.append({
                "check": "CSV Parse Integrity",
                "result": "FAIL",
                "severity": "CRITICAL",
                "detail": (
                    f"Header row pattern detected again at line(s) {concatenation_lines}. "
                    "The file appears to contain concatenated copies of the same dataset. "
                    f"Expected 1 header row, found {1 + len(concatenation_lines)}."
                ),
                "action": "Remove duplicate header rows and re-upload a single clean copy."
            })

        # --- Phase 3: Parse with pandas, tracking bad lines ---
        # Use on_bad_lines='warn' to capture malformed rows instead of silently dropping
        bad_line_details = []

        def _bad_line_handler(bad_line):
            """Capture each malformed line for the audit trail."""
            bad_line_details.append(bad_line)
            return None  # skip the line (but we've recorded it)

        df = pd.read_csv(
            io.BytesIO(file_content),
            on_bad_lines=_bad_line_handler,
            engine="python",
        )

        # --- Phase 4: Row count verification ---
        expected_data_rows = len(non_empty_lines) - 1  # subtract header
        # Also subtract any concatenated header lines we detected
        expected_data_rows -= len(concatenation_lines)
        actual_rows = len(df)

        if bad_line_details:
            warnings.append({
                "check": "CSV Parse Integrity",
                "result": "FAIL",
                "severity": "CRITICAL",
                "detail": (
                    f"{len(bad_line_details)} malformed row(s) could not be parsed. "
                    f"Expected {expected_data_rows} data rows from {len(non_empty_lines)} "
                    f"non-empty lines, got {actual_rows}. "
                    f"First malformed row fields: {bad_line_details[0][:5]}..."
                ),
                "action": (
                    "Every row in a regulatory-grade dataset must parse cleanly. "
                    "Fix the malformed rows and re-upload."
                ),
            })

        # Even if pandas didn't flag bad lines, verify counts match
        row_discrepancy = expected_data_rows - actual_rows - len(bad_line_details)
        if row_discrepancy > 0:
            warnings.append({
                "check": "CSV Parse Integrity",
                "result": "FAIL",
                "severity": "CRITICAL",
                "detail": (
                    f"Row count mismatch: file has {len(non_empty_lines)} non-empty lines "
                    f"(1 header + {expected_data_rows} expected data rows), but pandas parsed "
                    f"{actual_rows} rows and flagged {len(bad_line_details)} as malformed. "
                    f"{row_discrepancy} row(s) were silently dropped with no explanation."
                ),
                "action": "Investigate the source file for encoding issues, embedded newlines, or truncated rows.",
            })

        if not warnings:
            warnings.append({
                "check": "CSV Parse Integrity",
                "result": "PASS",
                "severity": "INFO",
                "detail": (
                    f"Clean parse: {actual_rows} data rows from {len(non_empty_lines)} "
                    f"non-empty lines ({n_header_cols} columns). No malformed or dropped rows."
                ),
                "action": "None required.",
            })

        return df, warnings

    def run_all_checks(self, df, protocol_id: str = None, parse_warnings: list = None) -> dict:
        """Run all 8 regulatory checks on the uploaded DataFrame.

        Args:
            df: Parsed pandas DataFrame.
            protocol_id: Optional study protocol identifier.
            parse_warnings: Findings from the CSV parser (phase 0).
                These are prepended to the findings list so the compliance
                report shows parse integrity issues first.

        Returns:
            {
                "compliance_status": "CLEARED" | "BLOCKED" | "CLEARED_WITH_WARNINGS",
                "findings": [...],
                "dataset_summary": {...},
                "critical_count": int,
                "major_count": int,
                "warning_count": int,
            }
        """
        import numpy as np

        findings = []

        # Prepend parser-level findings (row integrity, concatenation detection)
        if parse_warnings:
            findings.extend(parse_warnings)
        columns_upper = [c.upper() for c in df.columns]

        # -- CHECK 1: Safe Harbor Identifier Scan --
        # Check column names
        for col in df.columns:
            col_lower = col.lower().replace(" ", "_")
            for identifier in self.SAFE_HARBOR_IDENTIFIERS:
                if identifier in col_lower or col_lower == identifier:
                    findings.append({
                        "check": "Safe Harbor Identifier Scan",
                        "result": "FAIL",
                        "severity": "CRITICAL",
                        "detail": f"Column '{col}' matches Safe Harbor identifier pattern '{identifier}'",
                        "action": "Remove or de-identify this column before re-upload."
                    })
                    break

        # Check values for PII patterns (sample first 1000 rows for perf)
        sample = df.head(1000)
        for col in sample.select_dtypes(include=["object", "string"]).columns:
            for pattern_name, pattern in self.PII_PATTERNS.items():
                matches = sample[col].astype(str).str.contains(pattern, regex=True, na=False)
                match_count = matches.sum()
                if match_count > 0:
                    findings.append({
                        "check": "Safe Harbor Identifier Scan",
                        "result": "FAIL",
                        "severity": "CRITICAL",
                        "detail": f"Column '{col}' contains {match_count} value(s) matching {pattern_name} pattern",
                        "action": f"De-identify column '{col}' before re-upload."
                    })

        if not any(f["check"] == "Safe Harbor Identifier Scan" for f in findings):
            findings.append({
                "check": "Safe Harbor Identifier Scan",
                "result": "PASS",
                "severity": "INFO",
                "detail": "No Safe Harbor identifiers detected in column names or values.",
                "action": "None required."
            })

        # -- CHECK 2: SDTM Conformance --
        present_std = set(columns_upper) & self.SDTM_STANDARD_VARS
        non_std = [c for c in df.columns if c.upper() not in self.SDTM_STANDARD_VARS and len(c) > 8]
        has_usubjid = "USUBJID" in columns_upper
        has_arm = "ARM" in columns_upper or "ARMCD" in columns_upper

        if not has_usubjid:
            findings.append({
                "check": "SDTM Conformance",
                "result": "FAIL",
                "severity": "MAJOR",
                "detail": "Required variable USUBJID not found.",
                "action": "Add USUBJID column to the dataset."
            })
        elif not has_arm:
            findings.append({
                "check": "SDTM Conformance",
                "result": "FAIL",
                "severity": "MAJOR",
                "detail": "Required variable ARM or ARMCD not found.",
                "action": "Add ARM column to identify treatment groups."
            })
        else:
            sev = "WARNING" if len(non_std) > 5 else "INFO"
            findings.append({
                "check": "SDTM Conformance",
                "result": "PASS" if sev == "INFO" else "WARN",
                "severity": sev,
                "detail": f"{len(present_std)} SDTM-standard variables found. {len(non_std)} non-standard variables detected (>8 chars).",
                "action": "Review non-standard variables for compliance." if non_std else "None required."
            })

        # -- CHECK 3: Missing Data Pattern Analysis --
        arm_col = None
        for c in df.columns:
            if c.upper() in ("ARM", "ARMCD", "TRT01P", "TRT01A"):
                arm_col = c
                break

        missingness = {}
        differential_flag = False
        for col in df.columns:
            pct_missing = df[col].isna().mean() * 100
            missingness[col] = {"overall_pct": round(pct_missing, 1)}

            if arm_col and arm_col != col:
                by_arm = df.groupby(arm_col)[col].apply(lambda x: x.isna().mean() * 100)
                missingness[col]["by_arm"] = {str(k): round(v, 1) for k, v in by_arm.items()}
                if len(by_arm) >= 2:
                    diff = abs(max(by_arm) - min(by_arm))
                    if diff > 10:
                        differential_flag = True
                        findings.append({
                            "check": "Missing Data Pattern",
                            "result": "FAIL",
                            "severity": "MAJOR",
                            "detail": f"Differential missingness in '{col}': {round(diff, 1)}% between arms (threshold: 10%)",
                            "action": "Investigate whether missingness is informative. Consider sensitivity analysis."
                        })

            if pct_missing > 20:
                findings.append({
                    "check": "Missing Data Pattern",
                    "result": "WARN",
                    "severity": "WARNING",
                    "detail": f"'{col}' has {round(pct_missing, 1)}% missing values (threshold: 20%)",
                    "action": "Document missing data handling strategy in SAP."
                })

        if not differential_flag and not any(f["check"] == "Missing Data Pattern" and f["severity"] == "WARNING" for f in findings):
            findings.append({
                "check": "Missing Data Pattern",
                "result": "PASS",
                "severity": "INFO",
                "detail": "No differential missingness >10% detected. No variables exceed 20% missing.",
                "action": "None required."
            })

        # -- CHECK 4: Baseline Balance Signal --
        if arm_col:
            arms = df[arm_col].dropna().unique()
            if len(arms) >= 2:
                arm1, arm2 = arms[0], arms[1]
                g1 = df[df[arm_col] == arm1]
                g2 = df[df[arm_col] == arm2]

                smd_table = []
                for col in df.select_dtypes(include=[np.number]).columns:
                    if col == arm_col:
                        continue
                    m1, m2 = g1[col].mean(), g2[col].mean()
                    s1, s2 = g1[col].std(), g2[col].std()
                    pooled_sd = np.sqrt((s1**2 + s2**2) / 2) if (s1 > 0 or s2 > 0) else 1
                    smd = abs(m1 - m2) / pooled_sd if pooled_sd > 0 else 0
                    smd_table.append({"variable": col, "smd": round(smd, 3), "arm1_mean": round(m1, 2), "arm2_mean": round(m2, 2)})

                    if smd > 0.30:
                        findings.append({
                            "check": "Baseline Balance",
                            "result": "WARN",
                            "severity": "WARNING",
                            "detail": f"'{col}' has SMD={round(smd, 3)} between {arm1} and {arm2} (threshold: 0.30)",
                            "action": "Consider propensity score adjustment for this covariate."
                        })

                smd_table.sort(key=lambda x: x["smd"], reverse=True)
                if not any(f["check"] == "Baseline Balance" for f in findings):
                    findings.append({
                        "check": "Baseline Balance",
                        "result": "PASS",
                        "severity": "INFO",
                        "detail": f"All {len(smd_table)} numeric covariates have SMD <= 0.30.",
                        "action": "None required."
                    })
        else:
            findings.append({
                "check": "Baseline Balance",
                "result": "SKIP",
                "severity": "INFO",
                "detail": "No ARM column found. Cannot compute between-group balance.",
                "action": "Add ARM column to enable balance checks."
            })

        # -- CHECK 5: Temporal Consistency --
        import pandas as pd
        date_cols = [c for c in df.columns if any(d in c.upper() for d in ["DATE", "DTC", "DTM", "DT", "YEAR"])]
        temporal_issues = []
        for col in date_cols:
            try:
                dates = pd.to_datetime(df[col], errors="coerce")
                future_dates = dates[dates.dt.year > 2023]
                if len(future_dates) > 0:
                    temporal_issues.append(col)
                    findings.append({
                        "check": "Temporal Consistency",
                        "result": "WARN",
                        "severity": "CRITICAL" if arm_col and len(df[df[arm_col] != df[arm_col].mode()[0]][col].dropna()) > 0 else "WARNING",
                        "detail": f"Column '{col}' has {len(future_dates)} records with year > 2023 (potential contamination window).",
                        "action": "Verify these records are within the enrollment window."
                    })
            except Exception:
                pass

        if not temporal_issues:
            findings.append({
                "check": "Temporal Consistency",
                "result": "PASS",
                "severity": "INFO",
                "detail": f"Checked {len(date_cols)} date columns. No temporal inconsistencies found.",
                "action": "None required."
            })

        # -- CHECK 6: Duplicate Subject Detection --
        usubjid_col = None
        for c in df.columns:
            if c.upper() == "USUBJID":
                usubjid_col = c
                break

        if usubjid_col:
            dupes = df[usubjid_col].duplicated()
            dupe_count = dupes.sum()
            if dupe_count > 0:
                dupe_ids = df[dupes][usubjid_col].unique()[:10]
                findings.append({
                    "check": "Duplicate Subject Detection",
                    "result": "FAIL",
                    "severity": "CRITICAL",
                    "detail": f"{dupe_count} duplicate USUBJID values found. Examples: {list(dupe_ids[:5])}",
                    "action": "Remove duplicates or verify this is a multi-record-per-subject dataset."
                })
            else:
                findings.append({
                    "check": "Duplicate Subject Detection",
                    "result": "PASS",
                    "severity": "INFO",
                    "detail": f"All {len(df)} USUBJID values are unique.",
                    "action": "None required."
                })

        # -- CHECK 7: Arm Balance --
        if arm_col:
            arm_counts = df[arm_col].value_counts().to_dict()
            counts = list(arm_counts.values())
            if len(counts) >= 2:
                ratio = max(counts) / min(counts) if min(counts) > 0 else float("inf")
                if ratio > 5:
                    findings.append({
                        "check": "Arm Balance",
                        "result": "WARN",
                        "severity": "WARNING",
                        "detail": f"Arm ratio is 1:{round(ratio, 1)} ({arm_counts}). Threshold: 1:5.",
                        "action": "Extreme imbalance may degrade effective sample size. Consider trimming or weighting."
                    })
                else:
                    findings.append({
                        "check": "Arm Balance",
                        "result": "PASS",
                        "severity": "INFO",
                        "detail": f"Arm ratio is 1:{round(ratio, 1)} ({arm_counts}). Within acceptable range.",
                        "action": "None required."
                    })

        # -- CHECK 8: Implausible Value Detection --
        outlier_findings = []
        for col in df.select_dtypes(include=[np.number]).columns:
            mean = df[col].mean()
            std = df[col].std()
            if std > 0:
                outliers = df[abs(df[col] - mean) > 4 * std]
                if len(outliers) > 0:
                    outlier_findings.append({
                        "variable": col,
                        "count": len(outliers),
                        "values": [round(v, 2) for v in outliers[col].head(5).tolist()]
                    })

        if outlier_findings:
            for of in outlier_findings:
                findings.append({
                    "check": "Implausible Value Detection",
                    "result": "WARN",
                    "severity": "WARNING",
                    "detail": f"'{of['variable']}': {of['count']} values > 4 SD from mean. Examples: {of['values']}",
                    "action": "Review these values for data entry errors."
                })
        else:
            findings.append({
                "check": "Implausible Value Detection",
                "result": "PASS",
                "severity": "INFO",
                "detail": "No values > 4 SD from column means detected.",
                "action": "None required."
            })

        # -- Compute summary --
        critical_count = sum(1 for f in findings if f["severity"] == "CRITICAL")
        major_count = sum(1 for f in findings if f["severity"] == "MAJOR")
        warning_count = sum(1 for f in findings if f["severity"] == "WARNING")

        if critical_count > 0:
            status = "BLOCKED"
        elif major_count > 0 or warning_count > 0:
            status = "CLEARED_WITH_WARNINGS"
        else:
            status = "CLEARED"

        # Key variable presence
        key_vars = {}
        for v in ["USUBJID", "ARM", "AGE", "SEX", "STUDYID", "SITEID"]:
            key_vars[v] = v in columns_upper

        n_by_arm = {}
        if arm_col:
            n_by_arm = df[arm_col].value_counts().to_dict()

        return {
            "compliance_status": status,
            "findings": findings,
            "critical_count": critical_count,
            "major_count": major_count,
            "warning_count": warning_count,
            "dataset_summary": {
                "total_rows": len(df),
                "n_by_arm": {str(k): int(v) for k, v in n_by_arm.items()},
                "columns_detected": list(df.columns),
                "key_variables_present": key_vars,
                "missingness_summary": {k: v["overall_pct"] for k, v in missingness.items() if v["overall_pct"] > 0},
            }
        }

    def generate_purge_certificate(self, project_id: str, user_id: str, purge_scope: dict) -> dict:
        """Generate a purge certificate with SHA-256 hash."""
        ts = datetime.utcnow().isoformat()
        payload = f"{project_id}|{user_id}|{ts}|{json.dumps(purge_scope, sort_keys=True)}"
        cert_hash = hashlib.sha256(payload.encode()).hexdigest()
        return {
            "timestamp": ts,
            "user_id": user_id,
            "project_id": project_id,
            "purge_scope": purge_scope,
            "certifying_hash": cert_hash,
        }
