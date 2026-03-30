import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Lock, ChevronDown, LogOut, Settings, ShieldCheck, X,
  CheckCircle2, Circle, FlaskConical, GitBranch, Database,
  Users2, BarChart2, TrendingUp, ShieldAlert, Archive,
  ClipboardList, FileOutput, Eye, Unlock, BookOpen,
  LayoutDashboard, Swords, Link2, Zap,
} from 'lucide-react'
import { useRegulatoryPressure } from '@/context/RegulatoryPressureContext'
import AfarensisLogo from '@/components/ui/AfarensisLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
// Theme toggle removed — light mode only

// ── Shared type so App.tsx can reference the same shape ─────────────────────
export interface Study {
  id: string
  protocol: string
  indication: string
  activeStep: number
  locked: boolean
  lockedAt?: string
  status: string
  estimand: string
  phase?: string
  agency?: string
  [key: string]: any
}

// Default placeholder shown only while projects load from API
export const STUDIES: Study[] = [
  {
    id: 'loading',
    protocol: 'Loading…',
    indication: '',
    activeStep: 1,
    locked: false,
    status: 'Loading',
    estimand: 'ATT',
  },
]

// ── Workflow steps ────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1,  label: 'Study Definition',        slug: 'study',                    icon: FlaskConical, sub: 'Protocol · indication · endpoint' },
  { num: 2,  label: 'Causal Framework',        slug: 'causal-framework',         icon: GitBranch,    sub: 'Estimand · DAG · covariates' },
  { num: 3,  label: 'Data Provenance',         slug: 'data-provenance',          icon: Database,     sub: 'Sources · coverage · validation' },
  { num: 4,  label: 'Cohort Construction',     slug: 'cohort',                   icon: Users2,       sub: 'Attrition funnel · weighting' },
  { num: 5,  label: 'Comparability & Balance', slug: 'comparability',            icon: BarChart2,    sub: 'SMD · overlap diagnostics' },
  { num: 6,  label: 'Effect Estimation',       slug: 'effect-estimation',        icon: TrendingUp,   sub: 'Primary result · forest plot' },
  { num: 7,  label: 'Bias & Sensitivity',      slug: 'bias-sensitivity',         icon: ShieldAlert,  sub: 'E-value · stress tests' },
  { num: 8,  label: 'Regulatory Attack',       slug: 'regulatory-attack',        icon: Swords,       sub: 'Adversarial review · robustness' },
  { num: 9,  label: 'Assumption Traceability', slug: 'assumption-traceability',  icon: Link2,        sub: 'Causal assumptions · evidence' },
  { num: 10, label: 'Reproducibility',         slug: 'reproducibility',          icon: Archive,      sub: 'Manifest · hash · lineage' },
  { num: 11, label: 'Audit Trail',             slug: 'audit',                    icon: ClipboardList, sub: 'All transformations · locked' },
  { num: 12, label: 'Regulatory Output',       slug: 'regulatory-output',        icon: FileOutput,   sub: 'SAR · export · submission' },
]

// Map step number to section key for staleness lookup
const STEP_SECTION_MAP: Record<number, string> = {
  1: 'definition', 2: 'covariates', 3: 'data_sources', 4: 'cohort',
  5: 'balance', 6: 'effect_estimation', 7: 'bias', 8: 'regulatory-attack',
  9: 'assumption-traceability', 10: 'reproducibility', 11: 'audit', 12: 'regulatory',
}

/** Build a project-scoped path */
function projectPath(projectId: string, slug: string) {
  return `/projects/${projectId}/${slug}`
}

type StepStatus = 'complete' | 'active' | 'pending' | 'locked'

function stepStatus(num: number, activeStep: number, locked: boolean): StepStatus {
  if (locked) return num <= activeStep ? 'locked' : 'pending'
  if (num < activeStep) return 'complete'
  if (num === activeStep) return 'active'
  return 'pending'
}

