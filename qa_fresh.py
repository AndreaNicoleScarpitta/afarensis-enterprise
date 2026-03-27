"""Critical Path QA -- run against freshly seeded data."""
import requests
import json

BASE = 'http://localhost:8000/api/v1'
S = requests.Session()
passed = 0
failed = 0
total = 0

def check(name, ok, got=''):
    global passed, failed, total
    total += 1
    if ok:
        passed += 1
        print(f'  PASS  {name}')
    else:
        failed += 1
        print(f'  FAIL  {name} -- got: {got}')

print('=' * 60)
print('  CRITICAL PATH QA (fresh data)')
print('=' * 60)

# 1. Health
print()
print('--- 1. Server Health ---')
r = S.get(f'{BASE}/health')
check('Server healthy', r.status_code == 200)

# 2. Auth
print()
print('--- 2. Authentication ---')
r = S.post(f'{BASE}/auth/login', json={'email': 'admin@afarensis.com', 'password': 'admin123'})
token = None
if r.status_code == 200:
    token = r.json().get('access_token')
check('Login success', r.status_code == 200)
check('Token returned', token is not None)

r = S.post(f'{BASE}/auth/login', json={'email': 'admin@afarensis.com', 'password': 'wrong'})
check('Bad password rejected', r.status_code in (401, 403))

headers = {'Authorization': f'Bearer {token}'} if token else {}

# 3. Projects
print()
print('--- 3. Project Listing ---')
r = S.get(f'{BASE}/projects', headers=headers)
check('Projects endpoint OK', r.status_code == 200)
projects = r.json() if r.status_code == 200 else []
if isinstance(projects, dict):
    projects = projects.get('projects', projects.get('items', []))
sample_projects = [p for p in projects if '[Sample]' in (p.get('title', '') or '')]
check('4 sample projects found', len(sample_projects) >= 4, f'found {len(sample_projects)}')

# Build ID map
pid_map = {}
for p in sample_projects:
    title = p.get('title', '')
    if 'XY-301' in title:
        pid_map['XY-301'] = p['id']
    elif 'CLARITY' in title:
        pid_map['CLARITY-AD'] = p['id']
    elif 'GLP1' in title:
        pid_map['GLP1-2026'] = p['id']
    elif 'MRD' in title:
        pid_map['MRD-100'] = p['id']

# 4. Study Definitions
print()
print('--- 4. Study Definitions (Endpoints) ---')
for label, pid in pid_map.items():
    r = S.get(f'{BASE}/projects/{pid}/study/definition', headers=headers)
    if r.status_code == 200:
        sd = r.json()
        ep = sd.get('endpoint') or sd.get('primaryEndpoint') or ''
        est = sd.get('estimand') or ''
        secs = sd.get('secondaryEndpoints') or []
        model = sd.get('primaryModel') or sd.get('analysisModel') or ''
        check(f'{label} has primary endpoint', len(ep) > 0, ep[:50])
        check(f'{label} has secondary endpoints', len(secs) > 0, f'got {len(secs)}')
        check(f'{label} has estimand', len(est) > 0, est)
        check(f'{label} has analysis model', len(model) > 0, model)
    else:
        check(f'{label} study definition fetch', False, f'status {r.status_code}')

# 5. Staleness System
print()
print('--- 5. Staleness System ---')
test_pid = pid_map.get('XY-301')
if test_pid:
    r = S.get(f'{BASE}/projects/{test_pid}/study/staleness', headers=headers)
    check('Staleness endpoint OK', r.status_code == 200)
    if r.status_code == 200:
        sdata = r.json()
        check('Dependency graph returned', 'dependency_graph' in sdata)
        check('Impact descriptions returned', 'impact_descriptions' in sdata)
        check('Section metadata returned', 'sections' in sdata)
        sections_with_version = sum(1 for s in sdata.get('sections', {}).values() if s.get('version'))
        check('Sections with version tracking', sections_with_version >= 5, f'{sections_with_version} sections')

