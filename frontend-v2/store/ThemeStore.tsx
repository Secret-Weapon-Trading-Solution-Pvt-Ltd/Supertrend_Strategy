'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ThemeStore — active theme state + CSS variable injection
//
// How it works:
//   1. On mount, reads the saved ThemeId from localStorage (or uses default).
//   2. Calls applyTheme() which sets all --theme-* CSS variables on <html>.
//   3. Every component reads those CSS vars — no component ever hard-codes colors.
//   4. Switching theme = update state + localStorage + re-run applyTheme().
//
// Components consume via:
//   const { theme, themeId, setThemeId } = useTheme()
//   style={{ color: 'var(--theme-text-primary)' }}
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  THEMES,
  DEFAULT_THEME_ID,
  getTheme,
  type Theme,
  type ThemeId,
} from '@/lib/themes'

const STORAGE_KEY = 'swts-theme'

// ── Context type ──────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme:      Theme
  themeId:    ThemeId
  setThemeId: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ── CSS variable writer ───────────────────────────────────────────────────────
// Writes every theme token to document.documentElement so components can
// reference them as var(--theme-*) in inline styles or global CSS.

function applyTheme(theme: Theme) {
  const s = document.documentElement.style

  // ── Gradient ────────────────────────────────────────────────────────────────
  s.setProperty('--theme-gradient', theme.gradient.css)

  // ── Glass surfaces ──────────────────────────────────────────────────────────
  s.setProperty('--theme-glass-card',          theme.glass.card)
  s.setProperty('--theme-glass-panel',         theme.glass.panel)
  s.setProperty('--theme-glass-topbar',        theme.glass.topbar)
  s.setProperty('--theme-glass-border',        theme.glass.border)
  s.setProperty('--theme-glass-border-strong', theme.glass.borderStrong)
  s.setProperty('--theme-glass-shadow',        theme.glass.shadow)

  // ── Text hierarchy ──────────────────────────────────────────────────────────
  s.setProperty('--theme-text-primary',   theme.text.primary)
  s.setProperty('--theme-text-secondary', theme.text.secondary)
  s.setProperty('--theme-text-muted',     theme.text.muted)
  s.setProperty('--theme-text-ghost',     theme.text.ghost)

  // ── Accent ──────────────────────────────────────────────────────────────────
  s.setProperty('--theme-accent',        theme.accent.color)
  s.setProperty('--theme-accent-soft',   theme.accent.soft)
  s.setProperty('--theme-accent-border', theme.accent.border)
  s.setProperty('--theme-accent-glow',   theme.accent.glow)

  // ── Semantic: profit ────────────────────────────────────────────────────────
  s.setProperty('--theme-profit',        theme.profit.text)
  s.setProperty('--theme-profit-bg',     theme.profit.bg)
  s.setProperty('--theme-profit-border', theme.profit.border)
  s.setProperty('--theme-profit-glow',   theme.profit.glow)

  // ── Semantic: loss ──────────────────────────────────────────────────────────
  s.setProperty('--theme-loss',        theme.loss.text)
  s.setProperty('--theme-loss-bg',     theme.loss.bg)
  s.setProperty('--theme-loss-border', theme.loss.border)
  s.setProperty('--theme-loss-glow',   theme.loss.glow)

  // ── Semantic: warning ───────────────────────────────────────────────────────
  s.setProperty('--theme-warn',        theme.warn.text)
  s.setProperty('--theme-warn-bg',     theme.warn.bg)
  s.setProperty('--theme-warn-border', theme.warn.border)

  // ── Input fields ────────────────────────────────────────────────────────────
  s.setProperty('--theme-input-bg',           theme.input.bg)
  s.setProperty('--theme-input-border',       theme.input.border)
  s.setProperty('--theme-input-focus-border', theme.input.focusBorder)
  s.setProperty('--theme-input-focus-ring',   theme.input.focusRing)
  s.setProperty('--theme-input-text',         theme.input.text)
  s.setProperty('--theme-input-placeholder',  theme.input.placeholder)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID)

  // Read persisted theme on mount and apply immediately
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    const id    = saved && THEMES.find(t => t.id === saved) ? saved : DEFAULT_THEME_ID
    setThemeIdState(id)
    applyTheme(getTheme(id))
  }, [])

  // Re-apply CSS vars whenever themeId changes after initial mount
  useEffect(() => {
    applyTheme(getTheme(themeId))
  }, [themeId])

  function setThemeId(id: ThemeId) {
    setThemeIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <ThemeContext.Provider value={{ theme: getTheme(themeId), themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
