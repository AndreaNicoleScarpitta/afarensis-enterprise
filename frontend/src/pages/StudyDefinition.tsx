import { useState, useEffect, useRef, useMemo } from 'react'
import { FlaskConical, Lock, Eye, ChevronRight, AlertCircle, CheckCircle2, Info, FileText, GitCompare, Calculator, Loader2, Brain, Upload, X, Plus, Cpu, ShieldCheck, ShieldAlert, ChevronDown, Lightbulb, AlertTriangle, XCircle, CircleDot } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'
import ShowYourWork from '@/components/ui/ShowYourWork'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'

// ─── Centralized Regulatory Configuration ──────────────────────────────────────
import {
  ENDPOINT_LIBRARY,
  ANALYSIS_METHODS,
  WEIGHTING_METHODS,
  VARIANCE_ESTIMATORS,
  TRIMMING_OPTIONS,
  COMPARATOR_TYPES,
  ESTIMAND_OPTIONS,
  ICE_STRATEGY_OPTIONS,
  ICE_EVENT_PRESETS,
  MISSING_DATA_PRIMARY,
  MISSING_DATA_SENSITIVITY,
  REGULATORY_AGENCIES,
  STUDY_PHASES,
  SCIENTIFIC_RATIONALE_MAX_CHARS,
  classifyEndpoint,
  getEstimandWarning,
  getMethodWarning,
} from '../types/regulatoryConfig'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ─── Derived: flat endpoint option list for dropdowns ──────────────────────────
const ENDPOINT_OPTIONS = [...ENDPOINT_LIBRARY.map(e => e.label), 'Custom endpoint']
const COMPARATOR_OPTIONS = COMPARATOR_TYPES.map(c => c.label)

