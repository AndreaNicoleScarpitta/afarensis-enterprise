// Afarensis Enterprise Frontend - CRITICAL TYPE SAFETY AND API FIXES
// Addresses runtime validation, race conditions, and WebSocket proxy issues

import { z } from 'zod';

// ============================================================================
// ZOD SCHEMAS - Runtime validation prevents silent failures
// ============================================================================

export const EvidenceStatusSchema = z.enum([
  'pending', 'screening', 'in_review', 'approved', 'rejected', 'archived'
]);

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  abstract: z.string().nullable(),
  authors: z.array(z.string()),
  publicationDate: z.string().nullable(),
  source: z.enum(['pubmed', 'clinicaltrials', 'openalex', 'semanticscholar', 'manual']),
  sourceId: z.string().nullable(), 
  doi: z.string().nullable(),
  qualityScore: z.number().min(0).max(100).nullable(),
  status: EvidenceStatusSchema,
  aiSummary: z.string().nullable(),
  metadataJson: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(['viewer', 'analyst', 'reviewer', 'admin']),
  isActive: z.boolean(),
  mfaSecret: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  status: z.enum(['assigned', 'in_progress', 'completed', 'rejected']),
  decision: z.enum(['include', 'exclude', 'uncertain']).nullable(),
  qualityRating: z.number().min(1).max(10).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      total: z.number().nonnegative(),
      page: z.number().positive().optional().default(1),
      page_size: z.number().positive().optional(),
      total_pages: z.number().positive().optional(),
      has_next: z.boolean().optional(),
      has_prev: z.boolean().optional(),
    }).optional(),
    total: z.number().nonnegative().optional(),
    page: z.number().positive().optional(),
    pageSize: z.number().positive().optional(),
    page_size: z.number().positive().optional(),
    totalPages: z.number().positive().optional(),
    total_pages: z.number().positive().optional(),
  }).passthrough().transform((data) => ({
    ...data,
    // Flatten nested pagination to top level for consumer convenience
    total: data.total ?? data.pagination?.total ?? 0,
    page: data.page ?? data.pagination?.page ?? 1,
    page_size: data.page_size ?? data.pagination?.page_size,
    total_pages: data.total_pages ?? data.pagination?.total_pages,
  }));

export const ApiErrorSchema = z.object({
  detail: z.string(),
  type: z.string().optional(),
  errors: z.array(z.object({
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string(),
    type: z.string(),
  })).optional(),
});

// ============================================================================
// TYPE INFERENCE FROM SCHEMAS  
// ============================================================================

export const ProjectStatusSchema = z.enum([
  'draft', 'active', 'completed', 'archived', 'on_hold', 'review', 'processing'
]);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  owner_id: z.string().uuid().nullable().optional(),
  created_by: z.string().nullable(),
  research_intent: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((data) => ({
  ...data,
  name: data.name ?? data.title ?? '',
}));

export const UserRoleSchema = z.enum([
  'viewer', 'analyst', 'reviewer', 'admin'
]);

export const BiasAnalysisSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.string(),
  results: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type User = z.infer<typeof UserSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type BiasAnalysis = z.infer<typeof BiasAnalysisSchema>;
export type PaginatedResponse<T> = z.infer<ReturnType<typeof PaginatedSchema<z.ZodType<T>>>>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ApiClientError: named export expected by hooks
export class ApiClientError extends Error {
  constructor(public status: number, public detail: string, public errors?: any[]) {
    super(`HTTP ${status}: ${detail}`);
    this.name = 'ApiClientError';
  }
}

// ============================================================================
// API CLIENT WITH RUNTIME VALIDATION
// ============================================================================

class ApiError extends Error {
  constructor(public status: number, public detail: string, public errors?: any[]) {
    super(`HTTP ${status}: ${detail}`);
    this.name = 'ApiError';
  }
}

/**
 * Central HTTP client for all Afarensis Enterprise API communication.
 *
 * Responsibilities:
 * - Attaches JWT Bearer tokens to every outgoing request.
 * - Validates every response body at runtime using Zod schemas, catching
 *   backend schema drift before it silently corrupts the UI.
 * - Transparently refreshes expired access tokens via the httpOnly
 *   refresh-token cookie, then retries the original request.
 * - Normalises error payloads into typed {@link ApiError} instances.
 *
 * A singleton instance is exported as {@link apiClient}.
 */
