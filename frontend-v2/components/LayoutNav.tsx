'use client'

import Link            from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href:        '/dashboard',
    label:       'Dashboard',
    description: 'Live engine & P&L',
    accent:      'text-brand-600',
    activeBg:    'bg-brand-50 border-brand-200',
    dot:         'bg-brand-500',
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
    accent:      'text-trades-600',
    activeBg:    'bg-trades-50 border-trades-100',
    dot:         'bg-trades-500',
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
    accent:      'text-portfolio-600',
    activeBg:    'bg-portfolio-50 border-portfolio-100',
    dot:         'bg-portfolio-500',
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
    accent:      'text-settings-600',
    activeBg:    'bg-settings-50 border-settings-100',
    dot:         'bg-settings-500',
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
]

export function LayoutNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <nav className="shrink-0 w-64 bg-surface border-r border-edge flex flex-col overflow-y-auto">

      {/* Nav items */}
      <div className="flex-1 p-3 flex flex-col gap-1">
        <p className="text-2xs font-bold text-ghost uppercase tracking-widest px-2 py-2">Pages</p>

        {NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                ${active
                  ? `${item.activeBg} ${item.accent}`
                  : 'border-transparent text-muted hover:bg-sunken hover:text-ink'
                }
              `}
            >
              <span className={active ? item.accent : 'text-subtle'}>
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold leading-tight ${active ? item.accent : 'text-ink'}`}>
                  {item.label}
                </p>
                <p className="text-2xs text-subtle mt-0.5 truncate">{item.description}</p>
              </div>
              {active && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />}
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-edge">
        <p className="text-2xs text-ghost">Supertrend Trading System</p>
      </div>
    </nav>
  )
}
