import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, Plus, X, Info, Loader2, AlertCircle, FileText } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const DEFAULT_COVARIATES = [
//   { name: 'Age at index date', type: 'Confounder', balance: 'SMD 0.04', status: 'balanced' },
//   { name: 'Sex', type: 'Confounder', balance: 'SMD 0.02', status: 'balanced' },
//   { name: 'Comorbidity index (CCI)', type: 'Confounder', balance: 'SMD 0.09', status: 'balanced' },
//   { name: 'Prior hospitalizations (12 mo)', type: 'Confounder', balance: 'SMD 0.12', status: 'review' },
//   { name: 'Concomitant medications', type: 'Confounder', balance: 'SMD 0.07', status: 'balanced' },
//   { name: 'Insurance type', type: 'Selection bias proxy', balance: 'SMD 0.21', status: 'imbalanced' },
//   { name: 'Time since diagnosis', type: 'Effect modifier', balance: 'SMD 0.05', status: 'balanced' },
//   { name: 'Treating physician specialty', type: 'Instrumental variable candidate', balance: 'SMD 0.18', status: 'review' },
// ]

// SCHEMA REFERENCE — not shown to users
// const UNMEASURED_CONFOUNDERS = [
//   { name: 'Disease severity (genetic)', risk: 'High', mitigation: 'E-value computed in Step 7' },
//   { name: 'Lifestyle factors (BMI, smoking)', risk: 'Moderate', mitigation: 'Proxy variables included (pharmacy claims)' },
//   { name: 'Socioeconomic status', risk: 'Moderate', mitigation: 'Insurance proxy + area deprivation index' },
// ]

const statusColor: Record<string, string> = {
  balanced:   'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  review:     'text-orange-300 bg-orange-900/30 border-orange-600/40',
  imbalanced: 'text-red-400 bg-red-900/20 border-red-700/30',
}

export default function CausalFramework({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: covData, loading, error, saving, save } = useStudyData(selectedStudy?.id, 'covariates')

  const [estimand] = useState(selectedStudy.estimand)
  const [covariates, setCovariates] = useState<any[]>([])
  const [unmeasuredConfounders, setUnmeasuredConfounders] = useState<any[]>([])
  const [newCovariate, setNewCovariate] = useState('')
  const locked = protocolLocked

  useEffect(() => {
    if (covData) {
      if (Array.isArray(covData.covariates) && covData.covariates.length) setCovariates(covData.covariates)
      if (Array.isArray(covData.unmeasured) && covData.unmeasured.length) setUnmeasuredConfounders(covData.unmeasured)
    }
  }, [covData])

  // Defensive: ensure state is always an array
  const safeCovariates = Array.isArray(covariates) ? covariates : []
  const safeUnmeasured = Array.isArray(unmeasuredConfounders) ? unmeasuredConfounders : []

  const addCovariate = async () => {
    if (!newCovariate.trim()) return
    const updated = [...safeCovariates, { name: newCovariate.trim(), type: 'Confounder', balance: 'Pending', status: 'review' }]
    setCovariates(updated)
    setNewCovariate('')
    await save({ covariates: updated, unmeasured: unmeasuredConfounders })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 02</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Causal Framework</h1>
              <p className="text-gray-500 text-xs mt-0.5">Estimand · DAG · covariate selection · unmeasured confounders</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">Estimand: <span className="text-[#2563EB] dark:text-[#60a5fa] font-semibold">{estimand}</span></p>
          </div>
        </div>
      </div>

      <LiteratureEvidence categories={['covariate', 'estimand', 'general']} stepLabel="Causal Framework" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading causal framework data...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Failed to load causal framework data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {/* Estimand summary */}
        <div className="bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            <h2 className="text-sm font-bold text-[#2563EB] dark:text-[#60a5fa]">Pre-specified Estimand: {estimand}</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {estimand === 'ATT' && 'Average Treatment Effect on the Treated — estimates the effect of treatment among patients who would receive it in practice. This is the target of inference for external comparator study designs.'}
            {estimand === 'ATE' && 'Average Treatment Effect — estimates the effect averaged over the full eligible population, assuming all patients could be assigned to either arm.'}
            {estimand === 'ITT' && 'Intention to Treat — estimates the effect of treatment assignment, regardless of actual adherence. Aligns with randomised trial primary analysis.'}
            {estimand === 'PP' && 'Per Protocol — estimates the effect of receiving treatment as assigned, among adherers only. Typically used as a sensitivity analysis.'}
          </p>
        </div>

        {/* DAG visualization — structural reference diagram */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Directed Acyclic Graph (DAG)</h2>
            <span className="text-[10px] text-amber-500 bg-amber-900/20 border border-amber-700/30 px-2.5 py-1 rounded-full font-semibold">Reference Diagram — Not Data-Driven</span>
          </div>
          <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-6 min-h-[220px] flex items-center justify-center">
            <svg viewBox="0 0 580 200" className="w-full max-w-[560px]" fill="none">
              {/* Nodes */}
              {[
                { x: 60,  y: 100, label: 'L\n(Covariates)', color: '#2563EB' },
                { x: 230, y: 40,  label: 'A\n(Treatment)', color: '#2563EB' },
                { x: 230, y: 160, label: 'U\n(Unmeasured)', color: '#dc2626' },
                { x: 400, y: 100, label: 'Y\n(Outcome)',   color: '#10b981' },
                { x: 520, y: 100, label: 'C\n(Censoring)', color: '#f59e0b' },
              ].map(({ x, y, label, color }) => (
                <g key={label}>
                  <circle cx={x} cy={y} r={28} fill={color + '20'} stroke={color} strokeWidth="1.5" />
                  {label.split('\n').map((line, i) => (
                    <text key={i} x={x} y={y + (i === 0 ? -4 : 10)} textAnchor="middle" fill={color} fontSize="10" fontWeight="700">{line}</text>
                  ))}
                </g>
              ))}
              {/* Arrows */}
              <defs>
                <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#6b7280" />
                </marker>
                <marker id="arr-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
                </marker>
              </defs>
              {/* L → A */}
              <line x1="88" y1="88" x2="200" y2="50" stroke="#6b7280" strokeWidth="1.5" markerEnd="url(#arr)" />
              {/* L → Y */}
              <line x1="88" y1="108" x2="372" y2="104" stroke="#6b7280" strokeWidth="1.5" markerEnd="url(#arr)" />
              {/* A → Y */}
              <line x1="258" y1="55" x2="372" y2="90" stroke="#2563EB" strokeWidth="2" markerEnd="url(#arr)" />
              {/* U → Y (dashed red) */}
              <line x1="258" y1="154" x2="372" y2="114" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arr-red)" />
              {/* U → A (dashed red) */}
              <line x1="230" y1="132" x2="230" y2="68" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arr-red)" />
              {/* Y → C */}
              <line x1="428" y1="100" x2="492" y2="100" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arr)" />
            </svg>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#2563EB] inline-block" /> Treatment pathway</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-500 inline-block border-dashed border-t border-red-500" /> Unmeasured (dashed)</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-gray-600 inline-block" /> Covariate / confounder</span>
          </div>
        </section>

        {/* Covariate table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Pre-specified Covariate Set</h2>
            <span className="text-[10px] text-gray-500">{safeCovariates.length} variables registered</span>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  {['Variable', 'Role', 'Post-matching Balance', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safeCovariates.map((cov, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{cov.name}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{cov.type}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{cov.balance}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor[cov.status]}`}>
                        {cov.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {safeCovariates.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Define covariates in Study Definition, then run balance analysis.</p>
            </div>
          )}

          {!locked && !reviewerMode && (
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                placeholder="Add covariate…"
                value={newCovariate}
                onChange={e => setNewCovariate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCovariate()}
              />
              <button
                onClick={addCovariate}
                className="flex items-center gap-1.5 bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#2563EB]/40 text-[#2563EB] dark:text-[#60a5fa] text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          )}
        </section>

        {/* Unmeasured confounders */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Unmeasured Confounders — Pre-specified Risk Register</h2>
          {safeUnmeasured.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Define covariates in Study Definition, then run balance analysis.</p>
            </div>
          )}
          <div className="space-y-2">
            {safeUnmeasured.map((u, i) => (
              <div key={i} className="flex items-start justify-between bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{u.mitigation}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ml-4 ${
                  u.risk === 'High' ? 'text-red-400 bg-red-900/20 border-red-700/30' : 'text-orange-300 bg-orange-900/30 border-orange-600/40'
                }`}>
                  {u.risk} Risk
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <Link to={`/projects/${selectedStudy.id}/study`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 1: Study Definition
          </Link>
          <Link to={`/projects/${selectedStudy.id}/data-provenance`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 3: Data Provenance <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  )
}
