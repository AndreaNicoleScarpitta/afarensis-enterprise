import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Shield,
  Users,
  Settings,
  Brain,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Lock,
  CheckCircle2,
  Check,
  Circle,
  Mail,
} from 'lucide-react'

// Auth & API
import { useAuth } from './services/hooks'
import { apiClient } from './services/apiClient'
import { z } from 'zod'

// shadcn UI
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Theme & Context
import { ThemeProvider } from './context/ThemeContext'
import { LiteratureProvider } from './context/LiteratureContext'
import { LineageProvider } from './context/LineageContext'
import { ToastProvider } from './context/ToastContext'

// Layout
import AfarensisLogo from '@/components/ui/AfarensisLogo'
import Sidebar, { STUDIES, Study } from './components/layout/Sidebar'

// Workflow pages — 10 steps
import StudyDefinition from './pages/StudyDefinition'
import CausalFramework from './pages/CausalFramework'
import DataProvenance from './pages/DataProvenance'
import CohortConstruction from './pages/CohortConstruction'
import ComparabilityBalance from './pages/ComparabilityBalance'
import EffectEstimation from './pages/EffectEstimation'
import BiasSensitivity from './pages/BiasSensitivity'
import Reproducibility from './pages/Reproducibility'
import AuditTrail from './pages/AuditTrail'
import RegulatoryOutput from './pages/RegulatoryOutput'
import LiteratureSearch from './pages/LiteratureSearch'

// DAG Workflow
import StudyDAG from './pages/StudyDAG'

// Analysis Lineage pages
import InputExplorer from './pages/InputExplorer'
import VariableNotebook from './pages/VariableNotebook'
import TracePackExport from './pages/TracePackExport'

// Legal & Policy pages
import TermsOfUse from './pages/TermsOfUse'
import PrivacyPolicy from './pages/PrivacyPolicy'
import AIUsePolicy from './pages/AIUsePolicy'

// Dashboard
import EnhancedDashboard from './pages/EnhancedDashboard'

// Admin pages (retained)
import UserManagement from './pages/UserManagement'
import SystemSettings from './pages/SystemSettings'
import AuditLogs from './pages/AuditLogs'

// Error Boundary — resets when children change (route navigation)
// Catches unhandled React render errors so a single bad component doesn't
// crash the entire SPA.  Fires a global event so the ToastContext can
// also display a transient notification.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string },
  { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo; errorCount: number }
