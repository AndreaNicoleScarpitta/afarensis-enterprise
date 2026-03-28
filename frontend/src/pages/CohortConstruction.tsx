import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AttackSignalBanner from '../components/AttackSignalBanner'
import { Users2, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, X, Loader2, AlertCircle, Users } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const INCLUSION = [
//   'Age ≥ 18 years at index date',
//   `Continuous enrollment ≥ 6 months pre-index`,
//   'At least 1 diagnosis code for index condition (ICD-10) in the 12 months prior to index',
//   'First prescription fill of study treatment (new user design)',
//   'No prior use of study treatment in 12-month washout period',
// ]

// SCHEMA REFERENCE — not shown to users
// const EXCLUSION = [
//   'Prior malignancy (any) in the 5 years before index',
//   'End-stage renal disease or dialysis at index',
//   'Enrollment in clinical trial during study period',
//   'Missing age or sex in data',
//   'Index date after study end date (2023-12-31)',
// ]

// SCHEMA REFERENCE — not shown to users
// const FUNNEL = [
//   { label: 'Initial eligible population',        n: 847_420, pct: 100.0,  excluded: null },
//   { label: 'Applied: age ≥ 18',                  n: 841_033, pct: 99.2,   excluded: 6_387 },
//   { label: 'Applied: 6-month enrollment',        n: 612_440, pct: 72.3,   excluded: 228_593 },
//   { label: 'Applied: index condition diagnosis', n: 89_200,  pct: 10.5,   excluded: 523_240 },
//   { label: 'Applied: new user restriction',      n: 44_812,  pct:  5.3,   excluded: 44_388 },
//   { label: 'Applied: washout period',            n: 37_918,  pct:  4.5,   excluded:  6_894 },
//   { label: 'Excluded: prior malignancy',         n: 34_201,  pct:  4.0,   excluded:  3_717 },
//   { label: 'Excluded: ESRD / dialysis',          n: 32_980,  pct:  3.9,   excluded:  1_221 },
//   { label: 'Final analytic cohort',              n: 32_980,  pct:  3.9,   excluded: null },
// ]

// SCHEMA REFERENCE — not shown to users
// const WEIGHTING_METHODS = [
//   { method: 'Inverse Probability of Treatment Weighting (IPTW)', selected: true },
//   { method: 'Matching on propensity score (1:1 nearest-neighbor)', selected: false },
//   { method: 'Standardized mortality ratio weighting (SMR)', selected: false },
//   { method: 'Overlap weighting (OW)', selected: false },
// ]

export default function CohortConstruction({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: cohortData, loading, error, saving, save, refetch } = useStudyData(selectedStudy?.id, 'cohort')
  const staleness = useStalenessCheck(selectedStudy?.id, 'cohort')

  const [inclusion, setInclusion] = useState<string[]>([])
  const [exclusion, setExclusion] = useState<string[]>([])
  const [funnel, setFunnel] = useState<any[]>([])
  const [weightingMethods, setWeightingMethods] = useState<any[]>([])
  const [indexDateDefinition, setIndexDateDefinition] = useState('')
  const [washoutPeriod, setWashoutPeriod] = useState<number>(0)
  const [selectedWeightingMethod, setSelectedWeightingMethod] = useState('IPTW')
  const [showImpactDialog, setShowImpactDialog] = useState(false)
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('cohort')
  const locked = protocolLocked

  useEffect(() => {
    if (cohortData) {
      if (Array.isArray(cohortData.inclusion) && cohortData.inclusion.length) setInclusion(cohortData.inclusion)
      if (Array.isArray(cohortData.exclusion) && cohortData.exclusion.length) setExclusion(cohortData.exclusion)
      if (Array.isArray(cohortData.funnel) && cohortData.funnel.length) setFunnel(cohortData.funnel)
      if (Array.isArray(cohortData.weighting_methods) && cohortData.weighting_methods.length) setWeightingMethods(cohortData.weighting_methods)
      if (cohortData.index_date_definition) setIndexDateDefinition(cohortData.index_date_definition)
      if (cohortData.washout_period != null) setWashoutPeriod(cohortData.washout_period)
      if (cohortData.selected_weighting_method) setSelectedWeightingMethod(cohortData.selected_weighting_method)
    }
  }, [cohortData])

  // ── Editable field helpers ──
  const persistCohort = (overrides: Record<string, any> = {}) => {
    save({
      inclusion,
      exclusion,
      index_date_definition: indexDateDefinition,
      washout_period: washoutPeriod,
      selected_weighting_method: selectedWeightingMethod,
      ...overrides,
    })
  }

  const confirmSave = () => {
    persistCohort()
    setShowImpactDialog(false)
  }

  const handleSave = () => {
    if ((directImpacts.length > 0 || transitiveImpacts.length > 0) && !protocolLocked) {
      setShowImpactDialog(true)
    } else {
      persistCohort()
    }
  }

  const handleAddInclusion = () => {
    const updated = [...inclusion, '']
    setInclusion(updated)
    persistCohort({ inclusion: updated })
  }

  const handleRemoveInclusion = (index: number) => {
    const updated = inclusion.filter((_, i) => i !== index)
    setInclusion(updated)
    persistCohort({ inclusion: updated })
  }

  const handleUpdateInclusion = (index: number, value: string) => {
    const updated = [...inclusion]
    updated[index] = value
    setInclusion(updated)
  }

  const handleBlurInclusion = () => persistCohort()

  const handleAddExclusion = () => {
    const updated = [...exclusion, '']
    setExclusion(updated)
    persistCohort({ exclusion: updated })
  }

  const handleRemoveExclusion = (index: number) => {
    const updated = exclusion.filter((_, i) => i !== index)
    setExclusion(updated)
    persistCohort({ exclusion: updated })
  }

  const handleUpdateExclusion = (index: number, value: string) => {
    const updated = [...exclusion]
    updated[index] = value
    setExclusion(updated)
  }

  const handleBlurExclusion = () => persistCohort()

  // Defensive: ensure state is always an array
  const safeInclusion = Array.isArray(inclusion) ? inclusion : []
  const safeExclusion = Array.isArray(exclusion) ? exclusion : []
  const safeFunnel = Array.isArray(funnel) ? funnel : []
  const safeWeightingMethods = Array.isArray(weightingMethods) ? weightingMethods : []

  const formatN = (n: number | undefined | null) => n != null ? n.toLocaleString() : '—'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Users2 className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 04</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900">Cohort Construction</h1>
              <p className="text-gray-500 text-xs mt-0.5">Attrition funnel · inclusion/exclusion · weighting method</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <AttackSignalBanner step="cohort" />

      {/* Staleness detection banner */}
      <div className="px-8 pt-4">
        <StalenessBanner
          staleUpstreams={staleness.staleUpstreams}
          onAcknowledge={staleness.acknowledge}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading cohort data...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">Failed to load cohort data</p>
            <p className="text-xs text-gray-500 mt-0.5">{error}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {safeFunnel.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Users className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Define cohort criteria to see the attrition funnel.</p>
          </div>
        )}

        {/* Summary cards — data-driven from cohort API */}
        {(() => {
          const finalN = cohortData?.summary?.final_n ?? (safeFunnel.length > 0 ? safeFunnel[safeFunnel.length - 1]?.n : null)
          const treatmentN = cohortData?.summary?.treatment_n ?? cohortData?.n_by_arm?.treatment ?? null
          const comparatorN = cohortData?.summary?.comparator_n ?? cohortData?.n_by_arm?.comparator ?? null
          const initialN = safeFunnel.length > 0 ? safeFunnel[0]?.n : null
          const retention = finalN != null && initialN != null && initialN > 0 ? ((finalN / initialN) * 100).toFixed(1) + '%' : null
          return (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Final Cohort (n)', value: finalN != null ? finalN.toLocaleString() : '—' },
                { label: 'Treatment Arm', value: treatmentN != null ? treatmentN.toLocaleString() : '—' },
                { label: 'Comparator Arm', value: comparatorN != null ? comparatorN.toLocaleString() : '—' },
                { label: 'Overall Retention', value: retention ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-100/80 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* I/E Criteria */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-gray-900">Inclusion Criteria</h2>
              {!locked && !reviewerMode && (
                <button onClick={handleAddInclusion} className="ml-auto text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">+ Add</button>
              )}
            </div>
            <div className="space-y-1.5">
              {safeInclusion.map((c, i) => (
                <div key={i} className="flex items-start gap-2 bg-emerald-900/10 border border-emerald-700/20 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {!locked && !reviewerMode ? (
                    <input
                      type="text"
                      value={c}
                      onChange={e => handleUpdateInclusion(i, e.target.value)}
                      onBlur={handleBlurInclusion}
                      className="flex-1 bg-transparent border-none text-xs text-gray-600 focus:outline-none focus:ring-0"
                      placeholder="Enter inclusion criterion"
                    />
                  ) : (
                    <p className="text-xs text-gray-600">{c}</p>
                  )}
                  {!locked && !reviewerMode && (
                    <button onClick={() => handleRemoveInclusion(i)} className="text-red-400 hover:text-red-300 shrink-0 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center gap-2 mb-2">
              <X className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-bold text-gray-900">Exclusion Criteria</h2>
              {!locked && !reviewerMode && (
                <button onClick={handleAddExclusion} className="ml-auto text-xs font-semibold text-red-400 hover:text-red-300 transition-colors">+ Add</button>
              )}
            </div>
            <div className="space-y-1.5">
              {safeExclusion.map((c, i) => (
                <div key={i} className="flex items-start gap-2 bg-red-900/10 border border-red-700/20 rounded-lg px-3 py-2">
                  <X className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  {!locked && !reviewerMode ? (
                    <input
                      type="text"
                      value={c}
                      onChange={e => handleUpdateExclusion(i, e.target.value)}
                      onBlur={handleBlurExclusion}
                      className="flex-1 bg-transparent border-none text-xs text-gray-600 focus:outline-none focus:ring-0"
                      placeholder="Enter exclusion criterion"
                    />
                  ) : (
                    <p className="text-xs text-gray-600">{c}</p>
                  )}
                  {!locked && !reviewerMode && (
                    <button onClick={() => handleRemoveExclusion(i)} className="text-red-400 hover:text-red-300 shrink-0 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Index Date & Washout Period */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-2">Index Date Definition</h2>
            {!locked && !reviewerMode ? (
              <input
                type="text"
                value={indexDateDefinition}
                onChange={e => setIndexDateDefinition(e.target.value)}
                onBlur={() => persistCohort()}
                placeholder="e.g., First prescription fill of study treatment"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            ) : (
              <p className="text-xs text-gray-600 bg-gray-100/80 border border-gray-200 rounded-lg px-3 py-2">
                {indexDateDefinition || '—'}
              </p>
            )}
          </section>
          <section>
            <h2 className="text-sm font-bold text-gray-900 mb-2">Washout Period</h2>
            {!locked && !reviewerMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={washoutPeriod}
                  onChange={e => setWashoutPeriod(Number(e.target.value))}
                  onBlur={() => persistCohort()}
                  className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
                <span className="text-xs text-gray-500">days</span>
              </div>
            ) : (
              <p className="text-xs text-gray-600 bg-gray-100/80 border border-gray-200 rounded-lg px-3 py-2 font-mono">
                {washoutPeriod > 0 ? `${washoutPeriod} days` : '—'}
              </p>
            )}
          </section>
        </div>

        {/* Attrition funnel */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Patient Attrition Funnel</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Step</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">N Remaining</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">% of Total</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Excluded</th>
                </tr>
              </thead>
              <tbody>
                {safeFunnel.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${i === safeFunnel.length - 1 ? 'bg-[#2563EB]/10' : ''}`}
                  >
                    <td className={`px-4 py-2.5 font-medium ${i === safeFunnel.length - 1 ? 'text-[#2563EB] font-bold' : 'text-gray-600'}`}>
                      {row.label}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{formatN(row.n)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="font-mono text-gray-500 w-10 text-right">{row.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                      {row.excluded !== null ? `−${formatN(row.excluded)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Weighting method */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Pre-specified Weighting Method</h2>
          {!locked && !reviewerMode && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Select primary weighting method:</label>
              <select
                value={selectedWeightingMethod}
                onChange={e => {
                  setSelectedWeightingMethod(e.target.value)
                  persistCohort({ selected_weighting_method: e.target.value })
                }}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2563EB] w-full"
              >
                <option value="IPTW">Inverse Probability of Treatment Weighting (IPTW)</option>
                <option value="Matching">Matching on Propensity Score</option>
                <option value="Overlap Weights">Overlap Weights (OW)</option>
                <option value="Entropy Balancing">Entropy Balancing</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            {safeWeightingMethods.map((m, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                m.selected ? 'bg-[#2563EB]/15 border-[#2563EB]/40' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm ${m.selected ? 'text-white font-semibold' : 'text-gray-500'}`}>{m.method}</p>
                {m.selected && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-bold"><CheckCircle2 className="h-3.5 w-3.5" /> Primary analysis</span>}
                {!m.selected && <span className="text-[10px] text-gray-600 font-medium">Sensitivity analysis</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Save button */}
        {!locked && !reviewerMode && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Cohort'}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Link to={`/projects/${selectedStudy.id}/data-provenance`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 3: Data Provenance
          </Link>
          <Link to={`/projects/${selectedStudy.id}/comparability`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 5: Comparability & Balance <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

      <DownstreamImpactDialog
        open={showImpactDialog}
        onClose={() => setShowImpactDialog(false)}
        onConfirm={confirmSave}
        saving={saving}
        currentStepLabel="Cohort Construction"
        directImpacts={directImpacts}
        transitiveImpacts={transitiveImpacts}
      />
    </div>
  )
}
