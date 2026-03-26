import React, { useState, useEffect, useCallback } from 'react'
import {
  Users, UserPlus, Search, Shield, ShieldCheck,
  Mail, Clock, CheckCircle, XCircle,
  RefreshCw, Loader2, AlertTriangle, Building2,
  Eye, BarChart3, Copy, Check, X
} from 'lucide-react'
import { apiClient } from '../services/apiClient'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgInfo {
  id: string
  name: string
  slug: string
  is_active: boolean
  users_count: number
  projects_count: number
}

interface OrgUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'reviewer' | 'analyst' | 'viewer'
  is_active: boolean
  department: string | null
  last_login: string | null
  created_at: string
}

type UserRole = 'admin' | 'reviewer' | 'analyst' | 'viewer'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-blue-500/20 text-blue-400',
  reviewer: 'bg-purple-500/20 text-purple-400',
  analyst: 'bg-emerald-500/20 text-emerald-400',
  viewer: 'bg-gray-500/20 text-gray-500 dark:text-gray-400',
}

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="w-3 h-3" />,
  reviewer: <ShieldCheck className="w-3 h-3" />,
  analyst: <BarChart3 className="w-3 h-3" />,
  viewer: <Eye className="w-3 h-3" />,
}

const ALL_ROLES: UserRole[] = ['admin', 'reviewer', 'analyst', 'viewer']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'Just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UserManagement: React.FC = () => {
  // Org info
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)

  // Users
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'viewer' as UserRole,
    department: '',
  })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // ---------- Data fetching ----------

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [info, usersList] = await Promise.all([
        apiClient.request('/org/info', z.any()),
        apiClient.request('/org/users', z.any()),
      ])
      setOrgInfo(info)
      setUsers(Array.isArray(usersList) ? usersList : [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------- Invite ----------

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name) return
    setInviteLoading(true)
    setInviteError(null)
    setTempPassword(null)
    try {
      const result: any = await apiClient.request('/org/users/invite', z.any(), {
        method: 'POST',
        body: JSON.stringify({
          email: inviteForm.email,
          full_name: inviteForm.full_name,
          role: inviteForm.role,
          ...(inviteForm.department ? { department: inviteForm.department } : {}),
        }),
      })
      setTempPassword(result.temp_password ?? result.password ?? result.tempPassword ?? null)
      setInviteForm({ email: '', full_name: '', role: 'viewer', department: '' })
      fetchData()
    } catch (err: any) {
      setInviteError(err?.detail ?? err?.message ?? 'Failed to invite user')
    } finally {
      setInviteLoading(false)
    }
  }

  // ---------- Role change ----------

  const changeRole = async (userId: string, newRole: UserRole) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }))
    try {
      await apiClient.request(`/org/users/${userId}/role`, z.any(), {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      })
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      )
    } catch (err: any) {
      console.error('Failed to change role', err)
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }))
    }
  }

  // ---------- Activate / Deactivate ----------

  const toggleActive = async (user: OrgUser) => {
    const action = user.is_active ? 'deactivate' : 'activate'
    setActionLoading(prev => ({ ...prev, [user.id]: true }))
    try {
      await apiClient.request(`/org/users/${user.id}/${action}`, z.any(), {
        method: 'PUT',
      })
      setUsers(prev =>
        prev.map(u =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u
        )
      )
    } catch (err: any) {
      console.error(`Failed to ${action} user`, err)
    } finally {
      setActionLoading(prev => ({ ...prev, [user.id]: false }))
    }
  }

  // ---------- Filtering ----------

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ---------- Loading / Error states ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading users...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 m-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 text-sm bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    )
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* ---- Org header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">
              {orgInfo?.name ?? 'Organization'}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {orgInfo?.users_count ?? users.length} members
            {orgInfo?.projects_count != null && ` \u00b7 ${orgInfo.projects_count} projects`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowInvite(true)
              setTempPassword(null)
              setInviteError(null)
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite User
          </button>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as any)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Roles</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>{capitalize(r)}</option>
          ))}
        </select>
      </div>

      {/* ---- User table ---- */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900/60 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {search || roleFilter !== 'all'
                      ? 'No users match your filters.'
                      : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
                    {/* Name + email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-indigo-400">
                            {(user.full_name ?? user.email ?? '?')
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-100 truncate">
                            {user.full_name || '\u2014'}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] ?? ROLE_BADGE.viewer}`}
                      >
                        {ROLE_ICON[user.role]}
                        {capitalize(user.role)}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="px-6 py-4 hidden md:table-cell text-sm text-gray-500 dark:text-gray-400">
                      {user.department || '\u2014'}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      {user.is_active ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-emerald-400">Active</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="text-red-400">Inactive</span>
                        </span>
                      )}
                    </td>

                    {/* Last login */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {relativeTime(user.last_login)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Role change dropdown */}
                        <select
                          value={user.role}
                          disabled={!!actionLoading[user.id]}
                          onChange={e => changeRole(user.id, e.target.value as UserRole)}
                          className="bg-gray-900 border border-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {ALL_ROLES.map(r => (
                            <option key={r} value={r}>{capitalize(r)}</option>
                          ))}
                        </select>

                        {/* Activate / Deactivate */}
                        <button
                          onClick={() => toggleActive(user)}
                          disabled={!!actionLoading[user.id]}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                            user.is_active
                              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          }`}
                          title={user.is_active ? 'Deactivate user' : 'Activate user'}
                        >
                          {actionLoading[user.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : user.is_active ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Invite Modal ---- */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Invite User
              </h2>
              <button
                onClick={() => {
                  setShowInvite(false)
                  setTempPassword(null)
                  setInviteError(null)
                }}
                className="text-gray-500 hover:text-gray-600 dark:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success state — show temp password */}
            {tempPassword ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <p className="text-emerald-400 text-sm font-medium mb-2">
                    User invited successfully!
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">
                    Share this temporary password with the user. They will be asked to change it on first login.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 font-mono select-all">
                      {tempPassword}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="p-2 rounded bg-gray-800 border border-gray-700 text-gray-500 dark:text-gray-400 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowInvite(false)
                    setTempPassword(null)
                  }}
                  className="w-full py-2 rounded-lg bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-700 text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Invite form */
              <div className="space-y-4">
                {inviteError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                    {inviteError}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@company.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={inviteForm.full_name}
                    onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as UserRole }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{capitalize(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Department</label>
                  <input
                    type="text"
                    value={inviteForm.department}
                    onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="e.g. Regulatory Affairs"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteForm.email || !inviteForm.full_name}
                  className="w-full inline-flex items-center justify-center py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Invite...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
