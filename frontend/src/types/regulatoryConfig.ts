/**
 * Regulatory Configuration — Single Source of Truth
 *
 * Every dropdown, selector, and structured field in the platform
 * draws from these definitions. Nothing is hardcoded in components.
 *
 * Aligned with: ICH E9(R1), FDA 21 CFR Part 11, EMA CHMP guidelines
 */

// ── Regulatory Agencies ─────────────────────────────────────────────────

export const REGULATORY_AGENCIES: { value: string; label: string; guidelines: string[] }[] = [
  { value: 'FDA', label: 'FDA (United States)', guidelines: ['21 CFR Part 11', 'ICH E6(R2)', 'ICH E9(R1)', 'FDA RWE Framework'] },
]

// ── Study Phases ────────────────────────────────────────────────────────

export const STUDY_PHASES: { value: string; label: string; description: string }[] = [
  { value: 'Phase 1', label: 'Phase 1', description: 'First-in-human dose escalation, safety/tolerability, PK/PD' },
  { value: 'Phase 1/2', label: 'Phase 1/2', description: 'Dose expansion, preliminary efficacy, proof of concept' },
  { value: 'Phase 2', label: 'Phase 2', description: 'Efficacy and safety in target population, dose-finding' },
  { value: 'Phase 2/3', label: 'Phase 2/3', description: 'Seamless design bridging dose-finding and confirmatory efficacy' },
  { value: 'Phase 3', label: 'Phase 3', description: 'Confirmatory efficacy and safety, pivotal registration study' },
  { value: 'Phase 4 / Post-Marketing', label: 'Phase 4 / Post-Marketing', description: 'Post-approval safety surveillance, effectiveness in routine practice' },
  { value: 'Pre-IND Supportive', label: 'Pre-IND Supportive', description: 'Non-clinical and early clinical data to support Investigational New Drug application' },
  { value: 'NDA/BLA Support', label: 'NDA/BLA Support', description: 'Supplemental real-world evidence supporting New Drug or Biologics License Application' },
]

// ── Endpoint Types ──────────────────────────────────────────────────────

export type EndpointType = 'time-to-event' | 'binary' | 'continuous' | 'rate' | 'composite'

// ── Endpoint Library ────────────────────────────────────────────────────

