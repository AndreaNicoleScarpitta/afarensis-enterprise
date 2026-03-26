import React, { useState } from 'react'
import { BookOpen, Lock, Eye, ChevronDown, ChevronRight, CheckCircle2, ArrowRight, Search, Hash, Calendar, Tag, FlaskConical, ClipboardList, Info } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── Variable Registry ────────────────────────────────────────────────────────
interface Variable {
  id: string
  label: string
  type: 'numeric' | 'categorical' | 'date'
  source: string
  derivationSteps: number
  version: string
  locked: boolean
  conceptualDef: string
  operationalDef: string
  derivation: DerivationStep[]
}

interface DerivationStep {
  step: number
  description: string
  inputs: string[]
  output: string
  operation: string
  parameters: string
  code: string
}

const VARIABLES: Variable[] = [
  {
    id: 'AGE_MONTHS',
    label: 'Age in Months at Index',
    type: 'numeric',
    source: 'Demographics',
    derivationSteps: 2,
    version: '1.2',
    locked: true,
    conceptualDef: 'Patient age expressed in completed months at the index date, enabling pediatric developmental milestone alignment.',
    operationalDef: 'FLOOR((INDEX_DATE - BIRTH_DATE) / 30.4375). Validated against source date fields; null if either date missing.',
    derivation: [
      { step: 1, description: 'Extract birth date and index date from demographics', inputs: ['BIRTH_DATE', 'INDEX_DATE'], output: 'date_pair', operation: 'SELECT', parameters: 'NOT NULL filter on both dates', code: `SELECT patient_id, birth_date, index_date\nFROM demographics\nWHERE birth_date IS NOT NULL\n  AND index_date IS NOT NULL;` },
      { step: 2, description: 'Compute age in completed months', inputs: ['date_pair'], output: 'AGE_MONTHS', operation: 'FLOOR division', parameters: 'Divisor = 30.4375 (avg days/month)', code: `AGE_MONTHS = FLOOR(\n  DATEDIFF(day, birth_date, index_date) / 30.4375\n);` },
    ],
  },
  {
    id: 'BSID_III_MOTOR_CHG',
    label: 'BSID-III Motor Composite Change',
    type: 'numeric',
    source: 'Outcomes',
    derivationSteps: 3,
    version: '2.0',
    locked: true,
    conceptualDef: 'Change from baseline in BSID-III Motor Composite score, the primary efficacy endpoint for neurodevelopmental function.',
    operationalDef: 'BSID_III_MOTOR_POST - BSID_III_MOTOR_BL. Baseline defined as last non-missing value within 30 days prior to index. Post defined as value at Month 12 visit window (+/- 14 days).',
    derivation: [
      { step: 1, description: 'Identify baseline motor score', inputs: ['BSID_III_RAW', 'VISIT_DATE', 'INDEX_DATE'], output: 'BSID_III_MOTOR_BL', operation: 'Window filter', parameters: 'Last value within 30 days pre-index', code: `BSID_III_MOTOR_BL = SELECT score\nFROM assessments\nWHERE visit_date BETWEEN (index_date - 30) AND index_date\nORDER BY visit_date DESC\nLIMIT 1;` },
      { step: 2, description: 'Identify Month 12 post-treatment score', inputs: ['BSID_III_RAW', 'VISIT_DATE', 'INDEX_DATE'], output: 'BSID_III_MOTOR_POST', operation: 'Window filter', parameters: 'Value at index_date + 365 +/- 14 days', code: `BSID_III_MOTOR_POST = SELECT score\nFROM assessments\nWHERE visit_date BETWEEN (index_date + 351)\n  AND (index_date + 379)\nORDER BY ABS(visit_date - (index_date + 365))\nLIMIT 1;` },
      { step: 3, description: 'Compute change from baseline', inputs: ['BSID_III_MOTOR_POST', 'BSID_III_MOTOR_BL'], output: 'BSID_III_MOTOR_CHG', operation: 'Subtraction', parameters: 'NULL if either input missing', code: `BSID_III_MOTOR_CHG = BSID_III_MOTOR_POST\n  - BSID_III_MOTOR_BL;` },
    ],
  },
  {
    id: 'DX_CONFIRMED',
    label: 'Confirmed Diagnosis Flag',
    type: 'categorical',
    source: 'Diagnoses',
    derivationSteps: 2,
    version: '1.0',
    locked: true,
    conceptualDef: 'Binary indicator confirming the patient has a qualifying CNS disorder diagnosis per pre-specified ICD-10 code list.',
    operationalDef: 'Set to 1 if patient has >= 2 diagnosis codes from the CNS_DISORDER_CODELIST within 365 days pre-index. Otherwise 0.',
    derivation: [
      { step: 1, description: 'Identify qualifying diagnosis codes in lookback window', inputs: ['DX_CODES', 'CNS_DISORDER_CODELIST', 'INDEX_DATE'], output: 'dx_count', operation: 'COUNT with JOIN', parameters: '365-day pre-index window', code: `dx_count = SELECT COUNT(DISTINCT dx_date)\nFROM diagnoses d\nJOIN cns_codelist c ON d.icd10 = c.code\nWHERE d.dx_date BETWEEN (index_date - 365)\n  AND index_date;` },
      { step: 2, description: 'Apply threshold for confirmed status', inputs: ['dx_count'], output: 'DX_CONFIRMED', operation: 'CASE WHEN', parameters: 'Threshold >= 2', code: `DX_CONFIRMED = CASE\n  WHEN dx_count >= 2 THEN 1\n  ELSE 0\nEND;` },
    ],
  },
  {
    id: 'GENOTYPE_CLASS',
    label: 'Genotype Classification',
    type: 'categorical',
    source: 'Genomics',
    derivationSteps: 1,
    version: '1.1',
    locked: true,
    conceptualDef: 'Classification of the patient genotype variant associated with the CNS disorder, used for subgroup stratification.',
    operationalDef: 'Mapped from raw genetic variant field using GENOTYPE_MAPPING lookup. Categories: Type I, Type II, Type III, Other, Unknown.',
    derivation: [
      { step: 1, description: 'Map raw variant to classification', inputs: ['RAW_VARIANT', 'GENOTYPE_MAPPING'], output: 'GENOTYPE_CLASS', operation: 'LEFT JOIN + COALESCE', parameters: 'Default to Unknown if no match', code: `GENOTYPE_CLASS = COALESCE(\n  gm.classification,\n  'Unknown'\n)\nFROM patients p\nLEFT JOIN genotype_mapping gm\n  ON p.raw_variant = gm.variant_code;` },
    ],
  },
  {
    id: 'PRIOR_THERAPY_FLAG',
    label: 'Prior Therapy Indicator',
    type: 'categorical',
    source: 'Rx Claims',
    derivationSteps: 2,
    version: '1.0',
    locked: false,
    conceptualDef: 'Indicator of whether the patient received any disease-modifying therapy in the 12 months prior to the index date.',
    operationalDef: 'Set to 1 if any Rx claim matching DISEASE_MOD_THERAPY_CODES found in 365-day pre-index window. Otherwise 0.',
    derivation: [
      { step: 1, description: 'Search Rx claims for qualifying therapy codes', inputs: ['RX_CLAIMS', 'DISEASE_MOD_THERAPY_CODES', 'INDEX_DATE'], output: 'therapy_found', operation: 'EXISTS subquery', parameters: '365-day lookback', code: `therapy_found = EXISTS(\n  SELECT 1 FROM rx_claims r\n  JOIN therapy_codes t ON r.ndc = t.ndc\n  WHERE r.fill_date BETWEEN\n    (index_date - 365) AND index_date\n);` },
      { step: 2, description: 'Set binary flag', inputs: ['therapy_found'], output: 'PRIOR_THERAPY_FLAG', operation: 'CAST', parameters: 'Boolean to integer', code: `PRIOR_THERAPY_FLAG = CASE\n  WHEN therapy_found THEN 1\n  ELSE 0\nEND;` },
    ],
  },
  {
    id: 'INDEX_DATE',
    label: 'Index Date',
    type: 'date',
    source: 'Enrollment',
    derivationSteps: 1,
    version: '1.0',
    locked: true,
    conceptualDef: 'The anchor date for each patient, defined as the date of first qualifying treatment initiation.',
    operationalDef: 'Earliest Rx fill date for the study treatment NDC list. Must fall within study period (2019-01-01 to 2024-06-30).',
    derivation: [
      { step: 1, description: 'Identify first qualifying treatment fill', inputs: ['RX_CLAIMS', 'STUDY_TX_CODES'], output: 'INDEX_DATE', operation: 'MIN with filter', parameters: 'Study period 2019-01-01 to 2024-06-30', code: `INDEX_DATE = SELECT MIN(fill_date)\nFROM rx_claims r\nJOIN study_tx t ON r.ndc = t.ndc\nWHERE fill_date BETWEEN '2019-01-01'\n  AND '2024-06-30';` },
    ],
  },
  {
    id: 'TIME_TO_EVENT',
    label: 'Time to Primary Event (Days)',
    type: 'numeric',
    source: 'Derived',
    derivationSteps: 2,
    version: '1.3',
    locked: true,
    conceptualDef: 'Days from index date to the occurrence of the primary composite endpoint event or censoring, whichever comes first.',
    operationalDef: 'MIN(EVENT_DATE, CENSOR_DATE) - INDEX_DATE. Event is first occurrence of composite endpoint. Censoring at disenrollment, death, or study end.',
    derivation: [
      { step: 1, description: 'Determine earliest event or censor date', inputs: ['EVENT_DATE', 'CENSOR_DATE'], output: 'end_date', operation: 'LEAST', parameters: 'Null handling: use non-null value', code: `end_date = LEAST(\n  COALESCE(event_date, '9999-12-31'),\n  COALESCE(censor_date, '9999-12-31')\n);` },
      { step: 2, description: 'Compute days from index', inputs: ['end_date', 'INDEX_DATE'], output: 'TIME_TO_EVENT', operation: 'DATEDIFF', parameters: 'Unit = days', code: `TIME_TO_EVENT = DATEDIFF(\n  day, index_date, end_date\n);` },
    ],
  },
  {
    id: 'PROPENSITY_SCORE',
    label: 'Propensity Score',
    type: 'numeric',
    source: 'Derived',
    derivationSteps: 3,
    version: '2.1',
    locked: false,
    conceptualDef: 'Estimated probability of receiving treatment conditional on observed baseline covariates, for confounding adjustment.',
    operationalDef: 'Logistic regression P(TREATMENT_ARM=1 | covariates). Covariates: AGE_MONTHS, GENOTYPE_CLASS, PRIOR_THERAPY_FLAG, COMORBID_NEURODEGEN, CONT_ENROLLMENT_DAYS.',
    derivation: [
      { step: 1, description: 'Assemble covariate matrix', inputs: ['AGE_MONTHS', 'GENOTYPE_CLASS', 'PRIOR_THERAPY_FLAG', 'COMORBID_NEURODEGEN', 'CONT_ENROLLMENT_DAYS'], output: 'covariate_matrix', operation: 'Feature assembly', parameters: 'Dummy-encode categorical variables', code: `covariates <- model.matrix(\n  ~ AGE_MONTHS + GENOTYPE_CLASS\n  + PRIOR_THERAPY_FLAG\n  + COMORBID_NEURODEGEN\n  + CONT_ENROLLMENT_DAYS,\n  data = analytic_cohort\n)` },
      { step: 2, description: 'Fit logistic regression model', inputs: ['covariate_matrix', 'TREATMENT_ARM'], output: 'ps_model', operation: 'GLM (logit link)', parameters: 'family = binomial(link="logit")', code: `ps_model <- glm(\n  TREATMENT_ARM ~ .,\n  data = covariate_matrix,\n  family = binomial(link = "logit")\n)` },
      { step: 3, description: 'Extract predicted probabilities', inputs: ['ps_model'], output: 'PROPENSITY_SCORE', operation: 'predict(type="response")', parameters: 'Trimming at [0.01, 0.99]', code: `PROPENSITY_SCORE <- pmin(\n  pmax(predict(ps_model,\n    type = "response"), 0.01),\n  0.99\n)` },
    ],
  },
  {
    id: 'COMORBID_NEURODEGEN',
    label: 'Neurodegenerative Comorbidity Flag',
    type: 'categorical',
    source: 'Diagnoses',
    derivationSteps: 1,
    version: '1.0',
    locked: true,
    conceptualDef: 'Indicator of whether the patient has a co-occurring neurodegenerative condition distinct from the primary CNS disorder.',
    operationalDef: 'Set to 1 if any ICD-10 code from NEURODEGEN_CODELIST appears in claims within 365 days pre-index. Excludes primary disorder codes.',
    derivation: [
      { step: 1, description: 'Check for neurodegenerative comorbidity codes', inputs: ['DX_CODES', 'NEURODEGEN_CODELIST', 'INDEX_DATE'], output: 'COMORBID_NEURODEGEN', operation: 'EXISTS with exclusion', parameters: '365-day lookback; exclude primary dx codes', code: `COMORBID_NEURODEGEN = CASE\n  WHEN EXISTS(\n    SELECT 1 FROM diagnoses d\n    JOIN neurodegen_codes n\n      ON d.icd10 = n.code\n    WHERE d.dx_date >= (index_date - 365)\n      AND d.icd10 NOT IN\n        (SELECT code FROM cns_codelist)\n  ) THEN 1 ELSE 0\nEND;` },
    ],
  },
  {
    id: 'CONT_ENROLLMENT_DAYS',
    label: 'Continuous Enrollment (Days)',
    type: 'numeric',
    source: 'Enrollment',
    derivationSteps: 2,
    version: '1.0',
    locked: true,
    conceptualDef: 'Total days of continuous health plan enrollment prior to the index date, measuring data completeness and observation time.',
    operationalDef: 'Count of consecutive enrolled days from last enrollment gap (> 45 days) to index date. Max capped at 730 days.',
    derivation: [
      { step: 1, description: 'Identify enrollment gaps exceeding 45 days', inputs: ['ENROLLMENT_SPANS'], output: 'gap_free_start', operation: 'LAG window function', parameters: 'Gap threshold = 45 days', code: `gap_free_start = SELECT MAX(span_start)\nFROM enrollment_spans\nWHERE gap_days > 45\n  AND span_start < index_date;` },
      { step: 2, description: 'Compute continuous days from gap-free start', inputs: ['gap_free_start', 'INDEX_DATE'], output: 'CONT_ENROLLMENT_DAYS', operation: 'DATEDIFF with cap', parameters: 'Capped at 730', code: `CONT_ENROLLMENT_DAYS = LEAST(\n  DATEDIFF(day, gap_free_start, index_date),\n  730\n);` },
    ],
  },
  {
    id: 'TREATMENT_ARM',
    label: 'Treatment Arm Assignment',
    type: 'categorical',
    source: 'Rx Claims',
    derivationSteps: 1,
    version: '1.0',
    locked: true,
    conceptualDef: 'Binary indicator of treatment group: 1 = study treatment, 0 = comparator (standard of care).',
    operationalDef: 'Assigned based on index prescription NDC match to STUDY_TX_CODES (1) vs COMPARATOR_CODES (0).',
    derivation: [
      { step: 1, description: 'Classify based on index prescription NDC', inputs: ['INDEX_RX_NDC', 'STUDY_TX_CODES', 'COMPARATOR_CODES'], output: 'TREATMENT_ARM', operation: 'CASE WHEN with code list join', parameters: 'Mutual exclusivity enforced', code: `TREATMENT_ARM = CASE\n  WHEN index_ndc IN\n    (SELECT ndc FROM study_tx) THEN 1\n  WHEN index_ndc IN\n    (SELECT ndc FROM comparator) THEN 0\n  ELSE NULL\nEND;` },
    ],
  },
  {
    id: 'CENSORING_FLAG',
    label: 'Censoring Indicator',
    type: 'categorical',
    source: 'Derived',
    derivationSteps: 2,
    version: '1.1',
    locked: false,
    conceptualDef: 'Indicator of whether the patient was censored (did not experience the primary event during follow-up).',
    operationalDef: 'Set to 1 if patient reached end of study, disenrolled, or died without experiencing the primary composite endpoint. Otherwise 0.',
    derivation: [
      { step: 1, description: 'Check for primary event occurrence', inputs: ['EVENT_DATE', 'INDEX_DATE'], output: 'event_occurred', operation: 'IS NOT NULL check', parameters: 'Event within study period', code: `event_occurred = CASE\n  WHEN event_date IS NOT NULL\n    AND event_date <= study_end_date\n  THEN TRUE ELSE FALSE\nEND;` },
      { step: 2, description: 'Set censoring flag as complement', inputs: ['event_occurred'], output: 'CENSORING_FLAG', operation: 'NOT', parameters: '1 = censored, 0 = event observed', code: `CENSORING_FLAG = CASE\n  WHEN event_occurred THEN 0\n  ELSE 1\nEND;` },
    ],
  },
]

