import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Lock, ChevronDown, LogOut, Settings, ShieldCheck, X,
  CheckCircle2, Circle, FlaskConical, GitBranch, Database,
  Users2, BarChart2, TrendingUp, ShieldAlert, Archive,
  ClipboardList, FileOutput, Eye, Unlock, BookOpen, Sun, Moon,
  Search, PackageCheck, Microscope, FileText, LayoutDashboard,
} from 'lucide-react'
import AfarensisLogo from '@/components/ui/AfarensisLogo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'

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
  { num: 1,  label: 'Study Definition',      slug: 'study',              icon: FlaskConical, sub: 'Protocol · indication · endpoint' },
  { num: 2,  label: 'Causal Framework',      slug: 'causal-framework',   icon: GitBranch,    sub: 'Estimand · DAG · covariates' },
  { num: 3,  label: 'Data Provenance',       slug: 'data-provenance',    icon: Database,     sub: 'Sources · coverage · validation' },
  { num: 4,  label: 'Cohort Construction',   slug: 'cohort',             icon: Users2,       sub: 'Attrition funnel · weighting' },
  { num: 5,  label: 'Comparability & Balance', slug: 'comparability',   icon: BarChart2,    sub: 'SMD · overlap diagnostics' },
  { num: 6,  label: 'Effect Estimation',     slug: 'effect-estimation',  icon: TrendingUp,   sub: 'Primary result · forest plot' },
  { num: 7,  label: 'Bias & Sensitivity',    slug: 'bias-sensitivity',   icon: ShieldAlert,  sub: 'E-value · stress tests' },
  { num: 8,  label: 'Reproducibility',       slug: 'reproducibility',    icon: Archive,      sub: 'Manifest · hash · lineage' },
  { num: 9,  label: 'Audit Trail',           slug: 'audit',              icon: ClipboardList, sub: 'All transformations · locked' },
  { num: 10, label: 'Regulatory Output',     slug: 'regulatory-output',  icon: FileOutput,   sub: 'SAR · export · submission' },
]

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
  onStudyChange: (s: Study) => void
  protocolLocked: boolean
  onLockProtocol: () => void
  reviewerMode: boolean
  onToggleReviewer: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen, onToggle, currentUser, onLogout,
  studies: studiesProp,
  selectedStudy, onStudyChange,
  protocolLocked, onLockProtocol,
  reviewerMode, onToggleReviewer,
}) => {
  const studyList = studiesProp ?? STUDIES
  const [studyOpen, setStudyOpen] = useState(false)
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const displayName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'User'
  const initials = displayName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  const StatusDot = ({ num }: { num: number }) => {
    const s = stepStatus(num, selectedStudy?.activeStep ?? 1, protocolLocked)
    if (s === 'locked' || s === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
    if (s === 'active') return <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-2 ring-[#2563EB]/30 shrink-0" />
    return <Circle className="h-3.5 w-3.5 text-gray-600 shrink-0" />
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onToggle} />}

      <aside className={cn(
        'layout-sidebar flex flex-col transition-transform duration-300 ease-in-out z-40',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      )}>

        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-200 dark:border-white/8 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <AfarensisLogo size={30} color="white" />
              <div>
                <p className="text-white font-bold text-sm leading-tight tracking-tight">Afarensis</p>
                <p className="text-gray-500 text-[10px]">by Synthetic Ascension</p>
              </div>
            </div>
            <button onClick={onToggle} className="lg:hidden text-gray-500 hover:text-white p-1 rounded transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Study selector */}
          {selectedStudy ? (
            <>
              <div className="relative">
                <button
                  onClick={() => setStudyOpen(!studyOpen)}
                  className="w-full flex items-start gap-2 px-3 py-2.5 bg-gray-100 dark:bg-white/6 hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Active Study</p>
                    <p className="text-white text-xs font-bold mt-0.5 truncate">{selectedStudy.protocol}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-[10px] truncate">{selectedStudy.indication}</p>
                  </div>
                  <ChevronDown className={cn('h-3.5 w-3.5 text-gray-500 mt-1 shrink-0 transition-transform', studyOpen && 'rotate-180')} />
                </button>

                {studyOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#111112] border border-white/12 rounded-lg shadow-2xl z-50 overflow-hidden">
                    {studyList.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { onStudyChange(s); setStudyOpen(false) }}
                        className={cn(
                          'w-full px-3 py-2.5 text-left hover:bg-gray-100 dark:bg-white/6 transition-colors border-b border-white/6 last:border-0',
                          s.id === selectedStudy.id && 'bg-[#2563EB]/15',
                        )}
                      >
                        <p className="text-white text-xs font-semibold">{s.protocol}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5">{s.indication}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            s.locked ? 'bg-emerald-900/60 text-emerald-400' : 'bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60a5fa]'
                          )}>
                            {s.status}
                          </span>
                          {s.locked && <Lock className="h-2.5 w-2.5 text-emerald-400" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Study metadata strip */}
              <div className="flex items-center gap-3 mt-2.5 px-0.5">
                <span className="text-[10px] text-gray-500">Estimand: <span className="text-[#2563EB] dark:text-[#60a5fa] font-semibold">{selectedStudy.estimand}</span></span>
                <span className="text-gray-700">·</span>
                {protocolLocked
                  ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Locked</span>
                  : <span className="text-[10px] text-amber-400 flex items-center gap-1"><Unlock className="h-2.5 w-2.5" /> Unlocked</span>
                }
              </div>
            </>
          ) : (
            <div className="px-3 py-3 bg-gray-100 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">No Active Study</p>
              <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-1">Open a project from the dashboard to begin.</p>
            </div>
          )}
        </div>

        {/* ── Workflow steps ──────────────────────────────────────────────── */}
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
          {/* Dashboard link */}
          <Link
            to="/dashboard"
            onClick={() => { if (window.innerWidth < 1024) onToggle() }}
            className={cn(
              'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150 mb-3',
              location.pathname === '/dashboard'
                ? 'bg-[#2563EB]/20 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-white/5 hover:text-white',
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
              {/* Analysis DAG overview link */}
              <Link
                to={projectPath(selectedStudy.id, 'dag')}
                onClick={() => { if (window.innerWidth < 1024) onToggle() }}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150 mb-3',
                  location.pathname.endsWith('/dag')
                    ? 'bg-[#2563EB]/20 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-white/5 hover:text-white',
                )}
              >
                <GitBranch className={cn('h-4 w-4 shrink-0', location.pathname.endsWith('/dag') ? 'text-[#2563EB]' : 'text-gray-600')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-tight">Analysis DAG</p>
                  {location.pathname.endsWith('/dag') && (
                    <p className="text-[10px] text-gray-500 mt-0.5">Workflow · dependencies · status</p>
                  )}
                </div>
              </Link>

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
                          ? 'bg-[#2563EB]/20 text-white'
                          : isCurrentStep
                            ? 'bg-gray-100 dark:bg-white/5 text-white'
                            : isComplete
                              ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/5 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-100 dark:bg-white/4 hover:text-gray-500 dark:text-gray-400',
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

        {/* ── Literature Search ───────────────────────────────────────────── */}
        {selectedStudy && (
          <div className="px-2.5 pb-2 border-t border-gray-200 dark:border-white/8 pt-2 shrink-0">
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-1 pb-1.5">Evidence Base</p>
            <Link
              to={projectPath(selectedStudy.id, 'literature-search')}
              onClick={() => { if (window.innerWidth < 1024) onToggle() }}
              className={cn(
                'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left transition-all duration-150',
                location.pathname.endsWith('/literature-search')
                  ? 'bg-[#2563EB]/20 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-white/5 hover:text-white',
              )}
            >
              <BookOpen className={cn('h-3.5 w-3.5 shrink-0', location.pathname.endsWith('/literature-search') ? 'text-[#2563EB]' : 'text-gray-600')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight">Literature Search</p>
                {location.pathname.endsWith('/literature-search') && (
                  <p className="text-[10px] text-gray-500 mt-0.5">PubMed · ClinicalTrials · OpenAlex</p>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* ── Analysis Lineage ─────────────────────────────────────────── */}
        {selectedStudy && (
          <div className="px-2.5 pb-2 border-t border-gray-200 dark:border-white/8 pt-2 shrink-0">
            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest px-1 pb-1.5">Analysis Lineage</p>
            {[
              { slug: 'input-explorer', label: 'Input Explorer', sub: 'Sources · schemas · quality', icon: Search },
              { slug: 'variable-notebook', label: 'Variable Notebook', sub: 'Derivations · code lists', icon: Microscope },
              { slug: 'trace-pack', label: 'Trace Pack', sub: 'Export · checksums · eCTD', icon: PackageCheck },
            ].map(item => {
              const itemHref = projectPath(selectedStudy.id, item.slug)
              const isActive = location.pathname === itemHref
              return (
                <Link
                  key={item.slug}
                  to={itemHref}
                  onClick={() => { if (window.innerWidth < 1024) onToggle() }}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 mb-0.5',
                    isActive
                      ? 'bg-[#2563EB]/20 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-white/5 hover:text-white',
                  )}
                >
                  <item.icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-[#2563EB]' : 'text-gray-600')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight">{item.label}</p>
                    {isActive && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{item.sub}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Protocol Lock ───────────────────────────────────────────────── */}
        {selectedStudy && (
          <div className="px-3 py-3 border-t border-gray-200 dark:border-white/8 shrink-0">
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-700/40 hover:border-amber-600/60 rounded-lg transition-all text-amber-400 hover:text-amber-300"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">Lock Protocol</span>
              </button>
            )}

            {/* FDA Reviewer mode */}
            <button
              onClick={onToggleReviewer}
              className={cn(
                'w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-medium border',
                reviewerMode
                  ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB] dark:text-[#60a5fa]'
                  : 'bg-gray-100 dark:bg-white/4 border-gray-200 dark:border-white/8 text-gray-500 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:bg-white/8',
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              {reviewerMode ? 'FDA Reviewer Mode: ON' : 'View as FDA Reviewer'}
            </button>
          </div>
        )}

        {/* ── User footer ─────────────────────────────────────────────────── */}
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-white/8 pt-3 shrink-0 bg-black/20">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-[#2563EB]/30 text-[#2563EB] dark:text-[#60a5fa] text-[10px] font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold leading-tight truncate">{displayName}</p>
              <p className="text-gray-500 text-[10px]">{currentUser?.role ?? 'Analyst'}</p>
            </div>
            <button onClick={toggleTheme} className="text-gray-600 hover:text-gray-600 dark:text-gray-300 p-1 transition-colors" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <Link to="/admin/settings" className="text-gray-600 hover:text-gray-600 dark:text-gray-300 p-1 transition-colors" title="Settings">
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
            <Link to="/terms" className="text-[8px] text-gray-600 hover:text-gray-500 dark:text-gray-400 transition-colors">Terms</Link>
            <span className="text-[8px] text-gray-700">·</span>
            <Link to="/privacy" className="text-[8px] text-gray-600 hover:text-gray-500 dark:text-gray-400 transition-colors">Privacy</Link>
            <span className="text-[8px] text-gray-700">·</span>
            <Link to="/policies/computational-methods" className="text-[8px] text-gray-600 hover:text-gray-500 dark:text-gray-400 transition-colors">Policies</Link>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
