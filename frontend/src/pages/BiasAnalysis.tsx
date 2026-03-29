import type React from 'react'
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { apiClient } from '../services/apiClient'
import { logger } from '../services/logger'
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Info,
  Download,
  Settings,
  Brain
} from 'lucide-react'

interface BiasAssessment {
  id: string
  study_title: string
  study_type: string
  overall_risk: 'low' | 'moderate' | 'high' | 'critical'
  bias_domains: Array<{
    domain: string
    risk_level: 'low' | 'moderate' | 'high' | 'critical'
    evidence: string[]
    mitigation_strategies: string[]
    regulatory_impact: string
    assessment_confidence: number
  }>
  regulatory_acceptability: string
  generated_at: string
}

const BiasAnalysis: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const [assessments, setAssessments] = useState<BiasAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null)

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const token = (apiClient as any).accessToken || ''
        const response = await fetch(`/api/v1/projects/${projectId}/bias-analysis`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setAssessments(Array.isArray(data) ? data : data.assessments || [])
        }
      } catch (err) {
        logger.error('Failed to fetch bias assessments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAssessments()
  }, [])

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600'
      case 'moderate': return 'text-orange-600'
      case 'high': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getRiskBackground = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-50 border-green-200'
      case 'moderate': return 'bg-orange-50 border-orange-200'
      case 'high': return 'bg-orange-50 border-orange-200'
      case 'critical': return 'bg-red-50 border-red-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'moderate': return <Info className="w-5 h-5 text-orange-500" />
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Info className="w-5 h-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const selectedData = assessments.find(a => a.id === selectedAssessment) || assessments[0]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="heading-1 mb-2">Bias Risk Assessment</h1>
          <p className="body-large text-gray-600">
            Comprehensive analysis of potential biases in clinical evidence for regulatory review
          </p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 lg:mt-0">
          <button className="btn btn-secondary">
            <Settings className="w-4 h-4 mr-2" />
            Configure Domains
          </button>
          <button className="btn btn-primary">
            <Brain className="w-4 h-4 mr-2" />
            Run Bias Assessment
          </button>
        </div>
      </div>

      {assessments.length > 0 && selectedData && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Assessment List */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="font-medium">Bias Assessments</h3>
              </div>
              <div className="divide-y">
                {assessments.map((assessment) => (
                  <button
                    key={assessment.id}
                    onClick={() => setSelectedAssessment(assessment.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedAssessment === assessment.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getRiskIcon(assessment.overall_risk)}
                      <span className={`text-sm font-medium uppercase ${getRiskColor(assessment.overall_risk)}`}>
                        {assessment.overall_risk} RISK
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium line-clamp-2">{assessment.study_title}</div>
                      <div className="text-xs mt-1">{assessment.study_type}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="xl:col-span-3 space-y-6">
            {/* Overall Risk Card */}
            <div className={`rounded-lg border-2 p-6 ${getRiskBackground(selectedData.overall_risk)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="heading-2 mb-2">Overall Bias Risk Assessment</h2>
                  <p className="text-gray-600 line-clamp-1">{selectedData.study_title}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  {getRiskIcon(selectedData.overall_risk)}
                  <div>
                    <div className={`text-2xl font-bold uppercase ${getRiskColor(selectedData.overall_risk)}`}>
                      {selectedData.overall_risk}
                    </div>
                    <div className="text-sm text-gray-600">Risk Level</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white bg-opacity-60 rounded-lg p-4">
                <h4 className="font-medium mb-2">Regulatory Acceptability</h4>
                <p className="text-sm text-gray-700">{selectedData.regulatory_acceptability}</p>
              </div>
            </div>

            {/* Bias Domain Analysis */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="heading-3 mb-2">Bias Domain Analysis</h3>
                <p className="text-gray-600">
                  Detailed assessment across key bias domains with systematic risk detection
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {selectedData.bias_domains.map((domain, index) => (
                    <div key={index} className={`border-2 rounded-lg p-5 ${getRiskBackground(domain.risk_level)}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          {getRiskIcon(domain.risk_level)}
                          <div>
                            <h4 className="font-semibold text-gray-900">{domain.domain}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                              <span className={`font-medium uppercase ${getRiskColor(domain.risk_level)}`}>
                                {domain.risk_level} Risk
                              </span>
                              <span>Assessment Confidence: {domain.assessment_confidence}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* Evidence */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Evidence:</h5>
                          <ul className="space-y-1">
                            {domain.evidence.map((item, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Mitigation Strategies */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Mitigation Strategies:</h5>
                          <ul className="space-y-1">
                            {domain.mitigation_strategies.map((strategy, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></span>
                                {strategy}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Regulatory Impact */}
                      <div className="bg-white bg-opacity-60 rounded p-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Regulatory Impact:</h5>
                        <p className="text-sm text-gray-700">{domain.regulatory_impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Export Bias Assessment</h3>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Risk Assessment Report (PDF)
                </button>
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Mitigation Plan (DOCX)
                </button>
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Raw Analysis (JSON)
                </button>
                <button className="btn btn-primary">
                  <Shield className="w-4 h-4 mr-2" />
                  Regulatory Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {assessments.length === 0 && (
        <div className="text-center py-12">
          <Shield className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="heading-3 text-gray-900 mb-2">No bias assessments yet</h3>
          <p className="body-large text-gray-600 mb-8">
            Run systematic bias risk analysis on your clinical evidence studies.
          </p>
          <button className="btn btn-primary">
            <Brain className="w-4 h-4 mr-2" />
            Start Bias Assessment
          </button>
        </div>
      )}
    </div>
  )
}

export default BiasAnalysis
