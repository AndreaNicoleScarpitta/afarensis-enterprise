import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GitBranch, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2,
  Plus, Info, Loader2, AlertCircle, FileText,
  RefreshCw, Clock, Play, Database, Users2, BarChart2,
  TrendingUp, ShieldAlert, FileOutput, Network,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { apiClient } from '../services/apiClient'
import { z } from 'zod'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── DAG Types & Constants ──────────────────────────────────────────────────

interface DAGNode {
  key: string
  label: string
  category: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  order_index: number
  config: Record<string, unknown>
  page_route: string
}

interface DAGEdge {
  from_node_key: string
  to_node_key: string
  edge_type: string
}

interface DAGData {
  project_id: string
  nodes: DAGNode[]
  edges: DAGEdge[]
}

const PHASE_CONFIG: { phase: number; label: string; categories: string[] }[] = [
  { phase: 1, label: 'Data Ingestion',             categories: ['data_ingestion'] },
  { phase: 2, label: 'Population & Cohort',         categories: ['population'] },
  { phase: 3, label: 'Primary & Secondary',         categories: ['primary', 'secondary'] },
  { phase: 4, label: 'Subgroup & Sensitivity',      categories: ['subgroup', 'sensitivity'] },
  { phase: 5, label: 'Safety',                      categories: ['safety'] },
  { phase: 6, label: 'Regulatory Output',           categories: ['output'] },
]

const CATEGORY_META: Record<string, { color: string; icon: React.ElementType }> = {
  data_ingestion: { color: '#6366f1', icon: Database },
  population:     { color: '#8b5cf6', icon: Users2 },
  primary:        { color: '#2563eb', icon: BarChart2 },
  secondary:      { color: '#0ea5e9', icon: TrendingUp },
  subgroup:       { color: '#f59e0b', icon: TrendingUp },
  sensitivity:    { color: '#f97316', icon: ShieldAlert },
  safety:         { color: '#ef4444', icon: ShieldAlert },
  output:         { color: '#10b981', icon: FileOutput },
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  pending:     { bg: 'bg-gray-800/40',   border: 'border-gray-700/50',  text: 'text-gray-500 dark:text-gray-400',   dot: 'bg-gray-500',     label: 'Pending' },
  in_progress: { bg: 'bg-blue-950/40',   border: 'border-blue-700/40',  text: 'text-blue-300',   dot: 'bg-blue-500',     label: 'In Progress' },
  completed:   { bg: 'bg-emerald-950/30', border: 'border-emerald-700/40', text: 'text-emerald-300', dot: 'bg-emerald-500', label: 'Completed' },
  blocked:     { bg: 'bg-red-950/30',     border: 'border-red-700/40',   text: 'text-red-300',    dot: 'bg-red-500',      label: 'Blocked' },
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'pending',
  blocked: 'pending',
}

const DAGNodeSchema = z.object({
  key: z.string(),
  label: z.string(),
  category: z.string(),
  description: z.string().default(''),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  order_index: z.number(),
  config: z.record(z.unknown()).default({}),
  page_route: z.string().default(''),
})

const DAGEdgeSchema = z.object({
  from_node_key: z.string(),
  to_node_key: z.string(),
  edge_type: z.string().default('dependency'),
})

const DAGResponseSchema = z.object({
  project_id: z.string().optional(),
  nodes: z.array(DAGNodeSchema),
  edges: z.array(DAGEdgeSchema),
}).passthrough()

// ── Covariate table status colors ──────────────────────────────────────────

const statusColor: Record<string, string> = {
  balanced:   'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  review:     'text-orange-300 bg-orange-900/30 border-orange-600/40',
  imbalanced: 'text-red-400 bg-red-900/20 border-red-700/30',
}

// ── Demo DAG data ──────────────────────────────────────────────────────────

