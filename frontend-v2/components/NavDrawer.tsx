'use client'

import { useState }       from 'react'
import Link               from 'next/link'
import { usePathname }    from 'next/navigation'
import { useEngine }      from '@/store/EngineStore'
import { startEngine, stopEngine, pauseEngine, resumeEngine } from '@/lib/socket'

interface Props {
  open:    boolean
  onClose: () => void
}

const NAV = [
  {
    href:        '/dashboard',
    label:       'Dashboard',
    description: 'Live engine, positions & P&L',
    accent:      'text-brand-600',
    activeBg:    'bg-brand-50 border-brand-200',
    dot:         'bg-brand-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/trades',
    label:       'Trades',
    description: 'Full trade history & statistics',
    accent:      'text-trades-600',
    activeBg:    'bg-trades-50 border-trades-100',
    dot:         'bg-trades-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/portfolio',
    label:       'Portfolio',
    description: 'Holdings, positions & capital',
    accent:      'text-portfolio-600',
    activeBg:    'bg-portfolio-50 border-portfolio-100',
    dot:         'bg-portfolio-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/settings',
    label:       'Settings',
    description: 'Mode, broker & preferences',
    accent:      'text-settings-600',
    activeBg:    'bg-settings-50 border-settings-100',
    dot:         'bg-settings-500',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export function NavDrawer({ open, onClose }: Props) {
  const pathname                           = usePathname()
  const { state: engine, setQty }          = useEngine()
  const [qtyInput, setQtyInput]            = useState('1')

  const engineState = engine.engineState

  function handleStart() {
    const sym = engine.selectedSymbol
    const tf  = engine.selectedTimeframe
    if (!sym || !tf) return
    const qty = Math.max(1, parseInt(qtyInput) || 1)
    setQty(qty)
    startEngine({ symbol: sym.symbol, token: sym.token, qty, interval: tf.interval, exchange: sym.exchange })
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 left-0 h-full w-72 z-50 bg-surface border-r border-edge shadow-modal flex flex-col animate-slide-right">

        {/* Header */}
        <div className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-edge">
          <span className="font-display text-base font-black tracking-[0.15em] text-ink uppercase">SWTS</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-sunken transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Trade Setup ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-4 border-b border-edge">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-3">Trade Setup</p>

          {/* Symbol + timeframe summary */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-sunken rounded-lg px-3 py-2 border border-edge">
              <p className="text-2xs text-subtle uppercase tracking-wider mb-0.5">Symbol</p>
              <p className="text-xs font-semibold text-ink truncate">
                {engine.selectedSymbol?.symbol ?? <span className="text-subtle">—</span>}
              </p>
            </div>
            <div className="flex-1 bg-sunken rounded-lg px-3 py-2 border border-edge">
              <p className="text-2xs text-subtle uppercase tracking-wider mb-0.5">Interval</p>
              <p className="text-xs font-semibold text-ink">
                {engine.selectedTimeframe?.label ?? <span className="text-subtle">—</span>}
              </p>
            </div>
          </div>

          {/* Qty input */}
          <div className="flex items-center gap-2.5 mb-3">
            <label className="text-xs text-muted shrink-0 w-8">Qty</label>
            <input
              type="number"
              min={1}
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              className="flex-1 bg-sunken border border-edge rounded-lg px-3 py-2 text-sm font-mono text-ink tabular-nums focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-all"
            />
          </div>

          {/* Engine controls */}
          {(engineState === 'IDLE' || engineState === 'STOPPED') && (
            <button
              onClick={handleStart}
              disabled={!engine.selectedSymbol || !engine.selectedTimeframe}
              className="w-full py-2.5 rounded-xl text-sm font-black tracking-wider bg-profit hover:bg-profit-light active:scale-[0.98] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              ▶ START ENGINE
            </button>
          )}
          {engineState === 'RUNNING' && (
            <div className="flex gap-2">
              <button
                onClick={pauseEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-warn-bg hover:bg-amber-100 text-warn border border-warn-border transition-colors"
              >
                ⏸ Pause
              </button>
              <button
                onClick={stopEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors"
              >
                ■ Stop
              </button>
            </div>
          )}
          {engineState === 'PAUSED' && (
            <div className="flex gap-2">
              <button
                onClick={resumeEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-profit-bg hover:bg-emerald-100 text-profit border border-profit-border transition-colors"
              >
                ▶ Resume
              </button>
              <button
                onClick={stopEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors"
              >
                ■ Stop
              </button>
            </div>
          )}

          {/* Engine state badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              engineState === 'RUNNING' ? 'bg-profit animate-pulse' :
              engineState === 'PAUSED'  ? 'bg-warn' :
              'bg-ghost'
            }`} />
            <span className={`text-xs font-semibold ${
              engineState === 'RUNNING' ? 'text-profit' :
              engineState === 'PAUSED'  ? 'text-warn'   :
              'text-subtle'
            }`}>
              {engineState}
            </span>
            <span className="ml-auto text-2xs text-subtle">
              {engine.brokerMode === 'live' ? '⚡ Live' : '◎ Sim'}
            </span>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest px-2 mb-2">Pages</p>

          {NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                  ${active
                    ? `${item.activeBg} ${item.accent}`
                    : 'border-transparent text-muted hover:bg-sunken hover:text-ink'
                  }
                `}
              >
                <span className={`shrink-0 ${active ? item.accent : ''}`}>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold leading-tight ${active ? item.accent : 'text-ink'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-subtle mt-0.5 truncate">{item.description}</p>
                </div>
                {active && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-edge">
          <p className="text-xs text-subtle">Supertrend Trading System</p>
        </div>
      </div>
    </>
  )
}
