import React, { createContext, useContext } from 'react'

type Theme = 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: false,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light mode only — no dark mode support
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, isDark: false }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
