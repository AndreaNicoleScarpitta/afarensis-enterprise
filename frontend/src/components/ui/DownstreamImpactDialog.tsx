/**
 * DownstreamImpactDialog — Pre-save confirmation showing what downstream
 * steps will be invalidated by saving changes to the current step.
 *
 * Gives users clear, biostatistically-informed context about the ripple
 * effect of their changes before they commit.
 */
import { AlertTriangle, ArrowRight, Save, X, ChevronRight, Zap } from 'lucide-react'
import { useState } from 'react'

export interface DownstreamImpact {
  step: string
  label: string
  impact: string
  /** Transitive depth: 1 = direct, 2 = indirect via a direct dep, etc. */
  depth: number
}

interface DownstreamImpactDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  saving?: boolean
  currentStepLabel: string
  directImpacts: DownstreamImpact[]
  transitiveImpacts: DownstreamImpact[]
}

/**
 * Full-screen dependency graph for the workflow.
 * Reverse-lookup: for a given step, which downstream steps depend on it?
 */
const DOWNSTREAM_DEPS: Record<string, string[]> = {
  definition:        ['covariates', 'data_sources', 'cohort', 'balance', 'effect_estimation', 'bias', 'regulatory'],
  covariates:        ['data_sources', 'cohort', 'balance', 'effect_estimation', 'bias'],
  data_sources:      ['cohort', 'balance', 'effect_estimation', 'reproducibility'],
  cohort:            ['balance', 'effect_estimation', 'bias', 'reproducibility'],
  balance:           ['effect_estimation', 'bias'],
  effect_estimation: ['bias', 'regulatory'],
  bias:              ['regulatory'],
  reproducibility:   ['regulatory'],
  audit:             ['regulatory'],
  regulatory:        [],
}

const STEP_LABELS: Record<string, string> = {
  definition: 'Study Definition',
  covariates: 'Causal Framework',
  data_sources: 'Data Provenance',
  cohort: 'Cohort Construction',
  balance: 'Comparability & Balance',
  effect_estimation: 'Effect Estimation',
  bias: 'Bias & Sensitivity',
  reproducibility: 'Reproducibility',
  audit: 'Audit Trail',
  regulatory: 'Regulatory Output',
}

const STEP_NUMBERS: Record<string, number> = {
  definition: 1, covariates: 2, data_sources: 3, cohort: 4,
  balance: 5, effect_estimation: 6, bias: 7, reproducibility: 8,
  audit: 9, regulatory: 10,
}

/**
 * Impact descriptions: what breaks downstream when a given step changes.
 * Keyed as IMPACT_MAP[upstream][downstream].
 */
const IMPACT_MAP: Record<string, Record<string, string>> = {
  definition: {
    covariates: 'Endpoint or estimand change may invalidate the causal DAG structure and confounder identification.',
    data_sources: 'Endpoint change may require different SDTM/ADaM domains and variable sourcing.',
    cohort: 'Design or comparator changes invalidate inclusion/exclusion criteria and the attrition funnel.',
    balance: 'Estimand change (ATT vs ATE) changes the target population for balance assessment.',
    effect_estimation: 'Endpoint type change may make the current analysis method inappropriate (e.g., Cox PH for binary endpoint).',
    bias: 'E-value and sensitivity calculations are specific to the effect estimate and endpoint type.',
    regulatory: 'SAR/SAP narrative references the estimand, endpoint, and design throughout.',
  },
  covariates: {
    data_sources: 'Adding/removing covariates changes which variables must be captured in the data.',
    cohort: 'DAG-identified confounders determine propensity score model variables.',
    balance: 'The covariate set for balance assessment comes directly from the DAG.',
    effect_estimation: 'Unmeasured confounders affect sensitivity specifications and model adjustment.',
    bias: 'E-value interpretation depends on measured vs. unmeasured confounder sets.',
  },
  data_sources: {
    cohort: 'Data source changes may alter available patient populations and sample sizes.',
    balance: 'Different data sources affect variable availability for balance covariates.',
    effect_estimation: 'Input dataset change means all analytic results are stale.',
    reproducibility: 'Reproducibility manifest references specific data source hashes.',
  },
  cohort: {
    balance: 'Any change to inclusion/exclusion criteria changes the analytic cohort; all propensity scores and SMDs must be recomputed.',
    effect_estimation: 'A different cohort produces different effect estimates.',
    bias: 'Sensitivity analyses referencing the primary cohort are invalid.',
    reproducibility: 'Code manifest references the cohort construction script.',
  },
  balance: {
    effect_estimation: 'If propensity score weights changed, the weighted analysis must be re-run.',
    bias: 'Residual imbalance feeds directly into bias quantification (E-value, negative controls).',
  },
  effect_estimation: {
    bias: 'Sensitivity analyses are robustness checks of the primary estimate; if the primary changes, all sensitivities are stale.',
    regulatory: 'Forest plot data, primary HR/OR/RR, and confidence intervals flow into the regulatory narrative.',
  },
  bias: {
    regulatory: 'Bias quantification and sensitivity findings are required sections in regulatory submissions.',
  },
  reproducibility: {
    regulatory: 'Reproducibility manifest and hashes are referenced in the submission package.',
  },
  audit: {
    regulatory: 'Audit completeness is a regulatory readiness requirement.',
  },
}

