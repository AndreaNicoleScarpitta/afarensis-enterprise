import React, { createContext, useContext, useEffect, useState } from 'react'
import type {
  DataSource,
  DatasetVersion,
  CohortVersion,
  VariableDefinition,
  AnalysisRun,
  AuditEvent,
  LineageGraph,
  LineageNode,
  LineageEdge,
} from '../types/lineage'

// ─── Context Shape ───────────────────────────────────────────────────────────

interface LineageState {
  dataSources: DataSource[]
  datasetVersions: DatasetVersion[]
  cohortVersions: CohortVersion[]
  variableDefinitions: VariableDefinition[]
  analysisRuns: AnalysisRun[]
  auditEvents: AuditEvent[]
  lineageGraph: LineageGraph
  /** True when the context is populated with built-in demo data rather than
   *  data loaded from the backend API. UI components should show a visible
   *  "Sample Data" indicator when this is true. */
  isDemoData: boolean
  getLineageForResult: (resultId: string) => LineageNode[]
  getAuditTrail: (objectId: string) => AuditEvent[]
  getCohortHistory: (cohortId: string) => CohortVersion[]
  getVariableChain: (varId: string) => VariableDefinition[]
}

const LineageContext = createContext<LineageState | null>(null)

const STORAGE_KEY = 'afarensis-lineage-store'

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_DATA_SOURCES: DataSource[] = [
  {
    id: 'ds-edc-001',
    name: 'XY-301 EDC (Medidata Rave)',
    type: 'edc',
    owner: 'Asclepius Therapeutics',
    contractId: 'CTR-2024-0471',
    coverageStart: '2024-03-01',
    coverageEnd: '2026-01-15',
    refreshPolicy: 'Nightly incremental via SFTP; full refresh every 14 days',
    codingSystem: 'MedDRA',
    codingVersion: '26.1',
    description: 'Electronic data capture for XY-301 Phase 2/3 pediatric rare CNS disorder trial. Contains demographics, vitals, lab panels, AE/conmeds, efficacy endpoints (BSID-III, CGI-S), and disposition.',
    createdAt: '2024-02-15T10:00:00Z',
    createdBy: 'Sarah Chen',
  },
  {
    id: 'ds-ehr-002',
    name: 'PedNeuro Claims & EHR Linkage',
    type: 'ehr',
    owner: 'National Pediatric Health Network',
    contractId: 'DUA-2024-0892',
    coverageStart: '2018-01-01',
    coverageEnd: '2025-12-31',
    refreshPolicy: 'Quarterly refresh; 90-day claims run-out lag',
    codingSystem: 'ICD-10-CM / CPT',
    codingVersion: 'FY2025',
    description: 'De-identified pediatric neurology claims linked to structured EHR data from 42 academic medical centers. Provides baseline comorbidity, healthcare utilization, and historical treatment patterns for external comparator arm.',
    createdAt: '2024-04-01T08:30:00Z',
    createdBy: 'James Okafor',
  },
  {
    id: 'ds-reg-003',
    name: 'ICORD Rare Disease Registry',
    type: 'registry',
    owner: 'International Consortium for Rare Diseases',
    contractId: 'REG-2024-0215',
    coverageStart: '2015-06-01',
    coverageEnd: '2025-09-30',
    refreshPolicy: 'Semi-annual snapshot; manual data quality review before ingestion',
    codingSystem: 'SNOMED CT',
    codingVersion: '2024-09-01',
    description: 'Natural history registry for rare pediatric CNS conditions. Longitudinal data on 1,847 patients across 12 countries. Provides disease progression benchmarks, genotype-phenotype correlations, and long-term outcome trajectories.',
    createdAt: '2024-05-10T14:00:00Z',
    createdBy: 'Maria Santos',
  },
]

