import { useEffect }   from "react"
import AdminLayout      from "./components/admin/AdminLayout"
import { useAuth }      from "./auth/KeycloakProvider"

export type Page = "dashboard"

export default function App() {
  const { hasRole, token } = useAuth()
  const isAdminRoute = window.location.pathname === "/admin"

  // Save Keycloak token → redirect approved users to the HTML dashboard
  useEffect(() => {
    if (!isAdminRoute && token) {
      localStorage.setItem("swts_token", token)
      window.location.href = "/dashboard"
    }
  }, [token, isAdminRoute])

  // ── /admin route ──────────────────────────────────────────────────────────
  if (isAdminRoute) {
    if (!hasRole("admin")) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100vh", background: "#0f172a", color: "#94a3b8",
          fontFamily: "system-ui, sans-serif", gap: 12,
        }}>
          <div style={{ fontSize: 20, color: "#f1f5f9", fontWeight: 600 }}>Access Denied</div>
          <div style={{ fontSize: 13 }}>You need the <code style={{ color: "#818cf8" }}>admin</code> role to access this page.</div>
          <button
            onClick={() => window.history.pushState({}, "", "/")}
            style={{
              marginTop: 8, padding: "6px 20px", borderRadius: 6,
              border: "1px solid #334155", background: "#1e293b",
              color: "#94a3b8", fontSize: 13, cursor: "pointer",
            }}
          >Go back</button>
        </div>
      )
    }
    return <AdminLayout />
  }

  // ── Redirecting approved users → /dashboard ───────────────────────────────
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0d1117",
      fontFamily: "system-ui, sans-serif", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 22, color: "#58a6ff" }}>↗</div>
      <div style={{ fontSize: 14, color: "#8b949e" }}>Loading dashboard…</div>
    </div>
  )
}
