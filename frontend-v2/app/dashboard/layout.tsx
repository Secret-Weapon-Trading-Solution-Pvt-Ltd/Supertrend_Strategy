'use client'

import { useEffect, type ReactNode } from 'react'
import { LayoutNav } from '@/components/LayoutNav'
import { connectSocket, disconnectSocket } from '@/lib/socket'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased">
      <LayoutNav />
      {children}
    </div>
  )
}
