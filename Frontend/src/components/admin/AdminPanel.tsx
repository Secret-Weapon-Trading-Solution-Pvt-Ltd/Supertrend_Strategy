// components/admin/AdminPanel.tsx — Dark theme user management panel.

import { useState }                          from "react"
import UserTable                             from "./UserTable"
import { useAdminUsers, isEffectivelyPending } from "../../hooks/useAdminUsers"

const STATS = [
  { key: "pending", filter: "pending", label: "Pending",     icon: "⏳", accent: "#fbbf24", bg: "#1c1500", border: "#451a03" },
  { key: "approve", filter: "approve", label: "Approved",    icon: "✅", accent: "#34d399", bg: "#052e16", border: "#064e3b" },
  { key: "admins",  filter: "admin",   label: "Admins",      icon: "⛨",  accent: "#818cf8", bg: "#1e1b4b", border: "#312e81" },
  { key: "revoke",  filter: "revoke",  label: "Revoked",     icon: "🚫", accent: "#f87171", bg: "#1a0505", border: "#7f1d1d" },
  { key: "total",   filter: "all",     label: "Total Users", icon: "👤", accent: "#94a3b8", bg: "#1e293b",  border: "#334155" },
]

export default function AdminPanel() {
  const { users, loading, error, assignRole, removeRole, deleteUser } = useAdminUsers()
  const [activeFilter, setActiveFilter] = useState("all")

  const counts: Record<string, number> = {
    total:   users.length,
    admins:  users.filter(u => u.roles.includes("admin")).length,
    approve: users.filter(u => u.roles.includes("approve")).length,
    revoke:  users.filter(u => u.roles.includes("revoke")).length,
    pending: users.filter(isEffectivelyPending).length,
  }

  const handleStatClick = (filter: string) => {
    setActiveFilter(prev => prev === filter ? "all" : filter)
  }

  return (
    <div style={{ padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 18px", borderRadius: 10, fontSize: 14,
          background: "#1a0505", border: "1px solid #7f1d1d", color: "#f87171",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Stats row — clickable to filter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        {STATS.map(s => {
          const isActive = activeFilter === s.filter
          return (
            <div
              key={s.key}
              onClick={() => handleStatClick(s.filter)}
              style={{
                background:   s.bg,
                border:       `2px solid ${isActive ? s.accent : s.border}`,
                borderRadius: 14,
                padding:      "20px 20px",
                display:      "flex", alignItems: "center", gap: 16,
                boxShadow:    isActive ? `0 0 0 3px ${s.accent}22` : "0 2px 8px rgba(0,0,0,0.3)",
                cursor:       "pointer",
                transition:   "all 0.15s",
                transform:    isActive ? "translateY(-2px)" : "none",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = s.accent + "88" }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = s.border }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.accent, lineHeight: 1 }}>
                  {counts[s.key]}
                </div>
                <div style={{ fontSize: 12, color: s.accent, opacity: 0.7, marginTop: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {s.label}
                </div>
              </div>
            </div>
          )
        })}
      </div>


      {/* Table card */}
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#162032",
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0" }}>All Users</div>
          <div style={{ fontSize: 13, color: "#475569" }}>
            {loading ? "Loading…" : `${users.length} total`}
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px", color: "#475569", fontSize: 15 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading users…
          </div>
        ) : (
          <UserTable
            users={users}
            activeFilter={activeFilter}
            onAssign={assignRole}
            onRemove={removeRole}
            onDelete={deleteUser}
          />
        )}
      </div>

    </div>
  )
}
