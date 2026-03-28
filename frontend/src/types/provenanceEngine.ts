// ── Provenance Dependency Engine ──────────────────────────────────────────────
// Formal TypeScript interfaces for the artifact dependency graph, state machine,
// invalidation model, and explanation system used by the Data Lineage page.

// ─── Section 1: Study Requirements ──────────────────────────────────────────

/** A single variable required by the study, traced to the specification that requires it. */
export interface VariableRequirement {
  /** Canonical variable name (e.g. 'AGE', 'AVAL', 'TRT01P') */
  name: string
  /** Which part of the study specification requires this variable */
  requiredBy: 'population_definition' | 'endpoint_definition' | 'causal_framework' | 'treatment_assignment' | 'observation_window'
  /** SDTM domain this variable maps to (e.g. 'dm', 'ae', 'ex') */
  sdtmDomain: string
  /** ADaM dataset this variable flows into (e.g. 'adsl', 'adtte') */
  adamDataset: string | null
  /** Whether this variable is critical-path (blocks derivation if missing) */
  critical: boolean
}

/** Aggregated study requirements derived from the study definition and causal framework. */
export interface StudyRequirement {
  /** Unique requirement ID */
  id: string
  /** Human-readable label */
  label: string
  /** Specification source: which step defined this requirement */
  source: 'study_definition' | 'causal_framework' | 'endpoint_specification'
  /** Variables this requirement mandates */
  variables: VariableRequirement[]
  /** Whether this requirement is satisfied by current source data */
  satisfied: boolean
  /** Explanation of why satisfied or not */
  explanation: string
}

// ─── Section 2: Artifact State Machine ──────────────────────────────────────

/** All possible states an artifact (SDTM domain or ADaM dataset) can occupy. */
export type ArtifactState =
  | 'not_required'           // Study config does not require this artifact
  | 'required_unconfigured'  // Required but no action taken yet
  | 'awaiting_source_data'   // Required, but source data not yet registered
  | 'source_data_insufficient' // Source registered but missing critical variables
  | 'ready_for_mapping'      // Source data sufficient; SDTM mapping can proceed
  | 'mapped'                 // SDTM domain successfully generated
  | 'mapping_invalid'        // SDTM mapping failed validation
  | 'ready_for_derivation'   // All SDTM dependencies met; ADaM derivation can proceed
  | 'derived'                // ADaM dataset successfully generated
  | 'derivation_invalid'     // ADaM derivation failed validation
  | 'validated'              // Passed conformance validation (P21-style)
  | 'stale'                  // Upstream change detected; needs re-derivation
  | 'blocked'                // Cannot proceed; missing upstream dependency

/** Allowed transitions and actions for each artifact state. */
export interface StateTransition {
  from: ArtifactState
  to: ArtifactState
  trigger: string
  action: string
  /** Guard condition that must be true for this transition */
  guard?: string
}