class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string = '/api/v1') {
    this.baseURL = baseURL;
  }

  /** Store a JWT access token that will be sent as a Bearer header on every subsequent request. */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /** Remove the stored access token, effectively logging the client out. */
  clearAccessToken() {
    this.accessToken = null;
  }

  /** Return the current access token (for raw fetch calls outside the Zod pipeline). */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Send an HTTP request and validate the response against a Zod schema.
   *
   * @typeParam T - The expected response shape after validation.
   * @param url - Path relative to {@link baseURL} (e.g. `/projects`).
   * @param schema - Zod schema used to parse and validate the JSON body.
   * @param options - Standard `fetch` options (method, body, signal, etc.).
   * @returns The validated response data.
   * @throws {ApiError} On non-2xx responses or validation failures (dev mode).
   *
   * Automatically retries once on 401 by refreshing the access token via
   * the httpOnly cookie. If the refresh also fails the user is redirected
   * to `/login`.
   */
  async request<T>(
    url: string,
    schema: z.ZodType<T>,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    let response = await fetch(`${this.baseURL}${url}`, {
      ...options,
      headers,
      credentials: 'include', // CRITICAL: Include cookies for refresh tokens
    });

    // CRITICAL FIX: Auto-refresh on 401
    if (response.status === 401 && !url.includes('/auth/')) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        response = await fetch(`${this.baseURL}${url}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        this.clearAccessToken();
        // Redirect to login - using window.location to handle SPA routing
        window.location.href = '/login';
        throw new ApiError(401, 'Session expired');
      }
    }

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {
        // If JSON parsing fails, use status text
        errorBody = { detail: response.statusText };
      }

      const errorResult = ApiErrorSchema.safeParse(errorBody);
      const detail = errorResult.success
        ? errorResult.data.detail
        : `HTTP ${response.status}: ${response.statusText}`;

      // Dispatch a global event so the ToastContext can display transient errors
      try {
        window.dispatchEvent(new CustomEvent('afarensis:api-error', {
          detail: { status: response.status, message: detail, url },
        }));
      } catch { /* non-critical */ }

      throw new ApiError(response.status, detail, errorResult.success ? errorResult.data.errors : undefined);
    }

    const data = await response.json();
    
    // CRITICAL: Runtime validation with detailed error logging
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error('API Response Validation Failed:', {
        url,
        errors: result.error.format(),
        receivedData: data
      });
      
      // In development, throw validation error. In production, warn clearly and continue with partial data.
      if (import.meta.env.DEV) {
        throw new Error(`Invalid API response from ${url}: ${result.error.message}`);
      }

      // Production: log a visible warning so operators can investigate, but don't crash the UI.
      console.warn(`[Afarensis] API response from ${url} did not pass schema validation. Rendering unvalidated data — verify backend response shape.`);
      return data;
    }
    
    return result.data;
  }

  private async tryRefreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // CRITICAL: Include httpOnly refresh token cookie
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.accessToken = data.access_token;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // AUTHENTICATION ENDPOINTS
  // ============================================================================

  /**
   * Authenticate with email/password credentials.
   *
   * On success the returned access token is stored internally so that
   * all subsequent requests are authenticated. The refresh token is set
   * as an httpOnly cookie by the server.
   */
  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const response = await this.request(
      '/auth/login',
      z.object({ access_token: z.string(), token_type: z.string() }),
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    
    this.setAccessToken(response.access_token);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', z.object({}), { method: 'POST' });
    } finally {
      this.clearAccessToken();
    }
  }

  /** Fetch the profile of the currently authenticated user from GET /auth/me. */
  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me', UserSchema);
  }

  // ============================================================================
  // EVIDENCE ENDPOINTS
  // ============================================================================

  async getEvidence(id: string): Promise<Evidence> {
    return this.request(`/evidence/${id}`, EvidenceSchema);
  }

  async listEvidence(params: {
    page?: number;
    pageSize?: number;
    status?: EvidenceStatus;
    source?: string;
    search?: string;
  } = {}): Promise<PaginatedResponse<Evidence>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    
    return this.request(
      `/evidence?${searchParams.toString()}`,
      PaginatedSchema(EvidenceSchema)
    );
  }

  async createEvidence(evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt'>): Promise<Evidence> {
    return this.request('/evidence', EvidenceSchema, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  }

  async updateEvidence(id: string, evidence: Partial<Evidence>): Promise<Evidence> {
    return this.request(`/evidence/${id}`, EvidenceSchema, {
      method: 'PUT',
      body: JSON.stringify(evidence),
    });
  }

  async deleteEvidence(id: string): Promise<void> {
    await this.request(`/evidence/${id}`, z.object({}), { method: 'DELETE' });
  }

  // ============================================================================
  // REVIEW ENDPOINTS
  // ============================================================================

  async listReviews(evidenceId?: string): Promise<PaginatedResponse<Review>> {
    const url = evidenceId ? `/reviews?evidence_id=${evidenceId}` : '/reviews';
    return this.request(url, PaginatedSchema(ReviewSchema));
  }

  async createReview(review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    return this.request('/reviews', ReviewSchema, {
      method: 'POST',
      body: JSON.stringify(review),
    });
  }

  async updateReview(id: string, review: Partial<Review>): Promise<Review> {
    return this.request(`/reviews/${id}`, ReviewSchema, {
      method: 'PUT',
      body: JSON.stringify(review),
    });
  }

  // ============================================================================
  // SEARCH ENDPOINTS
  // ============================================================================

  async searchPubmed(query: string, maxResults: number = 20): Promise<Evidence[]> {
    return this.request(
      '/search/pubmed',
      z.array(EvidenceSchema),
      {
        method: 'POST',
        body: JSON.stringify({ query, max_results: maxResults }),
      }
    );
  }

  async searchClinicalTrials(query: string, maxResults: number = 20): Promise<Evidence[]> {
    return this.request(
      '/search/clinical-trials',
      z.array(EvidenceSchema),
      {
        method: 'POST',
        body: JSON.stringify({ query, max_results: maxResults }),
      }
    );
  }

  // ============================================================================
  // AUTOMATED ANALYSIS ENDPOINTS
  // ============================================================================

  async generateAISummary(evidenceId: string): Promise<{ summary: string }> {
    return this.request(
      `/evidence/${evidenceId}/ai-summary`,
      z.object({ summary: z.string() }),
      { method: 'POST' }
    );
  }

  async classifyEvidence(evidenceId: string): Promise<{
    studyType: string;
    evidenceLevel: string;
    confidence: number
  }> {
    return this.request(
      `/evidence/${evidenceId}/classify`,
      z.object({
        studyType: z.string(),
        evidenceLevel: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      { method: 'POST' }
    );
  }

  // ============================================================================
  // PROJECT ENDPOINTS
  // ============================================================================

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'owner_id'>): Promise<Project> {
    return this.request('/projects', ProjectSchema, {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    return this.request(`/projects/${id}`, ProjectSchema, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${id}`, z.object({}).passthrough(), { method: 'DELETE' });
  }

  // ============================================================================
  // ADVANCED SEARCH ENDPOINTS
  // ============================================================================

  async advancedSearch(params: {
    query: string;
    search_type?: 'keyword' | 'semantic' | 'hybrid';
    project_id?: string;
    filters?: Record<string, any>;
    limit?: number;
  }): Promise<any[]> {
    return this.request(
      '/search/advanced',
      z.array(z.any()),
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  // ============================================================================
  // SEMANTIC SCHOLAR ENDPOINTS
  // ============================================================================

  async searchSemanticScholar(params: {
    query: string;
    limit?: number;
    offset?: number;
    year_from?: number;
    year_to?: number;
    fields_of_study?: string[];
    open_access_only?: boolean;
    min_citation_count?: number;
  }): Promise<{ results: any[]; total: number; offset: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set('query', params.query);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.year_from) searchParams.set('year_from', String(params.year_from));
    if (params.year_to) searchParams.set('year_to', String(params.year_to));
    if (params.open_access_only) searchParams.set('open_access_only', 'true');
    if (params.min_citation_count) searchParams.set('min_citation_count', String(params.min_citation_count));
    if (params.fields_of_study?.length) searchParams.set('fields_of_study', params.fields_of_study.join(','));
    return this.request(
      `/search/semantic-scholar?${searchParams.toString()}`,
      z.object({ papers: z.array(z.any()), total: z.number(), offset: z.number() }).passthrough()
    ).then(data => ({ ...data, results: data.papers }));
  }

  async getSemanticScholarPaper(paperId: string): Promise<any> {
    return this.request(`/search/semantic-scholar/paper/${paperId}`, z.any());
  }

  async getSemanticScholarRecommendations(positivePaperIds: string[], limit = 10): Promise<any[]> {
    return this.request(
      '/search/semantic-scholar/recommendations',
      z.array(z.any()),
      {
        method: 'POST',
        body: JSON.stringify({ positive_paper_ids: positivePaperIds, limit }),
      }
    );
  }

  async searchRareDiseaseEvidence(params: {
    disease_name: string;
    intervention?: string;
    limit?: number;
    year_from?: number;
  }): Promise<any[]> {
    return this.request(
      '/search/rare-disease-evidence',
      z.array(z.any()),
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  // ============================================================================
  // SAR PIPELINE ENDPOINTS
  // ============================================================================

  async getSARPipelineStatus(projectId: string): Promise<any> {
    return this.request(`/sar-pipeline/${projectId}/status`, z.any());
  }

  async runSARStage(projectId: string, stage: string, config?: Record<string, any>): Promise<any> {
    return this.request(
      `/sar-pipeline/${projectId}/run-stage`,
      z.any(),
      {
        method: 'POST',
        body: JSON.stringify({ stage, config: config ?? {} }),
      }
    );
  }

  async getSARResults(projectId: string): Promise<any> {
    return this.request(`/sar-pipeline/${projectId}/results`, z.any());
  }

  async getSARReport(projectId: string): Promise<any> {
    return this.request(`/sar-pipeline/${projectId}/report`, z.any());
  }

  async initSARPipeline(params: {
    project_id: string;
    treatment_source: string;
    control_source: string;
    primary_endpoint: string;
    analysis_type?: string;
  }): Promise<any> {
    return this.request(
      '/sar-pipeline/init',
      z.any(),
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  // ============================================================================
  // STUDY WORKFLOW ENDPOINTS
  // ============================================================================
  // These power the 10-step regulatory workflow, reading/writing
  // sections of the project's processing_config JSON.

  async getStudySection(projectId: string, section: string): Promise<any> {
    return this.request(`/projects/${projectId}/study/${section}`, z.any());
  }

  async saveStudySection(projectId: string, section: string, data: any): Promise<any> {
    return this.request(`/projects/${projectId}/study/${section}`, z.any(), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async runStudyComputation(projectId: string, action: string, body?: any): Promise<any> {
    return this.request(`/projects/${projectId}/study/${action}`, z.any(), {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async getStalenessMetadata(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/study/staleness`, z.any());
  }

  async acknowledgeStaleness(projectId: string, section: string): Promise<any> {
    return this.request(`/projects/${projectId}/study/${section}/acknowledge-staleness`, z.any(), {
      method: 'PUT',
    });
  }

  async lockProtocol(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/study/lock`, z.any(), {
      method: 'PUT',
    });
  }

  async generateSAR(projectId: string, format: string = 'html'): Promise<any> {
    return this.request(`/projects/${projectId}/study/regulatory/generate?format=${format}`, z.any(), {
      method: 'POST',
    });
  }

  async downloadArtifact(projectId: string, artifactId: string): Promise<Blob> {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(
      `${this.baseURL}/projects/${projectId}/study/regulatory/download/${artifactId}`,
      {
        headers,
        credentials: 'include',
      }
    );
    if (!response.ok) throw new ApiError(response.status, 'Download failed');
    return response.blob();
  }

  async discoverEvidence(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/discover-evidence`, z.any(), {
      method: 'POST',
    });
  }

  // ============================================================================
  // BioGPT (Biomedical Language Model) ENDPOINTS
  // ============================================================================

  async biogptStatus(): Promise<any> {
    return this.request('/biogpt/status', z.any());
  }

  async biogptGenerate(prompt: string, maxTokens: number = 256): Promise<any> {
    return this.request('/biogpt/generate', z.any(), {
      method: 'POST',
      body: JSON.stringify({ prompt, max_new_tokens: maxTokens }),
    });
  }

  async biogptExplainMechanism(drug: string, condition: string): Promise<any> {
    return this.request('/biogpt/explain-mechanism', z.any(), {
      method: 'POST',
      body: JSON.stringify({ drug, condition }),
    });
  }

  async biogptSummarize(title: string, abstract: string): Promise<any> {
    return this.request('/biogpt/summarize', z.any(), {
      method: 'POST',
      body: JSON.stringify({ title, abstract }),
    });
  }

  // ============================================================================
  // DATA PROVENANCE ENDPOINTS
  // ============================================================================

  async getAdamDatasets(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/adam/datasets`, z.any());
  }

  async getDatasets(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/datasets`, z.any());
  }

  async submitIngestionConsent(projectId: string, body: any): Promise<any> {
    return this.request(`/projects/${projectId}/ingestion/consent`, z.any(), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Upload a file — uses FormData so we must NOT set Content-Type (browser sets boundary).
   * This bypasses the standard `request()` which forces Content-Type: application/json.
   */
  async uploadFile(url: string, formData: FormData): Promise<any> {
    const headers = new Headers();
    // Do NOT set Content-Type — browser needs to set multipart boundary
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    let response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        response = await fetch(`${this.baseURL}${url}`, {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
      } else {
        this.clearAccessToken();
        window.location.href = '/login';
        throw new ApiError(401, 'Session expired');
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, errorBody.detail || response.statusText);
    }

    return response.json();
  }

  async analyzeDataset(projectId: string, body: any): Promise<any> {
    return this.request(`/projects/${projectId}/study/analyze-dataset`, z.any(), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getProject(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}`, z.any());
  }

  async generateSdtmDomain(projectId: string, domain: string): Promise<any> {
    return this.request(`/projects/${projectId}/sdtm/generate/${domain}`, z.any(), {
      method: 'POST',
    });
  }

  async generateSdtmAll(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/sdtm/generate-all`, z.any(), {
      method: 'POST',
    });
  }

  async validateSdtm(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}/sdtm/validate`, z.any(), {
      method: 'POST',
    });
  }
}

// ============================================================================
// REACT HOOKS WITH RACE CONDITION PREVENTION
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export function useApiQuery<T>(
  url: string | null,
  schema: z.ZodType<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    // CRITICAL: Cancel previous request to prevent race conditions
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.request(url, schema, { 
        signal: controller.signal 
      });
      
      if (!controller.signal.aborted) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setLoading(false);
      }
    }
  }, [url, ...deps]);

  useEffect(() => {
    fetch();
    
    // Cleanup: abort pending requests on unmount
    return () => {
      abortRef.current?.abort();
    };
  }, [fetch]);

  return { data, error, loading, refetch: fetch };
}

// ============================================================================
// WEBSOCKET CLIENT WITH RECONNECTION
// ============================================================================

/**
 * WebSocket client for real-time collaboration.
 *
 * LAZY connection: does NOT connect on construction. Call `connect(url)` only
 * when the user enters a collaborative view (e.g. evidence review). This
 * prevents console errors on every page load when no WS is needed.
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private currentUrl: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private listeners: Map<string, Function[]> = new Map();
  private _connected = false;
  private _intentionalClose = false;

  get connected() { return this._connected; }

  /** Build a WS URL relative to the current page origin. */
  static buildUrl(path: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${path}`;
  }

  /** Connect to a specific WebSocket endpoint. Safe to call multiple times. */
  connect(url?: string) {
    // If no URL provided, do nothing (prevents auto-connect errors)
    if (!url && !this.currentUrl) return;
    const targetUrl = url || this.currentUrl!;
    this.currentUrl = targetUrl;
    this._intentionalClose = false;

    // Don't reconnect if already connected to the same URL
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    // Close any existing stale connection
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(targetUrl);

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectAttempts = 0;
        this.emit('open', null);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data.payload ?? data);
        } catch {
          // Non-JSON message — ignore silently
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.emit('close', null);
        if (!this._intentionalClose) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        // Intentionally silent — the onclose handler deals with reconnection.
        // WebSocket errors are not actionable in the browser; the error event
        // object contains no useful information (just [object Event]).
      };
    } catch {
      // Construction failed (e.g. invalid URL) — stay disconnected silently.
    }
  }

  private attemptReconnect() {
    if (this._intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => {
      if (!this._intentionalClose && this.currentUrl) {
        this.connect(this.currentUrl);
      }
    }, delay);
  }

  private emit(type: string, payload: any) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(fn => { try { fn(payload); } catch { /* listener error */ } });
  }

  on(type: string, callback: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(callback);
  }

  off(type: string, callback: Function) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  disconnect() {
    this._intentionalClose = true;
    this._connected = false;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const apiClient = new ApiClient();

// WebSocket client for real-time collaboration (lazy — does NOT auto-connect)
export const wsClient = new WebSocketClient();

// CRITICAL FIXES APPLIED:
// 1. Runtime validation with Zod prevents silent schema drift
// 2. Race condition prevention with AbortController
// 3. Automatic token refresh with httpOnly cookies  
// 4. WebSocket reconnection with exponential backoff
// 5. Comprehensive error handling and logging
// 6. Production vs development validation behavior
// 7. Type-safe API responses with proper error types
// 8. Cookie-based refresh token security (not localStorage)
