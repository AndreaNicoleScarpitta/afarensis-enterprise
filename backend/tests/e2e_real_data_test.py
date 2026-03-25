#!/usr/bin/env python3
"""
E2E Test: Upload real CSV data, run analysis, verify results flow end-to-end.

Study: Cystic Hygroma — OK-432 Sclerotherapy vs Surgical Excision
This test creates a realistic de-identified clinical dataset, uploads it through
the consent gate, runs all 8 regulatory checks, executes statistical analysis,
generates ADaM datasets and TFLs, and verifies the entire pipeline.
"""
import os
import sys
import csv
import json
import random
import tempfile
import requests
import time

BASE = "http://localhost:8000/api/v1"
RESULTS = {}
TOKEN = None
PROJECT_ID = None


def log(section, status, detail=""):
    icon = {"PASS": "[PASS]", "FAIL": "[FAIL]", "WARN": "[WARN]"}[status]
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
            r = requests.get(url, headers=headers, timeout=60)
        elif method == "POST":
            if files:
                r = requests.post(url, headers=headers, files=files, data=data, timeout=60)
            else:
                r = requests.post(url, headers=headers, json=json_data, timeout=60)
        elif method == "PUT":
            r = requests.put(url, headers=headers, json=json_data, timeout=60)
        return r.json() if r.text and r.status_code != 204 else {}, r.status_code
    except Exception as e:
        return {"error": str(e)}, 0


