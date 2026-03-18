import { useSocket } from "../hooks/useSocket"
import { useTick } from "../hooks/useTick"
import { useEngine } from "../hooks/useEngine"

export default function Header() {
  const { connected } = useSocket()
  const tick          = useTick()
  const { engineState } = useEngine()

  return (
    <header style={{
      background:   "#fff",
      borderBottom: "1px solid #e2e8f0",
      padding:      "0 24px",
      height:       "52px",
      display:      "flex",
      alignItems:   "center",
      justifyContent: "space-between",
      position:     "sticky",
      top:          0,
      zIndex:       100,
    }}>

      {/* Left — Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", letterSpacing: "-0.5px" }}>
          SWTS
        </span>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>Supertrend Strategy</span>
      </div>

      {/* Center — Live tick */}
      {tick && (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontWeight: 600, color: "#0f172a" }}>{tick.symbol}</span>
          <span className="num" style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
            ₹{tick.close.toFixed(2)}
          </span>
          <span style={{
            padding:      "2px 8px",
            borderRadius: 4,
            fontSize:     11,
            fontWeight:   600,
            background:   tick.direction === "GREEN" ? "#dcfce7" : tick.direction === "RED" ? "#fee2e2" : "#f1f5f9",
            color:        tick.direction === "GREEN" ? "#059669" : tick.direction === "RED" ? "#dc2626" : "#64748b",
          }}>
            ST {tick.direction}
          </span>
          {tick.atr && (
            <span style={{ color: "#64748b" }}>
              ATR <span className="num">{tick.atr.toFixed(2)}</span>
            </span>
          )}
        </div>
      )}

      {/* Right — Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {engineState && (
          <span style={{
            padding:      "2px 10px",
            borderRadius: 4,
            fontSize:     11,
            fontWeight:   600,
            background:   engineState.state === "RUNNING" ? "#dcfce7" : "#f1f5f9",
            color:        engineState.state === "RUNNING" ? "#059669" : "#64748b",
          }}>
            {engineState.state}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width:        7,
            height:       7,
            borderRadius: "50%",
            background:   connected ? "#059669" : "#dc2626",
          }} />
          <span style={{ color: "#64748b" }}>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

    </header>
  )
}
