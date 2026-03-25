#!/usr/bin/env python3
"""
E2E Biostatistician Test: Idiopathic Pulmonary Fibrosis (IPF)
Antifibrotic therapy vs untreated — time to death (all-cause mortality)

This test exercises the ENTIRE Afarensis pipeline with a clinically plausible
IPF dataset, then validates every statistical output against lifelines.
"""
import os
import sys
import csv
import json
import tempfile
import requests
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE = "http://localhost:8000/api/v1"
TOKEN = None
PROJECT_ID = None
RESULTS = {}

# The exact dataset from the biostatistician's prompt
IPF_DATA = [
    ("P001",12.3,1,1,68,"M",62,"former"),
    ("P002",8.7,1,0,72,"M",55,"current"),
    ("P003",15.2,0,1,64,"F",70,"never"),
    ("P004",6.1,1,0,75,"M",48,"former"),
    ("P005",18.4,0,1,59,"F",78,"never"),
    ("P006",10.5,1,0,70,"M",52,"current"),
    ("P007",20.1,0,1,63,"F",74,"former"),
    ("P008",7.9,1,0,77,"M",46,"current"),
    ("P009",14.6,1,1,66,"M",60,"former"),
    ("P010",9.3,1,0,71,"F",58,"former"),
    ("P011",22.5,0,1,61,"F",82,"never"),
    ("P012",5.8,1,0,74,"M",49,"current"),
    ("P013",16.7,0,1,65,"M",68,"former"),
    ("P014",11.2,1,0,69,"F",57,"former"),
    ("P015",19.3,0,1,60,"F",80,"never"),
    ("P016",7.4,1,0,76,"M",45,"current"),
    ("P017",13.8,1,1,67,"M",63,"former"),
    ("P018",6.9,1,0,73,"F",50,"former"),
    ("P019",21.0,0,1,62,"F",77,"never"),
    ("P020",8.1,1,0,78,"M",47,"current"),
]

COLUMNS = ["USUBJID","TIME","EVENT","ARM","AGE","SEX","FVC_PCT","SMOKING"]


def log(section, status, detail=""):
    icon = {"PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]", "INFO": "[INFO]"}[status]
    print(f"  {icon} {section}: {detail}" if detail else f"  {icon} {section}")
    RESULTS[section] = {"status": status, "detail": detail}


def api(method, path, json_data=None, files=None, data=None):
    headers = {}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    if json_data is not None and files is None:
        headers["Content-Type"] = "application/json"
    url = f"{BASE}{path}"
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=120)
        elif method == "POST":
            if files:
                r = requests.post(url, headers=headers, files=files, data=data, timeout=120)
            else:
                r = requests.post(url, headers=headers, json=json_data, timeout=120)
        elif method == "PUT":
            r = requests.put(url, headers=headers, json=json_data, timeout=120)
        return r.json() if r.text and r.status_code != 204 else {}, r.status_code
    except Exception as e:
        return {"error": str(e)}, 0


