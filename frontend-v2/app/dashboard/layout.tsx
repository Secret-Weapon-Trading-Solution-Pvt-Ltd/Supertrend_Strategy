'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LayoutNav } from '@/components/LayoutNav'
import { connectSocket, disconnectSocket } from '@/lib/socket'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [])

  // Close nav on route change (when a link is clicked inside nav on mobile)
  function closeNav() { setNavOpen(false) }

  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased">

      {/* ── Mobile overlay — dims content behind open sidebar ── */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={closeNav}
        />
      )}

      {/* ── Sidebar — slides in on mobile, always visible on desktop ── */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <LayoutNav onClose={closeNav} />
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Mobile topbar — hamburger + brand, hidden on desktop */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 h-14 lg:hidden"
          style={{
            borderBottom: '1px solid var(--theme-glass-border)',
            background:   'var(--theme-glass-topbar)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <button
            onClick={() => setNavOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{
              background: 'var(--theme-glass-card)',
              border:     '1px solid var(--theme-glass-border)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className="w-5 h-5" style={{ color: 'var(--theme-text-primary)' }}>
              <line x1="3" y1="6"  x2="21" y2="6"  strokeLinecap="round" />
              <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
              <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
            </svg>
          </button>

          <p
            className="font-display text-lg font-black tracking-widest"
            style={{ color: 'var(--theme-accent)' }}
          >
            TrendEdge
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
