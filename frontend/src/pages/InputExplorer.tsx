import React, { useState } from 'react'
import {
  Database, Lock, Eye, ChevronDown, ChevronRight, Search,
  Table2, Grid3X3, BarChart3, AlertTriangle, CheckCircle2,
  FileText, Link2, Clock, Shield, Hash, Layers, ArrowRight,
  Activity, TrendingUp, Tag, Box, Fingerprint,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useLineage } from '../context/LineageContext'
import type { DataSource, FieldDefinition } from '../types/lineage'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function missingnessColor(rate: number): string {
  if (rate < 0.05) return 'bg-emerald-500'
  if (rate < 0.20) return 'bg-amber-500'
  return 'bg-red-500'
}

function missingnessLabel(rate: number): string {
  if (rate < 0.05) return 'text-emerald-400'
  if (rate < 0.20) return 'text-amber-600 dark:text-amber-300'
  return 'text-red-400'
}

function sourceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    edc: 'Electronic Data Capture',
    ehr: 'EHR / Claims',
    claims: 'Claims',
    registry: 'Disease Registry',
    lab: 'Lab Systems',
    imaging: 'Imaging',
    unstructured: 'Unstructured',
  }
  return map[type] || type
}

function sourceTypeBadgeColor(type: string): string {
  const map: Record<string, string> = {
    edc: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    ehr: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    claims: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    registry: 'bg-teal-900/40 text-teal-300 border-teal-700/40',
  }
  return map[type] || 'bg-gray-800/40 text-gray-600 dark:text-gray-300 border-gray-700/40'
}

// ─── Demo quality data ───────────────────────────────────────────────────────

const DUPLICATE_CHECKS = [
  { source: 'XY-301 EDC', check: 'SUBJID uniqueness', result: 'pass' as const, detail: '0 duplicates across 312 subjects' },
  { source: 'PedNeuro Claims', check: 'PAT_ID uniqueness per encounter', result: 'pass' as const, detail: '0 duplicate encounter records' },
  { source: 'Cross-source linkage', check: 'Deterministic linkage token overlap', result: 'warning' as const, detail: '14 patients appear in both EDC and Claims (expected — trial participants)' },
  { source: 'ICORD Registry', check: 'Registry ID uniqueness', result: 'pass' as const, detail: '0 duplicates across 1,847 registry entries' },
]

const CODING_TIMELINE = [
  { system: 'ICD-10-CM', version: 'FY2023', start: '2022-10-01', end: '2023-09-30', status: 'archived' as const },
  { system: 'ICD-10-CM', version: 'FY2024', start: '2023-10-01', end: '2024-09-30', status: 'archived' as const },
  { system: 'ICD-10-CM', version: 'FY2025', start: '2024-10-01', end: '2025-09-30', status: 'active' as const },
  { system: 'MedDRA', version: '25.1', start: '2022-09-01', end: '2023-09-30', status: 'archived' as const },
  { system: 'MedDRA', version: '26.1', start: '2023-09-01', end: '2025-12-31', status: 'active' as const },
  { system: 'SNOMED CT', version: '2023-09-01', start: '2023-09-01', end: '2024-08-31', status: 'archived' as const },
  { system: 'SNOMED CT', version: '2024-09-01', start: '2024-09-01', end: '2025-08-31', status: 'active' as const },
]

const RECORD_TRENDS = [
  { period: 'Q1 2024', edc: 0, claims: 241802, registry: 1712 },
  { period: 'Q2 2024', edc: 2841, claims: 251340, registry: 1742 },
  { period: 'Q3 2024', edc: 6218, claims: 261019, registry: 1778 },
  { period: 'Q4 2024', edc: 9470, claims: 270488, registry: 1803 },
  { period: 'Q1 2025', edc: 12104, claims: 278902, registry: 1825 },
  { period: 'Q2 2025', edc: 14829, claims: 287491, registry: 1847 },
]

