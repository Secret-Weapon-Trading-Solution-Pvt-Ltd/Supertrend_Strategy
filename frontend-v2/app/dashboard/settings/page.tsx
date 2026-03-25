'use client'

import { THEMES, type Theme, type ThemeId } from '@/lib/themes'
import { useTheme } from '@/store/ThemeStore'

export default function SettingsPage() {
  const { themeId, setThemeId } = useTheme()

  return (
    <main
      className="flex-1 min-w-0 flex flex-col overflow-hidden"
      style={{ background: 'transparent' }}
    >

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-8 py-6 border-b"
        style={{ borderColor: 'var(--theme-glass-border-strong)' }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest mb-1"
          style={{ color: 'var(--theme-accent)' }}
        >
          Preferences
        </p>
        <h1
          className="font-display text-3xl font-bold"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          Settings
        </h1>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl flex flex-col gap-10">

          {/* ══ Appearance section ════════════════════════════════════════════ */}
          <Section
            title="Appearance"
            description="Choose a theme for the interface. The gradient and all UI colors update instantly."
          >
            <div className="grid grid-cols-2 gap-4">
              {THEMES.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={themeId === theme.id}
                  onSelect={() => setThemeId(theme.id as ThemeId)}
                />
              ))}
            </div>
          </Section>

        </div>
      </div>

    </main>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title:       string
  description: string
  children:    React.ReactNode
}) {
  return (
    <div>
      {/* Section heading */}
      <div className="mb-5">
        <h2
          className="text-base font-bold mb-1"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {title}
        </h2>
        <p
          className="text-sm"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {description}
        </p>
      </div>

      {/* Divider */}
      <div
        className="mb-5 h-px"
        style={{ background: 'var(--theme-glass-border)' }}
      />

      {children}
    </div>
  )
}

// ── Theme card ─────────────────────────────────────────────────────────────────

function ThemeCard({
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
      className="relative text-left rounded-2xl overflow-hidden transition-all duration-200 focus:outline-none"
      style={{
        border:     active
          ? `2px solid ${theme.accent.color}`
          : '2px solid var(--theme-glass-border)',
        boxShadow:  active ? theme.accent.glow : 'none',
        transform:  active ? 'scale(1.01)' : 'scale(1)',
      }}
    >

      {/* ── Gradient preview ──────────────────────────────────────────────── */}
      <div
        className="h-28 w-full relative"
        style={{ background: theme.gradient.css }}
      >
        {/* Mini glass cards inside the preview */}
        <div className="absolute inset-0 p-3 flex flex-col justify-end gap-1.5">
          <div
            className="rounded-lg px-2.5 py-1.5 flex items-center gap-2"
            style={{
              background:     theme.glass.card,
              border:         `1px solid ${theme.glass.border}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              className="text-xs font-bold font-mono tabular-nums"
              style={{ color: theme.profit.text }}
            >
              +₹1,240.50
            </span>
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-md ml-auto"
              style={{
                color:      theme.profit.text,
                background: theme.profit.bg,
                border:     `1px solid ${theme.profit.border}`,
              }}
            >
              ▲ BULL
            </span>
          </div>
          <div
            className="rounded-lg px-2.5 py-1.5"
            style={{
              background:     theme.glass.card,
              border:         `1px solid ${theme.glass.border}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex gap-3">
              <span className="text-xs" style={{ color: theme.text.muted }}>ST</span>
              <span className="text-xs font-mono font-bold" style={{ color: theme.text.primary }}>₹48,231</span>
              <span className="text-xs ml-auto" style={{ color: theme.text.muted }}>ATR</span>
              <span className="text-xs font-mono font-bold" style={{ color: theme.text.secondary }}>142.3</span>
            </div>
          </div>
        </div>

        {/* Active checkmark badge */}
        {active && (
          <div
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: theme.accent.color }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="w-3.5 h-3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Theme info ────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background:     theme.glass.panel,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div>
          <p
            className="text-sm font-bold"
            style={{ color: theme.text.primary }}
          >
            {theme.name}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: theme.text.muted }}
          >
            {theme.description}
          </p>
        </div>

        {/* Accent dot */}
        <div
          className="w-4 h-4 rounded-full shrink-0 ml-3"
          style={{
            background: theme.accent.color,
            boxShadow:  active ? theme.accent.glow : 'none',
          }}
        />
      </div>

    </button>
  )
}
