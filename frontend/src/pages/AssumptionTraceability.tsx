import React, { useState } from 'react'
import {
  ShieldCheck, AlertTriangle, XCircle, Info, ChevronDown, ChevronRight,
  Loader2, FileText, Lock, Eye, Activity, Layers, Shield,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── Types ────────────────────────────────────────────────────────────────────
type AssumptionStatus = 'supported' | 'partial' | 'unsupported' | 'violated'
type EvidenceVerdict = 'supports' | 'contradicts' | 'inconclusive' | 'not_applicable'
type TabKey = 'registry' | 'matrix' | 'impact' | 'bindings'

interface AssumptionEntry {
  id: string
  name: string
  label: string
  definition: string
  status: AssumptionStatus
  confidence: number
  testable: boolean
  regulatory_risk: 'low' | 'medium' | 'high' | 'critical'
  metrics: Record<string, number | string>
  sensitivity_impact: { hr_shift: number; direction: string }
}

interface MatrixCell {
  assumption: string
  evidence_source: string
  result: EvidenceVerdict
  value?: number | string
  detail?: string
}

interface ImpactScenario {
  assumption: string
  label: string
  scenarios: Array<{
    parameter: string
    value: number | string
    adjusted_hr: number
    ci_lower: number
    ci_upper: number
    reversal: boolean
  }>
  primary_hr: number
}

interface EvidenceBinding {
  assumption: string
  entries: Array<{
    evidence_type: string
    value: number | string
    interpretation: string
    source_section: string
    status: EvidenceVerdict
  }>
}

interface TraceabilityData {
  overall_health: { score: number; verdict: string }
  assumptions: AssumptionEntry[]
  traceability_matrix: MatrixCell[]
  impact_modeling: ImpactScenario[]
  evidence_bindings: EvidenceBinding[]
  recommendations: Array<{ priority: string; text: string }>
}

// ── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AssumptionStatus, { label: string; color: string; bg: string; border: string }> = {
  supported:   { label: 'Supported',   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  partial:     { label: 'Partial',     color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  unsupported: { label: 'Unsupported', color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200' },
  violated:    { label: 'Violated',    color: 'text-red-800',     bg: 'bg-red-100',     border: 'border-red-300' },
}

const VERDICT_CONFIG: Record<EvidenceVerdict, { label: string; color: string; bg: string }> = {
  supports:       { label: 'Supports',       color: 'text-emerald-700', bg: 'bg-emerald-50' },
  contradicts:    { label: 'Contradicts',    color: 'text-red-700',     bg: 'bg-red-50' },
  inconclusive:   { label: 'Inconclusive',   color: 'text-amber-700',   bg: 'bg-amber-50' },
  not_applicable: { label: 'N/A',            color: 'text-gray-500',    bg: 'bg-gray-50' },
}

const RISK_CONFIG: Record<string, { color: string; bg: string }> = {
  low:      { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  medium:   { color: 'text-amber-700',   bg: 'bg-amber-50' },
  high:     { color: 'text-red-600',     bg: 'bg-red-50' },
  critical: { color: 'text-red-800',     bg: 'bg-red-100' },
}

const EVIDENCE_SOURCES = [
  'smd_balance', 'ps_overlap', 'e_value', 'ess',
  'unmeasured_confounding', 'censoring_pattern', 'treatment_definition', 'dag_completeness',
]

const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  smd_balance: 'SMD Balance',
  ps_overlap: 'PS Overlap',
  e_value: 'E-Value',
  ess: 'ESS',
  unmeasured_confounding: 'Unmeasured Confounding',
  censoring_pattern: 'Censoring Pattern',
  treatment_definition: 'Treatment Definition',
  dag_completeness: 'DAG Completeness',
}

const ASSUMPTION_IDS = ['exchangeability', 'positivity', 'consistency', 'independent_censoring']

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'registry',  label: 'Assumption Registry', icon: <ShieldCheck className="w-4 h-4" /> },
  { key: 'matrix',    label: 'Traceability Matrix', icon: <Layers className="w-4 h-4" /> },
  { key: 'impact',    label: 'Impact Modeling',      icon: <Activity className="w-4 h-4" /> },
  { key: 'bindings',  label: 'Evidence Bindings',    icon: <FileText className="w-4 h-4" /> },
]

// ── Component ────────────────────────────────────────────────────────────────
export default function AssumptionTraceability({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: traceData, loading, error, refetch, runComputation } =
    useStudyData<TraceabilityData>(selectedStudy?.id, 'assumption_traceability')

  const [activeTab, setActiveTab] = useState<TabKey>('registry')
  const [computing, setComputing] = useState(false)
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>(null)
  const [expandedBindings, setExpandedBindings] = useState<Record<string, boolean>>({})

  // Data extraction with defaults
  const overallHealth = traceData?.overall_health ?? null
  const assumptions = traceData?.assumptions ?? []
  const matrix = traceData?.traceability_matrix ?? []
  const impactModeling = traceData?.impact_modeling ?? []
  const evidenceBindings = traceData?.evidence_bindings ?? []
  const recommendations = traceData?.recommendations ?? []

  const handleRunReport = async () => {
    setComputing(true)
    try {
      const result = await runComputation('assumption-traceability/run')
      if (result) await refetch()
    } catch {
      // error is captured by hook
    } finally {
      setComputing(false)
    }
  }

  const toggleBinding = (id: string) => {
    setExpandedBindings(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getMatrixCell = (assumption: string, source: string): MatrixCell | undefined => {
    return matrix.find(c => c.assumption === assumption && c.evidence_source === source)
  }

  // ── Loading / Error / Empty ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-gray-500">Loading assumption traceability data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Failed to load assumption traceability</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={refetch} className="mt-2 text-sm underline hover:no-underline">Retry</button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Assumption Traceability &amp; Evidence Binding
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Map causal assumptions to supporting evidence, assess robustness, and model violation impacts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {locked && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              <Lock className="w-3 h-3" /> Protocol Locked
            </span>
          )}
          {reviewerMode && (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <Eye className="w-3 h-3" /> Reviewer Mode
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'registry' && (
        <RegistryTab
          overallHealth={overallHealth}
          assumptions={assumptions}
          computing={computing}
          locked={locked}
          onRunReport={handleRunReport}
        />
      )}
      {activeTab === 'matrix' && (
        <MatrixTab
          assumptions={assumptions}
          getMatrixCell={getMatrixCell}
          selectedCell={selectedCell}
          onSelectCell={setSelectedCell}
        />
      )}
      {activeTab === 'impact' && (
        <ImpactTab impactModeling={impactModeling} />
      )}
      {activeTab === 'bindings' && (
        <BindingsTab
          evidenceBindings={evidenceBindings}
          recommendations={recommendations}
          expandedBindings={expandedBindings}
          toggleBinding={toggleBinding}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Assumption Registry
// ═══════════════════════════════════════════════════════════════════════════════
function RegistryTab({
  overallHealth,
  assumptions,
  computing,
  locked,
  onRunReport,
}: {
  overallHealth: { score: number; verdict: string } | null
  assumptions: AssumptionEntry[]
  computing: boolean
  locked: boolean
  onRunReport: () => void
}) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Core Causal Assumptions</h2>
        <button
          onClick={onRunReport}
          disabled={computing || locked}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Build Assumption Report
        </button>
      </div>

      {/* Overall Health Card */}
      {overallHealth && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Overall Assumption Health</p>
              <p className={`text-4xl font-bold mt-1 ${getHealthColor(overallHealth.score)}`}>
                {overallHealth.score}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Verdict</p>
              <p className="text-lg font-semibold text-gray-800 mt-1">{overallHealth.verdict}</p>
            </div>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                overallHealth.score >= 80 ? 'bg-emerald-500' : overallHealth.score >= 60 ? 'bg-amber-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(overallHealth.score, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {assumptions.length === 0 && (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No assumption data available</p>
          <p className="text-sm text-gray-400 mt-1">
            Click "Build Assumption Report" to generate the traceability analysis
          </p>
        </div>
      )}

      {/* Assumption Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {assumptions.map(assumption => (
          <AssumptionCard key={assumption.id} assumption={assumption} />
        ))}
      </div>
    </div>
  )
}

function AssumptionCard({ assumption }: { assumption: AssumptionEntry }) {
  const status = STATUS_CONFIG[assumption.status] ?? STATUS_CONFIG.partial
  const risk = RISK_CONFIG[assumption.regulatory_risk] ?? { color: 'text-amber-700', bg: 'bg-amber-50' }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Title row */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">{assumption.label}</h3>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.color} ${status.bg} ${status.border}`}>
          {status.label}
        </span>
      </div>

      {/* Mathematical definition */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-4">
        <code className="text-sm font-mono text-slate-700">{assumption.definition}</code>
      </div>

      {/* Meta badges row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          assumption.testable ? 'text-emerald-700 bg-emerald-50' : 'text-gray-500 bg-gray-100'
        }`}>
          {assumption.testable ? 'Testable' : 'Not Directly Testable'}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${risk.color} ${risk.bg}`}>
          Reg. Risk: {assumption.regulatory_risk}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Confidence</span>
          <span className="font-medium">{assumption.confidence}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              assumption.confidence >= 75 ? 'bg-emerald-500' : assumption.confidence >= 50 ? 'bg-amber-400' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(assumption.confidence, 100)}%` }}
          />
        </div>
      </div>

      {/* Supporting Metrics */}
      <div className="border-t border-gray-100 pt-3 mb-3">
        <p className="text-xs text-gray-500 font-medium mb-2">Key Metrics</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(assumption.metrics).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-gray-500 truncate mr-2">{formatMetricLabel(key)}</span>
              <span className="font-medium text-gray-700 whitespace-nowrap">{formatMetricValue(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity Impact */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 font-medium mb-1">Sensitivity Impact (if violated)</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${
            Math.abs(assumption.sensitivity_impact.hr_shift) < 0.05
              ? 'text-emerald-600'
              : Math.abs(assumption.sensitivity_impact.hr_shift) < 0.15
              ? 'text-amber-600'
              : 'text-red-600'
          }`}>
            HR {assumption.sensitivity_impact.direction === 'increase' ? '+' : ''}
            {assumption.sensitivity_impact.hr_shift.toFixed(3)}
          </span>
          <span className="text-xs text-gray-400">
            ({assumption.sensitivity_impact.direction})
          </span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Traceability Matrix
// ═══════════════════════════════════════════════════════════════════════════════
function MatrixTab({
  assumptions,
  getMatrixCell,
  selectedCell,
  onSelectCell,
}: {
  assumptions: AssumptionEntry[]
  getMatrixCell: (assumption: string, source: string) => MatrixCell | undefined
  selectedCell: MatrixCell | null
  onSelectCell: (cell: MatrixCell | null) => void
}) {
  if (assumptions.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
        <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No traceability matrix available</p>
        <p className="text-sm text-gray-400 mt-1">Run the assumption report first to populate the matrix</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Assumption x Evidence Source Matrix</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Supports</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Partial</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Contradicts</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" /> N/A</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0 z-10">
                Assumption
              </th>
              {EVIDENCE_SOURCES.map(src => (
                <th key={src} className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 text-center whitespace-nowrap">
                  {EVIDENCE_SOURCE_LABELS[src] ?? src}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ASSUMPTION_IDS.map((aId, rowIdx) => {
              const assumption = assumptions.find(a => a.id === aId)
              return (
                <tr key={aId} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-inherit whitespace-nowrap">
                    {assumption?.label ?? aId}
                  </td>
                  {EVIDENCE_SOURCES.map(src => {
                    const cell = getMatrixCell(aId, src)
                    const verdict = cell?.result ?? 'not_applicable'
                    const cfg = VERDICT_CONFIG[verdict]
                    return (
                      <td key={src} className="px-3 py-3 text-center">
                        <button
                          onClick={() => cell && onSelectCell(selectedCell?.assumption === aId && selectedCell?.evidence_source === src ? null : cell)}
                          className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium transition-all
                            ${cfg.bg} ${cfg.color} hover:ring-2 hover:ring-blue-300 cursor-pointer
                            ${selectedCell?.assumption === aId && selectedCell?.evidence_source === src ? 'ring-2 ring-blue-500' : ''}`}
                        >
                          {cell?.value !== undefined ? String(cell.value) : cfg.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail */}
      {selectedCell && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {assumptions.find(a => a.id === selectedCell.assumption)?.label ?? selectedCell.assumption}
              {' '}&mdash;{' '}
              {EVIDENCE_SOURCE_LABELS[selectedCell.evidence_source] ?? selectedCell.evidence_source}
            </h3>
            <button onClick={() => onSelectCell(null)} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Result</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${VERDICT_CONFIG[selectedCell.result].bg} ${VERDICT_CONFIG[selectedCell.result].color}`}>
                {VERDICT_CONFIG[selectedCell.result].label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-medium text-gray-800 mt-1">{selectedCell.value ?? '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Detail</p>
              <p className="text-gray-600 mt-1">{selectedCell.detail ?? 'No additional detail'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: Impact Modeling
// ═══════════════════════════════════════════════════════════════════════════════
function ImpactTab({ impactModeling }: { impactModeling: ImpactScenario[] }) {
  if (impactModeling.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No impact modeling data available</p>
        <p className="text-sm text-gray-400 mt-1">Run the assumption report to generate violation impact scenarios</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">What If Violated? &mdash; Impact Analysis</h2>
        <p className="text-sm text-gray-500 mt-1">
          Projected hazard ratio shifts under simulated assumption violations
        </p>
      </div>

      {impactModeling.map(scenario => (
        <ImpactScenarioCard key={scenario.assumption} scenario={scenario} />
      ))}
    </div>
  )
}

function ImpactScenarioCard({ scenario }: { scenario: ImpactScenario }) {
  const maxShift = Math.max(
    ...scenario.scenarios.map(s => Math.abs(s.adjusted_hr - scenario.primary_hr)),
    0.01
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{scenario.label}</h3>
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          Primary HR: <span className="font-semibold text-gray-800">{scenario.primary_hr.toFixed(2)}</span>
        </span>
      </div>

      {/* Scenario table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Parameter</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Value</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Adjusted HR</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">95% CI</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Shift</th>
              <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">Reversal?</th>
            </tr>
          </thead>
          <tbody>
            {scenario.scenarios.map((s, idx) => {
              const shift = s.adjusted_hr - scenario.primary_hr
              const shiftAbs = Math.abs(shift)
              const barWidth = Math.min((shiftAbs / Math.max(maxShift, 0.01)) * 100, 100)
              const barColor = shiftAbs < 0.05 ? 'bg-emerald-400' : shiftAbs < 0.15 ? 'bg-amber-400' : 'bg-red-500'

              return (
                <tr key={idx} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2.5 text-gray-700">{s.parameter}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-600">{String(s.value)}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">{s.adjusted_hr.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-gray-600">[{s.ci_lower.toFixed(2)}, {s.ci_upper.toFixed(2)}]</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${
                        shiftAbs < 0.05 ? 'text-emerald-600' : shiftAbs < 0.15 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {shift >= 0 ? '+' : ''}{shift.toFixed(3)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {s.reversal ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: Evidence Bindings
// ═══════════════════════════════════════════════════════════════════════════════
function BindingsTab({
  evidenceBindings,
  recommendations,
  expandedBindings,
  toggleBinding,
}: {
  evidenceBindings: EvidenceBinding[]
  recommendations: Array<{ priority: string; text: string }>
  expandedBindings: Record<string, boolean>
  toggleBinding: (id: string) => void
}) {
  if (evidenceBindings.length === 0 && recommendations.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No evidence bindings available</p>
        <p className="text-sm text-gray-400 mt-1">Run the assumption report to bind evidence to assumptions</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Evidence Bound to Assumptions</h2>

      {/* Accordion */}
      <div className="space-y-3">
        {evidenceBindings.map(binding => {
          const isExpanded = expandedBindings[binding.assumption] ?? false
          const supportCount = binding.entries.filter(e => e.status === 'supports').length
          const contradictCount = binding.entries.filter(e => e.status === 'contradicts').length

          return (
            <div key={binding.assumption} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Accordion header */}
              <button
                onClick={() => toggleBinding(binding.assumption)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className="font-semibold text-gray-800 capitalize">
                    {formatAssumptionLabel(binding.assumption)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    {supportCount} supporting
                  </span>
                  {contradictCount > 0 && (
                    <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {contradictCount} contradicting
                    </span>
                  )}
                  <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {binding.entries.length} total
                  </span>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="space-y-3">
                    {binding.entries.map((entry, idx) => {
                      const verdictCfg = VERDICT_CONFIG[entry.status] ?? VERDICT_CONFIG.inconclusive
                      return (
                        <div key={idx} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-800">{entry.evidence_type}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${verdictCfg.bg} ${verdictCfg.color}`}>
                                {verdictCfg.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{entry.interpretation}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Source: <span className="font-medium">{entry.source_section}</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-gray-500">Value</p>
                            <p className="text-sm font-semibold text-gray-800 font-mono">
                              {formatMetricValue(entry.value)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-blue-500" />
            Recommendations
          </h3>
          <ul className="space-y-3">
            {recommendations.map((rec, idx) => {
              const priorityColor =
                rec.priority === 'high' ? 'text-red-700 bg-red-50 border-red-200'
                : rec.priority === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-blue-700 bg-blue-50 border-blue-200'

              return (
                <li key={idx} className="flex items-start gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0 mt-0.5 ${priorityColor}`}>
                    {rec.priority}
                  </span>
                  <p className="text-sm text-gray-700">{rec.text}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Utility functions ────────────────────────────────────────────────────────
function formatMetricLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatMetricValue(val: number | string): string {
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toString() : val.toFixed(3)
  }
  return String(val)
}

function formatAssumptionLabel(id: string): string {
  const labels: Record<string, string> = {
    exchangeability: 'Exchangeability',
    positivity: 'Positivity',
    consistency: 'Consistency',
    independent_censoring: 'Independent Censoring',
  }
  return labels[id] ?? formatMetricLabel(id)
}
