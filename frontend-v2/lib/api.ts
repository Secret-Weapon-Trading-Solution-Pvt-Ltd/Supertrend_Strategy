// ─────────────────────────────────────────────────────────────────────────────
// SWTS — REST API Client
//
// Axios instance pointing to the FastAPI backend.
// All REST calls go through this file — no fetch() scattered in components.
//
// Endpoints covered:
//   GET  /status                  — auth check + ticker status
//   GET  /api/timeframes          — list active timeframes
//   GET  /api/instruments         — search instruments
//   GET  /api/instruments/:token  — single instrument by token
//   GET  /api/trades              — completed trade history
//   GET  /api/holdings            — holdings (live or forward test)
//   GET  /api/positions           — open positions
//   GET  /api/forward/summary     — forward test P&L summary
//   GET  /ticker/status           — KiteTicker connection state
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'
import type {
  StatusResponse,
  Timeframe,
  Instrument,
  Trade,
  HoldingsResponse,
  PositionsResponse,
  ForwardSummaryResponse,
  TickerStatus,
  Exchange,
  InstrumentType,
} from '@/types/types'

// ── Axios instance ────────────────────────────────────────────────────────────
// In dev:  BASE_URL is '' (empty) → requests use relative paths → Next.js
//          rewrites them to http://localhost:8000 via next.config.ts.
// In prod: set NEXT_PUBLIC_BACKEND_URL=https://your-api.example.com in .env.local
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Response interceptor — unified error logging ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const raw =
      error.response?.data?.detail ??
      error.response?.data?.message ??
      error.message ??
      'Unknown error'
    const message = typeof raw === 'string' ? raw : JSON.stringify(raw)
    console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} — ${message}`)
    return Promise.reject(new Error(message))
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Check if user is logged in and get ticker status.
 * Used on app load to decide: show login page or go to dashboard.
 */
export async function getStatus(): Promise<StatusResponse> {
  const res = await api.get<StatusResponse>('/status')
  return res.data
}

/**
 * Logout — invalidates Zerodha token and clears DB session.
 * Uses axios directly (bypasses Next.js proxy rewrite).
 */
export async function logoutUser(): Promise<void> {
  await api.get('/logout')
}

/**
 * Trigger TOTP auto-login after Keycloak redirects back.
 * Called once when ?code= is detected in the URL.
 */
export async function authLogin(): Promise<StatusResponse> {
  const res = await api.post<StatusResponse>('/auth/login')
  return res.data
}

// ── Market Reference Data ─────────────────────────────────────────────────────

/**
 * Fetch all active timeframes ordered by duration.
 * Loaded once on app start — used to populate the timeframe dropdown.
 */
export async function getTimeframes(): Promise<Timeframe[]> {
  const res = await api.get<Timeframe[]>('/api/timeframes')
  return res.data
}

/**
 * Search instruments by symbol, company name, or strike price.
 * Called on every keystroke in the symbol search input (debounced in component).
 */
export async function searchInstruments(params: {
  query:    string
  exchange?: Exchange
  segment?: string
  type?:    InstrumentType
  limit?:   number
}): Promise<Instrument[]> {
  const res = await api.get<Instrument[]>('/api/instruments', { params })
  return res.data
}

/**
 * Get a single instrument by its instrument token.
 */
export async function getInstrumentByToken(token: number): Promise<Instrument> {
  const res = await api.get<Instrument>(`/api/instruments/${token}`)
  return res.data
}

// ── Trades ────────────────────────────────────────────────────────────────────

/**
 * Fetch completed trade history from DB, newest first.
 * Default limit: 100, max: 500.
 */
export async function getTrades(limit = 100): Promise<Trade[]> {
  const res = await api.get<Trade[]>('/api/trades', { params: { limit } })
  return res.data
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

/**
 * Fetch holdings.
 * Live mode       → real DEMAT holdings from Zerodha
 * Forward test    → virtual capital summary
 */
export async function getHoldings(): Promise<HoldingsResponse> {
  const res = await api.get<HoldingsResponse>('/api/holdings')
  return res.data
}

/**
 * Fetch open positions.
 * Live mode       → real net positions from Zerodha
 * Forward test    → virtual open position from ForwardTestBroker
 */
export async function getPositions(): Promise<PositionsResponse> {
  const res = await api.get<PositionsResponse>('/api/positions')
  return res.data
}

/**
 * Fetch forward test P&L summary.
 * Only meaningful when broker_mode = "forward_test" and engine is running.
 */
export async function getForwardSummary(): Promise<ForwardSummaryResponse> {
  const res = await api.get<ForwardSummaryResponse>('/api/forward/summary')
  return res.data
}

// ── Ticker ────────────────────────────────────────────────────────────────────

/**
 * Fetch KiteTicker WebSocket connection state.
 * Shows connected status + subscribed tokens in the topbar.
 */
export async function getTickerStatus(): Promise<TickerStatus> {
  const res = await api.get<TickerStatus>('/ticker/status')
  return res.data
}
