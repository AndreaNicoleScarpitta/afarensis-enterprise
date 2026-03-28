import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Database, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Clock,
  Loader2, Upload, FileUp, XCircle, AlertTriangle, Activity, Shield, FileText, Trash2,
  RefreshCw, GitBranch, BarChart2, Info, ArrowRight, Hash, Layers, ListChecks,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import { apiClient } from '../services/apiClient'
import ValidationGatePanel from '@/components/ui/ValidationGatePanel'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'
import {
  type ArtifactState,
  resolveArtifactState,
  getArtifactExplanation,
  getStateBadgeClasses,
} from '../types/provenanceEngine'
import {
  logStateTransition,
  logDerivation,
  logUpload,
} from '../services/provenanceLogger'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── SDTM requiredness config ──────────────────────────────────────────────────
const SDTM_REQUIREDNESS: Record<string, { required: boolean; reason: string; dependencies: string[] }> = {
  dm: {
    required: true,
    reason: 'Required for subject-level demographic variables used in population definition and adjustment.',
    dependencies: ['Source demographic data'],
  },
  ae: {
    required: true,
    reason: 'Required for adverse event documentation and safety evaluation.',
    dependencies: ['Source adverse event records'],
  },
  lb: {
    required: false,
    reason: 'Required only if laboratory-based endpoints or biomarker covariates are defined.',
    dependencies: ['Source laboratory records'],
  },
  vs: {
    required: false,
    reason: 'Required only if vital sign measurements are covariates or endpoints.',
    dependencies: ['Source vital sign records'],
  },
  ex: {
    required: true,
    reason: 'Required for treatment exposure timing and dose derivation.',
    dependencies: ['Source prescription/administration records'],
  },
  ds: {
    required: true,
    reason: 'Required for disposition events used in population flag derivation (e.g., analysis population assignment).',
    dependencies: ['Source enrollment/discontinuation records'],
  },
}

// ── ADaM dataset specs ────────────────────────────────────────────────────────
const ADAM_SPECS: Record<string, {
  name: string
  label: string
  purpose: string
  sdtmDeps: string[]
  studyDeps: string[]
}> = {
  adsl: {
    name: 'ADSL',
    label: 'Subject-Level Analysis Dataset',
    purpose: 'Derived from DM, EX, and DS. Supports population definition and analysis cohort flags.',
    sdtmDeps: ['dm', 'ex', 'ds'],
    studyDeps: ['Population rules', 'Inclusion/exclusion criteria'],
  },
  adae: {
    name: 'ADAE',
    label: 'Adverse Event Analysis Dataset',
    purpose: 'Derived from AE domain joined with ADSL. Supports safety analyses and adverse event characterization.',
    sdtmDeps: ['ae'],
    studyDeps: ['ADSL derivation', 'Safety endpoint definitions'],
  },
  adtte: {
    name: 'ADTTE',
    label: 'Time-to-Event Analysis Dataset',
    purpose: 'Derived from ADSL, endpoint definitions, and censoring logic. Supports survival and time-to-event analyses.',
    sdtmDeps: ['dm', 'ex'],
    studyDeps: ['ADSL derivation', 'Primary endpoint definition', 'Censoring rules'],
  },
}

// ── Coverage status type ──────────────────────────────────────────────────────
type CoverageStatus = 'Present' | 'Partial' | 'Missing' | 'Not Required'

interface CoverageRow {
  category: string
  requiredBy: string
  status: CoverageStatus
  source: string
  notes: string
}

const DEFAULT_COVERAGE_MATRIX: CoverageRow[] = [
  { category: 'Demographic Variables', requiredBy: 'Population Definition', status: 'Present', source: '—', notes: 'age, sex, race' },
  { category: 'Exposure Variables', requiredBy: 'Treatment Assignment', status: 'Present', source: '—', notes: 'drug, dose, dates' },
  { category: 'Endpoint Variables', requiredBy: 'Study Definition', status: 'Partial', source: '—', notes: 'event dates, outcomes' },
  { category: 'Covariate Variables', requiredBy: 'Causal Framework', status: 'Missing', source: '—', notes: 'from DAG specification' },
  { category: 'Disposition Variables', requiredBy: 'Population Flags', status: 'Present', source: '—', notes: 'enrollment, discontinuation' },
  { category: 'Time Variables', requiredBy: 'Observation Window', status: 'Partial', source: '—', notes: 'index date, follow-up end' },
]

type QualityDimension = {
  label: string
  score: number | null
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail: string
}

const DEFAULT_QUALITY_DIMENSIONS: QualityDimension[] = [
  { label: 'Completeness', score: null, status: 'unknown', detail: 'Percentage of required fields present across all records.' },
  { label: 'Temporal Validity', score: null, status: 'unknown', detail: 'Observation window adequately covers the defined study period.' },
  { label: 'Consistency', score: null, status: 'unknown', detail: 'No contradictory records identified across linked sources.' },
  { label: 'Duplication', score: null, status: 'unknown', detail: 'Percentage of duplicate rows identified and flagged for removal.' },
  { label: 'Variable Coverage', score: null, status: 'unknown', detail: 'Percentage of study-required variables present in registered source data.' },
  { label: 'Covariate Adequacy', score: null, status: 'unknown', detail: 'Percentage of DAG-specified covariates available in registered source data.' },
]

const statusIcon: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
  warn: <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />,
  fail: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
  unknown: <Clock className="h-4 w-4 text-gray-400 shrink-0" />,
}

