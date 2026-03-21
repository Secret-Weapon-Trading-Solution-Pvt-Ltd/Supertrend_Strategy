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

const BTN_STYLES: Record<string, React.CSSProperties> = {
  green: {
    padding: "5px 13px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #064e3b", background: "#052e16", color: "#34d399", transition: "all 0.15s",
  },
  red: {
    padding: "5px 13px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", transition: "all 0.15s",
  },
  indigo: {
    padding: "5px 13px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #312e81", background: "#1e1b4b", color: "#818cf8", transition: "all 0.15s",
  },
  ghost: {
    padding: "5px 13px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
    border: "1px solid #334155", background: "transparent", color: "#64748b", transition: "all 0.15s",
  },
}

const BTN_HOVER: Record<string, Partial<React.CSSProperties>> = {
  green:  { background: "#064e3b" },
  red:    { background: "#7f1d1d" },
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

  const approve     : ActionDef = { label: "✓ Approve",      variant: "green",  onClick: () => onAssign(id, "approve") }
  const revoke      : ActionDef = { label: "✕ Revoke",       variant: "red",    onClick: () => onAssign(id, "revoke")  }
  const makeAdmin   : ActionDef = { label: "⛨ Make Admin",   variant: "indigo", onClick: () => onAssign(id, "admin")   }
  const removeAdmin : ActionDef = { label: "− Rem. Admin",   variant: "ghost",  onClick: () => onRemove(id, "admin")   }
  const del         : ActionDef = { label: "🗑 Delete",       variant: "red",    onClick: () => onDelete(id)            }

  // For "all" filter, derive from user's actual primary role
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

  // Only show managed roles (no keycloak internal roles)
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

      {/* User — name + email */}
      <td style={{ padding: "13px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #312e81, #4338ca)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#a5b4fc",
            border: "2px solid #3730a3",
          }}>
            {user.username?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>{user.username}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{user.email || "—"}</div>
          </div>
        </div>
      </td>

      {/* Status — role badges (display only) */}
      <td style={{ padding: "13px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {displayRoles.map(r => <RoleBadge key={r} role={r} />)}
        </div>
      </td>

      {/* Joined */}
      <td style={{ padding: "13px 20px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>
        {user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—"}
      </td>

      {/* Actions */}
      <td style={{ padding: "13px 20px" }}>
        {confirmDelete ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#f87171", whiteSpace: "nowrap" }}>Delete user?</span>
            <button
              onClick={() => { onDelete(user.id); setConfirmDelete(false) }}
              style={{ ...BTN_STYLES.red, padding: "4px 10px" }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, BTN_HOVER.red)}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { background: BTN_STYLES.red.background })}
            >Yes</button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ ...BTN_STYLES.ghost, padding: "4px 10px" }}
            >No</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {actions.map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                style={{ ...BTN_STYLES[a.variant] }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, BTN_HOVER[a.variant])}
                onMouseLeave={e => Object.assign(e.currentTarget.style, {
                  background: BTN_STYLES[a.variant].background,
                  color:      BTN_STYLES[a.variant].color,
                  borderColor: (BTN_STYLES[a.variant] as any).borderColor ?? BTN_STYLES[a.variant].border,
                })}
              >{a.label}</button>
            ))}
          </div>
        )}
      </td>

    </tr>
  )
}
