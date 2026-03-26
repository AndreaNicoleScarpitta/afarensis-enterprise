import React, { useState } from 'react'
import { apiClient } from '../services/apiClient'
import {
  Network, Globe, Share2, CheckCircle, Clock, AlertTriangle,
  Plus, Settings, Shield, Lock, Wifi, WifiOff, BarChart3,
  RefreshCw, ExternalLink, ArrowRight
} from 'lucide-react'

interface NetworkNode {
  id: string
  name: string
  organization: string
  type: 'academic' | 'regulatory' | 'industry' | 'hospital'
  status: 'active' | 'pending' | 'inactive'
  evidence_shared: number
  last_sync: string
  trust_level: 'verified' | 'provisional' | 'unverified'
  latency_ms: number
}

const MOCK_NODES: NetworkNode[] = [
  {
    id: '1', name: 'FDA Evidence Repository',
    organization: 'U.S. Food & Drug Administration',
    type: 'regulatory', status: 'active', evidence_shared: 1284,
    last_sync: '2026-03-19T08:30:00Z', trust_level: 'verified', latency_ms: 42,
  },
  {
    id: '2', name: 'EMA Clinical Network',
    organization: 'European Medicines Agency',
    type: 'regulatory', status: 'active', evidence_shared: 892,
    last_sync: '2026-03-19T07:45:00Z', trust_level: 'verified', latency_ms: 88,
  },
  {
    id: '3', name: 'Mayo Clinic Research Hub',
    organization: 'Mayo Clinic',
    type: 'hospital', status: 'active', evidence_shared: 347,
    last_sync: '2026-03-19T06:00:00Z', trust_level: 'verified', latency_ms: 65,
  },
  {
    id: '4', name: 'Biogen Evidence Exchange',
    organization: 'Biogen Inc.',
    type: 'industry', status: 'pending', evidence_shared: 0,
    last_sync: '—', trust_level: 'provisional', latency_ms: 0,
  },
  {
    id: '5', name: 'Stanford CTSA Network',
    organization: 'Stanford University',
    type: 'academic', status: 'active', evidence_shared: 512,
    last_sync: '2026-03-18T22:00:00Z', trust_level: 'verified', latency_ms: 110,
  },
  {
    id: '6', name: 'PMDA Japan Gateway',
    organization: 'Pharmaceuticals and Medical Devices Agency',
    type: 'regulatory', status: 'inactive', evidence_shared: 203,
    last_sync: '2026-03-10T12:00:00Z', trust_level: 'verified', latency_ms: 0,
  },
]

const typeColors: Record<string, string> = {
  regulatory: 'bg-red-100 text-red-700',
  academic: 'bg-blue-100 text-blue-700',
  industry: 'bg-purple-100 text-purple-700',
  hospital: 'bg-green-100 text-green-700',
}

const trustColors: Record<string, string> = {
  verified: 'text-green-600',
  provisional: 'text-yellow-600',
  unverified: 'text-red-600',
}

const FederatedNetwork: React.FC = () => {
  const [nodes] = useState<NetworkNode[]>(MOCK_NODES)
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  const activeNodes = nodes.filter(n => n.status === 'active')
  const totalEvidence = nodes.reduce((sum, n) => sum + n.evidence_shared, 0)
  const avgLatency = activeNodes.length
    ? Math.round(activeNodes.reduce((s, n) => s + n.latency_ms, 0) / activeNodes.length)
    : 0

  const handleSync = async (nodeId: string) => {
    setSyncing(nodeId)
    try {
      const token = (apiClient as any).accessToken || ''
      await fetch(`/api/v1/federated-network/nodes/${nodeId}/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
    } catch (err) {
      console.error('Failed to sync node:', err)
    } finally {
      setSyncing(null)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'active') return <Wifi className="w-4 h-4 text-green-500" />
    if (status === 'pending') return <Clock className="w-4 h-4 text-yellow-500" />
    return <WifiOff className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Federated Network</h1>
          <p className="text-gray-600 mt-1">
            Secure evidence-sharing with partner regulatory and research organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <Settings className="w-4 h-4 mr-1.5" /> Configure
          </button>
          <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-1.5" /> Add Node
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Nodes', value: activeNodes.length, icon: Network, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Evidence Shared', value: totalEvidence.toLocaleString(), icon: Share2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Wifi, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending', value: nodes.filter(n => n.status === 'pending').length, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-blue-900">Zero-Trust Federated Architecture</h4>
          <p className="text-sm text-blue-700 mt-0.5">
            All evidence exchange is encrypted end-to-end using TLS 1.3. Each node is authenticated via mutual TLS certificates.
            Data sovereignty is maintained — no raw patient data is transmitted, only de-identified statistical summaries.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Node list */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Network Nodes</h3>
              <span className="text-xs text-gray-500">{nodes.length} total</span>
            </div>
            <div className="divide-y">
              {nodes.map(node => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedNode?.id === node.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">{getStatusIcon(node.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{node.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[node.type]}`}>
                            {node.type}
                          </span>
                          {node.trust_level === 'verified' && (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" title="Verified node" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{node.organization}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                          {node.evidence_shared > 0 && (
                            <span><BarChart3 className="w-3 h-3 inline mr-1" />{node.evidence_shared.toLocaleString()} records</span>
                          )}
                          {node.latency_ms > 0 && (
                            <span className={node.latency_ms < 100 ? 'text-green-600' : 'text-yellow-600'}>
                              {node.latency_ms}ms latency
                            </span>
                          )}
                          {node.last_sync !== '—' && (
                            <span>Last sync: {new Date(node.last_sync).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {node.status === 'active' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSync(node.id) }}
                          disabled={syncing === node.id}
                          className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                          title="Sync now"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncing === node.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Node detail panel */}
        <div>
          {selectedNode ? (
            <div className="bg-white rounded-lg border shadow-sm p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedNode.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedNode.organization}</p>
                </div>
                {getStatusIcon(selectedNode.status)}
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Type', value: selectedNode.type },
                  { label: 'Status', value: selectedNode.status },
                  { label: 'Trust Level', value: selectedNode.trust_level, color: trustColors[selectedNode.trust_level] },
                  { label: 'Evidence Shared', value: selectedNode.evidence_shared.toLocaleString() },
                  { label: 'Latency', value: selectedNode.latency_ms > 0 ? `${selectedNode.latency_ms}ms` : 'N/A' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className={`font-medium capitalize ${row.color ?? 'text-gray-900'}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Data Sharing Permissions</h4>
                {['Evidence Records', 'Bias Assessments', 'Comparability Scores', 'Audit Trails'].map(perm => (
                  <div key={perm} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{perm}</span>
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Lock className="w-3 h-3" /> Read-only
                    </span>
                  </div>
                ))}
              </div>

              {selectedNode.status === 'active' && (
                <button
                  onClick={() => handleSync(selectedNode.id)}
                  disabled={syncing === selectedNode.id}
                  className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing === selectedNode.id ? 'animate-spin' : ''}`} />
                  {syncing === selectedNode.id ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
              {selectedNode.status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Awaiting mutual TLS certificate exchange
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
              <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Select a node to view details</p>
            </div>
          )}

          {/* Data sovereignty banner */}
          <div className="mt-4 bg-gray-50 rounded-lg border p-4">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-indigo-600" /> Data Sovereignty Guarantee
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Only de-identified aggregate data exchanged</li>
              <li>• GDPR & HIPAA compliant transfer protocols</li>
              <li>• Full audit trail of all cross-node operations</li>
              <li>• Revocable access with one-click node removal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FederatedNetwork
