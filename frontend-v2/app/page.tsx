'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStatus, authLogin } from '@/lib/api'

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080'
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL      || 'http://localhost:3000'

export default function HomePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasCode = params.has('code')

    const loginFn = hasCode ? authLogin : getStatus

    loginFn()
      .then(status => {
        if (status.logged_in) {
          window.history.replaceState({}, '', '/')
          router.replace('/dashboard')
        } else {
          const kp = new URLSearchParams({
            client_id:     'swts-frontend',
            redirect_uri:  APP_URL,
            response_type: 'code',
          })
          window.location.href = `${KEYCLOAK_URL}/realms/SWTS/protocol/openid-connect/auth?${kp}`
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
        <h1 className="text-xl font-bold mb-1">TrendEdge</h1>
        <p className="text-slate-500 text-sm mb-4">Supertrend & ATR Trading System</p>
        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        <button
          onClick={() => { setChecking(true); setError(''); getStatus().then(s => { if (s.logged_in) router.replace('/dashboard'); else setChecking(false) }).catch(e => { setError(e.message); setChecking(false) }) }}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Check again
        </button>
      </div>
    </div>
  )
}
