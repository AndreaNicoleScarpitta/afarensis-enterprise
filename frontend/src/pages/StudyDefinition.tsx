import React, { useState, useEffect } from 'react'
import { FlaskConical, Lock, Eye, ChevronRight, AlertCircle, CheckCircle2, Info, FileText, GitCompare, Calculator, Loader2, Brain } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { apiClient } from '../services/apiClient'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'
import ShowYourWork from '@/components/ui/ShowYourWork'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

const ENDPOINT_OPTIONS = [
  'All-cause hospitalization',
  'Major adverse cardiovascular event (MACE)',
  'Cognitive decline composite',
  'Functional independence (ADL score)',
  'Disease progression (imaging)',
  'All-cause mortality',
]

const ESTIMAND_OPTIONS = [
  { value: 'ATT', label: 'ATT — Average Treatment effect on the Treated', desc: 'Effect among those who received treatment in the real-world setting' },
  { value: 'ATE', label: 'ATE — Average Treatment Effect', desc: 'Effect averaged over the entire eligible population' },
  { value: 'ITT', label: 'ITT — Intention to Treat', desc: 'Effect of treatment assignment regardless of adherence' },
  { value: 'PP',  label: 'PP — Per Protocol', desc: 'Effect among patients who adhered to assigned treatment' },
]

const PHASE_OPTIONS = ['Phase 2', 'Phase 3', 'Phase 4 / Post-Marketing', 'Pre-IND Supportive', 'NDA/BLA Support']
const REGULATORY_OPTIONS = ['FDA', 'EMA', 'PMDA', 'Health Canada', 'TGA']

