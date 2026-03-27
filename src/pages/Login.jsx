import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.bg}>
      <div style={s.card}>
        <h1 style={s.title}>ContratFácil</h1>
        <p style={s.sub}>Acesso restrito ao proprietário</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.group}>
            <label style={s.label}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@gmail.com"
              required
              style={s.input}
            />
          </div>
          <div style={s.group}>
            <label style={s.label}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={s.input}
            />
          </div>
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  bg: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" },
  card: { background: "#fff", padding: "2rem", borderRadius: "16px", width: "360px", boxShadow: "0 8px 32px rgba(0,0,0,0.10)" },
  title: { margin: "0 0 4px", fontSize: "24px", fontWeight: 700 },
  sub: { margin: "0 0 1.5rem", color: "#6b7280", fontSize: "14px" },
  error: { background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "14px" },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  group: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  input: { padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" },
  btn: { background: "#2563eb", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 600, fontSize: "15px", cursor: "pointer", marginTop: "4px" },
};