const DEMO_DATASET_VERSIONS: DatasetVersion[] = [
  {
    id: 'dv-edc-v1',
    dataSourceId: 'ds-edc-001',
    version: 1,
    createdAt: '2025-08-01T06:00:00Z',
    createdBy: 'ETL Pipeline v4.2',
    sourceSnapshotId: 'snap-edc-20250801',
    rowCount: 14829,
    columnCount: 187,
    schemaHash: 'sha256:3f8a91d7e4b2c06f5a1e8d93b7c42f1a',
    contentHash: 'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    retentionClass: 'study_lifecycle',
    lockStatus: 'locked',
    lockedAt: '2025-08-15T09:00:00Z',
    lockedBy: 'Sarah Chen',
    fields: [
      { name: 'SUBJID', type: 'text', description: 'Unique subject identifier', missingnessRate: 0.0, distinctValues: 312 },
      { name: 'AGE_MONTHS', type: 'numeric', units: 'months', description: 'Age at enrollment in months', missingnessRate: 0.0, distinctValues: 84, plausibilityMin: 6, plausibilityMax: 180 },
      { name: 'SEX', type: 'categorical', description: 'Biological sex', missingnessRate: 0.0, distinctValues: 2, codeSystem: 'HL7 AdministrativeGender' },
      { name: 'BSID_III_MOTOR', type: 'numeric', description: 'Bayley-III Motor Composite Score at baseline', missingnessRate: 0.034, distinctValues: 67, plausibilityMin: 40, plausibilityMax: 160 },
      { name: 'BSID_III_COG', type: 'numeric', description: 'Bayley-III Cognitive Composite Score at baseline', missingnessRate: 0.028, distinctValues: 72, plausibilityMin: 40, plausibilityMax: 160 },
      { name: 'CGI_S_BL', type: 'numeric', description: 'CGI-Severity at baseline', missingnessRate: 0.006, distinctValues: 7, plausibilityMin: 1, plausibilityMax: 7 },
      { name: 'TRTA', type: 'categorical', description: 'Actual treatment arm', missingnessRate: 0.0, distinctValues: 2 },
      { name: 'GENOTYPE', type: 'categorical', description: 'Disease-causing genotype classification', missingnessRate: 0.045, distinctValues: 8, codeSystem: 'HGNC' },
      { name: 'ONSET_AGE', type: 'numeric', units: 'months', description: 'Age at symptom onset', missingnessRate: 0.071, distinctValues: 48, plausibilityMin: 0, plausibilityMax: 120 },
      { name: 'SEIZURE_HX', type: 'boolean', description: 'History of seizures at enrollment', missingnessRate: 0.013, distinctValues: 2 },
      { name: 'PRIOR_THERAPY', type: 'categorical', description: 'Prior disease-modifying therapy received', missingnessRate: 0.019, distinctValues: 5 },
      { name: 'WEIGHT_KG', type: 'numeric', units: 'kg', description: 'Body weight at baseline', missingnessRate: 0.009, distinctValues: 245, plausibilityMin: 3, plausibilityMax: 80 },
      { name: 'AE_SERIOUS', type: 'boolean', description: 'Serious adverse event flag', missingnessRate: 0.0, distinctValues: 2 },
    ],
  },
  {
    id: 'dv-claims-v1',
    dataSourceId: 'ds-ehr-002',
    version: 1,
    createdAt: '2025-07-15T12:00:00Z',
    createdBy: 'ETL Pipeline v4.2',
    sourceSnapshotId: 'snap-claims-20250715',
    rowCount: 287491,
    columnCount: 94,
    schemaHash: 'sha256:7c1e4f8b2d9a03e6f5b8c1d4a7e0f3b6',
    contentHash: 'sha256:d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    retentionClass: 'study_lifecycle',
    lockStatus: 'locked',
    lockedAt: '2025-07-20T14:00:00Z',
    lockedBy: 'James Okafor',
    fields: [
      { name: 'PAT_ID', type: 'text', description: 'De-identified patient token', missingnessRate: 0.0, distinctValues: 4218 },
      { name: 'DX_PRIMARY', type: 'categorical', description: 'Primary diagnosis code', missingnessRate: 0.003, distinctValues: 847, codeSystem: 'ICD-10-CM', codeVersion: 'FY2025' },
      { name: 'DX_DATE', type: 'date', description: 'Diagnosis encounter date', missingnessRate: 0.0, distinctValues: 2814 },
      { name: 'PROC_CODE', type: 'categorical', description: 'Procedure code', missingnessRate: 0.12, distinctValues: 312, codeSystem: 'CPT' },
      { name: 'RX_NDC', type: 'categorical', description: 'National Drug Code for dispensed medication', missingnessRate: 0.08, distinctValues: 489, codeSystem: 'NDC' },
      { name: 'DAYS_SUPPLY', type: 'numeric', units: 'days', description: 'Days supply for dispensed medication', missingnessRate: 0.09, distinctValues: 42, plausibilityMin: 1, plausibilityMax: 365 },
      { name: 'ENROLL_START', type: 'date', description: 'Enrollment period start date', missingnessRate: 0.0, distinctValues: 1987 },
      { name: 'ENROLL_END', type: 'date', description: 'Enrollment period end date', missingnessRate: 0.015, distinctValues: 1432 },
      { name: 'NEURO_VISIT_CT', type: 'numeric', description: 'Neurology visit count in baseline period', missingnessRate: 0.0, distinctValues: 28, plausibilityMin: 0, plausibilityMax: 52 },
      { name: 'ER_ADMIT_FLAG', type: 'boolean', description: 'ER admission during observation window', missingnessRate: 0.0, distinctValues: 2 },
      { name: 'LAB_AVAIL', type: 'boolean', description: 'Linked lab results available', missingnessRate: 0.0, distinctValues: 2 },
      { name: 'REGION', type: 'categorical', description: 'Geographic region (census division)', missingnessRate: 0.022, distinctValues: 9 },
    ],
  },
]

