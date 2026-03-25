/**
 * Afarensis Canonical Data Model — Analysis Lineage & Traceability
 *
 * Every dataset version, cohort version, variable definition, and analysis run
 * is a node in a directed lineage graph. Edges encode derivation/transformation.
 * Artifacts and reviewer guides are signed outputs.
 *
 * Aligned with:
 *  - 21 CFR Part 11 (audit trails, access controls, electronic records)
 *  - FDA Study Data Conformance Guide (traceability, define.xml, ADRG/SDRG)
 *  - FDA EHR/Claims Guidance (provenance, de-identification, coding timelines)
 *  - ICH E9(R1) (estimands, sensitivity analyses, prespecification)
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type LockStatus = 'draft' | 'review' | 'locked' | 'amended'
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type SignoffStatus = 'pending' | 'signed' | 'rejected'
export type AuditAction = 'create' | 'modify' | 'delete' | 'lock' | 'unlock' | 'sign' | 'export' | 'access' | 'execute'
export type RetentionClass = 'permanent' | 'study_lifecycle' | 'session'
export type ProvenancePointerType = 'edc' | 'ehr' | 'claims' | 'registry' | 'lab' | 'imaging' | 'unstructured'
export type BalanceStatus = 'balanced' | 'marginal' | 'imbalanced'
export type DiagnosticStatus = 'pass' | 'warning' | 'fail' | 'not_run'

export type EstimandType = 'ATT' | 'ATE' | 'ITT' | 'PP'
export type InterceptStrategy = 'treatment_policy' | 'composite' | 'hypothetical' | 'principal_stratum' | 'while_on_treatment'
export type SummaryMeasure = 'hazard_ratio' | 'risk_difference' | 'risk_ratio' | 'odds_ratio' | 'mean_difference' | 'rmst_difference' | 'rate_ratio'

export type WeightingMethod = 'iptw' | 'stabilized_iptw' | 'overlap' | 'none'
export type MatchingMethod = 'ps_nearest_neighbor' | 'ps_caliper' | 'ps_with_replacement' | 'exact' | 'coarsened_exact' | 'mahalanobis' | 'none'
export type OutcomeModelType = 'logistic' | 'linear' | 'cox_ph' | 'kaplan_meier' | 'rmst' | 'poisson' | 'negative_binomial' | 'ancova' | 'mixed_effects' | 'gee' | 'mmrm'
export type MissingDataMethod = 'complete_case' | 'missing_indicator' | 'single_imputation' | 'mice'
export type VarianceEstimator = 'conventional' | 'robust_sandwich' | 'bootstrap' | 'jackknife'

// ─── Core Lineage Objects ─────────────────────────────────────────────────────

/** Immutable snapshot of a data source at a point in time */
export interface DataSource {
  id: string
  name: string
  type: ProvenancePointerType
  owner: string
  contractId?: string
  coverageStart: string       // ISO date
  coverageEnd: string
  refreshPolicy: string
  codingSystem?: string
  codingVersion?: string
  description: string
  createdAt: string
  createdBy: string
}

/** A versioned dataset with integrity checksums */
export interface DatasetVersion {
  id: string
  dataSourceId: string
  parentVersionId?: string
  version: number
  createdAt: string
  createdBy: string
  sourceSnapshotId: string
  rowCount: number
  columnCount: number
  schemaHash: string
  contentHash: string
  retentionClass: RetentionClass
  lockStatus: LockStatus
  lockedAt?: string
  lockedBy?: string
  fields: FieldDefinition[]
}

/** Schema field with quality metrics */
export interface FieldDefinition {
  name: string
  type: 'numeric' | 'categorical' | 'date' | 'text' | 'boolean'
  units?: string
  codeSystem?: string
  codeVersion?: string
  missingnessRate: number        // 0.0–1.0
  distinctValues: number
  description: string
  plausibilityMin?: number
  plausibilityMax?: number
}

