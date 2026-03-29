"""
Afarensis Enterprise — Database Seed Data
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
    org_afarensis_id = str(uuid.uuid4())
    org_meridian_id = str(uuid.uuid4())

    orgs = [
        (org_afarensis_id, "Afarensis Inc.", "afarensis", 1),
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

    users = [
        (admin_id, "admin@afarensis.com", "Platform Administrator", "ADMIN", hash_pw("admin123"), 1, "Afarensis Inc.", "Administration", org_afarensis_id),
        (reviewer1_id, "reviewer1@afarensis.com", "Dr. Sarah Chen, Biostatistician", "REVIEWER", hash_pw("reviewer123"), 1, "Afarensis Inc.", "Biostatistics", org_afarensis_id),
        (reviewer2_id, "reviewer2@afarensis.com", "Dr. Michael Torres, Epidemiologist", "REVIEWER", hash_pw("reviewer123"), 1, "Afarensis Inc.", "Epidemiology", org_afarensis_id),
        (analyst_id, "analyst@afarensis.com", "Emily Park, Research Analyst", "ANALYST", hash_pw("analyst123"), 1, "Afarensis Inc.", "Research", org_afarensis_id),
        (viewer_id, "viewer@afarensis.com", "James Liu, Regulatory Affairs", "VIEWER", hash_pw("viewer123"), 1, "Afarensis Inc.", "Regulatory Affairs", org_afarensis_id),
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
        (project1_id, "XY-301: Rare CNS Disorder (Pediatric)", "review",
         "Phase 3 single-arm study of XY-301 in pediatric patients with rare CNS disorder. "
         "External control arm constructed from registry data and natural history studies. "
         "Primary endpoint: change in neurological severity score at 48 weeks.",
         "Evaluate efficacy and safety of XY-301 vs external comparator using ATT estimand with propensity score methods.",
         admin_id, org_afarensis_id),
        (project2_id, "CLARITY-AD: Alzheimer's Disease Phase 3", "completed",
         "Phase 3 randomized controlled trial evaluating monoclonal antibody therapy in early Alzheimer's disease. "
         "Co-primary endpoints: CDR-SB and ADAS-Cog14 at 76 weeks.",
         "Assess treatment effect using ITT estimand in mild cognitive impairment and mild AD dementia populations.",
         reviewer1_id, org_afarensis_id),
        (project3_id, "GLP1-2026: Cardiovascular Outcomes", "draft",
         "Cardiovascular outcomes trial for novel GLP-1 receptor agonist. "
         "Primary endpoint: time to first MACE (cardiovascular death, MI, or stroke).",
         "Evaluate cardiovascular safety and potential benefit using ATE estimand with time-to-event analysis.",
         analyst_id, org_afarensis_id),
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
                "hazard_ratio": 0.38,
                "ci_lower": 0.22,
                "ci_upper": 0.65,
                "p_value": 0.0004,
                "concordance": 0.74,
                "covariates": {
                    "age_at_baseline": {"hr": 1.02, "p": 0.45},
                    "sex_male": {"hr": 0.91, "p": 0.62},
                    "baseline_motor_language_score": {"hr": 0.78, "p": 0.003},
                    "genotype_severity": {"hr": 1.34, "p": 0.018},
                    "seizure_history": {"hr": 1.21, "p": 0.11},
                },
            },
            "propensity_score": {
                "method": "IPW-ATT",
                "ate": -1.53,
                "ate_ci_lower": -2.10,
                "ate_ci_upper": -0.96,
                "att": -1.67,
                "att_ci_lower": -2.28,
                "att_ci_upper": -1.06,
                "ess_treatment": 24,
                "ess_control": 18.3,
                "balance_achieved": True,
                "max_smd_after": 0.07,
                "covariates_balanced": ["age_at_baseline", "sex", "baseline_motor_language_score", "genotype_severity", "age_at_symptom_onset", "seizure_history"],
            },
            "kaplan_meier": {
                "treatment_median_weeks": None,
                "control_median_weeks": 72.4,
                "treatment_survival_48w": 0.92,
                "control_survival_48w": 0.45,
                "log_rank_p": 0.0001,
                "time_points": [0, 12, 24, 36, 48, 60, 72, 84, 96],
                "treatment_survival": [1.0, 0.99, 0.97, 0.95, 0.92, 0.89, 0.86, 0.83, 0.80],
                "control_survival": [1.0, 0.92, 0.82, 0.68, 0.45, 0.33, 0.22, 0.15, 0.10],
            },
            "e_value": {
                "point_estimate": 4.68,
                "ci_bound": 2.41,
                "interpretation": "An unmeasured confounder would need to be associated with both treatment and outcome by a risk ratio of at least 4.68 to explain away the observed effect.",
            },
            "forest_plot": {
                "overall": {"hr": 0.38, "ci_lower": 0.22, "ci_upper": 0.65},
                "subgroups": [
                    {"label": "Age 2-5y", "hr": 0.32, "ci_lower": 0.14, "ci_upper": 0.73, "n": 14},
                    {"label": "Age 6-10y", "hr": 0.41, "ci_lower": 0.18, "ci_upper": 0.92, "n": 8},
                    {"label": "Age 11-16y", "hr": 0.52, "ci_lower": 0.15, "ci_upper": 1.78, "n": 8},
                    {"label": "Male", "hr": 0.35, "ci_lower": 0.16, "ci_upper": 0.77, "n": 16},
                    {"label": "Female", "hr": 0.43, "ci_lower": 0.19, "ci_upper": 0.98, "n": 14},
                    {"label": "Severe genotype", "hr": 0.30, "ci_lower": 0.12, "ci_upper": 0.74, "n": 12},
                    {"label": "Moderate genotype", "hr": 0.48, "ci_lower": 0.23, "ci_upper": 1.01, "n": 18},
                ],
            },
        },
        "pre_analysis_validation": {
            "sample_size_adequate": True,
            "covariate_overlap": 0.89,
            "positivity_violations": 0,
            "missing_data_pct": 3.2,
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
        "indication": "Rare Pediatric CNS Disorder (Neuronal Ceroid Lipofuscinosis Type 2)",
        "pop": "Pediatric patients aged 2-16 years with confirmed CLN2 diagnosis and baseline motor-language score >= 3",
        "primary": "Change from baseline in CLN2 Clinical Rating Scale motor-language score at Week 48",
        "secondary": '["Time to 2-point decline in motor-language score", "Seizure frequency reduction", "MRI volumetric change", "Caregiver-reported outcomes (PedsQL)"]',
        "incl": '["Age 2-16 years", "Genetically confirmed CLN2 disease", "Baseline motor-language score >= 3", "Informed consent from parent/guardian"]',
        "excl": '["Prior enzyme replacement therapy", "Concurrent CNS-active investigational therapy", "Severe hepatic or renal impairment", "Contraindication to intracerebroventricular delivery"]',
        "followup": "48 weeks (primary), 96 weeks (extension)",
        "ss": 24, "statplan": "Mixed-effects model for repeated measures (MMRM) with treatment-policy estimand. Propensity score methods for external control comparison using ATT.",
        "covariates": '["age_at_baseline", "sex", "baseline_motor_language_score", "genotype_severity", "age_at_symptom_onset", "seizure_history"]',
        "assumptions": '["Missing data assumed MAR", "Proportional hazards for time-to-event endpoints", "External control population exchangeability after PS adjustment"]',
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

    # ---------- Evidence Records (10 for XY-301) ----------
    evidence_records = [
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38291045",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38291045/",
            "title": "Efficacy of Novel Therapeutic Agent in Pediatric CNS Disorders: A Multicenter Registry Study",
            "abstract": "Background: Rare pediatric CNS disorders remain a significant unmet medical need. We evaluated outcomes in a multicenter registry of 156 patients treated with cerliponase alfa over 5 years. Methods: Retrospective analysis of CLN2 disease registry data from 12 centers across North America and Europe. Results: Treated patients showed significantly slower decline in motor-language scores compared to natural history (mean difference 1.8 points, 95% CI: 1.2-2.4, p<0.001). Conclusions: Registry data support treatment benefit in CLN2 disease.",
            "authors": '["Chen S", "Martinez R", "Yamamoto K", "Peterson L", "Schmidt W"]',
            "journal": "The Lancet Neurology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 156, "study_type": "retrospective_registry", "follow_up_months": 60, "primary_endpoint": "CLN2 motor-language score change", "primary_result": {"mean_difference": 1.8, "ci_lower": 1.2, "ci_upper": 2.4, "p_value": 0.001}, "population_age_range": "2-16 years", "therapeutic_area": "rare_pediatric_cns"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "37854921",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/37854921/",
            "title": "Natural History of Rare Pediatric CNS Conditions: A 10-Year Longitudinal Cohort",
            "abstract": "Objective: To characterize the natural history of CLN2 disease in an untreated cohort. Methods: Prospective longitudinal study of 42 patients from the DEM-CHILD database with biannual assessments. Results: Median time to loss of ambulation was 4.8 years from symptom onset. Motor-language score declined linearly at a rate of 2.1 points per year. Brain MRI showed progressive cortical and cerebellar atrophy. Conclusions: These data establish a robust natural history benchmark for clinical trial design.",
            "authors": '["Anderson P", "Schulz A", "Nickel M", "Kohlschutter A"]',
            "journal": "Annals of Neurology",
            "publication_year": 2023,
            "structured_data": '{"sample_size": 42, "study_type": "prospective_longitudinal", "follow_up_months": 120, "primary_endpoint": "Rate of motor-language score decline", "primary_result": {"rate_per_year": 2.1, "ci_lower": 1.8, "ci_upper": 2.4}, "population_age_range": "1-12 years", "therapeutic_area": "rare_pediatric_cns"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38102834",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38102834/",
            "title": "Propensity Score Methods in Rare Disease: A Methodological Review",
            "abstract": "This systematic review evaluates the application of propensity score methods in rare disease trials with external controls. We identified 87 studies from 2015-2023 using PS matching, weighting, or stratification. ATT estimation with inverse probability weighting showed the best balance in small-sample rare disease settings. Key recommendations include transparent covariate selection, sensitivity analyses for unmeasured confounding, and use of E-values.",
            "authors": '["Liu J", "Gagne JJ", "Schneeweiss S", "Wang SV"]',
            "journal": "Statistics in Medicine",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 87, "study_type": "systematic_review", "follow_up_months": null, "primary_endpoint": "Methodological quality assessment", "primary_result": {"studies_reviewed": 87, "recommended_method": "IPW-ATT"}, "population_age_range": "all ages", "therapeutic_area": "methodology"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38456712",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38456712/",
            "title": "Regulatory Considerations for External Control Arms in Rare Pediatric Disease",
            "abstract": "The FDA and EMA have increasingly accepted external control arms (ECAs) in rare disease drug development. This analysis reviews 23 regulatory submissions (2018-2023) using ECAs and identifies key factors associated with approval. Robust natural history data, pre-specified analysis plans, and quantified sensitivity to unmeasured confounding were associated with favorable outcomes.",
            "authors": '["Park E", "Thorpe KE", "Freidlin B", "Korn EL"]',
            "journal": "Clinical Pharmacology & Therapeutics",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 23, "study_type": "regulatory_review", "follow_up_months": null, "primary_endpoint": "Regulatory approval outcomes", "primary_result": {"approval_rate": 0.74, "submissions_reviewed": 23}, "population_age_range": "pediatric", "therapeutic_area": "regulatory_science"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "37921456",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/37921456/",
            "title": "Intracerebroventricular Enzyme Replacement for Neuronal Ceroid Lipofuscinosis: Long-term Outcomes",
            "abstract": "We report 3-year outcomes from the pivotal phase 1/2 study of intracerebroventricular cerliponase alfa in CLN2 disease. Of 24 enrolled patients, 22 completed 144 weeks of treatment. Mean motor-language score declined 0.27 points/48 weeks vs 2.12 points/48 weeks in the natural history comparator (p<0.0001). Safety profile was manageable with device-related AEs being most common.",
            "authors": '["Schulz A", "Specchio N", "Gissen P", "de los Reyes E", "Chabrol B"]',
            "journal": "New England Journal of Medicine",
            "publication_year": 2023,
            "structured_data": '{"sample_size": 24, "study_type": "phase_1_2_open_label", "follow_up_months": 144, "primary_endpoint": "Motor-language score change per 48 weeks", "primary_result": {"treatment_rate": 0.27, "comparator_rate": 2.12, "p_value": 0.0001}, "population_age_range": "3-8 years", "therapeutic_area": "rare_pediatric_cns"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "CLINICALTRIALS", "source_id": "NCT04312340",
            "source_url": "https://clinicaltrials.gov/study/NCT04312340",
            "title": "Phase 3 Study of XY-301 in Pediatric Patients with CLN2 Disease (HORIZON)",
            "abstract": "A single-arm, open-label Phase 3 study evaluating the efficacy and safety of XY-301 administered via intracerebroventricular infusion every 2 weeks for 48 weeks. Primary endpoint: change in CLN2 motor-language score compared to matched external controls from DEM-CHILD registry.",
            "authors": '["XY Therapeutics"]',
            "journal": "ClinicalTrials.gov",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 30, "study_type": "phase_3_single_arm", "follow_up_months": 48, "primary_endpoint": "CLN2 motor-language score change vs external control", "primary_result": null, "population_age_range": "2-16 years", "therapeutic_area": "rare_pediatric_cns"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38567234",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38567234/",
            "title": "Covariate Balance Diagnostics for External Control Arms: A Practical Guide",
            "abstract": "External control arms require rigorous covariate balance assessment. We present a practical framework using standardized mean differences, variance ratios, and overlap statistics. Application to 5 rare disease case studies demonstrates that achieving balance on prognostic covariates is critical for credible causal inference. Love plots and balance tables should be standard reporting elements.",
            "authors": '["Stuart EA", "DuGoff E", "Fontana M", "Austin PC"]',
            "journal": "Pharmaceutical Statistics",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 5, "study_type": "methodological_guidance", "follow_up_months": null, "primary_endpoint": "Covariate balance metrics", "primary_result": {"case_studies": 5, "smd_threshold": 0.1}, "population_age_range": "all ages", "therapeutic_area": "methodology"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38123789",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38123789/",
            "title": "Brain MRI as a Surrogate Endpoint in Neuronal Ceroid Lipofuscinosis Trials",
            "abstract": "MRI volumetric measures correlate with clinical outcomes in CLN2 disease. In a cohort of 68 patients, gray matter volume loss predicted motor-language score decline (r=0.78, p<0.001). Quantitative MRI may serve as a sensitive secondary endpoint, detecting treatment effects earlier than clinical scales.",
            "authors": '["Dyke JP", "Sondhi D", "Kaminsky SM", "Crystal RG"]',
            "journal": "Neuroimage: Clinical",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 68, "study_type": "biomarker_validation", "follow_up_months": 36, "primary_endpoint": "Correlation of MRI volumetrics with clinical outcomes", "primary_result": {"correlation_r": 0.78, "p_value": 0.001}, "population_age_range": "2-14 years", "therapeutic_area": "rare_pediatric_cns"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38234567",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38234567/",
            "title": "Sensitivity Analysis Frameworks for Unmeasured Confounding in Single-Arm Trials",
            "abstract": "Single-arm trials with external controls are vulnerable to unmeasured confounding. We compare E-value, Rosenbaum bounds, and probabilistic bias analysis approaches. Using simulated and real rare disease data, we show that E-value reporting provides an accessible, interpretable metric for regulatory reviewers. A minimum E-value of 2.0 is proposed as a threshold for robust conclusions.",
            "authors": '["VanderWeele TJ", "Ding P", "Mathur MB"]',
            "journal": "Journal of Clinical Epidemiology",
            "publication_year": 2024,
            "structured_data": '{"sample_size": null, "study_type": "simulation_study", "follow_up_months": null, "primary_endpoint": "E-value threshold determination", "primary_result": {"recommended_e_value_threshold": 2.0}, "population_age_range": "all ages", "therapeutic_area": "methodology"}'
        },
        {
            "id": str(uuid.uuid4()), "project_id": project1_id,
            "source_type": "PUBMED", "source_id": "38345678",
            "source_url": "https://pubmed.ncbi.nlm.nih.gov/38345678/",
            "title": "Patient-Reported Outcomes in Rare Pediatric Neurological Disorders: Psychometric Validation",
            "abstract": "Validated PRO measures are lacking in rare pediatric CNS disorders. We conducted psychometric evaluation of PedsQL, PROMIS, and CLN2-specific QoL instruments in 93 families. The CLN2-QoL showed strong internal consistency (Cronbach's alpha=0.89) and test-retest reliability (ICC=0.91). It is recommended as a secondary endpoint in CLN2 trials.",
            "authors": '["Varni JW", "Limbers CA", "Williams E", "Specchio N"]',
            "journal": "Quality of Life Research",
            "publication_year": 2024,
            "structured_data": '{"sample_size": 93, "study_type": "psychometric_validation", "follow_up_months": 12, "primary_endpoint": "Psychometric properties of CLN2-QoL", "primary_result": {"cronbach_alpha": 0.89, "icc": 0.91}, "population_age_range": "2-18 years", "therapeutic_area": "rare_pediatric_cns"}'
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

    comp_scores_data = [
        (0.88, 0.82, 0.91, 0.85, 0.87, 0.93, 0.87, 0.80),
        (0.92, 0.78, 0.85, 0.90, 0.83, 0.95, 0.86, 0.82),
        (0.65, 0.60, 0.88, 0.70, 0.92, 0.90, 0.77, 0.68),
        (0.70, 0.55, 0.75, 0.68, 0.85, 0.88, 0.73, 0.65),
        (0.95, 0.90, 0.93, 0.88, 0.91, 0.96, 0.92, 0.90),
        (0.90, 0.85, 0.80, 0.82, 0.78, 0.85, 0.83, 0.78),
        (0.68, 0.62, 0.90, 0.72, 0.88, 0.87, 0.78, 0.70),
        (0.82, 0.75, 0.80, 0.78, 0.84, 0.90, 0.81, 0.76),
        (0.60, 0.58, 0.85, 0.65, 0.90, 0.88, 0.74, 0.62),
        (0.78, 0.70, 0.82, 0.75, 0.80, 0.86, 0.78, 0.72),
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
            "rationale": f"Automated scoring for evidence record {i+1}. Population overlap assessed via age range and disease stage matching.",
            "now": now, "model": "afarensis-scorer-v2", "version": "2.1.0"
        })

    # ---------- Bias Analyses (5 per project — using XY-301 comparability scores) ----------
    bias_data = [
        ("SELECTION_BIAS", 0.35, 0.30, 0.25,
         "Potential selection bias in registry enrollment. Sicker patients may be underrepresented in the registry comparator arm.",
         '["Sensitivity analysis excluding late-enrolling centers", "Propensity score trimming at 5th/95th percentile", "Comparison of baseline characteristics pre/post matching"]',
         "Assess enrollment patterns across centers. Apply stabilized IPW with truncation at the 1st and 99th percentiles."),
        ("CONFOUNDING", 0.45, 0.40, 0.38,
         "Residual confounding by disease severity at baseline. Genotype severity classification differs between trial and registry.",
         '["Adjust for genotype in propensity score model", "E-value calculation for unmeasured confounding", "Negative control outcome analysis"]',
         "Include genotype severity as a covariate. Report E-values for the primary treatment effect estimate."),
        ("MEASUREMENT_BIAS", 0.25, 0.20, 0.18,
         "Motor-language scale administered by different raters across trial and registry. Inter-rater reliability not uniformly assessed.",
         '["Calibration substudy between trial and registry raters", "Mixed-effects model with rater as random effect", "Sensitivity analysis restricting to centers with certified raters"]',
         "Request rater certification data. Apply measurement error correction models if inter-rater variability exceeds threshold."),
        ("TEMPORAL_BIAS", 0.30, 0.28, 0.22,
         "Registry data collected over 10 years with evolving supportive care standards. Treatment era may confound outcomes.",
         '["Restrict comparator to contemporary patients (enrolled after 2018)", "Include calendar year as covariate", "Test for temporal trend in natural history data"]',
         "Limit external control to patients enrolled within 5 years of trial start. Test calendar year interaction."),
        ("PUBLICATION_BIAS", 0.20, 0.15, 0.12,
         "Published literature may overrepresent positive results for enzyme replacement therapy in lysosomal storage disorders.",
         '["Funnel plot analysis for existing meta-analyses", "Search clinical trial registries for unpublished studies", "Trim-and-fill sensitivity analysis"]',
         "Conduct comprehensive search including conference abstracts and regulatory documents to identify unpublished data."),
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
        (ev_ids[0], reviewer1_id, "ACCEPTED", 0.85,
         "Registry study provides strong real-world evidence with adequate sample size. Multicenter design enhances generalizability. "
         "Recommend as primary external comparator source."),
        (ev_ids[1], reviewer1_id, "ACCEPTED", 0.90,
         "Gold-standard natural history data with prospective design and long follow-up. "
         "Essential for constructing the external control arm."),
        (ev_ids[2], reviewer2_id, "ACCEPTED", 0.75,
         "Valuable methodological reference for propensity score approach selection. "
         "ATT with IPW recommendation aligns with our statistical analysis plan."),
        (ev_ids[3], reviewer2_id, "DEFERRED", 0.60,
         "Regulatory review provides useful precedents but sample of submissions is small. "
         "Defer pending additional review of individual case study details."),
        (ev_ids[4], reviewer1_id, "ACCEPTED", 0.92,
         "Pivotal study demonstrates clear treatment benefit vs natural history. "
         "3-year data with strong effect size. Critical evidence for the regulatory submission."),
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
        ("safety_assessment_report", "XY-301 Safety Assessment Report — Draft", "html", "FDA",
         "Pre-BLA safety assessment for XY-301 ICV administration in pediatric CLN2 patients"),
        ("evidence_table", "XY-301 Evidence Summary Table v1.0", "html", "FDA",
         "Comprehensive evidence table summarizing all included external control sources"),
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
        (project1_id, admin_id, "project_created", "project", project1_id, "Created XY-301 evidence review project"),
        (project1_id, analyst_id, "evidence_discovery_started", "evidence", None, "Initiated PubMed and ClinicalTrials.gov search for XY-301"),
        (project1_id, analyst_id, "evidence_imported", "evidence", ev_ids[0], "Imported 10 evidence records from automated discovery"),
        (project1_id, reviewer1_id, "review_decision_submitted", "review_decision", None, "Accepted registry study evidence (PMID 38291045)"),
        (project1_id, reviewer1_id, "review_decision_submitted", "review_decision", None, "Accepted natural history cohort evidence (PMID 37854921)"),
        (project1_id, reviewer2_id, "review_decision_submitted", "review_decision", None, "Deferred regulatory review evidence pending additional analysis"),
        (project1_id, admin_id, "artifact_generated", "regulatory_artifact", None, "Generated draft Safety Assessment Report for XY-301"),
        (project2_id, reviewer1_id, "project_completed", "project", project2_id, "CLARITY-AD project marked as completed"),
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

    logger.info("Database seeding completed successfully: 2 organizations, 7 users, 4 projects, 16 evidence records, 10 comparability scores, 5 bias analyses, 5 review decisions, 10 audit logs, 4 study DAGs")
