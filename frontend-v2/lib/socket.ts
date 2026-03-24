// ─────────────────────────────────────────────────────────────────────────────
// SWTS — Socket.IO Client Singleton
//
// Single connection to the FastAPI + Socket.IO backend.
// Receives all backend events → pipes into eventBus.
// Exposes typed helper functions for sending commands to the backend.
//
// Usage:
//   import { socket, startEngine, stopEngine } from '@/lib/socket'
//
// Architecture:
//   Backend (FastAPI Socket.IO)
//       ↓  socket events
//   socket.ts  →  eventBus.emit(EVENTS.XXX, payload)
//       ↓
//   AppStore (subscribes to eventBus → updates state)
//       ↓
//   UI Components (read from context)
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client'
import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import type {
  EngineStartPayload,
  ModeSwitchPayload,
  IndicatorTogglePayload,
  IndicatorSettingsPayload,
  IndicatorsSubscribePayload,
  TickPayload,
  SignalBuyPayload,
  OrderPlacedPayload,
  ExitTriggeredPayload,
  PositionUpdatePayload,
  EngineStatePayload,
  IndicatorsDataPayload,
  LogPayload,
  IndicatorStatePayload,
  IndicatorSettingsAppliedPayload,
  ModeStatePayload,
  ErrorPayload,
} from '@/types/types'

// ── Backend URL ───────────────────────────────────────────────────────────────
// In dev: Next.js proxies /api/* to backend, but Socket.IO needs direct URL
// In prod: set NEXT_PUBLIC_BACKEND_URL in .env.local
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// ── Socket.IO singleton ───────────────────────────────────────────────────────
// autoConnect: false — we connect manually so we control timing
let socket: Socket | null = null

function getSocket(): Socket {
  // Guard: socket.io-client requires browser APIs (window, WebSocket).
  // Next.js App Router runs code on the server during SSR — bail out early.
  // Always call socket helpers inside useEffect or event handlers only.
  if (typeof window === 'undefined') {
    throw new Error('[Socket] getSocket() called on the server — use only in useEffect or client event handlers')
  }
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect:          false,
      transports:           ['websocket'],  // skip long-polling, go straight to WS
      reconnection:         true,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    })
    _registerEventHandlers(socket)
  }
  return socket
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────

export function connectSocket(): void {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket(): void {
  socket?.disconnect()
}

// ── Register all backend → eventBus handlers ─────────────────────────────────

function _registerEventHandlers(s: Socket): void {

  // ── Connection lifecycle ──────────────────────────────────────────────────
  s.on('connect', () => {
    console.info('[Socket] Connected — sid:', s.id)
    eventBus.emit(EVENTS.WS_CONNECTED, undefined)
  })

  s.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected —', reason)
    eventBus.emit(EVENTS.WS_DISCONNECTED, undefined)
  })

  s.on('connect_error', (err) => {
    console.error('[Socket] Connection error —', err.message)
    eventBus.emit(EVENTS.SOCKET_ERROR, { message: err.message })
  })

  // ── Engine events ─────────────────────────────────────────────────────────

  s.on('tick', (data: TickPayload) => {
    eventBus.emit(EVENTS.TICK_RECEIVED, data)
  })

  s.on('signal:buy', (data: SignalBuyPayload) => {
    eventBus.emit(EVENTS.SIGNAL_BUY, data)
  })

  s.on('order:placed', (data: OrderPlacedPayload) => {
    eventBus.emit(EVENTS.ORDER_PLACED, data)
  })

  s.on('exit:triggered', (data: ExitTriggeredPayload) => {
    eventBus.emit(EVENTS.EXIT_TRIGGERED, data)
  })

  s.on('position:update', (data: PositionUpdatePayload) => {
    eventBus.emit(EVENTS.POSITION_UPDATE, data)
  })

  s.on('engine:state', (data: EngineStatePayload) => {
    eventBus.emit(EVENTS.ENGINE_STATE_CHANGED, data)
  })

  // ── Indicators stream ─────────────────────────────────────────────────────

  s.on('indicators:data', (data: IndicatorsDataPayload) => {
    eventBus.emit(EVENTS.INDICATORS_DATA, data)
  })

  // ── Indicator toggle / settings confirmation ──────────────────────────────

  s.on('indicator:state', (data: IndicatorStatePayload) => {
    eventBus.emit(EVENTS.INDICATOR_STATE, data)
  })

  s.on('indicator:settings:applied', (data: IndicatorSettingsAppliedPayload) => {
    eventBus.emit(EVENTS.INDICATOR_SETTINGS_APPLIED, data)
  })

  // ── Mode confirmation ─────────────────────────────────────────────────────

  s.on('mode:state', (data: ModeStatePayload) => {
    eventBus.emit(EVENTS.MODE_STATE, data)
  })

  // ── Logs ──────────────────────────────────────────────────────────────────

  s.on('log', (data: LogPayload) => {
    eventBus.emit(EVENTS.LOG_RECEIVED, data)
  })

  // ── Backend errors ────────────────────────────────────────────────────────

  s.on('error', (data: ErrorPayload) => {
    console.error('[Socket] Backend error —', data.message)
    eventBus.emit(EVENTS.SOCKET_ERROR, data)
  })
}

// ── Engine command helpers (client → server) ──────────────────────────────────

export function startEngine(payload: EngineStartPayload): void {
  getSocket().emit('engine:start', payload)
  eventBus.emit(EVENTS.ENGINE_START, payload)
}

export function stopEngine(): void {
  getSocket().emit('engine:stop', {})
  eventBus.emit(EVENTS.ENGINE_STOP, undefined)
}

export function pauseEngine(): void {
  getSocket().emit('engine:pause', {})
  eventBus.emit(EVENTS.ENGINE_PAUSE, undefined)
}

export function resumeEngine(): void {
  getSocket().emit('engine:resume', {})
  eventBus.emit(EVENTS.ENGINE_RESUME, undefined)
}

// ── Indicator helpers ─────────────────────────────────────────────────────────

export function toggleIndicator(payload: IndicatorTogglePayload): void {
  getSocket().emit('indicator:toggle', payload)
  eventBus.emit(EVENTS.INDICATOR_TOGGLED, payload)
}

export function updateIndicatorSettings(payload: IndicatorSettingsPayload): void {
  getSocket().emit('indicator:settings', payload)
  eventBus.emit(EVENTS.INDICATOR_SETTINGS, payload)
}

// ── Mode helper ───────────────────────────────────────────────────────────────

export function switchMode(payload: ModeSwitchPayload): void {
  getSocket().emit('mode:switch', payload)
  eventBus.emit(EVENTS.MODE_CHANGED, payload)
}

// ── Indicators subscription helpers ──────────────────────────────────────────

export function subscribeIndicators(payload: IndicatorsSubscribePayload): void {
  getSocket().emit('indicators:subscribe', payload)
}

export function unsubscribeIndicators(): void {
  // Only unsubscribe from backend — do NOT emit RESET_MARKET_DATA here.
  // State reset is the AppStore's responsibility when it handles SYMBOL_CHANGED
  // or TIMEFRAME_CHANGED. Emitting reset here would wipe state on every
  // component unmount (page nav, tab switch) — not just on symbol/tf change.
  getSocket().emit('indicators:unsubscribe', {})
}

// ── Export socket instance for direct access if needed ───────────────────────
export { getSocket }
