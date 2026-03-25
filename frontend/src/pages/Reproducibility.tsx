import React, { useState, useEffect } from 'react'
import { Archive, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Copy, ExternalLink, FileText } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const MANIFEST = [
//   { artifact: 'study_protocol_v1.3.pdf',        hash: 'sha256:9f2a1b3d…', signed: true,  date: '2026-02-14' },
//   { artifact: 'cohort_construction.R',           hash: 'sha256:c4f1a8b2…', signed: true,  date: '2026-02-14' },
//   { artifact: 'iptw_analysis.R',                hash: 'sha256:e3d7f9c0…', signed: true,  date: '2026-02-14' },
//   { artifact: 'sensitivity_analyses.R',          hash: 'sha256:a1b4c8d2…', signed: true,  date: '2026-02-14' },
//   { artifact: 'data_validation_report.html',     hash: 'sha256:b9e3f1a4…', signed: true,  date: '2026-02-14' },
//   { artifact: 'session_info.txt',               hash: 'sha256:d2c7f8e1…', signed: true,  date: '2026-02-14' },
//   { artifact: 'Dockerfile',                     hash: 'sha256:f1e4a3b9…', signed: true,  date: '2026-02-14' },
//   { artifact: 'environment.lock (renv)',         hash: 'sha256:c8b2d6f3…', signed: true,  date: '2026-02-14' },
//   { artifact: 'ehr_validation_report.html',     hash: 'PENDING',          signed: false, date: 'Pending' },
// ]

// SCHEMA REFERENCE — not shown to users
// const ENV_PACKAGES = [
//   { pkg: 'R', version: '4.3.2' },
//   { pkg: 'WeightIt', version: '0.14.2' },
//   { pkg: 'MatchIt', version: '4.5.5' },
//   { pkg: 'survival', version: '3.5.7' },
//   { pkg: 'cobalt', version: '4.5.3' },
//   { pkg: 'tidyverse', version: '2.0.0' },
//   { pkg: 'EValue', version: '4.1.3' },
//   { pkg: 'renv', version: '1.0.3' },
// ]

export default function Reproducibility({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: reproData, loading, error, save } = useStudyData(selectedStudy?.id, 'reproducibility')

  const [manifest, setManifest] = useState<any[]>([])
  const [envPackages, setEnvPackages] = useState<any[]>([])

  useEffect(() => {
    if (reproData) {
      if (Array.isArray(reproData.manifest) && reproData.manifest.length) setManifest(reproData.manifest)
      if (Array.isArray(reproData.packages) && reproData.packages.length) setEnvPackages(reproData.packages)
    }
  }, [reproData])

  // Defensive: ensure state is always an array
  const safeManifest = Array.isArray(manifest) ? manifest : []
  const safeEnvPackages = Array.isArray(envPackages) ? envPackages : []

  const handleAcknowledgeArtifact = async (artifactName: string) => {
    const updated = safeManifest.map(m =>
      m.artifact === artifactName ? { ...m, signed: true, date: new Date().toISOString().split('T')[0] } : m
    )
    setManifest(updated)
    await save({ manifest: updated, packages: envPackages })
  }

  const signedCount = safeManifest.filter(m => m.signed).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Archive className="h-4 w-4 text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 08</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reproducibility</h1>
              <p className="text-gray-500 text-xs mt-0.5">Code manifest · environment lock · Docker image · lineage chain</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading reproducibility data...</div>
        )}
        {error && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-sm text-red-400">
            Error loading data: {error}
          </div>
        )}

        {safeManifest.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <FileText className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-400">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Generate analysis artifacts to populate the reproducibility manifest.</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Signed Artifacts', value: `${signedCount} / ${safeManifest.length}`, color: signedCount === safeManifest.length ? 'text-emerald-400' : 'text-amber-600 dark:text-amber-300' },
            { label: 'Docker Image Hash', value: reproData?.docker_image_hash ?? '—', color: reproData?.docker_image_hash ? 'text-[#60a5fa]' : 'text-gray-500' },
            { label: 'renv Lockfile', value: reproData?.renv_version ? `${reproData.renv_version} · ${safeEnvPackages.length} packages` : '—', color: reproData?.renv_version ? 'text-emerald-400' : 'text-gray-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className={`text-sm font-bold mt-1 font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Artifact manifest */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Reproducibility Manifest</h2>
            <button className="flex items-center gap-1.5 text-xs text-[#60a5fa] font-semibold hover:text-blue-300 transition-colors">
              <Copy className="h-3.5 w-3.5" /> Copy all hashes
            </button>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Artifact</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">SHA-256 Hash</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Reviewed</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Date</th>
                </tr>
              </thead>
              <tbody>
                {safeManifest.map((m, i) => (
                  <tr key={i} className={`border-b border-white/5 hover:bg-white/3 transition-colors`}>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium font-mono text-xs">{m.artifact}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{m.hash}</td>
                    <td className="px-4 py-2.5 text-center">
                      {m.signed
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                        : <span className="text-[9px] text-amber-600 dark:text-amber-300 font-bold uppercase">Pending</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{m.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Environment */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Computational Environment</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Core Packages (renv lockfile)</p>
              <div className="space-y-1.5">
                {safeEnvPackages.map(({ pkg, version }) => (
                  <div key={pkg} className="flex items-center justify-between">
                    <span className="text-sm text-gray-900 dark:text-white font-mono">{pkg}</span>
                    <span className="text-xs text-gray-500 font-mono">{version}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Docker Container</p>
              {reproData?.docker ? (
                <div className="space-y-2 text-xs font-mono">
                  {reproData.docker.base_image && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Base image</span>
                      <span className="text-gray-300">{reproData.docker.base_image}</span>
                    </div>
                  )}
                  {reproData.docker.image_hash && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Image hash</span>
                      <span className="text-emerald-400">{reproData.docker.image_hash}</span>
                    </div>
                  )}
                  {reproData.docker.built_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Built</span>
                      <span className="text-gray-300">{reproData.docker.built_at}</span>
                    </div>
                  )}
                  {reproData.docker.registry && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registry</span>
                      <span className="text-[#60a5fa]">{reproData.docker.registry}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Docker environment data not available.</p>
              )}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/8">
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Container pinning ensures identical computational environment across re-executions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Lineage chain — data-driven */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Provenance Lineage Chain</h2>
          {Array.isArray(reproData?.lineage_chain) && reproData.lineage_chain.length > 0 ? (
            <div className="space-y-1">
              {reproData.lineage_chain.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    {item.status === 'verified'
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300 shrink-0" />}
                    {i < reproData.lineage_chain.length - 1 && <div className="w-px h-5 bg-emerald-800/50" />}
                  </div>
                  <div className="flex items-center justify-between flex-1 py-1">
                    <p className="text-sm text-gray-300">{item.step}</p>
                    <span className="text-[10px] font-mono text-gray-600">{item.hash ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-6 text-center">
              <p className="text-sm font-medium text-gray-400">Lineage Chain Not Available</p>
              <p className="text-xs text-gray-600 mt-1">Run analysis to generate provenance lineage.</p>
            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <a href={`/projects/${selectedStudy.id}/bias-sensitivity`} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 7: Bias & Sensitivity
          </a>
          <a href={`/projects/${selectedStudy.id}/audit`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 9: Audit Trail <ChevronRight className="h-4 w-4" />
          </a>
        </div>

      </div>
    </div>
  )
}
