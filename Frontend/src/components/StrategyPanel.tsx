import { useState } from "react"
import { emit } from "../socket/socket"

const card: React.CSSProperties = {
  background:   "#fff",
  border:       "1px solid #e2e8f0",
  borderRadius: 10,
  padding:      "16px",
}

interface ToggleProps {
  label:       string
  description: string
  enabled:     boolean
  onChange:    (val: boolean) => void
}

function Toggle({ label, description, enabled, onChange }: ToggleProps) {
  return (
    <div style={{
      display:       "flex",
      alignItems:    "center",
      justifyContent:"space-between",
      padding:       "10px 12px",
      borderRadius:  8,
      background:    enabled ? "#f0fdf4" : "#f8fafc",
      border:        `1px solid ${enabled ? "#bbf7d0" : "#e2e8f0"}`,
      marginBottom:  8,
      cursor:        "pointer",
      transition:    "all 0.2s",
    }} onClick={() => onChange(!enabled)}>
      <div>
        <p style={{ fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>{label}</p>
        <p style={{ color: "#94a3b8", fontSize: 11 }}>{description}</p>
      </div>
      <div style={{
        width:        36,
        height:       20,
        borderRadius: 10,
        background:   enabled ? "#059669" : "#cbd5e1",
        position:     "relative",
        transition:   "background 0.2s",
        flexShrink:   0,
      }}>
        <div style={{
          position:     "absolute",
          top:          2,
          left:         enabled ? 18 : 2,
          width:        16,
          height:       16,
          borderRadius: "50%",
          background:   "#fff",
          transition:   "left 0.2s",
          boxShadow:    "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
    </div>
  )
}

export default function StrategyPanel() {
  const [supertrend, setSupertrend] = useState(true)
  const [atr,        setAtr]        = useState(true)
  const [mode,       setMode]       = useState<"forward_test" | "live">("forward_test")

  const toggleST = (val: boolean) => {
    setSupertrend(val)
    emit.indicatorToggle({ name: "supertrend", enabled: val })
  }

  const toggleATR = (val: boolean) => {
    setAtr(val)
    emit.indicatorToggle({ name: "atr", enabled: val })
  }

  const switchMode = (m: "forward_test" | "live") => {
    setMode(m)
    emit.modeSwitch({ mode: m })
  }

  return (
    <div style={card}>
      <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 14 }}>
        Strategy
      </p>

      <Toggle
        label="Supertrend"
        description="BUY when ST flips green"
        enabled={supertrend}
        onChange={toggleST}
      />
      <Toggle
        label="ATR Filter"
        description="Block entries on low volatility"
        enabled={atr}
        onChange={toggleATR}
      />

      {/* Mode Switch */}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
          Mode
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {(["forward_test", "live"] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex:         1,
                padding:      "7px 0",
                borderRadius: 6,
                border:       `1px solid ${mode === m ? (m === "live" ? "#dc2626" : "#2563eb") : "#e2e8f0"}`,
                fontWeight:   600,
                fontSize:     12,
                cursor:       "pointer",
                background:   mode === m ? (m === "live" ? "#fee2e2" : "#eff6ff") : "#f8fafc",
                color:        mode === m ? (m === "live" ? "#dc2626" : "#2563eb") : "#64748b",
                transition:   "all 0.2s",
              }}
            >
              {m === "forward_test" ? "Forward Test" : "🔴 Live"}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
