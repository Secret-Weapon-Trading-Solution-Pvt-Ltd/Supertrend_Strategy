'use client'

import { useState, useEffect, useRef } from 'react'
import { searchInstruments } from '@/lib/api'
import type { Instrument } from '@/types/types'

type Exchange = 'NSE' | 'BSE' | 'NFO' | 'MCX'
type SubType  = 'FUT' | 'CE' | 'PE'

interface Props {
  selected: Instrument | null
  onSelect: (inst: Instrument) => void
}

const EXCHANGES: Exchange[] = ['NSE', 'BSE', 'NFO', 'MCX']

const EXCHANGE_DESC: Record<Exchange, string> = {
  NSE: 'Equities',
  BSE: 'Equities',
  NFO: 'F&O',
  MCX: 'Commodities',
}

export function SymbolSelector({ selected, onSelect }: Props) {
  const [open,      setOpen]      = useState(false)
  const [exchange,  setExchange]  = useState<Exchange>('NSE')
  const [subType,   setSubType]   = useState<SubType>('FUT')
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<Instrument[]>([])
  const [searching, setSearching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const params: Parameters<typeof searchInstruments>[0] = { query: q.trim(), exchange, limit: 20 }
      if (exchange === 'NFO' || exchange === 'MCX') params.type = subType
      setResults(await searchInstruments(params))
    } catch { /* ignore */ }
    setSearching(false)
  }

  function handleSelect(inst: Instrument) {
    onSelect(inst)
    setOpen(false)
  }

  function handleExchangeChange(ex: Exchange) {
    setExchange(ex)
    setResults([])
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const showSubType = exchange === 'NFO' || exchange === 'MCX'

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 h-11 px-4 rounded-xl transition-all min-w-[240px]"
        style={{
          background:     'var(--theme-glass-card)',
          border:         '1px solid var(--theme-glass-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {selected ? (
          <span
            className="font-display text-sm font-bold truncate flex-1 text-left"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {selected.symbol}
          </span>
        ) : (
          <span
            className="text-sm font-medium flex-1 text-left"
            style={{ color: 'var(--theme-text-ghost)' }}
          >
            Select symbol
          </span>
        )}
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </button>

      {/* ── Modal panel ────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg animate-in">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background:     'var(--theme-glass-topbar)',
                border:         '1px solid var(--theme-glass-border-strong)',
                backdropFilter: 'blur(28px) saturate(180%)',
                boxShadow:      'var(--theme-glass-shadow)',
              }}
            >

              {/* ── Header ──────────────────────────────────────────────────── */}
              <div
                className="px-5 pt-5 pb-4"
                style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p
                      className="font-display text-base font-black tracking-tight"
                      style={{ color: 'var(--theme-text-primary)' }}
                    >
                      Select Instrument
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                      NSE · BSE · NFO · MCX
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Exchange tabs */}
                <div className="flex gap-1.5">
                  {EXCHANGES.map(ex => {
                    const active = exchange === ex
                    return (
                      <button
                        key={ex}
                        onClick={() => handleExchangeChange(ex)}
                        className="flex-1 flex flex-col items-center py-2 px-2 rounded-xl text-center transition-all"
                        style={{
                          background: active ? 'var(--theme-accent-soft)'   : 'var(--theme-glass-card)',
                          border:     `1px solid ${active ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
                          color:      active ? 'var(--theme-accent)'         : 'var(--theme-text-ghost)',
                        }}
                      >
                        <span className="text-xs font-black tracking-wide">{ex}</span>
                        <span className="text-2xs mt-0.5" style={{ opacity: 0.7 }}>{EXCHANGE_DESC[ex]}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Sub-type filter */}
                {showSubType && (
                  <div className="flex gap-1.5 mt-3">
                    {(['FUT', 'CE', 'PE'] as SubType[]).map(t => {
                      const active = subType === t
                      const activeColor =
                        t === 'CE'  ? 'var(--theme-profit)' :
                        t === 'PE'  ? 'var(--theme-loss)'   :
                        'var(--theme-accent)'
                      const activeBg =
                        t === 'CE'  ? 'var(--theme-profit-bg)' :
                        t === 'PE'  ? 'var(--theme-loss-bg)'   :
                        'var(--theme-accent-soft)'
                      const activeBorder =
                        t === 'CE'  ? 'var(--theme-profit-border)' :
                        t === 'PE'  ? 'var(--theme-loss-border)'   :
                        'var(--theme-accent-border)'
                      return (
                        <button
                          key={t}
                          onClick={() => { setSubType(t); setResults([]); setTimeout(() => inputRef.current?.focus(), 50) }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={{
                            background: active ? activeBg             : 'var(--theme-glass-card)',
                            border:     `1px solid ${active ? activeBorder : 'var(--theme-glass-border)'}`,
                            color:      active ? activeColor          : 'var(--theme-text-ghost)',
                          }}
                        >
                          {t === 'FUT' ? 'Futures' : t === 'CE' ? 'Call (CE)' : 'Put (PE)'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Search input ─────────────────────────────────────────────── */}
              <div
                className="px-5 py-3"
                style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
              >
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder={
                      exchange === 'NSE' ? 'Search e.g. RELIANCE, INFY…' :
                      exchange === 'BSE' ? 'Search e.g. TCS, HDFC…'      :
                      exchange === 'NFO' ? 'Search e.g. NIFTY, BANKNIFTY…' :
                      'Search e.g. GOLD, CRUDEOIL…'
                    }
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none transition-all"
                    style={{
                      background:  'var(--theme-input-bg)',
                      border:      '1px solid var(--theme-input-border)',
                      color:       'var(--theme-input-text)',
                    }}
                  />
                  {searching && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--theme-accent)', borderTopColor: 'transparent' }}
                    />
                  )}
                </div>
              </div>

              {/* ── Results ──────────────────────────────────────────────────── */}
              <div className="max-h-64 overflow-y-auto">
                {!searching && results.length === 0 && query.trim().length < 2 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <span className="text-3xl" style={{ color: 'var(--theme-text-ghost)' }}>⌕</span>
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      Type at least 2 characters to search
                    </p>
                  </div>
                )}

                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <span className="text-3xl" style={{ color: 'var(--theme-text-ghost)' }}>○</span>
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No instruments found</p>
                  </div>
                )}

                {results.map((r, i) => (
                  <button
                    key={r.token}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-5 py-3 transition-colors text-left"
                    style={{
                      borderBottom: i !== results.length - 1
                        ? '1px solid var(--theme-glass-border)'
                        : 'none',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-accent-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-display text-sm font-bold truncate"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {r.symbol}
                        </span>
                        <TypeBadge type={r.type} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {r.name && (
                          <span className="text-2xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                            {r.name}
                          </span>
                        )}
                        {r.expiry && (
                          <>
                            {r.name && <span className="text-2xs" style={{ color: 'var(--theme-text-ghost)' }}>·</span>}
                            <span className="text-2xs" style={{ color: 'var(--theme-text-muted)' }}>{r.expiry}</span>
                          </>
                        )}
                        {r.strike && (
                          <>
                            <span className="text-2xs" style={{ color: 'var(--theme-text-ghost)' }}>·</span>
                            <span className="text-2xs" style={{ color: 'var(--theme-text-muted)' }}>@ ₹{r.strike}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-2xs font-bold shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                      {r.lot_size} lot
                    </span>
                  </button>
                ))}
              </div>

            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const color =
    type === 'CE'  ? 'var(--theme-profit)'       :
    type === 'PE'  ? 'var(--theme-loss)'          :
    type === 'FUT' ? 'var(--theme-accent)'        :
    'var(--theme-text-muted)'

  const bg =
    type === 'CE'  ? 'var(--theme-profit-bg)'    :
    type === 'PE'  ? 'var(--theme-loss-bg)'       :
    type === 'FUT' ? 'var(--theme-accent-soft)'  :
    'var(--theme-glass-card)'

  const border =
    type === 'CE'  ? 'var(--theme-profit-border)' :
    type === 'PE'  ? 'var(--theme-loss-border)'    :
    type === 'FUT' ? 'var(--theme-accent-border)'  :
    'var(--theme-glass-border)'

  return (
    <span
      className="text-2xs font-bold px-1.5 py-0.5 rounded shrink-0"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {type}
    </span>
  )
}