/** Row-level provenance pointer — links analytic records to source origins */
export interface ProvenancePointer {
  id: string
  recordId: string
  pointerType: ProvenancePointerType
  sourceTable: string
  sourceRowKey: string
  extractionTimestamp: string
  codingSystemVersion?: string
  retrievalMethod: string
  modifications: ProvenanceModification[]
}

export interface ProvenanceModification {
  step: string
  timestamp: string
  actor: string
  oldValue: string
  newValue: string
  reason: string
}

/** ETL / transformation step in the lineage graph */
export interface TransformationStep {
  id: string
  type: 'ingest' | 'curation' | 'derivation' | 'mapping' | 'export'
  inputIds: string[]           // DatasetVersion or VariableDefinition IDs
  outputIds: string[]
  codeRef: string              // git commit hash or program path
  parameters: Record<string, unknown>
  runtimeEnv: string
  createdAt: string
  actor: string
  reasonIfChange?: string
  checksum: string
}

// ─── Cohort & Population ──────────────────────────────────────────────────────

/** Versioned cohort definition with attrition tracking */
export interface CohortVersion {
  id: string
  cohortId: string
  version: number
  narrativeIntent: string
  rules: CohortRule[]
  indexDateRule: string
  timeWindows: TimeWindow[]
  attritionSteps: AttritionStep[]
  createdAt: string
  createdBy: string
  lockStatus: LockStatus
  lockedSignature?: string
  lockedAt?: string
  lockedBy?: string
  amendmentReason?: string
  parentVersionId?: string
}

export interface CohortRule {
  id: string
  order: number
  type: 'inclusion' | 'exclusion'
  description: string
  codeExpression: string
  variableRefs: string[]
}

export interface TimeWindow {
  name: string
  relativeTo: string
  startOffset: number
  endOffset: number
  units: 'days' | 'months' | 'years'
}

export interface AttritionStep {
  stepId: string
  ruleId: string
  description: string
  countBefore: number
  countAfter: number
  countExcluded: number
  reason: string
}

// ─── Variable Definitions & Derivations ───────────────────────────────────────

/** Full derivation chain for a variable */
export interface VariableDefinition {
  id: string
  varId: string
  label: string
  conceptualDefinition: string
  operationalDefinition: string
  units?: string
  timeWindow?: string
  codeListId?: string
  derivationSteps: DerivationStep[]
  validationRefs: string[]
  version: number
  createdAt: string
  createdBy: string
  lockStatus: LockStatus
}

export interface DerivationStep {
  order: number
  description: string
  inputs: string[]             // variable IDs or field names
  outputs: string[]
  function: string             // operation name
  parameters: Record<string, unknown>
  codeSnippet?: string
}

export interface CodeList {
  id: string
  name: string
  codingSystem: string
  codingVersion: string
  codes: CodeEntry[]
  inclusionLogic: string
  version: number
  createdAt: string
  createdBy: string
}

export interface CodeEntry {
  code: string
  display: string
  included: boolean
  notes?: string
}

// ─── Analysis Specification ───────────────────────────────────────────────────

/** Locked, versioned statistical analysis plan */
export interface AnalysisPlan {
  id: string
  version: number
  title: string
  objectives: string[]
  endpoints: AnalysisEndpoint[]
  analysisSets: string[]
  missingDataPlan: MissingDataPlan
  sensitivityPlan: SensitivitySpec[]
  createdAt: string
  createdBy: string
  lockStatus: LockStatus
  lockedAt?: string
  lockedBy?: string
  lockedSignature?: string
}

export interface AnalysisEndpoint {
  id: string
  label: string
  type: 'primary' | 'secondary' | 'exploratory'
  variable: string
  timeframe?: string
}

export interface MissingDataPlan {
  primaryMethod: MissingDataMethod
  imputationVariables?: string[]
  numberOfImputations?: number
  poolingRules?: string
  sensitivityMethods: MissingDataMethod[]
}

