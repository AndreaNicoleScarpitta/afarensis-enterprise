"""
Seed script: Populate processing_config for 4 sample clinical trial projects.
Merges with existing data (preserves analysis_results, pre_analysis_validation).
"""
import sqlite3
import json
import sys

DB_PATH = "C:/Users/andys/Downloads/AfarensisEnterprise-v2.1-COMPLETE-FIXED-PACKAGE/AfarensisEnterprise-v2.1-FIXED-COMPLETE/backend/afarensis.db"

TIMESTAMP = "2026-03-27T12:00:00Z"

def meta(section_key):
    return {
        f"{section_key}_meta": {
            "updated_at": TIMESTAMP,
            "updated_by": "system",
            "version": 1,
            "content_hash": "seeded"
        }
    }

# ─── PROJECT 1: XY-301 Pediatric CNS / Epilepsy ───────────────────────────
xy301 = {
    "study_definition": {
        "protocol": "XY-301",
        "indication": "Rare CNS Disorder (Pediatric Epilepsy)",
        "phase": "Phase 3",
        "regulatoryBody": "FDA",
        "designType": "Active comparator, new user",
        "endpoint": "Time to first seizure recurrence",
        "secondaryEndpoints": ["50% responder rate", "Change in seizure frequency", "Quality of life (PedsQL)"],
        "estimand": "ATT",
        "iceStrategy": "treatment_policy",
        "missingDataMethod": "multiple_imputation",
        "primaryModel": "Cox Proportional Hazards",
        "weightingMethod": "iptw",
        "varianceEstimator": "robust_sandwich"
    },
    "covariates": {
        "covariates": [
            {"name": "Age", "type": "continuous", "balance": 0.04},
            {"name": "Sex", "type": "binary", "balance": 0.02},
            {"name": "Baseline seizure frequency", "type": "continuous", "balance": 0.08},
            {"name": "Number of prior AEDs", "type": "continuous", "balance": 0.06},
            {"name": "Epilepsy syndrome", "type": "categorical", "balance": 0.05}
        ],
        "unmeasured": ["Genetic susceptibility", "Medication adherence"]
    },
    "data_sources": {
        "sources": [
            {"name": "XY-301 Trial Database", "type": "RCT", "coverage": "2022-2025", "status": "validated"},
            {"name": "National Epilepsy Registry", "type": "Registry", "coverage": "2018-2025", "status": "validated"}
        ],
        "qualityThreshold": 95
    },
    "cohort": {
        "inclusion": ["Age 2-17 years", "Diagnosed epilepsy (ICD-10 G40)", ">=4 seizures in baseline period", "Failed >=1 prior AED"],
        "exclusion": ["Progressive neurological disease", "Prior neurosurgery", "Non-epileptic seizures"],
        "weightingMethod": "IPTW",
        "indexDateDefinition": "Date of first drug dispensing",
        "washoutPeriod": 90,
        "funnel": [
            {"stage": "Source population", "n": 1247, "pct": 100},
            {"stage": "Meets inclusion", "n": 834, "pct": 66.9},
            {"stage": "No exclusions", "n": 712, "pct": 57.1},
            {"stage": "Complete baseline", "n": 698, "pct": 56.0},
            {"stage": "Final cohort", "n": 682, "pct": 54.7}
        ]
    },
    "balance": {
        "threshold": 0.10,
        "psModelType": "Logistic Regression",
        "caliperWidth": 0.2,
        "trimming": False,
        "covariates": [
            {"name": "Age", "smd_before": 0.23, "smd_after": 0.04, "included": True},
            {"name": "Sex", "smd_before": 0.08, "smd_after": 0.02, "included": True},
            {"name": "Baseline seizure frequency", "smd_before": 0.31, "smd_after": 0.08, "included": True},
            {"name": "Number of prior AEDs", "smd_before": 0.19, "smd_after": 0.06, "included": True},
            {"name": "Epilepsy syndrome", "smd_before": 0.15, "smd_after": 0.05, "included": True}
        ]
    },
    "effect_estimation": {
        "alpha": 0.05,
        "multiplicityMethod": "Holm",
        "bootstrapIterations": 2000,
        "results": [
            {"label": "Primary: Time to seizure recurrence", "hr": 0.62, "ci_lower": 0.48, "ci_upper": 0.80, "pvalue": 0.0003, "type": "primary"},
            {"label": "50% responder rate", "or": 2.14, "ci_lower": 1.52, "ci_upper": 3.01, "pvalue": 0.001, "type": "secondary"},
            {"label": "Change in seizure frequency", "md": -3.2, "ci_lower": -4.8, "ci_upper": -1.6, "pvalue": 0.002, "type": "secondary"}
        ]
    },
    "bias": {
        "eValue": {"point": 2.68, "ci": 1.89},
        "sensitivityAnalyses": [
            {"name": "Trim extremes (1st/99th)", "method": "Trimming", "result": "HR 0.64 (0.49, 0.83)"},
            {"name": "Overlap weights", "method": "Alternative weights", "result": "HR 0.60 (0.46, 0.78)"}
        ],
        "missingDataStrategy": "MI",
        "bayesianPrior": {"distribution": "Normal", "location": 0, "scale": 0.5},
        "negativeControls": [{"outcome": "Accidental injury", "hr": 1.02, "ci_lower": 0.85, "ci_upper": 1.22}]
    },
    "reproducibility": {
        "manifest": [
            {"name": "cohort_construction.R", "type": "code", "hash": "sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0", "signed": True},
            {"name": "analysis_pipeline.R", "type": "code", "hash": "sha256:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3", "signed": True},
            {"name": "xy301_analytic_cohort.rds", "type": "data", "hash": "sha256:g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6", "signed": False}
        ],
        "dockerImage": "afarensis/xy301:v1.2.3",
        "renvVersion": "1.0.7",
        "packages": [
            {"name": "survival", "version": "3.5-7"},
            {"name": "MatchIt", "version": "4.5.5"},
            {"name": "cobalt", "version": "4.5.1"}
        ]
    },
    "regulatory": {
        "submissionAuthority": "FDA",
        "exportFormat": "PDF",
        "sarSections": [
            {"title": "Executive Summary", "status": "complete"},
            {"title": "Study Design", "status": "complete"},
            {"title": "Statistical Methods", "status": "complete"},
            {"title": "Results", "status": "draft"},
            {"title": "Sensitivity Analyses", "status": "draft"}
        ],
        "readinessChecks": [
            {"label": "Primary analysis complete", "passed": True},
            {"label": "Sensitivity analyses complete", "passed": True},
            {"label": "Bias assessment complete", "passed": True},
            {"label": "All artifacts signed", "passed": False}
        ]
    }
}

