// hooks/useLogs.ts — Live backend log stream
import { useEffect, useState } from "react"
import { socket } from "../socket/socket"
import { EVT_LOG } from "../socket/events"
import type { LogEntry } from "../types"

const MAX_LOGS = 200   // keep last 200 entries to avoid memory bloat

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    socket.on(EVT_LOG, (entry: LogEntry) => {
      setLogs(prev => {
        const updated = [...prev, entry]
        return updated.length > MAX_LOGS ? updated.slice(-MAX_LOGS) : updated
      })
    })
    return () => { socket.off(EVT_LOG) }
  }, [])

  const clear = () => setLogs([])

  return { logs, clear }
}
