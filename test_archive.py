"""Quick test: archive/unarchive + filtering."""
import requests

BASE = 'http://localhost:8000/api/v1'
S = requests.Session()
r = S.post(f'{BASE}/auth/login', json={'email': 'admin@afarensis.com', 'password': 'admin123'})
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

def get_projects():
    r = S.get(f'{BASE}/projects', headers=headers)
    projects = r.json()
    if isinstance(projects, dict):
        projects = projects.get('projects', projects.get('items', []))
    return projects

# Before
print('BEFORE ARCHIVE:')
for p in get_projects():
    print(f'  {p["title"][:45]:45s} status={p["status"]}')

# Archive GLP1
pid = '4a59ceb1-d523-44f5-8eab-96f804ed8f3e'
r = S.patch(f'{BASE}/projects/{pid}', json={'status': 'archived'}, headers=headers)
print(f'\nArchive: {r.status_code} -> {r.json().get("status")}')

# After archive
print('\nAFTER ARCHIVE:')
for p in get_projects():
    print(f'  {p["title"][:45]:45s} status={p["status"]}')

# Unarchive
r = S.patch(f'{BASE}/projects/{pid}', json={'status': 'unarchive'}, headers=headers)
print(f'\nUnarchive: {r.status_code} -> {r.json().get("status")}')

# After unarchive
print('\nAFTER UNARCHIVE:')
for p in get_projects():
    print(f'  {p["title"][:45]:45s} status={p["status"]}')

# Test filtering
print('\nFILTER TEST:')
for filt in ['review', 'completed', 'draft']:
    r = S.get(f'{BASE}/projects?status={filt}', headers=headers)
    projects = r.json()
    if isinstance(projects, dict):
        projects = projects.get('projects', projects.get('items', []))
    titles = [p['title'][:30] for p in projects]
    print(f'  status={filt}: {len(projects)} projects {titles}')