// ── Code Lists ───────────────────────────────────────────────────────────────
const CODE_LISTS = [
  { name: 'CNS Disorder Diagnoses', system: 'ICD-10-CM', version: '2024', codes: [
    { code: 'G12.0', display: 'Infantile spinal muscular atrophy, type I [Werdnig-Hoffman]', included: true },
    { code: 'G12.1', display: 'Other inherited spinal muscular atrophy', included: true },
    { code: 'G12.9', display: 'Spinal muscular atrophy, unspecified', included: true },
    { code: 'G71.0', display: 'Muscular dystrophy', included: false },
    { code: 'G11.1', display: 'Early-onset cerebellar ataxia', included: true },
    { code: 'G31.81', display: 'Alpers disease', included: true },
    { code: 'G31.89', display: 'Other specified degenerative diseases of nervous system', included: true },
  ]},
  { name: 'Disease-Modifying Therapies', system: 'NDC', version: '2024-Q1', codes: [
    { code: '69238-1131-1', display: 'Nusinersen 12mg/5mL injection', included: true },
    { code: '71287-0001-1', display: 'Onasemnogene abeparvovec-xioi', included: true },
    { code: '27436-0001-1', display: 'Risdiplam 0.75mg/mL oral solution', included: true },
    { code: '00002-7711-11', display: 'Comparator agent A (standard of care)', included: true },
  ]},
  { name: 'Neurodegenerative Comorbidities', system: 'ICD-10-CM', version: '2024', codes: [
    { code: 'G20', display: 'Parkinson disease', included: true },
    { code: 'G30.9', display: 'Alzheimer disease, unspecified', included: true },
    { code: 'G35', display: 'Multiple sclerosis', included: true },
    { code: 'G10', display: 'Huntington disease', included: true },
    { code: 'G23.1', display: 'Progressive supranuclear ophthalmoplegia', included: false },
  ]},
]

