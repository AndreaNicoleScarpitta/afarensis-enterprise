import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  GitBranch, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2,
  Plus, Info, Loader2, AlertCircle, Save,
  RefreshCw, Clock, Play, Database, Users2, BarChart2,
  TrendingUp, ShieldAlert, Network, X,
  Activity, Zap, AlertTriangle,
  Circle, ArrowRight, Terminal, Layers, Target,
} from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { apiClient } from '../services/apiClient'
import LiteratureEvidence from '@/components/ui/LiteratureEvidence'
import { COVARIATE_ROLES } from '../types/regulatoryConfig'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'
import DownstreamImpactDialog, { computeDownstreamImpacts } from '../components/ui/DownstreamImpactDialog'
import {
  CausalSpecification, CausalNode, CausalEdge, CausalNodeRole,
  AdjustmentSetResult, ROLE_META,
  EdgeRelationship, EdgeStrength,
} from '../types/causalSpec'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// ── Role visual config ─────────────────────────────────────────────────────

const ROLE_ICONS: Record<CausalNodeRole, React.ElementType> = {
  treatment:       Zap,
  outcome:         Target,
  confounder:      AlertTriangle,
  mediator:        ArrowRight,
  collider:        Circle,
  effect_modifier: TrendingUp,
  instrument:      Database,
  competing_risk:  ShieldAlert,
  censoring:       Clock,
  selection:       Users2,
  auxiliary:       BarChart2,
  time_zero:       Clock,
}

// ── Execution Event Types ──────────────────────────────────────────────────

interface ExecutionEvent {
  id: string
  run_id: string
  timestamp: string
  event_type: string
  step_name: string
  step_index?: number
  total_steps?: number
  status: 'queued' | 'running' | 'completed' | 'warning' | 'failed'
  summary: string
  details?: Record<string, unknown>
  inputs?: string[]
  outputs?: string[]
  dag_node_ref?: string
  duration_ms?: number
}

interface ExecutionRun {
  run_id: string
  started_at: string
  event_count: number
  completed: number
  failed: number
  warnings: number
  total_duration_ms: number
  steps: string[]
}

const EVENT_STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  queued:    { color: 'text-gray-400', bg: 'bg-gray-800/40', icon: Clock },
  running:  { color: 'text-blue-400', bg: 'bg-blue-900/30', icon: Play },
  completed:{ color: 'text-emerald-400', bg: 'bg-emerald-900/30', icon: CheckCircle2 },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-900/30', icon: AlertTriangle },
  failed:   { color: 'text-red-400', bg: 'bg-red-900/30', icon: AlertCircle },
}

// ── DAG Canvas Layout Engine ───────────────────────────────────────────────

