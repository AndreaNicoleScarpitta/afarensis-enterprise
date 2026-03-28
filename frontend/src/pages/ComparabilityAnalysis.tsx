import type React from 'react'
import { useState, useEffect } from 'react'
import { apiClient } from '../services/apiClient'
import {
  BarChart3,
  Target,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  Settings,
  Zap
} from 'lucide-react'

interface ComparabilityMetric {
  dimension: string
  score: number
  weight: number
  confidence_interval: [number, number]
  regulatory_importance: 'critical' | 'high' | 'medium' | 'low'
  evidence_count: number
  bias_adjustments: string[]
}

interface ComparisonResult {
  id: string
  study_a: string
  study_b: string
  overall_score: number
  metrics: ComparabilityMetric[]
  regulatory_acceptability: 'acceptable' | 'conditional' | 'insufficient'
  key_differences: string[]
  recommendations: string[]
  generated_at: string
}

const ComparabilityAnalysis: React.FC = () => {
  const [results, setResults] = useState<ComparisonResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedComparison, setSelectedComparison] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<'pairwise' | 'network' | 'anchor'>('pairwise')

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = (apiClient as any).accessToken || ''
        const response = await fetch('/api/v1/comparability-analyses', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setResults(Array.isArray(data) ? data : data.analyses || [])
        }
      } catch (err) {
        console.error('Failed to fetch comparability analyses:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 55) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBackground = (score: number) => {
    if (score >= 85) return 'bg-green-50 border-green-200'
    if (score >= 70) return 'bg-blue-50 border-blue-200'
    if (score >= 55) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getAcceptabilityBadge = (level: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"
    switch (level) {
      case 'acceptable': return `${baseClasses} bg-green-100 text-green-700`
      case 'conditional': return `${baseClasses} bg-yellow-100 text-yellow-700`
      case 'insufficient': return `${baseClasses} bg-red-100 text-red-700`
      default: return `${baseClasses} bg-gray-100 text-gray-700`
    }
  }

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'high': return <TrendingUp className="w-4 h-4 text-orange-500" />
      case 'medium': return <Info className="w-4 h-4 text-blue-500" />
      case 'low': return <CheckCircle className="w-4 h-4 text-gray-500" />
      default: return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-80 mb-6"></div>
          <div className="bg-white rounded-lg shadow p-8">
            <div className="h-6 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const selectedResult = (results.find(r => r.id === selectedComparison) || results[0])!

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="heading-1 mb-2">Comparability Analysis</h1>
          <p className="body-large text-gray-600">
            Advanced statistical comparison of clinical studies for regulatory evidence synthesis
          </p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 lg:mt-0">
          <select
            value={analysisMode}
            onChange={(e) => setAnalysisMode(e.target.value as any)}
            className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pairwise">Pairwise Comparison</option>
            <option value="network">Network Meta-Analysis</option>
            <option value="anchor">Anchor-Based Matching</option>
          </select>
          <button className="btn btn-secondary">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </button>
          <button className="btn btn-primary">
            <Zap className="w-4 h-4 mr-2" />
            Run Analysis
          </button>
        </div>
      </div>

      {/* Analysis Mode Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">
              {analysisMode === 'pairwise' && 'Pairwise Comparison Analysis'}
              {analysisMode === 'network' && 'Network Meta-Analysis'}
              {analysisMode === 'anchor' && 'Anchor-Based Matching'}
            </h3>
            <p className="text-blue-700 text-sm">
              {analysisMode === 'pairwise' && 'Direct statistical comparison between two studies across multiple dimensions with regulatory importance weighting.'}
              {analysisMode === 'network' && 'Comprehensive analysis across multiple studies using indirect comparison methods and network connectivity assessment.'}
              {analysisMode === 'anchor' && 'Population-level matching using clinical anchors and biomarkers for cross-study comparability.'}
            </p>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Results List */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="font-medium">Analysis Results</h3>
              </div>
              <div className="divide-y">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => setSelectedComparison(result.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedComparison === result.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="mb-2">
                      <div className={`text-lg font-bold ${getScoreColor(result.overall_score)}`}>
                        {result.overall_score}%
                      </div>
                      <span className={getAcceptabilityBadge(result.regulatory_acceptability)}>
                        {result.regulatory_acceptability}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="font-medium">{result.study_a}</div>
                      <div>vs {result.study_b}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="xl:col-span-3 space-y-6">
            {/* Overall Score Card */}
            <div className={`rounded-lg border-2 p-6 ${getScoreBackground(selectedResult.overall_score)}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="heading-2 mb-2">Overall Comparability Score</h2>
                  <p className="text-gray-600">
                    {selectedResult.study_a} vs {selectedResult.study_b}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getScoreColor(selectedResult.overall_score)}`}>
                    {selectedResult.overall_score}%
                  </div>
                  <span className={getAcceptabilityBadge(selectedResult.regulatory_acceptability)}>
                    {selectedResult.regulatory_acceptability.toUpperCase()}
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white bg-opacity-50 rounded-full h-3 mb-4">
                <div 
                  className="h-3 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${selectedResult.overall_score}%`,
                    backgroundColor: selectedResult.overall_score >= 85 ? '#16a34a' : 
                                   selectedResult.overall_score >= 70 ? '#2563eb' :
                                   selectedResult.overall_score >= 55 ? '#ca8a04' : '#dc2626'
                  }}
                ></div>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Generated {new Date(selectedResult.generated_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {selectedResult.metrics.length} Dimensions Analyzed
                </span>
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="heading-3 mb-2">Dimension Analysis</h3>
                <p className="text-gray-600">
                  Detailed breakdown by regulatory importance and statistical confidence
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {selectedResult.metrics
                    .sort((a, b) => b.weight - a.weight)
                    .map((metric, index) => (
                    <div key={index} className="border rounded-lg p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          {getImportanceIcon(metric.regulatory_importance)}
                          <div>
                            <h4 className="font-semibold text-gray-900">{metric.dimension}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                              <span>Weight: {(metric.weight * 100).toFixed(0)}%</span>
                              <span>Evidence: {metric.evidence_count} studies</span>
                              <span className="capitalize">{metric.regulatory_importance} importance</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getScoreColor(metric.score)}`}>
                            {metric.score}%
                          </div>
                          <div className="text-xs text-gray-500">
                            CI: {metric.confidence_interval[0]}-{metric.confidence_interval[1]}%
                          </div>
                        </div>
                      </div>

                      {/* Score Bar */}
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-700"
                            style={{ 
                              width: `${metric.score}%`,
                              backgroundColor: metric.score >= 85 ? '#16a34a' : 
                                             metric.score >= 70 ? '#2563eb' :
                                             metric.score >= 55 ? '#ca8a04' : '#dc2626'
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Bias Adjustments */}
                      {metric.bias_adjustments.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Applied Adjustments:</h5>
                          <div className="flex flex-wrap gap-2">
                            {metric.bias_adjustments.map((adjustment, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {adjustment}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Differences & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Key Differences */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Key Differences Identified
                  </h3>
                </div>
                <div className="p-4">
                  <ul className="space-y-3">
                    {selectedResult.key_differences.map((diff, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">{diff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Regulatory Recommendations
                  </h3>
                </div>
                <div className="p-4">
                  <ul className="space-y-3">
                    {selectedResult.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="heading-3 mb-4">Export Analysis Results</h3>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Statistical Report (PDF)
                </button>
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Regulatory Summary (DOCX)
                </button>
                <button className="btn btn-secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Raw Data (CSV)
                </button>
                <button className="btn btn-primary">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Interactive Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="heading-3 text-gray-900 mb-2">No comparability analyses yet</h3>
          <p className="body-large text-gray-600 mb-8">
            Run your first comparability analysis to assess study similarity for regulatory submissions.
          </p>
          <button className="btn btn-primary">
            <Zap className="w-4 h-4 mr-2" />
            Start New Analysis
          </button>
        </div>
      )}
    </div>
  )
}

export default ComparabilityAnalysis
