/**
 * Provenance Engine Logger
 *
 * Structured logging for the artifact dependency engine — state transitions,
 * invalidation events, validation results, and coverage assessments.
 *
 * All log entries are written to the console in dev mode and dispatched as
 * custom events (`afarensis:provenance-log`) so the ToastContext or any
 * external logging service can subscribe.
 *
 * In production, only warn/error level entries are emitted.
 */

import type {
  ArtifactState,
  InvalidationEvent,
  InvalidationSeverity,
  ValidationResult,
} from '../types/provenanceEngine'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface ProvenanceLogEntry {
  /** ISO-8601 timestamp */
  timestamp: string
  /** Log severity level */
  level: LogLevel
  /** Subsystem that produced the entry */
  source: 'state_machine' | 'invalidation' | 'validation' | 'coverage' | 'derivation' | 'upload'
  /** Short message for console/toast */
  message: string
  /** Structured payload for machine consumption */
  data?: Record<string, unknown>
}

// ─── Internal buffer ─────────────────────────────────────────────────────────

const LOG_BUFFER_MAX = 500
const _buffer: ProvenanceLogEntry[] = []

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as any).env?.DEV === true

// ─── Core logger ─────────────────────────────────────────────────────────────

function emit(entry: ProvenanceLogEntry): void {
  // Buffer
  _buffer.push(entry)
  if (_buffer.length > LOG_BUFFER_MAX) _buffer.shift()

  // Console (dev: all, prod: warn+error only)
  if (isDev || entry.level === 'warn' || entry.level === 'error') {
    const prefix = `[provenance:${entry.source}]`
    switch (entry.level) {
      case 'debug': console.debug(prefix, entry.message, entry.data ?? ''); break
      case 'info':  console.info(prefix, entry.message, entry.data ?? '');  break
      case 'warn':  console.warn(prefix, entry.message, entry.data ?? '');  break
      case 'error': console.error(prefix, entry.message, entry.data ?? ''); break
    }
  }

  // Custom event for external subscribers (ToastContext, Sentry, etc.)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('afarensis:provenance-log', { detail: entry }))
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Log an artifact state transition. */
export function logStateTransition(
  artifactId: string,
  from: ArtifactState | null,
  to: ArtifactState,
  trigger: string,
): void {
  const level: LogLevel = to === 'blocked' || to === 'stale' ? 'warn'
    : to === 'mapping_invalid' || to === 'derivation_invalid' ? 'error'
    : 'info'

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'state_machine',
    message: `${artifactId}: ${from ?? '(init)'} → ${to} [${trigger}]`,
    data: { artifactId, from, to, trigger },
  })
}

/** Log an invalidation event. */
export function logInvalidation(event: InvalidationEvent): void {
  const level: LogLevel = severityToLevel(event.severity)

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'invalidation',
    message: `Invalidation: ${event.description}`,
    data: {
      eventId: event.id,
      sourceStep: event.sourceStep,
      changedField: event.changedField,
      affectedArtifacts: event.affectedArtifacts,
      transitiveArtifacts: event.transitiveArtifacts,
      severity: event.severity,
    },
  })
}

/** Log a validation result (pass or fail). */
export function logValidation(result: ValidationResult): void {
  const level: LogLevel = result.passed ? 'info' : 'error'

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'validation',
    message: result.passed
      ? `${result.artifactId}: validation passed (${result.conformanceScore}% conformance)`
      : `${result.artifactId}: validation FAILED — ${result.errorCount} error(s), ${result.warningCount} warning(s)`,
    data: {
      artifactId: result.artifactId,
      artifactType: result.artifactType,
      passed: result.passed,
      conformanceScore: result.conformanceScore,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      checkCount: result.checks.length,
    },
  })
}

/** Log a coverage assessment result. */
export function logCoverageAssessment(
  projectId: string,
  overallScore: number,
  sufficientForMapping: boolean,
  blockingReasons: string[],
): void {
  const level: LogLevel = !sufficientForMapping ? 'warn' : overallScore < 80 ? 'warn' : 'info'

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'coverage',
    message: sufficientForMapping
      ? `Coverage assessment: ${overallScore}% — sufficient for mapping`
      : `Coverage assessment: ${overallScore}% — INSUFFICIENT (${blockingReasons.length} blocking reason(s))`,
    data: { projectId, overallScore, sufficientForMapping, blockingReasons },
  })
}

/** Log a derivation action (start, success, failure). */
export function logDerivation(
  artifactId: string,
  action: 'started' | 'completed' | 'failed',
  detail?: string,
): void {
  const level: LogLevel = action === 'failed' ? 'error' : 'info'

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'derivation',
    message: `${artifactId}: derivation ${action}${detail ? ` — ${detail}` : ''}`,
    data: { artifactId, action, detail },
  })
}

/** Log a file upload event. */
export function logUpload(
  projectId: string,
  filename: string,
  action: 'started' | 'completed' | 'failed' | 'blocked',
  detail?: string,
): void {
  const level: LogLevel = action === 'failed' || action === 'blocked' ? 'error' : 'info'

  emit({
    timestamp: new Date().toISOString(),
    level,
    source: 'upload',
    message: `Upload ${action}: ${filename}${detail ? ` — ${detail}` : ''}`,
    data: { projectId, filename, action, detail },
  })
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function severityToLevel(severity: InvalidationSeverity): LogLevel {
  switch (severity) {
    case 'critical': return 'error'
    case 'warning':  return 'warn'
    case 'info':     return 'info'
  }
}

/** Return a readonly copy of the in-memory log buffer. */
export function getLogBuffer(): readonly ProvenanceLogEntry[] {
  return [..._buffer]
}

/** Clear the in-memory log buffer. */
export function clearLogBuffer(): void {
  _buffer.length = 0
}
