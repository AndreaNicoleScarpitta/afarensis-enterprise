import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Loader2, BarChart3 } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const COVARIATES = [
//   { name: 'Age (years)',                 smd_raw: 0.42, smd_matched: 0.04, pass: true },
//   { name: 'Female sex (%)',              smd_raw: 0.18, smd_matched: 0.02, pass: true },
//   { name: 'CCI score',                  smd_raw: 0.61, smd_matched: 0.09, pass: true },
//   { name: 'Prior hospitalization',       smd_raw: 0.38, smd_matched: 0.12, pass: true },
//   { name: 'Concomitant medications',    smd_raw: 0.29, smd_matched: 0.07, pass: true },
//   { name: 'Insurance type',             smd_raw: 0.53, smd_matched: 0.21, pass: false },
//   { name: 'Time since diagnosis',       smd_raw: 0.31, smd_matched: 0.05, pass: true },
//   { name: 'Treating physician specialty', smd_raw: 0.44, smd_matched: 0.18, pass: true },
// ]

const THRESHOLD = 0.10

function SmdBar({ value, max = 0.7 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value < THRESHOLD ? '#10b981' : value < 0.20 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-xs w-10 text-right" style={{ color }}>{value.toFixed(2)}</span>
    </div>
  )
}

export default function ComparabilityBalance({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: balanceData, loading, error, refetch, runComputation } = useStudyData(selectedStudy?.id, 'balance')

  const [covariates, setCovariates] = useState<any[]>([])
  const locked = protocolLocked

  useEffect(() => {
    if (balanceData && Array.isArray(balanceData.covariates) && balanceData.covariates.length) {
      setCovariates(balanceData.covariates)
    }
  }, [balanceData])

  // Defensive: ensure state is always an array
  const safeCovariates = Array.isArray(covariates) ? covariates : []

  const handleComputeBalance = async () => {
    const result = await runComputation('balance/compute')
    if (result?.covariates) setCovariates(result.covariates)
  }

  const passCount = safeCovariates.filter(c => c.pass).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 05</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Comparability & Balance</h1>
              <p className="text-gray-500 text-xs mt-0.5">Standardised mean differences · overlap diagnostics · PS distribution</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">Estimand: {selectedStudy.estimand}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading balance data...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Failed to load balance data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{error}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {safeCovariates.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <BarChart3 className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Run propensity score analysis to see covariate balance.</p>
          </div>
        )}

        {/* Overall balance summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Balance Threshold', value: 'SMD < 0.10', color: 'text-white' },
            { label: 'Covariates Balanced', value: `${passCount} / ${safeCovariates.length}`, color: passCount === safeCovariates.length ? 'text-emerald-400' : 'text-amber-600 dark:text-amber-300' },
            { label: 'Max Post-weight SMD', value: safeCovariates.length > 0 ? Math.max(...safeCovariates.map(c => c.smd_matched ?? 0)).toFixed(2) : '—', color: safeCovariates.length > 0 && Math.max(...safeCovariates.map(c => c.smd_matched ?? 0)) >= THRESHOLD ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Balance threshold flag — data-driven */}
        {passCount < safeCovariates.length && safeCovariates.length > 0 && (() => {
          const failing = safeCovariates.filter(c => !c.pass)
          return (
            <div className="flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                  Balance Warning: {failing.length} covariate{failing.length > 1 ? 's' : ''} above threshold
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                  {failing.map((c, i) => (
                    <li key={i}>{c.name} — post-weighting SMD {(c.smd_matched ?? 0).toFixed(2)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })()}

        {/* SMD Love plot table */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Standardised Mean Differences (Love Plot)</h2>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px] w-48">Covariate</th>
                  <th className="px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Before Weighting</th>
                  <th className="px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">After Weighting</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px] w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {safeCovariates.map((cov, i) => (
                  <tr key={i} className={`border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:bg-white/3 transition-colors`}>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">{cov.name}</td>
                    <td className="px-4 py-3">
                      <SmdBar value={cov.smd_raw} />
                    </td>
                    <td className="px-4 py-3">
                      <SmdBar value={cov.smd_matched} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cov.pass
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                        : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 mx-auto" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">Threshold: SMD &lt; 0.10 considered adequate balance. Red bars indicate SMD ≥ 0.20.</p>
        </section>

        {/* Propensity score overlap — data-driven */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Propensity Score Overlap</h2>
          {balanceData?.ps_distribution ? (
            <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-5">
              {/* Treatment arm histogram — from API data */}
              {balanceData.ps_distribution.treatment_bins && (
                <div className="flex items-end justify-center gap-0.5 h-32 mb-3">
                  {balanceData.ps_distribution.treatment_bins.map((h: number, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                      <div className="w-full bg-[#2563EB]/60 rounded-t" style={{ height: `${Math.max(1, (h / Math.max(...balanceData.ps_distribution.treatment_bins)) * 120)}px` }} />
                    </div>
                  ))}
                </div>
              )}
              {/* Comparator arm histogram — from API data */}
              {balanceData.ps_distribution.comparator_bins && (
                <div className="flex items-end justify-center gap-0.5 h-32 mb-3">
                  {balanceData.ps_distribution.comparator_bins.map((h: number, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                      <div className="w-full bg-white/20 rounded-t" style={{ height: `${Math.max(1, (h / Math.max(...balanceData.ps_distribution.comparator_bins)) * 120)}px` }} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-gray-600 border-t border-gray-200 dark:border-white/8 pt-3 mt-2">
                <span>PS = 0.0</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#2563EB]/60 rounded-sm inline-block" /> Treatment{balanceData.ps_distribution.n_treatment != null ? ` (n=${balanceData.ps_distribution.n_treatment.toLocaleString()})` : ''}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-white/20 rounded-sm inline-block" /> Comparator{balanceData.ps_distribution.n_comparator != null ? ` (n=${balanceData.ps_distribution.n_comparator.toLocaleString()})` : ''}</span>
                </div>
                <span>PS = 1.0</span>
              </div>
              {balanceData.ps_distribution.overlap_region && (
                <p className="text-[10px] text-gray-600 mt-2">
                  Effective common support region: PS {balanceData.ps_distribution.overlap_region}.
                  {balanceData.ps_distribution.trimming_rule ? ` ${balanceData.ps_distribution.trimming_rule}` : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-8 text-center">
              <BarChart3 className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Propensity Score Distribution Not Available</p>
              <p className="text-xs text-gray-600 mt-1">Run propensity score analysis to generate overlap diagnostics.</p>
            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <Link to={`/projects/${selectedStudy.id}/cohort`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 4: Cohort Construction
          </Link>
          <Link to={`/projects/${selectedStudy.id}/effect-estimation`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 6: Effect Estimation <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  )
}
