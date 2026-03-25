/**
 * Afarensis External Control Validation Suite
 * Prespecified Comparability Assessment Workflow
 * 8-Stage SAR Generation Pipeline
 */

import React, { useState, useEffect } from 'react'
import { useSARPipeline, useSARMutations } from '../services/hooks'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  CheckCircle2, Loader2, Circle, Database, FlaskConical,
  BarChart3, Target, TrendingUp, GitBranch, Package,
  FileText, Shield, Download, ChevronRight, AlertTriangle,
  BookOpen, Search, Users, Activity, Microscope, Brain,
  ArrowRight, Lock, Sparkles, Info, ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ─── Stage definitions ───────────────────────────────────────────────────────

type StageStatus = 'complete' | 'active' | 'pending'

interface Stage {
  id: number
  label: string
  shortLabel: string
  icon: React.ElementType
  status: StageStatus
}

const STAGES: Stage[] = [
  { id: 1, label: 'Data Ingestion & Cohort Construction',  shortLabel: 'Data Ingestion',    icon: Database,     status: 'complete' },
  { id: 2, label: 'Endpoint Harmonization & Validation',   shortLabel: 'Endpoints',         icon: FlaskConical, status: 'complete' },
  { id: 3, label: 'Propensity Model & Weighting',          shortLabel: 'Propensity',        icon: BarChart3,    status: 'complete' },
  { id: 4, label: 'Primary Estimand & Effect Estimation',  shortLabel: 'Effect Est.',       icon: Target,       status: 'complete' },
  { id: 5, label: 'Sensitivity Analyses',                  shortLabel: 'Sensitivity',       icon: TrendingUp,   status: 'complete' },
  { id: 6, label: 'Quantitative Bias Analysis',            shortLabel: 'Bias Analysis',     icon: GitBranch,    status: 'complete' },
  { id: 7, label: 'Reproducibility Artifact Packaging',    shortLabel: 'Reproducibility',   icon: Package,      status: 'active'   },
  { id: 8, label: 'Report Assembly',                       shortLabel: 'Report Assembly',   icon: FileText,     status: 'pending'  },
]

// ─── Forest plot data ────────────────────────────────────────────────────────

const FOREST_ROWS = [
  { label: 'Primary Analysis',     est: 17.8, lo: 5.1,  hi: 30.4, isPrimary: true  },
  { label: 'Alternate Matching',   est: 15.2, lo: 2.8,  hi: 27.6, isPrimary: false },
  { label: 'Post-2018 Only',       est: 19.4, lo: 6.2,  hi: 32.6, isPrimary: false },
  { label: 'Down-weight Severity', est: 16.1, lo: 3.5,  hi: 28.7, isPrimary: false },
  { label: 'Exclude Claims C',     est: 18.9, lo: 5.4,  hi: 32.4, isPrimary: false },
  { label: 'Exclude Registry A',   est: 14.3, lo: 1.2,  hi: 27.4, isPrimary: false },
]
const FOREST_XMIN = -10
const FOREST_XMAX = 40

// ─── Propensity histogram data ───────────────────────────────────────────────

const PROPENSITY_DATA = [
  { bin: '0.0–0.1', trial: 2,  external: 1  },
  { bin: '0.1–0.2', trial: 5,  external: 4  },
  { bin: '0.2–0.3', trial: 12, external: 8  },
  { bin: '0.3–0.4', trial: 18, external: 12 },
  { bin: '0.4–0.5', trial: 15, external: 16 },
  { bin: '0.5–0.6', trial: 10, external: 14 },
  { bin: '0.6–0.7', trial: 6,  external: 9  },
  { bin: '0.7–0.8', trial: 3,  external: 5  },
  { bin: '0.8–0.9', trial: 1,  external: 2  },
  { bin: '0.9–1.0', trial: 0,  external: 1  },
]

// ─── Stage tracker ───────────────────────────────────────────────────────────

