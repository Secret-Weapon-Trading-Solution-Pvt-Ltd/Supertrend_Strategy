'use client'

// Root page — checks /status on load.
// Logged in  → redirect to /dashboard
// Logged out → show link to backend login

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStatus, authLogin } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasCode = params.has('code')

    // If Keycloak just redirected back with ?code=, trigger TOTP login first
    const loginFn = hasCode ? authLogin : getStatus

    loginFn()
      .then(status => {
        if (status.logged_in) {
          // Clean the ?code= from URL before navigating
          window.history.replaceState({}, '', '/')
          router.replace('/dashboard')
        } else {
          // Not logged in — redirect to Keycloak login
          const keycloakUrl = 'http://localhost:8080/realms/SWTS/protocol/openid-connect/auth'
          const kp = new URLSearchParams({
            client_id:     'swts-frontend',
            redirect_uri:  'http://localhost:3000',
            response_type: 'code',
          })
          window.location.href = `${keycloakUrl}?${kp}`
        }
      })
      .catch(err => {
        setError(err.message || 'Could not reach backend')
        setChecking(false)
      })
  }, [router])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Checking auth…
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-sm text-center shadow-sm">
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8 shrink-0">
            <rect width="36" height="36" rx="9" fill="#2563eb"/>
            <polyline points="7,26 13,18 20,21 29,11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="29" cy="11" r="2.5" fill="white"/>
          </svg>
          <h1 className="text-xl font-bold">TrendEdge</h1>
        </div>
        <p className="text-slate-500 text-sm mb-6">Supertrend & ATR Trading System</p>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <p className="text-sm text-slate-600 mb-4">
          Not logged in. Login via the backend — after OAuth completes, come back here.
        </p>

        <a
          href="http://localhost:8000"
          target="_blank"
          rel="noreferrer"
          className="block w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Login with Zerodha →
        </a>

        <button
          onClick={() => { setChecking(true); setError(''); getStatus().then(s => { if (s.logged_in) router.replace('/dashboard'); else setChecking(false) }).catch(e => { setError(e.message); setChecking(false) }) }}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          I&apos;ve logged in — check again
        </button>
      </div>
    </div>
  )
}
