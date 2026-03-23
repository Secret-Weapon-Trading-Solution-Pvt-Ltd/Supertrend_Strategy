// components/admin/AdminLayout.tsx — Dark theme layout for admin panel.

import { useState }  from "react"
import AdminSidebar  from "./AdminSidebar"
import AdminPanel    from "./AdminPanel"

type AdminPage = "users"

const PAGE_META: Record<AdminPage, { title: string; subtitle: string }> = {
  users: { title: "User Management", subtitle: "Manage accounts, roles and access" },
}

export default function AdminLayout() {
  const [page, setPage]       = useState<AdminPage>("users")
  const [refresh, setRefresh] = useState(0)
  const meta = PAGE_META[page]

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0f172a" }}>

      <AdminSidebar page={page} setPage={setPage} />

      <div style={{ marginLeft: 260, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Top bar */}
        <div style={{
          height: 72, background: "#0f172a", borderBottom: "1px solid #1e293b",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 12px rgba(0,0,0,0.4)",
        }}>
          {/* Page title + subtitle */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px", lineHeight: 1.2 }}>{meta.title}</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 3 }}>{meta.subtitle}</div>
          </div>

          {/* Date + Refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Date chip */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", borderRadius: 10,
              background: "#1e293b", border: "1px solid #293548",
            }}>
              <span style={{ fontSize: 15 }}>📅</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", lineHeight: 1.2 }}>
                  {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.2 }}>
                  {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
                </div>
              </div>
            </div>

            {/* Refresh button */}
            <button
              onClick={() => setRefresh(r => r + 1)}
              style={{
                padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: "1px solid #312e81", background: "linear-gradient(135deg, #1e1b4b, #2e2b6b)",
                color: "#a5b4fc", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                boxShadow: "0 2px 8px rgba(99,102,241,0.2)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "linear-gradient(135deg, #312e81, #4338ca)"
                e.currentTarget.style.color = "#e0e7ff"
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.4)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "linear-gradient(135deg, #1e1b4b, #2e2b6b)"
                e.currentTarget.style.color = "#a5b4fc"
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.2)"
              }}
            >
              <span style={{ fontSize: 15 }}>↺</span> Refresh
            </button>
          </div>
        </div>

        {page === "users" && <AdminPanel key={refresh} />}

      </div>
    </div>
  )
}
