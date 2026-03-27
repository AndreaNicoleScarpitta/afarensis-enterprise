/**
 * useStalenessCheck – Detects when upstream workflow steps have changed
 * since the current step was last saved or acknowledged.
 *
 * Uses the backend staleness endpoint which returns per-section metadata
 * (version, updated_at, content_hash) plus the dependency graph and
 * biostatistical impact descriptions.
 */
import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../services/apiClient'

export type StepKey =
  | 'definition' | 'covariates' | 'data_sources' | 'cohort'
  | 'balance' | 'effect_estimation' | 'bias' | 'reproducibility'
  | 'audit' | 'regulatory'

export interface StaleUpstream {
  step: StepKey
  label: string
  changedAt: string
  version: number
  impact: string
}

export interface StalenessResult {
  isStale: boolean
  staleUpstreams: StaleUpstream[]
  loading: boolean
  error: string | null
  acknowledge: () => Promise<void>
  refresh: () => Promise<void>
}

export function useStalenessCheck(projectId: string | undefined, currentStep: StepKey): StalenessResult {
  const [staleUpstreams, setStaleUpstreams] = useState<StaleUpstream[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStaleness = useCallback(async () => {
    if (!projectId) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const result = await apiClient.getStalenessMetadata(projectId)

      const sections = result.sections || {}
      const deps = result.dependency_graph || {}
      const labels = result.labels || {}
      const impacts = result.impact_descriptions || {}

      const myDeps: string[] = deps[currentStep] || []
      const myMeta = sections[currentStep] || {}
      const acknowledgedVersions = myMeta.acknowledged_upstream_versions || {}

      const stale: StaleUpstream[] = []

      for (const dep of myDeps) {
        const depMeta = sections[dep] || {}
        const depVersion = depMeta.version || 0

        if (depVersion === 0) continue // upstream never saved, nothing to be stale about

        // Stale if: upstream version is higher than what we last acknowledged
        // OR upstream updated_at is more recent than our own updated_at (and we haven't acknowledged)
        const acknowledgedVersion = acknowledgedVersions[dep] || 0
        const myUpdatedAt = myMeta.updated_at ? new Date(myMeta.updated_at).getTime() : 0
        const depUpdatedAt = depMeta.updated_at ? new Date(depMeta.updated_at).getTime() : 0

        const isStaleByVersion = depVersion > acknowledgedVersion
        const isStaleByTime = depUpdatedAt > myUpdatedAt
        const hasAcknowledged = myMeta.staleness_acknowledged_at &&
          new Date(myMeta.staleness_acknowledged_at).getTime() > depUpdatedAt

        if (isStaleByVersion && isStaleByTime && !hasAcknowledged) {
          const impactMap = impacts[dep] || {}
          stale.push({
            step: dep as StepKey,
            label: labels[dep] || dep,
            changedAt: depMeta.updated_at || '',
            version: depVersion,
            impact: impactMap[currentStep] || 'Upstream data has changed. Results may need recomputation.',
          })
        }
      }

      setStaleUpstreams(stale)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check staleness')
      setStaleUpstreams([])
    } finally {
      setLoading(false)
    }
  }, [projectId, currentStep])

  useEffect(() => {
    fetchStaleness()
  }, [fetchStaleness])

  const acknowledge = useCallback(async () => {
    if (!projectId) return
    try {
      await apiClient.acknowledgeStaleness(projectId, currentStep)
      setStaleUpstreams([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge')
    }
  }, [projectId, currentStep])

  return {
    isStale: staleUpstreams.length > 0,
    staleUpstreams,
    loading,
    error,
    acknowledge,
    refresh: fetchStaleness,
  }
}
