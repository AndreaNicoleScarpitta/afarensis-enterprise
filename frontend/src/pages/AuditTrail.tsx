import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Lock, Eye, ChevronRight, ChevronLeft, CheckCircle2, Shield, Activity, AlertCircle } from 'lucide-react'
import { Study } from '../components/layout/Sidebar'
import { useStudyData } from '../services/hooks'
import { useStalenessCheck } from '../hooks/useStalenessCheck'
import StalenessBanner from '../components/ui/StalenessBanner'

interface Props {
  selectedStudy: Study
  protocolLocked: boolean
  reviewerMode: boolean
}

// SCHEMA REFERENCE — not shown to users
// const ALL_EVENTS = [
//   { ts: '2026-02-14T09:31:00Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'Protocol locked — cryptographic timestamp applied', category: 'lock',     step: 'Protocol' },
//   { ts: '2026-02-14T09:28:44Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'Final cohort construction script committed (hash c4f1a8b2)', category: 'code',     step: 'Step 4' },
//   { ts: '2026-02-14T08:52:11Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'Sensitivity analysis: active comparator restriction run', category: 'analysis', step: 'Step 7' },
//   { ts: '2026-02-13T17:10:33Z', user: 'J. Osei',         role: 'Statistician',   action: 'IPTW primary analysis executed — results logged', category: 'analysis', step: 'Step 6' },
//   { ts: '2026-02-13T14:05:19Z', user: 'J. Osei',         role: 'Statistician',   action: 'PS model fitted — AUC 0.78 recorded', category: 'analysis', step: 'Step 5' },
//   { ts: '2026-02-12T11:42:07Z', user: 'S. Patel',        role: 'Data Engineer',  action: 'Data provenance manifest signed (9f2a1b3d)', category: 'data',     step: 'Step 3' },
//   { ts: '2026-02-12T09:15:55Z', user: 'S. Patel',        role: 'Data Engineer',  action: 'Flatiron EHR extract loaded — validation pending', category: 'data',     step: 'Step 3' },
//   { ts: '2026-02-11T16:30:00Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'DAG finalised and saved to protocol', category: 'design',   step: 'Step 2' },
//   { ts: '2026-02-11T10:02:44Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'Estimand selected: ATT (per ICH E9(R1))', category: 'design',   step: 'Step 2' },
//   { ts: '2026-02-10T14:22:31Z', user: 'Dr. A. Nakamura', role: 'Lead Analyst',    action: 'Study protocol v1.3 uploaded — XY-301', category: 'design',   step: 'Step 1' },
//   { ts: '2026-02-10T09:00:00Z', user: 'System',           role: 'Afarensis',      action: 'Study workspace XY-301 created', category: 'system',   step: 'System' },
// ]

