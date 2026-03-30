'use client'

import { useEffect, useState, useRef } from 'react'
import { getTrades } from '@/lib/api'
import { connectSocket, fetchTradeLogs } from '@/lib/socket'
import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import { useEngine } from '@/store/EngineStore'
import type { Trade, TradeLogEntry } from '@/types/types'

export default function TradesPage() {
  const { state: engine }        = useEngine()
  const [trades,    setTrades]    = useState<Trade[]>([])
  const [logs,      setLogs]      = useState<TradeLogEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<'activity' | 'completed'>('activity')
  const feedRef = useRef<HTMLDivElement>(null)

  const brokerMode   = engine.brokerMode
  const filteredLogs = logs.filter(l => l.broker_mode === brokerMode)
  const filteredTrades = trades.filter(t => t.broker_mode === brokerMode)

  useEffect(() => {
    getTrades(500)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false))

    // Connect socket and request history
    connectSocket()
    fetchTradeLogs(200)

    const onHistory = (entries: TradeLogEntry[]) => setLogs(entries)
    const onNew     = (entry: TradeLogEntry) => {
      setLogs(prev => [...prev, entry])
      setTimeout(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
      }, 50)
    }

    // Refetch completed trades after exit — backend commits to DB after emitting the event
    const onExit = () => {
      setTimeout(() => {
        getTrades(500).then(setTrades).catch(console.error)
      }, 600)
    }

    eventBus.on(EVENTS.TRADELOG_HISTORY,  onHistory)
    eventBus.on(EVENTS.TRADELOG_RECEIVED, onNew)
    eventBus.on(EVENTS.EXIT_TRIGGERED,    onExit)

    return () => {
      eventBus.off(EVENTS.TRADELOG_HISTORY,  onHistory)
      eventBus.off(EVENTS.TRADELOG_RECEIVED, onNew)
      eventBus.off(EVENTS.EXIT_TRIGGERED,    onExit)
    }
  }, [])

  const wins    = filteredTrades.filter(t => t.result === 'PROFIT').length
  const losses  = filteredTrades.filter(t => t.result === 'LOSS').length
  const netPnl  = filteredTrades.reduce((s, t) => s + t.pnl_amount, 0)
  const winRate = filteredTrades.length ? Math.round((wins / filteredTrades.length) * 100) : 0

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-4 sm:px-8 sm:py-6 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Glow decoration */}
        <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'var(--theme-accent-soft)', filter: 'blur(40px)', opacity: 0.6 }} />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Icon box */}
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)', boxShadow: 'var(--theme-accent-glow)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 sm:w-6 sm:h-6"
                style={{ color: 'var(--theme-accent)' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--theme-accent)' }}>
                History
              </p>
              <h1 className="font-display text-xl sm:text-3xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}>
                Trade Log
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span
              className="text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full"
              style={brokerMode === 'live' ? {
                color: 'var(--theme-loss)', background: 'var(--theme-loss-bg)', border: '1px solid var(--theme-loss-border)',
              } : {
                color: 'var(--theme-accent)', background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)',
              }}
            >
              {brokerMode === 'live' ? '⚡ Live' : '◎ Simulation'}
            </span>
            <TabBtn active={activeTab === 'activity'}  onClick={() => setActiveTab('activity')}>
              Activity Feed
              {filteredLogs.length > 0 && (
                <span className="ml-1.5 text-2xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--theme-accent-soft)', color: 'var(--theme-accent)', border: '1px solid var(--theme-accent-border)' }}>
                  {filteredLogs.length}
                </span>
              )}
            </TabBtn>
            <TabBtn active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
              Completed
              {filteredTrades.length > 0 && (
                <span className="ml-1.5 text-2xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--theme-glass-panel)', color: 'var(--theme-text-muted)', border: '1px solid var(--theme-glass-border)' }}>
                  {filteredTrades.length}
                </span>
              )}
            </TabBtn>
          </div>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}>
        {/* Blue sprinkle glow — top-right, like dashboard hero */}
        <div className="absolute -top-8 right-16 w-64 h-20 rounded-full pointer-events-none"
          style={{ background: 'var(--theme-accent)', filter: 'blur(48px)', opacity: 0.18 }} />

        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <StatCard label="Total Trades"  value={String(filteredTrades.length)}
            valueColor="var(--theme-text-primary)" />
          <StatCard label="Win Rate"      value={`${winRate}%`}
            valueColor="var(--theme-accent)"
            accentBg accentBorder />
          <StatCard label="Wins / Losses" value={`${wins} / ${losses}`}
            valueColor="var(--theme-text-primary)" />
          <StatCard
            label="Net P&L"
            value={`${netPnl >= 0 ? '+' : ''}₹${netPnl.toFixed(2)}`}
            valueColor={netPnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)'}
            glow={netPnl >= 0 ? 'var(--theme-profit-glow)' : 'var(--theme-loss-glow)'}
            profitCard={netPnl >= 0}
            lossCard={netPnl < 0}
          />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-3 sm:p-6">
        {loading ? (
          <Skeleton />
        ) : activeTab === 'activity' ? (
          <ActivityFeed logs={filteredLogs} feedRef={feedRef} />
        ) : (
          <CompletedTradesTable trades={filteredTrades} />
        )}
      </div>
    </div>
  )
}