const StageTracker: React.FC<{ stages: Stage[] }> = ({ stages }) => (
  <div className="overflow-x-auto pb-2">
    <div className="flex items-start min-w-max gap-0">
      {stages.map((stage, i) => {
        const Icon = stage.icon
        const isComplete = stage.status === 'complete'
        const isActive   = stage.status === 'active'
        return (
          <React.Fragment key={stage.id}>
            <div className="flex flex-col items-center w-[100px]">
              {/* Circle */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center ring-4 transition-all',
                isComplete ? 'bg-success-600 ring-success-100' :
                isActive   ? 'bg-primary-600 ring-primary-100' :
                             'bg-gray-100 ring-gray-50'
              )}>
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-white" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Icon className="h-4 w-4 text-gray-400" />
                )}
              </div>
              {/* Label */}
              <div className="mt-2 text-center">
                <p className={cn(
                  'text-[10px] font-semibold leading-tight',
                  isComplete ? 'text-success-700' :
                  isActive   ? 'text-primary-700' :
                               'text-gray-400'
                )}>{stage.shortLabel}</p>
                <p className={cn(
                  'text-[9px] mt-0.5',
                  isComplete ? 'text-success-500' :
                  isActive   ? 'text-primary-500' :
                               'text-gray-300'
                )}>
                  {isComplete ? 'Complete' : isActive ? 'In Progress' : 'Pending'}
                </p>
              </div>
            </div>
            {/* Connector line */}
            {i < stages.length - 1 && (
              <div className={cn(
                'h-0.5 w-8 mt-5 flex-shrink-0',
                stages[i + 1].status !== 'pending' || isComplete ? 'bg-success-300' : 'bg-gray-200'
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  </div>
)

// ─── Forest Plot (custom SVG) ─────────────────────────────────────────────────

const ForestPlot: React.FC = () => {
  const W = 560, H = 220
  const leftPad = 175, rightPad = 110, topPad = 24, botPad = 28
  const plotW = W - leftPad - rightPad
  const plotH = H - topPad - botPad
  const rowH = plotH / FOREST_ROWS.length

  const toX = (v: number) =>
    leftPad + ((v - FOREST_XMIN) / (FOREST_XMAX - FOREST_XMIN)) * plotW

  const nullX = toX(0)
  const tickVals = [-10, 0, 10, 20, 30, 40]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px] font-sans text-xs select-none">
        {/* Primary analysis shaded band */}
        <rect
          x={toX(FOREST_ROWS[0].lo)} y={topPad}
          width={toX(FOREST_ROWS[0].hi) - toX(FOREST_ROWS[0].lo)}
          height={plotH}
          fill="#3b5ce820" rx={2}
        />

        {/* Null line */}
        <line x1={nullX} y1={topPad - 6} x2={nullX} y2={topPad + plotH + 4}
              stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" />

        {/* Rows */}
        {FOREST_ROWS.map((row, i) => {
          const cy = topPad + (i + 0.5) * rowH
          const xLo = toX(row.lo), xHi = toX(row.hi), xEst = toX(row.est)
          const isPrim = row.isPrimary
          return (
            <g key={row.label}>
              {/* Row bg */}
              {i % 2 === 0 && (
                <rect x={0} y={topPad + i * rowH} width={W} height={rowH} fill="#f9fafb" />
              )}
              {/* Highlight primary */}
              {isPrim && (
                <rect x={0} y={topPad + i * rowH} width={W} height={rowH} fill="#eff5ff" />
              )}

              {/* Label */}
              <text x={leftPad - 8} y={cy + 4} textAnchor="end"
                    fontSize={isPrim ? 10 : 9}
                    fontWeight={isPrim ? '700' : '400'}
                    fill={isPrim ? '#1e3a8a' : '#374151'}>
                {row.label}
              </text>

              {/* CI line */}
              <line x1={xLo} y1={cy} x2={xHi} y2={cy}
                    stroke={isPrim ? '#2e47d5' : '#6b7280'} strokeWidth={isPrim ? 2 : 1.5} />

              {/* CI caps */}
              <line x1={xLo} y1={cy - 4} x2={xLo} y2={cy + 4}
                    stroke={isPrim ? '#2e47d5' : '#6b7280'} strokeWidth={1.5} />
              <line x1={xHi} y1={cy - 4} x2={xHi} y2={cy + 4}
                    stroke={isPrim ? '#2e47d5' : '#6b7280'} strokeWidth={1.5} />

              {/* Point estimate diamond */}
              <polygon
                points={`${xEst},${cy - 6} ${xEst + 6},${cy} ${xEst},${cy + 6} ${xEst - 6},${cy}`}
                fill={isPrim ? '#2e47d5' : '#64748b'}
              />

              {/* Right label */}
              <text x={W - rightPad + 8} y={cy + 4} fontSize={9}
                    fill={isPrim ? '#1e3a8a' : '#6b7280'}
                    fontWeight={isPrim ? '700' : '400'}>
                {row.est.toFixed(1)}% [{row.lo.toFixed(1)}%, {row.hi.toFixed(1)}%]
              </text>
            </g>
          )
        })}

        {/* X axis */}
        <line x1={leftPad} y1={topPad + plotH} x2={leftPad + plotW} y2={topPad + plotH}
              stroke="#d1d5db" strokeWidth={1} />
        {tickVals.map(v => {
          const x = toX(v)
          return (
            <g key={v}>
              <line x1={x} y1={topPad + plotH} x2={x} y2={topPad + plotH + 4}
                    stroke="#d1d5db" strokeWidth={1} />
              <text x={x} y={topPad + plotH + 14} textAnchor="middle" fontSize={8} fill="#9ca3af">
                {v}%
              </text>
            </g>
          )
        })}

        {/* X axis label */}
        <text x={leftPad + plotW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#6b7280">
          Risk Difference (%) — Favors Treatment →
        </text>

        {/* Column headers */}
        <text x={leftPad - 8} y={topPad - 8} textAnchor="end" fontSize={9} fontWeight="700" fill="#374151">Analysis</text>
        <text x={W - rightPad + 8} y={topPad - 8} fontSize={9} fontWeight="700" fill="#374151">Est. [95% CI]</text>
      </svg>
    </div>
  )
}

// ─── Causal DAG (SVG) ────────────────────────────────────────────────────────

const CausalDAG: React.FC = () => {
  // Node positions [x, y, label, color]
  const nodes: { x: number; y: number; label: string; color: string; textColor: string }[] = [
    { x: 60,  y: 50,  label: 'Genetics',      color: '#f3f4f6', textColor: '#374151' },
    { x: 200, y: 20,  label: 'Age',            color: '#f3f4f6', textColor: '#374151' },
    { x: 60,  y: 130, label: 'Severity Score', color: '#f3f4f6', textColor: '#374151' },
    { x: 200, y: 100, label: 'Treatment',      color: '#dbeafe', textColor: '#1e40af' },
    { x: 340, y: 70,  label: 'Outcome',        color: '#dcfce7', textColor: '#15803d' },
  ]
  // Edges: [fromIdx, toIdx, dashed]
  const edges: { from: number; to: number; dashed: boolean }[] = [
    { from: 0, to: 2, dashed: false }, // Genetics → Severity
    { from: 0, to: 4, dashed: true  }, // Genetics → Outcome (unmeasured)
    { from: 1, to: 3, dashed: false }, // Age → Treatment
    { from: 1, to: 4, dashed: false }, // Age → Outcome
    { from: 2, to: 3, dashed: false }, // Severity → Treatment
    { from: 2, to: 4, dashed: false }, // Severity → Outcome
    { from: 3, to: 4, dashed: false }, // Treatment → Outcome
  ]

  const nw = 90, nh = 28
  const nc = (n: { x: number; y: number }) => ({ cx: n.x + nw / 2, cy: n.y + nh / 2 })

  // Simple arrow endpoint offset
  const edgePts = (e: { from: number; to: number }) => {
    const f = nc(nodes[e.from]), t = nc(nodes[e.to])
    const dx = t.cx - f.cx, dy = t.cy - f.cy
    const len = Math.sqrt(dx * dx + dy * dy)
    const ux = dx / len, uy = dy / len
    return {
      x1: f.cx + ux * (nw / 2 + 2),
      y1: f.cy + uy * (nh / 2 + 2),
      x2: t.cx - ux * (nw / 2 + 6),
      y2: t.cy - uy * (nh / 2 + 6),
    }
  }

  return (
    <svg viewBox="0 0 460 180" className="w-full max-w-[460px] font-sans">
      <defs>
        <marker id="arrowBlack" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#6b7280" />
        </marker>
        <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
        </marker>
      </defs>

      {/* Unmeasured confounder label */}
      <text x={5} y={170} fontSize={9} fill="#ef4444" fontStyle="italic">
        — — Unmeasured pathway
      </text>

      {/* Edges */}
      {edges.map((e, i) => {
        const pts = edgePts(e)
        return (
          <line key={i}
            x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
            stroke={e.dashed ? '#ef4444' : '#6b7280'}
            strokeWidth={e.dashed ? 1.5 : 1.5}
            strokeDasharray={e.dashed ? '5 3' : undefined}
            markerEnd={e.dashed ? 'url(#arrowRed)' : 'url(#arrowBlack)'}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map((n) => (
        <g key={n.label}>
          <rect x={n.x} y={n.y} width={nw} height={nh}
                rx={6} fill={n.color} stroke={n.color === '#dbeafe' ? '#93c5fd' : n.color === '#dcfce7' ? '#86efac' : '#d1d5db'}
                strokeWidth={1.5} />
          <text x={n.x + nw / 2} y={n.y + nh / 2 + 4}
                textAnchor="middle" fontSize={10} fontWeight="600" fill={n.textColor}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// Helper: map API stage status → StageStatus type
function apiStatusToStage(apiStatus: string): StageStatus {
  if (apiStatus === 'complete') return 'complete'
  if (apiStatus === 'in_progress') return 'active'
  return 'pending'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SARPipeline: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pipeline')
  const [projectId, setProjectId] = useState('demo-sar-001')

  // Real API hooks — falls back gracefully to static STAGES if API returns nothing
  const { data: pipelineData, loading: pipelineLoading, refetch } = useSARPipeline(projectId)
  const { runStage, loading: stageRunning } = useSARMutations()

  // Derive live stages from API data (merge with static icon/label definitions)
  const liveStages: Stage[] = (() => {
    const apiStages: any[] = (pipelineData as any)?.stages ?? []
    if (!apiStages.length) return STAGES
    return STAGES.map((s, i) => ({
      ...s,
      status: apiStatusToStage(apiStages[i]?.status ?? 'pending'),
    }))
  })()

  const completedStages = liveStages.filter(s => s.status === 'complete').length
  const totalProgress = Math.round((completedStages / liveStages.length) * 100)

  const handleRunStage = async (stageName: string) => {
    try {
      await runStage(projectId, stageName)
      refetch()
    } catch (e) {
      console.error('Failed to run stage:', e)
    }
  }

  // Derived summary from API
  const apiSummary = (pipelineData as any)?.summary
  const apiHR = apiSummary?.hr ?? 0.73
  const apiCI = apiSummary?.ci ?? '0.61–0.88'

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-6 bg-primary-600 rounded-full" />
            <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">
              External Control Validation Suite
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Prespecified Comparability Assessment
          </h1>
          <p className="text-gray-500 mt-1 text-sm max-w-2xl">
            8-stage pipeline for externally controlled rare disease trials — from data ingestion through FDA submission-ready artifact packaging. Aligned with ICH E9(R1) estimand framework.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {['ICH E9(R1)', 'FDA ECT 2023', 'Rare Diseases Guidance', '21 CFR Part 11', 'Austin 2011 PSM'].map(b => (
              <Badge key={b} variant="outline" className="text-[10px] text-gray-600 border-gray-300">{b}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Project selector */}
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="demo-sar-001">Study XYZ-2024 (Demo)</option>
            <option value="demo-sar-002">GLP1-OUTCOMES-2026</option>
            <option value="demo-sar-003">ALZHEIMER-001-Phase3</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={pipelineLoading}>
            {pipelineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {pipelineLoading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> Export Report
          </Button>
          <Button size="sm">
            <Sparkles className="h-4 w-4" /> New Assessment
          </Button>
        </div>
      </div>

      {/* ── Overall Progress Bar ────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Current Assessment: {apiSummary ? `${apiSummary.treatment} vs ${apiSummary.control}` : 'Study XYZ-2024 — Rare Pediatric CNS Disorder'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {apiSummary
                  ? `Treatment N=${apiSummary.treatment_n} · Primary endpoint: ${apiSummary.primary_endpoint} · HR ${apiSummary.hr} (${apiSummary.ci})`
                  : 'SAP finalized: 2024-10-15 · PI: Dr. A. Chen · Regulatory target: FDA Pre-IND Type-C Meeting'
                }
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-2xl font-bold text-primary-700">{totalProgress}%</p>
              <p className="text-xs text-gray-400">Pipeline complete</p>
            </div>
          </div>
          <Progress value={totalProgress} className="h-2" />
          <div className="mt-3 overflow-x-auto">
            <StageTracker stages={liveStages} />
          </div>
        </CardContent>
      </Card>

      {/* ── Main Tabs ──────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pipeline">Pipeline Results</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          <TabsTrigger value="bias">Bias Analysis</TabsTrigger>
          <TabsTrigger value="reproducibility">Reproducibility</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
        </TabsList>

        {/* ── Pipeline Results ─────────────────────────────────────────── */}
        <TabsContent value="pipeline" className="space-y-5 mt-4">

          {/* Stage 1: Data Ingestion */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 bg-success-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-600" />
                  </div>
                  Stage 1 — Data Ingestion & Cohort Construction
                </CardTitle>
                <Badge variant="success">Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Source datasets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Registry A',                n: 312,   status: 'Validated', color: 'bg-primary-50 border-primary-200' },
                  { label: 'Natural History Study B',   n: 104,   status: 'Validated', color: 'bg-success-50 border-success-200' },
                  { label: 'Claims Dataset C',          n: 1614,  status: 'Validated', color: 'bg-info-50 border-info-200'     },
                ].map(ds => (
                  <div key={ds.label} className={cn('p-3 rounded-lg border', ds.color)}>
                    <p className="text-xs font-bold text-gray-700">{ds.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">n={ds.n.toLocaleString()}</p>
                    <Badge variant="success" className="mt-1 text-[10px]">{ds.status}</Badge>
                  </div>
                ))}
              </div>

              {/* Cohort funnel */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {[
                  { label: 'Total Raw',           n: '2,030', sub: 'patients across 3 sources',  color: 'bg-gray-100' },
                  { label: 'After Exclusions',    n: '340',   sub: 'eligible patients',           color: 'bg-warning-50 border border-warning-200' },
                  { label: 'Weighted Comparator', n: '22',    sub: 'ESS ≈ 18.6 (stabilized IPW)', color: 'bg-primary-50 border border-primary-200' },
                ].map((step, i) => (
                  <React.Fragment key={step.label}>
                    <div className={cn('flex-1 p-3 rounded-xl text-center', step.color)}>
                      <p className="text-2xl font-bold text-gray-900">{step.n}</p>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">{step.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{step.sub}</p>
                    </div>
                    {i < 2 && <ChevronRight className="h-5 w-5 text-gray-300 shrink-0 hidden sm:block" />}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stage 2: Endpoint Harmonization */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 bg-success-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-600" />
                  </div>
                  Stage 2 — Endpoint Harmonization & Validation
                </CardTitle>
                <Badge variant="success">Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-bold text-gray-700">Primary Endpoint</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  ≥50% lesion volume reduction at 18 months
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Sources: MRI volumetrics · Radiologic analysis · Claims code algorithmic inference
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Sensitivity', value: '91.2%', color: 'text-success-700' },
                  { label: 'Specificity', value: '88.7%', color: 'text-success-700' },
                  { label: 'PPV',         value: '85.4%', color: 'text-primary-700' },
                  { label: 'NPV',         value: '93.1%', color: 'text-success-700' },
                  { label: 'Accuracy',    value: '89.8%', color: 'text-success-700' },
                ].map(m => (
                  <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                    <p className={cn('text-xl font-bold', m.color)}>{m.value}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stage 3: Propensity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 bg-success-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-600" />
                  </div>
                  Stage 3 — Propensity Model & Weighting
                </CardTitle>
                <Badge variant="success">Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-bold text-gray-700 mb-2">Model Covariates</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Age', 'Severity Score', 'Comorbidity Index', 'Prior Therapy', 'Sex'].map(c => (
                        <span key={c} className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-[10px] font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Method',  value: 'Stabilized IPW' },
                      { label: 'Trimming', value: '1st / 99th pct' },
                      { label: 'ESS',     value: '18.6 / 22' },
                      { label: 'VIF',     value: '1.34' },
                    ].map(m => (
                      <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-500 font-medium">{m.label}</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mini propensity histogram preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Propensity Score Overlap</p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={PROPENSITY_DATA} barGap={1} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="bin" tick={{ fontSize: 8 }} tickLine={false} />
                        <YAxis tick={{ fontSize: 8 }} tickLine={false} />
                        <Bar dataKey="trial"    name="Trial"    fill="#3b5ce8" radius={[2,2,0,0]} />
                        <Bar dataKey="external" name="External" fill="#f79009" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-center">Good overlap region: 0.2–0.7</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage 4: Effect Estimation */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-6 h-6 bg-success-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-success-600" />
                  </div>
                  Stage 4 — Primary Estimand & Effect Estimation
                </CardTitle>
                <Badge variant="success">Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-[10px] text-primary-600 font-bold uppercase tracking-wider">Target Estimand</p>
                    <p className="text-sm font-bold text-primary-900 mt-1">ATT — Average Treatment Effect in the Trial Population</p>
                    <p className="text-xs text-primary-600 mt-1">ICH E9(R1) · Pre-specified before unblinding</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'HR', value: `${apiHR}`, sub: 'Point estimate', color: 'text-primary-700 font-bold' },
                      { label: '95% CI', value: apiCI, sub: 'Bootstrap', color: 'text-gray-700' },
                      { label: 'p-value', value: apiSummary?.p_value ?? '0.0009', sub: 'Two-sided', color: 'text-success-700 font-bold' },
                    ].map(m => (
                      <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-2.5 text-center">
                        <p className={cn('text-base', m.color)}>{m.value}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
                        <p className="text-[9px] text-gray-400">{m.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Simple CI visualization */}
                <div className="flex flex-col justify-center">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Effect Estimate vs Null</p>
                  <svg viewBox="0 0 240 60" className="w-full max-w-[240px]">
                    <line x1="30" y1="30" x2="210" y2="30" stroke="#e5e7eb" strokeWidth="1"/>
                    {/* Null line */}
                    <line x1="75" y1="10" x2="75" y2="50" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 2"/>
                    <text x="75" y="8" textAnchor="middle" fontSize="8" fill="#9ca3af">0%</text>
                    {/* CI */}
                    <line x1="98" y1="30" x2="185" y2="30" stroke="#2e47d5" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="98" y1="22" x2="98" y2="38" stroke="#2e47d5" strokeWidth="2"/>
                    <line x1="185" y1="22" x2="185" y2="38" stroke="#2e47d5" strokeWidth="2"/>
                    {/* Point estimate diamond */}
                    <polygon points="143,22 151,30 143,38 135,30" fill="#2e47d5"/>
                    <text x="98" y="50" textAnchor="middle" fontSize="8" fill="#6b7280">5.1%</text>
                    <text x="143" y="52" textAnchor="middle" fontSize="8" fill="#2e47d5" fontWeight="bold">17.8%</text>
                    <text x="185" y="50" textAnchor="middle" fontSize="8" fill="#6b7280">30.4%</text>
                  </svg>
                  <div className="mt-3 p-2 bg-success-50 border border-success-200 rounded-lg">
                    <p className="text-[10px] text-success-700 font-medium">
                      Bayesian check: posterior median 18.1% — consistent with frequentist estimate
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Visualizations Tab ───────────────────────────────────────── */}
        <TabsContent value="visualizations" className="space-y-5 mt-4">

          {/* Forest Plot */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  Stage 5 — Sensitivity Analysis Forest Plot
                </CardTitle>
                <Badge variant="success">6 Analyses Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-500 mb-4">
                Pre-specified battery of sensitivity analyses. All estimates favour treatment across the full panel — result is robust to analytical variation.
              </p>
              <ForestPlot />
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Analyses run',       value: '6 / 6' },
                  { label: 'All favour treatment', value: 'Yes' },
                  { label: 'Narrowest CI',         value: '[1.2%, 27.4%]' },
                  { label: 'Widest CI',            value: '[6.2%, 32.6%]' },
                  { label: 'Min point est.',       value: '14.3%' },
                  { label: 'Max point est.',       value: '19.4%' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-500">{m.label}</p>
                    <p className="text-sm font-bold text-gray-900">{m.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Propensity Score Histogram */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-warning-600" />
                Stage 3 — Propensity Score Overlap Histogram
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-500 mb-4">
                Overlap diagnostic confirming positivity assumption. Trial patients (blue) and external controls (orange) share common support in the 0.2–0.7 range — supporting valid causal inference.
              </p>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PROPENSITY_DATA} barGap={2} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10 }} label={{ value: 'Propensity Score', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <ReferenceLine x="0.2–0.3" stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Overlap zone →', position: 'top', fontSize: 9, fill: '#10b981' }} />
                    <Bar dataKey="trial"    name="Trial Patients"    fill="#3b5ce8" opacity={0.85} radius={[3,3,0,0]} />
                    <Bar dataKey="external" name="External Controls" fill="#f79009" opacity={0.85} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">Stabilized IPW · 1st/99th percentile trimming applied · ESS = 18.6</p>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Bias Analysis Tab ────────────────────────────────────────── */}
        <TabsContent value="bias" className="space-y-5 mt-4">

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-error-600" />
                  Stage 6 — Quantitative Bias Analysis
                </CardTitle>
                <Badge variant="success">Complete</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* E-value */}
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-error-50 to-warning-50 border border-error-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-error-200 shrink-0">
                        <span className="text-2xl font-bold text-error-700">1.8</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">E-Value</p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          An unmeasured confounder would need to be associated with both treatment and outcome by a factor of <strong>≥1.8×</strong> to fully explain away the observed effect.
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1.5 font-mono">VanderWeele & Ding (2017) methodology</p>
                      </div>
                    </div>
                  </div>

                  {/* Monte Carlo */}
                  <div>
                    <p className="text-xs font-bold text-gray-700 mb-2">Monte Carlo Simulations — Extreme Confounding Scenarios</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-gray-700">Scenario</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-700">Est. Bias</th>
                            <th className="text-right px-3 py-2 font-semibold text-gray-700">CI Coverage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {[
                            { scenario: 'Genotype imbalance 30%', bias: '2.1%', ci: '94.2%', ok: true },
                            { scenario: 'Measurement error 20%',  bias: '1.4%', ci: '95.8%', ok: true },
                            { scenario: 'Combined extreme',        bias: '3.8%', ci: '91.6%', ok: false },
                          ].map(r => (
                            <tr key={r.scenario} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-700">{r.scenario}</td>
                              <td className="px-3 py-2 text-right font-semibold text-warning-700">{r.bias}</td>
                              <td className={cn('px-3 py-2 text-right font-semibold', r.ok ? 'text-success-600' : 'text-warning-600')}>{r.ci}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Causal DAG */}
                <div>
                  <p className="text-xs font-bold text-gray-700 mb-2">Causal DAG — Assumed Causal Structure</p>
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <CausalDAG />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[
                      { label: 'Observed edges', note: 'Genetics → Severity, Age → Treatment/Outcome, Severity → Treatment/Outcome', color: 'text-gray-600' },
                      { label: 'Unmeasured pathway', note: 'Genetics → Outcome (dashed red) — key confounding risk', color: 'text-error-600' },
                    ].map(n => (
                      <div key={n.label} className="flex items-start gap-2">
                        <span className={cn('text-[10px] font-bold shrink-0', n.color)}>{n.label}:</span>
                        <span className="text-[10px] text-gray-500">{n.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Reproducibility Tab ──────────────────────────────────────── */}
        <TabsContent value="reproducibility" className="space-y-5 mt-4">

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />
                  Stage 7 — Reproducibility Artifact Packaging
                </CardTitle>
                <Badge variant="warning">In Progress — 60%</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={60} className="mb-5 h-2" />
              <div className="space-y-3">
                {[
                  { name: 'analysis_manifest.yaml',   status: 'complete', detail: '2.4 KB · SHA-256: 9f2a3c...',               icon: CheckCircle2,  color: 'text-success-600 bg-success-50 border-success-200' },
                  { name: 'Full R analysis scripts',   status: 'complete', detail: '847 lines · R 4.3.1 · tidyverse 2.0',      icon: CheckCircle2,  color: 'text-success-600 bg-success-50 border-success-200' },
                  { name: 'Docker environment hash',   status: 'complete', detail: 'sha256:a3f4b2c91d6e... · rocker/r-ver:4.3', icon: CheckCircle2,  color: 'text-success-600 bg-success-50 border-success-200' },
                  { name: 'Federated query logs',      status: 'active',   detail: 'Exporting node audit trails…',              icon: Loader2,       color: 'text-primary-600 bg-primary-50 border-primary-200' },
                  { name: 'Cohort lineage graph',      status: 'pending',  detail: 'Awaiting query log completion',             icon: Circle,        color: 'text-gray-400 bg-gray-50 border-gray-200' },
                ].map(artifact => {
                  const Icon = artifact.icon
                  return (
                    <div key={artifact.name} className={cn('flex items-center gap-3 p-3 rounded-lg border', artifact.color.split(' ').slice(1).join(' '))}>
                      <Icon className={cn('h-5 w-5 shrink-0', artifact.color.split(' ')[0], artifact.status === 'active' ? 'animate-spin' : '')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 font-mono">{artifact.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{artifact.detail}</p>
                      </div>
                      <Badge variant={artifact.status === 'complete' ? 'approved' : artifact.status === 'active' ? 'review' : 'secondary'} className="shrink-0 text-[10px]">
                        {artifact.status === 'complete' ? 'Done' : artifact.status === 'active' ? 'Generating' : 'Pending'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 p-3 bg-info-50 border border-info-200 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-info-600 shrink-0 mt-0.5" />
                <p className="text-xs text-info-700">
                  All artifacts will be bundled into a containerized environment, allowing regulators to re-run the complete pipeline independently. Container includes all R dependencies, raw data references, and transformation logs.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stage 8: Report Assembly */}
          <Card className="border-gray-200 opacity-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Stage 8 — Report Assembly
                </CardTitle>
                <Badge variant="secondary">Pending Stage 7</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-500 mb-4">
                Final report compilation will begin automatically once reproducibility packaging is complete.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Integrated SAR Narrative',            sub: 'FDA Pre-IND / Type-C meeting format — structured regulatory framing with precise numerical results' },
                  { label: 'Supplemental Visualizations Appendix', sub: 'Forest plot · Propensity score overlap · Causal DAG — publication-quality figures' },
                  { label: 'Unified Submission Package',            sub: 'Single document formatted for FDA Pre-IND or Type-C meeting submission' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-600">{item.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full" disabled>
                <FileText className="h-4 w-4" />
                Generate Final Report — Awaiting Stage 7
              </Button>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Capabilities Reference ───────────────────────────────────── */}
        <TabsContent value="capabilities" className="space-y-5 mt-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Core Analytical */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary-600" /> Core Analytical Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {[
                  'Prespecified comparability criterion generation (pre-unblinding SAP)',
                  'Multi-dimensional anchor candidate scoring & ranking',
                  'Quantitative bias analysis — E-value (VanderWeele & Ding)',
                  'Fragility index calculation — sensitivity to unmeasured confounding',
                  'Propensity score methodology — Austin 2011 framework',
                  'ICH E9(R1) estimand alignment (ATT, intercurrent events, population)',
                  'Regulatory vulnerability flagging — pre-submission weakness identification',
                ].map(cap => (
                  <div key={cap} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{cap}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Evidence Discovery */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4 text-info-600" /> Evidence Discovery & Extraction
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {[
                  'Literature retrieval from PubMed & clinical trial registries',
                  'LLM-powered structured data extraction from study reports',
                  'Semantic & hybrid search across heterogeneous evidence sources',
                  'ClinicalTrials.gov registry data ingestion',
                  'FDA guidance document compliance framing (ECT 2023, Rare Diseases 2023)',
                  'Patient-level & aggregate data from heterogeneous real-world sources',
                  'Cryptographic audit hashing of every transformation step',
                ].map(cap => (
                  <div key={cap} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-info-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{cap}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Review & Workflow */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-success-600" /> Review & Workflow
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {[
                  'Structured multi-reviewer decision workflows with full audit trails',
                  'Conflict resolution & consensus tracking across reviewer panel',
                  'Human-in-the-loop review interface for regulatory sign-off',
                  'GxP-compliant timestamped record of all analytical decisions',
                  '21 CFR Part 11 electronic signature & audit trail compliance',
                  'Role-based access control (Viewer / Analyst / Reviewer / Admin)',
                ].map(cap => (
                  <div key={cap} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{cap}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Reporting */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-warning-600" /> Reporting & Artifact Generation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {[
                  'FDA-style reviewer packet — NDA/BLA submission ready',
                  'ICH E9(R1)-framed analysis narratives with estimand language',
                  'Prespecified comparability assessment report (core deliverable)',
                  'Anchor candidate rankings — scored, multi-dimensional',
                  'Bias & fragility analysis — E-values, sensitivity analyses, flags',
                  'Regulatory critique memo in FDA reviewer language',
                  'Reproducibility package — YAML manifest, R scripts, Docker hash',
                  'Integrated SAR + supplemental visualizations for FDA submission',
                ].map(cap => (
                  <div key={cap} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{cap}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>

          {/* Inputs / Outputs reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-gray-500 rotate-180" /> Inputs Accepted
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {[
                    'Clinical trial protocol text / SAP draft',
                    'External cohort / natural history datasets (patient-level or aggregate)',
                    'Published literature (PubMed-indexed, regulatory precedent)',
                    'ClinicalTrials.gov registry data',
                    'FDA guidance documents (referenced for compliance framing)',
                    'User-specified comparability criteria & endpoint definitions',
                    'Study metadata: sample sizes, endpoints, covariates, enrollment windows',
                  ].map(i => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="text-primary-400 mt-0.5 shrink-0">→</span>{i}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-gray-500" /> Outputs Produced
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {[
                    'Prespecified comparability assessment report',
                    'Anchor candidate rankings (scored, multi-dimensional)',
                    'Bias & fragility analysis (E-values, sensitivity, flags)',
                    'Regulatory critique memo (FDA reviewer language)',
                    'GxP audit trail (timestamped analytical decisions)',
                    'FDA submission-ready artifact package (NDA/BLA)',
                    'Downloadable PDF / investor & regulatory-facing summary',
                    'Reproducibility bundle (YAML, R scripts, Docker hash)',
                  ].map(o => (
                    <li key={o} className="flex items-start gap-2 text-xs text-gray-700">
                      <svg className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>{o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SARPipeline
