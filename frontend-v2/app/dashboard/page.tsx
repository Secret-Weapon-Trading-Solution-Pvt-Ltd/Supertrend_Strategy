'use client'

import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const router = useRouter()

  const { setAuth, setTickerStatus }                            = useAuth()
  const { state: engine, setTimeframe, setTimeframes, setQty } = useEngine()
  const { state: market }                                       = useMarket()
  const { setTrades }                                           = useTrade()

  const [qtyInput, setQtyInput] = useState('1')

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

      {/* ════════════════ PAGE HEADER ════════════════════════════════════════ */}
      <div
        className="shrink-0 px-8 py-5"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: 'var(--theme-accent)' }}
            >
              Dashboard
            </p>
            <h1
              className="font-display text-2xl font-black"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              Trading Engine
            </h1>
          </div>
          {tick?.timestamp && (
            <span
              className="text-sm font-mono tabular-nums pb-0.5"
              style={{ color: 'var(--theme-text-ghost)' }}
            >
              {tick.timestamp.slice(11, 19)}
            </span>
          )}
        </div>
      </div>

      {/* ════════════════ ENGINE SETUP BAR ═══════════════════════════════════ */}
      <div
        className="shrink-0 px-8 py-4 flex items-end gap-6"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >

        {/* Mode toggle */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-ghost)' }}>
            Mode
          </span>
          <div
            className="flex items-center rounded-xl p-1 gap-1"
            style={{
              background: 'var(--theme-glass-card)',
              border:     '1px solid var(--theme-glass-border)',
            }}
          >
            {/* Virtual */}
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
            {/* Live */}
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
        </div>

        <div className="w-px h-12 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

        {/* Quantity */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-ghost)' }}>
            Quantity
          </span>
          <input
            type="number" min={1} value={qtyInput}
            onChange={e => setQtyInput(e.target.value)}
            className="w-24 rounded-xl px-3 py-2 text-sm font-mono font-bold tabular-nums text-center focus:outline-none transition-all"
            style={{
              background:  'var(--theme-input-bg)',
              border:      '1px solid var(--theme-input-border)',
              color:       'var(--theme-input-text)',
            }}
          />
        </div>

        <div className="w-px h-12 shrink-0" style={{ background: 'var(--theme-glass-border)' }} />

        {/* Engine controls */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-2xs font-bold uppercase tracking-widest" style={{ color: 'var(--theme-text-ghost)' }}>
            Controls
          </span>
          <div className="flex items-center gap-2">
            {(engineState === 'IDLE' || engineState === 'STOPPED') && (
              <button
                onClick={handleStart}
                disabled={!sym || !engine.selectedTimeframe}
                className="h-10 px-6 rounded-xl text-sm font-black tracking-wide transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
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
                    className="h-10 px-5 rounded-xl text-sm font-bold transition-colors"
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
                    className="h-10 px-5 rounded-xl text-sm font-bold transition-colors"
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
                  className="h-10 px-5 rounded-xl text-sm font-bold transition-colors"
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

        {/* Engine state pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0"
          style={{
            background: 'var(--theme-glass-card)',
            border:     '1px solid var(--theme-glass-border)',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${engineState === 'RUNNING' ? 'animate-pulse' : ''}`}
            style={{ background: stateColor, boxShadow: engineState !== 'IDLE' && engineState !== 'STOPPED' ? `0 0 8px ${stateColor}` : 'none' }}
          />
          <span className="text-xs font-bold" style={{ color: stateColor }}>
            {engineState}
          </span>
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
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

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
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:cursor-not-allowed"
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
