'use client'

import type { ReactNode } from 'react'
import { LayoutNav } from '@/components/LayoutNav'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased">
      <LayoutNav />
      {children}
    </div>
  )
}
