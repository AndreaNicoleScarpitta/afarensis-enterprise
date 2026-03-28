import React, { useState } from 'react'
import {
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Ban,
  Info,
  SkipForward,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValidationGatePanelProps {
  /** The full validation report from the backend pre-analysis validator */
  validationReport: any
  /** Called when the user acknowledges the block */
  onDismiss?: () => void
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  CRITICAL: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: <XCircle className="w-4 h-4 text-red-600" />,
  },
  MAJOR: {
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
    icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
  },
  WARNING: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  },
  INFO: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: <Info className="w-4 h-4 text-blue-500" />,
  },
}

const PHASE_STATUS_BADGE: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PASS: { color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'PASS' },
  FAIL: { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3.5 h-3.5" />, label: 'FAIL' },
  WARN: { color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'WARN' },
  SKIP: { color: 'bg-gray-100 text-gray-600', icon: <SkipForward className="w-3.5 h-3.5" />, label: 'SKIP' },
  INFO: { color: 'bg-blue-100 text-blue-700', icon: <Info className="w-3.5 h-3.5" />, label: 'INFO' },
}

function PhaseSection({ name, phase }: { name: string; phase: any }) {
  const [expanded, setExpanded] = useState(phase.status === 'FAIL')
  const badge = PHASE_STATUS_BADGE[phase.status] || PHASE_STATUS_BADGE['INFO']

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="text-sm font-medium text-gray-800">{name}</span>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', badge.color)}>
          {badge.icon} {badge.label}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {phase.detail && (
            <p className="text-sm text-gray-600 mt-3 mb-3">{phase.detail}</p>
          )}

          {Array.isArray(phase.findings) && phase.findings.length > 0 && (
            <div className="space-y-2 mt-2">
              {phase.findings.map((finding: any, i: number) => {
                const severity = finding.severity || 'INFO'
                const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES['INFO']

                return (
                  <div key={i} className={cn('border rounded-md p-3', style.bg)}>
                    <div className="flex items-start gap-2">
                      {style.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-xs font-semibold uppercase', style.text)}>{severity}</span>
                          {finding.check && <span className="text-xs text-gray-500">{finding.check}</span>}
                          {finding.issue && <span className="text-xs text-gray-500">{finding.issue}</span>}
                          {finding.variable && <span className="text-xs text-gray-500">{finding.variable}</span>}
                          {finding.condition && (
                            <span className={cn('text-xs font-mono', finding.met ? 'text-emerald-600' : 'text-red-600')}>
                              {finding.condition}: {finding.met ? 'MET' : 'NOT MET'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">
                          {finding.detail || finding.note || finding.mapped_to || '—'}
                        </p>
                        {finding.n_violations != null && (
                          <p className="text-xs text-red-600 mt-1 font-medium">
                            {finding.n_violations} violation(s) found
                            {finding.total_immortal_time != null && ` | ${finding.total_immortal_time} months of immortal person-time`}
                          </p>
                        )}
                        {Array.isArray(finding.violations) && finding.violations.length > 0 && (
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-300">
                                  <th className="text-left py-1 px-1.5 font-medium text-gray-500">Subject</th>
                                  <th className="text-left py-1 px-1.5 font-medium text-gray-500">Issue</th>
                                  <th className="text-right py-1 px-1.5 font-medium text-gray-500">Treatment Start</th>
                                  <th className="text-right py-1 px-1.5 font-medium text-gray-500">Time to Event</th>
                                </tr>
                              </thead>
                              <tbody>
                                {finding.violations.map((v: any, j: number) => (
                                  <tr key={j} className="border-b border-gray-200">
                                    <td className="py-1 px-1.5 font-mono">{v.subject}</td>
                                    <td className="py-1 px-1.5 text-red-600">{v.issue}</td>
                                    <td className="py-1 px-1.5 text-right font-mono">{v.treatment_start ?? '—'}</td>
                                    <td className="py-1 px-1.5 text-right font-mono">{v.time_to_event ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ValidationGatePanel({ validationReport, onDismiss }: ValidationGatePanelProps) {
  if (!validationReport) return null

  const isBlocked = validationReport.verdict === 'BLOCKED'
  const phases = validationReport.phases || {}
  const blockReasons = Array.isArray(validationReport.block_reasons) ? validationReport.block_reasons : []

  return (
    <div className={cn(
      'rounded-xl border-2 p-6 mb-6',
      isBlocked
        ? 'border-red-300 bg-red-50/50'
        : 'border-emerald-300 bg-emerald-50/50'
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {isBlocked ? (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Ban className="w-5 h-5 text-red-600" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
          </div>
        )}
        <div>
          <h3 className={cn('text-lg font-semibold', isBlocked ? 'text-red-800' : 'text-emerald-800')}>
            Pre-Analysis Validation: {isBlocked ? 'BLOCKED' : 'PASSED'}
          </h3>
          <p className="text-sm text-gray-600">
            {isBlocked
              ? 'Statistical models will NOT execute until all issues are resolved.'
              : 'All validation phases passed. Analysis is permitted.'}
          </p>
        </div>
      </div>

      {/* Block reasons */}
      {isBlocked && blockReasons.length > 0 && (
        <div className="bg-red-100 border border-red-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Block Reasons
          </h4>
          <ul className="space-y-1">
            {blockReasons.map((reason: string, i: number) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">-</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phase details */}
      <div className="space-y-2">
        {Object.entries(phases).map(([name, phase]: [string, any]) => (
          <PhaseSection key={name} name={name} phase={phase} />
        ))}
      </div>

      {/* Timestamp */}
      {validationReport.validation_timestamp && (
        <p className="text-xs text-gray-500 mt-4 text-right">
          Validated: {new Date(validationReport.validation_timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      )}

      {/* Remediation guidance — only shown when blocked */}
      {isBlocked && (
        <div className="mt-4 bg-gray-100 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">To proceed with analysis:</h4>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Fix the data issues identified above in your source dataset</li>
            <li>Re-upload the corrected dataset via Data Provenance</li>
            <li>Re-run analysis — validation will execute automatically</li>
          </ol>
          <p className="text-xs text-gray-500 mt-2 italic">
            Analysis is disabled until all validation phases pass. This gate cannot be bypassed.
          </p>
        </div>
      )}

      {/* Dismiss button — only available when validation PASSED */}
      {onDismiss && !isBlocked && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          >
            Acknowledged
          </button>
        </div>
      )}
    </div>
  )
}
