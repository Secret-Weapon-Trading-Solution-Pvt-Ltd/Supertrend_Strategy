'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Timeframe } from '@/types/types'

type Category = 'All' | 'Minutes' | 'Hours' | 'Daily'

function getCategory(tf: Timeframe): Exclude<Category, 'All'> {
  if (tf.minutes < 60)   return 'Minutes'
  if (tf.minutes < 1440) return 'Hours'
  return 'Daily'
}

const CATEGORIES: Category[] = ['All', 'Minutes', 'Hours', 'Daily']

// Per-category color tokens
const CAT_COLORS: Record<Exclude<Category, 'All'>, { text: string; bg: string; border: string }> = {
  Minutes: { text: 'var(--theme-accent)',  bg: 'var(--theme-accent-soft)',  border: 'var(--theme-accent-border)'  },
  Hours:   { text: 'var(--theme-profit)',  bg: 'var(--theme-profit-bg)',    border: 'var(--theme-profit-border)'  },
  Daily:   { text: 'var(--theme-warn)',    bg: 'var(--theme-warn-bg)',      border: 'var(--theme-warn-border)'    },
}

interface Props {
  selected:   Timeframe | null
  timeframes: Timeframe[]
  onSelect:   (tf: Timeframe) => void
}

export function TimeframeSelector({ selected, timeframes, onSelect }: Props) {
  const [open,     setOpen]     = useState(false)
  const [category, setCategory] = useState<Category>('All')

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  function handleSelect(tf: Timeframe) {
    onSelect(tf)
    setOpen(false)
  }

  const filtered = category === 'All'
    ? timeframes
    : timeframes.filter(tf => getCategory(tf) === category)

  const availableCategories = CATEGORIES.filter(c =>
    c === 'All' || timeframes.some(tf => getCategory(tf) === c)
  )

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 h-11 px-5 rounded-xl transition-all min-w-[148px]"
        style={{
          background: open ? 'var(--theme-accent-soft)' : 'transparent',
          border:     `1px solid ${open ? 'var(--theme-accent-border)' : 'var(--theme-glass-border)'}`,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
          className="w-4 h-4 shrink-0"
          style={{ color: open ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </svg>
        <span className="text-[15px] font-medium flex-1 text-left"
          style={{ color: selected ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)' }}>
          {selected?.label ?? 'Timeframe'}
        </span>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}
          style={{ color: 'var(--theme-text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Modal — portalled to <body> ─────────────────────────────────────── */}
      {open && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[200] backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setOpen(false)}
          />

          {/* Centred panel */}
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-6 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-md rounded-3xl overflow-hidden"
              style={{
                background:     'var(--theme-glass-topbar)',
                border:         '1px solid var(--theme-glass-border-strong)',
                backdropFilter: 'blur(32px) saturate(180%)',
                boxShadow:      'var(--theme-glass-shadow)',
              }}
            >

              {/* ── Header ────────────────────────────────────────────────── */}
              <div
                className="flex items-center justify-between px-6 pt-6 pb-5"
                style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Icon box */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'var(--theme-accent-soft)',
                      border:     '1px solid var(--theme-accent-border)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                      className="w-5 h-5"
                      style={{ color: 'var(--theme-accent)' }}>
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold tracking-tight"
                      style={{ color: 'var(--theme-text-primary)' }}>
                      Select Timeframe
                    </p>
                    <p className="text-xs mt-0.5 font-normal"
                      style={{ color: 'var(--theme-text-muted)' }}>
                      Choose your chart interval
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                  style={{
                    color:      'var(--theme-text-muted)',
                    background: 'var(--theme-glass-card)',
                    border:     '1px solid var(--theme-glass-border)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ── Category filter ────────────────────────────────────────── */}
              <div className="px-6 pt-4 pb-2 flex gap-2">
                {availableCategories.map(c => {
                  const active = category === c
                  const colors = c !== 'All' ? CAT_COLORS[c] : null
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className="flex-1 py-2.5 px-3 rounded-xl text-xs font-medium tracking-wide transition-all"
                      style={{
                        background: active
                          ? (colors?.bg  ?? 'var(--theme-accent-soft)')
                          : 'transparent',
                        border: `1px solid ${active
                          ? (colors?.border ?? 'var(--theme-accent-border)')
                          : 'var(--theme-glass-border)'}`,
                        color: active
                          ? (colors?.text ?? 'var(--theme-accent)')
                          : 'var(--theme-text-ghost)',
                      }}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>

              {/* ── Timeframe grid ─────────────────────────────────────────── */}
              <div className="px-6 pt-3 pb-6">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                      className="w-10 h-10" style={{ color: 'var(--theme-text-ghost)' }}>
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 15" />
                    </svg>
                    <p className="text-sm font-normal" style={{ color: 'var(--theme-text-muted)' }}>
                      No timeframes in this category
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {filtered.map(tf => {
                      const active = selected?.interval === tf.interval
                      const cat    = getCategory(tf)
                      const colors = CAT_COLORS[cat]

                      return (
                        <button
                          key={tf.interval}
                          onClick={() => handleSelect(tf)}
                          className="relative flex flex-col items-center justify-center gap-2 rounded-2xl py-5 px-3 transition-all"
                          style={{
                            background: active ? colors.bg   : 'var(--theme-glass-card)',
                            border:     `1.5px solid ${active ? colors.border : 'var(--theme-glass-border)'}`,
                            boxShadow:  active ? `0 4px 20px -4px ${colors.bg}` : 'none',
                          }}
                          onMouseEnter={e => {
                            if (!active) e.currentTarget.style.border = `1.5px solid ${colors.border}`
                          }}
                          onMouseLeave={e => {
                            if (!active) e.currentTarget.style.border = '1.5px solid var(--theme-glass-border)'
                          }}
                        >
                          {/* Active indicator dot */}
                          {active && (
                            <span
                              className="absolute top-2 right-2 w-2 h-2 rounded-full"
                              style={{ background: colors.text, boxShadow: `0 0 6px ${colors.text}` }}
                            />
                          )}

                          {/* Label — e.g. "1m", "4h" */}
                          <span
                            className="text-xl font-semibold tabular-nums leading-none"
                            style={{ color: active ? colors.text : 'var(--theme-text-primary)' }}
                          >
                            {tf.label}
                          </span>

                          {/* Unit sub-label */}
                          <span
                            className="text-[11px] font-normal leading-none"
                            style={{ color: active ? colors.text : 'var(--theme-text-ghost)', opacity: active ? 0.85 : 0.6 }}
                          >
                            {cat === 'Minutes' ? 'minutes' : cat === 'Hours' ? 'hours' : 'days'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Footer hint ────────────────────────────────────────────── */}
              <div
                className="px-6 py-3 flex items-center gap-2"
                style={{ borderTop: '1px solid var(--theme-glass-border)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
                  className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-text-ghost)' }}>
                  <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs font-normal" style={{ color: 'var(--theme-text-ghost)' }}>
                  Press <kbd className="px-1.5 py-0.5 rounded text-[11px]"
                    style={{ background: 'var(--theme-glass-card)', border: '1px solid var(--theme-glass-border)', color: 'var(--theme-text-muted)' }}>
                    Esc
                  </kbd> to close
                </p>
              </div>

            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
