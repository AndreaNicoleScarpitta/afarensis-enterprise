"""
Clinical trial workflow step dependency graph.
Defines which upstream steps invalidate which downstream steps
when their data changes — informed by biostatistical best practices.
"""

SECTION_KEYS = [
    "definition", "covariates", "data_sources", "cohort",
    "balance", "effect_estimation", "bias", "reproducibility",
    "audit", "regulatory",
]

STEP_DEPENDENCIES = {
    "definition": [],
    "covariates": ["definition"],
    "data_sources": ["definition", "covariates"],
    "cohort": ["definition", "covariates", "data_sources"],
    "balance": ["definition", "covariates", "cohort"],
    "effect_estimation": ["definition", "covariates", "data_sources", "cohort", "balance"],
    "bias": ["definition", "covariates", "cohort", "balance", "effect_estimation"],
    "reproducibility": ["data_sources", "cohort"],
    "audit": [],
    "regulatory": ["definition", "effect_estimation", "bias", "reproducibility", "audit"],
}

# Human-readable labels for each step
STEP_LABELS = {
    "definition": "Study Definition",
    "covariates": "Causal Framework",
    "data_sources": "Data Provenance",
    "cohort": "Cohort Construction",
    "balance": "Comparability & Balance",
    "effect_estimation": "Effect Estimation",
    "bias": "Bias & Sensitivity",
    "reproducibility": "Reproducibility",
    "audit": "Audit Trail",
    "regulatory": "Regulatory Output",
}

# Biostatistical impact descriptions when each step changes
IMPACT_DESCRIPTIONS = {
    "definition": {
        "covariates": "Endpoint or estimand change may invalidate the causal DAG structure and confounder identification.",
        "data_sources": "Endpoint change may require different SDTM/ADaM domains and variable sourcing.",
        "cohort": "Design or comparator changes invalidate inclusion/exclusion criteria and the attrition funnel.",
        "balance": "Estimand change (ATT vs ATE) changes the target population for balance assessment.",
        "effect_estimation": "Endpoint type change may make the current analysis method inappropriate (e.g., Cox PH for binary endpoint).",
        "bias": "E-value and sensitivity calculations are specific to the effect estimate and endpoint type.",
        "regulatory": "SAR/SAP narrative references the estimand, endpoint, and design throughout.",
    },
    "covariates": {
        "data_sources": "Adding/removing covariates changes which variables must be captured in the data.",
        "cohort": "DAG-identified confounders determine propensity score model variables.",
        "balance": "The covariate set for balance assessment comes directly from the DAG.",
        "effect_estimation": "Unmeasured confounders affect sensitivity specifications and model adjustment.",
        "bias": "E-value interpretation depends on measured vs. unmeasured confounder sets.",
    },
    "data_sources": {
        "cohort": "Data source changes may alter available patient populations and sample sizes.",
        "balance": "Different data sources affect variable availability for balance covariates.",
        "effect_estimation": "Input dataset change means all analytic results are stale.",
        "reproducibility": "Reproducibility manifest references specific data source hashes.",
    },
    "cohort": {
        "balance": "Any change to inclusion/exclusion criteria changes the analytic cohort; all propensity scores and SMDs must be recomputed.",
        "effect_estimation": "A different cohort produces different effect estimates.",
        "bias": "Sensitivity analyses referencing the primary cohort are invalid.",
        "reproducibility": "Code manifest references the cohort construction script.",
    },
    "balance": {
        "effect_estimation": "If propensity score weights changed, the weighted analysis must be re-run.",
        "bias": "Residual imbalance feeds directly into bias quantification (E-value, negative controls).",
    },
    "effect_estimation": {
        "bias": "Sensitivity analyses are robustness checks of the primary estimate; if the primary changes, all sensitivities are stale.",
        "regulatory": "Forest plot data, primary HR/OR/RR, and confidence intervals flow into the regulatory narrative.",
    },
    "bias": {
        "regulatory": "Bias quantification and sensitivity findings are required sections in regulatory submissions.",
    },
    "reproducibility": {
        "regulatory": "Reproducibility manifest and hashes are referenced in the submission package.",
    },
    "audit": {
        "regulatory": "Audit completeness is a regulatory readiness requirement.",
    },
}
