// types/index.ts - All TypeScript types for SWTS Socket.IO events

export type Tick = {
  timestamp:  string
  symbol:     string
  close:      number
  supertrend: number | null
  atr:        number | null
  direction:  "GREEN" | "RED" | "?"
}

export type SignalBuy = {
  symbol: string
  price:  number
  time:   string
}

export type OrderPlaced = {
  type:     "BUY" | "SELL"
  symbol:   string
  qty:      number
  price:    number
  order_id: string
}

export type PositionUpdate = {
  symbol:         string
  entry_price:    number
  current_price:  number
  peak_price:     number
  unrealized_pnl: number
}

export type ExitTriggered = {
  reason:      "SESSION_END" | "FIXED_SL" | "TRAILING_SL" | "TARGET" | "ST_RED"
  entry_price: number
  exit_price:  number
  pnl_points:  number
  pnl_amount:  number
  result:      "PROFIT" | "LOSS"
}

export type ActivePosition = {
  symbol:      string
  qty:         number
  entry_price: number
  peak_price:  number
}

export type EngineState = {
  state:             "IDLE" | "RUNNING" | "PAUSED" | "STOPPED"
  symbol:            string
  interval:          string
  timestamp?:        string
  close?:            number
  supertrend?:       number | null
  st_direction?:     number | null
  atr?:              number | null
  last_signal?:      "BUY" | "EXIT" | "HOLD"
  last_exit_reason?: string
  position?:         ActivePosition | null
  last_error?:       string
}

export type Timeframe = {
  interval: string
  label:    string
  minutes:  number
}

export type Instrument = {
  symbol:   string
  token:    number
  name:     string
  exchange: string
  segment:  string
  lot_size: number
}

export type Trade = {
  id:          number
  symbol:      string
  qty:         number
  entry_price: number
  exit_price:  number
  pnl_points:  number
  pnl_amount:  number
  result:      "PROFIT" | "LOSS"
  exit_reason: "SESSION_END" | "FIXED_SL" | "TRAILING_SL" | "TARGET" | "ST_RED"
  broker_mode: "forward_test" | "live"
  interval:    string
  entry_time:  string | null
  exit_time:   string | null
}

export type LogEntry = {
  level:     "DEBUG" | "INFO" | "WARNING" | "ERROR"
  logger:    string
  message:   string
  timestamp: string
}

export type IndicatorState = {
  name:    "supertrend" | "atr"
  enabled: boolean
}

export type ModeState = {
  mode: "forward_test" | "live"
}

export type ServerError = {
  message: string
}

export type EngineStartPayload = {
  symbol:    string
  token:     number
  qty:       number
  interval?: string
}

export type IndicatorTogglePayload = {
  name:    "supertrend" | "atr"
  enabled: boolean
}

export type ModeSwitchPayload = {
  mode: "forward_test" | "live"
}

export type InstrumentSearchPayload = {
  query:     string
  exchange?: string
}

export type TradesHistoryPayload = {
  limit?: number
}
