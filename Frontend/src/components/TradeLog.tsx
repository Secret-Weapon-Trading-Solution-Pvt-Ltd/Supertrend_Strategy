import { useTrades } from "../hooks/useTrades"

const REASON_COLOR: Record<string, string> = {
  TARGET:      "#059669",
  FIXED_SL:    "#dc2626",
  TRAILING_SL: "#f59e0b",
  SESSION_END: "#64748b",
  ST_RED:      "#8b5cf6",
}

export default function TradeLog() {
  const { trades, refresh } = useTrades()

  return (
    <div style={{
      background:   "#fff",
      border:       "1px solid #e2e8f0",
      borderRadius: 10,
      overflow:     "hidden",
    }}>

      {/* Header */}
      <div style={{
        padding:        "12px 16px",
        borderBottom:   "1px solid #f1f5f9",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
      }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
          Trade Log <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>({trades.length})</span>
        </p>
        <button onClick={refresh} style={{
          background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
          padding: "4px 10px", cursor: "pointer", color: "#64748b", fontSize: 12,
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Symbol", "Entry", "Exit", "Pts", "P&L", "Reason", "Mode", "Time"].map(h => (
                <th key={h} style={{
                  padding:   "8px 12px",
                  textAlign: "left",
                  fontSize:  11,
                  fontWeight: 600,
                  color:     "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  borderBottom: "1px solid #e2e8f0",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                  No trades yet
                </td>
              </tr>
            ) : trades.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                <td style={{ padding: "8px 12px", fontWeight: 600, color: "#0f172a" }}>{t.symbol}</td>
                <td className="num" style={{ padding: "8px 12px", color: "#64748b" }}>₹{t.entry_price.toFixed(2)}</td>
                <td className="num" style={{ padding: "8px 12px", color: "#64748b" }}>₹{t.exit_price.toFixed(2)}</td>
                <td className="num" style={{
                  padding:    "8px 12px",
                  fontWeight: 600,
                  color:      t.pnl_points >= 0 ? "#059669" : "#dc2626",
                }}>
                  {t.pnl_points >= 0 ? "+" : ""}{t.pnl_points.toFixed(2)}
                </td>
                <td className="num" style={{
                  padding:    "8px 12px",
                  fontWeight: 700,
                  color:      t.pnl_amount >= 0 ? "#059669" : "#dc2626",
                }}>
                  {t.pnl_amount >= 0 ? "+" : ""}₹{t.pnl_amount.toFixed(2)}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    padding:      "2px 7px",
                    borderRadius: 4,
                    fontSize:     11,
                    fontWeight:   600,
                    color:        REASON_COLOR[t.exit_reason] || "#64748b",
                    background:   `${REASON_COLOR[t.exit_reason]}18` || "#f1f5f9",
                  }}>
                    {t.exit_reason}
                  </span>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    padding:      "2px 7px",
                    borderRadius: 4,
                    fontSize:     11,
                    background:   t.broker_mode === "live" ? "#fee2e2" : "#eff6ff",
                    color:        t.broker_mode === "live" ? "#dc2626" : "#2563eb",
                    fontWeight:   600,
                  }}>
                    {t.broker_mode === "live" ? "LIVE" : "FT"}
                  </span>
                </td>
                <td className="num" style={{ padding: "8px 12px", color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>
                  {t.exit_time ? new Date(t.exit_time).toLocaleTimeString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