// ── Unit Normalization Rules ─────────────────────────────────────────────────
const UNIT_RULES = [
  { variable: 'WEIGHT_KG', sourceUnit: 'lbs', targetUnit: 'kg', formula: 'value * 0.453592', validated: true },
  { variable: 'AGE_MONTHS', sourceUnit: 'years', targetUnit: 'months', formula: 'value * 12', validated: true },
  { variable: 'HEIGHT_CM', sourceUnit: 'inches', targetUnit: 'cm', formula: 'value * 2.54', validated: true },
  { variable: 'CREATININE', sourceUnit: 'mg/dL', targetUnit: 'umol/L', formula: 'value * 88.42', validated: true },
  { variable: 'ALBUMIN', sourceUnit: 'g/L', targetUnit: 'g/dL', formula: 'value / 10', validated: true },
  { variable: 'HEMOGLOBIN', sourceUnit: 'mmol/L', targetUnit: 'g/dL', formula: 'value * 1.61', validated: false },
]

// ── Row-Level Trace Data ─────────────────────────────────────────────────────
const TRACE_DATA = [
  { input: 'BSID_III_MOTOR_BL', value: '78', transformation: 'Baseline score (last pre-index)', output: '78' },
  { input: 'BSID_III_MOTOR_POST', value: '92', transformation: 'Month 12 score (+/- 14d window)', output: '92' },
  { input: 'BSID_III_MOTOR_CHG', value: '—', transformation: 'POST - BL = 92 - 78', output: '14' },
]

