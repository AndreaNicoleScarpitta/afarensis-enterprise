import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  Activity,
  User,
  TrendingUp,
  Settings
} from 'lucide-react'

interface SecurityEvent {
  id: string
  timestamp: Date
  type: 'authentication' | 'authorization' | 'data_access' | 'suspicious_activity' | 'compliance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId: string
  userName: string
  action: string
  resource: string
  ipAddress: string
  location: string
  deviceInfo: string
  riskScore: number
  mitigationStatus: 'pending' | 'in_progress' | 'resolved' | 'false_positive'
  details: Record<string, any>
}

interface UserRiskProfile {
  userId: string
  userName: string
  currentRiskScore: number
  baselineRiskScore: number
  lastActivity: Date
  authenticatedDevices: number
  accessPatterns: {
    timePattern: 'normal' | 'unusual'
    locationPattern: 'normal' | 'unusual'
    dataAccessPattern: 'normal' | 'unusual'
  }
  complianceFlags: string[]
  activeThreats: number
}

interface ZeroTrustPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  strictness: 'low' | 'medium' | 'high' | 'maximum'
  triggerConditions: string[]
  actions: string[]
  lastTriggered?: Date
  successRate: number
}

interface ZeroTrustSecurityMonitorProps {
  className?: string
  onSecurityEvent?: (event: SecurityEvent) => void
  onPolicyUpdate?: (policy: ZeroTrustPolicy) => void
}

