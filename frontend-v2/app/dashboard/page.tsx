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

  // ── Engine ────────────────────────────────────────────────────────────────
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

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-raised">

      {/* ════════════════ TRADE SETUP BAR — horizontal strip ════════════════ */}
      <div className="shrink-0 bg-surface border-b border-edge px-5 py-3 flex items-center gap-4 flex-wrap">

        {/* Symbol info */}
        {sym ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-display text-sm font-bold text-ink">{sym.symbol}</span>
            {sym.strike && (
              <span className="text-xs font-mono text-muted">@ ₹{sym.strike}</span>
            )}
            {sym.expiry && (
              <span className="text-xs text-subtle">{sym.expiry}</span>
            )}
            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-md ${
              sym.type === 'CE'  ? 'bg-profit-bg text-profit border border-profit-border' :
              sym.type === 'PE'  ? 'bg-loss-bg text-loss border border-loss-border'       :
              sym.type === 'FUT' ? 'bg-brand-100 text-brand-700 border border-brand-200'  :
              'bg-sunken text-muted border border-edge'
            }`}>{sym.type}</span>
          </div>
        ) : (
          <span className="text-sm text-subtle shrink-0">No symbol selected</span>
        )}

        <div className="w-px h-5 bg-edge shrink-0" />

        {/* Qty */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-muted">Qty</label>
          <input
            type="number" min={1} value={qtyInput}
            onChange={e => setQtyInput(e.target.value)}
            className="w-20 bg-sunken border border-edge rounded-lg px-2.5 py-1.5 text-sm font-mono text-ink tabular-nums text-center focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-all"
          />
        </div>

        <div className="w-px h-5 bg-edge shrink-0" />

        {/* Engine controls */}
        <div className="flex items-center gap-2 shrink-0">
          {(engineState === 'IDLE' || engineState === 'STOPPED') && (
            <button
              onClick={handleStart}
              disabled={!sym || !engine.selectedTimeframe}
              className="h-8 px-4 rounded-lg text-xs font-black tracking-wider bg-profit hover:bg-profit-light text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
            >
              ▶ START
            </button>
          )}
          {(engineState === 'RUNNING' || engineState === 'PAUSED') && (
            <>
              {engineState === 'RUNNING' ? (
                <button onClick={pauseEngine}
                  className="h-8 px-4 rounded-lg text-xs font-bold bg-warn-bg hover:bg-amber-100 text-warn border border-warn-border transition-colors">
                  ⏸ Pause
                </button>
              ) : (
                <button onClick={resumeEngine}
                  className="h-8 px-4 rounded-lg text-xs font-bold bg-profit-bg hover:bg-emerald-100 text-profit border border-profit-border transition-colors">
                  ▶ Resume
                </button>
              )}
              <button onClick={stopEngine}
                className="h-8 px-4 rounded-lg text-xs font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors">
                ■ Stop
              </button>
            </>
          )}
        </div>

        {/* Engine state badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${
            engineState === 'RUNNING' ? 'bg-profit animate-pulse' :
            engineState === 'PAUSED'  ? 'bg-warn' : 'bg-ghost'
          }`} />
          <span className={`text-xs font-semibold ${
            engineState === 'RUNNING' ? 'text-profit' :
            engineState === 'PAUSED'  ? 'text-warn'   : 'text-subtle'
          }`}>{engineState}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-subtle">
            {engine.brokerMode === 'live' ? '⚡ Live' : '◎ Simulation'}
          </span>
          {tick?.timestamp && (
            <span className="text-xs font-mono text-ghost tabular-nums ml-3">
              {tick.timestamp.slice(11, 19)}
            </span>
          )}
        </div>
      </div>

      {/* ════════════════ LIVE DATA CARDS ════════════════════════════════════ */}
      <div className="shrink-0 grid grid-cols-4 border-b border-edge">

        {/* Price */}
        <LiveCard
          label="Price"
          value={tick ? `₹${tick.close.toFixed(2)}` : '—'}
          accent={isGreen ? 'text-profit' : isRed ? 'text-loss' : 'text-ink'}
          border={false}
          tag={tick ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              isGreen ? 'bg-profit-bg text-profit' : isRed ? 'bg-loss-bg text-loss' : 'bg-sunken text-subtle'
            }`}>
              {isGreen ? '▲ BULL' : isRed ? '▼ BEAR' : '— FLAT'}
            </span>
          ) : null}
        />

        {/* Supertrend */}
        <LiveCard
          label="Supertrend"
          value={tick?.supertrend != null ? `₹${tick.supertrend.toFixed(2)}` : '—'}
          accent={isGreen ? 'text-profit' : isRed ? 'text-loss' : 'text-ink'}
          border
          tag={tick ? (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              isGreen ? 'bg-profit-bg text-profit border border-profit-border' :
              isRed   ? 'bg-loss-bg text-loss border border-loss-border'       :
              'bg-sunken text-subtle border border-edge'
            }`}>
              {tick.direction}
            </span>
          ) : null}
        />

        {/* ATR */}
        <LiveCard
          label="ATR"
          value={tick?.atr != null ? tick.atr.toFixed(2) : '—'}
          accent="text-muted"
          border
          tag={<span className="text-xs text-subtle">volatility</span>}
        />

        {/* Engine controls */}
        <div className="bg-surface border-l border-edge px-6 py-5 flex flex-col gap-3">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest">Engine</p>
          <div className="flex flex-col gap-2">
            {(engineState === 'IDLE' || engineState === 'STOPPED') && (
              <button
                onClick={handleStart}
                disabled={!sym || !engine.selectedTimeframe}
                className="w-full py-2 rounded-lg text-xs font-black tracking-wider bg-profit hover:bg-profit-light text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
              >
                ▶ START
              </button>
            )}
            {(engineState === 'RUNNING' || engineState === 'PAUSED') && (
              <div className="flex gap-1.5">
                {engineState === 'RUNNING' ? (
                  <button onClick={pauseEngine}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-warn-bg hover:bg-amber-100 text-warn border border-warn-border transition-colors">
                    ⏸ Pause
                  </button>
                ) : (
                  <button onClick={resumeEngine}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-profit-bg hover:bg-emerald-100 text-profit border border-profit-border transition-colors">
                    ▶ Resume
                  </button>
                )}
                <button onClick={stopEngine}
                  className="flex-1 py-2 rounded-lg text-xs font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors">
                  ■ Stop
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-auto">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              engineState === 'RUNNING' ? 'bg-profit animate-pulse' :
              engineState === 'PAUSED'  ? 'bg-warn' : 'bg-ghost'
            }`} />
            <span className={`text-xs font-semibold ${
              engineState === 'RUNNING' ? 'text-profit' :
              engineState === 'PAUSED'  ? 'text-warn'   : 'text-subtle'
            }`}>{engineState}</span>
          </div>
        </div>

      </div>

      {/* ════════════════ SCROLLABLE CONTENT ════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Open Position — full width */}
        <div className="bg-surface rounded-2xl border border-edge p-5">
          <Label>Open Position</Label>
          {pos ? (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-display text-base font-bold text-ink">{pos.symbol}</p>
                  <p className="text-xs text-muted mt-0.5">{pos.qty} lots</p>
                </div>
                <div className="text-right">
                  <p className={`font-display text-3xl font-bold tabular-nums leading-none ${
                    pos.unrealized_pnl >= 0 ? 'text-profit' : 'text-loss'
                  }`}>
                    {pos.unrealized_pnl >= 0 ? '+' : ''}₹{pos.unrealized_pnl.toFixed(2)}
                  </p>
                  <p className="text-2xs text-subtle mt-1 uppercase tracking-widest">Unrealized P&L</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <PriceBox label="Entry"   value={`₹${pos.entry_price.toFixed(2)}`}   cls="text-ink" />
                <PriceBox label="Current" value={`₹${pos.current_price.toFixed(2)}`}
                  cls={pos.current_price >= pos.entry_price ? 'text-profit' : 'text-loss'} />
                <PriceBox label="Peak"    value={`₹${pos.peak_price.toFixed(2)}`}    cls="text-brand-600" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 gap-2">
              <span className="text-4xl text-ghost">◎</span>
              <p className="text-xs text-subtle">No open position</p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}

// ── Micro components ──────────────────────────────────────────────────────────

function LiveCard({ label, value, accent, border, tag }: {
  label: string; value: string; accent: string; border: boolean; tag?: React.ReactNode
}) {
  return (
    <div className={`bg-surface px-6 py-5 flex flex-col gap-2 ${border ? 'border-l border-edge' : ''}`}>
      <p className="text-2xs font-bold text-subtle uppercase tracking-widest">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums font-mono ${accent}`}>{value}</p>
      {tag && <div>{tag}</div>}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-3">{children}</p>
}

function PriceBox({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-sunken rounded-xl px-3 py-2.5 border border-edge">
      <p className="text-2xs text-subtle uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}

