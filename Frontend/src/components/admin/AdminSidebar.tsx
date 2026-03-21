// components/admin/AdminSidebar.tsx — Dark theme sidebar for admin panel.

import { useState } from "react"
import { useAuth }  from "../../auth/KeycloakProvider"

type AdminPage = "users"

interface Props {
  page:    AdminPage
  setPage: (p: AdminPage) => void
}

const NAV: { id: AdminPage; icon: string; label: string }[] = [
  { id: "users", icon: "👥", label: "Users" },
]

export default function AdminSidebar({ page, setPage }: Props) {
  const { username, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <aside style={{
      width: 260, minHeight: "100vh",
      background: "#0f172a",
      borderRight: "1px solid #1e293b",
      display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0, zIndex: 200,
      boxShadow: "2px 0 16px rgba(0,0,0,0.3)",
    }}>

      {/* Brand */}
      <div style={{ padding: "24px 22px 18px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 20,
            boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
          }}>A</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9", letterSpacing: "-0.2px" }}>SWTS Admin</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Management Console</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "16px 14px", flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "1.2px", padding: "0 8px", marginBottom: 10 }}>
          Menu
        </div>

        {NAV.map(item => (
          <div
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 3,
              background:  page === item.id ? "#1e293b" : "transparent",
              color:       page === item.id ? "#818cf8" : "#64748b",
              fontWeight:  page === item.id ? 600 : 500,
              fontSize:    15,
              borderLeft:  page === item.id ? "3px solid #6366f1" : "3px solid transparent",
              transition:  "all 0.15s",
            }}
            onMouseEnter={e => { if (page !== item.id) { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#94a3b8" } }}
            onMouseLeave={e => { if (page !== item.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b" } }}
          >
            <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{item.icon}</span>
            {item.label}
          </div>
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: "#1e293b", margin: "16px 0" }} />

        {/* Back to App button */}
        <button
          onClick={() => { window.history.pushState({}, "", "/"); window.location.reload() }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "11px 14px", borderRadius: 10, cursor: "pointer",
            border: "1px solid #1e293b", background: "#0f172a",
            color: "#64748b", fontSize: 14, fontWeight: 500,
            transition: "all 0.15s", textAlign: "left",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.color = "#94a3b8" }}
          onMouseLeave={e => { e.currentTarget.style.background = "#0f172a"; e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#64748b" }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: "#1e293b",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>←</span>
          Back to App
        </button>
      </nav>

      {/* Profile section */}
      <div style={{ borderTop: "1px solid #1e293b", position: "relative" }}>

        {/* Sign out — only shows when profile is clicked */}
        {profileOpen && (
          <button
            onClick={logout}
            style={{
              width: "100%", padding: "14px 20px",
              background: "linear-gradient(135deg, #1a0505, #2d0a0a)",
              border: "none", borderTop: "1px solid #7f1d1d",
              color: "#fca5a5", fontSize: 14, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              transition: "all 0.2s", letterSpacing: "0.3px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #7f1d1d, #991b1b)"
              e.currentTarget.style.color = "#fff"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #1a0505, #2d0a0a)"
              e.currentTarget.style.color = "#fca5a5"
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, #7f1d1d, #b91c1c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, boxShadow: "0 2px 8px rgba(185,28,28,0.4)",
            }}>⇥</span>
            Sign Out
          </button>
        )}

        {/* Profile row */}
        <div
          onClick={() => setProfileOpen(v => !v)}
          style={{
            padding: "15px 18px", display: "flex", alignItems: "center", gap: 12,
            cursor: "pointer", transition: "background 0.15s",
            background: profileOpen ? "#1e293b" : "transparent",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
          onMouseLeave={e => (e.currentTarget.style.background = profileOpen ? "#1e293b" : "transparent")}
        >
          <div style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #312e81, #4338ca)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#a5b4fc",
            border: "2px solid #3730a3",
          }}>
            {username?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {username}
            </div>
            <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, marginTop: 2 }}>Administrator</div>
          </div>
          <span style={{
            fontSize: 10, color: "#334155",
            transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s", display: "inline-block",
          }}>▼</span>
        </div>

      </div>
    </aside>
  )
}