// ── ActivityFeed ──────────────────────────────────────────────────────────────

const EVENT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SIGNAL_BUY:         { label: 'Signal Buy',        color: 'var(--theme-profit)', bg: 'var(--theme-profit-bg)',  border: 'var(--theme-profit-border)' },
  SIGNAL_SELL:        { label: 'Signal Sell',        color: 'var(--theme-loss)',   bg: 'var(--theme-loss-bg)',    border: 'var(--theme-loss-border)'   },
  ORDER_PLACED:       { label: 'Order Placed',       color: 'var(--theme-accent)', bg: 'var(--theme-accent-soft)',border: 'var(--theme-accent-border)' },
  ORDER_FILLED:       { label: 'Order Filled',       color: 'var(--theme-profit)', bg: 'var(--theme-profit-bg)',  border: 'var(--theme-profit-border)' },
  ORDER_REJECTED:     { label: 'Order Rejected',     color: 'var(--theme-loss)',   bg: 'var(--theme-loss-bg)',    border: 'var(--theme-loss-border)'   },
  ORDER_TIMEOUT:      { label: 'Order Timeout',      color: 'var(--theme-warn)',   bg: 'var(--theme-warn-bg)',    border: 'var(--theme-warn-border)'   },
  EXIT_TRIGGERED:     { label: 'Exit Triggered',     color: 'var(--theme-loss)',   bg: 'var(--theme-loss-bg)',    border: 'var(--theme-loss-border)'   },
  FUNDS_INSUFFICIENT: { label: 'Insufficient Funds', color: 'var(--theme-warn)',   bg: 'var(--theme-warn-bg)',    border: 'var(--theme-warn-border)'   },
}

function fmtDetail(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return k === 'qty' ? String(v) : v.toFixed(2)
  if (k === 'order_id' && typeof v === 'string') return v.slice(0, 8)
  return String(v)
}

