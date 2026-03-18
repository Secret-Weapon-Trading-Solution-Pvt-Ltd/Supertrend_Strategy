// ─────────────────────────────────────────────────────────────────────────────
// socket/socket.ts — Single Socket.IO client instance
//
// This is the frontend equivalent of backend's event_bus.py.
// Import `socket` anywhere to emit or listen to events.
// Import `emit` as a typed helper that enforces correct payloads.
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from "socket.io-client"
import type {
  EngineStartPayload,
  IndicatorTogglePayload,
  ModeSwitchPayload,
  InstrumentSearchPayload,
  TradesHistoryPayload,
} from "../types"
import {
  CMD_ENGINE_START,
  CMD_ENGINE_STOP,
  CMD_ENGINE_PAUSE,
  CMD_ENGINE_RESUME,
  CMD_INDICATOR_TOGGLE,
  CMD_MODE_SWITCH,
  CMD_INSTRUMENTS_SEARCH,
  CMD_TRADES_HISTORY,
} from "./events"

// ── Backend URL ───────────────────────────────────────────────────────────────
// In dev: Vite proxy forwards /socket.io → localhost:8000
// In prod: same origin (Nginx serves both)

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000"

// ── Shared socket instance ────────────────────────────────────────────────────

export const socket: Socket = io(BACKEND_URL, {
  transports:       ["websocket"],   // skip long-polling
  autoConnect:      true,
  reconnection:     true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 10,
})

// ── Typed emit helpers ────────────────────────────────────────────────────────
// Use these instead of socket.emit() directly to get full type safety.

export const emit = {
  engineStart:        (payload: EngineStartPayload) =>
    socket.emit(CMD_ENGINE_START, payload),

  engineStop:         () =>
    socket.emit(CMD_ENGINE_STOP, {}),

  enginePause:        () =>
    socket.emit(CMD_ENGINE_PAUSE, {}),

  engineResume:       () =>
    socket.emit(CMD_ENGINE_RESUME, {}),

  indicatorToggle:    (payload: IndicatorTogglePayload) =>
    socket.emit(CMD_INDICATOR_TOGGLE, payload),

  modeSwitch:         (payload: ModeSwitchPayload) =>
    socket.emit(CMD_MODE_SWITCH, payload),

  instrumentsSearch:  (payload: InstrumentSearchPayload) =>
    socket.emit(CMD_INSTRUMENTS_SEARCH, payload),

  tradesHistory:      (payload: TradesHistoryPayload = {}) =>
    socket.emit(CMD_TRADES_HISTORY, payload),
}