// ─── Component ─────────────────────────────────────────────────────────────────
export default function StudyDefinition({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: studyDef, loading, error, saving, save, refetch } = useStudyData(selectedStudy?.id, 'definition')
  const staleness = useStalenessCheck(selectedStudy?.id, 'definition')

  // ── Core study definition fields (empty defaults for new studies) ──
  const [endpoint, setEndpoint] = useState('')
  const [customEndpoint, setCustomEndpoint] = useState('')
  const [secondaryEndpoints, setSecondaryEndpoints] = useState<string[]>([])
  const [newSecondary, setNewSecondary] = useState('')
  const [estimand, setEstimand] = useState(selectedStudy.estimand || '')
  const [phase, setPhase] = useState('')
  const [regBody, setRegBody] = useState('')
  const [comparator, setComparator] = useState('')
  const [indication, setIndication] = useState(selectedStudy.indication || '')
  const [rationale, setRationale] = useState('')

  // ── SAP specification fields (empty defaults) ──
  const [primaryModel, setPrimaryModel] = useState('')
  const [weightingMethod, setWeightingMethod] = useState('')
  const [varianceEstimator, setVarianceEstimator] = useState('')
  const [psTrimming, setPsTrimming] = useState('')
  const [covariates, setCovariates] = useState<string[]>([])
  const [newCovariate, setNewCovariate] = useState('')
  const [iceStrategies, setIceStrategies] = useState<{ event: string; strategy: string; desc: string }[]>([])
  const [newIceEvent, setNewIceEvent] = useState('')
  const [newIceStrategy, setNewIceStrategy] = useState('')
  const [missingDataPrimary, setMissingDataPrimary] = useState('')
  const [missingDataSensitivity, setMissingDataSensitivity] = useState('')
  const [missingThreshold, setMissingThreshold] = useState('5')

  // ── UI state ──
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showImpactDialog, setShowImpactDialog] = useState(false)
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('definition')
  const [showWorkOpen, setShowWorkOpen] = useState(false)
  const [activeSpecTab, setActiveSpecTab] = useState<'spec' | 'model' | 'diff'>('spec')

  // ── Compiler state ──
  const [compilerResult, setCompilerResult] = useState<any>(null)
  const [compiling, setCompiling] = useState(false)
  const [compilerOpen, setCompilerOpen] = useState(false)

  // ── Document upload state ──
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [prefillResult, setPrefillResult] = useState<Record<string, any> | null>(null)
  const [prefillAccepted, setPrefillAccepted] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Derived SAP values ──
  const effectiveEndpoint = endpoint === 'Custom endpoint' && customEndpoint.trim() ? customEndpoint.trim() : endpoint
  const endpointType = useMemo(() => classifyEndpoint(effectiveEndpoint), [effectiveEndpoint])
  const validMethods = useMemo(() => ANALYSIS_METHODS[endpointType] || [], [endpointType])
  const estimandWarning = useMemo(() => getEstimandWarning(estimand, comparator), [estimand, comparator])
  const methodWarning = useMemo(() => getMethodWarning(primaryModel, weightingMethod, endpointType), [primaryModel, weightingMethod, endpointType])

  // When endpoint type changes, check if current method is still valid
  useEffect(() => {
    if (primaryModel && validMethods.length > 0 && !validMethods.find(m => m.value === primaryModel)) {
      setPrimaryModel('')
    }
  }, [endpointType])

  // ── Load saved data ──
  useEffect(() => {
    if (studyDef) {
      const savedEndpoint = studyDef.endpoint || ''
      if (!savedEndpoint || ENDPOINT_OPTIONS.includes(savedEndpoint)) {
        setEndpoint(savedEndpoint)
        setCustomEndpoint('')
      } else {
        setEndpoint('Custom endpoint')
        setCustomEndpoint(savedEndpoint)
      }
      setSecondaryEndpoints(studyDef.secondaryEndpoints || [])
      setEstimand(studyDef.estimand || selectedStudy.estimand || '')
      setPhase(studyDef.phase || '')
      setRegBody(studyDef.regBody || '')
      setComparator(studyDef.comparator || '')
      setIndication(studyDef.indication || selectedStudy.indication || '')
      setRationale(studyDef.rationale || '')
      // SAP fields
      setPrimaryModel(studyDef.primaryModel || '')
      setWeightingMethod(studyDef.weightingMethod || '')
      setVarianceEstimator(studyDef.varianceEstimator || '')
      setPsTrimming(studyDef.psTrimming || '')
      setCovariates(studyDef.covariates || [])
      setIceStrategies(studyDef.iceStrategies || [])
      setMissingDataPrimary(studyDef.missingDataPrimary || '')
      setMissingDataSensitivity(studyDef.missingDataSensitivity || '')
      setMissingThreshold(studyDef.missingThreshold || '5')
    }
  }, [studyDef])

  // ── Save ──
  const confirmSave = async () => {
    try {
      await save({
        endpoint: effectiveEndpoint,
        secondaryEndpoints,
        estimand, phase, regBody, comparator, indication, rationale,
        // SAP fields
        primaryModel, weightingMethod, varianceEstimator, psTrimming,
        covariates, iceStrategies,
        missingDataPrimary, missingDataSensitivity, missingThreshold,
      })
      setShowImpactDialog(false)
      setSaveToast({ message: 'Definition saved successfully', type: 'success' })
      setTimeout(() => setSaveToast(null), 3000)
    } catch {
      setSaveToast({ message: 'Failed to save — please try again', type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
    }
  }

  const handleSave = () => {
    if ((directImpacts.length > 0 || transitiveImpacts.length > 0) && !protocolLocked) {
      setShowImpactDialog(true)
    } else {
      confirmSave()
    }
  }

  // ── Compiler ──
  const handleCompile = async () => {
    setCompiling(true)
    setCompilerResult(null)
    setCompilerOpen(true)
    try {
      const token = localStorage.getItem('_afarensis_token') || localStorage.getItem('access_token') || localStorage.getItem('auth_token') || 'dev-token'
      const resp = await fetch(`/api/v1/projects/${selectedStudy.id}/study/compile-definition`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!resp.ok) throw new Error('Compilation failed')
      const result = await resp.json()
      setCompilerResult(result)
    } catch {
      setCompilerResult({ verdict: 'ERROR', warnings: [], assumptions: [], missing_critical: ['Compiler service unavailable. Check API key configuration.'], completeness_score: 0 })
    } finally {
      setCompiling(false)
    }
  }

  // ── Document upload → prefill ──
  const handleDocumentUpload = async () => {
    if (!uploadFile) return
    setUploadLoading(true)
    setPrefillResult(null)
    setPrefillAccepted(new Set())
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const resp = await fetch(`/api/projects/${selectedStudy.id}/study/parse-document`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('afarensis_token') || 'dev-token'}`,
        },
      })
      if (!resp.ok) throw new Error('Failed to parse document')
      const result = await resp.json()
      setPrefillResult(result.extracted_fields || {})
    } catch (e: any) {
      setSaveToast({ message: `Document parsing failed: ${e.message}`, type: 'error' })
      setTimeout(() => setSaveToast(null), 5000)
    } finally {
      setUploadLoading(false)
    }
  }

  const applyPrefill = () => {
    if (!prefillResult) return
    if (prefillAccepted.has('indication') && prefillResult.indication) setIndication(prefillResult.indication)
    if (prefillAccepted.has('phase') && prefillResult.phase) setPhase(prefillResult.phase)
    if (prefillAccepted.has('regBody') && prefillResult.regBody) setRegBody(prefillResult.regBody)
    if (prefillAccepted.has('endpoint') && prefillResult.endpoint) {
      if (ENDPOINT_OPTIONS.includes(prefillResult.endpoint)) {
        setEndpoint(prefillResult.endpoint)
        setCustomEndpoint('')
      } else {
        setEndpoint('Custom endpoint')
        setCustomEndpoint(prefillResult.endpoint)
      }
    }
    if (prefillAccepted.has('estimand') && prefillResult.estimand) setEstimand(prefillResult.estimand)
    if (prefillAccepted.has('comparator') && prefillResult.comparator) setComparator(prefillResult.comparator)
    if (prefillAccepted.has('primaryModel') && prefillResult.primaryModel) setPrimaryModel(prefillResult.primaryModel)
    if (prefillAccepted.has('weightingMethod') && prefillResult.weightingMethod) setWeightingMethod(prefillResult.weightingMethod)
    if (prefillAccepted.has('covariates') && prefillResult.covariates?.length) setCovariates(prefillResult.covariates)
    if (prefillAccepted.has('rationale') && prefillResult.rationale) setRationale(prefillResult.rationale)
    setPrefillResult(null)
    setUploadFile(null)
    setSaveToast({ message: `Applied ${prefillAccepted.size} extracted field(s)`, type: 'success' })
    setTimeout(() => setSaveToast(null), 3000)
  }

  const locked = protocolLocked || studyDef?.protocol_locked
  const selectedEstimand = ESTIMAND_OPTIONS.find(e => e.value === estimand)

  // ── Field label mapping for prefill display ──
  const FIELD_LABELS: Record<string, string> = {
    indication: 'Indication',
    phase: 'Regulatory Phase',
    regBody: 'Target Regulatory Agency',
    endpoint: 'Primary Endpoint',
    estimand: 'Estimand',
    comparator: 'Comparator Arm',
    primaryModel: 'Primary Analysis Method',
    weightingMethod: 'Weighting Method',
    covariates: 'Pre-specified Covariates',
    rationale: 'Scientific Rationale',
  }

  // Helper for model/method label lookup
  const getMethodLabel = (val: string) => {
    for (const methods of Object.values(ANALYSIS_METHODS)) {
      const m = methods.find(m => m.value === val)
      if (m) return m.label
    }
    return val
  }
  const getWeightingLabel = (val: string) => WEIGHTING_METHODS.find(w => w.value === val)?.label || val
  const getVarianceLabel = (val: string) => VARIANCE_ESTIMATORS.find(v => v.value === val)?.label || val
  const getTrimmingLabel = (val: string) => TRIMMING_OPTIONS.find(t => t.value === val)?.label || val

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Page header ── */}
      <div className="border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 01</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900">Study Definition</h1>
              <p className="text-gray-500 text-xs mt-0.5">Protocol &middot; indication &middot; primary endpoint &middot; estimand &middot; SAP</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <LiteratureEvidence categories={['estimand', 'general']} stepLabel="Study Definition" />

      <StalenessBanner
        staleUpstreams={staleness.staleUpstreams}
        onAcknowledge={staleness.acknowledge}
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading study definition...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">Failed to load study definition</p>
            <p className="text-xs text-gray-500 mt-0.5">{error}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {/* ── Document Upload → Prefill (top of page) ── */}
        {!locked && !reviewerMode && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-gray-900">Upload Document to Prefill Study Definition</h3>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Optional</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Upload a protocol, SAP, or publication (PDF, DOCX, TXT). The system will extract fields it can confidently identify. You choose which extracted values to accept.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setUploadFile(f)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                {uploadFile ? uploadFile.name : 'Choose File...'}
              </button>
              {uploadFile && (
                <>
                  <button
                    onClick={handleDocumentUpload}
                    disabled={uploadLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {uploadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                    {uploadLoading ? 'Parsing...' : 'Extract Fields'}
                  </button>
                  <button onClick={() => { setUploadFile(null); setPrefillResult(null) }} className="text-gray-400 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* ── Prefill results (user picks which to accept) ── */}
            {prefillResult && Object.keys(prefillResult).length > 0 && (
              <div className="mt-4 border-t border-purple-200 pt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-700 mb-2">Extracted Fields — select which to apply:</p>
                {Object.entries(prefillResult).map(([key, value]) => {
                  if (!value || !FIELD_LABELS[key]) return null
                  const displayValue = Array.isArray(value) ? (value as string[]).join(', ') : String(value)
                  const isAccepted = prefillAccepted.has(key)
                  return (
                    <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isAccepted
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={isAccepted}
                        onChange={() => {
                          const next = new Set(prefillAccepted)
                          if (isAccepted) next.delete(key)
                          else next.add(key)
                          setPrefillAccepted(next)
                        }}
                        className="mt-0.5 accent-purple-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-600">{FIELD_LABELS[key]}</p>
                        <p className="text-sm text-gray-900 truncate">{displayValue}</p>
                      </div>
                    </label>
                  )
                })}
                {Object.keys(prefillResult).filter(k => FIELD_LABELS[k] && prefillResult[k]).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No fields could be confidently extracted from this document.</p>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const all = new Set(Object.keys(prefillResult).filter(k => FIELD_LABELS[k] && prefillResult[k]))
                      setPrefillAccepted(all)
                    }}
                    className="text-xs text-purple-600 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setPrefillAccepted(new Set())}
                    className="text-xs text-gray-400 hover:underline font-medium"
                  >
                    Clear
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={applyPrefill}
                    disabled={prefillAccepted.size === 0}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Apply {prefillAccepted.size} Field{prefillAccepted.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
            {prefillResult && Object.keys(prefillResult).length === 0 && (
              <p className="mt-3 text-xs text-amber-600">No fields could be confidently extracted. You may fill in all fields manually below.</p>
            )}
          </div>
        )}

        {/* Reviewer banner */}
        {reviewerMode && (
          <div className="flex items-start gap-3 p-4 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl">
            <Eye className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#2563EB]">FDA Reviewer Mode Active</p>
              <p className="text-xs text-gray-500 mt-0.5">Displaying pre-specified protocol elements only. All editable fields are hidden. Rationale and justifications are foregrounded.</p>
            </div>
          </div>
        )}

        {/* Protocol summary card */}
        <div className="bg-gray-100/80 border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Protocol Summary</h2>
            {locked
              ? <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2.5 py-1 rounded-full font-bold"><CheckCircle2 className="h-3 w-3" /> Pre-specified & Locked</span>
              : <span className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-900/20 border border-amber-700/30 px-2.5 py-1 rounded-full font-bold"><AlertCircle className="h-3 w-3" /> Draft — Not Yet Locked</span>
            }
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Protocol', value: selectedStudy.protocol },
              { label: 'Status', value: selectedStudy.status },
              { label: 'Regulatory Phase', value: phase || '—' },
              { label: 'Target Agency', value: regBody || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Regulatory Phase & Target Agency (top-level controls) ── */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Regulatory Phase <span className="text-red-400">*</span>
            </label>
            {locked || reviewerMode ? (
              <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-medium">{phase || <span className="text-gray-400 italic">Not specified</span>}</div>
            ) : (
              <select
                className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={phase} onChange={e => setPhase(e.target.value)}
              >
                <option value="" className="bg-white">Select phase...</option>
                {STUDY_PHASES.map(p => <option key={p.value} value={p.value} className="bg-white">{p.label}</option>)}
              </select>
            )}
            {phase && !locked && !reviewerMode && (
              <p className="text-[10px] text-gray-400 mt-1">{STUDY_PHASES.find(p => p.value === phase)?.description}</p>
            )}
          </section>
          <section>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Target Regulatory Agency <span className="text-red-400">*</span>
            </label>
            {locked || reviewerMode ? (
              <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-medium">{regBody || <span className="text-gray-400 italic">Not specified</span>}</div>
            ) : (
              <select
                className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={regBody} onChange={e => setRegBody(e.target.value)}
              >
                <option value="" className="bg-white">Select agency...</option>
                {REGULATORY_AGENCIES.map(a => <option key={a.value} value={a.value} className="bg-white">{a.label}</option>)}
              </select>
            )}
            {regBody && !locked && !reviewerMode && (
              <p className="text-[10px] text-gray-400 mt-1">Guidelines: {REGULATORY_AGENCIES.find(a => a.value === regBody)?.guidelines}</p>
            )}
          </section>
        </div>

        {/* Indication */}
        <section>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Indication</label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-medium">{indication || <span className="text-gray-400 italic">Not specified</span>}</div>
          ) : (
            <input
              className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
              value={indication}
              onChange={e => setIndication(e.target.value)}
              placeholder="e.g. Type 2 Diabetes with cardiovascular risk"
            />
          )}
        </section>

        {/* Primary endpoint */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Primary Endpoint</label>
            {effectiveEndpoint && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-blue-50 border-blue-200 text-blue-600">
                {endpointType}
              </span>
            )}
          </div>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-medium">
              {effectiveEndpoint || <span className="text-gray-400 italic">Not specified</span>}
            </div>
          ) : (
            <>
              <select
                className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
              >
                <option value="" className="bg-white">Select primary endpoint...</option>
                {ENDPOINT_OPTIONS.map(o => <option key={o} value={o} className="bg-white">{o}</option>)}
              </select>
              {endpoint === 'Custom endpoint' && (
                <input
                  type="text"
                  className="w-full mt-2 bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                  value={customEndpoint}
                  onChange={e => setCustomEndpoint(e.target.value)}
                  placeholder="Enter your custom primary endpoint..."
                />
              )}
            </>
          )}
        </section>

        {/* Secondary endpoints */}
        <section>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Secondary Endpoints</label>
          {secondaryEndpoints.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {secondaryEndpoints.map((ep, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg">
                  {ep}
                  {!locked && !reviewerMode && (
                    <button
                      onClick={() => setSecondaryEndpoints(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-blue-400 hover:text-red-400 transition-colors ml-1"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!locked && !reviewerMode && (
            <div className="flex gap-2">
              <select
                className="flex-1 bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                value={newSecondary}
                onChange={e => setNewSecondary(e.target.value)}
              >
                <option value="">Add a secondary endpoint...</option>
                {ENDPOINT_OPTIONS.filter(o => o !== endpoint && o !== 'Custom endpoint' && !secondaryEndpoints.includes(o)).map(o => (
                  <option key={o} value={o} className="bg-white">{o}</option>
                ))}
                <option value="__custom__" className="bg-white">Custom endpoint...</option>
              </select>
              <button
                onClick={() => {
                  if (newSecondary === '__custom__') {
                    const custom = prompt('Enter custom secondary endpoint:')
                    if (custom?.trim()) setSecondaryEndpoints(prev => [...prev, custom.trim()])
                  } else if (newSecondary && !secondaryEndpoints.includes(newSecondary)) {
                    setSecondaryEndpoints(prev => [...prev, newSecondary])
                  }
                  setNewSecondary('')
                }}
                disabled={!newSecondary}
                className="px-4 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-lg hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          )}
          {secondaryEndpoints.length === 0 && (locked || reviewerMode) && (
            <div className="text-xs text-gray-400 italic">No secondary endpoints defined</div>
          )}
        </section>

        {/* Estimand */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estimand (ICH E9(R1))</label>
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
                    ? 'bg-[#2563EB]/15 border-[#2563EB]/40 text-gray-900'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                } ${locked || reviewerMode ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {estimand === opt.value && <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
          {estimandWarning && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{estimandWarning}</p>
            </div>
          )}
        </section>

        {/* Comparator arm */}
        <section>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Comparator Arm</label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 font-medium">{comparator || <span className="text-gray-400 italic">Not specified</span>}</div>
          ) : (
            <select
              className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
              value={comparator}
              onChange={e => setComparator(e.target.value)}
            >
              <option value="" className="bg-white">Select comparator...</option>
              {COMPARATOR_OPTIONS.map(o => <option key={o} value={o} className="bg-white">{o}</option>)}
            </select>
          )}
        </section>

        {/* Scientific rationale */}
        <section>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            Scientific Rationale for RWE Design
          </label>
          {locked || reviewerMode ? (
            <div className="bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {rationale || <span className="text-gray-400 italic">No rationale entered.</span>}
            </div>
          ) : (
            <>
              <textarea
                rows={5}
                maxLength={SCIENTIFIC_RATIONALE_MAX_CHARS}
                className="w-full bg-gray-100/80 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2563EB]/60 transition-colors resize-none"
                value={rationale}
                onChange={e => setRationale(e.target.value)}
                placeholder="Explain why RWE is appropriate, why RCT is infeasible or unethical, and how this design aligns with ICH E9(R1)..."
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-gray-400">Concise justification required. Reviewers evaluate clarity and specificity.</p>
                <span className={`text-[10px] font-medium ${rationale.length > SCIENTIFIC_RATIONALE_MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {rationale.length}/{SCIENTIFIC_RATIONALE_MAX_CHARS}
                </span>
              </div>
            </>
          )}
        </section>

        {/* ── Analysis Specification (SAP-style) ── */}
        <section className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Analysis Specification</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Pre-specified statistical analysis plan elements — versioned & locked</p>
            </div>
            {locked && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2.5 py-1 rounded-full font-bold">
                <CheckCircle2 className="h-3 w-3" /> SAP Locked
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
                    ? 'bg-[#2563EB]/15 text-[#2563EB] border border-[#2563EB]/30'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── Specification tab (EDITABLE) ── */}
          {activeSpecTab === 'spec' && (
            <div className="bg-gray-100/80 border border-gray-200 rounded-xl p-5 space-y-5">
              {/* Primary Model & Weighting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Primary Outcome Model</p>
                  {locked || reviewerMode ? (
                    <p className="text-sm font-semibold text-gray-900">{getMethodLabel(primaryModel) || '—'}</p>
                  ) : (
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                      value={primaryModel}
                      onChange={e => setPrimaryModel(e.target.value)}
                    >
                      <option value="">Select analysis method...</option>
                      {validMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  )}
                  {effectiveEndpoint && !locked && !reviewerMode && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Options filtered for <strong>{endpointType}</strong> endpoints
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Weighting Method</p>
                  {locked || reviewerMode ? (
                    <p className="text-sm font-semibold text-gray-900">{getWeightingLabel(weightingMethod) || '—'}</p>
                  ) : (
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                      value={weightingMethod}
                      onChange={e => setWeightingMethod(e.target.value)}
                    >
                      <option value="">Select weighting method...</option>
                      {WEIGHTING_METHODS.map(w => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Variance & Trimming */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Variance Estimator</p>
                  {locked || reviewerMode ? (
                    <p className="text-sm font-semibold text-gray-900">{getVarianceLabel(varianceEstimator) || '—'}</p>
                  ) : (
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                      value={varianceEstimator}
                      onChange={e => setVarianceEstimator(e.target.value)}
                    >
                      <option value="">Select variance estimator...</option>
                      {VARIANCE_ESTIMATORS.map(v => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">PS Trimming</p>
                  {locked || reviewerMode ? (
                    <p className="text-sm font-semibold text-gray-900">{getTrimmingLabel(psTrimming) || '—'}</p>
                  ) : (
                    <select
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                      value={psTrimming}
                      onChange={e => setPsTrimming(e.target.value)}
                    >
                      <option value="">Select trimming approach...</option>
                      {TRIMMING_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Method warning */}
              {methodWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{methodWarning}</p>
                </div>
              )}

              {/* Covariates */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Pre-specified Covariates</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {covariates.length === 0 && (locked || reviewerMode) && (
                    <span className="text-xs text-gray-400 italic">No covariates specified</span>
                  )}
                  {covariates.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-gray-200/80 border border-gray-300 px-2 py-0.5 rounded text-gray-700">
                      {c}
                      {!locked && !reviewerMode && (
                        <button onClick={() => setCovariates(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-400 ml-0.5">&times;</button>
                      )}
                    </span>
                  ))}
                </div>
                {!locked && !reviewerMode && (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                      value={newCovariate}
                      onChange={e => setNewCovariate(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newCovariate.trim()) {
                          setCovariates(prev => [...prev, newCovariate.trim()])
                          setNewCovariate('')
                        }
                      }}
                      placeholder="Add covariate (e.g. Age, Sex, CCI)..."
                    />
                    <button
                      onClick={() => {
                        if (newCovariate.trim()) {
                          setCovariates(prev => [...prev, newCovariate.trim()])
                          setNewCovariate('')
                        }
                      }}
                      disabled={!newCovariate.trim()}
                      className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-medium rounded-lg hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Intercurrent Event Strategies */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Intercurrent Event Strategies (ICH E9(R1))</p>
                <div className="space-y-1.5 mb-2">
                  {iceStrategies.length === 0 && (locked || reviewerMode) && (
                    <span className="text-xs text-gray-400 italic">No ICE strategies specified</span>
                  )}
                  {iceStrategies.map((ice, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-gray-200/50 rounded-lg px-3 py-2">
                      <span className="text-gray-900 font-medium w-40 shrink-0">{ice.event}</span>
                      <span className="text-[#2563EB] font-semibold w-28 shrink-0">{ice.strategy}</span>
                      <span className="text-gray-500 flex-1">{ice.desc}</span>
                      {!locked && !reviewerMode && (
                        <button onClick={() => setIceStrategies(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-400 shrink-0">&times;</button>
                      )}
                    </div>
                  ))}
                </div>
                {!locked && !reviewerMode && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                        value={newIceEvent}
                        onChange={e => setNewIceEvent(e.target.value)}
                      >
                        <option value="">Select intercurrent event...</option>
                        {ICE_EVENT_PRESETS.filter(e => !iceStrategies.find(s => s.event === e)).map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                        <option value="__custom__">Custom event...</option>
                      </select>
                    </div>
                    <div className="w-44">
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                        value={newIceStrategy}
                        onChange={e => setNewIceStrategy(e.target.value)}
                      >
                        <option value="">Strategy...</option>
                        {ICE_STRATEGY_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        let eventName = newIceEvent
                        if (eventName === '__custom__') {
                          const custom = prompt('Enter intercurrent event:')
                          if (!custom?.trim()) return
                          eventName = custom.trim()
                        }
                        if (!eventName || !newIceStrategy) return
                        const strat = ICE_STRATEGY_OPTIONS.find(s => s.value === newIceStrategy)
                        setIceStrategies(prev => [...prev, {
                          event: eventName,
                          strategy: strat?.label || newIceStrategy,
                          desc: strat?.desc || '',
                        }])
                        setNewIceEvent('')
                        setNewIceStrategy('')
                      }}
                      disabled={!newIceEvent || !newIceStrategy}
                      className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-medium rounded-lg hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Missing Data Handling */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Missing Data Handling</p>
                {locked || reviewerMode ? (
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><strong className="text-gray-900">Primary:</strong> {MISSING_DATA_PRIMARY.find(m => m.value === missingDataPrimary)?.label || missingDataPrimary || '—'}{missingThreshold ? ` (threshold: <${missingThreshold}% per covariate)` : ''}</p>
                    <p><strong className="text-gray-900">Sensitivity:</strong> {MISSING_DATA_SENSITIVITY.find(m => m.value === missingDataSensitivity)?.label || missingDataSensitivity || '—'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Primary Method</p>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                        value={missingDataPrimary}
                        onChange={e => setMissingDataPrimary(e.target.value)}
                      >
                        <option value="">Select method...</option>
                        {MISSING_DATA_PRIMARY.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Sensitivity Analysis</p>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                        value={missingDataSensitivity}
                        onChange={e => setMissingDataSensitivity(e.target.value)}
                      >
                        <option value="">Select method...</option>
                        {MISSING_DATA_SENSITIVITY.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Missingness Threshold (%)</p>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-24 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                        value={missingThreshold}
                        onChange={e => setMissingThreshold(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Model Card tab (derived from spec + study def) ── */}
          {activeSpecTab === 'model' && (
            <div className="bg-gray-100/80 border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Model Card — Primary Analysis</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-amber-600 bg-amber-900/10 border-amber-600/30">
                    {primaryModel ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
                <button
                  onClick={() => setShowWorkOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] text-[#2563EB] hover:text-blue-300 font-semibold transition-colors"
                >
                  <FlaskConical className="h-3 w-3" /> Full Lineage
                </button>
              </div>
              {!primaryModel && (
                <p className="text-xs text-amber-600">
                  Configure the Specification tab to populate this model card.
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                {[
                  ['Model Type', getMethodLabel(primaryModel) || '—'],
                  ['Estimand', estimand ? `${estimand} — ${selectedEstimand?.desc || ''}` : '—'],
                  ['Outcome', effectiveEndpoint || '—'],
                  ['Endpoint Type', effectiveEndpoint ? endpointType : '—'],
                  ['Population', indication || '—'],
                  ['Weighting', getWeightingLabel(weightingMethod) || '—'],
                  ['Trimming', getTrimmingLabel(psTrimming) || '—'],
                  ['Variance', getVarianceLabel(varianceEstimator) || '—'],
                  ['Covariates', covariates.length > 0 ? `${covariates.length} covariates` : '—'],
                  ['Missing Data', MISSING_DATA_PRIMARY.find(m => m.value === missingDataPrimary)?.label || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500 font-semibold">{label}</p>
                    <p className="text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {covariates.length > 0 && (
                <div className="border-t border-gray-300 pt-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Covariate Set</p>
                  <div className="flex flex-wrap gap-1.5">
                    {covariates.map(c => (
                      <span key={c} className="text-[10px] bg-gray-200/80 border border-gray-300 px-2 py-0.5 rounded text-gray-700">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {primaryModel && covariates.length > 0 && (
                <div className="border-t border-gray-300 pt-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Formula (Statistical Notation)</p>
                  <div className="bg-gray-200/60 rounded-lg px-4 py-3 font-mono text-xs text-gray-700 overflow-x-auto">
                    {(() => {
                      const terms = covariates.map((c, i) => `\u03B2${String.fromCharCode(0x2081 + i)}\u00B7${c.replace(/\s+/g, '')}`)
                      const termsOffset = covariates.map((c, i) => `\u03B2${String.fromCharCode(0x2082 + i)}\u00B7${c.replace(/\s+/g, '')}`)
                      if (primaryModel === 'cox_ph' || primaryModel === 'fine_gray')
                        return `h(t|X) = h\u2080(t) \u00B7 exp(${terms.join(' + ')})`
                      if (primaryModel === 'logistic')
                        return `logit(P(Y=1|X)) = \u03B2\u2080 + ${terms.join(' + ')}`
                      if (primaryModel === 'ancova' || primaryModel === 'mmrm' || primaryModel === 'lmm')
                        return `E[Y|X] = \u03B2\u2080 + \u03B2\u2081\u00B7Treatment + ${termsOffset.join(' + ')}`
                      if (primaryModel === 'neg_binom' || primaryModel === 'poisson')
                        return `log(E[Y|X]) = \u03B2\u2080 + \u03B2\u2081\u00B7Treatment + ${termsOffset.join(' + ')} + log(t)`
                      return `f(Y|X) = g(\u03B2\u2080 + ${terms.join(' + ')})`
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Spec vs Execution diff tab ── */}
          {activeSpecTab === 'diff' && (
            <div className="bg-gray-100/80 border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Specification vs. Execution Comparison</h3>
              </div>
              <p className="text-[10px] text-gray-500 mb-3">Automated comparison of pre-specified SAP parameters against actual execution metadata. Any deviation is flagged for review.</p>
              {!studyDef?.executionResults ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <GitCompare className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No Execution Data</p>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-xs">
                    This comparison will populate automatically once the analysis pipeline runs against real uploaded data. Specification parameters are locked on the left; execution metadata appears on the right.
                  </p>
                </div>
              ) : null}
              {studyDef?.executionResults && (() => {
                const specRows = [
                  { param: 'Primary Model', specified: getMethodLabel(primaryModel) || '—', executed: studyDef?.executionResults?.primaryModel || 'Not yet executed' },
                  { param: 'Weighting Method', specified: getWeightingLabel(weightingMethod) || '—', executed: studyDef?.executionResults?.weightingMethod || 'Not yet executed' },
                  { param: 'Covariate Set', specified: covariates.length > 0 ? `${covariates.length} covariates` : '—', executed: studyDef?.executionResults?.covariateCount ? `${studyDef.executionResults.covariateCount} covariates` : 'Not yet executed' },
                  { param: 'Variance Estimator', specified: getVarianceLabel(varianceEstimator) || '—', executed: studyDef?.executionResults?.varianceEstimator || 'Not yet executed' },
                  { param: 'PS Trimming', specified: getTrimmingLabel(psTrimming) || '—', executed: studyDef?.executionResults?.psTrimming || 'Not yet executed' },
                ]
                const executed = specRows.filter(r => r.executed !== 'Not yet executed')
                const matches = executed.filter(r => r.specified === r.executed || r.specified === '—')
                return (
                  <>
                    {executed.length > 0 && (
                      <div className="text-right mb-2">
                        <span className={`text-[10px] font-bold ${matches.length === executed.length ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {matches.length}/{executed.length} Consistent
                        </span>
                      </div>
                    )}
                    {specRows.map((row, i) => {
                      const isExecuted = row.executed !== 'Not yet executed'
                      const isMatch = !isExecuted || row.specified === row.executed || row.specified === '—'
                      return (
                        <div key={i} className="grid grid-cols-4 gap-3 items-center text-xs bg-gray-200/50 rounded-lg px-4 py-2.5">
                          <span className="text-gray-900 font-medium">{row.param}</span>
                          <span className="text-gray-500">{row.specified}</span>
                          <span className={`${isExecuted ? 'text-gray-500' : 'text-gray-400 italic'}`}>{row.executed}</span>
                          <span className="flex items-center gap-1">
                            {!isExecuted ? (
                              <span className="text-gray-400 text-[10px]">Pending</span>
                            ) : isMatch ? (
                              <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400 font-semibold">Match</span></>
                            ) : (
                              <><AlertCircle className="h-3 w-3 text-red-400" /><span className="text-red-400 font-semibold">Deviation</span></>
                            )}
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-3 mt-2 pt-3 border-t border-gray-300">
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Column Key:</div>
                      <div className="flex gap-4 text-[10px] text-gray-500">
                        <span>Parameter</span>
                        <span>SAP Specification</span>
                        <span>Execution Record</span>
                        <span>Status</span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </section>

        {/* Save + Compile buttons */}
        {!locked && !reviewerMode && (
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCompile}
              disabled={compiling}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
              {compiling ? 'Compiling...' : 'Compile Definition'}
            </button>
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

        {/* ── Compiler Output Panel ── */}
        {compilerOpen && (
          <section className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setCompilerOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  !compilerResult ? 'bg-gray-200' :
                  compilerResult.verdict === 'PASS' ? 'bg-emerald-100' :
                  compilerResult.verdict === 'WARN' ? 'bg-amber-100' :
                  'bg-red-100'
                }`}>
                  {compiling ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> :
                   !compilerResult ? <Cpu className="h-4 w-4 text-gray-400" /> :
                   compilerResult.verdict === 'PASS' ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> :
                   compilerResult.verdict === 'WARN' ? <ShieldAlert className="h-4 w-4 text-amber-600" /> :
                   <XCircle className="h-4 w-4 text-red-600" />}
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-gray-900">Study Definition Compiler</h3>
                  <p className="text-[10px] text-gray-500">
                    {compiling ? 'Analyzing definition...' :
                     compilerResult ? `Verdict: ${compilerResult.verdict} — ${Math.round((compilerResult.completeness_score || 0) * 100)}% complete` :
                     'Ready'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {compilerResult && !compiling && (
                  <div className="flex items-center gap-1.5">
                    {compilerResult.warnings?.filter((w: any) => w.severity === 'error').length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                        {compilerResult.warnings.filter((w: any) => w.severity === 'error').length} errors
                      </span>
                    )}
                    {compilerResult.warnings?.filter((w: any) => w.severity === 'warning').length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                        {compilerResult.warnings.filter((w: any) => w.severity === 'warning').length} warnings
                      </span>
                    )}
                    {compilerResult.assumptions?.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                        {compilerResult.assumptions.length} inferred
                      </span>
                    )}
                  </div>
                )}
                <X className="h-4 w-4 text-gray-400" onClick={(e) => { e.stopPropagation(); setCompilerOpen(false) }} />
              </div>
            </button>

            {/* Body */}
            {compilerResult && !compiling && (
              <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

                {/* Missing Critical */}
                {compilerResult.missing_critical?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-1.5">
                      <XCircle className="h-3 w-3" /> Blocking Issues
                    </p>
                    {compilerResult.missing_critical.map((msg: string, i: number) => (
                      <div key={i} className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-xs text-red-800">{msg}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation Warnings */}
                {compilerResult.warnings?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Validation Findings ({compilerResult.warnings.length})
                    </p>
                    {compilerResult.warnings.map((w: any, i: number) => (
                      <div key={i} className={`rounded-md border px-3 py-2.5 ${
                        w.severity === 'error' ? 'border-red-200 bg-red-50' :
                        w.severity === 'warning' ? 'border-amber-200 bg-amber-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {w.severity === 'error' ? <XCircle className="h-3 w-3 text-red-500 shrink-0" /> :
                           w.severity === 'warning' ? <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" /> :
                           <Info className="h-3 w-3 text-blue-500 shrink-0" />}
                          <span className={`text-[10px] font-bold uppercase ${
                            w.severity === 'error' ? 'text-red-600' : w.severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
                          }`}>{w.category?.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-gray-400 ml-auto font-mono">{w.field}</span>
                        </div>
                        <p className="text-xs text-gray-800 mb-1">{w.message}</p>
                        <p className="text-[11px] text-gray-500 flex items-start gap-1">
                          <Lightbulb className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                          {w.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assumptions */}
                {compilerResult.assumptions?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <CircleDot className="h-3 w-3" /> Compiler Assumptions ({compilerResult.assumptions.length})
                    </p>
                    {compilerResult.assumptions.map((a: any, i: number) => (
                      <div key={i} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-blue-600">{a.field}</span>
                          <span className="text-[10px] text-gray-400">=</span>
                          <span className="text-[10px] font-semibold text-gray-900">{a.assumed_value}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{a.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Compiled definition preview (collapsed) */}
                {compilerResult.compiled_definition && (
                  <details className="group">
                    <summary className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                      Compiled Schema Output
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-[10px] rounded-lg overflow-x-auto font-mono leading-relaxed max-h-[30vh] overflow-y-auto">
                      {JSON.stringify(compilerResult.compiled_definition, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Loading state */}
            {compiling && (
              <div className="px-5 py-8 flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <p className="text-xs text-gray-500">Compiling study definition...</p>
                <p className="text-[10px] text-gray-400">Enforcing ICH E9(R1) consistency, filling gaps, validating schema</p>
              </div>
            )}
          </section>
        )}

        {/* Next step CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            {locked ? 'Protocol locked — proceed to causal framework definition.' : 'Complete all fields before locking the protocol.'}
          </div>
          <a
            href={`/projects/${selectedStudy.id}/causal-framework`}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Step 2: Causal Framework <ChevronRight className="h-4 w-4" />
          </a>
        </div>

      </div>

      <ShowYourWork
        isOpen={showWorkOpen}
        onClose={() => setShowWorkOpen(false)}
        resultId="run-001"
        resultLabel="Primary Analysis"
        resultType="estimate"
      />

      <DownstreamImpactDialog
        open={showImpactDialog}
        onClose={() => setShowImpactDialog(false)}
        onConfirm={confirmSave}
        saving={saving}
        currentStepLabel="Study Definition"
        directImpacts={directImpacts}
        transitiveImpacts={transitiveImpacts}
      />

      {/* Save confirmation toast */}
      {saveToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          saveToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {saveToast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />
          }
          {saveToast.message}
          <button onClick={() => setSaveToast(null)} className="ml-2 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}
    </div>
  )
}