function ActivityFeed({
  logs,
  feedRef,
}: {
  logs:    TradeLogEntry[]
  feedRef: React.RefObject<HTMLDivElement | null>
}) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <span className="text-5xl" style={{ color: 'var(--theme-text-ghost)' }}>◎</span>
        <p className="text-base font-semibold" style={{ color: 'var(--theme-text-muted)' }}>No activity yet</p>
        <p className="text-sm" style={{ color: 'var(--theme-text-ghost)' }}>
          Start the engine — trade events will stream here in real-time
        </p>
      </div>
    )
  }

  return (
    <div
      ref={feedRef}
      className="h-full overflow-auto rounded-2xl"
      style={{
        background:     'var(--theme-glass-card)',
        border:         '1px solid var(--theme-glass-border)',
        backdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <table className="w-full border-collapse min-w-[600px]">
        <thead>
          <tr style={{ background: 'var(--theme-glass-panel)', borderBottom: '1px solid var(--theme-glass-border)' }}>
            {['Time', 'Event', 'Symbol', 'Mode', 'Details'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-2xs font-bold uppercase tracking-widest whitespace-nowrap"
                style={{ color: 'var(--theme-text-ghost)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((entry, i) => {
            const meta = EVENT_META[entry.event_type] ?? {
              label: entry.event_type, color: 'var(--theme-text-muted)',
              bg: 'var(--theme-glass-panel)', border: 'var(--theme-glass-border)',
            }
            const d       = entry.details as Record<string, unknown>
            const istDate = entry.created_at
              ? new Date(entry.created_at.endsWith('Z') ? entry.created_at : entry.created_at + 'Z')
              : null
            const dateStr = istDate
              ? istDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
              : '—'
            const timeStr = istDate
              ? istDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
              : '—'

            const detailStr = Object.entries(d)
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${fmtDetail(k, v)}`)
              .join('   ·   ')

            return (
              <tr
                key={entry.id}
                style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--theme-glass-border)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-glass-panel)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Time */}
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ minWidth: '148px' }}>
                  <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>
                    {timeStr}
                    <span className="ml-1 text-2xs font-bold" style={{ color: 'var(--theme-accent)' }}>IST</span>
                  </span>
                  <div className="text-2xs font-mono tabular-nums mt-0.5" style={{ color: 'var(--theme-text-ghost)' }}>
                    {dateStr}
                  </div>
                </td>

                {/* Event badge */}
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ minWidth: '130px' }}>
                  <span
                    className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-md"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    {meta.label}
                  </span>
                </td>

                {/* Symbol */}
                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold"
                  style={{ color: 'var(--theme-text-primary)', minWidth: '140px' }}>
                  {entry.symbol ?? '—'}
                </td>

                {/* Mode */}
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ minWidth: '70px' }}>
                  <span
                    className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={entry.broker_mode === 'live' ? {
                      color: 'var(--theme-loss)', background: 'var(--theme-loss-bg)', border: '1px solid var(--theme-loss-border)',
                    } : {
                      color: 'var(--theme-accent)', background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)',
                    }}
                  >
                    {entry.broker_mode === 'live' ? 'Live' : 'Sim'}
                  </span>
                </td>

                {/* Details */}
                <td className="px-4 py-2.5 text-xs font-mono"
                  style={{ color: 'var(--theme-text-muted)' }}>
                  {detailStr || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── CompletedTradesTable ──────────────────────────────────────────────────────

function CompletedTradesTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return <Empty />

  return (
    <div className="h-full overflow-auto rounded-2xl"
      style={{
        background:     'var(--theme-glass-card)',
        border:         '1px solid var(--theme-glass-border)',
        backdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <table className="w-full min-w-[800px]">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--theme-glass-border)', background: 'var(--theme-glass-panel)' }}>
            {['Symbol', 'Mode', 'Interval', 'Qty', 'Entry', 'Exit', 'Points', 'P&L', 'Result', 'Reason', 'Time'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-2xs font-bold uppercase tracking-widest whitespace-nowrap"
                style={{ color: 'var(--theme-text-ghost)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={t.id}
              style={{ borderBottom: i < trades.length - 1 ? '1px solid var(--theme-glass-border)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-accent-soft)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>{t.symbol}</td>
              <td className="px-4 py-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={t.broker_mode === 'live' ? {
                    color: 'var(--theme-loss)', background: 'var(--theme-loss-bg)', border: '1px solid var(--theme-loss-border)',
                  } : {
                    color: 'var(--theme-accent)', background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)',
                  }}>
                  {t.broker_mode === 'live' ? 'Live' : 'Sim'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--theme-text-muted)' }}>{t.interval}</td>
              <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>{t.qty}</td>
              <td className="px-4 py-3 text-sm tabular-nums font-mono" style={{ color: 'var(--theme-text-primary)' }}>₹{t.entry_price.toFixed(2)}</td>
              <td className="px-4 py-3 text-sm tabular-nums font-mono" style={{ color: 'var(--theme-text-primary)' }}>₹{t.exit_price.toFixed(2)}</td>
              <td className="px-4 py-3 text-sm tabular-nums font-semibold font-mono"
                style={{ color: t.pnl_points >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                {t.pnl_points >= 0 ? '+' : ''}{t.pnl_points.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums font-bold font-mono"
                style={{ color: t.pnl_amount >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                {t.pnl_amount >= 0 ? '+' : ''}₹{t.pnl_amount.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                  style={t.result === 'PROFIT' ? {
                    color: 'var(--theme-profit)', background: 'var(--theme-profit-bg)', border: '1px solid var(--theme-profit-border)',
                  } : {
                    color: 'var(--theme-loss)', background: 'var(--theme-loss-bg)', border: '1px solid var(--theme-loss-border)',
                  }}>
                  {t.result}
                </span>
              </td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t.exit_reason}</td>
              <td className="px-4 py-3 text-xs tabular-nums font-mono" style={{ color: 'var(--theme-text-ghost)' }}>
                {t.exit_time?.slice(0, 19).replace('T', ' ') ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor, glow, accentBg, accentBorder, profitCard, lossCard }: {
  label:        string
  value:        string
  valueColor:   string
  glow?:        string
  accentBg?:    boolean
  accentBorder?: boolean
  profitCard?:  boolean
  lossCard?:    boolean
}) {
  const bg     = accentBg   ? 'var(--theme-accent-soft)'
                : profitCard ? 'var(--theme-profit-bg)'
                : lossCard   ? 'var(--theme-loss-bg)'
                : 'var(--theme-glass-card)'
  const border = accentBorder ? 'var(--theme-accent-border)'
                : profitCard   ? 'var(--theme-profit-border)'
                : lossCard     ? 'var(--theme-loss-border)'
                : 'var(--theme-glass-border)'

  return (
    <div
      className="rounded-xl sm:rounded-2xl px-4 py-3 sm:px-6 sm:py-5"
      style={{
        background:     bg,
        border:         `1px solid ${border}`,
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow:      glow ? `inset 0 0 0 1px ${border}, ${glow}` : undefined,
      }}
    >
      <p className="text-xs uppercase tracking-widest mb-2.5 font-semibold"
        style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </p>
      <p
        className="font-display text-lg sm:text-2xl font-bold tabular-nums"
        style={{ color: valueColor, textShadow: glow ?? 'none' }}
      >
        {value}
      </p>
    </div>
  )
}

// ── TabBtn ────────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center text-sm font-semibold px-4 py-1.5 rounded-xl transition-all"
      style={active ? {
        color:      'var(--theme-accent)',
        background: 'var(--theme-accent-soft)',
        border:     '1px solid var(--theme-accent-border)',
      } : {
        color:      'var(--theme-text-muted)',
        background: 'transparent',
        border:     '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div
      className="rounded-2xl p-6 space-y-3"
      style={{
        background:     'var(--theme-glass-card)',
        border:         '1px solid var(--theme-glass-border)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-lg animate-pulse"
          style={{ background: 'var(--theme-glass-panel)' }}
        />
      ))}
    </div>
  )
}

// ── Empty ─────────────────────────────────────────────────────────────────────

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <span className="text-5xl" style={{ color: 'var(--theme-text-ghost)' }}>◎</span>
      <p className="text-base font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
        No trades yet
      </p>
      <p className="text-sm" style={{ color: 'var(--theme-text-ghost)' }}>
        Start the engine on the Trading page to begin
      </p>
    </div>
  )
}
