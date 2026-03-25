import React, { useState, useCallback } from 'react'
import {
  Search, BookOpen, Beaker, Globe, Layers,
  ExternalLink, Loader2, ChevronDown, Filter,
  BookMarked, Users, Calendar, Quote, AlertCircle, X,
} from 'lucide-react'
import PaperViewer from '../components/ui/PaperViewer'

// ── Types ─────────────────────────────────────────────────────────────────────
type Source = 'pubmed' | 'clinicaltrials' | 'openalex' | 'semanticscholar'

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
}

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCES: { id: Source; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { id: 'pubmed',         label: 'PubMed',          icon: BookMarked, color: 'text-blue-600',   desc: 'MEDLINE · NLM · peer-reviewed' },
  { id: 'clinicaltrials', label: 'ClinicalTrials',   icon: Beaker,     color: 'text-emerald-600', desc: 'NIH ClinicalTrials.gov · trials' },
  { id: 'openalex',       label: 'OpenAlex',         icon: Globe,      color: 'text-violet-600',  desc: 'Open access · 250M+ works' },
  { id: 'semanticscholar',label: 'Semantic Scholar',  icon: Layers,     color: 'text-orange-600',  desc: 'Semantic indexing · citation graph' },
]

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchSource(source: Source, query: string, maxResults = 20): Promise<Paper[]> {
  const base = '/api/v1/search'

  if (source === 'pubmed') {
    const r = await fetch(`${base}/pubmed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    if (!r.ok) throw new Error(`PubMed: ${r.statusText}`)
    return r.json()
  }

  if (source === 'clinicaltrials') {
    const r = await fetch(`${base}/clinical-trials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    if (!r.ok) throw new Error(`ClinicalTrials: ${r.statusText}`)
    return r.json()
  }

  if (source === 'openalex') {
    const r = await fetch(`${base}/openalex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, max_results: maxResults }),
    })
    if (!r.ok) throw new Error(`OpenAlex: ${r.statusText}`)
    const data = await r.json()
    return data.results ?? data
  }

  if (source === 'semanticscholar') {
    const params = new URLSearchParams({ query, limit: String(maxResults) })
    const r = await fetch(`${base}/semantic-scholar?${params}`)
    if (!r.ok) throw new Error(`Semantic Scholar: ${r.statusText}`)
    const data = await r.json()
    return data.results ?? data
  }

  return []
}

// ── Components ────────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: Source }) {
  const s = SOURCES.find(x => x.id === source)
  if (!s) return null
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-current/30 bg-current/5 ${s.color}`}>
      {s.label}
    </span>
  )
}

function PaperCard({ paper, onClick }: { paper: Paper; onClick: () => void }) {
  const truncateAbstract = (text?: string | null, n = 200) =>
    text ? (text.length > n ? text.slice(0, n) + '…' : text) : null

  const displayText = paper.tldr ?? truncateAbstract(paper.abstract)

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (paper.url) window.open(paper.url, '_blank')
  }

  return (
    <div
      onClick={onClick}
      className="relative bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-5 hover:border-[#2563EB]/40 hover:shadow-md dark:hover:bg-white/6 transition-all cursor-pointer group"
    >
      {/* Open in new tab button */}
      {paper.url && (
        <button
          onClick={handleOpenClick}
          className="absolute top-3 right-3 p-1.5 text-gray-400 dark:text-gray-600 hover:text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          title="Open paper in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-start justify-between gap-4 mb-2 pr-10">
        <div className="flex items-center gap-2 flex-wrap">
          <SourceBadge source={paper.source} />
          {paper.journal && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]">{paper.journal}</span>
          )}
          {paper.trialStatus && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded border text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20">
              {paper.trialStatus}
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 leading-snug group-hover:text-[#2563EB] transition-colors">
        {paper.title}
      </h3>

      {displayText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
          {paper.tldr && <span className="font-semibold text-gray-600 dark:text-gray-300">TL;DR: </span>}
          {displayText}
        </p>
      )}

      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-600">
        {paper.authors.length > 0 && (
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

      {paper.meshTerms && paper.meshTerms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {paper.meshTerms.slice(0, 5).map(t => (
            <span key={t} className="text-[9px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30 px-2 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
      {paper.concepts && paper.concepts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {paper.concepts.slice(0, 5).map(c => (
            <span key={c} className="text-[9px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700/30 px-2 py-0.5 rounded">{c}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiteratureSearch() {
  const [query, setQuery] = useState('')
  const [activeSource, setActiveSource] = useState<Source>('pubmed')
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

  const search = useCallback(async (src?: Source) => {
    if (!query.trim()) return
    setSearched(true)
    const targets = src ? [src] : (Object.keys(results) as Source[])

    for (const s of targets) {
      setLoading(prev => ({ ...prev, [s]: true }))
      setErrors(prev => ({ ...prev, [s]: null }))
      try {
        const data = await fetchSource(s, query, maxResults)
        setResults(prev => ({ ...prev, [s]: data }))
      } catch (e: any) {
        setErrors(prev => ({ ...prev, [s]: e.message ?? 'Search failed' }))
      } finally {
        setLoading(prev => ({ ...prev, [s]: false }))
      }
    }
  }, [query, maxResults, results])

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
  const activeResults = results[activeSource]
  const activeLoading = loading[activeSource]
  const activeError = errors[activeSource]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">

      {/* Paper Viewer overlay */}
      {selectedPaper && (
        <PaperViewer paper={selectedPaper} onClose={() => setSelectedPaper(null)} />
      )}

      {/* Header */}
      <div className="border-b border-gray-200 dark:border-white/8 bg-white dark:bg-transparent px-8 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Literature Search</h1>
            <p className="text-gray-500 text-xs">PubMed · ClinicalTrials.gov · OpenAlex · Semantic Scholar</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">

        {/* Search bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#2563EB]/60 shadow-sm transition-colors"
              placeholder='e.g. "SGLT2 inhibitor heart failure" or "pediatric CNS disorder real-world evidence"'
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>

          <select
            className="bg-white dark:bg-white/4 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#2563EB]/60 shadow-sm"
            value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
          >
            {[10, 20, 50].map(n => <option key={n} value={n} className="bg-white dark:bg-[#1A1A1B]">{n} results</option>)}
          </select>

          <button
            onClick={() => search()}
            disabled={!query.trim() || Object.values(loading).some(Boolean)}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            {Object.values(loading).some(Boolean)
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
              : <><Search className="h-4 w-4" /> Search All</>
            }
          </button>
        </div>

        {/* Source tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-white/8 pb-0">
          {SOURCES.map(src => (
            <button
              key={src.id}
              onClick={() => { setActiveSource(src.id); if (!searched) search(src.id) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeSource === src.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <src.icon className="h-4 w-4" />
              {src.label}
              {results[src.id].length > 0 && (
                <span className="text-[10px] bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
                  {results[src.id].length}
                </span>
              )}
              {loading[src.id] && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
            </button>
          ))}

          {searched && totalResults > 0 && (
            <span className="ml-auto text-xs text-gray-400">{totalResults} total results</span>
          )}
        </div>

        {/* Source description */}
        {!searched && (
          <div className="space-y-3 mb-8">
            {SOURCES.map(src => (
              <div key={src.id} className="flex items-center gap-4 bg-white dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl px-5 py-4">
                <div className={`w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/10 flex items-center justify-center ${src.color}`}>
                  <src.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{src.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{src.desc}</p>
                </div>
                <button
                  onClick={() => { setActiveSource(src.id); search(src.id) }}
                  className="ml-auto text-xs text-[#2563EB] font-semibold hover:underline"
                >
                  Search only →
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {activeError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl mb-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Search error</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{activeError}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Make sure the backend is running: <code className="font-mono">python simple_backend.py</code>
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {activeLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-500">Searching {SOURCES.find(s => s.id === activeSource)?.label}…</p>
          </div>
        )}

        {/* Results */}
        {!activeLoading && activeResults.length > 0 && (
          <div className="space-y-3">
            {activeResults.map((paper, i) => (
              <PaperCard key={paper.id ?? paper.paperId ?? i} paper={paper} onClick={() => setSelectedPaper(paper)} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeLoading && searched && activeResults.length === 0 && !activeError && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No results found</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 max-w-sm">
              Try a different query or search a different source.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
