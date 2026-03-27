// ─────────────────────────────────────────────────────────────────────────────
// SWTS — Frontend Event Bus
// Lightweight pub/sub for decoupled communication between:
//   - UI components  (symbol change, timeframe change, engine commands)
//   - Socket.IO      (incoming backend events → state manager)
//   - State manager  (subscribes to all events, updates state)
//
// Usage:
//   import { eventBus } from '@/lib/eventBus'
//
//   // Subscribe
//   eventBus.on('SYMBOL_CHANGED', (data) => { ... })
//
//   // Publish
//   eventBus.emit('SYMBOL_CHANGED', { symbol, token })
//
//   // Unsubscribe
//   eventBus.off('SYMBOL_CHANGED', handler)
// ─────────────────────────────────────────────────────────────────────────────

import type { EventName } from '@/types/types'

// Each event can carry any data shape — consumers cast to the correct type
// using the EventPayloadMap below
type EventCallback = (data: unknown) => void

// ── Event Payload Map ─────────────────────────────────────────────────────────
// Maps every event name to its expected payload type.
// This gives full type safety when calling eventBus.emit() and eventBus.on().

import type {
  Instrument,
  Timeframe,
  EngineStartPayload,
  ModeSwitchPayload,
  IndicatorTogglePayload,
  IndicatorSettingsPayload,
  IndicatorStatePayload,
  IndicatorSettingsAppliedPayload,
  ExitSettingsPayload,
  TickPayload,
  SignalBuyPayload,
  OrderPlacedPayload,
  ExitTriggeredPayload,
  PositionUpdatePayload,
  EngineStatePayload,
  IndicatorsDataPayload,
  LogPayload,
  ModeStatePayload,
  ErrorPayload,
  TradeLogEntry,
} from '@/types/types'

export interface EventPayloadMap {
  // ── User selection ──────────────────────────────────────────────────────────
  SYMBOL_CHANGED:        Instrument
  TIMEFRAME_CHANGED:     Timeframe

  // ── Engine commands (UI → socket) ───────────────────────────────────────────
  ENGINE_START:          EngineStartPayload
  ENGINE_STOP:           undefined
  ENGINE_PAUSE:          undefined
  ENGINE_RESUME:         undefined

  // ── Mode ────────────────────────────────────────────────────────────────────
  MODE_CHANGED:          ModeSwitchPayload

  // ── Indicator ───────────────────────────────────────────────────────────────
  INDICATOR_TOGGLED:     IndicatorTogglePayload
  INDICATOR_SETTINGS:    IndicatorSettingsPayload

  // ── Socket.IO incoming (backend → event bus → state) ────────────────────────
  TICK_RECEIVED:         TickPayload
  SIGNAL_BUY:            SignalBuyPayload
  ORDER_PLACED:          OrderPlacedPayload
  EXIT_TRIGGERED:        ExitTriggeredPayload
  POSITION_UPDATE:       PositionUpdatePayload
  ENGINE_STATE_CHANGED:  EngineStatePayload
  INDICATORS_DATA:            IndicatorsDataPayload
  LOG_RECEIVED:               LogPayload
  INDICATOR_STATE:            IndicatorStatePayload
  INDICATOR_SETTINGS_APPLIED: IndicatorSettingsAppliedPayload
  EXIT_SETTINGS_APPLIED:      ExitSettingsPayload
  MODE_STATE:                 ModeStatePayload
  SOCKET_ERROR:               ErrorPayload

  // ── Connection ──────────────────────────────────────────────────────────────
  WS_CONNECTED:          undefined
  WS_DISCONNECTED:       undefined

  // ── Trade log (activity feed) ────────────────────────────────────────────────
  TRADELOG_RECEIVED:     TradeLogEntry
  TRADELOG_HISTORY:      TradeLogEntry[]

  // ── State control ───────────────────────────────────────────────────────────
  RESET_MARKET_DATA:     undefined
}

// ── EventBus class ────────────────────────────────────────────────────────────

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  /** Subscribe to an event */
  on<K extends EventName>(event: K, callback: (data: EventPayloadMap[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback)
  }

  /** Unsubscribe from an event */
  off<K extends EventName>(event: K, callback: (data: EventPayloadMap[K]) => void): void {
    this.listeners.get(event)?.delete(callback as EventCallback)
  }

  /** Publish an event to all subscribers */
  emit<K extends EventName>(event: K, data: EventPayloadMap[K]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[EventBus] ${event}`, data)
    }
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err)
      }
    })
  }

  /** Remove all subscribers for an event — useful on unmount */
  clear(event: EventName): void {
    this.listeners.delete(event)
  }

  /** Remove all subscribers for all events — use on full app reset */
  clearAll(): void {
    this.listeners.clear()
  }
}

// ── Singleton — shared across the entire app ──────────────────────────────────
export const eventBus = new EventBus()
