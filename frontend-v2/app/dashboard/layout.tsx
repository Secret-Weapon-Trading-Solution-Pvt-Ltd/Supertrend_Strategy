'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth }   from '@/store/AuthStore'
import { useEngine } from '@/store/EngineStore'
import { eventBus }  from '@/lib/eventBus'
import { EVENTS }    from '@/types/types'
import type { Instrument } from '@/types/types'
import type { ReactNode }  from 'react'
import { IndicatorsPanel } from '@/components/IndicatorsPanel'
import { LayoutNav }       from '@/components/LayoutNav'
import { SymbolSelector }  from '@/components/SymbolSelector'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { state: auth }                            = useAuth()
  const { state: engine, setSymbol, setTimeframe } = useEngine()

  const [tfOpen,  setTfOpen]  = useState(false)
  const [indOpen, setIndOpen] = useState(false)
  const tfRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (tfRef.current && !tfRef.current.contains(e.target as Node)) setTfOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSymbolSelect(inst: Instrument) {
    setSymbol(inst)
    eventBus.emit(EVENTS.SYMBOL_CHANGED, inst)
    eventBus.emit(EVENTS.RESET_MARKET_DATA, undefined)
  }

  function handleSelectTf(tf: (typeof engine.availableTimeframes)[0]) {
    setTimeframe(tf)
    eventBus.emit(EVENTS.TIMEFRAME_CHANGED, tf)
    setTfOpen(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans antialiased">

      {/* ══════════════════════ TOP BAR ═════════════════════════════════════ */}
      <header className="glass-topbar shrink-0 h-16 flex items-center">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div
          className="w-72 shrink-0 flex items-center gap-3 px-5 h-full select-none"
          style={{ borderRight: '1px solid var(--theme-glass-border)' }}
        >
          <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0">
            <rect width="36" height="36" rx="9" fill="var(--theme-accent)" />
            <polyline points="7,26 13,18 20,21 29,11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="29" cy="11" r="2.5" fill="white" />
          </svg>
          <span
            className="font-display text-xl font-black tracking-[0.22em] uppercase"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            TrendEdge
          </span>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5">

          {/* Symbol selector */}
          <SymbolSelector
            selected={engine.selectedSymbol}
            onSelect={handleSymbolSelect}
          />

          <div className="w-px h-6 shrink-0 mx-1" style={{ background: 'var(--theme-glass-border)' }} />

          {/* Timeframe dropdown */}
          <div className="relative" ref={tfRef}>
            <button
              onClick={() => setTfOpen(v => !v)}
              className="flex items-center gap-3 h-11 px-4 rounded-xl transition-all min-w-[120px]"
              style={{
                background:     tfOpen ? 'var(--theme-accent-soft)' : 'var(--theme-glass-card)',
                border:         `1px solid ${tfOpen ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: engine.selectedTimeframe ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)' }}
              >
                {engine.selectedTimeframe?.label ?? 'Timeframe'}
              </span>
              <svg
                className="w-3.5 h-3.5 shrink-0 ml-auto"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {tfOpen && (
              <div
                className="absolute top-full mt-1.5 left-0 rounded-xl z-50 min-w-[130px] overflow-hidden py-1"
                style={{
                  background:     'var(--theme-glass-topbar)',
                  border:         '1px solid var(--theme-glass-border-strong)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  boxShadow:      'var(--theme-glass-shadow)',
                }}
              >
                {engine.availableTimeframes.length === 0 ? (
                  <p className="px-4 py-2 text-[11px]" style={{ color: 'var(--theme-text-ghost)' }}>
                    Loading…
                  </p>
                ) : (
                  engine.availableTimeframes.map(tf => {
                    const sel = engine.selectedTimeframe?.interval === tf.interval
                    return (
                      <button
                        key={tf.interval}
                        onClick={() => handleSelectTf(tf)}
                        className="w-full text-left px-4 py-2.5 text-[12px] transition-colors"
                        style={{
                          color:      sel ? 'var(--theme-accent)'      : 'var(--theme-text-secondary)',
                          background: sel ? 'var(--theme-accent-soft)' : 'transparent',
                          fontWeight: sel ? 700 : 500,
                        }}
                      >
                        {tf.label}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Indicators button */}
          <button
            onClick={() => { setIndOpen(v => !v); setTfOpen(false) }}
            className="flex items-center gap-2.5 h-11 px-4 rounded-xl transition-all"
            style={{
              background:     indOpen ? 'var(--theme-accent-soft)' : 'var(--theme-glass-card)',
              border:         `1px solid ${indOpen ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className="w-4 h-4 shrink-0"
              style={{ color: indOpen ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            <span
              className="text-sm font-semibold"
              style={{ color: indOpen ? 'var(--theme-accent)' : 'var(--theme-text-primary)' }}
            >
              Indicators
            </span>
          </button>

        </div>

        {/* ── WS status — pinned right ──────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-3 px-5 shrink-0">
          <div className="w-px h-6" style={{ background: 'var(--theme-glass-border)' }} />
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: auth.wsConnected ? 'var(--theme-profit)' : 'var(--theme-text-ghost)',
                boxShadow:  auth.wsConnected ? 'var(--theme-profit-glow)' : 'none',
              }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: auth.wsConnected ? 'var(--theme-profit)' : 'var(--theme-text-ghost)' }}
            >
              {auth.wsConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

      </header>

      {/* ══════════════════════ PAGE CONTENT ════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LayoutNav />
        {children}
      </div>

      {/* ══════════════════════ INDICATORS PANEL ═════════════════════════════ */}
      <IndicatorsPanel open={indOpen} onClose={() => setIndOpen(false)} />

    </div>
  )
}
