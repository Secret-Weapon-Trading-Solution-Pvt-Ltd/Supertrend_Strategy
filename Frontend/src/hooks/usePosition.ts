// hooks/usePosition.ts — Live position + exit events
import { useEffect, useState } from "react"
import { socket } from "../socket/socket"
import { EVT_POSITION_UPDATE, EVT_EXIT_TRIGGERED, EVT_SIGNAL_BUY, EVT_ORDER_PLACED } from "../socket/events"
import type { PositionUpdate, ExitTriggered, SignalBuy, OrderPlaced } from "../types"

export function usePosition() {
  const [position, setPosition]       = useState<PositionUpdate | null>(null)
  const [lastExit, setLastExit]       = useState<ExitTriggered | null>(null)
  const [lastSignal, setLastSignal]   = useState<SignalBuy | null>(null)
  const [lastOrder, setLastOrder]     = useState<OrderPlaced | null>(null)

  useEffect(() => {
    socket.on(EVT_POSITION_UPDATE, (data: PositionUpdate) => setPosition(data))
    socket.on(EVT_EXIT_TRIGGERED,  (data: ExitTriggered)  => {
      setLastExit(data)
      setPosition(null)   // clear position on exit
    })
    socket.on(EVT_SIGNAL_BUY,  (data: SignalBuy)   => setLastSignal(data))
    socket.on(EVT_ORDER_PLACED, (data: OrderPlaced) => setLastOrder(data))

    return () => {
      socket.off(EVT_POSITION_UPDATE)
      socket.off(EVT_EXIT_TRIGGERED)
      socket.off(EVT_SIGNAL_BUY)
      socket.off(EVT_ORDER_PLACED)
    }
  }, [])

  return { position, lastExit, lastSignal, lastOrder }
}