export const ENDPOINT_LIBRARY: { value: string; label: string; category: string; type: EndpointType }[] = [
  // Survival / Mortality
  { value: 'All-cause mortality', label: 'All-cause mortality', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Overall survival (OS)', label: 'Overall survival (OS)', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Progression-free survival (PFS)', label: 'Progression-free survival (PFS)', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Disease-free survival (DFS)', label: 'Disease-free survival (DFS)', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Event-free survival (EFS)', label: 'Event-free survival (EFS)', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Relapse-free survival (RFS)', label: 'Relapse-free survival (RFS)', category: 'Survival/Mortality', type: 'time-to-event' },
  { value: 'Time to death', label: 'Time to death', category: 'Survival/Mortality', type: 'time-to-event' },

  // Cardiovascular
  { value: 'Major adverse cardiovascular event (MACE)', label: 'Major adverse cardiovascular event (MACE)', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'All-cause hospitalization', label: 'All-cause hospitalization', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'Cardiovascular death', label: 'Cardiovascular death', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'Heart failure hospitalization', label: 'Heart failure hospitalization', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'Myocardial infarction', label: 'Myocardial infarction', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'Stroke', label: 'Stroke', category: 'Cardiovascular', type: 'time-to-event' },
  { value: 'Time to first cardiovascular event', label: 'Time to first cardiovascular event', category: 'Cardiovascular', type: 'time-to-event' },

  // Oncology
  { value: 'Objective response rate (ORR)', label: 'Objective response rate (ORR)', category: 'Oncology', type: 'binary' },
  { value: 'Complete response rate (CR)', label: 'Complete response rate (CR)', category: 'Oncology', type: 'binary' },
  { value: 'Partial response rate (PR)', label: 'Partial response rate (PR)', category: 'Oncology', type: 'binary' },
  { value: 'Duration of response (DOR)', label: 'Duration of response (DOR)', category: 'Oncology', type: 'time-to-event' },
  { value: 'Time to progression (TTP)', label: 'Time to progression (TTP)', category: 'Oncology', type: 'time-to-event' },
  { value: 'Disease control rate (DCR)', label: 'Disease control rate (DCR)', category: 'Oncology', type: 'binary' },
  { value: 'Minimal residual disease (MRD) negativity', label: 'Minimal residual disease (MRD) negativity', category: 'Oncology', type: 'binary' },
  { value: 'Pathologic complete response (pCR)', label: 'Pathologic complete response (pCR)', category: 'Oncology', type: 'binary' },

  // Neurological
  { value: 'Cognitive decline composite', label: 'Cognitive decline composite', category: 'Neurological', type: 'composite' },
  { value: 'Change in MMSE score', label: 'Change in MMSE score', category: 'Neurological', type: 'continuous' },
  { value: 'Change in ADAS-Cog score', label: 'Change in ADAS-Cog score', category: 'Neurological', type: 'continuous' },
  { value: 'Disability progression (EDSS)', label: 'Disability progression (EDSS)', category: 'Neurological', type: 'continuous' },
  { value: 'Annualized relapse rate', label: 'Annualized relapse rate', category: 'Neurological', type: 'rate' },

  // Respiratory
  { value: 'Change in FEV1', label: 'Change in FEV1', category: 'Respiratory', type: 'continuous' },
  { value: 'Pulmonary exacerbation rate', label: 'Pulmonary exacerbation rate', category: 'Respiratory', type: 'rate' },
  { value: 'Six-minute walk distance (6MWD)', label: 'Six-minute walk distance (6MWD)', category: 'Respiratory', type: 'continuous' },

  // Renal
  { value: 'Change in eGFR', label: 'Change in eGFR', category: 'Renal', type: 'continuous' },
  { value: 'Time to kidney failure', label: 'Time to kidney failure', category: 'Renal', type: 'time-to-event' },
  { value: 'Composite renal endpoint', label: 'Composite renal endpoint', category: 'Renal', type: 'composite' },

  // Metabolic
  { value: 'Change in HbA1c', label: 'Change in HbA1c', category: 'Metabolic', type: 'continuous' },
  { value: 'Fasting plasma glucose', label: 'Fasting plasma glucose', category: 'Metabolic', type: 'continuous' },
  { value: 'Body weight change', label: 'Body weight change', category: 'Metabolic', type: 'continuous' },

  // Functional / QoL
  { value: 'Functional independence (ADL score)', label: 'Functional independence (ADL score)', category: 'Functional/QoL', type: 'continuous' },
  { value: 'Change in quality of life (QoL)', label: 'Change in quality of life (QoL)', category: 'Functional/QoL', type: 'continuous' },
  { value: 'Patient-reported outcome (PRO)', label: 'Patient-reported outcome (PRO)', category: 'Functional/QoL', type: 'continuous' },
  { value: 'Pain reduction (VAS/NRS)', label: 'Pain reduction (VAS/NRS)', category: 'Functional/QoL', type: 'continuous' },

  // Imaging / Biomarkers
  { value: 'Disease progression (imaging)', label: 'Disease progression (imaging)', category: 'Imaging/Biomarkers', type: 'binary' },
  { value: 'Change in biomarker level', label: 'Change in biomarker level', category: 'Imaging/Biomarkers', type: 'continuous' },
  { value: 'Radiographic response', label: 'Radiographic response', category: 'Imaging/Biomarkers', type: 'binary' },

  // Safety
  { value: 'Incidence of treatment-emergent adverse events (TEAEs)', label: 'Incidence of treatment-emergent adverse events (TEAEs)', category: 'Safety', type: 'rate' },
  { value: 'Serious adverse event rate', label: 'Serious adverse event rate', category: 'Safety', type: 'rate' },
  { value: 'Dose-limiting toxicity (DLT)', label: 'Dose-limiting toxicity (DLT)', category: 'Safety', type: 'binary' },

  // Infectious Disease
  { value: 'Viral load reduction', label: 'Viral load reduction', category: 'Infectious Disease', type: 'continuous' },
  { value: 'Sustained virologic response (SVR)', label: 'Sustained virologic response (SVR)', category: 'Infectious Disease', type: 'binary' },
  { value: 'Time to clinical improvement', label: 'Time to clinical improvement', category: 'Infectious Disease', type: 'time-to-event' },

  // Hematology
  { value: 'Transfusion independence', label: 'Transfusion independence', category: 'Hematology', type: 'binary' },
  { value: 'Hemoglobin response', label: 'Hemoglobin response', category: 'Hematology', type: 'binary' },

  // Other
  { value: 'Composite primary endpoint', label: 'Composite primary endpoint', category: 'Other', type: 'composite' },
  { value: 'Time to treatment failure', label: 'Time to treatment failure', category: 'Other', type: 'time-to-event' },
  { value: 'Custom endpoint', label: 'Custom endpoint', category: 'Other', type: 'time-to-event' },
]

// ── Analysis Methods by Endpoint Type ───────────────────────────────────

export const ANALYSIS_METHODS: Record<EndpointType, { value: string; label: string }[]> = {
  'time-to-event': [
    { value: 'cox_ph', label: 'Cox Proportional Hazards' },
    { value: 'km', label: 'Kaplan-Meier / Log-rank' },
    { value: 'aft', label: 'Accelerated Failure Time (AFT)' },
    { value: 'rmst', label: 'Restricted Mean Survival Time (RMST)' },
    { value: 'fine_gray', label: 'Fine-Gray Competing Risks' },
  ],
  'binary': [
    { value: 'logistic', label: 'Logistic Regression' },
    { value: 'modified_poisson', label: 'Modified Poisson (Risk Ratio)' },
    { value: 'cmh', label: 'Cochran-Mantel-Haenszel' },
    { value: 'exact', label: "Fisher's Exact / Chi-square" },
    { value: 'gee_binomial', label: 'GEE (Binomial)' },
  ],
  'continuous': [
    { value: 'ancova', label: 'ANCOVA' },
    { value: 'mmrm', label: 'Mixed Model for Repeated Measures (MMRM)' },
    { value: 'lmm', label: 'Linear Mixed Effects Model' },
    { value: 'rank', label: 'Wilcoxon Rank-Sum / Mann-Whitney' },
    { value: 'gee_gaussian', label: 'GEE (Gaussian)' },
  ],
  'rate': [
    { value: 'neg_binom', label: 'Negative Binomial Regression' },
    { value: 'poisson', label: 'Poisson Regression' },
    { value: 'quasi_poisson', label: 'Quasi-Poisson Regression' },
    { value: 'zero_inflated', label: 'Zero-Inflated Model' },
  ],
  'composite': [
    { value: 'cox_ph', label: 'Cox PH (Time to First Component)' },
    { value: 'logistic', label: 'Logistic Regression (Any Component)' },
    { value: 'win_ratio', label: 'Win Ratio / Finkelstein-Schoenfeld' },
    { value: 'gee_binomial', label: 'GEE (Binomial)' },
  ],
}

// ── Weighting Methods ───────────────────────────────────────────────────

export const WEIGHTING_METHODS: { value: string; label: string }[] = [
  { value: 'iptw', label: 'IPTW (Inverse Probability of Treatment Weighting)' },
  { value: 'iptw_stabilized', label: 'IPTW — Stabilized Weights' },
  { value: 'overlap', label: 'Overlap Weights (ATO)' },
  { value: 'matching', label: 'Propensity Score Matching' },
  { value: 'stratification', label: 'PS Stratification (Subclassification)' },
  { value: 'entropy', label: 'Entropy Balancing' },
  { value: 'none', label: 'No Weighting (Regression Adjustment Only)' },
]

// ── Variance Estimators ─────────────────────────────────────────────────

export const VARIANCE_ESTIMATORS: { value: string; label: string }[] = [
  { value: 'robust', label: 'Robust (Sandwich) SE' },
  { value: 'bootstrap', label: 'Bootstrap (Non-parametric)' },
  { value: 'model_based', label: 'Model-Based SE' },
  { value: 'jackknife', label: 'Jackknife' },
]

// ── PS Trimming Options ─────────────────────────────────────────────────

export const TRIMMING_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No Trimming' },
  { value: '1_99', label: '1st – 99th Percentile' },
  { value: '2.5_97.5', label: '2.5th – 97.5th Percentile' },
  { value: '5_95', label: '5th – 95th Percentile' },
  { value: 'crump', label: 'Crump Optimal Trimming' },
  { value: 'custom', label: 'Custom Range' },
]

