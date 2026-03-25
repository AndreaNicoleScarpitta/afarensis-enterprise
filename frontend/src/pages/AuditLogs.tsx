import React, { useState } from 'react'
import {
  Activity, Search, Download, Eye, Calendar, User,
  Filter, RefreshCw, Loader2, AlertTriangle, CheckCircle,
  Shield, FileText, Users, Settings, Trash2, Edit
} from 'lucide-react'
import { useApiQuery } from '../services/hooks'
import { z } from 'zod'

const AuditLogSchema = z.object({
  logs: z.array(z.any()),
  total_count: z.number(),
})

const actionColors: Record<string, string> = {
  project_created: 'bg-green-100 text-green-700',
  project_updated: 'bg-blue-100 text-blue-700',
  evidence_approved: 'bg-green-100 text-green-700',
  evidence_rejected: 'bg-red-100 text-red-700',
  evidence_uploaded: 'bg-indigo-100 text-indigo-700',
  user_login: 'bg-gray-100 text-gray-700',
  user_logout: 'bg-gray-100 text-gray-700',
  report_generated: 'bg-purple-100 text-purple-700',
  review_submitted: 'bg-blue-100 text-blue-700',
  bias_analysis_run: 'bg-orange-100 text-orange-700',
}

const actionIcons: Record<string, React.ComponentType<any>> = {
  project_created: FileText,
  project_updated: Edit,
  evidence_approved: CheckCircle,
  evidence_rejected: Trash2,
  evidence_uploaded: FileText,
  user_login: User,
  user_logout: User,
  report_generated: FileText,
  review_submitted: Shield,
  bias_analysis_run: Activity,
}

// Fallback demo data shown when backend returns no logs
const DEMO_LOGS = [
  { id: '1', action: 'evidence_approved', user: 'Dr. Sarah Chen', user_email: 'sarah.chen@afarensis.com', timestamp: '2026-03-19T08:30:00Z', resource: 'CLARITY-AD Phase 3 Study', resource_type: 'evidence', ip_address: '10.0.1.42', details: 'Evidence item approved for regulatory submission with quality score 92', status: 'success' },
  { id: '2', action: 'report_generated', user: 'Dr. Michael Rodriguez', user_email: 'michael.r@afarensis.com', timestamp: '2026-03-19T07:15:00Z', resource: 'SAR Report Q1-2026', resource_type: 'artifact', ip_address: '10.0.1.55', details: 'Safety assessment report generated for FDA submission package', status: 'success' },
  { id: '3', action: 'bias_analysis_run', user: 'Lisa Zhang', user_email: 'l.zhang@afarensis.com', timestamp: '2026-03-18T16:45:00Z', resource: 'ALZHEIMER_001_Phase3', resource_type: 'project', ip_address: '10.0.1.33', details: 'Automated bias risk assessment completed — overall risk: LOW', status: 'success' },
  { id: '4', action: 'evidence_rejected', user: 'Dr. James Wilson', user_email: 'j.wilson@afarensis.com', timestamp: '2026-03-18T14:20:00Z', resource: 'Observational Registry Study 2019', resource_type: 'evidence', ip_address: '10.0.1.71', details: 'Evidence rejected: insufficient sample size and high attrition bias', status: 'success' },
  { id: '5', action: 'project_created', user: 'Admin User', user_email: 'admin@afarensis.com', timestamp: '2026-03-18T10:00:00Z', resource: 'GLP1_OUTCOMES_2026', resource_type: 'project', ip_address: '10.0.1.10', details: 'New regulatory project created for GLP-1 cardiovascular outcomes analysis', status: 'success' },
  { id: '6', action: 'user_login', user: 'Dr. Sarah Chen', user_email: 'sarah.chen@afarensis.com', timestamp: '2026-03-18T08:55:00Z', resource: 'Authentication', resource_type: 'auth', ip_address: '10.0.1.42', details: 'Successful authentication via MFA-protected login', status: 'success' },
  { id: '7', action: 'review_submitted', user: 'Dr. Michael Rodriguez', user_email: 'michael.r@afarensis.com', timestamp: '2026-03-17T15:30:00Z', resource: 'EMERGE Phase 3 Trial', resource_type: 'evidence', ip_address: '10.0.1.55', details: 'Review decision submitted: INCLUDE with confidence 87%, quality rating 8/10', status: 'success' },
  { id: '8', action: 'project_updated', user: 'Lisa Zhang', user_email: 'l.zhang@afarensis.com', timestamp: '2026-03-17T11:00:00Z', resource: 'ALZHEIMER_001_Phase3', resource_type: 'project', ip_address: '10.0.1.33', details: 'Project status updated from draft → active; regulatory path set to FDA_BLA_505b2', status: 'success' },
]

