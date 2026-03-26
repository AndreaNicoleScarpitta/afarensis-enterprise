import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Database, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Clock, Loader2, BookOpen, FlaskConical, Globe, GraduationCap, Brain, Upload, FileUp, XCircle, AlertTriangle, Activity, Shield, FileText, Trash2 } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { apiClient } from '../services/apiClient'
import ValidationGatePanel from '@/components/ui/ValidationGatePanel'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const DATA_SOURCES = [
//   {
//     name: 'Optum Clinformatics Data Mart',
//     type: 'Claims',
//     coverage: '74M lives · 2015–2024',
//     variables: ['Diagnoses (ICD-10)', 'Procedures (CPT)', 'Pharmacy fills', 'Enrollment'],
//     validated: true,
//     hash: 'sha256:a8f3d1c…',
//     version: 'v2024.Q3',
//   },
//   {
//     name: 'IQVIA PharMetrics Plus',
//     type: 'Claims',
//     coverage: '60M lives · 2016–2024',
//     variables: ['Medical claims', 'Rx claims', 'Lab results (partial)'],
//     validated: true,
//     hash: 'sha256:b2e7f4a…',
//     version: 'v2024.Q2',
//   },
//   {
//     name: 'Flatiron Health EHR',
//     type: 'EHR',
//     coverage: '280 oncology clinics · 2012–2024',
//     variables: ['Structured lab data', 'Physician notes (NLP)', 'Vitals', 'Treatment history'],
//     validated: false,
//     hash: 'Pending validation',
//     version: 'v2024.10',
//   },
// ]

// SCHEMA REFERENCE — not shown to users
// const VALIDATION_CHECKS = [
//   { check: 'Enrollment continuity ≥ 6 months pre-index', status: 'pass', detail: '98.4% of cohort met criterion' },
//   { check: 'Index date uniqueness (no duplicate patient IDs)', status: 'pass', detail: '0 duplicates detected' },
//   { check: 'Outcome code coverage in all sources', status: 'pass', detail: 'ICD-10 codes mapped across all 3 sources' },
//   { check: 'Death linkage (NDI) completeness', status: 'warn', detail: '94.1% match rate; 5.9% unlinked (expected)' },
//   { check: 'Pharmacy fill 30-day gap rule applied', status: 'pass', detail: 'Algorithm validated against gold-standard chart review (κ = 0.87)' },
//   { check: 'EHR structured lab completeness', status: 'fail', detail: 'Flatiron lab data missing for 31% of patients — sensitivity analysis planned' },
// ]

const statusIcon: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  warn: <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />,
  fail: <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />,
}

// Helper function to determine source from source_id
const getSourceBadge = (sourceId: string, sourceType: string) => {
  if (sourceId?.startsWith('openalex_')) return { label: 'OpenAlex', color: 'bg-orange-100 text-orange-700' };
  if (sourceId?.startsWith('ss_')) return { label: 'Semantic Scholar', color: 'bg-purple-100 text-purple-700' };
  if (sourceType === 'CLINICALTRIALS' || sourceId?.startsWith('NCT')) return { label: 'ClinicalTrials.gov', color: 'bg-green-100 text-green-700' };
  if (sourceId?.startsWith('PMID') || sourceType === 'PUBMED') return { label: 'PubMed', color: 'bg-blue-100 text-blue-700' };
  return { label: sourceType || 'Unknown', color: 'bg-gray-100 text-gray-700' };
};