// ── Comparator Types ────────────────────────────────────────────────────

export const COMPARATOR_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'External comparator (real-world control)', label: 'External comparator (real-world control)', description: 'Real-world data from EHR, claims, or registries used as the control arm' },
  { value: 'Active comparator (head-to-head)', label: 'Active comparator (head-to-head)', description: 'Randomized or non-randomized comparison against an active therapy' },
  { value: 'Placebo / untreated', label: 'Placebo / untreated', description: 'Placebo-controlled or untreated observation arm' },
  { value: 'Synthetic control arm', label: 'Synthetic control arm', description: 'Computationally constructed control from multiple data sources' },
  { value: 'Historical control', label: 'Historical control', description: 'Published literature or historical cohort data as comparator' },
  { value: 'Best available therapy', label: 'Best available therapy', description: 'Standard of care as determined by investigator or guidelines' },
]

// ── Estimand Options (ICH E9(R1)) ───────────────────────────────────────

export const ESTIMAND_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'ATT', label: 'ATT — Average Treatment Effect on the Treated', desc: 'Effect among those who received treatment in the real-world setting' },
  { value: 'ATE', label: 'ATE — Average Treatment Effect', desc: 'Effect averaged over the entire eligible population' },
  { value: 'ITT', label: 'ITT — Intention to Treat', desc: 'Effect of treatment assignment regardless of adherence' },
  { value: 'PP', label: 'PP — Per Protocol', desc: 'Effect among patients who adhered to assigned treatment' },
]

