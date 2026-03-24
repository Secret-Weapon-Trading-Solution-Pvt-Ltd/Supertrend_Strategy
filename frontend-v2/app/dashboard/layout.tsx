'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth }   from '@/store/AuthStore'
import { useEngine } from '@/store/EngineStore'
import { searchInstruments } from '@/lib/api'
import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import type { Instrument } from '@/types/types'
import type { ReactNode } from 'react'
import { IndicatorsPanel } from '@/components/IndicatorsPanel'
import { NavDrawer }      from '@/components/NavDrawer'

type ExTab   = 'NSE' | 'BSE' | 'NFO'
type NfoType = 'FUT' | 'CE' | 'PE'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { state: auth }                            = useAuth()
  const { state: engine, setSymbol, setTimeframe } = useEngine()

  // ── Symbol dropdown ───────────────────────────────────────────────────────
  const [symbolOpen, setSymbolOpen] = useState(false)
  const [exTab,      setExTab]      = useState<ExTab>('NSE')
  const [nfoType,    setNfoType]    = useState<NfoType>('FUT')
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<Instrument[]>([])
  const [searching,  setSearching]  = useState(false)
  const symbolRef = useRef<HTMLDivElement>(null)

  // ── Timeframe dropdown ────────────────────────────────────────────────────
  const [tfOpen, setTfOpen] = useState(false)
  const tfRef = useRef<HTMLDivElement>(null)

  // ── Indicators panel ──────────────────────────────────────────────────────
  const [indOpen,  setIndOpen]  = useState(false)

  // ── Nav drawer ────────────────────────────────────────────────────────────
  const [navOpen,  setNavOpen]  = useState(false)

  // Close both dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (symbolRef.current && !symbolRef.current.contains(e.target as Node)) setSymbolOpen(false)
      if (tfRef.current    && !tfRef.current.contains(e.target as Node))       setTfOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleSearch(q: string) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const params: Parameters<typeof searchInstruments>[0] = { query: q.trim(), limit: 15, exchange: exTab }
      if (exTab === 'NFO') params.type = nfoType
      setResults(await searchInstruments(params))
    } catch { /* ignore */ }
    setSearching(false)
  }

  function handleSelect(inst: Instrument) {
    setSymbol(inst)
    eventBus.emit(EVENTS.SYMBOL_CHANGED, inst)
    eventBus.emit(EVENTS.RESET_MARKET_DATA, undefined)
    setQuery('')
    setResults([])
    setSymbolOpen(false)
  }

  function handleSelectTf(tf: (typeof engine.availableTimeframes)[0]) {
    setTimeframe(tf)
    eventBus.emit(EVENTS.TIMEFRAME_CHANGED, tf)
    setTfOpen(false)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">

      {/* ══════════════════════ TOP BAR ═════════════════════════════════════ */}
      <header className="shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-3">

        {/* Hamburger */}
        <button
          onClick={() => setNavOpen(true)}
          className="w-8 h-8 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <span className="w-4 h-[1.5px] bg-slate-600 rounded-full" />
          <span className="w-4 h-[1.5px] bg-slate-600 rounded-full" />
          <span className="w-4 h-[1.5px] bg-slate-600 rounded-full" />
        </button>

        {/* Logo */}
        <span className="text-sm font-black tracking-[0.15em] text-slate-800 uppercase shrink-0">SWTS</span>
        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* ── Symbol dropdown ─────────────────────────────────────────────── */}
        <div className="relative" ref={symbolRef}>

          {/* Trigger */}
          <button
            onClick={() => { setSymbolOpen(v => !v); setTfOpen(false) }}
            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-[12px] transition-all min-w-[200px] ${
              symbolOpen
                ? 'border-blue-400 bg-white ring-2 ring-blue-50'
                : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
            }`}
          >
            {engine.selectedSymbol ? (
              <>
                <span className="font-semibold text-slate-800 truncate">{engine.selectedSymbol.symbol}</span>
                {engine.selectedSymbol.expiry && (
                  <span className="text-[10px] text-slate-400 shrink-0">{engine.selectedSymbol.expiry}</span>
                )}
                <TypeBadge type={engine.selectedSymbol.type} />
              </>
            ) : (
              <span className="text-slate-400">Select symbol…</span>
            )}
            <svg className="ml-auto w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Panel */}
          {symbolOpen && (
            <div className="absolute top-full mt-1.5 left-0 w-[300px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">

              {/* Exchange tabs */}
              <div className="flex border-b border-slate-100">
                {(['NSE', 'BSE', 'NFO'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setExTab(tab); setResults([]) }}
                    className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${
                      exTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-500 -mb-px bg-blue-50/40'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* NFO sub-type */}
              {exTab === 'NFO' && (
                <div className="flex gap-1.5 px-3 pt-2.5 pb-1">
                  {(['FUT', 'CE', 'PE'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setNfoType(t); setResults([]) }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        nfoType === t
                          ? t === 'CE' ? 'bg-emerald-100 text-emerald-700'
                            : t === 'PE' ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="px-3 py-2.5">
                <input
                  autoFocus
                  value={query}
                  onChange={e => { setQuery(e.target.value); handleSearch(e.target.value) }}
                  onKeyDown={e => e.key === 'Escape' && setSymbolOpen(false)}
                  placeholder={
                    exTab !== 'NFO' ? 'Search symbol…' :
                    nfoType === 'FUT' ? 'NIFTY, BANKNIFTY…' : 'NIFTY 22500…'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                />
              </div>

              {/* Results */}
              {searching && (
                <p className="px-4 pb-3 text-[11px] text-slate-400">Searching…</p>
              )}
              {!searching && results.length > 0 && (
                <ul className="max-h-52 overflow-y-auto border-t border-slate-100">
                  {results.map(r => (
                    <li
                      key={r.token}
                      onClick={() => handleSelect(r)}
                      className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[12px] font-semibold text-slate-800">{r.symbol}</span>
                          {r.name   && <span className="text-[10px] text-slate-400 ml-2 truncate">{r.name}</span>}
                          {r.expiry && <span className="text-[10px] text-slate-400 ml-2">{r.expiry}</span>}
                          {r.strike && <span className="text-[10px] text-slate-400 ml-1">@ {r.strike}</span>}
                        </div>
                        <TypeBadge type={r.type} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="px-4 pb-3 text-[11px] text-slate-400">No results found</p>
              )}
            </div>
          )}
        </div>

        {/* ── Timeframe dropdown ──────────────────────────────────────────── */}
        <div className="relative" ref={tfRef}>

          {/* Trigger */}
          <button
            onClick={() => { setTfOpen(v => !v); setSymbolOpen(false) }}
            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-[12px] transition-all min-w-[110px] ${
              tfOpen
                ? 'border-blue-400 bg-white ring-2 ring-blue-50'
                : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
            }`}
          >
            <span className={engine.selectedTimeframe ? 'font-semibold text-slate-800' : 'text-slate-400'}>
              {engine.selectedTimeframe?.label ?? 'Interval'}
            </span>
            <svg className="ml-auto w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          onClick={() => { setIndOpen(v => !v); setSymbolOpen(false); setTfOpen(false) }}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12px] transition-all ${
            indOpen
              ? 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-50'
              : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-slate-600'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
          <span className="font-medium">Indicators</span>
        </button>

        {/* ── WS status (right) ───────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-3">
          <div className="w-px h-5 bg-slate-200 shrink-0" />
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              auth.wsConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-slate-300'
            }`} />
            <span className={`text-[11px] font-medium ${auth.wsConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
              {auth.wsConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

      </header>

      {/* ══════════════════════ PAGE CONTENT ════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {children}
      </div>

      {/* ══════════════════════ NAV DRAWER ═══════════════════════════════════ */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      {/* ══════════════════════ INDICATORS PANEL ═════════════════════════════ */}
      <IndicatorsPanel open={indOpen} onClose={() => setIndOpen(false)} />

    </div>
  )
}

// ── Shared micro component ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
      type === 'CE'  ? 'bg-emerald-100 text-emerald-700' :
      type === 'PE'  ? 'bg-red-100     text-red-700'     :
      type === 'FUT' ? 'bg-blue-100    text-blue-700'    :
                       'bg-slate-100   text-slate-600'
    }`}>{type}</span>
  )
}