const AuditLogs: React.FC = () => {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState<any>(null)

  const { data, loading, error, refetch } = useApiQuery(
    '/audit/logs?limit=100',
    AuditLogSchema
  )

  const isUsingDemoData = !data?.logs?.length
  const rawLogs: any[] = data?.logs?.length ? data.logs : DEMO_LOGS
  const logs = rawLogs.filter(log => {
    const matchSearch =
      (log.user ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.action ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.resource ?? '').toLowerCase().includes(search.toLowerCase())
    const matchAction = actionFilter === 'all' || log.action === actionFilter
    return matchSearch && matchAction
  })

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Status'].join(','),
      ...logs.map(l => [
        l.timestamp, l.user, l.action, l.resource, l.ip_address, l.status ?? 'success'
      ].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getActionIcon = (action: string) => {
    const Icon = actionIcons[action] ?? Activity
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Immutable audit trail for regulatory compliance (21 CFR Part 11 / GxP)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-md text-gray-600 hover:bg-gray-100" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Compliance banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <p className="text-sm text-indigo-800">
          <strong>21 CFR Part 11 Ready.</strong> Audit trail is append-only and read-only.
          {!data?.logs?.length && <span className="text-amber-700 font-medium ml-1">Currently displaying sample data — connect backend audit service for production records.</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: data?.total_count ?? rawLogs.length, color: 'text-gray-900' },
          { label: 'Today', value: rawLogs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length, color: 'text-indigo-600' },
          { label: 'Approvals', value: rawLogs.filter(l => l.action === 'evidence_approved').length, color: 'text-green-600' },
          { label: 'Rejections', value: rawLogs.filter(l => l.action === 'evidence_rejected').length, color: 'text-red-600' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-lg border shadow-sm p-4 text-center ${isUsingDemoData ? 'bg-amber-50/50 border-amber-200' : 'bg-white'}`}>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}{isUsingDemoData ? ' *' : ''}</div>
          </div>
        ))}
      </div>
      {isUsingDemoData && (
        <p className="text-xs text-amber-600 -mt-2">* Statistics reflect sample data, not live system activity.</p>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user, action, or resource..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Actions</option>
            <option value="evidence_approved">Evidence Approved</option>
            <option value="evidence_rejected">Evidence Rejected</option>
            <option value="project_created">Project Created</option>
            <option value="report_generated">Report Generated</option>
            <option value="review_submitted">Review Submitted</option>
            <option value="bias_analysis_run">Bias Analysis</option>
            <option value="user_login">User Login</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-500">Loading audit logs...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Log table */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{logs.length} events</span>
                {isUsingDemoData && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> SAMPLE DATA — Not from live system
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Resource</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map(log => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedLog?.id === log.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{log.user}</div>
                          {log.user_email && <div className="text-xs text-gray-400">{log.user_email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                            {getActionIcon(log.action)}
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell max-w-xs truncate">
                          {log.resource}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1 rounded text-indigo-500 hover:bg-indigo-50">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail panel */}
          <div>
            {selectedLog ? (
              <div className="bg-white rounded-lg border shadow-sm p-5 space-y-4 sticky top-4">
                <h3 className="font-semibold text-gray-900">Event Details</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Event ID', value: selectedLog.id },
                    { label: 'Timestamp', value: new Date(selectedLog.timestamp).toLocaleString() },
                    { label: 'User', value: selectedLog.user },
                    { label: 'Email', value: selectedLog.user_email ?? '—' },
                    { label: 'Action', value: selectedLog.action.replace(/_/g, ' ') },
                    { label: 'Resource', value: selectedLog.resource },
                    { label: 'Resource Type', value: selectedLog.resource_type ?? '—' },
                    { label: 'IP Address', value: selectedLog.ip_address },
                    { label: 'Status', value: selectedLog.status ?? 'success' },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="text-xs text-gray-500 mb-0.5">{row.label}</div>
                      <div className="font-medium text-gray-900 capitalize break-all">{row.value}</div>
                    </div>
                  ))}
                  {selectedLog.details && (
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Details</div>
                      <div className="text-gray-700 text-sm leading-relaxed bg-gray-50 rounded p-3">{selectedLog.details}</div>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> {isUsingDemoData ? 'Sample record — not from production audit trail.' : 'Server-recorded audit entry.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
                <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Click a log entry to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogs
