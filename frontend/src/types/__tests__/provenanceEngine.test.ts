import { describe, it, expect } from 'vitest'
import {
  resolveArtifactState,
  getArtifactExplanation,
  getStateBadgeClasses,
  ARTIFACT_TRANSITIONS,
  INVALIDATION_RULES,
  ARTIFACT_DEPENDENCY_GRAPH,
  type ArtifactState,
} from '../provenanceEngine'

// ─── resolveArtifactState ────────────────────────────────────────────────────

describe('resolveArtifactState', () => {
  const baseParams = {
    artifactId: 'sdtm_dm',
    category: 'sdtm_domain' as const,
    required: true,
    sourceDataRegistered: true,
    coverageSufficient: true,
    isMapped: false,
    isDerived: false,
    validationPassed: null as boolean | null,
    validationFailed: false,
    isStale: false,
    missingDeps: [] as string[],
  }

  it('returns not_required when artifact is not required', () => {
    expect(resolveArtifactState({ ...baseParams, required: false })).toBe('not_required')
  })

  it('returns awaiting_source_data when no source registered (SDTM)', () => {
    expect(resolveArtifactState({ ...baseParams, sourceDataRegistered: false })).toBe('awaiting_source_data')
  })

  it('returns source_data_insufficient when coverage is not sufficient (SDTM)', () => {
    expect(resolveArtifactState({ ...baseParams, coverageSufficient: false })).toBe('source_data_insufficient')
  })

  it('returns ready_for_mapping when source registered and coverage sufficient (SDTM)', () => {
    expect(resolveArtifactState(baseParams)).toBe('ready_for_mapping')
  })

  it('returns mapped when domain is mapped (SDTM)', () => {
    expect(resolveArtifactState({ ...baseParams, isMapped: true })).toBe('mapped')
  })

  it('returns mapping_invalid when mapped but validation failed (SDTM)', () => {
    expect(resolveArtifactState({
      ...baseParams,
      isMapped: true,
      validationFailed: true,
    })).toBe('mapping_invalid')
  })

  it('returns validated when validation passed (SDTM)', () => {
    expect(resolveArtifactState({
      ...baseParams,
      isMapped: true,
      validationPassed: true,
    })).toBe('validated')
  })

  it('returns stale when mapped and upstream changed (SDTM)', () => {
    expect(resolveArtifactState({
      ...baseParams,
      isMapped: true,
      isStale: true,
    })).toBe('stale')
  })

  // ADaM-specific states

  const adamBase = {
    ...baseParams,
    artifactId: 'adam_adsl',
    category: 'adam_dataset' as const,
    isMapped: true, // all SDTM deps mapped
  }

  it('returns blocked when ADaM has missing SDTM deps', () => {
    expect(resolveArtifactState({
      ...adamBase,
      isMapped: false,
      missingDeps: ['DM', 'EX'],
    })).toBe('blocked')
  })

  it('returns ready_for_derivation when all ADaM deps are met', () => {
    expect(resolveArtifactState(adamBase)).toBe('ready_for_derivation')
  })

  it('returns derived when ADaM dataset exists', () => {
    expect(resolveArtifactState({ ...adamBase, isDerived: true })).toBe('derived')
  })

  it('returns derivation_invalid when derived but validation failed (ADaM)', () => {
    expect(resolveArtifactState({
      ...adamBase,
      isDerived: true,
      validationFailed: true,
    })).toBe('derivation_invalid')
  })

  it('returns validated when ADaM validation passed', () => {
    expect(resolveArtifactState({
      ...adamBase,
      isDerived: true,
      validationPassed: true,
    })).toBe('validated')
  })

  it('returns stale when ADaM derived and upstream changed', () => {
    expect(resolveArtifactState({
      ...adamBase,
      isDerived: true,
      isStale: true,
    })).toBe('stale')
  })

  it('returns ready_for_derivation for ADaM with no missing deps', () => {
    // No missingDeps means no blockers — ADaM is ready for derivation
    expect(resolveArtifactState({
      ...adamBase,
      isMapped: false,
      missingDeps: [],
    })).toBe('ready_for_derivation')
    expect(resolveArtifactState({
      ...adamBase,
      isMapped: true,
      missingDeps: [],
    })).toBe('ready_for_derivation')
  })
})

// ─── getArtifactExplanation ──────────────────────────────────────────────────