interface CurrentUser {
  fullName?: string
  full_name?: string
  name?: string
  email?: string
  role?: string
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  currentUser?: CurrentUser | null
  onLogout?: () => void
  studies?: Study[]
  selectedStudy: Study | null
  onStudyChange: (s: Study | null) => void
  protocolLocked: boolean
  onLockProtocol: () => void
  reviewerMode: boolean
  onToggleReviewer: () => void
  evidenceOpen?: boolean
  onToggleEvidence?: () => void
  lineageOpen?: boolean
  onToggleLineage?: () => void
  staleSteps?: Set<string>
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onToggle, currentUser, onLogout,
  studies: studiesProp,
  selectedStudy, onStudyChange,
  protocolLocked, onLockProtocol,
  reviewerMode, onToggleReviewer,
  evidenceOpen, onToggleEvidence,
  lineageOpen: _lineageOpen, onToggleLineage: _onToggleLineage,
  staleSteps,
}) => {
  const studyList = studiesProp ?? STUDIES
  const [studyOpen, setStudyOpen] = useState(false)
  const location = useLocation()
  // Dark mode toggle removed

  const displayName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'User'
  const initials = displayName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  const { pressureMode, togglePressureMode, stepRisk, confidenceScore, verdict } = useRegulatoryPressure()

  // Map step numbers to the keys used by the confidence engine
  const STEP_RISK_MAP: Record<number, string> = {
    3: 'data_provenance', 4: 'cohort', 5: 'comparability',
    6: 'effect_estimation', 7: 'bias_sensitivity',
  }

  const StatusDot = ({ num }: { num: number }) => {
    const sectionKey = STEP_SECTION_MAP[num]
    const isStale = sectionKey && staleSteps?.has(sectionKey)
    if (isStale) return <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/30 animate-pulse shrink-0" title="Upstream data changed" />

    // Pressure mode risk overlay for steps 3-7
    if (pressureMode) {
      const riskKey = STEP_RISK_MAP[num]
      const risk = riskKey ? stepRisk[riskKey] : undefined
      if (risk === 'critical') return <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse shrink-0" title="Critical attack signals" />
      if (risk === 'warning') return <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/30 shrink-0" title="Warning signals" />
    }

    const s = stepStatus(num, selectedStudy?.activeStep ?? 1, protocolLocked)
    if (s === 'locked' || s === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
    if (s === 'active') return <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-2 ring-[#2563EB]/30 shrink-0" />
    return <Circle className="h-3.5 w-3.5 text-gray-600 shrink-0" />
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onToggle} />}

      {/* Collapsed sidebar toggle — always visible when sidebar is closed on desktop */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          title="Open sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      )}

      <aside className={cn(
        'layout-sidebar flex flex-col transition-transform duration-300 ease-in-out z-40',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <AfarensisLogo size={30} color="#1A1A1B" />
              <div>
                <p className="text-gray-900 font-bold text-sm leading-tight tracking-tight">Afarensis</p>
                <p className="text-gray-500 text-[10px]">by Synthetic Ascension</p>
              </div>
            </div>
            <button onClick={onToggle} className="text-gray-500 hover:text-gray-900 p-1 rounded transition-colors" title="Collapse sidebar">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Study selector */}
          {selectedStudy ? (
            <>
              <div className="relative">
                <button
                  onClick={() => setStudyOpen(!studyOpen)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Active Study</p>
                    <p className="text-gray-900 text-xs font-bold mt-0.5 truncate">{selectedStudy.protocol}</p>
                    <p className="text-gray-500 text-[10px] truncate">{selectedStudy.indication}</p>
                  </div>
                  <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 mt-1 shrink-0 transition-transform', studyOpen && 'rotate-180')} />
                </button>

                {studyOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden">
                    {studyList.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { onStudyChange(s); setStudyOpen(false) }}
                        className={cn(
                          'w-full px-3 py-2.5 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0',
                          s.id === selectedStudy.id && 'bg-[#2563EB]/10',
                        )}
                      >
                        <p className="text-gray-900 text-xs font-semibold">{s.protocol}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5">{s.indication}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            s.locked ? 'bg-emerald-100 text-emerald-600' : 'bg-[#2563EB]/10 text-[#2563EB]'
                          )}>
                            {s.status}
                          </span>
                          {s.locked && <Lock className="h-2.5 w-2.5 text-emerald-500" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Study metadata strip */}
              <div className="flex items-center gap-3 mt-2.5 px-0.5">
                <span className="text-[10px] text-gray-500">Estimand: <span className="text-[#2563EB] font-semibold">{selectedStudy.estimand}</span></span>
                <span className="text-gray-700">·</span>
                {protocolLocked
                  ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Locked</span>
                  : <span className="text-[10px] text-gray-500 flex items-center gap-1"><Unlock className="h-2.5 w-2.5" /> Unlocked</span>
                }
              </div>
            </>
          ) : (
            <div className="px-3 py-3 bg-gray-100 border border-gray-200 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">No Active Study</p>
              <p className="text-gray-500 text-[10px] mt-1">Open a project from the dashboard to begin.</p>
            </div>
          )}
        </div>

        {/* ── Workflow steps ──────────────────────────────────────────────── */}
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
          {/* Dashboard link */}
          <Link
            to="/dashboard"
            onClick={() => { onStudyChange(null); if (window.innerWidth < 1024) onToggle() }}
            className={cn(
              'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150 mb-3',
              location.pathname === '/dashboard'
                ? 'bg-[#2563EB]/20 text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
            )}
          >
            <LayoutDashboard className={cn('h-4 w-4 shrink-0', location.pathname === '/dashboard' ? 'text-[#2563EB]' : 'text-gray-600')} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">Dashboard</p>
              {location.pathname === '/dashboard' && (
                <p className="text-[10px] text-gray-500 mt-0.5">Overview · metrics · alerts</p>
              )}
            </div>
          </Link>

          {selectedStudy ? (
            <>
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-1 pb-2">Workflow</p>

              <div className="space-y-0.5">
                {STEPS.map(step => {
                  const stepHref = projectPath(selectedStudy.id, step.slug)
                  const isActive = location.pathname === stepHref
                  const s = stepStatus(step.num, selectedStudy.activeStep, protocolLocked)
                  const isComplete = s === 'complete' || s === 'locked'
                  const isCurrentStep = s === 'active'

                  return (
                    <Link
                      key={step.num}
                      to={stepHref}
                      onClick={() => { if (window.innerWidth < 1024) onToggle() }}
                      className={cn(
                        'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150 group',
                        isActive
                          ? 'bg-[#2563EB]/20 text-gray-900'
                          : isCurrentStep
                            ? 'bg-gray-100 text-gray-900'
                            : isComplete
                              ? 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-500',
                      )}
                    >
                      {/* Step number */}
                      <span className={cn(
                        'text-[9px] font-black w-4 text-center shrink-0 tabular-nums',
                        isActive || isCurrentStep ? 'text-[#2563EB]' : isComplete ? 'text-emerald-500' : 'text-gray-700',
                      )}>
                        {String(step.num).padStart(2, '0')}
                      </span>

                      {/* Icon */}
                      <step.icon className={cn('h-3.5 w-3.5 shrink-0',
                        isActive || isCurrentStep ? 'text-[#2563EB]' : isComplete ? 'text-emerald-500/70' : 'text-gray-700',
                      )} />

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-tight truncate">{step.label}</p>
                        {isActive && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{step.sub}</p>}
                      </div>

                      {/* Status indicator */}
                      <StatusDot num={step.num} />
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="px-2 py-6 text-center">
              <FlaskConical className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Select a project from the dashboard to view its workflow.</p>
            </div>
          )}
        </nav>

        {/* ── Global Layers (ambient, not workflow steps) ────────────────── */}
        {selectedStudy && (
          <div className="px-2.5 pb-2 border-t border-gray-200 pt-2 shrink-0">
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-1 pb-1.5">Global Layers</p>
            <button
              onClick={onToggleEvidence}
              className={cn(
                'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150',
                evidenceOpen
                  ? 'bg-[#2563EB]/20 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <BookOpen className={cn('h-3.5 w-3.5 shrink-0', evidenceOpen ? 'text-[#2563EB]' : 'text-gray-600')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight">Evidence Base</p>
                <p className="text-[9px] text-gray-600 mt-0.5">Feeds the thinking</p>
              </div>
              {evidenceOpen && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0" />}
            </button>
          </div>
        )}

        {/* ── Protocol Lock ───────────────────────────────────────────────── */}
        {selectedStudy && (
          <div className="px-3 py-3 border-t border-gray-200 shrink-0">
            {protocolLocked ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-900/30 border border-emerald-700/40 rounded-lg">
                <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-emerald-400">Protocol Locked</p>
                  {selectedStudy.lockedAt && (
                    <p className="text-[9px] text-emerald-600 truncate">{new Date(selectedStudy.lockedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onLockProtocol}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-all text-blue-700 hover:text-blue-800"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">Lock Protocol</span>
              </button>
            )}

            {/* Mode toggles — side by side */}
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={onToggleReviewer}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg transition-all text-[10px] font-medium border',
                  reviewerMode
                    ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB]'
                    : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-600 hover:bg-gray-100',
                )}
                title={reviewerMode ? 'FDA Reviewer Mode: ON' : 'View as FDA Reviewer'}
              >
                <Eye className="h-3 w-3" />
                {reviewerMode ? 'Reviewer ON' : 'FDA Reviewer'}
              </button>

              <button
                onClick={togglePressureMode}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg transition-all text-[10px] font-medium border',
                  pressureMode
                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                    : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-600 hover:bg-gray-100',
                )}
                title="Toggle Regulatory Pressure Mode"
              >
                <Zap className={cn('h-3 w-3', pressureMode && 'text-red-500')} />
                {pressureMode ? (
                  <span className="flex items-center gap-1">
                    Pressure
                    <span className={cn(
                      'text-[8px] font-black px-1 py-0.5 rounded-full',
                      verdict === 'HIGH_CONFIDENCE' ? 'bg-emerald-100 text-emerald-700' :
                      verdict === 'MODERATE_CONFIDENCE' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700',
                    )}>
                      {confidenceScore}
                    </span>
                  </span>
                ) : 'Pressure'}
              </button>
            </div>
          </div>
        )}

        {/* ── User footer ─────────────────────────────────────────────────── */}
        <div className="px-3 pb-3 border-t border-gray-200 pt-3 shrink-0 bg-black/20">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-[#2563EB]/30 text-[#2563EB] text-[10px] font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-xs font-semibold leading-tight truncate">{displayName}</p>
              <p className="text-gray-500 text-[10px]">{currentUser?.role ?? 'Analyst'}</p>
            </div>
<Link to="/admin/settings" className="text-gray-600 hover:text-gray-600 p-1 transition-colors" title="Settings">
              <Settings className="h-3.5 w-3.5" />
            </Link>
            <button onClick={onLogout} className="text-gray-600 hover:text-red-400 p-1 transition-colors" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-0.5">
            <ShieldCheck className="h-3 w-3 text-[#2563EB]/60" />
            <p className="text-[9px] text-gray-700 uppercase tracking-widest">21 CFR Part 11 · GxP Active</p>
          </div>
          <div className="mt-1.5 flex items-center gap-2 px-0.5">
            <Link to="/terms" className="text-[8px] text-gray-600 hover:text-gray-500 transition-colors">Terms</Link>
            <span className="text-[8px] text-gray-700">·</span>
            <Link to="/privacy" className="text-[8px] text-gray-600 hover:text-gray-500 transition-colors">Privacy</Link>
            <span className="text-[8px] text-gray-700">·</span>
            <Link to="/policies/computational-methods" className="text-[8px] text-gray-600 hover:text-gray-500 transition-colors">Policies</Link>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
