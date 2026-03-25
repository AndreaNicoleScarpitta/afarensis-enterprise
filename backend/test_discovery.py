"""Test evidence discovery with real API keys."""
import requests, time

BASE = "http://localhost:8000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"email": "admin@afarensis.com", "password": "admin123"})
TOKEN = r.json()["access_token"]
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Get or create project
r = requests.get(f"{BASE}/projects", headers=H)
d = r.json()
items = d if isinstance(d, list) else d.get("items", [])
ch_projects = [p for p in items if "Cystic" in p.get("title", "") or "CH-" in p.get("title", "")]

if ch_projects:
    PID = ch_projects[0]["id"]
else:
    r = requests.post(f"{BASE}/projects", headers=H, json={
        "title": "CH-2024: OK-432 vs Surgery in Cystic Hygroma",
        "description": "Real evidence discovery test",
        "research_intent": "cystic hygroma sclerotherapy OK-432 pediatric"
    })
    PID = r.json()["id"]

print(f"Project: {PID}")

# Discover evidence
r = requests.post(f"{BASE}/projects/{PID}/discover-evidence", headers=H, json={})
print(f"Discovery: {r.status_code}")
body = r.json()
print(f"Response: {body}")

if r.status_code == 202:
    task_id = body.get("task_id")
    for i in range(20):
        time.sleep(2)
        st = requests.get(f"{BASE}/tasks/{task_id}", headers=H).json()
        state = st.get("state")
        msg = st.get("message") or ""
        err = st.get("error") or ""
        print(f"  Poll {i+1}: state={state}, msg={msg[:80]}, err={err[:120]}")
        if state in ("completed", "failed"):
            if state == "completed":
                result = requests.get(f"{BASE}/tasks/{task_id}/result", headers=H).json()
                print(f"  Result: {result}")
            break

# Check evidence count
r = requests.get(f"{BASE}/projects/{PID}/evidence", headers=H)
d = r.json()
items = d if isinstance(d, list) else d.get("items", [])
print(f"\nEvidence records found: {len(items)}")
for item in items[:5]:
    title = item.get("title", "?")[:80]
    source = item.get("source_type", "?")
    year = item.get("publication_year", "?")
    print(f"  [{source}] ({year}) {title}")
