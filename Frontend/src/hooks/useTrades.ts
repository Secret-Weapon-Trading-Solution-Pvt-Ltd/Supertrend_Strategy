// hooks/useTrades.ts — Trade history from DB
import { useEffect, useState } from "react"
import { socket, emit } from "../socket/socket"
import { EVT_TRADES_HISTORY, EVT_EXIT_TRIGGERED } from "../socket/events"
import type { Trade } from "../types"

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    // Fetch history on mount
    emit.tradesHistory({ limit: 100 })

    socket.on(EVT_TRADES_HISTORY, (data: Trade[]) => setTrades(data))

    // Refresh history after every exit so new trade appears immediately
    socket.on(EVT_EXIT_TRIGGERED, () => {
      setTimeout(() => emit.tradesHistory({ limit: 100 }), 500)
    })

    return () => {
      socket.off(EVT_TRADES_HISTORY)
      socket.off(EVT_EXIT_TRIGGERED)
    }
  }, [])

  const refresh = () => emit.tradesHistory({ limit: 100 })

  return { trades, refresh }
}