# ─── PROJECT 2: CLARITY-AD Alzheimer's Phase 3 ────────────────────────────
clarity_ad = {
    "study_definition": {
        "protocol": "CLARITY-AD",
        "indication": "Alzheimer's Disease (Early Symptomatic)",
        "phase": "Phase 3",
        "regulatoryBody": "EMA",
        "designType": "Placebo-controlled, double-blind",
        "endpoint": "Change from baseline in CDR-SB at 18 months",
        "secondaryEndpoints": ["ADAS-Cog14 change from baseline", "ADCS-MCI-ADL change from baseline", "Amyloid PET SUVr change"],
        "estimand": "ATE",
        "iceStrategy": "hypothetical",
        "missingDataMethod": "MMRM",
        "primaryModel": "Mixed Model for Repeated Measures (MMRM)",
        "weightingMethod": "none",
        "varianceEstimator": "unstructured_covariance"
    },
    "covariates": {
        "covariates": [
            {"name": "Age", "type": "continuous", "balance": 0.03},
            {"name": "Sex", "type": "binary", "balance": 0.01},
            {"name": "APOE4 carrier status", "type": "binary", "balance": 0.05},
            {"name": "Baseline CDR-SB", "type": "continuous", "balance": 0.04},
            {"name": "Baseline MMSE", "type": "continuous", "balance": 0.06},
            {"name": "Concomitant cholinesterase inhibitor use", "type": "binary", "balance": 0.03},
            {"name": "Baseline amyloid PET SUVr", "type": "continuous", "balance": 0.07}
        ],
        "unmeasured": ["Cognitive reserve (education quality)", "Tau burden (p-tau217 substudy only)"]
    },
    "data_sources": {
        "sources": [
            {"name": "CLARITY-AD Phase 3 EDC", "type": "RCT", "coverage": "2019-2025", "status": "validated"},
            {"name": "CLARITY-AD Open-Label Extension", "type": "RCT-OLE", "coverage": "2023-2026", "status": "ongoing"},
            {"name": "ADNI Reference Cohort", "type": "External Control", "coverage": "2004-2025", "status": "validated"}
        ],
        "qualityThreshold": 98
    },
    "cohort": {
        "inclusion": ["Age 50-90 years", "Clinical diagnosis of MCI due to AD or mild AD dementia", "Amyloid-positive on PET or CSF", "MMSE 22-30", "CDR global score 0.5 or 1.0"],
        "exclusion": ["Non-AD dementia", "Significant cerebrovascular disease (Fazekas >=3)", "Anticoagulant therapy", "Prior anti-amyloid immunotherapy"],
        "weightingMethod": "None (Randomized)",
        "indexDateDefinition": "Date of randomization",
        "washoutPeriod": 0,
        "funnel": [
            {"stage": "Screened", "n": 2974, "pct": 100},
            {"stage": "Amyloid confirmed", "n": 1966, "pct": 66.1},
            {"stage": "Meets all inclusion/exclusion", "n": 1795, "pct": 60.4},
            {"stage": "Randomized", "n": 1795, "pct": 60.4},
            {"stage": "Modified ITT (received >=1 dose)", "n": 1774, "pct": 59.6},
            {"stage": "Completed 18 months", "n": 1612, "pct": 54.2}
        ]
    },
    "balance": {
        "threshold": 0.10,
        "psModelType": "Randomization-based (no PS needed)",
        "caliperWidth": None,
        "trimming": False,
        "covariates": [
            {"name": "Age", "smd_before": 0.05, "smd_after": 0.05, "included": True},
            {"name": "Sex", "smd_before": 0.03, "smd_after": 0.03, "included": True},
            {"name": "APOE4 carrier status", "smd_before": 0.07, "smd_after": 0.07, "included": True},
            {"name": "Baseline CDR-SB", "smd_before": 0.04, "smd_after": 0.04, "included": True},
            {"name": "Baseline MMSE", "smd_before": 0.06, "smd_after": 0.06, "included": True},
            {"name": "Baseline amyloid PET SUVr", "smd_before": 0.08, "smd_after": 0.08, "included": True}
        ]
    },
    "effect_estimation": {
        "alpha": 0.05,
        "multiplicityMethod": "Hierarchical (fixed-sequence)",
        "bootstrapIterations": 0,
        "results": [
            {"label": "Primary: CDR-SB change from baseline at 18mo", "lsmd": -0.45, "ci_lower": -0.67, "ci_upper": -0.23, "pvalue": 0.00005, "type": "primary"},
            {"label": "ADAS-Cog14 change from baseline", "lsmd": -1.44, "ci_lower": -2.27, "ci_upper": -0.61, "pvalue": 0.0006, "type": "secondary"},
            {"label": "ADCS-MCI-ADL change from baseline", "lsmd": 2.01, "ci_lower": 0.90, "ci_upper": 3.12, "pvalue": 0.0004, "type": "secondary"},
            {"label": "Amyloid PET SUVr change", "lsmd": -0.17, "ci_lower": -0.19, "ci_upper": -0.15, "pvalue": 0.00001, "type": "secondary"}
        ]
    },
    "bias": {
        "eValue": {"point": 1.95, "ci": 1.52},
        "sensitivityAnalyses": [
            {"name": "Tipping point analysis (CDR-SB)", "method": "Controlled imputation", "result": "Robust up to delta=0.8 per missing visit"},
            {"name": "Per-protocol population", "method": "Completer analysis", "result": "LSMD -0.51 (-0.75, -0.27)"},
            {"name": "Pattern mixture model", "method": "Pattern mixture MMRM", "result": "LSMD -0.42 (-0.65, -0.19)"}
        ],
        "missingDataStrategy": "MMRM (MAR assumption)",
        "bayesianPrior": {"distribution": "Normal", "location": 0, "scale": 0.3},
        "negativeControls": [{"outcome": "Grip strength change", "md": 0.12, "ci_lower": -0.45, "ci_upper": 0.69}]
    },
    "reproducibility": {
        "manifest": [
            {"name": "CLARITY_primary_MMRM.sas", "type": "code", "hash": "sha256:b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1", "signed": True},
            {"name": "CLARITY_secondary_analyses.sas", "type": "code", "hash": "sha256:e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4", "signed": True},
            {"name": "CLARITY_ADAM_datasets.sas7bdat", "type": "data", "hash": "sha256:h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7", "signed": True},
            {"name": "CLARITY_TLFs.pdf", "type": "output", "hash": "sha256:k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0", "signed": True}
        ],
        "dockerImage": "afarensis/clarity-ad:v2.0.1",
        "renvVersion": None,
        "sasVersion": "9.4M8",
        "packages": [
            {"name": "SAS/STAT", "version": "15.3"},
            {"name": "SAS/GRAPH", "version": "9.4"}
        ]
    },
    "regulatory": {
        "submissionAuthority": "EMA",
        "exportFormat": "PDF",
        "sarSections": [
            {"title": "Executive Summary", "status": "complete"},
            {"title": "Study Design", "status": "complete"},
            {"title": "Statistical Methods", "status": "complete"},
            {"title": "Results", "status": "complete"},
            {"title": "Sensitivity Analyses", "status": "complete"},
            {"title": "Subgroup Analyses", "status": "complete"},
            {"title": "Safety Summary", "status": "complete"}
        ],
        "readinessChecks": [
            {"label": "Primary analysis complete", "passed": True},
            {"label": "Sensitivity analyses complete", "passed": True},
            {"label": "Bias assessment complete", "passed": True},
            {"label": "All artifacts signed", "passed": True},
            {"label": "CSR cross-referenced", "passed": True}
        ]
    }
}