const DEMO_COHORT_VERSIONS: CohortVersion[] = [
  {
    id: 'cv-001',
    cohortId: 'cohort-xy301-primary',
    version: 1,
    narrativeIntent: 'Pediatric patients aged 6 months to 15 years with confirmed rare CNS disorder diagnosis, enrolled in XY-301 or matched from the external comparator (PedNeuro claims) based on pre-specified eligibility criteria.',
    rules: [
      { id: 'cr-001', order: 1, type: 'inclusion', description: 'Age 6 months to 15 years at index date', codeExpression: 'AGE_MONTHS >= 6 AND AGE_MONTHS <= 180', variableRefs: ['vd-age'] },
      { id: 'cr-002', order: 2, type: 'inclusion', description: 'Confirmed diagnosis of target CNS disorder (ICD-10 G31.81 or G31.89 + genetic confirmation)', codeExpression: "DX_PRIMARY IN ('G31.81', 'G31.89') AND GENOTYPE IS NOT NULL", variableRefs: ['vd-dx', 'vd-genotype'] },
      { id: 'cr-003', order: 3, type: 'inclusion', description: 'Minimum 6-month continuous enrollment/observation pre-index', codeExpression: 'DATEDIFF(INDEX_DATE, ENROLL_START) >= 180', variableRefs: ['vd-enrollment'] },
      { id: 'cr-004', order: 4, type: 'exclusion', description: 'Exclude patients with prior gene therapy or experimental CNS treatment', codeExpression: "PRIOR_THERAPY NOT IN ('gene_therapy', 'experimental_cns')", variableRefs: ['vd-prior-tx'] },
      { id: 'cr-005', order: 5, type: 'exclusion', description: 'Exclude patients with severe comorbid neurodegenerative condition unrelated to target disorder', codeExpression: "COMORBID_NEURODEGEN = FALSE", variableRefs: ['vd-comorbid'] },
    ],
    indexDateRule: 'First dose date (trial arm) or matched diagnosis confirmation date (external comparator)',
    timeWindows: [
      { name: 'Baseline', relativeTo: 'index_date', startOffset: -180, endOffset: 0, units: 'days' },
      { name: 'Treatment/Follow-up', relativeTo: 'index_date', startOffset: 0, endOffset: 365, units: 'days' },
      { name: 'Extended Follow-up', relativeTo: 'index_date', startOffset: 365, endOffset: 730, units: 'days' },
    ],
    attritionSteps: [
      { stepId: 'as-001', ruleId: 'cr-001', description: 'Age 6 months to 15 years', countBefore: 4530, countAfter: 3812, countExcluded: 718, reason: 'Outside pediatric age range' },
      { stepId: 'as-002', ruleId: 'cr-002', description: 'Confirmed CNS disorder diagnosis', countBefore: 3812, countAfter: 1247, countExcluded: 2565, reason: 'No confirmed diagnosis or missing genetic confirmation' },
      { stepId: 'as-003', ruleId: 'cr-003', description: '6-month continuous enrollment', countBefore: 1247, countAfter: 984, countExcluded: 263, reason: 'Insufficient continuous enrollment/observation' },
      { stepId: 'as-004', ruleId: 'cr-004', description: 'No prior gene therapy', countBefore: 984, countAfter: 941, countExcluded: 43, reason: 'Prior gene therapy or experimental CNS treatment' },
      { stepId: 'as-005', ruleId: 'cr-005', description: 'No severe comorbid neurodegeneration', countBefore: 941, countAfter: 897, countExcluded: 44, reason: 'Comorbid neurodegenerative condition present' },
    ],
    createdAt: '2025-08-20T10:00:00Z',
    createdBy: 'Sarah Chen',
    lockStatus: 'locked',
    lockedSignature: 'sha256:9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
    lockedAt: '2025-09-01T08:30:00Z',
    lockedBy: 'Dr. Elena Vasquez',
  },
]

