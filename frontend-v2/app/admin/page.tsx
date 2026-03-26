'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/AuthStore'
import AdminPanel from '@/components/admin/AdminPanel'

function hasAdminRole(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload?.realm_access?.roles ?? []).includes('admin')
  } catch {
    return false
  }
}

export default function AdminPage() {
  const { state: auth } = useAuth()
  const router = useRouter()
  const isAdmin = useMemo(() => hasAdminRole(auth.accessToken), [auth.accessToken])

  if (!auth.accessToken) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, color: '#64748b', fontSize: 15,
      }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <p>Session expired. Please <span style={{ color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push('/')}>log in again</span>.</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, color: '#f87171', fontSize: 15,
      }}>
        <div style={{ fontSize: 40 }}>⛔</div>
        <p>You need the <code style={{ color: '#818cf8' }}>admin</code> role to access this page.</p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0f172a', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⛨</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#e2e8f0' }}>Admin Panel</span>
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>TrendEdge</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          ← Dashboard
        </button>
      </div>

      <AdminPanel />
    </div>
  )
}
