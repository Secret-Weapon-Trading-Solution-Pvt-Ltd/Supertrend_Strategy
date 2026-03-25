'use client'

import { useEffect, useState } from 'react'
import { getHoldings, getPositions } from '@/lib/api'
import type {
  HoldingsResponse, PositionsResponse,
  LiveHolding, ForwardTestHolding,
  LivePosition, ForwardTestPosition,
} from '@/types/types'

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
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-8 py-6"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: 'var(--theme-accent)' }}>
              Account
            </p>
            <h1 className="font-display text-3xl font-bold"
              style={{ color: 'var(--theme-text-primary)' }}>
              Portfolio
            </h1>
          </div>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={isLive ? {
              color:      'var(--theme-loss)',
              background: 'var(--theme-loss-bg)',
              border:     '1px solid var(--theme-loss-border)',
            } : {
              color:      'var(--theme-accent)',
              background: 'var(--theme-accent-soft)',
              border:     '1px solid var(--theme-accent-border)',
            }}
          >
            {isLive ? '⚡ Live' : '◎ Simulation'}
          </span>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {loading ? (
          <LoadingCards />
        ) : (
          <>
            {/* Forward test summary */}
            {!isLive && holdings && (
              <ForwardSummaryCard data={holdings.holdings[0] as ForwardTestHolding} />
            )}

            {/* Live holdings table */}
            {isLive && holdings && (holdings.holdings as LiveHolding[]).length > 0 && (
              <section>
                <SectionHeader>Holdings</SectionHeader>
                <GlassTable
                  headers={['Symbol', 'Exchange', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Day %', 'Value']}
                >
                  {(holdings.holdings as LiveHolding[]).map(h => (
                    <GlassRow key={h.isin}>
                      <td className="px-4 py-3 text-sm font-semibold"
                        style={{ color: 'var(--theme-text-primary)' }}>{h.symbol}</td>
                      <td className="px-4 py-3 text-xs"
                        style={{ color: 'var(--theme-text-muted)' }}>{h.exchange}</td>
                      <td className="px-4 py-3 text-sm tabular-nums"
                        style={{ color: 'var(--theme-text-primary)' }}>{h.quantity}</td>
                      <td className="px-4 py-3 text-sm tabular-nums font-mono"
                        style={{ color: 'var(--theme-text-primary)' }}>₹{h.avg_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm tabular-nums font-mono"
                        style={{ color: 'var(--theme-text-primary)' }}>₹{h.last_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm tabular-nums font-bold font-mono"
                        style={{ color: h.pnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                        {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums font-semibold"
                        style={{ color: h.day_change_pct >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                        {h.day_change_pct >= 0 ? '+' : ''}{h.day_change_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums font-mono"
                        style={{ color: 'var(--theme-text-primary)' }}>₹{h.current_value.toFixed(2)}</td>
                    </GlassRow>
                  ))}
                </GlassTable>
              </section>
            )}

            {/* Positions */}
            {positions && positions.positions.length > 0 && (
              <section>
                <SectionHeader>Open Positions</SectionHeader>
                {isLive ? (
                  <GlassTable
                    headers={['Symbol', 'Exchange', 'Qty', 'Avg Price', 'LTP', 'P&L', 'M2M', 'Product']}
                  >
                    {(positions.positions as LivePosition[]).map(p => (
                      <GlassRow key={p.symbol}>
                        <td className="px-4 py-3 text-sm font-semibold"
                          style={{ color: 'var(--theme-text-primary)' }}>{p.symbol}</td>
                        <td className="px-4 py-3 text-xs"
                          style={{ color: 'var(--theme-text-muted)' }}>{p.exchange}</td>
                        <td className="px-4 py-3 text-sm tabular-nums"
                          style={{ color: 'var(--theme-text-primary)' }}>{p.quantity}</td>
                        <td className="px-4 py-3 text-sm tabular-nums font-mono"
                          style={{ color: 'var(--theme-text-primary)' }}>₹{p.avg_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums font-mono"
                          style={{ color: 'var(--theme-text-primary)' }}>₹{p.last_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums font-bold font-mono"
                          style={{ color: p.pnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                          {p.pnl >= 0 ? '+' : ''}₹{p.pnl.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums font-semibold font-mono"
                          style={{ color: p.m2m >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)' }}>
                          {p.m2m >= 0 ? '+' : ''}₹{p.m2m.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs"
                          style={{ color: 'var(--theme-text-muted)' }}>{p.product}</td>
                      </GlassRow>
                    ))}
                  </GlassTable>
                ) : (
                  <div
                    className="rounded-2xl p-6 space-y-3"
                    style={{
                      background:     'var(--theme-glass-card)',
                      border:         '1px solid var(--theme-glass-border)',
                      backdropFilter: 'blur(20px) saturate(160%)',
                    }}
                  >
                    {(positions.positions as ForwardTestPosition[]).map((p, i, arr) => (
                      <div
                        key={p.order_id}
                        className="flex items-center justify-between py-3"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--theme-glass-border)' : 'none' }}
                      >
                        <div>
                          <p className="text-sm font-semibold"
                            style={{ color: 'var(--theme-text-primary)' }}>{p.symbol}</p>
                          <p className="text-xs mt-0.5"
                            style={{ color: 'var(--theme-text-muted)' }}>
                            Entry {p.entry_time?.slice(0, 19).replace('T', ' ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm tabular-nums font-mono font-bold"
                            style={{ color: 'var(--theme-text-primary)' }}>
                            ₹{p.entry_price.toFixed(2)}
                          </p>
                          <p className="text-xs"
                            style={{ color: 'var(--theme-text-muted)' }}>
                            {p.qty} qty · peak ₹{p.peak_price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Empty state */}
            {!loading && positions?.positions.length === 0 &&
              (!isLive || (holdings?.holdings as LiveHolding[])?.length === 0) && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <span className="text-5xl" style={{ color: 'var(--theme-text-ghost)' }}>◎</span>
                <p className="text-base font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                  No portfolio data
                </p>
                <p className="text-sm" style={{ color: 'var(--theme-text-ghost)' }}>
                  Connect to your broker to see holdings
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── ForwardSummaryCard ────────────────────────────────────────────────────────

function ForwardSummaryCard({ data }: { data: ForwardTestHolding | undefined }) {
  if (!data) return null
  const pnlPct  = data.initial_capital
    ? ((data.total_pnl / data.initial_capital) * 100).toFixed(2)
    : '0.00'
  const winRate = data.total_trades
    ? Math.round((data.wins / data.total_trades) * 100)
    : 0

  return (
    <div
      className="glass-card rounded-2xl p-6"
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-5"
        style={{ color: 'var(--theme-accent)' }}>
        Simulation Summary
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <BigStat label="Capital"   value={`₹${data.initial_capital.toLocaleString()}`} />
        <BigStat label="Available" value={`₹${data.available_capital.toLocaleString()}`} />
        <BigStat
          label="Total P&L"
          value={`${data.total_pnl >= 0 ? '+' : ''}₹${data.total_pnl.toFixed(2)}`}
          valueColor={data.total_pnl >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)'}
          glow={data.total_pnl >= 0 ? 'var(--theme-profit-glow)' : 'var(--theme-loss-glow)'}
        />
        <BigStat
          label="Return"
          value={`${Number(pnlPct) >= 0 ? '+' : ''}${pnlPct}%`}
          valueColor={Number(pnlPct) >= 0 ? 'var(--theme-profit)' : 'var(--theme-loss)'}
        />
        <BigStat label="Trades"   value={String(data.total_trades)} />
        <BigStat label="Win Rate" value={`${winRate}%`} valueColor="var(--theme-accent)" />
      </div>
    </div>
  )
}

// ── GlassTable ────────────────────────────────────────────────────────────────

function GlassTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
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
            {headers.map(h => (
              <th
                key={h}
                className="text-left px-4 py-3 text-2xs font-bold uppercase tracking-widest"
                style={{ color: 'var(--theme-text-ghost)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function GlassRow({ children }: { children: React.ReactNode }) {
  return (
    <tr
      style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-accent-soft)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}

// ── BigStat ───────────────────────────────────────────────────────────────────

function BigStat({ label, value, valueColor, glow }: {
  label:       string
  value:       string
  valueColor?: string
  glow?:       string
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest mb-1.5"
        style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </p>
      <p
        className="font-display text-xl font-bold tabular-nums"
        style={{ color: valueColor ?? 'var(--theme-text-primary)', textShadow: glow ?? 'none' }}
      >
        {value}
      </p>
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-base font-bold mb-3"
      style={{ color: 'var(--theme-text-primary)' }}>
      {children}
    </h2>
  )
}

// ── LoadingCards ──────────────────────────────────────────────────────────────

function LoadingCards() {
  return (
    <div className="space-y-4">
      {[36, 64].map(h => (
        <div
          key={h}
          className={`h-${h} rounded-2xl animate-pulse`}
          style={{
            background:     'var(--theme-glass-card)',
            border:         '1px solid var(--theme-glass-border)',
            backdropFilter: 'blur(20px)',
          }}
        />
      ))}
    </div>
  )
}
