/**
 * AttackSignalBanner — compact inline banner that displays per-step attack
 * signals when Regulatory Pressure Mode is active.
 *
 * Embed at the top of each workflow page (steps 03-07):
 *   <AttackSignalBanner step="comparability" />
 *
 * Renders nothing when pressure mode is OFF. Shows a green badge when
 * pressure mode is ON but no signals exist for the given step.
 */

import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldAlert,
} from 'lucide-react'
import { useRegulatoryPressure, type AttackSignal } from '../context/RegulatoryPressureContext'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AttackSignalBannerProps {
  step: string
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    label: 'critical',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
    label: 'warning',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    label: 'info',
  },
} as const

type Severity = keyof typeof SEVERITY_CONFIG

const SEVERITY_PRIORITY: Record<Severity, number> = { critical: 3, warning: 2, info: 1 }

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: AttackSignal }) {
  const config = SEVERITY_CONFIG[signal.severity]
  const Icon = config.icon

  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 ${config.bg} border-b ${config.border} last:border-b-0`}>
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${config.text}`}>{signal.title}</p>
        <p className="text-sm text-gray-600 mt-0.5">{signal.message}</p>
        {signal.metric_name && signal.metric_value !== null && (
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">{signal.metric_name}</span>
            {' = '}
            <span className={`font-mono font-semibold ${config.text}`}>
              {typeof signal.metric_value === 'number' ? signal.metric_value.toFixed(3) : signal.metric_value}
            </span>
            {signal.threshold !== null && (
              <span className="text-gray-400">
                {' '}(threshold: {signal.threshold.toFixed(3)})
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AttackSignalBanner({ step }: AttackSignalBannerProps) {
  const { pressureMode, signals, loading } = useRegulatoryPressure()

  const stepSignals = signals[step] ?? []
  const hasCritical = stepSignals.some(s => s.severity === 'critical')

  // Auto-expand if there are critical signals
  const [expanded, setExpanded] = useState(hasCritical)

  // Recompute summary counts
  const summary = useMemo(() => {
    const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 }
    let maxSeverity: Severity = 'info'
    for (const s of stepSignals) {
      counts[s.severity]++
      if (SEVERITY_PRIORITY[s.severity] > SEVERITY_PRIORITY[maxSeverity]) {
        maxSeverity = s.severity
      }
    }
    return { counts, maxSeverity }
  }, [stepSignals])

  // ── Render nothing when pressure mode is off ────────────────────────
  if (!pressureMode) return null

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Analysing regulatory signals...</span>
      </div>
    )
  }

  // ── No signals — show green badge ───────────────────────────────────
  if (stepSignals.length === 0) {
    return (
      <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
        <Shield className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700">No attack signals</span>
      </div>
    )
  }

  // ── Signals present — collapsible banner ────────────────────────────
  const headerConfig = SEVERITY_CONFIG[summary.maxSeverity]
  const HeaderIcon = hasCritical ? ShieldAlert : AlertTriangle

  // Build count summary string
  const countParts: string[] = []
  if (summary.counts.critical > 0) countParts.push(`${summary.counts.critical} critical`)
  if (summary.counts.warning > 0) countParts.push(`${summary.counts.warning} warning${summary.counts.warning !== 1 ? 's' : ''}`)
  if (summary.counts.info > 0) countParts.push(`${summary.counts.info} info`)

  return (
    <div className={`mb-4 rounded-lg border ${headerConfig.border} overflow-hidden`}>
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className={`
          w-full flex items-center gap-2.5 px-4 py-2.5
          ${headerConfig.bg} hover:brightness-95
          transition-all duration-150 cursor-pointer
          text-left
        `}
      >
        <HeaderIcon className={`h-4.5 w-4.5 flex-shrink-0 ${headerConfig.text}`} />
        <span className={`text-sm font-semibold ${headerConfig.text}`}>
          {stepSignals.length} Attack Signal{stepSignals.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-gray-500 ml-1">
          ({countParts.join(', ')})
        </span>
        <span className="ml-auto flex-shrink-0">
          {expanded ? (
            <ChevronDown className={`h-4 w-4 ${headerConfig.text}`} />
          ) : (
            <ChevronRight className={`h-4 w-4 ${headerConfig.text}`} />
          )}
        </span>
      </button>

      {/* ── Expanded signal list ───────────────────────────────────────── */}
      <div
        className={`
          transition-all duration-200 ease-in-out overflow-hidden
          ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="divide-y divide-gray-100">
          {stepSignals
            .sort((a, b) => SEVERITY_PRIORITY[b.severity] - SEVERITY_PRIORITY[a.severity])
            .map((signal, idx) => (
              <SignalRow key={`${signal.step}-${signal.title}-${idx}`} signal={signal} />
            ))}
        </div>
      </div>
    </div>
  )
}
