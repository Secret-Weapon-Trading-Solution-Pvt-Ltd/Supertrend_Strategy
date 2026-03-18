import Header        from "./components/Header"
import EngineControls from "./components/EngineControls"
import StrategyPanel  from "./components/StrategyPanel"
import PositionPanel  from "./components/PositionPanel"
import TradeLog       from "./components/TradeLog"
import LogPanel       from "./components/LogPanel"

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>

      <Header />

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Top row — 3 panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <EngineControls />
          <StrategyPanel />
          <PositionPanel />
        </div>

        {/* Bottom row — trade log + logs */}
        <div style={{ display: "grid", gridTemplateColumns: "55fr 45fr", gap: 16, minHeight: 340 }}>
          <TradeLog />
          <LogPanel />
        </div>

      </div>
    </div>
  )
}
