import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle2,
  Clock, Play, Lock, Database, Users2, BarChart2,
  TrendingUp, ShieldAlert, FileOutput, ChevronRight,
  Network,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { apiClient } from '../services/apiClient'
import { z } from 'zod'

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

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
  pending:     { bg: 'bg-gray-800/40',   border: 'border-gray-700/50',  text: 'text-gray-400',   dot: 'bg-gray-500',     label: 'Pending' },
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

// ── Zod schemas for API validation ─────────────────────────────────────────────

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
  project_id: z.string(),
  nodes: z.array(DAGNodeSchema),
  edges: z.array(DAGEdgeSchema),
})

// ── Component ──────────────────────────────────────────────────────────────────

export default function StudyDAG({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const navigate = useNavigate()
  const [dagData, setDagData] = useState<DAGData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [updatingNode, setUpdatingNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [connectorPaths, setConnectorPaths] = useState<{ id: string; d: string; from: string; to: string }[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Fetch DAG data ─────────────────────────────────────────────────────────

  const fetchDAG = useCallback(async () => {
    if (!selectedStudy?.id) return
    try {
      setLoading(true)
      setError(null)
      const data = await apiClient.request(
        `/projects/${selectedStudy.id}/dag`,
        DAGResponseSchema,
      )
      setDagData(data)
    } catch (err: any) {
      console.error('Failed to fetch DAG:', err)
      // Provide demo data if backend not available
      setDagData(getDemoDAGData(selectedStudy.id))
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [selectedStudy?.id])

  useEffect(() => { fetchDAG() }, [fetchDAG])

  // ── Regenerate DAG ─────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error('Failed to regenerate DAG:', err)
      // Silently use existing data
    } finally {
      setRegenerating(false)
    }
  }

  // ── Toggle node status ─────────────────────────────────────────────────────

  const handleStatusToggle = async (nodeKey: string, currentStatus: string) => {
    if (protocolLocked || !selectedStudy?.id) return
    const nextStatus = NEXT_STATUS[currentStatus] || 'pending'
    setUpdatingNode(nodeKey)
    // Optimistic update
    setDagData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map(n =>
          n.key === nodeKey ? { ...n, status: nextStatus as DAGNode['status'] } : n
        ),
      }
    })
    try {
      await apiClient.request(
        `/projects/${selectedStudy.id}/dag/nodes/${nodeKey}/status`,
        z.object({ status: z.string() }),
        { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) },
      )
    } catch (err) {
      console.error('Failed to update node status:', err)
      // Revert on failure
      setDagData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          nodes: prev.nodes.map(n =>
            n.key === nodeKey ? { ...n, status: currentStatus as DAGNode['status'] } : n
          ),
        }
      })
    } finally {
      setUpdatingNode(null)
    }
  }

  // ── Navigate to node page ──────────────────────────────────────────────────

  const handleNodeClick = (node: DAGNode) => {
    if (node.page_route) {
      const route = node.page_route.replace('{id}', selectedStudy.id)
      navigate(route)
    }
  }

  // ── Organize nodes by phase ────────────────────────────────────────────────

  const phaseColumns = useMemo(() => {
    if (!dagData) return []
    return PHASE_CONFIG.map(phase => ({
      ...phase,
      nodes: dagData.nodes
        .filter(n => phase.categories.includes(n.category))
        .sort((a, b) => a.order_index - b.order_index),
    }))
  }, [dagData])

  // ── Compute progress ──────────────────────────────────────────────────────

  const progress = useMemo(() => {
    if (!dagData) return { completed: 0, total: 0 }
    const total = dagData.nodes.length
    const completed = dagData.nodes.filter(n => n.status === 'completed').length
    return { completed, total }
  }, [dagData])

  // ── Compute SVG connector paths ───────────────────────────────────────────

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

      const d = `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`
      paths.push({
        id: `${edge.from_node_key}-${edge.to_node_key}`,
        d,
        from: edge.from_node_key,
        to: edge.to_node_key,
      })
    }

    setConnectorPaths(paths)
  }, [dagData])

  useEffect(() => {
    if (!dagData) return
    // Compute after DOM settles
    const timer = setTimeout(computePaths, 100)
    window.addEventListener('resize', computePaths)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', computePaths)
    }
  }, [dagData, computePaths])

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading analysis workflow...</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && !dagData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchDAG}
            className="px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <Network className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Analysis Workflow</h1>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                {selectedStudy.protocol}
                {protocolLocked && (
                  <span className="inline-flex items-center gap-1 ml-2 text-emerald-400">
                    <Lock className="h-3 w-3" /> Protocol Locked
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            <div className="flex items-center gap-2.5 px-3 py-2 bg-white/5 border border-white/8 rounded-lg">
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 tabular-nums font-medium">
                {progress.completed}/{progress.total} completed
              </span>
            </div>

            {/* Regenerate button */}
            <button
              onClick={handleRegenerate}
              disabled={regenerating || protocolLocked}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate DAG
            </button>
          </div>
        </div>
      </div>

      {/* ── DAG Visualization ─────────────────────────────────────────────── */}
      <div className="p-6 overflow-x-auto">
        <div ref={containerRef} className="relative min-w-[1100px]">
          {/* SVG connector layer */}
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#2563EB" />
              </marker>
            </defs>
            {connectorPaths.map(path => {
              const fromNode = dagData?.nodes.find(n => n.key === path.from)
              const toNode = dagData?.nodes.find(n => n.key === path.to)
              const isActive = fromNode?.status === 'completed' && toNode?.status !== 'blocked'
              return (
                <path
                  key={path.id}
                  d={path.d}
                  fill="none"
                  stroke={isActive ? '#2563EB' : '#374151'}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeDasharray={isActive ? 'none' : '4 3'}
                  markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                  opacity={isActive ? 0.7 : 0.4}
                  className="transition-all duration-300"
                />
              )
            })}
          </svg>

          {/* Phase columns */}
          <div className="flex gap-4 relative" style={{ zIndex: 2 }}>
            {phaseColumns.map(phase => (
              <div key={phase.phase} className="flex-1 min-w-[170px]">
                {/* Phase header */}
                <div className="mb-3 px-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-gray-600 tabular-nums">
                      PHASE {phase.phase}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-400">{phase.label}</p>
                </div>

                {/* Nodes */}
                <div className="space-y-3">
                  {phase.nodes.length === 0 && (
                    <div className="px-3 py-6 border border-dashed border-gray-800 rounded-lg text-center">
                      <p className="text-[10px] text-gray-700">No steps</p>
                    </div>
                  )}
                  {phase.nodes.map(node => {
                    const meta = CATEGORY_META[node.category] || CATEGORY_META.primary
                    const status = STATUS_STYLES[node.status] || STATUS_STYLES.pending
                    const IconComp = meta.icon
                    const isUpdating = updatingNode === node.key

                    return (
                      <div
                        key={node.key}
                        ref={el => { nodeRefs.current[node.key] = el }}
                        className={`
                          group relative rounded-xl border ${status.border} ${status.bg}
                          backdrop-blur-sm transition-all duration-200
                          hover:border-opacity-80 hover:shadow-lg hover:shadow-black/20
                          cursor-pointer
                        `}
                        onClick={() => handleNodeClick(node)}
                      >
                        {/* In-progress pulse ring */}
                        {node.status === 'in_progress' && (
                          <div className="absolute -inset-px rounded-xl border-2 border-blue-500/30 animate-pulse pointer-events-none" />
                        )}

                        <div className="p-3">
                          {/* Category badge + status */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: `${meta.color}20`,
                                color: meta.color,
                              }}
                            >
                              <IconComp className="h-2.5 w-2.5" />
                              {node.category.replace(/_/g, ' ')}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusToggle(node.key, node.status)
                              }}
                              disabled={protocolLocked || isUpdating}
                              className="p-1 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={`Status: ${status.label}. Click to change.`}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                              ) : node.status === 'completed' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              ) : node.status === 'in_progress' ? (
                                <Play className="h-3.5 w-3.5 text-blue-400" />
                              ) : node.status === 'blocked' ? (
                                <Lock className="h-3.5 w-3.5 text-red-400" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-gray-500" />
                              )}
                            </button>
                          </div>

                          {/* Node label */}
                          <p className="text-xs font-semibold text-white leading-snug mb-1 line-clamp-2 group-hover:text-blue-200 transition-colors">
                            {node.label}
                          </p>

                          {/* Description (truncated) */}
                          {node.description && (
                            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">
                              {node.description}
                            </p>
                          )}

                          {/* Status bar */}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${node.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                              <span className={`text-[10px] font-medium ${status.text}`}>
                                {status.label}
                              </span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-gray-700 group-hover:text-gray-400 transition-colors" />
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

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-6">
        <div className="flex items-center gap-6 px-4 py-3 bg-white/3 border border-white/6 rounded-lg">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Status</span>
          {Object.entries(STATUS_STYLES).map(([key, style]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className="text-[10px] text-gray-400 capitalize">{style.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#2563EB" strokeWidth="2" /></svg>
              <span className="text-[10px] text-gray-400">Active path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
              <span className="text-[10px] text-gray-400">Pending path</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Demo data (used when backend endpoint is not available) ─────────────────

function getDemoDAGData(projectId: string): DAGData {
  return {
    project_id: projectId,
    nodes: [
      { key: 'data_ingestion', label: 'Data Ingestion: CLARITY AD Phase 3 Dataset', category: 'data_ingestion', description: 'Import and validate source trial data', status: 'completed', order_index: 0, config: {}, page_route: `/projects/${projectId}/data-provenance` },
      { key: 'population_definition', label: 'Population Definition: ITT & mITT Cohorts', category: 'population', description: 'Define intent-to-treat and modified ITT populations', status: 'completed', order_index: 1, config: {}, page_route: `/projects/${projectId}/cohort` },
      { key: 'cohort_attrition', label: 'Cohort Attrition & Weighting', category: 'population', description: 'Apply inclusion/exclusion criteria and IPTW weights', status: 'in_progress', order_index: 2, config: {}, page_route: `/projects/${projectId}/cohort` },
      { key: 'primary_endpoint', label: 'Primary Endpoint: CDR-SB Change', category: 'primary', description: 'CDR Sum-of-Boxes change from baseline at 18 months', status: 'pending', order_index: 3, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'secondary_cognitive', label: 'Secondary: ADAS-Cog14', category: 'secondary', description: 'Cognitive subscale assessment over treatment period', status: 'pending', order_index: 4, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'secondary_functional', label: 'Secondary: ADCS-iADL', category: 'secondary', description: 'Functional independence daily living score', status: 'pending', order_index: 5, config: {}, page_route: `/projects/${projectId}/effect-estimation` },
      { key: 'subgroup_apoe4', label: 'Subgroup: ApoE4 Carrier Status', category: 'subgroup', description: 'Stratified analysis by ApoE4 genotype', status: 'pending', order_index: 6, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'sensitivity_tipping', label: 'Sensitivity: Tipping Point Analysis', category: 'sensitivity', description: 'Assess robustness under missing data assumptions', status: 'pending', order_index: 7, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'safety_aria', label: 'Safety: ARIA-E/H Monitoring', category: 'safety', description: 'Amyloid-related imaging abnormalities surveillance', status: 'pending', order_index: 8, config: {}, page_route: `/projects/${projectId}/bias-sensitivity` },
      { key: 'regulatory_package', label: 'Evidence Package: eCTD Module 5', category: 'output', description: 'Compile regulatory submission dossier', status: 'pending', order_index: 9, config: {}, page_route: `/projects/${projectId}/regulatory-output` },
    ],
    edges: [
      { from_node_key: 'data_ingestion', to_node_key: 'population_definition', edge_type: 'dependency' },
      { from_node_key: 'population_definition', to_node_key: 'cohort_attrition', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'primary_endpoint', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'secondary_cognitive', edge_type: 'dependency' },
      { from_node_key: 'cohort_attrition', to_node_key: 'secondary_functional', edge_type: 'dependency' },
      { from_node_key: 'primary_endpoint', to_node_key: 'subgroup_apoe4', edge_type: 'dependency' },
      { from_node_key: 'primary_endpoint', to_node_key: 'sensitivity_tipping', edge_type: 'dependency' },
      { from_node_key: 'secondary_cognitive', to_node_key: 'sensitivity_tipping', edge_type: 'dependency' },
      { from_node_key: 'subgroup_apoe4', to_node_key: 'safety_aria', edge_type: 'dependency' },
      { from_node_key: 'sensitivity_tipping', to_node_key: 'safety_aria', edge_type: 'dependency' },
      { from_node_key: 'safety_aria', to_node_key: 'regulatory_package', edge_type: 'dependency' },
      { from_node_key: 'secondary_functional', to_node_key: 'regulatory_package', edge_type: 'dependency' },
    ],
  }
}