const categoryColor: Record<string, string> = {
  lock:     'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  code:     'text-[#2563EB] dark:text-[#60a5fa] bg-[#2563EB]/10 border-[#2563EB]/30',
  analysis: 'text-purple-400 bg-purple-900/20 border-purple-700/30',
  data:     'text-orange-300 bg-orange-900/30 border-orange-600/40',
  design:   'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10',
  system:   'text-gray-600 bg-gray-50 dark:bg-white/3 border-gray-200 dark:border-white/8',
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AuditTrail({ selectedStudy, protocolLocked, reviewerMode }: Props) {
  const locked = protocolLocked
  const { data: auditData, loading, error, refetch } = useStudyData(selectedStudy?.id, 'audit')
  const staleness = useStalenessCheck(selectedStudy?.id, 'audit')

  const [allEvents, setAllEvents] = useState<any[]>([])

  useEffect(() => {
    if (auditData && Array.isArray(auditData.events) && auditData.events.length) {
      setAllEvents(auditData.events)
    }
  }, [auditData])

  // Defensive: ensure state is always an array
  const safeAllEvents = Array.isArray(allEvents) ? allEvents : []

  const [filter, setFilter] = useState<string>('all')
  const filters = ['all', 'lock', 'code', 'analysis', 'data', 'design']
  const events = filter === 'all' ? safeAllEvents : safeAllEvents.filter(e => e.category === filter)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
      <div className="border-b border-gray-200 dark:border-white/8 px-8 py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/30 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-[#2563EB] dark:text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-[#2563EB] uppercase tracking-widest">Step 09</span>
                {locked && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold"><Lock className="h-2.5 w-2.5" /> Locked</span>}
                {reviewerMode && <span className="flex items-center gap-1 text-[10px] text-[#2563EB] dark:text-[#60a5fa] font-semibold"><Eye className="h-2.5 w-2.5" /> Reviewer View</span>}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Trail</h1>
              <p className="text-gray-500 text-xs mt-0.5">All transformations · analyst actions · protocol changes · 21 CFR Part 11</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900 dark:text-white">{selectedStudy.protocol}</p>
            <div className="flex items-center gap-1.5 justify-end mt-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              <p className="text-[10px] text-emerald-400 font-semibold">21 CFR Part 11 Ready</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5 max-w-4xl">

        <StalenessBanner
          staleUpstreams={staleness.staleUpstreams}
          onAcknowledge={staleness.acknowledge}
        />

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm">Loading audit trail...</div>
        )}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl p-4">
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
            <p className="flex-1 text-sm text-red-600 dark:text-red-400">Error loading data: {error}</p>
            <button onClick={() => refetch()} className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              Retry
            </button>
          </div>
        )}

        {safeAllEvents.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Activity className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
            <p className="text-xs text-gray-600 mt-1">No audit events recorded yet. Events are logged as you work.</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Events', value: safeAllEvents.length.toString() },
            { label: 'Unique Users', value: safeAllEvents.length > 0 ? new Set(safeAllEvents.map((e: any) => e.user)).size.toString() : '—' },
            { label: 'Protocol Locked', value: locked && auditData?.protocol_lock_timestamp ? new Date(auditData.protocol_lock_timestamp).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : locked ? 'Yes' : 'Not yet locked' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-100/80 dark:bg-white/4 border border-gray-200 dark:border-white/8 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Protocol lock banner */}
        {locked && (
          <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-400">
                Protocol Locked{auditData?.protocol_lock_timestamp ? ` — ${auditData.protocol_lock_timestamp}` : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                All elements above this timestamp are immutable.
                {auditData?.protocol_lock_hash ? (
                  <> Hash: <span className="font-mono text-gray-600 dark:text-gray-300">{auditData.protocol_lock_hash}</span> <span className="text-amber-500 text-[10px] font-semibold ml-1">(not independently verified)</span></>
                ) : (
                  <span className="text-gray-500 ml-1">No cryptographic hash available.</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filter === f
                  ? 'bg-[#2563EB]/20 border-[#2563EB]/40 text-[#2563EB] dark:text-[#60a5fa]'
                  : 'bg-gray-100/80 dark:bg-white/4 border-gray-200 dark:border-white/8 text-gray-500 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-white/6'
              }`}
            >
              {f === 'all' ? `All (${safeAllEvents.length})` : `${f} (${safeAllEvents.filter(e => e.category === f).length})`}
            </button>
          ))}
        </div>

        {/* Event log */}
        <section>
          <div className="border border-gray-200 dark:border-white/8 rounded-xl overflow-hidden">
            {events.map((ev, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 px-4 py-3.5 ${i < events.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''} hover:bg-gray-50 dark:bg-white/3 transition-colors ${ev.category === 'lock' ? 'bg-emerald-900/10' : ''}`}
              >
                {/* Category badge */}
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 mt-0.5 ${categoryColor[ev.category]}`}>
                  {ev.category}
                </span>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white font-medium leading-snug">{ev.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500">{ev.user}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-[10px] text-gray-600">{ev.role}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-[10px] text-gray-600">{ev.step}</span>
                  </div>
                </div>
                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 font-mono shrink-0">{formatTs(ev.ts)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-700 mt-2">
            Events are append-only and server-recorded. Integrity verification requires backend audit service.
          </p>
        </section>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-white/8">
          <Link to={`/projects/${selectedStudy.id}/reproducibility`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-600 dark:text-gray-300 text-sm font-medium transition-colors">
            <ChevronLeft className="h-4 w-4" /> Step 8: Reproducibility
          </Link>
          <Link to={`/projects/${selectedStudy.id}/regulatory-output`} className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-gray-900 dark:text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Step 10: Regulatory Output <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  )
}
