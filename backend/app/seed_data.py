"""
Afarensis by Synthetic Ascendancy — Database Seed Data
Populates development database with realistic clinical study data.
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


async def seed_database(session: AsyncSession):
    """Seed database with demo data if empty."""
    # Check if users exist
    try:
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        if count > 0:
            logger.info(f"Database already seeded ({count} users found). Skipping.")
            return
    except Exception as e:
        logger.warning(f"Could not check seed status (tables may not exist yet): {e}")
        return

    logger.info("Seeding database with demo data...")

    import bcrypt

    def hash_pw(pw: str) -> str:
        return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    now = datetime.utcnow().isoformat()

    # ---------- Organizations ----------
    org_sa_id = str(uuid.uuid4())
    org_meridian_id = str(uuid.uuid4())

    orgs = [
        (org_sa_id, "Synthetic Ascendancy", "synthetic-ascendancy", 1),
        (org_meridian_id, "Meridian Therapeutics", "meridian", 1),
    ]

    for oid, name, slug, active in orgs:
        await session.execute(text(
            "INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at) "
            "VALUES (:id, :name, :slug, :active, :now, :now)"
        ), {"id": oid, "name": name, "slug": slug, "active": active, "now": now})

    # ---------- Users ----------
    admin_id = str(uuid.uuid4())
    reviewer1_id = str(uuid.uuid4())
    reviewer2_id = str(uuid.uuid4())
    analyst_id = str(uuid.uuid4())
    viewer_id = str(uuid.uuid4())
    meridian_admin_id = str(uuid.uuid4())
    meridian_analyst_id = str(uuid.uuid4())

    demo_id = str(uuid.uuid4())

    users = [
        (admin_id, "admin@syntheticascendancy.tech", "Platform Administrator", "ADMIN", hash_pw("admin123"), 1, "Synthetic Ascendancy", "Administration", org_sa_id),
        (demo_id, "demo", "Demo User", "ADMIN", hash_pw("password123"), 1, "Synthetic Ascendancy", "Demo", org_sa_id),
        (reviewer1_id, "reviewer1@syntheticascendancy.tech", "Dr. Sarah Chen, Biostatistician", "REVIEWER", hash_pw("reviewer123"), 1, "Synthetic Ascendancy", "Biostatistics", org_sa_id),
        (reviewer2_id, "reviewer2@syntheticascendancy.tech", "Dr. Michael Torres, Epidemiologist", "REVIEWER", hash_pw("reviewer123"), 1, "Synthetic Ascendancy", "Epidemiology", org_sa_id),
        (analyst_id, "analyst@syntheticascendancy.tech", "Emily Park, Research Analyst", "ANALYST", hash_pw("analyst123"), 1, "Synthetic Ascendancy", "Research", org_sa_id),
        (viewer_id, "viewer@syntheticascendancy.tech", "James Liu, Regulatory Affairs", "VIEWER", hash_pw("viewer123"), 1, "Synthetic Ascendancy", "Regulatory Affairs", org_sa_id),
        (meridian_admin_id, "rachel.kim@meridiantx.com", "Dr. Rachel Kim, VP Clinical", "ADMIN", hash_pw("meridian123"), 1, "Meridian Therapeutics", "Clinical Operations", org_meridian_id),
        (meridian_analyst_id, "tom.harris@meridiantx.com", "Tom Harris, Data Analyst", "ANALYST", hash_pw("meridian123"), 1, "Meridian Therapeutics", "Biostatistics", org_meridian_id),
    ]

    for uid, email, full_name, role, hpw, active, org, dept, org_id in users:
        await session.execute(text(
            "INSERT INTO users (id, email, full_name, role, hashed_password, is_active, email_verified, organization, department, organization_id, created_at, updated_at) "
            "VALUES (:id, :email, :full_name, :role, :hpw, :active, 1, :org, :dept, :org_id, :now, :now)"
        ), {"id": uid, "email": email, "full_name": full_name, "role": role,
            "hpw": hpw, "active": active, "org": org, "dept": dept, "org_id": org_id, "now": now})

    # ---------- Projects ----------
    project1_id = str(uuid.uuid4())
    project2_id = str(uuid.uuid4())
    project3_id = str(uuid.uuid4())
    project4_id = str(uuid.uuid4())

    projects = [
        (project1_id, "XY-301: CLN2 Disease (Late-Infantile Batten)", "review",
         "Phase 3 single-arm study of XY-301 (ICV enzyme replacement) in pediatric patients with CLN2 disease "
         "(Neuronal Ceroid Lipofuscinosis Type 2). External control arm constructed from DEM-CHILD natural history "
         "registry (n=74) and Weill Cornell LINCL database (n=66). Primary endpoint: rate of decline on "
         "CLN2 Clinical Rating Scale motor-language (ML) domain score (0-6) at 48 weeks vs matched historical controls. "
         "Regulatory path: FDA Rare Pediatric Disease designation, EMA PRIME eligibility.",
         "Evaluate efficacy and safety of XY-301 vs DEM-CHILD/WCMC external comparator using ATT estimand "
         "with propensity score IPW methods. Sensitivity analyses include E-value for unmeasured confounding "
         "and tipping-point analysis for missing data.",
         admin_id, org_sa_id),
        (project2_id, "CLARITY-AD: Alzheimer's Disease Phase 3", "completed",
         "Phase 3 randomized controlled trial evaluating monoclonal antibody therapy in early Alzheimer's disease. "
         "Co-primary endpoints: CDR-SB and ADAS-Cog14 at 76 weeks.",
         "Assess treatment effect using ITT estimand in mild cognitive impairment and mild AD dementia populations.",
         reviewer1_id, org_sa_id),
        (project3_id, "GLP1-2026: Cardiovascular Outcomes", "draft",
         "Cardiovascular outcomes trial for novel GLP-1 receptor agonist. "
         "Primary endpoint: time to first MACE (cardiovascular death, MI, or stroke).",
         "Evaluate cardiovascular safety and potential benefit using ATE estimand with time-to-event analysis.",
         analyst_id, org_sa_id),
        (project4_id, "MRD-100: Autoimmune Hepatitis Phase 2", "draft",
         "Phase 2 dose-ranging study of MRD-100, a selective JAK1 inhibitor, in moderate-to-severe autoimmune hepatitis. "
         "Primary endpoint: biochemical response (ALT normalization) at 24 weeks.",
         "Evaluate dose-response relationship using Bayesian adaptive design with external control from IAIHG registry data.",
         meridian_admin_id, org_meridian_id),
    ]

    # ---------- Processing configs with realistic analysis results ----------
    import json

    xy301_processing_config = json.dumps({
        "analysis_results": {
            "cox_ph": {
                "hazard_ratio": 0.14,
                "ci_lower": 0.06,
                "ci_upper": 0.33,
                "p_value": 0.0001,
                "concordance": 0.82,
                "note": "HR for unreversed 2-point ML decline or score of 0, calibrated to Schulz et al. Lancet Neurol 2024 extension data",
                "covariates": {
                    "age_at_onset_months": {"hr": 1.03, "p": 0.38, "note": "Median onset 35 months per Nickel et al. 2018"},
                    "sex_male": {"hr": 0.93, "p": 0.58},
                    "baseline_ml_score": {"hr": 0.72, "p": 0.002, "note": "CLN2 ML scale 0-6, motor + language domains"},
                    "genotype_severity": {"hr": 1.41, "p": 0.012, "note": "TPP1 mutation severity classification"},
                    "age_at_first_seizure_months": {"hr": 0.98, "p": 0.22, "note": "Median first seizure 37 months per DEM-CHILD"},
                    "time_symptom_to_diagnosis_months": {"hr": 1.08, "p": 0.045, "note": "Diagnostic delay, median 19 months"},
                },
            },
            "propensity_score": {
                "method": "IPW-ATT",
                "ate": -1.85,
                "ate_ci_lower": -2.40,
                "ate_ci_upper": -1.20,
                "att": -1.42,
                "att_ci_lower": -2.10,
                "att_ci_upper": -0.74,
                "att_note": "ML score decline difference per 48 weeks: 0.46 (treated) vs 1.88 (controls), per Schulz et al. Front Neurol 2025",
                "ess_treatment": 24,
                "ess_control": 21,
                "balance_achieved": True,
                "max_smd_after": 0.06,
                "covariates_balanced": ["age_at_onset", "sex", "baseline_ml_score", "genotype_severity", "age_at_first_seizure", "time_to_diagnosis"],
            },
            "kaplan_meier": {
                "endpoint": "Time to unreversed 2-point ML decline or score of 0",
                "treatment_median_weeks": None,
                "control_median_weeks": 49.3,
                "control_median_note": "Median time to 2-point decline 345 days (49.3 weeks) in untreated per Schulz NEJM 2018",
                "treatment_survival_48w": 0.92,
                "control_survival_48w": 0.38,
                "log_rank_p": 0.0001,
                "time_points": [0, 12, 24, 36, 48, 60, 72, 84, 96],
                "treatment_survival": [1.0, 0.99, 0.97, 0.95, 0.92, 0.89, 0.87, 0.84, 0.82],
                "control_survival": [1.0, 0.88, 0.72, 0.55, 0.38, 0.25, 0.16, 0.10, 0.06],
                "treatment_decline_rate_per_48w": 0.27,
                "control_decline_rate_per_48w": 2.12,
            },
            "e_value": {
                "point_estimate": 13.72,
                "ci_bound": 5.53,
                "interpretation": "An unmeasured confounder would need to be associated with both treatment assignment and ML score decline by a risk ratio of at least 13.72 to explain away the observed HR of 0.14. The CI bound E-value of 5.53 substantially exceeds the recommended threshold of 2.0 (VanderWeele & Ding, Ann Intern Med 2017, PMID 28693043).",
            },
            "forest_plot": {
                "overall": {"hr": 0.14, "ci_lower": 0.06, "ci_upper": 0.33},
                "subgroups": [
                    {"label": "Age 2-5y (pre-school)", "hr": 0.10, "ci_lower": 0.03, "ci_upper": 0.34, "n": 14},
                    {"label": "Age 6-10y", "hr": 0.18, "ci_lower": 0.05, "ci_upper": 0.62, "n": 8},
                    {"label": "Age 11-16y", "hr": 0.28, "ci_lower": 0.06, "ci_upper": 1.32, "n": 5},
                    {"label": "Male", "hr": 0.12, "ci_lower": 0.04, "ci_upper": 0.38, "n": 13},
                    {"label": "Female", "hr": 0.17, "ci_lower": 0.05, "ci_upper": 0.56, "n": 14},
                    {"label": "Baseline ML >= 4", "hr": 0.08, "ci_lower": 0.02, "ci_upper": 0.30, "n": 16},
                    {"label": "Baseline ML 3", "hr": 0.24, "ci_lower": 0.07, "ci_upper": 0.82, "n": 11},
                    {"label": "Severe TPP1 genotype", "hr": 0.11, "ci_lower": 0.03, "ci_upper": 0.42, "n": 10},
                    {"label": "Moderate TPP1 genotype", "hr": 0.19, "ci_lower": 0.06, "ci_upper": 0.58, "n": 17},
                ],
            },
        },
        "pre_analysis_validation": {
            "sample_size_adequate": True,
            "treatment_n": 24,
            "external_control_n": 42,
            "control_source": "DEM-CHILD Registry (n=74 total, 42 matched) + WCMC Database (n=66)",
            "covariate_overlap": 0.91,
            "positivity_violations": 0,
            "missing_data_pct": 2.8,
            "status": "PASSED",
        },
    })

    clarity_processing_config = json.dumps({
        "analysis_results": {
            "cox_ph": {
                "hazard_ratio": 0.69,
                "ci_lower": 0.58,
                "ci_upper": 0.82,
                "p_value": 0.00002,
                "concordance": 0.68,
                "covariates": {
                    "age": {"hr": 1.01, "p": 0.72},
                    "sex_male": {"hr": 1.05, "p": 0.48},
                    "apoe4_carrier": {"hr": 1.42, "p": 0.001},
                    "baseline_cdrsb": {"hr": 1.18, "p": 0.0003},
                    "baseline_mmse": {"hr": 0.94, "p": 0.02},
                },
            },
            "propensity_score": {
                "method": "IPTW",
                "ate": -0.45,
                "ate_ci_lower": -0.67,
                "ate_ci_upper": -0.23,
                "att": -0.51,
                "att_ci_lower": -0.75,
                "att_ci_upper": -0.27,
                "ess_treatment": 859,
                "ess_control": 785,
                "balance_achieved": True,
                "max_smd_after": 0.04,
                "covariates_balanced": ["age", "sex", "apoe4_carrier", "baseline_cdrsb", "baseline_mmse", "race", "education_years"],
            },
            "kaplan_meier": {
                "treatment_median_weeks": None,
                "control_median_weeks": None,
                "treatment_survival_76w": 0.78,
                "control_survival_76w": 0.62,
                "log_rank_p": 0.00003,
                "time_points": [0, 13, 26, 39, 52, 65, 76],
                "treatment_survival": [1.0, 0.97, 0.93, 0.88, 0.84, 0.80, 0.78],
                "control_survival": [1.0, 0.94, 0.86, 0.78, 0.71, 0.65, 0.62],
            },
            "e_value": {
                "point_estimate": 2.24,
                "ci_bound": 1.72,
                "interpretation": "An unmeasured confounder would need HR associations of at least 2.24 with both treatment and outcome to nullify the observed effect.",
            },
            "forest_plot": {
                "overall": {"hr": 0.69, "ci_lower": 0.58, "ci_upper": 0.82},
                "subgroups": [
                    {"label": "MCI due to AD", "hr": 0.72, "ci_lower": 0.55, "ci_upper": 0.95, "n": 512},
                    {"label": "Mild AD dementia", "hr": 0.65, "ci_lower": 0.50, "ci_upper": 0.85, "n": 347},
                    {"label": "ApoE4 carriers", "hr": 0.61, "ci_lower": 0.48, "ci_upper": 0.78, "n": 498},
                    {"label": "ApoE4 non-carriers", "hr": 0.79, "ci_lower": 0.60, "ci_upper": 1.04, "n": 361},
                    {"label": "Age < 65", "hr": 0.64, "ci_lower": 0.46, "ci_upper": 0.89, "n": 278},
                    {"label": "Age >= 65", "hr": 0.72, "ci_lower": 0.58, "ci_upper": 0.90, "n": 581},
                ],
            },
        },
        "pre_analysis_validation": {
            "sample_size_adequate": True,
            "covariate_overlap": 0.95,
            "positivity_violations": 0,
            "missing_data_pct": 1.8,
            "status": "PASSED",
        },
    })

    project_configs = {
        project1_id: xy301_processing_config,
        project2_id: clarity_processing_config,
    }

    for pid, title, status, desc, intent, created_by, org_id in projects:
        config_val = project_configs.get(pid)
        await session.execute(text(
            "INSERT INTO projects (id, title, status, description, research_intent, created_by, organization_id, processing_config, created_at, updated_at) "
            "VALUES (:id, :title, :status, :desc, :intent, :created_by, :org_id, :config, :now, :now)"
        ), {"id": pid, "title": title, "status": status, "desc": desc,
            "intent": intent, "created_by": created_by, "org_id": org_id,
            "config": config_val, "now": now})

    # ---------- Parsed Specifications (for XY-301) ----------
    spec_id = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO parsed_specifications "
        "(id, project_id, indication, population_definition, primary_endpoint, "
        "secondary_endpoints, inclusion_criteria, exclusion_criteria, follow_up_period, "
        "sample_size, statistical_plan, covariates, assumptions, parsed_at, parsing_model, confidence_score) "
        "VALUES (:id, :pid, :indication, :pop, :primary, :secondary, :incl, :excl, :followup, "
        ":ss, :statplan, :covariates, :assumptions, :now, :model, :conf)"
    ), {
        "id": spec_id, "pid": project1_id,
        "indication": "CLN2 Disease (Neuronal Ceroid Lipofuscinosis Type 2, Late-Infantile Batten Disease)",
        "pop": "Pediatric patients aged 2-16 years with genetically confirmed biallelic TPP1 mutations, baseline CLN2 Clinical Rating Scale motor-language (ML) score >= 3 (scale 0-6, Hamburg scale adapted per Wyrwich et al. 2018)",
        "primary": "Rate of decline in CLN2 Clinical Rating Scale ML score at Week 48 vs matched historical controls from DEM-CHILD registry (Nickel et al. Lancet Child Adolesc Health 2018, PMID 30119717)",
        "secondary": '["Time to unreversed 2-point decline in ML score", "Time to ML score of 0 (complete loss of motor and language function)", "Seizure frequency change from baseline", "Brain MRI volumetric change (cortical gray matter, per Dyke et al. AJNR 2016, PMID 26822727)", "Caregiver-reported QoL (PedsQL)"]',
        "incl": '["Age 2-16 years", "Genetically confirmed biallelic TPP1 mutations (CLN2 disease)", "Baseline ML score >= 3 on CLN2 Clinical Rating Scale", "Surgically implanted ICV access device in place", "Informed consent from parent/guardian (with age-appropriate assent)"]',
        "excl": '["Prior ICV enzyme replacement therapy (cerliponase alfa/Brineura)", "Prior CNS-directed gene therapy", "Concurrent CNS-active investigational therapy", "Active CNS infection or device-related infection within 6 months", "Contraindication to intracerebroventricular delivery", "Severe hepatic impairment (ALT/AST > 5x ULN)"]',
        "followup": "48 weeks (primary analysis), 96 weeks (extension), with biannual MRI assessments",
        "ss": 24, "statplan": "Primary: Rate of ML score decline per 48 weeks in treated vs DEM-CHILD/WCMC external controls, using MMRM with treatment-policy estimand. External control comparison via propensity score IPW-ATT (Stuart EA, Stat Sci 2010, PMID 20871802). Sensitivity: E-value analysis for unmeasured confounding (VanderWeele & Ding, Ann Intern Med 2017, PMID 28693043), tipping-point analysis for MNAR, Rosenbaum bounds.",
        "covariates": '["age_at_symptom_onset", "sex", "baseline_ml_score", "tpp1_genotype_severity", "age_at_first_seizure", "time_from_onset_to_diagnosis", "baseline_brain_mri_volume"]',
        "assumptions": '["Missing data assumed MAR (sensitivity: tipping-point for MNAR)", "Proportional hazards for time-to-event endpoints", "External control population exchangeability after PS adjustment (DEM-CHILD registry contemporaneous patients post-2018)", "No secular trend in supportive care standards within control period"]',
        "now": now, "model": "claude-3-5-sonnet-20241022", "conf": 0.92
    })

    # ---------- Parsed Specifications (for CLARITY-AD) ----------
    spec2_id = str(uuid.uuid4())
    await session.execute(text(
        "INSERT INTO parsed_specifications "
        "(id, project_id, indication, population_definition, primary_endpoint, "
        "secondary_endpoints, inclusion_criteria, exclusion_criteria, follow_up_period, "
        "sample_size, statistical_plan, covariates, assumptions, parsed_at, parsing_model, confidence_score) "
        "VALUES (:id, :pid, :indication, :pop, :primary, :secondary, :incl, :excl, :followup, "
        ":ss, :statplan, :covariates, :assumptions, :now, :model, :conf)"
    ), {
        "id": spec2_id, "pid": project2_id,
        "indication": "Early Alzheimer's Disease (MCI and mild AD dementia)",
        "pop": "Adults aged 50-90 with confirmed amyloid pathology, CDR global 0.5 or 1, MMSE 22-30",
        "primary": "Change from baseline in CDR-SB at 76 weeks (co-primary: ADAS-Cog14 at 76 weeks)",
        "secondary": '["Change in ADCS-MCI-ADL at 76 weeks", "Amyloid PET SUVr change", "Tau PET change in temporal cortex", "Volumetric MRI hippocampal change"]',
        "incl": '["Age 50-90 years", "Confirmed amyloid pathology by PET or CSF", "CDR global 0.5 or 1.0", "MMSE 22-30", "Stable background AD therapy for >= 3 months"]',
        "excl": '["Non-AD dementia", "Significant cerebrovascular disease on MRI", "ARIA on baseline MRI", "Anticoagulant therapy", "Prior anti-amyloid immunotherapy"]',
        "followup": "76 weeks (core), 152 weeks (OLE)",
        "ss": 1795, "statplan": "MMRM with ITT estimand. Pre-specified subgroup analyses by ApoE4 status, CDR stage, and amyloid burden. IPTW sensitivity analyses.",
        "covariates": '["age", "sex", "apoe4_carrier", "baseline_cdrsb", "baseline_mmse", "race", "education_years", "baseline_amyloid_pet"]',
        "assumptions": '["MCAR/MAR for missing data", "Linear decline in CDR-SB", "No differential dropout by treatment arm"]',
        "now": now, "model": "claude-3-5-sonnet-20241022", "conf": 0.95
    })

    # ---------- Evidence Records (10 for XY-301) — Real PMIDs and published CLN2 research ----------
    evidence_records = [
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "29688815",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/29688815/",
            "title": "Study of Intraventricular Cerliponase Alfa for CLN2 Disease",
            "abstract": "Multicenter open-label study of ICV cerliponase alfa 300mg every 2 weeks in 24 children with CLN2 disease. Treated patients showed ML score decline of 0.27 +/- 0.35 points per 48 weeks vs 2.12 +/- 0.98 in 42 historical controls (P<0.001). Median time to 2-point decline not reached in treated patients vs 345 days in controls. Common AEs: convulsions, pyrexia, device-related complications.",
            "authors": '["Schulz A", "Ajayi T", "Specchio N", "de Los Reyes E", "Gissen P", "Ballon D", "Dyke JP", "Cahan H", "Slasor P", "Jacoby D", "Kohlschutter A"]',
            "journal": "New England Journal of Medicine",
            "publication_year": 2018,
            "structured_data": '{"sample_size": 24, "controls": 42, "study_type": "phase_1_2_open_label", "follow_up_weeks": 96, "primary_endpoint": "ML score decline rate per 48 weeks", "primary_result": {"treatment_rate": 0.27, "treatment_sd": 0.35, "control_rate": 2.12, "control_sd": 0.98, "p_value": 0.001, "mean_difference": 1.85}, "population_age_range": "3-16 years", "therapeutic_area": "CLN2_disease", "nct": "NCT01907087"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38101904",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38101904/",
            "title": "Safety and efficacy of cerliponase alfa in children with CLN2 disease: an open-label extension study",
            "abstract": "Open-label extension of the pivotal cerliponase alfa study (mean treatment 272.1 weeks). HR for unreversed 2-point ML decline or score of 0: 0.14 (95% CI 0.06-0.33, P<0.0001) vs historical controls. 17 of 23 patients completed the extension. 9 patients had ICV device-related infections. No deaths, no discontinuations due to AEs.",
            "authors": '["Schulz A", "Specchio N", "de Los Reyes E", "Gissen P", "Nickel M", "Trivisano M", "Aylward SC", "Chakrapani A", "Schwering C", "Wibbeler E", "Westermann LM", "Ballon DJ", "Dyke JP", "Cherukuri A", "Bondade S", "Slasor P", "Cohen Pfeffer J"]',
            "journal": "The Lancet Neurology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 23, "study_type": "open_label_extension", "follow_up_weeks": 300, "primary_endpoint": "HR for unreversed 2-point ML decline or score of 0", "primary_result": {"hazard_ratio": 0.14, "ci_lower": 0.06, "ci_upper": 0.33, "p_value": 0.0001}, "population_age_range": "3-16 years", "therapeutic_area": "CLN2_disease", "nct": "NCT02485899"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "30119717",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/30119717/",
            "title": "Disease characteristics and progression in patients with late-infantile neuronal ceroid lipofuscinosis type 2 (CLN2) disease: an observational cohort study",
            "abstract": "DEM-CHILD (n=74) and Weill Cornell (n=66) international datasets characterizing CLN2 natural history. Median symptom onset 35 months, first seizure 37 months, diagnosis 54 months. Untreated ML score decline rate 1.81 points/year (95% CI 1.50-2.12). Median time from first symptom to death 7.8 years. These data served as the historical control benchmark for cerliponase alfa approval.",
            "authors": '["Nickel M", "Simonati A", "Jacoby D", "Lezius S", "Kilian D", "Van de Graaf B", "Pagovich OE", "Kosofsky B", "Yohay K", "Downs M", "Slasor P", "Ajayi T", "Crystal RG", "Kohlschutter A", "Sondhi D", "Schulz A"]',
            "journal": "The Lancet Child & Adolescent Health",
            "publication_year": 2018,
            "structured_data": '{"sample_size": 140, "dem_child_n": 74, "wcmc_n": 66, "study_type": "prospective_observational", "follow_up_years": 10, "primary_endpoint": "Rate of ML score decline", "primary_result": {"rate_per_year": 1.81, "ci_lower": 1.50, "ci_upper": 2.12}, "median_onset_months": 35, "median_seizure_months": 37, "median_diagnosis_months": 54, "median_symptom_to_death_years": 7.8, "therapeutic_area": "CLN2_disease", "nct": "NCT04613089"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "40162009",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/40162009/",
            "title": "Real-world clinical outcomes of patients with CLN2 disease treated with cerliponase alfa",
            "abstract": "DEM-CHILD real-world data: 24 ERT-treated patients outside clinical trials matched 1:1 with natural history controls. ML decline 0.46 +/- 0.43 vs 1.88 +/- 1.45 points/48 weeks (mean difference 1.42, 95% CI 0.74-2.10, P=0.0003). HR for unreversed 2-point decline: 0.08 (95% CI 0.02-0.28, P<0.0001). Most common AEs: pyrexia (50%), vomiting (33%), nausea (21%). No deaths.",
            "authors": '["Schulz A", "Schwering C", "Wibbeler E", "Westermann LM", "Hagenah L", "Lezius S", "Jha A", "Hunt A", "Slasor P", "Reisewitz P", "Nickel M"]',
            "journal": "Frontiers in Neurology",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 24, "matched_controls": 21, "study_type": "real_world_evidence", "follow_up_weeks": 96, "primary_endpoint": "ML decline rate per 48 weeks", "primary_result": {"treatment_rate": 0.46, "treatment_sd": 0.43, "control_rate": 1.88, "control_sd": 1.45, "mean_difference": 1.42, "ci_lower": 0.74, "ci_upper": 2.10, "p_value": 0.0003}, "hr_2pt_decline": {"hr": 0.08, "ci_lower": 0.02, "ci_upper": 0.28, "p_value": 0.0001}, "therapeutic_area": "CLN2_disease"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "35211079",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/35211079/",
            "title": "Natural History Studies in NCL and Their Expanding Role in Drug Development: Experiences From CLN2 Disease and Relevance for Clinical Trials",
            "abstract": "Review of how DEM-CHILD natural history data from 140 genotype-confirmed CLN2 patients were accepted by EMA and FDA as valid historical controls for cerliponase alfa (Brineura) approval. Discusses regulatory framework for external control arms in ultra-rare diseases, data quality requirements, and lessons for future NCL drug development programs.",
            "authors": '["Nickel M", "Schulz A"]',
            "journal": "Frontiers in Neurology",
            "publication_year": 2022,
            "structured_data": '{"sample_size": 140, "study_type": "regulatory_review", "primary_endpoint": "Regulatory acceptance of natural history controls", "primary_result": {"fda_approved": true, "ema_approved": true, "approval_year_fda": 2017, "approval_year_ema": 2017}, "therapeutic_area": "CLN2_disease"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "CLINICALTRIALS", "source_id": "NCT01907087",
            "source_url": "https://clinicaltrials.gov/study/NCT01907087",
            "title": "A Multicenter, Multinational, Phase 1/2, Open-Label, Dose-Escalation Study to Evaluate the Safety, Tolerability, Pharmacokinetics, and Efficacy of Intracerebroventricular Cerliponase Alfa in Patients With CLN2 Disease",
            "abstract": "Pivotal phase 1/2 dose-escalation study of ICV cerliponase alfa (BMN 190) in children with CLN2 disease. 24 patients enrolled across 4 sites in US, UK, Germany, Italy. 300mg every 2 weeks established as therapeutic dose. Primary outcome: rate of decline on CLN2 Clinical Rating Scale vs matched historical controls from DEM-CHILD registry.",
            "authors": '["BioMarin Pharmaceutical"]',
            "journal": "ClinicalTrials.gov",
            "publication_year": 2013,
            "structured_data": '{"sample_size": 24, "study_type": "phase_1_2_open_label", "follow_up_weeks": 96, "primary_endpoint": "CLN2 ML score decline rate vs historical controls", "population_age_range": "3-16 years", "therapeutic_area": "CLN2_disease", "sponsor": "BioMarin Pharmaceutical", "fda_approval": "2017-04-27"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "26822727",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/26822727/",
            "title": "Brain Region-Specific Degeneration with Disease Progression in Late Infantile Neuronal Ceroid Lipofuscinosis (CLN2 Disease)",
            "abstract": "52 high-resolution 3T MRI datasets from 38 CLN2 patients at Weill Cornell Medical College. FreeSurfer cortical thickness analysis demonstrated accelerated global cortical thinning correlating with clinical severity. Identified brain regions affected earliest and most severely. Quantitative MRI may serve as sensitive secondary endpoint detecting treatment effects earlier than clinical scales.",
            "authors": '["Dyke JP", "Sondhi D", "Voss HU", "Yohay K", "Hollmann C", "Mancenido D", "Kaminsky SM", "Kosofsky BE", "Bhatt RR", "Ballon DJ", "Crystal RG"]',
            "journal": "American Journal of Neuroradiology",
            "publication_year": 2016,
            "structured_data": '{"sample_size": 38, "mri_datasets": 52, "study_type": "biomarker_validation", "follow_up_months": 36, "primary_endpoint": "MRI cortical thickness vs clinical severity", "primary_result": {"modality": "3T_FreeSurfer", "correlation_with_severity": "significant"}, "population_age_range": "2-14 years", "therapeutic_area": "CLN2_disease"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "28693043",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/28693043/",
            "title": "Sensitivity Analysis in Observational Research: Introducing the E-Value",
            "abstract": "Introduces the E-value: the minimum strength of association on the risk ratio scale that an unmeasured confounder would need to have with both the treatment and the outcome to fully explain away a specific treatment-outcome association. Proposes E-values be reported for all observational studies claiming causal evidence. Widely adopted by FDA and EMA for external control arm submissions.",
            "authors": '["VanderWeele TJ", "Ding P"]',
            "journal": "Annals of Internal Medicine",
            "publication_year": 2017,
            "structured_data": '{"study_type": "methodological_framework", "primary_endpoint": "E-value methodology", "primary_result": {"recommended_reporting": "E-value for point estimate and CI bound"}, "therapeutic_area": "methodology", "citations": "3000+"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "20871802",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/20871802/",
            "title": "Matching methods for causal inference: A review and a look forward",
            "abstract": "Landmark review of matching methods for causal inference from observational data. Covers propensity score matching, covariate matching, and related methods. Discusses ATT vs ATE estimation, balance diagnostics including standardized mean differences, and practical guidance for applied researchers. One of the most-cited papers in causal inference methodology.",
            "authors": '["Stuart EA"]',
            "journal": "Statistical Science",
            "publication_year": 2010,
            "structured_data": '{"study_type": "methodological_review", "primary_endpoint": "Propensity score and matching methods for causal inference", "primary_result": {"methods_reviewed": ["PS_matching", "covariate_matching", "IPW", "subclassification"], "recommended_diagnostics": ["SMD", "variance_ratios", "overlap_plots"]}, "therapeutic_area": "methodology", "citations": "7000+"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "33268510",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/33268510/",
            "title": "Slowing late infantile Batten disease by direct brain parenchymal administration of a rh.10 adeno-associated virus expressing CLN2",
            "abstract": "Nonrandomized trial of AAVrh.10hCLN2 gene therapy delivered intraparenchymally via 6 burr holes to 12 brain sites in 8 children with mild-to-moderate CLN2 disease vs 12 untreated Weill Cornell natural history controls. Assessed over 18 months. Gene therapy approach complementary to enzyme replacement, with potential for sustained TPP1 expression from a single administration.",
            "authors": '["Sondhi D", "Kaminsky SM", "Hackett NR", "Pagovich OE", "Rosenberg JB", "De BP", "Chen A", "Van de Graaf B", "Mezey JG", "Bhatt RR", "Kosofsky BE", "Bhatt P", "Crystal RG"]',
            "journal": "Science Translational Medicine",
            "publication_year": 2020,
            "structured_data": '{"sample_size": 8, "controls": 12, "study_type": "nonrandomized_gene_therapy", "follow_up_months": 18, "primary_endpoint": "Safety and ML score stabilization", "vector": "AAVrh.10hCLN2", "route": "intraparenchymal_12_sites", "population_age_range": "2-12 years", "therapeutic_area": "CLN2_gene_therapy", "relevance": "Competitor landscape and alternative therapeutic modality"}'
        },
    ]

    ev_ids = []
    for ev in evidence_records:
        ev_ids.append(ev["id"])
        await session.execute(text(
            "INSERT INTO evidence_records "
            "(id, project_id, source_type, source_id, source_url, title, abstract, authors, journal, publication_year, structured_data, discovered_at, retrieval_rank) "
            "VALUES (:id, :project_id, :source_type, :source_id, :source_url, :title, :abstract, :authors, :journal, :pub_year, :structured_data, :now, :rank)"
        ), {
            "id": ev["id"], "project_id": ev["project_id"],
            "source_type": ev["source_type"], "source_id": ev["source_id"],
            "source_url": ev["source_url"], "title": ev["title"],
            "abstract": ev["abstract"], "authors": ev["authors"],
            "journal": ev["journal"], "pub_year": ev["publication_year"],
            "structured_data": ev["structured_data"],
            "now": now, "rank": evidence_records.index(ev) + 1
        })

    # ---------- Evidence Records (6 for CLARITY-AD) ----------
    clarity_evidence = [
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "PUBMED", "source_id": "38012345",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38012345/",
            "title": "Lecanemab Phase 3 CLARITY-AD: 18-Month Efficacy and Safety Results",
            "abstract": "In a phase 3 trial of 1795 participants with early AD, lecanemab reduced brain amyloid and slowed cognitive decline on CDR-SB by 27% vs placebo at 18 months (p<0.001). ARIA-E occurred in 12.6% of treated participants.",
            "authors": '["van Dyck CH", "Swanson CJ", "Aisen P", "Bateman RJ"]',
            "journal": "New England Journal of Medicine",
            "publication_year": 2023,
            "structured_data": '{"sample_size": 1795, "study_type": "phase_3_rct", "follow_up_months": 18, "primary_endpoint": "CDR-SB change", "primary_result": {"treatment_difference": -0.45, "p_value": 0.001, "percent_slowing": 27}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "PUBMED", "source_id": "37998765",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/37998765/",
            "title": "Amyloid PET as a Surrogate Endpoint in Alzheimer's Disease Trials",
            "abstract": "Analysis of 12 anti-amyloid trials demonstrates correlation between amyloid PET reduction and clinical outcomes. Centiloid reduction >50 associated with clinical benefit on CDR-SB (r=0.72, p=0.008).",
            "authors": '["Mintun MA", "Lo AC", "Duggan Evans C", "Wessels AM"]',
            "journal": "JAMA Neurology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 12, "study_type": "meta_analysis", "primary_endpoint": "Amyloid PET correlation with CDR-SB", "primary_result": {"correlation_r": 0.72, "p_value": 0.008}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "CLINICALTRIALS", "source_id": "NCT03887455",
            "source_url": "https://clinicaltrials.gov/study/NCT03887455",
            "title": "A Study to Confirm Safety and Efficacy of Lecanemab in Early Alzheimer's Disease (CLARITY-AD)",
            "abstract": "Phase 3 confirmatory study of lecanemab 10mg/kg biweekly IV in early AD. 1795 subjects randomized 1:1. Core study 18 months with OLE.",
            "authors": '["Eisai Inc.", "Biogen Inc."]',
            "journal": "ClinicalTrials.gov",
            "publication_year": 2023,
            "structured_data": '{"sample_size": 1795, "study_type": "phase_3_rct", "follow_up_months": 76, "primary_endpoint": "CDR-SB"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "PUBMED", "source_id": "38445566",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38445566/",
            "title": "ApoE4 and Differential Treatment Response to Anti-Amyloid Immunotherapy",
            "abstract": "Post-hoc analysis of 4 anti-amyloid trials (N=6,842) showed ApoE4 carriers had greater clinical benefit but higher ARIA risk. Stratified analyses are recommended for regulatory submissions.",
            "authors": '["Salloway S", "Farlow MR", "McDade E", "Clifford DB"]',
            "journal": "Annals of Neurology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 6842, "study_type": "pooled_post_hoc", "primary_endpoint": "ApoE4 interaction with treatment effect", "primary_result": {"apoe4_hr": 0.61, "non_apoe4_hr": 0.79}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "PUBMED", "source_id": "38556677",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38556677/",
            "title": "ARIA Monitoring and Management in Anti-Amyloid Therapy: Consensus Recommendations",
            "abstract": "Expert consensus on ARIA monitoring: baseline MRI required, follow-up scans at weeks 5, 14, 52. ARIA-E incidence ranges 10-35% across programs. Most ARIA events are asymptomatic and resolve spontaneously.",
            "authors": '["Cummings J", "Salloway S", "Sperling R", "Honig LS"]',
            "journal": "JAMA",
            "publication_year": 2024,
            "structured_data": '{"study_type": "consensus_guideline", "primary_endpoint": "ARIA monitoring protocol", "primary_result": {"aria_e_range": "10-35%", "symptomatic_rate": "25%"}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project2_id,
            "source_type": "PUBMED", "source_id": "38667788",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38667788/",
            "title": "Real-World Evidence from Post-Marketing Surveillance of Anti-Amyloid Immunotherapy",
            "abstract": "12-month real-world data from 2,341 patients treated with lecanemab post-approval. Effectiveness on CDR-SB consistent with trial results. ARIA-E rate slightly lower than clinical trial (10.2% vs 12.6%). Treatment discontinuation 8.4%.",
            "authors": '["Rafii MS", "Sperling RA", "Johnson KA", "Donohue MC"]',
            "journal": "Alzheimer's & Dementia",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 2341, "study_type": "post_marketing_rwe", "follow_up_months": 12, "primary_endpoint": "Real-world CDR-SB change", "primary_result": {"aria_e_rate": 0.102, "discontinuation_rate": 0.084}}'
        },
    ]

    for ev in clarity_evidence:
        await session.execute(text(
            "INSERT INTO evidence_records "
            "(id, project_id, source_type, source_id, source_url, title, abstract, authors, journal, publication_year, structured_data, discovered_at, retrieval_rank) "
            "VALUES (:id, :project_id, :source_type, :source_id, :source_url, :title, :abstract, :authors, :journal, :pub_year, :structured_data, :now, :rank)"
        ), {
            "id": ev["id"], "project_id": ev["project_id"],
            "source_type": ev["source_type"], "source_id": ev["source_id"],
            "source_url": ev["source_url"], "title": ev["title"],
            "abstract": ev["abstract"], "authors": ev["authors"],
            "journal": ev["journal"], "pub_year": ev["publication_year"],
            "structured_data": ev["structured_data"],
            "now": now, "rank": clarity_evidence.index(ev) + 1
        })

    # ---------- Evidence Records (8 for GLP1-2026) ----------
    glp1_evidence = [
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "39112233",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/39112233/",
            "title": "Cardiovascular Outcomes with GLP-1 Receptor Agonists: A Systematic Review and Meta-Analysis",
            "abstract": "Meta-analysis of 8 cardiovascular outcomes trials (N=60,080) of GLP-1 RAs. Overall MACE reduction HR 0.88 (95% CI 0.82-0.94). Benefit driven by reduction in atherosclerotic events. Consistent across subgroups including diabetes status and baseline CV risk.",
            "authors": '["Sattar N", "Lee MMY", "Kristensen SL", "Branch KRH"]',
            "journal": "The Lancet",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 60080, "study_type": "meta_analysis", "primary_endpoint": "MACE", "primary_result": {"hr": 0.88, "ci_lower": 0.82, "ci_upper": 0.94}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "38998877",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38998877/",
            "title": "SELECT Trial: Semaglutide and Cardiovascular Outcomes in Adults with Overweight or Obesity",
            "abstract": "In 17,604 adults with established CV disease and overweight/obesity without diabetes, semaglutide 2.4mg weekly reduced MACE by 20% vs placebo (HR 0.80, 95% CI 0.72-0.90, p<0.001) over 39.8 months.",
            "authors": '["Lincoff AM", "Brown-Frandsen K", "Colhoun HM", "Deanfield J"]',
            "journal": "New England Journal of Medicine",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 17604, "study_type": "phase_3_rct", "follow_up_months": 40, "primary_endpoint": "MACE", "primary_result": {"hr": 0.80, "ci_lower": 0.72, "ci_upper": 0.90, "p_value": 0.001}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "CLINICALTRIALS", "source_id": "NCT05812345",
            "source_url": "https://clinicaltrials.gov/study/NCT05812345",
            "title": "Cardiovascular Outcomes Study of Novel GLP-1 Receptor Agonist (GLP1-2026-CVOT)",
            "abstract": "Phase 3 randomized, double-blind, placebo-controlled cardiovascular outcomes trial of GLP1-2026 in adults with established atherosclerotic cardiovascular disease. Target enrollment: 9,200 subjects. Primary endpoint: time to first MACE.",
            "authors": '["Novo Nordisk"]',
            "journal": "ClinicalTrials.gov",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 9200, "study_type": "phase_3_rct", "follow_up_months": 48, "primary_endpoint": "MACE"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "38776655",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38776655/",
            "title": "Time-to-Event Analysis Methods for Cardiovascular Outcome Trials: FDA Guidance and Best Practices",
            "abstract": "Review of statistical methods for CVOTs with external control arms. Recommends Cox PH with IPTW, pre-specified subgroup analyses, and landmark analyses at 6, 12, and 24 months. Addresses challenges of informative censoring and competing risks in CV trials.",
            "authors": '["FDA Center for Drug Evaluation and Research"]',
            "journal": "Statistics in Medicine",
            "publication_year": 2024,
            "structured_data": '{"study_type": "methodological_guidance", "primary_endpoint": "CVOT methodology", "primary_result": {"recommended_method": "Cox PH + IPTW"}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "39223344",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/39223344/",
            "title": "Real-World Cardiovascular Outcomes with GLP-1 RAs: Multi-Database Cohort Study",
            "abstract": "Retrospective cohort study across 4 US claims databases (N=128,450). GLP-1 RA initiators had 15% lower MACE risk vs DPP-4i (HR 0.85, 95% CI 0.79-0.91). Results consistent with clinical trials across age, sex, and baseline CV risk strata.",
            "authors": '["Patorno E", "Goldfine AB", "Schneeweiss S", "Everett BM"]',
            "journal": "Circulation",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 128450, "study_type": "retrospective_cohort", "follow_up_months": 36, "primary_endpoint": "MACE", "primary_result": {"hr": 0.85, "ci_lower": 0.79, "ci_upper": 0.91}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "38554433",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38554433/",
            "title": "Propensity Score Methods for Cardiovascular Comparative Effectiveness Research",
            "abstract": "Methodological review of PS approaches in CV research. IPTW with overlap weights showed best balance in simulations. Recommends Love plots, SMD thresholds <0.1, and E-value reporting for unmeasured confounding.",
            "authors": '["Austin PC", "Stuart EA", "Brookhart MA"]',
            "journal": "European Heart Journal",
            "publication_year": 2024,
            "structured_data": '{"study_type": "methodological_review", "primary_endpoint": "PS method comparison", "primary_result": {"recommended_approach": "IPTW overlap weights"}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "39001122",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/39001122/",
            "title": "GLP-1 RA Mechanisms of Cardiovascular Protection: Beyond Glucose Control",
            "abstract": "Review of pleiotropic cardiovascular mechanisms of GLP-1 RAs including anti-inflammatory effects, endothelial function improvement, and direct myocardial protection. Evidence from preclinical models and mechanistic clinical studies supports glucose-independent cardioprotection.",
            "authors": '["Drucker DJ", "Nauck MA", "Marx N"]',
            "journal": "Nature Reviews Cardiology",
            "publication_year": 2025,
            "structured_data": '{"study_type": "mechanistic_review", "primary_endpoint": "CV mechanisms of GLP-1 RAs"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project3_id,
            "source_type": "PUBMED", "source_id": "38889900",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38889900/",
            "title": "FDA Advisory Committee Review: GLP-1 RA Cardiovascular Indication Expansion",
            "abstract": "Summary of FDA advisory committee review of GLP-1 RA class for expanded cardiovascular indication. Committee voted 14-1 in favor based on trial-level meta-analysis showing consistent MACE reduction. Recommended post-marketing commitments for long-term safety monitoring.",
            "authors": '["FDA Endocrinologic and Metabolic Drugs Advisory Committee"]',
            "journal": "FDA Briefing Document",
            "publication_year": 2025,
            "structured_data": '{"study_type": "regulatory_review", "primary_endpoint": "Advisory committee vote", "primary_result": {"vote_for": 14, "vote_against": 1}}'
        },
    ]

    for ev in glp1_evidence:
        await session.execute(text(
            "INSERT INTO evidence_records "
            "(id, project_id, source_type, source_id, source_url, title, abstract, authors, journal, publication_year, structured_data, discovered_at, retrieval_rank) "
            "VALUES (:id, :project_id, :source_type, :source_id, :source_url, :title, :abstract, :authors, :journal, :pub_year, :structured_data, :now, :rank)"
        ), {
            "id": ev["id"], "project_id": ev["project_id"],
            "source_type": ev["source_type"], "source_id": ev["source_id"],
            "source_url": ev["source_url"], "title": ev["title"],
            "abstract": ev["abstract"], "authors": ev["authors"],
            "journal": ev["journal"], "pub_year": ev["publication_year"],
            "structured_data": ev["structured_data"],
            "now": now, "rank": glp1_evidence.index(ev) + 1
        })

    # ---------- Evidence Records (5 for MRD-100) ----------
    mrd_evidence = [
        {
            "id": str(uuid.uuid4()), "project_id": project4_id,
            "source_type": "PUBMED", "source_id": "38334455",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38334455/",
            "title": "JAK Inhibitors in Autoimmune Hepatitis: A Systematic Review of Preclinical and Early Clinical Evidence",
            "abstract": "Systematic review of JAK inhibition in AIH. Preclinical models show selective JAK1 inhibition reduces hepatic inflammation and fibrosis. Two phase 1 studies (N=45) demonstrated dose-dependent ALT reduction with acceptable safety profile.",
            "authors": '["Mack CL", "Manns MP", "Lohse AW", "Vergani D"]',
            "journal": "Hepatology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 45, "study_type": "systematic_review", "primary_endpoint": "ALT normalization", "primary_result": {"response_rate": 0.62, "dose_dependent": true}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project4_id,
            "source_type": "PUBMED", "source_id": "38445566",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38445577/",
            "title": "Natural History of Autoimmune Hepatitis: Long-Term Outcomes from the IAIHG Registry",
            "abstract": "Registry-based natural history study of 1,892 AIH patients from 27 centers. Biochemical remission with standard therapy achieved in 65% at 12 months. Relapse rate 50% upon dose reduction. 15-year transplant-free survival 80%.",
            "authors": '["Czaja AJ", "Liberal R", "Mieli-Vergani G", "Vergani D"]',
            "journal": "Journal of Hepatology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 1892, "study_type": "registry_cohort", "follow_up_months": 180, "primary_endpoint": "Biochemical remission at 12m", "primary_result": {"remission_rate": 0.65, "relapse_rate": 0.50}}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project4_id,
            "source_type": "CLINICALTRIALS", "source_id": "NCT06234567",
            "source_url": "https://clinicaltrials.gov/study/NCT06234567",
            "title": "Phase 2 Dose-Ranging Study of MRD-100 in Moderate-to-Severe Autoimmune Hepatitis",
            "abstract": "Randomized, double-blind, placebo-controlled phase 2 study of MRD-100 (selective JAK1 inhibitor) at 3 dose levels in adults with moderate-to-severe AIH inadequately controlled on standard immunosuppression. Target enrollment: 120 subjects.",
            "authors": '["Meridian Therapeutics"]',
            "journal": "ClinicalTrials.gov",
            "publication_year": 2025,
            "structured_data": '{"sample_size": 120, "study_type": "phase_2_rct", "follow_up_months": 24, "primary_endpoint": "ALT normalization at 24 weeks"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project4_id,
            "source_type": "PUBMED", "source_id": "39112244",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/39112244/",
            "title": "Bayesian Adaptive Designs in Rare Liver Disease: Opportunities and Regulatory Considerations",
            "abstract": "Review of Bayesian adaptive designs applied to rare liver diseases including AIH, PBC, and PSC. External control arms from registries can augment small trials via Bayesian dynamic borrowing. FDA receptive to adaptive approaches with pre-specified decision rules.",
            "authors": '["Berry SM", "Carlin BP", "Lee JJ", "Muller P"]',
            "journal": "Clinical Pharmacology & Therapeutics",
            "publication_year": 2025,
            "structured_data": '{"study_type": "methodological_review", "primary_endpoint": "Bayesian adaptive design in rare liver disease"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project4_id,
            "source_type": "PUBMED", "source_id": "38667799",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38667799/",
            "title": "External Control Arms in Hepatology: Lessons from PBC and PSC Trials",
            "abstract": "Analysis of 6 hepatology trials using external controls from registries and natural history databases. Key success factors: harmonized endpoint definitions, contemporaneous controls, and transparent sensitivity analyses for unmeasured confounding.",
            "authors": '["Hirschfield GM", "Dyson JK", "Alexander GJ", "Chapman MH"]',
            "journal": "Gut",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 6, "study_type": "case_series_analysis", "primary_endpoint": "ECA success factors in hepatology"}'
        },
    ]

    for ev in mrd_evidence:
        await session.execute(text(
            "INSERT INTO evidence_records "
            "(id, project_id, source_type, source_id, source_url, title, abstract, authors, journal, publication_year, structured_data, discovered_at, retrieval_rank) "
            "VALUES (:id, :project_id, :source_type, :source_id, :source_url, :title, :abstract, :authors, :journal, :pub_year, :structured_data, :now, :rank)"
        ), {
            "id": ev["id"], "project_id": ev["project_id"],
            "source_type": ev["source_type"], "source_id": ev["source_id"],
            "source_url": ev["source_url"], "title": ev["title"],
            "abstract": ev["abstract"], "authors": ev["authors"],
            "journal": ev["journal"], "pub_year": ev["publication_year"],
            "structured_data": ev["structured_data"],
            "now": now, "rank": mrd_evidence.index(ev) + 1
        })

    # ---------- Comparability Scores (for each evidence record) ----------
    import random
    random.seed(42)

    # Comparability scores aligned to real evidence records:
    # 1: Schulz NEJM 2018 (pivotal trial) — highest relevance
    # 2: Schulz Lancet Neurol 2024 (extension) — critical long-term data
    # 3: Nickel Lancet Child 2018 (DEM-CHILD NH) — primary external control source
    # 4: Schulz Front Neurol 2025 (real-world) — confirmatory evidence
    # 5: Nickel & Schulz Front Neurol 2022 (regulatory review) — regulatory precedent
    # 6: NCT01907087 (ClinicalTrials.gov) — trial protocol
    # 7: Dyke AJNR 2016 (MRI biomarker) — secondary endpoint validation
    # 8: VanderWeele Ann Int Med 2017 (E-value) — methodology reference
    # 9: Stuart Stat Sci 2010 (matching methods) — methodology reference
    # 10: Sondhi Sci Transl Med 2020 (gene therapy) — competitor landscape
    comp_scores_data = [
        (0.95, 0.98, 0.93, 0.92, 0.96, 0.98, 0.95, 0.94),
        (0.95, 0.97, 0.93, 0.95, 0.95, 0.97, 0.95, 0.93),
        (0.92, 0.90, 0.95, 0.88, 0.94, 0.96, 0.93, 0.91),
        (0.90, 0.88, 0.91, 0.93, 0.90, 0.94, 0.91, 0.89),
        (0.70, 0.65, 0.75, 0.80, 0.88, 0.92, 0.78, 0.82),
        (0.88, 0.92, 0.85, 0.90, 0.80, 0.90, 0.87, 0.85),
        (0.78, 0.72, 0.80, 0.82, 0.90, 0.92, 0.82, 0.78),
        (0.55, 0.60, 0.88, 0.50, 0.95, 0.95, 0.72, 0.65),
        (0.50, 0.55, 0.90, 0.48, 0.95, 0.95, 0.70, 0.62),
        (0.72, 0.68, 0.78, 0.75, 0.88, 0.90, 0.78, 0.70),
    ]

    comp_score_ids = []
    for i, ev_id in enumerate(ev_ids):
        cs_id = str(uuid.uuid4())
        comp_score_ids.append(cs_id)
        pop_sim, ep_align, cov_cov, temp_align, ev_qual, prov, overall, reg_viab = comp_scores_data[i]
        await session.execute(text(
            "INSERT INTO comparability_scores "
            "(id, evidence_record_id, population_similarity, endpoint_alignment, covariate_coverage, "
            "temporal_alignment, evidence_quality, provenance_score, overall_score, regulatory_viability, "
            "scoring_rationale, scored_at, scoring_model, scoring_version) "
            "VALUES (:id, :ev_id, :pop_sim, :ep_align, :cov_cov, :temp_align, :ev_qual, :prov, :overall, :reg_viab, "
            ":rationale, :now, :model, :version)"
        ), {
            "id": cs_id, "ev_id": ev_id,
            "pop_sim": pop_sim, "ep_align": ep_align, "cov_cov": cov_cov,
            "temp_align": temp_align, "ev_qual": ev_qual, "prov": prov,
            "overall": overall, "reg_viab": reg_viab,
            "rationale": [
                "Pivotal ICV ERT trial (PMID 29688815): Direct CLN2 population match, ML score endpoint, ICV delivery — highest relevance to XY-301 program.",
                "Long-term extension (PMID 38101904): Same population, 5+ year follow-up with HR 0.14 — critical for sustained efficacy demonstration.",
                "DEM-CHILD natural history (PMID 30119717): Primary external control source with 140 genotype-confirmed patients — gold standard comparator.",
                "Real-world cerliponase alfa data (PMID 40162009): Independent DEM-CHILD confirmation of clinical trial findings — regulatory-grade evidence.",
                "Regulatory acceptance review (PMID 35211079): Documents FDA/EMA precedent for NH controls in CLN2 — important regulatory context but not direct evidence.",
                "ClinicalTrials.gov protocol (NCT01907087): Source trial protocol — high protocol relevance but limited population-level scoring.",
                "MRI biomarker study (PMID 26822727): Validates quantitative MRI as secondary endpoint — moderate direct relevance, strong methodological support.",
                "E-value methodology (PMID 28693043): Core sensitivity analysis framework for unmeasured confounding — essential methodology but not disease-specific.",
                "Matching methods review (PMID 20871802): Foundational causal inference reference — essential methodology but not disease-specific.",
                "AAVrh.10 gene therapy (PMID 33268510): Competitor landscape analysis — moderate relevance as alternative modality in same disease.",
            ][i],
            "now": now, "model": "afarensis-scorer-v2", "version": "2.1.0"
        })

    # ---------- Bias Analyses (5 per project — using XY-301 comparability scores) ----------
    # Bias analyses grounded in real FDA regulatory actions:
    # - RGX-121 CRL (Feb 7, 2026): eligibility phenotyping, external control comparability, surrogate endpoint validity
    # - Brineura FDA review (2017): Language domain incomparability, device safety, conservative stats requirement
    # - RGX-111 clinical hold (Jan 2026): AAV vector integration / oncogenesis concern (gene therapy specific)
    bias_data = [
        ("CONFOUNDING", 0.55, 0.50, 0.48,
         "FDA CRL PRECEDENT (RGX-121, Feb 2026): Eligibility criteria may not adequately differentiate disease severity phenotypes. "
         "In the RGX-121 MPS II CRL, FDA questioned whether trial enrollment criteria could reliably distinguish neuronopathic from "
         "attenuated disease. For CLN2, analogous risk exists: the CLN2 Clinical Rating Scale ML score at baseline (>= 3 inclusion criterion) "
         "may not adequately stratify patients by rate of future progression. Rapidly-declining vs slowly-declining CLN2 phenotypes "
         "(driven by specific TPP1 mutation combinations) may respond differently to ICV ERT, and the external control arm may over-represent "
         "one phenotype. The DEM-CHILD registry (PMID 30119717) uses genotype classification that does not map 1:1 to the trial protocol.",
         '["Pre-specify genotype-stratified subgroup analyses by TPP1 mutation severity class", '
         '"Validate that ML score >= 3 criterion selects a homogeneous prognostic population using DEM-CHILD baseline data", '
         '"Sensitivity analysis restricting external controls to patients with matched TPP1 genotype severity", '
         '"Quantitative bias analysis for unmeasured confounding by phenotype misclassification", '
         '"E-value analysis (VanderWeele & Ding, PMID 28693043) — current E-value of 13.72 substantially exceeds 2.0 threshold"]',
         "Harmonize TPP1 genotype severity classification between trial and DEM-CHILD registry. Pre-specify interaction tests for "
         "genotype x treatment effect. Report E-values with CI bounds. This directly addresses the FDA precedent from the RGX-121 CRL."),
        ("SELECTION_BIAS", 0.50, 0.48, 0.45,
         "FDA CRL PRECEDENT (RGX-121, Feb 2026): External natural history control not sufficiently comparable to study population. "
         "FDA rejected the RGX-121 BLA in part because the natural history external control was not adequately matched. For XY-301, "
         "the DEM-CHILD registry (n=74) and WCMC database (n=66) were collected independently across 12+ centers over 2002-2022. "
         "Key comparability gaps: (1) Trial patients required ICV device placement, selecting for surgical candidacy and specialized "
         "center access; (2) Registry patients were assessed retrospectively in some centers vs prospectively in others; "
         "(3) Evolving supportive care standards (anti-epileptics, nutrition, physiotherapy) over the 20-year registry window means "
         "earlier controls may have had worse outcomes independent of ERT. FDA required BioMarin to use conservative statistical "
         "assumptions during the Brineura review specifically because of these external control limitations.",
         '["Restrict external control to contemporary DEM-CHILD patients enrolled after 2015 to minimize temporal confounding", '
         '"Propensity score IPW-ATT with stabilized weights, truncated at 1st/99th percentile", '
         '"Head-to-head comparison of trial-eligible vs ineligible registry patients on baseline covariates", '
         '"Include calendar year of enrollment as PS model covariate", '
         '"Use conservative statistical assumptions per FDA Brineura review precedent (BLA 761052)", '
         '"Sensitivity analysis using only WCMC controls (single-center, more consistent assessment)"]',
         "This is the highest regulatory risk item given the RGX-121 CRL precedent. Document comparability exhaustively with "
         "Love plots, SMD tables, and overlap diagnostics. Pre-specify contemporaneous control restriction as primary analysis."),
        ("MEASUREMENT_BIAS", 0.45, 0.40, 0.42,
         "FDA BRINEURA REVIEW FINDING (BLA 761052, 2017): Language domain ratings were NOT comparable between the cerliponase alfa "
         "clinical trial and the natural history cohort. FDA limited the approved efficacy claim to the Motor domain only, excluding "
         "the Language domain from the composite ML score. This is a direct precedent for XY-301: if the Language domain of the CLN2 "
         "Clinical Rating Scale cannot be shown to be reliably assessed across trial sites and DEM-CHILD registry centers using the "
         "same adapted Wyrwich et al. (2018) scale version, FDA may again restrict the efficacy endpoint to Motor-only. Additionally, "
         "inter-rater reliability was not uniformly assessed across the 12+ DEM-CHILD centers, and the original Steinfeld/Kohlschutter "
         "scoring (PMID 12376936) used in older registry records differs from the adapted version used in clinical trials.",
         '["Demonstrate Language domain comparability between trial and external control using calibration substudy", '
         '"Video-recorded ML assessments scored independently by trial and registry raters to quantify inter-rater reliability", '
         '"Pre-specify Motor-only sensitivity analysis in the SAP as a conservative fallback (per Brineura precedent)", '
         '"Restrict DEM-CHILD controls to centers using the adapted Wyrwich et al. 2018 scale version", '
         '"Report kappa statistics for inter-rater agreement on both Motor and Language domains separately"]',
         "CRITICAL: Must demonstrate Language domain comparability or risk FDA restricting efficacy claim to Motor-only, "
         "as happened with Brineura. Pre-specify both composite ML and Motor-only analyses in the SAP."),
        ("TEMPORAL_BIAS", 0.40, 0.38, 0.35,
         "FDA CRL PRECEDENT (RGX-121, Feb 2026): Surrogate endpoint may not reasonably predict clinical benefit. FDA questioned "
         "whether CSF heparan sulfate D2S6 reduction was reasonably likely to predict neurocognitive benefit in MPS II. For CLN2, "
         "the analogous risk is whether the ML score decline rate (the primary endpoint) is a valid surrogate for long-term functional "
         "outcomes and survival. While the ML score has face validity, its psychometric validation is relatively recent (Wyrwich 2018), "
         "and the correlation between short-term ML score stabilization (48 weeks) and long-term outcomes (survival, QoL, independence) "
         "has not been formally established. MRI volumetric measures (Dyke et al. AJNR 2016, PMID 26822727) correlate with clinical "
         "severity but are not yet validated as surrogate endpoints.",
         '["Formal surrogate endpoint validation: correlate 48-week ML score change with 96-week and long-term functional outcomes", '
         '"Prentice criteria analysis using cerliponase alfa extension data (PMID 38101904) as validation dataset", '
         '"Include MRI volumetric change as pre-specified supportive secondary endpoint (not co-primary)", '
         '"Reference real-world DEM-CHILD confirmation (PMID 40162009) showing ML decline rate predicts 2-point loss and score-of-0 endpoints", '
         '"Document biological plausibility linking TPP1 enzyme activity to neuron preservation to ML score preservation"]',
         "Provide formal surrogate endpoint justification per FDA accelerated approval pathway. Use Brineura extension data "
         "and DEM-CHILD real-world data to demonstrate ML score decline rate predicts meaningful long-term clinical benefit."),
        ("PUBLICATION_BIAS", 0.30, 0.25, 0.20,
         "FDA CLINICAL HOLD PRECEDENT (RGX-111/RGX-121, Jan 2026): AAV vector integration and oncogenesis risk. In January 2026, "
         "FDA placed a clinical hold on RegenXBio's RGX-111 (MPS I) and RGX-121 (MPS II) after a CNS tumor was identified in a child "
         "treated with AAVrh.10-based gene therapy 4 years prior, with confirmed AAV vector genome integration and PLAG1 proto-oncogene "
         "overexpression. While XY-301 is an ICV enzyme replacement (not gene therapy), this precedent establishes heightened FDA scrutiny "
         "of all intracerebroventricular CNS interventions in pediatric populations. Long-term safety monitoring and MRI surveillance "
         "protocols must address this concern proactively, even though the mechanism (recombinant enzyme vs viral vector) is fundamentally different.",
         '["Differentiate XY-301 mechanism (recombinant enzyme, no genomic integration) from AAV gene therapy in regulatory briefing", '
         '"Implement routine brain MRI surveillance at 6, 12, 24, 48, and 96 weeks per Brineura post-marketing protocol", '
         '"Monitor for device-related complications (infection, malfunction) — 9/23 patients had ICV device infections in extension study (PMID 38101904)", '
         '"10-year long-term follow-up commitment matching Brineura post-marketing requirement (FDA BLA 761052)"]',
         "Low direct relevance for ERT, but proactive acknowledgment of the AAV oncogenesis concern demonstrates regulatory awareness. "
         "Emphasize mechanistic differentiation. Commit to long-term MRI surveillance and device safety monitoring."),
    ]

    for i, (bias_type, severity, fragility, reg_risk, desc, strategies, adjust) in enumerate(bias_data):
        ba_id = str(uuid.uuid4())
        cs_id = comp_score_ids[i] if i < len(comp_score_ids) else comp_score_ids[0]
        await session.execute(text(
            "INSERT INTO bias_analyses "
            "(id, comparability_score_id, bias_type, bias_severity, bias_description, "
            "fragility_score, regulatory_risk, mitigation_strategies, adjustment_recommendations, "
            "analyzed_at, analysis_model) "
            "VALUES (:id, :cs_id, :bias_type, :severity, :desc, :fragility, :reg_risk, "
            ":strategies, :adjust, :now, :model)"
        ), {
            "id": ba_id, "cs_id": cs_id, "bias_type": bias_type,
            "severity": severity, "desc": desc, "fragility": fragility,
            "reg_risk": reg_risk, "strategies": strategies, "adjust": adjust,
            "now": now, "model": "afarensis-bias-detector-v2"
        })

    # ---------- Review Decisions (5) ----------
    review_decisions = [
        (ev_ids[0], reviewer1_id, "ACCEPTED", 0.95,
         "Schulz et al. NEJM 2018 (PMID 29688815): Pivotal ICV cerliponase alfa trial establishing ML decline rate of 0.27 vs 2.12 points/48 weeks. "
         "Gold-standard evidence for CLN2 ERT efficacy. Directly applicable to XY-301 external control comparison methodology."),
        (ev_ids[1], reviewer1_id, "ACCEPTED", 0.96,
         "Schulz et al. Lancet Neurol 2024 (PMID 38101904): 5+ year extension data with HR 0.14 for ML decline. "
         "Critical long-term safety and durability data. Strengthens the evidence base for sustained ICV ERT benefit in CLN2."),
        (ev_ids[2], reviewer2_id, "ACCEPTED", 0.93,
         "Nickel et al. Lancet Child Adolesc Health 2018 (PMID 30119717): DEM-CHILD natural history with 140 patients. "
         "This is the primary external control data source. Decline rate of 1.81 pts/year (CI 1.50-2.12) is the benchmark. "
         "FDA and EMA accepted this as valid historical control for Brineura approval."),
        (ev_ids[3], reviewer2_id, "ACCEPTED", 0.88,
         "Schulz et al. Front Neurol 2025 (PMID 40162009): Independent real-world confirmation of cerliponase alfa benefit "
         "outside clinical trial setting. ML decline 0.46 vs 1.88 pts/48w. HR 0.08 for 2-point decline. Strengthens external validity."),
        (ev_ids[4], reviewer1_id, "DEFERRED", 0.65,
         "Nickel & Schulz Front Neurol 2022 (PMID 35211079): Useful regulatory precedent review but primarily narrative. "
         "Defer for further extraction of specific regulatory acceptance criteria and data quality requirements applied by FDA/EMA."),
    ]

    for ev_id, rev_id, decision, confidence, rationale in review_decisions:
        rd_id = str(uuid.uuid4())
        await session.execute(text(
            "INSERT INTO review_decisions "
            "(id, project_id, evidence_record_id, reviewer_id, decision, confidence_level, rationale, decided_at) "
            "VALUES (:id, :pid, :ev_id, :rev_id, :decision, :confidence, :rationale, :now)"
        ), {
            "id": rd_id, "pid": project1_id, "ev_id": ev_id, "rev_id": rev_id,
            "decision": decision, "confidence": confidence, "rationale": rationale, "now": now
        })

    # ---------- Regulatory Artifacts (metadata only) ----------
    artifacts = [
        ("safety_assessment_report", "XY-301 Integrated Safety Summary — ICV ERT in Pediatric CLN2 Disease", "html", "FDA",
         "Pre-BLA integrated safety summary for XY-301 ICV administration in pediatric CLN2 patients. "
         "Includes AE profile benchmarked against cerliponase alfa (Brineura) pivotal data (PMID 29688815). "
         "Covers device-related complications, CNS infections, hypersensitivity reactions, and seizure monitoring."),
        ("evidence_table", "XY-301 External Control Evidence Summary — DEM-CHILD & WCMC Natural History Data", "html", "FDA",
         "Comprehensive evidence table summarizing all included external control sources from DEM-CHILD registry "
         "(PMID 30119717, n=74) and WCMC database (n=66). Includes comparability scores, bias assessments, "
         "propensity score balance diagnostics, and E-value sensitivity analyses per VanderWeele & Ding (PMID 28693043)."),
    ]

    for art_type, title, fmt, agency, context in artifacts:
        art_id = str(uuid.uuid4())
        await session.execute(text(
            "INSERT INTO regulatory_artifacts "
            "(id, project_id, artifact_type, title, format, regulatory_agency, submission_context, "
            "generated_at, generated_by) "
            "VALUES (:id, :pid, :art_type, :title, :fmt, :agency, :context, :now, :gen_by)"
        ), {
            "id": art_id, "pid": project1_id, "art_type": art_type,
            "title": title, "fmt": fmt, "agency": agency, "context": context,
            "now": now, "gen_by": admin_id
        })

    # ---------- Audit Logs (10) ----------
    audit_logs = [
        (None, admin_id, "user_login", "session", None, "Admin user logged in from 192.168.1.100"),
        (project1_id, admin_id, "project_created", "project", project1_id, "Created XY-301 CLN2 disease evidence review project for ICV ERT regulatory submission"),
        (project1_id, analyst_id, "evidence_discovery_started", "evidence", None, "Initiated PubMed and ClinicalTrials.gov search: CLN2 disease, cerliponase alfa, DEM-CHILD, Batten disease enzyme replacement"),
        (project1_id, analyst_id, "evidence_imported", "evidence", ev_ids[0], "Imported 10 evidence records: Schulz NEJM 2018 (PMID 29688815), Nickel Lancet Child 2018 (PMID 30119717), DEM-CHILD registry data, methodology references"),
        (project1_id, reviewer1_id, "review_decision_submitted", "review_decision", None, "ACCEPTED: Schulz et al. NEJM 2018 pivotal cerliponase alfa trial (PMID 29688815) — ML decline 0.27 vs 2.12 pts/48w"),
        (project1_id, reviewer1_id, "review_decision_submitted", "review_decision", None, "ACCEPTED: Schulz et al. Lancet Neurol 2024 extension (PMID 38101904) — HR 0.14 for 2-point ML decline, 5+ year follow-up"),
        (project1_id, reviewer2_id, "review_decision_submitted", "review_decision", None, "DEFERRED: Nickel & Schulz Front Neurol 2022 regulatory review (PMID 35211079) — pending extraction of FDA/EMA acceptance criteria"),
        (project1_id, admin_id, "artifact_generated", "regulatory_artifact", None, "Generated draft Integrated Safety Summary for XY-301 ICV ERT in pediatric CLN2 disease"),
        (project2_id, reviewer1_id, "project_completed", "project", project2_id, "CLARITY-AD project marked as completed — all evidence reviewed, regulatory artifacts generated"),
        (None, admin_id, "system_config_updated", "system", None, "Updated AI model configuration to claude-3-5-sonnet-20241022"),
    ]

    base_time = datetime.utcnow() - timedelta(days=14)
    for i, (pid, uid, action, res_type, res_id, summary) in enumerate(audit_logs):
        log_id = str(uuid.uuid4())
        ts = (base_time + timedelta(days=i, hours=i * 2)).isoformat()
        await session.execute(text(
            "INSERT INTO audit_logs "
            "(id, project_id, user_id, action, resource_type, resource_id, change_summary, timestamp, regulatory_significance) "
            "VALUES (:id, :pid, :uid, :action, :res_type, :res_id, :summary, :ts, :reg_sig)"
        ), {
            "id": log_id, "pid": pid, "uid": uid, "action": action,
            "res_type": res_type, "res_id": res_id, "summary": summary,
            "ts": ts, "reg_sig": action in ("review_decision_submitted", "artifact_generated", "project_completed")
        })

    # ---------- Study DAGs ----------
    from app.services.dag_generator import generate_clarity_ad_dag, generate_default_dag

    # Clarity AD project gets the full realistic DAG
    clarity_dag = generate_clarity_ad_dag(project2_id)
    for n in clarity_dag["nodes"]:
        await session.execute(text(
            "INSERT INTO dag_nodes (id, project_id, key, label, category, description, status, order_index, config, page_route, created_at) "
            "VALUES (:id, :project_id, :key, :label, :category, :description, :status, :order_index, :config, :page_route, :now)"
        ), {
            "id": n["id"], "project_id": n["project_id"], "key": n["key"],
            "label": n["label"], "category": n["category"],
            "description": n.get("description", ""),
            "status": n.get("status", "pending"),
            "order_index": n.get("order_index", 0),
            "config": json.dumps(n.get("config", {})),
            "page_route": n.get("page_route", ""),
            "now": now,
        })
    for e in clarity_dag["edges"]:
        await session.execute(text(
            "INSERT INTO dag_edges (id, project_id, from_node_key, to_node_key, edge_type) "
            "VALUES (:id, :project_id, :from_node_key, :to_node_key, :edge_type)"
        ), {
            "id": e["id"], "project_id": e["project_id"],
            "from_node_key": e["from_node_key"], "to_node_key": e["to_node_key"],
            "edge_type": e.get("edge_type", "dependency"),
        })

    # Other projects get default DAGs
    for default_pid in [project1_id, project3_id, project4_id]:
        default_dag = generate_default_dag(default_pid)
        for n in default_dag["nodes"]:
            await session.execute(text(
                "INSERT INTO dag_nodes (id, project_id, key, label, category, description, status, order_index, config, page_route, created_at) "
                "VALUES (:id, :project_id, :key, :label, :category, :description, :status, :order_index, :config, :page_route, :now)"
            ), {
                "id": n["id"], "project_id": n["project_id"], "key": n["key"],
                "label": n["label"], "category": n["category"],
                "description": n.get("description", ""),
                "status": n.get("status", "pending"),
                "order_index": n.get("order_index", 0),
                "config": json.dumps(n.get("config", {})),
                "page_route": n.get("page_route", ""),
                "now": now,
            })
        for e in default_dag["edges"]:
            await session.execute(text(
                "INSERT INTO dag_edges (id, project_id, from_node_key, to_node_key, edge_type) "
                "VALUES (:id, :project_id, :from_node_key, :to_node_key, :edge_type)"
            ), {
                "id": e["id"], "project_id": e["project_id"],
                "from_node_key": e["from_node_key"], "to_node_key": e["to_node_key"],
                "edge_type": e.get("edge_type", "dependency"),
            })

    logger.info("Database seeding completed successfully: 2 organizations, 8 users, 4 projects, 29 evidence records (10 CLN2 with real PMIDs), 10 comparability scores, 5 bias analyses, 5 review decisions, 10 audit logs, 4 study DAGs")
