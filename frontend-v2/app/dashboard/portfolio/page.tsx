'use client'

import { useEffect, useState } from 'react'
import { getHoldings, getPositions } from '@/lib/api'
import type { HoldingsResponse, PositionsResponse, LiveHolding, ForwardTestHolding, LivePosition, ForwardTestPosition } from '@/types/types'

export default function PortfolioPage() {
  const [holdings,  setHoldings]  = useState<HoldingsResponse | null>(null)
  const [positions, setPositions] = useState<PositionsResponse | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([getHoldings(), getPositions()])
      .then(([h, p]) => { setHoldings(h); setPositions(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const isLive = holdings?.mode === 'live'

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-raised">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-edge px-8 py-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold text-portfolio-600 uppercase tracking-widest mb-1">Account</p>
            <h1 className="font-display text-3xl font-bold text-ink">Portfolio</h1>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            isLive ? 'bg-loss-bg text-loss' : 'bg-portfolio-100 text-portfolio-600'
          }`}>
            {isLive ? '⚡ Live' : '◎ Simulation'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {loading ? (
          <LoadingCards />
        ) : (
          <>
            {/* Forward test summary */}
            {!isLive && holdings && (
              <ForwardSummaryCard data={holdings.holdings[0] as ForwardTestHolding} />
            )}

            {/* Live holdings */}
            {isLive && holdings && (holdings.holdings as LiveHolding[]).length > 0 && (
              <section>
                <SectionHeader>Holdings</SectionHeader>
                <div className="bg-surface rounded-2xl border border-edge overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-edge bg-sunken">
                        {['Symbol', 'Exchange', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Day %', 'Value'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-2xs font-bold text-subtle uppercase tracking-widest">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(holdings.holdings as LiveHolding[]).map(h => (
                        <tr key={h.isin} className="border-b border-edge last:border-0 hover:bg-sunken transition-colors">
                          <td className="px-4 py-3 text-sm font-semibold text-ink">{h.symbol}</td>
                          <td className="px-4 py-3 text-xs text-muted">{h.exchange}</td>
                          <td className="px-4 py-3 text-sm tabular-nums text-ink">{h.quantity}</td>
                          <td className="px-4 py-3 text-sm tabular-nums font-mono text-ink">₹{h.avg_price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm tabular-nums font-mono text-ink">₹{h.last_price.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-sm tabular-nums font-bold font-mono ${h.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(2)}
                          </td>
                          <td className={`px-4 py-3 text-sm tabular-nums font-semibold ${h.day_change_pct >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {h.day_change_pct >= 0 ? '+' : ''}{h.day_change_pct.toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums font-mono text-ink">₹{h.current_value.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Positions */}
            {positions && positions.positions.length > 0 && (
              <section>
                <SectionHeader>Open Positions</SectionHeader>
                <div className="bg-surface rounded-2xl border border-edge overflow-hidden">
                  {isLive ? (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-edge bg-sunken">
                          {['Symbol', 'Exchange', 'Qty', 'Avg Price', 'LTP', 'P&L', 'M2M', 'Product'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-2xs font-bold text-subtle uppercase tracking-widest">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(positions.positions as LivePosition[]).map(p => (
                          <tr key={p.symbol} className="border-b border-edge last:border-0 hover:bg-sunken transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-ink">{p.symbol}</td>
                            <td className="px-4 py-3 text-xs text-muted">{p.exchange}</td>
                            <td className="px-4 py-3 text-sm tabular-nums text-ink">{p.quantity}</td>
                            <td className="px-4 py-3 text-sm tabular-nums font-mono text-ink">₹{p.avg_price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm tabular-nums font-mono text-ink">₹{p.last_price.toFixed(2)}</td>
                            <td className={`px-4 py-3 text-sm tabular-nums font-bold font-mono ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {p.pnl >= 0 ? '+' : ''}₹{p.pnl.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 text-sm tabular-nums font-semibold font-mono ${p.m2m >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {p.m2m >= 0 ? '+' : ''}₹{p.m2m.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">{p.product}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 space-y-3">
                      {(positions.positions as ForwardTestPosition[]).map(p => (
                        <div key={p.order_id} className="flex items-center justify-between py-3 border-b border-edge last:border-0">
                          <div>
                            <p className="text-sm font-semibold text-ink">{p.symbol}</p>
                            <p className="text-xs text-muted mt-0.5">Entry {p.entry_time?.slice(0, 19).replace('T', ' ')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm tabular-nums font-mono font-bold text-ink">₹{p.entry_price.toFixed(2)}</p>
                            <p className="text-xs text-muted">{p.qty} qty · peak ₹{p.peak_price.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Empty */}
            {!loading && positions?.positions.length === 0 && (!isLive || (holdings?.holdings as LiveHolding[])?.length === 0) && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <span className="text-5xl text-ghost">◎</span>
                <p className="text-base font-semibold text-muted">No portfolio data</p>
                <p className="text-sm text-subtle">Connect to your broker to see holdings</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ForwardSummaryCard({ data }: { data: ForwardTestHolding | undefined }) {
  if (!data) return null
  const pnlPct = data.initial_capital
    ? ((data.total_pnl / data.initial_capital) * 100).toFixed(2)
    : '0.00'
  const winRate = data.total_trades
    ? Math.round((data.wins / data.total_trades) * 100)
    : 0

  return (
    <div className="bg-surface rounded-2xl border border-edge p-6">
      <p className="text-xs font-bold text-portfolio-600 uppercase tracking-widest mb-5">Simulation Summary</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <BigStat label="Capital"   value={`₹${data.initial_capital.toLocaleString()}`} />
        <BigStat label="Available" value={`₹${data.available_capital.toLocaleString()}`} />
        <BigStat
          label="Total P&L"
          value={`${data.total_pnl >= 0 ? '+' : ''}₹${data.total_pnl.toFixed(2)}`}
          accent={data.total_pnl >= 0 ? 'text-profit' : 'text-loss'}
        />
        <BigStat
          label="Return"
          value={`${Number(pnlPct) >= 0 ? '+' : ''}${pnlPct}%`}
          accent={Number(pnlPct) >= 0 ? 'text-profit' : 'text-loss'}
        />
        <BigStat label="Trades"    value={String(data.total_trades)} />
        <BigStat label="Win Rate"  value={`${winRate}%`} accent="text-portfolio-600" />
      </div>
    </div>
  )
}

function BigStat({ label, value, accent = 'text-ink' }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-xs text-muted uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`font-display text-xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-base font-bold text-ink mb-3">{children}</h2>
}

function LoadingCards() {
  return (
    <div className="space-y-4">
      <div className="h-36 bg-surface rounded-2xl border border-edge animate-pulse" />
      <div className="h-64 bg-surface rounded-2xl border border-edge animate-pulse" />
    </div>
  )
}
