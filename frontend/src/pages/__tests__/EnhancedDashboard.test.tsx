import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import EnhancedDashboard from '../EnhancedDashboard'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderDashboard() {
  return render(
    <BrowserRouter>
      <EnhancedDashboard />
    </BrowserRouter>,
  )
}

const mockProjects = [
  {
    id: '1',
    title: 'XY-301 Study',
    description: 'Test study',
    status: 'draft',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    title: 'CLARITY-AD',
    description: 'Another study',
    status: 'completed',
    created_at: '2024-02-01T00:00:00Z',
  },
]

/* ------------------------------------------------------------------ */
/*  Setup / Teardown                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockProjects),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('EnhancedDashboard', () => {
  it('renders "Projects" heading', async () => {
    renderDashboard()
    expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument()
  })

  it('renders "New Project" button', () => {
    renderDashboard()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })

  it('shows loading skeletons initially', () => {
    renderDashboard()
    const skeletons = screen.getAllByTestId('skeleton-card')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('displays project cards after fetch', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('XY-301 Study')).toBeInTheDocument()
      expect(screen.getByText('CLARITY-AD')).toBeInTheDocument()
    })
  })

  it('filter tabs are present (All, Draft, In Review, Completed, Archived)', () => {
    renderDashboard()
    expect(screen.getByRole('tab', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /draft/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /in review/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /completed/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /archived/i })).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument()
    })
  })

  it('opens create project modal on "New Project" click', async () => {
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /create project/i })).toBeInTheDocument()
    })
  })

  it('create form has title, description, and research intent fields', async () => {
    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/research intent/i)).toBeInTheDocument()
    })
  })
})
