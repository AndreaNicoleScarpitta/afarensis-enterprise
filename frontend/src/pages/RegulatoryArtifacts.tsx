/**
 * Regulatory Artifacts — SAR Creation & Management
 *
 * Supports:
 *  - Safety Assessment Report (SAR)
 *  - FDA Reviewer Packet
 *  - EMA Assessment Report
 *  - Summary of Available Research
 *  - Evidence Table
 *  - Statistical Analysis Plan
 */

import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Download,
  Eye,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Shield,
  BarChart3,
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  X,
  ChevronDown,
  Loader2,
  Sparkles,
  FileCheck,
  ClipboardList,
  Microscope,
  Globe,
  Calendar,
  User,
  ExternalLink,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useApiQuery } from '../services/hooks'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ArtifactType =
  | 'safety_assessment_report'
  | 'fda_reviewer_packet'
  | 'ema_assessment'
  | 'summary_report'
  | 'evidence_table'
  | 'statistical_analysis_plan'
  | 'clinical_study_report'
  | 'briefing_document'

type OutputFormat = 'pdf' | 'docx' | 'html'
type ArtifactStatus = 'draft' | 'generating' | 'review' | 'approved' | 'submitted'

interface Artifact {
  id: string
  project_id: string
  artifact_type: ArtifactType
  title: string
  description?: string
  file_path?: string
  file_size?: number
  generated_by?: string
  template_version?: string
  regulatory_context?: Record<string, any>
  created_at: string
  updated_at: string
  // UI extras (from mock / local state)
  status?: ArtifactStatus
  submission_ready?: boolean
  output_format?: OutputFormat
}