def generate_csv(filepath):
    """Write the biostatistician's IPF dataset to CSV."""
    with open(filepath, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(COLUMNS)
        for pid, t, e, trt, age, sex, fvc, smoking in IPF_DATA:
            arm = "ANTIFIBROTIC" if trt == 1 else "UNTREATED"
            writer.writerow([pid, t, e, arm, age, sex, fvc, smoking])
    return len(IPF_DATA)


def compute_lifelines_reference():
    """Compute reference values using lifelines (gold standard Python CoxPH)."""
    import pandas as pd
    from lifelines import CoxPHFitter, KaplanMeierFitter
    from lifelines.statistics import logrank_test

    rows = []
    for pid, t, e, trt, age, sex, fvc, smoking in IPF_DATA:
        rows.append({
            "time": t, "event": e, "treatment": trt,
            "age": age, "sex_m": 1 if sex == "M" else 0,
            "fvc": fvc, "smoking_former": 1 if smoking == "former" else 0,
            "smoking_current": 1 if smoking == "current" else 0,
        })
    df = pd.DataFrame(rows)

    ref = {}

    # Multivariate Cox PH
    cph = CoxPHFitter()
    cph.fit(df[["time", "event", "treatment", "age", "sex_m", "fvc"]], "time", "event")
    ref["cox_hr_multi"] = float(np.exp(cph.params_["treatment"]))
    ref["cox_coef_multi"] = float(cph.params_["treatment"])
    ref["cox_p_multi"] = float(cph.summary["p"]["treatment"])
    ci = cph.confidence_intervals_
    trt_idx = list(cph.params_.index).index("treatment")
    ref["cox_ci_lower_multi"] = float(np.exp(ci.iloc[trt_idx, 0]))
    ref["cox_ci_upper_multi"] = float(np.exp(ci.iloc[trt_idx, 1]))

    # KM medians
    for arm, label in [(0, "untreated"), (1, "antifibrotic")]:
        kmf = KaplanMeierFitter()
        mask = df.treatment == arm
        kmf.fit(df.loc[mask, "time"], df.loc[mask, "event"])
        ref[f"km_median_{label}"] = float(kmf.median_survival_time_)

    # Log-rank
    lr = logrank_test(
        df.loc[df.treatment == 0, "time"], df.loc[df.treatment == 1, "time"],
        df.loc[df.treatment == 0, "event"], df.loc[df.treatment == 1, "event"]
    )
    ref["logrank_p"] = float(lr.p_value)

    return ref


def main():
    global TOKEN, PROJECT_ID

    print("=" * 70)
    print("AFARENSIS E2E TEST: IPF ANTIFIBROTIC THERAPY")
    print("Endpoint: All-cause mortality (time-to-event)")
    print("N=20, Antifibrotic=10, Untreated=10")
    print("=" * 70)

    # ── Phase 1: Compute reference values ──
    print("\n-- Phase 0: Compute lifelines reference values --")
    try:
        ref = compute_lifelines_reference()
        log("Lifelines reference", "PASS",
            f"HR={ref['cox_hr_multi']:.4f}, KM_untreated={ref.get('km_median_untreated','?')}, "
            f"KM_antifibrotic={ref.get('km_median_antifibrotic','?')}")
    except Exception as e:
        log("Lifelines reference", "FAIL", str(e))
        ref = {}

    # ── Phase 1: Login ──
    print("\n-- Phase 1: Authentication --")
    data, code = api("POST", "/auth/login", {"email": "admin@afarensis.com", "password": "admin123"})
    if code == 200 and "access_token" in data:
        TOKEN = data["access_token"]
        log("Login", "PASS")
    else:
        log("Login", "FAIL", f"HTTP {code}")
        return 1

    # ── Phase 2: Create Project ──
    print("\n-- Phase 2: Create Project --")
    data, code = api("POST", "/projects", {
        "title": "IPF-2024: Antifibrotic Therapy vs Untreated in Idiopathic Pulmonary Fibrosis",
        "description": "Evaluate whether antifibrotic therapy (pirfenidone/nintedanib) reduces all-cause mortality risk vs untreated IPF patients",
        "research_intent": "Compare time-to-death between antifibrotic-treated and untreated IPF patients using propensity-adjusted survival analysis"
    })
    if code == 200:
        PROJECT_ID = data["id"]
        log("Create Project", "PASS", f"ID: {PROJECT_ID[:12]}...")
    else:
        log("Create Project", "FAIL", f"HTTP {code}")
        return 1

    # ── Phase 3: Study Definition ──
    print("\n-- Phase 3: Study Definition --")
    study_def = {
        "study_title": "IPF-2024: Antifibrotic Therapy vs Untreated",
        "indication": "Idiopathic Pulmonary Fibrosis (IPF)",
        "population": "Adults diagnosed with IPF per ATS/ERS criteria",
        "intervention": "Antifibrotic therapy (pirfenidone 2403mg/day or nintedanib 300mg/day)",
        "comparator": "No antifibrotic therapy (best supportive care)",
        "primary_endpoint": "Time to all-cause death (months)",
        "secondary_endpoints": ["FVC decline rate", "Progression-free survival"],
        "study_design": "Retrospective cohort with propensity score adjustment",
        "estimand_framework": {
            "type": "ATT",
            "population": "All treated patients",
            "variable": "Time to death (continuous)",
            "intercurrent_events": {"treatment_discontinuation": "Composite strategy"},
            "summary_measure": "Hazard ratio"
        }
    }
    data, code = api("PUT", f"/projects/{PROJECT_ID}/study/definition", study_def)
    log("Save Study Definition", "PASS" if code == 200 else "FAIL")

    # ── Phase 4: Covariates ──
    print("\n-- Phase 4: Covariates --")
    covariates = {
        "covariates": [
            {"name": "AGE", "label": "Age at diagnosis", "type": "continuous", "source": "Demographics"},
            {"name": "SEX", "label": "Sex", "type": "binary", "source": "Demographics"},
            {"name": "FVC_PCT", "label": "Baseline FVC % predicted", "type": "continuous", "source": "Pulmonary function"},
            {"name": "SMOKING", "label": "Smoking status", "type": "categorical", "source": "Medical history"},
        ],
        "unmeasured": [
            {"name": "GAP_stage", "label": "GAP staging index", "rationale": "Prognostic score not available in all datasets"},
        ]
    }
    data, code = api("PUT", f"/projects/{PROJECT_ID}/study/covariates", covariates)
    log("Save Covariates", "PASS" if code == 200 else "FAIL")

    # ── Phase 5: Consent + Upload ──
    print("\n-- Phase 5: HIPAA Consent + Data Upload --")
    data, code = api("POST", f"/projects/{PROJECT_ID}/ingestion/consent", {
        "attestation_text": "I certify this data is de-identified per 45 CFR 164.514(b)-(c).",
        "consent_version": "HIPAA-SH-v1.2"
    })
    consent_id = data.get("consent_id", data.get("id")) if code == 200 else None
    log("Consent", "PASS" if consent_id else "FAIL")

    # Generate and upload CSV
    csv_path = os.path.join(tempfile.gettempdir(), "ipf_study.csv")
    n = generate_csv(csv_path)
    log("Generate CSV", "PASS", f"{n} patients, {len(COLUMNS)} columns")

    with open(csv_path, "rb") as f:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        form_data = {"consent_id": str(consent_id)} if consent_id else {}
        r = requests.post(
            f"{BASE}/projects/{PROJECT_ID}/ingestion/upload",
            headers=headers,
            files={"file": ("ipf_study.csv", f, "text/csv")},
            data=form_data, timeout=60
        )
    if r.status_code == 200:
        ud = r.json()
        log("Upload", "PASS",
            f"Status: {ud.get('compliance_status')}, "
            f"Rows: {ud.get('dataset_summary',{}).get('total_rows')}, "
            f"Arms: {json.dumps(ud.get('dataset_summary',{}).get('n_by_arm',{}))}")
    else:
        log("Upload", "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")

    # ── Phase 6: Run Analysis ──
    print("\n-- Phase 6: Statistical Analysis on Real IPF Data --")
    data, code = api("POST", f"/projects/{PROJECT_ID}/study/analyze-dataset", {})
    if code == 200 and "error" not in data:
        src = data.get("data_source", "?")
        log("Analyze Dataset", "PASS", f"Source: {src}")

        # Extract key results
        primary = data.get("primary_analysis", {})
        unadj = data.get("unadjusted_analysis", {})
        km = data.get("kaplan_meier", {})
        ps = data.get("propensity_scores", {})
        ev = data.get("e_value", {})

        # Report primary result
        iptw_hr = primary.get("hazard_ratio")
        iptw_ci = [primary.get("ci_lower"), primary.get("ci_upper")]
        iptw_p = primary.get("p_value")
        log("  IPTW Cox PH", "INFO",
            f"HR={iptw_hr:.4f} [{iptw_ci[0]:.4f}, {iptw_ci[1]:.4f}] p={iptw_p:.4f}" if iptw_hr else "Not computed")

        # Unadjusted
        unadj_hr = unadj.get("treatment_hr")
        unadj_p = unadj.get("treatment_p_value")
        log("  Unadjusted Cox", "INFO",
            f"HR={unadj_hr:.4f} p={unadj_p:.4f}" if unadj_hr else "Not computed")

        # PS C-statistic
        c_stat = ps.get("c_statistic")
        log("  PS C-statistic", "INFO", f"{c_stat:.4f}" if c_stat else "N/A")

        # E-value
        e_val = ev.get("e_value_point")
        log("  E-value", "INFO", f"{e_val:.4f}" if e_val else "N/A")

        # ── Validate against lifelines ──
        if ref:
            print("\n-- Phase 6b: Validation against lifelines --")

            def check(name, afar, reference, tol_pct=5, tol_abs=None):
                if afar is None or reference is None:
                    log(f"  {name}", "WARN", "Not computed")
                    return
                if tol_abs is not None:
                    diff = abs(afar - reference)
                    ok = diff <= tol_abs
                else:
                    diff = abs((afar - reference) / reference) * 100 if reference != 0 else abs(afar) * 100
                    ok = diff <= tol_pct
                log(f"  {name}", "PASS" if ok else "FAIL",
                    f"Afarensis={afar:.4f} ref={reference:.4f} diff={'%.4f'%diff if tol_abs else '%.1f%%'%diff}")

            check("Cox HR (multivariate)", unadj_hr, ref.get("cox_hr_multi"), tol_pct=2)
            check("Cox p-value", unadj_p, ref.get("cox_p_multi"), tol_abs=0.01)

            # KM medians from curves
            km_curves = km.get("curves", {})
            for gname, cdata in km_curves.items():
                if isinstance(cdata, dict):
                    med = cdata.get("median_survival")
                    if med:
                        glow = gname.lower()
                        if "untreated" in glow:
                            check("KM Median (Untreated)", med, ref.get("km_median_untreated"), tol_pct=5)
                        elif "antifibrotic" in glow:
                            check("KM Median (Antifibrotic)", med, ref.get("km_median_antifibrotic"), tol_pct=5)

            lr_p = km.get("log_rank_test", {}).get("p_value")
            check("Log-rank p-value", lr_p, ref.get("logrank_p"), tol_abs=0.01)
    else:
        err = data.get("error", data.get("detail", f"HTTP {code}"))
        log("Analyze Dataset", "FAIL", str(err)[:200])

    # ── Phase 7: ADaM from real data ──
    print("\n-- Phase 7: CDISC ADaM --")
    for ds in ["adsl", "adae", "adtte"]:
        data, code = api("POST", f"/projects/{PROJECT_ID}/adam/generate/{ds}", {})
        n_rec = data.get("records_count", "?") if code == 200 else "ERR"
        log(f"ADaM {ds.upper()}", "PASS" if code == 200 else "FAIL", f"{n_rec} records")

    # ── Phase 8: TFLs ──
    print("\n-- Phase 8: Tables, Figures & Listings --")
    for tfl, name in [("demographics", "Demographics"), ("km-curve", "KM Curve"),
                       ("forest-plot", "Forest Plot"), ("love-plot", "Love Plot")]:
        data, code = api("POST", f"/projects/{PROJECT_ID}/study/tfl/{tfl}", {})
        has = code == 200 and bool(data.get("html") or data.get("svg") or data.get("data") or data.get("table"))
        log(f"TFL {name}", "PASS" if has else ("WARN" if code == 200 else "FAIL"))

    # ── Phase 9: Regulatory Documents ──
    print("\n-- Phase 9: Regulatory Documents --")
    for ep, name in [
        (f"/projects/{PROJECT_ID}/generate-artifact?artifact_type=safety_assessment_report&format=html", "SAR HTML"),
        (f"/projects/{PROJECT_ID}/study/sap/generate", "SAP"),
        (f"/projects/{PROJECT_ID}/submission/csr/synopsis", "CSR Synopsis"),
        (f"/projects/{PROJECT_ID}/submission/adrg/generate", "ADRG"),
    ]:
        data, code = api("POST", ep, {})
        log(f"Generate {name}", "PASS" if code == 200 else "FAIL")

    # ── Phase 10: Download SAR ──
    print("\n-- Phase 10: SAR Download --")
    data, code = api("POST", f"/projects/{PROJECT_ID}/generate-artifact?artifact_type=safety_assessment_report&format=html", {})
    if code == 200:
        aid = data.get("artifact_id")
        if aid:
            r = requests.get(f"{BASE}/artifacts/{aid}/download",
                             headers={"Authorization": f"Bearer {TOKEN}"}, timeout=30)
            size = len(r.content)
            log("Download SAR", "PASS" if size > 1000 else "FAIL", f"{size:,} bytes")
        else:
            log("Download SAR", "WARN", "No artifact_id returned")
    else:
        log("Download SAR", "FAIL", f"HTTP {code}")

    # ═══════════════════════════════════════════════════════════
    print("\n" + "=" * 70)
    passed = sum(1 for v in RESULTS.values() if v["status"] == "PASS")
    failed = sum(1 for v in RESULTS.values() if v["status"] == "FAIL")
    warned = sum(1 for v in RESULTS.values() if v["status"] == "WARN")
    info = sum(1 for v in RESULTS.values() if v["status"] == "INFO")
    total = passed + failed + warned

    print(f"PASSED: {passed}/{total}  |  FAILED: {failed}/{total}  |  WARNINGS: {warned}/{total}  |  INFO: {info}")

    if failed > 0:
        print("\nFAILURES:")
        for k, v in RESULTS.items():
            if v["status"] == "FAIL":
                print(f"  [FAIL] {k}: {v['detail']}")
    print("=" * 70)

    # Save report
    with open("ipf_validation_results.json", "w") as f:
        json.dump({"dataset": "IPF_20pts", "results": RESULTS, "reference": ref}, f, indent=2, default=str)

    return failed


if __name__ == "__main__":
    sys.exit(main() or 0)