# ─── PROJECT 3: GLP1-2026 Cardiovascular Outcomes ─────────────────────────
glp1 = {
    "study_definition": {
        "protocol": "GLP1-2026",
        "indication": "Cardiovascular Outcomes in Type 2 Diabetes",
        "phase": "Phase 3b/4 (CVOT)",
        "regulatoryBody": "FDA",
        "designType": "Placebo-controlled, event-driven",
        "endpoint": "Time to first MACE (composite: CV death, non-fatal MI, non-fatal stroke)",
        "secondaryEndpoints": ["CV death", "Non-fatal myocardial infarction", "Non-fatal stroke", "Hospitalization for heart failure", "All-cause mortality"],
        "estimand": "ATE",
        "iceStrategy": "treatment_policy",
        "missingDataMethod": "multiple_imputation",
        "primaryModel": "Cox Proportional Hazards",
        "weightingMethod": "none",
        "varianceEstimator": "robust_sandwich"
    },
    "covariates": {
        "covariates": [
            {"name": "Age", "type": "continuous", "balance": 0.02},
            {"name": "Sex", "type": "binary", "balance": 0.01},
            {"name": "HbA1c at baseline", "type": "continuous", "balance": 0.04},
            {"name": "Duration of diabetes", "type": "continuous", "balance": 0.03},
            {"name": "Prior CV event", "type": "binary", "balance": 0.02},
            {"name": "eGFR at baseline", "type": "continuous", "balance": 0.05},
            {"name": "BMI", "type": "continuous", "balance": 0.03},
            {"name": "Statin use", "type": "binary", "balance": 0.01},
            {"name": "SGLT2i use", "type": "binary", "balance": 0.02}
        ],
        "unmeasured": ["Diet and exercise compliance", "Socioeconomic status"]
    },
    "data_sources": {
        "sources": [
            {"name": "GLP1-2026 CVOT Database", "type": "RCT", "coverage": "2021-2026", "status": "ongoing"},
            {"name": "FDA Sentinel System (comparator)", "type": "Claims", "coverage": "2018-2025", "status": "validated"},
            {"name": "NHANES Cardiovascular Reference", "type": "Survey", "coverage": "2019-2024", "status": "validated"}
        ],
        "qualityThreshold": 97
    },
    "cohort": {
        "inclusion": ["Age >=40 years", "Type 2 diabetes (HbA1c >=7.0%)", "Established CV disease OR >=2 CV risk factors", "Stable background glucose-lowering therapy >=3 months"],
        "exclusion": ["Type 1 diabetes", "eGFR <15 mL/min/1.73m2", "History of pancreatitis", "Current GLP-1 RA use", "Medullary thyroid carcinoma history or MEN2"],
        "weightingMethod": "None (Randomized)",
        "indexDateDefinition": "Date of randomization",
        "washoutPeriod": 0,
        "funnel": [
            {"stage": "Screened", "n": 15280, "pct": 100},
            {"stage": "Eligible", "n": 10842, "pct": 70.9},
            {"stage": "Randomized", "n": 9642, "pct": 63.1},
            {"stage": "Received study drug", "n": 9618, "pct": 62.9},
            {"stage": "Completed median 3.2y follow-up", "n": 8956, "pct": 58.6},
            {"stage": "Primary analysis set", "n": 9618, "pct": 62.9}
        ]
    },
    "balance": {
        "threshold": 0.10,
        "psModelType": "Randomization-based (stratified by CV history)",
        "caliperWidth": None,
        "trimming": False,
        "covariates": [
            {"name": "Age", "smd_before": 0.03, "smd_after": 0.03, "included": True},
            {"name": "Sex", "smd_before": 0.02, "smd_after": 0.02, "included": True},
            {"name": "HbA1c at baseline", "smd_before": 0.04, "smd_after": 0.04, "included": True},
            {"name": "Prior CV event", "smd_before": 0.01, "smd_after": 0.01, "included": True},
            {"name": "eGFR at baseline", "smd_before": 0.05, "smd_after": 0.05, "included": True},
            {"name": "BMI", "smd_before": 0.03, "smd_after": 0.03, "included": True},
            {"name": "Statin use", "smd_before": 0.02, "smd_after": 0.02, "included": True}
        ]
    },
    "effect_estimation": {
        "alpha": 0.05,
        "multiplicityMethod": "Hierarchical (fixed-sequence, non-inferiority then superiority)",
        "bootstrapIterations": 0,
        "results": [
            {"label": "Primary: 3-point MACE", "hr": 0.79, "ci_lower": 0.70, "ci_upper": 0.89, "pvalue": 0.0001, "type": "primary"},
            {"label": "CV death", "hr": 0.82, "ci_lower": 0.68, "ci_upper": 0.99, "pvalue": 0.038, "type": "secondary"},
            {"label": "Non-fatal MI", "hr": 0.75, "ci_lower": 0.62, "ci_upper": 0.91, "pvalue": 0.003, "type": "secondary"},
            {"label": "Non-fatal stroke", "hr": 0.83, "ci_lower": 0.66, "ci_upper": 1.04, "pvalue": 0.11, "type": "secondary"},
            {"label": "Hospitalization for heart failure", "hr": 0.73, "ci_lower": 0.61, "ci_upper": 0.87, "pvalue": 0.0005, "type": "secondary"},
            {"label": "All-cause mortality", "hr": 0.88, "ci_lower": 0.77, "ci_upper": 1.01, "pvalue": 0.068, "type": "secondary"}
        ]
    },
    "bias": {
        "eValue": {"point": 1.84, "ci": 1.49},
        "sensitivityAnalyses": [
            {"name": "On-treatment analysis", "method": "Censoring at discontinuation", "result": "HR 0.74 (0.64, 0.86)"},
            {"name": "Subgroup: established CV disease", "method": "Subgroup analysis", "result": "HR 0.76 (0.66, 0.88)"},
            {"name": "Subgroup: risk factors only", "method": "Subgroup analysis", "result": "HR 0.85 (0.70, 1.03)"},
            {"name": "Competing risk (Fine-Gray)", "method": "Competing risk regression", "result": "sHR 0.80 (0.71, 0.90)"}
        ],
        "missingDataStrategy": "MI + vital status from registry linkage",
        "bayesianPrior": {"distribution": "Normal", "location": 0, "scale": 0.25},
        "negativeControls": [
            {"outcome": "Appendicitis", "hr": 0.97, "ci_lower": 0.68, "ci_upper": 1.38},
            {"outcome": "Hip fracture", "hr": 1.04, "ci_lower": 0.82, "ci_upper": 1.32}
        ]
    },
    "reproducibility": {
        "manifest": [
            {"name": "CVOT_primary_analysis.R", "type": "code", "hash": "sha256:c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2", "signed": True},
            {"name": "CVOT_subgroup_forest.R", "type": "code", "hash": "sha256:f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5", "signed": True},
            {"name": "CVOT_KM_curves.R", "type": "code", "hash": "sha256:i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8", "signed": True},
            {"name": "glp1_2026_adtte.sas7bdat", "type": "data", "hash": "sha256:l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1", "signed": False}
        ],
        "dockerImage": "afarensis/glp1-cvot:v0.9.0",
        "renvVersion": "1.0.7",
        "packages": [
            {"name": "survival", "version": "3.5-7"},
            {"name": "cmprsk", "version": "2.2-11"},
            {"name": "ggsurvfit", "version": "1.0.0"},
            {"name": "forestploter", "version": "1.1.1"}
        ]
    },
    "regulatory": {
        "submissionAuthority": "FDA",
        "exportFormat": "PDF",
        "sarSections": [
            {"title": "Executive Summary", "status": "not_started"},
            {"title": "Study Design", "status": "draft"},
            {"title": "Statistical Methods", "status": "draft"},
            {"title": "Results", "status": "not_started"},
            {"title": "Sensitivity Analyses", "status": "not_started"},
            {"title": "Subgroup Analyses", "status": "not_started"}
        ],
        "readinessChecks": [
            {"label": "Primary analysis complete", "passed": False},
            {"label": "Sensitivity analyses complete", "passed": False},
            {"label": "Bias assessment complete", "passed": False},
            {"label": "All artifacts signed", "passed": False},
            {"label": "DSMB unblinding approval", "passed": False}
        ]
    }
}

