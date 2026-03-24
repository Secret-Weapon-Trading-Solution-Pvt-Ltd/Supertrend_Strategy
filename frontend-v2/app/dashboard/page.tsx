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
import { getStatus, getTimeframes, getTrades, searchInstruments } from '@/lib/api'
import { eventBus } from '@/lib/eventBus'
import { EVENTS }   from '@/types/types'
import type { Instrument } from '@/types/types'

export default function DashboardPage() {
  const router = useRouter()

  const { state: auth, setAuth, setTickerStatus } = useAuth()
  const { state: engine, setSymbol, setTimeframe, setTimeframes, setQty } = useEngine()
  const { state: market } = useMarket()
  const { state: trade, setTrades } = useTrade()

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Instrument[]>([])
  const [searching, setSearching] = useState(false)
  const [qtyInput, setQtyInput] = useState('1')

  // ── Init: auth check, load timeframes + trades, connect socket ──────────────
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

  // ── Subscribe to indicators when symbol + timeframe are both selected ────────
  useEffect(() => {
    const sym = engine.selectedSymbol
    const tf  = engine.selectedTimeframe
    if (!sym || !tf) return
    subscribeIndicators({ token: sym.token, interval: tf.interval })
    return () => unsubscribeIndicators()
  }, [engine.selectedSymbol?.token, engine.selectedTimeframe?.interval])

  // ── Symbol search ────────────────────────────────────────────────────────────
  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await searchInstruments({ query: q, limit: 10 })
      setResults(res)
    } catch { /* ignore */ }
    setSearching(false)
  }

  function handleSelect(instrument: Instrument) {
    setSymbol(instrument)
    eventBus.emit(EVENTS.SYMBOL_CHANGED, instrument)
    eventBus.emit(EVENTS.RESET_MARKET_DATA, undefined)
    setResults([])
    setQuery(instrument.symbol)
  }

  // ── Engine start ─────────────────────────────────────────────────────────────
  function handleStart() {
    const sym = engine.selectedSymbol
    const tf  = engine.selectedTimeframe
    if (!sym || !tf) return
    const qty = Math.max(1, parseInt(qtyInput) || 1)
    setQty(qty)
    startEngine({ symbol: sym.symbol, token: sym.token, qty, interval: tf.interval, exchange: sym.exchange })
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const tick = market.tick ?? market.indicators
  const pos  = market.position
  const logs = trade.logs.slice(0, 30)

  const stateColors: Record<string, string> = {
    IDLE:    'bg-slate-100 text-slate-500',
    RUNNING: 'bg-green-100 text-green-700',
    PAUSED:  'bg-yellow-100 text-yellow-700',
    STOPPED: 'bg-red-100 text-red-600',
  }
  const dirClass =
    tick?.direction === 'GREEN' ? 'text-green-600 font-semibold' :
    tick?.direction === 'RED'   ? 'text-red-600 font-semibold'   : 'text-slate-400'

  const logClass: Record<string, string> = {
    ERROR:   'text-red-600',
    WARNING: 'text-yellow-600',
    DEBUG:   'text-slate-400',
    INFO:    'text-slate-700',
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5 py-2.5 flex items-center gap-3">
        <span className="font-bold text-sm tracking-tight">SWTS</span>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateColors[engine.engineState]}`}>
          {engine.engineState}
        </span>

        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`w-2 h-2 rounded-full ${auth.wsConnected ? 'bg-green-500' : 'bg-slate-300'}`} />
          {auth.wsConnected ? 'Connected' : 'Disconnected'}
        </span>

        {engine.lastSignal !== 'HOLD' && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${engine.lastSignal === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            Signal: {engine.lastSignal}
          </span>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {auth.isLoggedIn ? `${auth.userName} · ${auth.userId}` : 'Not logged in'}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col gap-5 p-4 overflow-y-auto">

          {/* Symbol search */}
          <section>
            <Label>Symbol</Label>
            <div className="flex gap-1.5">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="NIFTY, RELIANCE…"
                className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-2.5 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40"
              >
                {searching ? '…' : 'Go'}
              </button>
            </div>

            {results.length > 0 && (
              <ul className="mt-1 border border-slate-200 rounded bg-white shadow-sm max-h-44 overflow-y-auto">
                {results.map(r => (
                  <li
                    key={r.token}
                    onClick={() => handleSelect(r)}
                    className="px-3 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 text-sm"
                  >
                    <span className="font-medium">{r.symbol}</span>
                    <span className="text-slate-400 ml-2 text-xs">{r.exchange} · {r.type}</span>
                    {r.expiry && <span className="text-slate-400 ml-1 text-xs">{r.expiry}</span>}
                  </li>
                ))}
              </ul>
            )}

            {engine.selectedSymbol && (
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-medium text-slate-700">{engine.selectedSymbol.symbol}</span>
                {' '}· token {engine.selectedSymbol.token}
              </p>
            )}
          </section>

          {/* Timeframe */}
          <section>
            <Label>Timeframe</Label>
            <select
              value={engine.selectedTimeframe?.interval ?? ''}
              onChange={e => {
                const tf = engine.availableTimeframes.find(t => t.interval === e.target.value)
                if (tf) { setTimeframe(tf); eventBus.emit(EVENTS.TIMEFRAME_CHANGED, tf) }
              }}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {engine.availableTimeframes.length === 0 && <option>Loading…</option>}
              {engine.availableTimeframes.map(tf => (
                <option key={tf.interval} value={tf.interval}>{tf.label}</option>
              ))}
            </select>
          </section>

          {/* Quantity */}
          <section>
            <Label>Quantity</Label>
            <input
              type="number" min={1} value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </section>

          {/* Engine controls */}
          <section>
            <Label>Engine</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <CtrlBtn
                label="Start" color="green"
                onClick={handleStart}
                disabled={!engine.selectedSymbol || engine.engineState === 'RUNNING'}
              />
              <CtrlBtn
                label="Stop" color="red"
                onClick={stopEngine}
                disabled={engine.engineState === 'IDLE' || engine.engineState === 'STOPPED'}
              />
              <CtrlBtn
                label="Pause" color="yellow"
                onClick={pauseEngine}
                disabled={engine.engineState !== 'RUNNING'}
              />
              <CtrlBtn
                label="Resume" color="blue"
                onClick={resumeEngine}
                disabled={engine.engineState !== 'PAUSED'}
              />
            </div>
          </section>

          {/* Mode */}
          <section>
            <Label>Broker Mode</Label>
            <p className="text-sm font-medium">
              {engine.brokerMode === 'forward_test' ? 'Forward Test' : 'Live'}
            </p>
          </section>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Live data + position */}
          <div className="grid grid-cols-2 gap-4">

            <Card title="Live Data">
              {tick ? (
                <table className="w-full text-sm">
                  <tbody>
                    <KV k="Timestamp"  v={tick.timestamp} />
                    <KV k="Close"      v={tick.close.toFixed(2)}             bold />
                    <KV k="Supertrend" v={tick.supertrend?.toFixed(2) ?? '—'} />
                    <KV k="ATR"        v={tick.atr?.toFixed(2) ?? '—'} />
                    <KV k="Direction"  v={tick.direction} cls={dirClass} />
                    <KV k="New Candle" v={tick.new_candle ? '✓ Yes' : 'No'} />
                  </tbody>
                </table>
              ) : (
                <Empty>Start engine or select symbol to see live data</Empty>
              )}
            </Card>

            <Card title="Open Position">
              {pos ? (
                <table className="w-full text-sm">
                  <tbody>
                    <KV k="Symbol"        v={pos.symbol} />
                    <KV k="Qty"           v={String(pos.qty)} />
                    <KV k="Entry"         v={pos.entry_price.toFixed(2)} />
                    <KV k="Current"       v={pos.current_price.toFixed(2)} />
                    <KV k="Peak"          v={pos.peak_price.toFixed(2)} />
                    <KV
                      k="Unrealized P&L"
                      v={(pos.unrealized_pnl >= 0 ? '+' : '') + pos.unrealized_pnl.toFixed(2)}
                      bold
                      cls={pos.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}
                    />
                  </tbody>
                </table>
              ) : (
                <Empty>No open position</Empty>
              )}
            </Card>
          </div>

          {/* Recent trades */}
          <Card title={`Trades (${trade.trades.length})`}>
            {trade.trades.length === 0 ? (
              <Empty>No trades yet</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100">
                      {['Symbol', 'Qty', 'Entry', 'Exit', 'P&L', 'Result', 'Reason'].map(h => (
                        <th key={h} className="text-left py-1.5 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trade.trades.slice(0, 15).map(t => (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-1 pr-4">{t.symbol}</td>
                        <td className="py-1 pr-4">{t.qty}</td>
                        <td className="py-1 pr-4">{t.entry_price.toFixed(2)}</td>
                        <td className="py-1 pr-4">{t.exit_price.toFixed(2)}</td>
                        <td className={`py-1 pr-4 font-medium ${t.pnl_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(t.pnl_amount >= 0 ? '+' : '') + t.pnl_amount.toFixed(2)}
                        </td>
                        <td className={`py-1 pr-4 font-medium ${t.result === 'PROFIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.result}
                        </td>
                        <td className="py-1 text-slate-400 text-xs">{t.exit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Log stream */}
          <Card title="Log Stream">
            {logs.length === 0 ? (
              <Empty>No logs yet — connect socket to start streaming</Empty>
            ) : (
              <div className="font-mono text-xs max-h-56 overflow-y-auto space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${logClass[log.level] ?? 'text-slate-700'}`}>
                    <span className="text-slate-400 shrink-0 w-16">{log.timestamp.slice(0, 8)}</span>
                    <span className="shrink-0 w-16">[{log.level}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </main>
      </div>
    </div>
  )
}

// ── Small shared components ────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{children}</p>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>
}

function KV({ k, v, bold, cls }: { k: string; v: string; bold?: boolean; cls?: string }) {
  return (
    <tr>
      <td className="py-0.5 pr-4 text-slate-400 w-1/2">{k}</td>
      <td className={`py-0.5 text-right ${bold ? 'font-semibold' : ''} ${cls ?? ''}`}>{v}</td>
    </tr>
  )
}

function CtrlBtn({ label, color, onClick, disabled }: {
  label: string; color: 'green' | 'red' | 'yellow' | 'blue'
  onClick: () => void; disabled: boolean
}) {
  const colors = {
    green:  'bg-green-600 hover:bg-green-700',
    red:    'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-500 hover:bg-yellow-600',
    blue:   'bg-blue-600 hover:bg-blue-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-1.5 text-sm text-white rounded ${colors[color]} disabled:opacity-30`}
    >
      {label}
    </button>
  )
}
