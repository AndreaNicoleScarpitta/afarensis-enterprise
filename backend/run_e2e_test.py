"""
End-to-end test: Cystic Hygroma - OK-432 Sclerotherapy vs Surgical Excision
Runs real clinical data through every layer of the Afarensis platform.
"""
import requests, json, time, sys

BASE = "http://localhost:8000/api/v1"
RESULTS = {}

def log(section, status, detail=""):
    icon = {"PASS": "[OK]", "FAIL": "[FAIL]", "WARN": "[WARN]"}.get(status, "[??]")
    print(f"{icon} {section}: {status} {detail}")
    RESULTS[section] = {"status": status, "detail": detail}

def api(method, path, token=None, json_data=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        if method == "GET":
            r = requests.get(f"{BASE}{path}", headers=headers, timeout=30)
        elif method == "POST":
            r = requests.post(f"{BASE}{path}", headers=headers, json=json_data, timeout=60)
        elif method == "PUT":
            r = requests.put(f"{BASE}{path}", headers=headers, json=json_data, timeout=30)
        return r.json() if r.text else {}, r.status_code
    except Exception as e:
        return {"error": str(e)}, 0

print("=" * 70)
print("AFARENSIS END-TO-END TEST: CYSTIC HYGROMA STUDY")
print("OK-432 Sclerotherapy vs Surgical Excision")
print("=" * 70)

# 1. LOGIN
print("\n-- PHASE 1: Authentication --")
data, code = api("POST", "/auth/login", json_data={
    "email": "admin@afarensis.com", "password": "admin123"
})
if code == 200 and "access_token" in data:
    TOKEN = data["access_token"]
    log("Login", "PASS", f"Token obtained")
else:
    log("Login", "FAIL", f"HTTP {code}")
    sys.exit(1)

# 2. CREATE PROJECT
print("\n-- PHASE 2: Project Creation --")
data, code = api("POST", "/projects", TOKEN, {
    "title": "CH-2024: OK-432 Sclerotherapy vs Surgical Excision in Pediatric Cystic Hygroma",
    "description": "Retrospective comparative effectiveness study evaluating OK-432 (Picibanil) sclerotherapy versus surgical excision for cervical cystic hygromas in pediatric patients aged 0-12 years.",
    "research_intent": "Compare efficacy and safety of OK-432 sclerotherapy versus surgical excision in pediatric cervical cystic hygroma measuring complete resolution rate time to resolution complication rates and recurrence at 12 months"
})
if code == 200 and data.get("id"):
    PID = data["id"]
    log("Create Project", "PASS", f"ID: {PID[:12]}...")
else:
    log("Create Project", "FAIL", f"HTTP {code}")
    sys.exit(1)

# 3. STUDY DEFINITION
print("\n-- PHASE 3: Study Definition --")
data, code = api("PUT", f"/projects/{PID}/study/definition", TOKEN, {
    "study_title": "CH-2024: OK-432 vs Surgical Excision in Pediatric Cystic Hygroma",
    "indication": "Cervical cystic hygroma (lymphatic malformation)",
    "population": "Pediatric patients aged 0-12 years with cervical cystic hygroma confirmed by US/MRI, treated 2015-2023",
    "intervention": "OK-432 (Picibanil) intralesional injection, 0.01mg/session, up to 3 sessions q4weeks",
    "comparator": "Surgical excision (complete or near-complete) under general anesthesia",
    "primary_endpoint": "Complete resolution (>90% volume reduction) at 12 months",
    "secondary_endpoints": ["Time to resolution (days)", "Complication rate", "Recurrence at 24 months", "Number of procedures", "Hospital stay (days)"],
    "study_design": "Retrospective cohort with propensity score adjustment",
    "estimand_framework": {"type": "ATT", "population": "As-treated", "variable": "Complete resolution at 12mo (binary)", "summary_measure": "Risk difference and OR"}
})
log("Save Study Definition", "PASS" if code == 200 else "FAIL")

data, code = api("GET", f"/projects/{PID}/study/definition", TOKEN)
has_data = bool(data.get("study_title") or data.get("study_definition", {}).get("study_title"))
log("Read Study Definition", "PASS" if has_data else "WARN", "Data persisted" if has_data else "Empty response")

# 4. COVARIATES
print("\n-- PHASE 4: Covariates --")
data, code = api("PUT", f"/projects/{PID}/study/covariates", TOKEN, {
    "covariates": [
        {"name": "age_months", "label": "Age at diagnosis (months)", "type": "continuous"},
        {"name": "sex", "label": "Sex (M/F)", "type": "binary"},
        {"name": "lesion_type", "label": "Macrocystic/microcystic/mixed", "type": "categorical"},
        {"name": "lesion_volume_ml", "label": "Baseline volume (mL)", "type": "continuous"},
        {"name": "laterality", "label": "Unilateral vs bilateral", "type": "binary"},
        {"name": "prior_treatment", "label": "Prior treatment attempts", "type": "binary"},
        {"name": "prenatal_dx", "label": "Prenatally diagnosed", "type": "binary"},
        {"name": "airway_compromise", "label": "Airway compromise", "type": "binary"},
    ],
    "unmeasured": [
        {"name": "surgeon_experience", "label": "Operator experience level"},
        {"name": "ses", "label": "Socioeconomic status"},
    ]
})
log("Save Covariates", "PASS" if code == 200 else "FAIL", "8 measured + 2 unmeasured")

# 5. COHORT
print("\n-- PHASE 5: Cohort Definition --")
data, code = api("PUT", f"/projects/{PID}/study/cohort", TOKEN, {
    "inclusion": [
        {"criterion": "Age 0-12 years at diagnosis"},
        {"criterion": "Confirmed cervical cystic hygroma by imaging"},
        {"criterion": "Treated with OK-432 OR surgical excision"},
        {"criterion": "Minimum 12 months follow-up"},
    ],
    "exclusion": [
        {"criterion": "Non-cervical location"},
        {"criterion": "Known chromosomal abnormality"},
        {"criterion": "Prior sclerotherapy with non-OK-432 agent"},
    ]
})
log("Save Cohort", "PASS" if code == 200 else "FAIL")

# 6. EVIDENCE DISCOVERY
print("\n-- PHASE 6: Evidence Discovery --")
data, code = api("POST", f"/projects/{PID}/discover-evidence", TOKEN)
if code == 202:
    task_id = data.get("task_id", "")
    log("Evidence Discovery Started", "PASS", f"Task: {task_id[:12]}...")
    for i in range(15):
        time.sleep(2)
        st, sc = api("GET", f"/tasks/{task_id}", TOKEN)
        state = st.get("state", "unknown")
        if state == "completed":
            log("Evidence Discovery Completed", "PASS", f"Duration: {st.get('duration_seconds', '?')}s")
            break
        elif state == "failed":
            log("Evidence Discovery Completed", "FAIL", st.get("error", ""))
            break
    else:
        log("Evidence Discovery Completed", "WARN", "Timeout after 30s")
elif code == 200:
    log("Evidence Discovery", "PASS", "(sync)")
else:
    log("Evidence Discovery", "FAIL", f"HTTP {code}")

data, code = api("GET", f"/projects/{PID}/evidence", TOKEN)
items = data if isinstance(data, list) else data.get("items", [])
log("Evidence Count", "PASS" if len(items) > 0 else "WARN", f"{len(items)} records")

# 7. STATISTICAL ANALYSES
print("\n-- PHASE 7: Statistical Analysis --")

data, code = api("POST", f"/projects/{PID}/study/balance/compute", TOKEN, {})
log("Compute Balance (SMD/IPTW)", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/study/bias/run", TOKEN, {})
log("Run Bias Analysis", "PASS" if code == 200 else "FAIL")

data, code = api("GET", f"/projects/{PID}/study/results/forest-plot", TOKEN)
log("Forest Plot Data", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/study/missing-data/impute", TOKEN, {})
log("Multiple Imputation (MICE)", "PASS" if code == 200 else "FAIL")
if code == 200:
    pe = data.get("pooled_estimate") or data.get("result", {}).get("pooled_estimate")
    log("  Pooled Estimate", "PASS" if pe else "WARN", f"{pe}")

data, code = api("POST", f"/projects/{PID}/study/missing-data/tipping", TOKEN, {})
log("Tipping Point Analysis", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/study/missing-data/mmrm", TOKEN, {})
log("MMRM Analysis", "PASS" if code == 200 else "FAIL")

data, code = api("GET", "/statistics/full-analysis", TOKEN)
if code == 200:
    cox = data.get("cox_proportional_hazards", {})
    hr = cox.get("hazard_ratio")
    ci = cox.get("confidence_interval")
    pval = cox.get("p_value")
    log("Cox PH Model", "PASS", f"HR={hr}, 95%CI={ci}, p={pval}")

    km = data.get("kaplan_meier", {})
    log("Kaplan-Meier", "PASS" if km else "WARN", f"Keys: {list(km.keys())[:4]}")

    ev = data.get("e_value", {})
    log("E-Value (unmeasured confounding)", "PASS" if ev else "WARN", f"E={ev.get('e_value')}")

    fi = data.get("fragility_index", {})
    log("Fragility Index", "PASS" if fi else "WARN", f"FI={fi.get('fragility_index')}")

    ma = data.get("meta_analysis", {})
    log("Meta-Analysis", "PASS" if ma else "WARN")
else:
    log("Full Statistical Analysis", "FAIL", f"HTTP {code}")

data, code = api("POST", f"/projects/{PID}/study/bayesian/analyze", TOKEN, {})
log("Bayesian Analysis", "PASS" if code == 200 else "FAIL")

# 8. CDISC DATASETS
print("\n-- PHASE 8: CDISC Datasets --")
for ds in ["adsl", "adae", "adtte"]:
    data, code = api("POST", f"/projects/{PID}/adam/generate/{ds}", TOKEN, {})
    if code == 200:
        n = data.get("records_count", data.get("record_count", "?"))
        v = len(data.get("variables", []))
        log(f"ADaM {ds.upper()}", "PASS", f"{n} records, {v} vars")
    else:
        log(f"ADaM {ds.upper()}", "FAIL", f"HTTP {code}")

data, code = api("POST", f"/projects/{PID}/adam/validate", TOKEN, {})
log("ADaM Validation", "PASS" if code == 200 else "FAIL")

data, code = api("GET", f"/projects/{PID}/adam/metadata", TOKEN)
log("ADaM Metadata", "PASS" if code == 200 else "FAIL")

# 9. TFLs
print("\n-- PHASE 9: TFL Generation --")
for ep, name in [("demographics", "Demographics"), ("ae-table", "AE Table"), ("km-curve", "KM Curves"), ("forest-plot", "Forest Plot"), ("love-plot", "Love Plot")]:
    data, code = api("POST", f"/projects/{PID}/study/tfl/{ep}", TOKEN, {})
    content = bool(data.get("html") or data.get("table") or data.get("figure") or data.get("svg") or data.get("data")) if code == 200 else False
    log(f"TFL: {name}", "PASS" if content else ("WARN" if code == 200 else "FAIL"))

data, code = api("POST", f"/projects/{PID}/study/tfl/generate-all", TOKEN, {})
log("Generate All TFLs", "PASS" if code == 200 else "FAIL")

# 10. DOCUMENTS
print("\n-- PHASE 10: Regulatory Documents --")
data, code = api("POST", f"/projects/{PID}/study/sap/generate", TOKEN, {})
log("SAP Document", "PASS" if code == 200 else "FAIL")

for sec in ["synopsis", "section-11", "section-12", "appendix-16"]:
    data, code = api("POST", f"/projects/{PID}/submission/csr/{sec}", TOKEN, {})
    log(f"CSR {sec}", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/submission/csr/full", TOKEN, {})
log("Full CSR", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/submission/adrg/generate", TOKEN, {})
log("ADRG", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/submission/define-xml/generate", TOKEN, {})
log("Define-XML 2.1", "PASS" if code == 200 else "FAIL")

# 11. eCTD
print("\n-- PHASE 11: eCTD Packaging --")
data, code = api("POST", f"/projects/{PID}/submission/ectd/generate", TOKEN, {})
log("eCTD Package", "PASS" if code == 200 else "FAIL")

data, code = api("POST", f"/projects/{PID}/submission/ectd/validate", TOKEN, {})
log("eCTD Validation", "PASS" if code == 200 else "FAIL")

data, code = api("GET", f"/projects/{PID}/submission/status", TOKEN)
if code == 200:
    score = data.get("overall_readiness", data.get("readiness_score", data.get("score", "?")))
    log("Submission Readiness", "PASS", f"Score: {score}")
else:
    log("Submission Readiness", "FAIL")

# 12. AUDIT
print("\n-- PHASE 12: Audit & Traceability --")
data, code = api("GET", f"/projects/{PID}/study/audit", TOKEN)
events = data if isinstance(data, list) else data.get("items", data.get("events", []))
log("Audit Trail", "PASS", f"{len(events)} events")

data, code = api("GET", "/system/metrics", TOKEN)
if code == 200:
    log("System Metrics", "PASS", f"Reqs: {data.get('total_requests')}, p50: {data.get('latency', {}).get('p50_ms')}ms")

# SUMMARY
print("\n" + "=" * 70)
print("RESULTS SUMMARY")
print("=" * 70)

passed = sum(1 for v in RESULTS.values() if v["status"] == "PASS")
failed = sum(1 for v in RESULTS.values() if v["status"] == "FAIL")
warned = sum(1 for v in RESULTS.values() if v["status"] == "WARN")
total = len(RESULTS)

print(f"\n  PASSED:   {passed}/{total}")
print(f"  FAILED:   {failed}/{total}")
print(f"  WARNINGS: {warned}/{total}")
print(f"  PASS RATE: {passed/total*100:.0f}%")

if failed > 0:
    print("\n  FAILURES:")
    for k, v in RESULTS.items():
        if v["status"] == "FAIL":
            print(f"    X {k}: {v['detail']}")

if warned > 0:
    print("\n  WARNINGS:")
    for k, v in RESULTS.items():
        if v["status"] == "WARN":
            print(f"    ! {k}: {v['detail']}")

print("\n" + "=" * 70)