export default function VariableNotebook({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const [expandedVar, setExpandedVar] = useState<string | null>(null)
  const [activeCodeList, setActiveCodeList] = useState(0)
  const [showTrace, setShowTrace] = useState(false)

  const toggleVar = (id: string) => {
    setExpandedVar(expandedVar === id ? null : id)
  }

  const typeIcon = (t: string) => {
    if (t === 'numeric') return <Hash className="h-3 w-3 text-[#2563EB] dark:text-[#60a5fa]" />
    if (t === 'categorical') return <Tag className="h-3 w-3 text-amber-600 dark:text-amber-300" />
    return <Calendar className="h-3 w-3 text-emerald-400" />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Variable Notebook</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Variable Construction & Derivation</h1>
              <p className="text-gray-500 text-xs mt-0.5">Derivation recipes &middot; code lists &middot; unit normalization &middot; row-level trace</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">

        {/* Reviewer Mode Banner */}
        {reviewerMode && (
          <div className="flex items-center gap-3 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl px-5 py-3">
            <Eye className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa] shrink-0" />
            <p className="text-xs text-[#2563EB] dark:text-[#60a5fa] font-semibold">Reviewer mode: Displaying locked variable definitions. All derivation logic is pre-specified per SAP.</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Variables', value: String(VARIABLES.length) },
            { label: 'Locked', value: String(VARIABLES.filter(v => v.locked).length) },
            { label: 'Draft', value: String(VARIABLES.filter(v => !v.locked).length) },
            { label: 'Code Lists', value: String(CODE_LISTS.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* ─── Variable Registry Table ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Variable Registry</h2>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Variable ID</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Label</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Type</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Source</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Steps</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Version</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {VARIABLES.map((v) => (
                  <React.Fragment key={v.id}>
                    <tr
                      className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/3 transition-colors cursor-pointer"
                      onClick={() => toggleVar(v.id)}
                    >
                      <td className="px-4 py-2.5 font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">{v.id}</td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">{v.label}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5">
                          {typeIcon(v.type)}
                          <span className="text-gray-600 dark:text-gray-400 capitalize">{v.type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{v.source}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white">{v.derivationSteps}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-gray-600 dark:text-gray-400">v{v.version}</td>
                      <td className="px-4 py-2.5 text-center">
                        {v.locked ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Locked</span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">Draft</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {expandedVar === v.id ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />}
                      </td>
                    </tr>

                    {/* Expanded Derivation Recipe Panel */}
                    {expandedVar === v.id && (
                      <tr>
                        <td colSpan={8} className="px-0 py-0">
                          <div className="bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5 px-6 py-5 space-y-4">
                            {/* Conceptual vs Operational Definitions */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                  <Info className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60a5fa]" />
                                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Conceptual Definition</p>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{v.conceptualDef}</p>
                              </div>
                              <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-2">
                                  <ClipboardList className="h-3.5 w-3.5 text-emerald-400" />
                                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Operational Definition</p>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">{v.operationalDef}</p>
                              </div>
                            </div>

                            {/* Derivation Steps Flow */}
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Derivation Recipe</p>
                              <div className="space-y-3">
                                {v.derivation.map((step, si) => (
                                  <div key={si} className="flex items-start gap-3">
                                    {/* Step number connector */}
                                    <div className="flex flex-col items-center shrink-0">
                                      <div className="w-6 h-6 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#60a5fa]">{step.step}</span>
                                      </div>
                                      {si < v.derivation.length - 1 && (
                                        <div className="w-px h-full min-h-[40px] bg-[#2563EB]/20 mt-1" />
                                      )}
                                    </div>

                                    {/* Step content */}
                                    <div className="flex-1 bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4 space-y-2">
                                      <p className="text-xs font-bold text-gray-900 dark:text-white">{step.description}</p>
                                      <div className="flex flex-wrap gap-4 text-[10px]">
                                        <div>
                                          <span className="text-gray-500 uppercase tracking-widest font-semibold">Inputs: </span>
                                          <span className="font-mono text-[#2563EB] dark:text-[#60a5fa]">{step.inputs.join(', ')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <ArrowRight className="h-2.5 w-2.5 text-gray-500" />
                                          <span className="text-gray-500 uppercase tracking-widest font-semibold">Operation: </span>
                                          <span className="text-gray-700 dark:text-gray-300 font-medium">{step.operation}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <ArrowRight className="h-2.5 w-2.5 text-gray-500" />
                                          <span className="text-gray-500 uppercase tracking-widest font-semibold">Output: </span>
                                          <span className="font-mono text-emerald-400 font-bold">{step.output}</span>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-gray-500"><span className="uppercase tracking-widest font-semibold">Parameters: </span>{step.parameters}</p>
                                      <pre className="bg-gray-200/60 dark:bg-black/30 border border-gray-300 dark:border-white/8 rounded-lg p-3 text-[11px] font-mono text-gray-800 dark:text-gray-300 overflow-x-auto whitespace-pre leading-relaxed">{step.code}</pre>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Code List / Concept Set Manager ─────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Code List / Concept Set Manager</h2>
          <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
            {/* Code list tabs */}
            <div className="flex gap-2 mb-4">
              {CODE_LISTS.map((cl, i) => (
                <button
                  key={i}
                  onClick={() => setActiveCodeList(i)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-colors ${
                    activeCodeList === i
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-gray-200/60 dark:bg-white/6 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {cl.name}
                </button>
              ))}
            </div>

            {/* Active code list metadata */}
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                System: <span className="text-gray-900 dark:text-white font-bold normal-case">{CODE_LISTS[activeCodeList].system}</span>
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                Version: <span className="text-gray-900 dark:text-white font-bold normal-case">{CODE_LISTS[activeCodeList].version}</span>
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                Codes: <span className="text-gray-900 dark:text-white font-bold normal-case">{CODE_LISTS[activeCodeList].codes.length}</span>
              </span>
            </div>

            {/* Code list table */}
            <div className="border border-gray-200 dark:border-white/8 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Code</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Display Name</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">System</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Version</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Included</th>
                  </tr>
                </thead>
                <tbody>
                  {CODE_LISTS[activeCodeList].codes.map((c, i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/3 transition-colors">
                      <td className="px-4 py-2 font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">{c.code}</td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.display}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{CODE_LISTS[activeCodeList].system}</td>
                      <td className="px-4 py-2 text-center text-gray-500">{CODE_LISTS[activeCodeList].version}</td>
                      <td className="px-4 py-2 text-center">
                        {c.included ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-[10px] text-gray-500 font-medium">Excluded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Unit Normalization Rules ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Unit Normalization Rules</h2>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Variable</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Source Unit</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]"></th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Target Unit</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Conversion Formula</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Validated</th>
                </tr>
              </thead>
              <tbody>
                {UNIT_RULES.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">{r.variable}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{r.sourceUnit}</td>
                    <td className="px-4 py-2.5 text-center"><ArrowRight className="h-3 w-3 text-gray-500 dark:text-gray-400 mx-auto" /></td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{r.targetUnit}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{r.formula}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.validated ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Row-Level Derivation Trace Inspector ────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Row-Level Derivation Trace Inspector</h2>
          <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 space-y-4">
            {/* Query bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-gray-200/60 dark:bg-black/30 border border-gray-300 dark:border-white/8 rounded-lg px-3 py-2">
                <Search className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500">For record </span>
                <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">#4821</span>
                <span className="text-xs text-gray-500">, show inputs for </span>
                <span className="text-xs font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">BSID_III_MOTOR_CHG</span>
              </div>
              <button
                onClick={() => setShowTrace(!showTrace)}
                className="text-[10px] px-4 py-2 rounded-lg font-bold uppercase tracking-wider bg-[#2563EB] text-white hover:bg-[#2563EB]/90 transition-colors"
              >
                {showTrace ? 'Hide Trace' : 'Trace'}
              </button>
            </div>

            {/* Trace results */}
            {showTrace && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60a5fa]" />
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                    Derivation trace for record <span className="text-gray-900 dark:text-white font-bold">#4821</span> &mdash; <span className="text-[#2563EB] dark:text-[#60a5fa]">BSID_III_MOTOR_CHG</span>
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-white/8 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/8">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Input Variable</th>
                        <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Value</th>
                        <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]"></th>
                        <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Transformation</th>
                        <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Output Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TRACE_DATA.map((t, i) => (
                        <tr key={i} className={`border-b border-gray-200 dark:border-white/5 ${i === TRACE_DATA.length - 1 ? 'bg-[#2563EB]/5' : ''}`}>
                          <td className="px-4 py-2.5 font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">{t.input}</td>
                          <td className="px-4 py-2.5 text-center font-mono text-gray-900 dark:text-white font-semibold">{t.value}</td>
                          <td className="px-4 py-2.5 text-center"><ArrowRight className="h-3 w-3 text-gray-500 dark:text-gray-400 mx-auto" /></td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{t.transformation}</td>
                          <td className="px-4 py-2.5 text-center font-mono font-bold text-emerald-400">{t.output}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Provenance pointer */}
                <div className="flex items-center gap-2 bg-gray-200/40 dark:bg-white/[0.02] border border-gray-200 dark:border-white/8 rounded-lg px-4 py-2.5">
                  <Info className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                  <p className="text-[10px] text-gray-500">
                    <span className="uppercase tracking-widest font-semibold">Provenance: </span>
                    Source record <span className="font-mono font-bold text-gray-900 dark:text-white">#4821</span> from
                    <span className="font-mono text-[#2563EB] dark:text-[#60a5fa]"> assessments</span> table, rows
                    <span className="font-mono text-gray-900 dark:text-white"> 12,408</span> (baseline) and
                    <span className="font-mono text-gray-900 dark:text-white"> 15,223</span> (Month 12).
                    Traceable to source data extract v3.1, dated 2024-09-15.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
