import type { NextConfig } from 'next'

// ─────────────────────────────────────────────────────────────────────────────
// SWTS — Next.js config
//
// Dev proxy: REST calls use relative paths (no host) so Next.js intercepts
// them and rewrites to the FastAPI backend at BACKEND_ORIGIN.
//
// Socket.IO connects directly to NEXT_PUBLIC_BACKEND_URL (set in .env.local)
// because WebSocket upgrades bypass the Next.js proxy.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://localhost:8000'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Auth + status
      {
        source:      '/status',
        destination: `${BACKEND_ORIGIN}/status`,
      },
      {
        source:      '/logout',
        destination: `${BACKEND_ORIGIN}/logout`,
      },
      // KiteTicker REST endpoints
      {
        source:      '/ticker/:path*',
        destination: `${BACKEND_ORIGIN}/ticker/:path*`,
      },
      // All /api/* routes (instruments, timeframes, trades, holdings, positions, forward)
      {
        source:      '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
