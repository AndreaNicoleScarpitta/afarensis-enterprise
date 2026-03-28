import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  logStateTransition,
  logInvalidation,
  logValidation,
  logCoverageAssessment,
  logDerivation,
  logUpload,
  getLogBuffer,
  clearLogBuffer,
} from '../provenanceLogger'
import type { InvalidationEvent, ValidationResult } from '../../types/provenanceEngine'

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearLogBuffer()
  vi.restoreAllMocks()
})

afterEach(() => {
  clearLogBuffer()
})

// ─── logStateTransition ──────────────────────────────────────────────────────

describe('logStateTransition', () => {
  it('logs a state transition to the buffer', () => {
    logStateTransition('sdtm_dm', 'ready_for_mapping', 'mapped', 'mapping_completed')

    const buffer = getLogBuffer()
    expect(buffer).toHaveLength(1)
    expect(buffer[0].source).toBe('state_machine')
    expect(buffer[0].message).toContain('sdtm_dm')
    expect(buffer[0].message).toContain('ready_for_mapping')
    expect(buffer[0].message).toContain('mapped')
    expect(buffer[0].data).toMatchObject({
      artifactId: 'sdtm_dm',
      from: 'ready_for_mapping',
      to: 'mapped',
      trigger: 'mapping_completed',
    })
  })

  it('uses warn level for blocked transitions', () => {
    logStateTransition('adam_adtte', 'required_unconfigured', 'blocked', 'deps_checked')

    const buffer = getLogBuffer()
    expect(buffer[0].level).toBe('warn')
  })

  it('uses warn level for stale transitions', () => {
    logStateTransition('sdtm_dm', 'validated', 'stale', 'upstream_changed')

    const buffer = getLogBuffer()
    expect(buffer[0].level).toBe('warn')
  })

  it('uses error level for invalid transitions', () => {
    logStateTransition('sdtm_ae', 'mapped', 'mapping_invalid', 'validation_failed')

    const buffer = getLogBuffer()
    expect(buffer[0].level).toBe('error')
  })

  it('uses error level for derivation_invalid', () => {
    logStateTransition('adam_adsl', 'derived', 'derivation_invalid', 'validation_failed')

    const buffer = getLogBuffer()
    expect(buffer[0].level).toBe('error')
  })

  it('uses info level for normal transitions', () => {
    logStateTransition('sdtm_dm', null, 'ready_for_mapping', 'source_registered')

    const buffer = getLogBuffer()
    expect(buffer[0].level).toBe('info')
  })

  it('handles null from-state gracefully', () => {
    logStateTransition('sdtm_dm', null, 'awaiting_source_data', 'study_configured')

    const buffer = getLogBuffer()
    expect(buffer[0].message).toContain('(init)')
  })

  it('dispatches a custom event on window', () => {
    const handler = vi.fn()
    window.addEventListener('afarensis:provenance-log', handler)

    logStateTransition('sdtm_dm', 'mapped', 'validated', 'validation_passed')

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0] as CustomEvent
    expect(event.detail.source).toBe('state_machine')

    window.removeEventListener('afarensis:provenance-log', handler)
  })
})

// ─── logInvalidation ─────────────────────────────────────────────────────────

describe('logInvalidation', () => {
  const baseEvent: InvalidationEvent = {
    id: 'inv-001',
    timestamp: '2026-03-27T10:00:00Z',
    source: 'Study Definition',
    sourceStep: 'study_definition',
    changedField: 'primary_endpoint',
    affectedArtifacts: ['adtte'],
    transitiveArtifacts: ['km_figure'],
    severity: 'critical',
    description: 'Primary endpoint changed. ADTTE must be re-derived.',
    acknowledged: false,
  }

  it('logs an invalidation event', () => {
    logInvalidation(baseEvent)

    const buffer = getLogBuffer()
    expect(buffer).toHaveLength(1)
    expect(buffer[0].source).toBe('invalidation')
    expect(buffer[0].message).toContain('Primary endpoint changed')
  })

  it('maps critical severity to error level', () => {
    logInvalidation(baseEvent)
    expect(getLogBuffer()[0].level).toBe('error')
  })

  it('maps warning severity to warn level', () => {
    logInvalidation({ ...baseEvent, severity: 'warning' })
    expect(getLogBuffer()[0].level).toBe('warn')
  })

  it('maps info severity to info level', () => {
    logInvalidation({ ...baseEvent, severity: 'info' })
    expect(getLogBuffer()[0].level).toBe('info')
  })

  it('includes affected artifacts in data payload', () => {
    logInvalidation(baseEvent)

    const data = getLogBuffer()[0].data!
    expect(data.affectedArtifacts).toEqual(['adtte'])
    expect(data.transitiveArtifacts).toEqual(['km_figure'])
  })
})

