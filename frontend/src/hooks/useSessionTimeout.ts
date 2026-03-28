import { useState, useEffect, useCallback, useRef } from 'react'

const TIMEOUT_MS = 60 * 60 * 1000        // 60 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000  // 5 minutes before timeout
const THROTTLE_MS = 30 * 1000            // throttle activity resets

export function useSessionTimeout(onLogout: () => void, enabled: boolean = true) {
  const [showWarning, setShowWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const lastActivityRef = useRef(Date.now())
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)
    setRemainingSeconds(0)

    if (warningTimerRef.current) clearInterval(warningTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)

    // Set warning timer
    warningTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = TIMEOUT_MS - elapsed

      if (remaining <= 0) {
        // Time's up — logout
        if (warningTimerRef.current) clearInterval(warningTimerRef.current)
        onLogout()
      } else if (remaining <= WARNING_BEFORE_MS) {
        setShowWarning(true)
        setRemainingSeconds(Math.ceil(remaining / 1000))
      }
    }, 1000)
  }, [onLogout])

  const continueSession = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  const logout = useCallback(() => {
    if (warningTimerRef.current) clearInterval(warningTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    onLogout()
  }, [onLogout])

  useEffect(() => {
    if (!enabled) return

    let lastThrottleTime = 0
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastThrottleTime < THROTTLE_MS) return
      lastThrottleTime = now
      if (!showWarning) {
        // Only reset if warning is not showing (user must interact with modal)
        resetTimers()
      }
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    resetTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity))
      if (warningTimerRef.current) clearInterval(warningTimerRef.current)
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    }
  }, [enabled, resetTimers, showWarning])

  return { showWarning, remainingSeconds, continueSession, logout }
}