# ─── PROJECT 4: MRD-100 Autoimmune Hepatitis Phase 2 ──────────────────────
mrd100 = {
    "study_definition": {
        "protocol": "MRD-100",
        "indication": "Autoimmune Hepatitis (AIH)",
        "phase": "Phase 2",
        "regulatoryBody": "FDA",
        "designType": "Placebo-controlled, double-blind, dose-ranging",
        "endpoint": "ALT normalization rate at Week 24",
        "secondaryEndpoints": ["Histological improvement (HAI decrease >=2 points)", "Steroid-free remission at Week 52", "IgG normalization rate", "Change from baseline in MELD score"],
        "estimand": "ATE",
        "iceStrategy": "composite",
        "missingDataMethod": "non_responder_imputation",
        "primaryModel": "Logistic Regression",
        "weightingMethod": "none",
        "varianceEstimator": "model_based"
    },
    "covariates": {
        "covariates": [
            {"name": "Age", "type": "continuous", "balance": 0.05},
            {"name": "Sex", "type": "binary", "balance": 0.03},
            {"name": "Baseline ALT (xULN)", "type": "continuous", "balance": 0.07},
            {"name": "Baseline IgG", "type": "continuous", "balance": 0.06},
            {"name": "Prior steroid exposure (months)", "type": "continuous", "balance": 0.04},
            {"name": "Anti-SLA antibody status", "type": "binary", "balance": 0.08},
            {"name": "Fibrosis stage (F0-F4)", "type": "ordinal", "balance": 0.05}
        ],
        "unmeasured": ["HLA genotype", "Gut microbiome composition"]
    },
    "data_sources": {
        "sources": [
            {"name": "MRD-100 Phase 2 EDC", "type": "RCT", "coverage": "2024-2026", "status": "ongoing"},
            {"name": "AIH Natural History Cohort (IAIHG)", "type": "Registry", "coverage": "2015-2025", "status": "validated"}
        ],
        "qualityThreshold": 93
    },
    "cohort": {
        "inclusion": ["Age 18-75 years", "Confirmed AIH per simplified IAIHG criteria (score >=6)", "ALT >=2x ULN despite standard immunosuppression", "Liver biopsy within 6 months"],
        "exclusion": ["Overlap syndromes (PBC/PSC)", "Decompensated cirrhosis (Child-Pugh B/C)", "Active viral hepatitis (HBV/HCV)", "Drug-induced liver injury", "Pregnancy or lactation"],
        "weightingMethod": "None (Randomized)",
        "indexDateDefinition": "Date of first dose",
        "washoutPeriod": 30,
        "funnel": [
            {"stage": "Screened", "n": 342, "pct": 100},
            {"stage": "Biopsy confirmed AIH", "n": 278, "pct": 81.3},
            {"stage": "Meets all criteria", "n": 198, "pct": 57.9},
            {"stage": "Randomized (3:3:2 active doses vs placebo)", "n": 180, "pct": 52.6},
            {"stage": "Received >=1 dose", "n": 178, "pct": 52.0},
            {"stage": "Completed Week 24", "n": 162, "pct": 47.4}
        ]
    },
    "balance": {
        "threshold": 0.10,
        "psModelType": "Randomization-based (stratified by fibrosis stage)",
        "caliperWidth": None,
        "trimming": False,
        "covariates": [
            {"name": "Age", "smd_before": 0.06, "smd_after": 0.06, "included": True},
            {"name": "Sex", "smd_before": 0.04, "smd_after": 0.04, "included": True},
            {"name": "Baseline ALT (xULN)", "smd_before": 0.09, "smd_after": 0.09, "included": True},
            {"name": "Baseline IgG", "smd_before": 0.07, "smd_after": 0.07, "included": True},
            {"name": "Prior steroid exposure", "smd_before": 0.05, "smd_after": 0.05, "included": True},
            {"name": "Anti-SLA antibody status", "smd_before": 0.08, "smd_after": 0.08, "included": True},
            {"name": "Fibrosis stage", "smd_before": 0.03, "smd_after": 0.03, "included": True}
        ]
    },
    "effect_estimation": {
        "alpha": 0.05,
        "multiplicityMethod": "Dunnett (dose groups vs placebo)",
        "bootstrapIterations": 1000,
        "results": [
            {"label": "Primary: ALT normalization (high dose vs placebo)", "or": 3.82, "ci_lower": 1.74, "ci_upper": 8.39, "pvalue": 0.0008, "type": "primary"},
            {"label": "Primary: ALT normalization (low dose vs placebo)", "or": 1.89, "ci_lower": 0.85, "ci_upper": 4.20, "pvalue": 0.12, "type": "primary"},
            {"label": "Histological improvement (high dose)", "or": 2.94, "ci_lower": 1.28, "ci_upper": 6.76, "pvalue": 0.011, "type": "secondary"},
            {"label": "Steroid-free remission at W52 (high dose)", "or": 4.15, "ci_lower": 1.62, "ci_upper": 10.63, "pvalue": 0.003, "type": "secondary"},
            {"label": "IgG normalization (high dose)", "or": 2.51, "ci_lower": 1.12, "ci_upper": 5.63, "pvalue": 0.026, "type": "secondary"}
        ]
    },
    "bias": {
        "eValue": {"point": 3.21, "ci": 1.68},
        "sensitivityAnalyses": [
            {"name": "Per-protocol population", "method": "Completer analysis", "result": "OR 4.27 (1.82, 10.02)"},
            {"name": "Worst-case imputation", "method": "NRI (dropouts = non-responders)", "result": "OR 3.14 (1.42, 6.94)"},
            {"name": "Bayesian dose-response model", "method": "Emax model", "result": "ED50 = 45mg, plateau OR ~4.0"}
        ],
        "missingDataStrategy": "NRI (non-responder imputation)",
        "bayesianPrior": {"distribution": "Normal", "location": 0, "scale": 0.8},
        "negativeControls": [{"outcome": "URI incidence", "or": 1.08, "ci_lower": 0.62, "ci_upper": 1.88}]
    },
    "reproducibility": {
        "manifest": [
            {"name": "MRD100_primary_logistic.R", "type": "code", "hash": "sha256:d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3", "signed": True},
            {"name": "MRD100_dose_response.R", "type": "code", "hash": "sha256:g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6", "signed": True},
            {"name": "MRD100_adam_adrs.xpt", "type": "data", "hash": "sha256:j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9", "signed": False}
        ],
        "dockerImage": "afarensis/mrd100:v0.5.1",
        "renvVersion": "1.0.7",
        "packages": [
            {"name": "brms", "version": "2.21.0"},
            {"name": "DoseFinding", "version": "1.1-1"},
            {"name": "emmeans", "version": "1.10.0"},
            {"name": "ggplot2", "version": "3.5.0"}
        ]
    },
    "regulatory": {
        "submissionAuthority": "FDA",
        "exportFormat": "PDF",
        "sarSections": [
            {"title": "Executive Summary", "status": "not_started"},
            {"title": "Study Design", "status": "draft"},
            {"title": "Statistical Methods", "status": "draft"},
            {"title": "Results", "status": "not_started"},
            {"title": "Dose-Response Analysis", "status": "not_started"},
            {"title": "Safety Summary", "status": "not_started"}
        ],
        "readinessChecks": [
            {"label": "Primary analysis complete", "passed": False},
            {"label": "Sensitivity analyses complete", "passed": False},
            {"label": "Bias assessment complete", "passed": False},
            {"label": "All artifacts signed", "passed": False}
        ]
    }
}

