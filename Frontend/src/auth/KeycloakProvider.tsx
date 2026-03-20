import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import keycloak from "./keycloak"

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  token:        string | undefined
  username:     string | undefined
  roles:        string[]
  logout:       () => void
  hasRole:      (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside KeycloakProvider")
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function KeycloakProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken]   = useState<string | undefined>()

  useEffect(() => {
    keycloak
      .init({
        onLoad:           "login-required",   // redirect to Keycloak if not logged in
        checkLoginIframe: false,
      })
      .then((authenticated) => {
        if (authenticated) {
          setToken(keycloak.token)
          setReady(true)

          // Refresh token every 60s — keep session alive
          setInterval(() => {
            keycloak.updateToken(60).then((refreshed) => {
              if (refreshed) setToken(keycloak.token)
            })
          }, 60_000)
        }
      })
      .catch(() => {
        console.error("Keycloak init failed")
      })
  }, [])

  if (!ready) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "#0f172a", color: "#94a3b8",
        fontFamily: "system-ui, sans-serif", fontSize: 14,
      }}>
        Connecting to auth server...
      </div>
    )
  }

  const roles    = keycloak.tokenParsed?.realm_access?.roles ?? []
  const username = keycloak.tokenParsed?.preferred_username

  const hasAccess = roles.includes("admin") || roles.includes("trader")

  const value: AuthContextValue = {
    token,
    username,
    roles,
    logout:  () => keycloak.logout({ redirectUri: window.location.origin }),
    hasRole: (role) => roles.includes(role),
  }

  if (!hasAccess) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "#0f172a", color: "#94a3b8",
        fontFamily: "system-ui, sans-serif", gap: 16,
      }}>
        <div style={{ fontSize: 20, color: "#f1f5f9", fontWeight: 600 }}>Access Pending</div>
        <div style={{ fontSize: 14 }}>
          Your account <strong style={{ color: "#f1f5f9" }}>{username}</strong> has no role assigned yet.
        </div>
        <div style={{ fontSize: 13 }}>Contact an admin to assign you the <code style={{ color: "#38bdf8" }}>trader</code> or <code style={{ color: "#38bdf8" }}>admin</code> role.</div>
        <button
          onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
          style={{
            marginTop: 8, padding: "6px 20px", borderRadius: 6,
            border: "1px solid #334155", background: "#1e293b",
            color: "#94a3b8", fontSize: 13, cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
