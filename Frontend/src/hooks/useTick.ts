// hooks/useTick.ts — Latest tick data
import { useEffect, useState } from "react"
import { socket } from "../socket/socket"
import { EVT_TICK } from "../socket/events"
import type { Tick } from "../types"

export function useTick() {
  const [tick, setTick] = useState<Tick | null>(null)

  useEffect(() => {
    socket.on(EVT_TICK, (data: Tick) => setTick(data))
    return () => { socket.off(EVT_TICK) }
  }, [])

  return tick
}