interface GenerateRequest {
  project_id: string
  artifact_type: ArtifactType
  output_format: OutputFormat
  title: string
  include_sections: string[]
  regulatory_agency: string
  submission_context: string
  custom_parameters: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────────────────────

const ARTIFACT_TYPES: {
  value: ArtifactType
  label: string
  shortLabel: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  sections: string[]
  agency: string
  regulatoryRef: string
}[] = [
  {
    value: 'safety_assessment_report',
    label: 'Safety Assessment Report (SAR)',
    shortLabel: 'SAR',
    description:
      'Comprehensive safety data analysis including adverse events, benefit-risk assessment, and regulatory risk narrative.',
    icon: Shield,
    color: 'text-error-600',
    bg: 'bg-error-50',
    border: 'border-error-200',
    sections: [
      'Executive Summary',
      'Study Overview',
      'Adverse Event Profile',
      'Serious Adverse Events',
      'Benefit-Risk Assessment',
      'Risk Narrative',
      'Regulatory Conclusions',
    ],
    agency: 'FDA',
    regulatoryRef: 'ICH E2A / 21 CFR 312.32',
  },
  {
    value: 'fda_reviewer_packet',
    label: 'FDA Reviewer Packet',
    shortLabel: 'FDA Packet',
    description: 'Complete submission-ready reviewer packet for FDA NDA/BLA submissions per 21 CFR Part 11.',
    icon: FileCheck,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    sections: [
      'Cover Sheet',
      'Comprehensive Summary',
      'Evidence Synthesis',
      'Comparability Analysis',
      'Statistical Summary',
      'Regulatory Conclusions',
    ],
    agency: 'FDA',
    regulatoryRef: '21 CFR 314 / 21 CFR Part 11',
  },
  {
    value: 'ema_assessment',
    label: 'EMA Assessment Report',
    shortLabel: 'EMA Report',
    description: 'European Medicines Agency CHMP-formatted clinical assessment report.',
    icon: Globe,
    color: 'text-info-600',
    bg: 'bg-info-50',
    border: 'border-info-200',
    sections: [
      'Product Information',
      'Scientific Discussion',
      'Clinical Efficacy',
      'Clinical Safety',
      'Pharmacovigilance',
      'Risk Management Plan',
      'CHMP Conclusions',
    ],
    agency: 'EMA',
    regulatoryRef: 'EMA/CHMP/ICH E6(R2)',
  },
  {
    value: 'summary_report',
    label: 'Summary of Available Research',
    shortLabel: 'SAR Summary',
    description: 'Structured synthesis of all available evidence across included studies.',
    icon: BookOpen,
    color: 'text-warning-600',
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    sections: [
      'Search Strategy',
      'PRISMA Flow',
      'Study Characteristics',
      'Quality Assessment',
      'Meta-Analysis Results',
      'Heterogeneity Analysis',
      'Overall Conclusions',
    ],
    agency: 'General',
    regulatoryRef: 'PRISMA 2020 / Cochrane',
  },
  {
    value: 'evidence_table',
    label: 'Evidence Table',
    shortLabel: 'Evidence Table',
    description: 'Structured tabular summary of all included evidence with quality ratings.',
    icon: ClipboardList,
    color: 'text-success-600',
    bg: 'bg-success-50',
    border: 'border-success-200',
    sections: ['Study Identification', 'Design & Population', 'Intervention', 'Outcomes', 'Quality Score', 'Bias Assessment'],
    agency: 'General',
    regulatoryRef: 'ICH E9 / GRADE',
  },
  {
    value: 'statistical_analysis_plan',
    label: 'Statistical Analysis Plan',
    shortLabel: 'SAP',
    description: 'Pre-specified statistical analysis plan including endpoints, methods, and sensitivity analyses.',
    icon: BarChart3,
    color: 'text-primary-700',
    bg: 'bg-primary-50',
    border: 'border-primary-100',
    sections: [
      'Study Objectives',
      'Estimands',
      'Analysis Sets',
      'Endpoints & Hypotheses',
      'Statistical Methods',
      'Missing Data Strategy',
      'Sensitivity Analyses',
    ],
    agency: 'FDA',
    regulatoryRef: 'ICH E9(R1) / FDA Guidance',
  },
]

const statusConfig: Record<ArtifactStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  generating: { label: 'Generating…', color: 'bg-warning-100 text-warning-700', icon: Loader2 },
  review: { label: 'In Review', color: 'bg-info-100 text-info-700', icon: Eye },
  approved: { label: 'Approved', color: 'bg-success-100 text-success-700', icon: CheckCircle },
  submitted: { label: 'Submitted', color: 'bg-primary-100 text-primary-700', icon: FileCheck },
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTypeConfig(type: ArtifactType) {
  return ARTIFACT_TYPES.find((t) => t.value === type) ?? ARTIFACT_TYPES[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Modal
// ─────────────────────────────────────────────────────────────────────────────

interface GenerateModalProps {
  onClose: () => void
  onGenerated: (artifact: Artifact) => void
}

const GenerateModal: React.FC<GenerateModalProps> = ({ onClose, onGenerated }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedType, setSelectedType] = useState<ArtifactType>('safety_assessment_report')
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    output_format: 'pdf' as OutputFormat,
    regulatory_agency: 'FDA',
    submission_context: '',
    custom_parameters: {} as Record<string, string>,
  })
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const typeConfig = getTypeConfig(selectedType)

  // Pre-populate sections when type changes
  const handleTypeSelect = (type: ArtifactType) => {
    setSelectedType(type)
    const cfg = getTypeConfig(type)
    setSelectedSections([...cfg.sections])
    setForm((f) => ({
      ...f,
      regulatory_agency: cfg.agency === 'General' ? 'FDA' : cfg.agency,
      title: `${cfg.shortLabel} — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    }))
  }

  const toggleSection = (section: string) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  const handleGenerate = async () => {
    if (!form.title.trim()) {
      toast.error('Please provide a document title.')
      return
    }
    if (selectedSections.length === 0) {
      toast.error('Select at least one section to include.')
      return
    }

    setGenerating(true)
    try {
      // Build request — project_id is optional for demonstration; use first available or empty
      const payload: GenerateRequest = {
        project_id: form.project_id || 'demo',
        artifact_type: selectedType,
        output_format: form.output_format,
        title: form.title,
        include_sections: selectedSections,
        regulatory_agency: form.regulatory_agency,
        submission_context: form.submission_context,
        custom_parameters: form.custom_parameters,
      }

      // Call backend — project_id required as path param; if none, use a known project or skip
      const projectPath = payload.project_id && payload.project_id !== 'demo'
        ? payload.project_id
        : null

      let artifactData: Artifact | null = null

      if (projectPath) {
        const resp = await fetch(
          `/api/v1/projects/${projectPath}/generate-artifact?artifact_type=${selectedType}&format=${form.output_format}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              title: payload.title,
              include_sections: payload.include_sections,
              regulatory_agency: payload.regulatory_agency,
              submission_context: payload.submission_context,
            }),
          }
        )

