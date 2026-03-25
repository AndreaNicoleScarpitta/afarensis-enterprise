import React, { useState } from 'react'
import {
  Settings, Save, RefreshCw, Shield, Database, Bell, Globe,
  Key, Clock, AlertTriangle, CheckCircle, Loader2, ToggleLeft,
  ToggleRight, ChevronRight, Server, Lock, Eye, EyeOff
} from 'lucide-react'

interface SettingsSection {
  id: string
  label: string
  icon: React.ComponentType<any>
}

const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'ai', label: 'Models & Services', icon: Server },
  { id: 'compliance', label: 'Compliance & Audit', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data & Retention', icon: Database },
  { id: 'integrations', label: 'Integrations & APIs', icon: Globe },
  { id: 'security', label: 'Security', icon: Lock },
]

const SystemSettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('general')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const [settings, setSettings] = useState({
    // General
    platform_name: 'Afarensis Enterprise',
    base_url: 'https://app.afarensis.ai',
    timezone: 'UTC',
    session_timeout_minutes: 30,
    // AI
    ai_model_endpoint: 'https://api.anthropic.com/v1',
    default_model: 'claude-opus-4-6',
    openai_fallback_enabled: false,
    max_tokens_per_request: 4096,
    ai_temperature: 0.2,
    semantic_scholar_api_key: '',
    pubmed_api_key: '',
    // Compliance
    regulatory_compliance_level: 'fda_gxp',
    cfr_part11_mode: true,
    audit_all_reads: false,
    require_dual_reviewer: true,
    e_signature_required: true,
    // Notifications
    email_on_evidence_approval: true,
    email_on_review_assignment: true,
    email_on_report_ready: true,
    slack_webhook_url: '',
    // Data
    data_retention_days: 2555,
    auto_backup_enabled: true,
    backup_frequency: 'daily',
    max_evidence_file_size_mb: 50,
    // Integrations
    pubmed_enabled: true,
    clinicaltrials_enabled: true,
    semantic_scholar_enabled: true,
    openalex_enabled: false,
    ehr_integration_enabled: false,
    // Security
    mfa_required_for_admin: true,
    mfa_required_for_reviewer: false,
    ip_allowlist_enabled: false,
    ip_allowlist: '',
    password_min_length: 12,
    max_login_attempts: 5,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })
      if (response.ok) {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: any) => setSettings(s => ({ ...s, [key]: value }))

  const Toggle = ({ field }: { field: keyof typeof settings }) => (
    <button
      onClick={() => set(field, !settings[field])}
      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
        settings[field] ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
          settings[field] ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
        style={{ marginLeft: settings[field] ? '17px' : '2px' }}
      />
    </button>
  )

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure regulatory compliance, integrations, and system parameters</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden lg:sticky lg:top-8">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left border-b last:border-b-0 transition-colors ${
                  activeSection === section.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <section.icon className={`w-4 h-4 flex-shrink-0 ${activeSection === section.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                {section.label}
                <ChevronRight className={`w-3.5 h-3.5 ml-auto ${activeSection === section.id ? 'text-indigo-400' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border shadow-sm p-6 space-y-6">

            {/* ── GENERAL ── */}
            {activeSection === 'general' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">General Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { label: 'Platform Name', field: 'platform_name', type: 'text' },
                    { label: 'Base URL', field: 'base_url', type: 'url' },
                  ].map(f => (
                    <div key={f.field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                      <input
                        type={f.type}
                        value={(settings as any)[f.field]}
                        onChange={e => set(f.field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                    <select
                      value={settings.timezone}
                      onChange={e => set('timezone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="US/Eastern">US/Eastern</option>
                      <option value="US/Pacific">US/Pacific</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Berlin">Europe/Berlin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      min={5} max={480}
                      value={settings.session_timeout_minutes}
                      onChange={e => set('session_timeout_minutes', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── MODELS & SERVICES ── */}
            {activeSection === 'ai' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Model & Service Settings</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Model Service Endpoint</label>
                    <input type="url" value={settings.ai_model_endpoint} onChange={e => set('ai_model_endpoint', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Model</label>
                      <select value={settings.default_model} onChange={e => set('default_model', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="claude-opus-4-6">Claude Opus 4.6</option>
                        <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                        <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Tokens / Request</label>
                      <input type="number" min={512} max={100000} value={settings.max_tokens_per_request}
                        onChange={e => set('max_tokens_per_request', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Temperature <span className="text-gray-400">(0 = deterministic)</span>
                      </label>
                      <input type="number" min={0} max={1} step={0.05} value={settings.ai_temperature}
                        onChange={e => set('ai_temperature', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">OpenAI Fallback</div>
                      <div className="text-xs text-gray-500 mt-0.5">Use GPT-4o if Claude is unavailable</div>
                    </div>
                    <Toggle field="openai_fallback_enabled" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Semantic Scholar API Key <span className="text-gray-400">(optional — 10 req/s with key, 1/s without)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.semantic_scholar_api_key}
                        placeholder="ss-xxxxxxxx..."
                        onChange={e => set('semantic_scholar_api_key', e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">PubMed API Key <span className="text-gray-400">(optional)</span></label>
                    <input type="password" value={settings.pubmed_api_key} placeholder="xxxxxxxxxxxxxxxx"
                      onChange={e => set('pubmed_api_key', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </>
            )}

            {/* ── COMPLIANCE ── */}
            {activeSection === 'compliance' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Compliance & Audit Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Regulatory Compliance Level</label>
                    <select value={settings.regulatory_compliance_level} onChange={e => set('regulatory_compliance_level', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="fda_gxp">FDA GxP (21 CFR Part 11)</option>
                      <option value="ema_gcp">EMA GCP</option>
                      <option value="ich_e6">ICH E6(R3)</option>
                      <option value="iso_14155">ISO 14155</option>
                    </select>
                  </div>
                  {[
                    { field: 'cfr_part11_mode', label: '21 CFR Part 11 Mode', desc: 'Enforces electronic signature, audit trail, and access controls per FDA requirements' },
                    { field: 'audit_all_reads', label: 'Audit All Read Operations', desc: 'Log every data read in addition to writes and deletes (high volume)' },
                    { field: 'require_dual_reviewer', label: 'Dual Reviewer Required', desc: 'Evidence requires approval from two independent reviewers before submission' },
                    { field: 'e_signature_required', label: 'Electronic Signature Required', desc: 'All approval decisions require e-signature with credentials' },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                      <Toggle field={item.field as any} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeSection === 'notifications' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Notification Settings</h2>
                <div className="space-y-4">
                  {[
                    { field: 'email_on_evidence_approval', label: 'Email on Evidence Approval/Rejection', desc: 'Notify reviewer and project owner when evidence decision is submitted' },
                    { field: 'email_on_review_assignment', label: 'Email on Review Assignment', desc: 'Notify assigned reviewer when new evidence is assigned for review' },
                    { field: 'email_on_report_ready', label: 'Email When Report is Ready', desc: 'Notify project owner when a regulatory artifact is generated' },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                      <Toggle field={item.field as any} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Slack Webhook URL <span className="text-gray-400">(optional)</span></label>
                    <input type="url" value={settings.slack_webhook_url} placeholder="https://hooks.slack.com/services/..."
                      onChange={e => set('slack_webhook_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </>
            )}

            {/* ── DATA ── */}
            {activeSection === 'data' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Data & Retention</h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Data Retention (days)</label>
                      <input type="number" min={365} max={5000} value={settings.data_retention_days}
                        onChange={e => set('data_retention_days', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <p className="text-xs text-gray-400 mt-1">FDA requires 7 years (2555 days) for GCP records</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Evidence File Size (MB)</label>
                      <input type="number" min={1} max={500} value={settings.max_evidence_file_size_mb}
                        onChange={e => set('max_evidence_file_size_mb', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Automatic Backups</div>
                      <div className="text-xs text-gray-500 mt-0.5">Encrypted backups stored in geographically redundant locations</div>
                    </div>
                    <Toggle field="auto_backup_enabled" />
                  </div>
                  {settings.auto_backup_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Backup Frequency</label>
                      <select value={settings.backup_frequency} onChange={e => set('backup_frequency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── INTEGRATIONS ── */}
            {activeSection === 'integrations' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Integrations & APIs</h2>
                <div className="space-y-4">
                  {[
                    { field: 'pubmed_enabled', label: 'PubMed / NCBI', desc: 'Search biomedical literature via NCBI Entrez API' },
                    { field: 'clinicaltrials_enabled', label: 'ClinicalTrials.gov', desc: 'Access clinical trial registrations and results via CTAPI v2' },
                    { field: 'semantic_scholar_enabled', label: 'Semantic Scholar', desc: 'Semantic academic paper search with citation graph and structured references (free API)' },
                    { field: 'openalex_enabled', label: 'OpenAlex', desc: 'Open catalog of scholarly papers, authors, institutions (free)' },
                    { field: 'ehr_integration_enabled', label: 'EHR / FHIR Integration', desc: 'Connect to hospital EHR systems via FHIR R4 for real-world data extraction' },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                      <Toggle field={item.field as any} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── SECURITY ── */}
            {activeSection === 'security' && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Security Settings</h2>
                <div className="space-y-4">
                  {[
                    { field: 'mfa_required_for_admin', label: 'MFA Required for Admins', desc: 'All administrator accounts must enroll in multi-factor authentication' },
                    { field: 'mfa_required_for_reviewer', label: 'MFA Required for Reviewers', desc: 'Reviewer accounts must use MFA to submit review decisions' },
                    { field: 'ip_allowlist_enabled', label: 'IP Allowlist', desc: 'Restrict access to specific IP addresses or CIDR ranges' },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 pr-4">
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                      <Toggle field={item.field as any} />
                    </div>
                  ))}
                  {settings.ip_allowlist_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">IP Allowlist <span className="text-gray-400">(one per line)</span></label>
                      <textarea rows={4} value={settings.ip_allowlist} placeholder="10.0.0.0/8&#10;192.168.1.100"
                        onChange={e => set('ip_allowlist', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum Password Length</label>
                      <input type="number" min={8} max={64} value={settings.password_min_length}
                        onChange={e => set('password_min_length', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Login Attempts Before Lockout</label>
                      <input type="number" min={3} max={20} value={settings.max_login_attempts}
                        onChange={e => set('max_login_attempts', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemSettings
