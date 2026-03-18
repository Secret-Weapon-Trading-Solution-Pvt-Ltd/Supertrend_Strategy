import { useEffect, useRef } from "react"
import { useLogs } from "../hooks/useLogs"

const LEVEL_STYLE: Record<string, { color: string; bg: string }> = {
  INFO:    { color: "#2563eb", bg: "#eff6ff" },
  WARNING: { color: "#d97706", bg: "#fffbeb" },
  ERROR:   { color: "#dc2626", bg: "#fff1f2" },
  DEBUG:   { color: "#64748b", bg: "#f8fafc" },
}

export default function LogPanel() {
  const { logs, clear } = useLogs()
  const bottomRef       = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  return (
    <div style={{
      background:   "#fff",
      border:       "1px solid #e2e8f0",
      borderRadius: 10,
      overflow:     "hidden",
      display:      "flex",
      flexDirection: "column",
      height:       "100%",
    }}>

      {/* Header */}
      <div style={{
        padding:        "12px 16px",
        borderBottom:   "1px solid #f1f5f9",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        flexShrink:     0,
      }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
          Logs <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>({logs.length})</span>
        </p>
        <button onClick={clear} style={{
          background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", color: "#64748b", fontSize: 12,
        }}>
          ✕ Clear
        </button>
      </div>

      {/* Log entries */}
      <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
        {logs.length === 0 ? (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: "32px 0" }}>
            Waiting for logs...
          </p>
        ) : logs.map((log, i) => {
          const style = LEVEL_STYLE[log.level] || LEVEL_STYLE.DEBUG
          return (
            <div key={i} style={{
              padding:     "5px 14px",
              display:     "flex",
              gap:         10,
              alignItems:  "flex-start",
              borderBottom: "1px solid #f8fafc",
            }}>
              <span className="num" style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>
                {log.timestamp.split(" ")[1]}
              </span>
              <span style={{
                padding:      "1px 6px",
                borderRadius: 3,
                fontSize:     10,
                fontWeight:   700,
                flexShrink:   0,
                color:        style.color,
                background:   style.bg,
              }}>
                {log.level}
              </span>
              <span style={{ color: "#0f172a", fontSize: 12, wordBreak: "break-word" }}>
                {log.message}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

    </div>
  )
}