describe('getArtifactExplanation', () => {
  const allStates: ArtifactState[] = [
    'not_required', 'required_unconfigured', 'awaiting_source_data',
    'source_data_insufficient', 'ready_for_mapping', 'mapped',
    'mapping_invalid', 'ready_for_derivation', 'derived',
    'derivation_invalid', 'validated', 'stale', 'blocked',
  ]

  it('returns an explanation for every defined state', () => {
    for (const state of allStates) {
      const explanation = getArtifactExplanation(state, { artifactName: 'TEST' })
      expect(explanation).toBeDefined()
      expect(explanation.statusLabel).toBeTruthy()
      expect(explanation.summary).toBeTruthy()
      expect(explanation.detail).toBeTruthy()
      expect(typeof explanation.ctaEnabled).toBe('boolean')
    }
  })

  it('includes artifact name in the summary', () => {
    const explanation = getArtifactExplanation('blocked', {
      artifactName: 'ADTTE',
      missingDeps: ['DM', 'EX'],
    })
    expect(explanation.summary).toContain('ADTTE')
  })

  it('includes missing deps in blocked detail', () => {
    const explanation = getArtifactExplanation('blocked', {
      artifactName: 'ADSL',
      missingDeps: ['DM', 'EX'],
    })
    expect(explanation.detail).toContain('DM')
    expect(explanation.detail).toContain('EX')
  })

  it('disables CTA for validated state', () => {
    const explanation = getArtifactExplanation('validated', { artifactName: 'DM' })
    expect(explanation.ctaEnabled).toBe(false)
    expect(explanation.ctaLabel).toBeNull()
  })

  it('disables CTA for not_required state', () => {
    const explanation = getArtifactExplanation('not_required', { artifactName: 'LB' })
    expect(explanation.ctaEnabled).toBe(false)
  })

  it('enables CTA for actionable states', () => {
    const actionableStates: ArtifactState[] = [
      'required_unconfigured', 'awaiting_source_data', 'source_data_insufficient',
      'ready_for_mapping', 'mapped', 'mapping_invalid', 'ready_for_derivation',
      'derived', 'derivation_invalid', 'stale', 'blocked',
    ]
    for (const state of actionableStates) {
      const explanation = getArtifactExplanation(state, { artifactName: 'X' })
      expect(explanation.ctaEnabled).toBe(true)
      expect(explanation.ctaLabel).toBeTruthy()
    }
  })

  it('includes stale source in stale explanation when provided', () => {
    const explanation = getArtifactExplanation('stale', {
      artifactName: 'ADTTE',
      staleSource: 'endpoint definition',
    })
    expect(explanation.summary).toContain('endpoint definition')
  })

  it('includes validation error count in invalid explanations', () => {
    const explanation = getArtifactExplanation('mapping_invalid', {
      artifactName: 'DM',
      validationErrors: 3,
    })
    expect(explanation.detail).toContain('3')
  })
})

// ─── getStateBadgeClasses ────────────────────────────────────────────────────

describe('getStateBadgeClasses', () => {
  it('returns Tailwind classes for every state', () => {
    const states: ArtifactState[] = [
      'not_required', 'required_unconfigured', 'awaiting_source_data',
      'source_data_insufficient', 'ready_for_mapping', 'mapped',
      'mapping_invalid', 'ready_for_derivation', 'derived',
      'derivation_invalid', 'validated', 'stale', 'blocked',
    ]
    for (const state of states) {
      const classes = getStateBadgeClasses(state)
      expect(classes).toBeTruthy()
      expect(classes).toContain('bg-')
      expect(classes).toContain('border-')
      expect(classes).toContain('text-')
    }
  })

  it('returns emerald classes for validated', () => {
    expect(getStateBadgeClasses('validated')).toContain('emerald')
  })

  it('returns red classes for blocked', () => {
    expect(getStateBadgeClasses('blocked')).toContain('red')
  })

  it('returns amber classes for stale', () => {
    expect(getStateBadgeClasses('stale')).toContain('amber')
  })
})

// ─── Static data integrity ───────────────────────────────────────────────────

describe('ARTIFACT_TRANSITIONS', () => {
  it('has at least 15 defined transitions', () => {
    expect(ARTIFACT_TRANSITIONS.length).toBeGreaterThanOrEqual(15)
  })

  it('every transition has from, to, trigger, and action', () => {
    for (const t of ARTIFACT_TRANSITIONS) {
      expect(t.from).toBeTruthy()
      expect(t.to).toBeTruthy()
      expect(t.trigger).toBeTruthy()
      expect(t.action).toBeTruthy()
    }
  })

  it('no transition has identical from and to states', () => {
    for (const t of ARTIFACT_TRANSITIONS) {
      expect(t.from).not.toBe(t.to)
    }
  })
})

describe('INVALIDATION_RULES', () => {
  it('has at least 5 defined rules', () => {
    expect(INVALIDATION_RULES.length).toBeGreaterThanOrEqual(5)
  })

  it('every rule has a valid severity', () => {
    for (const rule of INVALIDATION_RULES) {
      expect(['info', 'warning', 'critical']).toContain(rule.severity)
    }
  })

  it('every rule has at least one direct impact', () => {
    for (const rule of INVALIDATION_RULES) {
      expect(rule.directImpacts.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every rule has a description template', () => {
    for (const rule of INVALIDATION_RULES) {
      expect(rule.descriptionTemplate).toBeTruthy()
      expect(rule.descriptionTemplate.length).toBeGreaterThan(10)
    }
  })
})

describe('ARTIFACT_DEPENDENCY_GRAPH', () => {
  it('has at least 10 dependency edges', () => {
    expect(ARTIFACT_DEPENDENCY_GRAPH.length).toBeGreaterThanOrEqual(10)
  })

  it('every edge has from, to, type, and description', () => {
    for (const edge of ARTIFACT_DEPENDENCY_GRAPH) {
      expect(edge.from).toBeTruthy()
      expect(edge.to).toBeTruthy()
      expect(['requires', 'derives_from', 'validates_against']).toContain(edge.type)
      expect(edge.description).toBeTruthy()
      expect(typeof edge.hard).toBe('boolean')
    }
  })

  it('no self-referencing edges', () => {
    for (const edge of ARTIFACT_DEPENDENCY_GRAPH) {
      expect(edge.from).not.toBe(edge.to)
    }
  })

  it('includes source_data → SDTM edges', () => {
    const sourceToSdtm = ARTIFACT_DEPENDENCY_GRAPH.filter(e => e.from === 'source_data')
    expect(sourceToSdtm.length).toBeGreaterThanOrEqual(4)
  })

  it('includes SDTM → ADaM edges', () => {
    const sdtmToAdam = ARTIFACT_DEPENDENCY_GRAPH.filter(e => e.from.startsWith('sdtm_'))
    expect(sdtmToAdam.length).toBeGreaterThanOrEqual(4)
  })
})
