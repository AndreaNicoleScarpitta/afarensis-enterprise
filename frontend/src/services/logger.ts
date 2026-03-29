/**
 * Production-safe logger — only emits in development mode.
 *
 * Replaces direct console.error / console.warn calls throughout the app.
 * In production builds (import.meta.env.PROD), all output is suppressed
 * so no debug information leaks to end-user browser consoles.
 */

const isDev = import.meta.env.DEV

export const logger = {
  error: (...args: unknown[]): void => {
    if (isDev) console.error(...args)
  },
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args)
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args)
  },
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(...args)
  },
}