# ─── Map project IDs to their seed data ───────────────────────────────────
PROJECTS = {
    "4edcda4f-68e4-4ae2-acd6-2ade4cf4bedf": ("XY-301", xy301),
    "8715d591-ce66-41f1-a8de-df0018f95814": ("CLARITY-AD", clarity_ad),
    "4a59ceb1-d523-44f5-8eab-96f804ed8f3e": ("GLP1-2026", glp1),
    "ed5d2ca8-d6ee-4fe7-82ca-743725709426": ("MRD-100", mrd100),
}

SECTIONS = [
    "study_definition", "covariates", "data_sources", "cohort",
    "balance", "effect_estimation", "bias", "reproducibility", "regulatory"
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for project_id, (label, seed_data) in PROJECTS.items():
        # Read existing config
        cur.execute("SELECT processing_config FROM projects WHERE id = ?", (project_id,))
        row = cur.fetchone()
        if row is None:
            print(f"  [SKIP] Project {label} ({project_id}) not found in DB")
            continue

        existing = json.loads(row[0]) if row[0] else {}

        # Merge: add all sections + meta, preserving existing keys
        for section in SECTIONS:
            existing[section] = seed_data[section]
            existing[f"{section}_meta"] = meta(section)[f"{section}_meta"]

        # Write back
        new_config = json.dumps(existing)
        cur.execute(
            "UPDATE projects SET processing_config = ?, updated_at = datetime('now') WHERE id = ?",
            (new_config, project_id)
        )
        print(f"  [OK] {label}: seeded {len(SECTIONS)} sections + meta (preserved: {[k for k in existing if k not in SECTIONS and not k.endswith('_meta')]})")

    conn.commit()
    conn.close()
    print("\nDone. All 4 projects seeded.")


if __name__ == "__main__":
    main()
