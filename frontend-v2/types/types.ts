// ─────────────────────────────────────────────────────────────────────────────
// SWTS — TypeScript Types
// Single source of truth for all data shapes, enums, and event names.
// ─────────────────────────────────────────────────────────────────────────────


// ── ENUMS ─────────────────────────────────────────────────────────────────────

export type EngineState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'

export type BrokerMode = 'forward_test' | 'live'

export type Direction = 'GREEN' | 'RED' | '?'

export type ExitReason =
  | 'SESSION_END'
  | 'FIXED_SL'
  | 'TRAILING_SL'
  | 'TARGET'
  | 'ST_RED'
  | 'ENGINE_STOP'

export type TradeLogEventType =
  | 'SIGNAL_BUY'
  | 'ORDER_PLACED'
  | 'ORDER_FILLED'
  | 'ORDER_REJECTED'
  | 'ORDER_TIMEOUT'
  | 'EXIT_TRIGGERED'
  | 'FUNDS_INSUFFICIENT'

export type Signal = 'BUY' | 'EXIT' | 'HOLD'

export type TradeResult = 'PROFIT' | 'LOSS'

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG'

export type InstrumentType = 'EQ' | 'FUT' | 'CE' | 'PE'

export type Exchange = 'NSE' | 'NFO' | 'BSE' | 'MCX'

export type IndicatorName = 'supertrend' | 'atr'

export type TargetType = 'points' | 'percentage' | 'atr_multiple'

export type SlType = 'points' | 'percentage'


// ── SOCKET.IO — SERVER → CLIENT PAYLOADS ─────────────────────────────────────

/** Emitted every second — live price + indicator values */
export interface TickPayload {
  timestamp:  string
  symbol:     string
  close:      number
  supertrend: number | null
  atr:        number | null
  direction:  Direction
  new_candle: boolean
}

/** Emitted when Supertrend flips GREEN and ATR gate passes */
export interface SignalBuyPayload {
  symbol: string
  price:  number
  time:   string
}

/** Emitted after every BUY or SELL order is placed */
export interface OrderPlacedPayload {
  type:     'BUY' | 'SELL'
  symbol:   string
  qty:      number
  price:    number
  order_id: string
}

/** Emitted when an exit condition fires (SL / Target / ST Red / Session End) */
export interface ExitTriggeredPayload {
  reason:      ExitReason
  entry_price: number
  exit_price:  number
  pnl_points:  number
  pnl_amount:  number
  result:      TradeResult
}

/** Emitted every tick while a position is open */
export interface PositionUpdatePayload {
  symbol:         string
  qty:            number
  entry_price:    number
  current_price:  number
  peak_price:     number
  unrealized_pnl: number
}

/** Emitted on engine start / stop / pause / resume — full engine snapshot */
export interface EngineStatePayload {
  state:            EngineState
  symbol:           string
  interval:         string
  // optional — only present when engine has data
  timestamp?:       string
  close?:           number
  supertrend?:      number | null
  atr?:             number | null
  st_direction?:    number | null
  last_signal?:     Signal
  last_exit_reason?: ExitReason | ''
  position?:        EnginePosition | null
}

/** Emitted every second from indicators:subscribe loop */
export interface IndicatorsDataPayload {
  timestamp:  string
  close:      number
  supertrend: number | null
  atr:        number | null
  direction:  Direction
  new_candle: boolean
}

/** Emitted on new trade activity event (real-time) and in tradelog:history batch */
export interface TradeLogEntry {
  id:          number
  event_type:  TradeLogEventType
  symbol:      string | null
  broker_mode: BrokerMode
  details:     Record<string, unknown>
  created_at:  string
}

/** Emitted by the backend log handler — streams all Python logs to frontend */
export interface LogPayload {
  level:     LogLevel
  logger:    string
  message:   string
  timestamp: string
}

/** Emitted after indicator:toggle */
export interface IndicatorStatePayload {
  name:    IndicatorName
  enabled: boolean
}

/** Emitted after exit:settings or exit:settings:get — full current settings snapshot */
export interface ExitSettingsPayload {
  target_type:      TargetType
  target_value:     number
  sl_type:          SlType
  sl_value:         number
  trailing_sl:      boolean
  trail_value:      number
  exit_on_st_red:   boolean
  session_end_time: string   // "HH:MM"
}