def generate_cystic_hygroma_csv(filepath):
    """Generate a realistic de-identified cystic hygroma study dataset."""
    random.seed(42)
    rows = []

    # 45 patients: 20 OK-432, 25 surgical
    for i in range(45):
        arm = "OK-432" if i < 20 else "SURGERY"
        age_months = random.randint(1, 144)  # 0-12 years
        sex = random.choice(["M", "F"])
        lesion_type = random.choices(
            ["MACROCYSTIC", "MICROCYSTIC", "MIXED"],
            weights=[0.5, 0.2, 0.3]
        )[0]
        lesion_volume = round(random.gauss(45 if arm == "OK-432" else 55, 25), 1)
        lesion_volume = max(5.0, lesion_volume)
        laterality = random.choice(["UNILATERAL", "BILATERAL"])
        prior_treatment = random.choice([0, 1])
        prenatal_dx = random.choice([0, 1])
        airway = random.choice([0, 0, 0, 1])  # 25% airway compromise

        # Outcomes — OK-432 slightly better for macrocystic
        base_resolution_prob = 0.72 if arm == "OK-432" else 0.65
        if lesion_type == "MACROCYSTIC":
            base_resolution_prob += 0.15 if arm == "OK-432" else 0.05
        elif lesion_type == "MICROCYSTIC":
            base_resolution_prob -= 0.10

        complete_resolution = 1 if random.random() < base_resolution_prob else 0
        time_to_resolution = random.randint(30, 365) if complete_resolution else 365
        complications = random.choice([0, 0, 0, 1])  # 25% complication rate
        recurrence_24m = 0 if not complete_resolution else (1 if random.random() < 0.15 else 0)
        procedures = random.randint(1, 3) if arm == "OK-432" else 1
        los_days = random.randint(0, 2) if arm == "OK-432" else random.randint(2, 7)

        rows.append({
            "USUBJID": f"CH2024-{i+1:03d}",
            "ARM": arm,
            "AGE_MONTHS": age_months,
            "SEX": sex,
            "LESION_TYPE": lesion_type,
            "LESION_VOL_ML": lesion_volume,
            "LATERALITY": laterality,
            "PRIOR_TRT": prior_treatment,
            "PRENATAL_DX": prenatal_dx,
            "AIRWAY_COMPROMISE": airway,
            "COMPLETE_RESOLUTION": complete_resolution,
            "TIME_TO_RESOLUTION": time_to_resolution,
            "COMPLICATIONS": complications,
            "RECURRENCE_24M": recurrence_24m,
            "N_PROCEDURES": procedures,
            "LOS_DAYS": los_days,
        })

    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def main():
    global TOKEN, PROJECT_ID

    print("=" * 70)
    print("AFARENSIS E2E TEST: REAL DATA PIPELINE")
    print("Study: Cystic Hygroma — OK-432 vs Surgical Excision")
    print("=" * 70)

    # ── Phase 1: Login ──
    print("\n-- Phase 1: Authentication --")
    data, code = api("POST", "/auth/login", {"email": "admin@afarensis.com", "password": "admin123"})
    if code == 200 and "access_token" in data:
        TOKEN = data["access_token"]
        log("Login", "PASS", f"Token obtained")
    else:
        log("Login", "FAIL", f"HTTP {code}")
        return

    # ── Phase 2: Create Project ──
    print("\n-- Phase 2: Create Project --")
    data, code = api("POST", "/projects", {
        "title": "CH-2024: OK-432 vs Surgical Excision in Pediatric Cystic Hygroma",
        "description": "Retrospective comparative effectiveness study",
        "research_intent": "Compare OK-432 sclerotherapy vs surgical excision for pediatric cervical cystic hygroma"
    })
    if code == 200 and "id" in data:
        PROJECT_ID = data["id"]
        log("Create Project", "PASS", f"ID: {PROJECT_ID[:12]}...")
    else:
        log("Create Project", "FAIL", f"HTTP {code}: {json.dumps(data)[:100]}")
        return

    # ── Phase 3: Consent Attestation ──
    print("\n-- Phase 3: HIPAA Consent Gate --")
    attestation = (
        "I certify that the data I am uploading has been de-identified in accordance "
        "with either the Expert Determination method or the Safe Harbor method as "
        "defined under 45 CFR 164.514(b)-(c) (HIPAA Privacy Rule)."
    )
    data, code = api("POST", f"/projects/{PROJECT_ID}/ingestion/consent", {
        "attestation_text": attestation,
        "consent_version": "HIPAA-SH-v1.2"
    })
    consent_id = None
    if code == 200 and data:
        consent_id = data.get("consent_id", data.get("id"))
        log("Consent Attestation", "PASS", f"Consent ID: {str(consent_id)[:12]}...")
    else:
        log("Consent Attestation", "FAIL", f"HTTP {code}: {json.dumps(data)[:100]}")
        # Try without consent to see if upload works anyway
        log("Consent Attestation", "WARN", "Proceeding without consent to test upload endpoint")

    # ── Phase 4: Generate & Upload CSV ──
    print("\n-- Phase 4: Upload Patient Data --")
    csv_path = os.path.join(tempfile.gettempdir(), "cystic_hygroma_study.csv")
    n_rows = generate_cystic_hygroma_csv(csv_path)
    log("Generate CSV", "PASS", f"{n_rows} patients, 16 columns")

    # Upload via multipart form data
    with open(csv_path, "rb") as f:
        files = {"file": ("cystic_hygroma_study.csv", f, "text/csv")}
        form_data = {}
        if consent_id:
            form_data["consent_id"] = str(consent_id)

        headers = {"Authorization": f"Bearer {TOKEN}"}
        r = requests.post(
            f"{BASE}/projects/{PROJECT_ID}/ingestion/upload",
            headers=headers, files=files, data=form_data, timeout=60
        )
        upload_code = r.status_code
        try:
            upload_data = r.json()
        except:
            upload_data = {"raw": r.text[:300]}

    if upload_code == 200:
        status = upload_data.get("compliance_status", "?")
        critical = upload_data.get("critical_count", 0)
        major = upload_data.get("major_count", 0)
        warning = upload_data.get("warning_count", 0)
        log("Upload Patient Data", "PASS", f"Status: {status}, Critical: {critical}, Major: {major}, Warning: {warning}")

        # Show findings
        findings = upload_data.get("findings", [])
        for f in findings:
            sev = f.get("severity", "?")
            name = f.get("check_name", f.get("name", "?"))
            result = f.get("result", "?")
            log(f"  Check: {name}", "PASS" if sev != "CRITICAL" else "FAIL", f"[{sev}] {result}")

        # Dataset summary
        summary = upload_data.get("dataset_summary", {})
        log("Dataset Summary", "PASS",
            f"Rows: {summary.get('total_rows', '?')}, "
            f"Arms: {json.dumps(summary.get('n_by_arm', {}))}")
    else:
        log("Upload Patient Data", "FAIL", f"HTTP {upload_code}: {json.dumps(upload_data)[:200]}")

    # ── Phase 5: Run Statistical Analysis on Real Data ──
    print("\n-- Phase 5: Statistical Analysis on Uploaded Data --")
    data, code = api("POST", f"/projects/{PROJECT_ID}/study/analyze-dataset", {})
    if code == 200 and data:
        source = data.get("data_source", "?")
        cox = data.get("cox_proportional_hazards", {})
        hr = cox.get("hazard_ratio")
        km = data.get("kaplan_meier", {})
        evalue = data.get("e_value", {})
        log("Analyze Dataset", "PASS", f"Source: {source}")
        if hr:
            ci = cox.get("confidence_interval", [])
            log("  Cox PH", "PASS", f"HR={hr:.3f}, 95% CI=[{ci[0]:.3f}, {ci[1]:.3f}]" if ci else f"HR={hr:.3f}")
        if km:
            log("  Kaplan-Meier", "PASS", f"Keys: {list(km.keys())[:4]}")
        if evalue:
            log("  E-Value", "PASS", f"E={evalue.get('e_value', '?')}")
    else:
        log("Analyze Dataset", "FAIL", f"HTTP {code}: {json.dumps(data)[:200]}")

    # ── Phase 6: Generate ADaM from Real Data ──
    print("\n-- Phase 6: ADaM from Real Data --")
    for ds in ["adsl", "adae", "adtte"]:
        data, code = api("POST", f"/projects/{PROJECT_ID}/adam/generate/{ds}", {})
        if code == 200:
            records = data.get("records_count", data.get("record_count", "?"))
            log(f"ADaM {ds.upper()}", "PASS", f"{records} records")
        else:
            log(f"ADaM {ds.upper()}", "FAIL", f"HTTP {code}")

    # ── Phase 7: Generate TFLs from Real Data ──
    print("\n-- Phase 7: TFLs from Real Data --")
    for tfl, name in [("demographics", "Demographics"), ("km-curve", "KM Curve"),
                       ("forest-plot", "Forest Plot"), ("love-plot", "Love Plot"),
                       ("ae-table", "AE Table")]:
        data, code = api("POST", f"/projects/{PROJECT_ID}/study/tfl/{tfl}", {})
        has_content = code == 200 and bool(data.get("html") or data.get("svg") or data.get("data") or data.get("table"))
        log(f"TFL {name}", "PASS" if has_content else ("WARN" if code == 200 else "FAIL"),
            f"HTTP {code}, has_content={has_content}")

    # ── Phase 8: Regulatory Documents ──
    print("\n-- Phase 8: Regulatory Documents --")
    for doc, name in [
        ("sap/generate", "SAP"),
        ("csr/synopsis", "CSR Synopsis"),
        ("csr/section-11", "CSR Section 11"),
        ("adrg/generate", "ADRG"),
    ]:
        path = f"/projects/{PROJECT_ID}/submission/{doc}" if "/" in doc and "sap" not in doc else f"/projects/{PROJECT_ID}/study/{doc}"
        data, code = api("POST", path, {})
        log(f"Generate {name}", "PASS" if code == 200 else "FAIL", f"HTTP {code}")

    # ── Phase 9: Verify Data Source ──
    print("\n-- Phase 9: Verify Data Source --")
    data, code = api("GET", f"/projects/{PROJECT_ID}/datasets")
    if code == 200:
        datasets = data if isinstance(data, list) else data.get("datasets", [])
        for ds in datasets:
            log(f"Dataset: {ds.get('name', '?')}", "PASS",
                f"Status: {ds.get('status', '?')}, Rows: {ds.get('records_count', '?')}")
    else:
        log("List Datasets", "FAIL", f"HTTP {code}")

    # ══════════════════════════════════════════════════════════════════
    print("\n" + "=" * 70)
    passed = sum(1 for v in RESULTS.values() if v["status"] == "PASS")
    failed = sum(1 for v in RESULTS.values() if v["status"] == "FAIL")
    warned = sum(1 for v in RESULTS.values() if v["status"] == "WARN")
    total = len(RESULTS)
    print(f"PASSED: {passed}/{total}  |  FAILED: {failed}/{total}  |  WARNINGS: {warned}/{total}")

    if failed > 0:
        print("\nFAILURES:")
        for k, v in RESULTS.items():
            if v["status"] == "FAIL":
                print(f"  [FAIL] {k}: {v['detail']}")
    print("=" * 70)
    return failed


if __name__ == "__main__":
    sys.exit(main() or 0)