const coverageStatusColors: Record<CoverageStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Missing: 'bg-red-50 text-red-700 border-red-200',
  'Not Required': 'bg-gray-100 text-gray-500 border-gray-200',
}

export default function DataProvenance({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: provData, loading, error, saving, save, refetch } = useStudyData(selectedStudy?.id, 'data-sources')
  const staleness = useStalenessCheck(selectedStudy?.id, 'data_sources')

  const [dataSources, setDataSources] = useState<any[]>([])
  const [validationChecks, setValidationChecks] = useState<any[]>([])
  const [dataQualityThreshold, setDataQualityThreshold] = useState<number>(95)
  const locked = protocolLocked
  const [showImpactDialog, setShowImpactDialog] = useState(false)
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('data_sources')

  // Coverage matrix state
  const [coverageMatrix, _setCoverageMatrix] = useState<CoverageRow[]>(DEFAULT_COVERAGE_MATRIX)

  // Quality dimensions state
  const [qualityDimensions, _setQualityDimensions] = useState<QualityDimension[]>(DEFAULT_QUALITY_DIMENSIONS)

  // Source type for new registrations
  const [selectedSourceType, setSelectedSourceType] = useState<string>('Claims')

  // SDTM Datasets state
  const [sdtmDomains, setSdtmDomains] = useState<Record<string, any>>({})
  const [sdtmLoading, setSdtmLoading] = useState(false)
  const [sdtmValidating, setSdtmValidating] = useState(false)
  const [sdtmValidationReports, setSdtmValidationReports] = useState<any[]>([])

  // ADaM Datasets state
  const [adamDatasets, setAdamDatasets] = useState<any[]>([])
  const [adamLoading, setAdamLoading] = useState(false)
  const [adamValidating, setAdamValidating] = useState(false)

  // Defensive: ensure state is always an array
  const safeDataSources = Array.isArray(dataSources) ? dataSources : []
  const safeValidationChecks = Array.isArray(validationChecks) ? validationChecks : []
  const safeAdamDatasets = Array.isArray(adamDatasets) ? adamDatasets : []

  useEffect(() => {
    if (provData) {
      if (Array.isArray(provData.sources) && provData.sources.length) setDataSources(provData.sources)
      if (Array.isArray(provData.checks) && provData.checks.length) setValidationChecks(provData.checks)
      if (provData.data_quality_threshold != null) setDataQualityThreshold(provData.data_quality_threshold)
    }
  }, [provData])

  // ── Editable field helpers ──────────────────────────────────────────────────
  const handleUpdateSource = (index: number, field: string, value: any) => {
    const updated = [...dataSources]
    updated[index] = { ...updated[index], [field]: value }
    setDataSources(updated)
    save({ sources: updated, data_quality_threshold: dataQualityThreshold })
  }

  const handleAddSource = () => {
    const newSource = {
      name: '',
      type: selectedSourceType,
      coverage: '',
      variables: [],
      validated: false,
      hash: 'Pending',
      version: '',
    }
    const updated = [...dataSources, newSource]
    setDataSources(updated)
    save({ sources: updated, data_quality_threshold: dataQualityThreshold })
  }

  const handleRemoveSource = (index: number) => {
    const updated = dataSources.filter((_, i) => i !== index)
    setDataSources(updated)
    save({ sources: updated, data_quality_threshold: dataQualityThreshold })
  }

  const handleQualityThresholdChange = (value: number) => {
    setDataQualityThreshold(value)
    save({ sources: dataSources, data_quality_threshold: value })
  }

  const confirmSave = () => {
    save({ sources: dataSources, data_quality_threshold: dataQualityThreshold })
    setShowImpactDialog(false)
  }

  const handleSave = () => {
    if ((directImpacts.length > 0 || transitiveImpacts.length > 0) && !protocolLocked) {
      setShowImpactDialog(true)
    } else {
      confirmSave()
    }
  }

  // Fetch existing ADaM datasets on mount
  useEffect(() => {
    if (selectedStudy?.id) {
      apiClient.getAdamDatasets(selectedStudy.id).then(setAdamDatasets).catch(() => {})
    }
  }, [selectedStudy?.id])

  const handleDeriveAdam = async (type: string) => {
    setAdamLoading(true)
    logDerivation(`adam_${type}`, 'started')
    const prevState = resolveAdamState(type).state
    try {
      await apiClient.runStudyComputation(selectedStudy?.id, `../adam/generate/${type}`)
      const data = await apiClient.getAdamDatasets(selectedStudy?.id!)
      setAdamDatasets(data)
      logDerivation(`adam_${type}`, 'completed')
      logStateTransition(`adam_${type}`, prevState, 'derived', 'derivation_completed')
    } catch (err: any) {
      console.error('ADaM derivation failed:', err)
      logDerivation(`adam_${type}`, 'failed', err.message || 'Unknown error')
    }
    finally { setAdamLoading(false) }
  }

  const handleValidateAllAdam = async () => {
    setAdamValidating(true)
    try {
      await apiClient.runStudyComputation(selectedStudy?.id, '../adam/validate')
      const data = await apiClient.getAdamDatasets(selectedStudy?.id!)
      setAdamDatasets(data)
    } catch (err) { console.error('ADaM validation failed:', err) }
    finally { setAdamValidating(false) }
  }

  // ── HIPAA Consent & Upload state ────────────────────────────────────────────
  const ATTESTATION_TEXT =
    'I certify that the data I am uploading has been de-identified in accordance with either the Expert ' +
    'Determination method or the Safe Harbor method as defined under 45 CFR 164.514(b)-(c) (HIPAA Privacy Rule). ' +
    'I further certify that no direct identifiers (as enumerated in Safe Harbor 164.514(b)(2)) are present in this ' +
    'dataset, that this upload is authorized by my organization, and that I am a covered entity or business ' +
    'associate acting within the terms of an executed BAA with Synthetic Ascendancy. I understand this attestation ' +
    'is binding and is logged with my credentials, timestamp, and session context.'

  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentSubmitting, setConsentSubmitting] = useState(false)
  const [consentId, setConsentId] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadReport, setUploadReport] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [validationGateReport, setValidationGateReport] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [existingDataset, setExistingDataset] = useState<any>(null)
  const [_datasetLoading, setDatasetLoading] = useState(false)

  // Fetch existing dataset on mount
  useEffect(() => {
    if (selectedStudy?.id) {
      setDatasetLoading(true)
      apiClient.getDatasets(selectedStudy.id)
        .then(data => {
          if (data && (Array.isArray(data) ? data.length > 0 : data.id)) {
            setExistingDataset(Array.isArray(data) ? data[0] : data)
          }
        })
        .catch(() => {})
        .finally(() => setDatasetLoading(false))
    }
  }, [selectedStudy?.id])

  const handleConsentSubmit = useCallback(async () => {
    if (!selectedStudy?.id) return
    setConsentSubmitting(true)
    try {
      const data = await apiClient.submitIngestionConsent(selectedStudy.id, {
        attestation_text: ATTESTATION_TEXT,
        consent_version: 'HIPAA-SH-v1.2',
      })
      setConsentId(data.consent_id || data.id)
      setShowConsentModal(false)
      setConsentChecked(false)
    } catch (err) {
      console.error('Consent attestation failed:', err)
    } finally {
      setConsentSubmitting(false)
    }
  }, [selectedStudy?.id])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !consentId || !selectedStudy?.id) return
    setUploading(true)
    setUploadError(null)
    logUpload(selectedStudy.id, selectedFile.name, 'started')
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('consent_id', consentId)
      const report = await apiClient.uploadFile(
        `/projects/${selectedStudy.id}/ingestion/upload`,
        formData
      )
      setUploadReport(report)
      const status = report?.status || report?.compliance_status
      if (status === 'BLOCKED') {
        logUpload(selectedStudy.id, selectedFile.name, 'blocked', 'Compliance check failed')
      } else {
        logUpload(selectedStudy.id, selectedFile.name, 'completed', `Status: ${status}`)
      }
      setSelectedFile(null)
    } catch (err: any) {
      logUpload(selectedStudy.id, selectedFile.name, 'failed', err.message || 'Upload failed')
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [selectedFile, consentId, selectedStudy?.id])

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedStudy?.id) return
    setAnalyzing(true)
    setAnalysisComplete(false)
    setValidationGateReport(null)
    setAnalysisError(null)
    logDerivation('analysis_pipeline', 'started')
    try {
      await apiClient.analyzeDataset(selectedStudy.id, {})
      setAnalysisComplete(true)
      logDerivation('analysis_pipeline', 'completed')
    } catch (err: any) {
      if (err.statusCode === 422 && err.detail?.validation_report) {
        setValidationGateReport(err.detail.validation_report)
        setAnalysisError(err.detail.message || 'Pre-analysis validation blocked.')
        logDerivation('analysis_pipeline', 'failed', 'Pre-analysis validation blocked')
      } else {
        setAnalysisError(err.message || 'Analysis failed')
        logDerivation('analysis_pipeline', 'failed', err.message || 'Analysis failed')
      }
    } finally {
      setAnalyzing(false)
    }
  }, [selectedStudy?.id])

  const handleReplaceDataset = useCallback(() => {
    setExistingDataset(null)
    setUploadReport(null)
    setConsentId(null)
    setSelectedFile(null)
    setWarningsAcknowledged(false)
    setAnalysisComplete(false)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const complianceStatus = uploadReport?.status || uploadReport?.compliance_status
  const findings = uploadReport?.findings || uploadReport?.checks || []
  const datasetSummary = uploadReport?.summary || uploadReport?.dataset_summary

  // ── SDTM handlers ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedStudy?.id) {
      apiClient.getProject(selectedStudy.id).then(proj => {
        if (proj?.processing_config?.sdtm) setSdtmDomains(proj.processing_config.sdtm)
      }).catch(() => {})
    }
  }, [selectedStudy?.id])

  const handleMapSdtm = async (domain: string) => {
    setSdtmLoading(true)
    const prevState = resolveSdtmState(domain)
    try {
      const data = await apiClient.generateSdtmDomain(selectedStudy?.id!, domain)
      setSdtmDomains(prev => ({ ...prev, [domain]: data }))
      logStateTransition(`sdtm_${domain}`, prevState, 'mapped', 'mapping_completed')
    } catch (err) {
      console.error('SDTM mapping failed:', err)
      logStateTransition(`sdtm_${domain}`, prevState, 'mapping_invalid', 'mapping_error')
    }
    finally { setSdtmLoading(false) }
  }

  const handleMapAllSdtm = async () => {
    setSdtmLoading(true)
    try {
      await apiClient.generateSdtmAll(selectedStudy?.id!)
      const proj = await apiClient.getProject(selectedStudy?.id!)
      if (proj?.processing_config?.sdtm) setSdtmDomains(proj.processing_config.sdtm)
    } catch (err) { console.error('SDTM map-all failed:', err) }
    finally { setSdtmLoading(false) }
  }

  const handleValidateSdtmDomain = async () => {
    setSdtmValidating(true)
    try {
      const data = await apiClient.validateSdtm(selectedStudy?.id!)
      setSdtmValidationReports(data.reports || [])
    } catch (err) { console.error('SDTM validation failed:', err) }
    finally { setSdtmValidating(false) }
  }

  // ── Derived readiness summary values ────────────────────────────────────────
  const staleCount = staleness.staleUpstreams?.length ?? 0
  const presentCount = coverageMatrix.filter(r => r.status === 'Present').length
  const totalRequired = coverageMatrix.filter(r => r.status !== 'Not Required').length

  const allSdtmRequired = Object.entries(SDTM_REQUIREDNESS).filter(([, v]) => v.required).map(([k]) => k)
  const allSdtmMapped = allSdtmRequired.every(key => !!sdtmDomains[key])
  const downstreamReadiness = allSdtmMapped && safeAdamDatasets.length > 0
    ? 'Ready'
    : allSdtmRequired.some(key => !!sdtmDomains[key])
    ? 'In Progress'
    : 'Not Ready'

  const downstreamReadinessColor =
    downstreamReadiness === 'Ready' ? 'text-emerald-700' :
    downstreamReadiness === 'In Progress' ? 'text-amber-700' :
    'text-red-700'

  // ── Formal state machine resolution ────────────────────────────────────────

  /** Resolve SDTM domain state using the formal state machine. */
  const resolveSdtmState = (domain: string): ArtifactState => {
    const safeReports = Array.isArray(sdtmValidationReports) ? sdtmValidationReports : []
    const domainUpper = domain.toUpperCase()
    const valReport = safeReports.find((r: any) => r.domain === domainUpper)
    const spec = SDTM_REQUIREDNESS[domain] ?? { required: false, reason: '', dependencies: [] }
    const isMapped = !!sdtmDomains[domain]
    const sourceRegistered = safeDataSources.length > 0 || !!existingDataset || !!uploadReport
    const hasRequiredVars = coverageMatrix.filter(r => r.status !== 'Not Required' && r.status !== 'Missing').length > 0
    const isStale = (staleness.staleUpstreams?.length ?? 0) > 0

    return resolveArtifactState({
      artifactId: `sdtm_${domain}`,
      category: 'sdtm_domain',
      required: spec.required,
      sourceDataRegistered: sourceRegistered,
      coverageSufficient: hasRequiredVars,
      isMapped,
      isDerived: false,
      validationPassed: valReport?.valid === true ? true : null,
      validationFailed: valReport?.valid === false,
      isStale,
      missingDeps: [],
    })
  }

  /** Resolve ADaM dataset state using the formal state machine. */
  const resolveAdamState = (key: string): { state: ArtifactState; missingDeps: string[] } => {
    const spec = ADAM_SPECS[key] ?? { name: key.toUpperCase(), label: '', purpose: '', sdtmDeps: [], studyDeps: [] }
    const existing = safeAdamDatasets.find((d: any) => d.type === key || d.name === spec.name)
    const missingDeps = spec.sdtmDeps.filter(dep => !sdtmDomains[dep])
    const depLabels: Record<string, string> = { dm: 'DM', ae: 'AE', lb: 'LB', vs: 'VS', ex: 'EX', ds: 'DS' }
    const missingDepLabels = missingDeps.map(d => depLabels[d] || d.toUpperCase())
    const isStale = (staleness.staleUpstreams?.length ?? 0) > 0

    const state = resolveArtifactState({
      artifactId: `adam_${key}`,
      category: 'adam_dataset',
      required: true,
      sourceDataRegistered: true,
      coverageSufficient: true,
      isMapped: missingDeps.length === 0,
      isDerived: !!existing,
      validationPassed: existing?.validation_status === 'valid' || existing?.validation_status === 'validated' ? true : null,
      validationFailed: existing?.validation_status === 'invalid',
      isStale,
      missingDeps: missingDepLabels,
    })

    return { state, missingDeps: missingDepLabels }
  }

  // Legacy-compatible wrappers (used by render)
  const getAdamStatus = (key: string): { status: string; blockReason: string | null } => {
    const { state, missingDeps } = resolveAdamState(key)
    const spec = ADAM_SPECS[key] ?? { name: key.toUpperCase(), label: '', purpose: '', sdtmDeps: [], studyDeps: [] }
    const explanation = getArtifactExplanation(state, {
      artifactName: spec.name,
      missingDeps,
    })
    return {
      status: explanation.statusLabel,
      blockReason: state === 'blocked' ? explanation.detail : null,
    }
  }

  const getSdtmStatusLabel = (domain: string): string => {
    const state = resolveSdtmState(domain)
    const domainUpper = domain.toUpperCase()
    return getArtifactExplanation(state, { artifactName: domainUpper }).statusLabel
  }

  const getSdtmStatusColors = (label: string): string => {
    // Map label back to state for badge classes
    const labelToState: Record<string, ArtifactState> = {
      'Validated': 'validated',
      'Mapped': 'mapped',
      'Fully Mapped': 'mapped',
      'Validation Failed': 'mapping_invalid',
      'Stale': 'stale',
      'Not Started': 'required_unconfigured',
      'Awaiting Data': 'awaiting_source_data',
      'Ready for Mapping': 'ready_for_mapping',
      'Insufficient Data': 'source_data_insufficient',
      'Not Required': 'not_required',
    }
    return getStateBadgeClasses(labelToState[label] || 'required_unconfigured')
  }

  const getAdamStatusColors = (status: string): string => {
    const labelToState: Record<string, ArtifactState> = {
      'Validated': 'validated',
      'Derived': 'derived',
      'Ready for Derivation': 'ready_for_derivation',
      'Blocked': 'blocked',
      'Validation Failed': 'derivation_invalid',
      'Stale': 'stale',
      'Not Started': 'required_unconfigured',
    }
    return getStateBadgeClasses(labelToState[status] || 'required_unconfigured')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Database className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 03</span>
                {locked && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
                {reviewerMode && (
                  <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold">
                    <Eye className="h-2.5 w-2.5" /> Reviewer View
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900">Data Lineage &amp; Dataset Readiness</h1>
              <p className="text-gray-500 text-xs mt-0.5">
                Source data registration · coverage assessment · SDTM mapping · ADaM derivation · validation status
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      {/* ── Loading / Error states ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading data lineage...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Failed to load data provenance</p>
            <p className="text-xs text-gray-500 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── HIPAA Consent Modal ───────────────────────────────────────────── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-[#2563EB]" />
              <h3 className="text-lg font-bold text-gray-900">HIPAA De-Identification Attestation</h3>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 max-h-56 overflow-y-auto">
              <p className="text-xs text-gray-600 leading-relaxed">{ATTESTATION_TEXT}</p>
            </div>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <span className="text-xs text-gray-700">I have read and agree to this attestation</span>
            </label>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setShowConsentModal(false); setConsentChecked(false) }}
                className="text-xs text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentSubmit}
                disabled={!consentChecked || consentSubmitting}
                className="flex items-center gap-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
              >
                {consentSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                Confirm &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6 space-y-8 max-w-5xl">

        {/* ── Section 2: Staleness Banner + Impact Panel ─────────────────── */}
        <div className="space-y-3">
          <StalenessBanner
            staleUpstreams={staleness.staleUpstreams}
            onAcknowledge={staleness.acknowledge}
          />

          {staleCount > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Upstream changes detected — downstream artifacts may be outdated</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Endpoint definition updated. ADTTE derivation may no longer reflect the current specification.
                    Review all affected artifacts before proceeding to analysis.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {['ADTTE derivation', 'Coverage assessment', 'Validation hash'].map(artifact => (
                  <span
                    key={artifact}
                    className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded"
                  >
                    {artifact}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">
                  <Info className="h-3 w-3" /> Review Impact
                </button>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">
                  <RefreshCw className="h-3 w-3" /> Recompute Dependencies
                </button>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors">
                  <ListChecks className="h-3 w-3" /> Mark for Re-derivation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 3: Provenance Readiness Summary ───────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Provenance Readiness Summary</h2>
            <p className="text-xs text-gray-500 mt-0.5">High-level status of registered data, coverage, and derivation pipeline</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {/* Registered Data Sources */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Registered Sources</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{safeDataSources.length || '—'}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Source datasets</p>
            </div>
            {/* Total Person-Time */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Person-Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{datasetSummary?.person_years ?? '—'}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Observed</p>
            </div>
            {/* Observation Window */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Obs. Window</p>
              <p className="text-lg font-bold text-gray-900 mt-1 leading-tight">
                {datasetSummary?.obs_start && datasetSummary?.obs_end
                  ? `${datasetSummary.obs_start}–${datasetSummary.obs_end}`
                  : '—'}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Date range</p>
            </div>
            {/* Variable Coverage */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Var. Coverage</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{presentCount}/{totalRequired}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Required variables</p>
            </div>
            {/* Stale Artifacts */}
            <div className={`bg-white border rounded-xl p-4 ${staleCount > 0 ? 'border-red-200' : 'border-gray-200'}`}>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Stale Artifacts</p>
              <p className={`text-2xl font-bold mt-1 ${staleCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {staleCount}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Require re-derivation</p>
            </div>
            {/* Downstream Readiness */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Downstream</p>
              <p className={`text-lg font-bold mt-1 leading-tight ${downstreamReadinessColor}`}>
                {downstreamReadiness}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">Pipeline readiness</p>
            </div>
          </div>
        </section>

        {/* ── Section 4: Source Data Registration ───────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Upload className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Source Data Registration</h2>
              <p className="text-[10px] text-gray-500">Register de-identified source datasets for mapping and analysis</p>
            </div>
          </div>

          {/* Existing Dataset Info Card */}
          {existingDataset && !uploadReport && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  <span className="text-sm font-bold text-gray-900">
                    {existingDataset.filename || existingDataset.name || 'Registered Dataset'}
                  </span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  existingDataset.compliance_status === 'CLEARED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : existingDataset.compliance_status === 'BLOCKED'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {existingDataset.compliance_status || 'Unknown'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {existingDataset.upload_date && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Registered</p>
                    <p className="text-xs text-gray-900 font-mono">
                      {new Date(existingDataset.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {existingDataset.row_count != null && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Rows</p>
                    <p className="text-xs text-gray-900 font-mono">{existingDataset.row_count.toLocaleString()}</p>
                  </div>
                )}
                {existingDataset.columns != null && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Variables</p>
                    <p className="text-xs text-gray-900 font-mono">
                      {Array.isArray(existingDataset.columns) ? existingDataset.columns.length : existingDataset.columns}
                    </p>
                  </div>
                )}
                {existingDataset.type && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Source Type</p>
                    <p className="text-xs text-gray-900 font-medium">{existingDataset.type}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleReplaceDataset}
                className="flex items-center gap-2 text-xs text-amber-700 hover:text-amber-900 font-semibold transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Replace Dataset
              </button>
            </div>
          )}

          {/* Step 1: Consent gate */}
          {!consentId && !existingDataset && !uploadReport && (
            <div className="space-y-4">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source Type</label>
                  <select
                    value={selectedSourceType}
                    onChange={e => setSelectedSourceType(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="EHR">EHR</option>
                    <option value="Claims">Claims</option>
                    <option value="Trial Data">Trial Data</option>
                    <option value="Registry">Registry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <button
                  onClick={() => setShowConsentModal(true)}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <FileUp className="h-4 w-4" /> Register Source Dataset
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <Database className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">No source datasets have been registered.</p>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  Source data must include variables required for population definition, endpoints, and covariates defined in the study.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Dropzone — after consent granted */}
          {consentId && !uploadReport && (
            <div className="space-y-4">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end mb-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source Type</label>
                  <select
                    value={selectedSourceType}
                    onChange={e => setSelectedSourceType(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="EHR">EHR</option>
                    <option value="Claims">Claims</option>
                    <option value="Trial Data">Trial Data</option>
                    <option value="Registry">Registry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="h-3 w-3" /> HIPAA attestation confirmed
                </div>
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#2563EB] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                }`}
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-1">
                  Drop .csv, .xlsx, .xpt, or .sas7bdat file here, or click to browse
                </p>
                <p className="text-[10px] text-gray-400">Maximum 100 MB · De-identified data only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.xpt,.sas7bdat"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#2563EB]" />
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{selectedFile.name}</p>
                      <p className="text-[10px] text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Compliance Report */}
          {uploadReport && (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                complianceStatus === 'CLEARED'
                  ? 'bg-emerald-50 border-emerald-200'
                  : complianceStatus === 'BLOCKED'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                {complianceStatus === 'CLEARED' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {complianceStatus === 'BLOCKED' && <XCircle className="h-5 w-5 text-red-600" />}
                {complianceStatus === 'CLEARED_WITH_WARNINGS' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                <span className={`text-sm font-bold ${
                  complianceStatus === 'CLEARED' ? 'text-emerald-700' :
                  complianceStatus === 'BLOCKED' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {complianceStatus === 'CLEARED' && 'Dataset cleared for analysis'}
                  {complianceStatus === 'BLOCKED' && 'Dataset blocked — resolve critical findings before proceeding'}
                  {complianceStatus === 'CLEARED_WITH_WARNINGS' && 'Review warnings before proceeding'}
                </span>
              </div>

              {findings.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-900 mb-2">Compliance Findings</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2 text-gray-500 font-semibold">Check</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-semibold">Severity</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-semibold">Result</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-semibold">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {findings.map((f: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{f.check_name || f.name}</td>
                            <td className="px-4 py-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                f.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                f.severity === 'MAJOR' ? 'bg-orange-100 text-orange-700' :
                                f.severity === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {f.severity}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-700">{f.result}</td>
                            <td className="px-4 py-2 text-gray-500">{f.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Source Profile Card */}
              {datasetSummary && (
                <div>
                  <h3 className="text-xs font-bold text-gray-900 mb-2">Source Profile</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {datasetSummary.total_rows != null && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Total Rows</p>
                        <p className="text-lg font-bold text-gray-900">{datasetSummary.total_rows.toLocaleString()}</p>
                      </div>
                    )}
                    {datasetSummary.columns_detected != null && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Variables Detected</p>
                        <p className="text-lg font-bold text-gray-900">{datasetSummary.columns_detected}</p>
                      </div>
                    )}
                    {datasetSummary.missingness != null && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Missingness</p>
                        <p className="text-lg font-bold text-gray-900">
                          {typeof datasetSummary.missingness === 'number'
                            ? `${(datasetSummary.missingness * 100).toFixed(1)}%`
                            : datasetSummary.missingness}
                        </p>
                      </div>
                    )}
                    {datasetSummary.n_by_arm && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">N by Arm</p>
                        {Object.entries(datasetSummary.n_by_arm).map(([arm, n]: [string, any]) => (
                          <p key={arm} className="text-xs text-gray-700">
                            <span className="font-mono text-gray-900 font-semibold">{n}</span> {arm}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acknowledge Warnings */}
              {complianceStatus === 'CLEARED_WITH_WARNINGS' && !warningsAcknowledged && (
                <label className="flex items-start gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <input
                    type="checkbox"
                    checked={warningsAcknowledged}
                    onChange={e => setWarningsAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-amber-600"
                  />
                  <span className="text-xs text-amber-800">
                    I have reviewed all warnings and confirm the dataset is appropriate for use in this study
                  </span>
                </label>
              )}

              {/* Run Analysis */}
              {(complianceStatus === 'CLEARED' ||
                (complianceStatus === 'CLEARED_WITH_WARNINGS' && warningsAcknowledged)) &&
                !analysisComplete && (
                <button
                  onClick={handleRunAnalysis}
                  disabled={analyzing}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-bold px-5 py-3 rounded-lg transition-colors"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  {analyzing ? 'Running analysis...' : 'Analyze Registered Data'}
                </button>
              )}

              {analysisError && !validationGateReport && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <span className="text-sm text-red-700">{analysisError}</span>
                </div>
              )}

              {validationGateReport && (
                <ValidationGatePanel
                  validationReport={validationGateReport}
                  onDismiss={() => setValidationGateReport(null)}
                />
              )}

              {analysisComplete && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">
                    Analysis complete. Results are available in Effect Estimation.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Registered sources list */}
          {safeDataSources.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-700">Registered Sources</h3>
                {!locked && !reviewerMode && (
                  <button
                    onClick={handleAddSource}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span className="text-sm leading-none">+</span> Add Source
                  </button>
                )}
              </div>
              {safeDataSources.map((src, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {!locked && !reviewerMode ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={src.name}
                              onChange={e => handleUpdateSource(i, 'name', e.target.value)}
                              placeholder="Source dataset name"
                              className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            />
                            <select
                              value={src.type}
                              onChange={e => handleUpdateSource(i, 'type', e.target.value)}
                              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            >
                              <option value="EHR">EHR</option>
                              <option value="Claims">Claims</option>
                              <option value="Trial Data">Trial Data</option>
                              <option value="Registry">Registry</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={src.coverage || ''}
                            onChange={e => handleUpdateSource(i, 'coverage', e.target.value)}
                            placeholder="Coverage description (e.g. 74M lives · 2015–2024)"
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-gray-900">{src.name}</p>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
                              {src.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{src.coverage}</p>
                        </>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {src.validated
                          ? <span className="flex items-center gap-1 text-[9px] text-emerald-700 font-bold"><CheckCircle2 className="h-3 w-3" /> Validated</span>
                          : <span className="flex items-center gap-1 text-[9px] text-amber-700 font-bold"><Clock className="h-3 w-3" /> Pending validation</span>
                        }
                      </div>
                    </div>
                    <div className="text-right flex items-start gap-2">
                      <div>
                        <p className="text-[9px] text-gray-400 font-mono">{src.hash}</p>
                        <p className="text-[9px] text-gray-400">{src.version}</p>
                      </div>
                      {!locked && !reviewerMode && (
                        <button
                          onClick={() => handleRemoveSource(i)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1"
                          title="Remove data source"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(src.variables || []).map((v: string) => (
                      <span key={v} className="text-[10px] text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 5: Coverage Assessment Matrix ─────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-900">Variable Coverage Assessment</h2>
            <p className="text-xs text-gray-500 mt-0.5">Required variables compared against registered source data</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Variable Category</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Required By</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Source</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {coverageMatrix.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      i === coverageMatrix.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{row.category}</td>
                    <td className="px-4 py-3 text-gray-600">{row.requiredBy}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${coverageStatusColors[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{row.source}</td>
                    <td className="px-4 py-3 text-gray-500">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 6: Data Quality & Coverage Validation ─────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900">Data Quality &amp; Coverage Validation</h2>
            <p className="text-xs text-gray-500 mt-0.5">Multi-dimensional quality assessment against study requirements</p>
          </div>

          {/* Quality dimensions */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {qualityDimensions.map((dim, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {statusIcon[dim.status]}
                    <span className="text-sm font-semibold text-gray-900">{dim.label}</span>
                  </div>
                  <span className={`text-sm font-bold font-mono ${
                    dim.score === null ? 'text-gray-400' :
                    dim.status === 'pass' ? 'text-emerald-700' :
                    dim.status === 'warn' ? 'text-amber-700' :
                    dim.status === 'fail' ? 'text-red-700' :
                    'text-gray-400'
                  }`}>
                    {dim.score !== null ? `${dim.score}%` : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{dim.detail}</p>
                {dim.score !== null && (
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dim.status === 'pass' ? 'bg-emerald-500' :
                        dim.status === 'warn' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quality threshold config */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 mb-5">
            <BarChart2 className="h-4 w-4 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-600">Overall quality score threshold required to proceed:</p>
            {!locked && !reviewerMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={dataQualityThreshold}
                  onChange={e => handleQualityThresholdChange(Number(e.target.value))}
                  className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-gray-900 font-mono">{dataQualityThreshold}%</span>
            )}
          </div>

          {/* Validation checks table */}
          {safeValidationChecks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-700">Validation Checks</h3>
                <span className="text-[10px] text-gray-500">
                  {safeValidationChecks.filter(c => c.status === 'pass').length}/{safeValidationChecks.length} passed
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {safeValidationChecks.map((check, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                      i < safeValidationChecks.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    {statusIcon[check.status]}
                    <div>
                      <p className="text-sm text-gray-900 font-medium">{check.check}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 7: SDTM Domain Mapping ────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">SDTM Domain Mapping</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Standardization of source data into CDISC SDTM domains required for analysis
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMapAllSdtm}
                disabled={sdtmLoading}
                className="flex items-center gap-1.5 text-xs text-white font-semibold bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                {sdtmLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                Map All Domains
              </button>
              <button
                onClick={handleValidateSdtmDomain}
                disabled={sdtmValidating}
                className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {sdtmValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Run Domain Validation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { domain: 'dm', name: 'DM', label: 'Demographics' },
              { domain: 'ae', name: 'AE', label: 'Adverse Events' },
              { domain: 'lb', name: 'LB', label: 'Laboratory Test Results' },
              { domain: 'vs', name: 'VS', label: 'Vital Signs' },
              { domain: 'ex', name: 'EX', label: 'Exposure' },
              { domain: 'ds', name: 'DS', label: 'Disposition' },
            ].map(ds => {
              const spec = SDTM_REQUIREDNESS[ds.domain] ?? { required: false, reason: '', dependencies: [] }
              const existing = sdtmDomains[ds.domain]
              const statusLabel = getSdtmStatusLabel(ds.domain)
              const statusColors = getSdtmStatusColors(statusLabel)
              const requirednessTag = spec.required
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-gray-100 border-gray-200 text-gray-500'

              return (
                <div key={ds.domain} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{ds.name} — {ds.label}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${requirednessTag}`}>
                          {spec.required ? 'Required' : 'Optional'}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColors}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2 leading-relaxed">{spec.reason}</p>

                  <div className="mb-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Dependencies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {spec.dependencies.map(dep => (
                        <span key={dep} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>

                  {existing?.records_count != null && (
                    <p className="text-xs text-gray-500 mb-3">
                      <span className="font-mono text-gray-900 font-semibold">
                        {existing.records_count.toLocaleString()}
                      </span>{' '}records mapped
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMapSdtm(ds.domain)}
                      disabled={sdtmLoading}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300 px-3 py-2 rounded-lg transition-colors"
                    >
                      {sdtmLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                      {existing ? 'Re-map' : 'Complete Mapping'}
                    </button>
                    <button
                      onClick={handleValidateSdtmDomain}
                      disabled={sdtmValidating}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      {sdtmValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Run Domain Validation
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 8: ADaM Analysis Dataset Derivation ───────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">ADaM Analysis Dataset Derivation</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Construction of analysis-ready datasets from SDTM domains and study specification
              </p>
            </div>
            <button
              onClick={handleValidateAllAdam}
              disabled={adamValidating}
              className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {adamValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Validate All
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {Object.entries(ADAM_SPECS).map(([key, spec]) => {
              const { status, blockReason } = getAdamStatus(key)
              const statusColors = getAdamStatusColors(status)
              const existing = safeAdamDatasets.find((d: any) => d.type === key || d.name === spec.name)
              const isBlocked = status === 'Blocked'
              const isDerived = ['Derived', 'Validated'].includes(status)

              return (
                <div key={key} className={`bg-white border rounded-xl p-5 ${isBlocked ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{spec.name} — {spec.label}</h3>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColors}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{spec.purpose}</p>
                    </div>
                  </div>

                  {/* SDTM dependencies with status */}
                  <div className="mb-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-1">SDTM Dependencies</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {spec.sdtmDeps.map(dep => {
                        const mapped = !!sdtmDomains[dep]
                        return (
                          <span
                            key={dep}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              mapped
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}
                          >
                            {dep.toUpperCase()}
                            {mapped ? ' ✓' : ' ✗'}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Study definition dependencies */}
                  <div className="mb-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Study Definition Dependencies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {spec.studyDeps.map(dep => (
                        <span key={dep} className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Blocking reason */}
                  {blockReason && (
                    <div className="flex items-start gap-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{blockReason}</p>
                    </div>
                  )}

                  {/* Record count */}
                  {existing?.record_count != null && (
                    <p className="text-xs text-gray-500 mb-3">
                      <span className="font-mono text-gray-900 font-semibold">
                        {existing.record_count.toLocaleString()}
                      </span>{' '}records derived
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeriveAdam(key)}
                      disabled={adamLoading || isBlocked}
                      className={`flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-lg transition-colors ${
                        isBlocked
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-[#2563EB] hover:bg-blue-600 disabled:bg-blue-300'
                      }`}
                    >
                      {adamLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitBranch className="h-3 w-3" />}
                      {isDerived ? 'Re-derive' : 'Derive from Specification'}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-2 rounded-lg transition-colors">
                      <FileText className="h-3 w-3" /> View Derivation Logic
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-2 rounded-lg transition-colors">
                      <Layers className="h-3 w-3" /> View Dependencies
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 9: Cryptographic Provenance Chain ─────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Provenance &amp; Lineage Integrity</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Cryptographic lineage chain capturing source data, transformations, derivations, and validation states
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <GitBranch className="h-3 w-3" /> View Lineage
              </button>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                <Hash className="h-3 w-3" /> Inspect Transformation Steps
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Entry</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Hash</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] font-sans">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { entry: 'SOURCE_DATA_HASH', hash: 'sha256:9f2a1b3d4c8e7f6a…', status: 'Verified', ts: '2026-03-15T14:22:07Z' },
                  { entry: 'MAPPING_HASH', hash: 'sha256:c4f1a8b2e3d7f9c0…', status: 'Verified', ts: '2026-03-16T09:15:42Z' },
                  { entry: 'DERIVATION_HASH', hash: 'sha256:e7b3d9f1a4c2e8d5…', status: 'Verified', ts: '2026-03-17T11:03:19Z' },
                  { entry: 'VALIDATION_HASH', hash: 'Pending — awaiting EHR validation', status: 'Pending', ts: '—' },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${i === 3 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 text-gray-700 font-medium font-sans">{row.entry}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className={row.status === 'Pending' ? 'text-amber-600' : 'text-emerald-700'}>
                        {row.hash}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-sans ${
                        row.status === 'Verified'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.ts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 10: Save + Navigation ─────────────────────────────── */}
        {!locked && !reviewerMode && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Data Sources'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Link
            to={`/projects/${selectedStudy.id}/causal-framework`}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Step 2: Causal Framework
          </Link>
          <Link
            to={`/projects/${selectedStudy.id}/cohort`}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Step 4: Cohort Construction <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

      <DownstreamImpactDialog
        open={showImpactDialog}
        onClose={() => setShowImpactDialog(false)}
        onConfirm={confirmSave}
        saving={saving}
        currentStepLabel="Data Lineage & Dataset Readiness"
        directImpacts={directImpacts}
        transitiveImpacts={transitiveImpacts}
      />
    </div>
  )
}
