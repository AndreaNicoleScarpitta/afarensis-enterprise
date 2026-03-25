"""Confirm all 5 evidence sources work end-to-end."""
import requests, time, json

BASE = "http://localhost:8000/api/v1"

# Login
r = requests.post(f"{BASE}/auth/login", json={"email": "admin@afarensis.com", "password": "admin123"})
TOKEN = r.json()["access_token"]
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Create project
r = requests.post(f"{BASE}/projects", headers=H, json={
    "title": "CH-FULL: All-Source Cystic Hygroma Evidence Review",
    "description": "Testing all 5 evidence sources",
    "research_intent": "cystic hygroma sclerotherapy OK-432 pediatric lymphatic malformation treatment"
})
PID = r.json()["id"]
print(f"Project: {PID[:12]}...")

# Discover evidence (hits all 4 external sources)
print("\n--- Discovering evidence from all sources ---")
r = requests.post(f"{BASE}/projects/{PID}/discover-evidence", headers=H)
task_id = r.json().get("task_id", "")

for i in range(30):
    time.sleep(2)
    st = requests.get(f"{BASE}/tasks/{task_id}", headers=H).json()
    state = st.get("state", "unknown")
    msg = st.get("message") or ""
    print(f"  [{i*2}s] {state}: {msg[:60]}")
    if state in ("completed", "failed"):
        break

# Get all evidence
r = requests.get(f"{BASE}/projects/{PID}/evidence", headers=H)
d = r.json()
items = d if isinstance(d, list) else d.get("items", [])

# Count by source
sources = {"PubMed": 0, "ClinicalTrials": 0, "OpenAlex": 0, "SemanticScholar": 0, "Other": 0}
for item in items:
    sid = item.get("source_id", "")
    stype = item.get("source_type", "")
    if sid.startswith("openalex_"):
        sources["OpenAlex"] += 1
    elif sid.startswith("ss_"):
        sources["SemanticScholar"] += 1
    elif sid.startswith("NCT") or stype == "CLINICALTRIALS":
        sources["ClinicalTrials"] += 1
    elif stype == "PUBMED" and not sid.startswith("openalex_") and not sid.startswith("ss_"):
        sources["PubMed"] += 1
    else:
        sources["Other"] += 1

print(f"\n{'='*60}")
print(f"EVIDENCE SOURCE RESULTS")
print(f"{'='*60}")
print(f"  Total records: {len(items)}")
print()
for src, count in sources.items():
    status = "[OK]" if count > 0 else "[--]"
    print(f"  {status} {src}: {count} records")

print()
print("--- Sample records by source ---")
shown = set()
for item in items:
    sid = item.get("source_id", "")
    if sid.startswith("openalex_") and "OpenAlex" not in shown:
        shown.add("OpenAlex")
        print(f"  OpenAlex: ({item.get('publication_year','?')}) {item.get('title','?')[:70]}")
    elif sid.startswith("ss_") and "SS" not in shown:
        shown.add("SS")
        print(f"  Semantic Scholar: ({item.get('publication_year','?')}) {item.get('title','?')[:70]}")
    elif (sid.startswith("NCT") or item.get("source_type") == "CLINICALTRIALS") and "CT" not in shown:
        shown.add("CT")
        print(f"  ClinicalTrials: {sid} {item.get('title','?')[:60]}")
    elif (sid.startswith("PMID") or item.get("source_type") == "PUBMED") and "PM" not in shown and not sid.startswith("openalex_") and not sid.startswith("ss_"):
        shown.add("PM")
        print(f"  PubMed: {sid} ({item.get('publication_year','?')}) {item.get('title','?')[:60]}")

# Test BioGPT
print(f"\n{'='*60}")
print("BIOGPT TEST")
print(f"{'='*60}")
r = requests.get(f"{BASE}/biogpt/status", headers=H)
if r.status_code == 200:
    status_data = r.json()
    print(f"  Status: {status_data.get('status', '?')}")
    print(f"  Model: {status_data.get('model', '?')}")
    if status_data.get("status") == "ready":
        print(f"  Device: {status_data.get('device', '?')}")
        print(f"  Parameters: {status_data.get('parameters_millions', '?')}M")

        # Generate text
        r2 = requests.post(f"{BASE}/biogpt/explain-mechanism", headers=H,
            json={"drug": "OK-432 (Picibanil)", "condition": "cystic hygroma"}, timeout=120)
        if r2.status_code == 200:
            result = r2.json()
            text = result.get("explanation") or result.get("text", "")
            print(f"\n  Mechanism explanation ({result.get('model','?')}):")
            print(f"  {text[:300]}...")
        else:
            print(f"  BioGPT generate: HTTP {r2.status_code}")
    else:
        print(f"  BioGPT not loaded yet (first call loads the model)")
else:
    print(f"  BioGPT status: HTTP {r.status_code}")

# Final summary
print(f"\n{'='*60}")
print("FINAL SUMMARY")
print(f"{'='*60}")
all_ok = all(v > 0 for k, v in sources.items() if k != "Other")
print(f"  All 4 external sources returned data: {'YES' if all_ok else 'NO'}")
print(f"  BioGPT available: {'YES' if r.status_code == 200 else 'NO'}")
print(f"  Total evidence records: {len(items)}")
print(f"  Sources active: {sum(1 for v in sources.values() if v > 0)}/4")
