// hooks/useEngine.ts — Engine state + controls
import { useEffect, useState } from "react"
import { socket, emit } from "../socket/socket"
import { EVT_ENGINE_STATE } from "../socket/events"
import type { EngineState, EngineStartPayload } from "../types"

export function useEngine() {
  const [engineState, setEngineState] = useState<EngineState | null>(null)

  useEffect(() => {
    socket.on(EVT_ENGINE_STATE, (data: EngineState) => setEngineState(data))
    return () => { socket.off(EVT_ENGINE_STATE) }
  }, [])

  return {
    engineState,
    isRunning: engineState?.state === "RUNNING",
    isPaused:  engineState?.state === "PAUSED",
    isStopped: engineState?.state === "STOPPED" || engineState?.state === "IDLE",

    start:  (payload: EngineStartPayload) => emit.engineStart(payload),
    stop:   () => emit.engineStop(),
    pause:  () => emit.enginePause(),
    resume: () => emit.engineResume(),
  }
}
