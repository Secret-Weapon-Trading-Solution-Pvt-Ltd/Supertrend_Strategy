'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href:  '/dashboard',
    label: 'Trading',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    href:  '/dashboard/trades',
    label: 'Trades',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    href:  '/dashboard/portfolio',
    label: 'Portfolio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href:  '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

// Active colour per route
const ACCENT: Record<string, string> = {
  '/dashboard':           'text-brand-600   bg-brand-50',
  '/dashboard/trades':    'text-trades-600  bg-trades-50',
  '/dashboard/portfolio': 'text-portfolio-600 bg-portfolio-50',
  '/dashboard/settings':  'text-settings-600  bg-settings-50',
}

export function SideNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav className="shrink-0 w-[60px] bg-surface border-r border-edge flex flex-col items-center py-3 gap-1">
      {NAV.map(item => {
        const active = isActive(item.href)
        const accent = ACCENT[item.href] ?? 'text-brand-600 bg-brand-50'
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`
              group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150
              ${active
                ? accent
                : 'text-subtle hover:text-muted hover:bg-sunken'
              }
            `}
          >
            {item.icon}

            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap
              bg-ink text-surface text-xs font-medium px-2 py-1 rounded-md shadow-pop
              opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-50">
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