/** ICH E9(R1) estimand definition */
export interface EstimandDefinition {
  id: string
  population: string
  treatmentConditions: string[]
  endpoint: string
  intercurrentEventStrategies: InterceptEventStrategy[]
  summaryMeasure: SummaryMeasure
  rationale: string
  linkedObjectiveId: string
}

export interface InterceptEventStrategy {
  event: string
  strategy: InterceptStrategy
  rationale: string
}

/** Full model specification for reproducibility */
export interface ModelSpec {
  id: string
  modelType: OutcomeModelType
  formula: string                 // e.g., "outcome ~ treatment + age + sex"
  formulaPlainEnglish: string     // human-readable
  linkFunction?: string
  covariates: CovariateSpec[]
  interactions: string[]
  weightingMethod: WeightingMethod
  matchingMethod: MatchingMethod
  matchingParams?: MatchingParams
  varianceEstimator: VarianceEstimator
  confidenceLevel: number         // e.g., 0.95
  referenceGroup: string
  censoringRules?: string
  exposureOffset?: string
  randomSeed?: number
  softwareImplementation: string  // e.g., "R survival::coxph v3.5-7"
  version: string
}

export interface CovariateSpec {
  variable: string
  role: 'confounder' | 'effect_modifier' | 'precision' | 'instrumental'
  transformation?: string         // e.g., 'log', 'spline(df=3)', 'categorical'
  justification: string
}

export interface MatchingParams {
  caliper?: number
  ratio: string                   // e.g., '1:1', '1:4'
  replacement: boolean
  commonSupportRestriction: boolean
  trimmingRule?: string
}

export interface SensitivitySpec {
  id: string
  name: string
  whatChanged: string
  whyItExists: string
  estimandChanged: boolean
  targetEstimandId: string
}

// ─── Analysis Runs & Results ──────────────────────────────────────────────────

/** Immutable record of an executed analysis */
export interface AnalysisRun {
  id: string
  analysisPlanVersion: string
  estimandId: string
  modelSpec: ModelSpec
  randomSeed?: number
  softwareVersions: Record<string, string>
  dataInputHashes: Record<string, string>
  cohortVersionId: string
  outputs: RunOutput[]
  diagnostics: DiagnosticResult[]
  createdAt: string
  createdBy: string
  signoffStatus: SignoffStatus
  signedBy?: string
  signedAt?: string
  runStatus: RunStatus
  duration?: number               // seconds
  reproducibilityHash: string     // hash of all inputs
}

export interface RunOutput {
  id: string
  label: string
  type: 'estimate' | 'table' | 'figure' | 'dataset'
  value?: number
  lowerCI?: number
  upperCI?: number
  pValue?: number
  format?: string
  artifactPath?: string
  checksum: string
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  id: string
  type: 'balance' | 'overlap' | 'model_fit' | 'residual' | 'missingness' | 'proportional_hazards' | 'positivity' | 'convergence'
  status: DiagnosticStatus
  threshold?: string
  observedValue?: string
  details: string
  evidenceLinks: string[]
  artifactPath?: string
  checksum?: string
}

export interface BalanceDiagnostic {
  covariate: string
  smdBefore: number
  smdAfter: number
  status: BalanceStatus
  threshold: number             // typically 0.1
}

export interface OverlapDiagnostic {
  method: string
  minPS: number
  maxPS: number
  trimmedCount: number
  effectiveSampleSize: number
  positiviyViolations: number
}

// ─── Submission & Export ──────────────────────────────────────────────────────

/** A versioned submission package */
export interface SubmissionPackage {
  id: string
  studyId: string
  targetCenter: 'FDA' | 'EMA' | 'PMDA' | 'Health Canada' | 'TGA'
  submissionType: string
  version: number
  createdAt: string
  createdBy: string
  artifacts: SubmissionArtifact[]
  manifest: SubmissionManifest
  checksumManifest: Record<string, string>
  lockStatus: LockStatus
}

