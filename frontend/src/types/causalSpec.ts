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
