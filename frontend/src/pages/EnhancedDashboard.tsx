/**
 * ProjectsDashboard — Main landing page after login.
 *
 * Shows a filterable grid of regulatory evidence review projects.
 * Users can create new projects, view existing ones, and archive
 * completed studies. Replaces the previous analytics-heavy dashboard
 * with a simple, project-centric workflow entry point.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  FolderOpen,
  Archive,
  ArchiveRestore,
  Trash2,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  X,
  BookOpen,
  FlaskConical,
  Globe,
  GraduationCap,
  Brain,
} from 'lucide-react'
import { apiClient } from '../services/apiClient'
import { z } from 'zod'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Project {
  id: string
  title: string
  description: string
  status: string
  research_intent?: string
  evidence_count?: number
  created_at: string
}

type StatusFilter = 'all' | 'draft' | 'in_review' | 'completed' | 'archived'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'in_review', label: 'In Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  review: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Helper function to determine source from source_id
const getSourceBadge = (sourceId: string, sourceType: string) => {
  if (sourceId?.startsWith('openalex_')) return { label: 'OpenAlex', color: 'bg-orange-100 text-orange-700' };
  if (sourceId?.startsWith('ss_')) return { label: 'Semantic Scholar', color: 'bg-purple-100 text-purple-700' };
  if (sourceType === 'CLINICALTRIALS' || sourceId?.startsWith('NCT')) return { label: 'ClinicalTrials.gov', color: 'bg-green-100 text-green-700' };
  if (sourceId?.startsWith('PMID') || sourceType === 'PUBMED') return { label: 'PubMed', color: 'bg-blue-100 text-blue-700' };
  return { label: sourceType || 'Unknown', color: 'bg-gray-100 text-gray-700' };
};

const EVIDENCE_SOURCES = [
  { label: 'PubMed', icon: BookOpen, color: 'text-blue-500' },
  { label: 'ClinicalTrials', icon: FlaskConical, color: 'text-green-500' },
  { label: 'OpenAlex', icon: Globe, color: 'text-orange-500' },
  { label: 'Semantic Scholar', icon: GraduationCap, color: 'text-purple-500' },
  { label: 'BioGPT', icon: Brain, color: 'text-pink-500' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EnhancedDashboard() {
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)

  /* ---------- Fetch projects ---------- */

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.request('/projects', z.object({ items: z.array(z.any()) }).passthrough())
      setProjects(data.items ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchProjects() }, [fetchProjects])

  /* ---------- Create project ---------- */

  const handleCreate = async (title: string, description: string, researchIntent: string) => {
    await apiClient.request('/projects', z.any(), {
      method: 'POST',
      body: JSON.stringify({ title, description, research_intent: researchIntent }),
    })
    setModalOpen(false)
    void fetchProjects()
  }

  /* ---------- Archive project ---------- */

  const handleArchive = async (id: string) => {
    await apiClient.request(`/projects/${id}`, z.any(), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    })
    void fetchProjects()
  }

  /* ---------- Unarchive project ---------- */

  const handleUnarchive = async (id: string) => {
    await apiClient.request(`/projects/${id}`, z.any(), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'unarchive' }),
    })
    void fetchProjects()
  }

  /* ---------- Delete project ---------- */

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await apiClient.request(`/projects/${id}`, z.any(), {
      method: 'DELETE',
    })
    setDeleteConfirmId(null)
    void fetchProjects()
  }

  /* ---------- Filtered list ---------- */

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  /* ---------- Render ---------- */

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void fetchProjects()} className="shrink-0 px-3 py-1.5 text-xs font-semibold border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              data-testid="skeleton-card"
              className="animate-pulse rounded-xl bg-white dark:bg-gray-800 p-6 shadow"
            >
              <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
              <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
              <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-700 mb-2" />
              <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20">
          <FolderOpen className="h-16 w-16 text-gray-600 dark:text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No projects yet</h2>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Create your first project
          </button>
        </div>
      )}

      {/* Project cards grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="rounded-xl bg-white dark:bg-gray-800 shadow hover:shadow-md transition p-6 flex flex-col"
            >
              {/* Title + badge */}
              <div className="flex items-start justify-between mb-2">
                <h3
                  className="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                  onClick={() => navigate(`/projects/${project.id}/study`)}
                >
                  {project.title}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[project.status] ?? STATUS_COLORS['draft']}`}>
                  {project.status.replace('_', ' ')}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-grow">
                {project.description}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {project.evidence_count ?? 0} evidence
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(project.created_at)}
                </span>
              </div>

              {/* Evidence source indicators */}
              <div className="flex items-center gap-1.5 mb-4">
                {EVIDENCE_SOURCES.map(src => (
                  <span key={src.label} className={`inline-flex items-center ${src.color}`} title={src.label}>
                    <src.icon className="h-3 w-3" />
                  </span>
                ))}
                <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{(project as any).source_count ?? 0} sources</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/projects/${project.id}/study`)}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                >
                  <FolderOpen className="h-4 w-4" /> Open
                </button>
                {project.status !== 'archived' ? (
                  <button
                    onClick={() => void handleArchive(project.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    <Archive className="h-4 w-4" /> Archive
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => void handleUnarchive(project.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                    >
                      <ArchiveRestore className="h-4 w-4" /> Unarchive
                    </button>
                    {deleteConfirmId === project.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => void handleDelete(project.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700 transition"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(project.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {modalOpen && (
        <CreateProjectModal
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create Project Modal                                               */
/* ------------------------------------------------------------------ */

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (title: string, description: string, researchIntent: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [researchIntent, setResearchIntent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onCreate(title, description, researchIntent)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Create project">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Project</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-700 dark:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="proj-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="proj-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. XY-301 Phase III RWE Study"
            />
          </div>

          <div>
            <label htmlFor="proj-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="proj-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Brief description of the study..."
            />
          </div>

          <div>
            <label htmlFor="proj-intent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Research Intent
            </label>
            <textarea
              id="proj-intent"
              rows={2}
              value={researchIntent}
              onChange={(e) => setResearchIntent(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="What question does this study aim to answer?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