const DEMO_VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    id: 'vd-age',
    varId: 'AGE_MONTHS',
    label: 'Age at Index (Months)',
    conceptualDefinition: 'Chronological age of the patient in completed months at the index date.',
    operationalDefinition: 'Calculated as DATEDIFF(months, DATE_OF_BIRTH, INDEX_DATE). For EDC source, derived from BRTHDTC. For claims, derived from YEAR_OF_BIRTH (mid-year imputation).',
    units: 'months',
    timeWindow: 'At index date',
    derivationSteps: [
      { order: 1, description: 'Extract birth date from EDC or birth year from claims', inputs: ['BRTHDTC', 'YEAR_OF_BIRTH'], outputs: ['DOB_DERIVED'], function: 'date_extraction', parameters: { imputationRule: 'mid-year for claims' } },
      { order: 2, description: 'Calculate age in months', inputs: ['DOB_DERIVED', 'INDEX_DATE'], outputs: ['AGE_MONTHS'], function: 'datediff_months', parameters: {} },
    ],
    validationRefs: ['FDA Pediatric Study Guidance §3.2', 'ICH E11(R1)'],
    version: 1,
    createdAt: '2025-07-01T09:00:00Z',
    createdBy: 'Sarah Chen',
    lockStatus: 'locked',
  },
  {
    id: 'vd-dx',
    varId: 'DX_CONFIRMED',
    label: 'Confirmed Diagnosis Flag',
    conceptualDefinition: 'Binary indicator that the patient has a confirmed diagnosis of the target rare CNS disorder based on clinical and genetic criteria.',
    operationalDefinition: 'Requires at least 2 ICD-10 codes (G31.81 or G31.89) on distinct dates AND a documented pathogenic genotype from genetic testing panel.',
    derivationSteps: [
      { order: 1, description: 'Identify qualifying ICD-10 codes', inputs: ['DX_PRIMARY', 'DX_DATE'], outputs: ['DX_QUALIFYING_DATES'], function: 'code_filter', parameters: { codes: ['G31.81', 'G31.89'], minDistinctDates: 2 } },
      { order: 2, description: 'Confirm genetic panel result', inputs: ['GENOTYPE'], outputs: ['GENETIC_CONFIRMED'], function: 'not_null_check', parameters: {} },
      { order: 3, description: 'Combine clinical and genetic criteria', inputs: ['DX_QUALIFYING_DATES', 'GENETIC_CONFIRMED'], outputs: ['DX_CONFIRMED'], function: 'logical_and', parameters: {} },
    ],
    validationRefs: ['FDA Rare Disease Guidance 2024', 'Orphanet classification'],
    version: 1,
    createdAt: '2025-07-01T09:30:00Z',
    createdBy: 'Sarah Chen',
    lockStatus: 'locked',
  },
  {
    id: 'vd-genotype',
    varId: 'GENOTYPE_CLASS',
    label: 'Genotype Classification',
    conceptualDefinition: 'Categorical classification of the disease-causing genetic variant.',
    operationalDefinition: 'Mapped from genetic testing panel results to 8 predefined categories based on variant pathogenicity classification (ACMG criteria).',
    derivationSteps: [
      { order: 1, description: 'Map raw genetic variant to ACMG pathogenicity class', inputs: ['GENOTYPE_RAW'], outputs: ['GENOTYPE_CLASS'], function: 'code_map', parameters: { mappingTable: 'genotype_acmg_map_v2' } },
    ],
    validationRefs: ['ACMG Standards and Guidelines 2015', 'ClinVar'],
    version: 1,
    createdAt: '2025-07-02T08:00:00Z',
    createdBy: 'Dr. Raj Patel',
    lockStatus: 'locked',
  },
  {
    id: 'vd-enrollment',
    varId: 'CONT_ENROLLMENT_DAYS',
    label: 'Continuous Enrollment (Days)',
    conceptualDefinition: 'Duration of uninterrupted healthcare coverage prior to index date.',
    operationalDefinition: 'For EDC patients, set to study enrollment date. For claims, calculated from continuous enrollment segments with ≤30-day gap tolerance.',
    units: 'days',
    timeWindow: 'Pre-index',
    derivationSteps: [
      { order: 1, description: 'Identify enrollment segments', inputs: ['ENROLL_START', 'ENROLL_END'], outputs: ['ENROLLMENT_SEGMENTS'], function: 'segment_identification', parameters: { gapTolerance: 30 } },
      { order: 2, description: 'Calculate continuous days pre-index', inputs: ['ENROLLMENT_SEGMENTS', 'INDEX_DATE'], outputs: ['CONT_ENROLLMENT_DAYS'], function: 'continuous_days_calc', parameters: {} },
    ],
    validationRefs: ['ISPE GPS Guidance ch. 7'],
    version: 1,
    createdAt: '2025-07-02T10:00:00Z',
    createdBy: 'James Okafor',
    lockStatus: 'locked',
  },
  {
    id: 'vd-prior-tx',
    varId: 'PRIOR_THERAPY_FLAG',
    label: 'Prior Disease-Modifying Therapy',
    conceptualDefinition: 'Whether the patient received any disease-modifying treatment before the index date.',
    operationalDefinition: 'Identified via NDC codes for disease-specific therapies or EDC prior medication log. Lookback window: all available pre-index data.',
    derivationSteps: [
      { order: 1, description: 'Scan pharmacy fills and medication logs for target NDC/drug codes', inputs: ['RX_NDC', 'PRIOR_THERAPY'], outputs: ['PRIOR_THERAPY_FLAG'], function: 'any_match', parameters: { codeList: 'cl-prior-dmt-v1' } },
    ],
    validationRefs: [],
    version: 1,
    createdAt: '2025-07-03T09:00:00Z',
    createdBy: 'James Okafor',
    lockStatus: 'locked',
  },
  {
    id: 'vd-comorbid',
    varId: 'COMORBID_NEURODEGEN',
    label: 'Comorbid Neurodegenerative Flag',
    conceptualDefinition: 'Presence of a severe comorbid neurodegenerative condition unrelated to the primary diagnosis.',
    operationalDefinition: 'Any ICD-10 code in G10-G13 or G20-G26 range on ≥2 distinct dates within baseline window, excluding target disorder codes.',
    derivationSteps: [
      { order: 1, description: 'Identify comorbid neurodegeneration codes', inputs: ['DX_PRIMARY', 'DX_DATE'], outputs: ['COMORBID_NEURODEGEN'], function: 'code_filter', parameters: { codeRange: 'G10-G13, G20-G26', excludeCodes: ['G31.81', 'G31.89'], minDistinctDates: 2 } },
    ],
    validationRefs: ['Charlson Comorbidity Index adaptation'],
    version: 1,
    createdAt: '2025-07-03T11:00:00Z',
    createdBy: 'Sarah Chen',
    lockStatus: 'locked',
  },
  {
    id: 'vd-bsid-motor',
    varId: 'BSID_III_MOTOR_CHG',
    label: 'BSID-III Motor Change from Baseline',
    conceptualDefinition: 'Change in Bayley Scales of Infant & Toddler Development III Motor Composite Score from baseline to Week 52.',
    operationalDefinition: 'BSID_III_MOTOR at Week 52 minus BSID_III_MOTOR at baseline. Missing values handled per missing data plan (multiple imputation, m=50).',
    units: 'points',
    timeWindow: 'Baseline to Week 52',
    derivationSteps: [
      { order: 1, description: 'Identify baseline BSID-III Motor score', inputs: ['BSID_III_MOTOR', 'VISIT_WINDOW'], outputs: ['BSID_MOTOR_BL'], function: 'window_filter', parameters: { window: 'Baseline' } },
      { order: 2, description: 'Identify Week 52 BSID-III Motor score', inputs: ['BSID_III_MOTOR', 'VISIT_WINDOW'], outputs: ['BSID_MOTOR_W52'], function: 'window_filter', parameters: { window: 'Week 52' } },
      { order: 3, description: 'Calculate change from baseline', inputs: ['BSID_MOTOR_BL', 'BSID_MOTOR_W52'], outputs: ['BSID_III_MOTOR_CHG'], function: 'subtract', parameters: {} },
    ],
    validationRefs: ['Bayley-III Technical Manual', 'FDA Endpoint Guidance for Pediatric Neurology'],
    version: 1,
    createdAt: '2025-07-05T08:00:00Z',
    createdBy: 'Dr. Elena Vasquez',
    lockStatus: 'locked',
  },
  {
    id: 'vd-ps',
    varId: 'PROPENSITY_SCORE',
    label: 'Propensity Score (Treatment)',
    conceptualDefinition: 'Estimated probability of receiving treatment versus external comparator, conditional on baseline covariates.',
    operationalDefinition: 'Logistic regression of TRTA on: AGE_MONTHS, SEX, GENOTYPE_CLASS, BSID_III_MOTOR (baseline), BSID_III_COG (baseline), CGI_S_BL, SEIZURE_HX, ONSET_AGE, PRIOR_THERAPY_FLAG, REGION.',
    derivationSteps: [
      { order: 1, description: 'Fit logistic regression for treatment assignment', inputs: ['TRTA', 'AGE_MONTHS', 'SEX', 'GENOTYPE_CLASS', 'BSID_III_MOTOR', 'BSID_III_COG', 'CGI_S_BL', 'SEIZURE_HX', 'ONSET_AGE', 'PRIOR_THERAPY_FLAG', 'REGION'], outputs: ['PS_MODEL'], function: 'logistic_regression', parameters: { link: 'logit' } },
      { order: 2, description: 'Extract predicted probabilities', inputs: ['PS_MODEL'], outputs: ['PROPENSITY_SCORE'], function: 'predict_prob', parameters: {} },
    ],
    validationRefs: ['Rosenbaum & Rubin 1983', 'Austin 2011 tutorial'],
    version: 1,
    createdAt: '2025-08-25T10:00:00Z',
    createdBy: 'Dr. Elena Vasquez',
    lockStatus: 'locked',
  },
]

