import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Sidebar, { STUDIES } from '../../components/layout/Sidebar'

// Mock the ThemeContext so Sidebar can call useTheme()
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}))

// Mock the AfarensisLogo component to avoid rendering SVG/canvas complexity
vi.mock('@/components/ui/AfarensisLogo', () => ({
  default: () => <div data-testid="afarensis-logo" />,
}))

const defaultProps = {
  isOpen: true,
  onToggle: vi.fn(),
  currentUser: { fullName: 'Test User', email: 'test@afarensis.com', role: 'admin' },
  onLogout: vi.fn(),
  selectedStudy: STUDIES[0]!,
  onStudyChange: vi.fn(),
  protocolLocked: false,
  onLockProtocol: vi.fn(),
  reviewerMode: false,
  onToggleReviewer: vi.fn(),
}

function renderSidebar(overrides: Partial<typeof defaultProps> = {}) {
  return render(
    <BrowserRouter>
      <Sidebar {...defaultProps} {...overrides} />
    </BrowserRouter>,
  )
}

describe('Sidebar', () => {
  it('renders without crashing', () => {
    renderSidebar()
  })

  it('displays the Dashboard link', () => {
    renderSidebar()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('displays workflow step labels', () => {
    renderSidebar()

    const expectedLabels = [
      'Study Definition',
      'Causal Framework',
      'Data Provenance',
      'Cohort Construction',
      'Comparability & Balance',
      'Effect Estimation',
      'Bias & Sensitivity',
      'Reproducibility',
      'Audit Trail',
      'Regulatory Output',
    ]

    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the selected study protocol name', () => {
    renderSidebar()
    expect(screen.getByText('XY-301')).toBeInTheDocument()
  })

  it('shows the current user display name', () => {
    renderSidebar()
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('shows the Literature Search link', () => {
    renderSidebar()
    expect(screen.getByText('Literature Search')).toBeInTheDocument()
  })

  it('shows Analysis Lineage links', () => {
    renderSidebar()
    expect(screen.getByText('Input Explorer')).toBeInTheDocument()
    expect(screen.getByText('Variable Notebook')).toBeInTheDocument()
    expect(screen.getByText('Trace Pack')).toBeInTheDocument()
  })

  it('shows Lock Protocol button when protocol is unlocked', () => {
    renderSidebar({ protocolLocked: false })
    expect(screen.getByText('Lock Protocol')).toBeInTheDocument()
  })

  it('shows Protocol Locked indicator when locked', () => {
    renderSidebar({ protocolLocked: true })
    expect(screen.getByText('Protocol Locked')).toBeInTheDocument()
  })

  it('shows the FDA Reviewer mode toggle', () => {
    renderSidebar({ reviewerMode: false })
    expect(screen.getByText('View as FDA Reviewer')).toBeInTheDocument()
  })

  it('shows active state for FDA Reviewer mode when enabled', () => {
    renderSidebar({ reviewerMode: true })
    expect(screen.getByText('FDA Reviewer Mode: ON')).toBeInTheDocument()
  })

  it('renders the Afarensis brand text', () => {
    renderSidebar()
    expect(screen.getByText('Afarensis')).toBeInTheDocument()
  })

  it('renders the regulatory compliance footer text', () => {
    renderSidebar()
    expect(screen.getByText(/21 CFR Part 11/)).toBeInTheDocument()
  })
})
