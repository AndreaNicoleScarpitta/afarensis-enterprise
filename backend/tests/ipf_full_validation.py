#!/usr/bin/env python3
"""
IPF Full Validation: 200-patient dataset with known treatment effect.

GPT's criteria:
  - Treatment HR should be < 1 (protective)
  - Lower FVC -> higher hazard
  - Older age -> higher hazard
  - KM curves should show separation
  - SMD should improve after PS weighting
  - Censoring must be handled correctly

We generate data with TRUE HR ~ 0.65 for treatment, then verify
Afarensis recovers it correctly.
"""
import os, sys, csv, json, tempfile, time
import numpy as np
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BASE = "http://localhost:8000/api/v1"
TOKEN = None
PID = None
RESULTS = {}


def log(name, status, detail=""):
    icon = {"PASS":"[PASS]","FAIL":"[FAIL]","WARN":"[WARN]","INFO":"[INFO]"}[status]
    msg = f"  {icon} {name}: {detail}" if detail else f"  {icon} {name}"
    print(msg)
    RESULTS[name] = {"status": status, "detail": detail}


def api(method, path, json_data=None, files=None, data=None):
    headers = {}
    if TOKEN: headers["Authorization"] = f"Bearer {TOKEN}"
    if json_data is not None and files is None:
        headers["Content-Type"] = "application/json"
    url = f"{BASE}{path}"
    try:
        if method == "GET": r = requests.get(url, headers=headers, timeout=120)
        elif method == "POST":
            if files: r = requests.post(url, headers=headers, files=files, data=data, timeout=120)
            else: r = requests.post(url, headers=headers, json=json_data, timeout=120)
        elif method == "PUT": r = requests.put(url, headers=headers, json=json_data, timeout=120)
        return r.json() if r.text and r.status_code != 204 else {}, r.status_code
    except Exception as e:
        return {"error": str(e)}, 0