/** Predefined state transitions for the artifact state machine. */
export const ARTIFACT_TRANSITIONS: StateTransition[] = [
  // SDTM domain transitions
  { from: 'required_unconfigured', to: 'awaiting_source_data', trigger: 'study_configured', action: 'Check source data registration' },
  { from: 'awaiting_source_data', to: 'source_data_insufficient', trigger: 'source_registered', action: 'Run coverage check', guard: 'critical variables missing' },
  { from: 'awaiting_source_data', to: 'ready_for_mapping', trigger: 'source_registered', action: 'Enable mapping CTA', guard: 'all critical variables present' },
  { from: 'source_data_insufficient', to: 'ready_for_mapping', trigger: 'source_updated', action: 'Re-check coverage', guard: 'critical variables now present' },
  { from: 'ready_for_mapping', to: 'mapped', trigger: 'mapping_completed', action: 'Store SDTM domain' },
  { from: 'mapped', to: 'mapping_invalid', trigger: 'validation_failed', action: 'Show validation errors' },
  { from: 'mapped', to: 'validated', trigger: 'validation_passed', action: 'Mark domain validated' },
  { from: 'mapping_invalid', to: 'mapped', trigger: 'remapping_completed', action: 'Re-store SDTM domain' },
  { from: 'mapped', to: 'stale', trigger: 'upstream_changed', action: 'Mark stale, suggest re-mapping' },
  { from: 'validated', to: 'stale', trigger: 'upstream_changed', action: 'Mark stale, invalidate downstream' },
  { from: 'stale', to: 'ready_for_mapping', trigger: 'acknowledged', action: 'Enable re-mapping' },

  // ADaM dataset transitions
  { from: 'required_unconfigured', to: 'blocked', trigger: 'deps_checked', action: 'Show blocking reason', guard: 'SDTM dependencies not mapped' },
  { from: 'blocked', to: 'ready_for_derivation', trigger: 'deps_satisfied', action: 'Enable derivation CTA' },
  { from: 'ready_for_derivation', to: 'derived', trigger: 'derivation_completed', action: 'Store ADaM dataset' },
  { from: 'derived', to: 'derivation_invalid', trigger: 'validation_failed', action: 'Show validation errors' },
  { from: 'derived', to: 'validated', trigger: 'validation_passed', action: 'Mark dataset validated' },
  { from: 'derived', to: 'stale', trigger: 'upstream_changed', action: 'Mark stale, suggest re-derivation' },
  { from: 'validated', to: 'stale', trigger: 'upstream_changed', action: 'Mark stale, invalidate downstream' },
  { from: 'stale', to: 'ready_for_derivation', trigger: 'acknowledged', action: 'Enable re-derivation' },
  { from: 'derivation_invalid', to: 'derived', trigger: 'rederivation_completed', action: 'Re-store ADaM dataset' },
]

// ─── Section 3: Invalidation Events ────────────────────────────────────────

/** Severity of an invalidation event — determines user action required. */
export type InvalidationSeverity = 'info' | 'warning' | 'critical'

/** An event that invalidates one or more downstream artifacts. */
export interface InvalidationEvent {
  /** Unique event ID */
  id: string
  /** Timestamp of the invalidation */
  timestamp: string
  /** What upstream change triggered this invalidation */
  source: string
  /** Which upstream step changed (e.g. 'study_definition', 'causal_framework') */
  sourceStep: string
  /** Which specific field or config changed */
  changedField: string
  /** Artifacts directly affected by this change */
  affectedArtifacts: string[]
  /** Transitive downstream artifacts also invalidated */
  transitiveArtifacts: string[]
  /** Severity of the invalidation */
  severity: InvalidationSeverity
  /** Human-readable description of impact */
  description: string
  /** Whether the user has acknowledged this invalidation */
  acknowledged: boolean
}

/** Predefined invalidation rules mapping upstream changes to downstream impacts. */
export interface InvalidationRule {
  /** What changed upstream */
  trigger: string
  /** Source step */
  sourceStep: string
  /** Directly affected artifact IDs */
  directImpacts: string[]
  /** Transitively affected artifact IDs */
  transitiveImpacts: string[]
  /** Severity */
  severity: InvalidationSeverity
  /** Template for the description */
  descriptionTemplate: string
}

