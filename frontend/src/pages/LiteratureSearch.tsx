import type React from 'react'
import { useState, useCallback, useMemo } from 'react'
import {
  Search, BookOpen, Beaker, Globe, Layers,
  ExternalLink, Loader2, Filter,
  BookMarked, Users, Calendar, Quote, AlertCircle,
  ArrowUpDown, Link2,
} from 'lucide-react'
import PaperViewer from '../components/ui/PaperViewer'
import { apiClient } from '../services/apiClient'
import { logger } from '../services/logger'

// ── Types ─────────────────────────────────────────────────────────────────────
type Source = 'pubmed' | 'clinicaltrials' | 'openalex' | 'semanticscholar'
type SortMode = 'relevance' | 'date' | 'citations'
type ResultType = 'paper' | 'trial' | 'preprint' | 'review' | 'dataset'

interface Paper {
  id?: string
  paperId?: string
  pmid?: string
  nctId?: string
  title: string
  abstract?: string | null
  tldr?: string | null
  authors: string[]
  publicationDate?: string | null
  year?: number | null
  source: Source
  doi?: string | null
  journal?: string | null
  url?: string
  citationCount?: number
  influentialCitationCount?: number
  openAccessPdfUrl?: string | null
  openAccessUrl?: string | null
  trialStatus?: string
  conditions?: string[]
  phase?: string[]
  meshTerms?: string[]
  concepts?: string[]
  metadataJson?: Record<string, unknown>
  _resultType?: ResultType
  _dedupeKey?: string
  _sources?: Source[]
}

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCES: { id: Source; label: string; icon: React.ElementType; color: string; bgColor: string; desc: string }[] = [
  { id: 'pubmed',          label: 'PubMed',           icon: BookMarked, color: 'text-blue-500',    bgColor: 'bg-blue-500/10 border-blue-500/20',    desc: 'MEDLINE peer-reviewed literature' },
  { id: 'clinicaltrials',  label: 'ClinicalTrials',   icon: Beaker,     color: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/20', desc: 'NIH clinical trial registry' },
  { id: 'openalex',        label: 'OpenAlex',         icon: Globe,      color: 'text-violet-500',  bgColor: 'bg-violet-500/10 border-violet-500/20',  desc: 'Open scholarly works index' },
  { id: 'semanticscholar', label: 'Semantic Scholar',  icon: Layers,     color: 'text-orange-500',  bgColor: 'bg-orange-500/10 border-orange-500/20',  desc: 'AI-powered citation graph' },
]

const SOURCE_MAP = Object.fromEntries(SOURCES.map(s => [s.id, s])) as Record<Source, typeof SOURCES[0]>

// ── Helpers ──────────────────────────────────────────────────────────────────
function inferResultType(paper: Paper): ResultType {
  if (paper.source === 'clinicaltrials' || paper.nctId) return 'trial'
  if (paper.journal?.toLowerCase().includes('preprint') || paper.journal?.toLowerCase().includes('arxiv') || paper.journal?.toLowerCase().includes('biorxiv') || paper.journal?.toLowerCase().includes('medrxiv')) return 'preprint'
  if (paper.title?.toLowerCase().includes('systematic review') || paper.title?.toLowerCase().includes('meta-analysis')) return 'review'
  return 'paper'
}

function dedupeKey(paper: Paper): string {
  if (paper.doi) return `doi:${paper.doi.toLowerCase().trim()}`
  const normalized = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)
  return `title:${normalized}`
}

