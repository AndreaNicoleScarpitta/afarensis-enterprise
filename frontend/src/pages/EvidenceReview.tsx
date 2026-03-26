import React, { useState } from 'react'
import {
  Search, Filter, Download, Eye, Flag, CheckCircle,
  AlertTriangle, XCircle, FileText, Users, Calendar,
  BarChart3, Brain, Target, Shield, Loader2, Star
} from 'lucide-react'
import { useEvidenceList, useEvidenceMutations } from '../services/hooks'
import type { EvidenceStatus } from '../services/apiClient'

const EvidenceReview: React.FC = () => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: evidenceData, loading, error, refetch } = useEvidenceList({
    page: currentPage,
    page_size: 20,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(searchQuery && { search: searchQuery }),
  })

  const { updateEvidence, generateAISummary, loading: mutationLoading } = useEvidenceMutations()

  const handleStatusChange = async (evidenceId: string, newStatus: EvidenceStatus) => {
    try {
      await updateEvidence(evidenceId, { status: newStatus })
      refetch()
    } catch (e) {
      console.error('Failed to update evidence status:', e)
    }
  }

  const handleGenerateAI = async (evidenceId: string) => {
    try {
      await generateAISummary(evidenceId)
      refetch()
    } catch (e) {
      console.error('Failed to generate automated summary:', e)
    }
  }

  const handleSelectItem = (id: string) => {
    const next = new Set(selectedItems)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedItems(next)
  }

  const handleSelectAll = () => {
    if (!evidenceData?.items) return
    if (selectedItems.size === evidenceData.items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(evidenceData.items.map((e: any) => e.id)))
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_review': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />
      case 'screening': return <Eye className="h-4 w-4 text-blue-500" />
      default: return <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      in_review: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
      screening: 'bg-blue-100 text-blue-700',
      pending: 'bg-gray-100 text-gray-700',
      archived: 'bg-gray-100 text-gray-500',
    }
    return `px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`
  }

  const getSourceBadge = (source: string) => {
    const map: Record<string, string> = {
      pubmed: 'bg-blue-50 text-blue-700 border border-blue-200',
      clinicaltrials: 'bg-purple-50 text-purple-700 border border-purple-200',
      semanticscholar: 'bg-teal-50 text-teal-700 border border-teal-200',
      openalex: 'bg-orange-50 text-orange-700 border border-orange-200',
      manual: 'bg-gray-50 text-gray-700 border border-gray-200',
    }
    return `px-2 py-0.5 rounded text-xs font-medium ${map[source] ?? 'bg-gray-50 text-gray-600 border border-gray-200'}`
  }

  const getQualityColor = (score: number | null) => {
    if (score == null) return 'text-gray-500 dark:text-gray-400'
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 55) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-lg text-gray-600">Loading evidence...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-red-800">Error loading evidence</h3>
            <p className="text-sm text-red-700 mt-1">{error.message}</p>
          </div>
          <button onClick={() => refetch()} className="shrink-0 px-4 py-2 text-sm font-semibold text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const items: any[] = evidenceData?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evidence Review</h1>
          <p className="text-gray-600 mt-1">
            Systematic review and quality assessment of clinical evidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={selectedItems.size === 0}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search evidence by title or source..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1) }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="screening">Screening</option>
              <option value="in_review">In Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="pubmed">PubMed</option>
              <option value="clinicaltrials">ClinicalTrials</option>
              <option value="semanticscholar">Semantic Scholar</option>
              <option value="openalex">OpenAlex</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Quality</option>
              <option value="high">High (85+)</option>
              <option value="medium">Medium (70–84)</option>
              <option value="low">Low (&lt;70)</option>
            </select>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedItems.size > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="text-sm font-medium text-indigo-700">{selectedItems.size} selected</span>
            <button
              onClick={() => Array.from(selectedItems).forEach(id => handleStatusChange(id, 'approved'))}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
            >
              <CheckCircle className="w-3 h-3 mr-1" /> Approve All
            </button>
            <button
              onClick={() => Array.from(selectedItems).forEach(id => handleStatusChange(id, 'rejected'))}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
            >
              <XCircle className="w-3 h-3 mr-1" /> Reject All
            </button>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="ml-auto text-xs text-indigo-600 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: evidenceData?.total ?? 0, color: 'text-gray-900' },
          { label: 'Pending Review', value: items.filter((e: any) => e.status === 'pending' || e.status === 'screening').length, color: 'text-yellow-600' },
          { label: 'Approved', value: items.filter((e: any) => e.status === 'approved').length, color: 'text-green-600' },
          { label: 'Avg Quality', value: items.length ? Math.round(items.reduce((a: number, e: any) => a + (e.qualityScore ?? 0), 0) / items.length) + '%' : '—', color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border shadow-sm p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Evidence list */}
      {items.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-sm p-16 text-center">
          <FileText className="h-12 w-12 text-gray-600 dark:text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No evidence found</h3>
          <p className="text-gray-500">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Evidence will appear here once ingested and processed.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm">
          {/* Table header */}
          <div className="flex items-center gap-3 px-6 py-3 border-b bg-gray-50">
            <input
              type="checkbox"
              checked={selectedItems.size === items.length && items.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300"
            />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">Title / Source</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-20 text-center hidden md:block">Quality</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-24 text-center hidden lg:block">Source</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-28 text-center">Status</span>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-32 text-right">Actions</span>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((item: any) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-6 py-4 hover:bg-gray-50 transition-colors ${
                  selectedItems.has(item.id) ? 'bg-indigo-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => handleSelectItem(item.id)}
                  className="mt-1 rounded border-gray-300"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    {getStatusIcon(item.status)}
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{item.title}</h4>
                  </div>
                  {item.abstract && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2 ml-6">{item.abstract}</p>
                  )}
                  <div className="flex items-center gap-3 ml-6 text-xs text-gray-500 flex-wrap">
                    {item.authors?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.authors.slice(0, 2).join(', ')}{item.authors.length > 2 ? ' et al.' : ''}
                      </span>
                    )}
                    {item.publicationDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.publicationDate).getFullYear()}
                      </span>
                    )}
                    {item.doi && (
                      <a
                        href={`https://doi.org/${item.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-500 hover:underline"
                      >
                        DOI
                      </a>
                    )}
                    {item.aiSummary && (
                      <span className="flex items-center gap-1 text-purple-500">
                        <Brain className="w-3 h-3" /> Automated summary
                      </span>
                    )}
                  </div>
                </div>

                {/* Quality score */}
                <div className="w-20 text-center hidden md:block flex-shrink-0">
                  <div className={`text-lg font-bold ${getQualityColor(item.qualityScore)}`}>
                    {item.qualityScore != null ? `${item.qualityScore}` : '—'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">/ 100</div>
                </div>

                {/* Source badge */}
                <div className="w-24 text-center hidden lg:block flex-shrink-0">
                  <span className={getSourceBadge(item.source)}>{item.source}</span>
                </div>

                {/* Status badge */}
                <div className="w-28 text-center flex-shrink-0">
                  <span className={getStatusBadge(item.status)}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="w-32 flex justify-end items-center gap-1.5 flex-shrink-0">
                  {(item.status === 'pending' || item.status === 'screening') && (
                    <>
                      <button
                        onClick={() => handleStatusChange(item.id, 'approved')}
                        disabled={mutationLoading}
                        title="Approve"
                        className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-40"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.id, 'rejected')}
                        disabled={mutationLoading}
                        title="Reject"
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!item.aiSummary && (
                    <button
                      onClick={() => handleGenerateAI(item.id)}
                      disabled={mutationLoading}
                      title="Generate automated summary"
                      className="p-1.5 rounded text-purple-600 hover:bg-purple-50 disabled:opacity-40"
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange(item.id, 'in_review')}
                    disabled={mutationLoading}
                    title="Flag for review"
                    className="p-1.5 rounded text-yellow-600 hover:bg-yellow-50 disabled:opacity-40"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {evidenceData && (evidenceData as any).total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {(evidenceData as any).total_pages} · {evidenceData.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= ((evidenceData as any).total_pages ?? 1)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EvidenceReview