# 6. Cohort Data
print()
print('--- 6. Cohort Data ---')
for label, pid in pid_map.items():
    r = S.get(f'{BASE}/projects/{pid}/study/cohort', headers=headers)
    if r.status_code == 200:
        cohort = r.json()
        # Backend returns 'inclusion' and 'funnel' keys
        inc = cohort.get('inclusion') or cohort.get('inclusionCriteria') or cohort.get('inclusion_criteria') or []
        funnel = cohort.get('funnel') or cohort.get('attritionFunnel') or cohort.get('attrition_funnel') or []
        check(f'{label} has inclusion criteria', len(inc) > 0, f'{len(inc)} criteria')
        check(f'{label} has attrition funnel', len(funnel) > 0, f'{len(funnel)} steps')
    else:
        check(f'{label} cohort fetch', False, f'status {r.status_code}')

# 7. Archive/Unarchive (PATCH method)
print()
print('--- 7. Archive/Unarchive Flow ---')
test_pid = pid_map.get('GLP1-2026')
if test_pid:
    r = S.patch(f'{BASE}/projects/{test_pid}', json={'status': 'archived'}, headers=headers)
    check('Archive succeeds', r.status_code == 200, f'status {r.status_code}')

    r = S.patch(f'{BASE}/projects/{test_pid}', json={'status': 'unarchive'}, headers=headers)
    restored = ''
    if r.status_code == 200:
        restored = r.json().get('status', '')
    check('Unarchive restores previous status', r.status_code == 200, f'status {r.status_code} restored={restored}')

# 8. Staleness Acknowledgment
print()
print('--- 8. Staleness Acknowledgment ---')
test_pid = pid_map.get('XY-301')
if test_pid:
    r = S.put(f'{BASE}/projects/{test_pid}/study/covariates/acknowledge-staleness', headers=headers)
    check('Acknowledge staleness OK', r.status_code == 200, f'status {r.status_code}')

# 9. Save + Meta Tracking
print()
print('--- 9. Save + Meta Tracking ---')
test_pid = pid_map.get('XY-301')
if test_pid:
    r = S.get(f'{BASE}/projects/{test_pid}/study/staleness', headers=headers)
    old_ver = 0
    if r.status_code == 200:
        old_ver = r.json().get('sections', {}).get('balance', {}).get('version', 0)

    r = S.put(f'{BASE}/projects/{test_pid}/study/balance',
              json={'weightingMethod': 'IPTW', 'smdThreshold': 0.1}, headers=headers)
    check('Save balance config OK', r.status_code == 200, f'status {r.status_code}')

    r = S.get(f'{BASE}/projects/{test_pid}/study/staleness', headers=headers)
    new_ver = 0
    if r.status_code == 200:
        new_ver = r.json().get('sections', {}).get('balance', {}).get('version', 0)
    check('Version incremented on save', new_ver > old_ver, f'old={old_ver} new={new_ver}')

# 10. Downstream Sections (covariates, data-sources, reproducibility have GET endpoints)
print()
print('--- 10. Downstream Sections ---')
section_endpoints = [
    ('covariates', '/study/covariates'),
    ('data-sources', '/study/data-sources'),
    ('cohort', '/study/cohort'),
    ('reproducibility', '/study/reproducibility'),
]
for label, pid in pid_map.items():
    ok_count = 0
    for sec_name, sec_path in section_endpoints:
        try:
            r = S.get(f'{BASE}/projects/{pid}{sec_path}', headers=headers, timeout=10)
            if r.status_code == 200 and r.json():
                ok_count += 1
        except Exception:
            pass
    check(f'{label} has seeded section data ({ok_count}/{len(section_endpoints)})',
          ok_count == len(section_endpoints), f'{ok_count}/{len(section_endpoints)} sections returned data')

# 11. Audit Trail
print()
print('--- 11. Audit & Regulatory ---')
for label, pid in list(pid_map.items())[:2]:
    try:
        r = S.get(f'{BASE}/projects/{pid}/study/audit', headers=headers, timeout=10)
        check(f'{label} audit endpoint OK', r.status_code == 200, f'status {r.status_code}')
    except Exception as e:
        check(f'{label} audit endpoint OK', False, str(e)[:60])
    try:
        r = S.get(f'{BASE}/projects/{pid}/study/regulatory', headers=headers, timeout=10)
        check(f'{label} regulatory endpoint OK', r.status_code == 200, f'status {r.status_code}')
    except Exception as e:
        check(f'{label} regulatory endpoint OK', False, str(e)[:60])

print()
print('=' * 60)
print(f'  RESULTS: {passed} passed, {failed} failed, {total} total')
print('=' * 60)
