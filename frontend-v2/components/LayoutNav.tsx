'use client'

import Link            from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth }     from '@/store/AuthStore'
import { logoutUser }  from '@/lib/api'

const NAV = [
  {
    href:        '/dashboard',
    label:       'Dashboard',
    description: 'Live engine & P&L',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/trades',
    label:       'Trades',
    description: 'History & stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/portfolio',
    label:       'Portfolio',
    description: 'Holdings & capital',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/logs',
    label:       'Logs',
    description: 'Live system log stream',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href:        '/dashboard/settings',
    label:       'Settings',
    description: 'Theme & preferences',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 shrink-0">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export function LayoutNav() {
  const pathname          = usePathname()
  const router            = useRouter()
  const { state: auth, logout } = useAuth()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    try {
      await logoutUser()   // invalidate Zerodha token + clear DB session
    } catch { /* ignore */ }
    logout()               // clear local React state

    // Redirect to Keycloak login page
    const keycloakUrl = 'http://localhost:8080/realms/SWTS/protocol/openid-connect/auth'
    const params = new URLSearchParams({
      client_id:     'swts-frontend',
      redirect_uri:  'http://localhost:3000',
      response_type: 'code',
    })
    window.location.href = `${keycloakUrl}?${params}`
  }

  const initials = auth.userName
    ? auth.userName.slice(0, 2).toUpperCase()
    : '?'

  return (
    <nav className="glass-panel shrink-0 w-72 flex flex-col overflow-y-auto">

      {/* Brand */}
      <div
        className="shrink-0 px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--theme-glass-border)' }}
      >
        {/* Logo icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'var(--theme-accent-soft)',
            border:     '1px solid var(--theme-accent-border)',
          }}
        >
          <svg viewBox="0 0 28 28" fill="none" className="w-5 h-5">
            <polyline
              points="2,20 8,13 14,16 22,7"
              stroke="var(--theme-accent)" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            />
            <circle cx="22" cy="7" r="2.5" fill="var(--theme-accent)" />
            <polyline
              points="2,24 6,20 10,22 16,17 22,19"
              stroke="var(--theme-profit)" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round"
              opacity="0.6"
            />
          </svg>
        </div>

        <p
          className="font-display text-xl font-black tracking-widest"
          style={{ color: 'var(--theme-accent)' }}
        >
          TrendEdge
        </p>
      </div>

      {/* Nav items */}
      <div className="flex-1 p-3 flex flex-col gap-1">
        {NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{
                background: active ? 'var(--theme-accent-soft)'   : 'transparent',
                border:     `1px solid ${active ? 'var(--theme-accent-border)' : 'transparent'}`,
              }}
            >
              {/* Icon */}
              <span style={{ color: active ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}>
                {item.icon}
              </span>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold leading-tight"
                  style={{ color: active ? 'var(--theme-accent)' : 'var(--theme-text-primary)' }}
                >
                  {item.label}
                </p>
                <p
                  className="text-2xs mt-0.5 truncate"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {item.description}
                </p>
              </div>

              {/* Active indicator dot */}
              {active && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--theme-accent)' }}
                />
              )}
            </Link>
          )
        })}
      </div>

      {/* User block */}
      <div
        className="shrink-0 px-4 py-4"
        style={{ borderTop: '1px solid var(--theme-glass-border)' }}
      >
        {/* Avatar + name row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar circle */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
            style={{
              background: 'var(--theme-accent-soft)',
              border:     '1px solid var(--theme-accent-border)',
              color:      'var(--theme-accent)',
            }}
          >
            {initials}
          </div>

          {/* Name + role */}
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold truncate leading-tight"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {auth.userName || 'User'}
            </p>
            <p
              className="text-2xs mt-0.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Trader
            </p>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={{
            background: 'var(--theme-loss-bg)',
            border:     '1px solid var(--theme-loss-border)',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-loss)' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-loss)' }}>
            Logout
          </span>
        </button>
      </div>

    </nav>
  )
}