function getDemoDAGData(projectId: string): DAGData {
  return {
    project_id: projectId,
    nodes: [
      { key: 'data_ingestion', label: 'Data Ingestion: Source Dataset', category: 'data_ingestion', description: 'Import and validate source trial data', status: 'completed', order_index: 0, config: {}, page_route: `/projects/${projectId}/data-provenance` },
      { key: 'population_definition', label: 'Population Definition: Cohorts', category: 'population', description: 'Define study populations', status: 'completed', order_index: 1, config: {}, page_route: `/projects/${projectId}/cohort` },
      { key: 'cohort_attrition', label: 'Cohort Attrition & Weighting', category: 'population', description: 'Apply inclusion/exclusion criteria and IPTW weights', status: 'in_progress', order_index: 2, config: {}, page_route: `/projects/${projectId}/cohort` },
      { key: 'primary_endpoint', label: 'Primary Endpoint Analysis', category: 'primary', description: 'Primary outcome analysis', status: 'pending', order_index: 3, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'secondary_cognitive', label: 'Secondary Endpoint', category: 'secondary', description: 'Secondary outcome assessment', status: 'pending', order_index: 4, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'secondary_functional', label: 'Secondary: Functional', category: 'secondary', description: 'Functional endpoint analysis', status: 'pending', order_index: 5, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'subgroup_analysis', label: 'Subgroup Analysis', category: 'subgroup', description: 'Stratified analysis by subgroup', status: 'pending', order_index: 6, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'sensitivity_analysis', label: 'Sensitivity Analysis', category: 'sensitivity', description: 'Assess robustness under assumptions', status: 'pending', order_index: 7, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'safety_monitoring', label: 'Safety Monitoring', category: 'safety', description: 'Safety endpoint surveillance', status: 'pending', order_index: 8, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'regulatory_package', label: 'Evidence Package: eCTD', category: 'output', description: 'Compile regulatory submission dossier', status: 'pending', order_index: 9, config: {}, page_route: `/projects/${projectId}/regulatory-output` },
    ],
    edges: [
      { from_node_key: 'data_ingestion', to_node_key: 'population_definition', edge_type: 'dependency' },
      { from_node_key: 'population_definition', to_node_key: 'cohort_attrition', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'primary_endpoint', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'secondary_cognitive', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'secondary_functional', edge_type: 'dependency' },
      { from_node_key: 'primary_endpoint', to_node_key: 'subgroup_analysis', edge_type: 'dependency' },
      { from_node_key: 'primary_endpoint', to_node_key: 'sensitivity_analysis', edge_type: 'dependency' },
      { from_node_key: 'secondary_cognitive', to_node_key: 'sensitivity_analysis', edge_type: 'dependency' },
      { from_node_key: 'subgroup_analysis', to_node_key: 'safety_monitoring', edge_type: 'dependency' },
      { from_node_key: 'sensitivity_analysis', to_node_key: 'safety_monitoring', edge_type: 'dependency' },
      { from_node_key: 'safety_monitoring', to_node_key: 'regulatory_package', edge_type: 'dependency' },
      { from_node_key: 'secondary_functional', to_node_key: 'regulatory_package', edge_type: 'dependency' },
    ],
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CausalFramework({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const navigate = useNavigate()
  const { data: covData, loading, error, save, refetch } = useStudyData(selectedStudy?.id, 'covariates')

  const [estimand] = useState(selectedStudy.estimand)
  const [covariates, setCovariates] = useState<any[]>([])
  const [unmeasuredConfounders, setUnmeasuredConfounders] = useState<any[]>([])
  const [newCovariate, setNewCovariate] = useState('')
  const locked = protocolLocked

  // DAG state
  const [dagData, setDagData] = useState<DAGData | null>(null)
  const [dagLoading, setDagLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [updatingNode, setUpdatingNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [connectorPaths, setConnectorPaths] = useState<{ id: string; d: string; from: string; to: string }[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (covData) {
      if (Array.isArray(covData.covariates) && covData.covariates.length) setCovariates(covData.covariates)
      if (Array.isArray(covData.unmeasured) && covData.unmeasured.length) setUnmeasuredConfounders(covData.unmeasured)
    }
  }, [covData])

  const safeCovariates = Array.isArray(covariates) ? covariates : []
  const safeUnmeasured = Array.isArray(unmeasuredConfounders) ? unmeasuredConfounders : []

  const addCovariate = async () => {
    if (!newCovariate.trim()) return
    const updated = [...safeCovariates, { name: newCovariate.trim(), type: 'Confounder', balance: 'Pending', status: 'review' }]
    setCovariates(updated)
    setNewCovariate('')
    await save({ covariates: updated, unmeasured: unmeasuredConfounders })
  }

  // ── DAG: Fetch ──────────────────────────────────────────────────────────

  const fetchDAG = useCallback(async () => {
    if (!selectedStudy?.id) return
    try {
      setDagLoading(true)
      const data = await apiClient.request(
        `/projects/${selectedStudy.id}/dag`,
        DAGResponseSchema,
      )
      setDagData(data as DAGData)
    } catch {
      setDagData(getDemoDAGData(selectedStudy.id))
    } finally {
      setDagLoading(false)
    }
  }, [selectedStudy?.id])

  useEffect(() => { fetchDAG() }, [fetchDAG])

  // ── DAG: Regenerate ─────────────────────────────────────────────────────

  const handleRegenerate = async () => {
    if (!selectedStudy?.id) return
    try {
      setRegenerating(true)
      await apiClient.request(
        `/projects/${selectedStudy.id}/dag/generate`,
        DAGResponseSchema,
        { method: 'POST' },
      )
      await fetchDAG()
    } catch {
      // Silently use existing data
    } finally {
      setRegenerating(false)
    }
  }

  // ── DAG: Toggle node status ─────────────────────────────────────────────

  const handleStatusToggle = async (nodeKey: string, currentStatus: string) => {
    if (protocolLocked || !selectedStudy?.id) return
    const nextStatus = NEXT_STATUS[currentStatus] || 'pending'
    setUpdatingNode(nodeKey)
    setDagData(prev => {
      if (!prev) return prev
      return { ...prev, nodes: prev.nodes.map(n => n.key === nodeKey ? { ...n, status: nextStatus as DAGNode['status'] } : n) }
    })
    try {
      await apiClient.request(
        `/projects/${selectedStudy.id}/dag/nodes/${nodeKey}/status`,
        z.object({ status: z.string() }),
        { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) },
      )
    } catch {
      setDagData(prev => {
        if (!prev) return prev
        return { ...prev, nodes: prev.nodes.map(n => n.key === nodeKey ? { ...n, status: currentStatus as DAGNode['status'] } : n) }
      })
    } finally {
      setUpdatingNode(null)
    }
  }

  const handleNodeClick = (node: DAGNode) => {
    if (node.page_route) {
      navigate(node.page_route.replace('{id}', selectedStudy.id))
    }
  }

  // ── DAG: Organize by phase ──────────────────────────────────────────────

  const phaseColumns = useMemo(() => {
    if (!dagData) return []
    return PHASE_CONFIG.map(phase => ({
      ...phase,
      nodes: dagData.nodes
        .filter(n => phase.categories.includes(n.category))
        .sort((a, b) => a.order_index - b.order_index),
    }))
  }, [dagData])

  const progress = useMemo(() => {
    if (!dagData) return { completed: 0, total: 0 }
    return { completed: dagData.nodes.filter(n => n.status === 'completed').length, total: dagData.nodes.length }
  }, [dagData])

  // ── DAG: SVG connector paths ────────────────────────────────────────────

  const computePaths = useCallback(() => {
    if (!dagData || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const paths: { id: string; d: string; from: string; to: string }[] = []

    for (const edge of dagData.edges) {
      const fromEl = nodeRefs.current[edge.from_node_key]
      const toEl = nodeRefs.current[edge.to_node_key]
      if (!fromEl || !toEl) continue

      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()

      const x1 = fromRect.right - containerRect.left
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top
      const x2 = toRect.left - containerRect.left
      const y2 = toRect.top + toRect.height / 2 - containerRect.top

      const dx = Math.abs(x2 - x1)
      const cp = Math.max(dx * 0.4, 40)

      paths.push({
        id: `${edge.from_node_key}-${edge.to_node_key}`,
        d: `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`,
        from: edge.from_node_key,
        to: edge.to_node_key,
      })
    }
    setConnectorPaths(paths)
  }, [dagData])

  useEffect(() => {
    if (!dagData) return
    const timer = setTimeout(computePaths, 100)
    window.addEventListener('resize', computePaths)
    return () => { clearTimeout(timer); window.removeEventListener('resize', computePaths) }
  }, [dagData, computePaths])

  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 02</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Causal Framework</h1>
              <p className="text-gray-500 text-xs mt-0.5">Estimand · DAG · covariate selection · unmeasured confounders</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <p className="text-[10px] text-gray-500">Estimand: <span className="text-[#2563EB] dark:text-[#60a5fa] font-semibold">{estimand}</span></p>
          </div>
        </div>
      </div>

      <LiteratureEvidence categories={['covariate', 'estimand', 'general']} stepLabel="Causal Framework" />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading causal framework data...</span>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Failed to load causal framework data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{error}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      <div className="px-8 py-6 space-y-6">

        {/* Estimand summary */}
        <div className="bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-5 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            <h2 className="text-sm font-bold text-[#2563EB] dark:text-[#60a5fa]">Pre-specified Estimand: {estimand}</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {estimand === 'ATT' && 'Average Treatment Effect on the Treated — estimates the effect of treatment among patients who would receive it in practice. This is the target of inference for external comparator study designs.'}
            {estimand === 'ATE' && 'Average Treatment Effect — estimates the effect averaged over the full eligible population, assuming all patients could be assigned to either arm.'}
            {estimand === 'ITT' && 'Intention to Treat — estimates the effect of treatment assignment, regardless of actual adherence. Aligns with randomised trial primary analysis.'}
            {estimand === 'PP' && 'Per Protocol — estimates the effect of receiving treatment as assigned, among adherers only. Typically used as a sensitivity analysis.'}
          </p>
        </div>

        {/* ── Analysis DAG (replaces static reference diagram) ─────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Analysis Workflow DAG</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Progress indicator */}
              {dagData && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/8 rounded-lg">
                  <div className="w-20 h-1.5 bg-gray-300 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums font-medium">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
              )}
              <button
                onClick={handleRegenerate}
                disabled={regenerating || protocolLocked}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/8 border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
          </div>

          {dagLoading && (
            <div className="flex items-center justify-center py-12 bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl">
              <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mr-2" />
              <span className="text-sm text-gray-500">Loading analysis workflow...</span>
            </div>
          )}

          {!dagLoading && dagData && (
            <>
              <div className="overflow-x-auto bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-xl p-4">
                <div ref={containerRef} className="relative min-w-[1000px]">
                  {/* SVG connector layer */}
                  <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                    <defs>
                      <marker id="cf-arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
                      </marker>
                      <marker id="cf-arrowhead-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#2563EB" />
                      </marker>
                    </defs>
                    {connectorPaths.map(path => {
                      const fromNode = dagData.nodes.find(n => n.key === path.from)
                      const toNode = dagData.nodes.find(n => n.key === path.to)
                      const isActive = fromNode?.status === 'completed' && toNode?.status !== 'blocked'
                      return (
                        <path
                          key={path.id}
                          d={path.d}
                          fill="none"
                          stroke={isActive ? '#2563EB' : '#374151'}
                          strokeWidth={isActive ? 2 : 1.5}
                          strokeDasharray={isActive ? 'none' : '4 3'}
                          markerEnd={isActive ? 'url(#cf-arrowhead-active)' : 'url(#cf-arrowhead)'}
                          opacity={isActive ? 0.7 : 0.4}
                          className="transition-all duration-300"
                        />
                      )
                    })}
                  </svg>

                  {/* Phase columns */}
                  <div className="flex gap-3 relative" style={{ zIndex: 2 }}>
                    {phaseColumns.map(phase => (
                      <div key={phase.phase} className="flex-1 min-w-[150px]">
                        <div className="mb-2 px-1">
                          <span className="text-[9px] font-black text-gray-600 tabular-nums">PHASE {phase.phase}</span>
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{phase.label}</p>
                        </div>
                        <div className="space-y-2">
                          {phase.nodes.length === 0 && (
                            <div className="px-2 py-4 border border-dashed border-gray-300 dark:border-gray-800 rounded-lg text-center">
                              <p className="text-[9px] text-gray-500 dark:text-gray-700">No steps</p>
                            </div>
                          )}
                          {phase.nodes.map(node => {
                            const meta = (CATEGORY_META[node.category] ?? CATEGORY_META.primary)!
                            const status = (STATUS_STYLES[node.status] ?? STATUS_STYLES.pending)!
                            const IconComp = meta.icon
                            const isUpdating = updatingNode === node.key

                            return (
                              <div
                                key={node.key}
                                ref={el => { nodeRefs.current[node.key] = el }}
                                className={`group relative rounded-xl border ${status.border} ${status.bg} backdrop-blur-sm transition-all duration-200 hover:border-opacity-80 hover:shadow-lg hover:shadow-black/20 cursor-pointer`}
                                onClick={() => handleNodeClick(node)}
                              >
                                {node.status === 'in_progress' && (
                                  <div className="absolute -inset-px rounded-xl border-2 border-blue-500/30 animate-pulse pointer-events-none" />
                                )}
                                <div className="p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                                    >
                                      <IconComp className="h-2.5 w-2.5" />
                                      {node.category.replace(/_/g, ' ')}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStatusToggle(node.key, node.status) }}
                                      disabled={protocolLocked || isUpdating}
                                      className="p-0.5 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={`Status: ${status.label}. Click to change.`}
                                    >
                                      {isUpdating ? <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                        : node.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                        : node.status === 'in_progress' ? <Play className="h-3 w-3 text-blue-400" />
                                        : node.status === 'blocked' ? <Lock className="h-3 w-3 text-red-400" />
                                        : <Clock className="h-3 w-3 text-gray-500" />}
                                    </button>
                                  </div>
                                  <p className="text-[11px] font-semibold text-gray-900 dark:text-white leading-snug mb-0.5 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors">
                                    {node.label}
                                  </p>
                                  {node.description && (
                                    <p className="text-[9px] text-gray-500 leading-relaxed line-clamp-2">{node.description}</p>
                                  )}
                                  <div className="mt-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${node.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                                      <span className={`text-[9px] font-medium ${status.text}`}>{status.label}</span>
                                    </div>
                                    <ChevronRight className="h-2.5 w-2.5 text-gray-700 group-hover:text-gray-400 transition-colors" />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-2 px-1">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Status</span>
                {Object.entries(STATUS_STYLES).map(([key, style]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 capitalize">{style.label}</span>
                  </div>
                ))}
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#2563EB" strokeWidth="2" /></svg>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400">Active</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400">Pending</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Covariate table */}
        <section className="max-w-4xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Pre-specified Covariate Set</h2>
            <span className="text-[10px] text-gray-500">{safeCovariates.length} variables registered</span>
          </div>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 dark:bg-white/4 border-b border-gray-200 dark:border-white/8">
                <tr>
                  {['Variable', 'Role', 'Post-matching Balance', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {safeCovariates.map((cov, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">{cov.name}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{cov.type}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{cov.balance}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor[cov.status]}`}>
                        {cov.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {safeCovariates.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Define covariates in Study Definition, then run balance analysis.</p>
            </div>
          )}

          {!locked && !reviewerMode && (
            <div className="flex gap-2 mt-3">
              <input
                className="flex-1 bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
                placeholder="Add covariate…"
                value={newCovariate}
                onChange={e => setNewCovariate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCovariate()}
              />
              <button
                onClick={addCovariate}
                className="flex items-center gap-1.5 bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#2563EB]/40 text-[#2563EB] dark:text-[#60a5fa] text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          )}
        </section>

        {/* Unmeasured confounders */}
        <section className="max-w-4xl">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Unmeasured Confounders — Pre-specified Risk Register</h2>
          {safeUnmeasured.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
              <p className="text-xs text-gray-600 mt-1">Define covariates in Study Definition, then run balance analysis.</p>
            </div>
          )}
          <div className="space-y-2">
            {safeUnmeasured.map((u, i) => (
              <div key={i} className="flex items-start justify-between bg-gray-50 dark:bg-white/3 border border-gray-200 dark:border-white/8 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{u.mitigation}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ml-4 ${
                  u.risk === 'High' ? 'text-red-400 bg-red-900/20 border-red-700/30' : 'text-orange-300 bg-orange-900/30 border-orange-600/40'
                }`}>
                  {u.risk} Risk
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8 max-w-4xl">
          <Link to={`/projects/${selectedStudy.id}/study`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 1: Study Definition
          </Link>
          <Link to={`/projects/${selectedStudy.id}/data-provenance`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 3: Data Provenance <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  )
}