export const INVALIDATION_RULES: InvalidationRule[] = [
  {
    trigger: 'primary_endpoint_changed',
    sourceStep: 'study_definition',
    directImpacts: ['adtte'],
    transitiveImpacts: ['km_figure', 'forest_plot'],
    severity: 'critical',
    descriptionTemplate: 'Primary endpoint definition changed. ADTTE derivation and all downstream TFLs must be re-derived.',
  },
  {
    trigger: 'covariate_set_changed',
    sourceStep: 'causal_framework',
    directImpacts: ['coverage_assessment', 'adsl'],
    transitiveImpacts: ['adtte', 'love_plot', 'forest_plot'],
    severity: 'critical',
    descriptionTemplate: 'Covariate set modified in DAG. Coverage assessment invalid; ADSL and downstream datasets require re-derivation.',
  },
  {
    trigger: 'population_definition_changed',
    sourceStep: 'study_definition',
    directImpacts: ['adsl'],
    transitiveImpacts: ['adae', 'adtte', 'demographics_table'],
    severity: 'critical',
    descriptionTemplate: 'Population inclusion/exclusion criteria changed. ADSL population flags must be re-derived.',
  },
  {
    trigger: 'source_data_replaced',
    sourceStep: 'data_sources',
    directImpacts: ['dm', 'ae', 'lb', 'vs', 'ex', 'ds'],
    transitiveImpacts: ['adsl', 'adae', 'adtte', 'coverage_assessment'],
    severity: 'critical',
    descriptionTemplate: 'Source dataset replaced. All SDTM domains and downstream derivations must be regenerated.',
  },
  {
    trigger: 'observation_window_changed',
    sourceStep: 'study_definition',
    directImpacts: ['adtte', 'coverage_assessment'],
    transitiveImpacts: ['km_figure'],
    severity: 'warning',
    descriptionTemplate: 'Observation window modified. Time-to-event censoring rules may be affected.',
  },
  {
    trigger: 'treatment_arm_changed',
    sourceStep: 'study_definition',
    directImpacts: ['ex', 'adsl'],
    transitiveImpacts: ['adtte', 'demographics_table', 'forest_plot'],
    severity: 'critical',
    descriptionTemplate: 'Treatment arm definition changed. Exposure mapping and population assignment require update.',
  },
  {
    trigger: 'censoring_rules_changed',
    sourceStep: 'study_definition',
    directImpacts: ['adtte'],
    transitiveImpacts: ['km_figure'],
    severity: 'warning',
    descriptionTemplate: 'Censoring rules updated. ADTTE time-to-event derivation may produce different results.',
  },
]

// ─── Section 4: Data Source Profile ─────────────────────────────────────────

/** Profile of a registered source dataset, summarizing its coverage and quality. */
export interface DataSourceProfile {
  /** Unique dataset ID */
  id: string
  /** Original filename */
  filename: string
  /** Source type (EHR, Claims, Trial Data, Registry) */
  sourceType: 'EHR' | 'Claims' | 'Trial Data' | 'Registry' | 'Other'
  /** Row count */
  rowCount: number
  /** Column names detected */
  columns: string[]
  /** Compliance status from ingestion checks */
  complianceStatus: 'CLEARED' | 'BLOCKED' | 'CLEARED_WITH_WARNINGS'
  /** SHA-256 hash of the source file */
  fileHash: string
  /** Upload timestamp */
  uploadTimestamp: string
  /** Consent attestation ID linked to this upload */
  consentId: string
  /** Overall missingness rate (0–1) */
  missingnessRate: number
  /** N by treatment arm */
  armCounts: Record<string, number>
  /** Observation window start */
  observationStart: string | null
  /** Observation window end */
  observationEnd: string | null
}

// ─── Section 5: Coverage Assessment ─────────────────────────────────────────

/** Coverage status for a single variable category. */
export type CoverageStatus = 'Present' | 'Partial' | 'Missing' | 'Not Required'

/** Result of comparing study-required variables against registered source data. */
export interface CoverageAssessment {
  /** Overall coverage score (0–100) */
  overallScore: number
  /** Number of required variable categories present */
  presentCount: number
  /** Number of required variable categories partially present */
  partialCount: number
  /** Number of required variable categories missing */
  missingCount: number
  /** Total required variable categories */
  totalRequired: number
  /** Per-category assessment */
  categories: CoverageCategory[]
  /** Whether coverage is sufficient to proceed to mapping */
  sufficientForMapping: boolean
  /** Blocking reasons if not sufficient */
  blockingReasons: string[]
}