> {
  constructor(props: { children: React.ReactNode; resetKey?: string }) {
    super(props)
    this.state = { hasError: false, errorCount: 0 }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  static getDerivedStateFromProps(
    props: { resetKey?: string },
    state: { hasError: boolean; prevKey?: string; errorCount: number },
  ) {
    // Reset error state when the route changes
    if (props.resetKey !== state.prevKey) {
      return { hasError: false, error: undefined, errorInfo: undefined, prevKey: props.resetKey, errorCount: 0 }
    }
    return { prevKey: props.resetKey }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info)
    this.setState(prev => ({ errorInfo: info, errorCount: prev.errorCount + 1 }))
    // Notify the toast system so users see a transient alert even if they
    // navigate away before seeing this error page
    try {
      window.dispatchEvent(new CustomEvent('afarensis:api-error', {
        detail: { status: 0, message: `Component error: ${error.message}`, url: window.location.pathname },
      }))
    } catch { /* ignore */ }
  }
  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex items-center justify-center p-6">
          <div className="max-w-lg w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
              <p className="text-gray-600 dark:text-gray-400">
                This page encountered an unexpected error. Your data is safe.
              </p>
            </div>

            {/* Error details (collapsible) */}
            <details className="mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Error details (for support)
              </summary>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-red-500 font-mono break-all">{error?.message}</p>
                {error?.stack && (
                  <pre className="text-[10px] text-gray-500 dark:text-gray-400 font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                    {error.stack.split('\n').slice(0, 8).join('\n')}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <pre className="text-[10px] text-gray-500 dark:text-gray-400 font-mono overflow-auto max-h-24 whitespace-pre-wrap">
                    {errorInfo.componentStack.split('\n').slice(0, 6).join('\n')}
                  </pre>
                )}
              </div>
            </details>

            <div className="flex gap-3 justify-center">
              {errorCount < 3 && (
                <button className="bg-[#2563EB] text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}>
                  Try Again
                </button>
              )}
              <button className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </button>
              <button className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                onClick={() => window.location.reload()}>
                Reload Page
              </button>
            </div>

            {errorCount >= 3 && (
              <p className="text-center text-xs text-amber-600 dark:text-amber-400 mt-4">
                This error has occurred multiple times. Try reloading the page or navigating to a different section.
              </p>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Email Verification Page (standalone, pre-auth) ─────────────────────────
const VerifyEmailPage = ({ token, email }: { token: string | null; email: string | null }) => {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token || !email) {
      setStatus('error')
      setErrorMsg('Invalid verification link. Please request a new one.')
      return
    }
    fetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then(async r => {
        if (r.ok) { setStatus('success') }
        else {
          const d = await r.json().catch(() => ({}))
          setErrorMsg(d.detail || 'Verification failed. The link may have expired.')
          setStatus('error')
        }
      })
      .catch(() => { setErrorMsg('Network error.'); setStatus('error') })
  }, [token, email])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#2563EB] mx-auto" />
            <p className="text-gray-600">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Email verified</h2>
            <p className="text-sm text-gray-600">Your account is active. You can now sign in.</p>
            <Button onClick={() => { window.location.href = '/' }}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              Go to sign in
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Verification failed</h2>
            <p className="text-sm text-red-600">{errorMsg}</p>
            <Button onClick={() => { window.location.href = '/' }}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Login Page with Forgot Password Flow ────────────────────────────────────
type AuthView = 'login' | 'forgot' | 'code' | 'reset' | 'success' | 'register' | 'verify-pending' | 'verified'

const LoginPage = ({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) => {
  const [view, setView] = useState<AuthView>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resetToken, setResetToken] = useState('')

  // Registration state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regOrg, setRegOrg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      if (rememberMe) localStorage.setItem('afarensis-remember', email)
      await onLogin(email, password)
    } catch (err) {
      setError('Incorrect email or password. Please check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Request failed')
      setResetToken(data.reset_token || '')
      setView('code')
    } catch (err) {
      // Always show success message to prevent email enumeration
      setView('code')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/v1/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetCode }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Invalid code')
      setResetToken(data.reset_token || resetToken)
      setView('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(newPassword)) { setError('Password must contain an uppercase letter.'); return }
    if (!/[a-z]/.test(newPassword)) { setError('Password must contain a lowercase letter.'); return }
    if (!/[0-9]/.test(newPassword)) { setError('Password must contain a number.'); return }
    if (!/[^A-Za-z0-9]/.test(newPassword)) { setError('Password must contain a special character.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const resp = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, reset_token: resetToken, new_password: newPassword }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.detail || 'Reset failed')
      setView('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setView('login')
    setError(null)
    setResetEmail('')
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    setResetToken('')
  }

  const trustBullets = [
    'Immutable audit history',
    'Versioned evidence packages',
    'Reviewer attribution and change tracking',
    'CFR Part 11 aligned workflow controls',
  ]

  // Password strength indicator
  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '', width: '0%' }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: '33%' }
    if (score <= 4) return { label: 'Fair', color: 'bg-orange-500', width: '66%' }
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' }
  }

  // ── Render right panel content based on view ──
  const renderForm = () => {
    // ── Success view ──
    if (view === 'success') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Password reset successful</h2>
            <p className="text-sm text-gray-600">Your password has been updated. You can now sign in with your new credentials.</p>
          </div>
          <Button onClick={handleBackToLogin} className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
            Back to sign in
          </Button>
        </div>
      )
    }

    // ── Reset password view ──
    if (view === 'reset') {
      const strength = getPasswordStrength(newPassword)
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Create new password</h2>
            <p className="text-sm text-gray-600">Choose a strong password that meets the requirements below.</p>
          </div>
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">New password</Label>
              <Input id="new-password" type="password" required placeholder="••••••••" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
              {newPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} rounded-full transition-all duration-300`} style={{ width: strength.width }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-12">{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {newPassword.length >= 8 ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} 8+ characters
                    </span>
                    <span className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {/[A-Z]/.test(newPassword) ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} Uppercase letter
                    </span>
                    <span className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {/[a-z]/.test(newPassword) ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} Lowercase letter
                    </span>
                    <span className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {/[0-9]/.test(newPassword) ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} Number
                    </span>
                    <span className={`flex items-center gap-1 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {/[^A-Za-z0-9]/.test(newPassword) ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />} Special character
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm password</Label>
              <Input id="confirm-password" type="password" required placeholder="••••••••" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-emerald-600">Passwords match</p>
              )}
            </div>
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}
            <Button type="submit" disabled={loading || newPassword !== confirmPassword}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Resetting...</> : 'Reset password'}
            </Button>
          </form>
          <button onClick={handleBackToLogin} className="text-sm text-[#2563EB] hover:text-blue-700 font-medium">
            ← Back to sign in
          </button>
        </div>
      )
    }

    // ── Verification code view ──
    if (view === 'code') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-600">
              We sent a 6-digit verification code to <span className="font-medium text-gray-900">{resetEmail}</span>.
              Enter it below to continue.
            </p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-sm font-medium text-gray-700">Verification code</Label>
              <Input id="code" type="text" required placeholder="000000" value={resetCode}
                onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-12 border border-gray-300 rounded-md text-center text-lg font-mono tracking-[0.5em]"
                disabled={loading} maxLength={6} autoComplete="one-time-code" />
            </div>
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}
            <Button type="submit" disabled={loading || resetCode.length !== 6}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</> : 'Verify code'}
            </Button>
          </form>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">
              Didn't receive the code?{' '}
              <button onClick={() => { setView('forgot'); setError(null) }} className="text-[#2563EB] hover:text-blue-700 font-medium">
                Resend
              </button>
            </p>
            <button onClick={handleBackToLogin} className="block mx-auto text-sm text-[#2563EB] hover:text-blue-700 font-medium">
              ← Back to sign in
            </button>
          </div>
        </div>
      )
    }

    // ── Verified view ──
    if (view === 'verified') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Email verified</h2>
            <p className="text-sm text-gray-600">Your email has been confirmed. You can now sign in to your account.</p>
          </div>
          <Button onClick={handleBackToLogin} className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
            Sign in
          </Button>
        </div>
      )
    }

    // ── Verify-pending view ──
    if (view === 'verify-pending') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-[#2563EB]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-600">
              We sent a verification link to <span className="font-medium text-gray-900">{regEmail}</span>.
              Click the link to activate your account.
            </p>
          </div>
          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md text-left">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}
          <button
            onClick={async () => {
              setLoading(true); setError(null)
              try {
                const r = await fetch('/api/v1/auth/resend-verification', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: regEmail }),
                })
                if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed') }
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to resend')
              } finally { setLoading(false) }
            }}
            disabled={loading}
            className="text-sm text-[#2563EB] hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Resend verification email'}
          </button>
          <button onClick={handleBackToLogin} className="block mx-auto text-sm text-gray-500 hover:text-gray-700">
            Back to sign in
          </button>
        </div>
      )
    }

    // ── Register view ──
    if (view === 'register') {
      const regStrength = getPasswordStrength(regPassword)
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-600">Join the regulatory evidence review platform.</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault(); setLoading(true); setError(null)
            try {
              const r = await fetch('/api/v1/auth/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: regEmail, password: regPassword, full_name: regName, organization_name: regOrg }),
              })
              const d = await r.json()
              if (!r.ok) throw new Error(d.detail || d.error?.message || 'Registration failed')
              setView('verify-pending')
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Registration failed')
            } finally { setLoading(false) }
          }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-sm font-medium text-gray-700">Full name</Label>
              <Input id="reg-name" type="text" required placeholder="Dr. Jane Smith" value={regName}
                onChange={e => setRegName(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-email" className="text-sm font-medium text-gray-700">Work email</Label>
              <Input id="reg-email" type="email" required placeholder="you@organization.com" value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-org" className="text-sm font-medium text-gray-700">Organization</Label>
              <Input id="reg-org" type="text" required placeholder="Acme Therapeutics" value={regOrg}
                onChange={e => setRegOrg(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className="text-sm font-medium text-gray-700">Password</Label>
              <Input id="reg-password" type="password" required placeholder="Minimum 8 characters" value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
              {regPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${regStrength.color} rounded-full transition-all duration-300`} style={{ width: regStrength.width }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-12">{regStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className={regPassword.length >= 8 ? 'text-emerald-600' : 'text-gray-400'}>
                      {regPassword.length >= 8 ? 'Yes' : 'No'} 8+ characters
                    </span>
                    <span className={/[A-Z]/.test(regPassword) ? 'text-emerald-600' : 'text-gray-400'}>
                      {/[A-Z]/.test(regPassword) ? 'Yes' : 'No'} Uppercase
                    </span>
                    <span className={/[0-9]/.test(regPassword) ? 'text-emerald-600' : 'text-gray-400'}>
                      {/[0-9]/.test(regPassword) ? 'Yes' : 'No'} Number
                    </span>
                    <span className={/[^A-Za-z0-9]/.test(regPassword) ? 'text-emerald-600' : 'text-gray-400'}>
                      {/[^A-Za-z0-9]/.test(regPassword) ? 'Yes' : 'No'} Special char
                    </span>
                  </div>
                </div>
              )}
            </div>
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}
            <Button type="submit" disabled={loading}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : 'Create account'}
            </Button>
          </form>
          <p className="text-xs text-gray-500 text-center">
            By creating an account you agree to the platform terms of use.
          </p>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button type="button" onClick={handleBackToLogin}
                className="text-[#2563EB] hover:text-blue-700 font-medium">
                Sign in
              </button>
            </p>
          </div>
        </div>
      )
    }

    // ── Forgot password view ──
    if (view === 'forgot') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Reset your password</h2>
            <p className="text-sm text-gray-600">Enter the email address associated with your account and we'll send you a verification code.</p>
          </div>
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-sm font-medium text-gray-700">Email address</Label>
              <Input id="reset-email" type="email" required autoComplete="email" placeholder="you@organization.com"
                value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
            </div>
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}
            <Button type="submit" disabled={loading}
              className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : 'Send verification code'}
            </Button>
          </form>
          <button onClick={handleBackToLogin} className="text-sm text-[#2563EB] hover:text-blue-700 font-medium">
            ← Back to sign in
          </button>
        </div>
      )
    }

    // ── Login view (default) ──
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">Sign in to your workspace</h2>
          <p className="text-sm text-gray-600">Access controlled review workflows, audit history, and validated analysis outputs.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
            <Input id="email" type="email" required autoComplete="email" placeholder="you@organization.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <button type="button" onClick={() => { setView('forgot'); setError(null); setResetEmail(email) }}
                className="text-xs text-[#2563EB] hover:text-blue-700 font-medium">
                Forgot password?
              </button>
            </div>
            <Input id="password" type="password" required autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              className="h-10 border border-gray-300 rounded-md text-sm" disabled={loading} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input id="remember" type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="h-4 w-4 border border-gray-300 rounded accent-[#2563EB]" disabled={loading} />
            <label htmlFor="remember" className="text-sm text-gray-700">Remember me</label>
          </div>
          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 leading-snug font-medium">{error}</p>
            </div>
          )}
          <Button type="submit" disabled={loading}
            className="w-full h-10 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm rounded-md transition-colors">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Authenticating...</> : 'Sign in'}
          </Button>
        </form>
        <div className="border-t border-gray-200 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500 font-medium uppercase tracking-widest">
            <span>Role-based access</span><span className="text-gray-300">·</span>
            <span>Audit logging</span><span className="text-gray-300">·</span>
            <span>Validated environment</span><span className="text-gray-300">·</span>
            <span>Electronic record traceability</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button type="button" onClick={() => { setView('register'); setError(null) }}
              className="text-[#2563EB] hover:text-blue-700 font-medium">
              Create one
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left trust panel */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] shrink-0 flex-col justify-between p-12 bg-gray-900 border-r border-gray-800">
        <div className="flex items-center gap-3">
          <AfarensisLogo size={40} color="white" />
          <div>
            <h1 className="text-white font-semibold text-base tracking-tight leading-tight">Afarensis</h1>
            <p className="text-gray-500 text-xs font-medium">by Synthetic Ascension</p>
          </div>
        </div>
        <div className="space-y-8">
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-[13px] font-medium uppercase tracking-widest mb-2">Platform</p>
              <h2 className="text-white text-xl font-semibold leading-tight">Regulatory evidence review platform</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Version-controlled evidence evaluation, reproducible analysis artifacts, and attributed review workflows for teams operating under high scrutiny.
            </p>
          </div>
          <div className="space-y-2.5">
            {trustBullets.map((bullet, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />
                <p className="text-gray-300 text-sm">{bullet}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6">
          <p className="text-gray-600 text-[11px] font-medium">
            Authenticated users only. Validation documents and audit trail available upon request.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <AfarensisLogo size={36} color="#1f2937" />
            <div>
              <h1 className="text-gray-900 font-semibold text-base leading-tight">Afarensis</h1>
              <p className="text-gray-500 text-xs font-medium">by Synthetic Ascension</p>
            </div>
          </div>
          {renderForm()}
        </div>
      </div>
    </div>
  )
}

// Page transition
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  in:      { opacity: 1, y: 0 },
  out:     { opacity: 0, y: -16 },
}
const pageTransition = { type: 'tween', ease: 'anticipate', duration: 0.25 }

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const { user, loading: authLoading, login, logout, isAuthenticated } = useAuth()
  // WebSocket is lazy — only connects when entering a collaboration view.
  // No need to track connection state at the app level.
  const wsConnected = true  // Suppress the permanent "sync unavailable" banner

  // New workflow state
  const [studies, setStudies] = useState<Study[]>(STUDIES)
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null)
  const [protocolLocked, setProtocolLocked] = useState(false)
  const [reviewerMode, setReviewerMode] = useState(false)

  // After authentication, load real projects from the API
  const projectsFetched = useRef(false)
  useEffect(() => {
    if (!user || projectsFetched.current) return
    projectsFetched.current = true

    fetch('/api/v1/projects', {
      headers: { 'Authorization': `Bearer ${apiClient.getAccessToken() || ''}` },
    })
      .then(r => r.json())
      .then((data: any) => {
        // Backend returns plain array or {items: [...]}
        const projects = Array.isArray(data) ? data : (data?.items ?? [])
        if (projects.length > 0) {
          const mapped: Study[] = projects.map((p: any, i: number) => {
            const name = p.title || p.name || `Study ${i + 1}`
            return {
              id: p.id,
              protocol: name.split(':')[0]?.trim() || name,
              indication: name.split(':').slice(1).join(':')?.trim() || p.description || '',
              activeStep: p.active_step ?? (p.status === 'completed' ? 10 : p.status === 'review' ? 7 : p.status === 'processing' ? 4 : 1),
              locked: p.status === 'completed' || p.status === 'archived',
              lockedAt: p.status === 'completed' ? p.updated_at : undefined,
              status: p.status === 'completed' ? 'Submission Ready'
                : p.status === 'review' ? 'In Review'
                : p.status === 'processing' ? 'In Analysis'
                : 'Protocol Definition',
              estimand: 'ATT',
            }
          })
          setStudies(mapped)
          // Don't auto-select — user picks from dashboard
        }
      })
      .catch(err => console.warn('Failed to load projects, using defaults:', err))
  }, [user])

  // Sync lock state when study changes
  useEffect(() => {
    setProtocolLocked(selectedStudy?.locked ?? false)
  }, [selectedStudy])

  // Clear active study when navigating away from a project route
  useEffect(() => {
    const isProjectRoute = location.pathname.startsWith('/projects/')
    if (!isProjectRoute) {
      setSelectedStudy(null)
    }
  }, [location.pathname])

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navigate = useNavigate()

  const handleLogin = useCallback(async (email: string, password: string) => {
    await login(email, password)
    // After successful authentication, programmatically navigate to the dashboard
    // so the URL updates from /login to /dashboard immediately.
    navigate('/dashboard', { replace: true })
  }, [login, navigate])

  const handleLockProtocol = useCallback(() => {
    setProtocolLocked(true)
  }, [])

  const handleToggleReviewer = useCallback(() => {
    setReviewerMode(v => !v)
  }, [])

  // Shared props passed to every workflow page — selectedStudy is guaranteed non-null inside ProjectRouteSync
  const workflowProps = { selectedStudy: selectedStudy as Study, protocolLocked, reviewerMode }

  // Sync selectedStudy when URL projectId changes — guard children until study is resolved
  const ProjectRouteSync = ({ children }: { children: React.ReactNode }) => {
    const { projectId } = useParams<{ projectId: string }>()
    const navigate = useNavigate()
    const [syncError, setSyncError] = useState<string | null>(null)
    const retryCountRef = useRef(0)
    useEffect(() => {
      if (projectId && selectedStudy?.id !== projectId) {
        setSyncError(null)
        retryCountRef.current = 0
        const match = studies.find(s => s.id === projectId)
        if (match) {
          setSelectedStudy(match)
        } else {
          // Don't fire the API call until the access token is available.
          // On first load the auth refresh may still be in progress; without
          // this guard the request goes out unauthenticated and the backend
          // returns 404 ("Project not found") instead of 401.
          if (!apiClient.getAccessToken()) {
            // Token not ready yet — the effect will re-run once `studies`
            // is populated (after the parent projects-fetch completes) or
            // on the next render cycle when auth finishes.
            return
          }

          let cancelled = false
          const fetchProject = () => {
            apiClient.request(`/projects/${projectId}`, z.any())
              .then((project: any) => {
                if (cancelled) return
                const tempStudy: Study = {
                  id: project.id,
                  name: project.title || 'Untitled Project',
                  status: project.status || 'draft',
                  phase: '',
                  sponsor: '',
                  indication: '',
                  locked: false,
                }
                setSelectedStudy(tempStudy)
              })
              .catch((err: any) => {
                if (cancelled) return
                // Retry up to 3 times with increasing delay (handles race with auth init)
                if (retryCountRef.current < 3) {
                  retryCountRef.current += 1
                  setTimeout(fetchProject, 800 * retryCountRef.current)
                } else {
                  setSyncError(err?.message || 'Failed to load project')
                }
              })
          }
          fetchProject()

          return () => { cancelled = true }
        }
      }
    }, [projectId, studies])

    // Show error instead of infinite spinner
    if (syncError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Failed to load project</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{syncError}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )
    }

    // Don't render children until selectedStudy matches the URL projectId
    if (!selectedStudy || selectedStudy.id !== projectId) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
        </div>
      )
    }

    return <>{children}</>
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AfarensisLogo size={64} color="#2563EB" className="mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Afarensis</h2>
            <p className="text-sm text-gray-500 mt-1">Initializing regulatory compliance systems…</p>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mx-auto" />
        </div>
      </div>
    )
  }

  // Handle /verify-email route (pre-auth, user clicked email link)
  if (window.location.pathname === '/verify-email') {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const verifyEmail = params.get('email')
    return <VerifyEmailPage token={token} email={verifyEmail} />
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <ThemeProvider>
    <ToastProvider>
    <LiteratureProvider projectId={selectedStudy?.id ?? '__none__'}>
    <LineageProvider>
      <div className="min-h-screen bg-white dark:bg-[#0d0d0e]">
        {!wsConnected && (
          <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-2 text-sm text-amber-700">
            Real-time sync temporarily unavailable. Reconnecting…
          </div>
        )}

        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
          currentUser={user}
          onLogout={logout}
          studies={studies}
          selectedStudy={selectedStudy}
          onStudyChange={setSelectedStudy}
          protocolLocked={protocolLocked}
          onLockProtocol={handleLockProtocol}
          reviewerMode={reviewerMode}
          onToggleReviewer={handleToggleReviewer}
        />

        {/* Main content — offset by sidebar width */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-[280px]' : ''} min-h-screen`}>
          <main className="p-0">
            <ErrorBoundary resetKey={location.pathname}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial="initial" animate="in" exit="out"
                  variants={pageVariants} transition={pageTransition}
                >
                  <Routes>
                    {/* Default → dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<EnhancedDashboard />} />

                    {/* ── Project-scoped routes ─────────────────────────── */}
                    <Route path="/projects/:projectId/dag"               element={<ProjectRouteSync><StudyDAG           {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/study"             element={<ProjectRouteSync><StudyDefinition    {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/causal-framework"  element={<ProjectRouteSync><CausalFramework    {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/data-provenance"   element={<ProjectRouteSync><DataProvenance     {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/cohort"            element={<ProjectRouteSync><CohortConstruction {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/comparability"     element={<ProjectRouteSync><ComparabilityBalance {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/effect-estimation" element={<ProjectRouteSync><EffectEstimation   {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/bias-sensitivity"  element={<ProjectRouteSync><BiasSensitivity    {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/reproducibility"   element={<ProjectRouteSync><Reproducibility    {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/audit"             element={<ProjectRouteSync><AuditTrail         {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/regulatory-output" element={<ProjectRouteSync><RegulatoryOutput   {...workflowProps} /></ProjectRouteSync>} />

                    {/* ── Analysis Lineage (project-scoped) ───────────── */}
                    <Route path="/projects/:projectId/input-explorer"    element={<ProjectRouteSync><InputExplorer      {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/variable-notebook" element={<ProjectRouteSync><VariableNotebook   {...workflowProps} /></ProjectRouteSync>} />
                    <Route path="/projects/:projectId/trace-pack"        element={<ProjectRouteSync><TracePackExport    {...workflowProps} /></ProjectRouteSync>} />

                    {/* ── Literature Search (project-scoped) ──────────── */}
                    <Route path="/projects/:projectId/literature-search" element={<ProjectRouteSync><LiteratureSearch /></ProjectRouteSync>} />

                    {/* ── Legal & Policy ───────────────────────────────── */}
                    <Route path="/terms"   element={<TermsOfUse />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/policies/computational-methods" element={<AIUsePolicy />} />

                    {/* ── Admin (retained) ──────────────────────────────── */}
                    <Route path="/admin/users"    element={<UserManagement />} />
                    <Route path="/admin/audit"    element={<AuditLogs />} />
                    <Route path="/admin/settings" element={<SystemSettings />} />

                    {/* 404 */}
                    <Route path="*" element={
                      <div className="flex flex-col items-center justify-center min-h-screen text-center gap-4 bg-gray-50 dark:bg-[#0d0d0e]">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                          <AlertTriangle className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page Not Found</h1>
                          <p className="text-gray-500 text-sm max-w-sm">The requested page could not be found.</p>
                        </div>
                        <a
                          href="/dashboard"
                          className="inline-flex items-center gap-2 bg-[#2563EB] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Return to Dashboard
                        </a>
                      </div>
                    } />
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </LineageProvider>
    </LiteratureProvider>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default App