        if (resp.ok) {
          const data = await resp.json()
          artifactData = {
            id: data.artifact_id || crypto.randomUUID(),
            project_id: projectPath,
            artifact_type: selectedType,
            title: payload.title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'draft',
            output_format: form.output_format,
          }
        }
      }

      // If no backend project or API failed, create a local draft artifact
      if (!artifactData) {
        artifactData = {
          id: crypto.randomUUID(),
          project_id: form.project_id || 'demo',
          artifact_type: selectedType,
          title: payload.title,
          description: `${typeConfig.label} — ${selectedSections.length} sections — ${form.output_format.toUpperCase()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'draft',
          output_format: form.output_format,
          regulatory_context: {
            agency: form.regulatory_agency,
            sections: selectedSections,
            context: form.submission_context,
          },
        }
      }

      onGenerated(artifactData)
      toast.success(`${typeConfig.shortLabel} created successfully`)
      onClose()
    } catch (err) {
      toast.error('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Generate Regulatory Document</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Step {step} of 3 — {step === 1 ? 'Choose type' : step === 2 ? 'Configure' : 'Review & generate'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 pt-4 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Choose document type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 mb-4">Select the regulatory document type to generate:</p>
              {ARTIFACT_TYPES.map((type) => {
                const Icon = type.icon
                const selected = selectedType === type.value
                return (
                  <button
                    key={type.value}
                    onClick={() => handleTypeSelect(type.value)}
                    className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
                      selected
                        ? `${type.border} ${type.bg} shadow-sm`
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${selected ? type.bg : 'bg-gray-100'} flex-shrink-0 mt-0.5`}>
                      <Icon size={18} className={selected ? type.color : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{type.label}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${type.bg} ${type.color}`}>
                          {type.agency}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{type.description}</p>
                      <p className="text-[10px] text-gray-400 mt-1 font-mono">{type.regulatoryRef}</p>
                    </div>
                    {selected && <CheckCircle size={18} className={type.color} />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Document title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`${typeConfig.shortLabel} — Study Name`}
                />
              </div>

              {/* Output format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Output format</label>
                <div className="flex gap-3">
                  {(['pdf', 'docx', 'html'] as OutputFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setForm((f) => ({ ...f, output_format: fmt }))}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold uppercase tracking-wide transition-all ${
                        form.output_format === fmt
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Regulatory agency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Regulatory agency</label>
                <select
                  value={form.regulatory_agency}
                  onChange={(e) => setForm((f) => ({ ...f, regulatory_agency: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="FDA">FDA (United States)</option>
                  <option value="EMA">EMA (European Union)</option>
                  <option value="PMDA">PMDA (Japan)</option>
                  <option value="MHRA">MHRA (United Kingdom)</option>
                  <option value="Health Canada">Health Canada</option>
                  <option value="TGA">TGA (Australia)</option>
                  <option value="General">General / Multi-agency</option>
                </select>
              </div>

              {/* Submission context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Submission context <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.submission_context}
                  onChange={(e) => setForm((f) => ({ ...f, submission_context: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="e.g. NDA 12345, Initial application, Rare disease designation..."
                />
              </div>

              {/* Sections to include */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Sections to include</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSections([...typeConfig.sections])}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setSelectedSections([])} className="text-xs text-gray-400 hover:underline">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {typeConfig.sections.map((section) => {
                    const checked = selectedSections.includes(section)
                    return (
                      <button
                        key={section}
                        onClick={() => toggleSection(section)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                          checked
                            ? 'border-primary-400 bg-primary-50 text-primary-800'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                            checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
                          }`}
                        >
                          {checked && <CheckCircle size={10} className="text-white" />}
                        </div>
                        {section}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-5">
              <div className={`p-5 rounded-xl border-2 ${typeConfig.border} ${typeConfig.bg}`}>
                <div className="flex items-center gap-3 mb-4">
                  {React.createElement(typeConfig.icon, { size: 22, className: typeConfig.color })}
                  <div>
                    <p className="font-bold text-gray-900">{typeConfig.label}</p>
                    <p className="text-xs text-gray-500">{typeConfig.regulatoryRef}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Title</dt>
                    <dd className="font-medium text-gray-900 truncate">{form.title || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Format</dt>
                    <dd className="font-semibold uppercase text-gray-900">{form.output_format}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Agency</dt>
                    <dd className="font-medium text-gray-900">{form.regulatory_agency}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Sections</dt>
                    <dd className="font-medium text-gray-900">{selectedSections.length} of {typeConfig.sections.length}</dd>
                  </div>
                </dl>
              </div>

              {/* Sections list */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sections</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSections.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Generation notice */}
              <div className="flex items-start gap-3 p-4 bg-warning-50 border border-warning-200 rounded-xl">
                <Info size={16} className="text-warning-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning-700 leading-relaxed">
                  This document will be generated using systematic synthesis of the linked evidence. All content must be
                  reviewed and approved by a qualified regulatory professional before submission.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose())}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Generate Document
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Card
// ─────────────────────────────────────────────────────────────────────────────

