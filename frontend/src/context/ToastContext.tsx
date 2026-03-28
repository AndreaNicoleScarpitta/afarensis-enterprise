/**
 * ToastContext — lightweight notification system for transient messages.
 *
 * Provides `addToast(msg, type?, duration?)` to any component via `useToast()`.
 * Renders a fixed toast stack at the bottom-right of the viewport.
 *
 * Types: success | error | warning | info (default info)
 *
 * Usage:
 *   const { addToast } = useToast()
 *   addToast('Analysis complete', 'success')
 *   addToast('WebSocket disconnected — retrying...', 'warning', 8000)
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  exiting?: boolean
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, durationMs?: number) => void
  dismissToast: (id: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

// ─── Icons & colours per type ─────────────────────────────────────────────────

const ICON_MAP: Record<ToastType, React.ComponentType<any>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLE_MAP: Record<ToastType, string> = {
  success: 'bg-emerald-900/90 border-emerald-600/50 text-emerald-100',
  error: 'bg-red-900/90 border-red-600/50 text-red-100',
  warning: 'bg-amber-900/90 border-amber-600/50 text-amber-100',
  info: 'bg-blue-900/90 border-blue-600/50 text-blue-100',
}

const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 5000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const dismissToast = useCallback((id: string) => {
    // Mark as exiting for fade-out animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    // Remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info', durationMs: number = DEFAULT_DURATION) => {
    counterRef.current += 1
    const id = `toast-${counterRef.current}-${Date.now()}`
    const toast: Toast = { id, message, type }

    setToasts(prev => {
      const next = [...prev, toast]
      // Keep only the latest MAX_VISIBLE
      return next.slice(-MAX_VISIBLE)
    })

    // Auto-dismiss
    if (durationMs > 0) {
      setTimeout(() => dismissToast(id), durationMs)
    }
  }, [dismissToast])

  // ── Global API error listener ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { status, message, url } = (e as CustomEvent).detail ?? {}
      // Skip 401s (handled by redirect) and 404s (not actionable for user)
      if (status === 401 || status === 404) return
      const label = status >= 500
        ? `Server error (${status}) — ${message || url}`
        : `Request failed (${status}) — ${message || url}`
      addToast(label, status >= 500 ? 'error' : 'warning', 6000)
    }
    window.addEventListener('afarensis:api-error', handler)
    return () => window.removeEventListener('afarensis:api-error', handler)
  }, [addToast])

  return (
    <ToastContext.Provider value={{ addToast, dismissToast }}>
      {children}

      {/* ── Toast stack (fixed bottom-right) ─────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
             style={{ maxWidth: '420px' }}>
          {toasts.map(toast => {
            const Icon = ICON_MAP[toast.type]
            return (
              <div
                key={toast.id}
                className={`
                  pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
                  backdrop-blur-sm transition-all duration-300
                  ${STYLE_MAP[toast.type]}
                  ${toast.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
                `}
                role="alert"
              >
                <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${ICON_COLOR[toast.type]}`} />
                <p className="text-sm font-medium flex-1">{toast.message}</p>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4 opacity-60" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}