/** Sent by client to update exit settings — all fields optional (partial update) */
export type UpdateExitSettingsPayload = Partial<ExitSettingsPayload>

/** Emitted after indicator:settings */
export interface IndicatorSettingsAppliedPayload {
  name:        IndicatorName
  // supertrend
  length?:     number
  multiplier?: number
  // atr
  period?:     number
  threshold?:  number
}

/** Emitted after mode:switch */
export interface ModeStatePayload {
  mode: BrokerMode
}

/** Emitted on any backend error */
export interface ErrorPayload {
  message: string
}


// ── SOCKET.IO — CLIENT → SERVER PAYLOADS ─────────────────────────────────────

export interface EngineStartPayload {
  symbol:    string
  token:     number
  qty:       number
  interval?: string
  exchange?: Exchange
}

export interface IndicatorTogglePayload {
  name:    IndicatorName
  enabled: boolean
}

export interface IndicatorSettingsPayload {
  name:        IndicatorName
  // supertrend
  length?:     number
  multiplier?: number
  // atr
  period?:     number
  threshold?:  number
}

export interface ModeSwitchPayload {
  mode: BrokerMode
}

export interface IndicatorsSubscribePayload {
  token:    number
  interval: string
}


// ── REST API — RESPONSE SHAPES ────────────────────────────────────────────────

export interface StatusResponse {
  logged_in:       boolean
  user?:           string
  user_id?:        string
  reason?:         string
  ticker:          TickerStatus
  keycloak_token?: string
}

export interface TickerStatus {
  connected:          boolean
  subscribed_tokens:  number[]
  tick_count:         number
}

export interface Timeframe {
  interval: string
  label:    string
  minutes:  number
}

export interface Instrument {
  token:     number
  symbol:    string
  name:      string
  exchange:  Exchange
  segment:   string
  type:      InstrumentType
  lot_size:  number
  expiry:    string | null
  // List endpoint (/api/instruments)  → present, Detail endpoint (/api/instruments/:token) → absent
  strike?:   number | null
  // Detail endpoint (/api/instruments/:token) → present, List endpoint → absent
  tick_size?: number
}

export interface Trade {
  id:          number
  symbol:      string
  qty:         number
  entry_price: number
  exit_price:  number
  pnl_points:  number
  pnl_amount:  number
  result:      TradeResult
  exit_reason: ExitReason
  broker_mode: BrokerMode
  interval:    string
  entry_time:  string | null
  exit_time:   string | null
}

// Live mode holdings
export interface LiveHolding {
  symbol:         string
  exchange:       Exchange
  isin:           string
  quantity:       number
  avg_price:      number
  last_price:     number
  pnl:            number
  day_change_pct: number
  current_value:  number
  invested_value: number
}

// Forward test holdings summary
export interface ForwardTestHolding {
  mode:              'forward_test'
  initial_capital:   number
  available_capital: number
  total_pnl:         number
  total_trades:      number
  wins:              number
  losses:            number
}

export interface HoldingsResponse {
  mode:     BrokerMode
  holdings: LiveHolding[] | ForwardTestHolding[]
}

// Live mode position
export interface LivePosition {
  symbol:       string
  exchange:     Exchange
  quantity:     number
  avg_price:    number
  last_price:   number
  pnl:          number
  m2m:          number
  product:      string
  buy_quantity: number
  sell_quantity: number
}

// Forward test position — shape from ForwardTestBroker._open_position()
export interface ForwardTestPosition {
  order_id:    string
  symbol:      string
  token:       number
  qty:         number
  entry_price: number
  entry_time:  string   // datetime from backend, serialized as ISO string
  peak_price:  number
}

export interface PositionsResponse {
  mode:      BrokerMode
  positions: LivePosition[] | ForwardTestPosition[]
}

/**
 * Forward test trade — from ForwardTestBroker._close_position()
 * Different from DB Trade: no id, exit_reason, broker_mode, interval
 * Has extra `pnl` field kept for backward compat
 */
export interface ForwardTrade {
  symbol:      string
  qty:         number
  entry_price: number
  exit_price:  number
  entry_time:  string
  exit_time:   string
  pnl_points:  number
  pnl_amount:  number
  pnl:         number   // backward compat — same value as pnl_amount
  result:      TradeResult
}

