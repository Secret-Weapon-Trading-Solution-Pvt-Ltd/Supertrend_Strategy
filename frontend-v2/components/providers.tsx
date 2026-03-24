'use client'

// Required wrapper — layout.tsx is a server component and cannot use
// 'use client' itself, so all context providers live here.

import { AuthProvider }   from '@/store/AuthStore'
import { EngineProvider } from '@/store/EngineStore'
import { MarketProvider } from '@/store/MarketStore'
import { TradeProvider }  from '@/store/TradeStore'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EngineProvider>
        <MarketProvider>
          <TradeProvider>
            {children}
          </TradeProvider>
        </MarketProvider>
      </EngineProvider>
    </AuthProvider>
  )
}
