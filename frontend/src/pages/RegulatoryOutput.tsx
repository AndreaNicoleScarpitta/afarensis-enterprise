// @ts-nocheck
/* eslint-disable */
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileOutput, Lock, Eye, ChevronLeft, CheckCircle2, Download, AlertCircle, Shield, Loader2, FileText, BarChart3, Image, Package } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import { apiClient } from '../services/apiClient'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const SAR_SECTIONS = [
//   { id: 'study-design',   label: '1. Study Design & Rationale',          status: 'complete', words: 1240 },
//   { id: 'data-sources',   label: '2. Data Sources & Provenance',          status: 'complete', words: 890 },
//   { id: 'population',     label: '3. Study Population & Eligibility',     status: 'complete', words: 1105 },
//   { id: 'exposure',       label: '4. Exposure Definition & New User Design', status: 'complete', words: 760 },
//   { id: 'estimand',       label: '5. Estimand & Causal Framework',        status: 'complete', words: 980 },
//   { id: 'comparability',  label: '6. Comparability & Balance Assessment', status: 'complete', words: 1430 },
//   { id: 'results',        label: '7. Primary & Sensitivity Results',      status: 'complete', words: 1670 },
//   { id: 'bias',           label: '8. Bias Quantification (E-value)',      status: 'complete', words: 540 },
//   { id: 'reproducibility','label': '9. Reproducibility & Code Manifest', status: 'complete', words: 420 },
//   { id: 'limitations',    label: '10. Limitations & Uncertainty Quantification', status: 'review', words: 310 },
//   { id: 'conclusions',    label: '11. Conclusions',                       status: 'pending', words: 0 },
// ]

const EXPORT_FORMATS = [
  { format: 'PDF -- Full SAR (FDA submission ready)',    icon: 'pdf', size: '~4.2 MB', available: true },
  { format: 'Word .docx -- Editable SAR draft',         icon: 'doc', size: '~1.8 MB', available: true },
  { format: 'R Markdown -- Reproducible report source', icon: 'rmd', size: '~340 KB', available: true },
  { format: 'CDISC ODM-XML -- Data submission package', icon: 'xml', size: '~12.1 MB', available: false },
  { format: 'eCTD Module 5.3.5.3 -- RWE package',       icon: 'ectd', size: '~18.4 MB', available: false },
]

// SCHEMA REFERENCE — not shown to users
// const READINESS_CHECKS = [
//   { check: 'Protocol pre-specified and locked',        pass: true },
//   { check: 'Estimand formally defined (ICH E9(R1))',   pass: true },
//   { check: 'All 10 workflow steps completed',          pass: false, note: 'Steps 10-11 pending' },
//   { check: 'Sensitivity analyses complete',            pass: false, note: '1 pending (EHR subpopulation)' },
//   { check: 'Bias quantification documented (E-value)', pass: true },
//   { check: 'Reproducibility manifest signed',          pass: false, note: 'EHR validation pending' },
//   { check: 'Audit trail complete and locked',          pass: true },
//   { check: 'No open critical data quality flags',      pass: false, note: 'Flatiron lab completeness 69%' },
// ]

const statusColor: Record<string, string> = {
  complete: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
  review:   'text-amber-600 dark:text-amber-300 bg-amber-900/20 border-amber-700/30',
  pending:  'text-gray-500 bg-gray-100 dark:bg-white/4 border-gray-200 dark:border-white/8',
}

export default function RegulatoryOutput({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: regData, loading, error, save, refetch } = useStudyData(selectedStudy?.id, 'regulatory')
  const staleness = useStalenessCheck(selectedStudy?.id, 'regulatory')

  const [sarSections, setSarSections] = useState<any[]>([])
  const [readinessChecks, setReadinessChecks] = useState<any[]>([])

  // Downstream impacts — empty for terminal step, but wired for future-proofing
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('regulatory')

  // ── Editable regulatory settings ──
  const [submissionAuthority, setSubmissionAuthority] = useState('')
  const [sarIncluded, setSarIncluded] = useState<Record<string, boolean>>({})
  const [exportFormat, setExportFormat] = useState('pdf')
  const [readinessToggles, setReadinessToggles] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (regData) {
      if (Array.isArray(regData.sections) && regData.sections.length) {
        setSarSections(regData.sections)
        // Initialize SAR inclusion toggles from saved data or default all on
        const inclMap: Record<string, boolean> = {}
        regData.sections.forEach((s: any) => { inclMap[s.id] = regData.sar_included?.[s.id] ?? true })
        setSarIncluded(inclMap)
      }
      if (Array.isArray(regData.readiness_checks) && regData.readiness_checks.length) {
        setReadinessChecks(regData.readiness_checks)
        // Initialize readiness toggles from saved data or default all enabled
        const toggleMap: Record<string, boolean> = {}
        regData.readiness_checks.forEach((c: any, i: number) => { toggleMap[c.check || `check-${i}`] = regData.readiness_toggles?.[c.check || `check-${i}`] ?? true })
        setReadinessToggles(toggleMap)
      }
      if (regData.submission_authority) setSubmissionAuthority(regData.submission_authority)
      if (regData.export_format) setExportFormat(regData.export_format)
    }
  }, [regData])

  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [generatedArtifactId, setGeneratedArtifactId] = useState<string | null>(null)

  // SAP generation state
  const [sapGenerating, setSapGenerating] = useState(false)

  // TFL state
  const [activeTflTab, setActiveTflTab] = useState('demographics')
  const [tflResult, setTflResult] = useState<any>(null)
  const [tflLoading, setTflLoading] = useState(false)

  // Submission Package state
  const [submissionResults, setSubmissionResults] = useState<Record<string, any>>({})
  const [submissionLoading, setSubmissionLoading] = useState<Record<string, boolean>>({})
  const [submissionPreview, setSubmissionPreview] = useState<{ key: string; data: any } | null>(null)

  // Defensive: ensure state is always an array
  const safeSarSections = Array.isArray(sarSections) ? sarSections : []
  const safeReadinessChecks = Array.isArray(readinessChecks) ? readinessChecks : []

  const completeSections  = safeSarSections.filter(s => s.status === 'complete').length
  const passChecks = safeReadinessChecks.filter(c => c.pass).length
  const readinessScore = Math.round((passChecks / safeReadinessChecks.length) * 100)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await apiClient.generateSAR(selectedStudy?.id, 'html')
      setGeneratedArtifactId(result.id)
      setGenerated(true)
      if (result.id) {
        const blob = await apiClient.downloadArtifact(selectedStudy?.id, result.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `SAR_${selectedStudy?.protocol || 'report'}.html`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('SAR generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateSAP = async () => {
    setSapGenerating(true)
    try {
      const result = await apiClient.runStudyComputation(selectedStudy?.id, 'sap/generate?format=docx')
      if (result?.id) {
        const blob = await apiClient.downloadArtifact(selectedStudy?.id, result.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `SAP_${selectedStudy?.protocol || 'study'}.docx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('SAP generation failed:', err)
    } finally {
      setSapGenerating(false)
    }
  }

  const TFL_TABS = [
    { key: 'demographics', label: 'Demographics Table', type: 'table' },
    { key: 'ae-table', label: 'AE Table', type: 'table' },
    { key: 'km-curve', label: 'KM Curve', type: 'figure' },
    { key: 'forest-plot', label: 'Forest Plot', type: 'figure' },
    { key: 'love-plot', label: 'Love Plot', type: 'figure' },
  ]

  const handleGenerateTfl = async (type: string) => {
    setTflLoading(true)
    try {
      const result = await apiClient.runStudyComputation(selectedStudy?.id, `tfl/${type}`)
      setTflResult(result)
    } catch (err) {
      console.error('TFL generation failed:', err)
    } finally {
      setTflLoading(false)
    }
  }

  const submissionDocs = [
    { key: 'ectd', label: 'eCTD Module 5 Package', endpoint: 'submission/ectd/generate', format: 'json' },
    { key: 'define-xml', label: 'Define-XML 2.1', endpoint: 'submission/define-xml/generate', format: 'xml' },
    { key: 'adrg', label: 'Analysis Data Reviewer\'s Guide', endpoint: 'submission/adrg/generate', format: 'docx' },
    { key: 'csr-synopsis', label: 'CSR Synopsis', endpoint: 'submission/csr/synopsis', format: 'docx' },
    { key: 'csr-11', label: 'CSR Section 11: Efficacy', endpoint: 'submission/csr/section-11', format: 'docx' },
    { key: 'csr-12', label: 'CSR Section 12: Safety', endpoint: 'submission/csr/section-12', format: 'docx' },
    { key: 'csr-appendix', label: 'CSR Appendix 16.1.9', endpoint: 'submission/csr/appendix-16', format: 'docx' },
    { key: 'csr-full', label: 'Full CSR Package', endpoint: 'submission/csr/full', format: 'json' },
  ]

  const handleGenerateSubmissionDoc = async (key: string, endpoint: string, format: string) => {
    setSubmissionLoading(prev => ({ ...prev, [key]: true }))
    try {
      const result = await apiClient.runStudyComputation(selectedStudy?.id, endpoint)
      setSubmissionResults(prev => ({ ...prev, [key]: result }))
      // Auto-download DOCX files
      if (format === 'docx' && result?.id) {
        const blob = await apiClient.downloadArtifact(selectedStudy?.id, result.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${key}.docx`; a.click()
        URL.revokeObjectURL(url)
      }
      // Show preview for JSON/XML results
      if (format !== 'docx') {
        setSubmissionPreview({ key, data: result })
      }
    } catch (err) {
      console.error(`Submission doc generation failed (${key}):`, err)
    } finally {
      setSubmissionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <FileOutput className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 10</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-white">Regulatory Output</h1>
              <p className="text-gray-500 text-xs mt-0.5">SAR assembly · submission package · eCTD export</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.status}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        <StalenessBanner
          staleUpstreams={staleness.staleUpstreams}
          onAcknowledge={staleness.acknowledge}
        />

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading regulatory data...</div>
        )}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl p-4">
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
            <p className="flex-1 text-sm text-red-600 dark:text-red-400">Error loading data: {error}</p>
            <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* ── Regulatory Settings (editable when unlocked) ── */}
        {!locked && !reviewerMode && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Regulatory Settings</h2>

            {/* Submission target authority */}
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4 space-y-3">
              <label className="block">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Submission Target Authority</span>
                <select
                  value={submissionAuthority}
                  onChange={(e) => {
                    setSubmissionAuthority(e.target.value)
                    save({ submission_authority: e.target.value })
                  }}
                  className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none transition-colors"
                >
                  <option value="">Select authority...</option>
                  <option value="FDA">FDA</option>
                  <option value="EMA">EMA</option>
                  <option value="PMDA">PMDA</option>
                  <option value="Health Canada">Health Canada</option>
                </select>
              </label>

              {/* Export format selection */}
              <label className="block">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Default Export Format</span>
                <select
                  value={exportFormat}
                  onChange={(e) => {
                    setExportFormat(e.target.value)
                    save({ export_format: e.target.value })
                  }}
                  className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none transition-colors"
                >
                  <option value="pdf">PDF -- Full SAR (FDA submission ready)</option>
                  <option value="docx">Word .docx -- Editable SAR draft</option>
                  <option value="rmd">R Markdown -- Reproducible report source</option>
                </select>
              </label>
            </div>

            {/* SAR section inclusion toggles */}
            {safeSarSections.length > 0 && (
              <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">SAR Section Inclusion</p>
                <div className="space-y-2">
                  {safeSarSections.map((sec, i) => (
                    <label key={sec.id || i} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sarIncluded[sec.id] ?? true}
                        onChange={(e) => {
                          const updated = { ...sarIncluded, [sec.id]: e.target.checked }
                          setSarIncluded(updated)
                          save({ sar_included: updated })
                        }}
                        className="rounded border-gray-300 dark:border-white/20 text-[#2563EB] focus:ring-[#2563EB] h-4 w-4"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{sec.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Readiness check toggles */}
            {safeReadinessChecks.length > 0 && (
              <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Readiness Checks — Enable / Disable</p>
                <div className="space-y-2">
                  {safeReadinessChecks.map((item, i) => {
                    const key = item.check || `check-${i}`
                    return (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={readinessToggles[key] ?? true}
                          onChange={(e) => {
                            const updated = { ...readinessToggles, [key]: e.target.checked }
                            setReadinessToggles(updated)
                            save({ readiness_toggles: updated })
                          }}
                          className="rounded border-gray-300 dark:border-white/20 text-[#2563EB] focus:ring-[#2563EB] h-4 w-4"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{item.check}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Readiness score */}
        <div className={`rounded-xl p-6 border ${readinessScore === 100 ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-amber-900/10 border-amber-700/20'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Submission Readiness Score</p>
              <div className="flex items-end gap-3">
                <p className={`text-5xl font-black ${readinessScore === 100 ? 'text-emerald-400' : 'text-amber-600 dark:text-amber-300'}`}>{readinessScore}%</p>
                <p className="text-sm text-gray-500 pb-1">{passChecks} / {safeReadinessChecks.length} checks passed</p>
              </div>
            </div>
            <div className="text-right">
              {readinessScore === 100
                ? <span className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 className="h-5 w-5" /> Submission Ready</span>
                : <span className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold"><AlertCircle className="h-5 w-5" /> Action Required</span>
              }
              <p className="text-[10px] text-gray-600 mt-1">{selectedStudy.protocol} · {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${readinessScore === 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${readinessScore}%` }}
            />
          </div>
        </div>

        {/* Readiness checklist */}
        <section>
          <h2 className="text-sm font-bold text-white mb-3">Submission Readiness Checklist</h2>
          {safeReadinessChecks.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Shield className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Complete workflow steps to populate the readiness checklist.</p>
            </div>
          )}
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {safeReadinessChecks.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i < safeReadinessChecks.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''} hover:bg-gray-50 dark:bg-white/3 transition-colors`}>
                {item.pass
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-sm font-medium ${item.pass ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{item.check}</p>
                  {!item.pass && item.note && (
                    <p className="text-xs text-amber-500/80 mt-0.5">{item.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SAR sections */}
        <section>
          {safeSarSections.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Generate regulatory documents to see section status.</p>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Study Analysis Report (SAR) — Section Status</h2>
            <span className="text-[10px] text-gray-500">{completeSections} / {safeSarSections.length} complete</span>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {safeSarSections.map((sec, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < safeSarSections.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''} hover:bg-gray-50 dark:bg-white/3 transition-colors`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-600 w-4">{i + 1}</span>
                  <p className={`text-sm ${sec.status === 'complete' ? 'text-white' : sec.status === 'review' ? 'text-amber-300' : 'text-gray-600'}`}>
                    {sec.label}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {sec.words > 0 && <span className="text-[10px] text-gray-600 font-mono">{sec.words.toLocaleString()} words</span>}
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor[sec.status]}`}>
                    {sec.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SAR Generate */}
        <section>
          <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Generate Study Analysis Report</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Assembles all completed sections, figures, tables, and appendices into a structured SAR document.
                </p>
              </div>
              {generated && <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold"><CheckCircle2 className="h-3.5 w-3.5" /> Generated</span>}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-sm font-bold py-3 rounded-lg transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Assembling SAR… ({completeSections} sections · {safeSarSections.reduce((a, s) => a + s.words, 0).toLocaleString()} words)
                </>
              ) : generated ? (
                <><CheckCircle2 className="h-4 w-4" /> Regenerate SAR</>
              ) : (
                <><FileOutput className="h-4 w-4" /> Generate SAR</>
              )}
            </button>
          </div>
        </section>

        {/* SAP Generate */}
        <section>
          <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Generate Statistical Analysis Plan</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generates a structured SAP document (.docx) based on the study protocol, estimand framework, and pre-specified analyses.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateSAP}
              disabled={sapGenerating}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-bold py-3 rounded-lg transition-colors"
            >
              {sapGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating SAP...
                </>
              ) : (
                <><FileText className="h-4 w-4" /> Generate SAP</>
              )}
            </button>
          </div>
        </section>

        {/* TFL Preview */}
        <section>
          <h2 className="text-sm font-bold text-white mb-3">Tables, Figures & Listings (TFL)</h2>
          <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {/* TFL Tabs */}
            <div className="flex gap-1 p-3 border-b border-gray-200 dark:border-white/8 overflow-x-auto">
              {TFL_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTflTab(tab.key); setTflResult(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTflTab === tab.key
                      ? 'bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60a5fa] border border-[#2563EB]/30'
                      : 'text-gray-500 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/5'
                  }`}
                >
                  {tab.type === 'table' ? <BarChart3 className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TFL Content */}
            <div className="p-5">
              <button
                onClick={() => handleGenerateTfl(activeTflTab)}
                disabled={tflLoading}
                className="flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-sm font-bold py-2.5 px-6 rounded-lg transition-colors mb-4"
              >
                {tflLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <>Generate {TFL_TABS.find(t => t.key === activeTflTab)?.label}</>
                )}
              </button>

              {/* Render TFL result */}
              {tflResult && (
                <div className="mt-4">
                  {/* Table results — render HTML */}
                  {tflResult?.html && (
                    <div
                      className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-lg p-4 overflow-x-auto text-sm text-gray-600 dark:text-gray-300 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-200 dark:border-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-gray-100 dark:bg-white/5 [&_th]:text-xs [&_th]:font-bold [&_td]:border [&_td]:border-gray-200 dark:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_td]:text-xs"
                      dangerouslySetInnerHTML={{ __html: tflResult.html }}
                    />
                  )}
                  {/* Figure results — render base64 PNG */}
                  {tflResult?.png_base64 && (
                    <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-lg p-4 flex justify-center">
                      <img
                        src={`data:image/png;base64,${tflResult.png_base64}`}
                        alt="Generated figure"
                        className="w-full max-w-4xl"
                      />
                    </div>
                  )}
                  {/* Fallback for JSON/message results */}
                  {!tflResult?.html && !tflResult?.png_base64 && tflResult?.message && (
                    <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-lg p-4 text-xs text-gray-500 dark:text-gray-400">
                      {tflResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Export */}
        <section>
          <h2 className="text-sm font-bold text-white mb-3">Export Package</h2>
          <div className="space-y-2">
            {EXPORT_FORMATS.map((fmt, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${fmt.available ? 'bg-gray-50 dark:bg-white/3 border-gray-200 dark:border-white/8' : 'bg-white/1 border-white/4 opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className={`text-sm font-medium ${fmt.available ? 'text-white' : 'text-gray-600'}`}>{fmt.format}</p>
                    <p className="text-[10px] text-gray-600">{fmt.size}</p>
                  </div>
                </div>
                {fmt.available ? (
                  <button
                    disabled={!generated}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] font-semibold hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-600 font-medium">Requires eCTD add-on</span>
                )}
              </div>
            ))}
          </div>
          {!generated && (
            <p className="text-[10px] text-gray-600 mt-2">Generate the SAR above to enable downloads.</p>
          )}
        </section>

        {/* Submission Package */}
        <section>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <div className="bg-[#1e293b] px-5 py-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
              <h2 className="text-sm font-bold text-white">Submission Package</h2>
              <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">Phase 3 — eCTD, Define-XML, ADRG, CSR</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-white/5">
              {submissionDocs.map((doc) => (
                <div key={doc.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:bg-white/3 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-white">{doc.label}</p>
                      <p className="text-[10px] text-gray-600 uppercase">{doc.format}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {submissionResults[doc.key] && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mr-2">
                        <CheckCircle2 className="h-3 w-3" /> Generated
                      </span>
                    )}
                    {submissionResults[doc.key] && doc.format === 'docx' && submissionResults[doc.key]?.id && (
                      <button
                        onClick={async () => {
                          const blob = await apiClient.downloadArtifact(selectedStudy?.id, submissionResults[doc.key].id)
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${doc.key}.docx`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                        className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] font-semibold hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20"
                      >
                        <Download className="h-3 w-3" /> Download
                      </button>
                    )}
                    {submissionResults[doc.key] && doc.format !== 'docx' && (
                      <button
                        onClick={() => setSubmissionPreview({ key: doc.key, data: submissionResults[doc.key] })}
                        className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] font-semibold hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateSubmissionDoc(doc.key, doc.endpoint, doc.format)}
                      disabled={submissionLoading[doc.key]}
                      className="flex items-center gap-1.5 text-xs text-white font-semibold bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 px-4 py-1.5 rounded-lg transition-colors"
                    >
                      {submissionLoading[doc.key] ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                      ) : submissionResults[doc.key] ? (
                        'Regenerate'
                      ) : (
                        'Generate'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview panel for JSON/XML results */}
          {submissionPreview && (
            <div className="mt-4 bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-white/3">
                <span className="text-xs font-bold text-white">
                  Preview: {submissionDocs.find(d => d.key === submissionPreview.key)?.label}
                </span>
                <button
                  onClick={() => setSubmissionPreview(null)}
                  className="text-xs text-gray-500 hover:text-gray-600 dark:text-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
              <pre className="p-4 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto max-h-96 overflow-y-auto font-mono">
                {JSON.stringify(submissionPreview.data, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Compliance footer */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl">
          <Shield className="h-4 w-4 text-gray-500 shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            All exported documents are accompanied by a cryptographic integrity manifest (SHA-256). The audit trail, protocol lock timestamp, and analyst e-signatures meet FDA 21 CFR Part 11 and ICH E6(R3) requirements for electronic records in regulatory submissions.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <Link to={`/projects/${selectedStudy.id}/audit`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 9: Audit Trail
          </Link>
          <div className="text-right">
            <p className="text-[10px] text-gray-600">End of 10-step workflow</p>
            <p className="text-[10px] text-gray-700">{selectedStudy.protocol} · {selectedStudy.indication}</p>
          </div>
        </div>

      </div>
    </div>
  )
}
