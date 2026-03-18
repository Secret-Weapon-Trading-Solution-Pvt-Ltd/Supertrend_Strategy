import { usePosition } from "../hooks/usePosition"

const card: React.CSSProperties = {
  background:   "#fff",
  border:       "1px solid #e2e8f0",
  borderRadius: 10,
  padding:      "16px",
}

const row = (label: string, value: React.ReactNode) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
    <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
    <span className="num" style={{ fontWeight: 600, color: "#0f172a" }}>{value}</span>
  </div>
)

export default function PositionPanel() {
  const { position, lastExit, lastOrder } = usePosition()

  return (
    <div style={card}>
      <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 14 }}>
        Position
      </p>

      {position ? (
        <>
          <div style={{
            padding:      "10px 12px",
            borderRadius: 8,
            background:   position.unrealized_pnl >= 0 ? "#f0fdf4" : "#fff1f2",
            border:       `1px solid ${position.unrealized_pnl >= 0 ? "#bbf7d0" : "#fecdd3"}`,
            marginBottom: 12,
            textAlign:    "center",
          }}>
            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Unrealized P&L</p>
            <p className="num" style={{
              fontSize:   22,
              fontWeight: 700,
              color:      position.unrealized_pnl >= 0 ? "#059669" : "#dc2626",
            }}>
              {position.unrealized_pnl >= 0 ? "+" : ""}₹{position.unrealized_pnl.toFixed(2)}
            </p>
          </div>

          {row("Symbol",        position.symbol)}
          {row("Entry Price",   `₹${position.entry_price.toFixed(2)}`)}
          {row("Current Price", `₹${position.current_price.toFixed(2)}`)}
          {row("Peak Price",    `₹${position.peak_price.toFixed(2)}`)}
        </>
      ) : lastExit ? (
        <div style={{
          padding:      "12px",
          borderRadius: 8,
          background:   lastExit.result === "PROFIT" ? "#f0fdf4" : "#fff1f2",
          border:       `1px solid ${lastExit.result === "PROFIT" ? "#bbf7d0" : "#fecdd3"}`,
          textAlign:    "center",
        }}>
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Last Trade — {lastExit.reason}</p>
          <p className="num" style={{
            fontSize:   20,
            fontWeight: 700,
            color:      lastExit.result === "PROFIT" ? "#059669" : "#dc2626",
          }}>
            {lastExit.result === "PROFIT" ? "+" : ""}₹{lastExit.pnl_amount.toFixed(2)}
          </p>
          <p style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>
            {lastExit.entry_price.toFixed(2)} → {lastExit.exit_price.toFixed(2)}
            &nbsp;({lastExit.pnl_points >= 0 ? "+" : ""}{lastExit.pnl_points.toFixed(2)} pts)
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>—</p>
          <p>No open position</p>
        </div>
      )}

      {/* Last order badge */}
      {lastOrder && (
        <div style={{
          marginTop:    12,
          padding:      "6px 10px",
          borderRadius: 6,
          background:   lastOrder.type === "BUY" ? "#eff6ff" : "#fff1f2",
          border:       `1px solid ${lastOrder.type === "BUY" ? "#bfdbfe" : "#fecdd3"}`,
          display:      "flex",
          justifyContent: "space-between",
          alignItems:   "center",
        }}>
          <span style={{ fontWeight: 600, color: lastOrder.type === "BUY" ? "#2563eb" : "#dc2626", fontSize: 12 }}>
            {lastOrder.type}
          </span>
          <span className="num" style={{ color: "#0f172a", fontSize: 12 }}>
            {lastOrder.qty} × ₹{lastOrder.price.toFixed(2)}
          </span>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>#{lastOrder.order_id}</span>
        </div>
      )}

    </div>
  )
}
