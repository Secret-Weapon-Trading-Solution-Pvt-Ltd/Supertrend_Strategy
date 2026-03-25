'use client'

import { useEffect, useState } from 'react'
import { getTrades } from '@/lib/api'
import type { Trade } from '@/types/types'

export default function TradesPage() {
  const [trades,  setTrades]  = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTrades(500)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const wins    = trades.filter(t => t.result === 'PROFIT').length
  const losses  = trades.filter(t => t.result === 'LOSS').length
  const netPnl  = trades.reduce((s, t) => s + t.pnl_amount, 0)
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-8 py-6 relative overflow-hidden"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Glow decoration */}
        <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'var(--theme-accent-soft)', filter: 'blur(40px)', opacity: 0.6 }} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon box */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--theme-accent-soft)', border: '1px solid var(--theme-accent-border)', boxShadow: 'var(--theme-accent-glow)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6"
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
              <h1 className="font-display text-3xl font-bold"
                style={{ color: 'var(--theme-text-primary)' }}>
                Trade Log
              </h1>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {trades.length} completed trade{trades.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Stat strip ────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 grid grid-cols-4"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        <StatCard label="Total Trades"  value={String(trades.length)}
          valueColor="var(--theme-text-primary)" />
        <StatCard label="Win Rate"      value={`${winRate}%`}
          valueColor="var(--theme-accent)"  border />
        <StatCard label="Wins / Losses" value={`${wins} / ${losses}`}
          valueColor="var(--theme-text-primary)" border />
        <StatCard
          label="Net P&L"
          value={`${netPnl >= 0 ? '+' : ''}₹${netPnl.toFixed(2)}`}
          valueColor={netPnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)'}
          glow={netPnl >= 0 ? 'var(--theme-profit-glow)' : 'var(--theme-loss-glow)'}
          border
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <Skeleton />
        ) : trades.length === 0 ? (
          <Empty />
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background:     'var(--theme-glass-card)',
              border:         '1px solid var(--theme-glass-border)',
              backdropFilter: 'blur(20px) saturate(160%)',
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--theme-glass-border)', background: 'var(--theme-glass-panel)' }}>
                  {['Symbol', 'Mode', 'Interval', 'Qty', 'Entry', 'Exit', 'Points', 'P&L', 'Result', 'Reason', 'Time'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-2xs font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: 'var(--theme-text-ghost)' }}
                    >
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
                    <td className="px-4 py-3 text-sm font-semibold"
                      style={{ color: 'var(--theme-text-primary)' }}>
                      {t.symbol}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={t.broker_mode === 'live' ? {
                          color:      'var(--theme-loss)',
                          background: 'var(--theme-loss-bg)',
                          border:     '1px solid var(--theme-loss-border)',
                        } : {
                          color:      'var(--theme-accent)',
                          background: 'var(--theme-accent-soft)',
                          border:     '1px solid var(--theme-accent-border)',
                        }}
                      >
                        {t.broker_mode === 'live' ? 'Live' : 'Sim'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono"
                      style={{ color: 'var(--theme-text-muted)' }}>
                      {t.interval}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums"
                      style={{ color: 'var(--theme-text-muted)' }}>
                      {t.qty}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-mono"
                      style={{ color: 'var(--theme-text-primary)' }}>
                      ₹{t.entry_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-mono"
                      style={{ color: 'var(--theme-text-primary)' }}>
                      ₹{t.exit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-semibold font-mono"
                      style={{ color: t.pnl_points >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                      {t.pnl_points >= 0 ? '+' : ''}{t.pnl_points.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-bold font-mono"
                      style={{ color: t.pnl_amount >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                      {t.pnl_amount >= 0 ? '+' : ''}₹{t.pnl_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={t.result === 'PROFIT' ? {
                          color:      'var(--theme-profit)',
                          background: 'var(--theme-profit-bg)',
                          border:     '1px solid var(--theme-profit-border)',
                        } : {
                          color:      'var(--theme-loss)',
                          background: 'var(--theme-loss-bg)',
                          border:     '1px solid var(--theme-loss-border)',
                        }}
                      >
                        {t.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs"
                      style={{ color: 'var(--theme-text-muted)' }}>
                      {t.exit_reason}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums font-mono"
                      style={{ color: 'var(--theme-text-ghost)' }}>
                      {t.exit_time?.slice(0, 19).replace('T', ' ') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, valueColor, glow, border }: {
  label:      string
  value:      string
  valueColor: string
  glow?:      string
  border?:    boolean
}) {
  return (
    <div
      className="px-8 py-5"
      style={{ borderLeft: border ? '1px solid var(--theme-glass-border)' : 'none' }}
    >
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </p>
      <p
        className="font-display text-2xl font-bold tabular-nums"
        style={{ color: valueColor, textShadow: glow ?? 'none' }}
      >
        {value}
      </p>
    </div>
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
