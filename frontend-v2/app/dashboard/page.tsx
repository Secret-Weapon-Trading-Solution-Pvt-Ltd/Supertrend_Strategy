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

// ─────────────────────────────────────────────────────────────────────────────

type BottomTab = 'trades' | 'logs'

export default function DashboardPage() {
  const router = useRouter()

  const { setAuth, setTickerStatus }                              = useAuth()
  const { state: engine, setTimeframe, setTimeframes, setQty }   = useEngine()
  const { state: market }                                         = useMarket()
  const { state: trade,  setTrades }                              = useTrade()

  const [qtyInput,   setQtyInput]   = useState('1')
  const [bottomTab,  setBottomTab]  = useState<BottomTab>('trades')

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const status = await getStatus()
        if (!status.logged_in) { router.replace('/'); return }
        setAuth(status.logged_in, status.user ?? '', status.user_id ?? '')
        setTickerStatus(status.ticker)
      } catch {
        router.replace('/')
        return
      }
      try {
        const tfs = await getTimeframes()
        setTimeframes(tfs)
        if (tfs.length > 0 && !engine.selectedTimeframe) setTimeframe(tfs[0])
      } catch (e) { console.error('timeframes:', e) }
      try {
        const trades = await getTrades()
        setTrades(trades)
      } catch (e) { console.error('trades:', e) }
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

  const totalTrades = trade.trades.length
  const wins        = trade.trades.filter(t => t.result === 'PROFIT').length
  const losses      = trade.trades.filter(t => t.result === 'LOSS').length
  const netPnl      = trade.trades.reduce((s, t) => s + t.pnl_amount, 0)
  const winRate     = totalTrades ? Math.round((wins / totalTrades) * 100) : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ════════════════════ LEFT PANEL ═════════════════════════════════════ */}
      <aside className="w-[230px] shrink-0 bg-surface border-r border-edge flex flex-col overflow-y-auto">

        {/* ── Symbol info ─────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-edge">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-3">Instrument</p>

          {sym ? (
            <div className="bg-sunken rounded-xl border border-edge p-3">
              {/* Symbol name */}
              <p className="font-display text-base font-bold text-ink leading-tight truncate">
                {sym.symbol}
              </p>

              {/* Badges row */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                  sym.type === 'CE' ? 'bg-profit-bg text-profit' :
                  sym.type === 'PE' ? 'bg-loss-bg text-loss'     :
                  sym.type === 'FUT' ? 'bg-brand-100 text-brand-700' :
                  'bg-sunken text-muted border border-edge'
                }`}>
                  {sym.type}
                </span>
                <span className="text-2xs font-medium px-2 py-0.5 rounded-md bg-sunken text-muted border border-edge">
                  {sym.exchange}
                </span>
              </div>

              {/* Strike + expiry */}
              {(sym.strike || sym.expiry) && (
                <div className="mt-2.5 flex flex-col gap-1">
                  {sym.strike && (
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-subtle">Strike</span>
                      <span className="text-xs font-mono font-semibold text-ink">₹{sym.strike}</span>
                    </div>
                  )}
                  {sym.expiry && (
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-subtle">Expiry</span>
                      <span className="text-xs font-mono font-semibold text-ink">{sym.expiry}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-sunken rounded-xl border border-edge p-4 text-center">
              <p className="text-xs text-subtle">No symbol selected</p>
              <p className="text-2xs text-ghost mt-1">Use the dropdown above</p>
            </div>
          )}
        </div>

        {/* ── Trade Setup ─────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-edge">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-3">Trade Setup</p>

          {/* Qty */}
          <div className="flex items-center gap-2.5 mb-3">
            <label className="text-xs text-muted shrink-0">Qty</label>
            <input
              type="number" min={1} value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              className="flex-1 bg-sunken border border-edge rounded-lg px-3 py-2 text-sm font-mono text-ink tabular-nums focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-50 transition-all"
            />
          </div>

          {/* Engine controls */}
          {(engineState === 'IDLE' || engineState === 'STOPPED') && (
            <button
              onClick={handleStart}
              disabled={!sym || !engine.selectedTimeframe}
              className="w-full py-2.5 rounded-xl text-sm font-black tracking-wider bg-profit hover:bg-profit-light active:scale-[0.98] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ▶ START
            </button>
          )}
          {engineState === 'RUNNING' && (
            <div className="flex gap-2">
              <button onClick={pauseEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-warn-bg hover:bg-amber-100 text-warn border border-warn-border transition-colors">
                ⏸ Pause
              </button>
              <button onClick={stopEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors">
                ■ Stop
              </button>
            </div>
          )}
          {engineState === 'PAUSED' && (
            <div className="flex gap-2">
              <button onClick={resumeEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-profit-bg hover:bg-emerald-100 text-profit border border-profit-border transition-colors">
                ▶ Resume
              </button>
              <button onClick={stopEngine}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-loss-bg hover:bg-red-100 text-loss border border-loss-border transition-colors">
                ■ Stop
              </button>
            </div>
          )}

          {/* Engine state */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              engineState === 'RUNNING' ? 'bg-profit animate-pulse' :
              engineState === 'PAUSED'  ? 'bg-warn' : 'bg-ghost'
            }`} />
            <span className={`text-xs font-semibold ${
              engineState === 'RUNNING' ? 'text-profit' :
              engineState === 'PAUSED'  ? 'text-warn'   : 'text-subtle'
            }`}>{engineState}</span>
            <span className="ml-auto text-2xs text-subtle">
              {engine.brokerMode === 'live' ? '⚡ Live' : '◎ Sim'}
            </span>
          </div>
        </div>

        {/* ── Live Data ───────────────────────────────────────────────────── */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-2xs font-bold text-subtle uppercase tracking-widest">Live Data</p>

          {tick ? (
            <>
              {/* Price */}
              <LiveRow label="Price">
                <div className="flex items-center gap-1.5">
                  <span className={`font-display text-lg font-bold tabular-nums font-mono ${
                    isGreen ? 'text-profit' : isRed ? 'text-loss' : 'text-ink'
                  }`}>
                    ₹{tick.close.toFixed(2)}
                  </span>
                  <span className={`text-sm ${isGreen ? 'text-profit' : isRed ? 'text-loss' : 'text-subtle'}`}>
                    {isGreen ? '▲' : isRed ? '▼' : '—'}
                  </span>
                </div>
              </LiveRow>

              {/* Supertrend */}
              <LiveRow label="Supertrend">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-semibold text-ink tabular-nums">
                    {tick.supertrend != null ? `₹${tick.supertrend.toFixed(2)}` : '—'}
                  </span>
                  <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-md ${
                    isGreen ? 'bg-profit-bg text-profit' :
                    isRed   ? 'bg-loss-bg text-loss'     :
                    'bg-sunken text-subtle'
                  }`}>
                    {tick.direction}
                  </span>
                </div>
              </LiveRow>

              {/* ATR */}
              <LiveRow label="ATR">
                <span className="text-sm font-mono font-semibold text-muted tabular-nums">
                  {tick.atr != null ? tick.atr.toFixed(2) : '—'}
                </span>
              </LiveRow>

              {/* Timestamp */}
              <p className="text-2xs text-ghost font-mono tabular-nums text-right">
                {tick.timestamp?.slice(11, 19)}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center py-6 gap-2">
              <span className="text-3xl text-ghost">◎</span>
              <p className="text-xs text-subtle text-center">
                {sym ? 'Waiting for data…' : 'Select a symbol first'}
              </p>
            </div>
          )}
        </div>

      </aside>

      {/* ════════════════════ MAIN AREA ══════════════════════════════════════ */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-raised">

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Row 1: Position + Stats */}
          <div className="grid grid-cols-5 gap-4">

            {/* Open Position — 3 cols */}
            <div className="col-span-3 bg-surface rounded-2xl border border-edge p-5">
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

            {/* Session stats — 2 cols */}
            <div className="col-span-2 bg-surface rounded-2xl border border-edge p-5 flex flex-col">
              <Label>Session</Label>
              <div className="flex flex-col gap-2.5 flex-1 justify-center">
                <StatRow label="Total Trades" value={String(totalTrades)} />
                <StatRow label="Wins"         value={`${wins} (${winRate}%)`} cls="text-profit" />
                <StatRow label="Losses"       value={String(losses)}          cls="text-loss" />
                <div className="border-t border-edge pt-2.5">
                  <StatRow
                    label="Net P&L"
                    value={`${netPnl >= 0 ? '+' : ''}₹${netPnl.toFixed(2)}`}
                    cls={`font-bold ${netPnl >= 0 ? 'text-profit' : 'text-loss'}`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom panel — Trades + Logs */}
          <div className="flex-1 bg-surface rounded-2xl border border-edge flex flex-col min-h-[280px]">

            {/* Tab bar */}
            <div className="flex items-center border-b border-edge px-4 shrink-0">
              {(['trades', 'logs'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                    bottomTab === tab
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-subtle hover:text-muted'
                  }`}
                >
                  {tab === 'trades' ? `Trades${totalTrades ? ` (${totalTrades})` : ''}` : 'Logs'}
                </button>
              ))}
              {trade.orders.length > 0 && bottomTab === 'trades' && (
                <span className="ml-3 text-xs text-subtle">
                  {trade.orders.length} order{trade.orders.length !== 1 ? 's' : ''} this session
                </span>
              )}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-auto p-4">

              {/* Trades */}
              {bottomTab === 'trades' && (
                trade.trades.length === 0 ? (
                  <EmptyState>No completed trades yet</EmptyState>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Symbol','Qty','Entry','Exit','Points','P&L','Result','Reason','Time'].map(h => (
                          <th key={h} className="text-left pb-3 pr-4 text-2xs font-bold text-subtle uppercase tracking-widest">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trade.trades.map(t => (
                        <tr key={t.id} className="border-t border-edge hover:bg-sunken transition-colors">
                          <td className="py-2 pr-4 text-xs font-semibold text-ink">{t.symbol}</td>
                          <td className="py-2 pr-4 text-xs text-muted">{t.qty}</td>
                          <td className="py-2 pr-4 text-xs tabular-nums font-mono text-muted">₹{t.entry_price.toFixed(2)}</td>
                          <td className="py-2 pr-4 text-xs tabular-nums font-mono text-muted">₹{t.exit_price.toFixed(2)}</td>
                          <td className={`py-2 pr-4 text-xs tabular-nums font-semibold font-mono ${t.pnl_points >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {t.pnl_points >= 0 ? '+' : ''}{t.pnl_points.toFixed(1)}
                          </td>
                          <td className={`py-2 pr-4 text-xs tabular-nums font-bold font-mono ${t.pnl_amount >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {t.pnl_amount >= 0 ? '+' : ''}₹{t.pnl_amount.toFixed(2)}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-md ${
                              t.result === 'PROFIT' ? 'bg-profit-bg text-profit' : 'bg-loss-bg text-loss'
                            }`}>{t.result}</span>
                          </td>
                          <td className="py-2 pr-4 text-2xs text-subtle">{t.exit_reason}</td>
                          <td className="py-2 text-2xs text-subtle tabular-nums font-mono">
                            {t.exit_time?.slice(11, 19) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Logs */}
              {bottomTab === 'logs' && (
                trade.logs.length === 0 ? (
                  <EmptyState>No logs — connect socket to stream</EmptyState>
                ) : (
                  <div className="font-mono text-xs space-y-0.5">
                    {trade.logs.slice(0, 100).map((log, i) => (
                      <div key={i} className="flex gap-3 hover:bg-sunken px-1 rounded">
                        <span className="text-subtle shrink-0 w-20 tabular-nums">{log.timestamp.slice(0, 8)}</span>
                        <span className={`shrink-0 w-[52px] font-bold ${
                          log.level === 'ERROR'   ? 'text-loss'   :
                          log.level === 'WARNING' ? 'text-warn'   :
                          log.level === 'DEBUG'   ? 'text-subtle' : 'text-brand-500'
                        }`}>[{log.level.slice(0,4)}]</span>
                        <span className={`leading-relaxed ${
                          log.level === 'ERROR'   ? 'text-loss'   :
                          log.level === 'WARNING' ? 'text-warn'   :
                          log.level === 'DEBUG'   ? 'text-subtle' : 'text-muted'
                        }`}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

// ── Micro components ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-3">{children}</p>
}

function LiveRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted shrink-0">{label}</span>
      {children}
    </div>
  )
}

function PriceBox({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-sunken rounded-xl px-3 py-2.5 border border-edge">
      <p className="text-2xs text-subtle uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}

function StatRow({ label, value, cls = 'text-ink' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full py-10 text-xs text-subtle">
      {children}
    </div>
  )
}
