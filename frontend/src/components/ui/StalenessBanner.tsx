/**
 * StalenessBanner — Displays upstream-change warnings on workflow step pages.
 *
 * Shows which upstream steps have changed since this step was last saved,
 * with biostatistical impact descriptions explaining WHY the change matters.
 */
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { StaleUpstream } from '../../hooks/useStalenessCheck'

interface StalenessBannerProps {
  staleUpstreams: StaleUpstream[]
  onAcknowledge: () => Promise<void>
  onRerun?: () => void
  stepLabel?: string
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function StalenessBanner({ staleUpstreams, onAcknowledge, onRerun }: StalenessBannerProps) {
  const [expanded, setExpanded] = useState(true)
  const [acknowledging, setAcknowledging] = useState(false)

  if (!staleUpstreams.length) return null

  const handleAcknowledge = async () => {
    setAcknowledging(true)
    try {
      await onAcknowledge()
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-600/30 bg-amber-950/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-950/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-amber-400">
            Upstream data changed
          </span>
          <span className="text-xs text-amber-500/70">
            {staleUpstreams.length} upstream {staleUpstreams.length === 1 ? 'step has' : 'steps have'} been modified
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-500/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-500/60" />
        )}
      </button>

      {/* Detail panel */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {staleUpstreams.map((s) => (
            <div key={s.step} className="rounded-md border border-amber-700/20 bg-amber-950/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-300">{s.label}</span>
                <span className="text-[10px] text-amber-500/60">{timeAgo(s.changedAt)}</span>
              </div>
              <p className="text-xs text-amber-200/80 leading-relaxed">{s.impact}</p>
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         bg-amber-700/30 hover:bg-amber-700/50 text-amber-300 border border-amber-600/30
                         disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              {acknowledging ? 'Acknowledging...' : 'Acknowledge & Continue'}
            </button>
            {onRerun && (
              <button
                onClick={onRerun}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                           bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 border border-blue-600/30
                           transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Re-run Analysis
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
