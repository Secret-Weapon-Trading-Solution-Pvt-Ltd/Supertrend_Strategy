// components/admin/UserRow.tsx — Dark theme single user row.

import { useState }                                    from "react"
import RoleBadge                                       from "./RoleBadge"
import { MANAGED_ROLES, type AdminUser }               from "../../hooks/useAdminUsers"

interface Props {
  user:         AdminUser
  activeFilter: string
  onAssign:     (userId: string, role: string) => void
  onRemove:     (userId: string, role: string) => void
  onDelete:     (userId: string) => void
}

// ── Button style presets ────────────────────────────────────────────────────

const BTN: Record<string, React.CSSProperties> = {
  green:  { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #064e3b", background: "#052e16", color: "#34d399", transition: "all 0.15s" },
  red:    { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", transition: "all 0.15s" },
  orange: { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #92400e", background: "#1c0900", color: "#fb923c", transition: "all 0.15s" },
  indigo: { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #312e81", background: "#1e1b4b", color: "#818cf8", transition: "all 0.15s" },
  ghost:  { padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid #334155", background: "transparent", color: "#64748b", transition: "all 0.15s" },
}

const HOVER: Record<string, Partial<React.CSSProperties>> = {
  green:  { background: "#064e3b" },
  red:    { background: "#7f1d1d" },
  orange: { background: "#92400e" },
  indigo: { background: "#312e81" },
  ghost:  { color: "#94a3b8", borderColor: "#475569" },
}

// ── Context-sensitive actions ───────────────────────────────────────────────

type ActionDef = { label: string; variant: string; onClick: () => void }

function getActions(
  user: AdminUser,
  filter: string,
  onAssign: (id: string, role: string) => void,
  onRemove: (id: string, role: string) => void,
  onDelete: (id: string) => void,
): ActionDef[] {
  const id = user.id

  const approve     : ActionDef = { label: "✓ Approve",     variant: "green",  onClick: () => onAssign(id, "approve") }
  const revoke      : ActionDef = { label: "✕ Revoke",      variant: "red",    onClick: () => onAssign(id, "revoke")  }
  const makeAdmin   : ActionDef = { label: "⛨ Make Admin",  variant: "indigo", onClick: () => onAssign(id, "admin")   }
  const removeAdmin : ActionDef = { label: "− Rem. Admin",  variant: "ghost",  onClick: () => onRemove(id, "admin")   }
  const del         : ActionDef = { label: "🗑 Delete",      variant: "orange", onClick: () => onDelete(id)            }

  const effective = filter === "all"
    ? user.roles.includes("admin")   ? "admin"
    : user.roles.includes("approve") ? "approve"
    : user.roles.includes("revoke")  ? "revoke"
    : "pending"
    : filter

  switch (effective) {
    case "approve": return [revoke, makeAdmin, del]
    case "pending":  return [approve, revoke, makeAdmin, del]
    case "admin":    return [revoke, removeAdmin, del]
    case "revoke":   return [approve, del]
    default:         return [approve, revoke, del]
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function UserRow({ user, activeFilter, onAssign, onRemove, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const managedRoles = user.roles.filter(r => MANAGED_ROLES.includes(r as typeof MANAGED_ROLES[number]))
  const displayRoles = managedRoles.length > 0 ? managedRoles : ["pending"]

  const actions = getActions(
    user, activeFilter,
    onAssign, onRemove,
    () => setConfirmDelete(true),
  )

  return (
    <tr
      style={{ borderBottom: "1px solid #1e293b", transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#162032")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >

      {/* User — avatar + name + email */}
      <td style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #312e81, #4338ca)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#a5b4fc",
            border: "2px solid #3730a3",
          }}>
            {user.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#e2e8f0" }}>{user.username}</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{user.email || "—"}</div>
          </div>
        </div>
      </td>

      {/* Status — role badges */}
      <td style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {displayRoles.map(r => <RoleBadge key={r} role={r} />)}
        </div>
      </td>

      {/* Joined */}
      <td style={{ padding: "16px 22px", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>
        {user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—"}
      </td>

      {/* Actions */}
      <td style={{ padding: "16px 22px" }}>
        {confirmDelete ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#f87171", whiteSpace: "nowrap", fontWeight: 600 }}>Delete user?</span>
            <button
              onClick={() => { onDelete(user.id); setConfirmDelete(false) }}
              style={{ ...BTN.orange, padding: "5px 12px" }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, HOVER.orange)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: BTN.orange.background })}
            >Yes</button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ ...BTN.ghost, padding: "5px 12px" }}
            >No</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {actions.map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                style={{ ...BTN[a.variant] }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, HOVER[a.variant])}
                onMouseLeave={e => Object.assign(e.currentTarget.style, {
                  background:  BTN[a.variant].background,
                  color:       BTN[a.variant].color,
                  borderColor: BTN[a.variant].border,
                })}
              >{a.label}</button>
            ))}
          </div>
        )}
      </td>

    </tr>
  )
}