export default function DataProvenance({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { data: provData, loading, error, save } = useStudyData(selectedStudy?.id, 'data-sources')

  const [dataSources, setDataSources] = useState<any[]>([])
  const [validationChecks, setValidationChecks] = useState<any[]>([])
  const locked = protocolLocked

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
    }
  }, [provData])

  // Fetch existing ADaM datasets on mount
  useEffect(() => {
    if (selectedStudy?.id) {
      apiClient.getAdamDatasets(selectedStudy.id).then(setAdamDatasets).catch(() => {})
    }
  }, [selectedStudy?.id])

  const handleGenerateAdam = async (type: string) => {
    setAdamLoading(true)
    try {
      await apiClient.runStudyComputation(selectedStudy?.id, `../adam/generate/${type}`)
      const data = await apiClient.getAdamDatasets(selectedStudy?.id!)
      setAdamDatasets(data)
    } catch (err) { console.error('ADaM generation failed:', err) }
    finally { setAdamLoading(false) }
  }

  const handleValidateAll = async () => {
    setAdamValidating(true)
    try {
      await apiClient.runStudyComputation(selectedStudy?.id, '../adam/validate')
      const data = await apiClient.getAdamDatasets(selectedStudy?.id!)
      setAdamDatasets(data)
    } catch (err) { console.error('ADaM validation failed:', err) }
    finally { setAdamValidating(false) }
  }

  // ==================== Patient Data Upload State ====================
  const ATTESTATION_TEXT = "I certify that the data I am uploading has been de-identified in accordance with either the Expert Determination method or the Safe Harbor method as defined under 45 CFR 164.514(b)-(c) (HIPAA Privacy Rule). I further certify that no direct identifiers (as enumerated in Safe Harbor 164.514(b)(2)) are present in this dataset, that this upload is authorized by my organization, and that I am a covered entity or business associate acting within the terms of an executed BAA with Synthetic Ascendancy. I understand this attestation is binding and is logged with my credentials, timestamp, and session context."

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
  const [datasetLoading, setDatasetLoading] = useState(false)

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
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('consent_id', consentId)

      const report = await apiClient.uploadFile(
        `/projects/${selectedStudy.id}/ingestion/upload`,
        formData
      )
      setUploadReport(report)
      setSelectedFile(null)
    } catch (err: any) {
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
    try {
      await apiClient.analyzeDataset(selectedStudy.id, {})
      setAnalysisComplete(true)
    } catch (err: any) {
      // Check for validation gate block (422 with structured report)
      if (err.statusCode === 422 && err.detail?.validation_report) {
        setValidationGateReport(err.detail.validation_report)
        setAnalysisError(err.detail.message || 'Pre-analysis validation blocked.')
      } else {
        setAnalysisError(err.message || 'Analysis failed')
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

  // Fetch existing SDTM domains on mount
  useEffect(() => {
    if (selectedStudy?.id) {
      apiClient.getProject(selectedStudy.id).then(proj => {
        if (proj?.processing_config?.sdtm) setSdtmDomains(proj.processing_config.sdtm)
      }).catch(() => {})
    }
  }, [selectedStudy?.id])

  const handleGenerateSdtm = async (domain: string) => {
    setSdtmLoading(true)
    try {
      const data = await apiClient.generateSdtmDomain(selectedStudy?.id!, domain)
      setSdtmDomains(prev => ({ ...prev, [domain]: data }))
    } catch (err) { console.error('SDTM generation failed:', err) }
    finally { setSdtmLoading(false) }
  }

  const handleGenerateAllSdtm = async () => {
    setSdtmLoading(true)
    try {
      await apiClient.generateSdtmAll(selectedStudy?.id!)
      // Refresh domains from project config
      const proj = await apiClient.getProject(selectedStudy?.id!)
      if (proj?.processing_config?.sdtm) setSdtmDomains(proj.processing_config.sdtm)
    } catch (err) { console.error('SDTM generate-all failed:', err) }
    finally { setSdtmLoading(false) }
  }

  const handleValidateSdtm = async () => {
    setSdtmValidating(true)
    try {
      const data = await apiClient.validateSdtm(selectedStudy?.id!)
      setSdtmValidationReports(data.reports || [])
    } catch (err) { console.error('SDTM validation failed:', err) }
    finally { setSdtmValidating(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Database className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 03</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Data Provenance</h1>
              <p className="text-gray-500 text-xs mt-0.5">Data sources · coverage · validation · cryptographic lineage</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading data provenance...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-400">Failed to load data provenance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* HIPAA Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-[#2563EB]" />
              <h3 className="text-lg font-bold text-white">HIPAA De-Identification Attestation</h3>
            </div>
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-4 max-h-56 overflow-y-auto">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{ATTESTATION_TEXT}</p>
            </div>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="mt-0.5 accent-[#2563EB]"
              />
              <span className="text-xs text-gray-600 dark:text-gray-300">I have read and agree to this attestation</span>
            </label>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setShowConsentModal(false); setConsentChecked(false) }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentSubmit}
                disabled={!consentChecked || consentSubmitting}
                className="flex items-center gap-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/40 disabled:text-white/50 px-4 py-2 rounded-lg transition-colors"
              >
                {consentSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                Confirm &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {/* ==================== Patient Data Upload Section ==================== */}
        <section className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
              <Upload className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Patient Data Upload</h2>
              <p className="text-[10px] text-gray-500">Upload de-identified patient data for analysis</p>
            </div>
          </div>

          {/* Existing Dataset Info Card */}
          {existingDataset && !uploadReport && (
            <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                  <span className="text-sm font-bold text-white">{existingDataset.filename || existingDataset.name || 'Uploaded Dataset'}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  existingDataset.compliance_status === 'CLEARED' ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400' :
                  existingDataset.compliance_status === 'BLOCKED' ? 'bg-red-900/20 border-red-700/30 text-red-400' :
                  'bg-amber-900/20 border-amber-700/30 text-amber-600 dark:text-amber-300'
                }`}>
                  {existingDataset.compliance_status || 'Unknown'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {existingDataset.upload_date && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Uploaded</p>
                    <p className="text-xs text-white font-mono">{new Date(existingDataset.upload_date).toLocaleDateString()}</p>
                  </div>
                )}
                {existingDataset.row_count != null && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Rows</p>
                    <p className="text-xs text-white font-mono">{existingDataset.row_count.toLocaleString()}</p>
                  </div>
                )}
                {existingDataset.columns != null && (
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Columns</p>
                    <p className="text-xs text-white font-mono">{Array.isArray(existingDataset.columns) ? existingDataset.columns.length : existingDataset.columns}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleReplaceDataset}
                className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-300 hover:text-amber-300 font-semibold transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Replace Dataset
              </button>
            </div>
          )}

          {/* Step 1: Consent gate - show upload button if no consent yet and no existing dataset */}
          {!consentId && !existingDataset && !uploadReport && (
            <button
              onClick={() => setShowConsentModal(true)}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-bold px-5 py-3 rounded-lg transition-colors"
            >
              <FileUp className="h-4 w-4" /> Upload Patient Data
            </button>
          )}

          {/* Step 2: Dropzone - show after consent granted */}
          {consentId && !uploadReport && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-[#2563EB] bg-[#2563EB]/10' : 'border-white/20 hover:border-white/40 bg-gray-50 dark:bg-white/3'
                }`}
              >
                <Upload className="h-8 w-8 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Drop .csv, .xlsx, .xpt, or .sas7bdat file here, or click to browse</p>
                <p className="text-[10px] text-gray-500">Maximum 100MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.xpt,.sas7bdat"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#2563EB] dark:text-[#60a5fa]" />
                    <div>
                      <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                      <p className="text-[10px] text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Compliance Report */}
          {uploadReport && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`flex items-center gap-3 p-4 rounded-xl ${
                complianceStatus === 'CLEARED' ? 'bg-emerald-900/20 border border-emerald-700/30' :
                complianceStatus === 'BLOCKED' ? 'bg-red-900/20 border border-red-700/30' :
                'bg-amber-900/20 border border-amber-700/30'
              }`}>
                {complianceStatus === 'CLEARED' && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                {complianceStatus === 'BLOCKED' && <XCircle className="h-5 w-5 text-red-400" />}
                {complianceStatus === 'CLEARED_WITH_WARNINGS' && <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />}
                <span className={`text-sm font-bold ${
                  complianceStatus === 'CLEARED' ? 'text-emerald-400' :
                  complianceStatus === 'BLOCKED' ? 'text-red-400' :
                  'text-amber-600 dark:text-amber-300'
                }`}>
                  {complianceStatus === 'CLEARED' && 'Dataset cleared for analysis'}
                  {complianceStatus === 'BLOCKED' && 'Dataset blocked \u2014 resolve critical findings'}
                  {complianceStatus === 'CLEARED_WITH_WARNINGS' && 'Review warnings before proceeding'}
                </span>
              </div>

              {/* Findings Table */}
              {findings.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-white mb-2">Compliance Findings</h3>
                  <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-white/5 border-b border-gray-200 dark:border-white/8">
                          <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-semibold">Check Name</th>
                          <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-semibold">Severity</th>
                          <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-semibold">Result</th>
                          <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-semibold">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {findings.map((f: any, i: number) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:bg-white/3">
                            <td className="px-4 py-2 text-white">{f.check_name || f.name}</td>
                            <td className="px-4 py-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                f.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                f.severity === 'MAJOR' ? 'bg-orange-500/20 text-orange-400' :
                                f.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' :
                                'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {f.severity}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{f.result}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{f.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Dataset Summary */}
              {datasetSummary && (
                <div>
                  <h3 className="text-xs font-bold text-white mb-2">Dataset Summary</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {datasetSummary.total_rows != null && (
                      <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Total Rows</p>
                        <p className="text-lg font-bold text-white">{datasetSummary.total_rows.toLocaleString()}</p>
                      </div>
                    )}
                    {datasetSummary.n_by_arm && (
                      <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">N by Arm</p>
                        {Object.entries(datasetSummary.n_by_arm).map(([arm, n]: [string, any]) => (
                          <p key={arm} className="text-xs text-gray-600 dark:text-gray-300"><span className="font-mono text-white font-semibold">{n}</span> {arm}</p>
                        ))}
                      </div>
                    )}
                    {datasetSummary.columns_detected != null && (
                      <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Columns Detected</p>
                        <p className="text-lg font-bold text-white">{datasetSummary.columns_detected}</p>
                      </div>
                    )}
                    {datasetSummary.missingness != null && (
                      <div className="bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-3">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Missingness</p>
                        <p className="text-lg font-bold text-white">{typeof datasetSummary.missingness === 'number' ? `${(datasetSummary.missingness * 100).toFixed(1)}%` : datasetSummary.missingness}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Acknowledge Warnings */}
              {complianceStatus === 'CLEARED_WITH_WARNINGS' && !warningsAcknowledged && (
                <label className="flex items-start gap-2 cursor-pointer bg-amber-900/10 border border-amber-700/30 rounded-xl p-4">
                  <input
                    type="checkbox"
                    checked={warningsAcknowledged}
                    onChange={e => setWarningsAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span className="text-xs text-amber-300">I have reviewed all warnings and wish to proceed</span>
                </label>
              )}

              {/* Step 5: Run Analysis */}
              {(complianceStatus === 'CLEARED' || (complianceStatus === 'CLEARED_WITH_WARNINGS' && warningsAcknowledged)) && !analysisComplete && (
                <button
                  onClick={handleRunAnalysis}
                  disabled={analyzing}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-sm font-bold px-5 py-3 rounded-lg transition-colors"
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                  {analyzing ? 'Running statistical analysis on uploaded data...' : 'Analyze Uploaded Data'}
                </button>
              )}

              {/* Analysis Error Display */}
              {analysisError && !validationGateReport && (
                <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
                  <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                  <span className="text-sm text-red-400">{analysisError}</span>
                </div>
              )}

              {/* Validation Gate Report — shown when pre-analysis validator blocks */}
              {validationGateReport && (
                <ValidationGatePanel
                  validationReport={validationGateReport}
                  onDismiss={() => setValidationGateReport(null)}
                />
              )}

              {/* Analysis Complete Banner */}
              {analysisComplete && (
                <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Analysis complete. Results available in Effect Estimation.</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Evidence Source Summary */}
        {safeDataSources.length > 0 && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'PubMed', icon: BookOpen, count: safeDataSources.filter((s: any) => s.source_id?.startsWith('PMID') || s.source_type === 'PUBMED').length, color: 'text-blue-600 bg-blue-50' },
              { label: 'ClinicalTrials', icon: FlaskConical, count: safeDataSources.filter((s: any) => s.source_id?.startsWith('NCT') || s.source_type === 'CLINICALTRIALS').length, color: 'text-green-600 bg-green-50' },
              { label: 'OpenAlex', icon: Globe, count: safeDataSources.filter((s: any) => s.source_id?.startsWith('openalex_')).length, color: 'text-orange-600 bg-orange-50' },
              { label: 'Semantic Scholar', icon: GraduationCap, count: safeDataSources.filter((s: any) => s.source_id?.startsWith('ss_')).length, color: 'text-purple-600 bg-purple-50' },
              { label: 'BioGPT', icon: Brain, count: 0, color: 'text-pink-600 bg-pink-50' },
            ].map(src => (
              <div key={src.label} className={`rounded-lg p-3 ${src.color} flex flex-col items-center`}>
                <src.icon className="h-5 w-5 mb-1" />
                <span className="text-lg font-bold">{src.count}</span>
                <span className="text-[10px] font-medium">{src.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Data Sources', value: '3', sub: '2 claims · 1 EHR' },
            { label: 'Total Person-Years', value: '218K', sub: 'Across all sources' },
            { label: 'Study Window', value: '2018–2023', sub: '5-year observation' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {safeDataSources.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Database className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Upload patient data to see data source information.</p>
          </div>
        )}

        {/* Data sources */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Registered Data Sources</h2>
          <div className="space-y-3">
            {safeDataSources.map((src, i) => (
              <div key={i} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{src.name}</p>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#2563EB]/40 bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60a5fa]">
                        {src.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceBadge((src as any).source_id || '', (src as any).source_type || src.type).color}`}>
                        {getSourceBadge((src as any).source_id || '', (src as any).source_type || src.type).label}
                      </span>
                      {src.validated
                        ? <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold"><CheckCircle2 className="h-3 w-3" /> Validated</span>
                        : <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-300 font-bold"><Clock className="h-3 w-3" /> Pending</span>
                      }
                    </div>
                    <p className="text-xs text-gray-500">{src.coverage}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-600 font-mono">{src.hash}</p>
                    <p className="text-[9px] text-gray-600">{src.version}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {src.variables.map(v => (
                    <span key={v} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Validation checks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Data Quality Validation</h2>
            <span className="text-[10px] text-gray-500">
              {safeValidationChecks.filter(c => c.status === 'pass').length}/{safeValidationChecks.length} passed
            </span>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {safeValidationChecks.map((check, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i < safeValidationChecks.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''} hover:bg-gray-50 dark:bg-white/3 transition-colors`}>
                {statusIcon[check.status]}
                <div>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{check.check}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Provenance hash */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Cryptographic Provenance Chain</h2>
          <div className="bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-5 font-mono text-xs text-gray-500 dark:text-gray-400 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">DATASET_MANIFEST_HASH</span>
              <span className="text-emerald-400">sha256:9f2a1b3d4c8e7f6a…</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">EXTRACTION_SCRIPT_HASH</span>
              <span className="text-emerald-400">sha256:c4f1a8b2e3d7f9c0…</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">VALIDATION_REPORT_HASH</span>
              <span className="text-amber-600 dark:text-amber-300">sha256:PENDING — awaiting EHR validation</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">TIMESTAMP</span>
              <span className="text-gray-500 dark:text-gray-400">2026-03-15T14:22:07Z</span>
            </div>
          </div>
        </section>

        {/* SDTM Datasets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">SDTM Datasets</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Study Data Tabulation Model domains for regulatory submission</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateAllSdtm}
                disabled={sdtmLoading}
                className="flex items-center gap-1.5 text-xs text-gray-900 dark:text-white font-semibold transition-colors bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 px-3 py-1.5 rounded-lg"
              >
                {sdtmLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                Generate All
              </button>
              <button
                onClick={handleValidateSdtm}
                disabled={sdtmValidating}
                className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] hover:text-blue-300 font-semibold transition-colors bg-[#2563EB]/10 border border-[#2563EB]/30 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {sdtmValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Validate
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { domain: 'dm', name: 'DM', label: 'Demographics' },
              { domain: 'ae', name: 'AE', label: 'Adverse Events' },
              { domain: 'lb', name: 'LB', label: 'Laboratory Test Results' },
              { domain: 'vs', name: 'VS', label: 'Vital Signs' },
              { domain: 'ex', name: 'EX', label: 'Exposure' },
              { domain: 'ds', name: 'DS', label: 'Disposition' },
            ].map(ds => {
              const existing = sdtmDomains[ds.domain]
              const safeReports = Array.isArray(sdtmValidationReports) ? sdtmValidationReports : []
              const valReport = safeReports.find((r: any) => r.domain === ds.name)
              const validationStatus = valReport ? (valReport.valid ? 'valid' : 'invalid') : (existing ? 'generated' : 'pending')
              const statusBadge = validationStatus === 'valid'
                ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400'
                : validationStatus === 'invalid'
                ? 'bg-red-900/20 border-red-700/30 text-red-400'
                : validationStatus === 'generated'
                ? 'bg-[#2563EB]/10 border-[#2563EB]/30 text-[#2563EB] dark:text-[#60a5fa]'
                : 'bg-amber-900/20 border-amber-700/30 text-amber-600 dark:text-amber-300'
              return (
                <div key={ds.domain} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ds.name}</h3>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge}`}>
                      {validationStatus}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3">{ds.label}</p>
                  {existing?.records_count != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="font-mono text-gray-900 dark:text-white font-semibold">{existing.records_count.toLocaleString()}</span> records
                    </p>
                  )}
                  <button
                    onClick={() => handleGenerateSdtm(ds.domain)}
                    disabled={sdtmLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    {sdtmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {existing ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ADaM Datasets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">ADaM Datasets</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Analysis Data Model datasets for regulatory submission</p>
            </div>
            <button
              onClick={handleValidateAll}
              disabled={adamValidating}
              className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] hover:text-blue-300 font-semibold transition-colors bg-[#2563EB]/10 border border-[#2563EB]/30 px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {adamValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Validate All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { type: 'adsl', name: 'ADSL', label: 'Subject-Level Analysis Dataset' },
              { type: 'adae', name: 'ADAE', label: 'Adverse Event Analysis Dataset' },
              { type: 'adtte', name: 'ADTTE', label: 'Time-to-Event Analysis Dataset' },
            ].map(ds => {
              const existing = safeAdamDatasets.find((d: any) => d.type === ds.type || d.name === ds.name)
              const validationStatus = existing?.validation_status || 'pending'
              const statusBadge = validationStatus === 'valid'
                ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400'
                : validationStatus === 'invalid'
                ? 'bg-red-900/20 border-red-700/30 text-red-400'
                : 'bg-amber-900/20 border-amber-700/30 text-amber-600 dark:text-amber-300'
              return (
                <div key={ds.type} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ds.name}</h3>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge}`}>
                      {validationStatus}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3">{ds.label}</p>
                  {existing?.record_count != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="font-mono text-gray-900 dark:text-white font-semibold">{existing.record_count.toLocaleString()}</span> records
                    </p>
                  )}
                  <button
                    onClick={() => handleGenerateAdam(ds.type)}
                    disabled={adamLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    {adamLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {existing ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <Link to={`/projects/${selectedStudy.id}/causal-framework`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 2: Causal Framework
          </Link>
          <Link to={`/projects/${selectedStudy.id}/cohort`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 4: Cohort Construction <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  )
}
