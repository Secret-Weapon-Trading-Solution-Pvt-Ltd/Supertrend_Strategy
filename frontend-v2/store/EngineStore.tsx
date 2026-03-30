'use client'

// ─────────────────────────────────────────────────────────────────────────────
// EngineStore — Trading engine + instrument + timeframe + mode state
//
// Manages:
//   - engineState     (IDLE / RUNNING / PAUSED / STOPPED)
//   - symbol          (selected Instrument)
//   - timeframe       (selected Timeframe)
//   - brokerMode      (forward_test / live)
//   - qty             (quantity to trade)
//   - lastSignal      (BUY / EXIT / HOLD)
//   - lastExitReason  (SESSION_END / FIXED_SL / etc.)
//   - availableTimeframes (loaded from GET /api/timeframes)
//
// EventBus subscriptions:
//   ENGINE_STATE_CHANGED → update engineState, lastSignal, lastExitReason
//   SYMBOL_CHANGED       → update selected symbol
//   TIMEFRAME_CHANGED    → update selected timeframe
//   MODE_STATE           → update brokerMode (backend confirmation)
//   ENGINE_START         → optimistic state update (RUNNING)
//   ENGINE_STOP          → optimistic state update (STOPPED)
//   ENGINE_PAUSE         → optimistic state update (PAUSED)
//   ENGINE_RESUME        → optimistic state update (RUNNING)
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import type {
  EngineState,
  BrokerMode,
  Signal,
  ExitReason,
  Instrument,
  Timeframe,
  EngineStatePayload,
  ModeStatePayload,
  ExitSettingsPayload,
} from '@/types/types'

// ── State ─────────────────────────────────────────────────────────────────────

interface EngineStoreState {
  engineState:          EngineState
  selectedSymbol:       Instrument | null
  selectedTimeframe:    Timeframe | null
  brokerMode:           BrokerMode
  qty:                  number
  lastSignal:           Signal
  lastExitReason:       ExitReason | ''
  availableTimeframes:  Timeframe[]
  initialized:          boolean
  exitSettings:         ExitSettingsPayload
}

const initialState: EngineStoreState = {
  engineState:         'IDLE',
  selectedSymbol:      null,
  selectedTimeframe:   null,
  brokerMode:          'forward_test',
  qty:                 1,
  lastSignal:          'HOLD',
  lastExitReason:      '',
  availableTimeframes: [],
  initialized:         false,
  exitSettings: {
    target_type:      'points',
    target_value:     20,
    sl_type:          'points',
    sl_value:         10,
    trailing_sl:      true,
    trail_value:      5,
    exit_on_st_red:   true,
    session_end_time: '15:15',
  },
}

// ── Actions ───────────────────────────────────────────────────────────────────

type EngineAction =
  | { type: 'SET_ENGINE_STATE';     payload: EngineStatePayload }
  | { type: 'SET_SYMBOL';           payload: Instrument }
  | { type: 'CLEAR_SYMBOL' }
  | { type: 'SET_TIMEFRAME';        payload: Timeframe }
  | { type: 'SET_BROKER_MODE';      payload: ModeStatePayload }
  | { type: 'SET_QTY';              payload: number }
  | { type: 'SET_TIMEFRAMES';       payload: Timeframe[] }
  | { type: 'SET_ENGINE_RUNNING' }
  | { type: 'SET_ENGINE_STOPPED' }
  | { type: 'SET_ENGINE_PAUSED' }
  | { type: 'SET_ENGINE_RESUMED' }
  | { type: 'SET_INITIALIZED' }
  | { type: 'SET_EXIT_SETTINGS';    payload: ExitSettingsPayload }

// ── Reducer ───────────────────────────────────────────────────────────────────

