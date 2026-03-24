'use client'

import { useState } from 'react'
import { useMarket } from '@/store/MarketStore'
import { toggleIndicator, updateIndicatorSettings } from '@/lib/socket'

interface Props {
  open: boolean
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
      name: 'supertrend',
      length: parseInt(stLength) || 10,
      multiplier: parseFloat(stMult) || 3.0,
    })
  }
  function applyAtrSettings() {
    updateIndicatorSettings({
      name: 'atr',
      period: parseInt(atrPeriod) || 14,
      threshold: parseFloat(atrThresh) || 1.0,
    })
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-800">Indicators</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Configure and enable indicators</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col gap-3">

            {/* Supertrend */}
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

            {/* ATR */}
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function IndicatorCard({
  name, description, enabled, onToggle,
  expanded, onExpand, children,
}: {
  name: string
  description: string
  enabled: boolean
  onToggle: () => void
  expanded: boolean
  onExpand: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle on={enabled} onToggle={onToggle} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-slate-800">{name}</p>
          <p className="text-[10px] text-slate-400 truncate">{description}</p>
        </div>
        <button
          onClick={onExpand}
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Settings */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 ${
        on ? 'bg-blue-500' : 'bg-slate-200 border border-slate-300'
      }`}
    >
      <span className={`absolute top-[3px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${
        on ? 'left-[17px]' : 'left-[3px]'
      }`} />
    </button>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, step }: { value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(e.target.value)}
      className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 text-right tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
    />
  )
}

function ApplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors mt-1"
    >
      Apply
    </button>
  )
}
