import React, { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Layers, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'
import ShowYourWork from '@/components/ui/ShowYourWork'
import DatasetContextBar from '@/components/ui/DatasetContextBar'
import ValidationGatePanel from '@/components/ui/ValidationGatePanel'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const FOREST_PLOT_DATA = [
//   { label: 'Primary: IPTW-adjusted HR',           est: 0.82, lo: 0.51, hi: 1.30, primary: true,  note: null },
//   { label: 'Sensitivity: PS matching 1:1',         est: 0.78, lo: 0.46, hi: 1.31, primary: false, note: null },
//   { label: 'Sensitivity: Overlap weighting',        est: 0.85, lo: 0.55, hi: 1.31, primary: false, note: null },
//   { label: 'Sensitivity: Active comparator',        est: 0.79, lo: 0.48, hi: 1.29, primary: false, note: null },
//   { label: 'Subgroup: Age < 65',                   est: 0.74, lo: 0.39, hi: 1.40, primary: false, note: 'Pre-specified' },
//   { label: 'Subgroup: Age ≥ 65',                   est: 0.88, lo: 0.52, hi: 1.48, primary: false, note: 'Pre-specified' },
//   { label: 'Subgroup: CCI < 3',                    est: 0.71, lo: 0.36, hi: 1.38, primary: false, note: 'Pre-specified' },
// ]

const NULL_LINE = 1.0

/** Compute axis bounds from data with padding, or use sensible defaults */
function computeAxisBounds(data: Array<{ lo: number; hi: number }>) {
  if (!data || data.length === 0) return { xMin: 0.3, xMax: 1.8 }
  const allLo = Math.min(...data.map(d => d.lo))
  const allHi = Math.max(...data.map(d => d.hi))
  const padding = (allHi - allLo) * 0.15 || 0.2
  return {
    xMin: Math.max(0.01, Math.floor((Math.min(allLo, NULL_LINE) - padding) * 10) / 10),
    xMax: Math.ceil((Math.max(allHi, NULL_LINE) + padding) * 10) / 10,
  }
}

function ForestRow({ row, xMin, xMax }: { row: typeof FOREST_PLOT_DATA[0]; xMin: number; xMax: number }) {
  const range = xMax - xMin
  const estPct = ((row.est - xMin) / range) * 100
  const loPct  = ((row.lo  - xMin) / range) * 100
  const hiPct  = ((row.hi  - xMin) / range) * 100
  const nullPct = ((NULL_LINE - xMin) / range) * 100

  const sigColor = row.hi < 1 ? 'text-emerald-400' : row.lo > 1 ? 'text-red-400' : 'text-gray-300'

  return (
    <div className={`px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-colors ${row.primary ? 'bg-[#2563EB]/8' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Label */}
        <div className="w-52 shrink-0">
          <p className={`text-xs ${row.primary ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400'}`}>{row.label}</p>
          {row.note && <p className="text-[9px] text-gray-600">{row.note}</p>}
        </div>

        {/* Plot area */}
        <div className="flex-1 relative h-6">
          {/* Null line */}
          <div className="absolute top-0 bottom-0 w-px bg-gray-600/60" style={{ left: `${nullPct}%` }} />

          {/* CI line */}
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-gray-500/60"
            style={{ left: `${loPct}%`, width: `${hiPct - loPct}%` }}
          />

          {/* Point estimate */}
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${row.primary ? 'w-3 h-3 rounded-sm rotate-45 bg-[#2563EB]' : 'w-2 h-2 rounded-full bg-gray-400'}`}
            style={{ left: `${estPct}%` }}
          />
        </div>

        {/* Numbers */}
        <div className="text-right w-36 shrink-0">
          <span className={`text-xs font-mono font-semibold ${sigColor}`}>
            {row.est.toFixed(2)} [{row.lo.toFixed(2)}, {row.hi.toFixed(2)}]
          </span>
        </div>
      </div>
    </div>
  )
}

// Normal CDF approximation (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

const MULTIPLICITY_METHODS = [
  { value: 'bonferroni', label: 'Bonferroni' },
  { value: 'holm', label: 'Holm' },
  { value: 'hochberg', label: 'Hochberg' },
  { value: 'bh-fdr', label: 'BH-FDR' },
  { value: 'sidak', label: 'Sidak' },
]

export default function EffectEstimation({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: resultsData, loading, error } = useStudyData(selectedStudy?.id, 'results/forest-plot')
  // Fetch full analysis results for ShowYourWork and dynamic binding
  const { data: analysisResults } = useStudyData(selectedStudy?.id, 'analysis-results')
  const { data: validationData } = useStudyData(selectedStudy?.id, 'validation-report')
  const { data: datasetInfo } = useStudyData(selectedStudy?.id, 'dataset-info')

  const [forestPlotData, setForestPlotData] = useState<any[]>([])

  useEffect(() => {
    if (!resultsData) return
    // Handle both array response and {forest_plot: [...]} wrapper
    const arr = Array.isArray(resultsData) ? resultsData
      : Array.isArray(resultsData?.forest_plot) ? resultsData.forest_plot
      : null
    if (arr && arr.length > 0) setForestPlotData(arr)
  }, [resultsData])

  // Defensive: ensure forestPlotData is always an array
  const safeData = Array.isArray(forestPlotData) ? forestPlotData : []
  const primaryResult = safeData.find((d: any) => d.primary) || safeData[0]
  const [showWorkOpen, setShowWorkOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<string>('primary')

  // Multiplicity adjustment state
  const [multiplicityOpen, setMultiplicityOpen] = useState(false)
  const [multiplicityMethod, setMultiplicityMethod] = useState('holm')
  const alpha = 0.05

  const adjustPValues = (pValues: number[], method: string): number[] => {
    const n = pValues.length
    if (n === 0) return []
    if (method === 'bonferroni') return pValues.map(p => Math.min(p * n, 1))
    if (method === 'sidak') return pValues.map(p => Math.min(1 - Math.pow(1 - p, n), 1))
    if (method === 'holm') {
      const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p)
      let maxAdj = 0
      const adjusted = indexed.map((s, rank) => {
        const adj = Math.min(s.p * (n - rank), 1)
        maxAdj = Math.max(maxAdj, adj)
        return { ...s, adjusted: maxAdj }
      })
      return adjusted.sort((a, b) => a.i - b.i).map(s => s.adjusted)
    }
    if (method === 'hochberg') {
      const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p)
      let minAdj = 1
      const adjusted = indexed.map((s, rank) => {
        const adj = Math.min(s.p * (rank + 1), 1)
        minAdj = Math.min(minAdj, adj)
        return { ...s, adjusted: minAdj }
      })
      return adjusted.sort((a, b) => a.i - b.i).map(s => s.adjusted)
    }
    if (method === 'bh-fdr') {
      const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p)
      let minAdj = 1
      const adjusted = indexed.map((s, rank) => {
        const m = n - rank
        const adj = Math.min(s.p * n / m, 1)
        minAdj = Math.min(minAdj, adj)
        return { ...s, adjusted: minAdj }
      })
      return adjusted.sort((a, b) => a.i - b.i).map(s => s.adjusted)
    }
    return pValues
  }

  // Derive p-values from forest plot CIs using normal approximation
  const rawPValues = useMemo(() => {
    return safeData.map(row => {
      const logHR = Math.log(row.est)
      const logLo = Math.log(row.lo)
      const logHi = Math.log(row.hi)
      const se = (logHi - logLo) / (2 * 1.96)
      const z = Math.abs(logHR / se)
      // Two-tailed p-value approximation
      const p = 2 * (1 - normalCDF(z))
      return Math.min(Math.max(p, 0.0001), 1)
    })
  }, [forestPlotData])

  const adjustedPValues = useMemo(() => adjustPValues(rawPValues, multiplicityMethod), [rawPValues, multiplicityMethod])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 06</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Effect Estimation</h1>
              <p className="text-gray-500 text-xs mt-0.5">Primary result · forest plot · subgroup analyses</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">Estimand: {selectedStudy.estimand}</p>
          </div>
        </div>
      </div>

      <LiteratureEvidence categories={['effect', 'general']} stepLabel="Effect Estimation" />

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading effect estimation data...</div>
        )}
        {error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-sm text-red-400">
            Error loading data: {error}
          </div>
        )}

        {/* Dataset context bar */}
        <DatasetContextBar dataset={datasetInfo} analysisResults={analysisResults} />

        {/* Validation gate panel */}
        {validationData && validationData.verdict === 'BLOCKED' && (
          <ValidationGatePanel validationReport={validationData} />
        )}

        {safeData.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <BarChart3 className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-400">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Run statistical analysis on uploaded data to see effect estimates.</p>
          </div>
        )}

        {/* Primary result hero — all values from API */}
        <div className="bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-[#60a5fa] font-bold uppercase tracking-widest mb-1">Primary Analysis — {selectedStudy.estimand}</p>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">HR {primaryResult?.est?.toFixed(2) ?? '—'}</h2>
              <p className="text-sm text-gray-400 mt-1">95% CI: [{primaryResult?.lo?.toFixed(2) ?? '—'}, {primaryResult?.hi?.toFixed(2) ?? '—'}]</p>
            </div>
            <div className="text-right">
              {primaryResult && primaryResult.lo != null && primaryResult.hi != null ? (
                primaryResult.lo > 1 || primaryResult.hi < 1 ? (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Statistically significant
                    </span>
                    <p className="text-xs text-gray-500 mt-1">95% CI does not cross null (HR = 1.0)</p>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4" /> Not statistically significant
                    </span>
                    <p className="text-xs text-gray-500 mt-1">95% CI crosses null (HR = 1.0)</p>
                  </>
                )
              ) : (
                <span className="text-sm text-gray-500">—</span>
              )}
              {reviewerMode && primaryResult && analysisResults?.column_detection && (
                <p className="text-xs text-[#60a5fa] mt-2 font-semibold">
                  N={analysisResults.column_detection.n_records_analyzed ?? '—'} patients analyzed.
                  {analysisResults.column_detection.n_records_dropped > 0 && (
                    <> {analysisResults.column_detection.n_records_dropped} excluded.</>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-[#2563EB]/20">
            {(() => {
              const detection = analysisResults?.column_detection || {}
              const nTreated = detection.groups?.treated ? (analysisResults?.sample_sizes?.n_treated || '—') : '—'
              const nEvents = detection.n_events ?? '—'
              const nAnalyzed = detection.n_records_analyzed ?? '—'
              return [
                { label: 'Method', value: analysisResults?.weighted_cox ? 'IPTW Cox PH' : (analysisResults?.cox_proportional_hazards ? 'Cox PH' : '—') },
                { label: 'Patients analyzed', value: String(nAnalyzed) },
                { label: 'Total events', value: String(nEvents) },
              ]
            })().map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#2563EB]/20 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">Full reproducibility trace available for this result</span>
            <button
              onClick={() => { setSelectedResult('primary'); setShowWorkOpen(true) }}
              className="flex items-center gap-1.5 text-xs text-[#60a5fa] hover:text-blue-300 font-semibold transition-colors bg-[#2563EB]/15 border border-[#2563EB]/30 px-3 py-1.5 rounded-lg"
            >
              <Layers className="h-3.5 w-3.5" /> Show Your Work
            </button>
          </div>
        </div>

        {/* Forest plot */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Forest Plot — All Analyses</h2>
            <span className="text-[10px] text-gray-600">Hazard Ratio (log scale) · 95% CI</span>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {/* Column headers */}
            {(() => {
              const { xMin, xMax } = computeAxisBounds(safeData)
              return (
                <>
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                    <div className="w-52 shrink-0 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Analysis</div>
                    <div className="flex-1 relative text-[9px] text-gray-600">
                      <span className="absolute" style={{ left: '0%' }}>{xMin.toFixed(1)}</span>
                      <span className="absolute -translate-x-1/2" style={{ left: `${((NULL_LINE - xMin) / (xMax - xMin)) * 100}%` }}>1.0</span>
                      <span className="absolute right-0">{xMax.toFixed(1)}</span>
                    </div>
                    <div className="w-36 shrink-0 text-[10px] text-gray-500 font-bold uppercase tracking-wider text-right">HR [95% CI]</div>
                  </div>
                  {safeData.map((row, i) => (
                    <div key={i} onClick={() => { setSelectedResult(row.label); setShowWorkOpen(true) }} className="cursor-pointer">
                      <ForestRow row={row} xMin={xMin} xMax={xMax} />
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
          <div className="flex items-center gap-6 mt-2 text-[10px] text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm rotate-45 bg-[#2563EB] inline-block" /> Primary estimate</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Sensitivity / subgroup</span>
            <span className="flex items-center gap-1.5"><span className="w-px h-3 bg-gray-600 inline-block" /> Null (HR = 1.0)</span>
          </div>
        </section>

        {/* Multiplicity Adjustment */}
        <section className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
          <button
            onClick={() => setMultiplicityOpen(!multiplicityOpen)}
            className="w-full flex items-center justify-between px-5 py-4 bg-gray-100/80 dark:bg-white/4 hover:bg-gray-200/80 dark:hover:bg-white/6 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 text-[#60a5fa]" />
              <div className="text-left">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Multiplicity Adjustment</h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Adjust p-values for multiple comparisons across {safeData.length} hypotheses</p>
              </div>
            </div>
            {multiplicityOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </button>

          {multiplicityOpen && (
            <div className="p-5 space-y-4">
              {/* Method selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-400 whitespace-nowrap">Adjustment Method:</label>
                <select
                  value={multiplicityMethod}
                  onChange={(e) => setMultiplicityMethod(e.target.value)}
                  className="bg-gray-200/80 dark:bg-white/6 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                >
                  {MULTIPLICITY_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Results table */}
              <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 gap-3 px-4 py-2.5 bg-gray-200/60 dark:bg-white/3 border-b border-gray-200 dark:border-white/8">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Hypothesis</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-right">Raw p-value</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-right">Adjusted p-value</span>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center">Rejected</span>
                </div>
                {safeData.map((row, i) => (
                  <div key={i} className={`grid grid-cols-4 gap-3 items-center px-4 py-2.5 text-xs border-b border-gray-200/50 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/3 transition-colors ${row.primary ? 'bg-[#2563EB]/5' : ''}`}>
                    <span className={`${row.primary ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400'} truncate`}>{row.label}</span>
                    <span className="text-right font-mono text-gray-300">{rawPValues[i]?.toFixed(4)}</span>
                    <span className={`text-right font-mono ${adjustedPValues[i] < alpha ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                      {adjustedPValues[i]?.toFixed(4)}
                    </span>
                    <span className="text-center">
                      {adjustedPValues[i] < alpha
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                        : <span className="text-gray-600 text-sm">&#x2717;</span>
                      }
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-200/40 dark:bg-white/2 rounded-lg px-4 py-3">
                <p className="text-[10px] text-gray-500">
                  <strong className="text-gray-300">Method:</strong> {MULTIPLICITY_METHODS.find(m => m.value === multiplicityMethod)?.label} correction applied at alpha = {alpha}. {adjustedPValues.filter(p => p < alpha).length} of {safeData.length} hypotheses rejected after adjustment.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Interpretation — dynamically generated from results */}
        {primaryResult && (
          <section>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Pre-specified Interpretation Framework</h2>
            <div className="bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-5 space-y-3">
              {primaryResult.est < 1 ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">Point estimate (HR {primaryResult.est?.toFixed(2)}) is consistent with a <strong className="text-white">{Math.round((1 - primaryResult.est) * 100)}% relative risk reduction</strong> in the primary endpoint.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">Point estimate (HR {primaryResult.est?.toFixed(2)}) suggests a <strong className="text-white">{Math.round((primaryResult.est - 1) * 100)}% relative risk increase</strong> in the primary endpoint.</p>
                </div>
              )}
              {primaryResult.lo != null && primaryResult.hi != null && primaryResult.lo <= 1 && primaryResult.hi >= 1 && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">Wide confidence interval ({primaryResult.lo?.toFixed(2)}–{primaryResult.hi?.toFixed(2)}) — <strong className="text-white">cannot exclude chance or harm</strong>.</p>
                </div>
              )}
              {safeData.length > 1 && (
                <div className="flex items-start gap-3">
                  {safeData.every((r: any) => r.est < 1 === (primaryResult.est < 1)) ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300">Results are <strong className="text-white">directionally consistent</strong> across all {safeData.length - 1} sensitivity/subgroup analyses.</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-300">Results show <strong className="text-white">directional inconsistency</strong> across sensitivity analyses. Interpret with caution.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <a href={`/projects/${selectedStudy.id}/comparability`} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 5: Comparability & Balance
          </a>
          <a href={`/projects/${selectedStudy.id}/bias-sensitivity`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 7: Bias & Sensitivity <ChevronRight className="h-4 w-4" />
          </a>
        </div>

      </div>
      <ShowYourWork
        isOpen={showWorkOpen}
        onClose={() => setShowWorkOpen(false)}
        resultId={selectedResult === 'primary' ? 'run-001' : `sensitivity-${selectedResult}`}
        resultLabel={selectedResult === 'primary' ? 'Primary Analysis — IPTW Cox PH' : selectedResult}
        resultType="estimate"
        analysisData={analysisResults}
        projectId={selectedStudy?.id}
      />
    </div>
  )
}