const DEMO_ANALYSIS_RUNS: AnalysisRun[] = [
  {
    id: 'ar-primary-001',
    analysisPlanVersion: 'sap-xy301-v2.0',
    estimandId: 'est-att-bsid-motor',
    modelSpec: {
      id: 'ms-001',
      modelType: 'ancova',
      formula: 'BSID_III_MOTOR_CHG ~ TRTA + BSID_III_MOTOR_BL + AGE_MONTHS + SEX + GENOTYPE_CLASS',
      formulaPlainEnglish: 'Change in BSID-III Motor score modeled as a function of treatment group, adjusting for baseline motor score, age, sex, and genotype.',
      covariates: [
        { variable: 'BSID_III_MOTOR_BL', role: 'precision', justification: 'Baseline score is the strongest predictor of follow-up score' },
        { variable: 'AGE_MONTHS', role: 'confounder', transformation: 'linear', justification: 'Age influences developmental trajectory and treatment assignment' },
        { variable: 'SEX', role: 'confounder', justification: 'Known sex differences in CNS disorder severity' },
        { variable: 'GENOTYPE_CLASS', role: 'effect_modifier', transformation: 'categorical', justification: 'Genotype may modify treatment response' },
      ],
      interactions: [],
      weightingMethod: 'overlap',
      matchingMethod: 'none',
      varianceEstimator: 'robust_sandwich',
      confidenceLevel: 0.95,
      referenceGroup: 'External Comparator',
      softwareImplementation: 'R lm() v4.3.2 + sandwich::vcovHC',
      version: '1.0',
    },
    randomSeed: 20250901,
    softwareVersions: { R: '4.3.2', sandwich: '3.0-2', survey: '4.2-1' },
    dataInputHashes: {
      'dv-edc-v1': 'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      'dv-claims-v1': 'sha256:d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    },
    cohortVersionId: 'cv-001',
    outputs: [
      { id: 'ro-001', label: 'Treatment Effect (BSID-III Motor)', type: 'estimate', value: 4.7, lowerCI: 1.9, upperCI: 7.5, pValue: 0.0012, checksum: 'sha256:e1f2a3b4c5d6e7f8' },
      { id: 'ro-002', label: 'Forest Plot — Subgroup Analysis', type: 'figure', artifactPath: '/artifacts/ar-primary-001/forest_plot.pdf', format: 'PDF', checksum: 'sha256:f8e7d6c5b4a3f2e1' },
      { id: 'ro-003', label: 'Covariate Balance Table', type: 'table', artifactPath: '/artifacts/ar-primary-001/balance_table.csv', format: 'CSV', checksum: 'sha256:a3b4c5d6e7f8a1b2' },
    ],
    diagnostics: [
      { id: 'diag-001', type: 'balance', status: 'pass', threshold: 'SMD < 0.1', observedValue: 'Max SMD = 0.06', details: 'All covariates balanced after overlap weighting. Largest SMD: GENOTYPE_CLASS (0.06).', evidenceLinks: ['ro-003'] },
      { id: 'diag-002', type: 'overlap', status: 'pass', threshold: 'Effective sample size > 80% of nominal', observedValue: 'ESS = 91.3%', details: 'Propensity score distributions show adequate overlap. No positivity violations detected.', evidenceLinks: [] },
      { id: 'diag-003', type: 'convergence', status: 'pass', details: 'Model converged in 4 iterations. No singularity warnings.', evidenceLinks: [] },
    ],
    createdAt: '2025-09-15T14:22:00Z',
    createdBy: 'Dr. Elena Vasquez',
    signoffStatus: 'signed',
    signedBy: 'Dr. Kenji Tanaka (Independent Statistician)',
    signedAt: '2025-09-20T09:45:00Z',
    runStatus: 'completed',
    duration: 127,
    reproducibilityHash: 'sha256:7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c',
  },
  {
    id: 'ar-sensitivity-001',
    analysisPlanVersion: 'sap-xy301-v2.0',
    estimandId: 'est-att-bsid-motor',
    modelSpec: {
      id: 'ms-002',
      modelType: 'ancova',
      formula: 'BSID_III_MOTOR_CHG ~ TRTA + BSID_III_MOTOR_BL + AGE_MONTHS + SEX + GENOTYPE_CLASS + SEIZURE_HX + ONSET_AGE',
      formulaPlainEnglish: 'Sensitivity analysis with expanded covariate set including seizure history and age at symptom onset.',
      covariates: [
        { variable: 'BSID_III_MOTOR_BL', role: 'precision', justification: 'Baseline score adjustment' },
        { variable: 'AGE_MONTHS', role: 'confounder', transformation: 'linear', justification: 'Age confounder' },
        { variable: 'SEX', role: 'confounder', justification: 'Sex confounder' },
        { variable: 'GENOTYPE_CLASS', role: 'effect_modifier', transformation: 'categorical', justification: 'Effect modifier' },
        { variable: 'SEIZURE_HX', role: 'confounder', justification: 'Seizure history may confound outcome' },
        { variable: 'ONSET_AGE', role: 'confounder', transformation: 'linear', justification: 'Earlier onset may indicate more severe disease' },
      ],
      interactions: [],
      weightingMethod: 'stabilized_iptw',
      matchingMethod: 'none',
      varianceEstimator: 'bootstrap',
      confidenceLevel: 0.95,
      referenceGroup: 'External Comparator',
      softwareImplementation: 'R lm() v4.3.2 + boot::boot',
      version: '1.0',
    },
    randomSeed: 20250901,
    softwareVersions: { R: '4.3.2', boot: '1.3-28.1' },
    dataInputHashes: {
      'dv-edc-v1': 'sha256:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      'dv-claims-v1': 'sha256:d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1',
    },
    cohortVersionId: 'cv-001',
    outputs: [
      { id: 'ro-004', label: 'Treatment Effect (Sensitivity — Expanded Covariates)', type: 'estimate', value: 4.2, lowerCI: 1.3, upperCI: 7.1, pValue: 0.0048, checksum: 'sha256:c5d6e7f8a1b2c3d4' },
    ],
    diagnostics: [
      { id: 'diag-004', type: 'balance', status: 'pass', threshold: 'SMD < 0.1', observedValue: 'Max SMD = 0.08', details: 'All covariates balanced after stabilized IPTW.', evidenceLinks: [] },
      { id: 'diag-005', type: 'overlap', status: 'warning', threshold: 'ESS > 80%', observedValue: 'ESS = 78.4%', details: 'Effective sample size slightly below threshold with IPTW. Consider trimming extreme weights.', evidenceLinks: [] },
    ],
    createdAt: '2025-09-16T08:10:00Z',
    createdBy: 'Dr. Elena Vasquez',
    signoffStatus: 'pending',
    runStatus: 'completed',
    duration: 342,
    reproducibilityHash: 'sha256:2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
  },
]