// ─── logValidation ───────────────────────────────────────────────────────────

describe('logValidation', () => {
  const passResult: ValidationResult = {
    artifactId: 'sdtm_dm',
    artifactType: 'sdtm_domain',
    passed: true,
    timestamp: '2026-03-27T10:00:00Z',
    checks: [{ checkId: 'SD0001', description: 'Check 1', severity: 'error', passed: true, detail: null, affectedRecords: null }],
    conformanceScore: 98,
    errorCount: 0,
    warningCount: 1,
  }

  const failResult: ValidationResult = {
    ...passResult,
    passed: false,
    conformanceScore: 72,
    errorCount: 3,
    warningCount: 5,
  }

  it('logs a passing validation at info level', () => {
    logValidation(passResult)

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('info')
    expect(entry.message).toContain('passed')
    expect(entry.message).toContain('98%')
  })

  it('logs a failing validation at error level', () => {
    logValidation(failResult)

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('error')
    expect(entry.message).toContain('FAILED')
    expect(entry.message).toContain('3 error(s)')
  })

  it('includes structured data', () => {
    logValidation(failResult)

    const data = getLogBuffer()[0].data!
    expect(data.artifactId).toBe('sdtm_dm')
    expect(data.conformanceScore).toBe(72)
    expect(data.errorCount).toBe(3)
  })
})

// ─── logCoverageAssessment ───────────────────────────────────────────────────

describe('logCoverageAssessment', () => {
  it('logs sufficient coverage at info level', () => {
    logCoverageAssessment('proj-1', 95, true, [])

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('info')
    expect(entry.message).toContain('95%')
    expect(entry.message).toContain('sufficient')
  })

  it('logs insufficient coverage at warn level', () => {
    logCoverageAssessment('proj-1', 60, false, ['Missing covariate variables'])

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('warn')
    expect(entry.message).toContain('INSUFFICIENT')
    expect(entry.message).toContain('1 blocking reason')
  })

  it('logs low-but-sufficient coverage at warn level', () => {
    logCoverageAssessment('proj-1', 75, true, [])

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('warn')
  })
})

// ─── logDerivation ───────────────────────────────────────────────────────────

describe('logDerivation', () => {
  it('logs derivation start at info level', () => {
    logDerivation('adam_adsl', 'started')

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('info')
    expect(entry.source).toBe('derivation')
    expect(entry.message).toContain('started')
  })

  it('logs derivation failure at error level', () => {
    logDerivation('adam_adtte', 'failed', 'Missing CNSR column')

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('error')
    expect(entry.message).toContain('failed')
    expect(entry.message).toContain('Missing CNSR column')
  })

  it('includes detail in data payload', () => {
    logDerivation('adam_adsl', 'completed', '1500 records')

    expect(getLogBuffer()[0].data!.detail).toBe('1500 records')
  })
})

// ─── logUpload ───────────────────────────────────────────────────────────────

describe('logUpload', () => {
  it('logs upload start at info level', () => {
    logUpload('proj-1', 'patients.csv', 'started')

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('info')
    expect(entry.source).toBe('upload')
    expect(entry.message).toContain('patients.csv')
  })

  it('logs upload blocked at error level', () => {
    logUpload('proj-1', 'patients.csv', 'blocked', 'PII detected')

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('error')
    expect(entry.message).toContain('blocked')
    expect(entry.message).toContain('PII detected')
  })

  it('logs upload failure at error level', () => {
    logUpload('proj-1', 'bad.xpt', 'failed', 'File too large')

    const entry = getLogBuffer()[0]
    expect(entry.level).toBe('error')
  })
})

// ─── Buffer management ───────────────────────────────────────────────────────

describe('log buffer', () => {
  it('accumulates entries in order', () => {
    logDerivation('a', 'started')
    logDerivation('b', 'started')
    logDerivation('c', 'started')

    const buffer = getLogBuffer()
    expect(buffer).toHaveLength(3)
    expect(buffer[0].data!.artifactId).toBe('a')
    expect(buffer[2].data!.artifactId).toBe('c')
  })

  it('clearLogBuffer empties the buffer', () => {
    logDerivation('x', 'started')
    expect(getLogBuffer()).toHaveLength(1)

    clearLogBuffer()
    expect(getLogBuffer()).toHaveLength(0)
  })

  it('getLogBuffer returns a copy (not a reference)', () => {
    logDerivation('x', 'started')
    const buf1 = getLogBuffer()
    logDerivation('y', 'started')
    const buf2 = getLogBuffer()

    expect(buf1).toHaveLength(1)
    expect(buf2).toHaveLength(2)
  })

  it('includes ISO timestamp on every entry', () => {
    logDerivation('z', 'completed')

    const ts = getLogBuffer()[0].timestamp
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
