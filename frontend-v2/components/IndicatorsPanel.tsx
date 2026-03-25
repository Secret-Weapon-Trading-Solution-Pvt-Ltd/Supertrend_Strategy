'use client'

import { useState } from 'react'
import { useMarket } from '@/store/MarketStore'
import { toggleIndicator, updateIndicatorSettings } from '@/lib/socket'

interface Props {
  open:    boolean
  onClose: () => void
}

export function IndicatorsPanel({ open, onClose }: Props) {
  const { state: market } = useMarket()

  const [stOpen,    setStOpen]    = useState(false)
  const [atrOpen,   setAtrOpen]   = useState(false)
  const [stLength,  setStLength]  = useState('10')
  const [stMult,    setStMult]    = useState('3.0')
  const [atrPeriod, setAtrPeriod] = useState('14')
  const [atrThresh, setAtrThresh] = useState('1.0')

  function applyStSettings() {
    updateIndicatorSettings({
      name:       'supertrend',
      length:     parseInt(stLength)    || 10,
      multiplier: parseFloat(stMult)    || 3.0,
    })
  }

  function applyAtrSettings() {
    updateIndicatorSettings({
      name:      'atr',
      period:    parseInt(atrPeriod)    || 14,
      threshold: parseFloat(atrThresh)  || 1.0,
    })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md rounded-2xl flex flex-col overflow-hidden animate-in"
          style={{
            background:     'var(--theme-glass-topbar)',
            border:         '1px solid var(--theme-glass-border-strong)',
            backdropFilter: 'blur(28px) saturate(180%)',
            boxShadow:      'var(--theme-glass-shadow)',
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
          >
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                Indicators
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                Configure and enable indicators
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Cards ───────────────────────────────────────────────────────── */}
          <div className="p-5 flex flex-col gap-3 overflow-y-auto">

            <IndicatorCard
              name="Supertrend"
              description="Trend direction & trailing stop"
              enabled={market.indicatorEnabled.supertrend}
              onToggle={() => toggleIndicator({ name: 'supertrend', enabled: !market.indicatorEnabled.supertrend })}
              expanded={stOpen}
              onExpand={() => setStOpen(v => !v)}
            >
              <SettingRow label="Length">
                <NumberInput value={stLength} onChange={setStLength} />
              </SettingRow>
              <SettingRow label="Multiplier">
                <NumberInput value={stMult} onChange={setStMult} step="0.1" />
              </SettingRow>
              <ApplyButton onClick={applyStSettings} />
            </IndicatorCard>

            <IndicatorCard
              name="ATR"
              description="Average True Range — volatility"
              enabled={market.indicatorEnabled.atr}
              onToggle={() => toggleIndicator({ name: 'atr', enabled: !market.indicatorEnabled.atr })}
              expanded={atrOpen}
              onExpand={() => setAtrOpen(v => !v)}
            >
              <SettingRow label="Period">
                <NumberInput value={atrPeriod} onChange={setAtrPeriod} />
              </SettingRow>
              <SettingRow label="Threshold">
                <NumberInput value={atrThresh} onChange={setAtrThresh} step="0.1" />
              </SettingRow>
              <ApplyButton onClick={applyAtrSettings} />
            </IndicatorCard>

          </div>
        </div>
      </div>
    </>
  )
}

// ── IndicatorCard ──────────────────────────────────────────────────────────────

function IndicatorCard({
  name, description, enabled, onToggle,
  expanded, onExpand, children,
}: {
  name:        string
  description: string
  enabled:     boolean
  onToggle:    () => void
  expanded:    boolean
  onExpand:    () => void
  children:    React.ReactNode
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--theme-glass-border)' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle on={enabled} onToggle={onToggle} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
            {name}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
            {description}
          </p>
        </div>
        <button
          onClick={onExpand}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-1 flex flex-col gap-3"
          style={{
            borderTop:  '1px solid var(--theme-glass-border)',
            background: 'var(--theme-glass-card)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-8 h-[18px] rounded-full transition-all shrink-0"
      style={{
        background: on ? 'var(--theme-accent)' : 'var(--theme-glass-card)',
        border:     `1px solid ${on ? 'var(--theme-accent-border)' : 'var(--theme-glass-border-strong)'}`,
        boxShadow:  on ? 'var(--theme-accent-glow)' : 'none',
      }}
    >
      <span
        className="absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all"
        style={{ left: on ? '15px' : '2px' }}
      />
    </button>
  )
}

// ── SettingRow ─────────────────────────────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

// ── NumberInput ────────────────────────────────────────────────────────────────

function NumberInput({ value, onChange, step }: {
  value:    string
  onChange: (v: string) => void
  step?:    string
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(e.target.value)}
      className="w-24 rounded-lg px-2.5 py-1.5 text-[11px] text-right tabular-nums focus:outline-none transition-all"
      style={{
        background: 'var(--theme-input-bg)',
        border:     '1px solid var(--theme-input-border)',
        color:      'var(--theme-input-text)',
      }}
    />
  )
}

// ── ApplyButton ────────────────────────────────────────────────────────────────

function ApplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 rounded-lg text-[11px] font-bold transition-all mt-1"
      style={{
        background: 'var(--theme-accent)',
        color:      '#fff',
        boxShadow:  'var(--theme-accent-glow)',
      }}
    >
      Apply
    </button>
  )
}
