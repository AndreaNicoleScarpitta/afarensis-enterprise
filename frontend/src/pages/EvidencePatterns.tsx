import React, { useState } from 'react'
import {
  Target, TrendingUp, Brain, BarChart3, CheckCircle,
  AlertTriangle, Search, Filter, Star, ArrowUpRight,
  Shield, Users, Calendar, BookOpen, Zap
} from 'lucide-react'

interface EvidencePattern {
  id: string
  name: string
  category: 'study_design' | 'endpoint' | 'population' | 'regulatory' | 'statistical'
  description: string
  approval_rate: number
  evidence_count: number
  indication_areas: string[]
  agencies: string[]
  key_requirements: string[]
  pitfalls: string[]
  confidence: number
  trend: 'rising' | 'stable' | 'declining'
  last_updated: string
}

const PATTERNS: EvidencePattern[] = [
  {
    id: '1',
    name: 'Single-Arm Trial with External Control',
    category: 'study_design',
    description:
      'External control arm constructed from real-world data to support single-arm trial submissions in rare/orphan indications. Increasingly accepted by FDA under Expedited Programs.',
    approval_rate: 78,
    evidence_count: 342,
    indication_areas: ['Oncology', 'Rare Disease', 'Orphan Drug'],
    agencies: ['FDA', 'EMA', 'PMDA'],
    key_requirements: [
      'Propensity score matching with pre-specified covariates',
      'E-value ≥ 2.0 for unmeasured confounding',
      'Historical data from ≥3 years prior to treatment index date',
      'Pre-specified estimand per ICH E9(R1)',
    ],
    pitfalls: [
      'Immortal time bias in external control selection',
      'Endpoint misclassification from historical coding changes',
      'Exclusion of patients lost to follow-up without sensitivity analysis',
    ],
    confidence: 89,
    trend: 'rising',
    last_updated: '2026-02-15',
  },
  {
    id: '2',
    name: 'Propensity Score Stratification (5 Strata)',
    category: 'statistical',
    description:
      'Five-stratum propensity score analysis removing ~90% of observed covariate imbalance. Widely accepted for observational RWE supporting regulatory submissions.',
    approval_rate: 82,
    evidence_count: 1204,
    indication_areas: ['Cardiovascular', 'Diabetes', 'Neurology'],
    agencies: ['FDA', 'EMA'],
    key_requirements: [
      'AUROC ≥ 0.70 for propensity model',
      'Standardized mean differences < 0.1 post-stratification',
      'Overlap trimming at 1st/99th percentile',
      'Stabilized IPW as sensitivity analysis',
    ],
    pitfalls: [
      'Model overfitting with > 1 covariate per 10 events',
      'Positivity violations in sparse cells',
    ],
    confidence: 94,
    trend: 'stable',
    last_updated: '2026-01-30',
  },
  {
    id: '3',
    name: 'Composite Primary Endpoint (MACE)',
    category: 'endpoint',
    description:
      'Major Adverse Cardiovascular Events composite endpoint (CV death, MI, stroke) as a regulatory-precedented primary endpoint in cardiovascular outcomes trials.',
    approval_rate: 91,
    evidence_count: 847,
    indication_areas: ['Cardiovascular', 'Metabolic'],
    agencies: ['FDA', 'EMA', 'Health Canada'],
    key_requirements: [
      'Each component individually adjudicated by blinded CEC',
      'Pre-specified component hierarchy for tie-breaking',
      'Time-to-first-event analysis with Kaplan-Meier',
      'Winsorized win ratio as sensitivity estimand',
    ],
    pitfalls: [
      'Competing risks from non-CV death without proper handling',
      'Dilution of treatment effect by non-informative components',
    ],
    confidence: 96,
    trend: 'stable',
    last_updated: '2026-03-01',
  },
  {
    id: '4',
    name: 'Biomarker-Enriched Rare Disease Trial',
    category: 'population',
    description:
      'Genotype or biomarker-based patient selection for rare disease submissions enabling smaller sample sizes with high regulatory acceptability under Breakthrough designation.',
    approval_rate: 73,
    evidence_count: 198,
    indication_areas: ['Rare Disease', 'Genetic', 'Oncology'],
    agencies: ['FDA', 'EMA'],
    key_requirements: [
      'Analytically validated companion diagnostic',
      'Pre-specified biomarker threshold with biological rationale',
      'Bayesian adaptive design with prior elicitation',
      'N ≥ 30 per arm for primary endpoint estimation',
    ],
    pitfalls: [
      'Locked biomarker threshold before enrollment complete',
      'Lack of concordance between local and central diagnostic testing',
    ],
    confidence: 81,
    trend: 'rising',
    last_updated: '2026-02-28',
  },
  {
    id: '5',
    name: 'FDA Surrogate Endpoint Acceptance (OS Waiver)',
    category: 'regulatory',
    description:
      'Accelerated approval pathway using validated surrogate endpoint (e.g., ORR, PFS) with post-market confirmatory trial commitment. Strong precedent in oncology.',
    approval_rate: 69,
    evidence_count: 423,
    indication_areas: ['Oncology'],
    agencies: ['FDA'],
    key_requirements: [
      'Strong biological rationale linking surrogate to OS',
      'ORR ≥ 30% or PFS HR < 0.75 vs control',
      'Post-marketing commitment to confirmatory randomized trial',
      'Real-world survival data from registry to supplement',
    ],
    pitfalls: [
      'Surrogate-to-OS correlation may not hold across subgroups',
      'Accelerated approval withdrawal risk if confirmatory trial fails',
    ],
    confidence: 76,
    trend: 'stable',
    last_updated: '2026-01-15',
  },
  {
    id: '6',
    name: 'Pediatric Extrapolation Strategy',
    category: 'population',
    description:
      'Extrapolation of adult efficacy to pediatric populations using PK bridging studies and disease similarity assumptions, per ICH E11A.',
    approval_rate: 65,
    evidence_count: 156,
    indication_areas: ['Pediatric', 'Rare Disease', 'Neurology'],
    agencies: ['FDA', 'EMA'],
    key_requirements: [
      'Demonstration of similar disease course across age groups',
      'Population PK model with pediatric covariates',
      'Safety data in ≥ 30 pediatric patients minimum',
      'Extrapolation justification document per ICH E11A framework',
    ],
    pitfalls: [
      'Age-related PK differences not captured by adult model',
      'Different safety profiles in neonates vs older children',
    ],
    confidence: 72,
    trend: 'rising',
    last_updated: '2026-03-10',
  },
]

