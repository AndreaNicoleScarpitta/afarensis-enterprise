import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Bell, Search, User, Shield, Activity, LogOut, Settings, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
// cn removed — unused

interface CurrentUser {
  id: string
  fullName?: string
  full_name?: string
  name?: string
  email: string
  role: string
  avatar?: string
}

interface HeaderProps {
  currentUser?: CurrentUser | null
  onMenuToggle: () => void
  onLogout?: () => void
  sidebarOpen: boolean
}

// Page label map
const pathLabel: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/enhanced-dashboard': 'Enhanced Dashboard',
  '/projects': 'Evidence Projects',
  '/evidence': 'Evidence Review',
  '/search': 'Advanced Search',
  '/analysis/comparability': 'Comparability Analysis',
  '/analysis/bias': 'Bias Analysis',
  '/artifacts': 'Regulatory Artifacts',
  '/network/federated': 'Federated Network',
  '/network/patterns': 'Evidence Patterns',
  '/admin/users': 'User Management',
  '/admin/audit': 'Audit Logs',
  '/admin/settings': 'System Settings',
}

const Header: React.FC<HeaderProps> = ({ currentUser, onMenuToggle, onLogout }) => {
  const location = useLocation()

  const displayName = currentUser?.fullName || currentUser?.full_name || currentUser?.name || 'User'
  const displayRole = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
    : 'Statistical Reviewer'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n?.[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Build breadcrumb segments from pathname
  const segments = location.pathname.split('/').filter(Boolean)
  const currentPageLabel = pathLabel[location.pathname] ?? (
    segments.length > 0
      ? (segments[segments.length - 1] ?? '').charAt(0).toUpperCase() + (segments[segments.length - 1] ?? '').slice(1)
      : 'Overview'
  )

  return (
    <header className="layout-header h-auto">
      {/* Main bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">

        {/* ── Left: hamburger + breadcrumb ── */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMenuToggle}
            className="lg:hidden text-gray-500"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm">
            <span className="text-gray-500 font-medium">Afarensis Enterprise</span>
            {segments.map((seg, i) => {
              const segPath = '/' + segments.slice(0, i + 1).join('/')
              const label = pathLabel[segPath] || (seg.charAt(0).toUpperCase() + seg.slice(1))
              const isLast = i === segments.length - 1
              return (
                <React.Fragment key={segPath}>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                  {isLast ? (
                    <span className="font-semibold text-gray-800">{label}</span>
                  ) : (
                    <Link to={segPath} className="text-gray-500 hover:text-gray-800 transition-colors">
                      {label}
                    </Link>
                  )}
                </React.Fragment>
              )
            })}
            {segments.length === 0 && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                <span className="font-semibold text-gray-800">Overview</span>
              </>
            )}
          </nav>

          {/* Mobile: current page label only */}
          <span className="md:hidden text-sm font-semibold text-gray-800">{currentPageLabel}</span>
        </div>

        {/* ── Center: Global Search ── */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              placeholder="Search projects, evidence, guidelines…"
              className="pl-9 bg-gray-50 border-gray-200 focus:bg-white h-9 text-sm"
            />
          </div>
        </div>

        {/* ── Right: status pills + actions + user menu ── */}
        <div className="flex items-center gap-2">

          {/* System status pill (lg+) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-success-50 border border-success-200 rounded-full">
            <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
            <span className="text-xs text-success-700 font-medium">Operational</span>
          </div>

          {/* Compliance badge (xl+) */}
          <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-200 rounded-full">
            <Shield className="h-3 w-3 text-primary-600" />
            <span className="text-xs text-primary-700 font-medium">21 CFR Pt 11</span>
          </div>

          {/* Activity button */}
          <Button variant="ghost" size="icon-sm" className="relative text-gray-500">
            <Activity className="h-4.5 w-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
              3
            </span>
          </Button>

          {/* Notification bell */}
          <Button variant="ghost" size="icon-sm" className="relative text-gray-500">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error-500 rounded-full border border-white" />
          </Button>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* ── User dropdown ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <Avatar className="h-7 w-7">
                  {currentUser?.avatar && <AvatarImage src={currentUser.avatar} alt={displayName} />}
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{displayName}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">{displayRole}</p>
                </div>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-2.5 py-0.5">
                  <Avatar className="h-8 w-8">
                    {currentUser?.avatar && <AvatarImage src={currentUser.avatar} />}
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link to="/admin/settings" className="cursor-pointer">
                  <User className="h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link to="/admin/settings" className="cursor-pointer">
                  <Settings className="h-4 w-4" />
                  System Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={onLogout}
                className="text-error-600 focus:bg-error-50 focus:text-error-700 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Secondary info bar (lg+) ── */}
      <div className="hidden lg:flex items-center justify-between border-t border-gray-100 bg-gray-50/70 px-6 py-2">
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span>Active Projects: <strong className="text-gray-700">—</strong></span>
          <span>Pending Reviews: <strong className="text-warning-600">—</strong></span>
          <span>Evidence Records: <strong className="text-gray-700">—</strong></span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span>Session: {displayRole}</span>
          <span>•</span>
          <span>21 CFR Part 11 Compliant</span>
          <span>•</span>
          <Badge variant="success" className="text-[10px] py-0 px-1.5">GxP Audit Trail Active</Badge>
        </div>
      </div>
    </header>
  )
}

export default Header
