import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Lightbulb,
  ChevronRight,
  Settings,
  Target,
  Zap
} from 'lucide-react'

interface WorkflowStep {
  id: string
  title: string
  description: string
  status: 'completed' | 'current' | 'pending' | 'blocked'
  estimatedDuration: number
  aiConfidence: number
  automationAvailable: boolean
  regulatorySignificance: boolean
  qualityCheckpoints: string[]
}

interface WorkflowRecommendation {
  stepId: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  rationale: string
  estimatedImpact: number
  confidence: number
  automationSuggestion?: string
  expertConsultationRecommended: boolean
  regulatoryConsiderations: string[]
}

interface WorkflowProgress {
  projectId: string
  completedSteps: string[]
  currentStep?: string
  overallProgress: number
  estimatedCompletion: string
  qualityScore: number
  regulatoryReadiness: number
  blockers: string[]
}

interface SmartWorkflowGuideProps {
  projectId: string
  userExpertise: 'novice' | 'intermediate' | 'expert' | 'specialist'
  onStepSelect: (stepId: string) => void
  onRecommendationApply: (recommendation: WorkflowRecommendation) => void
}

const SmartWorkflowGuide: React.FC<SmartWorkflowGuideProps> = ({
  projectId,
  userExpertise,
  onStepSelect,
  onRecommendationApply
}) => {
  const [workflowData, setWorkflowData] = useState<{
    steps: WorkflowStep[]
    recommendations: WorkflowRecommendation[]
    progress: WorkflowProgress
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [showAdvancedMode, setShowAdvancedMode] = useState(userExpertise === 'expert' || userExpertise === 'specialist')

  const fetchWorkflowGuidance = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/workflow/guidance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        }
      })
      const data = await response.json()
      setWorkflowData(data)
    } catch (error) {
      console.error('Failed to fetch workflow guidance:', error)
    }
    setIsLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchWorkflowGuidance()
  }, [fetchWorkflowGuidance])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-error-600 bg-error-50'
      case 'high': return 'text-warning-600 bg-warning-50'
      case 'medium': return 'text-info-600 bg-info-50'
      case 'low': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-success-600" />
      case 'current':
        return <Circle className="w-5 h-5 text-primary-600 fill-current" />
      case 'pending':
        return <Circle className="w-5 h-5 text-gray-400" />
      case 'blocked':
        return <AlertTriangle className="w-5 h-5 text-error-600" />
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="flex items-center space-x-3">
            <div className="animate-pulse bg-gray-200 h-6 w-6 rounded"></div>
            <div className="animate-pulse bg-gray-200 h-6 w-32 rounded"></div>
          </div>
        </div>
        <div className="card-body space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!workflowData) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-4" />
          <h3 className="heading-4 mb-2">Unable to Load Workflow Guidance</h3>
          <p className="body-normal text-gray-600 mb-4">
            There was an error loading the intelligent workflow guidance.
          </p>
          <button 
            onClick={fetchWorkflowGuidance}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-6 h-6 text-primary-600" />
              <div>
                <h3 className="heading-4">Workflow Progress</h3>
                <p className="body-small text-gray-600">
                  Systematic guidance for regulatory evidence review
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAdvancedMode(!showAdvancedMode)}
              className="btn btn-secondary btn-sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvancedMode ? 'Simplified' : 'Advanced'} View
            </button>
          </div>
        </div>
        
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Overall Progress */}
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-3">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - workflowData.progress.overallProgress)}`}
                    className="text-primary-600 transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-600">
                    {Math.round(workflowData.progress.overallProgress * 100)}%
                  </span>
                </div>
              </div>
              <h4 className="heading-5">Overall Progress</h4>
              <p className="body-small text-gray-600">
                {workflowData.progress.completedSteps.length} of {workflowData.steps.length} steps completed
              </p>
            </div>

            {/* Quality Score */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-3 relative">
                <div className={`w-full h-full rounded-full flex items-center justify-center ${
                  workflowData.progress.qualityScore > 0.8 ? 'bg-success-100 text-success-600' :
                  workflowData.progress.qualityScore > 0.6 ? 'bg-warning-100 text-warning-600' :
                  'bg-error-100 text-error-600'
                }`}>
                  <Target className="w-8 h-8" />
                </div>
              </div>
              <h4 className="heading-5">Quality Score</h4>
              <p className="body-small text-gray-600">
                {Math.round(workflowData.progress.qualityScore * 100)}% evidence quality
              </p>
            </div>

            {/* Regulatory Readiness */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-3 relative">
                <div className={`w-full h-full rounded-full flex items-center justify-center ${
                  workflowData.progress.regulatoryReadiness > 0.8 ? 'bg-success-100 text-success-600' :
                  workflowData.progress.regulatoryReadiness > 0.6 ? 'bg-warning-100 text-warning-600' :
                  'bg-error-100 text-error-600'
                }`}>
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              </div>
              <h4 className="heading-5">Regulatory Readiness</h4>
              <p className="body-small text-gray-600">
                {Math.round(workflowData.progress.regulatoryReadiness * 100)}% submission ready
              </p>
            </div>

            {/* Estimated Completion */}
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-3 relative">
                <div className="w-full h-full rounded-full bg-info-100 text-info-600 flex items-center justify-center">
                  <Clock className="w-8 h-8" />
                </div>
              </div>
              <h4 className="heading-5">Est. Completion</h4>
              <p className="body-small text-gray-600">
                {new Date(workflowData.progress.estimatedCompletion).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Automated Recommendations */}
      {workflowData.recommendations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <Lightbulb className="w-6 h-6 text-warning-500" />
              <div>
                <h3 className="heading-4">Automated Recommendations</h3>
                <p className="body-small text-gray-600">
                  Intelligent suggestions to optimize your workflow
                </p>
              </div>
            </div>
          </div>
          
          <div className="card-body space-y-4">
            {workflowData.recommendations.map((recommendation) => (
              <motion.div
                key={recommendation.stepId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                        {recommendation.priority.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {Math.round(recommendation.confidence * 100)}% confidence
                      </span>
                      {recommendation.expertConsultationRecommended && (
                        <span className="text-xs text-warning-600 bg-warning-50 px-2 py-1 rounded">
                          Expert consultation recommended
                        </span>
                      )}
                    </div>
                    
                    <p className="body-normal mb-2">{recommendation.rationale}</p>
                    
                    {recommendation.automationSuggestion && showAdvancedMode && (
                      <div className="bg-primary-50 border border-primary-200 rounded p-3 mb-2">
                        <div className="flex items-center space-x-2 mb-1">
                          <Zap className="w-4 h-4 text-primary-600" />
                          <span className="text-sm font-medium text-primary-700">
                            Automation Available
                          </span>
                        </div>
                        <p className="text-sm text-primary-600">
                          {recommendation.automationSuggestion}
                        </p>
                      </div>
                    )}
                    
                    {recommendation.regulatoryConsiderations.length > 0 && showAdvancedMode && (
                      <div className="mt-2">
                        <h5 className="text-sm font-medium text-gray-700 mb-1">
                          Regulatory Considerations:
                        </h5>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {recommendation.regulatoryConsiderations.map((consideration, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-warning-500 mt-0.5">•</span>
                              <span>{consideration}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => onRecommendationApply(recommendation)}
                    className="btn btn-primary btn-sm ml-4"
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Steps */}
      <div className="card">
        <div className="card-header">
          <h3 className="heading-4">Workflow Steps</h3>
        </div>
        
        <div className="card-body">
          <div className="space-y-3">
            {workflowData.steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all
                  ${selectedStep === step.id ? 'border-primary-300 bg-primary-50' : 'border-gray-200'}
                  ${step.status === 'current' ? 'border-primary-300 bg-primary-50' : ''}
                  ${step.status === 'blocked' ? 'border-error-300 bg-error-50' : ''}
                  hover:border-primary-300
                `}
                onClick={() => {
                  setSelectedStep(selectedStep === step.id ? null : step.id)
                  onStepSelect(step.id)
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStepStatusIcon(step.status)}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="heading-5">{step.title}</h4>
                        
                        {step.regulatorySignificance && (
                          <span className="text-xs text-error-600 bg-error-50 px-2 py-1 rounded">
                            Regulatory
                          </span>
                        )}
                        
                        {step.automationAvailable && (
                          <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                            <Zap className="w-3 h-3 inline mr-1" />
                            Auto
                          </span>
                        )}
                      </div>
                      
                      <p className="body-small text-gray-600 mt-1">
                        {step.description}
                      </p>
                      
                      {showAdvancedMode && (
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {step.estimatedDuration}h
                          </span>
                          <span>
                            Confidence: {Math.round(step.aiConfidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight 
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      selectedStep === step.id ? 'rotate-90' : ''
                    }`} 
                  />
                </div>

                {/* Expanded Step Details */}
                <AnimatePresence>
                  {selectedStep === step.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-gray-200"
                    >
                      {step.qualityCheckpoints.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">
                            Quality Checkpoints:
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {step.qualityCheckpoints.map((checkpoint, idx) => (
                              <div key={idx} className="flex items-center space-x-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-success-500" />
                                <span className="text-gray-600">{checkpoint}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Blockers */}
      {workflowData.progress.blockers.length > 0 && (
        <div className="card border-error-200 bg-error-50">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-error-600" />
              <div>
                <h3 className="heading-4 text-error-800">Workflow Blockers</h3>
                <p className="body-small text-error-600">
                  Issues that need attention before proceeding
                </p>
              </div>
            </div>
          </div>
          
          <div className="card-body">
            <ul className="space-y-2">
              {workflowData.progress.blockers.map((blocker, index) => (
                <li key={index} className="flex items-center space-x-2 text-error-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartWorkflowGuide
