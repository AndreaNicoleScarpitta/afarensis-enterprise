/**
 * Causal Specification Types
 *
 * The causal specification is the scientific backbone of every analysis.
 * It defines the causal DAG, estimand, treatment/outcome, confounders,
 * mediators, colliders, and the derived adjustment set.
 *
 * The DAG is a first-class production object:
 * - It is inspectable and reconstructable
 * - The adjustment logic traces back to it
 * - Report outputs reference it
 * - Regulators can verify causal framing matches executed analysis
 */

// ── Node Roles ───────────────────────────────────────────────────────────

export type CausalNodeRole =
  | 'treatment'
  | 'outcome'
  | 'confounder'
  | 'mediator'
  | 'collider'
  | 'effect_modifier'
  | 'instrument'
  | 'competing_risk'
  | 'censoring'
  | 'selection'
  | 'auxiliary'
  | 'time_zero'

export const ROLE_META: Record<CausalNodeRole, { label: string; color: string; description: string }> = {
  treatment:       { label: 'Treatment',        color: '#3B82F6', description: 'Exposure of interest' },
  outcome:         { label: 'Outcome',          color: '#EF4444', description: 'Primary endpoint' },
  confounder:      { label: 'Confounder',       color: '#F59E0B', description: 'Common cause of treatment and outcome' },
  mediator:        { label: 'Mediator',         color: '#8B5CF6', description: 'On the causal path between treatment and outcome' },
  collider:        { label: 'Collider',         color: '#EC4899', description: 'Common effect \u2014 conditioning opens spurious paths' },
  effect_modifier: { label: 'Effect Modifier',  color: '#14B8A6', description: 'Modifies the magnitude of the treatment effect' },
  instrument:      { label: 'Instrument',       color: '#6366F1', description: 'Affects treatment but not outcome directly' },
  competing_risk:  { label: 'Competing Risk',   color: '#DC2626', description: 'Precludes observation of the outcome event' },
  censoring:       { label: 'Censoring',        color: '#9CA3AF', description: 'Associated with loss to follow-up' },
  selection:       { label: 'Selection',        color: '#78716C', description: 'Affects entry into the study population' },
  auxiliary:       { label: 'Auxiliary',         color: '#06B6D4', description: 'Precision variable \u2014 improves efficiency' },
  time_zero:       { label: 'Time Zero',        color: '#A3E635', description: 'Index date definition for target trial emulation' },
}

// ── Edge Relationships ───────────────────────────────────────────────────

export type EdgeRelationship =
  | 'causes'
  | 'mediates'
  | 'confounds'
  | 'collides'
  | 'modifies'
  | 'selects'
  | 'censors'
  | 'associates'

export type EdgeStrength = 'strong' | 'moderate' | 'weak' | 'assumed'

// ── Core Data Structures ─────────────────────────────────────────────────

export interface CausalNode {
  id: string
  label: string
  role: CausalNodeRole
  variable_name?: string
  data_source?: string
  measurement_timing?: string
  measurement_status?: 'measured' | 'unmeasured' | 'partially_measured'
  rationale: string
  /** Position for DAG canvas rendering */
  x?: number
  y?: number
}

export interface CausalEdge {
  from_node: string
  to_node: string
  relationship: EdgeRelationship
  strength: EdgeStrength
  evidence?: string
}

export interface Estimand {
  type: 'ATT' | 'ATE' | 'ATEN' | 'CATE'
  summary: string
}

export interface Treatment {
  variable: string
  levels: string[]
  reference_arm: string
}

export interface Outcome {
  variable: string
  type: 'time-to-event' | 'continuous' | 'binary' | 'count' | 'composite'
  definition: string
}

export interface TimeZero {
  definition: string
  rationale: string
}

export interface CausalAssumption {
  id: string
  description: string
  testable: boolean
  test_result?: 'passed' | 'failed' | 'inconclusive' | 'not_tested'
  rationale: string
}

export interface CensoringLogic {
  mechanism: string
  assumption: 'independent' | 'informative'
  handling: string
}

// ── The Complete Causal Specification ────────────────────────────────────

export interface CausalSpecification {
  estimand: Estimand
  treatment: Treatment
  outcome: Outcome
  time_zero?: TimeZero
  nodes: CausalNode[]
  edges: CausalEdge[]
  adjustment_set?: string[]
  adjustment_labels?: string[]
  assumptions: CausalAssumption[]
  censoring_logic?: CensoringLogic
  version?: number
  content_hash?: string
}

// ── Adjustment Set Result ────────────────────────────────────────────────

export interface AdjustmentSetResult {
  adjustment_set: string[]
  adjustment_labels: string[]
  excluded_mediators: string[]
  excluded_colliders: string[]
  excluded_instruments: string[]
  explanation: string
  explanations: string[]
  warnings: string[]
}

// ── Validation Result ────────────────────────────────────────────────────

export interface CausalSpecValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  node_count: number
  edge_count: number
}

// ── Execution Events ─────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'data_preparation'
  | 'transformation'
  | 'model_fit'
  | 'diagnostic'
  | 'artifact_generation'
  | 'warning'
  | 'error'

export type ExecutionEventStatus = 'queued' | 'running' | 'completed' | 'warning' | 'failed'