function layoutCausalNodes(nodes: CausalNode[], _edges: CausalEdge[]): CausalNode[] {
  // Tier-based layout: treatment left, outcome right, confounders above, mediators middle, colliders below
  const TIER_X: Record<CausalNodeRole, number> = {
    instrument:      80,
    time_zero:       80,
    selection:       80,
    treatment:       250,
    confounder:      450,
    effect_modifier: 450,
    auxiliary:       450,
    mediator:        650,
    competing_risk:  650,
    censoring:       650,
    collider:        450,
    outcome:         850,
  }

  const TIER_Y_BASE: Record<CausalNodeRole, number> = {
    instrument:      60,
    time_zero:       180,
    selection:       300,
    treatment:       200,
    confounder:      60,
    effect_modifier: 340,
    auxiliary:       220,
    mediator:        120,
    competing_risk:  280,
    censoring:       400,
    collider:        440,
    outcome:         200,
  }

  // Count nodes per role to stack them vertically
  const roleCounts: Record<string, number> = {}

  return nodes.map(node => {
    if (node.x !== undefined && node.y !== undefined) return node

    const role = node.role
    const count = roleCounts[role] || 0
    roleCounts[role] = count + 1

    return {
      ...node,
      x: (TIER_X[role] || 400) + (count % 2) * 30,
      y: (TIER_Y_BASE[role] || 200) + count * 80,
    }
  })
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CausalFramework({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const { saving } = useStudyData(selectedStudy?.id, 'covariates')
  const staleness = useStalenessCheck(selectedStudy?.id, 'covariates')

  const [showImpactDialog, setShowImpactDialog] = useState(false)
  const { direct: directImpacts, transitive: transitiveImpacts } = computeDownstreamImpacts('covariates')
  const locked = protocolLocked

  // ── Causal Specification State ──────────────────────────────────────────
  const [spec, setSpec] = useState<CausalSpecification | null>(null)
  const [specLoading, setSpecLoading] = useState(true)
  const [specError, setSpecError] = useState<string | null>(null)
  const [specDirty, setSpecDirty] = useState(false)
  const [specSaving, setSpecSaving] = useState(false)
  const [adjustmentResult, setAdjustmentResult] = useState<AdjustmentSetResult | null>(null)
  const [derivingAdjustment, setDerivingAdjustment] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [_validationWarnings, setValidationWarnings] = useState<string[]>([])

  // ── Node/Edge editing ──────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showAddNode, setShowAddNode] = useState(false)
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [newNodeRole, setNewNodeRole] = useState<CausalNodeRole>('confounder')
  const [newNodeRationale, setNewNodeRationale] = useState('')
  const [newNodeCovariateRole, setNewNodeCovariateRole] = useState('')
  const [newNodeInclusionStatus, setNewNodeInclusionStatus] = useState('')
  const [newNodeMeasurementSource, setNewNodeMeasurementSource] = useState('')
  const [newNodeExpectedDirection, setNewNodeExpectedDirection] = useState('')
  const [showAddEdge, setShowAddEdge] = useState(false)
  const [edgeFrom, setEdgeFrom] = useState('')
  const [edgeTo, setEdgeTo] = useState('')
  const [edgeRelationship, setEdgeRelationship] = useState<EdgeRelationship>('causes')
  const [edgeStrength, setEdgeStrength] = useState<EdgeStrength>('moderate')

  // ── Lineage Panel State ────────────────────────────────────────────────
  const [lineageOpen, setLineageOpen] = useState(false)
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([])
  const [executionRuns, setExecutionRuns] = useState<ExecutionRun[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [lineageLoading, setLineageLoading] = useState(false)

  // ── DAG Canvas ─────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Load Causal Specification ──────────────────────────────────────────

  const fetchSpec = useCallback(async () => {
    if (!selectedStudy?.id) return
    try {
      setSpecLoading(true)
      setSpecError(null)
      const data = await apiClient.getCausalSpecification(selectedStudy.id)
      if (data && data.nodes && data.nodes.length > 0) {
        setSpec(data as CausalSpecification)
      } else {
        // No spec yet — provide empty template
        setSpec({
          estimand: { type: 'ATT', summary: 'Average Treatment Effect on the Treated' },
          treatment: { variable: '', levels: ['Treated', 'Control'], reference_arm: 'Control' },
          outcome: { variable: '', type: 'time-to-event', definition: '' },
          nodes: [],
          edges: [],
          assumptions: [],
        })
      }
    } catch (err) {
      setSpecError('Failed to load causal specification')
      setSpec({
        estimand: { type: 'ATT', summary: 'Average Treatment Effect on the Treated' },
        treatment: { variable: '', levels: ['Treated', 'Control'], reference_arm: 'Control' },
        outcome: { variable: '', type: 'time-to-event', definition: '' },
        nodes: [],
        edges: [],
        assumptions: [],
      })
    } finally {
      setSpecLoading(false)
    }
  }, [selectedStudy?.id])

  useEffect(() => { fetchSpec() }, [fetchSpec])

  // ── Load Execution Events ─────────────────────────────────────────────

  const fetchExecutionEvents = useCallback(async () => {
    if (!selectedStudy?.id) return
    try {
      setLineageLoading(true)
      const [eventsData, runsData] = await Promise.all([
        apiClient.getExecutionEvents(selectedStudy.id, selectedRun || undefined),
        apiClient.getExecutionRuns(selectedStudy.id),
      ])
      setExecutionEvents(eventsData?.events || [])
      setExecutionRuns(runsData?.runs || [])
    } catch {
      // Execution events may not exist yet — that's fine
      setExecutionEvents([])
      setExecutionRuns([])
    } finally {
      setLineageLoading(false)
    }
  }, [selectedStudy?.id, selectedRun])

  useEffect(() => {
    if (lineageOpen) fetchExecutionEvents()
  }, [lineageOpen, fetchExecutionEvents])

  // ── Save Causal Spec ──────────────────────────────────────────────────

  const handleSaveSpec = async () => {
    if (!selectedStudy?.id || !spec) return
    try {
      setSpecSaving(true)
      const result = await apiClient.saveCausalSpecification(selectedStudy.id, spec)
      setSpecDirty(false)
      if (result?.validation) {
        setValidationErrors(result.validation.errors || [])
        setValidationWarnings(result.validation.warnings || [])
      }
    } catch (err: any) {
      const detail = err?.detail || err?.message || 'Save failed'
      if (typeof detail === 'object' && detail.errors) {
        setValidationErrors(detail.errors)
      } else {
        setSpecError(String(detail))
      }
    } finally {
      setSpecSaving(false)
    }
  }

  // ── Derive Adjustment Set ─────────────────────────────────────────────

  const handleDeriveAdjustment = async () => {
    if (!selectedStudy?.id) return
    try {
      setDerivingAdjustment(true)
      const result = await apiClient.deriveAdjustmentSet(selectedStudy.id)
      setAdjustmentResult(result as AdjustmentSetResult)
    } catch (err: any) {
      setSpecError(err?.detail || 'Failed to derive adjustment set')
    } finally {
      setDerivingAdjustment(false)
    }
  }

  // ── Node CRUD ─────────────────────────────────────────────────────────

  const addNode = () => {
    if (!spec || !newNodeLabel.trim()) return
    const id = newNodeLabel.trim().toLowerCase().replace(/\s+/g, '_')
    const node: CausalNode = {
      id,
      label: newNodeLabel.trim(),
      role: newNodeRole,
      rationale: newNodeRationale.trim() || `Added as ${newNodeRole}`,
      measurement_status: 'measured',
      ...(newNodeRole !== 'treatment' && newNodeRole !== 'outcome' ? {
        ...(newNodeCovariateRole ? { covariateRole: newNodeCovariateRole } : {}),
        ...(newNodeInclusionStatus ? { inclusionStatus: newNodeInclusionStatus } : {}),
        ...(newNodeMeasurementSource.trim() ? { measurementSource: newNodeMeasurementSource.trim() } : {}),
        ...(newNodeExpectedDirection ? { expectedDirection: newNodeExpectedDirection } : {}),
      } : {}),
    }
    setSpec({ ...spec, nodes: [...spec.nodes, node] })
    setSpecDirty(true)
    setNewNodeLabel('')
    setNewNodeRationale('')
    setNewNodeCovariateRole('')
    setNewNodeInclusionStatus('')
    setNewNodeMeasurementSource('')
    setNewNodeExpectedDirection('')
    setShowAddNode(false)
  }

  const removeNode = (nodeId: string) => {
    if (!spec) return
    setSpec({
      ...spec,
      nodes: spec.nodes.filter(n => n.id !== nodeId),
      edges: spec.edges.filter(e => e.from_node !== nodeId && e.to_node !== nodeId),
    })
    setSpecDirty(true)
    if (selectedNode === nodeId) setSelectedNode(null)
  }

  // ── Edge CRUD ─────────────────────────────────────────────────────────

  const addEdge = () => {
    if (!spec || !edgeFrom || !edgeTo || edgeFrom === edgeTo) return
    // Check for duplicate
    if (spec.edges.some(e => e.from_node === edgeFrom && e.to_node === edgeTo)) return
    const edge: CausalEdge = {
      from_node: edgeFrom,
      to_node: edgeTo,
      relationship: edgeRelationship,
      strength: edgeStrength,
    }
    setSpec({ ...spec, edges: [...spec.edges, edge] })
    setSpecDirty(true)
    setShowAddEdge(false)
    setEdgeFrom('')
    setEdgeTo('')
  }

  const removeEdge = (fromNode: string, toNode: string) => {
    if (!spec) return
    setSpec({
      ...spec,
      edges: spec.edges.filter(e => !(e.from_node === fromNode && e.to_node === toNode)),
    })
    setSpecDirty(true)
  }

  // ── Layout computed nodes ─────────────────────────────────────────────

  const layoutNodes = useMemo(() => {
    if (!spec?.nodes?.length) return []
    return layoutCausalNodes(spec.nodes, spec.edges)
  }, [spec?.nodes, spec?.edges])

  // ── SVG dimensions ────────────────────────────────────────────────────

  const svgWidth = useMemo(() => {
    if (!layoutNodes.length) return 1000
    return Math.max(1000, Math.max(...layoutNodes.map(n => (n.x || 0) + 200)))
  }, [layoutNodes])

  const svgHeight = useMemo(() => {
    if (!layoutNodes.length) return 500
    return Math.max(500, Math.max(...layoutNodes.map(n => (n.y || 0) + 100)))
  }, [layoutNodes])

  // ── Edge paths ────────────────────────────────────────────────────────

  const edgePaths = useMemo(() => {
    if (!spec?.edges?.length || !layoutNodes.length) return []
    const nodeMap = new Map(layoutNodes.map(n => [n.id, n]))

    return spec.edges.map(edge => {
      const from = nodeMap.get(edge.from_node)
      const to = nodeMap.get(edge.to_node)
      if (!from || !to) return null

      const x1 = (from.x || 0) + 70
      const y1 = (from.y || 0) + 20
      const x2 = (to.x || 0) + 70
      const y2 = (to.y || 0) + 20

      const dx = x2 - x1
      const cp = Math.max(Math.abs(dx) * 0.3, 40)

      return {
        key: `${edge.from_node}-${edge.to_node}`,
        d: `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`,
        edge,
        relationship: edge.relationship,
        strength: edge.strength,
      }
    }).filter(Boolean) as { key: string; d: string; edge: CausalEdge; relationship: string; strength: string }[]
  }, [spec?.edges, layoutNodes])

  // ── Assumption stats ──────────────────────────────────────────────────

  const assumptionStats = useMemo(() => {
    if (!spec?.assumptions?.length) return { total: 0, tested: 0, passed: 0, failed: 0 }
    const total = spec.assumptions.length
    const tested = spec.assumptions.filter(a => a.test_result && a.test_result !== 'not_tested').length
    const passed = spec.assumptions.filter(a => a.test_result === 'passed').length
    const failed = spec.assumptions.filter(a => a.test_result === 'failed').length
    return { total, tested, passed, failed }
  }, [spec?.assumptions])

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex">
      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${lineageOpen ? 'mr-[400px]' : ''}`}>
        {/* Header */}
        <div className="border-b border-gray-200 px-8 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 02</span>
                  {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                  {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
                </div>
                <h1 className="text-xl font-bold text-gray-900">Causal Framework</h1>
                <p className="text-gray-500 text-xs mt-0.5">Causal DAG editor · adjustment set · assumptions register · execution lineage</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Save button */}
              {specDirty && !locked && (
                <button
                  onClick={handleSaveSpec}
                  disabled={specSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {specSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save DAG
                </button>
              )}
              {/* Lineage toggle */}
              <button
                onClick={() => setLineageOpen(!lineageOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${
                  lineageOpen
                    ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB]'
                    : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Terminal className="h-3 w-3" />
                Lineage
              </button>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{selectedStudy.protocol}</p>
                <p className="text-[10px] text-gray-500">Estimand: <span className="text-[#2563EB] font-semibold">{spec?.estimand?.type || selectedStudy.estimand}</span></p>
              </div>
            </div>
          </div>
        </div>

        <LiteratureEvidence categories={['covariate', 'estimand', 'general']} stepLabel="Causal Framework" />

        <StalenessBanner
          staleUpstreams={staleness.staleUpstreams}
          onAcknowledge={staleness.acknowledge}
        />

        {specLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-[#2563EB] animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading causal specification...</span>
          </div>
        )}

        {specError && (
          <div className="mx-8 mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600">Error</p>
              <p className="text-xs text-gray-500 mt-0.5">{specError}</p>
            </div>
            <button onClick={() => setSpecError(null)} className="shrink-0"><X className="h-4 w-4 text-gray-400" /></button>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-600 mb-2">Validation Errors</p>
            <ul className="space-y-1">
              {validationErrors.map((e, i) => (
                <li key={i} className="text-xs text-red-500 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />{e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-8 py-6 space-y-6">

          {/* ── Estimand Summary ──────────────────────────────────────── */}
          <div className="bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-xl p-5 max-w-5xl">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-sm font-bold text-[#2563EB]">Pre-specified Estimand: {spec?.estimand?.type || selectedStudy.estimand}</h2>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {spec?.estimand?.summary || (
                spec?.estimand?.type === 'ATT' ? 'Average Treatment Effect on the Treated — estimates the effect of treatment among patients who would receive it in practice.' :
                spec?.estimand?.type === 'ATE' ? 'Average Treatment Effect — estimates the effect averaged over the full eligible population.' :
                'Define the target estimand for the causal analysis.'
              )}
            </p>
          </div>

          {/* ── Causal DAG Canvas ─────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-[#2563EB]" />
                <h2 className="text-sm font-bold text-gray-900">Causal Directed Acyclic Graph</h2>
                <span className="text-[10px] text-gray-500 ml-2">
                  {spec?.nodes?.length || 0} nodes · {spec?.edges?.length || 0} edges
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!locked && !reviewerMode && (
                  <>
                    <button
                      onClick={() => setShowAddNode(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Node
                    </button>
                    <button
                      onClick={() => setShowAddEdge(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-400 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Edge
                    </button>
                  </>
                )}
                <button
                  onClick={handleDeriveAdjustment}
                  disabled={derivingAdjustment || !spec?.nodes?.length}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#2563EB]/40 text-[#2563EB] text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {derivingAdjustment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                  Derive Adjustment Set
                </button>
              </div>
            </div>

            {/* DAG SVG Canvas */}
            <div className="overflow-auto bg-gray-50 border border-gray-200 rounded-xl p-2">
              <div ref={containerRef} style={{ minHeight: svgHeight + 40 }}>
                {layoutNodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Network className="h-12 w-12 text-gray-600 mb-3" />
                    <p className="text-sm font-medium text-gray-500">No causal model defined yet</p>
                    <p className="text-xs text-gray-600 mt-1">Add treatment, outcome, and confounder nodes to build the DAG.</p>
                    {!locked && (
                      <button
                        onClick={() => setShowAddNode(true)}
                        className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[#2563EB]/20 hover:bg-[#2563EB]/30 border border-[#2563EB]/40 text-[#2563EB] text-xs font-bold rounded-lg transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add First Node
                      </button>
                    )}
                  </div>
                ) : (
                  <svg
                    ref={svgRef}
                    width={svgWidth}
                    height={svgHeight + 20}
                    className="w-full"
                    viewBox={`0 0 ${svgWidth} ${svgHeight + 20}`}
                  >
                    <defs>
                      <marker id="causal-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                        <polygon points="0 0, 10 4, 0 8" fill="#6b7280" />
                      </marker>
                      <marker id="causal-arrow-active" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                        <polygon points="0 0, 10 4, 0 8" fill="#2563EB" />
                      </marker>
                    </defs>

                    {/* Edges */}
                    {edgePaths.map(path => {
                      const isStrong = path.strength === 'strong'
                      const isAssumed = path.strength === 'assumed'
                      return (
                        <g key={path.key}>
                          <path
                            d={path.d}
                            fill="none"
                            stroke={isStrong ? '#2563EB' : isAssumed ? '#6b7280' : '#9ca3af'}
                            strokeWidth={isStrong ? 2.5 : 1.5}
                            strokeDasharray={isAssumed ? '6 4' : 'none'}
                            markerEnd={isStrong ? 'url(#causal-arrow-active)' : 'url(#causal-arrow)'}
                            opacity={0.7}
                            className="transition-all duration-200 cursor-pointer hover:opacity-100"
                            onClick={() => !locked && removeEdge(path.edge.from_node, path.edge.to_node)}
                          />
                          {/* Edge label */}
                          {(() => {
                            const parts = path.d.split(' ')
                            const mx = ((parseFloat(parts[1] || '0') + parseFloat(parts[7] || parts[5] || '0')) / 2)
                            const my = ((parseFloat(parts[2] || '0') + parseFloat(parts[8] || parts[6] || '0')) / 2) - 6
                            return (
                              <text x={mx} y={my} textAnchor="middle"
                                className="text-[8px] fill-gray-500 select-none pointer-events-none">
                                {path.relationship}
                              </text>
                            )
                          })()}
                        </g>
                      )
                    })}

                    {/* Nodes */}
                    {layoutNodes.map(node => {
                      const meta = ROLE_META[node.role]
                      const Icon = ROLE_ICONS[node.role] || Circle
                      const isSelected = selectedNode === node.id
                      const isInAdjustment = adjustmentResult?.adjustment_set?.includes(node.id)
                      const isUnmeasured = node.measurement_status === 'unmeasured'

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x || 0}, ${node.y || 0})`}
                          className="cursor-pointer"
                          onClick={() => setSelectedNode(isSelected ? null : node.id)}
                        >
                          {/* Selection ring */}
                          {isSelected && (
                            <rect
                              x={-4} y={-4} width={148} height={48} rx={14}
                              fill="none" stroke="#2563EB" strokeWidth={2}
                              strokeDasharray="4 2" className="animate-pulse"
                            />
                          )}
                          {/* Adjustment set indicator */}
                          {isInAdjustment && (
                            <rect
                              x={-3} y={-3} width={146} height={46} rx={13}
                              fill="none" stroke="#10b981" strokeWidth={2}
                            />
                          )}
                          {/* Node body */}
                          <rect
                            x={0} y={0} width={140} height={40} rx={10}
                            fill={`${meta.color}15`}
                            stroke={meta.color}
                            strokeWidth={isSelected ? 2 : 1}
                            strokeDasharray={isUnmeasured ? '4 3' : 'none'}
                          />
                          {/* Role icon */}
                          <circle cx={16} cy={20} r={8} fill={`${meta.color}30`} />
                          <foreignObject x={9} y={13} width={14} height={14}>
                            <div className="flex items-center justify-center w-full h-full" style={{ color: meta.color }}>
                              <Icon style={{ width: 10, height: 10 }} />
                            </div>
                          </foreignObject>
                          {/* Node label */}
                          <text x={30} y={16} className="text-[10px] font-bold select-none" fill={meta.color}>
                            {node.label.length > 16 ? node.label.substring(0, 15) + '...' : node.label}
                          </text>
                          {/* Role badge */}
                          <text x={30} y={30} className="text-[8px] select-none" fill="#9ca3af">
                            {meta.label}{isUnmeasured ? ' (unmeasured)' : ''}
                          </text>
                          {/* Delete button */}
                          {isSelected && !locked && (
                            <g
                              transform="translate(125, -5)"
                              onClick={(e) => { e.stopPropagation(); removeNode(node.id) }}
                              className="cursor-pointer"
                            >
                              <circle cx={0} cy={0} r={8} fill="#ef4444" />
                              <line x1={-3} y1={-3} x2={3} y2={3} stroke="white" strokeWidth={1.5} />
                              <line x1={3} y1={-3} x2={-3} y2={3} stroke="white" strokeWidth={1.5} />
                            </g>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-2 px-1">
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Node Roles</span>
              {(Object.entries(ROLE_META) as [CausalNodeRole, typeof ROLE_META[CausalNodeRole]][]).slice(0, 7).map(([role, meta]) => (
                <div key={role} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-[9px] text-gray-500">{meta.label}</span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#2563EB" strokeWidth="2.5" /></svg>
                  <span className="text-[9px] text-gray-500">Strong</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#9ca3af" strokeWidth="1.5" /></svg>
                  <span className="text-[9px] text-gray-500">Moderate</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="6 4" /></svg>
                  <span className="text-[9px] text-gray-500">Assumed</span>
                </div>
                {adjustmentResult && (
                  <div className="flex items-center gap-1">
                    <svg width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="3" fill="none" stroke="#10b981" strokeWidth="2" /></svg>
                    <span className="text-[9px] text-emerald-400 font-semibold">In Adjustment Set</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Adjustment Set Results ────────────────────────────────── */}
          {adjustmentResult && (
            <section className="max-w-5xl">
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-emerald-400">Derived Adjustment Set (Backdoor Criterion)</h2>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {adjustmentResult.adjustment_labels.map((label, i) => (
                    <span key={i} className="px-2.5 py-1 bg-emerald-900/40 border border-emerald-700/40 rounded-lg text-xs font-semibold text-emerald-300">
                      {label}
                    </span>
                  ))}
                  {adjustmentResult.adjustment_labels.length === 0 && (
                    <span className="text-xs text-gray-500 italic">No adjustment needed (no backdoor paths found)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-3">{adjustmentResult.explanation}</p>

                {/* Exclusion explanations */}
                {adjustmentResult.explanations?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {adjustmentResult.explanations.map((exp, i) => (
                      <p key={i} className="text-[10px] text-gray-500 flex items-start gap-1.5">
                        <Info className="h-3 w-3 shrink-0 mt-0.5 text-gray-600" />{exp}
                      </p>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {adjustmentResult.warnings?.length > 0 && (
                  <div className="space-y-1 mt-3 pt-3 border-t border-emerald-700/20">
                    {adjustmentResult.warnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Excluded variables */}
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-emerald-700/20">
                  {adjustmentResult.excluded_mediators?.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">Excluded Mediators</span>
                      <div className="flex gap-1 mt-1">
                        {adjustmentResult.excluded_mediators.map((m, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-purple-900/30 border border-purple-700/30 rounded text-[9px] text-purple-300">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {adjustmentResult.excluded_colliders?.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-pink-400 uppercase tracking-wider">Excluded Colliders</span>
                      <div className="flex gap-1 mt-1">
                        {adjustmentResult.excluded_colliders.map((c, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-pink-900/30 border border-pink-700/30 rounded text-[9px] text-pink-300">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {adjustmentResult.excluded_instruments?.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Excluded Instruments</span>
                      <div className="flex gap-1 mt-1">
                        {adjustmentResult.excluded_instruments.map((iv, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-indigo-900/30 border border-indigo-700/30 rounded text-[9px] text-indigo-300">{iv}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Assumptions Register ──────────────────────────────────── */}
          <section className="max-w-5xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-bold text-gray-900">Causal Assumptions Register</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-gray-500">{assumptionStats.total} assumptions</span>
                <span className="text-emerald-400">{assumptionStats.passed} passed</span>
                <span className="text-red-400">{assumptionStats.failed} failed</span>
                <span className="text-gray-600">{assumptionStats.total - assumptionStats.tested} untested</span>
              </div>
            </div>

            {spec?.assumptions && spec.assumptions.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100/80 border-b border-gray-200">
                    <tr>
                      {['Assumption', 'Testable', 'Test Result', 'Rationale'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-bold uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spec.assumptions.map((a, i) => (
                      <tr key={a.id || i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-900 font-medium max-w-[250px]">{a.description}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            a.testable ? 'text-blue-400 bg-blue-900/20' : 'text-gray-500 bg-gray-800/30'
                          }`}>
                            {a.testable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            a.test_result === 'passed' ? 'text-emerald-400 bg-emerald-900/20' :
                            a.test_result === 'failed' ? 'text-red-400 bg-red-900/20' :
                            a.test_result === 'inconclusive' ? 'text-amber-400 bg-amber-900/20' :
                            'text-gray-500 bg-gray-800/30'
                          }`}>
                            {a.test_result || 'not tested'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[300px] truncate">{a.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 bg-gray-50 border border-gray-200 rounded-xl">
                <ShieldAlert className="h-8 w-8 text-gray-600 mb-2" />
                <p className="text-xs text-gray-500">No assumptions registered yet.</p>
                <p className="text-[10px] text-gray-600 mt-1">Save the causal specification to auto-generate core assumptions.</p>
              </div>
            )}
          </section>

          {/* ── Selected Node Detail Panel ────────────────────────────── */}
          {selectedNode && spec && (() => {
            const node = spec.nodes.find(n => n.id === selectedNode)
            if (!node) return null
            const meta = ROLE_META[node.role]
            const incomingEdges = spec.edges.filter(e => e.to_node === node.id)
            const outgoingEdges = spec.edges.filter(e => e.from_node === node.id)

            return (
              <section className="max-w-5xl">
                <div className="border rounded-xl p-5" style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}08` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color }} />
                      <h3 className="text-sm font-bold" style={{ color: meta.color }}>{node.label}</h3>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    <button onClick={() => setSelectedNode(null)}>
                      <X className="h-4 w-4 text-gray-400 hover:text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{meta.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-[10px]">
                    <div>
                      <span className="font-bold text-gray-500 uppercase tracking-wider">Rationale</span>
                      <p className="text-gray-300 mt-0.5">{node.rationale}</p>
                    </div>
                    <div>
                      <span className="font-bold text-gray-500 uppercase tracking-wider">Measurement</span>
                      <p className="text-gray-300 mt-0.5">{node.measurement_status || 'measured'}</p>
                    </div>
                    {node.variable_name && (
                      <div>
                        <span className="font-bold text-gray-500 uppercase tracking-wider">Variable</span>
                        <p className="text-gray-300 mt-0.5 font-mono">{node.variable_name}</p>
                      </div>
                    )}
                    {node.data_source && (
                      <div>
                        <span className="font-bold text-gray-500 uppercase tracking-wider">Data Source</span>
                        <p className="text-gray-300 mt-0.5">{node.data_source}</p>
                      </div>
                    )}
                  </div>
                  {(incomingEdges.length > 0 || outgoingEdges.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-700/30">
                      <div className="flex gap-6">
                        {incomingEdges.length > 0 && (
                          <div>
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Incoming</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {incomingEdges.map(e => (
                                <span key={e.from_node} className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/30 rounded text-[9px] text-gray-400">
                                  {spec.nodes.find(n => n.id === e.from_node)?.label || e.from_node} ({e.relationship})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {outgoingEdges.length > 0 && (
                          <div>
                            <span className="text-[9px] font-bold text-gray-500 uppercase">Outgoing</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {outgoingEdges.map(e => (
                                <span key={e.to_node} className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700/30 rounded text-[9px] text-gray-400">
                                  {spec.nodes.find(n => n.id === e.to_node)?.label || e.to_node} ({e.relationship})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })()}

          {/* ── Navigation ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 max-w-5xl">
            <Link to={`/projects/${selectedStudy.id}/study`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
              <ChevronLeft className="h-4 w-4" /> Step 1: Study Definition
            </Link>
            <Link to={`/projects/${selectedStudy.id}/data-provenance`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              Step 3: Data Provenance <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <DownstreamImpactDialog
          open={showImpactDialog}
          onClose={() => setShowImpactDialog(false)}
          onConfirm={async () => { setShowImpactDialog(false) }}
          saving={saving}
          currentStepLabel="Causal Framework"
          directImpacts={directImpacts}
          transitiveImpacts={transitiveImpacts}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
           LINEAGE PANEL — Right-side expandable execution console
         ══════════════════════════════════════════════════════════════════ */}
      {lineageOpen && (
        <div className="fixed right-0 top-0 h-full w-[400px] bg-gray-50 border-l border-gray-200 flex flex-col z-50 shadow-2xl">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-gray-900">Execution Lineage</h3>
              <span className="text-[9px] text-gray-500 bg-gray-800/40 px-1.5 py-0.5 rounded">
                {executionEvents.length} events
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchExecutionEvents}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${lineageLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setLineageOpen(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Run selector */}
          {executionRuns.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200">
              <select
                value={selectedRun || ''}
                onChange={(e) => setSelectedRun(e.target.value || null)}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
              >
                <option value="">All Runs ({executionRuns.length})</option>
                {executionRuns.map(run => (
                  <option key={run.run_id} value={run.run_id}>
                    Run {run.run_id.slice(0, 8)} — {run.event_count} steps
                    {run.failed > 0 ? ` (${run.failed} failed)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Run summary cards */}
          {executionRuns.length > 0 && !selectedRun && (
            <div className="px-4 py-3 border-b border-gray-200 space-y-2 max-h-[200px] overflow-y-auto">
              {executionRuns.slice(0, 5).map(run => (
                <button
                  key={run.run_id}
                  onClick={() => setSelectedRun(run.run_id)}
                  className="w-full text-left bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-gray-900">
                      {run.run_id.slice(0, 8)}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px]">
                    <span className="text-emerald-400">{run.completed} completed</span>
                    {run.warnings > 0 && <span className="text-amber-400">{run.warnings} warnings</span>}
                    {run.failed > 0 && <span className="text-red-400">{run.failed} failed</span>}
                    {run.total_duration_ms > 0 && (
                      <span className="text-gray-500 ml-auto">{(run.total_duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Event stream */}
          <div className="flex-1 overflow-y-auto">
            {lineageLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 text-[#2563EB] animate-spin" />
              </div>
            )}

            {!lineageLoading && executionEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Activity className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-500">No execution events yet</p>
                <p className="text-xs text-gray-600 mt-1">Run an analysis to generate execution trace events.</p>
              </div>
            )}

            {!lineageLoading && executionEvents.length > 0 && (
              <div className="divide-y divide-gray-200">
                {executionEvents.map(event => {
                  const statusStyle = (EVENT_STATUS_STYLES[event.status] ?? EVENT_STATUS_STYLES.completed)!
                  const StatusIcon = statusStyle.icon

                  return (
                    <div key={event.id} className={`px-4 py-3 hover:bg-gray-100 transition-colors ${statusStyle.bg}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          <StatusIcon className={`h-3.5 w-3.5 ${statusStyle.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-gray-900 truncate">
                              {event.step_name}
                            </span>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${statusStyle.color}`}>
                              {event.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-relaxed">{event.summary}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[9px] text-gray-600">{event.event_type}</span>
                            {event.step_index !== undefined && event.total_steps && (
                              <span className="text-[9px] text-gray-600">
                                Step {event.step_index + 1}/{event.total_steps}
                              </span>
                            )}
                            {event.duration_ms !== undefined && (
                              <span className="text-[9px] text-gray-600">
                                {event.duration_ms < 1000 ? `${event.duration_ms}ms` : `${(event.duration_ms / 1000).toFixed(1)}s`}
                              </span>
                            )}
                            {event.dag_node_ref && (
                              <span className="text-[9px] text-[#2563EB] font-mono">
                                DAG: {event.dag_node_ref}
                              </span>
                            )}
                            <span className="text-[9px] text-gray-700 ml-auto">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {/* I/O indicators */}
                          {(event.inputs?.length || event.outputs?.length) ? (
                            <div className="flex gap-3 mt-1">
                              {event.inputs && event.inputs.length > 0 && (
                                <span className="text-[8px] text-gray-600">
                                  IN: {event.inputs.join(', ')}
                                </span>
                              )}
                              {event.outputs && event.outputs.length > 0 && (
                                <span className="text-[8px] text-gray-600">
                                  OUT: {event.outputs.join(', ')}
                                </span>
                              )}
                            </div>
                          ) : null}
                          {/* Details (expandable) */}
                          {event.details && Object.keys(event.details).length > 0 && (
                            <details className="mt-1.5">
                              <summary className="text-[9px] text-gray-600 cursor-pointer hover:text-gray-400">
                                Details ({Object.keys(event.details).length} keys)
                              </summary>
                              <pre className="mt-1 text-[8px] text-gray-600 font-mono bg-gray-900/40 rounded p-2 overflow-x-auto max-h-[100px]">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-100/50">
            <p className="text-[9px] text-gray-500 text-center">
              Execution events are logged during analysis runs and linked to the causal DAG.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           ADD NODE MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showAddNode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-[450px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Add Causal Node</h3>
              <button onClick={() => setShowAddNode(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Label</label>
                <input
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#2563EB]/60"
                  placeholder="e.g., Age at Baseline"
                  value={newNodeLabel}
                  onChange={e => setNewNodeLabel(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</label>
                <select
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                  value={newNodeRole}
                  onChange={e => setNewNodeRole(e.target.value as CausalNodeRole)}
                >
                  {(Object.entries(ROLE_META) as [CausalNodeRole, typeof ROLE_META[CausalNodeRole]][]).map(([role, meta]) => (
                    <option key={role} value={role}>{meta.label} — {meta.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rationale</label>
                <textarea
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#2563EB]/60 resize-none"
                  placeholder="Why is this variable included in the causal model?"
                  rows={2}
                  value={newNodeRationale}
                  onChange={e => setNewNodeRationale(e.target.value)}
                />
              </div>
              {/* Covariate fields — shown for non-treatment/outcome roles */}
              {newNodeRole !== 'treatment' && newNodeRole !== 'outcome' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Covariate Role</label>
                    <select
                      className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                      value={newNodeCovariateRole}
                      onChange={e => setNewNodeCovariateRole(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {COVARIATE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Inclusion Status</label>
                    <select
                      className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                      value={newNodeInclusionStatus}
                      onChange={e => setNewNodeInclusionStatus(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      <option value="included">Included</option>
                      <option value="excluded">Excluded</option>
                      <option value="under_review">Under Review</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Measurement Source</label>
                    <input
                      className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-[#2563EB]/60"
                      placeholder="e.g., EHR, Claims, Registry"
                      value={newNodeMeasurementSource}
                      onChange={e => setNewNodeMeasurementSource(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Expected Direction</label>
                    <select
                      className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                      value={newNodeExpectedDirection}
                      onChange={e => setNewNodeExpectedDirection(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      <option value="positive">Positive</option>
                      <option value="negative">Negative</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </>
              )}
              {/* Role preview */}
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: `${ROLE_META[newNodeRole].color}10` }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ROLE_META[newNodeRole].color }} />
                <span className="text-[10px] font-semibold" style={{ color: ROLE_META[newNodeRole].color }}>
                  {ROLE_META[newNodeRole].label}
                </span>
                <span className="text-[9px] text-gray-500 ml-1">{ROLE_META[newNodeRole].description}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAddNode(false)}
                className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addNode}
                disabled={!newNodeLabel.trim()}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
           ADD EDGE MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showAddEdge && spec && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-[450px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Add Causal Edge</h3>
              <button onClick={() => setShowAddEdge(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">From Node</label>
                <select
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                  value={edgeFrom}
                  onChange={e => setEdgeFrom(e.target.value)}
                >
                  <option value="">Select source node...</option>
                  {spec.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({ROLE_META[n.role].label})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">To Node</label>
                <select
                  className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                  value={edgeTo}
                  onChange={e => setEdgeTo(e.target.value)}
                >
                  <option value="">Select target node...</option>
                  {spec.nodes.filter(n => n.id !== edgeFrom).map(n => (
                    <option key={n.id} value={n.id}>{n.label} ({ROLE_META[n.role].label})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relationship</label>
                  <select
                    className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                    value={edgeRelationship}
                    onChange={e => setEdgeRelationship(e.target.value as EdgeRelationship)}
                  >
                    {['causes', 'mediates', 'confounds', 'collides', 'modifies', 'selects', 'censors', 'associates'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Strength</label>
                  <select
                    className="w-full mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#2563EB]/60"
                    value={edgeStrength}
                    onChange={e => setEdgeStrength(e.target.value as EdgeStrength)}
                  >
                    {['strong', 'moderate', 'weak', 'assumed'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAddEdge(false)}
                className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addEdge}
                disabled={!edgeFrom || !edgeTo || edgeFrom === edgeTo}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                Add Edge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
