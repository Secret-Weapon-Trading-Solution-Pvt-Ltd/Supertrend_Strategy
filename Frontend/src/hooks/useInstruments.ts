// hooks/useInstruments.ts — Instrument search + timeframes
import { useEffect, useState } from "react"
import { socket, emit } from "../socket/socket"
import { EVT_TIMEFRAMES, EVT_INSTRUMENTS_RESULTS } from "../socket/events"
import type { Timeframe, Instrument, InstrumentSearchPayload } from "../types"

export function useTimeframes() {
  const [timeframes, setTimeframes] = useState<Timeframe[]>([])

  useEffect(() => {
    socket.on(EVT_TIMEFRAMES, (data: Timeframe[]) => setTimeframes(data))
    return () => { socket.off(EVT_TIMEFRAMES) }
  }, [])

  return timeframes
}

export function useInstrumentSearch() {
  const [results, setResults]   = useState<Instrument[]>([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    socket.on(EVT_INSTRUMENTS_RESULTS, (data: Instrument[]) => {
      setResults(data)
      setLoading(false)
    })
    return () => { socket.off(EVT_INSTRUMENTS_RESULTS) }
  }, [])

  const search = (payload: InstrumentSearchPayload) => {
    if (payload.query.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    emit.instrumentsSearch(payload)
  }

  return { results, loading, search }
}