// ── ICE Strategy Options (ICH E9(R1)) ───────────────────────────────────

export const ICE_STRATEGY_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'treatment_policy', label: 'Treatment Policy', desc: 'Analyze regardless of what happened after the ICE' },
  { value: 'composite', label: 'Composite', desc: 'ICE is incorporated as part of the endpoint definition' },
  { value: 'hypothetical', label: 'Hypothetical', desc: 'Estimate what would have happened if the ICE had not occurred' },
  { value: 'principal_stratum', label: 'Principal Stratum', desc: 'Effect in subgroup defined by post-randomization behavior' },
  { value: 'while_on_treatment', label: 'While on Treatment', desc: 'Outcome measured only while on assigned treatment' },
]

// ── ICE Event Presets ───────────────────────────────────────────────────

export const ICE_EVENT_PRESETS: string[] = [
  'Treatment discontinuation',
  'Death (non-endpoint)',
  'Switch to rescue therapy',
  'Use of prohibited concomitant medication',
  'Loss to follow-up',
  'Protocol deviation',
]

// ── Missing Data Methods — Primary ──────────────────────────────────────

export const MISSING_DATA_PRIMARY: { value: string; label: string }[] = [
  { value: 'complete_case', label: 'Complete Case Analysis' },
  { value: 'mice', label: 'Multiple Imputation (MICE)' },
  { value: 'mmrm', label: 'MMRM (Implicit Imputation)' },
  { value: 'locf', label: 'Last Observation Carried Forward (LOCF)' },
  { value: 'mi_rubin', label: "Multiple Imputation (Rubin's Rules)" },
]

// ── Missing Data Methods — Sensitivity ──────────────────────────────────

