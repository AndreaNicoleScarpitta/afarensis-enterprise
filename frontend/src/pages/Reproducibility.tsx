import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Copy, FileText, GitBranch, Code2, Play, Hash, Clock, Fingerprint } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'
import { apiClient } from '../services/apiClient'
import { logger } from '../services/logger'
import { z } from 'zod'

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
  const { data: reproData, loading, error, save, saving, refetch } = useStudyData(selectedStudy?.id, 'reproducibility')
  const staleness = useStalenessCheck(selectedStudy?.id, 'reproducibility')

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

  const [showImpactDialog, setShowImpactDialog] = useState(false)
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('reproducibility')

  // Editable state
  const [dockerImageTag, setDockerImageTag] = useState('')
  const [renvVersion, setRenvVersion] = useState('')
  const [newArtifactName, setNewArtifactName] = useState('')
  const [newArtifactType, setNewArtifactType] = useState('script')

  // ── Computation Provenance ─────────────────────────────────────────
  const [provenance, setProvenance] = useState<any>(null)
  const [provenanceLoading, setProvenanceLoading] = useState(false)
  const [runningProvenance, setRunningProvenance] = useState(false)
  const [expandedManifest, setExpandedManifest] = useState<string | null>(null)
  const [expandedCodeRef, setExpandedCodeRef] = useState<string | null>(null)

  const fetchProvenance = useCallback(async () => {
    if (!selectedStudy?.id) return
    setProvenanceLoading(true)
    try {
      const res = await apiClient.request(
        `/projects/${selectedStudy.id}/study/computation-provenance`,
        z.object({
          computation_provenance: z.any(),
          data_provenance: z.any(),
          has_provenance: z.boolean(),
        }),
      )
      if (res.has_provenance) {
        setProvenance(res)
      }
    } catch {
      // No provenance yet — that's fine
    } finally {
      setProvenanceLoading(false)
    }
  }, [selectedStudy?.id])

  useEffect(() => { fetchProvenance() }, [fetchProvenance])

  const handleRunWithProvenance = async () => {
    if (!selectedStudy?.id) return
    setRunningProvenance(true)
    try {
      const res = await apiClient.request(
        `/projects/${selectedStudy.id}/study/run-with-provenance`,
        z.object({
          status: z.string(),
          computation_provenance: z.any(),
          data_provenance: z.any(),
        }),
        { method: 'POST' },
      )
      setProvenance({
        computation_provenance: res.computation_provenance,
        data_provenance: res.data_provenance,
        has_provenance: true,
      })
    } catch (err) {
      logger.error('[Provenance] Run failed:', err)
    } finally {
      setRunningProvenance(false)
    }
  }

  const prov = provenance?.computation_provenance
  const dataProv = provenance?.data_provenance
  const manifests: any[] = prov?.manifests ?? []
  const codeRefs: any[] = prov?.code_references ?? []
  const lineage = prov?.lineage
  const dagNodes: any[] = lineage?.nodes ?? []
  const dagEdges: any[] = lineage?.edges ?? []

  useEffect(() => {
    if (reproData) {
      setDockerImageTag(reproData.docker?.image_hash ?? reproData.docker_image_hash ?? '')
      setRenvVersion(reproData.renv_version ?? '')
    }
  }, [reproData])

  const handleAddArtifact = async () => {
    if (!newArtifactName.trim()) return
    const newItem = {
      artifact: newArtifactName.trim(),
      hash: 'PENDING',
      signed: false,
      date: new Date().toISOString().split('T')[0],
      type: newArtifactType,
    }
    const updated = [...safeManifest, newItem]
    setManifest(updated)
    setNewArtifactName('')
    await save({ manifest: updated, packages: envPackages, docker_image_hash: dockerImageTag, renv_version: renvVersion })
  }

  const handleRemoveArtifact = async (index: number) => {
    const updated = safeManifest.filter((_, i) => i !== index)
    setManifest(updated)
    await save({ manifest: updated, packages: envPackages, docker_image_hash: dockerImageTag, renv_version: renvVersion })
  }

  const handleToggleSigned = async (artifactName: string) => {
    const updated = safeManifest.map(m =>
      m.artifact === artifactName ? { ...m, signed: !m.signed, date: !m.signed ? new Date().toISOString().split('T')[0] : m.date } : m
    )
    setManifest(updated)
    await save({ manifest: updated, packages: envPackages })
  }

  const handleUpdatePackageVersion = async (index: number, newVersion: string) => {
    const updated = [...safeEnvPackages]
    updated[index] = { ...updated[index], version: newVersion }
    setEnvPackages(updated)
    await save({ manifest, packages: updated, docker_image_hash: dockerImageTag, renv_version: renvVersion })
  }

  const doSaveDockerAndRenv = async () => {
    await save({ manifest, packages: envPackages, docker_image_hash: dockerImageTag, renv_version: renvVersion })
    setShowImpactDialog(false)
  }

  const handleSaveDockerAndRenv = () => {
    if (directImpacts.length > 0 || transitiveImpacts.length > 0) {
      setShowImpactDialog(true)
    } else {
      doSaveDockerAndRenv()
    }
  }

  const signedCount = safeManifest.filter(m => m.signed).length

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Archive className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 08</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900">Reproducibility</h1>
              <p className="text-gray-500 text-xs mt-0.5">Code manifest · environment lock · Docker image · lineage chain</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">{selectedStudy.indication}</p>
          </div>
        </div>
      </div>

      <StalenessBanner
        staleUpstreams={staleness.staleUpstreams}
        onAcknowledge={staleness.acknowledge}
      />

      <div className="px-8 py-6 space-y-6 max-w-4xl">

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading reproducibility data...</div>
        )}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="flex-1 text-sm text-red-600">Error loading data: {error}</p>
            <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        )}

        {safeManifest.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <FileText className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500">No data available</p>
            <p className="text-xs text-gray-600 mt-1">Generate analysis artifacts to populate the reproducibility manifest.</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Signed Artifacts', value: `${signedCount} / ${safeManifest.length}`, color: signedCount === safeManifest.length ? 'text-emerald-400' : 'text-amber-600' },
            { label: 'Docker Image Hash', value: reproData?.docker_image_hash ?? '—', color: reproData?.docker_image_hash ? 'text-[#2563EB]' : 'text-gray-500' },
            { label: 'renv Lockfile', value: reproData?.renv_version ? `${reproData.renv_version} · ${safeEnvPackages.length} packages` : '—', color: reproData?.renv_version ? 'text-emerald-400' : 'text-gray-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-100/80 border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className={`text-sm font-bold mt-1 font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Editable configuration — only when unlocked */}
        {!locked && !reviewerMode && (
          <section className="bg-gray-100/80 border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Environment Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">Docker Image Tag</label>
                <input
                  type="text"
                  value={dockerImageTag}
                  onChange={e => setDockerImageTag(e.target.value)}
                  placeholder="e.g. sha256:f1e4a3b9..."
                  className="w-full bg-gray-200/60 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">renv Lockfile Version</label>
                <input
                  type="text"
                  value={renvVersion}
                  onChange={e => setRenvVersion(e.target.value)}
                  placeholder="e.g. 1.0.3"
                  className="w-full bg-gray-200/60 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
            </div>
            <button
              onClick={handleSaveDockerAndRenv}
              disabled={saving}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {saving && <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Configuration
            </button>
          </section>
        )}

        {/* Artifact manifest */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Reproducibility Manifest</h2>
            <button className="flex items-center gap-1.5 text-xs text-[#2563EB] font-semibold hover:text-blue-300 transition-colors">
              <Copy className="h-3.5 w-3.5" /> Copy all hashes
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Artifact</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">SHA-256 Hash</th>
                  <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Reviewed</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Date</th>
                  {!locked && !reviewerMode && (
                    <th className="text-center px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {safeManifest.map((m, i) => (
                  <tr key={i} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors`}>
                    <td className="px-4 py-2.5 text-gray-900 font-medium font-mono text-xs">{m.artifact}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{m.hash}</td>
                    <td className="px-4 py-2.5 text-center">
                      {!locked && !reviewerMode ? (
                        <button
                          onClick={() => handleToggleSigned(m.artifact)}
                          className="mx-auto block"
                          title={m.signed ? 'Click to unmark as reviewed' : 'Click to mark as reviewed'}
                        >
                          {m.signed
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                            : <span className="text-[9px] text-amber-600 font-bold uppercase hover:text-amber-200 cursor-pointer">Pending</span>
                          }
                        </button>
                      ) : (
                        m.signed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                          : <span className="text-[9px] text-amber-600 font-bold uppercase">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{m.date}</td>
                    {!locked && !reviewerMode && (
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleRemoveArtifact(i)}
                          className="text-red-400 hover:text-red-300 text-[10px] font-semibold transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Artifact — only when unlocked */}
          {!locked && !reviewerMode && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newArtifactName}
                onChange={e => setNewArtifactName(e.target.value)}
                placeholder="Artifact filename..."
                className="flex-1 bg-gray-200/60 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
              <select
                value={newArtifactType}
                onChange={e => setNewArtifactType(e.target.value)}
                className="bg-gray-200/60 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="script">Script</option>
                <option value="data">Data</option>
                <option value="report">Report</option>
                <option value="config">Config</option>
                <option value="docker">Docker</option>
                <option value="other">Other</option>
              </select>
              <button
                onClick={handleAddArtifact}
                disabled={!newArtifactName.trim() || saving}
                className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                Add Artifact
              </button>
            </div>
          )}
        </section>

        {/* Environment */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Computational Environment</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Core Packages (renv lockfile)</p>
              <div className="space-y-1.5">
                {safeEnvPackages.map(({ pkg, version }, idx) => (
                  <div key={pkg} className="flex items-center justify-between">
                    <span className="text-sm text-gray-900 font-mono">{pkg}</span>
                    {!locked && !reviewerMode ? (
                      <input
                        type="text"
                        value={version}
                        onChange={e => handleUpdatePackageVersion(idx, e.target.value)}
                        className="w-24 text-right bg-gray-200/60 border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 font-mono">{version}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-3">Docker Container</p>
              {reproData?.docker ? (
                <div className="space-y-2 text-xs font-mono">
                  {reproData.docker.base_image && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Base image</span>
                      <span className="text-gray-600">{reproData.docker.base_image}</span>
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
                      <span className="text-gray-600">{reproData.docker.built_at}</span>
                    </div>
                  )}
                  {reproData.docker.registry && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registry</span>
                      <span className="text-[#2563EB]">{reproData.docker.registry}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Docker environment data not available.</p>
              )}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Container pinning ensures identical computational environment across re-executions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Lineage chain — data-driven */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Provenance Lineage Chain</h2>
          {Array.isArray(reproData?.lineage_chain) && reproData.lineage_chain.length > 0 ? (
            <div className="space-y-1">
              {reproData.lineage_chain.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    {item.status === 'verified'
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />}
                    {i < reproData.lineage_chain.length - 1 && <div className="w-px h-5 bg-emerald-800/50" />}
                  </div>
                  <div className="flex items-center justify-between flex-1 py-1">
                    <p className="text-sm text-gray-600">{item.step}</p>
                    <span className="text-[10px] font-mono text-gray-600">{item.hash ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm font-medium text-gray-500">Lineage Chain Not Available</p>
              <p className="text-xs text-gray-600 mt-1">Run analysis to generate provenance lineage.</p>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════
            COMPUTATION PROVENANCE — "Show Me the Code"
            ════════════════════════════════════════════════════════════════ */}
        <section className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-bold text-gray-900">Computation Provenance</h2>
            </div>
            {!locked && !reviewerMode && (
              <button
                onClick={handleRunWithProvenance}
                disabled={runningProvenance}
                className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-600 disabled:bg-[#2563EB]/50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                {runningProvenance ? (
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {runningProvenance ? 'Running...' : 'Run Analysis with Provenance'}
              </button>
            )}
          </div>

          {provenanceLoading && (
            <div className="text-center py-6 text-gray-500 text-xs">Loading provenance data...</div>
          )}

          {!provenanceLoading && !provenance?.has_provenance && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
              <Fingerprint className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">No Provenance Data</p>
              <p className="text-xs text-gray-500 mt-1">Run analysis with provenance to generate execution manifests, data lineage, and code references.</p>
            </div>
          )}

          {provenance?.has_provenance && (
            <div className="space-y-5">

              {/* Provenance Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Computations</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{prov?.total_computations ?? 0}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Deterministic</p>
                  <p className={`text-lg font-bold mt-0.5 ${prov?.all_deterministic ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {prov?.all_deterministic ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Git SHA</p>
                  <p className="text-xs font-mono font-bold text-[#2563EB] mt-1.5 truncate" title={prov?.git_sha}>{prov?.git_sha?.slice(0, 12) ?? '--'}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Data Source</p>
                  <p className={`text-xs font-bold mt-1.5 ${dataProv?.is_simulated ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {dataProv?.is_simulated ? 'Simulated' : 'Real Patient Data'}
                  </p>
                </div>
              </div>

              {/* Library Versions */}
              {prov?.library_versions && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Pinned Library Versions</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(prov.library_versions).map(([lib, ver]) => (
                      <span key={lib} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-700">
                        <span className="font-semibold">{lib}</span>
                        <span className="text-gray-400">=</span>
                        <span>{ver as string}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Lineage DAG — visual representation */}
              {dagNodes.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch className="h-3.5 w-3.5 text-[#2563EB]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Data Lineage DAG</p>
                    <span className="text-[10px] text-gray-400 ml-auto">{dagNodes.length} nodes, {dagEdges.length} edges</span>
                  </div>
                  <div className="space-y-1">
                    {dagNodes.map((node: any, i: number) => {
                      const typeColors: Record<string, string> = {
                        source_data: 'bg-blue-100 text-blue-700 border-blue-200',
                        model: 'bg-purple-100 text-purple-700 border-purple-200',
                        weighting: 'bg-amber-100 text-amber-700 border-amber-200',
                        estimate: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                        sensitivity: 'bg-orange-100 text-orange-700 border-orange-200',
                        output: 'bg-gray-200 text-gray-700 border-gray-300',
                      }
                      const color = typeColors[node.node_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                      const incomingEdges = dagEdges.filter((e: any) => e.to_node === node.node_id)
                      return (
                        <div key={node.node_id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center pt-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full border ${color}`} />
                            {i < dagNodes.length - 1 && <div className="w-px h-5 bg-gray-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${color}`}>{node.node_type.replace('_', ' ')}</span>
                              <span className="text-xs font-medium text-gray-900 truncate">{node.label}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              {node.row_count != null && <span className="text-[10px] text-gray-500">{node.row_count} rows</span>}
                              {node.data_hash && <span className="text-[10px] font-mono text-gray-400" title={node.data_hash}>#{node.data_hash.slice(0, 8)}</span>}
                              {incomingEdges.length > 0 && (
                                <span className="text-[10px] text-gray-400">{incomingEdges[0].transformation}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Execution Manifests */}
              {manifests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-3.5 w-3.5 text-[#2563EB]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Execution Manifests</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {manifests.map((m: any) => (
                      <div key={m.manifest_id} className="border-b border-gray-200 last:border-b-0">
                        <button
                          onClick={() => setExpandedManifest(expandedManifest === m.manifest_id ? null : m.manifest_id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-900 flex-1">{m.computation_type.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] font-mono text-gray-400">{m.duration_ms?.toFixed(0) ?? 0}ms</span>
                          <span className="text-[10px] font-mono text-gray-400">seed={m.random_seed}</span>
                          <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform ${expandedManifest === m.manifest_id ? 'rotate-90' : ''}`} />
                        </button>
                        {expandedManifest === m.manifest_id && (
                          <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] py-2">
                              <div><span className="text-gray-500 font-semibold">Function:</span> <span className="font-mono text-gray-700">{m.function_path}</span></div>
                              <div><span className="text-gray-500 font-semibold">Source:</span> <span className="font-mono text-[#2563EB]">{m.source_file}:{m.source_line}</span></div>
                              <div><span className="text-gray-500 font-semibold">Input Hash:</span> <span className="font-mono text-gray-700">{m.input_data_hash}</span></div>
                              <div><span className="text-gray-500 font-semibold">Output Hash:</span> <span className="font-mono text-gray-700">{m.output_hash}</span></div>
                              <div><span className="text-gray-500 font-semibold">Input Rows:</span> <span className="text-gray-700">{m.input_row_count}</span></div>
                              <div><span className="text-gray-500 font-semibold">Deterministic:</span> <span className={m.is_deterministic ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>{m.is_deterministic ? 'Yes' : 'No'}</span></div>
                              <div><span className="text-gray-500 font-semibold">Git SHA:</span> <span className="font-mono text-gray-700">{m.git_sha?.slice(0, 12)}</span></div>
                              <div><span className="text-gray-500 font-semibold">Started:</span> <span className="text-gray-700">{m.started_at}</span></div>
                            </div>
                            {m.parameter_snapshot && Object.keys(m.parameter_snapshot).length > 0 && (
                              <div className="mt-1 pt-1.5 border-t border-gray-200">
                                <p className="text-[9px] text-gray-500 font-semibold uppercase mb-1">Parameters</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(m.parameter_snapshot).map(([k, v]) => (
                                    <span key={k} className="inline-flex px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-mono text-gray-600">
                                      {k}={String(v)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {m.replay_command && (
                              <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                                <p className="text-[9px] text-gray-500 font-semibold uppercase mb-1">Replay Command</p>
                                <code className="block text-[10px] font-mono text-gray-600 bg-white border border-gray-200 rounded px-2 py-1 break-all">{m.replay_command}</code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Code References — "Show Me the Code" */}
              {codeRefs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="h-3.5 w-3.5 text-[#2563EB]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">"Show Me the Code" — SAR Artifact Mapping</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100/80 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">SAR Artifact</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Function</th>
                          <th className="text-left px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Source Location</th>
                          <th className="text-center px-4 py-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Hashes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codeRefs.map((ref: any) => (
                          <React.Fragment key={ref.ref_id}>
                            <tr
                              className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => setExpandedCodeRef(expandedCodeRef === ref.ref_id ? null : ref.ref_id)}
                            >
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold uppercase ${ref.artifact_type === 'figure' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{ref.artifact_type}</span>
                                  <span className="font-medium text-gray-900">{ref.artifact_label}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 font-mono text-[10px] text-gray-600 max-w-[200px] truncate">{ref.function_path?.split('.').pop()}</td>
                              <td className="px-4 py-2 font-mono text-[10px] text-[#2563EB]">{ref.source_file?.split('/').pop()}:{ref.source_line}</td>
                              <td className="px-4 py-2 text-center">
                                <span className="font-mono text-[9px] text-gray-400">{ref.input_data_hash?.slice(0, 6)}...{ref.output_hash?.slice(0, 6)}</span>
                              </td>
                            </tr>
                            {expandedCodeRef === ref.ref_id && (
                              <tr>
                                <td colSpan={4} className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                                    <div><span className="text-gray-500 font-semibold">Full Path:</span> <span className="font-mono text-gray-700">{ref.function_path}</span></div>
                                    <div><span className="text-gray-500 font-semibold">Source File:</span> <span className="font-mono text-[#2563EB]">{ref.source_file}:{ref.source_line}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500 font-semibold">Description:</span> <span className="text-gray-700">{ref.computation_description}</span></div>
                                    <div><span className="text-gray-500 font-semibold">Input Hash:</span> <span className="font-mono text-gray-600">{ref.input_data_hash}</span></div>
                                    <div><span className="text-gray-500 font-semibold">Output Hash:</span> <span className="font-mono text-gray-600">{ref.output_hash}</span></div>
                                  </div>
                                  {ref.parameters_used && Object.keys(ref.parameters_used).length > 0 && (
                                    <div className="mt-1.5 pt-1.5 border-t border-gray-200">
                                      <p className="text-[9px] text-gray-500 font-semibold uppercase mb-1">Parameters Used</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(ref.parameters_used).map(([k, v]) => (
                                          <span key={k} className="inline-flex px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-mono text-gray-600">
                                            {k}={String(v)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Replay Instructions */}
              {prov?.replay_instructions && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Deterministic Replay Instructions</p>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(prov.replay_instructions).map(([step, cmd]) => (
                      <div key={step} className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-500 font-semibold min-w-[80px]">{step}:</span>
                        <code className="text-[10px] font-mono text-gray-700 break-all">{cmd as string}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Link to={`/projects/${selectedStudy.id}/bias-sensitivity`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 7: Bias & Sensitivity
          </Link>
          <Link to={`/projects/${selectedStudy.id}/audit`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 9: Audit Trail <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
      <DownstreamImpactDialog
        open={showImpactDialog}
        onClose={() => setShowImpactDialog(false)}
        onConfirm={doSaveDockerAndRenv}
        saving={saving}
        currentStepLabel="Reproducibility"
        directImpacts={directImpacts}
        transitiveImpacts={transitiveImpacts}
      />
    </div>
  )
}
