import React, { useState } from 'react'
import { BookOpen, ExternalLink, X, ChevronDown, ChevronUp, Hash } from 'lucide-react'
import { useLiterature, AnchorCategory, ANCHOR_CATEGORIES } from '@/context/LiteratureContext'

interface LiteratureEvidenceProps {
  /** Which anchor categories are relevant to this workflow step */
  categories: AnchorCategory[]
  /** Step label for the header */
  stepLabel: string
}

export default function LiteratureEvidence({ categories, stepLabel }: LiteratureEvidenceProps) {
  const { savedAnchors, removeAnchor } = useLiterature()
  const [collapsed, setCollapsed] = useState(false)

  const relevant = savedAnchors.filter(a => categories.includes(a.category))

  if (relevant.length === 0) return null

  const catMeta = (cat: AnchorCategory) => ANCHOR_CATEGORIES.find(c => c.id === cat)!

  return (
    <div className="mx-8 mb-4 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/4 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#2563EB]/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-[#2563EB]" />
          <span className="text-sm font-semibold text-[#2563EB]">
            Literature Evidence
          </span>
          <span className="text-[10px] font-bold bg-[#2563EB] text-white rounded-full px-2 py-0.5">
            {relevant.length}
          </span>
          <span className="text-[10px] text-gray-500">
            anchors saved from literature — informing {stepLabel}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-[#2563EB]" />
          : <ChevronUp className="h-4 w-4 text-[#2563EB]" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {relevant.map(anchor => {
            const cat = catMeta(anchor.category)
            return (
              <div
                key={anchor.id}
                className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <Hash className="h-3.5 w-3.5 text-gray-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cat.color}`}>
                      {cat.label}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      anchor.relevance === 'high'
                        ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                        : anchor.relevance === 'medium'
                        ? 'text-blue-600 bg-blue-50 border-blue-200'
                        : 'text-gray-500 bg-gray-50 border-gray-200'
                    }`}>{anchor.relevance}</span>
                    <span className="text-[10px] text-gray-500 truncate">{anchor.section}</span>
                  </div>
                  <p className="text-sm text-gray-800 italic leading-snug mb-1">
                    "{anchor.text}"
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded border ${
                      anchor.paperSource === 'pubmed'          ? 'text-blue-600 bg-blue-50 border-blue-200' :
                      anchor.paperSource === 'clinicaltrials'  ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                      anchor.paperSource === 'openalex'        ? 'text-violet-600 bg-violet-50 border-violet-200' :
                                                                 'text-orange-600 bg-orange-50 border-orange-200'
                    }`}>{anchor.paperSource}</span>
                    <span className="text-[10px] text-gray-500 truncate flex-1">{anchor.paperTitle}</span>
                    {anchor.paperUrl && (
                      <a href={anchor.paperUrl} target="_blank" rel="noopener noreferrer"
                         className="shrink-0 text-[#2563EB] hover:text-blue-700"
                         title="Open paper in new tab">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeAnchor(anchor.id)}
                  className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-0.5"
                  title="Remove anchor"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