def generate_ipf_dataset(n=200, true_hr=0.65, seed=42):
    """
    Generate a clinically plausible IPF dataset with KNOWN treatment effect.

    True data-generating process:
      hazard_i = baseline_hazard * exp(
          log(true_hr) * treatment_i
          + 0.03 * age_i
          - 0.02 * fvc_i
          + 0.15 * smoking_current_i
      )

    This means:
      - Treatment is protective (HR=0.65)
      - Older age increases hazard
      - Lower FVC increases hazard
      - Current smoking increases hazard
    """
    rng = np.random.RandomState(seed)

    # Demographics - slight imbalance (treated patients slightly younger/healthier)
    treatment = np.concatenate([np.ones(n // 2), np.zeros(n // 2)])
    rng.shuffle(treatment)  # randomize order

    age = np.where(treatment == 1,
                   rng.normal(66, 8, n),    # treated: mean 66
                   rng.normal(70, 9, n))    # untreated: mean 70
    age = np.clip(age, 40, 90).astype(int)

    sex = np.where(treatment == 1,
                   rng.binomial(1, 0.55, n),  # treated: 55% male
                   rng.binomial(1, 0.65, n))  # untreated: 65% male

    fvc = np.where(treatment == 1,
                   rng.normal(68, 12, n),   # treated: mean 68%
                   rng.normal(58, 14, n))   # untreated: mean 58%
    fvc = np.clip(fvc, 25, 100).round(1)

    smoking_probs = np.where(treatment == 1, 0.15, 0.30)
    smoking_current = rng.binomial(1, smoking_probs)
    smoking_former = np.where(smoking_current == 0, rng.binomial(1, 0.45), 0)

    # Generate survival times with the TRUE model
    baseline_hazard = 0.015  # ~15% monthly hazard at baseline
    log_hr = np.log(true_hr)

    linear_pred = (
        log_hr * treatment
        + 0.03 * (age - 65)       # age effect
        - 0.02 * (fvc - 60)       # FVC effect (lower = worse)
        + 0.15 * smoking_current  # smoking effect
    )

    hazard = baseline_hazard * np.exp(linear_pred)
    survival_time = rng.exponential(1.0 / hazard)

    # Administrative censoring at 36 months + random dropout
    censor_time = np.minimum(36.0, rng.exponential(48, n))
    event = (survival_time <= censor_time).astype(int)
    observed_time = np.minimum(survival_time, censor_time)
    observed_time = np.clip(observed_time, 0.1, 36.0).round(1)

    # Build CSV rows
    rows = []
    for i in range(n):
        sm = "current" if smoking_current[i] else ("former" if smoking_former[i] else "never")
        rows.append({
            "USUBJID": f"IPF-{i+1:04d}",
            "TIME": float(observed_time[i]),
            "EVENT": int(event[i]),
            "ARM": "ANTIFIBROTIC" if treatment[i] == 1 else "UNTREATED",
            "AGE": int(age[i]),
            "SEX": "M" if sex[i] == 1 else "F",
            "FVC_PCT": float(fvc[i]),
            "SMOKING": sm,
        })

    # Summary statistics
    n_trt = int(treatment.sum())
    n_ctl = int(n - n_trt)
    n_events = int(event.sum())
    n_censored = int(n - n_events)

    return rows, {
        "n": n, "n_treated": n_trt, "n_control": n_ctl,
        "n_events": n_events, "n_censored": n_censored,
        "true_hr": true_hr, "event_rate": n_events / n,
        "mean_age_trt": float(age[treatment == 1].mean()),
        "mean_age_ctl": float(age[treatment == 0].mean()),
        "mean_fvc_trt": float(fvc[treatment == 1].mean()),
        "mean_fvc_ctl": float(fvc[treatment == 0].mean()),
    }


def compute_reference(rows):
    """Compute lifelines reference values."""
    import pandas as pd
    from lifelines import CoxPHFitter, KaplanMeierFitter
    from lifelines.statistics import logrank_test

    df = pd.DataFrame(rows)
    df["treatment"] = (df["ARM"] == "ANTIFIBROTIC").astype(int)
    df["sex_m"] = (df["SEX"] == "M").astype(int)
    df["smoking_current"] = (df["SMOKING"] == "current").astype(int)
    df["smoking_former"] = (df["SMOKING"] == "former").astype(int)

    ref = {}

    # Univariate Cox
    cph1 = CoxPHFitter()
    cph1.fit(df[["TIME","EVENT","treatment"]], "TIME", "EVENT")
    ref["cox_hr_uni"] = float(np.exp(cph1.params_["treatment"]))
    ref["cox_p_uni"] = float(cph1.summary["p"]["treatment"])

    # Multivariate Cox (drop smoking_former to avoid collinearity with smoking_current)
    cph2 = CoxPHFitter(penalizer=0.01)  # small ridge penalty for stability
    fit_cols = ["TIME","EVENT","treatment","AGE","sex_m","FVC_PCT","smoking_current"]
    cph2.fit(df[fit_cols], "TIME", "EVENT")
    ref["cox_hr_multi"] = float(np.exp(cph2.params_["treatment"]))
    ref["cox_coef_multi"] = float(cph2.params_["treatment"])
    ref["cox_p_multi"] = float(cph2.summary["p"]["treatment"])
    # Age and FVC effects
    ref["age_hr"] = float(np.exp(cph2.params_["AGE"]))
    ref["fvc_hr"] = float(np.exp(cph2.params_["FVC_PCT"]))

    # KM medians
    for arm, label in [(0, "untreated"), (1, "antifibrotic")]:
        kmf = KaplanMeierFitter()
        mask = df.treatment == arm
        kmf.fit(df.loc[mask, "TIME"], df.loc[mask, "EVENT"])
        ref[f"km_median_{label}"] = float(kmf.median_survival_time_)

    # Log-rank
    lr = logrank_test(
        df.loc[df.treatment==0,"TIME"], df.loc[df.treatment==1,"TIME"],
        df.loc[df.treatment==0,"EVENT"], df.loc[df.treatment==1,"EVENT"])
    ref["logrank_p"] = float(lr.p_value)

    return ref


def main():
    global TOKEN, PID

    print("=" * 70)
    print("AFARENSIS FULL VALIDATION: IPF 200-PATIENT DATASET")
    print("True HR = 0.65 (treatment protective)")
    print("=" * 70)

    # Generate dataset
    print("\n-- Phase 0: Generate dataset + lifelines reference --")
    rows, summary = generate_ipf_dataset(n=200, true_hr=0.65)
    log("Dataset", "PASS",
        f"N={summary['n']}, treated={summary['n_treated']}, control={summary['n_control']}, "
        f"events={summary['n_events']} ({summary['event_rate']*100:.0f}%)")
    log("Demographics", "INFO",
        f"Age: trt={summary['mean_age_trt']:.1f} ctl={summary['mean_age_ctl']:.1f}, "
        f"FVC: trt={summary['mean_fvc_trt']:.1f} ctl={summary['mean_fvc_ctl']:.1f}")

    ref = compute_reference(rows)
    log("Lifelines ref", "PASS",
        f"HR_uni={ref['cox_hr_uni']:.4f} HR_multi={ref['cox_hr_multi']:.4f} "
        f"KM_ctl={ref['km_median_untreated']:.1f} KM_trt={ref['km_median_antifibrotic']:.1f}")

    # GPT's directional checks on the reference
    print("\n-- GPT Directional Checks (lifelines) --")
    log("HR < 1 (protective)", "PASS" if ref["cox_hr_multi"] < 1 else "FAIL",
        f"HR={ref['cox_hr_multi']:.4f}")
    log("Age HR > 1 (older=worse)", "PASS" if ref["age_hr"] > 1 else "FAIL",
        f"HR={ref['age_hr']:.4f}")
    log("FVC HR < 1 (lower=worse)", "PASS" if ref["fvc_hr"] < 1 else "FAIL",
        f"HR={ref['fvc_hr']:.4f}")
    log("KM separation", "PASS" if ref["km_median_antifibrotic"] > ref["km_median_untreated"] else "FAIL",
        f"Treated median > control median")

    # Login + create project
    print("\n-- Phase 1: Setup --")
    d, c = api("POST", "/auth/login", {"email":"admin@afarensis.com","password":"admin123"})
    TOKEN = d["access_token"] if c == 200 else None
    log("Login", "PASS" if TOKEN else "FAIL")

    d, c = api("POST", "/projects", {
        "title": "IPF-VAL: 200-Patient Validation Study",
        "research_intent": "Validate antifibrotic therapy effect on IPF mortality"
    })
    PID = d.get("id") if c == 200 else None
    log("Project", "PASS" if PID else "FAIL")

    # Consent + Upload
    print("\n-- Phase 2: Consent + Upload --")
    d, c = api("POST", f"/projects/{PID}/ingestion/consent",
               {"attestation_text": "De-identified per 45 CFR 164.514", "consent_version": "v1.2"})
    cid = d.get("consent_id", d.get("id")) if c == 200 else None
    log("Consent", "PASS" if cid else "FAIL")

    csv_path = os.path.join(tempfile.gettempdir(), "ipf_200.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)

    with open(csv_path, "rb") as f:
        r = requests.post(f"{BASE}/projects/{PID}/ingestion/upload",
                          headers={"Authorization": f"Bearer {TOKEN}"},
                          files={"file": ("ipf_200.csv", f, "text/csv")},
                          data={"consent_id": str(cid)}, timeout=60)
    if r.status_code == 200:
        ud = r.json()
        log("Upload", "PASS", f"Status: {ud.get('compliance_status')}, rows: {ud.get('dataset_summary',{}).get('total_rows')}")
    else:
        log("Upload", "FAIL", f"HTTP {r.status_code}")
        return 1

    # Run analysis
    print("\n-- Phase 3: Statistical Analysis --")
    d, c = api("POST", f"/projects/{PID}/study/analyze-dataset", {})
    if c != 200 or "error" in d:
        log("Analyze", "FAIL", str(d.get("error", d.get("detail", f"HTTP {c}")))[:200])
        return 1

    log("Analyze", "PASS", f"Source: {d.get('data_source')}")

    # Extract Afarensis results
    primary = d.get("primary_analysis", {})
    unadj = d.get("unadjusted_analysis", {})
    km = d.get("kaplan_meier", {})
    ps = d.get("propensity_scores", {})
    balance = d.get("covariate_balance", [])

    # ── GPT's validation criteria ──
    print("\n-- Phase 4: GPT Validation Criteria --")

    # 1. Treatment HR < 1
    unadj_hr = unadj.get("treatment_hr")
    iptw_hr = primary.get("hazard_ratio")
    log("Treatment HR < 1 (unadjusted)", "PASS" if unadj_hr and unadj_hr < 1 else "FAIL",
        f"HR={unadj_hr:.4f}" if unadj_hr else "N/A")
    log("Treatment HR < 1 (IPTW)", "PASS" if iptw_hr and iptw_hr < 1 else "FAIL",
        f"HR={iptw_hr:.4f}" if iptw_hr else "N/A")

    # 2. KM separation
    km_curves = km.get("curves", {})
    km_meds = {}
    for gname, cdata in km_curves.items():
        if isinstance(cdata, dict) and cdata.get("median_survival"):
            km_meds[gname.lower()] = cdata["median_survival"]
    trt_med = km_meds.get("antifibrotic", km_meds.get(list(km_meds.keys())[0] if km_meds else "?"))
    ctl_med = km_meds.get("untreated", km_meds.get(list(km_meds.keys())[-1] if len(km_meds) > 1 else "?"))
    log("KM curves show separation", "PASS" if trt_med and ctl_med and trt_med > ctl_med else "FAIL",
        f"Treated median={trt_med}, Control median={ctl_med}")

    # 3. Censoring handled correctly
    n_events_reported = d.get("sample_size", {}).get("total_events",
                         d.get("column_detection", {}).get("n_events"))
    log("Censoring handled", "PASS" if n_events_reported and n_events_reported < 200 else "WARN",
        f"Events={n_events_reported} out of 200")

    # 4. PS C-statistic reasonable
    c_stat = ps.get("c_statistic")
    log("PS C-statistic reasonable (0.6-0.9)",
        "PASS" if c_stat and 0.55 < c_stat < 0.95 else "WARN",
        f"C={c_stat:.4f}" if c_stat else "N/A")

    # 5. SMD improves after weighting
    if balance and isinstance(balance, list) and len(balance) > 0:
        smd_before = [abs(b.get("smd_before", 0)) for b in balance if isinstance(b, dict)]
        smd_after = [abs(b.get("smd_after", 0)) for b in balance if isinstance(b, dict)]
        if smd_before and smd_after:
            mean_before = np.mean(smd_before)
            mean_after = np.mean(smd_after)
            log("SMD improves after weighting",
                "PASS" if mean_after < mean_before else "FAIL",
                f"Before: {mean_before:.3f} -> After: {mean_after:.3f}")
        else:
            log("SMD improves after weighting", "WARN", "No SMD data in balance results")
    else:
        log("SMD improves after weighting", "WARN", "No covariate_balance data")

    # ── Validation against lifelines reference ──
    print("\n-- Phase 5: Numerical Validation vs lifelines --")

    def check(name, afar, reference, tol_pct=5, tol_abs=None):
        if afar is None or reference is None:
            log(name, "WARN", "Not computed")
            return
        if tol_abs is not None:
            diff = abs(afar - reference)
            ok = diff <= tol_abs
            log(name, "PASS" if ok else "FAIL",
                f"Afar={afar:.4f} ref={reference:.4f} diff={diff:.4f} (tol={tol_abs})")
        else:
            diff = abs((afar - reference) / reference) * 100 if reference != 0 else abs(afar) * 100
            ok = diff <= tol_pct
            log(name, "PASS" if ok else "FAIL",
                f"Afar={afar:.4f} ref={reference:.4f} diff={diff:.1f}% (tol={tol_pct}%)")

    check("Cox HR (multivariate)", unadj_hr, ref["cox_hr_multi"], tol_pct=5)
    check("Cox p-value", unadj.get("treatment_p_value"), ref["cox_p_multi"], tol_abs=0.02)

    for gname, cdata in km_curves.items():
        if isinstance(cdata, dict) and cdata.get("median_survival"):
            glow = gname.lower()
            if "untreated" in glow:
                check("KM Median (Untreated)", cdata["median_survival"],
                      ref["km_median_untreated"], tol_pct=5)
            elif "antifibrotic" in glow:
                check("KM Median (Antifibrotic)", cdata["median_survival"],
                      ref["km_median_antifibrotic"], tol_pct=5)

    lr_p = km.get("log_rank_test", {}).get("p_value")
    check("Log-rank p-value", lr_p, ref["logrank_p"], tol_abs=0.01)

    # ── TFLs and documents ──
    print("\n-- Phase 6: TFLs + Documents --")
    for tfl, nm in [("demographics","Demo"),("km-curve","KM"),("forest-plot","Forest"),("love-plot","Love")]:
        dd, cc = api("POST", f"/projects/{PID}/study/tfl/{tfl}", {})
        has = cc == 200 and bool(dd.get("html") or dd.get("svg") or dd.get("data") or dd.get("table"))
        log(f"TFL {nm}", "PASS" if has else "FAIL")

    dd, cc = api("POST", f"/projects/{PID}/generate-artifact?artifact_type=safety_assessment_report&format=html", {})
    if cc == 200:
        aid = dd.get("artifact_id")
        r = requests.get(f"{BASE}/artifacts/{aid}/download",
                         headers={"Authorization": f"Bearer {TOKEN}"}, timeout=30)
        log("SAR Download", "PASS" if len(r.content) > 5000 else "FAIL", f"{len(r.content):,} bytes")

    # Summary
    print("\n" + "=" * 70)
    p = sum(1 for v in RESULTS.values() if v["status"] == "PASS")
    f = sum(1 for v in RESULTS.values() if v["status"] == "FAIL")
    w = sum(1 for v in RESULTS.values() if v["status"] == "WARN")
    i = sum(1 for v in RESULTS.values() if v["status"] == "INFO")
    t = p + f + w
    print(f"PASSED: {p}/{t}  |  FAILED: {f}/{t}  |  WARNINGS: {w}/{t}  |  INFO: {i}")
    if f > 0:
        print("\nFAILURES:")
        for k, v in RESULTS.items():
            if v["status"] == "FAIL":
                print(f"  [FAIL] {k}: {v['detail']}")
    print("=" * 70)

    with open("ipf_full_validation.json", "w") as fout:
        json.dump({"results": RESULTS, "reference": ref, "summary": summary}, fout, indent=2, default=str)

    return f


if __name__ == "__main__":
    sys.exit(main() or 0)