export interface CoverageCategory {
  /** Category name (e.g. 'Demographic Variables') */
  name: string
  /** Which study requirement mandates this category */
  requiredBy: string
  /** Coverage status */
  status: CoverageStatus
  /** Source dataset providing these variables */
  source: string
  /** Specific variables in this category */
  variables: string[]
  /** Notes or additional context */
  notes: string
}

// ─── Section 6: Artifact Dependency Graph ───────────────────────────────────

/** A dependency relationship between two artifacts. */
export interface ArtifactDependency {
  /** Source artifact ID (upstream) */
  from: string
  /** Target artifact ID (downstream) */
  to: string
  /** Type of dependency */
  type: 'requires' | 'derives_from' | 'validates_against'
  /** Whether this is a hard dependency (blocks if missing) or soft (warning only) */
  hard: boolean
  /** Description of the dependency relationship */
  description: string
}

/** Complete dependency graph for a study's artifacts. */
export const ARTIFACT_DEPENDENCY_GRAPH: ArtifactDependency[] = [
  // Source data → SDTM domains
  { from: 'source_data', to: 'sdtm_dm', type: 'requires', hard: true, description: 'DM domain requires registered demographic source data' },
  { from: 'source_data', to: 'sdtm_ae', type: 'requires', hard: true, description: 'AE domain requires registered adverse event source data' },
  { from: 'source_data', to: 'sdtm_lb', type: 'requires', hard: false, description: 'LB domain requires laboratory source data (optional)' },
  { from: 'source_data', to: 'sdtm_vs', type: 'requires', hard: false, description: 'VS domain requires vital sign source data (optional)' },
  { from: 'source_data', to: 'sdtm_ex', type: 'requires', hard: true, description: 'EX domain requires exposure/treatment source data' },
  { from: 'source_data', to: 'sdtm_ds', type: 'requires', hard: true, description: 'DS domain requires disposition source data' },

  // SDTM domains → ADaM datasets
  { from: 'sdtm_dm', to: 'adam_adsl', type: 'derives_from', hard: true, description: 'ADSL derives subject-level variables from DM' },
  { from: 'sdtm_ex', to: 'adam_adsl', type: 'derives_from', hard: true, description: 'ADSL derives treatment exposure from EX' },
  { from: 'sdtm_ds', to: 'adam_adsl', type: 'derives_from', hard: true, description: 'ADSL derives disposition flags from DS' },
  { from: 'sdtm_ae', to: 'adam_adae', type: 'derives_from', hard: true, description: 'ADAE derives adverse events from AE domain' },
  { from: 'adam_adsl', to: 'adam_adae', type: 'derives_from', hard: true, description: 'ADAE joins with ADSL for population flags' },
  { from: 'sdtm_dm', to: 'adam_adtte', type: 'derives_from', hard: true, description: 'ADTTE derives baseline from DM' },
  { from: 'sdtm_ex', to: 'adam_adtte', type: 'derives_from', hard: true, description: 'ADTTE derives treatment timing from EX' },
  { from: 'adam_adsl', to: 'adam_adtte', type: 'derives_from', hard: true, description: 'ADTTE joins with ADSL for population and analysis flags' },

  // Study definition → artifacts
  { from: 'study_definition', to: 'coverage_assessment', type: 'requires', hard: true, description: 'Coverage assessment needs study-defined required variables' },
  { from: 'causal_framework', to: 'coverage_assessment', type: 'requires', hard: true, description: 'Coverage assessment needs DAG-specified covariates' },
  { from: 'study_definition', to: 'adam_adtte', type: 'requires', hard: true, description: 'ADTTE needs endpoint definition and censoring rules' },
  { from: 'study_definition', to: 'adam_adsl', type: 'requires', hard: true, description: 'ADSL needs population definition and inclusion criteria' },
]