export interface ExecutionEvent {
  id: string
  project_id: string
  run_id: string
  timestamp: string
  event_type: ExecutionEventType
  step_name: string
  step_index?: number
  total_steps?: number
  status: ExecutionEventStatus
  summary: string
  details?: Record<string, unknown>
  inputs?: string[]
  outputs?: string[]
  dag_node_ref?: string
  duration_ms?: number
}

// ── Analysis Configuration (biostatistician-tunable parameters) ──────────

export interface AnalysisConfig {
  // Bootstrap
  bootstrap_iterations: number
  bootstrap_seed: number
  bootstrap_min_successful: number

  // Confidence interval
  alpha: number
  z_critical: number

  // Cox PH convergence
  cox_max_iterations: number
  cox_convergence_tol: number

  // Propensity score model
  ps_max_iterations: number
  ps_optimizer: string
  ps_clip_range: [number, number]

  // IPTW weights
  iptw_trim_percentile: [number, number]
  iptw_stabilized: boolean
  iptw_sensitivity_trim: [number, number]

  // Balance & significance thresholds
  smd_balance_threshold: number
  significance_alpha: number

  // Data quality gates
  min_sample_size: number
  min_events: number
  min_covariate_coverage: number
  subgroup_min_size: number
  ps_matching_min_matched: number

  // Multiplicity adjustment
  multiplicity_method: 'holm' | 'bonferroni' | 'bh'

  // Competing risks
  competing_risk_enabled: boolean
  competing_risk_event_code: number
  competing_risk_codes: number[]

  // Simulation
  simulation_seed: number
  simulation_n_treated: number
  simulation_n_control: number
  simulation_true_hr: number
}

export const ANALYSIS_CONFIG_DEFAULTS: AnalysisConfig = {
  bootstrap_iterations: 500,
  bootstrap_seed: 42,
  bootstrap_min_successful: 50,
  alpha: 0.05,
  z_critical: 1.96,
  cox_max_iterations: 50,
  cox_convergence_tol: 1e-8,
  ps_max_iterations: 500,
  ps_optimizer: 'L-BFGS-B',
  ps_clip_range: [-500, 500],
  iptw_trim_percentile: [0.01, 0.99],
  iptw_stabilized: true,
  iptw_sensitivity_trim: [0.05, 0.95],
  smd_balance_threshold: 0.1,
  significance_alpha: 0.05,
  min_sample_size: 10,
  min_events: 5,
  min_covariate_coverage: 0.5,
  subgroup_min_size: 10,
  ps_matching_min_matched: 5,
  multiplicity_method: 'holm',
  competing_risk_enabled: false,
  competing_risk_event_code: 1,
  competing_risk_codes: [2],
  simulation_seed: 20240417,
  simulation_n_treated: 22,
  simulation_n_control: 875,
  simulation_true_hr: 0.82,
}

/** Describes which config field maps to which UI group */
export const ANALYSIS_CONFIG_GROUPS: Record<string, { label: string; description: string; fields: (keyof AnalysisConfig)[] }> = {
  bootstrap: {
    label: 'Bootstrap',
    description: 'Controls confidence interval estimation precision. More iterations = tighter CIs but slower computation.',
    fields: ['bootstrap_iterations', 'bootstrap_seed', 'bootstrap_min_successful'],
  },
  confidence: {
    label: 'Confidence Level',
    description: 'Controls the width of confidence intervals. α=0.05 gives 95% CIs; α=0.01 gives 99% CIs.',
    fields: ['alpha', 'z_critical'],
  },
  cox: {
    label: 'Cox PH Convergence',
    description: 'Newton-Raphson optimizer settings for Cox proportional hazards. Increase iterations if convergence fails.',
    fields: ['cox_max_iterations', 'cox_convergence_tol'],
  },
  propensity: {
    label: 'Propensity Score Model',
    description: 'Logistic regression settings for propensity score estimation.',
    fields: ['ps_max_iterations', 'ps_optimizer', 'ps_clip_range'],
  },
  iptw: {
    label: 'IPTW Weights',
    description: 'Inverse probability of treatment weighting settings. Trimming avoids extreme weights from near-violation of positivity.',
    fields: ['iptw_trim_percentile', 'iptw_stabilized', 'iptw_sensitivity_trim'],
  },
  thresholds: {
    label: 'Balance & Significance',
    description: 'Thresholds for declaring covariate balance and statistical significance.',
    fields: ['smd_balance_threshold', 'significance_alpha'],
  },
  data_quality: {
    label: 'Data Quality Gates',
    description: 'Minimum requirements for the analysis to proceed. Relaxing these may produce unreliable results.',
    fields: ['min_sample_size', 'min_events', 'min_covariate_coverage', 'subgroup_min_size', 'ps_matching_min_matched'],
  },
  multiplicity: {
    label: 'Multiplicity Adjustment',
    description: 'Method for controlling family-wise error rate across multiple comparisons.',
    fields: ['multiplicity_method'],
  },
  competing_risks: {
    label: 'Competing Risks',
    description: 'Fine-Gray subdistribution hazard model settings. Enable when multiple event types can occur.',
    fields: ['competing_risk_enabled', 'competing_risk_event_code', 'competing_risk_codes'],
  },
}