const categoryColors: Record<string, string> = {
  study_design: 'bg-blue-100 text-blue-700',
  endpoint: 'bg-purple-100 text-purple-700',
  population: 'bg-green-100 text-green-700',
  regulatory: 'bg-red-100 text-red-700',
  statistical: 'bg-orange-100 text-orange-700',
}

const trendIcon = (trend: string) => {
  if (trend === 'rising') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />
  if (trend === 'declining') return <TrendingUp className="w-3.5 h-3.5 text-red-500 rotate-180" />
  return <div className="w-3.5 h-0.5 bg-gray-400 rounded" />
}

const EvidencePatterns: React.FC = () => {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedPattern, setSelectedPattern] = useState<EvidencePattern | null>(null)

  const filtered = PATTERNS.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.indication_areas.some(a => a.toLowerCase().includes(search.toLowerCase()))
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchSearch && matchCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evidence Patterns</h1>
          <p className="text-gray-600 mt-1">
            Systematically discovered patterns from {PATTERNS.reduce((s, p) => s + p.evidence_count, 0).toLocaleString()}+ regulatory submissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            <Brain className="w-4 h-4 mr-1.5" /> Analyze My Portfolio
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pattern Library', value: PATTERNS.length, icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Avg Approval Rate', value: `${Math.round(PATTERNS.reduce((s, p) => s + p.approval_rate, 0) / PATTERNS.length)}%`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Rising Trends', value: PATTERNS.filter(p => p.trend === 'rising').length, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Evidence Records', value: PATTERNS.reduce((s, p) => s + p.evidence_count, 0).toLocaleString(), icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patterns by name, indication, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="study_design">Study Design</option>
            <option value="statistical">Statistical</option>
            <option value="endpoint">Endpoint</option>
            <option value="population">Population</option>
            <option value="regulatory">Regulatory</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pattern cards */}
        <div className="xl:col-span-2 space-y-4">
          {filtered.map(pattern => (
            <div
              key={pattern.id}
              onClick={() => setSelectedPattern(pattern)}
              className={`bg-white rounded-lg border shadow-sm p-5 cursor-pointer hover:shadow-md transition-all ${
                selectedPattern?.id === pattern.id ? 'ring-2 ring-indigo-400 border-indigo-300' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[pattern.category]}`}>
                      {pattern.category.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {trendIcon(pattern.trend)}
                      <span className="capitalize">{pattern.trend}</span>
                    </div>
                    <span className="text-xs text-gray-400">{pattern.evidence_count.toLocaleString()} studies</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1.5">{pattern.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{pattern.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {pattern.indication_areas.map(area => (
                      <span key={area} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{area}</span>
                    ))}
                    {pattern.agencies.map(agency => (
                      <span key={agency} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{agency}</span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 text-center">
                  <div className={`text-3xl font-bold ${
                    pattern.approval_rate >= 80 ? 'text-green-600' :
                    pattern.approval_rate >= 65 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {pattern.approval_rate}%
                  </div>
                  <div className="text-xs text-gray-500">approval rate</div>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-gray-600">{pattern.confidence}% conf.</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No patterns match your search.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedPattern ? (
            <div className="bg-white rounded-lg border shadow-sm p-5 space-y-5 sticky top-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[selectedPattern.category]}`}>
                    {selectedPattern.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">Updated {new Date(selectedPattern.last_updated).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{selectedPattern.name}</h3>
                <p className="text-sm text-gray-600 mt-2">{selectedPattern.description}</p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-600">{selectedPattern.approval_rate}%</div>
                  <div className="text-xs text-gray-500">Approval Rate</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-indigo-600">{selectedPattern.confidence}%</div>
                  <div className="text-xs text-gray-500">Confidence</div>
                </div>
              </div>

              {/* Requirements */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Key Requirements
                </h4>
                <ul className="space-y-2">
                  {selectedPattern.key_requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pitfalls */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" /> Common Pitfalls
                </h4>
                <ul className="space-y-2">
                  {selectedPattern.pitfalls.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <button className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                <Zap className="w-4 h-4 mr-2" /> Apply Pattern to Project
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
              <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Select a pattern to view details and requirements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EvidencePatterns
