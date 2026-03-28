/**
 * RegulatoryPressureContext — manages Regulatory Pressure Mode state and
 * per-step attack signals for the study workflow.
 *
 * When Regulatory Pressure Mode is toggled ON, the context fetches attack
 * signals from the backend and exposes per-step risk data, an overall
 * confidence score, and a human-readable verdict.
 *
 * Usage:
 *   const { pressureMode, togglePressureMode, signals, stepRisk } = useRegulatoryPressure()
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { z } from 'zod'
import { apiClient } from '../services/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttackSignal {
  step: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  metric_name: string | null
  metric_value: number | null
  threshold: number | null
  source: string
}

export interface RegulatoryPressureState {
  pressureMode: boolean
  togglePressureMode: () => void
  signals: Record<string, AttackSignal[]>
  stepRisk: Record<string, 'critical' | 'warning' | 'info' | null>
  confidenceScore: number
  verdict: string
  verdictLabel: string
  loading: boolean
  refreshSignals: (projectId: string) => Promise<void>
}

// ─── Zod schema for the API response ──────────────────────────────────────────

const AttackSignalSchema = z.object({
  step: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  message: z.string(),
  metric_name: z.string().nullable(),
  metric_value: z.number().nullable(),
  threshold: z.number().nullable(),
  source: z.string(),
})

const RegulatoryConfidenceResponseSchema = z.object({
  signals_by_step: z.record(z.array(AttackSignalSchema)).default({}),
  step_risk: z.record(z.string()).default({}),
  confidence_score: z.number(),
  verdict: z.string(),
  verdict_label: z.string(),
  total_signals: z.number().optional(),
  critical_count: z.number().optional(),
  warning_count: z.number().optional(),
  info_count: z.number().optional(),
})

// ─── Context ──────────────────────────────────────────────────────────────────

const RegulatoryPressureContext = createContext<RegulatoryPressureState | null>(null)

export function useRegulatoryPressure(): RegulatoryPressureState {
  const ctx = useContext(RegulatoryPressureContext)
  if (!ctx) throw new Error('useRegulatoryPressure must be used within <RegulatoryPressureProvider>')
  return ctx
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Helpers removed — groupSignalsByStep/computeStepRisk now handled by backend response

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RegulatoryPressureProvider({ children, projectId: _projectId }: { children: React.ReactNode; projectId?: string | undefined }) {
  const [pressureMode, setPressureMode] = useState(false)
  const [signals, setSignals] = useState<Record<string, AttackSignal[]>>({})
  const [stepRisk, setStepRisk] = useState<Record<string, 'critical' | 'warning' | 'info' | null>>({})
  const [confidenceScore, setConfidenceScore] = useState(100)
  const [verdict, setVerdict] = useState('')
  const [verdictLabel, setVerdictLabel] = useState('')
  const [loading, setLoading] = useState(false)

  // Cache: projectId -> response, so we don't re-fetch unnecessarily
  const cacheRef = useRef<Record<string, {
    signals: Record<string, AttackSignal[]>
    stepRisk: Record<string, 'critical' | 'warning' | 'info' | null>
    confidenceScore: number
    verdict: string
    verdictLabel: string
  }>>({})

  const applyResponse = useCallback((data: z.infer<typeof RegulatoryConfidenceResponseSchema>) => {
    const grouped = data.signals_by_step
    const risk = data.step_risk as Record<string, 'critical' | 'warning' | 'info' | null>
    setSignals(grouped)
    setStepRisk(risk)
    setConfidenceScore(data.confidence_score)
    setVerdict(data.verdict)
    setVerdictLabel(data.verdict_label)
    return { signals: grouped, stepRisk: risk, confidenceScore: data.confidence_score, verdict: data.verdict, verdictLabel: data.verdict_label }
  }, [])

  const refreshSignals = useCallback(async (projectId: string) => {
    // Check cache first
    const cached = cacheRef.current[projectId]
    if (cached) {
      setSignals(cached.signals)
      setStepRisk(cached.stepRisk)
      setConfidenceScore(cached.confidenceScore)
      setVerdict(cached.verdict)
      setVerdictLabel(cached.verdictLabel)
      return
    }

    setLoading(true)
    try {
      const data = await apiClient.request(
        `/projects/${projectId}/study/regulatory-confidence`,
        RegulatoryConfidenceResponseSchema
      )
      const safeData = {
        ...data,
        signals_by_step: data.signals_by_step ?? {},
        step_risk: data.step_risk ?? {},
      }
      const result = applyResponse(safeData)
      cacheRef.current[projectId] = result
    } catch (err) {
      console.error('[RegulatoryPressure] Failed to fetch signals:', err)
      // Reset to safe defaults on error
      setSignals({})
      setStepRisk({})
      setConfidenceScore(0)
      setVerdict('error')
      setVerdictLabel('Unable to assess')
    } finally {
      setLoading(false)
    }
  }, [applyResponse])

  const togglePressureMode = useCallback(() => {
    setPressureMode(prev => !prev)
  }, [])

  return (
    <RegulatoryPressureContext.Provider
      value={{
        pressureMode,
        togglePressureMode,
        signals,
        stepRisk,
        confidenceScore,
        verdict,
        verdictLabel,
        loading,
        refreshSignals,
      }}
    >
      {children}
    </RegulatoryPressureContext.Provider>
  )
}
