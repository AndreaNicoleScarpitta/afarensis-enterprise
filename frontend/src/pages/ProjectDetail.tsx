import React, { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Settings,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Download,
  Search,
  Clock,
  AlertTriangle,
  Zap,
  Brain,
  Target
} from 'lucide-react'

import SmartWorkflowGuide from '../components/enhanced/SmartWorkflowGuide'
import EvidenceNetworkVisualization from '../components/enhanced/EvidenceNetworkVisualization'
import CollaborativeReview from '../components/enhanced/CollaborativeReview'
import { useProject } from '../services/hooks'

interface ProjectDetails {
  id: string
  title: string
  description: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  created_at: string
  updated_at: string
  owner_name: string
  owner_id: string
  evidence_count: number
  completion_percentage: number
  regulatory_path: string
  priority: 'high' | 'medium' | 'low'
  team_members: Array<{
    id: string
    name: string
    role: string
    avatar?: string
  }>
  recent_activity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
    user: string
  }>
  key_metrics: {
    evidence_quality_score: number
    bias_risk_level: 'low' | 'medium' | 'high'
    regulatory_confidence: number
    estimated_approval_timeline: string
  }
}

// No demo fallback — always show real data or an error state

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'analysis' | 'collaboration' | 'workflow'>('overview')

  // ─── Real API call via useProject hook ─────────────────────────────
  const { data: apiProject, loading: apiLoading, error: apiError } = useProject(id || null)

  // Map API response → local ProjectDetails shape, show error if unavailable
  const loading = apiLoading

  const project: ProjectDetails | null = useMemo(() => {
    if (apiLoading) return null

    if (apiProject && !apiError) {
      // Map from API Project schema to ProjectDetails display shape
      return {
        id: apiProject.id,
        title: apiProject.name || apiProject.title || 'Untitled Project',
        description: apiProject.description || '',
        status: (apiProject.status as ProjectDetails['status']) || 'active',
        created_at: apiProject.created_at || new Date().toISOString(),
        updated_at: apiProject.updated_at || new Date().toISOString(),
        owner_name: (apiProject as any).owner_name || 'Project Owner',
        owner_id: (apiProject as any).owner_id || apiProject.created_by || '',
        evidence_count: (apiProject as any).evidence_count ?? 0,
        completion_percentage: (apiProject as any).completion_percentage ?? 0,
        regulatory_path: (apiProject as any).regulatory_path || '',
        priority: (apiProject as any).priority || 'medium',
        team_members: (apiProject as any).team_members || [],
        recent_activity: (apiProject as any).recent_activity || [],
        key_metrics: (apiProject as any).key_metrics || {
          evidence_quality_score: 0,
          bias_risk_level: 'medium' as const,
          regulatory_confidence: 0,
          estimated_approval_timeline: 'TBD'
        },
      }
    }

    // API unavailable — return null to trigger error UI
    return null
  }, [apiProject, apiLoading, apiError])

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"
    switch (status) {
      case 'active': return `${baseClasses} bg-blue-100 text-blue-700`
      case 'completed': return `${baseClasses} bg-green-100 text-green-700`
      case 'on_hold': return `${baseClasses} bg-yellow-100 text-yellow-700`
      case 'cancelled': return `${baseClasses} bg-red-100 text-red-700`
      default: return `${baseClasses} bg-gray-100 text-gray-700`
    }
  }

  const getBiasRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-96 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
            <div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="heading-3 text-gray-900 mb-2">Project Not Found</h3>
          <p className="body-large text-gray-600 mb-8">
            The requested regulatory project could not be found.
          </p>
          <Link to="/projects" className="btn btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* API error banner — shown when project data could not be fully loaded */}
      {apiError && (
        <div className="mb-6 border border-amber-300 rounded-xl p-4 bg-amber-50/80">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                Some data may be incomplete
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Could not fully load project data from the API. Some sections may show partial information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8">
        <div className="flex-1">
          <Link 
            to="/projects" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <h1 className="heading-1">{project.title}</h1>
            <span className={getStatusBadge(project.status)}>
              {project.status.replace('_', ' ')}
            </span>
          </div>
          
          <p className="body-large text-gray-600 mb-4">
            {project.description}
          </p>
          
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {project.owner_name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {project.evidence_count} evidence items
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              {project.regulatory_path}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-4 lg:mt-0">
          <button className="btn btn-secondary">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
          <button className="btn btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'workflow', label: 'Smart Workflow', icon: Brain },
            { key: 'evidence', label: 'Evidence Network', icon: Target },
            { key: 'collaboration', label: 'Collaboration', icon: Users },
            { key: 'analysis', label: 'Analysis', icon: Zap }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Overview */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Project Progress</h3>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Overall Completion</span>
                  <span className="text-lg font-semibold">{project.completion_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${project.completion_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className={`grid grid-cols-2 gap-4 mt-6 ${''}`}>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {project.key_metrics.evidence_quality_score}%
                  </div>
                  <div className="text-sm text-gray-600">Evidence Quality</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {project.key_metrics.regulatory_confidence}%
                  </div>
                  <div className="text-sm text-gray-600">Regulatory Confidence</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className={`text-2xl font-bold ${getBiasRiskColor(project.key_metrics.bias_risk_level)}`}>
                    {project.key_metrics.bias_risk_level.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-600">Bias Risk</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {project.key_metrics.estimated_approval_timeline}
                  </div>
                  <div className="text-sm text-gray-600">Est. Approval</div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {project.recent_activity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Clock className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.description}
                      </p>
                      <p className="text-sm text-gray-600">
                        {activity.user} • {new Date(activity.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Members */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Team Members</h3>
              <div className="space-y-3">
                {project.team_members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-600">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link to={`/projects/${project.id}/evidence`} className="btn btn-secondary w-full justify-start">
                  <Search className="w-4 h-4 mr-2" />
                  Browse Evidence
                </Link>
                <Link to={`/projects/${project.id}/analysis`} className="btn btn-secondary w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Run Analysis
                </Link>
                <Link to={`/projects/${project.id}/artifacts`} className="btn btn-secondary w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Report
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workflow' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <SmartWorkflowGuide
            projectId={project.id}
            userExpertise="intermediate"
            onStepSelect={() => {}}
            onRecommendationApply={() => {}}
          />
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <EvidenceNetworkVisualization
            projectId={project.id}
            onNodeSelect={() => {}}
            onRelationshipExplore={() => {}}
          />
        </div>
      )}

      {activeTab === 'collaboration' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <CollaborativeReview
            evidenceId={project.id}
            currentUser={{ id: 'current', name: 'Current User', email: '', role: 'reviewer' as any, expertise: [], avatar: '', isOnline: true }}
            onDecisionSubmit={() => {}}
            onConflictEscalate={() => {}}
          />
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="p-8 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="heading-3 text-gray-900 mb-2">Advanced Analysis Tools</h3>
          <p className="body-large text-gray-600 mb-8">
            Access comprehensive bias analysis, comparability scoring, and regulatory assessment tools.
          </p>
          <div className="flex justify-center gap-4">
            <Link to={`/analysis/comparability?project=${project.id}`} className="btn btn-primary">
              Comparability Analysis
            </Link>
            <Link to={`/analysis/bias?project=${project.id}`} className="btn btn-secondary">
              Bias Assessment
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDetail
