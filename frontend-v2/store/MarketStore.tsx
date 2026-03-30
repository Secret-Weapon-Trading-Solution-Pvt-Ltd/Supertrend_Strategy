'use client'

// ─────────────────────────────────────────────────────────────────────────────
// MarketStore — Live market data state
//
// Manages:
//   - tick             (latest price + ST + ATR from engine tick stream)
//   - indicators       (latest indicators:data from subscribe stream)
//   - position         (open position from position:update)
//   - indicatorEnabled (supertrend/atr on/off)
//   - indicatorSettings (ST length/multiplier, ATR period/threshold)
//
// EventBus subscriptions:
//   TICK_RECEIVED              → update tick
//   INDICATORS_DATA            → update indicators
//   POSITION_UPDATE            → update position
//   INDICATOR_STATE            → update indicatorEnabled
//   INDICATOR_SETTINGS_APPLIED → update indicatorSettings
//   RESET_MARKET_DATA          → clear tick, indicators, position
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react'

import { eventBus } from '@/lib/eventBus'
import { EVENTS } from '@/types/types'
import type {
  TickPayload,
  IndicatorsDataPayload,
  PositionUpdatePayload,
  IndicatorStatePayload,
  IndicatorSettingsAppliedPayload,
  IndicatorSettings,
} from '@/types/types'

// ── State ─────────────────────────────────────────────────────────────────────

interface MarketStoreState {
  tick:               TickPayload | null
  indicators:         IndicatorsDataPayload | null
  position:           PositionUpdatePayload | null
  indicatorEnabled:   { supertrend: boolean; atr: boolean }
  indicatorSettings:  IndicatorSettings
}

const initialState: MarketStoreState = {
  tick:             null,
  indicators:       null,
  position:         null,
  indicatorEnabled: { supertrend: true, atr: true },
  indicatorSettings: {
    supertrend: { length: 10, multiplier: 3.0 },
    atr:        { period: 14, threshold: 1.0  },
  },
}

// ── Actions ───────────────────────────────────────────────────────────────────

type MarketAction =
  | { type: 'SET_TICK';                 payload: TickPayload }
  | { type: 'SET_INDICATORS';           payload: IndicatorsDataPayload }
  | { type: 'SET_POSITION';             payload: PositionUpdatePayload }
  | { type: 'CLEAR_POSITION' }
  | { type: 'SET_INDICATOR_ENABLED';    payload: IndicatorStatePayload }
  | { type: 'SET_INDICATOR_SETTINGS';   payload: IndicatorSettingsAppliedPayload }
  | { type: 'RESET_MARKET_DATA' }

// ── Reducer ───────────────────────────────────────────────────────────────────

function marketReducer(state: MarketStoreState, action: MarketAction): MarketStoreState {
  switch (action.type) {

    case 'SET_TICK':
      return { ...state, tick: action.payload }

    case 'SET_INDICATORS':
      return { ...state, indicators: action.payload }

    case 'SET_POSITION':
      return { ...state, position: action.payload }

    case 'CLEAR_POSITION':
      return { ...state, position: null }

    case 'SET_INDICATOR_ENABLED':
      return {
        ...state,
        indicatorEnabled: {
          ...state.indicatorEnabled,
          [action.payload.name]: action.payload.enabled,
        },
      }

    case 'SET_INDICATOR_SETTINGS': {
      const { name, ...params } = action.payload
      if (name === 'supertrend') {
        return {
          ...state,
          indicatorSettings: {
            ...state.indicatorSettings,
            supertrend: {
              length:     params.length     ?? state.indicatorSettings.supertrend.length,
              multiplier: params.multiplier ?? state.indicatorSettings.supertrend.multiplier,
            },
          },
        }
      }
      if (name === 'atr') {
        return {
          ...state,
          indicatorSettings: {
            ...state.indicatorSettings,
            atr: {
              period:    params.period    ?? state.indicatorSettings.atr.period,
              threshold: params.threshold ?? state.indicatorSettings.atr.threshold,
            },
          },
        }
      }
      return state
    }

    case 'RESET_MARKET_DATA':
      // Clear live data on symbol/timeframe change — keep settings intact
      return {
        ...state,
        tick:       null,
        indicators: null,
        position:   null,
      }

    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface MarketContextValue {
  state:    MarketStoreState
  dispatch: React.Dispatch<MarketAction>
}

const MarketContext = createContext<MarketContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(marketReducer, initialState)

  // ── EventBus subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    const onTick = (data: TickPayload) =>
      dispatch({ type: 'SET_TICK', payload: data })

    const onIndicators = (data: IndicatorsDataPayload) =>
      dispatch({ type: 'SET_INDICATORS', payload: data })

    const onPosition = (data: PositionUpdatePayload) =>
      dispatch({ type: 'SET_POSITION', payload: data })

    const onIndicatorState = (data: IndicatorStatePayload) =>
      dispatch({ type: 'SET_INDICATOR_ENABLED', payload: data })

    const onIndicatorSettings = (data: IndicatorSettingsAppliedPayload) =>
      dispatch({ type: 'SET_INDICATOR_SETTINGS', payload: data })

    const onReset = () =>
      dispatch({ type: 'RESET_MARKET_DATA' })

    const onExit = () =>
      dispatch({ type: 'CLEAR_POSITION' })

    eventBus.on(EVENTS.TICK_RECEIVED,              onTick)
    eventBus.on(EVENTS.INDICATORS_DATA,            onIndicators)
    eventBus.on(EVENTS.POSITION_UPDATE,            onPosition)
    eventBus.on(EVENTS.INDICATOR_STATE,            onIndicatorState)
    eventBus.on(EVENTS.INDICATOR_SETTINGS_APPLIED, onIndicatorSettings)
    eventBus.on(EVENTS.RESET_MARKET_DATA,          onReset)
    eventBus.on(EVENTS.EXIT_TRIGGERED,             onExit)

    return () => {
      eventBus.off(EVENTS.TICK_RECEIVED,              onTick)
      eventBus.off(EVENTS.INDICATORS_DATA,            onIndicators)
      eventBus.off(EVENTS.POSITION_UPDATE,            onPosition)
      eventBus.off(EVENTS.INDICATOR_STATE,            onIndicatorState)
      eventBus.off(EVENTS.INDICATOR_SETTINGS_APPLIED, onIndicatorSettings)
      eventBus.off(EVENTS.RESET_MARKET_DATA,          onReset)
      eventBus.off(EVENTS.EXIT_TRIGGERED,             onExit)
    }
  }, [])

  return (
    <MarketContext.Provider value={{ state, dispatch }}>
      {children}
    </MarketContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext)
  if (!ctx) {
    throw new Error('useMarket() must be used inside <MarketProvider>')
  }
  return ctx
}
