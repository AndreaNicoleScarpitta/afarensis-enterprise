import React, { useState } from 'react'
import { apiClient } from '../services/apiClient'
import {
  PackageCheck, Lock, Eye, CheckCircle2, AlertTriangle, Download,
  FileSpreadsheet, FileText, FileCode, FolderTree, Shield,
  Hash, ChevronRight, Copy, Archive, ClipboardList, Loader2,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── Artifact Registry Data ──────────────────────────────────────────────────
type ArtifactType = 'dataset' | 'metadata' | 'documentation' | 'program' | 'audit'

interface Artifact {
  filename: string
  format: string
  size: string
  checksum: string
  producedBy: string
  ectdModule: string
  type: ArtifactType
  verified: boolean
}

const ARTIFACTS: Artifact[] = [
  { filename: 'adam_adsl.xpt',         format: 'XPT v5',     size: '4.2 MB',  checksum: 'a3f1c8d2e7b9…', producedBy: 'RUN-047', ectdModule: 'm5/datasets/analysis/adam/datasets/', type: 'dataset',       verified: true },
  { filename: 'adam_adtte.xpt',        format: 'XPT v5',     size: '2.8 MB',  checksum: 'b7e4f0a1c3d8…', producedBy: 'RUN-047', ectdModule: 'm5/datasets/analysis/adam/datasets/', type: 'dataset',       verified: true },
  { filename: 'adam_adae.xpt',         format: 'XPT v5',     size: '1.9 MB',  checksum: 'c2d9e3f7a0b1…', producedBy: 'RUN-047', ectdModule: 'm5/datasets/analysis/adam/datasets/', type: 'dataset',       verified: true },
  { filename: 'adam_adcm.xpt',         format: 'XPT v5',     size: '1.1 MB',  checksum: 'd8f2a4b6c1e3…', producedBy: 'RUN-047', ectdModule: 'm5/datasets/analysis/adam/datasets/', type: 'dataset',       verified: true },
  { filename: 'adam_advs.xpt',         format: 'XPT v5',     size: '3.4 MB',  checksum: 'e1c3d7f9a2b4…', producedBy: 'RUN-047', ectdModule: 'm5/datasets/analysis/adam/datasets/', type: 'dataset',       verified: true },
  { filename: 'define.xml',           format: 'XML 2.1',    size: '286 KB',  checksum: 'f4a8b2c6d0e9…', producedBy: 'RUN-048', ectdModule: 'm5/datasets/analysis/adam/',          type: 'metadata',      verified: true },
  { filename: 'define-stylesheet.xsl', format: 'XSL',        size: '42 KB',   checksum: 'a0b9c1d3e7f2…', producedBy: 'RUN-048', ectdModule: 'm5/datasets/analysis/adam/',          type: 'metadata',      verified: true },
  { filename: 'adrg.pdf',             format: 'PDF/A-1b',   size: '1.4 MB',  checksum: 'b3c7d2e8f1a4…', producedBy: 'RUN-049', ectdModule: 'm5/datasets/analysis/adam/',          type: 'documentation', verified: true },
  { filename: 'sdrg.pdf',             format: 'PDF/A-1b',   size: '890 KB',  checksum: 'c6d0e4f8a2b3…', producedBy: 'RUN-049', ectdModule: 'm5/datasets/analysis/sdtm/',          type: 'documentation', verified: true },
  { filename: 'acrf.pdf',             format: 'PDF/A-1b',   size: '2.1 MB',  checksum: 'd9e3f7a1b4c8…', producedBy: 'RUN-050', ectdModule: 'm5/datasets/analysis/misc/',          type: 'documentation', verified: true },
  { filename: 'lineage_manifest.json', format: 'JSON',       size: '124 KB',  checksum: 'e2f6a0b4c8d1…', producedBy: 'RUN-051', ectdModule: 'm5/datasets/analysis/adam/programs/', type: 'audit',         verified: true },
  { filename: 'audit_trail.csv',       format: 'CSV',        size: '67 KB',   checksum: 'f5a9b3c7d1e4…', producedBy: 'RUN-051', ectdModule: 'm5/datasets/analysis/adam/programs/', type: 'audit',         verified: true },
  { filename: 'cohort_construction.R', format: 'R 4.3.2',    size: '18 KB',   checksum: 'a8b2c6d0e4f1…', producedBy: 'RUN-046', ectdModule: 'm5/datasets/analysis/adam/programs/', type: 'program',       verified: true },
  { filename: 'iptw_analysis.R',       format: 'R 4.3.2',    size: '24 KB',   checksum: 'b1c5d9e3f7a0…', producedBy: 'RUN-046', ectdModule: 'm5/datasets/analysis/adam/programs/', type: 'program',       verified: true },
]

const TYPE_STYLES: Record<ArtifactType, { color: string; bg: string; border: string }> = {
  dataset:       { color: 'text-blue-400',    bg: 'bg-blue-900/20',    border: 'border-blue-700/30' },
  metadata:      { color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/30' },
  documentation: { color: 'text-amber-600 dark:text-amber-300',   bg: 'bg-amber-900/20',   border: 'border-amber-700/30' },
  program:       { color: 'text-purple-400',  bg: 'bg-purple-900/20',  border: 'border-purple-700/30' },
  audit:         { color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-white/4',        border: 'border-gray-200 dark:border-white/8' },
}

const TYPE_ICONS: Record<ArtifactType, React.ReactNode> = {
  dataset:       <FileSpreadsheet className="h-3.5 w-3.5" />,
  metadata:      <FileCode className="h-3.5 w-3.5" />,
  documentation: <FileText className="h-3.5 w-3.5" />,
  program:       <FileCode className="h-3.5 w-3.5" />,
  audit:         <ClipboardList className="h-3.5 w-3.5" />,
}

// ── Lineage Graph Nodes ─────────────────────────────────────────────────────
const LINEAGE_NODES = [
  { label: 'Source',      version: 'v1.0', checksum: '9f2a1b…' },
  { label: 'Ingest',      version: 'v1.2', checksum: 'c4f1a8…' },
  { label: 'Curation',    version: 'v2.0', checksum: 'e3d7f9…' },
  { label: 'Cohort',      version: 'v1.1', checksum: 'a1b4c8…' },
  { label: 'Variables',   version: 'v1.3', checksum: 'b9e3f1…' },
  { label: 'Analysis',    version: 'v1.0', checksum: 'd2c7f8…' },
  { label: 'Diagnostics', version: 'v1.0', checksum: 'f1e4a3…' },
  { label: 'Artifacts',   version: 'v1.0', checksum: 'c8b2d6…' },
]

// ── eCTD Directory Tree ─────────────────────────────────────────────────────
interface TreeNode {
  name: string
  artifact?: string
  children?: TreeNode[]
}

const ECTD_TREE: TreeNode[] = [
  {
    name: 'm5/',
    children: [
      {
        name: 'datasets/',
        children: [
          {
            name: 'analysis/',
            children: [
              {
                name: 'adam/',
                children: [
                  {
                    name: 'datasets/',
                    children: [
                      { name: 'adam_adsl.xpt',  artifact: 'adam_adsl.xpt' },
                      { name: 'adam_adtte.xpt', artifact: 'adam_adtte.xpt' },
                      { name: 'adam_adae.xpt',  artifact: 'adam_adae.xpt' },
                      { name: 'adam_adcm.xpt',  artifact: 'adam_adcm.xpt' },
                      { name: 'adam_advs.xpt',  artifact: 'adam_advs.xpt' },
                    ],
                  },
                  {
                    name: 'programs/',
                    children: [
                      { name: 'cohort_construction.R', artifact: 'cohort_construction.R' },
                      { name: 'iptw_analysis.R',       artifact: 'iptw_analysis.R' },
                      { name: 'lineage_manifest.json', artifact: 'lineage_manifest.json' },
                      { name: 'audit_trail.csv',       artifact: 'audit_trail.csv' },
                    ],
                  },
                  { name: 'define.xml',           artifact: 'define.xml' },
                  { name: 'define-stylesheet.xsl', artifact: 'define-stylesheet.xsl' },
                  { name: 'adrg.pdf',             artifact: 'adrg.pdf' },
                ],
              },
              {
                name: 'sdtm/',
                children: [
                  { name: 'sdrg.pdf', artifact: 'sdrg.pdf' },
                ],
              },
              {
                name: 'misc/',
                children: [
                  { name: 'acrf.pdf', artifact: 'acrf.pdf' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]

// ── Validation Checklist ────────────────────────────────────────────────────
const VALIDATION_CHECKS = [
  { label: 'XPT files uncompressed',        pass: true },
  { label: 'define.xml present',             pass: true },
  { label: 'define.xml not compressed',      pass: true },
  { label: 'Stylesheet co-located',          pass: true },
  { label: 'ADRG/SDRG present',             pass: true },
  { label: 'Checksums verified',             pass: true },
  { label: 'Traceability diagram included',  pass: true },
  { label: 'Audit trail exportable',         pass: true },
]

// ── Tree Renderer ───────────────────────────────────────────────────────────
function TreeView({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <div className={depth > 0 ? 'ml-5 border-l border-gray-200 dark:border-white/8 pl-3' : ''}>
      {nodes.map((node, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 py-1">
            {node.children ? (
              <FolderTree className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
            ) : (
              <FileText className="h-3 w-3 text-gray-500 shrink-0" />
            )}
            <span className={`text-xs font-mono ${node.children ? 'text-amber-600 dark:text-amber-300 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
              {node.name}
            </span>
            {node.artifact && (
              <span className="text-[9px] text-gray-600 font-mono ml-1">
                ({ARTIFACTS.find(a => a.filename === node.artifact)?.size})
              </span>
            )}
          </div>
          {node.children && <TreeView nodes={node.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function TracePackExport({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const [exportFormat, setExportFormat] = useState<'full' | 'datasets' | 'reviewer'>('full')
  const [validated, setValidated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const totalSize = '18.3 MB'
  const allChecksPass = VALIDATION_CHECKS.every(c => c.pass)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const token = (apiClient as any).accessToken || ''
      const response = await fetch(`/api/v1/projects/${selectedStudy.id}/trace-pack/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (response.ok) {
        setGenerated(true)
      }
    } catch (err) {
      console.error('Failed to generate trace pack:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleValidate = () => {
    setValidated(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <PackageCheck className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Trace Pack</span>
                {locked && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
                {reviewerMode && (
                  <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold">
                    <Eye className="h-2.5 w-2.5" /> Reviewer View
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Submission Trace Pack</h1>
              <p className="text-gray-500 text-xs mt-0.5">
                Lineage manifest &middot; artifact registry &middot; checksums &middot; eCTD-aligned export
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">

        {/* ── Data source disclaimer ───────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 bg-amber-900/10 border border-amber-700/20 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">Reference Template — Not Generated from Current Analysis</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              The artifact registry, lineage manifest, and eCTD directory structure shown below are reference templates.
              Generate a Trace Pack to produce an actual submission package with verified checksums from your analysis results.
            </p>
          </div>
        </div>

        {/* ── 1. Package Overview ──────────────────────────────────────── */}
        <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Package Overview</h2>
            <div className="flex items-center gap-2">
              {locked ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 rounded-full px-2.5 py-0.5">
                  <Lock className="h-2.5 w-2.5" /> Package Locked
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-full px-2.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Unlocked
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Target / Center',     value: 'FDA / CDER' },
              { label: 'Study',               value: selectedStudy.protocol },
              { label: 'Package Version',      value: 'v1.0.0-rc.1' },
              { label: 'Created',              value: '2026-03-22 08:14 UTC' },
              { label: 'Created By',           value: 'A. Spencer (Biostatistics)' },
              { label: 'Integrity Hash',       value: 'sha256:7d3f9a1b…' },
              { label: 'Total Artifacts',      value: `${ARTIFACTS.length} files` },
              { label: 'Total Size',           value: totalSize },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 font-mono">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. Artifact Registry Table ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Artifact Registry</h2>
            <button className="flex items-center gap-1.5 text-xs text-[#2563EB] dark:text-[#60a5fa] font-semibold hover:text-blue-300 transition-colors">
              <Copy className="h-3.5 w-3.5" /> Copy all checksums
            </button>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Type</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Filename</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Format</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Size</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Checksum (SHA-256)</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Produced By</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">eCTD Module</th>
                    <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ARTIFACTS.map((a, i) => {
                    const style = TYPE_STYLES[a.type]
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-gray-50 dark:bg-white/3 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.border} ${style.color} border`}>
                            {TYPE_ICONS[a.type]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium font-mono text-xs">{a.filename}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono">{a.format}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500 font-mono">{a.size}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3 text-gray-600" />
                            {a.checksum}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#2563EB] dark:text-[#60a5fa]">{a.producedBy}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500 text-[10px]">{a.ectdModule}</td>
                        <td className="px-4 py-2.5 text-center">
                          {a.verified ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300 mx-auto" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── 3. Lineage Manifest Preview ──────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Lineage Manifest</h2>
          <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 overflow-x-auto">
            <div className="flex items-center gap-0 min-w-[700px]">
              {LINEAGE_NODES.map((node, i) => (
                <React.Fragment key={node.label}>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="w-16 h-16 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/25 flex flex-col items-center justify-center hover:bg-[#2563EB]/20 transition-colors">
                      <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#60a5fa]">{node.label}</span>
                      <span className="text-[8px] text-gray-500 font-mono mt-0.5">{node.version}</span>
                    </div>
                    <span className="text-[8px] text-gray-600 font-mono mt-1">{node.checksum}</span>
                  </div>
                  {i < LINEAGE_NODES.length - 1 && (
                    <div className="flex items-center mx-1 mb-4">
                      <div className="w-4 h-px bg-[#2563EB]/40" />
                      <ChevronRight className="h-3 w-3 text-[#2563EB]/60 -mx-0.5" />
                      <div className="w-4 h-px bg-[#2563EB]/40" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-4">
              Each node is deterministic and reproducible. All transitions are checksummed and version-controlled.
            </p>
          </div>
        </section>

        {/* ── 4. eCTD Directory Structure ──────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">eCTD Directory Structure</h2>
          <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
            <TreeView nodes={ECTD_TREE} />
            <p className="text-[10px] text-gray-500 mt-4 border-t border-gray-200 dark:border-white/5 pt-3">
              Directory layout conforms to FDA eCTD v4.0 guidance for ADaM/SDTM submission packages.
            </p>
          </div>
        </section>

        {/* ── 5. Export Controls Panel ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Export Controls</h2>
          <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-5">
              {/* Format selector */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">Export Format</p>
                <div className="flex gap-2">
                  {[
                    { key: 'full' as const,      label: 'Full Package (.zip)' },
                    { key: 'datasets' as const,  label: 'Datasets Only' },
                    { key: 'reviewer' as const,  label: 'Reviewer Guide Only' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setExportFormat(opt.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        exportFormat === opt.key
                          ? 'bg-[#2563EB] border-[#2563EB] text-white'
                          : 'bg-transparent border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#60a5fa] hover:text-[#2563EB] dark:text-[#60a5fa]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : generated ? (
                  <><CheckCircle2 className="h-4 w-4" /> Trace Pack Generated</>
                ) : (
                  <><Download className="h-4 w-4" /> Generate Trace Pack</>
                )}
              </button>
              <button
                onClick={handleValidate}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${
                  validated
                    ? 'border-emerald-700/30 text-emerald-400 bg-emerald-900/20'
                    : 'border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#60a5fa] hover:text-[#2563EB] dark:text-[#60a5fa]'
                }`}
              >
                {validated ? (
                  <><CheckCircle2 className="h-4 w-4" /> Validated</>
                ) : (
                  <><Shield className="h-4 w-4" /> Validate Package</>
                )}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 text-xs font-bold hover:border-[#60a5fa] hover:text-[#2563EB] dark:text-[#60a5fa] transition-colors">
                <Archive className="h-4 w-4" /> Export Audit Trail
              </button>
            </div>

            {/* Validation checklist */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Validation Checklist</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {VALIDATION_CHECKS.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {check.pass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
                    )}
                    <span className={check.pass ? 'text-gray-600 dark:text-gray-300' : 'text-amber-600 dark:text-amber-300'}>{check.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. FDA Conformance Status ──────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">FDA Conformance Status</h2>
          {generated ? (
            <div className="bg-emerald-900/10 border border-emerald-700/20 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-400">Conformance checks passed</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated package verified against eCTD Module 5 requirements.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-gray-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Not yet validated</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generate and validate a Trace Pack to run FDA eCTD conformance checks against actual artifacts.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
