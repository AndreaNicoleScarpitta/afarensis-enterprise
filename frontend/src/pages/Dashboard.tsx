import React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  FileText,
  Search,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Shield,
  Activity,
  Download,
  ArrowRight,
  Loader2,
  Zap,
  ChevronRight,
} from 'lucide-react'

import { useProjects, useEvidenceList, useAuth } from '../services/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: string
  trendUp?: boolean
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
}

const colorMap = {
  blue:   { bg: 'bg-info-50',    icon: 'text-info-600',    ring: 'ring-info-100'    },
  green:  { bg: 'bg-success-50', icon: 'text-success-600', ring: 'ring-success-100' },
  orange: { bg: 'bg-warning-50', icon: 'text-warning-600', ring: 'ring-warning-100' },
  purple: { bg: 'bg-purple-50',  icon: 'text-purple-600',  ring: 'ring-purple-100'  },
  red:    { bg: 'bg-error-50',   icon: 'text-error-600',   ring: 'ring-error-100'   },
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, sub, icon: Icon, trend, trendUp, color = 'blue'
}) => {
  const c = colorMap[color]
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
          <div className={cn('p-3 rounded-xl ring-4', c.bg, c.ring)}>
            <Icon className={cn('h-5 w-5', c.icon)} />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-1.5">
            <TrendingUp
              className={cn('h-3.5 w-3.5', trendUp ? 'text-success-500' : 'text-error-500 rotate-180')}
            />
            <span className={cn('text-xs font-medium', trendUp ? 'text-success-600' : 'text-error-600')}>
              {trend}
            </span>
          </div>
        )}
      </CardContent>
      {/* Decorative corner accent */}
      <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 -translate-y-8 translate-x-8', c.bg.replace('50', '500'))} />
    </Card>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const statusVariant: Record<string, 'approved' | 'pending' | 'review' | 'draft' | 'rejected' | 'info'> = {
  completed: 'approved',
  active: 'info',
  review: 'pending',
  processing: 'review',
  draft: 'draft',
  failed: 'rejected',
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { data: projectsData, loading: projectsLoading, error: projectsError } = useProjects({
    page: 1, page_size: 5,
  })
  const { data: evidenceData, loading: evidenceLoading } = useEvidenceList({
    page: 1, page_size: 10,
  })

  const stats = {
    totalProjects:     projectsData?.total ?? 0,
    activeProjects:    projectsData?.items?.filter((p: any) => p.status === 'active').length ?? 0,
    totalEvidence:     evidenceData?.total ?? 0,
    pendingReviews:    evidenceData?.items?.filter((e: any) => e.status === 'in_review').length ?? 0,
    completedProjects: projectsData?.items?.filter((p: any) => p.status === 'completed').length ?? 0,
    aiSummaries:       evidenceData?.items?.filter((e: any) => e.aiSummary || e.ai_summary).length ?? 0,
  }

  const displayName = user?.fullName || (user as any)?.full_name || (user as any)?.name || 'Reviewer'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (projectsLoading || evidenceLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        <p className="text-gray-500 text-sm font-medium">Loading regulatory dashboard…</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (projectsError) {
    return (
      <Card className="border-error-200 bg-error-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-error-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-error-800">Failed to load dashboard</p>
              <p className="text-sm text-error-600 mt-0.5">{projectsError.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-primary-600 rounded-full" />
            <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
              Regulatory Evidence Platform
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Here's your regulatory evidence pipeline overview for today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/projects">
              <FileText className="h-4 w-4" />
              All Projects
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/search">
              <Search className="h-4 w-4" />
              New Review
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Key Metrics ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Active Projects"
          value={stats.activeProjects}
          sub={`${stats.totalProjects} total`}
          icon={FileText}
          trend={`${stats.totalProjects} in portfolio`}
          trendUp
          color="blue"
        />
        <MetricCard
          title="Evidence Records"
          value={stats.totalEvidence.toLocaleString()}
          sub={`${stats.aiSummaries} with automated summaries`}
          icon={Database}
          color="purple"
        />
        <MetricCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          icon={Clock}
          color="orange"
          trend={stats.pendingReviews > 0 ? 'Requires attention' : 'All clear'}
          trendUp={stats.pendingReviews === 0}
        />
        <MetricCard
          title="Completed"
          value={stats.completedProjects}
          sub="projects finished"
          icon={CheckCircle}
          trend="This session"
          trendUp
          color="green"
        />
      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Recent Projects (2/3 width) ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Evidence Projects</CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-primary-600 hover:text-primary-700 -mr-2">
                  <Link to="/projects">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {projectsData?.items && projectsData.items.length > 0 ? (
                <div className="space-y-1">
                  {projectsData.items.slice(0, 5).map((project: any, idx: number) => (
                    <React.Fragment key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary-200 transition-colors">
                            <FileText className="h-4 w-4 text-primary-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-primary-700">
                              {project.name || project.title || 'Untitled Project'}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {project.description || 'No description'} •{' '}
                              {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <Badge variant={statusVariant[project.status] ?? 'secondary'}>
                            {project.status}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
                        </div>
                      </Link>
                      {idx < (projectsData.items.length - 1) && idx < 4 && (
                        <Separator className="mx-3" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No projects yet</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Start your first evidence review</p>
                  <Button size="sm" asChild>
                    <Link to="/search">
                      <Search className="h-4 w-4" />
                      Start New Review
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── System Architecture Status (Demo) ─────────────────────────── */}
          <div className="border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-xl p-1">
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Demo Data — Not Connected to Live Systems
              </span>
            </div>
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-400">12-Layer Architecture</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { name: 'Research Spec',     requests: 156, operational: true  },
                    { name: 'Evidence Discovery', requests: 423, operational: true  },
                    { name: 'Evidence Extract',  requests: 1247, operational: true  },
                    { name: 'Anchor Generation', requests: 89,  operational: true  },
                    { name: 'Comparability',     requests: 234, operational: true  },
                    { name: 'Bias Analysis',     requests: 145, operational: true  },
                    { name: 'Anchor Evaluation', requests: 67,  operational: true  },
                    { name: 'Evidence Critique', requests: 34,  operational: true  },
                    { name: 'Reviewer Decision', requests: 78,  operational: true  },
                    { name: 'Reg. Artifacts',    requests: 23,  operational: true  },
                    { name: 'Federated Network', requests: 12,  operational: false },
                    { name: 'Evidence OS',       requests: 5,   operational: false },
                  ].map((layer) => (
                    <div
                      key={layer.name}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 opacity-60"
                    >
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        layer.operational ? 'bg-success-500' : 'bg-warning-400'
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{layer.name}</p>
                        <p className="text-[10px] text-gray-400">{layer.requests.toLocaleString()} req</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Right Sidebar (1/3 width) ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                {
                  to: '/search',
                  icon: Search,
                  label: 'New Evidence Review',
                  sub: 'Start protocol analysis',
                  iconBg: 'bg-primary-100',
                  iconColor: 'text-primary-600',
                },
                {
                  to: '/analysis/comparability',
                  icon: BarChart3,
                  label: 'Comparability Analysis',
                  sub: 'Score anchor candidates',
                  iconBg: 'bg-info-100',
                  iconColor: 'text-info-600',
                },
                {
                  to: '/artifacts',
                  icon: Download,
                  label: 'Generate Artifacts',
                  sub: 'SAR & FDA reviewer packets',
                  iconBg: 'bg-success-100',
                  iconColor: 'text-success-600',
                },
                {
                  to: '/network/federated',
                  icon: Activity,
                  label: 'Federated Network',
                  sub: 'Multi-site evidence',
                  iconBg: 'bg-purple-100',
                  iconColor: 'text-purple-600',
                },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-200 hover:bg-primary-50/50 transition-all group"
                >
                  <div className={cn('p-2 rounded-lg shrink-0', action.iconBg)}>
                    <action.icon className={cn('h-4 w-4', action.iconColor)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">{action.label}</p>
                    <p className="text-xs text-gray-400">{action.sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* System Health (Demo) */}
          <div className="border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-xl p-1">
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Demo Data
              </span>
            </div>
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-400">System Health</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 opacity-60">
                <div className="space-y-3">
                  {[
                    { label: 'Database',     value: 'Healthy',       ok: true,  pct: 100 },
                    { label: 'Analysis Services',  value: 'Operational',   ok: true,  pct: 98  },
                    { label: 'External APIs',value: 'Connected',     ok: true,  pct: 100 },
                    { label: 'Compliance',   value: '21 CFR Pt 11 Ready',  ok: true,  pct: 100 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                        <span className={cn('text-xs font-semibold', item.ok ? 'text-success-600' : 'text-error-600')}>
                          {item.value}
                        </span>
                      </div>
                      <Progress value={item.pct} className="h-1" />
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary-500" />
                    <span className="text-xs text-gray-500">System Uptime</span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">99.97%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Evidence Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Evidence</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {evidenceData?.items && evidenceData.items.length > 0 ? (
                <div className="space-y-3">
                  {evidenceData.items.slice(0, 4).map((evidence: any) => (
                    <div key={evidence.id} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-3.5 w-3.5 text-primary-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {evidence.title}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {evidence.source || 'Unknown source'} •{' '}
                          {evidence.createdAt || evidence.created_at
                            ? new Date(evidence.createdAt || evidence.created_at).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No recent evidence records</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