export interface SubmissionArtifact {
  id: string
  type: 'dataset_xpt' | 'define_xml' | 'adrg_pdf' | 'sdrg_pdf' | 'acrf_pdf' | 'lineage_manifest' | 'audit_trail' | 'program' | 'figure' | 'table' | 'listing'
  filename: string
  path: string
  checksum: string
  producedByRunId?: string
  retentionClass: RetentionClass
  format: string
  sizeBytes: number
}

export interface SubmissionManifest {
  packageId: string
  generatedAt: string
  generatedBy: string
  artifactCount: number
  totalSizeBytes: number
  integrityHash: string
  ectdPlacement: Record<string, string>   // artifact path → eCTD module location
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/** Part 11-compliant audit event */
export interface AuditEvent {
  id: string
  timestamp: string              // UTC ISO
  actor: string
  actorRole: string
  action: AuditAction
  objectType: string
  objectId: string
  oldValue?: string
  newValue?: string
  reason?: string
  signatureInfo?: string
  sessionId: string
  ipAddress?: string
  hashChain: string              // hash of prior event + this event
}

// ─── Lineage Graph ────────────────────────────────────────────────────────────

/** A node in the lineage graph */
export interface LineageNode {
  id: string
  type: 'data_source' | 'dataset' | 'transformation' | 'cohort' | 'variable' | 'analysis_plan' | 'estimand' | 'model_spec' | 'analysis_run' | 'diagnostic' | 'artifact'
  label: string
  version?: number
  lockStatus?: LockStatus
  timestamp: string
  actor: string
  checksum?: string
}

/** An edge in the lineage graph */
export interface LineageEdge {
  from: string
  to: string
  relationship: 'derived_from' | 'input_to' | 'produced_by' | 'version_of' | 'targets' | 'validates' | 'exports_to'
  label?: string
}

/** Complete lineage graph for a study */
export interface LineageGraph {
  studyId: string
  nodes: LineageNode[]
  edges: LineageEdge[]
  generatedAt: string
  integrityHash: string
}

// ─── Model Card (for Show Your Work) ──────────────────────────────────────────

/** Technical model card — not marketing, purely descriptive */
export interface ModelCard {
  modelType: OutcomeModelType
  estimand: EstimandType
  outcome: string
  population: string
  covariates: string[]
  weightingMethod: WeightingMethod
  matchingMethod: MatchingMethod
  softwareImplementation: string
  version: string
  randomSeed?: number
  formula: string
  formulaPlainEnglish: string
  inputDatasetVersion: string
  cohortVersion: string
  variableVersions: Record<string, number>
  rowCount: number
  exclusions: string[]
  weightsUsed: string
  diagnosticsSummary: DiagnosticResult[]
  sensitivityRuns: SensitivityRunSummary[]
  lineageChain: string[]
  changeHistory: AuditEvent[]
}

export interface SensitivityRunSummary {
  name: string
  whatChanged: string
  whyItExists: string
  primaryEstimate: number
  sensitivityEstimate: number
  primaryCI: [number, number]
  sensitivityCI: [number, number]
  estimandChanged: boolean
  direction: 'consistent' | 'attenuated' | 'reversed' | 'amplified'
}

// ─── User & Access Control ────────────────────────────────────────────────────

export type UserRole = 'data_engineer' | 'biostatistician' | 'clinical_scientist' | 'qa_compliance' | 'system_admin' | 'external_reviewer'

export interface UserAccessRecord {
  userId: string
  role: UserRole
  permissions: Permission[]
  grantedAt: string
  grantedBy: string
  lastModified: string
  modifiedBy: string
  active: boolean
}

export interface Permission {
  resource: string
  actions: ('create' | 'read' | 'modify' | 'execute' | 'approve' | 'export' | 'administer')[]
}
