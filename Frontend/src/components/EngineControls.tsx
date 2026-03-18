import { useState } from "react"
import { useEngine } from "../hooks/useEngine"
import { useTimeframes, useInstrumentSearch } from "../hooks/useInstruments"
import type { Instrument } from "../types"

const card: React.CSSProperties = {
  background:   "#fff",
  border:       "1px solid #e2e8f0",
  borderRadius: 10,
  padding:      "16px",
}

const label: React.CSSProperties = {
  display:      "block",
  fontSize:     11,
  fontWeight:   600,
  color:        "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 6,
}

const input: React.CSSProperties = {
  width:        "100%",
  padding:      "8px 10px",
  border:       "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize:     13,
  color:        "#0f172a",
  background:   "#f8fafc",
  outline:      "none",
}

const btn = (color: string, bg: string, disabled = false): React.CSSProperties => ({
  padding:       "8px 16px",
  borderRadius:  6,
  border:        "none",
  fontWeight:    600,
  fontSize:      13,
  cursor:        disabled ? "not-allowed" : "pointer",
  color:         disabled ? "#94a3b8" : color,
  background:    disabled ? "#f1f5f9" : bg,
  opacity:       disabled ? 0.6 : 1,
  transition:    "opacity 0.2s",
})

export default function EngineControls() {
  const timeframes               = useTimeframes()
  const { results, search }      = useInstrumentSearch()
  const { isRunning, isPaused, start, stop, pause, resume } = useEngine()

  const [query,    setQuery]    = useState("")
  const [selected, setSelected] = useState<Instrument | null>(null)
  const [interval, setInterval] = useState("5minute")
  const [qty,      setQty]      = useState(1)
  const [showDrop, setShowDrop] = useState(false)

  const handleSearch = (val: string) => {
    setQuery(val)
    setSelected(null)
    setShowDrop(true)
    search({ query: val, exchange: "NSE" })
  }

  const handleSelect = (inst: Instrument) => {
    setSelected(inst)
    setQuery(inst.symbol + " — " + inst.name)
    setShowDrop(false)
  }

  const handleStart = () => {
    if (!selected) return
    start({ symbol: selected.symbol, token: selected.token, qty, interval })
  }

  return (
    <div style={card}>
      <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 14 }}>
        Engine Controls
      </p>

      {/* Symbol Search */}
      <div style={{ marginBottom: 12, position: "relative" }}>
        <label style={label}>Symbol</label>
        <input
          style={input}
          placeholder="Search symbol e.g. RELIANCE"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => setShowDrop(true)}
        />
        {showDrop && results.length > 0 && (
          <div style={{
            position:   "absolute",
            top:        "100%",
            left:       0,
            right:      0,
            background: "#fff",
            border:     "1px solid #e2e8f0",
            borderRadius: 6,
            zIndex:     50,
            maxHeight:  200,
            overflowY:  "auto",
            boxShadow:  "0 4px 16px rgba(0,0,0,0.08)",
          }}>
            {results.map(inst => (
              <div
                key={inst.token}
                onClick={() => handleSelect(inst)}
                style={{
                  padding:  "8px 12px",
                  cursor:   "pointer",
                  borderBottom: "1px solid #f1f5f9",
                  display:  "flex",
                  justifyContent: "space-between",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{inst.symbol}</span>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>{inst.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interval */}
      <div style={{ marginBottom: 12 }}>
        <label style={label}>Interval</label>
        <select
          style={{ ...input, cursor: "pointer" }}
          value={interval}
          onChange={e => setInterval(e.target.value)}
        >
          {timeframes.map(tf => (
            <option key={tf.interval} value={tf.interval}>{tf.label}</option>
          ))}
        </select>
      </div>

      {/* Qty */}
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Quantity</label>
        <input
          style={input}
          type="number"
          min={1}
          value={qty}
          onChange={e => setQty(Number(e.target.value))}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        {!isRunning && !isPaused && (
          <button
            style={btn("#fff", "#2563eb", !selected)}
            onClick={handleStart}
            disabled={!selected}
          >
            ▶ Start
          </button>
        )}
        {isRunning && (
          <>
            <button style={btn("#fff", "#f59e0b")} onClick={pause}>⏸ Pause</button>
            <button style={btn("#fff", "#dc2626")} onClick={stop}>■ Stop</button>
          </>
        )}
        {isPaused && (
          <>
            <button style={btn("#fff", "#059669")} onClick={resume}>▶ Resume</button>
            <button style={btn("#fff", "#dc2626")} onClick={stop}>■ Stop</button>
          </>
        )}
      </div>

    </div>
  )
}