const PROVENANCE_RECORDS = [
  { recordId: 'SUBJ-001', pointerType: 'edc' as const, source: 'XY-301 EDC / DM domain', linkageToken: 'LNK-7a3f9d', extractionDate: '2025-08-01', modifications: 0 },
  { recordId: 'SUBJ-002', pointerType: 'edc' as const, source: 'XY-301 EDC / DM domain', linkageToken: 'LNK-8b4e0c', extractionDate: '2025-08-01', modifications: 1 },
  { recordId: 'PAT-10041', pointerType: 'ehr' as const, source: 'PedNeuro Claims / DX table', linkageToken: 'LNK-2c5f1a', extractionDate: '2025-07-15', modifications: 0 },
  { recordId: 'PAT-10042', pointerType: 'ehr' as const, source: 'PedNeuro Claims / RX table', linkageToken: 'LNK-3d6g2b', extractionDate: '2025-07-15', modifications: 0 },
  { recordId: 'REG-0847', pointerType: 'registry' as const, source: 'ICORD / Longitudinal outcomes', linkageToken: 'LNK-4e7h3c', extractionDate: '2025-06-01', modifications: 2 },
  { recordId: 'PAT-10099', pointerType: 'ehr' as const, source: 'PedNeuro Claims / Enrollment', linkageToken: 'LNK-5f8i4d', extractionDate: '2025-07-15', modifications: 0 },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function InputExplorer({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { dataSources, datasetVersions, variableDefinitions, isDemoData } = useLineage()

  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [expandedVar, setExpandedVar] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'registry' | 'variables' | 'quality' | 'provenance'>('registry')

  // Pair sources with their dataset versions
  const getDatasetForSource = (sourceId: string) =>
    datasetVersions.find(dv => dv.dataSourceId === sourceId)

  const filteredVariables = variableDefinitions.filter(v =>
    !searchTerm ||
    v.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.varId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.conceptualDefinition.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Compute overall missingness heatmap data
  const allFields: { source: string; field: FieldDefinition }[] = []
  datasetVersions.forEach(dv => {
    const src = dataSources.find(ds => ds.id === dv.dataSourceId)
    dv.fields.forEach(f => {
      allFields.push({ source: src?.name || dv.dataSourceId, field: f })
    })
  })

  const maxTrend = Math.max(...RECORD_TRENDS.map(t => Math.max(t.edc, t.claims, t.registry)))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">

      {/* ── Sample Data Banner ────────────────────────────────────────────── */}
      {isDemoData && (
        <div className="bg-amber-900/30 border-b border-amber-700/40 px-8 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-300">
            SAMPLE DATA — The sources, schemas, and quality metrics below are illustrative reference data, not connected to a live data source.
          </span>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Database className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Input Explorer</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Data Source Inventory & Schema</h1>
              <p className="text-gray-500 text-xs mt-0.5">Source registry &middot; schema browser &middot; variable dictionary &middot; quality metrics</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Estimand: <span className="text-[#2563EB] dark:text-[#60a5fa] font-semibold">{selectedStudy.estimand}</span></p>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8">
        <div className="flex gap-0">
          {([
            { key: 'registry' as const, label: 'Source Registry', icon: Layers },
            { key: 'variables' as const, label: 'Variable Dictionary', icon: Tag },
            { key: 'quality' as const, label: 'Data Quality', icon: Activity },
            { key: 'provenance' as const, label: 'Provenance Pointers', icon: Fingerprint },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#2563EB] text-[#2563EB] dark:text-[#60a5fa]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: Source Registry                                           */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'registry' && (
          <>
            {/* ── Data Source Registry Table ──────────────────────────────── */}
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Data Source Registry</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{dataSources.length} Registered Sources</p>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-semibold">All sources validated</span>
                </div>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1.2fr_1fr_0.8fr_0.8fr_0.6fr_0.5fr] gap-3 px-5 py-2.5 bg-gray-200/60 dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <span>Source Name</span>
                <span>Type</span>
                <span>Coverage</span>
                <span>Refresh Policy</span>
                <span>Coding System</span>
                <span>Row Count</span>
                <span>Schema Hash</span>
                <span>Status</span>
              </div>

              {/* Table rows */}
              {dataSources.map((source: DataSource) => {
                const dv = getDatasetForSource(source.id)
                const isExpanded = expandedSource === source.id
                return (
                  <React.Fragment key={source.id}>
                    <div
                      className={`grid grid-cols-[2fr_1fr_1.2fr_1fr_0.8fr_0.8fr_0.6fr_0.5fr] gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-white/6 hover:bg-gray-200/40 dark:hover:bg-gray-50 dark:bg-white/[0.03] transition-colors cursor-pointer items-center`}
                      onClick={() => setExpandedSource(isExpanded ? null : source.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{source.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{source.owner}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sourceTypeBadgeColor(source.type)}`}>
                          {sourceTypeLabel(source.type)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400">
                        {formatDate(source.coverageStart)} — {formatDate(source.coverageEnd)}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{source.refreshPolicy.split(';')[0]}</div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400">
                        {source.codingSystem || '—'}
                        {source.codingVersion && <span className="text-gray-500 ml-1">v{source.codingVersion}</span>}
                      </div>
                      <div className="text-xs font-mono text-gray-700 dark:text-gray-300">
                        {dv ? dv.rowCount.toLocaleString() : '—'}
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 truncate">
                        {dv ? dv.schemaHash.slice(0, 16) + '...' : '—'}
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/40">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Active
                        </span>
                      </div>
                    </div>

                    {/* ── Schema Browser Panel (expanded) ────────────────────── */}
                    {isExpanded && dv && (
                      <div className="border-t border-gray-200 dark:border-white/6 bg-gray-50 dark:bg-white/[0.02] px-8 py-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Table2 className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                          <p className="text-sm font-bold text-gray-900 dark:text-white">Schema Browser</p>
                          <span className="text-[10px] text-gray-500 ml-2">{dv.fields.length} fields &middot; v{dv.version} &middot; {dv.rowCount.toLocaleString()} rows &middot; {dv.columnCount} columns</span>
                        </div>

                        <div className="border border-gray-200 dark:border-white/8 rounded-lg overflow-hidden">
                          {/* Schema header */}
                          <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_0.6fr_1fr_0.8fr_1fr] gap-3 px-4 py-2 bg-gray-200/60 dark:bg-white/[0.04] text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            <span>Field Name</span>
                            <span>Type</span>
                            <span>Units</span>
                            <span>Code System</span>
                            <span>Missingness</span>
                            <span>Distinct Values</span>
                            <span>Plausibility Range</span>
                          </div>

                          {dv.fields.map((field: FieldDefinition, idx: number) => (
                            <div
                              key={field.name}
                              className={`grid grid-cols-[1.5fr_0.8fr_0.6fr_0.6fr_1fr_0.8fr_1fr] gap-3 px-4 py-2.5 border-t border-gray-200 dark:border-white/6 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-100/50 dark:bg-white/[0.02]'}`}
                            >
                              <div>
                                <p className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{field.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{field.description}</p>
                              </div>
                              <div className="text-[11px] text-gray-600 dark:text-gray-400 capitalize">{field.type}</div>
                              <div className="text-[11px] text-gray-500">{field.units || '—'}</div>
                              <div className="text-[10px] text-gray-500 truncate">{field.codeSystem || '—'}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-300 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${missingnessColor(field.missingnessRate)}`}
                                    style={{ width: `${Math.max(field.missingnessRate * 100, 1)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-semibold tabular-nums ${missingnessLabel(field.missingnessRate)}`}>
                                  {(field.missingnessRate * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="text-xs font-mono text-gray-600 dark:text-gray-400">{field.distinctValues.toLocaleString()}</div>
                              <div className="text-[11px] text-gray-500">
                                {field.plausibilityMin !== undefined && field.plausibilityMax !== undefined
                                  ? `${field.plausibilityMin} — ${field.plausibilityMax}`
                                  : '—'}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Source metadata */}
                        <div className="mt-4 grid grid-cols-4 gap-4">
                          <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Contract ID</p>
                            <p className="text-xs font-mono text-gray-700 dark:text-gray-300">{source.contractId || '—'}</p>
                          </div>
                          <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Content Hash</p>
                            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{dv.contentHash}</p>
                          </div>
                          <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Lock Status</p>
                            <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              {dv.lockStatus} {dv.lockedAt && `on ${formatDate(dv.lockedAt)}`}
                            </p>
                          </div>
                          <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Refresh Policy</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{source.refreshPolicy}</p>
                          </div>
                        </div>

                        {/* Source description */}
                        <div className="mt-3 p-3 bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Description</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{source.description}</p>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: Variable Dictionary                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'variables' && (
          <div>
            {/* Search bar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search variables by name, ID, or definition..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB]/40"
                />
              </div>
              <p className="text-[10px] text-gray-500">{filteredVariables.length} of {variableDefinitions.length} variables</p>
            </div>

            {/* Variable cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVariables.map(v => {
                const isExpanded = expandedVar === v.id
                // Compute aggregate missingness from matching dataset fields
                const matchingFields = allFields.filter(af => af.field.name === v.varId)
                const avgMissingness = matchingFields.length > 0
                  ? matchingFields.reduce((sum, af) => sum + af.field.missingnessRate, 0) / matchingFields.length
                  : 0

                return (
                  <div
                    key={v.id}
                    className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden"
                  >
                    <div
                      className="px-4 py-3.5 cursor-pointer hover:bg-gray-200/40 dark:hover:bg-gray-50 dark:bg-white/[0.03] transition-colors"
                      onClick={() => setExpandedVar(isExpanded ? null : v.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono font-bold text-[#2563EB] dark:text-[#60a5fa]">{v.varId}</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{v.label}</p>
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {/* Type badge */}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-400">
                          {v.derivationSteps.length > 1 ? 'Derived' : 'Direct'}
                        </span>
                        {/* Missingness */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${avgMissingness < 0.05 ? 'bg-emerald-900/30 text-emerald-400' : avgMissingness < 0.2 ? 'bg-amber-900/30 text-amber-600 dark:text-amber-300' : 'bg-red-900/30 text-red-400'}`}>
                          {(avgMissingness * 100).toFixed(1)}% missing
                        </span>
                        {/* Lock status */}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${v.lockStatus === 'locked' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-600 dark:text-amber-300'}`}>
                          <Lock className="h-2.5 w-2.5" />
                          {v.lockStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2 line-clamp-2">{v.conceptualDefinition}</p>
                    </div>

                    {/* Expanded derivation chain */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-white/8 px-4 py-4 bg-gray-50 dark:bg-white/[0.02]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Derivation Chain</p>
                        <div className="space-y-2">
                          {v.derivationSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                              <div className="flex flex-col items-center">
                                <div className="w-5 h-5 rounded-full bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center text-[9px] font-bold text-[#2563EB] dark:text-[#60a5fa]">{step.order}</div>
                                {idx < v.derivationSteps.length - 1 && <div className="w-px h-6 bg-gray-300 dark:bg-white/10 mt-1" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white">{step.description}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  <span className="font-mono">{step.function}</span>
                                  <span className="mx-1.5">&middot;</span>
                                  In: <span className="font-mono">{step.inputs.join(', ')}</span>
                                  <span className="mx-1.5"><ArrowRight className="h-2.5 w-2.5 inline" /></span>
                                  Out: <span className="font-mono">{step.outputs.join(', ')}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Operational definition */}
                        <div className="mt-4 p-3 bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Operational Definition</p>
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{v.operationalDefinition}</p>
                        </div>

                        {/* Validation refs */}
                        {v.validationRefs.length > 0 && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <FileText className="h-3 w-3 text-gray-500" />
                            {v.validationRefs.map((ref, i) => (
                              <span key={i} className="text-[10px] text-gray-500 bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded">{ref}</span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
                          <span>v{v.version}</span>
                          <span>&middot;</span>
                          <span>{v.createdBy}</span>
                          <span>&middot;</span>
                          <span>{formatDate(v.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: Data Quality Dashboard                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'quality' && (
          <div className="space-y-6">

            {/* ── Overall Missingness Heatmap ─────────────────────────────── */}
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Missingness Overview</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Field-Level Completeness Across All Sources</p>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-[180px_repeat(3,1fr)] gap-1 text-[10px]">
                  {/* Column headers */}
                  <div className="font-bold text-gray-500 uppercase tracking-widest py-1">Field</div>
                  {dataSources.map(ds => (
                    <div key={ds.id} className="font-bold text-gray-500 uppercase tracking-widest py-1 text-center truncate px-1">{ds.name.split(' ')[0]}</div>
                  ))}

                  {/* Aggregate unique field names across all datasets */}
                  {(() => {
                    const fieldNames = Array.from(new Set(datasetVersions.flatMap(dv => dv.fields.map(f => f.name))))
                    return fieldNames.slice(0, 15).map(fname => (
                      <React.Fragment key={fname}>
                        <div className="font-mono text-gray-700 dark:text-gray-300 py-1.5 truncate">{fname}</div>
                        {dataSources.map(ds => {
                          const dv = datasetVersions.find(d => d.dataSourceId === ds.id)
                          const field = dv?.fields.find(f => f.name === fname)
                          if (!field) {
                            return <div key={ds.id} className="flex items-center justify-center py-1.5"><span className="w-full h-5 rounded bg-gray-200 dark:bg-white/5 flex items-center justify-center text-[9px] text-gray-500 dark:text-gray-400">N/A</span></div>
                          }
                          const pct = field.missingnessRate * 100
                          const bg = pct === 0 ? 'bg-emerald-500/20 text-emerald-400' : pct < 5 ? 'bg-emerald-500/30 text-emerald-400' : pct < 10 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : pct < 20 ? 'bg-amber-500/30 text-amber-600 dark:text-amber-300' : 'bg-red-500/30 text-red-400'
                          return <div key={ds.id} className="flex items-center justify-center py-1.5"><span className={`w-full h-5 rounded flex items-center justify-center text-[9px] font-semibold ${bg}`}>{pct.toFixed(1)}%</span></div>
                        })}
                      </React.Fragment>
                    ))
                  })()}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-200 dark:border-white/6">
                  <span className="text-[10px] text-gray-500 font-semibold">Legend:</span>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500/30" /><span className="text-[10px] text-gray-500">&lt; 5%</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/30" /><span className="text-[10px] text-gray-500">5–20%</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500/30" /><span className="text-[10px] text-gray-500">&gt; 20%</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-200 dark:bg-white/5" /><span className="text-[10px] text-gray-500">N/A</span></div>
                </div>
              </div>
            </div>

            {/* ── Duplicate / Overlap Checks ──────────────────────────────── */}
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Integrity Checks</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Duplicate & Overlap Validation</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-white/6">
                {DUPLICATE_CHECKS.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-5 py-3">
                    {item.result === 'pass'
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{item.check}</p>
                        <span className="text-[10px] text-gray-500">{item.source}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.detail}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      item.result === 'pass' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-600 dark:text-amber-300'
                    }`}>
                      {item.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Coding System Timeline ──────────────────────────────────── */}
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Coding Systems</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Version Timeline & Currency</p>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-[1fr_0.8fr_1fr_1fr_0.6fr] gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <span>System</span>
                  <span>Version</span>
                  <span>Effective Start</span>
                  <span>Effective End</span>
                  <span>Status</span>
                </div>
                {CODING_TIMELINE.map((ct, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_0.8fr_1fr_1fr_0.6fr] gap-3 py-2 border-t border-gray-200 dark:border-white/6 items-center">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{ct.system}</span>
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{ct.version}</span>
                    <span className="text-[11px] text-gray-500">{formatDate(ct.start)}</span>
                    <span className="text-[11px] text-gray-500">{formatDate(ct.end)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-center ${
                      ct.status === 'active' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-200 dark:bg-white/10 text-gray-500'
                    }`}>
                      {ct.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Record Count Trends ─────────────────────────────────────── */}
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Growth Trajectory</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Record Count Trends by Source</p>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-[100px_repeat(3,1fr)] gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                  <span>Period</span>
                  <span>EDC</span>
                  <span>Claims / EHR</span>
                  <span>Registry</span>
                </div>
                {RECORD_TRENDS.map((t, idx) => (
                  <div key={idx} className="grid grid-cols-[100px_repeat(3,1fr)] gap-3 py-2 border-t border-gray-200 dark:border-white/6 items-center">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.period}</span>
                    {[t.edc, t.claims, t.registry].map((val, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-[#2563EB]' : i === 1 ? 'bg-purple-500' : 'bg-teal-500'}`}
                            style={{ width: `${(val / maxTrend) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 tabular-nums w-16 text-right">{val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Trend legend */}
                <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-200 dark:border-white/6">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#2563EB]" /><span className="text-[10px] text-gray-500">EDC</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500" /><span className="text-[10px] text-gray-500">Claims / EHR</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-teal-500" /><span className="text-[10px] text-gray-500">Registry</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB: Provenance Pointers                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'provenance' && (
          <div className="space-y-6">
            <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-white/8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Row-Level Provenance</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Record Origin Pointers & Linkage Tokens</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <Link2 className="h-3 w-3" />
                    <span>Every record is traceable to its source system</span>
                  </div>
                </div>
              </div>

              {/* Provenance table header */}
              <div className="grid grid-cols-[1fr_0.8fr_1.5fr_1fr_0.8fr_0.5fr] gap-3 px-5 py-2.5 bg-gray-200/60 dark:bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <span>Record ID</span>
                <span>Pointer Type</span>
                <span>Source System / Table</span>
                <span>Linkage Token</span>
                <span>Extraction Date</span>
                <span>Modifications</span>
              </div>

              {PROVENANCE_RECORDS.map((rec, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[1fr_0.8fr_1.5fr_1fr_0.8fr_0.5fr] gap-3 px-5 py-3 border-t border-gray-200 dark:border-white/6 items-center ${idx % 2 === 0 ? '' : 'bg-gray-50 dark:bg-white/[0.02]'}`}
                >
                  <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{rec.recordId}</span>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border w-fit ${sourceTypeBadgeColor(rec.pointerType)}`}>
                    {rec.pointerType.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{rec.source}</span>
                  <div className="flex items-center gap-1.5">
                    <Fingerprint className="h-3 w-3 text-[#2563EB] dark:text-[#60a5fa]" />
                    <span className="text-xs font-mono text-[#2563EB] dark:text-[#60a5fa]">{rec.linkageToken}</span>
                  </div>
                  <span className="text-[11px] text-gray-500">{formatDate(rec.extractionDate)}</span>
                  <div className="flex items-center justify-center">
                    {rec.modifications === 0 ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">0</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-600 dark:text-amber-300">{rec.modifications}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Provenance integrity summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Traceability Coverage</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">100%</p>
                <p className="text-[11px] text-gray-500 mt-1">All analytic records have a provenance pointer linking back to the originating source system and table.</p>
              </div>

              <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Linkage Tokens</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">4,530</p>
                <p className="text-[11px] text-gray-500 mt-1">Unique deterministic linkage tokens assigned. Cross-source linkage uses salted hashing — no direct identifiers stored.</p>
              </div>

              <div className="bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Modification Audit</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">23</p>
                <p className="text-[11px] text-gray-500 mt-1">Total post-extraction modifications logged across all records. Each modification is timestamped, attributed, and includes before/after values.</p>
              </div>
            </div>

            {/* Reviewer callout */}
            {reviewerMode && (
              <div className="bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
                  <p className="text-xs font-bold text-[#2563EB] dark:text-[#60a5fa]">Reviewer Note — Provenance Integrity</p>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  Every record in this study is traceable from the final analytic dataset back to its originating source system via deterministic provenance pointers.
                  Linkage tokens use salted SHA-256 hashing and no direct patient identifiers are stored in the analytic environment.
                  All post-extraction modifications are logged with actor, timestamp, reason, and before/after values per 21 CFR Part 11 requirements.
                  The provenance chain is auditable, reproducible, and tamper-evident through cryptographic hash chaining.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