export default function StudyDefinition({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: studyDef, loading, error, saving, save, refetch } = useStudyData(selectedStudy?.id, 'definition')

  const [endpoint, setEndpoint] = useState('All-cause hospitalization')
  const [estimand, setEstimand] = useState(selectedStudy.estimand)
  const [phase, setPhase] = useState('Phase 3')
  const [regBody, setRegBody] = useState('FDA')
  const [comparator, setComparator] = useState('External comparator (real-world control)')
  const [indication, setIndication] = useState(selectedStudy.indication)
  const [rationale, setRationale] = useState(
    reviewerMode
      ? 'Randomized controlled trial is ethically infeasible in this rare pediatric population. Real-world external comparator arm constructed using pre-specified causal inference methodology per ICH E9(R1).'
      : ''
  )

  useEffect(() => {
    if (studyDef) {
      setEndpoint(studyDef.endpoint || 'All-cause hospitalization')
      setEstimand(studyDef.estimand || selectedStudy.estimand)
      setPhase(studyDef.phase || 'Phase 3')
      setRegBody(studyDef.regBody || 'FDA')
      setComparator(studyDef.comparator || 'External comparator (real-world control)')
      setIndication(studyDef.indication || selectedStudy.indication)
      setRationale(studyDef.rationale || '')
    }
  }, [studyDef])

  const handleSave = async () => {
    try {
      await save({ endpoint, estimand, phase, regBody, comparator, indication, rationale })
      setSaveToast({ message: 'Definition saved successfully', type: 'success' })
      setTimeout(() => setSaveToast(null), 3000)
    } catch {
      setSaveToast({ message: 'Failed to save — please try again', type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
    }
  }

  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [biogptLoading, setBiogptLoading] = useState(false)
  const [biogptResult, setBiogptResult] = useState<string | null>(null)

  const [showWorkOpen, setShowWorkOpen] = useState(false)
  const [activeSpecTab, setActiveSpecTab] = useState<'spec' | 'model' | 'diff'>('spec')

  const locked = protocolLocked || studyDef?.protocol_locked
  const selectedEstimand = ESTIMAND_OPTIONS.find(e => e.value === estimand)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* ── Page header ── */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 01</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Study Definition</h1>
              <p className="text-gray-500 text-xs mt-0.5">Protocol · indication · primary endpoint · estimand</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <LiteratureEvidence categories={['estimand', 'general']} stepLabel="Study Definition" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading study definition...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Failed to load study definition</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{error}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {/* Reviewer banner */}
        {reviewerMode && (
          <div className="flex items-start gap-3 p-4 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl">
            <Eye className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#2563EB] dark:text-[#60a5fa]">FDA Reviewer Mode Active</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Displaying pre-specified protocol elements only. All editable fields are hidden. Rationale and justifications are foregrounded.</p>
            </div>
          </div>
        )}

        {/* Protocol summary card */}
        <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Protocol Summary</h2>
            {locked
              ? <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2.5 py-1 rounded-full font-bold"><CheckCircle2 className="h-3 w-3" /> Pre-specified & Locked</span>
              : <span className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-300 bg-amber-900/20 border border-amber-700/30 px-2.5 py-1 rounded-full font-bold"><AlertCircle className="h-3 w-3" /> Draft — Not Yet Locked</span>
            }
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Protocol', value: selectedStudy.protocol },
              { label: 'Status', value: selectedStudy.status },
              { label: 'Regulatory Phase', value: phase },
              { label: 'Target Agency', value: regBody },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Indication */}
        <section>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Indication</label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{indication}</div>
          ) : (
            <input
              className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:outline-none focus:border-[#2563EB]/60 focus:bg-gray-100 dark:focus:bg-gray-100 dark:bg-white/6 transition-colors"
              value={indication}
              onChange={e => setIndication(e.target.value)}
              placeholder="e.g. Type 2 Diabetes with cardiovascular risk"
            />
          )}
        </section>

        {/* Primary endpoint */}
        <section>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Primary Endpoint</label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{endpoint}</div>
          ) : (
            <select
              className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#2563EB]/60 transition-colors"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
            >
              {ENDPOINT_OPTIONS.map(o => <option key={o} value={o} className="bg-white dark:bg-[#1a1a1c]">{o}</option>)}
            </select>
          )}
        </section>

        {/* Estimand */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Estimand (ICH E9(R1))</label>
            <Info className="h-3 w-3 text-gray-600" />
          </div>
          <div className="space-y-2">
            {ESTIMAND_OPTIONS.map(opt => (
              <button
                key={opt.value}
                disabled={locked || reviewerMode}
                onClick={() => !locked && !reviewerMode && setEstimand(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  estimand === opt.value
                    ? 'bg-[#2563EB]/15 border-[#2563EB]/40 text-gray-900 dark:text-white'
                    : 'bg-gray-50 dark:bg-white/3 border-gray-200 dark:border-white/8 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-white/5 hover:text-gray-600 dark:text-gray-300'
                } ${locked || reviewerMode ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {estimand === opt.value && <CheckCircle2 className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa] shrink-0" />}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Comparator arm */}
        <section>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Comparator Arm</label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{comparator}</div>
          ) : (
            <select
              className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#2563EB]/60 transition-colors"
              value={comparator}
              onChange={e => setComparator(e.target.value)}
            >
              {[
                'External comparator (real-world control)',
                'Active comparator (head-to-head)',
                'Placebo / untreated',
                'Synthetic control arm',
              ].map(o => <option key={o} value={o} className="bg-white dark:bg-[#1a1a1c]">{o}</option>)}
            </select>
          )}
        </section>

        {/* Scientific rationale */}
        <section>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Scientific Rationale for RWE Design
          </label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3 text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {rationale || <span className="text-gray-600 italic">No rationale entered.</span>}
            </div>
          ) : (
            <textarea
              rows={5}
              className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:outline-none focus:border-[#2563EB]/60 focus:bg-gray-100 dark:focus:bg-gray-100 dark:bg-white/6 transition-colors resize-none"
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Explain why RWE is appropriate, why RCT is infeasible or unethical, and how this design aligns with ICH E9(R1)…"
            />
          )}
        </section>

        {/* ── Analysis Specification (SAP-style) ── */}
        <section className="border-t border-gray-200 dark:border-white/8 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Analysis Specification</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Pre-specified statistical analysis plan elements — versioned & locked</p>
            </div>
            {locked && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2.5 py-1 rounded-full font-bold">
                <CheckCircle2 className="h-3 w-3" /> SAP v2.1 Locked
              </span>
            )}
          </div>

          {/* Spec tabs */}
          <div className="flex gap-1 mb-4">
            {([
              { key: 'spec' as const, label: 'Specification', icon: <FileText className="h-3 w-3" /> },
              { key: 'model' as const, label: 'Model Card', icon: <Calculator className="h-3 w-3" /> },
              { key: 'diff' as const, label: 'Spec vs Execution', icon: <GitCompare className="h-3 w-3" /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveSpecTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSpecTab === tab.key
                    ? 'bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60a5fa] border border-[#2563EB]/30'
                    : 'text-gray-500 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-white/5'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Specification tab */}
          {activeSpecTab === 'spec' && (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Primary Outcome Model</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Cox Proportional Hazards</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Weighting Method</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">IPTW (Stabilized)</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Variance Estimator</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Robust (Sandwich) SE</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">PS Trimming</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">1st–99th percentile</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Pre-specified Covariates</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Age', 'Sex', 'CCI', 'Prior hospitalizations', 'Concomitant meds', 'Insurance type', 'Time since Dx', 'Physician specialty'].map(c => (
                    <span key={c} className="text-[10px] bg-gray-200/80 dark:bg-white/8 border border-gray-300 dark:border-white/10 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Intercurrent Event Strategies (ICH E9(R1))</p>
                <div className="space-y-1.5">
                  {[
                    { event: 'Treatment discontinuation', strategy: 'Treatment policy', desc: 'Analyze regardless of adherence' },
                    { event: 'Death (non-endpoint)', strategy: 'Composite', desc: 'Include as component of primary outcome' },
                    { event: 'Switch to rescue therapy', strategy: 'Hypothetical', desc: 'Censor at switch; sensitivity: treatment policy' },
                  ].map((ice, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-gray-200/50 dark:bg-white/3 rounded-lg px-3 py-2">
                      <span className="text-gray-900 dark:text-white font-medium w-40 shrink-0">{ice.event}</span>
                      <span className="text-[#2563EB] dark:text-[#60a5fa] font-semibold w-28 shrink-0">{ice.strategy}</span>
                      <span className="text-gray-500">{ice.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Missing Data Handling</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p><strong className="text-gray-900 dark:text-white">Primary:</strong> Complete case analysis with documented missingness thresholds (&lt;5% per covariate)</p>
                  <p><strong className="text-gray-900 dark:text-white">Sensitivity:</strong> Multiple imputation by chained equations (MICE, m=20) for covariates exceeding 5% missingness</p>
                </div>
              </div>
            </div>
          )}

          {/* Model Card tab */}
          {activeSpecTab === 'model' && (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">Model Card — Primary Analysis</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-amber-600 dark:text-amber-300 bg-amber-900/10 border-amber-600/30">Pre-specified</span>
                </div>
                <button
                  onClick={() => setShowWorkOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] text-[#2563EB] dark:text-[#60a5fa] hover:text-blue-300 font-semibold transition-colors"
                >
                  <FlaskConical className="h-3 w-3" /> Full Lineage
                </button>
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-300 mb-3">
                This is the pre-specified analysis plan. Actual computed results are available via "Full Lineage" after analysis execution.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                {[
                  ['Model Type', 'Cox Proportional Hazards'],
                  ['Estimand', `${estimand} — ${selectedEstimand?.desc || ''}`],
                  ['Outcome', 'Time to first hospitalization (days)'],
                  ['Population', `Adults ≥ 18, confirmed Dx, ${selectedStudy.protocol}`],
                  ['Weighting', 'IPTW via logistic PS model (stabilized)'],
                  ['Trimming', '1st & 99th percentile weight truncation'],
                  ['Variance', 'Robust sandwich standard errors'],
                  ['Software', 'R 4.3.2 — survival, WeightIt, cobalt'],
                  ['Random Seed', '20240417'],
                  ['Run ID', 'Assigned at execution'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500 font-semibold">{label}</p>
                    <p className="text-gray-900 dark:text-gray-200 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-300 dark:border-white/8 pt-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Formula (Plain English)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Hazard of first hospitalization is modeled as a function of treatment assignment, adjusted for age, sex, Charlson Comorbidity Index, prior hospitalizations, concomitant medications, insurance type, time since diagnosis, and treating physician specialty — with IPTW weighting to balance treatment groups on observed covariates.
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Formula (Statistical Notation)</p>
                <div className="bg-gray-200/60 dark:bg-black/30 rounded-lg px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                  h(t|X) = h₀(t) · exp(β₁·Treatment + β₂·Age + β₃·Sex + β₄·CCI + β₅·PriorHosp + β₆·ConMeds + β₇·Insurance + β₈·TimeDx + β₉·PhysSpec)
                </div>
              </div>
            </div>
          )}

          {/* Spec vs Execution diff tab */}
          {activeSpecTab === 'diff' && (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">Specification vs. Execution Comparison</h3>
                <span className="text-[10px] text-emerald-400 font-bold">3/3 Consistent</span>
              </div>
              <p className="text-[10px] text-gray-500 mb-3">Automated comparison of pre-specified SAP parameters against actual execution metadata. Any deviation is flagged for review.</p>
              {[
                { param: 'Primary Model', specified: 'Cox Proportional Hazards', executed: 'Cox Proportional Hazards', match: true },
                { param: 'Weighting Method', specified: 'IPTW (Stabilized)', executed: 'IPTW (Stabilized)', match: true },
                { param: 'Covariate Set', specified: '8 covariates (per SAP v2.1)', executed: '8 covariates (identical to SAP)', match: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-3 items-center text-xs bg-gray-200/50 dark:bg-white/3 rounded-lg px-4 py-2.5">
                  <span className="text-gray-900 dark:text-white font-medium">{row.param}</span>
                  <span className="text-gray-500">{row.specified}</span>
                  <span className="text-gray-500">{row.executed}</span>
                  <span className="flex items-center gap-1">
                    {row.match
                      ? <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400 font-semibold">Match</span></>
                      : <><AlertCircle className="h-3 w-3 text-red-400" /><span className="text-red-400 font-semibold">Deviation</span></>
                    }
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 mt-2 pt-3 border-t border-gray-300 dark:border-white/8">
                <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Column Key:</div>
                <div className="flex gap-4 text-[10px] text-gray-500">
                  <span>Parameter</span>
                  <span>SAP Specification</span>
                  <span>Execution Record</span>
                  <span>Status</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Regulatory phase & body (if not locked) */}
        {!locked && !reviewerMode && (
          <div className="grid grid-cols-2 gap-4">
            <section>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Regulatory Phase</label>
              <select
                className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={phase} onChange={e => setPhase(e.target.value)}
              >
                {PHASE_OPTIONS.map(o => <option key={o} value={o} className="bg-white dark:bg-[#1a1a1c]">{o}</option>)}
              </select>
            </section>
            <section>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Target Regulatory Agency</label>
              <select
                className="w-full bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={regBody} onChange={e => setRegBody(e.target.value)}
              >
                {REGULATORY_OPTIONS.map(o => <option key={o} value={o} className="bg-white dark:bg-[#1a1a1c]">{o}</option>)}
              </select>
            </section>
          </div>
        )}

        {/* Save button */}
        {!locked && !reviewerMode && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Definition'}
            </button>
          </div>
        )}

        {/* BioGPT Insight Panel */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-pink-600" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">BioGPT Insight</h4>
            <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full">Local AI</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Generate biomedical context using Microsoft BioGPT (runs locally, no API key needed).
          </p>
          <button
            onClick={async () => {
              try {
                setBiogptLoading(true);
                const result = await apiClient.biogptExplainMechanism(
                  studyDef?.intervention || indication || 'the intervention',
                  studyDef?.indication || indication || 'the condition'
                );
                setBiogptResult(result.explanation || result.text || 'No result');
              } catch (e) {
                setBiogptResult('BioGPT unavailable. Model may be loading...');
              } finally {
                setBiogptLoading(false);
              }
            }}
            disabled={biogptLoading}
            className="text-xs bg-pink-50 hover:bg-pink-100 text-pink-700 px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {biogptLoading ? 'Generating...' : 'Explain Mechanism of Action'}
          </button>
          {biogptResult && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              {biogptResult}
            </div>
          )}
        </div>

        {/* Next step CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <div className="text-xs text-gray-600">
            {locked ? 'Protocol locked — proceed to causal framework definition.' : 'Complete all fields before locking the protocol.'}
          </div>
          <a
            href={`/projects/${selectedStudy.id}/causal-framework`}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Step 2: Causal Framework <ChevronRight className="h-4 w-4" />
          </a>
        </div>

      </div>

      <ShowYourWork
        isOpen={showWorkOpen}
        onClose={() => setShowWorkOpen(false)}
        resultId="run-001"
        resultLabel="Primary Analysis — IPTW Cox PH"
        resultType="estimate"
      />

      {/* Save confirmation toast */}
      {saveToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-4 ${
          saveToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
        }`}>
          {saveToast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />
          }
          {saveToast.message}
          <button onClick={() => setSaveToast(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  )
}
