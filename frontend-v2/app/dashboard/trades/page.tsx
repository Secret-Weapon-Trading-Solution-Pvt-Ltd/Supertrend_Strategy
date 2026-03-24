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
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-raised">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-edge px-8 py-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold text-trades-600 uppercase tracking-widest mb-1">History</p>
            <h1 className="font-display text-3xl font-bold text-ink">Trade Log</h1>
          </div>
          <p className="text-sm text-muted">{trades.length} completed trade{trades.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Stat strip ────────────────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-4 border-b border-edge">
        <StatCard label="Total Trades" value={String(trades.length)} accent="text-ink" />
        <StatCard label="Win Rate"     value={`${winRate}%`}          accent="text-trades-600" border />
        <StatCard label="Wins / Losses" value={`${wins} / ${losses}`} accent="text-ink" border />
        <StatCard
          label="Net P&L"
          value={`${netPnl >= 0 ? '+' : ''}₹${netPnl.toFixed(2)}`}
          accent={netPnl >= 0 ? 'text-profit' : 'text-loss'}
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
          <div className="bg-surface rounded-2xl border border-edge overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-edge bg-sunken">
                  {['Symbol', 'Mode', 'Interval', 'Qty', 'Entry', 'Exit', 'Points', 'P&L', 'Result', 'Reason', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-2xs font-bold text-subtle uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-edge last:border-0 hover:bg-sunken transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-ink">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        t.broker_mode === 'live'
                          ? 'bg-loss-bg text-loss'
                          : 'bg-trades-50 text-trades-600'
                      }`}>
                        {t.broker_mode === 'live' ? 'Live' : 'Sim'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted font-mono">{t.interval}</td>
                    <td className="px-4 py-3 text-sm text-muted tabular-nums">{t.qty}</td>
                    <td className="px-4 py-3 text-sm text-ink tabular-nums font-mono">₹{t.entry_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-ink tabular-nums font-mono">₹{t.exit_price.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-sm tabular-nums font-semibold font-mono ${t.pnl_points >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {t.pnl_points >= 0 ? '+' : ''}{t.pnl_points.toFixed(1)}
                    </td>
                    <td className={`px-4 py-3 text-sm tabular-nums font-bold font-mono ${t.pnl_amount >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {t.pnl_amount >= 0 ? '+' : ''}₹{t.pnl_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        t.result === 'PROFIT' ? 'bg-profit-bg text-profit' : 'bg-loss-bg text-loss'
                      }`}>
                        {t.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{t.exit_reason}</td>
                    <td className="px-4 py-3 text-xs text-subtle tabular-nums font-mono">
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

function StatCard({ label, value, accent, border }: {
  label: string; value: string; accent: string; border?: boolean
}) {
  return (
    <div className={`bg-surface px-8 py-5 ${border ? 'border-l border-edge' : ''}`}>
      <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-edge p-6 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 bg-sunken rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <span className="text-5xl text-ghost">◎</span>
      <p className="text-base font-semibold text-muted">No trades yet</p>
      <p className="text-sm text-subtle">Start the engine on the Trading page to begin</p>
    </div>
  )
}
