import React, { useState } from 'react'
import {
  Swords, Lock, Eye, AlertCircle, CheckCircle2, AlertTriangle, Info,
  BarChart3, Layers, Activity, Target, Loader2, Shield, ShieldAlert,
  ShieldCheck, ShieldX, Scale, GitBranch, Zap, XCircle, ChevronRight
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { logger } from '../services/logger'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttackSummary {
  robustness_score: number
  verdict: 'Robust' | 'Conditional' | 'Fragile' | 'Failed'
  critical_flags: string[]
  primary_hr: number
  primary_ci_lower: number
  primary_ci_upper: number
  hr_min: number
  hr_max: number
  e_value: number
  max_delta: number
  dimensions: {
    balance: number
    positivity: number
    stability: number
    confounding_robustness: number
    model_independence: number
  }
}

interface WeightMethod {
  method: string
  hr: number
  ci_lower: number
  ci_upper: number
  p_value: number
  ess: number
  max_weight: number
}

interface WeightingComparison {
  methods: WeightMethod[]
  model_dependence: number
}

interface PSDistribution {
  group: string
  min: number
  max: number
  mean: number
}

interface NearViolation {
  covariate: string
  stratum: string
  treatment_prevalence: number
  n_treated: number
  n_control: number
  flag: string
}

interface PositivityData {
  ps_distributions: PSDistribution[]
  near_violations: NearViolation[]
  ess_by_method: Record<string, number>
  extreme_weight_pct: number
  covariate_strata: Array<{
    covariate: string
    stratum: string
    treatment_prevalence: number
    n: number
  }>
}

interface Perturbation {
  name: string
  hr: number
  ci_lower: number
  ci_upper: number
  delta: number
  significant: boolean
}

interface StabilityData {
  primary_hr: number
  perturbations: Perturbation[]
  break_points: Array<{
    perturbation: string
    threshold: string
    description: string
  }>
}

interface ConfoundingSimRow {
  rr_tu: number
  rr_yu: number
  bias_adjusted_hr: number
  nullified: boolean
}

interface UnmeasuredConfoundingData {
  e_value: number
  e_value_ci: number
  interpretation: string
  simulation_grid: ConfoundingSimRow[]
  tipping_point: {
    rr_tu: number
    rr_yu: number
    description: string
  }
}

interface FailureMode {
  type: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  details: string
  impact: string
}

interface AttackData {
  summary: AttackSummary | null
  weighting_comparison: WeightingComparison | null
  positivity: PositivityData | null
  stability: StabilityData | null
  unmeasured_confounding: UnmeasuredConfoundingData | null
  failure_modes: FailureMode[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const verdictConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Robust:      { color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: <ShieldCheck className="h-5 w-5 text-emerald-600" /> },
  Conditional: { color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   icon: <ShieldAlert className="h-5 w-5 text-amber-600" /> },
  Fragile:     { color: 'text-orange-700',   bg: 'bg-orange-50',   border: 'border-orange-200',  icon: <ShieldX className="h-5 w-5 text-orange-600" /> },
  Failed:      { color: 'text-red-700',      bg: 'bg-red-50',      border: 'border-red-200',     icon: <XCircle className="h-5 w-5 text-red-600" /> },
}

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  critical: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: <XCircle className="h-4 w-4 text-red-500" /> },
  warning:  { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
  info:     { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Info className="h-4 w-4 text-blue-500" /> },
}

function fmt(n: number | undefined | null, decimals = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return n.toFixed(decimals)
}

function pct(n: number | undefined | null, decimals = 1): string {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(decimals)}%`
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabKey = 'summary' | 'weighting' | 'positivity' | 'stability' | 'confounding' | 'failures'

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'summary',     label: 'Attack Summary',         icon: <Target className="h-3 w-3" /> },
  { key: 'weighting',   label: 'Weighting Comparison',   icon: <Scale className="h-3 w-3" /> },
  { key: 'positivity',  label: 'Positivity Diagnostics', icon: <Layers className="h-3 w-3" /> },
  { key: 'stability',   label: 'Stability Envelope',     icon: <Activity className="h-3 w-3" /> },
  { key: 'confounding', label: 'Unmeasured Confounding',  icon: <GitBranch className="h-3 w-3" /> },
  { key: 'failures',    label: 'Failure Modes',           icon: <Zap className="h-3 w-3" /> },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegulatoryAttack({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: attackData, loading, error, refetch, runComputation } = useStudyData<AttackData>(selectedStudy?.id, 'regulatory_attack')

  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [running, setRunning] = useState(false)

  // Parsed sections with safe defaults
  const summary = attackData?.summary ?? null
  const weighting = attackData?.weighting_comparison ?? null
  const positivity = attackData?.positivity ?? null
  const stability = attackData?.stability ?? null
  const confounding = attackData?.unmeasured_confounding ?? null
  const failureModes = Array.isArray(attackData?.failure_modes) ? attackData.failure_modes : []

  const hasData = !!(summary || weighting || positivity || stability || confounding || failureModes.length > 0)

  // ---------------------------------------------------------------------------
  // Run adversarial review
  // ---------------------------------------------------------------------------

  const handleRunAttack = async () => {
    if (!selectedStudy?.id) return
    setRunning(true)
    try {
      await runComputation('regulatory-attack/run')
      await refetch()
    } catch (err) {
      logger.error('Adversarial review failed:', err)
    } finally {
      setRunning(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Dimension labels for the bar chart
  // ---------------------------------------------------------------------------

  const dimensionLabels: Record<string, string> = {
    balance: 'Balance',
    positivity: 'Positivity',
    stability: 'Stability',
    confounding_robustness: 'Confounding Robustness',
    model_independence: 'Model Independence',
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center">
              <Swords className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Adversarial Review</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900">Regulatory Attack Mode</h1>
              <p className="text-gray-500 text-xs mt-0.5">Adversarial Statistical Review Engine — stress-test every analytic assumption</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{selectedStudy?.protocol ?? '—'}</p>
            <p className="text-[10px] text-gray-500">
              {summary
                ? `Robustness: ${summary.robustness_score}/100 — ${summary.verdict}`
                : 'No attack results yet'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading regulatory attack data...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="flex-1 text-sm text-red-600">Error loading data: {error}</p>
            <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!hasData && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Shield className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-500">No adversarial review results</p>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              Run the adversarial review to stress-test weighting methods, positivity assumptions, stability under perturbation, and unmeasured confounding bounds.
            </p>
            {!locked && !reviewerMode && (
              <button
                onClick={handleRunAttack}
                disabled={running}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />}
                Run Adversarial Review
              </button>
            )}
          </div>
        )}

        {/* Tab navigation */}
        {hasData && (
          <>
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* ================================================================ */}
            {/* TAB 1: Attack Summary                                            */}
            {/* ================================================================ */}
            {activeTab === 'summary' && (
              <div className="space-y-5">

                {/* Verdict card */}
                {summary && (
                  <div className={`rounded-xl border p-5 ${verdictConfig[summary.verdict]?.bg ?? 'bg-gray-50'} ${verdictConfig[summary.verdict]?.border ?? 'border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        {verdictConfig[summary.verdict]?.icon}
                        <span className={`text-3xl font-black ${scoreColor(summary.robustness_score)}`}>
                          {summary.robustness_score}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">/ 100</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-bold ${verdictConfig[summary.verdict]?.color ?? 'text-gray-700'}`}>
                            Verdict: {summary.verdict}
                          </span>
                        </div>
                        {summary.critical_flags.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Critical Flags</span>
                            {summary.critical_flags.map((flag, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {flag}
                              </div>
                            ))}
                          </div>
                        )}
                        {summary.critical_flags.length === 0 && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                            <CheckCircle2 className="h-3 w-3" /> No critical flags identified
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="mt-4">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${scoreBg(summary.robustness_score)}`}
                          style={{ width: `${summary.robustness_score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Key metrics row */}
                {summary && (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Primary HR</span>
                      <p className="text-lg font-bold text-gray-900 mt-1">{fmt(summary.primary_hr)}</p>
                      <p className="text-[10px] text-gray-400">[{fmt(summary.primary_ci_lower)}, {fmt(summary.primary_ci_upper)}]</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Stability Range</span>
                      <p className="text-lg font-bold text-gray-900 mt-1">{fmt(summary.hr_min)} – {fmt(summary.hr_max)}</p>
                      <p className="text-[10px] text-gray-400">HR min to HR max</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">E-value</span>
                      <p className="text-lg font-bold text-gray-900 mt-1">{fmt(summary.e_value)}</p>
                      <p className="text-[10px] text-gray-400">Unmeasured confounding bound</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Max Delta</span>
                      <p className="text-lg font-bold text-gray-900 mt-1">{fmt(summary.max_delta, 4)}</p>
                      <p className="text-[10px] text-gray-400">Largest HR shift</p>
                    </div>
                  </div>
                )}

                {/* Dimension bar chart */}
                {summary?.dimensions && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Robustness Dimensions</h3>
                    <div className="space-y-3">
                      {Object.entries(summary.dimensions).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-44 shrink-0">{dimensionLabels[key] ?? key}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                            <div
                              className={`h-full rounded-full transition-all ${scoreBg(value)}`}
                              style={{ width: `${value}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                              {value.toFixed(0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run button */}
                {!locked && !reviewerMode && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleRunAttack}
                      disabled={running}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />}
                      {running ? 'Running Adversarial Review...' : 'Run Adversarial Review'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 2: Weighting Comparison                                      */}
            {/* ================================================================ */}
            {activeTab === 'weighting' && (
              <div className="space-y-5">
                {!weighting && (
                  <EmptySection message="No weighting comparison data available. Run the adversarial review to populate this section." />
                )}

                {weighting && (
                  <>
                    {/* Method cards */}
                    <div className="grid grid-cols-3 gap-4">
                      {weighting.methods.map((m) => {
                        const isSignificant = m.ci_upper < 1 || m.ci_lower > 1
                        return (
                          <div key={m.method} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{m.method}</h4>
                              {isSignificant
                                ? <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Sig</span>
                                : <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full font-semibold">NS</span>
                              }
                            </div>
                            <div>
                              <p className="text-lg font-bold text-gray-900">{fmt(m.hr)}</p>
                              <p className="text-[10px] text-gray-400">[{fmt(m.ci_lower)}, {fmt(m.ci_upper)}]</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div>
                                <span className="text-gray-400 block">p-value</span>
                                <span className="text-gray-700 font-mono font-semibold">{fmt(m.p_value, 4)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">ESS</span>
                                <span className="text-gray-700 font-mono font-semibold">{fmt(m.ess, 0)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Max Wt</span>
                                <span className="text-gray-700 font-mono font-semibold">{fmt(m.max_weight)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Visual HR comparison bar */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">HR Point Estimates Across Methods</h3>
                      {(() => {
                        const allLo = weighting.methods.map(m => m.ci_lower)
                        const allHi = weighting.methods.map(m => m.ci_upper)
                        const xMin = Math.max(0.01, Math.floor((Math.min(...allLo, 1) - 0.1) * 10) / 10)
                        const xMax = Math.ceil((Math.max(...allHi, 1) + 0.1) * 10) / 10
                        const range = xMax - xMin
                        const nullPct = ((1 - xMin) / range) * 100

                        return (
                          <div className="space-y-3">
                            {weighting.methods.map((m) => {
                              const estPct = ((m.hr - xMin) / range) * 100
                              const loPct = ((m.ci_lower - xMin) / range) * 100
                              const hiPct = ((m.ci_upper - xMin) / range) * 100
                              return (
                                <div key={m.method} className="flex items-center gap-3">
                                  <span className="text-xs text-gray-600 w-28 shrink-0 text-right">{m.method}</span>
                                  <div className="flex-1 relative h-6">
                                    {/* Null line */}
                                    <div className="absolute top-0 bottom-0 w-px bg-gray-400/60" style={{ left: `${nullPct}%` }} />
                                    {/* CI line */}
                                    <div
                                      className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-gray-400/60"
                                      style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }}
                                    />
                                    {/* Point */}
                                    <div
                                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-red-500"
                                      style={{ left: `${estPct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-gray-600 w-24 shrink-0">
                                    {fmt(m.hr)} [{fmt(m.ci_lower)}, {fmt(m.ci_upper)}]
                                  </span>
                                </div>
                              )
                            })}
                            {/* Axis labels */}
                            <div className="flex items-center gap-3">
                              <span className="w-28 shrink-0" />
                              <div className="flex-1 flex justify-between text-[9px] text-gray-400">
                                <span>{xMin.toFixed(1)}</span>
                                <span>HR = 1.0</span>
                                <span>{xMax.toFixed(1)}</span>
                              </div>
                              <span className="w-24 shrink-0" />
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Model dependence metric */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                      <BarChart3 className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-gray-700">Model Dependence</span>
                        <p className="text-[10px] text-gray-400">
                          Measures how sensitive the result is to the choice of weighting method. Lower is better.
                        </p>
                      </div>
                      <span className={`text-lg font-bold ${weighting.model_dependence <= 0.1 ? 'text-emerald-600' : weighting.model_dependence <= 0.25 ? 'text-amber-600' : 'text-red-600'}`}>
                        {fmt(weighting.model_dependence, 3)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 3: Positivity Diagnostics                                    */}
            {/* ================================================================ */}
            {activeTab === 'positivity' && (
              <div className="space-y-5">
                {!positivity && (
                  <EmptySection message="No positivity diagnostics available. Run the adversarial review to populate this section." />
                )}

                {positivity && (
                  <>
                    {/* PS distribution stats */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Propensity Score Distribution</h3>
                      </div>
                      <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                        <div className="grid grid-cols-4 gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          <span>Group</span>
                          <span className="text-right">Min</span>
                          <span className="text-right">Mean</span>
                          <span className="text-right">Max</span>
                        </div>
                      </div>
                      {positivity.ps_distributions.map((ps, i) => (
                        <div key={i} className="px-4 py-2.5 border-b border-gray-100 last:border-0">
                          <div className="grid grid-cols-4 gap-3 text-xs">
                            <span className="font-medium text-gray-700">{ps.group}</span>
                            <span className="text-right font-mono text-gray-600">{fmt(ps.min, 4)}</span>
                            <span className="text-right font-mono text-gray-600">{fmt(ps.mean, 4)}</span>
                            <span className="text-right font-mono text-gray-600">{fmt(ps.max, 4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ESS by method + extreme weight pct */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Effective Sample Size by Method</h4>
                        <div className="space-y-2">
                          {Object.entries(positivity.ess_by_method).map(([method, ess]) => (
                            <div key={method} className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">{method}</span>
                              <span className="text-xs font-mono font-semibold text-gray-900">{fmt(ess, 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Extreme Weight %</span>
                        <span className={`text-3xl font-black mt-2 ${positivity.extreme_weight_pct <= 5 ? 'text-emerald-600' : positivity.extreme_weight_pct <= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                          {fmt(positivity.extreme_weight_pct, 1)}%
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">Subjects with extreme weights</span>
                      </div>
                    </div>

                    {/* Near-violation flags table */}
                    {positivity.near_violations.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" /> Near-Violation Flags
                          </h3>
                        </div>
                        <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                          <div className="grid grid-cols-6 gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                            <span>Covariate</span>
                            <span>Stratum</span>
                            <span className="text-right">Tx Prev</span>
                            <span className="text-right">N Treated</span>
                            <span className="text-right">N Control</span>
                            <span>Flag</span>
                          </div>
                        </div>
                        {positivity.near_violations.map((nv, i) => (
                          <div key={i} className="px-4 py-2 border-b border-gray-100 last:border-0">
                            <div className="grid grid-cols-6 gap-2 text-xs">
                              <span className="font-medium text-gray-700 truncate">{nv.covariate}</span>
                              <span className="text-gray-600 truncate">{nv.stratum}</span>
                              <span className="text-right font-mono text-gray-600">{pct(nv.treatment_prevalence)}</span>
                              <span className="text-right font-mono text-gray-600">{nv.n_treated}</span>
                              <span className="text-right font-mono text-gray-600">{nv.n_control}</span>
                              <span className="text-amber-600 text-[10px] font-semibold">{nv.flag}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {positivity.near_violations.length === 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700">No near-violations detected. Positivity assumption appears satisfied.</span>
                      </div>
                    )}

                    {/* Covariate-stratum treatment prevalence table */}
                    {positivity.covariate_strata.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Covariate-Stratum Treatment Prevalence</h3>
                        </div>
                        <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                          <div className="grid grid-cols-4 gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                            <span>Covariate</span>
                            <span>Stratum</span>
                            <span className="text-right">Tx Prevalence</span>
                            <span className="text-right">N</span>
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {positivity.covariate_strata.map((cs, i) => {
                            const lowPrev = cs.treatment_prevalence < 0.05 || cs.treatment_prevalence > 0.95
                            return (
                              <div key={i} className={`px-4 py-2 border-b border-gray-100 last:border-0 ${lowPrev ? 'bg-amber-50/50' : ''}`}>
                                <div className="grid grid-cols-4 gap-3 text-xs">
                                  <span className="font-medium text-gray-700 truncate">{cs.covariate}</span>
                                  <span className="text-gray-600 truncate">{cs.stratum}</span>
                                  <span className={`text-right font-mono ${lowPrev ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                                    {pct(cs.treatment_prevalence)}
                                  </span>
                                  <span className="text-right font-mono text-gray-600">{cs.n}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 4: Stability Envelope                                        */}
            {/* ================================================================ */}
            {activeTab === 'stability' && (
              <div className="space-y-5">
                {!stability && (
                  <EmptySection message="No stability envelope data available. Run the adversarial review to populate this section." />
                )}

                {stability && (
                  <>
                    {/* Tornado diagram */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">
                        Tornado Diagram — HR Sensitivity to Perturbations
                      </h3>
                      {(() => {
                        const allLo = stability.perturbations.map(p => p.ci_lower)
                        const allHi = stability.perturbations.map(p => p.ci_upper)
                        const primary = stability.primary_hr
                        const xMin = Math.max(0.01, Math.floor((Math.min(...allLo, primary, 1) - 0.15) * 10) / 10)
                        const xMax = Math.ceil((Math.max(...allHi, primary, 1) + 0.15) * 10) / 10
                        const range = xMax - xMin
                        const primaryPct = ((primary - xMin) / range) * 100
                        const nullPct = ((1 - xMin) / range) * 100

                        return (
                          <div className="space-y-2.5">
                            {stability.perturbations.map((p, i) => {
                              const loPct = ((p.ci_lower - xMin) / range) * 100
                              const hiPct = ((p.ci_upper - xMin) / range) * 100
                              const hrPct = ((p.hr - xMin) / range) * 100
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-[10px] text-gray-600 w-44 shrink-0 text-right truncate" title={p.name}>
                                    {p.name}
                                  </span>
                                  <div className="flex-1 relative h-5">
                                    {/* Null line */}
                                    <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: `${nullPct}%` }} />
                                    {/* Primary estimate reference */}
                                    <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-60" style={{ left: `${primaryPct}%` }} />
                                    {/* Bar from low to high */}
                                    <div
                                      className={`absolute top-1 bottom-1 rounded-sm ${p.significant ? 'bg-red-200 border border-red-300' : 'bg-gray-200 border border-gray-300'}`}
                                      style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }}
                                    />
                                    {/* HR point */}
                                    <div
                                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${p.significant ? 'bg-red-500' : 'bg-gray-500'}`}
                                      style={{ left: `${hrPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-500 w-20 shrink-0">
                                    {fmt(p.hr)} ({p.delta > 0 ? '+' : ''}{fmt(p.delta, 3)})
                                  </span>
                                </div>
                              )
                            })}
                            {/* Axis */}
                            <div className="flex items-center gap-3">
                              <span className="w-44 shrink-0" />
                              <div className="flex-1 flex justify-between text-[9px] text-gray-400 mt-1">
                                <span>{xMin.toFixed(1)}</span>
                                <span className="text-blue-400">Primary: {fmt(primary)}</span>
                                <span>{xMax.toFixed(1)}</span>
                              </div>
                              <span className="w-20 shrink-0" />
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Perturbations table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Perturbation Details</h3>
                      </div>
                      <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                        <div className="grid grid-cols-6 gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          <span className="col-span-2">Perturbation</span>
                          <span className="text-right">HR</span>
                          <span className="text-right">CI</span>
                          <span className="text-right">Delta</span>
                          <span className="text-center">Significant?</span>
                        </div>
                      </div>
                      {stability.perturbations.map((p, i) => (
                        <div key={i} className={`px-4 py-2.5 border-b border-gray-100 last:border-0 ${p.significant ? 'bg-red-50/50' : ''}`}>
                          <div className="grid grid-cols-6 gap-2 text-xs">
                            <span className="col-span-2 font-medium text-gray-700 truncate" title={p.name}>{p.name}</span>
                            <span className="text-right font-mono text-gray-600">{fmt(p.hr)}</span>
                            <span className="text-right font-mono text-gray-500 text-[10px]">[{fmt(p.ci_lower)}, {fmt(p.ci_upper)}]</span>
                            <span className={`text-right font-mono ${Math.abs(p.delta) > 0.1 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              {p.delta > 0 ? '+' : ''}{fmt(p.delta, 4)}
                            </span>
                            <span className="text-center">
                              {p.significant
                                ? <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> Yes</span>
                                : <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> No</span>
                              }
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Break points */}
                    {stability.break_points.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" /> Break Points — Where the Conclusion Flips
                        </h3>
                        {stability.break_points.map((bp, i) => (
                          <div key={i} className="bg-white border border-red-100 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-red-700">{bp.perturbation}</span>
                              <ChevronRight className="h-3 w-3 text-red-400" />
                              <span className="text-xs font-mono text-red-600">{bp.threshold}</span>
                            </div>
                            <p className="text-[10px] text-gray-600">{bp.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {stability.break_points.length === 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700">No break points identified. The conclusion is stable across all tested perturbations.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 5: Unmeasured Confounding                                    */}
            {/* ================================================================ */}
            {activeTab === 'confounding' && (
              <div className="space-y-5">
                {!confounding && (
                  <EmptySection message="No unmeasured confounding data available. Run the adversarial review to populate this section." />
                )}

                {confounding && (
                  <>
                    {/* E-value display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">E-value (Point Estimate)</span>
                        <span className={`text-4xl font-black mt-2 ${confounding.e_value >= 2 ? 'text-emerald-600' : confounding.e_value >= 1.5 ? 'text-amber-600' : 'text-red-600'}`}>
                          {fmt(confounding.e_value)}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">Minimum confounding strength to nullify</span>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">E-value (CI Bound)</span>
                        <span className={`text-4xl font-black mt-2 ${confounding.e_value_ci >= 1.5 ? 'text-emerald-600' : confounding.e_value_ci >= 1.2 ? 'text-amber-600' : 'text-red-600'}`}>
                          {fmt(confounding.e_value_ci)}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">CI-bound E-value</span>
                      </div>
                    </div>

                    {/* Interpretation */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-blue-700">Interpretation</span>
                        <p className="text-xs text-blue-600 mt-1">{confounding.interpretation}</p>
                      </div>
                    </div>

                    {/* Confounding simulation grid */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Confounding Simulation Grid</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Each cell shows the bias-adjusted HR for a given (RR_TU, RR_YU) pair</p>
                      </div>
                      <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                        <div className="grid grid-cols-4 gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          <span>RR (T-U)</span>
                          <span>RR (Y-U)</span>
                          <span className="text-right">Adjusted HR</span>
                          <span className="text-center">Nullified?</span>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {confounding.simulation_grid.map((row, i) => (
                          <div key={i} className={`px-4 py-2 border-b border-gray-100 last:border-0 ${row.nullified ? 'bg-red-50/50' : ''}`}>
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <span className="font-mono text-gray-600">{fmt(row.rr_tu)}</span>
                              <span className="font-mono text-gray-600">{fmt(row.rr_yu)}</span>
                              <span className={`text-right font-mono ${row.nullified ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                                {fmt(row.bias_adjusted_hr)}
                              </span>
                              <span className="text-center">
                                {row.nullified
                                  ? <span className="text-red-600 font-semibold text-[10px]">Nullified</span>
                                  : <span className="text-emerald-600 text-[10px]">Robust</span>
                                }
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tipping point */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Target className="h-3 w-3" /> Tipping Point
                      </h3>
                      <div className="flex items-start gap-4">
                        <div className="grid grid-cols-2 gap-3 shrink-0">
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-gray-500 block">RR (T-U)</span>
                            <span className="text-lg font-bold text-gray-900">{fmt(confounding.tipping_point.rr_tu)}</span>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                            <span className="text-[10px] text-gray-500 block">RR (Y-U)</span>
                            <span className="text-lg font-bold text-gray-900">{fmt(confounding.tipping_point.rr_yu)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 flex-1">{confounding.tipping_point.description}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 6: Failure Modes                                             */}
            {/* ================================================================ */}
            {activeTab === 'failures' && (
              <div className="space-y-5">
                {failureModes.length === 0 && (
                  <EmptySection message="No failure modes identified. Run the adversarial review or review other tabs for potential issues." />
                )}

                {failureModes.length > 0 && (
                  <>
                    {/* Summary counts */}
                    <div className="grid grid-cols-3 gap-3">
                      {(['critical', 'warning', 'info'] as const).map(sev => {
                        const count = failureModes.filter(f => f.severity === sev).length
                        const cfg = severityConfig[sev]!
                        return (
                          <div key={sev} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4 flex items-center gap-3`}>
                            {cfg.icon}
                            <div>
                              <span className={`text-xl font-black ${cfg.color}`}>{count}</span>
                              <span className="text-xs text-gray-500 ml-1.5 capitalize">{sev}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Failure mode list */}
                    <div className="space-y-3">
                      {failureModes.map((fm, i) => {
                        const cfg = severityConfig[fm.severity] ?? { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Info className="h-4 w-4 text-blue-500" /> }
                        return (
                          <div key={i} className={`bg-white border rounded-xl overflow-hidden ${cfg.border}`}>
                            <div className={`px-4 py-3 ${cfg.bg} border-b ${cfg.border} flex items-center gap-2`}>
                              {cfg.icon}
                              <span className={`text-xs font-bold ${cfg.color} uppercase tracking-wider`}>{fm.severity}</span>
                              <span className="text-xs font-semibold text-gray-700 ml-2">{fm.type}</span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              <p className="text-xs text-gray-700">{fm.description}</p>
                              {fm.details && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">Details</span>
                                  <p className="text-[11px] text-gray-600 font-mono leading-relaxed">{fm.details}</p>
                                </div>
                              )}
                              {fm.impact && (
                                <div className="flex items-start gap-1.5">
                                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider shrink-0 mt-px">Impact:</span>
                                  <p className="text-xs text-gray-600">{fm.impact}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty section helper
// ---------------------------------------------------------------------------

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Shield className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-xs text-gray-400 max-w-sm">{message}</p>
    </div>
  )
}
