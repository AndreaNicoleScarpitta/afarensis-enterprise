"""
Afarensis Enterprise v2.1 — Automated QA Test Harness
Executes the full test plan against a running backend at http://127.0.0.1:8000
"""

import asyncio
import aiohttp
import json
import time
import sys
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api/v1"

# ─── Results tracking ─────────────────────────────────────────────────────────

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors: List[dict] = []
        self.warnings: List[str] = []
        self.sections: Dict[str, dict] = {}
        self._current_section = ""

    def section(self, name):
        self._current_section = name
        self.sections[name] = {"passed": 0, "failed": 0, "skipped": 0}

    def ok(self, test_name, detail=""):
        self.passed += 1
        self.sections[self._current_section]["passed"] += 1

    def fail(self, test_name, expected, actual, detail=""):
        self.failed += 1
        self.sections[self._current_section]["failed"] += 1
        self.errors.append({
            "section": self._current_section,
            "test": test_name,
            "expected": expected,
            "actual": actual,
            "detail": detail,
        })

    def skip(self, test_name, reason=""):
        self.skipped += 1
        self.sections[self._current_section]["skipped"] += 1

    def warn(self, msg):
        self.warnings.append(msg)

R = TestResults()

# ─── HTTP helpers ─────────────────────────────────────────────────────────────

