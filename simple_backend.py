#!/usr/bin/env python3
"""
Afarensis Simple Backend
------------------------
Standalone FastAPI app with SQLite auth + real literature API proxies.
No PostgreSQL, no Redis, no Celery needed — runs immediately.

Run: python simple_backend.py
"""

import os, sqlite3, hashlib, uuid, xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# ── JWT ───────────────────────────────────────────────────────────────────────
try:
    from jose import jwt, JWTError
except ImportError:
    try:
        import jwt as _pyjwt
        class _JWTError(Exception): pass
        class _jose_shim:
            @staticmethod
            def encode(payload, secret, algorithm):
                return _pyjwt.encode(payload, secret, algorithm=algorithm)
            @staticmethod
            def decode(token, secret, algorithms):
                return _pyjwt.decode(token, secret, algorithms=algorithms)
        jwt = _jose_shim()
        JWTError = _JWTError
    except ImportError:
        raise RuntimeError("Install python-jose or PyJWT: pip install python-jose[cryptography]")

JWT_SECRET = os.environ.get("JWT_SECRET", "afarensis-dev-secret-2026-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "afarensis.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def _hash_password(pw: str) -> str:
    return hashlib.sha256(f"afarensis_v1:{pw}".encode()).hexdigest()

def _verify_password(pw: str, hashed: str) -> bool:
    return _hash_password(pw) == hashed

import json as _json

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'analyst',
            hashed_password TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            research_intent TEXT DEFAULT '',
            created_by TEXT,
            evidence_count INTEGER DEFAULT 0,
            processing_config TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS evidence_records (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_id TEXT,
            source_url TEXT,
            title TEXT NOT NULL,
            abstract TEXT,
            authors TEXT,
            journal TEXT,
            publication_year INTEGER,
            structured_data TEXT,
            discovered_at TEXT,
            retrieval_rank INTEGER DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    """)
    conn.commit()
    # Default admin
    existing = conn.execute("SELECT id FROM users WHERE email = 'admin@afarensis.com'").fetchone()
    if not existing:
        now = datetime.utcnow().isoformat() + "Z"
        conn.execute(
            "INSERT INTO users (id,email,full_name,role,hashed_password,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)",
            (str(uuid.uuid4()), "admin@afarensis.com", "Admin User", "admin", _hash_password("admin123"), now, now)
        )
        conn.commit()
    # Seed demo projects if none exist
    proj_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    if proj_count == 0:
        _seed_demo_projects(conn)
    conn.close()


def _seed_demo_projects(conn):
    """Seed 3 demo projects with realistic clinical study data."""
    now = datetime.utcnow().isoformat() + "Z"
    p1_id = str(uuid.uuid4())
    p2_id = str(uuid.uuid4())
    p3_id = str(uuid.uuid4())

    # --- Processing configs with analysis results ---
    xy301_config = _json.dumps({
        "analysis_results": {
            "cox_ph": {"hazard_ratio": 0.38, "ci_lower": 0.22, "ci_upper": 0.65, "p_value": 0.0004, "concordance": 0.74,
                "covariates": {"age_at_baseline": {"hr": 1.02, "p": 0.45}, "sex_male": {"hr": 0.91, "p": 0.62},
                    "baseline_motor_language_score": {"hr": 0.78, "p": 0.003}, "genotype_severity": {"hr": 1.34, "p": 0.018}}},
            "propensity_score": {"method": "IPW-ATT", "ate": -1.53, "ate_ci_lower": -2.10, "ate_ci_upper": -0.96,
                "att": -1.67, "att_ci_lower": -2.28, "att_ci_upper": -1.06, "balance_achieved": True, "max_smd_after": 0.07},
            "kaplan_meier": {"treatment_survival_48w": 0.92, "control_survival_48w": 0.45, "log_rank_p": 0.0001,
                "time_points": [0, 12, 24, 36, 48, 60, 72, 84, 96],
                "treatment_survival": [1.0, 0.99, 0.97, 0.95, 0.92, 0.89, 0.86, 0.83, 0.80],
                "control_survival": [1.0, 0.92, 0.82, 0.68, 0.45, 0.33, 0.22, 0.15, 0.10]},
            "e_value": {"point_estimate": 4.68, "ci_bound": 2.41},
            "forest_plot": {"overall": {"hr": 0.38, "ci_lower": 0.22, "ci_upper": 0.65},
                "subgroups": [
                    {"label": "Age 2-5y", "hr": 0.32, "ci_lower": 0.14, "ci_upper": 0.73, "n": 14},
                    {"label": "Age 6-10y", "hr": 0.41, "ci_lower": 0.18, "ci_upper": 0.92, "n": 8},
                    {"label": "Age 11-16y", "hr": 0.52, "ci_lower": 0.15, "ci_upper": 1.78, "n": 8},
                    {"label": "Male", "hr": 0.35, "ci_lower": 0.16, "ci_upper": 0.77, "n": 16},
                    {"label": "Female", "hr": 0.43, "ci_lower": 0.19, "ci_upper": 0.98, "n": 14}]},
        },
        "pre_analysis_validation": {"sample_size_adequate": True, "covariate_overlap": 0.89, "status": "PASSED"},
    })

    clarity_config = _json.dumps({
        "analysis_results": {
            "cox_ph": {"hazard_ratio": 0.69, "ci_lower": 0.58, "ci_upper": 0.82, "p_value": 0.00002, "concordance": 0.68,
                "covariates": {"age": {"hr": 1.01, "p": 0.72}, "apoe4_carrier": {"hr": 1.42, "p": 0.001},
                    "baseline_cdrsb": {"hr": 1.18, "p": 0.0003}}},
            "propensity_score": {"method": "IPTW", "ate": -0.45, "ate_ci_lower": -0.67, "ate_ci_upper": -0.23,
                "balance_achieved": True, "max_smd_after": 0.04},
            "kaplan_meier": {"treatment_survival_76w": 0.78, "control_survival_76w": 0.62, "log_rank_p": 0.00003,
                "time_points": [0, 13, 26, 39, 52, 65, 76],
                "treatment_survival": [1.0, 0.97, 0.93, 0.88, 0.84, 0.80, 0.78],
                "control_survival": [1.0, 0.94, 0.86, 0.78, 0.71, 0.65, 0.62]},
            "e_value": {"point_estimate": 2.24, "ci_bound": 1.72},
            "forest_plot": {"overall": {"hr": 0.69, "ci_lower": 0.58, "ci_upper": 0.82},
                "subgroups": [
                    {"label": "MCI due to AD", "hr": 0.72, "ci_lower": 0.55, "ci_upper": 0.95, "n": 512},
                    {"label": "Mild AD dementia", "hr": 0.65, "ci_lower": 0.50, "ci_upper": 0.85, "n": 347},
                    {"label": "ApoE4 carriers", "hr": 0.61, "ci_lower": 0.48, "ci_upper": 0.78, "n": 498},
                    {"label": "ApoE4 non-carriers", "hr": 0.79, "ci_lower": 0.60, "ci_upper": 1.04, "n": 361}]},
        },
        "pre_analysis_validation": {"sample_size_adequate": True, "covariate_overlap": 0.95, "status": "PASSED"},
    })

    projects = [
        (p1_id, "XY-301: Rare CNS Disorder (Pediatric)", "Phase 3 single-arm study of XY-301 in pediatric patients with rare CNS disorder. External control arm from registry data.", "review",
         "Evaluate efficacy of XY-301 vs external comparator using ATT estimand with propensity score methods.", 10, xy301_config),
        (p2_id, "CLARITY-AD: Alzheimer's Disease Phase 3", "Phase 3 RCT evaluating monoclonal antibody therapy in early Alzheimer's disease. Co-primary: CDR-SB and ADAS-Cog14 at 76 weeks.", "completed",
         "Assess treatment effect using ITT estimand in MCI and mild AD dementia populations.", 6, clarity_config),
        (p3_id, "GLP1-2026: Cardiovascular Outcomes", "Cardiovascular outcomes trial for novel GLP-1 receptor agonist. Primary: time to first MACE.", "draft",
         "Evaluate cardiovascular safety using ATE estimand with time-to-event analysis.", 0, None),
    ]
    for pid, title, desc, status, intent, ev_count, config in projects:
        conn.execute(
            "INSERT INTO projects (id,title,description,status,research_intent,created_by,evidence_count,processing_config,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (pid, title, desc, status, intent, "admin", ev_count, config, now, now))

    # --- Evidence records for XY-301 ---
    xy301_evidence = [
        ("PUBMED", "38291045", "Efficacy of Novel Therapeutic Agent in Pediatric CNS Disorders: A Multicenter Registry Study",
         "Registry study of 156 patients treated with cerliponase alfa over 5 years showed slower motor-language decline (mean diff 1.8, p<0.001).",
         '["Chen S","Martinez R","Yamamoto K"]', "The Lancet Neurology", 2024),
        ("PUBMED", "37854921", "Natural History of Rare Pediatric CNS Conditions: A 10-Year Longitudinal Cohort",
         "Prospective study of 42 patients. Motor-language score declined at 2.1 points/year. Establishes natural history benchmark.",
         '["Anderson P","Schulz A","Nickel M"]', "Annals of Neurology", 2023),
        ("PUBMED", "38102834", "Propensity Score Methods in Rare Disease: A Methodological Review",
         "Systematic review of 87 studies using PS methods in rare disease. ATT with IPW recommended for small-sample settings.",
         '["Liu J","Gagne JJ","Schneeweiss S"]', "Statistics in Medicine", 2024),
        ("PUBMED", "38456712", "Regulatory Considerations for External Control Arms in Rare Pediatric Disease",
         "Analysis of 23 regulatory submissions using ECAs. 74% approval rate when robust natural history data and E-values provided.",
         '["Park E","Thorpe KE","Freidlin B"]', "Clinical Pharmacology & Therapeutics", 2024),
        ("PUBMED", "37921456", "ICV Enzyme Replacement for NCL: Long-term Outcomes",
         "3-year pivotal study: motor-language decline 0.27 pts/48wk treated vs 2.12 pts/48wk natural history (p<0.0001).",
         '["Schulz A","Specchio N","Gissen P"]', "NEJM", 2023),
        ("CLINICALTRIALS", "NCT04312340", "Phase 3 Study of XY-301 in Pediatric Patients with CLN2 Disease (HORIZON)",
         "Single-arm open-label Phase 3 evaluating XY-301 via ICV infusion q2w for 48 weeks vs matched external controls.",
         '["XY Therapeutics"]', "ClinicalTrials.gov", 2024),
        ("PUBMED", "38567234", "Covariate Balance Diagnostics for External Control Arms: A Practical Guide",
         "Framework using SMD, variance ratios, and overlap statistics. Demonstrates prognostic covariate balance is critical for causal inference.",
         '["Stuart EA","DuGoff E","Fontana M"]', "Pharmaceutical Statistics", 2024),
        ("PUBMED", "38123789", "Brain MRI as a Surrogate Endpoint in NCL Trials",
         "In 68 patients, gray matter volume loss predicted motor-language score decline (r=0.78, p<0.001).",
         '["Dyke JP","Sondhi D","Crystal RG"]', "Neuroimage: Clinical", 2024),
        ("PUBMED", "38234567", "Sensitivity Analysis Frameworks for Unmeasured Confounding in Single-Arm Trials",
         "E-value reporting provides accessible metric for regulators. Minimum E-value of 2.0 proposed as threshold.",
         '["VanderWeele TJ","Ding P","Mathur MB"]', "J Clinical Epidemiology", 2024),
        ("PUBMED", "38345678", "Patient-Reported Outcomes in Rare Pediatric Neurological Disorders",
         "CLN2-QoL showed strong internal consistency (alpha=0.89) and test-retest reliability (ICC=0.91).",
         '["Varni JW","Limbers CA","Williams E"]', "Quality of Life Research", 2024),
    ]
    for i, (src_type, src_id, title, abstract, authors, journal, year) in enumerate(xy301_evidence):
        conn.execute(
            "INSERT INTO evidence_records (id,project_id,source_type,source_id,source_url,title,abstract,authors,journal,publication_year,discovered_at,retrieval_rank) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), p1_id, src_type, src_id,
             f"https://pubmed.ncbi.nlm.nih.gov/{src_id}/" if src_type == "PUBMED" else f"https://clinicaltrials.gov/study/{src_id}",
             title, abstract, authors, journal, year, now, i + 1))

    # --- Evidence records for CLARITY-AD ---
    clarity_evidence = [
        ("PUBMED", "38012345", "Lecanemab Phase 3 CLARITY-AD: 18-Month Results",
         "Phase 3 of 1795 participants: lecanemab reduced amyloid and slowed CDR-SB decline by 27% vs placebo (p<0.001). ARIA-E in 12.6%.",
         '["van Dyck CH","Swanson CJ","Aisen P"]', "NEJM", 2023),
        ("PUBMED", "37998765", "Amyloid PET as a Surrogate Endpoint in AD Trials",
         "Centiloid reduction >50 associated with CDR-SB clinical benefit (r=0.72, p=0.008) across 12 anti-amyloid trials.",
         '["Mintun MA","Lo AC","Duggan Evans C"]', "JAMA Neurology", 2024),
        ("CLINICALTRIALS", "NCT03887455", "CLARITY-AD: Safety and Efficacy of Lecanemab in Early AD",
         "Phase 3 confirmatory study. 1795 subjects randomized 1:1. Lecanemab 10mg/kg biweekly IV, 18-month core with OLE.",
         '["Eisai Inc.","Biogen Inc."]', "ClinicalTrials.gov", 2023),
        ("PUBMED", "38445566", "ApoE4 and Differential Response to Anti-Amyloid Immunotherapy",
         "Post-hoc analysis of 4 trials (N=6842): ApoE4 carriers had greater benefit but higher ARIA risk.",
         '["Salloway S","Farlow MR","McDade E"]', "Annals of Neurology", 2024),
        ("PUBMED", "38556677", "ARIA Monitoring and Management: Consensus Recommendations",
         "Baseline MRI required, follow-up at weeks 5, 14, 52. ARIA-E incidence 10-35%. Most events asymptomatic and resolve.",
         '["Cummings J","Salloway S","Sperling R"]', "JAMA", 2024),
        ("PUBMED", "38667788", "Real-World Evidence from Post-Marketing Surveillance of Anti-Amyloid Therapy",
         "12-month RWE from 2341 patients: effectiveness consistent with trial. ARIA-E 10.2% vs 12.6% in trial. Discontinuation 8.4%.",
         '["Rafii MS","Sperling RA","Johnson KA"]', "Alzheimers & Dementia", 2025),
    ]
    for i, (src_type, src_id, title, abstract, authors, journal, year) in enumerate(clarity_evidence):
        conn.execute(
            "INSERT INTO evidence_records (id,project_id,source_type,source_id,source_url,title,abstract,authors,journal,publication_year,discovered_at,retrieval_rank) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), p2_id, src_type, src_id,
             f"https://pubmed.ncbi.nlm.nih.gov/{src_id}/" if src_type == "PUBMED" else f"https://clinicaltrials.gov/study/{src_id}",
             title, abstract, authors, journal, year, now, i + 1))

    conn.commit()
    print(f"   Seeded 3 demo projects with {len(xy301_evidence) + len(clarity_evidence)} evidence records")

# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_token(user_id: str, email: str, full_name: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "email": email, "username": full_name, "role": role,
                "exp": exp, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_db)
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.execute("SELECT * FROM users WHERE id = ?", (payload.get("sub"),)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Afarensis Backend", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "Accept"],
)

# ── Auth endpoints ────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "analyst"

@app.post("/api/v1/auth/login")
async def login(req: LoginRequest, db=Depends(get_db)):
    user = db.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is disabled")
    if not _verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["full_name"], user["role"])
    return {
        "access_token": token,
        "refresh_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"],
                 "full_name": user["full_name"], "role": user["role"]},
    }

@app.get("/api/v1/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "fullName": current_user["full_name"],
        "role": current_user["role"],
        "isActive": bool(current_user["is_active"]),
        "mfaSecret": None,
        "createdAt": current_user["created_at"],
        "updatedAt": current_user["updated_at"],
    }

@app.post("/api/v1/auth/logout")
async def logout():
    return {"message": "Logged out"}

@app.post("/api/v1/auth/refresh")
async def refresh(request: Request):
    body = await request.json()
    token = body.get("refresh_token", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        new_token = create_token(payload["sub"], payload["email"], payload.get("username",""), payload.get("role","analyst"))
        return {"access_token": new_token, "token_type": "bearer"}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/api/v1/auth/register")
async def register(req: RegisterRequest, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.utcnow().isoformat() + "Z"
    uid = str(uuid.uuid4())
    db.execute(
        "INSERT INTO users (id,email,full_name,role,hashed_password,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)",
        (uid, req.email, req.full_name, req.role, _hash_password(req.password), now, now)
    )
    db.connection.commit()
    return {"id": uid, "email": req.email, "full_name": req.full_name, "role": req.role}

# ── PubMed ────────────────────────────────────────────────────────────────────
PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

@app.post("/api/v1/search/pubmed")
async def search_pubmed(body: dict):
    query = body.get("query", "").strip()
    max_results = min(int(body.get("max_results", 20)), 50)
    if not query:
        return []

    async with httpx.AsyncClient(timeout=30) as client:
        # esearch
        s = await client.get(f"{PUBMED_BASE}/esearch.fcgi", params={
            "db": "pubmed", "term": query, "retmax": max_results, "retmode": "json"
        })
        s.raise_for_status()
        id_list = s.json().get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return []

        # efetch
        f = await client.get(f"{PUBMED_BASE}/efetch.fcgi", params={
            "db": "pubmed", "id": ",".join(id_list), "retmode": "xml"
        })
        f.raise_for_status()

    root = ET.fromstring(f.text)
    results = []
    for art in root.findall(".//PubmedArticle"):
        pmid_el = art.find(".//PMID")
        pmid = pmid_el.text if pmid_el is not None else ""
        title_el = art.find(".//ArticleTitle")
        title = (title_el.text or "") if title_el is not None else "Untitled"
        # strip XML tags in title
        title = ET.tostring(title_el, encoding="unicode", method="text") if title_el is not None else "Untitled"

        abstract_parts = art.findall(".//AbstractText")
        abstract = " ".join((p.text or "") for p in abstract_parts if p.text) or None

        authors = []
        for au in art.findall(".//Author"):
            last = au.find("LastName")
            fore = au.find("ForeName")
            if last is not None:
                authors.append(f"{last.text}, {fore.text}" if fore is not None else last.text)

        pub_date = art.find(".//PubDate")
        year = ""
        if pub_date is not None:
            y = pub_date.find("Year")
            year = y.text if y is not None else ""

        doi_el = art.find(".//ELocationID[@EIdType='doi']")
        doi = doi_el.text if doi_el is not None else None

        journal_el = art.find(".//Journal/Title")
        journal = journal_el.text if journal_el is not None else None

        mesh_terms = [m.find("DescriptorName").text for m in art.findall(".//MeshHeading")
                      if m.find("DescriptorName") is not None]

        results.append({
            "id": f"pubmed_{pmid}",
            "pmid": pmid,
            "title": title.strip() or "Untitled",
            "abstract": abstract,
            "authors": authors,
            "publicationDate": year,
            "source": "pubmed",
            "sourceId": pmid,
            "doi": doi,
            "journal": journal,
            "meshTerms": mesh_terms,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "qualityScore": None,
            "status": "pending",
            "aiSummary": None,
            "metadataJson": {"pmid": pmid, "mesh": mesh_terms},
        })
    return results

# ── ClinicalTrials.gov ────────────────────────────────────────────────────────
CT_BASE = "https://clinicaltrials.gov/api/v2"

@app.post("/api/v1/search/clinical-trials")
async def search_clinical_trials(body: dict):
    query = body.get("query", "").strip()
    max_results = min(int(body.get("max_results", 20)), 50)
    if not query:
        return []

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{CT_BASE}/studies", params={
            "query.term": query, "pageSize": max_results, "format": "json",
            "fields": "NCTId,BriefTitle,OfficialTitle,BriefSummary,OverallStatus,"
                      "StartDate,CompletionDate,Condition,InterventionName,StudyType,Phase,EnrollmentCount,EligibilityCriteria"
        })
        r.raise_for_status()

    studies = r.json().get("studies", [])
    results = []
    for s in studies:
        ps = s.get("protocolSection", {})
        id_m = ps.get("identificationModule", {})
        desc_m = ps.get("descriptionModule", {})
        status_m = ps.get("statusModule", {})
        cond_m = ps.get("conditionsModule", {})
        design_m = ps.get("designModule", {})
        elig_m = ps.get("eligibilityModule", {})

        nct_id = id_m.get("nctId", "")
        title = id_m.get("officialTitle") or id_m.get("briefTitle") or "Untitled"
        summary = desc_m.get("briefSummary") or ""
        status = status_m.get("overallStatus", "")
        start = status_m.get("startDateStruct", {}).get("date", "")
        conditions = cond_m.get("conditions", [])
        phases = design_m.get("phaseList", {}).get("phase", [])
        enrollment = design_m.get("enrollmentInfo", {}).get("count")
        eligibility = elig_m.get("eligibilityCriteria")

        results.append({
            "id": f"ct_{nct_id}",
            "nctId": nct_id,
            "title": title,
            "abstract": summary,
            "authors": [],
            "publicationDate": start,
            "source": "clinicaltrials",
            "sourceId": nct_id,
            "doi": None,
            "url": f"https://clinicaltrials.gov/study/{nct_id}",
            "qualityScore": None,
            "status": "pending",
            "aiSummary": None,
            "trialStatus": status,
            "conditions": conditions,
            "phase": phases,
            "enrollment": enrollment,
            "eligibilityCriteria": eligibility,
            "metadataJson": {"nctId": nct_id, "status": status, "conditions": conditions, "phase": phases},
        })
    return results

# ── OpenAlex ──────────────────────────────────────────────────────────────────
OA_BASE = "https://api.openalex.org"

@app.post("/api/v1/search/openalex")
async def search_openalex(body: dict):
    query = body.get("query", "").strip()
    max_results = min(int(body.get("max_results", 20)), 50)
    if not query:
        return {"results": [], "total": 0}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{OA_BASE}/works", params={
            "search": query, "per-page": max_results,
            "select": "id,doi,title,abstract_inverted_index,authorships,publication_date,type,open_access,cited_by_count,primary_location,concepts",
            "mailto": "regulatory@afarensis.com",
        })
        r.raise_for_status()

    data = r.json()
    results = []
    for w in data.get("results", []):
        # Reconstruct abstract from inverted index
        abstract = None
        inv = w.get("abstract_inverted_index")
        if inv:
            try:
                pairs = [(word, pos) for word, positions in inv.items() for pos in positions]
                pairs.sort(key=lambda x: x[1])
                abstract = " ".join(w for w, _ in pairs)
            except Exception:
                pass

        authors = [a.get("author", {}).get("display_name", "") for a in w.get("authorships", [])]
        doi_raw = w.get("doi", "") or ""
        doi = doi_raw.replace("https://doi.org/", "") if doi_raw else None
        oa = w.get("open_access", {})
        pdf_url = oa.get("oa_url") if oa.get("is_oa") else None
        loc = w.get("primary_location", {}) or {}
        source_name = (loc.get("source") or {}).get("display_name")
        concepts = [c.get("display_name") for c in (w.get("concepts") or [])[:6] if c.get("display_name")]

        results.append({
            "id": w.get("id"),
            "title": w.get("title") or "Untitled",
            "abstract": abstract,
            "authors": authors,
            "publicationDate": w.get("publication_date"),
            "source": "openalex",
            "sourceId": w.get("id"),
            "doi": doi,
            "journal": source_name,
            "url": f"https://doi.org/{doi}" if doi else w.get("id"),
            "openAccessUrl": pdf_url,
            "citedByCount": w.get("cited_by_count", 0),
            "type": w.get("type"),
            "concepts": concepts,
            "metadataJson": {"openAlexId": w.get("id"), "concepts": concepts},
        })
    return {"results": results, "total": data.get("meta", {}).get("count", 0)}

# ── Semantic Scholar ──────────────────────────────────────────────────────────
SS_BASE = "https://api.semanticscholar.org/graph/v1"
SS_FIELDS = "paperId,title,abstract,authors,year,publicationDate,openAccessPdf,externalIds,citationCount,influentialCitationCount,publicationTypes,journal,tldr"

@app.get("/api/v1/search/semantic-scholar")
async def search_semantic_scholar(
    query: str,
    limit: int = 20,
    offset: int = 0,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    open_access_only: bool = False,
    min_citation_count: Optional[int] = None,
    fields_of_study: Optional[str] = None,
):
    params = {
        "query": query,
        "limit": min(limit, 100),
        "offset": offset,
        "fields": SS_FIELDS,
    }
    if year_from or year_to:
        params["year"] = f"{year_from or 1900}-{year_to or 2100}"
    if min_citation_count:
        params["minCitationCount"] = min_citation_count
    if fields_of_study:
        params["fieldsOfStudy"] = fields_of_study

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{SS_BASE}/paper/search", params=params,
                              headers={"User-Agent": "Afarensis/2.1 (regulatory@afarensis.com)"})
        if r.status_code == 429:
            raise HTTPException(status_code=429, detail="Semantic Scholar rate limit — please wait and retry")
        if not r.is_success:
            raise HTTPException(status_code=r.status_code, detail="Semantic Scholar API error")

    data = r.json()
    results = []
    for p in data.get("data", []):
        doi = (p.get("externalIds") or {}).get("DOI")
        pmid = (p.get("externalIds") or {}).get("PubMed")
        pdf_url = (p.get("openAccessPdf") or {}).get("url")
        journal = (p.get("journal") or {}).get("name")
        tldr = (p.get("tldr") or {}).get("text")
        results.append({
            "paperId": p.get("paperId"),
            "title": p.get("title") or "Untitled",
            "abstract": p.get("abstract"),
            "tldr": tldr,
            "authors": [a.get("name", "") for a in (p.get("authors") or [])],
            "year": p.get("year"),
            "publicationDate": p.get("publicationDate"),
            "doi": doi,
            "pmid": pmid,
            "citationCount": p.get("citationCount", 0),
            "influentialCitationCount": p.get("influentialCitationCount", 0),
            "openAccessPdfUrl": pdf_url,
            "source": "semanticscholar",
            "journal": journal,
            "url": f"https://www.semanticscholar.org/paper/{p.get('paperId')}",
        })
    return {"results": results, "total": data.get("total", 0), "offset": offset}

@app.get("/api/v1/search/semantic-scholar/paper/{paper_id}")
async def get_semantic_scholar_paper(paper_id: str):
    fields = SS_FIELDS + ",references,citations"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{SS_BASE}/paper/{paper_id}", params={"fields": fields},
                              headers={"User-Agent": "Afarensis/2.1"})
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="Paper not found")
        r.raise_for_status()
    return r.json()

@app.post("/api/v1/search/semantic-scholar/recommendations")
async def get_semantic_scholar_recommendations(body: dict):
    pos_ids = body.get("positive_paper_ids", [])
    limit = min(int(body.get("limit", 10)), 20)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.semanticscholar.org/recommendations/v1/papers/",
            json={"positivePaperIds": pos_ids},
            params={"limit": limit, "fields": "paperId,title,abstract,authors,year,citationCount,externalIds"},
            headers={"User-Agent": "Afarensis/2.1"},
        )
        r.raise_for_status()
    return r.json().get("recommendedPapers", [])

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "afarensis-simple-backend", "version": "2.1.0"}

@app.get("/api/v1/health")
async def api_health():
    return {"status": "healthy"}

# ── Users (admin) ─────────────────────────────────────────────────────────────
@app.get("/api/v1/users")
async def list_users(current_user=Depends(get_current_user), db=Depends(get_db)):
    rows = db.execute("SELECT id,email,full_name,role,is_active,created_at,updated_at FROM users").fetchall()
    return {"items": [dict(r) for r in rows], "total": len(rows)}

# ── Startup ───────────────────────────────────────────────────────────────────
init_db()
print("✅ Afarensis Simple Backend ready")
print("   Auth: admin@afarensis.com / admin123")
print("   APIs: PubMed, ClinicalTrials.gov, OpenAlex, Semantic Scholar")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