/** Compute all downstream impacts for a given step */
export function computeDownstreamImpacts(currentStep: string): { direct: DownstreamImpact[]; transitive: DownstreamImpact[] } {
  const directDeps = DOWNSTREAM_DEPS[currentStep] || []
  const impactMap = IMPACT_MAP[currentStep] || {}

  const direct: DownstreamImpact[] = directDeps.map(dep => ({
    step: dep,
    label: STEP_LABELS[dep] || dep,
    impact: impactMap[dep] || 'Results may need recomputation.',
    depth: 1,
  }))

  // Compute transitive (indirect) impacts — steps that depend on our direct deps
  const visited = new Set([currentStep, ...directDeps])
  const transitive: DownstreamImpact[] = []

  const depthQueue: { dep: string; d: number }[] = directDeps.map(d => ({ dep: d, d: 2 }))

  for (const item of depthQueue) {
    const childDeps = DOWNSTREAM_DEPS[item.dep] || []
    for (const child of childDeps) {
      if (!visited.has(child)) {
        visited.add(child)
        const childImpactMap = IMPACT_MAP[item.dep] || {}
        transitive.push({
          step: child,
          label: STEP_LABELS[child] || child,
          impact: childImpactMap[child] || `Indirectly affected via ${STEP_LABELS[item.dep]}.`,
          depth: item.d,
        })
        depthQueue.push({ dep: child, d: item.d + 1 })
      }
    }
  }

  // Sort by step number
  direct.sort((a, b) => (STEP_NUMBERS[a.step] || 0) - (STEP_NUMBERS[b.step] || 0))
  transitive.sort((a, b) => (STEP_NUMBERS[a.step] || 0) - (STEP_NUMBERS[b.step] || 0))

  return { direct, transitive }
}

export default function DownstreamImpactDialog({
  open, onClose, onConfirm, saving,
  currentStepLabel, directImpacts, transitiveImpacts,
}: DownstreamImpactDialogProps) {
  const [showTransitive, setShowTransitive] = useState(false)
  const totalAffected = directImpacts.length + transitiveImpacts.length

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-[#111112] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Downstream Impact Preview</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Saving changes to <span className="text-amber-400 font-semibold">{currentStepLabel}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 bg-amber-950/20 border-b border-amber-700/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-300">
              <span className="font-bold">{totalAffected} downstream {totalAffected === 1 ? 'step' : 'steps'}</span> will
              be flagged as needing review after this save.
            </p>
          </div>
        </div>

        {/* Direct impacts */}
        <div className="px-5 py-3 max-h-[45vh] overflow-y-auto space-y-2">
          {directImpacts.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Direct dependencies ({directImpacts.length})
              </p>
              {directImpacts.map((d) => (
                <div key={d.step} className="rounded-md border border-white/8 bg-white/3 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-black text-amber-500 tabular-nums w-4 text-center">
                      {String(STEP_NUMBERS[d.step] || '?').padStart(2, '0')}
                    </span>
                    <ArrowRight className="h-3 w-3 text-amber-500/50" />
                    <span className="text-xs font-semibold text-white">{d.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed pl-6">{d.impact}</p>
                </div>
              ))}
            </>
          )}

          {/* Transitive impacts (collapsible) */}
          {transitiveImpacts.length > 0 && (
            <>
              <button
                onClick={() => setShowTransitive(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 hover:text-gray-300 transition-colors"
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${showTransitive ? 'rotate-90' : ''}`} />
                Indirect cascade ({transitiveImpacts.length} additional)
              </button>
              {showTransitive && (
                <div className="space-y-2 pl-2 border-l border-white/6 ml-1">
                  {transitiveImpacts.map((d) => (
                    <div key={d.step} className="rounded-md border border-white/6 bg-white/2 p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-gray-600 tabular-nums w-4 text-center">
                          {String(STEP_NUMBERS[d.step] || '?').padStart(2, '0')}
                        </span>
                        <ArrowRight className="h-2.5 w-2.5 text-gray-600" />
                        <span className="text-[11px] font-medium text-gray-300">{d.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-relaxed pl-6">{d.impact}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {totalAffected === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">No downstream steps will be affected.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-white/8 flex items-center justify-between">
          <p className="text-[10px] text-gray-600 max-w-[200px]">
            Affected steps will show a staleness warning until reviewed.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-md text-xs font-medium text-gray-400 hover:text-white
                         border border-white/10 hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold
                         bg-[#2563EB] hover:bg-blue-600 text-white
                         disabled:opacity-50 transition-colors"
            >
              <Save className="h-3 w-3" />
              {saving ? 'Saving...' : 'Save & Notify Downstream'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