const TYPE_CONFIG: Record<ResultType, { label: string; color: string }> = {
  paper:    { label: 'Paper',    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  trial:    { label: 'Trial',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  preprint: { label: 'Preprint', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  review:   { label: 'Review',   color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  dataset:  { label: 'Dataset',  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
// All search requests routed through apiClient.request() so they get
// automatic 401→refresh, Zod validation, and global error dispatch.
import { z } from 'zod'

const SearchResultSchema = z.any() // Accept any shape — we normalise below

/** Parse any date-like value into a sortable timestamp (ms since epoch). Returns 0 if unparseable. */
function parseDate(paper: Paper): number {
  const raw = paper.publicationDate ?? (paper.year != null ? String(paper.year) : null)
  if (!raw) return 0
  // Try ISO / full date first
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.getTime()
  // Try bare year (e.g. "2021")
  const yearMatch = raw.match(/(\d{4})/)
  if (yearMatch) return new Date(`${yearMatch[1]}-01-01`).getTime()
  return 0
}

/** Compute a composite importance / impact score for sorting.
 *  Combines citation count (log-scaled), influential citations, recency,
 *  and cross-source presence into a single 0–100 score. */
function computeImpactScore(paper: Paper): number {
  const citations = paper.citationCount ?? 0
  const influential = paper.influentialCitationCount ?? 0
  const sources = paper._sources?.length ?? 1

  // Log-scaled citation score (0-40 pts) — log10(1+citations) capped at 4 (10k cites)
  const citScore = Math.min(Math.log10(1 + citations) / 4, 1) * 40

  // Influential citation bonus (0-20 pts)
  const inflScore = Math.min(Math.log10(1 + influential * 5) / 3, 1) * 20

  // Recency bonus (0-25 pts) — papers from last 5 years get full credit, decays linearly
  const pubYear = paper.year ?? parseInt(paper.publicationDate?.slice(0, 4) ?? '0', 10)
  const currentYear = new Date().getFullYear()
  const yearsAgo = currentYear - (pubYear || currentYear - 20)
  const recencyScore = Math.max(0, 1 - yearsAgo / 20) * 25

  // Multi-source bonus (0-15 pts) — found in multiple databases
  const sourceScore = Math.min((sources - 1) * 7.5, 15)

  return citScore + inflScore + recencyScore + sourceScore
}

async function fetchSource(source: Source, query: string, maxResults = 20): Promise<Paper[]> {
  const base = '/search'
  let raw: any[] = []

  if (source === 'pubmed') {
    const data = await apiClient.request(`${base}/pubmed`, SearchResultSchema, {
      method: 'POST',
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    raw = Array.isArray(data) ? data : []
  } else if (source === 'clinicaltrials') {
    const data = await apiClient.request(`${base}/clinical-trials`, SearchResultSchema, {
      method: 'POST',
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    raw = Array.isArray(data) ? data : []
  } else if (source === 'openalex') {
    const data = await apiClient.request(`${base}/openalex`, SearchResultSchema, {
      method: 'POST',
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    raw = data?.results ?? (Array.isArray(data) ? data : [])
  } else if (source === 'semanticscholar') {
    const params = new URLSearchParams({ query, limit: String(maxResults) })
    const data = await apiClient.request(`${base}/semantic-scholar?${params}`, SearchResultSchema)
    // Backend returns { papers: [...], total, offset, source }
    raw = data?.papers ?? data?.results ?? (Array.isArray(data) ? data : [])
    // If backend returned an error string, treat as empty
    if (data?.error) {
      logger.warn('Semantic Scholar error:', data.error)
      raw = []
    }
  }

  return (Array.isArray(raw) ? raw : []).map(p => ({ ...p, source }))
}

// ── Components ────────────────────────────────────────────────────────────────

function SourcePill({ source, showLabel = true }: { source: Source; showLabel?: boolean }) {
  const s = SOURCE_MAP[source]
  if (!s) return null
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${s.bgColor} ${s.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {showLabel && s.label}
    </span>
  )
}

function TypeBadge({ type }: { type: ResultType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function PaperCard({ paper, onClick }: { paper: Paper; onClick: () => void }) {
  const truncate = (text?: string | null, n = 200) =>
    text ? (text.length > n ? text.slice(0, n) + '...' : text) : null
  const displayText = paper.tldr ?? truncate(paper.abstract)
  const resultType = paper._resultType ?? inferResultType(paper)
  const sources = paper._sources ?? [paper.source]

  return (
    <div
      onClick={onClick}
      className="relative bg-white border border-gray-200 rounded-xl p-5 hover:border-[#2563EB]/40 hover:shadow-md transition-all cursor-pointer group"
    >
      {paper.url && (
        <button
          onClick={e => { e.stopPropagation(); window.open(paper.url, '_blank') }}
          className="absolute top-3 right-3 p-1.5 text-gray-500 hover:text-[#2563EB] hover:bg-blue-50 rounded transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-2.5 pr-10 flex-wrap">
        {sources.map(src => <SourcePill key={src} source={src} />)}
        <TypeBadge type={resultType} />
        {paper.phase && paper.phase.length > 0 && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-teal-400 bg-teal-500/10 border-teal-500/20">
            {paper.phase.join(' / ')}
          </span>
        )}
        {paper.trialStatus && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
            {paper.trialStatus}
          </span>
        )}
        {sources.length > 1 && (
          <span className="text-[9px] font-semibold text-amber-400 flex items-center gap-0.5 ml-1">
            <Link2 className="h-2.5 w-2.5" /> Found in {sources.length} sources
          </span>
        )}
        {paper.journal && (
          <span className="text-[10px] text-gray-500 truncate max-w-[200px] ml-auto">{paper.journal}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-snug group-hover:text-[#2563EB] transition-colors">
        {paper.title}
      </h3>

      {/* Abstract/TLDR */}
      {displayText && (
        <p className="text-xs text-gray-500 leading-relaxed mb-3">
          {paper.tldr && <span className="font-semibold text-gray-600">TL;DR: </span>}
          {displayText}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
        {paper.authors?.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}
          </span>
        )}
        {(paper.publicationDate ?? paper.year) && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {paper.publicationDate ?? paper.year}
          </span>
        )}
        {paper.citationCount !== undefined && paper.citationCount > 0 && (
          <span className="flex items-center gap-1">
            <Quote className="h-3 w-3" />
            {paper.citationCount.toLocaleString()} citations
          </span>
        )}
        {paper.doi && <span className="font-mono">DOI: {paper.doi}</span>}
        {paper.conditions && paper.conditions.length > 0 && (
          <span>{paper.conditions.slice(0, 2).join(' · ')}</span>
        )}
        {(paper.openAccessPdfUrl || paper.openAccessUrl) && (
          <span className="text-emerald-500 font-semibold">Open Access</span>
        )}
      </div>

      {/* Tags */}
      {paper.meshTerms && paper.meshTerms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {paper.meshTerms.slice(0, 5).map(t => (
            <span key={t} className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
      {paper.concepts && paper.concepts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {paper.concepts.slice(0, 5).map(c => (
            <span key={c} className="text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiteratureSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<Source, Paper[]>>({
    pubmed: [], clinicaltrials: [], openalex: [], semanticscholar: [],
  })
  const [loading, setLoading] = useState<Record<Source, boolean>>({
    pubmed: false, clinicaltrials: false, openalex: false, semanticscholar: false,
  })
  const [errors, setErrors] = useState<Record<Source, string | null>>({
    pubmed: null, clinicaltrials: null, openalex: null, semanticscholar: null,
  })
  const [maxResults, setMaxResults] = useState(20)
  const [searched, setSearched] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)

  // Filters
  const [enabledSources, setEnabledSources] = useState<Set<Source>>(new Set(['pubmed', 'clinicaltrials', 'openalex', 'semanticscholar']))
  const [sortMode, setSortMode] = useState<SortMode>('relevance')
  // Search all sources in parallel
  const search = useCallback(async () => {
    if (!query.trim()) return
    setSearched(true)

    const sources: Source[] = ['pubmed', 'clinicaltrials', 'openalex', 'semanticscholar']

    // Fire all searches in parallel
    sources.forEach(async (src) => {
      setLoading(prev => ({ ...prev, [src]: true }))
      setErrors(prev => ({ ...prev, [src]: null }))
      try {
        const data = await fetchSource(src, query, maxResults)
        setResults(prev => ({ ...prev, [src]: data }))
      } catch (e: any) {
        setErrors(prev => ({ ...prev, [src]: e.message ?? 'Search failed' }))
      } finally {
        setLoading(prev => ({ ...prev, [src]: false }))
      }
    })
  }, [query, maxResults])

  const anyLoading = Object.values(loading).some(Boolean)

  // Deduplicate + merge across sources
  const mergedResults = useMemo(() => {
    const dedupeMap = new Map<string, Paper>()

    for (const src of SOURCES) {
      if (!enabledSources.has(src.id)) continue
      for (const paper of results[src.id]) {
        const key = dedupeKey(paper)
        const existing = dedupeMap.get(key)
        if (existing) {
          // Merge: add source, keep richer data
          const existingSources = existing._sources ?? [existing.source]
          if (!existingSources.includes(paper.source)) {
            existing._sources = [...existingSources, paper.source]
          }
          // Prefer the version with more data
          if (!existing.abstract && paper.abstract) existing.abstract = paper.abstract
          if (!existing.tldr && paper.tldr) existing.tldr = paper.tldr
          if (!existing.doi && paper.doi) existing.doi = paper.doi
          if (!existing.citationCount && paper.citationCount) existing.citationCount = paper.citationCount
          if (paper.authors.length > existing.authors.length) existing.authors = paper.authors
        } else {
          dedupeMap.set(key, {
            ...paper,
            _resultType: inferResultType(paper),
            _dedupeKey: key,
            _sources: [paper.source],
          })
        }
      }
    }

    let merged = Array.from(dedupeMap.values())

    // Sort
    if (sortMode === 'citations') {
      // Impact score: composite of citations, influential cites, recency, source count
      merged.sort((a, b) => computeImpactScore(b) - computeImpactScore(a))
    } else if (sortMode === 'date') {
      // Parse real dates and sort newest-first
      merged.sort((a, b) => parseDate(b) - parseDate(a))
    } else {
      // Relevance: use retrieval rank within each source, then interleave
      // Papers appearing in more sources are ranked higher; within same source count,
      // lower average rank = more relevant
      merged.sort((a, b) => {
        const aSources = a._sources?.length ?? 1
        const bSources = b._sources?.length ?? 1
        if (bSources !== aSources) return bSources - aSources // more sources = more relevant
        // Use impact score as tiebreaker for relevance
        return computeImpactScore(b) - computeImpactScore(a)
      })
    }

    return merged
  }, [results, enabledSources, sortMode])

  // Source counts (before filtering)
  const sourceCounts = useMemo(() => {
    const counts: Record<Source, number> = { pubmed: 0, clinicaltrials: 0, openalex: 0, semanticscholar: 0 }
    for (const src of SOURCES) counts[src.id] = results[src.id].length
    return counts
  }, [results])

  const totalBeforeFilter = Object.values(sourceCounts).reduce((s, n) => s + n, 0)
  const dedupeCount = totalBeforeFilter - mergedResults.length
  const activeErrors = (Object.entries(errors) as [Source, string | null][]).filter(([, v]) => v !== null)

  const toggleSource = (src: Source) => {
    setEnabledSources(prev => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {selectedPaper && (
        <PaperViewer paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      )}

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Evidence Search</h1>
            <p className="text-gray-500 text-xs">Search your question, then explore where the truth lives</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-6xl">

        {/* ── Unified search bar ────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2563EB]/60 focus:ring-2 focus:ring-[#2563EB]/20 shadow-sm transition-all"
                placeholder='Search across all sources — e.g. "SGLT2 inhibitor heart failure outcomes"'
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
            </div>
            <button
              onClick={search}
              disabled={!query.trim() || anyLoading}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-8 py-4 rounded-2xl transition-colors shadow-sm whitespace-nowrap"
            >
              {anyLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching...</>
                : <><Search className="h-4 w-4" /> Search All</>
              }
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 ml-1">
            Searches PubMed, ClinicalTrials.gov, OpenAlex, and Semantic Scholar simultaneously
          </p>
        </div>

        {/* ── Pre-search: source cards ─────────────────────────────── */}
        {!searched && (
          <div className="grid grid-cols-2 gap-3">
            {SOURCES.map(src => {
              const Icon = src.icon
              return (
                <div key={src.id} className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${src.bgColor} ${src.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{src.label}</p>
                    <p className="text-xs text-gray-500">{src.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Loading indicator with per-source status ──────────────── */}
        {anyLoading && (
          <div className="mb-4 p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
              <span className="text-sm font-semibold text-gray-700">Searching across sources...</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {SOURCES.map(src => {
                const Icon = src.icon
                const isLoading = loading[src.id]
                const hasResults = results[src.id].length > 0
                const hasError = errors[src.id]
                return (
                  <span key={src.id} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                    isLoading ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' :
                    hasError ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                    hasResults ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                    'border-gray-200 text-gray-500'
                  }`}>
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                    {src.label}
                    {hasResults && !isLoading && <span className="font-bold">{results[src.id].length}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Results toolbar ──────────────────────────────────────── */}
        {searched && !anyLoading && totalBeforeFilter > 0 && (
          <div className="mb-4 space-y-3">
            {/* Source filters + sort */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Source filter checkboxes */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 mr-1">
                  <Filter className="h-3 w-3 inline -mt-0.5 mr-1" />Sources:
                </span>
                {SOURCES.map(src => {
                  const Icon = src.icon
                  const count = sourceCounts[src.id]
                  const enabled = enabledSources.has(src.id)
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        enabled
                          ? `${src.bgColor} ${src.color} font-semibold`
                          : 'border-gray-200 text-gray-500 opacity-60'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {src.label}
                      <span className={`font-bold ${enabled ? '' : 'opacity-50'}`}>({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* Sort + count */}
              <div className="flex items-center gap-3">
                {dedupeCount > 0 && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {dedupeCount} duplicate{dedupeCount !== 1 ? 's' : ''} merged
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3 w-3 text-gray-500" />
                  {([['relevance', 'Relevance'], ['date', 'Newest'], ['citations', 'Impact']] as [SortMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                        sortMode === mode
                          ? 'bg-[#2563EB]/15 text-[#2563EB] font-semibold'
                          : 'text-gray-500 hover:text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  className="text-[11px] bg-transparent border border-gray-200 rounded-md px-2 py-1 text-gray-500 focus:outline-none"
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                >
                  {[10, 20, 50].map(n => <option key={n} value={n} className="bg-white">{n} per source</option>)}
                </select>
              </div>
            </div>

            {/* Results summary */}
            <div className="text-xs text-gray-500">
              Showing <span className="font-bold text-gray-600">{mergedResults.length}</span> results
              {mergedResults.length !== totalBeforeFilter && (
                <> from <span className="font-bold text-gray-600">{totalBeforeFilter}</span> total across all sources</>
              )}
            </div>
          </div>
        )}

        {/* ── Errors ───────────────────────────────────────────────── */}
        {activeErrors.length > 0 && !anyLoading && (
          <div className="mb-4 space-y-2">
            {activeErrors.map(([src, msg]) => (
              <div key={src} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-500">{SOURCE_MAP[src]?.label} error</p>
                  <p className="text-[11px] text-red-500/80 mt-0.5">{msg}</p>
                </div>
                <button
                  onClick={async () => {
                    setLoading(prev => ({ ...prev, [src]: true }))
                    setErrors(prev => ({ ...prev, [src]: null }))
                    try {
                      const data = await fetchSource(src as Source, query, maxResults)
                      setResults(prev => ({ ...prev, [src]: data }))
                    } catch (e: any) {
                      setErrors(prev => ({ ...prev, [src]: e.message ?? 'Search failed' }))
                    } finally {
                      setLoading(prev => ({ ...prev, [src]: false }))
                    }
                  }}
                  className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Blended results list ─────────────────────────────────── */}
        {!anyLoading && mergedResults.length > 0 && (
          <div className="space-y-3">
            {mergedResults.map((paper, i) => (
              <PaperCard
                key={paper._dedupeKey ?? paper.id ?? paper.paperId ?? i}
                paper={paper}
                onClick={() => setSelectedPaper(paper)}
              />
            ))}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────── */}
        {!anyLoading && searched && mergedResults.length === 0 && activeErrors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-600">No results found</p>
            <p className="text-xs text-gray-500 max-w-sm">
              Try a different query or adjust your search terms.
            </p>
          </div>
        )}

        {/* ── Empty state with only errors ─────────────────────────── */}
        {!anyLoading && searched && mergedResults.length === 0 && activeErrors.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-sm text-gray-500">Some sources encountered errors. Results from other sources may still appear above.</p>
          </div>
        )}

      </div>
    </div>
  )
}
