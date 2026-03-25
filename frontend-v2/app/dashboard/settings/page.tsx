'use client'

import { THEMES, type Theme, type ThemeId } from '@/lib/themes'
import { useTheme } from '@/store/ThemeStore'

export default function SettingsPage() {
  const { themeId, setThemeId } = useTheme()

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-8 py-6 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Glow decoration */}
        <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'var(--theme-accent-soft)', filter: 'blur(40px)', opacity: 0.6 }} />

        <div className="relative flex items-center gap-4">
          {/* Icon box */}
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)', boxShadow: 'var(--theme-accent-glow)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6"
              style={{ color: 'var(--theme-accent)' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: 'var(--theme-accent)' }}>
              Preferences
            </p>
            <h1 className="font-display text-3xl font-bold"
              style={{ color: 'var(--theme-text-primary)' }}>
              Settings
            </h1>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl flex flex-col gap-8">

          {/* ── Appearance ──────────────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-bold mb-1"
              style={{ color: 'var(--theme-text-primary)' }}>
              Theme
            </p>
            <p className="text-xs mb-4"
              style={{ color: 'var(--theme-text-muted)' }}>
              Colors update instantly across the entire interface.
            </p>

            <div className="flex flex-wrap gap-3">
              {THEMES.map(theme => (
                <ThemeSwatch
                  key={theme.id}
                  theme={theme}
                  active={themeId === theme.id}
                  onSelect={() => setThemeId(theme.id as ThemeId)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

    </main>
  )
}

// ── ThemeSwatch ───────────────────────────────────────────────────────────────

function ThemeSwatch({
  theme,
  active,
  onSelect,
}: {
  theme:    Theme
  active:   boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 focus:outline-none"
      style={{
        background: active ? theme.glass.card        : 'var(--theme-glass-card)',
        border:     active
          ? `1.5px solid ${theme.accent.color}`
          : '1.5px solid var(--theme-glass-border)',
        boxShadow:  active ? theme.accent.glow : 'none',
      }}
    >
      {/* Gradient swatch dot */}
      <span
        className="w-5 h-5 rounded-full shrink-0"
        style={{
          background: theme.gradient.css,
          border:     `1.5px solid ${theme.glass.borderStrong}`,
          boxShadow:  active ? `0 0 6px ${theme.accent.color}` : 'none',
        }}
      />

      {/* Theme name */}
      <span
        className="text-sm font-semibold"
        style={{ color: active ? theme.accent.color : 'var(--theme-text-secondary)' }}
      >
        {theme.name}
      </span>

      {/* Active checkmark */}
      {active && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: theme.accent.color }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}
