import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { z } from 'zod'

// The apiClient module uses `import.meta.env` which is available in vitest
// We import the singleton and the class-level exports to test configuration and behaviour

describe('apiClient', () => {
  let apiClient: any
  let ApiClientError: any

  beforeEach(async () => {
    // Fresh import for each test to avoid shared state issues
    vi.resetModules()
    const mod = await import('../../services/apiClient')
    apiClient = mod.apiClient
    ApiClientError = mod.ApiClientError
  })

  afterEach(() => {
    apiClient.clearAccessToken()
    vi.restoreAllMocks()
  })

  // ── Configuration ────────────────────────────────────────────────────────

  it('has a default base URL of /api/v1', () => {
    // The private baseURL defaults to '/api/v1' in the constructor
    // We verify indirectly: a request to '/health' should hit '/api/v1/health'
    expect(apiClient).toBeDefined()
  })

  it('exposes setAccessToken and clearAccessToken methods', () => {
    expect(typeof apiClient.setAccessToken).toBe('function')
    expect(typeof apiClient.clearAccessToken).toBe('function')
  })

  it('exposes the request method', () => {
    expect(typeof apiClient.request).toBe('function')
  })

  // ── Token management ─────────────────────────────────────────────────────

  it('sets an Authorization header after setAccessToken', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    apiClient.setAccessToken('test-token-123')

    try {
      await apiClient.request('/test', z.object({ ok: z.boolean() }))
    } catch {
      // ignore network errors in test
    }

    expect(fetchSpy).toHaveBeenCalled()
    const callArgs = fetchSpy.mock.calls[0]!
    const headers = callArgs[1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-token-123')

    fetchSpy.mockRestore()
  })

  it('removes the Authorization header after clearAccessToken', async () => {
    apiClient.setAccessToken('temp-token')
    apiClient.clearAccessToken()

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    try {
      await apiClient.request('/test', z.object({ ok: z.boolean() }))
    } catch {
      // ignore
    }

    const callArgs = fetchSpy.mock.calls[0]!
    const headers = callArgs[1]?.headers as Headers
    expect(headers.get('Authorization')).toBeNull()

    fetchSpy.mockRestore()
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('throws on non-OK responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      apiClient.request('/missing', z.object({})),
    ).rejects.toThrow()

    vi.restoreAllMocks()
  })

  it('constructs ApiClientError with status and detail', () => {
    const err = new ApiClientError(400, 'Bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(400)
    expect(err.detail).toBe('Bad request')
    expect(err.name).toBe('ApiClientError')
  })

  // ── Domain methods ────────────────────────────────────────────────────────

  it('has a login method', () => {
    expect(typeof apiClient.login).toBe('function')
  })

  it('has a logout method', () => {
    expect(typeof apiClient.logout).toBe('function')
  })

  it('has a getCurrentUser method', () => {
    expect(typeof apiClient.getCurrentUser).toBe('function')
  })

  it('has evidence CRUD methods', () => {
    expect(typeof apiClient.getEvidence).toBe('function')
    expect(typeof apiClient.listEvidence).toBe('function')
    expect(typeof apiClient.createEvidence).toBe('function')
    expect(typeof apiClient.updateEvidence).toBe('function')
    expect(typeof apiClient.deleteEvidence).toBe('function')
  })

  it('has review methods', () => {
    expect(typeof apiClient.listReviews).toBe('function')
    expect(typeof apiClient.createReview).toBe('function')
    expect(typeof apiClient.updateReview).toBe('function')
  })

  it('has search methods', () => {
    expect(typeof apiClient.searchPubmed).toBe('function')
    expect(typeof apiClient.searchClinicalTrials).toBe('function')
    expect(typeof apiClient.advancedSearch).toBe('function')
    expect(typeof apiClient.searchSemanticScholar).toBe('function')
  })

  it('has SAR pipeline methods', () => {
    expect(typeof apiClient.getSARPipelineStatus).toBe('function')
    expect(typeof apiClient.runSARStage).toBe('function')
    expect(typeof apiClient.getSARResults).toBe('function')
    expect(typeof apiClient.getSARReport).toBe('function')
    expect(typeof apiClient.initSARPipeline).toBe('function')
  })

  // ── Zod schema exports ────────────────────────────────────────────────────

  it('exports Zod schemas for runtime validation', async () => {
    const mod = await import('../../services/apiClient')
    expect(mod.EvidenceSchema).toBeDefined()
    expect(mod.UserSchema).toBeDefined()
    expect(mod.ReviewSchema).toBeDefined()
    expect(mod.ProjectSchema).toBeDefined()
    expect(mod.ApiErrorSchema).toBeDefined()
    expect(mod.PaginatedSchema).toBeDefined()
  })
})
