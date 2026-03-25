import { http, HttpResponse } from 'msw'

const API_BASE = '/api/v1'

export const handlers = [
  // Health
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { status: 'connected' },
      dependencies: {},
      version: '2.0.0',
    })
  }),

  // Auth
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as any
    if (body.email === 'admin@afarensis.com') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: {
          id: 'user-1',
          email: 'admin@afarensis.com',
          full_name: 'Admin User',
          role: 'admin',
        },
      })
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'admin@afarensis.com',
      fullName: 'Admin User',
      role: 'admin',
      isActive: true,
    })
  }),

  // Projects
  http.get(`${API_BASE}/projects`, () => {
    return HttpResponse.json([
      {
        id: 'proj-1',
        title: 'Test Project',
        description: 'A test project',
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  http.post(`${API_BASE}/projects`, () => {
    return HttpResponse.json({
      id: 'proj-new',
      title: 'New Project',
      status: 'draft',
    })
  }),

  // Analytics
  http.get(`${API_BASE}/analytics/dashboard`, () => {
    return HttpResponse.json({
      total_projects: 5,
      total_evidence: 100,
      total_reviews: 25,
    })
  }),

  // Statistics
  http.get(`${API_BASE}/statistics/summary`, () => {
    return HttpResponse.json({
      cox_ph: { hazard_ratio: 0.72, p_value: 0.001 },
      kaplan_meier: { median_survival: 24.5 },
    })
  }),
]