function engineReducer(state: EngineStoreState, action: EngineAction): EngineStoreState {
  switch (action.type) {

    case 'SET_ENGINE_STATE':
      return {
        ...state,
        engineState:    action.payload.state,
        lastSignal:     action.payload.last_signal     ?? state.lastSignal,
        lastExitReason: action.payload.last_exit_reason ?? state.lastExitReason,
      }

    case 'SET_SYMBOL':
      return { ...state, selectedSymbol: action.payload }

    case 'CLEAR_SYMBOL':
      return { ...state, selectedSymbol: null }

    case 'SET_TIMEFRAME':
      return { ...state, selectedTimeframe: action.payload }

    case 'SET_BROKER_MODE':
      return { ...state, brokerMode: action.payload.mode }

    case 'SET_QTY':
      return { ...state, qty: action.payload }

    case 'SET_TIMEFRAMES':
      return { ...state, availableTimeframes: action.payload }

    // Optimistic updates — before backend confirms via engine:state
    case 'SET_ENGINE_RUNNING':
      return { ...state, engineState: 'RUNNING' }

    case 'SET_ENGINE_STOPPED':
      return { ...state, engineState: 'STOPPED' }

    case 'SET_ENGINE_PAUSED':
      return { ...state, engineState: 'PAUSED' }

    case 'SET_ENGINE_RESUMED':
      return { ...state, engineState: 'RUNNING' }

    case 'SET_INITIALIZED':
      return { ...state, initialized: true }

    case 'SET_EXIT_SETTINGS':
      return { ...state, exitSettings: action.payload }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface EngineContextValue {
  state:    EngineStoreState
  dispatch: React.Dispatch<EngineAction>
  // Convenience setters
  setSymbol:       (instrument: Instrument) => void
  clearSymbol:     () => void
  setTimeframe:    (timeframe: Timeframe) => void
  setQty:          (qty: number) => void
  setTimeframes:   (timeframes: Timeframe[]) => void
  setInitialized:  () => void
  setExitSettings: (settings: ExitSettingsPayload) => void
}

const EngineContext = createContext<EngineContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(engineReducer, initialState)

  // ── Convenience setters ──────────────────────────────────────────────────
  const setSymbol       = useCallback((i: Instrument)        => dispatch({ type: 'SET_SYMBOL',       payload: i }), [])
  const clearSymbol     = useCallback(()                      => dispatch({ type: 'CLEAR_SYMBOL' }),                 [])
  const setTimeframe    = useCallback((t: Timeframe)          => dispatch({ type: 'SET_TIMEFRAME',    payload: t }), [])
  const setQty          = useCallback((q: number)             => dispatch({ type: 'SET_QTY',          payload: q }), [])
  const setTimeframes   = useCallback((t: Timeframe[])        => dispatch({ type: 'SET_TIMEFRAMES',   payload: t }), [])
  const setInitialized  = useCallback(()                      => dispatch({ type: 'SET_INITIALIZED' }),              [])
  const setExitSettings = useCallback((s: ExitSettingsPayload)=> dispatch({ type: 'SET_EXIT_SETTINGS', payload: s }),[])


  // ── EventBus subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const onEngineState = (data: EngineStatePayload) =>
      dispatch({ type: 'SET_ENGINE_STATE', payload: data })

    const onSymbolChanged = (data: Instrument) =>
      dispatch({ type: 'SET_SYMBOL', payload: data })

    const onTimeframeChanged = (data: Timeframe) =>
      dispatch({ type: 'SET_TIMEFRAME', payload: data })

    const onModeState = (data: ModeStatePayload) =>
      dispatch({ type: 'SET_BROKER_MODE', payload: data })

    const onStart       = () => dispatch({ type: 'SET_ENGINE_RUNNING' })
    const onStop        = () => dispatch({ type: 'SET_ENGINE_STOPPED' })
    const onPause       = () => dispatch({ type: 'SET_ENGINE_PAUSED' })
    const onResume      = () => dispatch({ type: 'SET_ENGINE_RESUMED' })
    const onExitSettings = (data: ExitSettingsPayload) =>
      dispatch({ type: 'SET_EXIT_SETTINGS', payload: data })

    eventBus.on(EVENTS.ENGINE_STATE_CHANGED,  onEngineState)
    eventBus.on(EVENTS.SYMBOL_CHANGED,        onSymbolChanged)
    eventBus.on(EVENTS.TIMEFRAME_CHANGED,     onTimeframeChanged)
    eventBus.on(EVENTS.MODE_STATE,            onModeState)
    eventBus.on(EVENTS.ENGINE_START,          onStart)
    eventBus.on(EVENTS.ENGINE_STOP,           onStop)
    eventBus.on(EVENTS.ENGINE_PAUSE,          onPause)
    eventBus.on(EVENTS.ENGINE_RESUME,         onResume)
    eventBus.on(EVENTS.EXIT_SETTINGS_APPLIED, onExitSettings)

    return () => {
      eventBus.off(EVENTS.ENGINE_STATE_CHANGED,  onEngineState)
      eventBus.off(EVENTS.SYMBOL_CHANGED,        onSymbolChanged)
      eventBus.off(EVENTS.TIMEFRAME_CHANGED,     onTimeframeChanged)
      eventBus.off(EVENTS.MODE_STATE,            onModeState)
      eventBus.off(EVENTS.ENGINE_START,          onStart)
      eventBus.off(EVENTS.ENGINE_STOP,           onStop)
      eventBus.off(EVENTS.ENGINE_PAUSE,          onPause)
      eventBus.off(EVENTS.ENGINE_RESUME,         onResume)
      eventBus.off(EVENTS.EXIT_SETTINGS_APPLIED, onExitSettings)
    }
  }, [])

  return (
    <EngineContext.Provider value={{ state, dispatch, setSymbol, clearSymbol, setTimeframe, setQty, setTimeframes, setInitialized, setExitSettings }}>
      {children}
    </EngineContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext)
  if (!ctx) {
    throw new Error('useEngine() must be used inside <EngineProvider>')
  }
  return ctx
}