export interface ForwardSummaryResponse {
  total_trades:      number
  total_pnl:         number
  wins:              number
  losses:            number
  win_rate?:         number   // absent when total_trades = 0
  initial_capital:   number
  available_capital: number
  trades:            ForwardTrade[]
}

export interface FundsResponse {
  mode:         BrokerMode
  live_balance: number
  collateral:   number
  net:          number
}


// ── INTERNAL TYPES ────────────────────────────────────────────────────────────

/** Position stored in engine:state snapshot */
export interface EnginePosition {
  symbol:      string
  qty:         number
  entry_price: number
  peak_price:  number
}

/** Indicator settings stored in app state */
export interface SupertrendSettings {
  length:     number
  multiplier: number
}

export interface AtrSettings {
  period:    number
  threshold: number
}

export interface IndicatorSettings {
  supertrend: SupertrendSettings
  atr:        AtrSettings
}


// ── APP STATE ─────────────────────────────────────────────────────────────────

/** Shape of the global state manager */
export interface AppState {
  // Auth
  isLoggedIn:        boolean
  userName:          string
  userId:            string

  // Selection
  selectedSymbol:    Instrument | null
  selectedTimeframe: Timeframe | null

  // Broker
  brokerMode:        BrokerMode

  // Engine
  engineState:       EngineState
  lastSignal:        Signal
  lastExitReason:    ExitReason | ''

  // Live data
  tick:              TickPayload | null
  position:          PositionUpdatePayload | null

  // Indicators
  indicators:        IndicatorsDataPayload | null
  indicatorEnabled:  { supertrend: boolean; atr: boolean }
  indicatorSettings: IndicatorSettings

  // History
  trades:            Trade[]
  logs:              LogPayload[]

  // Connection
  wsConnected:       boolean
}


// ── FRONTEND EVENT BUS — EVENT NAMES ─────────────────────────────────────────

export const EVENTS = {
  // User selection changes
  SYMBOL_CHANGED:        'SYMBOL_CHANGED',
  TIMEFRAME_CHANGED:     'TIMEFRAME_CHANGED',

  // Engine commands (UI → socket)
  ENGINE_START:          'ENGINE_START',
  ENGINE_STOP:           'ENGINE_STOP',
  ENGINE_PAUSE:          'ENGINE_PAUSE',
  ENGINE_RESUME:         'ENGINE_RESUME',

  // Mode
  MODE_CHANGED:          'MODE_CHANGED',

  // Indicator (client → server)
  INDICATOR_TOGGLED:     'INDICATOR_TOGGLED',
  INDICATOR_SETTINGS:    'INDICATOR_SETTINGS',

  // Socket.IO incoming (backend → event bus → state)
  TICK_RECEIVED:              'TICK_RECEIVED',
  SIGNAL_BUY:                 'SIGNAL_BUY',
  ORDER_PLACED:               'ORDER_PLACED',
  EXIT_TRIGGERED:             'EXIT_TRIGGERED',
  POSITION_UPDATE:            'POSITION_UPDATE',
  ENGINE_STATE_CHANGED:       'ENGINE_STATE_CHANGED',
  INDICATORS_DATA:            'INDICATORS_DATA',
  LOG_RECEIVED:               'LOG_RECEIVED',
  INDICATOR_STATE:            'INDICATOR_STATE',
  INDICATOR_SETTINGS_APPLIED: 'INDICATOR_SETTINGS_APPLIED',
  MODE_STATE:                 'MODE_STATE',
  SOCKET_ERROR:               'SOCKET_ERROR',
  WS_CONNECTED:          'WS_CONNECTED',
  WS_DISCONNECTED:       'WS_DISCONNECTED',

  // Exit settings
  EXIT_SETTINGS_APPLIED: 'EXIT_SETTINGS_APPLIED',

  // Trade log (activity feed)
  TRADELOG_RECEIVED:     'TRADELOG_RECEIVED',
  TRADELOG_HISTORY:      'TRADELOG_HISTORY',

  // State
  RESET_MARKET_DATA:     'RESET_MARKET_DATA',
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]
