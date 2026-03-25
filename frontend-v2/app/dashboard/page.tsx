'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth }   from '@/store/AuthStore'
import { useEngine } from '@/store/EngineStore'
import { useMarket } from '@/store/MarketStore'
import { useTrade }  from '@/store/TradeStore'

import {
  connectSocket, disconnectSocket,
  startEngine, stopEngine, pauseEngine, resumeEngine,
  subscribeIndicators, unsubscribeIndicators,
  switchMode,
} from '@/lib/socket'
import { getStatus, getTimeframes, getTrades } from '@/lib/api'
import { eventBus }          from '@/lib/eventBus'
import { EVENTS }            from '@/types/types'
import type { Instrument }   from '@/types/types'
import { SymbolSelector }    from '@/components/SymbolSelector'
import { IndicatorsPanel }   from '@/components/IndicatorsPanel'

export default function DashboardPage() {
  const router = useRouter()

  const { state: auth, setAuth, setTickerStatus }               = useAuth()
  const { state: engine, setSymbol, setTimeframe, setTimeframes, setQty } = useEngine()
  const { state: market }                                       = useMarket()
  const { setTrades }                                           = useTrade()

  const [qtyInput, setQtyInput] = useState('')

  // ── Instrument controls state ──────────────────────────────────────────────
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

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const status = await getStatus()
        if (!status.logged_in) { router.replace('/'); return }
        setAuth(status.logged_in, status.user ?? '', status.user_id ?? '')
        setTickerStatus(status.ticker)
      } catch { router.replace('/'); return }
      try {
        const tfs = await getTimeframes()
        setTimeframes(tfs)
        if (tfs.length > 0 && !engine.selectedTimeframe) setTimeframe(tfs[0])
      } catch (e) { console.error('timeframes:', e) }
      try { setTrades(await getTrades()) } catch (e) { console.error('trades:', e) }
      connectSocket()
    }
    init()
    return () => disconnectSocket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Indicator subscribe ───────────────────────────────────────────────────
  useEffect(() => {
    const sym = engine.selectedSymbol
    const tf  = engine.selectedTimeframe
    if (!sym || !tf) return
    subscribeIndicators({ token: sym.token, interval: tf.interval })
    return () => unsubscribeIndicators()
  }, [engine.selectedSymbol?.token, engine.selectedTimeframe?.interval])

  // ── Engine handlers ───────────────────────────────────────────────────────
  function handleStart() {
    const sym = engine.selectedSymbol
    const tf  = engine.selectedTimeframe
    if (!sym || !tf) return
    const qty = Math.max(1, parseInt(qtyInput) || 1)
    setQty(qty)
    startEngine({ symbol: sym.symbol, token: sym.token, qty, interval: tf.interval, exchange: sym.exchange })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const tick        = market.tick ?? market.indicators
  const pos         = market.position
  const isGreen     = tick?.direction === 'GREEN'
  const isRed       = tick?.direction === 'RED'
  const engineState = engine.engineState
  const sym         = engine.selectedSymbol

  const stateColor =
    engineState === 'RUNNING' ? 'var(--theme-profit)' :
    engineState === 'PAUSED'  ? 'var(--theme-warn)'   :
    'var(--theme-text-ghost)'

  const dirColor = isGreen
    ? 'var(--theme-profit)'
    : isRed
    ? 'var(--theme-loss)'
    : 'var(--theme-text-primary)'

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ════════════════ HERO BANNER ════════════════════════════════════════ */}
      <div
        className="shrink-0 px-8 py-7 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Decorative accent glow — top-right */}
        <div
          className="absolute -top-10 right-20 w-72 h-32 rounded-full opacity-25 pointer-events-none"
          style={{
            background:  'var(--theme-accent)',
            filter:      'blur(48px)',
          }}
        />
        {/* Decorative second glow — bottom-left */}
        <div
          className="absolute -bottom-8 left-32 w-48 h-24 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'var(--theme-profit)',
            filter:     'blur(40px)',
          }}
        />

        <div className="relative flex items-center justify-between">

          {/* ── Title block ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-5">
            {/* Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--theme-accent-soft)',
                border:     '1px solid var(--theme-accent-border)',
              }}
            >
              <svg viewBox="0 0 28 28" fill="none" className="w-7 h-7">
                <polyline
                  points="2,20 8,13 14,16 22,7"
                  stroke="var(--theme-accent)" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round"
                />
                <circle cx="22" cy="7" r="2.5" fill="var(--theme-accent)" />
                <polyline
                  points="2,24 6,20 10,22 16,17 22,19"
                  stroke="var(--theme-profit)" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity="0.6"
                />
              </svg>
            </div>

            {/* Text */}
            <div>
              <h1
                className="font-display text-4xl font-black tracking-tight leading-none"
                style={{ color: 'var(--theme-text-primary)' }}
              >
                TrendEdge
              </h1>
              <p
                className="text-sm mt-1.5 font-medium"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                Supertrend & ATR · Automated Trading Engine
              </p>
            </div>
          </div>

          {/* ── Right side: live clock + WS status ───────────────────────── */}
          <div className="flex items-center gap-4 shrink-0">
            {tick?.timestamp && (
              <div className="text-right">
                <p
                  className="font-mono text-xl font-bold tabular-nums leading-none"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  {tick.timestamp.slice(11, 19)}
                </p>
                <p className="text-2xs mt-1 uppercase tracking-widest"
                  style={{ color: 'var(--theme-text-ghost)' }}>
                  Market Time
                </p>
              </div>
            )}

            {/* WS Connected status */}
            <div
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
              style={{
                background: 'var(--theme-glass-card)',
                border:     `1px solid ${auth.wsConnected
                  ? 'var(--theme-profit-border)'
                  : 'var(--theme-glass-border)'}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${auth.wsConnected ? 'animate-pulse' : ''}`}
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

        </div>
      </div>

      {/* ════════════════ COMBINED CONTROL STRIP ════════════════════════════ */}
      <div className="shrink-0 px-6 pt-5 pb-5">
        <div
          className="flex items-center w-full px-5 py-3.5 rounded-2xl"
          style={{
            background:     'var(--theme-glass-card)',
            border:         '1px solid var(--theme-glass-border)',
            backdropFilter: 'blur(20px) saturate(160%)',
            boxShadow:      'var(--theme-glass-shadow)',
          }}
        >

          {/* ══ LEFT GROUP — instrument controls ════════════════════════════════ */}
          <div className="flex items-center gap-4">

            {/* Symbol selector */}
            <SymbolSelector
              selected={engine.selectedSymbol}
              onSelect={handleSymbolSelect}
            />

            <div className="w-px h-8 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

            {/* Timeframe dropdown */}
            <div className="relative" ref={tfRef}>
              <button
                onClick={() => setTfOpen(v => !v)}
                className="flex items-center gap-3 h-11 px-5 rounded-xl transition-all min-w-[148px]"
                style={{
                  background: tfOpen ? 'var(--theme-accent-soft)' : 'transparent',
                  border:     `1px solid ${tfOpen ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
                }}
              >
                <span className="text-[15px] font-semibold"
                  style={{ color: engine.selectedTimeframe ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)' }}>
                  {engine.selectedTimeframe?.label ?? 'Timeframe'}
                </span>
                <svg className="w-3.5 h-3.5 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--theme-text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {tfOpen && (
                <div
                  className="absolute top-full mt-1.5 left-0 rounded-xl z-50 min-w-[148px] overflow-hidden py-1"
                  style={{
                    background:     'var(--theme-glass-topbar)',
                    border:         '1px solid var(--theme-glass-border-strong)',
                    backdropFilter: 'blur(20px) saturate(160%)',
                    boxShadow:      'var(--theme-glass-shadow)',
                  }}
                >
                  {engine.availableTimeframes.length === 0 ? (
                    <p className="px-4 py-2 text-[12px]" style={{ color: 'var(--theme-text-ghost)' }}>Loading…</p>
                  ) : (
                    engine.availableTimeframes.map(tf => {
                      const sel = engine.selectedTimeframe?.interval === tf.interval
                      return (
                        <button key={tf.interval} onClick={() => handleSelectTf(tf)}
                          className="w-full text-left px-4 py-2.5 text-[13px] transition-colors"
                          style={{
                            color:      sel ? 'var(--theme-accent)'      : 'var(--theme-text-secondary)',
                            background: sel ? 'var(--theme-accent-soft)' : 'transparent',
                            fontWeight: sel ? 700 : 500,
                          }}>
                          {tf.label}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="w-px h-8 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

            {/* Indicators */}
            <button
              onClick={() => { setIndOpen(v => !v); setTfOpen(false) }}
              className="flex items-center gap-2.5 h-11 px-5 rounded-xl transition-all"
              style={{
                background: indOpen ? 'var(--theme-accent-soft)' : 'transparent',
                border:     `1px solid ${indOpen ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="w-4.5 h-4.5 shrink-0"
                style={{ color: indOpen ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              <span className="text-[15px] font-semibold"
                style={{ color: indOpen ? 'var(--theme-accent)' : 'var(--theme-text-primary)' }}>
                Indicators
              </span>
            </button>

          </div>

          {/* ══ SPACER — pushes right group to the edge ══════════════════════════ */}
          <div className="flex-1" />

          {/* ══ CENTER DIVIDER ═══════════════════════════════════════════════════ */}
          <div className="w-px h-8 shrink-0 mx-4" style={{ background: 'var(--theme-glass-border-strong)' }} />

          {/* ══ RIGHT GROUP — engine controls ════════════════════════════════════ */}
          <div className="flex items-center gap-4">

            {/* Mode toggle */}
            <div
              className="flex items-center rounded-xl p-1 gap-0.5 shrink-0"
              style={{ background: 'var(--theme-glass-panel)', border: '1px solid var(--theme-glass-border)' }}
            >
              <ModeBtn
                active={engine.brokerMode === 'forward_test'}
                disabled={engineState === 'RUNNING' || engineState === 'PAUSED'}
                onClick={() => switchMode({ mode: 'forward_test' })}
                activeColor="var(--theme-accent)"
                activeBg="var(--theme-accent-soft)"
                activeBorder="var(--theme-accent-border)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                </svg>
                Virtual
              </ModeBtn>
              <ModeBtn
                active={engine.brokerMode === 'live'}
                disabled={engineState === 'RUNNING' || engineState === 'PAUSED'}
                onClick={() => switchMode({ mode: 'live' })}
                activeColor="var(--theme-profit)"
                activeBg="var(--theme-profit-bg)"
                activeBorder="var(--theme-profit-border)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Live
              </ModeBtn>
            </div>

            <div className="w-px h-8 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

            {/* Quantity — shows "Qty" when empty, "Qty 5" when a value is set */}
            <div
              className="flex items-center gap-2 h-11 px-5 rounded-xl shrink-0 cursor-text"
              style={{
                background: 'var(--theme-input-bg)',
                border:     '1px solid var(--theme-input-border)',
              }}
            >
              <span className="text-[15px] font-semibold select-none" style={{ color: 'var(--theme-text-muted)' }}>
                Qty
              </span>
              <input
                type="number" min={1} value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                placeholder=""
                className="w-12 bg-transparent text-[15px] font-bold font-mono tabular-nums text-left focus:outline-none"
                style={{ color: 'var(--theme-input-text)' }}
              />
            </div>

            <div className="w-px h-8 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

            {/* Engine controls */}
            <div className="flex items-center gap-2.5">
              {(engineState === 'IDLE' || engineState === 'STOPPED') && (
                <button
                  onClick={handleStart}
                  disabled={!sym || !engine.selectedTimeframe}
                  className="h-11 px-7 rounded-xl text-[15px] font-black tracking-wide transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--theme-profit)',
                    color:      '#fff',
                    boxShadow:  'var(--theme-profit-glow)',
                  }}
                >
                  ▶ START
                </button>
              )}
              {(engineState === 'RUNNING' || engineState === 'PAUSED') && (
                <>
                  {engineState === 'RUNNING' ? (
                    <button
                      onClick={pauseEngine}
                      className="h-11 px-6 rounded-xl text-[15px] font-bold transition-colors"
                      style={{
                        background: 'var(--theme-warn-bg)',
                        border:     '1px solid var(--theme-warn-border)',
                        color:      'var(--theme-warn)',
                      }}
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      onClick={resumeEngine}
                      className="h-11 px-6 rounded-xl text-[15px] font-bold transition-colors"
                      style={{
                        background: 'var(--theme-profit-bg)',
                        border:     '1px solid var(--theme-profit-border)',
                        color:      'var(--theme-profit)',
                      }}
                    >
                      ▶ Resume
                    </button>
                  )}
                  <button
                    onClick={stopEngine}
                    className="h-11 px-6 rounded-xl text-[15px] font-bold transition-colors"
                    style={{
                      background: 'var(--theme-loss-bg)',
                      border:     '1px solid var(--theme-loss-border)',
                      color:      'var(--theme-loss)',
                    }}
                  >
                    ■ Stop
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ════════════════ LIVE DATA CARDS ════════════════════════════════════ */}
      <div
        className="shrink-0 grid grid-cols-3"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Price */}
        <LiveCard
          label="Price"
          value={tick ? `₹${tick.close.toFixed(2)}` : '—'}
          valueColor={dirColor}
          tag={tick ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{
                color:      dirColor,
                background: isGreen ? 'var(--theme-profit-bg)' : isRed ? 'var(--theme-loss-bg)' : 'var(--theme-glass-card)',
                border:     `1px solid ${isGreen ? 'var(--theme-profit-border)' : isRed ? 'var(--theme-loss-border)' : 'var(--theme-glass-border)'}`,
              }}
            >
              {isGreen ? '▲ BULL' : isRed ? '▼ BEAR' : '— FLAT'}
            </span>
          ) : null}
        />

        {/* Supertrend */}
        <LiveCard
          label="Supertrend"
          value={tick?.supertrend != null ? `₹${tick.supertrend.toFixed(2)}` : '—'}
          valueColor={dirColor}
          border
          tag={tick ? (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{
                color:      dirColor,
                background: isGreen ? 'var(--theme-profit-bg)' : isRed ? 'var(--theme-loss-bg)' : 'var(--theme-glass-card)',
                border:     `1px solid ${isGreen ? 'var(--theme-profit-border)' : isRed ? 'var(--theme-loss-border)' : 'var(--theme-glass-border)'}`,
              }}
            >
              {tick.direction}
            </span>
          ) : null}
        />

        {/* ATR */}
        <LiveCard
          label="ATR"
          value={tick?.atr != null ? tick.atr.toFixed(2) : '—'}
          valueColor="var(--theme-text-secondary)"
          border
          tag={
            <span className="text-xs" style={{ color: 'var(--theme-text-ghost)' }}>
              volatility
            </span>
          }
        />
      </div>

      {/* ════════════════ SCROLLABLE CONTENT ════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-5 flex flex-col gap-4">

        {/* Open Position */}
        <div
          className="glass-card rounded-2xl p-5"
        >
          <p className="text-2xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--theme-text-ghost)' }}>
            Open Position
          </p>

          {pos ? (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-display text-base font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                    {pos.symbol}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                    {pos.qty} lots
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="font-display text-3xl font-bold tabular-nums leading-none"
                    style={{
                      color:      pos.unrealized_pnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)',
                      textShadow: pos.unrealized_pnl >= 0 ? 'var(--theme-profit-glow)' : 'var(--theme-loss-glow)',
                    }}
                  >
                    {pos.unrealized_pnl >= 0 ? '+' : ''}₹{pos.unrealized_pnl.toFixed(2)}
                  </p>
                  <p className="text-2xs uppercase tracking-widest mt-1" style={{ color: 'var(--theme-text-ghost)' }}>
                    Unrealized P&L
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <PriceBox label="Entry"   value={`₹${pos.entry_price.toFixed(2)}`}
                  color="var(--theme-text-primary)" />
                <PriceBox label="Current" value={`₹${pos.current_price.toFixed(2)}`}
                  color={pos.current_price >= pos.entry_price ? 'var(--theme-profit)' : 'var(--theme-loss)'} />
                <PriceBox label="Peak"    value={`₹${pos.peak_price.toFixed(2)}`}
                  color="var(--theme-accent)" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 gap-2">
              <span className="text-4xl" style={{ color: 'var(--theme-text-ghost)' }}>◎</span>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>No open position</p>
            </div>
          )}
        </div>

      </div>

      <IndicatorsPanel open={indOpen} onClose={() => setIndOpen(false)} />
    </main>
  )
}