const DEMO_AUDIT_EVENTS: AuditEvent[] = [
  { id: 'ae-001', timestamp: '2024-02-15T10:00:00Z', actor: 'Sarah Chen', actorRole: 'data_engineer', action: 'create', objectType: 'DataSource', objectId: 'ds-edc-001', reason: 'Initial EDC source registration for XY-301', sessionId: 'sess-001', hashChain: 'sha256:0000000000000001' },
  { id: 'ae-002', timestamp: '2024-04-01T08:30:00Z', actor: 'James Okafor', actorRole: 'data_engineer', action: 'create', objectType: 'DataSource', objectId: 'ds-ehr-002', reason: 'Register PedNeuro claims linkage as external comparator source', sessionId: 'sess-002', hashChain: 'sha256:0000000000000002' },
  { id: 'ae-003', timestamp: '2024-05-10T14:00:00Z', actor: 'Maria Santos', actorRole: 'clinical_scientist', action: 'create', objectType: 'DataSource', objectId: 'ds-reg-003', reason: 'Register ICORD natural history registry', sessionId: 'sess-003', hashChain: 'sha256:0000000000000003' },
  { id: 'ae-004', timestamp: '2025-07-01T09:00:00Z', actor: 'Sarah Chen', actorRole: 'biostatistician', action: 'create', objectType: 'VariableDefinition', objectId: 'vd-age', reason: 'Define AGE_MONTHS derivation for XY-301 cohort', sessionId: 'sess-004', hashChain: 'sha256:0000000000000004' },
  { id: 'ae-005', timestamp: '2025-07-15T12:00:00Z', actor: 'ETL Pipeline v4.2', actorRole: 'system_admin', action: 'create', objectType: 'DatasetVersion', objectId: 'dv-claims-v1', reason: 'Automated ingestion of PedNeuro claims Q2 2025 snapshot', sessionId: 'sess-005', hashChain: 'sha256:0000000000000005' },
  { id: 'ae-006', timestamp: '2025-07-20T14:00:00Z', actor: 'James Okafor', actorRole: 'data_engineer', action: 'lock', objectType: 'DatasetVersion', objectId: 'dv-claims-v1', reason: 'Claims dataset validated and locked for analysis', sessionId: 'sess-006', hashChain: 'sha256:0000000000000006' },
  { id: 'ae-007', timestamp: '2025-08-01T06:00:00Z', actor: 'ETL Pipeline v4.2', actorRole: 'system_admin', action: 'create', objectType: 'DatasetVersion', objectId: 'dv-edc-v1', reason: 'EDC dataset snapshot for interim analysis', sessionId: 'sess-007', hashChain: 'sha256:0000000000000007' },
  { id: 'ae-008', timestamp: '2025-08-15T09:00:00Z', actor: 'Sarah Chen', actorRole: 'data_engineer', action: 'lock', objectType: 'DatasetVersion', objectId: 'dv-edc-v1', reason: 'EDC dataset locked after schema validation and QC pass', sessionId: 'sess-008', hashChain: 'sha256:0000000000000008' },
  { id: 'ae-009', timestamp: '2025-08-20T10:00:00Z', actor: 'Sarah Chen', actorRole: 'biostatistician', action: 'create', objectType: 'CohortVersion', objectId: 'cv-001', reason: 'Define primary analysis cohort with 5 eligibility criteria', sessionId: 'sess-009', hashChain: 'sha256:0000000000000009' },
  { id: 'ae-010', timestamp: '2025-09-01T08:30:00Z', actor: 'Dr. Elena Vasquez', actorRole: 'biostatistician', action: 'lock', objectType: 'CohortVersion', objectId: 'cv-001', oldValue: 'draft', newValue: 'locked', reason: 'Cohort definition finalized and signed per SAP v2.0', signatureInfo: 'Digital signature: Elena Vasquez, cert ID EVQ-2025-001', sessionId: 'sess-010', hashChain: 'sha256:0000000000000010' },
  { id: 'ae-011', timestamp: '2025-09-15T14:22:00Z', actor: 'Dr. Elena Vasquez', actorRole: 'biostatistician', action: 'execute', objectType: 'AnalysisRun', objectId: 'ar-primary-001', reason: 'Execute primary ANCOVA analysis per SAP v2.0', sessionId: 'sess-011', hashChain: 'sha256:0000000000000011' },
  { id: 'ae-012', timestamp: '2025-09-16T08:10:00Z', actor: 'Dr. Elena Vasquez', actorRole: 'biostatistician', action: 'execute', objectType: 'AnalysisRun', objectId: 'ar-sensitivity-001', reason: 'Execute sensitivity analysis with expanded covariate set', sessionId: 'sess-012', hashChain: 'sha256:0000000000000012' },
  { id: 'ae-013', timestamp: '2025-09-20T09:45:00Z', actor: 'Dr. Kenji Tanaka', actorRole: 'external_reviewer', action: 'sign', objectType: 'AnalysisRun', objectId: 'ar-primary-001', reason: 'Independent statistical review — results verified, methods reproducible', signatureInfo: 'Digital signature: Kenji Tanaka, cert ID KJT-2025-003', sessionId: 'sess-013', hashChain: 'sha256:0000000000000013' },
  { id: 'ae-014', timestamp: '2025-10-01T11:00:00Z', actor: 'James Okafor', actorRole: 'data_engineer', action: 'access', objectType: 'DatasetVersion', objectId: 'dv-claims-v1', reason: 'Routine data access for quality monitoring dashboard', sessionId: 'sess-014', hashChain: 'sha256:0000000000000014' },
  { id: 'ae-015', timestamp: '2025-10-15T16:30:00Z', actor: 'Maria Santos', actorRole: 'clinical_scientist', action: 'export', objectType: 'AnalysisRun', objectId: 'ar-primary-001', newValue: 'PDF report exported', reason: 'Export primary analysis results for DSMB review packet', sessionId: 'sess-015', hashChain: 'sha256:0000000000000015' },
]