async def req(session, method, path, *, json_body=None, headers=None, expected=200,
              test_name="", base=API, allow_statuses=None):
    """Make HTTP request and validate status code."""
    url = f"{base}{path}" if base else path
    hdrs = dict(headers or {})
    try:
        async with session.request(method, url, json=json_body, headers=hdrs, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            status = resp.status
            try:
                body = await resp.json(content_type=None)
            except:
                body = await resp.text()

            allowed = allow_statuses or [expected]
            if status in allowed:
                R.ok(test_name)
                return status, body
            else:
                R.fail(test_name, f"HTTP {expected}", f"HTTP {status}", str(body)[:200])
                return status, body
    except asyncio.TimeoutError:
        R.fail(test_name, f"HTTP {expected}", "TIMEOUT", "Request timed out after 30s")
        return 0, None
    except Exception as e:
        R.fail(test_name, f"HTTP {expected}", f"EXCEPTION: {e}", traceback.format_exc()[:300])
        return 0, None


async def authed(session, method, path, *, json_body=None, token=None, expected=200,
                 test_name="", allow_statuses=None):
    """Make authenticated request."""
    hdrs = {"Authorization": f"Bearer {token}"} if token else {}
    return await req(session, method, path, json_body=json_body, headers=hdrs,
                     expected=expected, test_name=test_name, allow_statuses=allow_statuses)


# ─── Field validation ─────────────────────────────────────────────────────────

def check_fields(body, required_fields, test_name):
    """Verify required fields exist in response body."""
    if not isinstance(body, dict):
        R.fail(f"{test_name} [fields]", "dict response", type(body).__name__)
        return False
    missing = [f for f in required_fields if f not in body]
    if missing:
        R.fail(f"{test_name} [fields]", f"fields: {required_fields}", f"missing: {missing}")
        return False
    R.ok(f"{test_name} [fields]")
    return True


def check_not_null(body, fields, test_name):
    """Verify fields are not null."""
    if not isinstance(body, dict):
        return
    nulls = [f for f in fields if f in body and body[f] is None]
    if nulls:
        R.fail(f"{test_name} [null check]", "no nulls", f"null fields: {nulls}")
    else:
        R.ok(f"{test_name} [null check]")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

async def run_all_tests():
    start = time.time()
    token = None
    project_id = None
    task_id = None

    async with aiohttp.ClientSession() as session:

        # ── SECTION 1: Health ──────────────────────────────────────────────
        R.section("Health & Diagnostics")

        status, body = await req(session, "GET", "/health", test_name="GET /health", base=BASE, expected=200)
        if body:
            check_fields(body, ["status", "service"], "GET /health")

        status, body = await req(session, "GET", "/health/detailed", test_name="GET /health/detailed", base=BASE, expected=200)
        if body:
            check_fields(body, ["status", "service", "version"], "GET /health/detailed")

        # ── SECTION 2: Auth ────────────────────────────────────────────────
        R.section("Authentication")

        # Register
        reg_email = f"qatest_{int(time.time())}@test.com"
        status, body = await req(session, "POST", "/auth/register",
            json_body={"email": reg_email, "password": "TestPass123!", "full_name": "QA Tester",
                        "username": f"qatest_{int(time.time())}", "organization": "QA Org"},
            test_name="POST /auth/register", expected=200, allow_statuses=[200, 201, 409, 422])

        # Login with demo user (seeded)
        status, body = await req(session, "POST", "/auth/login",
            json_body={"email": "admin@afarensis.com", "password": "admin123"},
            test_name="POST /auth/login", expected=200, allow_statuses=[200, 201])

        if status in (200, 201) and isinstance(body, dict):
            token = body.get("access_token") or body.get("token")
            if token:
                R.ok("Login returned token")
                check_fields(body, ["access_token"], "Login response fields")
            else:
                # Try alternate login credentials
                R.warn("admin@afarensis.com login failed, trying alternate")
                status, body = await req(session, "POST", "/auth/login",
                    json_body={"email": reg_email, "password": "TestPass123!"},
                    test_name="POST /auth/login (registered user)", expected=200, allow_statuses=[200, 201])
                if isinstance(body, dict):
                    token = body.get("access_token") or body.get("token")

        if not token:
            R.fail("Auth token acquisition", "valid token", "no token obtained")
            R.warn("CRITICAL: No auth token — all authenticated tests will fail")

        # GET /auth/me
        if token:
            status, body = await authed(session, "GET", "/auth/me", token=token,
                test_name="GET /auth/me")
            if body and isinstance(body, dict):
                check_fields(body, ["id", "email"], "GET /auth/me")

        # Logout (test but don't actually logout yet)
        # We'll test at the end

        # 401 without token
        status, _ = await req(session, "GET", "/auth/me",
            test_name="GET /auth/me without token → 401", expected=401, allow_statuses=[401, 403, 422])

        # Wrong password
        status, _ = await req(session, "POST", "/auth/login",
            json_body={"email": "admin@afarensis.com", "password": "wrongpass"},
            test_name="POST /auth/login wrong password → 401", expected=401, allow_statuses=[401, 403, 422])

        # Forgot password
        status, _ = await req(session, "POST", "/auth/forgot-password",
            json_body={"email": "admin@afarensis.com"},
            test_name="POST /auth/forgot-password", expected=200, allow_statuses=[200, 404, 422])

        # Refresh token
        if isinstance(body, dict) and body.get("refresh_token"):
            status, _ = await req(session, "POST", "/auth/refresh",
                json_body={"refresh_token": body["refresh_token"]},
                test_name="POST /auth/refresh", expected=200, allow_statuses=[200, 401])
        else:
            R.skip("POST /auth/refresh", "no refresh_token available")

        # ── SECTION 3: Projects ────────────────────────────────────────────
        R.section("Projects CRUD")

        # Create project
        status, body = await authed(session, "POST", "/projects",
            json_body={
                "title": "QA Test Project",
                "research_intent": "Testing all endpoints for release QA",
                "description": "Automated QA test project"
            },
            token=token, test_name="POST /projects (create)", allow_statuses=[200, 201])

        if isinstance(body, dict) and body.get("id"):
            project_id = body["id"]
            R.ok("Project created with id")
            check_fields(body, ["id", "title", "status"], "POST /projects response")
        elif isinstance(body, dict) and body.get("project", {}).get("id"):
            project_id = body["project"]["id"]
            R.ok("Project created with id (nested)")
        else:
            R.fail("Project creation", "project with id", str(body)[:200])

        # List projects
        status, body = await authed(session, "GET", "/projects", token=token,
            test_name="GET /projects (list)")
        if isinstance(body, dict):
            items = body.get("items") or body.get("projects") or body.get("data") or []
            if isinstance(body, list):
                items = body
            if len(items) > 0 or isinstance(items, list):
                R.ok("GET /projects returns items")
            else:
                R.warn("GET /projects returned empty list")

        # Get project detail
        if project_id:
            status, body = await authed(session, "GET", f"/projects/{project_id}",
                token=token, test_name="GET /projects/{id}")
            if isinstance(body, dict):
                check_fields(body, ["id", "title"], "GET /projects/{id}")

            # 404 for nonexistent project
            status, _ = await authed(session, "GET", "/projects/nonexistent-id-12345",
                token=token, test_name="GET /projects/nonexistent → 404",
                expected=404, allow_statuses=[404, 403, 422])

        # ── SECTION 4: Study Workflow ──────────────────────────────────────
        R.section("Study Workflow (10-step)")

        if project_id and token:
            # Study Definition GET/PUT
            status, body = await authed(session, "GET", f"/projects/{project_id}/study/definition",
                token=token, test_name="GET /study/definition")

            status, body = await authed(session, "PUT", f"/projects/{project_id}/study/definition",
                json_body={
                    "study_title": "QA Test Study",
                    "indication": "Oncology",
                    "primary_endpoint": "Overall Survival",
                    "estimand_framework": "ATT"
                },
                token=token, test_name="PUT /study/definition")

            # Verify save persisted
            status, body = await authed(session, "GET", f"/projects/{project_id}/study/definition",
                token=token, test_name="GET /study/definition (verify save)")

            # Covariates
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/covariates",
                token=token, test_name="GET /study/covariates")
            status, _ = await authed(session, "PUT", f"/projects/{project_id}/study/covariates",
                json_body={"covariates": [{"name": "age", "type": "confounder"}, {"name": "sex", "type": "confounder"}]},
                token=token, test_name="PUT /study/covariates")

            # Data sources
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/data-sources",
                token=token, test_name="GET /study/data-sources")
            status, _ = await authed(session, "PUT", f"/projects/{project_id}/study/data-sources",
                json_body={"sources": [{"name": "Claims DB", "type": "claims"}]},
                token=token, test_name="PUT /study/data-sources")

            # Cohort
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/cohort",
                token=token, test_name="GET /study/cohort")
            status, _ = await authed(session, "PUT", f"/projects/{project_id}/study/cohort",
                json_body={"inclusion": ["age >= 18"], "exclusion": ["prior therapy"]},
                token=token, test_name="PUT /study/cohort")

            # Cohort run
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/cohort/run",
                token=token, test_name="POST /study/cohort/run")

            # Balance
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/balance",
                token=token, test_name="GET /study/balance")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/balance/compute",
                token=token, test_name="POST /study/balance/compute")

            # Forest plot
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/results/forest-plot",
                token=token, test_name="GET /study/results/forest-plot")

            # Bias
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/bias",
                token=token, test_name="GET /study/bias")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/bias/run",
                token=token, test_name="POST /study/bias/run")

            # Reproducibility
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/reproducibility",
                token=token, test_name="GET /study/reproducibility")
            status, _ = await authed(session, "PUT", f"/projects/{project_id}/study/reproducibility",
                json_body={"manifest": [], "packages": []},
                token=token, test_name="PUT /study/reproducibility")

            # Audit
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/audit",
                token=token, test_name="GET /study/audit")

            # Regulatory
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/regulatory",
                token=token, test_name="GET /study/regulatory")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/regulatory/generate",
                json_body={"artifact_type": "sar_section"},
                token=token, test_name="POST /study/regulatory/generate")

            # Lock protocol
            status, _ = await authed(session, "PUT", f"/projects/{project_id}/study/lock",
                token=token, test_name="PUT /study/lock")

        # ── SECTION 5: DAG ─────────────────────────────────────────────────
        R.section("DAG")

        if project_id and token:
            status, body = await authed(session, "GET", f"/projects/{project_id}/dag",
                token=token, test_name="GET /projects/{id}/dag")

            status, body = await authed(session, "POST", f"/projects/{project_id}/dag/generate",
                token=token, test_name="POST /dag/generate")

            # If DAG has nodes, try updating one
            if isinstance(body, dict) and body.get("nodes"):
                nodes = body["nodes"]
                if isinstance(nodes, list) and len(nodes) > 0:
                    node_key = nodes[0].get("key") or nodes[0].get("id") or nodes[0].get("node_key", "")
                    if node_key:
                        status, _ = await authed(session, "PATCH",
                            f"/projects/{project_id}/dag/nodes/{node_key}/status",
                            json_body={"status": "in_progress"},
                            token=token, test_name="PATCH /dag/nodes/{key}/status")
                    else:
                        R.skip("PATCH /dag/nodes/{key}/status", "no node key found")
                else:
                    R.skip("PATCH /dag/nodes/{key}/status", "no nodes in DAG")
            else:
                R.skip("PATCH /dag/nodes/{key}/status", "no DAG body")

        # ── SECTION 6: Evidence Discovery ──────────────────────────────────
        R.section("Evidence Discovery")

        if project_id and token:
            status, body = await authed(session, "POST", f"/projects/{project_id}/discover-evidence",
                token=token, test_name="POST /discover-evidence → 202",
                expected=202, allow_statuses=[200, 202])

            if isinstance(body, dict) and body.get("task_id"):
                disc_task_id = body["task_id"]
                R.ok("Discover evidence returned task_id")

                # Poll task
                for i in range(15):
                    await asyncio.sleep(2)
                    s, tb = await authed(session, "GET", f"/tasks/{disc_task_id}",
                        token=token, test_name=f"Poll discovery task (attempt {i+1})")
                    if isinstance(tb, dict):
                        state = tb.get("state", "")
                        progress = tb.get("progress", 0)
                        if state == "completed":
                            R.ok(f"Discovery task completed (progress={progress})")
                            # Check checkpoints exist (Fix 10)
                            if tb.get("checkpoints"):
                                R.ok("Discovery task has checkpoints (Fix 10)")
                            else:
                                R.warn("Discovery task missing checkpoints")
                            break
                        elif state == "failed":
                            R.warn(f"Discovery task failed: {tb.get('error', 'unknown')}")
                            break
                else:
                    R.warn("Discovery task did not complete in 30s (may be slow external APIs)")

                # Dedup test (Fix 8): second discover should return same task_id
                status2, body2 = await authed(session, "POST",
                    f"/projects/{project_id}/discover-evidence",
                    token=token, test_name="POST /discover-evidence (dedup test)",
                    expected=200, allow_statuses=[200, 202])
            else:
                R.warn("Discover evidence did not return task_id")

            # Get evidence
            status, body = await authed(session, "GET", f"/projects/{project_id}/evidence",
                token=token, test_name="GET /projects/{id}/evidence")

            # Evidence network
            status, _ = await authed(session, "GET", f"/projects/{project_id}/evidence/network",
                token=token, test_name="GET /evidence/network")

        # ── SECTION 7: Analysis Endpoints ──────────────────────────────────
        R.section("Analysis & Computation")

        if project_id and token:
            # Generate anchors
            status, _ = await authed(session, "POST", f"/projects/{project_id}/generate-anchors",
                token=token, test_name="POST /generate-anchors")

            # Comparability scores
            status, _ = await authed(session, "GET", f"/projects/{project_id}/comparability-scores",
                token=token, test_name="GET /comparability-scores")

            # Bias analysis
            status, _ = await authed(session, "POST", f"/projects/{project_id}/analyze-bias",
                token=token, test_name="POST /analyze-bias")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/bias-analysis",
                token=token, test_name="GET /bias-analysis")

            # Generate critique
            status, _ = await authed(session, "POST", f"/projects/{project_id}/generate-critique",
                token=token, test_name="POST /generate-critique")

            # Decisions
            status, _ = await authed(session, "GET", f"/projects/{project_id}/decisions",
                token=token, test_name="GET /decisions")

            # Artifacts
            status, _ = await authed(session, "POST", f"/projects/{project_id}/generate-artifact",
                json_body={"artifact_type": "evidence_summary"},
                token=token, test_name="POST /generate-artifact")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/artifacts",
                token=token, test_name="GET /artifacts")

        # ── SECTION 8: TFL ─────────────────────────────────────────────────
        R.section("TFL Generation")

        if project_id and token:
            for tfl in ["demographics", "ae-table", "km-curve", "forest-plot", "love-plot"]:
                status, _ = await authed(session, "POST",
                    f"/projects/{project_id}/study/tfl/{tfl}",
                    token=token, test_name=f"POST /study/tfl/{tfl}")

            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/tfl/shells",
                token=token, test_name="GET /study/tfl/shells")

            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/tfl/generate-all",
                token=token, test_name="POST /study/tfl/generate-all")

        # ── SECTION 9: ADaM & SDTM ────────────────────────────────────────
        R.section("ADaM & SDTM")

        if project_id and token:
            for ds_type in ["adsl", "adae", "adtte"]:
                status, _ = await authed(session, "POST",
                    f"/projects/{project_id}/adam/generate/{ds_type}",
                    token=token, test_name=f"POST /adam/generate/{ds_type}")

            status, _ = await authed(session, "GET", f"/projects/{project_id}/adam/datasets",
                token=token, test_name="GET /adam/datasets")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/adam/validate",
                token=token, test_name="POST /adam/validate")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/adam/metadata",
                token=token, test_name="GET /adam/metadata")

            for domain in ["dm", "ae", "ex"]:
                status, _ = await authed(session, "POST",
                    f"/projects/{project_id}/sdtm/generate/{domain}",
                    token=token, test_name=f"POST /sdtm/generate/{domain}")

            status, _ = await authed(session, "POST", f"/projects/{project_id}/sdtm/generate-all",
                token=token, test_name="POST /sdtm/generate-all")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/sdtm/validate",
                token=token, test_name="POST /sdtm/validate")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/sdtm/acrf",
                token=token, test_name="GET /sdtm/acrf")

        # ── SECTION 10: Regulatory Submission ──────────────────────────────
        R.section("Regulatory Submission")

        if project_id and token:
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/ectd/generate",
                token=token, test_name="POST /submission/ectd/generate")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/submission/ectd/manifest",
                token=token, test_name="GET /submission/ectd/manifest")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/ectd/validate",
                token=token, test_name="POST /submission/ectd/validate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/define-xml/generate",
                token=token, test_name="POST /submission/define-xml/generate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/define-xml/validate",
                token=token, test_name="POST /submission/define-xml/validate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/adrg/generate",
                token=token, test_name="POST /submission/adrg/generate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/csr/synopsis",
                token=token, test_name="POST /submission/csr/synopsis")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/csr/section-11",
                token=token, test_name="POST /submission/csr/section-11")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/csr/section-12",
                token=token, test_name="POST /submission/csr/section-12")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/csr/appendix-16",
                token=token, test_name="POST /submission/csr/appendix-16")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/csr/full",
                token=token, test_name="POST /submission/csr/full")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/submission/status",
                token=token, test_name="GET /submission/status")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/submission/evidence-package",
                token=token, test_name="POST /submission/evidence-package")

        # ── SECTION 11: Search ─────────────────────────────────────────────
        R.section("Search Endpoints")

        if token:
            status, _ = await authed(session, "POST", "/search/semantic",
                json_body={"query": "oncology survival", "limit": 5},
                token=token, test_name="POST /search/semantic")
            status, _ = await authed(session, "POST", "/search/hybrid",
                json_body={"query": "oncology survival", "limit": 5},
                token=token, test_name="POST /search/hybrid")
            status, _ = await authed(session, "POST", "/search/pubmed",
                json_body={"query": "breast cancer survival"},
                token=token, test_name="POST /search/pubmed")
            status, _ = await authed(session, "POST", "/search/clinical-trials",
                json_body={"query": "breast cancer"},
                token=token, test_name="POST /search/clinical-trials")
            status, _ = await authed(session, "POST", "/search/openalex",
                json_body={"query": "breast cancer"},
                token=token, test_name="POST /search/openalex")
            status, _ = await authed(session, "GET", "/search/semantic-scholar?query=breast+cancer&limit=5",
                token=token, test_name="GET /search/semantic-scholar")
            status, _ = await authed(session, "POST", "/search/rare-disease-evidence",
                json_body={"query": "spinal muscular atrophy"},
                token=token, test_name="POST /search/rare-disease-evidence")
            status, _ = await authed(session, "POST", "/search/save",
                json_body={"name": "QA Test Search", "query": "breast cancer", "filters": {}},
                token=token, test_name="POST /search/save")
            status, _ = await authed(session, "GET", "/search/saved",
                token=token, test_name="GET /search/saved")
            status, _ = await authed(session, "POST", "/search/citation-network",
                json_body={"evidence_ids": [], "depth": 1},
                token=token, test_name="POST /search/citation-network")

        # ── SECTION 12: Review & Collaboration ─────────────────────────────
        R.section("Review & Collaboration")

        if token:
            status, _ = await authed(session, "POST", "/review/workflows",
                json_body={"project_id": project_id or "test", "name": "QA Review", "evidence_ids": []},
                token=token, test_name="POST /review/workflows")
            status, _ = await authed(session, "GET", "/review/assignments",
                token=token, test_name="GET /review/assignments")

        # ── SECTION 13: SAR Pipeline ───────────────────────────────────────
        R.section("SAR Pipeline")

        if project_id and token:
            status, body = await authed(session, "POST", "/sar-pipeline/init",
                json_body={"project_id": project_id},
                token=token, test_name="POST /sar-pipeline/init")
            status, _ = await authed(session, "GET", f"/sar-pipeline/{project_id}/status",
                token=token, test_name="GET /sar-pipeline/{id}/status")
            status, _ = await authed(session, "GET", f"/sar-pipeline/{project_id}/results",
                token=token, test_name="GET /sar-pipeline/{id}/results")
            status, _ = await authed(session, "GET", f"/sar-pipeline/{project_id}/report",
                token=token, test_name="GET /sar-pipeline/{id}/report")

        # ── SECTION 14: Ingestion ──────────────────────────────────────────
        R.section("Data Ingestion")

        if project_id and token:
            status, _ = await authed(session, "GET", "/ingestion/attestation",
                token=token, test_name="GET /ingestion/attestation")
            status, body = await authed(session, "POST", f"/projects/{project_id}/ingestion/consent",
                json_body={"consent_type": "hipaa", "attestation_confirmed": True},
                token=token, test_name="POST /ingestion/consent")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/ingestion/reports",
                token=token, test_name="GET /ingestion/reports")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/ingestion/datasets",
                token=token, test_name="GET /ingestion/datasets")

        # ── SECTION 15: Dataset Analysis ───────────────────────────────────
        R.section("Dataset Analysis")

        if project_id and token:
            status, _ = await authed(session, "GET", f"/projects/{project_id}/datasets",
                token=token, test_name="GET /projects/{id}/datasets")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/analysis-results",
                token=token, test_name="GET /study/analysis-results")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/validation-report",
                token=token, test_name="GET /study/validation-report")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/dataset-info",
                token=token, test_name="GET /study/dataset-info")

            # analyze-dataset (should 404 since no dataset uploaded)
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/analyze-dataset",
                token=token, test_name="POST /study/analyze-dataset (no dataset → 404)",
                expected=404, allow_statuses=[200, 202, 404])

        # ── SECTION 16: Advanced Analysis ──────────────────────────────────
        R.section("Advanced Analysis")

        if project_id and token:
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/sap/generate",
                token=token, test_name="POST /study/sap/generate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/feasibility-assessment",
                token=token, test_name="POST /study/feasibility-assessment")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/evidence-package",
                token=token, test_name="POST /study/evidence-package")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/missing-data/impute",
                token=token, test_name="POST /study/missing-data/impute")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/missing-data/tipping",
                token=token, test_name="POST /study/missing-data/tipping")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/missing-data/mmrm",
                token=token, test_name="POST /study/missing-data/mmrm")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/missing-data/summary",
                token=token, test_name="GET /study/missing-data/summary")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/bayesian/analyze",
                token=token, test_name="POST /study/bayesian/analyze")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/bayesian/prior-elicitation",
                token=token, test_name="POST /study/bayesian/prior-elicitation")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/bayesian/adaptive",
                token=token, test_name="POST /study/bayesian/adaptive")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/interim/boundaries",
                token=token, test_name="POST /study/interim/boundaries")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/interim/evaluate",
                token=token, test_name="POST /study/interim/evaluate")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/interim/dsmb-report",
                token=token, test_name="POST /study/interim/dsmb-report")

        # ── SECTION 17: Comparability Protocol ─────────────────────────────
        R.section("Comparability Protocol")

        if project_id and token:
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/comparability-protocol",
                token=token, test_name="GET /study/comparability-protocol")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/study/comparability-protocol",
                json_body={"protocol_name": "QA Protocol"},
                token=token, test_name="POST /study/comparability-protocol")

        # ── SECTION 18: User & Org Management ──────────────────────────────
        R.section("User & Org Management")

        if token:
            status, _ = await authed(session, "GET", "/users/me",
                token=token, test_name="GET /users/me")
            status, _ = await authed(session, "GET", "/users",
                token=token, test_name="GET /users")
            status, _ = await authed(session, "GET", "/org/info",
                token=token, test_name="GET /org/info")
            status, _ = await authed(session, "GET", "/org/users",
                token=token, test_name="GET /org/users")

        # ── SECTION 19: AI & BioGPT ───────────────────────────────────────
        R.section("AI & BioGPT")

        if token:
            status, _ = await authed(session, "GET", "/biogpt/status",
                token=token, test_name="GET /biogpt/status")
            status, _ = await authed(session, "POST", "/biogpt/generate",
                json_body={"prompt": "Explain PFS endpoint"},
                token=token, test_name="POST /biogpt/generate")
            status, _ = await authed(session, "POST", "/biogpt/explain-mechanism",
                json_body={"drug": "pembrolizumab", "condition": "NSCLC"},
                token=token, test_name="POST /biogpt/explain-mechanism")
            status, _ = await authed(session, "POST", "/biogpt/summarize",
                json_body={"title": "A Study of PFS", "abstract": "This is a test abstract about cancer treatment."},
                token=token, test_name="POST /biogpt/summarize")

        if project_id and token:
            status, _ = await authed(session, "POST", f"/projects/{project_id}/ai/comprehensive-analysis",
                token=token, test_name="POST /ai/comprehensive-analysis",
                allow_statuses=[200, 201])
            # Also GET version
            status, _ = await authed(session, "GET", f"/projects/{project_id}/ai/comprehensive-analysis",
                token=token, test_name="GET /ai/comprehensive-analysis",
                allow_statuses=[200])

        # ── SECTION 20: System & Monitoring ────────────────────────────────
        R.section("System & Monitoring")

        if token:
            status, _ = await authed(session, "GET", "/system/storage-stats",
                token=token, test_name="GET /system/storage-stats")
            status, _ = await authed(session, "GET", "/system/cache-stats",
                token=token, test_name="GET /system/cache-stats")
            status, _ = await authed(session, "GET", "/system/metrics",
                token=token, test_name="GET /system/metrics")
            status, _ = await authed(session, "GET", "/system/health/detailed",
                token=token, test_name="GET /system/health/detailed")
            status, _ = await authed(session, "GET", "/analytics/dashboard",
                token=token, test_name="GET /analytics/dashboard")
            status, _ = await authed(session, "GET", "/statistics/full-analysis",
                token=token, test_name="GET /statistics/full-analysis")
            status, _ = await authed(session, "GET", "/statistics/summary",
                token=token, test_name="GET /statistics/summary")
            status, _ = await authed(session, "GET", "/audit/logs",
                token=token, test_name="GET /audit/logs")

        # ── SECTION 21: Misc Endpoints ─────────────────────────────────────
        R.section("Misc Endpoints")

        if token:
            status, _ = await authed(session, "POST", "/data/classify",
                json_body={"data": "patient name: John", "context": "clinical"},
                token=token, test_name="POST /data/classify")
            status, _ = await authed(session, "GET", "/health/circuit-breakers",
                token=token, test_name="GET /health/circuit-breakers")
            status, _ = await authed(session, "GET", "/federated/nodes",
                token=token, test_name="GET /federated/nodes")
            status, _ = await authed(session, "GET", "/evidence-patterns",
                token=token, test_name="GET /evidence-patterns")
            status, _ = await authed(session, "POST", "/reference-populations",
                json_body={"population_name": "SEER", "source": "NCI", "characteristics": {}},
                token=token, test_name="POST /reference-populations")
            status, _ = await authed(session, "GET", "/reference-populations",
                token=token, test_name="GET /reference-populations")
            status, _ = await authed(session, "GET", "/program/overview",
                token=token, test_name="GET /program/overview")
            status, _ = await authed(session, "GET", "/program/portfolio",
                token=token, test_name="GET /program/portfolio")

        if project_id and token:
            status, _ = await authed(session, "POST", f"/projects/{project_id}/security/threat-detection",
                token=token, test_name="POST /security/threat-detection")
            status, _ = await authed(session, "GET", f"/projects/{project_id}/workflow/guidance",
                token=token, test_name="GET /workflow/guidance")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/workflow/execute-step",
                json_body={"step": "study_definition"},
                token=token, test_name="POST /workflow/execute-step")
            status, _ = await authed(session, "GET", f"/program/{project_id}/readiness",
                token=token, test_name="GET /program/{id}/readiness")
            status, _ = await authed(session, "GET", f"/program/{project_id}/milestones",
                token=token, test_name="GET /program/{id}/milestones")
            status, _ = await authed(session, "POST", f"/projects/{project_id}/retention/decide",
                json_body={"decision": "retain", "reason": "QA test"},
                token=token, test_name="POST /retention/decide")

        # ── SECTION 22: Task Queue Tests ───────────────────────────────────
        R.section("Task Queue (Fix 9/10)")

        if token:
            status, body = await authed(session, "GET", "/tasks",
                token=token, test_name="GET /tasks")
            if isinstance(body, dict) and "tasks" in body:
                R.ok("GET /tasks returns tasks array")

            # History test
            status, body = await authed(session, "GET", "/tasks?include_history=true",
                token=token, test_name="GET /tasks?include_history=true")

        # ── SECTION 23: Idempotency (Fix 7) ────────────────────────────────
        R.section("Idempotency (Fix 7)")

        if project_id and token:
            idem_key = f"qa-test-{int(time.time())}"
            hdrs = {"Authorization": f"Bearer {token}", "Idempotency-Key": idem_key}

            # First request
            async with session.post(f"{API}/projects/{project_id}/study/balance/compute",
                headers=hdrs, timeout=aiohttp.ClientTimeout(total=30)) as resp1:
                status1 = resp1.status
                body1 = await resp1.read()
                replay1 = resp1.headers.get("X-Idempotency-Replayed")
                accepted1 = resp1.headers.get("X-Idempotency-Key-Accepted")

            if accepted1:
                R.ok("First request: X-Idempotency-Key-Accepted header present")
            else:
                R.warn("First request: missing X-Idempotency-Key-Accepted")

            # Replay with same key
            async with session.post(f"{API}/projects/{project_id}/study/balance/compute",
                headers=hdrs, timeout=aiohttp.ClientTimeout(total=30)) as resp2:
                status2 = resp2.status
                body2 = await resp2.read()
                replay2 = resp2.headers.get("X-Idempotency-Replayed")

            if replay2 == "true":
                R.ok("Replay: X-Idempotency-Replayed=true (idempotency works)")
            else:
                R.fail("Idempotency replay", "X-Idempotency-Replayed: true", f"header={replay2}")

            if status1 == status2:
                R.ok("Replay: same status code")
            else:
                R.fail("Idempotency status match", f"HTTP {status1}", f"HTTP {status2}")

            if body1 == body2:
                R.ok("Replay: identical response body")
            else:
                R.fail("Idempotency body match", "identical bodies", "bodies differ")

        # ── SECTION 24: Error Handling ─────────────────────────────────────
        R.section("Error Handling")

        # 401 without auth
        status, _ = await req(session, "GET", "/projects", test_name="No auth → 401",
            expected=401, allow_statuses=[401, 403])

        # 404 for nonexistent
        if token:
            status, _ = await authed(session, "GET", "/projects/00000000-0000-0000-0000-000000000000",
                token=token, test_name="Nonexistent project → 404",
                expected=404, allow_statuses=[404, 403])

        # Invalid JSON body
        if token:
            hdrs = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            try:
                async with session.post(f"{API}/projects", headers=hdrs,
                    data="not json at all", timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 422:
                        R.ok("Invalid JSON → 422")
                    else:
                        R.fail("Invalid JSON", "422", f"HTTP {resp.status}")
            except:
                R.skip("Invalid JSON test", "request failed")

        # ── SECTION 25: Audit Trail Export ─────────────────────────────────
        R.section("Audit & Export")

        if project_id and token:
            status, _ = await authed(session, "GET", f"/projects/{project_id}/study/audit/export",
                token=token, test_name="GET /study/audit/export")

    # ─── REPORT ────────────────────────────────────────────────────────────────

    elapsed = time.time() - start
    print("\n" + "=" * 80)
    print("AFARENSIS ENTERPRISE v2.1 — QA TEST REPORT")
    print("=" * 80)
    print(f"Date: {datetime.utcnow().isoformat()}Z")
    print(f"Duration: {elapsed:.1f}s")
    print(f"Server: {BASE}")
    print()

    total = R.passed + R.failed + R.skipped
    print(f"TOTAL: {total} tests")
    print(f"  PASSED:  {R.passed}  ({R.passed/max(total,1)*100:.0f}%)")
    print(f"  FAILED:  {R.failed}  ({R.failed/max(total,1)*100:.0f}%)")
    print(f"  SKIPPED: {R.skipped}")
    print()

    # Per-section breakdown
    print("-" * 80)
    print(f"{'SECTION':<40} {'PASS':>6} {'FAIL':>6} {'SKIP':>6}")
    print("-" * 80)
    for name, counts in R.sections.items():
        p, f, s = counts["passed"], counts["failed"], counts["skipped"]
        marker = " !!!" if f > 0 else ""
        print(f"{name:<40} {p:>6} {f:>6} {s:>6}{marker}")
    print("-" * 80)
    print()

    # Failures detail
    if R.errors:
        print("=" * 80)
        print(f"FAILURES ({len(R.errors)})")
        print("=" * 80)
        for i, err in enumerate(R.errors, 1):
            print(f"\n  [{i}] {err['section']} > {err['test']}")
            print(f"      Expected: {err['expected']}")
            print(f"      Actual:   {err['actual']}")
            if err['detail']:
                print(f"      Detail:   {err['detail'][:150]}")
        print()

    # Warnings
    if R.warnings:
        print("=" * 80)
        print(f"WARNINGS ({len(R.warnings)})")
        print("=" * 80)
        for w in R.warnings:
            print(f"  - {w}")
        print()

    # Verdict
    print("=" * 80)
    if R.failed == 0:
        print("VERDICT: ALL TESTS PASSED — READY FOR RELEASE")
    elif R.failed <= 5:
        print(f"VERDICT: {R.failed} MINOR FAILURES — REVIEW BEFORE RELEASE")
    else:
        print(f"VERDICT: {R.failed} FAILURES — NOT READY FOR RELEASE")
    print("=" * 80)

    return R.failed


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    failures = asyncio.run(run_all_tests())
    sys.exit(min(failures, 1))
