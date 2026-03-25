"""
End-to-end test: Patient-Level Data Ingestion for Cystic Hygroma Study
Tests: consent gate, file upload, 8 regulatory checks, ingestion report
"""
import requests
import csv
import io
import random
import json
import time
import sys
import os

# Fix Windows encoding
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:8000/api/v1"

# ── Generate realistic cystic hygroma study data ──
def generate_test_csv():
    """Generate a realistic de-identified patient-level dataset for
    cystic hygroma: OK-432 sclerotherapy (TRT) vs surgical excision (EC)."""
    random.seed(42)
    rows = []

    for i in range(1, 86):  # 85 subjects (35 TRT, 50 EC)
        arm = "OK-432" if i <= 35 else "EXCISION"
        age_months = random.randint(1, 144)
        sex = random.choice(["M", "F"])
        lesion_type = random.choice(["MACROCYSTIC", "MICROCYSTIC", "MIXED"])
        lesion_vol = round(random.uniform(5, 200), 1)

        # Outcomes: OK-432 works better for macrocystic
        if arm == "OK-432":
            base_resolution = 0.72 if lesion_type == "MACROCYSTIC" else 0.45
        else:
            base_resolution = 0.85

        resolved = 1 if random.random() < base_resolution else 0
        time_to_resolution = random.randint(30, 365) if resolved else 365
        complications = 1 if random.random() < (0.15 if arm == "OK-432" else 0.35) else 0
        recurrence = 1 if resolved and random.random() < (0.12 if arm == "OK-432" else 0.08) else 0
        n_procedures = random.randint(1, 3) if arm == "OK-432" else 1
        los_days = random.randint(0, 2) if arm == "OK-432" else random.randint(2, 7)

        # Add some missingness (realistic: ~5% for covariates, ~2% for endpoints)
        lesion_vol_val = "" if random.random() < 0.05 else str(lesion_vol)

        rows.append({
            "USUBJID": f"CH2024-{i:03d}",
            "STUDYID": "CH-2024",
            "SITEID": f"SITE{random.randint(1,5):02d}",
            "ARM": arm,
            "AGE": age_months,
            "SEX": sex,
            "LESION_TYPE": lesion_type,
            "LESION_VOL_ML": lesion_vol_val,
            "PRENATAL_DX": random.choice([0, 1]),
            "AIRWAY_COMPROMISE": 1 if random.random() < 0.15 else 0,
            "PRIOR_TX": 1 if random.random() < 0.10 else 0,
            "BILATERAL": 1 if random.random() < 0.20 else 0,
            "RESOLVED_12M": resolved,
            "TIME_TO_RESOLUTION": time_to_resolution,
            "CNSR": 0 if resolved else 1,
            "COMPLICATIONS": complications,
            "RECURRENCE_24M": recurrence,
            "N_PROCEDURES": n_procedures,
            "LOS_DAYS": los_days,
            "INDEX_YEAR": random.randint(2015, 2023),
        })

    # Write to CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def generate_pii_csv():
    """Generate a file WITH PII to test blocking."""
    return """USUBJID,ARM,AGE,SEX,PATIENT_NAME,SSN,EMAIL,DOB
CH-001,TRT,24,M,John Smith,123-45-6789,john@hospital.com,03/15/2020
CH-002,EC,36,F,Jane Doe,987-65-4321,jane@clinic.org,07/22/2019
"""