function buildLineageGraph(): LineageGraph {
  const nodes: LineageNode[] = [
    // Data Sources
    { id: 'ds-edc-001', type: 'data_source', label: 'XY-301 EDC', timestamp: '2024-02-15T10:00:00Z', actor: 'Sarah Chen' },
    { id: 'ds-ehr-002', type: 'data_source', label: 'PedNeuro Claims/EHR', timestamp: '2024-04-01T08:30:00Z', actor: 'James Okafor' },
    { id: 'ds-reg-003', type: 'data_source', label: 'ICORD Registry', timestamp: '2024-05-10T14:00:00Z', actor: 'Maria Santos' },
    // Dataset Versions
    { id: 'dv-edc-v1', type: 'dataset', label: 'EDC Dataset v1', version: 1, lockStatus: 'locked', timestamp: '2025-08-01T06:00:00Z', actor: 'ETL Pipeline v4.2', checksum: 'sha256:a1b2c3d4' },
    { id: 'dv-claims-v1', type: 'dataset', label: 'Claims Dataset v1', version: 1, lockStatus: 'locked', timestamp: '2025-07-15T12:00:00Z', actor: 'ETL Pipeline v4.2', checksum: 'sha256:d6c5b4a3' },
    // Transformation steps
    { id: 'tx-ingest-edc', type: 'transformation', label: 'EDC Ingest & Curation', timestamp: '2025-08-01T06:00:00Z', actor: 'ETL Pipeline v4.2' },
    { id: 'tx-ingest-claims', type: 'transformation', label: 'Claims Ingest & Linkage', timestamp: '2025-07-15T12:00:00Z', actor: 'ETL Pipeline v4.2' },
    // Variable Definitions
    { id: 'vd-age', type: 'variable', label: 'AGE_MONTHS', version: 1, lockStatus: 'locked', timestamp: '2025-07-01T09:00:00Z', actor: 'Sarah Chen' },
    { id: 'vd-dx', type: 'variable', label: 'DX_CONFIRMED', version: 1, lockStatus: 'locked', timestamp: '2025-07-01T09:30:00Z', actor: 'Sarah Chen' },
    { id: 'vd-genotype', type: 'variable', label: 'GENOTYPE_CLASS', version: 1, lockStatus: 'locked', timestamp: '2025-07-02T08:00:00Z', actor: 'Dr. Raj Patel' },
    { id: 'vd-bsid-motor', type: 'variable', label: 'BSID_III_MOTOR_CHG', version: 1, lockStatus: 'locked', timestamp: '2025-07-05T08:00:00Z', actor: 'Dr. Elena Vasquez' },
    { id: 'vd-ps', type: 'variable', label: 'PROPENSITY_SCORE', version: 1, lockStatus: 'locked', timestamp: '2025-08-25T10:00:00Z', actor: 'Dr. Elena Vasquez' },
    // Cohort
    { id: 'cv-001', type: 'cohort', label: 'Primary Cohort v1', version: 1, lockStatus: 'locked', timestamp: '2025-08-20T10:00:00Z', actor: 'Sarah Chen' },
    // Analysis Runs
    { id: 'ar-primary-001', type: 'analysis_run', label: 'Primary ANCOVA', version: 1, lockStatus: 'locked', timestamp: '2025-09-15T14:22:00Z', actor: 'Dr. Elena Vasquez', checksum: 'sha256:7f8e9d0c' },
    { id: 'ar-sensitivity-001', type: 'analysis_run', label: 'Sensitivity — Expanded Covariates', version: 1, timestamp: '2025-09-16T08:10:00Z', actor: 'Dr. Elena Vasquez', checksum: 'sha256:2c3d4e5f' },
  ]

  const edges: LineageEdge[] = [
    // Data sources → transformations
    { from: 'ds-edc-001', to: 'tx-ingest-edc', relationship: 'input_to', label: 'Raw EDC extract' },
    { from: 'ds-ehr-002', to: 'tx-ingest-claims', relationship: 'input_to', label: 'Raw claims data' },
    // Transformations → datasets
    { from: 'tx-ingest-edc', to: 'dv-edc-v1', relationship: 'produced_by', label: 'Curated EDC snapshot' },
    { from: 'tx-ingest-claims', to: 'dv-claims-v1', relationship: 'produced_by', label: 'Curated claims snapshot' },
    // Datasets → variables
    { from: 'dv-edc-v1', to: 'vd-age', relationship: 'derived_from' },
    { from: 'dv-edc-v1', to: 'vd-dx', relationship: 'derived_from' },
    { from: 'dv-edc-v1', to: 'vd-genotype', relationship: 'derived_from' },
    { from: 'dv-edc-v1', to: 'vd-bsid-motor', relationship: 'derived_from' },
    { from: 'dv-claims-v1', to: 'vd-age', relationship: 'derived_from' },
    { from: 'dv-claims-v1', to: 'vd-dx', relationship: 'derived_from' },
    // Variables → cohort
    { from: 'vd-age', to: 'cv-001', relationship: 'input_to' },
    { from: 'vd-dx', to: 'cv-001', relationship: 'input_to' },
    { from: 'vd-genotype', to: 'cv-001', relationship: 'input_to' },
    // Variables → propensity score
    { from: 'vd-age', to: 'vd-ps', relationship: 'input_to' },
    { from: 'vd-genotype', to: 'vd-ps', relationship: 'input_to' },
    { from: 'vd-bsid-motor', to: 'vd-ps', relationship: 'input_to' },
    // Cohort + variables → analysis runs
    { from: 'cv-001', to: 'ar-primary-001', relationship: 'input_to' },
    { from: 'vd-bsid-motor', to: 'ar-primary-001', relationship: 'input_to' },
    { from: 'vd-ps', to: 'ar-primary-001', relationship: 'input_to' },
    { from: 'cv-001', to: 'ar-sensitivity-001', relationship: 'input_to' },
    { from: 'vd-bsid-motor', to: 'ar-sensitivity-001', relationship: 'input_to' },
    { from: 'vd-ps', to: 'ar-sensitivity-001', relationship: 'input_to' },
    // Registry validates cohort definition
    { from: 'ds-reg-003', to: 'cv-001', relationship: 'validates', label: 'Natural history benchmark' },
  ]

  return {
    studyId: 'xy301',
    nodes,
    edges,
    generatedAt: '2025-10-20T12:00:00Z',
    integrityHash: 'sha256:lineage-graph-integrity-xy301-v1',
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface StoredState {
  dataSources: DataSource[]
  datasetVersions: DatasetVersion[]
  cohortVersions: CohortVersion[]
  variableDefinitions: VariableDefinition[]
  analysisRuns: AnalysisRun[]
  auditEvents: AuditEvent[]
  lineageGraph: LineageGraph
}

function loadInitialState(): StoredState & { _fromStorage?: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as StoredState
      return { ...parsed, _fromStorage: true }
    }
  } catch {
    // fall through to defaults
  }
  return {
    dataSources: DEMO_DATA_SOURCES,
    datasetVersions: DEMO_DATASET_VERSIONS,
    cohortVersions: DEMO_COHORT_VERSIONS,
    variableDefinitions: DEMO_VARIABLE_DEFINITIONS,
    analysisRuns: DEMO_ANALYSIS_RUNS,
    auditEvents: DEMO_AUDIT_EVENTS,
    lineageGraph: buildLineageGraph(),
    _fromStorage: false,
  }
}