// ─── Section 7: Validation Result ───────────────────────────────────────────

/** Result of validating an artifact against conformance rules. */
export interface ValidationResult {
  /** Artifact being validated */
  artifactId: string
  /** Artifact type */
  artifactType: 'sdtm_domain' | 'adam_dataset' | 'source_data'
  /** Whether validation passed */
  passed: boolean
  /** Timestamp of validation */
  timestamp: string
  /** Individual check results */
  checks: ValidationCheck[]
  /** Overall conformance score (0–100) */
  conformanceScore: number
  /** P21-style error count */
  errorCount: number
  /** P21-style warning count */
  warningCount: number
}

export interface ValidationCheck {
  /** Check ID (e.g. 'SD0001', 'AD0001') */
  checkId: string
  /** Check description */
  description: string
  /** Severity */
  severity: 'error' | 'warning' | 'info'
  /** Whether this check passed */
  passed: boolean
  /** Detail message if failed */
  detail: string | null
  /** Affected records count */
  affectedRecords: number | null
}

// ─── Section 8: Provenance Artifact (Unified) ──────────────────────────────

/** A unified provenance artifact combining state, dependencies, and validation. */
export interface ProvenanceArtifact {
  /** Unique artifact ID (e.g. 'sdtm_dm', 'adam_adsl') */
  id: string
  /** Display name */
  name: string
  /** Category */
  category: 'sdtm_domain' | 'adam_dataset' | 'source_data' | 'coverage_assessment'
  /** Current state in the state machine */
  state: ArtifactState
  /** Previous state (for transition tracking) */
  previousState: ArtifactState | null
  /** When the state last changed */
  stateChangedAt: string | null
  /** Whether this artifact is required by the current study configuration */
  required: boolean
  /** Why this artifact is required (or not) */
  requirednessReason: string
  /** IDs of artifacts this one depends on (upstream) */
  upstreamDependencies: string[]
  /** IDs of artifacts that depend on this one (downstream) */
  downstreamDependents: string[]
  /** Most recent validation result */
  lastValidation: ValidationResult | null
  /** Active invalidation events affecting this artifact */
  activeInvalidations: InvalidationEvent[]
  /** Cryptographic hash of the artifact content */
  contentHash: string | null
  /** Explanation of current status for user display */
  statusExplanation: ArtifactExplanation
}

// ─── Section 9: Explanation Templates ───────────────────────────────────────

/** Structured explanation for displaying artifact status to users. */
export interface ArtifactExplanation {
  /** Short status label for badges (e.g. 'Blocked', 'Ready for Derivation') */
  statusLabel: string
  /** One-sentence summary for display under the artifact name */
  summary: string
  /** Detailed explanation for tooltip or expanded view */
  detail: string
  /** Recommended next action */
  nextAction: string | null
  /** CTA button label (null if no action available) */
  ctaLabel: string | null
  /** Whether the CTA is enabled */
  ctaEnabled: boolean
}