// ── ModeBtn ───────────────────────────────────────────────────────────────────

function ModeBtn({
  active, disabled, onClick,
  activeColor, activeBg, activeBorder, children,
}: {
  active:        boolean
  disabled:      boolean
  onClick:       () => void
  activeColor:   string
  activeBg:      string
  activeBorder:  string
  children:      React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-bold transition-all disabled:cursor-not-allowed"
      style={{
        color:      active ? activeColor                        : 'var(--theme-text-ghost)',
        background: active ? activeBg                          : 'transparent',
        border:     `1px solid ${active ? activeBorder : 'transparent'}`,
      }}
    >
      {children}
    </button>
  )
}

// ── LiveCard ──────────────────────────────────────────────────────────────────

function LiveCard({ label, value, valueColor, border, tag }: {
  label:      string
  value:      string
  valueColor: string
  border?:    boolean
  tag?:       React.ReactNode
}) {
  return (
    <div
      className="px-6 py-5 flex flex-col gap-2"
      style={{ borderLeft: border ? '1px solid var(--theme-glass-border)' : 'none' }}
    >
      <p className="text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-ghost)' }}>
        {label}
      </p>
      <p className="font-display text-2xl font-bold tabular-nums font-mono" style={{ color: valueColor }}>
        {value}
      </p>
      {tag && <div>{tag}</div>}
    </div>
  )
}

// ── PriceBox ──────────────────────────────────────────────────────────────────

function PriceBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--theme-glass-card)',
        border:     '1px solid var(--theme-glass-border)',
      }}
    >
      <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: 'var(--theme-text-ghost)' }}>
        {label}
      </p>
      <p className="text-sm font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