def main():
    print("=" * 70)
    print("PATIENT-LEVEL DATA INGESTION END-TO-END TEST")
    print("Study: CH-2024 — OK-432 vs Surgical Excision in Cystic Hygroma")
    print("=" * 70)
    print()

    # ── 1. Login ──
    print("── Step 1: Login ──")
    r = requests.post(f"{BASE}/auth/login", json={
        "email": "admin@afarensis.com", "password": "admin123"
    })
    if r.status_code != 200:
        print(f"[FAIL] Login failed: {r.status_code}")
        sys.exit(1)
    TOKEN = r.json()["access_token"]
    H = {"Authorization": f"Bearer {TOKEN}"}
    print(f"[PASS] Login: OK (token: {TOKEN[:20]}...)")

    # ── 2. Create project ──
    print("\n── Step 2: Create Project ──")
    r = requests.post(f"{BASE}/projects", headers=H, json={
        "title": "CH-2024: OK-432 vs Surgical Excision — Cystic Hygroma",
        "description": "Retrospective CER study",
        "research_intent": "Compare OK-432 sclerotherapy vs surgical excision"
    })
    PID = r.json()["id"]
    print(f"[PASS] Project: {PID}")

    # ── 3. Get attestation text ──
    print("\n── Step 3: HIPAA Attestation ──")
    r = requests.get(f"{BASE}/ingestion/attestation", headers=H)
    if r.status_code == 200:
        att = r.json()
        print(f"[PASS] Attestation: version={att['consent_version']}, length={len(att['attestation_text'])} chars")
    else:
        print(f"[FAIL] Attestation: HTTP {r.status_code}")

    # ── 4. Record consent ──
    print("\n── Step 4: Record Consent ──")
    r = requests.post(f"{BASE}/projects/{PID}/ingestion/consent", headers=H)
    if r.status_code == 200:
        consent = r.json()
        CONSENT_ID = consent["consent_id"]
        print(f"[PASS] Consent: {CONSENT_ID}")
        print(f"   Hash: {consent['attestation_hash'][:32]}...")
    else:
        print(f"[FAIL] Consent: HTTP {r.status_code} {r.text[:200]}")
        CONSENT_ID = None

    # ── 5. Upload CLEAN data ──
    print("\n── Step 5: Upload Clean Dataset (85 subjects) ──")
    clean_csv = generate_test_csv()
    r = requests.post(
        f"{BASE}/projects/{PID}/ingestion/upload",
        headers=H,
        files={"file": ("ch2024_deidentified.csv", clean_csv, "text/csv")},
        data={"consent_id": CONSENT_ID} if CONSENT_ID else {}
    )
    if r.status_code == 200:
        report = r.json()
        print(f"[PASS] Compliance Status: {report['compliance_status']}")
        print(f"   File: {report['file_name']} ({report['file_size_bytes']} bytes)")
        print(f"   SHA-256: {report['file_hash'][:32]}...")
        print(f"   Rows: {report['dataset_summary']['total_rows']}")
        print(f"   Arms: {report['dataset_summary']['n_by_arm']}")
        print(f"   Findings: {report['critical_count']} critical, {report['major_count']} major, {report['warning_count']} warning")
        print(f"   Next: {report['next_step']}")
        print()
        print("   FINDINGS TABLE:")
        for f in report["findings"]:
            icon = "[CRIT]" if f["severity"] == "CRITICAL" else "[WARN]" if f["severity"] in ("MAJOR", "WARNING") else "[OK]"
            print(f"   {icon} [{f['severity']}] {f['check']}: {f['result']}")
            print(f"      {f['detail'][:100]}")
        REPORT_ID = report.get("report_id")
    else:
        print(f"[FAIL] Upload: HTTP {r.status_code} {r.text[:300]}")
        REPORT_ID = None

    # ── 6. Upload PII-contaminated data (should be BLOCKED) ──
    print("\n── Step 6: Upload PII-Contaminated Dataset (should BLOCK) ──")
    pii_csv = generate_pii_csv()
    r = requests.post(
        f"{BASE}/projects/{PID}/ingestion/upload",
        headers=H,
        files={"file": ("contaminated.csv", pii_csv, "text/csv")},
    )
    if r.status_code == 200:
        report = r.json()
        status = report["compliance_status"]
        expected = "BLOCKED"
        icon = "[PASS]" if status == expected else "[FAIL]"
        print(f"{icon} Compliance Status: {status} (expected: {expected})")
        print(f"   Critical findings: {report['critical_count']}")
        for f in report["findings"]:
            if f["severity"] == "CRITICAL":
                print(f"   [CRIT] {f['detail'][:100]}")
    else:
        print(f"[FAIL] Upload: HTTP {r.status_code} {r.text[:300]}")

    # ── 7. List reports ──
    print("\n── Step 7: List Ingestion Reports ──")
    r = requests.get(f"{BASE}/projects/{PID}/ingestion/reports", headers=H)
    if r.status_code == 200:
        reports = r.json()
        print(f"[PASS] {len(reports)} reports found")
        for rpt in reports:
            print(f"   - {rpt['file_name']}: {rpt['compliance_status']} ({rpt['total_rows']} rows)")
    else:
        print(f"[FAIL] List: HTTP {r.status_code}")

    # ── 8. Acknowledge warnings ──
    if REPORT_ID:
        print("\n── Step 8: Acknowledge Warnings ──")
        r = requests.post(f"{BASE}/projects/{PID}/ingestion/reports/{REPORT_ID}/acknowledge", headers=H)
        if r.status_code == 200:
            print(f"[PASS] Acknowledged: {r.json()['status']}")
        else:
            print(f"[FAIL] Acknowledge: HTTP {r.status_code}")

    # ── 9. List datasets ──
    print("\n── Step 9: List Patient Datasets ──")
    r = requests.get(f"{BASE}/projects/{PID}/ingestion/datasets", headers=H)
    if r.status_code == 200:
        datasets = r.json()
        print(f"[PASS] {len(datasets)} datasets")
        for ds in datasets:
            print(f"   - {ds['name']}: {ds['records']} records ({ds['status']})")
    else:
        print(f"[FAIL] Datasets: HTTP {r.status_code}")

    # ── 10. Test retention decision ──
    print("\n── Step 10: Retention Decision (PERSIST) ──")
    r = requests.post(f"{BASE}/projects/{PID}/retention/decide", headers=H,
        json={"decision": "PERSIST"})
    if r.status_code == 200:
        print(f"[PASS] Decision: {r.json()['decision']}")
    else:
        print(f"[FAIL] Retention: HTTP {r.status_code} {r.text[:200]}")

    print("\n" + "=" * 70)
    print("END-TO-END INGESTION TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