/** Generate explanation for an artifact based on its current state. */
export function getArtifactExplanation(state: ArtifactState, context: {
  artifactName: string
  missingDeps?: string[]
  staleSource?: string
  validationErrors?: number
}): ArtifactExplanation {
  const { artifactName, missingDeps = [], staleSource, validationErrors } = context

  switch (state) {
    case 'not_required':
      return {
        statusLabel: 'Not Required',
        summary: `${artifactName} is not required by the current study configuration.`,
        detail: 'This artifact is optional given the endpoints, covariates, and population rules defined. It will become required if the study specification changes to reference variables in this domain.',
        nextAction: null,
        ctaLabel: null,
        ctaEnabled: false,
      }
    case 'required_unconfigured':
      return {
        statusLabel: 'Not Started',
        summary: `${artifactName} is required but no action has been taken.`,
        detail: 'Register source data containing the required variables, then proceed to mapping.',
        nextAction: 'Register source data with required variables',
        ctaLabel: 'Register Source Data',
        ctaEnabled: true,
      }
    case 'awaiting_source_data':
      return {
        statusLabel: 'Awaiting Data',
        summary: `${artifactName} requires source data registration before mapping can begin.`,
        detail: 'Upload and register a de-identified source dataset containing the variables needed for this domain.',
        nextAction: 'Upload source data via the Source Data Registration section',
        ctaLabel: 'Register Source Data',
        ctaEnabled: true,
      }
    case 'source_data_insufficient':
      return {
        statusLabel: 'Insufficient Data',
        summary: `Source data is registered but missing critical variables for ${artifactName}.`,
        detail: `The registered dataset does not contain all variables required for ${artifactName}. Review the coverage assessment for specifics. You may need to register an additional source or update your existing dataset.`,
        nextAction: 'Review coverage gaps and update source data',
        ctaLabel: 'View Coverage Gaps',
        ctaEnabled: true,
      }
    case 'ready_for_mapping':
      return {
        statusLabel: 'Ready for Mapping',
        summary: `Source data is sufficient. ${artifactName} is ready for SDTM mapping.`,
        detail: 'All required variables are present in the registered source data. Click to generate the SDTM domain mapping.',
        nextAction: 'Generate SDTM domain mapping',
        ctaLabel: 'Complete Mapping',
        ctaEnabled: true,
      }
    case 'mapped':
      return {
        statusLabel: 'Mapped',
        summary: `${artifactName} has been mapped to SDTM format.`,
        detail: 'Domain mapping is complete. Run domain validation to verify conformance before downstream derivation.',
        nextAction: 'Run domain validation',
        ctaLabel: 'Run Domain Validation',
        ctaEnabled: true,
      }
    case 'mapping_invalid':
      return {
        statusLabel: 'Validation Failed',
        summary: `${artifactName} mapping failed conformance validation.`,
        detail: `Validation identified ${validationErrors ?? 'unknown'} error(s). Review and correct mapping issues before re-validating.`,
        nextAction: 'Review validation errors and re-map',
        ctaLabel: 'Re-map Domain',
        ctaEnabled: true,
      }
    case 'ready_for_derivation':
      return {
        statusLabel: 'Ready for Derivation',
        summary: `All SDTM dependencies are met. ${artifactName} can be derived.`,
        detail: 'All upstream SDTM domains are mapped and validated. Click to derive this analysis dataset from the specification.',
        nextAction: 'Derive analysis dataset',
        ctaLabel: 'Derive from Specification',
        ctaEnabled: true,
      }
    case 'derived':
      return {
        statusLabel: 'Derived',
        summary: `${artifactName} has been derived from upstream SDTM domains.`,
        detail: 'Dataset derivation is complete. Run validation to verify conformance and completeness.',
        nextAction: 'Run dataset validation',
        ctaLabel: 'Validate Dataset',
        ctaEnabled: true,
      }
    case 'derivation_invalid':
      return {
        statusLabel: 'Validation Failed',
        summary: `${artifactName} derivation failed conformance validation.`,
        detail: `Validation identified ${validationErrors ?? 'unknown'} error(s). Review derivation logic and re-derive.`,
        nextAction: 'Review validation errors and re-derive',
        ctaLabel: 'Re-derive Dataset',
        ctaEnabled: true,
      }
    case 'validated':
      return {
        statusLabel: 'Validated',
        summary: `${artifactName} has passed conformance validation.`,
        detail: 'This artifact is validated and ready for downstream use. No action required unless upstream data changes.',
        nextAction: null,
        ctaLabel: null,
        ctaEnabled: false,
      }
    case 'stale':
      return {
        statusLabel: 'Stale',
        summary: `${artifactName} is outdated due to upstream changes${staleSource ? ` (${staleSource})` : ''}.`,
        detail: 'An upstream dependency has been modified since this artifact was last generated. Re-derivation is required to reflect current specification.',
        nextAction: 'Acknowledge staleness and re-derive',
        ctaLabel: 'Re-derive',
        ctaEnabled: true,
      }
    case 'blocked':
      return {
        statusLabel: 'Blocked',
        summary: `${artifactName} cannot proceed — missing upstream dependencies.`,
        detail: missingDeps.length > 0
          ? `Blocked: ${missingDeps.join(', ')} ${missingDeps.length > 1 ? 'are' : 'is'} required for derivation but not yet mapped.`
          : 'One or more upstream dependencies are not yet available.',
        nextAction: `Complete mapping for ${missingDeps.join(', ')}`,
        ctaLabel: 'View Blocking Dependencies',
        ctaEnabled: true,
      }
    default:
      return {
        statusLabel: 'Unknown',
        summary: `${artifactName} is in an unknown state.`,
        detail: 'Unable to determine artifact status. Contact support.',
        nextAction: null,
        ctaLabel: null,
        ctaEnabled: false,
      }
  }
}

