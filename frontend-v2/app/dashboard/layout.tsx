'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth }   from '@/store/AuthStore'
import { useEngine } from '@/store/EngineStore'
import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import type { Instrument } from '@/types/types'
import type { ReactNode } from 'react'
import { IndicatorsPanel }  from '@/components/IndicatorsPanel'
import { LayoutNav }        from '@/components/LayoutNav'
import { SymbolSelector }   from '@/components/SymbolSelector'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { state: auth }                            = useAuth()
  const { state: engine, setSymbol, setTimeframe } = useEngine()

  // ── Timeframe dropdown ────────────────────────────────────────────────────
  const [tfOpen, setTfOpen] = useState(false)
  const tfRef = useRef<HTMLDivElement>(null)

  // ── Indicators panel ──────────────────────────────────────────────────────
  const [indOpen, setIndOpen] = useState(false)

  // Close timeframe dropdown on outside click
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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">

      {/* ══════════════════════ TOP BAR ═════════════════════════════════════ */}
      <header className="shrink-0 h-16 bg-white border-b border-slate-200 flex items-center gap-2">

        {/* Logo — same width as sidebar so controls align above content */}
        <div className="w-72 shrink-0 flex items-center gap-3 px-5 border-r border-slate-200 h-full select-none">
          <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0">
            <rect width="36" height="36" rx="9" fill="#2563eb"/>
            <polyline points="7,26 13,18 20,21 29,11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="29" cy="11" r="2.5" fill="white"/>
          </svg>
          <span className="font-display text-xl font-black tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 uppercase">TrendEdge</span>
        </div>

        {/* ── Controls — starts exactly where content starts ────────────────── */}
        <div className="flex items-center gap-2 px-5">

        {/* ── Symbol selector ──────────────────────────────────────────────── */}
        <SymbolSelector
          selected={engine.selectedSymbol}
          onSelect={handleSymbolSelect}
        />

        <div className="w-px h-6 bg-slate-200 shrink-0 mx-1" />

        {/* ── Timeframe dropdown ──────────────────────────────────────────── */}
        <div className="relative" ref={tfRef}>

          {/* Trigger */}
          <button
            onClick={() => { setTfOpen(v => !v) }}
            className={`flex items-center gap-3 h-11 px-4 rounded-xl border transition-all min-w-[120px] ${
              tfOpen
                ? 'border-brand-400 bg-white ring-2 ring-brand-50 shadow-sm'
                : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <span className={`text-sm font-semibold ${engine.selectedTimeframe ? 'text-ink' : 'text-subtle'}`}>
              {engine.selectedTimeframe?.label ?? 'Timeframe'}
            </span>
            <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* List */}
          {tfOpen && (
            <div className="absolute top-full mt-1.5 left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[130px] overflow-hidden py-1">
              {engine.availableTimeframes.length === 0 ? (
                <p className="px-4 py-2 text-[11px] text-slate-400">Loading…</p>
              ) : (
                engine.availableTimeframes.map(tf => (
                  <button
                    key={tf.interval}
                    onClick={() => handleSelectTf(tf)}
                    className={`w-full text-left px-4 py-2.5 text-[12px] transition-colors ${
                      engine.selectedTimeframe?.interval === tf.interval
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Indicators button ───────────────────────────────────────────── */}
        <button
          onClick={() => { setIndOpen(v => !v); setTfOpen(false) }}
          className={`flex items-center gap-2.5 h-11 px-4 rounded-xl border transition-all ${
            indOpen
              ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-50 shadow-sm'
              : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-sm text-muted'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
          <span className="text-sm font-semibold text-ink">Indicators</span>
        </button>

        </div>{/* end centre controls */}

        {/* ── WS status — pinned right ─────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              auth.wsConnected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-slate-300'
            }`} />
            <span className={`text-sm font-semibold ${auth.wsConnected ? 'text-emerald-600' : 'text-subtle'}`}>
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

