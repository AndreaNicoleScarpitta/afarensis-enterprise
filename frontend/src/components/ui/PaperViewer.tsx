import React, { useState, useEffect } from 'react'
import {
  X, ExternalLink, Download, Users, Calendar,
  Quote, Maximize2, Minimize2,
  Copy, CheckCircle2, FileText, Hash, Layers, AlertCircle,
  BookOpen, Plus, BookMarked,
} from 'lucide-react'
import { useLiterature, AnchorCategory, ANCHOR_CATEGORIES } from '@/context/LiteratureContext'

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
  source: string
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
  eligibilityCriteria?: string | null
  metadataJson?: Record<string, unknown>
}

interface Anchor {
  id: string
  text: string
  section: string
  relevance: 'high' | 'medium' | 'low'
  note?: string
}

interface PaperViewerProps {
  paper: Paper
  onClose: () => void
  anchors?: Anchor[]
}

function generateAnchors(paper: Paper): Anchor[] {
  const anchors: Anchor[] = []
  const text = [paper.abstract ?? '', paper.tldr ?? '', paper.eligibilityCriteria ?? ''].join(' ')

  const patterns: { regex: RegExp; section: string; relevance: 'high' | 'medium' | 'low' }[] = [
    { regex: /hazard ratio[s]?[^.]{0,60}/gi,              section: 'Abstract — Results',    relevance: 'high' },
    { regex: /\bHR[^.]{0,40}(?:95%|CI)[^.]{0,40}/gi,     section: 'Abstract — Results',    relevance: 'high' },
    { regex: /confidence interval[^.]{0,60}/gi,            section: 'Abstract — Results',    relevance: 'high' },
    { regex: /propensity[- ]score[^.]{0,60}/gi,            section: 'Abstract — Methods',    relevance: 'high' },
    { regex: /inverse probability[^.]{0,60}/gi,            section: 'Methods',               relevance: 'high' },
    { regex: /new user design[^.]{0,40}/gi,                section: 'Methods',               relevance: 'high' },
    { regex: /active comparator[^.]{0,40}/gi,              section: 'Methods',               relevance: 'high' },
    { regex: /external comparator[^.]{0,40}/gi,            section: 'Methods',               relevance: 'high' },
    { regex: /randomized controlled trial[^.]{0,40}/gi,    section: 'Abstract — Background', relevance: 'medium' },
    { regex: /real.world evidence[^.]{0,40}/gi,            section: 'Introduction',          relevance: 'medium' },
    { regex: /e-value[^.]{0,40}|evalue[^.]{0,40}/gi,      section: 'Discussion',            relevance: 'medium' },
    { regex: /unmeasured confound[^.]{0,60}/gi,            section: 'Limitations',           relevance: 'medium' },
    { regex: /p[ ]?(?:=|<|>)[ ]?[\d.]+[^.]{0,20}/gi,     section: 'Results',               relevance: 'medium' },
    { regex: /primary endpoint[^.]{0,60}/gi,               section: 'Methods',               relevance: 'high' },
    { regex: /eligibility criteria[^.]{0,60}/gi,           section: 'Eligibility',           relevance: 'medium' },
    { regex: /incidence rate[^.]{0,60}/gi,                 section: 'Results',               relevance: 'medium' },
  ]

  patterns.forEach(({ regex, section, relevance }) => {
    const matches = text.match(regex)
    if (matches) {
      matches.slice(0, 2).forEach(match => {
        const trimmed = match.trim().slice(0, 120)
        if (trimmed.length > 5) {
          anchors.push({ id: `anchor_${anchors.length}`, text: trimmed, section, relevance })
        }
      })
    }
  })

  // Deduplicate by text prefix
  const seen = new Set<string>()
  return anchors.filter(a => {
    const key = a.text.slice(0, 30).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 10)
}

function highlightAnchors(text: string, anchors: Anchor[]): React.ReactNode[] {
  if (!anchors.length) return [text]
  const escapedTerms = anchors.map(a => a.text.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    const anchor = anchors.find(a => a.text.toLowerCase().startsWith(part.toLowerCase().slice(0, 30)) && part.length > 5)
    if (anchor) {
      const color = anchor.relevance === 'high'
        ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-600/40'
        : anchor.relevance === 'medium'
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-600/30'
        : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10'
      return (
        <mark key={i} className={`px-0.5 rounded border ${color} cursor-help`}
          title={`${anchor.section} — ${anchor.relevance} relevance`}>
          {part}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

const sourceColors: Record<string, string> = {
  pubmed:          'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/30',
  clinicaltrials:  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/30',
  openalex:        'text-violet-600 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/30',
  semanticscholar: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/30',
}

export default function PaperViewer({ paper, onClose, anchors: propAnchors }: PaperViewerProps) {
  const { saveAnchor, savedAnchors } = useLiterature()
  const [tab, setTab] = useState<'abstract' | 'fulltext' | 'anchors' | 'metadata'>('abstract')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  // Per-anchor category selector + saved state
  const [anchorCategories, setAnchorCategories] = useState<Record<string, AnchorCategory>>({})
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set())

  const anchors = propAnchors ?? generateAnchors(paper)
  const pdfUrl = paper.openAccessPdfUrl ?? paper.openAccessUrl ?? null
  const extUrl = paper.url

  // Build source URL for "open in new tab"
  const sourceUrl = extUrl
    ?? (paper.doi ? `https://doi.org/${paper.doi}` : null)
    ?? (paper.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/` : null)
    ?? (paper.nctId ? `https://clinicaltrials.gov/study/${paper.nctId}` : null)
    ?? (paper.paperId ? `https://www.semanticscholar.org/paper/${paper.paperId}` : null)

  const isAlreadySaved = (anchorText: string) =>
    savedAnchors.some(a => a.paperTitle === paper.title && a.text === anchorText)

  const handleSaveAnchor = (anchor: Anchor) => {
    const category = anchorCategories[anchor.id] ?? 'general'
    saveAnchor({
      paperTitle: paper.title,
      paperSource: paper.source,
      paperUrl: sourceUrl ?? undefined,
      text: anchor.text,
      section: anchor.section,
      relevance: anchor.relevance,
      category,
    })
    setJustSaved(prev => new Set([...prev, anchor.id]))
    setTimeout(() => setJustSaved(prev => { const next = new Set(prev); next.delete(anchor.id); return next }), 2500)
  }

  const copyRef = () => {
    const ref = paper.doi
      ? `${paper.authors[0]?.split(',')[0] ?? 'et al.'} et al. (${paper.publicationDate ?? paper.year}). ${paper.title}. doi:${paper.doi}`
      : `${paper.authors[0]?.split(',')[0] ?? 'et al.'} et al. (${paper.publicationDate ?? paper.year}). ${paper.title}.`
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`ml-auto bg-white dark:bg-[#111113] shadow-2xl flex flex-col transition-all duration-300 ${expanded ? 'w-full' : 'w-[720px] max-w-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/8 bg-gray-50 dark:bg-[#0d0d0e] shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${sourceColors[paper.source] ?? 'text-gray-500 bg-gray-100 border-gray-200'}`}>
              {paper.source}
            </span>
            {pdfUrl && (
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 px-2 py-0.5 rounded">
                Open Access
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={copyRef} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy ref'}
            </button>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 px-3 py-1.5 rounded transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
              </a>
            )}
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title + authors */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/8 shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-snug mb-3">{paper.title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {paper.authors.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {paper.authors.slice(0, 4).join(', ')}{paper.authors.length > 4 ? ` +${paper.authors.length - 4} more` : ''}
              </span>
            )}
            {(paper.publicationDate ?? paper.year) && (
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{paper.publicationDate ?? paper.year}</span>
            )}
            {paper.journal && <span className="font-medium text-gray-600 dark:text-gray-300 italic">{paper.journal}</span>}
            {paper.doi && <span className="font-mono text-[10px]">DOI: {paper.doi}</span>}
            {paper.citationCount !== undefined && paper.citationCount > 0 && (
              <span className="flex items-center gap-1.5"><Quote className="h-3.5 w-3.5" />{paper.citationCount.toLocaleString()} citations</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-white/8 shrink-0">
          {[
            { id: 'abstract',  label: 'Abstract',                        icon: BookOpen },
            { id: 'fulltext',  label: 'Full Text',                       icon: FileText },
            { id: 'anchors',   label: `Anchors (${anchors.length})`,     icon: Hash },
            { id: 'metadata',  label: 'Metadata',                        icon: Layers },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Abstract tab ──────────────────────────────────────────── */}
          {tab === 'abstract' && (
            <div className="px-6 py-5 space-y-4">
              {paper.tldr && (
                <div className="bg-blue-50 dark:bg-[#2563EB]/10 border border-blue-200 dark:border-[#2563EB]/30 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-1">TL;DR (Structured Summary)</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{paper.tldr}</p>
                </div>
              )}

              {paper.abstract ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Abstract</p>
                    <button
                      onClick={() => setTab('anchors')}
                      className="flex items-center gap-1 text-[10px] text-[#2563EB] font-semibold hover:underline"
                    >
                      <Hash className="h-3 w-3" /> {anchors.length} anchors detected →
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    {anchors.length > 0 ? highlightAnchors(paper.abstract, anchors) : paper.abstract}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No abstract available.</p>
                  {sourceUrl && (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                       className="mt-3 inline-flex items-center gap-2 text-sm text-[#2563EB] font-semibold hover:underline">
                      <ExternalLink className="h-4 w-4" /> View at source
                    </a>
                  )}
                </div>
              )}

              {paper.meshTerms && paper.meshTerms.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">MeSH Terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {paper.meshTerms.map(t => (
                      <span key={t} className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {paper.eligibilityCriteria && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Eligibility Criteria</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-white/3 rounded-lg p-4">{paper.eligibilityCriteria}</p>
                </div>
              )}

              {/* Open in new tab CTA if no PDF */}
              {sourceUrl && (
                <div className="pt-2 border-t border-gray-100 dark:border-white/8 flex items-center gap-3">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline">
                    <ExternalLink className="h-4 w-4" /> Read full paper at {paper.source}
                  </a>
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                      <Download className="h-4 w-4" /> Download PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Full text tab ─────────────────────────────────────────── */}
          {tab === 'fulltext' && (
            <div className="h-full flex flex-col">
              {pdfUrl ? (
                <div className="flex-1 relative min-h-[400px]">
                  {!iframeLoaded && !iframeError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#0d0d0e] z-10">
                      <div className="text-center">
                        <div className="w-10 h-10 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Loading full text…</p>
                      </div>
                    </div>
                  )}
                  {iframeError ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                      <AlertCircle className="h-10 w-10 text-amber-500" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Could not embed PDF</p>
                      <p className="text-xs text-gray-500">The publisher may restrict embedding.</p>
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-2 bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors">
                        <ExternalLink className="h-4 w-4" /> Open PDF in new tab
                      </a>
                    </div>
                  ) : (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full border-0 min-h-[500px]"
                      title={paper.title}
                      onLoad={() => setIframeLoaded(true)}
                      onError={() => setIframeError(true)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center min-h-[300px]">
                  <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Full text not available in-app</p>
                  <p className="text-xs text-gray-400 max-w-sm">
                    This paper is not open-access or no PDF URL was returned. Open the paper at its source to read the full text.
                  </p>
                  {sourceUrl && (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 bg-[#2563EB] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors">
                      <ExternalLink className="h-4 w-4" /> Open at {paper.source}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Anchors tab ───────────────────────────────────────────── */}
          {tab === 'anchors' && (
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-[#2563EB]/8 dark:bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                <Hash className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                <p>
                  Anchors are key passages extracted from this paper. Tag each with a workflow category and click
                  <strong className="text-gray-800 dark:text-gray-200"> Save to Study</strong> to propagate evidence upstream and downstream across your workflow.
                </p>
              </div>

              {anchors.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No anchors detected in this paper's abstract.</div>
              ) : (
                anchors.map(anchor => {
                  const saved = isAlreadySaved(anchor.text) || justSaved.has(anchor.id)
                  const selectedCat = anchorCategories[anchor.id] ?? 'general'
                  const catMeta = ANCHOR_CATEGORIES.find(c => c.id === selectedCat)!

                  return (
                    <div key={anchor.id} className={`rounded-xl border p-4 ${
                      anchor.relevance === 'high'   ? 'bg-yellow-50 dark:bg-yellow-900/15 border-yellow-200 dark:border-yellow-700/30' :
                      anchor.relevance === 'medium' ? 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-700/30' :
                                                     'bg-gray-50 dark:bg-white/4 border-gray-200 dark:border-white/8'
                    }`}>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            anchor.relevance === 'high'   ? 'text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600/40 bg-yellow-100 dark:bg-yellow-900/30' :
                            anchor.relevance === 'medium' ? 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-600/30 bg-blue-100 dark:bg-blue-900/20' :
                                                            'text-gray-500 border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/8'
                          }`}>{anchor.relevance}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{anchor.section}</span>
                        </div>
                      </div>

                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 italic mb-3">"{anchor.text}"</p>

                      {/* Category + Save */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Tag as:</span>
                        <div className="flex flex-wrap gap-1">
                          {ANCHOR_CATEGORIES.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => setAnchorCategories(prev => ({ ...prev, [anchor.id]: cat.id }))}
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${
                                selectedCat === cat.id ? cat.color : 'text-gray-400 bg-transparent border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => !saved && handleSaveAnchor(anchor)}
                          disabled={saved}
                          className={`ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                            saved
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40 cursor-default'
                              : 'bg-[#2563EB] hover:bg-blue-700 text-white'
                          }`}
                        >
                          {saved
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved to Study</>
                            : <><BookMarked className="h-3.5 w-3.5" /> Save to Study</>
                          }
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              {anchors.length > 0 && (
                <p className="text-[10px] text-gray-400 text-center pt-2">
                  Saved anchors appear in relevant workflow pages (Study Definition, Causal Framework, Effect Estimation, Bias & Sensitivity).
                </p>
              )}
            </div>
          )}

          {/* ── Metadata tab ──────────────────────────────────────────── */}
          {tab === 'metadata' && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Source',         value: paper.source },
                  { label: 'Source ID',      value: paper.pmid ?? paper.nctId ?? paper.paperId ?? paper.id ?? '—' },
                  { label: 'DOI',            value: paper.doi ?? '—' },
                  { label: 'Journal',        value: paper.journal ?? '—' },
                  { label: 'Published',      value: paper.publicationDate ?? String(paper.year ?? '—') },
                  { label: 'Authors',        value: String(paper.authors.length) },
                  { label: 'Citations',      value: paper.citationCount !== undefined ? paper.citationCount.toLocaleString() : '—' },
                  { label: 'Influential citations', value: paper.influentialCitationCount !== undefined ? paper.influentialCitationCount.toLocaleString() : '—' },
                  { label: 'Open Access',    value: (paper.openAccessPdfUrl || paper.openAccessUrl) ? 'Yes' : 'No' },
                  { label: 'Trial Status',   value: paper.trialStatus ?? '—' },
                  { label: 'Phase',          value: paper.phase?.join(', ') ?? '—' },
                  { label: 'Conditions',     value: paper.conditions?.slice(0, 3).join(', ') ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium break-words">{value}</p>
                  </div>
                ))}
              </div>
              {sourceUrl && (
                <div className="pt-4 border-t border-gray-100 dark:border-white/8 space-y-2">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-sm text-[#2563EB] font-semibold hover:underline">
                    <ExternalLink className="h-4 w-4" /> View at {paper.source}
                  </a>
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                      <Download className="h-4 w-4" /> Download Open Access PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
