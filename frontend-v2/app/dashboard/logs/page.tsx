'use client'

import { useTrade } from '@/store/TradeStore'

export default function LogsPage() {
  const { state: trade } = useTrade()
  const logs = trade.logs

  const counts = {
    ERROR:   logs.filter(l => l.level === 'ERROR').length,
    WARNING: logs.filter(l => l.level === 'WARNING').length,
    INFO:    logs.filter(l => l.level === 'INFO').length,
    DEBUG:   logs.filter(l => l.level === 'DEBUG').length,
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-8 py-6 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Glow decoration */}
        <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'var(--theme-accent-soft)', filter: 'blur(40px)', opacity: 0.6 }} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon box */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)', boxShadow: 'var(--theme-accent-glow)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6"
                style={{ color: 'var(--theme-accent)' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--theme-accent)' }}>
                System
              </p>
              <h1 className="font-display text-3xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}>
                Logs
              </h1>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {logs.length} entries
          </p>
        </div>
      </div>

      {/* ── Level strip ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 grid grid-cols-4"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        <LevelCard label="Errors"   count={counts.ERROR}
          color="var(--theme-loss)"          barBg="var(--theme-loss-bg)"   barBorder="var(--theme-loss-border)" />
        <LevelCard label="Warnings" count={counts.WARNING}
          color="var(--theme-warn)"          barBg="var(--theme-warn-bg)"   barBorder="var(--theme-warn-border)"  border />
        <LevelCard label="Info"     count={counts.INFO}
          color="var(--theme-accent)"        barBg="var(--theme-accent-soft)" barBorder="var(--theme-accent-border)" border />
        <LevelCard label="Debug"    count={counts.DEBUG}
          color="var(--theme-text-muted)"    barBg="var(--theme-glass-card)"  barBorder="var(--theme-glass-border)"  border />
      </div>

      {/* ── Log stream ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <span className="text-5xl" style={{ color: 'var(--theme-text-ghost)' }}>◎</span>
            <p className="text-base font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
              No logs yet
            </p>
            <p className="text-sm" style={{ color: 'var(--theme-text-ghost)' }}>
              Start the engine on the Dashboard to stream logs
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background:     'var(--theme-glass-card)',
              border:         '1px solid var(--theme-glass-border)',
              backdropFilter: 'blur(20px) saturate(160%)',
            }}
          >
            <div className="font-mono text-xs">
              {logs.map((log, i) => {
                const msgColor =
                  log.level === 'ERROR'   ? 'var(--theme-loss)'         :
                  log.level === 'WARNING' ? 'var(--theme-warn)'         :
                  log.level === 'DEBUG'   ? 'var(--theme-text-muted)'   :
                  'var(--theme-text-primary)'

                const rowBg = log.level === 'ERROR'
                  ? 'var(--theme-loss-bg)'
                  : 'transparent'

                return (
                  <div
                    key={i}
                    className="flex gap-4 px-5 py-2.5 transition-colors"
                    style={{
                      background:   rowBg,
                      borderBottom: i < logs.length - 1 ? '1px solid var(--theme-glass-border)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (log.level !== 'ERROR') e.currentTarget.style.background = 'var(--theme-accent-soft)'
                    }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
                  >
                    {/* Timestamp */}
                    <span className="shrink-0 tabular-nums w-24"
                      style={{ color: 'var(--theme-text-ghost)' }}>
                      {log.timestamp.slice(0, 19).replace('T', ' ')}
                    </span>

                    {/* Level badge */}
                    <span
                      className="shrink-0 w-16 font-bold text-center px-1.5 py-0.5 rounded text-2xs self-start"
                      style={
                        log.level === 'ERROR' ? {
                          color: 'var(--theme-loss)', background: 'var(--theme-loss-bg)', border: '1px solid var(--theme-loss-border)',
                        } : log.level === 'WARNING' ? {
                          color: 'var(--theme-warn)', background: 'var(--theme-warn-bg)', border: '1px solid var(--theme-warn-border)',
                        } : log.level === 'DEBUG' ? {
                          color: 'var(--theme-text-muted)', background: 'var(--theme-glass-card)', border: '1px solid var(--theme-glass-border)',
                        } : {
                          color: 'var(--theme-accent)', background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)',
                        }
                      }
                    >
                      {log.level}
                    </span>

                    {/* Logger */}
                    <span className="shrink-0 w-28 truncate"
                      style={{ color: 'var(--theme-text-ghost)' }}>
                      {log.logger}
                    </span>

                    {/* Message */}
                    <span className="flex-1 leading-relaxed" style={{ color: msgColor }}>
                      {log.message}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── LevelCard ─────────────────────────────────────────────────────────────────

function LevelCard({ label, count, color, barBg, barBorder, border }: {
  label:     string
  count:     number
  color:     string
  barBg:     string
  barBorder: string
  border?:   boolean
}) {
  return (
    <div
      className="px-8 py-5"
      style={{ borderLeft: border ? '1px solid var(--theme-glass-border)' : 'none' }}
    >
      <p className="text-xs uppercase tracking-widest mb-2"
        style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </p>
      <p className="font-display text-2xl font-bold tabular-nums"
        style={{ color }}>
        {count}
      </p>
      {/* Progress bar */}
      <div
        className="mt-2 h-1 rounded-full transition-all"
        style={{
          width:      `${Math.min(count * 4, 100)}%`,
          background: count > 0 ? barBg     : 'var(--theme-glass-border)',
          border:     count > 0 ? `1px solid ${barBorder}` : 'none',
        }}
      />
    </div>
  )
}