export const MISSING_DATA_SENSITIVITY: { value: string; label: string }[] = [
  { value: 'mice', label: 'Multiple Imputation (MICE)' },
  { value: 'tipping_point', label: 'Tipping Point Analysis' },
  { value: 'pattern_mixture', label: 'Pattern Mixture Model' },
  { value: 'delta_adjustment', label: 'Delta-Adjustment' },
  { value: 'worst_case', label: 'Worst-Case Imputation' },
  { value: 'complete_case', label: 'Complete Case Analysis' },
]

// ── Scientific Rationale Constraint ─────────────────────────────────────

export const SCIENTIFIC_RATIONALE_MAX_CHARS = 2000

// ── Software Options ────────────────────────────────────────────────────

export const SOFTWARE_OPTIONS: { value: string; label: string }[] = [
  { value: 'r', label: 'R (survival, MatchIt, cobalt)' },
  { value: 'sas', label: 'SAS (PROC PHREG)' },
  { value: 'python', label: 'Python (lifelines, causalinference)' },
  { value: 'stata', label: 'Stata (teffects)' },
]

// ── Covariate Roles ─────────────────────────────────────────────────────

export const COVARIATE_ROLES: { value: string; label: string }[] = [
  { value: 'confounder', label: 'Confounder' },
  { value: 'effect_modifier', label: 'Effect modifier' },
  { value: 'precision', label: 'Precision variable' },
  { value: 'instrument', label: 'Instrumental variable' },
]

// ── Helper: Classify Endpoint ───────────────────────────────────────────

export function classifyEndpoint(ep: string): EndpointType {
  const lower = ep.toLowerCase()
  // Time-to-event
  if (/\b(survival|time to|duration of|event-free|relapse-free|disease-free|progression-free|time-to)\b/i.test(lower)) return 'time-to-event'
  if (/\b(mortality|death|hospitalization|mace|kidney failure|treatment failure)\b/i.test(lower)) return 'time-to-event'
  // Rate endpoints
  if (/\b(rate|annualized|exacerbation rate|relapse rate)\b/i.test(lower)) return 'rate'
  // Binary
  if (/\b(response rate|ORR|CR\b|PR\b|DCR|SVR|pCR|MRD|negativity|independence|transfusion|DLT)\b/i.test(lower)) return 'binary'
  // Continuous
  if (/\b(change in|reduction|fev1|egfr|hba1c|mmse|adas|edss|walk distance|body weight|glucose|biomarker|quality of life|QoL|PRO|pain|VAS|NRS|ADL)\b/i.test(lower)) return 'continuous'
  // Composite
  if (/\b(composite)\b/i.test(lower)) return 'composite'
  // Imaging
  if (/\b(imaging|radiographic)\b/i.test(lower)) return 'binary'
  // Safety
  if (/\b(adverse event|TEAE|serious adverse)\b/i.test(lower)) return 'rate'
  return 'time-to-event' // default
}

// ── Helper: Estimand Warning ────────────────────────────────────────────

export function getEstimandWarning(estimand: string, comparator: string): string | null {
  if (estimand === 'ITT' && comparator.includes('External'))
    return 'ITT is designed for randomized designs. With an external comparator, ATT or ATE is typically more appropriate.'
  if (estimand === 'PP' && comparator.includes('External'))
    return 'Per-Protocol with external comparator requires careful definition of adherence in both arms. Consider ATT.'
  if (estimand === 'ATE' && comparator.includes('Synthetic'))
    return 'ATE with synthetic control requires strong exchangeability assumptions across the full population.'
  return null
}

// ── Helper: Method Warning ──────────────────────────────────────────────

export function getMethodWarning(method: string, weighting: string, endpointType: EndpointType): string | null {
  if (method === 'cox_ph' && weighting === 'none')
    return 'Cox PH without PS weighting assumes no unmeasured confounding. Consider adding propensity score adjustment.'
  if (method === 'mmrm' && weighting !== 'none')
    return 'MMRM with PS weighting is complex. Ensure proper variance estimation accounts for both the PS and repeated measures.'
  if (endpointType === 'binary' && weighting === 'matching')
    return 'PS matching with binary outcomes may discard many observations. Weighting (IPTW/overlap) preserves the full sample.'
  return null
}
