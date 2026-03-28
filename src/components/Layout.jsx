import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Layout({ children }) {
  const { user, nivel, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={s.shell}>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <span style={s.logo}>ContratFácil</span>
          <NavLink to="/imoveis" style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
            Imóveis
          </NavLink>
          <NavLink to="/" end style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
            + Novo contrato
          </NavLink>
          <NavLink to="/historico" style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
            Histórico
          </NavLink>
          {nivel === "ADMIN" && (
            <NavLink to="/admin" style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
              Admin
            </NavLink>
          )}
        </div>
        <div style={s.navRight}>
          {nivel && nivel !== "NORMAL" && (
            <span style={{ ...s.levelBadge, ...(nivel === "ADMIN" ? s.levelAdmin : s.levelPremium) }}>
              {nivel}
            </span>
          )}
          <span style={s.userEmail}>{user?.email}</span>
          <button onClick={handleLogout} style={s.logoutBtn}>Sair</button>
        </div>
      </nav>
      <main style={s.main}>{children}</main>
    </div>
  );
}

const s = {
  shell: { minHeight: "100vh", background: "#f4f5f7" },
  nav: {
    background: "#fff", borderBottom: "1px solid #e5e7eb",
    padding: "0 1.5rem", height: "52px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  navLeft: { display: "flex", alignItems: "center", gap: "4px" },
  logo: { fontWeight: 700, fontSize: "16px", marginRight: "16px" },
  link: { padding: "6px 12px", borderRadius: "8px", fontSize: "14px", textDecoration: "none", color: "#6b7280", fontWeight: 500 },
  linkActive: { background: "#eff6ff", color: "#2563eb" },
  navRight: { display: "flex", alignItems: "center", gap: "10px" },
  levelBadge: { padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  levelAdmin: { background: "#ede9fe", color: "#5b21b6" },
  levelPremium: { background: "#fef9c3", color: "#854d0e" },
  userEmail: { fontSize: "13px", color: "#9ca3af" },
  logoutBtn: { background: "none", border: "1px solid #e5e7eb", padding: "5px 12px", borderRadius: "6px", fontSize: "13px", cursor: "pointer", color: "#374151" },
  main: { padding: "0" },
};