// ─── Section 10: State Machine Resolver ─────────────────────────────────────

/** Resolve the current artifact state based on runtime conditions. */
export function resolveArtifactState(params: {
  artifactId: string
  category: 'sdtm_domain' | 'adam_dataset'
  required: boolean
  sourceDataRegistered: boolean
  coverageSufficient: boolean
  isMapped: boolean
  isDerived: boolean
  validationPassed: boolean | null
  validationFailed: boolean
  isStale: boolean
  missingDeps: string[]
}): ArtifactState {
  const {
    required, sourceDataRegistered, coverageSufficient, isMapped,
    isDerived, validationPassed, validationFailed, isStale, missingDeps,
    category,
  } = params

  if (!required) return 'not_required'

  // Staleness overrides most states
  if (isStale && (isMapped || isDerived)) return 'stale'

  if (category === 'adam_dataset') {
    if (missingDeps.length > 0) return 'blocked'
    if (validationPassed) return 'validated'
    if (validationFailed && isDerived) return 'derivation_invalid'
    if (isDerived) return 'derived'
    if (isMapped || missingDeps.length === 0) return 'ready_for_derivation'
    return 'required_unconfigured'
  }

  // SDTM domain
  if (validationPassed) return 'validated'
  if (validationFailed && isMapped) return 'mapping_invalid'
  if (isMapped) return 'mapped'
  if (!sourceDataRegistered) return 'awaiting_source_data'
  if (!coverageSufficient) return 'source_data_insufficient'
  return 'ready_for_mapping'
}

// ─── Section 11: Status Color & Badge Helpers ───────────────────────────────

/** Map artifact state to Tailwind badge classes. */
export function getStateBadgeClasses(state: ArtifactState): string {
  const map: Record<ArtifactState, string> = {
    not_required: 'bg-gray-100 border-gray-200 text-gray-500',
    required_unconfigured: 'bg-gray-100 border-gray-200 text-gray-600',
    awaiting_source_data: 'bg-amber-50 border-amber-200 text-amber-700',
    source_data_insufficient: 'bg-red-50 border-red-200 text-red-700',
    ready_for_mapping: 'bg-sky-50 border-sky-200 text-sky-700',
    mapped: 'bg-blue-50 border-blue-200 text-blue-700',
    mapping_invalid: 'bg-red-50 border-red-200 text-red-700',
    ready_for_derivation: 'bg-sky-50 border-sky-200 text-sky-700',
    derived: 'bg-blue-50 border-blue-200 text-blue-700',
    derivation_invalid: 'bg-red-50 border-red-200 text-red-700',
    validated: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    stale: 'bg-amber-50 border-amber-200 text-amber-700',
    blocked: 'bg-red-50 border-red-200 text-red-700',
  }
  return map[state] || 'bg-gray-100 border-gray-200 text-gray-500'
}
