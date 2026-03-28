import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'

export type AnchorCategory =
  | 'estimand'      // informs Study Definition / estimand / endpoint
  | 'covariate'     // informs Causal Framework / DAG
  | 'effect'        // informs Effect Estimation / forest plot
  | 'bias'          // informs Bias & Sensitivity / E-value
  | 'methodology'   // informs Data Provenance / Cohort Construction
  | 'general'       // any step

export const ANCHOR_CATEGORIES: { id: AnchorCategory; label: string; color: string }[] = [
  { id: 'estimand',    label: 'Estimand / Endpoint',  color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'covariate',   label: 'Covariate / DAG',      color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'effect',      label: 'Effect Estimate',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'bias',        label: 'Bias / Sensitivity',    color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'methodology', label: 'Methodology',           color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'general',     label: 'General',               color: 'text-gray-600 bg-gray-50 border-gray-200' },
]

export interface SavedAnchor {
  id: string
  paperTitle: string
  paperSource: string
  paperUrl?: string
  text: string
  section: string
  relevance: 'high' | 'medium' | 'low'
  category: AnchorCategory
  savedAt: string
}

interface LiteratureContextValue {
  savedAnchors: SavedAnchor[]
  saveAnchor: (anchor: Omit<SavedAnchor, 'id' | 'savedAt'>) => void
  removeAnchor: (id: string) => void
  clearAnchors: () => void
  anchorsByCategory: (cat: AnchorCategory) => SavedAnchor[]
}

const LiteratureContext = createContext<LiteratureContextValue>({
  savedAnchors: [],
  saveAnchor: () => {},
  removeAnchor: () => {},
  clearAnchors: () => {},
  anchorsByCategory: () => [],
})

export function LiteratureProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const storageKey = useMemo(() => `afarensis-saved-anchors-${projectId}`, [projectId])

  const [savedAnchors, setSavedAnchors] = useState<SavedAnchor[]>([])

  // Re-load from localStorage when projectId changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      setSavedAnchors(stored ? JSON.parse(stored) : [])
    } catch { setSavedAnchors([]) }
  }, [storageKey])

  const saveAnchor = useCallback((anchor: Omit<SavedAnchor, 'id' | 'savedAt'>) => {
    const newAnchor: SavedAnchor = {
      ...anchor,
      id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt: new Date().toISOString(),
    }
    setSavedAnchors(prev => {
      const next = [...prev, newAnchor]
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [storageKey])

  const removeAnchor = useCallback((id: string) => {
    setSavedAnchors(prev => {
      const next = prev.filter(a => a.id !== id)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [storageKey])

  const clearAnchors = useCallback(() => {
    setSavedAnchors([])
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey])

  const anchorsByCategory = useCallback(
    (cat: AnchorCategory) => savedAnchors.filter(a => a.category === cat),
    [savedAnchors]
  )

  return (
    <LiteratureContext.Provider value={{ savedAnchors, saveAnchor, removeAnchor, clearAnchors, anchorsByCategory }}>
      {children}
    </LiteratureContext.Provider>
  )
}

export function useLiterature() {
  return useContext(LiteratureContext)
}