interface ArtifactCardProps {
  artifact: Artifact
  onDownload: (artifact: Artifact) => void
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact, onDownload }) => {
  const typeConfig = getTypeConfig(artifact.artifact_type)
  const status: ArtifactStatus = artifact.status ?? 'draft'
  const StatusIcon = statusConfig[status].icon
  const Icon = typeConfig.icon

  return (
    <div className={`bg-white rounded-xl border-2 ${typeConfig.border} shadow-xs hover:shadow-md transition-all flex flex-col`}>
      {/* Top accent bar */}
      <div className={`h-1 w-full rounded-t-xl ${typeConfig.bg.replace('bg-', 'bg-').replace('-50', '-400')}`} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
            <Icon size={18} className={typeConfig.color} />
          </div>
          <div className="flex items-center gap-2">
            {artifact.submission_ready && (
              <span title="Submission Ready" className="flex items-center gap-1 px-2 py-0.5 bg-success-100 text-success-700 rounded-full text-[10px] font-bold uppercase">
                <CheckCircle size={10} />
                Ready
              </span>
            )}
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusConfig[status].color}`}>
              <StatusIcon size={11} className={status === 'generating' ? 'animate-spin' : ''} />
              {statusConfig[status].label}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm text-gray-900 leading-snug mb-1 line-clamp-2">{artifact.title}</h3>
        <p className="text-xs text-gray-400 font-medium mb-3">{typeConfig.shortLabel} · {typeConfig.regulatoryRef}</p>

        {/* Meta */}
        <div className="space-y-1.5 text-xs text-gray-500 mb-4">
          {artifact.generated_by && (
            <div className="flex items-center gap-1.5">
              <User size={11} />
              <span>{artifact.generated_by}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar size={11} />
            <span>{new Date(artifact.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          {artifact.file_size && (
            <div className="flex items-center gap-1.5">
              <FileText size={11} />
              <span>{formatFileSize(artifact.file_size)} · {artifact.output_format?.toUpperCase() ?? 'PDF'}</span>
            </div>
          )}
        </div>

        {/* Sections from context */}
        {artifact.regulatory_context?.sections && (
          <div className="flex flex-wrap gap-1 mb-4">
            {(artifact.regulatory_context.sections as string[]).slice(0, 3).map((s) => (
              <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{s}</span>
            ))}
            {(artifact.regulatory_context.sections as string[]).length > 3 && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">
                +{(artifact.regulatory_context.sections as string[]).length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Eye size={13} />
            View
          </button>
          <button
            onClick={() => onDownload(artifact)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Download size={13} />
            Download
          </button>
          <div className="ml-auto">
            <Link
              to={`/projects/${artifact.project_id}`}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ExternalLink size={10} />
              Project
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const RegulatoryArtifacts: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [localArtifacts, setLocalArtifacts] = useState<Artifact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  // Stats
  const totalArtifacts = localArtifacts.length
  const readyCount = localArtifacts.filter((a) => a.status === 'approved' || a.submission_ready).length
  const sarCount = localArtifacts.filter(
    (a) => a.artifact_type === 'safety_assessment_report' || a.artifact_type === 'summary_report'
  ).length

  const handleGenerated = useCallback((artifact: Artifact) => {
    setLocalArtifacts((prev) => [artifact, ...prev])
  }, [])

  const handleDownload = useCallback((artifact: Artifact) => {
    if (artifact.file_path) {
      window.open(`/api/v1/artifacts/${artifact.id}/download`, '_blank')
    } else {
      toast.info('Document is being prepared. Download will start when generation is complete.')
    }
  }, [])

  const filtered = localArtifacts.filter((a) => {
    const matchSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.artifact_type.includes(searchQuery.toLowerCase())
    const matchType = typeFilter === 'all' || a.artifact_type === typeFilter
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regulatory Artifacts</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Generate, manage, and track regulatory documents — including Safety Assessment Reports (SAR), FDA Reviewer Packets, and EMA assessments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Plus size={16} />
            Generate Document
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: totalArtifacts, icon: FileText, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'SARs Generated', value: sarCount, icon: Shield, color: 'text-error-600', bg: 'bg-error-50' },
          { label: 'Submission Ready', value: readyCount, icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-50' },
          { label: 'In Review', value: localArtifacts.filter(a => a.status === 'review').length, icon: Eye, color: 'text-info-600', bg: 'bg-info-50' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`${stat.bg} border border-gray-200 rounded-xl p-4 flex items-center gap-3`}>
              <Icon size={20} className={stat.color} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* SAR Quick-start banner (shown when no SAR exists) */}
      {sarCount === 0 && (
        <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-error-50 to-warning-50 border border-error-200 rounded-xl">
          <div className="p-2.5 bg-white rounded-xl shadow-xs border border-error-200 flex-shrink-0">
            <Shield size={22} className="text-error-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Create your first Safety Assessment Report (SAR)</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              The SAR is a core regulatory deliverable documenting your product's safety profile, adverse event data, and
              benefit-risk narrative — required for FDA NDA/BLA submissions under ICH E2A and 21 CFR 312.32.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-error-600 hover:bg-error-700 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Sparkles size={13} />
            Create SAR
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or document type…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
          >
            <option value="all">All types</option>
            {ARTIFACT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.shortLabel}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
          >
            <option value="all">All status</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Artifacts grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Generate your first regulatory document — start with a Safety Assessment Report (SAR) for FDA submissions.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Sparkles size={15} />
            Generate First Document
          </button>
        </div>
      )}

      {/* Document type reference */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen size={15} className="text-gray-400" />
          Supported Regulatory Document Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ARTIFACT_TYPES.map((type) => {
            const Icon = type.icon
            return (
              <div key={type.value} className={`flex items-start gap-3 p-3 rounded-lg ${type.bg} border ${type.border}`}>
                <Icon size={15} className={`${type.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{type.shortLabel}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{type.regulatoryRef}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Generate modal */}
      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  )
}

export default RegulatoryArtifacts