export const ZeroTrustSecurityMonitor: React.FC<ZeroTrustSecurityMonitorProps> = ({
  className = "",
  onSecurityEvent,
  onPolicyUpdate: _onPolicyUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'policies' | 'users'>('dashboard')
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [userProfiles, setUserProfiles] = useState<UserRiskProfile[]>([])
  const [policies, setPolicies] = useState<ZeroTrustPolicy[]>([])
  const [systemThreatLevel, setSystemThreatLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState<string>('all')

  // Mock data for demonstration
  useEffect(() => {
    const mockEvents: SecurityEvent[] = [
      {
        id: 'evt-001',
        timestamp: new Date(Date.now() - 5 * 60000),
        type: 'authentication',
        severity: 'high',
        userId: 'user-123',
        userName: 'Dr. Sarah Chen',
        action: 'Multiple failed login attempts',
        resource: '/api/v1/auth/login',
        ipAddress: '192.168.1.100',
        location: 'Unknown Location',
        deviceInfo: 'Unknown Device',
        riskScore: 8.5,
        mitigationStatus: 'pending',
        details: { attempts: 5, timeWindow: '2 minutes' }
      },
      {
        id: 'evt-002',
        timestamp: new Date(Date.now() - 15 * 60000),
        type: 'data_access',
        severity: 'medium',
        userId: 'user-456',
        userName: 'Dr. Michael Rodriguez',
        action: 'Bulk evidence download',
        resource: '/api/v1/evidence/bulk-download',
        ipAddress: '192.168.1.205',
        location: 'Boston, MA',
        deviceInfo: 'Chrome 120 - Windows 11',
        riskScore: 6.2,
        mitigationStatus: 'resolved',
        details: { recordCount: 50, sensitivityLevel: 'high' }
      },
      {
        id: 'evt-003',
        timestamp: new Date(Date.now() - 30 * 60000),
        type: 'compliance',
        severity: 'low',
        userId: 'user-789',
        userName: 'Dr. Lisa Park',
        action: 'Audit log access',
        resource: '/api/v1/audit/logs',
        ipAddress: '192.168.1.150',
        location: 'San Francisco, CA',
        deviceInfo: 'Safari 17 - macOS 14',
        riskScore: 2.1,
        mitigationStatus: 'resolved',
        details: { dateRange: '30 days', recordsViewed: 1250 }
      }
    ]

    const mockProfiles: UserRiskProfile[] = [
      {
        userId: 'user-123',
        userName: 'Dr. Sarah Chen',
        currentRiskScore: 8.5,
        baselineRiskScore: 2.3,
        lastActivity: new Date(Date.now() - 5 * 60000),
        authenticatedDevices: 3,
        accessPatterns: {
          timePattern: 'unusual',
          locationPattern: 'unusual',
          dataAccessPattern: 'normal'
        },
        complianceFlags: ['unusual_login_time', 'new_location'],
        activeThreats: 2
      },
      {
        userId: 'user-456',
        userName: 'Dr. Michael Rodriguez',
        currentRiskScore: 6.2,
        baselineRiskScore: 3.1,
        lastActivity: new Date(Date.now() - 15 * 60000),
        authenticatedDevices: 2,
        accessPatterns: {
          timePattern: 'normal',
          locationPattern: 'normal',
          dataAccessPattern: 'unusual'
        },
        complianceFlags: ['bulk_download_detected'],
        activeThreats: 1
      },
      {
        userId: 'user-789',
        userName: 'Dr. Lisa Park',
        currentRiskScore: 2.1,
        baselineRiskScore: 1.8,
        lastActivity: new Date(Date.now() - 30 * 60000),
        authenticatedDevices: 1,
        accessPatterns: {
          timePattern: 'normal',
          locationPattern: 'normal',
          dataAccessPattern: 'normal'
        },
        complianceFlags: [],
        activeThreats: 0
      }
    ]

    const mockPolicies: ZeroTrustPolicy[] = [
      {
        id: 'pol-001',
        name: 'Geographic Anomaly Detection',
        description: 'Detect and flag access attempts from unusual geographic locations',
        enabled: true,
        strictness: 'high',
        triggerConditions: ['unusual_location', 'vpn_detected', 'tor_exit_node'],
        actions: ['require_2fa', 'admin_notification', 'temporary_restriction'],
        lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
        successRate: 94.2
      },
      {
        id: 'pol-002',
        name: 'Bulk Data Access Monitoring',
        description: 'Monitor and control bulk access to sensitive regulatory data',
        enabled: true,
        strictness: 'medium',
        triggerConditions: ['bulk_download', 'rapid_sequential_access', 'off_hours_access'],
        actions: ['require_justification', 'manager_approval', 'audit_flag'],
        lastTriggered: new Date(Date.now() - 15 * 60000),
        successRate: 89.7
      },
      {
        id: 'pol-003',
        name: 'Device Trust Verification',
        description: 'Continuous device trust assessment and verification',
        enabled: true,
        strictness: 'high',
        triggerConditions: ['unmanaged_device', 'outdated_security', 'suspicious_software'],
        actions: ['device_quarantine', 'security_scan', 'compliance_check'],
        successRate: 97.1
      }
    ]

    setSecurityEvents(mockEvents)
    setUserProfiles(mockProfiles)
    setPolicies(mockPolicies)
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      // Simulate real-time updates
      setSystemThreatLevel(prev => {
        const levels: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical']
        const currentIndex = levels.indexOf(prev)
        const change = Math.random() - 0.5
        if (change > 0.3 && currentIndex < levels.length - 1) {
          return levels[currentIndex + 1]!
        } else if (change < -0.3 && currentIndex > 0) {
          return levels[currentIndex - 1]!
        }
        return prev
      })
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getThreatLevelColor = useCallback((level: string) => {
    switch (level) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-orange-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }, [])

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getRiskScoreColor = useCallback((score: number) => {
    if (score >= 8) return 'text-red-600'
    if (score >= 6) return 'text-orange-600'
    if (score >= 4) return 'text-yellow-600'
    return 'text-green-600'
  }, [])

  const filteredEvents = securityEvents.filter(event => 
    filterSeverity === 'all' || event.severity === filterSeverity
  )

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* System Threat Level */}
      <motion.div 
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">System Threat Level</h3>
          <Shield className={`w-6 h-6 ${getThreatLevelColor(systemThreatLevel)}`} />
        </div>
        <div className={`text-3xl font-bold ${getThreatLevelColor(systemThreatLevel)} capitalize`}>
          {systemThreatLevel}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Based on real-time risk assessment
        </p>
      </motion.div>

      {/* Active Events */}
      <motion.div 
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Events</h3>
          <AlertTriangle className="w-6 h-6 text-orange-600" />
        </div>
        <div className="text-3xl font-bold text-orange-600">
          {securityEvents.filter(e => e.mitigationStatus === 'pending' || e.mitigationStatus === 'in_progress').length}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Requiring attention
        </p>
      </motion.div>

      {/* High-Risk Users */}
      <motion.div 
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">High-Risk Users</h3>
          <User className="w-6 h-6 text-red-600" />
        </div>
        <div className="text-3xl font-bold text-red-600">
          {userProfiles.filter(u => u.currentRiskScore >= 6).length}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Above threshold (6.0)
        </p>
      </motion.div>

      {/* Policy Effectiveness */}
      <motion.div 
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Policy Effectiveness</h3>
          <TrendingUp className="w-6 h-6 text-green-600" />
        </div>
        <div className="text-3xl font-bold text-green-600">
          {Math.round(policies.reduce((acc, p) => acc + p.successRate, 0) / policies.length)}%
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Average success rate
        </p>
      </motion.div>

      {/* Recent Activity */}
      <motion.div 
        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm md:col-span-2"
        whileHover={{ scale: 1.01 }}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Security Events</h3>
        <div className="space-y-3">
          {securityEvents.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  event.severity === 'critical' ? 'bg-red-500' :
                  event.severity === 'high' ? 'bg-orange-500' :
                  event.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div>
                  <div className="font-medium text-gray-900">{event.action}</div>
                  <div className="text-sm text-gray-600">{event.userName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${getRiskScoreColor(event.riskScore)}`}>
                  Risk: {event.riskScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">
                  {event.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )

  const renderEvents = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <label className="text-sm font-medium text-gray-700">Filter by severity:</label>
        <select 
          value={filterSeverity} 
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <motion.tr 
                  key={event.id}
                  whileHover={{ backgroundColor: '#f9fafb' }}
                  className="cursor-pointer"
                  onClick={() => onSecurityEvent?.(event)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{event.action}</div>
                        <div className="text-sm text-gray-500">{event.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{event.userName}</div>
                    <div className="text-sm text-gray-500">{event.ipAddress}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${getRiskScoreColor(event.riskScore)}`}>
                      {event.riskScore.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      event.mitigationStatus === 'resolved' ? 'bg-green-100 text-green-800' :
                      event.mitigationStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      event.mitigationStatus === 'false_positive' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {event.mitigationStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.timestamp.toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <motion.div 
      className={`bg-gray-50 rounded-xl border border-gray-200 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="bg-white rounded-t-xl border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Zero Trust Security Monitor</h2>
              <p className="text-sm text-gray-600">Real-time security monitoring and threat assessment</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-1" />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-8">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: Activity },
            { key: 'events', label: 'Events', icon: AlertTriangle },
            { key: 'policies', label: 'Policies', icon: Settings },
            { key: 'users', label: 'User Risk', icon: User }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'events' && renderEvents()}
            {activeTab === 'policies' && (
              <div className="text-center py-12">
                <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Policy Management</h3>
                <p className="text-gray-600">Security policy configuration coming soon</p>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">User Risk Profiles</h3>
                <p className="text-gray-600">Detailed user risk analysis coming soon</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default ZeroTrustSecurityMonitor