export function LineageProvider({ children }: { children: React.ReactNode }) {
  const initialState = loadInitialState()
  const [state, setState] = useState<StoredState>(initialState)
  // Data is demo when it was not loaded from localStorage (i.e. first visit, no API data)
  const [isDemoData, setIsDemoData] = useState(!initialState._fromStorage)

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage full — silent fail
    }
  }, [state])

  const getLineageForResult = (resultId: string): LineageNode[] => {
    const { nodes, edges } = state.lineageGraph
    // Walk backwards from the result node through all ancestors
    const visited = new Set<string>()
    const queue = [resultId]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      // Find all edges pointing TO this node
      edges.forEach(e => {
        if (e.to === current && !visited.has(e.from)) {
          queue.push(e.from)
        }
      })
    }
    return nodes.filter(n => visited.has(n.id))
  }

  const getAuditTrail = (objectId: string): AuditEvent[] => {
    return state.auditEvents
      .filter(e => e.objectId === objectId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const getCohortHistory = (cohortId: string): CohortVersion[] => {
    return state.cohortVersions
      .filter(c => c.cohortId === cohortId)
      .sort((a, b) => a.version - b.version)
  }

  const getVariableChain = (varId: string): VariableDefinition[] => {
    // Return the variable and all variables it depends on (via derivation inputs)
    const result: VariableDefinition[] = []
    const visited = new Set<string>()
    const queue = [varId]
    while (queue.length > 0) {
      const currentId = queue.shift()!
      if (visited.has(currentId)) continue
      visited.add(currentId)
      const varDef = state.variableDefinitions.find(v => v.id === currentId || v.varId === currentId)
      if (varDef) {
        result.push(varDef)
        // Check derivation step inputs for references to other variables
        varDef.derivationSteps.forEach(step => {
          step.inputs.forEach(input => {
            const referenced = state.variableDefinitions.find(v => v.varId === input || v.id === input)
            if (referenced && !visited.has(referenced.id)) {
              queue.push(referenced.id)
            }
          })
        })
      }
    }
    return result
  }

  const value: LineageState = {
    ...state,
    isDemoData,
    getLineageForResult,
    getAuditTrail,
    getCohortHistory,
    getVariableChain,
  }

  return (
    <LineageContext.Provider value={value}>
      {children}
    </LineageContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLineage(): LineageState {
  const ctx = useContext(LineageContext)
  if (!ctx) {
    throw new Error('useLineage must be used within a <LineageProvider>')
  }
  return ctx
}
